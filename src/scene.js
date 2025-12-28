import * as THREE from 'three';
import { createConstellationLayer } from './constellations.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Pulsar View Scene:
 * A simple "space" scene:
 * - starfield (Points)
 * - subtle fog
 * - centered pulsar indicator with fast pulsations (attached to camera)
 * - forward-movement illusion by moving stars toward the camera
 *
 * @param {import('three').WebGLRenderer} renderer
 */
export function createPulsarViewScene(renderer) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000008, 0.018);

  const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 300);
  camera.position.set(0, 0, 0);

  // Center indicator: plain white circle (attached to camera so it's always centered).
  // Note: any glow/halo layers were intentionally removed.

  const indicator = new THREE.Group();
  indicator.position.set(0, -0.05, -0.9);

  const circle = new THREE.Mesh(
    new THREE.CircleGeometry(0.06, 48),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  circle.renderOrder = 2;

  indicator.add(circle);
  camera.add(indicator);
  scene.add(camera);

  // Starfield
  const STAR_COUNT = 2200;
  const FIELD_RADIUS = 18;
  const FIELD_DEPTH = 140;
  const STAR_SPEED = 18; // units/sec (toward camera)

  const positions = new Float32Array(STAR_COUNT * 3);

  for (let i = 0; i < STAR_COUNT; i++) {
    const x = (Math.random() * 2 - 1) * FIELD_RADIUS;
    const y = (Math.random() * 2 - 1) * FIELD_RADIUS;
    const z = -Math.random() * FIELD_DEPTH; // in front of camera (-z)
    const idx = i * 3;
    positions[idx + 0] = x;
    positions[idx + 1] = y;
    positions[idx + 2] = z;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  // PointsMaterial does not support per-point sizes without a custom shader; we keep it simple.
  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.06,
    sizeAttenuation: true,
    fog: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });

  const stars = new THREE.Points(geo, mat);
  scene.add(stars);

  // Brighter constellation layer (real-ish sky placement via RA/Dec).
  // This stays static (unlike the moving star streak field).
  const constellations = createConstellationLayer({
    radius: 220,
    sizeCore: 0.42,
    sizeGlow: 1.25,
    sizeAttenuation: true,
    fog: false,
    showLines: false,
  });
  scene.add(constellations);

  function resize(w, h, dpr) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(clamp(dpr, 1, 2));
    renderer.setSize(w, h, false);
  }

  /**
   * @param {number} dt
   */
  let t = 0;
  function update(dt) {
    t += dt;

    const pos = geo.attributes.position.array;
    for (let i = 0; i < STAR_COUNT; i++) {
      const idx = i * 3 + 2;
      pos[idx] += STAR_SPEED * dt;
      if (pos[idx] > 0.5) {
        // Recycle star back into the distance
        pos[idx] = -FIELD_DEPTH;
        const j = i * 3;
        pos[j + 0] = (Math.random() * 2 - 1) * FIELD_RADIUS;
        pos[j + 1] = (Math.random() * 2 - 1) * FIELD_RADIUS;
      }
    }
    geo.attributes.position.needsUpdate = true;
  }

  return { name: 'Pulsar View Scene', scene, camera, update, resize };
}

// Backwards-compatible alias (older code may still import createScene)
export const createScene = createPulsarViewScene;

