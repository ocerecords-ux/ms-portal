import { nazvySluzeb } from '@/lib/sluzbyReklamy';
import { popisDelky } from '@/lib/vystupy';

/**
 * CO BYLO V OBJEDNÁVCE (zadání 1. 10. 2026) — jedno čtení pro bublinku
 * v přehledu i pro PDF, ať se ty dvě verze nerozejdou.
 *
 * Bere se SNÍMEK objednávky tak, jak ji klient odeslal, ne dnešní stav
 * projektu. Když se u zakázky mezitím přidá výstup nebo posune termín,
 * objednávka o tom nic neví a vědět nemá — je to doklad o tom, co si klient
 * objednal.
 *
 * Prázdná pole se vynechávají. U audioknihy se nikdy nevyplňují služby
 * a výstupy, u reklamy zase rozsah v normostranách; vypisovat „—" u poloviny
 * řádků by z objednávky udělalo formulář, ne doklad.
 */

type VystupObjednavky = {
  nazev?: string | null;
  delkaSekund?: number | null;
  sluzby?: string[] | null;
  downcuty?: number[] | null;
};

export type ObjednavkaObsah = {
  radky: { popis: string; hodnota: string }[];
  bloky: { popis: string; text: string }[];
};

/** Objednávka tak, jak ji potřebuje popis — jen pole, na kterých stojí. */
export type ObjednavkaProPopis = {
  kind: string;
  title: string;
  pageCount: number | null;
  deadline: Date | null;
  note: string | null;
  preferredNarrator: string | null;
  sluzby: string[];
  vystupy: unknown;
  attachmentName: string | null;
  autorKnihy?: string | null;
  prekladatelKnihy?: string | null;
  nakladatelstviKnihy?: string | null;
  uvodKnihy?: string | null;
  zaverKnihy?: string | null;
};

const den = (d: Date | null | undefined) =>
  d ? d.toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague' }) : null;

/** Řádek „Hlavní spot · 60 s · + downcuty 30, 20 s". */
function popisVystupu(v: VystupObjednavky): string {
  const casti = [v.nazev?.trim() || 'Výstup'];
  const delka = popisDelky(v.delkaSekund ?? null);
  if (delka) casti.push(delka);
  const sluzby = nazvySluzeb(v.sluzby ?? []);
  if (sluzby.length > 0) casti.push(sluzby.join(', '));
  const downcuty = (v.downcuty ?? []).filter((d) => typeof d === 'number');
  if (downcuty.length > 0) casti.push(`zkrácené verze ${downcuty.join(', ')} s`);
  return casti.join(' · ');
}

export function popisObjednavky(objednavka: ObjednavkaProPopis): ObjednavkaObsah {
  const radky: { popis: string; hodnota: string }[] = [];
  const pridej = (popis: string, hodnota: string | null | undefined) => {
    if (hodnota && hodnota.trim()) radky.push({ popis, hodnota: hodnota.trim() });
  };

  pridej('Druh', objednavka.kind === 'AD' ? 'Reklama' : 'Audiokniha');
  pridej('Název', objednavka.title);
  pridej('Rozsah', objednavka.pageCount ? `${objednavka.pageCount} normostran` : null);
  pridej('Termín', den(objednavka.deadline));
  pridej('Preferovaný herec', objednavka.preferredNarrator);
  pridej('Objednané služby', nazvySluzeb(objednavka.sluzby).join(', ') || null);

  const vystupy = Array.isArray(objednavka.vystupy) ? (objednavka.vystupy as VystupObjednavky[]) : [];
  vystupy.forEach((v, i) => {
    pridej(i === 0 ? 'Výstupy' : ' ', popisVystupu(v));
  });

  pridej('Autor', objednavka.autorKnihy);
  pridej('Překlad', objednavka.prekladatelKnihy);
  pridej('Nakladatelství', objednavka.nakladatelstviKnihy);
  pridej('Přiložený text', objednavka.attachmentName);

  const bloky: { popis: string; text: string }[] = [];
  if (objednavka.note?.trim()) bloky.push({ popis: 'POZNÁMKA', text: objednavka.note.trim() });
  if (objednavka.uvodKnihy?.trim()) bloky.push({ popis: 'ÚVOD KNIHY', text: objednavka.uvodKnihy.trim() });
  if (objednavka.zaverKnihy?.trim()) bloky.push({ popis: 'ZÁVĚR KNIHY', text: objednavka.zaverKnihy.trim() });

  return { radky, bloky };
}
