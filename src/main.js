/**
 * Mini README (how to run + iOS notes)
 *
 * Run locally:
 *   npm install
 *   npm run dev
 *
 * iPhone Safari testing notes:
 * - Motion sensors require HTTPS (or localhost) and a user gesture.
 * - Tap **Enable Motion** once; we do not auto-request permission or spam prompts.
 * - Web haptics are limited on iOS; `navigator.vibrate()` may be unavailable.
 */

import './style.css';
import { createScene } from './scene.js';
import { createMotionController } from './motion.js';

// ----------------------------
// DOM
// ----------------------------
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('c'));

// ----------------------------
// Modules
// ----------------------------
const space = createScene(canvas);
const motion = createMotionController(canvas);

// No UI overlay: use the first canvas gesture to request motion permission (iOS Safari requirement).
let triedMotion = false;
canvas.addEventListener(
  'pointerdown',
  async () => {
    if (triedMotion) return;
    triedMotion = true;
    const ok = await motion.enableMotionFromUserGesture();
    if (ok) motion.recenter();
  },
  { passive: true },
);

// ----------------------------
// Resize/orientation
// ----------------------------
function onResize() {
  space.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
}
window.addEventListener('resize', onResize, { passive: true });
window.addEventListener('orientationchange', onResize, { passive: true });
onResize();

// ----------------------------
// Animation loop
// ----------------------------
let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;

  motion.update(dt);
  motion.applyToCamera(space.camera);

  space.update(dt);
  space.renderer.render(space.scene, space.camera);
}
requestAnimationFrame(frame);
