import { describe, expect, it } from "vitest";
import { buildCity, CAR, type CityInput, type CityState, createCity, nearestCar, onRoad, SIZE, stepCity } from "../../../src/atom-world/minigames/city/engine";

const idle: CityInput = { x: 0, y: 0, handbrake: false, action: false };
const run = (s: CityState, sec: number, input: Partial<CityInput> = {}) => {
  for (let t = 0; t < sec; t += 1 / 30) stepCity(s, 1 / 30, { ...idle, ...input });
};
const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const insideBuilding = (s: CityState, x: number, y: number) => s.buildings.some((b) => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1);

describe("ATOM city", () => {
  it("roads, blocks, a park or two and the ATOM club; the same city every time", () => {
    const a = buildCity();
    const b = buildCity();
    expect(a.buildings).toEqual(b.buildings);
    expect(a.buildings.filter((x) => x.club)).toHaveLength(1);
    expect(a.trees.length).toBeGreaterThan(0);
    for (const bd of a.buildings) expect(onRoad((bd.x0 + bd.x1) / 2, (bd.y0 + bd.y1) / 2)).toBe(false);
    expect(onRoad(2, 50)).toBe(true);
  });

  it("starts on foot beside the club, next to the green ATOM taxi, with a taxi job", () => {
    const s = createCity("normal", seeded(7));
    expect(s.player.car).toBeNull();
    expect(insideBuilding(s, s.player.x, s.player.y)).toBe(false);
    expect(nearestCar(s)?.kind).toBe("player-taxi");
    expect(s.mission?.stage).toBe("pickup");
  });

  it("walls stop people on foot", () => {
    const s = createCity("normal", seeded(7));
    run(s, 3, { x: 1 }); // east, into the club building
    expect(insideBuilding(s, s.player.x, s.player.y)).toBe(false);
  });

  it("get in, drive, crash (damage), get out", () => {
    const s = createCity("normal", seeded(7));
    stepCity(s, 1 / 30, { ...idle, action: true });
    expect(s.player.car).not.toBeNull();
    const car = s.cars.find((c) => c.id === s.player.car)!;
    const y0 = car.y;
    run(s, 1.5, { y: 1 }); // north
    expect(car.y).toBeLessThan(y0 - 3);
    expect(car.speed).toBeGreaterThan(5);
    // drive east into the club's wall (west face at x ≈ 66.6, from y ≈ 66.6 to 78.4)
    Object.assign(car, { x: 58, y: 72, angle: 0, speed: 0 });
    run(s, 1.6, { y: 1 });
    expect(insideBuilding(s, car.x, car.y)).toBe(false);
    expect(car.health).toBeLessThan(100);
    expect(s.crashes).toBeGreaterThan(0);
    run(s, 2, { y: 0, handbrake: true });
    stepCity(s, 1 / 30, { ...idle, action: true });
    expect(s.player.car).toBeNull();
    expect(Math.hypot(s.player.x - car.x, s.player.y - car.y)).toBeLessThan(CAR.r + 1.5);
  });

  it("a taxi job: pick the passenger up, drop them off, get paid", () => {
    const s = createCity("normal", seeded(7));
    stepCity(s, 1 / 30, { ...idle, action: true });
    const car = s.cars.find((c) => c.id === s.player.car)!;
    const m = s.mission!;
    Object.assign(car, { x: m.pickup.x, y: m.pickup.y, speed: 0 });
    stepCity(s, 1 / 30, idle);
    expect(s.mission!.stage).toBe("dropoff");
    Object.assign(car, { x: s.mission!.dest.x, y: s.mission!.dest.y, speed: 0 });
    stepCity(s, 1 / 30, idle);
    expect(s.deliveries).toBe(1);
    expect(s.money).toBeGreaterThanOrEqual(40);
    expect(s.mission!.stage).toBe("pickup");
  });

  it("coins pay 5 and move elsewhere", () => {
    const s = createCity("normal", seeded(7));
    const c = s.coins[0];
    Object.assign(s.player, { x: c.x, y: c.y });
    stepCity(s, 1 / 30, idle);
    expect(s.coinsTaken).toBe(1);
    expect(s.money).toBe(5);
  });

  it("traffic keeps driving on the roads and stays in the city", () => {
    const s = createCity("hard", seeded(3));
    const traffic = s.cars.filter((c) => c.kind === "traffic");
    const start = traffic.map((c) => [c.x, c.y]);
    run(s, 20);
    let moved = 0;
    traffic.forEach((c, i) => {
      if (Math.hypot(c.x - start[i][0], c.y - start[i][1]) > 5) moved++;
      expect(c.x).toBeGreaterThanOrEqual(-0.01);
      expect(c.x).toBeLessThanOrEqual(SIZE + 0.01);
      expect(onRoad(c.x, c.y)).toBe(true);
    });
    expect(moved).toBeGreaterThan(traffic.length / 2);
    for (const p of s.peds) expect(insideBuilding(s, p.x, p.y)).toBe(false);
  });

  it("ends when the time is up", () => {
    const s = createCity("hard", seeded(3));
    run(s, 151);
    expect(s.over).toBe(true);
  });
});
