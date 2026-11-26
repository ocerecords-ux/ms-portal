import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  kandidatiNaPozvanku,
  otazkyAkce as otazkyZAkce,
  pozvankyAkce,
  smiSpravovatAkce,
} from '@/lib/akceServer';
import { ocistiNakup } from '@/lib/akce';
import { AkceSprava } from './AkceSprava';

/**
 * FIREMNÍ AKCE (zadání 25. 11. 2026: „pozvánky na vánoční večírek, abych
 * mohl rozeslat ze systému… chci to ovládat jen já").
 *
 * Celá sekce je za příznakem `spravujeAkce` na kartě účtu - role nestačí,
 * Žůžo-labůžo je víc lidí a večírek chystá jeden. Kdo příznak nemá, sem
 * nedojde ani odkazem.
 */
export const dynamic = 'force-dynamic';

/** „2026-12-19T18:00" pro <input type="datetime-local"> v čase Prahy. */
function proVstup(d: Date | null, sCasem: boolean): string {
  if (!d) return '';
  const casti = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  // sv-SE dává „2026-12-19 18:00"; datetime-local chce „T" uprostřed.
  const [datum, cas] = casti.split(' ');
  return sCasem ? `${datum}T${cas}` : datum;
}

export default async function AkcePage({ searchParams }: { searchParams: { id?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  if (!(await smiSpravovatAkce(session.user.id))) redirect('/projekty');

  const akce = await prisma.akce
    .findMany({ orderBy: [{ createdAt: 'desc' }], take: 50 })
    .catch(() => [] as { id: string; nazev: string }[]);

  const vybranaId = searchParams.id || (akce[0] as { id?: string } | undefined)?.id || null;
  const vybrana = (akce as { id: string }[]).find((a) => a.id === vybranaId) ?? null;

  const [pozvanky, kandidati] = await Promise.all([
    vybrana ? pozvankyAkce(vybrana.id) : Promise.resolve([]),
    kandidatiNaPozvanku(),
  ]);

  const a = vybrana as
    | {
        id: string;
        nazev: string;
        kdy: Date | null;
        misto: string | null;
        mapa: string | null;
        text: string | null;
        textPotvrzeni: string | null;
        textPripomenuti: string | null;
        odpovedDo: Date | null;
        otazky?: unknown;
        nakup?: unknown;
      }
    | null;

  return (
    <AkceSprava
      akce={(akce as { id: string; nazev: string }[]).map((x) => ({ id: x.id, nazev: x.nazev }))}
      vybrana={
        a
          ? {
              id: a.id,
              nazev: a.nazev,
              kdy: proVstup(a.kdy, true),
              misto: a.misto ?? '',
              mapa: a.mapa ?? '',
              text: a.text ?? '',
              textPotvrzeni: a.textPotvrzeni ?? '',
              textPripomenuti: a.textPripomenuti ?? '',
              odpovedDo: proVstup(a.odpovedDo, false),
            }
          : null
      }
      otazkyAkce={otazkyZAkce(a)}
      nakupAkce={ocistiNakup(a?.nakup ?? [])}
      pozvanky={pozvanky}
      kandidati={kandidati}
    />
  );
}
