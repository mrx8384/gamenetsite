"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { neutralPose, targetPose } from "../characters/CharacterAnimations";
import { applyPose, buildToonCharacter } from "../characters/buildToonCharacter";
import { type CharacterId, characters } from "../data/characters";
import { exportCharacterGlb } from "./exportCharacter";

/** Turnaround (front / side / back / side) like the character sheets, plus the GLB export hook. */
export function ModelLab() {
  const [id, setId] = useState<CharacterId>(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("c") === "girl" ? "girl" : "boy",
  );
  const [anim, setAnim] = useState<"idle" | "walk" | "run" | "rest">(() => {
    const a = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("a") : null;
    return a === "walk" || a === "run" || a === "idle" ? a : "rest";
  });

  useEffect(() => {
    (window as unknown as { __atomExport?: (c: CharacterId) => Promise<string> }).__atomExport = async (c) => {
      const buf = await exportCharacterGlb(c);
      let bin = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(bin);
    };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#141516", color: "#fff", fontFamily: "sans-serif" }}>
      <div style={{ position: "absolute", top: 8, left: 8, zIndex: 2, display: "flex", gap: 8 }} dir="ltr">
        {(["boy", "girl"] as const).map((c) => (
          <button key={c} onClick={() => setId(c)} style={{ padding: "6px 12px", fontWeight: id === c ? 800 : 400 }}>
            {c}
          </button>
        ))}
        {(["rest", "idle", "walk", "run"] as const).map((a) => (
          <button key={a} onClick={() => setAnim(a)} style={{ padding: "6px 12px", fontWeight: anim === a ? 800 : 400 }}>
            {a}
          </button>
        ))}
      </div>
      <Canvas
        orthographic
        camera={{ position: [0, 0.82, 10], zoom: 380 }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        onCreated={({ camera }) => camera.lookAt(0, 0.82, -1)}
      >
        <color attach="background" args={["#141516"]} />
        <hemisphereLight args={["#ffffff", "#333333", 1.1]} />
        <directionalLight position={[2, 4, 5]} intensity={1.6} />
        {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((ry, i) => (
          <View key={`${id}${i}`} id={id} x={(i - 1.5) * 0.95} ry={ry} anim={anim} />
        ))}
      </Canvas>
    </div>
  );
}

function View({ id, x, ry, anim }: { id: CharacterId; x: number; ry: number; anim: "idle" | "walk" | "run" | "rest" }) {
  const rig = useMemo(() => buildToonCharacter(characters[id].look, false), [id]);
  useEffect(() => () => rig.dispose(), [rig]);
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt;
    if (anim === "rest") {
      applyPose(rig, { ...neutralPose(), armOutL: 0, armOutR: 0, elbowL: 0, elbowR: 0 }, 0);
      return;
    }
    const speed = anim === "run" ? 5.4 : anim === "walk" ? 2.6 : 0;
    const p = targetPose({ state: anim, time: t.current, phase: t.current * speed * (anim === "run" ? 2.35 : 3.1), speed, turnRate: 0, interact: 0 });
    applyPose(rig, p, t.current);
  });
  return (
    <group position={[x, 0, 0]} rotation-y={ry}>
      <primitive object={rig.root} />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.001, 0]}>
        <circleGeometry args={[0.3, 24]} />
        <meshBasicMaterial color={new THREE.Color("#2a2c2e")} />
      </mesh>
    </group>
  );
}
