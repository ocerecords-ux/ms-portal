"""Kartička k vytištění: jak si dát kalendář rezervací studia do telefonu.

    python3 scripts/navody/install-pdf.py

Vyrobí QR kód (public/navody/studio-booking-qr.png) a z předlohy
studio-booking-install.html vysází A4 do public/navody/studio-booking-install.pdf.

QR se po vygenerování ZKONTROLUJE zpětným přečtením - kartička s kódem, který
se nenačte, je horší než žádná.
"""
import os
import sys

KOREN = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ADRESA = 'https://www.msportal.cz/studio'

sys.path.insert(0, os.path.join(KOREN, 'scripts', 'navody'))
from qr import qr_png  # noqa: E402

qr_cesta = os.path.join(KOREN, 'public', 'navody', 'studio-booking-qr.png')
qr_png(ADRESA, qr_cesta, modul=16, okraj=3)

try:
    import cv2

    precteno, _, _ = cv2.QRCodeDetector().detectAndDecode(cv2.imread(qr_cesta))
    if precteno != ADRESA:
        raise SystemExit(f'QR kód se nepřečetl správně: {precteno!r}')
    print('QR ověřen:', precteno)
except ImportError:
    print('Varování: cv2 chybí, QR kód se neověřil.')

from playwright.sync_api import sync_playwright  # noqa: E402

predloha = 'file://' + os.path.join(KOREN, 'scripts', 'navody', 'studio-booking-install.html')
vystup = os.path.join(KOREN, 'public', 'navody', 'studio-booking-install.pdf')
prohlizec = os.environ.get('CHROMIUM_PATH')

with sync_playwright() as p:
    b = p.chromium.launch(**({'executable_path': prohlizec} if prohlizec else {}))
    stranka = b.new_page()
    stranka.goto(predloha, wait_until='load')
    # page_ranges='1': obsah je přesně na jednu A4, druhá strana by byla prázdná.
    stranka.pdf(
        path=vystup,
        format='A4',
        print_background=True,
        page_ranges='1',
        margin={'top': '0', 'right': '0', 'bottom': '0', 'left': '0'},
    )
    b.close()

print('uloženo', vystup)
