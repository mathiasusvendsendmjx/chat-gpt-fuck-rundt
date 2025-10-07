// switches.js
import * as THREE from "three";

const INTERACT_MAX_DIST = 100;
const HOVER_COLOR = new THREE.Color("#f59e0b");
const HOVER_EMISSIVE_INTENSITY = 1.2;
const LAMP_COLOR_ON = new THREE.Color("#4ade80");
const LAMP_EMISSIVE_INTENSITY = 1.6;

export function setupSwitches(
  worldRoot,
  renderer,
  camera,
  controls,
  whatDidIHit
) {
  // id -> { mesh, on }
  const switches = new Map();
  // Raycast KUN mod disse meshes
  const switchMeshes = [];

  // Find "switchN" i GLTF og brug N-1 som id (0-based)
  worldRoot.traverse((o) => {
    if (!o.isMesh) return;
    const m = /^switch(\d+)$/i.exec(o.name || "");
    if (!m) return;

    const num = parseInt(m[1], 10);
    const id = num - 1;

    o.userData.isSwitch = true;
    o.userData.switchId = id;

    // sikr emissive og unikke materialer
    const toStd = (mat) => {
      if (!mat || !("emissive" in mat)) {
        return new THREE.MeshStandardMaterial({
          color: mat?.color ? mat.color.clone() : new THREE.Color("#9a9a9a"),
          metalness: 0.1,
          roughness: 0.6,
        });
      }
      return mat.clone();
    };
    o.material = Array.isArray(o.material)
      ? o.material.map(toStd)
      : toStd(o.material);

    // større hit
    if (o.geometry) {
      if (o.geometry.boundingSphere === null)
        o.geometry.computeBoundingSphere();
      if (o.geometry.boundingSphere) o.geometry.boundingSphere.radius *= 1.7;
    }

    setSwitchVisual(o, false);
    switches.set(id, { mesh: o, on: false });
    switchMeshes.push(o);
  });

  console.log(
    "[Switches] found ids:",
    Array.from(switches.keys())
      .sort((a, b) => a - b)
      .map((i) => i + 1)
      .join(", ") || "(none)"
  );

  // ---------- picking ----------
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
    const hits = pickRay.intersectObjects(switchMeshes, true); // kun switches
    if (!hits.length) return null;

    let node = hits[0].object;
    while (node && !/^switch\d+$/i.test(node.name)) node = node.parent;
    return node ?? null;
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
    clearHover(mesh); // fjern hover-override først
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

  // API-objekt med callback
  const api = {
    switches,
    onToggle: null, // <-- sæt denne udefra: (id, on) => {}
    toggleSwitchById(id) {
      id = Number(id);
      const s = switches.get(id);
      if (!s) {
        console.warn("[Switches] toggle: unknown id", id);
        return;
      }
      s.on = !s.on;
      setSwitchVisual(s.mesh, s.on);

      // notifícer resten af appen
      api.onToggle?.(id, s.on);
      // (valgfrit) DOM event til debugging/tools
      window.dispatchEvent(
        new CustomEvent("switch-toggled", { detail: { id, on: s.on } })
      );
    },
    dispose() {
      const canvas = renderer.domElement;
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mousedown", onDown);
    },
  };

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
      whatDidIHit?.(hit);
      api.toggleSwitchById(hit.userData.switchId); // <-- bruger API-metoden (kan override’/kobles)
    }
  };

  canvas.addEventListener("mousemove", onMove);
  canvas.addEventListener("mousedown", onDown);

  return api;
}
