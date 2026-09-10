import { prisma } from '@/lib/db';
import { CO_SE_POSILA, STAVY_S_NOTIFIKACI, interniPrijemciFirmy } from '@/lib/notifikaceFirmy';
import { sendStavProjektuEmail } from '@/lib/email';

/**
 * Odeslání zprávy o změně stavu projektu (zadání 10. 9. 2026).
 *
 * KDO ROZHODUJE: nastavení u firmy (karta firmy → záložka Notifikace). Co
 * tam není zapnuté, se neposílá - proto se nemůže stát, že by zpráva odešla
 * klientovi, se kterým to není domluvené. Nová firma má vždycky všechno
 * vypnuté.
 *
 * NIKDY NEVYHAZUJE: přehození stavu je hlavní věc, kterou člověk dělá.
 * Kdyby ho shodilo to, že nejede SMTP, byla by to ta horší varianta - chyba
 * se jen zapíše do logu.
 */

/**
 * Značka zprávy - podle ní se pozná, co už odešlo.
 *
 * Stavy "Natáčíme/stříháme" a "Dotočeno/stříháme" říkají klientovi totéž:
 * na disku jsou první tracky. V praxi nastane skoro vždycky nejdřív ten
 * první, takže druhá zpráva by byla jen opakování. Sdílejí proto jednu
 * značku a odejde jen ta dřívější (zadání 10. 9. 2026).
 */
const ZNACKA_PRVNI_TRACKY = 'prvni-tracky';

function znackaStavu(stav: string): string {
  if (stav === 'Natáčíme/stříháme' || stav === 'Dotočeno/stříháme') return ZNACKA_PRVNI_TRACKY;
  return stav;
}

export type VysledekNotifikace =
  | { stav: 'odeslano'; prijemci: string[] }
  | { stav: 'vypnuto' }
  | { stav: 'jiz-odeslano' }
  | { stav: 'chybi-prijemce' }
  | { stav: 'chyba'; zprava: string };

/**
 * Pošle zprávu, pokud si to firma u tohohle stavu přeje.
 *
 * Volá se ve chvíli, kdy člověk přehodí stav - z detailu projektu i ze
 * seznamu, obojí jde přes /api/projects/[id]/meta.
 */
export async function posliNotifikaciKeStavu(
  caflouProjectId: string,
  stav: string,
): Promise<VysledekNotifikace> {
  try {
    if (!STAVY_S_NOTIFIKACI.includes(stav)) return { stav: 'vypnuto' };

    const projekt = await prisma.projectMeta.findUnique({
      where: { caflouProjectId },
      select: {
        name: true,
        driveUrl: true,
        companyId: true,
        companyName: true,
        company: { select: { name: true, driveFolderUrl: true, interniPrijemci: true } },
        klient: { select: { name: true, email: true } },
      },
    });
    if (!projekt?.companyId) return { stav: 'vypnuto' };

    const nastaveni = await prisma.notifikaceFirmy.findUnique({
      where: { companyId_stav: { companyId: projekt.companyId, stav } },
      select: { komu: true },
    });
    if (!nastaveni || nastaveni.komu === 'NIKAM') return { stav: 'vypnuto' };

    // Uz odeslano? Pomaha to i pri prehazovani stavu tam a zpatky.
    const znacka = znackaStavu(stav);
    const uz = await prisma.notifikaceOdeslana.findUnique({
      where: { caflouProjectId_znacka: { caflouProjectId, znacka } },
      select: { id: true },
    });
    if (uz) return { stav: 'jiz-odeslano' };

    // Komu z nas to jde - nastavuje se na karte firmy (zadani 10. 9. 2026).
    // U zpravy klientovi jdeme v kopii i my, at je videt, co odeslo.
    const nasi = interniPrijemciFirmy(projekt.company?.interniPrijemci);
    const prijemci =
      nastaveni.komu === 'INTERNE'
        ? nasi
        : [projekt.klient?.email, ...nasi].filter((e): e is string => Boolean(e));

    if (nastaveni.komu === 'KLIENT' && !projekt.klient?.email) {
      // Projekt nema vyplneneho klienta - poslat "klientovi" nejde. Zapisujeme
      // to jako duvod, ne jako chybu; casto to znamena jen nedodelany projekt.
      console.warn(`Notifikace ke stavu "${stav}": projekt ${caflouProjectId} nemá klienta.`);
      return { stav: 'chybi-prijemce' };
    }

    const odkazNaDisk = projekt.driveUrl || projekt.company?.driveFolderUrl || null;

    const vysledek = await sendStavProjektuEmail({
      prijemci,
      jenInterne: nastaveni.komu === 'INTERNE',
      jmenoKlienta: projekt.klient?.name ?? null,
      nazevProjektu: projekt.name || `Projekt ${caflouProjectId}`,
      nazevFirmy: projekt.company?.name ?? projekt.companyName ?? '',
      stav,
      text: CO_SE_POSILA[stav] ?? '',
      odkazNaDisk,
    });

    if (!vysledek.sent) {
      return { stav: 'chyba', zprava: vysledek.reason ?? 'Nepodařilo se odeslat.' };
    }

    await prisma.notifikaceOdeslana.create({
      data: { caflouProjectId, znacka, prijemci: prijemci.join(', ') },
    });

    return { stav: 'odeslano', prijemci };
  } catch (err) {
    console.error('posliNotifikaciKeStavu selhalo:', err);
    return { stav: 'chyba', zprava: err instanceof Error ? err.message : 'Neznámá chyba.' };
  }
}
