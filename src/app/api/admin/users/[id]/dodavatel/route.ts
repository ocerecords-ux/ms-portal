import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { nextCode } from '@/lib/codes';
import { bezTitulu } from '@/lib/jmena';

/**
 * PŘENÉST HERCE DO DODAVATELŮ (zadání 16. 9. 2026: „někdy se nám stane, že
 * herec je i dodavatel, takže bych potřeboval mít u herce možnost přenést ho
 * do dodavatelů. Aby pak byl zároveň herec, ale i dodavatel").
 *
 * Nepřesouvá — ZDVOJUJE. Z karty herce se založí firma typu Dodavatel a herci
 * se na kartu uloží odkaz na ni. Role zůstává HEREC, projekty, termíny
 * i smlouvy s ním jako s hercem se nehnou; jen k tomu navíc existuje firma,
 * se kterou jde uzavřít smlouvu o dílo.
 *
 * PROČ FIRMA A NE PŘEPÍNAČ NA ÚČTU: smlouva o dílo si bere protistranu
 * z firem-dodavatelů (viz NewContractForm) a doklady od dodavatelů se vedou
 * na firmu. Kdyby herec-dodavatel byl jen příznak na účtu, musel by o něm
 * vědět každý výběr firmy zvlášť.
 *
 * DĚLÁ SE TO JEDNOU. Když už herec firmu má, vrátí se ta stávající a nic se
 * nezakládá — dvakrát zmáčknuté tlačítko nesmí udělat dva dodavatele.
 */
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const herec = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        role: true,
        name: true,
        email: true,
        phone: true,
        ic: true,
        dic: true,
        vatPayer: true,
        bankAccount: true,
        addressStreet: true,
        addressCity: true,
        addressZip: true,
        addressCountry: true,
        dodavatelCompanyId: true,
        dodavatelCompany: { select: { id: true, name: true, code: true } },
      },
    });

    if (!herec) return NextResponse.json({ error: 'Uživatel nenalezen.' }, { status: 404 });
    if (herec.role !== 'HEREC') {
      return NextResponse.json({ error: 'Do dodavatelů se přenášejí jen herci.' }, { status: 400 });
    }
    if (herec.dodavatelCompany) {
      return NextResponse.json({
        ok: true,
        uzExistovala: true,
        firma: herec.dodavatelCompany,
      });
    }

    // Jmeno firmy je jmeno herce bez titulu - fakturuje jako fyzicka osoba
    // a titul do obchodniho jmena nepatri.
    const nazev = bezTitulu(herec.name) || herec.name || herec.email;

    const code = await nextCode('F');
    const firma = await prisma.company.create({
      data: {
        code,
        type: 'DODAVATEL',
        name: nazev,
        ic: herec.ic || null,
        dic: herec.dic || null,
        vatPayer: herec.vatPayer,
        bankAccount: herec.bankAccount || null,
        addressStreet: herec.addressStreet || null,
        addressCity: herec.addressCity || null,
        addressZip: herec.addressZip || null,
        addressCountry: herec.addressCountry || 'CZ',
        // Jednoradkova adresa kvuli starsim mistum, ktera ctou jen ji.
        address:
          [herec.addressStreet, [herec.addressZip, herec.addressCity].filter(Boolean).join(' ')]
            .filter(Boolean)
            .join(', ') || null,
        // Kontaktní osoba je on sám - podepisuje za sebe.
        contactName: nazev,
        contactEmail: herec.email,
        contactPhone: herec.phone || null,
        // Dodavatel audioknihy ani reklamy neobjednava - priznaky klienta
        // by u nej jen mátly.
        dealsAudiobooks: false,
        herciDodavatele: { connect: { id: herec.id } },
      },
      select: { id: true, name: true, code: true },
    });

    return NextResponse.json({ ok: true, uzExistovala: false, firma });
  } catch (err) {
    console.error('POST /api/admin/users/[id]/dodavatel selhalo:', err);
    return NextResponse.json({ error: 'Přenos do dodavatelů se nezdařil.' }, { status: 500 });
  }
}
