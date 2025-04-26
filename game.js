const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let width = window.innerWidth;
let height = window.innerHeight;
canvas.width = width;
canvas.height = height;

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
};

// Trail effect
let playerTrail = [];
const trailLength = 5;

// Ground (starting platform)
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

// Background music
const bgMusic = new Audio('music.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.3;
let musicStarted = false;

// Sound effects
const jumpSound = new Audio('jump.mp3');
jumpSound.volume = 0.7;

const fallSound = new Audio('fall.mp3');
fallSound.volume = 0.9;

// Grid variables
let gridOffsetY = 0;
const gridSpacing = 50;

// Initialize platforms
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

initPlatforms();

// Controls
let moveLeft = false;
let moveRight = false;

function handleTouchStart(e) {
  e.preventDefault();
  const touchX = e.touches[0].clientX;
  if (touchX < window.innerWidth / 2) {
    moveLeft = true;
  } else {
    moveRight = true;
  }

  if (!musicStarted) {
    bgMusic.play().catch(err => {
      console.log('Music autoplay blocked:', err);
    });
    musicStarted = true;
  }
}

function handleTouchEnd(e) {
  e.preventDefault();
  moveLeft = false;
  moveRight = false;
}

window.addEventListener('touchstart', handleTouchStart, { passive: false });
window.addEventListener('touchend', handleTouchEnd, { passive: false });

// Keyboard controls for PC
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyA') moveLeft = true;
  if (e.code === 'KeyD') moveRight = true;
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyA') moveLeft = false;
  if (e.code === 'KeyD') moveRight = false;
});

// Resize
window.addEventListener('resize', () => {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
  ground.width = width;
});

// Update logic
function update() {
  if (restarting) return;

  // Update player trail
  playerTrail.push({ x: player.x, y: player.y });
  if (playerTrail.length > trailLength) {
    playerTrail.shift();
  }

  if (moveLeft) player.vx = -5;
  else if (moveRight) player.vx = 5;
  else player.vx = 0;

  player.x += player.vx;
  player.y += player.vy;
  player.vy += player.gravity;

  // Wrap around edges
  if (player.x < -player.width) player.x = width;
  if (player.x > width) player.x = -player.width;

  // Scroll screen upward
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

  // Platform collision
  for (let i = platforms.length - 1; i >= 0; i--) {
    const p = platforms[i];
    if (player.vy > 0 &&
        player.x + player.width > p.x &&
        player.x < p.x + platformWidth &&
        player.y + player.height > p.y &&
        player.y + player.height < p.y + platformHeight) {
      jumpSound.currentTime = 0;
      jumpSound.play().catch(err => {
        console.log('Jump sound error:', err);
      });
      player.vy = player.jumpStrength;

      // Fade platform
      p.touches++;
      p.opacity -= 0.1;

      // Spawn particles
      spawnParticles(p.x + platformWidth / 2, p.y + platformHeight / 2);

      // Remove platform if too many touches
      if (p.touches >= 3) {
        platforms.splice(i, 1);
      }
    }
  }

  // Ground collision at start
  if (!gameStarted && player.vy > 0 &&
      player.y + player.height > ground.y &&
      player.y + player.height < ground.y + ground.height + 10) {
    jumpSound.currentTime = 0;
    jumpSound.play().catch(err => {
      console.log('Jump sound error:', err);
    });
    player.vy = player.jumpStrength;
    player.y = ground.y - player.height;
  }

  // Update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const pt = particles[i];
    pt.y += pt.vy;
    pt.alpha -= 0.01;
    if (pt.alpha <= 0) {
      particles.splice(i, 1);
    }
  }

  // Generate infinite platforms
  while (platforms.length < platformCount || (platforms[platforms.length - 1].y > 0)) {
    const lastPlatform = platforms.length ? platforms[platforms.length - 1] : { y: height };
    platforms.push(createPlatform(lastPlatform.y - height / platformCount));
  }

  // Game over detection
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

// Draw the infinite grid
function drawGrid() {
  ctx.save();
  ctx.strokeStyle = 'rgba(0,255,255,0.5)';
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

// Draw everything
function draw() {
  ctx.clearRect(0, 0, width, height);

  drawGrid();

  // Ground
  if (ground.y < height) {
    ctx.fillStyle = 'white';
    ctx.fillRect(ground.x, ground.y, ground.width, ground.height);
  }

  // Player trail
  playerTrail.forEach((pos, index) => {
    const reverseIndex = trailLength - index - 1;
    const scale = 1 - (reverseIndex / trailLength) * 0.6;
    const alpha = 0.4 + (reverseIndex / trailLength) * 0.5;
    const trailSize = player.width * scale;
    const offset = (player.width - trailSize) / 2;

    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillRect(pos.x + offset, pos.y + offset, trailSize, trailSize);
  });

  // Player
  ctx.fillStyle = 'cyan';
  ctx.fillRect(player.x, player.y, player.width, player.height);

  // Platforms
  platforms.forEach(p => {
    ctx.fillStyle = `rgba(255,255,255,${p.opacity})`;
    ctx.fillRect(p.x, p.y, platformWidth, platformHeight);
  });

  // Particles
  particles.forEach(pt => {
    ctx.fillStyle = `rgba(255,255,255,${pt.alpha})`;
    ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
  });

  // Score
  ctx.fillStyle = 'yellow';
  ctx.font = '20px Arial';
  ctx.fillText('Score: ' + Math.floor(score / 100), 10, 30);
}

// Game loop
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// Handle game over
function handleGameOver() {
  restarting = true;
  if (musicStarted) bgMusic.pause();
  fallSound.currentTime = 0;
  fallSound.play().catch(err => {
    console.log('Fall sound error:', err);
  });
  setTimeout(() => {
    restartGame();
    restarting = false;
  }, 2000);
}

// Restart
function restartGame() {
  player.x = width / 2;
  player.y = height - 100;
  player.vy = 0;
  player.vx = 0;
  ground.y = height - 30;
  score = 0;
  gridOffsetY = 0;
  playerTrail = [];
  particles.length = 0;
  initPlatforms();
  gameStarted = false;
  if (musicStarted) {
    bgMusic.currentTime = 0;
    bgMusic.play().catch(err => {
      console.log('Music play error on restart:', err);
    });
  }
}

// Start the game
gameLoop();
