import * as THREE from 'three';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Creates a minimal scene intended to showcase a texture/mesh clearly:
 * - no starfield
 * - no fog
 * - no "ship" indicator / white glow element
 *
 * @param {HTMLCanvasElement} canvas
 */
export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 300);
  camera.position.set(0, 0, 0);

  scene.add(camera);

  function resize(w, h, dpr) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(clamp(dpr, 1, 2));
    renderer.setSize(w, h, false);
  }

  /**
   * @param {number} dt
   */
  function update(_dt) {
    // Intentionally empty: keep visuals clean for texture/mesh display.
  }

  return { renderer, scene, camera, update, resize };
}

