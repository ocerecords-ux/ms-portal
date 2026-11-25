import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { smiSpravovatAkce } from '@/lib/akceServer';
import { datumZPrahy, ocistiOtazky, odkazNaMapu, otazkyPoDorazeni, sOtazkouDorazi } from '@/lib/akce';
import { buildPotvrzeniAkceHtml, buildPozvankaAkceHtml, buildPripomenutiAkceHtml } from '@/lib/email';
import { odpovedChyby } from '@/lib/chybyApi';

/**
 * NÁHLED POZVÁNKY (zadání 25. 11. 2026: „chci vidět rovnou grafický náhled
 * toho mailu").
 *
 * Skládá ho TATÁŽ funkce, která mail opravdu posílá (`buildPozvankaAkceHtml`).
 * Kdyby si náhled kreslil vlastní cestou, dřív nebo později by ukazoval něco
 * jiného, než co doopravdy odejde - stejné pravidlo jako u Rodného listu.
 *
 * Nic se neukládá a nikomu nic neodchází; proto se ptá na rozepsané hodnoty
 * z formuláře, ne na to, co je v databázi.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  nazev: z.string().trim().max(200).optional(),
  kdy: z.string().trim().max(40).nullable().optional(),
  misto: z.string().trim().max(300).nullable().optional(),
  text: z.string().trim().max(8000).nullable().optional(),
  odpovedDo: z.string().trim().max(40).nullable().optional(),
  mapa: z.string().trim().max(500).nullable().optional(),
  /** Komu je náhled adresovaný - jen do oslovení. */
  jmeno: z.string().trim().max(200).nullable().optional(),
  /**
   * KTERÝ Z TŘÍ MAILŮ (25. 11. 2026). Pozvánka odchází z tlačítka, potvrzení
   * po vyplnění ankety a připomínka den předem - a pořadatel má vidět
   * všechny tři dřív, než je rozešle.
   */
  typ: z.enum(['pozvanka', 'potvrzeni', 'pripomenuti']).optional(),
  /** Otázky z rozepsané ankety - do ukázkových odpovědí v potvrzení. */
  otazky: z.array(z.record(z.unknown())).max(30).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !(await smiSpravovatAkce(session.user.id))) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return odpovedChyby('chybaApi.neplatnaData', 400);
  const d = parsed.data;

  const spolecne = {
    to: '',
    jmenoPrijemce: d.jmeno || session.user.name || null,
    nazevAkce: d.nazev?.trim() || 'Název akce',
    kdy: datumZPrahy(d.kdy),
    misto: d.misto || null,
    mapa: odkazNaMapu(d.misto ?? null, d.mapa ?? null),
    // V náhledu tlačítko nikam nevede - ať se z něj nedá omylem odpovídat
    // za někoho jiného.
    odkaz: '#',
  };

  /**
   * UKÁZKOVÉ ODPOVĚDI. Potvrzení i připomínka vypisují, co člověk vyplnil;
   * v náhledu nikdo nic nevyplnil, tak se vezme první nabízená možnost -
   * ať je vidět, jak bude tabulka vypadat, a ne prázdný rám.
   */
  const otazky = sOtazkouDorazi(ocistiOtazky(d.otazky ?? []));
  const ukazkove = otazkyPoDorazeni(otazky).map((o) => ({
    otazka: o.text,
    odpoved:
      o.typ === 'ANO_NE'
        ? (o.ano ?? 'Ano')
        : o.typ === 'VYBER'
          ? (o.moznosti ?? []).slice(0, o.vicMoznosti ? 2 : 1).join(', ')
          : '…',
  }));

  const html =
    d.typ === 'potvrzeni'
      ? buildPotvrzeniAkceHtml({ ...spolecne, dorazi: true, odpovedi: ukazkove })
      : d.typ === 'pripomenuti'
        ? buildPripomenutiAkceHtml({ ...spolecne, text: d.text || null, odpovedi: ukazkove })
        : buildPozvankaAkceHtml({
            ...spolecne,
            text: d.text || null,
            odpovedDo: datumZPrahy(d.odpovedDo),
          });

  return NextResponse.json({ html });
}
