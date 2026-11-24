import * as THREE from 'three';

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

export class VolumetricVfxSystem {
  private scene: THREE.Scene;
  private fireballs: ActiveFireball[] = [];
  private shockRings: ActiveShockRing[] = [];
  private tracers: ActiveTracer3D[] = [];
  private sparks: ActiveSparkDart[] = [];
  private smokes: ActiveSmokePlume[] = [];

  // Shared high-efficiency geometries
  private fireballGeo = new THREE.IcosahedronGeometry(1.0, 3);
  private shockRingGeo = new THREE.TorusGeometry(1.0, 0.12, 8, 28);
  private sparkGeo = new THREE.ConeGeometry(0.032, 0.42, 5);
  private smokeGeo = new THREE.DodecahedronGeometry(0.7, 1);
  private unitCylGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
  private upVec = new THREE.Vector3(0, 1, 0);

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.sparkGeo.rotateX(Math.PI / 2);
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

    // 4) Rolling Volumetric Dark Smoke Billows rising from blast core
    const smokeCount = isEmp ? 3 : 6;
    for (let s = 0; s < smokeCount; s++) {
      const sMat = new THREE.MeshLambertMaterial({
        color: isEmp ? 0x1e3a5f : 0x161418,
        transparent: true,
        opacity: 0.78,
      });
      const sMesh = new THREE.Mesh(this.smokeGeo, sMat);
      const ang = (s / smokeCount) * Math.PI * 2 + Math.random() * 0.5;
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

    // 5) High-Velocity Incandescent 3D Shrapnel / Electric Spark Darts
    const sparkCount = Math.min(26, Math.round(14 * scaleFactor));
    const sparkColor = isEmp ? 0x38e8ff : 0xffcc4d;
    this.spawnSparkBurst(pos, new THREE.Vector3(0, 1, 0), sparkCount, sparkColor, 16 * scaleFactor);
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
    } else {
      // 3D Velocity-Stretched Dual-Layer Ballistic Plasma/Tracer Slug
      const radiusCore = kind === 'laser' ? 0.032 : 0.024;
      const radiusGlow = kind === 'laser' ? 0.082 : 0.064;
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

    // 3) Update 3D Volumetric Tracers & Railgun Helices
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
      const fade = 1 - p;
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
  }

  public dispose(): void {
    this.clear();
    this.fireballGeo.dispose();
    this.shockRingGeo.dispose();
    this.sparkGeo.dispose();
    this.smokeGeo.dispose();
    this.unitCylGeo.dispose();
  }
}
