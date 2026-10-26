import { describe, expect, it } from "vitest";
import { machines } from "../../../src/atom-world/data/machines";
import { mergeMachines, parseMachineOverrides, safePhotoSrc } from "../../../src/atom-world/data/remoteMachines";

describe("machine info from the admin panel", () => {
  it("applies known fields of known machines only", () => {
    const o = parseMachineOverrides({
      version: 1,
      machines: {
        "air-hockey": { price: "هر دست ۵۰ هزار تومان", description: "متن جدید", name: "ایرهاکی", evil: "x" },
        "unknown-machine": { price: "1" },
      },
    });
    expect(Object.keys(o)).toEqual(["air-hockey"]);
    expect(o["air-hockey"]).toEqual({ price: "هر دست ۵۰ هزار تومان", description: "متن جدید", name: "ایرهاکی" });
    const merged = mergeMachines(machines, o);
    expect(merged["air-hockey"].price).toBe("هر دست ۵۰ هزار تومان");
    expect(merged["air-hockey"].miniGame).toBe("air-hockey");
    expect(merged["foot-pool"]).toEqual(machines["foot-pool"]);
  });

  it("an empty tariff means not registered (never invented)", () => {
    const o = parseMachineOverrides({ version: 1, machines: { "foot-pool": { price: "   " } } });
    expect(o["foot-pool"].price).toBeNull();
  });

  it("rejects wrong versions and junk", () => {
    expect(parseMachineOverrides(null)).toEqual({});
    expect(parseMachineOverrides({ version: 2, machines: {} })).toEqual({});
    expect(parseMachineOverrides({ version: 1, machines: { "air-hockey": "x" } })).toEqual({});
  });

  it("only allows same-site or https photos", () => {
    expect(safePhotoSrc("/media/a.webp")).toBe("/media/a.webp");
    expect(safePhotoSrc("https://example.ir/a.webp")).toBe("https://example.ir/a.webp");
    expect(safePhotoSrc("//evil.com/a.webp")).toBeNull();
    expect(safePhotoSrc("javascript:alert(1)")).toBeNull();
    expect(safePhotoSrc("data:image/png;base64,AA")).toBeNull();
    expect(safePhotoSrc("http://x.ir/a.webp")).toBeNull();
    const o = parseMachineOverrides({ version: 1, machines: { "air-hockey": { photos: [{ src: "javascript:1" }, { src: "/media/b.webp", alt: "میز" }] } } });
    expect(o["air-hockey"].photos).toEqual([{ src: "/media/b.webp", alt: "میز" }]);
  });

  it("limits text length", () => {
    const o = parseMachineOverrides({ version: 1, machines: { "air-hockey": { description: "ا".repeat(5000) } } });
    expect(o["air-hockey"].description!.length).toBe(1500);
  });
});
