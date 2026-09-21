"""Wyodrębnij ciało i ramię z oryginalnych PNG (wymaga Pillow).
Uruchom z dowolnego katalogu: python scripts/prepare-gabinet-sprites.py.
Oryginały pozostają bez zmian, punkty mocowania opisuje REKA w gabinet.html.
"""
from pathlib import Path
from PIL import Image, ImageDraw

assets = Path(__file__).resolve().parents[1] / 'images' / 'gabinet'
body = Image.open(assets / 'doktor_calosc.png').convert('RGBA')
# Usuń tylko rękę od strony pacjenta, zostawiając drugą w naturalnej pozycji.
mask = Image.new('L', body.size)
ImageDraw.Draw(mask).polygon(
    [(0, 175), (66, 175), (47, 229), (35, 308), (27, 385),
     (23, 453), (0, 459)], fill=255)
body.paste((0, 0, 0, 0), (0, 0), mask)
body.save(assets / 'doktor_masaz.png', optimize=True)

# W oryginalnej ręce był też fragment tułowia. Nie może obracać się z ramieniem.
arm = Image.open(assets / 'doktor_reka.png').convert('RGBA').crop((0, 0, 176, 234))
# Zaokrąglona nasada rękawa w miejsce prostokątnego wycięcia po tułowiu.
# Rysowanie w 3x daje gładką krawędź również na ekranach Retina.
cap = Image.new('RGBA', (200 * 3, 234 * 3))
draw = ImageDraw.Draw(cap)
def curve(a, b, c, d):
    return [tuple(3 * ((1-t)**3*a[j] + 3*(1-t)**2*t*b[j] +
                      3*(1-t)*t*t*c[j] + t**3*d[j]) for j in (0, 1))
            for t in [i / 30 for i in range(31)]]
edge = curve((130, 146), (173, 143), (198, 180), (188, 207))
edge += curve((188, 207), (186, 220), (180, 229), (171, 232))
draw.polygon(edge, fill='#e1ecf0')
draw.line(edge, fill='#17191b', width=9)
cap = cap.resize((200, 234), Image.Resampling.LANCZOS)
cap.alpha_composite(arm)
cap.save(assets / 'ramie_masaz.png', optimize=True)
