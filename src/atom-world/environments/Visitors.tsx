"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { applyPose, buildToonCharacter } from "../characters/buildToonCharacter";
import { type AnimInput, blendPose, neutralPose, type Pose, targetPose } from "../characters/CharacterAnimations";
import type { CharacterLook } from "../data/characters";
import { AIR_HOCKEY_SIZE } from "../data/environment";
import { toWorldXZ } from "../world/items";
import { worldItems } from "../world/registry";
import { FOOT_POOL, UPPER_Y } from "../data/upperFloor";
import type { QualityLevel } from "../systems/QualityManager";
import { useRuntimeRef } from "../systems/runtime";
import { toonGradient } from "../systems/textures";

/**
 * Decorative visitors that make the hall feel alive (not real people or staff of the club):
 * two playing at the middle air-hockey table, one strolling along the walkway, and people watching
 * the foot-pool field upstairs. Generic casual clothes, so they never look like the two ATOM
 * characters. Fewer of them on lighter graphics settings.
 */
const base = { plain: true, hairStyle: "short-messy", sole: "#eeeeee", headphones: "#222222", headphonesAccent: "#222222", logo: "#222222" } as const;
const LOOKS: CharacterLook[] = [
  { ...base, skin: "#e9b892", hair: "#2b1d14", jacket: "#2d4a7a", jacketAccent: "#dfe6f0", hoodie: "#24395e", shirt: "#f1f1f1", pants: "#2a2d34", pantsAccent: "#2a2d34", shoe: "#f2f2f2", shoeAccent: "#c8c8c8" },
  { ...base, hairStyle: "long-wavy", skin: "#f0c7a6", hair: "#4a2e1d", jacket: "#b8423c", jacketAccent: "#f3d9c8", hoodie: "#9c3530", shirt: "#fafafa", pants: "#3b3f4a", pantsAccent: "#3b3f4a", shoe: "#ffffff", shoeAccent: "#d0d0d0" },
  { ...base, skin: "#d9a57e", hair: "#151210", jacket: "#5c6b3a", jacketAccent: "#cfd8b8", hoodie: "#4b5730", shirt: "#e9e4d8", pants: "#5a4a3a", pantsAccent: "#5a4a3a", shoe: "#3a3a3a", shoeAccent: "#777777" },
  { ...base, hairStyle: "long-wavy", skin: "#e6b48f", hair: "#1d1512", jacket: "#6a4c93", jacketAccent: "#e6dcf3", hoodie: "#57407a", shirt: "#f5f5f5", pants: "#23252b", pantsAccent: "#23252b", shoe: "#e8e8e8", shoeAccent: "#bdbdbd" },
  { ...base, skin: "#f2cdb0", hair: "#6b4a2b", jacket: "#e0a43a", jacketAccent: "#fff1d2", hoodie: "#c98d2c", shirt: "#ffffff", pants: "#2f3a52", pantsAccent: "#2f3a52", shoe: "#ffffff", shoeAccent: "#cccccc" },
];

type Mode = { kind: "hockey"; side: 1 | -1 } | { kind: "watch" } | { kind: "walk"; from: [number, number]; to: [number, number] };
interface Spec {
  id: string;
  look: CharacterLook;
  x: number;
  y: number;
  z: number;
  heading: number;
  scale: number;
  mode: Mode;
  minQuality: QualityLevel;
}

const RANK: Record<QualityLevel, number> = { low: 0, medium: 1, high: 2 };
const reach = AIR_HOCKEY_SIZE.x / 2 + 0.32;

/** Two players at the middle air-hockey table (wherever the manager put it; none if it is hidden). */
function hockeyPlayers(): Spec[] {
  const tables = worldItems().filter((i) => i.kind === "air-hockey" && i.env === "amusement" && i.level === "ground");
  const t = tables.find((i) => i.id === "air-hockey-2") ?? tables[0];
  if (!t) return [];
  const [ax, az] = toWorldXZ(t, -reach, 0);
  const [bx, bz] = toWorldXZ(t, reach, 0);
  return [
    { id: "hockey-a", look: LOOKS[0], x: ax, y: 0, z: az, heading: Math.PI / 2 + t.rotY, scale: 1.0, mode: { kind: "hockey", side: -1 }, minQuality: "low" },
    { id: "hockey-b", look: LOOKS[1], x: bx, y: 0, z: bz, heading: -Math.PI / 2 + t.rotY, scale: 0.95, mode: { kind: "hockey", side: 1 }, minQuality: "low" },
  ];
}

export const visitorSpecs = (): Spec[] => [...hockeyPlayers(), ...OTHERS];

const OTHERS: Spec[] = [
  { id: "walker", look: LOOKS[2], x: 0.85, y: 0, z: 6.5, heading: Math.PI, scale: 1.03, mode: { kind: "walk", from: [0.85, 6.8], to: [0.85, -2.2] }, minQuality: "medium" },
  { id: "watch-a", look: LOOKS[3], x: -2.6, y: UPPER_Y, z: FOOT_POOL.zMax + 0.85, heading: Math.PI, scale: 0.94, mode: { kind: "watch" }, minQuality: "medium" },
  { id: "watch-b", look: LOOKS[4], x: -1.6, y: UPPER_Y, z: FOOT_POOL.zMax + 0.95, heading: Math.PI + 0.25, scale: 1.0, mode: { kind: "watch" }, minQuality: "high" },
];

export function Visitors({ quality, castShadow }: { quality: QualityLevel; castShadow: boolean }) {
  const list = visitorSpecs().filter((v) => RANK[quality] >= RANK[v.minQuality]);
  return (
    <>
      {list.map((v, i) => (
        <Visitor key={v.id} spec={v} seed={i * 1.7} castShadow={castShadow} />
      ))}
    </>
  );
}

const PUSH_R = 0.48;
const WALK_SPEED = 1.05;

function Visitor({ spec, seed, castShadow }: { spec: Spec; seed: number; castShadow: boolean }) {
  const rig = useMemo(() => {
    const r = buildToonCharacter(spec.look, castShadow);
    r.root.scale.multiplyScalar(spec.scale);
    const baked = bakeColors(r.root, castShadow);
    return { ...r, dispose: () => (r.dispose(), baked.forEach((g) => g.dispose())) };
  }, [spec.look, spec.scale, castShadow]);
  useEffect(() => () => rig.dispose(), [rig]);
  const rtRef = useRuntimeRef();
  const st = useRef({ x: spec.x, z: spec.z, heading: spec.heading, t: seed, phase: 0, leg: 0, wait: 0 });
  const pose = useRef<Pose>(neutralPose());
  const target = useRef<Pose>(neutralPose());
  const input = useRef<AnimInput>({ state: "idle", time: 0, phase: 0, speed: 0, turnRate: 0, interact: 0 });

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const s = st.current;
    s.t += dt;
    const p = rtRef.current.player;
    const sameFloor = Math.abs(p.y - spec.y) < 1.2;
    const a = input.current;
    a.time = s.t;
    a.speed = 0;
    a.state = "idle";
    let headY = 0;

    if (spec.mode.kind === "walk") {
      const m = spec.mode;
      const goal = s.leg === 0 ? m.to : m.from;
      const dx = goal[0] - s.x;
      const dz = goal[1] - s.z;
      const d = Math.hypot(dx, dz);
      const fx = Math.sin(s.heading);
      const fz = Math.cos(s.heading);
      const px = p.x - s.x;
      const pz = p.z - s.z;
      const blocked = sameFloor && Math.hypot(px, pz) < 1.6 && px * fx + pz * fz > 0;
      if (s.wait > 0) s.wait -= dt;
      else if (d < 0.15) {
        s.leg = 1 - s.leg;
        s.wait = 1.5 + Math.random() * 2;
      } else if (!blocked) {
        const want = Math.atan2(dx, dz);
        let dh = want - s.heading;
        dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        s.heading += dh * (1 - Math.exp(-dt * 5));
        if (Math.abs(dh) < 0.6) {
          const step = Math.min(d, WALK_SPEED * dt);
          s.x += Math.sin(s.heading) * step;
          s.z += Math.cos(s.heading) * step;
          s.phase += step * 3.1;
          a.state = "walk";
          a.speed = WALK_SPEED;
        }
      }
      if (blocked) headY = Math.atan2(px, pz) - s.heading; // look at the player
    }

    targetPose({ ...a, phase: s.phase }, target.current);
    const tp = target.current;
    if (spec.mode.kind === "hockey") {
      // leaning over the table, mallet hand sweeping across the goal
      const k = Math.sin(s.t * 4.2 + seed) * 0.5 + Math.sin(s.t * 7.3 + seed * 2) * 0.2;
      tp.lean = 0.32;
      tp.kneeL = tp.kneeR = 0.22;
      tp.thighL = tp.thighR = 0.12;
      tp.armR = -0.95 + Math.abs(k) * 0.2;
      tp.armOutR = 0.15 + k * 0.35;
      tp.elbowR = 0.5;
      tp.armL = -0.35;
      tp.elbowL = 0.6;
      tp.headX = 0.25;
      tp.twist = k * 0.12;
      if (Math.sin(s.t * 0.37 + seed) > 0.97) tp.armL = -1.4; // small cheer now and then
    } else if (spec.mode.kind === "watch") {
      tp.headY = Math.sin(s.t * 0.6 + seed) * 0.45;
      tp.headX = 0.12;
      tp.armL = tp.armR = -0.25;
      tp.elbowL = tp.elbowR = 1.3;
      tp.armOutL = tp.armOutR = -0.15;
    }
    if (headY) tp.headY = Math.max(-0.9, Math.min(0.9, Math.atan2(Math.sin(headY), Math.cos(headY))));
    blendPose(pose.current, target.current, dt, a.state === "walk" ? 14 : 8);
    applyPose(rig, pose.current, s.t);
    place(rig.root, s.x, spec.y, s.z, s.heading);

    // the player cannot walk through visitors: push them out of a small circle
    if (sameFloor) {
      const dx = p.x - s.x;
      const dz = p.z - s.z;
      const d = Math.hypot(dx, dz);
      if (d < PUSH_R && d > 1e-4) {
        p.x = s.x + (dx / d) * PUSH_R;
        p.z = s.z + (dz / d) * PUSH_R;
      }
    }
  });

  return <primitive object={rig.root} />;
}

let visitorMat: THREE.MeshToonMaterial | null = null;

/**
 * Fewer draw calls for background figures: inside each joint, all plain-coloured parts become one
 * mesh with the colours baked into the vertices (one shared material for every visitor). Small
 * textured / transparent decals are dropped. The joints stay, so the figure still animates.
 */
function bakeColors(root: THREE.Object3D, castShadow: boolean) {
  visitorMat ??= new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
  const owned: THREE.BufferGeometry[] = [];
  const groups: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) groups.push(o);
  });
  for (const g of groups) {
    const meshes = g.children.filter((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh[];
    if (!meshes.length) continue;
    const parts: THREE.BufferGeometry[] = [];
    for (const m of meshes) {
      const mat = m.material as THREE.MeshBasicMaterial;
      g.remove(m);
      if (mat.map || mat.transparent || !g.visible) continue;
      m.updateMatrix();
      const geo = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix);
      for (const k of Object.keys(geo.attributes)) if (k !== "position" && k !== "normal") geo.deleteAttribute(k);
      const n = geo.attributes.position.count;
      const col = new Float32Array(n * 3);
      const c = mat.color;
      for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
      geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      parts.push(geo);
    }
    if (!parts.length) continue;
    const merged = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    if (!merged) continue;
    owned.push(merged);
    const mesh = new THREE.Mesh(merged, visitorMat);
    mesh.castShadow = castShadow;
    g.add(mesh);
  }
  return owned;
}

function place(o: THREE.Object3D, x: number, y: number, z: number, heading: number) {
  o.position.set(x, y, z);
  o.rotation.y = heading;
}

/** For tests: where the visitors stand (static ones). */
export function visitorSpots() {
  return visitorSpecs().map((v) => new THREE.Vector3(v.x, v.y, v.z));
}
