import type { Box } from "../data/environment";

/**
 * Small, allocation-free collision world for a static interior.
 *
 * The character is a vertical cylinder (radius + height). Boxes whose top is within `stepHeight`
 * of the feet are treated as floor (steps, low platforms); taller boxes block horizontally.
 * This is enough for walls, furniture and real step-by-step stairs, runs well on phones and needs
 * no WASM physics engine. If dynamic objects are ever needed, swap this for Rapier behind the same API.
 */
export interface Body {
  x: number;
  /** Feet height. */
  y: number;
  z: number;
  radius: number;
  height: number;
  stepHeight: number;
}

const EPS = 1e-6;

export class CollisionWorld {
  readonly boxes: Box[];
  private disabledTags = new Set<Box["tag"]>();

  /** Height of the base floor at a point (default: y = 0 everywhere; the street is lower). */
  private baseFloor: (x: number, z: number) => number;

  constructor(boxes: Box[], baseFloor: (x: number, z: number) => number = () => 0) {
    this.boxes = boxes;
    this.baseFloor = baseFloor;
  }

  /** Temporarily switch a whole category off (e.g. the phase-1 stair barrier). */
  setTagEnabled(tag: Box["tag"], enabled: boolean) {
    if (enabled) this.disabledTags.delete(tag);
    else this.disabledTags.add(tag);
  }

  private active(b: Box) {
    return !this.disabledTags.has(b.tag);
  }

  /**
   * Highest walkable surface under the body that can be reached from `feetY`
   * (i.e. no higher than feetY + stepHeight), or the base floor.
   */
  groundHeight(x: number, z: number, footRadius: number, feetY: number, stepHeight: number): number {
    let ground = this.baseFloor(x, z);
    const limit = feetY + stepHeight + EPS;
    for (const b of this.boxes) {
      if (!this.active(b)) continue;
      const top = b.max[1];
      if (top > limit || top <= ground) continue;
      if (x + footRadius < b.min[0] || x - footRadius > b.max[0]) continue;
      if (z + footRadius < b.min[2] || z - footRadius > b.max[2]) continue;
      ground = top;
    }
    return ground;
  }

  /** Pushes the body out of every box that blocks it horizontally. Returns true if anything was hit. */
  resolve(body: Body, iterations = 3): boolean {
    let hit = false;
    const r = body.radius;
    for (let it = 0; it < iterations; it++) {
      let moved = false;
      for (const b of this.boxes) {
        if (!this.active(b)) continue;
        // Vertical overlap with the part of the body above the step height
        if (b.max[1] <= body.y + body.stepHeight + EPS) continue;
        if (b.min[1] >= body.y + body.height) continue;

        const cx = clamp(body.x, b.min[0], b.max[0]);
        const cz = clamp(body.z, b.min[2], b.max[2]);
        let dx = body.x - cx;
        let dz = body.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;

        if (d2 > EPS) {
          const d = Math.sqrt(d2);
          const push = r - d;
          dx /= d;
          dz /= d;
          body.x += dx * push;
          body.z += dz * push;
        } else {
          // Centre inside the box: leave through the nearest face.
          const left = body.x - b.min[0];
          const right = b.max[0] - body.x;
          const back = body.z - b.min[2];
          const front = b.max[2] - body.z;
          const m = Math.min(left, right, back, front);
          if (m === left) body.x = b.min[0] - r;
          else if (m === right) body.x = b.max[0] + r;
          else if (m === back) body.z = b.min[2] - r;
          else body.z = b.max[2] + r;
        }
        moved = true;
        hit = true;
      }
      if (!moved) break;
    }
    return hit;
  }

  /**
   * Distance along a normalised ray to the first box hit (only boxes with `camera !== false`
   * when `cameraOnly`), or `maxDist` if nothing is hit.
   */
  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number, cameraOnly = true): number {
    let best = maxDist;
    for (const b of this.boxes) {
      if (cameraOnly && b.camera === false) continue;
      if (!this.active(b)) continue;
      const t = rayBox(ox, oy, oz, dx, dy, dz, b);
      if (t >= 0 && t < best) best = t;
    }
    return best;
  }
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Slab test. Returns entry distance (0 if the origin is inside) or -1. */
function rayBox(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, b: Box): number {
  slab.min = -Infinity;
  slab.max = Infinity;
  if (!axis(ox, dx, b.min[0], b.max[0]) || !axis(oy, dy, b.min[1], b.max[1]) || !axis(oz, dz, b.min[2], b.max[2])) return -1;
  if (slab.max < 0) return -1;
  return slab.min < 0 ? 0 : slab.min;
}

const slab = { min: 0, max: 0 };

function axis(o: number, d: number, lo: number, hi: number): boolean {
  if (Math.abs(d) < EPS) return o >= lo && o <= hi;
  let t1 = (lo - o) / d;
  let t2 = (hi - o) / d;
  if (t1 > t2) {
    const tmp = t1;
    t1 = t2;
    t2 = tmp;
  }
  if (t1 > slab.min) slab.min = t1;
  if (t2 < slab.max) slab.max = t2;
  return slab.min <= slab.max;
}
