import * as THREE from 'three';

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

  // Center indicator: white circle + soft glow (attached to camera so it's always centered)
  // "Fast pulsations" are implemented by modulating glow opacity + scale in `update()`.
  const glowTex = (() => {
    const size = 256;
    const cnv = document.createElement('canvas');
    cnv.width = size;
    cnv.height = size;
    const ctx = cnv.getContext('2d');
    if (!ctx) return null;

    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    // Shorter glow distance + slight cyan tint outward (center stays white).
    g.addColorStop(0.0, 'rgba(255,255,255,1.0)');
    g.addColorStop(0.06, 'rgba(255,255,255,0.92)');
    g.addColorStop(0.16, 'rgba(170,255,255,0.55)');
    g.addColorStop(0.32, 'rgba(90,235,255,0.22)');
    g.addColorStop(0.52, 'rgba(40,190,220,0.00)');
    g.addColorStop(1.0, 'rgba(0,0,0,0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    const t = new THREE.CanvasTexture(cnv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  })();

  const indicator = new THREE.Group();
  indicator.position.set(0, -0.05, -0.9);

  const circle = new THREE.Mesh(
    new THREE.CircleGeometry(0.06, 48),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  circle.renderOrder = 2;

  const haloMat = new THREE.MeshBasicMaterial({
    map: glowTex || null,
    color: 0xe8ffff,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const haloOuterMat = new THREE.MeshBasicMaterial({
    map: glowTex || null,
    color: 0xc8ffff,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  // Two-layer glow reads softer than a single halo.
  const halo = new THREE.Mesh(new THREE.CircleGeometry(0.18, 64), haloMat);
  halo.renderOrder = 1;
  const haloOuter = new THREE.Mesh(new THREE.CircleGeometry(0.28, 64), haloOuterMat);
  haloOuter.renderOrder = 0;

  indicator.add(haloOuter, halo, circle);
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

    // Faster + "shorter" pulses (less time spent near peak).
    const PULSE_HZ = 11.0;
    const s = Math.sin(t * Math.PI * 2 * PULSE_HZ); // [-1, 1]
    const pulse01 = 0.5 + 0.5 * s; // [0, 1]
    const pulse = Math.pow(pulse01, 2.35); // sharper peaks, still smooth

    haloMat.opacity = 0.55 + 0.55 * pulse;
    haloOuterMat.opacity = 0.10 + 0.45 * pulse;

    const innerScale = 1.0 + 0.14 * pulse;
    const outerScale = 1.0 + 0.18 * pulse;
    halo.scale.setScalar(innerScale);
    haloOuter.scale.setScalar(outerScale);

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

