"use client";

import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import {
  CLOCK,
  COUNTER,
  HALL,
  MEZZANINE,
  MURALS,
  PILASTER_SIZE,
  PILASTERS,
  STAIRS,
  ZONE_DOOR,
} from "../data/environment";
import { InteractiveMachine } from "../interactions/InteractiveMachine";
import { useOwnedTexture, usePhotoTextures, useRepeatedTexture } from "../systems/AssetLoader";
import { StaticBatch } from "../systems/StaticBatch";
import {
  brandingStripTexture,
  carpetTexture,
  ceilingTilesTexture,
  claddingTexture,
  clockTexture,
  floorTilesTexture,
  netTexture,
  signTexture,
  woodTexture,
} from "../systems/textures";
import { Entrance } from "./Entrance";
import { KidsCorner, ShopArea } from "./props/Furniture";
import { ItemsLayer } from "../world/ItemsLayer";
import { Staircase } from "./Staircase";

const DARK_WALL = { color: "#1d1e21", roughness: 0.92 } as const;

export const GROUND_FLOOR_PHOTOS = [
  ...MURALS.map((m) => m.texture),
  "/atom-world/textures/air-hockey-side-panel.webp",
  "/atom-world/textures/atom-logo.webp",
];

/**
 * Ground floor of ATOM GAME CLUB, assembled from data/environment.ts.
 * Architecture per the photos: light glossy ceramic floor, dark walls with light marble-look
 * cladding below and the ATOM branding strip above it, white panelled ceiling with light panels,
 * dark pilasters, wall paintings on the left wall, mezzanine with white safety net at the back.
 */
export function GroundFloor({ castShadow, floorTexSize }: { castShadow: boolean; floorTexSize: number }) {
  const { halfWidth: hw, halfLength: hl, height: h, length: L, width: W, wainscot, stripHeight } = HALL;
  const photos = usePhotoTextures(GROUND_FLOOR_PHOTOS);
  const muralTex = photos.slice(0, MURALS.length);
  const logo = photos[MURALS.length + 1];

  const floorTex = useRepeatedTexture(() => floorTilesTexture(floorTexSize), W / 1.6, L / 1.6);
  const upperFloorTex = useRepeatedTexture(() => floorTilesTexture(512), W / 1.6, (MEZZANINE.zFront - MEZZANINE.zBack) / 1.6);
  const frontCeilingLen = hl - MEZZANINE.zFront;
  const ceilingTex = useRepeatedTexture(ceilingTilesTexture, W / 1.2, frontCeilingLen / 1.2);
  const underMezzTex = useRepeatedTexture(ceilingTilesTexture, W / 1.2, (MEZZANINE.zFront - MEZZANINE.zBack) / 1.2);
  const claddingTex = useRepeatedTexture(claddingTexture, L / 1.2, 1);
  const stripTex = useRepeatedTexture(brandingStripTexture, L / 4, 1);
  const fasciaTex = useRepeatedTexture(brandingStripTexture, W / 6.4, 1);
  const netW = STAIRS.xMin - -hw;
  const netH = h - MEZZANINE.top;
  const netTex = useRepeatedTexture(netTexture, netW / 0.12, netH / 0.12);
  const woodTex = useRepeatedTexture(woodTexture, W / 1.2, 2);
  const carpet = useRepeatedTexture(carpetTexture, 1.5, 2.5);
  const clock = useOwnedTexture(clockTexture);
  const zoneSign = useOwnedTexture(() => signTexture(["🚜 ماشین‌آلات راه‌سازی"]));

  return (
    <StaticBatch>
      {/* floor */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[W, L]} />
        <meshStandardMaterial map={floorTex} roughness={0.16} metalness={0} envMapIntensity={0.9} />
      </mesh>

      {/* ceiling (double height part) */}
      <mesh position={[0, h, (hl + MEZZANINE.zFront) / 2]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[W, frontCeilingLen]} />
        <meshStandardMaterial map={ceilingTex} roughness={0.9} />
      </mesh>
      <CeilingLights />

      {/* side walls: cladding, branding strip, dark upper wall */}
      {(["left", "right"] as const).map((side) => {
        const x = side === "left" ? -hw : hw;
        const ry = side === "left" ? Math.PI / 2 : -Math.PI / 2;
        return (
          <group key={side} position={[x, 0, 0]} rotation-y={ry}>
            <mesh position={[0, wainscot / 2, 0]} receiveShadow>
              <planeGeometry args={[L, wainscot]} />
              <meshStandardMaterial map={claddingTex} roughness={0.35} />
            </mesh>
            <mesh position={[0, wainscot + stripHeight / 2, 0.003]}>
              <planeGeometry args={[L, stripHeight]} />
              <meshStandardMaterial map={stripTex} roughness={0.5} emissive="#0a2a14" emissiveIntensity={0.25} />
            </mesh>
            <mesh position={[0, (wainscot + stripHeight + h) / 2, 0]}>
              <planeGeometry args={[L, h - wainscot - stripHeight]} />
              <meshStandardMaterial {...DARK_WALL} />
            </mesh>
          </group>
        );
      })}

      {/* back wall: wood panelling under the mezzanine, dark above */}
      <group position={[0, 0, -hl]}>
        <mesh position={[0, (MEZZANINE.top - MEZZANINE.thickness) / 2, 0]}>
          <planeGeometry args={[W, MEZZANINE.top - MEZZANINE.thickness]} />
          <meshStandardMaterial map={woodTex} roughness={0.7} />
        </mesh>
        <mesh position={[0, (MEZZANINE.top + h) / 2, 0]}>
          <planeGeometry args={[W, h - MEZZANINE.top]} />
          <meshStandardMaterial {...DARK_WALL} />
        </mesh>
      </group>

      {/* wooden door to the construction-machines zone (walk through it) */}
      <InteractiveMachine id="zone-door" markerHeight={ZONE_DOOR.height + 0.35} markerAt={[ZONE_DOOR.x, -hl + 0.3]}>
        <mesh position={[ZONE_DOOR.x, ZONE_DOOR.height / 2, -hl + 0.005]}>
          <planeGeometry args={[ZONE_DOOR.width, ZONE_DOOR.height]} />
          <meshStandardMaterial color="#5a3b22" roughness={0.6} />
        </mesh>
        <mesh position={[ZONE_DOOR.x, ZONE_DOOR.height + 0.2, -hl + 0.01]}>
          <planeGeometry args={[0.9, 0.3]} />
          <meshBasicMaterial map={zoneSign} toneMapped={false} />
        </mesh>
      </InteractiveMachine>

      {/* pilasters */}
      {PILASTERS.map((p) => {
        const x = p.side === "left" ? -hw + PILASTER_SIZE.depth / 2 : hw - PILASTER_SIZE.depth / 2;
        return (
          <group key={`${p.side}${p.z}`} position={[x, 0, p.z]}>
            <mesh position={[0, wainscot / 2, 0]} castShadow={castShadow} receiveShadow>
              <boxGeometry args={[PILASTER_SIZE.depth, wainscot, PILASTER_SIZE.width]} />
              <meshStandardMaterial color="#e6dece" roughness={0.35} />
            </mesh>
            <mesh position={[0, (wainscot + h) / 2, 0]} castShadow={castShadow}>
              <boxGeometry args={[PILASTER_SIZE.depth, h - wainscot, PILASTER_SIZE.width]} />
              <meshStandardMaterial color="#17181a" roughness={0.9} />
            </mesh>
          </group>
        );
      })}

      {/* wall paintings (left wall), textures rectified from the reference photos */}
      {MURALS.map((m, i) => (
        <mesh key={m.id} position={[-hw + 0.006, (m.yMin + m.yMax) / 2, m.z]} rotation-y={Math.PI / 2}>
          <planeGeometry args={[m.width, m.yMax - m.yMin]} />
          <meshStandardMaterial map={muralTex[i]} roughness={0.85} />
        </mesh>
      ))}

      {/* wall clock */}
      <group position={[-hw + 0.03, CLOCK.y, CLOCK.z]} rotation-y={Math.PI / 2}>
        <mesh>
          <circleGeometry args={[0.32, 40]} />
          <meshStandardMaterial map={clock} roughness={0.4} />
        </mesh>
        <mesh>
          <torusGeometry args={[0.32, 0.03, 10, 40]} />
          <meshStandardMaterial color="#d9dce0" metalness={0.9} roughness={0.25} />
        </mesh>
      </group>

      {/* air conditioner on the right wall */}
      <mesh position={[hw - 0.13, 4.75, 6.2]} castShadow={castShadow}>
        <boxGeometry args={[0.25, 0.32, 0.95]} />
        <meshStandardMaterial color="#f4f4f2" roughness={0.5} />
      </mesh>

      <Mezzanine
        castShadow={castShadow}
        upperFloorTex={upperFloorTex}
        underTex={underMezzTex}
        fasciaTex={fasciaTex}
        netTex={netTex}
        netWidth={netW}
        netHeight={netH}
      />
      <Staircase castShadow={castShadow} />
      <Entrance />

      {/* furniture and machines */}
      <InteractiveMachine id="shop-counter" markerHeight={1.9} markerAt={[COUNTER.xMin - 0.1, (COUNTER.zMin + COUNTER.zMax) / 2]}>
        <ShopArea logo={logo} castShadow={castShadow} />
      </InteractiveMachine>
      <KidsCorner carpet={carpet} castShadow={castShadow} />
      {/* air-hockey tables, lounge, plants, events board… at their (admin-editable) places */}
      <ItemsLayer envId="amusement" level="ground" castShadow={castShadow} />
    </StaticBatch>
  );
}

function Mezzanine(props: {
  castShadow: boolean;
  upperFloorTex: THREE.Texture;
  underTex: THREE.Texture;
  fasciaTex: THREE.Texture;
  netTex: THREE.Texture;
  netWidth: number;
  netHeight: number;
}) {
  const { halfWidth: hw, width: W } = HALL;
  const depth = MEZZANINE.zFront - MEZZANINE.zBack;
  const cz = (MEZZANINE.zFront + MEZZANINE.zBack) / 2;
  const bottom = MEZZANINE.top - MEZZANINE.thickness;
  const posts: number[] = [];
  for (let x = -hw + 0.1; x < STAIRS.xMin; x += 1.1) posts.push(x);
  return (
    <group>
      <mesh position={[0, MEZZANINE.top - MEZZANINE.thickness / 2, cz]} castShadow={props.castShadow} receiveShadow>
        <boxGeometry args={[W, MEZZANINE.thickness, depth]} />
        <meshStandardMaterial color="#1a1b1d" roughness={0.8} />
      </mesh>
      <mesh position={[0, MEZZANINE.top + 0.002, cz]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[W, depth]} />
        <meshStandardMaterial map={props.upperFloorTex} roughness={0.2} />
      </mesh>
      <mesh position={[0, bottom - 0.002, cz]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[W, depth]} />
        <meshStandardMaterial map={props.underTex} roughness={0.9} />
      </mesh>
      {/* ATOM GAME CLUB fascia */}
      <mesh position={[0, bottom + MEZZANINE.thickness / 2 - 0.03, MEZZANINE.zFront + 0.004]}>
        <planeGeometry args={[W, 0.42]} />
        <meshStandardMaterial map={props.fasciaTex} roughness={0.5} emissive="#0a2a14" emissiveIntensity={0.3} />
      </mesh>
      {/* black railing */}
      {posts.map((x) => (
        <mesh key={x} position={[x, MEZZANINE.top + 0.5, MEZZANINE.zFront - 0.05]}>
          <boxGeometry args={[0.04, 1.0, 0.04]} />
          <meshStandardMaterial color="#141414" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
      <mesh position={[(-hw + STAIRS.xMin) / 2, MEZZANINE.top + 1.0, MEZZANINE.zFront - 0.05]}>
        <boxGeometry args={[props.netWidth, 0.05, 0.06]} />
        <meshStandardMaterial color="#141414" roughness={0.5} metalness={0.4} />
      </mesh>
      {[0.35, 0.65].map((y) => (
        <mesh key={y} position={[(-hw + STAIRS.xMin) / 2, MEZZANINE.top + y, MEZZANINE.zFront - 0.05]}>
          <boxGeometry args={[props.netWidth, 0.02, 0.02]} />
          <meshStandardMaterial color="#141414" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
      {/* white safety net up to the ceiling */}
      <mesh position={[(-hw + STAIRS.xMin) / 2, MEZZANINE.top + props.netHeight / 2, MEZZANINE.zFront - 0.08]}>
        <planeGeometry args={[props.netWidth, props.netHeight]} />
        <meshBasicMaterial map={props.netTex} transparent side={THREE.DoubleSide} depthWrite={false} color="#ffffff" />
      </mesh>
    </group>
  );
}

/** Square light panels in the ceiling grid (instanced: one draw call per ceiling). */
function CeilingLights() {
  const front = useRef<THREE.InstancedMesh>(null);
  const under = useRef<THREE.InstancedMesh>(null);
  const xs = [-2.4, 0, 2.4];
  const frontZ = [11.4, 9.0, 6.6, 4.2, 1.8, -0.6, -3.0];
  const underZ = [-5.8, -8.4, -11.0];
  const upper = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    const s = new THREE.Vector3(1, 1, 1);
    let i = 0;
    for (const x of xs)
      for (const z of frontZ) {
        front.current?.setMatrixAt(i++, m.compose(new THREE.Vector3(x, HALL.height - 0.01, z), q, s));
      }
    i = 0;
    for (const x of xs)
      for (const z of underZ) {
        under.current?.setMatrixAt(i++, m.compose(new THREE.Vector3(x, MEZZANINE.top - MEZZANINE.thickness - 0.01, z), q, s));
      }
    i = 0;
    for (const x of xs)
      for (const z of underZ) {
        upper.current?.setMatrixAt(i++, m.compose(new THREE.Vector3(x, HALL.height - 0.012, z), q, s));
      }
    if (upper.current) upper.current.instanceMatrix.needsUpdate = true;
    if (front.current) front.current.instanceMatrix.needsUpdate = true;
    if (under.current) under.current.instanceMatrix.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <instancedMesh ref={front} args={[undefined, undefined, xs.length * frontZ.length]}>
        <planeGeometry args={[0.6, 0.6]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={upper} args={[undefined, undefined, xs.length * underZ.length]}>
        <planeGeometry args={[0.6, 0.6]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={under} args={[undefined, undefined, xs.length * underZ.length]}>
        <planeGeometry args={[0.6, 0.6]} />
        <meshBasicMaterial color="#fffaf0" toneMapped={false} />
      </instancedMesh>
    </>
  );
}
