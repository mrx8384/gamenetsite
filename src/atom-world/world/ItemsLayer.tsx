"use client";

import { InteractiveMachine } from "../interactions/InteractiveMachine";
import { EventBoard } from "../environments/EventBoard";
import { GreySofa, MetalArmchair, TvStation } from "../environments/gaming-center/props";
import { stationSignTexture } from "../environments/gaming-center/textures";
import { AirHockeyTable } from "../environments/props/AirHockeyTable";
import { BaroqueSofa, FacePaintTable, FoldingTableSet, Plant, RoundTable } from "../environments/props/Furniture";
import { FootballsTable, GraySofa } from "../environments/UpperFloor";
import { useOwnedTexture, usePhotoTextures, useRepeatedTexture } from "../systems/AssetLoader";
import { footballsLabelTexture, netTexture } from "../systems/textures";
import { ITEM_KINDS, type WorldItem } from "./items";
import { areaAt, itemY, worldItems } from "./registry";

/**
 * Draws the movable items of one environment level at their current places (built-in layout with
 * the manager's changes from the admin editor), each with its interaction marker.
 */
export function ItemsLayer({ envId, level, castShadow }: { envId: string; level: string; castShadow: boolean }) {
  const items = worldItems().filter((i) => i.env === envId && i.level === level);
  return (
    <>
      {items.map((i) => {
        const k = ITEM_KINDS[i.kind];
        const model = <ItemModel item={i} castShadow={castShadow} />;
        return (
          <group key={i.id} position={[i.x, itemY(i), i.z]} rotation-y={i.rotY} name={`item:${i.id}`}>
            {k.machine ? (
              <InteractiveMachine id={i.id} markerHeight={k.markerHeight ?? 2}>
                {model}
              </InteractiveMachine>
            ) : (
              model
            )}
          </group>
        );
      })}
    </>
  );
}

export function ItemModel({ item, castShadow }: { item: WorldItem; castShadow: boolean }) {
  switch (item.kind) {
    case "air-hockey":
      return <AirHockeyItem castShadow={castShadow} />;
    case "baroque-sofa":
      return <BaroqueSofa length={item.length ?? 2.2} depth={0.9} castShadow={castShadow} />;
    case "baroque-armchair":
      return <BaroqueSofa length={0.85} depth={0.85} castShadow={castShadow} />;
    case "round-table":
      return <RoundTable castShadow={castShadow} />;
    case "folding-table":
      return <FoldingTableSet castShadow={castShadow} />;
    case "plant":
      return <Plant castShadow={castShadow} />;
    case "events-board":
      return <EventBoard />;
    case "footballs-table":
      return <FootballsItem castShadow={castShadow} />;
    case "gray-sofa":
      return <GraySofa length={item.length ?? 1.7} castShadow={castShadow} />;
    case "gc-station":
      return (
        <>
          <TvStation console={item.console ?? "ps4"} white={areaAt(item.x, 0, item.z) === "gc-train"} castShadow={castShadow} />
          {item.added && item.number !== undefined && <NumberPlate n={item.number} />}
        </>
      );
    case "gc-sofa":
      return <GreySofa length={item.length ?? 1.9} depth={0.88} castShadow={castShadow} />;
    case "gc-armchair":
      return <MetalArmchair castShadow={castShadow} />;
    case "face-paint":
      return <FacePaintTable castShadow={castShadow} />;
  }
}

function AirHockeyItem({ castShadow }: { castShadow: boolean }) {
  const [side] = usePhotoTextures(["/atom-world/textures/air-hockey-side-panel.webp"]);
  return <AirHockeyTable sidePanel={side} castShadow={castShadow} />;
}

function FootballsItem({ castShadow }: { castShadow: boolean }) {
  const net = useRepeatedTexture(netTexture, 10, 8);
  const label = useOwnedTexture(footballsLabelTexture);
  return <FootballsTable label={label} net={net} castShadow={castShadow} />;
}

/** Number sign on top of a station the manager added (its wall sign is not in the photos). */
function NumberPlate({ n }: { n: number }) {
  const tex = useOwnedTexture(() => stationSignTexture(n));
  return (
    <mesh position={[0, 1.42, -0.02]}>
      <planeGeometry args={[0.34, 0.21]} />
      <meshStandardMaterial map={tex} transparent alphaTest={0.4} roughness={0.5} />
    </mesh>
  );
}
