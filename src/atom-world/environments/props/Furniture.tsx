"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { COUNTER, FRIDGE, KIDS_CARPET, SHELF, UNDER_STAIR_DESK } from "../../data/environment";

const GOLD = { color: "#c9a13b", metalness: 0.85, roughness: 0.32 } as const;
const CREAM = { color: "#efebe3", roughness: 0.85 } as const;

/**
 * White tufted sofa with gold baroque ornaments (entrance/entrance-glass-white-sofas.jpg).
 * Built facing +z; `seats` controls the length.
 */
export function BaroqueSofa({ length, depth, castShadow }: { length: number; depth: number; castShadow: boolean }) {
  const seatCount = Math.max(1, Math.round(length / 0.7));
  return (
    <group>
      <mesh position={[0, 0.25, 0]} castShadow={castShadow} receiveShadow>
        <boxGeometry args={[length, 0.3, depth]} />
        <meshStandardMaterial {...CREAM} />
      </mesh>
      {Array.from({ length: seatCount }, (_, i) => (
        <mesh key={i} position={[-length / 2 + (length / seatCount) * (i + 0.5), 0.45, 0.05]} castShadow={castShadow}>
          <boxGeometry args={[length / seatCount - 0.04, 0.12, depth - 0.25]} />
          <meshStandardMaterial {...CREAM} />
        </mesh>
      ))}
      {/* tall backrest + rolled top */}
      <mesh position={[0, 0.7, -depth / 2 + 0.1]} castShadow={castShadow}>
        <boxGeometry args={[length - 0.1, 0.6, 0.2]} />
        <meshStandardMaterial {...CREAM} />
      </mesh>
      <mesh position={[0, 1.0, -depth / 2 + 0.1]} rotation-z={Math.PI / 2} castShadow={castShadow}>
        <cylinderGeometry args={[0.1, 0.1, length - 0.1, 16]} />
        <meshStandardMaterial {...CREAM} />
      </mesh>
      {/* tufting buttons */}
      {Array.from({ length: seatCount * 3 }, (_, i) => (
        <mesh key={`b${i}`} position={[-length / 2 + 0.15 + (i * (length - 0.3)) / Math.max(1, seatCount * 3 - 1), 0.78, -depth / 2 + 0.205]}>
          <sphereGeometry args={[0.015, 6, 6]} />
          <meshStandardMaterial color="#d9d4cb" />
        </mesh>
      ))}
      {/* rolled arms */}
      {[1, -1].map((s) => (
        <group key={s} position={[(length / 2 - 0.08) * s, 0, 0]}>
          <mesh position={[0, 0.45, 0]} castShadow={castShadow}>
            <boxGeometry args={[0.16, 0.4, depth - 0.05]} />
            <meshStandardMaterial {...CREAM} />
          </mesh>
          <mesh position={[0, 0.66, 0]} rotation-x={Math.PI / 2} castShadow={castShadow}>
            <cylinderGeometry args={[0.11, 0.11, depth - 0.05, 14]} />
            <meshStandardMaterial {...CREAM} />
          </mesh>
          {/* gold scroll on the arm front */}
          <mesh position={[0, 0.5, depth / 2 - 0.01]}>
            <torusGeometry args={[0.08, 0.022, 8, 16]} />
            <meshStandardMaterial {...GOLD} />
          </mesh>
          <mesh position={[0, 0.05, depth / 2 - 0.1]}>
            <coneGeometry args={[0.05, 0.12, 8]} />
            <meshStandardMaterial {...GOLD} />
          </mesh>
          <mesh position={[0, 0.05, -depth / 2 + 0.1]}>
            <coneGeometry args={[0.05, 0.12, 8]} />
            <meshStandardMaterial {...GOLD} />
          </mesh>
        </group>
      ))}
      {/* gold crest on top of the backrest */}
      <group position={[0, 1.12, -depth / 2 + 0.1]}>
        <mesh>
          <torusKnotGeometry args={[0.07, 0.02, 40, 6, 2, 3]} />
          <meshStandardMaterial {...GOLD} />
        </mesh>
        {[1, -1].map((s) => (
          <mesh key={s} position={[0.13 * s, -0.02, 0]} rotation-z={0.6 * s}>
            <torusGeometry args={[0.05, 0.016, 6, 12, Math.PI * 1.4]} />
            <meshStandardMaterial {...GOLD} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Round coffee table of the lounge: cream drum base, dark top. */
export function RoundTable({ radius = 0.4, castShadow }: { radius?: number; castShadow: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.2, 0]} castShadow={castShadow} receiveShadow>
        <cylinderGeometry args={[radius * 0.85, radius * 0.85, 0.4, 28]} />
        <meshStandardMaterial {...CREAM} />
      </mesh>
      <mesh position={[0, 0.43, 0]} castShadow={castShadow}>
        <cylinderGeometry args={[radius, radius, 0.05, 28]} />
        <meshStandardMaterial color="#4b3f37" roughness={0.25} metalness={0.2} />
      </mesh>
    </group>
  );
}

/** Shop counter with the round ATOM badge on its front, toy shelves and drinks fridge (hall-overview.jpg). */
export function ShopArea({ logo, castShadow }: { logo: THREE.Texture; castShadow: boolean }) {
  const cx = (COUNTER.xMin + COUNTER.xMax) / 2;
  const cz = (COUNTER.zMin + COUNTER.zMax) / 2;
  const len = COUNTER.zMax - COUNTER.zMin;
  const dep = COUNTER.xMax - COUNTER.xMin;
  const toys = useRef<THREE.InstancedMesh>(null);
  const bottles = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    const palette = ["#ff4d4d", "#ffd23f", "#3fa7ff", "#7bd389", "#ff8cc6", "#ffffff", "#9b5de5", "#00c96b"];
    let seed = 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    if (toys.current) {
      let i = 0;
      for (let shelf = 0; shelf < 4; shelf++)
        for (let k = 0; k < 9; k++) {
          const sx = 0.12 + rnd() * 0.12;
          const sy = 0.12 + rnd() * 0.2;
          m.compose(
            new THREE.Vector3(SHELF.xMin + 0.2, 0.4 + shelf * 0.45 + sy / 2, SHELF.zMin + 0.15 + k * 0.26),
            new THREE.Quaternion(),
            new THREE.Vector3(sx, sy, 0.2),
          );
          toys.current.setMatrixAt(i, m);
          toys.current.setColorAt(i, col.set(palette[Math.floor(rnd() * palette.length)]));
          i++;
        }
      toys.current.instanceMatrix.needsUpdate = true;
      if (toys.current.instanceColor) toys.current.instanceColor.needsUpdate = true;
    }
    if (bottles.current) {
      let i = 0;
      for (let row = 0; row < 4; row++)
        for (let k = 0; k < 6; k++) {
          m.makeTranslation(FRIDGE.xMin + 0.15, 0.35 + row * 0.38, FRIDGE.zMin + 0.1 + k * 0.11);
          bottles.current.setMatrixAt(i, m);
          bottles.current.setColorAt(i, col.set(palette[(row * 3 + k) % palette.length]));
          i++;
        }
      bottles.current.instanceMatrix.needsUpdate = true;
      if (bottles.current.instanceColor) bottles.current.instanceColor.needsUpdate = true;
    }
  }, []);

  return (
    <group>
      {/* counter body */}
      <mesh position={[cx, COUNTER.height / 2, cz]} castShadow={castShadow} receiveShadow>
        <boxGeometry args={[dep, COUNTER.height, len]} />
        <meshStandardMaterial color="#121212" roughness={0.6} />
      </mesh>
      <mesh position={[cx, COUNTER.height + 0.02, cz]} castShadow={castShadow}>
        <boxGeometry args={[dep + 0.08, 0.04, len + 0.08]} />
        <meshStandardMaterial color="#b98b56" roughness={0.6} />
      </mesh>
      {/* green front band + ATOM badge (official logo file) */}
      <mesh position={[COUNTER.xMin - 0.002, COUNTER.height / 2, cz]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[len, COUNTER.height - 0.1]} />
        <meshStandardMaterial color="#0f8f4a" roughness={0.6} />
      </mesh>
      <mesh position={[COUNTER.xMin - 0.004, COUNTER.height / 2, cz + len * 0.22]} rotation-y={-Math.PI / 2}>
        <circleGeometry args={[0.45, 40]} />
        <meshBasicMaterial map={logo} transparent toneMapped={false} />
      </mesh>
      <AtomWordmark position={[COUNTER.xMin - 0.004, COUNTER.height / 2, cz - len * 0.18]} />
      {/* shelves with toys */}
      <mesh position={[SHELF.xMax - 0.03, SHELF.height / 2, (SHELF.zMin + SHELF.zMax) / 2]} castShadow={castShadow}>
        <boxGeometry args={[0.06, SHELF.height, SHELF.zMax - SHELF.zMin]} />
        <meshStandardMaterial color="#1b1b1d" roughness={0.7} />
      </mesh>
      {[0.4, 0.85, 1.3, 1.75].map((y) => (
        <mesh key={y} position={[(SHELF.xMin + SHELF.xMax) / 2, y - 0.015, (SHELF.zMin + SHELF.zMax) / 2]} castShadow={castShadow}>
          <boxGeometry args={[SHELF.xMax - SHELF.xMin, 0.03, SHELF.zMax - SHELF.zMin]} />
          <meshStandardMaterial color="#2a2a2d" roughness={0.6} />
        </mesh>
      ))}
      <instancedMesh ref={toys} args={[undefined, undefined, 36]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.5} />
      </instancedMesh>
      {/* drinks fridge */}
      <mesh position={[(FRIDGE.xMin + FRIDGE.xMax) / 2, FRIDGE.height / 2, (FRIDGE.zMin + FRIDGE.zMax) / 2]} castShadow={castShadow}>
        <boxGeometry args={[FRIDGE.xMax - FRIDGE.xMin, FRIDGE.height, FRIDGE.zMax - FRIDGE.zMin]} />
        <meshStandardMaterial color="#f1f1f1" roughness={0.4} />
      </mesh>
      <instancedMesh ref={bottles} args={[undefined, undefined, 24]}>
        <cylinderGeometry args={[0.035, 0.035, 0.22, 8]} />
        <meshStandardMaterial roughness={0.3} />
      </instancedMesh>
      <mesh position={[FRIDGE.xMin - 0.003, FRIDGE.height / 2 + 0.05, (FRIDGE.zMin + FRIDGE.zMax) / 2]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[FRIDGE.zMax - FRIDGE.zMin - 0.08, FRIDGE.height - 0.3]} />
        <meshStandardMaterial color="#cfe8ff" transparent opacity={0.25} roughness={0.05} />
      </mesh>
    </group>
  );
}

/** Big yellow "ATOM" letters on the counter front (drawn once on a canvas). */
function AtomWordmark({ position }: { position: [number, number, number] }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 192;
    const ctx = c.getContext("2d")!;
    ctx.translate(256, 150);
    ctx.transform(1, 0, -0.2, 1, 0, 0);
    ctx.font = "900 150px Arial Black, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.lineWidth = 10;
    ctx.strokeStyle = "#111";
    ctx.strokeText("ATOM", 0, 0);
    ctx.fillStyle = "#ffdf00";
    ctx.fillText("ATOM", 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useLayoutEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={position} rotation-y={-Math.PI / 2}>
      <planeGeometry args={[1.6, 0.6]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} />
    </mesh>
  );
}

/** Kids' carpet, the small desk under the stairs and two grey poufs (ground-floor/staircase.jpg). */
export function KidsCorner({ carpet, castShadow }: { carpet: THREE.Texture; castShadow: boolean }) {
  const w = KIDS_CARPET.xMax - KIDS_CARPET.xMin;
  const d = KIDS_CARPET.zMax - KIDS_CARPET.zMin;
  const desk = UNDER_STAIR_DESK;
  return (
    <group>
      <mesh position={[(KIDS_CARPET.xMin + KIDS_CARPET.xMax) / 2, 0.006, (KIDS_CARPET.zMin + KIDS_CARPET.zMax) / 2]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial map={carpet} roughness={0.95} />
      </mesh>
      <mesh position={[(desk.xMin + desk.xMax) / 2, desk.height / 2, (desk.zMin + desk.zMax) / 2]} castShadow={castShadow}>
        <boxGeometry args={[desk.xMax - desk.xMin, desk.height, desk.zMax - desk.zMin]} />
        <meshStandardMaterial color="#a77b4d" roughness={0.7} />
      </mesh>
      {[-2.75, -3.35].map((z) => (
        <mesh key={z} position={[desk.xMin - 0.35, 0.22, z]} castShadow={castShadow}>
          <cylinderGeometry args={[0.2, 0.2, 0.44, 20]} />
          <meshStandardMaterial color="#8c8f94" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/** Wooden folding table and chair near the front right (hall-overview.jpg). */
export function FoldingTableSet({ castShadow }: { castShadow: boolean }) {
  const size = 0.8;
  return (
    <group>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[0, 0.74, -size / 2 + 0.07 + i * (size / 6)]} castShadow={castShadow}>
          <boxGeometry args={[size, 0.025, size / 6 - 0.02]} />
          <meshStandardMaterial color="#d8b98b" roughness={0.7} />
        </mesh>
      ))}
      {/* thin X-shaped steel leg frames on both sides */}
      {[size / 2 - 0.06, -size / 2 + 0.06].flatMap((lx) =>
        [0.72, -0.72].map((a) => (
          <mesh key={`${lx}${a}`} position={[lx, 0.37, 0]} rotation-x={a}>
            <boxGeometry args={[0.025, 0.025, 0.98]} />
            <meshStandardMaterial color="#151515" roughness={0.5} />
          </mesh>
        )),
      )}
      <group position={[0.1, 0, -0.75]}>
        <mesh position={[0, 0.45, 0]} castShadow={castShadow}>
          <boxGeometry args={[0.42, 0.03, 0.4]} />
          <meshStandardMaterial color="#d8b98b" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.7, -0.19]}>
          <boxGeometry args={[0.42, 0.3, 0.025]} />
          <meshStandardMaterial color="#d8b98b" roughness={0.7} />
        </mesh>
        {[0.19, -0.19].flatMap((lx) =>
          [0.5, -0.5].map((a) => (
            <mesh key={`${lx}${a}`} position={[lx, 0.23, 0]} rotation-x={a}>
              <boxGeometry args={[0.02, 0.02, 0.52]} />
              <meshStandardMaterial color="#151515" />
            </mesh>
          )),
        )}
      </group>
    </group>
  );
}

/** Potted plant inside the glass façade. */
export function Plant({ castShadow }: { castShadow: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.25, 0]} castShadow={castShadow}>
        <cylinderGeometry args={[0.22, 0.17, 0.5, 18]} />
        <meshStandardMaterial color="#e8e4dc" roughness={0.6} />
      </mesh>
      {Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.12, 0.85, Math.sin(a) * 0.12]} rotation={[Math.sin(a) * 0.4, 0, Math.cos(a) * 0.4]} castShadow={castShadow}>
            <coneGeometry args={[0.08, 0.8, 6]} />
            <meshStandardMaterial color="#3f7d3a" roughness={0.8} />
          </mesh>
        );
      })}
    </group>
  );
}

/**
 * Face-painting corner (owner request 2026-10-28): white vanity with a round mirror ringed by bulbs,
 * a paint palette, a cup of brushes and the child's pink stool in front. Built facing +z.
 */
export function FacePaintTable({ castShadow }: { castShadow: boolean }) {
  const paints = ["#e8303a", "#ffd23a", "#2fbf5b", "#2f7bff", "#8b4dff", "#ff6fb5"];
  return (
    <group>
      <mesh position={[0, 0.73, 0]} castShadow={castShadow} receiveShadow>
        <boxGeometry args={[0.9, 0.04, 0.45]} />
        <meshStandardMaterial color="#f4f1ec" roughness={0.5} />
      </mesh>
      {[-0.4, 0.4].map((x) => (
        <mesh key={x} position={[x, 0.355, 0]} castShadow={castShadow}>
          <boxGeometry args={[0.06, 0.71, 0.4]} />
          <meshStandardMaterial color="#ece7df" roughness={0.6} />
        </mesh>
      ))}
      {/* mirror with bulbs */}
      <mesh position={[0, 1.22, -0.19]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.3, 0.3, 0.03, 32]} />
        <meshStandardMaterial color="#f4f1ec" roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.22, -0.172]}>
        <circleGeometry args={[0.25, 32]} />
        <meshStandardMaterial color="#cfe3ee" metalness={0.6} roughness={0.08} />
      </mesh>
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.28, 1.22 + Math.sin(a) * 0.28, -0.165]}>
            <sphereGeometry args={[0.022, 10, 8]} />
            <meshStandardMaterial color="#fff1c4" emissive="#ffd98a" emissiveIntensity={1.2} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.92, -0.2]} castShadow={castShadow}>
        <boxGeometry args={[0.05, 0.36, 0.04]} />
        <meshStandardMaterial color="#ece7df" roughness={0.6} />
      </mesh>
      {/* palette with paint dots, brush cup */}
      <mesh position={[0.18, 0.76, 0.06]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.11, 24]} />
        <meshStandardMaterial color="#d8b98b" roughness={0.7} />
      </mesh>
      {paints.map((c, i) => {
        const a = (i / paints.length) * Math.PI * 2;
        return (
          <mesh key={c} position={[0.18 + Math.cos(a) * 0.065, 0.765, 0.06 + Math.sin(a) * 0.065]}>
            <cylinderGeometry args={[0.018, 0.018, 0.01, 12]} />
            <meshStandardMaterial color={c} roughness={0.4} />
          </mesh>
        );
      })}
      <mesh position={[-0.25, 0.81, 0.02]} castShadow={castShadow}>
        <cylinderGeometry args={[0.04, 0.035, 0.12, 14]} />
        <meshStandardMaterial color="#39ff88" roughness={0.5} />
      </mesh>
      {[-0.015, 0.015, 0].map((dx, i) => (
        <mesh key={i} position={[-0.25 + dx, 0.9, 0.02 + (i - 1) * 0.012]} rotation-z={dx * 6}>
          <cylinderGeometry args={[0.006, 0.006, 0.2, 6]} />
          <meshStandardMaterial color={paints[i * 2]} roughness={0.5} />
        </mesh>
      ))}
      {/* the child's stool */}
      <mesh position={[0, 0.21, 0.6]} castShadow={castShadow}>
        <cylinderGeometry args={[0.17, 0.15, 0.42, 20]} />
        <meshStandardMaterial color="#ff6fb5" roughness={0.6} />
      </mesh>
    </group>
  );
}
