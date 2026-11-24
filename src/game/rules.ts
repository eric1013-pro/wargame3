import {
  AabbCollider,
  BodyPart,
  Faction,
  VerletLink,
  VerletNode,
  VerletStepResult,
  WeaponSpec,
} from './types';

export const ARENA_HALF_SIZE = 58;
export const KILLSTREAK_TARGET = 5;
export const VATS_TIME_SCALE = 0.1;
export const VATS_DRAIN_PER_REAL_SEC = 28;
export const VATS_REGEN_PER_SEC = 10;
export const VATS_MIN_ACTIVATE = 18;

export const FACTION_META: Record<
  number,
  { name: string; colorHex: number; cssColor: string; accentHex: number }
> = {
  [-1]: {
    name: '전장 포격',
    colorHex: 0xffc83d,
    cssColor: '#ffc83d',
    accentHex: 0xff8800,
  },
  [Faction.PLAYER]: {
    name: '최후의 인간',
    colorHex: 0x38f0ff,
    cssColor: '#38f0ff',
    accentHex: 0x38f0ff,
  },
  [Faction.RAIDER]: {
    name: '폐철 약탈기',
    colorHex: 0xc2541a,
    cssColor: '#ff9642',
    accentHex: 0xff8822,
  },
  [Faction.SYNDICATE]: {
    name: '이지스 신스',
    colorHex: 0x2c4f8a,
    cssColor: '#7aa2f7',
    accentHex: 0x60a5fa,
  },
  [Faction.ROBOT]: {
    name: '에이펙스 수호기',
    colorHex: 0x3b4454,
    cssColor: '#f87171',
    accentHex: 0xdc4c4c,
  },
};

export const WEAPONS: WeaponSpec[] = [
  {
    id: 0,
    slotKey: '1',
    shortName: 'M41-X 라이플',
    name: 'M41-X 헤비 어썰트 라이플',
    role: '자동 연사 · 홀로그램 ADS',
    sound: 'rifle',
    dmg: 29,
    fireRate: 0.1,
    pellets: 1,
    spread: 0.013,
    adsSpread: 0.0028,
    mag: 32,
    reload: 1.35,
    recoil: 0.025,
    shake: 0.13,
    dismemberPower: 0.65,
    auto: true,
    colorHex: 0xffc15e,
    accentCss: '#ff9f43',
    adsFov: 54,
    ejectShell: true,
  },
  {
    id: 1,
    slotKey: '2',
    shortName: 'DOOM-99 샷건',
    name: 'DOOM-99 슈퍼 컴뱃 샷건',
    role: '쌍열 9펠릿 · 확정 사지 절단',
    sound: 'shotgun',
    dmg: 24,
    fireRate: 0.66,
    pellets: 9,
    spread: 0.082,
    adsSpread: 0.048,
    mag: 6,
    reload: 1.65,
    recoil: 0.095,
    shake: 0.44,
    dismemberPower: 1.55,
    auto: false,
    colorHex: 0xff7b33,
    accentCss: '#ff5e2b',
    adsFov: 65,
    ejectShell: true,
  },
  {
    id: 2,
    slotKey: '3',
    shortName: 'RAIL-X9 레일건',
    name: 'RAIL-X9 대물 전자기 레일건',
    role: '일직선 관통 · 고배율 ADS',
    sound: 'railgun',
    dmg: 155,
    fireRate: 0.92,
    pellets: 1,
    spread: 0.002,
    adsSpread: 0.0004,
    mag: 4,
    reload: 1.85,
    recoil: 0.11,
    shake: 0.54,
    dismemberPower: 2.4,
    auto: false,
    pierce: true,
    colorHex: 0x26f0ff,
    accentCss: '#26f0ff',
    adsFov: 38,
    ejectShell: false,
  },
  {
    id: 3,
    slotKey: '4',
    shortName: 'HYDRA-7 로켓',
    name: 'HYDRA-7 로켓 런처',
    role: '랙돌 폭풍 · 드롭쉽 격추',
    sound: 'rocket',
    dmg: 210,
    fireRate: 1.2,
    pellets: 1,
    spread: 0.005,
    adsSpread: 0.002,
    mag: 3,
    reload: 2.1,
    recoil: 0.135,
    shake: 0.65,
    dismemberPower: 2.6,
    auto: false,
    projectile: 'rocket',
    colorHex: 0xff4c1e,
    accentCss: '#ff4c1e',
    adsFov: 60,
    ejectShell: false,
  },
  {
    id: 4,
    slotKey: '5',
    shortName: 'INFERNO-X 화염',
    name: 'INFERNO-X 네이팜 화염방사기',
    role: '지속 착화 · 로봇 과열 합선',
    sound: 'flamer',
    dmg: 16,
    fireRate: 0.075,
    pellets: 1,
    spread: 0.055,
    adsSpread: 0.032,
    mag: 60,
    reload: 1.8,
    recoil: 0.008,
    shake: 0.07,
    dismemberPower: 0.25,
    auto: true,
    projectile: 'flame',
    colorHex: 0xff6a1a,
    accentCss: '#ff6a1a',
    adsFov: 68,
    ejectShell: false,
  },
];

export const PART_MULTIPLIERS: Record<BodyPart, number> = {
  head: 2.5,
  core: 2.2,
  torso: 1.0,
  leftArm: 0.85,
  rightArm: 0.85,
  leftLeg: 0.9,
  rightLeg: 0.9,
  armorFront: 0.55,
  armorLeft: 0.6,
  armorRight: 0.6,
};

export const PART_LABELS_KR: Record<BodyPart, string> = {
  head: '두부 (HEAD)',
  core: '코어 (CORE)',
  torso: '흉부 (TORSO)',
  leftArm: '왼팔 (L-ARM)',
  rightArm: '오른팔 (R-ARM)',
  leftLeg: '왼다리 (L-LEG)',
  rightLeg: '오른다리 (R-LEG)',
  armorFront: '전면 장갑판',
  armorLeft: '좌측 장갑판',
  armorRight: '우측 장갑판',
};

export interface DamageEvalInput {
  baseDamage: number;
  part: BodyPart;
  currentHp: number;
  dismemberPower: number;
  isBoss: boolean;
  alreadyMissing: boolean;
  isVatsGuaranteed?: boolean;
}

export interface DamageEvalResult {
  finalDamage: number;
  newHp: number;
  isCrit: boolean;
  shouldDismember: boolean;
  instantFatal: boolean;
}

export function evaluatePartHit(input: DamageEvalInput): DamageEvalResult {
  const mult = PART_MULTIPLIERS[input.part] ?? 1.0;
  const finalDamage = Math.round(input.baseDamage * mult);
  const isCrit = input.part === 'head' || input.part === 'core';
  let newHp = input.currentHp - finalDamage;

  const canSever =
    input.part !== 'torso' &&
    input.part !== 'core' &&
    !input.alreadyMissing;

  let shouldDismember = false;
  if (canSever) {
    if (input.isVatsGuaranteed) {
      shouldDismember = true;
    } else if (input.part === 'head') {
      shouldDismember = newHp <= 0 || input.dismemberPower >= 1.4;
    } else if (
      input.part === 'armorFront' ||
      input.part === 'armorLeft' ||
      input.part === 'armorRight'
    ) {
      shouldDismember = finalDamage >= 45 || input.dismemberPower >= 1.5;
    } else {
      shouldDismember =
        finalDamage * input.dismemberPower >= 36 ||
        (newHp <= 0 && input.dismemberPower >= 1.15);
    }
  }

  let instantFatal = false;
  if (shouldDismember && !input.isBoss) {
    if (
      input.part === 'head' ||
      input.part === 'leftLeg' ||
      input.part === 'rightLeg'
    ) {
      newHp = Math.min(newHp, 0);
      instantFatal = true;
    }
  }

  return {
    finalDamage,
    newHp,
    isCrit,
    shouldDismember,
    instantFatal,
  };
}

export function resolveXZCollision(
  ent: { x: number; z: number },
  radius: number,
  colliders: readonly AabbCollider[],
  arenaHalf = ARENA_HALF_SIZE
): void {
  const lim = arenaHalf - 1.4 - radius;
  if (ent.x < -lim) ent.x = -lim;
  if (ent.x > lim) ent.x = lim;
  if (ent.z < -lim) ent.z = -lim;
  if (ent.z > lim) ent.z = lim;

  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (!c.alive) continue;
    if (
      ent.x > c.minX - radius &&
      ent.x < c.maxX + radius &&
      ent.z > c.minZ - radius &&
      ent.z < c.maxZ + radius
    ) {
      const dl = Math.abs(ent.x - (c.minX - radius));
      const dr = Math.abs(c.maxX + radius - ent.x);
      const dt = Math.abs(ent.z - (c.minZ - radius));
      const db = Math.abs(c.maxZ + radius - ent.z);
      const m = Math.min(dl, dr, dt, db);
      if (m === dl) ent.x = c.minX - radius;
      else if (m === dr) ent.x = c.maxX + radius;
      else if (m === dt) ent.z = c.minZ - radius;
      else ent.z = c.maxZ + radius;
    }
  }
}

export function createRagdollConstraints(scale: number): VerletLink[] {
  return [
    { a: 'pelvis', b: 'chest', rest: 0.65 * scale },
    { a: 'chest', b: 'head', rest: 0.42 * scale },
    { a: 'chest', b: 'lHand', rest: 0.68 * scale },
    { a: 'chest', b: 'rHand', rest: 0.68 * scale },
    { a: 'pelvis', b: 'lFoot', rest: 0.76 * scale },
    { a: 'pelvis', b: 'rFoot', rest: 0.76 * scale },
    { a: 'pelvis', b: 'head', rest: 1.02 * scale },
    { a: 'lFoot', b: 'rFoot', rest: 0.42 * scale },
  ];
}

export function stepVerletRagdoll(
  nodes: Record<string, VerletNode>,
  links: readonly VerletLink[],
  colliders: readonly AabbCollider[],
  dt = 1 / 60,
  arenaHalf = ARENA_HALF_SIZE
): VerletStepResult {
  const grav = 25 * dt * dt;
  const drag = 0.986;
  const lim = arenaHalf - 1.5;

  let totalSpeed = 0;
  const wallImpacts: VerletStepResult['wallImpacts'] = [];
  const floorImpacts: VerletStepResult['floorImpacts'] = [];
  const nodeKeys = Object.keys(nodes);

  for (let i = 0; i < nodeKeys.length; i++) {
    const p = nodes[nodeKeys[i]];
    const vx = (p.x - p.ox) * drag;
    const vy = (p.y - p.oy) * drag;
    const vz = (p.z - p.oz) * drag;
    p.ox = p.x;
    p.oy = p.y;
    p.oz = p.z;
    p.x += vx;
    p.y += vy - grav;
    p.z += vz;

    // Arena clamp
    if (p.x < -lim) {
      p.x = -lim;
      p.ox = p.x + vx * 0.4;
    } else if (p.x > lim) {
      p.x = lim;
      p.ox = p.x + vx * 0.4;
    }
    if (p.z < -lim) {
      p.z = -lim;
      p.oz = p.z + vz * 0.4;
    } else if (p.z > lim) {
      p.z = lim;
      p.oz = p.z + vz * 0.4;
    }

    // Floor bounce & friction
    if (p.y < p.r) {
      p.y = p.r;
      const horiz = Math.hypot(vx, vz);
      if (horiz > 0.085) {
        floorImpacts.push({ x: p.x, z: p.z });
      }
      p.ox = p.x - vx * 0.6;
      p.oz = p.z - vz * 0.6;
      if (vy < -0.09) {
        p.oy = p.y + vy * 0.28;
      }
    }

    // Wall AABB bounce + splatter impact report
    for (let c = 0; c < colliders.length; c++) {
      const col = colliders[c];
      if (!col.alive || p.y > col.height + 0.1) continue;
      if (
        p.x > col.minX - p.r &&
        p.x < col.maxX + p.r &&
        p.z > col.minZ - p.r &&
        p.z < col.maxZ + p.r
      ) {
        const dl = Math.abs(p.x - (col.minX - p.r));
        const dr = Math.abs(col.maxX + p.r - p.x);
        const dtz = Math.abs(p.z - (col.minZ - p.r));
        const dbz = Math.abs(col.maxZ + p.r - p.z);
        const m = Math.min(dl, dr, dtz, dbz);
        let nx = 0;
        let nz = 0;
        if (m === dl) {
          p.x = col.minX - p.r;
          nx = -1;
          p.ox = p.x + vx * 0.42;
        } else if (m === dr) {
          p.x = col.maxX + p.r;
          nx = 1;
          p.ox = p.x + vx * 0.42;
        } else if (m === dtz) {
          p.z = col.minZ - p.r;
          nz = -1;
          p.oz = p.z + vz * 0.42;
        } else {
          p.z = col.maxZ + p.r;
          nz = 1;
          p.oz = p.z + vz * 0.42;
        }
        if (Math.hypot(vx, vz) > 0.13) {
          wallImpacts.push({ x: p.x, y: p.y, z: p.z, nx, ny: 0, nz });
        }
      }
    }

    totalSpeed += Math.hypot(p.x - p.ox, p.y - p.oy, p.z - p.oz);
  }

  // 4-pass stick constraint solver
  for (let iter = 0; iter < 4; iter++) {
    for (let l = 0; l < links.length; l++) {
      const link = links[l];
      const a = nodes[link.a];
      const b = nodes[link.b];
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      const dist = Math.hypot(dx, dy, dz) || 0.0001;
      const diff = ((dist - link.rest) / dist) * 0.5;
      a.x += dx * diff;
      a.y += dy * diff;
      a.z += dz * diff;
      b.x -= dx * diff;
      b.y -= dy * diff;
      b.z -= dz * diff;
      if (a.y < a.r) a.y = a.r;
      if (b.y < b.r) b.y = b.r;
    }
  }

  return { totalSpeed, wallImpacts, floorImpacts };
}

export function advanceKillstreak(
  currentStreak: number,
  airstrikeReady: boolean
): { streak: number; airstrikeReady: boolean; justCharged: boolean } {
  if (airstrikeReady) {
    return { streak: KILLSTREAK_TARGET, airstrikeReady: true, justCharged: false };
  }
  const next = Math.min(KILLSTREAK_TARGET, currentStreak + 1);
  const ready = next >= KILLSTREAK_TARGET;
  return {
    streak: next,
    airstrikeReady: ready,
    justCharged: ready && !airstrikeReady,
  };
}

export function stepVatsGauge(
  energy: number,
  active: boolean,
  realDt: number
): { energy: number; active: boolean } {
  if (active) {
    const next = Math.max(0, energy - VATS_DRAIN_PER_REAL_SEC * realDt);
    return { energy: next, active: next > 0 };
  }
  const next = Math.min(100, energy + VATS_REGEN_PER_SEC * realDt);
  return { energy: next, active: false };
}

export function computeWaveForKills(kills: number): number {
  return 1 + Math.floor(Math.max(0, kills) / 10);
}

export interface SpawnBalanceProfile {
  maxActiveUnits: number;
  spawnIntervalSec: number;
  batchSize: number;
  allowTitanBoss: boolean;
  enemyHpMult: number;
  maxConcurrentAttackers: number;
}

/**
 * Pure, deterministic AI robot spawn balance curve scaled by Wave and objective progress.
 * Prevents early Wave 1 swarms while escalating smoothly as Relays fall and Core breaches.
 */
export function computeSpawnBalance(
  wave: number,
  relaysDestroyed: number,
  coreShieldDown: boolean
): SpawnBalanceProfile {
  const w = Math.max(1, wave);
  const progressBoost = Math.min(3, relaysDestroyed) + (coreShieldDown ? 1 : 0);
  const maxActiveUnits = Math.min(14, 6 + w + Math.floor(progressBoost * 0.75));
  const spawnIntervalSec = Math.max(3.1, 5.6 - (w - 1) * 0.45 - (coreShieldDown ? 0.5 : 0));
  const batchSize = w >= 3 || coreShieldDown ? 2 : 1;
  const allowTitanBoss = w >= 2 || relaysDestroyed >= 1;
  const enemyHpMult = Number((1 + (w - 1) * 0.1).toFixed(2));
  const maxConcurrentAttackers = w >= 3 ? 3 : 2;

  return {
    maxActiveUnits,
    spawnIntervalSec,
    batchSize,
    allowTitanBoss,
    enemyHpMult,
    maxConcurrentAttackers,
  };
}

export function formatClock(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export type AmmoGaugeStatus = 'optimal' | 'tactical' | 'low' | 'critical' | 'reloading';
export type AmmoGaugeUnitMode = 'shells' | 'rounds' | 'cells';

export interface AmmoGaugeSegment {
  index: number;
  fill: number; // 0..1 exact fill fraction for this segment
  state: 'filled' | 'partial' | 'empty';
}

export interface AmmoGaugeInput {
  ammo: number;
  mag: number;
  reloading: boolean;
  reloadPct: number;
  reloadPhasePct: number;
  reloadStageGroup: 'idle' | 'emptying' | 'loading';
  reloadEmptyThreshold: number;
  reloadIsTactical: boolean;
  reloadAccentCss: string;
}

export interface AmmoGaugeState {
  ammo: number;
  mag: number;
  fillRatio: number; // 0..1
  fillPct: number; // 0..100
  segmentCount: number;
  unitMode: AmmoGaugeUnitMode;
  segments: AmmoGaugeSegment[];
  status: AmmoGaugeStatus;
  accentCss: string;
  statusTag: string;
  lowAmmoAlert: boolean;
  emptySplitPct: number;
}

/**
 * Pure calculation for the HUD visual ammunition tracking gauge.
 * Adapts discrete segment density to weapon capacity (1:1 for heavy shells/coils,
 * paired notches for rifles, fuel pressure cells for high-capacity flamers) and
 * synchronizes smoothly with emptying/loading reload phases.
 */
export function computeAmmoGaugeState(input: AmmoGaugeInput): AmmoGaugeState {
  const mag = Math.max(1, Math.floor(input.mag));
  const ammo = Math.max(0, Math.min(mag, input.ammo));
  const rawRatio = ammo / mag;
  const emptySplitPct = Math.round(
    Math.max(0.05, Math.min(0.95, input.reloadEmptyThreshold || 0.4)) * 100
  );

  let fillRatio = rawRatio;
  if (input.reloading && input.reloadStageGroup === 'emptying') {
    fillRatio = Math.max(0, Math.min(1, rawRatio * (1 - input.reloadPhasePct / 100)));
  } else if (input.reloading && input.reloadStageGroup === 'loading') {
    fillRatio = Math.max(
      0,
      Math.min(1, (input.reloadPct - emptySplitPct) / Math.max(1, 100 - emptySplitPct))
    );
  }

  const fillPct = Math.round(fillRatio * 100);

  let segmentCount: number;
  let unitMode: AmmoGaugeUnitMode;
  if (mag <= 12) {
    segmentCount = mag;
    unitMode = 'shells';
  } else if (mag <= 36) {
    segmentCount = Math.min(16, Math.ceil(mag / 2));
    unitMode = 'rounds';
  } else {
    segmentCount = 12;
    unitMode = 'cells';
  }

  const scaled = fillRatio * segmentCount;
  const segments: AmmoGaugeSegment[] = [];
  for (let i = 0; i < segmentCount; i++) {
    const segFill = Math.max(0, Math.min(1, scaled - i));
    const state: AmmoGaugeSegment['state'] =
      segFill >= 0.999 ? 'filled' : segFill > 0.001 ? 'partial' : 'empty';
    segments.push({ index: i, fill: Number(segFill.toFixed(4)), state });
  }

  let status: AmmoGaugeStatus;
  let accentCss: string;
  let statusTag: string;
  let lowAmmoAlert = false;

  if (input.reloading) {
    status = 'reloading';
    accentCss = input.reloadIsTactical ? '#56c2ff' : input.reloadAccentCss || '#e89b3c';
    statusTag =
      input.reloadStageGroup === 'emptying'
        ? input.reloadIsTactical
          ? 'SWAP'
          : 'EJECT'
        : input.reloadIsTactical
          ? 'TAC'
          : 'LOAD';
  } else if (ammo <= 0) {
    status = 'critical';
    accentCss = '#dc4c4c';
    statusTag = 'EMPTY';
    lowAmmoAlert = true;
  } else if (ammo <= Math.max(1, Math.floor(mag * 0.25))) {
    status = 'low';
    accentCss = '#f87171';
    statusTag = 'LOW';
    lowAmmoAlert = true;
  } else if (ammo < mag) {
    status = 'tactical';
    accentCss = '#e89b3c';
    statusTag = 'TAC-R';
  } else {
    status = 'optimal';
    accentCss = '#e89b3c';
    statusTag = 'FULL';
  }

  return {
    ammo,
    mag,
    fillRatio,
    fillPct,
    segmentCount,
    unitMode,
    segments,
    status,
    accentCss,
    statusTag,
    lowAmmoAlert,
    emptySplitPct,
  };
}

