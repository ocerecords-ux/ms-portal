import { prisma } from '@/lib/db';

/**
 * REŽII SI CHODÍ DĚLAT KLIENT (zadání 12. 10. 2026: „u klienta Jan Melvil si
 * chodí režírovat Veronika González první frekvence vždy sama. Takže já
 * u režie na dálku nejsem. Můžeme to nějak nastavit u té firmy? Tu první
 * frekvenci bych ji tam dal vždy automaticky a pak aby si mohla v natáčecím
 * plánu v portálu zaškrtnout, na které chce ještě přijít. My bychom měli
 * vidět v kalendáři jako Režie: Veronika González").
 *
 * STEJNÉ PRAVIDLO JAKO U NAŠÍ REŽIE NA DÁLKU (lib/rezieOnline.ts), jen místo
 * nás chodí člověk od klienta: PRVNÍ frekvenci každého herce na projektu má
 * automaticky, u ostatních se čeká, až si je zaškrtne. Značka se neukládá
 * u každé frekvence - počítá se z kalendáře a u konkrétní události může být
 * uložená výjimka (`rezieKlienta` true / false), která má přednost.
 *
 * KDE SE TO NASTAVUJE: na kartě firmy, pole „Režii si dělá klient" - ukládá
 * se ÚČET toho člověka (Company.rezieKlientaUserId), ne jméno. Ten člověk se
 * do portálu přihlašuje a termíny si v natáčecím plánu odškrtává, takže ho
 * portál musí poznat.
 */

export type ReziserKlienta = {
  /** Účet toho, kdo od klienta chodí režírovat - podle něj se pozná, kdo smí zaškrtávat. */
  userId: string;
  /** Jméno do kalendáře („Režie: Veronika González"). */
  jmeno: string;
};

/**
 * KE KTERÝM PROJEKTŮM CHODÍ REŽÍROVAT KLIENT. Klíč je caflouProjectId.
 *
 * Firem s tímhle nastavením je pár, takže se napřed načtou ony - a teprve
 * když nějaká je, dohledají se projekty. Běžný kalendář tak má navíc jeden
 * levný dotaz a nic víc.
 *
 * PROJEKT SE K FIRMĚ HLEDÁ I PODLE NÁZVU: starší zakázky převzaté z Caflou
 * mají u sebe jen jméno firmy, ne odkaz na kartu - stejné pravidlo jako
 * u hromadného přiřazení klienta na kartě firmy.
 */
export async function nactiReziseryKlientu(
  caflouProjectIds: (string | null | undefined)[],
): Promise<Map<string, ReziserKlienta>> {
  const vysledek = new Map<string, ReziserKlienta>();
  const ids = Array.from(
    new Set(caflouProjectIds.map((x) => (x ?? '').trim()).filter((x) => x !== '')),
  );
  if (ids.length === 0) return vysledek;

  const firmy = (await prisma.company
    .findMany({
      where: { rezieKlientaUserId: { not: null } },
      select: {
        id: true,
        name: true,
        rezieKlientaUserId: true,
        rezieKlienta: { select: { name: true, email: true } },
      },
    })
    .catch(() => [])) as unknown as {
    id: string;
    name: string;
    rezieKlientaUserId: string | null;
    rezieKlienta: { name: string | null; email: string } | null;
  }[];
  if (firmy.length === 0) return vysledek;

  const projekty = (await prisma.projectMeta
    .findMany({
      where: { caflouProjectId: { in: ids } },
      select: { caflouProjectId: true, companyId: true, companyName: true },
    })
    .catch(() => [])) as unknown as {
    caflouProjectId: string;
    companyId: string | null;
    companyName: string | null;
  }[];

  const srovnej = (x: string | null | undefined) => (x ?? '').trim().toLocaleLowerCase('cs');
  const podleId = new Map(firmy.map((f) => [f.id, f]));
  const podleJmena = new Map(firmy.map((f) => [srovnej(f.name), f]));

  for (const p of projekty) {
    const firma =
      (p.companyId ? podleId.get(p.companyId) : undefined) ??
      (p.companyName ? podleJmena.get(srovnej(p.companyName)) : undefined);
    if (!firma?.rezieKlientaUserId) continue;
    vysledek.set(p.caflouProjectId, {
      userId: firma.rezieKlientaUserId,
      jmeno: firma.rezieKlienta?.name?.trim() || firma.rezieKlienta?.email || '',
    });
  }
  return vysledek;
}

/**
 * Přijde klient režírovat na tuhle frekvenci? `ulozene` je výjimka uložená
 * u události (true / false), `jePrvni` výsledek výpočtu z kalendáře.
 */
export function prijdeRezieKlienta(
  ulozene: boolean | null | undefined,
  jePrvni: boolean,
): boolean {
  if (ulozene === true) return true;
  if (ulozene === false) return false;
  return jePrvni;
}
