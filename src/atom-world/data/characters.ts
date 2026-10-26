/**
 * Playable ATOM characters. Looks follow the official character sheets in
 * /public/atom-world/references/characters/{boy,girl}/.
 *
 * `model` points at the rigged GLB (bones + skinning + baked clips) exported from the ATOM character
 * builder (scripts/export-characters.mjs). If the file is missing, the procedural build of the same
 * character is used. An artist-made GLB can replace the file later (docs/CHARACTER_MODEL_BRIEF.md).
 */
export type CharacterId = "boy" | "girl";

/** Animation states the controller drives. GLB clip names are mapped onto these. */
export type AnimState = "idle" | "walk" | "run" | "jump" | "fall" | "turn" | "stairs" | "interact";

export interface CharacterLook {
  skin: string;
  hair: string;
  hairStyle: "short-messy" | "long-wavy";
  jacket: string;
  jacketAccent: string;
  hoodie: string;
  shirt: string;
  pants: string;
  pantsAccent: string;
  shoe: string;
  shoeAccent: string;
  sole: string;
  headphones: string;
  headphonesAccent: string;
  /** Colour of the ATOM logo printed on the clothes. */
  logo: string;
  hairClips?: string;
  /** Visitor in ordinary clothes: no ATOM logos, headphones or backpack. */
  plain?: boolean;
}

/** Final rigged model (GLB/GLTF). See docs/CHARACTER_MODEL_BRIEF.md for the delivery spec. */
export interface CharacterModelDef {
  url: string;
  /** Height the model is scaled to, in metres (feet are put on y = 0); 0 keeps the file's own scale. */
  height: number;
  /** Which way the model faces in the file (default +z). */
  forward?: "+z" | "-z";
  /** Clip name in the GLB for every state (missing states fall back to idle / walk). */
  clips: Partial<Record<AnimState, string>>;
  /** Re-shade the model's materials with the game's toon ramp (for the vertex-coloured ATOM exports). */
  toon?: boolean;
  /** Ground speed (m/s) the walk / run clips were authored for; playback speed follows the real speed. */
  clipSpeed?: { walk?: number; run?: number };
}

export interface CharacterDef {
  id: CharacterId;
  name: string;
  tagline: string;
  /** Brand accent used by the UI (selector lights, HUD). */
  accent: string;
  reference: string;
  /** Small face crop of the sheet for UI cards. */
  thumb: string;
  look: CharacterLook;
  model: null | CharacterModelDef;
}

export const characters: Record<CharacterId, CharacterDef> = {
  boy: {
    id: "boy",
    name: "پسر اتم",
    tagline: "مشکی و سبز نئونی",
    accent: "#7CFC2A",
    reference: "/atom-world/references/characters/boy/boy-character-sheet.png",
    thumb: "/atom-world/references/characters/boy/boy-thumb.webp",
    look: {
      skin: "#f1c3a0",
      hair: "#17120f",
      hairStyle: "short-messy",
      jacket: "#141517",
      jacketAccent: "#7CFC2A",
      hoodie: "#1b1c1f",
      shirt: "#101113",
      pants: "#131416",
      pantsAccent: "#7CFC2A",
      shoe: "#121214",
      shoeAccent: "#7CFC2A",
      sole: "#f4f4f4",
      headphones: "#0d0d0e",
      headphonesAccent: "#7CFC2A",
      logo: "#7CFC2A",
    },
    model: {
      url: "/atom-world/models/atom-boy.glb",
      height: 0,
      toon: true,
      clips: { idle: "Idle", walk: "Walk", run: "Run", stairs: "Stairs", turn: "Turn", jump: "Jump", fall: "Fall", interact: "Interact" },
      clipSpeed: { walk: 2.6, run: 5.4 },
    },
  },
  girl: {
    id: "girl",
    name: "دختر اتم",
    tagline: "سفید و صورتی",
    accent: "#FF5FA8",
    reference: "/atom-world/references/characters/girl/girl-character-sheet.png",
    thumb: "/atom-world/references/characters/girl/girl-thumb.webp",
    look: {
      skin: "#f3c6a6",
      hair: "#3b2318",
      hairStyle: "long-wavy",
      jacket: "#f3eff0",
      jacketAccent: "#ff86bf",
      hoodie: "#ff8cc4",
      shirt: "#f7f5f5",
      pants: "#efebea",
      pantsAccent: "#ff86bf",
      shoe: "#f6f3f3",
      shoeAccent: "#ff6fb0",
      sole: "#ffffff",
      headphones: "#141214",
      headphonesAccent: "#ff6fb0",
      logo: "#ff4fa0",
      hairClips: "#ff7fb8",
    },
    model: {
      url: "/atom-world/models/atom-girl.glb",
      height: 0,
      toon: true,
      clips: { idle: "Idle", walk: "Walk", run: "Run", stairs: "Stairs", turn: "Turn", jump: "Jump", fall: "Fall", interact: "Interact" },
      clipSpeed: { walk: 2.6, run: 5.4 },
    },
  },
};

export const characterIds = Object.keys(characters) as CharacterId[];

export function isCharacterId(v: unknown): v is CharacterId {
  return v === "boy" || v === "girl";
}
