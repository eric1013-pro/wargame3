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
  SYNDICATE_SNIPER = 'syndicate_sniper',
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
export type GameMode = 'campaign' | 'freeroam';
export type EndingId = 'dawn' | 'symbiosis' | 'ascension';
export type StyleGrade = 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS';
export type CampaignMissionId = 1 | 2 | 3 | 4;
export type CampaignStageId =
  | 'm1_landing'
  | 'm1_beachhead'
  | 'm2_alley'
  | 'm2_breach_slowmo'
  | 'm2_survivor_ghost'
  | 'm3_heli_insert'
  | 'm3_ac130_flir'
  | 'm4_tank_assault'
  | 'm4_elevator_breach'
  | 'm4_tower_assault'
  | 'm4_sacrifice_crisis'
  | 'm4_final_core';

export interface TankHudState {
  available: boolean;
  driving: boolean;
  nearPrompt: boolean;
  hp: number;
  maxHp: number;
  cannonReloadPct: number;
  coaxHeatPct: number;
  speedKmh: number;
  hullHeadingDeg: number;
  turretRelativeDeg: number;
  gunnerOptic: boolean;
  apsReady: boolean;
  distanceM: number;
}

export interface HeliRideHudState {
  active: boolean;
  progressPct: number;
  altitudeM: number;
  speedKts: number;
  minigunHeatPct: number;
  minigunOverheated: boolean;
  targetsDestroyed: number;
  targetsTotal: number;
}

export interface CampaignChoiceState {
  survivorRescued: boolean | null;
  ghostTrust: number;
  squadmateSaved: boolean | null;
}

export interface CampaignPromptChoice {
  id: 'm2_ghost_survivor' | 'm4_squad_sacrifice';
  title: string;
  subtitle: string;
  optionFLabel: string;
  optionGLabel: string;
  remainingSec: number | null;
}

export interface Ac130HudState {
  active: boolean;
  weaponIdx: 0 | 1 | 2;
  caliber: string;
  weaponName: string;
  reloadPct: number; // 100 = ready
  thermalMode: 'whot' | 'bhot';
  zoomed: boolean;
  altitudeM: number;
  headingDeg: number;
  friendlyStrobes: Array<{ id: string; label: string; screenX: number; screenY: number }>;
  hostileMarkers: Array<{ id: number; screenX: number; screenY: number; isHeavy: boolean }>;
}

export interface SquadmateTag {
  id: string;
  name: string;
  screenX: number;
  screenY: number;
  distanceM: number;
  status: 'active' | 'wounded' | 'ghost';
}

export interface WeaponSpec {
  id: number;
  slotKey: string;
  shortName: string;
  name: string;
  role: string;
  sound: 'rifle' | 'shotgun' | 'railgun' | 'rocket' | 'flamer' | 'tesla';
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
  chainLightning?: boolean;
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
  minY?: number;
  alive: boolean;
  /** Light urban obstacles (sandbags, crates, bollards, sedans, barricades) crushed effortlessly by K2-X Tank */
  tankCrushable?: boolean;
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
  killerFaction: number; // -1 for artillery/environment, -2 for allied turret
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

export type CommsSender = 'exo' | 'arcadia' | 'holotape' | 'valkyrie' | 'ghost9' | 'squad' | 'gunship';
export type CinematicSequenceId =
  | 'none'
  | 'opening'
  | 'titan_drop'
  | 'breach'
  | 'choice'
  | 'dawn'
  | 'symbiosis'
  | 'ascension';
export type BgmMood =
  | 'opening'
  | 'combat'
  | 'escalation'
  | 'breach'
  | 'choice'
  | 'dawn'
  | 'symbiosis'
  | 'ascension';

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
  visorBootStep: number; // 0 hidden, 1..4 boot lines
  blurPx: number;
  glitchIntensity: number; // 0..1 RGB chromatic glitch
  emergencyRedOpacity: number;
  whiteoutOpacity: number;
  dawnProgress: number; // 0..1 sky/fog morph
  endingTheme: EndingId | null;
  chapterCard: ChapterTitleCard | null;
}

export interface RadioTransmission {
  id: number;
  speaker: string;
  role: string;
  channel: 'ally' | 'enemy' | 'warning' | 'holotape';
  sender: CommsSender;
  callsignCode?: string;
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
  isTurret?: boolean;
  isSupply?: boolean;
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
  kind: 'raider' | 'syndicate' | 'robot' | 'boss' | 'relay' | 'holotape' | 'core' | 'turret' | 'supply';
}

export interface AimTargetTelemetry {
  name: string;
  roleTag: string;
  hpPct: number;
  distanceM: number;
  accentCss: string;
  isBoss: boolean;
  weakpointHint?: string;
}

export interface WorldWaypointMarker {
  id: string;
  label: string;
  distanceM: number;
  screenX: number;
  screenY: number;
  accentCss: string;
  kind: 'relay' | 'core' | 'supply' | 'turret';
  opacity: number;
}

export interface CombatMedalItem {
  id: number;
  title: string;
  subtitle: string;
  accentCss: string;
}

export type ReloadPhase = 'idle' | 'emptying' | 'loading' | 'chambering';
export type ReloadStageGroup = 'idle' | 'emptying' | 'loading';

export type WeaponAttachmentId = 'standard' | 'suppressor' | 'extended_mag' | 'ap_rounds';
export type SquadOrderId = 'follow' | 'regroup' | 'suppress';

export interface HudSnapshot {
  phase: GamePhase;
  gameMode: GameMode;
  missionId: CampaignMissionId;
  missionStage: CampaignStageId;
  missionTitle: string;
  checkpointSeq: number;
  checkpointLabel: string;
  campaignChoices: CampaignChoiceState;
  campaignPrompt: CampaignPromptChoice | null;
  autoEndingReason: string | null;
  ac130: Ac130HudState;
  tank: TankHudState;
  heliRide: HeliRideHudState;
  squadTags: SquadmateTag[];
  firstPersonSetpieceActive: boolean;
  breachPromptVisible: boolean;
  armorPlates: number;
  maxArmorPlates: number;
  platingActive: boolean;
  platingPct: number;
  smokeGrenades: number;
  maxSmokeGrenades: number;
  inSmokeCover: boolean;
  squadOrder: SquadOrderId;
  weaponAttachment: WeaponAttachmentId;
  wave: number;
  actNumber: number;
  actTitle: string;
  objectiveText: string;
  objectiveProgressPct: number;
  holotapesFound: number;
  holotapesTotal: number;
  unlockedHolotapeIds: string[];
  relaysDestroyed: number;
  relaysTotal: number;
  coreShieldDown: boolean;
  coreHp: number;
  coreMaxHp: number;
  canShutdownCore: boolean;
  coreDistance: number;
  serverShutdownActive: boolean;
  choiceActive: boolean;
  endingId: EndingId | null;
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
  adsBlend: number; // 0..1 smooth optic raise transition
  scopedOpticActive: boolean; // true when Railgun 2.8x optical scope lens is fully engaged
  holdingBreath: boolean;
  mounted: boolean; // MWIII automatic wall/cover weapon mount (-68% recoil)
  leanDir: -1 | 0 | 1; // MWIII Q/E tactical ADS lean
  wallBlocked: boolean; // Barrel raised upward on tight wall collision
  isIndoors: boolean; // Eye Adaptation indoor shelter/balcony state
  inspectingWeapon: boolean;
  aimDistanceM: number | null;
  aimTarget: AimTargetTelemetry | null;
  waypoints: WorldWaypointMarker[];
  medals: CombatMedalItem[];
  wantedFlashSeq: number;
  sprinting: boolean;
  isSliding: boolean;
  isDashing: boolean;
  dashCharges: number;
  dashMaxCharges: number;
  dashChargePct: number;
  crosshairGap: number;
  vatsEnergy: number; // 0..100
  vatsActive: boolean;
  vatsTargets: VatsTargetBox[];
  killstreak: number; // 0..5
  airstrikeReady: boolean;
  supplyDropReady: boolean;
  supplyDropCooldownPct: number;
  overdriveTimer: number;
  adrenalineActive: boolean;
  adrenalineUsed: boolean;
  threatLevel: number; // 1..5 GTA-style Wanted Stars
  threatLabel: string;
  threatProgressPct: number;
  comboCount: number;
  comboTimerPct: number;
  styleGrade: StyleGrade;
  styleLabel: string;
  turretsHacked: number;
  turretsTotal: number;
  nearHackableTurretName: string | null;
  killCamActive: boolean;
  killCamBanner: string | null;
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
  bossPhase: number;
  killFeed: KillFeedItem[];
}
