const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let width = window.innerWidth;
let height = window.innerHeight;
canvas.width = width;
canvas.height = height;

// Игрок
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

// Земля (начальная платформа)
const ground = {
  x: 0,
  y: height - 30,
  width: width,
  height: 30,
};

// Платформы
const platforms = [];
const platformWidth = 60;
const platformHeight = 10;
const platformCount = 8;

// Счёт
let score = 0;
let gameStarted = false;

// Музыка
const bgMusic = new Audio('music.mp3'); // <-- Путь к твоему аудиофайлу
bgMusic.loop = true; // Зацикливаем музыку
let musicStarted = false;

// Инициализация платформ
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

// Управление
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

  // Запуск музыки при первом взаимодействии
  if (!musicStarted) {
    bgMusic.play().catch(err => {
      console.log('Автозапуск звука заблокирован браузером:', err);
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

// Обработка изменения размеров окна
window.addEventListener('resize', () => {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
  ground.width = width;
});

// Обновление игры
function update() {
  if (moveLeft) player.vx = -5;
  else if (moveRight) player.vx = 5;
  else player.vx = 0;

  player.x += player.vx;
  player.y += player.vy;
  player.vy += player.gravity;

  // Зацикливание выхода за края
  if (player.x < -player.width) player.x = width;
  if (player.x > width) player.x = -player.width;

  // Скроллинг вверх при прыжке
  if (player.y < height / 2) {
    const dy = height / 2 - player.y;
    player.y = height / 2;
    ground.y += dy;
    platforms.forEach(p => p.y += dy);
    score += dy;
    gameStarted = true;
  }

  // Столкновение с платформами
  platforms.forEach(p => {
    if (player.vy > 0 &&
        player.x + player.width > p.x &&
        player.x < p.x + platformWidth &&
        player.y + player.height > p.y &&
        player.y + player.height < p.y + platformHeight) {
      player.vy = player.jumpStrength;
    }
  });

  // Столкновение с землёй (до старта)
  if (!gameStarted && player.vy > 0 &&
      player.y + player.height > ground.y &&
      player.y + player.height < ground.y + ground.height + 10) {
    player.vy = player.jumpStrength;
    player.y = ground.y - player.height;
  }

  // Удаление старых платформ
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
  if (gameStarted && player.y > height) {
    restartGame();
  }
}

// Отрисовка игры
function draw() {
  ctx.clearRect(0, 0, width, height);

  // Земля
  if (ground.y < height) {
    ctx.fillStyle = 'green';
    ctx.fillRect(ground.x, ground.y, ground.width, ground.height);
  }

  // Игрок
  ctx.fillStyle = 'cyan';
  ctx.fillRect(player.x, player.y, player.width, player.height);

  // Платформы
  ctx.fillStyle = 'white';
  platforms.forEach(p => {
    ctx.fillRect(p.x, p.y, platformWidth, platformHeight);
  });

  // Счёт
  ctx.fillStyle = 'yellow';
  ctx.font = '20px Arial';
  ctx.fillText('Score: ' + Math.floor(score / 100), 10, 30);
}

// Главный цикл игры
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// Перезапуск игры
function restartGame() {
  player.x = width / 2;
  player.y = height - 100;
  player.vy = 0;
  player.vx = 0;

  ground.y = height - 30;

  score = 0;

  initPlatforms();

  gameStarted = false;

  // Останавливаем и перезапускаем музыку при рестарте
  if (musicStarted) {
    bgMusic.pause();
    bgMusic.currentTime = 0;
    bgMusic.play().catch(err => {
      console.log('Ошибка воспроизведения музыки при рестарте:', err);
    });
  }
}

gameLoop();
