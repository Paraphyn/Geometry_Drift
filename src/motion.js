const DEG2RAD = Math.PI / 180;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Motion controller:
 * - iOS-compatible permission request (must be called from a user gesture)
 * - deviceorientation -> yaw/pitch with smoothing
 * - recenter by storing a neutral offset
 * - touch drag fallback (one-finger look) when motion is OFF/unavailable
 *
 * @param {HTMLCanvasElement} canvas
 */
export function createMotionController(canvas) {
  // Raw sensor (degrees)
  /** @type {{alpha: number|null, beta: number|null, gamma: number|null}} */
  const sensor = { alpha: null, beta: null, gamma: null };

  // Neutral offsets (degrees) used for recentering
  /** @type {{beta: number, gamma: number}} */
  let neutral = { beta: 0, gamma: 0 };
  let hasNeutral = false;

  // Smoothed camera angles (radians)
  let yaw = 0;
  let pitch = 0;
  let targetYaw = 0;
  let targetPitch = 0;

  // Touch look (radians)
  let touchYaw = 0;
  let touchPitch = 0;
  let touchTargetYaw = 0;
  let touchTargetPitch = 0;

  let motionEnabled = false;
  let listening = false;

  const PITCH_LIMIT = 1.1; // ~63deg
  const TOUCH_SENS = 0.0045; // rad per px
  const SENSOR_YAW_SCALE = 0.9;
  const SENSOR_PITCH_SCALE = 0.9;

  // Pointer state (touch fallback)
  const pointer = { down: false, id: -1, x: 0, y: 0 };

  function onPointerDown(e) {
    if (motionEnabled) return; // touch fallback only when motion is OFF
    pointer.down = true;
    pointer.id = e.pointerId;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    canvas.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    if (motionEnabled) return;
    if (!pointer.down || e.pointerId !== pointer.id) return;
    const dx = e.clientX - pointer.x;
    const dy = e.clientY - pointer.y;
    pointer.x = e.clientX;
    pointer.y = e.clientY;

    // Drag right => yaw right. Drag up => look up (negative pitch).
    touchTargetYaw += dx * TOUCH_SENS;
    touchTargetPitch += dy * TOUCH_SENS;
    touchTargetPitch = clamp(touchTargetPitch, -PITCH_LIMIT, PITCH_LIMIT);
  }

  function onPointerUp(e) {
    if (e.pointerId !== pointer.id) return;
    pointer.down = false;
    pointer.id = -1;
  }

  canvas.addEventListener('pointerdown', onPointerDown, { passive: true });
  canvas.addEventListener('pointermove', onPointerMove, { passive: true });
  canvas.addEventListener('pointerup', onPointerUp, { passive: true });
  canvas.addEventListener('pointercancel', onPointerUp, { passive: true });

  function onDeviceOrientation(ev) {
    // Degrees, may be null
    sensor.alpha = typeof ev.alpha === 'number' ? ev.alpha : null;
    sensor.beta = typeof ev.beta === 'number' ? ev.beta : null;
    sensor.gamma = typeof ev.gamma === 'number' ? ev.gamma : null;

    // Establish a neutral baseline the first time we receive real values
    if (!hasNeutral && sensor.beta != null && sensor.gamma != null) {
      neutral = { beta: sensor.beta, gamma: sensor.gamma };
      hasNeutral = true;
    }

    if (sensor.beta == null || sensor.gamma == null) return;
    const dBeta = sensor.beta - neutral.beta;
    const dGamma = sensor.gamma - neutral.gamma;

    // Map degrees to radians.
    // We avoid `alpha` (compass heading) because it can drift and is not essential for "look".
    targetYaw = (dGamma * DEG2RAD) * SENSOR_YAW_SCALE;
    targetPitch = (dBeta * DEG2RAD) * SENSOR_PITCH_SCALE;
    targetPitch = clamp(targetPitch, -PITCH_LIMIT, PITCH_LIMIT);
  }

  function startListening() {
    if (listening) return;
    window.addEventListener('deviceorientation', onDeviceOrientation, { passive: true });
    listening = true;
  }

  /**
   * Must be called from a user gesture on iOS Safari.
   * @returns {Promise<boolean>}
   */
  async function enableMotionFromUserGesture() {
    if (motionEnabled) return true;

    // If there's no event support at all, fail fast.
    const hasDeviceOrientation =
      typeof window !== 'undefined' && ('DeviceOrientationEvent' in window || 'ondeviceorientation' in window);
    if (!hasDeviceOrientation) {
      motionEnabled = false;
      return false;
    }

    try {
      // iOS 13+ requires a permission prompt that MUST be triggered by a gesture.
      // Requirement: prefer DeviceMotionEvent.requestPermission when present.
      if (typeof window.DeviceMotionEvent !== 'undefined' && typeof window.DeviceMotionEvent.requestPermission === 'function') {
        const res = await window.DeviceMotionEvent.requestPermission();
        if (res !== 'granted') throw new Error('DeviceMotion permission denied');
      } else if (
        typeof window.DeviceOrientationEvent !== 'undefined' &&
        typeof window.DeviceOrientationEvent.requestPermission === 'function'
      ) {
        const res = await window.DeviceOrientationEvent.requestPermission();
        if (res !== 'granted') throw new Error('DeviceOrientation permission denied');
      }

      startListening();
      motionEnabled = true;
      hasNeutral = false; // next real reading becomes neutral
      return true;
    } catch {
      motionEnabled = false;
      return false;
    }
  }

  function recenter() {
    if (sensor.beta != null && sensor.gamma != null) {
      neutral = { beta: sensor.beta, gamma: sensor.gamma };
      hasNeutral = true;
    } else {
      // If we don't have sensor readings (e.g. motion OFF), recenter touch.
      touchTargetYaw = 0;
      touchTargetPitch = 0;
      touchYaw = 0;
      touchPitch = 0;
    }
  }

  /**
   * @param {number} dt
   */
  function update(dt) {
    // Frame-rate independent-ish smoothing
    const smooth = clamp(1 - Math.pow(0.001, dt), 0, 1);

    if (motionEnabled) {
      yaw = lerp(yaw, targetYaw, smooth);
      pitch = lerp(pitch, targetPitch, smooth);
    } else {
      touchYaw = lerp(touchYaw, touchTargetYaw, smooth);
      touchPitch = lerp(touchPitch, touchTargetPitch, smooth);
      yaw = touchYaw;
      pitch = touchPitch;
    }
  }

  /**
   * Applies the current orientation to a THREE.PerspectiveCamera (or any Object3D with rotation).
   * @param {{rotation: {order: string, x: number, y: number, z: number}}} camera
   */
  function applyToCamera(camera) {
    // Use an order that avoids gimbal issues for yaw/pitch.
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    camera.rotation.z = 0;
  }

  function getStatus() {
    return {
      motionEnabled,
      alpha: sensor.alpha != null ? sensor.alpha.toFixed(1) : null,
      beta: sensor.beta != null ? sensor.beta.toFixed(1) : null,
      gamma: sensor.gamma != null ? sensor.gamma.toFixed(1) : null,
      yaw,
      pitch,
    };
  }

  return {
    enableMotionFromUserGesture,
    recenter,
    update,
    applyToCamera,
    getStatus,
  };
}

