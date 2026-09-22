# 🖼️ Grafiki gry — katalog `images/`

Gra **`gra.html`** (Dr. Leszek PAC-MAN 69!) przy starcie próbuje wczytać grafiki postaci
z tego katalogu — z plików leżących **obok gra.html**. Dzięki temu możesz podmienić wygląd
gry **bez przebudowywania czegokolwiek i bez programisty**: wystarczy wgrać nowy plik
przez GitHuba.

## Jak podmienić grafikę (przez GitHub, „Add file → Upload files”)

1. Wejdź na repozytorium: <https://github.com/kriss6996/leszek> i otwórz katalog **`images/`**.
2. Kliknij **Add file → Upload files**.
3. Przeciągnij swój plik **o dokładnie tej samej nazwie**, jak plik który chcesz podmienić
   (np. `pac_right.png`). GitHub zapyta o nadpisanie istniejącego pliku — potwierdź.
   (Jeśli pliku jeszcze nie ma, np. `pac_left.png`, po prostu go wgraj — gra zacznie go używać.)
4. Na dole wpisz opis commita (np. „nowy wygląd duszka”) i kliknij **Commit changes**.
5. Odśwież stronę gry (**F5**) — to wszystko. **Nie trzeba czyścić cache przeglądarki**:
   gra dokleja do każdego pliku znacznik czasu (`?v=…`), więc zawsze pobiera świeżą wersję.

> Strona publikuje się automatycznie z gałęzi `main` (GitHub Pages), więc zmiana jest
> widoczna pod <https://kriss6996.github.io/leszek/gra.html> po chwili od commita.

## Dokładne nazwy plików

| Plik             | Postać                          | Uwagi |
|------------------|---------------------------------|-------|
| `pac_right.png`  | gracz idący **w prawo** ▶       | główna grafika gracza |
| `pac_left.png`   | gracz idący **w lewo** ◀        | **opcjonalny** — patrz niżej |
| `ghost1.png`     | duch 1 (domyślnie czerwony)     | |
| `ghost2.png`     | duch 2 (domyślnie różowy)       | |
| `ghost3.png`     | duch 3 (domyślnie błękitny)     | |
| `ghost4.png`     | duch 4 (domyślnie pomarańczowy) | |
| `tlo.png`         | **tło gry** — własne zdjęcie za labiryntem | **opcjonalny** — patrz niżej |

## 🌄 Tło gry (`tlo.png`) — własne zdjęcie za labiryntem

Nowa funkcja: planszę można położyć na **własnym zdjęciu**.

1. Wgraj plik **`images/tlo.png`** („Add file → Upload files”, jak wyżej) — gra wczyta go
   automatycznie przy starcie, u wszystkich graczy.
2. Albo w samej grze kliknij **🖼️ → „Tło gry 🌄 (własne zdjęcie)” → „wybierz”** — zdjęcie
   zapisze się w Twojej przeglądarce (localStorage) i będzie widoczne tylko u Ciebie.
   Zdjęcie jest automatycznie zmniejszane do maks. **1024 px** (żeby nie zapchać pamięci
   przeglądarki) i lekko **przyciemniane (45%)** w grze, dzięki czemu białe korytarze
   i białe liczby „69” zostają czytelne na każdym tle.

**Kolejność ważności tła jest taka sama jak przy postaciach:**
1. zdjęcie wgrane w grze 🖼️ (Twoja przeglądarka), 2. `images/tlo.png`, 3. czarne tło domyślne.

> Wskazówka: najlepiej sprawdzają się zdjęcia niezbyt jasne i niezbyt „zatłoczone” —
> wtedy labirynt i „69” odcinają się od tła najmocniej.

**Brak pliku = nic się nie psuje.** Jeśli któregoś pliku nie ma (błąd 404), gra po cichu
użyje dotychczasowej grafiki — bez błędów i bez pustych kwadratów. W szczególności:
gdy jest `pac_right.png`, a **nie ma** `pac_left.png`, gracz w lewo jest automatycznym
**lustrzanym odbiciem** grafiki „w prawo”. Dlatego najczęściej wystarczy podmienić
sam `pac_right.png`. (Przeglądarka może wtedy zapisać w konsoli sieciowej jeden wpis
„404 pac_left.png” — to normalne i nie wpływa na grę.)

## Zalecany format grafik

- **Kwadratowy PNG**, np. **128×128** (maks. 256×256 — więcej i tak nie będzie widoczne,
  a spowolni ładowanie strony).
- **Przezroczyste tło mile widziane** — gra i tak wycina postać w kółko, więc białe rogi
  nie są potrzebne.
- Postać gracza jest **statyczna** (bez animacji pyszczka) — wystarczy jedno zdjęcie na kierunek.
- Pliki startowe w tym katalogu: `pac_right.png` to pomniejszona kopia oficjalnej grafiki
  Dr. Leszka (`leszek-do-wgrania/gra-zrodlo/public/images/dr_leszek.png`), a `ghost1–4.png`
  to wygenerowane klasyczne duszki w kolorach gry.

## Kolejność ważności grafik (priorytet)

1. **Obrazki wgrane w grze ikoną 🖼️** — zapisane w Twojej przeglądarce (localStorage),
   działają tylko u Ciebie i wygrywają ze wszystkim.
2. **Pliki z tego katalogu (`images/`)** — widoczne u wszystkich graczy.
3. **Grafika domyślna wbudowana w `gra.html`** — gdy niczego innego nie ma.

W panelu 🖼️ w grze widać przy każdej postaci, skąd pochodzi aktualna grafika
(„Twoje”, „plik images/…” albo „grafika domyślna”), a przycisk **„⟳ sprawdź images/”**
wczytuje pliki ponownie bez odświeżania strony.

## Test lokalny (bez GitHuba)

W katalogu głównym repozytorium uruchom prosty serwer i otwórz grę:

```bash
python3 -m http.server 8000
# potem w przeglądarce: http://localhost:8000/gra.html
```

Podmień plik w `images/` i odśwież stronę (F5) — grafika zmieni się od razu.

---

# 🖐️ Grafiki gry „Gabinet Dr. Leszka” — katalog `images/gabinet/`

Druga gra, **`gabinet.html`** (Gabinet Dr. Leszka — Mistrz Oklepywania), korzysta
z osobnego katalogu **`images/gabinet/`**. Zasada podmiany jest identyczna jak wyżej:
wgraj plik o **tej samej nazwie** („Add file → Upload files”) i odśwież grę (F5).

| Plik                       | Co przedstawia | Uwagi |
|----------------------------|----------------|-------|
| `tlo.png`                  | statyczny widok gabinetu (ściana, okno, szafa, plakat) | tło 1376×768 |
| `kozetka.png`              | pusta kozetka/badawcza | rysowana pod pacjentem |
| `pacjent.png`              | pacjent leżący na kozetce — mina spokojna | pełny kadr ciała |
| `pacjent_reakcja.png`      | pacjent — mina „zaskoczony” (po oklepaniu) | **ten sam kadr co `pacjent.png`**, inna tylko mina |
| `pacjent_relaks.png`       | pacjent — mina „błogi relaks” | **ten sam kadr co `pacjent.png`**, inna tylko mina |
| `doktor_masaz.png`         | ciało z jedną ręką w spoczynku | aktualna warstwa ciała |
| `ramie_masaz.png`          | samo animowane ramię | obracane wokół środka czerwonego mankietu |

### Ważne przy podmianie

- **Miny pacjenta** (`pacjent*.png`) muszą mieć **identyczny kadr i pozycję głowy** —
  gra rysuje jedną z nich w tym samym miejscu (różni się tylko twarz).
- **`ramie_masaz.png`** jest obracana wokół **środka czerwonego mankietu** — to punkt
  `REKA.pivot` w `gabinet.html`, a `REKA.bark` mówi, w które miejsce tułowia
  (`doktor_masaz.png`) ten mankiet jest wpięty. Jeśli wgrasz rękę w innej pozycji,
  dostosuj `pivot`/`dlon` oraz kąty (`katSpoczynek`, `katUniesienie`, `katDocisk`).
  Aktualne wartości (zmierzone na PNG):

  | Klucz | Wartość | Co znaczy |
  |-------|---------|-----------|
  | `pivot` | `x:175, y:210` | środek czerwonego mankietu (mankiet zajmuje x 155..194, y 192..231) |
  | `bark` | `x:72, y:152` | koniec czerwonego rękawa koszulki w `doktor_masaz.png` |
  | `dlon` | `x:36, y:44` | środek dłoni (nie nadgarstek) — trafiana część pleców |
  | `skala` | `1.0` | drobna dłoń; ramię sięga pleców dokładnie z barku |
  | `katSpoczynek / katUniesienie / katDocisk` | `142 / 156 / 137` | spoczynek, zamach (dłoń wyżej), uderzenie (dłoń na plecach, ok. x 607, y 429) |
- Pozycje wszystkich warstw (x, y, skala) są w sekcji `GRAFIKI` na początku
  skryptu w `gabinet.html` — łatwo przesunąć postacie po podmianie grafik.

### Test lokalny

```bash
python3 -m http.server 8000
# potem w przeglądarce: http://localhost:8000/gabinet.html
```

### Poprawiona scena i układ telefonu

Gra używa dwóch warstw doktora: `doktor_masaz.png` (ciało z drugą ręką w
spoczynku) i `ramie_masaz.png` (samo animowane ramię, bez fragmentu tułowia).
Po zmianie kształtu którejkolwiek z nich sprawdź punkty `REKA.pivot`, `REKA.bark`
i `REKA.dlon` w `gabinet.html` — na nich trzyma się cała animacja oklepywania.

Kolejność rysowania: **tło → całe ramię → tułów doktora → kozetka i pacjent →
dłoń z mankietem → efekty**. Przednia warstwa to wyłącznie wycinek
`ramie_masaz.png` o współrzędnych **x=0, y=0, szerokość=100, wysokość=120** (dłoń
z nadgarstkiem, bez nasady rękawa), z tym samym pivotem, obrotem i skalą co całe
ramię. Nasada rękawa pozostaje za tułowiem, więc obrót w barku jest zawsze zasłonięty.

**Punkty i czas** stoją **na górze, w obrębie szerokości kozetki** (nie na całą
szerokość okna): `dopasujPasek()` mierzy rozpiętość `kozetka.png` w kadrze
(`zakresKozetki()`), ustawia szerokość paska na dokładnie tyle i przesuwa go o
różnicę środków, więc pasek zawsze trzyma się kozetki — także po podmianie grafiki,
zmianie rozmiaru okna i obrocie telefonu. Fonty skalują się przez `--pasek-szer`, a
przy bardzo wąskim pasku znikają najpierw tytuł (`wasce`), potem etykiety
(`bardzo-wasce`). Okrzyki pacjenta („Aaaaach!”) i oceny („PERFECT! x2”) zostają tam,
gdzie uderza dłoń — przy dłoni.

Cały gabinet zachowuje proporcje **1376×768**, bez przycinania i rozciągania.
Punktacja, czas i przyciski znajdują się poza płótnem. W pionie dostępny jest duży
przycisk **Oklep plecy**; można również dotykać bezpośrednio gabinetu.
Układ uwzględnia `100dvh`, bezpieczne obszary telefonu i zmianę orientacji.
Wolne miejsce wokół poziomej sceny jest celowe — dzięki temu w pionie widać cały pokój.
