import * as THREE from 'three';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function raHoursToRad(hours) {
  return (hours / 24) * Math.PI * 2;
}

function decDegToRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Convert equatorial coordinates (RA/Dec) to a point on a sphere.
 * Notes:
 * - This is an arbitrary sky orientation; the relative placements are preserved.
 * - We flip Z so RA around ~6h tends to appear "forward" for a -Z camera.
 * @param {number} raHours
 * @param {number} decDeg
 * @param {number} radius
 */
function radecToXYZ(raHours, decDeg, radius) {
  const ra = raHoursToRad(raHours);
  const dec = decDegToRad(decDeg);
  const cosDec = Math.cos(dec);
  const x = radius * cosDec * Math.cos(ra);
  const y = radius * Math.sin(dec);
  const z = -radius * cosDec * Math.sin(ra);
  return new THREE.Vector3(x, y, z);
}

function createSoftDotTexture(size = 64) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const r = size * 0.5;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.25)');
  g.addColorStop(1.0, 'rgba(255,255,255,0.0)');

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * A small curated set of bright stars per requested constellations (J2000-ish).
 * Coordinates are approximate but preserve real relative placement on the sky.
 */
const STARS = [
  // Orion
  { id: 'ori_betelgeuse', label: 'Betelgeuse', ra: 5.9194, dec: 7.407, mag: 0.42 },
  { id: 'ori_rigel', label: 'Rigel', ra: 5.2422, dec: -8.2017, mag: 0.18 },
  { id: 'ori_bellatrix', label: 'Bellatrix', ra: 5.4186, dec: 6.3497, mag: 1.64 },
  { id: 'ori_saiph', label: 'Saiph', ra: 5.7958, dec: -9.6694, mag: 2.06 },
  { id: 'ori_alnitak', label: 'Alnitak', ra: 5.6792, dec: -1.9428, mag: 1.74 },
  { id: 'ori_alnilam', label: 'Alnilam', ra: 5.6033, dec: -1.2019, mag: 1.69 },
  { id: 'ori_mintaka', label: 'Mintaka', ra: 5.5333, dec: 0.2989, mag: 2.25 },

  // Ursa Major (Big Dipper)
  { id: 'uma_dubhe', label: 'Dubhe', ra: 11.0619, dec: 61.751, mag: 1.79 },
  { id: 'uma_merak', label: 'Merak', ra: 11.0306, dec: 56.3825, mag: 2.37 },
  { id: 'uma_phecda', label: 'Phecda', ra: 11.897, dec: 53.6947, mag: 2.41 },
  { id: 'uma_megrez', label: 'Megrez', ra: 12.2569, dec: 57.0325, mag: 3.32 },
  { id: 'uma_alioth', label: 'Alioth', ra: 12.9003, dec: 55.9597, mag: 1.76 },
  { id: 'uma_mizar', label: 'Mizar', ra: 13.3989, dec: 54.9253, mag: 2.23 },
  { id: 'uma_alkaid', label: 'Alkaid', ra: 13.7922, dec: 49.3133, mag: 1.86 },

  // Ursa Minor (Little Dipper)
  { id: 'umi_polaris', label: 'Polaris', ra: 2.5303, dec: 89.2642, mag: 1.98 },
  { id: 'umi_kochab', label: 'Kochab', ra: 14.845, dec: 74.1556, mag: 2.07 },
  { id: 'umi_pherkad', label: 'Pherkad', ra: 15.3456, dec: 71.8339, mag: 3.0 },
  { id: 'umi_yildun', label: 'Yildun', ra: 17.5369, dec: 86.5861, mag: 4.35 },
  { id: 'umi_epsilon', label: 'Epsilon UMi', ra: 16.7661, dec: 82.0372, mag: 4.21 },
  { id: 'umi_zeta', label: 'Zeta UMi', ra: 15.7344, dec: 77.7944, mag: 4.32 },
  { id: 'umi_eta', label: 'Eta UMi', ra: 16.2917, dec: 75.7553, mag: 4.95 },

  // Cassiopeia
  { id: 'cas_schedar', label: 'Schedar', ra: 0.675, dec: 56.537, mag: 2.24 },
  { id: 'cas_caph', label: 'Caph', ra: 0.1531, dec: 59.1497, mag: 2.28 },
  { id: 'cas_tsih', label: 'Gamma Cas', ra: 0.945, dec: 60.7167, mag: 2.15 },
  { id: 'cas_ruchbah', label: 'Ruchbah', ra: 1.4303, dec: 60.2353, mag: 2.68 },
  { id: 'cas_segin', label: 'Segin', ra: 1.9064, dec: 63.67, mag: 3.37 },

  // Scorpius
  { id: 'sco_antares', label: 'Antares', ra: 16.49, dec: -26.432, mag: 1.06 },
  { id: 'sco_acrab', label: 'Acrab', ra: 16.0906, dec: -19.8056, mag: 2.62 },
  { id: 'sco_dschubba', label: 'Dschubba', ra: 16.0056, dec: -22.6217, mag: 2.32 },
  { id: 'sco_sargas', label: 'Sargas', ra: 17.6219, dec: -42.9978, mag: 1.86 },
  { id: 'sco_shaula', label: 'Shaula', ra: 17.56, dec: -37.1036, mag: 1.62 },
  { id: 'sco_lesath', label: 'Lesath', ra: 17.5125, dec: -37.2956, mag: 2.7 },
];

/** @type {Array<[string,string]>} */
const EDGES = [
  // Orion
  ['ori_betelgeuse', 'ori_bellatrix'],
  ['ori_bellatrix', 'ori_mintaka'],
  ['ori_mintaka', 'ori_alnilam'],
  ['ori_alnilam', 'ori_alnitak'],
  ['ori_alnitak', 'ori_saiph'],
  ['ori_saiph', 'ori_rigel'],
  ['ori_rigel', 'ori_betelgeuse'],

  // Ursa Major
  ['uma_dubhe', 'uma_merak'],
  ['uma_merak', 'uma_phecda'],
  ['uma_phecda', 'uma_megrez'],
  ['uma_megrez', 'uma_alioth'],
  ['uma_alioth', 'uma_mizar'],
  ['uma_mizar', 'uma_alkaid'],
  ['uma_megrez', 'uma_dubhe'],

  // Ursa Minor
  ['umi_polaris', 'umi_yildun'],
  ['umi_yildun', 'umi_epsilon'],
  ['umi_epsilon', 'umi_zeta'],
  ['umi_zeta', 'umi_eta'],
  ['umi_eta', 'umi_pherkad'],
  ['umi_pherkad', 'umi_kochab'],
  ['umi_kochab', 'umi_polaris'],

  // Cassiopeia
  ['cas_caph', 'cas_schedar'],
  ['cas_schedar', 'cas_tsih'],
  ['cas_tsih', 'cas_ruchbah'],
  ['cas_ruchbah', 'cas_segin'],

  // Scorpius (simple spine + tail)
  ['sco_dschubba', 'sco_acrab'],
  ['sco_acrab', 'sco_antares'],
  ['sco_antares', 'sco_sargas'],
  ['sco_sargas', 'sco_shaula'],
  ['sco_shaula', 'sco_lesath'],
];

/**
 * Creates a brighter “constellation layer” (stars + optional connecting lines),
 * placed using approximate real sky coordinates (RA/Dec).
 *
 * @param {{
 *  radius: number,
 *  sizeCore?: number,
 *  sizeGlow?: number,
 *  sizeAttenuation?: boolean,
 *  fog?: boolean,
 *  showLines?: boolean,
 * }} opts
 */
export function createConstellationLayer(opts) {
  const radius = opts.radius;
  const sizeCore = opts.sizeCore ?? 0.2;
  const sizeGlow = opts.sizeGlow ?? sizeCore * 2.5;
  const sizeAttenuation = opts.sizeAttenuation ?? true;
  const fog = opts.fog ?? false;
  const showLines = opts.showLines ?? false;

  const group = new THREE.Group();
  group.name = 'ConstellationLayer';

  const positions = new Float32Array(STARS.length * 3);
  const colors = new Float32Array(STARS.length * 3);

  /** @type {Record<string, { idx:number, p:THREE.Vector3 }>} */
  const byId = {};
  for (let i = 0; i < STARS.length; i++) {
    const s = STARS[i];
    const p = radecToXYZ(s.ra, s.dec, radius);
    byId[s.id] = { idx: i, p };
    const j = i * 3;
    positions[j + 0] = p.x;
    positions[j + 1] = p.y;
    positions[j + 2] = p.z;

    // Convert magnitude into a simple brightness factor (brighter star => larger factor).
    // Visual magnitudes here range roughly [-1..6]; we clamp to keep everything visible.
    // We allow values > 1.0 so ACES tone mapping + additive blending can yield a brighter “pop”.
    const b = clamp(1.85 - (s.mag / 3.2), 0.7, 2.2);
    colors[j + 0] = b;
    colors[j + 1] = b;
    colors[j + 2] = b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const dot = createSoftDotTexture(64);

  const coreMat = new THREE.PointsMaterial({
    color: 0xffffff,
    vertexColors: true,
    size: sizeCore,
    sizeAttenuation,
    map: dot || null,
    transparent: true,
    opacity: 1.0,
    alphaTest: 0.02,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    fog,
  });
  const glowMat = new THREE.PointsMaterial({
    color: 0xffffff,
    vertexColors: true,
    size: sizeGlow * 1.15,
    sizeAttenuation,
    map: dot || null,
    transparent: true,
    opacity: 0.42,
    alphaTest: 0.01,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    fog,
  });

  const starsGlow = new THREE.Points(geo, glowMat);
  const starsCore = new THREE.Points(geo, coreMat);
  starsGlow.frustumCulled = false;
  starsCore.frustumCulled = false;

  group.add(starsGlow, starsCore);

  if (showLines) {
    const segs = [];
    for (const [a, b] of EDGES) {
      const pa = byId[a]?.p;
      const pb = byId[b]?.p;
      if (!pa || !pb) continue;
      segs.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
    }
    if (segs.length) {
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segs), 3));
      const lineMat = new THREE.LineBasicMaterial({
        color: 0xbfd2ff,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog,
      });
      const lines = new THREE.LineSegments(lineGeo, lineMat);
      lines.frustumCulled = false;
      group.add(lines);
    }
  }

  return group;
}

