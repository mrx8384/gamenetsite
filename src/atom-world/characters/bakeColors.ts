import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { toonGradient } from "../systems/textures";

let bakedMat: THREE.MeshToonMaterial | null = null;

/**
 * Fewer draw calls for background figures: inside each joint, all plain-coloured parts become one
 * mesh with the colours baked into the vertices (one shared material for every baked figure). Small
 * textured / transparent decals are dropped. The joints stay, so the figure still animates.
 */
export function bakeColors(root: THREE.Object3D, castShadow: boolean) {
  bakedMat ??= new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
  const owned: THREE.BufferGeometry[] = [];
  const groups: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) groups.push(o);
  });
  for (const g of groups) {
    const meshes = g.children.filter((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh[];
    if (!meshes.length) continue;
    const parts: THREE.BufferGeometry[] = [];
    for (const m of meshes) {
      const mat = m.material as THREE.MeshBasicMaterial;
      g.remove(m);
      if (mat.map || mat.transparent || !g.visible) continue;
      m.updateMatrix();
      const geo = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix);
      for (const k of Object.keys(geo.attributes)) if (k !== "position" && k !== "normal") geo.deleteAttribute(k);
      const n = geo.attributes.position.count;
      const col = new Float32Array(n * 3);
      const c = mat.color;
      for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
      geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      parts.push(geo);
    }
    if (!parts.length) continue;
    const merged = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    if (!merged) continue;
    owned.push(merged);
    const mesh = new THREE.Mesh(merged, bakedMat);
    mesh.castShadow = castShadow;
    g.add(mesh);
  }
  return owned;
}
