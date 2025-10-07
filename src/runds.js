// runds.js
import * as THREE from "three";

const RUND_ON_COLOR = new THREE.Color("#a855f7"); // purple
const RUND_EMISSIVE_INTENSITY = 1.8;
const SPIN_SPEED = 0.8; // radians/sec

export function setupRunds(worldRoot) {
  // id -> { mesh, on }
  const runds = new Map();

  // find rund1..rund4 (case-insensitive), use (N-1) as 0-based id
  worldRoot.traverse((o) => {
    if (!o.isMesh) return;
    const m = /^rund(\d+)$/i.exec(o.name || "");
    if (!m) return;

    const num = parseInt(m[1], 10);
    const id = num - 1;

    // ensure unique, emissive-capable materials
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

    setRundVisual(o, false);
    runds.set(id, { mesh: o, on: false });
  });

  console.log(
    "[Runds] found ids:",
    Array.from(runds.keys())
      .sort((a, b) => a - b)
      .map((i) => i + 1)
      .join(", ") || "(none)"
  );

  function setRundVisual(mesh, on) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!("emissive" in m)) continue;
      if (on) {
        m.emissive.copy(RUND_ON_COLOR);
        m.emissiveIntensity = RUND_EMISSIVE_INTENSITY;
      } else {
        m.emissive.setRGB(0, 0, 0);
        m.emissiveIntensity = 0;
      }
      m.needsUpdate = true;
    }
  }

  function setRundOn(id, on) {
    id = Number(id);
    const r = runds.get(id);
    if (!r) {
      console.warn("[Runds] setRundOn: unknown id", id);
      return;
    }
    r.on = !!on;
    setRundVisual(r.mesh, r.on);
  }

  function tick(dt) {
    runds.forEach((r) => {
      if (!r.on) return;
      r.mesh.rotation.y += dt * SPIN_SPEED; // spin while ON
    });
  }

  return { runds, setRundOn, tick };
}
