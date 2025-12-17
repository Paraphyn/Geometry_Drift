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
import { createPulsarViewScene } from './scene.js';
import { createBlackHoleViewScene } from './blackHoleViewScene.js';
import { createBlackHole2ViewScene } from './blackHole2ViewScene.js';
import { createGltfModelViewScene } from './gltfModelViewScene.js';
import { createEarthViewScene } from './earthViewScene.js';
import { createMotionController } from './motion.js';
import { createRenderer } from './renderer.js';

// ----------------------------
// DOM
// ----------------------------
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('c'));
const sceneLabel = /** @type {HTMLDivElement} */ (document.getElementById('sceneLabel'));
const prevBtn = /** @type {HTMLButtonElement} */ (document.getElementById('prevBtn'));
const nextBtn = /** @type {HTMLButtonElement} */ (document.getElementById('nextBtn'));

// ----------------------------
// Modules
// ----------------------------
const { renderer } = createRenderer(canvas);
const motion = createMotionController(canvas);

// ----------------------------
// Scenes (Views)
// ----------------------------
/** @typedef {{name: string, scene: any, camera: any, update: (dt:number)=>void, resize: (w:number,h:number,dpr:number)=>void, render?: (tMs:number)=>void, setActive?: (isActive:boolean)=>void, onUserGesture?: ()=>void, useMotion?: boolean}} View */

/** @type {View} */
const blackHoleView = createBlackHoleViewScene(renderer);
/** @type {View} */
const pulsarView = createPulsarViewScene(renderer);
/** @type {View} */
const blackHole2View = createBlackHole2ViewScene(renderer);
/** @type {View} */
const gltfModelView = createGltfModelViewScene(renderer, { modelUrl: '/models/scene.gltf' });
/** @type {View} */
const earthView = createEarthViewScene(renderer, { modelUrl: '/models/earth/scene.gltf', musicUrl: '/Music/earth_background.mp3' });

/** @type {View[]} */
const views = [earthView, gltfModelView, blackHoleView, pulsarView, blackHole2View];

let viewIdx = 0; // default: Earth
/** @type {View} */
let activeView = views[viewIdx];
sceneLabel.textContent = activeView.name;

function setView(idx) {
  activeView?.setActive?.(false);

  viewIdx = (idx + views.length) % views.length;
  activeView = views[viewIdx];
  sceneLabel.textContent = activeView.name;

  const useMotion = activeView.useMotion !== false;
  motion.setActive(useMotion);
  activeView?.setActive?.(true);

  onResize();
}

prevBtn?.addEventListener(
  'click',
  () => {
    setView(viewIdx - 1);
  },
  { passive: true },
);

nextBtn?.addEventListener(
  'click',
  () => {
    setView(viewIdx + 1);
  },
  { passive: true },
);

// No UI overlay: use the first canvas gesture to request motion permission (iOS Safari requirement).
let triedMotion = false;
canvas.addEventListener(
  'pointerdown',
  async () => {
    activeView?.onUserGesture?.();
    if (triedMotion) return;
    if (activeView.useMotion === false) return;
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
  activeView.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
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

  const useMotion = activeView.useMotion !== false;
  if (useMotion) {
    motion.update(dt);
    if (activeView.camera) motion.applyToCamera(activeView.camera);
  }

  activeView.update(dt);
  if (activeView.render) {
    activeView.render(now);
  } else {
    // If the previous view used raw GL drawing, ensure Three re-syncs its internal state.
    // (Calling resetState() is cheap and avoids subtle state leakage.)
    renderer.resetState();
    renderer.render(activeView.scene, activeView.camera);
  }
}
requestAnimationFrame(frame);

// Ensure per-view activation state is set on load
setView(viewIdx);
