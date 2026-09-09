"""Vygeneruje src/lib/rodnyListAssets.ts - pisma a obrazky pro Rodny list.

Spousti se RUCNE a jen kdyz je potreba zmenit pismo, logo nebo podpis:

    pip install fonttools pillow numpy
    python3 scripts/build-rodny-list-assets.py

Vstupy vedle skriptu: rodny-list-chars.txt (znaky, ktere ma pismo obsahovat),
rodny-list-logo.png a rodny-list-podpis.png (obrazky s pruhlednosti, vytazene
ze vzoroveho PDF "RL_Dobre podlahy.pdf"). Vystup prepise src/lib/rodnyListAssets.ts.
"""
import os as _os

HERE = _os.path.dirname(_os.path.abspath(__file__))
ROOT = _os.path.dirname(HERE)
CHARS_PATH = _os.path.join(HERE, 'rodny-list-chars.txt')
LOGO_PATH = _os.path.join(HERE, 'rodny-list-logo.png')
SIGN_PATH = _os.path.join(HERE, 'rodny-list-podpis.png')
OUT_PATH = _os.path.join(ROOT, 'src', 'lib', 'rodnyListAssets.ts')
import base64, json, textwrap, zlib
from fontTools.ttLib import TTFont
from fontTools import subset
from PIL import Image
import numpy as np

CHARS = open(CHARS_PATH, encoding='utf-8').read().replace('\n', '')
UNI = sorted({ord(c) for c in CHARS})


def make_font(src, out):
    subset.main([src, '--unicodes=' + ','.join(f'U+{u:04X}' for u in UNI),
                 '--output-file=' + out, '--layout-features=', '--no-hinting',
                 '--desubroutinize', '--drop-tables+=DSIG,FFTM', '--name-IDs=*',
                 '--recalc-bounds'])
    f = TTFont(out)
    upm = f['head'].unitsPerEm
    cmap = f.getBestCmap()
    hmtx = f['hmtx']
    order = f.getGlyphOrder()
    gid = {g: i for i, g in enumerate(order)}
    glyphs = {}
    for cp in UNI:
        g = cmap.get(cp)
        if g is None:
            continue
        glyphs[cp] = [gid[g], round(hmtx[g][0] * 1000 / upm)]
    head = f['head']
    os2 = f['OS/2']
    return {
        'ttf': base64.b64encode(open(out, 'rb').read()).decode(),
        'unitsPerEm': upm,
        'bbox': [round(head.xMin * 1000 / upm), round(head.yMin * 1000 / upm),
                 round(head.xMax * 1000 / upm), round(head.yMax * 1000 / upm)],
        'ascent': round(f['hhea'].ascent * 1000 / upm),
        'descent': round(f['hhea'].descent * 1000 / upm),
        'capHeight': round(os2.sCapHeight * 1000 / upm),
        'glyphs': glyphs,
    }


def make_image(path):
    im = Image.open(path).convert('RGBA')
    a = np.array(im)
    rgb = a[:, :, :3].tobytes()
    alpha = a[:, :, 3].tobytes()
    return {
        'width': im.width,
        'height': im.height,
        'rgb': base64.b64encode(zlib.compress(rgb, 9)).decode(),
        'alpha': base64.b64encode(zlib.compress(alpha, 9)).decode(),
    }


def ts_const(name, value, note):
    raw = json.dumps(value, separators=(',', ':'), ensure_ascii=True)
    lines = textwrap.wrap(raw, 110, break_long_words=True, break_on_hyphens=False)
    body = '\n'.join("  '%s' +" % l.replace('\\', '\\\\').replace("'", "\\'") for l in lines[:-1])
    body += "\n  '%s'" % lines[-1].replace('\\', '\\\\').replace("'", "\\'")
    return f'/** {note} */\nexport const {name}: string =\n{body};\n\n'


reg = make_font('/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', _os.path.join(HERE, 'LibSans-Regular.sub.ttf'))
bold = make_font('/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf', _os.path.join(HERE, 'LibSans-Bold.sub.ttf'))
logo = make_image(LOGO_PATH)
sig = make_image(SIGN_PATH)

head = '''// TENTO SOUBOR JE GENEROVANY - viz scripts/build-rodny-list-assets.py.
// Needituj ho rucne, jen ho pripadne pregeneruj.
//
// Proc jsou pisma a obrazky primo tady jako base64 a ne v /public: funkce na
// Vercelu nemaji spolehlivy pristup k souborum na disku (dostanou jen to, co
// si Next.js sam vystopuje do output trace). Vlozene konstanty se do bundlu
// dostanou vzdy, takze se Rodny list vygeneruje i na produkci.
//
// Pisma: Liberation Sans (SIL Open Font License 1.1) - metricky shodne
// s Arialem, ktery pouziva vzorovy dokument RL_Dobre podlahy.pdf. Orezane jen
// na znaky, ktere dokument potrebuje (latinka, cestina, interpunkce) - proto
// ~17 kB misto 350 kB.
//
// Logo a podpis jsou vytazene primo ze vzoroveho PDF, takze sedi na pixel.
// Ulozene jsou uz jako HOTOVE datove proudy pro PDF: zvlast barevna slozka
// (DeviceRGB) a zvlast pruhlednost (SMask), obojI zabalene deflate. Diky tomu
// se za behu nemusi dekodovat zadny PNG.

export type EmbeddedFont = {
  /** Orezany TrueType soubor (base64). */
  ttf: string;
  unitsPerEm: number;
  /** FontBBox v tisicinach em. */
  bbox: [number, number, number, number];
  ascent: number;
  descent: number;
  capHeight: number;
  /** Kod znaku -> [index glyfu, sirka v tisicinach em]. */
  glyphs: Record<string, [number, number]>;
};

export type EmbeddedImage = {
  width: number;
  height: number;
  /** Deflate(raw RGB), base64. */
  rgb: string;
  /** Deflate(raw alfa kanal), base64. */
  alpha: string;
};

'''

out = head
out += ts_const('FONT_REGULAR_JSON', reg, 'Liberation Sans Regular - hodnoty v tabulce a paticka.')
out += ts_const('FONT_BOLD_JSON', bold, 'Liberation Sans Bold - nadpis, popisky poli, "PODPIS:".')
out += ts_const('LOGO_JSON', logo, 'Zelene logo MEDIASPACE do fialoveho pruhu.')
out += ts_const('SIGNATURE_JSON', sig, 'Naskenovany podpis do ramecku PODPIS.')
out += '''export const FONT_REGULAR = JSON.parse(FONT_REGULAR_JSON) as EmbeddedFont;
export const FONT_BOLD = JSON.parse(FONT_BOLD_JSON) as EmbeddedFont;
export const LOGO = JSON.parse(LOGO_JSON) as EmbeddedImage;
export const SIGNATURE = JSON.parse(SIGNATURE_JSON) as EmbeddedImage;
'''
open(OUT_PATH, 'w').write(out)
import os
print(OUT_PATH, os.path.getsize(OUT_PATH), 'B')
print('regular glyphs', len(reg['glyphs']), 'cap', reg['capHeight'], 'bold cap', bold['capHeight'])
print('logo', logo['width'], logo['height'], len(logo['rgb']), len(logo['alpha']))
print('sig', sig['width'], sig['height'], len(sig['rgb']), len(sig['alpha']))
