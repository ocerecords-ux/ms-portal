import { prisma } from '@/lib/db';
import { bezTitulu } from '@/lib/jmena';
import { sjednotLokace } from '@/lib/lokaceHercu';

/**
 * ROZLIŠENÍ SOUJMENOVCŮ (zadání 9. 10. 2026: „máme teď v portálu dva herce,
 * kteří se jmenují stejně - Ondřej Novák. Jeden je z Prahy a druhý z Brna.
 * Potřeboval bych je ale v systému nějak odlišit… Ale ne jméno v kartě, aby
 * se to nepropsalo někde na doklady. Jen ať se to rozlišuje v té bublině").
 *
 * JMÉNO NA KARTĚ SE NEMĚNÍ. Kdyby se do `user.name` dopsalo „ - Brno",
 * vytisklo by se to na smlouvu, na honorář i do rodného listu - tedy přesně
 * tam, kam město nepatří. Rozlišení proto nikde neleží; dopočítává se při
 * vykreslení ze `studioLocations`, které už na kartě herce jsou. Tím je to
 * ZPĚTNÉ samo od sebe: projekty natočené loni se v seznamu rozliší stejně
 * jako ty dnešní a v databázi se nic nepřepisuje.
 *
 * ROZLIŠUJÍ SE JEN JMÉNA, KTERÁ NOSÍ VÍC LIDÍ. Dopisovat město ke každému
 * herci by seznam jen zašumělo - u jediné Terezy Jarčevské není co plést.
 */

export type RozlisovacHercu = (id: string, jmeno: string) => string;

/** Srovnané jméno na porovnání - bez titulů, diakritiky a velikosti písmen. */
function klicJmena(jmeno: string): string {
  return bezTitulu(jmeno)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Načte herce a vrátí funkci, která ke jménu přidá rozlišení - ale jen tam,
 * kde je ho potřeba. Volá se jednou na stránku, ne na každý řádek.
 *
 * NIKDY NEVYHAZUJE: když se dotaz nepovede, vrátí se jména beze změny.
 * Kvůli popisku nemá spadnout celý přehled projektů.
 */
export async function nactiRozliseniHercu(): Promise<RozlisovacHercu> {
  try {
    const herci = (await prisma.user.findMany({
      where: { role: 'HEREC' },
      select: { id: true, name: true, email: true, code: true, studioLocations: true },
    })) as { id: string; name: string | null; email: string; code: string | null; studioLocations: string[] }[];

    const podleJmena = new Map<string, typeof herci>();
    for (const h of herci) {
      const klic = klicJmena(h.name || h.email);
      if (!klic) continue;
      const skupina = podleJmena.get(klic);
      if (skupina) skupina.push(h);
      else podleJmena.set(klic, [h]);
    }

    const rozliseni = new Map<string, string>();
    for (const skupina of podleJmena.values()) {
      if (skupina.length < 2) continue;

      // Nejdřív město - to je to, čím je od sebe člověk pozná.
      const mesta = skupina.map((h) => sjednotLokace(h.studioLocations).join('/'));
      // Když ani města nerozlišují (dva Brňáci, nebo nikdo nemá lokaci),
      // sáhne se po kódu z karty. Nic hezkého, ale jednoznačné.
      const jednoznacna = mesta.every((m) => m) && new Set(mesta).size === skupina.length;

      skupina.forEach((h, i) => {
        const popis = jednoznacna ? mesta[i] : h.code || mesta[i];
        if (popis) rozliseni.set(h.id, popis);
      });
    }

    return (id: string, jmeno: string) => {
      const popis = rozliseni.get(id);
      return popis ? `${jmeno} - ${popis}` : jmeno;
    };
  } catch (err) {
    console.error('Rozlišení soujmenovců se nepodařilo načíst:', err);
    return (_id: string, jmeno: string) => jmeno;
  }
}
