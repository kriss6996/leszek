# Jak wgrać to do repo `leszek` (ręcznie, przez przeglądarkę)

Ta paczka zawiera **cały projekt gry** gotowy do przeniesienia do repozytorium `leszek`,
tak aby wszystko było w jednym miejscu i publikowało się automatycznie.

## Co jest w środku

```
gra.html                     ← GOTOWA gra (1 plik, wszystko w środku) — podmienia stary gra.html
gra-zrodlo/                  ← kod źródłowy React/Vite (do dalszej edycji gry)
.github/workflows/build-gra.yml  ← automat: po zmianie kodu przebuduje gra.html
```

## ⚠️ Najważniejsze: NIE nadpisz swojej strony

Twoje repo `leszek` ma już:
- `index.html` — strona TwójOtwór.pl (NIE ruszamy!)
- plik(i) wideo (NIE ruszamy!)
- `gra.html` — stara gra (TĘ podmieniamy)

Ta paczka **celowo NIE zawiera** `index.html` w katalogu głównym, żeby przez pomyłkę
nie skasować Twojej strony. Kod źródłowy gry siedzi w podfolderze `gra-zrodlo/`.

## Kroki (drag & drop na GitHub.com)

1. Wejdź na `https://github.com/kriss6996/leszek`
2. Kliknij **Add file → Upload files**.
3. Przeciągnij z tej paczki:
   - plik **`gra.html`** (podmieni starą grę),
   - cały folder **`gra-zrodlo/`**,
   - folder **`.github/`** (workflow automatycznej przebudowy).
4. Na dole wpisz opis commita, np. „Nowa gra: 5 poziomów + sterowanie dotykowe”, i kliknij **Commit changes**.
5. Gotowe — po chwili `https://kriss6996.github.io/leszek/gra.html` pokaże nową grę.

## (Opcjonalnie) Włącz automatyczną przebudowę

Workflow `build-gra.yml` sam odświeży `gra.html` za każdym razem, gdy zmienisz coś
w `gra-zrodlo/`. Żeby działał, w repo `leszek`:
- Settings → Actions → General → Workflow permissions → zaznacz **Read and write permissions** → Save.

Od tej pory edytujesz tylko kod w `gra-zrodlo/`, a `gra.html` buduje się sam.

## Edycja gry lokalnie (dla programisty)

```bash
cd gra-zrodlo
npm install
npm run dev        # podgląd na żywo
npm run build:gra  # zbuduje samodzielny gra.html
```
