"use client";

import { Suspense } from "react";
import { useWorld } from "../../store";
import { StaticBatch } from "../../systems/StaticBatch";
import type { EnvSceneProps } from "../../world/types";
import { Glows } from "../Glows";
import { GroundFloor } from "../GroundFloor";
import { UpperFloor } from "../UpperFloor";
import { Visitors } from "../Visitors";

/** 🎡 Amusement hall scene: street & ground floor first, the upper floor's wall art just after. */
export default function AmusementScene({ quality, preset }: EnvSceneProps) {
  const ready = useWorld((s) => s.ready);
  return (
    <>
      <GroundFloor castShadow={preset.shadows} floorTexSize={preset.maxTexture >= 1024 ? 1024 : 512} />
      <Visitors quality={quality} castShadow={quality === "high"} />
      <Glows />
      {/* the upper floor's wall art loads just after the hall (the player starts on the street) */}
      {ready && (
        <Suspense fallback={null}>
          <StaticBatch>
            <UpperFloor castShadow={preset.shadows} />
          </StaticBatch>
        </Suspense>
      )}
    </>
  );
}
