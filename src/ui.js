// src/ui.js
export function buildUI() {
  // root
  const root = document.createElement("div");
  root.id = "ui-root";
  document.body.appendChild(root);

  /* -------------------- START ("Ready") -------------------- */
  const start = div("ui-overlay ui-start");
  start.innerHTML = `
    <div class="ui-card">
      <h1 class="ui-title">HESKUF</h1>

      <div class="ui-split">
        <div class="ui-col ui-col-left">
          <p class="ui-type" id="type-left"></p>
        </div>
        <div class="ui-divider"></div>
        <div class="ui-col ui-col-right">
          <p class="ui-type ui-type-alien" id="type-right"></p>
        </div>
      </div>

      <button class="ui-button" id="btn-start">Start</button>
    </div>
  `;
  const btnStart = start.querySelector("#btn-start");

  /* -------------------- LOADING -------------------- */
  const loading = div("ui-overlay ui-loading");
  loading.innerHTML = `
    <div class="ui-card small">
      <div class="ui-loading-title">Loading…</div>
      <div class="ui-progress"><div class="ui-progress-bar" id="ui-bar"></div></div>
    </div>
  `;
  const bar = loading.querySelector("#ui-bar");

  /* -------------------- CONTROLS -------------------- */
  const controls = div("ui-overlay ui-controls");
  controls.innerHTML = `
    <div class="ui-card small">
      <h2>Controls</h2>
      <ul class="ui-list">
        <li>WASD to move</li>
        <li>Mouse to look</li>
        <li>Click to interact</li>
      </ul>
      <button class="ui-button" id="btn-continue">Continue</button>
    </div>
  `;
  const btnContinue = controls.querySelector("#btn-continue");

  /* -------------------- RESUME -------------------- */
  const resume = div("ui-overlay ui-resume");
  resume.innerHTML = `
    <div class="ui-card small">
      <div class="ui-loading-title">Paused</div>
      <p>Click to resume and recapture the mouse (Pointer Lock).</p>
      <button class="ui-button" id="btn-resume">Resume</button>
    </div>
  `;
  const btnResume = resume.querySelector("#btn-resume");

  // mount to root
  root.append(start, loading, controls, resume);

  /* -------------------- SHOW/HIDE API -------------------- */
  const screens = { start, loading, controls, resume };
function showOnly(name) {
  const hideAll = name === null;
  for (const key in screens) {
    screens[key].style.display = hideAll
      ? "none"
      : key === name
      ? "flex"
      : "none";
  }
}

  /* -------------------- TYPEWRITER -------------------- */
  const leftEl = start.querySelector("#type-left");
  const rightEl = start.querySelector("#type-right");

  // 👇 Put your own text here (same content both sides; right uses your alien font)
  const english = `INDSÆT TEKST HER`;
  const alien = english; // same string, but it will render with your custom font

  typewriteDual(leftEl, english, rightEl, alien, 18);

  /* -------------------- RETURN PUBLIC API -------------------- */
  return {
    root,
    // overlays
    start,
    loading,
    controls,
    resume,
    // buttons + loading bar
    btnStart,
    btnContinue,
    btnResume,
    bar,
    // helper
    showOnly,
  };
}

/* ===================== helpers ===================== */
function div(cls) {
  const d = document.createElement("div");
  d.className = cls;
  return d;
}

function typewriteDual(leftEl, leftText, rightEl, rightText, cps = 16) {
  // cps = characters per second
  const delay = 1000 / Math.max(1, cps);
  let i = 0,
    j = 0;
  leftEl.textContent = "";
  rightEl.textContent = "";

  const step = () => {
    let did = false;
    if (i < leftText.length) {
      leftEl.textContent += leftText[i++];
      did = true;
    }
    if (j < rightText.length) {
      rightEl.textContent += rightText[j++];
      did = true;
    }
    if (did) {
      setTimeout(step, delay);
    }
  };
  step();
}
