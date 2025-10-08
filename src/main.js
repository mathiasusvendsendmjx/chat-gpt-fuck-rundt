// src/main.js
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
import { setupAround } from "./around.js"; // around1..4 toggled by switches
import { createLayerMixer } from "./audio_layers.js";
import { setupFinale } from "./finale.js";
import { setupBloom } from "./bloom.js";
import {
  START_YAW_DEG,
  START_PITCH_DEG,
  EYE_HEIGHT,
  MAX_DT,
} from "./config.js";

/* =========================================================
   1) ONE PLACE TO TUNE BLOOM (shared per type)
========================================================= */
const BLOOM_POST = { threshold: 0.12, strength: 1.35, radius: 0.65 };

const BLOOM_TYPES = {
  // name → { color, intensity, startOn, neutralize }
  kant: { color: "#FFD45A", intensity: 0.2, startOn: true, neutralize: true }, // kantOut / kant*
  around: {
    color: "#0FE6D4",
    intensity: 0.2,
    startOn: false,
    neutralize: true,
  }, // around1..4
  crystal: {
    color: "#4ADE80",
    intensity: 0.2,
    startOn: false,
    neutralize: true,
  }, // crystal1..4
  rund: { color: "#A855F7", intensity: 0.2, startOn: false, neutralize: true }, // rund1..4
  switch: {
    color: "#60A5FA",
    intensity: 0.2,
    startOn: false,
    neutralize: true,
  }, // switch*
  finale: {
    color: "#FFE8A3",
    intensity: 0.2,
    startOn: false,
    neutralize: true,
  }, // finale*
};

/* Name → type routing (case-insensitive) */
const TYPE_PATTERNS = [
  { type: "kant", test: (n) => /^kant(out)?\b/.test(n) },
  { type: "around", test: (n) => /^around\d+\b/.test(n) },
  { type: "crystal", test: (n) => /^crystal\d+\b/.test(n) },
  { type: "rund", test: (n) => /^rund\d+\b/.test(n) },
  { type: "switch", test: (n) => /^switch\d+\b/.test(n) },
  { type: "finale", test: (n) => /^finale\b/.test(n) },
];

function routeType(name) {
  const n = (name || "").toLowerCase();
  for (const r of TYPE_PATTERNS) if (r.test(n)) return r.type;
  return null;
}

/* =========================================================
   2) UI / SCANLINES
========================================================= */
const ui = buildUI();
ui.showOnly("title");
setScanlines(true);
function setScanlines(on) {
  ui.root.classList.toggle("noscan", !on);
}

/* =========================================================
   3) CAMERA / CONTROLS / LIGHTING
========================================================= */
const canvas = renderer.domElement;
if (!canvas.hasAttribute("tabindex")) canvas.setAttribute("tabindex", "-1");

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

const { controls, update } = setupMovement(camera, renderer);

scene.add(camera);
const flashRig = new THREE.Object3D();
camera.add(flashRig);
const flashlight = new THREE.SpotLight(
  0xffffff,
  70,
  350,
  THREE.MathUtils.degToRad(65),
  0.95,
  1.0
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

function setupCinematicLighting() {
  const hemi = new THREE.HemisphereLight(0x1ce0a1, 0x060907, 0.35);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(0x0e1512, 0.18);
  scene.add(amb);
  scene.fog = new THREE.FogExp2(0x000000, 0.002);
}

/* =========================================================
   4) BLOOM UTILS
========================================================= */
function flattenEmissive(mesh) {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const m of mats) {
    if (!m || !("emissive" in m)) continue;
    m.emissive.setRGB(0, 0, 0);
    if ("emissiveIntensity" in m) m.emissiveIntensity = 0;
    m.needsUpdate = true;
  }
}

function applyTypePresets(worldRoot, bloom) {
  // Create per-type bucket for every key in BLOOM_TYPES (prevents .push on undefined)
  const byType = Object.fromEntries(
    Object.keys(BLOOM_TYPES).map((k) => [k, []])
  );

  worldRoot.traverse((o) => {
    if (!o.isMesh) return;
    const t = routeType(o.name);
    if (!t || !BLOOM_TYPES[t]) return;

    const preset = BLOOM_TYPES[t];
    if (preset.neutralize) flattenEmissive(o);

    bloom.setBoost?.(o, { color: preset.color, intensity: preset.intensity });
    bloom.mark?.(o, !!preset.startOn);

    byType[t].push(o);
  });

  return byType;
}

/* =========================================================
   5) POINTER LOCK ↔ UI
========================================================= */
let wantingLock = false;
controls.addEventListener("lock", () => {
  wantingLock = false;
  canvas.style.cursor = "none";
  setScanlines(false);
  ui.showOnly(null);
});
controls.addEventListener("unlock", () => {
  wantingLock = false;
  canvas.style.cursor = "default";
  setScanlines(true);
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

/* =========================================================
   6) FLOW
========================================================= */
let audio;
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
    audio.fadeBackgroundTo?.(1, 1.2);
  } catch (e) {
    console.error("[Audio] init/resume failed:", e);
  }
  ui.showOnly("intro");
  ui.playIntroTypewriter?.();
});

ui.btnIntroNext.addEventListener("click", async () => {
  ui.showOnly("loading");

  // WORLD
  const { worldRoot, navMesh } = await loadWorld({
    onProgress: (p) => (ui.bar.style.width = p + "%"),
  });
  worldRoot.scale.set(5, 5, 5);
  worldRoot.rotation.y = Math.PI * 1.2;
  scene.add(worldRoot);
  window.worldRoot = worldRoot;

  // nav mesh invisible + non-occluding
  navMesh.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      m.transparent = true;
      m.opacity = 0;
      m.colorWrite = false;
      m.depthWrite = false; // critical
      m.toneMapped = false;
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

  // BLOOM
  let bloom;
  try {
    bloom = setupBloom(renderer, scene, camera, BLOOM_POST);
    bloom.setDefaultBoost?.({ color: "#ffffff", intensity: 1.0 }); // safe fallback
  } catch (err) {
    console.error("[Bloom] setup failed:", err);
    bloom = {
      render: () => renderer.render(scene, camera),
      setBoost: () => {},
      mark: () => {},
    };
  }

  setupCinematicLighting();

  // Apply shared type presets (ONE knob per type)
  const meshesByType = applyTypePresets(worldRoot, bloom);

  // Around rings tied to switches (they also follow the "around" knob)
  const around = setupAround(worldRoot, bloom, {
    color: BLOOM_TYPES.around.color,
    intensityOn: BLOOM_TYPES.around.intensity,
  });
  if (around.arounds)
    for (const { mesh } of around.arounds.values()) flattenEmissive(mesh);

  // Systems
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

  // Switch → visuals/audio/bloom
  switches.onToggle = (id, on) => {
    crystals.setCrystalOn(id, on);
    runds.setRundOn(id, on);
    around.setAroundOn?.(id, on);

    // Optional: bloom the visible switch mesh itself using the shared "switch" knob
    const swMesh = switches.switches?.get(id)?.mesh;
    if (swMesh) {
      if (BLOOM_TYPES.switch.neutralize) flattenEmissive(swMesh);
      bloom.setBoost?.(swMesh, BLOOM_TYPES.switch);
      bloom.mark?.(swMesh, on);
    }

    if (on) {
      audio?.setLayerOn(id, true);

      const cMesh = crystals.crystals?.get(id)?.mesh;
      const rMesh = runds.runds?.get(id)?.mesh;

      if (cMesh) {
        if (BLOOM_TYPES.crystal.neutralize) flattenEmissive(cMesh);
        bloom.setBoost?.(cMesh, BLOOM_TYPES.crystal);
        bloom.mark?.(cMesh, true);
      }
      if (rMesh) {
        if (BLOOM_TYPES.rund.neutralize) flattenEmissive(rMesh);
        bloom.setBoost?.(rMesh, BLOOM_TYPES.rund);
        bloom.mark?.(rMesh, true);
      }
    }

    const allOn = Array.from(switches.switches.values()).every((s) => s.on);
    if (allOn) {
      finale.arm();

      // Light up any meshes named finale* with the shared finale knob
      for (const m of meshesByType.finale || []) {
        if (BLOOM_TYPES.finale.neutralize) flattenEmissive(m);
        bloom.setBoost?.(m, BLOOM_TYPES.finale);
        bloom.mark?.(m, true);
      }

      // Reassert kant brightness too if you want a final punch
      for (const m of meshesByType.kant || []) {
        bloom.setBoost?.(m, BLOOM_TYPES.kant);
        bloom.mark?.(m, true);
      }
    }
  };

  // Hide scene during Controls; start render when Continue
  canvas.style.visibility = "hidden";
  setScanlines(true);

  const clock = new THREE.Clock();
  function animate() {
    const dt = Math.min(clock.getDelta(), MAX_DT);
    update(dt, hitXZ, EYE_HEIGHT);
    crystals.tick?.(dt);
    runds.tick?.(dt);
    around.tick?.(dt);
    finale.tick?.(dt);

    const wasVisible = navMesh.visible;
    navMesh.visible = false;
    bloom.render();
    navMesh.visible = wasVisible;

    requestAnimationFrame(animate);
  }

  ui.showOnly("controls");
  ui.btnContinue.addEventListener(
    "pointerdown",
    (e) => {
      audio?.context()?.resume?.();
      canvas.style.visibility = "visible";
      setScanlines(false);
      requestLock(e);
      animate();
    },
    { once: true }
  );

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
window.whatDidIHit = whatDidIHit;
