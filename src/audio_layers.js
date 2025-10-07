// src/audio_layers.js
// Background + N layers. All sources run in sync; we mute/unmute layers.
// Background unmutes at init (you call init inside Start click).
export function createLayerMixer({
  backgroundUrl, // "/audio/background.wav"
  layerUrls = [], // ["/audio/layer1.wav", ...]
  snap = 0.008, // tiny ramp to avoid clicks
  loop = true,
} = {}) {
  let ctx, master;
  let bg = null; // { src, gain }
  let layers = []; // [{ src, gain }]
  let started = false;

  async function init() {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") await ctx.resume();

    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);

    async function loadBuffer(url) {
      console.log("[Audio] loading:", url);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Audio load failed: ${url} (${res.status})`);
      const ab = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(ab);
      console.log("[Audio] decoded:", url);
      return buf;
    }

    const [bgBuf, ...layerBufs] = await Promise.all([
      loadBuffer(backgroundUrl),
      ...layerUrls.map(loadBuffer),
    ]);

    const t0 = ctx.currentTime + 0.05;

    // background starts audible (we're calling init from Start click)
    {
      const src = ctx.createBufferSource();
      src.buffer = bgBuf;
      src.loop = loop;
      const g = ctx.createGain();
      g.gain.value = 1; // unmuted
      src.connect(g).connect(master);
      src.start(t0);
      bg = { src, gain: g };
      console.log("[Audio] background started @", t0.toFixed(3));
    }

    // layers start muted
    layers = layerBufs.map((buf, i) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = loop;
      const g = ctx.createGain();
      g.gain.value = 0; // muted initially
      src.connect(g).connect(master);
      src.start(t0);
      console.log(`[Audio] layer${i + 1} started @`, t0.toFixed(3));
      return { src, gain: g };
    });

    started = true;
    console.log("[Audio] mixer ready");
  }

  // Turn a single layer on/off (we'll only ever turn ON from your switches)
  function setLayerOn(index, on, time = snap) {
    if (!started || !layers[index]) return;
    const now = ctx.currentTime;
    const g = layers[index].gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(on ? 1 : 0, now + Math.max(time, snap));
    console.log(`[Audio] layer${index + 1} ->`, on ? "UNMUTE" : "mute");
  }

  // Optional: master mute (not used unless you want a pause feel)
  function setMasterMuted(muted, time = 0.02) {
    if (!started) return;
    const now = ctx.currentTime;
    const g = master.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(muted ? 0 : 1, now + Math.max(time, snap));
  }

  const context = () => ctx;
  function dispose() {
    try {
      bg?.src.stop();
    } catch {}
    try {
      layers.forEach((L) => L.src.stop());
    } catch {}
    bg = null;
    layers = [];
    if (ctx && ctx.state !== "closed") ctx.close();
  }

  return { init, setLayerOn, setMasterMuted, context };
}
