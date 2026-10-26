"use client";

import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Draw-call reduction for static scenery: after the children mount, meshes that share the same
 * material settings are merged (in world space) into one mesh per material and the originals are
 * hidden. Anything animated must set `userData.noBatch = true` (it and its children are skipped).
 * Children must not move after mounting.
 */
export function StaticBatch({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const batched = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    const g = group.current;
    const out = batched.current;
    if (!g || !out) return;
    g.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
    const buckets = new Map<string, { material: THREE.Material; meshes: THREE.Mesh[] }>();

    const visit = (o: THREE.Object3D) => {
      if (o.userData.noBatch) return;
      const m = o as THREE.Mesh;
      if (m.isMesh && !(m as unknown as THREE.InstancedMesh).isInstancedMesh && m.visible && !Array.isArray(m.material)) {
        const geo = m.geometry;
        if (geo.attributes.position && geo.attributes.normal && geo.attributes.uv) {
          const key = `${materialKey(m.material)}|${geo.index ? "i" : "n"}|${m.castShadow ? 1 : 0}${m.receiveShadow ? 1 : 0}|${m.renderOrder}`;
          let b = buckets.get(key);
          if (!b) buckets.set(key, (b = { material: m.material, meshes: [] }));
          b.meshes.push(m);
        }
      }
      for (const c of o.children) visit(c);
    };
    visit(g);

    const created: THREE.Mesh[] = [];
    const hidden: THREE.Mesh[] = [];
    for (const b of buckets.values()) {
      if (b.meshes.length < 2) continue;
      // deep copies (never touch the originals' buffers), transformed into the batch's space
      const geos = b.meshes.map((m) => {
        const src = m.geometry;
        const copy = new THREE.BufferGeometry();
        for (const name of ["position", "normal", "uv"]) copy.setAttribute(name, src.attributes[name].clone());
        if (src.index) copy.setIndex(src.index.clone());
        return copy.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      });
      const merged = mergeGeometries(geos, false);
      geos.forEach((x) => x.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, b.material);
      mesh.castShadow = b.meshes[0].castShadow;
      mesh.receiveShadow = b.meshes[0].receiveShadow;
      mesh.renderOrder = b.meshes[0].renderOrder;
      out.add(mesh);
      created.push(mesh);
      for (const m of b.meshes) {
        m.visible = false;
        hidden.push(m);
      }
    }
    return () => {
      for (const m of created) {
        out.remove(m);
        m.geometry.dispose();
      }
      for (const m of hidden) m.visible = true;
    };
  }, []);

  return (
    <>
      <group ref={group}>{children}</group>
      <group ref={batched} />
    </>
  );
}

const keys = new WeakMap<THREE.Material, string>();

/** Materials created separately but with identical settings share a key. */
function materialKey(mat: THREE.Material): string {
  const cached = keys.get(mat);
  if (cached) return cached;
  const m = mat as THREE.MeshStandardMaterial & THREE.MeshBasicMaterial;
  const key = [
    mat.type,
    m.color?.getHexString(),
    m.emissive?.getHexString(),
    m.emissiveIntensity,
    m.roughness,
    m.metalness,
    m.map?.uuid,
    m.transparent,
    m.opacity,
    mat.side,
    m.toneMapped,
    m.depthWrite,
    m.envMapIntensity,
  ].join(",");
  keys.set(mat, key);
  return key;
}
