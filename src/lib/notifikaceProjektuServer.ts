import { prisma } from '@/lib/db';
import { CO_SE_POSILA, STAVY_S_NOTIFIKACI, interniPrijemciFirmy } from '@/lib/notifikaceFirmy';
import { sendStavProjektuEmail } from '@/lib/email';
import { zapisNotifikaci } from '@/lib/projektLogServer';
import { zajistiOdkaz, urlPreposlechu } from '@/lib/preposlechOdkaz';

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
      await zapisNotifikaci({
        caflouProjectId,
        stav,
        popis: `Zpráva ke stavu „${stav}" neodešla — projekt nemá vyplněného klienta.`,
      });
      return { stav: 'chybi-prijemce' };
    }

    /**
     * Odkaz v mailu vede do NAŠICH Nahrávek, ne na Google Disk (zadání
     * 10. 9. 2026: „chci, ať se mu to otevře v tom našem disku Nahrávky
     * obrandovaném, v barvách").
     *
     * Klient tak zůstane v portálu, kde nahrávky vypadají jako od nás a dají
     * se rovnou poslechnout. Na Google Disk ho pošleme jen tehdy, když
     * projekt ještě nemáme v portálu spárovaný s firmou - to by se mu
     * stránka Nahrávek neotevřela a odkaz do prázdna je horší než odkaz
     * jinam.
     */
    const zaklad = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
    const slozka = projekt.driveUrl || projekt.company?.driveFolderUrl || null;
    const odkazNaDisk = projekt.companyId && slozka
      ? `${zaklad}/nahravky?projekt=${encodeURIComponent(caflouProjectId)}`
      : slozka;

    /**
     * Druhé tlačítko: „Přeposlechnout v AudioTaggeru" (zadání 11. 9. 2026).
     *
     * Jen u zprávy o prvních tracích — u ostatních stavů není co poslouchat.
     * Odkaz je tokenový a otevře se na celou obrazovku bez přihlašování; na
     * projekt je živý vždycky jeden, takže opakované zprávy ten předchozí
     * nezneplatní. Když se token nepodaří vyrobit, odejde zpráva jen se
     * složkou — kvůli odkazu navíc se rozhodně nesmí ztratit celá zpráva.
     */
    let odkazNaPreposlech: string | null = null;
    if (znackaStavu(stav) === ZNACKA_PRVNI_TRACKY && nastaveni.komu !== 'INTERNE') {
      const token = await zajistiOdkaz(caflouProjectId, null);
      if (token) odkazNaPreposlech = urlPreposlechu(token);
    }

    const vysledek = await sendStavProjektuEmail({
      prijemci,
      jenInterne: nastaveni.komu === 'INTERNE',
      jmenoKlienta: projekt.klient?.name ?? null,
      nazevProjektu: projekt.name || `Projekt ${caflouProjectId}`,
      nazevFirmy: projekt.company?.name ?? projekt.companyName ?? '',
      stav,
      text: CO_SE_POSILA[stav] ?? '',
      odkazNaDisk,
      odkazNaPreposlech,
    });

    if (!vysledek.sent) {
      await zapisNotifikaci({
        caflouProjectId,
        stav,
        popis: `Zprávu ke stavu „${stav}" se nepodařilo odeslat (${vysledek.reason ?? 'neznámý důvod'}).`,
        prijemci,
      });
      return { stav: 'chyba', zprava: vysledek.reason ?? 'Nepodařilo se odeslat.' };
    }

    await prisma.notifikaceOdeslana.create({
      data: { caflouProjectId, znacka, prijemci: prijemci.join(', ') },
    });

    // Do historie projektu (zadani 10. 9. 2026) - at je videt, kdy co komu
    // odeslo. Prave kvuli tomu, ze zprava odchazi sama, je to potreba.
    await zapisNotifikaci({
      caflouProjectId,
      stav,
      popis:
        nastaveni.komu === 'INTERNE'
          ? `Zpráva ke stavu „${stav}" odešla jen nám interně.`
          : `Zpráva ke stavu „${stav}" odešla klientovi.`,
      prijemci,
    });

    return { stav: 'odeslano', prijemci };
  } catch (err) {
    console.error('posliNotifikaciKeStavu selhalo:', err);
    return { stav: 'chyba', zprava: err instanceof Error ? err.message : 'Neznámá chyba.' };
  }
}
