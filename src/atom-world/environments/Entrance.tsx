"use client";

import * as THREE from "three";
import { ENTRANCE_DOOR, HALL } from "../data/environment";
import {
  BUILDING_DOOR,
  CAGE,
  FACADE_Z,
  LAMP_POST,
  ROAD,
  SIDEWALK,
  SIGN,
  STAIR_DOOR,
  STEP,
  STEPS,
  STREET_Y,
} from "../data/exterior";
import { InteractiveMachine } from "../interactions/InteractiveMachine";
import { slotText } from "../world/slots";
import { useOwnedTexture, usePhotoTextures, useRepeatedTexture } from "../systems/AssetLoader";
import { claddingTexture, floorTilesTexture, netTexture, persianTextTexture, shutterTexture } from "../systems/textures";

const STEEL = { color: "#d9dce0", metalness: 1, roughness: 0.22 } as const;
const STONE = "#e3dbcb";
const WINDOW_TOP = 4.3;

/**
 * Entrance of ATOM GAME CLUB after entrance/exterior-facade-night.jpg (outside) and
 * entrance/entrance-glass-white-sofas.jpg (inside): cream stone façade, frameless glass shop
 * window with the green «شهربازی اتم» lettering, open doorway on the right with four stone steps,
 * white roller shutters (half down over the doorway), the lit «اتم گیم کلاب» sign over the white
 * slatted building door, black lantern lamps, the wire cage under the window, sidewalk and street.
 * Sizes are estimated from the single exterior photo.
 */
export function Entrance() {
  const [stairView] = usePhotoTextures(["/atom-world/envs/gaming-center/street-door-view.webp"]);
  const z = HALL.halfLength;
  const hw = HALL.halfWidth;
  const winW = ENTRANCE_DOOR.xMin + hw;
  const doorW = ENTRANCE_DOOR.xMax - ENTRANCE_DOOR.xMin;
  const doorCx = (ENTRANCE_DOOR.xMin + ENTRANCE_DOOR.xMax) / 2;
  const stoneSide = useRepeatedTexture(claddingTexture, 6, 10);
  const stoneTop = useRepeatedTexture(claddingTexture, 7, 5);
  const stoneSill = useRepeatedTexture(claddingTexture, 5, 0.5);
  const shutterWide = useRepeatedTexture(shutterTexture, 1, 5);
  const shutterDoor = useRepeatedTexture(shutterTexture, 1, 7);
  const sidewalk = useRepeatedTexture(() => floorTilesTexture(512), (SIDEWALK.xMax - SIDEWALK.xMin) / 1.2, (SIDEWALK.zMax - FACADE_Z) / 1.2);
  const cageNet = useRepeatedTexture(netTexture, 12, 3);
  const sticker = useOwnedTexture(() => persianTextTexture(slotText("hall-window"), { fill: "#2f9e3a", stroke: "#f08a24", width: 1024, height: 256 }));
  const signText = useOwnedTexture(() =>
    persianTextTexture(slotText("building-sign"), { fill: "#ffd45a", stroke: "#e07a00", glow: "#ffb22e", width: 2048, height: 320, size: 210 }),
  );

  return (
    <group>
      {/* ── shop window glass (seen from both sides) */}
      <mesh position={[-hw + winW / 2, WINDOW_TOP / 2, z - 0.02]}>
        <planeGeometry args={[winW, WINDOW_TOP]} />
        <meshStandardMaterial color="#a7c7cf" transparent opacity={0.14} roughness={0.05} metalness={0.2} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {[-hw + 0.03, -1.3, ENTRANCE_DOOR.xMin].map((x) => (
        <mesh key={x} position={[x, WINDOW_TOP / 2, z - 0.03]}>
          <boxGeometry args={[0.04, WINDOW_TOP, 0.05]} />
          <meshStandardMaterial {...STEEL} />
        </mesh>
      ))}
      {/* «شهربازی اتم» window lettering (outside face of the glass) */}
      <mesh position={[-2.2, 3.15, z]}>
        <planeGeometry args={[3.6, 0.9]} />
        <meshBasicMaterial map={sticker} transparent depthWrite={false} />
      </mesh>

      {/* ── open glass door leaf, hinged on the left of the doorway */}
      <group position={[ENTRANCE_DOOR.xMin + 0.02, 0, z - 0.03]} rotation-y={-1.35}>
        <mesh position={[0.55, 1.25, 0]}>
          <planeGeometry args={[1.1, 2.5]} />
          <meshStandardMaterial color="#a7c7cf" transparent opacity={0.18} roughness={0.05} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        {[0.12, 2.38].map((y) => (
          <mesh key={y} position={[0.1, y, 0]}>
            <boxGeometry args={[0.18, 0.1, 0.05]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
        ))}
        <mesh position={[0.95, 1.05, 0.05]}>
          <boxGeometry args={[0.03, 0.9, 0.03]} />
          <meshStandardMaterial {...STEEL} />
        </mesh>
      </group>

      {/* ── roller shutters: full width band, plus the half-down doorway shutter */}
      {[z - 0.06, FACADE_Z + 0.01].map((zz, i) => (
        <group key={zz} rotation-y={i === 0 ? Math.PI : 0} position={[0, 0, zz]}>
          <mesh position={[0, (WINDOW_TOP + HALL.height) / 2, 0]}>
            <planeGeometry args={[HALL.width, HALL.height - WINDOW_TOP]} />
            <meshStandardMaterial map={shutterWide} roughness={0.7} />
          </mesh>
          <mesh position={[i === 0 ? -doorCx : doorCx, (ENTRANCE_DOOR.height + WINDOW_TOP) / 2, 0]}>
            <planeGeometry args={[doorW, WINDOW_TOP - ENTRANCE_DOOR.height]} />
            <meshStandardMaterial map={shutterDoor} roughness={0.7} />
          </mesh>
        </group>
      ))}

      {/* ── stone façade (outer face) */}
      <mesh position={[(SIDEWALK.xMin - hw) / 2, (STREET_Y + 12) / 2, FACADE_Z + 0.002]}>
        <planeGeometry args={[-hw - SIDEWALK.xMin, 12 - STREET_Y]} />
        <meshStandardMaterial map={stoneSide} color={STONE} roughness={0.55} />
      </mesh>
      <mesh position={[(SIDEWALK.xMax + hw) / 2, (STREET_Y + 12) / 2, FACADE_Z + 0.002]}>
        <planeGeometry args={[SIDEWALK.xMax - hw, 12 - STREET_Y]} />
        <meshStandardMaterial map={stoneSide} color={STONE} roughness={0.55} />
      </mesh>
      <mesh position={[0, (HALL.height + 12) / 2, FACADE_Z + 0.002]}>
        <planeGeometry args={[HALL.width, 12 - HALL.height]} />
        <meshStandardMaterial map={stoneTop} color={STONE} roughness={0.55} />
      </mesh>
      {/* window sill / base under the glass */}
      <mesh position={[-hw + winW / 2, STREET_Y / 2, FACADE_Z + 0.002]}>
        <planeGeometry args={[winW, -STREET_Y]} />
        <meshStandardMaterial map={stoneSill} color={STONE} roughness={0.55} />
      </mesh>
      <mesh position={[-hw + winW / 2, 0.02, (z + FACADE_Z) / 2]}>
        <boxGeometry args={[winW, 0.04, FACADE_Z - z]} />
        <meshStandardMaterial color={STONE} roughness={0.4} />
      </mesh>
      {/* façade reveals around the opening */}
      {[-hw, hw].map((x) => (
        <mesh key={x} position={[x, (STREET_Y + HALL.height) / 2, (z + FACADE_Z) / 2]} rotation-y={Math.PI / 2}>
          <planeGeometry args={[FACADE_Z - z, HALL.height - STREET_Y]} />
          <meshStandardMaterial color={STONE} roughness={0.55} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* upper-floor windows of the building */}
      {[6.4, 9.4].map((y) =>
        [-10, -7.4, -4.8, -2.2, 0.4, 3, 5.6, 8.2, 10.8].map((x) => (
          <group key={`${x}${y}`} position={[x, y + 1.2, FACADE_Z + 0.01]}>
            <mesh>
              <planeGeometry args={[1.6, 2.2]} />
              <meshStandardMaterial color="#1b2632" roughness={0.15} metalness={0.3} emissive={x === 5.6 && y === 6.4 ? "#fff4d6" : "#000000"} emissiveIntensity={0.6} />
            </mesh>
            {[-0.8, 0, 0.8].map((fx) => (
              <mesh key={fx} position={[fx, 0, 0.01]}>
                <boxGeometry args={[0.06, 2.2, 0.03]} />
                <meshStandardMaterial color="#f1efe9" roughness={0.5} />
              </mesh>
            ))}
          </group>
        )),
      )}

      {/* ── entrance steps */}
      {Array.from({ length: STEP.count - 1 }, (_, i) => {
        const k = i + 1;
        const zFront = FACADE_Z + (STEP.count - k) * STEP.run;
        const top = STREET_Y + k * STEP.rise;
        return (
          <mesh key={k} position={[(STEPS.xMin + STEPS.xMax) / 2, (STREET_Y + top) / 2, (FACADE_Z + zFront) / 2]} receiveShadow castShadow>
            <boxGeometry args={[STEPS.xMax - STEPS.xMin, top - STREET_Y, zFront - FACADE_Z]} />
            <meshStandardMaterial color="#d2cab9" roughness={0.6} />
          </mesh>
        );
      })}
      <mesh position={[doorCx, -0.02, (z + FACADE_Z) / 2]} receiveShadow>
        <boxGeometry args={[doorW, 0.04, FACADE_Z - z]} />
        <meshStandardMaterial color="#e8e6e1" roughness={0.3} />
      </mesh>

      {/* ── building door (white slats) and the lit sign above it */}
      <group position={[(BUILDING_DOOR.xMin + BUILDING_DOOR.xMax) / 2, 0, FACADE_Z + 0.02]}>
        <mesh position={[0, STREET_Y + BUILDING_DOOR.height / 2, 0]}>
          <planeGeometry args={[BUILDING_DOOR.xMax - BUILDING_DOOR.xMin, BUILDING_DOOR.height]} />
          <meshStandardMaterial map={shutterDoor} color="#f4f2ec" roughness={0.6} />
        </mesh>
        {[1.0, 1.9].map((y) => (
          <mesh key={y} position={[0, STREET_Y + y, 0.01]}>
            <planeGeometry args={[1.9, 0.32]} />
            <meshStandardMaterial color="#cfd6dc" emissive="#ffffff" emissiveIntensity={0.35} />
          </mesh>
        ))}
      </group>
      {/* ── open door to the gaming-center stairs (photo of the stairs seen from the street) */}
      <InteractiveMachine id="gc-street-door" markerHeight={STREET_Y + STAIR_DOOR.height + 0.35} markerAt={[(STAIR_DOOR.xMin + STAIR_DOOR.xMax) / 2, FACADE_Z + 0.3]}>
        <mesh position={[(STAIR_DOOR.xMin + STAIR_DOOR.xMax) / 2, STREET_Y + STAIR_DOOR.height / 2, FACADE_Z + 0.025]}>
          <planeGeometry args={[STAIR_DOOR.xMax - STAIR_DOOR.xMin, STAIR_DOOR.height]} />
          <meshBasicMaterial map={stairView} toneMapped={false} />
        </mesh>
        {[STAIR_DOOR.xMin, STAIR_DOOR.xMax].map((x) => (
          <mesh key={x} position={[x, STREET_Y + STAIR_DOOR.height / 2, FACADE_Z + 0.04]}>
            <boxGeometry args={[0.08, STAIR_DOOR.height, 0.06]} />
            <meshStandardMaterial color="#f4f2ec" roughness={0.5} />
          </mesh>
        ))}
        <mesh position={[(STAIR_DOOR.xMin + STAIR_DOOR.xMax) / 2, STREET_Y + STAIR_DOOR.height, FACADE_Z + 0.04]}>
          <boxGeometry args={[STAIR_DOOR.xMax - STAIR_DOOR.xMin + 0.08, 0.08, 0.06]} />
          <meshStandardMaterial color="#f4f2ec" roughness={0.5} />
        </mesh>
      </InteractiveMachine>
      <mesh position={[(SIGN.xMin + SIGN.xMax) / 2, (SIGN.yMin + SIGN.yMax) / 2, FACADE_Z + 0.07]} castShadow>
        <boxGeometry args={[SIGN.xMax - SIGN.xMin, SIGN.yMax - SIGN.yMin, 0.12]} />
        <meshStandardMaterial color="#f3f1ec" roughness={0.6} />
      </mesh>
      <mesh position={[(SIGN.xMin + SIGN.xMax) / 2, (SIGN.yMin + SIGN.yMax) / 2, FACADE_Z + 0.135]}>
        <planeGeometry args={[SIGN.xMax - SIGN.xMin - 0.2, SIGN.yMax - SIGN.yMin - 0.1]} />
        <meshBasicMaterial map={signText} transparent toneMapped={false} depthWrite={false} />
      </mesh>

      {/* ── lantern lamps */}
      <group position={[LAMP_POST.x, STREET_Y, LAMP_POST.z]}>
        <mesh position={[0, 1.5, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.08, 3, 10]} />
          <meshStandardMaterial color="#141414" roughness={0.5} metalness={0.4} />
        </mesh>
        <mesh position={[0.45, 2.75, 0]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.025, 0.025, 0.9, 8]} />
          <meshStandardMaterial color="#141414" roughness={0.5} metalness={0.4} />
        </mesh>
        {[0, 0.9].map((x) => (
          <Lantern key={x} position={[x, x === 0 ? 3.15 : 2.5, 0]} />
        ))}
      </group>
      <Lantern position={[9.4, 2.7, FACADE_Z + 0.3]} />

      {/* ── wire cage (outdoor AC unit) under the window */}
      <group position={[(CAGE.xMin + CAGE.xMax) / 2, STREET_Y, FACADE_Z + CAGE.depth / 2]}>
        <mesh position={[0, 0.3, 0]}>
          <boxGeometry args={[CAGE.xMax - CAGE.xMin - 0.3, 0.55, CAGE.depth - 0.15]} />
          <meshStandardMaterial color="#8d9196" roughness={0.6} />
        </mesh>
        <mesh position={[0, -STREET_Y / 2, CAGE.depth / 2]}>
          <planeGeometry args={[CAGE.xMax - CAGE.xMin, -STREET_Y]} />
          <meshBasicMaterial map={cageNet} color="#cfcfcf" transparent side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh position={[0, -STREET_Y - 0.02, 0]}>
          <boxGeometry args={[CAGE.xMax - CAGE.xMin, 0.04, CAGE.depth]} />
          <meshStandardMaterial color="#2a2a2a" roughness={0.6} />
        </mesh>
      </group>

      {/* ── sidewalk, curb, street and the buildings opposite */}
      <mesh position={[(SIDEWALK.xMin + SIDEWALK.xMax) / 2, STREET_Y, (FACADE_Z + SIDEWALK.zMax) / 2]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[SIDEWALK.xMax - SIDEWALK.xMin, SIDEWALK.zMax - FACADE_Z]} />
        <meshStandardMaterial map={sidewalk} color="#a4a4a2" roughness={0.6} />
      </mesh>
      <mesh position={[0, STREET_Y - 0.07, SIDEWALK.zMax]}>
        <boxGeometry args={[SIDEWALK.xMax - SIDEWALK.xMin + 20, 0.16, 0.2]} />
        <meshStandardMaterial color="#c9c6bf" roughness={0.6} />
      </mesh>
      <mesh position={[0, STREET_Y - 0.15, (ROAD.zMin + ROAD.zMax) / 2]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[60, ROAD.zMax - ROAD.zMin]} />
        <meshStandardMaterial color="#2a2c30" roughness={0.9} />
      </mesh>
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} position={[-22 + i * 5, STREET_Y - 0.14, (ROAD.zMin + ROAD.zMax) / 2]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[2, 0.12]} />
          <meshStandardMaterial color="#e8e8e8" roughness={0.8} />
        </mesh>
      ))}
      {[-14, -5, 4, 13].map((x, i) => (
        <group key={x} position={[x, 0, ROAD.zMax + 3]}>
          <mesh position={[0, 5 + (i % 2) * 2, 0]}>
            <boxGeometry args={[8.6, 12 + (i % 2) * 4, 3]} />
            <meshStandardMaterial color="#1d2026" roughness={0.9} />
          </mesh>
          {[2.5, 5.5, 8.5].map((y) =>
            [-2.5, 0, 2.5].map((wx) => (
              <mesh key={`${y}${wx}`} position={[wx, y, -1.51]} rotation-y={Math.PI}>
                <planeGeometry args={[1.1, 1.3]} />
                <meshBasicMaterial color={(y + wx + i) % 3 < 1 ? "#ffd99a" : "#2b3038"} toneMapped={false} />
              </mesh>
            )),
          )}
        </group>
      ))}
    </group>
  );
}

/** Black wall/post lantern with a warm glowing glass box. */
function Lantern({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.26, 0]}>
        <coneGeometry args={[0.2, 0.18, 4]} />
        <meshStandardMaterial color="#141414" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh>
        <boxGeometry args={[0.26, 0.36, 0.26]} />
        <meshBasicMaterial color="#ffd48a" toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.21, 0]}>
        <boxGeometry args={[0.3, 0.05, 0.3]} />
        <meshStandardMaterial color="#141414" roughness={0.5} metalness={0.4} />
      </mesh>
    </group>
  );
}
