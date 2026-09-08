import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { nextCode } from '@/lib/codes';
import { comparableCompanyName } from '@/lib/caflouCompanies';

// Prenos roztridenych firem z Caflou do portalu (zadani 8. 9. 2026:
// "potrebuji dostat informace do MS portalu a vyplnit pole, ktera mame
// v portalu").
//
// Klient -> model Company, Herec -> uzivatel s roli HEREC.
//
// DVE PRAVIDLA, ktera tu plati bez vyjimky:
//  1) Nic se nezaklada dvakrat. Nejdriv se hleda, jestli uz zaznam v portalu
//     neni - u firem podle ID z Caflou, ICa a nazvu, u hercu podle e-mailu,
//     ICa a jmena. Kdyz se najde, jen se DOPLNI a propoji.
//  2) Nic se neprepisuje. Doplnuji se vyhradne prazdna pole, takze rucne
//     zadany udaj v portalu ma vzdy prednost pred tim, co prijde z Caflou.
const schema = z.object({ ids: z.array(z.string().min(1)).min(1).max(300) });

type Vysledek = { id: string; nazev: string; akce: 'zalozeno' | 'doplneno' | 'preskoceno'; detail: string };

/** ISO kod zeme - Caflou vraci ruzne tvary, co nepoznáme, radeji nevyplnujeme. */
function toCountryCode(value: string | null): string | null {
  if (!value) return null;
  const text = value.trim();
  if (/^[A-Za-z]{2}$/.test(text)) return text.toUpperCase();
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (normalized.startsWith('cesk') || normalized === 'czechia' || normalized.startsWith('czech')) return 'CZ';
  if (normalized.startsWith('slovensk') || normalized.startsWith('slovak')) return 'SK';
  return null;
}

/** Jen pole, ktera v portalu jeste nejsou vyplnena - rucni zapis prebiji Caflou. */
function onlyMissing<T extends Record<string, unknown>>(existing: Record<string, unknown>, candidate: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(candidate)) {
    if (value === null || value === undefined || value === '') continue;
    const current = existing[key];
    if (current === null || current === undefined || current === '') out[key] = value;
  }
  return out as Partial<T>;
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

    const rows = await prisma.caflouCompany.findMany({ where: { id: { in: parsed.data.ids } } });

    // Firmy i herce nacteme JEDNOU dopredu a parujeme v pameti - jednak je to
    // rychlejsi nez dotaz na kazdy radek, jednak nove zalozene rovnou pridame
    // do rejstriku, takze dve stejne firmy v jednom davkovem prenosu (napr.
    // stejne ICO dvakrat) nezaloziji dva zaznamy.
    const firmy = await prisma.company.findMany();
    const herci = await prisma.user.findMany({ where: { role: 'HEREC' } });

    const vysledky: Vysledek[] = [];

    for (const row of rows) {
      const ic = row.ic ? row.ic.replace(/\D/g, '') : '';
      const klic = comparableCompanyName(row.name);
      const adresa = {
        addressStreet: row.addressStreet,
        addressCity: row.addressCity,
        addressZip: row.addressZip,
        addressCountry: toCountryCode(row.addressCountry),
      };

      if (row.kind === 'KLIENT') {
        // Hledani duplicity: ID z Caflou > ICO > nazev bez diakritiky a pravni formy.
        const existujici =
          firmy.find((c) => c.caflouCompanyId === row.id) ??
          (ic ? firmy.find((c) => (c.ic ?? '').replace(/\D/g, '') === ic) : undefined) ??
          firmy.find((c) => comparableCompanyName(c.name) === klic);

        const data = {
          ic: row.ic,
          dic: row.dic,
          contactEmail: row.email,
          contactPhone: row.phone,
          ...adresa,
          caflouCompanyId: row.id,
        };

        if (existujici) {
          const doplnit = onlyMissing(existujici as unknown as Record<string, unknown>, data);
          if (Object.keys(doplnit).length > 0) {
            await prisma.company.update({ where: { id: existujici.id }, data: doplnit });
            Object.assign(existujici, doplnit);
          }
          vysledky.push({
            id: row.id,
            nazev: row.name,
            akce: 'doplneno',
            detail:
              Object.keys(doplnit).length > 0
                ? `Firma „${existujici.name}" — doplněno: ${Object.keys(doplnit).join(', ')}`
                : `Firma „${existujici.name}" už měla všechno vyplněné.`,
          });
          continue;
        }

        const company = await prisma.company.create({
          data: {
            code: await nextCode('F'),
            type: 'KLIENT',
            name: row.name,
            vatPayer: Boolean(row.dic),
            ...data,
          },
        });
        firmy.push(company);
        vysledky.push({ id: row.id, nazev: row.name, akce: 'zalozeno', detail: `Založena firma ${company.code}.` });
        continue;
      }

      if (row.kind === 'HEREC') {
        const email = row.email?.trim().toLowerCase() || null;
        const existujici =
          (email ? herci.find((u) => u.email.toLowerCase() === email) : undefined) ??
          (ic ? herci.find((u) => (u.ic ?? '').replace(/\D/g, '') === ic) : undefined) ??
          herci.find((u) => comparableCompanyName(u.name || '') === klic);

        const data = {
          name: row.name,
          phone: row.phone,
          ic: row.ic,
          dic: row.dic,
          ...adresa,
        };

        if (existujici) {
          const doplnit = onlyMissing(existujici as unknown as Record<string, unknown>, data);
          if (Object.keys(doplnit).length > 0) {
            await prisma.user.update({ where: { id: existujici.id }, data: doplnit });
            Object.assign(existujici, doplnit);
          }
          vysledky.push({
            id: row.id,
            nazev: row.name,
            akce: 'doplneno',
            detail:
              Object.keys(doplnit).length > 0
                ? `Herec „${existujici.name || existujici.email}" — doplněno: ${Object.keys(doplnit).join(', ')}`
                : `Herec „${existujici.name || existujici.email}" už měl všechno vyplněné.`,
          });
          continue;
        }

        // Ucet bez e-mailu zalozit nejde - e-mail je prihlasovaci udaj a musi
        // byt jedinecny. Radeji to rekneme nahlas, nez abychom vymysleli
        // nahradni adresu, se kterou by se pak nedalo poslat pozvanka.
        if (!email) {
          vysledky.push({
            id: row.id,
            nazev: row.name,
            akce: 'preskoceno',
            detail: 'Chybí e-mail — bez něj nejde účet herce založit. Doplňte ho v Caflou a načtěte znovu.',
          });
          continue;
        }

        // Heslo se nikam neposila; herec si ho nastavi az z pozvanky
        // (viz /api/admin/users/[id]/invite), do te doby se neprihlasi.
        const passwordHash = await bcrypt.hash(randomBytes(24).toString('hex'), 10);
        const user = await prisma.user.create({
          data: {
            code: await nextCode('H'),
            email,
            passwordHash,
            role: 'HEREC',
            vatPayer: Boolean(row.dic),
            ...data,
          },
        });
        herci.push(user);
        vysledky.push({
          id: row.id,
          nazev: row.name,
          akce: 'zalozeno',
          detail: `Založen herec ${user.code} — pošlete mu pozvánku, aby si nastavil heslo.`,
        });
        continue;
      }

      vysledky.push({
        id: row.id,
        nazev: row.name,
        akce: 'preskoceno',
        detail: 'Není označeno jako klient ani herec.',
      });
    }

    return NextResponse.json({
      ok: true,
      zalozeno: vysledky.filter((v) => v.akce === 'zalozeno').length,
      doplneno: vysledky.filter((v) => v.akce === 'doplneno').length,
      preskoceno: vysledky.filter((v) => v.akce === 'preskoceno').length,
      vysledky,
    });
  } catch (err) {
    console.error('POST /api/admin/caflou-firmy/zalozit selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Přenos se nezdařil (${message}).` }, { status: 500 });
  }
}
