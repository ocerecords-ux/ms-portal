import { prisma } from '@/lib/db';
import { zkratkaCasti } from '@/lib/fakturaCast';
import type { Jazyk } from '@/lib/jazyk';
import {
  PRAZDNE_DOKLADY,
  type DokladyProjektu,
  type StavFakturyDokladu,
  type StavNabidkyDokladu,
} from '@/lib/dokladyUProjektu';

/**
 * JAKÉ DOKLADY U PROJEKTU VISÍ (zadání 25. 9. 2026: „ať mi to tam svítí a vím
 * rovnou, co je vyfakturováno a co ne"). Jedním dotazem pro celý přehled -
 * doklad po dokladu by to bylo padesát dotazů na jednu stránku.
 *
 * Stornované faktury se nepočítají: zakázka po storně vyfakturovaná není.
 */
function lepsiNabidka(a: StavNabidkyDokladu, b: StavNabidkyDokladu): StavNabidkyDokladu {
  const poradi: StavNabidkyDokladu[] = ['ZADNA', 'ODMITNUTA', 'ROZEPSANA', 'CEKA', 'SCHVALENA'];
  return poradi.indexOf(a) >= poradi.indexOf(b) ? a : b;
}

function lepsiFaktura(a: StavFakturyDokladu, b: StavFakturyDokladu): StavFakturyDokladu {
  // Nezaplacená faktura je důležitější než zaplacená - na tu se čeká.
  // Neodeslaná je nade všemi (29. 10. 2026): zakázka, jejíž faktura nikam
  // nedošla, na zaplacení čekat nebude.
  const poradi: StavFakturyDokladu[] = [
    'ZADNA',
    'ROZEPSANA',
    'UHRAZENA',
    'VYSTAVENA',
    'NEODESLANA',
  ];
  return poradi.indexOf(a) >= poradi.indexOf(b) ? a : b;
}

export async function dokladyUProjektu(
  caflouProjectIds: string[],
  /** Značka části zakázky v bublince se od dávky 7h překládá podle kódu. */
  jazyk: Jazyk = 'cs',
): Promise<Map<string, DokladyProjektu>> {
  const vysledek = new Map<string, DokladyProjektu>();
  const ids = Array.from(new Set(caflouProjectIds.filter(Boolean)));
  if (ids.length === 0) return vysledek;

  const [nabidky, faktury] = await Promise.all([
    prisma.offer
      .findMany({
        where: { caflouProjectId: { in: ids } },
        select: { id: true, caflouProjectId: true, number: true, status: true },
      })
      .catch(() => []),
    prisma.invoice
      .findMany({
        where: { caflouProjectId: { in: ids }, status: { not: 'CANCELLED' } },
        select: {
          id: true,
          caflouProjectId: true,
          number: true,
          status: true,
          interniCast: true,
          chybaOdeslani: true,
        },
      })
      .catch(() => []),
  ]);

  const dej = (id: string): DokladyProjektu => {
    const stavajici = vysledek.get(id);
    if (stavajici) return stavajici;
    const novy = { ...PRAZDNE_DOKLADY, nabidkaCisla: [], fakturaCisla: [], fakturaChyba: null };
    vysledek.set(id, novy);
    return novy;
  };

  for (const n of nabidky) {
    if (!n.caflouProjectId) continue;
    const zaznam = dej(n.caflouProjectId);
    const stav: StavNabidkyDokladu =
      n.status === 'APPROVED'
        ? 'SCHVALENA'
        : n.status === 'REJECTED'
          ? 'ODMITNUTA'
          : n.status === 'SENT'
            ? 'CEKA'
            : 'ROZEPSANA';
    // Doklad, který o značce rozhodl - na něj vede dvojklik (25. 9. 2026).
    if (lepsiNabidka(zaznam.nabidka, stav) !== zaznam.nabidka || !zaznam.nabidkaId) {
      zaznam.nabidkaId = n.id;
    }
    zaznam.nabidka = lepsiNabidka(zaznam.nabidka, stav);
    zaznam.nabidkaCisla.push(n.number);
  }

  for (const f of faktury) {
    if (!f.caflouProjectId) continue;
    const zaznam = dej(f.caflouProjectId);
    const stav: StavFakturyDokladu = f.chybaOdeslani
      ? 'NEODESLANA'
      : f.status === 'PAID'
        ? 'UHRAZENA'
        : f.status === 'SENT'
          ? 'VYSTAVENA'
          : 'ROZEPSANA';
    if (lepsiFaktura(zaznam.faktura, stav) !== zaznam.faktura || !zaznam.fakturaId) {
      zaznam.fakturaId = f.id;
      zaznam.fakturaChyba = f.chybaOdeslani ?? null;
    }
    zaznam.faktura = lepsiFaktura(zaznam.faktura, stav);
    // U zakázky na dvě části je v bublince vidět, o kterou z nich jde
    // (29. 9. 2026) - jinak jsou v přehledu dvě stejně vypadající faktury.
    const cast = zkratkaCasti(f.interniCast, jazyk);
    zaznam.fakturaCisla.push(cast ? `${f.number} — ${cast}` : f.number);
  }

  return vysledek;
}
