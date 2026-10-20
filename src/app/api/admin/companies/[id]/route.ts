import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { vychoziNotifikaceReklamy } from '@/lib/notifikaceReklamyServer';
import { requireAdmin } from '@/lib/adminGuard';
import { popisPrekazek, prekazkyFirmy } from '@/lib/mazani';
import { jeZpusobSmazani } from '@/lib/archiv';
import { odstranFirmu } from '@/lib/archivServer';

// Editace firmy. Typ (Klient/Dodavatel) se po zalozeni uz nemeni.
//
// Od 6. 9. 2026 vede karta firmy fakturacni udaje u OBOU typu (IC, DIC,
// platce DPH, adresa po castech, splatnost) - drive je mel jen dodavatel.
// Sazba za normostranu je nove nepovinna a dava smysl jen u klienta, ktery
// ma zaskrtnute Audioknihy.
const schema = z.object({
  type: z.enum(['KLIENT', 'DODAVATEL']),
  name: z.string().trim().min(1, 'Název firmy je povinný.'),

  ic: z.string().trim().optional(),
  dic: z.string().trim().optional(),
  vatPayer: z.boolean().optional(),
  bankAccount: z.string().trim().optional(),
  addressStreet: z.string().trim().optional(),
  addressCity: z.string().trim().optional(),
  addressZip: z.string().trim().optional(),
  addressCountry: z.string().trim().max(2).optional(),
  paymentTermDays: z.string().trim().optional(),

  contactName: z.string().trim().optional(),
  contactEmail: z.string().trim().optional(),
  fakturyKlientovi: z.boolean().optional(),
  contactPhone: z.string().trim().optional(),

  ratePerPage: z.string().trim().optional(),
  driveFolderUrl: z.string().trim().optional(),
  dealsAudiobooks: z.boolean().optional(),
  audioknihyNaKlic: z.boolean().optional(),
  cenuUrcujeKlient: z.boolean().optional(),
  fakturujeNaCasti: z.boolean().optional(),
  hudbuDodavaKlient: z.boolean().optional(),
  /** Kdo si u téhle firmy chodí režírovat (12. 10. 2026) - účet, nebo nic. */
  rezieKlientaUserId: z.string().trim().max(100).nullable().optional(),
  /** Pod kterou naši firmu klient patří (12. 10. 2026) - viz lib/naseFirmy.ts. */
  vydavatelId: z.string().trim().max(100).nullable().optional(),
  /** Tagování finálních nahrávek (14. 10. 2026) - záložka Tagy u projektů. */
  tagyPovoleny: z.boolean().optional(),
  /** Výchozí vydavatel do tagů (14. 10. 2026) - u Albatrosu „Voxi". */
  tagyVydavatel: z.string().trim().max(120).optional(),
  /** Měna klienta (12. 10. 2026) - sazba za normostranu a předběžná cena. */
  mena: z.enum(['CZK', 'EUR', 'USD', 'GBP']).optional(),
  /** Kam posílat cenové nabídky (12. 10. 2026) - prázdné pole = jako dosud. */
  nabidkyEmaily: z.array(z.string().trim().max(200)).max(20).optional(),
  /** Kam posílat faktury (20. 10. 2026) - prázdné pole = kontakt firmy. */
  fakturyEmaily: z.array(z.string().trim().max(200)).max(20).optional(),
  dealsAds: z.boolean().optional(),
  active: z.boolean().optional(),
});

function toIntOrNull(v?: string): number | null {
  if (v === undefined || v === '') return null;
  const n = parseInt(String(v).replace(/\s/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const data = parsed.data;

    /**
     * „HUDBU DODÁVÁ KLIENT" PLATÍ AŽ OD ZAPNUTÍ (zadání 17. 10. 2026: „když
     * teď zaškrtnu u firmy, že klient dodává hudbu, tak aby nešly zpětně na
     * klienta nějaké notifikace. Ať to platí až od teď").
     *
     * Okamžik zapnutí se zapíše a úloha na pozadí pak posílá výzvy jen
     * k projektům, které vznikly potom - rozdělané zakázky dobíhají po staru.
     * Bez toho by se hned druhé ráno rozeslaly maily ke všemu, co má za pár
     * dní první frekvenci. Viz lib/hudbaOdKlienta.ts.
     */
    let hudbaKlientOd: Date | null | undefined;
    if (data.hudbuDodavaKlient !== undefined) {
      const pred = (await prisma.company
        .findUnique({ where: { id: params.id }, select: { hudbuDodavaKlient: true } })
        .catch(() => null)) as { hudbuDodavaKlient: boolean } | null;
      if (data.hudbuDodavaKlient && !pred?.hudbuDodavaKlient) hudbaKlientOd = new Date();
      // Vypnutím značka mizí - při dalším zapnutí se počítá znovu od té chvíle.
      if (!data.hudbuDodavaKlient) hudbaKlientOd = null;
    }

    const company = await prisma.company.update({
      where: { id: params.id },
      data: {
        name: data.name,
        ...(data.ic !== undefined ? { ic: data.ic || null } : {}),
        ...(data.dic !== undefined ? { dic: data.dic || null } : {}),
        ...(data.vatPayer !== undefined ? { vatPayer: data.vatPayer } : {}),
        ...(data.bankAccount !== undefined ? { bankAccount: data.bankAccount || null } : {}),
        ...(data.addressStreet !== undefined ? { addressStreet: data.addressStreet || null } : {}),
        ...(data.addressCity !== undefined ? { addressCity: data.addressCity || null } : {}),
        ...(data.addressZip !== undefined ? { addressZip: data.addressZip || null } : {}),
        ...(data.addressCountry !== undefined ? { addressCountry: data.addressCountry || null } : {}),
        ...(data.paymentTermDays !== undefined ? { paymentTermDays: toIntOrNull(data.paymentTermDays) } : {}),
        ...(data.contactName !== undefined ? { contactName: data.contactName || null } : {}),
        ...(data.contactEmail !== undefined ? { contactEmail: data.contactEmail || null } : {}),
        ...(data.fakturyKlientovi !== undefined ? { fakturyKlientovi: data.fakturyKlientovi } : {}),
        ...(data.contactPhone !== undefined ? { contactPhone: data.contactPhone || null } : {}),
        ...(data.type === 'KLIENT'
          ? {
              // Sazba za normostranu dava smysl jen u audioknih - u reklamnich
              // klientu se cena pocita z Ceniku (zadani 6. 9. 2026).
              ratePerPage: data.dealsAudiobooks === false ? null : toIntOrNull(data.ratePerPage),
              driveFolderUrl: data.driveFolderUrl || null,
              ...(data.dealsAudiobooks !== undefined ? { dealsAudiobooks: data.dealsAudiobooks } : {}),
              ...(data.audioknihyNaKlic !== undefined ? { audioknihyNaKlic: data.audioknihyNaKlic } : {}),
              // Cenu navrhuje klient (23. 9. 2026) - objednavka pak cenu
              // nepocita ze sazby, klient ji vyplni sam.
              ...(data.cenuUrcujeKlient !== undefined ? { cenuUrcujeKlient: data.cenuUrcujeKlient } : {}),
              ...(data.fakturujeNaCasti !== undefined ? { fakturujeNaCasti: data.fakturujeNaCasti } : {}),
              ...(data.hudbuDodavaKlient !== undefined ? { hudbuDodavaKlient: data.hudbuDodavaKlient } : {}),
              ...(hudbaKlientOd !== undefined ? { hudbaKlientOd } : {}),
              ...(data.rezieKlientaUserId !== undefined
                ? { rezieKlientaUserId: data.rezieKlientaUserId || null }
                : {}),
              ...(data.vydavatelId !== undefined ? { vydavatelId: data.vydavatelId || null } : {}),
              ...(data.mena !== undefined ? { mena: data.mena } : {}),
              ...(data.tagyPovoleny !== undefined ? { tagyPovoleny: data.tagyPovoleny } : {}),
              ...(data.tagyVydavatel !== undefined ? { tagyVydavatel: data.tagyVydavatel || null } : {}),
              ...(data.nabidkyEmaily !== undefined
                ? { nabidkyEmaily: data.nabidkyEmaily.map((e) => e.trim()).filter(Boolean) }
                : {}),
              ...(data.fakturyEmaily !== undefined
                ? { fakturyEmaily: data.fakturyEmaily.map((e) => e.trim()).filter(Boolean) }
                : {}),
              ...(data.dealsAds !== undefined ? { dealsAds: data.dealsAds } : {}),
            }
          : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
    });

    /**
     * ZAPNUTÍ REKLAMY DOPLNÍ VÝCHOZÍ ZPRÁVU (1. 10. 2026) - ale jen firmě,
     * která žádnou nastavenou nemá. Kdo si zprávy nastavil po svém, o ně
     * přepnutím zaškrtávátka nepřijde.
     */
    if (data.dealsAds === true && company.type === 'KLIENT') {
      const uzMa = await prisma.notifikaceFirmy.count({ where: { companyId: company.id } });
      if (uzMa === 0) {
        await vychoziNotifikaceReklamy(company.id, !company.dealsAudiobooks).catch((err) =>
          console.error('Vychozi notifikace reklamy pri zapnuti selhala:', err),
        );
      }
    }

    return NextResponse.json(company);
  } catch (err) {
    console.error('PATCH /api/admin/companies/[id] selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}

/**
 * Tvrde smazani firmy (zadani 10. 9. 2026: testovaci firmy je potreba smazat
 * uplne, ne jen vyradit).
 *
 * Smaze se jen firma, na ktere opravdu nic nevisi. Kdyz neco visi, portal to
 * odmitne a vypise CO - at je hned videt, jestli je to odpadek, nebo omyl.
 * Pro vsechno ostatni je vyrazeni (PATCH s active: false).
 */
/**
 * Smazani firmy.
 *
 * Bez parametru se firma smaze jen tehdy, kdyz na ni nic nevisi - jinak
 * portal odmitne a vypise co. Clovek se pak muze rozhodnout (zadani
 * 10. 9. 2026) a poslat pozadavek znovu s ?zpusob=archivovat (navazane veci
 * se ulozi do archivu a smazou) nebo ?zpusob=smazat-vse (smazou se bez
 * archivu). Zamerne to neni jedno kliknuti: takhle je vzdycky videt, co to
 * bude stat, jeste nez se to stane.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const firma = await prisma.company.findUnique({ where: { id: params.id }, select: { name: true } });
  if (!firma) return NextResponse.json({ error: 'Firma nenalezena.' }, { status: 404 });

  const zpusob = req.nextUrl.searchParams.get('zpusob') ?? '';
  const prekazky = await prekazkyFirmy(params.id);

  if (prekazky.length > 0 && !jeZpusobSmazani(zpusob)) {
    return NextResponse.json(
      {
        error: `Firmu ${firma.name} nejde rovnou smazat, visí na ní: ${popisPrekazek(prekazky)}.`,
        prekazky,
      },
      { status: 409 },
    );
  }

  if (prekazky.length === 0) {
    await prisma.company.delete({ where: { id: params.id } });
    return NextResponse.json({ smazano: true, nazev: firma.name });
  }

  try {
    const vysledek = await odstranFirmu({
      companyId: params.id,
      nazev: firma.name,
      prekazky,
      archivovat: zpusob === 'archivovat',
      puvodce: { id: session.user.id, jmeno: session.user.name || session.user.email },
    });
    return NextResponse.json({ smazano: true, ...vysledek });
  } catch (err) {
    console.error('Smazání firmy selhalo:', err);
    return NextResponse.json(
      {
        error:
          'Smazání se nepodařilo dokončit, takže se nic nesmazalo. Nejspíš některý z účtů firmy vystupuje ještě jinde v portálu — zkuste ho smazat zvlášť.',
      },
      { status: 409 },
    );
  }
}
