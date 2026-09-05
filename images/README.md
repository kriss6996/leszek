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
