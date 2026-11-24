import { BgmMood, CommsSender, EndingId } from './types';
import { findVoiceDubForSubtitle } from './voiceManifest';

export type FootstepSurface = 'asphalt' | 'metal' | 'glass';

export const SFX_BANK_FILES = [
  'rifle_punch',
  'rifle_tail_outdoor',
  'rifle_tail_indoor',
  'shotgun_punch',
  'shotgun_tail_outdoor',
  'shotgun_tail_indoor',
  'sniper_punch',
  'sniper_tail_outdoor',
  'rocket_launch',
  'explosion_close',
  'explosion_distant',
  'ac130_25mm',
  'ac130_40mm',
  'ac130_105mm',
  'reload_mag_out',
  'reload_mag_in',
  'reload_bolt_rack',
  'reload_shell_load',
  'step_asphalt_1',
  'step_asphalt_2',
  'step_metal_1',
  'step_metal_2',
  'step_glass_1',
  'step_glass_2',
  'heli_rotor_loop',
  'jet_flyby',
  'radio_squelch_in',
  'radio_squelch_out',
  'tank_cannon',
  'tank_engine',
  'minigun_burst',
  'radio_chirp',
] as const;

type SfxBankKey = (typeof SFX_BANK_FILES)[number];

function createRadioSaturationCurve(): Float32Array<ArrayBuffer> {
  const n = 512;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    // Warm analog VHF radio handset soft clipping
    curve[i] = Math.tanh(x * 2.15) / Math.tanh(2.15);
  }
  return curve;
}

export class WarAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmFilter: BiquadFilterNode | null = null;
  private bgmGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private heliGain: GainNode | null = null;
  private heliSource: AudioBufferSourceNode | null = null;
  private tankEngineGain: GainNode | null = null;
  private tankEngineSource: AudioBufferSourceNode | null = null;
  private reverbSend: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private sfxBuffers = new Map<SfxBankKey, AudioBuffer>();
  private sfxPreloading = false;
  private voiceBuffers = new Map<string, AudioBuffer>();
  private activeVoiceNodes: AudioNode[] = [];
  private activeVoiceSources: AudioBufferSourceNode[] = [];
  private voiceSeq = 0;
  private stepParity = 0;
  private radioCurve: Float32Array<ArrayBuffer> = createRadioSaturationCurve();
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
        : this.mood === 'dawn' || this.mood === 'symbiosis'
          ? 2600
          : this.mood === 'choice'
            ? 840
            : this.mood === 'opening'
              ? 620
              : this.mood === 'breach' || this.mood === 'ascension' || opts.bossActive
                ? 4400
                : this.mood === 'escalation'
                  ? 3200
                  : 1450 + this.combatIntensity * 2000;
      this.bgmFilter.frequency.setTargetAtTime(targetFreq, now, 0.12);

      const targetVol = !opts.playing
        ? 0.0
        : opts.vatsActive
          ? 0.14
          : this.mood === 'dawn' || this.mood === 'symbiosis'
            ? 0.3
            : this.mood === 'choice'
              ? 0.24
              : this.mood === 'opening'
                ? 0.16
                : this.mood === 'breach' || this.mood === 'ascension'
                  ? 0.36
                  : 0.22 + this.combatIntensity * 0.12;
      this.bgmGain.gain.setTargetAtTime(targetVol, now, 0.18);
    }

    if (this.ctx && this.rainGain && this.droneGain) {
      const now = this.ctx.currentTime;
      const targetRain = !opts.playing
        ? 0.04
        : this.mood === 'dawn' || this.mood === 'symbiosis'
          ? 0.002
          : 0.068;
      const targetDrone = !opts.playing
        ? 0.02
        : this.mood === 'dawn' || this.mood === 'symbiosis'
          ? 0.008
          : this.mood === 'opening' || this.mood === 'choice' || this.mood === 'ascension'
            ? 0.08
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

    const sr = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, sr * 2.5, sr);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

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

    this.bgmFilter = this.ctx.createBiquadFilter();
    this.bgmFilter.type = 'lowpass';
    this.bgmFilter.frequency.value = 1800;
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.0;
    this.bgmFilter.connect(this.bgmGain);
    this.bgmGain.connect(this.masterGain);

    this.heliGain = this.ctx.createGain();
    this.heliGain.gain.value = 0.0;
    this.heliGain.connect(this.masterGain);

    this.tankEngineGain = this.ctx.createGain();
    this.tankEngineGain.gain.value = 0.0;
    this.tankEngineGain.connect(this.masterGain);

    this.startAmbience();
    this.startIndustrialBgmLoop();
    void this.preloadMilitarySfxBank();
  }

  private async preloadMilitarySfxBank(): Promise<void> {
    if (this.sfxPreloading || !this.ctx) return;
    this.sfxPreloading = true;
    const ctx = this.ctx;
    await Promise.all(
      SFX_BANK_FILES.map(async (key) => {
        try {
          const res = await fetch(`./src/assets/audio/sfx/${key}.wav`);
          if (!res.ok) return;
          const ab = await res.arrayBuffer();
          const decoded = await ctx.decodeAudioData(ab);
          this.sfxBuffers.set(key, decoded);
          if (key === 'heli_rotor_loop') {
            this.startHeliLoopIfReady();
          } else if (key === 'tank_engine') {
            this.startTankEngineIfReady();
          }
        } catch {
          // Graceful fallback to synthesis if sample unavailable
        }
      })
    );
  }

  private startHeliLoopIfReady(): void {
    if (!this.ctx || !this.heliGain || this.heliSource) return;
    const buf = this.sfxBuffers.get('heli_rotor_loop');
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(this.heliGain);
    src.start();
    this.heliSource = src;
  }

  private startTankEngineIfReady(): void {
    if (!this.ctx || !this.tankEngineGain || this.tankEngineSource) return;
    const buf = this.sfxBuffers.get('tank_engine');
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(this.tankEngineGain);
    src.start();
    this.tankEngineSource = src;
  }

  /** Smoothly adjusts K2-X 1,500-HP diesel turbine & track clatter rumble based on driving speed */
  public setTankEnginePresence(active: boolean, throttle01 = 0): void {
    if (!this.ctx || !this.tankEngineGain) return;
    this.startTankEngineIfReady();
    const now = this.ctx.currentTime;
    const clampedThrottle = Math.max(0, Math.min(1, throttle01));
    const targetGain = !active || this.muted ? 0 : 0.16 + clampedThrottle * 0.22;
    this.tankEngineGain.gain.setTargetAtTime(targetGain, now, 0.14);
    if (this.tankEngineSource) {
      const targetRate = 0.86 + clampedThrottle * 0.44;
      this.tankEngineSource.playbackRate.setTargetAtTime(targetRate, now, 0.12);
    }
  }

  /** Fires massive 120mm L/55 smoothbore tank main cannon blast with Seoul urban canyon echo */
  public playTankCannon(): void {
    if (!this.ctx || this.muted) return;
    if (!this.playBankSample('tank_cannon', 0.96, 0.97 + Math.random() * 0.06, 0, true)) {
      const t = this.ctx.currentTime;
      this.osc(t, 'sine', 64, 24, 0.48, 0.85, true);
      this.noise(t, 0.45, 520, 'lowpass', 0.8, true);
    }
  }

  /** Fires M134 6-barrel 3,000-RPM helicopter door-mounted rotary minigun burst */
  public playMinigunBurst(): void {
    if (!this.ctx || this.muted) return;
    if (!this.playBankSample('minigun_burst', 0.62, 0.95 + Math.random() * 0.1, 0, true)) {
      const t = this.ctx.currentTime;
      this.noise(t, 0.12, 1350, 'bandpass', 0.45, true);
    }
  }

  /** Clean, natural military SINCGARS/VHF radio PTT chirp + short static click (no synthetic speech!) */
  public playRadioCommsChirp(sender: CommsSender): void {
    if (!this.ctx || this.muted) return;
    const rate =
      sender === 'arcadia'
        ? 0.78
        : sender === 'ghost9'
          ? 0.88
          : sender === 'gunship'
            ? 1.08
            : sender === 'valkyrie'
              ? 1.04
              : 0.96;
    const played = this.playBankSample('radio_chirp', 0.34, rate, 0, false);
    this.playBankSample('radio_squelch_in', 0.22, rate, 0.02, false);
    if (!played) {
      const t = this.ctx.currentTime;
      this.osc(t, 'sine', 1320 * rate, 1680 * rate, 0.06, 0.14, false);
    }
  }

  /** Smoothly adjusts overhead helicopter/gunship rotor chop intensity (0..1) */
  public setHeliPresence(intensity: number): void {
    if (!this.ctx || !this.heliGain) return;
    this.startHeliLoopIfReady();
    const clamped = this.muted ? 0 : Math.max(0, Math.min(1, intensity));
    this.heliGain.gain.setTargetAtTime(clamped * 0.34, this.ctx.currentTime, 0.25);
  }

  /** Plays a stereo low-altitude supersonic fighter jet Doppler flyby across the Neo-Seoul sky */
  public playJetFlyby(vol = 0.78): void {
    if (!this.ctx || this.muted) return;
    this.playBankSample('jet_flyby', vol, 0.96 + Math.random() * 0.08, 0, true);
  }

  /** Plays surface-aware footsteps: wet asphalt, hollow metal deck, or shattered glass/rubble */
  public playFootstep(surface: FootstepSurface, sprinting = false, isIndoors = false): void {
    if (!this.ctx || this.muted) return;
    this.stepParity = (this.stepParity + 1) % 2;
    const variant = this.stepParity === 0 ? '1' : '2';
    const key = `step_${surface}_${variant}` as SfxBankKey;
    const gain = (sprinting ? 0.38 : 0.25) * (surface === 'metal' ? 1.12 : 1.0);
    const rate = (sprinting ? 1.06 : 0.96) + (Math.random() - 0.5) * 0.1;
    if (!this.playBankSample(key, gain, rate, 0, isIndoors)) {
      const t = this.ctx.currentTime;
      this.noise(t, 0.05, surface === 'glass' ? 4600 : surface === 'metal' ? 950 : 320, 'bandpass', gain * 0.4, isIndoors);
    }
  }

  private playBankSample(
    key: SfxBankKey,
    gain: number,
    rate = 1.0,
    delaySec = 0,
    sendRev = false,
    lowpassHz?: number
  ): boolean {
    if (!this.ctx || !this.masterGain || gain <= 0.005) return false;
    const buf = this.sfxBuffers.get(key);
    if (!buf) return false;
    const t = this.ctx.currentTime + Math.max(0, delaySec);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.setValueAtTime(rate, t);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);

    if (lowpassHz && lowpassHz < 18000) {
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(lowpassHz, t);
      src.connect(lp);
      lp.connect(g);
    } else {
      src.connect(g);
    }

    g.connect(this.masterGain);
    if (sendRev && this.reverbSend) g.connect(this.reverbSend);
    src.start(t);
    return true;
  }

  /** Stops any currently playing studio Korean voice dub cleanly */
  public stopVoiceDub(): void {
    this.voiceSeq++;
    for (const s of this.activeVoiceSources) {
      try {
        s.stop();
        s.disconnect();
      } catch {
        // already stopped
      }
    }
    for (const n of this.activeVoiceNodes) {
      try {
        n.disconnect();
      } catch {
        // ignore
      }
    }
    this.activeVoiceSources = [];
    this.activeVoiceNodes = [];
  }

  /**
   * Plays a pre-rendered studio Korean neural voice-actor .mp3 line routed through an authentic
   * military VHF/UHF radio DSP chain (340–3100Hz bandpass, presence EQ, analog soft saturation,
   * quiet radio static floor, and PTT squelch in/out). Returns true if a dub clip matched & played.
   */
  public async playVoiceDub(text: string, sender: CommsSender): Promise<boolean> {
    if (this.muted || !this.ctx || !this.masterGain) return false;
    const clip = findVoiceDubForSubtitle(text);
    if (!clip) return false;

    this.stopVoiceDub();
    const mySeq = this.voiceSeq;
    const ctx = this.ctx;

    try {
      let decoded = this.voiceBuffers.get(clip.id);
      if (!decoded) {
        const res = await fetch(clip.url);
        if (!res.ok) return false;
        const ab = await res.arrayBuffer();
        if (mySeq !== this.voiceSeq || !this.ctx) return true;
        decoded = await ctx.decodeAudioData(ab);
        this.voiceBuffers.set(clip.id, decoded);
      }
      if (mySeq !== this.voiceSeq || this.muted || !this.ctx || !this.masterGain) return true;

      const t = ctx.currentTime;
      // 1) Pre-transmission VHF PTT squelch crackle
      this.playBankSample('radio_squelch_in', 0.34, 0.96 + Math.random() * 0.08, 0, false);

      // 2) Per-character vocal profile (distinct NCO baritone, young trooper, female captain, rogue synth, aviation gunship, cold AI)
      let detuneCents = 0;
      let rate = 1.02;
      let lowBoostDb = 0;
      if (sender === 'arcadia') {
        detuneCents = -520;
        rate = 0.92;
        lowBoostDb = 4.0;
      } else if (sender === 'ghost9') {
        detuneCents = -430;
        rate = 0.95;
        lowBoostDb = 3.0;
      } else if (sender === 'gunship') {
        detuneCents = -250;
        rate = 1.03;
        lowBoostDb = 2.0;
      } else if (sender === 'valkyrie') {
        detuneCents = 35;
        rate = 1.04;
      } else if (clip.voice === 'ko-KR-HyunsuMultilingualNeural') {
        detuneCents = -110;
        rate = 1.07;
      } else {
        // 소재우 중사 (gruff baritone squad sergeant)
        detuneCents = -310;
        rate = 1.05;
        lowBoostDb = 3.4;
      }

      // 3) Military Tactical Radio Bandpass + Formant EQ + Analog Soft Saturation Chain
      const src = ctx.createBufferSource();
      src.buffer = decoded;
      src.playbackRate.setValueAtTime(rate, t);
      if ('detune' in src && src.detune) {
        src.detune.setValueAtTime(detuneCents, t);
      }

      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = sender === 'arcadia' ? 180 : sender === 'gunship' ? 380 : 340;
      hp.Q.value = 0.85;

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = sender === 'arcadia' ? 4200 : sender === 'gunship' ? 2650 : 3150;
      lp.Q.value = 0.8;

      const chest = ctx.createBiquadFilter();
      chest.type = 'lowshelf';
      chest.frequency.value = 480;
      chest.gain.value = lowBoostDb;

      const peak = ctx.createBiquadFilter();
      peak.type = 'peaking';
      peak.frequency.value = sender === 'valkyrie' ? 2100 : 1750;
      peak.Q.value = 1.4;
      peak.gain.value = sender === 'arcadia' ? 2.5 : 4.6;

      const shaper = ctx.createWaveShaper();
      shaper.curve = this.radioCurve;
      shaper.oversample = '2x';

      const voiceOut = ctx.createGain();
      voiceOut.gain.value = 1.2;

      src.connect(hp);
      hp.connect(lp);
      lp.connect(chest);
      chest.connect(peak);
      peak.connect(shaper);
      shaper.connect(voiceOut);
      voiceOut.connect(this.masterGain);

      const nodesToTrack: AudioNode[] = [hp, lp, chest, peak, shaper, voiceOut];
      const sourcesToTrack: AudioBufferSourceNode[] = [src];

      // Chilling metallic comb-delay resonance for OMNI-CORE AI & subtle synthetic doubling for Ghost-9
      if (sender === 'arcadia' || sender === 'ghost9') {
        const combDelay = ctx.createDelay(0.1);
        combDelay.delayTime.value = sender === 'arcadia' ? 0.015 : 0.0085;
        const combGain = ctx.createGain();
        combGain.gain.value = sender === 'arcadia' ? 0.42 : 0.22;
        shaper.connect(combDelay);
        combDelay.connect(combGain);
        combGain.connect(voiceOut);
        if (sender === 'arcadia' && this.reverbSend) voiceOut.connect(this.reverbSend);
        nodesToTrack.push(combDelay, combGain);
      }

      // 4) Subtle VHF static carrier bed synchronized to effective playback duration
      const effectiveRate = rate * Math.pow(2, detuneCents / 1200);
      const effectiveDur = decoded.duration / Math.max(0.5, effectiveRate);
      if (this.noiseBuf) {
        const staticSrc = ctx.createBufferSource();
        staticSrc.buffer = this.noiseBuf;
        staticSrc.loop = true;
        const staticBp = ctx.createBiquadFilter();
        staticBp.type = 'bandpass';
        staticBp.frequency.value = sender === 'gunship' ? 1900 : 2300;
        staticBp.Q.value = 1.6;
        const staticGain = ctx.createGain();
        staticGain.gain.value = 0.022;
        staticSrc.connect(staticBp);
        staticBp.connect(staticGain);
        staticGain.connect(this.masterGain);
        staticSrc.start(t + 0.04);
        staticSrc.stop(t + 0.06 + effectiveDur);
        nodesToTrack.push(staticBp, staticGain);
        sourcesToTrack.push(staticSrc);
      }

      this.activeVoiceNodes = nodesToTrack;
      this.activeVoiceSources = sourcesToTrack;

      src.start(t + 0.05);
      // 5) Post-transmission VHF squelch tail click
      src.onended = () => {
        if (mySeq === this.voiceSeq && !this.muted) {
          this.playBankSample('radio_squelch_out', 0.28, 0.98 + Math.random() * 0.05, 0, false);
        }
      };
      return true;
    } catch {
      return false;
    }
  }

  private startAmbience(): void {
    if (this.ambientStarted || !this.ctx || !this.noiseBuf || !this.masterGain) return;
    this.ambientStarted = true;
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
    const symbiosisChords: number[][] = [
      [196.0, 246.94, 293.66, 369.99],
      [220.0, 277.18, 329.63, 415.3],
      [164.81, 246.94, 293.66, 392.0],
      [246.94, 293.66, 369.99, 493.88],
    ];

    const scheduleNext = () => {
      const bpm =
        this.mood === 'dawn' || this.mood === 'symbiosis'
          ? 64
          : this.mood === 'choice'
            ? 70
            : this.mood === 'opening'
              ? 74
              : this.vatsActive
                ? 72
                : this.mood === 'breach' || this.mood === 'ascension' || this.bossActive
                  ? 138
                  : this.mood === 'escalation'
                    ? 128
                    : 110 + this.combatIntensity * 16;
      const stepMs = (60 / bpm / 4) * 1000;

      if (this.ctx && this.playing && !this.muted && this.bgmFilter) {
        const t = this.ctx.currentTime + 0.015;
        const step = this.bgmStep % 16;

        if (this.mood === 'opening' || this.mood === 'choice') {
          if (step === 0 || step === 8) {
            this.bgmOsc(t, 'sine', 62, 40, 0.52, this.mood === 'choice' ? 0.32 : 0.24);
          }
          if (step === 0) {
            this.bgmPad(t, this.mood === 'choice' ? 110 : 110, 2.2, 0.14);
            if (this.mood === 'choice') this.bgmPad(t, 164.81, 2.2, 0.08);
          }
        } else if (this.mood === 'dawn' || this.mood === 'symbiosis') {
          const bank = this.mood === 'symbiosis' ? symbiosisChords : dawnChords;
          if (step === 0) {
            const chordIdx = Math.floor(this.bgmStep / 16) % bank.length;
            const chord = bank[chordIdx];
            for (const note of chord) {
              this.bgmPad(t, note, 2.8, 0.11);
            }
          }
          if (step === 8) {
            const chordIdx = Math.floor(this.bgmStep / 16) % bank.length;
            const top = bank[chordIdx][3] * 2;
            this.bgmPad(t, top, 1.25, 0.06);
          }
        } else if (this.mood === 'ascension') {
          if (step === 0 || step === 8) {
            this.bgmOsc(t, 'sawtooth', 55, 48, 0.9, 0.32);
            this.bgmOsc(t, 'sine', 92, 28, 0.45, 0.62);
          }
          if (step === 0) {
            this.bgmPad(t, 110, 2.4, 0.18);
            this.bgmPad(t, 155.56, 2.4, 0.14);
            this.bgmPad(t, 220, 2.4, 0.1);
          }
        } else {
          const isBreach =
            this.mood === 'breach' || this.mood === 'escalation' || this.bossActive;
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
    type: 'rifle' | 'shotgun' | 'railgun' | 'rocket' | 'flamer' | 'tesla' | 'robot_laser',
    vol = 1.0,
    opts?: { isIndoors?: boolean; distanceM?: number }
  ): void {
    if (!this.ctx || this.muted || vol < 0.03) return;
    const t = this.ctx.currentTime;
    const v = Math.min(1, vol);
    const pitchVar = 0.94 + Math.random() * 0.12;
    const isIndoors = Boolean(opts?.isIndoors);
    const distM = opts?.distanceM ?? 0;
    // High-frequency air absorption & close-punch rolloff for distant gunfire
    const closeFactor = Math.max(0.18, 1 - distM / 38);
    const distLp = distM > 8 ? Math.max(1150, 14000 - distM * 240) : undefined;

    if (type === 'rifle') {
      const playedPunch = this.playBankSample('rifle_punch', 0.95 * v * closeFactor, pitchVar, 0, false, distLp);
      if (isIndoors) {
        this.playBankSample('rifle_tail_indoor', 0.82 * v, 0.97 + Math.random() * 0.06, 0.004, false, distLp);
        this.playBankSample('rifle_tail_outdoor', 0.22 * v, pitchVar, 0.025, false, 1400);
      } else {
        this.playBankSample('rifle_tail_outdoor', 0.72 * v, pitchVar, 0.01, false, distLp);
      }
      if (!playedPunch) {
        this.noise(t, 0.11, 1650 * pitchVar, 'bandpass', 0.72 * v, true);
        this.osc(t, 'triangle', 180 * pitchVar, 42, 0.11, 0.64 * v, true);
      }
    } else if (type === 'shotgun') {
      const playedPunch = this.playBankSample('shotgun_punch', 1.05 * v * closeFactor, pitchVar, 0, false, distLp);
      if (isIndoors) {
        this.playBankSample('shotgun_tail_indoor', 0.88 * v, 0.96 + Math.random() * 0.07, 0.005, false, distLp);
      } else {
        this.playBankSample('shotgun_tail_outdoor', 0.82 * v, pitchVar, 0.012, false, distLp);
      }
      if (!playedPunch) {
        this.noise(t, 0.34, 820 * pitchVar, 'lowpass', 1.15 * v, true);
        this.osc(t, 'sine', 148, 24, 0.3, 1.05 * v, true);
      }
    } else if (type === 'railgun') {
      const playedPunch = this.playBankSample('sniper_punch', 1.02 * v * closeFactor, pitchVar, 0, false, distLp);
      if (isIndoors) {
        this.playBankSample('rifle_tail_indoor', 0.86 * v, 0.82, 0.006, false, distLp);
      } else {
        this.playBankSample('sniper_tail_outdoor', 0.85 * v, pitchVar, 0.012, false, distLp);
      }
      if (!playedPunch) {
        this.noise(t, 0.42, 2600, 'highpass', 0.9 * v, true);
        this.osc(t, 'sawtooth', 1480, 52, 0.44, 0.85 * v, true);
      }
    } else if (type === 'rocket') {
      if (!this.playBankSample('rocket_launch', 1.0 * v, 0.96 + Math.random() * 0.08, 0, true)) {
        this.noise(t, 0.48, 700, 'bandpass', 0.88 * v, true);
        this.osc(t, 'sawtooth', 165, 52, 0.36, 0.76 * v, false);
      }
    } else if (type === 'flamer') {
      this.noise(t, 0.14, 480 * pitchVar, 'bandpass', 0.48 * v, false);
      this.noise(t, 0.12, 1800, 'highpass', 0.14 * v, false);
    } else if (type === 'tesla') {
      this.noise(t, 0.18, 3800 * pitchVar, 'highpass', 0.68 * v, true);
      this.osc(t, 'sawtooth', 1960 * pitchVar, 240, 0.18, 0.46 * v, true);
      this.osc(t + 0.03, 'square', 680 * pitchVar, 180, 0.14, 0.32 * v, false);
      this.osc(t, 'sine', 140, 48, 0.14, 0.44 * v, false);
    } else if (type === 'robot_laser') {
      this.osc(t, 'sawtooth', 860 * pitchVar, 160, 0.14, 0.38 * v, true);
      this.noise(t, 0.08, 2200, 'bandpass', 0.25 * v, false);
    }
  }

  public playDash(isSlide = false): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    if (isSlide) {
      this.noise(t, 0.38, 1250, 'bandpass', 0.42, false);
      this.osc(t, 'triangle', 190, 62, 0.28, 0.35, false);
    } else {
      this.noise(t, 0.24, 2100, 'highpass', 0.48, true);
      this.osc(t, 'sawtooth', 520, 120, 0.22, 0.36, true);
      this.osc(t, 'sine', 240, 58, 0.24, 0.48, false);
    }
  }

  public playThreatUp(level: number): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const base = 340 + level * 65;
    this.osc(t, 'sawtooth', base, base * 0.5, 0.48, 0.34, true);
    this.osc(t, 'sine', 130, 36, 0.55, 0.65, true);
    this.osc(t + 0.08, 'square', base * 1.5, base * 1.5, 0.09, 0.2, false);
    this.osc(t + 0.2, 'square', base * 2.0, base * 2.0, 0.14, 0.22, true);
  }

  public playTurretHack(): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const notes = [660, 880, 1100, 1568];
    notes.forEach((f, idx) => {
      this.osc(t + idx * 0.065, 'square', f, f, 0.055, 0.2, false);
    });
    this.noise(t + 0.25, 0.14, 2400, 'bandpass', 0.25, true);
  }

  public playSupplyDrop(): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.osc(t, 'sine', 1100, 180, 0.65, 0.36, true);
    this.noise(t + 0.55, 0.45, 580, 'lowpass', 0.72, true);
    this.osc(t + 0.55, 'sine', 120, 28, 0.42, 0.75, true);
  }

  public playSniperLock(): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.osc(t, 'sine', 1420, 2240, 0.22, 0.14, false);
  }

  public playAdrenalineSurge(): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.osc(t, 'sine', 380, 32, 0.95, 0.85, true);
    this.noise(t, 0.42, 620, 'lowpass', 0.55, true);
    this.playHeartbeat(1.0);
  }

  public playEndingChord(ending: EndingId): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    if (ending === 'dawn') {
      this.playDawnChime();
    } else if (ending === 'symbiosis') {
      const freqs = [196, 246.94, 293.66, 369.99, 493.88, 587.33];
      freqs.forEach((f, idx) => {
        this.osc(t + idx * 0.16, 'triangle', f, f * 1.003, 3.2, 0.15, true);
      });
    } else {
      // Dark sovereign brass braaam
      this.playBraaam();
      this.osc(t + 0.18, 'sawtooth', 110, 82.4, 2.6, 0.35, true);
      this.osc(t + 0.18, 'sawtooth', 155.56, 123.47, 2.6, 0.25, true);
    }
  }

  public playExplosion(vol = 1.0, nearPlayer = false, isEmp = false): void {
    if (!this.ctx || this.muted || vol < 0.03) return;
    const t = this.ctx.currentTime;
    const v = Math.min(1.2, vol);
    const rate = 0.92 + Math.random() * 0.16;
    const playedClose = nearPlayer || v > 0.55
      ? this.playBankSample('explosion_close', 1.05 * v, rate, 0, false)
      : false;
    const playedDistant = this.playBankSample('explosion_distant', (nearPlayer ? 0.65 : 0.95) * v, rate * 0.96, 0.02, false);
    if (!playedClose && !playedDistant) {
      this.noise(t, 0.88, 400, 'lowpass', 1.25 * v, true);
      this.noise(t + 0.04, 0.55, 1100, 'bandpass', 0.72 * v, true);
      this.osc(t, 'sine', 112, 16, 0.78, 1.25 * v, true);
    }

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

  public playShellClink(gainScale = 1.0): void {
    if (!this.ctx || this.muted || gainScale <= 0.04) return;
    const t = this.ctx.currentTime;
    const baseFreq = 3950 + Math.random() * 1150;
    const g = Math.min(0.11, 0.068 * gainScale);
    this.osc(t, 'sine', baseFreq, baseFreq * 0.84, 0.045, g, false);
    this.osc(t + 0.008, 'triangle', baseFreq * 1.32, baseFreq * 1.12, 0.028, g * 0.45, false);
  }

  /** Solid tactile steel-brace lock click when mounting/unmounting weapon on cover or wall corner */
  public playMountClick(mounting: boolean): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.noise(t, 0.036, mounting ? 2400 : 1450, 'bandpass', 0.14, false);
    this.osc(t, 'triangle', mounting ? 340 : 280, mounting ? 580 : 175, 0.055, 0.12, false);
    if (mounting) {
      this.osc(t + 0.022, 'sine', 1120, 880, 0.032, 0.08, false);
    }
  }

  public playReload(durationSec = 1.4, weaponIdx = 0, isTactical = false): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;

    // Prioritize real mechanical metallic reload foley samples when loaded
    if (this.sfxBuffers.has('reload_mag_out') && this.sfxBuffers.has('reload_mag_in')) {
      if (weaponIdx === 1) {
        this.playBankSample('reload_mag_out', 0.68, 0.88, 0.02);
        this.playBankSample('reload_shell_load', 0.78, 1.0, durationSec * 0.42);
        if (!isTactical) {
          this.playBankSample('reload_shell_load', 0.78, 1.05, durationSec * 0.6);
          this.playBankSample('reload_bolt_rack', 0.88, 0.85, durationSec * 0.78);
        }
        return;
      }
      this.playBankSample('reload_mag_out', 0.72, 0.96 + Math.random() * 0.08, 0.02);
      this.playBankSample(
        'reload_mag_in',
        0.84,
        0.96 + Math.random() * 0.08,
        Math.max(0.24, durationSec * (isTactical ? 0.68 : 0.58))
      );
      if (!isTactical) {
        this.playBankSample(
          'reload_bolt_rack',
          0.9,
          weaponIdx === 2 ? 0.86 : 1.0,
          Math.max(0.5, durationSec * 0.78)
        );
      }
      return;
    }

    if (isTactical) {
      this.osc(t, 'square', 420, 220, 0.05, 0.2, false);
      this.noise(t + 0.02, 0.075, 2100, 'bandpass', 0.16, false);
      const seat = Math.max(0.24, durationSec * 0.72);
      this.osc(t + seat, 'triangle', 560, 880, 0.065, 0.25, false);
      this.noise(t + seat, 0.05, 2900, 'highpass', 0.18, false);
      this.osc(t + durationSec * 0.88, 'sine', 1180, 1480, 0.07, 0.12, false);
      return;
    }

    if (weaponIdx === 1) {
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

    if (weaponIdx === 2 || weaponIdx === 5) {
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
    } else if (sender === 'valkyrie') {
      // Crisp military orbital radio squelch + warm dual-tone ping
      this.noise(t, 0.045, 2800, 'bandpass', 0.15, false);
      this.osc(t + 0.03, 'triangle', 880, 1175, 0.065, 0.18, false);
      this.osc(t + 0.1, 'sine', 1318, 1318, 0.08, 0.14, true);
    } else if (sender === 'ghost9') {
      // Digital stealth cipher glitch chirp
      this.osc(t, 'square', 520, 1040, 0.04, 0.14, false);
      this.osc(t + 0.05, 'triangle', 1560, 780, 0.07, 0.16, true);
      this.noise(t + 0.02, 0.04, 4200, 'highpass', 0.09, false);
    } else if (sender === 'squad') {
      // Authentic crunchy ROK military walkie-talkie PTT squelch
      this.noise(t, 0.055, 2600, 'bandpass', 0.22, false);
      this.osc(t + 0.01, 'square', 980, 740, 0.025, 0.09, false);
    } else if (sender === 'gunship') {
      // AC-130 aviation intercom clean dual-beep
      this.osc(t, 'sine', 1320, 1320, 0.04, 0.12, false);
      this.osc(t + 0.055, 'sine', 1680, 1680, 0.045, 0.11, false);
      this.noise(t, 0.03, 3200, 'bandpass', 0.08, false);
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

  /** Subtle mechanical tactile snap when snapping into / out of weapon optics */
  public playAdsClick(entering: boolean): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.noise(t, 0.032, entering ? 2800 : 1900, 'bandpass', 0.09, false);
    this.osc(t, 'triangle', entering ? 680 : 480, entering ? 980 : 320, 0.045, 0.06, false);
  }

  /** Crisp Call of Duty–style tactical combat medal confirmation ping */
  public playMedalStinger(isMajor = false): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.osc(t, 'triangle', isMajor ? 587.33 : 659.25, isMajor ? 880 : 987.77, 0.11, 0.13, true);
    if (isMajor) {
      this.osc(t + 0.075, 'sine', 880, 1174.66, 0.22, 0.15, true);
    }
  }

  /** AC-130 Gunship 25mm GAU-12 / 40mm Bofors / 105mm Howitzer iconic cabin-muffled artillery audio */
  public playAc130Cannon(caliber: '25mm' | '40mm' | '105mm'): void {
    if (!this.ctx || this.muted) return;
    const key: SfxBankKey =
      caliber === '25mm' ? 'ac130_25mm' : caliber === '40mm' ? 'ac130_40mm' : 'ac130_105mm';
    if (this.playBankSample(key, caliber === '105mm' ? 1.15 : caliber === '40mm' ? 0.96 : 0.72, 0.96 + Math.random() * 0.08)) {
      return;
    }
    const t = this.ctx.currentTime;
    if (caliber === '25mm') {
      this.noise(t, 0.09, 1450, 'bandpass', 0.44, false);
      this.osc(t, 'sawtooth', 260, 72, 0.08, 0.38, false);
    } else if (caliber === '40mm') {
      this.osc(t, 'sine', 152, 34, 0.28, 0.82, true);
      this.noise(t, 0.24, 640, 'lowpass', 0.64, true);
      this.osc(t + 0.05, 'triangle', 420, 160, 0.09, 0.24, false);
    } else {
      this.osc(t, 'sine', 108, 16, 0.72, 1.15, true);
      this.noise(t, 0.65, 340, 'lowpass', 0.96, true);
      this.osc(t + 0.22, 'sine', 880, 320, 0.48, 0.12, true);
      this.osc(t + 0.34, 'triangle', 1420, 960, 0.12, 0.14, false);
    }
  }

  /** Slow-mo C4 Breach & Clear sub-bass detonation + flying steel door screech */
  public playBreachBlast(): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.osc(t, 'sine', 140, 18, 1.35, 1.15, true);
    this.noise(t, 1.15, 420, 'lowpass', 0.95, true);
    this.osc(t + 0.06, 'sawtooth', 620, 88, 0.85, 0.38, true);
  }

  /** Subtle quiet Call of Duty "체크포인트 도달" two-tone confirmation pulse */
  public playCheckpointChime(): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.osc(t, 'sine', 523.25, 523.25, 0.12, 0.08, true);
    this.osc(t + 0.11, 'sine', 783.99, 783.99, 0.24, 0.09, true);
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
    this.stopVoiceDub();
    if (this.heliSource) {
      try {
        this.heliSource.stop();
      } catch {
        // ignore
      }
      this.heliSource = null;
    }
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
