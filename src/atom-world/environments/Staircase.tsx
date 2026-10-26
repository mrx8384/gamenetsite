"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { STAIRS } from "../data/environment";
import { useOwnedTexture } from "../systems/AssetLoader";
import { signTexture } from "../systems/textures";

/**
 * Staircase after ground-floor/staircase.jpg: open-riser black diamond-plate treads on a central
 * steel stringer, black posts with a chrome ball on the first one, black handrail and four chrome
 * rods on the hall side. Each tread has a collider (data/environment.ts), so the step-up controller
 * can climb it. `barrier` re-adds the phase-1 rope barrier (visual only; the collider is in data).
 */
export function Staircase({ castShadow, barrier = false }: { castShadow: boolean; barrier?: boolean }) {
  const rise = STAIRS.rise;
  const width = STAIRS.xMax - STAIRS.xMin;
  const cx = (STAIRS.xMin + STAIRS.xMax) / 2;
  const totalRun = STAIRS.steps * STAIRS.run;
  const height = STAIRS.steps * rise;
  const slope = Math.atan2(height, totalRun);
  const railX = STAIRS.xMin + 0.03;

  const treads = useMemo(
    () =>
      Array.from({ length: STAIRS.steps }, (_, i) => ({
        y: (i + 1) * rise - STAIRS.tread / 2,
        z: STAIRS.zStart - (i + 0.5) * STAIRS.run,
      })),
    [rise],
  );
  const posts = treads.filter((_, i) => i % 3 === 0 || i === STAIRS.steps - 1);
  const sign = useOwnedTexture(() => signTexture(["طبقهٔ دوم", "به‌زودی — فاز دوم"]));
  const railLen = Math.hypot(totalRun, height);
  const mid = new THREE.Vector3(railX, height / 2, STAIRS.zStart - totalRun / 2);

  return (
    <group>
      {treads.map((t, i) => (
        <group key={i} position={[cx, t.y, t.z]}>
          <mesh castShadow={castShadow} receiveShadow>
            <boxGeometry args={[width, STAIRS.tread, STAIRS.run + 0.04]} />
            <meshStandardMaterial color="#25272a" roughness={0.55} metalness={0.35} />
          </mesh>
          <mesh position={[0, 0, STAIRS.run / 2 + 0.02]}>
            <boxGeometry args={[width, STAIRS.tread + 0.005, 0.015]} />
            <meshStandardMaterial color="#111" roughness={0.6} />
          </mesh>
        </group>
      ))}
      {/* central stringer */}
      <mesh position={[cx, mid.y - 0.16, mid.z]} rotation-x={slope} castShadow={castShadow}>
        <boxGeometry args={[0.18, 0.22, railLen]} />
        <meshStandardMaterial color="#141516" roughness={0.6} metalness={0.3} />
      </mesh>
      {/* posts */}
      {posts.map((t, i) => (
        <group key={`p${i}`} position={[railX, t.y, t.z]}>
          <mesh position={[0, 0.47, 0]} castShadow={castShadow}>
            <cylinderGeometry args={[0.025, 0.025, 0.95, 10]} />
            <meshStandardMaterial color="#151515" roughness={0.4} metalness={0.5} />
          </mesh>
          {i === 0 && (
            <mesh position={[0, 0.98, 0]}>
              <sphereGeometry args={[0.04, 14, 10]} />
              <meshStandardMaterial color="#e5e7ea" roughness={0.1} metalness={1} />
            </mesh>
          )}
        </group>
      ))}
      {/* black handrail + chrome rods, parallel to the slope */}
      <mesh position={[railX, mid.y + 0.95, mid.z]} rotation-x={slope - Math.PI / 2} castShadow={castShadow}>
        <cylinderGeometry args={[0.03, 0.03, railLen + 0.1, 12]} />
        <meshStandardMaterial color="#121212" roughness={0.5} />
      </mesh>
      {[0.2, 0.4, 0.6, 0.8].map((h) => (
        <mesh key={h} position={[railX, mid.y + h, mid.z]} rotation-x={slope - Math.PI / 2}>
          <cylinderGeometry args={[0.008, 0.008, railLen, 8]} />
          <meshStandardMaterial color="#dfe2e6" roughness={0.15} metalness={1} />
        </mesh>
      ))}
      {barrier && (
        <group position={[cx - 0.05, 0, STAIRS.zStart + 0.2]}>
          {[-1, 1].map((s) => (
            <group key={s} position={[(width / 2 - 0.05) * s, 0, 0]}>
              <mesh position={[0, 0.48, 0]}>
                <cylinderGeometry args={[0.025, 0.025, 0.96, 10]} />
                <meshStandardMaterial color="#d9dce0" metalness={1} roughness={0.2} />
              </mesh>
              <mesh position={[0, 0.02, 0]}>
                <cylinderGeometry args={[0.14, 0.16, 0.04, 20]} />
                <meshStandardMaterial color="#d9dce0" metalness={1} roughness={0.2} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 0.86, 0]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.018, 0.018, width - 0.1, 8]} />
            <meshStandardMaterial color="#c1121f" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.62, 0.03]}>
            <planeGeometry args={[0.72, 0.36]} />
            <meshBasicMaterial map={sign} toneMapped={false} />
          </mesh>
        </group>
      )}
    </group>
  );
}
