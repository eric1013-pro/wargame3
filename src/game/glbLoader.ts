import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EnemyRig, ViewmodelRig } from './models';
import { ExtendedPbrLibrary } from './pbrMaterials';
import { ProceduralTextureSet } from './textures';
import { BodyPart, Faction, UnitArchetype } from './types';

export const GLB_ASSET_URLS = {
  m41x: './src/assets/models/m41x_rifle.glb',
  doom99: './src/assets/models/doom99_shotgun.glb',
  railx9: './src/assets/models/railx9_sniper.glb',
  hydra7: './src/assets/models/hydra7_rocket.glb',
  zeusmk7: './src/assets/models/zeusmk7_tesla.glb',
  k808Apc: './src/assets/models/k808_apc.glb',
  koreanSedan: './src/assets/models/korean_sedan.glb',
  sandbagBunker: './src/assets/models/sandbag_bunker.glb',
  k2Tank: './src/assets/models/k2_black_panther.glb',
  uh60Gunship: './src/assets/models/uh60_gunship.glb',
  enemyTrooper: './src/assets/models/enemy_trooper.glb',
  enemyMech: './src/assets/models/enemy_mech.glb',
  enemyDrone: './src/assets/models/enemy_drone.glb',
} as const;

/**
 * Ensures every BufferGeometry in a loaded GLB has `uv1` (Three.js r151+ AO channel)
 * so `aoMap` renders crisp physical crevice Ambient Occlusion cleanly.
 */
function ensureAoUv1(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.geometry) {
      const geo = obj.geometry as THREE.BufferGeometry;
      if (geo.attributes.uv && !geo.attributes.uv1) {
        geo.setAttribute('uv1', geo.attributes.uv);
      }
    }
  });
}

function buildPbrMaterialMap(
  pbr: ExtendedPbrLibrary,
  textures: ProceduralTextureSet
): Record<string, THREE.Material> {
  return {
    rok_receiver: new THREE.MeshStandardMaterial({
      color: 0xd8dee6,
      map: pbr.rokReceiver.map,
      normalMap: pbr.rokReceiver.normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: pbr.rokReceiver.roughnessMap,
      roughness: 0.72,
      metalness: 0.74,
      aoMap: pbr.rokReceiver.aoMap,
      aoMapIntensity: 0.9,
      envMapIntensity: 0.65,
    }),
    gunmetal: new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      map: pbr.gunmetal.map,
      normalMap: pbr.gunmetal.normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: pbr.gunmetal.roughnessMap,
      roughness: 0.62,
      metalness: 0.72,
      aoMap: pbr.gunmetal.aoMap,
      aoMapIntensity: 0.85,
      envMapIntensity: 0.95,
    }),
    dark_steel: new THREE.MeshStandardMaterial({
      color: 0x3b4452,
      map: pbr.gunmetal.map,
      normalMap: pbr.gunmetal.normalMap,
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughnessMap: pbr.gunmetal.roughnessMap,
      roughness: 0.58,
      metalness: 0.66,
      envMapIntensity: 0.82,
    }),
    polymer: new THREE.MeshStandardMaterial({
      color: 0x9aa4b2,
      map: pbr.carbonArmor.map,
      normalMap: pbr.carbonArmor.normalMap,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughnessMap: pbr.carbonArmor.roughnessMap,
      aoMap: pbr.carbonArmor.aoMap,
      aoMapIntensity: 0.85,
      roughness: 0.72,
      metalness: 0.28,
      envMapIntensity: 0.65,
    }),
    chrome: new THREE.MeshStandardMaterial({
      color: 0xb2becb,
      roughness: 0.22,
      metalness: 0.92,
      envMapIntensity: 1.1,
    }),
    brass: new THREE.MeshStandardMaterial({
      color: 0xd8a844,
      roughness: 0.24,
      metalness: 0.9,
      envMapIntensity: 1.05,
    }),
    copper_tip: new THREE.MeshStandardMaterial({
      color: 0xc96832,
      roughness: 0.28,
      metalness: 0.88,
      envMapIntensity: 0.95,
    }),
    kevlar_glove: new THREE.MeshStandardMaterial({
      color: 0xc8d0d8,
      map: pbr.kevlarGlove.map,
      normalMap: pbr.kevlarGlove.normalMap,
      normalScale: new THREE.Vector2(1.05, 1.05),
      roughnessMap: pbr.kevlarGlove.roughnessMap,
      roughness: 0.92,
      metalness: 0.08,
      aoMap: pbr.kevlarGlove.aoMap,
      aoMapIntensity: 0.95,
      envMapIntensity: 0.42,
    }),
    knuckle_carbon: new THREE.MeshStandardMaterial({
      color: 0xbec8d6,
      map: pbr.carbonArmor.map,
      normalMap: pbr.carbonArmor.normalMap,
      normalScale: new THREE.Vector2(1.0, 1.0),
      roughnessMap: pbr.carbonArmor.roughnessMap,
      aoMap: pbr.carbonArmor.aoMap,
      aoMapIntensity: 0.9,
      roughness: 0.44,
      metalness: 0.56,
      envMapIntensity: 0.85,
    }),
    // Real photographic ROK Special Forces granite-digital camo fabric on player forearms!
    suit_sleeve: new THREE.MeshStandardMaterial({
      color: 0xc8d0cc,
      map: pbr.rokCamo.map,
      normalMap: pbr.rokCamo.normalMap,
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughnessMap: pbr.rokCamo.roughnessMap,
      roughness: 0.94,
      metalness: 0.04,
      aoMap: pbr.rokCamo.aoMap,
      aoMapIntensity: 0.85,
      envMapIntensity: 0.35,
    }),
    olive_launcher: new THREE.MeshStandardMaterial({
      color: 0x627057,
      map: pbr.gunmetal.map,
      normalMap: pbr.gunmetal.normalMap,
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughnessMap: pbr.gunmetal.roughnessMap,
      roughness: 0.8,
      metalness: 0.35,
      envMapIntensity: 0.45,
    }),
    shotgun_shell: new THREE.MeshStandardMaterial({
      color: 0x991e26,
      roughness: 0.55,
      metalness: 0.12,
      envMapIntensity: 0.45,
    }),
    optic_glass: new THREE.MeshBasicMaterial({
      color: 0xdff6ff,
      transparent: true,
      opacity: 0.022,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    scope_inner: new THREE.MeshStandardMaterial({
      color: 0x0a0d12,
      roughness: 0.78,
      metalness: 0.42,
      side: THREE.DoubleSide,
    }),
    cyan_accent: new THREE.MeshStandardMaterial({
      color: 0x22a6c7,
      emissive: 0x16809c,
      emissiveIntensity: 0.65,
      roughness: 0.35,
    }),
    crimson_accent: new THREE.MeshStandardMaterial({
      color: 0xb8243d,
      emissive: 0x801828,
      emissiveIntensity: 0.5,
      roughness: 0.4,
    }),
    k808_armor: new THREE.MeshStandardMaterial({
      color: 0x8b9682,
      map: pbr.gunmetal.map,
      normalMap: pbr.gunmetal.normalMap,
      normalScale: new THREE.Vector2(0.95, 0.95),
      roughnessMap: pbr.gunmetal.roughnessMap,
      roughness: 0.82,
      metalness: 0.42,
      aoMap: pbr.gunmetal.aoMap,
      aoMapIntensity: 0.9,
      envMapIntensity: 0.5,
    }),
    sedan_body: new THREE.MeshStandardMaterial({
      color: 0x9aa4b0,
      normalMap: pbr.gunmetal.normalMap,
      normalScale: new THREE.Vector2(0.32, 0.32),
      roughnessMap: pbr.gunmetal.roughnessMap,
      roughness: 0.42,
      metalness: 0.46,
      aoMap: pbr.gunmetal.aoMap,
      aoMapIntensity: 0.65,
      envMapIntensity: 0.96,
    }),
    sedan_glass: new THREE.MeshStandardMaterial({
      color: 0x1b2636,
      roughness: 0.14,
      metalness: 0.38,
      envMapIntensity: 1.05,
    }),
    sedan_trim: new THREE.MeshStandardMaterial({
      color: 0x222730,
      roughness: 0.82,
      metalness: 0.18,
      envMapIntensity: 0.45,
    }),
    sedan_headlight: new THREE.MeshStandardMaterial({
      color: 0xd4dde8,
      emissive: 0x93b2d4,
      emissiveIntensity: 0.25,
      roughness: 0.22,
      metalness: 0.2,
      envMapIntensity: 0.75,
    }),
    sedan_taillight: new THREE.MeshStandardMaterial({
      color: 0x8f1a22,
      emissive: 0x6b1116,
      emissiveIntensity: 0.52,
      roughness: 0.32,
    }),
    sandbag_burlap: new THREE.MeshStandardMaterial({
      color: 0xd8ceb8,
      map: pbr.sandbag.map,
      normalMap: pbr.sandbag.normalMap,
      normalScale: new THREE.Vector2(1.15, 1.15),
      roughnessMap: pbr.sandbag.roughnessMap,
      roughness: 0.92,
      metalness: 0.03,
      aoMap: pbr.sandbag.aoMap,
      aoMapIntensity: 0.85,
      envMapIntensity: 0.56,
    }),
    wood_stake: new THREE.MeshStandardMaterial({
      color: 0x453526,
      normalMap: pbr.sandbag.normalMap,
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughness: 0.94,
      metalness: 0.03,
      envMapIntensity: 0.25,
    }),
    earth_mound: new THREE.MeshStandardMaterial({
      color: 0x2c2824,
      map: pbr.seoulAsphalt.map,
      normalMap: pbr.seoulAsphalt.normalMap,
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughness: 0.96,
      metalness: 0.02,
      envMapIntensity: 0.22,
    }),
    tire_rubber: new THREE.MeshStandardMaterial({
      color: 0x16181c,
      normalMap: pbr.sandbag.normalMap,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.94,
      metalness: 0.04,
      envMapIntensity: 0.25,
    }),
    holo_reticle: new THREE.MeshBasicMaterial({
      map: textures.holoReticleMap,
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    sniper_reticle: new THREE.MeshBasicMaterial({
      map: textures.sniperReticleMap,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  };
}

function applyPbrMaterials(
  root: THREE.Object3D,
  matMap: Record<string, THREE.Material>,
  castShadow = false,
  colorTint?: number
): void {
  ensureAoUv1(root);
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      if (castShadow) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
      if (obj.name === 'HoloReticle') {
        obj.material = matMap.holo_reticle;
        return;
      }
      if (obj.name === 'SniperReticle') {
        obj.material = matMap.sniper_reticle;
        return;
      }
      const mName = (obj.material as THREE.Material | undefined)?.name;
      if (mName && matMap[mName]) {
        if (colorTint !== undefined && mName === 'sedan_body') {
          const cloned = (matMap[mName] as THREE.MeshStandardMaterial).clone();
          cloned.color.setHex(colorTint);
          obj.material = cloned;
        } else {
          obj.material = matMap[mName];
        }
      }
    }
  });
}

/**
 * Loads all 5 binary high-poly .glb weapons via GLTFLoader, upgrades them with photographic 4-channel PBR maps,
 * and seamlessly swaps them into the live ViewmodelRig while preserving all reload/animation nodes.
 */
export async function loadAndAttachGlbWeapons(
  viewmodel: ViewmodelRig,
  pbr: ExtendedPbrLibrary,
  textures: ProceduralTextureSet,
  isDisposed: () => boolean
): Promise<void> {
  const loader = new GLTFLoader();
  const matMap = buildPbrMaterialMap(pbr, textures);

  const loadSlot = async (url: string, slotIdx: number) => {
    try {
      const gltf = await loader.loadAsync(url);
      if (isDisposed()) return;

      const root = gltf.scene;
      applyPbrMaterials(root, matMap, false);

      const oldWeapon = viewmodel.weapons[slotIdx];
      const wasVisible = oldWeapon ? oldWeapon.visible : slotIdx === 0;
      if (oldWeapon && oldWeapon.parent === viewmodel.pivot) {
        viewmodel.pivot.remove(oldWeapon);
      }

      root.visible = wasVisible;
      viewmodel.pivot.add(root);
      viewmodel.weapons[slotIdx] = root;

      const mag = root.getObjectByName('Magazine') ?? null;
      if (mag) {
        viewmodel.magazines[slotIdx] = mag;
        viewmodel.magBasePos[slotIdx] = mag.position.clone();
        viewmodel.magBaseRot[slotIdx] = mag.rotation.clone();
      }

      const lHand = root.getObjectByName('LeftHand');
      if (lHand instanceof THREE.Group) {
        viewmodel.leftHands[slotIdx] = lHand;
        viewmodel.leftHandBasePos[slotIdx] = lHand.position.clone();
      }

      if (slotIdx === 0) {
        const ch = root.getObjectByName('ChargingHandle');
        if (ch) viewmodel.chargingHandle0 = ch;
      }
      if (slotIdx === 2) {
        const core = root.getObjectByName('RailPlasmaCore');
        if (core instanceof THREE.Mesh) viewmodel.railPlasmaCore = core;
      }
    } catch {
      // Fallback sculpted viewmodel remains seamlessly active if GLB fetch is unavailable
    }
  };

  await Promise.all([
    loadSlot(GLB_ASSET_URLS.m41x, 0),
    loadSlot(GLB_ASSET_URLS.doom99, 1),
    loadSlot(GLB_ASSET_URLS.railx9, 2),
    loadSlot(GLB_ASSET_URLS.hydra7, 3),
    loadSlot(GLB_ASSET_URLS.zeusmk7, 5),
  ]);
}

/**
 * Loads high-poly battlefield .glb props (K-808 8x8 APCs, Sculpted Korean 4-Door Sedans,
 * and Organic Staggered Burlap Sandbag Bunkers) and swaps them cleanly into their world anchors.
 */
export async function loadAndAttachBattlefieldGlbProps(
  anchors: {
    k808Apcs: THREE.Group[];
    sedans: Array<{ anchor: THREE.Group; color: number }>;
    sandbags: THREE.Group[];
  },
  pbr: ExtendedPbrLibrary,
  textures: ProceduralTextureSet,
  castShadow: boolean,
  isDisposed: () => boolean
): Promise<void> {
  const loader = new GLTFLoader();
  const matMap = buildPbrMaterialMap(pbr, textures);

  const attachToList = async (url: string, targets: THREE.Group[]) => {
    if (targets.length === 0) return;
    try {
      const gltf = await loader.loadAsync(url);
      if (isDisposed()) return;
      const template = gltf.scene;
      applyPbrMaterials(template, matMap, castShadow);
      for (const anchor of targets) {
        while (anchor.children.length > 0) {
          anchor.remove(anchor.children[0]);
        }
        anchor.add(template.clone(true));
      }
    } catch {
      // Fallback geometry stays active
    }
  };

  const attachSedans = async () => {
    if (anchors.sedans.length === 0) return;
    try {
      const gltf = await loader.loadAsync(GLB_ASSET_URLS.koreanSedan);
      if (isDisposed()) return;
      for (const entry of anchors.sedans) {
        const clone = gltf.scene.clone(true);
        applyPbrMaterials(clone, matMap, castShadow, entry.color);
        while (entry.anchor.children.length > 0) {
          entry.anchor.remove(entry.anchor.children[0]);
        }
        entry.anchor.add(clone);
      }
    } catch {
      // Keep fallback
    }
  };

  await Promise.all([
    attachToList(GLB_ASSET_URLS.k808Apc, anchors.k808Apcs),
    attachSedans(),
    attachToList(GLB_ASSET_URLS.sandbagBunker, anchors.sandbags),
  ]);
}

/** Legacy alias preserved for backwards compatibility */
export async function loadAndAttachK808ApcWrecks(
  anchors: THREE.Group[],
  pbr: ExtendedPbrLibrary,
  textures: ProceduralTextureSet,
  castShadow: boolean,
  isDisposed: () => boolean
): Promise<void> {
  await loadAndAttachBattlefieldGlbProps(
    { k808Apcs: anchors, sedans: [], sandbags: [] },
    pbr,
    textures,
    castShadow,
    isDisposed
  );
}

export interface K2TankGlbParts {
  root: THREE.Group;
  turretPivot: THREE.Object3D;
  barrelPivot: THREE.Object3D;
  muzzlePoint: THREE.Object3D;
}

export interface Uh60GunshipGlbParts {
  root: THREE.Group;
  mainRotor: THREE.Object3D;
  tailRotor: THREE.Object3D;
  doorMinigun: THREE.Object3D;
  minigunBarrels: THREE.Object3D;
}

/** Loads the drivable ROK K2-X Black Panther Main Battle Tank GLB with animated turret & 120mm gun pivots */
export async function loadK2BlackPantherGlb(
  pbr: ExtendedPbrLibrary,
  textures: ProceduralTextureSet,
  castShadow: boolean
): Promise<K2TankGlbParts | null> {
  const loader = new GLTFLoader();
  const matMap = buildPbrMaterialMap(pbr, textures);
  try {
    const gltf = await loader.loadAsync(GLB_ASSET_URLS.k2Tank);
    const root = gltf.scene;
    applyPbrMaterials(root, matMap, castShadow);
    const turretPivot = root.getObjectByName('TurretPivot') ?? new THREE.Group();
    const barrelPivot = root.getObjectByName('BarrelPivot') ?? new THREE.Group();
    const muzzlePoint = root.getObjectByName('MuzzlePoint') ?? new THREE.Object3D();
    return { root, turretPivot, barrelPivot, muzzlePoint };
  } catch {
    return null;
  }
}

/** Loads the playable ROK UH-60K / Surion Assault Helicopter Gunship GLB with rotors & door M134 minigun */
export async function loadUh60GunshipGlb(
  pbr: ExtendedPbrLibrary,
  textures: ProceduralTextureSet,
  castShadow: boolean
): Promise<Uh60GunshipGlbParts | null> {
  const loader = new GLTFLoader();
  const matMap = buildPbrMaterialMap(pbr, textures);
  try {
    const gltf = await loader.loadAsync(GLB_ASSET_URLS.uh60Gunship);
    const root = gltf.scene;
    applyPbrMaterials(root, matMap, castShadow);
    const mainRotor = root.getObjectByName('MainRotor') ?? new THREE.Group();
    const tailRotor = root.getObjectByName('TailRotor') ?? new THREE.Group();
    const doorMinigun = root.getObjectByName('DoorMinigun') ?? new THREE.Group();
    const minigunBarrels = root.getObjectByName('MinigunBarrels') ?? new THREE.Group();
    return { root, mainRotor, tailRotor, doorMinigun, minigunBarrels };
  } catch {
    return null;
  }
}

export interface EnemyGlbTemplates {
  trooper: THREE.Group | null;
  mech: THREE.Group | null;
  drone: THREE.Group | null;
}

/** Preloads all 3 articulated enemy character .glb templates once for instant 0ms spawning */
export async function preloadEnemyGlbTemplates(): Promise<EnemyGlbTemplates> {
  const loader = new GLTFLoader();
  const loadOne = async (url: string): Promise<THREE.Group | null> => {
    try {
      const gltf = await loader.loadAsync(url);
      ensureAoUv1(gltf.scene);
      return gltf.scene;
    } catch {
      return null;
    }
  };
  const [trooper, mech, drone] = await Promise.all([
    loadOne(GLB_ASSET_URLS.enemyTrooper),
    loadOne(GLB_ASSET_URLS.enemyMech),
    loadOne(GLB_ASSET_URLS.enemyDrone),
  ]);
  return { trooper, mech, drone };
}

/**
 * Instantiates a sculpted high-poly 2-bone articulated EnemyRig from preloaded binary .glb templates,
 * binding faction-authentic photographic PBR armor/camo/gunmetal maps, slim tactical visors, and
 * full body-part dismemberment/weakpoint hitboxes!
 */
export function buildEnemyGlbRig(
  templates: EnemyGlbTemplates,
  faction: Faction,
  archetype: UnitArchetype,
  scale: number,
  contactShadowTex: THREE.CanvasTexture,
  ownerRef: unknown,
  pbr: ExtendedPbrLibrary,
  castShadow: boolean
): EnemyRig | null {
  const isBoss = archetype === UnitArchetype.ROBOT_TITAN;
  const isDrone = archetype === UnitArchetype.ROBOT_STALKER;
  const isMech =
    isBoss ||
    archetype === UnitArchetype.ROBOT_ENFORCER ||
    archetype === UnitArchetype.SYNDICATE_HEAVY;

  const srcTemplate = isDrone ? templates.drone : isMech ? templates.mech : templates.trooper;
  if (!srcTemplate) return null;

  const root = new THREE.Group();
  const model = srcTemplate.clone(true);
  model.scale.setScalar(scale);

  // Distinct grounded military tactical palettes (real matte PBR camo/titanium — ZERO neon blocks!)
  const isRaider = faction === Faction.RAIDER;
  const isSyndicate = faction === Faction.SYNDICATE;

  const armorHex = isBoss
    ? 0x8f98a6
    : isRaider
      ? 0x9e8368 // Weathered desert/urban tan-olive tactical composite
      : isSyndicate
        ? 0x7a8aa3 // Obsidian-slate carbon special forces armor
        : 0x8d97a8; // OMNI brushed titanium warframe

  const fabricHex = isRaider ? 0x6f6556 : isSyndicate ? 0x3b4454 : 0x38404d;
  const plateHex = isBoss ? 0x8e3b42 : isRaider ? 0x7e6b58 : isSyndicate ? 0x5c6d85 : 0x764c54;
  const visorHex = isBoss ? 0xff3b4e : isRaider ? 0xe59a38 : isSyndicate ? 0x38bdf8 : 0xff4258;

  const charArmor = new THREE.MeshStandardMaterial({
    color: armorHex,
    map: isMech ? pbr.gunmetal.map : pbr.carbonArmor.map,
    normalMap: isMech ? pbr.gunmetal.normalMap : pbr.carbonArmor.normalMap,
    normalScale: new THREE.Vector2(0.95, 0.95),
    roughnessMap: isMech ? pbr.gunmetal.roughnessMap : pbr.carbonArmor.roughnessMap,
    aoMap: isMech ? pbr.gunmetal.aoMap : pbr.carbonArmor.aoMap,
    aoMapIntensity: 0.9,
    roughness: isMech ? 0.54 : 0.62,
    metalness: isMech ? 0.72 : 0.48,
    envMapIntensity: 1.05,
  });
  const charFabric = new THREE.MeshStandardMaterial({
    color: fabricHex,
    map: pbr.rokCamo.map,
    normalMap: pbr.rokCamo.normalMap,
    normalScale: new THREE.Vector2(0.95, 0.95),
    roughnessMap: pbr.rokCamo.roughnessMap,
    aoMap: pbr.rokCamo.aoMap,
    aoMapIntensity: 0.85,
    roughness: 0.92,
    metalness: 0.06,
    envMapIntensity: 0.52,
  });
  const charPlate = new THREE.MeshStandardMaterial({
    color: plateHex,
    map: pbr.carbonArmor.map,
    normalMap: pbr.carbonArmor.normalMap,
    normalScale: new THREE.Vector2(0.92, 0.92),
    roughnessMap: pbr.carbonArmor.roughnessMap,
    aoMap: pbr.carbonArmor.aoMap,
    aoMapIntensity: 0.9,
    roughness: 0.48,
    metalness: 0.68,
    envMapIntensity: 1.0,
  });
  const gunmetal = new THREE.MeshStandardMaterial({
    color: 0xc8d2de,
    map: pbr.gunmetal.map,
    normalMap: pbr.gunmetal.normalMap,
    roughnessMap: pbr.gunmetal.roughnessMap,
    aoMap: pbr.gunmetal.aoMap,
    aoMapIntensity: 0.85,
    roughness: 0.52,
    metalness: 0.78,
    envMapIntensity: 1.05,
  });
  const darkSteel = new THREE.MeshStandardMaterial({
    color: 0x2d3540,
    normalMap: pbr.gunmetal.normalMap,
    roughness: 0.56,
    metalness: 0.68,
    envMapIntensity: 0.88,
  });
  const chrome = new THREE.MeshStandardMaterial({
    color: 0xb6c2d0,
    roughness: 0.22,
    metalness: 0.92,
    envMapIntensity: 1.15,
  });
  const kevlar = new THREE.MeshStandardMaterial({
    color: 0x2a303a,
    normalMap: pbr.kevlarGlove.normalMap,
    roughness: 0.88,
    metalness: 0.1,
    envMapIntensity: 0.48,
  });
  // Photorealistic glossy recessed optical sensor glass (replaces bright cartoon neon plastic!)
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x0b1018,
    emissive: visorHex,
    emissiveIntensity: 1.05,
    roughness: 0.08,
    metalness: 0.42,
    envMapIntensity: 1.35,
  });

  const localMatMap: Record<string, THREE.Material> = {
    char_armor: charArmor,
    char_fabric: charFabric,
    char_plate: charPlate,
    char_visor: visorMat,
    gunmetal,
    dark_steel: darkSteel,
    chrome,
    kevlar_glove: kevlar,
  };

  model.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      if (castShadow) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
      const mName = (obj.material as THREE.Material | undefined)?.name;
      if (mName && localMatMap[mName]) {
        obj.material = localMatMap[mName];
      }
    }
  });

  // Extract articulated 2-bone skeletal pivots
  const torso = model.getObjectByName('TorsoPivot');
  const head = model.getObjectByName('HeadPivot');
  const leftArm = model.getObjectByName('LeftArmPivot');
  const rightArm = model.getObjectByName('RightArmPivot');
  const leftElbow = model.getObjectByName('LeftElbowPivot');
  const rightElbow = model.getObjectByName('RightElbowPivot');
  const leftLeg = model.getObjectByName('LeftLegPivot');
  const rightLeg = model.getObjectByName('RightLegPivot');
  const leftKnee = model.getObjectByName('LeftKneePivot');
  const rightKnee = model.getObjectByName('RightKneePivot');
  const armorFront = model.getObjectByName('ArmorFront');
  const armorLeft = model.getObjectByName('ArmorLeft');
  const armorRight = model.getObjectByName('ArmorRight');
  const core = model.getObjectByName('CoreWeakpoint');
  const gatlingBarrel = model.getObjectByName('GatlingPivot') ?? undefined;
  const sawBlade = model.getObjectByName('SawPivot') ?? undefined;

  // Hide boss-exclusive detachable shields/core on non-boss enforcers/heavies for cleaner silhouette!
  if (isMech && !isBoss) {
    if (armorFront) armorFront.visible = false;
    if (armorLeft) armorLeft.visible = false;
    if (armorRight) armorRight.visible = false;
    if (core) core.visible = false;
  }

  const parts: Partial<Record<BodyPart, THREE.Object3D>> = {};
  const tagBranch = (node: THREE.Object3D | undefined, part: BodyPart) => {
    if (!node) return;
    parts[part] = node;
    node.userData = { unit: ownerRef, part };
    node.traverse((c) => {
      c.userData = { unit: ownerRef, part };
    });
  };

  // Tag torso first, then overwrite specific limb/head/boss-shield branches so hitboxes are 100% accurate!
  tagBranch(torso, 'torso');
  tagBranch(head, 'head');
  tagBranch(leftArm, 'leftArm');
  tagBranch(rightArm, 'rightArm');
  tagBranch(leftLeg, 'leftLeg');
  tagBranch(rightLeg, 'rightLeg');
  if (isBoss) {
    tagBranch(core, 'core');
    tagBranch(armorFront, 'armorFront');
    tagBranch(armorLeft, 'armorLeft');
    tagBranch(armorRight, 'armorRight');
  }

  // Attach sniper targeting laser beam onto right rifle barrel if SYNDICATE_SNIPER
  let sniperLaser: THREE.Mesh | undefined;
  if (archetype === UnitArchetype.SYNDICATE_SNIPER && (rightElbow || rightArm)) {
    const laserGeo = new THREE.CylinderGeometry(0.013, 0.013, 1, 6, 1, true);
    laserGeo.rotateX(Math.PI / 2);
    laserGeo.translate(0, 0, 0.5);
    sniperLaser = new THREE.Mesh(
      laserGeo,
      new THREE.MeshBasicMaterial({
        color: 0xff1e42,
        transparent: true,
        opacity: 0.74,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    sniperLaser.position.set(-0.02, -0.26, 0.85);
    sniperLaser.visible = false;
    (rightElbow ?? rightArm)!.add(sniperLaser);
  }

  root.add(model);

  const contactShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.84 * scale, 16),
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      opacity: 0.54,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.025;
  root.add(contactShadow);

  return {
    root,
    parts,
    knees: { left: leftKnee, right: rightKnee },
    elbows: { left: leftElbow, right: rightElbow },
    mats: [charArmor, charFabric, charPlate, gunmetal],
    visorMat,
    gatlingBarrel,
    sawBlade,
    sniperLaser,
    contactShadow,
  };
}
