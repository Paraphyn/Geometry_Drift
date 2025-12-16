## Infinite 3D Space (Mobile / iPhone)

Minimal, mobile-first **Vite + Vanilla JS** web app that runs an "infinite" foggy 3D space in iPhone Safari/Chrome iOS using **Three.js**.

### Features

- **Three.js scene**: foggy space + subtle ambient/directional light
- **Instanced stars**: `InstancedMesh` with 1500 stars (>= 1000)
- **Infinite illusion**: starfield is re-centered each frame via `stars.position.copy(cameraWorldPosition)`
- **Reference object**: stationary wireframe cube so motion is obvious
- **Touch controls (iPhone)**:
  - **Single-finger drag anywhere** = smooth strafe on X/Z (lerped)
  - **Double-tap anywhere** = short forward dash + `vibrate(20)`
- **Gyro controls (iOS permission flow)**:
  - Full-screen **"Tap to Enable Motion"** overlay on first load
  - On tap, calls `DeviceOrientationEvent.requestPermission()` (when required) then subscribes to `deviceorientation`
  - Gyro affects camera yaw/pitch (pitch clamped to prevent flipping)
- **Haptics / vibro**:
  - Dash: `vibrate(20)`
  - Collision near reference cube: `vibrate(40)` with cooldown
  - Fails gracefully if `navigator.vibrate` is unavailable
- **Mobile UX / performance**:
  - Fullscreen canvas, no scroll, `touch-action: none`
  - Pixel ratio capped: `renderer.setPixelRatio(Math.min(2, devicePixelRatio))`
  - Resize/orientation handling

---

### Local development

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

---

### Deploy to Vercel

- Push the repo to GitHub.
- In Vercel, **New Project** → import the repo.
- **Framework preset**: **Vite**
- Build command: `npm run build`
- Output directory: `dist`

No `vercel.json` is required for a standard Vite static build.

---

### iPhone testing steps (Safari / Chrome iOS)

1. Open the app URL.
2. Tap the full-screen **"Tap to Enable Motion"** overlay.
3. iOS will prompt for motion permission (on supported iOS versions). Tap **Allow**.
4. **Drag anywhere** to strafe; **double-tap anywhere** to dash.
5. Move near the wireframe cube to trigger the collision vibration.

---

### Known iOS limitations

- **Motion requires a user gesture**: iOS Safari/Chrome iOS requires tapping a UI element before motion events are delivered.
- **Gyro axes vary by device/orientation**: deviceorientation values can differ across iOS versions and whether screen rotation is locked.
- **Vibration support is limited**:
  - `navigator.vibrate` may be unavailable on iOS, or may only allow short/limited patterns.
  - This app uses short single-duration vibrations to maximize compatibility.
