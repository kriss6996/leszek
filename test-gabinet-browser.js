// Uruchom serwer statyczny, potem npm run test:browser (patrz images/README.md).
'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const url = process.env.GABINET_URL || 'http://127.0.0.1:8000/gabinet.html';

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
      assert.ok(Math.abs(canvas.width - canvas.height * 1376 / 768) < 2, 'proporcje całego gabinetu');
      for (const selector of ['#hud-lewo', '#hud-prawo', '#przyciski']) {
        const box = await inViewport(selector);
        assert.ok(box.y + box.height <= canvas.y + 1 || box.y >= canvas.y + canvas.height - 1, 'UI zasłania scenę');
      }
      await page.locator('#gra').tap();
      assert.equal(await page.locator('#punkty-wartosc').textContent(), '50');
      if (await page.locator('#btn-oklep').isVisible()) {
        const box = await inViewport('#btn-oklep');
        assert.ok(box.height >= 44);
        await page.waitForTimeout(600);
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
      // Symulacja obrotu urządzenia bez przeładowania strony.
      await page.setViewportSize({ width: height, height: width });
      await page.waitForFunction(() => {
        const r = document.getElementById('gra').getBoundingClientRect();
        return r.width > 0 && r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
      });
      assert.equal(await page.evaluate(() => document.body.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`✅ ${width}×${height}: start, pełna scena, dotyk, HUD, koniec, restart, obrót`);
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
