"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { AnimSource } from "../characters/CharacterModel";
import { CharacterModel } from "../characters/CharacterModel";
import { type CharacterId, characterIds, characters } from "../data/characters";

/** 3D stage of the character selector (loaded separately from the page shell). */
export default function SelectorStage({
  selected,
  spin,
  onPick,
}: {
  selected: CharacterId;
  spin: React.RefObject<Record<CharacterId, number>>;
  onPick: (id: CharacterId) => void;
}) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ fov: 30, position: [0, 1.35, 5.6] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0 }}
      onCreated={({ gl, camera }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        camera.lookAt(0, 0.82, 0);
      }}
    >
      <Stage selected={selected} spin={spin} onPick={onPick} />
    </Canvas>
  );
}

function Stage({
  selected,
  spin,
  onPick,
}: {
  selected: CharacterId;
  spin: React.RefObject<Record<CharacterId, number>>;
  onPick: (id: CharacterId) => void;
}) {
  return (
    <>
      <FitCamera />
      <color attach="background" args={["#050605"]} />
      <hemisphereLight args={["#ffffff", "#202020", 0.55]} />
      <directionalLight position={[0, 4, 5]} intensity={1.6} />
      <pointLight position={[-2.6, 2.2, 1.5]} intensity={22} distance={8} color="#39ff88" />
      <pointLight position={[2.6, 2.2, 1.5]} intensity={22} distance={8} color="#ff4fa0" />
      <pointLight position={[0, 2.5, -2.5]} intensity={10} distance={7} color="#ffffff" />
      {characterIds.map((id, i) => (
        <Podium key={id} id={id} x={i === 0 ? -0.85 : 0.85} selected={selected === id} spin={spin} onPick={onPick} />
      ))}
    </>
  );
}

/** Keeps both characters in frame on any aspect ratio (portrait phones need a wider shot). */
function FitCamera() {
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useFrame(() => {
    const halfV = THREE.MathUtils.degToRad(camera.fov / 2);
    const halfH = Math.atan(Math.tan(halfV) * aspect);
    const needW = 1.75 / Math.tan(halfH); // both podiums + margin
    const needH = 1.25 / Math.tan(halfV); // full height + margin
    const d = Math.max(5.6, needW, needH);
    if (Math.abs(camera.position.z - d) > 0.01) {
      camera.position.set(0, 1.0 + d * 0.06, d);
      camera.lookAt(0, 0.82, 0);
    }
  });
  return null;
}

function Podium({
  id,
  x,
  selected,
  spin,
  onPick,
}: {
  id: CharacterId;
  x: number;
  selected: boolean;
  spin: React.RefObject<Record<CharacterId, number>>;
  onPick: (id: CharacterId) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.MeshBasicMaterial>(null);
  const anim = useRef<AnimSource["current"]>({ state: "idle", phase: 0, speed: 0, turnRate: 0, interact: 0 });
  const def = characters[id];

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    g.rotation.y += (spin.current[id] - g.rotation.y) * (1 - Math.exp(-dt * 10));
    const s = selected ? 1.06 : 0.94;
    g.scale.setScalar(g.scale.x + (s - g.scale.x) * (1 - Math.exp(-dt * 8)));
    if (ring.current) ring.current.opacity += ((selected ? 1 : 0.25) - ring.current.opacity) * (1 - Math.exp(-dt * 8));
  });

  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <cylinderGeometry args={[0.6, 0.66, 0.06, 40]} />
        <meshStandardMaterial color="#111312" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.062, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.56, 0.62, 48]} />
        <meshBasicMaterial ref={ring} color={def.accent} transparent toneMapped={false} />
      </mesh>
      <group
        ref={group}
        position={[0, 0.06, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onPick(id);
        }}
      >
        <CharacterModel def={def} anim={anim} castShadow={false} />
        {/* invisible hit box so the whole figure is clickable */}
        <mesh position={[0, 0.85, 0]} visible={false}>
          <boxGeometry args={[0.8, 1.7, 0.6]} />
        </mesh>
      </group>
    </group>
  );
}
