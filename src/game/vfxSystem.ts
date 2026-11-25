import * as THREE from 'three';
import type { SmokePlumeAnchor } from './worldBuilder';

/**
 * 100x Volumetric Shader VFX & 3D Ballistic System
 * Replaces flat 2D lines and single-color spheres with custom GLSL turbulent FBM blackbody
 * fireballs, animated Fresnel EMP lightning cages, 3D dual-sheath volumetric tracers,
 * coiled helical railgun arcs, velocity-stretched shrapnel darts, and rolling volumetric smoke.
 */

const NOISE_GLSL = `
  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  float noise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash31(i + vec3(0,0,0)), hash31(i + vec3(1,0,0)), f.x),
          mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
          mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }
  float fbm3(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += a * noise3(p);
      p = p * 2.04 + vec3(13.7, 7.1, 19.3);
      a *= 0.5;
    }
    return v;
  }
`;

function createFireballShaderMaterial(isEmp: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: isEmp ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uSeed: { value: Math.random() * 25.0 },
      uIsEmp: { value: isEmp ? 1.0 : 0.0 },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uProgress;
      uniform float uSeed;
      varying vec3 vNormalDir;
      varying vec3 vViewDir;
      varying float vNoise;
      ${NOISE_GLSL}
      void main() {
        vec3 nPos = normal * 2.4 + vec3(uSeed, uTime * 2.8, uSeed * 0.5);
        float n = fbm3(nPos);
        vNoise = n;
        // Boiling billowing turbulent displacement
        float disp = (n - 0.35) * (0.48 + uProgress * 0.65);
        vec3 displaced = position + normal * disp;
        vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
        vNormalDir = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uProgress;
      uniform float uIsEmp;
      varying vec3 vNormalDir;
      varying vec3 vViewDir;
      varying float vNoise;
      void main() {
        float fresnel = pow(1.0 - max(0.0, dot(normalize(vNormalDir), normalize(vViewDir))), 2.2);
        // Erosion dissolves turbulent fireball into billowing embers & smoke
        float erode = vNoise - uProgress * 0.92;
        if (erode < 0.02) discard;

        if (uIsEmp > 0.5) {
          // Electric EMP Geodesic Plasma Arc Cage
          float arc = smoothstep(0.45, 0.72, sin(vNoise * 26.0 + uTime * 18.0) * 0.5 + 0.5);
          vec3 col = mix(vec3(0.05, 0.62, 0.98), vec3(0.88, 0.99, 1.0), arc * 0.8 + fresnel);
          float alpha = clamp((fresnel * 0.85 + arc * 0.65) * (1.0 - uProgress), 0.0, 0.95);
          gl_FragColor = vec4(col * 1.4, alpha);
          return;
        }

        // Physical Blackbody Heat Gradient: 5000K White Core -> Gold -> Molten Orange -> Crimson -> Soot Smoke
        float heat = clamp(vNoise * 1.35 - uProgress * 1.12 + (1.0 - fresnel) * 0.25, 0.0, 1.0);
        vec3 soot = vec3(0.07, 0.06, 0.07);
        vec3 crimson = vec3(0.75, 0.11, 0.04);
        vec3 orange = vec3(1.0, 0.42, 0.06);
        vec3 gold = vec3(1.0, 0.86, 0.34);
        vec3 whiteHot = vec3(1.0, 0.99, 0.92);

        vec3 col = mix(soot, crimson, smoothstep(0.12, 0.34, heat));
        col = mix(col, orange, smoothstep(0.32, 0.56, heat));
        col = mix(col, gold, smoothstep(0.54, 0.76, heat));
        col = mix(col, whiteHot, smoothstep(0.76, 0.94, heat));

        // Glowing hot fissures peeking through cooling smoke shell
        col += vec3(1.0, 0.38, 0.05) * fresnel * (1.0 - uProgress) * 0.55;
        float alpha = clamp(smoothstep(0.02, 0.26, erode) * (1.0 - uProgress * 0.88), 0.0, 0.96);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

function createShockRingMaterial(colorHex: number): THREE.ShaderMaterial {
  const c = new THREE.Color(colorHex);
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: c },
      uProgress: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uProgress;
      varying vec2 vUv;
      void main() {
        float edge = sin(vUv.y * 3.14159);
        float band = pow(max(0.0, edge), 1.6);
        float alpha = band * (1.0 - uProgress) * 0.9;
        vec3 col = mix(uColor, vec3(1.0, 0.97, 0.9), band * 0.55);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

interface ActiveFireball {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  age: number;
  maxAge: number;
  startScale: number;
  endScale: number;
  riseSpeed: number;
}

interface ActiveShockRing {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  age: number;
  maxAge: number;
  maxScale: number;
}

interface ActiveTracer3D {
  group: THREE.Group;
  age: number;
  maxAge: number;
  materials: THREE.Material[];
  geometries: THREE.BufferGeometry[];
  /** Optional supersonic flying streak motion (realistic CoD/Battlefield projectile travel!) */
  travel?: {
    start: THREE.Vector3;
    dir: THREE.Vector3;
    totalLen: number;
    streakLen: number;
  };
}

interface ActiveSparkDart {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  maxAge: number;
  gravity: number;
  bounce: boolean;
}

interface ActiveSmokePlume {
  mesh: THREE.Mesh;
  mat: THREE.MeshLambertMaterial;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  maxAge: number;
  baseScale: number;
  growRate: number;
}

interface ActiveVolumetricPuff {
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  vx: number;
  vy: number;
  vz: number;
  rotSpeed: number;
  age: number;
  maxAge: number;
  startScale: number;
  endScale: number;
  peakOpacity: number;
  isFire: boolean;
}

interface ActiveDebrisChip {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  age: number;
  maxAge: number;
}

export class VolumetricVfxSystem {
  private scene: THREE.Scene;
  private fireballs: ActiveFireball[] = [];
  private shockRings: ActiveShockRing[] = [];
  private tracers: ActiveTracer3D[] = [];
  private sparks: ActiveSparkDart[] = [];
  private smokes: ActiveSmokePlume[] = [];
  private puffs: ActiveVolumetricPuff[] = [];
  private ambientPuffs: ActiveVolumetricPuff[] = [];
  private debrisChips: ActiveDebrisChip[] = [];
  private smokePuffTex: THREE.Texture | null = null;
  private muzzleAxialTex: THREE.Texture | null = null;
  private ambientEmitAccum = 0;

  // Shared high-efficiency geometries
  private fireballGeo = new THREE.IcosahedronGeometry(1.0, 3);
  private shockRingGeo = new THREE.TorusGeometry(1.0, 0.12, 8, 28);
  private sparkGeo = new THREE.ConeGeometry(0.032, 0.42, 5);
  private smokeGeo = new THREE.DodecahedronGeometry(0.7, 1);
  private debrisGeo = new THREE.DodecahedronGeometry(0.068, 0);
  private concreteChipMat = new THREE.MeshStandardMaterial({
    color: 0x737982,
    roughness: 0.92,
    metalness: 0.05,
  });
  private unitCylGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
  private upVec = new THREE.Vector3(0, 1, 0);

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.sparkGeo.rotateX(Math.PI / 2);
  }

  public setSmokeTexture(tex: THREE.Texture): void {
    this.smokePuffTex = tex;
  }

  public setMuzzleAxialTexture(tex: THREE.Texture): void {
    this.muzzleAxialTex = tex;
  }

  /**
   * Spawns a multi-layered AAA volumetric explosion:
   * - Custom GLSL turbulent FBM blackbody fireball + inner flash core
   * - Dual expanding Mach shockwave rings (ground + tilted oblique)
   * - Rising billowing dark soot smoke plumes
   * - Velocity-stretched incandescent 3D shrapnel darts with gravity & floor bounce
   */
  public spawnExplosion(pos: THREE.Vector3, radius: number, isEmp = false): void {
    const scaleFactor = Math.max(0.65, radius / 6.5);

    // 1) Primary Boiling Turbulent GLSL Fireball (or EMP Geodesic Lightning Cage)
    const fbMat = createFireballShaderMaterial(isEmp);
    const fbMesh = new THREE.Mesh(this.fireballGeo, fbMat);
    fbMesh.position.copy(pos);
    fbMesh.position.y = Math.max(0.45, pos.y + 0.3);
    this.scene.add(fbMesh);
    this.fireballs.push({
      mesh: fbMesh,
      mat: fbMat,
      age: 0,
      maxAge: isEmp ? 0.62 : 0.88,
      startScale: 0.45 * scaleFactor,
      endScale: (isEmp ? 5.2 : 3.9) * scaleFactor,
      riseSpeed: isEmp ? 0.4 : 2.3,
    });

    // 2) Secondary offset turbulent fire lobe for asymmetric organic explosion silhouette
    if (!isEmp) {
      for (let i = 0; i < 2; i++) {
        const subMat = createFireballShaderMaterial(false);
        const subMesh = new THREE.Mesh(this.fireballGeo, subMat);
        subMesh.position.set(
          pos.x + (Math.random() - 0.5) * 1.6 * scaleFactor,
          Math.max(0.6, pos.y + 0.6 + i * 0.65),
          pos.z + (Math.random() - 0.5) * 1.6 * scaleFactor
        );
        this.scene.add(subMesh);
        this.fireballs.push({
          mesh: subMesh,
          mat: subMat,
          age: 0,
          maxAge: 0.72 + i * 0.16,
          startScale: 0.35 * scaleFactor,
          endScale: (2.6 + i * 0.7) * scaleFactor,
          riseSpeed: 3.1 + i * 0.9,
        });
      }
    }

    // 3) Dual Expanding Mach Shockwave Torus Rings (horizontal blast wave + tilted air refraction wave)
    const ringColors = isEmp ? [0x38e8ff, 0x818cf8] : [0xffa938, 0xff4518];
    for (let r = 0; r < 2; r++) {
      const rMat = createShockRingMaterial(ringColors[r]);
      const rMesh = new THREE.Mesh(this.shockRingGeo, rMat);
      rMesh.position.copy(pos);
      rMesh.position.y = r === 0 ? Math.max(0.25, pos.y * 0.4) : pos.y + 0.5;
      rMesh.rotation.x = r === 0 ? Math.PI / 2 : Math.PI / 2 + (Math.random() - 0.5) * 0.65;
      rMesh.rotation.y = Math.random() * Math.PI;
      this.scene.add(rMesh);
      this.shockRings.push({
        mesh: rMesh,
        mat: rMat,
        age: 0,
        maxAge: 0.46 + r * 0.14,
        maxScale: radius * (r === 0 ? 1.08 : 0.78),
      });
    }

    // 4) Soft Volumetric Billowing Smoke Sprites rising from blast core (replaces faceted polyhedral rock balls!)
    const smokeCount = isEmp ? 4 : 9;
    for (let s = 0; s < smokeCount; s++) {
      const ang = (s / smokeCount) * Math.PI * 2 + Math.random() * 0.6;
      if (this.smokePuffTex) {
        const spMat = new THREE.SpriteMaterial({
          map: this.smokePuffTex,
          color: isEmp ? 0x2c5c8a : 0x1e1d20,
          transparent: true,
          opacity: 0.72,
          depthWrite: false,
        });
        const sp = new THREE.Sprite(spMat);
        sp.position.set(
          pos.x + Math.cos(ang) * 0.85 * scaleFactor,
          Math.max(0.5, pos.y + 0.45),
          pos.z + Math.sin(ang) * 0.85 * scaleFactor
        );
        const startS = (1.6 + Math.random() * 0.9) * scaleFactor;
        sp.scale.set(startS, startS, 1);
        this.scene.add(sp);
        this.puffs.push({
          sprite: sp,
          mat: spMat,
          vx: Math.cos(ang) * (1.4 + Math.random() * 1.9),
          vy: 2.6 + Math.random() * 2.5,
          vz: Math.sin(ang) * (1.4 + Math.random() * 1.9),
          age: 0,
          maxAge: 1.85 + Math.random() * 0.85,
          startScale: startS,
          endScale: startS * 3.1,
          peakOpacity: 0.72,
          rotSpeed: (Math.random() - 0.5) * 0.55,
          isFire: false,
        });
      } else {
        const sMat = new THREE.MeshLambertMaterial({
          color: isEmp ? 0x1e3a5f : 0x161418,
          transparent: true,
          opacity: 0.72,
        });
        const sMesh = new THREE.Mesh(this.smokeGeo, sMat);
        sMesh.position.set(
          pos.x + Math.cos(ang) * 0.9 * scaleFactor,
          Math.max(0.5, pos.y + 0.5),
          pos.z + Math.sin(ang) * 0.9 * scaleFactor
        );
        this.scene.add(sMesh);
        this.smokes.push({
          mesh: sMesh,
          mat: sMat,
          vx: Math.cos(ang) * (1.8 + Math.random() * 2.2),
          vy: 3.4 + Math.random() * 3.2,
          vz: Math.sin(ang) * (1.8 + Math.random() * 2.2),
          age: 0,
          maxAge: 1.35 + Math.random() * 0.65,
          baseScale: (0.9 + Math.random() * 0.6) * scaleFactor,
          growRate: 2.4 * scaleFactor,
        });
      }
    }

    // 5) High-Velocity Incandescent 3D Shrapnel / Electric Spark Darts
    const sparkCount = Math.min(26, Math.round(14 * scaleFactor));
    const sparkColor = isEmp ? 0x38e8ff : 0xffcc4d;
    this.spawnSparkBurst(pos, new THREE.Vector3(0, 1, 0), sparkCount, sparkColor, 16 * scaleFactor);
  }

  /**
   * Deploys a dense tactical M18 white-grey military smoke curtain that visually & physically
   * conceals players from enemy snipers and automatic fire for 8+ seconds.
   */
  public spawnTacticalSmokeScreen(pos: THREE.Vector3, radius = 5.4, durationSec = 8.5): void {
    if (!this.smokePuffTex) return;
    const count = 18;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const dist = (0.15 + Math.random() * 0.72) * radius;
      const mat = new THREE.SpriteMaterial({
        map: this.smokePuffTex,
        color: i % 3 === 0 ? 0x9aa4b0 : 0x7b8591,
        transparent: true,
        opacity: 0.02,
        depthWrite: false,
      });
      const sp = new THREE.Sprite(mat);
      sp.position.set(
        pos.x + Math.cos(ang) * dist * 0.45,
        0.9 + Math.random() * 1.9,
        pos.z + Math.sin(ang) * dist * 0.45
      );
      const startS = 2.4 + Math.random() * 1.2;
      sp.scale.set(startS, startS, 1);
      this.scene.add(sp);
      this.puffs.push({
        sprite: sp,
        mat,
        vx: Math.cos(ang) * (dist / 4.2),
        vy: 0.26 + Math.random() * 0.25,
        vz: Math.sin(ang) * (dist / 4.2),
        age: 0,
        maxAge: durationSec + Math.random() * 1.6,
        startScale: startS,
        endScale: startS * 2.55,
        peakOpacity: 0.78,
        rotSpeed: (Math.random() - 0.5) * 0.24,
        isFire: false,
      });
    }
  }

  /**
   * Spawns a 3D volumetric ballistic tracer or coiled helical electromagnetic railgun beam.
   * ZERO flat 1px 2D lines!
   */
  public spawnBallisticTracer(
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    colorHex: number,
    kind: 'bullet' | 'railgun' | 'laser' = 'bullet',
    dur = 0.09
  ): void {
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const len = dir.length();
    if (len < 0.08) return;
    const normDir = dir.clone().divideScalar(len);
    const quat = new THREE.Quaternion().setFromUnitVectors(this.upVec, normDir);
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

    const group = new THREE.Group();
    const materials: THREE.Material[] = [];
    const geometries: THREE.BufferGeometry[] = [];

    if (kind === 'railgun') {
      // Blazing white inner plasma lance + outer cyan energy sheath + 3D spiral coil arc + shock rings!
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.98,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sheathMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      materials.push(coreMat, sheathMat);

      const core = new THREE.Mesh(this.unitCylGeo, coreMat);
      core.position.copy(mid);
      core.quaternion.copy(quat);
      core.scale.set(0.055, len, 0.055);
      group.add(core);

      const sheath = new THREE.Mesh(this.unitCylGeo, sheathMat);
      sheath.position.copy(mid);
      sheath.quaternion.copy(quat);
      sheath.scale.set(0.16, len, 0.16);
      group.add(sheath);

      // 3D Helical Plasma Arc coiling around the beam
      const right = new THREE.Vector3(1, 0, 0);
      if (Math.abs(normDir.x) > 0.9) right.set(0, 0, 1);
      const uAxis = new THREE.Vector3().crossVectors(normDir, right).normalize();
      const vAxis = new THREE.Vector3().crossVectors(normDir, uAxis).normalize();
      const pts: THREE.Vector3[] = [];
      const steps = Math.min(28, Math.max(10, Math.floor(len * 0.9)));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const ang = t * Math.PI * 10;
        const rad = 0.24 * Math.sin(t * Math.PI);
        const pt = p1
          .clone()
          .addScaledVector(normDir, len * t)
          .addScaledVector(uAxis, Math.cos(ang) * rad)
          .addScaledVector(vAxis, Math.sin(ang) * rad);
        pts.push(pt);
      }
      const helixGeo = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(pts),
        steps * 2,
        0.028,
        5,
        false
      );
      geometries.push(helixGeo);
      group.add(new THREE.Mesh(helixGeo, sheathMat));

      // Ionized Shock-Rings spaced along the railgun path
      const ringCount = Math.min(5, Math.max(2, Math.floor(len / 7)));
      for (let r = 1; r <= ringCount; r++) {
        const t = r / (ringCount + 1);
        const rPos = p1.clone().addScaledVector(normDir, len * t);
        const rMat = createShockRingMaterial(colorHex);
        const rMesh = new THREE.Mesh(this.shockRingGeo, rMat);
        rMesh.position.copy(rPos);
        rMesh.quaternion.copy(quat);
        rMesh.rotateX(Math.PI / 2);
        this.scene.add(rMesh);
        this.shockRings.push({
          mesh: rMesh,
          mat: rMat,
          age: 0,
          maxAge: 0.38,
          maxScale: 1.25,
        });
      }
    } else if (kind === 'bullet') {
      // Photorealistic High-Speed Traveling Ballistic Tracer Streak (finite incandescent slug racing to target!)
      const streakLen = Math.min(len, Math.max(2.6, Math.min(9.5, len * 0.28)));
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xfffaf0,
        transparent: true,
        opacity: 0.96,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const glowMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.62,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      materials.push(coreMat, glowMat);

      const core = new THREE.Mesh(this.unitCylGeo, coreMat);
      core.scale.set(0.015, streakLen, 0.015);
      group.add(core);

      const glow = new THREE.Mesh(this.unitCylGeo, glowMat);
      glow.scale.set(0.044, streakLen * 1.12, 0.044);
      group.add(glow);

      group.quaternion.copy(quat);
      group.position.copy(p1).addScaledVector(normDir, streakLen * 0.5);
      this.scene.add(group);
      this.tracers.push({
        group,
        age: 0,
        maxAge: Math.max(0.055, Math.min(0.14, len / 260)),
        materials,
        geometries,
        travel: {
          start: p1.clone(),
          dir: normDir,
          totalLen: len,
          streakLen,
        },
      });
      return;
    } else {
      // Laser / Directed Energy Beam
      const radiusCore = 0.026;
      const radiusGlow = 0.068;
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xfff8e7,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const glowMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.68,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      materials.push(coreMat, glowMat);

      const core = new THREE.Mesh(this.unitCylGeo, coreMat);
      core.position.copy(mid);
      core.quaternion.copy(quat);
      core.scale.set(radiusCore, len, radiusCore);
      group.add(core);

      const glow = new THREE.Mesh(this.unitCylGeo, glowMat);
      glow.position.copy(mid);
      glow.quaternion.copy(quat);
      glow.scale.set(radiusGlow, len, radiusGlow);
      group.add(glow);
    }

    this.scene.add(group);
    this.tracers.push({
      group,
      age: 0,
      maxAge: kind === 'railgun' ? Math.max(dur, 0.34) : Math.max(dur, 0.095),
      materials,
      geometries,
    });
  }

  /**
   * Spawns a 3D jagged volumetric chain-lightning arc with forked side-bolt for ZEUS-MK7 & Ascension FX.
   */
  public spawnLightningArc(
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    colorHex = 0x38e8ff,
    dur = 0.24
  ): void {
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const len = dir.length();
    if (len < 0.15) return;
    const norm = dir.clone().divideScalar(len);
    const ref = Math.abs(norm.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const u = new THREE.Vector3().crossVectors(norm, ref).normalize();
    const v = new THREE.Vector3().crossVectors(norm, u).normalize();

    const segs = Math.min(14, Math.max(6, Math.floor(len * 0.7)));
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const amp = Math.sin(t * Math.PI) * Math.min(1.15, len * 0.085);
      const jitterU = (Math.random() - 0.5) * 2 * amp;
      const jitterV = (Math.random() - 0.5) * 2 * amp;
      pts.push(
        p1
          .clone()
          .addScaledVector(norm, len * t)
          .addScaledVector(u, jitterU)
          .addScaledVector(v, jitterV)
      );
    }

    const group = new THREE.Group();
    const materials: THREE.Material[] = [];
    const geometries: THREE.BufferGeometry[] = [];

    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.98,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glowMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    materials.push(coreMat, glowMat);

    const curve = new THREE.CatmullRomCurve3(pts);
    const coreGeo = new THREE.TubeGeometry(curve, segs * 2, 0.032, 5, false);
    const glowGeo = new THREE.TubeGeometry(curve, segs * 2, 0.11, 5, false);
    geometries.push(coreGeo, glowGeo);
    group.add(new THREE.Mesh(coreGeo, coreMat));
    group.add(new THREE.Mesh(glowGeo, glowMat));

    // Forked secondary branch off mid-bolt for authentic Tesla silhouette
    if (pts.length >= 4) {
      const midIdx = Math.floor(pts.length * 0.45);
      const branchStart = pts[midIdx].clone();
      const branchMid = branchStart
        .clone()
        .addScaledVector(norm, len * 0.14)
        .addScaledVector(u, (Math.random() - 0.5) * 1.4)
        .addScaledVector(v, (Math.random() - 0.5) * 1.4);
      const branchEnd = branchMid
        .clone()
        .addScaledVector(norm, len * 0.12)
        .addScaledVector(u, (Math.random() - 0.5) * 1.6);
      const forkGeo = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([branchStart, branchMid, branchEnd]),
        8,
        0.025,
        4,
        false
      );
      geometries.push(forkGeo);
      group.add(new THREE.Mesh(forkGeo, glowMat));
    }

    this.scene.add(group);
    this.tracers.push({
      group,
      age: 0,
      maxAge: dur,
      materials,
      geometries,
    });
  }

  /**
   * Spawns a dramatic sky-to-ground orbital beacon pillar + ground shockwave ring.
   */
  public spawnOrbitalBeam(x: number, z: number, colorHex = 0x34d399, dur = 1.25): void {
    const group = new THREE.Group();
    const materials: THREE.Material[] = [];
    const geometries: THREE.BufferGeometry[] = [];

    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const outerMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.52,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    materials.push(innerMat, outerMat);

    const innerGeo = new THREE.CylinderGeometry(0.28, 0.52, 68, 10, 1, true);
    const outerGeo = new THREE.CylinderGeometry(0.95, 1.85, 68, 12, 1, true);
    geometries.push(innerGeo, outerGeo);

    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.position.set(x, 34, z);
    const outer = new THREE.Mesh(outerGeo, outerMat);
    outer.position.set(x, 34, z);
    group.add(inner, outer);

    this.scene.add(group);
    this.tracers.push({
      group,
      age: 0,
      maxAge: dur,
      materials,
      geometries,
    });

    const rMat = createShockRingMaterial(colorHex);
    const rMesh = new THREE.Mesh(this.shockRingGeo, rMat);
    rMesh.position.set(x, 0.25, z);
    rMesh.rotation.x = Math.PI / 2;
    this.scene.add(rMesh);
    this.shockRings.push({
      mesh: rMesh,
      mat: rMat,
      age: 0,
      maxAge: 0.72,
      maxScale: 9.5,
    });
  }

  /**
   * Velocity-stretched incandescent 3D spark darts arcing from metallic impacts & robot dismemberments.
   */
  public spawnSparkBurst(
    pos: THREE.Vector3,
    normal: THREE.Vector3,
    count: number,
    colorHex: number,
    speed = 11
  ): void {
    const capped = Math.min(count, 24);
    for (let i = 0; i < capped; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? 0xffffff : colorHex,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.sparkGeo, mat);
      mesh.position.copy(pos);
      const vx = normal.x * speed * 0.45 + (Math.random() - 0.5) * speed * 1.15;
      const vy = Math.abs(normal.y) * speed * 0.45 + (0.25 + Math.random() * 0.9) * speed * 0.7;
      const vz = normal.z * speed * 0.45 + (Math.random() - 0.5) * speed * 1.15;
      mesh.lookAt(pos.x + vx, pos.y + vy, pos.z + vz);
      this.scene.add(mesh);
      this.sparks.push({
        mesh,
        vx,
        vy,
        vz,
        age: 0,
        maxAge: 0.24 + Math.random() * 0.32,
        gravity: 24,
        bounce: true,
      });
    }
  }

  private spawnVolumetricPuff(opts: {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    colorHex: number;
    startScale: number;
    endScale: number;
    peakOpacity: number;
    maxAge: number;
    isFire?: boolean;
    cap?: number;
    ambient?: boolean;
  }): void {
    if (!this.smokePuffTex) return;
    const pool = opts.ambient ? this.ambientPuffs : this.puffs;
    const cap = opts.cap ?? (opts.ambient ? 88 : 96);
    if (pool.length >= cap) {
      const oldest = pool.shift();
      if (oldest) {
        this.scene.remove(oldest.sprite);
        oldest.mat.dispose();
      }
    }
    const mat = new THREE.SpriteMaterial({
      map: this.smokePuffTex,
      color: opts.colorHex,
      transparent: true,
      opacity: 0.01,
      blending: opts.isFire ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false,
      rotation: Math.random() * Math.PI * 2,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(opts.x, opts.y, opts.z);
    sprite.scale.set(opts.startScale, opts.startScale, 1);
    this.scene.add(sprite);
    pool.push({
      sprite,
      mat,
      vx: opts.vx,
      vy: opts.vy,
      vz: opts.vz,
      rotSpeed: (Math.random() - 0.5) * 0.65,
      age: 0,
      maxAge: opts.maxAge,
      startScale: opts.startScale,
      endScale: opts.endScale,
      peakOpacity: opts.peakOpacity,
      isFire: Boolean(opts.isFire),
    });
  }

  /**
   * Photorealistic World-Space 3D Crossed-Plane Muzzle Blast (120mm K2-X Tank Cannon, M134, Enemy Fire)
   * Renders crossed supersonic Mach flame jets + propellant gas cloud + hot ember sparks!
   */
  public spawnRealisticMuzzleBlast(
    pos: THREE.Vector3,
    dir: THREE.Vector3,
    colorHex = 0xffc864,
    scale = 1.0
  ): void {
    const normDir = dir.clone().normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), normDir);

    if (this.muzzleAxialTex) {
      const grp = new THREE.Group();
      grp.position.copy(pos);
      grp.quaternion.copy(quat);
      const roll = Math.random() * Math.PI * 2;
      const len = 1.15 * scale;
      const wid = 0.56 * scale;
      const geo = new THREE.PlaneGeometry(len, wid);
      geo.translate(len * 0.48, 0, 0);
      const mat = new THREE.MeshBasicMaterial({
        map: this.muzzleAxialTex,
        color: colorHex,
        transparent: true,
        opacity: 0.96,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const p1 = new THREE.Mesh(geo, mat);
      p1.rotation.x = roll;
      const p2 = new THREE.Mesh(geo, mat);
      p2.rotation.x = roll + Math.PI / 2;
      grp.add(p1, p2);
      this.scene.add(grp);
      this.tracers.push({
        group: grp,
        age: 0,
        maxAge: 0.065 + scale * 0.02,
        materials: [mat],
        geometries: [geo],
      });
    }

    // Pressurized muzzle gas blast + glowing spark spray
    const puffCount = scale >= 1.5 ? 4 : 2;
    for (let i = 0; i < puffCount; i++) {
      this.spawnVolumetricPuff({
        x: pos.x + normDir.x * (0.25 * scale) + (Math.random() - 0.5) * 0.22 * scale,
        y: pos.y + normDir.y * (0.25 * scale) + (Math.random() - 0.5) * 0.14 * scale,
        z: pos.z + normDir.z * (0.25 * scale) + (Math.random() - 0.5) * 0.22 * scale,
        vx: normDir.x * (2.6 * scale) + (Math.random() - 0.5) * 1.4 * scale,
        vy: 0.6 + Math.random() * 0.65 * scale,
        vz: normDir.z * (2.6 * scale) + (Math.random() - 0.5) * 1.4 * scale,
        colorHex: i === 0 ? 0xd8d2c8 : 0x7c828c,
        startScale: 0.35 * scale,
        endScale: (1.5 + i * 0.55) * scale,
        peakOpacity: scale >= 1.5 ? 0.55 : 0.34,
        maxAge: 0.65 + Math.random() * 0.45,
        isFire: false,
      });
    }
    this.spawnSparkBurst(pos, normDir, Math.min(12, Math.round(4 * scale)), colorHex, 8 + scale * 4);
  }

  /**
   * Continuously emits Call of Duty–style towering black oil smoke columns from burning K-808 APCs
   * and wide drifting cool-white ground steam curtains across Neo-Seoul storm drains.
   */
  public updateAmbientPlumes(
    plumes: readonly SmokePlumeAnchor[],
    dt: number,
    quality: 'ultra' | 'high'
  ): void {
    const cap = quality === 'ultra' ? 86 : 48;
    const interval = quality === 'ultra' ? 0.17 : 0.3;
    this.ambientEmitAccum += dt;

    if (this.ambientEmitAccum >= interval && plumes.length > 0 && this.smokePuffTex) {
      this.ambientEmitAccum = 0;
      for (let i = 0; i < plumes.length; i++) {
        const anchor = plumes[i];
        if (anchor.kind === 'oil_fire') {
          this.spawnVolumetricPuff({
            x: anchor.x + (Math.random() - 0.5) * 1.4,
            y: anchor.y + Math.random() * 0.6,
            z: anchor.z + (Math.random() - 0.5) * 1.4,
            vx: 0.65 + (Math.random() - 0.35) * 0.65,
            vy: 2.35 + Math.random() * 1.15,
            vz: -0.35 + (Math.random() - 0.5) * 0.55,
            colorHex: Math.random() > 0.25 ? 0x111216 : 0x1d1e24,
            startScale: 1.7 + Math.random() * 0.8,
            endScale: 6.2 + Math.random() * 2.4,
            peakOpacity: 0.72,
            maxAge: 3.4 + Math.random() * 1.4,
            isFire: false,
            cap,
            ambient: true,
          });
          if (Math.random() < 0.72) {
            this.spawnVolumetricPuff({
              x: anchor.x + (Math.random() - 0.5) * 1.1,
              y: anchor.y - 0.2 + Math.random() * 0.4,
              z: anchor.z + (Math.random() - 0.5) * 1.1,
              vx: (Math.random() - 0.5) * 0.45,
              vy: 1.55 + Math.random() * 0.75,
              vz: (Math.random() - 0.5) * 0.45,
              colorHex: Math.random() > 0.4 ? 0xff6b1c : 0xffaa33,
              startScale: 1.05 + Math.random() * 0.45,
              endScale: 2.1 + Math.random() * 0.55,
              peakOpacity: 0.46,
              maxAge: 0.52 + Math.random() * 0.34,
              isFire: true,
              cap,
              ambient: true,
            });
          }
        } else if (Math.random() < 0.52) {
          this.spawnVolumetricPuff({
            x: anchor.x + (Math.random() - 0.5) * 3.4,
            y: anchor.y + 0.45 + Math.random() * 0.5,
            z: anchor.z + (Math.random() - 0.5) * 3.4,
            vx: 1.15 + Math.random() * 0.85,
            vy: 0.28 + Math.random() * 0.26,
            vz: (Math.random() - 0.5) * 0.45,
            colorHex: 0xbac8d6,
            startScale: 3.0 + Math.random() * 1.2,
            endScale: 7.4 + Math.random() * 2.6,
            peakOpacity: 0.24,
            maxAge: 3.3 + Math.random() * 1.5,
            isFire: false,
            cap,
            ambient: true,
          });
        }
      }
    }

    const stepPool = (pool: ActiveVolumetricPuff[]) => {
      for (let i = pool.length - 1; i >= 0; i--) {
        const pf = pool[i];
        pf.age += dt;
        const p = pf.age / pf.maxAge;
        if (p >= 1) {
          this.scene.remove(pf.sprite);
          pf.mat.dispose();
          pool.splice(i, 1);
          continue;
        }
        pf.sprite.position.x += pf.vx * dt * (1 - p * 0.35);
        pf.sprite.position.y += pf.vy * dt * (1 - p * 0.25);
        pf.sprite.position.z += pf.vz * dt * (1 - p * 0.35);
        pf.mat.rotation += pf.rotSpeed * dt;
        const sc = pf.startScale + (pf.endScale - pf.startScale) * Math.pow(p, 0.78);
        pf.sprite.scale.set(sc, sc, 1);
        const fadeIn = Math.min(1, p / 0.16);
        const fadeOut = Math.pow(1 - p, pf.isFire ? 1.5 : 1.15);
        pf.mat.opacity = pf.peakOpacity * fadeIn * fadeOut;
      }
    };
    stepPool(this.ambientPuffs);
    stepPool(this.puffs);
  }

  /**
   * Delicate rising cordite gunsmoke wisps curling off the barrel/suppressor after each shot.
   */
  public spawnGunsmoke(pos: THREE.Vector3, dir: THREE.Vector3): void {
    for (let i = 0; i < 2; i++) {
      this.spawnVolumetricPuff({
        x: pos.x + dir.x * (i * 0.14) + (Math.random() - 0.5) * 0.05,
        y: pos.y + 0.02 + i * 0.02,
        z: pos.z + dir.z * (i * 0.14) + (Math.random() - 0.5) * 0.05,
        vx: dir.x * (i === 0 ? 1.4 : 0.45) + (Math.random() - 0.5) * 0.35,
        vy: 0.48 + Math.random() * 0.42,
        vz: dir.z * (i === 0 ? 1.4 : 0.45) + (Math.random() - 0.5) * 0.35,
        colorHex: i === 0 ? 0xd2d8e0 : 0x9ca4b0,
        startScale: i === 0 ? 0.14 : 0.1,
        endScale: i === 0 ? 0.62 : 0.85,
        peakOpacity: i === 0 ? 0.34 : 0.22,
        maxAge: 0.62 + Math.random() * 0.36 + i * 0.18,
        isFire: false,
      });
    }
  }

  /**
   * Surface-aware concrete bullet impact: puffs of pulverized gray dust + tumbling concrete rock chips.
   */
  public spawnConcreteImpact(pos: THREE.Vector3, normal: THREE.Vector3): void {
    for (let d = 0; d < 2; d++) {
      this.spawnVolumetricPuff({
        x: pos.x + normal.x * 0.08 + (Math.random() - 0.5) * 0.08,
        y: pos.y + normal.y * 0.08 + (Math.random() - 0.5) * 0.08,
        z: pos.z + normal.z * 0.08 + (Math.random() - 0.5) * 0.08,
        vx: normal.x * (1.2 + Math.random() * 1.1) + (Math.random() - 0.5) * 0.9,
        vy: normal.y * 0.8 + 0.65 + Math.random() * 0.55,
        vz: normal.z * (1.2 + Math.random() * 1.1) + (Math.random() - 0.5) * 0.9,
        colorHex: 0x9398a0,
        startScale: 0.22,
        endScale: 1.05 + d * 0.25,
        peakOpacity: 0.56,
        maxAge: 0.58 + Math.random() * 0.25,
        isFire: false,
        cap: 112,
      });
    }

    const chipCount = 5;
    for (let i = 0; i < chipCount; i++) {
      if (this.debrisChips.length >= 64) {
        const old = this.debrisChips.shift();
        if (old) this.scene.remove(old.mesh);
      }
      const mesh = new THREE.Mesh(this.debrisGeo, this.concreteChipMat);
      mesh.position.copy(pos).addScaledVector(normal, 0.06);
      const s = 0.65 + Math.random() * 0.95;
      mesh.scale.set(s, s * 0.75, s * 1.15);
      this.scene.add(mesh);
      this.debrisChips.push({
        mesh,
        vx: normal.x * (3.2 + Math.random() * 3.5) + (Math.random() - 0.5) * 4.2,
        vy: normal.y * 2.5 + 1.8 + Math.random() * 3.6,
        vz: normal.z * (3.2 + Math.random() * 3.5) + (Math.random() - 0.5) * 4.2,
        rx: (Math.random() - 0.5) * 18,
        ry: (Math.random() - 0.5) * 18,
        age: 0,
        maxAge: 0.65 + Math.random() * 0.45,
      });
    }
  }

  /**
   * Builds a multi-part 3D guided missile mesh for HYDRA-7 Rocket Launcher (warhead + fins + thruster glow).
   */
  public static buildMissileMesh(): THREE.Group {
    const grp = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x2c3340,
      roughness: 0.32,
      metalness: 0.85,
    });
    const noseMat = new THREE.MeshStandardMaterial({
      color: 0xd9480f,
      roughness: 0.38,
      metalness: 0.5,
    });
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xffaa2b,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
    });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.68, 10), bodyMat);
    body.rotation.x = Math.PI / 2;
    grp.add(body);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.092, 0.28, 10), noseMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = 0.48;
    grp.add(nose);

    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.24, 0.2), bodyMat);
      fin.rotation.z = (i / 4) * Math.PI;
      fin.position.z = -0.26;
      grp.add(fin);
    }

    const exhaust = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.55, 8), flameMat);
    exhaust.rotation.x = -Math.PI / 2;
    exhaust.position.z = -0.62;
    grp.add(exhaust);

    return grp;
  }

  public update(dt: number): void {
    // 1) Update GLSL Turbulent Fireballs
    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      const fb = this.fireballs[i];
      fb.age += dt;
      const p = Math.min(1, fb.age / fb.maxAge);
      if (p >= 1) {
        this.scene.remove(fb.mesh);
        fb.mat.dispose();
        this.fireballs.splice(i, 1);
        continue;
      }
      const easeOut = 1 - Math.pow(1 - p, 2.4);
      const sc = fb.startScale + (fb.endScale - fb.startScale) * easeOut;
      fb.mesh.scale.setScalar(sc);
      fb.mesh.position.y += fb.riseSpeed * dt * (1 - p * 0.5);
      fb.mesh.rotation.y += dt * 1.4;
      fb.mat.uniforms.uTime.value = fb.age;
      fb.mat.uniforms.uProgress.value = p;
    }

    // 2) Update Mach Shockwave Rings
    for (let i = this.shockRings.length - 1; i >= 0; i--) {
      const sr = this.shockRings[i];
      sr.age += dt;
      const p = Math.min(1, sr.age / sr.maxAge);
      if (p >= 1) {
        this.scene.remove(sr.mesh);
        sr.mat.dispose();
        this.shockRings.splice(i, 1);
        continue;
      }
      const ease = 1 - Math.pow(1 - p, 2.2);
      sr.mesh.scale.setScalar(0.35 + sr.maxScale * ease);
      sr.mat.uniforms.uProgress.value = p;
    }

    // 3) Update 3D Volumetric Tracers, Supersonic Traveling Streaks & Railgun Helices
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.age += dt;
      const p = Math.min(1, tr.age / tr.maxAge);
      if (p >= 1) {
        this.scene.remove(tr.group);
        for (const m of tr.materials) m.dispose();
        for (const g of tr.geometries) g.dispose();
        this.tracers.splice(i, 1);
        continue;
      }
      if (tr.travel) {
        const distRange = Math.max(0.1, tr.travel.totalLen - tr.travel.streakLen);
        const centerDist = tr.travel.streakLen * 0.5 + distRange * p;
        tr.group.position.copy(tr.travel.start).addScaledVector(tr.travel.dir, centerDist);
      }
      const fade = tr.travel ? Math.min(1, (1 - p) * 2.2) : 1 - p;
      for (const m of tr.materials) {
        if ('opacity' in m) (m as THREE.MeshBasicMaterial).opacity = fade * 0.9;
      }
    }

    // 4) Update Velocity-Stretched Shrapnel Spark Darts
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      sp.age += dt;
      if (sp.age >= sp.maxAge) {
        this.scene.remove(sp.mesh);
        (sp.mesh.material as THREE.Material).dispose();
        this.sparks.splice(i, 1);
        continue;
      }
      sp.vy -= sp.gravity * dt;
      const nx = sp.mesh.position.x + sp.vx * dt;
      let ny = sp.mesh.position.y + sp.vy * dt;
      const nz = sp.mesh.position.z + sp.vz * dt;
      if (sp.bounce && ny < 0.08) {
        ny = 0.08;
        sp.vy = Math.abs(sp.vy) * 0.45;
        sp.vx *= 0.72;
        sp.vz *= 0.72;
      }
      sp.mesh.position.set(nx, ny, nz);
      sp.mesh.lookAt(nx + sp.vx, ny + sp.vy, nz + sp.vz);
      const speedLen = Math.max(0.25, Math.hypot(sp.vx, sp.vy, sp.vz) * 0.08);
      sp.mesh.scale.set(1, 1, speedLen);
      (sp.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - sp.age / sp.maxAge;
    }

    // 5) Update Volumetric Rolling Smoke Plumes
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const sm = this.smokes[i];
      sm.age += dt;
      const p = Math.min(1, sm.age / sm.maxAge);
      if (p >= 1) {
        this.scene.remove(sm.mesh);
        sm.mat.dispose();
        this.smokes.splice(i, 1);
        continue;
      }
      sm.mesh.position.x += sm.vx * dt * (1 - p * 0.6);
      sm.mesh.position.y += sm.vy * dt * (1 - p * 0.4);
      sm.mesh.position.z += sm.vz * dt * (1 - p * 0.6);
      sm.mesh.rotation.x += dt * 0.9;
      sm.mesh.rotation.y += dt * 1.1;
      sm.mesh.scale.setScalar(sm.baseScale + p * sm.growRate);
      sm.mat.opacity = 0.74 * (1 - p);
    }

    // 6) Update physical concrete debris rock chips
    for (let i = this.debrisChips.length - 1; i >= 0; i--) {
      const ch = this.debrisChips[i];
      ch.age += dt;
      if (ch.age >= ch.maxAge) {
        this.scene.remove(ch.mesh);
        this.debrisChips.splice(i, 1);
        continue;
      }
      ch.vy -= 22 * dt;
      ch.mesh.position.x += ch.vx * dt;
      ch.mesh.position.y += ch.vy * dt;
      ch.mesh.position.z += ch.vz * dt;
      ch.mesh.rotation.x += ch.rx * dt;
      ch.mesh.rotation.y += ch.ry * dt;
      if (ch.mesh.position.y < 0.05) {
        ch.mesh.position.y = 0.05;
        ch.vy = Math.abs(ch.vy) * 0.36;
        ch.vx *= 0.62;
        ch.vz *= 0.62;
      }
    }
  }

  public clear(): void {
    for (const fb of this.fireballs) {
      this.scene.remove(fb.mesh);
      fb.mat.dispose();
    }
    this.fireballs.length = 0;

    for (const sr of this.shockRings) {
      this.scene.remove(sr.mesh);
      sr.mat.dispose();
    }
    this.shockRings.length = 0;

    for (const tr of this.tracers) {
      this.scene.remove(tr.group);
      for (const m of tr.materials) m.dispose();
      for (const g of tr.geometries) g.dispose();
    }
    this.tracers.length = 0;

    for (const sp of this.sparks) {
      this.scene.remove(sp.mesh);
      (sp.mesh.material as THREE.Material).dispose();
    }
    this.sparks.length = 0;

    for (const sm of this.smokes) {
      this.scene.remove(sm.mesh);
      sm.mat.dispose();
    }
    this.smokes.length = 0;

    for (const ch of this.debrisChips) {
      this.scene.remove(ch.mesh);
    }
    this.debrisChips.length = 0;
  }

  public dispose(): void {
    this.clear();
    for (const pf of this.puffs) {
      this.scene.remove(pf.sprite);
      pf.mat.dispose();
    }
    this.puffs.length = 0;
    for (const pf of this.ambientPuffs) {
      this.scene.remove(pf.sprite);
      pf.mat.dispose();
    }
    this.ambientPuffs.length = 0;
    this.fireballGeo.dispose();
    this.shockRingGeo.dispose();
    this.sparkGeo.dispose();
    this.smokeGeo.dispose();
    this.debrisGeo.dispose();
    this.concreteChipMat.dispose();
    this.unitCylGeo.dispose();
  }
}
