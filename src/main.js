// main.js
import * as THREE from "three";
import "./style.css";
import { scene, camera, renderer } from "./scene.js";
import { buildUI } from "./ui.js";
import { loadWorld } from "./loaders.js";
import { setupMovement } from "./movement.js";
import { makeHitXZ } from "./nav.js";
import { setupSwitches } from "./switches.js";
import { setupCrystals } from "./crystals.js";
import {
  START_YAW_DEG,
  START_PITCH_DEG,
  EYE_HEIGHT,
  MAX_DT,
} from "./config.js";

const ui = buildUI();
ui.showOnly("start");

const canvas = renderer.domElement;
if (!canvas.hasAttribute("tabindex")) canvas.setAttribute("tabindex", "-1");

// Initial camera pose
camera.position.set(140, EYE_HEIGHT, -100);
setFromDegrees(START_YAW_DEG, START_PITCH_DEG);
function setFromDegrees(yawDeg, pitchDeg) {
  camera.rotation.set(
    THREE.MathUtils.degToRad(pitchDeg),
    THREE.MathUtils.degToRad(yawDeg),
    0,
    "YXZ"
  );
}

// Controls / movement
const { controls, update } = setupMovement(camera, renderer);

// Pointer lock ↔ UI
controls.addEventListener("lock", () => {
  canvas.style.cursor = "none";
  ui.showOnly(null);
});
controls.addEventListener("unlock", () => {
  canvas.style.cursor = "default";
  ui.showOnly("resume");
});
document.addEventListener("pointerlockerror", () => {
  canvas.style.cursor = "default";
  ui.showOnly("resume");
});

// single-gesture helper for resume/continue
function hideOverlayThenLock(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  ui.showOnly(null);
  requestAnimationFrame(() => {
    canvas.focus({ preventScroll: true });
    controls.lock();
  });
}

/* ---------- DEBUG: force emissive ON by name to prove materials glow ---------- */
function forceEmissiveOn(objNames, { color = "#4ade80", intensity = 3 } = {}) {
  if (!window.worldRoot) return;
  const want = new Set(objNames.map((n) => String(n).toLowerCase()));
  window.worldRoot.traverse((o) => {
    if (!o.isMesh) return;
    const nm = (o.name || "").toLowerCase();
    if (!want.has(nm)) return;

    const makeStd = (m) => {
      if (!m || !("emissive" in m)) {
        return new THREE.MeshStandardMaterial({
          color: m?.color ? m.color.clone() : new THREE.Color("#9a9a9a"),
          metalness: 0.1,
          roughness: 0.6,
        });
      }
      return m.clone();
    };
    if (Array.isArray(o.material)) o.material = o.material.map(makeStd);
    else o.material = makeStd(o.material);

    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!("emissive" in m)) continue;
      m.emissive = new THREE.Color(color);
      m.emissiveIntensity = intensity;
      m.needsUpdate = true;
    }
    console.log("Emissive forced ON:", o.name);
  });
}
/* --------------------------------------------------------------------------- */

// FLOW
ui.btnStart.addEventListener("click", async () => {
  ui.showOnly("loading");

  const { worldRoot, navMesh } = await loadWorld({
    onProgress: (p) => (ui.bar.style.width = p + "%"),
  });

  // World
  worldRoot.scale.set(5, 5, 5);
  worldRoot.rotation.y = Math.PI * 1.2;
  scene.add(worldRoot);
  window.worldRoot = worldRoot; // for debug helper

  // Nav (invisible but raycastable)
  navMesh.traverse((o) => {
    if (o.isMesh && o.material) {
      o.material.transparent = true;
      o.material.opacity = 0;
    }
  });
  navMesh.scale.set(5, 5, 5);
  navMesh.rotation.y = Math.PI * 1.2;
  scene.add(navMesh);
  navMesh.updateMatrixWorld(true);

  const hitXZ = makeHitXZ(navMesh);

  // Center camera on nav
  const box = new THREE.Box3().setFromObject(navMesh);
  const c = box.getCenter(new THREE.Vector3());
  const h = hitXZ(c.x, c.z);
  if (h) camera.position.set(h.x, h.y + EYE_HEIGHT, h.z);

  // Switches & crystals
  const switches = setupSwitches(worldRoot, renderer, camera, controls);
  const crystals = setupCrystals(worldRoot);

  // Bind: switch i toggles crystal i
  const originalToggle = switches.toggleSwitchById;
  switches.toggleSwitchById = (i) => {
    originalToggle(i);
    const on = !!switches.switches.get(i)?.on;
    crystals.setCrystalOn(i, on);
  };

  // Controls overlay → lock on pointerdown
  ui.showOnly("controls");
  ui.btnContinue.addEventListener("pointerdown", hideOverlayThenLock, {
    once: true,
  });

  // Resume overlay: button OR backdrop click
  ui.btnResume.addEventListener("pointerdown", hideOverlayThenLock);
  ui.resume.addEventListener("pointerdown", (e) => {
    if (e.target === ui.resume) hideOverlayThenLock(e);
  });

  // Extra: clicking the canvas relocks when overlays hidden
  canvas.addEventListener("pointerdown", () => {
    if (!controls.isLocked) controls.lock();
  });

  // Tab switch
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      canvas.style.cursor = "default";
    } else if (!controls.isLocked) {
      ui.showOnly("resume");
    }
  });

  // Animate
  const clock = new THREE.Clock();
  function animate() {
    const dt = Math.min(clock.getDelta(), MAX_DT);
    update(dt, hitXZ, EYE_HEIGHT);
    crystals.tick?.(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
});
