import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

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

  // Placeholder (visible if the model is missing)
  const placeholder = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 48, 48),
    new THREE.MeshStandardMaterial({ color: 0x2f6fff, roughness: 0.75, metalness: 0.05 }),
  );
  scene.add(placeholder);

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
      scene.remove(placeholder);
      modelRoot = gltf.scene || gltf.scenes?.[0] || null;
      if (!modelRoot) return;
      scene.add(modelRoot);
      const { size } = centerObjectAtOrigin(modelRoot);
      frameSizeAtOrigin(Math.max(1, size));
    },
    undefined,
    () => {
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
      placeholder.rotation.y += 0.35 * _dt;
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

