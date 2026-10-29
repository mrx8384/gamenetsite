import { describe, expect, it } from "vitest";
import { box } from "../../../src/atom-world/data/environment";
import { getMachine } from "../../../src/atom-world/data/machines";
import { createRuntime, travelTo } from "../../../src/atom-world/systems/runtime";
import { STREET_SPAWN, STREET_Y } from "../../../src/atom-world/data/exterior";
import {
  allPortals,
  areaAt,
  areaLabel,
  buildWorldColliders,
  ENVIRONMENTS,
  envAt,
  envById,
  portalMachineId,
  preloadDistanceTo,
  resolveSpawn,
  START_ENV,
  validateEnvironments,
  walkThroughPortalAt,
  worldInteractables,
} from "../../../src/atom-world/world/registry";
import type { EnvironmentDef } from "../../../src/atom-world/world/types";

describe("environment registry", () => {
  it("the real environments pass every consistency check", () => {
    expect(validateEnvironments(ENVIRONMENTS)).toEqual([]);
    expect(START_ENV).toBe("amusement");
    expect(ENVIRONMENTS.map((e) => e.id)).toEqual(["amusement", "construction-zone", "gaming-center"]);
  });

  it("the gaming center is reached by its real path: street door → stairs down, and back", () => {
    const door = allPortals().find((p) => p.id === "gc-street-door")!;
    expect(door.kind).toBe("stairs");
    expect(door.to).toEqual({ env: "gaming-center", spawn: "from-street" });
    expect(envAt(door.at[0], door.at[2]).id).toBe("amusement");
    expect(areaAt(door.at[0], STREET_Y, door.at[2])).toBe("street");
    const exit = allPortals().find((p) => p.id === "gc-street-exit")!;
    expect(exit.to).toEqual({ env: "amusement", spawn: "gaming-door" });
    // arriving is outside the doorway you came through (no instant bounce back)
    const top = resolveSpawn(door.to)!;
    expect(Math.hypot(top.x - exit.at[0], top.z - exit.at[2])).toBeGreaterThan(exit.radius);
    const back = resolveSpawn(exit.to)!;
    expect(Math.hypot(back.x - door.at[0], back.z - door.at[2])).toBeGreaterThan(door.radius);
    expect(walkThroughPortalAt(door.at[0], STREET_Y, door.at[2])?.id).toBe("gc-street-door");
  });

  it("the gaming center loads on demand, starting as the player walks up to its street door", () => {
    const gc = envById("gaming-center")!;
    expect(gc.load).toBe("on-demand");
    const door = allPortals().find((p) => p.id === "gc-street-door")!;
    expect(preloadDistanceTo(gc, door.at[0], door.at[2] + 2)).toBeLessThan(gc.preloadDistance!);
    expect(preloadDistanceTo(gc, STREET_SPAWN.x, STREET_SPAWN.z)).toBeGreaterThan(gc.preloadDistance!);
  });

  it("gaming center: the 12 stations seen in the photos (1 = PS5; 2–6, 8–13 PS4; 7 not placed), counter and chalkboard, all with machine info", () => {
    const gc = envById("gaming-center")!;
    const stations = worldInteractables().filter((i) => i.id.startsWith("gc-station"));
    expect(stations).toHaveLength(12);
    expect(stations.filter((i) => i.machineId === "gc-ps5").map((i) => i.id)).toEqual(["gc-station-1"]);
    expect(stations.filter((i) => i.machineId === "gc-ps4")).toHaveLength(11);
    expect(stations.some((i) => i.id === "gc-station-7")).toBe(false); // not in any photo: not guessed
    for (const n of [2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13]) expect(stations.some((i) => i.id === `gc-station-${n}`)).toBe(true);
    for (const i of gc.interactables) expect(getMachine(i.machineId)?.price ?? null).toBeNull(); // no invented tariffs
    expect(getMachine("gc-tournament-board")?.opens).toBe("events");
    expect(areaAt(80, 0, 0)).toBe("gc-hall");
    expect(areaAt(84, 0, -2)).toBe("gc-hall"); // no room behind the arch (owner)
    expect(areaAt(77, 0, -9)).toBe("gc-train");
    expect(areaAt(88, 1, 5.6)).toBe("gc-stairs"); // the stairs leave the hall through the east wall, by station 5
    // the stair door is next to station 5 (owner's map, 2026-10-29)
    const s5 = stations.find((i) => i.id === "gc-station-5")!;
    const door = resolveSpawn({ env: "gaming-center" })!;
    expect(Math.hypot(door.x - s5.position[0], door.z - s5.position[2])).toBeLessThan(2.5);
    expect(gc.mapPlan?.shapes.length).toBeGreaterThan(10);
  });

  it("gaming-center stairs climb to the street level step by step", () => {
    const gc = envById("gaming-center")!;
    const steps = gc.colliders().filter((b) => b.tag === "stairs");
    expect(steps).toHaveLength(14);
    const tops = steps.map((b) => b.max[1]);
    for (let i = 1; i < tops.length; i++) expect(tops[i] - tops[i - 1]).toBeLessThanOrEqual(0.2);
    expect(resolveSpawn({ env: "gaming-center", spawn: "from-street" })!.y).toBeCloseTo(tops.at(-1)!, 5);
  });

  it("areas and labels are the same as before the refactor", () => {
    expect(areaAt(0, 0, 18)).toBe("street");
    expect(areaAt(0, 0, 5)).toBe("ground");
    expect(areaAt(-1, 2.9, -8)).toBe("upper");
    expect(areaAt(-2, 0, -16)).toBe("zone"); // the machines room, behind the hall's back wall
    expect(areaLabel("upper")).toBe("طبقهٔ دوم");
    expect(areaLabel("zone")).toContain("ماشین‌آلات");
  });

  it("walkable areas hold every spawn and exclude the space around the buildings", () => {
    for (const e of ENVIRONMENTS) {
      if (!e.walkable) continue;
      for (const [k, sp] of Object.entries(e.spawns)) expect(e.walkable(sp.x, sp.z), `${e.id}/${k}`).toBe(true);
    }
    const hall = ENVIRONMENTS.find((e) => e.id === "amusement")!;
    expect(hall.walkable!(6, 0)).toBe(false); // beside the hall
    expect(hall.walkable!(0, -14)).toBe(false); // behind it
    expect(hall.walkable!(13, 14)).toBe(false); // past the end of the sidewalk
    expect(hall.walkable!(-11, 16)).toBe(true); // sidewalk
    const zone = ENVIRONMENTS.find((e) => e.id === "construction-zone")!;
    expect(zone.walkable!(-2, -21)).toBe(false); // outside the machines room
    // straight through the open doorway in the back wall: hall → wall thickness → room
    expect(hall.walkable!(1.6, -13.2)).toBe(true);
    expect(hall.walkable!(0, -13.2)).toBe(false); // the wall beside the doorway
    expect(envAt(1.6, -13.5).id).toBe("construction-zone");
    expect(zone.walkable!(1.6, -13.5)).toBe(true);
  });

  it("every doorway is an interactable with a travel machine", () => {
    for (const i of worldInteractables()) expect(getMachine(i.machineId), i.id).toBeTruthy();
    // the machines room has no door any more: an open doorway, no travel
    expect(allPortals().some((p) => p.to.env === "construction-zone" || p.id.startsWith("zone-"))).toBe(false);
    expect(walkThroughPortalAt(1.6, 0, -13.2)).toBeNull();
  });

  it("travel moves only the player: same session, spawns from the target environment", () => {
    const rt = createRuntime();
    const input = rt.input;
    expect(travelTo(rt, { env: "construction-zone" })).toBe(true);
    expect(envAt(rt.player.x, rt.player.z).id).toBe("construction-zone");
    expect(travelTo(rt, { env: "amusement", spawn: "counter" })).toBe(true);
    expect([rt.player.x, rt.player.z]).toEqual([1.6, 3.0]);
    expect(rt.input).toBe(input); // the same runtime / character controller keeps running
    expect(travelTo(rt, { env: "nowhere" })).toBe(false);
    // unknown spawn falls back to the default one
    expect(resolveSpawn({ env: "construction-zone", spawn: "x" })).toEqual(resolveSpawn({ env: "construction-zone" }));
  });
});

/** A made-up environment that exists only in this test (never in the game). */
function testEnv(over: Partial<EnvironmentDef> = {}): EnvironmentDef {
  return {
    id: "test-room",
    name: "اتاق آزمایشی",
    bounds: { xMin: 190, xMax: 210, zMin: -10, zMax: 10 },
    colliders: () => [box([195, 0, -5], [205, 3, -4.8], "wall")],
    interactables: [],
    levels: [{ id: "main", y: 0, label: "اتاق" }],
    items: [],
    spawns: { default: { x: 200, y: 0, z: 0, heading: 0 } },
    portals: [{ id: "test-door", kind: "door", at: [200, 1, 4], radius: 1, to: { env: "amusement", spawn: "counter" }, prompt: "🚪 بازگشت", walkThrough: true }],
    areaAt: () => "test-room",
    areaLabels: { "test-room": "اتاق آزمایشی" },
    scene: async () => ({ default: () => null }),
    load: "on-demand",
    ...over,
  };
}

describe("adding an environment needs no change in the core", () => {
  const list = [...ENVIRONMENTS, testEnv()];

  it("a new module plugs in: colliders, areas, doorways, travel targets", () => {
    expect(validateEnvironments(list)).toEqual([]);
    expect(buildWorldColliders(list).length).toBe(buildWorldColliders().length + 1);
    expect(areaAt(200, 0, 0, list)).toBe("test-room");
    expect(areaAt(0, 0, 5, list)).toBe("ground"); // the hall is unchanged
    expect(worldInteractables(list).map((i) => i.id)).toContain("test-door");
    expect(portalMachineId(list.at(-1)!.portals[0])).toBe("portal:test-door");
    expect(resolveSpawn({ env: "test-room" }, list)).toEqual({ x: 200, y: 0, z: 0, heading: 0 });
  });

  it("walk-through doorways are found by position", () => {
    expect(walkThroughPortalAt(200, 0, 4.2, list)?.id).toBe("test-door");
    expect(walkThroughPortalAt(200, 0, 0, list)).toBeNull();
  });

  it("mistakes in a new module are caught", () => {
    const bad = [
      ...ENVIRONMENTS,
      testEnv({
        bounds: { xMin: -10, xMax: 10, zMin: -30, zMax: -15 }, // overlaps the RC club
        spawns: { default: { x: 500, y: 0, z: 0, heading: 0 } },
        portals: [{ id: "d", kind: "door", at: [0, 1, -20], radius: 1, to: { env: "missing" }, prompt: "x" }],
        areaLabels: {},
      }),
    ];
    const errors = validateEnvironments(bad).join("\n");
    expect(errors).toContain("bounds overlap");
    expect(errors).toContain("outside its bounds");
    expect(errors).toContain('unknown environment "missing"');
    expect(errors).toContain("has no label");
  });
});

describe("gaming center layout (owner's answers)", () => {
  it("coming in from the stairs, the counter is on the right", async () => {
    const { COUNTER, SPAWN_HALL } = await import("../../../src/atom-world/environments/gaming-center/layout");
    const s = SPAWN_HALL;
    // facing (sin h, cos h); with y up, the right-hand side is (−f.z, f.x)
    const f = { x: Math.sin(s.heading), z: Math.cos(s.heading) };
    const right = { x: -f.z, z: f.x };
    const c = { x: (COUNTER.xMin + COUNTER.xMax) / 2 - s.x, z: (COUNTER.zMin + COUNTER.zMax) / 2 - s.z };
    expect(c.x * right.x + c.z * right.z).toBeGreaterThan(1);
  });
});
