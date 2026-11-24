/**
 * Real Image-Based PBR Map Processor & Studio Character Portrait Extractor (sharp).
 *
 * Reads our photorealistic AI-generated albedo textures in wargame3/src/assets/textures/
 * and computes physically calibrated Tangent-Space Sobel Normal Maps (*_normal.png),
 * Roughness Maps (*_roughness.png), and Cavity Ambient Occlusion Maps (*_ao.png).
 *
 * Also crops high-resolution 384x384 tactical comms character portraits from our
 * studio key art images so every character in HUD comms & Mission Briefings has
 * genuine photorealistic artwork.
 *
 * Run via: .\node_modules\.bin\tsx.cmd scripts\buildPbrMapsFromImages.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const TEX_DIR = path.resolve(SCRIPT_DIR, '../src/assets/textures');
const IMG_DIR = path.resolve(SCRIPT_DIR, '../src/assets/images');

interface PbrTargetSpec {
  id: string;
  srcPath: string;
  normalStrength: number;
  roughMin: number;
  roughMax: number;
  invertRoughness?: boolean; // e.g. dark wet puddles -> smoother/lower roughness
  aoDepth: number;
}

const PBR_TARGETS: PbrTargetSpec[] = [
  {
    id: 'seoul_asphalt_wet',
    srcPath: path.join(TEX_DIR, 'pbr_seoul_asphalt_wet.jpg'),
    normalStrength: 3.1,
    roughMin: 0.24, // damp dark puddles catch muted night reflections
    roughMax: 0.92, // dry cracked aggregate tarmac stays matte
    invertRoughness: false, // darker = wetter = lower roughness
    aoDepth: 0.55,
  },
  {
    id: 'euljiro_facade',
    srcPath: path.join(TEX_DIR, 'pbr_euljiro_facade.jpg'),
    normalStrength: 3.6,
    roughMin: 0.58,
    roughMax: 0.96,
    invertRoughness: true, // bright ceramic tile faces slightly smoother than dark grime/bullet holes
    aoDepth: 0.65,
  },
  {
    id: 'sandbag_burlap',
    srcPath: path.join(TEX_DIR, 'pbr_sandbag_burlap.jpg'),
    normalStrength: 3.8,
    roughMin: 0.84,
    roughMax: 0.98,
    invertRoughness: true,
    aoDepth: 0.7,
  },
  {
    id: 'rok_tactical_camo',
    srcPath: path.join(TEX_DIR, 'pbr_rok_tactical_camo.jpg'),
    normalStrength: 2.5,
    roughMin: 0.78,
    roughMax: 0.96,
    invertRoughness: true,
    aoDepth: 0.45,
  },
  {
    id: 'military_gunmetal',
    srcPath: path.join(TEX_DIR, 'pbr_military_gunmetal.jpg'),
    normalStrength: 3.2,
    roughMin: 0.34, // scratched bare metal edges catch subtle glint
    roughMax: 0.82, // oil grime & dark paint stay matte
    invertRoughness: true,
    aoDepth: 0.55,
  },
];

async function generatePbrChannels(spec: PbrTargetSpec): Promise<void> {
  if (!fs.existsSync(spec.srcPath)) {
    throw new Error(`Missing source albedo texture: ${spec.srcPath}`);
  }
  const SIZE = 512;
  // Extract 512x512 RGB pixel buffer from real photographic albedo
  const { data } = await sharp(spec.srcPath)
    .resize(SIZE, SIZE, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Compute grayscale heightfield (luminance) + local contrast cavity
  const lum = new Float32Array(SIZE * SIZE);
  let minL = 1;
  let maxL = 0;
  for (let i = 0; i < SIZE * SIZE; i++) {
    const r = data[i * 3] / 255;
    const g = data[i * 3 + 1] / 255;
    const b = data[i * 3 + 2] / 255;
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    lum[i] = l;
    if (l < minL) minL = l;
    if (l > maxL) maxL = l;
  }
  const invSpan = 1 / Math.max(0.08, maxL - minL);

  const sample = (x: number, y: number): number => {
    const cx = ((x % SIZE) + SIZE) % SIZE;
    const cy = ((y % SIZE) + SIZE) % SIZE;
    return (lum[cy * SIZE + cx] - minL) * invSpan;
  };

  const normalBuf = Buffer.alloc(SIZE * SIZE * 3);
  const roughBuf = Buffer.alloc(SIZE * SIZE);
  const aoBuf = Buffer.alloc(SIZE * SIZE);

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const idx = y * SIZE + x;
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const c = sample(x, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);

      // Sobel tangent-space normal
      const dX = (tr + 2 * r + br - (tl + 2 * l + bl)) * spec.normalStrength;
      const dY = (bl + 2 * b + br - (tl + 2 * t + tr)) * spec.normalStrength;
      const dZ = 1.0;
      const invLen = 1 / Math.hypot(dX, dY, dZ);
      normalBuf[idx * 3] = Math.max(0, Math.min(255, Math.round((-dX * invLen * 0.5 + 0.5) * 255)));
      normalBuf[idx * 3 + 1] = Math.max(0, Math.min(255, Math.round((-dY * invLen * 0.5 + 0.5) * 255)));
      normalBuf[idx * 3 + 2] = Math.max(0, Math.min(255, Math.round((dZ * invLen * 0.5 + 0.5) * 255)));

      // Calibrated physical roughness
      const tRough = spec.invertRoughness ? 1 - c : c;
      const roughVal = spec.roughMin + (spec.roughMax - spec.roughMin) * Math.max(0, Math.min(1, tRough));
      roughBuf[idx] = Math.max(0, Math.min(255, Math.round(roughVal * 255)));

      // Cavity AO (darker in local depressions & cracks)
      const avgNeighbors = (tl + t + tr + l + r + bl + b + br) / 8;
      const cavity = Math.max(0, avgNeighbors - c);
      const aoVal = Math.max(0.28, Math.min(1.0, 1.0 - (1 - c) * spec.aoDepth * 0.55 - cavity * spec.aoDepth * 1.6));
      aoBuf[idx] = Math.round(aoVal * 255);
    }
  }

  const normalOut = path.join(TEX_DIR, `pbr_${spec.id}_normal.png`);
  const roughOut = path.join(TEX_DIR, `pbr_${spec.id}_roughness.png`);
  const aoOut = path.join(TEX_DIR, `pbr_${spec.id}_ao.png`);

  await Promise.all([
    sharp(normalBuf, { raw: { width: SIZE, height: SIZE, channels: 3 } })
      .png({ compressionLevel: 8 })
      .toFile(normalOut),
    sharp(roughBuf, { raw: { width: SIZE, height: SIZE, channels: 1 } })
      .png({ compressionLevel: 8 })
      .toFile(roughOut),
    sharp(aoBuf, { raw: { width: SIZE, height: SIZE, channels: 1 } })
      .png({ compressionLevel: 8 })
      .toFile(aoOut),
  ]);

  console.log(`  [PBR] ${spec.id}: normal + roughness + ao (512x512 PNG)`);
}

async function extractPortrait(
  srcPath: string,
  outPath: string,
  regionFrac: { left: number; top: number; width: number; height: number }
): Promise<void> {
  if (!fs.existsSync(srcPath)) {
    console.warn(`  [SKIP] Portrait source missing: ${srcPath}`);
    return;
  }
  const meta = await sharp(srcPath).metadata();
  const w = meta.width ?? 1024;
  const h = meta.height ?? 1024;
  const left = Math.max(0, Math.min(w - 16, Math.round(w * regionFrac.left)));
  const top = Math.max(0, Math.min(h - 16, Math.round(h * regionFrac.top)));
  const cw = Math.max(16, Math.min(w - left, Math.round(w * regionFrac.width)));
  const ch = Math.max(16, Math.min(h - top, Math.round(h * regionFrac.height)));

  await sharp(srcPath)
    .extract({ left, top, width: cw, height: ch })
    .resize(384, 384, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(outPath);

  const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`  [PORTRAIT] ${path.basename(outPath)} (${kb} KB)`);
}

async function main(): Promise<void> {
  console.log('1) Computing Sobel Normal + Roughness + Cavity AO PBR maps from photorealistic albedo textures...');
  for (const spec of PBR_TARGETS) {
    await generatePbrChannels(spec);
  }

  console.log('2) Extracting 384x384 Studio Tactical Comms Portraits...');
  const artifactDir = 'C:\\Users\\SUNGWOO\\.gemini\\antigravity\\brain\\e2d76433-6ff1-4955-a6a8-d464e02ed502';
  const rawCaptKang = path.join(artifactDir, 'portrait_captain_kang_1795519806632.jpg');

  // Captain Kang: crop upper 74% to cleanly frame face & collar without lower chest patch text
  await extractPortrait(
    fs.existsSync(rawCaptKang) ? rawCaptKang : path.join(IMG_DIR, 'story_valkyrie_orbital_link.jpg'),
    path.join(IMG_DIR, 'portrait_captain_kang.jpg'),
    fs.existsSync(rawCaptKang)
      ? { left: 0.14, top: 0.04, width: 0.72, height: 0.72 }
      : { left: 0.25, top: 0.08, width: 0.5, height: 0.8 }
  );

  // Sergeant So: tight tactical frame on lead ROK Special Forces NCO from Mission 01 Han River art
  await extractPortrait(
    path.join(IMG_DIR, 'mission01_han_river.jpg'),
    path.join(IMG_DIR, 'portrait_sergeant_so.jpg'),
    { left: 0.68, top: 0.45, width: 0.30, height: 0.52 }
  );

  // Ghost-9: tight frame on cracked glowing cyan synth visor from Ghost-9 key art
  await extractPortrait(
    path.join(IMG_DIR, 'story_ghost9_rebellion.jpg'),
    path.join(IMG_DIR, 'portrait_ghost9.jpg'),
    { left: 0.48, top: 0.12, width: 0.28, height: 0.48 }
  );

  // Angel-01 AC-130 Gunship: tight high-contrast FLIR thermal recon target frame
  await extractPortrait(
    path.join(IMG_DIR, 'mission03_ac130_flir.jpg'),
    path.join(IMG_DIR, 'portrait_gunship.jpg'),
    { left: 0.22, top: 0.16, width: 0.56, height: 0.72 }
  );

  // OMNI-CORE Architect: crimson AI monolith core frame
  await extractPortrait(
    path.join(IMG_DIR, 'story_ai_world_awakening_1795255351326.jpg'),
    path.join(IMG_DIR, 'portrait_arcadia.jpg'),
    { left: 0.26, top: 0.06, width: 0.48, height: 0.78 }
  );

  // Optimize Corporal Park portrait to consistent 384x384 size
  const parkRaw = path.join(artifactDir, 'portrait_corporal_park_jpg_1795519803306.jpg');
  if (fs.existsSync(parkRaw)) {
    await extractPortrait(parkRaw, path.join(IMG_DIR, 'portrait_corporal_park.jpg'), {
      left: 0.05,
      top: 0.02,
      width: 0.9,
      height: 0.9,
    });
  }

  console.log('Done building all PBR maps and tactical portraits!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
