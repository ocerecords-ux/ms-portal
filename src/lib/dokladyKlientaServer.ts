import { prisma } from '@/lib/db';

/**
 * DOKLADY, KTERÉ KLIENT VIDÍ U SVÉ ZAKÁZKY (zadání 1. 10. 2026: „tady budou
 * ikony dokladů Nabídka, faktura a objednávka (objednávka z webu v pdf)…
 * když kliknu na tu ikonu, tak to bude vypadat a fungovat, jako to máme my
 * u projektů + tlačítko kde se otevře celý náhled PDF a půjde i stáhnout").
 *
 * JEN ODESLANÉ A DÁL (rozhodnutí 1. 10. 2026). Rozepsaná nabídka ani rozepsaná
 * faktura se klientovi neukážou — ani to, že existují. Doklad, který u nás
 * teprve vzniká, se ještě mění a klient by se ptal na číslo, které zítra
 * nebude platit. Stornovaná faktura je pryč taky: po storně vyfakturováno
 * není.
 *
 * VŠECHNO JE VÁZANÉ NA FIRMU KLIENTA. Klíč izolace je companyId ze session -
 * stejně jako u přehledu projektů. Doklad bez firmy nebo cizí firmy se
 * nenačte, i kdyby na projektu visel.
 */

export type DruhDokladuKlienta = 'NABIDKA' | 'FAKTURA' | 'OBJEDNAVKA';

export type DokladKlienta = {
  druh: DruhDokladuKlienta;
  id: string;
  /** Do bublinky u ikony: „Nabídka 2026-0042 — čeká na schválení". */
  popis: string;
  /** Rozsvěcuje ikonu: zelená = hotovo/schváleno, oranžová = čeká, šedá = ostatní. */
  barva: 'zelena' | 'oranzova' | 'seda' | 'cervena';
};

/** Stavy, ve kterých doklad klientovi ukazujeme. */
const NABIDKA_VIDITELNA = ['SENT', 'APPROVED', 'REJECTED'];
const FAKTURA_VIDITELNA = ['SENT', 'PAID'];

export async function dokladyProKlienta(
  caflouProjectIds: string[],
  companyId: string | null | undefined,
): Promise<Record<string, DokladKlienta[]>> {
  const vysledek: Record<string, DokladKlienta[]> = {};
  const ids = Array.from(new Set(caflouProjectIds.filter(Boolean)));
  if (ids.length === 0 || !companyId) return vysledek;

  try {
    const [nabidky, faktury, objednavky] = await Promise.all([
      prisma.offer
        .findMany({
          where: { caflouProjectId: { in: ids }, companyId, status: { in: NABIDKA_VIDITELNA } },
          select: { id: true, caflouProjectId: true, number: true, status: true },
        })
        .catch(() => []),
      prisma.invoice
        .findMany({
          where: { caflouProjectId: { in: ids }, companyId, status: { in: FAKTURA_VIDITELNA } },
          select: { id: true, caflouProjectId: true, number: true, status: true },
        })
        .catch(() => []),
      prisma.order
        .findMany({
          where: { caflouProjectId: { in: ids }, companyId },
          select: { id: true, caflouProjectId: true, title: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        })
        .catch(() => []),
    ]);

    const pridej = (projekt: string | null | undefined, doklad: DokladKlienta) => {
      if (!projekt) return;
      (vysledek[projekt] ??= []).push(doklad);
    };

    for (const n of nabidky as { id: string; caflouProjectId: string | null; number: string; status: string }[]) {
      pridej(n.caflouProjectId, {
        druh: 'NABIDKA',
        id: n.id,
        popis:
          n.status === 'APPROVED'
            ? `Nabídka ${n.number} — schválená`
            : n.status === 'REJECTED'
              ? `Nabídka ${n.number} — odmítnutá`
              : `Nabídka ${n.number} — čeká na schválení`,
        barva: n.status === 'APPROVED' ? 'zelena' : n.status === 'REJECTED' ? 'cervena' : 'oranzova',
      });
    }

    for (const f of faktury as { id: string; caflouProjectId: string | null; number: string; status: string }[]) {
      pridej(f.caflouProjectId, {
        druh: 'FAKTURA',
        id: f.id,
        popis: f.status === 'PAID' ? `Faktura ${f.number} — uhrazená` : `Faktura ${f.number} — k úhradě`,
        barva: f.status === 'PAID' ? 'zelena' : 'oranzova',
      });
    }

    for (const o of objednavky as { id: string; caflouProjectId: string | null; title: string }[]) {
      pridej(o.caflouProjectId, {
        druh: 'OBJEDNAVKA',
        id: o.id,
        popis: `Objednávka ${cisloObjednavky(o.id)}`,
        barva: 'seda',
      });
    }

    return vysledek;
  } catch (err) {
    console.error('Načtení dokladů pro klienta selhalo:', err);
    return {};
  }
}

/**
 * Objednávka nemá číselnou řadu (nevzniká v dokladech, ale na webu), tak se
 * čte podle konce jejího id. Je to jen vizitka do hlavičky PDF a do bublinky,
 * nic se podle toho nedohledává.
 */
export function cisloObjednavky(id: string): string {
  return id.slice(-6).toUpperCase();
}
