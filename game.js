const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let width = window.innerWidth;
let height = window.innerHeight;
canvas.width = width;
canvas.height = height;

const logoImage = new Image();
logoImage.src = 'logo.png';

// States
let currentScreen = 'menu';
let musicOn = true;

// Player settings
const player = { x: width / 2, y: height - 100, width: 30, height: 30, vy: 0, vx: 0, gravity: 0.5, jumpStrength: -12 };

// Trail effect
let playerTrail = [];
let frameCounter = 0;
const trailSpacing = 10;
const maxTrailLength = 15;
let lastTrailAlpha = 1;

// Ground
const ground = { x: 0, y: height - 30, width: width, height: 30 };

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

const menuMusic = new Audio('menu_music.mp3');
menuMusic.loop = true;
menuMusic.volume = 0.3;

const jumpSound = new Audio('jump.mp3');
jumpSound.volume = 0.7;

const fallSound = new Audio('fall.mp3');
fallSound.volume = 0.9;

let musicStarted = false;

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
  return { x: Math.random() * (width - platformWidth), y: y, opacity: 1.0, touches: 0 };
}

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
      resetPlayer();
      initPlatforms();
      if (musicOn) menuMusic.play();
    }
    e.preventDefault();
    if (touchX < window.innerWidth / 2) moveLeft = true;
    else moveRight = true;
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
      resetPlayer();
      initPlatforms();
      if (musicOn) menuMusic.play();
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
    else if (currentScreen === 'game') bgMusic.play();
  }
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
    if (e.code === 'Escape') {
      currentScreen = 'menu';
      stopAllMusic();
      resetPlayer();
      initPlatforms();
      if (musicOn) menuMusic.play();
    }
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyA') moveLeft = false;
  if (e.code === 'KeyD') moveRight = false;
});

// Start menu music immediately if music is on
if (musicOn) {
  menuMusic.play();
}

// (rest of the game logic continues unchanged)
