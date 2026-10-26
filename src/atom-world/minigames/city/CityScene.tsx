"use client";

import { useFrame } from "@react-three/fiber";
import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";
import { type CityState, nearestCar, PICKUP_R, SIZE } from "./engine";
import { arrowGeometry, blobTexture, blockKinds, buildingGeometry, buildingHeight, clubSignTexture, groundTexture, lampSpots, roofBoxes, signs, taxiSignTexture, windowTexture } from "./city3d";

/** Camera direction shared with the controls and the mini-map (engine angle: 0 = east, π/2 = south). */
export interface CityView {
  yaw: number;
  snap: boolean;
  /** where the player is and where the camera is (engine x / y), for hiding what stands between */
  px?: number;
  py?: number;
  cx?: number;
  cy?: number;
}

/** Distance from (x, y) to the segment a → b. */
function segDist(x: number, y: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const l = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l));
  return Math.hypot(x - ax - dx * t, y - ay - dy * t);
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
// scratch objects (never kept between calls)
const base = new THREE.Matrix4();
const tmp = new THREE.Matrix4();
const tmp2 = new THREE.Matrix4();
const quat = new THREE.Quaternion();
const vec = new THREE.Vector3();
const one = new THREE.Vector3(1, 1, 1);
const scl = new THREE.Vector3();
const lookAt = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const color = new THREE.Color();
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const at = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z);

/** Car parts in the car's own frame (+x forward, +z to the right). */
const PART = {
  body: at(0, 0.68, 0),
  cabin: at(-0.25, 1.36, 0),
  roof: at(-0.25, 1.69, 0),
  wheels: [at(1.35, 0.36, 0.95), at(1.35, 0.36, -0.95), at(-1.35, 0.36, 0.95), at(-1.35, 0.36, -0.95)],
  heads: [at(2.11, 0.78, 0.6), at(2.11, 0.78, -0.6)],
  tails: [at(-2.11, 0.78, 0.6), at(-2.11, 0.78, -0.6)],
  shadow: at(0, 0.03, 0),
};
const HIP = [at(0, 0.72, 0.12), at(0, 0.72, -0.12)];
const LEG_DOWN = at(0, -0.36, 0);
const SKIN = new THREE.Color("#e0b48c");
const BROKEN = new THREE.Color("#4a4a4a");

/** Base matrix of something standing at engine (x, y) facing engine angle `a`. */
function place(m: THREE.Matrix4, x: number, y: number, a: number, lift = 0) {
  return m.compose(vec.set(x, lift, y), quat.setFromAxisAngle(UP, -a), one);
}

/** The still parts of the city: streets, buildings, signs, trees, lamps. */
function Statics({ city, texPx, viewRef }: { city: CityState; texPx: number; viewRef: RefObject<CityView> }) {
  const [res] = useState(() => {
    const { walls, roofs } = buildingGeometry(city.buildings);
    return {
      ground: groundTexture(blockKinds(city), texPx),
      win: windowTexture(),
      walls,
      roofs,
      sign: signs(city.buildings),
      club: clubSignTexture(),
      boxes: roofBoxes(city.buildings),
      lamps: lampSpots(),
    };
  });
  const trunks = useRef<THREE.InstancedMesh>(null);
  const crowns = useRef<THREE.InstancedMesh>(null);
  const poles = useRef<THREE.InstancedMesh>(null);
  const bulbs = useRef<THREE.InstancedMesh>(null);
  const boxes = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    city.trees.forEach((t, i) => {
      trunks.current!.setMatrixAt(i, tmp.makeTranslation(t.x, 0.8, t.y));
      const s = t.r * 1.5;
      crowns.current!.setMatrixAt(i, tmp.compose(vec.set(t.x, 2.3 + t.r * 0.6, t.y), quat.setFromAxisAngle(UP, i * 1.3), new THREE.Vector3(s, s * 1.1, s)));
      crowns.current!.setColorAt(i, color.setHSL(0.27 + (i % 5) * 0.012, 0.45, 0.28 + (i % 3) * 0.03));
    });
    res.lamps.forEach(([x, z], i) => {
      poles.current!.setMatrixAt(i, tmp.makeTranslation(x, 2.1, z));
      bulbs.current!.setMatrixAt(i, tmp.makeTranslation(x, 4.25, z));
    });
    res.boxes.forEach(([x, y, z, sx, sy, sz], i) => boxes.current!.setMatrixAt(i, tmp.compose(vec.set(x, y + sy / 2, z), quat.identity(), new THREE.Vector3(sx, sy, sz))));
    for (const m of [trunks, crowns, poles, bulbs, boxes]) {
      m.current!.instanceMatrix.needsUpdate = true;
      if (m.current!.instanceColor) m.current!.instanceColor.needsUpdate = true;
      m.current!.computeBoundingSphere();
    }
  }, [city, res]);

  // lamps and trees that stand between the camera and the player are hidden
  const hiddenNow = useRef({ lamps: new Set<number>(), trees: new Set<number>(), key: "" });
  useFrame(() => {
    const v = viewRef.current;
    if (!v || v.px === undefined || v.cx === undefined) return;
    const h = hiddenNow.current;
    const lamps = new Set<number>();
    const trees = new Set<number>();
    res.lamps.forEach(([x, z], i) => {
      if (Math.hypot(x - v.px!, z - v.py!) > 1.2 && segDist(x, z, v.cx!, v.cy!, v.px!, v.py!) < 0.9) lamps.add(i);
    });
    city.trees.forEach((t, i) => {
      if (Math.hypot(t.x - v.px!, t.y - v.py!) > t.r * 1.5 + 0.8 && segDist(t.x, t.y, v.cx!, v.cy!, v.px!, v.py!) < t.r * 1.5 + 0.4) trees.add(i);
    });
    const key = [...lamps].join(",") + "|" + [...trees].join(",");
    if (key === h.key) return;
    h.key = key;
    res.lamps.forEach(([x, z], i) => {
      const off = lamps.has(i);
      poles.current!.setMatrixAt(i, off ? HIDDEN : tmp.makeTranslation(x, 2.1, z));
      bulbs.current!.setMatrixAt(i, off ? HIDDEN : tmp.makeTranslation(x, 4.25, z));
    });
    city.trees.forEach((t, i) => {
      const off = trees.has(i);
      const sc = t.r * 1.5;
      trunks.current!.setMatrixAt(i, off ? HIDDEN : tmp.makeTranslation(t.x, 0.8, t.y));
      crowns.current!.setMatrixAt(i, off ? HIDDEN : tmp.compose(vec.set(t.x, 2.3 + t.r * 0.6, t.y), quat.setFromAxisAngle(UP, i * 1.3), scl.set(sc, sc * 1.1, sc)));
    });
    for (const m of [poles, bulbs, trunks, crowns]) m.current!.instanceMatrix.needsUpdate = true;
  });

  useEffect(() => {
    let alive = true;
    // signs drawn before the web font arrived: draw them again with it
    document.fonts?.ready.then(() => {
      if (!alive) return;
      res.sign.redraw();
      res.club.redraw();
    });
    return () => {
      alive = false;
      for (const d of [res.ground, res.win, res.walls, res.roofs, res.sign.geometry, res.sign.texture, res.club.texture]) d.dispose();
    };
  }, [res]);

  const club = city.buildings.find((b) => b.club)!;
  const ch = buildingHeight(club);
  const cx = (club.x0 + club.x1) / 2;
  const cz = (club.y0 + club.y1) / 2;
  const cw = club.x1 - club.x0;
  const cd = club.y1 - club.y0;
  const neon = [
    [cx, ch + 0.08, club.y0, cw, 0.16, 0.16],
    [cx, ch + 0.08, club.y1, cw, 0.16, 0.16],
    [club.x0, ch + 0.08, cz, 0.16, 0.16, cd],
    [club.x1, ch + 0.08, cz, 0.16, 0.16, cd],
  ];
  return (
    <group>
      {/* grass around the city, then the streets */}
      <mesh rotation-x={-Math.PI / 2} position={[SIZE / 2, -0.05, SIZE / 2]}>
        <planeGeometry args={[SIZE + 400, SIZE + 400]} />
        <meshLambertMaterial color="#5b7f43" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[SIZE / 2, 0, SIZE / 2]}>
        <planeGeometry args={[SIZE, SIZE]} />
        <meshLambertMaterial map={res.ground} />
      </mesh>
      <mesh geometry={res.walls}>
        <meshLambertMaterial map={res.win} vertexColors />
      </mesh>
      <mesh geometry={res.roofs}>
        <meshLambertMaterial vertexColors />
      </mesh>
      <mesh geometry={res.sign.geometry}>
        <meshBasicMaterial map={res.sign.texture} toneMapped={false} />
      </mesh>
      {/* the ATOM club: glowing signs on every side and a green rim on the roof */}
      {(
        [
          [cx, club.y1 + 0.07, 0],
          [cx, club.y0 - 0.07, Math.PI],
          [club.x1 + 0.07, cz, Math.PI / 2],
          [club.x0 - 0.07, cz, -Math.PI / 2],
        ] as const
      ).map(([x, z, r], i) => (
        <mesh key={i} position={[x, 5.6, z]} rotation-y={r}>
          <planeGeometry args={[9, 2.8]} />
          <meshBasicMaterial map={res.club.texture} toneMapped={false} />
        </mesh>
      ))}
      {neon.map(([x, y, z, sx, sy, sz], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[sx, sy, sz]} />
          <meshBasicMaterial color="#39ff88" toneMapped={false} />
        </mesh>
      ))}
      <instancedMesh ref={boxes} args={[undefined, undefined, Math.max(1, res.boxes.length)]}>
        <boxGeometry />
        <meshLambertMaterial color="#8d9399" />
      </instancedMesh>
      <instancedMesh ref={trunks} args={[undefined, undefined, Math.max(1, city.trees.length)]}>
        <cylinderGeometry args={[0.12, 0.18, 1.6, 6]} />
        <meshLambertMaterial color="#6b4a2f" />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, Math.max(1, city.trees.length)]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshLambertMaterial flatShading />
      </instancedMesh>
      <instancedMesh ref={poles} args={[undefined, undefined, res.lamps.length]}>
        <cylinderGeometry args={[0.07, 0.09, 4.2, 6]} />
        <meshLambertMaterial color="#3d4248" />
      </instancedMesh>
      <instancedMesh ref={bulbs} args={[undefined, undefined, res.lamps.length]}>
        <sphereGeometry args={[0.2, 8, 6]} />
        <meshBasicMaterial color="#fff2c0" toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/** A person: legs and arms swing with `phase`. */
function Person({ body, cap, groupRef, legs, arms }: { body: string; cap?: string; groupRef: RefObject<THREE.Group | null>; legs: RefObject<(THREE.Mesh | null)[]>; arms: RefObject<(THREE.Mesh | null)[]> }) {
  return (
    <group ref={groupRef}>
      {[0.13, -0.13].map((z, i) => (
        <group key={z} position={[0, 0.72, z]}>
          <mesh
            ref={(el) => {
              legs.current[i] = el;
            }}
            position={[0, -0.36, 0]}
          >
            <boxGeometry args={[0.18, 0.72, 0.18]} />
            <meshLambertMaterial color="#2b3440" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.08, 0]}>
        <cylinderGeometry args={[0.24, 0.29, 0.76, 10]} />
        <meshLambertMaterial color={body} />
      </mesh>
      {[0.34, -0.34].map((z, i) => (
        <group key={z} position={[0, 1.4, z]}>
          <mesh
            ref={(el) => {
              arms.current[i] = el;
            }}
            position={[0, -0.3, 0]}
          >
            <boxGeometry args={[0.13, 0.6, 0.13]} />
            <meshLambertMaterial color={body} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.66, 0]}>
        <sphereGeometry args={[0.21, 12, 10]} />
        <meshLambertMaterial color="#e0b48c" />
      </mesh>
      {cap && (
        <mesh position={[0.02, 1.83, 0]}>
          <cylinderGeometry args={[0.2, 0.22, 0.12, 12]} />
          <meshLambertMaterial color={cap} />
        </mesh>
      )}
    </group>
  );
}

/** Swing a person's limbs (their pivot groups are the meshes' parents). */
function swing(legs: (THREE.Mesh | null)[], arms: (THREE.Mesh | null)[], phase: number, amount: number) {
  const a = Math.sin(phase) * amount;
  if (legs[0]?.parent) legs[0].parent.rotation.z = a;
  if (legs[1]?.parent) legs[1].parent.rotation.z = -a;
  if (arms[0]?.parent) arms[0].parent.rotation.z = -a * 0.8;
  if (arms[1]?.parent) arms[1].parent.rotation.z = a * 0.8;
}

export interface CitySceneProps {
  /** The city at the start (for the still parts; the same object the game changes). */
  city: CityState;
  simRef: RefObject<CityState>;
  /** Steps the game (input, rules, sounds, HUD); called first in every frame. */
  tickRef: RefObject<(dt: number) => void>;
  viewRef: RefObject<CityView>;
  texPx: number;
  playerColor: string;
}

/** Everything that moves, and the chase camera. */
export function CityScene({ city, simRef, tickRef, viewRef, texPx, playerColor }: CitySceneProps) {
  const nCars = city.cars.length;
  const nPeds = city.peds.length;
  const nCoins = city.coins.length;
  const bodies = useRef<THREE.InstancedMesh>(null);
  const cabins = useRef<THREE.InstancedMesh>(null);
  const roofs = useRef<THREE.InstancedMesh>(null);
  const wheels = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const tails = useRef<THREE.InstancedMesh>(null);
  const shadows = useRef<THREE.InstancedMesh>(null);
  const pedBodies = useRef<THREE.InstancedMesh>(null);
  const pedHeads = useRef<THREE.InstancedMesh>(null);
  const pedLegs = useRef<THREE.InstancedMesh>(null);
  const pedShadows = useRef<THREE.InstancedMesh>(null);
  const coins = useRef<THREE.InstancedMesh>(null);
  const smoke = useRef<THREE.InstancedMesh>(null);
  const taxiSign = useRef<THREE.Mesh>(null);
  const player = useRef<THREE.Group>(null);
  const playerLegs = useRef<(THREE.Mesh | null)[]>([]);
  const playerArms = useRef<(THREE.Mesh | null)[]>([]);
  const playerRing = useRef<THREE.Mesh>(null);
  const passenger = useRef<THREE.Group>(null);
  const passengerLegs = useRef<(THREE.Mesh | null)[]>([]);
  const passengerArms = useRef<(THREE.Mesh | null)[]>([]);
  const nearRing = useRef<THREE.Mesh>(null);
  const beam = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const arrow = useRef<THREE.Group>(null);
  const cam = useRef({ pos: new THREE.Vector3(), look: new THREE.Vector3(), walk: 0 });
  const carColors = useRef(new Map<number, THREE.Color>());
  const [geo] = useState(() => ({
    wheel: new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12).rotateX(Math.PI / 2),
    carShadow: new THREE.PlaneGeometry(5, 2.8).rotateX(-Math.PI / 2),
    pedShadow: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    ring: new THREE.RingGeometry(PICKUP_R - 0.35, PICKUP_R, 48).rotateX(-Math.PI / 2),
    nearRing: new THREE.RingGeometry(2.35, 2.6, 40).rotateX(-Math.PI / 2),
    playerRing: new THREE.RingGeometry(0.5, 0.65, 28).rotateX(-Math.PI / 2),
    coin: new THREE.CylinderGeometry(0.42, 0.42, 0.09, 18).rotateX(Math.PI / 2),
    arrow: arrowGeometry(),
    blob: blobTexture(),
    taxi: taxiSignTexture(),
  }));
  const [heights] = useState(() => city.buildings.map(buildingHeight));
  useEffect(
    () => () => {
      for (const d of Object.values(geo)) d.dispose();
    },
    [geo],
  );

  useFrame((state, delta) => {
    const dt = Math.min(0.05, delta);
    tickRef.current?.(dt);
    const s = simRef.current;
    const v = viewRef.current;
    if (!s || !v) return;
    const t = s.time;
    const p = s.player;
    const driving = p.car !== null ? (s.cars.find((c) => c.id === p.car) ?? null) : null;

    // ── cars
    let smokeN = 0;
    s.cars.forEach((c, i) => {
      place(base, c.x, c.y, c.angle);
      bodies.current!.setMatrixAt(i, tmp.multiplyMatrices(base, PART.body));
      cabins.current!.setMatrixAt(i, tmp.multiplyMatrices(base, PART.cabin));
      roofs.current!.setMatrixAt(i, tmp.multiplyMatrices(base, PART.roof));
      PART.wheels.forEach((w, k) => wheels.current!.setMatrixAt(i * 4 + k, tmp.multiplyMatrices(base, w)));
      PART.heads.forEach((w, k) => heads.current!.setMatrixAt(i * 2 + k, tmp.multiplyMatrices(base, w)));
      PART.tails.forEach((w, k) => tails.current!.setMatrixAt(i * 2 + k, tmp.multiplyMatrices(base, w)));
      shadows.current!.setMatrixAt(i, tmp.multiplyMatrices(base, PART.shadow));
      let cc = carColors.current.get(c.id);
      if (!cc) carColors.current.set(c.id, (cc = new THREE.Color(c.color)));
      const paint = c.health <= 0 ? BROKEN : cc;
      bodies.current!.setColorAt(i, paint);
      roofs.current!.setColorAt(i, paint);
      if (c.health <= 0 && smokeN < 12) {
        for (let k = 0; k < 3 && smokeN < 12; k++) {
          const a = (t * 0.7 + k / 3) % 1;
          const sc = 0.45 + a * 1.1;
          smoke.current!.setMatrixAt(smokeN++, tmp.compose(vec.set(c.x + Math.cos(c.angle) * 1.4 + Math.sin(k * 2.1) * 0.3, 1.2 + a * 3.2, c.y + Math.sin(c.angle) * 1.4), quat.identity(), scl.set(sc, sc, sc)));
        }
      }
      if (c.kind === "player-taxi" && taxiSign.current) {
        taxiSign.current.position.set(c.x - Math.cos(c.angle) * 0.25, 1.9, c.y - Math.sin(c.angle) * 0.25);
        taxiSign.current.rotation.y = -c.angle;
      }
    });
    for (let k = smokeN; k < 12; k++) smoke.current!.setMatrixAt(k, HIDDEN);
    for (const m of [bodies, cabins, roofs, wheels, heads, tails, shadows, smoke]) m.current!.instanceMatrix.needsUpdate = true;
    bodies.current!.instanceColor!.needsUpdate = true;
    roofs.current!.instanceColor!.needsUpdate = true;

    // ── people on the sidewalks (they hop aside when a car comes)
    s.peds.forEach((ped, i) => {
      const a = ped.axis === "x" ? (ped.dir === 1 ? 0 : Math.PI) : ped.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
      const phase = t * 7 + i * 1.7;
      const hop = ped.dodge > 0 ? Math.sin(((0.6 - ped.dodge) / 0.6) * Math.PI) * 0.5 : 0;
      const bob = Math.abs(Math.sin(phase)) * 0.04 + hop;
      place(base, ped.x, ped.y, a, bob);
      pedBodies.current!.setMatrixAt(i, tmp.multiplyMatrices(base, tmp2.makeTranslation(0, 1.08, 0)));
      pedHeads.current!.setMatrixAt(i, tmp.multiplyMatrices(base, tmp2.makeTranslation(0, 1.64, 0)));
      for (let k = 0; k < 2; k++) {
        const sw = Math.sin(phase) * 0.55 * (k ? -1 : 1);
        tmp2.makeRotationZ(sw).premultiply(HIP[k]).multiply(LEG_DOWN);
        pedLegs.current!.setMatrixAt(i * 2 + k, tmp.multiplyMatrices(base, tmp2));
      }
      pedShadows.current!.setMatrixAt(i, place(tmp, ped.x, ped.y, 0, 0.02));
      pedBodies.current!.setColorAt(i, color.set(ped.color));
    });
    for (const m of [pedBodies, pedHeads, pedLegs, pedShadows]) m.current!.instanceMatrix.needsUpdate = true;
    pedBodies.current!.instanceColor!.needsUpdate = true;

    // ── coins: spin and bob
    s.coins.forEach((c, i) => coins.current!.setMatrixAt(i, tmp.compose(vec.set(c.x, 0.95 + Math.sin(t * 2.4 + i) * 0.12, c.y), quat.setFromAxisAngle(UP, t * 3 + i), one)));
    coins.current!.instanceMatrix.needsUpdate = true;

    // ── the player on foot, the car they can get into
    const pl = player.current!;
    pl.visible = !driving;
    playerRing.current!.visible = !driving;
    if (!driving) {
      pl.position.set(p.x, 0, p.y);
      pl.rotation.y = -p.heading;
      swing(playerLegs.current, playerArms.current, p.walk, 0.6);
      playerRing.current!.position.set(p.x, 0.03, p.y);
    }
    const near = driving ? null : nearestCar(s);
    nearRing.current!.visible = !!near;
    if (near) {
      nearRing.current!.position.set(near.x, 0.04, near.y);
      (nearRing.current!.material as THREE.MeshBasicMaterial).color.set(near.health > 0 ? "#39ff88" : "#ff5a5f");
    }

    // ── taxi job: a beam of light, the waiting passenger, an arrow over the player
    const m = s.mission;
    const target = m ? (m.stage === "pickup" ? m.pickup : m.dest) : null;
    beam.current!.visible = ring.current!.visible = arrow.current!.visible = !!target;
    passenger.current!.visible = m?.stage === "pickup";
    if (m && target) {
      const hue = m.stage === "pickup" ? "#39ff88" : "#ff4fa3";
      const pulse = 0.5 + 0.5 * Math.sin(t * 4);
      beam.current!.position.set(target.x, 5, target.y);
      const bm = beam.current!.material as THREE.MeshBasicMaterial;
      bm.color.set(hue);
      bm.opacity = 0.16 + pulse * 0.1;
      ring.current!.position.set(target.x, 0.05, target.y);
      (ring.current!.material as THREE.MeshBasicMaterial).color.set(hue);
      if (m.stage === "pickup") {
        const ps = passenger.current!;
        ps.position.set(m.pickup.x, 0, m.pickup.y);
        ps.rotation.y = -Math.atan2(p.y - m.pickup.y, p.x - m.pickup.x);
        // waves at the taxi
        const arm = passengerArms.current[0]?.parent;
        if (arm) arm.rotation.x = -2.4 + Math.sin(t * 8) * 0.4;
      }
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const d = Math.hypot(dx, dy);
      const ar = arrow.current!;
      ar.visible = d > 12;
      ar.position.set(p.x, (driving ? 2.7 : 2.35) + Math.sin(t * 3) * 0.1, p.y);
      ar.rotation.y = -Math.atan2(dy, dx);
      ((ar.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(hue);
    }

    // ── chase camera: behind the car, or turning after the player when they walk forward
    const c = cam.current;
    const walking = !driving && p.walk !== c.walk;
    c.walk = p.walk;
    let want = v.yaw;
    let rate = 0;
    if (driving) {
      want = driving.angle;
      rate = 2.4;
    } else if (walking) {
      want = p.heading;
      rate = 1.4 * Math.max(0, Math.cos(wrap(p.heading - v.yaw)));
    }
    v.yaw = v.snap ? want : v.yaw + wrap(want - v.yaw) * Math.min(1, dt * rate);
    const aspect = state.size.width / Math.max(1, state.size.height);
    const speed = driving ? Math.abs(driving.speed) : 0;
    const portrait = aspect < 1;
    const dist = (driving ? 8 + speed * 0.13 : 5.2) * (portrait ? 1.2 : 1);
    let height = (driving ? 4.1 + speed * 0.05 : 2.9) * (portrait ? 1.15 : 1);
    const lookY = driving ? 1.3 : 1.4;
    const fx = Math.cos(v.yaw);
    const fz = Math.sin(v.yaw);
    // pull in (and up) when a building would hide the player
    let reach = 1;
    for (let k = 1; k <= 16; k++) {
      const f = k / 16;
      const x = p.x - fx * dist * f;
      const z = p.y - fz * dist * f;
      const y = lookY + (height - lookY) * f;
      if (city.buildings.some((b, bi) => x > b.x0 - 0.4 && x < b.x1 + 0.4 && z > b.y0 - 0.4 && z < b.y1 + 0.4 && y < heights[bi] + 0.5)) {
        reach = Math.max(0.3, f - 0.08);
        break;
      }
    }
    height += (1 - reach) * 3;
    vec.set(p.x - fx * dist * reach, height, p.y - fz * dist * reach);
    const look = lookAt.set(p.x + fx * (driving ? 3 : 1.5), lookY, p.y + fz * (driving ? 3 : 1.5));
    if (v.snap) {
      c.pos.copy(vec);
      c.look.copy(look);
      v.snap = false;
    } else {
      c.pos.lerp(vec, Math.min(1, dt * 7));
      c.look.lerp(look, Math.min(1, dt * 9));
    }
    v.px = p.x;
    v.py = p.y;
    v.cx = c.pos.x;
    v.cy = c.pos.z;
    const camera = state.camera as THREE.PerspectiveCamera;
    camera.position.copy(c.pos);
    camera.lookAt(c.look);
    const fov = portrait ? 70 : 58;
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  });

  return (
    <>
      <color attach="background" args={["#b7d3ea"]} />
      <fog attach="fog" args={["#b7d3ea", 45, 135]} />
      <hemisphereLight args={["#eaf4ff", "#8a8170", 2.1]} />
      <directionalLight position={[-60, 90, 40]} intensity={2.2} color="#fff6e8" />
      <Statics city={city} texPx={texPx} viewRef={viewRef} />
      {/* cars: one draw call per part for all of them */}
      <instancedMesh ref={bodies} args={[undefined, undefined, nCars]} frustumCulled={false}>
        <boxGeometry args={[4.2, 0.74, 2]} />
        <meshLambertMaterial />
      </instancedMesh>
      <instancedMesh ref={cabins} args={[undefined, undefined, nCars]} frustumCulled={false}>
        <boxGeometry args={[2.1, 0.62, 1.78]} />
        <meshLambertMaterial color="#1d2a38" />
      </instancedMesh>
      <instancedMesh ref={roofs} args={[undefined, undefined, nCars]} frustumCulled={false}>
        <boxGeometry args={[1.95, 0.08, 1.72]} />
        <meshLambertMaterial />
      </instancedMesh>
      <instancedMesh ref={wheels} args={[geo.wheel, undefined, nCars * 4]} frustumCulled={false}>
        <meshLambertMaterial color="#151515" />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, nCars * 2]} frustumCulled={false}>
        <boxGeometry args={[0.06, 0.18, 0.42]} />
        <meshBasicMaterial color="#fff6c9" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={tails} args={[undefined, undefined, nCars * 2]} frustumCulled={false}>
        <boxGeometry args={[0.06, 0.18, 0.42]} />
        <meshBasicMaterial color="#e23b3b" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={shadows} args={[geo.carShadow, undefined, nCars]} frustumCulled={false}>
        <meshBasicMaterial map={geo.blob} transparent depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={smoke} args={[undefined, undefined, 12]} frustumCulled={false}>
        <sphereGeometry args={[0.6, 8, 6]} />
        <meshLambertMaterial color="#6f6f6f" transparent opacity={0.45} depthWrite={false} />
      </instancedMesh>
      <mesh ref={taxiSign}>
        <boxGeometry args={[0.95, 0.34, 0.5]} />
        <meshBasicMaterial map={geo.taxi} toneMapped={false} />
      </mesh>
      {/* people */}
      <instancedMesh ref={pedBodies} args={[undefined, undefined, nPeds]} frustumCulled={false}>
        <cylinderGeometry args={[0.24, 0.29, 0.76, 8]} />
        <meshLambertMaterial />
      </instancedMesh>
      <instancedMesh ref={pedHeads} args={[undefined, undefined, nPeds]} frustumCulled={false}>
        <sphereGeometry args={[0.2, 10, 8]} />
        <meshLambertMaterial color={SKIN} />
      </instancedMesh>
      <instancedMesh ref={pedLegs} args={[undefined, undefined, nPeds * 2]} frustumCulled={false}>
        <boxGeometry args={[0.17, 0.72, 0.17]} />
        <meshLambertMaterial color="#2b3440" />
      </instancedMesh>
      <instancedMesh ref={pedShadows} args={[geo.pedShadow, undefined, nPeds]} frustumCulled={false}>
        <meshBasicMaterial map={geo.blob} transparent depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={coins} args={[geo.coin, undefined, nCoins]} frustumCulled={false}>
        <meshLambertMaterial color="#f2c230" emissive="#6b4b00" />
      </instancedMesh>
      <Person body={playerColor} cap="#39ff88" groupRef={player} legs={playerLegs} arms={playerArms} />
      <mesh ref={playerRing} geometry={geo.playerRing}>
        <meshBasicMaterial color="#39ff88" toneMapped={false} />
      </mesh>
      <Person body="#f2c230" groupRef={passenger} legs={passengerLegs} arms={passengerArms} />
      <mesh ref={nearRing} geometry={geo.nearRing}>
        <meshBasicMaterial color="#39ff88" toneMapped={false} transparent opacity={0.85} />
      </mesh>
      <mesh ref={beam}>
        <cylinderGeometry args={[PICKUP_R, PICKUP_R, 10, 32, 1, true]} />
        <meshBasicMaterial color="#39ff88" transparent opacity={0.2} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh ref={ring} geometry={geo.ring}>
        <meshBasicMaterial color="#39ff88" toneMapped={false} />
      </mesh>
      <group ref={arrow}>
        <mesh geometry={geo.arrow}>
          <meshBasicMaterial color="#39ff88" toneMapped={false} transparent opacity={0.9} />
        </mesh>
      </group>
    </>
  );
}
