// Symulacja headless logiki duchów na wszystkich poziomach.
// Sprawdza: wypuszczanie z domku, ruch duchów (brak zaklinowania),
// powrót zjedzonego ducha do domku. Uruchomienie: node scripts/simulate-ghosts.mjs
import { readFileSync } from 'node:fs';

const COLS = 28, ROWS = 31;
const levels = JSON.parse(readFileSync(new URL('../src/game/levels.json', import.meta.url)));
const CH = { '#': 0, '.': 1, ' ': 2, o: 3, G: 4 };
const parse = rows => rows.map(r => [...r].map(c => CH[c]));

const HOUSE_EXIT = { x: 13, y: 11 };
const HOUSE_CENTER = { x: 13, y: 14 };
const DIRS = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
const SCATTER = [{ x: 25, y: 0 }, { x: 2, y: 0 }, { x: 27, y: 29 }, { x: 0, y: 29 }];

const isWall = (m, tx, ty) => {
  if (ty < 0 || ty >= ROWS) return true;
  const x = ((tx % COLS) + COLS) % COLS;
  return m[ty][x] === 0;
};
const isGhostWall = (m, tx, ty) => {
  if (ty < 0 || ty >= ROWS) return true;
  const x = ((tx % COLS) + COLS) % COLS;
  const c = m[ty][x];
  return c === 0 || c === 4;
};
function ghostAI(g, idx, mode, maze) {
  if (mode === 'eaten') return eatenStepDir(maze, g.x, g.y);
  let tx, ty;
  if (mode === 'scatter') { tx = SCATTER[idx].x; ty = SCATTER[idx].y; }
  else { tx = 14; ty = 23; } // chase ~ pozycja pacmana
  const possible = DIRS.filter(d => {
    const nx = g.x + d.x, ny = g.y + d.y;
    return !isGhostWall(maze, nx, ny) && !(d.x === -g.dir.x && d.y === -g.dir.y);
  });
  if (possible.length === 0) return { x: -g.dir.x, y: -g.dir.y };
  let best = possible[0], bd = Infinity;
  for (const d of possible) {
    const dist = Math.abs(g.x + d.x - tx) + Math.abs(g.y + d.y - ty);
    if (dist < bd) { bd = dist; best = d; }
  }
  return best;
}

// BFS — jak w App.tsx (eatenStepDir)
function eatenStepDir(maze, gx, gy) {
  const tx = HOUSE_CENTER.x, ty = HOUSE_CENTER.y;
  const dist = new Map();
  const queue = [[tx, ty]];
  dist.set(ty * COLS + tx, 0);
  while (queue.length) {
    const [cx, cy] = queue.shift();
    const cd = dist.get(cy * COLS + cx);
    for (const d of DIRS) {
      const nx = ((cx + d.x) % COLS + COLS) % COLS;
      const ny = cy + d.y;
      if (ny < 0 || ny >= ROWS) continue;
      const k = ny * COLS + nx;
      if (dist.has(k) || maze[ny][nx] === 0) continue;
      dist.set(k, cd + 1);
      queue.push([nx, ny]);
    }
  }
  const gd = dist.get(gy * COLS + gx);
  if (gd === undefined) return { x: 0, y: 0 };
  let best = { x: 0, y: 0 }, bestD = gd;
  for (const d of DIRS) {
    const nx = ((gx + d.x) % COLS + COLS) % COLS;
    const ny = gy + d.y;
    if (ny < 0 || ny >= ROWS) continue;
    const nd = dist.get(ny * COLS + nx);
    if (nd !== undefined && nd < bestD) { bestD = nd; best = d; }
  }
  return best;
}

let failures = 0;
for (const lv of levels) {
  const maze = parse(lv.rows);
  const mk = (i) => ({
    x: [13, 13, 11, 15][i], y: [11, 14, 14, 14][i],
    dir: [{ x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }, { x: 0, y: -1 }][i],
    releaseTimer: [0, 40, 100, 170][i],
    visited: new Set(),
  });
  const ghosts = [0, 1, 2, 3].map(mk);

  // Symulacja ruchu (cykle scatter/chase jak w grze).
  for (let step = 0; step < 3000; step++) {
    for (let i = 0; i < 4; i++) {
      const g = ghosts[i];
      if (g.releaseTimer > 0) {
        g.releaseTimer--;
        if (g.releaseTimer === 0) { g.x = HOUSE_EXIT.x; g.y = HOUSE_EXIT.y; }
        continue;
      }
      const mode = Math.floor(step / 300) % 2 === 0 ? 'scatter' : 'chase';
      g.dir = ghostAI(g, i, mode, maze);
      const nx = g.x + g.dir.x, ny = g.y + g.dir.y;
      if (!isGhostWall(maze, nx, ny)) {
        g.x = ((nx % COLS) + COLS) % COLS;
        g.y = Math.max(0, Math.min(ROWS - 1, ny));
      }
      g.visited.add(`${g.x},${g.y}`);
    }
  }
  const visits = ghosts.map(g => g.visited.size);
  const stuck = ghosts.filter(g => g.visited.size < 30);
  if (stuck.length) { failures++; console.error(`✗ [${lv.name}] zaklinowane duchy: ${stuck.length}, odwiedzone pola: ${visits}`); }
  else console.log(`✓ [${lv.name}] duchy w ruchu, unikalne pola: ${visits.join(', ')}`);

  // Powrót zjedzonego ducha do domku z kilku pozycji startowych.
  for (const [sx, sy] of [[14, 23], [1, 1], [26, 29], [6, 11], [21, 19]]) {
    const g = { x: sx, y: sy, dir: { x: 1, y: 0 } };
    let arrived = false;
    for (let step = 0; step < 2000 && !arrived; step++) {
      g.dir = ghostAI(g, 0, 'eaten', maze);
      const nx = g.x + g.dir.x, ny = g.y + g.dir.y;
      if (!isWall(maze, nx, ny)) {
        g.x = ((nx % COLS) + COLS) % COLS;
        g.y = Math.max(0, Math.min(ROWS - 1, ny));
      }
      if (g.x === HOUSE_CENTER.x && g.y === HOUSE_CENTER.y) arrived = true;
    }
    if (!arrived) { failures++; console.error(`✗ [${lv.name}] zjedzony duch z (${sx},${sy}) nie wrócił do domku (jest w ${g.x},${g.y})`); }
  }
  console.log(`  ✓ zjedzony duch wraca do domku z wszystkich pozycji testowych`);
}

if (failures) { console.error(`❌ ${failures} problemów`); process.exit(1); }
console.log('✅ Symulacja duchów OK na wszystkich poziomach!');
