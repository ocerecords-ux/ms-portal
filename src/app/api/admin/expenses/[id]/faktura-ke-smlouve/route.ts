import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { parseMoneyToMinor } from '@/lib/doklady';
import { uploadExpenseAttachment } from '@/lib/storage';
import { prepocitejUhradu } from '@/lib/uhradyVydajeServer';

/**
 * DODATEČNÁ FAKTURA KE SMLOUVĚ (zadání 25. 9. 2026: „my vytvoříme herci
 * smlouvu a na základě té smlouvy je platíme. Akorát někteří ještě pošlou
 * dodatečně fakturu. Hlavně plátci DPH, protože ho tam musí logicky
 * připočítat. Na smlouvě je částka bez DPH. Já tam pak potřebuji mít dvě
 * přílohy u toho nákladu v těch výdajích. Ale potřebuji, ať se počítá jeden
 * a ať vím, že mám zaplatit ten s DPH").
 *
 * PRAVIDLO: náklad je jeden doklad. Smlouva ho založila, faktura ho jen
 * upřesní - připojí se jako další příloha a doklad převezme částku, sazbu,
 * číslo a splatnost z faktury. Tím se do přehledů i do QR platby dostane
 * částka S DPH a nikde nevznikne druhý náklad na tytéž peníze.
 *
 * DVĚ CESTY, JEDEN VÝSLEDEK:
 * - `{ zdrojId }` - faktura už v portálu je (přišla na účtárnu a leží mezi
 *   nezařazenými). Přílohy i údaje se přestěhují ke smlouvě a duplicitní
 *   doklad zmizí.
 * - FormData se souborem - fakturu má člověk v ruce a nahraje ji rovnou.
 *
 * DELETE vrací fakturu zpět jen jako značku (číslo a datum) - přílohy ani
 * částku nevrací, na to je ruční úprava dokladu.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Částka se u výdaje zadává bez DPH - stejně jako v editoru dokladu. */
function castkaZTextu(text: string | null): number | null {
  if (!text) return null;
  const minor = parseMoneyToMinor(text.replace(/Kč/i, ''));
  return Number.isFinite(minor) ? minor : null;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  try {
    const cil = await prisma.expense.findUnique({
      where: { id: params.id },
      select: { id: true, number: true, note: true, attachmentUrl: true, currency: true },
    });
    if (!cil) return NextResponse.json({ error: 'Doklad nenalezen.' }, { status: 404 });

    const typ = req.headers.get('content-type') ?? '';

    /* ---------- 1. Faktura, která už v portálu leží jako vlastní doklad ---------- */
    if (typ.includes('application/json')) {
      const telo = (await req.json().catch(() => null)) as { zdrojId?: string } | null;
      const zdrojId = telo?.zdrojId?.trim();
      if (!zdrojId) return NextResponse.json({ error: 'Chybí doklad s fakturou.' }, { status: 400 });
      if (zdrojId === cil.id) {
        return NextResponse.json({ error: 'Doklad nejde spojit sám se sebou.' }, { status: 400 });
      }

      const zdroj = await prisma.expense.findUnique({
        where: { id: zdrojId },
        select: {
          id: true,
          number: true,
          amountExVatMinor: true,
          vatRate: true,
          currency: true,
          issueDate: true,
          dueDate: true,
          supplierAccount: true,
          attachmentUrl: true,
          attachmentName: true,
          prilohy: { select: { id: true } },
          uhrady: { select: { id: true } },
        },
      });
      if (!zdroj) return NextResponse.json({ error: 'Doklad s fakturou nenalezen.' }, { status: 404 });
      if (zdroj.uhrady.length > 0) {
        return NextResponse.json(
          { error: 'Na faktuře jsou zapsané úhrady — nejdřív je přepište ke smlouvě, pak doklady spojte.' },
          { status: 409 },
        );
      }

      await prisma.$transaction(async (tx) => {
        // Příloha faktury jde ke smlouvě jako další příloha - hlavní zůstává
        // smlouva, protože ta je podklad, na který se doklad odvolává.
        if (zdroj.attachmentUrl) {
          await tx.prilohaVydaje.create({
            data: {
              expenseId: cil.id,
              url: zdroj.attachmentUrl,
              nazev: zdroj.attachmentName || `Faktura ${zdroj.number ?? ''}`.trim(),
            },
          });
        }
        if (zdroj.prilohy.length > 0) {
          await tx.prilohaVydaje.updateMany({
            where: { expenseId: zdroj.id },
            data: { expenseId: cil.id },
          });
        }

        await tx.expense.update({
          where: { id: cil.id },
          data: {
            // Peníze i daň teď říká faktura - podle ní se platí.
            amountExVatMinor: zdroj.amountExVatMinor,
            vatRate: zdroj.vatRate,
            currency: zdroj.currency,
            number: zdroj.number ?? cil.number,
            issueDate: zdroj.issueDate,
            dueDate: zdroj.dueDate,
            supplierAccount: zdroj.supplierAccount ?? undefined,
            fakturaCislo: zdroj.number ?? null,
            fakturaAt: new Date(),
            stav: 'ZARAZENY',
            note: [cil.note, `Faktura ${zdroj.number ?? ''} připojena ke smlouvě.`.replace('  ', ' ')]
              .filter(Boolean)
              .join('\n'),
          },
        });

        // Duplicitní doklad končí - jinak by tentýž náklad v přehledech
        // figuroval dvakrát, což je přesně to, čemu se tím předchází.
        await tx.expense.delete({ where: { id: zdroj.id } });
      });

      await prepocitejUhradu(cil.id);
      return NextResponse.json({ ok: true });
    }

    /* ---------- 2. Fakturu nahrává člověk ze svého ---------- */
    const formData = await req.formData();
    const soubory = formData.getAll('soubor').filter((f): f is File => f instanceof File && f.size > 0);
    const cislo = String(formData.get('cislo') ?? '').trim();
    const castka = castkaZTextu(String(formData.get('castka') ?? '').trim() || null);
    const sazba = Number.parseInt(String(formData.get('sazba') ?? ''), 10);
    const splatnost = String(formData.get('splatnost') ?? '').trim();

    if (soubory.length === 0 && !cislo && castka === null) {
      return NextResponse.json({ error: 'Chybí faktura.' }, { status: 400 });
    }

    let maHlavni = Boolean(cil.attachmentUrl);
    for (const soubor of soubory) {
      const vysledek = await uploadExpenseAttachment(soubor);
      if (!vysledek) return NextResponse.json({ error: 'Soubor se nepodařilo uložit.' }, { status: 500 });
      if ('error' in vysledek) return NextResponse.json({ error: vysledek.error }, { status: 400 });

      if (!maHlavni) {
        await prisma.expense.update({
          where: { id: cil.id },
          data: { attachmentUrl: vysledek.url, attachmentName: vysledek.name },
        });
        maHlavni = true;
      } else {
        await prisma.prilohaVydaje.create({
          data: { expenseId: cil.id, url: vysledek.url, nazev: vysledek.name },
        });
      }
    }

    await prisma.expense.update({
      where: { id: cil.id },
      data: {
        ...(castka !== null ? { amountExVatMinor: castka } : {}),
        ...(Number.isFinite(sazba) && sazba >= 0 && sazba <= 100 ? { vatRate: sazba } : {}),
        ...(cislo ? { number: cislo } : {}),
        ...(splatnost ? { dueDate: new Date(`${splatnost}T00:00:00`) } : {}),
        fakturaCislo: cislo || null,
        fakturaAt: new Date(),
        stav: 'ZARAZENY',
      },
    });

    await prepocitejUhradu(cil.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/admin/expenses/[id]/faktura-ke-smlouve selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Fakturu se nepodařilo připojit (${message}).` }, { status: 500 });
  }
}

/** Odznak faktury pryč - doklad zůstane, jen se přestane tvářit, že faktura dorazila. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  try {
    await prisma.expense.update({
      where: { id: params.id },
      data: { fakturaCislo: null, fakturaAt: null },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/admin/expenses/[id]/faktura-ke-smlouve selhalo:', err);
    return NextResponse.json({ error: 'Značku se nepodařilo zrušit.' }, { status: 500 });
  }
}
