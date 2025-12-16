/**
 * Best-effort haptics for the web:
 * - Try `navigator.vibrate()` if available
 * - Also attempt gamepad rumble via the Vibration API (if a controller is connected)
 * - Otherwise no-op
 *
 * Note: This does NOT provide true iPhone Taptic Engine support in pure web.
 */

/**
 * @param {number} ms
 */
export function pulse(ms = 30) {
  // Vibration API
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(Math.max(0, ms | 0));
    }
  } catch {
    // ignore
  }

  // Gamepad rumble (best effort)
  try {
    const pads = (typeof navigator !== 'undefined' && navigator.getGamepads?.()) || [];
    const pad = Array.from(pads).find(
      (p) => p && p.connected && p.vibrationActuator && typeof p.vibrationActuator.playEffect === 'function',
    );
    if (!pad) return;

    // "dual-rumble" is supported by some controllers/browsers
    pad.vibrationActuator.playEffect('dual-rumble', {
      duration: Math.max(0, ms | 0),
      strongMagnitude: 0.6,
      weakMagnitude: 0.4,
    });
  } catch {
    // ignore
  }
}

