import "server-only";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { findCartId } from "./service";

export type CartLineIssue = "unavailable" | "price_on_request" | "out_of_stock" | "insufficient_stock" | null;

export interface CartLine {
  id: string;
  productId: string;
  title: string;
  slug: string;
  imageKey: string | null;
  unitPrice: string; // Rial
  quantity: number;
  stock: number;
  lineTotal: string;
  issue: CartLineIssue;
}

export interface CartView {
  lines: CartLine[];
  itemCount: number;
  subtotal: string;
  /** True when every line can be ordered. */
  orderable: boolean;
}

/** Current cart with live prices and availability (never trust stored prices). */
export async function getCartView(userId: string | null): Promise<CartView> {
  await connection(); // request-time only (cookies, expiry checks)
  const cartId = await findCartId(userId);
  const items = cartId
    ? await db.cartItem.findMany({
        where: { cartId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          quantity: true,
          product: {
            select: {
              id: true, title: true, slug: true, price: true, stock: true, status: true,
              category: { select: { priceOnRequest: true, parent: { select: { priceOnRequest: true } } } },
              images: { orderBy: { sortOrder: "asc" }, take: 1, select: { media: { select: { storageKey: true } } } },
            },
          },
        },
      })
    : [];

  let subtotal = BigInt(0);
  const lines: CartLine[] = items.map(({ id, quantity, product: p }) => {
    const priceOnRequest = !!p.category && (p.category.priceOnRequest || !!p.category.parent?.priceOnRequest);
    const issue: CartLineIssue =
      p.status !== "ACTIVE" ? "unavailable" : priceOnRequest ? "price_on_request" : p.stock <= 0 ? "out_of_stock" : quantity > p.stock ? "insufficient_stock" : null;
    const lineTotal = p.price * BigInt(quantity);
    if (!issue) subtotal += lineTotal;
    return {
      id, productId: p.id, title: p.title, slug: p.slug, imageKey: p.images[0]?.media.storageKey ?? null,
      unitPrice: p.price.toString(), quantity, stock: p.stock, lineTotal: lineTotal.toString(), issue,
    };
  });
  const orderable = lines.length > 0 && lines.every((l) => !l.issue);
  return { lines, itemCount: lines.reduce((n, l) => n + l.quantity, 0), subtotal: subtotal.toString(), orderable };
}

export async function getCartCount(userId: string | null): Promise<number> {
  await connection();
  const cartId = await findCartId(userId);
  if (!cartId) return 0;
  const agg = await db.cartItem.aggregate({ where: { cartId }, _sum: { quantity: true } });
  return agg._sum.quantity ?? 0;
}
