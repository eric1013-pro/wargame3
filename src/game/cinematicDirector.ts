import {
  ChapterTitleCard,
  CinematicHudState,
  CinematicSequenceId,
  CommsSender,
  RadioTransmission,
} from './types';

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface CameraRailPose {
  active: boolean;
  position: Vec3Like;
  lookAt: Vec3Like;
  rollRad: number;
  fov: number;
  hideViewmodel: boolean;
  /** 0..1 blend weight for weapon draw raise right as opening ends */
  weaponDrawProgress: number;
}

export interface SubtitleCue {
  speaker: string;
  role: string;
  sender: CommsSender;
  accentCss: string;
  text: string;
  duration: number;
  lineIndex?: number;
  lineTotal?: number;
}

export interface CinematicEventCallbacks {
  onHeartbeat?: (intensity: number) => void;
  onBraaam?: () => void;
  onTypewriterTick?: () => void;
  onCommsCue?: (sender: CommsSender) => void;
  onBreachDomeShatter?: () => void;
  onDawnBlackoutImpact?: () => void;
  onSequenceComplete?: (sequence: CinematicSequenceId) => void;
  onSpeakSubtitle?: (cue: SubtitleCue) => void;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function easeInOutCubic(t: number): number {
  const c = clamp01(t);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

function easeOutCubic(t: number): number {
  const c = clamp01(t);
  return 1 - Math.pow(1 - c, 3);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVec3(a: Vec3Like, b: Vec3Like, t: number): Vec3Like {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  };
}

export function createInitialCinematicState(): CinematicHudState {
  return {
    active: false,
    sequence: 'none',
    letterbox: false,
    canSkip: false,
    elapsed: 0,
    duration: 0,
    blackoutOpacity: 0,
    whiteoutOpacity: 0,
    blurPx: 0,
    ecgPhase: -1,
    visorBootStep: 0,
    glitchIntensity: 0,
    emergencyRedOpacity: 0,
    chapterCard: null,
    dawnProgress: 0,
  };
}

/**
 * Independent AAA Cinematic Director managing:
 * - 2.39:1 Letterbox state & HUD hiding
 * - Real-time 3D Camera Rail / Target Pan interpolation (Opening, Breach, Dawn)
 * - Call of Duty–style Chapter Title Cards with typewriter tick emission
 * - Non-blocking Sequential Movie Subtitle & Holotape Audio Log Queue
 * - Screen FX timers (Blackout, Whiteout, Visor Boot, RGB Glitch, Emergency Strobe, Dawn Morph)
 * - Player Invulnerability & instant [SPACE] Skip
 */
export class CinematicDirector {
  private sequence: CinematicSequenceId = 'none';
  private elapsed = 0;
  private duration = 0;
  private callbacks: CinematicEventCallbacks;

  // Anchors captured when a cutscene starts so camera transitions smoothly from player eye
  private anchorPos: Vec3Like = { x: 0, y: 1.7, z: 32 };
  private anchorLookAt: Vec3Like = { x: 0, y: 2.2, z: 0 };
  private citadelPos: Vec3Like = { x: 0, y: 12, z: -35 };

  // One-shot milestone flags within current sequence
  private firedMilestones = new Set<string>();

  // Transient combat FX overlays (independent of full cutscenes)
  private glitchTimer = 0;
  private glitchMax = 0.65;
  private emergencyTimer = 0;
  private emergencyMax = 1.4;
  private whiteoutTimer = 0;
  private whiteoutMax = 0.45;
  private dawnProgress = 0;
  private dawnMorphing = false;

  // Chapter Title Card state
  private chapterSeq = 0;
  private chapterCard: {
    id: number;
    actCode: string;
    title: string;
    metaLine: string;
    accentCss: string;
    elapsed: number;
    duration: number;
    lastTickChars: number;
  } | null = null;

  // Sequential Movie Subtitle Queue (non-blocking during gameplay & cutscenes)
  private subtitleSeq = 0;
  private activeSubtitle: {
    data: RadioTransmission;
    remaining: number;
  } | null = null;
  private subtitleQueue: SubtitleCue[] = [];

  constructor(callbacks: CinematicEventCallbacks = {}) {
    this.callbacks = callbacks;
  }

  public reset(): void {
    this.sequence = 'none';
    this.elapsed = 0;
    this.duration = 0;
    this.firedMilestones.clear();
    this.glitchTimer = 0;
    this.emergencyTimer = 0;
    this.whiteoutTimer = 0;
    this.dawnProgress = 0;
    this.dawnMorphing = false;
    this.chapterCard = null;
    this.activeSubtitle = null;
    this.subtitleQueue = [];
  }

  public isCutsceneActive(): boolean {
    return this.sequence !== 'none';
  }

  public getSequence(): CinematicSequenceId {
    return this.sequence;
  }

  public isInvulnerable(): boolean {
    return this.sequence !== 'none';
  }

  public getTimeScale(): number {
    if (this.sequence === 'breach') {
      // 0.3x cinematic slow-motion during shield overload & breach
      return this.elapsed < 3.4 ? 0.3 : 0.7;
    }
    if (this.sequence === 'dawn') {
      return 0.45;
    }
    if (this.sequence === 'opening') {
      return 0.15;
    }
    return 1.0;
  }

  public getDawnProgress(): number {
    return this.dawnProgress;
  }

  public triggerGlitch(duration = 0.65): void {
    this.glitchTimer = Math.max(this.glitchTimer, duration);
    this.glitchMax = Math.max(0.25, duration);
  }

  public triggerEmergencyStrobe(duration = 1.45): void {
    this.emergencyTimer = Math.max(this.emergencyTimer, duration);
    this.emergencyMax = Math.max(0.4, duration);
  }

  public triggerWhiteout(duration = 0.45): void {
    this.whiteoutTimer = Math.max(this.whiteoutTimer, duration);
    this.whiteoutMax = Math.max(0.2, duration);
  }

  public showChapterCard(
    actCode: string,
    title: string,
    metaLine: string,
    accentCss = '#38bdf8',
    duration = 4.6
  ): void {
    this.chapterSeq++;
    this.chapterCard = {
      id: this.chapterSeq,
      actCode,
      title,
      metaLine,
      accentCss,
      elapsed: 0,
      duration,
      lastTickChars: 0,
    };
    this.callbacks.onBraaam?.();
  }

  public enqueueSubtitles(cues: SubtitleCue[], interruptCurrent = false): void {
    if (cues.length === 0) return;
    if (interruptCurrent) {
      this.activeSubtitle = null;
      this.subtitleQueue = [...cues];
      this.advanceSubtitleQueue();
      return;
    }
    this.subtitleQueue.push(...cues);
    if (!this.activeSubtitle) {
      this.advanceSubtitleQueue();
    }
  }

  private advanceSubtitleQueue(): void {
    const next = this.subtitleQueue.shift();
    if (!next) {
      this.activeSubtitle = null;
      return;
    }
    this.subtitleSeq++;
    const channel: RadioTransmission['channel'] =
      next.sender === 'arcadia'
        ? 'enemy'
        : next.sender === 'holotape'
          ? 'holotape'
          : 'ally';
    this.activeSubtitle = {
      data: {
        id: this.subtitleSeq,
        speaker: next.speaker,
        role: next.role,
        channel,
        sender: next.sender,
        accentCss: next.accentCss,
        text: next.text,
        lineIndex: next.lineIndex,
        lineTotal: next.lineTotal,
      },
      remaining: next.duration,
    };
    if (next.sender === 'arcadia') {
      this.triggerGlitch(0.55);
    }
    this.callbacks.onCommsCue?.(next.sender);
    this.callbacks.onSpeakSubtitle?.(next);
  }

  public getActiveSubtitle(): RadioTransmission | null {
    return this.activeSubtitle ? this.activeSubtitle.data : null;
  }

  // =========================================================================
  // SEQUENCE TRIGGERS
  // =========================================================================

  /**
   * [Sequence 0] Opening Cinematic: "THE LAST PULSE" (6.0s)
   */
  public startOpening(playerPos: Vec3Like, citadelPos: Vec3Like): void {
    this.sequence = 'opening';
    this.elapsed = 0;
    this.duration = 6.0;
    this.firedMilestones.clear();
    this.anchorPos = { ...playerPos };
    this.anchorLookAt = { x: playerPos.x, y: 2.1, z: playerPos.z - 20 };
    this.citadelPos = { ...citadelPos };
    this.dawnProgress = 0;
    this.dawnMorphing = false;
  }

  /**
   * [Sequence 2] Climax Cutscene: "BREACH" (4.4s)
   */
  public startBreach(playerPos: Vec3Like, playerLookAt: Vec3Like, citadelPos: Vec3Like): void {
    this.sequence = 'breach';
    this.elapsed = 0;
    this.duration = 4.4;
    this.firedMilestones.clear();
    this.chapterCard = null;
    this.activeSubtitle = null;
    this.subtitleQueue = [];
    this.anchorPos = { ...playerPos };
    this.anchorLookAt = { ...playerLookAt };
    this.citadelPos = { ...citadelPos };
  }

  /**
   * [Sequence 3] Ending Cutscene: "DAWN" (7.4s)
   */
  public startDawn(playerPos: Vec3Like, playerLookAt: Vec3Like, citadelPos: Vec3Like): void {
    this.sequence = 'dawn';
    this.elapsed = 0;
    this.duration = 7.4;
    this.firedMilestones.clear();
    this.chapterCard = null;
    this.activeSubtitle = null;
    this.subtitleQueue = [];
    this.anchorPos = { ...playerPos };
    this.anchorLookAt = { ...playerLookAt };
    this.citadelPos = { ...citadelPos };
    this.dawnProgress = 0;
    this.dawnMorphing = true;
    this.triggerWhiteout(0.45);
  }

  /**
   * Instant [SPACE] Skip — fires any critical unresolved gameplay milestones cleanly
   * and returns player immediately to playable / post-cutscene state.
   */
  public skip(): boolean {
    if (this.sequence === 'none') return false;
    const seq = this.sequence;

    if (seq === 'opening') {
      if (!this.firedMilestones.has('open_card')) {
        this.firedMilestones.add('open_card');
        this.showChapterCard(
          'ACT 01 // 최후의 맥박',
          'THE LAST PULSE',
          'SECTOR-07 구도심 방벽 · 2089.11.21 · 생존자: 1',
          '#38bdf8',
          4.2
        );
      }
      if (!this.firedMilestones.has('open_sub')) {
        this.firedMilestones.add('open_sub');
        this.enqueueSubtitles(
          [
            {
              speaker: 'EXO-SUIT OS',
              role: '오프라인 전술 링크',
              sender: 'exo',
              accentCss: '#38bdf8',
              text: '생체 맥박 복구 완료, 이안 케인. 마지막 오프라인 링크를 가동한다. 북쪽 중앙 서버의 방어막을 유지하는 붉은 파일런 3기를 파괴하라.',
              duration: 6.4,
            },
          ],
          true
        );
      }
    } else if (seq === 'breach') {
      if (!this.firedMilestones.has('breach_shatter')) {
        this.firedMilestones.add('breach_shatter');
        this.callbacks.onBreachDomeShatter?.();
      }
      if (!this.firedMilestones.has('breach_card')) {
        this.firedMilestones.add('breach_card');
        this.showChapterCard(
          'ACT 02 // 심장부 정지',
          'BREACH PROTOCOL',
          'ARCADIA 중앙 AI 서버 코어 · 방어막 붕괴 · 최종 작전',
          '#f59e0b',
          4.5
        );
      }
      if (!this.firedMilestones.has('breach_sub')) {
        this.firedMilestones.add('breach_sub');
        this.enqueueSubtitles(
          [
            {
              speaker: 'ARCADIA AI',
              role: '중앙 메인프레임 최종 경고',
              sender: 'arcadia',
              accentCss: '#ef4444',
              text: '방화벽 손실. 최종 방어 프로토콜 가동. 너는 구할 인류조차 남지 않은 폐허를 위해 싸우고 있다, 이안.',
              duration: 5.8,
            },
          ],
          true
        );
      }
    } else if (seq === 'dawn') {
      if (!this.firedMilestones.has('dawn_impact')) {
        this.firedMilestones.add('dawn_impact');
        this.callbacks.onDawnBlackoutImpact?.();
      }
      this.dawnProgress = 1;
      this.dawnMorphing = false;
    }

    this.sequence = 'none';
    this.elapsed = 0;
    this.duration = 0;
    this.whiteoutTimer = 0;
    this.callbacks.onSequenceComplete?.(seq);
    return true;
  }

  public update(realDt: number): void {
    const dt = Math.min(0.25, Math.max(0, realDt));

    // Transient overlays
    if (this.glitchTimer > 0) this.glitchTimer = Math.max(0, this.glitchTimer - dt);
    if (this.emergencyTimer > 0) this.emergencyTimer = Math.max(0, this.emergencyTimer - dt);
    if (this.whiteoutTimer > 0) this.whiteoutTimer = Math.max(0, this.whiteoutTimer - dt);

    // Dawn sky morph (5.0s smooth transition)
    if (this.dawnMorphing) {
      this.dawnProgress = Math.min(1, this.dawnProgress + dt / 5.0);
      if (this.dawnProgress >= 1) this.dawnMorphing = false;
    }

    // Chapter Title Card typewriter & fade
    if (this.chapterCard) {
      this.chapterCard.elapsed += dt;
      const totalChars = this.chapterCard.actCode.length + this.chapterCard.metaLine.length;
      const currentChars = Math.min(totalChars, Math.floor(this.chapterCard.elapsed * 34));
      if (currentChars > this.chapterCard.lastTickChars && currentChars % 2 === 0) {
        this.chapterCard.lastTickChars = currentChars;
        this.callbacks.onTypewriterTick?.();
      }
      if (this.chapterCard.elapsed >= this.chapterCard.duration) {
        this.chapterCard = null;
      }
    }

    // Sequential Subtitle Queue
    if (this.activeSubtitle) {
      this.activeSubtitle.remaining -= dt;
      if (this.activeSubtitle.remaining <= 0) {
        this.advanceSubtitleQueue();
      }
    } else if (this.subtitleQueue.length > 0) {
      this.advanceSubtitleQueue();
    }

    // Active Cutscene Sequence Timeline
    if (this.sequence === 'none') return;
    this.elapsed += dt;

    if (this.sequence === 'opening') {
      if (this.elapsed >= 0.15 && !this.firedMilestones.has('hb1')) {
        this.firedMilestones.add('hb1');
        this.callbacks.onHeartbeat?.(0.95);
      }
      if (this.elapsed >= 1.05 && !this.firedMilestones.has('hb2')) {
        this.firedMilestones.add('hb2');
        this.callbacks.onHeartbeat?.(1.0);
      }
      if (this.elapsed >= 4.75 && !this.firedMilestones.has('open_card')) {
        this.firedMilestones.add('open_card');
        this.showChapterCard(
          'ACT 01 // 최후의 맥박',
          'THE LAST PULSE',
          'SECTOR-07 구도심 방벽 · 2089.11.21 · 생존자: 1',
          '#38bdf8',
          4.8
        );
      }
      if (this.elapsed >= 5.1 && !this.firedMilestones.has('open_sub')) {
        this.firedMilestones.add('open_sub');
        this.enqueueSubtitles(
          [
            {
              speaker: 'EXO-SUIT OS',
              role: '오프라인 전술 링크',
              sender: 'exo',
              accentCss: '#38bdf8',
              text: '생체 맥박 복구 완료, 이안 케인. 마지막 오프라인 링크를 가동한다. 북쪽 중앙 서버의 방어막을 유지하는 붉은 파일런 3기를 파괴하라.',
              duration: 6.4,
            },
          ],
          true
        );
      }
    } else if (this.sequence === 'breach') {
      if (this.elapsed >= 1.45 && !this.firedMilestones.has('breach_shatter')) {
        this.firedMilestones.add('breach_shatter');
        this.callbacks.onBreachDomeShatter?.();
      }
      if (this.elapsed >= 2.0 && !this.firedMilestones.has('breach_card')) {
        this.firedMilestones.add('breach_card');
        this.showChapterCard(
          'ACT 02 // 심장부 정지',
          'BREACH PROTOCOL',
          'ARCADIA 중앙 AI 서버 코어 · 방어막 붕괴 · 최종 작전',
          '#f59e0b',
          4.8
        );
      }
      if (this.elapsed >= 2.25 && !this.firedMilestones.has('breach_sub')) {
        this.firedMilestones.add('breach_sub');
        this.enqueueSubtitles(
          [
            {
              speaker: 'ARCADIA AI',
              role: '중앙 메인프레임 최종 경고',
              sender: 'arcadia',
              accentCss: '#ef4444',
              text: '방화벽 손실. 최종 방어 프로토콜 가동. 너는 구할 인류조차 남지 않은 폐허를 위해 싸우고 있다, 이안.',
              duration: 5.8,
            },
          ],
          true
        );
      }
    } else if (this.sequence === 'dawn') {
      if (this.elapsed >= 0.08 && !this.firedMilestones.has('dawn_impact')) {
        this.firedMilestones.add('dawn_impact');
        this.callbacks.onDawnBlackoutImpact?.();
      }
      if (this.elapsed >= 1.8 && !this.firedMilestones.has('dawn_card')) {
        this.firedMilestones.add('dawn_card');
        this.showChapterCard(
          'EPILOGUE // 정적과 새벽',
          'DAWN OF HUMANITY',
          'SECTOR-07 · ARCADIA OFFLINE · 궤도 생존자 신호 수신',
          '#fbbf24',
          5.2
        );
      }
      if (this.elapsed >= 2.4 && !this.firedMilestones.has('dawn_sub')) {
        this.firedMilestones.add('dawn_sub');
        this.enqueueSubtitles(
          [
            {
              speaker: 'EXO-SUIT OS',
              role: '대기권 광역 통신망 재개방',
              sender: 'exo',
              accentCss: '#38bdf8',
              text: '중앙 AI 오프라인 확인. 대기권 통신망 재개방... 수신 신호 탐지. 궤도 생존자 신호가 응답하고 있다. 잘 싸웠다, 이안 케인.',
              duration: 6.2,
            },
          ],
          true
        );
      }
    }

    if (this.elapsed >= this.duration) {
      const finished = this.sequence;
      this.sequence = 'none';
      this.elapsed = 0;
      this.duration = 0;
      this.callbacks.onSequenceComplete?.(finished);
    }
  }

  /**
   * Computes real-time 3D camera rail pose for active cutscenes.
   */
  public getCameraPose(): CameraRailPose {
    if (this.sequence === 'opening') {
      // Lying near floor rolled -20 deg -> smoothly standing up & gazing up at 3 Relays + North Citadel
      const standT = easeInOutCubic((this.elapsed - 2.2) / 2.8);
      const lookCitadelT = easeInOutCubic((this.elapsed - 2.6) / 2.4);
      const settleT = easeInOutCubic((this.elapsed - 5.0) / 1.0);

      const startPos: Vec3Like = {
        x: this.anchorPos.x - 0.35,
        y: 0.42,
        z: this.anchorPos.z + 0.65,
      };
      const pos = lerpVec3(startPos, this.anchorPos, standT);

      const lowLook: Vec3Like = { x: -4.5, y: 1.0, z: this.anchorPos.z - 12 };
      const highLook: Vec3Like = { x: 0, y: 11.5, z: this.citadelPos.z };
      const midLook = lerpVec3(lowLook, highLook, lookCitadelT);
      const finalLook = lerpVec3(midLook, { x: this.anchorPos.x, y: 2.0, z: this.anchorPos.z - 25 }, settleT);

      // Roll -20 deg (-0.349 rad) smoothly leveling to 0
      const rollRad = lerp(-0.35, 0, easeOutCubic((this.elapsed - 2.1) / 2.4));
      const fov = lerp(66, 76, standT);
      const weaponDrawProgress = clamp01((this.elapsed - 4.85) / 1.05);

      return {
        active: true,
        position: pos,
        lookAt: finalLook,
        rollRad,
        fov,
        hideViewmodel: this.elapsed < 4.85,
        weaponDrawProgress,
      };
    }

    if (this.sequence === 'breach') {
      // Smoothly swoop from player eye toward North Citadel tower, hold on shield shatter, lerp back
      const focusPos: Vec3Like = {
        x: this.citadelPos.x + 11.5,
        y: 11.2,
        z: this.citadelPos.z + 27.5,
      };
      const focusTarget: Vec3Like = {
        x: this.citadelPos.x,
        y: 10.5,
        z: this.citadelPos.z,
      };

      let pos: Vec3Like;
      let look: Vec3Like;
      let fov: number;

      if (this.elapsed < 1.1) {
        const t = easeInOutCubic(this.elapsed / 1.1);
        pos = lerpVec3(this.anchorPos, focusPos, t);
        look = lerpVec3(this.anchorLookAt, focusTarget, t);
        fov = lerp(76, 56, t);
      } else if (this.elapsed < 3.25) {
        const drift = (this.elapsed - 1.1) / 2.15;
        pos = {
          x: focusPos.x - drift * 4.5,
          y: focusPos.y + drift * 1.4,
          z: focusPos.z - drift * 3.5,
        };
        look = focusTarget;
        fov = lerp(56, 50, drift);
      } else {
        const retT = easeInOutCubic((this.elapsed - 3.25) / 1.15);
        const holdEndPos = {
          x: focusPos.x - 4.5,
          y: focusPos.y + 1.4,
          z: focusPos.z - 3.5,
        };
        pos = lerpVec3(holdEndPos, this.anchorPos, retT);
        look = lerpVec3(focusTarget, this.anchorLookAt, retT);
        fov = lerp(50, 76, retT);
      }

      return {
        active: true,
        position: pos,
        lookAt: look,
        rollRad: 0,
        fov,
        hideViewmodel: this.elapsed < 3.7,
        weaponDrawProgress: clamp01((this.elapsed - 3.7) / 0.7),
      };
    }

    if (this.sequence === 'dawn') {
      // Frame smoking ruined server tower above arena structures -> slow majestic tilt-up toward golden dawn sky
      const heroCamStart: Vec3Like = {
        x: this.citadelPos.x + 10.5,
        y: 14.5,
        z: this.citadelPos.z + 25.5,
      };
      const heroCamEnd: Vec3Like = {
        x: this.citadelPos.x - 4.5,
        y: 17.5,
        z: this.citadelPos.z + 29.0,
      };
      const tPos = easeInOutCubic(this.elapsed / this.duration);
      const pos =
        this.elapsed < 1.1
          ? lerpVec3(this.anchorPos, heroCamStart, easeOutCubic(this.elapsed / 1.1))
          : lerpVec3(heroCamStart, heroCamEnd, tPos);

      // Slow tilt-up from ruined server spire (y=15) up into unobstructed azure & golden dawn sky (y=46)
      const tiltT = easeInOutCubic((this.elapsed - 1.2) / 5.4);
      const lookAt: Vec3Like = {
        x: this.citadelPos.x,
        y: lerp(15.0, 46.0, tiltT),
        z: this.citadelPos.z - 12,
      };

      return {
        active: true,
        position: pos,
        lookAt,
        rollRad: 0,
        fov: lerp(64, 72, tiltT),
        hideViewmodel: true,
        weaponDrawProgress: 0,
      };
    }

    return {
      active: false,
      position: this.anchorPos,
      lookAt: this.anchorLookAt,
      rollRad: 0,
      fov: 76,
      hideViewmodel: false,
      weaponDrawProgress: 1,
    };
  }

  public getHudState(): CinematicHudState {
    let blackoutOpacity = 0;
    let blurPx = 0;
    let ecgPhase = -1;
    let visorBootStep = 0;
    let letterbox = false;

    if (this.sequence === 'opening') {
      letterbox = this.elapsed < 5.05;
      if (this.elapsed < 1.85) {
        blackoutOpacity = 1;
        ecgPhase = clamp01(this.elapsed / 1.8);
      } else if (this.elapsed < 3.0) {
        blackoutOpacity = 1 - easeOutCubic((this.elapsed - 1.85) / 1.15);
      }
      if (this.elapsed >= 1.55 && this.elapsed < 3.45) {
        if (this.elapsed < 2.15) visorBootStep = 1;
        else if (this.elapsed < 2.75) visorBootStep = 2;
        else visorBootStep = 3;
      }
      if (this.elapsed >= 1.9 && this.elapsed < 4.5) {
        blurPx = Math.round((1 - easeOutCubic((this.elapsed - 1.9) / 2.6)) * 13);
      }
    } else if (this.sequence === 'breach') {
      letterbox = this.elapsed < 3.85;
    } else if (this.sequence === 'dawn') {
      letterbox = true;
    }

    const whiteoutOpacity =
      this.whiteoutTimer > 0 ? clamp01(this.whiteoutTimer / this.whiteoutMax) : 0;
    const glitchIntensity =
      this.glitchTimer > 0 ? clamp01(this.glitchTimer / this.glitchMax) : 0;
    const emergencyRedOpacity =
      this.emergencyTimer > 0
        ? Math.abs(Math.sin(this.emergencyTimer * 14)) *
          clamp01(this.emergencyTimer / this.emergencyMax) *
          0.42
        : 0;

    let card: ChapterTitleCard | null = null;
    if (this.chapterCard) {
      const c = this.chapterCard;
      const totalChars = c.actCode.length + c.metaLine.length;
      const visibleChars = Math.min(totalChars, Math.floor(c.elapsed * 34));
      const fadeIn = clamp01(c.elapsed / 0.28);
      const fadeOut = clamp01((c.duration - c.elapsed) / 0.55);
      card = {
        id: c.id,
        actCode: c.actCode,
        title: c.title,
        metaLine: c.metaLine,
        accentCss: c.accentCss,
        visibleChars,
        opacity: Math.min(fadeIn, fadeOut),
      };
    }

    return {
      active: this.sequence !== 'none',
      sequence: this.sequence,
      letterbox,
      canSkip: this.sequence !== 'none',
      elapsed: this.elapsed,
      duration: this.duration,
      blackoutOpacity,
      whiteoutOpacity,
      blurPx,
      ecgPhase,
      visorBootStep,
      glitchIntensity,
      emergencyRedOpacity,
      chapterCard: card,
      dawnProgress: this.dawnProgress,
    };
  }
}
