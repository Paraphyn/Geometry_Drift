import * as THREE from 'three';
import { createConstellationLayer } from './constellations.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Black Hole View Scene
 * - Renders a basic starfield "world" scene
 * - Captures it into a render target
 * - Draws a fullscreen quad with a procedural black-hole shader pass
 *
 * @param {import('three').WebGLRenderer} renderer
 */
export function createBlackHoleViewScene(renderer) {
  // ----------------------------
  // World scene (background)
  // ----------------------------
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000008, 0.018);

  const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 300);
  camera.position.set(0, 0, 0);

  // Starfield (same style as Pulsar, but without the center indicator)
  const STAR_COUNT = 2200;
  const FIELD_RADIUS = 18;
  const FIELD_DEPTH = 140;
  const STAR_SPEED = 18; // units/sec (toward camera)

  const positions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    const x = (Math.random() * 2 - 1) * FIELD_RADIUS;
    const y = (Math.random() * 2 - 1) * FIELD_RADIUS;
    const z = -Math.random() * FIELD_DEPTH;
    const idx = i * 3;
    positions[idx + 0] = x;
    positions[idx + 1] = y;
    positions[idx + 2] = z;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

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

  // Brighter constellation layer (real-ish sky placement via RA/Dec).
  const constellations = createConstellationLayer({
    radius: 220,
    sizeCore: 0.28,
    sizeGlow: 0.78,
    sizeAttenuation: true,
    fog: false,
    showLines: true,
  });
  scene.add(constellations);

  // ----------------------------
  // Post (fullscreen black hole pass)
  // ----------------------------
  // 1. Capture the scene into a render target
  const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
  });

  // 2. Create a fullscreen quad scene
  const postScene = new THREE.Scene();
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // 3. Add Black Hole shader material (inserted exactly)
  const blackHoleMaterial = new THREE.ShaderMaterial({
    uniforms: {
      tBackground: { value: renderTarget.texture },
      iResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      iTime: { value: 0 },

      Rs: { value: 0.08 }, // event horizon radius
      Rin: { value: 0.10 }, // disk inner radius
      Rout: { value: 0.45 }, // disk outer radius
      feather: { value: 0.01 }, // smooth edges
    },

    vertexShader: `
    void main() {
      gl_Position = vec4(position, 1.0);
    }
  `,

    fragmentShader: `
    precision highp float;

    uniform sampler2D tBackground;
    uniform vec2 iResolution;
    uniform float iTime;
    uniform float Rs;
    uniform float Rin;
    uniform float Rout;
    uniform float feather;

    float noise(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    vec3 diskColor(float t){
      vec3 hot = vec3(1.2, 0.85, 0.35);
      vec3 warm = vec3(0.95, 0.35, 0.1);
      vec3 cool = vec3(0.45, 0.1, 0.55);
      return mix(mix(hot, warm, t), cool, t*t);
    }

    void main(){
      vec2 uv = gl_FragCoord.xy / iResolution.xy;
      vec2 p = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

      float r = length(p);
      float phi = atan(p.y, p.x);

      // Lensing
      float bend = 0.015 / (r*r + 0.0005);
      vec2 uvL = uv + normalize(p) * bend;
      vec3 bg = texture2D(tBackground, uvL).rgb;

      // Event horizon
      float hole = smoothstep(Rs, Rs + feather, r);

      // Accretion disk
      float diskMask =
        smoothstep(Rin, Rin + feather, r) *
        (1.0 - smoothstep(Rout, Rout + feather, r));

      float t = clamp((r - Rin) / (Rout - Rin), 0.0, 1.0);
      float swirl = phi + 2.0 * log(r + 1.0) + iTime;
      float bands = 0.6 + 0.4 * sin(10.0 * swirl + noise(p * 20.0));

      vec3 disk = diskColor(t) * diskMask * bands * exp(-3.0 * t);

      // Glow
      vec3 glow = vec3(1.0, 0.5, 0.2) * exp(-6.0 * max(r - Rin, 0.0));

      vec3 col = bg + disk * 2.0 + glow;
      col *= hole;
      col = col / (1.0 + col);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
  });

  // 4. Create fullscreen quad
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blackHoleMaterial);
  postScene.add(quad);

  // ----------------------------
  // API
  // ----------------------------
  function update(dt) {
    const pos = geo.attributes.position.array;
    for (let i = 0; i < STAR_COUNT; i++) {
      const idx = i * 3 + 2;
      pos[idx] += STAR_SPEED * dt;
      if (pos[idx] > 0.5) {
        pos[idx] = -FIELD_DEPTH;
        const j = i * 3;
        pos[j + 0] = (Math.random() * 2 - 1) * FIELD_RADIUS;
        pos[j + 1] = (Math.random() * 2 - 1) * FIELD_RADIUS;
      }
    }
    geo.attributes.position.needsUpdate = true;
  }

  function resize(w, h, dpr) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    renderer.setPixelRatio(clamp(dpr, 1, 2));
    renderer.setSize(w, h, false);

    renderTarget.setSize(w, h);
    blackHoleMaterial.uniforms.iResolution.value.set(w, h);
  }

  /**
   * Final render order (as specified):
   * - render world into renderTarget
   * - render fullscreen post scene
   * @param {number} tMs
   */
  function render(tMs) {
    blackHoleMaterial.uniforms.iTime.value = tMs * 0.001;

    renderer.setRenderTarget(renderTarget);
    renderer.render(scene, camera);

    renderer.setRenderTarget(null);
    renderer.render(postScene, postCamera);
  }

  return {
    name: 'Black Hole View Scene',
    scene,
    camera,
    update,
    resize,
    render,
  };
}

