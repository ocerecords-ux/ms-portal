import { prisma } from '@/lib/db';
import { nazevSpotuZVystupu, sDedenim, type VystupData } from '@/lib/vystupy';
import { nactiVystupy } from '@/lib/vystupyServer';
import { sluzbaPodleKlice } from '@/lib/sluzbyReklamy';

/**
 * NABÍDKA Z VÝSTUPŮ (zadání 26. 9. 2026, etapa 5: „každý výstup × každá jeho
 * služba = jedna položka… klient pak na faktuře vidí přesně to, co dostal").
 *
 * CENY SE NEHÁDAJÍ. Ceník na reklamy se teprve dodělává (26. 9. 2026: „ceníky
 * budu muset ještě domyslet"), takže se cena doplní jen tam, kde položka
 * ceníku opravdu existuje a má vyplněnou částku. Zbytek jde do nabídky
 * s nulou a čeká na doplnění - vymyšlená cena v rozpracovaném dokladu je
 * horší než prázdné místo, které je při čtení vidět.
 *
 * DOKLAD JE ROZPRACOVANÝ. Nabídka vzniká jako DRAFT přes stejnou cestu jako
 * ručně založená (číslo z číselné řady), takže klientovi nic neodejde, dokud
 * ji někdo neodešle.
 */

export type PolozkaZVystupu = {
  description: string;
  quantity: number;
  unit: string;
  unitPriceMinor: number;
  vatRate: number;
  sortOrder: number;
};

/**
 * Položky nabídky poskládané z výstupů projektu. Prázdné pole znamená, že
 * projekt výstupy nemá nebo u nich nikdo nezaškrtl žádnou službu.
 */
export async function polozkyZVystupu(
  caflouProjectId: string,
  nazevProjektu: string,
): Promise<PolozkaZVystupu[]> {
  const vsechny = await nactiVystupy(caflouProjectId);
  if (vsechny.length === 0) return [];

  const podleId = new Map(vsechny.map((v) => [v.id, v]));
  const cenik = (await prisma.priceListItem
    .findMany({ select: { name: true, priceExVat: true } })
    .catch(() => [])) as { name: string; priceExVat: number | null }[];
  const ceny = new Map<string, number | null>(cenik.map((c) => [c.name, c.priceExVat]));

  const polozky: PolozkaZVystupu[] = [];
  let poradi = 0;

  for (const syrovy of vsechny) {
    const v: VystupData = sDedenim(
      syrovy,
      syrovy.odvozenoZId ? podleId.get(syrovy.odvozenoZId) ?? null : null,
    );
    // Co se na výstupu nedělá, se nefakturuje.
    if (v.sluzby.length === 0) continue;

    const popisVystupu = nazevSpotuZVystupu(v, nazevProjektu);

    for (const klic of v.sluzby) {
      const sluzba = sluzbaPodleKlice(klic);
      if (!sluzba) continue;
      // Cena jen z ceníku, a jen když tam opravdu je (viz poznámka výš).
      const cena: number | null = sluzba.cenik ? ceny.get(sluzba.cenik) ?? null : null;
      polozky.push({
        description: `${sluzba.nazev} — ${popisVystupu}`,
        quantity: 1,
        unit: 'ks',
        unitPriceMinor: cena && cena > 0 ? Math.round(cena * 100) : 0,
        vatRate: 21,
        sortOrder: poradi,
      });
      poradi += 1;
    }
  }

  return polozky;
}

/** Krátké shrnutí do tlačítka - „4 výstupy, 7 položek". */
export function souhrnNabidky(pocetVystupu: number, pocetPolozek: number): string {
  const vystupy =
    pocetVystupu === 1 ? '1 výstup' : pocetVystupu < 5 ? `${pocetVystupu} výstupy` : `${pocetVystupu} výstupů`;
  const polozky =
    pocetPolozek === 1 ? '1 položka' : pocetPolozek < 5 ? `${pocetPolozek} položky` : `${pocetPolozek} položek`;
  return `${vystupy}, ${polozky}`;
}

/**
 * Založí rozpracovanou nabídku z výstupů projektu. Vrací číslo dokladu, nebo
 * důvod, proč to nešlo - volající ho ukáže u tlačítka.
 */
export async function zalozNabidkuZVystupu(
  caflouProjectId: string,
  nazevProjektu: string,
): Promise<{ ok: true; id: string; number: string } | { ok: false; duvod: string }> {
  try {
    const polozky = await polozkyZVystupu(caflouProjectId, nazevProjektu);
    if (polozky.length === 0) {
      return {
        ok: false,
        duvod: 'Není z čeho nabídku složit — u výstupů není zaškrtnutá žádná služba.',
      };
    }

    /**
     * DRUHÁ NABÍDKA NA TUTÉŽ ZAKÁZKU JE CHYBA - stejné pravidlo jako u návrhu
     * z objednávky. Tlačítko se dá zmáčknout dvakrát a nikdo by si dvou
     * očíslovaných dokladů nemusel všimnout; kdo opravdu chce druhou, založí
     * ji v Dokladech ručně.
     */
    const uz = await prisma.offer.findFirst({
      where: { caflouProjectId },
      select: { number: true },
    });
    if (uz) {
      return {
        ok: false,
        duvod: `U projektu už nabídka je (${uz.number}) — další založte v Dokladech.`,
      };
    }

    const meta = await prisma.projectMeta.findUnique({
      where: { caflouProjectId },
      select: { companyId: true },
    });
    if (!meta?.companyId) {
      return { ok: false, duvod: 'Projekt nemá napojenou firmu — nabídka by neměla odběratele.' };
    }

    const issuer = await prisma.issuerCompany.findFirst({
      where: { active: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, offerNextNumber: true, offerNumberFormat: true, defaultCurrency: true },
    });
    if (!issuer) return { ok: false, duvod: 'Není nastavená žádná vlastní firma.' };

    const { randomBytes } = await import('crypto');
    const { expandNumberFormat } = await import('@/lib/doklady');

    // Číslo z číselné řady jako u ručně založené nabídky; když je obsazené
    // (ručně posunutá řada, souběh), zkusí se další.
    let sequence = issuer.offerNextNumber;
    for (let pokus = 0; pokus < 20; pokus++) {
      const number = expandNumberFormat(issuer.offerNumberFormat, sequence);
      const obsazeno = await prisma.offer.findUnique({ where: { number }, select: { id: true } });
      if (obsazeno) {
        sequence += 1;
        continue;
      }

      const offer = await prisma.$transaction(async (tx) => {
        const vytvorena = await tx.offer.create({
          data: {
            number,
            issuerCompanyId: issuer.id,
            companyId: meta.companyId as string,
            currency: issuer.defaultCurrency,
            subject: nazevProjektu,
            caflouProjectId,
            projectName: nazevProjektu,
            approvalToken: randomBytes(24).toString('base64url'),
            items: { create: polozky },
          },
          select: { id: true, number: true },
        });
        await tx.issuerCompany.update({
          where: { id: issuer.id },
          data: { offerNextNumber: sequence + 1 },
        });
        return vytvorena;
      });

      return { ok: true, id: offer.id, number: offer.number };
    }

    return { ok: false, duvod: 'Číslo nabídky se nepodařilo přidělit.' };
  } catch (err) {
    console.error(`Nabídku z výstupů projektu ${caflouProjectId} se nepodařilo založit:`, err);
    return { ok: false, duvod: 'Nabídku se nepodařilo založit.' };
  }
}
