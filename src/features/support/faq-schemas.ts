import { z } from "zod";
import { normalizePersian } from "@/lib/text";

export const faqSchema = z.object({
  question: z.string().trim().min(5, "سؤال حداقل ۵ حرف است.").max(200, "سؤال حداکثر ۲۰۰ حرف است.").transform(normalizePersian),
  answer: z.string().trim().min(5, "جواب حداقل ۵ حرف است.").max(2000, "جواب حداکثر ۲۰۰۰ حرف است.").transform(normalizePersian),
  keywords: z.string().trim().max(300, "کلمات کلیدی حداکثر ۳۰۰ حرف است.").default("").transform(normalizePersian),
  isActive: z.boolean().default(true),
});
export type FaqInput = z.input<typeof faqSchema>;
