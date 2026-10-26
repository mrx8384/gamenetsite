"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { AIR_HOCKEY_SIZE } from "../../data/environment";

/**
 * Air-hockey table modelled after ground-floor/air-hockey-left-wall.jpg and hall-overview.jpg:
 * black cabinet with the "GAME CENTER CLUB · AIR HOCKEY" side graphics, white play field, blue LED
 * edge strips, black arch with the score display, red and yellow mallets, tapered black legs.
 * Long side along x. The side-graphic texture is rectified from the photo (temporary until the
 * original print file is available).
 */
export function AirHockeyTable({ sidePanel, castShadow }: { sidePanel: THREE.Texture; castShadow: boolean }) {
  const { x: W, z: D, height: H } = AIR_HOCKEY_SIZE;
  const archGeo = useMemo(() => {
    const g = new THREE.TorusGeometry(D / 2 - 0.02, 0.045, 6, 28, Math.PI);
    g.scale(1, 1, 2.2);
    return g;
  }, [D]);
  const legGeo = useMemo(() => new THREE.CylinderGeometry(0.11, 0.07, H - 0.22, 4, 1), [H]);

  return (
    <group>
      {/* cabinet */}
      <mesh position={[0, H - 0.14, 0]} castShadow={castShadow} receiveShadow>
        <boxGeometry args={[W, 0.26, D]} />
        <meshStandardMaterial color="#121316" roughness={0.45} />
      </mesh>
      {/* printed side panels (both long sides) */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[0, H - 0.15, (D / 2 + 0.002) * s]} rotation-y={s === 1 ? 0 : Math.PI}>
          <planeGeometry args={[W - 0.04, 0.24]} />
          <meshStandardMaterial map={sidePanel} roughness={0.5} />
        </mesh>
      ))}
      {/* top rim */}
      <mesh position={[0, H - 0.005, 0]} castShadow={castShadow}>
        <boxGeometry args={[W + 0.04, 0.03, D + 0.04]} />
        <meshStandardMaterial color="#2a2c31" roughness={0.35} metalness={0.4} />
      </mesh>
      {/* play field */}
      <mesh position={[0, H + 0.012, 0]} receiveShadow>
        <boxGeometry args={[W - 0.14, 0.01, D - 0.14]} />
        <meshStandardMaterial color="#f3f6fb" roughness={0.18} />
      </mesh>
      {/* blue LED strips along the long rails */}
      {[1, -1].map((s) => (
        <mesh key={`led${s}`} position={[0, H + 0.03, (D / 2 - 0.05) * s]}>
          <boxGeometry args={[W - 0.2, 0.02, 0.025]} />
          <meshBasicMaterial color="#3d8bff" toneMapped={false} />
        </mesh>
      ))}
      {/* goals */}
      {[1, -1].map((s) => (
        <mesh key={`goal${s}`} position={[(W / 2 - 0.05) * s, H + 0.02, 0]}>
          <boxGeometry args={[0.04, 0.025, 0.34]} />
          <meshStandardMaterial color="#050505" />
        </mesh>
      ))}
      {/* mallets + puck */}
      {[
        [0.75, 0.25, "#d62828"],
        [-0.78, -0.3, "#f4b400"],
      ].map(([x, z, col]) => (
        <group key={String(col)} position={[x as number, H + 0.02, z as number]}>
          <mesh castShadow={castShadow}>
            <cylinderGeometry args={[0.05, 0.05, 0.03, 16]} />
            <meshStandardMaterial color={col as string} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.06, 10]} />
            <meshStandardMaterial color={col as string} roughness={0.4} />
          </mesh>
        </group>
      ))}
      <mesh position={[0.1, H + 0.022, -0.05]}>
        <cylinderGeometry args={[0.035, 0.035, 0.008, 16]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      {/* arch with score display */}
      <mesh geometry={archGeo} position={[0, H, 0]} rotation-y={Math.PI / 2} castShadow={castShadow}>
        <meshStandardMaterial color="#0d0e10" roughness={0.4} />
      </mesh>
      <group position={[0, H + D / 2 - 0.02, 0]}>
        <mesh castShadow={castShadow}>
          <boxGeometry args={[0.18, 0.13, 0.3]} />
          <meshStandardMaterial color="#17181b" roughness={0.4} />
        </mesh>
        {[1, -1].map((s) => (
          <mesh key={`sc${s}`} position={[0.091 * s, 0, 0]} rotation-y={(Math.PI / 2) * s}>
            <planeGeometry args={[0.22, 0.07]} />
            <meshBasicMaterial color="#ff3b3b" toneMapped={false} />
          </mesh>
        ))}
      </group>
      {/* tapered legs */}
      {[
        [W / 2 - 0.3, D / 2 - 0.25],
        [W / 2 - 0.3, -D / 2 + 0.25],
        [-W / 2 + 0.3, D / 2 - 0.25],
        [-W / 2 + 0.3, -D / 2 + 0.25],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} geometry={legGeo} position={[x, (H - 0.22) / 2, z]} rotation-y={Math.PI / 4} castShadow={castShadow}>
          <meshStandardMaterial color="#0f1012" roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}
