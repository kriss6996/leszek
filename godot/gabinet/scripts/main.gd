extends Node2D
## Gabinet Dr. Leszka — port gabinet.html na Godot 4.7.
## Cała scena (tło, pacjent, doktor, ramię, HUD, ekrany) jest budowana w kodzie,
## więc main.tscn to tylko korzeń z tym skryptem. Liczby i nazwy zostały
## przeniesione 1:1 z gabinet.html, żeby obie wersje grały tak samo.

enum Faza { START, GRA, KONIEC }

const PIN_GABINETU := "6969"
const CZAS_GRY_S := 60.0
const SPAM_OKNO_MS := 130.0       # uderzenia krótsze niż to są ignorowane
const MINA_KALM_MS := 900.0       # tyle ms po uderzeniu pacjent ma minę "zaskoczenie"
const RAMIE_AKTYWNE_MS := 450.0   # tyle ms po uderzeniu liczy się zamach ramienia
const PLIK_ZAPISU := "user://gabinet.cfg"
const KATALOG := "res://assets/gfx/"
const MUZYKA := "res://assets/audio/Leszek.mp3"

# Pozycje warstw (odpowiednik sekcji GRAFIKI w gabinet.html)
const POZ_KOZETKA := Vector2(330, 450)
const SKALA_KOZETKA := 0.58
const POZ_PACJENT := Vector2(350, 337)
const SKALA_PACJENT := 0.48
const POZ_DOKTOR := Vector2(640, 213)
const SKALA_DOKTOR := 0.85

# Geometria ramienia (REKA w gabinet.html)
const REKA_PIVOT := Vector2(175, 210)   # środek czerwonego mankietu w ramie_masaz.png
const REKA_BARK := Vector2(72, 137)     # gniazdo w barku na doktor_masaz.png
const REKA_DLON := Vector2(36, 44)      # środek dłoni — ląduje na plecach
const REKA_SKALA := 0.7
const KAT_SPOCZYNEK := 144.0
const KAT_UNIESIENIE := 164.0
const KAT_DOCISK := 137.0

# Oceny rytmu. dt = czas od poprzedniego uderzenia w sekundach.
const OCENY := [
	{"min": 0.45, "max": 0.80, "nazwa": "PERFECT!", "punkty": 150, "kolor": "#ffd23f",
		"dymek": ["Aaaaach!", "Odlot!", "No i czadu!", "Bosko!"]},
	{"min": 0.25, "max": 1.20, "nazwa": "Bravo!", "punkty": 100, "kolor": "#7dffb9",
		"dymek": ["Ach!", "Mmm...", "Jeszcze!", "Relaks!"]},
	{"min": 0.13, "max": 1.90, "nazwa": "OK", "punkty": 50, "kolor": "#9fd6ff",
		"dymek": ["Ach...", "No dobrze", "Hmm.", "Dziękuję"]},
	{"min": 1.90, "max": 99.9, "nazwa": "Rytm zgubiony!", "punkty": 0, "kolor": "#ff8b8b",
		"dymek": ["Ups...", "Zasypiam tu...", "Hej, wracaj do rytmu!"]},
]

# Opinie na koniec: [próg punktów, tekst]
const OPINIE := [
	[0, "Pacjent dalej drzemie..."],
	[300, "Solidny trening dłoni!"],
	[800, "Pacjent wychodzi jak nowo narodzony!"],
	[1500, "Legenda oklepywania!"],
	[2500, "MISTRZ MASAŻU — abonament na oklepywanie!"],
]

# --- stan gry (odpowiednik obiektu `stan` i `pacjent` w JS) ---
var faza: Faza = Faza.START
var odblokowany := false
var punkty := 0
var seria := 0
var mnoznik := 1.0
var rekord := 0
var dzwiek_wl := true
var czas_start_ms := 0.0
var ostatni_hit_ms := -99999.0
var ma_poprzedni := false          # czy w tej wizycie było już jakieś uderzenie
var pacjent_bob := 0.0
var pacjent_predkosc := 0.0
var pacjent_ostatni_hit_ms := -99999.0

# --- węzły sceny ---
var swiat: Node2D
var spr_tlo: Sprite2D
var spr_kozetka: Sprite2D
var spr_pacjent: Sprite2D
var spr_doktor: Sprite2D
var ramie_wezel: Node2D            # całe ramię — rysowane za tułowiem
var dlon_wezel: Node2D             # tylko dłoń z mankietem — rysowana przed pacjentem
var efekty: Node2D
var tekstury := {}
var phi0 := 0.0
var kontakt := Vector2.ZERO

var hud: CanvasLayer
var bramka: CanvasLayer
var lbl_punkty: Label
var lbl_combo: Label
var lbl_czas: Label
var btn_oklep: Button
var btn_dzwiek: Button
var ekran_start: PanelContainer
var ekran_koniec: PanelContainer
var lbl_wynik: Label
var lbl_opinia: Label
var lbl_rekord: Label
var pin_pole: LineEdit
var pin_blad: Label

var muzyka: AudioStreamPlayer
var klaps_wav: AudioStreamWAV
var ton_880: AudioStreamWAV
var ton_1320: AudioStreamWAV


func _ready() -> void:
	phi0 = (REKA_DLON - REKA_PIVOT).angle()
	kontakt = pozycja_dloni(KAT_DOCISK)
	_wczytaj_zapis()
	_zbuduj_swiat()
	_zbuduj_dzwiek()

	hud = CanvasLayer.new()
	add_child(hud)
	bramka = CanvasLayer.new()
	bramka.layer = 10          # bramka PIN nad całą resztą
	add_child(bramka)

	_zbuduj_hud()
	_zbuduj_ekrany()

	# Dopóki PIN nie przejdzie, nie widać ani nie słychać gry.
	swiat.visible = false
	hud.visible = false
	pin_pole.grab_focus()


# =====================================================================
#  BUDOWA SCENY
# =====================================================================

func _zbuduj_swiat() -> void:
	swiat = Node2D.new()
	add_child(swiat)

	tekstury = {
		"tlo": load(KATALOG + "tlo.png"),
		"kozetka": load(KATALOG + "kozetka.png"),
		"pacjent": load(KATALOG + "pacjent.png"),
		"reakcja": load(KATALOG + "pacjent_reakcja.png"),
		"relaks": load(KATALOG + "pacjent_relaks.png"),
		"doktor": load(KATALOG + "doktor_masaz.png"),
		"ramie": load(KATALOG + "ramie_masaz.png"),
	}

	# Kolejność rysowania (z_index): tło → ramię → tułów → kozetka → pacjent → dłoń → efekty
	spr_tlo = _sprajt("tlo", Vector2.ZERO, 1.0, 0)
	ramie_wezel = Node2D.new()
	ramie_wezel.z_index = 1
	swiat.add_child(ramie_wezel)
	spr_doktor = _sprajt("doktor", POZ_DOKTOR, SKALA_DOKTOR, 2)
	spr_kozetka = _sprajt("kozetka", POZ_KOZETKA, SKALA_KOZETKA, 3)
	spr_pacjent = _sprajt("pacjent", POZ_PACJENT, SKALA_PACJENT, 4)
	dlon_wezel = Node2D.new()
	dlon_wezel.z_index = 5
	swiat.add_child(dlon_wezel)
	efekty = Node2D.new()
	efekty.z_index = 10
	swiat.add_child(efekty)

	# Ramię: sprajt przesunięty tak, aby jego pivot (mankiet) leżał w (0,0) węzła.
	var sk := REKA_SKALA * SKALA_DOKTOR
	var ramie := Sprite2D.new()
	ramie.texture = tekstury["ramie"]
	ramie.centered = false
	ramie.position = -REKA_PIVOT * sk
	ramie.scale = Vector2.ONE * sk
	ramie_wezel.add_child(ramie)

	# Sama dłoń: wycinek 100x120 z tego samego pliku, z tym samym transformem.
	var dlon := Sprite2D.new()
	dlon.texture = tekstury["ramie"]
	dlon.region_enabled = true
	dlon.region_rect = Rect2(0, 0, 100, 120)
	dlon.centered = false
	dlon.position = -REKA_PIVOT * sk
	dlon.scale = Vector2.ONE * sk
	dlon_wezel.add_child(dlon)

	_ustaw_reke(KAT_SPOCZYNEK)


func _sprajt(klucz: String, poz: Vector2, skala: float, z: int) -> Sprite2D:
	var s := Sprite2D.new()
	s.texture = tekstury[klucz]
	s.centered = false          # punkt (0,0) sprajta = lewy górny róg, jak drawImage w canvasie
	s.position = poz
	s.scale = Vector2.ONE * skala
	s.z_index = z
	swiat.add_child(s)
	return s


func _zbuduj_hud() -> void:
	# Punkty i seria — lewy górny róg
	var pasek := PanelContainer.new()
	pasek.position = Vector2(12, 12)
	pasek.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hud.add_child(pasek)
	var vb := VBoxContainer.new()
	pasek.add_child(vb)
	lbl_punkty = _etykieta("Punkty: 0", 30)
	vb.add_child(lbl_punkty)
	lbl_combo = _etykieta("", 20)
	lbl_combo.add_theme_color_override("font_color", Color("#ffd23f"))
	lbl_combo.visible = false
	vb.add_child(lbl_combo)

	# Czas — prawy górny róg
	var pasek_czasu := PanelContainer.new()
	pasek_czasu.position = Vector2(1024 - 150, 12)
	pasek_czasu.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hud.add_child(pasek_czasu)
	lbl_czas = _etykieta(str(int(CZAS_GRY_S)), 40)
	lbl_czas.custom_minimum_size.x = 110
	pasek_czasu.add_child(lbl_czas)

	# Przyciski — lewy dół, pionowo
	var lewy := VBoxContainer.new()
	lewy.position = Vector2(14, 540)
	lewy.add_theme_constant_override("separation", 8)
	hud.add_child(lewy)

	btn_oklep = _przycisk("Oklep!", 26)
	btn_oklep.custom_minimum_size = Vector2(150, 70)
	btn_oklep.disabled = true
	btn_oklep.pressed.connect(uderz)
	lewy.add_child(btn_oklep)

	btn_dzwiek = _przycisk("", 18)
	btn_dzwiek.pressed.connect(_przelacz_dzwiek)
	lewy.add_child(btn_dzwiek)
	_odswiez_przycisk_dzwieku()

	var btn_od_nowa := _przycisk("Od nowa", 18)
	btn_od_nowa.pressed.connect(_od_nowa)
	lewy.add_child(btn_od_nowa)


func _zbuduj_ekrany() -> void:
	# --- ekran startowy ---
	ekran_start = _nowy_ekran(hud, "EkranStart", 0.8)
	var vb := ekran_start.get_child(0) as VBoxContainer
	vb.add_child(_etykieta("Gabinet Dr. Leszka\nMistrz Oklepywania", 44, 700))
	vb.add_child(_etykieta("Pacjent leży na kozetce i czeka na relaksujący masaż pleców. "
		+ "Klikaj „Oklep!”, dotknij gabinetu albo naciśnij spację — ale w równym rytmie!", 20, 700))
	vb.add_child(_etykieta("60 sekund • idealny rytm = PERFECT i mnożnik serii "
		+ "• zbyt szybki spam = strata serii", 16, 700))
	var start := _przycisk("Start", 30)
	start.pressed.connect(_start_gry)
	vb.add_child(start)

	# --- ekran końca wizyty ---
	ekran_koniec = _nowy_ekran(hud, "EkranKoniec", 0.8)
	ekran_koniec.visible = false
	vb = ekran_koniec.get_child(0) as VBoxContainer
	vb.add_child(_etykieta("Koniec wizyty!", 44))
	lbl_wynik = _etykieta("0", 80)
	lbl_wynik.add_theme_color_override("font_color", Color("#ffd23f"))
	vb.add_child(lbl_wynik)
	lbl_opinia = _etykieta("", 22, 700)
	vb.add_child(lbl_opinia)
	lbl_rekord = _etykieta("", 20)
	lbl_rekord.add_theme_color_override("font_color", Color("#7dffb9"))
	vb.add_child(lbl_rekord)
	var ponownie := _przycisk("Zagraj ponownie", 26)
	ponownie.pressed.connect(_start_gry)
	vb.add_child(ponownie)

	# --- bramka PIN ---
	var pin_panel := _nowy_ekran(bramka, "BramkaPin", 1.0)
	vb = pin_panel.get_child(0) as VBoxContainer
	vb.add_child(_etykieta("Gabinet zamknięty", 36))
	vb.add_child(_etykieta("Wpisz PIN, żeby wejść do gry.", 18, 420))
	pin_pole = LineEdit.new()
	pin_pole.secret = true
	pin_pole.max_length = 4
	pin_pole.alignment = HORIZONTAL_ALIGNMENT_CENTER
	pin_pole.placeholder_text = "PIN"
	pin_pole.custom_minimum_size = Vector2(220, 52)
	pin_pole.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	pin_pole.text_changed.connect(_pin_zmieniony)
	pin_pole.text_submitted.connect(_sprawdz_pin)
	vb.add_child(pin_pole)
	pin_blad = _etykieta("", 18)
	pin_blad.add_theme_color_override("font_color", Color("#ff8b8b"))
	pin_blad.visible = false
	vb.add_child(pin_blad)
	var wejdz := _przycisk("Wejdź", 26)
	wejdz.pressed.connect(func() -> void: _sprawdz_pin(pin_pole.text))
	vb.add_child(wejdz)


func _nowy_ekran(rodzic: Node, nazwa: String, alfa: float) -> PanelContainer:
	var panel := PanelContainer.new()
	panel.name = nazwa
	panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	var styl := StyleBoxFlat.new()
	styl.bg_color = Color(0.03, 0.12, 0.09, alfa)
	panel.add_theme_stylebox_override("panel", styl)
	rodzic.add_child(panel)
	var vb := VBoxContainer.new()
	vb.alignment = BoxContainer.ALIGNMENT_CENTER
	vb.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	vb.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	vb.add_theme_constant_override("separation", 14)
	panel.add_child(vb)
	return panel


func _etykieta(tekst: String, rozmiar: int, szerokosc: float = 0.0) -> Label:
	var l := Label.new()
	l.text = tekst
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.add_theme_font_size_override("font_size", rozmiar)
	if szerokosc > 0.0:
		l.custom_minimum_size.x = szerokosc
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return l


func _przycisk(tekst: String, rozmiar: int) -> Button:
	var b := Button.new()
	b.text = tekst
	b.focus_mode = Control.FOCUS_NONE   # spacja ma działać jako "oklep", a nie klikać przycisk
	b.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	b.add_theme_font_size_override("font_size", rozmiar)
	return b


# =====================================================================
#  ZAPIS I DŹWIĘK
# =====================================================================

func _wczytaj_zapis() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(PLIK_ZAPISU) == OK:
		rekord = cfg.get_value("gabinet", "rekord", 0)
		dzwiek_wl = cfg.get_value("gabinet", "dzwiek", true)


func _zapisz_zapis() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("gabinet", "rekord", rekord)
	cfg.set_value("gabinet", "dzwiek", dzwiek_wl)
	cfg.save(PLIK_ZAPISU)


func _zbuduj_dzwiek() -> void:
	# Muzyka z pliku MP3 (importowana przez Godota jako AudioStreamMP3).
	muzyka = AudioStreamPlayer.new()
	var mp3 := load(MUZYKA) as AudioStreamMP3
	mp3.loop = true
	muzyka.stream = mp3
	add_child(muzyka)

	# Efekty generowane w kodzie — bez dodatkowych plików, tak jak w WebAudio w oryginale.
	klaps_wav = _zbuduj_szum(0.05)
	ton_880 = _zbuduj_ton(880.0, 0.25)
	ton_1320 = _zbuduj_ton(1320.0, 0.25)


func _zbuduj_szum(dlugosc_s: float) -> AudioStreamWAV:
	var n := int(44100.0 * dlugosc_s)
	var dane := PackedByteArray()
	dane.resize(n * 2)
	for i in n:
		var zanik := pow(1.0 - float(i) / n, 2.4)
		var v := (randf() * 2.0 - 1.0) * zanik
		dane.encode_s16(i * 2, int(v * 32000.0))
	return _wav(dane)


func _zbuduj_ton(czestotliwosc: float, dlugosc_s: float) -> AudioStreamWAV:
	var n := int(44100.0 * dlugosc_s)
	var dane := PackedByteArray()
	dane.resize(n * 2)
	for i in n:
		var t := float(i) / 44100.0
		var zanik := pow(1.0 - float(i) / n, 2.0)
		var v := sin(TAU * czestotliwosc * t) * zanik * 0.4
		dane.encode_s16(i * 2, int(v * 32000.0))
	return _wav(dane)


func _wav(dane: PackedByteArray) -> AudioStreamWAV:
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = 44100
	w.stereo = false
	w.data = dane
	return w


func _zagraj(strumien: AudioStream, glosnosc_db: float = 0.0) -> void:
	if not dzwiek_wl:
		return
	var p := AudioStreamPlayer.new()
	p.stream = strumien
	p.volume_db = glosnosc_db
	add_child(p)
	p.play()
	p.finished.connect(p.queue_free)


func _przelacz_dzwiek() -> void:
	dzwiek_wl = not dzwiek_wl
	_zapisz_zapis()
	_odswiez_przycisk_dzwieku()
	if dzwiek_wl and faza == Faza.GRA:
		muzyka.play()
	elif not dzwiek_wl:
		muzyka.stop()


func _odswiez_przycisk_dzwieku() -> void:
	btn_dzwiek.text = "Muzyka: wł." if dzwiek_wl else "Muzyka: wył."


# =====================================================================
#  BRAMKA PIN
# =====================================================================

func _pin_zmieniony(tekst: String) -> void:
	# Zostawiamy tylko cyfry.
	var cyfry := ""
	for i in tekst.length():
		var znak := tekst.substr(i, 1)
		if znak >= "0" and znak <= "9":
			cyfry += znak
	if cyfry != tekst:
		pin_pole.text = cyfry
		pin_pole.caret_column = cyfry.length()
	pin_blad.visible = false
	if cyfry.length() == 4:
		_sprawdz_pin(cyfry)


func _sprawdz_pin(tekst: String) -> void:
	if tekst.length() != PIN_GABINETU.length():
		pin_blad.text = "Wpisz 4-cyfrowy PIN."
		pin_blad.visible = true
		return
	if tekst == PIN_GABINETU:
		_odblokuj()
	else:
		pin_blad.text = "Zły PIN. Spróbuj jeszcze raz."
		pin_blad.visible = true
		pin_pole.clear()
		pin_pole.grab_focus()


func _odblokuj() -> void:
	odblokowany = true
	bramka.visible = false
	swiat.visible = true
	hud.visible = true
	ekran_start.visible = true
	pin_pole.release_focus()
	get_window().title = "Gabinet Dr. Leszka — Mistrz Oklepywania"


# =====================================================================
#  LOGIKA GRY
# =====================================================================

func pozycja_dloni(kat_stopnie: float) -> Vector2:
	# Ta sama geometria co pozycjaDloni() w gabinet.html.
	var dlugosc := (REKA_DLON - REKA_PIVOT).length() * REKA_SKALA * SKALA_DOKTOR
	var bark := POZ_DOKTOR + REKA_BARK * SKALA_DOKTOR
	return bark + Vector2.from_angle(deg_to_rad(kat_stopnie)) * dlugosc


func _mnoznik_serii(s: int) -> float:
	return minf(4.0, 1.0 + floor(float(s) / 4.0) * 0.5)


func _ocena_dla(dt: float) -> Dictionary:
	for o in OCENY:
		if dt >= o["min"] and dt < o["max"]:
			return o
	return OCENY[OCENY.size() - 1]


func uderz() -> void:
	if not odblokowany or faza != Faza.GRA:
		return
	var teraz := float(Time.get_ticks_msec())
	if teraz - ostatni_hit_ms < SPAM_OKNO_MS:
		return                                  # anty-spam
	var dt := (teraz - ostatni_hit_ms) / 1000.0
	ostatni_hit_ms = teraz

	var ocena: Dictionary = _ocena_dla(dt)
	var pierwsze := not ma_poprzedni
	ma_poprzedni = true
	var kolor: String = ocena["kolor"]

	if pierwsze:
		seria = 1
		mnoznik = _mnoznik_serii(seria)
		punkty += roundi(50.0 * mnoznik)
		_napis("Start!", "#9fd6ff")
		_dymek("Zaczynamy!", "#9fd6ff")
		_czastki(6, "#cfe8ff")
	elif int(ocena["punkty"]) > 0:
		seria += 1
		mnoznik = _mnoznik_serii(seria)
		punkty += roundi(float(ocena["punkty"]) * mnoznik)
		var tekst: String = ocena["nazwa"]
		if mnoznik > 1.0:
			tekst += " x" + str(mnoznik)
		_napis(tekst, kolor)
		if tekst.begins_with("PERFECT"):
			_czastki(14, "#ffd23f")
			_czastki(6, "#ffffff")
			_zagraj(ton_880, -6.0)
			get_tree().create_timer(0.06).timeout.connect(_zagraj.bind(ton_1320, -6.0))
		else:
			_czastki(6, "#ffe9a8")
	else:
		seria = 0
		mnoznik = 1.0
		_napis(ocena["nazwa"], kolor)

	var teksty: Array = ocena["dymek"]
	_dymek(teksty.pick_random(), kolor)

	pacjent_ostatni_hit_ms = teraz
	pacjent_predkosc += 90.0
	_zagraj(klaps_wav, linear_to_db(1.0 if int(ocena["punkty"]) >= 100 else 0.5))
	_odswiez_hud()


func _odswiez_hud() -> void:
	lbl_punkty.text = "Punkty: %d" % punkty
	if seria >= 2:
		lbl_combo.visible = true
		lbl_combo.text = "Seria: %d • x%s" % [seria, str(mnoznik)]
	else:
		lbl_combo.visible = false


func _start_gry() -> void:
	if not odblokowany:
		return
	faza = Faza.GRA
	punkty = 0
	seria = 0
	mnoznik = 1.0
	ostatni_hit_ms = -99999.0
	ma_poprzedni = false
	pacjent_bob = 0.0
	pacjent_predkosc = 0.0
	pacjent_ostatni_hit_ms = -99999.0
	for n in efekty.get_children():
		n.queue_free()
	czas_start_ms = float(Time.get_ticks_msec())
	ekran_start.visible = false
	ekran_koniec.visible = false
	btn_oklep.disabled = false
	lbl_czas.text = str(int(CZAS_GRY_S))
	lbl_czas.modulate = Color.WHITE
	_odswiez_hud()
	if dzwiek_wl and not muzyka.playing:
		muzyka.play()


func _od_nowa() -> void:
	if faza != Faza.START:
		_start_gry()


func _koniec_gry() -> void:
	faza = Faza.KONIEC
	btn_oklep.disabled = true
	lbl_wynik.text = str(punkty)
	var opinia := ""
	for o in OPINIE:
		if punkty >= o[0]:
			opinia = o[1]
	lbl_opinia.text = opinia
	if punkty > rekord:
		rekord = punkty
		_zapisz_zapis()
		lbl_rekord.text = "Nowy rekord gabinetu!"
	else:
		lbl_rekord.text = "Rekord gabinetu: %d" % rekord
	ekran_koniec.visible = true


# =====================================================================
#  ANIMACJA
# =====================================================================

func kat_ramienia(czas: float, hit_ms: float) -> float:
	# Krzywa fazy ramienia: spoczynek → zamach → docisk → odbicie → spoczynek.
	var sp := KAT_SPOCZYNEK
	var up := KAT_UNIESIENIE
	var dn := KAT_DOCISK
	if hit_ms < 0.0:
		return sp + sin(czas * 0.0016) * 2.2     # spokojne kołysanie
	var t := (czas - hit_ms) / 1000.0
	if t < 0.09:
		var k := t / 0.09
		return sp + (up - sp) * (k * k)
	if t < 0.17:
		var k2 := (t - 0.09) / 0.08
		return up + (dn - up) * (k2 * k2)
	if t < 0.26:
		var k3 := (t - 0.17) / 0.09
		return dn + (sp - dn) * (1.0 - pow(1.0 - k3, 2.0))
	if t < 0.40:
		var k4 := (t - 0.26) / 0.14
		return sp + sin(k4 * PI) * 5.0
	return sp + sin(czas * 0.0016) * 2.2


func _ustaw_reke(kat_stopnie: float) -> void:
	# Transform = przesunięcie do barku + obrót wokół mankietu.
	# PHI0 to naturalny kąt wektora bark→dłoń w sprajcie, więc kąty są takie jak na ekranie.
	var bark := POZ_DOKTOR + REKA_BARK * SKALA_DOKTOR
	var obrot := deg_to_rad(kat_stopnie) - phi0
	ramie_wezel.position = bark
	ramie_wezel.rotation = obrot
	dlon_wezel.position = bark
	dlon_wezel.rotation = obrot


func _krok_pacjenta(dt: float, czas: float) -> void:
	# Sprężyna: pacjent podskakuje po każdym uderzeniu.
	var k := 90.0
	var c := 9.0
	pacjent_predkosc += (-k * pacjent_bob - c * pacjent_predkosc) * dt
	pacjent_bob += pacjent_predkosc * dt

	var mina := "spokoj"
	if czas - pacjent_ostatni_hit_ms < MINA_KALM_MS:
		mina = "reakcja"
	elif sin(czas * 0.0009) > 0.55:
		mina = "relaks"
	spr_pacjent.texture = tekstury[mina]
	spr_pacjent.position = POZ_PACJENT + Vector2(0.0, clampf(pacjent_bob, -8.0, 10.0))


func _process(delta: float) -> void:
	if not odblokowany:
		return
	var czas := float(Time.get_ticks_msec())
	_krok_pacjenta(minf(delta, 0.05), czas)

	var hit := -1.0
	if faza == Faza.GRA and czas - ostatni_hit_ms < RAMIE_AKTYWNE_MS:
		hit = ostatni_hit_ms
	_ustaw_reke(kat_ramienia(czas, hit))

	if faza == Faza.GRA:
		var zostalo := maxf(0.0, CZAS_GRY_S - (czas - czas_start_ms) / 1000.0)
		lbl_czas.text = str(int(ceil(zostalo)))
		lbl_czas.modulate = Color("#ff6b6b") if zostalo <= 10.0 else Color.WHITE
		if zostalo <= 0.0:
			_koniec_gry()


func _czastki(ile: int, kolor: String) -> void:
	var p := CPUParticles2D.new()
	p.position = kontakt
	p.one_shot = true
	p.explosiveness = 1.0
	p.amount = ile
	p.lifetime = 0.65
	p.direction = Vector2.UP
	p.spread = 180.0
	p.initial_velocity_min = 60.0
	p.initial_velocity_max = 220.0
	p.gravity = Vector2(0.0, 260.0)
	p.scale_amount_min = 2.0
	p.scale_amount_max = 5.0
	p.color = Color(kolor)
	efekty.add_child(p)
	p.emitting = true
	get_tree().create_timer(1.0).timeout.connect(p.queue_free)


func _napis(tekst: String, kolor: String) -> void:
	var l := Label.new()
	l.text = tekst
	l.add_theme_font_size_override("font_size", 30)
	l.add_theme_color_override("font_color", Color(kolor))
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.6))
	l.add_theme_constant_override("outline_size", 5)
	l.position = kontakt + Vector2(90, -60)
	efekty.add_child(l)
	_animuj_i_usun(l, -46.0, 0.9, 0.0)


func _dymek(tekst: String, kolor: String) -> void:
	var p := PanelContainer.new()
	var styl := StyleBoxFlat.new()
	styl.bg_color = Color(1, 1, 1, 0.95)
	styl.border_color = Color(kolor)
	styl.set_border_width_all(3)
	styl.set_corner_radius_all(14)
	styl.set_content_margin_all(10)
	p.add_theme_stylebox_override("panel", styl)
	var l := Label.new()
	l.text = tekst
	l.add_theme_font_size_override("font_size", 22)
	l.add_theme_color_override("font_color", Color("#222233"))
	p.add_child(l)
	p.position = Vector2(kontakt.x - 80.0 + randf() * 40.0, kontakt.y - 150.0)
	efekty.add_child(p)
	_animuj_i_usun(p, -30.0, 1.5, 1.125)


func _animuj_i_usun(n: CanvasItem, dy: float, czas_s: float, od_s: float) -> void:
	var tw := create_tween()
	tw.tween_property(n, "position:y", n.position.y + dy, czas_s)
	tw.parallel().tween_property(n, "modulate:a", 0.0, czas_s - od_s).set_delay(od_s)
	tw.tween_callback(n.queue_free)


# =====================================================================
#  STEROWANIE
# =====================================================================

func _unhandled_input(event: InputEvent) -> void:
	if not odblokowany:
		return
	if event.is_action_pressed("ui_accept"):      # spacja / Enter
		get_viewport().set_input_as_handled()
		if faza == Faza.GRA:
			uderz()
		elif faza == Faza.START:
			_start_gry()
		return
	var klik := event is InputEventMouseButton \
		and event.is_pressed() \
		and (event as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT
	var dotyk := event is InputEventScreenTouch and event.is_pressed()
	if (klik or dotyk) and faza == Faza.GRA:
		uderz()
