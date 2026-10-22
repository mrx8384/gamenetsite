"use server";

import { revalidatePath } from "next/cache";
import { updateTag } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertUser, AuthorizationError } from "@/lib/auth/dal";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { env } from "@/lib/env";
import { fail, GENERIC_ERROR, ok, RATE_LIMIT_ERROR, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestInfo } from "@/lib/request-info";
import { getPaymentProvider } from "@/features/payments";
import { getCommerceSettings } from "@/features/settings/commerce";
import { findCartId } from "@/features/cart/service";
import { addressSchema, placeOrderSchema } from "./schemas";
import { cancelOrderTx, expireStaleOrders, generateOrderNumber, OrderError, PAYMENT_WINDOW_MINUTES } from "./service";

const LOGIN_REQUIRED = "برای ادامه وارد حساب کاربری شوید.";

async function session() {
  try {
    return await assertUser();
  } catch (e) {
    if (e instanceof AuthorizationError) return null;
    throw e;
  }
}

// ───────────── Addresses ─────────────

export async function saveAddress(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const s = await session();
  if (!s) return fail(LOGIN_REQUIRED);
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", zodFieldErrors(parsed.error.issues));
  const count = await db.address.count({ where: { userId: s.user.id } });
  if (!id && count >= 10) return fail("حداکثر ۱۰ آدرس می‌توانید ذخیره کنید.");
  if (id) {
    const { count: updated } = await db.address.updateMany({ where: { id, userId: s.user.id }, data: parsed.data });
    if (!updated) return fail("آدرس پیدا نشد.");
    return ok({ id }, "آدرس ذخیره شد.");
  }
  const created = await db.address.create({ data: { ...parsed.data, userId: s.user.id, isDefault: count === 0 }, select: { id: true } });
  revalidatePath("/checkout");
  return ok(created, "آدرس ذخیره شد.");
}

export async function deleteAddress(id: string): Promise<ActionResult<undefined>> {
  const s = await session();
  if (!s) return fail(LOGIN_REQUIRED);
  const { count } = await db.address.deleteMany({ where: { id, userId: s.user.id } });
  revalidatePath("/checkout");
  return count ? ok(undefined, "آدرس حذف شد.") : fail("آدرس پیدا نشد.");
}

// ───────────── Checkout ─────────────

async function startPayment(orderId: string, mobile: string | null): Promise<string> {
  const provider = getPaymentProvider();
  if (!provider) throw new OrderError("no_provider");
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, select: { number: true, total: true } });
  const payment = await db.payment.create({ data: { orderId, provider: provider.key, amount: order.total }, select: { id: true } });
  const callbackUrl = new URL(`/api/payments/callback/${provider.key}`, env.APP_URL).toString();
  const { authority, redirectUrl } = await provider.createPayment({
    paymentId: payment.id,
    amount: order.total,
    description: `سفارش ${order.number} — آتم گیم کلاب`,
    callbackUrl,
    mobile,
  });
  await db.payment.update({ where: { id: payment.id }, data: { authority } });
  return redirectUrl;
}

/**
 * Creates the order from the cart: re-validates every product, reserves stock (row locks),
 * snapshots prices and the address, then opens a payment with the gateway.
 */
export async function placeOrder(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  const s = await session();
  if (!s) return fail(LOGIN_REQUIRED);
  const settings = await getCommerceSettings();
  if (!settings.salesEnabled || !getPaymentProvider()) return fail("فروش آنلاین در حال حاضر فعال نیست.");
  const parsed = placeOrderSchema.safeParse(input);
  if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", zodFieldErrors(parsed.error.issues));
  const { ip } = await getRequestInfo();
  if (!(await rateLimit(`order:${s.user.id}`, 10, 60 * 60)).allowed) return fail(RATE_LIMIT_ERROR);

  await expireStaleOrders();

  const shipping = await db.shippingMethod.findFirst({ where: { id: parsed.data.shippingMethodId, isActive: true } });
  if (!shipping) return fail("روش ارسال را انتخاب کنید.", { shippingMethodId: "روش ارسال معتبر نیست." });
  const address = await db.address.findFirst({ where: { id: parsed.data.addressId, userId: s.user.id } });
  if (!address) return fail("آدرس تحویل را انتخاب کنید.", { addressId: "آدرس معتبر نیست." });
  const cartId = await findCartId(s.user.id);
  const cartItems = cartId ? await db.cartItem.findMany({ where: { cartId }, select: { productId: true, quantity: true } }) : [];
  if (cartItems.length === 0) return fail("سبد خرید شما خالی است.");

  let orderId: string;
  try {
    orderId = await db.$transaction(async (tx) => {
      // Lock the product rows so concurrent orders can't oversell.
      const ids = cartItems.map((i) => i.productId);
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM products WHERE id = ANY(${ids}) FOR UPDATE`;
      if (locked.length !== ids.length) throw new OrderError("محصولی از سبد شما دیگر در دسترس نیست.");
      const products = await tx.product.findMany({
        where: { id: { in: ids } },
        select: { id: true, title: true, sku: true, price: true, stock: true, status: true, category: { select: { priceOnRequest: true, parent: { select: { priceOnRequest: true } } } } },
      });

      let subtotal = BigInt(0);
      const lines = cartItems.map((ci) => {
        const p = products.find((x) => x.id === ci.productId)!;
        if (p.status !== "ACTIVE") throw new OrderError(`«${p.title}» دیگر در دسترس نیست.`);
        if (p.category && (p.category.priceOnRequest || p.category.parent?.priceOnRequest)) throw new OrderError(`«${p.title}» فقط با استعلام تلفنی فروخته می‌شود.`);
        if (p.stock < ci.quantity) throw new OrderError(`موجودی «${p.title}» کافی نیست.`);
        const lineTotal = p.price * BigInt(ci.quantity);
        subtotal += lineTotal;
        return { p, quantity: ci.quantity, lineTotal };
      });
      // پس‌کرایه: the carrier collects shipping on delivery, so nothing is charged online for it.
      const shippingCost = shipping.type === "PREPAID" ? shipping.price : BigInt(0);
      const number = await generateOrderNumber(tx);

      const order = await tx.order.create({
        data: {
          number,
          userId: s.user.id,
          status: "AWAITING_PAYMENT",
          subtotal,
          shippingCost,
          total: subtotal + shippingCost,
          recipientName: address.recipientName,
          phone: address.phone,
          province: address.province,
          city: address.city,
          postalCode: address.postalCode,
          addressLine: address.line,
          customerNote: parsed.data.note || null,
          shippingMethodId: shipping.id,
          shippingMethodName: shipping.name,
          shippingType: shipping.type,
          paymentDeadline: new Date(Date.now() + PAYMENT_WINDOW_MINUTES * 60 * 1000),
          items: {
            create: lines.map((l) => ({ productId: l.p.id, titleSnapshot: l.p.title, skuSnapshot: l.p.sku, unitPrice: l.p.price, quantity: l.quantity, lineTotal: l.lineTotal })),
          },
          statusHistory: { create: { to: "AWAITING_PAYMENT", actorId: s.user.id, note: "ثبت سفارش" } },
        },
        select: { id: true },
      });
      for (const l of lines) {
        await tx.product.update({ where: { id: l.p.id }, data: { stock: { decrement: l.quantity } } });
        await tx.inventoryMovement.create({ data: { productId: l.p.id, delta: -l.quantity, reason: "ORDER", orderId: order.id, actorId: s.user.id } });
      }
      await tx.cartItem.deleteMany({ where: { cartId: cartId! } });
      return order.id;
    });
  } catch (e) {
    if (e instanceof OrderError) return fail(e.message);
    console.error("[orders] placeOrder failed", e);
    return fail(GENERIC_ERROR);
  }

  await audit({ actorId: s.user.id, action: "orders.placed", entity: "order", entityId: orderId, ip });
  updateTag(CACHE_TAGS.products); // stock changed
  try {
    return ok({ redirectTo: await startPayment(orderId, s.user.phone) });
  } catch (e) {
    console.error("[orders] payment start failed", e);
    await db.$transaction((tx) => cancelOrderTx(tx, orderId, null, "خطا در اتصال به درگاه پرداخت"));
    return fail("اتصال به درگاه پرداخت ناموفق بود. سفارش لغو شد؛ لطفاً دوباره تلاش کنید.");
  }
}

/** Opens a new payment for an unpaid order that is still inside its payment window. */
export async function retryPayment(orderNumber: string): Promise<ActionResult<{ redirectTo: string }>> {
  const s = await session();
  if (!s) return fail(LOGIN_REQUIRED);
  await expireStaleOrders();
  const order = await db.order.findFirst({ where: { number: String(orderNumber), userId: s.user.id }, select: { id: true, status: true } });
  if (!order) return fail("سفارش پیدا نشد.");
  if (order.status !== "AWAITING_PAYMENT") return fail("این سفارش قابل پرداخت نیست.");
  if (!getPaymentProvider()) return fail("درگاه پرداخت در دسترس نیست.");
  try {
    return ok({ redirectTo: await startPayment(order.id, s.user.phone) });
  } catch (e) {
    console.error("[orders] retry payment failed", e);
    return fail("اتصال به درگاه پرداخت ناموفق بود.");
  }
}

export async function cancelMyOrder(orderNumber: string): Promise<ActionResult<undefined>> {
  const s = await session();
  if (!s) return fail(LOGIN_REQUIRED);
  const order = await db.order.findFirst({ where: { number: String(orderNumber), userId: s.user.id }, select: { id: true, status: true } });
  if (!order || order.status !== "AWAITING_PAYMENT") return fail("فقط سفارش‌های پرداخت‌نشده را می‌توانید لغو کنید.");
  await db.$transaction((tx) => cancelOrderTx(tx, order.id, s.user.id, "لغو توسط مشتری"));
  updateTag(CACHE_TAGS.products);
  revalidatePath(`/account/orders/${orderNumber}`);
  return ok(undefined, "سفارش لغو شد.");
}
