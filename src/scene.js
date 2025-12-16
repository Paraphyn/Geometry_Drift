import * as THREE from 'three';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Creates a simple "space" scene:
 * - starfield (Points)
 * - subtle fog
 * - ship indicator (small cone) fixed in front of the camera
 * - forward-movement illusion by moving stars toward the camera
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
  renderer.setClearColor(0x000008, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000008, 0.018);

  const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 300);
  camera.position.set(0, 0, 0);

  // Center indicator: white circle + soft glow (attached to camera so it's always centered)
  const glowTex = (() => {
    const size = 256;
    const cnv = document.createElement('canvas');
    cnv.width = size;
    cnv.height = size;
    const ctx = cnv.getContext('2d');
    if (!ctx) return null;

    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0.0, 'rgba(255,255,255,1.0)');
    g.addColorStop(0.18, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.35)');
    g.addColorStop(1.0, 'rgba(255,255,255,0.0)');
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

  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(0.16, 64),
    new THREE.MeshBasicMaterial({
      map: glowTex || null,
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  halo.renderOrder = 1;

  indicator.add(halo, circle);
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
  function update(dt) {
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

  return { renderer, scene, camera, update, resize };
}

