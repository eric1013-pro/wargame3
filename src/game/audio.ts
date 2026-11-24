import { BgmMood, CommsSender } from './types';

export class WarAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmFilter: BiquadFilterNode | null = null;
  private bgmGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private reverbSend: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private ambientStarted = false;
  private muted = false;
  private bgmTimer: number | null = null;
  private bgmStep = 0;
  private combatIntensity = 0; // 0..1
  private bossActive = false;
  private vatsActive = false;
  private playing = false;
  private mood: BgmMood = 'opening';

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.54, this.ctx.currentTime, 0.03);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public setDynamicState(opts: {
    playing: boolean;
    intensity: number;
    bossActive: boolean;
    vatsActive: boolean;
    mood?: BgmMood;
  }): void {
    this.playing = opts.playing;
    this.combatIntensity = Math.max(0, Math.min(1, opts.intensity));
    this.bossActive = opts.bossActive;
    this.vatsActive = opts.vatsActive;
    if (opts.mood) this.mood = opts.mood;

    if (this.ctx && this.bgmFilter && this.bgmGain) {
      const now = this.ctx.currentTime;
      const targetFreq = opts.vatsActive
        ? 340
        : this.mood === 'dawn'
          ? 2400
          : this.mood === 'opening'
            ? 620
            : this.mood === 'breach' || opts.bossActive
              ? 4400
              : 1450 + this.combatIntensity * 2000;
      this.bgmFilter.frequency.setTargetAtTime(targetFreq, now, 0.12);

      const targetVol = !opts.playing
        ? 0.0
        : opts.vatsActive
          ? 0.14
          : this.mood === 'dawn'
            ? 0.28
            : this.mood === 'opening'
              ? 0.16
              : this.mood === 'breach'
                ? 0.34
                : 0.22 + this.combatIntensity * 0.11;
      this.bgmGain.gain.setTargetAtTime(targetVol, now, 0.18);
    }

    if (this.ctx && this.rainGain && this.droneGain) {
      const now = this.ctx.currentTime;
      const targetRain = !opts.playing ? 0.04 : this.mood === 'dawn' ? 0.002 : 0.068;
      const targetDrone = !opts.playing
        ? 0.02
        : this.mood === 'dawn'
          ? 0.008
          : this.mood === 'opening'
            ? 0.075
            : this.mood === 'breach'
              ? 0.06
              : 0.035;
      this.rainGain.gain.setTargetAtTime(targetRain, now, 0.55);
      this.droneGain.gain.setTargetAtTime(targetDrone, now, 0.35);
    }
  }

  public init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -13;
    comp.knee.value = 18;
    comp.ratio.value = 8;
    comp.attack.value = 0.002;
    comp.release.value = 0.15;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.54;
    this.masterGain.connect(comp);
    comp.connect(this.ctx.destination);

    // White noise buffer
    const sr = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, sr * 2.5, sr);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    // Urban canyon convolution impulse response
    const irLen = Math.floor(sr * 1.4);
    const irBuf = this.ctx.createBuffer(2, irLen, sr);
    for (let ch = 0; ch < 2; ch++) {
      const ir = irBuf.getChannelData(ch);
      for (let i = 0; i < irLen; i++) {
        const decay = Math.pow(1 - i / irLen, 2.75);
        ir[i] = (Math.random() * 2 - 1) * decay;
      }
    }

    const reverb = this.ctx.createConvolver();
    reverb.buffer = irBuf;
    this.reverbSend = this.ctx.createGain();
    this.reverbSend.gain.value = 0.34;
    this.reverbSend.connect(reverb);
    reverb.connect(this.masterGain);

    // Dynamic Industrial Metal BGM bus
    this.bgmFilter = this.ctx.createBiquadFilter();
    this.bgmFilter.type = 'lowpass';
    this.bgmFilter.frequency.value = 1800;
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.0;
    this.bgmFilter.connect(this.bgmGain);
    this.bgmGain.connect(this.masterGain);

    this.startAmbience();
    this.startIndustrialBgmLoop();
  }

  private startAmbience(): void {
    if (this.ambientStarted || !this.ctx || !this.noiseBuf || !this.masterGain) return;
    this.ambientStarted = true;
    // Continuous Wasteland Rain + Low-Pass Dark Sawtooth Ambient Drone
    const wind = this.ctx.createBufferSource();
    wind.buffer = this.noiseBuf;
    wind.loop = true;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 1150;
    filt.Q.value = 0.55;
    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0.06;
    wind.connect(filt);
    filt.connect(this.rainGain);
    this.rainGain.connect(this.masterGain);
    wind.start();

    const droneA = this.ctx.createOscillator();
    const droneB = this.ctx.createOscillator();
    droneA.type = 'sawtooth';
    droneB.type = 'sawtooth';
    droneA.frequency.value = 55.0;
    droneB.frequency.value = 55.35;
    const droneFilt = this.ctx.createBiquadFilter();
    droneFilt.type = 'lowpass';
    droneFilt.frequency.value = 185;
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.04;
    droneA.connect(droneFilt);
    droneB.connect(droneFilt);
    droneFilt.connect(this.droneGain);
    this.droneGain.connect(this.masterGain);
    droneA.start();
    droneB.start();
  }

  private startIndustrialBgmLoop(): void {
    if (this.bgmTimer !== null) return;
    const combatBass = [55, 55, 0, 65.4, 55, 0, 73.4, 61.7, 55, 55, 82.4, 0, 55, 65.4, 49, 0];
    const breachBass = [49, 49, 55, 49, 65.4, 49, 58.3, 49, 49, 73.4, 49, 65.4, 58.3, 55, 49, 46.2];
    const breachStrings = [220, 220, 261.63, 293.66];
    const dawnChords: number[][] = [
      [220.0, 261.63, 329.63, 392.0],
      [174.61, 220.0, 261.63, 329.63],
      [261.63, 329.63, 392.0, 493.88],
      [196.0, 246.94, 293.66, 392.0],
    ];

    const scheduleNext = () => {
      const bpm =
        this.mood === 'dawn'
          ? 64
          : this.mood === 'opening'
            ? 74
            : this.vatsActive
              ? 72
              : this.mood === 'breach' || this.bossActive
                ? 136
                : 110 + this.combatIntensity * 16;
      const stepMs = (60 / bpm / 4) * 1000;

      if (this.ctx && this.playing && !this.muted && this.bgmFilter) {
        const t = this.ctx.currentTime + 0.015;
        const step = this.bgmStep % 16;

        if (this.mood === 'opening') {
          if (step === 0 || step === 8) {
            this.bgmOsc(t, 'sine', 62, 42, 0.52, 0.24);
          }
          if (step === 0) {
            this.bgmOsc(t, 'triangle', 110, 109.2, 1.4, 0.14);
          }
        } else if (this.mood === 'dawn') {
          if (step === 0) {
            const chordIdx = Math.floor(this.bgmStep / 16) % dawnChords.length;
            const chord = dawnChords[chordIdx];
            for (const note of chord) {
              this.bgmPad(t, note, 2.8, 0.11);
            }
          }
          if (step === 8) {
            const chordIdx = Math.floor(this.bgmStep / 16) % dawnChords.length;
            const top = dawnChords[chordIdx][3] * 2;
            this.bgmPad(t, top, 1.2, 0.055);
          }
        } else {
          const isBreach = this.mood === 'breach' || this.bossActive;
          const notes = isBreach ? breachBass : combatBass;
          const freq = notes[step];

          if (
            step === 0 ||
            step === 4 ||
            step === 8 ||
            step === 12 ||
            (this.combatIntensity > 0.45 && step === 10)
          ) {
            this.bgmOsc(t, 'sine', 120, 34, 0.14, 0.54);
          }
          if (step === 4 || step === 12) {
            this.bgmNoise(t, 0.11, 1450, 'bandpass', 0.32);
            this.bgmOsc(t, 'triangle', 220, 95, 0.08, 0.21);
          }
          if (step % 2 === 1 && (this.combatIntensity > 0.22 || isBreach)) {
            this.bgmNoise(t, 0.035, 5400, 'highpass', 0.095);
          }
          if (freq > 0) {
            this.bgmOsc(t, 'sawtooth', freq, freq * 0.99, 0.13, 0.3);
            this.bgmOsc(t, 'square', freq * 0.5, freq * 0.5, 0.13, 0.21);
          }
          if (isBreach) {
            if (step === 0 || step === 8) {
              const sNote = breachStrings[Math.floor(this.bgmStep / 8) % breachStrings.length];
              this.bgmPad(t, sNote, 1.05, 0.14);
              this.bgmPad(t, sNote * 1.5, 1.05, 0.09);
            }
            if (step === 0 || step === 6 || step === 12) {
              this.bgmOsc(t, 'triangle', 880, 860, 0.09, 0.11);
            }
          }
        }
        this.bgmStep++;
      }

      this.bgmTimer = window.setTimeout(scheduleNext, stepMs);
    };

    this.bgmTimer = window.setTimeout(scheduleNext, 150);
  }

  private bgmPad(t: number, freq: number, dur: number, gain: number): void {
    if (!this.ctx || !this.bgmFilter) return;
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, t);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0005, t);
    g.gain.linearRampToValueAtTime(gain, t + dur * 0.22);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g);
    g.connect(this.bgmFilter);
    if (this.reverbSend) g.connect(this.reverbSend);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private bgmOsc(
    t: number,
    type: OscillatorType,
    f1: number,
    f2: number,
    dur: number,
    gain: number
  ): void {
    if (!this.ctx || !this.bgmFilter) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(18, f2), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.bgmFilter);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private bgmNoise(
    t: number,
    dur: number,
    freq: number,
    type: BiquadFilterType,
    gain: number
  ): void {
    if (!this.ctx || !this.noiseBuf || !this.bgmFilter) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.bgmFilter);
    src.start(t, Math.random(), dur + 0.02);
  }

  public playWeapon(
    type: 'rifle' | 'shotgun' | 'railgun' | 'rocket' | 'flamer' | 'robot_laser',
    vol = 1.0
  ): void {
    if (!this.ctx || this.muted || vol < 0.03) return;
    const t = this.ctx.currentTime;
    const v = Math.min(1, vol);
    const pitchVar = 0.94 + Math.random() * 0.12;

    if (type === 'rifle') {
      this.noise(t, 0.11, 1650 * pitchVar, 'bandpass', 0.72 * v, true);
      this.noise(t, 0.055, 4200, 'highpass', 0.34 * v, false);
      this.osc(t, 'triangle', 180 * pitchVar, 42, 0.11, 0.64 * v, true);
      this.osc(t + 0.03, 'square', 920, 480, 0.03, 0.16 * v, false);
    } else if (type === 'shotgun') {
      this.noise(t, 0.34, 820 * pitchVar, 'lowpass', 1.15 * v, true);
      this.noise(t, 0.14, 2400, 'bandpass', 0.64 * v, true);
      this.osc(t, 'sine', 148, 24, 0.3, 1.05 * v, true);
      this.osc(t + 0.22, 'sawtooth', 330, 185, 0.08, 0.2 * v, false);
    } else if (type === 'railgun') {
      this.noise(t, 0.42, 2600, 'highpass', 0.9 * v, true);
      this.osc(t, 'sawtooth', 1480, 52, 0.44, 0.85 * v, true);
      this.osc(t, 'sine', 215, 25, 0.4, 0.95 * v, true);
    } else if (type === 'rocket') {
      this.noise(t, 0.48, 700, 'bandpass', 0.88 * v, true);
      this.osc(t, 'sawtooth', 165, 52, 0.36, 0.76 * v, false);
    } else if (type === 'flamer') {
      this.noise(t, 0.14, 480 * pitchVar, 'bandpass', 0.48 * v, false);
      this.noise(t, 0.12, 1800, 'highpass', 0.14 * v, false);
    } else if (type === 'robot_laser') {
      this.osc(t, 'sawtooth', 860 * pitchVar, 160, 0.14, 0.38 * v, true);
      this.noise(t, 0.08, 2200, 'bandpass', 0.25 * v, false);
    }
  }

  public playExplosion(vol = 1.0, nearPlayer = false, isEmp = false): void {
    if (!this.ctx || this.muted || vol < 0.03) return;
    const t = this.ctx.currentTime;
    const v = Math.min(1.2, vol);
    this.noise(t, 0.88, 400, 'lowpass', 1.25 * v, true);
    this.noise(t + 0.04, 0.55, 1100, 'bandpass', 0.72 * v, true);
    this.osc(t, 'sine', 112, 16, 0.78, 1.25 * v, true);

    if (isEmp) {
      this.osc(t, 'sawtooth', 2600, 120, 0.45, 0.55 * v, true);
      this.osc(t + 0.05, 'square', 1400, 90, 0.38, 0.4 * v, false);
    }

    if (nearPlayer && this.masterGain) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 3950;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 1.8);
      o.connect(g);
      g.connect(this.masterGain);
      o.start(t);
      o.stop(t + 1.85);
    }
  }

  public playArtilleryWhistle(): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.osc(t, 'sine', 1150, 260, 1.65, 0.2, true);
    this.noise(t, 1.6, 1400, 'bandpass', 0.08, true);
  }

  public playAirstrikeRadio(): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Radio squelch + confirmation beep + jet roar
    this.noise(t, 0.14, 2400, 'bandpass', 0.26, false);
    this.osc(t + 0.04, 'square', 1200, 1600, 0.09, 0.22, false);
    this.osc(t + 0.15, 'square', 1600, 2100, 0.09, 0.22, false);
    this.noise(t + 0.3, 1.7, 520, 'bandpass', 0.55, true);
  }

  public playVatsToggle(entering: boolean): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    if (entering) {
      this.osc(t, 'sine', 640, 110, 0.26, 0.45, false);
      this.osc(t + 0.06, 'triangle', 1240, 880, 0.12, 0.22, false);
    } else {
      this.osc(t, 'sine', 140, 560, 0.18, 0.35, false);
    }
  }

  public playHitMarker(crit = false, dismember = false): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.osc(t, 'triangle', crit ? 2450 : 1650, 740, 0.048, crit ? 0.54 : 0.34, false);
    this.osc(t, 'sine', crit ? 210 : 150, 58, 0.07, crit ? 0.45 : 0.25, false);
    if (crit || dismember) {
      this.noise(t, 0.14, 1450, 'bandpass', 0.78, false);
      this.osc(t, 'sawtooth', 460, 82, 0.12, 0.55, false);
      this.osc(t + 0.02, 'triangle', 3100, 1250, 0.055, 0.34, false);
    }
  }

  public playGloryKill(): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.noise(t, 0.28, 2200, 'bandpass', 1.0, true);
    this.osc(t, 'sawtooth', 560, 55, 0.3, 0.88, true);
    this.osc(t, 'sine', 150, 22, 0.38, 1.05, true);
  }

  public playHeartbeat(intensity = 0.6): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.osc(t, 'sine', 72, 34, 0.14, 0.55 * intensity, false);
    this.osc(t + 0.18, 'sine', 64, 30, 0.16, 0.42 * intensity, false);
  }

  public playShellClink(): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + 0.24;
    this.osc(t, 'sine', 3800 + Math.random() * 750, 3150, 0.04, 0.06, false);
  }

  public playReload(durationSec = 1.4, weaponIdx = 0, isTactical = false): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;

    if (isTactical) {
      // Tactical Reload (-20%): snappy partial-mag swap + metallic mag-lock + crisp tactical confirmation ping
      this.osc(t, 'square', 420, 220, 0.05, 0.2, false);
      this.noise(t + 0.02, 0.075, 2100, 'bandpass', 0.16, false);
      const seat = Math.max(0.24, durationSec * 0.72);
      this.osc(t + seat, 'triangle', 560, 880, 0.065, 0.25, false);
      this.noise(t + seat, 0.05, 2900, 'highpass', 0.18, false);
      // Subtle high-tech Exo-Suit tactical speed-reload chime
      this.osc(t + durationSec * 0.88, 'sine', 1180, 1480, 0.07, 0.12, false);
      return;
    }

    if (weaponIdx === 1) {
      // DOOM-99 Shotgun: twin spent shell eject -> 2 rhythmic shell thuds -> heavy pump shuck-shuck
      this.noise(t + 0.04, 0.11, 2100, 'bandpass', 0.22, false);
      this.osc(t + 0.08, 'sine', 2900, 1800, 0.05, 0.09, false);
      const s1 = durationSec * 0.44;
      const s2 = durationSec * 0.62;
      this.osc(t + s1, 'triangle', 340, 520, 0.06, 0.24, false);
      this.noise(t + s1, 0.05, 1900, 'highpass', 0.16, false);
      this.osc(t + s2, 'triangle', 360, 560, 0.06, 0.24, false);
      this.noise(t + s2, 0.05, 2000, 'highpass', 0.16, false);
      const rack = durationSec * 0.81;
      this.noise(t + rack, 0.09, 1500, 'bandpass', 0.3, false);
      this.osc(t + rack, 'sawtooth', 420, 190, 0.08, 0.24, false);
      this.noise(t + rack + 0.11, 0.09, 2600, 'bandpass', 0.3, false);
      this.osc(t + rack + 0.11, 'square', 520, 310, 0.07, 0.22, false);
      return;
    }

    if (weaponIdx === 2) {
      // RAIL-X9 Railgun: capacitor discharge whine -> magnetic cell clack -> high-voltage coil charge-up
      this.osc(t + 0.02, 'sine', 960, 180, durationSec * 0.32, 0.16, false);
      this.noise(t + durationSec * 0.16, 0.09, 2400, 'bandpass', 0.18, false);
      const ins = durationSec * 0.64;
      this.osc(t + ins, 'square', 240, 560, 0.08, 0.24, false);
      this.noise(t + ins, 0.06, 3100, 'highpass', 0.2, false);
      const chg = durationSec * 0.78;
      this.osc(t + chg, 'sawtooth', 220, 1380, durationSec * 0.2, 0.15, true);
      this.osc(t + chg, 'sine', 440, 1760, durationSec * 0.2, 0.14, true);
      return;
    }

    if (weaponIdx === 3) {
      // HYDRA-7 Launcher: heavy breech vent -> deep warhead tube slide thump -> electronic arm beep
      this.noise(t + 0.03, 0.18, 950, 'bandpass', 0.24, false);
      this.osc(t + 0.05, 'triangle', 220, 85, 0.14, 0.25, false);
      const seat = durationSec * 0.66;
      this.osc(t + seat, 'sine', 165, 58, 0.18, 0.34, false);
      this.noise(t + seat, 0.14, 720, 'lowpass', 0.28, false);
      const arm = durationSec * 0.85;
      this.osc(t + arm, 'sine', 1040, 1040, 0.06, 0.16, false);
      this.osc(t + arm + 0.08, 'sine', 1480, 1480, 0.08, 0.18, false);
      return;
    }

    if (weaponIdx === 4) {
      // INFERNO-X Flamethrower: pressurized gas bleed hiss -> canister screw lock -> pilot igniter whoosh
      this.noise(t + 0.04, durationSec * 0.34, 3400, 'bandpass', 0.22, false);
      this.osc(t + durationSec * 0.15, 'triangle', 320, 180, 0.12, 0.16, false);
      const lock = durationSec * 0.72;
      this.osc(t + lock, 'square', 280, 490, 0.09, 0.22, false);
      this.noise(t + lock, 0.09, 2600, 'highpass', 0.2, false);
      const ign = durationSec * 0.84;
      this.noise(t + ign, 0.24, 1100, 'bandpass', 0.28, true);
      this.osc(t + ign, 'sawtooth', 180, 520, 0.16, 0.14, true);
      return;
    }

    // [0] M41-X Rifle: crisp mag release click + slide out -> fresh mag lock -> bolt rack metallic snap
    this.osc(t, 'square', 360, 165, 0.06, 0.22, false);
    this.noise(t + 0.03, 0.09, 1800, 'bandpass', 0.18, false);
    const mid = Math.max(0.28, durationSec * 0.62);
    this.osc(t + mid, 'triangle', 480, 720, 0.07, 0.26, false);
    this.noise(t + mid, 0.06, 2600, 'highpass', 0.18, false);
    const rack = Math.max(0.55, durationSec * 0.82);
    this.noise(t + rack, 0.08, 3200, 'bandpass', 0.24, false);
    this.osc(t + rack, 'sawtooth', 940, 420, 0.075, 0.22, false);
  }

  public playHolotapePickup(): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Retro Fallout Pip-Boy terminal data chime
    this.osc(t, 'sine', 880, 880, 0.09, 0.24, false);
    this.osc(t + 0.09, 'sine', 1175, 1175, 0.1, 0.26, false);
    this.osc(t + 0.18, 'triangle', 1760, 1760, 0.22, 0.24, true);
  }

  public playRelayDestroyed(): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.noise(t, 0.9, 520, 'bandpass', 0.52, true);
    this.osc(t, 'sawtooth', 420, 42, 0.72, 0.44, true);
    this.osc(t + 0.08, 'sine', 960, 140, 0.55, 0.36, true);
  }

  public playServerShutdown(): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Dramatic planetary AI mainframe power-down sweep + electromagnetic discharge
    this.osc(t, 'sawtooth', 680, 24, 2.4, 0.52, true);
    this.osc(t, 'triangle', 340, 18, 2.6, 0.48, true);
    this.noise(t, 1.8, 920, 'lowpass', 0.44, true);
    this.osc(t + 0.25, 'sine', 1240, 55, 1.9, 0.34, true);
  }

  public playThunder(): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.noise(t, 1.5, 240, 'lowpass', 0.42, true);
    this.osc(t, 'sine', 70, 22, 1.1, 0.35, true);
  }

  public playBraaam(): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.osc(t, 'sawtooth', 73.4, 54.0, 1.55, 0.46, true);
    this.osc(t, 'sawtooth', 73.9, 54.4, 1.55, 0.42, true);
    this.osc(t, 'sine', 110, 32, 1.35, 0.72, true);
    this.noise(t, 0.45, 520, 'lowpass', 0.38, true);
  }

  public playTypewriterTick(): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.noise(t, 0.024, 3400 + Math.random() * 600, 'bandpass', 0.15, false);
    this.osc(t, 'square', 1480, 920, 0.018, 0.075, false);
  }

  public playAirRaidSiren(): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.osc(t, 'sawtooth', 260, 560, 1.4, 0.22, true);
    this.osc(t + 1.4, 'sawtooth', 560, 230, 1.7, 0.2, true);
    this.noise(t, 2.8, 720, 'bandpass', 0.09, true);
  }

  public playShieldBreachDrop(): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.noise(t, 0.95, 2400, 'highpass', 0.68, true);
    this.noise(t + 0.06, 1.4, 340, 'lowpass', 0.92, true);
    this.osc(t, 'sine', 180, 24, 1.85, 1.05, true);
    this.osc(t + 0.04, 'sawtooth', 980, 62, 0.92, 0.52, true);
  }

  public playCommsCue(sender: CommsSender): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    if (sender === 'exo') {
      this.osc(t, 'sine', 1040, 1320, 0.055, 0.16, false);
      this.osc(t + 0.065, 'sine', 1320, 1560, 0.07, 0.14, false);
      this.noise(t, 0.03, 3600, 'bandpass', 0.08, false);
    } else if (sender === 'arcadia') {
      this.osc(t, 'sawtooth', 145, 72, 0.26, 0.34, true);
      this.osc(t + 0.04, 'square', 820, 210, 0.16, 0.2, false);
      this.noise(t, 0.22, 1850, 'bandpass', 0.32, false);
    } else {
      this.noise(t, 0.045, 2400, 'bandpass', 0.24, false);
      this.osc(t, 'triangle', 420, 190, 0.05, 0.18, false);
      this.noise(t + 0.06, 0.32, 3200, 'highpass', 0.085, false);
      this.osc(t + 0.08, 'sine', 784, 1046, 0.14, 0.16, true);
    }
  }

  public playDawnChime(): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const freqs = [220, 277.18, 329.63, 440, 493.88];
    freqs.forEach((f, idx) => {
      this.osc(t + idx * 0.18, 'triangle', f, f * 1.002, 2.8, 0.15, true);
    });
  }

  private noise(
    t: number,
    dur: number,
    freq: number,
    type: BiquadFilterType,
    gain: number,
    sendRev: boolean
  ): void {
    if (!this.ctx || !this.noiseBuf || !this.masterGain) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.masterGain);
    if (sendRev && this.reverbSend) g.connect(this.reverbSend);
    src.start(t, Math.random() * 1.1, dur + 0.03);
  }

  private osc(
    t: number,
    type: OscillatorType,
    f1: number,
    f2: number,
    dur: number,
    gain: number,
    sendRev: boolean
  ): void {
    if (!this.ctx || !this.masterGain) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(14, f2), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.masterGain);
    if (sendRev && this.reverbSend) g.connect(this.reverbSend);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  public dispose(): void {
    if (this.bgmTimer !== null) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
