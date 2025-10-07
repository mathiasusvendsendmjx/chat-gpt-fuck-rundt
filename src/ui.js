// ui.js
import { el } from "./utils.js";

export function buildUI() {
  // Start
  const start = el(`<div class="overlay show" id="start"><div class="modal">
    <div style="font-size:18px;margin-bottom:10px">Ready?</div>
    <button id="btnStart" class="btn">Start</button>
  </div></div>`);
  document.body.appendChild(start);

  // Loading
  const loading = el(`<div class="overlay" id="loading"><div class="modal">
    <div style="font-size:14px;opacity:.9;margin-bottom:8px">Loading…</div>
    <div style="width:320px;max-width:60vw;height:8px;background:#333;border-radius:999px;overflow:hidden">
      <div id="bar" style="height:100%;width:0%;background:#4ade80;transition:width .15s ease"></div>
    </div>
  </div></div>`);
  document.body.appendChild(loading);

  // Controls
  const controls = el(`<div class="overlay" id="controls"><div class="modal">
    <h2 style="margin:0 0 10px;font-size:20px">How to play</h2>
    <ul style="margin:0 0 18px 18px;line-height:1.6;font-size:14px;opacity:.95;text-align:left">
      <li>W / A / S / D — move</li>
      <li>Mouse — look</li>
      <li>Shift — run</li>
      <li>Click crystals to toggle</li>
    </ul>
    <button id="btnContinue" class="btn">Continue</button>
  </div></div>`);
  document.body.appendChild(controls);

  // Resume
  const resume = el(`<div class="overlay" id="resume"><div class="modal">
    <div style="font-size:18px;margin-bottom:8px">Paused</div>
    <div style="opacity:.9;margin-bottom:14px;font-size:14px">Click to resume and recapture the mouse (Pointer Lock).</div>
    <button id="btnResume" class="btn">Resume</button>
  </div></div>`);
  document.body.appendChild(resume);

  const map = { start, loading, controls, resume };

  return {
    start,
    loading,
    controls,
    resume,
    bar: loading.querySelector("#bar"),
    btnStart: start.querySelector("#btnStart"),
    btnContinue: controls.querySelector("#btnContinue"),
    btnResume: resume.querySelector("#btnResume"),
    showOnly(name) {
      Object.values(map).forEach((node) => node.classList.remove("show"));
      if (name && map[name]) map[name].classList.add("show");
    },
    hideResume() {
      resume.classList.remove("show");
    },
  };
}
