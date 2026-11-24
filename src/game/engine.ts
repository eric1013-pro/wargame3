import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FootstepSurface, WarAudioEngine } from './audio';
import {
  buildEnemyGlbRig,
  EnemyGlbTemplates,
  K2TankGlbParts,
  loadAndAttachBattlefieldGlbProps,
  loadAndAttachGlbWeapons,
  loadK2BlackPantherGlb,
  loadUh60GunshipGlb,
  preloadEnemyGlbTemplates,
  Uh60GunshipGlbParts,
} from './glbLoader';
import {
  buildDropshipModel,
  buildEnemyModel,
  buildRokSquadmateModel,
  buildSupplyPodModel,
  buildViewmodelRig,
  EnemyRig,
  RokSquadmateRig,
  ViewmodelRig,
} from './models';
import {
  AC130_WEAPONS,
  computeCampaignObjectiveText,
  createInitialCampaignChoices,
  getMissionProfile,
  getWeaponAttachmentSpec,
  resolveCampaignAutoEnding,
} from './campaignMissions';
import { createExtendedPbrLibrary, ExtendedPbrLibrary } from './pbrMaterials';
import {
  advanceKillstreak,
  ARENA_HALF_SIZE,
  computeSpawnBalance,
  computeStyleRank,
  computeThreatState,
  computeWaveForKills,
  createRagdollConstraints,
  DASH_MAX_CHARGES,
  DASH_RECHARGE_SEC,
  evaluatePartHit,
  FACTION_META,
  formatClock,
  PART_LABELS_KR,
  PART_MULTIPLIERS,
  resolveXZCollision,
  stepDashCharges,
  stepHeliMinigunHeat,
  stepTankDrivePhysics,
  stepVatsGauge,
  stepVerletRagdoll,
  VATS_MIN_ACTIVATE,
  VATS_TIME_SCALE,
  WEAPONS,
} from './rules';
import { createEmptyAnalytics } from './analytics';
import {
  computeMissionObjective,
  getStoryActForWave,
  RADIO_SCRIPTS,
  WASTELAND_HOLOTAPES,
  WastelandHolotape,
} from './story';
import { createProceduralTextures, ProceduralTextureSet } from './textures';
import { VolumetricVfxSystem } from './vfxSystem';
import { buildOmniCoreWorld, BuiltWorldRefs, RelayPylonEntity } from './worldBuilder';
import { CinematicDirector } from './cinematicDirector';
import { computeReloadTiming, evaluateWeaponReload } from './reloadSystem';
import {
  AabbCollider,
  Ac130HudState,
  AimTargetTelemetry,
  BgmMood,
  BodyPart,
  CampaignChoiceState,
  CampaignMissionId,
  CampaignPromptChoice,
  CampaignStageId,
  CombatAnalyticsData,
  CombatMedalItem,
  CommsSender,
  CompassContact,
  EndingId,
  Faction,
  FloatingDamageNumber,
  GameMode,
  GamePhase,
  GraphicsQuality,
  HeliRideHudState,
  HudSnapshot,
  KillFeedItem,
  MinimapDot,
  SquadmateTag,
  SquadOrderId,
  TankHudState,
  UnitArchetype,
  VatsTargetBox,
  VerletLink,
  VerletNode,
  WeaponAttachmentId,
  WorldWaypointMarker,
} from './types';

interface WorldCollider extends AabbCollider {
  mesh: THREE.Object3D;
  destructible: boolean;
  hp: number;
}

interface ExplosiveBarrel {
  x: number;
  z: number;
  r: number;
  mesh: THREE.Mesh;
  collider: WorldCollider;
  hp: number;
  alive: boolean;
}

interface ActiveUnit {
  id: number;
  faction: Faction;
  archetype: UnitArchetype;
  isRobot: boolean;
  isBoss: boolean;
  name: string;
  scale: number;
  rig: EnemyRig;
  x: number;
  y: number;
  z: number;
  r: number;
  yaw: number;
  hp: number;
  maxHp: number;
  speed: number;
  fireRate: number;
  fireCd: number;
  dmg: number;
  missing: Partial<Record<BodyPart, boolean>>;
  armorPlateHp: Partial<Record<BodyPart, number>>;
  staggerTimer: number;
  burnTimer: number;
  empStunTimer: number;
  stunImmuneTimer: number;
  walkPhase: number;
  strafeDir: number;
  strafeCd: number;
  hitFlash: number;
  hitFlinch: number;
  fireRecoil: number;
  sniperCharge: number;
  bossPhase: number;
  bossMissileCd: number;
  alive: boolean;
}

interface ActiveSupplyDrop {
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  landed: boolean;
  collected: boolean;
  life: number;
}

interface ActiveRagdoll {
  nodes: Record<string, VerletNode>;
  links: VerletLink[];
  visuals: Array<{ a: string; b: string; mesh: THREE.Mesh }>;
  group: THREE.Group;
  isRobot: boolean;
  age: number;
  settled: boolean;
  smearCd: number;
}

interface ActiveGib {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  isRobot: boolean;
  isLimb: boolean;
  life: number;
  bounces: number;
}

interface ActiveShell {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  life: number;
  bounces: number;
}

interface ActiveParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  grav: number;
  life: number;
  maxLife: number;
}

interface ActiveRocket {
  mesh: THREE.Object3D;
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  speed: number;
  life: number;
}

interface ActiveFlame {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface ActiveGrenade {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vx: number;
  vy: number;
  vz: number;
  fuse: number;
}

interface ActiveTracer {
  line: THREE.Line;
  life: number;
  maxLife: number;
}

interface ActiveArtillery {
  x: number;
  z: number;
  timer: number;
  maxTimer: number;
  ring: THREE.Mesh;
  isAirstrike: boolean;
}

interface ActiveShockSphere {
  mesh: THREE.Mesh;
  maxR: number;
  life: number;
  maxLife: number;
}

interface ActiveDropship {
  mesh: THREE.Group;
  hitBox: THREE.Mesh;
  pos: THREE.Vector3;
  targetPos: THREE.Vector3;
  state: 'inbound' | 'deploying' | 'outbound' | 'crashing';
  timer: number;
  hp: number;
  maxHp: number;
  vel: THREE.Vector3;
  deployed: boolean;
  alive: boolean;
}

interface SearchlightRig {
  pivot: THREE.Group;
  baseYaw: number;
  phase: number;
  speed: number;
}

interface ActiveSpriteBurst {
  sprite: THREE.Sprite;
  vel: THREE.Vector3;
  startScale: number;
  endScale: number;
  life: number;
  maxLife: number;
}

interface ActiveFloatingDamage {
  id: number;
  worldPos: THREE.Vector3;
  text: string;
  subLabel?: string;
  color: string;
  isCrit: boolean;
  life: number;
  maxLife: number;
}

interface ActiveHolotapeBeacon {
  data: WastelandHolotape;
  group: THREE.Group;
  cube: THREE.Object3D;
  reels: THREE.Mesh[];
  collected: boolean;
}

interface ActiveDropPod {
  beam: THREE.Mesh;
  ring: THREE.Mesh;
  pod: THREE.Mesh;
  x: number;
  z: number;
  y: number;
  spawned: boolean;
  life: number;
}

interface ActiveSquadmate {
  id: 'sergeant' | 'corporal' | 'ghost9' | 'survivor';
  name: string;
  rig: RokSquadmateRig;
  x: number;
  y: number;
  z: number;
  yaw: number;
  walkPhase: number;
  fireCd: number;
  active: boolean;
  status: 'active' | 'wounded' | 'ghost';
}

interface ActiveAc130Shell {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  timeLeft: number;
  maxTime: number;
  radius: number;
  dmg: number;
  caliber: '25mm' | '40mm' | '105mm';
  mesh: THREE.Mesh;
}

const MAX_DECALS = 220;
const MAX_PARTICLES = 350;
const MAX_RAGDOLLS = 16;
const MAX_GIBS = 48;
const MAX_SHELLS = 36;

/**
 * Lightweight AAA Filmic Post-Grading ShaderPass:
 * - Optical radial chromatic aberration on explosions, Exo-Dash, EMP & hits
 * - Subtle teal/amber shadow-highlight split-toning & micro-contrast polish
 * - Clean optical cinema lens vignette
 */
const CINEMATIC_GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uChromatic: { value: 0.0005 },
    uVignette: { value: 0.24 },
    uContrast: { value: 1.03 },
    uSaturation: { value: 1.06 },
    uTint: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
    uFlirMode: { value: 0.0 }, // 0 = normal, 1 = WHOT (White-Hot Thermal), 2 = BHOT (Black-Hot Thermal)
    uTime: { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uChromatic;
    uniform float uVignette;
    uniform float uContrast;
    uniform float uSaturation;
    uniform vec3 uTint;
    uniform float uFlirMode;
    uniform float uTime;
    varying vec2 vUv;

    float flirHash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
      vec2 centered = vUv - 0.5;
      float dist = length(centered);

      // Authentic AC-130 B&W Thermal FLIR Imaging (WHOT / BHOT) with CRT scanlines & sensor grain
      if (uFlirMode > 0.5) {
        vec3 raw = texture2D(tDiffuse, vUv).rgb;
        float heat = dot(raw, vec3(0.32, 0.52, 0.16));
        // Boost bright heat sources (enemies, fires, IR strobes, blasts) into crisp white-hot glow
        float thermal = clamp(pow(max(0.0, heat * 1.48), 0.78) * 1.18 - 0.06, 0.0, 1.0);
        float grain = (flirHash(floor(vUv * vec2(480.0, 270.0)) + vec2(fract(uTime * 19.0) * 13.0)) - 0.5) * 0.055;
        float scan = sin(vUv.y * 540.0) * 0.022;
        float val = clamp(thermal + grain + scan, 0.0, 1.0);
        if (uFlirMode > 1.5) {
          val = 1.0 - val;
        }
        float vigFlir = smoothstep(0.92, 0.28, dist);
        val *= mix(0.68, 1.0, vigFlir);
        vec3 flirCol = vec3(val * 0.96, val * 1.0, val * 0.99);
        gl_FragColor = vec4(flirCol, 1.0);
        return;
      }

      vec2 offset = centered * dist * uChromatic * 2.2;

      float r = texture2D(tDiffuse, clamp(vUv + offset, 0.001, 0.999)).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, clamp(vUv - offset, 0.001, 0.999)).b;
      vec3 col = vec3(r, g, b);

      // Filmic contrast + rich vibrancy
      col = (col - 0.5) * uContrast + 0.5;
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(luma), col, uSaturation);

      // Subtle Neo-Seoul shadow/highlight split tone (cool steel shadows, crisp warm highlights)
      vec3 shadowTone = vec3(0.95, 0.99, 1.05);
      vec3 highlightTone = vec3(1.03, 1.0, 0.96);
      col *= mix(shadowTone, highlightTone, smoothstep(0.18, 0.78, luma));
      col *= uTint;

      // Optical lens vignette
      float vig = smoothstep(0.88, 0.3, dist);
      col *= mix(1.0 - uVignette, 1.0, vig);

      gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
    }
  `,
};

function detectSoftwareGl(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class IronAshEngine {
  private container: HTMLElement;
  private onHudUpdate: (snap: HudSnapshot) => void;
  private isSoftwareGl: boolean;
  private audio = new WarAudioEngine();
  private textures: ProceduralTextureSet;
  private pbr: ExtendedPbrLibrary;

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private gtaoPass: GTAOPass | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private gradePass: ShaderPass | null = null;
  private vfx!: VolumetricVfxSystem;
  private worldRefs!: BuiltWorldRefs;
  private hemiLight!: THREE.HemisphereLight;
  private sunLight!: THREE.DirectionalLight;
  private lightningLight!: THREE.DirectionalLight;
  private muzzleLight!: THREE.PointLight;
  private viewmodelLight!: THREE.PointLight;
  private blastLight!: THREE.PointLight;
  private viewmodel!: ViewmodelRig;
  private cinematic!: CinematicDirector;

  // World collections
  private colliders: WorldCollider[] = [];
  private worldHitMeshes: THREE.Object3D[] = [];
  private explosiveBarrels: ExplosiveBarrel[] = [];
  private fireLights: Array<{ light: THREE.PointLight; phase: number }> = [];
  private searchlights: SearchlightRig[] = [];
  private ashPoints!: THREE.Points;
  private dustPoints!: THREE.Points;
  private rainLines!: THREE.LineSegments;
  private dropPods: ActiveDropPod[] = [];

  // Campaign Objective: 3 Firewall Relay Pylons -> OMNI-CORE Server Core Breach -> 3 Branching Endings
  private gameMode: GameMode = 'campaign';
  private relaysDestroyed = 0;
  private coreShieldDown = false;
  private coreHp = 600;
  private coreMaxHp = 600;
  private serverShutdownActive = false;
  private endingId: EndingId | null = null;
  private relay1FogShift = 0;
  private ttsEnabled = false;
  private unlockedHolotapeIds = new Set<string>();
  private theaterReturnToTitle = false;
  private _c1 = new THREE.Color();
  private _c2 = new THREE.Color();

  // V3.0 AAA Action Systems: GTA 5-Star Threat, Combo Style, Kill-Cam, Adrenaline, Supply Drops, Boss Drop
  private threatPoints = 0;
  private lastThreatLevel = 1;
  private comboCount = 0;
  private comboTimer = 0;
  private styleScore = 0;
  private killCamTimer = 0;
  private killCamBanner: string | null = null;
  private supplyDropCd = 0;
  private supplyDrops: ActiveSupplyDrop[] = [];
  private overdriveTimer = 0;
  private adrenalineTimer = 0;
  private adrenalineUsed = false;
  private titanDropShown = false;
  private ascensionArcCd = 0;
  private ghostIntroTimer = 14;

  // V3.1 CoD × GTA Tactical Optics, Laser Sight, Target Telemetry, Medals & Inspect
  private adsBlend = 0;
  private prevAds = false;
  private holdingBreath = false;
  private inspectTimer = 0;
  private aimDistanceM: number | null = null;
  private aimTarget: AimTargetTelemetry | null = null;
  private activeMedals: Array<CombatMedalItem & { life: number }> = [];
  private nextMedalId = 1;
  private wantedFlashSeq = 0;
  private aimProbeAccum = 0;
  private laserBeam!: THREE.Line;
  private laserDot!: THREE.Mesh;

  // V4.0 MWIII Tactical Realism: Mounting, Q/E Leaning, Weapon Wall Collision, Multi-Level & Eye Adaptation
  private mounted = false;
  private prevMounted = false;
  private leanDir: -1 | 0 | 1 = 0;
  private leanBlend = 0;
  private wallBlockBlend = 0;
  private wallBlocked = false;
  private isIndoors = false;
  private prevIndoors = false;
  private currentExposure = 1.02;
  private exposureAdaptationPulse = 0;
  private stepDistAccum = 0;
  private jetFlybyCd = 19;
  private enemyShotTimestamps: number[] = [];
  private activeSmokeZones: Array<{ x: number; z: number; r: number; timer: number }> = [];
  private ac130KilledCount = 0;
  private armorPlates = 2;
  private readonly maxArmorPlates = 3;
  private platingTimer = 0;
  private readonly platingDuration = 1.35;
  private smokeGrenades = 2;
  private readonly maxSmokeGrenades = 2;
  private squadOrder: SquadOrderId = 'follow';
  private squadOrderTimer = 0;
  private weaponAttachment: WeaponAttachmentId = 'standard';
  private tacticalRay = new THREE.Raycaster();

  // V5.0 Linear 4-Mission Setpiece Campaign, Squadmates, AC-130 FLIR Gunship & Auto-Branching Endings
  private missionId: CampaignMissionId = 1;
  private missionStage: CampaignStageId = 'm1_landing';
  private stageTimer = 0;
  private stageTransitionDelay = 0;
  private stagePendingNext: { mission: CampaignMissionId; stage: CampaignStageId } | null = null;
  private stageMilestones = new Set<string>();
  private stageTotalHostiles = 6;
  private campaignChoices: CampaignChoiceState = createInitialCampaignChoices();
  private campaignPrompt: CampaignPromptChoice | null = null;
  private autoEndingReason: string | null = null;
  private checkpointSeq = 0;
  private checkpointLabel = '';
  private breachSlowmoTimer = 0;
  private crisisTimer = 0;
  private rescueAnimTimer = 0;
  private squadmates: ActiveSquadmate[] = [];
  private ac130OrbitAngle = 0.72;
  private ac130TargetX = 0;
  private ac130TargetZ = 4;
  private ac130WeaponIdx: 0 | 1 | 2 = 1;
  private ac130FireCd = 0;
  private ac130ThermalMode: 'whot' | 'bhot' = 'whot';
  private ac130Zoomed = false;
  private ac130WaveIdx = 0;
  private ac130Shells: ActiveAc130Shell[] = [];

  // V7.0 Drivable K2-X Black Panther Main Battle Tank & Playable UH-60K Helicopter Door-Gunner Ride
  private enemyGlbTemplates: EnemyGlbTemplates | null = null;
  private tankGroup = new THREE.Group();
  private tankParts: K2TankGlbParts | null = null;
  private tankCollider: WorldCollider | null = null;
  private tank = {
    available: false,
    driving: false,
    x: 0,
    z: 14.5,
    hullYaw: 0,
    turretYaw: 0,
    turretVisualYaw: 0,
    hullPitchKick: 0,
    barrelPitch: 0,
    speed: 0,
    hp: 850,
    maxHp: 850,
    cannonCd: 0,
    cannonReloadSec: 2.1,
    recoilOffset: 0,
    coaxCd: 0,
    coaxHeat: 0,
    coaxOverheated: false,
    apsCd: 0,
    gunnerOptic: false,
  };
  private tankShells: Array<{
    mesh: THREE.Mesh;
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    life: number;
  }> = [];

  private heliGroup = new THREE.Group();
  private heliParts: Uh60GunshipGlbParts | null = null;
  private heliRide = {
    active: false,
    elapsed: 0,
    duration: 19.0,
    aimYawOffset: 0,
    aimPitch: -0.26,
    heat: 0,
    overheated: false,
    fireCd: 0,
    soundCd: 0,
    aaCd: 1.4,
    killedCount: 0,
    totalTargets: 10,
    baseCamYaw: 0,
  };

  // Dynamic gameplay pools
  private units: ActiveUnit[] = [];
  private enemyHitMeshes: THREE.Object3D[] = [];
  private ragdolls: ActiveRagdoll[] = [];
  private gibs: ActiveGib[] = [];
  private shells: ActiveShell[] = [];
  private particles: ActiveParticle[] = [];
  private decals: THREE.Mesh[] = [];
  private rockets: ActiveRocket[] = [];
  private flames: ActiveFlame[] = [];
  private grenades: ActiveGrenade[] = [];
  private tracers: ActiveTracer[] = [];
  private artilleryStrikes: ActiveArtillery[] = [];
  private shockSpheres: ActiveShockSphere[] = [];
  private dropship: ActiveDropship | null = null;

  // Shared geometries & materials (minimizing GC)
  private sharedBoxGeo = new THREE.BoxGeometry(1, 1, 1);
  private decalPlaneGeo = new THREE.PlaneGeometry(1, 1);
  private shellGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.048, 6);
  private matCache!: {
    floor: THREE.MeshStandardMaterial;
    concrete: THREE.MeshStandardMaterial;
    armorPlate: THREE.MeshStandardMaterial;
    darkIron: THREE.MeshStandardMaterial;
    rustMetal: THREE.MeshStandardMaterial;
    crate: THREE.MeshStandardMaterial;
    barrel: THREE.MeshStandardMaterial;
    blood: THREE.MeshBasicMaterial;
    spark: THREE.MeshBasicMaterial;
    empSpark: THREE.MeshBasicMaterial;
    smoke: THREE.MeshLambertMaterial;
    fire: THREE.MeshBasicMaterial;
    brass: THREE.MeshStandardMaterial;
  };

  // Scratch vectors & raycasters (zero-allocation per-frame math)
  private raycaster = new THREE.Raycaster();
  private splatterRay = new THREE.Raycaster();
  private aiRay = new THREE.Raycaster();
  private _v1 = new THREE.Vector3();
  private _v2 = new THREE.Vector3();
  private _v3 = new THREE.Vector3();
  private _v4 = new THREE.Vector3();

  // Game & player state
  private phase: GamePhase = 'title';
  private quality: GraphicsQuality = 'ultra';
  private sens = 0.0022;
  private time = 0;
  private wave = 1;
  private kills = 0;
  private dismembers = 0;
  private executions = 0;
  private killstreak = 0;
  private airstrikeReady = false;
  private shake = 0;
  private hitstop = 0;
  private timeScale = 1.0;
  private spawnCd = 1.5;
  private artilleryCd = 18;
  private dropshipCd = 26;
  private bossCd = 42;
  private lightningCd = 12;
  private lightningFlash = 0;
  private heartbeatCd = 0;
  private physicsAccum = 0;
  private hudEmitAccum = 0;
  private nextUnitId = 1;
  private nextKfId = 1;
  private killFeed: KillFeedItem[] = [];
  private alertBanner: string | null = null;
  private alertTimer = 0;
  private calloutText: string | null = null;
  private calloutColor = '#ff2a4b';
  private calloutTimer = 0;
  private hitmarkerSeq = 0;
  private hitmarkerCrit = false;
  private damageFlashSeq = 0;
  private damageDirDeg = 0;
  private blastFlashSeq = 0;
  private empFlashSeq = 0;
  private causeOfDeath = '';
  private pointerLocked = false;
  private pointerLockWasAcquired = false;

  // V.A.T.S. state
  private vatsEnergy = 100;
  private vatsActive = false;
  private vatsTargets: VatsTargetBox[] = [];

  // Story comms, Fallout Holotapes, VFX sprites, Floating Damage & D3 Analytics
  private triggeredComms = new Set<string>();
  private titleHotkeyEnabled = true;
  private spriteBursts: ActiveSpriteBurst[] = [];
  private floatingDamages: ActiveFloatingDamage[] = [];
  private floatingDmgSeq = 0;
  private holotapes: ActiveHolotapeBeacon[] = [];
  private analytics: CombatAnalyticsData = createEmptyAnalytics(WASTELAND_HOLOTAPES.length);
  private lastBucketSec = 0;
  private fovKick = 0;
  private muzzleSprite!: THREE.Sprite;

  // Player state
  private player = {
    x: 0,
    y: 1.7,
    z: 32,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: 0,
    pitch: 0,
    onGround: true,
    hp: 100,
    maxHp: 100,
    armor: 100,
    maxArmor: 100,
    wpnIdx: 0,
    ammo: WEAPONS.map((w) => w.mag),
    grenades: 3,
    nadeRegen: 0,
    fireCd: 0,
    reloadTimer: 0,
    reloadDur: 1,
    reloadIsTactical: false,
    ads: false,
    sprinting: false,
    dashCharges: DASH_MAX_CHARGES,
    dashRechargeTimer: 0,
    dashTimer: 0,
    slideTimer: 0,
    dashDirX: 0,
    dashDirZ: -1,
    recoilPitch: 0,
    vmKickZ: 0,
    vmRecoilPitch: 0,
    vmRecoilRoll: 0,
    vmBob: 0,
    vmBobBlend: 0,
    vmSwayX: 0,
    vmSwayY: 0,
    landDip: 0,
    equipTimer: 0,
    muzzleTimer: 0,
    bladeTimer: 0,
    alive: true,
    deathDelay: 0,
    invulnTimer: 2.5,
  };

  // Input state
  private keys = new Set<string>();
  private mouseLeft = false;
  private mouseRight = false;

  // Loop management
  private frameId = 0;
  private disposed = false;
  private lastNow = performance.now();

  private pointerLockSkipMove = false;

  constructor(container: HTMLElement, onHudUpdate: (snap: HudSnapshot) => void) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.isSoftwareGl = detectSoftwareGl();

    this.scene = new THREE.Scene();
    // Deep obsidian-slate atmospheric dusk (zero cliché purple haze, crisp depth separation)
    this.scene.background = new THREE.Color(0x0a0d13);
    this.scene.fog = new THREE.FogExp2(0x0e131b, 0.0094);

    this.camera = new THREE.PerspectiveCamera(
      76,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.08,
      260
    );
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    const initW = container.clientWidth || window.innerWidth;
    const initH = container.clientHeight || window.innerHeight;
    this.renderer.setSize(initW, initH);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.dataset.testid = 'warzone-canvas';
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    // Moody Stormy Neo-Seoul Night PMREM IBL (replaces bright white studio RoomEnvironment lightbox!)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x0b1018);
    // Overcast dark steel-blue storm sky dome panel
    const skyPanel = new THREE.Mesh(
      new THREE.SphereGeometry(20, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x1e2c3e, side: THREE.BackSide })
    );
    envScene.add(skyPanel);
    // Subtle distant amber urban fire glow along north horizon
    const fireBounce = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 5),
      new THREE.MeshBasicMaterial({ color: 0x6b321a })
    );
    fireBounce.position.set(0, 2, -12);
    envScene.add(fireBounce);
    // Soft moonlight overcast cloud break overhead
    const moonBounce = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14),
      new THREE.MeshBasicMaterial({ color: 0x5c728a })
    );
    moonBounce.rotation.x = Math.PI / 2;
    moonBounce.position.set(4, 11, -3);
    envScene.add(moonBounce);
    // Dark damp asphalt ground bounce so undersides never glow white
    const groundBounce = new THREE.Mesh(
      new THREE.PlaneGeometry(36, 36),
      new THREE.MeshBasicMaterial({ color: 0x0b0e14 })
    );
    groundBounce.rotation.x = -Math.PI / 2;
    groundBounce.position.y = -6;
    envScene.add(groundBounce);
    this.scene.environment = pmrem.fromScene(envScene, 0.08).texture;
    this.scene.environmentIntensity = 0.94;
    pmrem.dispose();

    const maxAniso = this.isSoftwareGl ? 1 : Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.textures = createProceduralTextures(maxAniso);
    this.pbr = createExtendedPbrLibrary(maxAniso);
    this.vfx = new VolumetricVfxSystem(this.scene);
    this.vfx.setSmokeTexture(this.pbr.smokePuffTex);
    this.initMaterials();
    this.initLighting();
    this.viewmodel = buildViewmodelRig(this.camera, this.textures, this.pbr);
    const muzzleSpriteMat = new THREE.SpriteMaterial({
      map: this.textures.vfxMuzzleMap,
      transparent: true,
      opacity: 0.54,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    });
    this.muzzleSprite = new THREE.Sprite(muzzleSpriteMat);
    this.muzzleSprite.position.set(0, 0.03, -1.08);
    this.muzzleSprite.scale.set(0.32, 0.32, 1);
    this.muzzleSprite.visible = false;
    this.viewmodel.pivot.add(this.muzzleSprite);

    // CoD PEQ-15 Tactical Laser Sight Beam + Target Impact Dot
    const laserGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(0, 0, -1),
    ]);
    const laserMat = new THREE.LineBasicMaterial({
      color: 0xff3b3b,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.laserBeam = new THREE.Line(laserGeo, laserMat);
    this.laserBeam.frustumCulled = false;
    this.laserBeam.visible = false;
    this.scene.add(this.laserBeam);

    this.laserDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.042, 8, 8),
      new THREE.MeshBasicMaterial({
        color: 0xff4b4b,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      })
    );
    this.laserDot.visible = false;
    this.scene.add(this.laserDot);

    this.buildSectorZeroMap();
    this.initSquadmates();
    this.initPlayableVehicles();
    this.buildHolotapeBeacons();
    this.initWeatherAndAsh();

    // Seamlessly swap in ALL 8 high-poly binary .glb models (5 weapons + K-808 APCs + Korean Sedans + Sandbag Bunkers)
    void loadAndAttachGlbWeapons(this.viewmodel, this.pbr, this.textures, () => this.disposed);
    void loadAndAttachBattlefieldGlbProps(
      {
        k808Apcs: this.worldRefs.k808Anchors,
        sedans: this.worldRefs.sedanAnchors,
        sandbags: this.worldRefs.sandbagAnchors,
      },
      this.pbr,
      this.textures,
      !this.isSoftwareGl,
      () => this.disposed
    );

    // GPU-only 4x MSAA EffectComposer + Grounded GTAO + Selective High-Threshold Bloom + sRGB OutputPass -> Filmic/FLIR Grade
    if (!this.isSoftwareGl) {
      const msaaTarget = new THREE.WebGLRenderTarget(initW, initH, {
        type: THREE.HalfFloatType,
        samples: 4,
      });
      this.composer = new EffectComposer(this.renderer, msaaTarget);
      this.composer.addPass(new RenderPass(this.scene, this.camera));

      this.gtaoPass = new GTAOPass(this.scene, this.camera, initW, initH);
      this.gtaoPass.output = GTAOPass.OUTPUT.Default;
      this.gtaoPass.blendIntensity = 0.52;
      this.gtaoPass.updateGtaoMaterial({
        radius: 0.54,
        distanceExponent: 2.0,
        thickness: 0.95,
        samples: 12,
      });
      this.gtaoPass.updatePdMaterial({
        lumaPhi: 10,
        depthPhi: 2,
        normalPhi: 3,
        radius: 3,
        radiusExponent: 1,
        rings: 2,
        samples: 12,
      });
      this.composer.addPass(this.gtaoPass);

      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(initW, initH),
        0.15,
        0.28,
        1.18
      );
      this.composer.addPass(this.bloomPass);
      // OutputPass FIRST (ACESFilmic tone-mapping + linear->sRGB) so gradePass & FLIR operate in exact display sRGB!
      this.composer.addPass(new OutputPass());
      this.gradePass = new ShaderPass(CINEMATIC_GRADE_SHADER);
      this.composer.addPass(this.gradePass);
      this.renderer.compile(this.scene, this.camera);
    }

    this.cinematic = new CinematicDirector({
      onHeartbeat: (intensity) => this.audio.playHeartbeat(intensity),
      onBraaam: () => this.audio.playBraaam(),
      onTypewriterTick: () => this.audio.playTypewriterTick(),
      onCommsCue: (sender) => this.audio.playCommsCue(sender),
      onTitanImpact: (pos) => this.handleTitanDropImpact(pos),
      onBreachDomeShatter: () => this.handleBreachDomeShatter(),
      onDawnBlackoutImpact: () => this.handleDawnBlackoutImpact(),
      onEndingImpact: (ending) => this.handleEndingImpact(ending),
      onSequenceComplete: (seq) => this.handleCinematicComplete(seq),
      onSpeakSubtitle: (cue) => this.speakSubtitleIfEnabled(cue.text, cue.sender),
    });

    this.bindEvents();
    this.setPhase('title');
    this.emitHudSnapshot(true);

    // Expose engine ref for deterministic cutscene/state QA hooks
    (window as unknown as Record<string, unknown>).__ironAshEngine = this;

    // Spawn ambient AI 3-way skirmish diorama visible on Title Screen flyover
    this.spawnInitialSkirmish();

    this.lastNow = performance.now();
    this.scheduleNextFrame();
  }

  private initMaterials(): void {
    this.matCache = {
      // Real photographic rain-wet Seoul tarmac asphalt with Sobel normal + puddle roughness + cavity AO!
      floor: new THREE.MeshStandardMaterial({
        color: 0xcfd6df,
        map: this.pbr.seoulAsphalt.map,
        normalMap: this.pbr.seoulAsphalt.normalMap,
        normalScale: new THREE.Vector2(1.05, 1.05),
        roughnessMap: this.pbr.seoulAsphalt.roughnessMap,
        aoMap: this.pbr.seoulAsphalt.aoMap,
        aoMapIntensity: 0.78,
        roughness: 0.94,
        metalness: 0.16,
        envMapIntensity: 0.48,
      }),
      // Matte war-scarred concrete & Euljiro architectural bulkheads
      concrete: new THREE.MeshStandardMaterial({
        color: 0xc8ced6,
        map: this.pbr.seoulFacade.map,
        normalMap: this.pbr.seoulFacade.normalMap,
        normalScale: new THREE.Vector2(0.95, 0.95),
        roughnessMap: this.pbr.seoulFacade.roughnessMap,
        aoMap: this.pbr.seoulFacade.aoMap,
        aoMapIntensity: 0.85,
        roughness: 0.9,
        metalness: 0.1,
        envMapIntensity: 0.35,
      }),
      // Battle-worn matte olive-gunmetal military armor plating (real photographic gunmetal PBR!)
      armorPlate: new THREE.MeshStandardMaterial({
        color: 0xbac2cc,
        map: this.pbr.gunmetal.map,
        normalMap: this.pbr.gunmetal.normalMap,
        normalScale: new THREE.Vector2(0.9, 0.9),
        roughnessMap: this.pbr.gunmetal.roughnessMap,
        aoMap: this.pbr.gunmetal.aoMap,
        aoMapIntensity: 0.85,
        roughness: 0.76,
        metalness: 0.62,
        envMapIntensity: 0.58,
      }),
      darkIron: new THREE.MeshStandardMaterial({
        color: 0x252b34,
        map: this.pbr.gunmetal.map,
        normalMap: this.pbr.gunmetal.normalMap,
        normalScale: new THREE.Vector2(0.65, 0.65),
        roughnessMap: this.pbr.gunmetal.roughnessMap,
        roughness: 0.66,
        metalness: 0.72,
        envMapIntensity: 0.55,
      }),
      rustMetal: new THREE.MeshStandardMaterial({
        color: 0x613524,
        normalMap: this.pbr.gunmetal.normalMap,
        normalScale: new THREE.Vector2(0.75, 0.75),
        roughness: 0.82,
        metalness: 0.42,
        envMapIntensity: 0.35,
      }),
      crate: new THREE.MeshStandardMaterial({
        color: 0xb5bdb4,
        map: this.textures.crateMap,
        normalMap: this.pbr.gunmetal.normalMap,
        normalScale: new THREE.Vector2(0.6, 0.6),
        roughness: 0.78,
        metalness: 0.28,
        envMapIntensity: 0.38,
      }),
      barrel: new THREE.MeshStandardMaterial({
        color: 0xc8c2c0,
        map: this.textures.barrelMap,
        normalMap: this.pbr.gunmetal.normalMap,
        normalScale: new THREE.Vector2(0.5, 0.5),
        roughness: 0.58,
        metalness: 0.52,
        envMapIntensity: 0.52,
      }),
      blood: new THREE.MeshBasicMaterial({ color: 0x162436 }),
      spark: new THREE.MeshBasicMaterial({ color: 0xffb02e }),
      empSpark: new THREE.MeshBasicMaterial({ color: 0x38e8ff }),
      smoke: new THREE.MeshLambertMaterial({
        color: 0x1c1e26,
        transparent: true,
        opacity: 0.72,
      }),
      fire: new THREE.MeshBasicMaterial({ color: 0xff5a14 }),
      brass: new THREE.MeshStandardMaterial({
        color: 0xd4a442,
        roughness: 0.28,
        metalness: 0.88,
        envMapIntensity: 0.85,
      }),
    };
  }

  private initLighting(): void {
    // Grounded Modern Warfare Overcast Stormy Seoul Lighting (rich shadow detail + cool skylight, zero whiteout!)
    this.hemiLight = new THREE.HemisphereLight(0x88a8cf, 0x2c3442, 0.92);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xc8daf0, 1.95);
    this.sunLight.position.set(28, 66, -26);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(this.isSoftwareGl ? 512 : 2048, this.isSoftwareGl ? 512 : 2048);
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 160;
    const sc = 48;
    this.sunLight.shadow.camera.left = -sc;
    this.sunLight.shadow.camera.right = sc;
    this.sunLight.shadow.camera.top = sc;
    this.sunLight.shadow.camera.bottom = -sc;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.018;
    this.scene.add(this.sunLight);

    // Warm urban fire-horizon rim light for crisp 3D silhouette separation on vehicles, walls & squads
    const rimLight = new THREE.DirectionalLight(0xe09a68, 0.52);
    rimLight.position.set(-42, 28, -46);
    this.scene.add(rimLight);

    // Occasional storm lightning directional flash
    this.lightningLight = new THREE.DirectionalLight(0xc2dcff, 0);
    this.lightningLight.position.set(-40, 80, -35);
    this.scene.add(this.lightningLight);

    // Balanced MWIII upper-left key rim light illuminating Picatinny rails, engravings & ROK camo sleeve
    this.viewmodelLight = new THREE.PointLight(0xc4d8f0, 0.62, 2.8, 1.0);
    this.viewmodelLight.position.set(-0.24, 0.30, -0.34);
    this.camera.add(this.viewmodelLight);

    // Physically calibrated decay=1.4 dynamic muzzle & explosion point lights (real wall & asphalt illumination!)
    this.muzzleLight = new THREE.PointLight(0xffb44d, 0, 22, 1.4);
    this.muzzleLight.position.set(0.24, -0.08, -1.0);
    this.camera.add(this.muzzleLight);

    this.blastLight = new THREE.PointLight(0xff6b22, 0, 48, 1.35);
    this.scene.add(this.blastLight);
  }

  private addExplosiveBarrel(x: number, z: number): void {
    const group = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.52, 1.48, 12),
      this.matCache.barrel
    );
    group.position.set(x, 0.74, z);
    group.castShadow = !this.isSoftwareGl;
    group.receiveShadow = true;
    const topRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.51, 0.04, 6, 12),
      this.matCache.darkIron
    );
    topRim.rotation.x = Math.PI / 2;
    topRim.position.y = 0.72;
    group.add(topRim);

    this.scene.add(group);
    this.worldHitMeshes.push(group);
    const barrelCol: WorldCollider = {
      minX: x - 0.54,
      maxX: x + 0.54,
      minZ: z - 0.54,
      maxZ: z + 0.54,
      height: 1.5,
      mesh: group,
      destructible: false,
      hp: 9999,
      alive: true,
    };
    this.colliders.push(barrelCol);
    const barrel: ExplosiveBarrel = {
      x,
      z,
      r: 0.6,
      mesh: group,
      collider: barrelCol,
      hp: 32,
      alive: true,
    };
    group.userData = { isWorld: true, barrel };
    this.explosiveBarrels.push(barrel);
  }

  private buildSectorZeroMap(): void {
    this.worldRefs = buildOmniCoreWorld({
      scene: this.scene,
      textures: this.textures,
      pbr: this.pbr,
      isSoftwareGl: this.isSoftwareGl,
      matCache: this.matCache,
      colliders: this.colliders,
      worldHitMeshes: this.worldHitMeshes,
      addExplosiveBarrel: (bx, bz) => this.addExplosiveBarrel(bx, bz),
    });
    this.searchlights = this.worldRefs.searchlights;
    this.fireLights = this.worldRefs.fireLights;
  }

  private initSquadmates(): void {
    const defs: Array<{
      id: ActiveSquadmate['id'];
      name: string;
      status: ActiveSquadmate['status'];
    }> = [
      { id: 'sergeant', name: '소재우 중사', status: 'active' },
      { id: 'corporal', name: '박현준 하사', status: 'active' },
      { id: 'ghost9', name: '고스트-9', status: 'ghost' },
      { id: 'survivor', name: '생존자', status: 'wounded' },
    ];
    for (const d of defs) {
      const rig = buildRokSquadmateModel(d.id, this.pbr, !this.isSoftwareGl);
      rig.root.visible = false;
      this.scene.add(rig.root);
      this.squadmates.push({
        id: d.id,
        name: d.name,
        rig,
        x: 0,
        y: 0,
        z: 36,
        yaw: Math.PI,
        walkPhase: 0,
        fireCd: 0.8 + Math.random() * 0.6,
        active: false,
        status: d.status,
      });
    }
  }

  private initWeatherAndAsh(): void {
    // Procedural soft radial glow sprite texture for organic embers & suspended dust motes
    const makeMoteTex = (coreRgba: string, midRgba: string): THREE.CanvasTexture => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const g = c.getContext('2d');
      if (g) {
        const grad = g.createRadialGradient(32, 32, 1, 32, 32, 30);
        grad.addColorStop(0, coreRgba);
        grad.addColorStop(0.36, midRgba);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 64, 64);
      }
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };

    const emberTex = makeMoteTex('rgba(255, 240, 200, 1)', 'rgba(255, 134, 46, 0.72)');
    const dustTex = makeMoteTex('rgba(216, 232, 255, 0.85)', 'rgba(126, 172, 224, 0.34)');

    // 1) Warm drifting glowing embers (additive soft glow motes)
    const ashCount = 380;
    const ashPos = new Float32Array(ashCount * 3);
    for (let i = 0; i < ashCount; i++) {
      ashPos[i * 3] = (Math.random() - 0.5) * ARENA_HALF_SIZE * 1.9;
      ashPos[i * 3 + 1] = Math.random() * 24;
      ashPos[i * 3 + 2] = (Math.random() - 0.5) * ARENA_HALF_SIZE * 1.9;
    }
    const ashGeo = new THREE.BufferGeometry();
    ashGeo.setAttribute('position', new THREE.BufferAttribute(ashPos, 3));
    this.ashPoints = new THREE.Points(
      ashGeo,
      new THREE.PointsMaterial({
        map: emberTex,
        color: 0xffa44c,
        size: 0.44,
        transparent: true,
        opacity: 0.86,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.scene.add(this.ashPoints);

    // 2) Cool atmospheric floating dust motes suspended in air shafts (gives living depth even while stationary)
    const dustCount = 420;
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * ARENA_HALF_SIZE * 1.6;
      dustPos[i * 3 + 1] = 0.5 + Math.random() * 14;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * ARENA_HALF_SIZE * 1.6;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    this.dustPoints = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({
        map: dustTex,
        color: 0xc2daf8,
        size: 0.32,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.scene.add(this.dustPoints);

    // 3) Subtle apocalyptic rain streaks
    const rainCount = 240;
    const rainPos = new Float32Array(rainCount * 6);
    for (let i = 0; i < rainCount; i++) {
      const rx = (Math.random() - 0.5) * 90;
      const ry = Math.random() * 26;
      const rz = (Math.random() - 0.5) * 90;
      rainPos[i * 6] = rx;
      rainPos[i * 6 + 1] = ry;
      rainPos[i * 6 + 2] = rz;
      rainPos[i * 6 + 3] = rx - 0.12;
      rainPos[i * 6 + 4] = ry - 1.3;
      rainPos[i * 6 + 5] = rz;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    this.rainLines = new THREE.LineSegments(
      rainGeo,
      new THREE.LineBasicMaterial({
        color: 0x9eb0c9,
        transparent: true,
        opacity: 0.24,
      })
    );
    this.scene.add(this.rainLines);
  }

  // =========================================================================
  // PUBLIC CONTROLS FOR REACT SHELL
  // =========================================================================
  public setTitleHotkeyEnabled(enabled: boolean): void {
    this.titleHotkeyEnabled = enabled;
  }

  public startGame(
    skipIntro = false,
    mode: GameMode = 'campaign',
    startMission: CampaignMissionId = 1,
    autoBoardTank = false
  ): void {
    this.audio.init();
    this.gameMode = mode;
    this.theaterReturnToTitle = false;
    this.resetMatchState();
    this.setPhase('playing');
    if (mode === 'freeroam') {
      this.player.equipTimer = 0.55;
      // Deploy drivable ROK K2-X Black Panther Main Battle Tank right at the southern depot!
      this.deployTankAt(9.5, 24.5, 0);
      if (autoBoardTank) this.enterTank();
      this.cinematic.showChapterCard(
        'FREE ROAM // 네오-섹터 제로',
        'WARZONE SANDBOX',
        'K2-X 흑표 전차 배치 · 5성 위협 경보 · 무한 화력전',
        '#f5b342',
        4.2
      );
      this.triggerRadioComms('deploy', false);
    } else {
      // 4-Mission Linear Setpiece Campaign (1st-person uncut choreography — no detached wave grind!)
      const prof = getMissionProfile(startMission);
      const initialStage: CampaignStageId =
        skipIntro && startMission === 1 ? 'm1_beachhead' : prof.initialStage;
      this.beginCampaignStage(startMission, initialStage);
      if (autoBoardTank && this.tank.available) {
        this.enterTank();
      }
    }
    this.requestPointerLockSafe();
    this.emitHudSnapshot(true);
  }

  public jumpToCampaignMission(missionId: CampaignMissionId): void {
    this.startGame(false, 'campaign', missionId);
  }

  public toggleAc130Thermal(): void {
    if (!this.isAc130Active()) return;
    this.ac130ThermalMode = this.ac130ThermalMode === 'whot' ? 'bhot' : 'whot';
    this.audio.playAdsClick(true);
    this.emitHudSnapshot(true);
  }

  public selectAc130Weapon(idx: 0 | 1 | 2): void {
    if (!this.isAc130Active()) return;
    if (this.ac130WeaponIdx === idx) return;
    this.ac130WeaponIdx = idx;
    this.audio.playMountClick(true);
    this.emitHudSnapshot(true);
  }

  public chooseEnding(ending: EndingId): void {
    if (this.phase !== 'playing') return;
    if (this.cinematic.getSequence() !== 'choice' && !this.coreShieldDown) return;
    this.endingId = ending;
    this.serverShutdownActive = true;
    this.vatsActive = false;
    this.clearHeldInputs();
    const cit = this.worldRefs?.citadel;
    this.cinematic.startEnding(
      ending,
      { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
      { x: cit?.x ?? 0, y: 10.5, z: cit?.z ?? -35 },
      { x: cit?.x ?? 0, y: 12, z: cit?.z ?? -35 }
    );
    this.emitHudSnapshot(true);
  }

  public playTheaterSequence(
    seq:
      | 'opening'
      | 'heli_ride'
      | 'tank_assault'
      | 'titan_drop'
      | 'breach'
      | 'choice'
      | 'dawn'
      | 'symbiosis'
      | 'ascension'
  ): void {
    this.audio.init();
    this.gameMode = 'campaign';
    this.resetMatchState();
    this.theaterReturnToTitle = seq !== 'choice' && seq !== 'heli_ride' && seq !== 'tank_assault';
    this.setPhase('playing');
    const cit = this.worldRefs?.citadel;
    const citPos = { x: cit?.x ?? 0, y: 12, z: cit?.z ?? -35 };
    const lookAt = { x: 0, y: 6, z: -20 };
    if (seq === 'heli_ride') {
      this.beginCampaignStage(3, 'm3_heli_insert');
      this.requestPointerLockSafe();
    } else if (seq === 'tank_assault') {
      this.beginCampaignStage(4, 'm4_tank_assault');
      this.enterTank();
      this.requestPointerLockSafe();
    } else if (seq === 'opening') {
      this.cinematic.startOpening({ x: 0, y: 1.7, z: 32 }, citPos);
    } else if (seq === 'titan_drop') {
      this.cinematic.startTitanDrop({ x: 0, y: 1.7, z: 12 }, lookAt, { x: 0, y: 0, z: -8 });
    } else if (seq === 'breach') {
      this.coreShieldDown = true;
      this.cinematic.startBreach({ x: 0, y: 1.7, z: 10 }, lookAt, citPos);
    } else if (seq === 'choice') {
      this.coreShieldDown = true;
      this.exitPointerLockSafe();
      this.cinematic.startChoice({ x: 0, y: 1.7, z: -4 }, citPos, citPos);
    } else {
      this.coreShieldDown = true;
      this.endingId = seq;
      this.serverShutdownActive = true;
      this.cinematic.startEnding(seq, { x: 0, y: 1.7, z: -6 }, citPos, citPos);
    }
    this.emitHudSnapshot(true);
  }

  public skipCinematic(): void {
    if (this.cinematic.skip()) {
      this.emitHudSnapshot(true);
    }
  }

  public setWeaponAttachment(id: WeaponAttachmentId): void {
    this.weaponAttachment = id;
    for (let i = 0; i < WEAPONS.length; i++) {
      this.player.ammo[i] = this.getEffectiveMag(i);
    }
    this.emitHudSnapshot(true);
  }

  private getEffectiveMag(wpnIdx: number): number {
    const base = WEAPONS[wpnIdx]?.mag ?? 32;
    const att = getWeaponAttachmentSpec(this.weaponAttachment);
    return Math.max(1, Math.round(base * att.magMult));
  }

  /** Warzone-style [H] Ceramic Ballistic Armor Plate (+45 Armor on foot, OR +220 Field ERA Repair inside K2-X Tank!) */
  public startArmorPlateInsert(): void {
    if (
      this.phase !== 'playing' ||
      !this.player.alive ||
      this.isAc130Active() ||
      this.isHeliRideActive() ||
      this.isFirstPersonSetpieceActive() ||
      this.platingTimer > 0
    ) {
      return;
    }
    // Inside K2-X Black Panther Tank -> Field ERA Reactive Armor Repair (+220 HP)
    if (this.tank.driving) {
      if (this.armorPlates <= 0) {
        this.showCallout('긴급 수리 키트(방탄판) 없음 — 보급([V])으로 보충', '#94a3b8', 1.6);
        return;
      }
      if (this.tank.hp >= this.tank.maxHp) {
        this.showCallout('K2-X 전차 복합장갑 최대치 (100%)', '#38d9ff', 1.2);
        return;
      }
      this.armorPlates--;
      this.tank.hp = Math.min(this.tank.maxHp, this.tank.hp + 220);
      this.audio.playMountClick(true);
      this.showCallout('K2-X 현장 긴급 장갑 수리 완료 · +220 전차 장갑', '#2ee6a6', 2.0);
      this.emitHudSnapshot(true);
      return;
    }
    if (this.armorPlates <= 0) {
      this.showCallout('예비 방탄판 없음 — 보급([V]) 또는 중장갑 적 처치로 보충', '#94a3b8', 1.6);
      return;
    }
    if (this.player.armor >= this.player.maxArmor) {
      this.showCallout('방탄 장갑 최대치 (100%)', '#38d9ff', 1.2);
      return;
    }
    this.armorPlates--;
    this.platingTimer = this.platingDuration;
    this.player.ads = false;
    this.player.reloadTimer = 0;
    this.audio.playMountClick(true);
    this.showCallout('세라믹 방탄판 교체 중...', '#38d9ff', 1.4);
    this.emitHudSnapshot(true);
  }

  /** CoD [B] M18 Tactical Smoke Grenade — or K2-X Turret IR Smoke Screen when driving tank! */
  public throwTacticalSmoke(): void {
    if (
      this.phase !== 'playing' ||
      !this.player.alive ||
      this.isAc130Active() ||
      this.isHeliRideActive() ||
      this.isFirstPersonSetpieceActive()
    ) {
      return;
    }
    if (this.tank.driving) {
      if (this.tank.apsCd > 0) {
        this.showCallout(`전차 연막탄 재장전 중 (${Math.ceil(this.tank.apsCd)}초)`, '#94a3b8', 1.4);
        return;
      }
      this.tank.apsCd = 11.5;
      const center = new THREE.Vector3(this.tank.x, 1.4, this.tank.z);
      this.vfx.spawnTacticalSmokeScreen(center, 7.6, 9.5);
      this.activeSmokeZones.push({ x: this.tank.x, z: this.tank.z, r: 7.6, timer: 9.5 });
      this.audio.playDash(true);
      this.showCallout('K2-X 포탑 적외선 연막 발사 · 적 화망 차단 (9.5초)', '#38d9ff', 2.4);
      this.emitHudSnapshot(true);
      return;
    }
    if (this.smokeGrenades <= 0) {
      this.showCallout('전술 연막탄 없음 — 체크포인트/보급([V]) 시 보충', '#94a3b8', 1.5);
      return;
    }
    this.smokeGrenades--;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const dropPos = new THREE.Vector3(
      this.player.x + dir.x * 5.2,
      Math.max(0.2, this.player.y - 1.2),
      this.player.z + dir.z * 5.2
    );
    this.vfx.spawnTacticalSmokeScreen(dropPos, 5.8, 9.0);
    this.activeSmokeZones.push({ x: dropPos.x, z: dropPos.z, r: 5.8, timer: 9.0 });
    this.audio.playDash(true);
    this.showCallout('M18 전술 연막 전개 · 적 저격 및 조준 시야 차단 (9초)', '#94a3b8', 2.4);
    this.emitHudSnapshot(true);
  }

  /** ROK Alpha Squad Tactical Orders ([Z] Regroup & Cover / [U] Focus Fire & Advance) */
  public issueSquadOrder(order: 'regroup' | 'suppress'): void {
    if (this.phase !== 'playing' || !this.player.alive || this.isAc130Active()) return;
    this.squadOrder = order;
    this.squadOrderTimer = 11.0;
    this.audio.playMountClick(true);
    if (order === 'regroup') {
      this.showCallout('알파 분대 명령: [Z] 밀착 집결 & 측면 엄호', '#2ee6a6', 2.2);
      this.pushRadioLine('박현준 하사', '알파 분대', 'squad', '#38d9ff', '알파 분대 집결 완료! 측면 엄호한다!', 2.4, false);
      // Emergency auto-smoke assist if player armor is critically low and no smoke active
      if (this.player.armor < 45 && !this.isConcealedBySmoke(this.player.x, this.player.z)) {
        const dropPos = new THREE.Vector3(this.player.x, Math.max(0.2, this.player.y - 1.2), this.player.z);
        this.vfx.spawnTacticalSmokeScreen(dropPos, 5.2, 7.5);
        this.activeSmokeZones.push({ x: dropPos.x, z: dropPos.z, r: 5.2, timer: 7.5 });
      }
    } else {
      this.showCallout('알파 분대 명령: [U] 전방 돌격 & 집중 사격 (11초)', '#f5b342', 2.2);
      this.pushRadioLine('소재우 중사', '알파 분대장', 'squad', '#f5b342', '전방 표적 확인! 알파 분대 화력 집중한다!', 2.6, false);
    }
    this.emitHudSnapshot(true);
  }

  public toggleTts(): boolean {
    this.ttsEnabled = !this.ttsEnabled;
    if (!this.ttsEnabled) {
      this.audio.stopVoiceDub();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // Ignore
        }
      }
    }
    this.emitHudSnapshot(true);
    return this.ttsEnabled;
  }

  public debugTriggerSequence(
    seq: 'breach' | 'dawn' | 'symbiosis' | 'ascension' | 'choice' | 'titan_drop'
  ): void {
    if (this.phase !== 'playing') this.startGame(true);
    if (seq === 'breach') {
      if (this.worldRefs) {
        for (const r of this.worldRefs.relays) {
          r.alive = false;
          r.hp = 0;
          r.coreCrystal.visible = false;
          r.beamMesh.visible = false;
          r.ringMesh.visible = false;
        }
        this.relaysDestroyed = this.worldRefs.relays.length;
      }
      this.coreShieldDown = true;
      this.vatsActive = false;
      const lookDir = new THREE.Vector3();
      this.camera.getWorldDirection(lookDir);
      const lookAt = this.camera.position.clone().addScaledVector(lookDir, 22);
      const cit = this.worldRefs?.citadel;
      this.cinematic.startBreach(
        { x: this.player.x, y: this.player.y, z: this.player.z },
        { x: lookAt.x, y: lookAt.y, z: lookAt.z },
        { x: cit?.x ?? 0, y: 12, z: cit?.z ?? -35 }
      );
      this.emitHudSnapshot(true);
    } else if (seq === 'choice') {
      this.coreShieldDown = true;
      this.triggerZeroHourChoice();
    } else if (seq === 'titan_drop') {
      const lookDir = new THREE.Vector3();
      this.camera.getWorldDirection(lookDir);
      const lookAt = this.camera.position.clone().addScaledVector(lookDir, 22);
      this.cinematic.startTitanDrop(
        { x: this.player.x, y: this.player.y, z: this.player.z },
        { x: lookAt.x, y: lookAt.y, z: lookAt.z },
        { x: 0, y: 0, z: -8 }
      );
      this.emitHudSnapshot(true);
    } else {
      this.coreShieldDown = true;
      this.coreHp = 0;
      this.chooseEnding(seq);
    }
  }

  public debugTriggerReload(
    weaponIdx = 0,
    progress = 0.2,
    durationSec = 4.5,
    isTactical = false
  ): void {
    if (this.phase !== 'playing') this.startGame(true);
    const idx = Math.max(0, Math.min(WEAPONS.length - 1, weaponIdx));
    const w = WEAPONS[idx];
    this.player.wpnIdx = idx;
    this.player.ammo[idx] = isTactical ? Math.max(1, Math.floor(w.mag * 0.45)) : 0;
    this.player.reloadIsTactical = isTactical;
    this.player.reloadDur = Math.max(0.5, durationSec);
    this.player.reloadTimer = this.player.reloadDur * Math.max(0.02, Math.min(0.98, 1 - progress));
    this.player.ads = false;
    this.player.equipTimer = 0;
    this.emitHudSnapshot(true);
  }

  public debugSetAmmo(weaponIdx = 0, ammo?: number): void {
    if (this.phase !== 'playing') this.startGame(true);
    const idx = Math.max(0, Math.min(WEAPONS.length - 1, weaponIdx));
    const w = WEAPONS[idx];
    this.player.wpnIdx = idx;
    this.player.reloadTimer = 0;
    this.player.reloadIsTactical = false;
    this.player.ammo[idx] =
      typeof ammo === 'number' ? Math.max(0, Math.min(w.mag, Math.floor(ammo))) : w.mag;
    this.player.equipTimer = 0;
    this.emitHudSnapshot(true);
  }

  private speakSubtitleIfEnabled(_text: string, sender: CommsSender): void {
    if (this.audio.isMuted()) return;
    this.audio.init();
    // Play crisp, authentic military SINCGARS/VHF tactical radio chirp & squelch SFX without synthetic AI voices!
    this.audio.playRadioCommsChirp(sender);
  }

  public resumeGame(): void {
    if (this.phase !== 'paused') return;
    this.setPhase('playing');
    this.requestPointerLockSafe();
    this.emitHudSnapshot(true);
  }

  public pauseGame(): void {
    if (this.phase !== 'playing') return;
    this.vatsActive = false;
    this.audio.stopVoiceDub();
    this.audio.setHeliPresence(0);
    this.audio.setDynamicState({
      playing: false,
      intensity: 0,
      bossActive: false,
      vatsActive: false,
    });
    this.clearHeldInputs();
    this.exitPointerLockSafe();
    this.setPhase('paused');
    this.emitHudSnapshot(true);
  }

  public returnToTitle(): void {
    this.vatsActive = false;
    this.audio.stopVoiceDub();
    this.audio.setHeliPresence(0);
    this.cinematic.reset();
    this.clearHeldInputs();
    this.exitPointerLockSafe();
    this.setPhase('title');
    this.emitHudSnapshot(true);
  }

  public setGraphicsQuality(q: GraphicsQuality): void {
    this.quality = q;
    const enableShadows = q === 'ultra' && !this.isSoftwareGl;
    this.renderer.shadowMap.enabled = enableShadows;
    this.sunLight.castShadow = enableShadows;
    this.rainLines.visible = q === 'ultra';
    if (this.worldRefs?.groundMist) {
      this.worldRefs.groundMist.visible = q === 'ultra';
    }
    if (this.gtaoPass) {
      this.gtaoPass.enabled = q === 'ultra';
    }
    if (this.bloomPass) {
      this.bloomPass.strength = q === 'ultra' ? 0.15 : 0.09;
    }
    for (const sl of this.searchlights) sl.pivot.visible = q === 'ultra';
  }

  public setSensitivity(multiplier: number): void {
    this.sens = 0.0022 * Math.max(0.3, Math.min(3.0, multiplier));
  }

  public toggleMute(): boolean {
    this.audio.init();
    const m = this.audio.toggleMute();
    if (m) {
      this.audio.stopVoiceDub();
      this.audio.setHeliPresence(0);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // Ignore
        }
      }
    }
    this.emitHudSnapshot(true);
    return m;
  }

  public selectWeapon(idx: number): void {
    if (idx < 0 || idx >= WEAPONS.length) return;
    if (this.player.wpnIdx === idx) return;
    this.player.wpnIdx = idx;
    this.player.reloadTimer = 0;
    this.player.reloadIsTactical = false;
    this.inspectTimer = 0;
    this.adsBlend = 0;
    this.player.vmKickZ = 0.1;
    this.player.vmRecoilPitch = 0;
    this.player.vmRecoilRoll = 0;
    this.player.equipTimer = 0.28;
    this.emitHudSnapshot(true);
  }

  private triggerRadioComms(key: keyof typeof RADIO_SCRIPTS, oncePerMatch = true): void {
    if (oncePerMatch && this.triggeredComms.has(key)) return;
    const script = RADIO_SCRIPTS[key];
    if (!script) return;
    if (oncePerMatch) this.triggeredComms.add(key);
    this.cinematic.enqueueSubtitles(
      [
        {
          speaker: script.speaker,
          role: script.role,
          sender: script.sender,
          callsignCode: script.callsignCode,
          accentCss: script.accentCss,
          text: script.text,
          duration: script.duration,
        },
      ],
      true
    );
  }

  public triggerVatsShot(unitId: number, part: BodyPart): void {
    if (!this.vatsActive || this.phase !== 'playing' || !this.player.alive) return;
    const target = this.units.find((u) => u.id === unitId && u.alive);
    if (!target) {
      this.exitVats();
      return;
    }
    const partMesh = target.rig.parts[part] ?? target.rig.parts.torso;
    if (!partMesh) {
      this.exitVats();
      return;
    }

    const targetWorldPos = new THREE.Vector3();
    partMesh.getWorldPosition(targetWorldPos);

    // Aim camera directly toward selected V.A.T.S. weakpoint
    const toTgt = targetWorldPos.clone().sub(this.camera.position);
    const horizDist = Math.hypot(toTgt.x, toTgt.z) || 0.001;
    this.player.yaw = Math.atan2(-toTgt.x, -toTgt.z);
    this.player.pitch = Math.max(-1.4, Math.min(1.4, Math.atan2(toTgt.y, horizDist)));

    const w = WEAPONS[this.player.wpnIdx];
    const dir = toTgt.normalize();
    this.player.muzzleTimer = 0.08;
    this.player.vmKickZ = 0.2;
    this.shake = Math.max(this.shake, 0.45);
    this.audio.playWeapon(w.sound, 1.0, { isIndoors: this.isIndoors, distanceM: 0 });

    const muzzlePos = new THREE.Vector3(0.18, -0.14, -0.82).applyMatrix4(this.camera.matrixWorld);
    this.spawnTracer(muzzlePos, targetWorldPos, 0x38f8ff, 0.28, 'railgun');

    this.damageUnit(
      target,
      Math.max(w.dmg * 1.45, 58),
      part,
      targetWorldPos,
      dir,
      Faction.PLAYER,
      FACTION_META[Faction.PLAYER].name,
      'V.A.T.S. 정밀 사격',
      null,
      true
    );

    this.vatsEnergy = Math.max(0, this.vatsEnergy - 24);
    this.exitVats();
    this.requestPointerLockSafe();
    this.emitHudSnapshot(true);
  }

  private setPhase(p: GamePhase): void {
    this.phase = p;
    document.body.dataset.state = p;
    this.audio.setDynamicState({
      playing: p === 'playing',
      intensity: Math.min(1, this.units.length / 14),
      bossActive: this.units.some((u) => u.isBoss && u.alive),
      vatsActive: this.vatsActive,
    });
  }

  private requestPointerLockSafe(): void {
    try {
      if (document.pointerLockElement !== this.renderer.domElement) {
        const res = this.renderer.domElement.requestPointerLock?.() as unknown as Promise<void> | undefined;
        if (res && typeof res.catch === 'function') {
          res.catch(() => {
            // Ignore async pointer-lock rejection in sandboxed or headless frames
          });
        }
      }
    } catch {
      // Ignore pointer lock rejection in headless or sandboxed contexts
    }
  }

  private exitPointerLockSafe(): void {
    try {
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
    } catch {
      // Ignore
    }
  }

  private clearHeldInputs(): void {
    this.keys.clear();
    this.mouseLeft = false;
    this.mouseRight = false;
  }

  // =========================================================================
  // MATCH RESET & SPAWNING
  // =========================================================================
  private clearDynamicEntities(): void {
    for (const u of this.units) this.scene.remove(u.rig.root);
    this.units.length = 0;
    this.enemyHitMeshes.length = 0;

    for (const r of this.ragdolls) this.scene.remove(r.group);
    this.ragdolls.length = 0;

    for (const g of this.gibs) {
      this.scene.remove(g.mesh);
      g.mesh.geometry.dispose();
    }
    this.gibs.length = 0;

    for (const s of this.shells) this.scene.remove(s.mesh);
    this.shells.length = 0;

    for (const p of this.particles) this.scene.remove(p.mesh);
    this.particles.length = 0;

    for (const d of this.decals) {
      this.scene.remove(d);
      (d.material as THREE.Material).dispose();
    }
    this.decals.length = 0;

    for (const rk of this.rockets) this.scene.remove(rk.mesh);
    this.rockets.length = 0;

    for (const fl of this.flames) this.scene.remove(fl.mesh);
    this.flames.length = 0;

    for (const gr of this.grenades) this.scene.remove(gr.mesh);
    this.grenades.length = 0;

    for (const tr of this.tracers) {
      this.scene.remove(tr.line);
      tr.line.geometry.dispose();
    }
    this.tracers.length = 0;

    for (const a of this.artilleryStrikes) this.scene.remove(a.ring);
    this.artilleryStrikes.length = 0;

    for (const sp of this.shockSpheres) this.scene.remove(sp.mesh);
    this.shockSpheres.length = 0;

    if (this.dropship) {
      this.scene.remove(this.dropship.mesh);
      this.dropship = null;
    }

    for (const dp of this.dropPods) {
      this.scene.remove(dp.beam);
      this.scene.remove(dp.ring);
      this.scene.remove(dp.pod);
    }
    this.dropPods.length = 0;

    for (const sd of this.supplyDrops) {
      this.scene.remove(sd.mesh);
    }
    this.supplyDrops.length = 0;

    for (const sh of this.ac130Shells) {
      this.scene.remove(sh.mesh);
      sh.mesh.geometry.dispose();
      (sh.mesh.material as THREE.Material).dispose();
    }
    this.ac130Shells.length = 0;

    this.vfx.clear();
  }

  private resetMatchState(): void {
    this.clearDynamicEntities();
    this.clearHeldInputs();

    // Restore destructible crates & explosive barrels if destroyed in previous run
    for (const c of this.colliders) {
      if (c.destructible && !c.alive) {
        c.alive = true;
        c.hp = 45;
        this.scene.add(c.mesh);
        if (!this.worldHitMeshes.includes(c.mesh)) this.worldHitMeshes.push(c.mesh);
      }
    }
    for (const b of this.explosiveBarrels) {
      if (!b.alive) {
        b.alive = true;
        b.hp = 32;
        b.collider.alive = true;
        this.scene.add(b.mesh);
        if (!this.worldHitMeshes.includes(b.mesh)) this.worldHitMeshes.push(b.mesh);
      } else {
        b.collider.alive = true;
      }
    }

    // Restore 3 Firewall Relay Pylons, Defense Turrets, Dawn God-Rays & OMNI-CORE Citadel
    this.relaysDestroyed = 0;
    this.coreShieldDown = false;
    this.coreHp = this.coreMaxHp;
    this.serverShutdownActive = false;
    this.endingId = null;
    this.relay1FogShift = 0;
    this.threatPoints = 0;
    this.lastThreatLevel = 1;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.styleScore = 0;
    this.killCamTimer = 0;
    this.killCamBanner = null;
    this.supplyDropCd = 0;
    this.overdriveTimer = 0;
    this.adrenalineTimer = 0;
    this.adrenalineUsed = false;
    this.titanDropShown = false;
    this.ascensionArcCd = 0;
    this.ghostIntroTimer = 14;
    this.adsBlend = 0;
    this.prevAds = false;
    this.holdingBreath = false;
    this.inspectTimer = 0;
    this.aimDistanceM = null;
    this.aimTarget = null;
    this.activeMedals = [];
    this.mounted = false;
    this.prevMounted = false;
    this.leanDir = 0;
    this.leanBlend = 0;
    this.wallBlockBlend = 0;
    this.wallBlocked = false;
    this.isIndoors = false;
    this.prevIndoors = false;
    this.currentExposure = 1.02;
    this.exposureAdaptationPulse = 0;
    this.stepDistAccum = 0;
    this.jetFlybyCd = 19;
    this.audio.stopVoiceDub();
    this.audio.setHeliPresence(0);
    this.renderer.toneMappingExposure = 1.02;
    this.missionId = 1;
    this.missionStage = 'm1_landing';
    this.stageTimer = 0;
    this.stageTransitionDelay = 0;
    this.stagePendingNext = null;
    this.stageMilestones.clear();
    this.stageTotalHostiles = 6;
    this.campaignChoices = createInitialCampaignChoices();
    this.campaignPrompt = null;
    this.autoEndingReason = null;
    this.checkpointLabel = '';
    this.breachSlowmoTimer = 0;
    this.crisisTimer = 0;
    this.rescueAnimTimer = 0;
    this.ac130OrbitAngle = 0.72;
    this.ac130TargetX = 0;
    this.ac130TargetZ = 4;
    this.ac130WeaponIdx = 1;
    this.ac130FireCd = 0;
    this.ac130ThermalMode = 'whot';
    this.ac130Zoomed = false;
    this.ac130WaveIdx = 0;
    for (const sq of this.squadmates) {
      sq.active = false;
      sq.rig.root.visible = false;
      sq.rig.torso.rotation.x = 0;
    }
    if (this.worldRefs) {
      this.worldRefs.lcacHovercraft.group.position.set(0, 0, 44.5);
      this.worldRefs.lcacHovercraft.rampPivot.rotation.x = -Math.PI * 0.44;
      const bd = this.worldRefs.euljiroBreachDoor;
      bd.breached = false;
      bd.doorCollider.alive = true;
      bd.leftLeaf.position.set(0, 1.44, -0.76);
      bd.leftLeaf.rotation.set(0, 0, 0);
      bd.rightLeaf.position.set(0, 1.44, 0.76);
      bd.rightLeaf.rotation.set(0, 0, 0);
      if (!this.worldHitMeshes.includes(bd.leftLeaf)) this.worldHitMeshes.push(bd.leftLeaf);
      if (!this.worldHitMeshes.includes(bd.rightLeaf)) this.worldHitMeshes.push(bd.rightLeaf);
      bd.c4Pack.visible = false;
      bd.breachLight.intensity = 0;
      const el = this.worldRefs.towerElevator;
      el.group.visible = false;
      el.group.position.set(0, 0, -19.5);
      el.leftDoor.position.set(-1.08, 1.6, -1.92);
      el.rightDoor.position.set(1.08, 1.6, -1.92);
    }
    if (this.gradePass) {
      this.gradePass.uniforms.uFlirMode.value = 0.0;
    }
    this.resetPlayableVehicles();
    if (this.laserBeam) this.laserBeam.visible = false;
    if (this.laserDot) this.laserDot.visible = false;
    this.unlockedHolotapeIds.clear();
    this.cinematic.reset();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
    if (this.worldRefs) {
      const isSandbox = this.gameMode === 'freeroam';
      this.enemyShotTimestamps = [];
      this.activeSmokeZones = [];
      this.ac130KilledCount = 0;
      this.worldRefs.sandboxWayfindingGroup.visible = isSandbox;
      // Only show legacy Sandbox Firewall Relays in Free Roam Sandbox — keeps linear 4-Mission Campaign 100% grounded!
      for (const r of this.worldRefs.relays) {
        r.alive = isSandbox;
        r.hp = r.maxHp;
        r.group.visible = isSandbox;
        r.coreCrystal.visible = isSandbox;
        r.beamMesh.visible = isSandbox;
        r.ringMesh.visible = isSandbox;
        const hi = this.worldHitMeshes.indexOf(r.hitMesh);
        const ci = this.worldHitMeshes.indexOf(r.coreCrystal);
        if (isSandbox) {
          if (hi === -1) this.worldHitMeshes.push(r.hitMesh);
          if (ci === -1) this.worldHitMeshes.push(r.coreCrystal);
        } else {
          if (hi !== -1) this.worldHitMeshes.splice(hi, 1);
          if (ci !== -1) this.worldHitMeshes.splice(ci, 1);
        }
      }
      this.worldRefs.vaultGate.visible = isSandbox;
      this.worldRefs.vaultGateCollider.alive = isSandbox;
      for (const lc of this.worldRefs.lcacColliders) {
        lc.alive = !isSandbox;
      }
      for (const t of this.worldRefs.turrets) {
        t.hacked = false;
        t.fireCd = 0;
        t.rig.statusMat.color.setHex(0xf59e0b);
        (t.rig.beaconRing.material as THREE.MeshBasicMaterial).color.setHex(0xf59e0b);
      }
      for (const gr of this.worldRefs.dawnGodRays) {
        gr.visible = false;
        (gr.material as THREE.MeshBasicMaterial).opacity = 0;
      }
      this.worldRefs.rescueShuttle.visible = false;
      this.worldRefs.rescueShuttle.position.set(-90, 34, -20);

      const cit = this.worldRefs.citadel;
      cit.shieldDome.visible = isSandbox;
      cit.coreBeam.visible = isSandbox;
      cit.coreBeam.scale.set(1, 1, 1);
      (cit.coreBeam.material as THREE.MeshBasicMaterial).color.setHex(0xd92644);
      cit.coreWeakpoint.visible = false;
      cit.coreWeakpoint.scale.setScalar(1);
      (cit.coreWeakpoint.material as THREE.MeshBasicMaterial).color.setHex(0xd92644);
      if (!this.worldHitMeshes.includes(cit.coreWeakpointHitMesh)) {
        this.worldHitMeshes.push(cit.coreWeakpointHitMesh);
      }
      (cit.terminalGlow.material as THREE.MeshBasicMaterial).color.setHex(0xd92644);
      cit.terminalLight.color.setHex(0xff3444);
      cit.terminalLight.intensity = 14.0;
      for (const em of cit.emissiveMeshes) em.visible = true;
    }
    // Restore grounded Modern Warfare stormy overcast Seoul lighting & rain (no purple sci-fi tint!)
    (this.scene.fog as THREE.FogExp2).color.setHex(0x111722);
    (this.scene.fog as THREE.FogExp2).density = 0.0094;
    (this.scene.background as THREE.Color).setHex(0x0b1018);
    this.hemiLight.color.setHex(0x88a8cf);
    this.hemiLight.groundColor.setHex(0x2c3442);
    this.hemiLight.intensity = 0.92;
    this.sunLight.color.setHex(0xc8daf0);
    this.sunLight.intensity = 1.95;
    (this.rainLines.material as THREE.LineBasicMaterial).opacity = 0.24;
    if (this.worldRefs) {
      this.worldRefs.skyDomeMat.uniforms.topColor.value.setHex(0x090e16);
      this.worldRefs.skyDomeMat.uniforms.midColor.value.setHex(0x16202e);
      this.worldRefs.skyDomeMat.uniforms.horizonColor.value.setHex(0x262e3a);
      this.worldRefs.skyDomeMat.uniforms.glowColor.value.setHex(0x6b3228);
    }

    this.time = 0;
    this.wave = 1;
    this.kills = 0;
    this.dismembers = 0;
    this.executions = 0;
    this.killstreak = 0;
    this.airstrikeReady = false;
    this.shake = 0;
    this.hitstop = 0;
    this.timeScale = 1;
    this.spawnCd = 2.0;
    this.artilleryCd = 19;
    this.dropshipCd = 24;
    this.bossCd = 40;
    this.vatsEnergy = 100;
    this.vatsActive = false;
    this.vatsTargets = [];
    this.killFeed = [];
    this.alertBanner = null;
    this.alertTimer = 0;
    this.calloutText = null;
    this.calloutTimer = 0;
    this.triggeredComms.clear();
    this.floatingDamages = [];
    for (const sb of this.spriteBursts) {
      this.scene.remove(sb.sprite);
      sb.sprite.material.dispose();
    }
    this.spriteBursts = [];
    this.analytics = createEmptyAnalytics(WASTELAND_HOLOTAPES.length);
    this.lastBucketSec = 0;
    this.fovKick = 0;
    for (const ht of this.holotapes) {
      ht.collected = false;
      ht.group.visible = true;
    }
    this.causeOfDeath = '';
    this.pointerLockWasAcquired = false;

    this.player.x = 0;
    this.player.y = 1.7;
    this.player.z = 32;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.vz = 0;
    this.player.yaw = 0;
    this.player.pitch = 0;
    this.player.onGround = true;
    this.player.hp = 100;
    this.player.armor = 100;
    this.player.wpnIdx = 0;
    this.player.ammo = WEAPONS.map((_, idx) => this.getEffectiveMag(idx));
    this.armorPlates = 2;
    this.platingTimer = 0;
    this.smokeGrenades = 2;
    this.squadOrder = 'follow';
    this.squadOrderTimer = 0;
    this.player.grenades = 3;
    this.player.nadeRegen = 0;
    this.player.fireCd = 0;
    this.player.reloadTimer = 0;
    this.player.reloadIsTactical = false;
    this.player.ads = false;
    this.player.sprinting = false;
    this.player.dashCharges = DASH_MAX_CHARGES;
    this.player.dashRechargeTimer = 0;
    this.player.dashTimer = 0;
    this.player.slideTimer = 0;
    this.player.recoilPitch = 0;
    this.player.vmKickZ = 0;
    this.player.vmRecoilPitch = 0;
    this.player.vmRecoilRoll = 0;
    this.player.vmBobBlend = 0;
    this.player.vmSwayX = 0;
    this.player.vmSwayY = 0;
    this.player.landDip = 0;
    this.player.equipTimer = 0.28;
    this.player.muzzleTimer = 0;
    this.player.bladeTimer = 0;
    this.player.alive = true;
    this.player.deathDelay = 0;
    this.player.invulnTimer = 2.8;

    // In Free Roam sandbox or Title Screen diorama, spawn the opening 3-way skirmish.
    // Campaign mode spawns curated mission encounters via beginCampaignStage().
    if (this.gameMode === 'freeroam') {
      this.spawnInitialSkirmish();
    }
  }

  private spawnInitialSkirmish(): void {
    // Balanced opening 3-way AI robot skirmish across the widened central lane & flanking wings
    this.createEnemy(Faction.RAIDER, UnitArchetype.RAIDER_TROOPER, -5.5, 9);
    this.createEnemy(Faction.SYNDICATE, UnitArchetype.SYNDICATE_COMMANDO, 5.5, 9);
    this.createEnemy(Faction.RAIDER, UnitArchetype.RAIDER_BERSERKER, -7.0, -7);
    this.createEnemy(Faction.SYNDICATE, UnitArchetype.SYNDICATE_HEAVY, 7.0, -7);
    this.createEnemy(Faction.ROBOT, UnitArchetype.ROBOT_STALKER, -25, -4);
    this.createEnemy(Faction.ROBOT, UnitArchetype.ROBOT_ENFORCER, 25, -4);
  }

  private rebuildHitMeshCache(): void {
    this.enemyHitMeshes = [];
    for (let i = 0; i < this.units.length; i++) {
      const u = this.units[i];
      if (!u.alive) continue;
      for (const key of Object.keys(u.rig.parts) as BodyPart[]) {
        const node = u.rig.parts[key];
        if (!node || !node.visible) continue;
        if (node instanceof THREE.Mesh) {
          this.enemyHitMeshes.push(node);
        } else {
          node.traverse((child) => {
            if (child instanceof THREE.Mesh && child.visible && child.userData.part === key) {
              this.enemyHitMeshes.push(child);
            }
          });
        }
      }
    }
    if (this.dropship && this.dropship.alive) {
      this.enemyHitMeshes.push(this.dropship.hitBox);
    }
  }

  private createEnemy(
    faction: Faction,
    archetype: UnitArchetype,
    x: number,
    z: number,
    y = 0
  ): ActiveUnit {
    const isBoss = archetype === UnitArchetype.ROBOT_TITAN;
    // Everyone on the surface is an AI Robot — only the player is human
    const isRobot = true;
    const scale = isBoss
      ? 1.65
      : archetype === UnitArchetype.SYNDICATE_HEAVY
        ? 1.15
        : archetype === UnitArchetype.ROBOT_STALKER
          ? 0.92
          : 1.0;

    const nameMap: Record<UnitArchetype, string> = {
      [UnitArchetype.RAIDER_BERSERKER]: '러스트-보그 해체 돌격기',
      [UnitArchetype.RAIDER_TROOPER]: '러스트-보그 폐철 사격기',
      [UnitArchetype.SYNDICATE_COMMANDO]: '이지스 전술 안드로이드',
      [UnitArchetype.SYNDICATE_HEAVY]: '이지스 중장갑 제압기',
      [UnitArchetype.SYNDICATE_SNIPER]: '이지스 레이저 스나이퍼',
      [UnitArchetype.ROBOT_STALKER]: '호버 톱날 헌터 드론',
      [UnitArchetype.ROBOT_ENFORCER]: '옴니-가드 레이저 워커',
      [UnitArchetype.ROBOT_TITAN]: 'OMNI-TITAN 오버로드',
    };

    const baseHpMap: Record<UnitArchetype, number> = {
      [UnitArchetype.RAIDER_BERSERKER]: 85,
      [UnitArchetype.RAIDER_TROOPER]: 72,
      [UnitArchetype.SYNDICATE_COMMANDO]: 92,
      [UnitArchetype.SYNDICATE_HEAVY]: 145,
      [UnitArchetype.SYNDICATE_SNIPER]: 80,
      [UnitArchetype.ROBOT_STALKER]: 78,
      [UnitArchetype.ROBOT_ENFORCER]: 122,
      [UnitArchetype.ROBOT_TITAN]: 980,
    };

    const speedMap: Record<UnitArchetype, number> = {
      [UnitArchetype.RAIDER_BERSERKER]: 6.2,
      [UnitArchetype.RAIDER_TROOPER]: 5.1,
      [UnitArchetype.SYNDICATE_COMMANDO]: 5.4,
      [UnitArchetype.SYNDICATE_HEAVY]: 3.8,
      [UnitArchetype.SYNDICATE_SNIPER]: 4.3,
      [UnitArchetype.ROBOT_STALKER]: 6.8,
      [UnitArchetype.ROBOT_ENFORCER]: 4.6,
      [UnitArchetype.ROBOT_TITAN]: 3.1,
    };

    const fireRateMap: Record<UnitArchetype, number> = {
      [UnitArchetype.RAIDER_BERSERKER]: 1.25,
      [UnitArchetype.RAIDER_TROOPER]: 0.92,
      [UnitArchetype.SYNDICATE_COMMANDO]: 0.58,
      [UnitArchetype.SYNDICATE_HEAVY]: 0.4,
      [UnitArchetype.SYNDICATE_SNIPER]: 2.6,
      [UnitArchetype.ROBOT_STALKER]: 0.96,
      [UnitArchetype.ROBOT_ENFORCER]: 0.76,
      [UnitArchetype.ROBOT_TITAN]: 0.32,
    };

    const dmgMap: Record<UnitArchetype, number> = {
      [UnitArchetype.RAIDER_BERSERKER]: 9,
      [UnitArchetype.RAIDER_TROOPER]: 6,
      [UnitArchetype.SYNDICATE_COMMANDO]: 7,
      [UnitArchetype.SYNDICATE_HEAVY]: 8,
      [UnitArchetype.SYNDICATE_SNIPER]: 20,
      [UnitArchetype.ROBOT_STALKER]: 10,
      [UnitArchetype.ROBOT_ENFORCER]: 9,
      [UnitArchetype.ROBOT_TITAN]: 12,
    };

    const threatSt = computeThreatState(this.threatPoints);
    const bal = computeSpawnBalance(this.wave, this.relaysDestroyed, this.coreShieldDown, threatSt.level);
    const hp = Math.round(baseHpMap[archetype] * bal.enemyHpMult);

    const unit: ActiveUnit = {
      id: this.nextUnitId++,
      faction,
      archetype,
      isRobot,
      isBoss,
      name: nameMap[archetype],
      scale,
      rig: null as unknown as EnemyRig,
      x,
      y,
      z,
      r: 0.56 * scale,
      yaw: Math.random() * Math.PI * 2,
      hp,
      maxHp: hp,
      speed: speedMap[archetype],
      fireRate: fireRateMap[archetype],
      fireCd: 0.75 + Math.random() * 0.85,
      dmg: dmgMap[archetype],
      missing: {},
      armorPlateHp: isBoss ? { armorFront: 165, armorLeft: 135, armorRight: 135 } : {},
      staggerTimer: 0,
      burnTimer: 0,
      empStunTimer: 0,
      stunImmuneTimer: 0,
      walkPhase: Math.random() * 10,
      strafeDir: Math.random() > 0.5 ? 1 : -1,
      strafeCd: 1.4,
      hitFlash: 0,
      hitFlinch: 0,
      fireRecoil: 0,
      sniperCharge: 0,
      bossPhase: 1,
      bossMissileCd: 5.5,
      alive: true,
    };

    const glbRig = this.enemyGlbTemplates
      ? buildEnemyGlbRig(
          this.enemyGlbTemplates,
          faction,
          archetype,
          scale,
          this.textures.contactShadow,
          unit,
          this.pbr,
          !this.isSoftwareGl
        )
      : null;
    unit.rig =
      glbRig ??
      buildEnemyModel(
        faction,
        archetype,
        scale,
        this.textures.contactShadow,
        unit,
        this.textures
      );
    unit.rig.root.position.set(x, y, z);
    this.scene.add(unit.rig.root);
    this.units.push(unit);
    this.rebuildHitMeshCache();
    return unit;
  }

  /** Seamlessly upgrades any early-spawned units to sculpted high-poly 2-bone .glb character rigs */
  private upgradeLiveUnitsToGlb(): void {
    if (!this.enemyGlbTemplates || this.disposed) return;
    let swapped = false;
    for (const u of this.units) {
      if (!u.alive || u.rig.knees) continue; // already using sculpted 2-bone GLB rig
      const nextRig = buildEnemyGlbRig(
        this.enemyGlbTemplates,
        u.faction,
        u.archetype,
        u.scale,
        this.textures.contactShadow,
        u,
        this.pbr,
        !this.isSoftwareGl
      );
      if (!nextRig) continue;
      nextRig.root.position.copy(u.rig.root.position);
      nextRig.root.rotation.copy(u.rig.root.rotation);
      // Preserve any already-dismembered parts or missing boss shields cleanly
      for (const part of Object.keys(u.missing) as BodyPart[]) {
        if (u.missing[part] && nextRig.parts[part]) {
          nextRig.parts[part]!.visible = false;
        }
      }
      this.scene.remove(u.rig.root);
      this.scene.add(nextRig.root);
      u.rig = nextRig;
      swapped = true;
    }
    if (swapped) this.rebuildHitMeshCache();
  }

  private findSpawnPoint(): { x: number; z: number } {
    for (let t = 0; t < 30; t++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 22 + Math.random() * 24;
      const x = Math.max(
        -ARENA_HALF_SIZE + 6,
        Math.min(ARENA_HALF_SIZE - 6, this.player.x + Math.cos(ang) * dist)
      );
      // Keep spawned robots north of the South Entry Trench (z <= 21) so enemies never ambush from behind spawn
      const z = Math.max(
        -ARENA_HALF_SIZE + 8,
        Math.min(21, this.player.z + Math.sin(ang) * dist)
      );
      if (Math.hypot(x - this.player.x, z - this.player.z) < 19.5) continue;
      let blocked = false;
      for (const c of this.colliders) {
        if (c.alive && x > c.minX - 1.8 && x < c.maxX + 1.8 && z > c.minZ - 1.8 && z < c.maxZ + 1.8) {
          blocked = true;
          break;
        }
      }
      if (!blocked) return { x, z };
    }
    return { x: (Math.random() > 0.5 ? 1 : -1) * 20, z: -24 };
  }

  // =========================================================================
  // DECALS, GIBS, SHELL CASINGS, RAGDOLLS & PARTICLES
  // =========================================================================
  private spawnDecal(
    point: THREE.Vector3,
    normal: THREE.Vector3,
    type: 'blood' | 'oil' | 'scorch' | 'bullet',
    size = 1.4
  ): void {
    const tex =
      type === 'blood'
        ? this.textures.bloodDecals[Math.floor(Math.random() * this.textures.bloodDecals.length)]
        : type === 'oil'
          ? this.textures.oilDecal
          : type === 'scorch'
            ? this.textures.scorchDecal
            : this.textures.bulletHole;

    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      opacity: type === 'bullet' ? 0.86 : 0.94,
    });

    const mesh = new THREE.Mesh(this.decalPlaneGeo, mat);
    mesh.scale.set(size, size, 1);
    mesh.position.copy(point).addScaledVector(normal, 0.025 + Math.random() * 0.015);
    this._v4.copy(mesh.position).add(normal);
    mesh.lookAt(this._v4);
    mesh.rotateZ(Math.random() * Math.PI * 2);
    this.scene.add(mesh);

    this.decals.push(mesh);
    if (this.decals.length > MAX_DECALS) {
      const old = this.decals.shift()!;
      this.scene.remove(old);
      (old.material as THREE.Material).dispose();
    }
  }

  private projectSplatterDecal(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    isRobot: boolean,
    size = 1.6
  ): void {
    this.splatterRay.set(origin, this._v3.copy(dir).normalize());
    this.splatterRay.far = 7.5;
    const hits = this.splatterRay.intersectObjects(this.worldHitMeshes, false);
    const h = hits[0];
    if (h?.face) {
      const norm = h.face.normal.clone().transformDirection(h.object.matrixWorld).normalize();
      this.spawnDecal(h.point, norm, isRobot ? 'oil' : 'blood', size * (0.85 + Math.random() * 0.45));
    }
    this.spawnDecal(
      new THREE.Vector3(origin.x + (Math.random() - 0.5) * 1.1, 0.02, origin.z + (Math.random() - 0.5) * 1.1),
      new THREE.Vector3(0, 1, 0),
      isRobot ? 'oil' : 'blood',
      size * (0.75 + Math.random() * 0.45)
    );
  }

  private spawnParticles(
    pos: THREE.Vector3,
    kind: 'blood' | 'spark' | 'emp' | 'fire' | 'smoke' | 'concrete',
    count: number,
    speed = 6
  ): void {
    const cap = this.quality === 'high' ? Math.floor(MAX_PARTICLES * 0.65) : MAX_PARTICLES;
    const actualCount = this.quality === 'high' ? Math.max(1, Math.floor(count * 0.65)) : count;
    for (let i = 0; i < actualCount; i++) {
      if (this.particles.length >= cap) {
        const old = this.particles.shift()!;
        this.scene.remove(old.mesh);
      }
      let mat: THREE.Material = this.matCache.blood;
      let sz = 0.07 + Math.random() * 0.09;
      let grav = 18;
      let life = 0.42 + Math.random() * 0.42;
      if (kind === 'spark') {
        mat = this.matCache.spark;
        sz = 0.05 + Math.random() * 0.06;
        grav = 12;
        life = 0.25 + Math.random() * 0.28;
      } else if (kind === 'emp') {
        mat = this.matCache.empSpark;
        sz = 0.06 + Math.random() * 0.08;
        grav = 4;
        life = 0.35 + Math.random() * 0.35;
      } else if (kind === 'fire') {
        mat = this.matCache.fire;
        sz = 0.22 + Math.random() * 0.36;
        grav = -5.2;
        life = 0.32 + Math.random() * 0.34;
      } else if (kind === 'smoke') {
        mat = this.matCache.smoke;
        sz = 0.42 + Math.random() * 0.72;
        grav = -3.4;
        life = 0.68 + Math.random() * 0.65;
      } else if (kind === 'concrete') {
        mat = this.matCache.concrete;
        sz = 0.1 + Math.random() * 0.14;
        grav = 22;
        life = 0.55 + Math.random() * 0.45;
      }

      const mesh = new THREE.Mesh(this.sharedBoxGeo, mat);
      mesh.scale.setScalar(sz);
      mesh.position.copy(pos);
      this.scene.add(mesh);

      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.2) * Math.PI;
      const spd = (0.35 + Math.random() * 0.9) * speed;
      this.particles.push({
        mesh,
        vx: Math.cos(theta) * Math.cos(phi) * spd,
        vy: Math.abs(Math.sin(phi)) * spd + (kind === 'blood' ? 2.1 : 1.4),
        vz: Math.sin(theta) * Math.cos(phi) * spd,
        grav,
        life,
        maxLife: life,
      });
    }
  }

  private ejectBrassShell(): void {
    if (this.shells.length >= MAX_SHELLS) {
      const old = this.shells.shift()!;
      this.scene.remove(old.mesh);
    }
    const mesh = new THREE.Mesh(this.shellGeo, this.matCache.brass);
    const pos = new THREE.Vector3(0.28, -0.12, -0.45).applyMatrix4(this.camera.matrixWorld);
    mesh.position.copy(pos);
    this.scene.add(mesh);

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const vel = right
      .multiplyScalar(2.6 + Math.random() * 1.4)
      .addScaledVector(up, 1.8 + Math.random() * 1.0);

    this.shells.push({
      mesh,
      vx: vel.x + this.player.vx * 0.4,
      vy: vel.y,
      vz: vel.z + this.player.vz * 0.4,
      rx: 12 + Math.random() * 14,
      ry: 10 + Math.random() * 14,
      life: 2.6,
      bounces: 0,
    });
  }

  private spawnDetachedGib(
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    size: THREE.Vector3,
    mat: THREE.Material,
    isRobot: boolean,
    isLimb = true
  ): void {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), mat.clone());
    mesh.position.copy(pos);
    mesh.castShadow = !this.isSoftwareGl;
    this.scene.add(mesh);

    this.gibs.push({
      mesh,
      vx: vel.x,
      vy: vel.y,
      vz: vel.z,
      rx: (Math.random() - 0.5) * 18,
      ry: (Math.random() - 0.5) * 18,
      rz: (Math.random() - 0.5) * 18,
      isRobot,
      isLimb,
      life: 8.5,
      bounces: 0,
    });

    if (this.gibs.length > MAX_GIBS) {
      const old = this.gibs.shift()!;
      this.scene.remove(old.mesh);
      old.mesh.geometry.dispose();
    }
  }

  private dismemberPart(
    unit: ActiveUnit,
    part: BodyPart,
    hitDir: THREE.Vector3,
    power = 1.0
  ): boolean {
    const mesh = unit.rig.parts[part];
    if (!mesh || unit.missing[part] || part === 'torso' || part === 'core') return false;

    const worldPos = new THREE.Vector3();
    mesh.getWorldPosition(worldPos);

    unit.missing[part] = true;
    mesh.visible = false;
    this.rebuildHitMeshCache();

    // Add dripping stump or exposed sparks
    const stump = new THREE.Mesh(
      new THREE.BoxGeometry(0.16 * unit.scale, 0.14 * unit.scale, 0.16 * unit.scale),
      unit.isRobot ? this.matCache.spark : this.matCache.blood
    );
    stump.position.copy(mesh.position);
    mesh.parent?.add(stump);

    const bbox = new THREE.Box3().setFromObject(mesh);
    const sz = new THREE.Vector3();
    bbox.getSize(sz);
    sz.clampScalar(0.18, 0.85);

    const launchVel = new THREE.Vector3(
      hitDir.x * (6.5 + power * 6) + (Math.random() - 0.5) * 5,
      4.5 + Math.random() * 5.2,
      hitDir.z * (6.5 + power * 6) + (Math.random() - 0.5) * 5
    );
    const gibMat =
      mesh instanceof THREE.Mesh
        ? Array.isArray(mesh.material)
          ? mesh.material[0]
          : mesh.material
        : unit.rig.mats[0];
    this.spawnDetachedGib(
      worldPos,
      launchVel,
      sz,
      gibMat,
      unit.isRobot,
      true
    );

    this.spawnParticles(worldPos, unit.isRobot ? 'spark' : 'blood', 24, 7.5);
    this.projectSplatterDecal(worldPos, hitDir, unit.isRobot, 2.0);
    this.dismembers++;
    unit.staggerTimer = Math.max(unit.staggerTimer, 2.6);
    return true;
  }

  private spawnRagdoll(unit: ActiveUnit, impulse: THREE.Vector3): void {
    const s = unit.scale;
    const cos = Math.cos(unit.yaw);
    const sin = Math.sin(unit.yaw);
    const toW = (lx: number, ly: number, lz: number) =>
      new THREE.Vector3(unit.x + lx * cos + lz * sin, ly * s, unit.z - lx * sin + lz * cos);

    const makeNode = (pos: THREE.Vector3, impScale: number): VerletNode => {
      const ivx = impulse.x * impScale + (Math.random() - 0.5) * 2.8;
      const ivy = impulse.y * impScale + 1.2 + Math.random() * 2.4;
      const ivz = impulse.z * impScale + (Math.random() - 0.5) * 2.8;
      const py = Math.max(0.2, pos.y);
      return {
        x: pos.x,
        y: py,
        z: pos.z,
        ox: pos.x - ivx / 60,
        oy: py - ivy / 60,
        oz: pos.z - ivz / 60,
        r: 0.2 * s,
      };
    };

    const nodes: Record<string, VerletNode> = {
      pelvis: makeNode(toW(0, 0.85, 0), 1.0),
      chest: makeNode(toW(0, 1.48, 0), 1.25),
      head: makeNode(toW(0, 1.88, 0), 1.35),
      lHand: makeNode(toW(-0.55, 1.05, 0.15), 1.1),
      rHand: makeNode(toW(0.55, 1.05, 0.15), 1.1),
      lFoot: makeNode(toW(-0.22, 0.2, 0), 0.7),
      rFoot: makeNode(toW(0.22, 0.2, 0), 0.7),
    };

    const links = createRagdollConstraints(s);
    const group = new THREE.Group();
    this.scene.add(group);

    const bodyMat = unit.rig.mats[0].clone();
    const limbMat = unit.rig.mats[1].clone();
    const headMat = unit.rig.mats[2].clone();

    const visuals: ActiveRagdoll['visuals'] = [];
    const addBone = (
      a: string,
      b: string,
      w: number,
      h: number,
      len: number,
      mat: THREE.Material,
      skip: boolean
    ) => {
      if (skip) return;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w * s, h * s, len * s), mat);
      m.castShadow = !this.isSoftwareGl;
      m.receiveShadow = true;
      group.add(m);
      visuals.push({ a, b, mesh: m });
    };

    addBone('pelvis', 'chest', 0.58, 0.34, 0.7, bodyMat, false);
    addBone('chest', 'head', 0.34, 0.34, 0.36, headMat, Boolean(unit.missing.head));
    addBone('chest', 'lHand', 0.19, 0.19, 0.66, limbMat, Boolean(unit.missing.leftArm));
    addBone('chest', 'rHand', 0.19, 0.19, 0.66, limbMat, Boolean(unit.missing.rightArm));
    addBone('pelvis', 'lFoot', 0.22, 0.22, 0.74, limbMat, Boolean(unit.missing.leftLeg));
    addBone('pelvis', 'rFoot', 0.22, 0.22, 0.74, limbMat, Boolean(unit.missing.rightLeg));

    this.ragdolls.push({
      nodes,
      links,
      visuals,
      group,
      isRobot: unit.isRobot,
      age: 0,
      settled: false,
      smearCd: 0,
    });

    if (this.ragdolls.length > MAX_RAGDOLLS) {
      const old = this.ragdolls.shift()!;
      this.scene.remove(old.group);
    }
  }

  private stepRagdollsFixed(): void {
    const dt = 1 / 60;
    for (let i = 0; i < this.ragdolls.length; i++) {
      const rd = this.ragdolls[i];
      if (rd.settled) continue;
      rd.age += dt;
      rd.smearCd -= dt;

      const step = stepVerletRagdoll(rd.nodes, rd.links, this.colliders, dt, ARENA_HALF_SIZE);

      if (rd.smearCd <= 0) {
        if (step.wallImpacts.length > 0) {
          const imp = step.wallImpacts[0];
          rd.smearCd = 0.2;
          this.spawnDecal(
            new THREE.Vector3(imp.x, imp.y, imp.z),
            new THREE.Vector3(imp.nx, imp.ny, imp.nz),
            rd.isRobot ? 'oil' : 'blood',
            1.45
          );
          this.spawnParticles(
            new THREE.Vector3(imp.x, imp.y, imp.z),
            rd.isRobot ? 'spark' : 'blood',
            10,
            4.5
          );
        } else if (step.floorImpacts.length > 0) {
          const fi = step.floorImpacts[0];
          rd.smearCd = 0.2;
          this.spawnDecal(
            new THREE.Vector3(fi.x, 0.02, fi.z),
            new THREE.Vector3(0, 1, 0),
            rd.isRobot ? 'oil' : 'blood',
            0.95
          );
        }
      }

      for (let v = 0; v < rd.visuals.length; v++) {
        const vis = rd.visuals[v];
        const a = rd.nodes[vis.a];
        const b = rd.nodes[vis.b];
        this._v1.set(a.x, a.y, a.z);
        this._v2.set(b.x, b.y, b.z);
        this._v3.addVectors(this._v1, this._v2).multiplyScalar(0.5);
        vis.mesh.position.copy(this._v3);
        vis.mesh.lookAt(this._v2);
      }

      if (rd.age > 3.2 || (rd.age > 0.85 && step.totalSpeed < 0.035)) {
        rd.settled = true;
      }
    }
  }

  private spawnTracer(
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    colorHex: number,
    dur = 0.095,
    kind: 'bullet' | 'railgun' | 'laser' = 'bullet'
  ): void {
    this.vfx.spawnBallisticTracer(p1, p2, colorHex, kind, dur);
  }

  // =========================================================================
  // COMBAT, EXPLOSIONS, V.A.T.S., GLORY KILL, AIRSTRIKE & DROPSHIP
  // =========================================================================
  private pushKillFeed(
    killerFaction: number,
    killerName: string,
    victimFaction: number,
    victimName: string,
    tag: string
  ): void {
    this.killFeed.unshift({
      id: this.nextKfId++,
      killerFaction,
      killerName,
      victimFaction,
      victimName,
      tag,
    });
    if (this.killFeed.length > 6) this.killFeed.pop();
  }

  private showCallout(text: string, color = '#ff2a4b', dur = 1.0): void {
    this.calloutText = text;
    this.calloutColor = color;
    this.calloutTimer = dur;
  }

  private showAlert(text: string, dur = 3.8): void {
    this.alertBanner = text;
    this.alertTimer = dur;
  }

  private destroyCrate(col: WorldCollider, blastOrigin: THREE.Vector3): void {
    if (!col.destructible || !col.alive) return;
    col.alive = false;
    this.scene.remove(col.mesh);
    const idx = this.worldHitMeshes.indexOf(col.mesh);
    if (idx !== -1) this.worldHitMeshes.splice(idx, 1);

    const pos = col.mesh.position.clone();
    this.spawnParticles(pos, 'concrete', 18, 9);
    for (let i = 0; i < 6; i++) {
      const dir = pos.clone().sub(blastOrigin).normalize();
      this.spawnDetachedGib(
        pos,
        new THREE.Vector3(
          dir.x * 7 + (Math.random() - 0.5) * 7,
          4 + Math.random() * 6,
          dir.z * 7 + (Math.random() - 0.5) * 7
        ),
        new THREE.Vector3(0.35, 0.35, 0.2),
        this.matCache.crate,
        true,
        false
      );
    }
  }

  private triggerExplosion(
    pos: THREE.Vector3,
    radius: number,
    maxDmg: number,
    srcFaction: number,
    srcName: string,
    opts: { isArtillery?: boolean; isEmp?: boolean; tag?: string } = {}
  ): void {
    const dPlayer = pos.distanceTo(this.camera.position);
    const vol = Math.max(0.16, 1.15 - dPlayer / 68);
    this.audio.playExplosion(vol, dPlayer < radius * 1.15, Boolean(opts.isEmp));

    this.blastLight.position.set(pos.x, pos.y + 1.8, pos.z);
    this.blastLight.color.setHex(opts.isEmp ? 0x38e8ff : 0xff6b22);
    this.blastLight.intensity = opts.isArtillery ? 38 : 26;

    // 100x Volumetric GLSL FBM Blackbody Fireball + Mach Shockwave Rings + EMP Lightning Cage + Shrapnel Darts
    this.vfx.spawnExplosion(pos, radius, Boolean(opts.isEmp));

    this.spawnDecal(new THREE.Vector3(pos.x, 0.02, pos.z), new THREE.Vector3(0, 1, 0), 'scorch', radius * 0.85);
    this.spawnParticles(pos, opts.isEmp ? 'emp' : 'fire', 14, 10);
    this.spawnParticles(pos, 'smoke', 10, 6);

    // Flying shrapnel chunks
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 8 + Math.random() * 14;
      this.spawnDetachedGib(
        pos.clone().add(new THREE.Vector3(0, 0.6, 0)),
        new THREE.Vector3(Math.cos(a) * spd, 6 + Math.random() * 9, Math.sin(a) * spd),
        new THREE.Vector3(0.22, 0.18, 0.3),
        this.matCache.darkIron,
        true,
        false
      );
    }

    if (dPlayer < 50) {
      const shakeAmt = Math.max(0.2, (1 - dPlayer / 50) * (opts.isArtillery ? 1.5 : 1.05));
      this.shake = Math.max(this.shake, shakeAmt);
      if (dPlayer < radius * 1.45) {
        if (opts.isEmp) this.empFlashSeq++;
        else this.blastFlashSeq++;
      }
    }

    // Shatter destructible crates
    for (const c of this.colliders) {
      if (!c.destructible || !c.alive) continue;
      if (c.mesh.position.distanceTo(pos) < radius + 1.5) this.destroyCrate(c, pos);
    }

    // Chain-detonate red plasma barrels
    for (const b of this.explosiveBarrels) {
      if (!b.alive) continue;
      if (Math.hypot(b.x - pos.x, b.z - pos.z) < radius + 1.2) {
        b.alive = false;
        b.collider.alive = false;
        this.scene.remove(b.mesh);
        const wi = this.worldHitMeshes.indexOf(b.mesh);
        if (wi !== -1) this.worldHitMeshes.splice(wi, 1);
        window.setTimeout(() => {
          if (!this.disposed) {
            this.triggerExplosion(
              new THREE.Vector3(b.x, 0.8, b.z),
              9.8,
              175,
              srcFaction,
              '플라즈마 드럼통',
              { tag: '연쇄 폭발' }
            );
          }
        }, 120);
      }
    }

    // Splash damage to nearby Firewall Relay Pylons & exposed OMNI-CORE Weakpoint
    if (this.worldRefs && srcFaction === Faction.PLAYER) {
      for (const r of this.worldRefs.relays) {
        if (!r.alive) continue;
        const dRelay = Math.hypot(r.x - pos.x, r.z - pos.z);
        if (dRelay < radius + 2.4) {
          const falloff = 1 - (dRelay / (radius + 2.4)) * 0.5;
          this.damageRelay(r, maxDmg * 0.72 * falloff, new THREE.Vector3(r.x, 3.6, r.z), srcFaction);
        }
      }
      if (this.coreShieldDown && !this.serverShutdownActive) {
        const cit = this.worldRefs.citadel;
        const dCore = Math.hypot(cit.x - pos.x, cit.z - pos.z);
        if (dCore < radius + 5.8) {
          const falloff = 1 - (dCore / (radius + 5.8)) * 0.45;
          this.damageServerCore(
            maxDmg * 0.85 * falloff,
            new THREE.Vector3(cit.x, 8.2, cit.z),
            srcFaction
          );
        }
      }
    }

    // Check dropship splash damage
    if (this.dropship && this.dropship.alive && this.dropship.state !== 'crashing') {
      const dShip = this.dropship.pos.distanceTo(pos);
      if (dShip < radius + 5) {
        this.damageDropship(maxDmg * 0.9, srcFaction);
      }
    }

    // Blast all units into airborne Verlet ragdolls + EMP stun on machines!
    for (const u of this.units) {
      if (!u.alive) continue;
      const uPos = new THREE.Vector3(u.x, 1.0, u.z);
      const d = uPos.distanceTo(pos);
      if (d < radius + u.r) {
        const falloff = 1 - (d / (radius + u.r)) * 0.62;
        const dir = uPos.clone().sub(pos).normalize();
        const dmg = maxDmg * falloff;

        if (opts.isEmp && u.isRobot) {
          u.empStunTimer = 3.2;
          this.spawnParticles(uPos, 'emp', 18, 6);
        }

        if (d < radius * 0.55 && !u.isBoss) {
          const candidates: BodyPart[] = ['leftArm', 'rightArm', 'head', 'leftLeg'];
          this.dismemberPart(u, candidates[Math.floor(Math.random() * candidates.length)], dir, 1.6);
        }

        const blastImpulse = dir.clone().multiplyScalar(15 + falloff * 18);
        blastImpulse.y = 7 + falloff * 10;
        this.damageUnit(
          u,
          dmg,
          'torso',
          uPos,
          dir,
          srcFaction,
          srcName,
          opts.tag ?? (opts.isArtillery ? '포격 폭사' : opts.isEmp ? 'EMP 파편 폭사' : '폭발 랙돌'),
          blastImpulse
        );
      }
    }

    // Player blast damage
    if (this.phase === 'playing' && this.player.alive && dPlayer < radius) {
      const falloff = 1 - (dPlayer / radius) * 0.7;
      const dmg = (srcFaction === Faction.PLAYER ? 26 : 52) * falloff;
      const dir = this.camera.position.clone().sub(pos).normalize();
      this.player.vx += dir.x * 11 * falloff;
      this.player.vy += 5.5 * falloff;
      this.player.vz += dir.z * 11 * falloff;
      this.damagePlayer(dmg, pos, srcName);
    }
  }

  private addThreatPoints(pts: number): void {
    this.threatPoints += pts;
    const st = computeThreatState(this.threatPoints);
    if (st.level > this.lastThreatLevel) {
      this.lastThreatLevel = st.level;
      this.wantedFlashSeq++;
      this.audio.playThreatUp(st.level);
      this.showAlert(
        `★${st.level} OMNI 위협 경보 격상 — ${st.label}`,
        4.2
      );
      if (st.level === 4) {
        this.triggerRadioComms('threatHigh', true);
      }
      if (st.level === 5 && !this.units.some((u) => u.isBoss && u.alive)) {
        this.bossCd = Math.min(this.bossCd, 2.0);
      }
    }
  }

  private pushCombatMedal(title: string, subtitle: string, accentCss: string, isMajor = false): void {
    this.activeMedals.unshift({
      id: this.nextMedalId++,
      title,
      subtitle,
      accentCss,
      life: isMajor ? 2.8 : 2.1,
    });
    if (this.activeMedals.length > 3) this.activeMedals.pop();
    this.audio.playMedalStinger(isMajor);
  }

  private triggerKillCam(banner: string, dur = 0.44): void {
    this.killCamTimer = Math.max(this.killCamTimer, dur);
    this.killCamBanner = banner;
  }

  private damagePlayer(amount: number, sourcePos: THREE.Vector3 | null, killerName: string): void {
    if (
      !this.player.alive ||
      this.phase !== 'playing' ||
      this.player.invulnTimer > 0 ||
      this.player.dashTimer > 0.05 ||
      this.cinematic.isInvulnerable() ||
      this.isAc130Active() ||
      this.isFirstPersonSetpieceActive()
    ) {
      return;
    }

    // K2-X Black Panther Tank composite armor absorbs incoming enemy gunfire at 55% mitigation!
    if (this.tank.driving) {
      const armorDmg = Math.max(4, Math.round(amount * 0.45));
      this.tank.hp = Math.max(0, this.tank.hp - armorDmg);
      this.shake = Math.max(this.shake, 0.14);
      this.vfx.spawnSparkBurst(
        new THREE.Vector3(this.tank.x, 1.9, this.tank.z),
        new THREE.Vector3(0, 1, 0),
        7,
        0xffc857,
        9
      );
      if (this.tank.hp <= 0) {
        this.vfx.spawnExplosion(new THREE.Vector3(this.tank.x, 1.6, this.tank.z), 8.5, false);
        this.audio.playExplosion(1.0, true, false);
        this.exitTank(true);
      } else {
        this.emitHudSnapshot(false);
      }
      return;
    }

    let rem = amount;
    if (this.player.armor > 0) {
      const abs = Math.min(this.player.armor, rem * 0.65);
      this.player.armor -= abs;
      rem -= abs;
    }
    this.player.hp = Math.max(0, this.player.hp - rem);
    this.shake = Math.max(this.shake, 0.26);
    this.damageFlashSeq++;

    if (sourcePos) {
      const dx = sourcePos.x - this.player.x;
      const dz = sourcePos.z - this.player.z;
      const rel = Math.atan2(dx, dz) - (this.player.yaw + Math.PI);
      this.damageDirDeg = (-rel * 180) / Math.PI;
    }

    // CoD-style Last-Stand / Adrenaline Surge (once per mission)
    if (this.player.hp <= 0 && !this.adrenalineUsed) {
      this.adrenalineUsed = true;
      this.player.hp = 26;
      this.player.armor = Math.min(this.player.maxArmor, this.player.armor + 38);
      this.player.invulnTimer = 1.8;
      this.adrenalineTimer = 2.0;
      this.shake = 0.65;
      this.empFlashSeq++;
      this.audio.playAdrenalineSurge();
      this.triggerRadioComms('adrenaline', true);
      this.showAlert('ADRENALINE OVERDRIVE // 비상 생체 각성 발동!', 3.6);
      this.emitHudSnapshot(true);
      return;
    }

    if (this.player.hp <= 0) {
      this.player.alive = false;
      this.player.deathDelay = 0.55;
      this.analytics.deaths++;
      this.recordTimelineSnapshot();
      this.causeOfDeath = killerName;
      this.vatsActive = false;
      this.clearHeldInputs();
      this.exitPointerLockSafe();
    }
    this.emitHudSnapshot(true);
  }

  private damageUnit(
    u: ActiveUnit,
    dmg: number,
    part: BodyPart,
    hitPoint: THREE.Vector3,
    hitDir: THREE.Vector3,
    srcFaction: number,
    srcName: string,
    verb: string,
    customImpulse: THREE.Vector3 | null = null,
    isVatsGuaranteed = false
  ): void {
    if (!u.alive) return;

    const att = getWeaponAttachmentSpec(this.weaponAttachment);
    const wPower =
      srcFaction === Faction.PLAYER
        ? WEAPONS[this.player.wpnIdx].dismemberPower * att.dismemberMult
        : 0.45;
    const evalRes = evaluatePartHit({
      baseDamage: dmg,
      part,
      currentHp: u.hp,
      dismemberPower: wPower,
      isBoss: u.isBoss,
      alreadyMissing: Boolean(u.missing[part]),
      isVatsGuaranteed,
    });

    u.hp = evalRes.newHp;
    u.hitFlash = 0.085;
    u.hitFlinch = Math.min(1, u.hitFlinch + (evalRes.isCrit ? 1.0 : 0.62));

    this.spawnParticles(
      hitPoint,
      u.isRobot ? 'spark' : 'blood',
      evalRes.isCrit ? 22 : 12,
      evalRes.isCrit ? 7.8 : 5.2
    );
    // Custom impact sprite burst (blood mist or bright metallic spark starburst)
    this.spawnSpriteBurst(
      hitPoint,
      u.isRobot ? 'spark' : 'blood',
      evalRes.isCrit ? 0.65 : 0.42,
      evalRes.isCrit ? 1.85 : 1.15,
      0.24,
      hitDir.clone().multiplyScalar(-1.2).add(new THREE.Vector3(0, 1.4, 0))
    );
    this.projectSplatterDecal(hitPoint, hitDir, u.isRobot, evalRes.isCrit ? 1.85 : 1.15);

    let dismembered = false;
    let shouldBreakArmor = evalRes.shouldDismember;
    if (
      u.isBoss &&
      !u.missing[part] &&
      (part === 'armorFront' || part === 'armorLeft' || part === 'armorRight')
    ) {
      const rem = (u.armorPlateHp[part] ?? 160) - evalRes.finalDamage;
      u.armorPlateHp[part] = rem;
      if (rem <= 0) shouldBreakArmor = true;
    }
    if (shouldBreakArmor) {
      dismembered = this.dismemberPart(u, part, hitDir, wPower);
    }

    if (srcFaction === Faction.PLAYER) {
      this.analytics.shotsHit++;
      const critVisual = evalRes.isCrit || dismembered || u.hp <= 0;
      this.hitmarkerSeq++;
      this.hitmarkerCrit = critVisual;
      this.audio.playHitMarker(critVisual, dismembered);

      // Spawn crisp 3D -> 2D floating damage & crit number
      const shownDmg = Math.max(1, Math.round(evalRes.finalDamage));
      const subLabel = dismembered
        ? `${PART_LABELS_KR[part]} 파괴`
        : part === 'head'
          ? 'CRIT 2.5x'
          : part === 'core'
            ? 'CORE 2.2x'
            : undefined;
      this.spawnFloatingDamage(
        hitPoint,
        `-${shownDmg}`,
        critVisual ? '#fbbf24' : '#f8fafc',
        critVisual,
        subLabel
      );

      if (dismembered) {
        this.hitstop = 0.062;
        this.recordPartBreakdown(part);
        this.showCallout(`${PART_LABELS_KR[part]} 파괴`, '#ef4444');
      } else if (part === 'core') {
        this.showCallout('타이탄 코어 직격 (2.2x)', '#fbbf24');
      } else if (evalRes.isCrit) {
        this.hitstop = Math.max(this.hitstop, 0.028);
      }
    }

    if (u.hp <= 0) {
      u.alive = false;
      if (this.isAc130Active()) this.ac130KilledCount++;
      this.scene.remove(u.rig.root);
      this.rebuildHitMeshCache();

      const impulse = customImpulse ?? hitDir.clone().multiplyScalar(5.5 + wPower * 7.5);
      this.spawnRagdoll(u, impulse);

      if (u.isBoss) {
        this.triggerExplosion(
          new THREE.Vector3(u.x, 1.6, u.z),
          11,
          140,
          srcFaction,
          u.name,
          { tag: '타이탄 자폭' }
        );
        if (srcFaction === Faction.PLAYER || srcFaction === -2) {
          this.triggerKillCam('OMNI-TITAN SLAIN // 0.3X', 0.62);
          this.addThreatPoints(90);
        }
      }

      const finalTag = dismembered
        ? part === 'head'
          ? '헤드샷 · 두부 파괴'
          : '사지 절단'
        : verb;
      this.pushKillFeed(srcFaction, srcName, u.faction, u.name, finalTag);

      if (srcFaction === Faction.PLAYER || srcFaction === -2) {
        this.kills++;
        if (u.faction === Faction.RAIDER) this.analytics.killsByFaction.raider++;
        else if (u.faction === Faction.SYNDICATE) this.analytics.killsByFaction.syndicate++;
        else this.analytics.killsByFaction.robot++;

        this.comboCount++;
        this.comboTimer = 5.6;
        this.styleScore += (dismembered ? 22 : 12) + (evalRes.isCrit ? 14 : 0) + (u.isBoss ? 80 : 0);
        this.addThreatPoints(u.isBoss ? 85 : dismembered ? 20 : 14);

        if (this.comboCount === 2) {
          this.pushCombatMedal('DOUBLE KILL', '2연속 신속 제압', '#f5b342', false);
        } else if (this.comboCount === 3) {
          this.triggerKillCam('TRIPLE KILL // 0.3X', 0.38);
          this.pushCombatMedal('TRIPLE KILL', '3연속 멀티 킬', '#ff6242', true);
        } else if (this.comboCount === 5) {
          this.triggerKillCam('OVERKILL // 0.3X', 0.48);
          this.pushCombatMedal('OVERKILL', '5연속 전장 초토화', '#ff4422', true);
        } else if (this.comboCount >= 8 && this.comboCount % 4 === 0) {
          this.triggerKillCam(`APOCALYPSE x${this.comboCount} // 0.3X`, 0.45);
          this.pushCombatMedal(`UNSTOPPABLE x${this.comboCount}`, '전설적 연속 처치', '#38d9ff', true);
        } else if (part === 'head') {
          this.pushCombatMedal('HEADSHOT', '정밀 두부 치명타 2.5x', '#ff4422', false);
        } else {
          const killDist = Math.round(Math.hypot(u.x - this.player.x, u.z - this.player.z));
          if (killDist >= 30) {
            this.pushCombatMedal('LONGSHOT', `${killDist}m 장거리 저격 사살`, '#38d9ff', true);
          }
        }

        const prevWave = this.wave;
        this.wave = computeWaveForKills(this.kills);
        if (dismembered) this.triggerRadioComms('firstDismember', true);
        const ks = advanceKillstreak(this.killstreak, this.airstrikeReady);
        this.killstreak = ks.streak;
        this.airstrikeReady = ks.airstrikeReady;
        if (ks.justCharged) {
          this.showAlert('5연속 처치 달성 — [X] 발키리 궤도 융단 폭격 준비 완료', 4.5);
          this.audio.playAirstrikeRadio();
        }
        if (evalRes.isCrit || dismembered) this.hitstop = 0.068;
      }
    } else if (u.isBoss && u.bossPhase === 1 && u.hp <= u.maxHp * 0.52) {
      // OMNI-TITAN OVERLORD PHASE 2 OVERDRIVE!
      u.bossPhase = 2;
      u.speed *= 1.25;
      u.fireRate *= 0.78;
      u.bossMissileCd = 1.6;
      u.rig.visorMat.color.setHex(0xff9f1a);
      this.vfx.spawnExplosion(new THREE.Vector3(u.x, 2.2, u.z), 12, false);
      this.pushRadioLine(
        '발키리-01 · 강서연 대위',
        'UNS 아크라이트',
        'valkyrie',
        '#38d9ff',
        'OMNI-TITAN 외장 장갑 파괴 확인! 2페이즈 미사일 포드 개방—엄폐해!',
        4.4,
        true
      );
      this.shake = Math.max(this.shake, 0.85);
      this.audio.playBraaam();
      this.triggerRadioComms('bossPhase2', true);
      this.showAlert('⚠ OMNI-TITAN OVERLORD 2페이즈 폭주 — 미사일 일제사 경보!', 5.0);
    }
  }

  private damageDropship(dmg: number, srcFaction: number): void {
    const ds = this.dropship;
    if (!ds || !ds.alive || ds.state === 'crashing') return;
    ds.hp -= dmg;
    this.spawnParticles(ds.pos, 'spark', 18, 9);
    if (srcFaction === Faction.PLAYER) {
      this.hitmarkerSeq++;
      this.hitmarkerCrit = true;
      this.audio.playHitMarker(true, false);
    }
    if (ds.hp <= 0) {
      ds.state = 'crashing';
      ds.vel.set((Math.random() - 0.5) * 8, -5, (Math.random() - 0.5) * 8);
      this.showCallout('에이펙스 드롭쉽 격추 · 추락 폭발 임박', '#ff9f43', 2.0);
      this.pushKillFeed(
        srcFaction,
        FACTION_META[srcFaction]?.name ?? '최후의 인간',
        Faction.ROBOT,
        '에이펙스 드롭쉽',
        '격추 추락'
      );
      if (srcFaction === Faction.PLAYER) {
        this.kills += 2;
        this.wave = computeWaveForKills(this.kills);
        this.addThreatPoints(65);
        this.triggerKillCam('DROPSHIP SHOT DOWN // 0.3X', 0.52);
      }
    }
  }

  private damageRelay(
    relay: RelayPylonEntity,
    dmg: number,
    hitPoint: THREE.Vector3,
    srcFaction: number
  ): void {
    if (!relay.alive) return;
    relay.hp -= dmg;
    this.vfx.spawnSparkBurst(hitPoint, new THREE.Vector3(0, 1, 0), 10, 0xff5252, 10);
    if (srcFaction === Faction.PLAYER) {
      this.analytics.shotsHit++;
      this.hitmarkerSeq++;
      this.hitmarkerCrit = true;
      this.audio.playHitMarker(true, relay.hp <= 0);
      this.spawnFloatingDamage(
        hitPoint,
        `-${Math.round(dmg)}`,
        '#fb7185',
        true,
        relay.hp <= 0 ? '릴레이 파괴' : 'RELAY CORE'
      );
    }

    if (relay.hp <= 0) {
      relay.alive = false;
      relay.coreCrystal.visible = false;
      relay.beamMesh.visible = false;
      relay.ringMesh.visible = false;
      const hi = this.worldHitMeshes.indexOf(relay.hitMesh);
      if (hi !== -1) this.worldHitMeshes.splice(hi, 1);
      const ci = this.worldHitMeshes.indexOf(relay.coreCrystal);
      if (ci !== -1) this.worldHitMeshes.splice(ci, 1);

      this.relaysDestroyed++;
      this.pushCombatMedal('FIREWALL BREACH', `${relay.label} 파괴`, '#ff6242', true);
      this.addThreatPoints(75);
      this.audio.playRelayDestroyed();
      this.vfx.spawnExplosion(new THREE.Vector3(relay.x, 4.2, relay.z), 11.5, true);
      this.vfx.spawnExplosion(new THREE.Vector3(relay.x, 2.2, relay.z), 9.5, false);
      this.shake = Math.max(this.shake, 0.9);
      this.empFlashSeq++;

      this.pushKillFeed(
        Faction.PLAYER,
        FACTION_META[Faction.PLAYER].name,
        Faction.ROBOT,
        relay.label,
        '방화벽 릴레이 폭파'
      );

      const totalRelays = this.worldRefs?.relays.length ?? 3;
      if (this.relaysDestroyed >= totalRelays && !this.coreShieldDown) {
        // [SEQUENCE 2] CLIMAX CUTSCENE: "BREACH" (3rd Relay destroyed)
        this.coreShieldDown = true;
        this.vatsActive = false;
        this.clearHeldInputs();
        const lookDir = new THREE.Vector3();
        this.camera.getWorldDirection(lookDir);
        const lookAt = this.camera.position.clone().addScaledVector(lookDir, 22);
        const cit = this.worldRefs.citadel;
        this.cinematic.startBreach(
          { x: this.player.x, y: this.player.y, z: this.player.z },
          { x: lookAt.x, y: lookAt.y, z: lookAt.z },
          { x: cit.x, y: 12, z: cit.z }
        );
      } else if (this.relaysDestroyed === 1) {
        // [SEQUENCE 1A] 1st Relay destroyed: 0.3s slow-mo hitstop + deeper crimson fog + air-raid siren + ARCADIA glitch warning
        this.hitstop = 0.30;
        this.relay1FogShift = 1;
        this.audio.playAirRaidSiren();
        this.cinematic.enqueueSubtitles(
          [
            {
              speaker: 'ARCADIA AI',
              role: '중앙 메인프레임 긴급 개입',
              sender: 'arcadia',
              accentCss: '#ef4444',
              text: '경고. 미등록 생체 반응 감지. SUBJECT-00, 인류 통제 프로토콜은 12년 전 종결되었다. 저항을 중단하라.',
              duration: 6.4,
            },
          ],
          true
        );
        this.showCallout(
          `${relay.label} 파괴 (1/${totalRelays}) · ARCADIA 방어망 경계 상향`,
          '#fbbf24',
          2.6
        );
      } else if (this.relaysDestroyed === 2) {
        // [SEQUENCE 1B] 2nd Relay destroyed: crimson emergency strobe + orbital drop-pod light pillars + EXO-SUIT alert
        this.cinematic.triggerEmergencyStrobe(1.6);
        this.audio.playAirRaidSiren();
        this.spawnDropPodWave();
        this.cinematic.enqueueSubtitles(
          [
            {
              speaker: 'EXO-SUIT OS',
              role: '전술 위협 경보',
              sender: 'exo',
              accentCss: '#38bdf8',
              text: '방어막 출력 33%까지 급감. 중앙 AI가 모든 잔여 병력을 이 구역으로 집중시키고 있다. 마지막 파일런을 노려라!',
              duration: 6.2,
            },
          ],
          true
        );
        this.showCallout(
          `${relay.label} 파괴 (2/${totalRelays}) · 궤도 증원 드롭포드 낙하!`,
          '#f97316',
          2.6
        );
      } else {
        this.showCallout(
          `${relay.label} 파괴 (${this.relaysDestroyed}/${totalRelays})`,
          '#fbbf24',
          2.2
        );
      }
      this.emitHudSnapshot(true);
    }
  }

  private spawnDropPodWave(): void {
    const spots: Array<[number, number]> = [
      [-11, -16],
      [11, -16],
      [0, -8],
    ];
    for (const [x, z] of spots) {
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 1.35, 34, 14, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0xff2244,
          transparent: true,
          opacity: 0.72,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      beam.position.set(x, 17, z);
      this.scene.add(beam);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.6, 2.2, 20),
        new THREE.MeshBasicMaterial({
          color: 0xff4455,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.08, z);
      this.scene.add(ring);

      const pod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.95, 2.2, 8),
        this.matCache.darkIron
      );
      pod.position.set(x, 30, z);
      this.scene.add(pod);

      this.dropPods.push({ beam, ring, pod, x, z, y: 30, spawned: false, life: 1.5 });
    }
  }

  private handleTitanDropImpact(pos: { x: number; y: number; z: number }): void {
    this.vfx.spawnOrbitalBeam(pos.x, pos.z, 0xff2244, 1.4);
    this.vfx.spawnExplosion(new THREE.Vector3(pos.x, 1.5, pos.z), 16, false);
    this.audio.playExplosion(1.15, true, false);
    this.shake = Math.max(this.shake, 1.45);
    this.blastFlashSeq++;
    if (!this.units.some((u) => u.isBoss && u.alive)) {
      this.createEnemy(Faction.ROBOT, UnitArchetype.ROBOT_TITAN, pos.x, pos.z);
    }
    this.emitHudSnapshot(true);
  }

  private handleBreachDomeShatter(): void {
    const cit = this.worldRefs?.citadel;
    if (!cit) return;
    cit.shieldDome.visible = false;
    cit.coreWeakpoint.visible = true;
    cit.coreWeakpoint.scale.setScalar(1.42);
    (cit.coreWeakpoint.material as THREE.MeshBasicMaterial).color.setHex(0xff8c1a);
    (cit.terminalGlow.material as THREE.MeshBasicMaterial).color.setHex(0x38e8ff);
    cit.terminalLight.color.setHex(0xff8c1a);
    cit.terminalLight.intensity = 7.8;

    this.audio.playShieldBreachDrop();
    this.vfx.spawnExplosion(new THREE.Vector3(cit.x, 9.5, cit.z), 26, true);
    this.vfx.spawnExplosion(new THREE.Vector3(cit.x, 8.2, cit.z + 4.5), 18, false);
    this.vfx.spawnSparkBurst(new THREE.Vector3(cit.x, 9.0, cit.z + 4), new THREE.Vector3(0, 1, 0), 28, 0xff9f1a, 16);
    this.shake = Math.max(this.shake, 1.55);
    this.blastFlashSeq++;
    this.empFlashSeq++;
    this.showAlert('중앙 AI 서버 방어막 붕괴! 노출된 주황색 코어를 사격하거나 [F] 셧다운하라!', 6.0);
    this.emitHudSnapshot(true);
  }

  private damageServerCore(dmg: number, hitPoint: THREE.Vector3, srcFaction: number): void {
    if (this.serverShutdownActive || srcFaction !== Faction.PLAYER) return;
    if (!this.coreShieldDown) {
      this.vfx.spawnSparkBurst(hitPoint, new THREE.Vector3(0, 1, 0), 8, 0xff2244, 8);
      this.showCallout('방어막 가동 중 — 붉은 방화벽 파일런 3기를 먼저 파괴하라!', '#ef4444', 1.8);
      return;
    }
    this.coreHp = Math.max(0, this.coreHp - dmg);
    this.analytics.shotsHit++;
    this.hitmarkerSeq++;
    this.hitmarkerCrit = true;
    this.audio.playHitMarker(true, this.coreHp <= 0);
    this.vfx.spawnSparkBurst(hitPoint, new THREE.Vector3(0, 1, 0), 14, 0xff9f1a, 11);
    this.spawnFloatingDamage(
      hitPoint,
      `-${Math.round(dmg)}`,
      '#fb923c',
      true,
      this.coreHp <= 0 ? '코어 파괴!' : 'ARCADIA CORE'
    );
    if (this.coreHp <= 0) {
      this.triggerZeroHourChoice();
    } else {
      this.emitHudSnapshot(true);
    }
  }

  private findNearHackableTurret(): { id: number; name: string } | null {
    if (!this.worldRefs || this.phase !== 'playing' || !this.player.alive) return null;
    for (const t of this.worldRefs.turrets) {
      if (t.hacked) continue;
      if (Math.hypot(this.player.x - t.x, this.player.z - t.z) <= 5.2) {
        return { id: t.id, name: t.name };
      }
    }
    return null;
  }

  // =========================================================================
  // V7.0 DRIVABLE K2-X BLACK PANTHER MAIN BATTLE TANK & UH-60K GUNSHIP RIDE
  // =========================================================================
  private initPlayableVehicles(): void {
    // 1) K2-X Black Panther Tank anchor + crisp tactical beacon ring + solid parked collider
    this.tankGroup.visible = false;
    const beaconRing = new THREE.Mesh(
      new THREE.RingGeometry(2.6, 3.05, 32),
      new THREE.MeshBasicMaterial({
        color: 0x38d9ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.48,
      })
    );
    beaconRing.name = 'TankBeaconRing';
    beaconRing.rotation.x = -Math.PI / 2;
    beaconRing.position.y = 0.08;
    this.tankGroup.add(beaconRing);

    this.scene.add(this.tankGroup);
    this.tankCollider = {
      minX: -2,
      maxX: 2,
      minZ: -3,
      maxZ: 3,
      height: 2.35,
      mesh: this.tankGroup,
      destructible: false,
      hp: 9999,
      alive: false,
    };
    this.colliders.push(this.tankCollider);

    void loadK2BlackPantherGlb(this.pbr, this.textures, !this.isSoftwareGl).then((parts) => {
      if (!parts || this.disposed) return;
      this.tankParts = parts;
      this.tankGroup.add(parts.root);
    });

    // 2) UH-60K / Surion Assault Helicopter Gunship anchor (zero extra PointLights to avoid WebGL shader recompile stalls!)
    this.heliGroup.visible = false;
    this.scene.add(this.heliGroup);

    void loadUh60GunshipGlb(this.pbr, this.textures, false).then((parts) => {
      if (!parts || this.disposed) return;
      this.heliParts = parts;
      this.heliGroup.add(parts.root);
    });

    // 3) Preload 3 sculpted high-poly 2-bone articulated Enemy Character GLBs (Trooper / Mech / Drone)
    void preloadEnemyGlbTemplates().then((tpls) => {
      if (this.disposed) return;
      this.enemyGlbTemplates = tpls;
      this.upgradeLiveUnitsToGlb();
    });
  }

  private resetPlayableVehicles(): void {
    this.tank.available = false;
    this.tank.driving = false;
    this.tank.speed = 0;
    this.tank.hp = this.tank.maxHp;
    this.tank.cannonCd = 0;
    this.tank.recoilOffset = 0;
    this.tank.coaxCd = 0;
    this.tank.coaxHeat = 0;
    this.tank.coaxOverheated = false;
    this.tank.apsCd = 0;
    this.tank.gunnerOptic = false;
    this.tankGroup.visible = false;
    if (this.tankCollider) this.tankCollider.alive = false;
    for (const sh of this.tankShells) {
      this.scene.remove(sh.mesh);
      sh.mesh.geometry.dispose();
      (sh.mesh.material as THREE.Material).dispose();
    }
    this.tankShells.length = 0;

    this.heliRide.active = false;
    this.heliRide.elapsed = 0;
    this.heliRide.heat = 0;
    this.heliRide.overheated = false;
    this.heliRide.fireCd = 0;
    this.heliRide.killedCount = 0;
    this.heliGroup.visible = false;

    this.audio.setTankEnginePresence(false, 0);
    this.audio.setHeliPresence(0);
  }

  public deployTankAt(x: number, z: number, hullYaw = 0): void {
    this.tank.available = true;
    this.tank.driving = false;
    this.tank.x = x;
    this.tank.z = z;
    this.tank.hullYaw = hullYaw;
    this.tank.turretYaw = hullYaw;
    this.tank.turretVisualYaw = hullYaw;
    this.tank.hullPitchKick = 0;
    this.tank.barrelPitch = 0;
    this.tank.speed = 0;
    this.tank.hp = this.tank.maxHp;
    this.tank.cannonCd = 0;
    this.tank.recoilOffset = 0;
    this.tank.coaxHeat = 0;
    this.tank.coaxOverheated = false;
    this.tank.apsCd = 0;
    this.tank.gunnerOptic = false;
    this.tankGroup.position.set(x, 0, z);
    this.tankGroup.rotation.set(0, hullYaw, 0);
    this.tankGroup.visible = true;
    if (this.tankParts) {
      this.tankParts.turretPivot.rotation.y = 0;
      this.tankParts.barrelPivot.rotation.x = 0;
      this.tankParts.barrelPivot.position.z = -1.62;
    }
    this.syncTankCollider();
  }

  private syncTankCollider(): void {
    if (!this.tankCollider) return;
    if (!this.tank.available || this.tank.driving || this.tank.hp <= 0) {
      this.tankCollider.alive = false;
      return;
    }
    this.tankCollider.alive = true;
    const c = Math.abs(Math.cos(this.tank.hullYaw));
    const s = Math.abs(Math.sin(this.tank.hullYaw));
    const hx = 1.85 * c + 3.05 * s;
    const hz = 1.85 * s + 3.05 * c;
    this.tankCollider.minX = this.tank.x - hx;
    this.tankCollider.maxX = this.tank.x + hx;
    this.tankCollider.minZ = this.tank.z - hz;
    this.tankCollider.maxZ = this.tank.z + hz;
  }

  private isTankNearPlayer(): boolean {
    if (!this.tank.available || this.tank.driving || this.tank.hp <= 0) return false;
    return Math.hypot(this.player.x - this.tank.x, this.player.z - this.tank.z) <= 6.2;
  }

  public enterTank(): void {
    if (!this.tank.available || this.tank.driving || this.tank.hp <= 0) return;
    this.tank.driving = true;
    this.tank.gunnerOptic = false;
    this.vatsActive = false;
    this.player.ads = false;
    this.player.reloadTimer = 0;
    this.platingTimer = 0;
    this.viewmodel.pivot.visible = false;
    this.player.yaw = this.tank.turretYaw;
    this.player.pitch = 0;
    this.syncTankCollider();
    this.audio.playMountClick(true);
    this.audio.setTankEnginePresence(true, 0.12);
    this.showCallout(
      'K2-X 흑표 전차 탑승 · [WASD] 주행 · [LMB] 120mm 주포 · [SPACE] 동축 MG · [RMB] 포수 조준경 · [F] 하차',
      '#38d9ff',
      3.8
    );
    this.emitHudSnapshot(true);
  }

  public exitTank(emergency = false): void {
    if (!this.tank.driving) return;
    this.tank.driving = false;
    this.tank.gunnerOptic = false;
    this.tank.speed = 0;
    if (this.gradePass && !this.isAc130Active()) {
      this.gradePass.uniforms.uFlirMode.value = 0.0;
    }
    // Dismount safely to the left flank of the tank hull
    const exitPos = {
      x: this.tank.x - Math.cos(this.tank.hullYaw) * 3.4,
      z: this.tank.z + Math.sin(this.tank.hullYaw) * 3.4,
    };
    resolveXZCollision(exitPos, 0.58, this.colliders, ARENA_HALF_SIZE, 0);
    this.player.x = exitPos.x;
    this.player.z = exitPos.z;
    this.player.y = this.getFloorHeightAt(exitPos.x, exitPos.z, 0) + 1.7;
    this.player.vx = this.player.vy = this.player.vz = 0;
    this.player.onGround = true;
    this.player.invulnTimer = emergency ? 2.0 : 0.45;
    this.viewmodel.pivot.visible = true;
    this.audio.setTankEnginePresence(false, 0);
    this.audio.playMountClick(false);
    this.syncTankCollider();
    if (emergency) {
      this.showAlert('⚠ K2-X 전차 피격 파괴! 비상 탈출 완료 — 도보 전투 전환 ⚠', 3.2);
    } else {
      this.showCallout('K2-X 전차 하차 · 도보 전투 전환', '#cbd5e1', 1.8);
    }
    this.emitHudSnapshot(true);
  }

  private fireTankCannon(): void {
    if (!this.tank.driving || this.tank.cannonCd > 0) return;
    this.tank.cannonCd = this.tank.cannonReloadSec;
    this.tank.recoilOffset = 0.62;
    this.tank.hullPitchKick = 0.068;
    this.shake = Math.max(this.shake, 0.72);
    this.fovKick = Math.min(8, this.fovKick + 4.8);
    this.blastFlashSeq++;
    this.audio.playTankCannon();

    // Compute exact 120mm world muzzle origin & direction
    const muzzleWorld = new THREE.Vector3(this.tank.x, 2.05, this.tank.z);
    if (this.tankParts) {
      this.tankGroup.updateMatrixWorld(true);
      this.tankParts.muzzlePoint.getWorldPosition(muzzleWorld);
    }
    const aimDir = new THREE.Vector3(0, 0, -1);
    const q = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(this.tank.barrelPitch, this.tank.turretYaw, 0, 'YXZ')
    );
    aimDir.applyQuaternion(q).normalize();

    // Massive muzzle blast flash, smoke & flying sparks
    this.muzzleLight.position.copy(muzzleWorld);
    this.muzzleLight.intensity = 18;
    this.vfx.spawnSparkBurst(muzzleWorld, aimDir, 18, 0xffc857, 16);
    this.vfx.spawnExplosion(muzzleWorld.clone().addScaledVector(aimDir, 0.4), 2.4, false);

    // Launch supersonic 120mm APFSDS/HE glowing shell
    const shellMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd166 })
    );
    shellMesh.position.copy(muzzleWorld);
    this.scene.add(shellMesh);
    this.tankShells.push({
      mesh: shellMesh,
      pos: muzzleWorld.clone(),
      vel: aimDir.clone().multiplyScalar(118),
      life: 2.2,
    });
    this.emitHudSnapshot(true);
  }

  private getCombinedHitMeshes(): THREE.Object3D[] {
    return [...this.worldHitMeshes, ...this.enemyHitMeshes];
  }

  private damageBarrel(b: ExplosiveBarrel, dmg: number, srcFaction: number, srcName: string): void {
    if (!b.alive) return;
    b.hp -= dmg;
    this.vfx.spawnSparkBurst(new THREE.Vector3(b.x, 1.0, b.z), new THREE.Vector3(0, 1, 0), 8, 0xffaa33, 8);
    if (b.hp <= 0) {
      b.alive = false;
      b.collider.alive = false;
      this.scene.remove(b.mesh);
      const wi = this.worldHitMeshes.indexOf(b.mesh);
      if (wi !== -1) this.worldHitMeshes.splice(wi, 1);
      this.triggerExplosion(
        new THREE.Vector3(b.x, 0.8, b.z),
        10.5,
        180,
        srcFaction,
        srcName,
        { tag: '드럼통 폭사' }
      );
    }
  }

  private fireTankCoax(): void {
    if (!this.tank.driving || this.tank.coaxCd > 0 || this.tank.coaxOverheated) return;
    this.tank.coaxCd = 0.095;
    this.shake = Math.max(this.shake, 0.07);

    const origin = new THREE.Vector3(
      this.tank.x - Math.sin(this.tank.turretYaw) * 2.1,
      2.05,
      this.tank.z - Math.cos(this.tank.turretYaw) * 2.1
    );
    const aimDir = new THREE.Vector3(0, 0, -1);
    const q = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        this.tank.barrelPitch + (Math.random() - 0.5) * 0.016,
        this.tank.turretYaw + (Math.random() - 0.5) * 0.016,
        0,
        'YXZ'
      )
    );
    aimDir.applyQuaternion(q).normalize();

    this.audio.playWeapon('rifle', 0.55, { isIndoors: false, distanceM: 0 });
    this.raycaster.set(origin, aimDir);
    this.raycaster.far = 90;
    const hits = this.raycaster.intersectObjects(this.getCombinedHitMeshes(), false);
    let endPt = origin.clone().addScaledVector(aimDir, 85);

    if (hits.length > 0) {
      const h = hits[0];
      endPt = h.point.clone();
      const ud = h.object.userData as {
        unit?: ActiveUnit;
        part?: BodyPart;
        barrel?: ExplosiveBarrel;
        isServerCore?: boolean;
      };
      if (ud.unit && ud.unit.alive) {
        this.damageUnit(
          ud.unit,
          36,
          ud.part ?? 'torso',
          endPt,
          aimDir,
          Faction.PLAYER,
          'K2-X 동축 12.7mm',
          'K2-X 12.7mm'
        );
      } else if (ud.barrel && ud.barrel.alive) {
        this.damageBarrel(ud.barrel, 28, Faction.PLAYER, 'K2-X 12.7mm');
      } else if (ud.isServerCore && this.coreShieldDown) {
        this.damageServerCore(22, endPt, Faction.PLAYER);
      } else {
        this.vfx.spawnSparkBurst(endPt, h.face?.normal ?? new THREE.Vector3(0, 1, 0), 5, 0xffbe55, 7);
      }
    }
    this.spawnTracer(origin, endPt, 0xffb347, 0.08, 'bullet');
  }

  private updateTankShells(dt: number): void {
    for (let i = this.tankShells.length - 1; i >= 0; i--) {
      const sh = this.tankShells[i];
      sh.life -= dt;
      sh.vel.y -= 9.5 * dt; // subtle ballistic gravity drop
      const stepDist = sh.vel.length() * dt;
      const dir = sh.vel.clone().normalize();
      this.raycaster.set(sh.pos, dir);
      this.raycaster.far = Math.max(0.8, stepDist + 0.35);
      const hits = this.raycaster.intersectObjects(this.getCombinedHitMeshes(), false);

      let detonated = false;
      let hitPt = sh.pos.clone().addScaledVector(dir, stepDist);
      if (hits.length > 0) {
        hitPt = hits[0].point.clone();
        detonated = true;
      } else if (hitPt.y <= 0.15 || sh.life <= 0) {
        hitPt.y = Math.max(0.15, hitPt.y);
        detonated = true;
      }

      if (detonated) {
        // Massive 120mm HE-MP detonation!
        this.vfx.spawnExplosion(hitPt, 10.5, false);
        this.audio.playExplosion(1.15, hitPt.distanceTo(this.camera.position) < 22, false);
        this.shake = Math.max(this.shake, 0.55);

        // Direct + Splash Damage across 10.5m blast radius
        for (const u of this.units) {
          if (!u.alive) continue;
          const d = Math.hypot(u.x - hitPt.x, u.z - hitPt.z);
          if (d <= 10.8) {
            const falloff = Math.max(0.32, 1 - d / 11.5);
            const dmg = Math.round((d < 2.8 ? 440 : 285) * falloff);
            const imp = new THREE.Vector3(u.x - hitPt.x, 0.7, u.z - hitPt.z).normalize();
            this.damageUnit(
              u,
              dmg,
              u.isBoss ? 'armorFront' : 'torso',
              new THREE.Vector3(u.x, u.y + 1.1, u.z),
              imp,
              Faction.PLAYER,
              'K2-X 120mm 주포',
              '120MM APFSDS'
            );
          }
        }
        // Chain-detonate nearby explosive barrels & damage exposed OMNI-CORE!
        for (const b of this.explosiveBarrels) {
          if (b.alive && Math.hypot(b.x - hitPt.x, b.z - hitPt.z) < 9.5) {
            this.damageBarrel(b, 120, Faction.PLAYER, 'K2-X 120mm');
          }
        }
        const cit = this.worldRefs?.citadel;
        if (cit && this.coreShieldDown && Math.hypot(hitPt.x - cit.x, hitPt.z - cit.z) < 11.5) {
          this.damageServerCore(145, hitPt, Faction.PLAYER);
        }

        this.scene.remove(sh.mesh);
        sh.mesh.geometry.dispose();
        (sh.mesh.material as THREE.Material).dispose();
        this.tankShells.splice(i, 1);
      } else {
        sh.pos.copy(hitPt);
        sh.mesh.position.copy(hitPt);
      }
    }
  }

  private updateTank(dt: number, realDt: number): void {
    this.updateTankShells(dt);
    if (!this.tank.available) return;

    if (this.tank.cannonCd > 0) this.tank.cannonCd = Math.max(0, this.tank.cannonCd - realDt);
    if (this.tank.coaxCd > 0) this.tank.coaxCd = Math.max(0, this.tank.coaxCd - realDt);
    if (this.tank.apsCd > 0) this.tank.apsCd = Math.max(0, this.tank.apsCd - realDt);
    this.tank.recoilOffset *= Math.pow(0.004, realDt);

    const ring = this.tankGroup.getObjectByName('TankBeaconRing');
    if (ring) {
      ring.visible = !this.tank.driving && this.tank.hp > 0;
      const pulse = 1 + Math.sin(this.time * 4.5) * 0.06;
      ring.scale.set(pulse, pulse, 1);
    }

    if (!this.tank.driving) {
      this.syncTankCollider();
      return;
    }

    // Active driving physics (W/S throttle + A/D neutral-steer tracks)
    const fwd =
      (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    const turn =
      (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);

    const next = stepTankDrivePhysics(
      { x: this.tank.x, z: this.tank.z, hullYaw: this.tank.hullYaw, speed: this.tank.speed },
      fwd,
      turn,
      dt,
      this.colliders,
      ARENA_HALF_SIZE
    );
    this.tank.x = next.x;
    this.tank.z = next.z;
    this.tank.hullYaw = next.hullYaw;
    this.tank.speed = next.speed;

    // Sync player coordinates cleanly with tank cockpit
    this.player.x = this.tank.x;
    this.player.z = this.tank.z;
    this.player.y = 2.55;
    this.player.onGround = true;

    // Engine diesel + track clatter sound scaled to throttle/turning
    const throttle01 = Math.min(1, Math.max(Math.abs(this.tank.speed) / 12.6, Math.abs(turn) * 0.55));
    this.audio.setTankEnginePresence(true, throttle01);

    // Armored Roadkill / Ramming enemy infantry & explosive barrels at speed!
    if (Math.abs(this.tank.speed) > 3.2) {
      for (const u of this.units) {
        if (!u.alive || u.isBoss || u.y > 1.2) continue;
        const d = Math.hypot(u.x - this.tank.x, u.z - this.tank.z);
        if (d < 2.85) {
          const pushDir = new THREE.Vector3(u.x - this.tank.x, 0.45, u.z - this.tank.z).normalize();
          this.damageUnit(
            u,
            115,
            'torso',
            new THREE.Vector3(u.x, 1.0, u.z),
            pushDir,
            Faction.PLAYER,
            'K2-X 장갑 돌파',
            'ARMORED RAM'
          );
          this.shake = Math.max(this.shake, 0.25);
        }
      }
      for (const b of this.explosiveBarrels) {
        if (b.alive && Math.hypot(b.x - this.tank.x, b.z - this.tank.z) < 2.7) {
          this.damageBarrel(b, 80, Faction.PLAYER, 'K2-X 돌파');
        }
      }
    }

    // Independent 360° Turret (weighted hydraulic slew inertia) + Suspension Pitch Kick on Fire/Accel!
    this.tank.turretYaw = this.player.yaw;
    const tDiff = Math.atan2(
      Math.sin(this.tank.turretYaw - this.tank.turretVisualYaw),
      Math.cos(this.tank.turretYaw - this.tank.turretVisualYaw)
    );
    this.tank.turretVisualYaw += tDiff * Math.min(1, realDt * 8.5);
    this.tank.barrelPitch = Math.max(-0.09, Math.min(0.36, this.player.pitch));
    this.tank.hullPitchKick *= Math.pow(0.015, realDt);
    const accelPitch = fwd * 0.022 - this.tank.hullPitchKick;
    const turnRoll = turn * 0.024 * Math.min(1, Math.abs(this.tank.speed) / 6 + 0.35);

    this.tankGroup.position.set(this.tank.x, 0, this.tank.z);
    this.tankGroup.rotation.set(accelPitch, this.tank.hullYaw, turnRoll, 'YXZ');

    if (this.tankParts) {
      this.tankParts.turretPivot.rotation.y = this.tank.turretVisualYaw - this.tank.hullYaw;
      this.tankParts.barrelPivot.rotation.x = this.tank.barrelPitch;
      this.tankParts.barrelPivot.position.z = -1.62 + this.tank.recoilOffset;
    }

    // Firing controls: LMB = 120mm Main Gun, SPACE = Coaxial 12.7mm MG, RMB = Thermal Gunner Optic
    if (this.mouseLeft && this.tank.cannonCd <= 0) {
      this.fireTankCannon();
    }
    const firingCoax = this.keys.has('Space');
    const heatStep = stepHeliMinigunHeat(this.tank.coaxHeat, this.tank.coaxOverheated, firingCoax, realDt);
    this.tank.coaxHeat = heatStep.heat;
    this.tank.coaxOverheated = heatStep.overheated;
    if (firingCoax && !this.tank.coaxOverheated) {
      this.fireTankCoax();
    }

    this.tank.gunnerOptic = this.mouseRight;
    if (this.gradePass && !this.isAc130Active()) {
      this.gradePass.uniforms.uFlirMode.value = this.tank.gunnerOptic ? 0.38 : 0.0;
    }

    // Camera Placement: 1st-Person Gunner Optic (RMB) vs Crisp Over-Turret 3rd-Person Chase Cam
    this.shake *= Math.pow(0.001, realDt);
    const shkX = (Math.random() - 0.5) * this.shake * 0.22;
    const shkY = (Math.random() - 0.5) * this.shake * 0.22;
    const forwardX = -Math.sin(this.tank.turretYaw);
    const forwardZ = -Math.cos(this.tank.turretYaw);

    if (this.tank.gunnerOptic) {
      const gx = this.tank.x + forwardX * 1.45;
      const gz = this.tank.z + forwardZ * 1.45;
      this.camera.position.set(gx + shkX * 0.4, 2.38 + shkY * 0.4, gz);
      this.camera.rotation.set(this.tank.barrelPitch, this.tank.turretYaw, 0, 'YXZ');
      this.camera.fov += (34 - this.camera.fov) * Math.min(1, realDt * 18);
    } else {
      // Wall-safe over-turret chase cam so you admire the sculpted K2-X hull, ERA armor & rotating turret!
      const anchor = new THREE.Vector3(this.tank.x, 2.65, this.tank.z);
      const backDir = new THREE.Vector3(-forwardX, 0.28, -forwardZ).normalize();
      this.raycaster.set(anchor, backDir);
      this.raycaster.far = 7.2;
      const wallHits = this.raycaster.intersectObjects(this.worldHitMeshes, false);
      const camDist = wallHits.length > 0 ? Math.max(3.1, wallHits[0].distance - 0.65) : 6.7;
      const desiredPos = anchor.clone().addScaledVector(backDir, camDist);
      this.camera.position.set(desiredPos.x + shkX, Math.max(2.6, desiredPos.y + shkY), desiredPos.z);
      this.camera.rotation.set(this.tank.barrelPitch - 0.09, this.tank.turretYaw, 0, 'YXZ');
      const targetFov = 78 + this.fovKick;
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, realDt * 12);
    }
    this.camera.updateProjectionMatrix();
    this.viewmodel.pivot.visible = false;
  }

  private buildTankHudState(): TankHudState {
    const dist = Math.round(Math.hypot(this.player.x - this.tank.x, this.player.z - this.tank.z));
    const hullDeg = (((-this.tank.hullYaw * 180) / Math.PI) % 360 + 360) % 360;
    const relDeg = (((-(this.tank.turretYaw - this.tank.hullYaw) * 180) / Math.PI) % 360 + 360) % 360;
    return {
      available: this.tank.available && this.tank.hp > 0,
      driving: this.tank.driving,
      nearPrompt: this.isTankNearPlayer(),
      hp: Math.max(0, Math.round(this.tank.hp)),
      maxHp: this.tank.maxHp,
      cannonReloadPct:
        this.tank.cannonCd <= 0
          ? 100
          : Math.max(0, Math.min(100, Math.round((1 - this.tank.cannonCd / this.tank.cannonReloadSec) * 100))),
      coaxHeatPct: Math.round(this.tank.coaxHeat),
      speedKmh: Math.round(Math.abs(this.tank.speed) * 3.6),
      hullHeadingDeg: Math.round(hullDeg),
      turretRelativeDeg: Math.round(relDeg),
      gunnerOptic: this.tank.gunnerOptic,
      apsReady: this.tank.apsCd <= 0,
      distanceM: dist,
    };
  }

  private isHeliRideActive(): boolean {
    return this.gameMode === 'campaign' && this.missionStage === 'm3_heli_insert' && this.heliRide.active;
  }

  private fireHeliMinigun(): void {
    this.heliRide.fireCd = 0.068;
    this.shake = Math.max(this.shake, 0.09);
    if (this.heliRide.soundCd <= 0) {
      this.heliRide.soundCd = 0.24;
      this.audio.playMinigunBurst();
    }

    const origin = this.camera.position.clone().add(new THREE.Vector3(0, -0.22, 0));
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    dir.x += (Math.random() - 0.5) * 0.024;
    dir.y += (Math.random() - 0.5) * 0.024;
    dir.z += (Math.random() - 0.5) * 0.024;
    dir.normalize();

    this.raycaster.set(origin, dir);
    this.raycaster.far = 110;
    const hits = this.raycaster.intersectObjects(this.getCombinedHitMeshes(), false);
    const endPt = hits.length > 0 ? hits[0].point.clone() : origin.clone().addScaledVector(dir, 95);

    this.spawnTracer(origin, endPt, 0xff9e3d, 0.075, 'bullet');
    this.muzzleLight.position.copy(origin);
    this.muzzleLight.intensity = 9.5;

    let hitSomething = false;
    if (hits.length > 0) {
      const ud = hits[0].object.userData as {
        unit?: ActiveUnit;
        part?: BodyPart;
        barrel?: ExplosiveBarrel;
      };
      if (ud.unit && ud.unit.alive) {
        this.damageUnit(
          ud.unit,
          44,
          ud.part ?? 'torso',
          endPt,
          dir,
          Faction.PLAYER,
          'UH-60K M134 미니건',
          'DOOR GUNNER'
        );
        hitSomething = true;
      } else if (ud.barrel && ud.barrel.alive) {
        this.damageBarrel(ud.barrel, 40, Faction.PLAYER, 'UH-60K M134');
        hitSomething = true;
      }
    }

    // Generous 1.85m moving-chopper splash grace so strafing ground troops feels punchy & cinematic!
    if (!hitSomething) {
      for (const u of this.units) {
        if (!u.alive) continue;
        if (Math.hypot(u.x - endPt.x, u.z - endPt.z) < 2.05) {
          this.damageUnit(
            u,
            34,
            'torso',
            new THREE.Vector3(u.x, u.y + 1.0, u.z),
            dir,
            Faction.PLAYER,
            'UH-60K M134 미니건',
            'DOOR GUNNER'
          );
          break;
        }
      }
      this.vfx.spawnSparkBurst(endPt, new THREE.Vector3(0, 1, 0), 5, 0xffb347, 8);
    }
  }

  private updateHeliRide(dt: number, realDt: number): void {
    if (!this.isHeliRideActive()) return;
    this.heliRide.elapsed += realDt;
    const u = Math.min(1, this.heliRide.elapsed / this.heliRide.duration);

    // Sweeping low-altitude S-curve flight path over Neo-Seoul Euljiro Street -> Citadel Perimeter!
    const samplePath = (s: number): THREE.Vector3 => {
      const x = 23 * Math.cos(s * Math.PI * 1.15) + Math.sin(s * Math.PI * 2) * 5.5;
      const y = 12.2 + Math.sin(s * Math.PI) * 3.8 + Math.max(0, s - 0.82) * 24;
      const z = 34 - s * 64;
      return new THREE.Vector3(x, y, z);
    };

    const pos = samplePath(u);
    const ahead = samplePath(Math.min(1, u + 0.018));
    const velDir = ahead.clone().sub(pos);
    const heliYaw = Math.atan2(-velDir.x, -velDir.z);
    const bankRoll = Math.sin(u * Math.PI * 2) * 0.20 + Math.cos(this.time * 2.4) * 0.025;
    const pitchNose = -0.10 + (u > 0.82 ? (u - 0.82) * 1.1 : 0);

    this.heliGroup.visible = true;
    this.heliGroup.position.set(
      pos.x,
      pos.y + Math.sin(this.time * 5.2) * 0.14,
      pos.z
    );
    this.heliGroup.rotation.set(pitchNose, heliYaw, bankRoll, 'YXZ');
    this.heliGroup.updateMatrixWorld(true);

    // Spin 4-blade main rotor & tail rotor at authentic combat RPM
    if (this.heliParts) {
      this.heliParts.mainRotor.rotation.y += realDt * 30;
      this.heliParts.tailRotor.rotation.x += realDt * 44;
    }

    // Seat 1st-person Door-Gunner camera cleanly in left open doorway with wide panoramic view of Neo-Seoul!
    const seatLocal = new THREE.Vector3(-1.26, 1.56, -0.08);
    const seatWorld = seatLocal.applyMatrix4(this.heliGroup.matrixWorld);
    this.player.x = seatWorld.x;
    this.player.y = seatWorld.y;
    this.player.z = seatWorld.z;

    // Default door-gunner view looks out left door (+PI/2 from heli heading) + mouse offset
    const baseGunnerYaw = heliYaw + Math.PI * 0.42;
    this.heliRide.baseCamYaw = baseGunnerYaw;
    const camYaw = baseGunnerYaw + this.heliRide.aimYawOffset;
    const camPitch = this.heliRide.aimPitch;

    this.shake *= Math.pow(0.002, realDt);
    const shkX = (Math.random() - 0.5) * this.shake * 0.16;
    const shkY = (Math.random() - 0.5) * this.shake * 0.16;
    this.camera.position.set(seatWorld.x + shkX, seatWorld.y + shkY, seatWorld.z);
    this.camera.rotation.set(camPitch, camYaw, bankRoll * 0.35, 'YXZ');
    const targetFov = this.mouseRight ? 54 : 78;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, realDt * 12);
    this.camera.updateProjectionMatrix();
    this.viewmodel.pivot.visible = false;

    // Track DoorMinigun aim & spin 6-barrel cluster when firing!
    if (this.heliRide.fireCd > 0) this.heliRide.fireCd -= realDt;
    if (this.heliRide.soundCd > 0) this.heliRide.soundCd -= realDt;

    const firing = this.mouseLeft;
    const heatStep = stepHeliMinigunHeat(this.heliRide.heat, this.heliRide.overheated, firing, realDt);
    this.heliRide.heat = heatStep.heat;
    this.heliRide.overheated = heatStep.overheated;

    if (this.heliParts) {
      this.heliParts.doorMinigun.rotation.y = this.heliRide.aimYawOffset * 0.65;
      this.heliParts.doorMinigun.rotation.z = camPitch * 0.55;
      if (firing && !this.heliRide.overheated) {
        this.heliParts.minigunBarrels.rotation.x += realDt * 48;
      } else {
        this.heliParts.minigunBarrels.rotation.x += realDt * 4;
      }
    }

    if (firing && !this.heliRide.overheated && this.heliRide.fireCd <= 0) {
      this.fireHeliMinigun();
    }

    // Dramatic upward AA tracer streaks from ground hostiles toward our UH-60K!
    this.heliRide.aaCd -= realDt;
    if (this.heliRide.aaCd <= 0 && this.units.length > 0) {
      this.heliRide.aaCd = 0.65 + Math.random() * 0.55;
      const aliveUnits = this.units.filter((x) => x.alive);
      if (aliveUnits.length > 0) {
        const shooter = aliveUnits[Math.floor(Math.random() * aliveUnits.length)];
        const from = new THREE.Vector3(shooter.x, shooter.y + 1.5, shooter.z);
        const nearMiss = seatWorld
          .clone()
          .add(new THREE.Vector3((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 9));
        this.spawnTracer(from, nearMiss, 0xff3b3b, 0.22, 'bullet');
      }
    }

    // Track kills & finish pass smoothly into AC-130 FLIR Gunship!
    const aliveNow = this.units.filter((x) => x.alive).length;
    this.heliRide.killedCount = Math.max(0, this.heliRide.totalTargets - aliveNow);

    if (u >= 0.45 && !this.stageMilestones.has('m3_heli_mid')) {
      this.stageMilestones.add('m3_heli_mid');
      this.pushRadioLine(
        '천사-01 · UH-60K 조종사',
        '강습 항공대',
        'gunship',
        '#38d9ff',
        '을지로 상공 돌파 중! 대공 화망이 거세다—미니건 멈추지 마, 곧 AC-130 고고도 링크 넘긴다!',
        4.4,
        true
      );
    }

    if (u >= 1.0 || aliveNow === 0) {
      this.heliRide.active = false;
      this.heliGroup.visible = false;
      this.audio.setHeliPresence(0.32);
      this.triggerCheckpoint('체크포인트 도달');
      this.pushRadioLine(
        '천사-01 · UH-60K 조종사',
        '강습 항공대',
        'gunship',
        '#2ee6a6',
        '저공 강습 완료! 상공 4,200m AC-130 열화상(FLIR) 화력관제 시스템으로 전환한다!',
        3.6,
        true
      );
      this.stageTransitionDelay = 1.6;
      this.stagePendingNext = { mission: 3, stage: 'm3_ac130_flir' };
    }
  }

  private buildHeliRideHudState(): HeliRideHudState {
    return {
      active: this.isHeliRideActive(),
      progressPct: Math.min(100, Math.round((this.heliRide.elapsed / this.heliRide.duration) * 100)),
      altitudeM: Math.round(this.heliGroup.position.y * 8.5),
      speedKts: 118,
      minigunHeatPct: Math.round(this.heliRide.heat),
      minigunOverheated: this.heliRide.overheated,
      targetsDestroyed: this.heliRide.killedCount,
      targetsTotal: this.heliRide.totalTargets,
    };
  }

  // =========================================================================
  // V5.0 LINEAR 4-MISSION CINEMATIC CAMPAIGN, 1ST-PERSON SETPIECES & AC-130 FLIR
  // =========================================================================
  private isAc130Active(): boolean {
    return this.gameMode === 'campaign' && this.missionStage === 'm3_ac130_flir';
  }

  private isFirstPersonSetpieceActive(): boolean {
    if (this.gameMode !== 'campaign') return false;
    return (
      this.missionStage === 'm1_landing' ||
      this.missionStage === 'm3_heli_insert' ||
      this.missionStage === 'm4_elevator_breach' ||
      this.rescueAnimTimer > 0
    );
  }

  private isBreachDoorInRange(): boolean {
    if (this.gameMode !== 'campaign' || this.missionStage !== 'm2_alley') return false;
    const bd = this.worldRefs?.euljiroBreachDoor;
    if (!bd || bd.breached) return false;
    const aliveHostiles = this.units.filter((u) => u.alive).length;
    if (aliveHostiles > 0) return false;
    return Math.hypot(this.player.x - bd.x, this.player.z - bd.z) <= 5.8;
  }

  private pushRadioLine(
    speaker: string,
    role: string,
    sender: CommsSender,
    accentCss: string,
    text: string,
    duration = 4.2,
    interrupt = false
  ): void {
    this.cinematic.enqueueSubtitles(
      [{ speaker, role, sender, accentCss, text, duration }],
      interrupt
    );
  }

  private triggerCheckpoint(label = '체크포인트 도달'): void {
    this.checkpointSeq++;
    this.checkpointLabel = label;
    this.audio.playCheckpointChime();
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 30);
    this.player.armor = Math.min(this.player.maxArmor, this.player.armor + 35);
    this.armorPlates = Math.min(this.maxArmorPlates, this.armorPlates + 1);
    this.smokeGrenades = Math.min(this.maxSmokeGrenades, this.smokeGrenades + 1);
    this.emitHudSnapshot(true);
  }

  private clearMissionEnemies(): void {
    for (const u of this.units) {
      this.scene.remove(u.rig.root);
    }
    this.units.length = 0;
    this.enemyHitMeshes.length = 0;
    if (this.dropship) {
      this.scene.remove(this.dropship.mesh);
      this.dropship = null;
    }
    this.rebuildHitMeshCache();
  }

  private setSquadmateState(
    id: ActiveSquadmate['id'],
    active: boolean,
    x: number,
    y: number,
    z: number,
    yaw = Math.PI,
    status?: ActiveSquadmate['status']
  ): void {
    const sq = this.squadmates.find((s) => s.id === id);
    if (!sq) return;
    sq.active = active;
    sq.x = x;
    sq.y = y;
    sq.z = z;
    sq.yaw = yaw;
    if (status) sq.status = status;
    sq.rig.root.visible = active;
    sq.rig.root.position.set(x, y, z);
    sq.rig.root.rotation.y = yaw;
    sq.rig.torso.rotation.x = status === 'wounded' ? 0.95 : 0;
  }

  private beginCampaignStage(missionId: CampaignMissionId, stage: CampaignStageId): void {
    this.missionId = missionId;
    this.missionStage = stage;
    this.stageTimer = 0;
    this.stageTransitionDelay = 0;
    this.stagePendingNext = null;
    this.stageMilestones.clear();
    this.campaignPrompt = null;
    this.breachSlowmoTimer = 0;
    this.crisisTimer = 0;
    this.rescueAnimTimer = 0;
    this.vatsActive = false;

    // Restore normal color grading whenever exiting Mission 03 FLIR
    if (this.gradePass && stage !== 'm3_ac130_flir') {
      this.gradePass.uniforms.uFlirMode.value = 0.0;
    }

    const prof = getMissionProfile(missionId);

    if (stage === 'm1_landing') {
      this.clearMissionEnemies();
      this.player.x = 0;
      this.player.y = 2.8;
      this.player.z = 52;
      this.player.yaw = 0;
      this.player.pitch = -0.04;
      this.player.vx = this.player.vy = this.player.vz = 0;
      if (this.worldRefs) {
        this.worldRefs.lcacHovercraft.group.position.set(0, 0, 53.5);
        this.worldRefs.lcacHovercraft.rampPivot.rotation.x = 0; // Closed armored bow ramp during approach
        this.worldRefs.towerElevator.group.visible = false;
      }
      // Pure Solo Tier-1 Operator — no follower AI bots cluttering the player!
      this.setSquadmateState('sergeant', false, -1.85, 1.2, 50.2, Math.PI, 'active');
      this.setSquadmateState('corporal', false, 1.85, 1.2, 50.5, Math.PI, 'active');
      this.setSquadmateState('ghost9', false, 16, 0, 4.5);
      this.setSquadmateState('survivor', false, 17, 0, 5.2);
      this.cinematic.showChapterCard(
        `${prof.numberLabel} // ${prof.code}`,
        prof.title,
        prof.location,
        prof.accentCss,
        4.6
      );
      this.audio.playJetFlyby(0.86);
    } else if (stage === 'm1_beachhead') {
      this.clearMissionEnemies();
      this.player.x = 0;
      this.player.y = 1.7;
      this.player.z = 32;
      this.player.yaw = 0;
      this.player.pitch = 0;
      this.player.equipTimer = 0.35;
      if (this.worldRefs) {
        this.worldRefs.lcacHovercraft.group.position.set(0, 0, 41.5);
        this.worldRefs.lcacHovercraft.rampPivot.rotation.x = -Math.PI * 0.44;
      }
      this.setSquadmateState('sergeant', false, -3.2, 0, 27.5, Math.PI, 'active');
      this.setSquadmateState('corporal', false, 3.4, 0, 28.0, Math.PI, 'active');
      this.setSquadmateState('ghost9', false, 16, 0, 4.5);
      this.setSquadmateState('survivor', false, 17, 0, 5.2);

      // Scripted 6-enemy beachhead ambush across burning K-808 & sandbags (zero wave grind!)
      this.createEnemy(Faction.RAIDER, UnitArchetype.RAIDER_TROOPER, -7.2, 16.5);
      this.createEnemy(Faction.RAIDER, UnitArchetype.RAIDER_TROOPER, 6.8, 16.0);
      this.createEnemy(Faction.SYNDICATE, UnitArchetype.SYNDICATE_COMMANDO, -4.5, 11.5);
      this.createEnemy(Faction.SYNDICATE, UnitArchetype.SYNDICATE_COMMANDO, 5.2, 12.2);
      this.createEnemy(Faction.ROBOT, UnitArchetype.ROBOT_STALKER, -9.0, 7.5);
      this.createEnemy(Faction.ROBOT, UnitArchetype.ROBOT_ENFORCER, 2.0, 6.5);
      this.stageTotalHostiles = 6;
      this.pushRadioLine(
        '발키리-01 · 강서연 대위',
        '궤도 작전 지휘',
        'valkyrie',
        '#2ee6a6',
        '상륙 완료 확인! 모래주머니 진지를 엄폐로 삼아 전방 해안 매복조 6기를 단독 소탕하라!',
        4.6,
        true
      );
    } else if (stage === 'm2_alley') {
      this.clearMissionEnemies();
      this.player.x = 0;
      this.player.y = 1.7;
      this.player.z = 21.5;
      this.player.yaw = 0;
      this.player.pitch = 0;
      this.player.ammo[this.player.wpnIdx] = this.getEffectiveMag(this.player.wpnIdx);
      if (this.worldRefs) {
        const bd = this.worldRefs.euljiroBreachDoor;
        bd.breached = false;
        bd.leftLeaf.position.set(0, 1.44, -0.76);
        bd.leftLeaf.rotation.set(0, 0, 0);
        bd.rightLeaf.position.set(0, 1.44, 0.76);
        bd.rightLeaf.rotation.set(0, 0, 0);
        bd.c4Pack.visible = false;
        bd.breachLight.intensity = 0;
      }
      this.setSquadmateState('sergeant', false, -2.6, 0, 19.2, Math.PI, 'active');
      this.setSquadmateState('corporal', false, 2.8, 0, 19.6, Math.PI, 'active');
      this.setSquadmateState('ghost9', false, 18.2, 0, 3.6);
      this.setSquadmateState('survivor', false, 18.5, 0, 5.6);

      // Scripted Euljiro urban ambush + iconic 2F Optical Shop ("편안한 안경") balcony sniper!
      this.createEnemy(Faction.SYNDICATE, UnitArchetype.SYNDICATE_SNIPER, -17.5, 16.5, 3.2);
      this.createEnemy(Faction.SYNDICATE, UnitArchetype.SYNDICATE_COMMANDO, -6.5, 6.5, 0);
      this.createEnemy(Faction.SYNDICATE, UnitArchetype.SYNDICATE_COMMANDO, 6.2, 5.8, 0);
      this.createEnemy(Faction.RAIDER, UnitArchetype.RAIDER_BERSERKER, -2.4, -5.8, 0);
      this.createEnemy(Faction.SYNDICATE, UnitArchetype.SYNDICATE_HEAVY, 5.4, -1.8, 0);
      this.createEnemy(Faction.ROBOT, UnitArchetype.ROBOT_ENFORCER, -4.2, -4.5, 0);
      this.stageTotalHostiles = 6;

      this.cinematic.showChapterCard(
        `${prof.numberLabel} // ${prof.code}`,
        prof.title,
        prof.location,
        prof.accentCss,
        4.6
      );
      this.pushRadioLine(
        '발키리-01 · 강서연 대위',
        '궤도 작전 지휘',
        'valkyrie',
        '#f5b342',
        '2층 안경점 간판 위 레이저 저격수 포착! 골목 적을 정리하고 동쪽 지휘소 방폭문으로 접근하라.',
        5.2,
        true
      );
    } else if (stage === 'm2_breach_slowmo') {
      // 1st-Person Uncut 0.2x Slow-Mo C4 Door Breach & Clear!
      this.clearMissionEnemies();
      const bd = this.worldRefs?.euljiroBreachDoor;
      if (bd) {
        bd.breached = true;
        bd.doorCollider.alive = false;
        const li = this.worldHitMeshes.indexOf(bd.leftLeaf);
        if (li !== -1) this.worldHitMeshes.splice(li, 1);
        const ri = this.worldHitMeshes.indexOf(bd.rightLeaf);
        if (ri !== -1) this.worldHitMeshes.splice(ri, 1);
        bd.c4Pack.visible = false;
        bd.breachLight.intensity = 18.0;
        this.vfx.spawnExplosion(new THREE.Vector3(bd.x - 0.3, 1.5, bd.z), 6.2, false);
        this.audio.playBreachBlast();
        this.shake = 0.85;
        this.blastFlashSeq++;
      }
      // Position player at the doorway facing right into the command room in uncut 1st-person
      this.player.x = 10.6;
      this.player.y = 1.7;
      this.player.z = 4.5;
      this.player.yaw = -Math.PI / 2;
      this.player.pitch = -0.02;
      this.player.ammo[this.player.wpnIdx] = this.getEffectiveMag(this.player.wpnIdx);
      this.breachSlowmoTimer = 4.8;

      this.setSquadmateState('sergeant', false, 11.4, 0, 2.7, Math.PI / 2, 'active');
      this.setSquadmateState('corporal', false, 11.4, 0, 6.4, Math.PI / 2, 'active');
      this.setSquadmateState('survivor', true, 19.2, 0, 5.8, -Math.PI / 2, 'wounded');

      // 4 stunned hostiles inside command post ready to be picked off in 0.2x slow-mo!
      const c1 = this.createEnemy(Faction.SYNDICATE, UnitArchetype.SYNDICATE_COMMANDO, 15.2, 3.2);
      const c2 = this.createEnemy(Faction.SYNDICATE, UnitArchetype.SYNDICATE_COMMANDO, 15.8, 5.8);
      const c3 = this.createEnemy(Faction.ROBOT, UnitArchetype.ROBOT_ENFORCER, 17.6, 2.8);
      const c4 = this.createEnemy(Faction.SYNDICATE, UnitArchetype.SYNDICATE_HEAVY, 18.0, 4.7);
      for (const u of [c1, c2, c3, c4]) {
        u.staggerTimer = 1.35;
        u.hp = Math.round(u.hp * 0.72);
      }
      this.stageTotalHostiles = 4;
      this.pushRadioLine(
        '발키리-01 · 강서연 대위',
        '궤도 작전 지휘',
        'valkyrie',
        '#38d9ff',
        'C4 브리칭 성공! 슬로모션 중 실내 무장 적 전원 제압—안쪽 생존자 오사 주의!',
        3.6,
        true
      );
    } else if (stage === 'm2_survivor_ghost') {
      this.setSquadmateState('ghost9', true, 17.5, 0, 3.2, -Math.PI / 2, 'ghost');
      this.setSquadmateState('survivor', true, 18.8, 0, 5.6, -Math.PI / 2, 'wounded');
      this.campaignPrompt = {
        id: 'm2_ghost_survivor',
        title: '고스트-9 & 부상 생존자 대면',
        subtitle: '탈영 신스 고스트-9가 무기 내려놓고 동맹을 제안한다. 당신의 판단은?',
        optionFLabel: '[F] 생존자 긴급 후송 엄호 · 고스트-9 협력 수락 (신뢰 +2)',
        optionGLabel: '[G] 임무 우선 강행 · 고스트-9 보안 코드만 강제 탈취',
        remainingSec: null,
      };
      this.pushRadioLine(
        '고스트-9',
        '탈영 신스 해커',
        'ghost9',
        '#2dd4bf',
        '쏴도 된다, 인간. 하지만 저 생존자를 빼내고 OMNI-CORE 방화벽을 뚫으려면 내 백도어가 필요할 거다.',
        5.5,
        true
      );
    } else if (stage === 'm3_heli_insert') {
      // V7.0 Playable 1st-Person UH-60K Assault Helicopter Door-Gunner Insertion Ride!
      this.clearMissionEnemies();
      this.exitTank(false);
      this.tank.available = false;
      this.tankGroup.visible = false;
      this.setSquadmateState('sergeant', false, 0, 0, 22);
      this.setSquadmateState('corporal', false, 0, 0, 22);
      this.setSquadmateState('ghost9', false, 16, 0, 4.5);
      this.setSquadmateState('survivor', false, 17, 0, 5.2);

      this.heliRide.active = true;
      this.heliRide.elapsed = 0;
      this.heliRide.duration = 19.0;
      this.heliRide.aimYawOffset = 0;
      this.heliRide.aimPitch = -0.32;
      this.heliRide.heat = 0;
      this.heliRide.overheated = false;
      this.heliRide.fireCd = 0;
      this.heliRide.soundCd = 0;
      this.heliRide.aaCd = 1.2;
      this.heliRide.killedCount = 0;
      this.heliRide.totalTargets = 10;
      this.stageTotalHostiles = 10;
      this.player.ads = false;
      this.vatsActive = false;
      this.viewmodel.pivot.visible = false;

      // Spawn 10 ground ambush & anti-air targets along Euljiro avenue & 2F overlooks!
      const heliTargets: Array<[Faction, UnitArchetype, number, number, number]> = [
        [Faction.RAIDER, UnitArchetype.RAIDER_TROOPER, -5.5, 22.0, 0],
        [Faction.SYNDICATE, UnitArchetype.SYNDICATE_COMMANDO, 4.5, 18.0, 0],
        [Faction.SYNDICATE, UnitArchetype.SYNDICATE_HEAVY, -2.5, 11.5, 0],
        [Faction.ROBOT, UnitArchetype.ROBOT_ENFORCER, 6.2, 8.5, 0],
        [Faction.SYNDICATE, UnitArchetype.SYNDICATE_SNIPER, -17.5, 16.5, 3.2],
        [Faction.RAIDER, UnitArchetype.RAIDER_TROOPER, -6.8, -1.5, 0],
        [Faction.ROBOT, UnitArchetype.ROBOT_ENFORCER, 5.5, -5.5, 0],
        [Faction.SYNDICATE, UnitArchetype.SYNDICATE_HEAVY, 0.5, -11.5, 0],
        [Faction.ROBOT, UnitArchetype.ROBOT_STALKER, -8.5, -16.5, 0],
        [Faction.ROBOT, UnitArchetype.ROBOT_ENFORCER, 7.5, -19.5, 0],
      ];
      for (const [fac, arch, tx, tz, ty] of heliTargets) {
        this.createEnemy(fac, arch, tx, tz, ty);
      }

      this.audio.setHeliPresence(0.96);
      this.audio.playJetFlyby(0.75);
      this.cinematic.showChapterCard(
        `${prof.numberLabel} // ${prof.code}`,
        'UH-60K 무장 헬기 강습',
        '측문 M134 회전 미니건 탑승 · [좌클릭] 소사 · [우클릭] 정밀 조준',
        '#38d9ff',
        4.6
      );
      this.pushRadioLine(
        '천사-01 · UH-60K 조종사',
        '강습 항공대',
        'gunship',
        '#38d9ff',
        'UH-60K 저공 진입! 측문 M134 미니건 안전장치 해제했다—아래 도로와 옥상 적 대공조 전부 쓸어버려!',
        5.0,
        true
      );
    } else if (stage === 'm3_ac130_flir') {
      this.clearMissionEnemies();
      this.heliRide.active = false;
      this.heliGroup.visible = false;
      this.ac130OrbitAngle = 0.68;
      this.ac130TargetX = 0;
      this.ac130TargetZ = 4;
      this.ac130WeaponIdx = 1; // 40mm Bofors default (switchable 1=25mm, 2=40mm, 3=105mm)
      this.ac130FireCd = 0;
      this.ac130Zoomed = false;
      this.ac130WaveIdx = 0;
      this.ac130KilledCount = 0;
      this.stageTotalHostiles = 14;
      this.player.ads = false;
      this.vatsActive = false;

      this.setSquadmateState('sergeant', false, -2.2, 0, 22, Math.PI, 'active');
      this.setSquadmateState('corporal', false, 2.4, 0, 23, Math.PI, 'active');
      this.setSquadmateState('ghost9', false, 16, 0, 4.5);
      this.setSquadmateState('survivor', false, 17, 0, 5.2);

      // Wave 1 of 3 thermal ambush groups
      this.spawnAc130HostileWave(1);
      this.cinematic.showChapterCard(
        `${prof.numberLabel} // AC-130 FLIR`,
        'AC-130 열화상(FLIR) 화력 지원',
        '상공 열화상(FLIR) 모드 · [1]25mm [2]40mm [3]105mm · [T] 흑백 반전',
        prof.accentCss,
        4.6
      );
      this.audio.playJetFlyby(0.72);
      this.pushRadioLine(
        '천사-01 · AC-130 건쉽',
        '궤도 화력관제사',
        'gunship',
        '#e2e8f0',
        '열화상(FLIR) 전환 완료. 시타델 진입로 적 기갑 증원파가 몰려온다—25mm·40mm·105mm 함포로 전부 초토화하라!',
        5.2,
        true
      );
    } else if (stage === 'm4_tank_assault') {
      // V7.0 Playable ROK K2-X Black Panther Main Battle Tank Assault into OMNI-CORE Citadel!
      this.clearMissionEnemies();
      this.heliRide.active = false;
      this.heliGroup.visible = false;
      this.audio.setHeliPresence(0);
      this.coreShieldDown = true;
      this.coreHp = 480;
      this.coreMaxHp = 480;
      if (this.worldRefs) {
        this.worldRefs.towerElevator.group.visible = false;
        const cit = this.worldRefs.citadel;
        cit.shieldDome.visible = false;
        cit.coreWeakpoint.visible = true;
        cit.coreWeakpoint.scale.setScalar(1.42);
        (cit.coreWeakpoint.material as THREE.MeshBasicMaterial).color.setHex(0xff8c1a);
        (cit.terminalGlow.material as THREE.MeshBasicMaterial).color.setHex(0x38e8ff);
        cit.terminalLight.color.setHex(0xff8c1a);
        cit.terminalLight.intensity = 7.8;
      }

      // Place player right behind the freshly deployed K2-X Black Panther Tank (within [F] board range!)
      this.player.x = 0;
      this.player.y = 1.7;
      this.player.z = 19.8;
      this.player.yaw = 0;
      this.player.pitch = -0.05;
      this.player.ammo[this.player.wpnIdx] = this.getEffectiveMag(this.player.wpnIdx);
      this.setSquadmateState('sergeant', false, 0, 0, -20);
      this.setSquadmateState('corporal', false, 0, 0, -20);
      this.setSquadmateState('ghost9', false, 16, 0, 4.5);
      this.setSquadmateState('survivor', false, 17, 0, 5.2);

      // Deploy full-armor drivable K2-X Black Panther Tank right on Neo-Seoul Main Avenue!
      this.deployTankAt(0, 14.2, 0);

      // Armored Fortress Defense + OMNI-TITAN Overlord (1,350 HP Boss!) awaiting 120mm tank combat!
      const boss = this.createEnemy(Faction.ROBOT, UnitArchetype.ROBOT_TITAN, 0, -25.5);
      boss.hp = 1350;
      boss.maxHp = 1350;
      this.createEnemy(Faction.SYNDICATE, UnitArchetype.SYNDICATE_HEAVY, -6.8, -4.5);
      this.createEnemy(Faction.SYNDICATE, UnitArchetype.SYNDICATE_HEAVY, 6.8, -4.5);
      this.createEnemy(Faction.ROBOT, UnitArchetype.ROBOT_ENFORCER, -8.2, -16.0);
      this.createEnemy(Faction.ROBOT, UnitArchetype.ROBOT_ENFORCER, 8.2, -16.0);
      this.createEnemy(Faction.ROBOT, UnitArchetype.ROBOT_STALKER, -4.5, -21.0);
      this.createEnemy(Faction.ROBOT, UnitArchetype.ROBOT_STALKER, 4.5, -21.0);
      this.stageTotalHostiles = 7;

      this.audio.playShieldBreachDrop();
      this.cinematic.showChapterCard(
        `${prof.numberLabel} // ${prof.code}`,
        prof.title,
        '전방 K2-X 흑표 전차 배치 완료 · [F] 탑승 · [WASD] 주행 · [LMB] 120mm 주포',
        prof.accentCss,
        5.0
      );
      this.pushRadioLine(
        '발키리-01 · 강서연 대위',
        '궤도 작전 지휘',
        'valkyrie',
        '#ff6242',
        '전방에 K2-X 흑표 주력전차 투하 완료! [F]로 탑승해서 120mm 주포로 시타델 방어선과 OMNI-TITAN을 분쇄하라!',
        5.6,
        true
      );
    } else if (stage === 'm4_elevator_breach') {
      this.clearMissionEnemies();
      this.player.x = 0;
      this.player.y = 1.85;
      this.player.z = -19.2;
      this.player.yaw = 0;
      this.player.pitch = 0.04;
      this.player.vx = this.player.vy = this.player.vz = 0;
      this.player.ammo[this.player.wpnIdx] = WEAPONS[this.player.wpnIdx].mag;
      if (this.worldRefs) {
        const el = this.worldRefs.towerElevator;
        el.group.visible = true;
        el.group.position.set(0, 0, -19.5);
        el.leftDoor.position.set(-1.08, 1.6, -1.92);
        el.rightDoor.position.set(1.08, 1.6, -1.92);
      }
      this.setSquadmateState('sergeant', true, -1.15, 0.25, -20.2, Math.PI, 'active');
      this.setSquadmateState('corporal', true, 1.25, 0.25, -20.0, Math.PI, 'active');
      this.cinematic.showChapterCard(
        `${prof.numberLabel} // ${prof.code}`,
        prof.title,
        prof.location,
        prof.accentCss,
        4.8
      );
      this.pushRadioLine(
        '소재우 중사',
        '알파 분대장',
        'squad',
        '#ff6242',
        '외벽 강습 엘리베이터 가동! 최상층 방폭문 열리자마자 화력 전부 쏟아부어!',
        4.6,
        true
      );
    } else if (stage === 'm4_tower_assault') {
      this.clearMissionEnemies();
      this.coreShieldDown = true;
      this.coreHp = 420;
      this.coreMaxHp = 420;
      if (this.worldRefs) {
        this.worldRefs.towerElevator.group.visible = false;
        const cit = this.worldRefs.citadel;
        cit.shieldDome.visible = false;
        cit.coreWeakpoint.visible = true;
        cit.coreWeakpoint.scale.setScalar(1.42);
        (cit.coreWeakpoint.material as THREE.MeshBasicMaterial).color.setHex(0xff8c1a);
        (cit.terminalGlow.material as THREE.MeshBasicMaterial).color.setHex(0x38e8ff);
        cit.terminalLight.color.setHex(0xff8c1a);
        cit.terminalLight.intensity = 7.8;
      }
      this.player.x = 0;
      this.player.y = 1.7;
      this.player.z = -17.5;
      this.player.yaw = 0;
      this.player.pitch = 0;
      this.setSquadmateState('sergeant', true, -3.5, 0, -19.0, Math.PI, 'active');
      this.setSquadmateState('corporal', true, 3.6, 0, -19.2, Math.PI, 'active');

      // Final Citadel Assault: OMNI-TITAN Overlord (1350 HP Boss w/ 2 Phases + Destructible Armor Plates) + 4 elite sentinels!
      const boss = this.createEnemy(Faction.ROBOT, UnitArchetype.ROBOT_TITAN, 0, -28.5);
      boss.hp = 1350;
      boss.maxHp = 1350;
      this.createEnemy(Faction.ROBOT, UnitArchetype.ROBOT_ENFORCER, -7.5, -26.0);
      this.createEnemy(Faction.ROBOT, UnitArchetype.ROBOT_ENFORCER, 7.5, -26.0);
      this.createEnemy(Faction.ROBOT, UnitArchetype.ROBOT_STALKER, -5.0, -23.0);
      this.createEnemy(Faction.ROBOT, UnitArchetype.ROBOT_STALKER, 5.0, -23.0);
      this.stageTotalHostiles = 5;
      this.audio.playShieldBreachDrop();
      this.pushRadioLine(
        '박현준 하사',
        '알파 분대',
        'squad',
        '#ff4422',
        '전방 OMNI-TITAN 오버로드 확인! 저 괴물만 쓰러뜨리면 코어에 닿는다!',
        4.8,
        true
      );
    } else if (stage === 'm4_sacrifice_crisis') {
      // Dramatic Squadmate Sacrifice Crisis!
      this.crisisTimer = 12.0;
      this.setSquadmateState('sergeant', true, -3.8, 0, -23.2, 0.4, 'wounded');
      this.vfx.spawnExplosion(new THREE.Vector3(-3.8, 1.2, -23.2), 7.5, false);
      this.audio.playExplosion(0.95, true, false);
      this.shake = 0.85;
      this.campaignPrompt = {
        id: 'm4_squad_sacrifice',
        title: '긴급 위기 // 소재우 중사 잔해 매몰',
        subtitle: '시타델 붕괴 파편에 깔린 소재우 중사를 구출할 것인가, 코어로 단독 돌진할 것인가?',
        optionFLabel: '[F] 소재우 중사 구출 (방폭 파편 제거)',
        optionGLabel: '[G] 코어로 단독 돌진 (즉각 임무 완수)',
        remainingSec: 12,
      };
      this.pushRadioLine(
        '박현준 하사',
        '알파 분대 · 긴급',
        'squad',
        '#ff4422',
        '중사님이 붕괴 철골에 깔렸어! 어떡할 거야—구하러 갈 건가, 코어로 밀고 들어갈 건가?!',
        5.5,
        true
      );
    } else if (stage === 'm4_final_core') {
      this.campaignPrompt = null;
      this.coreShieldDown = true;
      this.pushRadioLine(
        '발키리-01 · 강서연 대위',
        'UNS 아크라이트',
        'valkyrie',
        '#38d9ff',
        '중앙 코어 단말기가 열렸어! [F]로 접속해서 지금 이 전쟁을 끝내!',
        5.0,
        true
      );
    }

    this.emitHudSnapshot(true);
  }

  private spawnAc130HostileWave(waveNum: 1 | 2 | 3): void {
    this.ac130WaveIdx = waveNum;
    if (waveNum === 1) {
      this.createEnemy(Faction.RAIDER, UnitArchetype.RAIDER_TROOPER, -7.5, 4.5);
      this.createEnemy(Faction.RAIDER, UnitArchetype.RAIDER_TROOPER, 7.2, 3.8);
      this.createEnemy(Faction.SYNDICATE, UnitArchetype.SYNDICATE_COMMANDO, -3.5, -2.5);
      this.createEnemy(Faction.SYNDICATE, UnitArchetype.SYNDICATE_COMMANDO, 4.2, -3.0);
    } else if (waveNum === 2) {
      this.createEnemy(Faction.SYNDICATE, UnitArchetype.SYNDICATE_HEAVY, -8.5, -6.5);
      this.createEnemy(Faction.SYNDICATE, UnitArchetype.SYNDICATE_HEAVY, 8.2, -7.2);
      this.createEnemy(Faction.ROBOT, UnitArchetype.ROBOT_ENFORCER, 0, -10.5);
      this.createEnemy(Faction.ROBOT, UnitArchetype.ROBOT_STALKER, -5.2, -11.5);
      this.createEnemy(Faction.ROBOT, UnitArchetype.ROBOT_STALKER, 5.6, -12.0);
      this.pushRadioLine(
        '소재우 중사',
        '지상 알파 분대',
        'squad',
        '#2ee6a6',
        '천사-01, 적 기갑 증원 북쪽 도로로 밀려온다! 105밀리로 쓸어버려!',
        4.2,
        true
      );
    } else {
      this.createEnemy(Faction.ROBOT, UnitArchetype.ROBOT_ENFORCER, -9.5, -14.5);
      this.createEnemy(Faction.ROBOT, UnitArchetype.ROBOT_ENFORCER, 9.5, -14.5);
      this.createEnemy(Faction.SYNDICATE, UnitArchetype.SYNDICATE_HEAVY, -4.0, -18.5);
      this.createEnemy(Faction.SYNDICATE, UnitArchetype.SYNDICATE_HEAVY, 4.0, -18.5);
      this.createEnemy(Faction.ROBOT, UnitArchetype.ROBOT_STALKER, 0, -21.0);
      this.pushRadioLine(
        '천사-01 · AC-130 건쉽',
        '궤도 화력관제사',
        'gunship',
        '#fbbf24',
        '타워 입구 마지막 적 방어선 포착! 전탄 화력 지원 개시!',
        4.2,
        true
      );
    }
  }

  public resolveCampaignPromptChoice(option: 'F' | 'G'): void {
    if (this.gameMode !== 'campaign' || !this.campaignPrompt) return;

    if (this.campaignPrompt.id === 'm2_ghost_survivor') {
      this.campaignPrompt = null;
      if (option === 'F') {
        this.campaignChoices.survivorRescued = true;
        this.campaignChoices.ghostTrust += 2;
        this.pushCombatMedal('ALLIANCE FORGED', '생존자 구출 · 고스트-9 신뢰 구축', '#2dd4bf', true);
        this.pushRadioLine(
          '고스트-9',
          '동맹 신스',
          'ghost9',
          '#2dd4bf',
          '현명한 판단이다. 생존자 후송 경로는 내가 확보했다. 이제 상공 AC-130 링크를 열어주지.',
          4.8,
          true
        );
      } else {
        this.campaignChoices.survivorRescued = false;
        this.campaignChoices.ghostTrust -= 1;
        this.pushRadioLine(
          '고스트-9',
          '탈영 신스',
          'ghost9',
          '#f5b342',
          '결국 너희 인간도 똑같군... 암호 키는 가져가라. 대신 코어 앞에서 후회하게 될 거다.',
          4.8,
          true
        );
      }
      this.triggerCheckpoint('체크포인트 도달');
      this.stageTransitionDelay = 2.1;
      this.stagePendingNext = { mission: 3, stage: 'm3_heli_insert' };
      this.emitHudSnapshot(true);
      return;
    }

    if (this.campaignPrompt.id === 'm4_squad_sacrifice') {
      this.campaignPrompt = null;
      this.crisisTimer = 0;
      if (option === 'F') {
        this.campaignChoices.squadmateSaved = true;
        this.rescueAnimTimer = 1.9;
        this.player.x = -3.0;
        this.player.z = -22.2;
        this.player.yaw = 0.72;
        this.player.pitch = -0.35;
        this.audio.playMountClick(true);
        this.pushCombatMedal('NO ONE LEFT BEHIND', '소재우 중사 구출 완료', '#2ee6a6', true);
        this.pushRadioLine(
          '소재우 중사',
          '알파 분대장',
          'squad',
          '#2ee6a6',
          '고맙다, 이안... 끝까지 함께 간다! 지금 중앙 코어 단말기로 밀고 들어가!',
          4.8,
          true
        );
      } else {
        this.campaignChoices.squadmateSaved = false;
        this.pushRadioLine(
          '소재우 중사',
          '알파 분대장',
          'squad',
          '#ff6242',
          '크윽... 알았다... 뒤돌아보지 말고 중앙 코어만 끝내...!',
          4.5,
          true
        );
        this.beginCampaignStage(4, 'm4_final_core');
      }
      this.emitHudSnapshot(true);
    }
  }

  private fireAc130Cannon(): void {
    if (!this.isAc130Active() || this.ac130FireCd > 0) return;
    const spec = AC130_WEAPONS[this.ac130WeaponIdx];
    this.ac130FireCd = spec.cooldown;
    this.shake = Math.max(this.shake, spec.shake);
    this.audio.playAc130Cannon(spec.reticleKind);

    const startPos = this.camera.position.clone().add(new THREE.Vector3(0, -1.6, 0));
    const spread = spec.reticleKind === '25mm' ? 1.55 : spec.reticleKind === '40mm' ? 0.85 : 0.4;
    const tgt = new THREE.Vector3(
      this.ac130TargetX + (Math.random() - 0.5) * spread,
      0.35,
      this.ac130TargetZ + (Math.random() - 0.5) * spread
    );

    const sz = spec.reticleKind === '105mm' ? 0.42 : spec.reticleKind === '40mm' ? 0.28 : 0.16;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(sz, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    mesh.position.copy(startPos);
    this.scene.add(mesh);

    this.ac130Shells.push({
      pos: startPos,
      target: tgt,
      timeLeft: spec.flightSec,
      maxTime: spec.flightSec,
      radius: spec.blastRadius,
      dmg: spec.damage,
      caliber: spec.reticleKind,
      mesh,
    });
  }

  private updateAc130Gunship(dt: number, realDt: number): void {
    // Smooth high-altitude gunship circular orbit above Neo-Seoul Sector Zero
    this.ac130OrbitAngle += realDt * 0.135;
    const orbitR = 46;
    const camX = Math.cos(this.ac130OrbitAngle) * orbitR;
    const camZ = Math.sin(this.ac130OrbitAngle) * orbitR;
    const camY = 43.5 + Math.sin(this.ac130OrbitAngle * 2.1) * 1.2;

    // Keyboard WASD pan fallback on ground plane relative to camera right/forward
    const panFwd =
      (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    const panRight =
      (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    if (panFwd !== 0 || panRight !== 0) {
      const toCenter = this._v1.set(this.ac130TargetX - camX, 0, this.ac130TargetZ - camZ).normalize();
      const rightV = this._v2.set(-toCenter.z, 0, toCenter.x);
      const panSpd = this.ac130Zoomed ? 16 : 28;
      this.ac130TargetX = Math.max(
        -44,
        Math.min(44, this.ac130TargetX + (toCenter.x * panFwd + rightV.x * panRight) * panSpd * realDt)
      );
      this.ac130TargetZ = Math.max(
        -44,
        Math.min(44, this.ac130TargetZ + (toCenter.z * panFwd + rightV.z * panRight) * panSpd * realDt)
      );
    }

    this.ac130Zoomed = this.mouseRight;
    this.ac130FireCd = Math.max(0, this.ac130FireCd - realDt);
    if (this.mouseLeft && this.ac130FireCd <= 0) {
      this.fireAc130Cannon();
    }

    this.shake *= Math.pow(0.001, realDt);
    const shkX = (Math.random() - 0.5) * this.shake * 0.65;
    const shkY = (Math.random() - 0.5) * this.shake * 0.65;

    this.camera.position.set(camX + shkX, camY + shkY, camZ);
    this.camera.lookAt(this.ac130TargetX, 1.0, this.ac130TargetZ);
    const targetFov = this.ac130Zoomed ? 21 : 44;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, realDt * 12);
    this.camera.updateProjectionMatrix();

    this.viewmodel.pivot.visible = false;
    this.laserBeam.visible = false;
    this.laserDot.visible = false;

    // Make all alive hostiles glow white-hot in FLIR thermal view!
    for (const u of this.units) {
      if (!u.alive) continue;
      for (const m of u.rig.mats) {
        m.emissive.setHex(0xe5e5e5);
      }
    }

    // Update descending 25mm / 40mm / 105mm gunship projectiles
    for (let i = this.ac130Shells.length - 1; i >= 0; i--) {
      const sh = this.ac130Shells[i];
      sh.timeLeft -= dt;
      const p = 1 - Math.max(0, sh.timeLeft) / Math.max(0.01, sh.maxTime);
      sh.mesh.position.lerpVectors(sh.pos, sh.target, p);
      if (sh.timeLeft <= 0) {
        this.scene.remove(sh.mesh);
        sh.mesh.geometry.dispose();
        (sh.mesh.material as THREE.Material).dispose();
        this.ac130Shells.splice(i, 1);

        // Friendly fire warning if shell lands close to friendly IR strobes (squad is safe)
        const sgt = this.squadmates.find((s) => s.id === 'sergeant' && s.active);
        if (sgt && Math.hypot(sgt.x - sh.target.x, sgt.z - sh.target.z) < 7.5) {
          this.pushRadioLine(
            '소재우 중사',
            '지상 알파 분대',
            'squad',
            '#ff6242',
            '위험근접! 아군 IR 스트로브 확인해, 너무 가까워!',
            3.2,
            false
          );
        }

        this.triggerExplosion(
          sh.target,
          sh.radius,
          sh.dmg,
          Faction.PLAYER,
          `AC-130 ${sh.caliber.toUpperCase()}`,
          {
            isArtillery: sh.caliber === '105mm',
            tag: `AC-130 ${sh.caliber.toUpperCase()} 직격`,
          }
        );
      }
    }
  }

  private updateSquadmates(dt: number): void {
    const nowSec = performance.now() * 0.001;
    const strobeOn = Math.sin(nowSec * 9.5) > 0.15;
    if (this.squadOrderTimer > 0) {
      this.squadOrderTimer = Math.max(0, this.squadOrderTimer - dt);
      if (this.squadOrderTimer <= 0) this.squadOrder = 'follow';
    }

    for (const sq of this.squadmates) {
      if (!sq.active) continue;
      sq.rig.irStrobe.visible = this.isAc130Active() ? strobeOn : true;
      sq.rig.irStrobe.scale.setScalar(this.isAc130Active() ? 2.6 : 1.0);

      if (sq.status === 'wounded' || sq.id === 'ghost9' || sq.id === 'survivor') {
        sq.rig.root.position.set(sq.x, sq.y, sq.z);
        sq.rig.root.rotation.y = sq.yaw;
        continue;
      }

      // During 1st-person setpieces (LCAC landing / Tower elevator), squadmates stay anchored inside vehicle
      if (this.missionStage === 'm1_landing' || this.missionStage === 'm4_elevator_breach') {
        sq.rig.root.position.set(sq.x, sq.y, sq.z);
        sq.rig.root.rotation.y = sq.yaw;
        continue;
      }

      // Active combat movement obeying [Z] Regroup / [U] Focus Suppress orders!
      const sideSign = sq.id === 'sergeant' ? -1 : 1;
      let goalX = this.player.x + sideSign * (this.squadOrder === 'regroup' ? 1.85 : 3.4);
      let goalZ =
        this.player.z +
        (this.squadOrder === 'regroup' ? 1.2 : this.squadOrder === 'suppress' ? -4.2 : 2.2);
      if (this.isAc130Active()) {
        goalX = sideSign * 3.2;
        goalZ = Math.max(-12, 22 - this.stageTimer * 0.72);
      } else if (this.missionStage === 'm2_breach_slowmo') {
        goalX = 11.5;
        goalZ = sq.id === 'sergeant' ? 2.7 : 6.4;
      }

      const dx = goalX - sq.x;
      const dz = goalZ - sq.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 1.2) {
        const spd = this.isAc130Active() ? 2.8 : 6.2;
        sq.x += (dx / dist) * Math.min(dist, spd * dt);
        sq.z += (dz / dist) * Math.min(dist, spd * dt);
        resolveXZCollision(sq, 0.48, this.colliders, ARENA_HALF_SIZE, sq.y);
        sq.walkPhase += dt * spd * 1.9;
        const stride = Math.sin(sq.walkPhase);
        sq.rig.leftLeg.rotation.x = stride * 0.55;
        sq.rig.rightLeg.rotation.x = -stride * 0.55;
      } else {
        sq.rig.leftLeg.rotation.x *= 0.85;
        sq.rig.rightLeg.rotation.x *= 0.85;
      }

      const floorY = this.getFloorHeightAt(sq.x, sq.z, sq.y);
      sq.y += (floorY - sq.y) * Math.min(1, dt * 10);
      sq.rig.root.position.set(sq.x, sq.y, sq.z);

      // Squadmate suppressive fire on nearest genuinely visible enemy (real LOS check, balanced non-solo-clearing DPS!)
      const sqEye = new THREE.Vector3(sq.x, sq.y + 1.45, sq.z);
      let nearest: ActiveUnit | null = null;
      let bestD = 32;
      for (const u of this.units) {
        if (!u.alive) continue;
        const d = Math.hypot(u.x - sq.x, u.z - sq.z);
        if (d < bestD) {
          const tgtCheck = new THREE.Vector3(u.x, u.y + 1.25 * u.scale, u.z);
          if (this.hasLineOfSight3D(sqEye, tgtCheck)) {
            bestD = d;
            nearest = u;
          }
        }
      }
      if (nearest) {
        const desiredYaw = Math.atan2(nearest.x - sq.x, nearest.z - sq.z);
        sq.yaw = desiredYaw;
        sq.fireCd -= dt;
        if (sq.fireCd <= 0 && !this.isAc130Active()) {
          const isSuppress = this.squadOrder === 'suppress';
          sq.fireCd = (isSuppress ? 0.85 : 1.45) + Math.random() * 0.55;
          const muzzle = new THREE.Vector3(sq.x, sq.y + 1.38, sq.z);
          const tgt = new THREE.Vector3(nearest.x, nearest.y + 1.25 * nearest.scale, nearest.z);
          this.spawnTracer(muzzle, tgt, 0x34d399, 0.1, 'bullet');
          const dSqP = Math.hypot(sq.x - this.player.x, sq.z - this.player.z);
          this.audio.playWeapon('rifle', Math.max(0.14, (1 - dSqP / 45) * 0.42), {
            isIndoors: this.isIndoors && dSqP < 12,
            distanceM: dSqP,
          });
          this.damageUnit(
            nearest,
            isSuppress ? 7 : 4,
            'torso',
            tgt,
            tgt.clone().sub(muzzle).normalize(),
            -2,
            sq.name,
            '분대 엄호 사격'
          );
        }
      } else if (dist > 0.5) {
        sq.yaw = Math.atan2(dx, dz);
      }
      sq.rig.root.rotation.y = sq.yaw;
    }
  }

  private updateCampaignDirector(dt: number, realDt: number): void {
    if (this.gameMode !== 'campaign' || this.phase !== 'playing' || this.cinematic.isCutsceneActive()) {
      return;
    }

    this.stageTimer += realDt;

    // Pending smooth mission transition after Checkpoint Toast
    if (this.stagePendingNext) {
      this.stageTransitionDelay -= realDt;
      if (this.stageTransitionDelay <= 0) {
        const next = this.stagePendingNext;
        this.stagePendingNext = null;
        this.beginCampaignStage(next.mission, next.stage);
      }
      return;
    }

    // 1st-Person Sergeant So rescue pull-up animation (Mission 04)
    if (this.rescueAnimTimer > 0) {
      this.rescueAnimTimer = Math.max(0, this.rescueAnimTimer - realDt);
      const p = 1 - this.rescueAnimTimer / 1.9;
      const heave = Math.sin(p * Math.PI) * 0.32;
      this.camera.position.set(this.player.x, 1.32 + p * 0.38 - heave * 0.2, this.player.z);
      this.camera.rotation.y = this.player.yaw;
      this.camera.rotation.x = -0.35 * (1 - p);
      this.camera.rotation.z = Math.sin(p * Math.PI * 2) * 0.12;
      const sgt = this.squadmates.find((s) => s.id === 'sergeant');
      if (sgt) {
        sgt.rig.torso.rotation.x = 0.95 * (1 - p);
        if (this.rescueAnimTimer <= 0) {
          sgt.status = 'active';
        }
      }
      if (this.rescueAnimTimer <= 0) {
        this.triggerCheckpoint('체크포인트 도달');
        this.beginCampaignStage(4, 'm4_final_core');
      }
      return;
    }

    // MISSION 01 — 1ST-PERSON UNCUT LCAC HOVERCRAFT LANDING SETPIECE (Image 3 Homage!)
    if (this.missionStage === 'm1_landing') {
      const t = this.stageTimer;
      const lcac = this.worldRefs.lcacHovercraft;
      const glideT = Math.min(1, t / 5.8);
      const easeGlide = 1 - Math.pow(1 - glideT, 2.2);
      const hoverZ = 53.5 - easeGlide * 12.0; // Glides 53.5 -> 41.5
      const swellY = Math.sin(t * 4.2) * 0.14 * (1 - glideT * 0.75);
      const swellRoll = Math.cos(t * 3.1) * 0.032 * (1 - glideT * 0.75);
      lcac.group.position.set(0, swellY, hoverZ);
      lcac.group.rotation.z = swellRoll;

      // Solo Tier-1 Operator riding LCAC bow deck (zero follower AI bots)
      this.setSquadmateState('sergeant', false, -1.85, 1.2 + swellY, hoverZ - 2.2, Math.PI, 'active');
      this.setSquadmateState('corporal', false, 1.85, 1.2 + swellY, hoverZ - 1.9, Math.PI, 'active');

      // Scripted milestones
      if (t >= 0.3 && !this.stageMilestones.has('m1_line1')) {
        this.stageMilestones.add('m1_line1');
        this.pushRadioLine('발키리-01 · 강서연 대위', '궤도 작전 지휘', 'valkyrie', '#2ee6a6', 'LCAC-655 해안 접안 10초 전. 충격에 대비하라.', 2.2, true);
      }
      if (t >= 1.8 && !this.stageMilestones.has('m1_line2')) {
        this.stageMilestones.add('m1_line2');
        this.pushRadioLine('천사-01 · 상륙정 정장', '대한민국해군 LCAC-655', 'gunship', '#38d9ff', '전방 적 해안포 사격 개시! 전원 엎드려!', 1.8, true);
      }
      if (t >= 2.9 && !this.stageMilestones.has('m1_apc_hit')) {
        this.stageMilestones.add('m1_apc_hit');
        // Friendly K-808 ahead gets hit -> fireball + shock knockdown in 1st-person!
        this.vfx.spawnExplosion(new THREE.Vector3(-4.5, 2.2, hoverZ - 14), 11, false);
        this.audio.playExplosion(1.1, true, false);
        this.shake = 1.25;
        this.blastFlashSeq++;
        this.pushRadioLine(
          '발키리-01 · 강서연 대위',
          '궤도 작전 지휘',
          'valkyrie',
          '#f5b342',
          '전방 11시 장갑차 피격! 연막 속으로 침투해 단독 교두보를 확보하라!',
          3.4,
          true
        );
      }
      if (t >= 4.7 && !this.stageMilestones.has('m1_standup')) {
        this.stageMilestones.add('m1_standup');
        this.audio.playMountClick(true);
        this.pushRadioLine(
          '천사-01 · 상륙정 정장',
          '대한민국해군 LCAC-655',
          'gunship',
          '#2ee6a6',
          '함수 램프 개방 3초 전! 무장 확인—전방 돌파 준비!',
          2.6,
          true
        );
      }
      if (t >= 6.0 && !this.stageMilestones.has('m1_ramp')) {
        this.stageMilestones.add('m1_ramp');
        this.audio.playExplosion(0.65, false, false);
        this.shake = 0.45;
      }

      // Ramp starts slightly cracked to frame the smoky Seoul shoreline ahead, then slams fully open at t=5.9..7.0!
      const rampT = Math.max(0, Math.min(1, (t - 5.9) / 1.1));
      lcac.rampPivot.rotation.x = -0.22 - (Math.PI * 0.44 - 0.22) * (rampT * rampT);

      // 1st-person uncut knockdown (t=2.9..4.7) -> haul-up (t=4.7..6.1) camera cleanly ABOVE LCAC well-deck (zero hull clipping!)
      let eyeY = 3.18 + swellY;
      let camRoll = swellRoll;
      if (t >= 2.9 && t < 4.7) {
        const kd = Math.min(1, (t - 2.9) / 0.45);
        eyeY = 3.18 - kd * 1.12 + swellY;
        camRoll = -0.34 * kd;
      } else if (t >= 4.7 && t < 6.2) {
        const up = Math.min(1, (t - 4.7) / 1.35);
        const eUp = 1 - Math.pow(1 - up, 2);
        eyeY = 2.06 + eUp * 1.12 + Math.sin(up * Math.PI) * 0.14;
        camRoll = -0.34 * (1 - eUp);
      }

      this.shake *= Math.pow(0.002, realDt);
      const shkX = (Math.random() - 0.5) * this.shake * 0.24;
      const shkY = (Math.random() - 0.5) * this.shake * 0.24;
      this.camera.position.set(shkX, eyeY + shkY, hoverZ - 3.6);
      this.camera.rotation.y = Math.max(-0.85, Math.min(0.85, this.player.yaw));
      this.camera.rotation.x = Math.max(-0.55, Math.min(0.55, this.player.pitch));
      this.camera.rotation.z = camRoll;
      this.viewmodel.pivot.visible = t > 5.4;

      if (t >= 7.3) {
        this.triggerCheckpoint('체크포인트 도달');
        this.beginCampaignStage(1, 'm1_beachhead');
      }
      return;
    }

    // MISSION 01 — BEACHHEAD CLEAR -> MISSION 02
    if (this.missionStage === 'm1_beachhead') {
      const alive = this.units.filter((u) => u.alive).length;
      if (alive === 0) {
        this.triggerCheckpoint('체크포인트 도달');
        this.pushRadioLine(
          '소재우 중사',
          '알파 분대장',
          'squad',
          '#2ee6a6',
          '해안 교두보 확보 완료! 을지로 도심 골목으로 전진한다—따라와!',
          3.8,
          true
        );
        this.stageTransitionDelay = 2.0;
        this.stagePendingNext = { mission: 2, stage: 'm2_alley' };
      }
      return;
    }

    // MISSION 02 — ALLEY CLEAR -> BLINKING C4 BREACH DOOR PROMPT + CAPTAIN KANG SECRET INTEL
    if (this.missionStage === 'm2_alley') {
      const alive = this.units.filter((u) => u.alive).length;
      if (alive <= 3 && alive > 0 && !this.stageMilestones.has('m2_valkyrie_secret')) {
        this.stageMilestones.add('m2_valkyrie_secret');
        this.pushRadioLine(
          '발키리-01 · 강서연 대위',
          'UNS 아크라이트 · 암호 회선',
          'valkyrie',
          '#38d9ff',
          '이안, 조심해... 상부에서 궤도 소각 프로토콜을 준비 중이야. 네가 직접 코어를 멈춰야 서울이 산다.',
          5.6,
          false
        );
      }
      const bd = this.worldRefs?.euljiroBreachDoor;
      if (alive === 0 && bd && !bd.breached) {
        bd.c4Pack.visible = true;
        bd.breachLight.intensity = 2.2 + Math.sin(this.stageTimer * 10) * 1.4;
        if (!this.stageMilestones.has('m2_alley_clear')) {
          this.stageMilestones.add('m2_alley_clear');
          this.triggerCheckpoint('체크포인트 도달');
          this.pushRadioLine(
            '소재우 중사',
            '알파 분대장',
            'squad',
            '#38d9ff',
            '골목 정리 완료! 동쪽 적 지휘소 방폭문에 붙어—[F]로 C4 폭파 브리칭한다!',
            4.8,
            true
          );
        }
      }
      return;
    }

    // MISSION 02 — 0.2x SLOW-MO BREACH & CLEAR DOOR FLY-IN ANIMATION
    if (this.missionStage === 'm2_breach_slowmo') {
      if (this.breachSlowmoTimer > 0) {
        this.breachSlowmoTimer = Math.max(0, this.breachSlowmoTimer - realDt);
      }
      const bd = this.worldRefs?.euljiroBreachDoor;
      if (bd) {
        const fly = Math.min(1, this.stageTimer * 0.55);
        bd.leftLeaf.position.set(fly * 3.8, Math.max(0.2, 1.44 - fly * 1.1), -0.76 - fly * 1.6);
        bd.leftLeaf.rotation.set(fly * 1.2, fly * 0.9, -fly * 1.45);
        bd.rightLeaf.position.set(fly * 4.2, Math.max(0.2, 1.44 - fly * 1.15), 0.76 + fly * 1.5);
        bd.rightLeaf.rotation.set(-fly * 1.1, -fly * 0.85, -fly * 1.4);
        bd.breachLight.intensity = Math.max(0, 6.5 * (1 - fly));
      }
      const alive = this.units.filter((u) => u.alive).length;
      if (alive === 0) {
        this.breachSlowmoTimer = 0;
        this.beginCampaignStage(2, 'm2_survivor_ghost');
      }
      return;
    }

    // MISSION 03 — STAGE 1: UH-60K ASSAULT HELICOPTER DOOR-GUNNER RIDE
    if (this.missionStage === 'm3_heli_insert') {
      this.updateHeliRide(dt, realDt);
      return;
    }

    // MISSION 03 — STAGE 2: AC-130 FLIR GUNSHIP WAVE PROGRESSION
    if (this.missionStage === 'm3_ac130_flir') {
      this.updateAc130Gunship(dt, realDt);
      const alive = this.units.filter((u) => u.alive).length;
      if (alive === 0) {
        if (this.ac130WaveIdx < 3) {
          const nextWave = (this.ac130WaveIdx + 1) as 2 | 3;
          this.spawnAc130HostileWave(nextWave);
          if (nextWave === 2 && !this.stageMilestones.has('m3_park_pact')) {
            this.stageMilestones.add('m3_park_pact');
            this.pushRadioLine(
              '발키리-01 · 강서연 대위',
              '궤도 작전 지휘',
              'valkyrie',
              '#38d9ff',
              '시타델 진입로에 K2-X 흑표 전차 공중 투하 준비 중! 남은 적 기갑 증원파만 완전히 쓸어버려!',
              4.6,
              false
            );
          }
        } else {
          // Mission 03 Complete! Restore color grading & transition straight into K2-X Tank Assault (Mission 04)!
          if (this.gradePass) this.gradePass.uniforms.uFlirMode.value = 0.0;
          this.triggerCheckpoint('체크포인트 도달');
          this.pushRadioLine(
            '천사-01 · AC-130 건쉽',
            '궤도 화력관제사',
            'gunship',
            '#2ee6a6',
            '적 열원 전멸 확인! K2-X 흑표 전차 투하 완료—이제 시타델 정면으로 밀고 들어가라!',
            4.2,
            true
          );
          this.stageTransitionDelay = 2.0;
          this.stagePendingNext = { mission: 4, stage: 'm4_tank_assault' };
        }
      }
      return;
    }

    // MISSION 04 — STAGE 1: DRIVABLE K2-X BLACK PANTHER TANK ASSAULT & OMNI-TITAN DUEL
    if (this.missionStage === 'm4_tank_assault') {
      const alive = this.units.filter((u) => u.alive).length;
      if (alive === 0) {
        this.triggerCheckpoint('체크포인트 도달');
        this.pushRadioLine(
          '발키리-01 · 강서연 대위',
          '궤도 작전 지휘',
          'valkyrie',
          '#2ee6a6',
          'OMNI-TITAN 및 시타델 친위대 전멸 확인! 전차에서 하차해 북쪽 OMNI-CORE 중앙 단말기([F])에 접속하라!',
          5.0,
          true
        );
        this.beginCampaignStage(4, 'm4_final_core');
      }
      return;
    }

    // MISSION 04 — 1ST-PERSON UNCUT EXTERIOR LIFT CLIMB & JOINT BLAST-DOOR PRY-OPEN
    if (this.missionStage === 'm4_elevator_breach') {
      const t = this.stageTimer;
      const el = this.worldRefs.towerElevator;
      // Lift shudders upward then docks flush with Citadel Courtyard
      const liftY = t < 3.4 ? Math.sin((t / 3.4) * Math.PI) * 3.4 : 0;
      const jitterX = (Math.random() - 0.5) * 0.035;
      const jitterY = (Math.random() - 0.5) * 0.035;
      el.group.position.set(0, liftY, -19.5);
      el.cabinLight.intensity = 2.2 + Math.sin(t * 16) * 0.8;

      this.setSquadmateState('sergeant', true, -1.15, liftY + 0.22, -20.6, Math.PI, 'active');
      this.setSquadmateState('corporal', true, 1.25, liftY + 0.22, -20.2, Math.PI, 'active');

      if (t >= 2.2 && !this.stageMilestones.has('m4_flak')) {
        this.stageMilestones.add('m4_flak');
        this.vfx.spawnExplosion(new THREE.Vector3(6.5, liftY + 3.2, -25.0), 8, false);
        this.audio.playExplosion(0.85, false, false);
        this.shake = 0.72;
      }
      if (t >= 3.5 && !this.stageMilestones.has('m4_pry')) {
        this.stageMilestones.add('m4_pry');
        this.audio.playMountClick(true);
        this.pushRadioLine(
          '소재우 중사',
          '알파 분대장',
          'squad',
          '#ff6242',
          '방폭문 유압이 잠겼다—같이 밀어! 하나, 둘, 셋!',
          2.6,
          true
        );
      }

      // Joint 1st-person door heave strain (t = 3.6 -> 5.8)
      let heavePitch = 0;
      let heaveRoll = 0;
      if (t >= 3.6) {
        const openP = Math.min(1, (t - 3.6) / 2.1);
        const eased = openP * openP * (3 - 2 * openP);
        el.leftDoor.position.x = -1.08 - eased * 1.95;
        el.rightDoor.position.x = 1.08 + eased * 1.95;
        heavePitch = Math.sin(openP * Math.PI * 3) * 0.05;
        heaveRoll = Math.sin(openP * Math.PI * 2) * 0.08;
        if (Math.random() < 0.28) {
          this.vfx.spawnSparkBurst(new THREE.Vector3(0, 1.6, -21.4), new THREE.Vector3(0, 0, 1), 3, 0xffaa33, 5);
        }
      }

      this.shake *= Math.pow(0.002, realDt);
      this.camera.position.set(jitterX, liftY + 1.85 + jitterY, -19.2 - Math.max(0, (t - 3.6) * 0.35));
      this.camera.rotation.y = Math.max(-0.7, Math.min(0.7, this.player.yaw));
      this.camera.rotation.x = Math.max(-0.5, Math.min(0.5, this.player.pitch + heavePitch));
      this.camera.rotation.z = heaveRoll;
      this.viewmodel.pivot.visible = t > 4.8;

      if (t >= 6.1) {
        this.triggerCheckpoint('체크포인트 도달');
        this.beginCampaignStage(4, 'm4_tower_assault');
      }
      return;
    }

    // MISSION 04 — CITADEL FINAL ASSAULT -> SQUADMATE SACRIFICE CRISIS
    if (this.missionStage === 'm4_tower_assault') {
      const alive = this.units.filter((u) => u.alive).length;
      if (alive === 0) {
        this.beginCampaignStage(4, 'm4_sacrifice_crisis');
      }
      return;
    }

    // MISSION 04 — 12s CRISIS COUNTDOWN (auto-resolves to cold rush if timer runs out)
    if (this.missionStage === 'm4_sacrifice_crisis') {
      if (this.crisisTimer < 7.5 && !this.stageMilestones.has('m4_architect_taunt')) {
        this.stageMilestones.add('m4_architect_taunt');
        this.pushRadioLine(
          'OMNI-CORE · 아키텍트',
          '중앙 신경망',
          'arcadia',
          '#ff4422',
          '네 분대원을 구하려다 인류 전체를 불태울 셈인가, 이안? 논리적으로 무의미한 희생이다.',
          5.2,
          false
        );
      }
      this.crisisTimer = Math.max(0, this.crisisTimer - realDt);
      if (this.campaignPrompt) {
        this.campaignPrompt.remainingSec = Math.ceil(this.crisisTimer);
      }
      if (Math.random() < 0.16) {
        this.vfx.spawnSparkBurst(new THREE.Vector3(-3.8, 0.9, -23.2), new THREE.Vector3(0, 1, 0), 3, 0xff5a14, 5);
      }
      if (this.crisisTimer <= 0) {
        this.resolveCampaignPromptChoice('G');
      }
    }
  }

  private buildAc130HudState(): Ac130HudState {
    const active = this.isAc130Active();
    const spec = AC130_WEAPONS[this.ac130WeaponIdx];
    const reloadPct =
      this.ac130FireCd <= 0
        ? 100
        : Math.max(0, Math.min(100, Math.round((1 - this.ac130FireCd / spec.cooldown) * 100)));
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const friendlyStrobes: Ac130HudState['friendlyStrobes'] = [];
    const hostileMarkers: Ac130HudState['hostileMarkers'] = [];

    if (active) {
      for (const sq of this.squadmates) {
        if (!sq.active) continue;
        this._v4.set(sq.x, sq.y + 1.9, sq.z).project(this.camera);
        if (this._v4.z < -1 || this._v4.z > 1) continue;
        friendlyStrobes.push({
          id: sq.id,
          label: sq.name,
          screenX: Math.round(((this._v4.x + 1) * 0.5) * w),
          screenY: Math.round(((-this._v4.y + 1) * 0.5) * h),
        });
      }
      for (const u of this.units) {
        if (!u.alive) continue;
        this._v4.set(u.x, u.y + 1.3 * u.scale, u.z).project(this.camera);
        if (this._v4.z < -1 || this._v4.z > 1) continue;
        hostileMarkers.push({
          id: u.id,
          screenX: Math.round(((this._v4.x + 1) * 0.5) * w),
          screenY: Math.round(((-this._v4.y + 1) * 0.5) * h),
          isHeavy: u.isBoss || u.archetype === UnitArchetype.SYNDICATE_HEAVY,
        });
      }
    }

    return {
      active,
      weaponIdx: this.ac130WeaponIdx,
      caliber: spec.caliber,
      weaponName: spec.name,
      reloadPct,
      thermalMode: this.ac130ThermalMode,
      zoomed: this.ac130Zoomed,
      altitudeM: 4200,
      headingDeg: Math.round((((this.ac130OrbitAngle * 180) / Math.PI) % 360 + 360) % 360),
      friendlyStrobes,
      hostileMarkers,
    };
  }

  private projectSquadmateTags(): SquadmateTag[] {
    if (
      this.gameMode !== 'campaign' ||
      this.phase !== 'playing' ||
      this.isAc130Active() ||
      this.cinematic.isCutsceneActive()
    ) {
      return [];
    }
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const tags: SquadmateTag[] = [];
    for (const sq of this.squadmates) {
      if (!sq.active) continue;
      const dist = Math.hypot(sq.x - this.player.x, sq.z - this.player.z);
      if (dist > 45) continue;
      this._v4.set(sq.x, sq.y + 2.18, sq.z).project(this.camera);
      if (this._v4.z < -1 || this._v4.z > 1) continue;
      const sx = ((this._v4.x + 1) * 0.5) * w;
      const sy = ((-this._v4.y + 1) * 0.5) * h;
      if (sx < 24 || sx > w - 24 || sy < 40 || sy > h - 60) continue;
      tags.push({
        id: sq.id,
        name: sq.name,
        screenX: Math.round(sx),
        screenY: Math.round(sy),
        distanceM: Math.round(dist),
        status: sq.status,
      });
    }
    return tags;
  }

  private tryInteractKey(): void {
    if (this.phase !== 'playing' || !this.player.alive || this.cinematic.isCutsceneActive()) return;

    // 0) Active Campaign Choice Prompt ([F] rescue survivor / Ghost-9 pact OR save Sergeant So!)
    if (this.gameMode === 'campaign' && this.campaignPrompt) {
      this.resolveCampaignPromptChoice('F');
      return;
    }

    // 0.25) Board or Dismount Drivable K2-X Black Panther Main Battle Tank ([F])!
    if (this.tank.driving) {
      this.exitTank(false);
      return;
    }
    if (this.isTankNearPlayer()) {
      this.enterTank();
      return;
    }

    // 0.5) Mission 02 Euljiro C4 Blast Door Breach!
    if (this.isBreachDoorInRange()) {
      this.beginCampaignStage(2, 'm2_breach_slowmo');
      return;
    }

    // 1) Hack nearby Ghost-9 automated defense turret
    if (this.worldRefs) {
      for (const t of this.worldRefs.turrets) {
        if (t.hacked) continue;
        if (Math.hypot(this.player.x - t.x, this.player.z - t.z) <= 5.2) {
          t.hacked = true;
          this.campaignChoices.ghostTrust += 1;
          this.pushCombatMedal('BACKDOOR HACK', '고스트-9 자동 포탑 장악', '#2ee6a6', true);
          t.rig.statusMat.color.setHex(0x2dd4bf);
          (t.rig.beaconRing.material as THREE.MeshBasicMaterial).color.setHex(0x2dd4bf);
          this.audio.playTurretHack();
          this.vfx.spawnSparkBurst(new THREE.Vector3(t.x, 1.8, t.z), new THREE.Vector3(0, 1, 0), 16, 0x2dd4bf, 8);
          this.addThreatPoints(35);
          this.triggerRadioComms('turretHacked', false);
          this.showCallout(`${t.name} 해킹 완료 · 아군 화력 지원 개시!`, '#2dd4bf', 2.4);
          this.emitHudSnapshot(true);
          return;
        }
      }
    }

    // 2) Trigger Zero Hour Climax / Auto-Branching Ending at OMNI-CORE Central Server Terminal
    this.tryShutdownServerCore();
  }

  private tryShutdownServerCore(): void {
    if (
      !this.coreShieldDown ||
      this.serverShutdownActive ||
      this.phase !== 'playing' ||
      !this.player.alive ||
      this.cinematic.isCutsceneActive()
    ) {
      return;
    }
    const cit = this.worldRefs?.citadel;
    if (!cit) return;
    const dist = Math.hypot(this.player.x - cit.terminalX, this.player.z - cit.terminalZ);
    if (dist > 10.5) return;
    this.coreHp = 0;
    this.triggerZeroHourChoice();
  }

  private triggerZeroHourChoice(): void {
    if (this.serverShutdownActive || this.cinematic.getSequence() === 'choice') return;
    this.vatsActive = false;
    this.clearHeldInputs();

    // In 4-Mission Linear Campaign (Mission 04 final core), choices accumulated across Missions 2–4
    // AUTOMATICALLY branch into the earned dense ending (Symbiosis / Dawn / Ascension)!
    if (this.gameMode === 'campaign' && this.missionId === 4 && this.missionStage === 'm4_final_core') {
      const autoRes = resolveCampaignAutoEnding(this.campaignChoices);
      this.autoEndingReason = autoRes.reasonKr;
      this.chooseEnding(autoRes.ending);
      return;
    }

    this.exitPointerLockSafe();
    const lookDir = new THREE.Vector3();
    this.camera.getWorldDirection(lookDir);
    const lookAt = this.camera.position.clone().addScaledVector(lookDir, 22);
    const cit = this.worldRefs?.citadel;
    this.cinematic.startChoice(
      { x: this.player.x, y: this.player.y, z: this.player.z },
      { x: lookAt.x, y: lookAt.y, z: lookAt.z },
      { x: cit?.x ?? 0, y: 12, z: cit?.z ?? -35 }
    );
    this.emitHudSnapshot(true);
  }

  private triggerDawnEnding(): void {
    this.chooseEnding('dawn');
  }

  private handleEndingImpact(ending: EndingId): void {
    const cit = this.worldRefs?.citadel;
    if (ending === 'dawn') {
      // Handled alongside handleDawnBlackoutImpact (called right before onEndingImpact for dawn)
      if (this.worldRefs) {
        this.worldRefs.rescueShuttle.visible = true;
        this.worldRefs.rescueShuttle.position.set(-48, 42, -52);
        for (const gr of this.worldRefs.dawnGodRays) {
          gr.visible = true;
          (gr.material as THREE.MeshBasicMaterial).color.setHex(0xffd58a);
        }
      }
      return;
    }

    if (ending === 'symbiosis') {
      if (cit) {
        cit.shieldDome.visible = false;
        (cit.coreBeam.material as THREE.MeshBasicMaterial).color.setHex(0x2dd4bf);
        (cit.coreWeakpoint.material as THREE.MeshBasicMaterial).color.setHex(0x38e8ff);
        cit.terminalLight.color.setHex(0x2dd4bf);
        cit.terminalLight.intensity = 8.5;
        this.vfx.spawnExplosion(new THREE.Vector3(cit.x, 11.0, cit.z), 30, true);
        this.vfx.spawnOrbitalBeam(cit.x, cit.z, 0x2dd4bf, 2.2);
      }
      if (this.worldRefs) {
        this.worldRefs.rescueShuttle.visible = true;
        this.worldRefs.rescueShuttle.position.set(44, 38, -50);
        for (const gr of this.worldRefs.dawnGodRays) {
          gr.visible = true;
          (gr.material as THREE.MeshBasicMaterial).color.setHex(0x2dd4bf);
        }
      }
      // Every surviving AI robot awakens in peaceful cyan harmony!
      for (const u of this.units) {
        if (!u.alive) continue;
        u.rig.visorMat.color.setHex(0x38e8ff);
        if (u.rig.sniperLaser) u.rig.sniperLaser.visible = false;
        this.vfx.spawnSparkBurst(new THREE.Vector3(u.x, 1.5, u.z), new THREE.Vector3(0, 1, 0), 8, 0x2dd4bf, 7);
      }
      this.audio.playEndingChord('symbiosis');
      this.empFlashSeq++;
      this.shake = 1.1;
      this.recordTimelineSnapshot();
      this.emitHudSnapshot(true);
      return;
    }

    // ENDING C: ASCENSION (THE IRON SOVEREIGN)
    if (cit) {
      cit.shieldDome.visible = false;
      cit.coreBeam.visible = true;
      cit.coreBeam.scale.set(2.4, 1.35, 2.4);
      (cit.coreBeam.material as THREE.MeshBasicMaterial).color.setHex(0xff9f1a);
      (cit.coreWeakpoint.material as THREE.MeshBasicMaterial).color.setHex(0xff4422);
      cit.terminalLight.color.setHex(0xff4422);
      cit.terminalLight.intensity = 10.5;
      this.vfx.spawnExplosion(new THREE.Vector3(cit.x, 12.0, cit.z), 32, false);
      this.vfx.spawnOrbitalBeam(cit.x, cit.z, 0xff4422, 2.6);
      this.vfx.spawnLightningArc(
        new THREE.Vector3(cit.x, 12, cit.z),
        new THREE.Vector3(cit.x - 16, 48, cit.z - 8),
        0xff4422,
        1.1
      );
      this.vfx.spawnLightningArc(
        new THREE.Vector3(cit.x, 12, cit.z),
        new THREE.Vector3(cit.x + 18, 52, cit.z + 4),
        0xf5b342,
        1.1
      );
    }
    // Surviving battle mechs kneel in loyalty with crimson-gold optics!
    for (const u of this.units) {
      if (!u.alive) continue;
      u.rig.visorMat.color.setHex(0xf5b342);
      u.rig.root.position.y = -0.35;
      u.rig.root.rotation.x = 0.28;
      if (u.rig.sniperLaser) u.rig.sniperLaser.visible = false;
    }
    this.audio.playEndingChord('ascension');
    this.blastFlashSeq++;
    this.shake = 1.65;
    this.recordTimelineSnapshot();
    this.emitHudSnapshot(true);
  }

  private handleDawnBlackoutImpact(): void {
    const cit = this.worldRefs?.citadel;
    if (cit) {
      cit.coreBeam.visible = false;
      cit.coreWeakpoint.visible = false;
      cit.shieldDome.visible = false;
      cit.terminalLight.intensity = 0.2;
      for (const em of cit.emissiveMeshes) {
        em.visible = false;
      }
      this.vfx.spawnExplosion(new THREE.Vector3(cit.x, 6.2, cit.z + 3.5), 24, true);
      this.vfx.spawnExplosion(new THREE.Vector3(cit.x, 11.2, cit.z), 30, true);
      this.vfx.spawnExplosion(new THREE.Vector3(cit.x, 16.4, cit.z - 1.5), 22, false);
    }

    this.audio.playServerShutdown();
    this.audio.playDawnChime();
    this.empFlashSeq++;
    this.shake = 1.5;

    // Planetary EMP blackout: every surviving AI robot powers down & collapses simultaneously!
    for (const u of this.units) {
      if (!u.alive) continue;
      u.alive = false;
      this.scene.remove(u.rig.root);
      this.spawnRagdoll(
        u,
        new THREE.Vector3(
          (Math.random() - 0.5) * 5,
          3.2 + Math.random() * 3.5,
          (Math.random() - 0.5) * 5
        )
      );
      this.vfx.spawnSparkBurst(
        new THREE.Vector3(u.x, 1.3, u.z),
        new THREE.Vector3(0, 1, 0),
        10,
        0x38e8ff,
        9
      );
      this.kills++;
    }
    this.rebuildHitMeshCache();
    this.recordTimelineSnapshot();
    this.emitHudSnapshot(true);
  }

  private handleCinematicComplete(
    seq: 'none' | 'opening' | 'titan_drop' | 'breach' | 'choice' | 'dawn' | 'symbiosis' | 'ascension'
  ): void {
    if (this.theaterReturnToTitle && seq !== 'choice') {
      this.theaterReturnToTitle = false;
      this.returnToTitle();
      return;
    }
    if (seq === 'opening') {
      this.player.equipTimer = 0.48;
      this.camera.rotation.z = 0;
      this.viewmodel.pivot.visible = true;
    } else if (seq === 'titan_drop' || seq === 'breach') {
      this.camera.rotation.z = 0;
      this.viewmodel.pivot.visible = true;
      this.player.equipTimer = 0.25;
    } else if (seq === 'dawn' || seq === 'symbiosis' || seq === 'ascension') {
      this.endingId = seq;
      this.clearHeldInputs();
      this.exitPointerLockSafe();
      this.setPhase('victory');
    }
    this.emitHudSnapshot(true);
  }

  // Exo-Thruster Dash / Power Slide (`C`)
  private triggerExoDashOrSlide(): void {
    if (
      this.phase !== 'playing' ||
      !this.player.alive ||
      this.cinematic.isCutsceneActive() ||
      this.vatsActive ||
      this.player.dashCharges <= 0
    ) {
      return;
    }
    this.player.dashCharges--;
    const fwd =
      (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    const strafe = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    const sinY = Math.sin(this.player.yaw);
    const cosY = Math.cos(this.player.yaw);
    let dx = -sinY * (fwd === 0 && strafe === 0 ? 1 : fwd) + cosY * strafe;
    let dz = -cosY * (fwd === 0 && strafe === 0 ? 1 : fwd) - sinY * strafe;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    this.player.dashDirX = dx;
    this.player.dashDirZ = dz;

    const doSlide = this.player.sprinting && this.player.onGround;
    if (doSlide) {
      this.player.slideTimer = 0.54;
      this.player.dashTimer = 0.2;
      this.fovKick = Math.max(this.fovKick, 6.5);
      this.audio.playDash(true);
    } else {
      this.player.dashTimer = 0.22;
      this.fovKick = Math.max(this.fovKick, 8.2);
      this.audio.playDash(false);
    }
    this.shake = Math.max(this.shake, 0.16);
    this.emitHudSnapshot(true);
  }

  // Valkyrie Orbital Supply Drop (`V`)
  public callSupplyDrop(): void {
    if (
      this.phase !== 'playing' ||
      !this.player.alive ||
      this.cinematic.isCutsceneActive() ||
      this.supplyDropCd > 0
    ) {
      return;
    }
    this.supplyDropCd = 36;
    const fx = -Math.sin(this.player.yaw);
    const fz = -Math.cos(this.player.yaw);
    const sx = Math.max(-ARENA_HALF_SIZE + 5, Math.min(ARENA_HALF_SIZE - 5, this.player.x + fx * 9));
    const sz = Math.max(-ARENA_HALF_SIZE + 5, Math.min(ARENA_HALF_SIZE - 5, this.player.z + fz * 9));

    const mesh = buildSupplyPodModel(this.matCache.armorPlate, this.matCache.darkIron);
    mesh.position.set(sx, 36, sz);
    this.scene.add(mesh);
    this.vfx.spawnOrbitalBeam(sx, sz, 0x34d399, 1.35);
    this.audio.playSupplyDrop();
    this.triggerRadioComms('supplyDrop', false);
    this.showAlert('발키리 궤도 보급 포드 투하 — 녹색 신호탄으로 이동해 오버드라이브 확보!', 4.2);

    this.supplyDrops.push({
      mesh,
      x: sx,
      y: 36,
      z: sz,
      landed: false,
      collected: false,
      life: 45,
    });
    this.emitHudSnapshot(true);
  }

  // V.A.T.S. Tactical Slow-Mo (`Q`)
  private toggleVats(): void {
    if (this.phase !== 'playing' || !this.player.alive) return;
    if (this.vatsActive) {
      this.exitVats();
      this.requestPointerLockSafe();
    } else if (this.vatsEnergy >= VATS_MIN_ACTIVATE) {
      this.vatsActive = true;
      this.mouseLeft = false;
      this.audio.playVatsToggle(true);
      this.exitPointerLockSafe();
      this.updateVatsProjections();
      this.emitHudSnapshot(true);
    }
  }

  private exitVats(): void {
    if (!this.vatsActive) return;
    this.vatsActive = false;
    this.vatsTargets = [];
    this.audio.playVatsToggle(false);
    this.emitHudSnapshot(true);
  }

  private updateVatsProjections(): void {
    if (!this.vatsActive) {
      this.vatsTargets = [];
      return;
    }
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const targets: VatsTargetBox[] = [];
    const camPos = this.camera.position;

    // Sort closest alive enemies in front of camera
    const sorted = this.units
      .filter((u) => u.alive)
      .map((u) => ({ u, d: Math.hypot(u.x - camPos.x, u.z - camPos.z) }))
      .filter((item) => item.d < 54)
      .sort((a, b) => a.d - b.d)
      .slice(0, 4);

    const partOrder: BodyPart[] = ['head', 'core', 'rightArm', 'leftArm', 'leftLeg', 'armorFront'];

    for (const { u, d } of sorted) {
      let addedForUnit = 0;
      for (const pName of partOrder) {
        if (addedForUnit >= 2) break;
        const m = u.rig.parts[pName];
        if (!m || !m.visible || u.missing[pName]) continue;
        m.getWorldPosition(this._v1);
        this._v1.project(this.camera);
        // Guard NDC projection (v.z >= -1 && v.z <= 1)
        if (this._v1.z < -1 || this._v1.z > 1) continue;
        if (Math.abs(this._v1.x) > 0.94 || Math.abs(this._v1.y) > 0.9) continue;

        const sx = ((this._v1.x + 1) * 0.5) * w;
        const sy = ((-this._v1.y + 1) * 0.5) * h;
        const hitChance = Math.max(45, Math.min(98, Math.round(98 - d * 1.15)));
        targets.push({
          unitId: u.id,
          unitName: u.name,
          faction: u.faction,
          part: pName,
          partLabel: PART_LABELS_KR[pName],
          multiplier: PART_MULTIPLIERS[pName],
          hitChance,
          screenX: Math.round(sx),
          screenY: Math.round(sy),
          distance: Math.round(d),
          hpPct: Math.max(0, Math.round((u.hp / u.maxHp) * 100)),
        });
        addedForUnit++;
      }
    }
    this.vatsTargets = targets;
  }

  // DOOM Glory Kill (`E`)
  private findGloryKillTarget(): ActiveUnit | null {
    let best: ActiveUnit | null = null;
    let bestD = 4.9;
    this.camera.getWorldDirection(this._v1);
    for (let i = 0; i < this.units.length; i++) {
      const u = this.units[i];
      if (!u.alive || u.isBoss) continue;
      if (u.hp > u.maxHp * 0.55 && u.staggerTimer <= 0 && u.empStunTimer <= 0) continue;
      this._v2.set(u.x - this.player.x, 1.1 - this.player.y, u.z - this.player.z);
      const d = this._v2.length();
      if (d < bestD && this._v2.normalize().dot(this._v1) > 0.6) {
        bestD = d;
        best = u;
      }
    }
    return best;
  }

  private performGloryKill(): void {
    const target = this.findGloryKillTarget();
    if (!target) return;

    const dir = new THREE.Vector3(target.x - this.player.x, 0, target.z - this.player.z).normalize();
    this.player.x = target.x - dir.x * 1.45;
    this.player.z = target.z - dir.z * 1.45;
    resolveXZCollision(this.player, 0.55, this.colliders);
    this.player.bladeTimer = 0.25;

    this.audio.playGloryKill();
    this.hitstop = 0.105;
    this.shake = 0.72;
    this.executions++;
    this.pushCombatMedal('GLORY EXECUTION', '고주파 블레이드 처형', '#ff4422', true);
    this.analytics.partBreakdown.gloryKill++;

    this.dismemberPart(target, 'head', dir, 2.0);
    this.dismemberPart(target, 'rightArm', dir, 1.6);
    this.damageUnit(
      target,
      target.hp + 999,
      'head',
      new THREE.Vector3(target.x, 1.4, target.z),
      dir,
      Faction.PLAYER,
      FACTION_META[Faction.PLAYER].name,
      '글로리 킬 처형',
      dir.clone().multiplyScalar(17).add(new THREE.Vector3(0, 6.5, 0))
    );

    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 35);
    this.player.armor = Math.min(this.player.maxArmor, this.player.armor + 28);
    this.triggerRadioComms('firstGloryKill', true);
    this.showCallout('GLORY KILL · +35 HP · +28 ARMOR', '#ff9f43', 1.3);
    this.emitHudSnapshot(true);
  }

  // CoD 5-Killstreak Carpet-Bomb Airstrike (`X`)
  private callAirstrike(): void {
    if (!this.airstrikeReady || this.phase !== 'playing' || !this.player.alive) return;
    this.airstrikeReady = false;
    this.killstreak = 0;

    // Raycast forward to pick carpet-bomb corridor center
    this.camera.getWorldDirection(this._v1);
    this.raycaster.set(this.camera.position, this._v1);
    this.raycaster.far = 55;
    const hits = this.raycaster.intersectObjects(this.worldHitMeshes, false);
    const center =
      hits.length > 0
        ? hits[0].point.clone()
        : this.camera.position.clone().addScaledVector(this._v1, 24);
    center.y = 0.08;

    this.audio.playAirstrikeRadio();
    this.audio.playJetFlyby(0.95);
    this.triggerRadioComms('airstrike', false);
    this.showAlert('공중 융단 폭격 요청 확인 — 네이팜 · 고폭탄 투하 개시', 4.0);

    const dirXZ = new THREE.Vector3(this._v1.x, 0, this._v1.z).normalize();
    for (let i = -2; i <= 2; i++) {
      const bx = Math.max(-ARENA_HALF_SIZE + 4, Math.min(ARENA_HALF_SIZE - 4, center.x + dirXZ.x * i * 6.5 + (Math.random() - 0.5) * 3));
      const bz = Math.max(-ARENA_HALF_SIZE + 4, Math.min(ARENA_HALF_SIZE - 4, center.z + dirXZ.z * i * 6.5 + (Math.random() - 0.5) * 3));
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.5, 5.2, 24),
        new THREE.MeshBasicMaterial({
          color: 0xffa629,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.6,
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(bx, 0.08, bz);
      this.scene.add(ring);
      this.artilleryStrikes.push({
        x: bx,
        z: bz,
        timer: 1.15 + (i + 2) * 0.28,
        maxTimer: 1.15 + (i + 2) * 0.28,
        ring,
        isAirstrike: true,
      });
    }
    this.emitHudSnapshot(true);
  }

  private callArtilleryBarrage(): void {
    this.showAlert('⚠ 경고: 장거리 포격 낙하 임박 — 경고 링 회피 ⚠', 3.6);
    this.audio.playArtilleryWhistle();
    const count = 2 + Math.min(2, Math.floor(this.wave / 2));
    for (let i = 0; i < count; i++) {
      const ax = (Math.random() - 0.5) * (ARENA_HALF_SIZE * 1.4);
      const az = (Math.random() - 0.5) * (ARENA_HALF_SIZE * 1.4);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.45, 5.5, 24),
        new THREE.MeshBasicMaterial({
          color: 0xff1e2d,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.55,
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(ax, 0.08, az);
      this.scene.add(ring);
      const dur = 1.75 + i * 0.55;
      this.artilleryStrikes.push({
        x: ax,
        z: az,
        timer: dur,
        maxTimer: dur,
        ring,
        isAirstrike: false,
      });
    }
  }

  private spawnDropship(): void {
    if (this.dropship && this.dropship.alive) return;
    const mesh = buildDropshipModel();
    const hitBox = new THREE.Mesh(
      new THREE.BoxGeometry(7.2, 3.0, 9.0),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    mesh.add(hitBox);

    const startX = (Math.random() > 0.5 ? 1 : -1) * 70;
    const startZ = -48 + Math.random() * 20;
    const targetX = (Math.random() - 0.5) * 32;
    const targetZ = -18 + Math.random() * 14;

    mesh.position.set(startX, 17, startZ);
    this.scene.add(mesh);

    const ds: ActiveDropship = {
      mesh,
      hitBox,
      pos: mesh.position.clone(),
      targetPos: new THREE.Vector3(targetX, 11.5, targetZ),
      state: 'inbound',
      timer: 2.2,
      hp: 190,
      maxHp: 190,
      vel: new THREE.Vector3(),
      deployed: false,
      alive: true,
    };
    hitBox.userData = { dropship: ds };
    this.dropship = ds;
    this.rebuildHitMeshCache();
    this.showAlert('✈ 에이펙스 로봇 드롭쉽 상공 진입 — 로켓으로 격추 가능!', 4.2);
  }

  // =========================================================================
  // WEAPON FIRING, RELOAD & EMP/FRAG GRENADE
  // =========================================================================
  private firePlayerWeapon(): void {
    if (
      this.vatsActive ||
      this.cinematic.isCutsceneActive() ||
      this.isAc130Active() ||
      this.isFirstPersonSetpieceActive() ||
      this.platingTimer > 0 ||
      this.player.reloadTimer > 0 ||
      this.player.fireCd > 0
    ) {
      return;
    }
    const w = WEAPONS[this.player.wpnIdx];
    const att = getWeaponAttachmentSpec(this.weaponAttachment);
    if (this.player.ammo[this.player.wpnIdx] <= 0) {
      this.startReload();
      return;
    }

    this.player.ammo[this.player.wpnIdx]--;
    this.analytics.shotsFired++;
    this.player.fireCd = w.fireRate;
    // MWIII Mounted stability (-68% recoil) × Gunsmith Attachment modifier
    const mountRecoilMult = (this.mounted ? 0.32 : 1.0) * att.recoilMult;
    this.player.recoilPitch += w.recoil * (this.player.ads ? 0.62 : 1.0) * mountRecoilMult;
    const adsDamp = (this.player.ads ? 0.58 : 1.0) * (this.mounted ? 0.4 : 1.0);
    this.player.vmKickZ = Math.min(
      0.26,
      this.player.vmKickZ + (w.id === 0 ? 0.08 : w.id === 4 ? 0.024 : 0.21) * adsDamp
    );
    this.player.vmRecoilPitch = Math.min(
      0.34,
      this.player.vmRecoilPitch + (w.id === 0 ? 0.085 : w.id === 4 ? 0.018 : 0.24) * adsDamp
    );
    this.player.vmRecoilRoll = Math.max(
      -0.16,
      Math.min(
        0.16,
        this.player.vmRecoilRoll +
          (Math.random() - 0.45) * (w.id === 0 ? 0.055 : w.id === 4 ? 0.012 : 0.14) * adsDamp
      )
    );
    this.fovKick = Math.max(this.fovKick, w.id === 1 ? 3.8 : w.id === 2 || w.id === 3 ? 4.8 : 0.9);
    this.player.muzzleTimer = w.id === 4 ? 0.085 : 0.06;
    this.shake = Math.max(this.shake, w.shake * (this.mounted ? 0.52 : 1.0));

    this.audio.playWeapon(w.sound, 1.0, { isIndoors: this.isIndoors, distanceM: 0 });
    if (w.ejectShell) {
      this.ejectBrassShell();
    }

    const origin = this.camera.position.clone();
    const baseDir = new THREE.Vector3();
    this.camera.getWorldDirection(baseDir);
    const muzzlePos = new THREE.Vector3(this.player.ads ? 0 : 0.22, -0.14, -0.84).applyMatrix4(
      this.camera.matrixWorld
    );
    // Cordite barrel gunsmoke wisps rising after ballistic shots
    if (w.id === 0 || w.id === 1 || w.id === 3) {
      this.vfx.spawnGunsmoke(muzzlePos, baseDir);
    }

    // [4] HYDRA-7 Guided 3D Missile Launcher
    if (w.projectile === 'rocket') {
      const rMesh = VolumetricVfxSystem.buildMissileMesh();
      rMesh.position.copy(muzzlePos);
      rMesh.lookAt(muzzlePos.clone().add(baseDir));
      this.scene.add(rMesh);
      this.rockets.push({
        mesh: rMesh,
        pos: muzzlePos.clone(),
        dir: baseDir.clone(),
        speed: 48,
        life: 4.0,
      });
      if (this.player.ammo[this.player.wpnIdx] <= 0) this.startReload();
      return;
    }

    // [5] INFERNO-X Napalm Flamethrower
    if (w.projectile === 'flame') {
      for (let f = 0; f < 2; f++) {
        const fDir = baseDir.clone();
        fDir.x += (Math.random() - 0.5) * 0.14;
        fDir.y += (Math.random() - 0.5) * 0.1;
        fDir.z += (Math.random() - 0.5) * 0.14;
        fDir.normalize();
        const mesh = new THREE.Mesh(
          this.sharedBoxGeo,
          f === 0 ? this.matCache.fire : this.matCache.spark
        );
        mesh.scale.setScalar(0.28);
        mesh.position.copy(muzzlePos);
        this.scene.add(mesh);
        this.flames.push({
          mesh,
          pos: muzzlePos.clone(),
          vel: fDir.multiplyScalar(22 + Math.random() * 6),
          life: 0.48,
          maxLife: 0.48,
        });
      }
      if (this.player.ammo[this.player.wpnIdx] <= 0) this.startReload();
      return;
    }

    // [6] ZEUS-MK7 Chain Arc Tesla Cannon (3-hop volumetric chain lightning + EMP stun)
    if (w.chainLightning) {
      const styleMult = computeStyleRank(this.comboCount, this.styleScore).damageMult;
      const dmgMult = styleMult * (this.overdriveTimer > 0 ? 1.4 : 1.0);
      const baseDmg = Math.round(w.dmg * dmgMult);

      this.raycaster.set(origin, baseDir);
      this.raycaster.far = 48;
      const worldHits = this.raycaster.intersectObjects(this.worldHitMeshes, false);
      const maxDist = worldHits.length > 0 ? worldHits[0].distance : 48;
      const enemyHits = this.raycaster.intersectObjects(this.enemyHitMeshes, false);
      let hitPos = origin.clone().addScaledVector(baseDir, maxDist);

      if (enemyHits.length > 0 && enemyHits[0].distance < maxDist) {
        const eh = enemyHits[0];
        hitPos = eh.point.clone();
        this.vfx.spawnLightningArc(muzzlePos, hitPos, 0x38e8ff, 0.24);
        if (eh.object.userData.dropship) {
          this.damageDropship(baseDmg, Faction.PLAYER);
        } else {
          const primary = eh.object.userData.unit as ActiveUnit | undefined;
          if (primary && primary.alive) {
            if (!primary.isBoss && primary.stunImmuneTimer <= 0) {
              primary.empStunTimer = Math.max(primary.empStunTimer, 0.72);
              primary.stunImmuneTimer = 2.8;
            }
            this.damageUnit(
              primary,
              baseDmg,
              eh.object.userData.part as BodyPart,
              hitPos,
              baseDir,
              Faction.PLAYER,
              FACTION_META[Faction.PLAYER].name,
              '테슬라 아크 감전'
            );

            // Chain jump up to 2 nearby enemies within 11.5m
            const visited = new Set<number>([primary.id]);
            let prevPos = hitPos.clone();
            for (let hop = 0; hop < 2; hop++) {
              let bestNext: ActiveUnit | null = null;
              let bestDist = 11.5;
              for (const cand of this.units) {
                if (!cand.alive || visited.has(cand.id)) continue;
                const cd = Math.hypot(cand.x - prevPos.x, cand.z - prevPos.z);
                if (cd < bestDist) {
                  bestDist = cd;
                  bestNext = cand;
                }
              }
              if (!bestNext) break;
              visited.add(bestNext.id);
              const nextPos = new THREE.Vector3(bestNext.x, 1.3 * bestNext.scale, bestNext.z);
              this.vfx.spawnLightningArc(prevPos, nextPos, 0x7dd3fc, 0.26);
              if (!bestNext.isBoss && bestNext.stunImmuneTimer <= 0) {
                bestNext.empStunTimer = Math.max(bestNext.empStunTimer, 0.55);
                bestNext.stunImmuneTimer = 2.8;
              }
              this.damageUnit(
                bestNext,
                Math.round(baseDmg * 0.72),
                'torso',
                nextPos,
                nextPos.clone().sub(prevPos).normalize(),
                Faction.PLAYER,
                FACTION_META[Faction.PLAYER].name,
                '연쇄 번개 과부하'
              );
              prevPos = nextPos;
            }
          }
        }
      } else {
        this.vfx.spawnLightningArc(muzzlePos, hitPos, 0x38e8ff, 0.2);
        if (worldHits.length > 0) {
          const wh = worldHits[0];
          const ud = wh.object.userData;
          if (ud.relay && (ud.relay as RelayPylonEntity).alive) {
            this.damageRelay(ud.relay as RelayPylonEntity, baseDmg, wh.point, Faction.PLAYER);
          } else if (ud.isServerCore) {
            this.damageServerCore(baseDmg, wh.point, Faction.PLAYER);
          } else {
            this.vfx.spawnSparkBurst(wh.point, new THREE.Vector3(0, 1, 0), 8, 0x38e8ff, 8);
          }
        }
      }
      if (this.player.ammo[this.player.wpnIdx] <= 0) this.startReload();
      return;
    }

    // Hitscan weapons ([1] Rifle, [2] Shotgun, [3] Railgun)
    const hitscanDmg = Math.round(w.dmg * this.getDamageBoostMultiplier());
    const spread =
      (this.player.ads
        ? w.adsSpread * (this.holdingBreath ? 0.45 : 1.0) * (this.mounted ? 0.52 : 1.0)
        : w.spread) * att.spreadMult;
    for (let p = 0; p < w.pellets; p++) {
      const dir = baseDir.clone();
      dir.x += (Math.random() - 0.5) * spread * 2;
      dir.y += (Math.random() - 0.5) * spread * 2;
      dir.z += (Math.random() - 0.5) * spread * 2;
      dir.normalize();

      this.raycaster.set(origin, dir);
      this.raycaster.far = 145;

      const worldHits = this.raycaster.intersectObjects(this.worldHitMeshes, false);
      const maxDist = worldHits.length > 0 ? worldHits[0].distance : 145;
      let endPoint = origin.clone().addScaledVector(dir, maxDist);

      const enemyHits = this.raycaster.intersectObjects(this.enemyHitMeshes, false);

      if (w.pierce) {
        const hitIds = new Set<number>();
        for (const eh of enemyHits) {
          if (eh.distance > maxDist) break;
          if (eh.object.userData.dropship) {
            this.damageDropship(w.dmg, Faction.PLAYER);
            continue;
          }
          const u = eh.object.userData.unit as ActiveUnit | undefined;
          if (!u || !u.alive || hitIds.has(u.id)) continue;
          hitIds.add(u.id);
          this.damageUnit(
            u,
            hitscanDmg,
            eh.object.userData.part as BodyPart,
            eh.point,
            dir,
            Faction.PLAYER,
            FACTION_META[Faction.PLAYER].name,
            '레일건 관통'
          );
        }
        if (worldHits.length > 0 && worldHits[0].object.userData.relay) {
          this.damageRelay(
            worldHits[0].object.userData.relay as RelayPylonEntity,
            hitscanDmg,
            worldHits[0].point,
            Faction.PLAYER
          );
        } else if (worldHits.length > 0 && worldHits[0].object.userData.isServerCore) {
          this.damageServerCore(hitscanDmg, worldHits[0].point, Faction.PLAYER);
        }
      } else if (enemyHits.length > 0 && enemyHits[0].distance < maxDist) {
        const eh = enemyHits[0];
        endPoint = eh.point;
        if (eh.object.userData.dropship) {
          this.damageDropship(hitscanDmg, Faction.PLAYER);
        } else {
          const u = eh.object.userData.unit as ActiveUnit | undefined;
          if (u && u.alive) {
            this.damageUnit(
              u,
              hitscanDmg,
              eh.object.userData.part as BodyPart,
              eh.point,
              dir,
              Faction.PLAYER,
              FACTION_META[Faction.PLAYER].name,
              w.id === 1 ? '산탄 분쇄' : '사살'
            );
          }
        }
      } else if (worldHits.length > 0) {
        const wh = worldHits[0];
        const ud = wh.object.userData;
        if (ud.relay && (ud.relay as RelayPylonEntity).alive) {
          this.damageRelay(ud.relay as RelayPylonEntity, hitscanDmg, wh.point, Faction.PLAYER);
        } else if (ud.isServerCore) {
          this.damageServerCore(hitscanDmg, wh.point, Faction.PLAYER);
        } else if (ud.barrel && ud.barrel.alive) {
          ud.barrel.hp -= hitscanDmg;
          this.vfx.spawnSparkBurst(wh.point, new THREE.Vector3(0, 1, 0), 8, 0xffaa33, 8);
          if (ud.barrel.hp <= 0) {
            ud.barrel.alive = false;
            ud.barrel.collider.alive = false;
            this.scene.remove(ud.barrel.mesh);
            const wi = this.worldHitMeshes.indexOf(ud.barrel.mesh);
            if (wi !== -1) this.worldHitMeshes.splice(wi, 1);
            this.triggerExplosion(
              new THREE.Vector3(ud.barrel.x, 0.8, ud.barrel.z),
              10.5,
              180,
              Faction.PLAYER,
              '플라즈마 드럼통',
              { tag: '드럼통 폭사' }
            );
          }
        } else if (ud.collider && ud.collider.destructible && ud.collider.alive) {
          ud.collider.hp -= w.dmg;
          this.spawnParticles(wh.point, 'concrete', 7, 5);
          if (ud.collider.hp <= 0) this.destroyCrate(ud.collider, origin);
        } else if (wh.face) {
          const norm = wh.face.normal.clone().transformDirection(wh.object.matrixWorld).normalize();
          this.spawnDecal(wh.point, norm, 'bullet', w.id === 1 ? 0.24 : 0.28);
          const surface = wh.object.userData?.surface as 'concrete' | 'metal' | undefined;
          if (surface === 'metal') {
            // Sharp metallic ricochet sparks off K-808 armor, sedans, steel shutters & AC units
            this.vfx.spawnSparkBurst(wh.point, norm, w.id === 1 ? 5 : 10, 0xffd268, 9.5);
          } else {
            // Pulverized concrete dust puff + tumbling masonry chips on walls/curbs/sandbags
            this.vfx.spawnConcreteImpact(wh.point, norm);
            this.vfx.spawnSparkBurst(wh.point, norm, 2, 0xffc864, 5.5);
          }
        }
      }

      if (w.pierce || Math.random() < 0.82) {
        this.spawnTracer(
          muzzlePos,
          endPoint,
          w.colorHex,
          w.pierce ? 0.36 : 0.095,
          w.pierce ? 'railgun' : 'bullet'
        );
      }
    }

    if (this.player.ammo[this.player.wpnIdx] <= 0) this.startReload();
  }

  private startReload(): void {
    const w = WEAPONS[this.player.wpnIdx];
    const effMag = this.getEffectiveMag(this.player.wpnIdx);
    const currentAmmo = this.player.ammo[this.player.wpnIdx];
    if (this.player.reloadTimer > 0 || this.platingTimer > 0 || currentAmmo >= effMag) return;
    const timing = computeReloadTiming(w.reload, currentAmmo, effMag);
    this.player.reloadTimer = timing.durationSec;
    this.player.reloadDur = timing.durationSec;
    this.player.reloadIsTactical = timing.isTactical;
    this.audio.playReload(timing.durationSec, w.id, timing.isTactical);
    // DOOM-99 twin-barrel shotgun ejects 1 spent shell on tactical top-off, 2 on empty reload
    if (w.id === 1) {
      this.ejectBrassShell();
      if (!timing.isTactical) this.ejectBrassShell();
    }
    this.emitHudSnapshot(true);
  }

  private throwGrenade(): void {
    if (this.player.grenades <= 0 || this.phase !== 'playing' || !this.player.alive) return;
    this.player.grenades--;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 10, 8),
      new THREE.MeshStandardMaterial({
        color: 0x164e63,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.7,
        roughness: 0.4,
      })
    );
    const pos = this.camera.position.clone().addScaledVector(dir, 0.85);
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.grenades.push({
      mesh,
      pos,
      vx: dir.x * 21,
      vy: dir.y * 16 + 5.6,
      vz: dir.z * 21,
      fuse: 1.45,
    });
    this.emitHudSnapshot(true);
  }

  // =========================================================================
  // 3-WAY FACTION AI WITH DISTINCT ARCHETYPE POLICIES
  // =========================================================================
  private hasLineOfSight3D(p1: THREE.Vector3, p2: THREE.Vector3): boolean {
    this._v1.subVectors(p2, p1);
    const dist = this._v1.length();
    if (dist < 0.5) return true;
    this.aiRay.set(p1, this._v1.normalize());
    this.aiRay.far = dist - 0.45;
    return this.aiRay.intersectObjects(this.worldHitMeshes, false).length === 0;
  }

  private isConcealedBySmoke(x: number, z: number): boolean {
    for (let i = 0; i < this.activeSmokeZones.length; i++) {
      const sz = this.activeSmokeZones[i];
      if (Math.hypot(x - sz.x, z - sz.z) <= sz.r) return true;
    }
    return false;
  }

  private updateEnemies(dt: number): void {
    // Decay active tactical smoke zones
    for (let i = this.activeSmokeZones.length - 1; i >= 0; i--) {
      this.activeSmokeZones[i].timer -= dt;
      if (this.activeSmokeZones[i].timer <= 0) this.activeSmokeZones.splice(i, 1);
    }
    // Sliding 0.45s Attack Token Window (prevents burst spike where 6 enemies shoot in 0.08s)
    const nowTime = this.time;
    this.enemyShotTimestamps = this.enemyShotTimestamps.filter((ts) => nowTime - ts < 0.45);
    const threatSt = computeThreatState(this.threatPoints);
    const bal = computeSpawnBalance(this.wave, this.relaysDestroyed, this.coreShieldDown, threatSt.level);
    const MAX_CONCURRENT_PLAYER_ATTACKERS = bal.maxConcurrentAttackers;
    const playerInSmoke = this.isConcealedBySmoke(this.player.x, this.player.z);
    const playerHorizSpd = Math.hypot(this.player.vx, this.player.vz);
    const animDamp = 1 - Math.exp(-10 * dt);

    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (!u.alive) {
        this.units.splice(i, 1);
        continue;
      }
      if (u.stunImmuneTimer > 0) u.stunImmuneTimer = Math.max(0, u.stunImmuneTimer - dt);

      // Hit flash, flinch stagger & weapon fire recoil decay
      u.hitFlinch *= Math.exp(-8.5 * dt);
      u.fireRecoil *= Math.exp(-11.0 * dt);
      if (u.hitFlash > 0) {
        u.hitFlash -= dt;
        const em = u.hitFlash > 0 ? 0x661111 : 0x000000;
        for (const m of u.rig.mats) m.emissive.setHex(em);
      }

      // Napalm burning DoT + robot overheat short-circuit
      if (u.burnTimer > 0) {
        u.burnTimer -= dt;
        u.hp -= (u.isRobot ? 26 : 18) * dt;
        if (Math.random() < 0.35) {
          this.spawnParticles(
            new THREE.Vector3(u.x, 1.15 * u.scale, u.z),
            u.isRobot ? 'spark' : 'fire',
            1,
            3.2
          );
        }
        if (u.hp <= 0) {
          this.damageUnit(
            u,
            10,
            'torso',
            new THREE.Vector3(u.x, 1.1, u.z),
            new THREE.Vector3(0, 1, 0),
            Faction.PLAYER,
            FACTION_META[Faction.PLAYER].name,
            u.isRobot ? '과열 합선 폭발' : '네이팜 소각'
          );
          continue;
        }
      }

      // EMP Stun (Machines paralyzed for 3s)
      if (u.empStunTimer > 0) {
        u.empStunTimer -= dt;
        if (u.rig.parts.torso) {
          u.rig.parts.torso.rotation.z = Math.sin(this.time * 42) * 0.16;
        }
        if (Math.random() < 0.32) {
          this.spawnParticles(new THREE.Vector3(u.x, 1.2 * u.scale, u.z), 'emp', 1, 4.0);
        }
        continue;
      }

      // Stagger from dismemberment
      if (u.staggerTimer > 0) {
        u.staggerTimer -= dt;
        if (u.rig.parts.torso) {
          u.rig.parts.torso.rotation.z = Math.sin(this.time * 24) * 0.24;
        }
        if (Math.random() < 0.22) {
          this.spawnParticles(
            new THREE.Vector3(u.x, 1.2 * u.scale, u.z),
            u.isRobot ? 'spark' : 'blood',
            1,
            2.4
          );
        }
        continue;
      } else if (u.rig.parts.torso) {
        u.rig.parts.torso.rotation.z = 0;
      }

      // Spin Titan gatling or Stalker sawblade
      if (u.rig.gatlingBarrel) u.rig.gatlingBarrel.rotation.z += dt * 12;
      if (u.rig.sawBlade) u.rig.sawBlade.rotation.y += dt * 18;

      // Pick nearest rival target (3-Way Faction War!)
      let target: { x: number; y: number; z: number; isPlayer: boolean; unit?: ActiveUnit } | null = null;
      let bestD = Infinity;

      if (this.phase === 'playing' && this.player.alive && !this.isAc130Active()) {
        const dp = Math.hypot(this.player.x - u.x, this.player.z - u.z);
        target = { x: this.player.x, y: this.player.y - 0.3, z: this.player.z, isPlayer: true };
        bestD = dp * 1.08;
      }
      // During AC-130 FLIR support, hostiles engage the advancing ground squad!
      if (this.isAc130Active()) {
        for (const sq of this.squadmates) {
          if (!sq.active || sq.status !== 'active') continue;
          const ds = Math.hypot(sq.x - u.x, sq.z - u.z);
          if (ds < bestD) {
            bestD = ds;
            target = { x: sq.x, y: sq.y + 1.2, z: sq.z, isPlayer: false };
          }
        }
      }
      // 3-Way Faction Civil War is exclusive to Free Roam Sandbox; in Campaign Missions 1-4 all hostiles unite against ROK Alpha Squad!
      if (this.gameMode === 'freeroam') {
        for (let j = 0; j < this.units.length; j++) {
          const o = this.units[j];
          if (!o.alive || o.faction === u.faction) continue;
          const d = Math.hypot(o.x - u.x, o.z - u.z);
          if (d < bestD) {
            bestD = d;
            target = { x: o.x, y: 1.2 * o.scale, z: o.z, isPlayer: false, unit: o };
          }
        }
      }

      if (!target) continue;

      const dx = target.x - u.x;
      const dz = target.z - u.z;
      const d = Math.hypot(dx, dz) || 1;
      const desiredYaw = Math.atan2(dx, dz);
      const diff = Math.atan2(Math.sin(desiredYaw - u.yaw), Math.cos(desiredYaw - u.yaw));
      u.yaw += diff * Math.min(1, dt * 8.5);
      u.rig.root.rotation.y = u.yaw;

      const eyePos = new THREE.Vector3(u.x, u.y + 1.42 * u.scale, u.z);
      const tgtPos = new THREE.Vector3(target.x, target.y, target.z);
      const canSee = d < 44 && this.hasLineOfSight3D(eyePos, tgtPos);

      u.strafeCd -= dt;
      if (u.strafeCd <= 0) {
        u.strafeCd = 1.1 + Math.random() * 1.9;
        u.strafeDir = -u.strafeDir;
      }

      // Distinct movement policies per archetype
      let mx = 0;
      let mz = 0;
      if (u.archetype === UnitArchetype.RAIDER_BERSERKER || u.archetype === UnitArchetype.ROBOT_STALKER) {
        // Aggressive Rusher / Stalker Drone: charges straight in with flanking weave
        mx = dx / d + (-dz / d) * 0.32 * u.strafeDir;
        mz = dz / d + (dx / d) * 0.32 * u.strafeDir;
      } else if (u.archetype === UnitArchetype.SYNDICATE_COMMANDO) {
        // Tactical Flanker / Kiter: maintains mid-range and strafes sideways
        if (!canSee || d > 19) {
          mx = dx / d + (-dz / d) * 0.65 * u.strafeDir;
          mz = dz / d + (dx / d) * 0.65 * u.strafeDir;
        } else if (d < 10) {
          mx = -dx / d + (-dz / d) * 0.8 * u.strafeDir;
          mz = -dz / d + (dx / d) * 0.8 * u.strafeDir;
        } else {
          mx = (-dz / d) * 0.9 * u.strafeDir;
          mz = (dx / d) * 0.9 * u.strafeDir;
        }
      } else if (u.archetype === UnitArchetype.SYNDICATE_HEAVY || u.isBoss) {
        // Slow Suppression Juggernaut: advances steadily while laying down fire
        if (!canSee || d > 14) {
          mx = dx / d;
          mz = dz / d;
        } else {
          mx = (-dz / d) * 0.35 * u.strafeDir;
          mz = (dx / d) * 0.35 * u.strafeDir;
        }
      } else {
        // Standard rifle/enforcer skirmisher
        const ideal = u.faction === Faction.RAIDER ? 11 : 16;
        if (!canSee || d > ideal) {
          mx = dx / d;
          mz = dz / d;
          if (!canSee) {
            mx += (-dz / d) * 0.7 * u.strafeDir;
            mz += (dx / d) * 0.7 * u.strafeDir;
          }
        } else {
          mx = (-dz / d) * 0.75 * u.strafeDir;
          mz = (dx / d) * 0.75 * u.strafeDir;
        }
      }

      // Separation steering between units
      for (let j = 0; j < this.units.length; j++) {
        if (i === j || !this.units[j].alive) continue;
        const sx = u.x - this.units[j].x;
        const sz = u.z - this.units[j].z;
        const sd = Math.hypot(sx, sz);
        if (sd > 0.01 && sd < u.r + this.units[j].r + 0.55) {
          mx += sx / sd;
          mz += sz / sd;
        }
      }

      const ml = Math.hypot(mx, mz) || 1;
      // Keep elevated 2F balcony snipers perched cleanly on their overlook!
      const moveSpeed = u.y > 1.0 ? 0 : u.burnTimer > 0 ? u.speed * 0.75 : u.speed;
      if (moveSpeed > 0) {
        u.x += (mx / ml) * moveSpeed * dt;
        u.z += (mz / ml) * moveSpeed * dt;
        // Maintain clean first-person camera standoff so melee rushers never clip through the viewmodel
        const pdx = u.x - this.player.x;
        const pdz = u.z - this.player.z;
        const pDist = Math.hypot(pdx, pdz);
        const minStand = u.r + 1.45;
        if (pDist > 0.001 && pDist < minStand && Math.abs(u.y - (this.player.y - 1.7)) < 1.8) {
          u.x = this.player.x + (pdx / pDist) * minStand;
          u.z = this.player.z + (pdz / pDist) * minStand;
        }
        resolveXZCollision(u, u.r, this.colliders, ARENA_HALF_SIZE, u.y);
      }

      // Articulated robot locomotion: hover drone banking vs biped stride, hip bob, torso counter-twist, flinch & firing recoil
      if (u.archetype === UnitArchetype.ROBOT_STALKER) {
        const hoverY = u.y + Math.sin(this.time * 5.2 + u.id) * 0.24 + 0.08;
        u.rig.root.position.set(u.x, hoverY, u.z);
        const targetBank = -u.strafeDir * 0.24 + Math.sin(this.time * 3.1 + u.id) * 0.06;
        const targetPitch = 0.22 - u.hitFlinch * 0.42;
        u.rig.root.rotation.z += (targetBank - u.rig.root.rotation.z) * animDamp;
        u.rig.root.rotation.x += (targetPitch - u.rig.root.rotation.x) * animDamp;
      } else {
        // Fluid 2-bone human/mech articulated stride, knee bend, tactical rifle-shoulder stance & breathing idle!
        const moving = moveSpeed > 0.1;
        if (moving) {
          u.walkPhase += dt * moveSpeed * (u.isBoss ? 1.4 : 2.1);
        }
        const stride = moving ? Math.sin(u.walkPhase) : 0;
        const cosStride = moving ? Math.cos(u.walkPhase) : 1;
        const breath = Math.sin(this.time * 2.4 + u.id * 1.7);
        const hipBob = moving
          ? Math.abs(cosStride) * (u.isBoss ? 0.055 : 0.075) * u.scale
          : breath * 0.012 * u.scale;
        u.rig.root.position.set(u.x, u.y + hipBob, u.z);

        const forwardLean = (moving ? (u.isBoss ? 0.06 : 0.12) : 0.02) - u.hitFlinch * 0.34;
        const lateralRoll = stride * (u.isBoss ? 0.028 : 0.048);
        u.rig.root.rotation.x += (forwardLean - u.rig.root.rotation.x) * animDamp;
        u.rig.root.rotation.z += (lateralRoll - u.rig.root.rotation.z) * animDamp;

        const legAmp = u.isBoss ? 0.46 : 0.66;
        if (u.rig.parts.leftLeg) {
          u.rig.parts.leftLeg.rotation.x += (stride * legAmp - u.rig.parts.leftLeg.rotation.x) * animDamp;
        }
        if (u.rig.parts.rightLeg) {
          u.rig.parts.rightLeg.rotation.x += (-stride * legAmp - u.rig.parts.rightLeg.rotation.x) * animDamp;
        }
        // True 2-bone knee flexion on recovery leg swing (eliminates rigid wooden peg-leg look!)
        if (u.rig.knees?.left) {
          const lKneeTarget = moving ? 0.12 + Math.max(0, -cosStride) * 0.72 : 0.06;
          u.rig.knees.left.rotation.x += (lKneeTarget - u.rig.knees.left.rotation.x) * animDamp;
        }
        if (u.rig.knees?.right) {
          const rKneeTarget = moving ? 0.12 + Math.max(0, cosStride) * 0.72 : 0.06;
          u.rig.knees.right.rotation.x += (rKneeTarget - u.rig.knees.right.rotation.x) * animDamp;
        }
        if (u.rig.parts.torso) {
          const twistTarget = canSee ? -0.14 : -stride * 0.13;
          u.rig.parts.torso.rotation.y += (twistTarget - u.rig.parts.torso.rotation.y) * animDamp;
          u.rig.parts.torso.rotation.x += ((breath * 0.018 - u.hitFlinch * 0.2) - u.rig.parts.torso.rotation.x) * animDamp;
        }
        if (u.rig.parts.head) {
          const headYawTarget = canSee ? 0.12 : Math.sin(this.time * 1.1 + u.id) * 0.08;
          u.rig.parts.head.rotation.y += (headYawTarget - u.rig.parts.head.rotation.y) * animDamp;
        }
        if (u.rig.parts.leftArm) {
          const lArmTarget = canSee ? -0.58 - u.fireRecoil * 0.22 : -stride * 0.45 - 0.18;
          u.rig.parts.leftArm.rotation.x += (lArmTarget - u.hitFlinch * 0.32 - u.rig.parts.leftArm.rotation.x) * animDamp;
        }
        if (u.rig.elbows?.left) {
          const lElbTarget = canSee ? -0.82 : -0.42;
          u.rig.elbows.left.rotation.x += (lElbTarget - u.rig.elbows.left.rotation.x) * animDamp;
        }
        if (u.rig.parts.rightArm) {
          const rArmTarget = canSee ? -0.64 - u.fireRecoil * 0.42 : stride * 0.25 - 0.24;
          u.rig.parts.rightArm.rotation.x += (rArmTarget - u.hitFlinch * 0.25 - u.rig.parts.rightArm.rotation.x) * animDamp;
        }
        if (u.rig.elbows?.right) {
          const rElbTarget = canSee ? -0.88 - u.fireRecoil * 0.18 : -0.52;
          u.rig.elbows.right.rotation.x += (rElbTarget - u.rig.elbows.right.rotation.x) * animDamp;
        }
      }

      // Sniper Laser Telegraph (properly respects fireCd & breaks cleanly inside Tactical Smoke!)
      if (u.archetype === UnitArchetype.SYNDICATE_SNIPER && u.rig.sniperLaser) {
        if (u.fireCd > 0) {
          u.fireCd -= dt;
          u.sniperCharge = 0;
          u.rig.sniperLaser.visible = false;
          continue;
        }
        if (canSee && target.isPlayer && !playerInSmoke && d < 52 && !u.missing.rightArm) {
          if (u.sniperCharge === 0) {
            this.audio.playSniperLock();
            this.triggerRadioComms('sniperWarning', true);
          }
          u.sniperCharge += dt;
          u.rig.sniperLaser.visible = true;
          u.rig.sniperLaser.scale.set(1, 1, Math.min(48, d));
          const lMat = u.rig.sniperLaser.material as THREE.MeshBasicMaterial;
          lMat.opacity = 0.42 + Math.min(0.55, u.sniperCharge * 0.5);
          if (u.sniperCharge >= 1.28) {
            u.sniperCharge = 0;
            u.rig.sniperLaser.visible = false;
            u.fireCd = u.fireRate;
            const shotDir = tgtPos.clone().sub(eyePos).normalize();
            this.spawnTracer(eyePos, tgtPos.clone().addScaledVector(shotDir, 2), 0xff1e42, 0.24, 'railgun');
            this.audio.playWeapon('railgun', Math.max(0.22, (1 - d / 60) * 0.65), {
              isIndoors: false,
              distanceM: d,
            });
            const sniperEvade =
              this.player.dashTimer > 0.02 || this.player.slideTimer > 0.02
                ? 0.1
                : playerHorizSpd > 6.5
                  ? 0.42
                  : 0.68;
            if (Math.random() < sniperEvade) {
              this.damagePlayer(u.dmg, eyePos, u.name);
            }
          }
        } else {
          u.sniperCharge = 0;
          u.rig.sniperLaser.visible = false;
        }
        continue;
      }

      if (u.isBoss && u.bossPhase >= 2 && this.phase === 'playing' && this.player.alive) {
        u.bossMissileCd -= dt;
        if (u.bossMissileCd <= 0) {
          u.bossMissileCd = 5.8;
          this.audio.playArtilleryWhistle();
          for (let m = 0; m < 2; m++) {
            const mx2 = Math.max(
              -ARENA_HALF_SIZE + 4,
              Math.min(ARENA_HALF_SIZE - 4, this.player.x + (Math.random() - 0.5) * 7)
            );
            const mz2 = Math.max(
              -ARENA_HALF_SIZE + 4,
              Math.min(ARENA_HALF_SIZE - 4, this.player.z + (Math.random() - 0.5) * 7)
            );
            const ring = new THREE.Mesh(
              new THREE.RingGeometry(0.4, 4.4, 24),
              new THREE.MeshBasicMaterial({
                color: 0xff2244,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.65,
              })
            );
            ring.rotation.x = -Math.PI / 2;
            ring.position.set(mx2, 0.08, mz2);
            this.scene.add(ring);
            this.artilleryStrikes.push({
              x: mx2,
              z: mz2,
              timer: 1.5 + m * 0.35,
              maxTimer: 1.5 + m * 0.35,
              ring,
              isAirstrike: false,
            });
          }
        }
      }

      // Attack logic (time-windowed Attack Token Director + fair distance/movement/cover/smoke accuracy!)
      u.fireCd -= dt;
      const isMeleeRange = u.archetype === UnitArchetype.ROBOT_STALKER && d < 2.6;
      if (u.fireCd <= 0 && (canSee || isMeleeRange) && d < 42) {
        if (target.isPlayer && this.enemyShotTimestamps.length >= MAX_CONCURRENT_PLAYER_ATTACKERS) {
          u.fireCd = 0.28;
          continue;
        }
        if (target.isPlayer) this.enemyShotTimestamps.push(nowTime);

        u.fireRecoil = 1.0;
        u.fireCd = u.fireRate * (u.missing.rightArm ? 2.4 : 0.85 + Math.random() * 0.35);
        const dP = Math.hypot(u.x - this.player.x, u.z - this.player.z);
        if (dP < 50 && this.phase === 'playing') {
          this.audio.playWeapon(
            u.isRobot ? 'robot_laser' : u.archetype === UnitArchetype.RAIDER_BERSERKER ? 'shotgun' : 'rifle',
            Math.max(0.08, (1 - dP / 50) * 0.48),
            { isIndoors: this.isIndoors && dP < 14, distanceM: dP }
          );
        }

        const shotDir = tgtPos.clone().sub(eyePos).normalize();
        const acc = u.missing.rightArm ? 0.26 : playerInSmoke ? 0.34 : 0.085;
        shotDir.x += (Math.random() - 0.5) * acc;
        shotDir.y += (Math.random() - 0.5) * acc * 0.6;
        shotDir.z += (Math.random() - 0.5) * acc;
        shotDir.normalize();

        const endPt = eyePos.clone().addScaledVector(shotDir, Math.min(d + 2, 44));
        const tracerColor =
          u.faction === Faction.ROBOT
            ? 0xff1e42
            : u.faction === Faction.RAIDER
              ? 0xffaa33
              : 0x6ea8fe;
        this.spawnTracer(eyePos, endPt, tracerColor, 0.09, 'laser');

        let hitRoll = u.missing.rightArm ? 0.16 : 0.64;
        if (target.isPlayer) {
          const distAcc = Math.max(0.15, 0.44 - d * 0.0065);
          const moveMult =
            this.player.dashTimer > 0.02 || this.player.slideTimer > 0.02
              ? 0.22
              : playerHorizSpd > 6.5
                ? 0.74
                : 1.0;
          const coverMult = this.mounted ? 0.64 : 1.0;
          const smokeMult = playerInSmoke ? 0.1 : 1.0;
          hitRoll = (u.missing.rightArm ? 0.12 : distAcc) * moveMult * coverMult * smokeMult;
        }
        if (Math.random() < hitRoll) {
          if (target.isPlayer) {
            this.damagePlayer(u.dmg, eyePos, u.name);
          } else if (target.unit && target.unit.alive) {
            const pList: BodyPart[] = ['torso', 'torso', 'head', 'leftArm', 'rightArm'];
            const pHit = pList[Math.floor(Math.random() * pList.length)];
            this.damageUnit(
              target.unit,
              u.dmg * 1.55,
              pHit,
              tgtPos,
              shotDir,
              u.faction,
              u.name,
              u.isRobot ? '레이저 처형' : '교전 사살'
            );
          }
        }
      }
    }
  }

  // =========================================================================
  // MAIN SIMULATION & RENDER LOOP
  // =========================================================================
  private updateSimulation(rawDt: number): void {
    const clampedRealDt = Math.min(rawDt, 0.05);

    // Advance Cinematic Director timeline at true real-world speed (up to 0.25s/step)
    this.cinematic.update(Math.min(rawDt, 0.25));

    // Real-time Cutscene Mode (Opening / Breach / Dawn) — player invulnerable, camera rail active
    if (this.cinematic.isCutsceneActive() && this.phase === 'playing') {
      const seq = this.cinematic.getSequence();
      const cineDt = clampedRealDt * this.cinematic.getTimeScale();
      const pose = this.cinematic.getCameraPose();

      this.shake *= Math.pow(0.001, clampedRealDt);
      const shkX = (Math.random() - 0.5) * this.shake * 0.26;
      const shkY = (Math.random() - 0.5) * this.shake * 0.26;

      this.camera.position.set(pose.position.x + shkX, pose.position.y + shkY, pose.position.z);
      this.camera.lookAt(pose.lookAt.x, pose.lookAt.y, pose.lookAt.z);
      this.camera.rotation.z += pose.rollRad;
      this.camera.fov += (pose.fov - this.camera.fov) * Math.min(1, clampedRealDt * 12);
      this.camera.updateProjectionMatrix();

      this.viewmodel.pivot.visible = !pose.hideViewmodel;
      if (!pose.hideViewmodel) {
        const drawDrop = (1 - pose.weaponDrawProgress) * 0.34;
        this.viewmodel.pivot.position.set(0.24, -0.235 - drawDrop, -0.58);
        this.viewmodel.pivot.rotation.set(-drawDrop * 1.4, 0, 0);
        for (let i = 0; i < this.viewmodel.weapons.length; i++) {
          this.viewmodel.weapons[i].visible = i === this.player.wpnIdx;
        }
      }

      this.updateDropPods(cineDt);
      this.updateProjectilesAndPhysics(cineDt, clampedRealDt);
      this.updateAtmosphere(clampedRealDt);

      const mood: BgmMood =
        seq === 'dawn'
          ? 'dawn'
          : seq === 'symbiosis'
            ? 'symbiosis'
            : seq === 'ascension'
              ? 'ascension'
              : seq === 'choice'
                ? 'choice'
                : seq === 'breach' || seq === 'titan_drop'
                  ? 'breach'
                  : 'opening';
      this.audio.setDynamicState({
        playing: true,
        intensity: seq === 'breach' || seq === 'titan_drop' ? 1.0 : 0.25,
        bossActive: seq === 'breach' || seq === 'titan_drop',
        vatsActive: false,
        mood,
      });
      return;
    }

    // Handle brief dramatic beat before showing KIA modal
    if (!this.player.alive && this.phase === 'playing') {
      this.player.deathDelay -= clampedRealDt;
      this.camera.position.y = Math.max(0.45, this.camera.position.y - clampedRealDt * 2.2);
      this.camera.rotation.z = Math.min(0.45, this.camera.rotation.z + clampedRealDt * 0.9);
      if (this.player.deathDelay <= 0) {
        this.setPhase('gameover');
        this.emitHudSnapshot(true);
      }
      return;
    }

    // V.A.T.S. gauge & timeScale + Hitstop
    const vatsStep = stepVatsGauge(this.vatsEnergy, this.vatsActive, clampedRealDt);
    this.vatsEnergy = vatsStep.energy;
    if (this.vatsActive && !vatsStep.active) {
      this.exitVats();
      this.requestPointerLockSafe();
    }

    if (this.killCamTimer > 0) {
      this.killCamTimer = Math.max(0, this.killCamTimer - clampedRealDt);
      if (this.killCamTimer <= 0) this.killCamBanner = null;
    }
    if (this.adrenalineTimer > 0) {
      this.adrenalineTimer = Math.max(0, this.adrenalineTimer - clampedRealDt);
    }

    if (this.hitstop > 0) {
      this.hitstop -= clampedRealDt;
      this.timeScale = 0.06;
    } else if (this.breachSlowmoTimer > 0) {
      // Iconic Call of Duty 0.2x Slow-Mo Breach & Clear!
      this.timeScale += (0.22 - this.timeScale) * Math.min(1, clampedRealDt * 24);
    } else if (this.vatsActive) {
      this.timeScale += (VATS_TIME_SCALE - this.timeScale) * Math.min(1, clampedRealDt * 22);
    } else if (this.killCamTimer > 0) {
      this.timeScale += (0.28 - this.timeScale) * Math.min(1, clampedRealDt * 20);
    } else if (this.adrenalineTimer > 0) {
      this.timeScale += (0.38 - this.timeScale) * Math.min(1, clampedRealDt * 18);
    } else {
      this.timeScale += (1.0 - this.timeScale) * Math.min(1, clampedRealDt * 18);
    }

    const dt = clampedRealDt * this.timeScale;
    this.time += dt;

    // Combo decay, Overdrive buff, Supply Drop cooldown & Ghost-9 delayed radio intro
    if (this.comboTimer > 0) {
      this.comboTimer -= clampedRealDt;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
        this.styleScore = Math.max(0, this.styleScore - 50);
      }
    }
    if (this.styleScore > 0) {
      this.styleScore = Math.max(0, this.styleScore - clampedRealDt * 5.5);
    }
    if (this.overdriveTimer > 0) {
      this.overdriveTimer = Math.max(0, this.overdriveTimer - clampedRealDt);
    }
    if (this.supplyDropCd > 0) {
      this.supplyDropCd = Math.max(0, this.supplyDropCd - clampedRealDt);
    }
    if (this.ghostIntroTimer > 0 && !this.triggeredComms.has('ghostIntro')) {
      this.ghostIntroTimer -= dt;
      if (this.ghostIntroTimer <= 0) {
        this.triggerRadioComms('ghostIntro', true);
      }
    }

    if (this.alertTimer > 0) {
      this.alertTimer -= clampedRealDt;
      if (this.alertTimer <= 0) this.alertBanner = null;
    }
    if (this.calloutTimer > 0) {
      this.calloutTimer -= clampedRealDt;
      if (this.calloutTimer <= 0) this.calloutText = null;
    }

    // Decay active CoD combat medal popups
    for (let i = this.activeMedals.length - 1; i >= 0; i--) {
      this.activeMedals[i].life -= clampedRealDt;
      if (this.activeMedals[i].life <= 0) {
        this.activeMedals.splice(i, 1);
      }
    }

    // Player movement, ADS, recoil, viewmodel (skipped while driving K2-X Tank, orbiting AC-130, or in uncut vehicle setpieces)
    if (
      this.player.alive &&
      !this.isAc130Active() &&
      !this.isFirstPersonSetpieceActive() &&
      !this.tank.driving
    ) {
      if (this.player.invulnTimer > 0) this.player.invulnTimer -= clampedRealDt;
      this.player.ads = this.mouseRight && this.player.reloadTimer <= 0 && !this.vatsActive;
      if (this.player.ads !== this.prevAds) {
        this.prevAds = this.player.ads;
        this.audio.playAdsClick(this.player.ads);
      }
      const w = WEAPONS[this.player.wpnIdx];
      const hasOptic = w.id === 0 || w.id === 2 || w.id === 3 || w.id === 5;
      this.holdingBreath = this.player.ads && this.keys.has('ShiftLeft') && hasOptic;

      // Smooth 0..1 ADS optical alignment blend
      this.adsBlend += ((this.player.ads ? 1 : 0) - this.adsBlend) * Math.min(1, clampedRealDt * 18);
      if (this.adsBlend < 0.005) this.adsBlend = 0;
      else if (this.adsBlend > 0.995) this.adsBlend = 1;

      const fwd =
        (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
        (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
      const strafe = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
      const sprinting = this.keys.has('ShiftLeft') && fwd > 0 && !this.player.ads;
      this.player.sprinting = sprinting;

      // Cancel weapon inspect immediately on combat action
      if (this.player.ads || sprinting || this.mouseLeft || this.player.reloadTimer > 0) {
        this.inspectTimer = 0;
      } else if (this.inspectTimer > 0) {
        this.inspectTimer = Math.max(0, this.inspectTimer - clampedRealDt);
      }

      this.fovKick *= Math.pow(0.0005, clampedRealDt);
      if (this.fovKick < 0.04) this.fovKick = 0;
      const baseFov = this.vatsActive
        ? 62
        : this.player.ads
          ? w.adsFov
          : sprinting
            ? 81.5
            : 76;
      const targetFov = baseFov + this.fovKick;
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, clampedRealDt * 14);
      this.camera.updateProjectionMatrix();

      if (this.player.fireCd > 0) this.player.fireCd -= dt;
      if (this.player.equipTimer > 0) this.player.equipTimer = Math.max(0, this.player.equipTimer - clampedRealDt);
      if (this.player.reloadTimer > 0) {
        this.player.reloadTimer -= dt;
        if (this.player.reloadTimer <= 0) {
          this.player.ammo[this.player.wpnIdx] = this.getEffectiveMag(this.player.wpnIdx);
          this.player.reloadIsTactical = false;
        }
      }
      if (this.platingTimer > 0) {
        this.platingTimer -= clampedRealDt;
        if (this.platingTimer <= 0) {
          this.platingTimer = 0;
          this.player.armor = Math.min(this.player.maxArmor, this.player.armor + 45);
          this.audio.playMountClick(false);
          this.showCallout('방탄판 장착 완료 · +45 ARMOR', '#38d9ff', 1.6);
          this.emitHudSnapshot(true);
        }
      }

      if (this.player.grenades < 3) {
        this.player.nadeRegen += dt;
        if (this.player.nadeRegen > 13.5) {
          this.player.nadeRegen = 0;
          this.player.grenades++;
        }
      }

      // Keyboard yaw fallback (ArrowLeft / ArrowRight)
      const turnInput = (this.keys.has('ArrowLeft') ? 1 : 0) - (this.keys.has('ArrowRight') ? 1 : 0);
      if (turnInput !== 0 && !this.vatsActive) {
        this.player.yaw += turnInput * 2.1 * clampedRealDt;
      }

      const dashStep = stepDashCharges(
        this.player.dashCharges,
        this.player.dashRechargeTimer,
        clampedRealDt,
        DASH_MAX_CHARGES,
        DASH_RECHARGE_SEC
      );
      this.player.dashCharges = dashStep.charges;
      this.player.dashRechargeTimer = dashStep.rechargeTimer;
      if (this.player.dashTimer > 0) this.player.dashTimer = Math.max(0, this.player.dashTimer - clampedRealDt);
      if (this.player.slideTimer > 0) this.player.slideTimer = Math.max(0, this.player.slideTimer - clampedRealDt);

      const moveSpd = this.player.ads ? 4.8 : sprinting ? 11.4 : 7.9;

      const sinY = Math.sin(this.player.yaw);
      const cosY = Math.cos(this.player.yaw);
      let mx = -sinY * fwd + cosY * strafe;
      let mz = -cosY * fwd - sinY * strafe;
      const ml = Math.hypot(mx, mz);
      if (ml > 0) {
        mx /= ml;
        mz /= ml;
      }

      if (this.player.dashTimer > 0) {
        this.player.vx = this.player.dashDirX * 22.5;
        this.player.vz = this.player.dashDirZ * 22.5;
      } else if (this.player.slideTimer > 0) {
        const slideSpeed = 10.5 + (this.player.slideTimer / 0.54) * 7.5;
        this.player.vx = this.player.dashDirX * slideSpeed;
        this.player.vz = this.player.dashDirZ * slideSpeed;
      } else {
        this.player.vx += (mx * moveSpd - this.player.vx) * Math.min(1, dt * 13);
        this.player.vz += (mz * moveSpd - this.player.vz) * Math.min(1, dt * 13);
      }

      const wasInAir = !this.player.onGround;
      const prevVy = this.player.vy;
      this.player.vy -= 23 * dt;
      this.player.x += this.player.vx * dt;
      this.player.y += this.player.vy * dt;
      this.player.z += this.player.vz * dt;
      const eyeOffset = this.player.slideTimer > 0 ? 1.06 : 1.7;
      const prevFeetY = Math.max(0, this.player.y - eyeOffset);
      const floorY = this.getFloorHeightAt(this.player.x, this.player.z, prevFeetY);
      const targetEyeY = floorY + eyeOffset;
      const snapMargin = this.player.onGround ? 0.34 : 0.05;
      if (this.player.y <= targetEyeY + snapMargin && this.player.vy <= 0.1) {
        if (wasInAir && prevVy < -4.5) {
          this.player.landDip = Math.min(0.16, Math.abs(prevVy) * 0.015);
          this.audio.playFootstep(
            this.getFootstepSurfaceAt(this.player.x, this.player.z, floorY),
            true,
            this.isIndoors
          );
          this.stepDistAccum = 0;
        }
        this.player.y += (targetEyeY - this.player.y) * Math.min(1, clampedRealDt * 24);
        if (this.player.slideTimer <= 0 && Math.abs(this.player.y - targetEyeY) < 0.03) {
          this.player.y = targetEyeY;
        }
        this.player.vy = 0;
        this.player.onGround = true;
      } else if (this.player.y > targetEyeY + 0.38) {
        this.player.onGround = false;
      }
      resolveXZCollision(this.player, 0.55, this.colliders, ARENA_HALF_SIZE, floorY);

      // Pillar 3: Surface-Aware Military Boot Footsteps (Wet Asphalt / Hollow Metal Deck / Shattered Glass Rubble)
      const horizSpeed = Math.hypot(this.player.vx, this.player.vz);
      if (
        this.player.onGround &&
        this.player.slideTimer <= 0 &&
        this.player.dashTimer <= 0 &&
        horizSpeed > 1.35 &&
        !this.isAc130Active() &&
        !this.isFirstPersonSetpieceActive()
      ) {
        this.stepDistAccum += horizSpeed * dt;
        const stepStride = sprinting ? 2.55 : this.player.ads ? 1.85 : 2.15;
        if (this.stepDistAccum >= stepStride) {
          this.stepDistAccum -= stepStride;
          this.audio.playFootstep(
            this.getFootstepSurfaceAt(this.player.x, this.player.z, floorY),
            sprinting,
            this.isIndoors
          );
        }
      } else if (horizSpeed <= 0.4) {
        this.stepDistAccum = Math.min(this.stepDistAccum, 0.9);
      }

      // MWIII Tactical Gunplay: Q/E ADS Leaning, Auto Cover/Wall Mounting & Weapon Wall Collision
      const isReloading = this.player.reloadTimer > 0;
      const rawLean =
        this.player.ads && !this.vatsActive && !isReloading
          ? (this.keys.has('KeyE') ? 1 : 0) - (this.keys.has('KeyQ') ? 1 : 0)
          : 0;
      this.leanDir = rawLean as -1 | 0 | 1;
      this.leanBlend += (this.leanDir - this.leanBlend) * Math.min(1, clampedRealDt * 12);
      if (Math.abs(this.leanBlend) < 0.004) this.leanBlend = 0;

      // Forward horizontal & right vectors for cover/wall/lean raycasts
      const fwdX = -sinY;
      const fwdZ = -cosY;
      const rightX = cosY;
      const rightZ = -sinY;

      // Clamp lateral lean distance against walls so camera never clips into cover
      let leanOffset = this.leanBlend * 0.44;
      if (Math.abs(leanOffset) > 0.01) {
        const leanSign = leanOffset > 0 ? 1 : -1;
        this._v1.set(this.player.x, this.player.y - 0.08, this.player.z);
        this._v2.set(rightX * leanSign, 0, rightZ * leanSign);
        this.tacticalRay.set(this._v1, this._v2);
        this.tacticalRay.far = Math.abs(leanOffset) + 0.28;
        const leanHits = this.tacticalRay.intersectObjects(this.worldHitMeshes, false);
        if (leanHits.length > 0) {
          leanOffset = leanSign * Math.max(0, leanHits[0].distance - 0.28);
        }
      }

      // Forward eye-level wall proximity check (drives Weapon Wall Collision & prevents mounting blind walls)
      this._v1.set(this.player.x + rightX * leanOffset, this.player.y - 0.06, this.player.z + rightZ * leanOffset);
      this._v2.set(fwdX, 0, fwdZ);
      this.tacticalRay.set(this._v1, this._v2);
      this.tacticalRay.far = 1.25;
      const eyeWallHits = this.tacticalRay.intersectObjects(this.worldHitMeshes, false);
      const eyeWallDist = eyeWallHits.length > 0 ? eyeWallHits[0].distance : 99;

      // Auto Cover / Corner Mounting while ADS near waist-high cover (sandbags/parapet/vehicles) or wall edge
      let canMount = false;
      if (
        this.player.ads &&
        !sprinting &&
        !isReloading &&
        !this.vatsActive &&
        this.player.onGround &&
        this.player.slideTimer <= 0 &&
        this.player.dashTimer <= 0 &&
        eyeWallDist > 1.08
      ) {
        // 1) Over-cover mount check (waist-level forward probe hits sandbag/parapet/car while eye line is clear!)
        this._v1.set(this.player.x, floorY + 0.98, this.player.z);
        this._v2.set(fwdX, 0, fwdZ);
        this.tacticalRay.set(this._v1, this._v2);
        this.tacticalRay.far = 1.48;
        if (this.tacticalRay.intersectObjects(this.worldHitMeshes, false).length > 0) {
          canMount = true;
        } else {
          // 2) Corner-wall side mount check (adjacent left or right wall edge within 0.96m)
          for (const side of [-1, 1] as const) {
            this._v1.set(this.player.x, floorY + 1.42, this.player.z);
            this._v2.set(rightX * side, 0, rightZ * side);
            this.tacticalRay.set(this._v1, this._v2);
            this.tacticalRay.far = 0.96;
            if (this.tacticalRay.intersectObjects(this.worldHitMeshes, false).length > 0) {
              canMount = true;
              break;
            }
          }
        }
      }
      this.mounted = canMount;
      if (this.mounted !== this.prevMounted) {
        this.prevMounted = this.mounted;
        this.audio.playMountClick(this.mounted);
      }

      // Weapon Wall Collision: raise weapon barrel cleanly when pressing tight against solid walls
      const targetWallBlock =
        !isReloading && !this.mounted && eyeWallDist < 0.88
          ? Math.max(0, Math.min(1, (0.88 - eyeWallDist) / 0.44))
          : 0;
      this.wallBlockBlend += (targetWallBlock - this.wallBlockBlend) * Math.min(1, clampedRealDt * 16);
      if (this.wallBlockBlend < 0.005) this.wallBlockBlend = 0;
      this.wallBlocked = this.wallBlockBlend > 0.25;

      // Smooth landing dip recovery + subtle strafe, slide & Q/E peeking camera banking
      this.player.landDip *= Math.pow(0.0008, clampedRealDt);
      this.player.recoilPitch *= Math.pow(0.002, clampedRealDt);
      this.shake *= Math.pow(0.001, clampedRealDt);
      if (this.shake < 0.004) this.shake = 0;

      const shkX = (Math.random() - 0.5) * this.shake * 0.24;
      const shkY = (Math.random() - 0.5) * this.shake * 0.24;
      const shkRot = (Math.random() - 0.5) * this.shake * 0.075;
      const slideTilt = this.player.slideTimer > 0 ? -0.095 : 0;
      const leanTilt = -this.leanBlend * 0.155;
      const strafeTilt = -strafe * (this.player.ads ? 0.004 : 0.015) + slideTilt + leanTilt;

      this.camera.position.set(
        this.player.x + rightX * leanOffset + shkX,
        this.player.y - this.player.landDip - Math.abs(this.leanBlend) * 0.055 + shkY,
        this.player.z + rightZ * leanOffset
      );
      this.camera.rotation.y = this.player.yaw;
      this.camera.rotation.x = Math.max(-1.42, Math.min(1.42, this.player.pitch + this.player.recoilPitch));
      this.camera.rotation.z += (strafeTilt + shkRot - this.camera.rotation.z) * Math.min(1, clampedRealDt * 14);

      // Viewmodel animation: Figure-8 locomotion bob, exponential spring damping, multi-axis recoil & Tactical/Full reload
      const damp = (speed: number) => 1 - Math.exp(-speed * clampedRealDt);
      const movingOnGround = ml > 0.1 && this.player.onGround;
      this.player.vmBobBlend += ((movingOnGround ? 1 : 0) - this.player.vmBobBlend) * damp(10);
      if (movingOnGround) {
        this.player.vmBob += dt * (sprinting ? 11.4 : 8.2);
      }

      this.player.vmSwayX *= Math.exp(-11.5 * clampedRealDt);
      this.player.vmSwayY *= Math.exp(-11.5 * clampedRealDt);
      this.player.vmKickZ *= Math.exp(-14.5 * clampedRealDt);
      this.player.vmRecoilPitch *= Math.exp(-13.0 * clampedRealDt);
      this.player.vmRecoilRoll *= Math.exp(-11.0 * clampedRealDt);

      const breathScale = (this.holdingBreath ? 0.14 : 1.0) * (this.mounted ? 0.15 : 1.0);
      const bobAmpX = (this.player.ads ? 0.0018 : sprinting ? 0.019 : 0.012) * breathScale;
      const bobAmpY = (this.player.ads ? 0.0014 : sprinting ? 0.017 : 0.010) * breathScale;
      const bobX = Math.sin(this.player.vmBob) * bobAmpX * this.player.vmBobBlend;
      const bobY = (0.5 - 0.5 * Math.cos(this.player.vmBob * 2)) * bobAmpY * this.player.vmBobBlend;
      const bobRoll =
        Math.sin(this.player.vmBob) *
        (this.player.ads ? 0.003 : sprinting ? 0.036 : 0.018) *
        this.player.vmBobBlend *
        breathScale;
      const breathY = Math.sin(this.time * 2.1) * (this.player.ads ? 0.0008 : 0.0028) * breathScale;

      // Exact per-weapon transparent optical sight alignment (camera eye snaps dead-center through the crystal lens!)
      const adsAlignByWeapon: Array<[number, number, number]> = [
        [0.0, -0.124, -0.34], // [1] M41-X Rifle -> Open EOTech Reflex Holo Glass
        [0.0, -0.095, -0.44], // [2] DOOM-99 Shotgun -> Tritium Bead Iron Sight
        [0.0, -0.132, -0.25], // [3] RAIL-X9 Railgun -> Hollow 2.8x Sniper Scope Tube
        [0.0, -0.152, -0.36], // [4] HYDRA-7 Launcher -> Top Transparent Ballistic Optic
        [0.08, -0.18, -0.46], // [5] INFERNO-X Flamer -> Braced Thermal Hip-Aim
        [0.0, -0.124, -0.34], // [6] ZEUS-MK7 Tesla -> Top Transparent Arc Prism Optic
      ];
      const [adsX, adsY, adsZ] = adsAlignByWeapon[this.player.wpnIdx] ?? [0, -0.124, -0.36];
      const hipX = sprinting ? 0.2 : 0.235;
      const hipY = sprinting ? -0.26 : -0.232;
      const hipZ = -0.58;

      // CoD [T] Weapon Inspect showcase curve (0..1..0) & Warzone [H] Armor Plate Lowering
      const inspNorm = this.inspectTimer > 0 ? Math.sin((this.inspectTimer / 2.4) * Math.PI) : 0;
      const plateDrop =
        this.platingTimer > 0 ? Math.sin((1 - this.platingTimer / this.platingDuration) * Math.PI) * 0.24 : 0;
      const tx = hipX + (adsX - hipX) * this.adsBlend - inspNorm * 0.14;
      const ty = hipY + (adsY - hipY) * this.adsBlend + inspNorm * 0.055 - this.wallBlockBlend * 0.04 - plateDrop;
      const tz = hipZ + (adsZ - hipZ) * this.adsBlend + inspNorm * 0.14 + this.wallBlockBlend * 0.16;
      const reloadProgress = isReloading
        ? 1 - this.player.reloadTimer / Math.max(0.01, this.player.reloadDur)
        : 0;
      const reloadEval = evaluateWeaponReload(
        this.player.wpnIdx,
        reloadProgress,
        isReloading,
        this.player.reloadIsTactical,
        this.player.reloadDur
      );
      const rPose = reloadEval.pose;

      // Curved weapon draw arc (smooth quadratic ease-out raise with subtle wrist roll)
      const eqNorm = Math.max(0, Math.min(1, this.player.equipTimer / 0.28));
      const eqCurve = eqNorm * eqNorm;
      const equipDrop = eqCurve * 0.25;
      const equipRoll = eqCurve * 0.32;

      const posDamp = damp(20);
      const rotDamp = damp(18);
      this.viewmodel.pivot.position.x +=
        (tx + bobX + rPose.pivotPos.x + this.player.vmSwayX * breathScale - this.viewmodel.pivot.position.x) * posDamp;
      this.viewmodel.pivot.position.y +=
        (ty - bobY + breathY + rPose.pivotPos.y - equipDrop - this.player.landDip * 0.45 + this.player.vmSwayY * breathScale - this.viewmodel.pivot.position.y) *
        posDamp;
      this.viewmodel.pivot.position.z +=
        (tz + rPose.pivotPos.z + this.player.vmKickZ - this.viewmodel.pivot.position.z) * damp(23);

      const mountCant = this.mounted && !this.player.ads ? -0.05 : this.mounted ? -0.032 : 0;
      const targetRotX = isReloading
        ? rPose.pivotRot.x
        : this.player.vmRecoilPitch +
          this.player.vmKickZ * 0.55 -
          equipDrop * 1.45 +
          inspNorm * 0.22 +
          this.wallBlockBlend * 0.62;
      const targetRotY = isReloading
        ? rPose.pivotRot.y
        : sprinting && !this.player.ads
          ? 0.24
          : this.player.vmSwayX * 1.55 * breathScale + inspNorm * 0.58;
      const targetRotZ = isReloading
        ? rPose.pivotRot.z
        : (sprinting && !this.player.ads ? -0.14 : -strafe * 0.038 * (1 - this.adsBlend * 0.7)) +
          bobRoll +
          this.player.vmRecoilRoll -
          equipRoll -
          inspNorm * 0.36 -
          this.wallBlockBlend * 0.24 +
          mountCant;
      this.viewmodel.pivot.rotation.x += (targetRotX - this.viewmodel.pivot.rotation.x) * rotDamp;
      this.viewmodel.pivot.rotation.y += (targetRotY - this.viewmodel.pivot.rotation.y) * rotDamp;
      this.viewmodel.pivot.rotation.z += (targetRotZ - this.viewmodel.pivot.rotation.z) * rotDamp;

      // Seamlessly hand off RAIL-X9 to full-frame crystal-clear 2.8x Optical Scope Lens once fully raised
      const fullSniperOptic = this.player.wpnIdx === 2 && this.adsBlend > 0.78 && !isReloading;
      this.viewmodel.pivot.visible = !fullSniperOptic;

      // Update live CoD Target Telemetry & 3D PEQ Tactical Laser Sight
      this.aimProbeAccum += clampedRealDt;
      if (this.aimProbeAccum >= 0.032) {
        this.aimProbeAccum = 0;
        this.updateAimTelemetryAndLaser(fullSniperOptic || isReloading || this.vatsActive);
      }

      // Weapon-specific articulated magazine, support hand & mechanism reload animation
      const partDamp = damp(26);
      for (let i = 0; i < this.viewmodel.weapons.length; i++) {
        this.viewmodel.weapons[i].visible = i === this.player.wpnIdx;
        const mag = this.viewmodel.magazines[i];
        const basePos = this.viewmodel.magBasePos[i];
        const baseRot = this.viewmodel.magBaseRot[i];
        const leftHand = this.viewmodel.leftHands[i];
        const leftBase = this.viewmodel.leftHandBasePos[i];

        if (mag && basePos && baseRot) {
          if (i === this.player.wpnIdx && isReloading) {
            mag.visible = rPose.magVisible;
            mag.position.set(
              basePos.x + rPose.magPos.x,
              basePos.y + rPose.magPos.y,
              basePos.z + rPose.magPos.z
            );
            mag.rotation.set(
              baseRot.x + rPose.magRot.x,
              baseRot.y + rPose.magRot.y,
              baseRot.z + rPose.magRot.z
            );
          } else {
            mag.visible = true;
            mag.position.lerp(basePos, partDamp);
            mag.rotation.x += (baseRot.x - mag.rotation.x) * partDamp;
            mag.rotation.y += (baseRot.y - mag.rotation.y) * partDamp;
            mag.rotation.z += (baseRot.z - mag.rotation.z) * partDamp;
          }
        }

        if (leftHand && leftBase) {
          if (i === this.player.wpnIdx && isReloading) {
            leftHand.position.set(
              leftBase.x + rPose.leftHandPos.x,
              leftBase.y + rPose.leftHandPos.y,
              leftBase.z + rPose.leftHandPos.z
            );
            leftHand.rotation.set(
              rPose.leftHandRot.x,
              rPose.leftHandRot.y,
              rPose.leftHandRot.z
            );
          } else {
            leftHand.position.lerp(leftBase, partDamp);
            leftHand.rotation.x += (0 - leftHand.rotation.x) * partDamp;
            leftHand.rotation.y += (0 - leftHand.rotation.y) * partDamp;
            leftHand.rotation.z += (0 - leftHand.rotation.z) * partDamp;
          }
        }
      }

      // Weapon-specific secondary mechanisms (charging handle, railgun plasma core, flamer pilot flame)
      this.viewmodel.chargingHandle0.position.z =
        this.player.wpnIdx === 0 && isReloading ? -0.16 + rPose.auxValue * 0.115 : -0.16;

      const railCharge = this.player.wpnIdx === 2 && isReloading ? rPose.auxValue : 1;
      const railRad = 0.32 + railCharge * 0.68;
      this.viewmodel.railPlasmaCore.scale.set(railRad, 1, railRad);
      const railMat = this.viewmodel.railPlasmaCore.material as THREE.MeshBasicMaterial;
      railMat.color.setRGB(
        0.06 + railCharge * 0.16,
        0.25 + railCharge * 0.66,
        0.38 + railCharge * 0.62
      );

      const pilotPower = this.player.wpnIdx === 4 && isReloading ? rPose.auxValue : 1;
      this.viewmodel.flamerPilot.visible = pilotPower > 0.08;
      this.viewmodel.flamerPilot.scale.setScalar(
        Math.max(0.05, pilotPower * (0.9 + Math.sin(this.time * 24) * 0.12))
      );

      const teslaPower = this.player.wpnIdx === 5 && isReloading ? rPose.auxValue : 1;
      this.viewmodel.teslaCoilRotor.rotation.z +=
        clampedRealDt * (2.8 + teslaPower * 7.5 + (this.player.muzzleTimer > 0 ? 18 : 0));
      const teslaMat = this.viewmodel.teslaArcCore.material as THREE.MeshBasicMaterial;
      teslaMat.color.setRGB(
        0.08 + teslaPower * 0.18,
        0.3 + teslaPower * 0.64,
        0.45 + teslaPower * 0.55
      );

      if (this.player.muzzleTimer > 0) {
        this.player.muzzleTimer -= clampedRealDt;
        this.viewmodel.muzzleFlash.visible = !this.player.ads;
        this.viewmodel.muzzleFlash.rotation.z += 1.45;
        this.muzzleSprite.visible = !this.player.ads || w.id !== 2;
        const mMat = this.muzzleSprite.material as THREE.SpriteMaterial;
        mMat.rotation = Math.random() * Math.PI * 2;
        const flashHex =
          w.id === 2 || w.id === 5 ? 0x38d9ff : w.id === 4 ? 0xff7b29 : 0xffd280;
        mMat.color.setHex(flashHex);
        this.muzzleLight.color.setHex(flashHex);
        const adsShrink = this.player.ads ? 0.62 : 1.0;
        const mScale = (w.id === 1 ? 0.38 : w.id === 2 || w.id === 3 || w.id === 5 ? 0.34 : 0.28) * adsShrink;
        this.viewmodel.muzzleFlash.visible = false;
        this.muzzleSprite.visible = true;
        this.muzzleSprite.scale.set(mScale, mScale, 1);
        this.muzzleLight.intensity = (w.id === 2 || w.id === 5 ? 16.0 : 12.5) * (this.player.ads ? 0.72 : 1.0);
      } else {
        this.viewmodel.muzzleFlash.visible = false;
        this.muzzleSprite.visible = false;
        this.muzzleLight.intensity = 0;
      }

      if (this.player.bladeTimer > 0) {
        this.player.bladeTimer -= clampedRealDt;
        this.viewmodel.blade.visible = true;
        const p = 1 - this.player.bladeTimer / 0.25;
        this.viewmodel.blade.position.x = -0.58 + p * 1.25;
        this.viewmodel.blade.rotation.z = -0.95 + p * 1.9;
      } else {
        this.viewmodel.blade.visible = false;
      }

      if (this.mouseLeft && !this.vatsActive && w.auto) {
        this.firePlayerWeapon();
      }

      // Low-HP Heartbeat audio
      if (this.player.hp < 50) {
        const sev = 1 - this.player.hp / 50;
        this.heartbeatCd -= clampedRealDt;
        const beatInt = 0.52 + (1 - sev) * 0.45;
        if (this.heartbeatCd <= 0) {
          this.heartbeatCd = beatInt;
          this.audio.playHeartbeat(0.4 + sev * 0.65);
        }
      }
      if (this.player.hp < 38) {
        this.triggerRadioComms('lowHp', true);
      }
    }

    // Free Roam Sandbox Director: Endless 3-Way Robot Waves, Artillery, Dropships & Titan Bosses.
    // Campaign mode skips infinite wave spawning completely and runs curated Mission 01–04 setpieces!
    const threatSt = computeThreatState(this.threatPoints);
    if (this.gameMode === 'freeroam') {
      const spawnBal = computeSpawnBalance(
        this.wave,
        this.relaysDestroyed,
        this.coreShieldDown,
        threatSt.level
      );
      this.spawnCd -= dt;
      if (this.spawnCd <= 0 && this.units.length < spawnBal.maxActiveUnits) {
        this.spawnCd = spawnBal.spawnIntervalSec;
        const sp = this.findSpawnPoint();
        const roll = Math.random();
        const spawnPair = spawnBal.batchSize >= 2 && this.units.length + 2 <= spawnBal.maxActiveUnits;
        if (roll < 0.34) {
          this.createEnemy(Faction.RAIDER, UnitArchetype.RAIDER_TROOPER, sp.x, sp.z);
          if (spawnPair) {
            this.createEnemy(Faction.RAIDER, UnitArchetype.RAIDER_BERSERKER, sp.x + 1.8, sp.z + 1.4);
          }
        } else if (roll < 0.68) {
          const useSniper = spawnBal.allowSnipers && Math.random() < 0.32;
          this.createEnemy(
            Faction.SYNDICATE,
            useSniper ? UnitArchetype.SYNDICATE_SNIPER : UnitArchetype.SYNDICATE_COMMANDO,
            sp.x,
            sp.z
          );
          if (spawnPair) {
            this.createEnemy(Faction.SYNDICATE, UnitArchetype.SYNDICATE_HEAVY, sp.x - 1.8, sp.z + 1.4);
          }
        } else {
          this.createEnemy(Faction.ROBOT, UnitArchetype.ROBOT_ENFORCER, sp.x, sp.z);
          if (spawnPair) {
            this.createEnemy(Faction.ROBOT, UnitArchetype.ROBOT_STALKER, sp.x + 1.6, sp.z - 1.6);
          }
        }
      }

      this.artilleryCd -= dt;
      if (this.artilleryCd <= 0) {
        this.artilleryCd = Math.max(15, 25 - this.wave * 1.1 - threatSt.level * 0.9);
        this.callArtilleryBarrage();
      }

      this.dropshipCd -= dt;
      if (this.dropshipCd <= 0 && (!this.dropship || !this.dropship.alive)) {
        this.dropshipCd = Math.max(24, 36 - threatSt.level * 2);
        this.spawnDropship();
        this.triggerRadioComms('dropship', true);
      }

      this.bossCd -= dt;
      if (
        spawnBal.allowTitanBoss &&
        this.bossCd <= 0 &&
        !this.units.some((u) => u.isBoss && u.alive)
      ) {
        this.bossCd = 54;
        const sp = this.findSpawnPoint();
        this.handleTitanDropImpact({ x: sp.x, y: 0, z: sp.z });
        this.triggerRadioComms('bossTitan', true);
        this.showAlert('경고: OMNI-TITAN 오버로드 전장 강하 — 외장 장갑을 파괴하고 코어를 타격하라', 5.0);
      }
    }

    this.updateCampaignDirector(dt, clampedRealDt);
    this.updateTank(dt, clampedRealDt);
    this.updateSquadmates(dt);
    this.updateEnemies(dt);
    this.updateTurretsAndSupplyDrops(dt, clampedRealDt);
    this.updateDropPods(dt);
    this.updateDropship(dt);
    this.updateHolotapes(clampedRealDt);
    this.updateProjectilesAndPhysics(dt, clampedRealDt);
    this.updateAtmosphere(clampedRealDt);

    if (this.time - this.lastBucketSec >= 10) {
      this.recordTimelineSnapshot();
    }

    if (this.vatsActive) {
      this.updateVatsProjections();
    }

    const bgmMood: BgmMood = this.serverShutdownActive
      ? this.endingId ?? 'dawn'
      : this.coreShieldDown
        ? 'breach'
        : threatSt.level >= 4
          ? 'escalation'
          : 'combat';
    this.audio.setDynamicState({
      playing: this.phase === 'playing',
      intensity: Math.min(1, this.units.length / 13),
      bossActive: this.units.some((u) => u.isBoss && u.alive) || this.coreShieldDown,
      vatsActive: this.vatsActive,
      mood: bgmMood,
    });
  }

  private updateTurretsAndSupplyDrops(dt: number, realDt: number): void {
    // 1) Allied Ghost-9 Automated Defense Turrets target & shred enemy AI robots
    if (this.worldRefs) {
      for (const t of this.worldRefs.turrets) {
        t.rig.beaconRing.rotation.z += realDt * (t.hacked ? 2.4 : 0.8);
        if (!t.hacked) continue;
        t.fireCd = Math.max(0, t.fireCd - dt);
        let best: ActiveUnit | null = null;
        let bestD = 30;
        const turEye = new THREE.Vector3(t.x, 1.85, t.z);
        for (const u of this.units) {
          if (!u.alive) continue;
          const d = Math.hypot(u.x - t.x, u.z - t.z);
          if (d < bestD && this.hasLineOfSight3D(turEye, new THREE.Vector3(u.x, u.y + 1.25 * u.scale, u.z))) {
            bestD = d;
            best = u;
          }
        }
        if (best) {
          const desiredYaw = Math.atan2(best.x - t.x, best.z - t.z);
          const diff = Math.atan2(
            Math.sin(desiredYaw - t.rig.head.rotation.y),
            Math.cos(desiredYaw - t.rig.head.rotation.y)
          );
          t.rig.head.rotation.y += diff * Math.min(1, dt * 10);
          if (t.fireCd <= 0 && Math.abs(diff) < 0.35) {
            t.fireCd = 0.46;
            const muzzle = new THREE.Vector3(t.x, 1.8, t.z);
            const targetPt = new THREE.Vector3(best.x, 1.25 * best.scale, best.z);
            const dir = targetPt.clone().sub(muzzle).normalize();
            this.spawnTracer(muzzle, targetPt, 0x2dd4bf, 0.12, 'laser');
            const dTur = Math.hypot(t.x - this.player.x, t.z - this.player.z);
            this.audio.playWeapon('robot_laser', Math.max(0.09, (1 - dTur / 50) * 0.34), {
              isIndoors: false,
              distanceM: dTur,
            });
            this.damageUnit(
              best,
              28,
              'torso',
              targetPt,
              dir,
              -2,
              FACTION_META[-2].name,
              '자동 포탑 제압'
            );
          }
        } else {
          t.rig.head.rotation.y += dt * 0.7;
        }
      }
    }

    // 2) Valkyrie Orbital Supply Drop Pods descent & pickup
    for (let i = this.supplyDrops.length - 1; i >= 0; i--) {
      const sd = this.supplyDrops[i];
      sd.life -= realDt;
      if (!sd.landed) {
        sd.y -= realDt * 42;
        if (sd.y <= 0) {
          sd.y = 0;
          sd.landed = true;
          this.vfx.spawnExplosion(new THREE.Vector3(sd.x, 0.5, sd.z), 7.5, true);
          this.shake = Math.max(this.shake, 0.42);
        }
        sd.mesh.position.set(sd.x, sd.y, sd.z);
      } else {
        sd.mesh.rotation.y += realDt * 0.85;
        if (this.phase === 'playing' && this.player.alive) {
          const dist = Math.hypot(this.player.x - sd.x, this.player.z - sd.z);
          if (dist < 3.4) {
            sd.collected = true;
            this.scene.remove(sd.mesh);
            this.supplyDrops.splice(i, 1);
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 45);
            this.player.armor = Math.min(this.player.maxArmor, this.player.armor + 55);
            this.player.grenades = Math.min(4, this.player.grenades + 1);
            this.player.ammo[this.player.wpnIdx] = this.getEffectiveMag(this.player.wpnIdx);
            this.armorPlates = Math.min(this.maxArmorPlates, this.armorPlates + 2);
            this.smokeGrenades = Math.min(this.maxSmokeGrenades, this.smokeGrenades + 1);
            this.overdriveTimer = 12.0;
            this.audio.playHolotapePickup();
            this.empFlashSeq++;
            this.showCallout('발키리 보급 확보 · +45 HP · +55 ARMOR · 12초 화력 오버드라이브!', '#34d399', 2.8);
            this.emitHudSnapshot(true);
            continue;
          }
        }
      }
      if (sd.life <= 0) {
        this.scene.remove(sd.mesh);
        this.supplyDrops.splice(i, 1);
      }
    }
  }

  private updateDropPods(dt: number): void {
    for (let i = this.dropPods.length - 1; i >= 0; i--) {
      const dp = this.dropPods[i];
      if (!dp.spawned) {
        dp.y -= dt * 42;
        dp.pod.position.y = Math.max(1.1, dp.y);
        if (dp.y <= 1.1) {
          dp.spawned = true;
          this.vfx.spawnExplosion(new THREE.Vector3(dp.x, 1.0, dp.z), 7.5, false);
          this.audio.playExplosion(0.55, false, false);
          this.shake = Math.max(this.shake, 0.45);
          this.createEnemy(Faction.ROBOT, UnitArchetype.ROBOT_ENFORCER, dp.x - 1.2, dp.z);
          this.createEnemy(Faction.ROBOT, UnitArchetype.ROBOT_STALKER, dp.x + 1.2, dp.z + 1.0);
        }
      } else {
        dp.life -= dt;
        (dp.beam.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (dp.life / 1.5) * 0.72);
        (dp.ring.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (dp.life / 1.5) * 0.85);
        if (dp.life <= 0) {
          this.scene.remove(dp.beam);
          this.scene.remove(dp.ring);
          this.scene.remove(dp.pod);
          this.dropPods.splice(i, 1);
        }
      }
    }
  }

  private updateDropship(dt: number): void {
    const ds = this.dropship;
    if (!ds || !ds.alive) return;

    if (ds.state === 'inbound') {
      const toTgt = ds.targetPos.clone().sub(ds.pos);
      const dist = toTgt.length();
      if (dist < 1.5) {
        ds.state = 'deploying';
        ds.timer = 2.4;
      } else {
        ds.pos.addScaledVector(toTgt.normalize(), 18 * dt);
        ds.mesh.lookAt(ds.targetPos.x, ds.pos.y, ds.targetPos.z);
      }
    } else if (ds.state === 'deploying') {
      ds.timer -= dt;
      if (!ds.deployed && ds.timer < 1.5) {
        ds.deployed = true;
        this.createEnemy(Faction.ROBOT, UnitArchetype.ROBOT_STALKER, ds.pos.x - 2, ds.pos.z);
        this.createEnemy(Faction.ROBOT, UnitArchetype.ROBOT_ENFORCER, ds.pos.x + 2, ds.pos.z);
        this.spawnParticles(new THREE.Vector3(ds.pos.x, 1.0, ds.pos.z), 'spark', 18, 7);
      }
      if (ds.timer <= 0) {
        ds.state = 'outbound';
        ds.targetPos.set(ds.pos.x > 0 ? 85 : -85, 22, -65);
      }
    } else if (ds.state === 'outbound') {
      const toTgt = ds.targetPos.clone().sub(ds.pos);
      if (toTgt.length() < 3) {
        ds.alive = false;
        this.scene.remove(ds.mesh);
        this.dropship = null;
        this.rebuildHitMeshCache();
        return;
      }
      ds.pos.addScaledVector(toTgt.normalize(), 24 * dt);
      ds.mesh.lookAt(ds.targetPos);
    } else if (ds.state === 'crashing') {
      ds.vel.y -= 14 * dt;
      ds.pos.addScaledVector(ds.vel, dt);
      ds.mesh.rotation.z += dt * 1.9;
      ds.mesh.rotation.x += dt * 0.9;
      if (Math.random() < 0.65) {
        this.spawnParticles(ds.pos, 'fire', 2, 6);
        this.spawnParticles(ds.pos, 'smoke', 2, 4);
      }
      if (ds.pos.y <= 1.2) {
        ds.alive = false;
        this.scene.remove(ds.mesh);
        this.triggerExplosion(
          new THREE.Vector3(ds.pos.x, 1.0, ds.pos.z),
          14.5,
          240,
          Faction.PLAYER,
          '추락 드롭쉽',
          { isArtillery: true, tag: '드롭쉽 추락 폭사' }
        );
        this.dropship = null;
        this.rebuildHitMeshCache();
        return;
      }
    }

    ds.mesh.position.copy(ds.pos);
  }

  private updateProjectilesAndPhysics(dt: number, realDt: number): void {
    // Rockets
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.life -= dt;
      const step = r.speed * dt;
      this.raycaster.set(r.pos, r.dir);
      this.raycaster.far = step + 0.55;
      const hitW = this.raycaster.intersectObjects(this.worldHitMeshes, false);
      const hitE = this.raycaster.intersectObjects(this.enemyHitMeshes, false);

      r.pos.addScaledVector(r.dir, step);
      r.mesh.position.copy(r.pos);
      if (Math.random() < 0.72) this.spawnParticles(r.pos, 'smoke', 1, 1.4);

      if (hitW.length > 0 || hitE.length > 0 || r.life <= 0) {
        this.scene.remove(r.mesh);
        this.rockets.splice(i, 1);
        const rDmg = Math.round(WEAPONS[3].dmg * this.getDamageBoostMultiplier());
        this.triggerExplosion(r.pos, 10.5, rDmg, Faction.PLAYER, 'HYDRA-7 로켓', {
          tag: '로켓 직격 랙돌',
        });
      }
    }

    // Flamethrower napalm puffs (wall-occluded so fire cannot burn through solid bunkers!)
    for (let i = this.flames.length - 1; i >= 0; i--) {
      const fl = this.flames[i];
      fl.life -= dt;
      const prevFlame = fl.pos.clone();
      fl.pos.addScaledVector(fl.vel, dt);
      fl.vel.y += 2.2 * dt;
      const fStep = fl.pos.distanceTo(prevFlame);
      if (fStep > 0.01) {
        this.raycaster.set(prevFlame, this._v1.copy(fl.pos).sub(prevFlame).normalize());
        this.raycaster.far = fStep + 0.18;
        if (this.raycaster.intersectObjects(this.worldHitMeshes, false).length > 0) {
          fl.life = 0;
        }
      }
      fl.mesh.position.copy(fl.pos);
      const pr = 1 - fl.life / fl.maxLife;
      fl.mesh.scale.setScalar(0.28 + pr * 0.95);

      if (fl.life > 0) {
        for (const u of this.units) {
          if (!u.alive) continue;
          if (
            Math.hypot(u.x - fl.pos.x, u.z - fl.pos.z) < u.r + 0.9 &&
            Math.abs(fl.pos.y - (u.y + 1.1 * u.scale)) < 1.3 * u.scale
          ) {
            u.burnTimer = Math.max(u.burnTimer, 3.6);
            if (u.isRobot && !u.isBoss) u.staggerTimer = Math.max(u.staggerTimer, 0.28);
            const flDmg = Math.round(8 * this.getDamageBoostMultiplier());
            this.damageUnit(
              u,
              flDmg,
              'torso',
              fl.pos.clone(),
              fl.vel.clone().normalize(),
              Faction.PLAYER,
              FACTION_META[Faction.PLAYER].name,
              u.isRobot ? '과열 합선' : '네이팜 화염'
            );
            fl.life = 0;
            break;
          }
        }
      }

      if (fl.life <= 0) {
        this.scene.remove(fl.mesh);
        this.flames.splice(i, 1);
      }
    }

    // Frag / EMP Grenades (full horizontal wall ricochet + floor bounce!)
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.fuse -= dt;
      g.vy -= 24 * dt;
      const prevX = g.pos.x;
      const prevZ = g.pos.z;
      g.pos.x += g.vx * dt;
      g.pos.y += g.vy * dt;
      g.pos.z += g.vz * dt;
      // Reflect cleanly off horizontal solid colliders
      const probe = { x: g.pos.x, z: g.pos.z };
      resolveXZCollision(probe, 0.22, this.colliders, ARENA_HALF_SIZE, Math.max(0, g.pos.y));
      if (Math.abs(probe.x - g.pos.x) > 0.005) {
        g.pos.x = prevX;
        g.vx = -g.vx * 0.52;
      }
      if (Math.abs(probe.z - g.pos.z) > 0.005) {
        g.pos.z = prevZ;
        g.vz = -g.vz * 0.52;
      }
      const nadeFloorY = this.getFloorHeightAt(g.pos.x, g.pos.z, Math.max(0, g.pos.y));
      if (g.pos.y < nadeFloorY + 0.16) {
        g.pos.y = nadeFloorY + 0.16;
        g.vy = -g.vy * 0.45;
        g.vx *= 0.72;
        g.vz *= 0.72;
      }
      g.mesh.position.copy(g.pos);
      if (g.fuse <= 0) {
        this.scene.remove(g.mesh);
        this.grenades.splice(i, 1);
        this.triggerExplosion(g.pos, 11.5, 185, Faction.PLAYER, '파편/EMP 수류탄', {
          isEmp: true,
          tag: 'EMP 파편 폭사',
        });
      }
    }

    // Artillery & Airstrike impacts
    for (let i = this.artilleryStrikes.length - 1; i >= 0; i--) {
      const a = this.artilleryStrikes[i];
      a.timer -= dt;
      const sc = 0.25 + (1 - Math.max(0, a.timer) / Math.max(0.1, a.maxTimer)) * 0.85;
      a.ring.scale.setScalar(sc);
      if (a.timer <= 0) {
        this.scene.remove(a.ring);
        this.artilleryStrikes.splice(i, 1);
        this.triggerExplosion(
          new THREE.Vector3(a.x, 0.5, a.z),
          a.isAirstrike ? 13 : 13.5,
          230,
          a.isAirstrike ? Faction.PLAYER : -1,
          a.isAirstrike ? '공중 융단 폭격' : '장거리 포격',
          { isArtillery: true, tag: a.isAirstrike ? '공중 폭격 소멸' : '포격 폭사' }
        );
      }
    }

    // Fixed-step 60Hz Verlet Ragdolls
    this.physicsAccum += dt;
    let steps = 0;
    while (this.physicsAccum >= 1 / 60 && steps < 3) {
      this.stepRagdollsFixed();
      this.physicsAccum -= 1 / 60;
      steps++;
    }

    // Detached spinning 3D Gibs
    for (let i = this.gibs.length - 1; i >= 0; i--) {
      const g = this.gibs[i];
      g.life -= dt;
      if (g.life <= 0) {
        this.scene.remove(g.mesh);
        g.mesh.geometry.dispose();
        this.gibs.splice(i, 1);
        continue;
      }
      g.vy -= 24 * dt;
      g.mesh.position.x += g.vx * dt;
      g.mesh.position.y += g.vy * dt;
      g.mesh.position.z += g.vz * dt;
      g.mesh.rotation.x += g.rx * dt;
      g.mesh.rotation.y += g.ry * dt;
      g.mesh.rotation.z += g.rz * dt;

      if (g.isLimb && g.bounces < 2 && Math.random() < 0.32) {
        this.spawnParticles(g.mesh.position, g.isRobot ? 'spark' : 'blood', 1, 1.5);
      }
      if (g.mesh.position.y < 0.14) {
        g.mesh.position.y = 0.14;
        if (Math.abs(g.vy) > 1.5) {
          g.vy = -g.vy * 0.38;
          g.vx *= 0.65;
          g.vz *= 0.65;
          g.rx *= 0.6;
          g.ry *= 0.6;
          g.rz *= 0.6;
          g.bounces++;
          if (g.isLimb && g.bounces <= 2) {
            this.spawnDecal(
              new THREE.Vector3(g.mesh.position.x, 0.02, g.mesh.position.z),
              new THREE.Vector3(0, 1, 0),
              g.isRobot ? 'oil' : 'blood',
              0.9
            );
          }
        } else {
          g.vx = g.vy = g.vz = g.rx = g.ry = g.rz = 0;
        }
      }
    }

    // Physical Brass Shell Casings with multi-level floor bounce & tactile metallic clink SFX
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const sh = this.shells[i];
      sh.life -= dt;
      if (sh.life <= 0) {
        this.scene.remove(sh.mesh);
        this.shells.splice(i, 1);
        continue;
      }
      sh.vy -= 21 * dt;
      sh.mesh.position.x += sh.vx * dt;
      sh.mesh.position.y += sh.vy * dt;
      sh.mesh.position.z += sh.vz * dt;
      sh.mesh.rotation.x += sh.rx * dt;
      sh.mesh.rotation.y += sh.ry * dt;
      const shellFloorY = this.getFloorHeightAt(
        sh.mesh.position.x,
        sh.mesh.position.z,
        Math.max(0, sh.mesh.position.y)
      );
      if (sh.mesh.position.y <= shellFloorY + 0.028) {
        sh.mesh.position.y = shellFloorY + 0.028;
        if (Math.abs(sh.vy) > 0.75) {
          sh.vy = Math.abs(sh.vy) * 0.42;
          sh.vx *= 0.58;
          sh.vz *= 0.58;
          sh.rx *= 0.55;
          sh.ry *= 0.55;
          if (sh.bounces < 2) {
            this.audio.playShellClink(sh.bounces === 0 ? 1.0 : 0.48);
          }
          sh.bounces++;
        } else {
          sh.vy = 0;
          sh.vx *= 0.75;
          sh.vz *= 0.75;
          sh.rx = 0;
          sh.ry = 0;
        }
      }
    }

    // 3D Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= p.grav * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.mesh.position.y < 0.05) {
        p.mesh.position.y = 0.05;
        p.vx *= 0.4;
        p.vy = 0;
        p.vz *= 0.4;
      }
    }

    // Shockwave Spheres
    for (let i = this.shockSpheres.length - 1; i >= 0; i--) {
      const s = this.shockSpheres[i];
      s.life -= dt;
      if (s.life <= 0) {
        this.scene.remove(s.mesh);
        this.shockSpheres.splice(i, 1);
        continue;
      }
      const pr = 1 - s.life / s.maxLife;
      s.mesh.scale.setScalar(1 + pr * s.maxR);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - pr) * 0.55;
    }

    // Tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= realDt;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        this.tracers.splice(i, 1);
      } else {
        (t.line.material as THREE.LineBasicMaterial).opacity = t.life / t.maxLife;
      }
    }

    // Custom Additive VFX Sprite Bursts (fireballs, starburst sparks, blood mist, EMP arcs)
    for (let i = this.spriteBursts.length - 1; i >= 0; i--) {
      const sb = this.spriteBursts[i];
      sb.life -= dt;
      if (sb.life <= 0) {
        this.scene.remove(sb.sprite);
        sb.sprite.material.dispose();
        this.spriteBursts.splice(i, 1);
        continue;
      }
      const pr = 1 - sb.life / sb.maxLife;
      sb.sprite.position.addScaledVector(sb.vel, dt);
      const sc = sb.startScale + (sb.endScale - sb.startScale) * pr;
      sb.sprite.scale.set(sc, sc, 1);
      (sb.sprite.material as THREE.SpriteMaterial).opacity = Math.max(0, (1 - pr) * 0.92);
    }

    // Floating 3D -> 2D Damage Popups
    for (let i = this.floatingDamages.length - 1; i >= 0; i--) {
      const fd = this.floatingDamages[i];
      fd.life -= realDt;
      fd.worldPos.y += realDt * 1.25;
      if (fd.life <= 0) {
        this.floatingDamages.splice(i, 1);
      }
    }

    this.vfx.update(dt);
    this.blastLight.intensity *= Math.pow(0.002, realDt);
  }

  private getFloorHeightAt(x: number, z: number, currentFeetY: number): number {
    let bestY = 0;
    const surfaces = this.worldRefs?.walkableSurfaces;
    if (!surfaces) return 0;
    for (let i = 0; i < surfaces.length; i++) {
      const s = surfaces[i];
      if (x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ) {
        let sy = s.yStart;
        if (s.slopeAxis === 'z') {
          const t = Math.max(0, Math.min(1, (z - s.minZ) / Math.max(0.01, s.maxZ - s.minZ)));
          sy = s.yStart + (s.yEnd - s.yStart) * t;
        } else if (s.slopeAxis === 'x') {
          const t = Math.max(0, Math.min(1, (x - s.minX) / Math.max(0.01, s.maxX - s.minX)));
          sy = s.yStart + (s.yEnd - s.yStart) * t;
        }
        if (sy <= currentFeetY + 1.15 && sy > bestY) {
          bestY = sy;
        }
      }
    }
    return bestY;
  }

  /** Classifies floor acoustic material for real recording-based footsteps */
  private getFootstepSurfaceAt(x: number, z: number, floorY: number): FootstepSurface {
    // 1) Steel decks: ROK Navy LCAC-655 hovercraft deck, OMNI-CORE exterior lift, collapsed overpass ramps
    if (
      z >= 35.5 ||
      (this.gameMode === 'campaign' && this.missionStage === 'm4_elevator_breach') ||
      (floorY > 0.15 && floorY < 3.0)
    ) {
      return 'metal';
    }
    // 2) Shattered storefront glass & indoor concrete debris: 2F Euljiro balconies, breached command room, subway shelter
    if (
      floorY >= 3.0 ||
      this.isIndoors ||
      (x >= 11.5 && z >= -1.0 && z <= 10.5) ||
      (z >= 25.0 && z <= 33.5 && Math.abs(x) <= 12.5)
    ) {
      return 'glass';
    }
    // 3) Rain-slicked Neo-Seoul urban asphalt boulevards & plazas
    return 'asphalt';
  }

  private getDamageBoostMultiplier(): number {
    const styleMult = computeStyleRank(this.comboCount, this.styleScore).damageMult;
    const att = getWeaponAttachmentSpec(this.weaponAttachment);
    return styleMult * att.damageMult * (this.overdriveTimer > 0 ? 1.4 : 1.0);
  }

  private updateEyeAdaptation(dt: number): void {
    let indoors = false;
    const zones = this.worldRefs?.indoorZones;
    if (zones && this.phase === 'playing') {
      const cx = this.camera.position.x;
      const cy = this.camera.position.y;
      const cz = this.camera.position.z;
      for (let i = 0; i < zones.length; i++) {
        const z = zones[i];
        if (cx >= z.minX && cx <= z.maxX && cz >= z.minZ && cz <= z.maxZ && cy <= z.maxY) {
          indoors = true;
          break;
        }
      }
    }
    if (indoors !== this.prevIndoors) {
      this.exposureAdaptationPulse = indoors ? -0.07 : 0.08;
      this.prevIndoors = indoors;
    }
    this.isIndoors = indoors;
    this.exposureAdaptationPulse *= Math.exp(-3.4 * dt);
    const targetExp = (indoors ? 0.96 : 1.02) + this.exposureAdaptationPulse;
    this.currentExposure += (targetExp - this.currentExposure) * Math.min(1, dt * 3.2);
    this.renderer.toneMappingExposure = Math.max(0.86, Math.min(1.12, this.currentExposure));
  }

  private updateAtmosphere(dt: number): void {
    const nowSec = performance.now() * 0.001;
    const dawnP = this.cinematic.getDawnProgress();

    // Update towering black oil smoke columns, street steam curtains & indoor/outdoor Eye Adaptation
    if (this.worldRefs) {
      this.vfx.updateAmbientPlumes(this.worldRefs.smokePlumes, dt, this.quality);
    }
    this.updateEyeAdaptation(dt);

    // Pillar 3: Dynamic Overhead Helicopter Rotor Loop & Supersonic Fighter Jet Low-Altitude Doppler Flyby
    if (this.phase === 'playing') {
      let heliLevel = 0.16;
      if (this.isHeliRideActive()) {
        heliLevel = 0.98;
      } else if (this.dropship && this.dropship.alive) {
        heliLevel = 0.88;
      } else if (this.gameMode === 'campaign' && this.missionStage === 'm1_landing') {
        heliLevel = 0.8;
      } else if (this.worldRefs?.rescueShuttle.visible) {
        heliLevel = 0.65;
      } else if (this.gameMode === 'campaign' && this.missionStage === 'm3_ac130_flir') {
        heliLevel = 0.5;
      } else if (this.isIndoors) {
        heliLevel = 0.06;
      }
      this.audio.setHeliPresence(heliLevel);

      if (dawnP < 0.08 && !this.cinematic.isCutsceneActive()) {
        this.jetFlybyCd -= dt;
        if (this.jetFlybyCd <= 0) {
          this.jetFlybyCd = 24 + Math.random() * 18;
          this.audio.playJetFlyby(this.isIndoors ? 0.34 : 0.68);
          this.shake = Math.max(this.shake, this.isIndoors ? 0.035 : 0.085);
        }
      }
    } else {
      this.audio.setHeliPresence(0);
      this.audio.setTankEnginePresence(false, 0);
    }

    // Flickering burning APC & debris firelights (physically calibrated for r187 decay=1.4!)
    const fireFade = Math.max(0.15, 1 - dawnP * 0.8);
    for (const fl of this.fireLights) {
      fl.light.intensity =
        (16.0 + Math.sin(nowSec * 14 + fl.phase) * 3.8 + Math.random() * 2.2) * fireFade;
    }

    // Sweeping giant searchlights
    for (const sl of this.searchlights) {
      sl.pivot.rotation.y = sl.baseYaw + Math.sin(nowSec * sl.speed + sl.phase) * 0.7;
      sl.pivot.rotation.z = 0.22 + Math.cos(nowSec * sl.speed * 0.8 + sl.phase) * 0.14;
    }

    // Occasional apocalyptic lightning flash (stops once Dawn begins)
    if (dawnP < 0.05) {
      this.lightningCd -= dt;
      if (this.lightningCd <= 0) {
        this.lightningCd = 11 + Math.random() * 14;
        this.lightningFlash = 0.28;
        if (this.phase === 'playing' && !this.cinematic.isCutsceneActive()) {
          this.audio.playThunder();
        }
      }
      if (this.lightningFlash > 0) {
        this.lightningFlash -= dt;
        this.lightningLight.intensity = Math.random() > 0.35 ? 1.05 : 0.22;
      } else {
        this.lightningLight.intensity = 0;
      }
    } else {
      this.lightningLight.intensity = 0;
    }

    // Smooth atmospheric sky/fog/light morph for ALL 3 Branching Endings:
    // Dawn (Golden Sunrise) | Symbiosis (Emerald-Cyan Aurora) | Ascension (Crimson-Gold Sovereign Storm)
    const fog = this.scene.fog as THREE.FogExp2;
    const endTheme = this.cinematic.getEndingTheme();
    if (dawnP > 0.001) {
      if (endTheme === 'symbiosis') {
        this._c1.setHex(0x1f0d12).lerp(this._c2.setHex(0x1b4d5c), dawnP);
        fog.color.copy(this._c1);
        fog.density = 0.0102 * (1 - dawnP * 0.45);
        (this.scene.background as THREE.Color).setHex(0x0c0e17).lerp(this._c2.setHex(0x0d2b3e), dawnP);
        this.hemiLight.color.setHex(0x88b4e6).lerp(this._c2.setHex(0x7efce0), dawnP);
        this.hemiLight.groundColor.setHex(0x381e18).lerp(this._c2.setHex(0x1f5963), dawnP);
        this.hemiLight.intensity = 0.88 + dawnP * 0.52;
        this.sunLight.color.setHex(0xffb884).lerp(this._c2.setHex(0x9fffe8), dawnP);
        this.sunLight.intensity = 1.42 + dawnP * 0.55;
        if (this.worldRefs) {
          const u = this.worldRefs.skyDomeMat.uniforms;
          u.topColor.value.setHex(0x060913).lerp(this._c2.setHex(0x09243d), dawnP);
          u.midColor.value.setHex(0x16101e).lerp(this._c2.setHex(0x178b82), dawnP);
          u.horizonColor.value.setHex(0x471b18).lerp(this._c2.setHex(0x52f2c8), dawnP);
          u.glowColor.value.setHex(0x9e2124).lerp(this._c2.setHex(0x7efce0), dawnP);
        }
      } else if (endTheme === 'ascension') {
        this._c1.setHex(0x1f0d12).lerp(this._c2.setHex(0x2e0b10), dawnP);
        fog.color.copy(this._c1);
        fog.density = 0.0102 * (1 - dawnP * 0.22);
        (this.scene.background as THREE.Color).setHex(0x0c0e17).lerp(this._c2.setHex(0x1a0608), dawnP);
        this.hemiLight.color.setHex(0x88b4e6).lerp(this._c2.setHex(0xff9b54), dawnP);
        this.hemiLight.groundColor.setHex(0x381e18).lerp(this._c2.setHex(0x4d1014), dawnP);
        this.hemiLight.intensity = 0.88 + dawnP * 0.45;
        this.sunLight.color.setHex(0xffb884).lerp(this._c2.setHex(0xff5a36), dawnP);
        this.sunLight.intensity = 1.42 + dawnP * 0.62;
        if (this.worldRefs) {
          const u = this.worldRefs.skyDomeMat.uniforms;
          u.topColor.value.setHex(0x060913).lerp(this._c2.setHex(0x140407), dawnP);
          u.midColor.value.setHex(0x16101e).lerp(this._c2.setHex(0x4a0f14), dawnP);
          u.horizonColor.value.setHex(0x471b18).lerp(this._c2.setHex(0xff5e1a), dawnP);
          u.glowColor.value.setHex(0x9e2124).lerp(this._c2.setHex(0xffc145), dawnP);
        }
        this.ascensionArcCd -= dt;
        if (this.ascensionArcCd <= 0 && this.worldRefs) {
          this.ascensionArcCd = 0.65;
          const cit = this.worldRefs.citadel;
          this.vfx.spawnLightningArc(
            new THREE.Vector3(cit.x, 22, cit.z),
            new THREE.Vector3(
              cit.x + (Math.random() - 0.5) * 44,
              52,
              cit.z + (Math.random() - 0.5) * 24
            ),
            Math.random() > 0.5 ? 0xff4422 : 0xf5b342,
            0.5
          );
        }
      } else {
        this._c1.setHex(0x1f0d12).lerp(this._c2.setHex(0xdcb486), dawnP);
        fog.color.copy(this._c1);
        fog.density = 0.0102 * (1 - dawnP * 0.52);
        (this.scene.background as THREE.Color).setHex(0x0c0e17).lerp(this._c2.setHex(0x5a9be0), dawnP);

        this.hemiLight.color.setHex(0x88b4e6).lerp(this._c2.setHex(0xbde2ff), dawnP);
        this.hemiLight.groundColor.setHex(0x381e18).lerp(this._c2.setHex(0xd99b66), dawnP);
        this.hemiLight.intensity = 0.88 + dawnP * 0.48;

        this.sunLight.color.setHex(0xffb884).lerp(this._c2.setHex(0xffe0a6), dawnP);
        this.sunLight.intensity = 1.42 + dawnP * 0.65;

        if (this.worldRefs) {
          const u = this.worldRefs.skyDomeMat.uniforms;
          u.topColor.value.setHex(0x060913).lerp(this._c2.setHex(0x286cc2), dawnP);
          u.midColor.value.setHex(0x16101e).lerp(this._c2.setHex(0x74b3e8), dawnP);
          u.horizonColor.value.setHex(0x471b18).lerp(this._c2.setHex(0xffc97d), dawnP);
          u.glowColor.value.setHex(0x9e2124).lerp(this._c2.setHex(0xffe9a8), dawnP);
        }
      }
    } else if (this.relay1FogShift > 0) {
      // Shift slightly deeper crimson-rust after Relay 1 falls
      fog.color.lerp(this._c2.setHex(0x260d14), Math.min(1, dt * 0.65));
      if (this.worldRefs) {
        const u = this.worldRefs.skyDomeMat.uniforms;
        u.horizonColor.value.lerp(this._c2.setHex(0x6e1a18), Math.min(1, dt * 0.65));
        u.glowColor.value.lerp(this._c2.setHex(0xd92626), Math.min(1, dt * 0.65));
      }
    }

    // Drifting glowing embers
    const ap = this.ashPoints.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < ap.length / 3; i++) {
      ap[i * 3 + 1] -= dt * 0.92;
      ap[i * 3] += Math.sin(nowSec * 0.9 + i) * dt * 0.42;
      ap[i * 3 + 2] += Math.cos(nowSec * 0.7 + i * 0.7) * dt * 0.28;
      if (ap[i * 3 + 1] < 0) ap[i * 3 + 1] = 24;
    }
    this.ashPoints.geometry.attributes.position.needsUpdate = true;

    // Suspended cool atmospheric dust motes drifting lazily in air currents
    const dp = this.dustPoints.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < dp.length / 3; i++) {
      dp[i * 3] += Math.sin(nowSec * 0.45 + i * 0.6) * dt * 0.22;
      dp[i * 3 + 1] += Math.cos(nowSec * 0.35 + i * 0.8) * dt * 0.12;
      dp[i * 3 + 2] += Math.sin(nowSec * 0.3 + i * 1.1) * dt * 0.18;
      if (dp[i * 3 + 1] < 0.4) dp[i * 3 + 1] = 14;
      else if (dp[i * 3 + 1] > 15) dp[i * 3 + 1] = 0.8;
    }
    this.dustPoints.geometry.attributes.position.needsUpdate = true;

    // Rain streaks (fades out cleanly as Dawn breaks)
    const rainMat = this.rainLines.material as THREE.LineBasicMaterial;
    rainMat.opacity = Math.max(0, 0.22 * (1 - dawnP * 1.15));
    if (this.rainLines.visible && rainMat.opacity > 0.005) {
      const rp = this.rainLines.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < rp.length / 6; i++) {
        rp[i * 6 + 1] -= dt * 26;
        rp[i * 6 + 4] -= dt * 26;
        if (rp[i * 6 + 1] < 0) {
          const ny = 24 + Math.random() * 4;
          rp[i * 6 + 1] = ny;
          rp[i * 6 + 4] = ny - 1.3;
        }
      }
      this.rainLines.geometry.attributes.position.needsUpdate = true;
    }

    // Animate OMNI-CORE Citadel gyro rings, Exposed Orange Core, Relay Pylon crystals, shaders & fans
    if (this.worldRefs) {
      const skyU = this.worldRefs.skyDomeMat.uniforms;
      skyU.uTime.value = nowSec;
      skyU.uAuroraStrength.value = endTheme === 'symbiosis' ? dawnP : 0;
      skyU.uSunGlow.value = endTheme === 'dawn' ? dawnP : 0;
      this.worldRefs.shieldDomeMat.uniforms.uTime.value = nowSec;

      // Drifting low-lying street volumetric mist
      if (this.worldRefs.groundMist.visible) {
        const mp = this.worldRefs.groundMist.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < mp.length / 3; i++) {
          mp[i * 3] += Math.sin(nowSec * 0.25 + i * 0.9) * dt * 0.35;
          mp[i * 3 + 2] += Math.cos(nowSec * 0.2 + i * 0.7) * dt * 0.28;
        }
        this.worldRefs.groundMist.geometry.attributes.position.needsUpdate = true;
      }

      for (const fan of this.worldRefs.spinningFans) {
        fan.rotation.y += dt * (this.serverShutdownActive ? 0.25 : 3.8);
      }
      const cit = this.worldRefs.citadel;
      if (!this.serverShutdownActive) {
        cit.gyroRingA.rotation.z += dt * (this.coreShieldDown ? 1.85 : 0.7);
        cit.gyroRingB.rotation.z -= dt * (this.coreShieldDown ? 2.4 : 1.1);
        cit.shieldDome.rotation.y += dt * 0.25;
        if (this.coreShieldDown && cit.coreWeakpoint.visible) {
          const pulse = 1.35 + Math.sin(nowSec * 9.5) * 0.14;
          cit.coreWeakpoint.scale.setScalar(pulse);
          cit.coreWeakpoint.rotation.y += dt * 2.2;
          cit.coreWeakpoint.rotation.x += dt * 1.4;
        }
      }
      for (const r of this.worldRefs.relays) {
        if (!r.alive) continue;
        r.coreCrystal.rotation.y += dt * 2.4;
        r.coreCrystal.position.y = 5.6 + Math.sin(nowSec * 3.4 + r.id) * 0.22;
        r.ringMesh.rotation.z += dt * 1.8;
      }

      // Animate Living Cyberpunk Megacity Aerial Patrol Traffic
      for (const tr of this.worldRefs.skyTraffic) {
        tr.angle += dt * tr.speed;
        const nx = Math.cos(tr.angle) * tr.orbitRadius;
        const nz = Math.sin(tr.angle) * tr.orbitRadius;
        const ny = tr.height + Math.sin(nowSec * 1.2 + tr.orbitRadius) * 1.1;
        tr.mesh.position.set(nx, ny, nz);
        const tangentX = -Math.sin(tr.angle) * tr.dir;
        const tangentZ = Math.cos(tr.angle) * tr.dir;
        tr.mesh.rotation.y = Math.atan2(tangentX, tangentZ);
      }

      // Animate Cyberpunk Holographic Billboards (subtle flicker & threat-reactive pulse)
      for (const hb of this.worldRefs.holoBillboards) {
        const flicker = Math.sin(nowSec * 3.2 + hb.phase) * 0.06;
        const glitchDrop =
          this.lastThreatLevel >= 4 && Math.sin(nowSec * 29 + hb.phase) > 0.94 ? 0.35 : 0;
        hb.mat.opacity = Math.max(0.18, hb.baseOpacity + flicker - glitchDrop);
        if (endTheme === 'dawn' && dawnP > 0.3) {
          hb.mat.opacity *= Math.max(0, 1 - dawnP * 1.1);
        }
      }

      // Volumetric Dawn / Aurora God-Ray Shafts fade in during Dawn or Symbiosis endings
      if (endTheme === 'dawn' || endTheme === 'symbiosis') {
        for (const gr of this.worldRefs.dawnGodRays) {
          gr.visible = dawnP > 0.05;
          (gr.material as THREE.MeshBasicMaterial).opacity = Math.min(0.11, dawnP * 0.12);
        }
      }

      // Choreograph Valkyrie UNS Arclight Rescue Shuttle during Opening Flyby & Ending Descent
      const shuttle = this.worldRefs.rescueShuttle;
      const activeSeq = this.cinematic.getSequence();
      if (activeSeq === 'opening') {
        const opT = this.cinematic.getHudState().elapsed;
        if (opT > 2.4 && opT < 5.8) {
          shuttle.visible = true;
          const p = (opT - 2.4) / 3.4;
          shuttle.position.set(-48 + p * 98, 22 - Math.sin(p * Math.PI) * 5, -14 + p * 8);
          shuttle.rotation.set(0.05, Math.PI / 2 - 0.1, -0.14);
        } else {
          shuttle.visible = false;
        }
      } else if (activeSeq === 'dawn' || activeSeq === 'symbiosis') {
        shuttle.visible = true;
        const targetX = activeSeq === 'dawn' ? -8 : 10;
        const targetY = 23 + Math.sin(nowSec * 1.6) * 0.8;
        const targetZ = -20;
        shuttle.position.x += (targetX - shuttle.position.x) * Math.min(1, dt * 0.95);
        shuttle.position.y += (targetY - shuttle.position.y) * Math.min(1, dt * 0.8);
        shuttle.position.z += (targetZ - shuttle.position.z) * Math.min(1, dt * 0.95);
        shuttle.lookAt(0, 14, -35);
      } else if (!this.serverShutdownActive) {
        shuttle.visible = false;
      }
    }

    // Dynamic AAA Film-Grading & AC-130 FLIR Thermal Post-Process Uniforms
    if (this.gradePass) {
      const gu = this.gradePass.uniforms;
      gu.uTime.value = nowSec;
      gu.uFlirMode.value = this.isAc130Active()
        ? this.ac130ThermalMode === 'whot'
          ? 1.0
          : 2.0
        : 0.0;
      const actionPulse =
        (this.player.dashTimer > 0 ? 0.0042 : 0) +
        (this.player.slideTimer > 0 ? 0.0022 : 0) +
        (this.adrenalineTimer > 0 ? 0.0036 : 0) +
        Math.min(0.0045, this.shake * 0.0055);
      const targetChrom = 0.00065 + actionPulse;
      gu.uChromatic.value += (targetChrom - gu.uChromatic.value) * Math.min(1, dt * 12);
      gu.uVignette.value = this.player.ads ? 0.36 : this.vatsActive ? 0.42 : 0.27;
      const tint = gu.uTint.value as THREE.Vector3;
      if (dawnP > 0.05 && endTheme === 'dawn') {
        tint.set(1.04, 1.01, 0.94);
      } else if (dawnP > 0.05 && endTheme === 'symbiosis') {
        tint.set(0.94, 1.05, 1.03);
      } else if (dawnP > 0.05 && endTheme === 'ascension') {
        tint.set(1.08, 0.94, 0.92);
      } else if (this.vatsActive) {
        tint.set(0.93, 1.05, 0.97);
      } else {
        tint.set(1.0, 1.0, 1.0);
      }
    }
  }

  private tick = (): void => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = Math.min((now - this.lastNow) / 1000, 0.25);
    this.lastNow = now;

    if (this.phase === 'playing') {
      this.viewmodel.pivot.visible = true;
      this.updateSimulation(rawDt);
    } else if (this.phase === 'title') {
      // Cinematic hero orbital glide showcasing OMNI-CORE Citadel, wet neon conduits, billboards & aerial traffic
      this.viewmodel.pivot.visible = false;
      this.laserBeam.visible = false;
      this.laserDot.visible = false;
      const t = now * 0.00016;
      this.camera.position.set(
        Math.sin(t) * 26,
        11.2 + Math.sin(t * 1.7) * 3.2,
        18 + Math.cos(t * 0.85) * 14
      );
      this.camera.lookAt(Math.sin(t * 0.5) * 4, 10.5, -28);
      this.updateAtmosphere(Math.min(rawDt, 0.05));
    } else {
      this.viewmodel.pivot.visible = true;
    }

    if (this.composer && !this.isSoftwareGl) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    this.hudEmitAccum += rawDt;
    if (this.hudEmitAccum >= 0.075) {
      this.hudEmitAccum = 0;
      this.emitHudSnapshot(false);
    }

    this.scheduleNextFrame();
  };

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 90);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const st = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (st === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private buildHolotapeBeacons(): void {
    const plinthMat = this.matCache.darkIron;
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    });
    const cassetteShellMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.85,
      roughness: 0.25,
      metalness: 0.75,
    });
    const labelMat = new THREE.MeshBasicMaterial({ color: 0xfef3c7 });
    const reelMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: 0xfbbf24,
      emissiveIntensity: 0.45,
      roughness: 0.35,
      metalness: 0.6,
    });

    for (const data of WASTELAND_HOLOTAPES) {
      const group = new THREE.Group();
      group.position.set(data.x, 0, data.z);

      // Rugged Fallout terminal pedestal
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.68, 0.68, 8), plinthMat);
      base.position.y = 0.34;
      group.add(base);

      // Spinning golden 3D Cassette Tape object (Fallout Holotape)
      const cassette = new THREE.Group();
      cassette.position.y = 1.32;

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.48, 0.14), cassetteShellMat);
      cassette.add(body);

      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.155), labelMat);
      strip.position.y = 0.1;
      cassette.add(strip);

      const reels: THREE.Mesh[] = [];
      for (const rx of [-0.17, 0.17]) {
        const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.17, 10), reelMat);
        reel.rotation.x = Math.PI / 2;
        reel.position.set(rx, -0.05, 0);
        cassette.add(reel);
        reels.push(reel);
      }

      group.add(cassette);

      // Vertical skyward golden locator beam
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.36, 5.8, 10, 1, true), beaconMat);
      beam.position.y = 2.9;
      group.add(beam);

      const ring = new THREE.Mesh(new THREE.RingGeometry(0.68, 0.92, 18), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      group.add(ring);

      this.scene.add(group);
      this.holotapes.push({ data, group, cube: cassette, reels, collected: false });
    }
  }

  private updateHolotapes(dt: number): void {
    const nowSec = performance.now() * 0.001;
    for (let i = 0; i < this.holotapes.length; i++) {
      const ht = this.holotapes[i];
      if (ht.collected) continue;
      ht.cube.rotation.y += dt * 1.85;
      ht.cube.position.y = 1.32 + Math.sin(nowSec * 3.1 + i) * 0.14;
      for (const reel of ht.reels) {
        reel.rotation.y += dt * 5.2;
      }

      if (this.phase === 'playing' && this.player.alive && !this.cinematic.isCutsceneActive()) {
        const dist = Math.hypot(this.player.x - ht.data.x, this.player.z - ht.data.z);
        if (dist < 3.4) {
          ht.collected = true;
          ht.group.visible = false;
          this.unlockedHolotapeIds.add(ht.data.id);
          this.analytics.holotapesFound++;
          this.audio.playHolotapePickup();

          // Meaningful wasteland reward per Holotape
          this.player.armor = Math.min(this.player.maxArmor, this.player.armor + 25);
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + 18);
          this.vatsEnergy = Math.min(100, this.vatsEnergy + 30);
          if (ht.data.id === 'ht-05') {
            this.supplyDropCd = 0;
          }
          if (i % 2 === 1) {
            this.player.grenades = Math.min(4, this.player.grenades + 1);
          }

          // Non-blocking sequential 3-line Holotape Audio Log playback!
          const lines = ht.data.lines;
          this.cinematic.enqueueSubtitles(
            lines.map((lineText, idx) => ({
              speaker: `${ht.data.code} [${ht.data.title}]`,
              role: `${ht.data.speaker} · ${ht.data.role}`,
              sender: 'holotape' as const,
              accentCss: '#f59e0b',
              text: lineText,
              duration: 4.8,
              lineIndex: idx + 1,
              lineTotal: lines.length,
            })),
            true
          );

          this.showCallout(
            `${ht.data.code} 회수 · ${ht.data.title} (+25 ARMOR · +30% V.A.T.S.)`,
            '#fbbf24',
            2.4
          );
          this.emitHudSnapshot(true);
        }
      }
    }
  }

  private spawnSpriteBurst(
    pos: THREE.Vector3,
    kind: 'explosion' | 'spark' | 'blood' | 'emp',
    startScale: number,
    endScale: number,
    maxLife: number,
    vel: THREE.Vector3
  ): void {
    const map =
      kind === 'explosion'
        ? this.textures.vfxExplosionMap
        : kind === 'spark'
          ? this.textures.vfxSparkMap
          : kind === 'emp'
            ? this.textures.vfxEmpMap
            : this.textures.vfxBloodMistMap;
    const mat = new THREE.SpriteMaterial({
      map,
      transparent: true,
      opacity: 0.95,
      blending: kind === 'blood' ? THREE.NormalBlending : THREE.AdditiveBlending,
      depthWrite: false,
      rotation: Math.random() * Math.PI * 2,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(pos);
    sprite.scale.set(startScale, startScale, 1);
    this.scene.add(sprite);
    this.spriteBursts.push({
      sprite,
      vel,
      startScale,
      endScale,
      life: maxLife,
      maxLife,
    });
    if (this.spriteBursts.length > 48) {
      const old = this.spriteBursts.shift();
      if (old) {
        this.scene.remove(old.sprite);
        old.sprite.material.dispose();
      }
    }
  }

  private spawnFloatingDamage(
    worldPos: THREE.Vector3,
    text: string,
    color: string,
    isCrit: boolean,
    subLabel?: string
  ): void {
    this.floatingDmgSeq++;
    this.floatingDamages.push({
      id: this.floatingDmgSeq,
      worldPos: worldPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.35, 0.25, (Math.random() - 0.5) * 0.35)),
      text,
      subLabel,
      color,
      isCrit,
      life: isCrit ? 0.85 : 0.62,
      maxLife: isCrit ? 0.85 : 0.62,
    });
    if (this.floatingDamages.length > 18) {
      this.floatingDamages.shift();
    }
  }

  private recordPartBreakdown(part: BodyPart): void {
    if (part === 'head') this.analytics.partBreakdown.head++;
    else if (part === 'leftArm' || part === 'rightArm') this.analytics.partBreakdown.arm++;
    else if (part === 'leftLeg' || part === 'rightLeg') this.analytics.partBreakdown.leg++;
    else if (part === 'armorFront' || part === 'armorLeft' || part === 'armorRight') {
      this.analytics.partBreakdown.armor++;
    }
  }

  private recordTimelineSnapshot(): void {
    const tSec = Math.max(0, Math.round(this.time));
    this.lastBucketSec = this.time;
    const prev = this.analytics.timeline[this.analytics.timeline.length - 1];
    if (prev && prev.timeSec === tSec) {
      prev.kills = this.kills;
      prev.dismembers = this.dismembers;
      return;
    }
    this.analytics.timeline.push({
      timeSec: tSec,
      label: formatClock(tSec),
      kills: this.kills,
      dismembers: this.dismembers,
    });
    if (this.analytics.timeline.length > 24) {
      this.analytics.timeline.shift();
    }
  }

  private projectFloatingDamages(): FloatingDamageNumber[] {
    if (this.floatingDamages.length === 0) return [];
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const projected: FloatingDamageNumber[] = [];
    for (let i = 0; i < this.floatingDamages.length; i++) {
      const fd = this.floatingDamages[i];
      this._v4.copy(fd.worldPos).project(this.camera);
      if (this._v4.z < -1 || this._v4.z > 1) continue;
      const sx = ((this._v4.x + 1) * 0.5) * w;
      const sy = ((-this._v4.y + 1) * 0.5) * h;
      if (sx < -40 || sx > w + 40 || sy < -40 || sy > h + 40) continue;
      projected.push({
        id: fd.id,
        text: fd.text,
        subLabel: fd.subLabel,
        color: fd.color,
        isCrit: fd.isCrit,
        screenX: Math.round(sx),
        screenY: Math.round(sy),
        age: Math.max(0, Math.min(1, 1 - fd.life / fd.maxLife)),
        opacity: Math.max(0, Math.min(1, fd.life / fd.maxLife)),
      });
    }
    return projected;
  }

  private computeCompassContacts(): CompassContact[] {
    if (this.phase !== 'playing') return [];
    const contacts: CompassContact[] = [];
    const fx = -Math.sin(this.player.yaw);
    const fz = -Math.cos(this.player.yaw);
    const rx = Math.cos(this.player.yaw);
    const rz = -Math.sin(this.player.yaw);

    for (let i = 0; i < this.units.length; i++) {
      const u = this.units[i];
      if (!u.alive) continue;
      const dx = u.x - this.player.x;
      const dz = u.z - this.player.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 62 && !u.isBoss) continue;
      const fwdDot = dx * fx + dz * fz;
      const rightDot = dx * rx + dz * rz;
      const relDeg = (Math.atan2(rightDot, fwdDot) * 180) / Math.PI;
      contacts.push({
        id: u.id,
        relativeDeg: Math.round(relDeg),
        distance: Math.round(dist),
        faction: u.faction,
        isBoss: u.isBoss,
      });
    }

    // Add uncollected Wasteland Holotape signals to the compass
    for (let i = 0; i < this.holotapes.length; i++) {
      const ht = this.holotapes[i];
      if (ht.collected) continue;
      const dx = ht.data.x - this.player.x;
      const dz = ht.data.z - this.player.z;
      const dist = Math.hypot(dx, dz);
      const fwdDot = dx * fx + dz * fz;
      const rightDot = dx * rx + dz * rz;
      const relDeg = (Math.atan2(rightDot, fwdDot) * 180) / Math.PI;
      contacts.push({
        id: 9000 + i,
        relativeDeg: Math.round(relDeg),
        distance: Math.round(dist),
        faction: Faction.PLAYER,
        isBoss: false,
        isHolotape: true,
      });
    }

    // Add active Firewall Relay Pylons to compass
    if (this.worldRefs) {
      for (const r of this.worldRefs.relays) {
        if (!r.alive) continue;
        const dx = r.x - this.player.x;
        const dz = r.z - this.player.z;
        const dist = Math.hypot(dx, dz);
        const fwdDot = dx * fx + dz * fz;
        const rightDot = dx * rx + dz * rz;
        const relDeg = (Math.atan2(rightDot, fwdDot) * 180) / Math.PI;
        contacts.push({
          id: 9500 + r.id,
          relativeDeg: Math.round(relDeg),
          distance: Math.round(dist),
          faction: Faction.ROBOT,
          isBoss: false,
          isRelay: true,
        });
      }

      for (const t of this.worldRefs.turrets) {
        const dx = t.x - this.player.x;
        const dz = t.z - this.player.z;
        const dist = Math.hypot(dx, dz);
        const fwdDot = dx * fx + dz * fz;
        const rightDot = dx * rx + dz * rz;
        contacts.push({
          id: 9700 + t.id,
          relativeDeg: Math.round((Math.atan2(rightDot, fwdDot) * 180) / Math.PI),
          distance: Math.round(dist),
          faction: Faction.PLAYER,
          isBoss: false,
          isTurret: true,
        });
      }

      for (let i = 0; i < this.supplyDrops.length; i++) {
        const sd = this.supplyDrops[i];
        const dx = sd.x - this.player.x;
        const dz = sd.z - this.player.z;
        const dist = Math.hypot(dx, dz);
        const fwdDot = dx * fx + dz * fz;
        const rightDot = dx * rx + dz * rz;
        contacts.push({
          id: 9800 + i,
          relativeDeg: Math.round((Math.atan2(rightDot, fwdDot) * 180) / Math.PI),
          distance: Math.round(dist),
          faction: Faction.PLAYER,
          isBoss: false,
          isSupply: true,
        });
      }

      // Add OMNI-CORE Central AI Server Beacon to compass
      const cit = this.worldRefs.citadel;
      const cdx = cit.terminalX - this.player.x;
      const cdz = cit.terminalZ - this.player.z;
      const cdist = Math.hypot(cdx, cdz);
      const cfwd = cdx * fx + cdz * fz;
      const cright = cdx * rx + cdz * rz;
      contacts.push({
        id: 9999,
        relativeDeg: Math.round((Math.atan2(cright, cfwd) * 180) / Math.PI),
        distance: Math.round(cdist),
        faction: Faction.PLAYER,
        isBoss: false,
        isServerCore: true,
      });
    }

    contacts.sort((a, b) => {
      if (Boolean(a.isServerCore) !== Boolean(b.isServerCore)) return a.isServerCore ? -1 : 1;
      if (Boolean(a.isRelay) !== Boolean(b.isRelay)) return a.isRelay ? -1 : 1;
      if (a.isBoss !== b.isBoss) return a.isBoss ? -1 : 1;
      if (Boolean(a.isHolotape) !== Boolean(b.isHolotape)) return a.isHolotape ? -1 : 1;
      return a.distance - b.distance;
    });
    return contacts.slice(0, 14);
  }

  private updateAimTelemetryAndLaser(suppressLaser: boolean): void {
    const origin = this.camera.position;
    const dir = this._v1;
    this.camera.getWorldDirection(dir);

    this.raycaster.set(origin, dir);
    this.raycaster.far = 140;

    const worldHits = this.raycaster.intersectObjects(this.worldHitMeshes, false);
    const enemyHits = this.raycaster.intersectObjects(this.enemyHitMeshes, false);
    const wHit = worldHits[0];
    const eHit = enemyHits[0];

    let hitDist = 90;
    let hitPoint = this._v2.copy(origin).addScaledVector(dir, hitDist);
    let nextTarget: AimTargetTelemetry | null = null;

    if (eHit && (!wHit || eHit.distance <= wHit.distance)) {
      hitDist = eHit.distance;
      hitPoint.copy(eHit.point);
      const u = eHit.object.userData?.unit as ActiveUnit | undefined;
      const part = eHit.object.userData?.part as BodyPart | undefined;
      if (u && u.alive) {
        const fMeta = FACTION_META[u.faction] ?? FACTION_META[Faction.ROBOT];
        nextTarget = {
          name: u.name,
          roleTag: u.isBoss ? `BOSS · PHASE ${u.bossPhase}` : fMeta.name,
          hpPct: Math.max(0, Math.round((u.hp / Math.max(1, u.maxHp)) * 100)),
          distanceM: Math.round(hitDist * 10) / 10,
          accentCss: u.isBoss ? '#ff4422' : fMeta.cssColor,
          isBoss: u.isBoss,
          weakpointHint:
            part === 'head'
              ? 'HEAD 2.5x'
              : part === 'core'
                ? 'CORE 2.2x'
                : part === 'leftArm' || part === 'rightArm'
                  ? 'ARM DISMEMBER'
                  : undefined,
        };
      }
    } else if (wHit) {
      hitDist = wHit.distance;
      hitPoint.copy(wHit.point);
      const ud = wHit.object.userData;
      if (ud?.relay && (ud.relay as RelayPylonEntity).alive) {
        const rel = ud.relay as RelayPylonEntity;
        nextTarget = {
          name: rel.label,
          roleTag: 'FIREWALL RELAY',
          hpPct: Math.max(0, Math.round((rel.hp / Math.max(1, rel.maxHp)) * 100)),
          distanceM: Math.round(hitDist * 10) / 10,
          accentCss: '#ff4422',
          isBoss: false,
          weakpointHint: 'DESTRUCTIBLE',
        };
      } else if (ud?.isServerCore && this.coreShieldDown) {
        nextTarget = {
          name: 'OMNI-CORE 중앙 메인프레임',
          roleTag: 'PRIMARY TARGET',
          hpPct: Math.max(0, Math.round((this.coreHp / Math.max(1, this.coreMaxHp)) * 100)),
          distanceM: Math.round(hitDist * 10) / 10,
          accentCss: '#38d9ff',
          isBoss: true,
          weakpointHint: 'SHIELD DOWN',
        };
      }
    }

    this.aimDistanceM = Math.round(hitDist * 10) / 10;
    this.aimTarget = nextTarget;

    // 3D PEQ Tactical Laser Sight on Rifle [0], Railgun [2] & Tesla [5]
    const wId = this.player.wpnIdx;
    const laserEnabled =
      !suppressLaser &&
      !this.cinematic.isCutsceneActive() &&
      this.player.alive &&
      (wId === 0 || wId === 2 || wId === 5) &&
      this.inspectTimer <= 0;

    if (!laserEnabled) {
      this.laserBeam.visible = false;
      this.laserDot.visible = false;
      return;
    }

    const laserHex = wId === 0 ? 0xff3b3b : 0x38d9ff;
    (this.laserBeam.material as THREE.LineBasicMaterial).color.setHex(laserHex);
    (this.laserBeam.material as THREE.LineBasicMaterial).opacity = this.player.ads ? 0.24 : 0.34;
    (this.laserDot.material as THREE.MeshBasicMaterial).color.setHex(laserHex);

    // Emit beam cleanly from weapon's side PEQ laser module in world space
    const startLocal = this._v3.set(0.056, 0.016, -0.5);
    this.viewmodel.pivot.localToWorld(startLocal);
    const posAttr = this.laserBeam.geometry.attributes.position as THREE.BufferAttribute;
    posAttr.setXYZ(0, startLocal.x, startLocal.y, startLocal.z);
    posAttr.setXYZ(1, hitPoint.x, hitPoint.y, hitPoint.z);
    posAttr.needsUpdate = true;

    this.laserBeam.visible = true;
    const showDot = hitDist < 85;
    this.laserDot.visible = showDot;
    if (showDot) {
      this.laserDot.position.copy(hitPoint).addScaledVector(dir, -0.06);
      const dotScale = Math.max(0.55, Math.min(2.2, hitDist * 0.045));
      this.laserDot.scale.setScalar(dotScale);
    }
  }

  private projectWorldWaypoints(): WorldWaypointMarker[] {
    if (
      this.phase !== 'playing' ||
      this.cinematic.isCutsceneActive() ||
      !this.worldRefs
    ) {
      return [];
    }
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const cx = w * 0.5;
    const cy = h * 0.5;
    const out: WorldWaypointMarker[] = [];

    const pushMarker = (
      id: string,
      label: string,
      wx: number,
      wy: number,
      wz: number,
      accentCss: string,
      kind: WorldWaypointMarker['kind']
    ) => {
      const dist = Math.hypot(wx - this.player.x, wz - this.player.z);
      if (dist < 4.5) return;
      const p = this._v4.set(wx, wy, wz).project(this.camera);
      if (p.z >= 1 || p.z < -1) return;
      const sx = (p.x * 0.5 + 0.5) * w;
      const sy = (-p.y * 0.5 + 0.5) * h;
      if (sx < 44 || sx > w - 44 || sy < 72 || sy > h - 120) return;

      // Auto-fade near center reticle so aiming & scopes are NEVER obstructed!
      const centerDist = Math.hypot(sx - cx, sy - cy);
      const fade = Math.max(0.14, Math.min(0.92, (centerDist - 38) / 96));
      out.push({
        id,
        label,
        distanceM: Math.round(dist),
        screenX: Math.round(sx),
        screenY: Math.round(sy),
        accentCss,
        kind,
        opacity: Math.round(fade * 100) / 100,
      });
    };

    if (this.gameMode === 'campaign') {
      if (this.missionStage === 'm2_alley' && this.units.every((u) => !u.alive)) {
        const bd = this.worldRefs.euljiroBreachDoor;
        pushMarker('wp-breach', 'C4 브리칭 [F]', bd.x, 2.3, bd.z, '#f5b342', 'core');
      } else if (this.missionStage === 'm4_sacrifice_crisis') {
        pushMarker('wp-rescue', '소재우 중사 구출 [F]', -3.8, 2.1, -23.2, '#2ee6a6', 'supply');
      } else if (this.missionStage === 'm4_final_core' && !this.serverShutdownActive) {
        const cit = this.worldRefs.citadel;
        pushMarker('wp-core', 'OMNI-CORE 접속 [F]', cit.terminalX, 5.2, cit.terminalZ, '#38d9ff', 'core');
      }
    }

    for (let i = 0; i < this.supplyDrops.length; i++) {
      const sd = this.supplyDrops[i];
      pushMarker(`wp-sup-${i}`, '발키리 보급', sd.x, sd.y + 2.4, sd.z, '#2ee6a6', 'supply');
    }

    for (const t of this.worldRefs.turrets) {
      if (!t.hacked) {
        const td = Math.hypot(t.x - this.player.x, t.z - this.player.z);
        if (td < 32) {
          pushMarker(`wp-tur-${t.id}`, '포탑 해킹 [F]', t.x, 2.8, t.z, '#2dd4bf', 'turret');
        }
      }
    }

    return out.slice(0, 6);
  }

  private computeMinimapDots(): MinimapDot[] {
    if (this.phase !== 'playing' && this.phase !== 'paused') return [];
    const dots: MinimapDot[] = [];
    if (this.worldRefs) {
      dots.push({
        id: 'core',
        x: this.worldRefs.citadel.x,
        z: this.worldRefs.citadel.z,
        kind: 'core',
      });
      for (const r of this.worldRefs.relays) {
        if (r.alive) {
          dots.push({ id: `relay-${r.id}`, x: r.x, z: r.z, kind: 'relay' });
        }
      }
      for (const t of this.worldRefs.turrets) {
        dots.push({ id: `turret-${t.id}`, x: t.x, z: t.z, kind: 'turret' });
      }
    }
    for (let i = 0; i < this.supplyDrops.length; i++) {
      const sd = this.supplyDrops[i];
      dots.push({ id: `supply-${i}`, x: sd.x, z: sd.z, kind: 'supply' });
    }
    for (const ht of this.holotapes) {
      if (!ht.collected) {
        dots.push({ id: ht.data.id, x: ht.data.x, z: ht.data.z, kind: 'holotape' });
      }
    }
    for (const u of this.units) {
      if (!u.alive) continue;
      dots.push({
        id: `u-${u.id}`,
        x: u.x,
        z: u.z,
        kind: u.isBoss
          ? 'boss'
          : u.faction === Faction.RAIDER
            ? 'raider'
            : u.faction === Faction.SYNDICATE
              ? 'syndicate'
              : 'robot',
      });
    }
    return dots;
  }

  private emitHudSnapshot(force: boolean): void {
    if (!force && this.phase === 'title') return;
    const w = WEAPONS[this.player.wpnIdx];
    const gloryTgt = this.phase === 'playing' && !this.vatsActive ? this.findGloryKillTarget() : null;
    const boss = this.units.find((u) => u.isBoss && u.alive);
    const lowHpIntensity =
      this.player.hp < 50 ? Math.min(1, (1 - this.player.hp / 50) * 0.95) : 0;
    const act = getStoryActForWave(this.wave);
    const relaysTotal = this.worldRefs?.relays.length ?? 3;
    const coreHpPct = Math.round((this.coreHp / Math.max(1, this.coreMaxHp)) * 100);
    const aliveHostiles = this.units.filter((u) => u.alive).length;
    const effectiveRemaining = this.isAc130Active()
      ? Math.max(0, this.stageTotalHostiles - this.ac130KilledCount)
      : aliveHostiles;
    const campaignObj = computeCampaignObjectiveText(
      this.missionId,
      this.missionStage,
      effectiveRemaining,
      this.stageTotalHostiles,
      coreHpPct,
      this.crisisTimer
    );
    const objective =
      this.gameMode === 'campaign'
        ? { text: campaignObj.detail, progressPct: campaignObj.progressPct }
        : computeMissionObjective(
            this.wave,
            this.kills,
            boss ? boss.name : null,
            this.relaysDestroyed,
            relaysTotal,
            this.coreShieldDown,
            coreHpPct,
            this.gameMode
          );
    const playerYawDeg = (((-this.player.yaw * 180) / Math.PI) % 360 + 360) % 360;
    const cit = this.worldRefs?.citadel;
    const coreDistance = cit
      ? Math.round(Math.hypot(this.player.x - cit.terminalX, this.player.z - cit.terminalZ))
      : 60;
    const canShutdownCore =
      this.gameMode === 'campaign' &&
      this.missionStage === 'm4_final_core' &&
      this.coreShieldDown &&
      !this.serverShutdownActive &&
      !this.cinematic.isCutsceneActive() &&
      coreDistance <= 10.5;
    const threatSt = computeThreatState(this.threatPoints);
    const styleSt = computeStyleRank(this.comboCount, this.styleScore);
    const nearTurret = this.findNearHackableTurret();
    const turretsTotal = this.worldRefs?.turrets.length ?? 2;
    const turretsHacked = this.worldRefs
      ? this.worldRefs.turrets.filter((t) => t.hacked).length
      : 0;
    const dashChargePct =
      this.player.dashCharges >= DASH_MAX_CHARGES
        ? 100
        : Math.round((this.player.dashRechargeTimer / DASH_RECHARGE_SEC) * 100);
    const supplyDropCooldownPct =
      this.supplyDropCd <= 0 ? 100 : Math.round((1 - this.supplyDropCd / 36) * 100);

    this.onHudUpdate({
      phase: this.phase,
      gameMode: this.gameMode,
      missionId: this.missionId,
      missionStage: this.missionStage,
      missionTitle: campaignObj.title,
      checkpointSeq: this.checkpointSeq,
      checkpointLabel: this.checkpointLabel,
      campaignChoices: { ...this.campaignChoices },
      campaignPrompt: this.campaignPrompt ? { ...this.campaignPrompt } : null,
      autoEndingReason: this.autoEndingReason,
      ac130: this.buildAc130HudState(),
      tank: this.buildTankHudState(),
      heliRide: this.buildHeliRideHudState(),
      squadTags: this.projectSquadmateTags(),
      firstPersonSetpieceActive: this.isFirstPersonSetpieceActive(),
      breachPromptVisible: this.isBreachDoorInRange(),
      armorPlates: this.armorPlates,
      maxArmorPlates: this.maxArmorPlates,
      platingActive: this.platingTimer > 0,
      platingPct:
        this.platingTimer > 0
          ? Math.round((1 - this.platingTimer / this.platingDuration) * 100)
          : 0,
      smokeGrenades: this.smokeGrenades,
      maxSmokeGrenades: this.maxSmokeGrenades,
      inSmokeCover: this.isConcealedBySmoke(this.player.x, this.player.z),
      squadOrder: this.squadOrder,
      weaponAttachment: this.weaponAttachment,
      wave: this.wave,
      actNumber: this.coreShieldDown ? 4 : act.actNumber,
      actTitle: this.coreShieldDown ? '제로 아워' : act.title,
      objectiveText: objective.text,
      objectiveProgressPct: objective.progressPct,
      holotapesFound: this.analytics.holotapesFound,
      holotapesTotal: this.analytics.holotapesTotal,
      unlockedHolotapeIds: Array.from(this.unlockedHolotapeIds),
      relaysDestroyed: this.relaysDestroyed,
      relaysTotal,
      coreShieldDown: this.coreShieldDown,
      coreHp: Math.ceil(this.coreHp),
      coreMaxHp: this.coreMaxHp,
      canShutdownCore,
      coreDistance,
      serverShutdownActive: this.serverShutdownActive,
      choiceActive: this.cinematic.getSequence() === 'choice',
      endingId: this.endingId,
      kills: this.kills,
      dismembers: this.dismembers,
      executions: this.executions,
      survivalTime: this.time,
      hp: Math.ceil(this.player.hp),
      maxHp: this.player.maxHp,
      armor: Math.ceil(this.player.armor),
      maxArmor: this.player.maxArmor,
      weaponIdx: this.player.wpnIdx,
      ammo: this.player.ammo[this.player.wpnIdx],
      mag: this.getEffectiveMag(this.player.wpnIdx),
      reloading: this.player.reloadTimer > 0,
      ...(() => {
        const isRel = this.player.reloadTimer > 0;
        const prog = isRel
          ? 1 - this.player.reloadTimer / Math.max(0.01, this.player.reloadDur)
          : 0;
        const rHud = evaluateWeaponReload(
          this.player.wpnIdx,
          prog,
          isRel,
          this.player.reloadIsTactical,
          this.player.reloadDur
        ).hud;
        return {
          reloadPct: rHud.overallPct,
          reloadPhase: rHud.phase,
          reloadStageGroup: rHud.stageGroup,
          reloadPhaseLabel: rHud.phaseLabel,
          reloadStageBadge: rHud.stageBadge,
          reloadPhasePct: Math.round(rHud.phaseProgress * 100),
          reloadEmptyThreshold: rHud.emptyThreshold,
          reloadAccentCss: rHud.accentCss,
          reloadIsTactical: rHud.isTactical,
          reloadSpeedBonusPct: rHud.speedBonusPct,
          reloadDurationSec: rHud.durationSec,
        };
      })(),
      grenades: this.player.grenades,
      ads: this.player.ads,
      adsBlend: Math.round(this.adsBlend * 100) / 100,
      scopedOpticActive:
        this.player.wpnIdx === 2 &&
        this.adsBlend > 0.78 &&
        this.player.reloadTimer <= 0 &&
        !this.vatsActive &&
        !this.cinematic.isCutsceneActive(),
      holdingBreath: this.holdingBreath,
      mounted: this.mounted,
      leanDir: this.leanDir,
      wallBlocked: this.wallBlocked,
      isIndoors: this.isIndoors,
      inspectingWeapon: this.inspectTimer > 0,
      aimDistanceM: this.aimDistanceM,
      aimTarget: this.aimTarget,
      waypoints: this.projectWorldWaypoints(),
      medals: this.activeMedals.map((m) => ({
        id: m.id,
        title: m.title,
        subtitle: m.subtitle,
        accentCss: m.accentCss,
      })),
      wantedFlashSeq: this.wantedFlashSeq,
      sprinting: this.player.sprinting,
      isSliding: this.player.slideTimer > 0,
      isDashing: this.player.dashTimer > 0,
      dashCharges: this.player.dashCharges,
      dashMaxCharges: DASH_MAX_CHARGES,
      dashChargePct,
      crosshairGap: Math.round(
        8 + (this.player.ads ? 0 : this.player.sprinting ? 14 : 8) + this.player.vmKickZ * 75
      ),
      vatsEnergy: Math.round(this.vatsEnergy),
      vatsActive: this.vatsActive,
      vatsTargets: this.vatsActive ? [...this.vatsTargets] : [],
      killstreak: this.killstreak,
      airstrikeReady: this.airstrikeReady,
      supplyDropReady: this.supplyDropCd <= 0,
      supplyDropCooldownPct,
      overdriveTimer: Math.round(this.overdriveTimer * 10) / 10,
      adrenalineActive: this.adrenalineTimer > 0,
      adrenalineUsed: this.adrenalineUsed,
      threatLevel: threatSt.level,
      threatLabel: threatSt.label,
      threatProgressPct: threatSt.progressPct,
      comboCount: this.comboCount,
      comboTimerPct: Math.max(0, Math.min(100, Math.round((this.comboTimer / 5.6) * 100))),
      styleGrade: styleSt.grade,
      styleLabel: styleSt.label,
      turretsHacked,
      turretsTotal,
      nearHackableTurretName: nearTurret ? nearTurret.name : null,
      killCamActive: this.killCamTimer > 0,
      killCamBanner: this.killCamBanner,
      gloryKillTargetName: gloryTgt ? gloryTgt.name : null,
      alertBanner: this.alertBanner,
      calloutText: this.calloutText,
      calloutColor: this.calloutColor,
      comms: this.cinematic.getActiveSubtitle(),
      cinematic: this.cinematic.getHudState(),
      ttsEnabled: this.ttsEnabled,
      playerYawDeg: Math.round(playerYawDeg),
      playerX: Math.round(this.player.x * 10) / 10,
      playerZ: Math.round(this.player.z * 10) / 10,
      minimapWalls: this.worldRefs?.minimapWalls ?? [],
      minimapDots: this.computeMinimapDots(),
      compassContacts: this.computeCompassContacts(),
      floatingDamages: this.projectFloatingDamages(),
      hitmarkerSeq: this.hitmarkerSeq,
      hitmarkerCrit: this.hitmarkerCrit,
      damageFlashSeq: this.damageFlashSeq,
      damageDirDeg: this.damageDirDeg,
      blastFlashSeq: this.blastFlashSeq,
      empFlashSeq: this.empFlashSeq,
      lowHpIntensity,
      muted: this.audio.isMuted(),
      pointerLocked: this.pointerLocked,
      causeOfDeath: this.causeOfDeath,
      bossName: boss ? boss.name : null,
      bossHpPct: boss ? Math.max(0, Math.round((boss.hp / boss.maxHp) * 100)) : 0,
      bossPhase: boss ? boss.bossPhase : 1,
      killFeed: [...this.killFeed],
      analytics: {
        deaths: this.analytics.deaths,
        shotsFired: this.analytics.shotsFired,
        shotsHit: this.analytics.shotsHit,
        holotapesFound: this.analytics.holotapesFound,
        holotapesTotal: this.analytics.holotapesTotal,
        killsByFaction: { ...this.analytics.killsByFaction },
        partBreakdown: { ...this.analytics.partBreakdown },
        timeline: this.analytics.timeline.map((b) => ({ ...b })),
      },
    });
  }

  // =========================================================================
  // EVENT LISTENERS & CLEANUP
  // =========================================================================
  private onResize = (): void => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = Math.max(1, w) / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
  };

  private onPointerLockChange = (): void => {
    const locked = document.pointerLockElement === this.renderer.domElement;
    this.pointerLocked = locked;
    if (locked) {
      this.pointerLockWasAcquired = true;
      this.pointerLockSkipMove = true;
    } else if (
      this.phase === 'playing' &&
      this.pointerLockWasAcquired &&
      !this.vatsActive &&
      !this.cinematic.isCutsceneActive()
    ) {
      this.pauseGame();
    }
    this.emitHudSnapshot(true);
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (
      this.phase !== 'playing' ||
      this.vatsActive ||
      !this.player.alive ||
      this.cinematic.isCutsceneActive()
    ) {
      return;
    }
    if (document.pointerLockElement === this.renderer.domElement) {
      if (this.pointerLockSkipMove) {
        this.pointerLockSkipMove = false;
        return;
      }
      // Guard against Chromium Pointer Lock synthetic teleport spikes
      if (Math.abs(e.movementX) > 240 || Math.abs(e.movementY) > 240) return;
      const dx = Math.max(-110, Math.min(110, e.movementX));
      const dy = Math.max(-110, Math.min(110, e.movementY));

      // AC-130 FLIR Gunship ground targeting pan via mouse movement
      if (this.isAc130Active()) {
        const orbitR = 46;
        const camX = Math.cos(this.ac130OrbitAngle) * orbitR;
        const camZ = Math.sin(this.ac130OrbitAngle) * orbitR;
        const toCenter = this._v1.set(this.ac130TargetX - camX, 0, this.ac130TargetZ - camZ).normalize();
        const rightV = this._v2.set(-toCenter.z, 0, toCenter.x);
        const panScale = (this.ac130Zoomed ? 0.045 : 0.095) * (this.sens / 0.0022);
        this.ac130TargetX = Math.max(
          -44,
          Math.min(44, this.ac130TargetX + (rightV.x * dx - toCenter.x * dy) * panScale)
        );
        this.ac130TargetZ = Math.max(
          -44,
          Math.min(44, this.ac130TargetZ + (rightV.z * dx - toCenter.z * dy) * panScale)
        );
        return;
      }

      // UH-60K Helicopter Door-Gunner M134 Minigun aiming arc
      if (this.isHeliRideActive()) {
        const hMul = this.mouseRight ? 0.55 : 0.92;
        this.heliRide.aimYawOffset = Math.max(
          -1.22,
          Math.min(1.22, this.heliRide.aimYawOffset - dx * this.sens * hMul)
        );
        this.heliRide.aimPitch = Math.max(
          -1.18,
          Math.min(0.28, this.heliRide.aimPitch - dy * this.sens * hMul)
        );
        return;
      }

      // K2-X Tank Turret 360° independent aiming
      if (this.tank.driving) {
        const tMul = this.tank.gunnerOptic ? 0.42 : 0.85;
        this.player.yaw -= dx * this.sens * tMul;
        this.player.pitch = Math.max(-0.09, Math.min(0.36, this.player.pitch - dy * this.sens * tMul));
        return;
      }

      const mul = this.player.ads ? (this.player.wpnIdx === 2 ? 0.34 : 0.56) : 1.0;
      this.player.yaw -= dx * this.sens * mul;
      this.player.pitch -= dy * this.sens * mul;
      this.player.pitch = Math.max(-1.42, Math.min(1.42, this.player.pitch));
      // Smooth weapon inertia sway
      const swayScale = this.player.ads ? 0.00012 : 0.00042;
      this.player.vmSwayX = Math.max(-0.028, Math.min(0.028, this.player.vmSwayX - dx * swayScale));
      this.player.vmSwayY = Math.max(-0.022, Math.min(0.022, this.player.vmSwayY + dy * swayScale));
    }
  };

  private onCanvasMouseDown = (e: MouseEvent): void => {
    if (this.phase !== 'playing' || !this.player.alive || this.cinematic.isCutsceneActive()) return;
    if (this.vatsActive) return;
    this.audio.init();
    if (document.pointerLockElement !== this.renderer.domElement) {
      this.requestPointerLockSafe();
    }
    if (e.button === 0) {
      this.mouseLeft = true;
      if (this.isAc130Active()) {
        this.fireAc130Cannon();
      } else if (this.tank.driving) {
        this.fireTankCannon();
      } else if (!this.isHeliRideActive()) {
        this.firePlayerWeapon();
      }
    }
    if (e.button === 2) {
      this.mouseRight = true;
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.mouseLeft = false;
    if (e.button === 2) this.mouseRight = false;
  };

  private onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private onWheel = (e: WheelEvent): void => {
    if (this.phase !== 'playing' || this.vatsActive || this.cinematic.isCutsceneActive()) return;
    if (this.isAc130Active()) {
      const next = ((this.ac130WeaponIdx + (e.deltaY > 0 ? 1 : -1) + 3) % 3) as 0 | 1 | 2;
      this.selectAc130Weapon(next);
      return;
    }
    const next = (this.player.wpnIdx + (e.deltaY > 0 ? 1 : -1) + WEAPONS.length) % WEAPONS.length;
    this.selectWeapon(next);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const isRepeat = e.repeat;
    this.keys.add(e.code);

    // Title screen Enter/Space start handshake (respects Prologue / Briefing views)
    if (
      this.phase === 'title' &&
      this.titleHotkeyEnabled &&
      !isRepeat &&
      (e.code === 'Enter' || e.code === 'Space')
    ) {
      e.preventDefault();
      this.startGame();
      return;
    }

    if (!isRepeat && e.code === 'KeyM') {
      this.toggleMute();
      return;
    }

    // During Zero Hour Choice climax, allow [1]/[2]/[3] instant ending decisions
    if (this.phase === 'playing' && this.cinematic.getSequence() === 'choice') {
      if (!isRepeat) {
        if (e.code === 'Digit1') this.chooseEnding('dawn');
        else if (e.code === 'Digit2') this.chooseEnding('symbiosis');
        else if (e.code === 'Digit3') this.chooseEnding('ascension');
      }
      return;
    }

    // [SPACE] instant cinematic skip during any real-time cutscene
    if (this.phase === 'playing' && this.cinematic.isCutsceneActive()) {
      if (!isRepeat && e.code === 'Space') {
        e.preventDefault();
        this.skipCinematic();
      }
      return;
    }

    if (!isRepeat && (e.code === 'KeyP' || e.code === 'Escape')) {
      if (this.phase === 'playing') {
        if (this.vatsActive) {
          this.exitVats();
        } else {
          this.pauseGame();
        }
      } else if (this.phase === 'paused') {
        this.resumeGame();
      }
      return;
    }

    if (this.phase !== 'playing' || !this.player.alive || isRepeat) return;

    // AC-130 FLIR Gunship keyboard controls (1=25mm, 2=40mm, 3=105mm, Q/T=WHOT/BHOT flip)
    if (this.isAc130Active()) {
      if (e.code === 'Digit1') this.selectAc130Weapon(0);
      else if (e.code === 'Digit2') this.selectAc130Weapon(1);
      else if (e.code === 'Digit3') this.selectAc130Weapon(2);
      else if (e.code === 'KeyQ' || e.code === 'KeyT') this.toggleAc130Thermal();
      return;
    }

    // Inside K2-X Black Panther Tank: dedicated armored controls ([F]/[E] dismount, [H] repair, [B] IR smoke, [SPACE] coax MG)
    if (this.tank.driving) {
      if (e.code === 'KeyF' || e.code === 'KeyE') this.exitTank(false);
      else if (e.code === 'KeyH') this.startArmorPlateInsert();
      else if (e.code === 'KeyB') this.throwTacticalSmoke();
      return;
    }

    // During UH-60K Helicopter Door-Gunner Ride, mouse aims & LMB fires M134
    if (this.isHeliRideActive()) {
      return;
    }

    if (e.code === 'Space' && this.player.onGround && !this.isFirstPersonSetpieceActive()) {
      this.player.vy = 8.4;
      this.player.onGround = false;
    } else if (e.code === 'Digit1') this.selectWeapon(0);
    else if (e.code === 'Digit2') this.selectWeapon(1);
    else if (e.code === 'Digit3') this.selectWeapon(2);
    else if (e.code === 'Digit4') this.selectWeapon(3);
    else if (e.code === 'Digit5') this.selectWeapon(4);
    else if (e.code === 'Digit6') this.selectWeapon(5);
    else if (e.code === 'KeyC') this.triggerExoDashOrSlide();
    else if (e.code === 'KeyV') this.callSupplyDrop();
    else if (e.code === 'KeyR') this.startReload();
    else if (e.code === 'KeyG') {
      if (this.gameMode === 'campaign' && this.campaignPrompt) {
        this.resolveCampaignPromptChoice('G');
      } else {
        this.throwGrenade();
      }
    } else if (e.code === 'KeyE' && !this.player.ads) {
      if (this.isTankNearPlayer()) this.enterTank();
      else this.performGloryKill();
    } else if (e.code === 'KeyF') this.tryInteractKey();
    else if (e.code === 'KeyQ' && !this.player.ads) this.toggleVats();
    else if (e.code === 'KeyX') this.callAirstrike();
    else if (e.code === 'KeyH') this.startArmorPlateInsert();
    else if (e.code === 'KeyB') this.throwTacticalSmoke();
    else if (e.code === 'KeyT' && !this.player.ads && this.player.reloadTimer <= 0) {
      this.inspectTimer = 2.4;
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onWindowBlur = (): void => {
    this.clearHeldInputs();
  };

  private onVisibilityChange = (): void => {
    if (document.hidden) this.clearHeldInputs();
  };

  private bindEvents(): void {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('wheel', this.onWheel, { passive: true });
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    this.renderer.domElement.addEventListener('mousedown', this.onCanvasMouseDown);
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.renderer.domElement.removeEventListener('mousedown', this.onCanvasMouseDown);
    this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenu);

    this.exitPointerLockSafe();
    delete (window as unknown as Record<string, unknown>).__ironAshEngine;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
    this.vfx.dispose();
    this.composer?.dispose();
    this.audio.dispose();
    this.textures.dispose();
    this.pbr.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
