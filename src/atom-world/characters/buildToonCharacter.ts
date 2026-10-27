import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { CharacterLook } from "../data/characters";
import { atomIconTexture, clothingLogoTexture, toonGradient } from "../systems/textures";
import type { Pose } from "./CharacterAnimations";

/**
 * ⚠️ TEMPORARY CHARACTER MODEL.
 * A stylised stand-in assembled from primitives, coloured after the official character sheets
 * (/public/atom-world/references/characters). It has a joint hierarchy (hips, knees, shoulders,
 * elbows, torso, head) so it can be animated, but it is NOT the final character: the final rigged
 * GLB replaces it via data/characters.ts → `model`.
 */
export interface ToonRig {
  root: THREE.Group;
  body: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  kneeL: THREE.Group;
  kneeR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  elbowL: THREE.Group;
  elbowR: THREE.Group;
  eyes: THREE.Group[];
  dispose: () => void;
}

export const TOON_SCALE = 0.93;

/**
 * Body shapes for the background people (the two ATOM characters always use "average"):
 * girth = width of the torso and arms, legs = thickness of the legs, height = overall height.
 */
export type BodyBuild = "average" | "heavy" | "slim" | "tall" | "short";
export const BUILDS: Record<BodyBuild, { girth: number; legs: number; height: number; belly: boolean }> = {
  average: { girth: 1, legs: 1, height: 1, belly: false },
  heavy: { girth: 1.42, legs: 1.3, height: 0.98, belly: true },
  slim: { girth: 0.78, legs: 0.82, height: 1.04, belly: false },
  tall: { girth: 0.94, legs: 0.95, height: 1.13, belly: false },
  short: { girth: 1.06, legs: 1.05, height: 0.86, belly: false },
};

export function buildToonCharacter(look: CharacterLook, castShadow = true, build: BodyBuild = "average"): ToonRig {
  const geometries: THREE.BufferGeometry[] = [];
  const materials = new Map<string, THREE.Material>();
  const textures: THREE.Texture[] = [];
  const gradient = toonGradient();
  textures.push(gradient);

  const geo = <G extends THREE.BufferGeometry>(g: G) => {
    geometries.push(g);
    return g;
  };
  const toon = (color: string) => {
    let m = materials.get(color);
    if (!m) {
      m = new THREE.MeshToonMaterial({ color, gradientMap: gradient });
      materials.set(color, m);
    }
    return m;
  };
  const decal = (tex: THREE.Texture, key: string) => {
    let m = materials.get(key);
    if (!m) {
      textures.push(tex);
      m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
      materials.set(key, m);
    } else tex.dispose();
    return m;
  };
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, pos: [number, number, number] = [0, 0, 0], scale?: [number, number, number], rot?: [number, number, number]) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(...pos);
    if (scale) o.scale.set(...scale);
    if (rot) o.rotation.set(...rot);
    o.castShadow = castShadow && !(m instanceof THREE.MeshBasicMaterial);
    parent.add(o);
    return o;
  };
  const group = (parent: THREE.Object3D, pos: [number, number, number] = [0, 0, 0]) => {
    const g = new THREE.Group();
    g.position.set(...pos);
    parent.add(g);
    return g;
  };

  // Shared geometries
  const sphere = geo(new THREE.SphereGeometry(1, 20, 14));
  const sphereLo = geo(new THREE.SphereGeometry(1, 10, 8));
  const box = geo(new THREE.BoxGeometry(1, 1, 1));
  const cyl = geo(new THREE.CylinderGeometry(1, 1, 1, 18));
  const plane = geo(new THREE.PlaneGeometry(1, 1));
  // baggy cargo thighs tapering to elasticated cuffs; arms long enough to reach mid-thigh (sheet)
  const thighGeo = geo(new THREE.CapsuleGeometry(0.094, 0.22, 6, 14));
  const shinGeo = geo(new THREE.CapsuleGeometry(0.074, 0.22, 6, 14));
  const upperArmGeo = geo(new THREE.CapsuleGeometry(0.063, 0.22, 6, 12));
  const foreArmGeo = geo(new THREE.CapsuleGeometry(0.056, 0.2, 6, 12));
  const jacketGeo = geo(new THREE.CapsuleGeometry(0.17, 0.26, 8, 18));

  const root = new THREE.Group();
  root.name = "toon-character";
  const scaled = group(root);
  scaled.scale.setScalar(TOON_SCALE);
  const body = group(scaled);
  const hipY = 0.74;

  const skin = toon(look.skin);
  const hair = toon(look.hair);

  // ── Pelvis
  const pelvis = group(body, [0, hipY, 0]);
  mesh(sphere, toon(look.pants), pelvis, [0, 0, 0], [0.17, 0.12, 0.13]);

  // ── Legs (cargo pants + chunky high-top sneakers)
  const makeLeg = (side: 1 | -1) => {
    const leg = group(pelvis, [0.095 * side, 0, 0]);
    mesh(thighGeo, toon(look.pants), leg, [0, -0.17, 0]);
    // cargo pocket with flap, hanging accent strap
    mesh(box, toon(look.pants), leg, [0.083 * side, -0.24, 0.01], [0.04, 0.13, 0.11]);
    mesh(box, toon(look.pantsAccent), leg, [0.084 * side, -0.18, 0.01], [0.044, 0.02, 0.112]);
    mesh(box, toon(look.pantsAccent), leg, [0.106 * side, -0.33, 0.05], [0.008, 0.16, 0.022]);
    const knee = group(leg, [0, -0.36, 0]);
    mesh(shinGeo, toon(look.pants), knee, [0, -0.15, 0]);
    mesh(cyl, toon(look.pants), knee, [0, -0.28, 0], [0.072, 0.05, 0.072]);
    if (look.hairStyle === "long-wavy") mesh(box, toon(look.pantsAccent), knee, [0.078 * side, -0.12, 0], [0.012, 0.22, 0.05]);
    const ankle = group(knee, [0, -0.33, 0]);
    mesh(box, toon(look.sole), ankle, [0, -0.025, 0.04], [0.13, 0.05, 0.28]);
    mesh(box, toon(look.shoe), ankle, [0, 0.05, 0.015], [0.12, 0.11, 0.21]);
    mesh(sphere, toon(look.shoe), ankle, [0, 0.02, 0.12], [0.062, 0.05, 0.07]);
    mesh(cyl, toon(look.shoe), ankle, [0, 0.12, -0.01], [0.068, 0.07, 0.068]);
    mesh(box, toon(look.shoeAccent), ankle, [0, 0.03, -0.075], [0.125, 0.07, 0.05]);
    mesh(box, toon(look.shoeAccent), ankle, [0.062 * side, 0.06, 0.03], [0.006, 0.035, 0.14]);
    const icon = decal(atomIconTexture(look.shoeAccent), `shoe-icon-${look.shoeAccent}`);
    mesh(plane, icon, ankle, [0.0615 * side, 0.1, -0.02], [0.06, 0.06, 1], [0, (Math.PI / 2) * side, 0]);
    return { leg, knee };
  };
  const L = makeLeg(1);
  const R = makeLeg(-1);

  // ── Torso (open jacket over hoodie)
  const torso = group(body, [0, hipY, 0]);
  const jacket = toon(look.jacket);
  const accent = toon(look.jacketAccent);
  mesh(jacketGeo, jacket, torso, [0, 0.29, 0], [1.1, 1, 0.8]);
  mesh(cyl, accent, torso, [0, 0.07, 0], [0.19, 0.05, 0.15]);
  mesh(box, toon(look.hoodie), torso, [0, 0.3, 0.115], [0.13, 0.36, 0.04]);
  mesh(box, toon(look.shirt), torso, [0, 0.45, 0.118], [0.09, 0.08, 0.04]);
  for (const sx of [-1, 1]) mesh(box, accent, torso, [0.068 * sx, 0.29, 0.128], [0.012, 0.4, 0.012]);
  // hoodie drawstrings
  for (const sx of [-1, 1]) mesh(box, accent, torso, [0.03 * sx, 0.38, 0.14], [0.008, 0.13, 0.008]);
  // ATOM logo on the wearer's left chest and on the back (not on plain visitors)
  const plain = !!look.plain;
  const logo = decal(clothingLogoTexture(look.logo, look.hairStyle === "long-wavy" ? "#2a2a2a" : "#f2f2f2"), `logo-${look.logo}`);
  if (!plain) mesh(plane, logo, torso, [0.1, 0.37, 0.139], [0.11, 0.11, 1], [0, 0.18, 0]);
  const logoBack = decal(clothingLogoTexture(look.logo, look.hairStyle === "long-wavy" ? "#2a2a2a" : "#f2f2f2"), `logo-back-${look.logo}`);
  if (!plain && look.hairStyle !== "long-wavy") mesh(plane, logoBack, torso, [0, 0.35, -0.138], [0.2, 0.2, 1], [0, Math.PI, 0]);
  // hood resting behind the neck (outer jacket colour, accent lining)
  mesh(sphere, look.hairStyle === "long-wavy" ? toon(look.hoodie) : jacket, torso, [0, 0.54, -0.08], [0.15, 0.09, 0.1]);
  mesh(sphere, toon(look.hairStyle === "long-wavy" ? look.hoodie : look.jacketAccent), torso, [0, 0.555, -0.03], [0.12, 0.06, 0.08]);

  // rounded backpack (girl's sheet shows one)
  if (!plain && look.hairStyle === "long-wavy") {
    mesh(sphere, toon(look.jacket), torso, [0, 0.31, -0.17], [0.13, 0.15, 0.065]);
    mesh(sphere, toon(look.jacketAccent), torso, [0, 0.24, -0.21], [0.09, 0.065, 0.03]);
    mesh(plane, logoBack, torso, [0, 0.36, -0.233], [0.1, 0.1, 1], [0, Math.PI, 0]);
    for (const sx of [-1, 1]) mesh(box, toon(look.headphones), torso, [0.11 * sx, 0.37, 0.13], [0.035, 0.26, 0.02]);
  }

  // ── Arms
  const makeArm = (side: 1 | -1) => {
    const arm = group(torso, [0.212 * side, 0.49, 0]);
    const sleeveTop = look.hairStyle === "long-wavy" ? accent : jacket;
    mesh(sphere, sleeveTop, arm, [0, -0.015, 0], [0.068, 0.06, 0.068]);
    mesh(upperArmGeo, sleeveTop, arm, [0, -0.15, 0]);
    if (look.hairStyle !== "long-wavy") mesh(cyl, accent, arm, [0, -0.2, 0], [0.067, 0.03, 0.067]);
    const elbow = group(arm, [0, -0.31, 0]);
    mesh(foreArmGeo, jacket, elbow, [0, -0.13, 0]);
    mesh(cyl, accent, elbow, [0, -0.255, 0], [0.06, 0.045, 0.06]);
    mesh(sphere, skin, elbow, [0, -0.32, 0.005], [0.05, 0.058, 0.045]);
    return { arm, elbow };
  };
  const AL = makeArm(1);
  const AR = makeArm(-1);

  // ── Neck + headphones
  mesh(cyl, skin, torso, [0, 0.6, 0.005], [0.055, 0.1, 0.055]);
  const phones = group(torso, [0, 0.58, 0.02]);
  phones.visible = !plain;
  phones.rotation.x = -0.25;
  const bandGeo = geo(new THREE.TorusGeometry(0.135, 0.022, 10, 28, Math.PI * 1.25));
  // arc centred behind the neck, open at the front where the cups sit
  const band = mesh(bandGeo, toon(look.headphones), phones, [0, 0, 0], undefined, [Math.PI / 2, 0, Math.PI * 0.875]);
  band.rotation.order = "XYZ";
  const cupIcon = decal(atomIconTexture(look.headphonesAccent, look.headphones), `cup-${look.headphonesAccent}`);
  for (const sx of [-1, 1]) {
    const cup = group(phones, [0.12 * sx, 0.02, 0.07]);
    cup.rotation.y = 0.5 * sx;
    mesh(cyl, toon(look.headphones), cup, [0, 0, 0], [0.068, 0.05, 0.068], [0, 0, Math.PI / 2]);
    mesh(cyl, toon(look.headphonesAccent), cup, [0.027 * sx, 0, 0], [0.05, 0.006, 0.05], [0, 0, Math.PI / 2]);
    mesh(plane, cupIcon, cup, [0.031 * sx, 0, 0], [0.07, 0.07, 1], [0, (Math.PI / 2) * sx, 0]);
  }

  // ── Head
  const head = group(torso, [0, 0.66, 0]);
  const face = group(head, [0, 0.17, 0]);
  mesh(sphere, skin, face, [0, 0, 0], [0.19, 0.2, 0.18]);
  for (const sx of [-1, 1]) mesh(sphere, skin, face, [0.185 * sx, -0.01, -0.01], [0.022, 0.045, 0.035]);
  mesh(sphere, toon(shade(look.skin, -0.06)), face, [0, -0.04, 0.178], [0.022, 0.02, 0.022]);
  const blush = new THREE.MeshBasicMaterial({ color: "#ff8f8f", transparent: true, opacity: 0.28, depthWrite: false });
  materials.set("blush", blush);
  for (const sx of [-1, 1]) mesh(sphere, blush, face, [0.105 * sx, -0.055, 0.135], [0.035, 0.022, 0.01]);
  const mouthGeo = geo(new THREE.TorusGeometry(0.038, 0.007, 6, 16, Math.PI * 0.75));
  mesh(mouthGeo, toon("#7b3a2c"), face, [0.005, -0.065, 0.165], undefined, [0.1, 0, Math.PI * 1.125 + 0.08]);

  const eyes: THREE.Group[] = [];
  const white = toon("#ffffff");
  const iris = toon("#4a2b1a");
  const pupil = toon("#140c08");
  for (const sx of [-1, 1]) {
    // big expressive cartoon eyes, thick dark brows (sheet)
    const eye = group(face, [0.073 * sx, 0.005, 0.15]);
    mesh(sphereLo, white, eye, [0, 0, 0], [0.05, 0.061, 0.022]);
    mesh(sphereLo, iris, eye, [0.004 * sx, -0.006, 0.013], [0.034, 0.042, 0.012]);
    mesh(sphereLo, pupil, eye, [0.004 * sx, -0.006, 0.021], [0.017, 0.021, 0.006]);
    mesh(sphereLo, white, eye, [0.016 * sx, 0.012, 0.026], [0.009, 0.009, 0.004]);
    mesh(box, hair, face, [0.075 * sx, 0.088, 0.163], [0.085, 0.022, 0.02], [0, 0, -0.18 * sx]);
    if (look.hairStyle === "long-wavy") mesh(box, toon("#1a110c"), face, [0.11 * sx, 0.05, 0.16], [0.03, 0.01, 0.01], [0, 0, 0.5 * sx]);
    eyes.push(eye);
  }

  // ── Hair
  const hairCap = geo(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.58));
  mesh(hairCap, hair, face, [0, 0.015, -0.012], [0.21, 0.222, 0.205], [-0.25, 0, 0]);
  if (look.hairStyle === "short-messy") {
    // voluminous messy black hair: layered tufts swept up and to the side, swoop over the forehead
    const tufts: [number, number, number, number, number, number, number, number][] = [
      // x, y, z, sx, sy, sz, rx, rz
      [0.0, 0.2, 0.04, 0.12, 0.08, 0.13, -0.2, 0.1],
      [-0.09, 0.2, 0.0, 0.06, 0.11, 0.07, -0.4, 0.5],
      [0.08, 0.21, -0.02, 0.06, 0.11, 0.07, -0.5, -0.45],
      [-0.02, 0.23, -0.07, 0.06, 0.1, 0.07, -0.9, 0.15],
      [0.05, 0.18, -0.13, 0.08, 0.1, 0.07, -1.3, -0.3],
      [-0.07, 0.16, -0.14, 0.08, 0.1, 0.07, -1.3, 0.35],
      [0.0, 0.05, -0.17, 0.15, 0.13, 0.07, -0.2, 0],
      [0.15, 0.1, -0.05, 0.06, 0.09, 0.08, 0, -0.8],
      [-0.15, 0.1, -0.04, 0.06, 0.09, 0.08, 0, 0.8],
      [0.17, 0.0, 0.0, 0.028, 0.07, 0.05, 0, -0.1],
      [-0.17, 0.0, 0.0, 0.028, 0.07, 0.05, 0, 0.1],
    ];
    for (const [x, y, z, sx, sy, sz, rx, rz] of tufts) mesh(sphereLo, hair, face, [x, y, z], [sx, sy, sz], [rx, 0, rz]);
    // swoop across the forehead (kept above the brows), with two locks falling forward
    mesh(sphereLo, hair, face, [0.02, 0.165, 0.135], [0.15, 0.055, 0.06], [0.3, 0, -0.25]);
    mesh(sphereLo, hair, face, [-0.07, 0.13, 0.155], [0.03, 0.055, 0.025], [0.5, 0, 0.6]);
    mesh(sphereLo, hair, face, [0.1, 0.14, 0.145], [0.03, 0.05, 0.025], [0.5, 0, -0.7]);
  } else {
    // long dark-brown wavy hair down the back and over the shoulders
    mesh(sphere, hair, face, [0, -0.1, -0.09], [0.2, 0.26, 0.13]);
    mesh(sphere, hair, face, [0, -0.32, -0.11], [0.2, 0.2, 0.09]);
    for (const sx of [-1, 1]) {
      mesh(sphereLo, hair, face, [0.17 * sx, -0.06, 0.01], [0.06, 0.13, 0.07]);
      mesh(sphereLo, hair, face, [0.19 * sx, -0.22, -0.02], [0.065, 0.12, 0.07]);
      mesh(sphereLo, hair, face, [0.17 * sx, -0.36, -0.04], [0.06, 0.1, 0.065]);
    }
    // side-swept fringe on the forehead (kept above the eyebrows)
    const fringe: [number, number, number, number][] = [[-0.1, 0.15, 0.13, 1.2], [-0.03, 0.165, 0.14, 1.35], [0.05, 0.16, 0.14, 1.45], [0.12, 0.12, 0.12, 0.6]];
    for (const [x, y, z, rz] of fringe) mesh(sphereLo, hair, face, [x, y, z], [0.03, 0.07, 0.035], [0.35, 0, rz]);
    if (look.hairClips) {
      const clip = toon(look.hairClips);
      mesh(box, clip, face, [-0.15, 0.13, 0.1], [0.06, 0.018, 0.018], [0, -0.6, 0.5]);
      mesh(box, clip, face, [-0.16, 0.09, 0.105], [0.06, 0.018, 0.018], [0, -0.6, 0.5]);
    }
  }

  // ── Body shape (wider / thinner torso and limbs, taller / shorter; the head keeps its size)
  const shape = BUILDS[build];
  if (shape.belly) mesh(sphere, jacket, torso, [0, 0.22, 0.07], [0.165, 0.17, 0.15]);
  if (build !== "average") {
    torso.scale.x = shape.girth;
    torso.scale.z = shape.girth * (shape.belly ? 1.12 : 1);
    head.scale.set(1 / torso.scale.x, 1, 1 / torso.scale.z);
    for (const leg of [L.leg, R.leg]) {
      leg.scale.x = leg.scale.z = shape.legs;
      leg.position.x *= 0.55 + 0.45 * shape.girth;
    }
    scaled.scale.y *= shape.height;
  }

  mergeStatic(root, geometries);

  return {
    root,
    body,
    torso,
    head,
    legL: L.leg,
    legR: R.leg,
    kneeL: L.knee,
    kneeR: R.knee,
    armL: AL.arm,
    armR: AR.arm,
    elbowL: AL.elbow,
    elbowR: AR.elbow,
    eyes,
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}

/** Applies a pose (see CharacterAnimations) plus blinking to the rig. */
export function applyPose(rig: ToonRig, p: Pose, time: number) {
  rig.legL.rotation.x = -p.thighL;
  rig.legR.rotation.x = -p.thighR;
  rig.kneeL.rotation.x = p.kneeL;
  rig.kneeR.rotation.x = p.kneeR;
  rig.armL.rotation.set(-p.armL, 0, p.armOutL);
  rig.armR.rotation.set(-p.armR, 0, -p.armOutR);
  rig.elbowL.rotation.x = -p.elbowL;
  rig.elbowR.rotation.x = -p.elbowR;
  rig.torso.rotation.set(p.lean, p.twist, 0);
  rig.torso.scale.y = 1 + p.breathe;
  rig.body.rotation.z = p.roll;
  rig.body.position.y = p.bob;
  rig.head.rotation.set(p.headX, p.headY - p.twist, 0);
  // blink every ~3.5 s
  const b = (time % 3.7) / 3.7;
  const lid = b > 0.965 ? 0.12 : 1;
  for (const e of rig.eyes) e.scale.y = lid;
}

/**
 * Draw-call optimisation: inside every joint group, meshes sharing a material are merged into one
 * (their local transforms are baked in). The joint hierarchy stays intact for animation.
 */
function mergeStatic(root: THREE.Object3D, owned: THREE.BufferGeometry[]) {
  const groups: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) groups.push(o);
  });
  for (const g of groups) {
    const byMat = new Map<THREE.Material, THREE.Mesh[]>();
    for (const c of g.children) {
      const m = c as THREE.Mesh;
      if (!m.isMesh) continue;
      const mat = m.material as THREE.Material;
      const list = byMat.get(mat) ?? [];
      list.push(m);
      byMat.set(mat, list);
    }
    for (const [mat, list] of byMat) {
      if (list.length < 2) continue;
      const parts = list.map((m) => {
        m.updateMatrix();
        return m.geometry.clone().applyMatrix4(m.matrix);
      });
      const merged = mergeGeometries(parts, false);
      parts.forEach((p) => p.dispose());
      if (!merged) continue;
      owned.push(merged);
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = list.some((m) => m.castShadow);
      list.forEach((m) => g.remove(m));
      g.add(mesh);
    }
  }
}

function shade(hex: string, amount: number) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amount);
  return `#${c.getHexString()}`;
}
