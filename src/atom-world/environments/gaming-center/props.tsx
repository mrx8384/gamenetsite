"use client";

import type * as THREE from "three";
import type { Console } from "./layout";
import { TV_CABINET } from "./index";

/**
 * Furniture of the gaming center, after the photos. TEMPORARY primitive builds (no 3D scans):
 * grey tufted sofas with brown side panels, metal-frame armchairs, TVs on low cabinets.
 * Everything is built facing +z (the side you sit on / the screen side).
 */

const GREY = { color: "#7f8a90", roughness: 0.9 } as const;
const BROWN = { color: "#7a5636", roughness: 0.75 } as const;
const CHROME = { color: "#b9bec3", metalness: 0.9, roughness: 0.25 } as const;

export function GreySofa({ length, depth, castShadow }: { length: number; depth: number; castShadow: boolean }) {
  const seats = Math.max(1, Math.round(length / 0.65));
  return (
    <group>
      <mesh position={[0, 0.27, 0]} castShadow={castShadow} receiveShadow>
        <boxGeometry args={[length - 0.3, 0.26, depth]} />
        <meshStandardMaterial {...GREY} />
      </mesh>
      {Array.from({ length: seats }, (_, i) => (
        <mesh key={i} position={[-(length - 0.3) / 2 + ((length - 0.3) / seats) * (i + 0.5), 0.45, 0.06]}>
          <boxGeometry args={[(length - 0.3) / seats - 0.03, 0.12, depth - 0.22]} />
          <meshStandardMaterial {...GREY} />
        </mesh>
      ))}
      {/* tufted backrest */}
      <mesh position={[0, 0.68, -depth / 2 + 0.11]} castShadow={castShadow}>
        <boxGeometry args={[length - 0.3, 0.52, 0.22]} />
        <meshStandardMaterial {...GREY} />
      </mesh>
      {Array.from({ length: seats * 4 }, (_, i) => (
        <mesh key={`b${i}`} position={[-(length - 0.4) / 2 + (i % (seats * 2)) * ((length - 0.4) / Math.max(1, seats * 2 - 1)), i < seats * 2 ? 0.62 : 0.8, -depth / 2 + 0.225]}>
          <sphereGeometry args={[0.018, 6, 6]} />
          <meshStandardMaterial color="#5f696f" />
        </mesh>
      ))}
      {/* arms: grey top, brown wooden side panel */}
      {[1, -1].map((s) => (
        <group key={s} position={[(length / 2 - 0.15) * s, 0, 0]}>
          <mesh position={[0, 0.36, 0]} castShadow={castShadow}>
            <boxGeometry args={[0.3, 0.46, depth]} />
            <meshStandardMaterial {...BROWN} />
          </mesh>
          <mesh position={[0, 0.62, 0]}>
            <boxGeometry args={[0.3, 0.1, depth]} />
            <meshStandardMaterial {...GREY} />
          </mesh>
        </group>
      ))}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (length / 2 - 0.12), 0.07, sz * (depth / 2 - 0.1)]}>
            <cylinderGeometry args={[0.025, 0.018, 0.14, 6]} />
            <meshStandardMaterial color="#5a3d26" />
          </mesh>
        )),
      )}
    </group>
  );
}

export function MetalArmchair({ castShadow }: { castShadow: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.42, 0.03]} castShadow={castShadow}>
        <boxGeometry args={[0.52, 0.1, 0.55]} />
        <meshStandardMaterial {...GREY} />
      </mesh>
      <mesh position={[0, 0.75, -0.25]} rotation-x={-0.15} castShadow={castShadow}>
        <boxGeometry args={[0.5, 0.58, 0.08]} />
        <meshStandardMaterial {...GREY} />
      </mesh>
      {[1, -1].map((s) => (
        <group key={s} position={[0.3 * s, 0, 0]}>
          <mesh position={[0, 0.6, 0.02]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.02, 0.02, 0.6, 8]} />
            <meshStandardMaterial {...CHROME} />
          </mesh>
          {[0.28, -0.24].map((z) => (
            <mesh key={z} position={[0, 0.3, z]}>
              <cylinderGeometry args={[0.02, 0.02, 0.6, 8]} />
              <meshStandardMaterial {...CHROME} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** TV on a low cabinet with the console on its shelf. The train room has a white cabinet (photo 02). */
export function TvStation({ console: kind, white, screen, castShadow }: { console: Console; white?: boolean; screen?: THREE.Texture; castShadow: boolean }) {
  const { width: w, depth: d, height: h } = TV_CABINET;
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow={castShadow} receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={white ? "#ece6da" : "#1c1c1e"} roughness={0.45} />
      </mesh>
      {white && (
        <mesh position={[0, h + 0.015, 0]}>
          <boxGeometry args={[w + 0.04, 0.03, d + 0.02]} />
          <meshStandardMaterial color="#4a3426" roughness={0.6} />
        </mesh>
      )}
      {/* open shelf with the console */}
      <mesh position={[0, h * 0.42, d / 2 + 0.001]}>
        <planeGeometry args={[w - 0.2, h * 0.36]} />
        <meshStandardMaterial color="#070707" />
      </mesh>
      {kind === "ps5" ? (
        <mesh position={[0.3, h * 0.42, d / 2 - 0.12]}>
          <boxGeometry args={[0.1, 0.17, 0.2]} />
          <meshStandardMaterial color="#f2f3f5" roughness={0.35} />
        </mesh>
      ) : (
        <mesh position={[0.25, h * 0.32, d / 2 - 0.15]}>
          <boxGeometry args={[0.3, 0.05, 0.26]} />
          <meshStandardMaterial color="#111214" roughness={0.3} />
        </mesh>
      )}
      {/* TV on its feet */}
      <mesh position={[0, h + 0.4, -0.02]} castShadow={castShadow}>
        <boxGeometry args={[1.12, 0.66, 0.05]} />
        <meshStandardMaterial color="#0b0b0c" roughness={0.3} />
      </mesh>
      <mesh position={[0, h + 0.4, 0.006]}>
        <planeGeometry args={[1.08, 0.62]} />
        <meshStandardMaterial color="#10151c" roughness={0.12} metalness={0.4} map={screen ?? null} emissive={screen ? "#ffffff" : "#000000"} emissiveMap={screen ?? null} emissiveIntensity={screen ? 0.5 : 0} />
      </mesh>
      {[-0.42, 0.42].map((x) => (
        <mesh key={x} position={[x, h + 0.04, 0]}>
          <boxGeometry args={[0.04, 0.08, 0.18]} />
          <meshStandardMaterial color="#0b0b0c" />
        </mesh>
      ))}
    </group>
  );
}
