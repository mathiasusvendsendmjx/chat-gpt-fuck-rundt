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
import { setupAround } from "./around.js";
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
   1) BLOOM: one knob per TYPE (shared across all meshes in that type)
========================================================= */
const BLOOM_POST = { threshold: 0.12, strength: 1.35, radius: 0.3 };

const BLOOM_TYPES = {
  kant: { color: "#FFD45A", intensity: 0.2, startOn: true, neutralize: true },
  around: {
    color: "#FFD45A",
    intensity: 0.2,
    startOn: false,
    neutralize: true,
  },
  crystal: {
    color: "#4ADE80",
    intensity: 0.8,
    startOn: false,
    neutralize: true,
  },
  rund: { color: "#A855F7", intensity: 0.8, startOn: false, neutralize: true },
  switch: {
    color: "#60A5FA",
    intensity: 0.4,
    startOn: false,
    neutralize: true,
  },
  finale: {
    color: "#FFE8A3",
    intensity: 0.4,
    startOn: false,
    neutralize: true,
  },
  roots: { color: "#FFD45A", intensity: 0.2, startOn: false, neutralize: true }, // amber
  bundkort: {
    color: "#17b751",
    intensity: 0,
    startOn: false,
    neutralize: true,
  }, // green
  top: { color: "#A855F7", intensity: 0.8, startOn: false, neutralize: true },
  bund: { color: "#A855F7", intensity: 0.8, startOn: false, neutralize: true },
};

// ~45°/sec each way; adjust to taste
const ROT_TOP_RAD = (45 * Math.PI) / 180; // rotate LEFT (CCW)
const ROT_BUND_RAD = (45 * Math.PI) / 180; // rotate RIGHT (CW)

const TYPE_PATTERNS = [
  { type: "kant", test: (n) => /^kant(out)?\b/.test(n) },
  { type: "around", test: (n) => /^around\d+\b/.test(n) },
  { type: "crystal", test: (n) => /^crystal\d+\b/.test(n) },
  { type: "rund", test: (n) => /^rund\d+\b/.test(n) },
  { type: "switch", test: (n) => /^switch\d+\b/.test(n) },
  { type: "finale", test: (n) => /^finale\b/.test(n) },
  { type: "roots", test: (n) => /^roots\b/.test(n) },
  { type: "bundkort", test: (n) => /^bundkort\b/.test(n) },
  { type: "top", test: (n) => /^top\d+\b/.test(n) },
  { type: "bund", test: (n) => /^bund\d+\b/.test(n) },
];

function routeType(name) {
  const n = (name || "").toLowerCase();
  for (const r of TYPE_PATTERNS) if (r.test(n)) return r.type;
  return null;
}

// hierarchy-aware: children of groups named "roots"/"bundkort" inherit the type
function routeTypeForObject(obj) {
  for (let p = obj; p; p = p.parent) {
    const t = routeType(p.name);
    if (t) return t;
  }
  return null;
}

/* =========================================================
   2) UI / scanlines
========================================================= */
const ui = buildUI();
ui.showOnly("title");
setScanlines(true);
function setScanlines(on) {
  ui.root.classList.toggle("noscan", !on);
}

// Explicit typewriter flow
ui.playTitleTypewriter?.();

ui.btnStartTitle.addEventListener("click", async () => {
  // Start audio, then go to Prologue and type it
  try {
    audio = createLayerMixer({
      backgroundUrl: "/audio/background.mp3",
      layerUrls: [
        "/audio/layer1.mp3",
        "/audio/layer2.mp3",
        "/audio/layer3.mp3",
        "/audio/layer4.mp3",
      ],
      snap: 0.008,
    });
    await audio.init();
    await audio.context()?.resume?.();
    audio.fadeBackgroundTo?.(1, 1.2);
  } catch (e) {
    console.error("[Audio] init/resume failed:", e);
  }
  ui.showOnly("prologue");
  ui.playPrologueTypewriter?.();
});

ui.btnPrologueNext.addEventListener("click", () => {
  ui.showOnly("intro");
  ui.playIntroTypewriter?.(); // lines typed one-by-one, EN+Alien simultaneous per line
});

/* =========================================================
   3) Camera / controls / lighting
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
  110,
  500,
  THREE.MathUtils.degToRad(65),
  0.75,
  0.9
);
flashlight.castShadow = false;
flashRig.add(flashlight);
const flashTarget = new THREE.Object3D();
flashTarget.position.set(0, 0, -1);
flashRig.add(flashTarget);
flashlight.target = flashTarget;

const shoulder = new THREE.PointLight(0xffffff, 1.8, 8, 1.6);
camera.add(shoulder);
shoulder.position.set(0.15, -0.05, -0.25);
renderer.toneMappingExposure = 1.15;

function setupCinematicLighting() {
  scene.add(new THREE.HemisphereLight(0x1ce0a1, 0x060907, 0.35));
  scene.add(new THREE.AmbientLight(0x0e1512, 0.5));
}

/* =========================================================
   4) Bloom helpers
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

function applyTypePresets(root, bloom) {
  const byType = Object.fromEntries(
    Object.keys(BLOOM_TYPES).map((k) => [k, []])
  );
  root.traverse((o) => {
    if (!o.isMesh) return;
    const t = routeTypeForObject(o);
    if (!t) return;
    const preset = BLOOM_TYPES[t];
    if (!preset) return;

    if (preset.neutralize) flattenEmissive(o);
    bloom.setBoost?.(o, { color: preset.color, intensity: preset.intensity });
    bloom.mark?.(o, !!preset.startOn);

    byType[t].push(o);
  });
  return byType;
}

function indexBySuffix(list, prefix) {
  const out = [];
  const rx = new RegExp(`^${prefix}(\\d+)\\b`);
  for (const m of list || []) {
    const match = (m.name || "").toLowerCase().match(rx);
    if (!match) continue;
    const idx = Math.max(0, parseInt(match[1], 10) - 1);
    out[idx] = m;
  }
  return out;
}

function getMeshByName(root, name) {
  const want = String(name).toLowerCase();
  let out = null;
  root.traverse((o) => {
    if (out || !o.isMesh) return;
    if ((o.name || "").toLowerCase() === want) out = o;
  });
  return out;
}

/* =========================================================
   5) Pointer lock ↔ UI
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
    console.error(err);
  }
}

/* =========================================================
   6) Flow
========================================================= */
let audio;

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
      m.depthWrite = false;
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
    bloom.setDefaultBoost?.({ color: "#ffffff", intensity: 1.0 });
  } catch (err) {
    console.error("[Bloom] setup failed:", err);
    bloom = {
      render: () => renderer.render(scene, camera),
      setBoost: () => {},
      mark: () => {},
    };
  }

  setupCinematicLighting();

  // Apply presets and keep references
  const meshesByType = applyTypePresets(worldRoot, bloom);

  // build index -> mesh for top/bund so we can tie them to switches 0..3
  const topByIndex = indexBySuffix(meshesByType.top, "top");
  const bundByIndex = indexBySuffix(meshesByType.bund, "bund");

  // spin flags per index
  const spinTop = [false, false, false, false];
  const spinBund = [false, false, false, false];

  // ensure emissive is neutral on these guys (so the knob truly rules)
  for (const m of meshesByType.top || []) flattenEmissive(m);
  for (const m of meshesByType.bund || []) flattenEmissive(m);

  // pre-apply their boost (remain off until switches toggle)
  for (const m of meshesByType.top || []) bloom.setBoost?.(m, BLOOM_TYPES.top);
  for (const m of meshesByType.bund || [])
    bloom.setBoost?.(m, BLOOM_TYPES.bund);

  // Around rings (also neutralized)
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

  // Capture finale meshes that may appear later
  function rescanFinaleMeshes() {
    worldRoot.traverse((o) => {
      if (!o.isMesh) return;
      const n = (o.name || "").toLowerCase();
      if (!/^finale\b/.test(n)) return;
      if (!meshesByType.finale.includes(o)) {
        if (BLOOM_TYPES.finale.neutralize) flattenEmissive(o);
        bloom.setBoost?.(o, BLOOM_TYPES.finale);
        if (BLOOM_TYPES.finale.startOn) bloom.mark?.(o, true);
        meshesByType.finale.push(o);
      }
    });
  }

  // Switch → visuals/audio/bloom (TRUE TOGGLE)
  switches.onToggle = (id, on) => {
    crystals.setCrystalOn(id, on);
    runds.setRundOn(id, on);
    around.setAroundOn?.(id, on);

    // switch mesh bloom state (assert)
    const swName = `switch${id + 1}`;
    const swMesh =
      getMeshByName(worldRoot, swName) ||
      (meshesByType.switch || []).find(
        (m) => (m.name || "").toLowerCase() === swName
      );
    if (swMesh) {
      if (BLOOM_TYPES.switch.neutralize) flattenEmissive(swMesh);
      bloom.setBoost?.(swMesh, BLOOM_TYPES.switch);
      bloom.mark?.(swMesh, on);
    }

    // AUDIO toggle
    audio?.setLayerOn(id, !!on);

    // crystals/runds bloom toggle
    const cMesh = crystals.crystals?.get(id)?.mesh;
    const rMesh = runds.runds?.get(id)?.mesh;
    if (cMesh) {
      if (BLOOM_TYPES.crystal.neutralize) flattenEmissive(cMesh);
      bloom.setBoost?.(cMesh, BLOOM_TYPES.crystal);
      bloom.mark?.(cMesh, on);
    }
    if (rMesh) {
      if (BLOOM_TYPES.rund.neutralize) flattenEmissive(rMesh);
      bloom.setBoost?.(rMesh, BLOOM_TYPES.rund);
      bloom.mark?.(rMesh, on);
    }

    // top/bund: green + spin when ON (left for top, right for bund)
    const t = topByIndex[id];
    const b = bundByIndex[id];
    if (t) {
      if (BLOOM_TYPES.top.neutralize) flattenEmissive(t);
      bloom.setBoost?.(t, BLOOM_TYPES.top);
      bloom.mark?.(t, on);
      spinTop[id] = !!on;
    }
    if (b) {
      if (BLOOM_TYPES.bund.neutralize) flattenEmissive(b);
      bloom.setBoost?.(b, BLOOM_TYPES.bund);
      bloom.mark?.(b, on);
      spinBund[id] = !!on;
    }

    // Finale arm when ALL ON
    const allOn = Array.from(switches.switches.values()).every((s) => s.on);
    if (allOn) {
      finale.arm?.();

      // finale meshes
      rescanFinaleMeshes();
      for (const m of meshesByType.finale) {
        if (BLOOM_TYPES.finale.neutralize) flattenEmissive(m);
        bloom.setBoost?.(m, BLOOM_TYPES.finale);
        bloom.mark?.(m, true);
      }

      // roots (amber) + bundkort (green)
      for (const m of meshesByType.roots) {
        if (BLOOM_TYPES.roots.neutralize) flattenEmissive(m);
        bloom.setBoost?.(m, BLOOM_TYPES.roots);
        bloom.mark?.(m, true);
      }
      for (const m of meshesByType.bundkort) {
        if (BLOOM_TYPES.bundkort.neutralize) flattenEmissive(m);
        bloom.setBoost?.(m, BLOOM_TYPES.bundkort);
        bloom.mark?.(m, true);
      }

      // keep kant asserted
      for (const m of meshesByType.kant) {
        bloom.setBoost?.(m, BLOOM_TYPES.kant);
        bloom.mark?.(m, true);
      }
    }
  };

  // Hide scene during Controls; start render when Continue
  canvas.style.visibility = "hidden";
  setScanlines(true);

  // Keep certain types under your control even if their files tweak emissive
  function reassertTypeControl() {
    for (const k of ["switch", "finale", "roots", "bundkort"]) {
      const preset = BLOOM_TYPES[k];
      if (!preset) continue;
      for (const m of meshesByType[k]) {
        if (preset.neutralize) flattenEmissive(m);
        bloom.setBoost?.(m, preset);
      }
    }
  }

  const clock = new THREE.Clock();
  function animate() {
    const dt = Math.min(clock.getDelta(), MAX_DT);
    update(dt, hitXZ, EYE_HEIGHT);
    crystals.tick?.(dt);
    runds.tick?.(dt);
    around.tick?.(dt);
    finale.tick?.(dt);

    rescanFinaleMeshes();
    reassertTypeControl();

    // spin tops/bunds while ON
    for (let i = 0; i < 4; i++) {
      const t = topByIndex[i];
      const b = bundByIndex[i];
      if (t && spinTop[i]) t.rotation.y += ROT_TOP_RAD * dt; // left (CCW)
      if (b && spinBund[i]) b.rotation.y -= ROT_BUND_RAD * dt; // right (CW)
    }

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
