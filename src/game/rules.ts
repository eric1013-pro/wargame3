import {
  AabbCollider,
  BodyPart,
  Faction,
  StyleGrade,
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
export const DASH_MAX_CHARGES = 2;
export const DASH_RECHARGE_SEC = 3.2;

export const FACTION_META: Record<
  number,
  { name: string; colorHex: number; cssColor: string; accentHex: number }
> = {
  [-2]: {
    name: '고스트-9 자동 포탑',
    colorHex: 0x2dd4bf,
    cssColor: '#2dd4bf',
    accentHex: 0x14b8a6,
  },
  [-1]: {
    name: '발키리 궤도 포격',
    colorHex: 0xffc83d,
    cssColor: '#ffc83d',
    accentHex: 0xff8800,
  },
  [Faction.PLAYER]: {
    name: '이안 케인 (SUBJECT-00)',
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
    adsFov: 52,
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
    adsFov: 64,
    ejectShell: true,
  },
  {
    id: 2,
    slotKey: '3',
    shortName: 'RAIL-X9 레일건',
    name: 'RAIL-X9 대물 전자기 레일건',
    role: '일직선 관통 · 2.8x 투명 스코프',
    sound: 'railgun',
    dmg: 155,
    fireRate: 0.92,
    pellets: 1,
    spread: 0.002,
    adsSpread: 0.0003,
    mag: 4,
    reload: 1.85,
    recoil: 0.11,
    shake: 0.54,
    dismemberPower: 2.4,
    auto: false,
    pierce: true,
    colorHex: 0x26f0ff,
    accentCss: '#26f0ff',
    adsFov: 28,
    ejectShell: false,
  },
  {
    id: 3,
    slotKey: '4',
    shortName: 'HYDRA-7 로켓',
    name: 'HYDRA-7 로켓 런처',
    role: '랙돌 폭풍 · 드롭쉽 격추',
    sound: 'rocket',
    dmg: 260,
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
  {
    id: 5,
    slotKey: '6',
    shortName: 'ZEUS-MK7 아크',
    name: 'ZEUS-MK7 연쇄 아크 테슬라 캐논',
    role: '3연쇄 고압 전격 · 회로 마비',
    sound: 'tesla',
    dmg: 46,
    fireRate: 0.24,
    pellets: 1,
    spread: 0.018,
    adsSpread: 0.006,
    mag: 18,
    reload: 1.55,
    recoil: 0.032,
    shake: 0.2,
    dismemberPower: 1.15,
    auto: true,
    chainLightning: true,
    colorHex: 0x38e8ff,
    accentCss: '#38e8ff',
    adsFov: 58,
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
  arenaHalf = ARENA_HALF_SIZE,
  feetY = 0
): void {
  const lim = arenaHalf - 1.4 - radius;
  const clampArena = () => {
    if (ent.x < -lim) ent.x = -lim;
    if (ent.x > lim) ent.x = lim;
    if (ent.z < -lim) ent.z = -lim;
    if (ent.z > lim) ent.z = lim;
  };
  clampArena();

  // 2-pass iterative AABB separation prevents corner-pinch push-through into adjacent obstacles
  for (let pass = 0; pass < 2; pass++) {
    let moved = false;
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (!c.alive) continue;
      // Skip obstacles strictly below our current standing elevation (e.g. standing on 2F above 1F cover),
      // without allowing mid-air jump clipping inside ground barriers!
      if (feetY >= c.height - 0.12) continue;
      // Skip elevated obstacles strictly above our head (e.g. walking on 1F below a 2F parapet)
      if (c.minY !== undefined && feetY + 1.65 <= c.minY) continue;
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
        moved = true;
      }
    }
    clampArena();
    if (!moved) break;
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

export function stepDashCharges(
  charges: number,
  rechargeTimer: number,
  dt: number,
  maxCharges = DASH_MAX_CHARGES,
  rechargeSec = DASH_RECHARGE_SEC
): { charges: number; rechargeTimer: number; chargePct: number } {
  if (charges >= maxCharges) {
    return { charges: maxCharges, rechargeTimer: 0, chargePct: 100 };
  }
  let nextCharges = charges;
  let nextTimer = rechargeTimer + Math.max(0, dt);
  while (nextTimer >= rechargeSec && nextCharges < maxCharges) {
    nextTimer -= rechargeSec;
    nextCharges++;
  }
  if (nextCharges >= maxCharges) {
    return { charges: maxCharges, rechargeTimer: 0, chargePct: 100 };
  }
  return {
    charges: nextCharges,
    rechargeTimer: nextTimer,
    chargePct: Math.round((nextTimer / rechargeSec) * 100),
  };
}

export interface ThreatState {
  level: number; // 1..5
  label: string;
  progressPct: number;
  colorCss: string;
}

const THREAT_THRESHOLDS = [0, 70, 170, 300, 460] as const;
const THREAT_LABELS = [
  '순찰 경계',
  '전술 봉쇄',
  '공중 강습',
  '궤도 포위',
  '말살 프로토콜',
] as const;
const THREAT_COLORS = ['#94a3b8', '#38bdf8', '#f59e0b', '#f97316', '#ef4444'] as const;

/**
 * GTA-style 5-star OMNI Threat Level escalation based on accumulated chaos/destruction points.
 */
export function computeThreatState(points: number): ThreatState {
  const p = Math.max(0, points);
  let idx = 0;
  for (let i = THREAT_THRESHOLDS.length - 1; i >= 0; i--) {
    if (p >= THREAT_THRESHOLDS[i]) {
      idx = i;
      break;
    }
  }
  const level = idx + 1;
  let progressPct = 100;
  if (idx < THREAT_THRESHOLDS.length - 1) {
    const start = THREAT_THRESHOLDS[idx];
    const end = THREAT_THRESHOLDS[idx + 1];
    progressPct = Math.max(0, Math.min(100, Math.round(((p - start) / (end - start)) * 100)));
  }
  return {
    level,
    label: THREAT_LABELS[idx],
    progressPct,
    colorCss: THREAT_COLORS[idx],
  };
}

export interface StyleRankState {
  grade: StyleGrade;
  label: string;
  colorCss: string;
  damageMult: number;
}

/**
 * CoD × Stylish Action Combat Momentum Rank (D..SSS) based on rapid combo chain & style score.
 */
export function computeStyleRank(comboCount: number, styleScore: number): StyleRankState {
  const score = Math.max(0, styleScore) + Math.max(0, comboCount) * 18;
  if (score >= 220 || comboCount >= 10) {
    return { grade: 'SSS', label: 'APOCALYPSE', colorCss: '#ff4422', damageMult: 1.25 };
  }
  if (score >= 155 || comboCount >= 7) {
    return { grade: 'SS', label: 'RELENTLESS', colorCss: '#f59e0b', damageMult: 1.18 };
  }
  if (score >= 105 || comboCount >= 5) {
    return { grade: 'S', label: 'LETHAL', colorCss: '#fbbf24', damageMult: 1.12 };
  }
  if (score >= 65 || comboCount >= 3) {
    return { grade: 'A', label: 'ASSAULT', colorCss: '#38d9ff', damageMult: 1.07 };
  }
  if (score >= 35 || comboCount >= 2) {
    return { grade: 'B', label: 'TACTICAL', colorCss: '#2ee6a6', damageMult: 1.03 };
  }
  if (score >= 15 || comboCount >= 1) {
    return { grade: 'C', label: 'ENGAGED', colorCss: '#cbd5e1', damageMult: 1.0 };
  }
  return { grade: 'D', label: 'STANDBY', colorCss: '#64748b', damageMult: 1.0 };
}

export function computeWaveForKills(kills: number): number {
  return 1 + Math.floor(Math.max(0, kills) / 10);
}

export interface SpawnBalanceProfile {
  maxActiveUnits: number;
  spawnIntervalSec: number;
  batchSize: number;
  allowTitanBoss: boolean;
  allowSnipers: boolean;
  enemyHpMult: number;
  maxConcurrentAttackers: number;
}

/**
 * Pure, deterministic AI robot spawn balance curve scaled by Wave, objective progress, and GTA Threat Level.
 * Prevents early Wave 1 swarms while escalating smoothly as Relays fall, Threat stars climb, and Core breaches.
 */
export function computeSpawnBalance(
  wave: number,
  relaysDestroyed: number,
  coreShieldDown: boolean,
  threatLevel = 1
): SpawnBalanceProfile {
  const w = Math.max(1, wave);
  const t = Math.max(1, Math.min(5, threatLevel));
  const progressBoost = Math.min(3, relaysDestroyed) + (coreShieldDown ? 1 : 0);
  const threatBoost = t >= 4 ? 2 : t >= 3 ? 1 : 0;
  const maxActiveUnits = Math.min(15, 6 + w + Math.floor(progressBoost * 0.75) + threatBoost);
  const spawnIntervalSec = Math.max(
    2.8,
    5.6 - (w - 1) * 0.45 - (coreShieldDown ? 0.5 : 0) - (t - 1) * 0.16
  );
  const batchSize = w >= 3 || coreShieldDown || t >= 4 ? 2 : 1;
  const allowTitanBoss = w >= 2 || relaysDestroyed >= 1 || t >= 4;
  const allowSnipers = w >= 2 || relaysDestroyed >= 1 || t >= 2;
  const enemyHpMult = Number((1 + (w - 1) * 0.1).toFixed(2));
  const maxConcurrentAttackers = w >= 3 || t >= 4 ? 3 : 2;

  return {
    maxActiveUnits,
    spawnIntervalSec,
    batchSize,
    allowTitanBoss,
    allowSnipers,
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

export interface TankDriveState {
  x: number;
  z: number;
  hullYaw: number;
  speed: number;
}

/**
 * Pure heavy-armored K2-X Black Panther tank drive kinematics (faces -Z at hullYaw=0,
 * supports dual-track neutral steering + AABB obstacle resolution).
 */
export function stepTankDrivePhysics(
  state: TankDriveState,
  fwdInput: number,
  turnInput: number,
  dt: number,
  colliders: readonly AabbCollider[],
  arenaHalf = ARENA_HALF_SIZE
): TankDriveState {
  const maxFwd = 12.6; // ~45 km/h urban combat speed
  const maxRev = -6.8;
  const accel = 16.5;
  const decel = 14.0;
  const turnRate = 1.28;

  // Invert turn when reversing for intuitive armored vehicle steering (W/S/A/D)
  const steerSign = state.speed < -0.5 ? -1 : 1;
  const hullYaw = state.hullYaw - turnInput * turnRate * steerSign * dt;

  let speed = state.speed;
  if (fwdInput > 0) {
    speed = Math.min(maxFwd, speed + accel * dt);
  } else if (fwdInput < 0) {
    speed = Math.max(maxRev, speed - accel * 0.9 * dt);
  } else {
    if (Math.abs(speed) <= decel * dt) speed = 0;
    else speed -= Math.sign(speed) * decel * dt;
  }

  const pos = {
    x: state.x - Math.sin(hullYaw) * speed * dt,
    z: state.z - Math.cos(hullYaw) * speed * dt,
  };
  const preX = pos.x;
  const preZ = pos.z;
  resolveXZCollision(pos, 2.05, colliders, arenaHalf, 0);
  // Dampen forward speed cleanly on solid wall contact
  if (Math.hypot(pos.x - preX, pos.z - preZ) > 0.08) {
    speed *= 0.35;
  }

  return { x: pos.x, z: pos.z, hullYaw, speed };
}

/**
 * Pure M134 helicopter rotary minigun barrel heat & overheat recovery curve (0..100).
 */
export function stepHeliMinigunHeat(
  heat: number,
  overheated: boolean,
  firing: boolean,
  dt: number
): { heat: number; overheated: boolean } {
  let nextHeat = heat;
  let nextOverheated = overheated;
  if (firing && !overheated) {
    nextHeat = Math.min(100, nextHeat + 26 * dt);
    if (nextHeat >= 100) nextOverheated = true;
  } else {
    const coolRate = nextOverheated ? 34 : 42;
    nextHeat = Math.max(0, nextHeat - coolRate * dt);
    if (nextOverheated && nextHeat <= 28) nextOverheated = false;
  }
  return { heat: nextHeat, overheated: nextOverheated };
}
