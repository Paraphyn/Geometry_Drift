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

// Score and game state
let score = 0;
let gameStarted = false;
let restarting = false;

// Background music
const bgMusic = new Audio('music.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.3; // softer background music
let musicStarted = false;

// Sound effects
const jumpSound = new Audio('jump.mp3');
jumpSound.volume = 0.7; // louder jump

const fallSound = new Audio('fall.mp3');
fallSound.volume = 0.9;

// Initialize platforms
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

  // Start music on first interaction
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

// Update game logic
function update() {
  if (moveLeft) player.vx = -5;
  else if (moveRight) player.vx = 5;
  else player.vx = 0;

  player.x += player.vx;
  player.y += player.vy;
  player.vy += player.gravity;

  // Wrap player around screen
  if (player.x < -player.width) player.x = width;
  if (player.x > width) player.x = -player.width;

  // Scroll screen upward
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

      jumpSound.currentTime = 0;
      jumpSound.play().catch(err => {
        console.log('Jump sound error:', err);
      });

      player.vy = player.jumpStrength;
    }
  });

  // Collision with ground before game really starts
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

  // Remove and add new platforms
  for (let i = 0; i < platforms.length; i++) {
    if (platforms[i].y > height) {
      platforms.splice(i, 1);
      platforms.push({
        x: Math.random() * (width - platformWidth),
        y: platforms[platforms.length - 1].y - height / platformCount
      });
    }
  }

  // Check for Game Over
  if (gameStarted && player.y > height && !restarting) {
    handleGameOver();
  }
}

// Drawing game
function draw() {
  ctx.clearRect(0, 0, width, height);

  // Draw ground
  if (ground.y < height) {
    ctx.fillStyle = 'green';
    ctx.fillRect(ground.x, ground.y, ground.width, ground.height);
  }

  // Draw player
  ctx.fillStyle = 'cyan';
  ctx.fillRect(player.x, player.y, player.width, player.height);

  // Draw platforms
  ctx.fillStyle = 'white';
  platforms.forEach(p => {
    ctx.fillRect(p.x, p.y, platformWidth, platformHeight);
  });

  // Draw score
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

// Handle Game Over
function handleGameOver() {
  restarting = true;
  fallSound.currentTime = 0;
  fallSound.play().catch(err => {
    console.log('Fall sound error:', err);
  });

  setTimeout(() => {
    restartGame();
    restarting = false;
  }, 2000); // 2 seconds pause before restarting
}

// Restart the game
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

// Start the game loop
gameLoop();
