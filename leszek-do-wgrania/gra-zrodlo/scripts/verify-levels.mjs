// Weryfikacja poprawności poziomów z src/game/levels.json.
// Uruchomienie: node scripts/verify-levels.mjs
import { readFileSync } from 'node:fs';

const COLS = 28;
const ROWS = 31;

const levels = JSON.parse(readFileSync(new URL('../src/game/levels.json', import.meta.url)));

// Oryginalny szablon z App.tsx (stan na commit 78fb1ac) — poziom 1 musi być identyczny.
const ORIGINAL = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0],
  [0,3,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,3,0],
  [0,1,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,1,0],
  [0,1,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,1,0],
  [0,1,1,1,1,1,1,0,0,1,1,1,1,0,0,1,1,1,1,0,0,1,1,1,1,1,1,0],
  [0,0,0,0,0,0,1,0,0,0,0,0,2,0,0,2,0,0,0,0,0,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,0,0,0,0,0,2,0,0,2,0,0,0,0,0,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,0,0,2,2,2,2,2,2,2,2,2,2,0,0,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,0,0,2,0,0,0,4,4,0,0,0,2,0,0,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,0,0,2,0,4,4,4,4,4,4,0,2,0,0,1,0,0,0,0,0,0],
  [2,2,2,2,2,2,1,2,2,2,0,4,4,4,4,4,4,0,2,2,2,1,2,2,2,2,2,2],
  [0,0,0,0,0,0,1,0,0,2,0,4,4,4,4,4,4,0,2,0,0,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,0,0,2,0,0,0,0,0,0,0,0,2,0,0,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,0,0,2,2,2,2,2,2,2,2,2,2,0,0,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,0,0,2,0,0,0,0,0,0,0,0,2,0,0,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,0,0,2,0,0,0,0,0,0,0,0,2,0,0,1,0,0,0,0,0,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0],
  [0,1,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0],
  [0,3,1,1,0,0,1,1,1,1,1,1,1,2,2,1,1,1,1,1,1,1,0,0,1,1,3,0],
  [0,0,0,1,0,0,1,0,0,1,0,0,0,0,0,0,0,0,1,0,0,1,0,0,1,0,0,0],
  [0,0,0,1,0,0,1,0,0,1,0,0,0,0,0,0,0,0,1,0,0,1,0,0,1,0,0,0],
  [0,1,1,1,1,1,1,0,0,1,1,1,1,0,0,1,1,1,1,0,0,1,1,1,1,1,1,0],
  [0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0],
  [0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

const CHAR_TO_CELL = { '#': 0, '.': 1, ' ': 2, o: 3, G: 4 };
const PAC_START = { x: 14, y: 23 };

let failures = 0;
const fail = (level, msg) => { failures++; console.error(`  ✗ [${level}] ${msg}`); };

function floodReach(maze) {
  const seen = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const stack = [[PAC_START.x, PAC_START.y]];
  seen[PAC_START.y][PAC_START.x] = true;
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = ((x + dx) % COLS + COLS) % COLS; // zawijanie poziome (tunel)
      const ny = y + dy;
      if (ny < 0 || ny >= ROWS) continue;
      if (!seen[ny][nx] && maze[ny][nx] !== 0) {
        seen[ny][nx] = true;
        stack.push([nx, ny]);
      }
    }
  }
  return seen;
}

console.log(`Weryfikacja ${levels.length} poziomów...\n`);

levels.forEach((lv, idx) => {
  const name = `${idx + 1}: ${lv.name}`;
  console.log(`Poziom ${name}`);

  if (lv.rows.length !== ROWS) fail(name, `zła liczba wierszy: ${lv.rows.length}, oczekiwano ${ROWS}`);
  lv.rows.forEach((row, r) => {
    if (row.length !== COLS) fail(name, `wiersz ${r} ma ${row.length} znaków, oczekiwano ${COLS}: "${row}"`);
    for (const ch of row) if (!(ch in CHAR_TO_CELL)) fail(name, `nieznany znak "${ch}" w wierszu ${r}`);
  });
  if (failures === 0 || lv.rows.length === ROWS) {
    if (!/^[#]{28}$/.test(lv.rows[0])) fail(name, 'wiersz 0 nie jest pełną ścianą');
    if (!/^[#]{28}$/.test(lv.rows[ROWS - 1])) fail(name, 'wiersz 30 nie jest pełną ścianą');

    const maze = lv.rows.map(r => [...r].map(ch => CHAR_TO_CELL[ch]));

    // Poziom 1 musi być bit w bit oryginalnym labiryntem.
    if (idx === 0) {
      const same = JSON.stringify(maze) === JSON.stringify(ORIGINAL);
      if (!same) fail(name, 'poziom 1 różni się od oryginalnego MAZE_TEMPLATE!');
      else console.log('  ✓ identyczny z oryginalnym MAZE_TEMPLATE');
    }

    // Domek duchów i wyjście.
    const checks = [
      [[13, 11], 'wyjście z domku (13,11) powinno być przejezdne', c => c !== 0],
      [[13, 12], 'drzwi domku (13,12) powinny być typu G', c => c === 4],
      [[13, 14], 'środek domku (13,14) powinien być typu G', c => c === 4],
      [[11, 14], 'pole startowe ducha (11,14) powinno być typu G', c => c === 4],
      [[15, 14], 'pole startowe ducha (15,14) powinno być typu G', c => c === 4],
      [[14, 14], 'pole startowe ducha (14,14) powinno być typu G', c => c === 4],
      [[14, 23], 'start Pac-Mana (14,23) powinien być przejezdny', c => c !== 0],
      [[13, 23], 'pole obok startu (13,23) powinno być przejezdne', c => c !== 0],
      [[0, 14], 'tunel: (0,14) powinno być przejezdne', c => c !== 0],
      [[27, 14], 'tunel: (27,14) powinno być przejezdne', c => c !== 0],
    ];
    for (const [[x, y], desc, ok] of checks) if (!ok(maze[y][x])) fail(name, desc);

    // Osiągalność wszystkich kropek i power pelletów z startu Pac-Mana.
    const seen = floodReach(maze);
    let dots = 0, power = 0, unreachable = 0, unreachableEmpty = 0;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = maze[y][x];
        if (c === 1 || c === 3) {
          if (c === 1) dots++; else power++;
          if (!seen[y][x]) { unreachable++; fail(name, `nieosiągalna kropka/power w (${x},${y})`); }
        } else if (c !== 0 && !seen[y][x]) unreachableEmpty++;
      }
    }
    if (unreachableEmpty > 0) console.log(`  ⚠ ${unreachableEmpty} pustych pól nieosiągalnych (bez kropek — OK)`);
    if (power !== 4) fail(name, `liczba power pelletów: ${power}, oczekiwano 4`);
    if (dots < 100) fail(name, `za mało kropek: ${dots}`);
    console.log(`  ✓ kropki: ${dots}, power pellety: ${power}, wszystkie osiągalne: ${unreachable === 0}`);
  }
  console.log('');
});

if (failures > 0) {
  console.error(`❌ Niepowodzenie: ${failures} problemów.`);
  process.exit(1);
}
console.log('✅ Wszystkie poziomy poprawne!');
