"use client";

import * as THREE from "three";
import { HALL, MEZZANINE } from "../data/environment";
import {
  CAGE_STOOL,
  FOOT_POOL,
  FOOTBALLS_SIZE,
  SCORE_STOOL,
  UPPER_MURALS,
  UPPER_Y,
  WOOD_PILLAR,
} from "../data/upperFloor";
import { InteractiveMachine } from "../interactions/InteractiveMachine";
import { useOwnedTexture, usePhotoTextures, useRepeatedTexture } from "../systems/AssetLoader";
import { ceilingTilesTexture, scoreboardTexture, woodTexture } from "../systems/textures";
import { ItemsLayer } from "../world/ItemsLayer";

const UPPER_PHOTOS = [...new Set(UPPER_MURALS.map((m) => m.texture)), "/atom-world/textures/atom-logo.webp"];
const GRAFFITI_BASE = "#b4b5b7";

/**
 * Upper floor after the two upper-floor photos: graffiti walls (billiard balls, dice, playing
 * cards, red/black/white), the big floor-pool field with orange-lit pockets, two FOOTBALLS cage
 * tables with red seats and a flip scoreboard, grey sofa, wood-clad column, white panelled ceiling.
 * Positions are approximate (two photos only).
 */
export function UpperFloor({ castShadow }: { castShadow: boolean }) {
  const photos = usePhotoTextures(UPPER_PHOTOS);
  const texFor = (url: string) => photos[UPPER_PHOTOS.indexOf(url)];
  const logo = photos[UPPER_PHOTOS.length - 1];
  const hw = HALL.halfWidth;
  const depth = MEZZANINE.zFront - MEZZANINE.zBack;
  const cz = (MEZZANINE.zFront + MEZZANINE.zBack) / 2;
  const wallH = HALL.height - UPPER_Y;
  const ceiling = useRepeatedTexture(ceilingTilesTexture, HALL.width / 1.2, depth / 1.2);
  const wood = useRepeatedTexture(woodTexture, 1, 2);
  const score = useOwnedTexture(scoreboardTexture);

  return (
    <group>
      {/* graffiti wall base (back + both side walls of the upper level) */}
      <mesh position={[0, UPPER_Y + wallH / 2, MEZZANINE.zBack + 0.004]}>
        <planeGeometry args={[HALL.width, wallH]} />
        <meshStandardMaterial color={GRAFFITI_BASE} roughness={0.9} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (hw - 0.004), UPPER_Y + wallH / 2, cz]} rotation-y={-s * (Math.PI / 2)}>
          <planeGeometry args={[depth, wallH]} />
          <meshStandardMaterial color={GRAFFITI_BASE} roughness={0.9} />
        </mesh>
      ))}
      {UPPER_MURALS.map((m) => {
        const h = m.yMax - m.yMin;
        const y = (m.yMin + m.yMax) / 2;
        const pos: [number, number, number] =
          m.wall === "back" ? [m.at, y, MEZZANINE.zBack + 0.01] : [m.wall === "left" ? -hw + 0.01 : hw - 0.01, y, m.at];
        const ry = m.wall === "back" ? 0 : m.wall === "left" ? Math.PI / 2 : -Math.PI / 2;
        return (
          <mesh key={m.id} position={pos} rotation-y={ry}>
            <planeGeometry args={[m.width, h]} />
            <meshStandardMaterial map={texFor(m.texture)} roughness={0.85} />
          </mesh>
        );
      })}

      {/* ceiling */}
      <mesh position={[0, HALL.height - 0.002, cz]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[HALL.width, depth]} />
        <meshStandardMaterial map={ceiling} roughness={0.9} />
      </mesh>
      {/* air conditioner on the left wall (seen above the cards painting) */}
      <mesh position={[-hw + 0.13, HALL.height - 0.45, -11.6]} castShadow={castShadow}>
        <boxGeometry args={[0.25, 0.3, 0.9]} />
        <meshStandardMaterial color="#f4f4f2" roughness={0.5} />
      </mesh>

      {/* wood-clad column */}
      <mesh
        position={[(WOOD_PILLAR.xMin + WOOD_PILLAR.xMax) / 2, (UPPER_Y + HALL.height) / 2, (WOOD_PILLAR.zMin + WOOD_PILLAR.zMax) / 2]}
        castShadow={castShadow}
      >
        <boxGeometry args={[WOOD_PILLAR.xMax - WOOD_PILLAR.xMin, wallH, WOOD_PILLAR.zMax - WOOD_PILLAR.zMin]} />
        <meshStandardMaterial map={wood} roughness={0.65} />
      </mesh>

      <InteractiveMachine id="foot-pool" markerHeight={UPPER_Y + 1.6} markerAt={[(FOOT_POOL.xMin + FOOT_POOL.xMax) / 2, (FOOT_POOL.zMin + FOOT_POOL.zMax) / 2]}>
        <FootPoolField logo={logo} castShadow={castShadow} />
      </InteractiveMachine>

      {/* FOOTBALLS tables, grey sofa and anything the manager placed up here */}
      <ItemsLayer level="upper" envId="amusement" castShadow={castShadow} />

      {/* wooden stool with the flip scoreboard */}
      <group position={[SCORE_STOOL.x, UPPER_Y, SCORE_STOOL.z]}>
        <mesh position={[0, 0.25, 0]} castShadow={castShadow}>
          <cylinderGeometry args={[0.12, 0.2, 0.5, 4]} />
          <meshStandardMaterial color="#c9a678" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.51, 0]} castShadow={castShadow}>
          <cylinderGeometry args={[0.22, 0.22, 0.03, 20]} />
          <meshStandardMaterial color="#d2b085" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.63, 0]} rotation-x={-0.25}>
          <boxGeometry args={[0.36, 0.18, 0.06]} />
          <meshStandardMaterial color="#151515" />
        </mesh>
        <mesh position={[0, 0.635, 0.032]} rotation-x={-0.25}>
          <planeGeometry args={[0.34, 0.16]} />
          <meshBasicMaterial map={score} toneMapped={false} />
        </mesh>
      </group>

    </group>
  );
}

/** Floor-pool field: navy felt, white modules with grey tops, six orange-lit pockets. */
function FootPoolField({ logo, castShadow }: { logo: THREE.Texture; castShadow: boolean }) {
  const f = FOOT_POOL;
  const w = f.xMax - f.xMin;
  const d = f.zMax - f.zMin;
  const cx = (f.xMin + f.xMax) / 2;
  const cz = (f.zMin + f.zMax) / 2;
  const y = UPPER_Y;
  const b = f.border;
  const sides: { pos: [number, number, number]; size: [number, number, number] }[] = [
    { pos: [cx, 0, f.zMin + b / 2], size: [w, f.height, b] },
    { pos: [cx, 0, f.zMax - b / 2], size: [w, f.height, b] },
    { pos: [f.xMin + b / 2, 0, cz], size: [b, f.height, d - 2 * b] },
    { pos: [f.xMax - b / 2, 0, cz], size: [b, f.height, d - 2 * b] },
  ];
  const pockets: [number, number][] = [
    [f.xMin + b / 2, f.zMin + b / 2],
    [cx, f.zMin + b / 2],
    [f.xMax - b / 2, f.zMin + b / 2],
    [f.xMin + b / 2, f.zMax - b / 2],
    [cx, f.zMax - b / 2],
    [f.xMax - b / 2, f.zMax - b / 2],
  ];
  return (
    <group position={[0, y, 0]}>
      <mesh position={[cx, 0.015, cz]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[w - 2 * b, d - 2 * b]} />
        <meshStandardMaterial color="#1b2541" roughness={0.95} />
      </mesh>
      {sides.map((s, i) => (
        <group key={i} position={s.pos}>
          <mesh position={[0, s.size[1] / 2, 0]} castShadow={castShadow} receiveShadow>
            <boxGeometry args={s.size} />
            <meshStandardMaterial color="#f1f1ef" roughness={0.5} />
          </mesh>
          <mesh position={[0, s.size[1] + 0.015, 0]} castShadow={castShadow}>
            <boxGeometry args={[s.size[0] + 0.02, 0.03, s.size[2] + 0.02]} />
            <meshStandardMaterial color="#767a81" roughness={0.45} />
          </mesh>
        </group>
      ))}
      {/* orange glowing pockets cut into the modules */}
      {pockets.map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, f.height / 2 + 0.02, z]}>
          <boxGeometry args={[0.36, f.height + 0.02, 0.36]} />
          <meshBasicMaterial color="#ffad1f" toneMapped={false} />
        </mesh>
      ))}
      {/* round ATOM logo printed on the left module (visible in the photo) */}
      <mesh position={[f.xMin + b / 2, f.height + 0.032, cz]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.17, 32]} />
        <meshBasicMaterial map={logo} transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

/** "FOOTBALLS" cage table: black steel frame, white net sides, red inner panels, top grid. */
export function FootballsTable({ label, net, castShadow }: { label: THREE.Texture; net: THREE.Texture; castShadow: boolean }) {
  const { x: W, z: D, height: H } = FOOTBALLS_SIZE;
  const bar = { color: "#111214", roughness: 0.4, metalness: 0.5 } as const;
  const posts: [number, number][] = [
    [W / 2, D / 2],
    [-W / 2, D / 2],
    [W / 2, -D / 2],
    [-W / 2, -D / 2],
  ];
  return (
    <group>
      {posts.map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, H / 2, z]} castShadow={castShadow}>
          <boxGeometry args={[0.04, H, 0.04]} />
          <meshStandardMaterial {...bar} />
        </mesh>
      ))}
      {/* top rails (thick front rail carries the FOOTBALLS print) */}
      {[1, -1].map((s) => (
        <mesh key={`r${s}`} position={[(W / 2) * s, H, 0]} castShadow={castShadow}>
          <boxGeometry args={[0.07, 0.07, D]} />
          <meshStandardMaterial {...bar} />
        </mesh>
      ))}
      {[1, -1].map((s) => (
        <mesh key={`f${s}`} position={[0, H, (D / 2) * s]} castShadow={castShadow}>
          <boxGeometry args={[W, 0.07, 0.07]} />
          <meshStandardMaterial {...bar} />
        </mesh>
      ))}
      <mesh position={[W / 2 + 0.036, H, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[D * 0.6, 0.065]} />
        <meshBasicMaterial map={label} />
      </mesh>
      {/* red inner panels + bottom */}
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[W - 0.06, 0.04, D - 0.06]} />
        <meshStandardMaterial color="#c81e1e" roughness={0.6} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={`p${s}`} position={[0, H * 0.45, (D / 2 - 0.04) * s]}>
          <boxGeometry args={[W - 0.08, H * 0.7, 0.02]} />
          <meshStandardMaterial color="#c81e1e" roughness={0.6} />
        </mesh>
      ))}
      {/* white net on the long sides and a top grid */}
      {[1, -1].map((s) => (
        <mesh key={`n${s}`} position={[(W / 2) * s, H / 2, 0]} rotation-y={Math.PI / 2}>
          <planeGeometry args={[D, H]} />
          <meshBasicMaterial map={net} transparent side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
      <mesh position={[0, H - 0.01, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[W, D]} />
        <meshBasicMaterial map={net} color="#222" transparent side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* red-seat cage stool in front */}
      <group position={[0, 0, D / 2 + 0.05 + CAGE_STOOL.z / 2]}>
        <mesh position={[0, CAGE_STOOL.height - 0.04, 0]} castShadow={castShadow}>
          <boxGeometry args={[CAGE_STOOL.x, 0.08, CAGE_STOOL.z]} />
          <meshStandardMaterial color="#d32626" roughness={0.6} />
        </mesh>
        {[1, -1].map((s) => (
          <mesh key={s} position={[(CAGE_STOOL.x / 2 - 0.02) * s, CAGE_STOOL.height / 2 - 0.04, 0]}>
            <planeGeometry args={[CAGE_STOOL.z, CAGE_STOOL.height - 0.08]} />
            <meshBasicMaterial map={net} transparent side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        ))}
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[CAGE_STOOL.x, 0.04, CAGE_STOOL.z]} />
          <meshStandardMaterial {...bar} />
        </mesh>
      </group>
    </group>
  );
}

/** Grey-blue patterned two-seat sofa with dark carved legs (against the right wall, facing -x). */
export function GraySofa({ length, depth = 0.85, castShadow }: { length: number; depth?: number; castShadow: boolean }) {
  const s = { length, depth };
  const fabric = { color: "#566273", roughness: 0.95 } as const;
  return (
    <group>
      <mesh position={[0, 0.3, 0.02]} castShadow={castShadow}>
        <boxGeometry args={[s.length, 0.26, s.depth - 0.1]} />
        <meshStandardMaterial {...fabric} />
      </mesh>
      <mesh position={[0, 0.47, 0.08]} castShadow={castShadow}>
        <boxGeometry args={[s.length - 0.3, 0.1, s.depth - 0.3]} />
        <meshStandardMaterial color="#3a2b24" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.72, -s.depth / 2 + 0.12]} castShadow={castShadow}>
        <boxGeometry args={[s.length, 0.62, 0.22]} />
        <meshStandardMaterial {...fabric} />
      </mesh>
      {[1, -1].map((k) => (
        <mesh key={k} position={[(s.length / 2 - 0.1) * k, 0.55, 0]} castShadow={castShadow}>
          <boxGeometry args={[0.2, 0.55, s.depth]} />
          <meshStandardMaterial {...fabric} />
        </mesh>
      ))}
      {[
        [s.length / 2 - 0.1, s.depth / 2 - 0.1],
        [-s.length / 2 + 0.1, s.depth / 2 - 0.1],
        [s.length / 2 - 0.1, -s.depth / 2 + 0.1],
        [-s.length / 2 + 0.1, -s.depth / 2 + 0.1],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.08, z]}>
          <cylinderGeometry args={[0.04, 0.03, 0.16, 8]} />
          <meshStandardMaterial color="#2b1d16" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}
