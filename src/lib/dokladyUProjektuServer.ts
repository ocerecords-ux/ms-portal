import { prisma } from '@/lib/db';
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
  const poradi: StavFakturyDokladu[] = ['ZADNA', 'ROZEPSANA', 'UHRAZENA', 'VYSTAVENA'];
  return poradi.indexOf(a) >= poradi.indexOf(b) ? a : b;
}

export async function dokladyUProjektu(
  caflouProjectIds: string[],
): Promise<Map<string, DokladyProjektu>> {
  const vysledek = new Map<string, DokladyProjektu>();
  const ids = Array.from(new Set(caflouProjectIds.filter(Boolean)));
  if (ids.length === 0) return vysledek;

  const [nabidky, faktury] = await Promise.all([
    prisma.offer
      .findMany({
        where: { caflouProjectId: { in: ids } },
        select: { caflouProjectId: true, number: true, status: true },
      })
      .catch(() => []),
    prisma.invoice
      .findMany({
        where: { caflouProjectId: { in: ids }, status: { not: 'CANCELLED' } },
        select: { caflouProjectId: true, number: true, status: true },
      })
      .catch(() => []),
  ]);

  const dej = (id: string): DokladyProjektu => {
    const stavajici = vysledek.get(id);
    if (stavajici) return stavajici;
    const novy = { ...PRAZDNE_DOKLADY, nabidkaCisla: [], fakturaCisla: [] };
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
    zaznam.nabidka = lepsiNabidka(zaznam.nabidka, stav);
    zaznam.nabidkaCisla.push(n.number);
  }

  for (const f of faktury) {
    if (!f.caflouProjectId) continue;
    const zaznam = dej(f.caflouProjectId);
    const stav: StavFakturyDokladu =
      f.status === 'PAID' ? 'UHRAZENA' : f.status === 'SENT' ? 'VYSTAVENA' : 'ROZEPSANA';
    zaznam.faktura = lepsiFaktura(zaznam.faktura, stav);
    zaznam.fakturaCisla.push(f.number);
  }

  return vysledek;
}
