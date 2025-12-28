import * as THREE from 'three';
import { Lensflare, LensflareElement } from 'three/examples/jsm/objects/Lensflare.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function createRadialFlareTexture(size, stops) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const r = size * 0.5;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  for (const s of stops) g.addColorStop(s[0], s[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createStarburstTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const cx = size * 0.5;
  const cy = size * 0.5;

  // Warm halo base
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.5);
  halo.addColorStop(0.0, 'rgba(255,230,160,0.90)');
  halo.addColorStop(0.25, 'rgba(255,205,120,0.55)');
  halo.addColorStop(0.7, 'rgba(255,175,70,0.12)');
  halo.addColorStop(1.0, 'rgba(255,175,70,0.00)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);

  // Long subtle streaks
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = 'lighter';
  const beams = 8;
  const beamLen = size * 0.48;
  const beamW = Math.max(2.0, size * 0.010);
  for (let i = 0; i < beams; i++) {
    const a = (i / beams) * Math.PI;
    ctx.save();
    ctx.rotate(a);
    const g = ctx.createLinearGradient(0, 0, beamLen, 0);
    g.addColorStop(0.0, 'rgba(255,235,170,0.00)');
    g.addColorStop(0.2, 'rgba(255,220,140,0.18)');
    g.addColorStop(0.5, 'rgba(255,205,120,0.30)');
    g.addColorStop(1.0, 'rgba(255,235,170,0.00)');
    ctx.strokeStyle = g;
    ctx.lineWidth = beamW;
    ctx.beginPath();
    ctx.moveTo(-beamLen, 0);
    ctx.lineTo(beamLen, 0);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Create a distant “sun” with golden glow + lens flare that intensifies when it’s in view.
 *
 * @param {{
 *  position: THREE.Vector3,
 *  radius?: number,
 * }} opts
 */
export function createSunRig(opts) {
  const position = opts.position;
  const radius = opts.radius ?? 7;

  const group = new THREE.Group();
  group.name = 'SunRig';
  group.position.copy(position);

  // Bright sun disk
  const sunMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.6, 1.25, 0.55), // HDR-ish
    transparent: false,
  });
  sunMat.toneMapped = false;
  const sun = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 32), sunMat);
  sun.frustumCulled = true;
  group.add(sun);

  // Additive glow halo (billboard)
  const haloTex =
    createRadialFlareTexture(256, [
      [0.0, 'rgba(255,245,200,0.95)'],
      [0.2, 'rgba(255,215,130,0.55)'],
      [0.7, 'rgba(255,175,70,0.14)'],
      [1.0, 'rgba(255,175,70,0.00)'],
    ]) || null;

  const haloMat = new THREE.SpriteMaterial({
    map: haloTex,
    color: 0xffd68a,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  haloMat.toneMapped = false;
  const halo = new THREE.Sprite(haloMat);
  halo.scale.setScalar(radius * 14);
  group.add(halo);

  // Extra “flare spikes” (rotating sprite)
  const burstTex = createStarburstTexture(256) || haloTex;
  const burstMat = new THREE.SpriteMaterial({
    map: burstTex,
    color: 0xffe0a8,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  burstMat.toneMapped = false;
  const burst = new THREE.Sprite(burstMat);
  burst.scale.setScalar(radius * 22);
  group.add(burst);

  // Lens flare (Three.js helper) attached to a light source at the sun position
  const light = new THREE.PointLight(0xffe2a2, 2.0, 0, 2);
  light.position.set(0, 0, 0);

  const flareMain =
    createRadialFlareTexture(256, [
      [0.0, 'rgba(255,255,255,0.95)'],
      [0.15, 'rgba(255,235,180,0.65)'],
      [0.55, 'rgba(255,200,110,0.22)'],
      [1.0, 'rgba(255,200,110,0.00)'],
    ]) || null;
  const flareSoft =
    createRadialFlareTexture(128, [
      [0.0, 'rgba(255,230,160,0.55)'],
      [0.45, 'rgba(255,205,120,0.20)'],
      [1.0, 'rgba(255,205,120,0.00)'],
    ]) || flareMain;

  const lensflare = new Lensflare();
  // size, distance (0..1), color
  lensflare.addElement(new LensflareElement(flareMain, 240, 0.0, new THREE.Color(0xfff1c6)));
  lensflare.addElement(new LensflareElement(flareSoft, 110, 0.35, new THREE.Color(0xffd08a)));
  lensflare.addElement(new LensflareElement(flareSoft, 70, 0.58, new THREE.Color(0xffc06a)));
  lensflare.addElement(new LensflareElement(flareSoft, 120, 0.85, new THREE.Color(0xfff7df)));
  light.add(lensflare);
  group.add(light);

  // Animate visibility-driven intensity
  let t = 0;
  const tmpNdc = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  const toSun = new THREE.Vector3();

  /**
   * @param {number} dt
   * @param {THREE.PerspectiveCamera} camera
   */
  function update(dt, camera) {
    t += dt;

    // In-view check using NDC
    tmpNdc.copy(group.position).project(camera);
    const inScreen = Math.abs(tmpNdc.x) <= 1.05 && Math.abs(tmpNdc.y) <= 1.05 && tmpNdc.z > 0 && tmpNdc.z < 1;

    camera.getWorldPosition(camPos);
    camera.getWorldDirection(camDir);
    toSun.copy(group.position).sub(camPos).normalize();
    const facing = clamp((camDir.dot(toSun) - 0.65) / (1.0 - 0.65), 0, 1); // soften

    const center = clamp(1.0 - Math.sqrt(tmpNdc.x * tmpNdc.x + tmpNdc.y * tmpNdc.y), 0, 1);
    const vis = (inScreen ? 1 : 0) * facing * (0.35 + 0.65 * center);

    const pulse = 0.85 + 0.15 * Math.sin(t * 0.7);
    const v = vis * pulse;

    halo.material.opacity = 0.15 + 0.75 * v;
    burst.material.opacity = 0.08 + 0.65 * v;
    burst.material.rotation = t * 0.15;
    halo.scale.setScalar(radius * (12 + 7 * v));
    burst.scale.setScalar(radius * (18 + 10 * v));

    light.intensity = 0.35 + 2.15 * v;

    // Fade all lens flare elements together
    for (const el of lensflare.elements) {
      el.opacity = 0.05 + 0.95 * v;
    }
  }

  return { object: group, update };
}

