// crystals.js
import * as THREE from "three";

const CRYSTAL_REGEX = /^crystal(\d+)$/i;
const CRYSTAL_COLOR_ON = new THREE.Color("#4ade80");
const CRYSTAL_EMISSIVE_INTENSITY = 3;

export function setupCrystals(root) {
  const crystals = new Map(); // id -> Group/Node
  const state = new Map(); // id -> boolean (on/off)

  // Find crystals and prep materials
  root.traverse((o) => {
    const m = CRYSTAL_REGEX.exec(o.name || "");
    if (!m) return;
    const id = parseInt(m[1], 10) - 1;

    crystals.set(id, o);
    state.set(id, false);

    // Ensure children meshes have unique, emissive-capable materials
    o.traverse((c) => {
      if (!c.isMesh) return;
      makeMaterialUniqueAndEmissiveCapable(c);
      setMeshEmissive(c, false);
    });
  });

  function setCrystalOn(id, on) {
    state.set(id, !!on);
    const node = crystals.get(id);
    if (!node) return;
    node.traverse((c) => {
      if (!c.isMesh) return;
      setMeshEmissive(c, on);
    });
  }

  function tick(dt) {
    // Rotate only those that are ON
    for (const [id, node] of crystals) {
      if (state.get(id)) {
        node.rotation.y += dt * 0.8;
      }
    }
  }

  // Helpers
  function setMeshEmissive(mesh, on) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!m) continue;
      if (!("emissive" in m)) continue; // safety
      if (on) {
        m.emissive.copy(CRYSTAL_COLOR_ON);
        m.emissiveIntensity = CRYSTAL_EMISSIVE_INTENSITY;
      } else {
        m.emissive.setRGB(0, 0, 0);
        m.emissiveIntensity = 0;
      }
    }
  }

  function makeMaterialUniqueAndEmissiveCapable(mesh) {
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(cloneToEmissive);
    } else {
      mesh.material = cloneToEmissive(mesh.material);
    }
  }

  function cloneToEmissive(m) {
    if (!m) {
      return new THREE.MeshStandardMaterial({
        color: "#999",
        roughness: 0.6,
        metalness: 0.1,
      });
    }
    // If already emissive-capable, just clone to make it unique.
    if ("emissive" in m) return m.clone();

    // Convert non-emissive material → Standard so emissive works.
    return new THREE.MeshStandardMaterial({
      color: m.color ? m.color.clone() : new THREE.Color("#999"),
      roughness: m.roughness ?? 0.6,
      metalness: m.metalness ?? 0.1,
    });
  }

  return { setCrystalOn, tick, crystals, state };
}
