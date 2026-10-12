import { prisma } from '@/lib/db';
import { bezTitulu as bezTituluJmena } from '@/lib/jmena';

/**
 * KOMU JDE NABÍDKA (zadání 17. 9. 2026: „zasílání nabídek by mělo mít takovou
 * logiku, že nabídka se zasílá na mail klienta, který je nastaven u projektu").
 *
 * Do teď nabídka chodila na kontaktní e-mail FIRMY. U firem, kde má každý
 * projekt jiného člověka, to byla špatná adresa - a když firma kontakt
 * vyplněný neměla, portál odeslání odmítl větou „Firma nemá kontaktní e-mail",
 * i když u projektu klient s e-mailem seděl.
 *
 * Pořadí je tedy: KLIENT PROJEKTU, a teprve když projekt klienta nemá (nebo
 * nabídka na projekt navázaná není), kontakt firmy. Na obojí se neposílá -
 * nabídka je osobní dopis s podpisem, ne oběžník.
 *
 * Faktury se řídí něčím jiným (karta firmy, zaškrtávátko „faktury i klientovi")
 * a zůstávají, jak byly - viz /api/admin/invoices/[id]/send.
 */

export type PrijemceNabidky = {
  /** Adresy, na které nabídka půjde. Nejčastěji jedna. */
  emaily: string[];
  /** Jméno pro oslovení v mailu; prázdné = obecné „Dobrý den,". */
  jmeno: string | null;
  zdroj: 'nabidky' | 'klient' | 'firma';
};

/** Klient projektu s e-mailem, nebo `null`. */
export async function klientProjektu(
  caflouProjectId: string | null | undefined,
): Promise<{ email: string; jmeno: string | null } | null> {
  const id = (caflouProjectId ?? '').trim();
  if (!id) return null;
  try {
    const meta = await prisma.projectMeta.findUnique({
      where: { caflouProjectId: id },
      select: { klient: { select: { name: true, email: true, active: true } } },
    });
    const klient = meta?.klient;
    const email = klient?.email?.trim();
    if (!klient || !email) return null;
    return { email, jmeno: klient.name?.trim() || null };
  } catch (err) {
    console.error('Klienta projektu se nepodařilo načíst:', err);
    return null;
  }
}

/**
 * Komu nabídku poslat. `null` = není komu.
 *
 * VLASTNÍ ADRESY NA NABÍDKY MAJÍ PŘEDNOST (zadání 12. 10. 2026: „potřebuju
 * ještě u firem nastavit zvlášť maily na zasílání cenových nabídek").
 *
 * U větších klientů řeší cenu někdo jiný než běžný provoz zakázky. Když firma
 * tenhle seznam vyplněný má, nabídka jde JEN na něj - sečítat ho s klientem
 * projektu by znamenalo posílat cenu i tomu, kdo ji vidět nemá. Firma bez
 * seznamu se chová jako dosud.
 *
 * Oslovení se u téhle cesty nechává obecné: za adresou jako „nakup@firma.cz"
 * nikdo konkrétní stát nemusí a „Dobrý den, Jano," by bylo trapné.
 */
export async function najdiPrijemceNabidky(vstup: {
  caflouProjectId: string | null | undefined;
  company: {
    name: string;
    contactEmail: string | null;
    contactName: string | null;
    nabidkyEmaily?: string[] | null;
  };
}): Promise<PrijemceNabidky | null> {
  const naNabidky = (vstup.company.nabidkyEmaily ?? []).map((e) => e.trim()).filter(Boolean);
  if (naNabidky.length > 0) {
    return { emaily: naNabidky, jmeno: null, zdroj: 'nabidky' };
  }

  const klient = await klientProjektu(vstup.caflouProjectId);
  if (klient) return { emaily: [klient.email], jmeno: klient.jmeno, zdroj: 'klient' };

  const mailFirmy = vstup.company.contactEmail?.trim();
  if (mailFirmy) {
    return { emaily: [mailFirmy], jmeno: vstup.company.contactName?.trim() || null, zdroj: 'firma' };
  }
  return null;
}

/**
 * Klienti projektů do formuláře nabídky - ať je při psaní vidět, komu nabídka
 * půjde, a nezjistí se to až podle chybové hlášky při odeslání.
 *
 * Jedním dotazem pro celou stránku; jen projekty, které klienta s e-mailem
 * opravdu mají.
 */
export async function mapaKlientuProjektu(): Promise<
  Record<string, { jmeno: string | null; email: string }>
> {
  try {
    const radky = await prisma.projectMeta.findMany({
      where: { klientUserId: { not: null } },
      select: { caflouProjectId: true, klient: { select: { name: true, email: true } } },
    });
    const out: Record<string, { jmeno: string | null; email: string }> = {};
    for (const r of radky) {
      const email = r.klient?.email?.trim();
      if (!email) continue;
      out[r.caflouProjectId] = { jmeno: r.klient?.name?.trim() || null, email };
    }
    return out;
  } catch (err) {
    console.error('Klienty projektů se nepodařilo načíst:', err);
    return {};
  }
}

/**
 * HERCI PROJEKTU DO NABÍDKY (zadání 22. 9. 2026: „jakmile budu tvořit
 * nabídku, tak se mi nějakým tlačítkem přenesou [herci] i do položkového
 * rozpočtu a já si k nim napíšu jen ceny"). ID projektu → jména herců,
 * hlavní první; ruční jména z pole „herec" (bez účtu) na konci.
 */
export async function mapaHercuProjektu(): Promise<Record<string, string[]>> {
  try {
    const radky = await prisma.projectMeta.findMany({
      where: { OR: [{ herci: { some: {} } }, { narrator: { not: null } }], finished: false },
      select: {
        caflouProjectId: true,
        actorUserId: true,
        narrator: true,
        herci: { select: { id: true, name: true, email: true } },
      },
    });
    const out: Record<string, string[]> = {};
    for (const r of radky) {
      const ucty = [
        ...r.herci.filter((h) => h.id === r.actorUserId),
        ...r.herci.filter((h) => h.id !== r.actorUserId),
      ].map((h) => bezTituluJmena(h.name) || h.email);
      const rucne = (r.narrator ?? '')
        .split(/[,;\n]/)
        .map((x) => x.trim())
        .filter(Boolean);
      const vse = [...ucty, ...rucne.filter((j) => !ucty.includes(j))];
      if (vse.length) out[r.caflouProjectId] = vse;
    }
    return out;
  } catch (err) {
    console.error('Herce projektů se nepodařilo načíst:', err);
    return {};
  }
}
