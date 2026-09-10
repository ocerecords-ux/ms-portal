import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canEditProjectMeta } from '@/lib/roles';
import { vytvorSlozkuProjektu } from '@/lib/googleDrive';
import { STAVY_PROJEKTU, jeNasStav, stavJeDokonceny } from '@/lib/stavyProjektu';
import { zapisZalozeniProjektu } from '@/lib/projektLogServer';

/**
 * Založení projektu v portálu (zadání 10. 9. 2026: "teď potřebuju, aby šlo
 * přidat projekt").
 *
 * Do 10. 9. 2026 projekty vznikaly v Caflou a portál je jen četl. Mediaspace
 * Caflou opouští, takže od téhle chvíle projekt vzniká tady.
 *
 * ID PROJEKTU: doklady, výkazy, rozpočty i rodné listy si projekt drží jako
 * číslo v textu - tak to bylo v Caflou. Nový projekt proto dostane číslo
 * odvozené z času založení, ne náhodný řetězec: vazby se tím chovají stejně
 * jako u přenesených projektů a s ničím z Caflou se nemůže srazit (Caflou
 * čísluje od jedničky, tohle je řádově miliardy).
 */
export const dynamic = 'force-dynamic';
// Zakladani slozky na Disku muze chvili trvat.
export const maxDuration = 60;

const schema = z.object({
  name: z.string().trim().min(1, 'Vyplňte název projektu.').max(300),
  companyId: z.string().trim().optional(),
  klientUserId: z.string().trim().optional(),
  projectType: z.string().trim().optional(),
  managerUserId: z.string().trim().optional(),
  priority: z.enum(['', 'LOW', 'MEDIUM', 'HIGH']).optional(),
  /** Ucet herce - herec je konkretni osoba, ne text (zadani 10. 9. 2026). */
  actorUserId: z.string().trim().optional(),
  /** Prichazi jako text z <input type="number">. */
  pageCount: z.union([z.string().trim(), z.number()]).optional(),
  /** YYYY-MM-DD. */
  releaseDate: z.string().trim().optional(),
  statusName: z.string().trim().max(120).optional(),
  /** Zakladat slozku na Disku? Kdyz uz slozka existuje, da se to vypnout. */
  zalozitSlozku: z.boolean().optional(),
});

/** Číslo projektu odvozené z času - viz poznámka k ID nahoře. */
function noveIdProjektu(): string {
  return String(Date.now());
}

function naDatum(hodnota?: string): Date | null {
  if (!hodnota) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hodnota)) return null;
  const d = new Date(`${hodnota}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !canEditProjectMeta(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění zakládat projekty.' }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const d = parsed.data;

    // Firma: nepovinna, ale bez ni nejde zalozit slozku ani poslat notifikace.
    let companyName: string | null = null;
    let slozkaFirmy: string | null = null;
    if (d.companyId) {
      const firma = await prisma.company.findUnique({
        where: { id: d.companyId },
        select: { name: true, driveFolderUrl: true },
      });
      if (!firma) return NextResponse.json({ error: 'Vybraná firma neexistuje.' }, { status: 400 });
      companyName = firma.name;
      slozkaFirmy = firma.driveFolderUrl;
    }

    if (d.actorUserId) {
      const herec = await prisma.user.findFirst({
        where: { id: d.actorUserId, role: 'HEREC' },
        select: { id: true },
      });
      if (!herec) return NextResponse.json({ error: 'Vybraný herec neexistuje.' }, { status: 400 });
    }

    if (d.klientUserId) {
      const klient = await prisma.user.findFirst({
        where: { id: d.klientUserId, role: 'CLIENT' },
        select: { id: true },
      });
      if (!klient) return NextResponse.json({ error: 'Vybraný klient neexistuje.' }, { status: 400 });
    }

    if (d.projectType) {
      const polozka = await prisma.priceListItem.findUnique({ where: { name: d.projectType } });
      if (!polozka) {
        return NextResponse.json({ error: 'Typ projektu musí být položka z ceníku.' }, { status: 400 });
      }
    }

    const stav = d.statusName && jeNasStav(d.statusName) ? d.statusName : STAVY_PROJEKTU[0].nazev;

    let pageCount: number | null = null;
    if (d.pageCount !== undefined && d.pageCount !== '') {
      const n = Number(d.pageCount);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: 'Počet normostran musí být číslo.' }, { status: 400 });
      }
      pageCount = Math.round(n);
    }

    // Slozka na Disku. Kdyz se nepovede, projekt se presto zalozi - odkaz se
    // doplni rucne. Prijit o zadani projektu kvuli Disku by bylo horsi.
    let driveUrl: string | null = null;
    let varovaniDisk: string | null = null;
    if (d.zalozitSlozku !== false) {
      if (!slozkaFirmy) {
        varovaniDisk = companyName
          ? `Firma ${companyName} nemá v portálu vyplněný odkaz na svou složku, takže složku projektu nešlo založit.`
          : 'Bez vybrané firmy nejde složku projektu založit.';
      } else {
        const vysledek = await vytvorSlozkuProjektu(slozkaFirmy, d.name);
        if ('chyba' in vysledek) varovaniDisk = vysledek.chyba;
        else driveUrl = vysledek.url;
      }
    }

    const caflouProjectId = noveIdProjektu();

    const projekt = await prisma.projectMeta.create({
      data: {
        caflouProjectId,
        name: d.name,
        companyId: d.companyId || null,
        companyName,
        klientUserId: d.klientUserId || null,
        projectType: d.projectType || null,
        managerUserId: d.managerUserId || null,
        // Vychozi stredni priorita (zadani 10. 9. 2026) - stejne jako ve
        // formulari, aby ji projekt zalozeny odjinud (napr. z objednavky)
        // nemel prazdnou.
        priority: d.priority || 'MEDIUM',
        actorUserId: d.actorUserId || null,
        pageCount,
        releaseDate: naDatum(d.releaseDate),
        statusName: stav,
        finished: stavJeDokonceny(stav) ?? false,
        driveUrl,
        zdroj: 'PORTAL',
      },
    });

    // Prvni radek historie projektu (zadani 10. 9. 2026). Bez cekani - zaznam
    // o praci nesmi zdrzet zalozeni projektu.
    void zapisZalozeniProjektu(caflouProjectId, d.name, {
      id: session.user.id,
      jmeno: session.user.name || session.user.email,
    }).catch(() => undefined);

    return NextResponse.json({ id: projekt.caflouProjectId, varovaniDisk }, { status: 201 });
  } catch (err) {
    console.error('POST /api/admin/projekty selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Projekt se nepodařilo založit (${message}).` }, { status: 500 });
  }
}
