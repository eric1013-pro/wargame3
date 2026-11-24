import * as THREE from 'three';
import { BodyPart, Faction, UnitArchetype } from './types';
import { FACTION_META } from './rules';
import { ProceduralTextureSet } from './textures';

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
 * Builds articulated armored human exo-suit forearms & tactical gloved hands gripping the weapon.
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
  // Right trigger hand + angled tactical exo-forearm
  const rGroup = new THREE.Group();
  rGroup.position.set(...rightHandPos);
  const rPalm = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.064, 0.088), gloveMat);
  rGroup.add(rPalm);
  const rKnuckle = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.022, 0.044), suitArmor);
  rKnuckle.position.set(0, 0.028, -0.022);
  rGroup.add(rKnuckle);
  const rCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.052, 0.07, 10), suitArmor);
  rCuff.rotation.x = Math.PI / 2 + 0.25;
  rCuff.position.set(0.012, -0.025, 0.095);
  rGroup.add(rCuff);
  const rSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.064, 0.36, 10), suitSleeve);
  rSleeve.rotation.x = Math.PI / 2 + 0.28;
  rSleeve.rotation.z = -0.14;
  rSleeve.position.set(0.055, -0.095, 0.28);
  rGroup.add(rSleeve);
  const rBiometricLed = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.008, 0.045), accentMat);
  rBiometricLed.position.set(-0.042, 0.018, 0.095);
  rGroup.add(rBiometricLed);
  parent.add(rGroup);

  // Left support hand cradling forend + wrist armor plate
  const lGroup = new THREE.Group();
  lGroup.position.set(...leftHandPos);
  const lPalm = new THREE.Mesh(new THREE.BoxGeometry(0.076, 0.056, 0.095), gloveMat);
  lGroup.add(lPalm);
  const lGuard = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.02, 0.058), suitArmor);
  lGuard.position.set(-0.012, -0.022, 0.01);
  lGroup.add(lGuard);
  const lForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.062, 0.42, 10), suitSleeve);
  lForearm.rotation.x = Math.PI / 2 + 0.22;
  lForearm.rotation.z = 0.42;
  lForearm.position.set(-0.14, -0.09, 0.22);
  lGroup.add(lForearm);
  const lWristPlate = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.024, 0.095), suitArmor);
  lWristPlate.position.set(-0.065, -0.02, 0.09);
  lWristPlate.rotation.y = 0.35;
  lGroup.add(lWristPlate);
  const lVitalStrip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.007, 0.045), accentMat);
  lVitalStrip.position.set(-0.065, -0.004, 0.09);
  lVitalStrip.rotation.y = 0.35;
  lGroup.add(lVitalStrip);
  parent.add(lGroup);
  return lGroup;
}

/**
 * Builds high-craft sculpted 1st-person weapon viewmodels (14–22 composite parts per weapon)
 * with beveled receivers, fluted barrels, Picatinny rails, holographic reticle glass, cables & armored hands.
 */
export function buildViewmodelRig(
  camera: THREE.Camera,
  textures?: ProceduralTextureSet
): ViewmodelRig {
  const pivot = new THREE.Group();
  camera.add(pivot);

  const gunmetal = new THREE.MeshStandardMaterial({
    color: 0x3b4250,
    bumpMap: textures?.gunmetalBump,
    bumpScale: 0.012,
    roughness: 0.28,
    metalness: 0.9,
  });
  const darkTitanium = new THREE.MeshStandardMaterial({
    color: 0x1c2029,
    bumpMap: textures?.gunmetalBump,
    bumpScale: 0.01,
    roughness: 0.38,
    metalness: 0.84,
  });
  const polymer = new THREE.MeshStandardMaterial({
    color: 0x15171d,
    roughness: 0.78,
    metalness: 0.16,
  });
  const chrome = new THREE.MeshStandardMaterial({
    color: 0xb6c0d0,
    roughness: 0.14,
    metalness: 0.98,
  });
  const brass = new THREE.MeshStandardMaterial({
    color: 0xd4a442,
    roughness: 0.24,
    metalness: 0.92,
  });
  const hazardOrange = new THREE.MeshStandardMaterial({
    color: 0xd9531e,
    roughness: 0.42,
    metalness: 0.45,
  });
  const militaryOlive = new THREE.MeshStandardMaterial({
    color: 0x364334,
    bumpMap: textures?.armorPlateBump,
    bumpScale: 0.015,
    roughness: 0.62,
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
    color: 0x2e3440,
    bumpMap: textures?.gunmetalBump,
    bumpScale: 0.014,
    roughness: 0.36,
    metalness: 0.78,
  });
  const suitSleeve = new THREE.MeshStandardMaterial({
    color: 0x1c1e24,
    roughness: 0.85,
    metalness: 0.12,
  });
  const gloveMat = new THREE.MeshStandardMaterial({
    color: 0x121318,
    roughness: 0.9,
    metalness: 0.08,
  });
  const cyanGlow = new THREE.MeshBasicMaterial({ color: 0x38e8ff });
  const amberGlow = new THREE.MeshBasicMaterial({ color: 0xffa62b });
  const emeraldGlow = new THREE.MeshBasicMaterial({ color: 0x34d399 });
  const crimsonGlow = new THREE.MeshBasicMaterial({ color: 0xff2a4b });
  const holoGlass = new THREE.MeshPhysicalMaterial({
    color: 0x5be4ff,
    roughness: 0.08,
    metalness: 0.1,
    transparent: true,
    opacity: 0.22,
    clearcoat: 1.0,
    depthWrite: false,
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

  // Sculpted Holographic Optic Housing + Real Glass Lens + Projected Reticle
  const holoGroup0 = new THREE.Group();
  holoGroup0.position.set(0, 0.118, 0.02);
  const holoFoot = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.024, 0.118), darkTitanium);
  holoFoot.position.y = -0.03;
  holoGroup0.add(holoFoot);
  const holoHoodGeo = makeBeveledExtrude(
    [
      [-0.042, -0.024],
      [-0.034, 0.036],
      [0.034, 0.036],
      [0.042, -0.024],
      [0.03, -0.024],
      [0.025, 0.024],
      [-0.025, 0.024],
      [-0.03, -0.024],
    ],
    0.09,
    0.004,
    0.004
  );
  holoGroup0.add(new THREE.Mesh(holoHoodGeo, gunmetal));
  const holoLens = new THREE.Mesh(new THREE.PlaneGeometry(0.056, 0.046), holoGlass);
  holoLens.position.set(0, 0.004, 0);
  holoGroup0.add(holoLens);
  if (textures?.holoReticleMap) {
    const retMat = new THREE.MeshBasicMaterial({
      map: textures.holoReticleMap,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const retMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.042, 0.042), retMat);
    retMesh.position.set(0, 0.004, 0.002);
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
  // Long-range cyber optical scope
  const scope2 = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.032, 0.34, 12), gunmetal);
  scope2.rotation.x = Math.PI / 2;
  scope2.position.set(0, 0.128, -0.05);
  g2.add(scope2);
  const scopeGlass2 = new THREE.Mesh(new THREE.CircleGeometry(0.029, 12), holoGlass);
  scopeGlass2.position.set(0, 0.128, 0.122);
  g2.add(scopeGlass2);
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
    muzzleFlash,
    blade,
  };
}

export interface EnemyRig {
  root: THREE.Group;
  parts: Partial<Record<BodyPart, THREE.Mesh>>;
  mats: THREE.MeshStandardMaterial[];
  gatlingBarrel?: THREE.Object3D;
  sawBlade?: THREE.Object3D;
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
    // ARTICULATED HYDRAULIC ARMS + CYBERNETIC WEAPONS
    // =========================================================================
    const buildArm = (sx: number, part: BodyPart, zOff: number): THREE.Mesh => {
      const arm = makePart(
        part,
        new THREE.CylinderGeometry(0.1 * s, 0.085 * s, 0.66 * s, 8),
        limbMat,
        sx * (torsoW * 0.64 + 0.1) * s,
        0.0 * s,
        zOff * s,
        torso
      );
      const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.1 * s, 8, 8), chromeJointMat);
      elbow.position.y = -0.02 * s;
      tagSub(elbow, part);
      arm.add(elbow);
      const gauntlet = new THREE.Mesh(
        new THREE.CylinderGeometry(0.115 * s, 0.095 * s, 0.28 * s, 6),
        armorMat
      );
      gauntlet.position.y = -0.2 * s;
      tagSub(gauntlet, part);
      arm.add(gauntlet);
      return arm;
    };

    buildArm(-1, 'leftArm', 0.08);
    const rArm = buildArm(1, 'rightArm', 0.16);

    if (isBoss) {
      // OMNI-TITAN 6-barrel rotary plasma cannon + glowing chest reactor + 3 beveled armor plates
      const gatling = new THREE.Group();
      gatling.position.set(0, -0.14 * s, 0.56 * s);
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
      // Detailed composite AI plasma/ballistic carbine held by right arm
      const gunLen = archetype === UnitArchetype.SYNDICATE_HEAVY ? 0.88 : 0.68;
      const gunGroup = new THREE.Group();
      gunGroup.position.set(0, -0.18 * s, 0.38 * s);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.1 * s, 0.13 * s, gunLen * s), darkIron);
      gunGroup.add(body);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.026 * s, 0.026 * s, gunLen * 0.6 * s, 8), chromeJointMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.03 * s, gunLen * 0.45 * s);
      gunGroup.add(barrel);
      const muzzleGlow = new THREE.Mesh(new THREE.BoxGeometry(0.032 * s, 0.028 * s, gunLen * 0.55 * s), visorMat);
      muzzleGlow.position.set(0, 0.055 * s, 0.05 * s);
      gunGroup.add(muzzleGlow);
      tagSub(gunGroup, 'rightArm');
      rArm.add(gunGroup);
    }

    // =========================================================================
    // ARTICULATED BIPEDAL HYDRAULIC LEGS (Thigh armor + knee joint + armored shin + clawed mech foot)
    // =========================================================================
    for (const sx of [-1, 1]) {
      const legPart: BodyPart = sx < 0 ? 'leftLeg' : 'rightLeg';
      const leg = makePart(
        legPart,
        new THREE.CylinderGeometry(0.115 * s, 0.095 * s, 0.82 * s, 8),
        limbMat,
        sx * 0.21 * s,
        0.41 * s,
        0,
        root
      );
      const knee = new THREE.Mesh(new THREE.SphereGeometry(0.115 * s, 8, 8), chromeJointMat);
      knee.position.set(0, 0.04 * s, 0.06 * s);
      tagSub(knee, legPart);
      leg.add(knee);
      const shinGuard = new THREE.Mesh(
        new THREE.BoxGeometry(0.18 * s, 0.38 * s, 0.16 * s),
        armorMat
      );
      shinGuard.position.set(0, -0.16 * s, 0.06 * s);
      tagSub(shinGuard, legPart);
      leg.add(shinGuard);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.22 * s, 0.11 * s, 0.34 * s), darkIron);
      foot.position.set(0, -0.37 * s, 0.08 * s);
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
    gatlingBarrel,
    sawBlade,
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
