// switches.js
import * as THREE from "three";

const SWITCH_REGEX = /^switch(\d+)$/i;
const LAMP_COLOR_ON = new THREE.Color("#4ade80");
const LAMP_EMISSIVE_INTENSITY = 1.6;

const HOVER_COLOR = new THREE.Color("#f59e0b");
const HOVER_EMISSIVE_INTENSITY = 1.2;
const INTERACT_MAX_DIST = 100;

export function setupSwitches(root, renderer, camera, controls) {
  const switches = new Map(); // id -> { mesh, on }

  // Collect switches & prep materials
  root.traverse((o) => {
    const m = SWITCH_REGEX.exec(o.name || "");
    if (!m || !o.isMesh) return;
    const id = parseInt(m[1], 10) - 1;

    o.userData.isSwitch = true;
    o.userData.switchId = id;

    // Unique, emissive-capable material
    if (Array.isArray(o.material)) {
      o.material = o.material.map((mm) => ensureEmissiveClone(mm));
    } else {
      o.material = ensureEmissiveClone(o.material);
    }

    // Slightly enlarge hit area
    if (o.geometry) {
      if (o.geometry.boundingSphere == null) o.geometry.computeBoundingSphere();
      if (o.geometry.boundingSphere) o.geometry.boundingSphere.radius *= 1.6;
    }

    setSwitchOn(o, false);
    switches.set(id, { mesh: o, on: false });
  });

  // Picking
  const pickRay = new THREE.Raycaster();
  const pickNDC = new THREE.Vector2();
  let hovered = null;

  function aimNDC(e) {
    if (controls.isLocked) {
      pickNDC.set(0, 0); // center crosshair
    } else {
      const r = renderer.domElement.getBoundingClientRect();
      pickNDC.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1
      );
    }
  }

  function pick() {
    pickRay.setFromCamera(pickNDC, camera);
    pickRay.near = 0.1;
    pickRay.far = INTERACT_MAX_DIST;
    const hits = pickRay.intersectObject(root, true);
    for (const h of hits) {
      const o = h.object;
      if (o?.userData?.isSwitch) return o;
    }
    return null;
  }

  function onMove(e) {
    aimNDC(e);
    const o = pick();
    if (o !== hovered) {
      if (hovered) clearHover(hovered);
      hovered = o;
      if (hovered) applyHover(hovered);
    }
  }

  function onDown(e) {
    aimNDC(e);
    const o = pick();
    if (o && o.userData.isSwitch) toggleSwitchById(o.userData.switchId);
  }

  renderer.domElement.addEventListener("mousemove", onMove);
  renderer.domElement.addEventListener("mousedown", onDown);

  // API
  function toggleSwitchById(id) {
    const s = switches.get(id);
    if (!s) return;
    s.on = !s.on;
    setSwitchOn(s.mesh, s.on);
  }

  return { switches, toggleSwitchById };
}

/* ---------- helpers ---------- */
function ensureEmissiveClone(m) {
  if (!m)
    return new THREE.MeshStandardMaterial({
      color: "#999",
      roughness: 0.6,
      metalness: 0.1,
    });
  if ("emissive" in m) return m.clone();
  return new THREE.MeshStandardMaterial({
    color: m.color ? m.color.clone() : new THREE.Color("#999"),
    roughness: m.roughness ?? 0.6,
    metalness: m.metalness ?? 0.1,
  });
}

function setSwitchOn(mesh, on) {
  const m = mesh.material;
  if (!m) return;
  clearHover(mesh);
  if (on) {
    m.emissive?.copy?.(LAMP_COLOR_ON);
    m.emissiveIntensity = LAMP_EMISSIVE_INTENSITY;
  } else {
    m.emissive?.setRGB?.(0, 0, 0);
    m.emissiveIntensity = 0;
  }
}

function applyHover(mesh) {
  const m = mesh.material;
  if (!m || !("emissive" in m)) return;
  if (!mesh.userData._hoverBak) {
    mesh.userData._hoverBak = {
      color: m.emissive.clone(),
      intensity: m.emissiveIntensity ?? 1,
    };
  }
  m.emissive.copy(HOVER_COLOR);
  m.emissiveIntensity = Math.max(
    m.emissiveIntensity ?? 1,
    HOVER_EMISSIVE_INTENSITY
  );
}

function clearHover(mesh) {
  const m = mesh.material;
  const bak = mesh.userData._hoverBak;
  if (!m || !bak) return;
  m.emissive.copy(bak.color);
  m.emissiveIntensity = bak.intensity;
  delete mesh.userData._hoverBak;
}
function switchNameToId(name) {
  const m = /switch\s*(\d+)/i.exec(name || "");
  return m ? parseInt(m[1], 10) - 1 : null; // 0-based
}