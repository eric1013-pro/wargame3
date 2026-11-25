import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

/**
 * Generates 8 high-poly binary glTF 2.0 (.glb) 3D assets into wargame3/src/assets/models/:
 * - m41x_rifle.glb     : ROK Special Forces K-41X ("필승") w/ suppressor, 18-slot Picatinny, brass 5.56mm rounds & gloved hands
 * - doom99_shotgun.glb : Tactical combat shotgun w/ vented heatshield, ribbed pump forend, ghost-ring sight & shell saddle
 * - railx9_sniper.glb  : Twin-rail electromagnetic sniper rifle w/ hollow open-ended 2.8x scope & gloved hands
 * - hydra7_rocket.glb  : Heavy guided anti-armor launcher w/ venturi blast cone, blast shield & ballistic prism optic
 * - zeusmk7_tesla.glb  : High-voltage arc cannon w/ copper induction coils, capacitor core & prism sight
 * - k808_apc.glb       : ROK K-808 8x8 wheeled APC w/ sloped armor hull, 8 hubbed tires & 30mm RWS turret
 * - korean_sedan.glb   : Sculpted war-damaged Korean 4-door street sedan w/ sloped hood, raked cabin, glass, grille & alloy wheels
 * - sandbag_bunker.glb : Organic staggered 3-tier sandbag breastwork w/ slumped burlap bags, wooden stakes & earthen base
 */

// Minimal Node polyfill for FileReader used by GLTFExporter when writing binary GLB
if (typeof globalThis.FileReader === 'undefined') {
  class NodeFileReader {
    public result: ArrayBuffer | null = null;
    public onloadend: (() => void) | null = null;
    public readAsArrayBuffer(blob: Blob): void {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        this.onloadend?.();
      });
    }
  }
  (globalThis as unknown as Record<string, unknown>).FileReader = NodeFileReader;
}

function makeBeveledExtrude(
  points: Array<[number, number]>,
  depth: number,
  bevelSize = 0.006,
  bevelThickness = 0.006
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
    bevelSegments: 3,
    steps: 1,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

function createNamedMats() {
  const mat = (name: string, color: number, roughness: number, metalness: number) => {
    const m = new THREE.MeshStandardMaterial({ name, color, roughness, metalness });
    return m;
  };
  return {
    rokReceiver: mat('rok_receiver', 0x20242c, 0.52, 0.72),
    gunmetal: mat('gunmetal', 0x2a303a, 0.48, 0.76),
    darkSteel: mat('dark_steel', 0x171b22, 0.56, 0.72),
    polymer: mat('polymer', 0x15181e, 0.82, 0.12),
    chrome: mat('chrome', 0x9aa6b4, 0.28, 0.88),
    brass: mat('brass', 0xd6a542, 0.26, 0.9),
    copperTip: mat('copper_tip', 0xc96a34, 0.28, 0.88),
    kevlarGlove: mat('kevlar_glove', 0x171a21, 0.88, 0.08),
    knuckleCarbon: mat('knuckle_carbon', 0x242a34, 0.48, 0.45),
    suitSleeve: mat('suit_sleeve', 0x2a302d, 0.9, 0.05),
    sedanBody: mat('sedan_body', 0x525a64, 0.48, 0.52),
    sedanGlass: mat('sedan_glass', 0x141c24, 0.18, 0.35),
    sedanTrim: mat('sedan_trim', 0x181a1f, 0.78, 0.2),
    sedanHeadlight: mat('sedan_headlight', 0xc8d0d8, 0.22, 0.25),
    sedanTaillight: mat('sedan_taillight', 0x6b141a, 0.28, 0.2),
    sandbagBurlap: mat('sandbag_burlap', 0x7a6d56, 0.94, 0.04),
    woodStake: mat('wood_stake', 0x3f3122, 0.92, 0.04),
    earthMound: mat('earth_mound', 0x2a2723, 0.96, 0.03),
    oliveLauncher: mat('olive_launcher', 0x3b4432, 0.68, 0.32),
    shotgunShell: mat('shotgun_shell', 0x8f1d24, 0.52, 0.15),
    charArmor: mat('char_armor', 0x3a4350, 0.52, 0.58),
    charFabric: mat('char_fabric', 0x2c323a, 0.9, 0.06),
    charPlate: mat('char_plate', 0x242a34, 0.44, 0.68),
    charVisor: mat('char_visor', 0x38d9ff, 0.12, 0.2),
    opticGlass: new THREE.MeshStandardMaterial({
      name: 'optic_glass',
      color: 0xdff6ff,
      transparent: true,
      opacity: 0.025,
      roughness: 0.05,
      metalness: 0.05,
      side: THREE.DoubleSide,
    }),
    opticReticle: new THREE.MeshStandardMaterial({
      name: 'optic_reticle',
      color: 0xffffff,
      transparent: true,
      opacity: 0.94,
      side: THREE.DoubleSide,
    }),
    scopeInner: new THREE.MeshStandardMaterial({
      name: 'scope_inner',
      color: 0x0b0e14,
      roughness: 0.72,
      metalness: 0.55,
      side: THREE.DoubleSide,
    }),
    cyanAccent: mat('cyan_accent', 0x26b9d9, 0.25, 0.5),
    crimsonAccent: mat('crimson_accent', 0xd92644, 0.25, 0.5),
    k808Armor: mat('k808_armor', 0x3b4435, 0.56, 0.42),
    tireRubber: mat('tire_rubber', 0x15171b, 0.92, 0.06),
  };
}

type NamedMats = ReturnType<typeof createNamedMats>;

/**
 * Sculpted Articulated 5-Finger Tactical Gloved Hands (Palm, Thumb, 4 Multi-Segment Fingers,
 * Carbon Knuckle Shell, Tactical Wrist Cuff & Watch, Padded Forearm Sleeve)
 */
function buildArticulatedGlovedHand(
  side: 'left' | 'right',
  mats: NamedMats
): THREE.Group {
  const hand = new THREE.Group();
  hand.name = side === 'left' ? 'LeftHand' : 'RightHand';
  const sign = side === 'left' ? -1 : 1;

  // Sculpted tapered palm
  const palmGeo = makeBeveledExtrude(
    [
      [-0.036, -0.026],
      [0.036, -0.026],
      [0.04, 0.024],
      [-0.038, 0.026],
    ],
    0.084,
    0.008,
    0.008
  );
  const palm = new THREE.Mesh(palmGeo, mats.kevlarGlove);
  hand.add(palm);

  // Molded carbon-fiber knuckle armor plate + 4 sculpted knuckle domes
  const knucklePlate = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.018, 0.028), mats.knuckleCarbon);
  knucklePlate.position.set(0, 0.028, -0.03);
  hand.add(knucklePlate);
  for (let i = 0; i < 4; i++) {
    const k = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), mats.knuckleCarbon);
    k.position.set(-0.026 + i * 0.0175, 0.031, -0.032);
    hand.add(k);
  }

  // 4 Articulated 2-segment fingers curling naturally around grip / handguard
  for (let i = 0; i < 4; i++) {
    const fx = -0.027 + i * 0.018;
    const isTriggerFinger = side === 'right' && i === 0;
    const fBase = new THREE.Group();
    fBase.position.set(fx, 0.014, -0.046);
    fBase.rotation.x = isTriggerFinger ? -0.35 : -0.95 - i * 0.06;

    const seg1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0082, 0.026, 6, 10), mats.kevlarGlove);
    seg1.rotation.x = Math.PI / 2;
    seg1.position.z = -0.018;
    fBase.add(seg1);

    const seg2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0074, 0.022, 6, 10), mats.kevlarGlove);
    seg2.rotation.x = Math.PI / 2 - (isTriggerFinger ? 0.5 : 1.05);
    seg2.position.set(0, -0.016, -0.036);
    fBase.add(seg2);

    hand.add(fBase);
  }

  // Opposable articulated thumb wrapping upper receiver / mag lip
  const thumb = new THREE.Group();
  thumb.position.set(-sign * 0.038, 0.012, -0.014);
  thumb.rotation.set(-0.22, sign * 0.42, sign * 0.45);
  const t1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0096, 0.028, 6, 10), mats.kevlarGlove);
  t1.rotation.x = Math.PI / 2;
  t1.position.z = -0.018;
  thumb.add(t1);
  const t2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0086, 0.022, 6, 10), mats.kevlarGlove);
  t2.rotation.x = Math.PI / 2 - 0.36;
  t2.position.set(0, -0.006, -0.039);
  thumb.add(t2);
  hand.add(thumb);

  // Velcro tactical wrist strap + matte steel chronograph watch on left wrist
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.058, 16), mats.knuckleCarbon);
  cuff.rotation.x = Math.PI / 2 + 0.18;
  cuff.position.set(sign * 0.01, -0.014, 0.078);
  hand.add(cuff);

  if (side === 'left') {
    const watchBody = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.021, 0.012, 14), mats.darkSteel);
    watchBody.position.set(0.006, 0.032, 0.076);
    hand.add(watchBody);
    const watchFace = new THREE.Mesh(new THREE.CircleGeometry(0.015, 14), mats.cyanAccent);
    watchFace.rotation.x = -Math.PI / 2;
    watchFace.position.set(0.006, 0.039, 0.076);
    hand.add(watchFace);
  }

  // Sculpted ROK Special Forces tactical combat sleeve w/ cloth folds & Velcro elbow strap
  const sleeveGroup = new THREE.Group();
  sleeveGroup.rotation.x = Math.PI / 2 + 0.24;
  sleeveGroup.rotation.z = side === 'left' ? 0.36 : -0.14;
  sleeveGroup.position.set(side === 'left' ? -0.115 : 0.045, -0.082, 0.255);
  const sleeveCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.047, 0.062, 0.39, 18, 6),
    mats.suitSleeve
  );
  // Subtle organic forearm fabric creases
  const sPos = sleeveCore.geometry.attributes.position;
  for (let i = 0; i < sPos.count; i++) {
    const sy = sPos.getY(i);
    const sx = sPos.getX(i);
    const sz = sPos.getZ(i);
    const ripple = 1 + Math.sin(sy * 34 + sx * 12) * 0.045;
    sPos.setXYZ(i, sx * ripple, sy, sz * ripple);
  }
  sleeveCore.geometry.computeVertexNormals();
  sleeveGroup.add(sleeveCore);
  for (const ry of [-0.14, -0.06, 0.04]) {
    const foldBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.052 + (ry + 0.14) * 0.035, 0.006, 8, 18),
      mats.kevlarGlove
    );
    foldBand.rotation.x = Math.PI / 2;
    foldBand.position.y = ry;
    sleeveGroup.add(foldBand);
  }
  hand.add(sleeveGroup);

  return hand;
}

/**
 * Builds high-poly ROK Special Forces K-41X ("필승") Rifle with Suppressor,
 * Exposed Twin Brass 5.56mm Cartridges in Magazine & Crystal-Clear Open Holo Optic.
 */
function buildHighPolyM41X(mats: NamedMats): THREE.Group {
  const root = new THREE.Group();
  root.name = 'M41X_Rifle_Root';

  // Sculpted upper & lower receiver ("필승" ROK engraving material!)
  const recGeo = makeBeveledExtrude(
    [
      [-0.24, -0.056],
      [0.26, -0.056],
      [0.32, -0.015],
      [0.30, 0.060],
      [-0.20, 0.064],
      [-0.27, 0.026],
    ],
    0.084,
    0.009,
    0.009
  );
  recGeo.rotateY(Math.PI / 2);
  const receiver = new THREE.Mesh(recGeo, mats.rokReceiver);
  receiver.name = 'ReceiverMain';
  receiver.position.set(0, 0, -0.04);
  root.add(receiver);

  // Sculpted cheek/stock extension + rear takedown pin + rotary selector dial
  const stockBridge = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.26, 14), mats.darkSteel);
  stockBridge.rotation.x = Math.PI / 2;
  stockBridge.position.set(0, 0.012, 0.31);
  root.add(stockBridge);

  const selectorDial = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 12), mats.gunmetal);
  selectorDial.rotation.z = Math.PI / 2;
  selectorDial.position.set(-0.049, -0.012, 0.09);
  root.add(selectorDial);
  const selectorLever = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.008, 0.028), mats.chrome);
  selectorLever.position.set(-0.053, -0.008, 0.08);
  selectorLever.rotation.x = 0.38;
  root.add(selectorLever);

  // Trigger guard & curved trigger
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.005, 8, 14, Math.PI), mats.darkSteel);
  guard.rotation.z = Math.PI;
  guard.rotation.y = Math.PI / 2;
  guard.position.set(0, -0.056, 0.068);
  root.add(guard);
  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.032, 0.01), mats.chrome);
  trigger.position.set(0, -0.068, 0.072);
  trigger.rotation.x = 0.26;
  root.add(trigger);

  // Upper machined rail spine + 18 crisp beveled Picatinny teeth
  const upperSpine = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.032, 0.62), mats.gunmetal);
  upperSpine.position.set(0, 0.058, -0.14);
  root.add(upperSpine);
  for (let i = 0; i < 18; i++) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.011, 0.018), mats.darkSteel);
    tooth.position.set(0, 0.078, 0.14 - i * 0.034);
    root.add(tooth);
  }

  // Octagonal M-LOK ventilated tactical handguard + side rails + heat slots
  const handguard = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.05, 0.38, 8), mats.gunmetal);
  handguard.rotation.x = Math.PI / 2;
  handguard.rotation.z = Math.PI / 8;
  handguard.position.set(0, 0.016, -0.44);
  root.add(handguard);
  for (let i = 0; i < 5; i++) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.098, 0.014, 0.028), mats.darkSteel);
    slot.position.set(0, 0.016, -0.30 - i * 0.066);
    root.add(slot);
  }

  // Fluted heavy barrel + gas block + tactical ribbed suppressor (CoD MWIII Han-86 silhouette!)
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.021, 0.34, 16), mats.darkSteel);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.016, -0.66);
  root.add(barrel);
  const gasTube = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.42, 10), mats.chrome);
  gasTube.rotation.x = Math.PI / 2;
  gasTube.position.set(0, 0.046, -0.46);
  root.add(gasTube);
  const suppressor = new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.029, 0.24, 20), mats.gunmetal);
  suppressor.rotation.x = Math.PI / 2;
  suppressor.position.set(0, 0.016, -0.88);
  root.add(suppressor);
  for (let i = 0; i < 4; i++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.030, 0.003, 8, 20), mats.darkSteel);
    band.position.set(0, 0.016, -0.79 - i * 0.056);
    root.add(band);
  }
  const bore = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 12), mats.scopeInner);
  bore.rotation.x = Math.PI / 2;
  bore.position.set(0, 0.016, -0.996);
  root.add(bore);

  // Brass ejection port & dust cover + bolt carrier face
  const boltCarrier = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.026, 0.092), mats.chrome);
  boltCarrier.position.set(0.048, 0.024, -0.05);
  root.add(boltCarrier);

  // Side PEQ-15 Tactical Laser Module + Pressure Switch + Angled Vertical Foregrip (MWIII silhouette!)
  const peq = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.024, 0.115), mats.polymer);
  peq.position.set(0.056, 0.02, -0.44);
  root.add(peq);
  const peqLens = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 10), mats.crimsonAccent);
  peqLens.rotation.x = Math.PI / 2;
  peqLens.position.set(0.056, 0.02, -0.50);
  root.add(peqLens);
  const pressurePad = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.008, 0.072), mats.polymer);
  pressurePad.position.set(0, 0.084, -0.36);
  root.add(pressurePad);
  const angledGrip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.088, 0.044), mats.polymer);
  angledGrip.position.set(0, -0.058, -0.41);
  angledGrip.rotation.x = -0.24;
  root.add(angledGrip);
  // Flip-up backup iron sight behind suppressor
  const frontPost = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.032, 0.024), mats.darkSteel);
  frontPost.position.set(0, 0.088, -0.60);
  root.add(frontPost);

  // Articulated Left-Side Knurled Charging Handle (animated on chambering)
  const chargingHandle = new THREE.Group();
  chargingHandle.name = 'ChargingHandle';
  chargingHandle.position.set(-0.054, 0.046, -0.15);
  const chArm = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.012, 0.016), mats.chrome);
  chArm.position.x = -0.014;
  chargingHandle.add(chArm);
  const chKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.026, 12), mats.darkSteel);
  chKnob.rotation.z = Math.PI / 2;
  chKnob.position.x = -0.032;
  chargingHandle.add(chKnob);
  root.add(chargingHandle);

  // DETACHABLE CURVED STANAG MAGAZINE WITH EXPOSED TWIN BRASS 5.56MM CARTRIDGES INSIDE FEED LIPS!!
  const mag = new THREE.Group();
  mag.name = 'Magazine';
  mag.position.set(0, -0.14, -0.09);
  mag.rotation.x = 0.24;

  const magGeo = makeBeveledExtrude(
    [
      [-0.044, -0.105],
      [0.044, -0.105],
      [0.048, 0.102],
      [-0.046, 0.102],
    ],
    0.048,
    0.004,
    0.004
  );
  magGeo.rotateY(Math.PI / 2);
  mag.add(new THREE.Mesh(magGeo, mats.gunmetal));

  // Magazine waffle ribs & rubber pull-tab floorplate
  for (let r = 0; r < 4; r++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.012, 0.088), mats.darkSteel);
    rib.position.set(0, -0.068 + r * 0.042, 0);
    mag.add(rib);
  }
  const basePlate = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.022, 0.102), mats.polymer);
  basePlate.position.y = -0.112;
  mag.add(basePlate);

  // Exposed feed lips + Twin gleaming 5.56mm brass casings & copper-jacketed spire-point bullets!
  for (const sx of [-0.011, 0.011]) {
    const casing = new THREE.Mesh(new THREE.CylinderGeometry(0.0072, 0.0076, 0.054, 12), mats.brass);
    casing.rotation.x = Math.PI / 2;
    casing.position.set(sx, 0.108 + (sx > 0 ? 0.004 : 0), 0.004);
    mag.add(casing);

    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.007, 0.028, 12), mats.copperTip);
    tip.rotation.x = -Math.PI / 2;
    tip.position.set(sx, 0.108 + (sx > 0 ? 0.004 : 0), -0.036);
    mag.add(tip);
  }
  root.add(mag);

  // Ergonomic textured pistol grip & angled foregrip
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.15, 0.066), mats.polymer);
  grip.position.set(0, -0.11, 0.13);
  grip.rotation.x = -0.32;
  root.add(grip);
  const foregrip = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.022, 0.105, 12), mats.polymer);
  foregrip.position.set(0, -0.072, -0.38);
  foregrip.rotation.x = 0.24;
  root.add(foregrip);

  // Crystal-Clear Open Reflex Holographic Sight centered at exact y = +0.124
  const holo = new THREE.Group();
  holo.position.set(0, 0.124, 0.01);
  const hFoot = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.018, 0.114), mats.darkSteel);
  hFoot.position.y = -0.036;
  holo.add(hFoot);
  const hHoodGeo = makeBeveledExtrude(
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
  holo.add(new THREE.Mesh(hHoodGeo, mats.gunmetal));
  holo.add(new THREE.Mesh(new THREE.PlaneGeometry(0.068, 0.056), mats.opticGlass));
  const retPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.036, 0.036), mats.opticReticle);
  retPlane.name = 'HoloReticle';
  retPlane.position.z = -0.006;
  holo.add(retPlane);
  root.add(holo);

  // Articulated 5-Finger Tactical Gloved Hands
  const rightHand = buildArticulatedGlovedHand('right', mats);
  rightHand.position.set(0.012, -0.106, 0.138);
  root.add(rightHand);

  const leftHand = buildArticulatedGlovedHand('left', mats);
  leftHand.position.set(-0.028, -0.078, -0.37);
  root.add(leftHand);

  return root;
}

/**
 * Builds high-poly RAIL-X9 Electromagnetic Anti-Materiel Sniper Rifle with
 * genuinely hollow open-ended 2.8x sniper scope, turrets, bipod & 5-finger gloved hands.
 */
function buildHighPolyRailX9(mats: NamedMats): THREE.Group {
  const root = new THREE.Group();
  root.name = 'RAILX9_Sniper_Root';

  const recGeo = makeBeveledExtrude(
    [
      [-0.25, -0.065],
      [0.24, -0.065],
      [0.28, 0.01],
      [0.20, 0.072],
      [-0.22, 0.072],
    ],
    0.114,
    0.011,
    0.011
  );
  recGeo.rotateY(Math.PI / 2);
  root.add(new THREE.Mesh(recGeo, mats.rokReceiver));

  // Twin chamfered magnetic rails + recessed cyan accelerator channels
  for (const sx of [-0.052, 0.052]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.056, 0.88), mats.gunmetal);
    rail.position.set(sx, 0.022, -0.55);
    root.add(rail);
    const channel = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.012, 0.8), mats.cyanAccent);
    channel.position.set(sx > 0 ? sx - 0.016 : sx + 0.016, 0.022, -0.55);
    root.add(channel);
  }
  const plasmaCore = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.82, 14), mats.cyanAccent);
  plasmaCore.name = 'RailPlasmaCore';
  plasmaCore.rotation.x = Math.PI / 2;
  plasmaCore.position.set(0, 0.022, -0.54);
  root.add(plasmaCore);

  for (let i = 0; i < 4; i++) {
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.011, 10, 20), mats.chrome);
    coil.position.set(0, 0.022, -0.26 - i * 0.19);
    root.add(coil);
  }

  // Folded precision bipod legs beneath handguard
  for (const sx of [-0.058, 0.058]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.28, 10), mats.darkSteel);
    leg.rotation.x = Math.PI / 2 + 0.08;
    leg.position.set(sx, -0.052, -0.56);
    root.add(leg);
  }

  // Braided curved power hoses
  for (const sx of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx * 0.068, -0.02, -0.02),
      new THREE.Vector3(sx * 0.095, -0.055, -0.22),
      new THREE.Vector3(sx * 0.064, 0.01, -0.44),
    ]);
    root.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.01, 8, false), mats.polymer));
  }

  // GENUINE HOLLOW OPEN-ENDED 2.8x SNIPER SCOPE centered at exact y = +0.132
  const scope = new THREE.Group();
  scope.position.set(0, 0.132, -0.06);
  for (const mz of [-0.075, 0.055]) {
    const mount = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.042, 0.024), mats.darkSteel);
    mount.position.set(0, -0.046, mz);
    scope.add(mount);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.006, 10, 24), mats.darkSteel);
    ring.position.set(0, 0, mz);
    scope.add(ring);
  }
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.039, 0.28, 28, 1, true), mats.scopeInner);
  tube.rotation.x = Math.PI / 2;
  scope.add(tube);
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.049, 0.043, 0.08, 28, 1, true), mats.scopeInner);
  bell.rotation.x = Math.PI / 2;
  bell.position.z = -0.175;
  scope.add(bell);
  const rearBezel = new THREE.Mesh(new THREE.TorusGeometry(0.040, 0.0055, 10, 28), mats.gunmetal);
  rearBezel.position.z = 0.14;
  scope.add(rearBezel);
  const frontBezel = new THREE.Mesh(new THREE.TorusGeometry(0.049, 0.005, 10, 28), mats.gunmetal);
  frontBezel.position.z = -0.214;
  scope.add(frontBezel);
  const elev = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.014, 0.024, 14), mats.chrome);
  elev.position.set(0, 0.052, -0.01);
  scope.add(elev);
  const wind = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.012, 0.022, 14), mats.chrome);
  wind.rotation.z = Math.PI / 2;
  wind.position.set(0.05, 0, -0.01);
  scope.add(wind);

  const rearGlass = new THREE.Mesh(new THREE.CircleGeometry(0.037, 24), mats.opticGlass);
  rearGlass.position.z = 0.132;
  scope.add(rearGlass);
  const frontGlass = new THREE.Mesh(new THREE.CircleGeometry(0.045, 24), mats.opticGlass);
  frontGlass.position.z = -0.205;
  scope.add(frontGlass);
  const retPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.07), mats.opticReticle);
  retPlane.name = 'SniperReticle';
  retPlane.position.z = 0.01;
  scope.add(retPlane);
  root.add(scope);

  // Detachable high-density capacitor cell magazine
  const cell = new THREE.Group();
  cell.name = 'Magazine';
  cell.position.set(0, -0.13, -0.08);
  cell.add(new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.14, 0.11), mats.gunmetal));
  const cellGlow = new THREE.Mesh(new THREE.BoxGeometry(0.076, 0.08, 0.024), mats.cyanAccent);
  cellGlow.position.z = -0.02;
  cell.add(cellGlow);
  root.add(cell);

  const rightHand = buildArticulatedGlovedHand('right', mats);
  rightHand.position.set(0.016, -0.11, 0.15);
  root.add(rightHand);
  const leftHand = buildArticulatedGlovedHand('left', mats);
  leftHand.position.set(-0.028, -0.08, -0.36);
  root.add(leftHand);

  return root;
}

/**
 * Builds high-poly ROK K-808 8x8 Wheeled Armored Personnel Carrier (차륜형 장갑차)
 */
function buildHighPolyK808Apc(mats: NamedMats): THREE.Group {
  const root = new THREE.Group();
  root.name = 'K808_APC_Root';

  // Sloped faceted main armored hull
  const hullGeo = makeBeveledExtrude(
    [
      [-3.5, 0.72],
      [3.3, 0.72],
      [3.75, 1.38],
      [2.65, 2.22],
      [-2.85, 2.26],
      [-3.6, 1.48],
    ],
    2.65,
    0.08,
    0.08
  );
  const hull = new THREE.Mesh(hullGeo, mats.k808Armor);
  root.add(hull);

  // Sloped front glacis armor & vision slits
  const glacis = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.18, 2.2), mats.darkSteel);
  glacis.position.set(2.95, 1.92, 0);
  glacis.rotation.z = -0.58;
  root.add(glacis);

  for (const sz of [-0.62, 0.62]) {
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.56), mats.scopeInner);
    slit.position.set(2.58, 2.02, sz);
    root.add(slit);
  }

  // Side spaced slat-armor skirts & storage boxes
  for (const sz of [-1.42, 1.42]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(6.3, 0.56, 0.12), mats.k808Armor);
    skirt.position.set(-0.1, 1.48, sz);
    root.add(skirt);
    const stow = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.42, 0.24), mats.darkSteel);
    stow.position.set(-1.3, 1.96, sz * 1.02);
    root.add(stow);
  }

  // 8 Sculpted Off-Road Military Tires + Steel Wheel Hubs + Axles (4 per side!)
  const wheelXs = [-2.45, -0.88, 0.72, 2.28];
  for (const wx of wheelXs) {
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.6, 10), mats.darkSteel);
    axle.rotation.x = Math.PI / 2;
    axle.position.set(wx, 0.62, 0);
    root.add(axle);

    for (const sz of [-1.36, 1.36]) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.42, 20), mats.tireRubber);
      tire.rotation.x = Math.PI / 2;
      tire.position.set(wx, 0.62, sz);
      root.add(tire);

      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.46, 12), mats.gunmetal);
      hub.rotation.x = Math.PI / 2;
      hub.position.set(wx, 0.62, sz);
      root.add(hub);
    }
  }

  // Roof-mounted Remote Weapon Station (RWS) 30mm Autocannon Turret + Smoke Dischargers
  const turret = new THREE.Group();
  turret.position.set(0.45, 2.34, 0);
  turret.rotation.y = 0.28;
  const tBase = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.98, 0.48, 10), mats.k808Armor);
  tBase.position.y = 0.24;
  turret.add(tBase);
  const tPod = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.42, 0.85), mats.gunmetal);
  tPod.position.set(0.1, 0.56, 0);
  turret.add(tPod);
  const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.35, 12), mats.darkSteel);
  cannon.rotation.z = Math.PI / 2;
  cannon.position.set(1.55, 0.6, 0);
  turret.add(cannon);
  for (const sz of [-0.46, 0.46]) {
    for (let s = 0; s < 3; s++) {
      const launcher = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.26, 8), mats.darkSteel);
      launcher.rotation.z = -0.65;
      launcher.position.set(0.25 + s * 0.14, 0.64, sz);
      turret.add(launcher);
    }
  }
  root.add(turret);

  // Rear armored ramp & dual whip comms antennas
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.35, 1.75), mats.darkSteel);
  ramp.position.set(-3.58, 1.48, 0);
  root.add(ramp);
  for (const sz of [-0.95, 0.95]) {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.024, 2.6, 6), mats.darkSteel);
    ant.position.set(-2.6, 3.5, sz);
    root.add(ant);
  }

  return root;
}

/**
 * Builds high-poly DOOM-99 Tactical Combat Shotgun (vented heatshield, ribbed pump forend,
 * tritium ghost-ring sights, side-saddle 12-gauge shells & 5-finger gloved hands).
 */
function buildHighPolyDoom99Shotgun(mats: NamedMats): THREE.Group {
  const root = new THREE.Group();
  root.name = 'DOOM99_Shotgun_Root';

  const recGeo = makeBeveledExtrude(
    [
      [-0.22, -0.055],
      [0.24, -0.055],
      [0.26, 0.015],
      [0.21, 0.064],
      [-0.20, 0.064],
    ],
    0.092,
    0.01,
    0.01
  );
  recGeo.rotateY(Math.PI / 2);
  root.add(new THREE.Mesh(recGeo, mats.rokReceiver));

  // Heavy upper 12-gauge barrel + perforated heatshield shroud + lower tubular magazine
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.72, 18), mats.darkSteel);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.036, -0.44);
  root.add(barrel);

  const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.48, 16, 1, true, -Math.PI * 0.6, Math.PI * 1.2), mats.gunmetal);
  shroud.rotation.x = Math.PI / 2;
  shroud.position.set(0, 0.038, -0.36);
  root.add(shroud);

  const magTube = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.64, 16), mats.gunmetal);
  magTube.rotation.x = Math.PI / 2;
  magTube.position.set(0, -0.012, -0.40);
  root.add(magTube);

  // Breacher muzzle standoff choke
  const breacher = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.025, 0.08, 12), mats.darkSteel);
  breacher.rotation.x = Math.PI / 2;
  breacher.position.set(0, 0.036, -0.82);
  root.add(breacher);

  // Ribbed sliding pump forend (`Magazine` node for authentic pump-rack animation!)
  const pump = new THREE.Group();
  pump.name = 'Magazine';
  pump.position.set(0, -0.018, -0.38);
  const pumpBody = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.036, 0.24, 16), mats.polymer);
  pumpBody.rotation.x = Math.PI / 2;
  pump.add(pumpBody);
  for (let i = 0; i < 8; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.004, 6, 16), mats.darkSteel);
    rib.position.z = -0.095 + i * 0.027;
    pump.add(rib);
  }
  root.add(pump);

  // Side-saddle rack holding 5 red 12-gauge shells with brass rims
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.056, 0.19), mats.polymer);
  saddle.position.set(-0.054, 0.006, -0.03);
  root.add(saddle);
  for (let i = 0; i < 5; i++) {
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.062, 10), mats.shotgunShell);
    shell.position.set(-0.064, 0.006, -0.1 + i * 0.035);
    root.add(shell);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.016, 10), mats.brass);
    rim.position.set(-0.064, 0.038, -0.1 + i * 0.035);
    root.add(rim);
  }

  // Ghost-ring rear sight & tritium bead front sight (aligned to y = +0.095)
  const ghostRing = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 8, 18), mats.darkSteel);
  ghostRing.position.set(0, 0.088, 0.06);
  root.add(ghostRing);
  const frontPost = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.024, 0.016), mats.darkSteel);
  frontPost.position.set(0, 0.072, -0.76);
  root.add(frontPost);
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 8, 8), mats.cyanAccent);
  bead.position.set(0, 0.086, -0.76);
  root.add(bead);

  // Pistol grip & reinforced buttstock neck
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.13, 0.066), mats.polymer);
  grip.position.set(0, -0.095, 0.14);
  grip.rotation.x = 0.28;
  root.add(grip);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.088, 0.26), mats.polymer);
  stock.position.set(0, -0.014, 0.30);
  root.add(stock);

  const rightHand = buildArticulatedGlovedHand('right', mats);
  rightHand.position.set(0.015, -0.105, 0.15);
  root.add(rightHand);
  const leftHand = buildArticulatedGlovedHand('left', mats);
  leftHand.position.set(-0.022, -0.065, -0.37);
  root.add(leftHand);

  return root;
}

/**
 * Builds high-poly HYDRA-7 Tactical Guided Missile Launcher (flared venturi tube,
 * side ballistic prism optic, blast rings, front bumper & 5-finger gloved hands).
 */
function buildHighPolyHydra7Rocket(mats: NamedMats): THREE.Group {
  const root = new THREE.Group();
  root.name = 'HYDRA7_Rocket_Root';

  const mainTube = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.074, 1.06, 24), mats.oliveLauncher);
  mainTube.rotation.x = Math.PI / 2;
  mainTube.position.set(0, 0.02, -0.16);
  root.add(mainTube);

  // Flared front muzzle shroud & rear venturi exhaust cone
  const frontBell = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.074, 0.12, 20), mats.darkSteel);
  frontBell.rotation.x = Math.PI / 2;
  frontBell.position.set(0, 0.02, -0.72);
  root.add(frontBell);
  const rearCone = new THREE.Mesh(new THREE.CylinderGeometry(0.074, 0.096, 0.18, 20), mats.darkSteel);
  rearCone.rotation.x = Math.PI / 2;
  rearCone.position.set(0, 0.02, 0.44);
  root.add(rearCone);

  for (const rz of [-0.52, -0.18, 0.14]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.011, 8, 22), mats.gunmetal);
    band.position.set(0, 0.02, rz);
    root.add(band);
  }

  // Removable Warhead Canister (`Magazine`)
  const warhead = new THREE.Group();
  warhead.name = 'Magazine';
  warhead.position.set(0, 0.02, -0.76);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.056, 0.16, 16), mats.crimsonAccent);
  cone.rotation.x = -Math.PI / 2;
  warhead.add(cone);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.04, 16), mats.brass);
  band.rotation.x = Math.PI / 2;
  band.position.z = 0.08;
  warhead.add(band);
  root.add(warhead);

  // Top transparent ballistic prism optic aligned at y = +0.152
  const optic = new THREE.Group();
  optic.position.set(0, 0.152, -0.14);
  const mount = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.056, 0.09), mats.darkSteel);
  mount.position.set(0, -0.048, 0);
  optic.add(mount);
  const hood = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.008, 8, 20), mats.gunmetal);
  optic.add(hood);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.039, 20), mats.opticGlass);
  optic.add(glass);
  const ret = new THREE.Mesh(new THREE.PlaneGeometry(0.068, 0.068), mats.opticReticle);
  ret.name = 'HoloReticle';
  optic.add(ret);
  root.add(optic);

  // Dual ergonomic grips
  const fGrip = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.14, 0.055), mats.polymer);
  fGrip.position.set(-0.045, -0.09, -0.34);
  root.add(fGrip);
  const rGrip = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.14, 0.062), mats.polymer);
  rGrip.position.set(0.02, -0.09, -0.04);
  rGrip.rotation.x = 0.22;
  root.add(rGrip);

  const rightHand = buildArticulatedGlovedHand('right', mats);
  rightHand.position.set(0.022, -0.115, -0.02);
  root.add(rightHand);
  const leftHand = buildArticulatedGlovedHand('left', mats);
  leftHand.position.set(-0.055, -0.105, -0.34);
  root.add(leftHand);

  return root;
}

/**
 * Builds high-poly ZEUS-MK7 High-Voltage Arc Rifle (dielectric housing, triple copper
 * induction coils, glowing capacitor cell, top prism optic & 5-finger gloved hands).
 */
function buildHighPolyZeusMk7Tesla(mats: NamedMats): THREE.Group {
  const root = new THREE.Group();
  root.name = 'ZEUSMK7_Tesla_Root';

  const bodyGeo = makeBeveledExtrude(
    [
      [-0.22, -0.06],
      [0.24, -0.06],
      [0.28, 0.015],
      [0.22, 0.066],
      [-0.20, 0.066],
    ],
    0.104,
    0.01,
    0.01
  );
  bodyGeo.rotateY(Math.PI / 2);
  root.add(new THREE.Mesh(bodyGeo, mats.rokReceiver));

  // Central high-voltage emitter core + 4 copper induction coils + twin arc prongs
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.68, 14), mats.chrome);
  rod.rotation.x = Math.PI / 2;
  rod.position.set(0, 0.018, -0.46);
  root.add(rod);
  for (let i = 0; i < 4; i++) {
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.048 - i * 0.004, 0.01, 10, 20), mats.copperTip);
    coil.position.set(0, 0.018, -0.24 - i * 0.14);
    root.add(coil);
  }
  for (const sx of [-0.042, 0.042]) {
    const prong = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.014, 0.24, 10), mats.gunmetal);
    prong.rotation.x = Math.PI / 2;
    prong.position.set(sx, 0.018, -0.78);
    root.add(prong);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 8), mats.cyanAccent);
    tip.position.set(sx, 0.018, -0.90);
    root.add(tip);
  }

  // Removable Arc Capacitor (`Magazine`)
  const cap = new THREE.Group();
  cap.name = 'Magazine';
  cap.position.set(0, -0.115, -0.09);
  cap.add(new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.13, 16), mats.gunmetal));
  cap.add(new THREE.Mesh(new THREE.CylinderGeometry(0.039, 0.039, 0.06, 16), mats.cyanAccent));
  root.add(cap);

  // Top transparent holo-prism optic aligned at y = +0.124
  const optic = new THREE.Group();
  optic.position.set(0, 0.124, -0.06);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.006, 8, 20), mats.darkSteel);
  optic.add(frame);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.032, 18), mats.opticGlass);
  optic.add(glass);
  const ret = new THREE.Mesh(new THREE.PlaneGeometry(0.056, 0.056), mats.opticReticle);
  ret.name = 'HoloReticle';
  optic.add(ret);
  root.add(optic);

  const rightHand = buildArticulatedGlovedHand('right', mats);
  rightHand.position.set(0.016, -0.105, 0.14);
  root.add(rightHand);
  const leftHand = buildArticulatedGlovedHand('left', mats);
  leftHand.position.set(-0.026, -0.078, -0.34);
  root.add(leftHand);

  return root;
}

/**
 * Builds sculpted high-poly Wrecked Korean 4-Door Street Sedan (replaces 2-box placeholder cars!).
 * Dimensions: ~4.40m length (Z), ~1.88m width (X), ~1.44m height (Y).
 */
function buildHighPolyKoreanSedan(mats: NamedMats): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Korean_Sedan_Root';

  // Sculpted side-profile silhouette extruded across car width (modern Hyundai/Kia fastback contour)
  const sideProfile = makeBeveledExtrude(
    [
      [-2.18, 0.34], // front lower bumper
      [-2.14, 0.72], // front nose lip
      [-1.92, 0.86], // hood front
      [-0.95, 0.96], // base of windshield
      [-0.36, 1.40], // front roofline
      [0.64, 1.41],  // rear roofline
      [1.36, 1.00],  // fastback C-pillar deck
      [2.05, 0.94],  // trunk lip
      [2.18, 0.76],  // rear bumper top
      [2.14, 0.34],  // rear bumper bottom
    ],
    1.76,
    0.055,
    0.055
  );
  // Rotate so length runs along Z (+Z front or -Z front; Z spans -2.18..+2.18, width X spans -0.88..+0.88)
  sideProfile.rotateY(Math.PI / 2);
  const chassis = new THREE.Mesh(sideProfile, mats.sedanBody);
  root.add(chassis);

  // Recessed sloped front windshield & rear glass + dark side greenhouse windows
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.56, 0.05), mats.sedanGlass);
  windshield.position.set(0, 1.18, 0.67);
  windshield.rotation.x = -0.86;
  root.add(windshield);

  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.50, 0.62, 0.05), mats.sedanGlass);
  rearGlass.position.set(0, 1.19, -1.01);
  rearGlass.rotation.x = 1.04;
  root.add(rearGlass);

  for (const sx of [-0.90, 0.90]) {
    // Side window band
    const winGeo = makeBeveledExtrude(
      [
        [-0.78, 0.99],
        [-0.32, 1.33],
        [0.58, 1.34],
        [1.12, 1.02],
      ],
      0.04,
      0.01,
      0.01
    );
    winGeo.rotateY(Math.PI / 2);
    const sideWin = new THREE.Mesh(winGeo, mats.sedanGlass);
    sideWin.position.x = sx;
    root.add(sideWin);

    // B-pillar divider & side wing mirror & door handles
    const bPillar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, 0.12), mats.sedanTrim);
    bPillar.position.set(sx * 1.01, 1.17, -0.10);
    root.add(bPillar);

    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.10, 0.14), mats.sedanBody);
    mirror.position.set(sx * 1.08, 0.99, 0.56);
    root.add(mirror);

    for (const hz of [0.22, -0.58]) {
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.16), mats.sedanTrim);
      handle.position.set(sx * 1.02, 0.84, hz);
      root.add(handle);
    }

    // Lower rocker panel trim
    const rocker = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 2.32), mats.sedanTrim);
    rocker.position.set(sx * 0.99, 0.34, 0);
    root.add(rocker);
  }

  // Front radiator grille, sculpted lower bumper intake & twin sleek headlights (+Z front)
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.24, 0.10), mats.sedanTrim);
  grille.position.set(0, 0.60, 2.17);
  root.add(grille);
  const fBumper = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.18, 0.16), mats.sedanTrim);
  fBumper.position.set(0, 0.38, 2.16);
  root.add(fBumper);
  for (const sx of [-0.66, 0.66]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.09), mats.sedanHeadlight);
    hl.position.set(sx, 0.72, 2.14);
    root.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.11, 0.09), mats.sedanTaillight);
    tl.position.set(sx, 0.78, -2.14);
    root.add(tl);
  }
  const rBumper = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.20, 0.16), mats.sedanTrim);
  rBumper.position.set(0, 0.40, -2.15);
  root.add(rBumper);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.04), mats.sedanHeadlight);
  plate.position.set(0, 0.62, -2.18);
  root.add(plate);

  // 4 Realistic Recessed Tires + Multi-Spoke Alloy Rims + Brake Discs + Wheel Arch Flares
  for (const wz of [-1.36, 1.38]) {
    for (const sx of [-0.88, 0.88]) {
      const wheel = new THREE.Group();
      wheel.position.set(sx, 0.34, wz);

      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 22), mats.tireRubber);
      tire.rotation.z = Math.PI / 2;
      wheel.add(tire);

      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.255, 16), mats.chrome);
      rim.rotation.z = Math.PI / 2;
      wheel.add(rim);

      const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.27, 10), mats.darkSteel);
      hubCap.rotation.z = Math.PI / 2;
      wheel.add(hubCap);

      // Dark wheel well liner arch
      const well = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.18, 16, 1, false, 0, Math.PI), mats.sedanTrim);
      well.rotation.z = Math.PI / 2;
      well.rotation.x = Math.PI / 2;
      well.position.set(sx > 0 ? -0.05 : 0.05, 0.04, 0);
      wheel.add(well);

      root.add(wheel);
    }
  }

  return root;
}

/**
 * Builds organic sculpted 3-tier Military Sandbag Fortification (replaces smooth uniform sausages!).
 * Dimensions: ~3.2m wide (X), ~1.15m tall (Y), ~0.95m deep (Z).
 */
function buildHighPolySandbagBunker(mats: NamedMats): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Sandbag_Bunker_Root';

  // Ground-anchoring earthen debris skirt so bunker never looks like it floats on asphalt
  const mound = new THREE.Mesh(new THREE.BoxGeometry(3.38, 0.14, 1.12), mats.earthMound);
  mound.position.set(0, 0.07, 0);
  root.add(mound);

  // Sculpt a single pinched, slumped burlap sandbag geometry (organic pillow contour, not a rigid cylinder!)
  const makeBagGeo = (seed: number): THREE.BufferGeometry => {
    const geo = new THREE.SphereGeometry(0.32, 14, 10);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i) * 1.48;
      let y = pos.getY(i) * 0.62;
      let z = pos.getZ(i) * 0.94;
      // Flatten bottom slightly so bags settle heavily on each other
      if (y < 0) y *= 0.72;
      // Pinch stitched ends & add subtle uneven lumpiness
      const endPinch = 1 - Math.min(0.45, Math.pow(Math.abs(x) / 0.48, 3) * 0.45);
      const lump = 1 + Math.sin(x * 11 + seed * 3.1) * 0.08 + Math.cos(z * 13 + seed * 2.3) * 0.06;
      y *= endPinch * lump;
      z *= lump;
      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    return geo;
  };

  // 3 staggered tiers of slumped burlap bags with curved flank wings
  const tiers: Array<{ y: number; count: number; zOff: number; span: number }> = [
    { y: 0.24, count: 5, zOff: 0.05, span: 2.85 },
    { y: 0.56, count: 5, zOff: -0.02, span: 2.65 },
    { y: 0.87, count: 4, zOff: -0.06, span: 2.32 },
  ];

  let seed = 1;
  for (const tier of tiers) {
    for (let i = 0; i < tier.count; i++) {
      const frac = tier.count === 1 ? 0 : i / (tier.count - 1) - 0.5;
      const bx = frac * tier.span + Math.sin(seed * 2.7) * 0.05;
      const curveZ = tier.zOff + frac * frac * 0.34;
      const bag = new THREE.Mesh(makeBagGeo(seed), mats.sandbagBurlap);
      bag.position.set(bx, tier.y + Math.sin(seed * 1.9) * 0.02, curveZ);
      bag.rotation.set(
        Math.sin(seed * 3.3) * 0.06,
        -frac * 0.38 + Math.cos(seed * 2.1) * 0.09,
        Math.sin(seed * 1.7) * 0.05
      );
      root.add(bag);
      seed++;
    }
  }

  // 4 weathered timber revetment stakes bracing the rear & flanks
  for (const sx of [-1.42, -0.48, 0.48, 1.42]) {
    const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.046, 1.18, 7), mats.woodStake);
    stake.position.set(sx, 0.58, -0.34);
    stake.rotation.z = (sx > 0 ? -1 : 1) * 0.06;
    stake.rotation.x = 0.05;
    root.add(stake);
  }

  // Military ammo crate tucked behind sandbag cover
  const ammoBox = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.34, 0.36), mats.oliveLauncher);
  ammoBox.position.set(0.85, 0.24, -0.32);
  ammoBox.rotation.y = 0.22;
  root.add(ammoBox);

  return root;
}

/**
 * Builds sculpted high-poly ROK K2-X Black Panther Main Battle Tank (drivable!).
 * Faces -Z forward. Contains named `TurretPivot`, `BarrelPivot`, and `MuzzlePoint`
 * so the turret rotates 360° independently and the 120mm L/55 smoothbore elevates & recoils.
 */
function buildHighPolyK2BlackPanther(mats: NamedMats): THREE.Group {
  const root = new THREE.Group();
  root.name = 'K2_BlackPanther_Root';

  // 1) Sloped angular composite lower + upper hull (faces -Z forward)
  const hullSide = makeBeveledExtrude(
    [
      [-3.15, 0.56], // front lower glacis chin
      [-3.28, 0.92], // sharp K2 composite nose beak
      [-2.05, 1.38], // steep upper glacis deck
      [2.55, 1.40],  // rear engine deck
      [3.12, 1.18],  // rear upper slope
      [2.98, 0.56],  // rear lower belly
    ],
    2.48,
    0.06,
    0.06
  );
  // rotateY(-PI/2): shape +X -> +Z, shape -X -> -Z (front nose at z = -3.28!)
  hullSide.rotateY(-Math.PI / 2);
  root.add(new THREE.Mesh(hullSide, mats.k808Armor));

  // Rear engine deck louvers & twin exhaust grills + fuel drums
  for (let i = 0; i < 4; i++) {
    const louver = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.08, 0.26), mats.darkSteel);
    louver.position.set(0, 1.44, 1.35 + i * 0.38);
    root.add(louver);
  }
  for (const sx of [-0.72, 0.72]) {
    const exhaust = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.32, 0.14), mats.darkSteel);
    exhaust.position.set(sx, 0.96, 3.09);
    root.add(exhaust);
    // Front tactical LED headlights + protective steel brush guards
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.12), mats.sedanHeadlight);
    hl.position.set(sx * 1.65, 1.16, -2.98);
    root.add(hl);
    // Rear red convoy taillights
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.11, 0.08), mats.sedanTaillight);
    tl.position.set(sx * 1.65, 1.12, 3.06);
    root.add(tl);
    // Front tow shackles
    const tow = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.032, 8, 14), mats.gunmetal);
    tow.position.set(sx * 0.95, 0.72, -3.22);
    root.add(tow);
  }

  // 2) Twin Heavy Caterpillar Track Units, 6 Road Wheels per side, Armored Side Skirts & ERA Bricks
  for (const sx of [-1.42, 1.42]) {
    const trackUpper = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.16, 5.75), mats.tireRubber);
    trackUpper.position.set(sx, 1.02, -0.05);
    root.add(trackUpper);
    const trackLower = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.14, 5.15), mats.tireRubber);
    trackLower.position.set(sx, 0.08, -0.05);
    root.add(trackLower);

    // Front angled track run & rear angled drive run
    const trackFront = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.14, 1.05), mats.tireRubber);
    trackFront.position.set(sx, 0.56, -2.76);
    trackFront.rotation.x = 0.85;
    root.add(trackFront);
    const trackRear = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.14, 1.02), mats.tireRubber);
    trackRear.position.set(sx, 0.56, 2.66);
    trackRear.rotation.x = -0.85;
    root.add(trackRear);

    // 6 Heavy Rubber-Rimmed Road Wheels + Front Idler & Rear Sprocket
    for (let w = 0; w < 6; w++) {
      const wz = -2.18 + w * 0.86;
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.52, 18), mats.tireRubber);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx, 0.44, wz);
      root.add(wheel);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.56, 12), mats.gunmetal);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(sx, 0.44, wz);
      root.add(hub);
    }
    for (const endZ of [-2.82, 2.74]) {
      const spk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.54, 14), mats.darkSteel);
      spk.rotation.z = Math.PI / 2;
      spk.position.set(sx, 0.78, endZ);
      root.add(spk);
    }

    // Heavy Armored Side Skirt + 7 Segmented K2 ERA Reactive Armor Bricks
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.62, 6.08), mats.k808Armor);
    skirt.position.set(sx + (sx > 0 ? 0.30 : -0.30), 1.02, -0.05);
    root.add(skirt);

    for (let b = 0; b < 7; b++) {
      const era = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.44, 0.68), mats.oliveLauncher);
      era.position.set(sx + (sx > 0 ? 0.39 : -0.39), 1.06, -2.36 + b * 0.78);
      root.add(era);
    }
  }

  // 3) Independent 360° Composite Wedge Turret (`TurretPivot`)
  const turret = new THREE.Group();
  turret.name = 'TurretPivot';
  turret.position.set(0, 1.42, 0.10);

  // Iconic angular K2 Black Panther arrowhead turret shell (wide cheek armor tapering forward)
  const turretPlan = makeBeveledExtrude(
    [
      [-0.78, -1.78], // front left cheek
      [0.78, -1.78],  // front right cheek
      [1.42, -0.45],  // right widest cheek
      [1.34, 1.35],   // right bustle corner
      [1.06, 2.28],   // right rear bustle rack
      [-1.06, 2.28],  // left rear bustle rack
      [-1.34, 1.35],  // left bustle corner
      [-1.42, -0.45], // left widest cheek
    ],
    0.76,
    0.07,
    0.07
  );
  // Extrude is along Z; rotateX(PI/2) puts shape (x,y)->(x,z) with y=-1.78 at z=-1.78!
  turretPlan.rotateX(Math.PI / 2);
  const turretBody = new THREE.Mesh(turretPlan, mats.k808Armor);
  turretBody.position.set(0, 0.42, 0);
  turret.add(turretBody);

  // Sloped frontal composite cheek armor plates + rear bustle stowage rack
  const bustleRail = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.36, 0.55), mats.darkSteel);
  bustleRail.position.set(0, 0.56, 2.15);
  turret.add(bustleRail);

  // Commander's KCPS Panoramic Thermal Sight (right roof) & Gunner Primary Sight (left front)
  const kcpsBase = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.32, 14), mats.gunmetal);
  kcpsBase.position.set(0.58, 0.96, 0.35);
  turret.add(kcpsBase);
  const kcpsLens = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.08), mats.cyanAccent);
  kcpsLens.position.set(0.58, 1.02, 0.14);
  turret.add(kcpsLens);

  const gunnerSight = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.48), mats.gunmetal);
  gunnerSight.position.set(-0.62, 0.94, -0.82);
  turret.add(gunnerSight);
  const gunnerGlass = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.06), mats.cyanAccent);
  gunnerGlass.position.set(-0.62, 0.95, -1.07);
  turret.add(gunnerGlass);

  // Commander's Roof Hatch + K6 12.7mm Heavy Machine Gun + Dual Whip Antennas
  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.14, 16), mats.darkSteel);
  hatch.position.set(-0.48, 0.86, 0.45);
  turret.add(hatch);
  const k6Post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.34, 8), mats.gunmetal);
  k6Post.position.set(0.54, 0.96, -0.25);
  turret.add(k6Post);
  const k6Body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.68), mats.darkSteel);
  k6Body.position.set(0.54, 1.15, -0.32);
  turret.add(k6Body);
  const k6Barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.95, 10), mats.gunmetal);
  k6Barrel.rotation.x = Math.PI / 2;
  k6Barrel.position.set(0.54, 1.16, -1.05);
  turret.add(k6Barrel);

  for (const ax of [-1.05, 1.05]) {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.022, 1.85, 6), mats.darkSteel);
    ant.position.set(ax, 1.68, 1.55);
    ant.rotation.x = 0.08;
    turret.add(ant);
    // 6-tube K2 smoke grenade discharger pod on each turret cheek
    const pod = new THREE.Group();
    pod.position.set(ax * 1.24, 0.44, -0.95);
    pod.rotation.y = ax > 0 ? -0.45 : 0.45;
    for (let s = 0; s < 3; s++) {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.34, 8), mats.gunmetal);
      tube.rotation.x = Math.PI * 0.34;
      tube.position.set(0, s * 0.07, -s * 0.09);
      pod.add(tube);
    }
    turret.add(pod);
  }

  // 4) Elevating & Recoiling 120mm L/55 Smoothbore Main Cannon (`BarrelPivot`)
  const barrelPivot = new THREE.Group();
  barrelPivot.name = 'BarrelPivot';
  barrelPivot.position.set(0, 0.44, -1.62);

  const mantlet = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.48, 0.56), mats.gunmetal);
  barrelPivot.add(mantlet);

  // Tapered main barrel tube (4.25m long extending toward -Z)
  const mainTube = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.118, 4.18, 18), mats.k808Armor);
  mainTube.rotation.x = Math.PI / 2;
  mainTube.position.set(0, 0, -2.18);
  barrelPivot.add(mainTube);

  // Iconic cylindrical mid-barrel Bore Evacuator (Fume Extractor)
  const boreEvac = new THREE.Mesh(new THREE.CylinderGeometry(0.162, 0.162, 0.86, 18), mats.gunmetal);
  boreEvac.rotation.x = Math.PI / 2;
  boreEvac.position.set(0, 0, -1.78);
  barrelPivot.add(boreEvac);

  // Muzzle collar + Muzzle Reference Sensor (MRS) mast on barrel tip
  const muzzleCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.095, 0.22, 16), mats.darkSteel);
  muzzleCollar.rotation.x = Math.PI / 2;
  muzzleCollar.position.set(0, 0, -4.24);
  barrelPivot.add(muzzleCollar);
  const mrs = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.08), mats.chrome);
  mrs.position.set(0, 0.12, -4.22);
  barrelPivot.add(mrs);

  // Coaxial 7.62mm/12.7mm barrel right beside mantlet
  const coaxBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.65, 8), mats.darkSteel);
  coaxBarrel.rotation.x = Math.PI / 2;
  coaxBarrel.position.set(0.32, 0.04, -0.45);
  barrelPivot.add(coaxBarrel);

  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.name = 'MuzzlePoint';
  muzzlePoint.position.set(0, 0, -4.40);
  barrelPivot.add(muzzlePoint);

  turret.add(barrelPivot);
  root.add(turret);

  return root;
}

/**
 * Builds sculpted high-poly ROK UH-60K / Surion Tactical Assault Helicopter Gunship.
 * Faces -Z forward with open troop cabin bays, stub Hydra-70 rocket wings, spinning
 * `MainRotor` & `TailRotor`, and a left-door mounted 6-barrel M134 `DoorMinigun`.
 */
function buildHighPolyUh60Gunship(mats: NamedMats): THREE.Group {
  const root = new THREE.Group();
  root.name = 'UH60_Gunship_Root';

  // 1) Forward Nose & Armored Cockpit Section (-Z front)
  const noseGeo = makeBeveledExtrude(
    [
      [-4.65, 0.72], // sharp radome nose tip
      [-4.10, 1.08], // nose upper deck
      [-3.15, 2.08], // top of windshield frame
      [-1.55, 2.26], // cockpit roof
      [-1.55, 0.45], // cockpit floor rear
      [-3.95, 0.48], // chin skid
    ],
    2.18,
    0.08,
    0.08
  );
  noseGeo.rotateY(-Math.PI / 2);
  root.add(new THREE.Mesh(noseGeo, mats.gunmetal));

  // Raked tinted cockpit armored glass panels
  const canopyFront = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.96, 0.08), mats.sedanGlass);
  canopyFront.position.set(0, 1.56, -3.54);
  canopyFront.rotation.x = -0.82;
  root.add(canopyFront);

  // 2) Open Troop-Bay Cabin (Floor + Roof + Rear Bulkhead + Corner Pillars -> clear open door sightlines!)
  const cabinFloor = new THREE.Mesh(new THREE.BoxGeometry(2.38, 0.24, 3.65), mats.darkSteel);
  cabinFloor.position.set(0, 0.56, 0.25);
  root.add(cabinFloor);
  const cabinRoof = new THREE.Mesh(new THREE.BoxGeometry(2.36, 0.34, 3.85), mats.k808Armor);
  cabinRoof.position.set(0, 2.18, 0.22);
  root.add(cabinRoof);
  const rearBulkhead = new THREE.Mesh(new THREE.BoxGeometry(2.28, 1.56, 0.38), mats.darkSteel);
  rearBulkhead.position.set(0, 1.38, 1.98);
  root.add(rearBulkhead);
  for (const sx of [-1.08, 1.08]) {
    for (const sz of [-1.42, 1.78]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.52, 0.18), mats.gunmetal);
      pillar.position.set(sx, 1.36, sz);
      root.add(pillar);
    }
    // Tactical overhead cabin grab rails & floor edge step skids
    const stepRail = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 2.85), mats.gunmetal);
    stepRail.position.set(sx * 1.15, 0.44, 0.20);
    root.add(stepRail);
  }
  // Subtle red tactical combat strip inside cabin ceiling
  const cabinStrip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 2.1), mats.crimsonAccent);
  cabinStrip.position.set(0, 1.98, 0.20);
  root.add(cabinStrip);

  // 3) Twin Overhead T700 Turbine Engine Nacelles + Exhaust Suppressors
  for (const sx of [-0.72, 0.72]) {
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 2.65, 14), mats.k808Armor);
    nacelle.rotation.x = Math.PI / 2;
    nacelle.position.set(sx, 2.48, -0.15);
    root.add(nacelle);
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.30, 0.65, 12), mats.darkSteel);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.rotation.z = sx > 0 ? -0.25 : 0.25;
    exhaust.position.set(sx * 1.18, 2.46, 1.32);
    root.add(exhaust);
  }

  // 4) Stub Weapon Wings + Twin 19-Tube Hydra-70 Rocket Pods (mounted aft of open cabin doorway for clear door-gunner view!) + Landing Gear
  const stubWing = new THREE.Mesh(new THREE.BoxGeometry(4.65, 0.18, 0.88), mats.k808Armor);
  stubWing.position.set(0, 2.02, 2.15);
  root.add(stubWing);
  for (const sx of [-2.05, 2.05]) {
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.36, 0.52), mats.darkSteel);
    pylon.position.set(sx, 1.80, 2.15);
    root.add(pylon);
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.48, 14), mats.oliveLauncher);
    pod.rotation.x = Math.PI / 2;
    pod.position.set(sx, 1.58, 2.08);
    root.add(pod);
    const podCap = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.10, 14), mats.darkSteel);
    podCap.rotation.x = Math.PI / 2;
    podCap.position.set(sx, 1.58, 1.32);
    root.add(podCap);

    // Armored forward main landing gear struts & wheels
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.92, 8), mats.darkSteel);
    strut.position.set(sx * 0.62, 0.32, -1.65);
    strut.rotation.z = sx > 0 ? -0.42 : 0.42;
    root.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 14), mats.tireRubber);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(sx * 0.72, 0.06, -1.65);
    root.add(wheel);
  }

  // 5) Tapered Tail Boom, Stabilator & Canted Tail Fin (+Z rear)
  const tailBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.68, 4.95, 12), mats.k808Armor);
  tailBoom.rotation.x = Math.PI / 2;
  tailBoom.position.set(0, 1.56, 4.35);
  root.add(tailBoom);
  const tailFin = makeBeveledExtrude(
    [
      [0, 0],
      [0.85, 0],
      [1.35, 1.58],
      [0.62, 1.62],
    ],
    0.22,
    0.03,
    0.03
  );
  tailFin.rotateY(-Math.PI / 2);
  const finMesh = new THREE.Mesh(tailFin, mats.k808Armor);
  finMesh.position.set(0, 1.48, 6.25);
  root.add(finMesh);
  const stabilator = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.12, 0.65), mats.gunmetal);
  stabilator.position.set(0, 1.24, 6.62);
  root.add(stabilator);

  // 6) Spinning 4-Blade Main Rotor (`MainRotor`)
  const mainRotor = new THREE.Group();
  mainRotor.name = 'MainRotor';
  mainRotor.position.set(0, 2.86, -0.25);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.48, 14), mats.darkSteel);
  mast.position.y = -0.14;
  mainRotor.add(mast);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.18, 14), mats.gunmetal);
  mainRotor.add(hub);
  for (let b = 0; b < 4; b++) {
    const bladeWrap = new THREE.Group();
    bladeWrap.rotation.y = (b * Math.PI) / 2;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.045, 5.75), mats.darkSteel);
    blade.position.set(0, 0.04, -3.05);
    bladeWrap.add(blade);
    const tipStripe = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, 0.42), mats.brass);
    tipStripe.position.set(0, 0.04, -5.65);
    bladeWrap.add(tipStripe);
    mainRotor.add(bladeWrap);
  }
  root.add(mainRotor);

  // 7) Spinning Tail Rotor (`TailRotor`)
  const tailRotor = new THREE.Group();
  tailRotor.name = 'TailRotor';
  tailRotor.position.set(-0.28, 2.58, 7.12);
  for (let b = 0; b < 4; b++) {
    const tb = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.35, 0.16), mats.darkSteel);
    tb.rotation.x = (b * Math.PI) / 2;
    tailRotor.add(tb);
  }
  root.add(tailRotor);

  // 8) Left-Door Mounted M134 6-Barrel Rotary Minigun (`DoorMinigun` + `MinigunBarrels`)
  const doorGun = new THREE.Group();
  doorGun.name = 'DoorMinigun';
  doorGun.position.set(-1.18, 1.24, 0.15);
  const pintle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.65, 10), mats.darkSteel);
  pintle.position.set(0, -0.34, 0);
  doorGun.add(pintle);
  const receiver = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.44, 14), mats.gunmetal);
  receiver.rotation.z = Math.PI / 2;
  doorGun.add(receiver);
  const ammoBox = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.22), mats.oliveLauncher);
  ammoBox.position.set(0.12, -0.18, 0.22);
  doorGun.add(ammoBox);

  const barrels = new THREE.Group();
  barrels.name = 'MinigunBarrels';
  barrels.position.set(-0.22, 0, 0);
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const bMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.92, 8), mats.gunmetal);
    bMesh.rotation.z = Math.PI / 2;
    bMesh.position.set(-0.46, Math.cos(ang) * 0.055, Math.sin(ang) * 0.055);
    barrels.add(bMesh);
  }
  for (const cx of [-0.34, -0.78]) {
    const clamp = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.04, 14), mats.darkSteel);
    clamp.rotation.z = Math.PI / 2;
    clamp.position.set(cx, 0, 0);
    barrels.add(clamp);
  }
  doorGun.add(barrels);
  root.add(doorGun);

  return root;
}

/**
 * Builds sculpted high-poly Articulated Tactical Spec-Ops / Raider / Sniper Humanoid Rig (`enemy_trooper.glb`).
 * Faces +Z forward with true 2-bone hip/knee & shoulder/elbow pivots for realistic running & aiming animations!
 */
function buildHighPolyEnemyTrooper(mats: NamedMats): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Enemy_Trooper_Root';

  // 1) Articulated Upper Body (`TorsoPivot` at waist/pelvis height y = 1.16)
  const torso = new THREE.Group();
  torso.name = 'TorsoPivot';
  torso.position.set(0, 1.16, 0);

  // Anatomical tapered tactical jacket torso + beveled MOLLE ceramic plate carrier
  const jacketGeo = new THREE.CylinderGeometry(0.22, 0.17, 0.56, 12);
  jacketGeo.scale(1.18, 1, 0.72);
  torso.add(new THREE.Mesh(jacketGeo, mats.charFabric));

  const vestFrontGeo = makeBeveledExtrude(
    [
      [-0.20, -0.22],
      [0.20, -0.22],
      [0.23, 0.04],
      [0.16, 0.24],
      [-0.16, 0.24],
      [-0.23, 0.04],
    ],
    0.075,
    0.015,
    0.015
  );
  const vestFront = new THREE.Mesh(vestFrontGeo, mats.charArmor);
  vestFront.position.set(0, 0.03, 0.145);
  torso.add(vestFront);

  const vestBack = new THREE.Mesh(vestFrontGeo, mats.charArmor);
  vestBack.position.set(0, 0.03, -0.145);
  torso.add(vestBack);

  // Shoulder straps + 3 sculpted 5.56mm magazine pouches + tactical radio + comms whip antenna
  for (const sx of [-0.13, 0.13]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.06, 0.30), mats.charPlate);
    strap.position.set(sx, 0.27, 0);
    torso.add(strap);
  }
  for (let m = -1; m <= 1; m++) {
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.14, 0.068), mats.charPlate);
    pouch.position.set(m * 0.105, -0.09, 0.205);
    torso.add(pouch);
  }
  const hydroPack = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.40, 0.14), mats.charPlate);
  hydroPack.position.set(0, 0.05, -0.235);
  torso.add(hydroPack);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.42, 6), mats.darkSteel);
  antenna.position.set(-0.11, 0.40, -0.22);
  antenna.rotation.x = -0.1;
  torso.add(antenna);

  // Armored tactical utility belt & pelvis harness
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.195, 0.205, 0.13, 12), mats.charPlate);
  belt.scale.set(1.15, 1, 0.78);
  belt.position.set(0, -0.29, 0);
  torso.add(belt);

  // 2) Sculpted Ballistic Helmet + Slim Angular Tactical Visor + NVG + Respirator (`HeadPivot`)
  const head = new THREE.Group();
  head.name = 'HeadPivot';
  head.position.set(0, 0.42, 0.02);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.095, 0.14, 10), mats.charFabric);
  neck.position.set(0, -0.10, 0);
  head.add(neck);

  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.132, 14, 12), mats.charFabric);
  cranium.scale.set(0.95, 1.08, 1.02);
  head.add(cranium);

  // Ops-Core FAST high-cut tactical ballistic helmet shell + ARC rails + brow NVG mount
  const helmetShell = new THREE.Mesh(
    new THREE.SphereGeometry(0.152, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
    mats.charArmor
  );
  helmetShell.scale.set(1.0, 1.04, 1.08);
  helmetShell.position.set(0, 0.02, -0.01);
  head.add(helmetShell);

  const helmetRim = new THREE.Mesh(new THREE.TorusGeometry(0.142, 0.015, 8, 18), mats.charPlate);
  helmetRim.rotation.x = Math.PI / 2 - 0.12;
  helmetRim.position.set(0, 0.02, -0.01);
  head.add(helmetRim);

  // Dual-tube flipped-up tactical NVG binoculars on helmet brow + Peltor ComTac ear-pro headsets
  const nvgBridge = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.045, 0.065), mats.darkSteel);
  nvgBridge.position.set(0, 0.13, 0.12);
  head.add(nvgBridge);
  for (const nx of [-0.042, 0.042]) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.10, 10), mats.gunmetal);
    tube.rotation.x = Math.PI / 2 - 0.25;
    tube.position.set(nx, 0.135, 0.165);
    head.add(tube);
  }
  for (const ex of [-0.148, 0.148]) {
    const earCup = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.042, 0.042, 12), mats.charPlate);
    earCup.rotation.z = Math.PI / 2;
    earCup.position.set(ex, -0.015, 0.0);
    head.add(earCup);
    const railMount = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.045, 0.088), mats.darkSteel);
    railMount.position.set(ex * 0.96, 0.042, -0.01);
    head.add(railMount);
  }
  // Tactical throat mic / collar guard around neck
  const gorget = new THREE.Mesh(new THREE.CylinderGeometry(0.138, 0.162, 0.075, 14), mats.charPlate);
  gorget.position.set(0, -0.14, 0.01);
  head.add(gorget);

  // Sleek recessed razor-thin glowing ballistic goggle slit (NOT a giant oval eye!)
  const goggleFrame = new THREE.Mesh(new THREE.BoxGeometry(0.205, 0.068, 0.06), mats.darkSteel);
  goggleFrame.position.set(0, 0.015, 0.118);
  head.add(goggleFrame);
  const visorSlit = new THREE.Mesh(new THREE.BoxGeometry(0.175, 0.032, 0.025), mats.charVisor);
  visorSlit.position.set(0, 0.015, 0.142);
  head.add(visorSlit);

  // Angular gas-mask respirator jaw + twin cheek filters
  const mask = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.056, 0.10, 8), mats.darkSteel);
  mask.rotation.x = Math.PI / 2;
  mask.position.set(0, -0.062, 0.115);
  head.add(mask);
  for (const fx of [-0.072, 0.072]) {
    const filter = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.05, 10), mats.gunmetal);
    filter.rotation.z = Math.PI / 2;
    filter.position.set(fx, -0.068, 0.102);
    head.add(filter);
  }
  torso.add(head);

  // 3) 2-Bone Articulated Armored Arms (`LeftArmPivot`/`LeftElbowPivot`, `RightArmPivot`/`RightElbowPivot`)
  const buildTrooperArm = (isRight: boolean) => {
    const sx = isRight ? 1 : -1;
    const arm = new THREE.Group();
    arm.name = isRight ? 'RightArmPivot' : 'LeftArmPivot';
    arm.position.set(sx * 0.30, 0.22, 0);

    // Sculpted layered ballistic shoulder pauldron
    const pauldron = new THREE.Mesh(
      new THREE.SphereGeometry(0.115, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.65),
      mats.charArmor
    );
    pauldron.rotation.z = sx * -0.45;
    pauldron.position.set(sx * 0.02, 0.02, 0);
    arm.add(pauldron);

    const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.21, 6, 10), mats.charFabric);
    upperArm.position.set(0, -0.14, 0);
    arm.add(upperArm);

    const elbow = new THREE.Group();
    elbow.name = isRight ? 'RightElbowPivot' : 'LeftElbowPivot';
    elbow.position.set(0, -0.28, 0);

    const elbowPad = new THREE.Mesh(new THREE.SphereGeometry(0.064, 10, 8), mats.charPlate);
    elbowPad.position.set(0, 0, -0.02);
    elbow.add(elbowPad);

    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.054, 0.20, 6, 10), mats.charFabric);
    forearm.position.set(0, -0.14, 0);
    elbow.add(forearm);

    const bracer = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.056, 0.14, 10), mats.charArmor);
    bracer.position.set(0, -0.17, 0);
    elbow.add(bracer);

    const glove = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.10, 0.092), mats.kevlarGlove);
    glove.position.set(0, -0.29, 0.015);
    elbow.add(glove);

    if (isRight) {
      // Sculpted Modern Tactical Assault Carbine mounted in right hand pointing +Z!
      const rifle = new THREE.Group();
      rifle.name = 'RifleMount';
      rifle.position.set(-0.02, -0.28, 0.18);
      const rec = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.11, 0.44), mats.gunmetal);
      rifle.add(rec);
      const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.082, 0.30), mats.darkSteel);
      handguard.position.set(0, 0.012, 0.34);
      rifle.add(handguard);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.34, 10), mats.chrome);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.015, 0.56);
      rifle.add(barrel);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.18, 0.075), mats.darkSteel);
      mag.position.set(0, -0.11, 0.10);
      mag.rotation.x = -0.2;
      rifle.add(mag);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.11, 0.24), mats.darkSteel);
      stock.position.set(0, -0.01, -0.29);
      rifle.add(stock);
      const optic = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.16, 10), mats.gunmetal);
      optic.rotation.x = Math.PI / 2;
      optic.position.set(0, 0.088, 0.02);
      rifle.add(optic);
      elbow.add(rifle);
    }

    arm.add(elbow);
    torso.add(arm);
  };
  buildTrooperArm(false);
  buildTrooperArm(true);
  root.add(torso);

  // 4) 2-Bone Articulated Legs (`LeftLegPivot`/`LeftKneePivot`, `RightLegPivot`/`RightKneePivot`)
  const buildTrooperLeg = (isRight: boolean) => {
    const sx = isRight ? 1 : -1;
    const leg = new THREE.Group();
    leg.name = isRight ? 'RightLegPivot' : 'LeftLegPivot';
    leg.position.set(sx * 0.135, 0.85, 0);

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.084, 0.28, 6, 10), mats.charFabric);
    thigh.position.set(0, -0.20, 0);
    leg.add(thigh);

    // Tactical drop-leg holster / thigh plate
    const thighPlate = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.19, 0.13), mats.charPlate);
    thighPlate.position.set(sx * 0.088, -0.20, 0.01);
    leg.add(thighPlate);

    const knee = new THREE.Group();
    knee.name = isRight ? 'RightKneePivot' : 'LeftKneePivot';
    knee.position.set(0, -0.41, 0);

    const kneePad = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.075), mats.charArmor);
    kneePad.position.set(0, 0.01, 0.075);
    knee.add(kneePad);

    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.28, 6, 10), mats.charFabric);
    shin.position.set(0, -0.21, 0);
    knee.add(shin);

    const shinGuard = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.24, 0.085), mats.charPlate);
    shinGuard.position.set(0, -0.20, 0.055);
    knee.add(shinGuard);

    // Sculpted combat boot with ankle cuff & treaded outsole
    const bootUpper = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.11, 0.26), mats.kevlarGlove);
    bootUpper.position.set(0, -0.39, 0.055);
    knee.add(bootUpper);
    const bootSole = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.04, 0.28), mats.darkSteel);
    bootSole.position.set(0, -0.44, 0.06);
    knee.add(bootSole);

    leg.add(knee);
    root.add(leg);
  };
  buildTrooperLeg(false);
  buildTrooperLeg(true);

  return root;
}

/**
 * Builds sculpted high-poly Heavy Combat Mech / Juggernaut / OMNI-TITAN Boss Rig (`enemy_mech.glb`).
 * Faces +Z with beveled composite warframe armor, detachable boss shields, glowing core, 6-barrel gatling & 2-bone exo legs!
 */
function buildHighPolyEnemyMech(mats: NamedMats): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Enemy_Mech_Root';

  const torso = new THREE.Group();
  torso.name = 'TorsoPivot';
  torso.position.set(0, 1.24, 0);

  // Heavy beveled angular warframe chest hull
  const hullGeo = makeBeveledExtrude(
    [
      [-0.30, -0.32],
      [0.30, -0.32],
      [0.44, 0.08],
      [0.36, 0.36],
      [-0.36, 0.36],
      [-0.44, 0.08],
    ],
    0.46,
    0.035,
    0.035
  );
  torso.add(new THREE.Mesh(hullGeo, mats.charArmor));

  // Twin armored dorsal fusion thruster stacks
  for (const sx of [-0.22, 0.22]) {
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.56, 12), mats.gunmetal);
    stack.position.set(sx, 0.16, -0.34);
    stack.rotation.x = -0.14;
    torso.add(stack);
    const shoulderPod = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.34), mats.charPlate);
    shoulderPod.position.set(sx * 2.15, 0.42, -0.05);
    torso.add(shoulderPod);
    // Hydraulic titanium shoulder actuator strut + exhaust louvers
    const hydroStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.42, 10), mats.chrome);
    hydroStrut.position.set(sx * 1.48, 0.26, -0.18);
    hydroStrut.rotation.z = sx * 0.35;
    torso.add(hydroStrut);
    const collarFin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.28), mats.darkSteel);
    collarFin.position.set(sx * 1.15, 0.42, 0.04);
    collarFin.rotation.z = sx * -0.22;
    torso.add(collarFin);
  }

  // Glowing Chest Reactor Core (`CoreWeakpoint`) + 3 Detachable Beveled Boss Armor Plates!
  const core = new THREE.Group();
  core.name = 'CoreWeakpoint';
  core.position.set(0, 0.06, 0.25);
  core.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.17, 1), mats.charVisor));
  core.add(new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.032, 8, 16), mats.chrome));
  torso.add(core);

  const armorFront = new THREE.Group();
  armorFront.name = 'ArmorFront';
  armorFront.position.set(0, 0.06, 0.32);
  const frontShieldGeo = makeBeveledExtrude(
    [
      [-0.30, -0.22],
      [0.30, -0.22],
      [0.36, 0.06],
      [0.24, 0.24],
      [-0.24, 0.24],
      [-0.36, 0.06],
    ],
    0.09,
    0.02,
    0.02
  );
  armorFront.add(new THREE.Mesh(frontShieldGeo, mats.charPlate));
  torso.add(armorFront);

  const armorLeft = new THREE.Group();
  armorLeft.name = 'ArmorLeft';
  armorLeft.position.set(-0.49, 0.08, 0.02);
  armorLeft.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.48, 0.44), mats.charPlate));
  torso.add(armorLeft);

  const armorRight = new THREE.Group();
  armorRight.name = 'ArmorRight';
  armorRight.position.set(0.49, 0.08, 0.02);
  armorRight.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.48, 0.44), mats.charPlate));
  torso.add(armorRight);

  // Menacing Swept Angular Warframe Sensor Head (`HeadPivot`)
  const head = new THREE.Group();
  head.name = 'HeadPivot';
  head.position.set(0, 0.46, 0.06);
  const helmGeo = makeBeveledExtrude(
    [
      [-0.14, -0.10],
      [0.14, -0.10],
      [0.18, 0.04],
      [0.10, 0.16],
      [-0.10, 0.16],
      [-0.18, 0.04],
    ],
    0.26,
    0.025,
    0.025
  );
  head.add(new THREE.Mesh(helmGeo, mats.charPlate));
  const slit = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.042, 0.04), mats.charVisor);
  slit.position.set(0, 0.02, 0.145);
  head.add(slit);
  torso.add(head);

  // Heavy Articulated Hydraulic Arms (`LeftArmPivot`, `RightArmPivot` + 6-Barrel `GatlingPivot`)
  for (const isRight of [false, true]) {
    const sx = isRight ? 1 : -1;
    const arm = new THREE.Group();
    arm.name = isRight ? 'RightArmPivot' : 'LeftArmPivot';
    arm.position.set(sx * 0.50, 0.24, 0.04);

    const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.34), mats.charArmor);
    pauldron.rotation.z = sx * -0.25;
    arm.add(pauldron);
    const bicep = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.092, 0.34, 12), mats.gunmetal);
    bicep.position.set(0, -0.20, 0);
    arm.add(bicep);

    const elbow = new THREE.Group();
    elbow.name = isRight ? 'RightElbowPivot' : 'LeftElbowPivot';
    elbow.position.set(0, -0.36, 0);
    elbow.add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), mats.chrome));

    const gauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.34, 0.22), mats.charArmor);
    gauntlet.position.set(0, -0.18, 0.04);
    elbow.add(gauntlet);

    if (isRight) {
      const gatling = new THREE.Group();
      gatling.name = 'GatlingPivot';
      gatling.position.set(0, -0.24, 0.56);
      const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.30, 14), mats.darkSteel);
      housing.rotation.x = Math.PI / 2;
      housing.position.z = -0.30;
      gatling.add(housing);
      for (let b = 0; b < 6; b++) {
        const ang = (b / 6) * Math.PI * 2;
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.92, 8), mats.chrome);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(Math.cos(ang) * 0.08, Math.sin(ang) * 0.08, 0.02);
        gatling.add(barrel);
      }
      const clamp = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.022, 8, 14), mats.charVisor);
      clamp.position.z = 0.34;
      gatling.add(clamp);
      elbow.add(gatling);
    }

    arm.add(elbow);
    torso.add(arm);
  }
  root.add(torso);

  // Heavy Hydraulic 2-Bone Exo Legs
  for (const isRight of [false, true]) {
    const sx = isRight ? 1 : -1;
    const leg = new THREE.Group();
    leg.name = isRight ? 'RightLegPivot' : 'LeftLegPivot';
    leg.position.set(sx * 0.22, 0.88, 0);

    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.26), mats.charArmor);
    thigh.position.set(0, -0.20, 0);
    leg.add(thigh);
    const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.36, 8), mats.chrome);
    piston.position.set(sx * 0.11, -0.20, -0.06);
    leg.add(piston);

    const knee = new THREE.Group();
    knee.name = isRight ? 'RightKneePivot' : 'LeftKneePivot';
    knee.position.set(0, -0.43, 0);
    knee.add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.24, 12), mats.gunmetal).rotateZ(Math.PI / 2));

    const greave = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.40, 0.26), mats.charPlate);
    greave.position.set(0, -0.21, 0.04);
    knee.add(greave);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.40), mats.darkSteel);
    foot.position.set(0, -0.42, 0.08);
    knee.add(foot);

    leg.add(knee);
    root.add(leg);
  }

  return root;
}

/**
 * Builds sculpted high-poly Stealth Hunter-Killer Attack Drone (`enemy_drone.glb`).
 * Features angular swept stealth chassis, twin ducted-fan thruster nacelles & underslung rotary cannon.
 */
function buildHighPolyEnemyDrone(mats: NamedMats): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Enemy_Drone_Root';

  const torso = new THREE.Group();
  torso.name = 'TorsoPivot';
  torso.position.set(0, 1.38, 0);

  // Swept stealth diamond aerospace fuselage facing +Z
  const chassisGeo = makeBeveledExtrude(
    [
      [0, 0.56],
      [0.42, 0.12],
      [0.32, -0.48],
      [-0.32, -0.48],
      [-0.42, 0.12],
    ],
    0.26,
    0.03,
    0.03
  );
  chassisGeo.rotateX(Math.PI / 2);
  torso.add(new THREE.Mesh(chassisGeo, mats.charArmor));

  // Front armored gimbal targeting turret (`HeadPivot`)
  const head = new THREE.Group();
  head.name = 'HeadPivot';
  head.position.set(0, -0.02, 0.44);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), mats.darkSteel));
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.06, 12), mats.charVisor);
  lens.rotation.x = Math.PI / 2;
  lens.position.z = 0.12;
  head.add(lens);
  torso.add(head);

  // Twin Vectored Ducted-Fan Thruster Pods (`LeftArmPivot`, `RightArmPivot`)
  for (const isRight of [false, true]) {
    const sx = isRight ? 1 : -1;
    const wing = new THREE.Group();
    wing.name = isRight ? 'RightArmPivot' : 'LeftArmPivot';
    wing.position.set(sx * 0.58, 0.02, -0.04);

    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 0.18), mats.gunmetal);
    strut.position.x = -sx * 0.14;
    wing.add(strut);

    const duct = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.052, 10, 20), mats.charPlate);
    duct.rotation.x = Math.PI / 2;
    wing.add(duct);

    const glowRing = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.018, 8, 18), mats.charVisor);
    glowRing.rotation.x = Math.PI / 2;
    glowRing.position.y = -0.04;
    wing.add(glowRing);

    torso.add(wing);
  }

  // Underslung Spinning Blade / Twin Autocannon Pod (`SawPivot`)
  const saw = new THREE.Group();
  saw.name = 'SawPivot';
  saw.position.set(0, -0.24, 0.10);
  saw.add(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.035, 14), mats.chrome));
  saw.add(new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.02, 8, 16), mats.charVisor).rotateX(Math.PI / 2));
  torso.add(saw);

  root.add(torso);
  return root;
}

async function exportGlb(object: THREE.Object3D, outPath: string): Promise<void> {
  const exporter = new GLTFExporter();
  const glb = (await exporter.parseAsync(object, { binary: true })) as ArrayBuffer;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, Buffer.from(glb));
  const kb = (glb.byteLength / 1024).toFixed(1);
  console.log(`Generated ${path.basename(outPath)} (${kb} KB)`);
}

async function main(): Promise<void> {
  const outDir = path.resolve(SCRIPT_DIR, '../src/assets/models');
  const mats = createNamedMats();
  await exportGlb(buildHighPolyM41X(mats), path.join(outDir, 'm41x_rifle.glb'));
  await exportGlb(buildHighPolyDoom99Shotgun(mats), path.join(outDir, 'doom99_shotgun.glb'));
  await exportGlb(buildHighPolyRailX9(mats), path.join(outDir, 'railx9_sniper.glb'));
  await exportGlb(buildHighPolyHydra7Rocket(mats), path.join(outDir, 'hydra7_rocket.glb'));
  await exportGlb(buildHighPolyZeusMk7Tesla(mats), path.join(outDir, 'zeusmk7_tesla.glb'));
  await exportGlb(buildHighPolyK808Apc(mats), path.join(outDir, 'k808_apc.glb'));
  await exportGlb(buildHighPolyKoreanSedan(mats), path.join(outDir, 'korean_sedan.glb'));
  await exportGlb(buildHighPolySandbagBunker(mats), path.join(outDir, 'sandbag_bunker.glb'));
  await exportGlb(buildHighPolyK2BlackPanther(mats), path.join(outDir, 'k2_black_panther.glb'));
  await exportGlb(buildHighPolyUh60Gunship(mats), path.join(outDir, 'uh60_gunship.glb'));
  await exportGlb(buildHighPolyEnemyTrooper(mats), path.join(outDir, 'enemy_trooper.glb'));
  await exportGlb(buildHighPolyEnemyMech(mats), path.join(outDir, 'enemy_mech.glb'));
  await exportGlb(buildHighPolyEnemyDrone(mats), path.join(outDir, 'enemy_drone.glb'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
