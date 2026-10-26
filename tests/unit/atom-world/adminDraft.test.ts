import { describe, expect, it } from "vitest";
import { addableKinds, addItem, editableItems, nextStationNumber, patchItem, removeAdded, resetItem } from "../../../src/atom-world/admin/draft";
import { EMPTY_WORLD_CONFIG, parseWorldConfig } from "../../../src/atom-world/world/config";

describe("world editor draft", () => {
  it("the first free station number is 7 (no station 7 in the photos)", () => {
    expect(nextStationNumber(EMPTY_WORLD_CONFIG)).toBe(7);
    const { cfg, id } = addItem(EMPTY_WORLD_CONFIG, "gc-station", "gaming-center", "main", 80, 0, () => 0.5);
    expect(id).toMatch(/^add-gc-station-[a-z0-9]{4}$/);
    expect(cfg.added[0]).toMatchObject({ number: 7, console: "ps4", env: "gaming-center", level: "main", added: true });
    expect(nextStationNumber(cfg)).toBe(14);
    // what the editor builds is what the validator keeps
    expect(parseWorldConfig(cfg).added).toEqual(cfg.added);
    expect(removeAdded(cfg, id).added).toEqual([]);
  });

  it("moving, turning, hiding and resetting a built-in item", () => {
    let cfg = patchItem(EMPTY_WORLD_CONFIG, "air-hockey-1", { x: 1.234, z: -2.0 });
    cfg = patchItem(cfg, "air-hockey-1", { rotY: Math.PI * 3 });
    expect(cfg.items["air-hockey-1"]).toEqual({ x: 1.23, z: -2, rotY: expect.closeTo(Math.PI, 2) });
    cfg = patchItem(cfg, "plant-1", { hidden: true });
    const ground = editableItems(cfg, "amusement", "ground");
    expect(ground.find((i) => i.id === "plant-1")?.hidden).toBe(true); // still shown in the editor
    expect(ground.find((i) => i.id === "air-hockey-1")).toMatchObject({ x: 1.23, z: -2 });
    cfg = patchItem(cfg, "plant-1", { hidden: false });
    expect(cfg.items["plant-1"]).toEqual({});
    expect(resetItem(cfg, "air-hockey-1").items["air-hockey-1"]).toBeUndefined();
    expect(parseWorldConfig(cfg).items["air-hockey-1"]).toBeDefined();
  });

  it("offers only kinds that belong on a floor", () => {
    expect(addableKinds("gaming-center", "main")).toEqual(expect.arrayContaining(["gc-station", "gc-sofa", "gc-armchair", "plant"]));
    expect(addableKinds("gaming-center", "main")).not.toContain("air-hockey");
    expect(addableKinds("amusement", "upper")).toContain("air-hockey");
    expect(addableKinds("construction-zone", "main")).toEqual([]);
  });

  it("new items are placed inside the building area even from a far view", () => {
    const { cfg } = addItem(EMPTY_WORLD_CONFIG, "plant", "amusement", "ground", 999, -999);
    expect(cfg.added[0].x).toBeLessThanOrEqual(16);
    expect(cfg.added[0].z).toBeGreaterThanOrEqual(-16);
  });
});
