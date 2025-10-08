// src/ui.js
export function buildUI() {
  // root + theme classes (amber CRT look)
  const root = document.createElement("div");
  root.id = "ui-root";
  root.classList.add("crt-theme", "crt-green");
  document.body.appendChild(root);

  /* ---------- TITLE ---------- */
  const title = div("ui-overlay ui-title-screen");
  title.innerHTML = `
    <div class="ui-card hero term" data-term-title="*** (^:<>:^) ***">
      <h1 class="ui-hero-title bloom-text">HESKUF</h1>
      <p class="ui-hero-sub bloom-text">Indsæt tekst</p>
      <button class="ui-button" id="btn-start-title">Start</button>
    </div>
  `;
  const btnStartTitle = title.querySelector("#btn-start-title");

  /* ---------- INTRO (one line at a time: EN over Alien) ---------- */
  const intro = div("ui-overlay ui-intro");
  intro.innerHTML = `
    <div class="ui-card term" data-term-title="SYSTEM MESSAGE">
      <h1 class="ui-title bloom-text">Tekst</h1>
      <div id="intro-typed" class="tw-block"></div>
      <button class="ui-button" id="btn-intro-next" disabled>Continue</button>
    </div>
  `;
  const btnIntroNext = intro.querySelector("#btn-intro-next");
  const introHost = intro.querySelector("#intro-typed");

  // Intro copy (edit freely). Right now EN/Alien are the same strings.
  let introPairs = [
    ["Indsæt tekst", "Indsæt tekst"],
  ];

  // Guards to prevent double-start
  let introStarted = false; // has typing begun
  let typingActive = false; // is typing currently running

  async function playIntroTypewriter(
    cps = 28, // chars/sec
    lineGapMs = 550, // pause after each EN+Alien pair
    alienHeadStartMs = 60,
    pairs = introPairs
  ) {
    if (introStarted || typingActive) return; // <-- hard guard
    introStarted = true;
    typingActive = true;

    btnIntroNext.disabled = true;
    await typewriteLines(introHost, pairs, {
      cps,
      lineGapMs,
      alienHeadStartMs,
    });
    btnIntroNext.disabled = false;

    typingActive = false;
  }

  function setIntroPairs(pairs) {
    if (Array.isArray(pairs)) introPairs = pairs;
  }

  /* ---------- LOADING ---------- */
  const loading = div("ui-overlay ui-loading");
  loading.innerHTML = `
    <div class="ui-card small term" data-term-title="LOADING">
      <div class="ui-loading-title bloom-text">Loading…</div>
      <div class="ui-progress"><div class="ui-progress-bar" id="ui-bar"></div></div>
    </div>
  `;
  const bar = loading.querySelector("#ui-bar");

  /* ---------- CONTROLS ---------- */
  const controls = div("ui-overlay ui-controls");
  controls.innerHTML = `
    <div class="ui-card small term" data-term-title="REGISTER CONTROL">
      <h2 class="bloom-text">Controls</h2>

      <div class="controls-visual">
        <svg class="wasd" viewBox="0 0 220 120" aria-label="WASD keys">
          <g class="key" id="key-w" transform="translate(85,10)">
            <rect class="key-bg" width="50" height="50" rx="10"/>
            <text x="25" y="32" class="key-label">W</text>
          </g>
          <g class="key" id="key-a" transform="translate(30,65)">
            <rect class="key-bg" width="50" height="50" rx="10"/>
            <text x="25" y="32" class="key-label">A</text>
          </g>
          <g class="key" id="key-s" transform="translate(85,65)">
            <rect class="key-bg" width="50" height="50" rx="10"/>
            <text x="25" y="32" class="key-label">S</text>
          </g>
          <g class="key" id="key-d" transform="translate(140,65)">
            <rect class="key-bg" width="50" height="50" rx="10"/>
            <text x="25" y="32" class="key-label">D</text>
          </g>
        </svg>

        <svg class="mouse" viewBox="0 0 120 140" aria-label="Mouse">
          <g class="mouse-body">
            <path d="M60 10 c25 0 45 20 45 45 v35 c0 22 -20 40 -45 40 s-45 -18 -45 -40 v-35 c0 -25 20 -45 45 -45 z"/>
            <line x1="60" y1="15" x2="60" y2="70" class="mouse-split"/>
            <rect x="56" y="40" width="8" height="16" rx="3" class="mouse-wheel"/>
          </g>
          <text x="60" y="130" class="mouse-label"
        </svg>
      </div>

      <ul class="ui-list">
        <li><strong>WASD</strong> — Move</li>
        <li><strong>Mouse</strong> — Look &amp; Click to interact</li>
        <li><strong>Shift</strong> — Run</li>
      </ul>

      <button class="ui-button" id="btn-continue">Continue</button>
    </div>
  `;
  const btnContinue = controls.querySelector("#btn-continue");

  /* ---------- RESUME (black bg set in CSS) ---------- */
  const resume = div("ui-overlay ui-resume");
  resume.innerHTML = `
    <div class="ui-card small term" data-term-title="PAUSED">
      <div class="ui-loading-title bloom-text">Paused</div>
      <p class="bloom-text">Click to resume and recapture the mouse (Pointer Lock).</p>
      <button class="ui-button" id="btn-resume">Resume</button>
    </div>
  `;
  const btnResume = resume.querySelector("#btn-resume");

  // mount
  root.append(title, intro, loading, controls, resume);

  /* ---------- screen switching ---------- */
  const screens = { title, intro, loading, controls, resume };
  function showOnly(name) {
    const hideAll = name === null;
    for (const key in screens) {
      screens[key].style.display = hideAll
        ? "none"
        : key === name
        ? "flex"
        : "none";
    }
    // Start typing the first time Intro is shown (guarded)
    if (name === "intro") playIntroTypewriter();
  }

  return {
    root,
    // overlays
    title,
    intro,
    loading,
    controls,
    resume,
    // buttons
    btnStartTitle,
    btnIntroNext,
    btnContinue,
    btnResume,
    // loading bar
    bar,
    // helpers
    showOnly,
    playIntroTypewriter,
    setIntroPairs,
  };
}

/* ===================== helpers ===================== */
function div(cls) {
  const d = document.createElement("div");
  d.className = cls;
  return d;
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Typewriter that writes ONE pair at a time (English on top, Alien beneath).
 * pairs = [ [english, alien], ... ]
 */
async function typewriteLines(
  host,
  pairs,
  { cps = 28, lineGapMs = 550, alienHeadStartMs = 60 } = {}
) {
  host.innerHTML = "";
  const charDelay = 1000 / Math.max(1, cps);

  for (const [enText, alText] of pairs) {
    const row = document.createElement("div");
    row.className = "tw-line";

    const enEl = document.createElement("div");
    enEl.className = "tw-en bloom-text";

    const alEl = document.createElement("div");
    alEl.className = "tw-alien bloom-text";

    row.append(enEl, alEl);
    host.appendChild(row);

    const enP = typeText(enEl, enText, charDelay);
    await sleep(alienHeadStartMs);
    const alP = typeText(alEl, alText, charDelay);

    await Promise.all([enP, alP]);
    await sleep(lineGapMs);
  }
}

function typeText(el, text, delay) {
  return new Promise((resolve) => {
    let i = 0;
    (function step() {
      if (i < text.length) {
        el.textContent += text[i++];
        setTimeout(step, delay);
      } else resolve();
    })();
  });
}
