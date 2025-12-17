import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function hash2D(x, y) {
  // Deterministic pseudo-random in [0,1)
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function valueNoise2D(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;

  const a = hash2D(xi, yi);
  const b = hash2D(xi + 1, yi);
  const c = hash2D(xi, yi + 1);
  const d = hash2D(xi + 1, yi + 1);

  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);

  const ab = a * (1 - u) + b * u;
  const cd = c * (1 - u) + d * u;
  return ab * (1 - v) + cd * v;
}

function fbm2D(x, y) {
  // Simple fractal noise (4 octaves)
  let f = 0;
  let amp = 0.55;
  let freq = 1.0;
  for (let i = 0; i < 4; i++) {
    f += amp * valueNoise2D(x * freq, y * freq);
    freq *= 2.0;
    amp *= 0.5;
  }
  return f;
}

/**
 * Build a decent-looking Earth fallback when the glTF is missing.
 * @param {import('three').WebGLRenderer} renderer
 */
function createEarthFallback(renderer) {
  const group = new THREE.Group();

  const TEX_W = 1024;
  const TEX_H = 512;

  // Diffuse (day) texture
  const dayCanvas = document.createElement('canvas');
  dayCanvas.width = TEX_W;
  dayCanvas.height = TEX_H;
  const dayCtx = dayCanvas.getContext('2d');
  if (!dayCtx) return { group, earthMesh: null, cloudsMesh: null };

  const dayImg = dayCtx.getImageData(0, 0, TEX_W, TEX_H);
  const d = dayImg.data;

  // Heightmap for bump
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = TEX_W;
  bumpCanvas.height = TEX_H;
  const bumpCtx = bumpCanvas.getContext('2d');
  const bumpImg = bumpCtx ? bumpCtx.getImageData(0, 0, TEX_W, TEX_H) : null;
  const b = bumpImg?.data || null;

  for (let y = 0; y < TEX_H; y++) {
    const v = y / (TEX_H - 1); // [0..1]
    const lat = (v - 0.5) * Math.PI; // [-pi/2..pi/2]
    const latAbs = Math.abs(lat);

    // Ice caps near poles
    const ice = smoothstep(1.1, 0.75, latAbs);

    for (let x = 0; x < TEX_W; x++) {
      const u = x / (TEX_W - 1); // [0..1]

      // Continental noise in lon/lat space (with a few warps)
      const nx = u * 6.0 + 12.0 * Math.sin(lat * 0.7);
      const ny = v * 3.0 + 9.0 * Math.cos(u * Math.PI * 2);
      const n = fbm2D(nx, ny);

      // Land mask: tuned so we get more ocean than land
      const land = smoothstep(0.52, 0.72, n);

      // Shallow ocean bands for visual depth
      const coast = smoothstep(0.40, 0.55, n);
      const deep = smoothstep(0.0, 0.45, n);

      // Base colors
      let r = 0;
      let g = 0;
      let bl = 0;

      // Ocean: deep -> shallow
      const oceanR = 10 + 10 * (1 - deep) + 18 * coast;
      const oceanG = 28 + 26 * (1 - deep) + 28 * coast;
      const oceanB = 60 + 90 * (1 - deep) + 45 * coast;

      // Land: coast green -> inland brown
      const elev = smoothstep(0.65, 0.9, n);
      const landR = 22 + 60 * elev;
      const landG = 55 + 80 * (1 - elev);
      const landB = 20 + 35 * (1 - elev);

      // Mix ocean/land
      r = oceanR * (1 - land) + landR * land;
      g = oceanG * (1 - land) + landG * land;
      bl = oceanB * (1 - land) + landB * land;

      // Ice caps
      const iceR = 235;
      const iceG = 242;
      const iceB = 250;
      r = r * (1 - ice) + iceR * ice;
      g = g * (1 - ice) + iceG * ice;
      bl = bl * (1 - ice) + iceB * ice;

      const idx = (y * TEX_W + x) * 4;
      d[idx + 0] = r;
      d[idx + 1] = g;
      d[idx + 2] = bl;
      d[idx + 3] = 255;

      if (b) {
        // Bump: emphasize land (and a bit of mountainous variation)
        const h = clamp(0.25 * land + 0.55 * elev + 0.15 * (n - 0.5), 0, 1);
        const hv = Math.floor(h * 255);
        b[idx + 0] = hv;
        b[idx + 1] = hv;
        b[idx + 2] = hv;
        b[idx + 3] = 255;
      }
    }
  }

  dayCtx.putImageData(dayImg, 0, 0);
  bumpCtx?.putImageData(bumpImg, 0, 0);

  const maxAniso = renderer.capabilities.getMaxAnisotropy?.() || 1;

  const dayTex = new THREE.CanvasTexture(dayCanvas);
  dayTex.colorSpace = THREE.SRGBColorSpace;
  dayTex.wrapS = THREE.RepeatWrapping;
  dayTex.wrapT = THREE.ClampToEdgeWrapping;
  dayTex.anisotropy = Math.min(8, maxAniso);
  dayTex.needsUpdate = true;

  const bumpTex = bumpImg ? new THREE.CanvasTexture(bumpCanvas) : null;
  if (bumpTex) {
    bumpTex.colorSpace = THREE.NoColorSpace;
    bumpTex.wrapS = THREE.RepeatWrapping;
    bumpTex.wrapT = THREE.ClampToEdgeWrapping;
    bumpTex.anisotropy = Math.min(8, maxAniso);
    bumpTex.needsUpdate = true;
  }

  // Clouds texture (RGBA): soft alpha map + slightly bluish/white color.
  const cloudsCanvas = document.createElement('canvas');
  cloudsCanvas.width = TEX_W;
  cloudsCanvas.height = TEX_H;
  const cctx = cloudsCanvas.getContext('2d');
  if (!cctx) return { group, earthMesh: null, cloudsMesh: null };

  const cloudsImg = cctx.getImageData(0, 0, TEX_W, TEX_H);
  const cd = cloudsImg.data;
  const rand = mulberry32(1337);
  for (let y = 0; y < TEX_H; y++) {
    const v = y / (TEX_H - 1);
    const lat = (v - 0.5) * Math.PI;
    const band = 1.0 - smoothstep(0.9, 1.35, Math.abs(lat)); // fewer clouds near poles
    for (let x = 0; x < TEX_W; x++) {
      const u = x / (TEX_W - 1);
      const nx = u * 10.0;
      const ny = v * 5.0;
      const n = fbm2D(nx + 80.0, ny + 40.0);
      const puffs = smoothstep(0.62, 0.83, n) * band;
      const streak = smoothstep(0.55, 0.78, fbm2D(nx * 1.8 + 12.0, ny * 2.2 + 92.0));
      const a = clamp(0.85 * puffs + 0.25 * streak, 0, 1);

      // Slight per-pixel brightness variation
      const jitter = (rand() - 0.5) * 0.08;
      const base = clamp(0.92 + jitter, 0, 1);

      const idx = (y * TEX_W + x) * 4;
      cd[idx + 0] = Math.floor(255 * base);
      cd[idx + 1] = Math.floor(255 * base);
      cd[idx + 2] = Math.floor(255 * (base + 0.02));
      cd[idx + 3] = Math.floor(255 * a);
    }
  }
  cctx.putImageData(cloudsImg, 0, 0);

  const cloudsTex = new THREE.CanvasTexture(cloudsCanvas);
  cloudsTex.colorSpace = THREE.SRGBColorSpace;
  cloudsTex.wrapS = THREE.RepeatWrapping;
  cloudsTex.wrapT = THREE.ClampToEdgeWrapping;
  cloudsTex.anisotropy = Math.min(8, maxAniso);
  cloudsTex.needsUpdate = true;

  const R = 0.6;
  const earthGeo = new THREE.SphereGeometry(R, 96, 96);
  const earthMat = new THREE.MeshStandardMaterial({
    map: dayTex,
    bumpMap: bumpTex || null,
    bumpScale: 0.05,
    roughness: 0.92,
    metalness: 0.0,
  });

  const earthMesh = new THREE.Mesh(earthGeo, earthMat);
  earthMesh.castShadow = false;
  earthMesh.receiveShadow = false;
  group.add(earthMesh);

  const cloudsGeo = new THREE.SphereGeometry(R * 1.007, 96, 96);
  const cloudsMat = new THREE.MeshStandardMaterial({
    map: cloudsTex,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    roughness: 1.0,
    metalness: 0.0,
  });
  const cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
  cloudsMesh.renderOrder = 2;
  group.add(cloudsMesh);

  // Simple atmosphere glow
  const atmoGeo = new THREE.SphereGeometry(R * 1.02, 96, 96);
  const atmoMat = new THREE.MeshBasicMaterial({
    color: 0x5aaeff,
    transparent: true,
    opacity: 0.08,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
  atmosphere.renderOrder = 3;
  group.add(atmosphere);

  return { group, earthMesh, cloudsMesh };
}

/**
 * Earth View Scene
 * - Loads an Earth glTF model from /public/models/earth/
 * - Centers it at (0,0,0)
 * - Adds an "infinite" starfield (camera-attached)
 * - Orbit controls (swipe rotate + pinch/wheel zoom)
 * - Optional background music (started from user gesture)
 *
 * Expected assets:
 * - /public/models/earth/scene.gltf (+ referenced .bin/.png/etc)
 * - /public/Music/earth_background.mp3
 *
 * @param {import('three').WebGLRenderer} renderer
 * @param {{ modelUrl?: string, musicUrl?: string }} [opts]
 */
export function createEarthViewScene(renderer, opts = {}) {
  const modelUrl = opts.modelUrl ?? '/models/earth/scene.gltf';
  const musicUrl = opts.musicUrl ?? '/Music/earth_background.mp3';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000008);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.01, 4000);
  camera.position.set(0, 0.6, 2.6);
  scene.add(camera);

  // Lights (PBR-friendly)
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const key = new THREE.DirectionalLight(0xffffff, 1.35);
  key.position.set(4, 6, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc6ff, 0.55);
  rim.position.set(-6, 2.5, -4);
  scene.add(rim);

  // "Infinite" stars: attach to camera so they act like a skybox.
  const STAR_COUNT = 9000;
  const STAR_RADIUS = 650;
  const starPositions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    // Random point on a sphere (uniform)
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const x = STAR_RADIUS * Math.sin(phi) * Math.cos(theta);
    const y = STAR_RADIUS * Math.cos(phi);
    const z = STAR_RADIUS * Math.sin(phi) * Math.sin(theta);
    const idx = i * 3;
    starPositions[idx + 0] = x;
    starPositions[idx + 1] = y;
    starPositions[idx + 2] = z;
  }

  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1.25,
    sizeAttenuation: false, // looks more "infinite"
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  camera.add(stars);

  // Fallback Earth (visible if the model is missing)
  const { group: fallbackEarth, earthMesh: fallbackEarthMesh, cloudsMesh: fallbackCloudsMesh } =
    createEarthFallback(renderer);
  scene.add(fallbackEarth);

  // Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 0.45;
  controls.maxDistance = 35;
  controls.minPolarAngle = 0.05;
  controls.maxPolarAngle = Math.PI - 0.05;
  controls.target.set(0, 0, 0);
  controls.update();

  // Model loading
  const loader = new GLTFLoader();
  /** @type {THREE.Object3D | null} */
  let modelRoot = null;

  /**
   * Center the object at origin (keeps the model visually centered).
   * @param {THREE.Object3D} root
   */
  function centerObjectAtOrigin(root) {
    const box = new THREE.Box3().setFromObject(root);
    if (box.isEmpty()) return { size: 1, center: new THREE.Vector3(0, 0, 0) };
    const center = new THREE.Vector3();
    const sizeV = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(sizeV);
    root.position.sub(center); // move so center becomes (0,0,0)
    return { size: Math.max(sizeV.x, sizeV.y, sizeV.z), center };
  }

  /**
   * Frame camera/controls around a size at the origin.
   * @param {number} maxSize
   */
  function frameSizeAtOrigin(maxSize) {
    const fitOffset = 1.35;
    const fov = (camera.fov * Math.PI) / 180;
    const dist = (maxSize / (2 * Math.tan(fov / 2))) * fitOffset;
    const dir = new THREE.Vector3(1, 0.35, 1).normalize();
    camera.position.set(0, 0, 0).addScaledVector(dir, dist);
    camera.near = Math.max(0.001, dist / 1000);
    camera.far = Math.max(4000, dist * 30);
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
    controls.update();
  }

  loader.load(
    modelUrl,
    (gltf) => {
      scene.remove(fallbackEarth);
      modelRoot = gltf.scene || gltf.scenes?.[0] || null;
      if (!modelRoot) return;
      scene.add(modelRoot);
      const { size } = centerObjectAtOrigin(modelRoot);
      frameSizeAtOrigin(Math.max(1, size));
    },
    undefined,
    (err) => {
      // Keep fallback visible. Helpful hint for the common "missing file" case.
      // eslint-disable-next-line no-console
      console.warn(`[Earth] Failed to load model at ${modelUrl}. Using fallback Earth.`, err);
      modelRoot = null;
    },
  );

  // Music: keep it simple with HTMLAudioElement (requires user gesture to start on mobile).
  const music = new Audio(musicUrl);
  music.loop = true;
  music.preload = 'auto';
  music.volume = 0.55;
  let wantsMusic = false;

  async function tryStartMusic() {
    if (!wantsMusic) return;
    try {
      await music.play();
    } catch {
      // Autoplay blocked until user gesture; main.js will call onUserGesture() on pointerdown.
    }
  }

  function update(_dt) {
    controls.update();
    if (!modelRoot) {
      if (fallbackEarthMesh) fallbackEarthMesh.rotation.y += 0.10 * _dt;
      if (fallbackCloudsMesh) fallbackCloudsMesh.rotation.y += 0.14 * _dt;
    }
  }

  function resize(w, h, dpr) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(clamp(dpr, 1, 2));
    renderer.setSize(w, h, false);
  }

  /**
   * Called by the app when switching views.
   * @param {boolean} isActive
   */
  function setActive(isActive) {
    controls.enabled = !!isActive;
    wantsMusic = !!isActive;
    if (wantsMusic) {
      tryStartMusic();
    } else {
      music.pause();
    }
  }

  function onUserGesture() {
    // Start (or resume) music if this view is active.
    tryStartMusic();
  }

  return {
    name: 'Earth',
    scene,
    camera,
    update,
    resize,
    setActive,
    onUserGesture,
    useMotion: false,
    modelUrl,
    musicUrl,
  };
}

