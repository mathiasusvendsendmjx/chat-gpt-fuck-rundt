// src/finale.js
import * as THREE from "three";

const ORANGE = new THREE.Color("#f59e0b");
const RED = new THREE.Color("#ef4444");

export function setupFinale(worldRoot) {
  const targets = { hjerne: null, kant1: null, kant2: null };

  // find meshes named exactly hjerne, kant1, kant2 (case-insensitive)
  worldRoot.traverse((o) => {
    if (!o.isMesh) return;
    const n = (o.name || "").toLowerCase();
    if (!(n in targets)) return;
    if (!targets[n]) targets[n] = o; // first match wins

    // ensure unique emissive-capable material
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
    o.material = Array.isArray(o.material)
      ? o.material.map(toStd)
      : toStd(o.material);
  });

  console.log("[Finale] found:", {
    hjerne: !!targets.hjerne,
    kant1: !!targets.kant1,
    kant2: !!targets.kant2,
  });

  function setEmissive(mesh, color, intensity) {
    if (!mesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!("emissive" in m)) continue;
      m.emissive.copy(color);
      m.emissiveIntensity = intensity;
      m.needsUpdate = true;
    }
  }

  let armed = false;

  function arm() {
    if (armed) return;
    armed = true;

    // light + spin kant1 & kant2 (orange)
    if (targets.kant1) {
      setEmissive(targets.kant1, ORANGE, 1.8);
      targets.kant1.userData.spinSpeed = 0.8;
    }
    if (targets.kant2) {
      setEmissive(targets.kant2, ORANGE, 1.8);
      targets.kant2.userData.spinSpeed = 0.8;
    }

    // light hjerne (red)
    if (targets.hjerne) {
      setEmissive(targets.hjerne, RED, 2.2);
    }

    console.log("[Finale] ARMED → hjerne red, kant1+kant2 orange & spinning");
  }

  function tick(dt) {
    if (!armed) return;
    if (targets.kant1)
      targets.kant1.rotation.z +=
        (targets.kant1.userData.spinSpeed || 0.8) * dt;
    if (targets.kant2)
      targets.kant2.rotation.x +=
        (targets.kant2.userData.spinSpeed || 0.8) * dt;
  }

  return { arm, tick };
}
