import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * glTF Model View Scene
 * - Loads a glTF model (.gltf/.glb)
 * - Lets the user orbit/pan/zoom the camera around the model
 *
 * Put models in: /public/models/
 * Default URL:   /models/scene.gltf
 *
 * @param {import('three').WebGLRenderer} renderer
 * @param {{ modelUrl?: string }} [opts]
 */
export function createGltfModelViewScene(renderer, opts = {}) {
  const modelUrl = opts.modelUrl ?? '/models/scene.gltf';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070d);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.01, 2000);
  camera.position.set(2.2, 1.4, 2.2);

  // Lights (works well for most PBR glTFs)
  const hemi = new THREE.HemisphereLight(0xbfd7ff, 0x0b1020, 0.85);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 1.25);
  dir.position.set(3, 6, 4);
  scene.add(dir);

  // Helpers
  const grid = new THREE.GridHelper(10, 20, 0x2a3550, 0x182036);
  grid.position.y = -0.001;
  scene.add(grid);

  // Placeholder object (so the scene is not empty if no model exists yet)
  const placeholder = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x4da3ff, metalness: 0.15, roughness: 0.65 }),
  );
  placeholder.position.set(0, 0.5, 0);
  scene.add(placeholder);

  // Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = true;
  controls.screenSpacePanning = false;
  controls.minDistance = 0.25;
  controls.maxDistance = 50;
  controls.target.set(0, 0.7, 0);
  controls.update();

  // Model loading
  const loader = new GLTFLoader();
  /** @type {THREE.Object3D | null} */
  let modelRoot = null;

  /**
   * Frame the camera/controls around an object.
   * @param {THREE.Object3D} root
   */
  function frameObject(root) {
    const box = new THREE.Box3().setFromObject(root);
    if (box.isEmpty()) return;

    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // Move the orbit target to the model center
    controls.target.copy(center);

    // Compute a distance that fits the object in view
    const maxSize = Math.max(size.x, size.y, size.z);
    const fitOffset = 1.35;
    const fov = (camera.fov * Math.PI) / 180;
    const dist = (maxSize / (2 * Math.tan(fov / 2))) * fitOffset;

    // Place camera in a nice diagonal direction
    const dir = new THREE.Vector3(1, 0.6, 1).normalize();
    camera.position.copy(center).addScaledVector(dir, dist);
    camera.near = Math.max(0.001, dist / 1000);
    camera.far = Math.max(2000, dist * 20);
    camera.updateProjectionMatrix();

    controls.update();
  }

  loader.load(
    modelUrl,
    (gltf) => {
      // Remove placeholder once a model is loaded
      scene.remove(placeholder);

      modelRoot = gltf.scene || gltf.scenes?.[0] || null;
      if (!modelRoot) return;

      scene.add(modelRoot);

      // If the model is huge/tiny, normalize a bit by framing
      frameObject(modelRoot);
    },
    undefined,
    () => {
      // Keep placeholder visible if the model isn't found yet
      modelRoot = null;
    },
  );

  function update(_dt) {
    controls.update();
    if (!modelRoot) {
      placeholder.rotation.y += 0.6 * _dt;
      placeholder.rotation.x += 0.15 * _dt;
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
  }

  return {
    name: 'glTF Model',
    scene,
    camera,
    update,
    resize,
    setActive,
    useMotion: false,
    modelUrl,
  };
}

