import type { AnimState } from "../data/characters";

/**
 * Procedural animation for the TEMPORARY character model: Idle, Walk, Run, Turn, Jump/Fall,
 * Stairs and Interaction poses, blended smoothly. A final rigged GLB replaces this with real clips
 * (see GltfCharacter) — the controller emits the same AnimState either way.
 */
export interface Pose {
  thighL: number;
  thighR: number;
  kneeL: number;
  kneeR: number;
  armL: number;
  armR: number;
  armOutL: number;
  armOutR: number;
  elbowL: number;
  elbowR: number;
  lean: number;
  twist: number;
  roll: number;
  bob: number;
  headX: number;
  headY: number;
  breathe: number;
}

export function neutralPose(): Pose {
  return {
    thighL: 0,
    thighR: 0,
    kneeL: 0,
    kneeR: 0,
    armL: 0,
    armR: 0,
    armOutL: 0.12,
    armOutR: 0.12,
    elbowL: 0.25,
    elbowR: 0.25,
    lean: 0,
    twist: 0,
    roll: 0,
    bob: 0,
    headX: 0,
    headY: 0,
    breathe: 0,
  };
}

export interface AnimInput {
  state: AnimState;
  /** Seconds since start. */
  time: number;
  /** Walk-cycle phase in radians (advanced by distance travelled). */
  phase: number;
  /** Horizontal speed, m/s. */
  speed: number;
  /** Signed turn rate, rad/s. */
  turnRate: number;
  /** 0..1 progress of the interaction gesture. */
  interact: number;
}

/** Target pose for the current state (before smoothing). */
export function targetPose(a: AnimInput, out: Pose = neutralPose()): Pose {
  const p = out;
  Object.assign(p, neutralPose());
  const t = a.time;
  const s = Math.sin(a.phase);
  const c = Math.cos(a.phase);

  switch (a.state) {
    case "idle":
    case "turn": {
      p.breathe = Math.sin(t * 2.1) * 0.012;
      p.armL = Math.sin(t * 1.3) * 0.03;
      p.armR = -Math.sin(t * 1.3) * 0.03;
      p.headY = Math.sin(t * 0.45) * 0.25;
      p.headX = Math.sin(t * 0.7) * 0.04;
      p.roll = Math.sin(t * 0.9) * 0.015;
      if (a.state === "turn") {
        // small shuffle while turning on the spot
        p.thighL = Math.max(0, Math.sin(t * 9)) * 0.2;
        p.thighR = Math.max(0, -Math.sin(t * 9)) * 0.2;
        p.kneeL = p.thighL * 1.2;
        p.kneeR = p.thighR * 1.2;
      }
      break;
    }
    case "walk":
    case "stairs": {
      const k = a.state === "stairs" ? 1.25 : 1;
      p.thighL = s * 0.5 * k + (a.state === "stairs" ? 0.25 : 0);
      p.thighR = -s * 0.5 * k + (a.state === "stairs" ? 0.25 : 0);
      p.kneeL = Math.max(0, -c) * 0.85 * k + 0.08;
      p.kneeR = Math.max(0, c) * 0.85 * k + 0.08;
      p.armL = -s * 0.45;
      p.armR = s * 0.45;
      p.elbowL = 0.35;
      p.elbowR = 0.35;
      p.bob = Math.abs(c) * 0.035;
      p.twist = s * 0.08;
      p.lean = 0.05;
      p.headX = -0.03;
      break;
    }
    case "run": {
      p.thighL = s * 0.95;
      p.thighR = -s * 0.95;
      p.kneeL = Math.max(0, -c) * 1.5 + 0.2;
      p.kneeR = Math.max(0, c) * 1.5 + 0.2;
      p.armL = -s * 0.85;
      p.armR = s * 0.85;
      p.armOutL = 0.2;
      p.armOutR = 0.2;
      p.elbowL = 1.25;
      p.elbowR = 1.25;
      p.bob = Math.abs(c) * 0.07;
      p.twist = s * 0.16;
      p.lean = 0.22;
      p.headX = -0.12;
      break;
    }
    case "jump":
    case "fall": {
      const up = a.state === "jump";
      p.thighL = up ? 0.9 : 0.4;
      p.thighR = up ? 0.2 : 0.55;
      p.kneeL = up ? 1.3 : 0.6;
      p.kneeR = up ? 0.5 : 0.7;
      p.armL = up ? -0.6 : -0.3;
      p.armR = up ? -0.6 : -0.3;
      p.armOutL = up ? 0.9 : 1.1;
      p.armOutR = up ? 0.9 : 1.1;
      p.elbowL = 0.5;
      p.elbowR = 0.5;
      p.lean = up ? 0.12 : -0.05;
      break;
    }
    case "interact": {
      const w = Math.sin(Math.min(1, a.interact) * Math.PI);
      p.armR = -1.35 * w;
      p.elbowR = 0.35;
      p.armOutR = 0.1;
      p.headX = 0.12 * w;
      p.breathe = Math.sin(t * 2.1) * 0.012;
      break;
    }
  }
  // lean into turns while moving
  p.roll += Math.max(-0.18, Math.min(0.18, -a.turnRate * 0.05 * Math.min(1, a.speed / 3)));
  return p;
}

/** Frame-rate independent smoothing of the current pose towards the target. */
export function blendPose(current: Pose, target: Pose, dt: number, sharpness = 12) {
  const k = 1 - Math.exp(-dt * sharpness);
  for (const key in current) {
    const kk = key as keyof Pose;
    current[kk] += (target[kk] - current[kk]) * k;
  }
}
