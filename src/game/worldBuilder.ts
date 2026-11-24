import * as THREE from 'three';
import { ARENA_HALF_SIZE } from './rules';
import { ProceduralTextureSet } from './textures';
import { buildRuinedVehicleWreck } from './models';

export interface WorldColliderLike {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
  mesh: THREE.Object3D;
  destructible: boolean;
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

export interface BuiltWorldRefs {
  citadel: OmniCoreCitadel;
  relays: RelayPylonEntity[];
  minimapWalls: MinimapWallRect[];
  spinningFans: THREE.Object3D[];
  searchlights: Array<{ pivot: THREE.Group; baseYaw: number; phase: number; speed: number }>;
  fireLights: Array<{ light: THREE.PointLight; phase: number }>;
  conduitMaterials: THREE.MeshBasicMaterial[];
  skyDomeMat: THREE.ShaderMaterial;
}

export interface WorldBuildContext {
  scene: THREE.Scene;
  textures: ProceduralTextureSet;
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
  const { scene, matCache, isSoftwareGl, colliders, worldHitMeshes } = ctx;

  const minimapWalls: MinimapWallRect[] = [];
  const spinningFans: THREE.Object3D[] = [];
  const searchlights: Array<{ pivot: THREE.Group; baseYaw: number; phase: number; speed: number }> = [];
  const fireLights: Array<{ light: THREE.PointLight; phase: number }> = [];
  const conduitMaterials: THREE.MeshBasicMaterial[] = [];

  const crimsonGlow = new THREE.MeshBasicMaterial({ color: 0xff1e42 });
  const cyanGlow = new THREE.MeshBasicMaterial({ color: 0x38e8ff });
  const amberGlow = new THREE.MeshBasicMaterial({ color: 0xff9d2e });
  const violetGlow = new THREE.MeshBasicMaterial({ color: 0x5ea3ff });
  conduitMaterials.push(crimsonGlow, cyanGlow, amberGlow, violetGlow);

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xb8c7da,
    roughness: 0.16,
    metalness: 0.96,
    envMapIntensity: 1.6,
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
  // 1) ATMOSPHERIC OBSIDIAN-DUSK SKY DOME (Deep Slate Zenith -> Volumetric Cloud Bands -> Ember Horizon)
  // =========================================================================
  const skyDomeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x05080f) },
      midColor: { value: new THREE.Color(0x0f1726) },
      horizonColor: { value: new THREE.Color(0x3f1b18) },
      glowColor: { value: new THREE.Color(0xb82b2e) },
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
      varying vec3 vWorldPos;
      void main() {
        vec3 dir = normalize(vWorldPos);
        float h = clamp(dir.y, 0.0, 1.0);
        vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.30, h));
        col = mix(col, topColor, smoothstep(0.28, 0.82, h));
        float northGlow = pow(max(0.0, -dir.z), 3.2) * (1.0 - smoothstep(0.0, 0.54, h));
        col += glowColor * northGlow * 0.72;
        float band = sin(dir.x * 11.0 + dir.z * 7.0) * sin(h * 18.0);
        col += vec3(0.06, 0.085, 0.13) * max(0.0, band) * (1.0 - h) * 0.45;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(215, 24, 16), skyDomeMat);
  scene.add(skyDome);

  // =========================================================================
  // 2) PHOTOREALISTIC WET CYBER-ASPHALT FLOOR + COLOR-CODED MAZE WAYFINDING CONDUITS
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

  const addFloorConduit = (
    x: number,
    z: number,
    w: number,
    len: number,
    rotY: number,
    mat: THREE.Material
  ) => {
    const channel = new THREE.Mesh(new THREE.BoxGeometry(w + 0.42, 0.04, len), matCache.darkIron);
    channel.position.set(x, 0.02, z);
    channel.rotation.y = rotY;
    scene.add(channel);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, len - 0.08), mat);
    strip.position.set(x, 0.032, z);
    strip.rotation.y = rotY;
    scene.add(strip);
  };

  // Central cyan neural guide-line running from South Vault-00 Spawn (+34) -> North OMNI-CORE (-26)
  addFloorConduit(0, 4, 0.24, 58, 0, cyanGlow);
  addFloorConduit(-1.55, 4, 0.12, 58, 0, crimsonGlow);
  addFloorConduit(1.55, 4, 0.12, 58, 0, crimsonGlow);

  // West Amber Guide Branch leading through the West Labyrinth to Relay ALPHA (-28, -8)
  addFloorConduit(-14, 15, 0.18, 28, Math.PI / 2, amberGlow);
  addFloorConduit(-28, 3, 0.18, 24, 0, amberGlow);

  // East Violet Guide Branch leading through the East Security Maze to Relay BETA (+28, -8)
  addFloorConduit(14, 15, 0.18, 28, Math.PI / 2, violetGlow);
  addFloorConduit(28, 3, 0.18, 24, 0, violetGlow);

  // =========================================================================
  // 3) SOUTH VAULT-00 CRYO-BUNKER BLAST GATE (Behind Player Spawn z = +41)
  // =========================================================================
  const vaultGate = new THREE.Group();
  vaultGate.position.set(0, 0, 40.5);
  const gateFrame = new THREE.Mesh(new THREE.BoxGeometry(10.5, 7.6, 2.2), matCache.armorPlate);
  gateFrame.position.y = 3.8;
  vaultGate.add(gateFrame);
  const blastWheel = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.36, 10, 20), matCache.rustMetal);
  blastWheel.position.set(0, 3.2, -1.2);
  vaultGate.add(blastWheel);
  const vaultSign = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.45, 0.25), amberGlow);
  vaultSign.position.set(0, 6.7, -1.25);
  vaultGate.add(vaultSign);
  scene.add(vaultGate);

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

  // Soft additive atmospheric bloom halos anchoring the Citadel silhouette in 3D haze
  const citadelCoreHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: crimsonHaloTex,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  citadelCoreHalo.position.set(0, 11.2, 5.2);
  citadelCoreHalo.scale.set(17, 17, 1);
  citadelGroup.add(citadelCoreHalo);

  const citadelTopHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: cyanHaloTex,
      transparent: true,
      opacity: 0.46,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  citadelTopHalo.position.set(0, 27.5, 0);
  citadelTopHalo.scale.set(22, 16, 1);
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
    new THREE.CylinderGeometry(0.82, 1.45, 68, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xff1e42,
      transparent: true,
      opacity: 0.48,
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

  const shieldDome = new THREE.Mesh(
    new THREE.SphereGeometry(10.8, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
    new THREE.MeshBasicMaterial({
      color: 0xff1e42,
      transparent: true,
      opacity: 0.17,
      wireframe: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
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
  citadelGroup.add(terminalPedestal);

  const terminalScreen = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 1.15, 0.14),
    new THREE.MeshBasicMaterial({ color: 0xff2244 })
  );
  terminalScreen.position.set(0, 1.85, terminalZLocal + 0.68);
  terminalScreen.rotation.x = -0.22;
  citadelGroup.add(terminalScreen);
  emissiveMeshes.push(terminalScreen);

  const terminalLight = new THREE.PointLight(0xff2244, 3.6, 26);
  terminalLight.position.set(coreX, 3.6, coreZ + terminalZLocal + 1.4);
  scene.add(terminalLight);

  scene.add(citadelGroup);
  worldHitMeshes.push(basePlinth, tier1, tier2, coreWeakpoint, coreWeakpointHitMesh);

  colliders.push({
    minX: coreX - 7.4,
    maxX: coreX + 7.4,
    minZ: coreZ - 7.4,
    maxZ: coreZ + 7.4,
    height: 36,
    mesh: citadelGroup,
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
        opacity: 0.68,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    relayHalo.position.y = 5.6;
    relayHalo.scale.set(7.5, 7.5, 1);
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
      new THREE.CylinderGeometry(0.18, 0.24, beamLen, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xff1e42,
        transparent: true,
        opacity: 0.78,
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
    };
    hitMesh.userData = { isWorld: true, relay: relayEntity };
    coreCrystal.userData = { isWorld: true, relay: relayEntity };
    worldHitMeshes.push(hitMesh, coreCrystal);

    colliders.push({
      minX: spec.x - 1.9,
      maxX: spec.x + 1.9,
      minZ: spec.z - 1.9,
      maxZ: spec.z + 1.9,
      height: 7.0,
      mesh: rGroup,
      destructible: false,
      hp: 9999,
      alive: true,
    });
    relays.push(relayEntity);
  }

  // =========================================================================
  // 6) LABYRINTHINE CYBERPUNK SERVER MAZE WALLS (High-Craft Sculpted Server Bulkheads!)
  //    Every wall features PBR titanium server rack panels, beveled steel plinths,
  //    vertical exo-pillars, overhanging roof cap, overhead conduits & neon corridor strips!
  //    Corridors are strictly >= 6.5m wide with verified loops & flanking alleys!
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

    // Armored beveled base plinth
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.55, 0.9, d + 0.55), matCache.armorPlate);
    plinth.position.y = 0.45;
    plinth.receiveShadow = true;
    grp.add(plinth);

    // Main server-rack PBR wall core
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matCache.concrete);
    wall.position.y = h / 2;
    wall.castShadow = !isSoftwareGl;
    wall.receiveShadow = true;
    grp.add(wall);

    // Overhanging heavy steel cap cornice
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.65, 0.52, d + 0.65), matCache.darkIron);
    cap.position.y = h + 0.25;
    grp.add(cap);

    // Corner structural steel I-beams
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.45, h + 0.6, 0.45), matCache.darkIron);
        post.position.set(sx * (w / 2 + 0.08), (h + 0.6) / 2, sz * (d / 2 + 0.08));
        grp.add(post);
      }
    }

    // Dual-height neon cyberpunk corridor telemetry light strips
    const stripTop = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, 0.14, d + 0.14), glowMat);
    stripTop.position.y = h - 0.55;
    grp.add(stripTop);
    const stripMid = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.08, d + 0.12), glowMat);
    stripMid.position.y = 1.65;
    grp.add(stripMid);

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
    g.add(beam);

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
      hp: 9999,
      alive: true,
    });
  };

  // Balanced chest-high cover barricades across all 3 tactical lanes
  addSlopedBarricade(-6.2, 16, 4.0, -0.14);
  addSlopedBarricade(6.2, 16, 4.0, 0.14);
  addSlopedBarricade(-5.2, 3.5, 3.6, 0.12);
  addSlopedBarricade(5.2, 3.5, 3.6, -0.12);
  addSlopedBarricade(-5.8, -15, 4.2, 0.18);
  addSlopedBarricade(5.8, -15, 4.2, -0.18);
  addSlopedBarricade(-21, -2, 4.2, Math.PI / 2);
  addSlopedBarricade(21, -2, 4.2, Math.PI / 2);

  // =========================================================================
  // 9) OUTER FORTRESS PERIMETER + BURNING CYBERPUNK MEGACITY SKYLINE RING
  // =========================================================================
  const perimSpan = ARENA_HALF_SIZE * 2;
  const perimDefs: Array<[number, number, number, number, number]> = [
    [0, -ARENA_HALF_SIZE, perimSpan, 7.2, 2.4],
    [0, ARENA_HALF_SIZE, perimSpan, 7.2, 2.4],
    [-ARENA_HALF_SIZE, 0, 2.4, 7.2, perimSpan],
    [ARENA_HALF_SIZE, 0, 2.4, 7.2, perimSpan],
  ];
  for (const [px, pz, pw, ph, pd] of perimDefs) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pd), matCache.concrete);
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

  const skyTowerMat = new THREE.MeshStandardMaterial({
    color: 0x0c0f18,
    roughness: 0.8,
    metalness: 0.4,
  });
  for (let i = 0; i < 36; i++) {
    const ang = (i / 36) * Math.PI * 2;
    const dist = ARENA_HALF_SIZE + 18 + (i % 4) * 12;
    const bh = 34 + ((i * 23) % 60);
    const bw = 11 + ((i * 7) % 13);
    const bx = Math.cos(ang) * dist;
    const bz = Math.sin(ang) * dist;

    const tower = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bw), skyTowerMat);
    tower.position.set(bx, bh / 2, bz);
    scene.add(tower);
    const crown = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.62, bh * 0.22, bw * 0.62), skyTowerMat);
    crown.position.set(bx, bh + bh * 0.1, bz);
    scene.add(crown);

    if (i % 3 === 0) {
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.38, 14, 6), matCache.darkIron);
      spire.position.set(bx, bh + bh * 0.21 + 7, bz);
      scene.add(spire);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.7, 6, 6), crimsonGlow);
      beacon.position.set(bx, bh + bh * 0.21 + 14.2, bz);
      scene.add(beacon);
    }
    if (i % 2 === 0) {
      const winBand = new THREE.Mesh(
        new THREE.BoxGeometry(bw * 0.56, 0.9, 0.5),
        i % 4 === 0 ? cyanGlow : amberGlow
      );
      winBand.position.set(
        Math.cos(ang) * (dist - bw * 0.53),
        bh * (0.45 + ((i * 11) % 35) / 100),
        Math.sin(ang) * (dist - bw * 0.53)
      );
      winBand.lookAt(0, winBand.position.y, 0);
      scene.add(winBand);
    }
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
  // 10) ARMORED APC WRECKS, DESTRUCTIBLE SUPPLY CRATES, PLASMA BARRELS & INSTANCED RUBBLE
  // =========================================================================
  const wreckCoords: Array<[number, number, number]> = [
    [-33, -34, 0.55],
    [33, -34, -0.55],
  ];
  for (const [wx, wz, rotY] of wreckCoords) {
    const wreck = buildRuinedVehicleWreck(matCache.armorPlate, matCache.darkIron, matCache.rustMetal);
    wreck.position.set(wx, 0, wz);
    wreck.rotation.y = rotY;
    scene.add(wreck);
    colliders.push({
      minX: wx - 3.5,
      maxX: wx + 3.5,
      minZ: wz - 2.2,
      maxZ: wz + 2.2,
      height: 3.0,
      mesh: wreck,
      destructible: false,
      hp: 9999,
      alive: true,
    });
  }

  const crates: Array<[number, number]> = [
    [-9.4, 21],
    [9.4, 21],
    [-7.2, -5],
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
      hp: 45,
      alive: true,
    };
    mesh.userData = { isWorld: true, collider: col };
    colliders.push(col);
  }

  // Explosive Plasma Fuel Barrels tucked near maze corners & Relay Chambers for chain-reaction kills!
  const barrels: Array<[number, number]> = [
    [-5.2, 8],
    [5.2, 8],
    [-5.5, -2],
    [5.5, -2],
    [-24, -8],
    [24, -8],
    [-31, -4],
    [31, -4],
    [-16, 16],
    [16, 16],
    [-16, -22],
    [16, -22],
    [-7, -23],
    [7, -23],
  ];
  for (const [bx, bz] of barrels) ctx.addExplosiveBarrel(bx, bz);

  // Instanced Scattered Industrial Rubble Chunks (zero extra draw calls)
  const rubbleCount = 68;
  const rubbleGeo = new THREE.DodecahedronGeometry(0.42, 0);
  const rubbleInst = new THREE.InstancedMesh(rubbleGeo, matCache.darkIron, rubbleCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < rubbleCount; i++) {
    const ang = (i / rubbleCount) * Math.PI * 2 + (i % 5) * 0.17;
    const rad = 10 + ((i * 19) % 30);
    const rx = Math.cos(ang) * rad;
    const rz = Math.sin(ang) * rad;
    dummy.position.set(Math.abs(rx) < 3.6 ? rx + (rx >= 0 ? 5.5 : -5.5) : rx, 0.16, rz);
    dummy.rotation.set(i * 0.7, i * 1.1, i * 0.4);
    dummy.scale.set(0.7 + (i % 4) * 0.3, 0.32 + (i % 3) * 0.18, 0.7 + ((i + 2) % 4) * 0.28);
    dummy.updateMatrix();
    rubbleInst.setMatrixAt(i, dummy.matrix);
  }
  rubbleInst.instanceMatrix.needsUpdate = true;
  rubbleInst.computeBoundingSphere();
  scene.add(rubbleInst);

  // 4 Atmospheric Sector Accent Point Lights (strictly within 4–6 unshadowed PointLight budget)
  const sectorLights: Array<[number, number, number]> = [
    [-28, -8, 0xff6b24], // West Rust-Borg Relay Chamber
    [28, -8, 0x5ea3ff],  // East Aegis-Net Relay Chamber
    [0, 18, 0x38bdf8],   // South Spawn Cyber Trench
    [0, -16, 0xff2244],  // North Citadel Kill-Zone
  ];
  for (let i = 0; i < sectorLights.length; i++) {
    const [lx, lz, col] = sectorLights[i];
    const fl = new THREE.PointLight(col, 3.2, 28);
    fl.position.set(lx, 3.4, lz);
    scene.add(fl);
    fireLights.push({ light: fl, phase: i * 1.7 });
  }

  return {
    citadel,
    relays,
    minimapWalls,
    spinningFans,
    searchlights,
    fireLights,
    conduitMaterials,
    skyDomeMat,
  };
}
