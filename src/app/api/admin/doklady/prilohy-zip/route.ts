import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { klicZAdresyUloziste, podepsanyOdkazNaPrilohu } from '@/lib/storage';
import { pdfFaktury } from '@/lib/dokladNahledServer';
import { hlavickyZipu, zipStream, type PolozkaZipu } from '@/lib/zip';

/**
 * PŘÍLOHY DOKLADŮ ZA MĚSÍC V JEDNOM ZIPU (zadání 16. 9. 2026: „potřebuji ještě
 * mít u Výdajů a faktur tlačítko, kdy můžu stáhnout kompletní přílohy dokladů
 * za minulý měsíc").
 *
 * Účetní chce jednou za měsíc balík, ne dvacet kliknutí. Archiv se skládá za
 * běhu a rovnou streamuje ven (viz lib/zip.ts), takže se nikde nedrží v paměti.
 *
 * CO SE BALÍ, SE LIŠÍ PODLE DRUHU:
 * - Výdaje: naskenované doklady, které k nim někdo přiložil. Doklad bez
 *   přílohy se do archivu nedostane a je vidět v odpovědi na probe.
 * - Faktury: PDF, které jsme vystavili. Žádná „příloha" u nich není - vykreslí
 *   se tímtéž kódem jako při odeslání klientovi, takže v archivu je přesně to,
 *   co klient dostal.
 *
 * Rozhoduje DATUM VYSTAVENÍ, ne datum vzniku záznamu: doklad zadaný v říjnu
 * se zářijovým datem patří do září, protože tak ho zaúčtuje účetní.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Balík za měsíc může mít desítky souborů - výchozích 10 s nestačí.
export const maxDuration = 300;

const MESICE = [
  'leden', 'únor', 'březen', 'duben', 'květen', 'červen',
  'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec',
];

/** Rozsah měsíce v místním čase. `mesic` je YYYY-MM. */
function rozsahMesice(mesic: string): { od: Date; do: Date; popis: string } | null {
  const shoda = /^(\d{4})-(\d{2})$/.exec(mesic);
  if (!shoda) return null;
  const rok = Number(shoda[1]);
  const m = Number(shoda[2]);
  if (m < 1 || m > 12) return null;
  return {
    od: new Date(rok, m - 1, 1, 0, 0, 0, 0),
    do: new Date(rok, m, 1, 0, 0, 0, 0),
    popis: `${MESICE[m - 1]} ${rok}`,
  };
}

/** Název souboru bez znaků, které rozbíjejí cesty. */
function bezpecny(text: string): string {
  return text.replace(/[/\\:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim() || 'doklad';
}

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const druh = req.nextUrl.searchParams.get('druh') === 'faktury' ? 'faktury' : 'vydaje';
  const rozsah = rozsahMesice(req.nextUrl.searchParams.get('mesic') ?? '');
  if (!rozsah) {
    return NextResponse.json({ error: 'Chybí měsíc ve tvaru RRRR-MM.' }, { status: 400 });
  }

  const kdy = { gte: rozsah.od, lt: rozsah.do };
  const polozky: PolozkaZipu[] = [];
  /** Doklady, ke kterým žádný soubor není - vypíšou se, ať se po nich dá jít. */
  const bezPrilohy: string[] = [];

  if (druh === 'vydaje') {
    const vydaje = await prisma.expense.findMany({
      where: { issueDate: kdy },
      orderBy: [{ issueDate: 'asc' }, { number: 'asc' }],
      select: {
        id: true,
        number: true,
        description: true,
        issueDate: true,
        attachmentUrl: true,
        attachmentName: true,
      },
    });

    for (const v of vydaje) {
      const popis = bezpecny(
        [v.issueDate.toISOString().slice(0, 10), v.number || null, v.description || null]
          .filter(Boolean)
          .join(' '),
      );
      if (!v.attachmentUrl) {
        bezPrilohy.push(v.number || v.description || v.id);
        continue;
      }
      const pripona = (v.attachmentName || '').includes('.')
        ? `.${(v.attachmentName || '').split('.').pop()}`
        : '';

      polozky.push({
        nazev: `${popis}${pripona}`,
        datum: v.issueDate,
        nacti: async () => nactiPrilohu(v.attachmentUrl!, v.attachmentName || 'priloha'),
      });
    }
  } else {
    const faktury = await prisma.invoice.findMany({
      where: { issueDate: kdy, status: { not: 'CANCELLED' } },
      orderBy: [{ issueDate: 'asc' }, { number: 'asc' }],
      select: { id: true, number: true, issueDate: true, subject: true },
    });

    for (const f of faktury) {
      polozky.push({
        nazev: `${bezpecny(`${f.number} ${f.subject || ''}`)}.pdf`,
        datum: f.issueDate,
        nacti: async () => {
          const vysledek = await pdfFaktury(f.id);
          if (!vysledek.ok) {
            console.error(`ZIP dokladu: fakturu ${f.number} se nepodarilo vykreslit:`, vysledek.message);
            return null;
          }
          return new Uint8Array(vysledek.pdf);
        },
      });
    }
  }

  /**
   * Prohlížeč stahuje ZIP prostým přechodem na tuhle adresu - chybu by pak
   * ukázal jako holý JSON. Tlačítko se proto nejdřív zeptá s probe=1 a teprve
   * když je co stahovat, spustí stahování. Stejně to dělá ZIP z Disku.
   */
  if (req.nextUrl.searchParams.get('probe') === '1') {
    return NextResponse.json({
      ok: polozky.length > 0,
      pocet: polozky.length,
      bezPrilohy: bezPrilohy.length,
      popisMesice: rozsah.popis,
    });
  }

  if (polozky.length === 0) {
    return NextResponse.json(
      {
        error:
          druh === 'vydaje'
            ? `Za ${rozsah.popis} není u výdajů žádná příloha ke stažení.`
            : `Za ${rozsah.popis} nebyla vystavená žádná faktura.`,
      },
      { status: 404 },
    );
  }

  const nazev = `${druh === 'vydaje' ? 'Vydaje' : 'Faktury'} ${req.nextUrl.searchParams.get('mesic')}.zip`;
  return new NextResponse(zipStream(polozky), { headers: hlavickyZipu(nazev) });
}

/**
 * Obsah přílohy výdaje. Starší doklady mají soubor jako data URL rovnou
 * v databázi (než se nastavilo úložiště), novější leží v S3/R2 a sahá se na ně
 * podepsaným odkazem - adresa úložiště bez podpisu vrátí chybu.
 */
async function nactiPrilohu(adresa: string, nazev: string): Promise<Uint8Array | ReadableStream<Uint8Array> | null> {
  if (adresa.startsWith('data:')) {
    const base64 = adresa.split(',', 2)[1] ?? '';
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }

  const klic = klicZAdresyUloziste(adresa);
  const odkaz = klic ? await podepsanyOdkazNaPrilohu(klic, nazev) : adresa;
  if (!odkaz) return null;

  const res = await fetch(odkaz, { cache: 'no-store' });
  if (!res.ok || !res.body) {
    console.error(`ZIP dokladu: prilohu "${nazev}" se nepodarilo stahnout (${res.status}).`);
    return null;
  }
  return res.body;
}
