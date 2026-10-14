# 🩺 Jak zrobić symulator gabinetu w Godot — na podstawie gry „Gabinet Dr. Leszka”

Ten poradnik pokazuje, jak przenieść grę **`gabinet.html`** (Canvas + JavaScript) do silnika **Godot 4.7** i jak
rozbudować ją w stronę prawdziwego **symulatora gabinetu lekarskiego**.

W repozytorium jest gotowy projekt do otwarcia: **`godot/gabinet/`**. Możesz go najpierw uruchomić, a potem
czytać, jak jest zbudowany.

> ⚠️ Projekt powstał bez uruchamiania w edytorze Godot (w środowisku, w którym go tworzono, nie dało się pobrać
> silnika). Składnię GDScript sprawdzono parserem `gdtoolkit` i jest poprawna, ale **pierwsze uruchomienie zrób
> u siebie** i daj znać, jeśli coś wyskoczy w panelu *Debugger* lub *Output*.

---

## 1. Co będziesz potrzebować

| Co | Gdzie | Uwagi |
|----|-------|-------|
| Godot **4.7** (standard, nie .NET) | <https://godotengine.org/download> | Wersja „Standard” (GDScript). Nie trzeba instalować. |
| To repozytorium | `godot/gabinet/` | Zawiera grafiki i muzykę z `images/gabinet/` oraz `Leszek.mp3`. |

**Otwarcie projektu:** uruchom Godota → **Import** → wskaż plik `godot/gabinet/project.godot` → **Import & Edit**.
Przy pierwszym otwarciu Godot sam zaimportuje PNG i MP3 (tworzy pliki `*.import` i katalog `.godot/`, który jest
ignorowany przez Git). Potem naciśnij **F5** (Run Project).

---

## 2. Jak działa oryginał — mapowanie na Godota

Cała gra `gabinet.html` to ok. 1000 linii JS. Każdy fragment ma swój odpowiednik w Godot:

| W `gabinet.html` (JS / Canvas / DOM) | W Godot 4.7 |
|---|---|
| `requestAnimationFrame(klatka)` | `func _process(delta)` |
| `ctx.drawImage(...)` + kolejność rysowania | `Sprite2D` + `z_index` |
| `ctx.translate` / `ctx.rotate` (ramię) | `Node2D` z `position` i `rotation` |
| `performance.now()` | `Time.get_ticks_msec()` |
| `localStorage` (rekord, dźwięk) | `ConfigFile` w `user://gabinet.cfg` |
| WebAudio (klaps, „ding”) | `AudioStreamWAV` generowany w kodzie + `AudioStreamPlayer` |
| `<audio>` z `Leszek.mp3` | `AudioStreamPlayer` + `AudioStreamMP3` (z `loop = true`) |
| Nakładki HTML/CSS (HUD, ekrany, PIN) | `CanvasLayer` + `Control` (`Label`, `Button`, `PanelContainer`, `LineEdit`) |
| `document.getElementById(...)` | Zmienne przypisane do węzłów w `_ready()` |
| `window.addEventListener('keydown', ...)` | `func _unhandled_input(event)` |
| `OCENY`, `GRAFIKI`, `REKA` (stałe) | `const` na początku `main.gd` |

Dzięki temu logika (punkty, seria, mnożnik, oceny, animacja ramienia) przenosi się prawie 1:1.

---

## 3. Struktura projektu

```
godot/
├── PORADNIK.md                 ← ten plik
└── gabinet/
    ├── project.godot           ← ustawienia projektu (rozdzielczość 1024×768, renderer GL Compatibility)
    ├── .gitignore              ← ignoruje .godot/ (cache edytora)
    ├── scenes/
    │   └── main.tscn           ← jedna scena: korzeń Node2D + skrypt
    ├── scripts/
    │   └── main.gd             ← cała logika gry
    └── assets/
        ├── gfx/                ← PNG (kopie z images/gabinet/)
        └── audio/Leszek.mp3    ← muzyka
```

**Dlaczego scena jest zbudowana w kodzie?** Żeby poradnik dało się przeczytać w jednym pliku i żeby nie trzeba było
ręcznie układać dziesiątek węzłów w edytorze. W prawdziwym projekcie warto z czasem przenieść część węzłów do
edytora (np. HUD jako osobna scena `hud.tscn`) — to jest pierwszy krok do rozbudowy opisany w punkcie 9.

---

## 4. Krok po kroku: jak powstał `main.gd`

### Krok 1 — stałe z oryginału

Na początku skryptu są wszystkie liczby z `gabinet.html`: pozycje postaci, skale, geometria ramienia i oceny.
Dzięki temu, gdy zmienisz np. czas gry, robisz to w jednym miejscu:

```gdscript
const CZAS_GRY_S := 60.0
const SPAM_OKNO_MS := 130.0
const OCENY := [
	{"min": 0.45, "max": 0.80, "nazwa": "PERFECT!", "punkty": 150, "kolor": "#ffd23f", ...},
	...
]
```

### Krok 2 — warstwy sceny i kolejność rysowania

W canvasie kolejność rysowania wynika z kolejności wywołań `drawImage`. W Godot ustawiasz ją przez `z_index`:

| Warstwa | `z_index` | Dlaczego |
|---|---|---|
| tło (`tlo.png`) | 0 | najniżej |
| całe ramię | 1 | za tułowiem doktora — nasada ramienia jest zasłonięta |
| tułów doktora | 2 | |
| kozetka | 3 | |
| pacjent | 4 | |
| sama dłoń z mankietem | 5 | nad pacjentem, żeby było widać uderzenie |
| efekty (dymki, napisy, cząsteczki) | 10 | zawsze na wierzchu |

Sprajty mają `centered = false`, dzięki czemu `position` to lewy górny róg — tak jak `drawImage(x, y)` w canvasie.

### Krok 3 — animacja ramienia (najtrudniejsza część)

Ramię to osobny sprajt obracany wokół **środka czerwonego mankietu** (`REKA_PIVOT`). W Godot robi to węzeł `Node2D`:

```gdscript
func _ustaw_reke(kat_stopnie: float) -> void:
	var bark := POZ_DOKTOR + REKA_BARK * SKALA_DOKTOR   # gniazdo w barku
	var obrot := deg_to_rad(kat_stopnie) - phi0         # phi0 = kąt wektora bark→dłoń w sprajcie
	ramie_wezel.position = bark
	ramie_wezel.rotation = obrot
```

Sprajt jest przesunięty o `-REKA_PIVOT * skala`, więc jego punkt obrotu ląduje w `(0,0)` węzła. Obrót „w barku”
działa tak samo jak `ctx.translate(bark); ctx.rotate(...)` w oryginale.

**Krzywa ruchu** (`kat_ramienia`) to te same 4 fazy co w JS: zamach → uderzenie → odbicie → spoczynek.
Gdy nie ma uderzenia, ramię kołysze się sinusoidą.

**Punkt uderzenia** (`pozycja_dloni`) liczy się z tej samej geometrii — dlatego napisy i cząsteczki zawsze
pojawiają się dokładnie tam, gdzie dłoń dotyka pleców.

### Krok 4 — rytm i punktacja

To serce gry. Logika z `uderz()` w oryginale:

1. **Anty-spam:** uderzenie krótsze niż 130 ms od poprzedniego jest ignorowane.
2. **Ocena:** czas `dt` od poprzedniego uderzenia wpada w jeden z przedziałów `OCENY`
   (`PERFECT!` / `Bravo!` / `OK` / `Rytm zgubiony!`).
3. **Seria i mnożnik:** każde udane uderzenie zwiększa serię; mnożnik to `min(4, 1 + floor(seria/4) * 0.5)`.
4. **Zgubiony rytm** (`punkty == 0`) zeruje serię.

```gdscript
func _ocena_dla(dt: float) -> Dictionary:
	for o in OCENY:
		if dt >= o["min"] and dt < o["max"]:
			return o
	return OCENY[OCENY.size() - 1]
```

Czas liczony jest w milisekundach z `Time.get_ticks_msec()`, więc działa tak samo na PC, w przeglądarce i na telefonie.

### Krok 5 — pacjent: sprężyna i mina

Pacjent podskakuje po każdym uderzeniu. To prosta sprężyna (tłumiony oscylator), jak w `krokPacjenta()`:

```gdscript
pacjent_predkosc += (-k * pacjent_bob - c * pacjent_predkosc) * dt
pacjent_bob += pacjent_predkosc * dt
```

Mina zmienia się w zależności od stanu: zaskoczenie tuż po uderzeniu (`reakcja`), błogi relaks (`relaks`)
albo spokój (`spokoj`). W Godot to po prostu podmiana `texture` na `Sprite2D`.

### Krok 6 — HUD i ekrany

- **HUD** (punkty, seria, czas, przyciski) to `Control`-y w `CanvasLayer`. `CanvasLayer` rysuje się w przestrzeni
  ekranu, więc nie przesuwa się razem z kamerą.
- **Ekrany** (start, koniec, PIN) to `PanelContainer` z `VBoxContainer` w środku. Budowa jest w `_nowy_ekran()`.
- **Skalowanie:** w `project.godot` ustawione jest `stretch/mode = "canvas_items"` i `aspect = "keep"`,
  czyli cała scena 1024×768 skaluje się zachowując proporcje — to odpowiednik `dopasuj()` z oryginału.

### Krok 7 — dźwięk

- **Muzyka:** `Leszek.mp3` jest importowany jako `AudioStreamMP3`. Ustawiasz `loop = true` w kodzie.
- **Klaps i „ding”:** oryginał generuje dźwięk w WebAudio, więc tutaj robimy to samo — tworzymy bufor PCM
  (`_zbuduj_szum`, `_zbuduj_ton`) i pakujemy go w `AudioStreamWAV`. Bez dodatkowych plików.
- **Odtwarzanie:** każdy klaps to krótki `AudioStreamPlayer`, który sam się usuwa po `finished`.

### Krok 8 — PIN i zapis

- **Bramka PIN** (`6969`, jak w oryginale) to osobny `CanvasLayer` z `LineEdit` (pole ukryte jako `secret`).
  Dopóki PIN nie przejdzie, `swiat` i `hud` są `visible = false`.
  ⚠️ To **blokada wizualna, nie zabezpieczenie** — kod i PIN są widoczne dla każdego, kto otworzy eksport.
- **Rekord i ustawienie dźwięku** zapisują się w `user://gabinet.cfg` (`ConfigFile`).
  Na Windows jest to `%APPDATA%\Godot\app_userdata\Gabinet Dr. Leszka\`.

---

## 5. Sterowanie

| Akcja | Komputer | Telefon / tablet |
|---|---|---|
| Oklep (uderzenie) | spacja / Enter / klik w gabinet | dotyk gabinetu / przycisk **Oklep!** |
| Start / od nowa | przycisk *Start* / *Od nowa* | to samo |
| Wyciszenie | przycisk *Muzyka* | to samo |

Przyciski mają `focus_mode = FOCUS_NONE`, żeby spacja nie „klikała” przycisku zamiast uderzać w pacjenta.

---

## 6. Uruchomienie i test

1. W Godot naciśnij **F5** (lub ▶ w prawym górnym rogu).
2. Wpisz PIN **6969**.
3. Naciśnij **Start** i uderzaj w równym rytmie (ok. co 0,6 s — to „PERFECT”).
4. Sprawdź: punkty rosną, seria i mnożnik się pokazują, pacjent podskakuje, ramię się rusza, muzyka gra.

Jeśli czegoś brakuje, najczęściej przyczyną jest brak zaimportowanych zasobów. Otwórz projekt w edytorze — Godot
zaimportuje pliki z `assets/`.

---

## 7. Eksport do przeglądarki (żeby grało na stronie)

1. **Editor → Manage Export Templates** → pobierz szablony dla wersji 4.7 (potrzebne do eksportu).
2. **Project → Export… → Add… → Web**. Ustaw *Export Path* np. `build/web/index.html`.
3. Kliknij **Export Project**.
4. Otrzymasz `index.html`, `.wasm`, `.pck` i kilka plików JS. Całą zawartość folderu wgrywasz na hosting statyczny
   (np. GitHub Pages).

> Przy eksporcie do przeglądarki dźwięk wymaga kliknięcia użytkownika — dlatego muzyka startuje dopiero po
> przycisku *Start*, tak jak w oryginale.

**Katalogu `build/` nie commituj do repozytorium** — dodaj go do `.gitignore`, jeśli chcesz eksportować lokalnie.

---

## 8. Jak zmienić grafikę

Grafiki leżą w `godot/gabinet/assets/gfx/`. Zasada jest ta sama co w `images/README.md`:
**podmień plik o tej samej nazwie** i odśwież projekt w Godocie (Godot wykryje zmianę). Pamiętaj tylko, że
pozycje i skale są zapisane w stałych na początku `main.gd`, więc nowa grafika o innych wymiarach może wymagać
przesunięcia postaci.

---

## 9. Od gry do symulatora gabinetu — plan rozbudowy

Gra „oklepywanie” to dobry pierwszy szkielet. Symulator gabinetu to kolejne warstwy, które można dodawać
po kolei. Każdy punkt to osobny krok, który da się przetestować osobno:

1. **Scena gabinetu jako osobny plik.** Przenieś HUD i warstwy do `hud.tscn` i `gabinet.tscn` (edytor, nie kod).
2. **Pacjent jako zasób.** Utwórz `class_name Pacjent extends Resource` z polami: imię, dolegliwość, stan, mina.
   Zapisuj instancje jako `.tres` — łatwo dodawać nowych pacjentów bez zmian w kodzie.
3. **Kolejka pacjentów.** `Array` pacjentów, timer między wizytami, zakończenie dnia po N pacjentach.
4. **Różne zabiegi.** Każdy zabieg (oklepywanie, osłuchiwanie, pomiar ciśnienia) to osobna scena-mini-gra
   z tym samym interfejsem: `start()`, `wynik() -> int`, sygnał `zakonczony`.
5. **Diagnoza i decyzje.** Menu z wyborem: badanie, leczenie, skierowanie. Punkty za trafną diagnozę.
6. **Ekonomia.** Pieniądze za wizyty, wydatki na sprzęt (np. nowa kozetka zwiększa mnożnik).
7. **Zapis postępu.** `FileAccess` + JSON albo `ResourceSaver` — zapis dnia i pieniędzy.
8. **Dźwięk i muzyka.** Osobny `AudioBus` na muzykę i efekty; regulacja głośności w ustawieniach.

Jeśli chcesz, mogę w następnym kroku zrobić punkt 2 i 3 (zasób `Pacjent` i kolejkę wizyt) — to już da
prawdziwy „symulator gabinetu”, a nie tylko jedną grę.

---

## 10. Najczęstsze problemy

| Objaw | Co zrobić |
|---|---|
| Różowe / szare kwadraty zamiast grafik | Sprawdź, czy pliki są w `assets/gfx/` i czy Godot je zaimportował (panel *FileSystem*). |
| Brak dźwięku | Sprawdź przycisk *Muzyka* (może być wyciszona) i czy przeglądarka pozwoliła na audio po kliknięciu. |
| Polskie znaki wyglądają źle | Domyślna czcionka Godota obsługuje polskie litery; jeśli nie, dodaj własną czcionkę (np. Noto Sans) w `Theme`. |
| `Identifier "..." not declared` | Najpewniej literówka w nazwie węzła; sprawdź `_zbuduj_*` w `main.gd`. |
| Ramię „odkleja się” od tułowia | Zmieniłeś grafikę — popraw `REKA_PIVOT`, `REKA_BARK` i `REKA_DLON` (zobacz `images/README.md`). |
