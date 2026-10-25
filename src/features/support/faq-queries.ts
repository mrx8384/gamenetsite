import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type { FaqItem } from "./faq-match";

/** Active FAQs for the chat widget (small list, matched in the browser). */
export async function getActiveFaqs(): Promise<FaqItem[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.faq);
  return db.supportFaq.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, question: true, answer: true, keywords: true },
    take: 300,
  });
}

/** All FAQs with stats for the admin page. */
export function getAllFaqs() {
  return db.supportFaq.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
}
