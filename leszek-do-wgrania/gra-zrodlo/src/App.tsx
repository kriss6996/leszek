import { useEffect, useRef, useState, useCallback } from 'react';
import { LEVELS, countDots, HOUSE_EXIT, HOUSE_CENTER } from './game/levels';

// --- GAME CONSTANTS ---
const TILE = 20;
const COLS = 28;
const ROWS = 31;
const W = COLS * TILE;
const H = ROWS * TILE;

type Dir = { x: number; y: number };
type GhostMode = 'scatter' | 'chase' | 'frightened' | 'eaten';

interface Ghost {
  x: number; y: number;
  px: number; py: number;
  dir: Dir;
  color: string;
  mode: GhostMode;
  modeTimer: number;
  homeX: number; homeY: number;
  dotAnim: number;
  releaseTimer: number; // >0 = duch czeka w domku na wypuszczenie
}

interface GameState {
  maze: number[][];
  levelIndex: number;
  pacX: number; pacY: number;
  pacPX: number; pacPY: number;
  pacDir: Dir; nextDir: Dir;
  ghosts: Ghost[];
  score: number;
  lives: number;
  dotsLeft: number;
  totalDots: number;
  phase: 'idle' | 'playing' | 'dying' | 'levelwin' | 'gameover';
  mouthAngle: number;
  mouthDir: number;
  frightenedTimer: number;
  level: number;
  animFrame: number;
  floatingTexts: { x: number; y: number; text: string; life: number; id: number }[];
  nextFloatingId: number;
}

const GHOST_COLORS = ['#FF0000', '#FFB8FF', '#00FFFF', '#FFB852'];
const GHOST_SCATTER = [
  { x: 25, y: 0 }, { x: 2, y: 0 }, { x: 27, y: 29 }, { x: 0, y: 29 }
];

// Opóźnienia wypuszczenia duchów z domku (w krokach ducha).
const GHOST_RELEASE_DELAYS = [0, 40, 100, 170];

function isWall(maze: number[][], tx: number, ty: number): boolean {
  if (ty < 0 || ty >= ROWS) return true;
  const x = ((tx % COLS) + COLS) % COLS;
  return maze[ty][x] === 0;
}

function isGhostWall(maze: number[][], tx: number, ty: number): boolean {
  if (ty < 0 || ty >= ROWS) return true;
  const x = ((tx % COLS) + COLS) % COLS;
  const cell = maze[ty][x];
  return cell === 0 || cell === 4;
}

const DIRS: Dir[] = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }
];

// Zjedzony duch wraca do domku po najkrótszej ścieżce (BFS) — zachłanny wybór
// kierunku potrafił zapętlić się np. w wierszu tunelu.
function eatenStepDir(maze: number[][], gx: number, gy: number): Dir {
  const tx = HOUSE_CENTER.x, ty = HOUSE_CENTER.y;
  const dist = new Map<number, number>();
  const queue: number[][] = [[tx, ty]];
  dist.set(ty * COLS + tx, 0);
  while (queue.length) {
    const [cx, cy] = queue.shift()!;
    const cd = dist.get(cy * COLS + cx)!;
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
  let best: Dir = { x: 0, y: 0 };
  let bestD = gd;
  for (const d of DIRS) {
    const nx = ((gx + d.x) % COLS + COLS) % COLS;
    const ny = gy + d.y;
    if (ny < 0 || ny >= ROWS) continue;
    const nd = dist.get(ny * COLS + nx);
    if (nd !== undefined && nd < bestD) { bestD = nd; best = d; }
  }
  return best;
}

function ghostAI(ghost: Ghost, pacX: number, pacY: number, idx: number, mode: GhostMode, maze: number[][]): Dir {
  let targetX: number, targetY: number;
  if (mode === 'frightened') {
    // random
    const possible = DIRS.filter(d => {
      const nx = ghost.x + d.x, ny = ghost.y + d.y;
      return !isGhostWall(maze, nx, ny) && !(d.x === -ghost.dir.x && d.y === -ghost.dir.y);
    });
    if (possible.length === 0) return ghost.dir;
    return possible[Math.floor(Math.random() * possible.length)];
  }
  if (mode === 'eaten') {
    return eatenStepDir(maze, ghost.x, ghost.y);
  }
  if (mode === 'scatter') {
    targetX = GHOST_SCATTER[idx].x;
    targetY = GHOST_SCATTER[idx].y;
  } else {
    // chase
    switch (idx) {
      case 0: targetX = pacX; targetY = pacY; break;
      case 1: targetX = pacX + 2; targetY = pacY + 2; break;
      case 2: targetX = pacX - 2; targetY = pacY - 2; break;
      default: targetX = pacX + 3; targetY = pacY + 3;
    }
  }

  const possible = DIRS.filter(d => {
    const nx = ghost.x + d.x, ny = ghost.y + d.y;
    return !isGhostWall(maze, nx, ny) && !(d.x === -ghost.dir.x && d.y === -ghost.dir.y);
  });

  if (possible.length === 0) return { x: -ghost.dir.x, y: -ghost.dir.y };

  let bestDir = possible[0];
  let bestDist = Infinity;
  for (const d of possible) {
    const nx = ghost.x + d.x, ny = ghost.y + d.y;
    const dist = Math.abs(nx - targetX) + Math.abs(ny - targetY);
    if (dist < bestDist) { bestDist = dist; bestDir = d; }
  }
  return bestDir;
}

function initGhosts(): Ghost[] {
  return [
    { x: 13, y: 11, px: 13, py: 11, dir: { x: 1, y: 0 }, color: GHOST_COLORS[0], mode: 'scatter', modeTimer: 300, homeX: 13, homeY: 14, dotAnim: 0, releaseTimer: GHOST_RELEASE_DELAYS[0] },
    { x: 13, y: 14, px: 13, py: 14, dir: { x: 0, y: -1 }, color: GHOST_COLORS[1], mode: 'scatter', modeTimer: 350, homeX: 13, homeY: 14, dotAnim: 0, releaseTimer: GHOST_RELEASE_DELAYS[1] },
    { x: 11, y: 14, px: 11, py: 14, dir: { x: 0, y: 1 }, color: GHOST_COLORS[2], mode: 'scatter', modeTimer: 400, homeX: 11, homeY: 14, dotAnim: 0, releaseTimer: GHOST_RELEASE_DELAYS[2] },
    { x: 15, y: 14, px: 15, py: 14, dir: { x: 0, y: -1 }, color: GHOST_COLORS[3], mode: 'scatter', modeTimer: 450, homeX: 15, homeY: 14, dotAnim: 0, releaseTimer: GHOST_RELEASE_DELAYS[3] },
  ];
}

// Tworzy stan gry dla zadanego poziomu (poziomy zapęlają się z rosnącą trudnością).
function initState(level = 1, score = 0, lives = 3): GameState {
  const levelIndex = (level - 1) % LEVELS.length;
  const maze = LEVELS[levelIndex].maze.map(row => [...row]);
  const totalDots = countDots(maze);
  return {
    maze,
    levelIndex,
    pacX: 14, pacY: 23,
    pacPX: 14, pacPY: 23,
    pacDir: { x: 0, y: 0 },
    nextDir: { x: 0, y: 0 },
    ghosts: initGhosts(),
    score,
    lives,
    dotsLeft: totalDots,
    totalDots,
    phase: 'idle',
    mouthAngle: 0.25,
    mouthDir: 1,
    frightenedTimer: 0,
    level,
    animFrame: 0,
    floatingTexts: [],
    nextFloatingId: 0,
  };
}

// Trudność: im wyższy poziom, tym szybsze duchy i krótszy power pellet.
function ghostSpeedInterval(level: number): number {
  return Math.max(5, 9 - level);
}

function frightenedDuration(level: number): number {
  return Math.max(120, 460 - 60 * level);
}

// --- DRAW HELPERS ---
function drawMaze(ctx: CanvasRenderingContext2D, maze: number[][], animFrame: number, wallFill: string, wallStroke: string) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // Draw walls
  ctx.fillStyle = wallFill;
  ctx.strokeStyle = wallStroke;
  ctx.lineWidth = 1;

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (maze[row][col] === 0) {
        ctx.fillRect(col * TILE, row * TILE, TILE, TILE);
        ctx.strokeRect(col * TILE + 0.5, row * TILE + 0.5, TILE - 1, TILE - 1);
      }
    }
  }

  // Draw dots (as animated "69")
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (maze[row][col] === 1) {
        const cx = col * TILE + TILE / 2;
        const cy = row * TILE + TILE / 2;
        // Animated tiny "69"
        const anim = Math.sin(animFrame * 0.15 + col * 0.3 + row * 0.2) * 1.5;
        ctx.save();
        ctx.translate(cx, cy + anim);
        ctx.fillStyle = '#FFD700';
        ctx.font = `bold 8px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Pulsing color
        const hue = (animFrame * 3 + col * 20 + row * 15) % 360;
        ctx.fillStyle = `hsl(${hue}, 100%, 65%)`;
        ctx.fillText('69', 0, 0);
        ctx.restore();
      } else if (maze[row][col] === 3) {
        // Power pellet as big "69"
        const cx = col * TILE + TILE / 2;
        const cy = row * TILE + TILE / 2;
        const scale = 1 + Math.sin(animFrame * 0.1) * 0.3;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.font = `bold 13px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 8;
        ctx.fillText('69', 0, 0);
        ctx.restore();
      }
    }
  }
}

function drawGhost(ctx: CanvasRenderingContext2D, ghost: Ghost, frightenedTimer: number) {
  const cx = ghost.x * TILE + TILE / 2;
  const cy = ghost.y * TILE + TILE / 2;
  const r = TILE / 2 - 1;

  ctx.save();
  ctx.translate(cx, cy);

  if (ghost.mode === 'frightened') {
    const flash = frightenedTimer < 120 && Math.floor(frightenedTimer / 20) % 2 === 0;
    ctx.fillStyle = flash ? '#fff' : '#0000cc';
    // Ghost body
    ctx.beginPath();
    ctx.arc(0, -2, r, Math.PI, 0);
    ctx.lineTo(r, r);
    for (let i = 0; i < 3; i++) {
      ctx.quadraticCurveTo(r - (i + 0.5) * (2 * r / 3), r + 4, r - (i + 1) * (2 * r / 3), r);
    }
    ctx.lineTo(-r, r);
    ctx.closePath();
    ctx.fill();
    // Eyes
    ctx.fillStyle = flash ? '#00f' : '#fff';
    ctx.beginPath();
    ctx.ellipse(-3, -2, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(3, -2, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (ghost.mode === 'eaten') {
    // Just eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(-3, 0, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(3, 0, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#00f';
    ctx.beginPath(); ctx.ellipse(-3, 0, 2, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(3, 0, 2, 2, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = ghost.color;
    ctx.beginPath();
    ctx.arc(0, -2, r, Math.PI, 0);
    ctx.lineTo(r, r);
    for (let i = 0; i < 3; i++) {
      ctx.quadraticCurveTo(r - (i + 0.5) * (2 * r / 3), r + 4, r - (i + 1) * (2 * r / 3), r);
    }
    ctx.lineTo(-r, r);
    ctx.closePath();
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(-3, -2, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(3, -2, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#00f';
    ctx.beginPath(); ctx.ellipse(-3 + ghost.dir.x * 2, -2 + ghost.dir.y * 2, 2, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(3 + ghost.dir.x * 2, -2 + ghost.dir.y * 2, 2, 2, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(initState());
  const keysRef = useRef<Set<string>>(new Set());
  const rafRef = useRef<number>(0);
  const drLeszekImg = useRef<HTMLImageElement | null>(null);
  const imgLoadedRef = useRef(false);
  const [uiScore, setUiScore] = useState(0);
  const [uiLives, setUiLives] = useState(3);
  const [uiPhase, setUiPhase] = useState<string>('idle');
  const [uiLevel, setUiLevel] = useState(1);
  const tickRef = useRef(0);
  const ghostEatComboRef = useRef(0);

  // Load dr Leszek image
  useEffect(() => {
    const img = new Image();
    img.src = '/images/dr_leszek.png';
    img.onload = () => { imgLoadedRef.current = true; drLeszekImg.current = img; };
    img.onerror = () => { imgLoadedRef.current = false; };
    drLeszekImg.current = img;
  }, []);

  const startGame = useCallback(() => {
    const s = initState(1, 0, 3);
    s.phase = 'playing';
    s.floatingTexts.push({ x: 13, y: 6, text: `POZIOM 1 • ${LEVELS[0].name}`, life: 130, id: s.nextFloatingId++ });
    stateRef.current = s;
    ghostEatComboRef.current = 0;
    setUiScore(0); setUiLives(3); setUiPhase('playing'); setUiLevel(1);
  }, []);

  // Przejście na następny poziom: wynik i życia zostają (+1 życie bonusowo, max 5).
  const advanceLevel = useCallback(() => {
    const prev = stateRef.current;
    const nextLevel = prev.level + 1;
    const s = initState(nextLevel, prev.score, Math.min(5, prev.lives + 1));
    s.phase = 'playing';
    s.floatingTexts.push({ x: 13, y: 6, text: `POZIOM ${nextLevel} • ${LEVELS[s.levelIndex].name}`, life: 130, id: s.nextFloatingId++ });
    if (prev.lives < 5) {
      s.floatingTexts.push({ x: 14, y: 8, text: '+1 🩺 ŻYCIE!', life: 130, id: s.nextFloatingId++ });
    }
    stateRef.current = s;
    ghostEatComboRef.current = 0;
    setUiScore(s.score); setUiLives(s.lives); setUiPhase('playing'); setUiLevel(s.level);
  }, []);

  const handleKey = useCallback((e: KeyboardEvent) => {
    keysRef.current.add(e.key);
    const s = stateRef.current;
    if (s.phase === 'levelwin') {
      if (e.key === 'Enter' || e.key === ' ') advanceLevel();
    } else if (s.phase === 'idle' || s.phase === 'gameover') {
      if (e.key === 'Enter' || e.key === ' ') startGame();
    }
    if (s.phase === 'playing') {
      switch (e.key) {
        case 'ArrowLeft': case 'a': s.nextDir = { x: -1, y: 0 }; break;
        case 'ArrowRight': case 'd': s.nextDir = { x: 1, y: 0 }; break;
        case 'ArrowUp': case 'w': s.nextDir = { x: 0, y: -1 }; break;
        case 'ArrowDown': case 's': s.nextDir = { x: 0, y: 1 }; break;
      }
    }
    e.preventDefault();
  }, [startGame, advanceLevel]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const PAC_SPEED_INTERVAL = 6;

    function update() {
      const s = stateRef.current;
      tickRef.current++;
      s.animFrame++;

      // Mouth animation
      s.mouthAngle += s.mouthDir * 0.04;
      if (s.mouthAngle >= 0.4) s.mouthDir = -1;
      if (s.mouthAngle <= 0.02) s.mouthDir = 1;

      // Floating texts
      s.floatingTexts = s.floatingTexts
        .map(ft => ({ ...ft, life: ft.life - 1, y: ft.y - 0.3 }))
        .filter(ft => ft.life > 0);

      if (s.phase !== 'playing') return;

      // PAC movement
      if (tickRef.current % PAC_SPEED_INTERVAL === 0) {
        // Try next direction
        const nx = s.pacX + s.nextDir.x;
        const ny = s.pacY + s.nextDir.y;
        if (!isWall(s.maze, nx, ny)) {
          s.pacDir = { ...s.nextDir };
        }
        // Move in current direction
        const mx = s.pacX + s.pacDir.x;
        const my = s.pacY + s.pacDir.y;
        if (!isWall(s.maze, mx, my)) {
          s.pacPX = s.pacX; s.pacPY = s.pacY;
          s.pacX = ((mx % COLS) + COLS) % COLS;
          s.pacY = my;
        }

        // Eat dot
        const cell = s.maze[s.pacY]?.[s.pacX];
        if (cell === 1) {
          s.maze[s.pacY][s.pacX] = 2;
          s.score += 10;
          s.dotsLeft--;
          s.floatingTexts.push({ x: s.pacX, y: s.pacY, text: '+10', life: 40, id: s.nextFloatingId++ });
        } else if (cell === 3) {
          s.maze[s.pacY][s.pacX] = 2;
          s.score += 50;
          s.dotsLeft--;
          s.frightenedTimer = frightenedDuration(s.level);
          ghostEatComboRef.current = 0;
          s.ghosts.forEach(g => { if (g.mode !== 'eaten') g.mode = 'frightened'; });
          s.floatingTexts.push({ x: s.pacX, y: s.pacY, text: '⚡ POWER!', life: 60, id: s.nextFloatingId++ });
        }

        if (s.dotsLeft <= 0) {
          s.phase = 'levelwin';
          setUiPhase('levelwin');
          return;
        }
      }

      // Frightened timer
      if (s.frightenedTimer > 0) {
        s.frightenedTimer--;
        if (s.frightenedTimer === 0) {
          s.ghosts.forEach(g => { if (g.mode === 'frightened') g.mode = 'scatter'; });
        }
      }

      // GHOST movement (szybkość rośnie z poziomem)
      if (tickRef.current % ghostSpeedInterval(s.level) === 0) {
        for (let i = 0; i < s.ghosts.length; i++) {
          const g = s.ghosts[i];

          // Duch czekający w domku: odliczanie, po zejściu do 0 wychodzi przez drzwi.
          if (g.releaseTimer > 0) {
            g.releaseTimer--;
            if (g.releaseTimer === 0) {
              g.x = HOUSE_EXIT.x; g.y = HOUSE_EXIT.y;
              g.px = HOUSE_EXIT.x; g.py = HOUSE_EXIT.y;
              g.dir = { x: i % 2 === 0 ? -1 : 1, y: 0 };
            }
            continue;
          }

          // Mode timer
          g.modeTimer--;
          if (g.modeTimer <= 0 && g.mode !== 'frightened' && g.mode !== 'eaten') {
            g.mode = g.mode === 'scatter' ? 'chase' : 'scatter';
            g.modeTimer = g.mode === 'scatter' ? 200 : 400;
            g.dir = { x: -g.dir.x, y: -g.dir.y };
          }

          const effectiveMode = s.frightenedTimer > 0 && g.mode !== 'eaten' ? 'frightened' : g.mode;
          const newDir = ghostAI(g, s.pacX, s.pacY, i, effectiveMode, s.maze);
          g.dir = newDir;
          const ngx = g.x + g.dir.x;
          const ngy = g.y + g.dir.y;
          if (!isGhostWall(s.maze, ngx, ngy) || g.mode === 'eaten') {
            g.px = g.x; g.py = g.y;
            g.x = ((ngx % COLS) + COLS) % COLS;
            g.y = Math.max(0, Math.min(ROWS - 1, ngy));
          }
          // Zjedzony duch wrócił do domku — chwilę czeka i wraca do gry.
          if (g.mode === 'eaten' && g.x === HOUSE_CENTER.x && g.y === HOUSE_CENTER.y) {
            g.mode = 'scatter';
            g.modeTimer = 200;
            g.releaseTimer = 50;
          }

          // Collision with pac
          if (Math.abs(g.x - s.pacX) <= 1 && Math.abs(g.y - s.pacY) <= 1) {
            if (g.mode === 'frightened') {
              g.mode = 'eaten';
              ghostEatComboRef.current++;
              const pts = 200 * Math.pow(2, ghostEatComboRef.current - 1);
              s.score += pts;
              s.floatingTexts.push({ x: g.x, y: g.y, text: `+${pts} 🩺`, life: 60, id: s.nextFloatingId++ });
            } else if (g.mode !== 'eaten') {
              s.lives--;
              s.phase = 'dying';
              setUiLives(s.lives);
              setUiPhase('dying');
              setTimeout(() => {
                if (s.lives <= 0) {
                  stateRef.current.phase = 'gameover';
                  setUiPhase('gameover');
                } else {
                  stateRef.current.pacX = 14; stateRef.current.pacY = 23;
                  stateRef.current.pacDir = { x: 0, y: 0 };
                  stateRef.current.nextDir = { x: 0, y: 0 };
                  stateRef.current.ghosts = initGhosts();
                  stateRef.current.phase = 'playing';
                  setUiPhase('playing');
                }
              }, 1500);
              return;
            }
          }
        }
      }

      setUiScore(s.score);
    }

    function drawPacman(ctx: CanvasRenderingContext2D, s: GameState) {
      const cx = s.pacX * TILE + TILE / 2;
      const cy = s.pacY * TILE + TILE / 2;
      const r = TILE / 2 - 1;

      if (drLeszekImg.current && imgLoadedRef.current) {
        // Draw dr Leszek image clipped in a circle with mouth effect
        ctx.save();
        ctx.translate(cx, cy);

        // Rotate based on direction
        let angle = 0;
        if (s.pacDir.x === 1) angle = 0;
        else if (s.pacDir.x === -1) angle = Math.PI;
        else if (s.pacDir.y === -1) angle = -Math.PI / 2;
        else if (s.pacDir.y === 1) angle = Math.PI / 2;
        ctx.rotate(angle);

        // Clip to pacman mouth shape
        const mouth = s.mouthAngle * Math.PI;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r + 2, mouth, Math.PI * 2 - mouth);
        ctx.closePath();
        ctx.clip();

        // Draw image
        ctx.drawImage(drLeszekImg.current, -r - 2, -r - 2, (r + 2) * 2, (r + 2) * 2);
        ctx.restore();

        // Rainbow hat hint
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.arc(0, 0, r + 2, mouth, Math.PI * 2 - mouth);
        ctx.closePath();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      } else {
        // Fallback: classic yellow pacman
        ctx.save();
        ctx.translate(cx, cy);
        let angle = 0;
        if (s.pacDir.x === 1) angle = 0;
        else if (s.pacDir.x === -1) angle = Math.PI;
        else if (s.pacDir.y === -1) angle = -Math.PI / 2;
        else if (s.pacDir.y === 1) angle = Math.PI / 2;
        ctx.rotate(angle);
        const mouth = s.mouthAngle * Math.PI;
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r, mouth, Math.PI * 2 - mouth);
        ctx.closePath();
        ctx.fill();
        // "DR.L" text
        ctx.rotate(-angle);
        ctx.fillStyle = '#000';
        ctx.font = `bold 5px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('DR.L', 0, 0);
        ctx.restore();
      }
    }

    function draw() {
      const s = stateRef.current;
      ctx.clearRect(0, 0, W, H);

      const lv = LEVELS[s.levelIndex] ?? LEVELS[0];
      drawMaze(ctx, s.maze, s.animFrame, lv.wallFill, lv.wallStroke);

      // Draw ghosts
      for (const g of s.ghosts) {
        drawGhost(ctx, g, s.frightenedTimer);
      }

      // Draw pacman
      if (s.phase !== 'gameover') {
        drawPacman(ctx, s);
      }

      // Draw floating texts
      for (const ft of s.floatingTexts) {
        ctx.save();
        ctx.globalAlpha = ft.life / 60;
        ctx.font = `bold 12px Arial`;
        ctx.fillStyle = '#FFD700';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.fillText(ft.text, ft.x * TILE + TILE / 2, ft.y * TILE);
        ctx.restore();
      }

      // Overlay messages
      if (s.phase === 'idle') {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, W, H);
        ctx.font = 'bold 22px Arial';
        ctx.fillStyle = '#FFD700';
        ctx.textAlign = 'center';
        ctx.fillText('DR. LESZEK', W / 2, H / 2 - 50);
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = '#fff';
        ctx.fillText('PAC-MAN 69!', W / 2, H / 2 - 20);
        ctx.font = '13px Arial';
        ctx.fillStyle = '#aaa';
        ctx.fillText('Naciśnij ENTER lub SPACJĘ', W / 2, H / 2 + 20);
        ctx.fillText('WASD lub strzałki = ruch', W / 2, H / 2 + 40);
      }
      if (s.phase === 'dying') {
        ctx.font = 'bold 20px Arial';
        ctx.fillStyle = '#ff4444';
        ctx.textAlign = 'center';
        ctx.fillText('AUU! 💀', W / 2, H / 2);
      }
      if (s.phase === 'gameover') {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, W, H);
        ctx.font = 'bold 28px Arial';
        ctx.fillStyle = '#ff4444';
        ctx.textAlign = 'center';
        ctx.fillText('KONIEC GRY!', W / 2, H / 2 - 40);
        ctx.font = '18px Arial';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`Wynik: ${s.score}`, W / 2, H / 2);
        ctx.font = '14px Arial';
        ctx.fillStyle = '#fff';
        ctx.fillText(`Doszedłeś do poziomu ${s.level} (${lv.name})`, W / 2, H / 2 + 28);
        ctx.fillStyle = '#aaa';
        ctx.fillText('ENTER = zagraj ponownie', W / 2, H / 2 + 52);
      }
      if (s.phase === 'levelwin') {
        const nextLv = LEVELS[s.level % LEVELS.length];
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, W, H);
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#00ff88';
        ctx.textAlign = 'center';
        ctx.fillText('POZIOM UKOŃCZONY! 🎉', W / 2, H / 2 - 40);
        ctx.font = 'bold 15px Arial';
        ctx.fillStyle = lv.wallStroke;
        ctx.fillText(`Następny: POZIOM ${s.level + 1} • ${nextLv.name}`, W / 2, H / 2 - 5);
        ctx.font = '14px Arial';
        ctx.fillStyle = '#fff';
        ctx.fillText('+1 🩺 za ukończenie poziomu!', W / 2, H / 2 + 25);
        ctx.fillStyle = '#aaa';
        ctx.fillText('ENTER = następny poziom', W / 2, H / 2 + 50);
      }
    }

    function loop() {
      update();
      draw();
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Touch/swipe controls
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    const s = stateRef.current;
    if (s.phase === 'levelwin') {
      advanceLevel(); return;
    }
    if (s.phase === 'idle' || s.phase === 'gameover') {
      startGame(); return;
    }
    if (Math.abs(dx) > Math.abs(dy)) {
      s.nextDir = dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
    } else {
      s.nextDir = dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
    }
  };

  const dirBtnStyle = "w-16 h-16 rounded-full bg-yellow-400 text-black font-bold text-2xl flex items-center justify-center active:bg-yellow-200 active:scale-95 transition-transform select-none touch-none shadow-lg";

  // Pominięcie poziomu w trakcie gry (ekranowy odpowiednik dawnego klawisza).
  const skipLevel = useCallback(() => {
    if (stateRef.current.phase !== 'playing') return;
    advanceLevel();
  }, [advanceLevel]);

  // Duży przycisk akcji: start / następny poziom / zagraj ponownie.
  const handleAction = useCallback(() => {
    const p = stateRef.current.phase;
    if (p === 'levelwin') advanceLevel();
    else if (p !== 'playing' && p !== 'dying') startGame();
  }, [advanceLevel, startGame]);

  // Obsługa dotyku/kliknięcia bez podwójnego wyzwolenia i bez przenoszenia gestu na planszę.
  const tapHandler = (fn: () => void) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); e.stopPropagation(); fn(); },
  });

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-start py-4 px-2">
      {/* Link powrotny na stronę główną */}
      <a
        href="index.html"
        className="self-start mb-2 text-gray-400 text-sm hover:text-yellow-400 transition-colors select-none"
      >
        ← Powrót na TwójOtwór.pl
      </a>

      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="text-3xl">🩺</div>
        <div>
          <h1 className="text-yellow-400 font-black text-2xl tracking-wide" style={{ fontFamily: 'Arial Black, sans-serif', textShadow: '0 0 10px #FFD700' }}>
            DR. LESZEK PAC-MAN <span className="text-pink-400">69!</span>
          </h1>
          <p className="text-gray-400 text-xs text-center">Zjedz wszystkie 69! Unikaj duchów!</p>
        </div>
        <div className="text-3xl">🩺</div>
      </div>

      {/* Score bar */}
      <div className="flex gap-6 mb-3 bg-gray-900 rounded-xl px-6 py-2 shadow-inner border border-gray-700">
        <div className="text-center">
          <div className="text-gray-400 text-xs uppercase tracking-widest">Wynik</div>
          <div className="text-yellow-400 font-bold text-xl">{uiScore}</div>
        </div>
        <div className="text-center">
          <div className="text-gray-400 text-xs uppercase tracking-widest">Poziom</div>
          <div className="text-green-400 font-bold text-xl">{uiLevel}</div>
          <div className="text-gray-500 text-[10px] max-w-[90px] truncate">{LEVELS[(uiLevel - 1) % LEVELS.length]?.name}</div>
        </div>
        <div className="text-center">
          <div className="text-gray-400 text-xs uppercase tracking-widest">Życia</div>
          <div className="text-red-400 font-bold text-xl">{'🩺'.repeat(Math.max(0, uiLives))}</div>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative rounded-xl overflow-hidden shadow-2xl border-2 border-blue-800"
        style={{ boxShadow: '0 0 30px #1a1aff88' }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{ display: 'block', maxWidth: '100%', maxHeight: '70vh', imageRendering: 'pixelated' }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        />
      </div>

      {/* Duży ekranowy przycisk akcji (zamiast Enter): start / następny poziom / restart */}
      {(uiPhase === 'idle' || uiPhase === 'gameover' || uiPhase === 'levelwin') && (
        <button
          {...tapHandler(handleAction)}
          className="mt-4 px-8 py-4 bg-yellow-400 text-black font-black text-xl rounded-full active:bg-yellow-300 active:scale-95 transition-all shadow-lg select-none touch-none"
        >
          {uiPhase === 'idle' ? '🩺 ZAGRAJ!' : uiPhase === 'levelwin' ? '➡️ NASTĘPNY POZIOM' : '🔄 ZAGRAJ PONOWNIE'}
        </button>
      )}

      {/* Ekranowy D-pad + przyciski akcji — zawsze widoczne, sterowanie dotykowe */}
      <div className="mt-4 flex flex-col items-center gap-2 select-none">
        <div className="grid grid-cols-3 grid-rows-3 gap-2" style={{ width: 'fit-content' }}>
          <span />
          <button className={dirBtnStyle} {...tapHandler(() => { stateRef.current.nextDir = { x: 0, y: -1 }; })}>▲</button>
          <span />
          <button className={dirBtnStyle} {...tapHandler(() => { stateRef.current.nextDir = { x: -1, y: 0 }; })}>◀</button>
          <span />
          <button className={dirBtnStyle} {...tapHandler(() => { stateRef.current.nextDir = { x: 1, y: 0 }; })}>▶</button>
          <span />
          <button className={dirBtnStyle} {...tapHandler(() => { stateRef.current.nextDir = { x: 0, y: 1 }; })}>▼</button>
          <span />
        </div>

        {/* Dodatkowe klawisze ekranowe: pomiń poziom + zagraj od nowa */}
        <div className="flex items-center gap-3 mt-2">
          <button
            {...tapHandler(skipLevel)}
            className="px-5 py-3 bg-green-500 text-black font-bold text-sm rounded-full active:bg-green-400 active:scale-95 transition-all shadow-lg select-none touch-none"
          >
            ⏭️ POMIŃ POZIOM
          </button>
          <button
            {...tapHandler(startGame)}
            className="px-5 py-3 bg-red-500 text-white font-bold text-sm rounded-full active:bg-red-400 active:scale-95 transition-all shadow-lg select-none touch-none"
          >
            🔄 OD NOWA
          </button>
        </div>
      </div>

      <p className="mt-3 text-gray-500 text-xs text-center px-4">
        📱 Dotykaj strzałek, aby sterować • przesuwaj palcem po planszy • ⏭️ pomija poziom
      </p>
      <p className="mt-1 text-gray-600 text-xs text-center px-4">🩺 Dr. Leszek vs duchy • 5 labiryntów: {LEVELS.map(l => l.name).join(' → ')} • Power-up = DUŻE 69</p>
    </div>
  );
}
