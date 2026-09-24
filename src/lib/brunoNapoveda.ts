import { prisma } from '@/lib/db';
import { canSee } from '@/lib/menu';
import { sediDruh, vidiNavod } from '@/lib/navody';
import { druhyUzivatele } from '@/lib/navodyServer';
import type { Role } from '@prisma/client';

/**
 * CO BRUNO VÍ O PORTÁLU (zadání 23. 9. 2026: „Bruno musí mít ponětí o celém
 * portálu. Měl by pro všechny fungovat jako nápověda, v rámci omezení práv.
 * Když bude třeba někdo něco hledat, tak mu pošle rovnou odkaz, aby ho
 * navedl").
 *
 * Do teď Bruno znal příručku „jak to u nás chodí" a jeden kanál chatu -
 * o stránkách portálu nevěděl nic, takže na „kde najdu kalendář" odpovídal,
 * že vidí jen chaty k projektům.
 *
 * DVA ZDROJE, OBA ŽIVÉ:
 *  - MAPA STRÁNEK se skládá z lib/menu.ts (PAGE_ACCESS), takže sedí s tím,
 *    kam koho portál opravdu pustí. Nová stránka stačí popsat jednou větou
 *    níž a Bruno o ní ví.
 *  - NÁVODY se čtou z databáze (/napoveda). Co někdo dopíše nebo přejmenuje,
 *    Bruno hned zná - a posílá na to odkaz místo vlastního vyprávění.
 *
 * PRÁVA SE NEOBCHÁZÍ. Každý dostane jen to, co sám vidí: zvukaři se
 * o honorářích herců ani o administraci nedozví, protože v jeho seznamu
 * nejsou. Bruno tím nic neodemyká - jen ukazuje cestu k tomu, co tam ten
 * člověk stejně má.
 */

/** Jedna věta ke každé stránce - víc Bruno nepotřebuje, zbytek je v návodech. */
const STRANKY: { href: string; nazev: string; popis: string }[] = [
  { href: '/projekty', nazev: 'Projekty', popis: 'seznam všech zakázek, jejich stavy, herci, termíny; detail projektu má karty Rozpočet, Doklady, Přeposlech, Připomínky a historii' },
  { href: '/kalendar', nazev: 'Kalendář', popis: 'natáčecí termíny a blokace studií - kdo, kdy, ve kterém studiu; tady se zapisují frekvence, castingy a režie na dálku' },
  { href: '/moje-terminy', nazev: 'Moje termíny', popis: 'termíny herce a potvrzování nabídnutých frekvencí' },
  { href: '/prehledy', nazev: 'Přehledy', popis: 'vytížení studií (kapacita) a backlog - jestli stíháme termíny' },
  { href: '/backlog', nazev: 'Backlog', popis: 'co je po termínu nebo se blíží, je to i záložka v Přehledech' },
  { href: '/vykazy', nazev: 'Výkazy', popis: 'odpracované hodiny zvukařů - zápis i přehled za tým' },
  { href: '/honorare', nazev: 'Honoráře', popis: 'honoráře herce: navrženo, čeká na proplacení, zaplaceno' },
  { href: '/nahravky', nazev: 'Nahrávky', popis: 'hotové nahrávky pro klienta ke stažení a schválení' },
  { href: '/objednavka', nazev: 'Objednávka', popis: 'objednávkový formulář pro klienta' },
  { href: '/pozvanky', nazev: 'Pozvánky', popis: 'pozvání herce do portálu a hlídání, kdo se ještě nepřihlásil' },
  { href: '/napoveda', nazev: 'Nápověda', popis: 'návody k portálu - celé znění, sem posílej, když je na téma návod' },
  { href: '/muj-ucet', nazev: 'Můj účet', popis: 'vlastní údaje, fotka, podpis, ranní přehled a nastavení upozornění' },
  { href: '/tabule/moje', nazev: 'Tabule', popis: 'tabule do studia - co se ten den natáčí' },
  { href: '/admin', nazev: 'Firmy (administrace)', popis: 'klientské firmy, jejich údaje, druh zakázek a sazby' },
  { href: '/admin/users', nazev: 'Uživatelé', popis: 'účty lidí, role, práva, příznaky (kdo co dostává)' },
  { href: '/admin/ceniky', nazev: 'Ceníky', popis: 'typy projektů, sazby, licence' },
  { href: '/admin/studia', nazev: 'Studia', popis: 'studia, jejich barvy, odkazy na videohovory a vedoucí poboček' },
  { href: '/admin/doklady', nazev: 'Doklady', popis: 'faktury, zálohy, náklady a párování s bankou' },
  { href: '/admin/archiv', nazev: 'Archiv', popis: 'smazané záznamy - odsud se dají vrátit' },
  { href: '/admin/navody', nazev: 'Návody (správa)', popis: 'psaní a úpravy návodů v Nápovědě' },
  { href: '/admin/bruno', nazev: 'Bruno', popis: 'příručka „jak to u nás chodí", ze které čtu' },
  { href: '/admin/udaje', nazev: 'Údaje odkazem', popis: 'žádosti o údaje herců a firem přes odkaz' },
  { href: '/admin/vzory-zprav', nazev: 'Vzory zpráv', popis: 'předlohy mailů, které portál posílá' },
  { href: '/admin/zpravy-portalu', nazev: 'Zprávy portálu', popis: 'co portál rozeslal - kontrola odchozích zpráv' },
];

/**
 * Mapa portálu a seznam návodů pro JEDNOHO člověka - jen to, kam se dostane.
 * Prázdný text (role bez přístupu kamkoliv) se do zadání nevkládá.
 */
export async function napovedaProRoli(role: Role | string, userId?: string): Promise<string> {
  const jakoRole = role as Role;

  const stranky = STRANKY.filter((s) => canSee(s.href, jakoRole));

  const navody = await prisma.navod
    .findMany({
      where: { zverejneno: true },
      select: { slug: true, nazev: true, perex: true, kategorie: true, proRole: true, proDruhy: true },
      orderBy: [{ kategorie: 'asc' }, { poradi: 'asc' }],
    })
    .catch(() => []);

  // Klientovi jen navody na druh zakazek, ktery u nas ma (24. 9. 2026).
  const druhy = userId ? await druhyUzivatele(userId) : null;
  const moje = navody.filter(
    (n) => vidiNavod(n.proRole, String(role)) && sediDruh(n.proDruhy ?? [], druhy),
  );

  const casti: string[] = [];

  if (stranky.length > 0) {
    casti.push(
      `CO KDE V PORTÁLU JE (tenhle člověk to vidí; odkaz piš přesně tak, jak je tady):\n` +
        stranky.map((s) => `- ${s.nazev} (${s.href}) — ${s.popis}`).join('\n'),
    );
  }

  if (moje.length > 0) {
    casti.push(
      `NÁVODY K PORTÁLU (celé znění je pod odkazem — když se hodí, pošli ho místo vlastního vyprávění):\n` +
        moje
          .map((n) => `- ${n.nazev} (/napoveda/${n.slug})${n.perex ? ` — ${n.perex}` : ''}`)
          .join('\n'),
    );
  }

  return casti.join('\n\n');
}
