import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canEditProjectMeta, isInternalRole } from '@/lib/roles';
import { sendZapracovaniPripominekEmail } from '@/lib/email';
import { interniPrijemciStavu, STAV_REKLAMY } from '@/lib/notifikaceFirmy';
import { zajistiOdkaz, urlPripominek } from '@/lib/preposlechOdkaz';
import { zapisNotifikaci } from '@/lib/projektLogServer';
import { jazykUzivatele } from '@/lib/jazykPrijemce';

/**
 * ZAPRACOVALI JSME PŘIPOMÍNKY (zadání 20. 10. 2026: „pak bych tam dal nějaké
 * tlačítko, když připomínky zapracujeme, aby po stisknutí se nezměnil stav,
 * ale šla notifikace, zapracovali jsme připomínky. I s nějakým přehledem, co
 * bylo zapracované, pro přehled. A ještě tohle se může opakovat několikrát,
 * než to klient schválí").
 *
 * STAV PROJEKTU SE NEMĚNÍ. Zakázka zůstává „Dokončeno - ke schválení", dokud
 * klient neřekne, že je to dobře - tohle je zpráva mezitím, ne krok v cestě
 * projektu. Proto se to taky dá zmáčknout kolikrát je potřeba; zprávy ke
 * stavům hlídá značka „už odesláno", tahle ne.
 *
 * CO SE SEBERE: všechny ODESLANÉ připomínky, které ještě nejsou v žádném
 * kole. Rozepsané (klient je ještě neodeslal) zůstávají ležet - zapracovat
 * něco, co nám klient zatím neposlal, by bylo hádání.
 *
 * NIC SE NEMAŽE. Připomínky ze seznamu zmizí (jsou vyřízené), ale visí dál
 * u svého kola - viz GET níž a historie v kartě projektu.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({ poznamka: z.string().trim().max(2000).optional() });

/** Řádky pro okno i pro mail - jeden tvar, ať se nerozejdou. */
function cas(sekundy: number): string {
  const c = Math.max(0, Math.round(sekundy));
  return `${Math.floor(c / 60)}:${String(c % 60).padStart(2, '0')}`;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isInternalRole(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  // Kolik pripominek ceka na zapracovani - podle toho se v karte nabizi
  // tlacitko a rika se, kolik toho do kola pujde.
  const ceka = await prisma.reklamaPripominka.count({
    where: { caflouProjectId: params.id, odeslanoAt: { not: null }, zapracovaniId: null },
  });

  const kola = await prisma.zapracovaniPripominek.findMany({
    where: { caflouProjectId: params.id },
    orderBy: { poradi: 'desc' },
    include: { pripominky: { orderBy: [{ driveFileName: 'asc' }, { cas: 'asc' }] } },
  });

  return NextResponse.json({
    ceka,
    kola: kola.map((k) => ({
      id: k.id,
      poradi: k.poradi,
      poznamka: k.poznamka,
      kdoJmeno: k.kdoJmeno,
      prijemci: k.prijemci,
      odeslanoAt: k.odeslanoAt ? k.odeslanoAt.toISOString() : null,
      kdy: k.createdAt.toISOString(),
      polozky: k.pripominky.map((p) => ({
        id: p.id,
        soubor: p.driveFileName,
        cas: cas(p.cas),
        text: p.text,
        autor: p.autorJmeno,
      })),
    })),
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canEditProjectMeta(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  const poznamka = parsed.data.poznamka?.trim() || null;

  try {
    const projekt = await prisma.projectMeta.findUnique({
      where: { caflouProjectId: params.id },
      select: {
        name: true,
        companyId: true,
        company: { select: { name: true, interniPrijemci: true } },
        klient: { select: { id: true, name: true, email: true } },
      },
    });
    if (!projekt) return NextResponse.json({ error: 'Projekt nenalezen.' }, { status: 404 });

    const cekaji = await prisma.reklamaPripominka.findMany({
      where: { caflouProjectId: params.id, odeslanoAt: { not: null }, zapracovaniId: null },
      orderBy: [{ driveFileName: 'asc' }, { cas: 'asc' }],
    });
    if (cekaji.length === 0) {
      return NextResponse.json(
        { error: 'Nejsou tu žádné odeslané připomínky, které by šlo zapracovat.' },
        { status: 400 },
      );
    }

    // Kolikate kolo to je. Pocita se z tabulky, ne z poctu pripominek.
    const posledni = await prisma.zapracovaniPripominek.findFirst({
      where: { caflouProjectId: params.id },
      orderBy: { poradi: 'desc' },
      select: { poradi: true },
    });
    const poradi = (posledni?.poradi ?? 0) + 1;

    /**
     * KOMU TO JDE. Nejdřív adresy nastavené u stavu „Dokončeno - ke schválení"
     * (20. 10. 2026), teprve pak klient vedený u projektu - schvalovací kolečko
     * má u reklam často na starosti někdo jiný. My jdeme ve skryté kopii.
     */
    const nastaveni = projekt.companyId
      ? await prisma.notifikaceFirmy.findUnique({
          where: {
            companyId_stav: { companyId: projekt.companyId, stav: STAV_REKLAMY },
          },
          select: { interniPrijemci: true, klientiEmaily: true },
        })
      : null;
    const uStavu = (nastaveni?.klientiEmaily ?? []).map((e) => e.trim()).filter(Boolean);
    const prijemci = uStavu.length > 0 ? uStavu : projekt.klient?.email ? [projekt.klient.email] : [];
    const nasi = interniPrijemciStavu(nastaveni?.interniPrijemci, projekt.company?.interniPrijemci);

    const kolo = await prisma.zapracovaniPripominek.create({
      data: {
        caflouProjectId: params.id,
        poradi,
        poznamka,
        kdoJmeno: session.user.name || session.user.email || null,
        prijemci,
      },
    });

    // Pripominky patri kolu a ze seznamu mizi - zustavaji u nej v historii.
    await prisma.reklamaPripominka.updateMany({
      where: { id: { in: cekaji.map((p) => p.id) } },
      data: { zapracovaniId: kolo.id, vyrizeno: true },
    });

    const token = await zajistiOdkaz(params.id, null);
    const polozky = cekaji.map((p) => ({
      soubor: p.driveFileName,
      cas: cas(p.cas),
      text: p.text,
      autor: p.autorJmeno,
    }));

    let odeslano = false;
    let telo: string | null = null;
    let predmet: string | null = null;
    if (prijemci.length > 0) {
      const vysledek = await sendZapracovaniPripominekEmail({
        prijemci,
        skrytaKopie: nasi,
        jmenoKlienta: projekt.klient?.name ?? null,
        nazevProjektu: projekt.name ?? 'Projekt',
        kolo: poradi,
        poznamka,
        polozky,
        odkaz: token ? urlPripominek(token) : null,
        jazyk: await jazykUzivatele(projekt.klient?.id).catch(() => 'cs' as const),
      });
      odeslano = vysledek.sent === true;
      telo = 'telo' in vysledek ? vysledek.telo : null;
      predmet = 'predmet' in vysledek ? vysledek.predmet : null;
      if (odeslano) {
        await prisma.zapracovaniPripominek.update({
          where: { id: kolo.id },
          data: { odeslanoAt: new Date() },
        });
      }
    }

    /**
     * DO HISTORIE PROJEKTU. Otisk zprávy se ukládá stejně jako u zpráv ke
     * stavům (19. 10. 2026), takže se dá v historii prokliknout na to, co
     * klient dostal.
     */
    await zapisNotifikaci({
      caflouProjectId: params.id,
      stav: STAV_REKLAMY,
      popis: odeslano
        ? `Zapracované připomínky (${poradi}. kolo, ${polozky.length}) — zpráva odešla na ${prijemci.join(', ')}.`
        : `Zapracované připomínky (${poradi}. kolo, ${polozky.length}) — zpráva neodešla, není komu.`,
      prijemci,
      zpravaPredmet: predmet,
      zpravaHtml: telo,
    }).catch(() => undefined);

    return NextResponse.json({
      ok: true,
      kolo: poradi,
      pocet: polozky.length,
      odeslano,
      prijemci,
    });
  } catch (err) {
    console.error('POST /api/projekty/[id]/zapracovani selhalo:', err);
    return NextResponse.json({ error: 'Zapracování se nepodařilo uložit.' }, { status: 500 });
  }
}
