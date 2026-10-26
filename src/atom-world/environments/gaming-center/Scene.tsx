"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import { InteractiveMachine } from "../../interactions/InteractiveMachine";
import { useOwnedTexture, usePhotoTextures, useRepeatedTexture } from "../../systems/AssetLoader";
import { StaticBatch } from "../../systems/StaticBatch";
import { ceilingTilesTexture, floorTilesTexture, woodTexture } from "../../systems/textures";
import type { EnvSceneProps } from "../../world/types";
import { WALLS, wallPieces } from "./index";
import {
  ARCH,
  COUNTER,
  EAST_WALL,
  FRIDGE,
  GC_HEIGHT,
  GC_ORIGIN,
  PILLAR,
  ROOMS,
  SHELVES,
  STAIR_CEILING,
  STAIR_DOOR,
  STAIR_STEPS,
  STAIR_TOP_Y,
  STATIONS,
  STREET_EXIT,
  TRAIN_DOOR,
  TRAIN_MURAL,
  WALL_T,
  WEST_WALL,
} from "./layout";
import { ItemsLayer } from "../../world/ItemsLayer";
import { archInsetTexture, chalkboardTexture, coffeeLogoTexture, fridgeTexture, stationSignTexture, welcomeTexture, whitePanelTexture } from "./textures";

const ART = "/atom-world/envs/gaming-center";
const URLS = [
  "mural-castle",
  "mural-paris",
  "wall-portraits",
  "mural-train",
  "counter-shelves",
  "controllers-wall",
  "stone-wall",
  "painting-paris",
  "poster-deer",
].map((n) => `${ART}/${n}.webp`);

const H = GC_HEIGHT;
const { hall, train, stairs } = ROOMS;
const OFF = WALL_T / 2 + 0.005;
const DOOR_MID = (STAIR_DOOR.xMin + STAIR_DOOR.xMax) / 2;

type Face = "+x" | "-x" | "+z" | "-z";

/** A flat panel on a wall face: `at` is the wall line, `a`–`b` the range along it. */
function Panel({
  face,
  at,
  a,
  b,
  y0,
  y1,
  map,
  color = "#ffffff",
  lift = 0,
  basic,
  emissive,
  transparent,
}: {
  face: Face;
  at: number;
  a: number;
  b: number;
  y0: number;
  y1: number;
  map?: THREE.Texture;
  color?: string;
  /** Extra distance from the wall (stacked panels). */
  lift?: number;
  basic?: boolean;
  emissive?: number;
  transparent?: boolean;
}) {
  const c = (a + b) / 2;
  const d = OFF + lift;
  const y = (y0 + y1) / 2;
  const pos: [number, number, number] =
    face === "+x" ? [at + d, y, c] : face === "-x" ? [at - d, y, c] : face === "+z" ? [c, y, at + d] : [c, y, at - d];
  const rot = face === "+x" ? Math.PI / 2 : face === "-x" ? -Math.PI / 2 : face === "+z" ? 0 : Math.PI;
  return (
    <mesh position={pos} rotation-y={rot}>
      <planeGeometry args={[Math.abs(b - a), y1 - y0]} />
      {basic ? (
        <meshBasicMaterial map={map ?? null} color={color} toneMapped={false} transparent={transparent} alphaTest={transparent ? 0.5 : 0} side={THREE.DoubleSide} />
      ) : (
        <meshStandardMaterial
          map={map ?? null}
          color={color}
          roughness={0.85}
          emissive={emissive ? "#ffffff" : "#000000"}
          emissiveMap={emissive ? (map ?? null) : null}
          emissiveIntensity={emissive ?? 0}
          side={THREE.DoubleSide}
        />
      )}
    </mesh>
  );
}

/**
 * 🎮 Gaming-center scene, from the owner's photos (see ./layout.ts). Static parts are batched;
 * the interaction markers stay separate.
 */
export default function GamingCenterScene({ quality, preset }: EnvSceneProps) {
  const [castle, paris, portraits, trainArt, shelves, controllers, stone, paintingParis, deer] = usePhotoTextures(URLS);
  const cast = preset.shadows;
  const floorHall = useRepeatedTexture(() => floorTilesTexture(512), (hall.xMax - hall.xMin) / 1.2, (hall.zMax - hall.zMin) / 1.2);
  const floorSide = useRepeatedTexture(() => floorTilesTexture(512), 5, 5);
  const ceiling = useRepeatedTexture(ceilingTilesTexture, (hall.xMax - hall.xMin) / 1.2, (hall.zMax - hall.zMin) / 1.2);
  const ceilingSide = useRepeatedTexture(ceilingTilesTexture, 5, 5);
  const woodNorth = useRepeatedTexture(woodTexture, 3, 2);
  const woodEast = useRepeatedTexture(woodTexture, 4, 2);
  const stairPanels = useRepeatedTexture(whitePanelTexture, 14, 10);
  const stairPanelsEnd = useRepeatedTexture(whitePanelTexture, 3, 10);
  const stoneTex = useOwnedTexture(() => {
    const t = stone.clone();
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(2, 1);
    t.needsUpdate = true;
    return t;
  });
  const chalk = useOwnedTexture(chalkboardTexture);
  const coffee = useOwnedTexture(coffeeLogoTexture);
  const welcome = useOwnedTexture(welcomeTexture);
  const archInset = useOwnedTexture(archInsetTexture);
  const drinks = useOwnedTexture(fridgeTexture);
  const [signTex] = useState(() => new Map(STATIONS.filter((s) => s.sign && s.number !== null).map((s) => [s.number!, stationSignTexture(s.number!)])));
  useEffect(() => () => signTex.forEach((t) => t.dispose()), [signTex]);
  const bulbs = [-1.6, -0.6, 0.4];

  return (
    <group position={[GC_ORIGIN.x, 0, GC_ORIGIN.z]}>
      <StaticBatch>
        {/* ── floors and ceilings */}
        <mesh rotation-x={-Math.PI / 2} position={[(hall.xMin + hall.xMax) / 2, 0, (hall.zMin + hall.zMax) / 2]} receiveShadow>
          <planeGeometry args={[hall.xMax - hall.xMin, hall.zMax - hall.zMin]} />
          <meshStandardMaterial map={floorHall} roughness={0.25} />
        </mesh>
        {[train].map((r) => (
          <group key={r.xMin}>
            <mesh rotation-x={-Math.PI / 2} position={[(r.xMin + r.xMax) / 2, 0, (r.zMin + r.zMax) / 2]} receiveShadow>
              <planeGeometry args={[r.xMax - r.xMin, r.zMax - r.zMin]} />
              <meshStandardMaterial map={floorSide} roughness={0.25} />
            </mesh>
            <mesh rotation-x={Math.PI / 2} position={[(r.xMin + r.xMax) / 2, H, (r.zMin + r.zMax) / 2]}>
              <planeGeometry args={[r.xMax - r.xMin, r.zMax - r.zMin]} />
              <meshStandardMaterial map={ceilingSide} roughness={0.9} />
            </mesh>
          </group>
        ))}
        <mesh rotation-x={Math.PI / 2} position={[(hall.xMin + hall.xMax) / 2, H, (hall.zMin + hall.zMax) / 2]}>
          <planeGeometry args={[hall.xMax - hall.xMin, hall.zMax - hall.zMin]} />
          <meshStandardMaterial map={ceiling} roughness={0.9} />
        </mesh>
        {/* recessed ceiling lights */}
        {[
          [-2.5, -4],
          [2.5, -4],
          [-2.5, 1],
          [2.5, 1],
          [-2.5, 5],
          [2.5, 5],
          [-2.8, -9.6],
        ].map(([x, z]) => (
          <mesh key={`${x}${z}`} rotation-x={Math.PI / 2} position={[x, H - 0.005, z]}>
            <circleGeometry args={[0.12, 16]} />
            <meshBasicMaterial color="#fffbe9" toneMapped={false} />
          </mesh>
        ))}

        {/* ── walls (light grey; finishes below are panels on their faces) */}
        {WALLS.flatMap(wallPieces).map(([x0, y0, z0, x1, y1, z1], i) => (
          <mesh key={i} position={[(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]} receiveShadow>
            <boxGeometry args={[x1 - x0, y1 - y0, z1 - z0]} />
            <meshStandardMaterial color="#d3d2ce" roughness={0.9} />
          </mesh>
        ))}

        {/* north wall: brown by the train-room door, dark counter niche with the purple shelves, wood planks */}
        <Panel face="+z" at={hall.zMin} a={hall.xMin} b={TRAIN_DOOR.xMin} y0={0} y1={H} color="#5a3b2e" />
        <Panel face="+z" at={hall.zMin} a={TRAIN_DOOR.xMax} b={-2.75} y0={0} y1={H} color="#5a3b2e" />
        <Panel face="+z" at={hall.zMin} a={TRAIN_DOOR.xMin} b={TRAIN_DOOR.xMax} y0={TRAIN_DOOR.height} y1={H} color="#5a3b2e" />
        <Panel face="+z" at={hall.zMin} a={-2.75} b={1.35} y0={0} y1={H} color="#2b2019" />
        <Panel face="+z" at={hall.zMin} a={SHELVES.xMin} b={SHELVES.xMax} y0={SHELVES.yMin} y1={SHELVES.yMax} map={shelves} emissive={0.55} lift={0.01} />
        <Panel face="+z" at={hall.zMin} a={1.35} b={STAIR_DOOR.xMin} y0={0} y1={H} map={woodNorth} color="#c9935c" />
        <Panel face="+z" at={hall.zMin} a={STAIR_DOOR.xMax} b={hall.xMax} y0={0} y1={H} map={woodNorth} color="#c9935c" />
        <Panel face="+z" at={hall.zMin} a={STAIR_DOOR.xMin} b={STAIR_DOOR.xMax} y0={STAIR_DOOR.height} y1={H} map={woodNorth} color="#c9935c" />

        {/* east wall: wood planks (controllers, chalkboard, sign 2), black arch panel, castle mural, dark wall */}
        <Panel face="-x" at={hall.xMax} a={EAST_WALL.wood.zMin} b={EAST_WALL.wood.zMax} y0={0} y1={H} map={woodEast} color="#c9935c" />
        <Panel face="-x" at={hall.xMax} a={EAST_WALL.controllers.zMin} b={EAST_WALL.controllers.zMax} y0={EAST_WALL.controllers.yMin} y1={EAST_WALL.controllers.yMax} map={controllers} lift={0.01} />
        <Panel face="-x" at={hall.xMax} a={EAST_WALL.chalkboard.zMin} b={EAST_WALL.chalkboard.zMax} y0={EAST_WALL.chalkboard.yMin} y1={EAST_WALL.chalkboard.yMax} map={chalk} lift={0.02} />
        <Panel face="-x" at={hall.xMax} a={EAST_WALL.black.zMin} b={EAST_WALL.black.zMax} y0={0} y1={H} color="#141414" />
        <Panel face="-x" at={hall.xMax} a={EAST_WALL.castle.zMin} b={EAST_WALL.castle.zMax} y0={0} y1={0.63} color="#7d6e55" />
        <Panel face="-x" at={hall.xMax} a={EAST_WALL.castle.zMin} b={EAST_WALL.castle.zMax} y0={0.63} y1={H} map={castle} />
        <Panel face="-x" at={hall.xMax} a={EAST_WALL.dark.zMin} b={EAST_WALL.dark.zMax} y0={0} y1={H} color="#1d2026" />
        <Panel face="-x" at={hall.xMax} a={5.4} b={6.3} y0={1.6} y1={2.2} map={paintingParis} lift={0.02} />

        {/* west wall: stone cladding under the AC, Paris mural, white pilaster with the deer poster, portrait wall */}
        <Panel face="+x" at={hall.xMin} a={WEST_WALL.stone.zMin} b={WEST_WALL.stone.zMax} y0={0} y1={2.15} map={stoneTex} />
        <Panel face="+x" at={hall.xMin} a={WEST_WALL.stone.zMin} b={WEST_WALL.stone.zMax} y0={2.15} y1={H} color="#161616" />
        <Panel face="+x" at={hall.xMin} a={WEST_WALL.paris.zMin} b={WEST_WALL.paris.zMax} y0={0} y1={1.02} color="#5f5a58" />
        <Panel face="+x" at={hall.xMin} a={WEST_WALL.paris.zMin} b={WEST_WALL.paris.zMax} y0={1.02} y1={H} map={paris} />
        <Panel face="+x" at={hall.xMin} a={WEST_WALL.portraits.zMin} b={WEST_WALL.portraits.zMax} y0={0} y1={1.18} color="#22303f" />
        <Panel face="+x" at={hall.xMin} a={WEST_WALL.portraits.zMin} b={WEST_WALL.portraits.zMax} y0={1.18} y1={H} map={portraits} />
        <mesh position={[hall.xMin + WALL_T / 2 + WEST_WALL.pilaster.depth / 2, H / 2, (WEST_WALL.pilaster.zMin + WEST_WALL.pilaster.zMax) / 2]}>
          <boxGeometry args={[WEST_WALL.pilaster.depth, H, WEST_WALL.pilaster.zMax - WEST_WALL.pilaster.zMin]} />
          <meshStandardMaterial color="#ecebe7" roughness={0.8} />
        </mesh>
        <Panel face="+x" at={hall.xMin + WEST_WALL.pilaster.depth} a={0.05} b={0.4} y0={1.75} y1={2.3} map={deer} lift={0.005} />
        {/* split air conditioner over the stone wall (photo 11) */}
        <mesh position={[hall.xMin + WALL_T / 2 + 0.12, 2.45, 5.6]}>
          <boxGeometry args={[0.24, 0.32, 1.0]} />
          <meshStandardMaterial color="#f4f4f2" roughness={0.4} />
        </mesh>

        {/* train room: couple-and-train mural on its north wall */}
        <Panel face="+z" at={train.zMin} a={TRAIN_MURAL.xMin} b={TRAIN_MURAL.xMax} y0={0.8} y1={2.48} map={trainArt} />

        {/* ── the arch on the black panel: a closed decoration (no room behind it) */}
        <Panel face="-x" at={hall.xMax} a={ARCH.zMin} b={ARCH.zMax} y0={0} y1={ARCH.height} map={archInset} basic transparent lift={0.004} />

        {/* ── train-room door: black frame */}
        {[TRAIN_DOOR.xMin, TRAIN_DOOR.xMax].map((x) => (
          <mesh key={x} position={[x, TRAIN_DOOR.height / 2, hall.zMin]}>
            <boxGeometry args={[0.07, TRAIN_DOOR.height, WALL_T + 0.04]} />
            <meshStandardMaterial color="#111" roughness={0.5} />
          </mesh>
        ))}
        <mesh position={[(TRAIN_DOOR.xMin + TRAIN_DOOR.xMax) / 2, TRAIN_DOOR.height, hall.zMin]}>
          <boxGeometry args={[TRAIN_DOOR.xMax - TRAIN_DOOR.xMin + 0.07, 0.07, WALL_T + 0.04]} />
          <meshStandardMaterial color="#111" roughness={0.5} />
        </mesh>

        {/* ── counter: wood front, stone panel with the coffee-cup logo, beam and hanging bulbs */}
        <mesh position={[(COUNTER.xMin + COUNTER.xMax) / 2, COUNTER.height / 2, (COUNTER.zMin + COUNTER.zMax) / 2]} castShadow={cast} receiveShadow>
          <boxGeometry args={[COUNTER.xMax - COUNTER.xMin, COUNTER.height, COUNTER.zMax - COUNTER.zMin]} />
          <meshStandardMaterial map={woodNorth} color="#b5743f" roughness={0.6} />
        </mesh>
        <mesh position={[(COUNTER.xMin + COUNTER.xMax) / 2, COUNTER.height + 0.02, (COUNTER.zMin + COUNTER.zMax) / 2]}>
          <boxGeometry args={[COUNTER.xMax - COUNTER.xMin + 0.06, 0.04, COUNTER.zMax - COUNTER.zMin + 0.06]} />
          <meshStandardMaterial color="#3b2a1f" roughness={0.5} />
        </mesh>
        <mesh position={[0.35, (COUNTER.height + 0.1) / 2, COUNTER.zMax + 0.04]}>
          <boxGeometry args={[0.8, COUNTER.height + 0.1, 0.08]} />
          <meshStandardMaterial color="#8c8e8b" roughness={0.7} />
        </mesh>
        <mesh position={[0.35, (COUNTER.height + 0.1) / 2, COUNTER.zMax + 0.081]}>
          <planeGeometry args={[0.78, COUNTER.height + 0.08]} />
          <meshStandardMaterial map={coffee} roughness={0.7} />
        </mesh>
        {/* laptop and console boxes on the counter */}
        <mesh position={[-1.0, COUNTER.height + 0.16, COUNTER.zMin + 0.25]} rotation-x={-0.25}>
          <boxGeometry args={[0.36, 0.25, 0.02]} />
          <meshStandardMaterial color="#2a2c30" roughness={0.4} />
        </mesh>
        {[0.6, 0.86].map((x, i) => (
          <mesh key={x} position={[x, COUNTER.height + 0.2, COUNTER.zMin + 0.2]}>
            <boxGeometry args={[0.24, 0.36, 0.12]} />
            <meshStandardMaterial color={i === 0 ? "#f3f3f3" : "#e9eaec"} roughness={0.5} />
          </mesh>
        ))}
        <mesh position={[-0.7, 2.55, -6.0]}>
          <boxGeometry args={[4.1, 0.16, 0.2]} />
          <meshStandardMaterial color="#3a2a1e" roughness={0.7} />
        </mesh>
        {bulbs.map((x) => (
          <group key={x} position={[x, 0, -5.95]}>
            <mesh position={[0, 2.5, 0]}>
              <cylinderGeometry args={[0.006, 0.006, 0.8, 4]} />
              <meshStandardMaterial color="#c9b48a" />
            </mesh>
            <mesh position={[0, 2.06, 0]}>
              <sphereGeometry args={[0.07, 12, 10]} />
              <meshBasicMaterial color="#ffcf7a" toneMapped={false} />
            </mesh>
          </group>
        ))}
        {/* drinks fridge */}
        <mesh position={[(FRIDGE.xMin + FRIDGE.xMax) / 2, FRIDGE.height / 2, (FRIDGE.zMin + FRIDGE.zMax) / 2]} castShadow={cast}>
          <boxGeometry args={[FRIDGE.xMax - FRIDGE.xMin, FRIDGE.height, FRIDGE.zMax - FRIDGE.zMin]} />
          <meshStandardMaterial color="#1b1b1d" roughness={0.4} />
        </mesh>
        <mesh position={[(FRIDGE.xMin + FRIDGE.xMax) / 2, FRIDGE.height * 0.45, FRIDGE.zMax + 0.003]}>
          <planeGeometry args={[FRIDGE.xMax - FRIDGE.xMin - 0.08, FRIDGE.height * 0.8]} />
          <meshStandardMaterial map={drinks} emissive="#ffffff" emissiveMap={drinks} emissiveIntensity={0.45} roughness={0.1} />
        </mesh>

        {/* ── column with the blue bin (photo 12) */}
        <mesh position={[PILLAR.x, H / 2, PILLAR.z]} castShadow={cast}>
          <boxGeometry args={[PILLAR.size, H, PILLAR.size]} />
          <meshStandardMaterial color="#c9c3bb" roughness={0.85} />
        </mesh>
        <mesh position={[PILLAR.x, 0.07, PILLAR.z]}>
          <boxGeometry args={[PILLAR.size + 0.04, 0.14, PILLAR.size + 0.04]} />
          <meshStandardMaterial color="#4a443e" roughness={0.6} />
        </mesh>
        <mesh position={[PILLAR.x + 0.5, 0.28, PILLAR.z + 0.15]}>
          <boxGeometry args={[0.34, 0.56, 0.3]} />
          <meshStandardMaterial color="#2a4fd6" roughness={0.5} />
        </mesh>

        {/* ── stations, sofas, armchairs (movable items; their places can be changed in the admin editor) */}
        {/* items are in world coordinates: undo this scene's origin offset */}
        <group position={[-GC_ORIGIN.x, 0, -GC_ORIGIN.z]}>
          <ItemsLayer envId="gaming-center" level="main" castShadow={cast} />
        </group>

        {/* ── station number signs that are not already in the mural photos */}
        {STATIONS.filter((s) => s.sign && s.number !== null).map((s) => (
          <mesh key={s.number!} position={[s.sign!.x, s.sign!.y, s.sign!.z]} rotation-y={s.sign!.rotY}>
            <planeGeometry args={[0.34, 0.21]} />
            <meshStandardMaterial map={signTex.get(s.number!) ?? null} transparent alphaTest={0.4} roughness={0.5} />
          </mesh>
        ))}

        {/* ── stairs to the street (north of the hall): white panelled walls, 14 marble steps, WELCOME paddle */}
        <Panel face="+x" at={stairs.xMin} a={stairs.zMin} b={stairs.zMax} y0={0} y1={STAIR_CEILING} map={stairPanels} />
        <Panel face="-x" at={stairs.xMax} a={stairs.zMin} b={stairs.zMax} y0={0} y1={STAIR_CEILING} map={stairPanels} />
        <Panel face="-z" at={hall.zMin} a={stairs.xMin} b={STAIR_DOOR.xMin} y0={0} y1={STAIR_CEILING} map={stairPanelsEnd} />
        <Panel face="-z" at={hall.zMin} a={STAIR_DOOR.xMax} b={stairs.xMax} y0={0} y1={STAIR_CEILING} map={stairPanelsEnd} />
        <Panel face="-z" at={hall.zMin} a={STAIR_DOOR.xMin} b={STAIR_DOOR.xMax} y0={STAIR_DOOR.height} y1={STAIR_CEILING} map={stairPanelsEnd} />
        <Panel face="-z" at={hall.zMin} a={DOOR_MID - 0.5} b={DOOR_MID + 0.5} y0={3.05} y1={3.24} map={welcome} lift={0.02} transparent basic />
        <mesh position={[DOOR_MID, 2.85, hall.zMin - 0.16]}>
          <sphereGeometry args={[0.06, 10, 8]} />
          <meshStandardMaterial color="#e8e8e8" roughness={0.3} />
        </mesh>
        <mesh rotation-x={Math.PI / 2} position={[(stairs.xMin + stairs.xMax) / 2, STAIR_CEILING, (stairs.zMin + stairs.zMax) / 2]}>
          <planeGeometry args={[stairs.xMax - stairs.xMin, stairs.zMax - stairs.zMin]} />
          <meshStandardMaterial color="#f0f2f3" roughness={0.9} />
        </mesh>
        {/* bottom landing in front of the stair door */}
        <mesh rotation-x={-Math.PI / 2} position={[(stairs.xMin + stairs.xMax) / 2, 0.002, (STAIR_STEPS.zStart + stairs.zMax) / 2]} receiveShadow>
          <planeGeometry args={[stairs.xMax - stairs.xMin, stairs.zMax - STAIR_STEPS.zStart]} />
          <meshStandardMaterial color="#e3d9c8" roughness={0.35} />
        </mesh>
        {Array.from({ length: STAIR_STEPS.count }, (_, i) => {
          const k = i + 1;
          const z0 = STAIR_STEPS.zStart - i * STAIR_STEPS.run;
          const top = k * STAIR_STEPS.rise;
          const z1 = k === STAIR_STEPS.count ? stairs.zMin : z0 - STAIR_STEPS.run;
          return (
            <mesh key={k} position={[(stairs.xMin + stairs.xMax) / 2, top / 2, (z0 + z1) / 2]} receiveShadow castShadow={cast}>
              <boxGeometry args={[stairs.xMax - stairs.xMin, top, z0 - z1]} />
              <meshStandardMaterial color={k % 2 ? "#e6dccb" : "#e0d5c3"} roughness={0.35} />
            </mesh>
          );
        })}
        {/* street door at the top: daylight */}
        <Panel face="+z" at={stairs.zMin} a={DOOR_MID - 0.5} b={DOOR_MID + 0.5} y0={STAIR_TOP_Y} y1={STAIR_TOP_Y + 2.4} color="#fdfbf2" basic lift={0.01} />
        <Panel face="+z" at={stairs.zMin} a={stairs.xMin} b={stairs.xMax} y0={0} y1={STAIR_CEILING} map={stairPanelsEnd} />
        {/* stair door into the hall: white frame, the leaf standing open towards the stairs */}
        {[STAIR_DOOR.xMin, STAIR_DOOR.xMax].map((x) => (
          <mesh key={x} position={[x, STAIR_DOOR.height / 2, hall.zMin]}>
            <boxGeometry args={[0.06, STAIR_DOOR.height, WALL_T + 0.04]} />
            <meshStandardMaterial color="#f4f4f2" roughness={0.5} />
          </mesh>
        ))}
        <group position={[STAIR_DOOR.xMin + 0.03, 0, hall.zMin - WALL_T / 2]} rotation-y={1.7}>
          <mesh position={[0.47, STAIR_DOOR.height / 2, 0]}>
            <boxGeometry args={[0.94, STAIR_DOOR.height - 0.04, 0.04]} />
            <meshStandardMaterial color="#f4f4f2" roughness={0.5} />
          </mesh>
          <mesh position={[0.47, 1.55, 0.025]}>
            <planeGeometry args={[0.6, 0.6]} />
            <meshStandardMaterial color="#1a2a33" roughness={0.1} metalness={0.3} />
          </mesh>
        </group>

      </StaticBatch>

      {/* interaction markers (not batched: they bob) */}
      <group position={[-1.3, 0, COUNTER.zMax]}>
        <InteractiveMachine id="gc-counter" markerHeight={1.55}>
          {null}
        </InteractiveMachine>
      </group>
      <group position={[hall.xMax - 0.3, 0, (EAST_WALL.chalkboard.zMin + EAST_WALL.chalkboard.zMax) / 2]}>
        <InteractiveMachine id="gc-chalkboard" markerHeight={2.7}>
          {null}
        </InteractiveMachine>
      </group>
      <group position={[STREET_EXIT.x, STAIR_TOP_Y, STREET_EXIT.z]}>
        <InteractiveMachine id="gc-street-exit" markerHeight={2.3}>
          {null}
        </InteractiveMachine>
      </group>

      {/* purple glow of the shelves, warm bulbs (not on «low») */}
      {quality !== "low" && (
        <>
          <pointLight position={[-0.7, 1.8, -6.3]} color="#8a4dff" intensity={4} distance={5} decay={2} />
          <pointLight position={[-0.6, 2.0, -5.3]} color="#ffc37a" intensity={2} distance={4} decay={2} />
        </>
      )}
    </group>
  );
}
