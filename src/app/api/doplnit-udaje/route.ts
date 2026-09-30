import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { kdoJe } from '@/lib/kdoJe';
import { prisma } from '@/lib/db';
import { kodZeme } from '@/lib/countries';
import { notifyMany } from '@/lib/notifications';
import { prijemciUdaju } from '@/lib/pozvankaUdaju';

/**
 * ULOŽENÍ ÚDAJŮ, KTERÉ HEREC DOPLNIL SÁM (zadání 16. 9. 2026).
 *
 * MĚNÍ JEN VLASTNÍ ÚČET přihlášeného člověka — id se bere ze session, nikdy
 * z těla požadavku. Jinak by si tímhle formulářem šlo přepsat číslo účtu
 * komukoliv jinému.
 *
 * Zapisuje se rovnou. Je to první vyplnění prázdné karty, takže není co
 * přepsat; hlídání přepisů řeší žádosti o údaje odkazem (lib/pozvankaUdaju).
 *
 * UKLÁDÁ SE PRŮBĚŽNĚ, NE AŽ NA KONCI (oprava 30. 9. 2026: „nějak se nám
 * nepropisují údaje z formulářů, které na vyplnění posíláme hercům. V kolonce
 * jméno by mělo být jméno. A nevím teď, jestli vyplňovala další údaje").
 *
 * Průvodce má sedm kroků a vyplňuje se z telefonu cestou ze studia. Do teď se
 * odesílal až posledním tlačítkem - kdo ho zavřel v pátém kroku, poslal
 * NIC a na kartě po něm nezůstala ani čárka. Produkce pak nemá jak zjistit,
 * jestli se do toho vůbec pustil.
 *
 * `hotovo: false` proto uloží, co je vyplněné TEĎ, a nic víc: karta se plní
 * krok po kroku, `udajeDoplneny` zůstává prázdné (průvodce se při dalším
 * přihlášení otevře tam, kde skončil) a nikomu se nic nehlásí. Aby průběžné
 * uložení nemohlo nic smazat, zapisují se u něj jen NEPRÁZDNÉ hodnoty.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  /**
   * Povinné je jen při dokončení - průběžné uložení přijde i s prázdným
   * jménem, protože se posílá hned po prvním kroku.
   */
  name: z.string().trim().max(200).optional().default(''),
  addressStreet: z.string().trim().max(200).optional().default(''),
  addressCity: z.string().trim().max(120).optional().default(''),
  addressZip: z.string().trim().max(20).optional().default(''),
  addressCountry: z.string().trim().max(120).optional().default(''),
  bankAccount: z.string().trim().max(60).optional().default(''),
  birthNumber: z.string().trim().max(40).optional().default(''),
  ic: z.string().trim().max(20).optional().default(''),
  dic: z.string().trim().max(30).optional().default(''),
  studioLocations: z.array(z.string().max(120)).max(20).optional().default([]),
  vatPayer: z.boolean().optional().default(false),
  /** false = průběžné uložení rozdělaného průvodce (30. 9. 2026). */
  hotovo: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  const ja = await kdoJe(req);
  if (!ja) {
    return NextResponse.json(
      { error: 'Přihlášení vypršelo. Načtěte prosím stránku znovu.' },
      { status: 401 },
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Neplatná data.' },
      { status: 400 },
    );
  }
  const d = parsed.data;
  if (d.hotovo && !d.name) {
    return NextResponse.json({ error: 'Vyplňte prosím jméno.' }, { status: 400 });
  }

  /**
   * Při dokončení se zapisuje všechno včetně prázdna - průvodce schválně
   * posílá prázdné IČ, když herec přepnul na rodné číslo, a prázdné DIČ,
   * když není plátce. Průběžně se naopak zapisuje jen to, co vyplněné je.
   */
  const vse = {
    name: d.name,
    addressStreet: d.addressStreet || null,
    addressCity: d.addressCity || null,
    addressZip: d.addressZip || null,
    addressCountry: kodZeme(d.addressCountry) || null,
    bankAccount: d.bankAccount || null,
    birthNumber: d.birthNumber || null,
    ic: d.ic || null,
    dic: d.dic || null,
    studioLocations: d.studioLocations,
    vatPayer: d.vatPayer,
  };
  const data: Record<string, unknown> = d.hotovo
    ? { ...vse, udajeDoplneny: true }
    : Object.fromEntries(
        Object.entries(vse).filter(([klic, hodnota]) => {
          if (klic === 'vatPayer') return false; // ano/ne se pozná až v kroku 3
          if (Array.isArray(hodnota)) return hodnota.length > 0;
          return hodnota !== null && hodnota !== '';
        }),
      );

  try {
    if (!d.hotovo) {
      if (Object.keys(data).length > 0) {
        await prisma.user.update({ where: { id: ja.id }, data });
      }
      return NextResponse.json({ ok: true, prubezne: true });
    }

    const ucet = await prisma.user.update({
      where: { id: ja.id },
      data,
      select: { id: true, name: true, email: true },
    });

    void oznam(ucet).catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/doplnit-udaje selhalo:', err);
    return NextResponse.json({ error: 'Uložení se nepodařilo.' }, { status: 500 });
  }
}

/**
 * Zpráva těm, kdo to u sebe mají zapnuté (zadání 16. 9. 2026: „zahlásí
 * Karolíně — tohle bych chtěl mít ale taky možnost měnit do budoucna, komu to
 * bude hlásit"). Když to nemá zapnuté nikdo, jen se nic nepošle.
 */
async function oznam(ucet: { id: string; name: string | null; email: string }) {
  const prijemci = await prijemciUdaju();
  if (prijemci.length === 0) return;
  const kdo = ucet.name || ucet.email;

  await notifyMany(prijemci.map((p) => p.id), {
    kind: 'udaje-vyplneny',
    title: `${kdo} doplnil údaje`,
    body: 'Nový herec vyplnil své údaje po přijetí pozvánky.',
    url: `/admin/users/${ucet.id}`,
  });

  const { sendVyplneneUdajeEmail } = await import('@/lib/email');
  const zaklad = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
  for (const prijemce of prijemci) {
    if (!prijemce.email) continue;
    await sendVyplneneUdajeEmail({
      to: prijemce.email,
      jmenoPrijemce: prijemce.name,
      kdo,
      hotovo: true,
      kolikCeka: 0,
      odkaz: `${zaklad}/admin/users/${ucet.id}`,
    });
  }
}
