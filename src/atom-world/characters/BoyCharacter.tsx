"use client";

import { characters } from "../data/characters";
import { type AnimSource, CharacterModel } from "./CharacterModel";

/** Boy ATOM character (temporary model until the final GLB is set in data/characters.ts). */
export function BoyCharacter({ anim, castShadow }: { anim: AnimSource; castShadow?: boolean }) {
  return <CharacterModel def={characters.boy} anim={anim} castShadow={castShadow} />;
}
