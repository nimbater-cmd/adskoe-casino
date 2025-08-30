// Старт с 1000 душ
let balance = 1000;
let isSpinning = false;
let inSuperGame = false;
let freeSpinsLeft = 0;
let baseBet = 100;

// Автоигра
let isAutoSpinning = false;

// Звуки
const bgMusic = document.getElementById('bg-music');
const sfxSpin = document.getElementById('sfx-spin');
const sfxHit = document.getElementById('sfx-hit');
const sfxWin = document.getElementById('sfx-win');
const sfxBigWin = document.getElementById('sfx-big-win');

// Включаем звук после первого клика (чтобы браузер разрешил)
let soundUnlocked = false;
function unlockSound() {
  if (soundUnlocked) return;
  soundUnlocked = true;
  bgMusic.volume = 0.4;
  bgMusic.play().catch(() => {});
}

document.addEventListener('click', unlockSound, { once: true });

function playSound(sound) {
  if (sound && soundUnlocked) {
    sound.currentTime = 0;
    sound.play().catch(() => {});
  }
}

function stopSound(sound) {
  if (sound) sound.pause();
  sound.currentTime = 0;
}

// Создаём сетку 8x4 при загрузке
document.addEventListener('DOMContentLoaded', () => {
  const machine = document.getElementById('machine');
  machine.innerHTML = '';
  for (let i = 0; i < 32; i++) {
    const cell = document.createElement('div');
    cell.className = 'reel-cell';
    machine.appendChild(cell);
  }
  document.getElementById('balance').textContent = balance;
});

// Основная функция крутки
function spin() {
  if (isSpinning) return;
  setSpinning(true);
  unlockSound(); // на всякий случай

  if (!inSuperGame) {
    baseBet = parseInt(document.getElementById('bet').value);
    if (isNaN(baseBet) || baseBet < 1 || baseBet > balance) {
      setResult("Неверная ставка.");
      setSpinning(false);
      return;
    }
    balance -= baseBet;
    document.getElementById('balance').textContent = balance;
  }

  const machine = document.getElementById('machine');
  const cells = Array.from(machine.children);

  // Генерация результата
  const result = [];
  for (let i = 0; i < 32; i++) {
    result[i] = Math.random() < 0.006 ? wildSymbol : symbols[Math.floor(Math.random() * 12)];
  }

  // Анимация вращения — 3 секунды
  const intervalTime = 150;
  cells.forEach(cell => {
    cell.classList.add('spinning');
    let spinInterval = setInterval(() => {
      cell.innerHTML = '';
      const img = document.createElement('img');
      img.src = `assets/icon-${Math.floor(Math.random() * 12) + 1}.png`;
      img.style.opacity = '0.7';
      cell.appendChild(img);
    }, intervalTime);
    cell.dataset.interval = spinInterval;
  });

  // Запуск звука вращения
  playSound(sfxSpin);

  // Остановка по столбцам
  for (let col = 0; col < 8; col++) {
    setTimeout(() => {
      stopColumn(col, cells, result);
    }, 300 + col * 300);
  }

  // Проверка после 3 секунд
  setTimeout(() => {
    // Останавливаем звук вращения
    stopSound(sfxSpin);

    // Удар Беса
    const hitChance = inSuperGame ? 0.35 : 0.15;
    const willHit = Math.random() < hitChance;

    if (willHit) {
      playSound(sfxHit);
      triggerDemonHit(baseBet);
    }

    // Сломать ряд
    if (willHit && Math.random() < 0.1) {
      breakRandomRow(cells);
    }

    // Подсчёт выигрыша
    let totalWin = calculateWin(result, baseBet, cells);

    // Супер игра
    const wildCount = result.filter(s => s === wildSymbol).length;
    const triggeredSuperGame = wildCount >= 4 && !inSuperGame;
    if (triggeredSuperGame) {
      inSuperGame = true;
      freeSpinsLeft = 15;
      document.getElementById('super-game').style.display = 'block';
      document.getElementById('free-spins').textContent = freeSpinsLeft;
      playSound(sfxWin);
      setResult("🔥 СУПЕР ИГРА! 15 бесплатных вращений!");
      setTimeout(() => spin(), 2000);
      return;
    }

    // Бесплатные вращения
    if (inSuperGame) {
      freeSpinsLeft--;
      document.getElementById('free-spins').textContent = freeSpinsLeft;
      balance += totalWin;
      document.getElementById('balance').textContent = balance;

      if (freeSpinsLeft <= 0) {
        inSuperGame = false;
        document.getElementById('super-game').style.display = 'none';
        setSpinning(false);
        setResult(`Супер игра завершена! Выиграно: ${totalWin} душ.`);
      } else {
        setTimeout(() => spin(), 1500);
      }
      return;
    }

    // Обычный выигрыш
    balance += totalWin;
    document.getElementById('balance').textContent = balance;

    // Проверка на 300%
    const won300Percent = totalWin >= baseBet * 3;

    if (won300Percent) {
      playSound(sfxBigWin);
      setResult(`🔥 ВЫИГРЫШ 300%! Автоигра остановлена.`);
    } else {
      setResult(`Выигрыш: ${totalWin} душ`);
    }

    setSpinning(false);

    // Автоостановка
    if (isAutoSpinning && !won300Percent && !triggeredSuperGame) {
      setTimeout(() => spin(), 500);
    } else if (isAutoSpinning) {
      stopAutoSpin();
    }
  }, 3000);
}

// Остановка столбца
function stopColumn(col, cells, result) {
  const indices = [col, col + 8, col + 16, col + 24];
  const columnCells = indices.map(i => cells[i]);

  columnCells.forEach((cell, rowIndex) => {
    clearInterval(cell.dataset.interval);
    cell.classList.remove('spinning');
    cell.innerHTML = '';

    setTimeout(() => {
      const img = document.createElement('img');
      const resultIndex = indices[rowIndex];
      img.src = `assets/icon-${result[resultIndex]}.png`;
      img.alt = result[resultIndex];
      img.style.opacity = 0;
      img.style.transition = 'opacity 0.4s ease, transform 0.3s';
      cell.appendChild(img);
      setTimeout(() => {
        img.style.opacity = 1;
        img.style.transform = 'scale(1.05)';
        setTimeout(() => img.style.transform = 'scale(1)', 100);
      }, 50);
    }, rowIndex * 60);
  });
}

// Подсчёт + подсветка
function calculateWin(result, bet, cells) {
  let totalWin = 0;
  const counts = {};
  const indicesMap = {};

  symbols.forEach(s => {
    counts[s] = 0;
    indicesMap[s] = [];
  });
  counts[wildSymbol] = 0;
  indicesMap[wildSymbol] = [];

  result.forEach((sym, i) => {
    if (counts[sym] !== undefined) {
      counts[sym]++;
      indicesMap[sym].push(i);
    }
  });

  cells.forEach(cell => {
    cell.classList.remove('highlight-low', 'highlight-mid', 'highlight-high', 'highlight-wild');
  });

  symbols.forEach(s => {
    const count = counts[s];
    const index = 12 - parseInt(s);
    const payout = payouts[index];
    const minNeeded = 3 + (12 - index);

    if (count >= minNeeded) {
      const multiplier = Math.floor(count / minNeeded);
      totalWin += bet * payout * multiplier;

      indicesMap[s].forEach(i => {
        if (!cells[i].classList.contains('broken')) {
          const cell = cells[i];
          if (index >= 8) {
            cell.classList.add('highlight-high');
          } else if (index >= 4) {
            cell.classList.add('highlight-mid');
          } else {
            cell.classList.add('highlight-low');
          }
        }
      });
    }
  });

  if (counts[wildSymbol] >= 4 && !inSuperGame) {
    indicesMap[wildSymbol].forEach(i => {
      cells[i].classList.add('highlight-wild');
    });
  }

  setTimeout(() => {
    cells.forEach(cell => {
      cell.classList.remove('highlight-low', 'highlight-mid', 'highlight-high', 'highlight-wild');
    });
  }, 2000);

  return totalWin;
}

// Удар
function triggerDemonHit(bet) {
  const effect = document.getElementById('hit-effect');
  effect.style.opacity = 1;
  setTimeout(() => effect.style.opacity = 0, 600);
  playSound(sfxHit);

  const roll = Math.random();
  let multiplier = 2;

  if (roll < 0.10) multiplier = 2;
  else if (roll < 0.19) multiplier = 3;
  else if (roll < 0.27) multiplier = 4;
  else if (roll < 0.34) multiplier = 5;
  else if (roll < 0.39) multiplier = 6;
  else if (roll < 0.42) multiplier = 7;
  else if (roll < 0.44) multiplier = 8;
  else if (roll < 0.45) multiplier = 9;
  else if (roll < 0.451) multiplier = 10;
  else {
    let acc = 0.451;
    for (let m = 11; m <= 15000; m++) {
      acc += 0.00001;
      if (roll < acc) {
        multiplier = m;
        break;
      }
    }
  }

  const win = bet * multiplier;
  setResult(`🔥 БЕС УДАРИЛ! x${multiplier} → ${win} душ!`);
}

// Сломать ряд
function breakRandomRow(cells) {
  const row = Math.floor(Math.random() * 4);
  for (let col = 0; col < 8; col++) {
    cells[row * 8 + col].classList.add('broken');
  }
  const effect = document.getElementById('broken-row');
  effect.style.opacity = 1;
  setTimeout(() => effect.style.opacity = 0, 800);
}

// Автоигра
function toggleAutoSpin() {
  if (isAutoSpinning) {
    stopAutoSpin();
  } else {
    startAutoSpin();
  }
}

function startAutoSpin() {
  isAutoSpinning = true;
  const btn = document.querySelector('button[onclick="toggleAutoSpin()"]');
  btn.textContent = "СТОП";
  btn.style.backgroundColor = "#500";
  spin();
}

function stopAutoSpin() {
  isAutoSpinning = false;
  const btn = document.querySelector('button[onclick="toggleAutoSpin()"]');
  btn.textContent = "АВТО";
  btn.style.backgroundColor = "";
}

// Блокировка
function setSpinning(locked) {
  isSpinning = locked;
  const btn = document.querySelector('button[onclick="spin()"]');
  const bet = document.getElementById('bet');
  btn.disabled = locked;
  bet.disabled = locked;
  btn.textContent = locked ? "КРУТИТСЯ..." : "КРУТИТЬ";
}

// Результат
function setResult(text) {
  document.getElementById('result').textContent = text;
}

// Символы
const symbols = Array.from({ length: 12 }, (_, i) => (i + 1).toString());
const wildSymbol = 'wild';

// Выплаты
const payouts = [
  0.001, 0.1, 0.15, 0.25, 0.30, 0.50, 0.60, 0.70, 0.90, 1.50, 2.00, 3.00
];