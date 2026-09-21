// Uruchom serwer statyczny, potem npm run test:browser (patrz images/README.md).
'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const url = process.env.GABINET_URL || 'http://127.0.0.1:8000/gabinet.html';

// Rejestrujemy rzeczywiste drawImage i macierze Canvas dla deterministycznych faz ruchu.
async function sprawdzWarstwy(page) {
  const dane = await page.evaluate(() => {
    const drawImage = ctx.drawImage, raf = window.requestAnimationFrame;
    const rysowania = [], wyniki = [];
    ctx.drawImage = function(obraz, ...args) {
      const { a, b, c, d, e, f } = this.getTransform();
      rysowania.push({ plik: new URL(obraz.src).pathname.split('/').pop(), args, macierz: [a, b, c, d, e, f] });
      return drawImage.call(this, obraz, ...args);
    };
    // klatka() nie może tworzyć dodatkowych pętli requestAnimationFrame w teście.
    window.requestAnimationFrame = () => 0;
    try {
      startGry();
      const czas = performance.now();
      for (const [nazwa, odUderzenia] of [
        ['spoczynek', null], ['zamach', 45], ['uniesienie', 90], ['opuszczanie', 130],
        ['docisk', 170], ['powrót', 230], ['odbicie', 330], ['po animacji', 500],
      ]) {
        stan.ostatniHit = odUderzenia === null ? -Infinity : czas - odUderzenia;
        pacjent.ostatniHit = stan.ostatniHit;
        pacjent.bob = 0; pacjent.predkosc = 0;
        poprzedniCzas = czas;
        rysowania.length = 0;
        klatka(czas);
        wyniki.push({ nazwa, rysowania: rysowania.slice() });
      }
      return { wyniki, okno: OKNO, W, H };
    } finally {
      ctx.drawImage = drawImage;
      window.requestAnimationFrame = raf;
    }
  });
  const klatki = dane.wyniki;
  const kamera = [dane.W / dane.okno.w, 0, 0, dane.H / dane.okno.h,
                  -dane.okno.x * (dane.W / dane.okno.w), -dane.okno.y * (dane.H / dane.okno.h)];
  const skala = await page.evaluate(() => REKA.skala * GRAFIKI.doktor.skala);
  for (const { nazwa, rysowania } of klatki) {
    const pacjent = rysowania[4].plik;
    assert.ok(['pacjent.png', 'pacjent_relaks.png', 'pacjent_reakcja.png'].includes(pacjent), nazwa);
    assert.deepEqual(rysowania.map(r => r.plik),
      ['tlo.png', 'ramie_masaz.png', 'doktor_masaz.png', 'kozetka.png', pacjent, 'ramie_masaz.png'], nazwa);
    const ramie = rysowania[1], dlon = rysowania[5];
    assert.deepEqual(ramie.args, [-164 * skala, -204 * skala, 200 * skala, 234 * skala], nazwa);
    assert.deepEqual(dlon.args, [0, 0, 100, 120, -164 * skala, -204 * skala, 100 * skala, 120 * skala], nazwa);
    assert.deepEqual(dlon.macierz, ramie.macierz, `${nazwa}: wspólny obrót i bark`);
    for (const i of [0, 2, 3, 4]) {
      assert.ok(rysowania[i].macierz.every((v, j) => Math.abs(v - kamera[j]) < 1e-4),
        `${nazwa}: transformacja ręki nie zmienia innych warstw (oczekiwano kamery ${kamera}, jest ${rysowania[i].macierz})`);
    }
  }
  assert.ok(new Set(klatki.map(k => k.rysowania[1].macierz.join(','))).size > 4, 'ramię animuje się, nie pozostaje nieruchome');
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox'],
  });
  try {
    for (const [width, height] of [[320, 568], [360, 640], [390, 844], [430, 932], [768, 1024], [844, 390], [1376, 900]]) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: true });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url);
      await page.waitForFunction(() => Object.values(img).every(i => i.complete && i.naturalWidth > 0));
      async function inViewport(selector) {
        const box = await page.locator(selector).boundingBox();
        assert.ok(box && box.width > 0 && box.height > 0, selector);
        assert.ok(box.x >= -1 && box.y >= -1 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1,
          `${width}x${height}: ${selector} poza ekranem: ${JSON.stringify(box)}`);
        return box;
      }
      await inViewport('#ekran-start');
      await inViewport('#btn-start');
      await inViewport('#ekran-start .przycisk-dom');
      await page.locator('#btn-start').tap();
      const canvas = await inViewport('#gra');
      const kadr = await page.evaluate(() => ({ w: OKNO.w, h: OKNO.h }));
      assert.ok(Math.abs(canvas.width - canvas.height * kadr.w / kadr.h) < 2, 'proporcje widocznego kadru');
      for (const selector of ['#hud-lewo', '#hud-prawo', '#przyciski']) {
        const box = await inViewport(selector);
        assert.ok(box.y + box.height <= canvas.y + 1 || box.y >= canvas.y + canvas.height - 1, 'UI zasłania scenę');
      }
      await page.locator('#gra').tap();
      assert.equal(await page.locator('#punkty-wartosc').textContent(), '50');
      if (await page.locator('#btn-oklep').isVisible()) {
        const box = await inViewport('#btn-oklep');
        assert.ok(box.height >= 44);
        // Ustawiamy zegar gry tuz przed dotykiem (rytm 600 ms = PERFECT), zeby wolne
        // emulatory z opoznionym przetwarzaniem dotyku nie wypadly z okna oceny.
        await page.evaluate(() => { stan.ostatniHit = performance.now() - 600; });
        await page.locator('#btn-oklep').tap();
        assert.ok(Number(await page.locator('#punkty-wartosc').textContent()) > 50);
      }
      // Długi wynik i seria też nie mogą wypychać nagłówka na wąskim ekranie.
      await page.evaluate(() => { stan.punkty = 123456; stan.seria = 99; stan.mnoznik = 4; aktualizujHud(); });
      await inViewport('#pasek-wynikow');
      await inViewport('#combo-wrap');
      await page.evaluate(() => koniecGry());
      await inViewport('#btn-ponownie');
      await inViewport('#ekran-koniec .przycisk-dom');
      await page.locator('#btn-ponownie').tap();
      assert.equal(await page.locator('#punkty-wartosc').textContent(), '0');
      assert.equal(await page.locator('#czas-wartosc').textContent(), '60');
      await sprawdzWarstwy(page);
      // Symulacja obrotu urządzenia bez przeładowania strony.
      await page.setViewportSize({ width: height, height: width });
      await page.waitForFunction(() => {
        const r = document.getElementById('gra').getBoundingClientRect();
        return r.width > 0 && r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
      });
      assert.equal(await page.evaluate(() => document.body.scrollWidth > innerWidth), false);
      await sprawdzWarstwy(page);
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`✅ ${width}×${height}: start, pełna scena, dotyk, HUD, koniec, restart, obrót, warstwy w spoczynku i animacji`);
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
