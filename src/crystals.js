// crystals.js
import * as THREE from "three";

const CRYSTAL_ON_COLOR = new THREE.Color("#4ade80");
const CRYSTAL_EMISSIVE_INTENSITY = 1.8;

export function setupCrystals(worldRoot) {
  const crystals = new Map(); // id -> { mesh, on, spin }

  // collect crystal meshes by name: crystal1..crystal4
  const list = [];
  worldRoot.traverse((o) => {
    if (o.isMesh && /^crystal\d+$/i.test(o.name)) list.push(o);
  });
  list.sort((a, b) => a.name.localeCompare(b.name));

  list.forEach((mesh, idx) => {
    // unique, emissive-capable material
    const toStd = (m) => {
      if (!m || !("emissive" in m)) {
        return new THREE.MeshStandardMaterial({
          color: m?.color ? m.color.clone() : new THREE.Color("#9a9a9a"),
          metalness: 0.2,
          roughness: 0.5,
        });
      }
      return m.clone();
    };
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(toStd)
      : toStd(mesh.material);

    setCrystalVisual(mesh, false);
    crystals.set(idx, { mesh, on: false, spin: 0 });
  });

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
    const c = crystals.get(id);
    if (!c) return;
    c.on = !!on;
    setCrystalVisual(c.mesh, c.on);
  }

  function tick(dt) {
    // spin only the ON crystals a little
    crystals.forEach((c) => {
      if (!c.on) return;
      c.mesh.rotation.y += dt * 0.8; // adjust spin speed if you want
    });
  }

  return { crystals, setCrystalOn, tick };
}
