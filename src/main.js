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

/* ------------------- Bloom knobs (ONE place to tweak) ------------------- */
const BLOOM = {
  post: { threshold: 0.12, strength: 1.35, radius: 0.65 }, // pipeline
  palette: {
    crystal: { color: "#4ade80", intensity: 2.0 },
    rund: { color: "#a855f7", intensity: 2.0 },
    switch: { color: "#60a5fa", intensity: 0.5 },
    kantOut: { color: "#ffd45a", intensity: 0.5 }, // richer gold
    around: { color: "#0fe6d4", intensity: 0.5 },
    // used if mark() happens without an explicit boost:
    default: { color: "#ffffff", intensity: 1.0 },
  },
};

const ui = buildUI();
ui.showOnly("title");
setScanlines(true); // CRT overlays on for UI

function setScanlines(on) {
  ui.root.classList.toggle("noscan", !on);
}

/* ------------------- Renderer / camera pose ------------------- */
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

/* ------------------- Movement / controls ------------------- */
const { controls, update } = setupMovement(camera, renderer);

/* ------------------- Camera light rig (wide spot + shoulder) ------------------- */
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

/* ------------------- Gentle global lights + fog ------------------- */
function setupCinematicLighting() {
  const hemi = new THREE.HemisphereLight(0x1ce0a1, 0x060907, 0.35);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(0x0e1512, 0.18);
  scene.add(amb);
  scene.fog = new THREE.FogExp2(0x000000, 0.002);
}

/* ------------------- helpers: make bloom ignore emissive ------------------- */
function flattenEmissive(mesh) {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const m of mats) {
    if (!m || !("emissive" in m)) continue;
    m.emissive.setRGB(0, 0, 0);
    m.emissiveIntensity = 0;
    m.needsUpdate = true;
  }
}

/* ------------------- kantOut helper (after world+bloom) ------------------- */
function setupKantOut(worldRoot, bloom) {
  let mesh = null;
  worldRoot.traverse((o) => {
    const nm = (o.name || "").toLowerCase();
    if (o.isMesh && (nm === "kantout" || /^kantout\b/.test(nm))) {
      mesh = o;
      flattenEmissive(o);
      bloom?.setBoost?.(o, BLOOM.palette.kantOut);
      bloom?.mark?.(o, true);
      console.log("[Bloom] kantOut marked:", o.name);
    }
  });
  if (!mesh) console.warn("[Bloom] kantOut not found");
  return { mesh, spin: false };
}

/* ------------------- Pointer lock ↔ UI ------------------- */
let wantingLock = false;

controls.addEventListener("lock", () => {
  wantingLock = false;
  canvas.style.cursor = "none";
  setScanlines(false); // hide CRT overlays in-game
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

/* ------------------- FLOW ------------------- */
let audio; // global
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
    console.log("[Audio] background playing");
  } catch (e) {
    console.error("[Audio] init/resume failed:", e);
  }

  ui.showOnly("intro");
  ui.playIntroTypewriter?.();
});

// Intro → Continue → load world
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

  // Nav mesh must NOT occlude bloom
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

  // --- BLOOM ---
  let bloom;
  try {
    console.log("[Bloom] setting up…");
    bloom = setupBloom(renderer, scene, camera, BLOOM.post);
    // if your bloom.js has setDefaultBoost (my version does), use it:
    bloom.setDefaultBoost?.(BLOOM.palette.default);
    console.log("[Bloom] ready");
  } catch (err) {
    console.error("[Bloom] setup failed, using plain render:", err);
    bloom = { render: () => renderer.render(scene, camera) };
  }

  // Lighting + highlights
  setupCinematicLighting();
  const kantOut = setupKantOut(worldRoot, bloom);

  // Around rings tied to switches
  const around = setupAround(worldRoot, bloom, {
    color: BLOOM.palette.around.color,
    intensityOn: BLOOM.palette.around.intensity,
  });
  // flatten emissive on around meshes so bloom is the only glow
  if (around.arounds) {
    for (const { mesh } of around.arounds.values()) {
      flattenEmissive(mesh);
      bloom.setBoost?.(mesh, BLOOM.palette.around); // ensure consistent boost
    }
  }

  // Other systems
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

  // Map switch -> visuals/audio/around
  switches.onToggle = (id, on) => {
    console.log("[Switch] toggled", { id, on });

    crystals.setCrystalOn(id, on);
    runds.setRundOn(id, on);
    around.setAroundOn?.(id, on); // around1..4 follow switches 0..3

    if (on) {
      audio?.setLayerOn(id, true);

      // bloom the per-switch crystal/rund (and neutralize emissive)
      const cMesh = crystals.crystals?.get(id)?.mesh;
      const rMesh = runds.runds?.get(id)?.mesh;
      if (cMesh) {
        flattenEmissive(cMesh);
        bloom.setBoost?.(cMesh, BLOOM.palette.crystal);
        bloom.mark?.(cMesh, true);
      }
      if (rMesh) {
        flattenEmissive(rMesh);
        bloom.setBoost?.(rMesh, BLOOM.palette.rund);
        bloom.mark?.(rMesh, true);
      }
    }

    const allOn = Array.from(switches.switches.values()).every((s) => s.on);
    if (allOn) {
      console.log("[Finale] all switches ON → arm finale");
      finale.arm();

      // punch kantOut a bit more at finale
      if (kantOut.mesh) bloom.setBoost?.(kantOut.mesh, BLOOM.palette.kantOut);
    }
  };

  // Hide scene behind Controls; start render only after Continue
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

    // prevent navMesh from affecting any pass
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