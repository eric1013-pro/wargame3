export enum Faction {
  PLAYER = 0,
  RAIDER = 1,
  SYNDICATE = 2,
  ROBOT = 3,
}

export enum UnitArchetype {
  RAIDER_BERSERKER = 'raider_berserker',
  RAIDER_TROOPER = 'raider_trooper',
  SYNDICATE_COMMANDO = 'syndicate_commando',
  SYNDICATE_HEAVY = 'syndicate_heavy',
  ROBOT_STALKER = 'robot_stalker',
  ROBOT_ENFORCER = 'robot_enforcer',
  ROBOT_TITAN = 'robot_titan',
}

export type BodyPart =
  | 'head'
  | 'torso'
  | 'leftArm'
  | 'rightArm'
  | 'leftLeg'
  | 'rightLeg'
  | 'armorFront'
  | 'armorLeft'
  | 'armorRight'
  | 'core';

export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover' | 'victory';
export type GraphicsQuality = 'ultra' | 'high';

export interface WeaponSpec {
  id: number;
  slotKey: string;
  shortName: string;
  name: string;
  role: string;
  sound: 'rifle' | 'shotgun' | 'railgun' | 'rocket' | 'flamer';
  dmg: number;
  fireRate: number;
  pellets: number;
  spread: number;
  adsSpread: number;
  mag: number;
  reload: number;
  recoil: number;
  shake: number;
  dismemberPower: number;
  auto: boolean;
  pierce?: boolean;
  projectile?: 'rocket' | 'flame';
  colorHex: number;
  accentCss: string;
  adsFov: number;
  ejectShell?: boolean;
}

export interface AabbCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
  alive: boolean;
}

export interface VerletNode {
  x: number;
  y: number;
  z: number;
  ox: number;
  oy: number;
  oz: number;
  r: number;
}

export interface VerletLink {
  a: string;
  b: string;
  rest: number;
}

export interface VerletStepResult {
  totalSpeed: number;
  wallImpacts: Array<{ x: number; y: number; z: number; nx: number; ny: number; nz: number }>;
  floorImpacts: Array<{ x: number; z: number }>;
}

export interface KillFeedItem {
  id: number;
  killerFaction: number; // -1 for artillery/environment
  killerName: string;
  victimFaction: number;
  victimName: string;
  tag: string;
}

export interface VatsTargetBox {
  unitId: number;
  unitName: string;
  faction: Faction;
  part: BodyPart;
  partLabel: string;
  multiplier: number;
  hitChance: number;
  screenX: number;
  screenY: number;
  distance: number;
  hpPct: number;
}

export type CommsSender = 'exo' | 'arcadia' | 'holotape';
export type CinematicSequenceId = 'none' | 'opening' | 'breach' | 'dawn';
export type BgmMood = 'opening' | 'combat' | 'breach' | 'dawn';

export interface ChapterTitleCard {
  id: number;
  actCode: string;
  title: string;
  metaLine: string;
  accentCss: string;
  visibleChars: number;
  opacity: number;
}

export interface CinematicHudState {
  active: boolean;
  sequence: CinematicSequenceId;
  letterbox: boolean;
  canSkip: boolean;
  elapsed: number;
  duration: number;
  invulnerable?: boolean;
  blackoutOpacity: number;
  ecgPhase: number; // < 0 hidden, 0..1 sweep
  visorBootStep: number; // 0 hidden, 1..3 boot lines
  blurPx: number;
  glitchIntensity: number; // 0..1 RGB chromatic glitch
  emergencyRedOpacity: number;
  whiteoutOpacity: number;
  dawnProgress: number; // 0..1 sky/fog morph
  chapterCard: ChapterTitleCard | null;
}

export interface RadioTransmission {
  id: number;
  speaker: string;
  role: string;
  channel: 'ally' | 'enemy' | 'warning' | 'holotape';
  sender: CommsSender;
  accentCss: string;
  text: string;
  lineIndex?: number;
  lineTotal?: number;
}

export interface CompassContact {
  id: number;
  relativeDeg: number; // -180..180 relative to player look direction
  distance: number;
  faction: Faction;
  isBoss: boolean;
  isHolotape?: boolean;
  isRelay?: boolean;
  isServerCore?: boolean;
}

export interface FloatingDamageNumber {
  id: number;
  text: string;
  subLabel?: string;
  screenX: number;
  screenY: number;
  color: string;
  isCrit: boolean;
  age: number; // 0..1 normalized progress
  opacity: number;
}

export interface TimelineBucket {
  timeSec: number;
  label: string;
  kills: number;
  dismembers: number;
}

export interface CombatAnalyticsData {
  deaths: number;
  shotsFired: number;
  shotsHit: number;
  killsByFaction: {
    raider: number;
    syndicate: number;
    robot: number;
  };
  partBreakdown: {
    head: number;
    arm: number;
    leg: number;
    armor: number;
    gloryKill: number;
  };
  timeline: TimelineBucket[];
  holotapesFound: number;
  holotapesTotal: number;
}

export interface MinimapWall {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  kind: 'maze' | 'bunker' | 'citadel' | 'barricade';
}

export interface MinimapDot {
  id: string;
  x: number;
  z: number;
  kind: 'raider' | 'syndicate' | 'robot' | 'boss' | 'relay' | 'holotape' | 'core';
}

export type ReloadPhase = 'idle' | 'emptying' | 'loading' | 'chambering';
export type ReloadStageGroup = 'idle' | 'emptying' | 'loading';

export interface HudSnapshot {
  phase: GamePhase;
  wave: number;
  actNumber: number;
  actTitle: string;
  objectiveText: string;
  objectiveProgressPct: number;
  holotapesFound: number;
  holotapesTotal: number;
  relaysDestroyed: number;
  relaysTotal: number;
  coreShieldDown: boolean;
  coreHp: number;
  coreMaxHp: number;
  canShutdownCore: boolean;
  coreDistance: number;
  serverShutdownActive: boolean;
  kills: number;
  dismembers: number;
  executions: number;
  survivalTime: number;
  hp: number;
  maxHp: number;
  armor: number;
  maxArmor: number;
  weaponIdx: number;
  ammo: number;
  mag: number;
  reloading: boolean;
  reloadPct: number;
  reloadPhase: ReloadPhase;
  reloadStageGroup: ReloadStageGroup;
  reloadPhaseLabel: string;
  reloadStageBadge: string;
  reloadPhasePct: number;
  reloadEmptyThreshold: number;
  reloadAccentCss: string;
  reloadIsTactical: boolean;
  reloadSpeedBonusPct: number;
  reloadDurationSec: number;
  grenades: number;
  ads: boolean;
  sprinting: boolean;
  crosshairGap: number;
  vatsEnergy: number; // 0..100
  vatsActive: boolean;
  vatsTargets: VatsTargetBox[];
  killstreak: number; // 0..5
  airstrikeReady: boolean;
  gloryKillTargetName: string | null;
  alertBanner: string | null;
  calloutText: string | null;
  calloutColor: string;
  comms: RadioTransmission | null;
  cinematic: CinematicHudState;
  ttsEnabled: boolean;
  playerYawDeg: number;
  playerX: number;
  playerZ: number;
  minimapWalls: MinimapWall[];
  minimapDots: MinimapDot[];
  compassContacts: CompassContact[];
  floatingDamages: FloatingDamageNumber[];
  analytics: CombatAnalyticsData;
  hitmarkerSeq: number;
  hitmarkerCrit: boolean;
  damageFlashSeq: number;
  damageDirDeg: number;
  blastFlashSeq: number;
  empFlashSeq: number;
  lowHpIntensity: number; // 0..1
  muted: boolean;
  pointerLocked: boolean;
  causeOfDeath: string;
  bossName: string | null;
  bossHpPct: number;
  killFeed: KillFeedItem[];
}
