import * as THREE from 'three';

export const PBR_TEXTURE_URLS = {
  asphalt: './src/assets/images/pbr_cyber_asphalt_1795255322096.jpg',
  citadelWall: './src/assets/images/pbr_server_citadel_wall_1795255368528.jpg',
  armorPlate: './src/assets/images/pbr_corrugated_armor_1795255343937.jpg',
} as const;

export interface ProceduralTextureSet {
  asphaltMap: THREE.Texture;
  asphaltBump: THREE.CanvasTexture;
  asphaltRoughness: THREE.CanvasTexture;
  citadelWallMap: THREE.Texture;
  citadelWallBump: THREE.CanvasTexture;
  citadelWallEmissive: THREE.CanvasTexture;
  skylineWindowMap: THREE.CanvasTexture;
  armorPlateMap: THREE.Texture;
  armorPlateBump: THREE.CanvasTexture;
  gunmetalBump: THREE.CanvasTexture;
  holoReticleMap: THREE.CanvasTexture;
  sniperReticleMap: THREE.CanvasTexture;
  arcOpticReticleMap: THREE.CanvasTexture;
  concreteMap: THREE.Texture;
  concreteBump: THREE.CanvasTexture;
  crateMap: THREE.CanvasTexture;
  crateBump: THREE.CanvasTexture;
  barrelMap: THREE.CanvasTexture;
  bloodDecals: THREE.CanvasTexture[];
  oilDecal: THREE.CanvasTexture;
  scorchDecal: THREE.CanvasTexture;
  bulletHole: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  vfxExplosionMap: THREE.CanvasTexture;
  vfxSparkMap: THREE.CanvasTexture;
  vfxMuzzleMap: THREE.CanvasTexture;
  vfxBloodMistMap: THREE.CanvasTexture;
  vfxEmpMap: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvasTexture(
  size: number,
  drawFn: (ctx: CanvasRenderingContext2D, s: number) => void,
  opts: { repeat?: number; isColor?: boolean; anisotropy?: number } = {}
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  drawFn(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = opts.isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (opts.repeat && opts.repeat > 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(opts.repeat, opts.repeat);
  }
  if (opts.anisotropy) {
    tex.anisotropy = opts.anisotropy;
  }
  return tex;
}

function loadSeamlessPbrTexture(
  loader: THREE.TextureLoader,
  url: string,
  repeatX: number,
  repeatY: number,
  anisotropy: number
): THREE.Texture {
  const tex = loader.load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  const all: THREE.Texture[] = [];
  const track = <T extends THREE.Texture>(t: T): T => {
    all.push(t);
    return t;
  };

  const loader = new THREE.TextureLoader();

  // 1) Photorealistic seamless 1:1 PBR Albedo maps generated for our cyberpunk AI wasteland
  const asphaltMap = track(
    loadSeamlessPbrTexture(loader, PBR_TEXTURE_URLS.asphalt, 18, 18, maxAnisotropy)
  );
  const citadelWallMap = track(
    loadSeamlessPbrTexture(loader, PBR_TEXTURE_URLS.citadelWall, 2, 2, maxAnisotropy)
  );
  const armorPlateMap = track(
    loadSeamlessPbrTexture(loader, PBR_TEXTURE_URLS.armorPlate, 2, 1, maxAnisotropy)
  );

  // Paired procedural bump / micro-relief maps (linear space)
  const asphaltBump = track(
    makeCanvasTexture(
      256,
      (ctx, s) => {
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 4500; i++) {
          const v = 84 + Math.floor(Math.random() * 96);
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.fillRect(Math.random() * s, Math.random() * s, 2 + Math.random() * 3, 2 + Math.random() * 3);
        }
        ctx.strokeStyle = '#202020';
        ctx.lineWidth = 4;
        ctx.strokeRect(4, 4, s - 8, s - 8);
        ctx.beginPath();
        ctx.moveTo(0, s * 0.5);
        ctx.lineTo(s, s * 0.5);
        ctx.moveTo(s * 0.5, 0);
        ctx.lineTo(s * 0.5, s);
        ctx.stroke();
      },
      { repeat: 18, isColor: false }
    )
  );

  // Paired wet rain-puddle roughness map for asphalt (dark = mirror-slick puddle, light = damp stone grain)
  const asphaltRoughness = track(
    makeCanvasTexture(
      256,
      (ctx, s) => {
        ctx.fillStyle = '#c4c4c4';
        ctx.fillRect(0, 0, s, s);
        // Subtle damp asphalt micro-variation
        for (let i = 0; i < 2400; i++) {
          const v = 165 + ((i * 37) % 60);
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.fillRect((i * 73) % s, (i * 41) % s, 3, 3);
        }
        // Organic glossy rain puddles that mirror neon conduits & explosions
        const puddles: Array<[number, number, number, number]> = [
          [56, 72, 46, 32],
          [178, 54, 42, 26],
          [132, 168, 54, 34],
          [42, 206, 38, 24],
          [214, 198, 34, 28],
        ];
        for (const [px, py, rx, ry] of puddles) {
          const g = ctx.createRadialGradient(px, py, 4, px, py, Math.max(rx, ry));
          g.addColorStop(0, 'rgba(18, 18, 18, 0.96)');
          g.addColorStop(0.58, 'rgba(34, 34, 34, 0.88)');
          g.addColorStop(0.84, 'rgba(110, 110, 110, 0.45)');
          g.addColorStop(1, 'rgba(196, 196, 196, 0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(px, py, rx, ry, 0.35, 0, Math.PI * 2);
          ctx.fill();
        }
      },
      { repeat: 18, isColor: false }
    )
  );

  const citadelWallBump = track(
    makeCanvasTexture(
      256,
      (ctx, s) => {
        ctx.fillStyle = '#8a8a8a';
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = '#181818';
        ctx.lineWidth = 4;
        for (let y = 0; y < s; y += 64) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(s, y);
          ctx.stroke();
        }
        for (let x = 0; x < s; x += 64) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, s);
          ctx.stroke();
        }
        // Vertical server louver ribs
        ctx.fillStyle = '#303030';
        for (let x = 10; x < s; x += 12) {
          ctx.fillRect(x, 12, 3, s - 24);
        }
        // Highlight rivets
        ctx.fillStyle = '#e5e5e5';
        for (let y = 8; y < s; y += 32) {
          for (let x = 8; x < s; x += 32) {
            ctx.fillRect(x, y, 3, 3);
          }
        }
      },
      { repeat: 2, isColor: false }
    )
  );

  // Subtle architectural server-rack emissive status LEDs & recessed data traces
  const citadelWallEmissive = track(
    makeCanvasTexture(
      256,
      (ctx, s) => {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, s, s);
        // Recessed horizontal micro-bus traces
        for (let y = 32; y < s; y += 64) {
          ctx.fillStyle = 'rgba(56, 217, 255, 0.18)';
          ctx.fillRect(10, y - 1, s - 20, 2);
        }
        // Tiny glowing server blade status LEDs
        for (let row = 0; row < 4; row++) {
          for (let col = 0; col < 8; col++) {
            const seed = (row * 13 + col * 29) % 11;
            if (seed < 4) continue;
            const lx = 14 + col * 30;
            const ly = 16 + row * 64;
            ctx.fillStyle =
              seed === 10
                ? 'rgba(255, 68, 34, 0.92)'
                : seed >= 7
                  ? 'rgba(56, 217, 255, 0.85)'
                  : 'rgba(245, 179, 66, 0.72)';
            ctx.fillRect(lx, ly, 7, 2.5);
            if (seed >= 8) {
              ctx.fillStyle = 'rgba(56, 217, 255, 0.35)';
              ctx.fillRect(lx + 10, ly, 4, 2.5);
            }
          }
        }
      },
      { repeat: 2, isColor: true }
    )
  );

  // Cyberpunk Neo-Seoul megacity skyscraper illuminated window grid
  const skylineWindowMap = track(
    makeCanvasTexture(
      256,
      (ctx, s) => {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, s, s);
        const cols = 16;
        const rows = 32;
        const cellW = s / cols;
        const cellH = s / rows;
        for (let r = 1; r < rows - 1; r++) {
          const floorActive = ((r * 17 + 5) % 5) !== 0;
          if (!floorActive) continue;
          const isAccentFloor = r % 9 === 0;
          for (let c = 1; c < cols - 1; c++) {
            const hash = (r * 31 + c * 19 + r * c * 7) % 17;
            if (hash < 9 && !isAccentFloor) continue;
            if (isAccentFloor) {
              ctx.fillStyle = r % 18 === 0 ? '#38d9ff' : '#ff5533';
            } else if (hash >= 15) {
              ctx.fillStyle = '#38d9ff';
            } else if (hash >= 13) {
              ctx.fillStyle = '#ff6b42';
            } else if (hash >= 11) {
              ctx.fillStyle = '#f8c36c';
            } else {
              ctx.fillStyle = '#9ec5e8';
            }
            ctx.fillRect(c * cellW + 2, r * cellH + 2, cellW - 4, cellH - 4);
          }
        }
      },
      { repeat: 1, isColor: true, anisotropy: maxAnisotropy }
    )
  );

  const armorPlateBump = track(
    makeCanvasTexture(
      256,
      (ctx, s) => {
        ctx.fillStyle = '#888888';
        ctx.fillRect(0, 0, s, s);
        // Brushed vertical micro-grain
        for (let i = 0; i < 900; i++) {
          const v = 110 + Math.floor(Math.random() * 48);
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.fillRect(Math.random() * s, Math.random() * s, 1, 14 + Math.random() * 28);
        }
        ctx.strokeStyle = '#141414';
        ctx.lineWidth = 5;
        ctx.strokeRect(6, 6, s - 12, s - 12);
        ctx.strokeStyle = '#d8d8d8';
        ctx.lineWidth = 2;
        ctx.strokeRect(11, 11, s - 22, s - 22);
      },
      { repeat: 2, isColor: false }
    )
  );

  // Brushed gunmetal micro-scratch bump map for first-person weapons & robot chassis
  const gunmetalBump = track(
    makeCanvasTexture(
      256,
      (ctx, s) => {
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 1600; i++) {
          const v = 102 + Math.floor(Math.random() * 54);
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.fillRect(Math.random() * s, Math.random() * s, 20 + Math.random() * 42, 1);
        }
        ctx.strokeStyle = '#383838';
        ctx.lineWidth = 2;
        for (let y = 32; y < s; y += 64) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(s, y);
          ctx.stroke();
        }
      },
      { repeat: 2, isColor: false }
    )
  );

  // Ultra-crisp transparent EOTech-style holographic reflex reticle (256px razor precision, non-glaring)
  const holoReticleMap = track(
    makeCanvasTexture(
      256,
      (ctx, s) => {
        const cx = s / 2;
        const cy = s / 2;
        ctx.clearRect(0, 0, s, s);
        // Subtle segmented outer reflex ring
        ctx.strokeStyle = 'rgba(255, 86, 56, 0.82)';
        ctx.lineWidth = 2.6;
        const r = 56;
        const gaps = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
        for (const a of gaps) {
          ctx.beginPath();
          ctx.arc(cx, cy, r, a + 0.24, a + Math.PI / 2 - 0.24);
          ctx.stroke();
        }
        // Fine cardinal reference ticks
        ctx.strokeStyle = 'rgba(255, 198, 122, 0.88)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(cx - 72, cy);
        ctx.lineTo(cx - 46, cy);
        ctx.moveTo(cx + 46, cy);
        ctx.lineTo(cx + 72, cy);
        ctx.moveTo(cx, cy - 72);
        ctx.lineTo(cx, cy - 46);
        ctx.moveTo(cx, cy + 46);
        ctx.lineTo(cx, cy + 72);
        ctx.stroke();
        // Crisp 2-MOA center illuminated red pinpoint dot
        ctx.fillStyle = '#ff4422';
        ctx.beginPath();
        ctx.arc(cx, cy, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffeae4';
        ctx.beginPath();
        ctx.arc(cx, cy, 1.7, 0, Math.PI * 2);
        ctx.fill();
      },
      { isColor: true }
    )
  );

  // Etched Mil-Dot cyan-white internal scope glass reticle for hollow RAIL-X9 Sniper Scope
  const sniperReticleMap = track(
    makeCanvasTexture(
      256,
      (ctx, s) => {
        const cx = s / 2;
        const cy = s / 2;
        ctx.clearRect(0, 0, s, s);
        ctx.strokeStyle = 'rgba(56, 217, 255, 0.78)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(cx, cy, 94, 0, Math.PI * 2);
        ctx.stroke();
        // Fine crosshair stadia lines with open center precision gap
        ctx.strokeStyle = 'rgba(224, 246, 255, 0.86)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 108, cy);
        ctx.lineTo(cx - 14, cy);
        ctx.moveTo(cx + 14, cy);
        ctx.lineTo(cx + 108, cy);
        ctx.moveTo(cx, cy - 108);
        ctx.lineTo(cx, cy - 14);
        ctx.moveTo(cx, cy + 14);
        ctx.lineTo(cx, cy + 108);
        ctx.stroke();
        // Mil-dot range ticks
        ctx.fillStyle = 'rgba(56, 217, 255, 0.92)';
        for (const d of [-66, -42, -24, 24, 42, 66]) {
          ctx.fillRect(cx + d - 1, cy - 4, 2, 8);
          ctx.fillRect(cx - 4, cy + d - 1, 8, 2);
        }
        ctx.fillStyle = '#38d9ff';
        ctx.beginPath();
        ctx.arc(cx, cy, 2.8, 0, Math.PI * 2);
        ctx.fill();
      },
      { isColor: true }
    )
  );

  // Open transparent ballistic/arc chevron reticle for HYDRA-7 Launcher & ZEUS-MK7 Tesla
  const arcOpticReticleMap = track(
    makeCanvasTexture(
      256,
      (ctx, s) => {
        const cx = s / 2;
        const cy = s / 2;
        ctx.clearRect(0, 0, s, s);
        ctx.strokeStyle = 'rgba(56, 217, 255, 0.85)';
        ctx.lineWidth = 2.6;
        // Center precision chevron
        ctx.beginPath();
        ctx.moveTo(cx - 24, cy + 16);
        ctx.lineTo(cx, cy - 4);
        ctx.lineTo(cx + 24, cy + 16);
        ctx.stroke();
        // Side range brackets
        ctx.strokeStyle = 'rgba(245, 179, 66, 0.82)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(cx - 64, cy - 22);
        ctx.lineTo(cx - 76, cy);
        ctx.lineTo(cx - 64, cy + 22);
        ctx.moveTo(cx + 64, cy - 22);
        ctx.lineTo(cx + 76, cy);
        ctx.lineTo(cx + 64, cy + 22);
        ctx.stroke();
        // Ballistic drop dashes below center
        ctx.fillStyle = 'rgba(245, 179, 66, 0.85)';
        ctx.fillRect(cx - 12, cy + 32, 24, 2);
        ctx.fillRect(cx - 8, cy + 48, 16, 2);
        ctx.fillStyle = '#e0f7ff';
        ctx.beginPath();
        ctx.arc(cx, cy - 4, 3, 0, Math.PI * 2);
        ctx.fill();
      },
      { isColor: true }
    )
  );

  // High-detail sci-fi military supply crate
  const crateMap = track(
    makeCanvasTexture(
      256,
      (ctx, s) => {
        ctx.fillStyle = '#2c2f36';
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = '#111318';
        ctx.lineWidth = 14;
        ctx.strokeRect(7, 7, s - 14, s - 14);
        // Steel corner brackets
        ctx.fillStyle = '#474e5c';
        const b = 34;
        ctx.fillRect(10, 10, b, b);
        ctx.fillRect(s - 10 - b, 10, b, b);
        ctx.fillRect(10, s - 10 - b, b, b);
        ctx.fillRect(s - 10 - b, s - 10 - b, b, b);
        // Amber hazard stripe band
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(18, s * 0.41, s - 36, 46);
        ctx.fillStyle = '#121316';
        ctx.font = '900 28px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SUPPLY', s / 2, s * 0.41 + 33);
        // Micro LED status strip
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(s * 0.34, 24, s * 0.32, 7);
      },
      { isColor: true, anisotropy: maxAnisotropy }
    )
  );

  const crateBump = track(
    makeCanvasTexture(
      128,
      (ctx, s) => {
        ctx.fillStyle = '#848484';
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, s - 8, s - 8);
        ctx.strokeStyle = '#222222';
        ctx.lineWidth = 3;
        ctx.strokeRect(18, 18, s - 36, s - 36);
      },
      { isColor: false }
    )
  );

  const barrelMap = track(
    makeCanvasTexture(
      256,
      (ctx, s) => {
        ctx.fillStyle = '#991b1b';
        ctx.fillRect(0, 0, s, s);
        // Brushed metallic ribbing
        ctx.fillStyle = 'rgba(0,0,0,0.34)';
        ctx.fillRect(0, 32, s, 10);
        ctx.fillRect(0, s - 42, s, 10);
        ctx.fillStyle = '#141519';
        ctx.fillRect(0, 88, s, 74);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(0, 86, s, 5);
        ctx.fillRect(0, 160, s, 5);
        ctx.font = '900 26px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PLASMA CELL', s / 2, 134);
        for (let i = 0; i < 650; i++) {
          ctx.fillStyle = 'rgba(0,0,0,0.22)';
          ctx.fillRect(Math.random() * s, Math.random() * s, 4, 4);
        }
      },
      { isColor: true, anisotropy: maxAnisotropy }
    )
  );

  const bloodDecals = [0, 1, 2].map(() =>
    track(
      makeCanvasTexture(
        256,
        (ctx, s) => {
          const cx = s / 2;
          const cy = s / 2;
          // Synthetic dark crimson-cobalt coolant/oil splatter
          for (let i = 0; i < 28; i++) {
            const ang = Math.random() * Math.PI * 2;
            const dist = Math.pow(Math.random(), 1.6) * (s * 0.42);
            const rx = cx + Math.cos(ang) * dist;
            const ry = cy + Math.sin(ang) * dist;
            const rad = (i < 5 ? 24 : 5) + Math.random() * (i < 5 ? 22 : 16);
            ctx.fillStyle =
              Math.random() > 0.35 ? 'rgba(14, 18, 26, 0.94)' : 'rgba(56, 18, 32, 0.88)';
            ctx.beginPath();
            ctx.ellipse(rx, ry, rad * (1 + Math.random() * 0.6), rad * 0.8, ang, 0, Math.PI * 2);
            ctx.fill();
          }
        },
        { isColor: true }
      )
    )
  );

  const oilDecal = track(
    makeCanvasTexture(
      256,
      (ctx, s) => {
        const cx = s / 2;
        const cy = s / 2;
        for (let i = 0; i < 24; i++) {
          const ang = Math.random() * Math.PI * 2;
          const dist = Math.pow(Math.random(), 1.5) * (s * 0.4);
          const rad = 10 + Math.random() * 28;
          ctx.fillStyle =
            Math.random() > 0.25 ? 'rgba(8, 10, 14, 0.94)' : 'rgba(20, 38, 52, 0.84)';
          ctx.beginPath();
          ctx.arc(cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist, rad, 0, Math.PI * 2);
          ctx.fill();
        }
      },
      { isColor: true }
    )
  );

  const scorchDecal = track(
    makeCanvasTexture(
      256,
      (ctx, s) => {
        const g = ctx.createRadialGradient(s / 2, s / 2, 8, s / 2, s / 2, s * 0.48);
        g.addColorStop(0, 'rgba(5, 4, 4, 0.98)');
        g.addColorStop(0.5, 'rgba(22, 16, 12, 0.78)');
        g.addColorStop(0.8, 'rgba(30, 20, 14, 0.25)');
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
      },
      { isColor: true }
    )
  );

  const bulletHole = track(
    makeCanvasTexture(
      128,
      (ctx, s) => {
        const cx = s / 2;
        const cy = s / 2;
        const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 38);
        g.addColorStop(0, 'rgba(5,5,5,1)');
        g.addColorStop(0.35, 'rgba(45,45,45,0.85)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(15,15,15,0.9)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2 + Math.random() * 0.4;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(a) * 46, cy + Math.sin(a) * 46);
          ctx.stroke();
        }
      },
      { isColor: true }
    )
  );

  const contactShadow = track(
    makeCanvasTexture(
      128,
      (ctx, s) => {
        const g = ctx.createRadialGradient(s / 2, s / 2, 4, s / 2, s / 2, s * 0.48);
        g.addColorStop(0, 'rgba(0,0,0,0.68)');
        g.addColorStop(0.55, 'rgba(0,0,0,0.32)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
      },
      { isColor: true }
    )
  );

  const vfxExplosionMap = track(
    makeCanvasTexture(
      256,
      (ctx, s) => {
        const cx = s / 2;
        const cy = s / 2;
        const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, s * 0.48);
        g.addColorStop(0, 'rgba(255,255,235,1)');
        g.addColorStop(0.22, 'rgba(255,214,88,0.95)');
        g.addColorStop(0.48, 'rgba(249,115,22,0.78)');
        g.addColorStop(0.75, 'rgba(185,28,28,0.38)');
        g.addColorStop(1, 'rgba(24,10,8,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
      },
      { isColor: true }
    )
  );

  const vfxSparkMap = track(
    makeCanvasTexture(
      128,
      (ctx, s) => {
        const cx = s / 2;
        const cy = s / 2;
        const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, s * 0.45);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.3, 'rgba(255,210,110,0.85)');
        g.addColorStop(1, 'rgba(255,110,20,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = 'rgba(255,245,200,0.9)';
        ctx.lineWidth = 3;
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI;
          ctx.beginPath();
          ctx.moveTo(cx - Math.cos(a) * 52, cy - Math.sin(a) * 52);
          ctx.lineTo(cx + Math.cos(a) * 52, cy + Math.sin(a) * 52);
          ctx.stroke();
        }
      },
      { isColor: true }
    )
  );

  const vfxMuzzleMap = track(
    makeCanvasTexture(
      256,
      (ctx, s) => {
        const cx = s / 2;
        const cy = s / 2;
        const g = ctx.createRadialGradient(cx, cy, 3, cx, cy, s * 0.46);
        g.addColorStop(0, 'rgba(255,255,245,1)');
        g.addColorStop(0.25, 'rgba(255,220,115,0.92)');
        g.addColorStop(0.6, 'rgba(249,115,22,0.45)');
        g.addColorStop(1, 'rgba(255,80,10,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
        ctx.fillStyle = 'rgba(255,250,210,0.92)';
        for (let i = 0; i < 6; i++) {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate((i / 6) * Math.PI * 2);
          ctx.beginPath();
          ctx.moveTo(0, -10);
          ctx.lineTo(s * 0.46, 0);
          ctx.lineTo(0, 10);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      },
      { isColor: true }
    )
  );

  const vfxBloodMistMap = track(
    makeCanvasTexture(
      128,
      (ctx, s) => {
        const cx = s / 2;
        const cy = s / 2;
        // Electric oil & plasma spark mist when AI robots are dismembered
        const g = ctx.createRadialGradient(cx, cy, 3, cx, cy, s * 0.46);
        g.addColorStop(0, 'rgba(56,232,255,0.85)');
        g.addColorStop(0.45, 'rgba(249,115,22,0.62)');
        g.addColorStop(1, 'rgba(15,15,22,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
      },
      { isColor: true }
    )
  );

  const vfxEmpMap = track(
    makeCanvasTexture(
      256,
      (ctx, s) => {
        const cx = s / 2;
        const cy = s / 2;
        const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, s * 0.48);
        g.addColorStop(0, 'rgba(240,253,255,1)');
        g.addColorStop(0.28, 'rgba(56,232,255,0.88)');
        g.addColorStop(0.68, 'rgba(14,165,233,0.34)');
        g.addColorStop(1, 'rgba(2,132,199,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = 'rgba(224,242,254,0.95)';
        ctx.lineWidth = 3;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          const midR = s * 0.22;
          const endR = s * 0.45;
          ctx.lineTo(
            cx + Math.cos(a + 0.16) * midR,
            cy + Math.sin(a + 0.16) * midR
          );
          ctx.lineTo(cx + Math.cos(a) * endR, cy + Math.sin(a) * endR);
          ctx.stroke();
        }
      },
      { isColor: true }
    )
  );

  return {
    asphaltMap,
    asphaltBump,
    asphaltRoughness,
    citadelWallMap,
    citadelWallBump,
    citadelWallEmissive,
    skylineWindowMap,
    armorPlateMap,
    armorPlateBump,
    gunmetalBump,
    holoReticleMap,
    sniperReticleMap,
    arcOpticReticleMap,
    concreteMap: citadelWallMap,
    concreteBump: citadelWallBump,
    crateMap,
    crateBump,
    barrelMap,
    bloodDecals,
    oilDecal,
    scorchDecal,
    bulletHole,
    contactShadow,
    vfxExplosionMap,
    vfxSparkMap,
    vfxMuzzleMap,
    vfxBloodMistMap,
    vfxEmpMap,
    dispose: () => {
      for (const t of all) t.dispose();
    },
  };
}
