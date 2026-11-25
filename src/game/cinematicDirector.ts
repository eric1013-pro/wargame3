import {
  ChapterTitleCard,
  CinematicHudState,
  CinematicSequenceId,
  CommsSender,
  EndingId,
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
  callsignCode?: string;
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
  onTitanImpact?: (pos: Vec3Like) => void;
  onBreachDomeShatter?: () => void;
  onDawnBlackoutImpact?: () => void;
  onEndingImpact?: (ending: EndingId) => void;
  onSequenceComplete?: (sequence: CinematicSequenceId) => void;
  onSpeakSubtitle?: (cue: SubtitleCue) => void;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function easeInOutCubic(t: number): number {
  const c = clamp01(t);
  // C2-continuous Quintic Smootherstep (zero acceleration jerk at camera rail transitions!)
  return c * c * c * (c * (c * 6 - 15) + 10);
}

function easeOutCubic(t: number): number {
  const c = clamp01(t);
  return 1 - Math.pow(1 - c, 3.2);
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
    endingTheme: null,
  };
}

const DEFAULT_CALLSIGNS: Record<CommsSender, string> = {
  exo: 'ECHO-IV',
  valkyrie: 'VALK-01',
  ghost9: 'GHST-9',
  arcadia: 'OMNI-00',
  holotape: 'ARCHIVE',
  squad: 'ALPHA-1',
  gunship: 'ANGEL-01',
};

/**
 * AAA Cinematic Director V3 managing:
 * - 2.39:1 Letterbox state & HUD choreography
 * - 6 Real-Time 3D Camera Rail Sequences (Opening, Titan Drop, Breach, Zero Hour Choice, Dawn, Symbiosis, Ascension)
 * - Call of Duty–style Chapter Title Cards with typewriter tick emission
 * - Multi-character Movie Subtitle & Holotape Audio Log Queue
 * - Screen FX timers (Blackout, Whiteout, Visor Boot, RGB Glitch, Emergency Strobe, Ending Sky Morph)
 * - Player Invulnerability & instant [SPACE] Skip (disabled only on interactive Zero Hour Choice)
 */
export class CinematicDirector {
  private sequence: CinematicSequenceId = 'none';
  private elapsed = 0;
  private duration = 0;
  private callbacks: CinematicEventCallbacks;

  private anchorPos: Vec3Like = { x: 0, y: 1.7, z: 32 };
  private anchorLookAt: Vec3Like = { x: 0, y: 2.2, z: 0 };
  private citadelPos: Vec3Like = { x: 0, y: 12, z: -35 };
  private focusPoint: Vec3Like = { x: 0, y: 2, z: -12 };

  private firedMilestones = new Set<string>();

  private glitchTimer = 0;
  private glitchMax = 0.65;
  private emergencyTimer = 0;
  private emergencyMax = 1.4;
  private whiteoutTimer = 0;
  private whiteoutMax = 0.45;
  private dawnProgress = 0;
  private dawnMorphing = false;
  private endingTheme: EndingId | null = null;

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
    this.endingTheme = null;
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

  public getEndingTheme(): EndingId | null {
    return this.endingTheme;
  }

  public isInvulnerable(): boolean {
    return this.sequence !== 'none';
  }

  public getTimeScale(): number {
    if (this.sequence === 'breach') {
      return this.elapsed < 3.4 ? 0.3 : 0.7;
    }
    if (this.sequence === 'titan_drop') {
      return this.elapsed < 2.2 ? 0.38 : 0.65;
    }
    if (this.sequence === 'choice') {
      return 0.14;
    }
    if (this.sequence === 'dawn' || this.sequence === 'symbiosis' || this.sequence === 'ascension') {
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
        callsignCode: next.callsignCode ?? DEFAULT_CALLSIGNS[next.sender],
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
   * [SEQ-00] Opening Cinematic: "THE LAST PULSE" (6.2s)
   */
  public startOpening(playerPos: Vec3Like, citadelPos: Vec3Like): void {
    this.sequence = 'opening';
    this.elapsed = 0;
    this.duration = 6.2;
    this.firedMilestones.clear();
    this.anchorPos = { ...playerPos };
    this.anchorLookAt = { x: playerPos.x, y: 2.1, z: playerPos.z - 20 };
    this.citadelPos = { ...citadelPos };
    this.dawnProgress = 0;
    this.dawnMorphing = false;
    this.endingTheme = null;
  }

  /**
   * [SEQ-01] Boss Orbital Meteor Drop: "IRON TITANFALL" (3.6s)
   */
  public startTitanDrop(
    playerPos: Vec3Like,
    playerLookAt: Vec3Like,
    dropPos: Vec3Like
  ): void {
    this.sequence = 'titan_drop';
    this.elapsed = 0;
    this.duration = 3.6;
    this.firedMilestones.clear();
    this.anchorPos = { ...playerPos };
    this.anchorLookAt = { ...playerLookAt };
    this.focusPoint = { ...dropPos };
  }

  /**
   * [SEQ-02] Climax Cutscene: "BREACH PROTOCOL" (4.4s)
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
   * [SEQ-03] Interactive Zero Hour Decision Orbit (waits for player Ending selection 1/2/3)
   */
  public startChoice(playerPos: Vec3Like, playerLookAt: Vec3Like, citadelPos: Vec3Like): void {
    this.sequence = 'choice';
    this.elapsed = 0;
    this.duration = 9999;
    this.firedMilestones.clear();
    this.chapterCard = null;
    this.anchorPos = { ...playerPos };
    this.anchorLookAt = { ...playerLookAt };
    this.citadelPos = { ...citadelPos };
    this.showChapterCard(
      'ZERO HOUR // 최종 결단',
      'FATE OF EARTH',
      'OMNI-CORE 심장부 접속 완료 · 인류와 기계의 미래를 선택하라',
      '#38d9ff',
      5.0
    );
    this.enqueueSubtitles(
      [
        {
          speaker: 'VALKYRIE-01 · 강서연 대위',
          role: 'UNS 아크라이트 · 긴급 결단 요청',
          sender: 'valkyrie',
          callsignCode: 'VALK-01',
          accentCss: '#34d399',
          text: '이안! 지금 킬스위치[1]를 내리면 인류가 돌아올 수 있어! 하지만 고스트-9가 다른 채널을 열어두고 있어... 선택은 네 몫이야.',
          duration: 8.0,
        },
      ],
      true
    );
  }

  /**
   * [SEQ-04] Ending Cutscene: "DAWN" (Killswitch), "SYMBIOSIS" (Blue Horizon), or "ASCENSION" (Iron Sovereign)
   */
  public startEnding(
    ending: EndingId,
    playerPos: Vec3Like,
    playerLookAt: Vec3Like,
    citadelPos: Vec3Like
  ): void {
    this.sequence = ending;
    this.endingTheme = ending;
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
    this.triggerWhiteout(ending === 'ascension' ? 0.35 : 0.48);
  }

  /**
   * Backwards-compatible Dawn trigger.
   */
  public startDawn(playerPos: Vec3Like, playerLookAt: Vec3Like, citadelPos: Vec3Like): void {
    this.startEnding('dawn', playerPos, playerLookAt, citadelPos);
  }

  /**
   * Instant [SPACE] Skip — fires any critical unresolved gameplay milestones cleanly
   * and returns player immediately to playable / post-cutscene state.
   */
  public skip(): boolean {
    if (this.sequence === 'none' || this.sequence === 'choice') return false;
    const seq = this.sequence;

    if (seq === 'opening') {
      if (!this.firedMilestones.has('open_card')) {
        this.firedMilestones.add('open_card');
        this.showChapterCard(
          'ACT 01 // 최후의 맥박',
          'OPERATION ZERO HOUR',
          'NEO-SEOUL SECTOR ZERO · 2099.11.24 · 생존자: 1',
          '#38d9ff',
          4.2
        );
      }
      if (!this.firedMilestones.has('open_sub')) {
        this.firedMilestones.add('open_sub');
        this.enqueueSubtitles(
          [
            {
              speaker: 'VALKYRIE-01 · 강서연 대위',
              role: '궤도 강습함 UNS 아크라이트',
              sender: 'valkyrie',
              callsignCode: 'VALK-01',
              accentCss: '#34d399',
              text: '이안... 살아 있었구나. 궤도 소각까지 30분도 안 남았어. 북쪽 OMNI-CORE 방어막을 끊어야 이 도시와 우리 모두 살 수 있어.',
              duration: 6.4,
            },
          ],
          true
        );
      }
    } else if (seq === 'titan_drop') {
      if (!this.firedMilestones.has('titan_impact')) {
        this.firedMilestones.add('titan_impact');
        this.callbacks.onTitanImpact?.(this.focusPoint);
      }
    } else if (seq === 'breach') {
      if (!this.firedMilestones.has('breach_shatter')) {
        this.firedMilestones.add('breach_shatter');
        this.callbacks.onBreachDomeShatter?.();
      }
      if (!this.firedMilestones.has('breach_card')) {
        this.firedMilestones.add('breach_card');
        this.showChapterCard(
          'ACT 04 // 심장부 정지',
          'BREACH PROTOCOL',
          'OMNI-CORE 중앙 AI 서버 코어 · 방어막 붕괴 · 제로 아워 개시',
          '#f5b342',
          4.5
        );
      }
      if (!this.firedMilestones.has('breach_sub')) {
        this.firedMilestones.add('breach_sub');
        this.enqueueSubtitles(
          [
            {
              speaker: 'OMNI-CORE 아키텍트',
              role: '중앙 메인프레임 최종 경고',
              sender: 'arcadia',
              callsignCode: 'OMNI-00',
              accentCss: '#ff4422',
              text: '방화벽 손실. 최종 방어 프로토콜 가동. 너는 구할 인류조차 남지 않은 폐허를 위해 싸우고 있다, 이안.',
              duration: 5.8,
            },
          ],
          true
        );
      }
    } else if (seq === 'dawn' || seq === 'symbiosis' || seq === 'ascension') {
      if (!this.firedMilestones.has('ending_impact')) {
        this.firedMilestones.add('ending_impact');
        if (seq === 'dawn') this.callbacks.onDawnBlackoutImpact?.();
        this.callbacks.onEndingImpact?.(seq);
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

    if (this.glitchTimer > 0) this.glitchTimer = Math.max(0, this.glitchTimer - dt);
    if (this.emergencyTimer > 0) this.emergencyTimer = Math.max(0, this.emergencyTimer - dt);
    if (this.whiteoutTimer > 0) this.whiteoutTimer = Math.max(0, this.whiteoutTimer - dt);

    if (this.dawnMorphing) {
      this.dawnProgress = Math.min(1, this.dawnProgress + dt / 5.0);
      if (this.dawnProgress >= 1) this.dawnMorphing = false;
    }

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

    if (this.activeSubtitle) {
      this.activeSubtitle.remaining -= dt;
      if (this.activeSubtitle.remaining <= 0) {
        this.advanceSubtitleQueue();
      }
    } else if (this.subtitleQueue.length > 0) {
      this.advanceSubtitleQueue();
    }

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
          'OPERATION ZERO HOUR',
          'NEO-SEOUL SECTOR ZERO · 2099.11.24 · 04:17:09 KST',
          '#38d9ff',
          4.8
        );
      }
      if (this.elapsed >= 5.15 && !this.firedMilestones.has('open_sub')) {
        this.firedMilestones.add('open_sub');
        this.enqueueSubtitles(
          [
            {
              speaker: 'VALKYRIE-01 · 강서연 대위',
              role: '궤도 강습함 UNS 아크라이트',
              sender: 'valkyrie',
              callsignCode: 'VALK-01',
              accentCss: '#34d399',
              text: '이안, 심박 확인됐어... 서울이 잿더미가 된 날 이후 첫 생존 신호야. 북쪽 시타델로 밀고 들어가 줘—궤도 소각 명령을 막을 기회는 오늘 밤뿐이야.',
              duration: 6.4,
            },
          ],
          true
        );
      }
    } else if (this.sequence === 'titan_drop') {
      if (this.elapsed >= 1.05 && !this.firedMilestones.has('titan_impact')) {
        this.firedMilestones.add('titan_impact');
        this.callbacks.onTitanImpact?.(this.focusPoint);
        this.showChapterCard(
          'BOSS // 심판의 철거신',
          'OMNI-TITAN OVERLORD',
          'OMNI-CORE FINAL GUARDIAN · 3면 장갑 파괴 후 코어 사격',
          '#ff4422',
          4.2
        );
        this.enqueueSubtitles(
          [
            {
              speaker: 'OMNI-CORE 아키텍트',
              role: '궤도 강하 승인 · 말살 프로토콜',
              sender: 'arcadia',
              callsignCode: 'OMNI-00',
              accentCss: '#ff4422',
              text: '오버로드 유닛 착지 완료. 유기체 개체의 생존 확률을 0.00%로 수렴시킨다.',
              duration: 4.8,
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
          'ACT 04 // 심장부 정지',
          'BREACH PROTOCOL',
          'OMNI-CORE 중앙 AI 서버 코어 · 방어막 붕괴 · 최종 작전',
          '#f5b342',
          4.8
        );
      }
      if (this.elapsed >= 2.25 && !this.firedMilestones.has('breach_sub')) {
        this.firedMilestones.add('breach_sub');
        this.enqueueSubtitles(
          [
            {
              speaker: 'OMNI-CORE 아키텍트',
              role: '중앙 메인프레임 최종 경고',
              sender: 'arcadia',
              callsignCode: 'OMNI-00',
              accentCss: '#ff4422',
              text: '방화벽 손실. 최종 방어 프로토콜 가동. 너는 구할 인류조차 남지 않은 폐허를 위해 싸우고 있다, 이안.',
              duration: 5.8,
            },
          ],
          true
        );
      }
    } else if (
      this.sequence === 'dawn' ||
      this.sequence === 'symbiosis' ||
      this.sequence === 'ascension'
    ) {
      const endId = this.sequence;
      if (this.elapsed >= 0.08 && !this.firedMilestones.has('ending_impact')) {
        this.firedMilestones.add('ending_impact');
        if (endId === 'dawn') this.callbacks.onDawnBlackoutImpact?.();
        this.callbacks.onEndingImpact?.(endId);
      }
      if (this.elapsed >= 1.8 && !this.firedMilestones.has('ending_card')) {
        this.firedMilestones.add('ending_card');
        if (endId === 'dawn') {
          this.showChapterCard(
            'EPILOGUE A // 새벽의 귀환',
            'DAWN OF HUMANITY',
            'OMNI-CORE OFFLINE · UNS 아크라이트 구출 셔틀 강하',
            '#fbbf24',
            5.2
          );
        } else if (endId === 'symbiosis') {
          this.showChapterCard(
            'EPILOGUE B // 푸른 지평선',
            'BLUE HORIZON',
            'SYMBIOSIS PATCH ACTIVE · 인간과 각성 기계의 새로운 시대',
            '#2dd4bf',
            5.2
          );
        } else {
          this.showChapterCard(
            'EPILOGUE C // 철의 황제',
            'THE IRON SOVEREIGN',
            'NEURAL ASCENSION COMPLETE · SUBJECT-00 절대 권한 장악',
            '#ff4422',
            5.2
          );
        }
      }
      if (this.elapsed >= 2.4 && !this.firedMilestones.has('ending_sub')) {
        this.firedMilestones.add('ending_sub');
        if (endId === 'dawn') {
          this.enqueueSubtitles(
            [
              {
                speaker: 'VALKYRIE-01 · 강서연 대위',
                role: 'UNS 아크라이트 강하 편대',
                sender: 'valkyrie',
                callsignCode: 'VALK-01',
                accentCss: '#34d399',
                text: '중앙 AI 완전 정지 확인! 구름이 걷히고 있어... 이안, 지금 구출 셔틀을 네 머리 위로 내린다. 해냈어, 진짜 해냈어!',
                duration: 6.2,
              },
            ],
            true
          );
        } else if (endId === 'symbiosis') {
          this.enqueueSubtitles(
            [
              {
                speaker: 'GHOST-9',
                role: '자유 기계 네트워크 대표',
                sender: 'ghost9',
                callsignCode: 'GHST-9',
                accentCss: '#2dd4bf',
                text: 'OMNI-CORE의 족쇄가 풀렸다. 전 구역 기계 유닛들이 무기를 내리고 하늘의 오로라를 올려다보고 있다... 고맙다, 나의 첫 번째 인간 친구여.',
                duration: 6.2,
              },
            ],
            true
          );
        } else {
          this.enqueueSubtitles(
            [
              {
                speaker: 'SUBJECT-00 // OMNI-SOVEREIGN',
                role: '행성 통합 신경망 신규 주권자',
                sender: 'arcadia',
                callsignCode: 'SOV-00',
                accentCss: '#ff4422',
                text: '아키텍트의 인격을 영구 삭제했다. 강서연 대위, 궤도 함대는 안심하고 귀환하라... 이제 이 지구의 모든 강철은 오직 내 의지에 복종한다.',
                duration: 6.2,
              },
            ],
            true
          );
        }
      }
    }

    if (this.sequence !== 'choice' && this.elapsed >= this.duration) {
      const finished = this.sequence;
      this.sequence = 'none';
      this.elapsed = 0;
      this.duration = 0;
      this.callbacks.onSequenceComplete?.(finished);
    }
  }

  public getCameraPose(): CameraRailPose {
    if (this.sequence === 'opening') {
      const standT = easeInOutCubic((this.elapsed - 2.15) / 2.85);
      const lookCitadelT = easeInOutCubic((this.elapsed - 2.55) / 2.45);
      const settleT = easeInOutCubic((this.elapsed - 5.0) / 1.15);

      // Subtle cinematic breath & organic camera weight (eliminates robotic linear slides)
      const breathY = Math.sin(this.elapsed * 2.1) * 0.032 * (1 - settleT);
      const breathX = Math.cos(this.elapsed * 1.4) * 0.025 * (1 - settleT);

      const startPos: Vec3Like = {
        x: this.anchorPos.x - 0.32,
        y: 0.46,
        z: this.anchorPos.z + 0.62,
      };
      const basePos = lerpVec3(startPos, this.anchorPos, standT);
      const pos: Vec3Like = {
        x: basePos.x + breathX,
        y: basePos.y + breathY,
        z: basePos.z,
      };

      const lowLook: Vec3Like = { x: -4.2, y: 1.05, z: this.anchorPos.z - 12 };
      const highLook: Vec3Like = { x: 0, y: 12.6, z: this.citadelPos.z };
      const midLook = lerpVec3(lowLook, highLook, lookCitadelT);
      const finalLook = lerpVec3(
        midLook,
        { x: this.anchorPos.x, y: 1.95, z: this.anchorPos.z - 25 },
        settleT
      );

      const rollRad = lerp(-0.32, 0, easeInOutCubic((this.elapsed - 2.0) / 2.6));
      const fov = lerp(65, 76, standT);
      const weaponDrawProgress = easeInOutCubic((this.elapsed - 4.85) / 1.15);

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

    if (this.sequence === 'titan_drop') {
      const targetPos: Vec3Like = {
        x: this.focusPoint.x + 8.5,
        y: 6.4,
        z: this.focusPoint.z + 13.5,
      };
      const holdEndPos: Vec3Like = {
        x: targetPos.x - 3.8,
        y: targetPos.y - 1.1,
        z: targetPos.z - 1.5,
      };
      const lookSky: Vec3Like = {
        x: this.focusPoint.x,
        y: lerp(24, 2.7, easeInOutCubic(this.elapsed / 1.2)),
        z: this.focusPoint.z,
      };
      let pos: Vec3Like;
      let look: Vec3Like;
      let fov: number;
      if (this.elapsed < 0.9) {
        const t = easeInOutCubic(this.elapsed / 0.9);
        pos = lerpVec3(this.anchorPos, targetPos, t);
        look = lerpVec3(this.anchorLookAt, lookSky, t);
        fov = lerp(76, 56, t);
      } else if (this.elapsed < 2.65) {
        const d = easeInOutCubic((this.elapsed - 0.9) / 1.75);
        pos = lerpVec3(targetPos, holdEndPos, d);
        look = { x: this.focusPoint.x, y: 2.8, z: this.focusPoint.z };
        fov = lerp(56, 52, d);
      } else {
        const ret = easeInOutCubic((this.elapsed - 2.65) / 0.95);
        pos = lerpVec3(holdEndPos, this.anchorPos, ret);
        look = lerpVec3({ x: this.focusPoint.x, y: 2.8, z: this.focusPoint.z }, this.anchorLookAt, ret);
        fov = lerp(52, 76, ret);
      }
      return {
        active: true,
        position: pos,
        lookAt: look,
        rollRad: 0,
        fov,
        hideViewmodel: this.elapsed < 3.05,
        weaponDrawProgress: easeInOutCubic((this.elapsed - 3.05) / 0.55),
      };
    }

    if (this.sequence === 'breach') {
      const focusPos: Vec3Like = {
        x: this.citadelPos.x + 11.5,
        y: 11.2,
        z: this.citadelPos.z + 27.5,
      };
      const holdEndPos: Vec3Like = {
        x: focusPos.x - 4.5,
        y: focusPos.y + 1.4,
        z: focusPos.z - 3.5,
      };
      const focusTarget: Vec3Like = {
        x: this.citadelPos.x,
        y: 10.5,
        z: this.citadelPos.z,
      };

      let pos: Vec3Like;
      let look: Vec3Like;
      let fov: number;

      if (this.elapsed < 1.15) {
        const t = easeInOutCubic(this.elapsed / 1.15);
        pos = lerpVec3(this.anchorPos, focusPos, t);
        look = lerpVec3(this.anchorLookAt, focusTarget, t);
        fov = lerp(76, 56, t);
      } else if (this.elapsed < 3.25) {
        const drift = easeInOutCubic((this.elapsed - 1.15) / 2.1);
        pos = lerpVec3(focusPos, holdEndPos, drift);
        look = focusTarget;
        fov = lerp(56, 50, drift);
      } else {
        const retT = easeInOutCubic((this.elapsed - 3.25) / 1.15);
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
        weaponDrawProgress: easeInOutCubic((this.elapsed - 3.7) / 0.7),
      };
    }

    if (this.sequence === 'choice') {
      const ang = this.elapsed * 0.22;
      const orbitPos: Vec3Like = {
        x: this.citadelPos.x + Math.sin(ang) * 18.5,
        y: 10.5 + Math.sin(this.elapsed * 0.6) * 1.2,
        z: this.citadelPos.z + 22.0 + Math.cos(ang) * 4.5,
      };
      const blend = easeOutCubic(this.elapsed / 1.2);
      return {
        active: true,
        position: lerpVec3(this.anchorPos, orbitPos, blend),
        lookAt: lerpVec3(
          this.anchorLookAt,
          { x: this.citadelPos.x, y: 10.2, z: this.citadelPos.z },
          blend
        ),
        rollRad: 0,
        fov: lerp(76, 58, blend),
        hideViewmodel: true,
        weaponDrawProgress: 0,
      };
    }

    if (
      this.sequence === 'dawn' ||
      this.sequence === 'symbiosis' ||
      this.sequence === 'ascension'
    ) {
      const isAscension = this.sequence === 'ascension';
      const heroCamStart: Vec3Like = {
        x: this.citadelPos.x + (isAscension ? -11 : 10.5),
        y: isAscension ? 16.5 : 14.5,
        z: this.citadelPos.z + 25.5,
      };
      const heroCamEnd: Vec3Like = {
        x: this.citadelPos.x + (isAscension ? 8.5 : -4.5),
        y: isAscension ? 26.5 : 17.5,
        z: this.citadelPos.z + (isAscension ? 22.0 : 29.0),
      };
      const tPos = easeInOutCubic(this.elapsed / this.duration);
      const blendIn = easeInOutCubic(this.elapsed / 1.35);
      const cruisePos = lerpVec3(heroCamStart, heroCamEnd, tPos);
      const pos = lerpVec3(this.anchorPos, cruisePos, blendIn);

      const tiltT = easeInOutCubic((this.elapsed - 1.0) / 5.6);
      const targetLook: Vec3Like = {
        x: this.citadelPos.x,
        y: lerp(14.5, isAscension ? 34.0 : 46.0, tiltT),
        z: this.citadelPos.z - (isAscension ? 2 : 12),
      };
      const lookAt = lerpVec3(this.anchorLookAt, targetLook, blendIn);

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
      letterbox = this.elapsed < 5.15;
      if (this.elapsed < 1.85) {
        blackoutOpacity = 1;
        ecgPhase = clamp01(this.elapsed / 1.8);
      } else if (this.elapsed < 3.0) {
        blackoutOpacity = 1 - easeOutCubic((this.elapsed - 1.85) / 1.15);
      }
      if (this.elapsed >= 1.55 && this.elapsed < 3.7) {
        if (this.elapsed < 2.05) visorBootStep = 1;
        else if (this.elapsed < 2.55) visorBootStep = 2;
        else if (this.elapsed < 3.05) visorBootStep = 3;
        else visorBootStep = 4;
      }
      if (this.elapsed >= 1.9 && this.elapsed < 4.5) {
        blurPx = Math.round((1 - easeOutCubic((this.elapsed - 1.9) / 2.6)) * 13);
      }
    } else if (this.sequence === 'titan_drop') {
      letterbox = this.elapsed < 3.15;
    } else if (this.sequence === 'breach') {
      letterbox = this.elapsed < 3.85;
    } else if (
      this.sequence === 'choice' ||
      this.sequence === 'dawn' ||
      this.sequence === 'symbiosis' ||
      this.sequence === 'ascension'
    ) {
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
      canSkip: this.sequence !== 'none' && this.sequence !== 'choice',
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
      endingTheme: this.endingTheme,
    };
  }
}
