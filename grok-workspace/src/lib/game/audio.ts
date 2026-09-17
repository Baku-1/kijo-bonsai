let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfx: GainNode | null = null;
let music: GainNode | null = null;
let ambient: { stop: () => void } | null = null;
let muted = false;

function ac() {
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: "interactive" });
    master = ctx.createGain();
    sfx = ctx.createGain();
    music = ctx.createGain();
    sfx.gain.value = 0.7;
    music.gain.value = 0.22;
    sfx.connect(master);
    music.connect(master);
    master.connect(ctx.destination);
  }
  return ctx;
}

export function unlockAudio() {
  const c = ac();
  if (c.state === "suspended") void c.resume();
  if (!ambient) ambient = startAmbient();
}

export function setMuted(v: boolean) {
  muted = v;
  if (master && ctx) {
    master.gain.setTargetAtTime(v ? 0 : 1, ctx.currentTime, 0.04);
  }
}

export function isMuted() {
  return muted;
}

function envGain(peak: number, a: number, r: number) {
  const c = ac();
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(peak, c.currentTime + a);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + a + r);
  return g;
}

export function playWater() {
  const c = ac();
  if (!sfx) return;
  const bufferSize = 2 * c.sampleRate;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1400;
  filter.Q.value = 0.7;
  const g = envGain(0.45, 0.04, 0.55);
  src.connect(filter);
  filter.connect(g);
  g.connect(sfx);
  src.start();
  src.stop(c.currentTime + 0.7);
}

export function playSnip() {
  const c = ac();
  if (!sfx) return;
  const osc = c.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(1400, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(180, c.currentTime + 0.09);
  const g = envGain(0.35, 0.005, 0.12);
  osc.connect(g);
  g.connect(sfx);
  osc.start();
  osc.stop(c.currentTime + 0.14);
}

export function playBell() {
  const c = ac();
  if (!sfx) return;
  const freqs = [392, 494, 587];
  for (const f of freqs) {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f * (0.98 + Math.random() * 0.04);
    const g = envGain(0.12, 0.01, 0.9);
    osc.connect(g);
    g.connect(sfx);
    osc.start();
    osc.stop(c.currentTime + 1);
  }
}

function startAmbient() {
  const c = ac();
  if (!music) return { stop() {} };
  const buffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 480;
  const g = c.createGain();
  g.gain.value = 0.18;
  src.connect(filter);
  filter.connect(g);
  g.connect(music);
  src.start();

  const pad = c.createOscillator();
  pad.type = "sine";
  pad.frequency.value = 110;
  const pg = c.createGain();
  pg.gain.value = 0.04;
  pad.connect(pg);
  pg.connect(music);
  pad.start();

  return {
    stop() {
      src.stop();
      pad.stop();
    },
  };
}

export function resumeIfNeeded() {
  if (ctx && ctx.state === "suspended") void ctx.resume();
}
