// src/switches.js
import * as THREE from "three";

const INTERACT_MAX_DIST = 100;
const HOVER_BLOOM_COLOR = "#f59e0b"; // orange
const ON_BLOOM_COLOR = "#4ade80"; // green
const BLOOM_INTENSITY = 1.5;

export function setupSwitches(
  worldRoot,
  renderer,
  camera,
  controls,
  whatDidIHit,
  bloom // optional
) {
  const switchesMap = new Map(); // id -> { mesh, on }
  const lamps = [];

  // gather: switch1..switch4
  worldRoot.traverse((o) => {
    if (o.isMesh && /^switch\d+$/i.test(o.name)) lamps.push(o);
  });
  lamps.sort((a, b) => a.name.localeCompare(b.name));

  // ----- picking boilerplate
  const pickRay = new THREE.Raycaster();
  const pickNDC = new THREE.Vector2();
  let hovered = null;

  function toNDC(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    pickNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pickNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }
  function aimNDC(e) {
    if (controls.isLocked) pickNDC.set(0, 0);
    else toNDC(e);
  }
  function pickSwitch() {
    pickRay.setFromCamera(pickNDC, camera);
    pickRay.near = 0.1;
    pickRay.far = INTERACT_MAX_DIST;
    const hits = pickRay.intersectObject(worldRoot, true);
    for (const h of hits) {
      const o = h.object;
      if (o?.userData?.isSwitch) return o;
    }
    return null;
  }

  // ----- bloom helpers (hoisted)
  function hasBloom() {
    return !!bloom && typeof bloom.mark === "function";
  }
  function markOn(mesh, color) {
    if (!hasBloom() || !mesh) return;
    bloom.setBoost?.(mesh, { color, intensity: BLOOM_INTENSITY }); // keep cached bright material updated
    bloom.mark(mesh, true);
  }
  function markOff(mesh) {
    if (!hasBloom() || !mesh) return;
    bloom.mark(mesh, false);
  }

  // ----- visuals
  function setSwitchVisual(mesh, on, hovering) {
    if (!mesh) return;
    // show orange only when OFF + hovered
    if (hovering && !on) {
      markOn(mesh, HOVER_BLOOM_COLOR);
      return;
    }
    if (on) markOn(mesh, ON_BLOOM_COLOR);
    else markOff(mesh);
  }

  // ----- public api (THIS is what main.js gets)
  const api = {
    switches: switchesMap, // expose the Map
    onToggle: null, // main.js will assign this
    toggleSwitchById(id) {
      const s = switchesMap.get(id);
      if (!s) return;
      s.on = !s.on;
      setSwitchVisual(s.mesh, s.on, false);
      api.onToggle?.(id, s.on); // << correct dispatch
    },
  };

  // init
  lamps.forEach((lamp, idx) => {
    lamp.userData.isSwitch = true;
    lamp.userData.switchId = idx;

    if (lamp.geometry) {
      if (lamp.geometry.boundingSphere === null)
        lamp.geometry.computeBoundingSphere();
      if (lamp.geometry.boundingSphere)
        lamp.geometry.boundingSphere.radius *= 1.7;
    }

    setSwitchVisual(lamp, false, false);
    switchesMap.set(idx, { mesh: lamp, on: false });
  });

  // events
  const canvas = renderer.domElement;

  const onMove = (e) => {
    aimNDC(e);
    const hit = pickSwitch();

    if (hit !== hovered) {
      if (hovered) {
        const prev = switchesMap.get(hovered.userData.switchId);
        setSwitchVisual(hovered, !!prev?.on, false);
      }
      hovered = hit;

      if (hovered) {
        const cur = switchesMap.get(hovered.userData.switchId);
        setSwitchVisual(hovered, !!cur?.on, true);
      }

      canvas.style.cursor = controls.isLocked
        ? "none"
        : hovered
        ? "pointer"
        : "default";
    }
  };

  const onDown = (e) => {
    aimNDC(e);
    const hit = pickSwitch();
    if (hit && hit.userData?.isSwitch) {
      whatDidIHit?.(hit);

      const id = hit.userData.switchId;
      const s = switchesMap.get(id);
      s.on = !s.on;

      // immediate visual (green if ON)
      setSwitchVisual(hit, s.on, false);
      hovered = null;

      api.onToggle?.(id, s.on); // << correct dispatch
    }
  };

  canvas.addEventListener("mousemove", onMove);
  canvas.addEventListener("mousedown", onDown);

  return api;
}
