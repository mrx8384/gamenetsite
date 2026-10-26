/**
 * Compatibility facade: the playable world is now assembled from the environment modules in
 * `world/registry.ts` (docs/ENVIRONMENTS.md). Existing imports keep working.
 */
import { areaAt, buildWorldColliders, surfaceAt, worldInteractables } from "../world/registry";

export { buildUpperFloorColliders } from "../environments/amusement";
export { buildConstructionZoneColliders } from "../environments/construction-zone";
/** Interactables are read when needed (the admin layout is applied before a session starts). */
export { areaAt, buildWorldColliders, surfaceAt, worldInteractables };

/** Area id (amusement: "street" | "ground" | "upper"; RC club: "zone"; new environments add their own). */
export type Area = string;
