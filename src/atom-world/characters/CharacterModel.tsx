"use client";

import { useFrame } from "@react-three/fiber";
import { Component, type ReactNode, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { AnimState, CharacterDef, CharacterModelDef } from "../data/characters";
import { type AnimInput, blendPose, neutralPose, targetPose } from "./CharacterAnimations";
import { applyPose, buildToonCharacter } from "./buildToonCharacter";
import { GltfCharacter } from "./GltfCharacter";

/** What the controller (or the selector screen) tells the model every frame. */
export type AnimSource = { current: Omit<AnimInput, "time"> };

interface Props {
  def: CharacterDef;
  anim: AnimSource;
  castShadow?: boolean;
}

/**
 * Renders a character: the final GLB when `def.model` is set, otherwise the temporary
 * procedural model. Both are driven by the same AnimSource.
 */
export function CharacterModel({ def, anim, castShadow = true }: Props) {
  const model = useMemo(() => debugModelOverride() ?? def.model, [def.model]);
  const available = useModelAvailable(model?.url);
  if (model && available) {
    const fallback = <ToonCharacter def={def} anim={anim} castShadow={castShadow} />;
    return (
      <ModelErrorBoundary fallback={fallback} url={model.url}>
        <Suspense fallback={fallback}>
          <GltfCharacter model={model} anim={anim} castShadow={castShadow} />
        </Suspense>
      </ModelErrorBoundary>
    );
  }
  return <ToonCharacter def={def} anim={anim} castShadow={castShadow} />;
}

/** HEAD-checks the model file first, so a missing GLB quietly uses the temporary model. */
function useModelAvailable(url: string | undefined) {
  const [state, setState] = useState<{ url?: string; ok: boolean }>({ ok: false });
  useEffect(() => {
    if (!url) return;
    let alive = true;
    // in-page blob/data URLs exist by construction (and HEAD is not allowed on them)
    (url.startsWith("blob:") || url.startsWith("data:") ? Promise.resolve(new Response(null, { status: 200 })) : fetch(url, { method: "HEAD" }))
      .then((r) => r.ok)
      .catch(() => false)
      .then((ok) => {
        if (!alive) return;
        if (!ok) console.warn(`[atom-world] could not load character model ${url}; using the temporary model.`);
        setState({ url, ok });
      });
    return () => {
      alive = false;
    };
  }, [url]);
  return !!url && state.url === url && state.ok;
}

/** A broken or missing GLB must never break the game: fall back to the temporary model. */
class ModelErrorBoundary extends Component<{ fallback: ReactNode; url: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn(`[atom-world] could not load character model ${this.props.url}; using the temporary model.`, error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Debug only (`?debug=1&testModel=/x.glb&testClips=idle:idle,walk:walk&testForward=-z&testSpeed=walk:1.4,run:4`):
 * try any GLB as the character without editing data/characters.ts.
 */
function debugModelOverride(): CharacterModelDef | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search);
  const url = q.get("testModel");
  if (!q.has("debug") || !url) return null;
  const pairs = (v: string | null) => Object.fromEntries((v ?? "").split(",").filter(Boolean).map((p) => p.split(":")));
  const speed = pairs(q.get("testSpeed"));
  return {
    url,
    height: Number(q.get("testHeight") ?? 1.6),
    forward: q.get("testForward") === "-z" ? "-z" : "+z",
    clips: pairs(q.get("testClips")) as Partial<Record<AnimState, string>>,
    clipSpeed: { walk: speed.walk ? Number(speed.walk) : undefined, run: speed.run ? Number(speed.run) : undefined },
  };
}

function ToonCharacter({ def, anim, castShadow }: Props) {
  const rig = useMemo(() => buildToonCharacter(def.look, castShadow), [def.look, castShadow]);
  useEffect(() => () => rig.dispose(), [rig]);
  const pose = useRef(neutralPose());
  const target = useRef(neutralPose());
  const time = useRef(def.id === "boy" ? 0 : 1.7);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    time.current += dt;
    targetPose({ ...anim.current, time: time.current }, target.current);
    blendPose(pose.current, target.current, dt, anim.current.state === "run" || anim.current.state === "walk" ? 16 : 10);
    applyPose(rig, pose.current, time.current);
  });

  return <primitive object={rig.root} />;
}
