import "./style.css";
import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/* ========= Interact config ========= */
const INTERACT_MAX_DIST = 100;
const HOVER_COLOR = new THREE.Color("#f59e0b");
const HOVER_EMISSIVE_INTENSITY = 1.2;

/* ========= Config ========= */
const START_FROM = "DEGREES";
const START_YAW_DEG = 125;
const START_PITCH_DEG = 20;
const START_POS = new THREE.Vector3(140, 10, -100);
const LOOK_AT = new THREE.Vector3(100, 8, -140);
const EYE_HEIGHT = 10.0;

// Movement
const MOVE_SPEED = 30;
const RUN_MULTIPLIER = 2;
const LOOK_SENSITIVITY = 0.45;

// Animation clamp
const MAX_DT = 0.05;

/* ========= Scene / Camera / Renderer ========= */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x333333);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);
camera.position.set(140, EYE_HEIGHT, -100);
camera.rotation.order = "YXZ";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
renderer.domElement.style.cursor = "default";

/* ========= Lights ========= */
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

/* ========= UI Overlays ========= */
const startOverlay = el(`
  <div style="position:fixed;inset:0;background:rgba(0,0,0,.5);
              display:flex;align-items:center;justify-content:center;z-index:1000">
    <button id="btnStart" style="padding:14px 18px;border:0;border-radius:12px;background:#4ade80;color:#0a0a0a;cursor:pointer;font-size:16px">
      Start
    </button>
  </div>
`);
document.body.appendChild(startOverlay);
const btnStart = startOverlay.querySelector("#btnStart");

const videoOverlay = el(`
  <div style="position:fixed;inset:0;background:#000;display:none;align-items:center;justify-content:center;z-index:1000">
    <video id="introVid" src="/intro.mp4" style="max-width:100%;max-height:100%" playsinline></video>
    <button id="skipVid" style="position:absolute;right:24px;top:24px;padding:10px 14px;border:0;border-radius:10px;background:#fff;color:#000;cursor:pointer">
      Skip
    </button>
  </div>
`);
document.body.appendChild(videoOverlay);
const introVid = videoOverlay.querySelector("#introVid");
const skipVid = videoOverlay.querySelector("#skipVid");

const loadingOverlay = el(`
  <div style="position:fixed;inset:0;background:transparent;display:none;
              align-items:center;justify-content:center;z-index:1000;color:#fff;font-family:system-ui,sans-serif;flex-direction:column;gap:12px">
    <div style="background:rgba(18,18,18,.55);backdrop-filter: blur(6px);-webkit-backdrop-filter: blur(6px);
                border:1px solid rgba(255,255,255,.1);padding:18px 16px;border-radius:12px;min-width:280px">
      <div style="font-size:14px;opacity:.9;margin-bottom:8px;text-align:center">Loading…</div>
      <div style="width:320px;max-width:60vw;height:8px;background:#333;border-radius:999px;overflow:hidden">
        <div id="bar" style="height:100%;width:0%;background:#4ade80;transition:width .15s ease"></div>
      </div>
    </div>
  </div>
`);
document.body.appendChild(loadingOverlay);
const loadingBar = loadingOverlay.querySelector("#bar");

const controlsOverlay = el(`
  <div style="position:fixed;inset:0;background:transparent;display:none;
              align-items:center;justify-content:center;z-index:1000;color:#fff;font-family:system-ui,sans-serif;pointer-events:auto">
    <div style="background:rgba(18,18,18,.55);backdrop-filter: blur(6px);-webkit-backdrop-filter: blur(6px);
                border:1px solid rgba(255,255,255,.1);padding:22px 20px;border-radius:14px;max-width:520px;width:90%;
                box-shadow:0 10px 30px rgba(0,0,0,.35)">
      <h2 style="margin:0 0 10px;font-size:20px">How to play</h2>
      <ul style="margin:0 0 18px 18px;line-height:1.6;font-size:14px;opacity:.95">
        <li>W / A / S / D — move</li>
        <li>Mouse — look</li>
        <li>Shift — run</li>
        <li>Click crystals to toggle</li>
      </ul>
      <div style="display:flex;justify-content:flex-end;gap:10px">
        <button id="btnContinue" style="padding:10px 14px;border:0;border-radius:10px;background:#4ade80;color:#0a0a0a;cursor:pointer">
          Continue
        </button>
      </div>
    </div>
  </div>
`);
document.body.appendChild(controlsOverlay);
const btnContinue = controlsOverlay.querySelector("#btnContinue");

const resumeOverlay = el(`
  <div id="resumeOverlay" style="position:fixed;inset:0;display:none;align-items:center;justify-content:center;
       background:rgba(0,0,0,.45);z-index:1000;color:#fff;font-family:system-ui,sans-serif">
    <div style="background:rgba(18,18,18,.6);border:1px solid rgba(255,255,255,.12);padding:18px 20px;border-radius:12px;
                box-shadow:0 10px 30px rgba(0,0,0,.35);text-align:center;max-width:380px">
      <div style="font-size:18px;margin-bottom:8px">Paused</div>
      <div style="opacity:.9;margin-bottom:14px;font-size:14px">Click to resume and recapture the mouse (Pointer Lock).</div>
      <button id="btnResume" style="padding:10px 14px;border:0;border-radius:10px;background:#4ade80;color:#0a0a0a;cursor:pointer">
        Resume
      </button>
    </div>
  </div>
`);
document.body.appendChild(resumeOverlay);
const btnResume = resumeOverlay.querySelector("#btnResume");
// keep resume hidden + non-interactive until needed
resumeOverlay.style.display = "none";
resumeOverlay.style.pointerEvents = "none";

/* ========= Initial overlay state ========= */
function showOnlyStart() {
  startOverlay.style.display = "flex";
  startOverlay.style.pointerEvents = "auto";

  videoOverlay.style.display = "none";
  loadingOverlay.style.display = "none";
  controlsOverlay.style.display = "none";

  resumeOverlay.style.display = "none";
  resumeOverlay.style.pointerEvents = "none";
}
showOnlyStart();

/* ========= Flow ========= */
btnStart.addEventListener("click", async () => {
  startOverlay.style.display = "none";
  videoOverlay.style.display = "flex";
  try {
    introVid.currentTime = 0;
    introVid.muted = false;
    await introVid.play();
  } catch {
    introVid.setAttribute("controls", "true");
  }
  setTimeout(() => {
    if (videoOverlay.style.display !== "none") endVideo();
  }, 30000);
});
skipVid.addEventListener("click", endVideo);
introVid.addEventListener("ended", endVideo);

function endVideo() {
  introVid.pause();
  videoOverlay.style.display = "none";
  beginLoading();
}

btnContinue.addEventListener("click", () => {
  controlsOverlay.style.display = "none";
  startGame();
});

/* ========= Loading (GLTFs) ========= */
let navMesh = null;
let worldRoot = null;
let gltfLoader = null;

function beginLoading() {
  loadingOverlay.style.display = "flex";

  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, loaded, total) => {
    loadingBar.style.width =
      (total ? Math.round((loaded / total) * 100) : 0) + "%";
  };
  manager.onLoad = () => {
    setInitialView();
    setTimeout(() => {
      loadingOverlay.style.display = "none";
      controlsOverlay.style.display = "flex";
      isPlaying = false;
      renderer.domElement.style.cursor = "default";
    }, 150);
  };

  gltfLoader = new GLTFLoader(manager);

  // Visible world (contains switches named switch1..switch4)
  gltfLoader.load("/models/bundkort2.gltf", (gltf) => {
    worldRoot = gltf.scene;
    worldRoot.scale.set(5, 5, 5);
    worldRoot.rotation.y = Math.PI * 1.2;
    scene.add(worldRoot);
    setupSwitches(worldRoot);
  });

  // Invisible nav mesh (walkable bounds)
  gltfLoader.load("/models/nav1.gltf", (gltf) => {
    navMesh = gltf.scene;
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

    const box = new THREE.Box3().setFromObject(navMesh);
    const c = box.getCenter(new THREE.Vector3());
    const h = hitXZ(c.x, c.z);
    if (h) camera.position.set(h.x, h.y + EYE_HEIGHT, h.z);
  });
}

/* ========= Start Pose ========= */
function setInitialView() {
  if (START_FROM === "MARKER") {
    const ok = setFromMarkers(worldRoot) || setFromMarkers(navMesh);
    if (ok) return setControlsFacingCamera();
    setFromDegrees(START_YAW_DEG, START_PITCH_DEG);
    return setControlsFacingCamera();
  }

  if (START_FROM === "LOOKAT") {
    camera.position.copy(START_POS);
    camera.lookAt(LOOK_AT);
    return setControlsFacingCamera();
  }

  setFromDegrees(START_YAW_DEG, START_PITCH_DEG);
  setControlsFacingCamera();
}

function setFromDegrees(yawDeg, pitchDeg) {
  camera.rotation.set(
    THREE.MathUtils.degToRad(pitchDeg),
    THREE.MathUtils.degToRad(yawDeg),
    0,
    "YXZ"
  );
}

function setFromMarkers(root) {
  if (!root) return false;
  const spawn = root.getObjectByName("Spawn");
  if (!spawn) return false;

  const wp = new THREE.Vector3();
  spawn.getWorldPosition(wp);
  camera.position.set(wp.x, wp.y + EYE_HEIGHT, wp.z);

  const target = root.getObjectByName("SpawnTarget");
  if (target) {
    const wt = new THREE.Vector3();
    target.getWorldPosition(wt);
    camera.lookAt(wt);
  } else {
    const wq = new THREE.Quaternion();
    spawn.getWorldQuaternion(wq);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(wq);
    camera.lookAt(wp.clone().add(forward));
  }
  return true;
}
function setControlsFacingCamera() {}

/* ========= Controls ========= */
const controls = new PointerLockControls(camera, renderer.domElement);

controls.addEventListener("lock", () => {
  isPlaying = true;
  resumeOverlay.style.display = "none";
  resumeOverlay.style.pointerEvents = "none";
  renderer.domElement.style.cursor = "none";
});
controls.addEventListener("unlock", () => {
  isPlaying = false;
  renderer.domElement.style.cursor = "default";
  const introHidden =
    startOverlay.style.display === "none" &&
    videoOverlay.style.display === "none" &&
    loadingOverlay.style.display === "none" &&
    controlsOverlay.style.display === "none";
  if (introHidden) {
    resumeOverlay.style.display = "flex";
    resumeOverlay.style.pointerEvents = "auto";
  }
});
document.addEventListener("pointerlockerror", () => {
  isPlaying = false;
  renderer.domElement.style.cursor = "default";
  const introHidden =
    startOverlay.style.display === "none" &&
    videoOverlay.style.display === "none" &&
    loadingOverlay.style.display === "none" &&
    controlsOverlay.style.display === "none";
  if (introHidden) {
    resumeOverlay.style.display = "flex";
    resumeOverlay.style.pointerEvents = "auto";
  }
});

/* ========= Movement ========= */
let moveF = false,
  moveB = false,
  moveL = false,
  moveR = false;
let isRunning = false;

window.addEventListener("keydown", (e) => {
  switch (e.code) {
    case "KeyW":
      moveF = true;
      break;
    case "KeyS":
      moveB = true;
      break;
    case "KeyA":
      moveL = true;
      break;
    case "KeyD":
      moveR = true;
      break;
    case "ShiftLeft":
    case "ShiftRight":
      isRunning = true;
      break;
  }
});
window.addEventListener("keyup", (e) => {
  switch (e.code) {
    case "KeyW":
      moveF = false;
      break;
    case "KeyS":
      moveB = false;
      break;
    case "KeyA":
      moveL = false;
      break;
    case "KeyD":
      moveR = false;
      break;
    case "ShiftLeft":
    case "ShiftRight":
      isRunning = false;
      break;
  }
});

/* ========= Start / Resume ========= */
let isPlaying = false;
function startGame() {
  controls.lock();
}
btnResume.addEventListener("click", () => controls.lock());
renderer.domElement.addEventListener("click", () => {
  if (
    !controls.isLocked &&
    videoOverlay.style.display === "none" &&
    controlsOverlay.style.display === "none"
  ) {
    controls.lock();
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    isPlaying = false;
    renderer.domElement.style.cursor = "default";
  } else {
    if (
      !controls.isLocked &&
      videoOverlay.style.display === "none" &&
      controlsOverlay.style.display === "none"
    ) {
      resumeOverlay.style.display = "flex";
      resumeOverlay.style.pointerEvents = "auto";
    }
  }
});

/* ========= Nav hit test ========= */
const downRay = new THREE.Raycaster();
downRay.far = 20000;
function hitXZ(x, z) {
  if (!navMesh) return null;
  downRay.set(new THREE.Vector3(x, 10000, z), new THREE.Vector3(0, -1, 0));
  const h = downRay.intersectObject(navMesh, true);
  return h.length ? h[0].point : null;
}

/* ========= SWITCHES ========= */
const switches = new Map();
const LAMP_COLOR_ON = new THREE.Color("#4ade80");
const LAMP_EMISSIVE_INTENSITY = 1.6;

const pickRay = new THREE.Raycaster();
const pickNDC = new THREE.Vector2();
let hoveredSwitch = null;

// helpers for picking
function toNDC(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  pickNDC.set(x, y);
}
function aimNDC(e) {
  if (controls.isLocked) pickNDC.set(0, 0);
  else toNDC(e);
}
function pickSwitch() {
  if (!worldRoot) return null;
  pickRay.setFromCamera(pickNDC, camera);
  pickRay.near = 0.1;
  pickRay.far = INTERACT_MAX_DIST;
  const hits = pickRay.intersectObject(worldRoot, true);
  for (const h of hits) {
    const o = h.object;
    if (o?.userData?.isSwitch)
      return { obj: o, point: h.point, dist: h.distance };
  }
  return null;
}

/* Hover visuals */
function applyHoverVisual(mesh) {
  const m = mesh.material;
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
function clearHoverVisual(mesh) {
  const m = mesh.material;
  const bak = mesh?.userData?._hoverBackup;
  if (!m || !bak) return;
  m.emissive.copy(bak.emissive);
  m.emissiveIntensity = bak.intensity;
  delete mesh.userData._hoverBackup;
}
function onHoverSwitch(e) {
  if (!isPlaying) return;
  aimNDC(e);
  const hit = pickSwitch();
  const newHover = hit ? hit.obj : null;
  if (newHover !== hoveredSwitch) {
    if (hoveredSwitch) clearHoverVisual(hoveredSwitch);
    hoveredSwitch = newHover;
    if (hoveredSwitch) {
      applyHoverVisual(hoveredSwitch);
      renderer.domElement.style.cursor = controls.isLocked ? "none" : "pointer";
    } else {
      renderer.domElement.style.cursor = controls.isLocked ? "none" : "default";
    }
  }
}
function onClickSwitch(e) {
  if (!isPlaying) return;
  aimNDC(e);
  const hit = pickSwitch();
  if (hit && hit.obj?.userData?.isSwitch)
    toggleSwitchById(hit.obj.userData.switchId);
}

function setSwitchOn(lampMesh, on) {
  const m = lampMesh.material;
  if (!m) return;
  clearHoverVisual(lampMesh);
  if (on) {
    m.emissive?.copy?.(LAMP_COLOR_ON);
    m.emissiveIntensity = LAMP_EMISSIVE_INTENSITY;
    lampMesh.layers.enable(1);
  } else {
    m.emissive?.setRGB?.(0, 0, 0);
    m.emissiveIntensity = 0.0;
    lampMesh.layers.disable(1);
  }
}
function toggleSwitchById(id) {
  const s = switches.get(id);
  if (!s) return;
  s.on = !s.on;
  setSwitchOn(s.mesh, s.on);
}

function setupSwitches(root) {
  const lamps = [];
  root.traverse((o) => {
    if (o.isMesh && /^switch\d+$/i.test(o.name)) lamps.push(o);
  });
  lamps.sort((a, b) => a.name.localeCompare(b.name));

  lamps.forEach((lamp, idx) => {
    lamp.userData.isSwitch = true;
    lamp.userData.switchId = idx;

    if (!("emissive" in (lamp.material || {}))) {
      lamp.material = new THREE.MeshStandardMaterial({
        color:
          lamp.material && lamp.material.color
            ? lamp.material.color.clone()
            : new THREE.Color("#9a9a9a"),
        metalness: 0.1,
        roughness: 0.6,
      });
    }
    // make material unique
    if (!lamp.userData._matIsUnique) {
      if (Array.isArray(lamp.material))
        lamp.material = lamp.material.map((m) => m.clone());
      else lamp.material = lamp.material.clone();
      lamp.userData._matIsUnique = true;
    }
    // enlarge hit
    if (lamp.geometry) {
      if (lamp.geometry.boundingSphere === null)
        lamp.geometry.computeBoundingSphere();
      if (!lamp.geometry.userData) lamp.geometry.userData = {};
      if (!lamp.geometry.userData._inflatedHit) {
        if (lamp.geometry.boundingSphere)
          lamp.geometry.boundingSphere.radius *= 1.7;
        lamp.geometry.userData._inflatedHit = true;
      }
    }

    setSwitchOn(lamp, false);
    switches.set(idx, { mesh: lamp, on: false });
  });

  renderer.domElement.addEventListener("mousemove", onHoverSwitch);
  renderer.domElement.addEventListener("mousedown", onClickSwitch);
}

/* ========= Animate ========= */
const clock = new THREE.Clock();
let targetY = camera.position.y;

function animate() {
  const dt = Math.min(clock.getDelta(), MAX_DT);

  if (isPlaying) {
    const speed = MOVE_SPEED * (isRunning ? RUN_MULTIPLIER : 1);

    let ix = 0,
      iz = 0;
    if (moveF) iz += 1;
    if (moveB) iz -= 1;
    if (moveL) ix -= 1;
    if (moveR) ix += 1;

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() > 0) forward.normalize();

    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(forward, up).normalize();

    if (ix !== 0 || iz !== 0) {
      const desired = new THREE.Vector3()
        .addScaledVector(right, ix)
        .addScaledVector(forward, iz);
      desired.normalize().multiplyScalar(speed * dt);

      const start = camera.position.clone();

      const tryMove = (x, z) => {
        const h = hitXZ(x, z);
        if (h) camera.position.set(x, camera.position.y, z);
        return h;
      };

      const appliedHit =
        tryMove(start.x + desired.x, start.z + desired.z) ||
        tryMove(start.x + desired.x, start.z) ||
        tryMove(start.x, start.z + desired.z) ||
        null;

      const groundHit =
        appliedHit || hitXZ(camera.position.x, camera.position.z);
      if (groundHit) targetY = groundHit.y + EYE_HEIGHT;
    } else {
      const groundHit = hitXZ(camera.position.x, camera.position.z);
      if (groundHit) targetY = groundHit.y + EYE_HEIGHT;
    }

    camera.position.y += (targetY - camera.position.y) * 0.18;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

/* ========= Resize ========= */
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ========= tiny helper ========= */
function el(html) {
  const d = document.createElement("div");
  d.innerHTML = html.trim();
  return d.firstChild;
}
