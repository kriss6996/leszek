// Test logiki gabinet.html bez przegladarki: atrapy DOM/Canvas + symulacja petli.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const html = fs.readFileSync(path.join(__dirname, "gabinet.html"), "utf-8");
const kod = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// ---------- atrapy ----------
function atrapaElement() {
  const klasy = new Set();
  return {
    textContent: "", style: {},
    getContext: () => ctxStub,
    classList: {
      add: (c) => klasy.add(c),
      remove: (c) => klasy.delete(c),
      toggle: (c, f) => { (f === undefined ? !klasy.has(c) : f) ? klasy.add(c) : klasy.delete(c); },
      zawiera: (c) => klasy.has(c),
    },
    addEventListener(typ, fn) { (this._fn ||= {})[typ] = fn; },
  };
}

const elementy = {};
const storage = {};
const ctxCalls = [];
const ctxStub = new Proxy({}, {
  get(t, prop) {
    if (prop === "measureText") return () => ({ width: 50 });
    if (prop === "canvas") return {};
    return (...args) => ctxCalls.push([prop, args]);
  },
  set() { return true; },
});

const sandbox = {
  console,
  performance: { now: () => aktualnyCzas },
  requestAnimationFrame: (fn) => { rafFn = fn; },
  cancelAnimationFrame: () => {},
  localStorage: {
    getItem: (k) => (k in storage ? storage[k] : null),
    setItem: (k, v) => { storage[k] = String(v); },
  },
  document: {
    getElementById: (id) => (elementy[id] ||= atrapaElement()),
    createElement: () => ({}),
  },
  window: {},
  Image: class {
    constructor() { this.width = 100; this.height = 100; this.complete = false; }
    set src(v) { this._src = v; this.complete = true; if (this.onload) this.onload(); }
  },
  AudioContext: class {
    constructor() { this.currentTime = 0; this.destination = {}; }
    resume() {}
    createBuffer() { return { getChannelData: () => new Float32Array(10) }; }
    createBufferSource() { return { connect() {}, start() {}, buffer: null }; }
    createBiquadFilter() { return { connect() {}, type: "", frequency: {} }; }
    createGain() { return { connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } }; }
    createOscillator() { return { connect() {}, start() {}, stop() {}, frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } }; }
  },
};
sandbox.window = sandbox;
sandbox.addEventListener = () => {};

let rafFn = null;
let aktualnyCzas = 0;
vm.createContext(sandbox);
vm.runInContext(kod, sandbox, { filename: "gabinet.js" });

const gra = {
  _click: null,
};
// canvas ("gra") jest pobierany z atrapy dokumentu: jego addEventListener
// zapisuje sie w elementy["gra"]._fn.pointerdown
function klik() { elementy["gra"]._fn.pointerdown({ preventDefault() {} }); }

console.log("✅ skrypt wykonany bez wyjatkow, requestAnimationFrame podpiety:", typeof rafFn === "function");

function klatki(n, krokMs) {
  for (let i = 0; i < n; i++) { aktualnyCzas += krokMs; rafFn(aktualnyCzas); }
}
const el = (id) => sandbox.document.getElementById(id);

// faza start (stan poczatkowy jak w HTML):
el("czas-wartosc").textContent = "60";
if (el("punkty-wartosc").textContent !== "") el("punkty-wartosc").textContent = "0";
// start gry przez przycisk
elementy["btn-start"]._fn.click();

const pozycje = [];
pozycje.push(["po starcie", el("punkty-wartosc").textContent, el("czas-wartosc").textContent]);

// symulacja rytmicznej gry: 50 uderzen DOKLADNIE co 600 ms (PERFECT window 450-800)
// (klik na poczatku iteracji, potem 3 klatki x 200 ms = 600 ms naprzod)
klatki(1, 100);
for (let i = 0; i < 50; i++) {
  klik();
  klatki(3, 200);
}
pozycje.push(["po 50 hitach x600ms", el("punkty-wartosc").textContent, el("czas-wartosc").textContent]);
console.log("   stan po fazach:", JSON.stringify(pozycje));

// spam: 1 poprawne uderzenie + 5 po 20 ms — te 5 musi byc ignorowane
const przed = +el("punkty-wartosc").textContent;
klik();
const poJednym = +el("punkty-wartosc").textContent;
if (poJednym === przed) throw new Error("poprawne uderzenie nie policzone!");
for (let i = 0; i < 5; i++) { aktualnyCzas += 20; klik(); }
const poSpamie = +el("punkty-wartosc").textContent;
if (poSpamie !== poJednym) throw new Error("anty-spam nie dziala: +" + (poSpamie - poJednym));
console.log("✅ anty-spam OK (5 spam-klikow zignorowanych, uderzenie co ~600ms liczone)");

// dojechac do konca czasu
for (let i = 0; i < 400 && String(el("czas-wartosc").textContent) !== "0"; i++) klatki(10, 200);
if (String(el("czas-wartosc").textContent) !== "0") throw new Error("czas nie wybil sie");
const koniecPunkty = +el("wynik-koniec").textContent;
if (koniecPunkty !== +el("punkty-wartosc").textContent) throw new Error("wynik koncowy niezgodny");
console.log("✅ koniec gry OK, wynik:", koniecPunkty, "| rekord:", storage["gabinet_rekord"]);

// ponowna gra
elementy["btn-ponownie"]._fn.click();
if (String(el("punkty-wartosc").textContent) !== "0") throw new Error("restart nie wyzerowal punktow");
klatki(5, 100);
console.log("✅ restart OK");

// rysowanie: policz wywolania drawImage — musi byc duzo, bez wyjatkow
const razyDraw = ctxCalls.filter(([p]) => p === "drawImage").length;
const razyRot = ctxCalls.filter(([p]) => p === "rotate").length;
if (razyDraw < 100 || razyRot < 100) throw new Error("za malo rysowania: " + razyDraw + "/" + razyRot);
console.log("✅ render OK: drawImage x" + razyDraw + ", rotate x" + razyRot);

console.log("\nWSZYSTKIE TESTY LOGIKI ZALICZONE 🎉");
