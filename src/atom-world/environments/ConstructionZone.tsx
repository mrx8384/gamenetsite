"use client";

import { useMemo } from "react";
import * as THREE from "three";
import {
  COUNTER_TOP,
  DARK_RIDGE,
  EXCAVATOR_MURAL,
  PIT,
  PIT_COUNTERS,
  RIDGE_TOP,
  ZONE_OPENING,
  ZONE_ORIGIN,
  ZONE_PROPS,
  ZONE_ROOM,
  ZONE_WOOD_WALL,
} from "../data/constructionZone";
import { InteractiveMachine } from "../interactions/InteractiveMachine";
import { useOwnedTexture, usePhotoTextures, useRepeatedTexture } from "../systems/AssetLoader";
import { ceilingTilesTexture, claddingTexture, floorTilesTexture, signTexture, soilTexture, woodTexture } from "../systems/textures";

const YELLOW = { color: "#f2b200", roughness: 0.45 } as const;
const BLACK = { color: "#151515", roughness: 0.6 } as const;

/**
 * 🚜 Construction-machines zone (construction-zone/construction-zone.jpg), as a stand-alone module.
 * Enclosed sand pit behind white counters: light stone walls, wood-panelled side wall, light and
 * dark soil, a raised dark ridge with small curbs, a central tyre ring, a small wooden bridge,
 * a yellow shovel, RC excavators (left and right), small trucks at the back, excavator mural.
 * Models are TEMPORARY primitive builds of the toys in the photo.
 */
export function ConstructionZone({ castShadow }: { castShadow: boolean }) {
  const [mural] = usePhotoTextures(["/atom-world/textures/mural-excavator.webp"]);
  const r = ZONE_ROOM;
  const w = r.xMax - r.xMin;
  const d = r.zMax - r.zMin;
  const cx = (r.xMin + r.xMax) / 2;
  const cz = (r.zMin + r.zMax) / 2;
  const floor = useRepeatedTexture(() => floorTilesTexture(512), w / 1.6, d / 1.6);
  const stoneBack = useRepeatedTexture(claddingTexture, w / 1.2, 2);
  const stoneSide = useRepeatedTexture(claddingTexture, d / 1.2, 2);
  const ceiling = useRepeatedTexture(ceilingTilesTexture, w / 1.2, d / 1.2);
  const wood = useRepeatedTexture(woodTexture, 2, 2);
  const sand = useRepeatedTexture(() => soilTexture([186, 178, 164], 30, 3), 3, 3);
  const soil = useRepeatedTexture(() => soilTexture([88, 72, 58], 34, 8), 3, 3);
  const exitSign = useOwnedTexture(() => signTexture(["بازگشت به سالن اصلی"]));
  const pitW = PIT.xMax - PIT.xMin;
  const pitD = PIT.zMax - PIT.zMin;

  const ridgeGeo = useMemo(() => {
    const shape = new THREE.Shape(DARK_RIDGE.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: RIDGE_TOP - PIT.surface, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.05, bevelSegments: 2 });
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  // curbs along the ridge edge, alternating white / red (as in the photo)
  const curbs = useMemo(() => {
    const [a, b] = [DARK_RIDGE[1], DARK_RIDGE[2]];
    const n = 14;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ang = Math.atan2(b[0] - a[0], b[1] - a[1]);
    return Array.from({ length: n }, (_, i) => {
      const t = (i + 0.5) / n;
      return { x: a[0] + (b[0] - a[0]) * t + 0.08, z: a[1] + (b[1] - a[1]) * t + 0.06, ang, len: len / n - 0.02, red: i % 2 === 1 };
    });
  }, []);

  return (
    <group position={[ZONE_ORIGIN.x, 0, ZONE_ORIGIN.z]}>
      {/* room */}
      <mesh position={[cx, 0, cz]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial map={floor} roughness={0.2} />
      </mesh>
      <mesh position={[cx, r.height, cz]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial map={ceiling} roughness={0.9} />
      </mesh>
      <mesh position={[cx, r.height / 2, r.zMin]}>
        <planeGeometry args={[w, r.height]} />
        <meshStandardMaterial map={stoneBack} roughness={0.5} />
      </mesh>
      <mesh position={[r.xMin, r.height / 2, cz]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[d, r.height]} />
        <meshStandardMaterial map={stoneSide} roughness={0.5} />
      </mesh>
      <mesh position={[r.xMax, r.height / 2, cz]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[d, r.height]} />
        <meshStandardMaterial map={stoneSide} roughness={0.5} />
      </mesh>
      {/* front wall (the hall's back wall) with the open doorway */}
      {[
        [r.xMin, ZONE_OPENING.xMin, 0, r.height],
        [ZONE_OPENING.xMax, r.xMax, 0, r.height],
        [ZONE_OPENING.xMin, ZONE_OPENING.xMax, ZONE_OPENING.height, r.height],
      ].map(([x0, x1, y0, y1]) => (
        <mesh key={`${x0}${y0}`} position={[(x0 + x1) / 2, (y0 + y1) / 2, r.zMax]} rotation-y={Math.PI}>
          <planeGeometry args={[x1 - x0, y1 - y0]} />
          <meshStandardMaterial map={stoneBack} roughness={0.5} />
        </mesh>
      ))}
      {/* light panels */}
      {[-0.6, 2.2].map((x) =>
        [-1.6, 1.8].map((z) => (
          <mesh key={`${x}${z}`} position={[x, r.height - 0.01, z]} rotation-x={Math.PI / 2}>
            <planeGeometry args={[0.6, 0.6]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
        )),
      )}
      {/* wood-panelled side wall behind the right counter */}
      <mesh position={[ZONE_WOOD_WALL.x + 0.04, ZONE_WOOD_WALL.height / 2, (ZONE_WOOD_WALL.zMin + ZONE_WOOD_WALL.zMax) / 2]} castShadow={castShadow}>
        <boxGeometry args={[0.08, ZONE_WOOD_WALL.height, ZONE_WOOD_WALL.zMax - ZONE_WOOD_WALL.zMin]} />
        <meshStandardMaterial map={wood} roughness={0.6} />
      </mesh>
      {/* excavator wall painting */}
      <mesh position={[EXCAVATOR_MURAL.x, (EXCAVATOR_MURAL.yMin + EXCAVATOR_MURAL.yMax) / 2, r.zMin + 0.006]}>
        <planeGeometry args={[EXCAVATOR_MURAL.width, EXCAVATOR_MURAL.yMax - EXCAVATOR_MURAL.yMin]} />
        <meshStandardMaterial map={mural} roughness={0.8} />
      </mesh>

      {/* sand bed */}
      <mesh position={[PIT.xMin + pitW / 2, PIT.surface / 2, PIT.zMin + pitD / 2]}>
        <boxGeometry args={[pitW, PIT.surface, pitD]} />
        <meshStandardMaterial map={sand} roughness={1} />
      </mesh>
      <mesh geometry={ridgeGeo} position={[0, PIT.surface, 0]} castShadow={castShadow} receiveShadow>
        <meshStandardMaterial map={soil} roughness={1} />
      </mesh>
      {curbs.map((c, i) => (
        <mesh key={i} position={[c.x, PIT.surface + 0.03, c.z]} rotation-y={c.ang}>
          <boxGeometry args={[0.06, 0.06, c.len]} />
          <meshStandardMaterial color={c.red ? "#c7432f" : "#f1eee6"} roughness={0.7} />
        </mesh>
      ))}
      {/* central tyre ring filled with dark soil */}
      <group position={[ZONE_PROPS.tireRing.x, PIT.surface, ZONE_PROPS.tireRing.z]}>
        <mesh rotation-x={Math.PI / 2} castShadow={castShadow}>
          <torusGeometry args={[ZONE_PROPS.tireRing.r, 0.07, 10, 36]} />
          <meshStandardMaterial {...BLACK} />
        </mesh>
        <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[ZONE_PROPS.tireRing.r - 0.02, 32]} />
          <meshStandardMaterial map={soil} roughness={1} />
        </mesh>
      </group>
      {/* mounds */}
      <mesh position={[ZONE_PROPS.darkMound.x, PIT.surface, ZONE_PROPS.darkMound.z]} scale={[1, 0.35, 0.8]}>
        <sphereGeometry args={[ZONE_PROPS.darkMound.r, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial map={soil} roughness={1} />
      </mesh>
      <mesh position={[ZONE_PROPS.sandPile.x, PIT.surface, ZONE_PROPS.sandPile.z]} scale={[1, 0.4, 0.7]}>
        <sphereGeometry args={[ZONE_PROPS.sandPile.r, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial map={sand} roughness={1} />
      </mesh>

      <WoodenBridge />
      <Shovel />
      <SmallSigns />
      <group position={[ZONE_PROPS.excavatorLeft.x, PIT.surface, ZONE_PROPS.excavatorLeft.z]} rotation-y={ZONE_PROPS.excavatorLeft.rotY}>
        <RcExcavator castShadow={castShadow} boom={0.55} />
      </group>
      <group position={[ZONE_PROPS.excavatorRight.x, PIT.surface, ZONE_PROPS.excavatorRight.z]} rotation-y={ZONE_PROPS.excavatorRight.rotY}>
        <RcExcavator castShadow={castShadow} boom={0.95} />
      </group>
      {ZONE_PROPS.trucks.map((t) => (
        <group key={`${t.x}${t.z}`} position={[t.x, PIT.surface + 0.12, t.z]} rotation-y={t.rotY}>
          <RcTruck color={t.color} castShadow={castShadow} />
        </group>
      ))}

      {/* white counters around the pit, with the bucket of sand */}
      <InteractiveMachine id="construction-zone" markerHeight={1.9} markerAt={[-0.3, 0.65]}>
        {PIT_COUNTERS.map((c) => (
          <mesh key={`${c.xMin}${c.zMin}`} position={[(c.xMin + c.xMax) / 2, COUNTER_TOP / 2, (c.zMin + c.zMax) / 2]} castShadow={castShadow} receiveShadow>
            <boxGeometry args={[c.xMax - c.xMin, COUNTER_TOP, c.zMax - c.zMin]} />
            <meshStandardMaterial color="#f5f5f3" roughness={0.15} />
          </mesh>
        ))}
      </InteractiveMachine>
      <group position={[ZONE_PROPS.bucket.x, COUNTER_TOP, ZONE_PROPS.bucket.z]}>
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.15, 0.12, 0.24, 20, 1, true]} />
          <meshStandardMaterial color="#e8eef2" transparent opacity={0.55} roughness={0.2} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.17, 0]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.145, 20]} />
          <meshStandardMaterial map={sand} />
        </mesh>
      </group>

      {/* sign over the doorway back to the hall */}
      <mesh position={[(ZONE_OPENING.xMin + ZONE_OPENING.xMax) / 2, ZONE_OPENING.height + 0.3, r.zMax - 0.01]} rotation-y={Math.PI}>
        <planeGeometry args={[1.0, 0.3]} />
        <meshBasicMaterial map={exitSign} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Toy-scale RC excavator: tracks, rotating yellow body, cab, boom, arm, bucket. */
function RcExcavator({ castShadow, boom }: { castShadow: boolean; boom: number }) {
  return (
    <group>
      {[1, -1].map((s) => (
        <mesh key={s} position={[0.1 * s, 0.035, 0]} castShadow={castShadow}>
          <boxGeometry args={[0.07, 0.07, 0.34]} />
          <meshStandardMaterial {...BLACK} />
        </mesh>
      ))}
      <group position={[0, 0.07, 0]}>
        <mesh position={[0, 0.05, -0.03]} castShadow={castShadow}>
          <boxGeometry args={[0.24, 0.09, 0.3]} />
          <meshStandardMaterial {...YELLOW} />
        </mesh>
        <mesh position={[0.06, 0.15, 0.05]} castShadow={castShadow}>
          <boxGeometry args={[0.1, 0.12, 0.11]} />
          <meshStandardMaterial {...YELLOW} />
        </mesh>
        <mesh position={[0.06, 0.155, 0.106]}>
          <planeGeometry args={[0.08, 0.08]} />
          <meshStandardMaterial color="#1d2a33" roughness={0.1} metalness={0.4} />
        </mesh>
        {/* boom + arm + bucket */}
        <group position={[-0.04, 0.09, 0.1]} rotation-x={-boom}>
          <mesh position={[0, 0, 0.14]} castShadow={castShadow}>
            <boxGeometry args={[0.04, 0.05, 0.3]} />
            <meshStandardMaterial {...YELLOW} />
          </mesh>
          <group position={[0, 0, 0.28]} rotation-x={boom * 1.6}>
            <mesh position={[0, 0, 0.11]} castShadow={castShadow}>
              <boxGeometry args={[0.035, 0.04, 0.22]} />
              <meshStandardMaterial {...YELLOW} />
            </mesh>
            <mesh position={[0, -0.02, 0.23]} castShadow={castShadow}>
              <boxGeometry args={[0.08, 0.06, 0.05]} />
              <meshStandardMaterial color="#3a3a3a" metalness={0.6} roughness={0.4} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

/** Toy-scale dump truck. */
function RcTruck({ color, castShadow }: { color: string; castShadow: boolean }) {
  return (
    <group>
      <mesh position={[0, 0, 0]} castShadow={castShadow}>
        <boxGeometry args={[0.13, 0.04, 0.3]} />
        <meshStandardMaterial {...BLACK} />
      </mesh>
      <mesh position={[0, 0.06, 0.1]} castShadow={castShadow}>
        <boxGeometry args={[0.13, 0.09, 0.08]} />
        <meshStandardMaterial color={color} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.06, -0.04]} rotation-x={0.12} castShadow={castShadow}>
        <boxGeometry args={[0.14, 0.07, 0.19]} />
        <meshStandardMaterial color={color} roughness={0.45} />
      </mesh>
      {[0.1, -0.08].map((z) =>
        [1, -1].map((s) => (
          <mesh key={`${z}${s}`} position={[0.07 * s, -0.02, z]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.035, 0.035, 0.03, 12]} />
            <meshStandardMaterial {...BLACK} />
          </mesh>
        )),
      )}
    </group>
  );
}

function WoodenBridge() {
  const b = ZONE_PROPS.bridge;
  return (
    <group position={[b.x, RIDGE_TOP + 0.04, b.z]} rotation={[0, b.rotY, 0.12]}>
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[0, 0, -0.4 + i * 0.1]}>
          <boxGeometry args={[0.34, 0.02, 0.06]} />
          <meshStandardMaterial color={i % 2 ? "#c7a77a" : "#b18e5f"} roughness={0.8} />
        </mesh>
      ))}
      {[1, -1].map((s) => (
        <mesh key={s} position={[0.17 * s, 0.01, 0]}>
          <boxGeometry args={[0.03, 0.03, 0.9]} />
          <meshStandardMaterial color="#5e4630" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function Shovel() {
  const s = ZONE_PROPS.shovel;
  return (
    <group position={[s.x, RIDGE_TOP, s.z]}>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.5, 8]} />
        <meshStandardMaterial color="#c4571a" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.52, 0]} rotation-z={Math.PI / 2}>
        <torusGeometry args={[0.03, 0.01, 6, 12]} />
        <meshStandardMaterial color="#f2c200" />
      </mesh>
      <mesh position={[0, -0.02, 0]}>
        <boxGeometry args={[0.08, 0.1, 0.01]} />
        <meshStandardMaterial color="#7b7f85" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
}

/** Tiny sign posts and green sprigs along the curb (decorations in the photo). */
function SmallSigns() {
  const items = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => {
        const t = (i + 0.3) / 9;
        const [a, b] = [DARK_RIDGE[1], DARK_RIDGE[2]];
        return { x: a[0] + (b[0] - a[0]) * t - 0.05, z: a[1] + (b[1] - a[1]) * t - 0.05, sign: i % 3 === 0 };
      }),
    [],
  );
  return (
    <group>
      {items.map((it, i) => (
        <group key={i} position={[it.x, RIDGE_TOP, it.z]}>
          {it.sign ? (
            <>
              <mesh position={[0, 0.06, 0]}>
                <cylinderGeometry args={[0.004, 0.004, 0.12, 4]} />
                <meshStandardMaterial color="#dddddd" />
              </mesh>
              <mesh position={[0, 0.12, 0]}>
                <boxGeometry args={[0.04, 0.03, 0.004]} />
                <meshStandardMaterial color="#ffffff" />
              </mesh>
            </>
          ) : (
            <mesh position={[0, 0.03, 0]}>
              <coneGeometry args={[0.015, 0.07, 5]} />
              <meshStandardMaterial color="#5fa83a" />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}
