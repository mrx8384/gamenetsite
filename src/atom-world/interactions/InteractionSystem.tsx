"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { worldStore } from "../store";
import { audio } from "../systems/AudioManager";
import { useRuntimeRef } from "../systems/runtime";

/**
 * Finds the closest interactable in range (and roughly in front of the player) and publishes it
 * to the UI store; points the camera at a machine while its info panel is open.
 * Machines register in runtime.interactables (data/environment.ts → INTERACTABLES).
 */
export function InteractionSystem() {
  const rtRef = useRuntimeRef();
  const acc = useRef(0);

  useEffect(
    () =>
      worldStore.subscribe(() => {
        const rt = rtRef.current;
        const panel = worldStore.get().panel;
        rt.focus = panel ? (rt.interactables.find((i) => i.id === panel.id)?.position ?? null) : null;
      }),
    [rtRef],
  );

  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.1) return;
    acc.current = 0;
    const rt = rtRef.current;
    const p = rt.player;
    let best: (typeof rt.interactables)[number] | null = null;
    let bestScore = Infinity;
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    for (const it of rt.interactables) {
      const dx = it.position[0] - p.x;
      const dz = it.position[2] - p.z;
      const d = Math.hypot(dx, dz);
      if (d > it.radius || Math.abs(it.position[1] - (p.y + 0.9)) > 2) continue;
      // prefer what the character is facing
      const facing = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
      const score = d - facing * 0.6;
      if (score < bestScore) {
        bestScore = score;
        best = it;
      }
    }
    // occasional puck clacks from the air-hockey tables, louder when close
    if (Math.random() < 0.07) {
      let d = Infinity;
      for (const it of rt.interactables) if (it.machineId === "air-hockey") d = Math.min(d, Math.hypot(it.position[0] - p.x, it.position[2] - p.z, it.position[1] - p.y));
      audio.puck(Math.max(0, 1 - d / 9));
    }
    const cur = worldStore.get().nearby;
    if ((best?.id ?? null) !== (cur?.id ?? null)) {
      worldStore.set({ nearby: best ? { id: best.id, machineId: best.machineId } : null });
    }
  });

  return null;
}
