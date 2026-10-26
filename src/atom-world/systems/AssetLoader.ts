"use client";

import { useLoader } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useState } from "react";
import * as THREE from "three";
import { useWorld } from "../store";
import { resolveArt } from "../world/slots";

/** Wall-art textures that have a half-size copy in textures/sm/ (scripts/make-small-textures.py). */
const SMALL = new Set([
  "air-hockey-side-panel",
  "mural-batman-joker",
  "mural-excavator",
  "mural-lamppost-man",
  "mural-upper-back",
  "mural-upper-cards",
  "mural-upper-dice",
  "mural-woman-lamp",
]);

/** On the «low» preset, use the half-size copy when there is one. */
export function textureVariant(url: string, low: boolean) {
  if (!low) return url;
  const m = url.match(/^(.*\/textures\/)([\w-]+)\.webp$/);
  return m && SMALL.has(m[2]) ? `${m[1]}sm/${m[2]}.webp` : url;
}

/**
 * Asset helpers. Everything is loaded from this origin (/public/atom-world), never from a CDN.
 * Textures are released when the game unmounts so leaving /atom-world frees memory.
 */

/** Creates a texture once per mount and disposes it on unmount. */
export function useOwnedTexture(factory: () => THREE.Texture): THREE.Texture {
  const [tex] = useState(factory);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

/** Same as useOwnedTexture, with a repeat applied (repeat is per texture instance). */
export function useRepeatedTexture(factory: () => THREE.Texture, rx: number, ry: number): THREE.Texture {
  return useOwnedTexture(() => {
    const t = factory();
    t.repeat.set(rx, ry);
    return t;
  });
}

const loaded = new Map<string, THREE.Texture>();

/** Loads image textures (suspends until ready). sRGB, mip-mapped. */
export function usePhotoTextures(wanted: string[]): THREE.Texture[] {
  const low = useWorld((s) => s.quality === "low");
  // the manager's replacement wall art (admin editor) is used wherever the built-in texture would be
  const [urls] = useState(() => wanted.map((u) => textureVariant(resolveArt(u), low)));
  const textures = useLoader(THREE.TextureLoader, urls) as THREE.Texture[];
  // runs before the first frame renders, so the GPU upload already uses sRGB
  useLayoutEffect(() => {
    textures.forEach((t, i) => {
      configurePhoto(t);
      loaded.set(urls[i], t);
    });
  }, [textures, urls]);
  return textures;
}

function configurePhoto(t: THREE.Texture) {
  if (t.colorSpace === THREE.SRGBColorSpace) return;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
}

/** Call when the game unmounts: frees cached photo textures. */
export function releasePhotoTextures() {
  if (loaded.size === 0) return;
  for (const t of loaded.values()) t.dispose();
  useLoader.clear(THREE.TextureLoader, [...loaded.keys()]);
  loaded.clear();
}

export function preloadPhotoTextures(urls: string[]) {
  useLoader.preload(THREE.TextureLoader, urls.map(resolveArt));
}
