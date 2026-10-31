import { z } from "zod";

export const attractionSchema = z.object({
  title: z.string().trim().min(2, "عنوان حداقل ۲ کاراکتر").max(120, "حداکثر ۱۲۰ کاراکتر"),
  description: z.string().trim().min(10, "توضیح حداقل ۱۰ کاراکتر").max(2000, "حداکثر ۲۰۰۰ کاراکتر"),
  /** Uploaded image id, or "" for none. */
  imageId: z.string().trim().max(40).optional().transform((v) => v || null),
  /** false → also drop the built-in photo (owner removed the image). */
  keepStaticImage: z.boolean(),
  isActive: z.boolean(),
});

/** Built-in photos may only come from the 3D world's public folder. */
export function staticImageUrl(path: string | null): string | null {
  return path && /^\/atom-world\/[\w/.-]+\.(?:webp|jpe?g|png)$/.test(path) && !path.includes("..") ? path : null;
}
