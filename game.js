const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let width = window.innerWidth;
let height = window.innerHeight;
canvas.width = width;
canvas.height = height;

// Player
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

// Score
let score = 0;
let gameStarted = false;
let restarting = false;

// Background music
const bgMusic = new Audio('music.mp3');
bgMusic.loop = true;
let musicStarted = false;

// Sound effects
const jumpSound = new Audio('jump.mp3');
const fallSound = new Audio('fall.mp3');

// Init platforms
function initPlatforms() {
  platforms.length = 0;
  let spacing = height / platformCount;
  for (let i = 0; i < platformCount; i++) {
    platforms.push({
      x: Math.random() * (width - platformWidth),
      y: height - 100 - i * spacing
    });
  }
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

// Resize
window.addEventListener('resize', () => {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
  ground.width = width;
});

// Update
function update() {
  if (moveLeft) player.vx = -5;
  else if (moveRight) player.vx = 5;
  else player.vx = 0;

  player.x += player.vx;
  player.y += player.vy;
  player.vy += player.gravity;

  // Wrap edges
  if (player.x < -player.width) player.x = width;
  if (player.x > width) player.x = -player.width;

  // Scroll upwards
  if (player.y < height / 2) {
    const dy = height / 2 - player.y;
    player.y = height / 2;
    ground.y += dy;
    platforms.forEach(p => p.y += dy);
    score += dy;
    gameStarted = true;
  }

  // Collision with platforms
  platforms.forEach(p => {
    if (player.vy > 0 &&
        player.x + player.width > p.x &&
        player.x < p.x + platformWidth &&
        player.y + player.height > p.y &&
        player.y + player.height < p.y + platformHeight) {
      player.vy = player.jumpStrength;
      jumpSound.play().catch(err => {
        console.log('Jump sound error:', err);
      });
    }
  });

  // Collision with ground (before leaving)
  if (!gameStarted && player.vy > 0 &&
      player.y + player.height > ground.y &&
      player.y + player.height < ground.y + ground.height + 10) {
    player.vy = player.jumpStrength;
    player.y = ground.y - player.height;
    jumpSound.play().catch(err => {
      console.log('Jump sound error:', err);
    });
  }

  // Remove old platforms
  for (let i = 0; i < platforms.length; i++) {
    if (platforms[i].y > height) {
      platforms.splice(i, 1);
      platforms.push({
        x: Math.random() * (width - platformWidth),
        y: platforms[platforms.length - 1].y - height / platformCount
      });
    }
  }

  // Game Over
  if (gameStarted && player.y > height && !restarting) {
    handleGameOver();
  }
}

// Draw
function draw() {
  ctx.clearRect(0, 0, width, height);

  // Ground
  if (ground.y < height) {
    ctx.fillStyle = 'green';
    ctx.fillRect(ground.x, ground.y, ground.width, ground.height);
  }

  // Player
  ctx.fillStyle = 'cyan';
  ctx.fillRect(player.x, player.y, player.width, player.height);

  // Platforms
  ctx.fillStyle = 'white';
  platforms.forEach(p => {
    ctx.fillRect(p.x, p.y, platformWidth, platformHeight);
  });

  // Score
  ctx.fillStyle = 'yellow';
  ctx.font = '20px Arial';
  ctx.fillText('Score: ' + Math.floor(score / 100), 10, 30);
}

// Main game loop
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// Handle Game Over
function handleGameOver() {
  restarting = true;
  fallSound.play().catch(err => {
    console.log('Fall sound error:', err);
  });

  setTimeout(() => {
    restartGame();
    restarting = false;
  }, 2000); // 2 seconds pause
}

// Restart game
function restartGame() {
  player.x = width / 2;
  player.y = height - 100;
  player.vy = 0;
  player.vx = 0;

  ground.y = height - 30;

  score = 0;

  initPlatforms();

  gameStarted = false;

  if (musicStarted) {
    bgMusic.pause();
    bgMusic.currentTime = 0;
    bgMusic.play().catch(err => {
      console.log('Music play error on restart:', err);
    });
  }
}

gameLoop();
