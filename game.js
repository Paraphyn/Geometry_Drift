// game.js full code

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let width = window.innerWidth;
let height = window.innerHeight;
canvas.width = width;
canvas.height = height;

const logoImage = new Image();
logoImage.src = 'logo.png';

// Game states
let currentScreen = 'menu';
let musicOn = true;
let moveLeft = false;
let moveRight = false;
let frameCounter = 0;

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

// Trails
let playerTrail = [];
const trailSpacing = 10;
const maxTrailLength = 15;
let lastTrailAlpha = 1;

// Platforms
const platforms = [];
const platformWidth = 60;
const platformHeight = 10;
const platformCount = 8;

// Particles
const particles = [];

// Other
const ground = { x: 0, y: height - 30, width: width, height: 30 };
let score = 0;
let gameStarted = false;
let restarting = false;

// Music and sounds
const bgMusic = new Audio('music.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.3;

const menuMusic = new Audio('menu_music.mp3');
menuMusic.loop = true;
menuMusic.volume = 0.3;

const jumpSound = new Audio('jump.mp3');
jumpSound.volume = 0.7;

const fallSound = new Audio('fall.mp3');
fallSound.volume = 0.9;

let gridOffsetY = 0;
const gridSpacing = 50;

// Init
function initPlatforms() {
  platforms.length = 0;
  for (let i = 0; i < platformCount; i++) {
    platforms.push(createPlatform(height - 100 - (i * (height / platformCount))));
  }
}

function createPlatform(y) {
  return { x: Math.random() * (width - platformWidth), y: y, opacity: 1.0, touches: 0 };
}

// Music control
function stopAllMusic() {
  bgMusic.pause();
  bgMusic.currentTime = 0;
  menuMusic.pause();
  menuMusic.currentTime = 0;
}

function toggleMusic() {
  musicOn = !musicOn;
  stopAllMusic();
  if (musicOn) {
    if (currentScreen === 'menu') menuMusic.play();
    if (currentScreen === 'game') bgMusic.play();
  }
}

// Start / Restart
function startGame() {
  currentScreen = 'game';
  initPlatforms();
  resetPlayer();
  stopAllMusic();
  if (musicOn) bgMusic.play();
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
}

function handleGameOver() {
  restarting = true;
  stopAllMusic();
  fallSound.play().catch(err => {});
  setTimeout(() => {
    resetPlayer();
    restarting = false;
    if (musicOn) bgMusic.play();
  }, 2000);
}

// Input handling
function handleTouchStart(e) {
  const touchX = e.touches[0].clientX;
  const touchY = e.touches[0].clientY;
  if (currentScreen === 'menu') {
    if (touchX > width/2 - 75 && touchX < width/2 + 75 && touchY > height/2 + 50 && touchY < height/2 + 110) {
      startGame();
    }
    if (touchX > width/2 - 50 && touchX < width/2 + 50 && touchY > height/2 + 130 && touchY < height/2 + 180) {
      toggleMusic();
    }
  } else {
    if (touchX > width - 90 && touchX < width - 20 && touchY > 20 && touchY < 60) {
      currentScreen = 'menu';
      stopAllMusic();
      if (musicOn) menuMusic.play();
    }
    e.preventDefault();
    if (touchX < width / 2) moveLeft = true;
    else moveRight = true;
  }
}

function handleTouchEnd(e) {
  if (currentScreen === 'game') {
    e.preventDefault();
    moveLeft = false;
    moveRight = false;
  }
}

function handleMouseDown(e) {
  const mouseX = e.clientX;
  const mouseY = e.clientY;
  if (currentScreen === 'menu') {
    if (mouseX > width/2 - 75 && mouseX < width/2 + 75 && mouseY > height/2 + 50 && mouseY < height/2 + 110) {
      startGame();
    }
    if (mouseX > width/2 - 50 && mouseX < width/2 + 50 && mouseY > height/2 + 130 && mouseY < height/2 + 180) {
      toggleMusic();
    }
  } else {
    if (mouseX > width - 90 && mouseX < width - 20 && mouseY > 20 && mouseY < 60) {
      currentScreen = 'menu';
      stopAllMusic();
      if (musicOn) menuMusic.play();
    }
  }
}

window.addEventListener('touchstart', handleTouchStart, { passive: false });
window.addEventListener('touchend', handleTouchEnd, { passive: false });
window.addEventListener('mousedown', handleMouseDown);
window.addEventListener('keydown', (e) => {
  if (currentScreen === 'menu' && e.code === 'Space') {
    startGame();
  } else {
    if (e.code === 'KeyA') moveLeft = true;
    if (e.code === 'KeyD') moveRight = true;
    if (e.code === 'Escape') {
      currentScreen = 'menu';
      stopAllMusic();
      if (musicOn) menuMusic.play();
    }
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyA') moveLeft = false;
  if (e.code === 'KeyD') moveRight = false;
});

// Game update
function update() {
  if (restarting || currentScreen !== 'game') return;

  frameCounter++;
  if (frameCounter % trailSpacing === 0) {
    playerTrail.push({ x: player.x, y: player.y, alpha: lastTrailAlpha, vy: 0.5 });
    lastTrailAlpha *= 0.5;
    if (lastTrailAlpha < 0.2) lastTrailAlpha = 1;
    if (playerTrail.length > maxTrailLength) playerTrail.shift();
  }

  playerTrail.forEach(t => {
    t.y += t.vy;
    t.alpha -= 0.02;
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
    gridOffsetY += dy;
    gameStarted = true;
  }

  for (let i = platforms.length - 1; i >= 0; i--) {
    const p = platforms[i];
    if (player.vy > 0 &&
        player.x + player.width > p.x &&
        player.x < p.x + platformWidth &&
        player.y + player.height > p.y &&
        player.y + player.height < p.y + platformHeight) {
      jumpSound.play().catch(err => {});
      player.vy = player.jumpStrength;
      p.touches++;
      p.opacity -= 0.1;
      if (p.touches >= 3) platforms.splice(i, 1);
    }
  }

  if (!gameStarted && player.vy > 0 &&
      player.y + player.height > ground.y &&
      player.y + player.height < ground.y + ground.height + 10) {
    jumpSound.play().catch(err => {});
    player.vy = player.jumpStrength;
    player.y = ground.y - player.height;
  }

  while (platforms.length < platformCount || platforms[platforms.length-1].y > 0) {
    const last = platforms.length ? platforms[platforms.length-1] : { y: height };
    platforms.push(createPlatform(last.y - height / platformCount));
  }

  if (gameStarted && player.y > height && !restarting) {
    handleGameOver();
  }
}

// Draw
function drawBackgroundGradient() {
  const progress = Math.min(score / 10000, 1);
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, `rgb(${50 + 200 * progress}, ${50}, ${150 - 100 * progress})`);
  gradient.addColorStop(1, `rgb(0,${100 * progress},${50 + 150 * (1 - progress)})`);
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

  ctx.drawImage(logoImage, width/2 - 100, height/2 - 150, 200, 100);

  ctx.fillStyle = 'white';
  ctx.fillRect(width/2 - 75, height/2 + 50, 150, 60);
  ctx.fillStyle = 'black';
  ctx.font = '30px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('DRIFT', width/2, height/2 + 95);

  ctx.fillStyle = musicOn ? 'lime' : 'red';
  ctx.fillRect(width/2 - 50, height/2 + 130, 100, 50);
  ctx.fillStyle = 'black';
  ctx.font = '20px Arial';
  ctx.fillText(musicOn ? 'MUSIC ON' : 'MUSIC OFF', width/2, height/2 + 160);
}

function draw() {
  if (currentScreen === 'menu') {
    drawMenu();
    return;
  }

  drawBackgroundGradient();
  drawGrid();

  ctx.fillStyle = 'white';
  ctx.fillRect(ground.x, ground.y, ground.width, ground.height);

  playerTrail.forEach((pos) => {
    ctx.strokeStyle = `rgba(255,255,255,${pos.alpha})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(pos.x, pos.y, player.width, player.height);
  });

  ctx.fillStyle = 'cyan';
  ctx.fillRect(player.x, player.y, player.width, player.height);

  platforms.forEach(p => {
    ctx.fillStyle = `rgba(255,255,255,${p.opacity})`;
    ctx.fillRect(p.x, p.y, platformWidth, platformHeight);
  });

  ctx.fillStyle = 'yellow';
  ctx.font = '20px Arial';
  ctx.fillText('Score: ' + Math.floor(score / 100), 10, 30);

  ctx.fillStyle = 'white';
  ctx.fillRect(width - 90, 20, 70, 40);
  ctx.fillStyle = 'black';
  ctx.fillText('EXIT', width - 55, 50);
}

// Game Loop
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();
