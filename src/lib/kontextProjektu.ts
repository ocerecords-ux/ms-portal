import { prisma } from '@/lib/db';
import { prelozit, type Jazyk } from '@/lib/jazyk';
import { listRodnyListProjectTypes } from '@/lib/priceList';
import { druhNotifikaceFirmy } from '@/lib/notifikaceFirmy';
import { parametryProjektu } from '@/lib/technickeParametryServer';

/**
 * CO MÁ ČLOVĚK VIDĚT NAD DOKLADEM, KTERÝ OTEVŘEL Z PROJEKTU
 * (zadání 7. 10. 2026: „když otevřu nějaký doklad, tak potřebuji být pořád
 * na této stránce a vidět tyto záložky").
 *
 * Doklad má vlastní stránku a tak to zůstává - jen nad něj přibude hlavička
 * projektu a tentýž pásek záložek, takže se z projektu nevypadne.
 *
 * ZÁLOŽKY SE POČÍTAJÍ ZNOVU, NE OPISUJÍ. Na detailu projektu se každá záložka
 * staví i s obsahem (stovky řádků), sem se hodí jen názvy - takže tady jsou
 * jen ty samé podmínky nad levnými dotazy. Kdo přidá novou záložku do
 * src/app/(portal)/projekty/[id]/page.tsx, ať ji přidá i sem; kdyby se na to
 * zapomnělo, nejhorší následek je, že odkaz na neexistující záložku otevře
 * Přehled (viz ProjectTabs).
 *
 * POČÍTÁ SE S TÍM, ŽE KOUKÁ ŽŮŽO-LABŮŽO: doklady jinam než do administrace
 * nevedou, takže `isInternalRole`, `canEdit` i `canViewProjectDocuments`
 * jsou tu vždycky splněné a neptáme se na ně.
 */
export type KontextProjektu = {
  caflouProjectId: string;
  nazev: string;
  firma: string | null;
  finished: boolean;
  statusName: string;
  zalozky: { klic: string; nazev: string }[];
};

export async function nactiKontextProjektu(
  caflouProjectId: string | null | undefined,
  jazyk: Jazyk,
): Promise<KontextProjektu | null> {
  const id = caflouProjectId?.trim();
  if (!id) return null;

  try {
    const meta = (await prisma.projectMeta.findUnique({
      where: { caflouProjectId: id },
      select: {
        name: true,
        finished: true,
        statusName: true,
        projectType: true,
        pageCount: true,
        company: { select: { name: true, dealsAudiobooks: true, dealsAds: true } },
      },
    })) as {
      name: string | null;
      finished: boolean | null;
      statusName: string | null;
      projectType: string | null;
      pageCount: number | null;
      company: { name: string; dealsAudiobooks: boolean | null; dealsAds: boolean | null } | null;
    } | null;
    if (!meta) return null;

    const [rodnyListTypy, parametry] = await Promise.all([
      listRodnyListProjectTypes(),
      parametryProjektu(id),
    ]);

    const firma = meta.company;
    const jeRadiovySpot = rodnyListTypy.includes(meta.projectType ?? '');
    const jeReklama = druhNotifikaceFirmy(firma) === 'REKLAMA';
    const jeReklamniProjekt = jeRadiovySpot || jeReklama;
    // Rozpočet se počítá jen audioknihám, a to až když jsou známé normostrany.
    const maRozpocet = firma?.dealsAudiobooks === true && (meta.pageCount ?? 0) > 0;

    const zalozky: { klic: string; nazev: string }[] = [
      { klic: 'prehled', nazev: prelozit(jazyk, 'projekt.zalozka.prehled') },
    ];
    if (parametry) {
      zalozky.push({
        klic: 'technicke-parametry',
        nazev: prelozit(jazyk, 'projekt.zalozka.technickeParametry'),
      });
    }
    if (jeReklamniProjekt) {
      zalozky.push({ klic: 'vystupy', nazev: prelozit(jazyk, 'projekt.zalozka.vystupy') });
    }
    if (maRozpocet) {
      zalozky.push({ klic: 'rozpocet', nazev: prelozit(jazyk, 'projekt.zalozka.rozpocet') });
    }
    zalozky.push({ klic: 'frekvence', nazev: prelozit(jazyk, 'projekt.zalozka.frekvence') });
    if (jeRadiovySpot) {
      zalozky.push({ klic: 'rodny-list', nazev: prelozit(jazyk, 'projekt.zalozka.rodnyList') });
    }
    if ((jeReklama || Boolean(firma?.dealsAds)) && !jeRadiovySpot) {
      zalozky.push({
        klic: 'licencni-list',
        nazev: prelozit(jazyk, 'projekt.zalozka.licencniList'),
      });
    }
    // Reklama se nepřeposlouchává proti textu - místo Přeposlechu má Připomínky.
    zalozky.push(
      jeReklama
        ? { klic: 'pripominky', nazev: prelozit(jazyk, 'projekt.zalozka.pripominky') }
        : { klic: 'preposlech', nazev: prelozit(jazyk, 'projekt.zalozka.preposlech') },
    );
    zalozky.push({ klic: 'protokol', nazev: prelozit(jazyk, 'projekt.zalozka.protokol') });
    zalozky.push({ klic: 'poznamky', nazev: prelozit(jazyk, 'projekt.zalozka.poznamky') });
    zalozky.push({ klic: 'historie', nazev: prelozit(jazyk, 'projekt.zalozka.historie') });
    zalozky.push({ klic: 'doklady', nazev: prelozit(jazyk, 'projekt.zalozka.doklady') });

    return {
      caflouProjectId: id,
      nazev: meta.name?.trim() || id,
      firma: firma?.name ?? null,
      finished: meta.finished ?? false,
      statusName: meta.statusName ?? '',
      zalozky,
    };
  } catch {
    // Hlavička je navíc, ne nutná - když se nenačte, doklad se ukáže bez ní.
    return null;
  }
}
