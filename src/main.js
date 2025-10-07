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
import { createLayerMixer } from "./audio_layers.js";
import { setupFinale } from "./finale.js";
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

// pivot that pitches the beam (set to 0 to follow camera exactly)
const flashRig = new THREE.Object3D();
flashRig.rotation.x = 0; // -Math.PI / 4 for 45° down
camera.add(flashRig);

// spotlight (tweak to taste)
const flashlight = new THREE.SpotLight(
  0xffffff, // color
  50, // intensity
  200, // distance
  THREE.MathUtils.degToRad(60), // cone angle
  0.9, // penumbra
  0.8 // decay
);
// renderer.shadowMap.enabled = true;
// flashlight.castShadow = true;

flashRig.add(flashlight);
flashlight.position.set(0, 0, 0);

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
  console.log("[UI] Start clicked"); // << requested console.log
  ui.showOnly("loading");

  // --- AUDIO: init inside this user gesture so it can play immediately ---
  const audio = createLayerMixer({
    backgroundUrl: "/audio/background.wav",
    layerUrls: [
      "/audio/layer1.wav",
      "/audio/layer2.wav",
      "/audio/layer3.wav",
      "/audio/layer4.wav",
    ],
    snap: 0.008,
  });

  try {
    await audio.init(); // background unmutes here
    await audio.context()?.resume?.();
    console.log("[Audio] background should now be audible");
  } catch (e) {
    console.error("[Audio] init error:", e);
  }

  // --- WORLD: load as usual (drives your loading UI) ---
  const { worldRoot, navMesh } = await loadWorld({
    onProgress: (p) => (ui.bar.style.width = p + "%"),
  });

  // World (unchanged)
  worldRoot.scale.set(5, 5, 5);
  worldRoot.rotation.y = Math.PI * 1.2;
  scene.add(worldRoot);
  window.worldRoot = worldRoot;

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

  // Switches & visuals
  const switches = setupSwitches(
    worldRoot,
    renderer,
    camera,
    controls,
    whatDidIHit
  );
  const crystals = setupCrystals(worldRoot);
  const runds = setupRunds(worldRoot);
  const finale = setupFinale(worldRoot); // <— NEW

  // LAYER BINDING: latch-on behavior
  // When a switch turns ON => unmute its corresponding layer (index = id)
  // If it turns OFF later, we IGNORE (layer stays unmuted).
  switches.onToggle = (id, on) => {
    console.log("[Switch] toggled", { id, on });
    crystals.setCrystalOn(id, on); // visuals follow your toggle
    runds.setRundOn(id, on);

    if (on) {
      audio.setLayerOn(id, true); // latch: once ON it stays unmuted
      console.log(`[Audio] latched layer${id + 1} ON`);
    }

    // If ALL 4 switches are ON → trigger finale once
    const allOn = Array.from(switches.switches.values()).every((s) => s.on);
    if (allOn) {
      console.log("[Finale] all switches ON → arm finale");
      finale.arm();
    }
  };

  // Controls overlay → lock on click; ensure audio context active
  ui.showOnly("controls");
  ui.btnContinue.addEventListener(
    "click",
    (e) => {
      audio.context()?.resume?.();
      requestLock(e);
    },
    { once: true }
  );

  ui.btnResume.addEventListener("click", () => {
    audio.context()?.resume?.();
    requestLock();
  });
  ui.resume.addEventListener("click", (e) => {
    if (e.target === ui.resume) {
      audio.context()?.resume?.();
      requestLock(e);
    }
  });

  // Animate
  const clock = new THREE.Clock();
  function animate() {
    const dt = Math.min(clock.getDelta(), MAX_DT);
    update(dt, hitXZ, EYE_HEIGHT);
    crystals.tick?.(dt);
    runds.tick?.(dt);
    finale.tick?.(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
});

function whatDidIHit(obj) {
  console.log("hit", obj.name, obj.userData);
}
