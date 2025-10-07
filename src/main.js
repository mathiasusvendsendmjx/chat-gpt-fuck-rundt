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
import { setupBloom } from "./bloom.js";
import {
  START_YAW_DEG,
  START_PITCH_DEG,
  EYE_HEIGHT,
  MAX_DT,
} from "./config.js";

const ui = buildUI();
ui.showOnly("title"); // Title screen first

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

// ---------- FLASHLIGHT ----------
scene.add(camera);
const flashRig = new THREE.Object3D();
flashRig.rotation.x = 0;
camera.add(flashRig);
const flashlight = new THREE.SpotLight(
  0xffffff,
  50,
  200,
  THREE.MathUtils.degToRad(60),
  0.9,
  0.8
);
flashRig.add(flashlight);
flashlight.position.set(0, 0, 0);
const flashTarget = new THREE.Object3D();
flashTarget.position.set(0, 0, -1);
flashRig.add(flashTarget);
flashlight.target = flashTarget;

// ---------- Pointer lock ↔ UI ----------
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

/* ---------- DEBUG helper ---------- */
function forceEmissiveOn(objNames, { color = "#4ade80", intensity = 3 } = {}) {
  if (!window.worldRoot) return;
  const want = new Set(objNames.map((n) => String(n).toLowerCase()));
  window.worldRoot.traverse((o) => {
    if (!o.isMesh) return;
    const nm = (o.name || "").toLowerCase();
    if (!want.has(nm)) return;
    const makeStd = (m) =>
      !m || !("emissive" in m)
        ? new THREE.MeshStandardMaterial({
            color: m?.color ? m.color.clone() : new THREE.Color("#9a9a9a"),
            metalness: 0.1,
            roughness: 0.6,
          })
        : m.clone();
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
/* ---------------------------------- */

// ====== NEW FLOW ======

// Music starts on the TITLE "Start" button
let audio; // keep reference globally
ui.btnStartTitle.addEventListener("click", async () => {
  try {
    audio = createLayerMixer({
      backgroundUrl: "/audio/background.wav",
      layerUrls: [
        "/audio/layer1.wav",
        "/audio/layer2.wav",
        "/audio/layer3.wav",
        "/audio/layer4.wav",
      ],
      snap: 0.008,
    });
    await audio.init();
    await audio.context()?.resume?.();
    audio.fadeBackgroundTo?.(1, 1.2); // fade in bg music
    console.log("[Audio] background playing");
  } catch (e) {
    console.error("[Audio] init/resume failed:", e);
  }

  // Show intro + typewriter
  ui.showOnly("intro");
  ui.playIntroTypewriter?.();
});

// INTRO → Continue → now load the world (moved here from the old Start)
ui.btnIntroNext.addEventListener("click", async () => {
  console.log("[UI] Intro Continue clicked");
  ui.showOnly("loading");

  // --- WORLD ---
  const { worldRoot, navMesh } = await loadWorld({
    onProgress: (p) => (ui.bar.style.width = p + "%"),
  });

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
  const box = new THREE.Box3().setFromObject(navMesh);
  const c = box.getCenter(new THREE.Vector3());
  const h = hitXZ(c.x, c.z);
  if (h) camera.position.set(h.x, h.y + EYE_HEIGHT, h.z);

  // --- BLOOM (safe, with fallback) ---
  let bloom;
  try {
    console.log("[Bloom] setting up…");
    bloom = setupBloom(renderer, scene, camera, {
      threshold: 0.1,
      strength: 1,
      radius: 1,
    });
    console.log("[Bloom] ready");
  } catch (err) {
    console.error("[Bloom] setup failed, using plain render:", err);
    bloom = { render: () => renderer.render(scene, camera) };
  }

  // Switches & visuals (bloom passed into switches + finale)
  const switches = setupSwitches(
    worldRoot,
    renderer,
    camera,
    controls,
    whatDidIHit,
    bloom
  );
  const crystals = setupCrystals(worldRoot);
  const runds = setupRunds(worldRoot);
  const finale = setupFinale(worldRoot, bloom);

  // LAYER BINDING: latch-on layers when a switch turns ON
  switches.onToggle = (id, on) => {
    console.log("[Switch] toggled", { id, on });

    // visuals
    crystals.setCrystalOn(id, on);
    runds.setRundOn(id, on);

    // audio: latch the layer ON the first time this switch turns on
    if (on) {
      audio?.setLayerOn(id, true);
      console.log(`[Audio] latched layer${id + 1} ON`);

      // optional: bloom the per-switch crystal/rund when they first turn on
      const cMesh = crystals.crystals?.get(id)?.mesh;
      const rMesh = runds.runds?.get(id)?.mesh;
      if (cMesh) {
        bloom.setBoost?.(cMesh, { color: "#4ade80", intensity: 2 });
        bloom.mark?.(cMesh, true);
      }
      if (rMesh) {
        bloom.setBoost?.(rMesh, { color: "#a855f7", intensity: 2 });
        bloom.mark?.(rMesh, true);
      }
    }

    // Finale when ALL 4 switches are ON
    const allOn = Array.from(switches.switches.values()).every((s) => s.on);
    if (allOn) {
      console.log("[Finale] all switches ON → arm finale");
      finale.arm();
    }
  };

  // Controls overlay → lock on click; ensure audio context active
  ui.showOnly("controls");
  ui.btnContinue.addEventListener(
    "pointerdown",
    (e) => {
      audio?.context()?.resume?.();
      requestLock(e);
    },
    { once: true }
  );
  ui.btnResume.addEventListener("pointerdown", (e) => {
    audio?.context()?.resume?.();
    requestLock(e);
  });
  ui.resume.addEventListener("pointerdown", (e) => {
    if (e.target === ui.resume) {
      audio?.context()?.resume?.();
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
    bloom.render(); // render with selective bloom (or fallback)
    requestAnimationFrame(animate);
  }
  animate();
});

function whatDidIHit(obj) {
  console.log("hit", obj.name, obj.userData);
}
