export function buildUI() {
  // root + theme classes
  const root = document.createElement("div");
  root.id = "ui-root";
  root.classList.add("crt-theme", "crt-green");
  document.body.appendChild(root);

  /* ---------- TITLE (HESKUF only) ---------- */
  const title = div("ui-overlay ui-title-screen");
  title.innerHTML = `
    <div class="ui-card hero term" data-term-title="System Boot">
      <h1 class="ui-hero-title tw-en"    id="title-hero-en"></h1>
      <h1 class="ui-hero-title tw-alien" id="title-hero-alien" aria-hidden="true"></h1>
      <button class="ui-button" id="btn-start-title">Continue</button>
    </div>
  `;
  const btnStartTitle = title.querySelector("#btn-start-title");
  const elTitleHeroEn = title.querySelector("#title-hero-en");
  const elTitleHeroAl = title.querySelector("#title-hero-alien");

  const TITLE_HERO_EN = "HESKUF";
  const TITLE_HERO_AL = "HESKUF";

  let titleTyped = false;
  async function playTitleTypewriter({ cps = 28 } = {}) {
    if (titleTyped) return;
    titleTyped = true;
    btnStartTitle.disabled = true;

    elTitleHeroEn.textContent = "";
    elTitleHeroAl.textContent = "";

    const d = 1000 / Math.max(1, cps);
    // Type EN and Alien simultaneously
    await Promise.all([
      typeText(elTitleHeroEn, TITLE_HERO_EN, d),
      typeText(elTitleHeroAl, TITLE_HERO_AL, d),
    ]);

    btnStartTitle.disabled = false;
  }

  /* ---------- PROLOGUE (“Millions of years ago…”) ---------- */
  const prologue = div("ui-overlay ui-prologue");
  prologue.innerHTML = `
    <div class="ui-card term" data-term-title="PROLOGUE">
      <div id="prologue-typed" class="tw-block"></div>
      <button class="ui-button" id="btn-prologue-next" disabled>Continue</button>
    </div>
  `;
  const prologueHost = prologue.querySelector("#prologue-typed");
  const btnPrologueNext = prologue.querySelector("#btn-prologue-next");

  // One pair (EN + Alien) here, typed simultaneously
  const PROLOGUE_PAIRS = [
    [
      "Millions of years after humans fell, Nature and Technology found a way to coexist, forming a new world.",
      "Millions of years after humans fell, Nature and Technology found a way to coexist, forming a new world.",
    ],
  ];

  let prologueTyped = false;
  async function playPrologueTypewriter(
    cps = 28,
    lineGapMs = 450,
    parallel = true // simultaneous EN + Alien
  ) {
    if (prologueTyped) return;
    prologueTyped = true;
    btnPrologueNext.disabled = true;
    await typewriteLines(prologueHost, PROLOGUE_PAIRS, {
      cps,
      lineGapMs,
      parallel,
    });
    btnPrologueNext.disabled = false;
  }

  /* ---------- INTRO (System Message) ---------- */
  const intro = div("ui-overlay ui-intro");
  intro.innerHTML = `
    <div class="ui-card term" data-term-title="SYSTEM MESSAGE">
      <h1 class="ui-title bloom-text">LIFE WITH NO MUSIC. IS NO LIFE AT ALL.</h1>
      <div id="intro-typed" class="tw-block"></div>
      <button class="ui-button" id="btn-intro-next" disabled>Continue</button>
    </div>
  `;
  const btnIntroNext = intro.querySelector("#btn-intro-next");
  const introHost = intro.querySelector("#intro-typed");

  // Intro copy: lines type one after another; EN+Alien simultaneously per line
  let introPairs = [
    [
      "Power went out. The roots lost their connection.",
      "Power went out. The roots lost their connection.",
    ],
    [
      "Mother need all four power sources to wake up.",
      "Mother need all four power sources to wake up.",
    ],
    [
      "Find and turn on her crystals to hear her sing.",
      "Find and turn on her crystals to hear her sing.",
    ],
  ];

  let introStarted = false;
  let typingActive = false;
  async function playIntroTypewriter(
    cps = 28,
    lineGapMs = 550,
    parallel = true // ⬅ EN+Alien simultaneous for each line
  ) {
    if (introStarted || typingActive) return;
    introStarted = true;
    typingActive = true;

    btnIntroNext.disabled = true;
    await typewriteLines(introHost, introPairs, { cps, lineGapMs, parallel });
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
          <text x="60" y="130" class="mouse-label"></text>
        </svg>
      </div>
      <ul class="ui-list">
        <li><strong>WASD</strong> — Move</li>
        <li><strong>Mouse</strong> — Look &amp; Click to interact</li>
        <li><strong>Shift</strong> — Run</li>
        <li><strong>Esc</strong> — Leave game</li>
      </ul>
      <button class="ui-button" id="btn-continue">Continue</button>
    </div>
  `;
  const btnContinue = controls.querySelector("#btn-continue");

  /* ---------- RESUME ---------- */
  const resume = div("ui-overlay ui-resume");
  resume.innerHTML = `
    <div class="ui-card small term" data-term-title="PAUSED">
      <div class="ui-loading-title bloom-text">Paused</div>
      <p class="bloom-text">Click to resume</p>
      <button class="ui-button" id="btn-resume">Resume</button>
    </div>
  `;
  const btnResume = resume.querySelector("#btn-resume");

  // mount
  root.append(title, prologue, intro, loading, controls, resume);

  /* ---------- screen switching (no auto-typing) ---------- */
  const screens = { title, prologue, intro, loading, controls, resume };
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

  return {
    root,
    // overlays
    title,
    prologue,
    intro,
    loading,
    controls,
    resume,
    // buttons
    btnStartTitle,
    btnPrologueNext,
    btnIntroNext,
    btnContinue,
    btnResume,
    // loading bar
    bar,
    // helpers
    showOnly,
    playTitleTypewriter,
    playPrologueTypewriter,
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
 * Write a list of [EN, AL] pairs to a host.
 * If parallel=true, EN and AL type simultaneously; otherwise serial (EN then AL).
 */
async function typewriteLines(
  host,
  pairs,
  { cps = 28, lineGapMs = 550, parallel = false } = {}
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

    if (parallel) {
      await Promise.all([
        typeText(enEl, enText, charDelay),
        typeText(alEl, alText, charDelay),
      ]);
    } else {
      await typeText(enEl, enText, charDelay);
      await typeText(alEl, alText, charDelay);
    }

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
