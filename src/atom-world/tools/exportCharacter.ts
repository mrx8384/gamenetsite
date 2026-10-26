import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { type AnimInput, neutralPose, type Pose, targetPose } from "../characters/CharacterAnimations";
import { applyPose, buildToonCharacter, type ToonRig } from "../characters/buildToonCharacter";
import { type CharacterId, characters } from "../data/characters";

/**
 * Builds the ATOM character as a real rigged asset and exports it as GLB:
 * - every joint of the procedural rig becomes a bone (Hips, LeftUpLeg, LeftLeg, Spine, Head, …)
 * - all parts are merged into ONE skinned mesh with vertex colours (+ one mesh per decal texture),
 *   each vertex skinned to its joint
 * - the procedural poses are baked into looping / one-shot animation clips
 *   (Idle, Walk, Run, Turn, Jump, Fall, Stairs, Interact)
 * Used by scripts/export-characters.mjs through /atom-world/model-lab (dev tool).
 */

export const CLIP_SPEED = { walk: 2.6, run: 5.4 } as const;
const FPS = 30;

export function buildSkinnedCharacter(id: CharacterId) {
  const rig = buildToonCharacter(characters[id].look, true);
  nameJoints(rig);
  const root = rig.root;
  root.updateMatrixWorld(true);

  // ── bones mirror the joint groups
  const boneOf = new Map<THREE.Object3D, THREE.Bone>();
  const bones: THREE.Bone[] = [];
  const makeBone = (g: THREE.Object3D, parent: THREE.Bone | null) => {
    const b = new THREE.Bone();
    b.name = g.name || `Joint${bones.length}`;
    b.position.copy(g.position);
    b.quaternion.copy(g.quaternion);
    b.scale.copy(g.scale);
    if (parent) parent.add(b);
    boneOf.set(g, b);
    bones.push(b);
    for (const c of g.children) if (!(c as THREE.Mesh).isMesh) makeBone(c, b);
  };
  makeBone(root, null);
  const rootBone = bones[0];

  // ── geometry: rest pose in root space, skinned 100% to the parent joint
  const opaque: THREE.BufferGeometry[] = [];
  const decals = new Map<THREE.Material, THREE.BufferGeometry[]>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const parent = m.parent!;
    const boneIndex = bones.indexOf(boneOf.get(parent)!);
    const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
    const n = g.attributes.position.count;
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(new Uint16Array(n * 4).map((_, i) => (i % 4 === 0 ? boneIndex : 0)), 4));
    g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4));
    const mat = m.material as THREE.MeshToonMaterial | THREE.MeshBasicMaterial;
    if (mat instanceof THREE.MeshToonMaterial) {
      const c = mat.color;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
      g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      g.deleteAttribute("uv");
      opaque.push(g);
    } else {
      const list = decals.get(mat) ?? [];
      list.push(g);
      decals.set(mat, list);
    }
  });

  const asset = new THREE.Group();
  asset.name = `atom-${id}`;
  asset.add(rootBone);
  asset.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);

  const body = new THREE.SkinnedMesh(
    mergeGeometries(opaque, false)!,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0, name: `${id}-body` }),
  );
  body.name = `${id}-body`;
  asset.add(body);
  body.bind(skeleton);

  let k = 0;
  for (const [mat, list] of decals) {
    const src = mat as THREE.MeshBasicMaterial;
    if (!src.map) continue; // skip untextured overlays (blush)
    const m = new THREE.SkinnedMesh(
      mergeGeometries(list, false)!,
      new THREE.MeshStandardMaterial({ map: src.map, transparent: true, alphaTest: 0.35, roughness: 0.8, name: `${id}-print-${k}` }),
    );
    m.name = `${id}-print-${k++}`;
    asset.add(m);
    m.bind(skeleton);
  }

  const clips = bakeClips(rig);
  return { asset, clips, rig };
}

/** Stable, humanoid-style bone names (also what the clips target). */
function nameJoints(r: ToonRig) {
  r.root.name = "Root";
  r.body.name = "Body";
  r.legL.parent!.name = "Hips";
  r.legL.name = "LeftUpLeg";
  r.legR.name = "RightUpLeg";
  r.kneeL.name = "LeftLeg";
  r.kneeR.name = "RightLeg";
  r.kneeL.children.find((c) => !(c as THREE.Mesh).isMesh)!.name = "LeftFoot";
  r.kneeR.children.find((c) => !(c as THREE.Mesh).isMesh)!.name = "RightFoot";
  r.torso.name = "Spine";
  r.armL.name = "LeftArm";
  r.armR.name = "RightArm";
  r.elbowL.name = "LeftForeArm";
  r.elbowR.name = "RightForeArm";
  r.head.name = "Head";
  r.eyes[0].name = "RightEye";
  r.eyes[1].name = "LeftEye";
}

type ClipDef = { name: string; duration: number; pose: (u: number, out: Pose) => Pose; blinkAt?: number; once?: boolean };

const P = (state: AnimInput["state"], phase: number, time = 0, extra: Partial<AnimInput> = {}) =>
  targetPose({ state, time, phase, speed: 0, turnRate: 0, interact: 0, ...extra });

const CLIPS: ClipDef[] = [
  {
    name: "Idle",
    duration: 4,
    blinkAt: 3.6,
    pose: (u, o) => {
      const w = u * Math.PI * 2;
      Object.assign(o, neutralPose());
      o.breathe = Math.sin(w * 2) * 0.012;
      o.armL = Math.sin(w) * 0.03;
      o.armR = -Math.sin(w) * 0.03;
      o.headY = Math.sin(w) * 0.22;
      o.headX = Math.sin(w * 2) * 0.03;
      o.roll = Math.sin(w) * 0.015;
      return o;
    },
  },
  { name: "Walk", duration: (Math.PI * 2) / (CLIP_SPEED.walk * 3.1), pose: (u, o) => Object.assign(o, P("walk", u * Math.PI * 2)) },
  { name: "Run", duration: (Math.PI * 2) / (CLIP_SPEED.run * 2.35), pose: (u, o) => Object.assign(o, P("run", u * Math.PI * 2)) },
  { name: "Stairs", duration: (Math.PI * 2) / (CLIP_SPEED.walk * 3.1), pose: (u, o) => Object.assign(o, P("stairs", u * Math.PI * 2)) },
  { name: "Turn", duration: (Math.PI * 2) / 9, pose: (u, o) => Object.assign(o, P("turn", 0, (u * Math.PI * 2) / 9)) },
  {
    name: "Jump",
    duration: 0.45,
    once: true,
    pose: (u, o) => {
      const a = neutralPose();
      const b = P("jump", 0);
      const k = Math.min(1, u / 0.6);
      for (const key in a) (o as unknown as Record<string, number>)[key] = (a as unknown as Record<string, number>)[key] * (1 - k) + (b as unknown as Record<string, number>)[key] * k;
      return o;
    },
  },
  {
    name: "Fall",
    duration: 1,
    pose: (u, o) => {
      Object.assign(o, P("fall", 0));
      o.armOutL += Math.sin(u * Math.PI * 2) * 0.08;
      o.armOutR += Math.sin(u * Math.PI * 2) * 0.08;
      return o;
    },
  },
  { name: "Interact", duration: 0.9, once: true, pose: (u, o) => Object.assign(o, P("interact", 0, 0, { interact: u })) },
];

/** Samples the procedural poses into keyframe tracks on the named joints. */
function bakeClips(rig: ToonRig): THREE.AnimationClip[] {
  const animated: THREE.Object3D[] = [rig.body, rig.torso, rig.head, rig.legL, rig.legR, rig.kneeL, rig.kneeR, rig.armL, rig.armR, rig.elbowL, rig.elbowR, ...rig.eyes];
  const out: THREE.AnimationClip[] = [];
  const pose = neutralPose();
  for (const def of CLIPS) {
    const frames = Math.max(2, Math.round(def.duration * FPS) + 1);
    const times: number[] = [];
    const quats = animated.map(() => [] as number[]);
    const bodyPos: number[] = [];
    const torsoScale: number[] = [];
    const eyeScale = rig.eyes.map(() => [] as number[]);
    for (let f = 0; f < frames; f++) {
      const u = f / (frames - 1);
      const t = u * def.duration;
      times.push(t);
      // looping clips end exactly on their first frame
      def.pose(!def.once && f === frames - 1 ? 0 : u, pose);
      // blink only where the clip asks for it
      applyPose(rig, pose, def.blinkAt !== undefined && Math.abs(t - def.blinkAt) < 0.07 ? 3.6 : 0);
      animated.forEach((o, i) => quats[i].push(o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w));
      bodyPos.push(rig.body.position.x, rig.body.position.y, rig.body.position.z);
      torsoScale.push(rig.torso.scale.x, rig.torso.scale.y, rig.torso.scale.z);
      rig.eyes.forEach((e, i) => eyeScale[i].push(e.scale.x, e.scale.y, e.scale.z));
    }
    const tracks: THREE.KeyframeTrack[] = animated.map((o, i) => new THREE.QuaternionKeyframeTrack(`${o.name}.quaternion`, times, quats[i]));
    tracks.push(new THREE.VectorKeyframeTrack(`${rig.body.name}.position`, times, bodyPos));
    tracks.push(new THREE.VectorKeyframeTrack(`${rig.torso.name}.scale`, times, torsoScale));
    rig.eyes.forEach((e, i) => tracks.push(new THREE.VectorKeyframeTrack(`${e.name}.scale`, times, eyeScale[i])));
    out.push(new THREE.AnimationClip(def.name, def.duration, tracks));
  }
  applyPose(rig, neutralPose(), 0);
  return out;
}

export async function exportCharacterGlb(id: CharacterId): Promise<ArrayBuffer> {
  const { asset, clips, rig } = buildSkinnedCharacter(id);
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(asset, { binary: true, animations: clips, onlyVisible: true, maxTextureSize: 512 });
  rig.dispose();
  return result as ArrayBuffer;
}
