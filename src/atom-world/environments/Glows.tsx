"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { AIR_HOCKEY_SIZE } from "../data/environment";
import { toWorldXZ } from "../world/items";
import { worldItems } from "../world/registry";
import { FOOT_POOL, UPPER_Y } from "../data/upperFloor";

/**
 * Soft light halos around lights that are really there in the photos: the blue LED strips of the
 * air-hockey tables and the orange-lit pockets of the foot-pool field. One instanced draw call of
 * additive quads (no post-processing, so it stays cheap on phones).
 */
interface Halo {
  pos: [number, number, number];
  /** rotation (x, y) of the quad */
  rot: [number, number];
  size: [number, number];
  color: string;
  strength: number;
}

function halos(): Halo[] {
  const out: Halo[] = [];
  const { x: W, z: D, height: H } = AIR_HOCKEY_SIZE;
  for (const t of worldItems().filter((i) => i.kind === "air-hockey" && i.env === "amusement")) {
    const y = t.level === "upper" ? UPPER_Y : 0;
    for (const s of [1, -1]) {
      // vertical halo just outside each long rail, plus a faint one lying on the rim
      const [ox, oz] = toWorldXZ(t, 0, (D / 2 + 0.01) * s);
      const [rx, rz] = toWorldXZ(t, 0, (D / 2 - 0.05) * s);
      out.push({ pos: [ox, y + H + 0.04, oz], rot: [0, (s === 1 ? 0 : Math.PI) + t.rotY], size: [W + 0.25, 0.32], color: "#3d8bff", strength: 0.55 });
      out.push({ pos: [rx, y + H + 0.035, rz], rot: [-Math.PI / 2, t.rotY], size: [W, 0.3], color: "#3d8bff", strength: 0.35 });
    }
  }
  const f = FOOT_POOL;
  const b = f.border;
  const cx = (f.xMin + f.xMax) / 2;
  const pockets: [number, number][] = [
    [f.xMin + b / 2, f.zMin + b / 2],
    [cx, f.zMin + b / 2],
    [f.xMax - b / 2, f.zMin + b / 2],
    [f.xMin + b / 2, f.zMax - b / 2],
    [cx, f.zMax - b / 2],
    [f.xMax - b / 2, f.zMax - b / 2],
  ];
  for (const [x, z] of pockets) out.push({ pos: [x, UPPER_Y + f.height + 0.05, z], rot: [-Math.PI / 2, 0], size: [1.0, 1.0], color: "#ffad1f", strength: 0.6 });
  return out;
}

let tex: THREE.Texture | null = null;
function glowTexture() {
  if (tex) return tex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.35, "rgba(255,255,255,0.45)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function Glows() {
  const list = useMemo(() => halos(), []);
  const mesh = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    list.forEach((h, i) => {
      o.position.set(...h.pos);
      o.rotation.set(h.rot[0], h.rot[1], 0, "YXZ"); // turn about y after tilting
      o.scale.set(h.size[0], h.size[1], 1);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, col.set(h.color).multiplyScalar(h.strength));
    });
    m.instanceMatrix.needsUpdate = true;
    m.renderOrder = 5;
    m.frustumCulled = false;
    return m;
  }, [list]);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    },
    [mesh],
  );
  return <primitive object={mesh} />;
}
