import { describe, expect, it } from "vitest";
import { attractionSchema, staticImageUrl } from "@/features/park/schemas";

describe("park attractions", () => {
  it("only serves built-in photos from the 3D world folder", () => {
    expect(staticImageUrl("/atom-world/photos/hall-overview.webp")).toBe("/atom-world/photos/hall-overview.webp");
    expect(staticImageUrl("/atom-world/../.env")).toBeNull();
    expect(staticImageUrl("https://evil.example/x.webp")).toBeNull();
    expect(staticImageUrl("/media/x.svg")).toBeNull();
    expect(staticImageUrl(null)).toBeNull();
  });

  it("validates title and description", () => {
    const base = { title: "ایرهاکی", description: "توضیح کافی برای این بخش.", imageId: "", keepStaticImage: true, isActive: true };
    expect(attractionSchema.parse(base).imageId).toBeNull();
    expect(attractionSchema.safeParse({ ...base, title: "ا" }).success).toBe(false);
    expect(attractionSchema.safeParse({ ...base, description: "کوتاه" }).success).toBe(false);
  });
});
