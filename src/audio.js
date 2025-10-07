// src/audio.js
// Solo-mixer: all tracks run in sync; only one is audible.
// Switching is instant-ish via tiny ramp to avoid clicks.
export function createAudioMixer({
  urls,
  fade = 0, // 0 = instant; we still apply 'snap' to avoid clicks
  snap = 0.008, // 8ms ramp
  loop = true,
  initialLevel = 1,
} = {}) {
  let ctx, master;
  let tracks = []; // [{ src, gain }]
  let currentLevel = 0;
  let started = false;

  async function init() {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    // user gesture-safe: we're calling init() inside the Start button handler
    if (ctx.state === "suspended") await ctx.resume();

    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);

    // decode all
    const buffers = await Promise.all(
      urls.map(async (u) => {
        const res = await fetch(u);
        if (!res.ok) throw new Error(`Audio load failed: ${u} (${res.status})`);
        const ab = await res.arrayBuffer();
        return await ctx.decodeAudioData(ab);
      })
    );

    // start all together (muted)
    const t0 = ctx.currentTime + 0.05;
    tracks = buffers.map((buf) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = loop;

      const g = ctx.createGain();
      g.gain.value = 0;

      src.connect(g).connect(master);
      src.start(t0);
      return { src, gain: g };
    });

    started = true;

    // Make track 1 audible immediately
    setLevel(initialLevel, 0); // no fade, only 'snap'
  }

  function setLevel(level, fadeOverride) {
    if (!started) return;
    const target = Math.max(1, Math.min(urls.length, level | 0));
    if (target === currentLevel) return;

    const now = ctx.currentTime;
    const dur = Math.max((fadeOverride ?? fade) || 0, snap);

    tracks.forEach((t, i) => {
      const g = t.gain.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(i === target - 1 ? 1 : 0, now + dur);
    });

    currentLevel = target;
  }

  const getLevel = () => currentLevel;
  const context = () => ctx;
  function dispose() {
    try {
      tracks.forEach((t) => t.src.stop());
    } catch {}
    tracks = [];
    if (ctx && ctx.state !== "closed") ctx.close();
  }

  return { init, setLevel, getLevel, context, dispose };
}
