"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import type { CharacterDef } from "../data/characters";
import { inputBlocked, playerPose, worldStore } from "../store";
import type { Body } from "../systems/CollisionSystem";
import { travelTo, useRuntimeRef } from "../systems/runtime";
import { getMachine } from "../data/machines";
import { areaAt, surfaceAt } from "../data/world";
import { envAt, walkThroughPortalAt } from "../world/registry";
import { audio } from "../systems/AudioManager";
import { type AnimSource, CharacterModel } from "./CharacterModel";

export const MOVE = {
  walkSpeed: 2.6,
  runSpeed: 5.4,
  accel: 10,
  gravity: 22,
  jumpSpeed: 6.4,
  radius: 0.28,
  height: 1.65,
  stepHeight: 0.33,
  footRadius: 0.16,
  turnSharpness: 12,
} as const;

/**
 * Third-person character controller: camera-relative movement, walk/run, jump, gravity,
 * wall collisions and step-up (stairs). Writes the pose for the camera, mini-map and HUD.
 */
export function CharacterController({ def, castShadow }: { def: CharacterDef; castShadow: boolean }) {
  const rtRef = useRuntimeRef();
  const group = useRef<THREE.Group>(null);
  const shadowBlob = useRef<THREE.Mesh>(null);
  const anim = useRef<AnimSource["current"]>({ state: "idle", phase: 0, speed: 0, turnRate: 0, interact: 0 });
  const vel = useRef({ x: 0, z: 0 });
  const interactT = useRef(0);
  const airTime = useRef(0);
  /** walk-through doorways work only after the player has been outside all of them */
  const doorArmed = useRef(false);
  const body = useRef<Body | null>(null);

  useFrame((_, delta) => {
    const rt = rtRef.current;
    const dt = Math.min(delta, 1 / 30);
    const p = rt.player;
    const travel = worldStore.get().travel;
    if (travel) {
      travelTo(rt, travel);
      doorArmed.current = false;
      vel.current.x = vel.current.z = 0;
      worldStore.set({ travel: null });
    }
    if (!body.current) body.current = { x: p.x, y: p.y, z: p.z, radius: MOVE.radius, height: MOVE.height, stepHeight: MOVE.stepHeight };
    const inp = rt.input;
    const blocked = inputBlocked();

    // ── desired velocity (camera relative)
    let mx = blocked ? 0 : inp.moveX;
    let my = blocked ? 0 : inp.moveY;
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    const yaw = rt.camera.yaw;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    const speedMax = inp.run ? MOVE.runSpeed : MOVE.walkSpeed;
    const tx = (rx * mx + fx * my) * speedMax;
    const tz = (rz * mx + fz * my) * speedMax;
    const k = 1 - Math.exp(-dt * (p.grounded ? MOVE.accel : MOVE.accel * 0.35));
    vel.current.x += (tx - vel.current.x) * k;
    vel.current.z += (tz - vel.current.z) * k;

    // ── horizontal move in sub-steps + collision (runtime.player is authoritative, e.g. respawn)
    const b = body.current;
    b.x = p.x;
    b.y = p.y;
    b.z = p.z;
    const dist = Math.hypot(vel.current.x, vel.current.z) * dt;
    const steps = Math.max(1, Math.ceil(dist / 0.12));
    const px = b.x;
    const pz = b.z;
    for (let i = 0; i < steps; i++) {
      b.x += (vel.current.x * dt) / steps;
      b.z += (vel.current.z * dt) / steps;
      rt.world.resolve(b);
    }
    // never leave the building / street into the empty space around it
    const here = envAt(px, pz);
    let rescued = false;
    if (here.walkable) {
      if (!here.walkable(px, pz)) {
        // found outside (e.g. after an old collision glitch): back to the environment's start
        const s0 = here.spawns.default;
        b.x = s0.x;
        b.y = s0.y;
        b.z = s0.z;
        p.vy = 0;
        rescued = true;
      } else if (!here.walkable(b.x, b.z)) {
        b.x = px;
        b.z = pz;
      }
    }
    // keep velocity consistent with what actually happened (slide along walls)
    if (rescued) vel.current.x = vel.current.z = 0;
    else if (dt > 0) {
      vel.current.x = (b.x - px) / dt;
      vel.current.z = (b.z - pz) / dt;
    }

    // ── vertical: jump, gravity, ground + step snapping
    const wasGrounded = p.grounded;
    const fallSpeed = -p.vy;
    if (inp.jump) {
      inp.jump = false;
      if (!blocked && (p.grounded || airTime.current < 0.12)) {
        p.vy = MOVE.jumpSpeed;
        audio.jump();
        p.grounded = false;
        airTime.current = 1;
      }
    }
    p.vy -= MOVE.gravity * dt;
    const prevY = b.y;
    b.y += p.vy * dt;
    if (p.vy > 0) {
      // head against the ceiling: the jump stops there
      const ceiling = rt.world.ceilingAbove(b.x, b.z, MOVE.radius * 0.8, prevY + MOVE.height);
      if (b.y + MOVE.height > ceiling) {
        b.y = Math.max(prevY, ceiling - MOVE.height);
        p.vy = 0;
      }
    }
    const ground = rt.world.groundHeight(b.x, b.z, MOVE.footRadius, Math.max(prevY, b.y), MOVE.stepHeight);
    if (b.y <= ground) {
      b.y = ground;
      p.vy = 0;
      p.grounded = true;
    } else if (wasGrounded && p.vy <= 0 && b.y - ground <= MOVE.stepHeight + 0.02) {
      // walking down a step: stay glued to the ground instead of "falling"
      b.y = ground;
      p.vy = 0;
      p.grounded = true;
    } else {
      p.grounded = false;
    }
    if (p.grounded && !wasGrounded && airTime.current > 0.18) audio.land(fallSpeed / 8);
    airTime.current = p.grounded ? 0 : airTime.current + dt;

    // ── facing
    const hs = Math.hypot(vel.current.x, vel.current.z);
    let turnRate = 0;
    if (hs > 0.15 && Math.hypot(tx, tz) > 0.01) {
      const want = Math.atan2(tx, tz);
      let d = want - p.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      const step = d * (1 - Math.exp(-dt * MOVE.turnSharpness));
      p.heading += step;
      turnRate = step / dt;
    }

    // ── interaction (info panel, or travel to another area)
    if (inp.interact) {
      inp.interact = false;
      const s = worldStore.get();
      if (!blocked && s.nearby) {
        const m = getMachine(s.nearby.machineId);
        const travel = m?.travel;
        if (travel) worldStore.set({ travel, nearby: null });
        else if (m?.opens === "events") worldStore.set({ eventsOpen: true });
        else {
          interactT.current = 0.001;
          worldStore.set({ panel: s.nearby });
        }
      }
    }
    if (interactT.current > 0) {
      interactT.current += dt / 0.9;
      if (interactT.current >= 1) interactT.current = 0;
    }

    // ── animation state
    const a = anim.current;
    a.speed = hs;
    a.turnRate = turnRate;
    a.interact = interactT.current;
    const prevPhase = a.phase;
    a.phase += dt * hs * (hs > 3.6 ? 2.35 : 3.1);
    // a footstep each time a foot plants (every half cycle)
    if (p.grounded && hs > 0.4 && Math.floor(a.phase / Math.PI) !== Math.floor(prevPhase / Math.PI)) {
      audio.step(surfaceAt(b.x, b.y, b.z, p.onStairs), hs > 3.6);
    }
    const onStairs = p.grounded && b.y > 0.02 && b.y < 2.85 && hs > 0.1;
    p.onStairs = onStairs;
    a.state = !p.grounded
      ? p.vy > 0
        ? "jump"
        : "fall"
      : interactT.current > 0
        ? "interact"
        : hs > 3.6
          ? "run"
          : hs > 0.25
            ? onStairs
              ? "stairs"
              : "walk"
            : Math.abs(turnRate) > 1.5
              ? "turn"
              : "idle";

    p.x = b.x;
    p.y = b.y;
    p.z = b.z;
    p.speed = hs;
    playerPose.x = b.x;
    playerPose.z = b.z;
    playerPose.heading = p.heading;
    playerPose.floor = b.y > 2.5 ? 1 : 0;
    const area = areaAt(b.x, b.y, b.z);
    const env = envAt(b.x, b.z).id;
    if (area !== worldStore.get().area || env !== worldStore.get().env) worldStore.set({ area, env });
    // walk-through doorways between environments (no key press)
    // (after arriving, the player must first step out of any doorway, so arriving inside one never bounces back)
    const door = walkThroughPortalAt(b.x, b.y, b.z);
    if (!door) doorArmed.current = true;
    else if (doorArmed.current && !worldStore.get().travel) {
      doorArmed.current = false;
      worldStore.set({ travel: door.to, nearby: null });
    }

    if (group.current) {
      group.current.position.set(b.x, b.y, b.z);
      group.current.rotation.y = p.heading;
    }
    if (shadowBlob.current) {
      shadowBlob.current.position.set(b.x, ground + 0.012, b.z);
      const s = Math.max(0.4, 1 - (b.y - ground) * 0.5);
      shadowBlob.current.scale.setScalar(s);
    }
  });

  return (
    <>
      <group ref={group}>
        <CharacterModel def={def} anim={anim} castShadow={castShadow} />
      </group>
      {!castShadow && (
        <mesh ref={shadowBlob} rotation-x={-Math.PI / 2} renderOrder={1}>
          <circleGeometry args={[0.36, 24]} />
          <meshBasicMaterial color="#000" transparent opacity={0.28} depthWrite={false} />
        </mesh>
      )}
    </>
  );
}
