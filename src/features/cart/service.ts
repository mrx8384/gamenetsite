import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { generateToken, sha256Hex } from "@/lib/auth/crypto";

const secure = env.APP_URL.startsWith("https://");
export const CART_COOKIE = secure ? "__Host-atom_cart" : "atom_cart";
const GUEST_CART_DAYS = 30;
export const MAX_QTY_PER_ITEM = 10;

/** Finds the current cart id (user cart when logged in, otherwise guest cart from the cookie). Read-only. */
export async function findCartId(userId: string | null): Promise<string | null> {
  if (userId) {
    const cart = await db.cart.findUnique({ where: { userId }, select: { id: true } });
    return cart?.id ?? null;
  }
  const token = (await cookies()).get(CART_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const cart = await db.cart.findUnique({ where: { guestTokenHash: sha256Hex(token) }, select: { id: true, expiresAt: true } });
  if (!cart || (cart.expiresAt && cart.expiresAt < new Date())) return null;
  return cart.id;
}

/** Returns the cart id, creating the cart (and guest cookie) if needed. Server Actions only. */
export async function getOrCreateCartId(userId: string | null): Promise<string> {
  const existing = await findCartId(userId);
  if (existing) return existing;
  if (userId) {
    const cart = await db.cart.upsert({ where: { userId }, create: { userId }, update: {}, select: { id: true } });
    return cart.id;
  }
  const token = generateToken();
  const expiresAt = new Date(Date.now() + GUEST_CART_DAYS * 24 * 3600 * 1000);
  const cart = await db.cart.create({ data: { guestTokenHash: sha256Hex(token), expiresAt }, select: { id: true } });
  (await cookies()).set(CART_COOKIE, token, { httpOnly: true, secure, sameSite: "lax", path: "/", expires: expiresAt });
  return cart.id;
}

/** After login: moves guest cart items into the user's cart (quantities are added, capped). */
export async function mergeGuestCartIntoUser(userId: string): Promise<void> {
  const store = await cookies();
  const token = store.get(CART_COOKIE)?.value;
  if (!token) return;
  const guest = await db.cart.findUnique({ where: { guestTokenHash: sha256Hex(token) }, select: { id: true, items: true } });
  store.delete(CART_COOKIE);
  if (!guest) return;
  if (guest.items.length > 0) {
    const userCart = await db.cart.upsert({ where: { userId }, create: { userId }, update: {}, select: { id: true } });
    for (const item of guest.items) {
      const existing = await db.cartItem.findUnique({ where: { cartId_productId: { cartId: userCart.id, productId: item.productId } } });
      const quantity = Math.min(MAX_QTY_PER_ITEM, (existing?.quantity ?? 0) + item.quantity);
      await db.cartItem.upsert({
        where: { cartId_productId: { cartId: userCart.id, productId: item.productId } },
        create: { cartId: userCart.id, productId: item.productId, quantity },
        update: { quantity },
      });
    }
  }
  await db.cart.delete({ where: { id: guest.id } });
}
