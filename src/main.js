import './style.css';
import * as THREE from 'three';

// ----------------------------
// Helpers
// ----------------------------
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const lerpVec3 = (out, a, b, t) => {
  out.set(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));
  return out;
};
const degToRad = (d) => (d * Math.PI) / 180;

function vibrate(ms) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms);
    }
  } catch {
    // fail silently
  }
}

// ----------------------------
// DOM
// ----------------------------
const canvas = document.getElementById('c');
const hudSpeed = document.getElementById('hudSpeed');
const hudGyro = document.getElementById('hudGyro');
const motionOverlay = document.getElementById('motionOverlay');

// ----------------------------
// Three.js setup
// ----------------------------
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.setClearColor(0x000008, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000008, 0.00125);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.05,
  2000,
);

// Player rig: yaw on parent, pitch on child (prevents flip)
const player = new THREE.Object3D();
const yawNode = new THREE.Object3D();
const pitchNode = new THREE.Object3D();
scene.add(player);
player.add(yawNode);
yawNode.add(pitchNode);
pitchNode.add(camera);

camera.position.set(0, 1.4, 0);

// Lights (subtle)
scene.add(new THREE.AmbientLight(0xffffff, 0.18));
const dir = new THREE.DirectionalLight(0xffffff, 0.35);
dir.position.set(4, 6, 2);
scene.add(dir);

// Reference object: wireframe cube (stationary in world)
const refCube = new THREE.Mesh(
  new THREE.BoxGeometry(1.2, 1.2, 1.2),
  new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    wireframe: true,
    roughness: 0.6,
    metalness: 0.1,
  }),
);
refCube.position.set(0, 1.2, -10);
scene.add(refCube);

// Small "ship" reticle attached to camera so orientation feels grounded
const ship = new THREE.Mesh(
  new THREE.ConeGeometry(0.12, 0.38, 10),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }),
);
ship.rotation.x = Math.PI * 0.5;
ship.position.set(0, -0.12, -0.75);
yawNode.add(ship);

// ----------------------------
// Stars (InstancedMesh)
// ----------------------------
const STAR_COUNT = 1500; // >= 1000 requirement
const STAR_RADIUS = 140; // around camera

const starGeo = new THREE.SphereGeometry(0.08, 6, 6);
const starMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  fog: true,
});

const stars = new THREE.InstancedMesh(starGeo, starMat, STAR_COUNT);
stars.frustumCulled = false;
scene.add(stars);

const _m4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _s = new THREE.Vector3();

function randInSphere(radius) {
  // rejection sample
  while (true) {
    const x = (Math.random() * 2 - 1) * radius;
    const y = (Math.random() * 2 - 1) * radius;
    const z = (Math.random() * 2 - 1) * radius;
    if (x * x + y * y + z * z <= radius * radius) return [x, y, z];
  }
}

for (let i = 0; i < STAR_COUNT; i++) {
  const [x, y, z] = randInSphere(STAR_RADIUS);
  _pos.set(x, y * 0.6, z);
  _quat.identity();
  const scale = 0.7 + Math.random() * 2.2;
  _s.setScalar(scale);
  _m4.compose(_pos, _quat, _s);
  stars.setMatrixAt(i, _m4);
}
stars.instanceMatrix.needsUpdate = true;

// ----------------------------
// Controls: touch joystick (single finger drag)
// ----------------------------
const joystick = {
  active: false,
  id: null,
  startX: 0,
  startY: 0,
  dx: 0,
  dy: 0,
};

const targetVel = new THREE.Vector3();
const vel = new THREE.Vector3();
const tmpForward = new THREE.Vector3();

let lastTapAt = 0;
let dashUntil = 0;

const MAX_DRAG = 90; // px
const STRAFE_SPEED = 7.5; // m/s
const BASE_FORWARD = 2.0; // m/s (small drift so movement is obvious)
const DASH_SPEED = 18.0; // impulse

function onPointerDown(e) {
  // Double-tap dash (anywhere)
  const now = performance.now();
  if (now - lastTapAt < 260) {
    dashUntil = now + 140;
    vibrate(20);
    lastTapAt = 0;
  } else {
    lastTapAt = now;
  }

  if (joystick.active) return;
  joystick.active = true;
  joystick.id = e.pointerId;
  joystick.startX = e.clientX;
  joystick.startY = e.clientY;
  joystick.dx = 0;
  joystick.dy = 0;
  canvas.setPointerCapture?.(e.pointerId);
}

function onPointerMove(e) {
  if (!joystick.active || e.pointerId !== joystick.id) return;
  joystick.dx = clamp(e.clientX - joystick.startX, -MAX_DRAG, MAX_DRAG);
  joystick.dy = clamp(e.clientY - joystick.startY, -MAX_DRAG, MAX_DRAG);
}

function onPointerUp(e) {
  if (e.pointerId !== joystick.id) return;
  joystick.active = false;
  joystick.id = null;
  joystick.dx = 0;
  joystick.dy = 0;
}

canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
canvas.addEventListener('pointermove', onPointerMove, { passive: false });
canvas.addEventListener('pointerup', onPointerUp, { passive: false });
canvas.addEventListener('pointercancel', onPointerUp, { passive: false });

// ----------------------------
// Controls: DeviceOrientation (iOS permission flow)
// ----------------------------
let gyroEnabled = false;
let gyroBase = null; // {alpha,beta,gamma}
let gyroYaw = 0;
let gyroPitch = 0;

let yaw = 0;
let pitch = 0;
const PITCH_LIMIT = degToRad(60);

function updateGyroHud() {
  hudGyro.textContent = gyroEnabled ? 'on' : 'off';
}

function handleDeviceOrientation(ev) {
  // ev.* are degrees, may be null
  const alpha = ev.alpha;
  const beta = ev.beta;
  const gamma = ev.gamma;
  if (alpha == null && beta == null && gamma == null) return;

  // Establish baseline so the first orientation becomes "neutral"
  if (!gyroBase) {
    gyroBase = {
      alpha: alpha ?? 0,
      beta: beta ?? 0,
      gamma: gamma ?? 0,
    };
  }

  // iOS Safari: alpha often drifts; using beta/gamma deltas is usually more usable for "look"
  const dBeta = (beta ?? 0) - gyroBase.beta;
  const dGamma = (gamma ?? 0) - gyroBase.gamma;

  // Map tilt to yaw/pitch; keep subtle
  gyroYaw = degToRad(dGamma) * 0.9;
  gyroPitch = degToRad(dBeta) * 0.9;
}

async function enableGyroFromUserGesture() {
  if (gyroEnabled) return;

  try {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      const result = await DeviceOrientationEvent.requestPermission();
      if (result !== 'granted') throw new Error('permission denied');
    }

    window.addEventListener('deviceorientation', handleDeviceOrientation, true);
    gyroEnabled = true;
    gyroBase = null;
    updateGyroHud();
    motionOverlay.classList.remove('show');
  } catch {
    // Keep overlay visible so user can try again; fail gracefully.
    gyroEnabled = false;
    updateGyroHud();
    motionOverlay.classList.add('show');
  }
}

// Show overlay on first load if motion is supported (or might be on iOS).
const canRequestMotion =
  typeof window !== 'undefined' &&
  ('DeviceOrientationEvent' in window || 'ondeviceorientation' in window);

if (canRequestMotion) {
  motionOverlay.classList.add('show');
}
updateGyroHud();

motionOverlay.addEventListener('click', enableGyroFromUserGesture, { passive: true });

// ----------------------------
// Collision vibro
// ----------------------------
let lastCollisionAt = 0;
const COLLISION_DIST = 1.4;
const COLLISION_COOLDOWN_MS = 900;

// ----------------------------
// Resize handling
// ----------------------------
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', resize, { passive: true });
window.addEventListener('orientationchange', resize, { passive: true });
resize();

// ----------------------------
// Animation loop
// ----------------------------
const clock = new THREE.Clock();
const _camWorld = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());

  // Touch joystick -> target velocity in X/Z (screen drag: right=+x, up=-z)
  const nx = joystick.dx / MAX_DRAG;
  const ny = joystick.dy / MAX_DRAG;

  // Smooth joystick magnitude
  const jx = clamp(nx, -1, 1);
  const jy = clamp(ny, -1, 1);

  targetVel.set(jx * STRAFE_SPEED, 0, jy * STRAFE_SPEED);

  // Always include a small forward drift so movement is obvious relative to the reference cube
  tmpForward.set(0, 0, -1);
  tmpForward.applyQuaternion(yawNode.quaternion);
  tmpForward.y = 0;
  tmpForward.normalize();
  targetVel.addScaledVector(tmpForward, BASE_FORWARD);

  // Dash impulse forward on double-tap
  const now = performance.now();
  if (now < dashUntil) {
    targetVel.addScaledVector(tmpForward, DASH_SPEED);
  }

  // Smooth movement (lerp) so it doesn't jump
  const smooth = 1 - Math.pow(0.001, dt); // frame-rate independent-ish
  lerpVec3(vel, vel, targetVel, clamp(smooth, 0, 1));

  // Gyro affects yaw/pitch (clamped pitch)
  if (gyroEnabled) {
    const targetYaw = gyroYaw;
    const targetPitch = clamp(gyroPitch, -PITCH_LIMIT, PITCH_LIMIT);
    yaw = lerp(yaw, targetYaw, clamp(smooth, 0, 1));
    pitch = lerp(pitch, targetPitch, clamp(smooth, 0, 1));
  }

  yawNode.rotation.y = yaw;
  pitchNode.rotation.x = pitch;

  // Integrate position
  player.position.addScaledVector(vel, dt);

  // Infinite illusion: keep the star field centered around the camera
  camera.getWorldPosition(_camWorld);
  stars.position.copy(_camWorld);

  // Collision check vs reference cube
  const d = _camWorld.distanceTo(refCube.position);
  if (d < COLLISION_DIST) {
    if (now - lastCollisionAt > COLLISION_COOLDOWN_MS) {
      lastCollisionAt = now;
      vibrate(40);
    }
  }

  // HUD
  hudSpeed.textContent = vel.length().toFixed(1);

  renderer.render(scene, camera);
}

animate();
