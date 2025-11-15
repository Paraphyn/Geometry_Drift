// Modified to handle mouse clicks on DRIFT button
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let width = window.innerWidth;
let height = window.innerHeight;
canvas.width = width;
canvas.height = height;

const logoImage = new Image();
logoImage.src = 'logo.png'; // Replace with your logo file

// States
let currentScreen = 'menu'; // 'menu' or 'game'
let lobbyGlowPhase = 0;

// Player settings
const player = {
  x: width / 2,
  y: height - 100,
  width: 30,
  height: 30,
  vy: 0,
  vx: 0,
  gravity: 0.5,
  jumpStrength: -12,
  damageTimer: 0,
};

const PLAYER_THEMES = {
  neonFrame: {
    label: 'Neon Frame',
    shape: 'roundedRect',
    radius: 8,
    baseFill: '#00f5ff',
    baseStroke: '#ffffff',
    glow: 'rgba(0,245,255,0.65)',
    shadowBlur: 18,
    damagedFill: '#ff5c8d',
    damagedStroke: '#ffe066',
    damageGlow: 'rgba(255,92,141,0.75)',
    damageShadowBlur: 26,
    strokeWidth: 2,
  },
  auroraDiamond: {
    label: 'Aurora Diamond',
    shape: 'diamond',
    baseFill: '#9d4edd',
    baseStroke: '#e0aaff',
    glow: 'rgba(224,170,255,0.55)',
    shadowBlur: 16,
    damagedFill: '#ff6b6b',
    damagedStroke: '#ffe66d',
    damageGlow: 'rgba(255,107,107,0.65)',
    damageShadowBlur: 24,
    strokeWidth: 2,
  },
  pulseOrb: {
    label: 'Pulse Orb',
    shape: 'circle',
    baseFill: '#00c6ff',
    baseStroke: '#f0f0f0',
    glow: 'rgba(0,198,255,0.65)',
    shadowBlur: 20,
    damagedFill: '#ff4b1f',
    damagedStroke: '#ffd152',
    damageGlow: 'rgba(255,75,31,0.7)',
    damageShadowBlur: 28,
    strokeWidth: 2,
  },
};

const THEME_KEYS = Object.keys(PLAYER_THEMES);
const DEFAULT_THEME_KEY = THEME_KEYS[0];

function readStoredThemeKey() {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return DEFAULT_THEME_KEY;
  }
  try {
    const stored = window.localStorage.getItem('drift-player-theme');
    if (stored && PLAYER_THEMES[stored]) return stored;
  } catch (err) {
    // ignore
  }
  return DEFAULT_THEME_KEY;
}

function persistThemeKey(key) {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
  try {
    window.localStorage.setItem('drift-player-theme', key);
  } catch (err) {
    // ignore
  }
}

let selectedThemeKey = readStoredThemeKey();

function setTheme(key) {
  if (!PLAYER_THEMES[key]) return;
  selectedThemeKey = key;
  persistThemeKey(key);
}

function cycleTheme(step = 1) {
  if (!THEME_KEYS.length) return;
  const idx = THEME_KEYS.indexOf(selectedThemeKey);
  const safeIdx = idx === -1 ? 0 : idx;
  const nextIdx = (safeIdx + step + THEME_KEYS.length) % THEME_KEYS.length;
  setTheme(THEME_KEYS[nextIdx]);
}

function getCurrentTheme() {
  return PLAYER_THEMES[selectedThemeKey] || PLAYER_THEMES[DEFAULT_THEME_KEY];
}

const DAMAGE_DURATION = 90;

// Trail effect
let playerTrail = [];
let frameCounter = 0;
const trailSpacing = 10;
const maxTrailLength = 15;
let lastTrailAlpha = 1;

// Ground
const ground = {
  x: 0,
  y: height - 30,
  width: width,
  height: 30,
};

// Platforms
const platforms = [];
const platformWidth = 60;
const platformHeight = 10;
const platformCount = 8;

// Particles
const particles = [];

// Score and state
let score = 0;
let gameStarted = false;
let restarting = false;

// Music & sounds
const bgMusic = new Audio('music.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.3;
let musicStarted = false;

const jumpSound = new Audio('jump.mp3');
jumpSound.volume = 0.7;

const fallSound = new Audio('fall.mp3');
fallSound.volume = 0.9;

// Grid
let gridOffsetY = 0;
const gridSpacing = 50;

function initPlatforms() {
  platforms.length = 0;
  let spacing = height / platformCount;
  for (let i = 0; i < platformCount; i++) {
    platforms.push(createPlatform(height - 100 - i * spacing));
  }
}

function createPlatform(y) {
  return {
    x: Math.random() * (width - platformWidth),
    y: y,
    opacity: 1.0,
    touches: 0
  };
}

function handleTouchStart(e) {
  if (currentScreen === 'menu') {
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    if (touchX > width/2 - 75 && touchX < width/2 + 75 && touchY > height/2 + 50 && touchY < height/2 + 110) {
      startGame();
    }
  } else {
    e.preventDefault();
    const touchX = e.touches[0].clientX;
    if (touchX < window.innerWidth / 2) moveLeft = true;
    else moveRight = true;
    if (!musicStarted) {
      bgMusic.play().catch(err => {});
      musicStarted = true;
    }
  }
}

function handleMouseDown(e) {
  if (currentScreen === 'menu') {
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    if (mouseX > width/2 - 75 && mouseX < width/2 + 75 && mouseY > height/2 + 50 && mouseY < height/2 + 110) {
      startGame();
    }
  }
}

function handleTouchEnd(e) {
  if (currentScreen === 'game') {
    e.preventDefault();
    moveLeft = false;
    moveRight = false;
  }
}

function startGame() {
  currentScreen = 'game';
  initPlatforms();
  resetPlayer();
}

function resetPlayer() {
  player.x = width / 2;
  player.y = height - 100;
  player.vy = 0;
  player.vx = 0;
  ground.y = height - 30;
  score = 0;
  gridOffsetY = 0;
  playerTrail = [];
  lastTrailAlpha = 1;
  particles.length = 0;
  player.damageTimer = 0;
}

window.addEventListener('touchstart', handleTouchStart, { passive: false });
window.addEventListener('touchend', handleTouchEnd, { passive: false });
window.addEventListener('mousedown', handleMouseDown);
window.addEventListener('keydown', (e) => {
  if (currentScreen === 'menu') {
    if (e.code === 'Space') startGame();
  } else {
    if (e.code === 'KeyA') moveLeft = true;
    if (e.code === 'KeyD') moveRight = true;
    if (e.code === 'Escape') currentScreen = 'menu';
  }
  if (e.code === 'KeyQ') cycleTheme(-1);
  if (e.code === 'KeyE') cycleTheme(1);
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyA') moveLeft = false;
  if (e.code === 'KeyD') moveRight = false;
});

let moveLeft = false;
let moveRight = false;

function update() {
  if (restarting || currentScreen !== 'game') return;

  if (player.damageTimer > 0) {
    player.damageTimer--;
  }

  frameCounter++;
  if (frameCounter % trailSpacing === 0) {
    playerTrail.push({ x: player.x, y: player.y, alpha: lastTrailAlpha, vy: 0.5 });
    lastTrailAlpha *= 0.5;
    if (lastTrailAlpha < 0.2) lastTrailAlpha = 1;
    if (playerTrail.length > maxTrailLength) {
      playerTrail.shift();
    }
  }

  playerTrail.forEach(trail => {
    trail.y += trail.vy;
    trail.alpha -= 0.02;
  });

  if (moveLeft) player.vx = -5;
  else if (moveRight) player.vx = 5;
  else player.vx = 0;

  player.x += player.vx;
  player.y += player.vy;
  player.vy += player.gravity;

  if (player.x < -player.width) player.x = width;
  if (player.x > width) player.x = -player.width;

  if (player.y < height / 2) {
    const dy = height / 2 - player.y;
    player.y = height / 2;
    ground.y += dy;
    platforms.forEach(p => p.y += dy);
    particles.forEach(pt => pt.y += dy);
    score += dy;
    gameStarted = true;
    gridOffsetY += dy;
  }

  for (let i = platforms.length - 1; i >= 0; i--) {
    const p = platforms[i];
    if (player.vy > 0 &&
        player.x + player.width > p.x &&
        player.x < p.x + platformWidth &&
        player.y + player.height > p.y &&
        player.y + player.height < p.y + platformHeight) {
      jumpSound.currentTime = 0;
      jumpSound.play().catch(err => {});
      player.vy = player.jumpStrength;
      p.touches++;
      p.opacity -= 0.1;
      spawnParticles(p.x + platformWidth / 2, p.y + platformHeight / 2);
      if (p.touches >= 3) platforms.splice(i, 1);
    }
  }

  if (!gameStarted && player.vy > 0 &&
      player.y + player.height > ground.y &&
      player.y + player.height < ground.y + ground.height + 10) {
    jumpSound.currentTime = 0;
    jumpSound.play().catch(err => {});
    player.vy = player.jumpStrength;
    player.y = ground.y - player.height;
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const pt = particles[i];
    pt.y += pt.vy;
    pt.alpha -= 0.01;
    if (pt.alpha <= 0) particles.splice(i, 1);
  }

  while (platforms.length < platformCount || (platforms[platforms.length - 1].y > 0)) {
    const lastPlatform = platforms.length ? platforms[platforms.length - 1] : { y: height };
    platforms.push(createPlatform(lastPlatform.y - height / platformCount));
  }

  if (gameStarted && player.y > height && !restarting) {
    handleGameOver();
  }
}

function spawnParticles(x, y) {
  for (let i = 0; i < 5; i++) {
    particles.push({
      x: x + (Math.random() - 0.5) * 20,
      y: y,
      vy: 1 + Math.random() * 2,
      size: 2 + Math.random() * 2,
      alpha: 1
    });
  }
}

function triggerPlayerDamage(duration = DAMAGE_DURATION) {
  player.damageTimer = Math.max(player.damageTimer, duration);
}

function drawPlayerSprite({ x, y, width, height, alpha = 1, isDamaged = false, isTrail = false }) {
  const theme = getCurrentTheme();
  const radius = theme.radius ?? 6;
  ctx.save();
  ctx.globalAlpha = alpha;

  if (!isTrail) {
    ctx.shadowColor = isDamaged ? theme.damageGlow : theme.glow;
    const blur = isDamaged ? (theme.damageShadowBlur ?? 24) : (theme.shadowBlur ?? 16);
    ctx.shadowBlur = blur;
  } else {
    ctx.shadowBlur = 0;
  }

  ctx.fillStyle = isDamaged ? theme.damagedFill : theme.baseFill;
  ctx.strokeStyle = isDamaged ? theme.damagedStroke : theme.baseStroke;
  ctx.lineWidth = theme.strokeWidth ?? 2;

  ctx.beginPath();
  buildPlayerShapePath(theme.shape, x, y, width, height, radius);
  ctx.closePath();
  ctx.fill();
  if (ctx.lineWidth > 0) {
    ctx.stroke();
  }

  ctx.restore();
}

function buildPlayerShapePath(shape, x, y, width, height, radius = 0) {
  switch (shape) {
    case 'diamond':
      ctx.moveTo(x + width / 2, y);
      ctx.lineTo(x + width, y + height / 2);
      ctx.lineTo(x + width / 2, y + height);
      ctx.lineTo(x, y + height / 2);
      break;
    case 'circle':
      ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
      break;
    default:
      drawRoundedRectPath(x, y, width, height, radius);
  }
}

function drawRoundedRectPath(x, y, width, height, radius) {
  const r = Math.min(Math.max(radius, 0), width / 2, height / 2);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function drawBackgroundGradient() {
  const progress = Math.min(score / 10000, 1);
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, `rgb(${50 + 200 * progress}, ${50}, ${150 - 100 * progress})`);
  gradient.addColorStop(1, `rgb(${0}, ${0 + 100 * progress}, ${50 + 150 * (1 - progress)})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawGrid() {
  ctx.save();
  ctx.strokeStyle = 'rgba(0,255,255,0.15)';
  ctx.lineWidth = 1;
  const offset = gridOffsetY % gridSpacing;
  for (let x = 0; x < width; x += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, -offset);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = -offset; y < height; y += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMenu() {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, width, height);

  lobbyGlowPhase += 0.02;
  const pulse = (Math.sin(lobbyGlowPhase) + 1) / 2;
  const glowHeight = Math.min(height * 0.3, 200);
  const glowAlpha = 0.25 + 0.25 * pulse;
  const glowGradient = ctx.createLinearGradient(0, height - glowHeight, 0, height);
  glowGradient.addColorStop(0, 'rgba(255, 60, 60, 0)');
  glowGradient.addColorStop(1, `rgba(255, 40, 40, ${glowAlpha.toFixed(3)})`);
  ctx.fillStyle = glowGradient;
  ctx.fillRect(0, height - glowHeight, width, glowHeight);

  ctx.drawImage(logoImage, width/2 - 100, height/2 - 150, 200, 100);

  ctx.fillStyle = 'white';
  ctx.fillRect(width/2 - 75, height/2 + 50, 150, 60);
  ctx.fillStyle = 'black';
  ctx.font = '30px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('DRIFT', width/2, height/2 + 95);

  const theme = getCurrentTheme();
  ctx.fillStyle = '#0ff';
  ctx.font = '20px Arial';
  ctx.fillText(`Theme: ${theme.label}`, width / 2, height / 2 + 150);
  ctx.font = '16px Arial';
  ctx.fillText('Press Q/E to change theme', width / 2, height / 2 + 175);
}

function draw() {
  if (currentScreen === 'menu') {
    drawMenu();
    return;
  }

  drawBackgroundGradient();
  drawGrid();

  if (ground.y < height) {
    ctx.fillStyle = 'white';
    ctx.fillRect(ground.x, ground.y, ground.width, ground.height);
  }

  playerTrail.forEach((pos) => {
    if (pos.alpha <= 0) return;
    drawPlayerSprite({
      x: pos.x,
      y: pos.y,
      width: player.width,
      height: player.height,
      alpha: Math.max(0, Math.min(1, pos.alpha)),
      isDamaged: player.damageTimer > 0,
      isTrail: true,
    });
  });

  drawPlayerSprite({
    x: player.x,
    y: player.y,
    width: player.width,
    height: player.height,
    isDamaged: player.damageTimer > 0,
  });

  platforms.forEach(p => {
    if (p.touches === 0) ctx.fillStyle = `rgba(255,255,255,${p.opacity})`;
    else if (p.touches === 1) ctx.fillStyle = `rgba(173,216,230,${p.opacity})`;
    else ctx.fillStyle = `rgba(255,160,122,${p.opacity})`;
    ctx.fillRect(p.x, p.y, platformWidth, platformHeight);
  });

  particles.forEach(pt => {
    ctx.fillStyle = `rgba(255,255,255,${pt.alpha})`;
    ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
  });

  ctx.textAlign = 'left';
  ctx.fillStyle = 'yellow';
  ctx.font = '20px Arial';
  ctx.fillText('Score: ' + Math.floor(score / 100), 10, 30);

  ctx.fillStyle = '#aef';
  ctx.font = '14px Arial';
  ctx.fillText(`Theme: ${getCurrentTheme().label}  [Q/E]`, 10, 55);

  ctx.fillStyle = 'white';
  ctx.fillRect(width - 90, 20, 70, 40);
  ctx.fillStyle = 'black';
  ctx.textAlign = 'center';
  ctx.fillText('EXIT', width - 55, 50);
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

function handleGameOver() {
  restarting = true;
  triggerPlayerDamage(DAMAGE_DURATION);
  if (musicStarted) bgMusic.pause();
  fallSound.currentTime = 0;
  fallSound.play().catch(err => {});
  setTimeout(() => {
    restartGame();
    restarting = false;
  }, 2000);
}

function restartGame() {
  resetPlayer();
  gameStarted = false;
  if (musicStarted) {
    bgMusic.currentTime = 0;
    bgMusic.play().catch(err => {});
  }
}

// Start
gameLoop();
