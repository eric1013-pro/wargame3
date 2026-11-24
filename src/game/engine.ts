import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { WarAudioEngine } from './audio';
import {
  buildDropshipModel,
  buildEnemyModel,
  buildViewmodelRig,
  EnemyRig,
  ViewmodelRig,
} from './models';
import {
  advanceKillstreak,
  ARENA_HALF_SIZE,
  computeSpawnBalance,
  computeWaveForKills,
  createRagdollConstraints,
  evaluatePartHit,
  FACTION_META,
  formatClock,
  PART_LABELS_KR,
  PART_MULTIPLIERS,
  resolveXZCollision,
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
  BgmMood,
  BodyPart,
  CombatAnalyticsData,
  CommsSender,
  CompassContact,
  Faction,
  FloatingDamageNumber,
  GamePhase,
  GraphicsQuality,
  HudSnapshot,
  KillFeedItem,
  MinimapDot,
  UnitArchetype,
  VatsTargetBox,
  VerletLink,
  VerletNode,
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
  staggerTimer: number;
  burnTimer: number;
  empStunTimer: number;
  walkPhase: number;
  strafeDir: number;
  strafeCd: number;
  hitFlash: number;
  hitFlinch: number;
  fireRecoil: number;
  alive: boolean;
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

const MAX_DECALS = 220;
const MAX_PARTICLES = 350;
const MAX_RAGDOLLS = 16;
const MAX_GIBS = 48;
const MAX_SHELLS = 36;

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

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private vfx!: VolumetricVfxSystem;
  private worldRefs!: BuiltWorldRefs;
  private hemiLight!: THREE.HemisphereLight;
  private sunLight!: THREE.DirectionalLight;
  private lightningLight!: THREE.DirectionalLight;
  private muzzleLight!: THREE.PointLight;
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

  // Campaign Objective: 3 Firewall Relay Pylons -> OMNI-CORE Server Core Breach -> Dawn Ending
  private relaysDestroyed = 0;
  private coreShieldDown = false;
  private coreHp = 600;
  private coreMaxHp = 600;
  private serverShutdownActive = false;
  private relay1FogShift = 0;
  private ttsEnabled = false;
  private _c1 = new THREE.Color();
  private _c2 = new THREE.Color();

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
    this.renderer.toneMappingExposure = 1.24;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.dataset.testid = 'warzone-canvas';
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    // Mandatory Studio Environment Reflections via RoomEnvironment
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.textures = createProceduralTextures(
      this.isSoftwareGl ? 1 : Math.min(8, this.renderer.capabilities.getMaxAnisotropy())
    );
    this.vfx = new VolumetricVfxSystem(this.scene);
    this.initMaterials();
    this.initLighting();
    this.viewmodel = buildViewmodelRig(this.camera, this.textures);
    const muzzleSpriteMat = new THREE.SpriteMaterial({
      map: this.textures.vfxMuzzleMap,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    this.muzzleSprite = new THREE.Sprite(muzzleSpriteMat);
    this.muzzleSprite.position.set(0, 0.04, -1.04);
    this.muzzleSprite.scale.set(0.46, 0.46, 1);
    this.muzzleSprite.visible = false;
    this.viewmodel.pivot.add(this.muzzleSprite);

    this.buildSectorZeroMap();
    this.buildHolotapeBeacons();
    this.initWeatherAndAsh();

    // GPU-only Selective UnrealBloomPass + OutputPass postprocessing (direct render on software WebGL)
    if (!this.isSoftwareGl) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(initW, initH),
        0.42,
        0.48,
        0.8
      );
      this.composer.addPass(bloomPass);
      this.composer.addPass(new OutputPass());
      this.renderer.compile(this.scene, this.camera);
    }

    this.cinematic = new CinematicDirector({
      onHeartbeat: (intensity) => this.audio.playHeartbeat(intensity),
      onBraaam: () => this.audio.playBraaam(),
      onTypewriterTick: () => this.audio.playTypewriterTick(),
      onCommsCue: (sender) => this.audio.playCommsCue(sender),
      onBreachDomeShatter: () => this.handleBreachDomeShatter(),
      onDawnBlackoutImpact: () => this.handleDawnBlackoutImpact(),
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
      // Wet reflective cyber-asphalt floor catches crisp sky & conduit specular reflections
      floor: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: this.textures.asphaltMap,
        bumpMap: this.textures.asphaltBump,
        bumpScale: 0.18,
        roughness: 0.44,
        metalness: 0.38,
        envMapIntensity: 1.4,
      }),
      // Matte structural concrete contrasts strongly against polished metallic armor & wet asphalt
      concrete: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: this.textures.citadelWallMap,
        bumpMap: this.textures.citadelWallBump,
        bumpScale: 0.26,
        roughness: 0.78,
        metalness: 0.16,
        envMapIntensity: 0.85,
      }),
      // Brushed anodized titanium armor plating
      armorPlate: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: this.textures.armorPlateMap,
        bumpMap: this.textures.armorPlateBump,
        bumpScale: 0.22,
        roughness: 0.34,
        metalness: 0.78,
        envMapIntensity: 1.45,
      }),
      darkIron: new THREE.MeshStandardMaterial({
        color: 0x262d3a,
        bumpMap: this.textures.gunmetalBump,
        bumpScale: 0.09,
        roughness: 0.3,
        metalness: 0.88,
        envMapIntensity: 1.5,
      }),
      rustMetal: new THREE.MeshStandardMaterial({
        color: 0x6b3522,
        bumpMap: this.textures.armorPlateBump,
        bumpScale: 0.14,
        roughness: 0.68,
        metalness: 0.56,
      }),
      crate: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: this.textures.crateMap,
        bumpMap: this.textures.crateBump,
        bumpScale: 0.18,
        roughness: 0.62,
        metalness: 0.32,
      }),
      barrel: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: this.textures.barrelMap,
        roughness: 0.34,
        metalness: 0.62,
        envMapIntensity: 1.3,
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
        roughness: 0.2,
        metalness: 0.95,
        envMapIntensity: 1.6,
      }),
    };
  }

  private initLighting(): void {
    // High-contrast AAA tungsten-amber key vs cool titanium-steel sky hemisphere + sculpted rim separation
    this.hemiLight = new THREE.HemisphereLight(0x96bfe8, 0x231a15, 1.08);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffc38c, 1.94);
    this.sunLight.position.set(42, 68, 32);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 165;
    const sc = 56;
    this.sunLight.shadow.camera.left = -sc;
    this.sunLight.shadow.camera.right = sc;
    this.sunLight.shadow.camera.top = sc;
    this.sunLight.shadow.camera.bottom = -sc;
    this.sunLight.shadow.bias = -0.0006;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);

    // Sculpted cool cobalt-silver metallic edge rim light (carves robot armor, barrels & monolith silhouettes)
    const rimLight = new THREE.DirectionalLight(0x7ab4ff, 0.82);
    rimLight.position.set(-48, 36, -42);
    this.scene.add(rimLight);

    // Occasional storm lightning directional flash
    this.lightningLight = new THREE.DirectionalLight(0xc2dcff, 0);
    this.lightningLight.position.set(-40, 80, -35);
    this.scene.add(this.lightningLight);

    this.muzzleLight = new THREE.PointLight(0xffbb55, 0, 18);
    this.muzzleLight.position.set(0.28, -0.1, -1.0);
    this.camera.add(this.muzzleLight);

    this.blastLight = new THREE.PointLight(0xff6b22, 0, 48);
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
    // Steel top & bottom rims for composite silhouette
    const topRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.51, 0.04, 6, 12),
      this.matCache.darkIron
    );
    topRim.rotation.x = Math.PI / 2;
    topRim.position.y = 0.72;
    group.add(topRim);

    this.scene.add(group);
    this.worldHitMeshes.push(group);
    const barrel: ExplosiveBarrel = { x, z, r: 0.6, mesh: group, hp: 32, alive: true };
    group.userData = { isWorld: true, barrel };
    this.explosiveBarrels.push(barrel);
  }

  private buildSectorZeroMap(): void {
    this.worldRefs = buildOmniCoreWorld({
      scene: this.scene,
      textures: this.textures,
      isSoftwareGl: this.isSoftwareGl,
      matCache: this.matCache,
      colliders: this.colliders,
      worldHitMeshes: this.worldHitMeshes,
      addExplosiveBarrel: (bx, bz) => this.addExplosiveBarrel(bx, bz),
    });
    this.searchlights = this.worldRefs.searchlights;
    this.fireLights = this.worldRefs.fireLights;
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

  public startGame(skipIntro = false): void {
    this.audio.init();
    this.resetMatchState();
    this.setPhase('playing');
    if (skipIntro) {
      this.player.equipTimer = 0.55;
      this.cinematic.showChapterCard(
        'ACT 01 // 최후의 맥박',
        'THE LAST PULSE',
        'SECTOR-07 구도심 방벽 · 2089.11.21 · 생존자: 1',
        '#38bdf8',
        4.4
      );
      this.cinematic.enqueueSubtitles(
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
    } else {
      const cit = this.worldRefs?.citadel;
      this.cinematic.startOpening(
        { x: this.player.x, y: this.player.y, z: this.player.z },
        { x: cit?.x ?? 0, y: 12, z: cit?.z ?? -35 }
      );
    }
    this.requestPointerLockSafe();
    this.emitHudSnapshot(true);
  }

  public skipCinematic(): void {
    if (this.cinematic.skip()) {
      this.emitHudSnapshot(true);
    }
  }

  public toggleTts(): boolean {
    this.ttsEnabled = !this.ttsEnabled;
    if (!this.ttsEnabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
    this.emitHudSnapshot(true);
    return this.ttsEnabled;
  }

  public debugTriggerSequence(seq: 'breach' | 'dawn'): void {
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
    } else if (seq === 'dawn') {
      this.coreShieldDown = true;
      this.coreHp = 0;
      this.triggerDawnEnding();
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

  private speakSubtitleIfEnabled(text: string, sender: CommsSender): void {
    if (!this.ttsEnabled || this.audio.isMuted()) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'ko-KR';
      utter.rate = sender === 'arcadia' ? 0.94 : 1.06;
      utter.pitch = sender === 'arcadia' ? 0.65 : sender === 'holotape' ? 0.9 : 1.02;
      utter.volume = 0.72;
      window.speechSynthesis.speak(utter);
    } catch {
      // Ignore speech synthesis errors in sandboxed browsers
    }
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
    for (const sl of this.searchlights) sl.pivot.visible = q === 'ultra';
  }

  public setSensitivity(multiplier: number): void {
    this.sens = 0.0022 * Math.max(0.3, Math.min(3.0, multiplier));
  }

  public toggleMute(): boolean {
    this.audio.init();
    const m = this.audio.toggleMute();
    if (m && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
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
    const sender: CommsSender = script.channel === 'enemy' ? 'arcadia' : 'exo';
    this.cinematic.enqueueSubtitles(
      [
        {
          speaker: script.speaker,
          role: script.role,
          sender,
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
    this.audio.playWeapon(w.sound, 1.0);

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
        this.renderer.domElement.requestPointerLock?.();
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
        this.scene.add(b.mesh);
        if (!this.worldHitMeshes.includes(b.mesh)) this.worldHitMeshes.push(b.mesh);
      }
    }

    // Restore 3 Firewall Relay Pylons & OMNI-CORE Citadel Shield/Power
    this.relaysDestroyed = 0;
    this.coreShieldDown = false;
    this.coreHp = this.coreMaxHp;
    this.serverShutdownActive = false;
    this.relay1FogShift = 0;
    this.cinematic.reset();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
    if (this.worldRefs) {
      for (const r of this.worldRefs.relays) {
        r.alive = true;
        r.hp = r.maxHp;
        r.coreCrystal.visible = true;
        r.beamMesh.visible = true;
        r.ringMesh.visible = true;
        if (!this.worldHitMeshes.includes(r.hitMesh)) this.worldHitMeshes.push(r.hitMesh);
        if (!this.worldHitMeshes.includes(r.coreCrystal)) this.worldHitMeshes.push(r.coreCrystal);
      }
      const cit = this.worldRefs.citadel;
      cit.shieldDome.visible = true;
      cit.coreBeam.visible = true;
      cit.coreWeakpoint.visible = false;
      cit.coreWeakpoint.scale.setScalar(1);
      (cit.coreWeakpoint.material as THREE.MeshBasicMaterial).color.setHex(0xff2244);
      if (!this.worldHitMeshes.includes(cit.coreWeakpointHitMesh)) {
        this.worldHitMeshes.push(cit.coreWeakpointHitMesh);
      }
      (cit.terminalGlow.material as THREE.MeshBasicMaterial).color.setHex(0xff2244);
      cit.terminalLight.color.setHex(0xff2244);
      cit.terminalLight.intensity = 3.6;
      for (const em of cit.emissiveMeshes) em.visible = true;
    }
    // Restore dark cyberpunk storm lighting & rain
    (this.scene.fog as THREE.FogExp2).color.setHex(0x13111c);
    (this.scene.fog as THREE.FogExp2).density = 0.0102;
    (this.scene.background as THREE.Color).setHex(0x0c0e17);
    this.hemiLight.color.setHex(0x88b4e6);
    this.hemiLight.groundColor.setHex(0x381e18);
    this.hemiLight.intensity = 1.08;
    this.sunLight.color.setHex(0xffb884);
    this.sunLight.intensity = 1.75;
    (this.rainLines.material as THREE.LineBasicMaterial).opacity = 0.22;
    if (this.worldRefs) {
      this.worldRefs.skyDomeMat.uniforms.topColor.value.setHex(0x060913);
      this.worldRefs.skyDomeMat.uniforms.midColor.value.setHex(0x16101e);
      this.worldRefs.skyDomeMat.uniforms.horizonColor.value.setHex(0x471b18);
      this.worldRefs.skyDomeMat.uniforms.glowColor.value.setHex(0x9e2124);
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
    this.player.ammo = WEAPONS.map((w) => w.mag);
    this.player.grenades = 3;
    this.player.nadeRegen = 0;
    this.player.fireCd = 0;
    this.player.reloadTimer = 0;
    this.player.reloadIsTactical = false;
    this.player.ads = false;
    this.player.sprinting = false;
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

    this.spawnInitialSkirmish();
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
        const m = u.rig.parts[key];
        if (m && m.visible) this.enemyHitMeshes.push(m);
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
    z: number
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
      [UnitArchetype.ROBOT_STALKER]: '호버 톱날 헌터 드론',
      [UnitArchetype.ROBOT_ENFORCER]: '옴니-가드 레이저 워커',
      [UnitArchetype.ROBOT_TITAN]: 'OMNI-TITAN 워든',
    };

    const baseHpMap: Record<UnitArchetype, number> = {
      [UnitArchetype.RAIDER_BERSERKER]: 85,
      [UnitArchetype.RAIDER_TROOPER]: 75,
      [UnitArchetype.SYNDICATE_COMMANDO]: 90,
      [UnitArchetype.SYNDICATE_HEAVY]: 140,
      [UnitArchetype.ROBOT_STALKER]: 78,
      [UnitArchetype.ROBOT_ENFORCER]: 118,
      [UnitArchetype.ROBOT_TITAN]: 540,
    };

    const speedMap: Record<UnitArchetype, number> = {
      [UnitArchetype.RAIDER_BERSERKER]: 6.2,
      [UnitArchetype.RAIDER_TROOPER]: 5.1,
      [UnitArchetype.SYNDICATE_COMMANDO]: 5.4,
      [UnitArchetype.SYNDICATE_HEAVY]: 3.8,
      [UnitArchetype.ROBOT_STALKER]: 6.8,
      [UnitArchetype.ROBOT_ENFORCER]: 4.6,
      [UnitArchetype.ROBOT_TITAN]: 3.0,
    };

    const fireRateMap: Record<UnitArchetype, number> = {
      [UnitArchetype.RAIDER_BERSERKER]: 1.25,
      [UnitArchetype.RAIDER_TROOPER]: 0.88,
      [UnitArchetype.SYNDICATE_COMMANDO]: 0.54,
      [UnitArchetype.SYNDICATE_HEAVY]: 0.36,
      [UnitArchetype.ROBOT_STALKER]: 0.96,
      [UnitArchetype.ROBOT_ENFORCER]: 0.72,
      [UnitArchetype.ROBOT_TITAN]: 0.28,
    };

    const dmgMap: Record<UnitArchetype, number> = {
      [UnitArchetype.RAIDER_BERSERKER]: 9,
      [UnitArchetype.RAIDER_TROOPER]: 6,
      [UnitArchetype.SYNDICATE_COMMANDO]: 7,
      [UnitArchetype.SYNDICATE_HEAVY]: 8,
      [UnitArchetype.ROBOT_STALKER]: 10,
      [UnitArchetype.ROBOT_ENFORCER]: 9,
      [UnitArchetype.ROBOT_TITAN]: 12,
    };

    const bal = computeSpawnBalance(this.wave, this.relaysDestroyed, this.coreShieldDown);
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
      y: 0,
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
      staggerTimer: 0,
      burnTimer: 0,
      empStunTimer: 0,
      walkPhase: Math.random() * 10,
      strafeDir: Math.random() > 0.5 ? 1 : -1,
      strafeCd: 1.4,
      hitFlash: 0,
      hitFlinch: 0,
      fireRecoil: 0,
      alive: true,
    };

    unit.rig = buildEnemyModel(
      faction,
      archetype,
      scale,
      this.textures.contactShadow,
      unit,
      this.textures
    );
    unit.rig.root.position.set(x, 0, z);
    this.scene.add(unit.rig.root);
    this.units.push(unit);
    this.rebuildHitMeshCache();
    return unit;
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
      life: 2.2,
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
    this.spawnDetachedGib(
      worldPos,
      launchVel,
      sz,
      Array.isArray(mesh.material) ? mesh.material[0] : mesh.material,
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
    this.blastLight.intensity = opts.isArtillery ? 15 : 10;

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

  private damagePlayer(amount: number, sourcePos: THREE.Vector3 | null, killerName: string): void {
    if (
      !this.player.alive ||
      this.phase !== 'playing' ||
      this.player.invulnTimer > 0 ||
      this.cinematic.isInvulnerable()
    ) {
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

    const wPower =
      srcFaction === Faction.PLAYER ? WEAPONS[this.player.wpnIdx].dismemberPower : 0.45;
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
    if (evalRes.shouldDismember) {
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
      }

      const finalTag = dismembered
        ? part === 'head'
          ? '헤드샷 · 두부 파괴'
          : '사지 절단'
        : verb;
      this.pushKillFeed(srcFaction, srcName, u.faction, u.name, finalTag);

      if (srcFaction === Faction.PLAYER) {
        this.kills++;
        if (u.faction === Faction.RAIDER) this.analytics.killsByFaction.raider++;
        else if (u.faction === Faction.SYNDICATE) this.analytics.killsByFaction.syndicate++;
        else this.analytics.killsByFaction.robot++;

        const prevWave = this.wave;
        this.wave = computeWaveForKills(this.kills);
        if (this.wave >= 2 && prevWave < 2) this.triggerRadioComms('wave2', true);
        if (this.wave >= 3 && prevWave < 3) this.triggerRadioComms('wave3', true);
        if (dismembered) this.triggerRadioComms('firstDismember', true);
        const ks = advanceKillstreak(this.killstreak, this.airstrikeReady);
        this.killstreak = ks.streak;
        this.airstrikeReady = ks.airstrikeReady;
        if (ks.justCharged) {
          this.showAlert('5연속 처치 달성 — [X] 융단 폭격 공중 지원 준비 완료', 4.5);
          this.audio.playAirstrikeRadio();
        }
        if (evalRes.isCrit || dismembered) this.hitstop = 0.068;
      }
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
      this.triggerDawnEnding();
    } else {
      this.emitHudSnapshot(true);
    }
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
    this.triggerDawnEnding();
  }

  private triggerDawnEnding(): void {
    if (this.serverShutdownActive) return;
    this.serverShutdownActive = true;
    this.vatsActive = false;
    this.clearHeldInputs();

    const lookDir = new THREE.Vector3();
    this.camera.getWorldDirection(lookDir);
    const lookAt = this.camera.position.clone().addScaledVector(lookDir, 22);
    const cit = this.worldRefs?.citadel;
    this.cinematic.startDawn(
      { x: this.player.x, y: this.player.y, z: this.player.z },
      { x: lookAt.x, y: lookAt.y, z: lookAt.z },
      { x: cit?.x ?? 0, y: 12, z: cit?.z ?? -35 }
    );
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

  private handleCinematicComplete(seq: 'none' | 'opening' | 'breach' | 'dawn'): void {
    if (seq === 'opening') {
      this.player.equipTimer = 0.48;
      this.camera.rotation.z = 0;
      this.viewmodel.pivot.visible = true;
    } else if (seq === 'breach') {
      this.camera.rotation.z = 0;
      this.viewmodel.pivot.visible = true;
      this.player.equipTimer = 0.25;
    } else if (seq === 'dawn') {
      this.clearHeldInputs();
      this.exitPointerLockSafe();
      this.setPhase('victory');
    }
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
      this.player.reloadTimer > 0 ||
      this.player.fireCd > 0
    ) {
      return;
    }
    const w = WEAPONS[this.player.wpnIdx];
    if (this.player.ammo[this.player.wpnIdx] <= 0) {
      this.startReload();
      return;
    }

    this.player.ammo[this.player.wpnIdx]--;
    this.analytics.shotsFired++;
    this.player.fireCd = w.fireRate;
    this.player.recoilPitch += w.recoil * (this.player.ads ? 0.62 : 1.0);
    const adsDamp = this.player.ads ? 0.58 : 1.0;
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
    this.shake = Math.max(this.shake, w.shake);

    this.audio.playWeapon(w.sound, 1.0);
    if (w.ejectShell) {
      this.ejectBrassShell();
      this.audio.playShellClink();
    }

    const origin = this.camera.position.clone();
    const baseDir = new THREE.Vector3();
    this.camera.getWorldDirection(baseDir);
    const muzzlePos = new THREE.Vector3(this.player.ads ? 0 : 0.22, -0.14, -0.84).applyMatrix4(
      this.camera.matrixWorld
    );

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

    // Hitscan weapons ([1] Rifle, [2] Shotgun, [3] Railgun)
    const spread = this.player.ads ? w.adsSpread : w.spread;
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
            w.dmg,
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
            w.dmg,
            worldHits[0].point,
            Faction.PLAYER
          );
        } else if (worldHits.length > 0 && worldHits[0].object.userData.isServerCore) {
          this.damageServerCore(w.dmg, worldHits[0].point, Faction.PLAYER);
        }
      } else if (enemyHits.length > 0 && enemyHits[0].distance < maxDist) {
        const eh = enemyHits[0];
        endPoint = eh.point;
        if (eh.object.userData.dropship) {
          this.damageDropship(w.dmg, Faction.PLAYER);
        } else {
          const u = eh.object.userData.unit as ActiveUnit | undefined;
          if (u && u.alive) {
            this.damageUnit(
              u,
              w.dmg,
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
          this.damageRelay(ud.relay as RelayPylonEntity, w.dmg, wh.point, Faction.PLAYER);
        } else if (ud.isServerCore) {
          this.damageServerCore(w.dmg, wh.point, Faction.PLAYER);
        } else if (ud.barrel && ud.barrel.alive) {
          ud.barrel.hp -= w.dmg;
          this.vfx.spawnSparkBurst(wh.point, new THREE.Vector3(0, 1, 0), 8, 0xffaa33, 8);
          if (ud.barrel.hp <= 0) {
            ud.barrel.alive = false;
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
          this.vfx.spawnSparkBurst(wh.point, norm, w.id === 1 ? 3 : 6, 0xffc864, 7.5);
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
    const currentAmmo = this.player.ammo[this.player.wpnIdx];
    if (this.player.reloadTimer > 0 || currentAmmo === w.mag) return;
    const timing = computeReloadTiming(w.reload, currentAmmo, w.mag);
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

  private updateEnemies(dt: number): void {
    let activeAttackers = 0;
    const bal = computeSpawnBalance(this.wave, this.relaysDestroyed, this.coreShieldDown);
    const MAX_CONCURRENT_PLAYER_ATTACKERS = bal.maxConcurrentAttackers;
    const animDamp = 1 - Math.exp(-10 * dt);

    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (!u.alive) {
        this.units.splice(i, 1);
        continue;
      }

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

      if (this.phase === 'playing' && this.player.alive) {
        const dp = Math.hypot(this.player.x - u.x, this.player.z - u.z);
        target = { x: this.player.x, y: this.player.y - 0.3, z: this.player.z, isPlayer: true };
        bestD = dp * 1.08;
      }
      for (let j = 0; j < this.units.length; j++) {
        const o = this.units[j];
        if (!o.alive || o.faction === u.faction) continue;
        const d = Math.hypot(o.x - u.x, o.z - u.z);
        if (d < bestD) {
          bestD = d;
          target = { x: o.x, y: 1.2 * o.scale, z: o.z, isPlayer: false, unit: o };
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

      const eyePos = new THREE.Vector3(u.x, 1.42 * u.scale, u.z);
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
      const moveSpeed = u.burnTimer > 0 ? u.speed * 0.75 : u.speed;
      u.x += (mx / ml) * moveSpeed * dt;
      u.z += (mz / ml) * moveSpeed * dt;
      resolveXZCollision(u, u.r, this.colliders, ARENA_HALF_SIZE);

      // Articulated robot locomotion: hover drone banking vs biped stride, hip bob, torso counter-twist, flinch & firing recoil
      if (u.archetype === UnitArchetype.ROBOT_STALKER) {
        const hoverY = Math.sin(this.time * 5.2 + u.id) * 0.24 + 0.08;
        u.rig.root.position.set(u.x, hoverY, u.z);
        const targetBank = -u.strafeDir * 0.24 + Math.sin(this.time * 3.1 + u.id) * 0.06;
        const targetPitch = 0.22 - u.hitFlinch * 0.42;
        u.rig.root.rotation.z += (targetBank - u.rig.root.rotation.z) * animDamp;
        u.rig.root.rotation.x += (targetPitch - u.rig.root.rotation.x) * animDamp;
      } else {
        u.walkPhase += dt * moveSpeed * (u.isBoss ? 1.45 : 2.15);
        const stride = Math.sin(u.walkPhase);
        const hipBob = Math.abs(Math.cos(u.walkPhase)) * (u.isBoss ? 0.065 : 0.085) * u.scale;
        u.rig.root.position.set(u.x, hipBob, u.z);

        const forwardLean = (u.isBoss ? 0.05 : 0.11) - u.hitFlinch * 0.34;
        const lateralRoll = stride * (u.isBoss ? 0.035 : 0.055);
        u.rig.root.rotation.x += (forwardLean - u.rig.root.rotation.x) * animDamp;
        u.rig.root.rotation.z += (lateralRoll - u.rig.root.rotation.z) * animDamp;

        const legAmp = u.isBoss ? 0.48 : 0.68;
        if (u.rig.parts.leftLeg) u.rig.parts.leftLeg.rotation.x = stride * legAmp;
        if (u.rig.parts.rightLeg) u.rig.parts.rightLeg.rotation.x = -stride * legAmp;
        if (u.rig.parts.torso) {
          u.rig.parts.torso.rotation.y = -stride * 0.12;
        }
        if (u.rig.parts.leftArm) {
          u.rig.parts.leftArm.rotation.x = -stride * 0.58 - u.hitFlinch * 0.35;
        }
        if (u.rig.parts.rightArm) {
          const aimPitch = canSee ? -0.52 - u.fireRecoil * 0.48 : stride * 0.42;
          u.rig.parts.rightArm.rotation.x = aimPitch - u.hitFlinch * 0.25;
        }
      }

      // Attack logic (with attack token budget against player for fairness)
      u.fireCd -= dt;
      const isMeleeRange = u.archetype === UnitArchetype.ROBOT_STALKER && d < 2.6;
      if (u.fireCd <= 0 && (canSee || isMeleeRange) && d < 42) {
        if (target.isPlayer && activeAttackers >= MAX_CONCURRENT_PLAYER_ATTACKERS) {
          u.fireCd = 0.25;
          continue;
        }
        if (target.isPlayer) activeAttackers++;

        u.fireRecoil = 1.0;
        u.fireCd = u.fireRate * (u.missing.rightArm ? 2.4 : 0.85 + Math.random() * 0.35);
        const dP = Math.hypot(u.x - this.player.x, u.z - this.player.z);
        if (dP < 50 && this.phase === 'playing') {
          this.audio.playWeapon(
            u.isRobot ? 'robot_laser' : u.archetype === UnitArchetype.RAIDER_BERSERKER ? 'shotgun' : 'rifle',
            Math.max(0.08, (1 - dP / 50) * 0.45)
          );
        }

        const shotDir = tgtPos.clone().sub(eyePos).normalize();
        const acc = u.missing.rightArm ? 0.26 : 0.085;
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

        const hitRoll = u.missing.rightArm ? 0.18 : target.isPlayer ? 0.38 : 0.64;
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
        seq === 'dawn' ? 'dawn' : seq === 'breach' ? 'breach' : 'opening';
      this.audio.setDynamicState({
        playing: true,
        intensity: seq === 'breach' ? 1.0 : 0.25,
        bossActive: seq === 'breach',
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

    if (this.hitstop > 0) {
      this.hitstop -= clampedRealDt;
      this.timeScale = 0.06;
    } else if (this.vatsActive) {
      this.timeScale += (VATS_TIME_SCALE - this.timeScale) * Math.min(1, clampedRealDt * 22);
    } else {
      this.timeScale += (1.0 - this.timeScale) * Math.min(1, clampedRealDt * 18);
    }

    const dt = clampedRealDt * this.timeScale;
    this.time += dt;

    if (this.alertTimer > 0) {
      this.alertTimer -= clampedRealDt;
      if (this.alertTimer <= 0) this.alertBanner = null;
    }
    if (this.calloutTimer > 0) {
      this.calloutTimer -= clampedRealDt;
      if (this.calloutTimer <= 0) this.calloutText = null;
    }

    // Player movement, ADS, recoil, viewmodel
    if (this.player.alive) {
      if (this.player.invulnTimer > 0) this.player.invulnTimer -= clampedRealDt;
      this.player.ads = this.mouseRight && this.player.reloadTimer <= 0 && !this.vatsActive;
      const w = WEAPONS[this.player.wpnIdx];

      const fwd =
        (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
        (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
      const strafe = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
      const sprinting = this.keys.has('ShiftLeft') && fwd > 0 && !this.player.ads;
      this.player.sprinting = sprinting;

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
          this.player.ammo[this.player.wpnIdx] = w.mag;
          this.player.reloadIsTactical = false;
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

      this.player.vx += (mx * moveSpd - this.player.vx) * Math.min(1, dt * 13);
      this.player.vz += (mz * moveSpd - this.player.vz) * Math.min(1, dt * 13);

      const wasInAir = !this.player.onGround;
      const prevVy = this.player.vy;
      this.player.vy -= 23 * dt;
      this.player.x += this.player.vx * dt;
      this.player.y += this.player.vy * dt;
      this.player.z += this.player.vz * dt;
      if (this.player.y <= 1.7) {
        if (wasInAir && prevVy < -4.5) {
          this.player.landDip = Math.min(0.16, Math.abs(prevVy) * 0.015);
        }
        this.player.y = 1.7;
        this.player.vy = 0;
        this.player.onGround = true;
      }
      resolveXZCollision(this.player, 0.55, this.colliders, ARENA_HALF_SIZE);

      // Smooth landing dip recovery + subtle strafe camera banking
      this.player.landDip *= Math.pow(0.0008, clampedRealDt);
      this.player.recoilPitch *= Math.pow(0.002, clampedRealDt);
      this.shake *= Math.pow(0.001, clampedRealDt);
      if (this.shake < 0.004) this.shake = 0;

      const shkX = (Math.random() - 0.5) * this.shake * 0.24;
      const shkY = (Math.random() - 0.5) * this.shake * 0.24;
      const shkRot = (Math.random() - 0.5) * this.shake * 0.075;
      const strafeTilt = -strafe * (this.player.ads ? 0.004 : 0.015);

      this.camera.position.set(
        this.player.x + shkX,
        this.player.y - this.player.landDip + shkY,
        this.player.z
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

      const bobAmpX = this.player.ads ? 0.0022 : sprinting ? 0.019 : 0.012;
      const bobAmpY = this.player.ads ? 0.0018 : sprinting ? 0.017 : 0.010;
      const bobX = Math.sin(this.player.vmBob) * bobAmpX * this.player.vmBobBlend;
      const bobY = (0.5 - 0.5 * Math.cos(this.player.vmBob * 2)) * bobAmpY * this.player.vmBobBlend;
      const bobRoll =
        Math.sin(this.player.vmBob) * (this.player.ads ? 0.004 : sprinting ? 0.036 : 0.018) * this.player.vmBobBlend;
      const breathY = Math.sin(this.time * 2.1) * (this.player.ads ? 0.0009 : 0.0028);

      const tx = this.player.ads ? 0.0 : sprinting ? 0.2 : 0.235;
      const ty = this.player.ads ? -0.155 : sprinting ? -0.26 : -0.232;
      const tz = this.player.ads ? -0.45 : -0.58;
      const isReloading = this.player.reloadTimer > 0;
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

      const posDamp = damp(19);
      const rotDamp = damp(17);
      this.viewmodel.pivot.position.x +=
        (tx + bobX + rPose.pivotPos.x + this.player.vmSwayX - this.viewmodel.pivot.position.x) * posDamp;
      this.viewmodel.pivot.position.y +=
        (ty - bobY + breathY + rPose.pivotPos.y - equipDrop - this.player.landDip * 0.45 + this.player.vmSwayY - this.viewmodel.pivot.position.y) *
        posDamp;
      this.viewmodel.pivot.position.z +=
        (tz + rPose.pivotPos.z + this.player.vmKickZ - this.viewmodel.pivot.position.z) * damp(23);

      const targetRotX = isReloading
        ? rPose.pivotRot.x
        : this.player.vmRecoilPitch + this.player.vmKickZ * 0.55 - equipDrop * 1.45;
      const targetRotY = isReloading
        ? rPose.pivotRot.y
        : sprinting && !this.player.ads
          ? 0.24
          : this.player.vmSwayX * 1.65;
      const targetRotZ = isReloading
        ? rPose.pivotRot.z
        : (sprinting && !this.player.ads ? -0.14 : -strafe * 0.038) +
          bobRoll +
          this.player.vmRecoilRoll -
          equipRoll;
      this.viewmodel.pivot.rotation.x += (targetRotX - this.viewmodel.pivot.rotation.x) * rotDamp;
      this.viewmodel.pivot.rotation.y += (targetRotY - this.viewmodel.pivot.rotation.y) * rotDamp;
      this.viewmodel.pivot.rotation.z += (targetRotZ - this.viewmodel.pivot.rotation.z) * rotDamp;

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

      if (this.player.muzzleTimer > 0) {
        this.player.muzzleTimer -= clampedRealDt;
        this.viewmodel.muzzleFlash.visible = true;
        this.viewmodel.muzzleFlash.rotation.z += 1.45;
        this.muzzleSprite.visible = true;
        const mMat = this.muzzleSprite.material as THREE.SpriteMaterial;
        mMat.rotation = Math.random() * Math.PI * 2;
        mMat.color.setHex(w.id === 2 ? 0x38e8ff : w.id === 4 ? 0xff7b29 : 0xffe49c);
        const mScale = w.id === 1 ? 0.62 : w.id === 2 || w.id === 3 ? 0.56 : 0.42;
        this.muzzleSprite.scale.set(mScale, mScale, 1);
        this.muzzleLight.intensity = 7.5;
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

      if (this.mouseLeft && !this.vatsActive && (w.auto || this.player.fireCd <= 0)) {
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

    // Director: Balanced 3-Way Robot Spawning, Artillery, Dropship & Gated Boss Titan
    const spawnBal = computeSpawnBalance(this.wave, this.relaysDestroyed, this.coreShieldDown);
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
        this.createEnemy(Faction.SYNDICATE, UnitArchetype.SYNDICATE_COMMANDO, sp.x, sp.z);
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
      this.artilleryCd = Math.max(16, 25 - this.wave * 1.1);
      this.callArtilleryBarrage();
    }

    this.dropshipCd -= dt;
    if (this.dropshipCd <= 0 && (!this.dropship || !this.dropship.alive)) {
      this.dropshipCd = 36;
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
      this.createEnemy(Faction.ROBOT, UnitArchetype.ROBOT_TITAN, sp.x, sp.z);
      this.triggerRadioComms('bossTitan', true);
      this.showAlert('경고: 타이탄 살육 메크 전장 진입 — 외장 장갑을 파괴하고 코어를 타격하라', 5.0);
      this.audio.playArtilleryWhistle();
    }

    this.updateEnemies(dt);
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
      ? 'dawn'
      : this.coreShieldDown
        ? 'breach'
        : 'combat';
    this.audio.setDynamicState({
      playing: this.phase === 'playing',
      intensity: Math.min(1, this.units.length / 13),
      bossActive: this.units.some((u) => u.isBoss && u.alive) || this.coreShieldDown,
      vatsActive: this.vatsActive,
      mood: bgmMood,
    });
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
        this.triggerExplosion(r.pos, 10.5, 205, Faction.PLAYER, 'HYDRA-7 로켓', {
          tag: '로켓 직격 랙돌',
        });
      }
    }

    // Flamethrower napalm puffs
    for (let i = this.flames.length - 1; i >= 0; i--) {
      const fl = this.flames[i];
      fl.life -= dt;
      fl.pos.addScaledVector(fl.vel, dt);
      fl.vel.y += 2.2 * dt;
      fl.mesh.position.copy(fl.pos);
      const pr = 1 - fl.life / fl.maxLife;
      fl.mesh.scale.setScalar(0.28 + pr * 0.95);

      for (const u of this.units) {
        if (!u.alive) continue;
        if (Math.hypot(u.x - fl.pos.x, u.z - fl.pos.z) < u.r + 0.9 && Math.abs(fl.pos.y - 1.1 * u.scale) < 1.3 * u.scale) {
          u.burnTimer = Math.max(u.burnTimer, 3.6);
          if (u.isRobot) u.staggerTimer = Math.max(u.staggerTimer, 0.35);
          this.damageUnit(
            u,
            7,
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

      if (fl.life <= 0) {
        this.scene.remove(fl.mesh);
        this.flames.splice(i, 1);
      }
    }

    // Frag / EMP Grenades
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.fuse -= dt;
      g.vy -= 24 * dt;
      g.pos.x += g.vx * dt;
      g.pos.y += g.vy * dt;
      g.pos.z += g.vz * dt;
      if (g.pos.y < 0.16) {
        g.pos.y = 0.16;
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

    // Brass shell casings
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const sh = this.shells[i];
      sh.life -= dt;
      if (sh.life <= 0) {
        this.scene.remove(sh.mesh);
        this.shells.splice(i, 1);
        continue;
      }
      sh.vy -= 20 * dt;
      sh.mesh.position.x += sh.vx * dt;
      sh.mesh.position.y += sh.vy * dt;
      sh.mesh.position.z += sh.vz * dt;
      sh.mesh.rotation.x += sh.rx * dt;
      sh.mesh.rotation.y += sh.ry * dt;
      if (sh.mesh.position.y < 0.03) {
        sh.mesh.position.y = 0.03;
        sh.vy = -sh.vy * 0.35;
        sh.vx *= 0.5;
        sh.vz *= 0.5;
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

  private updateAtmosphere(dt: number): void {
    const nowSec = performance.now() * 0.001;
    const dawnP = this.cinematic.getDawnProgress();

    // Flickering firelights (dim gradually during Dawn peace)
    const fireFade = Math.max(0.15, 1 - dawnP * 0.8);
    for (const fl of this.fireLights) {
      fl.light.intensity =
        (2.0 + Math.sin(nowSec * 14 + fl.phase) * 0.55 + Math.random() * 0.3) * fireFade;
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
        this.lightningLight.intensity = Math.random() > 0.35 ? 2.6 : 0.4;
      } else {
        this.lightningLight.intensity = 0;
      }
    } else {
      this.lightningLight.intensity = 0;
    }

    // Smooth atmospheric sky/fog/light morph:
    // Base storm -> Relay-1 crimson tension -> Dawn clear azure blue & golden sunrise (5s)
    const fog = this.scene.fog as THREE.FogExp2;
    if (dawnP > 0.001) {
      this._c1.setHex(0x1f0d12).lerp(this._c2.setHex(0xdcb486), dawnP);
      fog.color.copy(this._c1);
      fog.density = 0.0102 * (1 - dawnP * 0.52);
      (this.scene.background as THREE.Color).setHex(0x0c0e17).lerp(this._c2.setHex(0x5a9be0), dawnP);

      this.hemiLight.color.setHex(0x88b4e6).lerp(this._c2.setHex(0xbde2ff), dawnP);
      this.hemiLight.groundColor.setHex(0x381e18).lerp(this._c2.setHex(0xd99b66), dawnP);
      this.hemiLight.intensity = 1.08 + dawnP * 0.85;

      this.sunLight.color.setHex(0xffb884).lerp(this._c2.setHex(0xffe6b3), dawnP);
      this.sunLight.intensity = 1.75 + dawnP * 1.15;

      if (this.worldRefs) {
        const u = this.worldRefs.skyDomeMat.uniforms;
        u.topColor.value.setHex(0x060913).lerp(this._c2.setHex(0x286cc2), dawnP);
        u.midColor.value.setHex(0x16101e).lerp(this._c2.setHex(0x74b3e8), dawnP);
        u.horizonColor.value.setHex(0x471b18).lerp(this._c2.setHex(0xffc97d), dawnP);
        u.glowColor.value.setHex(0x9e2124).lerp(this._c2.setHex(0xffe9a8), dawnP);
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

    // Animate OMNI-CORE Citadel gyro rings, Exposed Orange Core, Relay Pylon crystals & fans
    if (this.worldRefs) {
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
      // Live 3D flyover camera showcasing the Cyberpunk Server Labyrinth & OMNI-CORE Citadel
      this.viewmodel.pivot.visible = false;
      const t = now * 0.00018;
      this.camera.position.set(
        Math.cos(t) * 29,
        13.5 + Math.sin(t * 2) * 1.5,
        Math.sin(t) * 28 + 6
      );
      this.camera.lookAt(0, 7.5, -20);
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
          this.analytics.holotapesFound++;
          this.audio.playHolotapePickup();

          // Meaningful wasteland reward per Holotape
          this.player.armor = Math.min(this.player.maxArmor, this.player.armor + 25);
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + 15);
          this.vatsEnergy = Math.min(100, this.vatsEnergy + 30);
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
    const objective = computeMissionObjective(
      this.wave,
      this.kills,
      boss ? boss.name : null,
      this.relaysDestroyed,
      relaysTotal,
      this.coreShieldDown,
      coreHpPct
    );
    const playerYawDeg = (((-this.player.yaw * 180) / Math.PI) % 360 + 360) % 360;
    const cit = this.worldRefs?.citadel;
    const coreDistance = cit
      ? Math.round(Math.hypot(this.player.x - cit.terminalX, this.player.z - cit.terminalZ))
      : 60;
    const canShutdownCore =
      this.coreShieldDown &&
      !this.serverShutdownActive &&
      !this.cinematic.isCutsceneActive() &&
      coreDistance <= 10.5;

    this.onHudUpdate({
      phase: this.phase,
      wave: this.wave,
      actNumber: this.coreShieldDown ? 2 : act.actNumber,
      actTitle: this.coreShieldDown ? '심장부 정지' : act.title,
      objectiveText: objective.text,
      objectiveProgressPct: objective.progressPct,
      holotapesFound: this.analytics.holotapesFound,
      holotapesTotal: this.analytics.holotapesTotal,
      relaysDestroyed: this.relaysDestroyed,
      relaysTotal,
      coreShieldDown: this.coreShieldDown,
      coreHp: Math.ceil(this.coreHp),
      coreMaxHp: this.coreMaxHp,
      canShutdownCore,
      coreDistance,
      serverShutdownActive: this.serverShutdownActive,
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
      mag: w.mag,
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
      sprinting: this.player.sprinting,
      crosshairGap: Math.round(
        8 + (this.player.ads ? 0 : this.player.sprinting ? 14 : 8) + this.player.vmKickZ * 75
      ),
      vatsEnergy: Math.round(this.vatsEnergy),
      vatsActive: this.vatsActive,
      vatsTargets: this.vatsActive ? [...this.vatsTargets] : [],
      killstreak: this.killstreak,
      airstrikeReady: this.airstrikeReady,
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
      const mul = this.player.ads ? 0.58 : 1.0;
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
      this.firePlayerWeapon();
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

    if (e.code === 'Space' && this.player.onGround) {
      this.player.vy = 8.4;
      this.player.onGround = false;
    } else if (e.code === 'Digit1') this.selectWeapon(0);
    else if (e.code === 'Digit2') this.selectWeapon(1);
    else if (e.code === 'Digit3') this.selectWeapon(2);
    else if (e.code === 'Digit4') this.selectWeapon(3);
    else if (e.code === 'Digit5') this.selectWeapon(4);
    else if (e.code === 'KeyR') this.startReload();
    else if (e.code === 'KeyG') this.throwGrenade();
    else if (e.code === 'KeyE') this.performGloryKill();
    else if (e.code === 'KeyF') this.tryShutdownServerCore();
    else if (e.code === 'KeyQ') this.toggleVats();
    else if (e.code === 'KeyX') this.callAirstrike();
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
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
