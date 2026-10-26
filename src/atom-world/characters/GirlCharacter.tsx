"use client";

import { characters } from "../data/characters";
import { type AnimSource, CharacterModel } from "./CharacterModel";

/** Girl ATOM character (temporary model until the final GLB is set in data/characters.ts). */
export function GirlCharacter({ anim, castShadow }: { anim: AnimSource; castShadow?: boolean }) {
  return <CharacterModel def={characters.girl} anim={anim} castShadow={castShadow} />;
}
