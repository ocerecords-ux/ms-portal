#!/usr/bin/env python3
"""
OBRÁZKY K NÁVODU „PORTÁL V MOBILU" (zadání 27. 9. 2026: „u klientů v portálu
dej ještě návod na přidání MS portálu do mobilu. S obrázkama").

Kreslí se schematicky, ne jako snímek cizího systému: telefon, adresní řádek,
nabídka a zvýrazněná položka, na kterou se má klepnout. Kdyby to byly snímky
z iPhonu, zastaraly by při první změně iOS a v návodu pro Android by stejně
nepomohly.

Spouští se ručně po úpravě: python3 scripts/obrazkyNavoduMobil.py
Výsledek: public/navody/mobil-*.png
"""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

VEN = Path(__file__).resolve().parent.parent / 'public' / 'navody'
PISMO = '/usr/share/fonts/truetype/google-fonts/Poppins-%s.ttf'

POZADI = (251, 250, 255)
FIALOVA = (107, 42, 240)
FIALOVA_TMAVA = (74, 21, 181)
ZELENA = (163, 230, 53)
INK = (26, 22, 37)
SEDA = (122, 118, 138)
LINKA = (223, 219, 235)
BILA = (255, 255, 255)

SIRKA, VYSKA = 1200, 860
TEL_X, TEL_Y, TEL_S, TEL_V = 90, 60, 420, 740


def font(rez: str, velikost: int):
    return ImageFont.truetype(PISMO % rez, velikost)


def telefon(d: ImageDraw.ImageDraw):
    """Rám telefonu s tmavou obrazovkou a fialovou hlavičkou portálu."""
    d.rounded_rectangle(
        [TEL_X - 14, TEL_Y - 14, TEL_X + TEL_S + 14, TEL_Y + TEL_V + 14],
        radius=58, fill=(38, 34, 52), outline=(58, 53, 78), width=3,
    )
    d.rounded_rectangle([TEL_X, TEL_Y, TEL_X + TEL_S, TEL_Y + TEL_V], radius=46, fill=BILA)


def hlavicka_portalu(d: ImageDraw.ImageDraw, y: int) -> int:
    d.rectangle([TEL_X, y, TEL_X + TEL_S, y + 76], fill=FIALOVA)
    d.text((TEL_X + 26, y + 26), 'MS portal', font=font('Bold', 26), fill=ZELENA)
    for i in range(7):
        vyska = 14 + (i % 3) * 8
        d.rectangle(
            [TEL_X + 300 + i * 10, y + 46 - vyska, TEL_X + 300 + i * 10 + 5, y + 46],
            fill=ZELENA,
        )
    return y + 76


def obsah(d: ImageDraw.ImageDraw, y: int, radku: int = 5):
    """Naznačený obsah stránky - jen proužky, o ten tu nejde."""
    for i in range(radku):
        horni = y + 26 + i * 74
        d.rounded_rectangle(
            [TEL_X + 22, horni, TEL_X + TEL_S - 22, horni + 56], radius=14, fill=(244, 242, 252)
        )
        d.rounded_rectangle(
            [TEL_X + 38, horni + 16, TEL_X + 38 + 150 - (i % 3) * 30, horni + 26],
            radius=5, fill=(206, 200, 230),
        )
        d.rounded_rectangle(
            [TEL_X + 38, horni + 34, TEL_X + 38 + 220 - (i % 2) * 50, horni + 42],
            radius=4, fill=(224, 220, 240),
        )


def adresni_radek(d: ImageDraw.ImageDraw, y: int, ikona: str):
    """Spodní lišta prohlížeče: adresa a vedle ní ikona (share / tři tečky)."""
    d.rectangle([TEL_X, y, TEL_X + TEL_S, TEL_Y + TEL_V], fill=(240, 238, 246))
    d.rounded_rectangle([TEL_X + 22, y + 18, TEL_X + 300, y + 62], radius=22, fill=BILA)
    d.text((TEL_X + 46, y + 30), 'msportal.cz', font=font('Regular', 22), fill=INK)
    if ikona == 'share':
        sdileni(d, TEL_X + 330, y + 22, INK)
    else:
        for i in range(3):
            d.ellipse(
                [TEL_X + 346, y + 26 + i * 14, TEL_X + 354, y + 34 + i * 14], fill=INK
            )


def sdileni(d: ImageDraw.ImageDraw, x: int, y: int, barva):
    """Obecná značka sdílení: obdélník a šipka nahoru."""
    d.rounded_rectangle([x, y + 16, x + 34, y + 40], radius=6, outline=barva, width=3)
    d.line([x + 17, y + 30, x + 17, y + 2], fill=barva, width=3)
    d.line([x + 17, y + 2, x + 6, y + 13], fill=barva, width=3)
    d.line([x + 17, y + 2, x + 28, y + 13], fill=barva, width=3)


def krouzek(d: ImageDraw.ImageDraw, x1, y1, x2, y2):
    """Fialový prstenec kolem toho, na co se má klepnout."""
    d.rounded_rectangle([x1 - 10, y1 - 10, x2 + 10, y2 + 10], radius=20, outline=FIALOVA, width=5)


def popisek(img: Image.Image, d: ImageDraw.ImageDraw, nadpis: str, radky: list[str]):
    x = TEL_X + TEL_S + 110
    d.text((x, 150), nadpis, font=font('Bold', 40), fill=INK)
    y = 230
    for r in radky:
        d.text((x, y), r, font=font('Regular', 27), fill=SEDA)
        y += 46


def zaklad() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new('RGB', (SIRKA, VYSKA), POZADI)
    return img, ImageDraw.Draw(img)


def uloz(img: Image.Image, nazev: str):
    VEN.mkdir(parents=True, exist_ok=True)
    img.save(VEN / nazev, optimize=True)
    print('  ', nazev)


def obrazek_safari():
    img, d = zaklad()
    telefon(d)
    y = hlavicka_portalu(d, TEL_Y)
    obsah(d, y)
    lista = TEL_Y + TEL_V - 84
    adresni_radek(d, lista, 'share')
    krouzek(d, TEL_X + 326, lista + 22, TEL_X + 366, lista + 62)
    popisek(img, d, 'iPhone — Safari', [
        'Otevřete msportal.cz a přihlaste se.',
        'Dole na liště klepněte na značku',
        'sdílení — čtvereček se šipkou nahoru.',
    ])
    uloz(img, 'mobil-ios-1.png')


def obrazek_ios_nabidka():
    img, d = zaklad()
    telefon(d)
    y = hlavicka_portalu(d, TEL_Y)
    obsah(d, y, radku=2)
    # Vysunutá nabídka přes spodní část obrazovky.
    vrch = TEL_Y + 300
    d.rounded_rectangle([TEL_X, vrch, TEL_X + TEL_S, TEL_Y + TEL_V], radius=40, fill=(247, 246, 250))
    d.rounded_rectangle([TEL_X + 180, vrch + 16, TEL_X + 240, vrch + 22], radius=3, fill=LINKA)
    polozky = ['Kopírovat', 'Do seznamu četby', 'Přidat na plochu', 'Přidat záložku']
    for i, text in enumerate(polozky):
        ry = vrch + 56 + i * 82
        d.rounded_rectangle([TEL_X + 20, ry, TEL_X + TEL_S - 20, ry + 68], radius=16, fill=BILA)
        d.text((TEL_X + 44, ry + 22), text, font=font('Regular', 24), fill=INK)
        d.rounded_rectangle(
            [TEL_X + TEL_S - 78, ry + 18, TEL_X + TEL_S - 46, ry + 50], radius=8,
            outline=SEDA, width=2,
        )
        if text == 'Přidat na plochu':
            d.line([TEL_X + TEL_S - 62, ry + 24, TEL_X + TEL_S - 62, ry + 44], fill=SEDA, width=2)
            d.line([TEL_X + TEL_S - 72, ry + 34, TEL_X + TEL_S - 52, ry + 34], fill=SEDA, width=2)
            krouzek(d, TEL_X + 20, ry, TEL_X + TEL_S - 20, ry + 68)
    popisek(img, d, 'Přidat na plochu', [
        'V nabídce sjeďte níž a klepněte',
        'na „Přidat na plochu“.',
        '',
        'Pak už jen potvrdíte „Přidat“',
        'v pravém horním rohu.',
    ])
    uloz(img, 'mobil-ios-2.png')


def obrazek_android():
    img, d = zaklad()
    telefon(d)
    y = hlavicka_portalu(d, TEL_Y)
    obsah(d, y, radku=2)
    vrch = TEL_Y + 300
    d.rounded_rectangle([TEL_X + 120, vrch, TEL_X + TEL_S - 20, vrch + 300], radius=24, fill=BILA,
                        outline=LINKA, width=2)
    polozky = ['Nová karta', 'Historie', 'Stáhnout', 'Instalovat aplikaci']
    for i, text in enumerate(polozky):
        ry = vrch + 24 + i * 68
        d.text((TEL_X + 150, ry + 16), text, font=font('Regular', 24), fill=INK)
        if text == 'Instalovat aplikaci':
            krouzek(d, TEL_X + 134, ry + 4, TEL_X + TEL_S - 36, ry + 52)
    lista = TEL_Y + TEL_V - 84
    adresni_radek(d, lista, 'tecky')
    popisek(img, d, 'Android — Chrome', [
        'Otevřete msportal.cz a přihlaste se.',
        'Klepněte na tři tečky a vyberte',
        '„Instalovat aplikaci“ (nebo',
        '„Přidat na plochu“).',
    ])
    uloz(img, 'mobil-android.png')


def obrazek_plocha():
    img, d = zaklad()
    telefon(d)
    # Plocha telefonu s ikonami; ta naše je zvýrazněná.
    d.rounded_rectangle([TEL_X, TEL_Y, TEL_X + TEL_S, TEL_Y + TEL_V], radius=46,
                        fill=(36, 30, 58))
    for radek in range(3):
        for sloupec in range(4):
            x = TEL_X + 34 + sloupec * 92
            y = TEL_Y + 90 + radek * 132
            nase = radek == 1 and sloupec == 1
            d.rounded_rectangle([x, y, x + 72, y + 72], radius=20,
                                fill=FIALOVA if nase else (62, 56, 88))
            if nase:
                for i in range(5):
                    v = 12 + (i % 3) * 8
                    d.rectangle([x + 18 + i * 8, y + 46 - v, x + 18 + i * 8 + 4, y + 46], fill=ZELENA)
                d.text((x - 6, y + 82), 'MS portal', font=font('Regular', 15), fill=BILA)
                krouzek(d, x, y, x + 72, y + 72)
            else:
                d.rounded_rectangle([x + 14, y + 86, x + 58, y + 92], radius=3, fill=(62, 56, 88))
    popisek(img, d, 'Hotovo', [
        'Portál máte na ploše jako aplikaci.',
        'Otevře se na celou obrazovku,',
        'bez adresního řádku — a zůstanete',
        'přihlášení, takže heslo už',
        'nepotřebujete psát.',
    ])
    uloz(img, 'mobil-hotovo.png')


if __name__ == '__main__':
    print('Kreslím obrázky do', VEN)
    obrazek_safari()
    obrazek_ios_nabidka()
    obrazek_android()
    obrazek_plocha()
