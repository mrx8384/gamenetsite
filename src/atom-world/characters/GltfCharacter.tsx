"use client";

import { useFrame, useLoader } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { type AnimState, type CharacterModelDef, characters } from "../data/characters";
import { toonGradient } from "../systems/textures";
import type { AnimSource } from "./CharacterModel";

/** Self-hosted decoders: compressed GLBs (Draco / Meshopt) never need a CDN. */
const DRACO_PATH = "/atom-world/decoders/draco/";
let draco: DRACOLoader | null = null;

function configureLoader(loader: GLTFLoader) {
  if (!draco) {
    draco = new DRACOLoader();
    draco.setDecoderPath(DRACO_PATH);
  }
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);
}

let ramp: THREE.Texture | null = null;
/** Same 4-step shading ramp as the procedural characters. */
function toToon(src: THREE.MeshStandardMaterial) {
  ramp ??= toonGradient();
  return new THREE.MeshToonMaterial({
    name: src.name,
    color: src.color,
    map: src.map,
    vertexColors: src.vertexColors,
    transparent: src.transparent,
    alphaTest: src.alphaTest,
    gradientMap: ramp,
  });
}

/** Frees the cached character GLBs (call when leaving the 3D world). */
export function releaseCharacterModels() {
  const urls = Object.values(characters)
    .map((c) => c.model?.url)
    .filter((u): u is string => !!u);
  useLoader.clear(GLTFLoader, urls);
}

/** States played once and held (the rest loop). */
const ONE_SHOT: AnimState[] = ["jump", "interact"];

/**
 * Final character from a rigged GLB/GLTF (phase 3). Delivery spec: docs/CHARACTER_MODEL_BRIEF.md.
 * - normalises height and puts the feet on y = 0, fixes the facing direction
 * - cross-fades between clips by AnimState, with fallbacks for missing clips
 * - walk / run playback speed follows the real ground speed (no foot sliding)
 */
export function GltfCharacter({ model, anim, castShadow }: { model: CharacterModelDef; anim: AnimSource; castShadow?: boolean }) {
  const gltf = useLoader(GLTFLoader, model.url, configureLoader);

  const { root, mixer, actions } = useMemo(() => {
    const scene = cloneSkinned(gltf.scene) as THREE.Group;
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = !!castShadow;
        // skinned meshes animate outside their bind-pose bounds
        m.frustumCulled = false;
        if (model.toon) m.material = toToon(m.material as THREE.MeshStandardMaterial);
      }
    });
    scene.updateMatrixWorld(true);
    const bbox = new THREE.Box3().setFromObject(scene);
    const h = bbox.max.y - bbox.min.y || 1;
    const s = model.height > 0 ? model.height / h : 1;
    const wrapper = new THREE.Group();
    const inner = new THREE.Group();
    inner.scale.setScalar(s);
    inner.position.y = -bbox.min.y * s;
    if (model.forward === "-z") inner.rotation.y = Math.PI;
    inner.add(scene);
    wrapper.add(inner);

    const mixer = new THREE.AnimationMixer(scene);
    const actions = new Map<AnimState, THREE.AnimationAction>();
    for (const [state, clipName] of Object.entries(model.clips) as [AnimState, string][]) {
      const clip = gltf.animations.find((c) => c.name === clipName);
      if (!clip) continue;
      const action = mixer.clipAction(clip);
      if (ONE_SHOT.includes(state)) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      actions.set(state, action);
    }
    return { root: wrapper, mixer, actions };
  }, [gltf, model, castShadow]);

  const current = useRef<{ state: AnimState; action: THREE.AnimationAction } | null>(null);
  useEffect(
    () => () => {
      // (no uncacheRoot: in dev, React re-runs effects and the same actions are reused)
      mixer.stopAllAction();
      current.current = null;
    },
    [mixer],
  );

  useFrame((_, delta) => {
    const a = anim.current;
    const st = a.state;
    const fallback: AnimState = st === "run" ? (actions.has("walk") ? "walk" : "idle") : st === "stairs" ? "walk" : st === "fall" ? "jump" : "idle";
    const resolvedState: AnimState = actions.has(st) ? st : actions.has(fallback) ? fallback : "idle";
    const next = actions.get(resolvedState) ?? null;
    if (next && next !== current.current?.action) {
      next.reset().setEffectiveWeight(1).fadeIn(0.18).play();
      current.current?.action.fadeOut(0.18);
      current.current = { state: resolvedState, action: next };
    }
    // match the cycle to the real ground speed
    if (current.current) {
      const cs = current.current.state;
      const ref = cs === "run" ? model.clipSpeed?.run : cs === "walk" || cs === "stairs" ? model.clipSpeed?.walk : undefined;
      current.current.action.timeScale = ref ? THREE.MathUtils.clamp(a.speed / ref, 0.5, 1.8) : 1;
    }
    mixer.update(Math.min(delta, 0.05));
  });

  return <primitive object={root} />;
}
