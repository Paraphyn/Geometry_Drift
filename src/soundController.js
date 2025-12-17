/**
 * Sound Controller
 *
 * Configure one-shot sound effects by mapping "event names" to audio file URLs in `public/`.
 *
 * Example:
 * - Put a file at:  /public/Music/ui_click.mp3
 * - Map an event:  SOUND_URLS_BY_EVENT['ui:next'] = '/Music/ui_click.mp3'
 * - Trigger it:    sounds.trigger('ui:next')
 */

/**
 * Edit this map to wire sounds to events.
 *
 * Keys:   any string event name you choose
 * Values: URL paths served from `public/` (must start with `/`)
 *
 * Notes:
 * - Most mobile browsers require a user gesture before audio can play.
 *   Call `sounds.onUserGesture()` from a pointer/tap handler once.
 * - Missing/unmapped events are silently ignored.
 */
export const SOUND_URLS_BY_EVENT = {
  // UI
  'ui:prev': '/Music/ui_prev.mp3',
  'ui:next': '/Music/ui_next.mp3',
  'ui:toggleHud': '/Music/ui_toggle.mp3',

  // App
  'view:change': '/Music/view_change.mp3',
  'motion:enabled': '/Music/motion_enabled.mp3',
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * @typedef {{
 *  enabled?: boolean,
 *  volume?: number,
 *  maxVoicesPerEvent?: number,
 * }} SoundControllerOptions
 */

/**
 * @param {SoundControllerOptions} [opts]
 */
export function createSoundController(opts = {}) {
  let enabled = opts.enabled ?? true;
  let masterVolume = clamp(opts.volume ?? 0.8, 0, 1);
  const maxVoicesPerEvent = Math.max(1, opts.maxVoicesPerEvent ?? 4);

  /** @type {Map<string, HTMLAudioElement[]>} */
  const pools = new Map();

  let unlocked = false;

  function getUrl(eventName) {
    const url = SOUND_URLS_BY_EVENT[eventName];
    if (!url || typeof url !== 'string') return null;
    return url.startsWith('/') ? url : `/${url}`;
  }

  /**
   * @param {string} eventName
   */
  function getVoice(eventName) {
    const url = getUrl(eventName);
    if (!url) return null;

    let pool = pools.get(eventName);
    if (!pool) {
      pool = [];
      pools.set(eventName, pool);
    }

    // Prefer an idle voice.
    const idle = pool.find((a) => a.paused || a.ended);
    if (idle) return idle;

    // Otherwise, create a new voice (up to max polyphony).
    if (pool.length < maxVoicesPerEvent) {
      const a = new Audio(url);
      a.preload = 'auto';
      pool.push(a);
      return a;
    }

    // Reuse the oldest voice.
    return pool[0];
  }

  async function onUserGesture() {
    // Best-effort "unlock". This must be called from a real user gesture.
    unlocked = true;

    // Prime one audio instance per configured event so future plays are more reliable.
    for (const [eventName] of Object.entries(SOUND_URLS_BY_EVENT)) {
      const a = getVoice(eventName);
      if (!a) continue;
      const prevVol = a.volume;
      try {
        a.volume = 0;
        // Play + immediately pause to satisfy gesture gating.
        // Some browsers may throw even during a gesture; ignore.
        // eslint-disable-next-line no-await-in-loop
        await a.play();
        a.pause();
        a.currentTime = 0;
      } catch {
        // ignore
      } finally {
        a.volume = prevVol;
      }
    }
  }

  /**
   * Trigger a sound for an event name.
   * @param {string} eventName
   * @param {{ volume?: number, playbackRate?: number }} [opts2]
   */
  function trigger(eventName, opts2 = {}) {
    if (!enabled) return;
    const a = getVoice(eventName);
    if (!a) return;

    // If we never got a user gesture yet, the browser may block playback.
    // We still attempt; failure is silently ignored.
    if (!unlocked) {
      // no-op; keep behavior best-effort
    }

    const vol = clamp((opts2.volume ?? 1) * masterVolume, 0, 1);

    try {
      a.pause();
      a.currentTime = 0;
    } catch {
      // ignore
    }

    try {
      a.volume = vol;
      a.playbackRate = clamp(opts2.playbackRate ?? 1, 0.25, 4);
      void a.play();
    } catch {
      // ignore
    }
  }

  function setEnabled(v) {
    enabled = !!v;
  }

  function setVolume(v) {
    masterVolume = clamp(v, 0, 1);
  }

  return {
    trigger,
    onUserGesture,
    setEnabled,
    setVolume,
    get enabled() {
      return enabled;
    },
    get volume() {
      return masterVolume;
    },
  };
}
