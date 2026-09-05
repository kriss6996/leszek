// Definicje poziomów gry Dr. Leszek Pac-Man.
// Dane labiryntów trzymane są w levels.json w formie tekstowej:
//   '#' = ściana, '.' = kropka (69), ' ' = puste pole,
//   'o' = power pellet (DUŻE 69), 'G' = dom duchów.
import rawLevels from './levels.json';

export interface LevelDef {
  name: string;
  wallFill: string;
  wallStroke: string;
  maze: number[][];
  totalDots: number;
}

interface RawLevel {
  name: string;
  wallFill: string;
  wallStroke: string;
  rows: string[];
}

const CHAR_TO_CELL: Record<string, number> = {
  '#': 0, // ściana
  '.': 1, // kropka
  ' ': 2, // puste pole
  o: 3,   // power pellet
  G: 4,   // dom duchów
};

function parseMaze(rows: string[]): number[][] {
  return rows.map(row => [...row].map(ch => CHAR_TO_CELL[ch] ?? 2));
}

export function countDots(maze: number[][]): number {
  let c = 0;
  for (const row of maze) for (const cell of row) if (cell === 1 || cell === 3) c++;
  return c;
}

export const RAW_LEVELS = rawLevels as RawLevel[];

export const LEVELS: LevelDef[] = RAW_LEVELS.map(lv => {
  const maze = parseMaze(lv.rows);
  return {
    name: lv.name,
    wallFill: lv.wallFill,
    wallStroke: lv.wallStroke,
    maze,
    totalDots: countDots(maze),
  };
});

// Stałe współrzędne wspólne dla wszystkich poziomów (środkowy pas labiryntu).
export const HOUSE_EXIT = { x: 13, y: 11 };   // wyjście z domku duchów
export const HOUSE_CENTER = { x: 13, y: 14 }; // środek domku (cel zjedzonego ducha)
