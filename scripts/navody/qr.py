"""Minimalni generator QR kodu (byte mode, EC uroven M, verze 1-6).

Vlastni implementace, protoze v kontejneru nejde doinstalovat knihovna.
Vysledek se overuje dekodovanim pres cv2 - bez toho by se to nasazovat nemelo.
"""

# --- GF(256) -----------------------------------------------------------------
EXP = [0] * 512
LOG = [0] * 256
x = 1
for i in range(255):
    EXP[i] = x
    LOG[x] = i
    x <<= 1
    if x & 0x100:
        x ^= 0x11D
for i in range(255, 512):
    EXP[i] = EXP[i - 255]


def gf_mul(a, b):
    if a == 0 or b == 0:
        return 0
    return EXP[LOG[a] + LOG[b]]


def rs_generator(n):
    g = [1]
    for i in range(n):
        g2 = [0] * (len(g) + 1)
        for j, c in enumerate(g):
            g2[j] ^= gf_mul(c, 1)
            g2[j + 1] ^= gf_mul(c, EXP[i])
        g = g2
    return g


def rs_ecc(data, n):
    gen = rs_generator(n)
    rem = list(data) + [0] * n
    for i in range(len(data)):
        coef = rem[i]
        if coef:
            for j, g in enumerate(gen):
                rem[i + j] ^= gf_mul(g, coef)
    return rem[len(data):]


# --- tabulky pro EC uroven M -------------------------------------------------
# verze: (celkem kodovych slov, ecc na blok, [(pocet bloku, datovych slov)])
M_TABLE = {
    1: (26, 10, [(1, 16)]),
    2: (44, 16, [(1, 28)]),
    3: (70, 26, [(1, 44)]),
    4: (100, 18, [(2, 32)]),
    5: (134, 24, [(2, 43)]),
    6: (172, 16, [(4, 27)]),
}
ALIGN = {1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34]}


def vyber_verzi(delka_bajtu):
    for v in sorted(M_TABLE):
        _, ecc, bloky = M_TABLE[v]
        data_slov = sum(p * d for p, d in bloky)
        bitu = 4 + 8 + delka_bajtu * 8
        if bitu <= data_slov * 8:
            return v
    raise ValueError('Text je pro tenhle generator moc dlouhy.')


def kodova_slova(text, verze):
    _, ecc_len, bloky = M_TABLE[verze]
    data_slov = sum(p * d for p, d in bloky)
    data = text.encode('utf-8')

    bits = []

    def pridej(hodnota, pocet):
        for i in range(pocet - 1, -1, -1):
            bits.append((hodnota >> i) & 1)

    pridej(0b0100, 4)          # byte mode
    pridej(len(data), 8)       # pocet znaku (verze 1-9)
    for b in data:
        pridej(b, 8)
    # ukonceni a zarovnani na bajty
    for _ in range(min(4, data_slov * 8 - len(bits))):
        bits.append(0)
    while len(bits) % 8:
        bits.append(0)
    slova = [int(''.join(str(b) for b in bits[i:i + 8]), 2) for i in range(0, len(bits), 8)]
    pad = [0xEC, 0x11]
    i = 0
    while len(slova) < data_slov:
        slova.append(pad[i % 2])
        i += 1

    # rozdeleni do bloku a prokladani
    datove_bloky, ecc_bloky = [], []
    pozice = 0
    for pocet, delka in bloky:
        for _ in range(pocet):
            blok = slova[pozice:pozice + delka]
            pozice += delka
            datove_bloky.append(blok)
            ecc_bloky.append(rs_ecc(blok, ecc_len))

    vysledek = []
    for i in range(max(len(b) for b in datove_bloky)):
        for b in datove_bloky:
            if i < len(b):
                vysledek.append(b[i])
    for i in range(ecc_len):
        for b in ecc_bloky:
            vysledek.append(b[i])
    return vysledek


# --- matice ------------------------------------------------------------------
def prazdna(verze):
    n = verze * 4 + 17
    m = [[None] * n for _ in range(n)]
    return m, n


def vloz_funkcni(m, n, verze):
    def finder(r, c):
        for dr in range(-1, 8):
            for dc in range(-1, 8):
                rr, cc = r + dr, c + dc
                if 0 <= rr < n and 0 <= cc < n:
                    uvnitr = 0 <= dr <= 6 and 0 <= dc <= 6
                    tmava = uvnitr and (
                        dr in (0, 6) or dc in (0, 6) or (2 <= dr <= 4 and 2 <= dc <= 4)
                    )
                    m[rr][cc] = 1 if tmava else 0

    finder(0, 0)
    finder(0, n - 7)
    finder(n - 7, 0)

    for i in range(8, n - 8):
        m[6][i] = 1 if i % 2 == 0 else 0
        m[i][6] = 1 if i % 2 == 0 else 0

    stredy = ALIGN[verze]
    for r in stredy:
        for c in stredy:
            if (r < 8 and c < 8) or (r < 8 and c > n - 9) or (r > n - 9 and c < 8):
                continue
            for dr in range(-2, 3):
                for dc in range(-2, 3):
                    m[r + dr][c + dc] = 1 if max(abs(dr), abs(dc)) != 1 else 0

    m[n - 8][8] = 1  # tmavy modul

    # mista pro format info se jen rezervuji
    for i in range(9):
        if m[8][i] is None:
            m[8][i] = 0
        if m[i][8] is None:
            m[i][8] = 0
    for i in range(8):
        if m[8][n - 1 - i] is None:
            m[8][n - 1 - i] = 0
        if m[n - 1 - i][8] is None:
            m[n - 1 - i][8] = 0


def je_funkcni(verze, n, r, c):
    # stejna pravidla jako vyse, jen jako dotaz
    if r <= 8 and c <= 8:
        return True
    if r <= 8 and c >= n - 8:
        return True
    if r >= n - 8 and c <= 8:
        return True
    if r == 6 or c == 6:
        return True
    stredy = ALIGN[verze]
    for ar in stredy:
        for ac in stredy:
            if (ar < 8 and ac < 8) or (ar < 8 and ac > n - 9) or (ar > n - 9 and ac < 8):
                continue
            if abs(r - ar) <= 2 and abs(c - ac) <= 2:
                return True
    return False


MASKY = [
    lambda r, c: (r + c) % 2 == 0,
    lambda r, c: r % 2 == 0,
    lambda r, c: c % 3 == 0,
    lambda r, c: (r + c) % 3 == 0,
    lambda r, c: (r // 2 + c // 3) % 2 == 0,
    lambda r, c: (r * c) % 2 + (r * c) % 3 == 0,
    lambda r, c: ((r * c) % 2 + (r * c) % 3) % 2 == 0,
    lambda r, c: ((r + c) % 2 + (r * c) % 3) % 2 == 0,
]


def format_bity(maska):
    # EC uroven M = 00
    data = (0b00 << 3) | maska
    zbytek = data << 10
    gen = 0b10100110111
    for i in range(14, 9, -1):
        if zbytek & (1 << i):
            zbytek ^= gen << (i - 10)
    return ((data << 10) | zbytek) ^ 0b101010000010010


def vloz_format(m, n, maska):
    """Umisteni format info podle normy (m[radek][sloupec])."""
    bity = format_bity(maska)
    b = [(bity >> i) & 1 for i in range(15)]
    # prvni kopie - kolem leveho horniho finderu
    for i in range(6):
        m[i][8] = b[i]
    m[7][8] = b[6]
    m[8][8] = b[7]
    m[8][7] = b[8]
    for i in range(9, 15):
        m[8][14 - i] = b[i]
    # druha kopie - vpravo nahore a vlevo dole
    for i in range(8):
        m[8][n - 1 - i] = b[i]
    for i in range(8, 15):
        m[n - 15 + i][8] = b[i]
    m[n - 8][8] = 1


def penalizace(m, n):
    skore = 0
    for radek in list(m) + [list(col) for col in zip(*m)]:
        beh, predchozi = 0, None
        for v in radek:
            if v == predchozi:
                beh += 1
            else:
                if beh >= 5:
                    skore += 3 + (beh - 5)
                beh, predchozi = 1, v
        if beh >= 5:
            skore += 3 + (beh - 5)
    for r in range(n - 1):
        for c in range(n - 1):
            ctverec = {m[r][c], m[r][c + 1], m[r + 1][c], m[r + 1][c + 1]}
            if len(ctverec) == 1:
                skore += 3
    vzor = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0]
    for radek in list(m) + [list(col) for col in zip(*m)]:
        for i in range(n - 10):
            usek = radek[i:i + 11]
            if usek == vzor or usek == vzor[::-1]:
                skore += 40
    tmavych = sum(sum(radek) for radek in m)
    podil = tmavych * 100 // (n * n)
    skore += 10 * (abs(podil - 50) // 5)
    return skore


def qr_matice(text):
    verze = vyber_verzi(len(text.encode('utf-8')))
    slova = kodova_slova(text, verze)
    bity = []
    for s in slova:
        for i in range(7, -1, -1):
            bity.append((s >> i) & 1)

    nejlepsi = None
    for maska in range(8):
        m, n = prazdna(verze)
        vloz_funkcni(m, n, verze)
        index = 0
        smer = -1
        c = n - 1
        while c > 0:
            if c == 6:
                c -= 1
            radky = range(n - 1, -1, -1) if smer == -1 else range(n)
            for r in radky:
                for cc in (c, c - 1):
                    if je_funkcni(verze, n, r, cc):
                        continue
                    bit = bity[index] if index < len(bity) else 0
                    index += 1
                    if MASKY[maska](r, cc):
                        bit ^= 1
                    m[r][cc] = bit
            smer = -smer
            c -= 2
        vloz_format(m, n, maska)
        skore = penalizace(m, n)
        if nejlepsi is None or skore < nejlepsi[0]:
            nejlepsi = (skore, m, n)
    return nejlepsi[1], nejlepsi[2]


def qr_png(text, cesta, modul=12, okraj=4, barva=(32, 26, 51)):
    from PIL import Image

    m, n = qr_matice(text)
    velikost = (n + 2 * okraj) * modul
    img = Image.new('RGB', (velikost, velikost), (255, 255, 255))
    pix = img.load()
    for r in range(n):
        for c in range(n):
            if m[r][c]:
                for dy in range(modul):
                    for dx in range(modul):
                        pix[(c + okraj) * modul + dx, (r + okraj) * modul + dy] = barva
    img.save(cesta)
    return cesta


if __name__ == '__main__':
    import sys

    text = sys.argv[1]
    cesta = sys.argv[2]
    qr_png(text, cesta)
    import cv2

    data, _, _ = cv2.QRCodeDetector().detectAndDecode(cv2.imread(cesta))
    print('ulozeno', cesta)
    print('dekodovano:', repr(data))
    print('SEDI' if data == text else 'NESEDI!')
