import * as THREE from 'three';
import { BodyPart, Faction, UnitArchetype } from './types';
import { FACTION_META } from './rules';
import { ProceduralTextureSet } from './textures';
import { ExtendedPbrLibrary } from './pbrMaterials';

export interface ViewmodelRig {
  pivot: THREE.Group;
  weapons: THREE.Group[];
  magazines: Array<THREE.Object3D | null>;
  magBasePos: THREE.Vector3[];
  magBaseRot: THREE.Euler[];
  leftHands: THREE.Group[];
  leftHandBasePos: THREE.Vector3[];
  chargingHandle0: THREE.Object3D;
  railPlasmaCore: THREE.Mesh;
  flamerPilot: THREE.Mesh;
  teslaCoilRotor: THREE.Group;
  teslaArcCore: THREE.Mesh;
  muzzleFlash: THREE.Mesh;
  blade: THREE.Group;
}

/**
 * Helper to create a beveled 2D profile extruded along Z (centered on Z) for sculpted gun receivers & armor plates.
 */
function makeBeveledExtrude(
  points: Array<[number, number]>,
  depth: number,
  bevelSize = 0.008,
  bevelThickness = 0.008
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  points.forEach(([x, y], idx) => {
    if (idx === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSize,
    bevelThickness,
    bevelSegments: 2,
    steps: 1,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

/**
 * Builds articulated 5-finger tactical Kevlar gloved hands gripping the weapon (CoD MWIII silhouette).
 */
function addExoHands(
  parent: THREE.Group,
  suitArmor: THREE.Material,
  suitSleeve: THREE.Material,
  gloveMat: THREE.Material,
  accentMat: THREE.Material,
  rightHandPos: [number, number, number],
  leftHandPos: [number, number, number]
): THREE.Group {
  const buildFingers = (grp: THREE.Group, isRight: boolean) => {
    for (let i = 0; i < 4; i++) {
      const fx = -0.026 + i * 0.0175;
      const isTrigger = isRight && i === 0;
      const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.0078, 0.032, 5, 8), gloveMat);
      f.position.set(fx, 0.004, -0.056);
      f.rotation.x = isTrigger ? Math.PI / 2 - 0.35 : Math.PI / 2 - 1.05;
      grp.add(f);
    }
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.032, 5, 8), gloveMat);
    thumb.position.set(isRight ? -0.036 : 0.036, 0.014, -0.022);
    thumb.rotation.set(Math.PI / 2 - 0.35, 0, isRight ? 0.45 : -0.45);
    grp.add(thumb);
  };

  // Right trigger hand + 5 articulated fingers + carbon knuckle armor + forearm
  const rGroup = new THREE.Group();
  rGroup.position.set(...rightHandPos);
  const rPalm = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.058, 0.082), gloveMat);
  rGroup.add(rPalm);
  const rKnuckle = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.02, 0.036), suitArmor);
  rKnuckle.position.set(0, 0.028, -0.024);
  rGroup.add(rKnuckle);
  buildFingers(rGroup, true);
  const rCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.05, 0.064, 12), suitArmor);
  rCuff.rotation.x = Math.PI / 2 + 0.22;
  rCuff.position.set(0.012, -0.02, 0.088);
  rGroup.add(rCuff);
  const rSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.064, 0.38, 12), suitSleeve);
  rSleeve.rotation.x = Math.PI / 2 + 0.26;
  rSleeve.rotation.z = -0.14;
  rSleeve.position.set(0.052, -0.09, 0.27);
  rGroup.add(rSleeve);
  parent.add(rGroup);

  // Left support hand cradling forend + 5 fingers + tactical chronograph watch
  const lGroup = new THREE.Group();
  lGroup.position.set(...leftHandPos);
  const lPalm = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.052, 0.086), gloveMat);
  lGroup.add(lPalm);
  const lGuard = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.018, 0.042), suitArmor);
  lGuard.position.set(-0.008, 0.024, -0.016);
  lGroup.add(lGuard);
  buildFingers(lGroup, false);
  const lForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.062, 0.42, 12), suitSleeve);
  lForearm.rotation.x = Math.PI / 2 + 0.22;
  lForearm.rotation.z = 0.4;
  lForearm.position.set(-0.135, -0.086, 0.22);
  lGroup.add(lForearm);
  const lWatch = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 12), suitArmor);
  lWatch.position.set(-0.048, 0.014, 0.078);
  lGroup.add(lWatch);
  const lVitalStrip = new THREE.Mesh(new THREE.CircleGeometry(0.014, 10), accentMat);
  lVitalStrip.rotation.x = -Math.PI / 2;
  lVitalStrip.position.set(-0.048, 0.021, 0.078);
  lGroup.add(lVitalStrip);
  parent.add(lGroup);
  return lGroup;
}

/**
 * Builds high-craft sculpted 1st-person weapon viewmodels with 4-channel PBR (Albedo+Normal+Roughness+AO).
 */
export function buildViewmodelRig(
  camera: THREE.Camera,
  textures?: ProceduralTextureSet,
  pbr?: ExtendedPbrLibrary
): ViewmodelRig {
  const pivot = new THREE.Group();
  camera.add(pivot);

  const gunmetal = new THREE.MeshStandardMaterial({
    color: pbr ? 0xffffff : 0x3b4250,
    map: pbr?.gunmetal.map,
    normalMap: pbr?.gunmetal.normalMap,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughnessMap: pbr?.gunmetal.roughnessMap,
    aoMap: pbr?.gunmetal.aoMap,
    bumpMap: pbr ? undefined : textures?.gunmetalBump,
    bumpScale: 0.012,
    roughness: pbr ? 0.56 : 0.28,
    metalness: 0.9,
  });
  const darkTitanium = new THREE.MeshStandardMaterial({
    color: pbr ? 0xffffff : 0x1c2029,
    map: pbr?.rokReceiver.map,
    normalMap: pbr?.rokReceiver.normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughnessMap: pbr?.rokReceiver.roughnessMap,
    aoMap: pbr?.rokReceiver.aoMap,
    bumpMap: pbr ? undefined : textures?.gunmetalBump,
    bumpScale: 0.01,
    roughness: pbr ? 0.62 : 0.38,
    metalness: 0.84,
  });
  const polymer = new THREE.MeshStandardMaterial({
    color: 0x15171d,
    normalMap: pbr?.kevlarGlove.normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: 0.82,
    metalness: 0.14,
  });
  const chrome = new THREE.MeshStandardMaterial({
    color: 0xb6c0d0,
    roughness: 0.14,
    metalness: 0.98,
  });
  const brass = new THREE.MeshStandardMaterial({
    color: 0xd4a442,
    roughness: 0.22,
    metalness: 0.94,
  });
  const hazardOrange = new THREE.MeshStandardMaterial({
    color: 0xd9531e,
    roughness: 0.42,
    metalness: 0.45,
  });
  const militaryOlive = new THREE.MeshStandardMaterial({
    color: pbr ? 0xffffff : 0x364334,
    map: pbr?.k808Armor.map,
    normalMap: pbr?.k808Armor.normalMap,
    roughnessMap: pbr?.k808Armor.roughnessMap,
    roughness: 0.72,
    metalness: 0.38,
  });
  const fuelRed = new THREE.MeshStandardMaterial({
    color: 0xb42318,
    roughness: 0.35,
    metalness: 0.62,
  });
  const walnut = new THREE.MeshStandardMaterial({
    color: 0x5c3018,
    roughness: 0.76,
    metalness: 0.08,
  });
  const suitArmor = new THREE.MeshStandardMaterial({
    color: 0x262c38,
    normalMap: pbr?.kevlarGlove.normalMap,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughness: 0.38,
    metalness: 0.72,
  });
  const suitSleeve = new THREE.MeshStandardMaterial({
    color: 0x1f242c,
    normalMap: pbr?.kevlarGlove.normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughness: 0.88,
    metalness: 0.1,
  });
  const gloveMat = new THREE.MeshStandardMaterial({
    color: pbr ? 0xffffff : 0x121318,
    map: pbr?.kevlarGlove.map,
    normalMap: pbr?.kevlarGlove.normalMap,
    normalScale: new THREE.Vector2(0.95, 0.95),
    roughnessMap: pbr?.kevlarGlove.roughnessMap,
    roughness: 0.92,
    metalness: 0.08,
  });
  const cyanGlow = new THREE.MeshBasicMaterial({ color: 0x22b8db });
  const amberGlow = new THREE.MeshBasicMaterial({ color: 0xd98726 });
  const emeraldGlow = new THREE.MeshBasicMaterial({ color: 0x24b885 });
  const crimsonGlow = new THREE.MeshBasicMaterial({ color: 0xd92b48 });
  // Truly crystal-clear optical glass (zero milky RoomEnvironment clearcoat glare — looks like real CoD EOTech!)
  const holoGlass = new THREE.MeshBasicMaterial({
    color: 0xdff6ff,
    transparent: true,
    opacity: 0.022,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const scopeInnerMat = new THREE.MeshStandardMaterial({
    color: 0x0b0e14,
    roughness: 0.72,
    metalness: 0.55,
    side: THREE.DoubleSide,
  });

  const weapons: THREE.Group[] = [];
  const magazines: Array<THREE.Object3D | null> = [];
  const magBasePos: THREE.Vector3[] = [];
  const magBaseRot: THREE.Euler[] = [];
  const leftHands: THREE.Group[] = [];
  const leftHandBasePos: THREE.Vector3[] = [];

  // =========================================================================
  // [1] M41-X PULSE ASSAULT RIFLE (Beveled body, Picatinny rail, holo-glass reticle, cooling vents, exo-hands)
  // =========================================================================
  const g0 = new THREE.Group();
  // Sculpted beveled side-profile receiver rotated along Z
  const rec0Geo = makeBeveledExtrude(
    [
      [-0.24, -0.055],
      [0.26, -0.055],
      [0.32, -0.018],
      [0.30, 0.058],
      [-0.20, 0.062],
      [-0.27, 0.025],
    ],
    0.086,
    0.01,
    0.01
  );
  rec0Geo.rotateY(Math.PI / 2);
  const rec0 = new THREE.Mesh(rec0Geo, darkTitanium);
  rec0.position.set(0, 0, -0.04);
  g0.add(rec0);

  // Brushed gunmetal upper receiver shroud
  const upper0 = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.042, 0.56), gunmetal);
  upper0.position.set(0, 0.054, -0.08);
  g0.add(upper0);

  // Milled Picatinny top rail teeth
  for (let i = 0; i < 11; i++) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.012, 0.022), darkTitanium);
    tooth.position.set(0, 0.08, 0.12 - i * 0.046);
    g0.add(tooth);
  }

  // Perforated angled handguard shroud
  const handguard0 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.046, 0.052, 0.34, 8),
    polymer
  );
  handguard0.rotation.x = Math.PI / 2;
  handguard0.position.set(0, 0.012, -0.42);
  g0.add(handguard0);

  // Chrome cooling ribs & underbarrel gas piston
  for (let i = 0; i < 4; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.098, 0.012, 0.032), chrome);
    rib.position.set(0, 0.022, -0.29 - i * 0.072);
    g0.add(rib);
  }
  const gasTube0 = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.42, 8), chrome);
  gasTube0.rotation.x = Math.PI / 2;
  gasTube0.position.set(0, 0.046, -0.45);
  g0.add(gasTube0);

  // Fluted main barrel + ported triangular muzzle brake
  const barrel0 = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.022, 0.48, 12), gunmetal);
  barrel0.rotation.x = Math.PI / 2;
  barrel0.position.set(0, 0.015, -0.56);
  g0.add(barrel0);
  const brake0 = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.095, 6), chrome);
  brake0.rotation.x = Math.PI / 2;
  brake0.position.set(0, 0.015, -0.8);
  g0.add(brake0);
  const muzzleCore0 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.02, 8), polymer);
  muzzleCore0.rotation.x = Math.PI / 2;
  muzzleCore0.position.set(0, 0.015, -0.845);
  g0.add(muzzleCore0);

  // Detachable curved magazine with amber rounds indicator
  const mag0 = new THREE.Group();
  mag0.position.set(0, -0.14, -0.09);
  mag0.rotation.x = 0.24;
  const magBody0 = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.22, 0.088), polymer);
  mag0.add(magBody0);
  const magBase0 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.026, 0.098), hazardOrange);
  magBase0.position.y = -0.11;
  mag0.add(magBase0);
  const magStrip0 = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.14, 0.012), amberGlow);
  magStrip0.position.set(0, -0.01, -0.034);
  mag0.add(magStrip0);
  g0.add(mag0);

  // Pistol grip & angled tactical foregrip
  const grip0 = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.15, 0.068), polymer);
  grip0.position.set(0, -0.11, 0.13);
  grip0.rotation.x = -0.32;
  g0.add(grip0);
  const foregrip0 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.11, 8), polymer);
  foregrip0.position.set(0, -0.072, -0.38);
  foregrip0.rotation.x = 0.24;
  g0.add(foregrip0);

  // Sculpted Open Reflex Holographic Optic — Wide Unobstructed Crystal-Clear Window at exact y = +0.124
  const holoGroup0 = new THREE.Group();
  holoGroup0.position.set(0, 0.124, 0.01);
  const holoFoot = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.018, 0.114), darkTitanium);
  holoFoot.position.y = -0.036;
  holoGroup0.add(holoFoot);
  const holoHoodGeo = makeBeveledExtrude(
    [
      [-0.046, -0.03],
      [-0.041, 0.036],
      [0.041, 0.036],
      [0.046, -0.03],
      [0.038, -0.03],
      [0.034, 0.029],
      [-0.034, 0.029],
      [-0.038, -0.03],
    ],
    0.072,
    0.0025,
    0.0025
  );
  holoGroup0.add(new THREE.Mesh(holoHoodGeo, gunmetal));
  const holoLens = new THREE.Mesh(new THREE.PlaneGeometry(0.068, 0.056), holoGlass);
  holoLens.position.set(0, 0, 0);
  holoGroup0.add(holoLens);
  if (textures?.holoReticleMap) {
    const retMat = new THREE.MeshBasicMaterial({
      map: textures.holoReticleMap,
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });
    const retMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.036, 0.036), retMat);
    retMesh.position.set(0, 0, -0.006);
    holoGroup0.add(retMesh);
  }
  g0.add(holoGroup0);

  // Side digital ammo telemetry strip & brass ejection port + charging handle
  const ejectPort0 = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.032, 0.092), brass);
  ejectPort0.position.set(0.052, 0.022, -0.05);
  g0.add(ejectPort0);
  const sideLaser0 = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 8), darkTitanium);
  sideLaser0.rotation.x = Math.PI / 2;
  sideLaser0.position.set(0.056, 0.016, -0.44);
  g0.add(sideLaser0);
  const sideLaserLens0 = new THREE.Mesh(new THREE.CircleGeometry(0.01, 8), crimsonGlow);
  sideLaserLens0.position.set(0.056, 0.016, -0.502);
  sideLaserLens0.rotation.y = Math.PI;
  g0.add(sideLaserLens0);
  const ammoLed0 = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.018, 0.14), cyanGlow);
  ammoLed0.position.set(-0.052, 0.032, -0.1);
  g0.add(ammoLed0);

  // Articulated left-side tactical charging handle (racks rearward during chambering phase)
  const chargingHandle0 = new THREE.Group();
  chargingHandle0.position.set(-0.056, 0.048, -0.16);
  const chStem = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.014, 0.018), chrome);
  chStem.position.x = -0.014;
  chargingHandle0.add(chStem);
  const chKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.024, 8), hazardOrange);
  chKnob.rotation.z = Math.PI / 2;
  chKnob.position.x = -0.034;
  chargingHandle0.add(chKnob);
  g0.add(chargingHandle0);

  const lHand0 = addExoHands(g0, suitArmor, suitSleeve, gloveMat, emeraldGlow, [0.015, -0.11, 0.14], [-0.03, -0.08, -0.37]);
  pivot.add(g0);
  weapons.push(g0);
  magazines.push(mag0);
  magBasePos.push(mag0.position.clone());
  magBaseRot.push(mag0.rotation.clone());
  leftHands.push(lHand0);
  leftHandBasePos.push(lHand0.position.clone());

  // =========================================================================
  // [2] DOOM-99 HEAVY COMBAT SHOTGUN (Twin chrome-fluted barrels, walnut/polymer pump, brass shell saddle)
  // =========================================================================
  const g1 = new THREE.Group();
  const rec1Geo = makeBeveledExtrude(
    [
      [-0.18, -0.055],
      [0.18, -0.055],
      [0.2, 0.045],
      [-0.16, 0.055],
    ],
    0.132,
    0.012,
    0.012
  );
  rec1Geo.rotateY(Math.PI / 2);
  g1.add(new THREE.Mesh(rec1Geo, darkTitanium));

  // Twin side-by-side heavy barrels + heat-shield bridge + glowing fiber front bead
  for (const sx of [-0.039, 0.039]) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.034, 0.68, 12), gunmetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(sx, 0.028, -0.44);
    g1.add(barrel);
    const choke = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.058, 12), chrome);
    choke.rotation.x = Math.PI / 2;
    choke.position.set(sx, 0.028, -0.76);
    g1.add(choke);
  }
  const rib1 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.022, 0.64), darkTitanium);
  rib1.position.set(0, 0.062, -0.43);
  g1.add(rib1);
  const frontBead1 = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 8), crimsonGlow);
  frontBead1.position.set(0, 0.078, -0.74);
  g1.add(frontBead1);

  // Under-barrel clamp + sculpted walnut/metal pump forend
  const forend1 = new THREE.Group();
  forend1.position.set(0, -0.042, -0.34);
  const woodGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.062, 0.27, 8), walnut);
  woodGrip.rotation.x = Math.PI / 2;
  woodGrip.scale.set(1.25, 0.72, 1);
  forend1.add(woodGrip);
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.006, 6, 10), darkTitanium);
    ring.position.set(0, 0, -0.09 + i * 0.06);
    forend1.add(ring);
  }
  g1.add(forend1);

  // Side saddle with 4 crimson brass-capped 12-gauge shells
  for (let i = 0; i < 4; i++) {
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.056, 8), fuelRed);
    sh.position.set(0.082, 0.008, -0.01 - i * 0.032);
    g1.add(sh);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0128, 0.0128, 0.016, 8), brass);
    cap.position.set(0.082, 0.038, -0.01 - i * 0.032);
    g1.add(cap);
  }
  const lHand1 = addExoHands(g1, suitArmor, suitSleeve, gloveMat, amberGlow, [0.02, -0.1, 0.14], [-0.02, -0.07, -0.34]);
  pivot.add(g1);
  weapons.push(g1);
  magazines.push(forend1);
  magBasePos.push(forend1.position.clone());
  magBaseRot.push(forend1.rotation.clone());
  leftHands.push(lHand1);
  leftHandBasePos.push(lHand1.position.clone());

  // =========================================================================
  // [3] RAIL-X9 ELECTROMAGNETIC RAILGUN (Twin accelerator rails, glowing plasma core, braided power hoses)
  // =========================================================================
  const g2 = new THREE.Group();
  const rec2Geo = makeBeveledExtrude(
    [
      [-0.25, -0.065],
      [0.24, -0.065],
      [0.28, 0.01],
      [0.20, 0.072],
      [-0.22, 0.072],
    ],
    0.118,
    0.012,
    0.012
  );
  rec2Geo.rotateY(Math.PI / 2);
  g2.add(new THREE.Mesh(rec2Geo, darkTitanium));

  // Twin magnetic accelerator rails with chamfered tips
  for (const sx of [-0.052, 0.052]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.058, 0.86), gunmetal);
    rail.position.set(sx, 0.022, -0.54);
    g2.add(rail);
    const accent = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.014, 0.78), cyanGlow);
    accent.position.set(sx > 0 ? sx - 0.016 : sx + 0.016, 0.022, -0.54);
    g2.add(accent);
  }
  // Central suspended plasma arc rod + 4 toroidal magnetic coils
  const plasmaCore2 = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.8, 8), cyanGlow);
  plasmaCore2.rotation.x = Math.PI / 2;
  plasmaCore2.position.set(0, 0.022, -0.53);
  g2.add(plasmaCore2);
  for (let i = 0; i < 4; i++) {
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.011, 6, 12), chrome);
    coil.position.set(0, 0.022, -0.26 - i * 0.19);
    g2.add(coil);
  }
  // Braided curved power conduit cables along sides
  for (const sx of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx * 0.068, -0.02, -0.02),
      new THREE.Vector3(sx * 0.095, -0.055, -0.22),
      new THREE.Vector3(sx * 0.064, 0.01, -0.44),
    ]);
    const hose = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.01, 6, false), polymer);
    g2.add(hose);
  }
  // GENUINE HOLLOW OPEN-ENDED TRANSPARENT 2.8x TACTICAL SNIPER SCOPE at exact y = +0.132
  const scopeGroup2 = new THREE.Group();
  scopeGroup2.position.set(0, 0.132, -0.06);
  // Twin machined Picatinny scope mounting stanchions
  for (const mz of [-0.075, 0.055]) {
    const mount = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.042, 0.024), darkTitanium);
    mount.position.set(0, -0.046, mz);
    scopeGroup2.add(mount);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.006, 8, 20), darkTitanium);
    ring.position.set(0, 0, mz);
    scopeGroup2.add(ring);
  }
  // Open-ended hollow outer scope barrel (truly see-through from eyepiece to objective!)
  const scopeTube2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.043, 0.039, 0.28, 24, 1, true),
    scopeInnerMat
  );
  scopeTube2.rotation.x = Math.PI / 2;
  scopeGroup2.add(scopeTube2);
  // Flared hollow front sunshade objective bell
  const scopeBell2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.049, 0.043, 0.08, 24, 1, true),
    gunmetal
  );
  scopeBell2.material = scopeInnerMat;
  scopeBell2.rotation.x = Math.PI / 2;
  scopeBell2.position.z = -0.175;
  scopeGroup2.add(scopeBell2);
  // Rear ocular bezel ring & front objective rim
  const rearBezel2 = new THREE.Mesh(new THREE.TorusGeometry(0.040, 0.0055, 8, 24), gunmetal);
  rearBezel2.position.z = 0.14;
  scopeGroup2.add(rearBezel2);
  const frontBezel2 = new THREE.Mesh(new THREE.TorusGeometry(0.049, 0.005, 8, 24), gunmetal);
  frontBezel2.position.z = -0.214;
  scopeGroup2.add(frontBezel2);
  // Precision elevation & windage adjustment turrets
  const elevTurret2 = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.014, 0.022, 10), chrome);
  elevTurret2.position.set(0, 0.052, -0.01);
  scopeGroup2.add(elevTurret2);
  const windTurret2 = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.012, 0.02, 10), chrome);
  windTurret2.rotation.z = Math.PI / 2;
  windTurret2.position.set(0.05, 0, -0.01);
  scopeGroup2.add(windTurret2);
  // Crystal-clear front & rear AR-coated glass lenses + crisp internal etched Mil-Dot reticle
  const scopeGlassRear2 = new THREE.Mesh(new THREE.CircleGeometry(0.037, 24), holoGlass);
  scopeGlassRear2.position.set(0, 0, 0.132);
  scopeGroup2.add(scopeGlassRear2);
  const scopeGlassFront2 = new THREE.Mesh(new THREE.CircleGeometry(0.045, 24), holoGlass);
  scopeGlassFront2.position.set(0, 0, -0.205);
  scopeGroup2.add(scopeGlassFront2);
  if (textures?.sniperReticleMap) {
    const snipeRetMat = new THREE.MeshBasicMaterial({
      map: textures.sniperReticleMap,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const snipeRetMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.072, 0.072), snipeRetMat);
    snipeRetMesh.position.set(0, 0, 0.01);
    scopeGroup2.add(snipeRetMesh);
  }
  g2.add(scopeGroup2);
  const cell2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.072, 0.14, 0.11),
    new THREE.MeshStandardMaterial({ color: 0x0e7490, roughness: 0.25, metalness: 0.82 })
  );
  cell2.position.set(0, -0.13, -0.08);
  g2.add(cell2);
  const lHand2 = addExoHands(g2, suitArmor, suitSleeve, gloveMat, cyanGlow, [0.02, -0.11, 0.15], [-0.03, -0.08, -0.36]);
  pivot.add(g2);
  weapons.push(g2);
  magazines.push(cell2);
  magBasePos.push(cell2.position.clone());
  magBaseRot.push(cell2.rotation.clone());
  leftHands.push(lHand2);
  leftHandBasePos.push(lHand2.position.clone());

  // =========================================================================
  // [4] HYDRA-7 GUIDED ROCKET LAUNCHER (Fluted launch tube, hazard collar, target-lock pod)
  // =========================================================================
  const g3 = new THREE.Group();
  const tube3 = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.098, 1.02, 14), militaryOlive);
  tube3.rotation.x = Math.PI / 2;
  tube3.position.set(0, 0.02, -0.24);
  g3.add(tube3);
  for (const rz of [-0.06, -0.38, -0.68]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.102, 0.014, 8, 14), darkTitanium);
    band.position.set(0, 0.02, rz);
    g3.add(band);
  }
  const muzzleCollar3 = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.112, 0.1, 12), hazardOrange);
  muzzleCollar3.rotation.x = Math.PI / 2;
  muzzleCollar3.position.set(0, 0.02, -0.72);
  g3.add(muzzleCollar3);
  const opticPod3 = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.088, 0.26), darkTitanium);
  opticPod3.position.set(-0.115, 0.065, -0.16);
  g3.add(opticPod3);
  const laserEye3 = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.015, 10), crimsonGlow);
  laserEye3.rotation.x = Math.PI / 2;
  laserEye3.position.set(-0.115, 0.065, -0.295);
  g3.add(laserEye3);
  // Open Top-Mounted Transparent Smart Ballistic Optic at exact y = +0.152
  const launcherOptic3 = new THREE.Group();
  launcherOptic3.position.set(0, 0.152, -0.14);
  const optBase3 = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.022, 0.1), darkTitanium);
  optBase3.position.y = -0.038;
  launcherOptic3.add(optBase3);
  const optHood3Geo = makeBeveledExtrude(
    [
      [-0.048, -0.03],
      [-0.044, 0.034],
      [0.044, 0.034],
      [0.048, -0.03],
      [0.040, -0.03],
      [0.037, 0.027],
      [-0.037, 0.027],
      [-0.040, -0.03],
    ],
    0.058,
    0.0025,
    0.0025
  );
  launcherOptic3.add(new THREE.Mesh(optHood3Geo, darkTitanium));
  launcherOptic3.add(new THREE.Mesh(new THREE.PlaneGeometry(0.074, 0.054), holoGlass));
  if (textures?.arcOpticReticleMap) {
    const rMat3 = new THREE.MeshBasicMaterial({
      map: textures.arcOpticReticleMap,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const rMesh3 = new THREE.Mesh(new THREE.PlaneGeometry(0.052, 0.052), rMat3);
    rMesh3.position.z = -0.005;
    launcherOptic3.add(rMesh3);
  }
  g3.add(launcherOptic3);
  const warhead3 = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.22, 10), brass);
  warhead3.rotation.x = -Math.PI / 2;
  warhead3.position.set(0, 0.02, -0.65);
  g3.add(warhead3);
  const lHand3 = addExoHands(g3, suitArmor, suitSleeve, gloveMat, amberGlow, [0.04, -0.11, 0.04], [-0.04, -0.09, -0.34]);
  pivot.add(g3);
  weapons.push(g3);
  magazines.push(warhead3);
  magBasePos.push(warhead3.position.clone());
  magBaseRot.push(warhead3.rotation.clone());
  leftHands.push(lHand3);
  leftHandBasePos.push(lHand3.position.clone());

  // =========================================================================
  // [5] INFERNO-X PLASMA FLAMETHROWER (Pressurized thermite tank, coiled hose, pilot igniter)
  // =========================================================================
  const g4 = new THREE.Group();
  g4.add(new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.135, 0.46), darkTitanium));
  const nozzle4 = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.056, 0.5, 12), gunmetal);
  nozzle4.rotation.x = Math.PI / 2;
  nozzle4.position.set(0, 0.02, -0.46);
  g4.add(nozzle4);
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.008, 6, 12), chrome);
    fin.position.set(0, 0.02, -0.36 - i * 0.14);
    g4.add(fin);
  }
  const canister4 = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.066, 0.32, 12), fuelRed);
  canister4.position.set(0.01, -0.14, -0.18);
  g4.add(canister4);
  const hose4Curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.06, -0.1, -0.18),
    new THREE.Vector3(0.11, -0.06, -0.32),
    new THREE.Vector3(0.045, 0.01, -0.46),
  ]);
  g4.add(new THREE.Mesh(new THREE.TubeGeometry(hose4Curve, 12, 0.014, 8, false), hazardOrange));
  const gauge4 = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.016, 10), amberGlow);
  gauge4.rotation.z = Math.PI / 2;
  gauge4.position.set(-0.068, 0.04, -0.05);
  g4.add(gauge4);
  const pilot4 = new THREE.Mesh(new THREE.OctahedronGeometry(0.036, 0), amberGlow);
  pilot4.position.set(0, 0.015, -0.75);
  g4.add(pilot4);
  const lHand4 = addExoHands(g4, suitArmor, suitSleeve, gloveMat, amberGlow, [0.02, -0.1, 0.14], [-0.04, -0.08, -0.35]);
  pivot.add(g4);
  weapons.push(g4);
  magazines.push(canister4);
  magBasePos.push(canister4.position.clone());
  magBaseRot.push(canister4.rotation.clone());
  leftHands.push(lHand4);
  leftHandBasePos.push(lHand4.position.clone());

  // =========================================================================
  // [6] ZEUS-MK7 CHAIN ARC TESLA CANNON (Rotating copper-cyan coils, twin discharge prongs, arc cell)
  // =========================================================================
  const g5 = new THREE.Group();
  const rec5Geo = makeBeveledExtrude(
    [
      [-0.22, -0.06],
      [0.24, -0.06],
      [0.27, 0.02],
      [0.18, 0.072],
      [-0.20, 0.072],
    ],
    0.115,
    0.01,
    0.01
  );
  rec5Geo.rotateY(Math.PI / 2);
  g5.add(new THREE.Mesh(rec5Geo, darkTitanium));

  const teslaCoilRotor = new THREE.Group();
  teslaCoilRotor.position.set(0, 0.026, -0.42);
  const copperMat = new THREE.MeshStandardMaterial({
    color: 0xd97736,
    roughness: 0.24,
    metalness: 0.94,
  });
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.068 - i * 0.008, 0.012, 8, 16), copperMat);
    ring.position.z = 0.14 - i * 0.16;
    teslaCoilRotor.add(ring);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.15 - i * 0.015, 0.024), chrome);
    fin.position.z = 0.14 - i * 0.16;
    fin.rotation.z = (i * Math.PI) / 3;
    teslaCoilRotor.add(fin);
  }
  g5.add(teslaCoilRotor);

  const teslaArcCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.016, 0.62, 10),
    new THREE.MeshBasicMaterial({ color: 0x38e8ff })
  );
  teslaArcCore.rotation.x = Math.PI / 2;
  teslaArcCore.position.set(0, 0.026, -0.44);
  g5.add(teslaArcCore);

  // Twin brass/chrome arc emitter prongs at front
  for (const sx of [-0.048, 0.048]) {
    const prong = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.22, 6), chrome);
    prong.rotation.x = -Math.PI / 2;
    prong.position.set(sx, 0.026, -0.78);
    g5.add(prong);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), cyanGlow);
    tip.position.set(sx, 0.026, -0.88);
    g5.add(tip);
  }

  // Side detachable high-voltage arc capacitor cell
  const cell5 = new THREE.Group();
  cell5.position.set(0.088, 0.022, -0.08);
  const cellBody5 = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.22, 10), gunmetal);
  cellBody5.rotation.x = Math.PI / 2;
  cell5.add(cellBody5);
  const cellGlow5 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.09, 10), cyanGlow);
  cellGlow5.rotation.x = Math.PI / 2;
  cell5.add(cellGlow5);
  g5.add(cell5);

  // Open Top-Mounted Transparent Arc-Targeting Reflex Prism Optic at exact y = +0.124
  const teslaOptic5 = new THREE.Group();
  teslaOptic5.position.set(0, 0.124, -0.02);
  const tBase5 = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.02, 0.092), darkTitanium);
  tBase5.position.y = -0.036;
  teslaOptic5.add(tBase5);
  const tHood5Geo = makeBeveledExtrude(
    [
      [-0.044, -0.028],
      [-0.036, 0.034],
      [0.036, 0.034],
      [0.044, -0.028],
      [0.037, -0.028],
      [0.030, 0.028],
      [-0.030, 0.028],
      [-0.037, -0.028],
    ],
    0.054,
    0.002,
    0.002
  );
  teslaOptic5.add(new THREE.Mesh(tHood5Geo, gunmetal));
  teslaOptic5.add(new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.054), holoGlass));
  if (textures?.arcOpticReticleMap) {
    const rMat5 = new THREE.MeshBasicMaterial({
      map: textures.arcOpticReticleMap,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const rMesh5 = new THREE.Mesh(new THREE.PlaneGeometry(0.048, 0.048), rMat5);
    rMesh5.position.z = -0.005;
    teslaOptic5.add(rMesh5);
  }
  g5.add(teslaOptic5);

  const lHand5 = addExoHands(g5, suitArmor, suitSleeve, gloveMat, cyanGlow, [0.02, -0.11, 0.14], [-0.03, -0.08, -0.34]);
  pivot.add(g5);
  weapons.push(g5);
  magazines.push(cell5);
  magBasePos.push(cell5.position.clone());
  magBaseRot.push(cell5.rotation.clone());
  leftHands.push(lHand5);
  leftHandBasePos.push(lHand5.position.clone());

  // Muzzle flash volumetric core
  const muzzleFlash = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.14, 0),
    new THREE.MeshBasicMaterial({ color: 0xffe296, transparent: true, opacity: 0.92 })
  );
  muzzleFlash.position.set(0, 0.03, -0.88);
  muzzleFlash.visible = false;
  pivot.add(muzzleFlash);

  // High-Frequency Cyber-Blade for Glory Kill executions
  const blade = new THREE.Group();
  const bladeGeo = makeBeveledExtrude(
    [
      [-0.02, -0.36],
      [0.035, -0.36],
      [0.052, 0.24],
      [0.0, 0.42],
      [-0.024, 0.28],
    ],
    0.016,
    0.004,
    0.004
  );
  const bladeEdge = new THREE.Mesh(bladeGeo, crimsonGlow);
  const bladeSpine = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.62, 0.046), darkTitanium);
  bladeSpine.position.set(-0.02, -0.05, 0);
  const bladeHilt = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.18, 8), gunmetal);
  bladeHilt.position.set(0, -0.44, 0);
  blade.add(bladeEdge, bladeSpine, bladeHilt);
  blade.position.set(-0.45, -0.2, -0.62);
  blade.rotation.z = -0.75;
  blade.visible = false;
  camera.add(blade);

  return {
    pivot,
    weapons,
    magazines,
    magBasePos,
    magBaseRot,
    leftHands,
    leftHandBasePos,
    chargingHandle0,
    railPlasmaCore: plasmaCore2,
    flamerPilot: pilot4,
    teslaCoilRotor,
    teslaArcCore,
    muzzleFlash,
    blade,
  };
}

export interface PlayerBodyRig {
  root: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftKnee: THREE.Group;
  rightKnee: THREE.Group;
}

/**
 * Builds grounded 1st-person ROK Tier-1 Operator lower body & tactical combat boots
 * visible when looking downward (CoD / Battlefield full-body immersion!).
 */
export function buildPlayerFirstPersonBody(pbr: ExtendedPbrLibrary): PlayerBodyRig {
  const root = new THREE.Group();
  root.name = 'PlayerFirstPersonBody';

  const trouserMat = new THREE.MeshStandardMaterial({
    color: 0xe2eae4,
    map: pbr.rokCamo.map,
    normalMap: pbr.rokCamo.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: pbr.rokCamo.roughnessMap,
    aoMap: pbr.rokCamo.aoMap,
    aoMapIntensity: 0.45,
    roughness: 0.88,
    metalness: 0.05,
    envMapIntensity: 0.65,
  });
  const armorMat = new THREE.MeshStandardMaterial({
    color: 0xdce4f0,
    map: pbr.carbonArmor.map,
    normalMap: pbr.carbonArmor.normalMap,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughnessMap: pbr.carbonArmor.roughnessMap,
    aoMap: pbr.carbonArmor.aoMap,
    aoMapIntensity: 0.45,
    roughness: 0.44,
    metalness: 0.54,
    envMapIntensity: 1.05,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x3b424e,
    normalMap: pbr.kevlarGlove.normalMap,
    roughness: 0.82,
    metalness: 0.14,
    envMapIntensity: 0.68,
  });

  // Lower plate-carrier belt & waist rig (pushed slightly back so it never clips camera pitch)
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.19, 0.14, 14), armorMat);
  belt.scale.set(1.18, 1, 0.72);
  belt.position.set(0, 0.88, 0.14);
  root.add(belt);

  const makeLeg = (sx: -1 | 1) => {
    const leg = new THREE.Group();
    leg.position.set(sx * 0.145, 0.84, 0.14);

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.088, 0.28, 6, 12), trouserMat);
    thigh.position.set(0, -0.20, 0);
    leg.add(thigh);

    const holster = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.14), armorMat);
    holster.position.set(sx * 0.086, -0.20, -0.02);
    leg.add(holster);

    const knee = new THREE.Group();
    knee.position.set(0, -0.41, 0);

    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.125, 0.068), armorMat);
    pad.position.set(0, 0.01, -0.072);
    knee.add(pad);

    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.28, 6, 12), trouserMat);
    shin.position.set(0, -0.21, 0);
    knee.add(shin);

    // Matte ballistic combat boot pointing forward (-Z in player space!)
    const bootUpper = new THREE.Mesh(new THREE.BoxGeometry(0.128, 0.115, 0.27), bootMat);
    bootUpper.position.set(0, -0.37, -0.055);
    knee.add(bootUpper);
    const bootSole = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.042, 0.295), armorMat);
    bootSole.position.set(0, -0.42, -0.058);
    knee.add(bootSole);

    leg.add(knee);
    root.add(leg);
    return { leg, knee };
  };

  const left = makeLeg(-1);
  const right = makeLeg(1);

  return {
    root,
    leftLeg: left.leg,
    rightLeg: right.leg,
    leftKnee: left.knee,
    rightKnee: right.knee,
  };
}

export interface EnemyRig {
  root: THREE.Group;
  parts: Partial<Record<BodyPart, THREE.Object3D>>;
  knees?: { left?: THREE.Object3D; right?: THREE.Object3D };
  elbows?: { left?: THREE.Object3D; right?: THREE.Object3D };
  mats: THREE.MeshStandardMaterial[];
  visorMat: THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;
  gatlingBarrel?: THREE.Object3D;
  sawBlade?: THREE.Object3D;
  sniperLaser?: THREE.Mesh;
  contactShadow: THREE.Mesh;
}

/**
 * Builds 10x high-detail articulated AI Robot & Combat Mech models (ALL enemies are AI Robots!).
 * Every hit-zone (head, torso, leftArm, rightArm, leftLeg, rightLeg, armor plates, core) remains
 * individually raycastable and dismemberable with full hydraulic/armored silhouette detail.
 */
export function buildEnemyModel(
  faction: Faction,
  archetype: UnitArchetype,
  scale: number,
  contactShadowTex: THREE.CanvasTexture,
  ownerRef: unknown,
  textures?: ProceduralTextureSet
): EnemyRig {
  const isBoss = archetype === UnitArchetype.ROBOT_TITAN;
  const isStalker = archetype === UnitArchetype.ROBOT_STALKER;
  const isRustBorg = faction === Faction.RAIDER;
  const isAegis = faction === Faction.SYNDICATE;
  const root = new THREE.Group();
  const s = scale;

  // Every faction is a distinct high-craft AI Robot division (ZERO blocky humans)
  const chassisColor = isBoss
    ? 0x1e222c
    : isRustBorg
      ? 0x8f431a // Weathered industrial orange-rust demolition mech
      : isAegis
        ? 0x2a1f45 // Sleek obsidian-violet Aegis security synth
        : 0x262b36; // Omni-Guard dark titanium combat warframe

  const secondaryColor = isBoss
    ? 0x7f1d1d
    : isRustBorg
      ? 0x3f2e24
      : isAegis
        ? 0x4c1d95
        : 0x6b1424;

  const armorMat = new THREE.MeshStandardMaterial({
    color: chassisColor,
    bumpMap: textures?.armorPlateBump,
    bumpScale: 0.035,
    roughness: isRustBorg ? 0.56 : 0.28,
    metalness: isRustBorg ? 0.72 : 0.88,
  });
  const limbMat = new THREE.MeshStandardMaterial({
    color: 0x171b23,
    bumpMap: textures?.gunmetalBump,
    bumpScale: 0.02,
    roughness: 0.36,
    metalness: 0.86,
  });
  const headMat = new THREE.MeshStandardMaterial({
    color: isAegis ? 0x1c1730 : isRustBorg ? 0x4b3526 : 0x252c38,
    roughness: 0.25,
    metalness: 0.9,
  });
  const plateMat = new THREE.MeshStandardMaterial({
    color: secondaryColor,
    bumpMap: textures?.armorPlateBump,
    bumpScale: 0.03,
    roughness: 0.3,
    metalness: 0.88,
  });
  const chromeJointMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.18,
    metalness: 0.96,
  });
  const visorColor = isRustBorg
    ? 0xff8c1a // Furnace amber demolition eye
    : isAegis
      ? 0x6ea8fe // Cobalt steel tactical security visor
      : 0xff163d; // Crimson OMNI-CORE sentinel optic
  const visorMat = new THREE.MeshBasicMaterial({ color: visorColor });
  const darkIron = new THREE.MeshStandardMaterial({
    color: 0x12151c,
    roughness: 0.42,
    metalness: 0.82,
  });

  const parts: Partial<Record<BodyPart, THREE.Mesh>> = {};
  const tagSub = (obj: THREE.Object3D, part: BodyPart) => {
    obj.userData = { unit: ownerRef, part };
    obj.traverse((c) => {
      c.userData = { unit: ownerRef, part };
    });
  };
  const makePart = (
    part: BodyPart,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    px: number,
    py: number,
    pz: number,
    parent: THREE.Object3D
  ): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, py, pz);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData = { unit: ownerRef, part };
    parent.add(m);
    parts[part] = m;
    return m;
  };

  let gatlingBarrel: THREE.Object3D | undefined;
  let sawBlade: THREE.Object3D | undefined;
  let sniperLaser: THREE.Mesh | undefined;
  const isSniper = archetype === UnitArchetype.SYNDICATE_SNIPER;

  if (isStalker) {
    // =========================================================================
    // OMNI-GUARD HOVER HUNTER DRONE (Sleek angular armored fuselage, twin turbine wings, spinning plasma saw)
    // =========================================================================
    const torso = makePart(
      'torso',
      new THREE.OctahedronGeometry(0.46 * s, 1),
      armorMat,
      0,
      1.38 * s,
      0,
      root
    );
    const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * s, 0.54 * s, 0.24 * s, 8), plateMat);
    cowl.position.y = 0.14 * s;
    tagSub(cowl, 'torso');
    torso.add(cowl);

    const core = makePart(
      'head',
      new THREE.CylinderGeometry(0.2 * s, 0.24 * s, 0.24 * s, 8),
      headMat,
      0,
      0.14 * s,
      0.34 * s,
      torso
    );
    core.rotation.x = Math.PI / 2;
    const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * s, 0.13 * s, 0.06 * s, 10), visorMat);
    eye.position.set(0, 0.11 * s, 0);
    tagSub(eye, 'head');
    core.add(eye);

    for (const sx of [-1, 1]) {
      const partName: BodyPart = sx < 0 ? 'leftArm' : 'rightArm';
      const wing = makePart(
        partName,
        new THREE.BoxGeometry(0.48 * s, 0.1 * s, 0.34 * s),
        limbMat,
        sx * 0.56 * s,
        0.08 * s,
        -0.02 * s,
        torso
      );
      wing.rotation.z = sx * -0.26;
      const thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * s, 0.14 * s, 0.22 * s, 8), chromeJointMat);
      thruster.position.set(sx * 0.16 * s, -0.08 * s, -0.04 * s);
      tagSub(thruster, partName);
      wing.add(thruster);
      const jet = new THREE.Mesh(new THREE.ConeGeometry(0.08 * s, 0.26 * s, 8), visorMat);
      jet.rotation.x = Math.PI;
      jet.position.set(sx * 0.16 * s, -0.26 * s, -0.04 * s);
      tagSub(jet, partName);
      wing.add(jet);
    }

    const sawGroup = new THREE.Group();
    sawGroup.position.set(0, -0.3 * s, 0.22 * s);
    const sawDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.38 * s, 0.38 * s, 0.04 * s, 12), chromeJointMat);
    sawGroup.add(sawDisc);
    const sawRing = new THREE.Mesh(new THREE.TorusGeometry(0.37 * s, 0.025 * s, 6, 12), visorMat);
    sawRing.rotation.x = Math.PI / 2;
    sawGroup.add(sawRing);
    tagSub(sawGroup, 'torso');
    torso.add(sawGroup);
    sawBlade = sawGroup;
  } else {
    // =========================================================================
    // ARTICULATED CYBERNETIC WARFRAME / SYNTH ANDROID (Sculpted beveled torso, pistons, armor pauldrons)
    // =========================================================================
    const torsoW = isBoss ? 0.88 : archetype === UnitArchetype.SYNDICATE_HEAVY ? 0.72 : 0.6;

    // Tapered mechanical chest chassis (octagonal armored core, NOT a flat box)
    const torso = makePart(
      'torso',
      new THREE.CylinderGeometry(torsoW * 0.62 * s, torsoW * 0.44 * s, 0.78 * s, 8),
      armorMat,
      0,
      1.22 * s,
      0,
      root
    );
    torso.scale.set(1.0, 1.0, 0.68);

    // Armored pectoral chest plate + glowing AI reactor slit + dorsal spine power-pack
    const chestPlate = new THREE.Mesh(
      new THREE.BoxGeometry(torsoW * 0.82 * s, 0.34 * s, 0.28 * s),
      plateMat
    );
    chestPlate.position.set(0, 0.14 * s, 0.24 * s);
    chestPlate.rotation.x = -0.14;
    tagSub(chestPlate, 'torso');
    torso.add(chestPlate);

    const chestSlit = new THREE.Mesh(
      new THREE.BoxGeometry(torsoW * 0.34 * s, 0.075 * s, 0.05 * s),
      visorMat
    );
    chestSlit.position.set(0, 0.16 * s, 0.38 * s);
    tagSub(chestSlit, 'torso');
    torso.add(chestSlit);

    // Mechanical spine thruster / coolant backpack
    const backpack = new THREE.Mesh(
      new THREE.BoxGeometry(torsoW * 0.64 * s, 0.56 * s, 0.34 * s),
      darkIron
    );
    backpack.position.set(0, 0.08 * s, -0.34 * s);
    tagSub(backpack, 'torso');
    torso.add(backpack);

    for (const sx of [-0.16, 0.16]) {
      const vent = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075 * s, 0.075 * s, 0.48 * s, 8),
        chromeJointMat
      );
      vent.position.set(sx * s, 0.1 * s, -0.5 * s);
      tagSub(vent, 'torso');
      torso.add(vent);
    }

    // Articulated hydraulic pelvis hub
    const pelvis = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22 * s, 0.26 * s, 0.22 * s, 8),
      darkIron
    );
    pelvis.position.set(0, -0.44 * s, 0);
    tagSub(pelvis, 'torso');
    torso.add(pelvis);

    // Sculpted Shoulder Pauldrons + Hydraulic Neck Collar
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14 * s, 0.18 * s, 0.14 * s, 8),
      chromeJointMat
    );
    collar.position.set(0, 0.44 * s, 0);
    tagSub(collar, 'torso');
    torso.add(collar);

    for (const sx of [-1, 1]) {
      const armPart: BodyPart = sx < 0 ? 'leftArm' : 'rightArm';
      const pauldron = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16 * s, 0.24 * s, 0.26 * s, 6),
        isBoss ? plateMat : armorMat
      );
      pauldron.position.set(sx * (torsoW * 0.66) * s, 0.28 * s, 0);
      pauldron.rotation.z = sx * -0.32;
      tagSub(pauldron, armPart);
      torso.add(pauldron);

      // Shoulder antenna on Aegis / Omni-Guard units
      if ((isAegis || isBoss) && sx === -1) {
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.014 * s, 0.02 * s, 0.48 * s, 6), chromeJointMat);
        ant.position.set(sx * (torsoW * 0.64) * s, 0.58 * s, -0.06 * s);
        tagSub(ant, 'torso');
        torso.add(ant);
      }
    }

    // =========================================================================
    // HEAD: Angular Cybernetic Android Skull / Sensor Pod (NOT a flat cube)
    // =========================================================================
    const headGeo = isRustBorg
      ? new THREE.CylinderGeometry(0.19 * s, 0.21 * s, 0.34 * s, 8) // Welded drum-cage industrial droid head
      : new THREE.OctahedronGeometry(0.24 * s, 1); // Sleek angular stealth android helmet
    const head = makePart('head', headGeo, headMat, 0, 0.6 * s, 0.04 * s, torso);

    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.32 * s, 0.07 * s, 0.24 * s), plateMat);
    brow.position.set(0, 0.11 * s, 0.09 * s);
    brow.rotation.x = 0.2;
    tagSub(brow, 'head');
    head.add(brow);

    // Glowing AI optical visor bar (or cyclops furnace eye for Rust-Borg)
    const visor = isRustBorg
      ? new THREE.Mesh(new THREE.CylinderGeometry(0.08 * s, 0.08 * s, 0.08 * s, 10), visorMat)
      : new THREE.Mesh(new THREE.BoxGeometry(0.3 * s, 0.075 * s, 0.09 * s), visorMat);
    if (isRustBorg) visor.rotation.x = Math.PI / 2;
    visor.position.set(0, 0.01 * s, 0.2 * s);
    tagSub(visor, 'head');
    head.add(visor);

    // Jaw respirator / vocalizer grille
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.2 * s, 0.1 * s, 0.16 * s), darkIron);
    jaw.position.set(0, -0.11 * s, 0.14 * s);
    tagSub(jaw, 'head');
    head.add(jaw);

    // =========================================================================
    // ARTICULATED HYDRAULIC ARMS + CYBERNETIC WEAPONS (TRUE SHOULDER PIVOTS!)
    // =========================================================================
    const buildArm = (sx: number, part: BodyPart, zOff: number): THREE.Mesh => {
      const armGeo = new THREE.CylinderGeometry(0.1 * s, 0.085 * s, 0.66 * s, 10);
      armGeo.translate(0, -0.33 * s, 0);
      const arm = makePart(
        part,
        armGeo,
        limbMat,
        sx * (torsoW * 0.64 + 0.1) * s,
        0.26 * s,
        zOff * s,
        torso
      );
      const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.115 * s, 10, 8), armorMat);
      tagSub(shoulderCap, part);
      arm.add(shoulderCap);
      const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.098 * s, 8, 8), chromeJointMat);
      elbow.position.y = -0.33 * s;
      tagSub(elbow, part);
      arm.add(elbow);
      const gauntlet = new THREE.Mesh(
        new THREE.CylinderGeometry(0.112 * s, 0.092 * s, 0.28 * s, 8),
        armorMat
      );
      gauntlet.position.y = -0.52 * s;
      tagSub(gauntlet, part);
      arm.add(gauntlet);
      return arm;
    };

    buildArm(-1, 'leftArm', 0.04);
    const rArm = buildArm(1, 'rightArm', 0.1);

    if (isBoss) {
      // OMNI-TITAN 6-barrel rotary plasma cannon + glowing chest reactor + 3 beveled armor plates
      const gatling = new THREE.Group();
      gatling.position.set(0, -0.44 * s, 0.56 * s);
      const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.18 * s, 0.28 * s, 10), plateMat);
      housing.rotation.x = Math.PI / 2;
      housing.position.z = -0.32 * s;
      gatling.add(housing);
      for (let b = 0; b < 6; b++) {
        const ang = (b / 6) * Math.PI * 2;
        const barrel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.036 * s, 0.036 * s, 1.04 * s, 8),
          chromeJointMat
        );
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(Math.cos(ang) * 0.1 * s, Math.sin(ang) * 0.1 * s, 0);
        gatling.add(barrel);
      }
      const barrelClamp = new THREE.Mesh(new THREE.TorusGeometry(0.115 * s, 0.024 * s, 6, 12), visorMat);
      barrelClamp.position.z = 0.34 * s;
      gatling.add(barrelClamp);
      tagSub(gatling, 'rightArm');
      rArm.add(gatling);
      gatlingBarrel = gatling;

      // Glowing OMNI-TITAN neural weakpoint reactor core
      makePart(
        'core',
        new THREE.OctahedronGeometry(0.24 * s, 1),
        new THREE.MeshBasicMaterial({ color: 0xff1c44 }),
        0,
        0.04 * s,
        0.24 * s,
        torso
      );
      // 3 Detachable heavy armor shields
      makePart(
        'armorFront',
        new THREE.BoxGeometry(0.76 * s, 0.56 * s, 0.14 * s),
        plateMat,
        0,
        0.04 * s,
        0.38 * s,
        torso
      );
      makePart(
        'armorLeft',
        new THREE.BoxGeometry(0.16 * s, 0.54 * s, 0.52 * s),
        plateMat,
        -0.56 * s,
        0.08 * s,
        0,
        torso
      );
      makePart(
        'armorRight',
        new THREE.BoxGeometry(0.16 * s, 0.54 * s, 0.52 * s),
        plateMat,
        0.56 * s,
        0.08 * s,
        0,
        torso
      );
    } else {
      // Detailed composite AI plasma/ballistic carbine or long sniper rail held by right arm
      const gunLen = isSniper
        ? 1.24
        : archetype === UnitArchetype.SYNDICATE_HEAVY
          ? 0.88
          : 0.68;
      const gunGroup = new THREE.Group();
      gunGroup.position.set(0, -0.48 * s, (isSniper ? 0.56 : 0.38) * s);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.1 * s, 0.13 * s, gunLen * s), darkIron);
      gunGroup.add(body);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.026 * s, 0.026 * s, gunLen * 0.65 * s, 8), chromeJointMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.03 * s, gunLen * 0.45 * s);
      gunGroup.add(barrel);
      const muzzleGlow = new THREE.Mesh(
        new THREE.BoxGeometry(0.032 * s, 0.028 * s, gunLen * 0.55 * s),
        isSniper ? new THREE.MeshBasicMaterial({ color: 0xff2244 }) : visorMat
      );
      muzzleGlow.position.set(0, 0.055 * s, 0.05 * s);
      gunGroup.add(muzzleGlow);

      if (isSniper) {
        const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.045 * s, 0.04 * s, 0.42 * s, 8), chromeJointMat);
        scope.rotation.x = Math.PI / 2;
        scope.position.set(0, 0.13 * s, 0.04 * s);
        gunGroup.add(scope);

        // Volumetric laser sight beam (toggled & stretched dynamically by engine during lock-on)
        const laserGeo = new THREE.CylinderGeometry(0.014, 0.014, 1, 6, 1, true);
        laserGeo.rotateX(Math.PI / 2);
        laserGeo.translate(0, 0, 0.5);
        const laserMat = new THREE.MeshBasicMaterial({
          color: 0xff1e42,
          transparent: true,
          opacity: 0.72,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        sniperLaser = new THREE.Mesh(laserGeo, laserMat);
        sniperLaser.position.set(0, 0.04 * s, gunLen * 0.8 * s);
        sniperLaser.visible = false;
        gunGroup.add(sniperLaser);
      }

      tagSub(gunGroup, 'rightArm');
      rArm.add(gunGroup);
    }

    // =========================================================================
    // ARTICULATED BIPEDAL HYDRAULIC LEGS (TRUE HIP SOCKET PIVOTS — ZERO DETACHMENT!)
    // =========================================================================
    for (const sx of [-1, 1]) {
      const legPart: BodyPart = sx < 0 ? 'leftLeg' : 'rightLeg';
      const legGeo = new THREE.CylinderGeometry(0.115 * s, 0.095 * s, 0.82 * s, 10);
      legGeo.translate(0, -0.41 * s, 0);
      const leg = makePart(
        legPart,
        legGeo,
        limbMat,
        sx * 0.21 * s,
        0.82 * s,
        0,
        root
      );
      const hipBall = new THREE.Mesh(new THREE.SphereGeometry(0.11 * s, 8, 8), chromeJointMat);
      tagSub(hipBall, legPart);
      leg.add(hipBall);
      const knee = new THREE.Mesh(new THREE.SphereGeometry(0.112 * s, 8, 8), chromeJointMat);
      knee.position.set(0, -0.37 * s, 0.06 * s);
      tagSub(knee, legPart);
      leg.add(knee);
      const shinGuard = new THREE.Mesh(
        new THREE.BoxGeometry(0.18 * s, 0.38 * s, 0.16 * s),
        armorMat
      );
      shinGuard.position.set(0, -0.57 * s, 0.06 * s);
      tagSub(shinGuard, legPart);
      leg.add(shinGuard);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.22 * s, 0.11 * s, 0.34 * s), darkIron);
      foot.position.set(0, -0.78 * s, 0.08 * s);
      tagSub(foot, legPart);
      leg.add(foot);
    }
  }

  // Soft radial contact shadow disc at ground level
  const contactShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.84 * s, 16),
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
    mats: [armorMat, limbMat, headMat, plateMat],
    visorMat,
    gatlingBarrel,
    sawBlade,
    sniperLaser,
    contactShadow,
  };
}

export function buildDropshipModel(): THREE.Group {
  const group = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({
    color: 0x202632,
    roughness: 0.32,
    metalness: 0.88,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x5c1822,
    roughness: 0.36,
    metalness: 0.78,
  });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xff1e44 });
  const cyanMat = new THREE.MeshBasicMaterial({ color: 0x38e8ff });

  // Sculpted angular stealth fuselage
  const fuselageGeo = makeBeveledExtrude(
    [
      [-2.1, -0.9],
      [2.1, -0.9],
      [2.4, 0.1],
      [1.4, 1.0],
      [-1.4, 1.0],
      [-2.4, 0.1],
    ],
    7.8,
    0.15,
    0.15
  );
  const hull = new THREE.Mesh(fuselageGeo, hullMat);
  hull.castShadow = true;
  group.add(hull);

  // Armored beveled nose & glowing sensor slit
  const nose = new THREE.Mesh(new THREE.ConeGeometry(2.1, 3.2, 6), trimMat);
  nose.rotation.x = Math.PI / 2;
  nose.scale.set(1.1, 0.55, 1);
  nose.position.set(0, -0.05, 5.2);
  group.add(nose);

  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.38, 0.4), glowMat);
  cockpit.position.set(0, 0.35, 4.4);
  group.add(cockpit);

  // Twin swept VTOL thruster wings + rotating turbine nacelles
  for (const sx of [-3.6, 3.6]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.32, 3.2), hullMat);
    wing.position.set(sx * 0.68, 0.25, -0.4);
    wing.rotation.z = sx > 0 ? -0.14 : 0.14;
    group.add(wing);

    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.92, 2.8, 12), trimMat);
    pod.position.set(sx, 0.05, -0.5);
    group.add(pod);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.84, 0.09, 8, 14), cyanMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(sx, -1.25, -0.5);
    group.add(ring);

    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.65, 2.2, 10),
      new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.78 })
    );
    flame.rotation.x = Math.PI;
    flame.position.set(sx, -2.2, -0.5);
    group.add(flame);
  }

  // Belly AI drop bay emitter
  const bay = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.22, 4.0), glowMat);
  bay.position.set(0, -0.98, 0);
  group.add(bay);

  return group;
}

export function buildRuinedVehicleWreck(
  armorMat: THREE.Material,
  darkIron: THREE.Material,
  rustMat: THREE.Material
): THREE.Group {
  const g = new THREE.Group();
  // Sloped futuristic armored APC hull
  const hullGeo = makeBeveledExtrude(
    [
      [-3.2, 0.55],
      [3.1, 0.55],
      [3.5, 1.35],
      [2.2, 2.05],
      [-2.6, 2.05],
      [-3.4, 1.3],
    ],
    3.4,
    0.12,
    0.12
  );
  const hull = new THREE.Mesh(hullGeo, armorMat);
  hull.castShadow = true;
  hull.receiveShadow = true;
  g.add(hull);

  // Blown-open angled turret + smoking barrel
  const turret = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.45, 0.88, 8), rustMat);
  turret.position.set(-0.4, 2.45, 0);
  turret.rotation.y = 0.4;
  turret.rotation.z = -0.09;
  turret.castShadow = true;
  g.add(turret);

  const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 3.6, 10), darkIron);
  cannon.rotation.z = Math.PI / 2 - 0.24;
  cannon.position.set(1.8, 2.85, 0.25);
  g.add(cannon);

  // Armored wheel pods with treads
  for (const wx of [-2.2, 0, 2.2]) {
    for (const wz of [-1.75, 1.75]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.44, 12), darkIron);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, 0.62, wz);
      g.add(wheel);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.48, 8), rustMat);
      hub.rotation.x = Math.PI / 2;
      hub.position.set(wx, 0.62, wz);
      g.add(hub);
    }
  }
  return g;
}

export interface DefenseTurretRig {
  root: THREE.Group;
  head: THREE.Group;
  statusMat: THREE.MeshBasicMaterial;
  beaconRing: THREE.Mesh;
}

/**
 * Hackable Ghost-9 Automated Dual-Barrel Defense Turret.
 * Starts offline (amber lock), flips to glowing electric teal when hacked by the player [F].
 */
export function buildDefenseTurretModel(
  armorMat: THREE.Material,
  darkIron: THREE.Material
): DefenseTurretRig {
  const root = new THREE.Group();

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.25, 1.05, 8), armorMat);
  base.position.y = 0.52;
  base.castShadow = true;
  base.receiveShadow = true;
  root.add(base);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.48, 0.55, 8), darkIron);
  neck.position.y = 1.28;
  root.add(neck);

  const head = new THREE.Group();
  head.position.y = 1.72;

  const pod = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.58, 1.15), armorMat);
  pod.castShadow = true;
  head.add(pod);

  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xb6c0d0, roughness: 0.2, metalness: 0.94 });
  for (const sx of [-0.26, 0.26]) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 1.35, 8), chromeMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(sx, 0.02, 0.92);
    head.add(barrel);
  }

  const statusMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.12), statusMat);
  visor.position.set(0, 0.16, 0.56);
  head.add(visor);

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.72, 6), chromeMat);
  antenna.position.set(-0.36, 0.6, -0.32);
  head.add(antenna);
  const beaconTip = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), statusMat);
  beaconTip.position.set(-0.36, 0.98, -0.32);
  head.add(beaconTip);

  root.add(head);

  const beaconRing = new THREE.Mesh(
    new THREE.RingGeometry(1.5, 1.78, 24),
    new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    })
  );
  beaconRing.rotation.x = -Math.PI / 2;
  beaconRing.position.y = 0.05;
  root.add(beaconRing);

  return { root, head, statusMat, beaconRing };
}

/**
 * Valkyrie UNS Arclight Tactical Orbital Supply Drop Pod with green rescue signal pillar.
 */
export function buildSupplyPodModel(
  armorMat: THREE.Material,
  darkIron: THREE.Material
): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.92, 1.85, 6), armorMat);
  body.position.y = 0.94;
  body.castShadow = true;
  g.add(body);

  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.55, 6), darkIron);
  cap.position.y = 2.12;
  g.add(cap);

  const emeraldGlow = new THREE.MeshBasicMaterial({ color: 0x34d399 });
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.2, 0.14), emeraldGlow);
    strip.position.set(Math.cos(ang) * 0.78, 0.95, Math.sin(ang) * 0.78);
    g.add(strip);
  }

  const flare = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.52, 14, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  flare.position.y = 7.0;
  g.add(flare);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.15, 1.48, 20),
    new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  g.add(ring);

  return g;
}

/**
 * Ambient cyberpunk megacity aerial patrol flyer (Blade Runner / GTA traffic atmosphere).
 */
export function buildCityFlyerModel(accentHex: number): THREE.Group {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x161c28, roughness: 0.35, metalness: 0.86 });
  const accentMat = new THREE.MeshBasicMaterial({ color: accentHex });
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xf4f8ff });

  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 4.2), hullMat);
  g.add(hull);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.32, 1.7), accentMat);
  canopy.position.set(0, 0.28, 0.4);
  g.add(canopy);
  for (const sx of [-0.62, 0.62]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.15), headlightMat);
    head.position.set(sx, -0.05, 2.12);
    g.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.16), accentMat);
    tail.position.set(sx, -0.02, -2.14);
    g.add(tail);
  }
  // Soft volumetric searchlight cone pointing downward
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(2.6, 15, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color: accentHex,
      transparent: true,
      opacity: 0.055,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  cone.position.set(0, -7.8, 1.4);
  cone.rotation.x = 0.22;
  g.add(cone);

  return g;
}

/**
 * Valkyrie UNS Arclight Friendly Rescue / Orbital Gunship (Emerald-Cyan markings & blue thrusters).
 */
export function buildRescueShuttleModel(): THREE.Group {
  const group = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x263140, roughness: 0.3, metalness: 0.85 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.35, metalness: 0.72 });
  const cyanMat = new THREE.MeshBasicMaterial({ color: 0x38e8ff });
  const emeraldMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });

  const fuselageGeo = makeBeveledExtrude(
    [
      [-2.0, -0.85],
      [2.0, -0.85],
      [2.35, 0.12],
      [1.35, 1.05],
      [-1.35, 1.05],
      [-2.35, 0.12],
    ],
    8.2,
    0.15,
    0.15
  );
  group.add(new THREE.Mesh(fuselageGeo, hullMat));

  const nose = new THREE.Mesh(new THREE.ConeGeometry(2.0, 3.4, 6), trimMat);
  nose.rotation.x = Math.PI / 2;
  nose.scale.set(1.08, 0.55, 1);
  nose.position.set(0, -0.05, 5.4);
  group.add(nose);

  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.36, 0.45), cyanMat);
  cockpit.position.set(0, 0.36, 4.5);
  group.add(cockpit);

  for (const sx of [-3.8, 3.8]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.3, 3.0), hullMat);
    wing.position.set(sx * 0.68, 0.25, -0.4);
    group.add(wing);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.33, 0.38), emeraldMat);
    stripe.position.set(sx * 0.68, 0.26, 0.2);
    group.add(stripe);

    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.92, 2.7, 12), trimMat);
    pod.position.set(sx, 0.05, -0.5);
    group.add(pod);

    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.68, 2.6, 10),
      new THREE.MeshBasicMaterial({
        color: 0x38e8ff,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    flame.rotation.x = Math.PI;
    flame.position.set(sx, -2.3, -0.5);
    group.add(flame);
  }

  return group;
}

export interface RokNavyLcacRig {
  group: THREE.Group;
  rampPivot: THREE.Group;
  fans: THREE.Object3D[];
}

/**
 * ROK Navy LCAC-655 Air-Cushion Assault Hovercraft ("대한민국해군 655" — Image 3 homage!).
 * Features black air-cushion skirt, armored well-deck walls, twin shrouded ducted turbofans,
 * painted ROK Navy hull markings, and an animated front assault ramp.
 */
export function buildRokNavyLcacHovercraft(): RokNavyLcacRig {
  const group = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({
    color: 0x677586,
    roughness: 0.54,
    metalness: 0.52,
    envMapIntensity: 1.05,
  });
  const deckMat = new THREE.MeshStandardMaterial({
    color: 0x454e5c,
    roughness: 0.76,
    metalness: 0.34,
    envMapIntensity: 0.85,
  });
  const skirtMat = new THREE.MeshStandardMaterial({
    color: 0x2e343e,
    roughness: 0.88,
    metalness: 0.08,
    envMapIntensity: 0.55,
  });
  const darkIron = new THREE.MeshStandardMaterial({
    color: 0x465162,
    roughness: 0.44,
    metalness: 0.72,
    envMapIntensity: 1.05,
  });

  // Painted "대한민국해군 · 655" hull side plate CanvasTexture
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = '#3b4550';
    g.fillRect(0, 0, 512, 128);
    g.fillStyle = 'rgba(20, 24, 30, 0.35)';
    for (let i = 0; i < 6; i++) {
      g.fillRect(i * 88, 0, 3, 128);
    }
    g.fillStyle = '#d8e0ea';
    g.font = 'bold 42px "Malgun Gothic", sans-serif';
    g.fillText('대한민국해군', 175, 78);
    g.fillStyle = '#eef3f8';
    g.font = '900 46px monospace';
    g.fillText('655', 38, 80);
  }
  const navyTex = new THREE.CanvasTexture(c);
  navyTex.colorSpace = THREE.SRGBColorSpace;
  const sideMarkMat = new THREE.MeshStandardMaterial({
    map: navyTex,
    roughness: 0.6,
    metalness: 0.45,
  });

  // Inflated black rubber air-cushion hover skirt
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.92, 14.2), skirtMat);
  skirt.position.set(0, 0.46, 0);
  group.add(skirt);

  // Armored well-deck floor (walkable landing deck)
  const deck = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.35, 13.4), deckMat);
  deck.position.set(0, 1.05, 0);
  group.add(deck);

  // Left & Right Armored Bulwark Sidewalls (keeping player & squad shielded during sea run-in!)
  for (const sx of [-3.6, 3.6]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.35, 12.6), sideMarkMat);
    wall.position.set(sx, 2.22, 0.2);
    group.add(wall);

    // Top deck rail & intake vents
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.48, 11.4), darkIron);
    rail.position.set(sx, 3.55, 0.2);
    group.add(rail);
  }

  // Starboard elevated command bridge cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.9, 3.8), hullMat);
  cabin.position.set(3.2, 4.1, -1.6);
  group.add(cabin);
  const cabinGlass = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.58, 0.14),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
  );
  cabinGlass.position.set(3.2, 4.35, -3.52);
  group.add(cabinGlass);

  // Radar mast + amber beacon
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 2.6, 8), darkIron);
  mast.position.set(3.2, 6.2, -1.4);
  group.add(mast);
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff9b26 })
  );
  beacon.position.set(3.2, 7.55, -1.4);
  group.add(beacon);

  // Twin Shrouded Rear Ducted Turbofans (distinctive LCAC silhouette from Image 3!)
  const fans: THREE.Object3D[] = [];
  for (const fx of [-2.25, 2.25]) {
    const shroud = new THREE.Mesh(
      new THREE.CylinderGeometry(1.55, 1.55, 1.65, 18, 1, true),
      hullMat
    );
    shroud.rotation.x = Math.PI / 2;
    shroud.position.set(fx, 3.35, 5.8);
    group.add(shroud);

    const rotor = new THREE.Group();
    rotor.position.set(fx, 3.35, 5.8);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.6, 10), darkIron);
    hub.rotation.x = Math.PI / 2;
    rotor.add(hub);
    for (let b = 0; b < 6; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.65, 0.05), darkIron);
      blade.rotation.z = (b / 6) * Math.PI;
      rotor.add(blade);
    }
    group.add(rotor);
    fans.push(rotor);
  }

  // Animated Front Assault Ramp (pivots around bottom hinge at z = -6.7)
  const rampPivot = new THREE.Group();
  rampPivot.position.set(0, 1.12, -6.7);
  const rampPlate = new THREE.Mesh(new THREE.BoxGeometry(6.2, 2.8, 0.24), hullMat);
  rampPlate.position.set(0, 1.4, 0);
  rampPivot.add(rampPlate);
  // Yellow hazard chevron strip along ramp lip
  const hazard = new THREE.Mesh(
    new THREE.BoxGeometry(5.9, 0.22, 0.28),
    new THREE.MeshBasicMaterial({ color: 0xf5b342 })
  );
  hazard.position.set(0, 2.68, 0);
  rampPivot.add(hazard);
  group.add(rampPivot);

  return { group, rampPivot, fans };
}

export interface RokSquadmateRig {
  root: THREE.Group;
  torso: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  rightArm: THREE.Mesh;
  irStrobe: THREE.Mesh;
}

/**
 * Builds articulated ROK Special Forces squadmates (소재우 중사, 박현준 하사),
 * friendly rogue synth Ghost-9, or wounded civilian/scout survivor.
 */
export function buildRokSquadmateModel(
  role: 'sergeant' | 'corporal' | 'ghost9' | 'survivor',
  pbr?: ExtendedPbrLibrary,
  castShadow = true
): RokSquadmateRig {
  const root = new THREE.Group();

  const isGhost = role === 'ghost9';
  const isSurvivor = role === 'survivor';

  const uniformMat = new THREE.MeshStandardMaterial({
    color: isGhost ? 0x202b38 : isSurvivor ? 0x526072 : 0xb8c2ba,
    map: !isGhost && !isSurvivor && pbr ? pbr.rokCamo.map : null,
    normalMap: !isGhost && !isSurvivor && pbr ? pbr.rokCamo.normalMap : null,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: !isGhost && !isSurvivor && pbr ? pbr.rokCamo.roughnessMap : null,
    roughness: isGhost ? 0.42 : 0.9,
    metalness: isGhost ? 0.62 : 0.06,
    envMapIntensity: 0.4,
  });
  const vestMat = new THREE.MeshStandardMaterial({
    color: isGhost ? 0x121b28 : isSurvivor ? 0xb86614 : 0x272e26,
    normalMap: pbr ? pbr.kevlarGlove.normalMap : null,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughness: isGhost ? 0.36 : 0.84,
    metalness: isGhost ? 0.72 : 0.14,
    envMapIntensity: 0.45,
  });
  const helmetMat = new THREE.MeshStandardMaterial({
    color: isGhost ? 0x1b2430 : isSurvivor ? 0x9aa4b0 : 0x2d352a,
    roughness: 0.56,
    metalness: isGhost ? 0.72 : 0.22,
    envMapIntensity: 0.5,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x181a1e,
    roughness: 0.88,
    metalness: 0.08,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: isGhost ? 0x121820 : 0xa8826a,
    roughness: 0.82,
    metalness: 0.04,
  });
  const gunMat = new THREE.MeshStandardMaterial({
    color: 0x1a1e26,
    normalMap: pbr ? pbr.gunmetal.normalMap : null,
    roughness: 0.5,
    metalness: 0.76,
    envMapIntensity: 0.55,
  });

  // Hip-anchored tactical legs with knee pads & combat boots (ZERO pelvic detachment when running!)
  const buildLeg = (sx: number): THREE.Mesh => {
    const legGeo = new THREE.CylinderGeometry(0.105, 0.086, 0.78, 10);
    legGeo.translate(0, -0.39, 0);
    const leg = new THREE.Mesh(legGeo, uniformMat);
    leg.position.set(sx * 0.14, 0.80, 0);
    const kneePad = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.14, 0.11), vestMat);
    kneePad.position.set(0, -0.38, 0.07);
    leg.add(kneePad);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.14, 0.27), bootMat);
    boot.position.set(0, -0.73, 0.05);
    leg.add(boot);
    root.add(leg);
    return leg;
  };
  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);

  // Pelvis belt & sculpted MOLLE ballistic plate carrier torso + 3 chest mag pouches + hydration pack
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.26), vestMat);
  pelvis.position.set(0, 0.84, 0);
  root.add(pelvis);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.58, 0.30), vestMat);
  torso.position.set(0, 1.18, 0);
  root.add(torso);

  // Chest triple magazine pouches & rear tactical radio backpack
  for (const mx of [-0.12, 0, 0.12]) {
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.17, 0.08), uniformMat);
    pouch.position.set(mx, -0.05, 0.17);
    torso.add(pouch);
  }
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.16), uniformMat);
  pack.position.set(0, 0.02, -0.21);
  torso.add(pack);
  const radioAnt = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.44, 6), bootMat);
  radioAnt.position.set(-0.14, 0.36, -0.22);
  torso.add(radioAnt);

  // Head + FAST Ballistic Helmet + Dual-Tube NVG Mount + Tactical Goggles/Visor
  const headBase = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 10), skinMat);
  headBase.position.set(0, 1.63, 0);
  root.add(headBase);

  const helmetShell = new THREE.Mesh(
    new THREE.SphereGeometry(0.168, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
    helmetMat
  );
  helmetShell.position.set(0, 1.66, -0.01);
  root.add(helmetShell);

  if (!isSurvivor) {
    // Dual-tube night-vision shroud on helmet brow
    const nvgMount = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.055, 0.06), bootMat);
    nvgMount.position.set(0, 1.74, 0.145);
    root.add(nvgMount);
    for (const nx of [-0.036, 0.036]) {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.075, 8), bootMat);
      tube.rotation.x = Math.PI / 2 - 0.35;
      tube.position.set(nx, 1.74, 0.185);
      root.add(tube);
    }
  }

  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.068, 0.08),
    isGhost
      ? new THREE.MeshBasicMaterial({ color: 0x2dd4bf })
      : new THREE.MeshStandardMaterial({ color: 0x16222c, roughness: 0.2, metalness: 0.6 })
  );
  visor.position.set(0, 1.64, 0.13);
  root.add(visor);

  // Shoulder-anchored tactical arms + sculpted K-41 carbine with optic, barrel & magazine
  const lArmGeo = new THREE.CylinderGeometry(0.075, 0.064, 0.56, 10);
  lArmGeo.translate(0, -0.28, 0);
  const leftArm = new THREE.Mesh(lArmGeo, uniformMat);
  leftArm.position.set(-0.30, 1.40, 0.02);
  leftArm.rotation.x = -0.68;
  leftArm.rotation.z = -0.18;
  const lPauldron = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 8), vestMat);
  leftArm.add(lPauldron);
  root.add(leftArm);

  const rArmGeo = new THREE.CylinderGeometry(0.075, 0.064, 0.56, 10);
  rArmGeo.translate(0, -0.28, 0);
  const rightArm = new THREE.Mesh(rArmGeo, uniformMat);
  rightArm.position.set(0.30, 1.40, 0.04);
  rightArm.rotation.x = -0.82;
  const rPauldron = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 8), vestMat);
  rightArm.add(rPauldron);
  if (!isSurvivor) {
    const rifleGrp = new THREE.Group();
    rifleGrp.position.set(-0.08, -0.44, 0.22);
    rifleGrp.rotation.x = 0.82;
    const rec = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.10, 0.46), gunMat);
    rifleGrp.add(rec);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.44, 8), gunMat);
    bar.rotation.x = Math.PI / 2;
    bar.position.set(0, 0.018, 0.42);
    rifleGrp.add(bar);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.07), bootMat);
    mag.position.set(0, -0.11, 0.06);
    mag.rotation.x = 0.2;
    rifleGrp.add(mag);
    const opt = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.05, 0.11), bootMat);
    opt.position.set(0, 0.075, -0.02);
    rifleGrp.add(opt);
    rightArm.add(rifleGrp);
  }
  root.add(rightArm);

  // Subtle helmet-top IR Strobe Beacon (glows white-hot in AC-130 FLIR thermal camera!)
  const irStrobe = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 8, 8),
    new THREE.MeshBasicMaterial({
      color: isGhost ? 0x2dd4bf : 0xe0f2fe,
    })
  );
  irStrobe.position.set(0, 1.86, -0.02);
  root.add(irStrobe);

  // Enable real shadow casting on all ROK soldier meshes
  if (castShadow) {
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj !== irStrobe) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
  }

  return { root, torso, leftLeg, rightLeg, rightArm, irStrobe };
}
