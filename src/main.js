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
import { setupRunds } from "./runds.js";
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

// ---------- FLASHLIGHT (SpotLight on a 45°-down rig) ----------
scene.add(camera); // ensure camera is in the scene graph

// pivot that pitches the light down ~45°
const flashRig = new THREE.Object3D();
flashRig.rotation.x = 0 // -45° DOWN (pitch), not Z
camera.add(flashRig);

// your spotlight (kept your settings)
const flashlight = new THREE.SpotLight(
  0xffffff,                      // color
  50,                           // intensity
  400,                           // distance
  THREE.MathUtils.degToRad(60),  // cone angle
  0.9,                           // penumbra
  0.8                            // decay
);

// optional shadows (heavier):
// renderer.shadowMap.enabled = true;
// flashlight.castShadow = true;

// mount light on the rig
flashRig.add(flashlight);
flashlight.position.set(0, 0, 0);

// explicit target: forward in rig space (rig is already tilted down)
const flashTarget = new THREE.Object3D();
flashTarget.position.set(0, 0, -1);
flashRig.add(flashTarget);
flashlight.target = flashTarget;


// ---------- Pointer lock ↔ UI (gated, no rAF) ----------
let wantingLock = false;

controls.addEventListener("lock", () => {
  wantingLock = false;
  canvas.style.cursor = "none";
  ui.showOnly(null);
});
controls.addEventListener("unlock", () => {
  wantingLock = false;
  canvas.style.cursor = "default";
  ui.showOnly("resume");
});
document.addEventListener("pointerlockerror", () => {
  wantingLock = false;
  canvas.style.cursor = "default";
  ui.showOnly("resume");
});

function requestLock(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  if (wantingLock || controls.isLocked || document.pointerLockElement) return;
  wantingLock = true;
  canvas.focus({ preventScroll: true });
  try {
    controls.lock();
  } catch (err) {
    wantingLock = false;
    console.error("PointerLock request failed:", err);
  }
}

/* ---------- DEBUG helper (unchanged) ---------- */
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
/* ---------------------------------------------- */

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
  window.worldRoot = worldRoot;

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

const switches = setupSwitches(
  worldRoot,
  renderer,
  camera,
  controls,
  whatDidIHit
);
const crystals = setupCrystals(worldRoot);
const runds = setupRunds(worldRoot);

// when a switch toggles: crystal + rund with same id follow
switches.onToggle = (id, on) => {
  crystals.setCrystalOn(id, on);
  runds.setRundOn(id, on);
};

  // Controls overlay → lock on click
  ui.showOnly("controls");
  ui.btnContinue.addEventListener("click", requestLock, { once: true });

  // Resume overlay: button OR backdrop click
  ui.btnResume.addEventListener("click", requestLock);
  ui.resume.addEventListener("click", (e) => {
    if (e.target === ui.resume) requestLock(e);
  });

  // (Removed) canvas auto-relock—caused races

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
    runds.tick?.(dt); // <— add this
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
});

function whatDidIHit(obj) {
  console.log("hit", obj.name, obj.userData);
}
