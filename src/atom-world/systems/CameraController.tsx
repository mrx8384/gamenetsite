"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { inputBlocked, worldStore } from "../store";
import { useRuntimeRef } from "./runtime";

export const CAMERA = {
  minDistance: 1.6,
  maxDistance: 7,
  minPitch: -0.35,
  maxPitch: 1.15,
  /** Look-at point above the feet. */
  targetHeight: 1.35,
  /** Keep this far in front of whatever the ray hits. */
  wallPadding: 0.22,
  mouseSensitivity: 0.0045,
  touchSensitivity: 0.0065,
} as const;

/**
 * Third-person orbit camera: smooth follow, free yaw/pitch (mouse drag / right-half touch drag),
 * zoom (wheel / pinch), collision against walls and slabs, and a focus mode when an info panel
 * is open. Vertical follow is softer so climbing stairs does not shake the view.
 */
export function CameraController() {
  const rtRef = useRuntimeRef();
  const get = useThree((s) => s.get);
  const target = useRef<THREE.Vector3 | null>(null);
  const dist = useRef(4.2);
  const stairTilt = useRef(0);
  const tmp = useRef(new THREE.Vector3());

  // ── pointer input on the canvas (mouse anywhere, touch on the right half)
  useEffect(() => {
    const dom = get().gl.domElement;
    const rt = rtRef.current;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "touch" && e.clientX < window.innerWidth * 0.4) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      dom.setPointerCapture?.(e.pointerId);
      if (pointers.size === 2) pinch = pinchDistance(pointers);
    };
    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      prev.x = e.clientX;
      prev.y = e.clientY;
      if (inputBlocked()) return;
      if (pointers.size >= 2) {
        const d = pinchDistance(pointers);
        if (pinch > 0) rt.input.zoom += (pinch - d) * 0.012;
        pinch = d;
        return;
      }
      const s = e.pointerType === "touch" ? CAMERA.touchSensitivity : CAMERA.mouseSensitivity;
      rt.input.lookYaw -= dx * s;
      rt.input.lookPitch += dy * s;
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = 0;
    };
    const onWheel = (e: WheelEvent) => {
      if (inputBlocked()) return;
      e.preventDefault();
      rt.input.zoom += Math.sign(e.deltaY) * 0.45;
    };
    const onContext = (e: Event) => e.preventDefault();
    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("pointerup", onUp);
    dom.addEventListener("pointercancel", onUp);
    dom.addEventListener("wheel", onWheel, { passive: false });
    dom.addEventListener("contextmenu", onContext);
    dom.style.touchAction = "none";
    return () => {
      dom.removeEventListener("pointerdown", onDown);
      dom.removeEventListener("pointermove", onMove);
      dom.removeEventListener("pointerup", onUp);
      dom.removeEventListener("pointercancel", onUp);
      dom.removeEventListener("wheel", onWheel);
      dom.removeEventListener("contextmenu", onContext);
    };
  }, [get, rtRef]);

  useFrame((state, delta) => {
    const rt = rtRef.current;
    const camera = state.camera;
    const dt = Math.min(delta, 1 / 30);
    const c = rt.camera;
    const inp = rt.input;

    c.yaw += inp.lookYaw + inp.camTurn * dt * 1.8;
    c.distance = THREE.MathUtils.clamp(c.distance + inp.camZoom * dt * 3, CAMERA.minDistance, CAMERA.maxDistance);
    c.pitch = THREE.MathUtils.clamp(c.pitch + inp.lookPitch, CAMERA.minPitch, CAMERA.maxPitch);
    c.distance = THREE.MathUtils.clamp(c.distance + inp.zoom, CAMERA.minDistance, CAMERA.maxDistance);
    inp.lookYaw = 0;
    inp.lookPitch = 0;
    inp.zoom = 0;

    // ── follow target (focus on a machine while its panel is open)
    if (!target.current || c.snap) {
      c.snap = false;
      target.current = target.current ?? new THREE.Vector3();
      target.current.set(rt.player.x, rt.player.y + CAMERA.targetHeight, rt.player.z);
      dist.current = c.distance;
    }
    const t = target.current;
    let wantDistance = c.distance;
    if (rt.focus && !worldStore.get().reducedMotion) {
      const [fx, fy, fz] = rt.focus;
      t.lerp(tmp.current.set(fx, fy + 0.2, fz), 1 - Math.exp(-dt * 4));
      wantDistance = 3.4;
    } else {
      const p = rt.player;
      const kx = 1 - Math.exp(-dt * 14);
      const ky = 1 - Math.exp(-dt * 6);
      t.x += (p.x - t.x) * kx;
      t.z += (p.z - t.z) * kx;
      t.y += (p.y + CAMERA.targetHeight - t.y) * ky;
    }

    // ── on the stairs the view tilts a little higher so the next steps stay visible
    // (off with «کاهش حرکت»)
    stairTilt.current += ((rt.player.onStairs && !worldStore.get().reducedMotion ? 0.14 : 0) - stairTilt.current) * (1 - Math.exp(-dt * 3));
    const pitch = Math.min(CAMERA.maxPitch, c.pitch + stairTilt.current);

    // ── desired position on the orbit
    const cp = Math.cos(pitch);
    const dir = tmp.current.set(Math.sin(c.yaw) * cp, Math.sin(pitch), Math.cos(c.yaw) * cp);
    // ── collision: ray from the target towards the camera
    const hit = rt.world.raycast(t.x, t.y, t.z, dir.x, dir.y, dir.z, wantDistance + CAMERA.wallPadding);
    const allowed = Math.max(0.35, Math.min(wantDistance, hit - CAMERA.wallPadding));
    // pull in instantly (never show the inside of a wall), ease back out
    dist.current = allowed < dist.current ? allowed : dist.current + (allowed - dist.current) * (1 - Math.exp(-dt * 5));

    camera.position.set(t.x + dir.x * dist.current, t.y + dir.y * dist.current, t.z + dir.z * dist.current);
    camera.lookAt(t);
  });

  return null;
}

function pinchDistance(p: Map<number, { x: number; y: number }>) {
  const [a, b] = [...p.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
}
