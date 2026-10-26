"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { createElement, lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { CharacterController } from "../characters/CharacterController";
import { characters } from "../data/characters";
import { InteractionSystem } from "../interactions/InteractionSystem";
import { inputBlocked as inputBlockedNow, savePref, useWorld, worldStore } from "../store";
import { audio } from "../systems/AudioManager";
import { releasePhotoTextures } from "../systems/AssetLoader";
import { CameraController } from "../systems/CameraController";
import { QUALITY_PRESETS, type QualityLevel, type QualityPreset } from "../systems/QualityManager";
import { ENVIRONMENTS, preloadDistanceTo } from "../world/registry";
import type { EnvironmentDef, EnvSceneProps } from "../world/types";
import { RuntimeContext, type RuntimeRef, useRuntimeRef } from "../systems/runtime";

/** The 3D game view. Remounts (new WebGL context) when the quality preset changes. */
export function GameCanvas({ runtime }: { runtime: RuntimeRef }) {
  const quality = useWorld((s) => s.quality);
  const characterId = useWorld((s) => s.character);
  const ready = useWorld((s) => s.ready);
  // a mini-game covers the screen: stop drawing the 3D world (battery, GPU) until it closes
  const miniGame = useWorld((s) => s.miniGame !== null);
  const preset = QUALITY_PRESETS[quality];
  const [hidden, setHidden] = useState(false);

  useEffect(() => () => releasePhotoTextures(), []);

  // pause rendering and sound while the tab is in the background (battery, heat)
  useEffect(() => {
    const onVis = () => {
      setHidden(document.hidden);
      if (document.hidden) audio.pause();
      else audio.resume();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <Canvas
      key={quality}
      frameloop={hidden || miniGame ? "never" : "always"}
      shadows={preset.shadows}
      dpr={[1, preset.maxDpr]}
      gl={{ antialias: preset.antialias, powerPreference: "high-performance", stencil: false }}
      camera={{ fov: 55, near: 0.1, far: 60, position: [0, 3, 14] }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        // the GPU dropped the context (memory pressure, driver reset): offer a reload on a lighter preset
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          worldStore.set({ contextLost: true });
        });
        if (new URLSearchParams(window.location.search).has("debug")) {
          (window as unknown as { __atomWorldRenderer?: unknown }).__atomWorldRenderer = gl;
          (window as unknown as { __atomWorldScene?: unknown }).__atomWorldScene = scene;
        }
      }}
      style={{ position: "absolute", inset: 0, touchAction: "none" }}
    >
      <color attach="background" args={["#0b0c0d"]} />
      <RuntimeContext.Provider value={runtime}>
        <Lights preset={preset} />
        {preset.envMap && <RoomReflections />}
        {/* every environment is its own module; the start one loads first, the others when needed */}
        <Suspense fallback={null}>
          {ENVIRONMENTS.filter((e) => e.load === "initial").map((e) => (
            <EnvSlot key={e.id} env={e} quality={quality} preset={preset} />
          ))}
          <Ready />
        </Suspense>
        {ready &&
          ENVIRONMENTS.filter((e) => e.load !== "initial").map((e) => (
            <LazyEnv key={e.id} env={e} quality={quality} preset={preset} />
          ))}
        <PerformanceGuard />
        <CharacterController def={characters[characterId]} castShadow={preset.shadows} />
        <CameraController />
        <InteractionSystem />
      </RuntimeContext.Provider>
    </Canvas>
  );
}

/** One lazy component per environment, created once at load time (each scene is a separate download). */
const SCENES = new Map(ENVIRONMENTS.map((e) => [e.id, lazy(e.scene)]));

/** Draws an environment's scene; hidden (but kept loaded) while the player is elsewhere. */
function EnvSlot({ env, quality, preset }: { env: EnvironmentDef; quality: QualityLevel; preset: QualityPreset }) {
  const active = useWorld((s) => s.env === env.id);
  const scene = SCENES.get(env.id);
  const props: EnvSceneProps = { quality, preset, active };
  return (
    <group visible={active} name={`env:${env.id}`}>
      {scene && createElement(scene, props)}
    </group>
  );
}

/**
 * Loads an "after-initial" environment right away, an "on-demand" one when the player travels there
 * or comes within its preload distance (of its area, or of a doorway leading into it). Once loaded it stays (hidden when not active).
 */
function LazyEnv({ env, quality, preset }: { env: EnvironmentDef; quality: QualityLevel; preset: QualityPreset }) {
  const rtRef = useRuntimeRef();
  const [wanted, setWanted] = useState(env.load === "after-initial");
  const active = useWorld((s) => s.env === env.id || s.travel?.env === env.id);
  const want = wanted || active;
  useFrame(() => {
    if (want) return;
    const p = rtRef.current.player;
    if (preloadDistanceTo(env, p.x, p.z) < (env.preloadDistance ?? 12)) setWanted(true);
  });
  if (!want) return null;
  return (
    <Suspense fallback={null}>
      <EnvSlot env={env} quality={quality} preset={preset} />
    </Suspense>
  );
}

/**
 * Drops the graphics preset one step when the frame rate stays low (never raises it on its own),
 * remembers the choice and tells the player. Skips the first seconds after loading.
 */
function PerformanceGuard() {
  const acc = useRef({ t: 0, frames: 0, warmup: 6, lowWindows: 0 });
  useFrame((_, dt) => {
    const a = acc.current;
    const s = worldStore.get();
    if (!s.ready || document.hidden || inputBlockedNow()) return;
    if (a.warmup > 0) {
      a.warmup -= dt;
      return;
    }
    a.t += dt;
    a.frames++;
    if (a.t < 3) return;
    const fps = a.frames / a.t;
    a.t = 0;
    a.frames = 0;
    a.lowWindows = fps < 24 ? a.lowWindows + 1 : 0;
    if (a.lowWindows >= 2 && s.quality !== "low" && !new URLSearchParams(window.location.search).has("keepQuality")) {
      const next = s.quality === "high" ? "medium" : "low";
      savePref("quality", next);
      worldStore.set({ quality: next, toast: `برای اجرای روان‌تر، کیفیت گرافیک روی «${QUALITY_PRESETS[next].label}» تنظیم شد.` });
      a.lowWindows = 0;
      a.warmup = 8;
    }
  });
  return null;
}

/** Marks the scene as loaded once the suspended assets have resolved. */
function Ready() {
  useEffect(() => {
    worldStore.set({ ready: true });
    return () => worldStore.set({ ready: false });
  }, []);
  return null;
}

function Lights({ preset }: { preset: QualityPreset }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const get = useThree((s) => s.get);
  const target = useMemo(() => new THREE.Object3D(), []);
  const rtRef = useRuntimeRef();

  useEffect(() => {
    const scene = get().scene;
    scene.add(target);
    return () => {
      scene.remove(target);
    };
  }, [get, target]);

  // The shadow camera covers a small area around the player and moves with them (sharper shadows).
  useFrame(() => {
    const l = sun.current;
    if (!l) return;
    const rt = rtRef.current;
    const snap = 0.25;
    const x = Math.round(rt.player.x / snap) * snap;
    const z = Math.round(rt.player.z / snap) * snap;
    target.position.set(x, 0, z);
    l.position.set(x + 2.5, 9, z + 3.5);
    l.target = target;
  });

  return (
    <>
      <hemisphereLight args={["#ffffff", "#b9b2a4", 1.15]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        ref={sun}
        intensity={1.5}
        color="#fffaf2"
        castShadow={preset.shadows}
        shadow-mapSize={[preset.shadowMapSize || 512, preset.shadowMapSize || 512]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-camera-near={1}
        shadow-camera-far={25}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      {preset.pointLights &&
        [8, 1, -6].map((z) => <pointLight key={z} position={[0, 4.8, z]} intensity={6} distance={9} decay={1.6} color="#fff5e6" />)}
    </>
  );
}

/** Soft studio-like reflections for the glossy floor (generated locally, no HDR download). */
function RoomReflections() {
  const get = useThree((s) => s.get);
  useEffect(() => {
    const { gl, scene } = get();
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.45;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [get]);
  return null;
}
