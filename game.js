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
  vy: 0, // vertical speed
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

// Platform settings
const platforms = [];
const platformWidth = 60;
const platformHeight = 10;
const platformCount = 8;

// Score
let score = 0;
let gameStarted = false;

// Init platforms
function initPlatforms() {
  platforms.length = 0; // clear existing
  let spacing = height / platformCount;
  for (let i = 0; i < platformCount; i++) {
    platforms.push({
      x: Math.random() * (width - platformWidth),
      y: height - 100 - i * spacing
    });
  }
}

initPlatforms();

// Input
let moveLeft = false;
let moveRight = false;

window.addEventListener('touchstart', (e) => {
  const touchX = e.touches[0].clientX;
  if (touchX < width / 2) {
    moveLeft = true;
  } else {
    moveRight = true;
  }
});

window.addEventListener('touchend', () => {
  moveLeft = false;
  moveRight = false;
});

// Resize
window.addEventListener('resize', () => {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
});

// Main game loop
function update() {
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
    let dy = height / 2 - player.y;
    player.y = height / 2;
    ground.y += dy;
    platforms.forEach(p => p.y += dy);
    score += dy;
    gameStarted = true; // Player has left the ground
  }

  // Platform collision
  platforms.forEach(p => {
    if (player.vy > 0 &&
        player.x + player.width > p.x &&
        player.x < p.x + platformWidth &&
        player.y + player.height > p.y &&
        player.y + player.height < p.y + platformHeight) {
      player.vy = player.jumpStrength;
    }
  });

  // Ground collision
  if (!gameStarted && player.vy > 0 &&
      player.y + player.height > ground.y &&
      player.y + player.height < ground.y + ground.height + 10) {
    player.vy = player.jumpStrength;
    player.y = ground.y - player.height; // Stick on top
  }

  // Remove and add new platforms
  for (let i = 0; i < platforms.length; i++) {
    if (platforms[i].y > height) {
      platforms.splice(i, 1);
      platforms.push({
        x: Math.random() * (width - platformWidth),
        y: platforms[platforms.length-1].y - height / platformCount
      });
    }
  }

  // Game Over condition (only if left the ground)
  if (gameStarted && player.y > height) {
    restartGame();
  }
}

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

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// Restart logic
function restartGame() {
  // Reset player
  player.x = width / 2;
  player.y = height - 100;
  player.vy = 0;
  player.vx = 0;

  // Reset ground
  ground.y = height - 30;

  // Reset score
  score = 0;

  // Reset platforms
  initPlatforms();

  // Reset game state
  gameStarted = false;
}

gameLoop();
