import * as THREE from 'three';

/**
 * 4-Channel Procedural PBR Synthesizer (Albedo + Tangent-Space Normal + Roughness + AO)
 * Generates crisp physically based surfaces for ROK Special Forces weapons ("필승" engraved),
 * Kevlar tactical gloves, weathered Seoul commercial facades, road markings & military hardware.
 */

export interface PbrChannelPack {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
  aoMap: THREE.Texture;
}

export interface ExtendedPbrLibrary {
  gunmetal: PbrChannelPack;
  rokReceiver: PbrChannelPack;
  kevlarGlove: PbrChannelPack;
  rokCamo: PbrChannelPack;
  sandbag: PbrChannelPack;
  seoulFacade: PbrChannelPack;
  seoulAsphalt: PbrChannelPack;
  skyscraperGlass: PbrChannelPack;
  seoulConcrete: PbrChannelPack;
  carbonArmor: PbrChannelPack;
  k808Armor: PbrChannelPack;
  crosswalkTex: THREE.CanvasTexture;
  roadSlowTex: THREE.CanvasTexture;
  smokePuffTex: THREE.CanvasTexture;
  koreanSigns: Record<string, THREE.CanvasTexture>;
  dispose: () => void;
}

/** Converts a grayscale height canvas into a true Tangent-Space RGB Normal Map via Sobel filter. */
function heightCanvasToNormalTexture(
  heightCanvas: HTMLCanvasElement,
  strength: number,
  repeat = 1
): THREE.CanvasTexture {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const srcCtx = heightCanvas.getContext('2d')!;
  const src = srcCtx.getImageData(0, 0, w, h).data;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext('2d')!;
  const outImg = outCtx.createImageData(w, h);
  const dst = outImg.data;

  const sample = (x: number, y: number): number => {
    const cx = ((x % w) + w) % w;
    const cy = ((y % h) + h) % h;
    return src[(cy * w + cx) * 4] / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);

      const dX = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength;
      const dY = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength;
      const dZ = 1.0;
      const invLen = 1 / Math.hypot(dX, dY, dZ);

      const idx = (y * w + x) * 4;
      dst[idx] = Math.round((-dX * invLen * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round((-dY * invLen * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round((dZ * invLen * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }
  outCtx.putImageData(outImg, 0, 0);

  const tex = new THREE.CanvasTexture(outCanvas);
  tex.colorSpace = THREE.NoColorSpace;
  if (repeat > 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
  }
  return tex;
}

function wrapCanvasTex(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  repeat = 1,
  anisotropy = 4
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat > 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
  }
  tex.anisotropy = anisotropy;
  return tex;
}

function makePack(
  size: number,
  normalStrength: number,
  repeat: number,
  anisotropy: number,
  paint: (
    albedo: CanvasRenderingContext2D,
    height: CanvasRenderingContext2D,
    rough: CanvasRenderingContext2D,
    ao: CanvasRenderingContext2D,
    s: number
  ) => void,
  track: (t: THREE.Texture) => void
): PbrChannelPack {
  const cA = document.createElement('canvas');
  const cH = document.createElement('canvas');
  const cR = document.createElement('canvas');
  const cO = document.createElement('canvas');
  cA.width = cA.height = size;
  cH.width = cH.height = size;
  cR.width = cR.height = size;
  cO.width = cO.height = size;

  paint(
    cA.getContext('2d')!,
    cH.getContext('2d')!,
    cR.getContext('2d')!,
    cO.getContext('2d')!,
    size
  );

  const map = wrapCanvasTex(cA, true, repeat, anisotropy);
  const normalMap = heightCanvasToNormalTexture(cH, normalStrength, repeat);
  const roughnessMap = wrapCanvasTex(cR, false, repeat, anisotropy);
  const aoMap = wrapCanvasTex(cO, false, repeat, anisotropy);
  // Use UV channel 0 so AO maps render cleanly across ALL procedural & GLB meshes in Three.js r151+
  aoMap.channel = 0;
  track(map);
  track(normalMap);
  track(roughnessMap);
  track(aoMap);
  return { map, normalMap, roughnessMap, aoMap };
}

export function createExtendedPbrLibrary(maxAnisotropy: number): ExtendedPbrLibrary {
  const all: THREE.Texture[] = [];
  const track = (t: THREE.Texture) => {
    all.push(t);
  };

  // Real photographic 4-channel PBR loader (loads Albedo JPG + sharp-computed Normal/Roughness/AO PNGs)
  const texLoader = new THREE.TextureLoader();
  const loadPhotoPbrPack = (
    id: string,
    repeatX: number,
    repeatY: number
  ): PbrChannelPack => {
    const cfg = (url: string, isColor: boolean, isAo = false): THREE.Texture => {
      const tex = texLoader.load(url);
      tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeatX, repeatY);
      tex.anisotropy = Math.min(8, maxAnisotropy);
      if (isAo) tex.channel = 0;
      track(tex);
      return tex;
    };
    return {
      map: cfg(`./src/assets/textures/pbr_${id}.jpg`, true),
      normalMap: cfg(`./src/assets/textures/pbr_${id}_normal.png`, false),
      roughnessMap: cfg(`./src/assets/textures/pbr_${id}_roughness.png`, false),
      aoMap: cfg(`./src/assets/textures/pbr_${id}_ao.png`, false, true),
    };
  };

  // 1) Real Photographic Gunmetal Armor Plate PBR (rivets, oil grime, brushed scratches)
  const gunmetal = loadPhotoPbrPack('military_gunmetal', 2, 2);
  // Real Photographic Wet Cracked Seoul Asphalt PBR (sharp 40x40 street tiling for realistic wet puddles)
  const seoulAsphalt = loadPhotoPbrPack('seoul_asphalt_wet', 40, 40);
  // Real Photographic ROK Special Forces Granite Digital Camo & Ballistic Cordura PBR
  const rokCamo = loadPhotoPbrPack('rok_tactical_camo', 2, 2);
  // Real Photographic Battle-Scarred Euljiro Concrete/Tile Commercial Facade PBR
  const seoulFacade = loadPhotoPbrPack('euljiro_facade', 2, 2);
  // Real Photographic Stitched Muddy Burlap Sandbag PBR
  const sandbag = loadPhotoPbrPack('sandbag_burlap', 2, 2);
  // Real Photographic-Composite Seoul Glass Curtain-Wall Skyscraper Facade PBR
  const skyscraperGlass = loadPhotoPbrPack('skyscraper_glass', 2, 4);
  // Real Photographic-Composite Brutalist Korean Architectural Concrete PBR
  const seoulConcrete = loadPhotoPbrPack('seoul_concrete', 2, 2);
  // Real Photographic-Composite Military 2x2 Twill Carbon-Fiber & Ceramic Armor PBR
  const carbonArmor = loadPhotoPbrPack('carbon_armor', 2, 2);

  // 2) ROK Special Forces "필승" Engraved Receiver PBR (kept procedural for razor-sharp Hangul engraving)

  // 2) ROK Special Forces Engraved Rifle Receiver ("필승" Calligraphy + Selector Marks + Serial)
  const rokReceiver = makePack(
    512,
    2.8,
    1,
    maxAnisotropy,
    (a, h, r, o, s) => {
      a.fillStyle = '#38414e';
      a.fillRect(0, 0, s, s);
      h.fillStyle = '#828282';
      h.fillRect(0, 0, s, s);
      r.fillStyle = '#5e5e5e';
      r.fillRect(0, 0, s, s);
      o.fillStyle = '#ececec';
      o.fillRect(0, 0, s, s);

      // Fine matte bead-blasted anodizing grain + edge scratches
      for (let i = 0; i < 3200; i++) {
        const x = (i * 89) % s;
        const y = (i * 47) % s;
        const v = 50 + (i % 20);
        a.fillStyle = `rgb(${v},${v + 4},${v + 10})`;
        a.fillRect(x, y, 3, 2);
        const hv = 120 + (i % 20);
        h.fillStyle = `rgb(${hv},${hv},${hv})`;
        h.fillRect(x, y, 2, 2);
      }

      // Machined lightening pocket & edge highlight
      a.strokeStyle = '#7e8a9c';
      a.lineWidth = 3;
      a.strokeRect(24, 34, s - 48, s - 68);
      h.strokeStyle = '#353535';
      h.lineWidth = 5;
      h.strokeRect(24, 34, s - 48, s - 68);
      o.strokeStyle = '#525252';
      o.lineWidth = 8;
      o.strokeRect(24, 34, s - 48, s - 68);
      r.strokeStyle = '#242424';
      r.lineWidth = 4;
      r.strokeRect(22, 32, s - 44, s - 64);

      // Engraved "필승" brush-style military stencil (inspired by CoD ROK K2/Han-86!)
      const drawEngraving = (
        ctx: CanvasRenderingContext2D,
        col: string,
        mainSize: number,
        subCol: string
      ) => {
        ctx.save();
        ctx.fillStyle = col;
        ctx.font = `900 ${mainSize}px "Noto Sans KR", sans-serif`;
        ctx.textAlign = 'center';
        ctx.translate(s * 0.72, s * 0.48);
        ctx.rotate(-0.16);
        ctx.fillText('필승', 0, 0);
        ctx.restore();

        ctx.fillStyle = subCol;
        ctx.font = '700 20px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText('ROK-ARMS // K-41X 5.56MM', 44, 92);
        ctx.font = '600 16px "JetBrains Mono", monospace';
        ctx.fillText('SN. 2099-00-SEOUL', 44, 120);
        ctx.fillText('안전 · 단발 · 연사', 44, s - 56);
      };

      drawEngraving(a, 'rgba(226, 236, 248, 0.88)', 74, 'rgba(196, 208, 224, 0.72)');
      drawEngraving(h, '#343434', 74, '#444444');
      drawEngraving(r, '#262626', 74, '#363636');
      drawEngraving(o, '#666666', 74, '#777777');

      // Authentic battle-worn metallic scratches across upper receiver
      a.strokeStyle = 'rgba(160, 174, 192, 0.42)';
      r.strokeStyle = '#181818';
      a.lineWidth = 1.5;
      r.lineWidth = 2;
      for (let i = 0; i < 18; i++) {
        const sx = 30 + ((i * 67) % (s - 90));
        const sy = 50 + ((i * 93) % (s - 100));
        a.beginPath();
        a.moveTo(sx, sy);
        a.lineTo(sx + 26 + (i % 30), sy + ((i % 3) - 1) * 9);
        a.stroke();
        r.beginPath();
        r.moveTo(sx, sy);
        r.lineTo(sx + 26 + (i % 30), sy + ((i % 3) - 1) * 9);
        r.stroke();
      }
    },
    track
  );

  // 3) Tactical Carbon-Kevlar Gloved Hand Fabric (Hex Micro-Weave Normal + Matte Suede Roughness)
  const kevlarGlove = makePack(
    256,
    3.0,
    3,
    maxAnisotropy,
    (a, h, r, o, s) => {
      a.fillStyle = '#2d3440';
      a.fillRect(0, 0, s, s);
      h.fillStyle = '#707070';
      h.fillRect(0, 0, s, s);
      r.fillStyle = '#cfcfcf';
      r.fillRect(0, 0, s, s);
      o.fillStyle = '#e4e4e4';
      o.fillRect(0, 0, s, s);

      // Ripstop Kevlar weave pattern
      for (let y = 0; y < s; y += 8) {
        for (let x = 0; x < s; x += 8) {
          const alt = ((x + y) / 8) % 2 === 0;
          a.fillStyle = alt ? '#3a4352' : '#252b36';
          a.fillRect(x + 1, y + 1, 6, 6);
          h.fillStyle = alt ? '#b8b8b8' : '#4a4a4a';
          h.fillRect(x + 1, y + 1, 6, 6);
          o.fillStyle = alt ? '#ececec' : '#a8a8a8';
          o.fillRect(x + 1, y + 1, 6, 6);
        }
      }
      // Reinforced leather stitching seams
      a.strokeStyle = '#2d3340';
      a.lineWidth = 2;
      a.setLineDash([6, 4]);
      a.strokeRect(12, 12, s - 24, s - 24);
      h.strokeStyle = '#dcdcdc';
      h.lineWidth = 2;
      h.setLineDash([6, 4]);
      h.strokeRect(12, 12, s - 24, s - 24);
    },
    track
  );

  // 6) K-808 ROK Military Olive-Drab Chipped Armor PBR
  const k808Armor = makePack(
    256,
    2.4,
    2,
    maxAnisotropy,
    (a, h, r, o, s) => {
      a.fillStyle = '#3c4536';
      a.fillRect(0, 0, s, s);
      h.fillStyle = '#868686';
      h.fillRect(0, 0, s, s);
      r.fillStyle = '#9a9a9a';
      r.fillRect(0, 0, s, s);
      o.fillStyle = '#e4e4e4';
      o.fillRect(0, 0, s, s);

      // Subtle ROK digital camo patches + scorched battle soot
      for (let i = 0; i < 36; i++) {
        const cx = (i * 59) % s;
        const cy = (i * 43) % s;
        a.fillStyle = i % 3 === 0 ? '#2b3227' : i % 3 === 1 ? '#4d5240' : '#24221e';
        a.fillRect(cx, cy, 24 + (i % 26), 12 + (i % 18));
      }
      // Welded armor seam & bolt line
      h.strokeStyle = '#303030';
      h.lineWidth = 4;
      h.strokeRect(8, 8, s - 16, s - 16);
      o.strokeStyle = '#464646';
      o.lineWidth = 7;
      o.strokeRect(8, 8, s - 16, s - 16);
      a.strokeStyle = '#6c747a';
      a.lineWidth = 1.5;
      a.strokeRect(10, 10, s - 20, s - 20);
      r.strokeStyle = '#262626';
      r.lineWidth = 3;
      r.strokeRect(10, 10, s - 20, s - 20);
    },
    track
  );

  // 7) Authentic Korean Crosswalk Zebra Stripes & Road Markings ("정지선 / 천천히")
  const makeCrosswalkTex = (): THREE.CanvasTexture => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, 512, 256);
    // Stop line on side
    g.fillStyle = 'rgba(226, 232, 240, 0.72)';
    g.fillRect(0, 22, 512, 16);
    // Weathered zebra stripes
    for (let x = 22; x < 490; x += 64) {
      g.fillStyle = 'rgba(220, 226, 234, 0.68)';
      g.fillRect(x, 62, 36, 174);
      // Tire wear scuffs cutting across paint
      g.fillStyle = 'rgba(22, 26, 34, 0.36)';
      g.fillRect(x + 6, 84, 14, 130);
    }
    const tex = wrapCanvasTex(c, true, 1, maxAnisotropy);
    track(tex);
    return tex;
  };

  const makeRoadSlowTex = (): THREE.CanvasTexture => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, 512, 256);
    g.strokeStyle = 'rgba(232, 186, 68, 0.72)';
    g.lineWidth = 12;
    g.strokeRect(14, 14, 484, 228);
    g.fillStyle = 'rgba(232, 236, 240, 0.68)';
    g.font = '900 108px "Noto Sans KR", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('천 천 히', 256, 132);
    // Asphalt grime cracks over paint
    for (let i = 0; i < 420; i++) {
      g.fillStyle = 'rgba(18, 22, 30, 0.45)';
      g.fillRect((i * 71) % 512, (i * 39) % 256, 5, 4);
    }
    const tex = wrapCanvasTex(c, true, 1, maxAnisotropy);
    track(tex);
    return tex;
  };

  // 8) Layered Soft Billowing Volumetric Smoke Puff Texture (for Black Oil Smoke, Steam & Gunsmoke)
  const makeSmokePuffTex = (): THREE.CanvasTexture => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d')!;
    const blobs: Array<[number, number, number, number]> = [
      [64, 64, 56, 0.75],
      [48, 54, 38, 0.55],
      [82, 58, 36, 0.52],
      [58, 80, 34, 0.48],
      [74, 44, 30, 0.42],
    ];
    for (const [bx, by, br, op] of blobs) {
      const grad = g.createRadialGradient(bx, by, 4, bx, by, br);
      grad.addColorStop(0, `rgba(255, 255, 255, ${op})`);
      grad.addColorStop(0.55, `rgba(220, 224, 230, ${op * 0.45})`);
      grad.addColorStop(1, 'rgba(200, 204, 210, 0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(bx, by, br, 0, Math.PI * 2);
      g.fill();
    }
    const tex = wrapCanvasTex(c, true, 1, 1);
    track(tex);
    return tex;
  };

  // 9) Authentic Weathered Seoul Street Commercial Signboards (CoD Seoul Map Homage!)
  const makeKoreanSign = (
    bg: string,
    fg: string,
    accent: string,
    title: string,
    sub: string
  ): THREE.CanvasTexture => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 160;
    const g = c.getContext('2d')!;
    g.fillStyle = bg;
    g.fillRect(0, 0, 512, 160);
    g.strokeStyle = accent;
    g.lineWidth = 8;
    g.strokeRect(6, 6, 500, 148);
    // Subtle weathering soot gradient from top/bottom
    const grime = g.createLinearGradient(0, 0, 0, 160);
    grime.addColorStop(0, 'rgba(10, 12, 16, 0.46)');
    grime.addColorStop(0.3, 'rgba(10, 12, 16, 0.08)');
    grime.addColorStop(0.8, 'rgba(10, 12, 16, 0.22)');
    grime.addColorStop(1, 'rgba(10, 12, 16, 0.58)');
    g.fillStyle = grime;
    g.fillRect(0, 0, 512, 160);

    g.fillStyle = fg;
    g.font = '900 66px "Noto Sans KR", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(title, 256, 72);

    g.fillStyle = accent;
    g.font = '700 24px "Noto Sans KR", sans-serif';
    g.fillText(sub, 256, 128);

    // Bullet scuffs & rain wear
    for (let i = 0; i < 65; i++) {
      g.fillStyle = 'rgba(14, 16, 20, 0.35)';
      g.fillRect((i * 83) % 512, (i * 47) % 160, 6 + (i % 10), 3);
    }

    const tex = wrapCanvasTex(c, true, 1, maxAnisotropy);
    track(tex);
    return tex;
  };

  const koreanSigns: Record<string, THREE.CanvasTexture> = {
    bbq: makeKoreanSign('#1a2b4d', '#d0d7e2', '#b83c32', '고기구이 · 생삼겹', '을지로 본점 · 2층'),
    optical: makeKoreanSign('#8b968a', '#163d2d', '#1f5740', '편안한 안경', '콘택트 · 시력검사'),
    kimbap: makeKoreanSign('#1b2538', '#caa132', '#bfc8d4', '김밥 · 분식 24시', '기술및전기서비스 옆'),
    pharmacy: makeKoreanSign('#9ba6b0', '#124264', '#a83030', '을지로 온누리약국', '처방조제 · 응급의약품'),
    mart: makeKoreanSign('#161e29', '#cfd7e3', '#2e88bd', 'NEO-24 편의점', 'ATM · 생필품 · 피난물자'),
    subway: makeKoreanSign('#121a24', '#cfd9e3', '#238c5b', '을지로4가역 3번출구', 'LINE 2 · 지하 대피소 연결'),
  };

  return {
    gunmetal,
    rokReceiver,
    kevlarGlove,
    rokCamo,
    sandbag,
    seoulFacade,
    seoulAsphalt,
    skyscraperGlass,
    seoulConcrete,
    carbonArmor,
    k808Armor,
    crosswalkTex: makeCrosswalkTex(),
    roadSlowTex: makeRoadSlowTex(),
    smokePuffTex: makeSmokePuffTex(),
    koreanSigns,
    dispose: () => {
      for (const t of all) t.dispose();
    },
  };
}
