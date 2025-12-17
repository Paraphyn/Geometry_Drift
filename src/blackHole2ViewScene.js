/**
 * Black Hole 2 (standalone WebGL fullscreen pass)
 *
 * Requirements:
 * - Pure WebGL (single fullscreen quad + fragment shader)
 * - No Three.js usage inside this module
 * - Works as a "View" in the existing Next/Prev switcher
 *
 * @param {any} renderer - THREE.WebGLRenderer instance (treated as an opaque provider of GL context)
 */
export function createBlackHole2ViewScene(renderer) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // User-tweakable parameters
  const params = {
    RsPx: 120,
    lensStrength: 0.8,
    ringIntensity: 1.35,
    swirlStrength: 0.9,
    timeScale: 1.0,
  };

  /** @type {WebGLRenderingContext|WebGL2RenderingContext} */
  const gl = renderer.getContext();
  const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;

  // --- Shaders (WebGL1 + WebGL2 variants)
  const VERT_100 = `
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main() {
      v_uv = a_pos * 0.5 + 0.5;
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }
  `;

  const FRAG_100 = `
    precision highp float;

    uniform float u_time;
    uniform vec2 u_resolution;
    uniform float u_rs;            // pixels
    uniform float u_lensStrength;
    uniform float u_ringIntensity;
    uniform float u_swirlStrength;
    uniform float u_timeScale;

    varying vec2 v_uv;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 345.45));
      p += dot(p, p + 34.345);
      return fract(p.x * p.y);
    }

    vec2 hash22(vec2 p) {
      float n = hash21(p);
      return vec2(n, hash21(p + n + 19.19));
    }

    float valueNoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      float a = hash21(i);
      float b = hash21(i + vec2(1.0, 0.0));
      float c = hash21(i + vec2(0.0, 1.0));
      float d = hash21(i + vec2(1.0, 1.0));
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }

    mat2 rot(float a) {
      float s = sin(a), c = cos(a);
      return mat2(c, -s, s, c);
    }

    float starLayer(vec2 p, float scale, float density, float t) {
      vec2 gp = p * scale;
      vec2 cell = floor(gp);
      vec2 f = fract(gp);

      float rnd = hash21(cell);
      float on = step(1.0 - density, rnd);

      vec2 o = (hash22(cell + 7.7) - 0.5) * 0.65;
      vec2 d = (f - 0.5) - o;

      float r2 = dot(d, d);
      float core = smoothstep(0.012, 0.0, r2);

      float tw = 0.65 + 0.35 * sin(t * (1.3 + 2.2 * rnd) + 6.2831 * rnd);
      return on * core * tw;
    }

    vec3 starfield(vec2 p, float t) {
      float r = length(p);
      vec3 base = vec3(0.010, 0.012, 0.020) + 0.015 * vec3(0.2, 0.35, 0.6) * exp(-0.22 * r);

      float n1 = valueNoise(p * 1.2 + vec2(0.0, t * 0.01));
      float n2 = valueNoise(p * 2.4 + vec2(12.3, -t * 0.015));
      float n3 = valueNoise(p * 4.8 + vec2(-4.1, 7.2));
      float neb = (0.55 * n1 + 0.30 * n2 + 0.15 * n3);
      neb = smoothstep(0.45, 0.95, neb);
      vec3 nebCol = vec3(0.10, 0.16, 0.28) * neb;

      float s1 = starLayer(p, 34.0, 0.020, t);
      float s2 = starLayer(p, 78.0, 0.010, t * 1.15);
      float s3 = starLayer(p, 140.0, 0.006, t * 1.35);

      vec3 stars = vec3(0.0);
      stars += s1 * vec3(1.15, 1.10, 1.05);
      stars += s2 * vec3(0.85, 0.95, 1.15);
      stars += s3 * vec3(1.05, 0.95, 0.90);
      stars = min(stars, vec3(1.6));

      return base + nebCol + stars;
    }

    void main() {
      float t = u_time * max(0.0, u_timeScale);

      vec2 frag = gl_FragCoord.xy;
      vec2 center = 0.5 * u_resolution;
      vec2 p = (frag - center) / max(1.0, u_resolution.y);
      float r = length(p);

      float Rs = u_rs / max(1.0, u_resolution.y);
      float eps = 1e-5;

      float inv = 1.0 / (r + 0.22);
      float swirlAngle = u_swirlStrength * 0.45 * inv * (0.75 + 0.25 * sin(t * 0.35)) + t * 0.06;

      vec2 dir = -p / max(r, eps);
      float rr = r * r;
      float Rs2 = Rs * Rs;

      float bend = u_lensStrength * (Rs2 / (rr + 0.35 * Rs2));
      float far = (r / (Rs * 8.0 + eps));
      bend *= 1.0 / (1.0 + far * far);
      bend = clamp(bend, 0.0, 0.35);

      vec2 q = p + dir * bend;
      q = rot(swirlAngle) * q;

      vec3 bg = starfield(q * 2.2, t);

      float aa = fwidth(r) * 1.5 + (1.0 / max(1.0, u_resolution.y));
      float outside = smoothstep(Rs - aa, Rs + aa, r);

      float ringR = Rs * 1.95;
      float ringW = max(Rs * 0.11, 1.5 / max(1.0, u_resolution.y));
      float x = (r - ringR) / max(ringW, eps);
      float ringCore = exp(-x * x);

      float glowW = ringW * 2.4;
      float xg = (r - ringR) / max(glowW, eps);
      float ringGlow = exp(-xg * xg) * 0.55;

      float pulse = 1.0 + 0.03 * sin(t * 0.70);

      float phi = atan(p.y, p.x);
      float doppler = 0.75 + 0.25 * cos(phi - t * 0.25);

      vec3 ringCol = vec3(1.25, 0.98, 0.62) * (ringCore * 1.2 + ringGlow);
      ringCol *= u_ringIntensity * pulse * doppler;

      float diskIn = Rs * 1.12;
      float diskOut = Rs * 5.5;
      float diskMask = smoothstep(diskIn, diskIn + aa * 3.0, r) * (1.0 - smoothstep(diskOut, diskOut + aa * 6.0, r));

      float bands = 0.0;
      bands += sin(10.0 * phi + 6.0 * log(r + 0.12) - t * 0.65);
      bands += 0.6 * sin(18.0 * phi - 9.0 * log(r + 0.14) + t * 0.35);
      bands = 0.5 + 0.5 * bands * 0.5;

      float grit = valueNoise(q * 18.0 + vec2(t * 0.03, -t * 0.02));
      float acc = diskMask * (0.25 + 0.75 * bands) * (0.55 + 0.45 * grit);

      vec3 accCol = vec3(1.10, 0.48, 0.12) * acc * 0.85;

      vec3 col = bg + accCol + ringCol;
      col *= outside;

      col = col / (1.0 + col);
      col = pow(max(col, 0.0), vec3(1.0 / 2.2));

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const VERT_300 = `#version 300 es
    in vec2 a_pos;
    out vec2 v_uv;
    void main() {
      v_uv = a_pos * 0.5 + 0.5;
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }
  `;

  const FRAG_300 = `#version 300 es
    precision highp float;

    uniform float u_time;
    uniform vec2 u_resolution;
    uniform float u_rs;
    uniform float u_lensStrength;
    uniform float u_ringIntensity;
    uniform float u_swirlStrength;
    uniform float u_timeScale;

    in vec2 v_uv;
    out vec4 outColor;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 345.45));
      p += dot(p, p + 34.345);
      return fract(p.x * p.y);
    }

    vec2 hash22(vec2 p) {
      float n = hash21(p);
      return vec2(n, hash21(p + n + 19.19));
    }

    float valueNoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      float a = hash21(i);
      float b = hash21(i + vec2(1.0, 0.0));
      float c = hash21(i + vec2(0.0, 1.0));
      float d = hash21(i + vec2(1.0, 1.0));
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }

    mat2 rot(float a) {
      float s = sin(a), c = cos(a);
      return mat2(c, -s, s, c);
    }

    float starLayer(vec2 p, float scale, float density, float t) {
      vec2 gp = p * scale;
      vec2 cell = floor(gp);
      vec2 f = fract(gp);

      float rnd = hash21(cell);
      float on = step(1.0 - density, rnd);

      vec2 o = (hash22(cell + 7.7) - 0.5) * 0.65;
      vec2 d = (f - 0.5) - o;

      float r2 = dot(d, d);
      float core = smoothstep(0.012, 0.0, r2);

      float tw = 0.65 + 0.35 * sin(t * (1.3 + 2.2 * rnd) + 6.2831 * rnd);
      return on * core * tw;
    }

    vec3 starfield(vec2 p, float t) {
      float r = length(p);
      vec3 base = vec3(0.010, 0.012, 0.020) + 0.015 * vec3(0.2, 0.35, 0.6) * exp(-0.22 * r);

      float n1 = valueNoise(p * 1.2 + vec2(0.0, t * 0.01));
      float n2 = valueNoise(p * 2.4 + vec2(12.3, -t * 0.015));
      float n3 = valueNoise(p * 4.8 + vec2(-4.1, 7.2));
      float neb = (0.55 * n1 + 0.30 * n2 + 0.15 * n3);
      neb = smoothstep(0.45, 0.95, neb);
      vec3 nebCol = vec3(0.10, 0.16, 0.28) * neb;

      float s1 = starLayer(p, 34.0, 0.020, t);
      float s2 = starLayer(p, 78.0, 0.010, t * 1.15);
      float s3 = starLayer(p, 140.0, 0.006, t * 1.35);

      vec3 stars = vec3(0.0);
      stars += s1 * vec3(1.15, 1.10, 1.05);
      stars += s2 * vec3(0.85, 0.95, 1.15);
      stars += s3 * vec3(1.05, 0.95, 0.90);
      stars = min(stars, vec3(1.6));

      return base + nebCol + stars;
    }

    void main() {
      float t = u_time * max(0.0, u_timeScale);

      vec2 frag = gl_FragCoord.xy;
      vec2 center = 0.5 * u_resolution;
      vec2 p = (frag - center) / max(1.0, u_resolution.y);
      float r = length(p);

      float Rs = u_rs / max(1.0, u_resolution.y);
      float eps = 1e-5;

      float inv = 1.0 / (r + 0.22);
      float swirlAngle = u_swirlStrength * 0.45 * inv * (0.75 + 0.25 * sin(t * 0.35)) + t * 0.06;

      vec2 dir = -p / max(r, eps);
      float rr = r * r;
      float Rs2 = Rs * Rs;

      float bend = u_lensStrength * (Rs2 / (rr + 0.35 * Rs2));
      float far = (r / (Rs * 8.0 + eps));
      bend *= 1.0 / (1.0 + far * far);
      bend = clamp(bend, 0.0, 0.35);

      vec2 q = p + dir * bend;
      q = rot(swirlAngle) * q;

      vec3 bg = starfield(q * 2.2, t);

      float aa = fwidth(r) * 1.5 + (1.0 / max(1.0, u_resolution.y));
      float outside = smoothstep(Rs - aa, Rs + aa, r);

      float ringR = Rs * 1.95;
      float ringW = max(Rs * 0.11, 1.5 / max(1.0, u_resolution.y));
      float x = (r - ringR) / max(ringW, eps);
      float ringCore = exp(-x * x);

      float glowW = ringW * 2.4;
      float xg = (r - ringR) / max(glowW, eps);
      float ringGlow = exp(-xg * xg) * 0.55;

      float pulse = 1.0 + 0.03 * sin(t * 0.70);

      float phi = atan(p.y, p.x);
      float doppler = 0.75 + 0.25 * cos(phi - t * 0.25);

      vec3 ringCol = vec3(1.25, 0.98, 0.62) * (ringCore * 1.2 + ringGlow);
      ringCol *= u_ringIntensity * pulse * doppler;

      float diskIn = Rs * 1.12;
      float diskOut = Rs * 5.5;
      float diskMask = smoothstep(diskIn, diskIn + aa * 3.0, r) * (1.0 - smoothstep(diskOut, diskOut + aa * 6.0, r));

      float bands = 0.0;
      bands += sin(10.0 * phi + 6.0 * log(r + 0.12) - t * 0.65);
      bands += 0.6 * sin(18.0 * phi - 9.0 * log(r + 0.14) + t * 0.35);
      bands = 0.5 + 0.5 * bands * 0.5;

      float grit = valueNoise(q * 18.0 + vec2(t * 0.03, -t * 0.02));
      float acc = diskMask * (0.25 + 0.75 * bands) * (0.55 + 0.45 * grit);

      vec3 accCol = vec3(1.10, 0.48, 0.12) * acc * 0.85;

      vec3 col = bg + accCol + ringCol;
      col *= outside;

      col = col / (1.0 + col);
      col = pow(max(col, 0.0), vec3(1.0 / 2.2));

      outColor = vec4(col, 1.0);
    }
  `;

  function compileShader(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh) || 'Unknown shader compile error';
      gl.deleteShader(sh);
      throw new Error(log);
    }
    return sh;
  }

  function createProgram(vsSrc, fsSrc) {
    const vs = compileShader(gl.VERTEX_SHADER, vsSrc);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSrc);
    const prg = gl.createProgram();
    gl.attachShader(prg, vs);
    gl.attachShader(prg, fs);

    // Make attribute location stable across relinks
    gl.bindAttribLocation(prg, 0, 'a_pos');

    gl.linkProgram(prg);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prg, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(prg) || 'Unknown program link error';
      gl.deleteProgram(prg);
      throw new Error(log);
    }
    return prg;
  }

  const program = createProgram(isWebGL2 ? VERT_300 : VERT_100, isWebGL2 ? FRAG_300 : FRAG_100);

  // Fullscreen quad (triangle strip)
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );

  const aPos = 0;

  // Uniform locations
  const uTime = gl.getUniformLocation(program, 'u_time');
  const uRes = gl.getUniformLocation(program, 'u_resolution');
  const uRs = gl.getUniformLocation(program, 'u_rs');
  const uLens = gl.getUniformLocation(program, 'u_lensStrength');
  const uRing = gl.getUniformLocation(program, 'u_ringIntensity');
  const uSwirl = gl.getUniformLocation(program, 'u_swirlStrength');
  const uTimeScale = gl.getUniformLocation(program, 'u_timeScale');

  // WebGL2 VAO (optional but helps avoid state leaks)
  /** @type {WebGLVertexArrayObject|null} */
  let vao = null;
  if (isWebGL2) {
    vao = /** @type {WebGL2RenderingContext} */ (gl).createVertexArray();
    /** @type {WebGL2RenderingContext} */ (gl).bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    /** @type {WebGL2RenderingContext} */ (gl).bindVertexArray(null);
  }

  // This view does not use a three scene/camera
  const scene = null;
  const camera = null;

  function resize(w, h, dpr) {
    // Keep consistent with other views
    const pr = clamp(dpr, 1, 2);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);

    // Ensure GL viewport matches the drawing buffer
    const c = renderer.domElement;
    gl.viewport(0, 0, c.width, c.height);
  }

  function update(_dt) {
    // No CPU-side simulation required
  }

  function render(tMs) {
    // Tell Three to forget cached GL state (raw GL draw will touch state)
    renderer.resetState();

    gl.useProgram(program);

    // Bind geometry
    if (isWebGL2 && vao) {
      /** @type {WebGL2RenderingContext} */ (gl).bindVertexArray(vao);
    } else {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    }

    // Resolution from actual drawing buffer (retina-safe)
    const c = renderer.domElement;
    const w = Math.max(1, c.width);
    const h = Math.max(1, c.height);

    gl.viewport(0, 0, w, h);

    // Set uniforms
    gl.uniform1f(uTime, tMs * 0.001);
    gl.uniform2f(uRes, w, h);
    gl.uniform1f(uRs, params.RsPx);
    gl.uniform1f(uLens, params.lensStrength);
    gl.uniform1f(uRing, params.ringIntensity);
    gl.uniform1f(uSwirl, params.swirlStrength);
    gl.uniform1f(uTimeScale, params.timeScale);

    // Draw
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Unbind to reduce state bleed
    if (isWebGL2 && vao) {
      /** @type {WebGL2RenderingContext} */ (gl).bindVertexArray(null);
    }
  }

  return {
    name: 'Black Hole 2',
    scene,
    camera,
    update,
    resize,
    render,

    // Expose params for quick tweaking in devtools if needed
    params,
  };
}
