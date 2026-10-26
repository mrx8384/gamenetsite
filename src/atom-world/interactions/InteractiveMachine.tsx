"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { useWorld, worldStore } from "../store";

const tmp = new THREE.Vector3();

/**
 * Wraps a machine model: adds the floating interaction marker above it (green diamond that
 * brightens and bobs when the player is in range). The machine's data lives in data/machines.ts.
 */
export function InteractiveMachine({
  id,
  markerHeight = 2.2,
  markerAt = [0, 0],
  children,
}: {
  id: string;
  markerHeight?: number;
  /** Marker x/z in the group's space (default: the group origin). */
  markerAt?: [number, number];
  children: React.ReactNode;
}) {
  const near = useWorld((s) => s.nearby?.id === id);
  const marker = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock, camera }) => {
    const m = marker.current;
    if (!m) return;
    // hide when the camera is right next to it (would fill the screen)
    m.getWorldPosition(tmp);
    m.visible = camera.position.distanceTo(tmp) > 1.6;
    // «کاهش حرکت»: the marker stays still
    const t = worldStore.get().reducedMotion ? 0 : clock.elapsedTime;
    m.rotation.y = t * 1.6;
    m.position.y = markerHeight + Math.sin(t * 2.4) * (near ? 0.09 : 0.04);
    m.scale.setScalar(near ? 1.25 : 0.85);
    if (mat.current) mat.current.opacity = near ? 1 : 0.55;
  });

  return (
    <group>
      {children}
      <mesh ref={marker} position={[markerAt[0], markerHeight, markerAt[1]]} userData={{ noBatch: true }}>
        <octahedronGeometry args={[0.12, 0]} />
        <meshBasicMaterial ref={mat} color="#39ff88" transparent toneMapped={false} />
      </mesh>
    </group>
  );
}
