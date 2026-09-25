import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

/**
 * DOKLADY Z DOBY PŘED PORTÁLEM (zadání 25. 9. 2026: „posílám všechny doklady
 * u Jan Minol. Hlídej, ať se netvoří duplicity").
 *
 * Nabídky a faktury, které vznikly ve starém fakturačním programu, se sem
 * dostávají jednorázově - ať má zakázka svou historii pohromadě a sedí
 * přehledy. NENÍ to cesta pro nové doklady; ty se vystavují normálně
 * v Dokladech.
 *
 * TŘI VĚCI, KTERÉ TO DĚLÁ JINAK NEŽ BĚŽNÉ ZALOŽENÍ DOKLADU:
 *
 *  1. ČÍSLO SE BERE Z DOKLADU, ne z číselné řady - staré doklady mají svá
 *     čísla a ta se nepřečíslovávají. Číselná řada se proto ani neposouvá:
 *     příští nová faktura dostane číslo, které by dostala tak jako tak.
 *  2. DUPLICITA SE PŘESKOČÍ. Co už v portálu s tím číslem je, se nechá být
 *     a jen se to spočítá - import se dá pustit dvakrát a nic se nerozmnoží.
 *  3. NIC NEODCHÁZÍ. Žádný mail, žádná notifikace: je to přepis papírů, ne
 *     dnešní doklad.
 *
 * Projekt se hledá podle NÁZVU mezi zakázkami té firmy (na starých dokladech
 * je „...práce na projektu FITMIN"), takže se nemusí dohledávat ID.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const polozka = z.object({
  popis: z.string().trim().min(1).max(300),
  /** Cena za kus BEZ DPH v korunách - tak, jak je na papíře. */
  cena: z.number(),
  pocet: z.number().default(1),
  sazba: z.number().int().min(0).max(100).default(21),
});

const schema = z.object({
  companyId: z.string().trim().min(1),
  nabidky: z
    .array(
      z.object({
        cislo: z.string().trim().min(1),
        datum: z.string().trim().min(8),
        projekt: z.string().trim().optional(),
        predmet: z.string().trim().max(200).optional(),
        schvalena: z.boolean().optional(),
        polozky: z.array(polozka).min(1).max(50),
      }),
    )
    .max(200)
    .optional(),
  faktury: z
    .array(
      z.object({
        cislo: z.string().trim().min(1),
        datum: z.string().trim().min(8),
        splatnost: z.string().trim().min(8).optional(),
        projekt: z.string().trim().optional(),
        predmet: z.string().trim().max(200).optional(),
        uhrazena: z.boolean().optional(),
        uhrazenoDne: z.string().trim().optional(),
        polozky: z.array(polozka).min(1).max(50),
      }),
    )
    .max(200)
    .optional(),
});

function den(hodnota: string | undefined | null): Date | null {
  if (!hodnota) return null;
  const d = new Date(`${hodnota}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }
  const vstup = parsed.data;

  const [firma, vydavatel] = await Promise.all([
    prisma.company.findUnique({ where: { id: vstup.companyId }, select: { id: true, name: true } }),
    prisma.issuerCompany.findFirst({
      where: { active: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, defaultCurrency: true },
    }),
  ]);
  if (!firma) return NextResponse.json({ error: 'Firma nenalezena.' }, { status: 404 });
  if (!vydavatel) return NextResponse.json({ error: 'Chybí vlastní firma.' }, { status: 400 });

  // Zakázky firmy podle názvu - staré projekty mívají u sebe jen název firmy.
  const projekty = await prisma.projectMeta.findMany({
    where: {
      OR: [
        { companyId: firma.id },
        { companyId: null, companyName: { equals: firma.name, mode: 'insensitive' } },
      ],
    },
    select: { caflouProjectId: true, name: true },
  });
  const najdiProjekt = (nazev: string | undefined) => {
    if (!nazev) return null;
    const hledane = nazev.trim().toLocaleLowerCase('cs');
    return (
      projekty.find((p) => (p.name ?? '').trim().toLocaleLowerCase('cs') === hledane) ??
      projekty.find((p) => (p.name ?? '').trim().toLocaleLowerCase('cs').startsWith(hledane)) ??
      null
    );
  };

  const vysledek = {
    nabidky: [] as string[],
    faktury: [] as string[],
    preskoceno: [] as string[],
    bezProjektu: [] as string[],
  };

  try {
    for (const n of vstup.nabidky ?? []) {
      const uz = await prisma.offer.findUnique({ where: { number: n.cislo }, select: { id: true } });
      if (uz) {
        vysledek.preskoceno.push(`nabídka ${n.cislo}`);
        continue;
      }
      const projekt = najdiProjekt(n.projekt);
      if (n.projekt && !projekt) vysledek.bezProjektu.push(`nabídka ${n.cislo} (${n.projekt})`);

      await prisma.offer.create({
        data: {
          number: n.cislo,
          issuerCompanyId: vydavatel.id,
          companyId: firma.id,
          currency: vydavatel.defaultCurrency,
          issueDate: den(n.datum) ?? new Date(),
          subject: n.predmet || (n.projekt ? `Zvukařské práce na projektu ${n.projekt}` : null),
          status: n.schvalena ? 'APPROVED' : 'DRAFT',
          approvedAt: n.schvalena ? den(n.datum) : null,
          approvalToken: randomBytes(24).toString('base64url'),
          caflouProjectId: projekt?.caflouProjectId ?? null,
          projectName: projekt?.name ?? n.projekt ?? null,
          items: {
            create: n.polozky.map((p, i) => ({
              description: p.popis,
              quantity: p.pocet,
              unit: 'ks',
              unitPriceMinor: Math.round(p.cena * 100),
              vatRate: p.sazba,
              sortOrder: i,
            })),
          },
        },
      });
      vysledek.nabidky.push(n.cislo);
    }

    for (const f of vstup.faktury ?? []) {
      const uz = await prisma.invoice.findUnique({ where: { number: f.cislo }, select: { id: true } });
      if (uz) {
        vysledek.preskoceno.push(`faktura ${f.cislo}`);
        continue;
      }
      const projekt = najdiProjekt(f.projekt);
      if (f.projekt && !projekt) vysledek.bezProjektu.push(`faktura ${f.cislo} (${f.projekt})`);

      const vystaveno = den(f.datum) ?? new Date();
      const splatnost = den(f.splatnost);
      const celkemMinor = f.polozky.reduce(
        (soucet, p) => soucet + Math.round(p.cena * 100 * p.pocet * (1 + p.sazba / 100)),
        0,
      );

      await prisma.invoice.create({
        data: {
          number: f.cislo,
          // Variabilní symbol je na starých dokladech číslo faktury.
          variableSymbol: f.cislo.replace(/\D/g, '') || f.cislo,
          issuerCompanyId: vydavatel.id,
          companyId: firma.id,
          currency: vydavatel.defaultCurrency,
          issueDate: vystaveno,
          taxDate: vystaveno,
          dueDate: splatnost,
          subject: f.predmet || (f.projekt ? `Zvukařské práce na projektu ${f.projekt}` : null),
          status: f.uhrazena ? 'PAID' : 'SENT',
          sentAt: vystaveno,
          paidAt: f.uhrazena ? den(f.uhrazenoDne) ?? splatnost ?? vystaveno : null,
          paidAmountMinor: f.uhrazena ? celkemMinor : null,
          caflouProjectId: projekt?.caflouProjectId ?? null,
          projectName: projekt?.name ?? f.projekt ?? null,
          items: {
            create: f.polozky.map((p, i) => ({
              description: p.popis,
              quantity: p.pocet,
              unit: 'ks',
              unitPriceMinor: Math.round(p.cena * 100),
              vatRate: p.sazba,
              sortOrder: i,
            })),
          },
        },
      });
      vysledek.faktury.push(f.cislo);
    }

    return NextResponse.json({ ok: true, ...vysledek });
  } catch (err) {
    console.error('Import starych dokladu selhal:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Import se nezdařil (${message}).`, ...vysledek }, { status: 500 });
  }
}
