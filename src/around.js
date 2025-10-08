// around.js
import * as THREE from "three";

export function setupAround(worldRoot, bloom, opts = {}) {
  const colorHex = opts.color || "#ff9f1c"; // warm gold/orange
  const intensityOn = opts.intensityOn ?? 0;

  const around = new Map(); // id -> { mesh, on }

  // collect meshes by around1..around4
  const list = [];
  worldRoot.traverse((o) => {
    if (o.isMesh && /^around\d+$/i.test(o.name)) list.push(o);
  });
  list.sort((a, b) => a.name.localeCompare(b.name));

  list.forEach((mesh, idx) => {
    // optional: give them their own material (not required for bloom)
    const toStd = (m) =>
      !m || !("emissive" in m)
        ? new THREE.MeshStandardMaterial({
            color: m?.color ? m.color.clone() : new THREE.Color("#8a8a8a"),
            metalness: 0.3,
            roughness: 0.5,
          })
        : m.clone();
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(toStd)
      : toStd(mesh.material);

    // start OFF (not bloomed)
    markBloom(mesh, false);

    around.set(idx, { mesh, on: false });
  });

  function markBloom(mesh, on) {
    if (!bloom) return;
    if (on) {
      bloom.setBoost?.(mesh, { color: colorHex, intensity: intensityOn });
      bloom.mark?.(mesh, true);
    } else {
      bloom.mark?.(mesh, false);
    }
  }

  function setAroundOn(id, on) {
    const a = around.get(id);
    if (!a) return;
    a.on = !!on;
    markBloom(a.mesh, a.on);
  }

  function tick(/*dt*/) {
    // no spin by default. Add rotation here if you want:
    // around.forEach(a => { if (a.on) a.mesh.rotation.y += dt * 0.3; });
  }

  return { around, setAroundOn, tick };
}
