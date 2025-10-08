// crystals.js
import * as THREE from "three";

const CRYSTAL_ON_COLOR = new THREE.Color("#4ade80");
const CRYSTAL_EMISSIVE_INTENSITY = 2;

export function setupCrystals(worldRoot) {
  // id -> { mesh, on, spin }
  const crystals = new Map();

  // find crystalN og brug tallet som id (0-based)
  worldRoot.traverse((o) => {
    if (!o.isMesh) return;
    const m = /^crystal(\d+)$/i.exec(o.name || "");
    if (!m) return;

    const num = parseInt(m[1], 10);
    const id = num - 1;

    const toStd = (mat) => {
      if (!mat || !("emissive" in mat)) {
        return new THREE.MeshStandardMaterial({
          color: mat?.color ? mat.color.clone() : new THREE.Color("#9a9a9a"),
          metalness: 0.2,
          roughness: 0.5,
        });
      }
      return mat.clone();
    };
    o.material = Array.isArray(o.material)
      ? o.material.map(toStd)
      : toStd(o.material);

    setCrystalVisual(o, false);
    crystals.set(id, { mesh: o, on: false, spin: 0 });
  });

  console.log(
    "[Crystals] found ids:",
    Array.from(crystals.keys())
      .sort((a, b) => a - b)
      .map((i) => i + 1)
      .join(", ") || "(none)"
  );

  function setCrystalVisual(mesh, on) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!("emissive" in m)) continue;
      if (on) {
        m.emissive.copy(CRYSTAL_ON_COLOR);
        m.emissiveIntensity = CRYSTAL_EMISSIVE_INTENSITY;
      } else {
        m.emissive.setRGB(0, 0, 0);
        m.emissiveIntensity = 0;
      }
      m.needsUpdate = true;
    }
  }

  function setCrystalOn(id, on) {
    id = Number(id);
    const c = crystals.get(id);
    if (!c) {
      console.warn("[Crystals] setCrystalOn: unknown id", id);
      return;
    }
    c.on = !!on;
    setCrystalVisual(c.mesh, c.on);
  }

  function tick(dt) {
    crystals.forEach((c) => {
      if (!c.on) return;
      c.mesh.rotation.y += dt * 0.8;
    });
  }

  return { crystals, setCrystalOn, tick };
}
