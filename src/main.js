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
import { pulse } from './haptics.js';

// ----------------------------
// DOM
// ----------------------------
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('c'));
const elMotionStatus = document.getElementById('motionStatus');
const elTouchStatus = document.getElementById('touchStatus');
const elDebug = document.getElementById('debug');
const btnEnableMotion = document.getElementById('btnEnableMotion');
const btnRecenter = document.getElementById('btnRecenter');
const btnHaptics = document.getElementById('btnHaptics');

// ----------------------------
// Modules
// ----------------------------
const space = createScene(canvas);
const motion = createMotionController(canvas);

function renderUI() {
  const status = motion.getStatus();
  elMotionStatus.textContent = status.motionEnabled ? 'ON' : 'OFF';
  elTouchStatus.textContent = 'ON';
  elDebug.textContent =
    `α: ${status.alpha ?? '—'}  β: ${status.beta ?? '—'}  γ: ${status.gamma ?? '—'}\n` +
    `MODE: ${status.motionEnabled ? 'MOTION' : 'TOUCH'}\n` +
    `yaw: ${status.yaw.toFixed(3)}  pitch: ${status.pitch.toFixed(3)}`;
}

btnEnableMotion.addEventListener('click', async () => {
  const ok = await motion.enableMotionFromUserGesture();
  if (ok) {
    pulse(30);
  }
  renderUI();
});

btnRecenter.addEventListener('click', () => {
  motion.recenter();
  pulse(30);
  renderUI();
});

btnHaptics.addEventListener('click', () => {
  pulse(30);
});

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
  renderUI();
}
requestAnimationFrame(frame);
