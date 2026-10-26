"use client";

import { StaticBatch } from "../../systems/StaticBatch";
import type { EnvSceneProps } from "../../world/types";
import { ConstructionZone } from "../ConstructionZone";

/** 🚜 RC club scene (one batched group). */
export default function ConstructionZoneScene({ preset }: EnvSceneProps) {
  return (
    <StaticBatch>
      <ConstructionZone castShadow={preset.shadows} />
    </StaticBatch>
  );
}
