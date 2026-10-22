import "server-only";
import { db } from "@/lib/db";

export interface ShippingOption {
  id: string;
  name: string;
  description: string | null;
  type: "PREPAID" | "COLLECT";
  price: string; // Rial
}

export async function getActiveShippingMethods(): Promise<ShippingOption[]> {
  const rows = await db.shippingMethod.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, description: true, type: true, price: true },
  });
  return rows.map((r) => ({ ...r, price: r.type === "PREPAID" ? r.price.toString() : "0" }));
}
