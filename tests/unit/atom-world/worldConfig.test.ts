import { afterEach, describe, expect, it } from "vitest";
import { getMachine } from "../../../src/atom-world/data/machines";
import { parseWorldConfig, safeArtSrc, textSlots } from "../../../src/atom-world/world/config";
import { applyWorldConfig } from "../../../src/atom-world/world/applyConfig";
import { itemColliders, itemInteractable, resolveItems, toWorldXZ, type WorldItem, worldRect } from "../../../src/atom-world/world/items";
import { areaLabel, buildWorldColliders, setItemChanges, worldInteractables, worldItems } from "../../../src/atom-world/world/registry";
import { resolveArt, setSlotOverrides, slotText } from "../../../src/atom-world/world/slots";
import { EMPTY_WORLD_CONFIG } from "../../../src/atom-world/world/config";

afterEach(() => applyWorldConfig(EMPTY_WORLD_CONFIG));

const table = (over: Partial<WorldItem> = {}): WorldItem => ({ id: "t", kind: "air-hockey", env: "amusement", level: "ground", x: 0, z: 0, rotY: 0, ...over });

describe("items", () => {
  it("turning an item turns its footprint and interaction point", () => {
    const t = table({ rotY: Math.PI / 2 });
    const r = worldRect(t, { x0: -1.15, x1: 1.15, z0: -0.625, z1: 0.625, h: 0.8 });
    expect(r.xMax - r.xMin).toBeCloseTo(1.25, 5);
    expect(r.zMax - r.zMin).toBeCloseTo(2.3, 5);
    const [x, z] = toWorldXZ({ x: 0, z: 0, rotY: Math.PI / 2 }, 0, 1);
    expect(x).toBeCloseTo(1, 5);
    expect(z).toBeCloseTo(0, 5);
    expect(itemColliders(t, 0)[0].tag).toBe("machine");
    expect(itemInteractable(t, 0)?.machineId).toBe("air-hockey");
    expect(itemColliders({ ...t, kind: "events-board" }, 0)).toEqual([]); // a hologram: walk through
  });

  it("move / hide built-in items and add new ones", () => {
    const defaults = [table({ id: "a" }), table({ id: "b", x: 3 })];
    const out = resolveItems(defaults, { items: { a: { x: 1, z: 2 }, b: { hidden: true } }, added: [table({ id: "add-x", x: 5 })] });
    expect(out.map((i) => [i.id, i.x, i.z])).toEqual([
      ["a", 1, 2],
      ["add-x", 5, 0],
    ]);
    expect(out[1].added).toBe(true);
  });

  it("the manager's changes reach collisions, interactions and the item list of the world", () => {
    const before = worldInteractables().find((i) => i.id === "air-hockey-1")!;
    setItemChanges({
      items: { "air-hockey-1": { x: 2.5, z: -6, rotY: Math.PI / 2 }, "plant-1": { hidden: true } },
      added: [{ id: "add-station-7", kind: "gc-station", env: "gaming-center", level: "main", x: 76, z: 4, rotY: Math.PI / 2, number: 7, console: "ps4" }],
    });
    const moved = worldInteractables().find((i) => i.id === "air-hockey-1")!;
    expect([moved.position[0], moved.position[2]]).toEqual([2.5, -6]);
    expect(moved.position).not.toEqual(before.position);
    expect(worldItems().some((i) => i.id === "plant-1")).toBe(false);
    const s7 = worldInteractables().find((i) => i.id === "add-station-7")!;
    expect(s7.machineId).toBe("gc-ps4");
    expect(s7.position[0]).toBeCloseTo(77, 5); // one metre in front of the screen
    const c = buildWorldColliders().filter((b) => b.tag === "machine" && b.min[0] <= 2.5 && b.max[0] >= 2.5 && b.min[2] <= -6 && b.max[2] >= -6);
    expect(c.length).toBeGreaterThan(0);
  });
});

describe("parseWorldConfig", () => {
  it("keeps valid changes and drops unknown, unsafe or out-of-building ones", () => {
    const cfg = parseWorldConfig({
      version: 1,
      items: {
        "air-hockey-2": { x: 1.234, z: 2, rotY: 7, hidden: false },
        "air-hockey-3": { x: 500, z: 0 }, // outside the hall: position ignored
        "no-such-item": { x: 0, z: 0 },
        "gc-station-1": { number: 300, console: "xbox" },
        "gc-station-2": { number: 14, console: "ps5" },
      },
      added: [
        { id: "add-a", kind: "gc-station", env: "gaming-center", level: "main", x: 76, z: 4, rotY: 0, number: 7 },
        { id: "add-b", kind: "air-hockey", env: "gaming-center", level: "main", x: 76, z: 4 }, // not allowed there
        { id: "add-c", kind: "plant", env: "amusement", level: "ground", x: 999, z: 0 }, // outside
        { id: "BAD id", kind: "plant", env: "amusement", level: "ground", x: 0, z: 0 },
        { id: "air-hockey-1", kind: "plant", env: "amusement", level: "ground", x: 0, z: 0 }, // clashes with a built-in id
        { id: "add-a", kind: "plant", env: "amusement", level: "ground", x: 0, z: 0 }, // duplicate
        { id: "add-d", kind: "gc-sofa", env: "gaming-center", level: "main", x: 78, z: 0, length: 12 },
      ],
      art: { "gc-castle": "/api/atom-world/media/" + "a".repeat(64) + ".webp", "gc-london": "javascript:alert(1)", "hall-batman-joker": "//evil.example/x.png", "nope": "/atom-world/x.webp" },
      texts: { "building-sign": "  اتم\u0000 گیم  ", "area:gc-hall": "گیم‌نت اتم", "unknown": "x", "gc-welcome": "W".repeat(100) },
      machines: { "gc-ps4": { price: "۵۰ هزار تومان", name: "پلی ۴" }, "no-such": { name: "x" } },
    });
    expect(cfg.items["air-hockey-2"]).toEqual({ x: 1.23, z: 2, rotY: expect.closeTo(7 - 2 * Math.PI, 2) });
    expect(cfg.items["air-hockey-3"]).toBeUndefined();
    expect(cfg.items["no-such-item"]).toBeUndefined();
    expect(cfg.items["gc-station-1"]).toBeUndefined();
    expect(cfg.items["gc-station-2"]).toEqual({ number: 14, console: "ps5" });
    expect(cfg.added.map((a) => a.id)).toEqual(["add-a", "add-d"]);
    expect(cfg.added[0]).toMatchObject({ console: "ps4", number: 7, added: true });
    expect(cfg.added[1].length).toBe(4);
    expect(Object.keys(cfg.art)).toEqual(["gc-castle"]);
    expect(cfg.texts["building-sign"]).toBe("اتم  گیم");
    expect(cfg.texts["area:gc-hall"]).toBe("گیم‌نت اتم");
    expect(cfg.texts.unknown).toBeUndefined();
    expect(cfg.texts["gc-welcome"].length).toBe(20);
    expect(cfg.machines).toEqual({ "gc-ps4": { price: "۵۰ هزار تومان", name: "پلی ۴" } });
  });

  it("rejects other versions and junk without throwing", () => {
    for (const j of [null, 1, "x", [], { version: 2, items: { "air-hockey-1": { hidden: true } } }]) expect(parseWorldConfig(j).items).toEqual({});
  });

  it("data: images only in the stand-alone preview (local mode)", () => {
    const d = "data:image/webp;base64,AAAA";
    expect(safeArtSrc(d)).toBeNull();
    expect(safeArtSrc(d, { allowDataUrls: true })).toBe(d);
    expect(safeArtSrc("data:text/html;base64,AAAA", { allowDataUrls: true })).toBeNull();
    expect(safeArtSrc("/atom-world/../secret.webp")).toBeNull();
  });

  it("place names of every environment are editable texts", () => {
    const ids = textSlots().map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(["area:ground", "area:upper", "area:gc-hall", "menu:gaming-center", "gc-chalkboard-title"]));
  });
});

describe("applying a config", () => {
  it("art, texts, machines and places are used by the world", () => {
    const media = "/api/atom-world/media/" + "b".repeat(64) + ".png";
    applyWorldConfig(
      parseWorldConfig({
        version: 1,
        art: { "gc-castle": media },
        texts: { "gc-chalkboard-title": "جام اتم", "area:gc-hall": "سالن گیم" },
        machines: { "air-hockey": { name: "ایرهاکی حرفه‌ای", emoji: "🥅" } },
        items: { "events-board": { hidden: true } },
      }),
    );
    expect(resolveArt("/atom-world/envs/gaming-center/mural-castle.webp")).toBe(media);
    expect(resolveArt("/atom-world/envs/gaming-center/mural-paris.webp")).toBe("/atom-world/envs/gaming-center/mural-paris.webp");
    expect(slotText("gc-chalkboard-title")).toBe("جام اتم");
    expect(areaLabel("gc-hall")).toBe("سالن گیم");
    expect(getMachine("air-hockey")).toMatchObject({ name: "ایرهاکی حرفه‌ای", emoji: "🥅" });
    expect(worldInteractables().some((i) => i.id === "events-board")).toBe(false);
    applyWorldConfig(EMPTY_WORLD_CONFIG);
    setSlotOverrides({}, {});
    expect(getMachine("air-hockey")?.name).toBe("ایرهاکی");
    expect(slotText("gc-chalkboard-title")).toBe("برگزاری تورنومنت");
  });
});
