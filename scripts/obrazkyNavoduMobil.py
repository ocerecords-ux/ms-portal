#!/usr/bin/env python3
"""
OBRÁZKY K NÁVODU „PORTÁL V MOBILU" (zadání 27. 9. 2026: „u klientů v portálu
dej ještě návod na přidání MS portálu do mobilu. S obrázkama").

KRESLÍ SE V PROHLÍŽEČI, NE PIXEL PO PIXELU (přepsáno 16. 10. 2026: „ten návod
vypadá hrozně, jsou tam nereálné ikony a rozpadá se grafika"). Do té doby se
obrázky skládaly v Pillow z obdélníků - prázdné čtverečky místo ikon, text,
který vytekl z nabídky, a kulaté rohy displeje, přes které obsah přetékal.
Teď je každý obrázek obyčejná HTML stránka, kterou vyfotí Chromium: skutečné
zaoblení, stíny, ořez displeje a ikony jako SVG, všechno v barvách portálu.

Pořád jsou to SCHÉMATA, ne snímky z cizího telefonu: nezastarají s další verzí
systému a platí pro iPhone i Android.

Spouští se ručně po úpravě: python3 scripts/obrazkyNavoduMobil.py
Výsledek: public/navody/mobil-*.jpg (1800x1290)

JPEG, ne PNG: obrázky jsou skoro celé měkký přechod a v PNG by každý vážil
přes tři čtvrtě megabajtu. Takhle mají kolem 150 kB a nápověda se načte i na
telefonu.

Potřebuje: pip install playwright qrcode && playwright install chromium
a Pillow; k tomu písmo Poppins v systému (jinak se obrázky vykreslí náhradním
písmem).
"""
import io
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

VEN = Path(__file__).resolve().parent.parent / 'public' / 'navody'
SIRKA, VYSKA = 1200, 860
ADRESA_PORTALU = 'https://www.msportal.cz'

STYL = """
:root{
  --fialova:#6B2AF0; --fialova-tmava:#4A15B5; --fialova-svetla:#B49BFF;
  --zelena:#A3E635; --ink:#1A1625; --seda:#7A768A; --linka:#E4E0EF;
  --papir:#FBFAFF; --pole:#F4F2FC;
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1200px;height:860px}
body{
  font-family:'Poppins',sans-serif;color:var(--ink);
  background:
    radial-gradient(900px 620px at 8% 18%, rgba(107,42,240,.10), transparent 62%),
    radial-gradient(700px 520px at 92% 88%, rgba(163,230,53,.14), transparent 60%),
    linear-gradient(135deg,#FBFAFF 0%,#F3EFFF 100%);
  -webkit-font-smoothing:antialiased;
}
.plocha{position:relative;width:1200px;height:860px;display:flex;align-items:center;gap:86px;padding:0 84px}

/* ---------- telefon ---------- */
.telefon{position:relative;flex:0 0 auto;width:398px;height:728px;border-radius:62px;
  background:linear-gradient(160deg,#322B4A,#191427);padding:11px;
  box-shadow:0 48px 90px -28px rgba(42,24,92,.55), 0 0 0 1px rgba(255,255,255,.06) inset}
.sklo{position:relative;width:100%;height:100%;border-radius:52px;overflow:hidden;background:#fff;
  display:flex;flex-direction:column}
.vyrez{position:absolute;top:10px;left:50%;transform:translateX(-50%);width:108px;height:28px;
  border-radius:16px;background:#14101F;z-index:9}

/* stavový řádek */
.stav{display:flex;align-items:center;justify-content:space-between;padding:16px 26px 6px;
  font-size:14px;font-weight:600;color:#fff;background:var(--fialova);position:relative;z-index:8}
.stav .ikonky{display:flex;align-items:center;gap:6px}

/* hlavička portálu */
.hlava{display:flex;align-items:center;justify-content:space-between;padding:10px 22px 16px;
  background:var(--fialova);color:#fff}
.znacka{font-size:19px;font-weight:700;letter-spacing:.2px}
.znacka em{font-style:normal;color:var(--zelena)}
.ekv{display:flex;align-items:flex-end;gap:3px;height:20px}
.ekv i{display:block;width:4px;border-radius:2px;background:var(--zelena)}

/* obsah stránky */
.obsah{flex:1;padding:16px;display:flex;flex-direction:column;gap:11px;background:#fff;overflow:hidden}
.karta{border:1px solid var(--linka);border-radius:14px;padding:13px 14px;background:#fff;
  box-shadow:0 1px 2px rgba(26,22,37,.04)}
.karta .nad{display:flex;align-items:center;gap:7px;margin-bottom:9px}
.karta .nazev{height:9px;border-radius:5px;background:#CFC6EA}
.karta .stitek{height:17px;border-radius:999px;background:#E8F7EE;flex:0 0 auto;width:58px}
.karta .radek{height:7px;border-radius:4px;background:#EAE6F6;margin-top:6px}
.kol{width:19px;height:19px;border-radius:50%;background:var(--fialova-tmava);color:#fff;
  font-size:10px;font-weight:700;display:grid;place-items:center;flex:0 0 auto}

/* spodní lišta prohlížeče */
.lista{background:#F2F0F7;border-top:1px solid #E2DEEE;padding:12px 20px 20px;
  display:flex;align-items:center;gap:10px}
.adresa{flex:1;height:40px;border-radius:20px;background:#fff;display:flex;align-items:center;
  justify-content:center;gap:7px;font-size:15px;color:var(--ink);
  box-shadow:0 1px 3px rgba(26,22,37,.10)}
.btn-ikona{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;flex:0 0 auto}
.domu{height:5px;width:132px;border-radius:3px;background:#1A1625;opacity:.75;margin:0 auto}

/* zvýraznění */
.zvyraznit{position:relative}
.zvyraznit::after{content:'';position:absolute;inset:-9px -10px;border-radius:18px;
  border:3px solid var(--fialova);box-shadow:0 0 0 7px rgba(107,42,240,.16);pointer-events:none}
.zvyraznit.kulate::after{inset:-7px;border-radius:50%}

/* ---------- text vpravo ---------- */
.popis{flex:1;min-width:0;padding-top:4px}
.krok{display:inline-flex;align-items:center;gap:9px;background:rgba(107,42,240,.10);
  color:var(--fialova);border-radius:999px;padding:6px 14px 6px 7px;font-size:13px;font-weight:600;
  letter-spacing:.3px;margin-bottom:20px}
.krok.bezcisla{padding:7px 16px}
.krok b{width:22px;height:22px;border-radius:50%;background:var(--fialova);color:#fff;
  display:grid;place-items:center;font-size:12px}
.popis h1{font-size:43px;line-height:1.14;font-weight:700;letter-spacing:-.4px;margin-bottom:20px}
.popis p{font-size:19.5px;line-height:1.62;color:var(--seda);max-width:30ch}
.popis p + p{margin-top:16px}
.popis b{color:var(--ink);font-weight:600}
.tip{display:flex;gap:12px;align-items:flex-start;margin-top:28px;padding:16px 18px;border-radius:16px;
  background:rgba(255,255,255,.72);border:1px solid var(--linka);max-width:30rem;
  box-shadow:0 10px 26px -18px rgba(42,24,92,.45)}
.tip span{font-size:16px;line-height:1.55;color:var(--seda)}
.tip .zn{flex:0 0 auto;width:26px;height:26px;border-radius:9px;background:var(--zelena);
  display:grid;place-items:center;margin-top:1px}

/* ---------- iOS list ---------- */
.zaclona{position:absolute;inset:0;background:rgba(20,16,31,.34);z-index:5}
.sheet{position:absolute;left:0;right:0;bottom:0;background:#F4F2F7;border-radius:26px 26px 52px 52px;
  padding:10px 12px 16px;z-index:6;box-shadow:0 -18px 44px rgba(20,16,31,.22)}
.grabber{width:40px;height:5px;border-radius:3px;background:#C9C5D6;margin:4px auto 12px}
.sdilet-hlava{display:flex;align-items:center;gap:11px;background:#fff;border-radius:14px;
  padding:11px 13px;margin-bottom:12px}
.sdilet-hlava .fav{width:38px;height:38px;border-radius:10px;background:var(--fialova);
  display:grid;place-items:center;flex:0 0 auto}
.sdilet-hlava .txt{min-width:0}
.sdilet-hlava .t1{font-size:14.5px;font-weight:600}
.sdilet-hlava .t2{font-size:12.5px;color:var(--seda)}
.appky{display:flex;gap:16px;padding:2px 4px 14px}
.appky div{text-align:center;font-size:10.5px;color:var(--seda);width:56px}
.appky .dlazdice{width:52px;height:52px;border-radius:14px;margin:0 auto 5px;display:grid;place-items:center}
.seznam{background:#fff;border-radius:14px}
.polozka{display:flex;align-items:center;justify-content:space-between;padding:14px 15px;
  font-size:15.5px;border-top:1px solid #ECEAF2}
.polozka:first-child{border-top:0;border-radius:14px 14px 0 0}
.polozka:last-child{border-radius:0 0 14px 14px}
.polozka.aktivni{background:#F6F1FF;border-radius:12px}

/* ---------- Android menu ---------- */
.menu{position:absolute;right:14px;bottom:86px;width:238px;background:#fff;border-radius:16px;
  padding:8px;z-index:6;box-shadow:0 22px 48px rgba(20,16,31,.26);border:1px solid #ECEAF2}
.menu .polozka{border-top:0;padding:12px 12px;font-size:14.5px;gap:13px;justify-content:flex-start;
  border-radius:11px}
.menu .polozka.aktivni{background:#F3ECFF}

/* ---------- plocha telefonu ---------- */
.sklo{box-shadow:0 0 0 1px rgba(255,255,255,.07) inset}
.plocha-tel .zvyraznit::after{border-color:#C9B3FF;box-shadow:0 0 0 8px rgba(201,179,255,.20)}
.stav.tmavy{background:transparent}
.sklo.plocha-tel{background:
  radial-gradient(520px 420px at 30% 18%, #6B2AF0 0%, transparent 60%),
  linear-gradient(165deg,#2B2246 0%,#15111F 100%)}
.mrizka{flex:1;display:grid;grid-template-columns:repeat(4,1fr);gap:20px 10px;
  padding:34px 20px 0;align-content:start}
.appka{text-align:center}
.appka .ctverec{width:60px;height:60px;border-radius:17px;margin:0 auto 7px;
  background:linear-gradient(160deg,#4B4166,#39314F)}
.appka .jmeno{font-size:10.5px;color:rgba(255,255,255,.82)}
.appka.nase .ctverec{background:linear-gradient(160deg,#7B3FF2,#4A15B5);display:grid;place-items:center;
  box-shadow:0 10px 22px -8px rgba(107,42,240,.9)}
.dok{margin:auto 16px 16px;height:84px;border-radius:26px;background:rgba(255,255,255,.14);
  display:flex;align-items:center;justify-content:space-around;padding:0 14px}
.dok i{display:block;width:56px;height:56px;border-radius:16px;background:rgba(255,255,255,.18)}

/* ---------- QR ---------- */
.qr-karta{flex:0 0 auto;width:398px;height:398px;border-radius:38px;background:#fff;
  border:1px solid var(--linka);display:grid;place-items:center;
  box-shadow:0 40px 80px -30px rgba(42,24,92,.5)}
.qr-obal{text-align:center}
.qr-adresa{margin-top:20px;font-size:19px;font-weight:700;color:var(--fialova);text-align:center}
"""

def ekv(barva='var(--zelena)', vysky=(8, 14, 20, 11, 16)):
    return '<div class="ekv">' + ''.join(
        f'<i style="height:{v}px;background:{barva}"></i>' for v in vysky) + '</div>'


def ikona(cesta, velikost=22, barva='#1A1625', sirka=1.9, vypln='none'):
    return (f'<svg width="{velikost}" height="{velikost}" viewBox="0 0 24 24" fill="{vypln}" '
            f'stroke="{barva}" stroke-width="{sirka}" stroke-linecap="round" '
            f'stroke-linejoin="round">{cesta}</svg>')


I_SDILET = '<path d="M12 15V3"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>'
I_PLUS_CTVEREC = '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8.5v7M8.5 12h7"/>'
I_KOPIROVAT = '<rect x="9" y="9" width="12" height="12" rx="3"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>'
I_ZALOZKA = '<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z"/>'
I_LUPA = '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>'
I_TECKY = '<circle cx="12" cy="5" r="1.6" fill="#1A1625" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="#1A1625" stroke="none"/><circle cx="12" cy="19" r="1.6" fill="#1A1625" stroke="none"/>'
I_PLUS = '<path d="M12 5v14M5 12h14"/>'
I_HODINY = '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>'
I_STAHNOUT = '<path d="M12 3v12"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M4 19h16"/>'
I_HVEZDA = '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/>'
I_INSTALOVAT = '<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M12 7.5v7"/><path d="M9.2 11.8L12 14.6l2.8-2.8"/>'
I_SIPKA_VLEVO = '<path d="M15 5l-7 7 7 7"/>'
I_SIPKA_VPRAVO = '<path d="M9 5l7 7-7 7"/>'
I_KARTY = '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8 3.5v17"/>'
I_ZAMEK = '<rect x="4.5" y="10" width="15" height="10.5" rx="3"/><path d="M8.5 10V7.3a3.5 3.5 0 0 1 7 0V10"/>'
I_FAJFKA = '<path d="M5 12.5l4.5 4.5L19 7.5"/>'


def stav_radek():
    return f"""<div class="stav">
      <span>9:41</span>
      <span class="ikonky">
        {ekv('rgba(255,255,255,.95)', (6, 9, 12, 15))}
        {ikona('<path d="M2 8.5a16 16 0 0 1 20 0"/><path d="M5.5 12.5a11 11 0 0 1 13 0"/><path d="M9 16.5a6 6 0 0 1 6 0"/><circle cx="12" cy="20" r="1" fill="#fff" stroke="none"/>', 15, '#fff', 2)}
        {ikona('<rect x="2" y="7" width="17" height="10" rx="3" fill="#fff" stroke="#fff"/><path d="M21 11v2" stroke="#fff"/>', 17, '#fff', 1.6)}
      </span>
    </div>"""


def hlavicka():
    return f"""<div class="hlava">
      <span class="znacka">MS <em>portal</em></span>
      {ekv()}
    </div>"""


def karty(pocet=4, sirky=(120, 92, 136, 104)):
    kusy = []
    for i in range(pocet):
        kol = '<span class="kol">2</span>' if i == 1 else ''
        kusy.append(f"""<div class="karta">
          <div class="nad"><div class="nazev" style="width:{sirky[i % len(sirky)]}px"></div>{kol}
            <div class="stitek" style="margin-left:auto"></div></div>
          <div class="radek" style="width:78%"></div>
          <div class="radek" style="width:54%"></div>
        </div>""")
    return '<div class="obsah">' + ''.join(kusy) + '</div>'


def popis(cislo, nadpis, odstavce, tip=None, stitek=None):
    p = ''.join(f'<p>{o}</p>' for o in odstavce)
    t = ''
    if tip:
        t = f"""<div class="tip"><span class="zn">{ikona(I_FAJFKA, 15, '#1A1625', 2.6)}</span><span>{tip}</span></div>"""
    if cislo:
        chip = f'<span class="krok"><b>{cislo}</b> KROK {cislo}</span>'
    else:
        chip = f'<span class="krok bezcisla">{stitek or ""}</span>'
    return f"""<div class="popis">{chip}
      <h1>{nadpis}</h1>{p}{t}
    </div>"""


def lista_safari(zvyraznit_sdileni=True):
    tr = ' zvyraznit' if zvyraznit_sdileni else ''
    return f"""<div class="lista">
      <span class="btn-ikona">{ikona(I_SIPKA_VLEVO, 21, '#7A768A')}</span>
      <span class="btn-ikona">{ikona(I_SIPKA_VPRAVO, 21, '#C9C5D6')}</span>
      <span class="adresa">{ikona(I_ZAMEK, 13, '#7A768A', 2.2)} msportal.cz</span>
      <span class="btn-ikona{tr}">{ikona(I_SDILET, 22, '#6B2AF0', 2.1)}</span>
      <span class="btn-ikona">{ikona(I_KARTY, 21, '#7A768A')}</span>
    </div>"""


def telefon(vnitrek, extra=''):
    return f"""<div class="telefon"><div class="sklo">{vnitrek}</div>{extra}</div>"""


def stranka(telo):
    return f"""<!doctype html><html lang="cs"><head><meta charset="utf-8">
    <style>{STYL}</style></head><body><div class="plocha">{telo}</div></body></html>"""


# ---------------------------------------------------------------- scény
def scena_safari():
    tel = telefon(stav_radek() + hlavicka() + karty(6) + lista_safari())
    return stranka(tel + popis(1, 'Otevřete portál<br>v Safari', [
        'Na iPhonu to musí být <b>Safari</b> — v jiném prohlížeči se portál na plochu přidat nedá.',
        'Dole na liště klepněte na <b>značku sdílení</b>, čtvereček se šipkou nahoru.',
    ]))


def scena_ios_sheet():
    radky = [
        ('Kopírovat', I_KOPIROVAT, False),
        ('Přidat na plochu', I_PLUS_CTVEREC, True),
        ('Přidat záložku', I_ZALOZKA, False),
        ('Najít na stránce', I_LUPA, False),
    ]
    polozky = ''.join(
        f'<div class="polozka{" aktivni zvyraznit" if akt else ""}"><span>{t}</span>'
        f'{ikona(i, 21, "#6B2AF0" if akt else "#55506B", 2.0)}</div>'
        for t, i, akt in radky)
    sheet = f"""<div class="zaclona"></div><div class="sheet">
      <div class="grabber"></div>
      <div class="sdilet-hlava">
        <span class="fav">{ekv('var(--zelena)', (6, 10, 14, 8))}</span>
        <span class="txt"><div class="t1">MS portal</div><div class="t2">msportal.cz</div></span>
      </div>
      <div class="appky">
        <div><div class="dlazdice" style="background:#34C759">{ikona('<path d="M4 7.5h16v11H4z" fill="#fff" stroke="#fff"/><path d="M4 7.5l8 6 8-6" stroke="#34C759" stroke-width="2"/>', 24, '#fff', 2)}</div>Zprávy</div>
        <div><div class="dlazdice" style="background:#2F7CF6">{ikona('<rect x="3" y="5.5" width="18" height="13" rx="3" fill="#fff" stroke="#fff"/><path d="M4 7l8 6 8-6" stroke="#2F7CF6" stroke-width="2"/>', 24, '#fff', 2)}</div>Mail</div>
        <div><div class="dlazdice" style="background:#E9E7F0">{ikona('<circle cx="12" cy="12" r="3.2"/><path d="M12 5.5a6.5 6.5 0 0 1 6.5 6.5M12 18.5A6.5 6.5 0 0 1 5.5 12"/>', 24, '#2F7CF6', 2.1)}</div>AirDrop</div>
      </div>
      <div class="seznam">{polozky}</div>
    </div>"""
    tel = telefon(stav_radek() + hlavicka() + karty(2) + sheet)
    return stranka(tel + popis(2, 'Přidat na plochu', [
        'V nabídce sjeďte níž a klepněte na <b>Přidat na plochu</b>.',
        'Pak už jen potvrdíte <b>Přidat</b> v pravém horním rohu. Název můžete nechat, jak je.',
    ]))


def scena_android():
    radky = [
        ('Nová karta', I_PLUS, False),
        ('Historie', I_HODINY, False),
        ('Stažené soubory', I_STAHNOUT, False),
        ('Záložky', I_HVEZDA, False),
        ('Instalovat aplikaci', I_INSTALOVAT, True),
    ]
    polozky = ''.join(
        f'<div class="polozka{" aktivni zvyraznit" if akt else ""}">'
        f'{ikona(i, 20, "#6B2AF0" if akt else "#55506B", 2.0)}<span>{t}</span></div>'
        for t, i, akt in radky)
    lista = f"""<div class="lista">
      <span class="adresa">{ikona(I_ZAMEK, 13, '#7A768A', 2.2)} msportal.cz</span>
      <span class="btn-ikona zvyraznit kulate">{ikona(I_TECKY, 20, '#6B2AF0')}</span>
    </div>"""
    menu = f'<div class="menu">{polozky}</div>'
    tel = telefon(stav_radek() + hlavicka() + karty(4) + lista + menu)
    return stranka(tel + popis(3, 'Chrome<br>na Androidu', [
        'Klepněte na <b>tři tečky</b> vpravo dole a vyberte <b>Instalovat aplikaci</b>.',
        'Podle verze Chromu se volba může jmenovat <b>Přidat na plochu</b> — je to totéž.',
    ]))


def scena_plocha():
    appky = []
    for i in range(12):
        if i == 5:
            appky.append(f"""<div class="appka nase zvyraznit"><div class="ctverec">
              {ekv('var(--zelena)', (10, 16, 22, 13, 18))}</div><div class="jmeno">MS portal</div></div>""")
        else:
            appky.append('<div class="appka"><div class="ctverec"></div><div class="jmeno">&nbsp;</div></div>')
    vnitrek = (stav_radek().replace('class="stav"', 'class="stav tmavy"')
               + f'<div class="mrizka">{"".join(appky)}</div>'
               '<div class="dok"><i></i><i></i><i></i><i></i></div>')
    tel = f'<div class="telefon"><div class="sklo plocha-tel">{vnitrek}</div></div>'
    return stranka(tel + popis(4, 'Hotovo', [
        'Na ploše máte fialovou ikonu <b>MS portal</b>. Otevře se na celou obrazovku, bez adresního řádku.',
    ], tip='Zůstanete přihlášení — heslo budete psát jen poprvé nebo po odhlášení.'))


def scena_qr(qr_svg: str):
    karta = f'<div class="qr-karta"><div class="qr-obal">{qr_svg}<div class="qr-adresa">msportal.cz</div></div></div>'
    return stranka(karta + popis(None, 'Naskenujte<br>a jste tam', [
        'Adresu nemusíte do mobilu přepisovat. Namiřte na kód <b>fotoaparát telefonu</b> a klepněte na odkaz, který se objeví.',
    ], stitek='ZAČNĚTE TADY', tip='Na iPhonu musí portál skončit v Safari, jinak volba „Přidat na plochu“ chybí.'))


def qr_svg(data: str, velikost=268) -> str:
    import qrcode
    kod = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=0)
    kod.add_data(data)
    kod.make(fit=True)
    m = kod.get_matrix()
    n = len(m)
    cesty = ''.join(
        f'<rect x="{c}" y="{r}" width="1.04" height="1.04"/>'
        for r, radek in enumerate(m) for c, tmavy in enumerate(radek) if tmavy)
    return (f'<svg width="{velikost}" height="{velikost}" viewBox="0 0 {n} {n}" '
            f'shape-rendering="crispEdges" fill="#1A1625">{cesty}</svg>')


SCENY = [
    ('mobil-qr', scena_qr(qr_svg(ADRESA_PORTALU))),
    ('mobil-ios-1', scena_safari()),
    ('mobil-ios-2', scena_ios_sheet()),
    ('mobil-android', scena_android()),
    ('mobil-hotovo', scena_plocha()),
]

# Konecna velikost obrazku v navodu. Stranka se foti dvakrat vetsi a teprve
# pak se zmensi - text a ikony jsou tim ostrejsi, nez kdyby se kreslily rovnou.
VYSTUP = (1800, 1290)

if __name__ == '__main__':
    print('Kreslím obrázky do', VEN)
    VEN.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        prohlizec = p.chromium.launch()
        stranka_p = prohlizec.new_page(viewport={'width': SIRKA, 'height': VYSKA},
                                       device_scale_factor=2)
        for nazev, html in SCENY:
            stranka_p.set_content(html)
            stranka_p.wait_for_timeout(260)
            syrovy = stranka_p.screenshot()
            obrazek = Image.open(io.BytesIO(syrovy)).convert('RGB').resize(VYSTUP, Image.LANCZOS)
            obrazek.save(VEN / f'{nazev}.jpg', quality=90, optimize=True,
                         progressive=True, subsampling=0)
            print('  ', nazev + '.jpg')
        prohlizec.close()
