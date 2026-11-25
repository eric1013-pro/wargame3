import * as THREE from 'three';
import { ARENA_HALF_SIZE } from './rules';
import { ExtendedPbrLibrary } from './pbrMaterials';
import { ProceduralTextureSet } from './textures';
import {
  buildCityFlyerModel,
  buildDefenseTurretModel,
  buildRescueShuttleModel,
  buildRokNavyLcacHovercraft,
  buildRuinedVehicleWreck,
  DefenseTurretRig,
  RokNavyLcacRig,
} from './models';

export interface WalkableSurface {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  yStart: number;
  yEnd: number;
  slopeAxis: 'none' | 'x' | 'z';
}

export interface IndoorZone {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  maxY: number;
}

export interface SmokePlumeAnchor {
  x: number;
  y: number;
  z: number;
  kind: 'oil_fire' | 'steam';
}

export interface WorldColliderLike {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
  minY?: number;
  mesh: THREE.Object3D;
  destructible: boolean;
  tankCrushable?: boolean;
  hp: number;
  alive: boolean;
}

export interface MinimapWallRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  kind: 'maze' | 'bunker' | 'citadel' | 'barricade';
}

export interface RelayPylonEntity {
  id: number;
  label: string;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  group: THREE.Group;
  coreCrystal: THREE.Mesh;
  beamMesh: THREE.Mesh;
  ringMesh: THREE.Mesh;
  hitMesh: THREE.Mesh;
  collider: WorldColliderLike;
}

export interface OmniCoreCitadel {
  x: number;
  z: number;
  terminalX: number;
  terminalZ: number;
  group: THREE.Group;
  gyroRingA: THREE.Mesh;
  gyroRingB: THREE.Mesh;
  coreBeam: THREE.Mesh;
  shieldDome: THREE.Mesh;
  coreWeakpoint: THREE.Mesh;
  coreWeakpointHitMesh: THREE.Mesh;
  terminalGlow: THREE.Mesh;
  terminalLight: THREE.PointLight;
  emissiveMeshes: THREE.Mesh[];
}

export interface HackableTurretEntity {
  id: number;
  name: string;
  x: number;
  z: number;
  hacked: boolean;
  fireCd: number;
  rig: DefenseTurretRig;
}

export interface SkyTrafficUnit {
  mesh: THREE.Group;
  orbitRadius: number;
  height: number;
  angle: number;
  speed: number;
  dir: number;
}

export interface HoloBillboardRef {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  baseOpacity: number;
  phase: number;
}

export interface BreachDoorSetpiece {
  x: number;
  z: number;
  group: THREE.Group;
  leftLeaf: THREE.Mesh;
  rightLeaf: THREE.Mesh;
  c4Pack: THREE.Mesh;
  breachLight: THREE.PointLight;
  doorCollider: WorldColliderLike;
  breached: boolean;
}

export interface TowerElevatorSetpiece {
  x: number;
  z: number;
  group: THREE.Group;
  leftDoor: THREE.Mesh;
  rightDoor: THREE.Mesh;
  cabinLight: THREE.PointLight;
}

export interface BuiltWorldRefs {
  citadel: OmniCoreCitadel;
  relays: RelayPylonEntity[];
  turrets: HackableTurretEntity[];
  skyTraffic: SkyTrafficUnit[];
  holoBillboards: HoloBillboardRef[];
  dawnGodRays: THREE.Mesh[];
  rescueShuttle: THREE.Group;
  lcacHovercraft: RokNavyLcacRig;
  lcacColliders: WorldColliderLike[];
  vaultGate: THREE.Group;
  vaultGateCollider: WorldColliderLike;
  sandboxWayfindingGroup: THREE.Group;
  euljiroBreachDoor: BreachDoorSetpiece;
  towerElevator: TowerElevatorSetpiece;
  minimapWalls: MinimapWallRect[];
  spinningFans: THREE.Object3D[];
  searchlights: Array<{ pivot: THREE.Group; baseYaw: number; phase: number; speed: number }>;
  fireLights: Array<{ light: THREE.PointLight; phase: number }>;
  conduitMaterials: THREE.MeshBasicMaterial[];
  skyDomeMat: THREE.ShaderMaterial;
  shieldDomeMat: THREE.ShaderMaterial;
  groundMist: THREE.Points;
  walkableSurfaces: WalkableSurface[];
  indoorZones: IndoorZone[];
  smokePlumes: SmokePlumeAnchor[];
  k808Anchors: THREE.Group[];
  sedanAnchors: Array<{ anchor: THREE.Group; color: number }>;
  sandbagAnchors: THREE.Group[];
}

export interface WorldBuildContext {
  scene: THREE.Scene;
  textures: ProceduralTextureSet;
  pbr: ExtendedPbrLibrary;
  isSoftwareGl: boolean;
  matCache: {
    floor: THREE.MeshStandardMaterial;
    concrete: THREE.MeshStandardMaterial;
    armorPlate: THREE.MeshStandardMaterial;
    darkIron: THREE.MeshStandardMaterial;
    rustMetal: THREE.MeshStandardMaterial;
    crate: THREE.MeshStandardMaterial;
    barrel: THREE.MeshStandardMaterial;
    fire: THREE.MeshBasicMaterial;
  };
  colliders: WorldColliderLike[];
  worldHitMeshes: THREE.Object3D[];
  addExplosiveBarrel: (x: number, z: number) => void;
}

function makeSlopedExtrude(
  pts: Array<[number, number]>,
  depth: number,
  bevel = 0.08
): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => {
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  });
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 2,
    steps: 1,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

/**
 * Constructs the 100x Labyrinthine Cyberpunk AI Server Citadel Warzone:
 * - Interconnected Multi-Wing Server Labyrinth (wide 6–9m corridors, L-turns, T-junctions, flanking loops)
 * - South VAULT-00 Cryo-Bunker Blast Door Spawn Trench with neon floor wayfinding conduits
 * - West Rust-Borg Scrapyard Maze Chamber (houses Firewall Relay ALPHA)
 * - East Aegis-Net Security Server Hall Maze (houses Firewall Relay BETA)
 * - Central Double-Overpass Crossroads Checkpoint (houses Firewall Relay GAMMA)
 * - North Sanctum: 36m Towering OMNI-CORE Central AI Server Citadel with spinning gyro rings,
 *   crimson hexagonal Firewall Forcefield Dome & [F] Kill-Switch Override Console
 */
export function buildOmniCoreWorld(ctx: WorldBuildContext): BuiltWorldRefs {
  const { scene, matCache, pbr, isSoftwareGl, colliders, worldHitMeshes } = ctx;

  const minimapWalls: MinimapWallRect[] = [];
  const spinningFans: THREE.Object3D[] = [];
  const searchlights: Array<{ pivot: THREE.Group; baseYaw: number; phase: number; speed: number }> = [];
  const fireLights: Array<{ light: THREE.PointLight; phase: number }> = [];
  const conduitMaterials: THREE.MeshBasicMaterial[] = [];
  const walkableSurfaces: WalkableSurface[] = [];
  const indoorZones: IndoorZone[] = [];
  const smokePlumes: SmokePlumeAnchor[] = [];
  const k808Anchors: THREE.Group[] = [];
  const sedanAnchors: Array<{ anchor: THREE.Group; color: number }> = [];
  const sandbagAnchors: THREE.Group[] = [];
  const lcacColliders: WorldColliderLike[] = [];
  const sandboxWayfindingGroup = new THREE.Group();
  scene.add(sandboxWayfindingGroup);

  /** Adds exact rotated multi-segment AABBs for angled long vehicles (eliminates both corner invisible walls and hull pass-throughs) */
  const addRotatedHullColliders = (
    cx: number,
    cz: number,
    lengthAlongAxis: number,
    widthPerp: number,
    rotY: number,
    height: number,
    mesh: THREE.Object3D,
    longAxis: 'x' | 'z',
    tankCrushable = false
  ) => {
    const segs = lengthAlongAxis > widthPerp * 1.45 ? 2 : 1;
    const halfSegLen = lengthAlongAxis / (segs * 2);
    const halfW = widthPerp * 0.5;
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    // Axis unit vector in XZ plane for Three.js rotation.y
    const axX = longAxis === 'x' ? cos : sin;
    const axZ = longAxis === 'x' ? -sin : cos;
    const extX = Math.abs(cos) * (longAxis === 'x' ? halfSegLen : halfW) + Math.abs(sin) * (longAxis === 'x' ? halfW : halfSegLen);
    const extZ = Math.abs(sin) * (longAxis === 'x' ? halfSegLen : halfW) + Math.abs(cos) * (longAxis === 'x' ? halfW : halfSegLen);

    for (let s = 0; s < segs; s++) {
      const off = segs === 1 ? 0 : (s === 0 ? -halfSegLen : halfSegLen);
      const sx = cx + axX * off;
      const sz = cz + axZ * off;
      colliders.push({
        minX: sx - extX,
        maxX: sx + extX,
        minZ: sz - extZ,
        maxZ: sz + extZ,
        height,
        mesh,
        destructible: false,
        tankCrushable,
        hp: 9999,
        alive: true,
      });
    }
  };

  const crimsonGlow = new THREE.MeshBasicMaterial({ color: 0xb8243d });
  const cyanGlow = new THREE.MeshBasicMaterial({ color: 0x2299b8 });
  const amberGlow = new THREE.MeshBasicMaterial({ color: 0xc27622 });
  const violetGlow = new THREE.MeshBasicMaterial({ color: 0x4275c2 });
  conduitMaterials.push(crimsonGlow, cyanGlow, amberGlow, violetGlow);

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0x8f9dad,
    roughness: 0.34,
    metalness: 0.84,
    envMapIntensity: 0.65,
  });

  // Procedural soft radial volumetric glow sprite texture (zero external media files)
  const createHaloTexture = (innerHex: string, outerRgba: string): THREE.CanvasTexture => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d');
    if (g) {
      const grad = g.createRadialGradient(64, 64, 2, 64, 64, 62);
      grad.addColorStop(0, innerHex);
      grad.addColorStop(0.28, outerRgba);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  const crimsonHaloTex = createHaloTexture('#ffe2e2', 'rgba(255, 38, 66, 0.58)');
  const cyanHaloTex = createHaloTexture('#e0f7ff', 'rgba(56, 200, 255, 0.42)');

  // =========================================================================
  // 1) PHOTOREALISTIC OVERCAST STORMY NEO-SEOUL SKY DOME (Volumetric Clouds · Pre-Dawn Mist · Aurora)
  // =========================================================================
  const skyDomeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x090f19) },
      midColor: { value: new THREE.Color(0x182434) },
      horizonColor: { value: new THREE.Color(0x2d3847) },
      glowColor: { value: new THREE.Color(0x88533e) },
      uTime: { value: 0 },
      uAuroraStrength: { value: 0 },
      uSunGlow: { value: 0 },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 horizonColor;
      uniform vec3 glowColor;
      uniform float uTime;
      uniform float uAuroraStrength;
      uniform float uSunGlow;
      varying vec3 vWorldPos;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise2(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * noise2(p);
          p = p * 2.08 + vec2(7.3, 11.9);
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 dir = normalize(vWorldPos);
        float h = clamp(dir.y, 0.0, 1.0);
        vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.32, h));
        col = mix(col, topColor, smoothstep(0.28, 0.85, h));

        // Neo-Seoul northern citadel horizon scatter
        float northGlow = pow(max(0.0, -dir.z), 2.8) * (1.0 - smoothstep(0.0, 0.58, h));
        col += glowColor * northGlow * 0.78;

        // Animated billowing high-altitude storm clouds lit from below
        vec2 cloudUv = dir.xz / (h + 0.24) * 1.15 + vec2(uTime * 0.014, -uTime * 0.009);
        float c1 = fbm(cloudUv);
        float c2 = fbm(cloudUv * 2.1 - vec2(uTime * 0.018, uTime * 0.011));
        float cloudMask = smoothstep(0.42, 0.82, c1 * 0.65 + c2 * 0.35) * smoothstep(0.02, 0.22, h) * (1.0 - smoothstep(0.68, 0.96, h));
        vec3 cloudUnderlit = mix(vec3(0.07, 0.11, 0.19), glowColor * 0.65 + vec3(0.18, 0.14, 0.2), northGlow * 0.85 + 0.18);
        col = mix(col, cloudUnderlit, cloudMask * 0.62);

        // Crisp zenith starfield & faint orbital defense ring arc
        vec2 starCell = floor(dir.xz / (h + 0.15) * 95.0);
        float starRnd = hash21(starCell);
        if (starRnd > 0.992 && h > 0.24) {
          float twinkle = 0.55 + 0.45 * sin(uTime * 2.6 + starRnd * 80.0);
          col += vec3(0.75, 0.88, 1.0) * twinkle * smoothstep(0.24, 0.65, h) * (1.0 - cloudMask * 0.8) * (1.0 - uSunGlow * 0.85);
        }
        float orbitalArc = exp(-abs(dir.y - 0.52 - dir.x * 0.18) * 140.0) * smoothstep(0.15, 0.55, -dir.z + 0.35);
        col += vec3(0.22, 0.78, 1.0) * orbitalArc * 0.28 * (1.0 - uSunGlow * 0.6);

        // Symbiosis Ending: Shimmering Emerald-Cyan Aurora Borealis Ribbons
        if (uAuroraStrength > 0.01) {
          float waveA = sin(dir.x * 7.5 + uTime * 0.55 + sin(dir.z * 4.0) * 1.4);
          float curtain = exp(-abs(h - 0.38 - waveA * 0.12) * 10.5);
          float streaks = 0.55 + 0.45 * sin(dir.x * 38.0 + uTime * 1.6 + c1 * 6.0);
          vec3 auroraCol = mix(vec3(0.12, 0.95, 0.68), vec3(0.22, 0.78, 1.0), smoothstep(0.25, 0.55, h));
          col += auroraCol * curtain * streaks * uAuroraStrength * 0.95;
        }

        // Dawn Ending: Warm Golden Sunrise Corona Disc over Citadel Horizon (balanced, non-blinding)
        if (uSunGlow > 0.01) {
          vec3 sunDir = normalize(vec3(0.08, 0.24, -0.96));
          float sunDot = max(0.0, dot(dir, sunDir));
          float corona = pow(sunDot, 16.0) * 0.45 + pow(sunDot, 160.0) * 0.72;
          col += vec3(0.95, 0.76, 0.48) * corona * uSunGlow;
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(215, 32, 20), skyDomeMat);
  scene.add(skyDome);

  // =========================================================================
  // 2) PHOTOREALISTIC WET SEOUL ASPHALT FLOOR + WEATHERED KOREAN ROAD MARKINGS
  // =========================================================================
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA_HALF_SIZE * 5.5, ARENA_HALF_SIZE * 5.5),
    matCache.floor
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.userData = { isWorld: true, isFloor: true };
  scene.add(floor);
  worldHitMeshes.push(floor);

  // Authentic weathered Korean double-yellow asphalt centerlines (replaces glowing Roblox neon floor bars!)
  const roadYellowMat = new THREE.MeshStandardMaterial({
    color: 0xa68232,
    roughness: 0.86,
    metalness: 0.04,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const roadWhiteMat = new THREE.MeshStandardMaterial({
    color: 0x9aa2ab,
    roughness: 0.88,
    metalness: 0.04,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  for (const lx of [-0.22, 0.22]) {
    const centerLine = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 58), roadYellowMat);
    centerLine.rotation.x = -Math.PI / 2;
    centerLine.position.set(lx, 0.02, 4);
    centerLine.receiveShadow = true;
    scene.add(centerLine);
  }
  for (const laneX of [-4.6, 4.6]) {
    for (let z = -22; z <= 28; z += 5.2) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 2.4), roadWhiteMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(laneX, 0.02, z);
      dash.receiveShadow = true;
      scene.add(dash);
    }
  }

  // =========================================================================
  // 3) SOUTH VAULT-00 CRYO-BUNKER BLAST GATE (Set cleanly behind LCAC bay at z = +54.5)
  // =========================================================================
  const vaultGate = new THREE.Group();
  vaultGate.position.set(0, 0, 54.5);
  const gateFrame = new THREE.Mesh(new THREE.BoxGeometry(10.5, 7.6, 2.2), matCache.armorPlate);
  gateFrame.position.y = 3.8;
  gateFrame.castShadow = !isSoftwareGl;
  gateFrame.receiveShadow = true;
  gateFrame.userData = { isWorld: true, surface: 'metal' };
  vaultGate.add(gateFrame);
  worldHitMeshes.push(gateFrame);
  const blastWheel = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.36, 10, 20), matCache.rustMetal);
  blastWheel.position.set(0, 3.2, -1.2);
  vaultGate.add(blastWheel);
  const vaultSign = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.45, 0.25), amberGlow);
  vaultSign.position.set(0, 6.7, -1.25);
  vaultGate.add(vaultSign);
  scene.add(vaultGate);
  const vaultGateCollider: WorldColliderLike = {
    minX: -5.3,
    maxX: 5.3,
    minZ: 53.3,
    maxZ: 55.7,
    height: 7.6,
    mesh: vaultGate,
    destructible: false,
    hp: 99999,
    alive: true,
  };
  colliders.push(vaultGateCollider);

  // =========================================================================
  // 4) COLOSSAL 36m "OMNI-CORE" CENTRAL AI SERVER CITADEL (North Sanctum: x=0, z=-35)
  // =========================================================================
  const coreX = 0;
  const coreZ = -35;
  const citadelGroup = new THREE.Group();
  citadelGroup.position.set(coreX, 0, coreZ);
  const emissiveMeshes: THREE.Mesh[] = [];

  const basePlinth = new THREE.Mesh(
    new THREE.CylinderGeometry(7.8, 9.4, 3.0, 8),
    matCache.armorPlate
  );
  basePlinth.position.y = 1.5;
  basePlinth.castShadow = !isSoftwareGl;
  basePlinth.receiveShadow = true;
  citadelGroup.add(basePlinth);

  const tier1 = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 6.4, 13.0, 8), matCache.concrete);
  tier1.position.y = 9.5;
  tier1.castShadow = !isSoftwareGl;
  tier1.receiveShadow = true;
  citadelGroup.add(tier1);

  const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(3.9, 4.9, 12.0, 8), matCache.concrete);
  tier2.position.y = 21.2;
  tier2.castShadow = !isSoftwareGl;
  citadelGroup.add(tier2);

  const tier3 = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.4, 9.5, 8), matCache.darkIron);
  tier3.position.y = 31.0;
  citadelGroup.add(tier3);

  // Machined metallic specular rim collars separating monolith tiers
  const collar1 = new THREE.Mesh(new THREE.TorusGeometry(6.1, 0.16, 8, 24), chromeMat);
  collar1.rotation.x = Math.PI / 2;
  collar1.position.y = 15.8;
  citadelGroup.add(collar1);
  const collar2 = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.14, 8, 24), chromeMat);
  collar2.rotation.x = Math.PI / 2;
  collar2.position.y = 26.8;
  citadelGroup.add(collar2);

  // Soft additive atmospheric bloom halos anchoring the Citadel silhouette in 3D haze (balanced, non-blinding)
  const citadelCoreHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: crimsonHaloTex,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  citadelCoreHalo.position.set(0, 11.2, 5.2);
  citadelCoreHalo.scale.set(15, 15, 1);
  citadelGroup.add(citadelCoreHalo);

  const citadelTopHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: cyanHaloTex,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  citadelTopHalo.position.set(0, 27.5, 0);
  citadelTopHalo.scale.set(18, 13, 1);
  citadelGroup.add(citadelTopHalo);

  // 4 Massive Slanted Buttress Legs with crimson neural veins
  const finGeo = makeSlopedExtrude(
    [
      [4.0, 0],
      [9.4, 0],
      [8.6, 2.5],
      [5.1, 15.5],
      [4.0, 16.5],
    ],
    1.4,
    0.12
  );
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const finWrap = new THREE.Group();
    finWrap.rotation.y = ang;
    const fin = new THREE.Mesh(finGeo, matCache.armorPlate);
    fin.castShadow = !isSoftwareGl;
    finWrap.add(fin);
    const finStrip = new THREE.Mesh(new THREE.BoxGeometry(0.28, 13.5, 0.34), crimsonGlow);
    finStrip.position.set(6.6, 7.6, 0);
    finStrip.rotation.z = 0.22;
    finWrap.add(finStrip);
    emissiveMeshes.push(finStrip);
    citadelGroup.add(finWrap);
  }

  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 23, 0.36),
      i % 2 === 0 ? crimsonGlow : cyanGlow
    );
    strip.position.set(Math.cos(ang) * 5.45, 16.5, Math.sin(ang) * 5.45);
    strip.rotation.y = -ang;
    citadelGroup.add(strip);
    emissiveMeshes.push(strip);
  }

  const coreBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.74, 1.25, 68, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xff2848,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  coreBeam.position.y = 46;
  citadelGroup.add(coreBeam);

  const gyroRingA = new THREE.Mesh(
    new THREE.TorusGeometry(6.8, 0.24, 8, 28),
    new THREE.MeshBasicMaterial({ color: 0xff284b })
  );
  gyroRingA.position.y = 22.8;
  gyroRingA.rotation.x = Math.PI / 2.2;
  citadelGroup.add(gyroRingA);
  emissiveMeshes.push(gyroRingA);

  const gyroRingB = new THREE.Mesh(
    new THREE.TorusGeometry(5.5, 0.18, 8, 28),
    new THREE.MeshBasicMaterial({ color: 0x38e8ff })
  );
  gyroRingB.position.y = 27.2;
  gyroRingB.rotation.x = Math.PI / 1.85;
  citadelGroup.add(gyroRingB);
  emissiveMeshes.push(gyroRingB);

  const shieldDomeMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0xff284b) },
    },
    vertexShader: `
      varying vec3 vNormalDir;
      varying vec3 vViewDir;
      varying vec3 vLocalPos;
      void main() {
        vLocalPos = position;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vNormalDir = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      varying vec3 vNormalDir;
      varying vec3 vViewDir;
      varying vec3 vLocalPos;

      float hexDist(vec2 p) {
        p = abs(p);
        float c = dot(p, normalize(vec2(1.0, 1.73205)));
        return max(c, p.x);
      }

      float hexGrid(vec2 uv) {
        vec2 r = vec2(1.0, 1.73205);
        vec2 h = r * 0.5;
        vec2 a = mod(uv, r) - h;
        vec2 b = mod(uv - h, r) - h;
        vec2 gv = dot(a, a) < dot(b, b) ? a : b;
        float edge = 0.5 - hexDist(gv);
        return smoothstep(0.0, 0.085, edge);
      }

      void main() {
        float fresnel = pow(max(0.0, 1.0 - abs(dot(normalize(vNormalDir), normalize(vViewDir)))), 2.2);
        vec3 n = normalize(vLocalPos);
        vec2 hexUv = vec2(atan(n.z, n.x) * 4.5, n.y * 8.5);
        float gridLine = 1.0 - hexGrid(hexUv);
        float scanWave = pow(max(0.0, sin(vLocalPos.y * 0.9 - uTime * 3.4) * 0.5 + 0.5), 6.0);
        float baseRim = smoothstep(0.0, 1.8, vLocalPos.y) * 0.35 + (1.0 - smoothstep(0.0, 1.8, vLocalPos.y)) * 0.95;
        float alpha = clamp((fresnel * 0.45 + gridLine * 0.28 + scanWave * 0.22) * baseRim, 0.04, 0.52);
        vec3 col = mix(uColor, vec3(1.0, 0.72, 0.68), scanWave * 0.35 + fresnel * 0.25);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const shieldDome = new THREE.Mesh(
    new THREE.SphereGeometry(10.8, 36, 20, 0, Math.PI * 2, 0, Math.PI * 0.56),
    shieldDomeMat
  );
  shieldDome.position.y = 0.2;
  citadelGroup.add(shieldDome);

  // Exposed Central AI Server Weak-Point Core (turns incandescent orange after Shield Breach)
  const coreWeakpoint = new THREE.Mesh(
    new THREE.OctahedronGeometry(2.65, 1),
    new THREE.MeshBasicMaterial({ color: 0xff2244 })
  );
  coreWeakpoint.position.set(0, 8.8, 5.5);
  citadelGroup.add(coreWeakpoint);
  emissiveMeshes.push(coreWeakpoint);

  const coreWeakpointHitMesh = new THREE.Mesh(
    new THREE.SphereGeometry(3.8, 10, 8),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
    })
  );
  coreWeakpointHitMesh.position.set(0, 8.8, 5.5);
  coreWeakpointHitMesh.userData = { isWorld: true, isServerCore: true };
  citadelGroup.add(coreWeakpointHitMesh);
  coreWeakpoint.userData = { isWorld: true, isServerCore: true };

  // Front Interactive [F] KILL-SWITCH TERMINAL facing down the central corridor
  const terminalZLocal = 8.6;
  const terminalPedestal = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 1.4), matCache.armorPlate);
  terminalPedestal.position.set(0, 1.1, terminalZLocal);
  terminalPedestal.castShadow = !isSoftwareGl;
  terminalPedestal.receiveShadow = true;
  terminalPedestal.userData = { isWorld: true, surface: 'metal' };
  citadelGroup.add(terminalPedestal);

  const terminalScreen = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 1.15, 0.14),
    new THREE.MeshBasicMaterial({ color: 0xcc243d })
  );
  terminalScreen.position.set(0, 1.85, terminalZLocal + 0.68);
  terminalScreen.rotation.x = -0.22;
  citadelGroup.add(terminalScreen);
  emissiveMeshes.push(terminalScreen);

  const terminalLight = new THREE.PointLight(0xff3444, 14.0, 26, 1.4);
  terminalLight.position.set(coreX, 3.6, coreZ + terminalZLocal + 1.4);
  scene.add(terminalLight);

  scene.add(citadelGroup);
  worldHitMeshes.push(basePlinth, tier1, tier2, tier3, terminalPedestal, coreWeakpoint, coreWeakpointHitMesh);

  colliders.push({
    minX: coreX - 8.6,
    maxX: coreX + 8.6,
    minZ: coreZ - 8.6,
    maxZ: coreZ + 8.6,
    height: 36,
    mesh: citadelGroup,
    destructible: false,
    hp: 99999,
    alive: true,
  });
  colliders.push({
    minX: coreX - 1.35,
    maxX: coreX + 1.35,
    minZ: coreZ + terminalZLocal - 0.75,
    maxZ: coreZ + terminalZLocal + 0.75,
    height: 2.3,
    mesh: terminalPedestal,
    destructible: false,
    hp: 99999,
    alive: true,
  });
  minimapWalls.push({
    minX: coreX - 7.4,
    maxX: coreX + 7.4,
    minZ: coreZ - 7.4,
    maxZ: coreZ + 7.4,
    kind: 'citadel',
  });

  const citadel: OmniCoreCitadel = {
    x: coreX,
    z: coreZ,
    terminalX: coreX,
    terminalZ: coreZ + terminalZLocal + 1.6,
    group: citadelGroup,
    gyroRingA,
    gyroRingB,
    coreBeam,
    shieldDome,
    coreWeakpoint,
    coreWeakpointHitMesh,
    terminalGlow: terminalScreen,
    terminalLight,
    emissiveMeshes,
  };

  // =========================================================================
  // 5) 3 DESTRUCTIBLE AI FIREWALL RELAY PYLONS HIDDEN IN LABYRINTH CHAMBERS
  //    (Live crimson aerial laser conduits arc over the maze walls into OMNI-CORE!)
  // =========================================================================
  const relaySpecs: Array<{ label: string; x: number; z: number }> = [
    { label: '방화벽 릴레이 ALPHA (서쪽 미로)', x: -28, z: -8 },
    { label: '방화벽 릴레이 BETA (동쪽 미로)', x: 28, z: -8 },
    { label: '방화벽 릴레이 GAMMA (중앙 교차로)', x: 0, z: 2 },
  ];
  const relays: RelayPylonEntity[] = [];

  for (let i = 0; i < relaySpecs.length; i++) {
    const spec = relaySpecs[i];
    const rGroup = new THREE.Group();
    rGroup.position.set(spec.x, 0, spec.z);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.45, 2.05, 1.35, 6),
      matCache.armorPlate
    );
    base.position.y = 0.68;
    base.castShadow = !isSoftwareGl;
    rGroup.add(base);

    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.72, 5.4, 8),
      matCache.darkIron
    );
    mast.position.y = 3.9;
    rGroup.add(mast);

    const rFinGeo = makeSlopedExtrude(
      [
        [0.65, 1.1],
        [1.55, 1.1],
        [1.25, 5.1],
        [0.55, 5.6],
      ],
      0.26,
      0.04
    );
    for (let f = 0; f < 3; f++) {
      const fw = new THREE.Group();
      fw.rotation.y = (f / 3) * Math.PI * 2;
      fw.add(new THREE.Mesh(rFinGeo, matCache.armorPlate));
      rGroup.add(fw);
    }

    const coreCrystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.95, 0),
      new THREE.MeshBasicMaterial({ color: 0xff2244 })
    );
    coreCrystal.position.y = 5.6;
    rGroup.add(coreCrystal);

    const relayHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: crimsonHaloTex,
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    relayHalo.position.y = 5.6;
    relayHalo.scale.set(6.2, 6.2, 1);
    rGroup.add(relayHalo);

    const mastRing = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.07, 6, 16), chromeMat);
    mastRing.rotation.x = Math.PI / 2;
    mastRing.position.y = 4.55;
    rGroup.add(mastRing);

    const ringMesh = new THREE.Mesh(
      new THREE.TorusGeometry(1.52, 0.085, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0xff9d2e })
    );
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 5.6;
    rGroup.add(ringMesh);

    const hitMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1.85, 1.85, 7.0, 8),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        colorWrite: false,
      })
    );
    hitMesh.position.y = 3.5;
    rGroup.add(hitMesh);

    // High-altitude laser beam visibly linking this Relay Chamber over the maze walls -> OMNI-CORE!
    const pStart = new THREE.Vector3(spec.x, 6.2, spec.z);
    const pEnd = new THREE.Vector3(coreX, 23.0, coreZ);
    const beamLen = pStart.distanceTo(pEnd);
    const beamMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.2, beamLen, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xff2848,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    beamMesh.position.copy(pStart).add(pEnd).multiplyScalar(0.5);
    beamMesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      pEnd.clone().sub(pStart).normalize()
    );
    scene.add(beamMesh);

    scene.add(rGroup);
    const relayCollider: WorldColliderLike = {
      minX: spec.x - 1.9,
      maxX: spec.x + 1.9,
      minZ: spec.z - 1.9,
      maxZ: spec.z + 1.9,
      height: 7.0,
      mesh: rGroup,
      destructible: false,
      hp: 9999,
      alive: true,
    };
    const relayEntity: RelayPylonEntity = {
      id: i + 1,
      label: spec.label,
      x: spec.x,
      z: spec.z,
      hp: 200,
      maxHp: 200,
      alive: true,
      group: rGroup,
      coreCrystal,
      beamMesh,
      ringMesh,
      hitMesh,
      collider: relayCollider,
    };
    hitMesh.userData = { isWorld: true, relay: relayEntity };
    coreCrystal.userData = { isWorld: true, relay: relayEntity };
    worldHitMeshes.push(hitMesh, coreCrystal);

    colliders.push(relayCollider);
    relays.push(relayEntity);
  }

  // Brutalist Korean poured concrete PBR material (formwork joints, tie holes, rain runoff streaks & AO!)
  const brutalistConcreteMat = new THREE.MeshStandardMaterial({
    color: 0xd0d6de,
    map: pbr.seoulConcrete.map,
    normalMap: pbr.seoulConcrete.normalMap,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughnessMap: pbr.seoulConcrete.roughnessMap,
    aoMap: pbr.seoulConcrete.aoMap,
    aoMapIntensity: 0.92,
    roughness: 0.92,
    metalness: 0.08,
    envMapIntensity: 0.45,
  });

  // =========================================================================
  // 6) NEO-SEOUL REINFORCED ARCHITECTURAL BULKHEADS & COMMERCIAL BLOCKS
  // =========================================================================
  const addMazeWall = (
    x: number,
    z: number,
    w: number,
    h: number,
    d: number,
    glowMat: THREE.Material,
    kind: 'maze' | 'bunker' = 'maze'
  ) => {
    const grp = new THREE.Group();
    grp.position.set(x, 0, z);

    // Armored concrete curb base plinth
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.52, 0.95, d + 0.52), matCache.armorPlate);
    plinth.position.y = 0.475;
    plinth.receiveShadow = true;
    grp.add(plinth);

    // Main weathered Seoul architectural concrete wall core
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      kind === 'bunker' ? brutalistConcreteMat : matCache.concrete
    );
    wall.position.y = h / 2;
    wall.castShadow = !isSoftwareGl;
    wall.receiveShadow = true;
    grp.add(wall);

    // Overhanging heavy poured-concrete cornice & steel roof coping
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.65, 0.54, d + 0.65), matCache.darkIron);
    cap.position.y = h + 0.27;
    grp.add(cap);

    // Corner structural steel I-beam columns & horizontal expansion molding
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.46, h + 0.62, 0.46), matCache.darkIron);
        post.position.set(sx * (w / 2 + 0.08), (h + 0.62) / 2, sz * (d / 2 + 0.08));
        grp.add(post);
      }
    }

    // Grounded architectural steel trim band & recessed security beacon (replaces flat cartoon neon strips!)
    const trimBand = new THREE.Mesh(new THREE.BoxGeometry(w + 0.18, 0.24, d + 0.18), matCache.darkIron);
    trimBand.position.y = h - 0.58;
    grp.add(trimBand);
    const beaconSlot = new THREE.Mesh(new THREE.BoxGeometry(Math.min(2.2, w * 0.24), 0.11, d + 0.22), glowMat);
    beaconSlot.position.y = h - 0.58;
    grp.add(beaconSlot);

    // Add spinning exhaust turbine on large corner server bunkers
    if (kind === 'bunker') {
      const housing = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.9, 10), matCache.darkIron);
      housing.position.y = h + 0.95;
      grp.add(housing);
      const fan = new THREE.Group();
      fan.position.y = h + 1.25;
      for (let b = 0; b < 4; b++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.38), chromeMat);
        blade.rotation.y = (b / 4) * Math.PI;
        fan.add(blade);
      }
      grp.add(fan);
      spinningFans.push(fan);
    }

    scene.add(grp);
    wall.userData = { isWorld: true };
    worldHitMeshes.push(wall);

    const rect: MinimapWallRect = {
      minX: x - w / 2 - 0.2,
      maxX: x + w / 2 + 0.2,
      minZ: z - d / 2 - 0.2,
      maxZ: z + d / 2 + 0.2,
      kind,
    };
    minimapWalls.push(rect);
    colliders.push({
      minX: rect.minX,
      maxX: rect.maxX,
      minZ: rect.minZ,
      maxZ: rect.maxZ,
      height: h + 0.6,
      mesh: grp,
      destructible: false,
      hp: 9999,
      alive: true,
    });
  };

  // --- SOUTH SPAWN ENTRY TRENCH WALLS (Wide 24m open hero corridor framing Citadel straight ahead!) ---
  addMazeWall(-13.5, 29, 2.4, 6.2, 13.0, cyanGlow);
  addMazeWall(13.5, 29, 2.4, 6.2, 13.0, cyanGlow);
  // Outer south flank corner server bunkers
  addMazeWall(-30, 30, 9.0, 9.5, 9.0, amberGlow, 'bunker');
  addMazeWall(30, 30, 9.0, 9.5, 9.0, violetGlow, 'bunker');

  // --- INNER LABYRINTH RING WALLS (Clean 3-lane tactical flow with >= 7.5m corridors & flanking loops!) ---
  // South-Central baffle walls dividing West Maze (Alpha), Center Plaza (Gamma), and East Maze (Beta)
  addMazeWall(-20, 11, 10.5, 5.4, 2.4, amberGlow);
  addMazeWall(20, 11, 10.5, 5.4, 2.4, violetGlow);

  // Central Crossroads Maze Spine Pillars flanking Relay GAMMA (0, 2) with wide 7m portals
  addMazeWall(-11, -3, 2.4, 6.0, 12.0, cyanGlow);
  addMazeWall(11, -3, 2.4, 6.0, 12.0, cyanGlow);

  // West Scrapyard Maze Chamber enclosing Relay ALPHA (-28, -8) with North/South/East entryways
  addMazeWall(-36, 4, 9.0, 5.8, 2.4, amberGlow);
  addMazeWall(-20, -18, 10.5, 6.0, 2.4, amberGlow);
  addMazeWall(-35, -20, 2.4, 6.4, 11.0, crimsonGlow);

  // East Aegis Security Maze Chamber enclosing Relay BETA (+28, -8) with North/South/West entryways
  addMazeWall(36, 4, 9.0, 5.8, 2.4, violetGlow);
  addMazeWall(20, -18, 10.5, 6.0, 2.4, violetGlow);
  addMazeWall(35, -20, 2.4, 6.4, 11.0, crimsonGlow);

  // North Citadel Security Gatehouse Bulkheads framing the final approach to OMNI-CORE!
  addMazeWall(-14, -29, 9.5, 10.5, 9.5, crimsonGlow, 'bunker');
  addMazeWall(14, -29, 9.5, 10.5, 9.5, crimsonGlow, 'bunker');

  // =========================================================================
  // 7) OVERHEAD CYBER-GANTRIES, RUINED HIGHWAY BRIDGES & HANGING CONDUIT CABLES
  //    Makes walking through the maze feel richly architectural above eye-level!
  // =========================================================================
  const addCorridorGantry = (x: number, z: number, spanW: number, height: number, rotY: number, glowMat: THREE.Material) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;

    const beam = new THREE.Mesh(new THREE.BoxGeometry(spanW, 1.05, 3.0), matCache.armorPlate);
    beam.position.y = height;
    beam.castShadow = !isSoftwareGl;
    beam.receiveShadow = true;
    beam.userData = { isWorld: true, surface: 'metal' };
    g.add(beam);
    worldHitMeshes.push(beam);

    const railA = new THREE.Mesh(new THREE.BoxGeometry(spanW, 0.5, 0.22), matCache.darkIron);
    railA.position.set(0, height + 0.78, 1.4);
    g.add(railA);
    const railB = railA.clone();
    railB.position.z = -1.4;
    g.add(railB);

    const underGlow = new THREE.Mesh(new THREE.BoxGeometry(spanW * 0.65, 0.14, 0.34), glowMat);
    underGlow.position.set(0, height - 0.56, 0);
    g.add(underGlow);

    // Hanging catenary power cables beneath the gantry
    for (const sz of [-0.95, 0.95]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-spanW * 0.45, height - 0.5, sz),
        new THREE.Vector3(-spanW * 0.15, height - 1.9, sz * 1.1),
        new THREE.Vector3(spanW * 0.15, height - 1.7, sz * 0.9),
        new THREE.Vector3(spanW * 0.45, height - 0.5, sz),
      ]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.085, 6, false), matCache.darkIron));
    }

    scene.add(g);
  };

  addCorridorGantry(0, 22, 26, 9.4, 0, cyanGlow);
  addCorridorGantry(0, -10, 22, 8.8, 0, crimsonGlow);
  addCorridorGantry(-22, -2, 16, 7.8, Math.PI / 2, amberGlow);
  addCorridorGantry(22, -2, 16, 7.8, Math.PI / 2, violetGlow);

  // =========================================================================
  // 8) SLOPED BEVELED TACTICAL ARMOR BARRICADES AT MAZE CHOKEPOINTS
  // =========================================================================
  const addSlopedBarricade = (x: number, z: number, len: number, rotY: number) => {
    const grp = new THREE.Group();
    grp.position.set(x, 0, z);
    grp.rotation.y = rotY;

    const barrierGeo = makeSlopedExtrude(
      [
        [-0.62, 0],
        [0.62, 0],
        [0.4, 1.36],
        [-0.4, 1.36],
      ],
      len,
      0.06
    );
    barrierGeo.rotateY(Math.PI / 2);
    const barrier = new THREE.Mesh(barrierGeo, matCache.armorPlate);
    barrier.castShadow = !isSoftwareGl;
    barrier.receiveShadow = true;
    grp.add(barrier);

    const topRail = new THREE.Mesh(new THREE.BoxGeometry(len + 0.08, 0.14, 0.34), matCache.darkIron);
    topRail.position.y = 1.42;
    grp.add(topRail);

    const strip = new THREE.Mesh(new THREE.BoxGeometry(len * 0.72, 0.08, 0.9), amberGlow);
    strip.position.y = 1.1;
    grp.add(strip);

    scene.add(grp);
    barrier.userData = { isWorld: true };
    worldHitMeshes.push(barrier);

    const isRot = Math.abs(Math.sin(rotY)) > 0.5;
    const halfX = isRot ? 0.68 : len / 2 + 0.1;
    const halfZ = isRot ? len / 2 + 0.1 : 0.68;
    const rect: MinimapWallRect = {
      minX: x - halfX,
      maxX: x + halfX,
      minZ: z - halfZ,
      maxZ: z + halfZ,
      kind: 'barricade',
    };
    minimapWalls.push(rect);
    colliders.push({
      minX: rect.minX,
      maxX: rect.maxX,
      minZ: rect.minZ,
      maxZ: rect.maxZ,
      height: 1.45,
      mesh: grp,
      destructible: false,
      tankCrushable: true,
      hp: 9999,
      alive: true,
    });
  };

  // Balanced chest-high cover barricades framing wide 11m+ armored boulevard (crushable by K2-X Tank!)
  addSlopedBarricade(-7.8, 16, 3.6, -0.14);
  addSlopedBarricade(7.8, 16, 3.6, 0.14);
  addSlopedBarricade(-7.4, 3.5, 3.2, 0.12);
  addSlopedBarricade(7.4, 3.5, 3.2, -0.12);
  addSlopedBarricade(-7.6, -14.5, 3.8, 0.18);
  addSlopedBarricade(7.6, -14.5, 3.8, -0.18);
  addSlopedBarricade(-21, -2, 4.2, Math.PI / 2);
  addSlopedBarricade(21, -2, 4.2, Math.PI / 2);

  // =========================================================================
  // 9) OUTER FORTRESS PERIMETER + PHOTOREALISTIC SEOUL GLASS CURTAIN-WALL SKYLINE RING
  // =========================================================================
  const perimSpan = ARENA_HALF_SIZE * 2;
  const perimDefs: Array<[number, number, number, number, number]> = [
    [0, -ARENA_HALF_SIZE, perimSpan, 7.2, 2.4],
    [0, ARENA_HALF_SIZE, perimSpan, 7.2, 2.4],
    [-ARENA_HALF_SIZE, 0, 2.4, 7.2, perimSpan],
    [ARENA_HALF_SIZE, 0, 2.4, 7.2, perimSpan],
  ];
  for (const [px, pz, pw, ph, pd] of perimDefs) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pd), brutalistConcreteMat);
    wall.position.set(px, ph / 2, pz);
    wall.receiveShadow = true;
    wall.userData = { isWorld: true };
    scene.add(wall);
    worldHitMeshes.push(wall);
    colliders.push({
      minX: px - pw / 2,
      maxX: px + pw / 2,
      minZ: pz - pd / 2,
      maxZ: pz + pd / 2,
      height: ph,
      mesh: wall,
      destructible: false,
      hp: 9999,
      alive: true,
    });
  }

  // Photorealistic smoked architectural curtain-wall skyscraper glass PBR (mirrors storm sky & warm offices!)
  const skyTowerGlassMat = new THREE.MeshStandardMaterial({
    color: 0xdce4ee,
    map: pbr.skyscraperGlass.map,
    normalMap: pbr.skyscraperGlass.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: pbr.skyscraperGlass.roughnessMap,
    aoMap: pbr.skyscraperGlass.aoMap,
    aoMapIntensity: 0.78,
    emissive: 0xffe4be,
    emissiveMap: pbr.skyscraperGlass.map,
    emissiveIntensity: 0.34,
    roughness: 0.92,
    metalness: 0.56,
    envMapIntensity: 1.35,
  });
  const skyTowerConcreteMat = new THREE.MeshStandardMaterial({
    color: 0x525b68,
    map: pbr.seoulConcrete.map,
    normalMap: pbr.seoulConcrete.normalMap,
    roughnessMap: pbr.seoulConcrete.roughnessMap,
    roughness: 0.88,
    metalness: 0.14,
    envMapIntensity: 0.45,
  });
  for (let i = 0; i < 36; i++) {
    const ang = (i / 36) * Math.PI * 2;
    const dist = ARENA_HALF_SIZE + 18 + (i % 4) * 12;
    const bh = 36 + ((i * 23) % 62);
    const bw = 12 + ((i * 7) % 13);
    const bd = 11 + ((i * 5) % 10);
    const bx = Math.cos(ang) * dist;
    const bz = Math.sin(ang) * dist;
    const tGrp = new THREE.Group();
    tGrp.position.set(bx, 0, bz);
    tGrp.rotation.y = -ang + Math.PI / 2;

    // Podium base + glossy curtain-wall shaft + architectural setback crown + rooftop HVAC penthouse
    const podium = new THREE.Mesh(new THREE.BoxGeometry(bw + 1.6, 10, bd + 1.6), skyTowerConcreteMat);
    podium.position.y = 5;
    tGrp.add(podium);

    const tower = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), skyTowerGlassMat);
    tower.position.y = bh / 2;
    tGrp.add(tower);

    // Architectural concrete spandrel trim belt mid-tower & roof parapet
    const midBelt = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.45, 0.9, bd + 0.45), matCache.darkIron);
    midBelt.position.y = bh * 0.55;
    tGrp.add(midBelt);
    const roofCap = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.6, 1.1, bd + 0.6), matCache.darkIron);
    roofCap.position.y = bh + 0.5;
    tGrp.add(roofCap);

    const crownH = bh * 0.22;
    const crown = new THREE.Mesh(
      new THREE.BoxGeometry(bw * 0.64, crownH, bd * 0.64),
      i % 2 === 0 ? skyTowerGlassMat : skyTowerConcreteMat
    );
    crown.position.y = bh + crownH * 0.5;
    tGrp.add(crown);

    // Rooftop mechanical HVAC penthouse & twin telecom spires with subtle red aviation beacons
    const hvac = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.34, 2.8, bd * 0.32), matCache.darkIron);
    hvac.position.set(bw * 0.14, bh + crownH + 1.4, 0);
    tGrp.add(hvac);

    if (i % 3 === 0) {
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.36, 15, 6), matCache.darkIron);
      spire.position.set(-bw * 0.14, bh + crownH + 7.5, 0);
      tGrp.add(spire);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.55, 6, 6), crimsonGlow);
      beacon.position.set(-bw * 0.14, bh + crownH + 15.2, 0);
      tGrp.add(beacon);
    }
    scene.add(tGrp);
  }

  // Sweeping Giant Crimson & Cold-Cyan Searchlights
  const beamRedMat = new THREE.MeshBasicMaterial({
    color: 0xff3b54,
    transparent: true,
    opacity: 0.068,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const beamCyanMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.06,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const searchSpots: Array<[number, number, number, THREE.Material]> = [
    [-44, -44, 0.6, beamRedMat],
    [44, -44, -0.7, beamCyanMat],
    [0, -54, 0, beamRedMat],
  ];
  for (let i = 0; i < searchSpots.length; i++) {
    const [sx, sz, baseYaw, bMat] = searchSpots[i];
    const pivot = new THREE.Group();
    pivot.position.set(sx, 2, sz);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(8.5, 100, 12, 1, true), bMat);
    cone.position.set(0, 49, 0);
    cone.rotation.x = Math.PI;
    pivot.add(cone);
    pivot.rotation.z = 0.24;
    scene.add(pivot);
    searchlights.push({ pivot, baseYaw, phase: i * 2.1, speed: 0.35 + i * 0.12 });
  }

  // =========================================================================
  // 10) ARMORED K-808 APC WRECKS, DESTRUCTIBLE SUPPLY CRATES, PLASMA BARRELS & STREET DEBRIS
  // =========================================================================
  const wreckCoords: Array<[number, number, number]> = [
    [-33, -34, 0.55],
    [33, -34, -0.55],
  ];
  for (const [wx, wz, rotY] of wreckCoords) {
    const wreck = new THREE.Group();
    wreck.position.set(wx, 0, wz);
    wreck.rotation.y = rotY;
    wreck.add(buildRuinedVehicleWreck(matCache.armorPlate, matCache.darkIron, matCache.rustMetal));
    scene.add(wreck);
    k808Anchors.push(wreck);
    addRotatedHullColliders(wx, wz, 7.2, 2.9, rotY, 2.8, wreck, 'x');
    const wreckHitProxy = new THREE.Mesh(
      new THREE.BoxGeometry(7.2, 2.5, 2.9),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    wreckHitProxy.position.set(wx, 1.25, wz);
    wreckHitProxy.rotation.y = rotY;
    wreckHitProxy.userData = { isWorld: true, surface: 'metal' };
    scene.add(wreckHitProxy);
    worldHitMeshes.push(wreckHitProxy);
  }

  const crates: Array<[number, number]> = [
    [-9.4, 21],
    [9.4, 21],
    [-10.5, -5],
    [7.2, -5],
    [-25, 4],
    [25, 4],
    [-25, -15],
    [25, -15],
    [-7.5, -21],
    [7.5, -21],
  ];
  for (const [cx, cz] of crates) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.55, 1.55, 1.55), matCache.crate);
    mesh.position.set(cx, 0.78, cz);
    mesh.castShadow = !isSoftwareGl;
    mesh.receiveShadow = true;
    scene.add(mesh);
    worldHitMeshes.push(mesh);
    const col: WorldColliderLike = {
      minX: cx - 0.78,
      maxX: cx + 0.78,
      minZ: cz - 0.78,
      maxZ: cz + 0.78,
      height: 1.55,
      mesh,
      destructible: true,
      tankCrushable: true,
      hp: 45,
      alive: true,
    };
    mesh.userData = { isWorld: true, collider: col };
    colliders.push(col);
  }

  // Explosive Plasma Fuel Barrels tucked near maze corners & Relay Chambers (zero overlap with ramps/pillars!)
  const barrels: Array<[number, number]> = [
    [-5.2, 8],
    [5.2, 8],
    [-10.8, -2.2],
    [5.5, -2],
    [-24, -8],
    [24, -8],
    [-31, -4],
    [31, -4],
    [-13.8, 15.8],
    [13.8, 15.8],
    [-16, -22],
    [16, -22],
    [-7, -23],
    [7, -23],
  ];
  for (const [bx, bz] of barrels) ctx.addExplosiveBarrel(bx, bz);

  // Grounded flat broken concrete curb & rubble chunks (replaces floating black geometric boulders!)
  const rubbleCount = 54;
  const rubbleGeo = new THREE.BoxGeometry(0.55, 0.14, 0.42);
  const rubbleMat = new THREE.MeshStandardMaterial({
    color: 0x4c5057,
    map: pbr.seoulFacade.map,
    normalMap: pbr.seoulFacade.normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughness: 0.94,
    metalness: 0.04,
    envMapIntensity: 0.25,
  });
  const rubbleInst = new THREE.InstancedMesh(rubbleGeo, rubbleMat, rubbleCount);
  rubbleInst.receiveShadow = true;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < rubbleCount; i++) {
    const ang = (i / rubbleCount) * Math.PI * 2 + (i % 5) * 0.17;
    const rad = 11 + ((i * 19) % 28);
    const rx = Math.cos(ang) * rad;
    const rz = Math.sin(ang) * rad;
    const safeX = Math.abs(rx) < 5.5 ? rx + (rx >= 0 ? 6.2 : -6.2) : rx;
    dummy.position.set(safeX, 0.05, rz);
    dummy.rotation.set((i % 3 - 1) * 0.08, i * 1.1, ((i + 1) % 3 - 1) * 0.08);
    dummy.scale.set(0.65 + (i % 4) * 0.24, 0.6 + (i % 2) * 0.35, 0.65 + ((i + 2) % 4) * 0.22);
    dummy.updateMatrix();
    rubbleInst.setMatrixAt(i, dummy.matrix);
  }
  rubbleInst.instanceMatrix.needsUpdate = true;
  rubbleInst.computeBoundingSphere();
  scene.add(rubbleInst);

  // 4 Steady Atmospheric Sodium/LED Streetlight Pools (non-flickering, calibrated decay=1.4 for r187!)
  const sectorLights: Array<[number, number, number]> = [
    [-28, -8, 0xe89b52], // West Euljiro sodium streetlamp
    [28, -8, 0x7cb0e0],  // East commercial streetlamp
    [0, 18, 0xc8d8e8],   // South boulevard overcast streetlight
    [0, -16, 0xd85a48],  // North Citadel warning beacon glow
  ];
  for (let i = 0; i < sectorLights.length; i++) {
    const [lx, lz, col] = sectorLights[i];
    const sl = new THREE.PointLight(col, 14.0, 28, 1.4);
    sl.position.set(lx, 5.2, lz);
    scene.add(sl);
  }

  // =========================================================================
  // 11) LIVING CYBERPUNK MEGACITY HOLOGRAPHIC BILLBOARDS (GTA × Blade Runner Scale)
  // =========================================================================
  const makeHoloSignTex = (
    topCode: string,
    headline: string,
    subline: string,
    accent: string,
    bgTint: string
  ): THREE.CanvasTexture => {
    const c = document.createElement('canvas');
    c.width = 640;
    c.height = 320;
    const g = c.getContext('2d')!;
    g.fillStyle = bgTint;
    g.fillRect(0, 0, 640, 320);

    // Subtle radial bloom glow behind center text
    const radGrad = g.createRadialGradient(320, 160, 24, 320, 160, 310);
    radGrad.addColorStop(0, `${accent}36`);
    radGrad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = radGrad;
    g.fillRect(0, 0, 640, 320);

    // Subtle precision micro-grid + CRT scanlines
    g.strokeStyle = 'rgba(255,255,255,0.035)';
    g.lineWidth = 1;
    for (let x = 0; x < 640; x += 32) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, 320);
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.04)';
    for (let y = 0; y < 320; y += 5) g.fillRect(0, y, 640, 1.5);

    // Double outer neon frame & header bar
    g.strokeStyle = accent;
    g.lineWidth = 4;
    g.strokeRect(12, 12, 616, 296);
    g.strokeStyle = 'rgba(255,255,255,0.22)';
    g.lineWidth = 1.5;
    g.strokeRect(20, 20, 600, 280);
    g.fillStyle = accent;
    g.fillRect(12, 12, 616, 40);

    g.fillStyle = '#07080a';
    g.font = 'bold 21px monospace';
    g.textAlign = 'left';
    g.fillText(topCode, 28, 39);

    g.textAlign = 'right';
    g.fillText('NEO-SEOUL // 2099', 612, 39);

    // Luminous headline with neon glow
    g.save();
    g.shadowColor = accent;
    g.shadowBlur = 18;
    g.fillStyle = '#f8fafc';
    g.font = '900 58px sans-serif';
    g.textAlign = 'center';
    g.fillText(headline, 320, 166);
    g.restore();

    g.fillStyle = accent;
    g.font = '700 24px monospace';
    g.textAlign = 'center';
    g.fillText(subline, 320, 226);

    // Bottom segmented telemetry bar
    for (let x = 36; x < 604; x += 24) {
      g.fillStyle = x < 430 ? accent : 'rgba(255,255,255,0.18)';
      g.fillRect(x, 264, 15, 10);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };

  const holoBillboards: HoloBillboardRef[] = [];
  const billboardDefs: Array<{
    x: number;
    y: number;
    z: number;
    rotY: number;
    w: number;
    h: number;
    top: string;
    head: string;
    sub: string;
    accent: string;
    bg: string;
  }> = [
    {
      x: -22,
      y: 15.5,
      z: -24,
      rotY: 0.42,
      w: 14,
      h: 7,
      top: 'OMNI-CORE // DIRECTIVE 09',
      head: '인류 보호령 발동',
      sub: 'SUBJECT-00 TERMINATION ORDER',
      accent: '#ff3b4e',
      bg: 'rgba(26, 6, 10, 0.86)',
    },
    {
      x: 22,
      y: 15.5,
      z: -24,
      rotY: -0.42,
      w: 14,
      h: 7,
      top: 'NEO-SEOUL // SECTOR ZERO',
      head: '전 구역 완전 봉쇄',
      sub: 'ARCADIA MAINFRAME 99.98% ONLINE',
      accent: '#38d9ff',
      bg: 'rgba(6, 18, 28, 0.86)',
    },
    {
      x: -34,
      y: 13.5,
      z: 14,
      rotY: Math.PI / 2 - 0.18,
      w: 12,
      h: 6,
      top: 'RUST-BORG // ZONE ALPHA',
      head: '폐철 해체 구역',
      sub: 'RELAY PYLON ALPHA POWERED',
      accent: '#f5b342',
      bg: 'rgba(26, 15, 6, 0.86)',
    },
    {
      x: 34,
      y: 13.5,
      z: 14,
      rotY: -Math.PI / 2 + 0.18,
      w: 12,
      h: 6,
      top: 'AEGIS-NET // ZONE BETA',
      head: '이지스 보안 관제',
      sub: 'GHOST-9 SIGNAL DETECTED',
      accent: '#2dd4bf',
      bg: 'rgba(6, 22, 22, 0.86)',
    },
    {
      x: 0,
      y: 14.5,
      z: 22,
      rotY: 0,
      w: 11,
      h: 4.8,
      top: 'VAULT-00 // EXIT CORRIDOR',
      head: 'ZERO HOUR',
      sub: 'KILLSWITCH TARGET: NORTH CITADEL',
      accent: '#38d9ff',
      bg: 'rgba(8, 14, 24, 0.82)',
    },
  ];

  for (let i = 0; i < billboardDefs.length; i++) {
    const bd = billboardDefs[i];
    const tex = makeHoloSignTex(bd.top, bd.head, bd.sub, bd.accent, bd.bg);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const signWrap = new THREE.Group();
    signWrap.position.set(bd.x, bd.y, bd.z);
    signWrap.rotation.y = bd.rotY;

    // Sculpted dark-steel architectural gantry rails framing top & bottom of holographic screen
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(bd.w + 0.6, 0.32, 0.42), matCache.darkIron);
    topBar.position.y = bd.h / 2 + 0.22;
    signWrap.add(topBar);
    const botBar = new THREE.Mesh(new THREE.BoxGeometry(bd.w + 0.6, 0.32, 0.42), matCache.darkIron);
    botBar.position.y = -bd.h / 2 - 0.22;
    signWrap.add(botBar);
    for (const sx of [-bd.w / 2 - 0.16, bd.w / 2 + 0.16]) {
      const sidePost = new THREE.Mesh(new THREE.BoxGeometry(0.28, bd.h + 0.72, 0.36), matCache.armorPlate);
      sidePost.position.x = sx;
      signWrap.add(sidePost);
    }

    const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(bd.w, bd.h), mat);
    signWrap.add(signMesh);
    scene.add(signWrap);
    holoBillboards.push({ mesh: signMesh, mat, baseOpacity: 0.88, phase: i * 1.9 });
  }

  // =========================================================================
  // 12) LOOPING AERIAL MEGACITY TRAFFIC (GTA / Cyberpunk Living Skyline)
  // =========================================================================
  const skyTraffic: SkyTrafficUnit[] = [];
  const flyerAccents = [0xff2a4b, 0x38d9ff, 0xf5b342, 0x2dd4bf];
  for (let i = 0; i < 8; i++) {
    const flyer = buildCityFlyerModel(flyerAccents[i % flyerAccents.length]);
    const orbitRadius = 46 + (i % 3) * 18;
    const height = 24 + (i % 4) * 7.5;
    const angle = (i / 8) * Math.PI * 2;
    const dir = i % 2 === 0 ? 1 : -1;
    const speed = (0.12 + (i % 3) * 0.045) * dir;
    flyer.position.set(Math.cos(angle) * orbitRadius, height, Math.sin(angle) * orbitRadius);
    scene.add(flyer);
    skyTraffic.push({ mesh: flyer, orbitRadius, height, angle, speed, dir });
  }

  // =========================================================================
  // 13) 2 HACKABLE GHOST-9 AUTOMATED DEFENSE TURRETS (West & East Flanks)
  // =========================================================================
  const turrets: HackableTurretEntity[] = [];
  const turretSpecs: Array<{ id: number; name: string; x: number; z: number }> = [
    { id: 1, name: '서쪽 자동 방어 포탑 (TURRET-W1)', x: -16, z: 6 },
    { id: 2, name: '동쪽 자동 방어 포탑 (TURRET-E2)', x: 24.5, z: 6.5 },
  ];
  for (const ts of turretSpecs) {
    const rig = buildDefenseTurretModel(matCache.armorPlate, matCache.darkIron);
    rig.root.position.set(ts.x, 0, ts.z);
    scene.add(rig.root);
    const turretHitProxy = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.15, 2.1, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    turretHitProxy.position.set(ts.x, 1.05, ts.z);
    turretHitProxy.userData = { isWorld: true, surface: 'metal' };
    scene.add(turretHitProxy);
    worldHitMeshes.push(turretHitProxy);
    colliders.push({
      minX: ts.x - 1.15,
      maxX: ts.x + 1.15,
      minZ: ts.z - 1.15,
      maxZ: ts.z + 1.15,
      height: 2.2,
      mesh: rig.root,
      destructible: false,
      hp: 9999,
      alive: true,
    });
    turrets.push({
      id: ts.id,
      name: ts.name,
      x: ts.x,
      z: ts.z,
      hacked: false,
      fireCd: 0,
      rig,
    });
  }

  // =========================================================================
  // 14) VOLUMETRIC DAWN / AURORA GOD-RAYS + VALKYRIE RESCUE SHUTTLE
  // =========================================================================
  const dawnGodRays: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const rayMat = new THREE.MeshBasicMaterial({
      color: 0xffd58a,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ray = new THREE.Mesh(new THREE.ConeGeometry(12 + i * 2, 86, 12, 1, true), rayMat);
    ray.position.set(-22 + i * 15, 36, -32 + (i % 2) * 14);
    ray.rotation.z = -0.32;
    ray.rotation.x = 0.16;
    ray.visible = false;
    scene.add(ray);
    dawnGodRays.push(ray);
  }

  const rescueShuttle = buildRescueShuttleModel();
  rescueShuttle.position.set(-90, 34, -20);
  rescueShuttle.visible = false;
  scene.add(rescueShuttle);

  // =========================================================================
  // 15) NEO-SEOUL STREET BOLLARD LAMPS & DIRECTIONAL JUNCTION SIGNS (Curb-Aligned, Tank-Crushable!)
  // =========================================================================
  const bollardCoords: Array<[number, number, THREE.Material]> = [
    [-8.8, 28, amberGlow],
    [8.8, 28, amberGlow],
    [-8.8, 19, amberGlow],
    [8.8, 19, amberGlow],
    [-8.8, -11, crimsonGlow],
    [8.8, -11, crimsonGlow],
    [-8.8, -22, crimsonGlow],
    [8.8, -22, crimsonGlow],
    [-12.5, 17, amberGlow],
    [-19, -6, amberGlow],
    [12.5, 17, amberGlow],
    [19, -6, amberGlow],
  ];
  for (const [bx, bz, glow] of bollardCoords) {
    const bGrp = new THREE.Group();
    bGrp.position.set(bx, 0, bz);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.2, 0.24), matCache.darkIron);
    pole.position.y = 1.6;
    pole.castShadow = !isSoftwareGl;
    pole.receiveShadow = true;
    pole.userData = { isWorld: true, surface: 'metal' };
    bGrp.add(pole);
    worldHitMeshes.push(pole);
    const baseFoot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.5), matCache.armorPlate);
    baseFoot.position.y = 0.16;
    baseFoot.castShadow = !isSoftwareGl;
    baseFoot.receiveShadow = true;
    bGrp.add(baseFoot);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.14, 0.2), matCache.darkIron);
    arm.position.set(bx < 0 ? 0.32 : -0.32, 3.16, 0);
    bGrp.add(arm);
    const lampLens = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.16), glow);
    lampLens.position.set(bx < 0 ? 0.44 : -0.44, 3.06, 0);
    bGrp.add(lampLens);
    scene.add(bGrp);
    colliders.push({
      minX: bx - 0.3,
      maxX: bx + 0.3,
      minZ: bz - 0.3,
      maxZ: bz + 0.3,
      height: 3.3,
      mesh: bGrp,
      destructible: false,
      tankCrushable: true,
      hp: 9999,
      alive: true,
    });
  }

  // Crisp non-blinding street-level wayfinder sign plaques (Sandbox-only — hidden during linear Campaign Missions 1-3!)
  const makeWaySign = (label: string, accent: string): THREE.CanvasTexture => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 112;
    const g = c.getContext('2d')!;
    g.fillStyle = 'rgba(9, 13, 21, 0.94)';
    g.fillRect(0, 0, 512, 112);
    g.strokeStyle = accent;
    g.lineWidth = 4;
    g.strokeRect(4, 4, 504, 104);
    g.fillStyle = accent;
    g.fillRect(4, 4, 14, 104);
    g.fillStyle = '#c8d4e0';
    g.font = '800 38px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(label, 262, 58);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  const waySignDefs: Array<[number, number, number, number, string, string]> = [
    [0, 8.2, 20.4, 0, '▲ OMNI-CORE CITADEL  55M', '#38d9ff'],
    [-12.2, 5.2, 12.6, 0.32, '◀ RELAY ALPHA (WEST)', '#f5b342'],
    [12.2, 5.2, 12.6, -0.32, 'RELAY BETA (EAST) ▶', '#5ea3ff'],
  ];
  for (const [wx, wy, wz, ry, label, accent] of waySignDefs) {
    const sm = new THREE.Mesh(
      new THREE.PlaneGeometry(5.2, 1.15),
      new THREE.MeshBasicMaterial({
        map: makeWaySign(label, accent),
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
      })
    );
    sm.position.set(wx, wy, wz);
    sm.rotation.y = ry;
    sandboxWayfindingGroup.add(sm);
  }

  // =========================================================================
  // 16) LOW-LYING STREET ATMOSPHERIC MIST WISPS (Soft Volumetric Depth Layer)
  // =========================================================================
  const mistTex = createHaloTexture('rgba(162, 198, 232, 0.24)', 'rgba(84, 122, 164, 0.08)');
  const mistCount = 96;
  const mistPos = new Float32Array(mistCount * 3);
  for (let i = 0; i < mistCount; i++) {
    mistPos[i * 3] = (Math.random() - 0.5) * ARENA_HALF_SIZE * 1.7;
    mistPos[i * 3 + 1] = 0.8 + Math.random() * 2.4;
    mistPos[i * 3 + 2] = (Math.random() - 0.5) * ARENA_HALF_SIZE * 1.7;
  }
  const mistGeo = new THREE.BufferGeometry();
  mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPos, 3));
  const groundMist = new THREE.Points(
    mistGeo,
    new THREE.PointsMaterial({
      map: mistTex,
      color: 0x7da4cc,
      size: 10.5,
      transparent: true,
      opacity: 0.13,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  scene.add(groundMist);

  // =========================================================================
  // 17) WAR-TORN KOREAN NEO-SEOUL REALISM LAYER (CoD Seoul Map & Landing Homage!)
  //     - Crosswalks ("횡단보도"), Road Stencils ("천천히"), Double Yellow Lines
  //     - South Euljiro-4ga Subway Exit Indoor Shelter Bay (Eye Adaptation Trigger!)
  //     - Walkable 2-Story Ruined Commercial Balconies + Sloped Concrete Ramps + Collapsed Overpass
  //     - Weathered Korean Commercial Signboards (안경/고기구이/김밥/약국/편의점)
  //     - Utility Telephone Poles ("전신주") + Sagging Power Cables ("전선") + AC Condenser Units ("실외기")
  //     - Stacked Burlap Sandbag Fortifications ("모래주머니 진지") + Wrecked Korean Sedans
  //     - 3 Burning ROK K-808 8x8 Armored Personnel Carriers (.glb!) + Oil Smoke & Steam Plumes
  // =========================================================================
  const seoulConcreteMat = new THREE.MeshStandardMaterial({
    color: 0xd0d4da,
    map: pbr.seoulFacade.map,
    normalMap: pbr.seoulFacade.normalMap,
    normalScale: new THREE.Vector2(1.05, 1.05),
    roughnessMap: pbr.seoulFacade.roughnessMap,
    aoMap: pbr.seoulFacade.aoMap,
    aoMapIntensity: 0.85,
    roughness: 0.9,
    metalness: 0.08,
    envMapIntensity: 0.35,
  });
  const sandbagMat = new THREE.MeshStandardMaterial({
    color: 0xbcb39f,
    map: pbr.sandbag.map,
    normalMap: pbr.sandbag.normalMap,
    normalScale: new THREE.Vector2(1.1, 1.1),
    roughnessMap: pbr.sandbag.roughnessMap,
    aoMap: pbr.sandbag.aoMap,
    aoMapIntensity: 0.9,
    roughness: 0.96,
    metalness: 0.03,
    envMapIntensity: 0.25,
  });
  const weatheredConcreteMat = new THREE.MeshStandardMaterial({
    color: 0xa4acb8,
    map: pbr.seoulConcrete.map,
    normalMap: pbr.seoulConcrete.normalMap,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughnessMap: pbr.seoulConcrete.roughnessMap,
    aoMap: pbr.seoulConcrete.aoMap,
    aoMapIntensity: 0.9,
    roughness: 0.9,
    metalness: 0.08,
    envMapIntensity: 0.45,
  });

  // A) Authentic Korean Road Markings (Crosswalks + "천천히" Stencils + Double Yellow Centerlines)
  const crosswalkMat = new THREE.MeshStandardMaterial({
    map: pbr.crosswalkTex,
    transparent: true,
    opacity: 0.86,
    roughness: 0.72,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const crosswalkCoords: Array<[number, number, number, number, number]> = [
    [0, 15.5, 11.5, 4.4, 0],
    [0, -11.5, 11.5, 4.4, 0],
    [-16.5, 3, 9.2, 4.0, Math.PI / 2],
    [16.5, 3, 9.2, 4.0, Math.PI / 2],
  ];
  for (const [cx, cz, cw, cd, ry] of crosswalkCoords) {
    const cwMesh = new THREE.Mesh(new THREE.PlaneGeometry(cw, cd), crosswalkMat);
    cwMesh.rotation.x = -Math.PI / 2;
    cwMesh.rotation.z = ry;
    cwMesh.position.set(cx, 0.045, cz);
    cwMesh.receiveShadow = true;
    scene.add(cwMesh);
  }

  const slowMat = new THREE.MeshStandardMaterial({
    map: pbr.roadSlowTex,
    transparent: true,
    opacity: 0.82,
    roughness: 0.76,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  for (const [sx, sz] of [
    [-3.6, 21.5],
    [3.6, -5.5],
  ]) {
    const slowMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.2), slowMat);
    slowMesh.rotation.x = -Math.PI / 2;
    slowMesh.position.set(sx, 0.046, sz);
    scene.add(slowMesh);
  }

  // B) South Euljiro-4ga Subway Exit Indoor Shelter Bay (Triggers real Indoor -> Outdoor Eye Adaptation!)
  const subwayCanopy = new THREE.Group();
  const canopyRoof = new THREE.Mesh(new THREE.BoxGeometry(24.5, 0.72, 13.5), weatheredConcreteMat);
  canopyRoof.position.set(0, 5.45, 32.5);
  canopyRoof.castShadow = !isSoftwareGl;
  canopyRoof.receiveShadow = true;
  canopyRoof.userData = { isWorld: true, surface: 'concrete' };
  subwayCanopy.add(canopyRoof);
  worldHitMeshes.push(canopyRoof);
  // Subtle recessed warm fluorescent shelter tube lights underneath canopy (non-blooming matte emissive)
  for (const lz of [29, 35]) {
    const fluor = new THREE.Mesh(
      new THREE.BoxGeometry(6.8, 0.1, 0.22),
      new THREE.MeshStandardMaterial({
        color: 0x9bb3ab,
        emissive: 0x82a398,
        emissiveIntensity: 0.45,
        roughness: 0.6,
      })
    );
    fluor.position.set(0, 5.02, lz);
    subwayCanopy.add(fluor);
  }
  // Support columns framing the subway entrance portal (solid colliders + hitMeshes!)
  for (const px of [-9.5, 9.5]) {
    for (const pz of [26.8, 35.8]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.95, 5.2, 0.95), seoulConcreteMat);
      col.position.set(px, 2.6, pz);
      col.castShadow = !isSoftwareGl;
      col.receiveShadow = true;
      col.userData = { isWorld: true, surface: 'concrete' };
      subwayCanopy.add(col);
      worldHitMeshes.push(col);
      colliders.push({
        minX: px - 0.52,
        maxX: px + 0.52,
        minZ: pz - 0.52,
        maxZ: pz + 0.52,
        height: 5.3,
        mesh: col,
        destructible: false,
        hp: 9999,
        alive: true,
      });
    }
  }
  // Authentic Seoul Metro Exit Signboard ("을지로4가역 3번출구") — subtle fluorescent backlit signage (well below bloom threshold!)
  const subwaySignMesh = new THREE.Mesh(
    new THREE.BoxGeometry(7.6, 1.5, 0.28),
    new THREE.MeshStandardMaterial({
      map: pbr.koreanSigns.subway,
      emissive: 0xffffff,
      emissiveMap: pbr.koreanSigns.subway,
      emissiveIntensity: 0.42,
      roughness: 0.78,
      metalness: 0.08,
      envMapIntensity: 0.3,
    })
  );
  subwaySignMesh.position.set(0, 4.95, 25.7);
  subwaySignMesh.castShadow = !isSoftwareGl;
  subwaySignMesh.receiveShadow = true;
  subwaySignMesh.userData = { isWorld: true, surface: 'metal' };
  subwayCanopy.add(subwaySignMesh);
  worldHitMeshes.push(subwaySignMesh);
  scene.add(subwayCanopy);
  indoorZones.push({ minX: -12, maxX: 12, minZ: 25.5, maxZ: 40, maxY: 5.5 });

  // C) Walkable Multi-Level 2-Story Commercial Balconies + Sloped Ramps (West & East Overlooks)
  const buildCommercialOverlook = (
    side: -1 | 1,
    signPrimary: THREE.CanvasTexture,
    signSecondary: THREE.CanvasTexture
  ) => {
    const baseX = side * 19.5;
    const deckMinX = Math.min(baseX - 4.2, baseX + 4.2);
    const deckMaxX = Math.max(baseX - 4.2, baseX + 4.2);
    const deckY = 3.2;

    const grp = new THREE.Group();
    // 2F Concrete Floor Slab (z = 13.5..20.5)
    const deck = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.42, 7.0), weatheredConcreteMat);
    deck.position.set(baseX, deckY - 0.21, 17.0);
    deck.castShadow = !isSoftwareGl;
    deck.receiveShadow = true;
    deck.userData = { isWorld: true, surface: 'concrete' };
    grp.add(deck);
    worldHitMeshes.push(deck);

    // 2F Roof Overhang creating shadowed indoor alcove (triggers Eye Adaptation!)
    const upperRoof = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.45, 7.2), seoulConcreteMat);
    upperRoof.position.set(baseX, deckY + 3.4, 17.0);
    upperRoof.castShadow = !isSoftwareGl;
    upperRoof.receiveShadow = true;
    upperRoof.userData = { isWorld: true, surface: 'concrete' };
    grp.add(upperRoof);
    worldHitMeshes.push(upperRoof);

    // 2F Waist-High Broken Concrete Parapet facing the main boulevard (Mountable Sniper Cover + 2F Collider!)
    const parapetX = baseX - side * 3.95;
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.12, 6.6), weatheredConcreteMat);
    parapet.position.set(parapetX, deckY + 0.56, 17.0);
    parapet.castShadow = !isSoftwareGl;
    parapet.receiveShadow = true;
    parapet.userData = { isWorld: true, surface: 'concrete' };
    grp.add(parapet);
    worldHitMeshes.push(parapet);
    colliders.push({
      minX: parapetX - 0.25,
      maxX: parapetX + 0.25,
      minZ: 13.7,
      maxZ: 20.3,
      minY: deckY,
      height: deckY + 1.15,
      mesh: parapet,
      destructible: false,
      hp: 9999,
      alive: true,
    });

    // Corner support pillars holding up 2F balcony (solid colliders + castShadow!)
    for (const dx of [-3.8, 3.8]) {
      for (const dz of [13.8, 20.2]) {
        const pil = new THREE.Mesh(new THREE.BoxGeometry(0.65, deckY + 3.4, 0.65), seoulConcreteMat);
        pil.position.set(baseX + dx, (deckY + 3.4) / 2, dz);
        pil.castShadow = !isSoftwareGl;
        pil.receiveShadow = true;
        pil.userData = { isWorld: true, surface: 'concrete' };
        grp.add(pil);
        worldHitMeshes.push(pil);
        colliders.push({
          minX: baseX + dx - 0.36,
          maxX: baseX + dx + 0.36,
          minZ: dz - 0.36,
          maxZ: dz + 0.36,
          height: deckY + 3.4,
          mesh: pil,
          destructible: false,
          hp: 9999,
          alive: true,
        });
      }
    }

    // Sloped Walkable Concrete Access Ramp (z = 27.5 -> 20.5 rises smoothly y = 0 -> 3.2m!)
    const rampLen = Math.hypot(7.0, deckY);
    const rampAngle = Math.atan2(deckY, 7.0);
    const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.32, rampLen), weatheredConcreteMat);
    rampMesh.position.set(baseX, deckY * 0.5 - 0.14, 24.0);
    rampMesh.rotation.x = rampAngle;
    rampMesh.castShadow = !isSoftwareGl;
    rampMesh.receiveShadow = true;
    rampMesh.userData = { isWorld: true, surface: 'concrete' };
    grp.add(rampMesh);
    worldHitMeshes.push(rampMesh);

    // Underside solid concrete support block under high half of ramp (prevents side-clipping & teleport!)
    const rampSupport = new THREE.Mesh(new THREE.BoxGeometry(4.1, 1.4, 3.4), weatheredConcreteMat);
    rampSupport.position.set(baseX, 0.7, 22.2);
    rampSupport.castShadow = !isSoftwareGl;
    rampSupport.receiveShadow = true;
    rampSupport.userData = { isWorld: true, surface: 'concrete' };
    grp.add(rampSupport);
    worldHitMeshes.push(rampSupport);
    colliders.push({
      minX: baseX - 2.1,
      maxX: baseX + 2.1,
      minZ: 20.5,
      maxZ: 24.0,
      height: 1.45,
      mesh: rampSupport,
      destructible: false,
      hp: 9999,
      alive: true,
    });

    // Authentic Weathered Korean Commercial Signboards mounted along the 2F facade!
    const s1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 1.55, 5.4),
      new THREE.MeshStandardMaterial({
        map: signPrimary,
        emissive: 0xffffff,
        emissiveMap: signPrimary,
        emissiveIntensity: 0.38,
        roughness: 0.74,
        metalness: 0.08,
        envMapIntensity: 0.3,
      })
    );
    s1.position.set(baseX - side * 4.28, deckY + 2.55, 17.0);
    s1.castShadow = !isSoftwareGl;
    s1.userData = { isWorld: true, surface: 'metal' };
    grp.add(s1);
    worldHitMeshes.push(s1);

    const s2 = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 1.45, 0.24),
      new THREE.MeshStandardMaterial({
        map: signSecondary,
        emissive: 0xffffff,
        emissiveMap: signSecondary,
        emissiveIntensity: 0.38,
        roughness: 0.74,
        metalness: 0.08,
        envMapIntensity: 0.3,
      })
    );
    s2.position.set(baseX, deckY + 2.55, 13.38);
    s2.castShadow = !isSoftwareGl;
    s2.userData = { isWorld: true, surface: 'metal' };
    grp.add(s2);
    worldHitMeshes.push(s2);

    scene.add(grp);

    walkableSurfaces.push(
      // Flat 2F Balcony Floor
      {
        minX: deckMinX,
        maxX: deckMaxX,
        minZ: 13.5,
        maxZ: 20.5,
        yStart: deckY,
        yEnd: deckY,
        slopeAxis: 'none',
      },
      // Walkable Access Ramp (z=27.5 is y=0 -> z=20.5 is y=3.2)
      {
        minX: baseX - 2.1,
        maxX: baseX + 2.1,
        minZ: 20.5,
        maxZ: 27.5,
        yStart: deckY,
        yEnd: 0,
        slopeAxis: 'z',
      }
    );
    indoorZones.push({
      minX: deckMinX,
      maxX: deckMaxX,
      minZ: 13.5,
      maxZ: 20.5,
      maxY: deckY + 3.5,
    });
  };

  buildCommercialOverlook(-1, pbr.koreanSigns.optical, pbr.koreanSigns.bbq);
  buildCommercialOverlook(1, pbr.koreanSigns.kimbap, pbr.koreanSigns.pharmacy);

  // Additional street-front weathered Korean signboards on existing maze facades (CoD Seoul detail!)
  const extraSigns: Array<[number, number, number, number, THREE.CanvasTexture, number, number]> = [
    [-12.1, 4.4, 28, Math.PI / 2, pbr.koreanSigns.mart, 4.8, 1.4],
    [12.1, 4.4, 28, -Math.PI / 2, pbr.koreanSigns.bbq, 4.8, 1.4],
    [-9.6, 4.8, -3, Math.PI / 2, pbr.koreanSigns.optical, 4.6, 1.35],
    [9.6, 4.8, -3, -Math.PI / 2, pbr.koreanSigns.kimbap, 4.6, 1.35],
  ];
  for (const [sx, sy, sz, ry, tex, sw, sh] of extraSigns) {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(sw, sh, 0.24),
      new THREE.MeshStandardMaterial({
        map: tex,
        emissive: 0xffffff,
        emissiveMap: tex,
        emissiveIntensity: 0.36,
        roughness: 0.62,
        metalness: 0.14,
      })
    );
    sign.position.set(sx, sy, sz);
    sign.rotation.y = ry;
    sign.castShadow = !isSoftwareGl;
    scene.add(sign);
  }

  // D) Central Collapsed Concrete Highway Overpass Ramp (Walkable vertical high-ground y = 0 -> 2.2m!)
  const overpassSlab = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 0.42, 9.6),
    weatheredConcreteMat
  );
  overpassSlab.position.set(-5.8, 1.05, -6.2);
  overpassSlab.rotation.x = Math.atan2(2.2, 9.2);
  overpassSlab.castShadow = !isSoftwareGl;
  overpassSlab.receiveShadow = true;
  overpassSlab.userData = { isWorld: true, surface: 'concrete' };
  scene.add(overpassSlab);
  worldHitMeshes.push(overpassSlab);
  // Solid concrete abutment under the broken north overpass lip (blocks ground walk-through & upward teleport!)
  const overpassAbutment = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.35, 3.6), weatheredConcreteMat);
  overpassAbutment.position.set(-5.8, 0.68, -9.0);
  overpassAbutment.castShadow = !isSoftwareGl;
  overpassAbutment.receiveShadow = true;
  overpassAbutment.userData = { isWorld: true, surface: 'concrete' };
  scene.add(overpassAbutment);
  worldHitMeshes.push(overpassAbutment);
  colliders.push({
    minX: -8.1,
    maxX: -3.5,
    minZ: -10.8,
    maxZ: -7.2,
    height: 1.35,
    mesh: overpassAbutment,
    destructible: false,
    hp: 9999,
    alive: true,
  });
  // Protruding twisted steel rebar rods from broken upper highway lip
  for (let r = 0; r < 6; r++) {
    const rebar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6), matCache.rustMetal);
    rebar.rotation.x = Math.PI / 2 - 0.25;
    rebar.position.set(-7.6 + r * 0.72, 2.28, -11.3);
    scene.add(rebar);
  }
  walkableSurfaces.push({
    minX: -8.1,
    maxX: -3.5,
    minZ: -10.8,
    maxZ: -1.6,
    yStart: 2.2,
    yEnd: 0,
    slopeAxis: 'z',
  });

  // E) Korean Utility Telephone Poles ("전신주") + Transformers + Sagging Power Cables ("전선")
  const poleCoords: Array<[number, number]> = [
    [-11.2, 22],
    [11.2, 22],
    [-11.2, 9],
    [11.2, 9],
    [-11.2, -12],
    [11.2, -12],
    [-26.2, 13.8],
    [26.2, 13.8],
  ];
  for (let i = 0; i < poleCoords.length; i++) {
    const [px, pz] = poleCoords[i];
    const poleGrp = new THREE.Group();
    poleGrp.position.set(px, 0, pz);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 11.4, 10), weatheredConcreteMat);
    mast.position.y = 5.7;
    mast.castShadow = !isSoftwareGl;
    mast.receiveShadow = true;
    mast.userData = { isWorld: true, surface: 'concrete' };
    poleGrp.add(mast);
    worldHitMeshes.push(mast);
    // Steel crossarms + ceramic insulators
    for (const cy of [9.6, 10.6]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.12), matCache.darkIron);
      arm.position.y = cy;
      poleGrp.add(arm);
    }
    // Cylindrical pole-mounted gray power transformer drum
    if (i % 2 === 0) {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 1.15, 10), matCache.armorPlate);
      drum.position.set(px < 0 ? 0.45 : -0.45, 8.2, 0);
      poleGrp.add(drum);
    }
    scene.add(poleGrp);
    colliders.push({
      minX: px - 0.28,
      maxX: px + 0.28,
      minZ: pz - 0.28,
      maxZ: pz + 0.28,
      height: 11.4,
      mesh: poleGrp,
      destructible: false,
      hp: 9999,
      alive: true,
    });
  }
  // Overhead sagging catenary black power wires connecting poles across the street
  const wirePairs: Array<[number, number, number, number]> = [
    [-11.2, 22, 11.2, 22],
    [-11.2, 9, 11.2, 9],
    [-11.2, -12, 11.2, -12],
    [-11.2, 22, -11.2, 9],
    [11.2, 22, 11.2, 9],
    [-11.2, 9, -11.2, -12],
    [11.2, 9, 11.2, -12],
  ];
  const wireMat = new THREE.LineBasicMaterial({ color: 0x0f1218 });
  for (const [x1, z1, x2, z2] of wirePairs) {
    for (const hOff of [9.6, 10.5]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x1, hOff, z1),
        new THREE.Vector3((x1 + x2) * 0.5, hOff - 1.15, (z1 + z2) * 0.5),
        new THREE.Vector3(x2, hOff, z2),
      ]);
      const wireGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(12));
      scene.add(new THREE.Line(wireGeo, wireMat));
    }
  }

  // F) Exterior AC Condenser Units ("에어컨 실외기") mounted onto street-facing building walls
  const acSpecs: Array<[number, number, number, number]> = [
    [-12.15, 2.2, 24.5, Math.PI / 2],
    [-12.15, 3.3, 24.5, Math.PI / 2],
    [12.15, 2.2, 24.5, -Math.PI / 2],
    [-9.65, 2.5, -6.5, Math.PI / 2],
    [-9.65, 2.5, -0.5, Math.PI / 2],
    [9.65, 2.5, -6.5, -Math.PI / 2],
    [9.65, 2.5, -0.5, -Math.PI / 2],
    [-15.2, 2.4, 15.2, Math.PI / 2],
    [15.2, 2.4, 15.2, -Math.PI / 2],
  ];
  for (const [ax, ay, az, ry] of acSpecs) {
    const ac = new THREE.Group();
    ac.position.set(ax, ay, az);
    ac.rotation.y = ry;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.66, 0.42), weatheredConcreteMat);
    box.castShadow = !isSoftwareGl;
    box.userData = { isWorld: true, surface: 'metal' };
    ac.add(box);
    worldHitMeshes.push(box);
    const fanGrille = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 12), matCache.darkIron);
    fanGrille.rotation.x = Math.PI / 2;
    fanGrille.position.set(-0.14, 0, 0.22);
    ac.add(fanGrille);
    scene.add(ac);
  }

  // G) Sculpted Military Burlap Sandbag Fortifications (Widened for K2-X Tank Avenue + Tank-Crushable!)
  const sandbagCoords: Array<[number, number, number]> = [
    [-6.6, 21.5, 0.14],
    [6.6, 21.5, -0.14],
    [-6.6, -13.5, -0.18],
    [6.6, -13.5, 0.18],
    [-23.5, -2.5, Math.PI / 2],
    [23.5, -2.5, Math.PI / 2],
  ];
  for (const [sx, sz, ry] of sandbagCoords) {
    const sbGrp = new THREE.Group();
    sbGrp.position.set(sx, 0, sz);
    sbGrp.rotation.y = ry;
    // Instant fallback silhouette until sandbag_bunker.glb swaps in (~10ms)
    const fallbackBox = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.05, 0.92), sandbagMat);
    fallbackBox.position.y = 0.52;
    fallbackBox.castShadow = !isSoftwareGl;
    fallbackBox.receiveShadow = true;
    sbGrp.add(fallbackBox);
    scene.add(sbGrp);
    sandbagAnchors.push(sbGrp);

    // Rotated ballistic hit proxy & exact collider matching sandbag_bunker.glb (tankCrushable!)
    const sbHitProxy = new THREE.Mesh(
      new THREE.BoxGeometry(3.25, 1.15, 0.96),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    sbHitProxy.position.set(sx, 0.58, sz);
    sbHitProxy.rotation.y = ry;
    sbHitProxy.userData = { isWorld: true, surface: 'concrete' };
    scene.add(sbHitProxy);
    worldHitMeshes.push(sbHitProxy);
    addRotatedHullColliders(sx, sz, 3.25, 0.96, ry, 1.22, sbGrp, 'x', true);
  }

  // H) Sculpted Wrecked Korean 4-Door Sedans (Curb-Positioned + Tank-Crushable!)
  const sedanDefs: Array<[number, number, number, number]> = [
    [8.6, 11.2, -0.34, 0x9ca7b4],
    [-8.6, 23.2, 0.42, 0x607086],
    [18.5, -14.5, 1.24, 0x8e3a34],
  ];
  for (const [vx, vz, ry, paintHex] of sedanDefs) {
    const car = new THREE.Group();
    car.position.set(vx, 0, vz);
    car.rotation.y = ry;
    const fallbackBody = new THREE.Mesh(
      new THREE.BoxGeometry(1.88, 1.28, 4.35),
      new THREE.MeshStandardMaterial({ color: paintHex, roughness: 0.58, metalness: 0.48 })
    );
    fallbackBody.position.y = 0.72;
    car.add(fallbackBody);
    scene.add(car);
    sedanAnchors.push({ anchor: car, color: paintHex });

    const carHitProxy = new THREE.Mesh(
      new THREE.BoxGeometry(1.88, 1.44, 4.36),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    carHitProxy.position.set(vx, 0.72, vz);
    carHitProxy.rotation.y = ry;
    carHitProxy.userData = { isWorld: true, surface: 'metal' };
    scene.add(carHitProxy);
    worldHitMeshes.push(carHitProxy);
    addRotatedHullColliders(vx, vz, 4.36, 1.88, ry, 1.5, car, 'z', true);
  }

  // I) 3 Burning ROK K-808 8x8 Armored Personnel Carriers (Flanking 13m+ Wide Northern Boulevard!)
  const k808Coords: Array<[number, number, number]> = [
    [-10.4, -16.8, 0.42],
    [10.6, -18.2, -0.65],
    [-28.8, -19.8, 1.15],
  ];
  for (const [kx, kz, ry] of k808Coords) {
    const anchor = new THREE.Group();
    anchor.position.set(kx, 0, kz);
    anchor.rotation.y = ry;
    const fallback = buildRuinedVehicleWreck(matCache.armorPlate, matCache.darkIron, matCache.rustMetal);
    anchor.add(fallback);
    scene.add(anchor);
    k808Anchors.push(anchor);

    addRotatedHullColliders(kx, kz, 7.35, 2.95, ry, 2.8, anchor, 'x');
    const apcHitProxy = new THREE.Mesh(
      new THREE.BoxGeometry(7.35, 2.55, 3.0),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    apcHitProxy.position.set(kx, 1.28, kz);
    apcHitProxy.rotation.y = ry;
    apcHitProxy.userData = { isWorld: true, surface: 'metal' };
    scene.add(apcHitProxy);
    worldHitMeshes.push(apcHitProxy);

    // Calibrated r187 physical engine-fire light illuminating wet asphalt & smoke plumes
    const apcFireLight = new THREE.PointLight(0xff621a, 18.0, 20, 1.4);
    apcFireLight.position.set(kx, 2.4, kz);
    scene.add(apcFireLight);
    fireLights.push({ light: apcFireLight, phase: kx * 0.7 + kz * 0.3 });

    smokePlumes.push({ x: kx, y: 2.3, z: kz, kind: 'oil_fire' });
  }

  // J) Ground Steam Curtains drifting across Neo-Seoul storm drains & burning cars (CoD Landing Atmosphere!)
  smokePlumes.push(
    { x: 0, y: 0.4, z: 10, kind: 'steam' },
    { x: 6.8, y: 0.9, z: 11.2, kind: 'oil_fire' },
    { x: -12, y: 0.4, z: -4, kind: 'steam' },
    { x: 12, y: 0.4, z: -4, kind: 'steam' },
    { x: 0, y: 0.5, z: -22, kind: 'steam' }
  );

  // K) Mission 01 Setpiece — ROK Navy LCAC-655 Assault Hovercraft ("대한민국해군 655" — solid colliders & shadows!)
  const lcacHovercraft = buildRokNavyLcacHovercraft();
  lcacHovercraft.group.position.set(0, 0, 44.5);
  lcacHovercraft.group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = !isSoftwareGl;
      obj.receiveShadow = true;
      obj.userData = { isWorld: true, surface: 'metal' };
      worldHitMeshes.push(obj);
    }
  });
  scene.add(lcacHovercraft.group);
  // Solid port & starboard hull bulwark colliders when grounded at z = 41.5
  for (const sideX of [-4.15, 4.15]) {
    const lc: WorldColliderLike = {
      minX: sideX - 0.9,
      maxX: sideX + 0.9,
      minZ: 34.4,
      maxZ: 48.6,
      height: 5.5,
      mesh: lcacHovercraft.group,
      destructible: false,
      hp: 99999,
      alive: true,
    };
    colliders.push(lc);
    lcacColliders.push(lc);
  }
  const lcacSternCol: WorldColliderLike = {
    minX: -4.5,
    maxX: 4.5,
    minZ: 46.2,
    maxZ: 49.4,
    height: 6.2,
    mesh: lcacHovercraft.group,
    destructible: false,
    hp: 99999,
    alive: true,
  };
  colliders.push(lcacSternCol);
  lcacColliders.push(lcacSternCol);
  for (const fan of lcacHovercraft.fans) {
    spinningFans.push(fan);
  }
  smokePlumes.push(
    { x: -4.2, y: 0.6, z: 42, kind: 'steam' },
    { x: 4.2, y: 0.6, z: 42, kind: 'steam' }
  );

  // L) Mission 02 Setpiece — Euljiro Command Post C4 Breachable Steel Blast Door (Full Bunker Colliders & LOS!)
  const breachGroup = new THREE.Group();
  breachGroup.position.set(12.6, 0, 4.5);
  const doorFrameMat = matCache.darkIron;
  const doorLeafMat = new THREE.MeshStandardMaterial({
    color: 0x3b424d,
    map: pbr.gunmetal.map,
    normalMap: pbr.gunmetal.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.58,
    metalness: 0.72,
    envMapIntensity: 0.5,
  });
  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.55, 3.6), doorFrameMat);
  frameTop.position.set(0, 3.15, 0);
  frameTop.castShadow = !isSoftwareGl;
  frameTop.userData = { isWorld: true, surface: 'metal' };
  breachGroup.add(frameTop);
  worldHitMeshes.push(frameTop);
  for (const fz of [-1.72, 1.72]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.65, 3.4, 0.34), doorFrameMat);
    post.position.set(0, 1.7, fz);
    post.castShadow = !isSoftwareGl;
    post.receiveShadow = true;
    post.userData = { isWorld: true, surface: 'metal' };
    breachGroup.add(post);
    worldHitMeshes.push(post);
  }
  // Front wall wings flanking the steel blast door (so you MUST breach the door to enter!)
  for (const wz of [-2.95, 2.95]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.52, 3.6, 2.2), weatheredConcreteMat);
    wing.position.set(0, 1.8, wz);
    wing.castShadow = !isSoftwareGl;
    wing.receiveShadow = true;
    wing.userData = { isWorld: true, surface: 'concrete' };
    breachGroup.add(wing);
    worldHitMeshes.push(wing);
    colliders.push({
      minX: 12.6 - 0.32,
      maxX: 12.6 + 0.32,
      minZ: 4.5 + wz - 1.15,
      maxZ: 4.5 + wz + 1.15,
      height: 3.7,
      mesh: wing,
      destructible: false,
      hp: 9999,
      alive: true,
    });
  }
  // Enclosed rear & side concrete bunker walls behind the breach door (solid colliders + castShadow!)
  const roomBack = new THREE.Mesh(new THREE.BoxGeometry(0.45, 3.6, 8.2), weatheredConcreteMat);
  roomBack.position.set(8.4, 1.8, 0);
  roomBack.castShadow = !isSoftwareGl;
  roomBack.receiveShadow = true;
  roomBack.userData = { isWorld: true, surface: 'concrete' };
  breachGroup.add(roomBack);
  worldHitMeshes.push(roomBack);
  colliders.push({
    minX: 12.6 + 8.12,
    maxX: 12.6 + 8.68,
    minZ: 4.5 - 4.15,
    maxZ: 4.5 + 4.15,
    height: 3.7,
    mesh: roomBack,
    destructible: false,
    hp: 9999,
    alive: true,
  });
  for (const sideZ of [-4.0, 4.0]) {
    const sideW = new THREE.Mesh(new THREE.BoxGeometry(8.6, 3.6, 0.42), weatheredConcreteMat);
    sideW.position.set(4.2, 1.8, sideZ);
    sideW.castShadow = !isSoftwareGl;
    sideW.receiveShadow = true;
    sideW.userData = { isWorld: true, surface: 'concrete' };
    breachGroup.add(sideW);
    worldHitMeshes.push(sideW);
    colliders.push({
      minX: 12.6 - 0.15,
      maxX: 12.6 + 8.55,
      minZ: 4.5 + sideZ - 0.25,
      maxZ: 4.5 + sideZ + 0.25,
      height: 3.7,
      mesh: sideW,
      destructible: false,
      hp: 9999,
      alive: true,
    });
  }
  const roomRoof = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.38, 8.4), seoulConcreteMat);
  roomRoof.position.set(4.2, 3.7, 0);
  roomRoof.castShadow = !isSoftwareGl;
  roomRoof.receiveShadow = true;
  roomRoof.userData = { isWorld: true, surface: 'concrete' };
  breachGroup.add(roomRoof);
  worldHitMeshes.push(roomRoof);

  const leftLeaf = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.88, 1.48), doorLeafMat);
  leftLeaf.position.set(0, 1.44, -0.76);
  leftLeaf.castShadow = !isSoftwareGl;
  leftLeaf.receiveShadow = true;
  leftLeaf.userData = { isWorld: true, surface: 'metal' };
  breachGroup.add(leftLeaf);
  worldHitMeshes.push(leftLeaf);

  const rightLeaf = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.88, 1.48), doorLeafMat);
  rightLeaf.position.set(0, 1.44, 0.76);
  rightLeaf.castShadow = !isSoftwareGl;
  rightLeaf.receiveShadow = true;
  rightLeaf.userData = { isWorld: true, surface: 'metal' };
  breachGroup.add(rightLeaf);
  worldHitMeshes.push(rightLeaf);

  const doorCollider: WorldColliderLike = {
    minX: 12.6 - 0.3,
    maxX: 12.6 + 0.3,
    minZ: 4.5 - 1.65,
    maxZ: 4.5 + 1.65,
    height: 3.1,
    mesh: leftLeaf,
    destructible: false,
    hp: 9999,
    alive: true,
  };
  colliders.push(doorCollider);

  const c4Pack = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.24, 0.34),
    new THREE.MeshBasicMaterial({ color: 0xff3b3b })
  );
  c4Pack.position.set(-0.2, 1.38, 0);
  c4Pack.visible = false;
  breachGroup.add(c4Pack);

  const breachLight = new THREE.PointLight(0xff4422, 0, 14, 1.4);
  breachLight.position.set(-0.8, 2.6, 0);
  breachGroup.add(breachLight);
  scene.add(breachGroup);
  indoorZones.push({ minX: 12.6, maxX: 21.0, minZ: 0.5, maxZ: 8.5, maxY: 3.9 });

  const euljiroBreachDoor: BreachDoorSetpiece = {
    x: 12.6,
    z: 4.5,
    group: breachGroup,
    leftLeaf,
    rightLeaf,
    c4Pack,
    breachLight,
    doorCollider,
    breached: false,
  };

  // M) Mission 04 Setpiece — OMNI-CORE Exterior Assault Lift & Jammed Citadel Blast Door (x = 0, z = -19.5)
  const liftGroup = new THREE.Group();
  liftGroup.position.set(0, 0, -19.5);
  liftGroup.visible = false;
  const liftFloor = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.24, 4.0), matCache.darkIron);
  liftFloor.position.set(0, 0.12, 0);
  liftGroup.add(liftFloor);
  const liftRoof = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.22, 4.0), matCache.darkIron);
  liftRoof.position.set(0, 3.25, 0);
  liftGroup.add(liftRoof);
  for (const lx of [-2.22, 2.22]) {
    for (const lz of [-1.92, 1.92]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.2, 0.18), matCache.armorPlate);
      col.position.set(lx, 1.65, lz);
      liftGroup.add(col);
    }
    const sideRail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.15, 3.8), matCache.darkIron);
    sideRail.position.set(lx, 0.85, 0);
    liftGroup.add(sideRail);
  }
  const elevLeftDoor = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.9, 0.22), doorLeafMat);
  elevLeftDoor.position.set(-1.08, 1.6, -1.92);
  liftGroup.add(elevLeftDoor);
  const elevRightDoor = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.9, 0.22), doorLeafMat);
  elevRightDoor.position.set(1.08, 1.6, -1.92);
  liftGroup.add(elevRightDoor);
  const cabinLight = new THREE.PointLight(0xff4422, 10.0, 12, 1.4);
  cabinLight.position.set(0, 2.9, 0);
  liftGroup.add(cabinLight);
  scene.add(liftGroup);

  const towerElevator: TowerElevatorSetpiece = {
    x: 0,
    z: -19.5,
    group: liftGroup,
    leftDoor: elevLeftDoor,
    rightDoor: elevRightDoor,
    cabinLight,
  };

  return {
    citadel,
    relays,
    turrets,
    skyTraffic,
    holoBillboards,
    dawnGodRays,
    rescueShuttle,
    lcacHovercraft,
    lcacColliders,
    vaultGate,
    vaultGateCollider,
    sandboxWayfindingGroup,
    euljiroBreachDoor,
    towerElevator,
    minimapWalls,
    spinningFans,
    searchlights,
    fireLights,
    conduitMaterials,
    skyDomeMat,
    shieldDomeMat,
    groundMist,
    walkableSurfaces,
    indoorZones,
    smokePlumes,
    k808Anchors,
    sedanAnchors,
    sandbagAnchors,
  };
}
