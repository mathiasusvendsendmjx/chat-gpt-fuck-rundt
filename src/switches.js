// switches.js
import * as THREE from "three";

const INTERACT_MAX_DIST = 100;
const HOVER_COLOR = new THREE.Color("#f59e0b");
const HOVER_EMISSIVE_INTENSITY = 1.2;
const LAMP_COLOR_ON = new THREE.Color("#4ade80");
const LAMP_EMISSIVE_INTENSITY = 1.6;

export function setupSwitches(worldRoot, renderer, camera, controls) {
  const switches = new Map(); // id -> { mesh, on }
  const lamps = [];

  // collect switch meshes by name: switch1..switch4
  worldRoot.traverse((o) => {
    if (o.isMesh && /^switch\d+$/i.test(o.name)) lamps.push(o);
  });
  lamps.sort((a, b) => a.name.localeCompare(b.name));

  // normalize each lamp (unique material + bigger hit)
  lamps.forEach((lamp, idx) => {
    lamp.userData.isSwitch = true;
    lamp.userData.switchId = idx;

    // ensure emissive-capable material, and clone so each is independent
    const toStd = (m) => {
      if (!m || !("emissive" in m)) {
        return new THREE.MeshStandardMaterial({
          color: m?.color ? m.color.clone() : new THREE.Color("#9a9a9a"),
          metalness: 0.1,
          roughness: 0.6,
        });
      }
      return m.clone();
    };
    lamp.material = Array.isArray(lamp.material)
      ? lamp.material.map(toStd)
      : toStd(lamp.material);

    // larger hit area
    if (lamp.geometry) {
      if (lamp.geometry.boundingSphere === null)
        lamp.geometry.computeBoundingSphere();
      if (lamp.geometry.boundingSphere)
        lamp.geometry.boundingSphere.radius *= 1.7;
    }

    setSwitchVisual(lamp, false);
    switches.set(idx, { mesh: lamp, on: false });
  });

  // picking
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

  function applyHover(mesh) {
    const m = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!m || !("emissive" in m)) return;
    if (!mesh.userData._hoverBackup) {
      mesh.userData._hoverBackup = {
        emissive: m.emissive.clone(),
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
    const m = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const bak = mesh.userData._hoverBackup;
    if (!m || !bak) return;
    m.emissive.copy(bak.emissive);
    m.emissiveIntensity = bak.intensity;
    delete mesh.userData._hoverBackup;
  }

  function setSwitchVisual(mesh, on) {
    // clear hover override first
    clearHover(mesh);

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!("emissive" in m)) continue;
      if (on) {
        m.emissive.copy(LAMP_COLOR_ON);
        m.emissiveIntensity = LAMP_EMISSIVE_INTENSITY;
      } else {
        m.emissive.setRGB(0, 0, 0);
        m.emissiveIntensity = 0.0;
      }
      m.needsUpdate = true;
    }
  }

  function toggleSwitchById(id) {
    const s = switches.get(id);
    if (!s) return;
    s.on = !s.on;
    setSwitchVisual(s.mesh, s.on);
  }

  // hover + click
  const canvas = renderer.domElement;
  const onMove = (e) => {
    aimNDC(e);
    const hit = pickSwitch();
    if (hit !== hovered) {
      if (hovered) clearHover(hovered);
      hovered = hit;
      if (hovered) applyHover(hovered);
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
      toggleSwitchById(hit.userData.switchId);
    }
  };

  canvas.addEventListener("mousemove", onMove);
  canvas.addEventListener("mousedown", onDown);

  return { switches, toggleSwitchById };
}
