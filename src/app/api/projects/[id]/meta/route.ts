import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canEditProjectMeta } from '@/lib/roles';
import { jeNasStav, stavJeDokonceny } from '@/lib/stavyProjektu';
import { syncRodneListy } from '@/lib/rodnyListServer';


// Ulozeni internich atributu projektu (model ProjectMeta) - zadani
// 5. 9. 2026. Menit je smi POUZE Produkce a Zuzo-labuzo; zvukar ma jen
// nahled ke cteni, klient se sem nedostane vubec.
//
// Zmena 9. 9. 2026 (Rodny list): route ted uklada jen ta pole, ktera opravdu
// prisla v pozadavku. Formularu na detailu projektu je vic (Interni udaje,
// Rodny list) a kazdy posila jen svou cast - kdyby se ukladalo vsechno
// najednou jako driv, jeden formular by pri ulozeni vymazal pole druheho.
const schema = z.object({
  driveUrl: z.string().trim().max(2000).optional(),
  managerUserId: z.string().trim().optional(),
  priority: z.enum(['', 'LOW', 'MEDIUM', 'HIGH']).optional(),
  projectType: z.string().trim().optional(),

  // --- Stav a herec se od 10. 9. 2026 zadavaji rucne ---------------------
  // Do te doby chodily z Caflou a portal je jen ukazoval. Mediaspace Caflou
  // opousti, takze o stavu i o herci rozhoduje ted portal.
  statusName: z.string().trim().max(120).optional(),
  narrator: z.string().trim().max(200).optional(),
  /** Firma, pro kterou se projekt dela. */
  companyId: z.string().trim().optional(),
  /** Klient projektu - konkretni clovek, na ktereho chodi notifikace. */
  klientUserId: z.string().trim().optional(),

  // --- Rodny list reklamniho spotu (zadani 9. 9. 2026) ---
  spotName: z.string().trim().max(300).optional(),
  /** Prichazi jako text z <input type="number"> - prazdny retezec = smazat. */
  spotLengthSeconds: z.union([z.string().trim(), z.number()]).optional(),
  directorName: z.string().trim().max(200).optional(),
  musicTitle: z.string().trim().max(300).optional(),
  musicAuthor: z.string().trim().max(300).optional(),
  noMusic: z.boolean().optional(),
  /** YYYY-MM-DD z <input type="date">; prazdny retezec = smazat. */
  productionDate: z.string().trim().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !canEditProjectMeta(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění tyto údaje měnit.' }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const data = parsed.data;

    if (data.driveUrl && !/^https?:\/\//i.test(data.driveUrl)) {
      return NextResponse.json({ error: 'Odkaz na KZ musí začínat http:// nebo https://.' }, { status: 400 });
    }
    // Typ projektu musi byt polozka ceniku (zadani 5. 9. 2026).
    if (data.projectType) {
      const item = await prisma.priceListItem.findUnique({ where: { name: data.projectType } });
      if (!item) {
        return NextResponse.json({ error: 'Typ projektu musí být položka z ceníku.' }, { status: 400 });
      }
    }

    // Manazer musi byt existujici interni ucet Mediaspace.
    if (data.managerUserId) {
      const manager = await prisma.user.findFirst({
        where: { id: data.managerUserId, role: { in: ['ADMIN', 'ZVUKAR', 'PRODUKCE'] } },
        select: { id: true },
      });
      if (!manager) {
        return NextResponse.json({ error: 'Vybraný manažer neexistuje.' }, { status: 400 });
      }
    }

    // Firma projektu musi existovat. Nazev se ulozi i textem, aby projekt
    // zustal citelny, kdyby firmu nekdo pozdeji smazal.
    let companyName: string | null | undefined;
    if (data.companyId !== undefined) {
      if (!data.companyId) {
        companyName = null;
      } else {
        const firma = await prisma.company.findUnique({
          where: { id: data.companyId },
          select: { name: true },
        });
        if (!firma) {
          return NextResponse.json({ error: 'Vybraná firma neexistuje.' }, { status: 400 });
        }
        companyName = firma.name;
      }
    }

    // Klient projektu musi byt ucet klienta. Zamerne se nekontroluje, jestli
    // patri prave k firme projektu - u koprodukci a agentur sedi u projektu
    // clovek z jine firmy a portal to nema zakazovat.
    if (data.klientUserId) {
      const klient = await prisma.user.findFirst({
        where: { id: data.klientUserId, role: 'CLIENT' },
        select: { id: true },
      });
      if (!klient) {
        return NextResponse.json({ error: 'Vybraný klient neexistuje.' }, { status: 400 });
      }
    }

    // Delka spotu: cislo v sekundach, prazdno = nevyplneno.
    let spotLengthSeconds: number | null | undefined;
    if (data.spotLengthSeconds !== undefined) {
      const raw = typeof data.spotLengthSeconds === 'number' ? data.spotLengthSeconds : data.spotLengthSeconds.trim();
      if (raw === '' || raw === null) {
        spotLengthSeconds = null;
      } else {
        const n = Number(raw);
        if (!Number.isFinite(n) || n <= 0 || n > 3600) {
          return NextResponse.json({ error: 'Délka spotu musí být počet sekund mezi 1 a 3600.' }, { status: 400 });
        }
        spotLengthSeconds = Math.round(n);
      }
    }

    // Datum vyroby drzime jako pulnoc UTC - v dokumentu se tiskne jen datum a
    // nesmi se posunout podle toho, v jakem pasmu se PDF vyrabi.
    let productionDate: Date | null | undefined;
    if (data.productionDate !== undefined) {
      if (data.productionDate === '') {
        productionDate = null;
      } else {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data.productionDate);
        if (!match) {
          return NextResponse.json({ error: 'Datum výroby má neplatný tvar.' }, { status: 400 });
        }
        productionDate = new Date(`${data.productionDate}T00:00:00.000Z`);
        if (Number.isNaN(productionDate.getTime())) {
          return NextResponse.json({ error: 'Datum výroby má neplatný tvar.' }, { status: 400 });
        }
      }
    }

    // Stav musi byt z nasi cesty projektu (lib/stavyProjektu.ts). Stary stav
    // prenesen z Caflou se da nechat byt, ale novy uz jde nastavit jen z naseho
    // ciselniku - jinak by se cesta projektu rozpadla na desitky variant.
    if (data.statusName && !jeNasStav(data.statusName)) {
      return NextResponse.json({ error: 'Tenhle stav projektu neznáme.' }, { status: 400 });
    }

    // Do databaze jde jen to, co prislo. Prazdny retezec znamena "smazat".
    const values: Record<string, unknown> = {};
    const text = (key: string, value: string | undefined) => {
      if (value !== undefined) values[key] = value ? value : null;
    };
    text('driveUrl', data.driveUrl);
    text('managerUserId', data.managerUserId);
    text('priority', data.priority);
    text('projectType', data.projectType);
    text('narrator', data.narrator);
    text('klientUserId', data.klientUserId);
    text('companyId', data.companyId);
    if (companyName !== undefined) values.companyName = companyName;
    if (data.statusName !== undefined) {
      values.statusName = data.statusName || null;
      // Rozpracovanost drzi krok se stavem, at zalozky Aktivni/Dokoncene
      // sedi bez toho, aby to nekdo prepinal zvlast.
      const dokonceny = stavJeDokonceny(data.statusName);
      if (dokonceny !== null) values.finished = dokonceny;
    }
    text('spotName', data.spotName);
    text('directorName', data.directorName);
    text('musicTitle', data.musicTitle);
    text('musicAuthor', data.musicAuthor);
    if (data.noMusic !== undefined) values.noMusic = data.noMusic;
    if (spotLengthSeconds !== undefined) values.spotLengthSeconds = spotLengthSeconds;
    if (productionDate !== undefined) values.productionDate = productionDate;

    const meta = await prisma.projectMeta.upsert({
      where: { caflouProjectId: params.id },
      create: { caflouProjectId: params.id, ...values },
      update: values,
      include: { company: { select: { caflouCompanyId: true } } },
    });

    // Rodny list se vyrabi pri prechodu do stavu "Dokonceno - ke schvaleni".
    // Driv se ten prechod poznaval porovnanim s poslednim stavem videnym
    // v Caflou; ted stav prehazuje clovek, takze se kontrola pousti tady.
    // Zamerne bez cekani - kdyby vyroba PDF vazla, ulozeni stavu to nesmi
    // zdrzet ani shodit.
    if (data.statusName !== undefined && meta.name) {
      void syncRodneListy([
        {
          caflouProjectId: meta.caflouProjectId,
          projectName: meta.name,
          statusName: meta.statusName ?? '',
          caflouCompanyId: meta.company?.caflouCompanyId ?? null,
        },
      ]).catch(() => undefined);
    }

    return NextResponse.json(meta);
  } catch (err) {
    console.error('PATCH /api/projects/[id]/meta selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}
