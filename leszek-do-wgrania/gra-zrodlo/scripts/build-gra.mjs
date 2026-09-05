// Buduje samodzielny plik gra.html z aktualnego kodu gry.
// - uruchamia `vite build` (plugin viteSingleFile wkleja JS i CSS do jednego HTML)
// - wkleja obrazek Dr. Leszka jako data-URI (base64), żeby plik działał bez żadnych
//   dodatkowych zasobów, pod dowolnym adresem (np. /leszek/gra.html na GitHub Pages)
//
// Użycie:  npm run build:gra   (lub: node scripts/build-gra.mjs)

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

console.log('▶ Buduję produkcyjną wersję (vite build)…');
execSync('npx vite build', { cwd: root, stdio: 'inherit' });

const distHtml = resolve(root, 'dist/index.html');
if (!existsSync(distHtml)) {
  console.error('✖ Nie znaleziono dist/index.html — build się nie powiódł.');
  process.exit(1);
}

let html = readFileSync(distHtml, 'utf8');

// Wklej obrazek jako base64
const imgPath = resolve(root, 'public/images/dr_leszek.png');
if (existsSync(imgPath)) {
  const b64 = readFileSync(imgPath).toString('base64');
  const dataUri = `data:image/png;base64,${b64}`;
  const before = html.split('/images/dr_leszek.png').length - 1;
  html = html.split('/images/dr_leszek.png').join(dataUri);
  console.log(`▶ Wbudowano obrazek Dr. Leszka (${before} odwołań → data-URI).`);
} else {
  console.warn('⚠ Brak public/images/dr_leszek.png — pomijam wbudowanie obrazka.');
}

const out = resolve(root, 'gra.html');
writeFileSync(out, html);
const kb = Math.round(html.length / 1024);
console.log(`✅ Zapisano gra.html (${kb} KB) — samodzielny, gotowy do publikacji.`);
