import { ReloadPhase, ReloadStageGroup } from './types';

export const TACTICAL_RELOAD_MULTIPLIER = 0.8; // 20% faster when magazine still has bullets

export interface Vec3Tuple {
  x: number;
  y: number;
  z: number;
}

export interface ReloadTimingResult {
  isTactical: boolean;
  durationSec: number;
  speedBonusPct: number;
}

export interface ReloadAnimPose {
  pivotPos: Vec3Tuple;
  pivotRot: Vec3Tuple;
  magPos: Vec3Tuple;
  magRot: Vec3Tuple;
  magVisible: boolean;
  magScale: number;
  leftHandPos: Vec3Tuple;
  leftHandRot: Vec3Tuple;
  /**
   * Weapon-specific auxiliary mechanism modulation (0..1):
   * - M41-X (0): Charging handle rearward pull (0 = forward, 1 = pulled back)
   * - DOOM-99 (1): Pump forend slide back (0 = forward, 1 = racked back)
   * - RAIL-X9 (2): Plasma core & accelerator coil power level (0 = discharged, 1 = full charge)
   * - HYDRA-7 (3): Warhead lock-on readiness (0 = open tube, 1 = armed)
   * - INFERNO-X (4): Pilot igniter flame & manifold pressure (0 = vented, 1 = pressurized)
   * - ZEUS-MK7 (5): Rotating Tesla coil arc resonance (0 = discharged, 1 = overcharged)
   */
  auxValue: number;
}

export interface ReloadHudState {
  phase: ReloadPhase;
  stageGroup: ReloadStageGroup;
  phaseLabel: string;
  stageBadge: string;
  overallPct: number;
  phaseProgress: number; // 0..1 within current phase
  emptyThreshold: number; // 0..1 boundary where emptying transitions to loading
  chamberThreshold: number; // 0..1 boundary where loading transitions to chambering (1.0 on tactical)
  accentCss: string;
  isTactical: boolean;
  speedBonusPct: number;
  durationSec: number;
}

export interface WeaponReloadEvaluation {
  pose: ReloadAnimPose;
  hud: ReloadHudState;
}

interface WeaponReloadProfile {
  emptyEnd: number;
  chamberStart: number;
  tacticalEmptyEnd: number;
  emptyingLabel: string;
  loadingLabel: string;
  chamberingLabel: string;
  tacticalEmptyingLabel: string;
  tacticalLoadingLabel: string;
}

export const WEAPON_RELOAD_PROFILES: readonly WeaponReloadProfile[] = [
  // [0] M41-X Pulse Assault Rifle
  {
    emptyEnd: 0.38,
    chamberStart: 0.76,
    tacticalEmptyEnd: 0.44,
    emptyingLabel: '탄창 분리',
    loadingLabel: '새 탄창 결합',
    chamberingLabel: '노리쇠 후퇴전진',
    tacticalEmptyingLabel: '전술 탄창 분리',
    tacticalLoadingLabel: '신속 탄창 체결',
  },
  // [1] DOOM-99 Heavy Combat Shotgun
  {
    emptyEnd: 0.34,
    chamberStart: 0.78,
    tacticalEmptyEnd: 0.38,
    emptyingLabel: '탄피 배출',
    loadingLabel: '12게이지 장전',
    chamberingLabel: '펌프 장전',
    tacticalEmptyingLabel: '잔탄 포트 개방',
    tacticalLoadingLabel: '신속 쉘 보충',
  },
  // [2] RAIL-X9 Electromagnetic Railgun
  {
    emptyEnd: 0.42,
    chamberStart: 0.76,
    tacticalEmptyEnd: 0.45,
    emptyingLabel: '방전 셀 분리',
    loadingLabel: '플라즈마 셀 삽입',
    chamberingLabel: '코일 재충전',
    tacticalEmptyingLabel: '잔여 셀 교체',
    tacticalLoadingLabel: '핫스왑 셀 결합',
  },
  // [3] HYDRA-7 Guided Rocket Launcher
  {
    emptyEnd: 0.36,
    chamberStart: 0.78,
    tacticalEmptyEnd: 0.40,
    emptyingLabel: '발사관 개방',
    loadingLabel: '유도 탄두 장전',
    chamberingLabel: '신관 무장',
    tacticalEmptyingLabel: '보조 튜브 개방',
    tacticalLoadingLabel: '신속 탄두 장전',
  },
  // [4] INFERNO-X Plasma Flamethrower
  {
    emptyEnd: 0.44,
    chamberStart: 0.80,
    tacticalEmptyEnd: 0.46,
    emptyingLabel: '잔압 탱크 분리',
    loadingLabel: '네이팜 탱크 체결',
    chamberingLabel: '점화 압력 상승',
    tacticalEmptyingLabel: '압력 유지 분리',
    tacticalLoadingLabel: '신속 탱크 체결',
  },
  // [5] ZEUS-MK7 Chain Arc Tesla Cannon
  {
    emptyEnd: 0.40,
    chamberStart: 0.76,
    tacticalEmptyEnd: 0.44,
    emptyingLabel: '방전 아크 코어 분리',
    loadingLabel: '고전압 셀 장착',
    chamberingLabel: '테슬라 코일 공진',
    tacticalEmptyingLabel: '전술 아크 셀 교체',
    tacticalLoadingLabel: '신속 공진 결합',
  },
];

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / Math.max(0.0001, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function bell(t: number): number {
  return Math.sin(clamp01(t) * Math.PI);
}

/**
 * Computes reload duration with the Tactical Reload modifier:
 * Reloading with >= 1 round remaining in the magazine is 20% faster than an empty-mag reload.
 */
export function computeReloadTiming(
  baseDurationSec: number,
  currentAmmo: number,
  magSize: number
): ReloadTimingResult {
  const isTactical = currentAmmo > 0 && currentAmmo < magSize;
  const durationSec = isTactical
    ? Math.round(baseDurationSec * TACTICAL_RELOAD_MULTIPLIER * 1000) / 1000
    : baseDurationSec;
  return {
    isTactical,
    durationSec,
    speedBonusPct: isTactical ? 20 : 0,
  };
}

export function createNeutralReloadPose(weaponIdx: number): ReloadAnimPose {
  const defaultAux = weaponIdx >= 2 ? 1 : 0;
  return {
    pivotPos: { x: 0, y: 0, z: 0 },
    pivotRot: { x: 0, y: 0, z: 0 },
    magPos: { x: 0, y: 0, z: 0 },
    magRot: { x: 0, y: 0, z: 0 },
    magVisible: true,
    magScale: 1,
    leftHandPos: { x: 0, y: 0, z: 0 },
    leftHandRot: { x: 0, y: 0, z: 0 },
    auxValue: defaultAux,
  };
}

export function createIdleReloadHud(weaponIdx = 0): ReloadHudState {
  const profile = WEAPON_RELOAD_PROFILES[weaponIdx] ?? WEAPON_RELOAD_PROFILES[0];
  return {
    phase: 'idle',
    stageGroup: 'idle',
    phaseLabel: '',
    stageBadge: '',
    overallPct: 100,
    phaseProgress: 0,
    emptyThreshold: profile.emptyEnd,
    chamberThreshold: profile.chamberStart,
    accentCss: '#f59e0b',
    isTactical: false,
    speedBonusPct: 0,
    durationSec: 0,
  };
}

/**
 * Evaluates the exact weapon-specific 3D viewmodel reload pose and dual-phase HUD state
 * for a normalized reload progress `p` in [0, 1].
 */
export function evaluateWeaponReload(
  weaponIdx: number,
  rawProgress: number,
  isReloading: boolean,
  isTactical = false,
  durationSec = 0
): WeaponReloadEvaluation {
  const idx = Math.max(0, Math.min(WEAPON_RELOAD_PROFILES.length - 1, weaponIdx));
  const profile = WEAPON_RELOAD_PROFILES[idx];

  if (!isReloading) {
    return {
      pose: createNeutralReloadPose(idx),
      hud: createIdleReloadHud(idx),
    };
  }

  const p = clamp01(rawProgress);
  const emptyEnd = isTactical ? profile.tacticalEmptyEnd : profile.emptyEnd;
  const chamberStart = isTactical ? 1.0 : profile.chamberStart;

  let phase: ReloadPhase;
  let stageGroup: ReloadStageGroup;
  let phaseLabel: string;
  let stageBadge: string;
  let phaseProgress: number;
  let accentCss: string;

  if (p < emptyEnd) {
    phase = 'emptying';
    stageGroup = 'emptying';
    phaseLabel = isTactical ? profile.tacticalEmptyingLabel : profile.emptyingLabel;
    stageBadge = isTactical ? 'TACTICAL' : 'EMPTYING';
    phaseProgress = clamp01(p / emptyEnd);
    accentCss = isTactical ? '#38bdf8' : '#f97316';
  } else if (p < chamberStart) {
    phase = 'loading';
    stageGroup = 'loading';
    phaseLabel = isTactical ? profile.tacticalLoadingLabel : profile.loadingLabel;
    stageBadge = isTactical ? 'TACTICAL LOCK' : 'LOADING';
    phaseProgress = clamp01((p - emptyEnd) / Math.max(0.001, chamberStart - emptyEnd));
    accentCss = isTactical ? '#2dd4bf' : '#10b981';
  } else {
    phase = 'chambering';
    stageGroup = 'loading';
    phaseLabel = profile.chamberingLabel;
    stageBadge = 'CHAMBERING';
    phaseProgress = clamp01((p - chamberStart) / Math.max(0.001, 1 - chamberStart));
    accentCss = '#38bdf8';
  }

  const pose = createNeutralReloadPose(idx);
  const env = smoothstep(0, 0.09, p) * (1 - smoothstep(0.91, 1.0, p));
  const cantScale = isTactical ? 0.82 : 1.0;

  if (idx === 0) {
    const seatPeak = isTactical ? 0.84 : 0.71;
    const seatBump = Math.exp(-Math.pow((p - seatPeak) / 0.042, 2));
    const boltPull =
      !isTactical && p >= chamberStart ? bell((p - chamberStart) / (1 - chamberStart)) : 0;

    pose.pivotPos.x = -0.052 * cantScale * env;
    pose.pivotPos.y = -0.068 * cantScale * env + seatBump * 0.03 - boltPull * 0.014;
    pose.pivotPos.z = 0.042 * env + boltPull * 0.032;

    pose.pivotRot.x = (-0.19 * cantScale + seatBump * 0.14 - boltPull * 0.08) * env;
    pose.pivotRot.y = 0.18 * cantScale * env;
    pose.pivotRot.z = (0.44 * cantScale - boltPull * 0.18) * env;

    if (p < emptyEnd) {
      const pull = smoothstep(0.16, 0.88, phaseProgress);
      pose.magPos.x = -0.05 * pull;
      pose.magPos.y = -0.35 * pull;
      pose.magPos.z = -0.04 * pull;
      pose.magRot.x = 0.52 * pull;
      pose.magRot.z = 0.26 * pull;
      pose.magVisible = phaseProgress < 0.88;
      pose.leftHandPos.x = 0.02 - 0.04 * pull;
      pose.leftHandPos.y = -0.05 - 0.21 * pull;
      pose.leftHandPos.z = 0.24 * smoothstep(0, 0.34, phaseProgress);
      pose.leftHandRot.z = 0.3 * pull;
    } else if (p < chamberStart) {
      const insert = smoothstep(0.1, 0.84, phaseProgress);
      pose.magVisible = phaseProgress > 0.07;
      pose.magPos.x = lerp(-0.07, 0, insert);
      pose.magPos.y = lerp(-0.33, 0, insert);
      pose.magPos.z = lerp(0.04, 0, insert);
      pose.magRot.x = lerp(-0.34, 0, insert);
      pose.magRot.z = lerp(0.22, 0, insert);
      pose.leftHandPos.x = lerp(-0.04, 0.01, insert);
      pose.leftHandPos.y = lerp(-0.25, -0.05, insert) + seatBump * 0.026;
      pose.leftHandPos.z = 0.23 * (1 - smoothstep(0.82, 1.0, phaseProgress));
      pose.leftHandRot.z = lerp(0.26, 0.04, insert);
    } else {
      pose.auxValue = boltPull;
      pose.leftHandPos.x = -0.05 * boltPull;
      pose.leftHandPos.y = 0.085 * boltPull;
      pose.leftHandPos.z = 0.26 * boltPull;
      pose.leftHandRot.x = -0.25 * boltPull;
    }
  } else if (idx === 1) {
    const shellCycles = isTactical ? 1 : 2;
    const shellCycle =
      phase === 'loading' ? Math.abs(Math.sin(phaseProgress * Math.PI * shellCycles)) : 0;
    const pumpRack = !isTactical && phase === 'chambering' ? bell(phaseProgress) : 0;
    const ejectKick = phase === 'emptying' ? bell(phaseProgress) : 0;

    pose.pivotPos.x = -0.04 * cantScale * env;
    pose.pivotPos.y = -0.06 * cantScale * env + shellCycle * 0.026 - pumpRack * 0.025;
    pose.pivotPos.z = 0.048 * env + pumpRack * 0.048;

    pose.pivotRot.x = 0.3 * cantScale * env - pumpRack * 0.28 + shellCycle * 0.07;
    pose.pivotRot.y = -0.14 * cantScale * env;
    pose.pivotRot.z = -0.5 * cantScale * env * (1 - smoothstep(0.76, 0.94, p));

    const rackZ = (isTactical ? 0.035 : 0.065) * ejectKick + pumpRack * 0.145;
    pose.magPos.z = rackZ;
    pose.auxValue = pumpRack;

    if (phase === 'emptying') {
      pose.leftHandPos.z = rackZ;
      pose.leftHandPos.y = -0.03 * ejectKick;
    } else if (phase === 'loading') {
      const feedEnvelope =
        smoothstep(0, 0.16, phaseProgress) * (1 - smoothstep(0.84, 1.0, phaseProgress));
      pose.leftHandPos.x = 0.05 * feedEnvelope;
      pose.leftHandPos.y = (-0.11 + shellCycle * 0.095) * feedEnvelope;
      pose.leftHandPos.z = 0.26 * feedEnvelope;
      pose.leftHandRot.x = 0.35 * shellCycle;
    } else {
      pose.leftHandPos.z = rackZ;
      pose.leftHandPos.y = -0.015 * pumpRack;
    }
  } else if (idx === 2) {
    const lockPeak = isTactical ? 0.85 : 0.72;
    const lockJolt = Math.exp(-Math.pow((p - lockPeak) / 0.038, 2));
    const chargeSurge =
      phase === 'chambering' ? smoothstep(0.05, 0.92, phaseProgress) : isTactical ? 0.65 : 0;

    pose.pivotPos.x = -0.06 * cantScale * env;
    pose.pivotPos.y = -0.075 * cantScale * env + lockJolt * 0.034;
    pose.pivotPos.z =
      0.05 * env +
      (phase === 'chambering'
        ? Math.sin(phaseProgress * 28) * 0.004 * (1 - phaseProgress)
        : 0);

    pose.pivotRot.x = (-0.15 * cantScale + lockJolt * 0.12) * env;
    pose.pivotRot.y = 0.22 * cantScale * env;
    pose.pivotRot.z = 0.56 * cantScale * env * (1 - smoothstep(0.78, 0.96, p));

    if (phase === 'emptying') {
      const pull = smoothstep(0.15, 0.88, phaseProgress);
      pose.auxValue = isTactical
        ? lerp(0.95, 0.45, smoothstep(0.05, 0.7, phaseProgress))
        : 1 - smoothstep(0.05, 0.65, phaseProgress);
      pose.magPos.x = -0.08 * pull;
      pose.magPos.y = -0.34 * pull;
      pose.magRot.z = 0.65 * pull;
      pose.magVisible = phaseProgress < 0.88;
      pose.leftHandPos.x = -0.04 * pull;
      pose.leftHandPos.y = -0.22 * pull;
      pose.leftHandPos.z = 0.25 * smoothstep(0, 0.35, phaseProgress);
    } else if (phase === 'loading') {
      const insert = smoothstep(0.1, 0.84, phaseProgress);
      pose.auxValue = isTactical
        ? lerp(0.45, 1.0, smoothstep(0.55, 0.95, phaseProgress))
        : 0.08 + 0.18 * smoothstep(0.72, 1.0, phaseProgress);
      pose.magVisible = phaseProgress > 0.08;
      pose.magPos.x = lerp(-0.09, 0, insert);
      pose.magPos.y = lerp(-0.34, 0, insert);
      pose.magRot.z = lerp(0.55, 0, insert);
      pose.leftHandPos.x = lerp(-0.06, 0, insert);
      pose.leftHandPos.y = lerp(-0.24, -0.04, insert) + lockJolt * 0.025;
      pose.leftHandPos.z = 0.25 * (1 - smoothstep(0.8, 1.0, phaseProgress));
    } else {
      pose.auxValue = lerp(0.26, 1.0, chargeSurge);
      pose.magVisible = true;
    }
  } else if (idx === 3) {
    const heavePeak = isTactical ? 0.86 : 0.84;
    const heaveBump = Math.exp(-Math.pow((p - heavePeak) / 0.055, 2));

    pose.pivotPos.x = 0.042 * cantScale * env;
    pose.pivotPos.y = -0.13 * cantScale * env + heaveBump * 0.04;
    pose.pivotPos.z = 0.07 * env;

    pose.pivotRot.x = (-0.42 * cantScale * env + heaveBump * 0.2) * (1 - smoothstep(0.84, 1.0, p));
    pose.pivotRot.y = -0.22 * cantScale * env;
    pose.pivotRot.z = -0.26 * cantScale * env;

    if (phase === 'emptying') {
      const vent = smoothstep(0.1, 0.85, phaseProgress);
      pose.auxValue = isTactical ? 0.65 : 1 - vent;
      pose.magVisible = isTactical ? true : phaseProgress < 0.25;
      pose.magPos.z = (isTactical ? 0.08 : 0.22) * vent;
      pose.leftHandPos.y = -0.1 * vent;
      pose.leftHandPos.z = -0.14 * vent;
    } else if (phase === 'loading') {
      const slide = smoothstep(0.14, 0.88, phaseProgress);
      pose.auxValue = isTactical ? lerp(0.65, 1.0, slide) : 0.25 * slide;
      pose.magVisible = phaseProgress > 0.08;
      pose.magPos.x = lerp(0.15, 0, slide);
      pose.magPos.y = lerp(-0.2, 0, slide);
      pose.magPos.z = lerp(-0.44, 0, slide);
      pose.magRot.z = lerp(-0.32, 0, slide);
      pose.leftHandPos.x = lerp(0.12, 0, slide);
      pose.leftHandPos.y = lerp(-0.18, -0.02, slide);
      pose.leftHandPos.z = lerp(-0.3, 0, slide);
    } else {
      pose.auxValue = smoothstep(0.0, 0.8, phaseProgress);
      pose.magVisible = true;
    }
  } else if (idx === 4) {
    const lockPeak = isTactical ? 0.86 : 0.78;
    const lockTwist = Math.exp(-Math.pow((p - lockPeak) / 0.04, 2));

    pose.pivotPos.x = -0.048 * cantScale * env;
    pose.pivotPos.y = -0.072 * cantScale * env + lockTwist * 0.028;
    pose.pivotPos.z = 0.04 * env;

    pose.pivotRot.x = 0.22 * cantScale * env;
    pose.pivotRot.y = -0.16 * cantScale * env;
    pose.pivotRot.z = -0.5 * cantScale * env * (1 - smoothstep(0.8, 0.96, p));

    if (phase === 'emptying') {
      const unscrew = smoothstep(0.1, 0.9, phaseProgress);
      pose.auxValue = isTactical ? 0.5 : 1 - smoothstep(0.0, 0.55, phaseProgress);
      pose.magPos.y = -0.32 * unscrew;
      pose.magPos.x = 0.06 * unscrew;
      pose.magRot.y = unscrew * Math.PI * (isTactical ? 1.5 : 2.2);
      pose.magVisible = phaseProgress < 0.88;
      pose.leftHandPos.x = 0.05 * unscrew;
      pose.leftHandPos.y = -0.2 * unscrew;
      pose.leftHandPos.z = 0.18 * smoothstep(0, 0.3, phaseProgress);
      pose.leftHandRot.z = -0.4 * unscrew;
    } else if (phase === 'loading') {
      const screwIn = smoothstep(0.12, 0.88, phaseProgress);
      pose.auxValue = isTactical ? lerp(0.5, 1.0, screwIn) : 0.1 * screwIn;
      pose.magVisible = phaseProgress > 0.08;
      pose.magPos.y = lerp(-0.32, 0, screwIn);
      pose.magPos.x = lerp(0.06, 0, screwIn);
      pose.magRot.y = lerp(Math.PI * (isTactical ? 1.5 : 2.2), 0, screwIn);
      pose.leftHandPos.x = lerp(0.05, 0, screwIn);
      pose.leftHandPos.y = lerp(-0.2, -0.04, screwIn) + lockTwist * 0.02;
      pose.leftHandPos.z = 0.18 * (1 - smoothstep(0.82, 1.0, phaseProgress));
      pose.leftHandRot.z = lerp(-0.4, 0, screwIn);
    } else {
      pose.auxValue = smoothstep(0.0, 0.85, phaseProgress);
      pose.magVisible = true;
    }
  } else {
    // [5] ZEUS-MK7 CHAIN ARC TESLA CANNON
    const seatPeak = isTactical ? 0.84 : 0.72;
    const seatJolt = Math.exp(-Math.pow((p - seatPeak) / 0.04, 2));
    pose.pivotPos.x = -0.055 * cantScale * env;
    pose.pivotPos.y = -0.07 * cantScale * env + seatJolt * 0.032;
    pose.pivotPos.z = 0.045 * env;
    pose.pivotRot.x = (-0.16 * cantScale + seatJolt * 0.14) * env;
    pose.pivotRot.y = 0.24 * cantScale * env;
    pose.pivotRot.z = 0.52 * cantScale * env * (1 - smoothstep(0.76, 0.95, p));

    if (phase === 'emptying') {
      const eject = smoothstep(0.12, 0.86, phaseProgress);
      pose.auxValue = isTactical ? 0.45 : 1 - smoothstep(0, 0.6, phaseProgress);
      pose.magPos.x = 0.12 * eject;
      pose.magPos.y = 0.14 * eject;
      pose.magRot.z = -0.8 * eject;
      pose.magVisible = phaseProgress < 0.86;
      pose.leftHandPos.x = 0.08 * eject;
      pose.leftHandPos.y = 0.08 * eject;
      pose.leftHandPos.z = 0.22 * smoothstep(0, 0.35, phaseProgress);
    } else if (phase === 'loading') {
      const seat = smoothstep(0.1, 0.85, phaseProgress);
      pose.auxValue = isTactical ? lerp(0.45, 1.0, seat) : 0.12 + 0.24 * seat;
      pose.magVisible = phaseProgress > 0.08;
      pose.magPos.x = lerp(0.16, 0, seat);
      pose.magPos.y = lerp(0.18, 0, seat);
      pose.magRot.z = lerp(-0.7, 0, seat);
      pose.leftHandPos.x = lerp(0.1, 0, seat);
      pose.leftHandPos.y = lerp(0.12, -0.02, seat) + seatJolt * 0.025;
      pose.leftHandPos.z = 0.22 * (1 - smoothstep(0.82, 1.0, phaseProgress));
    } else {
      pose.auxValue = lerp(0.35, 1.0, smoothstep(0.05, 0.9, phaseProgress));
      pose.magVisible = true;
    }
  }

  return {
    pose,
    hud: {
      phase,
      stageGroup,
      phaseLabel,
      stageBadge,
      overallPct: Math.round(p * 100),
      phaseProgress,
      emptyThreshold: emptyEnd,
      chamberThreshold: chamberStart,
      accentCss,
      isTactical,
      speedBonusPct: isTactical ? 20 : 0,
      durationSec,
    },
  };
}
