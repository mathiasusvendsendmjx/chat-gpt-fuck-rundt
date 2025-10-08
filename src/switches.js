// src/switches.js
import * as THREE from "three";

const INTERACT_MAX_DIST = 120; // how far you can click a switch
const HOVER_BLOOM_COLOR = "#f59e0b"; // orange when hovered (and OFF)
const ON_BLOOM_COLOR = "#4ade80"; // green when ON
const BLOOM_INTENSITY = 1.5; // hover/ON hint brightness
const HITPAD_SCALE = 2.25; // enlarge hit radius

export function setupSwitches(
  worldRoot,
  renderer,
  camera,
  controls,
  whatDidIHit,
  bloom
) {
  const switchesMap = new Map(); // id -> { mesh, on }
  const lamps = [];

  // collect switch1..switch4
  worldRoot.traverse((o) => {
    if (o.isMesh && /^switch\d+$/i.test(o.name)) lamps.push(o);
  });
  lamps.sort((a, b) => a.name.localeCompare(b.name));

  // ----- picking
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered = null;

  function toNDC(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }
  function aimNDC(e) {
    if (controls.isLocked) ndc.set(0, 0);
    else toNDC(e);
  }
  function pickSwitch() {
    ray.setFromCamera(ndc, camera);
    ray.near = 0.1;
    ray.far = INTERACT_MAX_DIST;
    const hits = ray.intersectObject(worldRoot, true);
    for (const h of hits) {
      const o = h.object;
      if (o?.userData?.isSwitch) return o;
    }
    return null;
  }

  // ----- bloom helpers (optional)
  const hasBloom = () => !!bloom && typeof bloom.mark === "function";
  function markOn(mesh, color) {
    if (!hasBloom() || !mesh) return;
    bloom.setBoost?.(mesh, { color, intensity: BLOOM_INTENSITY });
    bloom.mark(mesh, true);
  }
  function markOff(mesh) {
    if (!hasBloom() || !mesh) return;
    bloom.mark(mesh, false);
  }

  // ----- visuals
  function setSwitchVisual(mesh, on, hovering) {
    if (!mesh) return;
    if (hovering && !on) {
      // orange only when OFF + hovered
      markOn(mesh, HOVER_BLOOM_COLOR);
    } else if (on) {
      markOn(mesh, ON_BLOOM_COLOR); // green when ON
    } else {
      markOff(mesh);
    }
  }

  // ----- API returned to main.js
  const api = {
    switches: switchesMap,
    onToggle: null, // main.js assigns a callback
    toggleSwitchById(id) {
      const s = switchesMap.get(id);
      if (!s) return;
      s.on = !s.on;
      setSwitchVisual(s.mesh, s.on, false);
      api.onToggle?.(id, s.on);
    },
  };

  // ----- init each switch
  lamps.forEach((lamp, idx) => {
    lamp.userData.isSwitch = true;
    lamp.userData.switchId = idx;

    // enlarge hit pad
    if (lamp.geometry) {
      if (lamp.geometry.boundingSphere === null) {
        lamp.geometry.computeBoundingSphere();
      }
      if (lamp.geometry.boundingSphere) {
        lamp.geometry.boundingSphere.radius *= HITPAD_SCALE;
      }
    }

    setSwitchVisual(lamp, false, false);
    switchesMap.set(idx, { mesh: lamp, on: false });
  });

  // ----- events
  const canvas = renderer.domElement;

  function onMove(e) {
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
  }

  function onDown(e) {
    aimNDC(e);
    const hit = pickSwitch();
    if (!hit || !hit.userData?.isSwitch) return;

    whatDidIHit?.(hit);

    const id = hit.userData.switchId;
    const s = switchesMap.get(id);
    s.on = !s.on;

    setSwitchVisual(hit, s.on, false);
    hovered = null;

    api.onToggle?.(id, s.on);
  }

  canvas.addEventListener("mousemove", onMove);
  canvas.addEventListener("mousedown", onDown);

  return api;
}
