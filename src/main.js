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
setScanlines(true); // show CRT overlays for UI by default

function setScanlines(on) {
  ui.root.classList.toggle("noscan", !on);
}

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

/* ============ CAMERA LIGHT RIG (wide spot + shoulder fill) ============ */
scene.add(camera);
const flashRig = new THREE.Object3D();
camera.add(flashRig);

const flashlight = new THREE.SpotLight(
  0xffffff, // color
  70, // intensity
  350, // distance
  THREE.MathUtils.degToRad(65), // cone
  0.95, // penumbra
  1.0 // decay
);
flashlight.castShadow = false;
flashRig.add(flashlight);
flashlight.position.set(0, 0, 0);
const flashTarget = new THREE.Object3D();
flashTarget.position.set(0, 0, -1);
flashRig.add(flashTarget);
flashlight.target = flashTarget;

const shoulder = new THREE.PointLight(0xffffff, 1.8, 8, 1.6);
camera.add(shoulder);
shoulder.position.set(0.15, -0.05, -0.25);

renderer.toneMappingExposure = 1.15;

/* ============ WORLD FILL + FOG ============ */
function setupCinematicLighting() {
  const hemi = new THREE.HemisphereLight(0x1ce0a1, 0x060907, 0.35);
  scene.add(hemi);

  const amb = new THREE.AmbientLight(0x0e1512, 0.18);
  scene.add(amb);

  scene.fog = new THREE.FogExp2(0x000000, 0.002);
}

/* ============ KANT OUT HELPER (runs after world+bloom ready) ============ */
function setupKantOut(worldRoot, bloom) {
  let mesh = null;
  worldRoot.traverse((o) => {
    const name = (o.name || "").toLowerCase();
    if (o.isMesh && (name === "kantout" || /^kantout\b/.test(name))) {
      mesh = o;
      // pre-glow gold
      bloom?.setBoost?.(o, { color: "#f6c453", intensity: 1.6 });
      bloom?.mark?.(o, true);
      console.log("[Bloom] kantOut marked:", o.name);
    }
  });
  if (!mesh) console.warn("[Bloom] kantOut not found in scene");
  return { mesh, spin: false };
}

/* ---------- Pointer lock ↔ UI ---------- */
let wantingLock = false;

controls.addEventListener("lock", () => {
  wantingLock = false;
  canvas.style.cursor = "none";
  setScanlines(false); // HIDE scanlines in-game
  ui.showOnly(null);
});

controls.addEventListener("unlock", () => {
  wantingLock = false;
  canvas.style.cursor = "default";
  setScanlines(true); // RESTORE scanlines on UI
  ui.showOnly("resume");
});

document.addEventListener("pointerlockerror", () => {
  wantingLock = false;
  canvas.style.cursor = "default";
  setScanlines(true);
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

// ====== FLOW ======

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

// INTRO → Continue → load the world
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
   if (o.isMesh) {
     const mats = Array.isArray(o.material) ? o.material : [o.material];
     for (const m of mats) {
       if (!m) continue;
       m.transparent = true;
       m.opacity = 0; // invisible
       m.colorWrite = false; // don't write to color buffer
       m.depthWrite = false; // don't write to depth buffer (prevents occlusion)
       // optional (usually not needed once depthWrite=false):
       // m.depthTest = false;
       // m.toneMapped = false;
     }
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

  // Lighting + kantOut (now that we have world + bloom)
  setupCinematicLighting();
  const kantOut = setupKantOut(worldRoot, bloom);

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

    crystals.setCrystalOn(id, on);
    runds.setRundOn(id, on);

    if (on) {
      audio?.setLayerOn(id, true);
      console.log(`[Audio] latched layer${id + 1} ON`);

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

    const allOn = Array.from(switches.switches.values()).every((s) => s.on);
    if (allOn) {
      console.log("[Finale] all switches ON → arm finale");
      finale.arm();

      // kick kantOut spin + stronger gold
      if (kantOut.mesh) {
        kantOut.spin = true;
        bloom.setBoost?.(kantOut.mesh, { color: "#f6c453", intensity: 2.1 });
      }
    }
  };

  // ----- DO NOT SHOW / RENDER THE WORLD YET -----
  canvas.style.visibility = "hidden"; // hide scene while Controls are up
  setScanlines(true); // keep CRT look for the UI

  // Prepare the animate loop but DO NOT start it yet
  const clock = new THREE.Clock();
  function animate() {
    const dt = Math.min(clock.getDelta(), MAX_DT);
    update(dt, hitXZ, EYE_HEIGHT);
    crystals.tick?.(dt);
    runds.tick?.(dt);
    finale.tick?.(dt);

    // Temporarily hide navMesh for the render/composite pass
    const wasVisible = navMesh.visible;
    navMesh.visible = false;
    bloom.render();
    navMesh.visible = wasVisible;

    requestAnimationFrame(animate);
  }

  // Show Controls screen now
  ui.showOnly("controls");

  // CONTINUE -> reveal scene, disable CRT overlays, lock pointer, start loop
  ui.btnContinue.addEventListener(
    "pointerdown",
    (e) => {
      audio?.context()?.resume?.();
      canvas.style.visibility = "visible";
      setScanlines(false);
      requestLock(e);
      animate(); // start rendering only now
    },
    { once: true }
  );

  // Resume handlers (keep scanlines off once we're in-game)
  ui.btnResume.addEventListener("pointerdown", (e) => {
    audio?.context()?.resume?.();
    setScanlines(false);
    requestLock(e);
  });
  ui.resume.addEventListener("pointerdown", (e) => {
    if (e.target === ui.resume) {
      audio?.context()?.resume?.();
      setScanlines(false);
      requestLock(e);
    }
  });
});

function whatDidIHit(obj) {
  console.log("hit", obj.name, obj.userData);
}
