import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canEditProjectMeta } from '@/lib/roles';
import { textZDocx } from '@/lib/docxText';

/**
 * TEXT ZE SOUBORU (zadání 30. 9. 2026: „bylo by super, kdybych tady mohl
 * k těm výstupům i nahrát a editovat text").
 *
 * PŘEČTE A VRÁTÍ - NEUKLÁDÁ. Text se objeví v políčku u výstupu, kde se dá
 * ještě upravit, a teprve uložení řádku ho zapíše. Nahrání tak nikdy tiše
 * nepřepíše, co už u výstupu bylo napsané.
 *
 * Soubor se nikam neukládá: v paměti se z něj vytáhne text a tím to končí.
 * Scénáře od klientů nemají důvod ležet na disku podruhé.
 */
export const dynamic = 'force-dynamic';

/** Strop nahrávaného souboru. Scénář spotu je pár kilobajtů; tohle je rezerva. */
const MAX_BAJTU = 8 * 1024 * 1024;
/** Kolik znaků si portál nechá - stejný strop jako u uložení výstupu. */
const MAX_ZNAKU = 20_000;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
  if (!canEditProjectMeta(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const formular = await req.formData().catch(() => null);
  const soubor = formular?.get('soubor');
  if (!(soubor instanceof File)) {
    return NextResponse.json({ error: 'Chybí soubor.' }, { status: 400 });
  }
  if (soubor.size > MAX_BAJTU) {
    return NextResponse.json({ error: 'Soubor je moc velký (nejvýš 8 MB).' }, { status: 413 });
  }

  const nazev = soubor.name.toLowerCase();
  const data = Buffer.from(await soubor.arrayBuffer());

  let text: string;

  if (nazev.endsWith('.docx')) {
    const vytazeny = textZDocx(data);
    if (vytazeny === null) {
      return NextResponse.json(
        { error: 'Tenhle .docx se nepodařilo přečíst. Zkuste ho ve Wordu uložit znovu.' },
        { status: 422 },
      );
    }
    text = vytazeny;
  } else if (/\.(txt|md|markdown|text)$/.test(nazev)) {
    text = data.toString('utf8');
  } else if (nazev.endsWith('.doc')) {
    /**
     * Starý binární .doc se bez knihovny přečíst nedá a stálo by to za to jen
     * kvůli souborům z devadesátek. Hláška radí, co s tím - mlčet by bylo
     * horší než říct „tohle ne".
     */
    return NextResponse.json(
      { error: 'Starý formát .doc portál nepřečte — uložte ho ve Wordu jako .docx.' },
      { status: 415 },
    );
  } else if (nazev.endsWith('.pdf')) {
    return NextResponse.json(
      { error: 'PDF portál nepřečte — pošlete text jako .docx nebo ho vložte ze schránky.' },
      { status: 415 },
    );
  } else {
    return NextResponse.json(
      { error: 'Umíme .docx (Word), .txt a .md.' },
      { status: 415 },
    );
  }

  /**
   * BOM z Windows a znaky, které se v textovém poli chovají jako neviditelná
   * mina (nulový znak, měkké zalomení) - pryč hned, ne až v dokumentu.
   */
  const cisty = text
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F­]/g, '')
    .trim()
    .slice(0, MAX_ZNAKU);

  if (!cisty) {
    return NextResponse.json({ error: 'V souboru není žádný text.' }, { status: 422 });
  }

  return NextResponse.json({ text: cisty, nazevSouboru: soubor.name });
}
