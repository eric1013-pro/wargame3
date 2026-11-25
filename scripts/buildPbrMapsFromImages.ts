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
    normalStrength: 3.3,
    roughMin: 0.14, // rain puddles catch realistic moody Seoul sky & firelight reflections
    roughMax: 0.94, // dry cracked aggregate tarmac stays gritty matte
    invertRoughness: false, // darker = wetter = lower roughness
    aoDepth: 0.62,
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

/**
 * Synthesizes 3 photorealistic architectural & military PBR texture packs by compositing
 * real photographic micro-grain from our studio JPG textures with physical height/roughness/AO maps:
 *  - pbr_skyscraper_glass : Modern Seoul glass curtain-wall office facade (glossy glass + mullions + muted lit rooms)
 *  - pbr_seoul_concrete   : Weathered brutalist Korean poured concrete with formwork joints, tie-holes & rain streaks
 *  - pbr_carbon_armor     : Military 2x2 twill carbon-fiber weave & matte ballistic ceramic-titanium armor plates
 */
async function buildCompositePhotoPbrPacks(): Promise<void> {
  const SIZE = 512;
  const loadRawRgb = async (file: string): Promise<Buffer> => {
    const { data } = await sharp(file)
      .resize(SIZE, SIZE, { fit: 'cover' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return data;
  };

  const [asphaltRgb, facadeRgb, gunmetalRgb] = await Promise.all([
    loadRawRgb(path.join(TEX_DIR, 'pbr_seoul_asphalt_wet.jpg')),
    loadRawRgb(path.join(TEX_DIR, 'pbr_euljiro_facade.jpg')),
    loadRawRgb(path.join(TEX_DIR, 'pbr_military_gunmetal.jpg')),
  ]);

  const clampByte = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const hash2 = (x: number, y: number) => {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return n - Math.floor(n);
  };

  const writePack = async (
    id: string,
    albedo: Buffer,
    height: Float32Array,
    rough: Buffer,
    ao: Buffer,
    normalStrength: number
  ) => {
    const normal = Buffer.alloc(SIZE * SIZE * 3);
    const samp = (x: number, y: number) => height[((y % SIZE + SIZE) % SIZE) * SIZE + ((x % SIZE + SIZE) % SIZE)];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const idx = y * SIZE + x;
        const tl = samp(x - 1, y - 1), t = samp(x, y - 1), tr = samp(x + 1, y - 1);
        const l = samp(x - 1, y), r = samp(x + 1, y);
        const bl = samp(x - 1, y + 1), b = samp(x, y + 1), br = samp(x + 1, y + 1);
        const dX = (tr + 2 * r + br - (tl + 2 * l + bl)) * normalStrength;
        const dY = (bl + 2 * b + br - (tl + 2 * t + tr)) * normalStrength;
        const inv = 1 / Math.hypot(dX, dY, 1.0);
        normal[idx * 3] = clampByte((-dX * inv * 0.5 + 0.5) * 255);
        normal[idx * 3 + 1] = clampByte((-dY * inv * 0.5 + 0.5) * 255);
        normal[idx * 3 + 2] = clampByte((inv * 0.5 + 0.5) * 255);
      }
    }
    await Promise.all([
      sharp(albedo, { raw: { width: SIZE, height: SIZE, channels: 3 } })
        .jpeg({ quality: 90, mozjpeg: true })
        .toFile(path.join(TEX_DIR, `pbr_${id}.jpg`)),
      sharp(normal, { raw: { width: SIZE, height: SIZE, channels: 3 } })
        .png({ compressionLevel: 8 })
        .toFile(path.join(TEX_DIR, `pbr_${id}_normal.png`)),
      sharp(rough, { raw: { width: SIZE, height: SIZE, channels: 1 } })
        .png({ compressionLevel: 8 })
        .toFile(path.join(TEX_DIR, `pbr_${id}_roughness.png`)),
      sharp(ao, { raw: { width: SIZE, height: SIZE, channels: 1 } })
        .png({ compressionLevel: 8 })
        .toFile(path.join(TEX_DIR, `pbr_${id}_ao.png`)),
    ]);
    console.log(`  [COMPOSITE PBR] ${id}: albedo JPG + normal/roughness/ao PNG (512x512)`);
  };

  // A) pbr_skyscraper_glass — Photorealistic Seoul Glass Curtain-Wall Tower Facade
  {
    const alb = Buffer.alloc(SIZE * SIZE * 3);
    const hgt = new Float32Array(SIZE * SIZE);
    const rgh = Buffer.alloc(SIZE * SIZE);
    const ao = Buffer.alloc(SIZE * SIZE);
    const cols = 8;
    const rows = 8;
    const cellW = SIZE / cols;
    const cellH = SIZE / rows;

    for (let y = 0; y < SIZE; y++) {
      const row = Math.floor(y / cellH);
      const ly = y - row * cellH;
      for (let x = 0; x < SIZE; x++) {
        const col = Math.floor(x / cellW);
        const lx = x - col * cellW;
        const idx = y * SIZE + x;
        const gIdx = idx * 3;
        const grain = (gunmetalRgb[gIdx] - 128) * 0.14;
        const rainStreak = (asphaltRgb[gIdx] / 255 - 0.5) * 14;

        const isSpandrel = ly < 11 || ly >= cellH - 4;
        const isMullion = lx < 5 || lx >= cellW - 3;

        if (isSpandrel || isMullion) {
          // Brushed charcoal anodized aluminum curtain-wall frame
          const bevel = (lx === 5 || ly === 11) ? 16 : 0;
          alb[gIdx] = clampByte(30 + grain * 0.6 + bevel);
          alb[gIdx + 1] = clampByte(35 + grain * 0.6 + bevel);
          alb[gIdx + 2] = clampByte(44 + grain * 0.6 + bevel);
          hgt[idx] = isSpandrel ? 0.88 : 0.82;
          rgh[idx] = clampByte((0.46 + (gunmetalRgb[gIdx] / 255) * 0.16) * 255);
          ao[idx] = clampByte((isSpandrel && ly >= 9 ? 0.55 : 0.92) * 255);
        } else {
          // Recessed smoked architectural glass with muted realistic lit offices + Venetian blinds
          const seed = hash2(col * 3.1 + 1, row * 5.7 + 2);
          const litRoll = hash2(col * 11.3, row * 7.9);
          const gradY = (ly - 11) / (cellH - 15);
          const blind = Math.sin(ly * 1.45) * 0.5 + 0.5;
          const blindClosed = seed > 0.58 && gradY < 0.48;

          let r = 16 + (1 - gradY) * 14 + rainStreak * 0.4;
          let g = 24 + (1 - gradY) * 18 + rainStreak * 0.4;
          let b = 34 + (1 - gradY) * 24 + rainStreak * 0.5;

          if (litRoll > 0.72) {
            // Subtle warm tungsten interior office room
            const k = (blindClosed ? 0.35 : 0.85) * (0.45 + 0.55 * gradY);
            r += 92 * k + blind * 8;
            g += 72 * k + blind * 6;
            b += 46 * k + blind * 4;
          } else if (litRoll > 0.54) {
            // Subtle cool fluorescent office glow
            const k = (blindClosed ? 0.3 : 0.72) * (0.4 + 0.6 * gradY);
            r += 34 * k + blind * 5;
            g += 54 * k + blind * 7;
            b += 72 * k + blind * 9;
          }

          alb[gIdx] = clampByte(r);
          alb[gIdx + 1] = clampByte(g);
          alb[gIdx + 2] = clampByte(b);
          hgt[idx] = 0.25 + (rainStreak * 0.004);
          // Ultra-sleek glossy glass panes (roughness 0.09..0.16) mirror sky & city glow!
          rgh[idx] = clampByte((0.09 + (asphaltRgb[gIdx] / 255) * 0.08) * 255);
          // Realistic frame edge shadow AO around pane recess
          const edgeDist = Math.min(lx - 5, cellW - 4 - lx, ly - 11, cellH - 5 - ly);
          ao[idx] = clampByte((edgeDist < 4 ? 0.48 + edgeDist * 0.12 : 0.96) * 255);
        }
      }
    }
    await writePack('skyscraper_glass', alb, hgt, rgh, ao, 3.4);
  }

  // B) pbr_seoul_concrete — Weathered Korean Brutalist Poured Architectural Concrete
  {
    const alb = Buffer.alloc(SIZE * SIZE * 3);
    const hgt = new Float32Array(SIZE * SIZE);
    const rgh = Buffer.alloc(SIZE * SIZE);
    const ao = Buffer.alloc(SIZE * SIZE);

    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const idx = y * SIZE + x;
        const gIdx = idx * 3;
        // Blend real photographic mineral grain from Euljiro facade & wet Seoul asphalt
        const fL = (facadeRgb[gIdx] * 0.3 + facadeRgb[gIdx + 1] * 0.59 + facadeRgb[gIdx + 2] * 0.11) / 255;
        const aL = (asphaltRgb[gIdx] * 0.3 + asphaltRgb[gIdx + 1] * 0.59 + asphaltRgb[gIdx + 2] * 0.11) / 255;
        const panelX = x % 128;
        const panelY = y % 128;
        const seam = panelX < 2 || panelY < 2;

        // Recessed tie-rod cone holes (signature Korean poured concrete formwork!)
        const dx1 = Math.min(Math.abs(panelX - 32), Math.abs(panelX - 96));
        const dy1 = Math.min(Math.abs(panelY - 32), Math.abs(panelY - 96));
        const tieDist = Math.hypot(dx1, dy1);
        const isTieHole = tieDist < 4.2;

        // Vertical rainwater runoff streak darkening beneath top seam
        const streakNoise = hash2(Math.floor(x / 3), Math.floor(y / 128));
        const rainWash = Math.max(0, 1 - panelY / (38 + streakNoise * 54)) * (0.12 + streakNoise * 0.16);

        let base = 0.38 + fL * 0.22 + aL * 0.16 - rainWash;
        let h = 0.55 + (fL - 0.5) * 0.25 + (aL - 0.5) * 0.2;
        let rVal = 0.82 + (1 - aL) * 0.14 - rainWash * 0.45;
        let aoVal = 0.94 - rainWash * 0.25;

        if (seam) {
          base *= 0.45;
          h = 0.12;
          rVal = 0.95;
          aoVal = 0.38;
        } else if (isTieHole) {
          base *= 0.42;
          h = 0.14;
          rVal = 0.94;
          aoVal = 0.35;
        }

        alb[gIdx] = clampByte(base * 224);
        alb[gIdx + 1] = clampByte(base * 226);
        alb[gIdx + 2] = clampByte(base * 232);
        hgt[idx] = Math.max(0, Math.min(1, h));
        rgh[idx] = clampByte(Math.max(0.42, Math.min(0.98, rVal)) * 255);
        ao[idx] = clampByte(Math.max(0.28, Math.min(1, aoVal)) * 255);
      }
    }
    await writePack('seoul_concrete', alb, hgt, rgh, ao, 3.6);
  }

  // C) pbr_carbon_armor — Military 2x2 Twill Carbon-Fiber Weave & Ballistic Ceramic-Titanium Plates
  {
    const alb = Buffer.alloc(SIZE * SIZE * 3);
    const hgt = new Float32Array(SIZE * SIZE);
    const rgh = Buffer.alloc(SIZE * SIZE);
    const ao = Buffer.alloc(SIZE * SIZE);

    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const idx = y * SIZE + x;
        const gIdx = idx * 3;
        const metalL = (gunmetalRgb[gIdx] * 0.3 + gunmetalRgb[gIdx + 1] * 0.59 + gunmetalRgb[gIdx + 2] * 0.11) / 255;

        // Crisp 2x2 twill carbon weave micro-pattern
        const tx = Math.floor(x / 4);
        const ty = Math.floor(y / 4);
        const twill = ((tx + ty) % 4) < 2 ? 1 : 0;
        const subX = (x % 4) / 4;
        const subY = (y % 4) / 4;
        const fiberArc = twill
          ? Math.sin(subX * Math.PI) * 0.75 + 0.25
          : Math.sin(subY * Math.PI) * 0.75 + 0.25;

        // Recessed machined ballistic armor plate seams (every 128px)
        const px = x % 128;
        const py = y % 128;
        const isSeam = px < 2 || py < 2;
        const isEdgeWear = px === 2 || py === 2;

        // Hex bolt rivets near plate corners
        const bx = Math.min(Math.abs(px - 18), Math.abs(px - 110));
        const by = Math.min(Math.abs(py - 18), Math.abs(py - 110));
        const boltDist = Math.hypot(bx, by);
        const isBoltRim = boltDist >= 4.2 && boltDist < 6.0;
        const isBoltHead = boltDist < 4.2;

        let shade = 0.18 + fiberArc * 0.10 + (twill ? 0.04 : -0.02) + (metalL - 0.5) * 0.14;
        let h = 0.52 + fiberArc * 0.16 + (metalL - 0.5) * 0.12;
        let rVal = (twill ? 0.34 : 0.48) + (1 - metalL) * 0.18;
        let aoVal = 0.92;

        if (isSeam) {
          shade = 0.06;
          h = 0.10;
          rVal = 0.88;
          aoVal = 0.34;
        } else if (isEdgeWear) {
          shade = 0.44;
          h = 0.72;
          rVal = 0.22;
          aoVal = 0.96;
        } else if (isBoltRim) {
          shade = 0.09;
          h = 0.16;
          rVal = 0.85;
          aoVal = 0.40;
        } else if (isBoltHead) {
          shade = 0.38;
          h = 0.82;
          rVal = 0.28;
          aoVal = 0.95;
        }

        alb[gIdx] = clampByte(shade * 228);
        alb[gIdx + 1] = clampByte(shade * 236);
        alb[gIdx + 2] = clampByte(shade * 248);
        hgt[idx] = Math.max(0, Math.min(1, h));
        rgh[idx] = clampByte(Math.max(0.18, Math.min(0.95, rVal)) * 255);
        ao[idx] = clampByte(Math.max(0.28, Math.min(1, aoVal)) * 255);
      }
    }
    await writePack('carbon_armor', alb, hgt, rgh, ao, 3.2);
  }
}

async function main(): Promise<void> {
  console.log('1) Computing Sobel Normal + Roughness + Cavity AO PBR maps from photorealistic albedo textures...');
  for (const spec of PBR_TARGETS) {
    await generatePbrChannels(spec);
  }

  console.log('1b) Building 3 composite photorealistic architectural & carbon-armor PBR packs...');
  await buildCompositePhotoPbrPacks();

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
