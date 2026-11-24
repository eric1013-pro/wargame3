/**
 * Studio-Grade Multi-Layer Military Acoustic Foley & Ballistics Bank Generator.
 * Pre-renders 24 real 44.1kHz 16-bit PCM Stereo/Mono .wav files into
 * wargame3/src/assets/audio/sfx/ using physical ballistic acoustics, multi-tap
 * outdoor/indoor impulse reflections, modal steel resonance, granular glass/puddle
 * footstep physics, helicopter rotor aerodynamics, and stereo Doppler fighter jet flyby.
 *
 * Run via: .\node_modules\.bin\tsx.cmd scripts\generateMilitaryAudioBank.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 44100;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(SCRIPT_DIR, '../src/assets/audio/sfx');

// Deterministic PRNG for repeatable studio-mastered assets
let seed = 20991124;
function rand(): number {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
function randSigned(): number {
  return rand() * 2 - 1;
}

class Biquad {
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  public setLowpass(fc: number, q = 0.707): void {
    const w0 = (2 * Math.PI * Math.max(20, Math.min(SR * 0.45, fc))) / SR;
    const cos = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * q);
    const a0 = 1 + alpha;
    this.b0 = ((1 - cos) / 2) / a0;
    this.b1 = (1 - cos) / a0;
    this.b2 = ((1 - cos) / 2) / a0;
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  public setHighpass(fc: number, q = 0.707): void {
    const w0 = (2 * Math.PI * Math.max(20, Math.min(SR * 0.45, fc))) / SR;
    const cos = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * q);
    const a0 = 1 + alpha;
    this.b0 = ((1 + cos) / 2) / a0;
    this.b1 = -(1 + cos) / a0;
    this.b2 = ((1 + cos) / 2) / a0;
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  public setBandpass(fc: number, q = 1.2): void {
    const w0 = (2 * Math.PI * Math.max(20, Math.min(SR * 0.45, fc))) / SR;
    const cos = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * q);
    const a0 = 1 + alpha;
    this.b0 = alpha / a0;
    this.b1 = 0;
    this.b2 = -alpha / a0;
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  public step(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

function softClip(x: number, drive = 1.6): number {
  return Math.tanh(x * drive) / Math.tanh(drive);
}

function normalize(ch: Float32Array[], peakTarget = 0.92): void {
  let maxAbs = 0.0001;
  for (const c of ch) {
    for (let i = 0; i < c.length; i++) {
      const a = Math.abs(c[i]);
      if (a > maxAbs) maxAbs = a;
    }
  }
  const gain = peakTarget / maxAbs;
  for (const c of ch) {
    for (let i = 0; i < c.length; i++) {
      c[i] = Math.max(-0.99, Math.min(0.99, c[i] * gain));
    }
  }
}

function writeWav(filename: string, channels: Float32Array[]): number {
  const numCh = channels.length;
  const numFrames = channels[0].length;
  const dataSize = numFrames * numCh * 2;
  const buf = Buffer.alloc(44 + dataSize);

  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // PCM chunk size
  buf.writeUInt16LE(1, 20); // PCM format
  buf.writeUInt16LE(numCh, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * numCh * 2, 28);
  buf.writeUInt16LE(numCh * 2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  let off = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      buf.writeInt16LE(Math.round(s * 32767), off);
      off += 2;
    }
  }

  const outPath = path.join(OUT_DIR, filename);
  fs.writeFileSync(outPath, buf);
  return buf.byteLength;
}

function addModalBurst(
  out: Float32Array,
  startSec: number,
  modes: Array<{ freq: number; amp: number; decay: number }>,
  noiseAmp = 0.25,
  noiseDecay = 0.018
): void {
  const startIdx = Math.floor(startSec * SR);
  const bp = new Biquad();
  bp.setBandpass(modes[0]?.freq ?? 2200, 1.5);
  const maxDur = Math.max(...modes.map((m) => m.decay * 5), noiseDecay * 5);
  const len = Math.min(out.length - startIdx, Math.floor(maxDur * SR));
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    let v = 0;
    for (const m of modes) {
      v += Math.sin(2 * Math.PI * m.freq * t) * m.amp * Math.exp(-t / m.decay);
    }
    if (noiseAmp > 0) {
      v += bp.step(randSigned()) * noiseAmp * Math.exp(-t / noiseDecay);
    }
    out[startIdx + i] += v;
  }
}

function renderMultiTapTail(
  durSec: number,
  taps: Array<{ delaySec: number; gainL: number; gainR: number; lpHz: number; decay: number }>,
  baseBurstMs = 28
): [Float32Array, Float32Array] {
  const n = Math.floor(durSec * SR);
  const L = new Float32Array(n);
  const R = new Float32Array(n);

  // Create raw explosive impulse burst
  const burstLen = Math.floor((baseBurstMs / 1000) * SR);
  const burst = new Float32Array(burstLen);
  for (let i = 0; i < burstLen; i++) {
    const t = i / SR;
    burst[i] = randSigned() * Math.exp(-t / (baseBurstMs * 0.00045));
  }

  for (const tap of taps) {
    const lpL = new Biquad();
    const lpR = new Biquad();
    const hp = new Biquad();
    lpL.setLowpass(tap.lpHz, 0.72);
    lpR.setLowpass(tap.lpHz * 0.94, 0.72);
    hp.setHighpass(95, 0.7);
    const dIdx = Math.floor(tap.delaySec * SR);
    const tailLen = Math.min(n - dIdx, Math.floor(tap.decay * 5.2 * SR));
    for (let i = 0; i < tailLen; i++) {
      const t = i / SR;
      const env = Math.exp(-t / tap.decay);
      const exc = (i < burstLen ? burst[i] * 1.4 : 0) + randSigned() * 0.42 * env;
      const shaped = hp.step(exc);
      L[dIdx + i] += lpL.step(shaped) * tap.gainL * env;
      R[dIdx + i] += lpR.step(shaped + randSigned() * 0.12 * env) * tap.gainR * env;
    }
  }
  return [L, R];
}

// 1) RIFLE: Close Punch + Outdoor Urban Canyon Tail + Indoor Slapback Tail
function buildRifleBank(): Array<[string, Float32Array[]]> {
  // Close 5.56mm punch
  const nP = Math.floor(0.24 * SR);
  const p = new Float32Array(nP);
  const hpCrack = new Biquad();
  hpCrack.setHighpass(1450, 0.8);
  const bpBody = new Biquad();
  bpBody.setBandpass(620, 0.9);
  for (let i = 0; i < nP; i++) {
    const t = i / SR;
    // Supersonic N-wave shock + chest punch + muzzle blast
    const punchFreq = 46 + 165 * Math.exp(-t / 0.016);
    const punch = Math.sin(2 * Math.PI * punchFreq * t) * Math.exp(-t / 0.042) * 1.15;
    const crack = hpCrack.step(randSigned()) * Math.exp(-t / 0.011) * 1.6;
    const body = bpBody.step(randSigned()) * Math.exp(-t / 0.055) * 0.95;
    p[i] = softClip(punch + crack + body, 2.3);
  }
  // Mechanical bolt carrier cycle (+20ms)
  addModalBurst(
    p,
    0.019,
    [
      { freq: 2150, amp: 0.24, decay: 0.014 },
      { freq: 3850, amp: 0.16, decay: 0.01 },
      { freq: 5400, amp: 0.1, decay: 0.008 },
    ],
    0.15,
    0.012
  );
  normalize([p], 0.95);

  // Outdoor distant urban canyon echo
  const [outL, outR] = renderMultiTapTail(
    1.45,
    [
      { delaySec: 0.032, gainL: 0.72, gainR: 0.68, lpHz: 2800, decay: 0.14 },
      { delaySec: 0.095, gainL: 0.56, gainR: 0.64, lpHz: 1950, decay: 0.2 },
      { delaySec: 0.19, gainL: 0.44, gainR: 0.36, lpHz: 1350, decay: 0.26 },
      { delaySec: 0.34, gainL: 0.3, gainR: 0.38, lpHz: 880, decay: 0.32 },
      { delaySec: 0.56, gainL: 0.18, gainR: 0.16, lpHz: 560, decay: 0.38 },
    ],
    26
  );
  normalize([outL, outR], 0.88);

  // Indoor hard concrete/steel slapback echo
  const [inL, inR] = renderMultiTapTail(
    0.82,
    [
      { delaySec: 0.009, gainL: 0.9, gainR: 0.84, lpHz: 4600, decay: 0.06 },
      { delaySec: 0.021, gainL: 0.78, gainR: 0.86, lpHz: 3600, decay: 0.085 },
      { delaySec: 0.039, gainL: 0.65, gainR: 0.58, lpHz: 2700, decay: 0.11 },
      { delaySec: 0.068, gainL: 0.48, gainR: 0.54, lpHz: 1900, decay: 0.14 },
      { delaySec: 0.115, gainL: 0.34, gainR: 0.3, lpHz: 1300, decay: 0.18 },
    ],
    18
  );
  normalize([inL, inR], 0.92);

  return [
    ['rifle_punch.wav', [p]],
    ['rifle_tail_outdoor.wav', [outL, outR]],
    ['rifle_tail_indoor.wav', [inL, inR]],
  ];
}

// 2) SHOTGUN: Heavy 12-Gauge Boom + Outdoor/Indoor Tails
function buildShotgunBank(): Array<[string, Float32Array[]]> {
  const nP = Math.floor(0.42 * SR);
  const p = new Float32Array(nP);
  const lp = new Biquad();
  lp.setLowpass(1650, 0.85);
  const hp = new Biquad();
  hp.setHighpass(2200, 0.7);
  for (let i = 0; i < nP; i++) {
    const t = i / SR;
    const subFreq = 28 + 118 * Math.exp(-t / 0.032);
    const sub = Math.sin(2 * Math.PI * subFreq * t) * Math.exp(-t / 0.095) * 1.5;
    const roar = lp.step(randSigned()) * Math.exp(-t / 0.088) * 1.45;
    const snap = hp.step(randSigned()) * Math.exp(-t / 0.014) * 1.1;
    p[i] = softClip(sub + roar + snap, 2.5);
  }
  // Pump/breech clack tail
  addModalBurst(
    p,
    0.22,
    [
      { freq: 920, amp: 0.25, decay: 0.025 },
      { freq: 2450, amp: 0.2, decay: 0.018 },
    ],
    0.22,
    0.024
  );
  normalize([p], 0.96);

  const [outL, outR] = renderMultiTapTail(
    1.7,
    [
      { delaySec: 0.036, gainL: 0.82, gainR: 0.78, lpHz: 1800, decay: 0.22 },
      { delaySec: 0.12, gainL: 0.64, gainR: 0.7, lpHz: 1150, decay: 0.28 },
      { delaySec: 0.26, gainL: 0.45, gainR: 0.4, lpHz: 720, decay: 0.36 },
      { delaySec: 0.48, gainL: 0.28, gainR: 0.32, lpHz: 440, decay: 0.44 },
    ],
    44
  );
  normalize([outL, outR], 0.9);

  const [inL, inR] = renderMultiTapTail(
    0.95,
    [
      { delaySec: 0.011, gainL: 0.94, gainR: 0.9, lpHz: 3400, decay: 0.09 },
      { delaySec: 0.028, gainL: 0.8, gainR: 0.85, lpHz: 2400, decay: 0.13 },
      { delaySec: 0.056, gainL: 0.6, gainR: 0.56, lpHz: 1550, decay: 0.18 },
      { delaySec: 0.11, gainL: 0.4, gainR: 0.44, lpHz: 960, decay: 0.24 },
    ],
    30
  );
  normalize([inL, inR], 0.92);

  return [
    ['shotgun_punch.wav', [p]],
    ['shotgun_tail_outdoor.wav', [outL, outR]],
    ['shotgun_tail_indoor.wav', [inL, inR]],
  ];
}

// 3) SNIPER / RAILGUN + ROCKET + EXPLOSIONS + AC-130 (25mm/40mm/105mm)
function buildHeavyOrdnanceBank(): Array<[string, Float32Array[]]> {
  // Anti-materiel / Railgun supersonic crack + magnetic whip
  const nS = Math.floor(0.55 * SR);
  const sn = new Float32Array(nS);
  const hp = new Biquad();
  hp.setHighpass(1900, 0.9);
  for (let i = 0; i < nS; i++) {
    const t = i / SR;
    const fSub = 32 + 210 * Math.exp(-t / 0.024);
    const sub = Math.sin(2 * Math.PI * fSub * t) * Math.exp(-t / 0.11) * 1.3;
    const whip = hp.step(randSigned()) * Math.exp(-t / 0.026) * 1.75;
    const rail = Math.sin(2 * Math.PI * (1420 * Math.exp(-t * 4.5) + 180) * t) * Math.exp(-t / 0.14) * 0.55;
    sn[i] = softClip(sub + whip + rail, 2.4);
  }
  normalize([sn], 0.95);

  const [snOutL, snOutR] = renderMultiTapTail(
    2.1,
    [
      { delaySec: 0.04, gainL: 0.85, gainR: 0.8, lpHz: 2600, decay: 0.25 },
      { delaySec: 0.15, gainL: 0.65, gainR: 0.72, lpHz: 1500, decay: 0.35 },
      { delaySec: 0.36, gainL: 0.45, gainR: 0.38, lpHz: 850, decay: 0.48 },
      { delaySec: 0.72, gainL: 0.26, gainR: 0.3, lpHz: 480, decay: 0.58 },
    ],
    35
  );
  normalize([snOutL, snOutR], 0.88);

  // Rocket shoulder launch whoosh
  const nRk = Math.floor(1.15 * SR);
  const rk = new Float32Array(nRk);
  const rkBp = new Biquad();
  for (let i = 0; i < nRk; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.04) * Math.exp(-t / 0.38);
    rkBp.setBandpass(420 + 950 * Math.exp(-t / 0.28), 1.1);
    const thump = Math.sin(2 * Math.PI * (115 * Math.exp(-t / 0.06) + 34) * t) * Math.exp(-t / 0.12) * 0.9;
    rk[i] = softClip(thump + rkBp.step(randSigned()) * env * 1.5, 1.8);
  }
  normalize([rk], 0.94);

  // Close & Distant Explosions (Stereo)
  const nExC = Math.floor(1.85 * SR);
  const exCL = new Float32Array(nExC);
  const exCR = new Float32Array(nExC);
  const exLp = new Biquad();
  exLp.setLowpass(480, 0.75);
  const exMid = new Biquad();
  exMid.setBandpass(1250, 0.85);
  for (let i = 0; i < nExC; i++) {
    const t = i / SR;
    const sub = Math.sin(2 * Math.PI * (22 + 78 * Math.exp(-t / 0.055)) * t) * Math.exp(-t / 0.28) * 1.8;
    const rumble = exLp.step(randSigned()) * Math.exp(-t / 0.48) * 1.7;
    const crack = exMid.step(randSigned()) * Math.exp(-t / 0.085) * 1.2;
    const debris = t > 0.12 && rand() < 0.009 ? randSigned() * Math.exp(-(t - 0.12) / 0.65) * 0.9 : 0;
    exCL[i] = softClip(sub + rumble + crack + debris, 2.2);
    exCR[i] = softClip(sub + rumble * 0.96 + crack * 1.04 - debris * 0.7, 2.2);
  }
  normalize([exCL, exCR], 0.96);

  const [exDL, exDR] = renderMultiTapTail(
    2.25,
    [
      { delaySec: 0.02, gainL: 0.9, gainR: 0.86, lpHz: 520, decay: 0.42 },
      { delaySec: 0.22, gainL: 0.65, gainR: 0.7, lpHz: 340, decay: 0.55 },
      { delaySec: 0.55, gainL: 0.4, gainR: 0.36, lpHz: 240, decay: 0.68 },
    ],
    90
  );
  normalize([exDL, exDR], 0.92);

  // AC-130 25mm GAU-12 / 40mm Bofors / 105mm M102 Howitzer (cabin-muffled military authenticity!)
  const n25 = Math.floor(0.16 * SR);
  const c25 = new Float32Array(n25);
  const bp25 = new Biquad();
  bp25.setBandpass(780, 1.0);
  for (let i = 0; i < n25; i++) {
    const t = i / SR;
    c25[i] = softClip(
      Math.sin(2 * Math.PI * (160 * Math.exp(-t / 0.018) + 48) * t) * Math.exp(-t / 0.032) * 1.1 +
        bp25.step(randSigned()) * Math.exp(-t / 0.028) * 1.0,
      2.0
    );
  }
  normalize([c25], 0.9);

  const n40 = Math.floor(0.48 * SR);
  const c40 = new Float32Array(n40);
  const lp40 = new Biquad();
  lp40.setLowpass(540, 0.85);
  for (let i = 0; i < n40; i++) {
    const t = i / SR;
    // Iconic rhythmic heavy Bofors THUMP
    const thump = Math.sin(2 * Math.PI * (34 + 110 * Math.exp(-t / 0.028)) * t) * Math.exp(-t / 0.095) * 1.45;
    const cabin = lp40.step(randSigned()) * Math.exp(-t / 0.11) * 1.1;
    c40[i] = softClip(thump + cabin, 2.2);
  }
  addModalBurst(c40, 0.06, [{ freq: 620, amp: 0.25, decay: 0.03 }], 0.12, 0.02);
  normalize([c40], 0.95);

  const n105 = Math.floor(1.42 * SR);
  const c105 = new Float32Array(n105);
  const lp105 = new Biquad();
  lp105.setLowpass(320, 0.8);
  for (let i = 0; i < n105; i++) {
    const t = i / SR;
    // Massive cabin-shaking 105mm howitzer firing thump + breech recoil + distant whistle
    const boom = Math.sin(2 * Math.PI * (19 + 84 * Math.exp(-t / 0.05)) * t) * Math.exp(-t / 0.28) * 1.8;
    const cabinAir = lp105.step(randSigned()) * Math.exp(-t / 0.34) * 1.4;
    const whistle =
      t > 0.25
        ? Math.sin(2 * Math.PI * (840 - (t - 0.25) * 420) * t) * Math.exp(-(t - 0.25) / 0.35) * 0.14
        : 0;
    c105[i] = softClip(boom + cabinAir + whistle, 2.1);
  }
  // Empty brass 105mm shell case clanging onto aircraft floor
  addModalBurst(
    c105,
    0.42,
    [
      { freq: 1180, amp: 0.24, decay: 0.075 },
      { freq: 2140, amp: 0.18, decay: 0.055 },
      { freq: 3420, amp: 0.11, decay: 0.04 },
    ],
    0.1,
    0.02
  );
  normalize([c105], 0.96);

  return [
    ['sniper_punch.wav', [sn]],
    ['sniper_tail_outdoor.wav', [snOutL, snOutR]],
    ['rocket_launch.wav', [rk]],
    ['explosion_close.wav', [exCL, exCR]],
    ['explosion_distant.wav', [exDL, exDR]],
    ['ac130_25mm.wav', [c25]],
    ['ac130_40mm.wav', [c40]],
    ['ac130_105mm.wav', [c105]],
  ];
}

// 4) METALLIC RELOAD FOLEY BANK (Mag Out, Mag Lock-In, Bolt Rack, Shotgun Shell)
function buildReloadFoleyBank(): Array<[string, Float32Array[]]> {
  // Mag release click + polymer/steel slide-out
  const magOut = new Float32Array(Math.floor(0.32 * SR));
  addModalBurst(
    magOut,
    0.01,
    [
      { freq: 2950, amp: 0.48, decay: 0.012 },
      { freq: 4850, amp: 0.32, decay: 0.008 },
      { freq: 1180, amp: 0.26, decay: 0.018 },
    ],
    0.35,
    0.014
  );
  const scrapeBp = new Biquad();
  scrapeBp.setBandpass(1850, 2.2);
  for (let i = Math.floor(0.05 * SR); i < Math.floor(0.24 * SR); i++) {
    const t = (i - 0.05 * SR) / SR;
    magOut[i] += scrapeBp.step(randSigned()) * Math.sin((t / 0.19) * Math.PI) * 0.26;
  }
  normalize([magOut], 0.88);

  // Mag insertion guide + heavy positive double-snap lock
  const magIn = new Float32Array(Math.floor(0.36 * SR));
  const slideBp = new Biquad();
  slideBp.setBandpass(1500, 1.8);
  for (let i = Math.floor(0.02 * SR); i < Math.floor(0.14 * SR); i++) {
    const t = (i - 0.02 * SR) / SR;
    magIn[i] += slideBp.step(randSigned()) * Math.sin((t / 0.12) * Math.PI) * 0.22;
  }
  addModalBurst(
    magIn,
    0.14,
    [
      { freq: 720, amp: 0.52, decay: 0.022 },
      { freq: 1840, amp: 0.42, decay: 0.015 },
      { freq: 3920, amp: 0.34, decay: 0.01 },
    ],
    0.38,
    0.016
  );
  addModalBurst(
    magIn,
    0.19,
    [
      { freq: 2680, amp: 0.55, decay: 0.011 },
      { freq: 5120, amp: 0.38, decay: 0.007 },
    ],
    0.25,
    0.01
  );
  normalize([magIn], 0.92);

  // Charging handle spring pull + heavy steel bolt slam home (ka-CHINK!)
  const boltRack = new Float32Array(Math.floor(0.42 * SR));
  addModalBurst(
    boltRack,
    0.015,
    [
      { freq: 1620, amp: 0.38, decay: 0.022 },
      { freq: 3420, amp: 0.34, decay: 0.014 },
      { freq: 5800, amp: 0.22, decay: 0.009 },
    ],
    0.4,
    0.026
  );
  addModalBurst(
    boltRack,
    0.165,
    [
      { freq: 1120, amp: 0.65, decay: 0.028 },
      { freq: 2480, amp: 0.58, decay: 0.02 },
      { freq: 4320, amp: 0.44, decay: 0.013 },
      { freq: 6600, amp: 0.28, decay: 0.008 },
    ],
    0.55,
    0.018
  );
  normalize([boltRack], 0.94);

  // Shotgun brass rim insert + spring click
  const shellLoad = new Float32Array(Math.floor(0.26 * SR));
  addModalBurst(
    shellLoad,
    0.02,
    [
      { freq: 1450, amp: 0.42, decay: 0.016 },
      { freq: 3100, amp: 0.45, decay: 0.012 },
      { freq: 5200, amp: 0.3, decay: 0.008 },
    ],
    0.32,
    0.015
  );
  addModalBurst(
    shellLoad,
    0.09,
    [
      { freq: 2250, amp: 0.52, decay: 0.012 },
      { freq: 4400, amp: 0.35, decay: 0.009 },
    ],
    0.2,
    0.01
  );
  normalize([shellLoad], 0.9);

  return [
    ['reload_mag_out.wav', [magOut]],
    ['reload_mag_in.wav', [magIn]],
    ['reload_bolt_rack.wav', [boltRack]],
    ['reload_shell_load.wav', [shellLoad]],
  ];
}

// 5) SURFACE-AWARE FOOTSTEPS: Wet Asphalt, Hollow Steel Plate, Broken Glass & Rubble (2 variations each!)
function buildFootstepsBank(): Array<[string, Float32Array[]]> {
  const out: Array<[string, Float32Array[]]> = [];

  for (let v = 1; v <= 2; v++) {
    const pitchShift = v === 1 ? 1.0 : 1.09;

    // A) Wet Asphalt (combat boot heel thud + wet rain puddle splash!)
    const asp = new Float32Array(Math.floor(0.24 * SR));
    const lpBoot = new Biquad();
    lpBoot.setLowpass(280 * pitchShift, 0.9);
    const hpSplash = new Biquad();
    hpSplash.setBandpass(4200 * pitchShift, 0.85);
    for (let i = 0; i < asp.length; i++) {
      const t = i / SR;
      const heel = Math.sin(2 * Math.PI * (82 * pitchShift * Math.exp(-t / 0.022) + 34) * t) * Math.exp(-t / 0.032) * 0.95;
      const grit = lpBoot.step(randSigned()) * Math.exp(-t / 0.042) * 0.8;
      // Delayed fluid splash droplets as boot sole presses into wet asphalt film
      const splashEnv = t > 0.014 ? Math.exp(-(t - 0.014) / 0.055) * Math.min(1, (t - 0.014) / 0.012) : 0;
      const dropletMod = 0.55 + 0.45 * Math.sin(t * 210 + v * 1.9);
      const splash = hpSplash.step(randSigned()) * splashEnv * dropletMod * 0.72;
      asp[i] = softClip(heel + grit + splash, 1.5);
    }
    normalize([asp], 0.84);
    out.push([`step_asphalt_${v}.wav`, [asp]]);

    // B) Hollow Steel / Metal Deck (LCAC deck, elevator floor, K-808 armor, bridges)
    const met = new Float32Array(Math.floor(0.28 * SR));
    for (let i = 0; i < met.length; i++) {
      const t = i / SR;
      const thud = Math.sin(2 * Math.PI * (128 * pitchShift * Math.exp(-t / 0.018) + 64) * t) * Math.exp(-t / 0.04) * 0.85;
      met[i] += thud;
    }
    addModalBurst(
      met,
      0.004,
      [
        { freq: 185 * pitchShift, amp: 0.55, decay: 0.055 },
        { freq: 412 * pitchShift, amp: 0.44, decay: 0.045 },
        { freq: 795 * pitchShift, amp: 0.34, decay: 0.032 },
        { freq: 1460 * pitchShift, amp: 0.24, decay: 0.024 },
        { freq: 2680 * pitchShift, amp: 0.16, decay: 0.016 },
      ],
      0.32,
      0.016
    );
    normalize([met], 0.86);
    out.push([`step_metal_${v}.wav`, [met]]);

    // C) Shattered Glass Shards & Concrete Rubble (Euljiro ruins, indoor command post, 2F balcony)
    const gls = new Float32Array(Math.floor(0.26 * SR));
    for (let i = 0; i < gls.length; i++) {
      const t = i / SR;
      gls[i] += Math.sin(2 * Math.PI * (96 * pitchShift * Math.exp(-t / 0.02) + 42) * t) * Math.exp(-t / 0.028) * 0.65;
    }
    // 14 micro-timed crystalline brittle glass shard snaps & gravel crunches
    for (let g = 0; g < 14; g++) {
      const t0 = 0.008 + rand() * 0.135;
      const baseF = (3400 + rand() * 6400) * pitchShift;
      addModalBurst(
        gls,
        t0,
        [
          { freq: baseF, amp: 0.22 + rand() * 0.22, decay: 0.004 + rand() * 0.007 },
          { freq: baseF * 1.47, amp: 0.16 + rand() * 0.15, decay: 0.003 + rand() * 0.005 },
        ],
        0.24,
        0.006
      );
    }
    normalize([gls], 0.85);
    out.push([`step_glass_${v}.wav`, [gls]]);
  }

  return out;
}

// 6) AEROSPACE & RADIO FOLEY: Helicopter Rotor Loop, Supersonic Fighter Jet Doppler Flyby, Radio PTT Squelch
function buildAerospaceAndRadioBank(): Array<[string, Float32Array[]]> {
  // A) Seamless 2.0s Heavy Military Helicopter Rotor Chop Loop (11Hz blade-slap + turbine whine)
  const nHeli = Math.floor(2.0 * SR);
  const heliL = new Float32Array(nHeli);
  const heliR = new Float32Array(nHeli);
  const lpBlade = new Biquad();
  lpBlade.setLowpass(165, 1.3);
  const bpAir = new Biquad();
  bpAir.setBandpass(380, 0.9);
  const bladeHz = 11.0; // Exact integer 22 cycles over 2.0s for zero-click seamless looping!
  for (let i = 0; i < nHeli; i++) {
    const t = i / SR;
    const chop = Math.pow(0.5 + 0.5 * Math.sin(2 * Math.PI * bladeHz * t), 2.6);
    const chopR = Math.pow(0.5 + 0.5 * Math.sin(2 * Math.PI * bladeHz * t + 0.35), 2.6);
    const slap = Math.sin(2 * Math.PI * 44 * t) * chop * 0.55;
    const air = lpBlade.step(randSigned()) * (0.25 + chop * 1.45);
    const wash = bpAir.step(randSigned()) * (0.18 + chopR * 0.72);
    const turbine = Math.sin(2 * Math.PI * 528 * t) * 0.065 + Math.sin(2 * Math.PI * 1056 * t) * 0.032;
    heliL[i] = softClip(slap + air + wash * 0.5 + turbine, 1.4);
    heliR[i] = softClip(slap * 0.94 + air * 0.6 + wash + turbine, 1.4);
  }
  normalize([heliL, heliR], 0.82);

  // B) 4.6s Low-Altitude Supersonic Fighter Jet Stereo Doppler Flyby Roar!
  const durJet = 4.6;
  const nJet = Math.floor(durJet * SR);
  const jetL = new Float32Array(nJet);
  const jetR = new Float32Array(nJet);
  const jetBp = new Biquad();
  const jetLp = new Biquad();
  let turbinePhase = 0;
  for (let i = 0; i < nJet; i++) {
    const t = i / SR;
    const u = (t - 2.1) / 0.75; // Peak overhead pass at t = 2.1s
    const prox = 1 / (1 + u * u); // Inverse-square overhead intensity envelope
    const doppler = 1.0 - 0.34 * Math.tanh(u * 1.25); // Authentic high -> low Doppler pitch sweep!
    const pan = 0.5 + 0.48 * Math.tanh(u * 0.95); // Sweeps Left -> Right across Neo-Seoul sky!
    const fadeEdge = Math.min(1, t / 0.35) * Math.min(1, (durJet - t) / 0.65);

    const turbineFreq = 680 * doppler;
    turbinePhase += (2 * Math.PI * turbineFreq) / SR;
    const whine =
      (Math.sin(turbinePhase) * 0.16 + Math.sin(turbinePhase * 2.02) * 0.09) *
      Math.pow(prox, 0.8) *
      (t < 2.25 ? 1.0 : Math.exp(-(t - 2.25) / 0.55));

    jetBp.setBandpass(360 + 1650 * prox * doppler, 0.75);
    jetLp.setLowpass(180 + 520 * prox, 0.8);
    const n1 = randSigned();
    const afterburner =
      (jetBp.step(n1) * 1.25 + jetLp.step(randSigned()) * 1.75) *
      Math.pow(prox, 0.65) *
      (t > 1.85 ? 1.45 : 0.75);

    const sig = softClip((whine + afterburner) * fadeEdge, 1.8);
    jetL[i] = sig * (1 - pan * 0.85);
    jetR[i] = sig * (0.15 + pan * 0.85);
  }
  normalize([jetL, jetR], 0.94);

  // C) Military VHF Tactical Radio PTT Squelch In & Out
  const sqIn = new Float32Array(Math.floor(0.14 * SR));
  const sqBp = new Biquad();
  sqBp.setBandpass(2350, 1.4);
  for (let i = 0; i < sqIn.length; i++) {
    const t = i / SR;
    const click = Math.sin(2 * Math.PI * 1480 * t) * Math.exp(-t / 0.008) * 0.55;
    const burst = sqBp.step(randSigned()) * Math.exp(-t / 0.032) * 0.85;
    sqIn[i] = softClip(click + burst, 2.0);
  }
  normalize([sqIn], 0.85);

  const sqOut = new Float32Array(Math.floor(0.16 * SR));
  const sqBp2 = new Biquad();
  sqBp2.setBandpass(2850, 1.8);
  for (let i = 0; i < sqOut.length; i++) {
    const t = i / SR;
    const tail = sqBp2.step(randSigned()) * Math.exp(-t / 0.042) * 0.78;
    const beep = t < 0.036 ? Math.sin(2 * Math.PI * 980 * t) * 0.32 : 0;
    sqOut[i] = softClip(tail + beep, 1.9);
  }
  normalize([sqOut], 0.82);

  return [
    ['heli_rotor_loop.wav', [heliL, heliR]],
    ['jet_flyby.wav', [jetL, jetR]],
    ['radio_squelch_in.wav', [sqIn]],
    ['radio_squelch_out.wav', [sqOut]],
  ];
}

// =========================================================================
// 7) ARMORED WARFARE & HELI GUNSHIP BANK (120mm K2 Cannon, Diesel Track Loop,
//    M134 Rotary Minigun BRRRT, Crisp SINCGARS Tactical Radio Chirp)
// =========================================================================
function buildArmoredAndMinigunBank(): Array<[string, Float32Array[]]> {
  // A) K2-X 120mm L/55 Smoothbore Main Cannon Blast (2.1s stereo)
  const nTank = Math.floor(2.1 * SR);
  const tankL = new Float32Array(nTank);
  const tankR = new Float32Array(nTank);
  const subLp = new Biquad();
  subLp.setLowpass(115, 0.85);
  const crackHp = new Biquad();
  crackHp.setBandpass(1850, 0.9);
  const tailLp = new Biquad();
  tailLp.setLowpass(420, 0.65);

  for (let i = 0; i < nTank; i++) {
    const t = i / SR;
    // Sub-bass cannon overpressure shockwave (sweeps 68Hz -> 28Hz)
    const subFreq = 28 + 42 * Math.exp(-t / 0.14);
    const subWave = Math.sin(2 * Math.PI * subFreq * t) * Math.exp(-t / 0.38) * 1.55;
    // Supersonic muzzle crack + breech recoil clank at t = 0.08..0.28s
    const crack = crackHp.step(randSigned()) * Math.exp(-t / 0.055) * 1.45;
    const breech =
      t > 0.09
        ? (Math.sin(2 * Math.PI * 390 * (t - 0.09)) * 0.24 +
            Math.sin(2 * Math.PI * 1120 * (t - 0.09)) * 0.18) *
          Math.exp(-(t - 0.09) / 0.09)
        : 0;
    // Massive Seoul urban canyon rumble echo
    const echo = tailLp.step(randSigned()) * Math.exp(-Math.max(0, t - 0.04) / 0.68) * 1.15;
    const boom = subLp.step(randSigned()) * Math.exp(-t / 0.24) * 1.4;
    const rawL = softClip(subWave + crack + breech + boom + echo * 0.95, 1.9);
    const rawR = softClip(subWave + crack * 0.94 + breech * 0.85 + boom * 0.96 + echo * 1.05, 1.9);
    tankL[i] = rawL;
    tankR[i] = rawR;
  }
  normalize([tankL, tankR], 0.96);

  // B) Seamless 2.4s 1,500-HP Heavy Diesel Turbine + Track Clatter Loop
  const durEng = 2.4;
  const nEng = Math.floor(durEng * SR);
  const engL = new Float32Array(nEng);
  const engR = new Float32Array(nEng);
  const engLp = new Biquad();
  engLp.setLowpass(240, 0.9);
  const clatterBp = new Biquad();
  clatterBp.setBandpass(620, 1.4);
  for (let i = 0; i < nEng; i++) {
    const t = i / SR;
    // Seamless harmonic multiples of 1/2.4Hz so loop boundary is 100% click-free
    const fBase = 37.5; // 90 cycles per 2.4s
    const diesel =
      Math.sin(2 * Math.PI * fBase * t) * 0.42 +
      Math.sin(2 * Math.PI * fBase * 2 * t) * 0.26 +
      Math.sin(2 * Math.PI * fBase * 3 * t) * 0.14;
    const turbine = Math.sin(2 * Math.PI * 240 * t) * 0.065;
    // Track link clatter modulation (15Hz = 36 cycles per 2.4s)
    const linkPulse = 0.55 + 0.45 * Math.pow(Math.max(0, Math.sin(2 * Math.PI * 15 * t)), 3);
    const rumble = engLp.step(randSigned()) * 0.85 + clatterBp.step(randSigned()) * 0.34 * linkPulse;
    engL[i] = softClip(diesel + turbine + rumble, 1.35);
    engR[i] = softClip(diesel * 0.95 + turbine + rumble * 0.92, 1.35);
  }
  normalize([engL, engR], 0.78);

  // C) M134 6-Barrel Rotary Minigun Short High-ROF Burst (0.36s, 3000 RPM = 50 shots/sec)
  const nMini = Math.floor(0.36 * SR);
  const miniL = new Float32Array(nMini);
  const miniR = new Float32Array(nMini);
  const miniBp = new Biquad();
  miniBp.setBandpass(1450, 0.85);
  const miniLow = new Biquad();
  miniLow.setLowpass(280, 0.8);
  for (let i = 0; i < nMini; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.012) * Math.min(1, (0.36 - t) / 0.065);
    // 50Hz rotary pulse train -> iconic terrifying BRRRT buzz!
    const pulse = 0.25 + 0.75 * Math.pow(Math.max(0, Math.sin(2 * Math.PI * 48 * t)), 4);
    const motor = Math.sin(2 * Math.PI * 640 * t) * 0.12 + Math.sin(2 * Math.PI * 1280 * t) * 0.06;
    const blast = (miniBp.step(randSigned()) * 1.4 + miniLow.step(randSigned()) * 1.2) * pulse;
    const sig = softClip((blast + motor) * env, 2.1);
    miniL[i] = sig;
    miniR[i] = sig * 0.94;
  }
  normalize([miniL, miniR], 0.94);

  // D) Clean Military SINCGARS Tactical Radio Comms Beep + Subtle Squelch (for voice-free crisp comms!)
  const nChirp = Math.floor(0.18 * SR);
  const chirp = new Float32Array(nChirp);
  const chirpBp = new Biquad();
  chirpBp.setBandpass(2200, 1.6);
  for (let i = 0; i < nChirp; i++) {
    const t = i / SR;
    const toneA = t < 0.042 ? Math.sin(2 * Math.PI * 1320 * t) * Math.sin((t / 0.042) * Math.PI) * 0.42 : 0;
    const toneB =
      t >= 0.048 && t < 0.095
        ? Math.sin(2 * Math.PI * 1760 * t) * Math.sin(((t - 0.048) / 0.047) * Math.PI) * 0.36
        : 0;
    const staticClick = chirpBp.step(randSigned()) * Math.exp(-t / 0.028) * 0.42;
    chirp[i] = softClip(toneA + toneB + staticClick, 1.6);
  }
  normalize([chirp], 0.84);

  return [
    ['tank_cannon.wav', [tankL, tankR]],
    ['tank_engine.wav', [engL, engR]],
    ['minigun_burst.wav', [miniL, miniR]],
    ['radio_chirp.wav', [chirp]],
  ];
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const all: Array<[string, Float32Array[]]> = [
    ...buildRifleBank(),
    ...buildShotgunBank(),
    ...buildHeavyOrdnanceBank(),
    ...buildReloadFoleyBank(),
    ...buildFootstepsBank(),
    ...buildAerospaceAndRadioBank(),
    ...buildArmoredAndMinigunBank(),
  ];

  let totalBytes = 0;
  for (const [name, ch] of all) {
    const bytes = writeWav(name, ch);
    totalBytes += bytes;
    console.log(`  [WAV] ${name} (${(bytes / 1024).toFixed(1)} KB, ${ch.length}ch)`);
  }
  console.log(`Generated ${all.length} studio military audio bank .wav files (${(totalBytes / 1024).toFixed(1)} KB total).`);
}

main();
