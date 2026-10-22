import "server-only";
import { db } from "@/lib/db";

/** Categories ordered as a tree (parent, then its children) for select inputs. */
export async function getCategoryOptions(): Promise<{ id: string; name: string; depth: number }[]> {
  const rows = await db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, parentId: true } });
  const roots = rows.filter((r) => !r.parentId);
  const out = roots.flatMap((r) => [{ id: r.id, name: r.name, depth: 0 }, ...rows.filter((c) => c.parentId === r.id).map((c) => ({ id: c.id, name: c.name, depth: 1 }))]);
  for (const r of rows) if (!out.some((o) => o.id === r.id)) out.push({ id: r.id, name: r.name, depth: 1 });
  return out;
}
