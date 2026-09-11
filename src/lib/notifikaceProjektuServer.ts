import { prisma } from '@/lib/db';
import { STAVY_S_NOTIFIKACI, interniPrijemciFirmy } from '@/lib/notifikaceFirmy';
import { dosadPromenne } from '@/lib/vzoryZprav';
import { vzorProStav } from '@/lib/vzoryZpravServer';
import { sendStavProjektuEmail } from '@/lib/email';
import { zapisNotifikaci } from '@/lib/projektLogServer';
import { zajistiOdkaz, urlNahravek, urlPreposlechu } from '@/lib/preposlechOdkaz';

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
export const ZNACKA_PRVNI_TRACKY = 'prvni-tracky';

export function znackaStavu(stav: string): string {
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
  /**
   * `uvod` - věta navíc nad textem ze vzoru, napsaná ručně u konkrétního
   * odeslání (zadání 11. 9. 2026: „popošli to rovnou jen na Radku a omluv
   * se"). Vzor zůstává nedotčený. Používá se jen při ručním poslání znovu;
   * automatická zpráva při přehození stavu ji nikdy nemá.
   */
  moznosti?: { uvod?: string | null },
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
    /**
     * Klient je v „Komu", MY VE SKRYTÉ KOPII (zadání 11. 9. 2026: „nemůžeme
     * tam být vidět, kdyžtak to musí být ve skryté kopii").
     *
     * Do té doby jsme byli v „Komu" vedle klienta — bylo vidět, kdo všechno
     * u nás o jeho projektu ví, a odpověď „všem" by šla celé produkci.
     */
    const klientovi = nastaveni.komu !== 'INTERNE' && projekt.klient?.email ? [projekt.klient.email] : [];
    const prijemci = klientovi.length > 0 ? klientovi : nasi;
    const skrytaKopie = klientovi.length > 0 ? nasi : [];

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
     * ODKAZY V MAILU KLIENTOVI JSOU OTEVŘENÉ (zadání 11. 9. 2026: „potřebuju,
     * ať se klient nemusí přihlašovat a jsou ty odkazy otevřené, mnohdy to
     * někomu posílá").
     *
     * Do 11. 9. 2026 vedlo tlačítko na `/nahravky?projekt=…`, což je stránka
     * portálu za přihlášením. Klient, který účet nikdy neaktivoval, skončil
     * na přihlašovací obrazovce; přeposlaný odkaz nefungoval vůbec.
     *
     * Teď vede na `/nahravky/<token>` — stejný token jako AudioTagger, jeden
     * na projekt, neuhodnutelný a kdykoliv zrušitelný tlačítkem „Vygenerovat
     * nový" u projektu. Když se token nepodaří vyrobit, pošle se aspoň odkaz
     * na složku na Disku; kvůli odkazu se nesmí ztratit celá zpráva.
     *
     * INTERNÍ zpráva chodí dál do portálu — nás přihlášení nebrzdí a v
     * portálu máme u nahrávek všechno ostatní.
     */
    const zaklad = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
    const slozka = projekt.driveUrl || projekt.company?.driveFolderUrl || null;

    // Jeden token na projekt - pouziji ho obe tlacitka.
    const token = nastaveni.komu === 'INTERNE' ? null : await zajistiOdkaz(caflouProjectId, null);

    const odkazNaDisk = token
      ? urlNahravek(token)
      : projekt.companyId && slozka
        ? `${zaklad}/nahravky?projekt=${encodeURIComponent(caflouProjectId)}`
        : slozka;

    /**
     * Druhé tlačítko: „Přeposlechnout v AudioTaggeru" (zadání 11. 9. 2026).
     * Jen u zprávy o prvních tracích — u ostatních stavů není co poslouchat.
     */
    let odkazNaPreposlech: string | null = null;
    if (znackaStavu(stav) === ZNACKA_PRVNI_TRACKY && token) {
      odkazNaPreposlech = urlPreposlechu(token);
    }

    /**
     * Znění zprávy se bere ze VZORU (zadání 11. 9. 2026), ne z kódu. Proměnné
     * se dosazují až tady - vzor si pamatuje „{projekt}", ne konkrétní název,
     * takže se dá napsat jednou a platí pro všechny projekty.
     */
    const nazevProjektu = projekt.name || `Projekt ${caflouProjectId}`;
    const nazevFirmy = projekt.company?.name ?? projekt.companyName ?? '';
    const vzor = await vzorProStav(stav);
    const hodnoty = {
      projekt: nazevProjektu,
      firma: nazevFirmy,
      klient: projekt.klient?.name ?? '',
      stav,
    };

    const vysledek = await sendStavProjektuEmail({
      prijemci,
      skrytaKopie,
      jenInterne: nastaveni.komu === 'INTERNE',
      uvod: moznosti?.uvod ?? null,
      jmenoKlienta: projekt.klient?.name ?? null,
      nazevProjektu,
      nazevFirmy,
      stav,
      predmet: dosadPromenne(vzor.predmet, hodnoty),
      nadpis: dosadPromenne(vzor.nadpis, hodnoty),
      text: dosadPromenne(vzor.text, hodnoty),
      odkazNaDisk,
      odkazNaPreposlech,
    });

    if (!vysledek.sent) {
      await zapisNotifikaci({
        caflouProjectId,
        stav,
        popis: `Zprávu ke stavu „${stav}" se nepodařilo odeslat (${vysledek.reason ?? 'neznámý důvod'}).`,
        prijemci: [...prijemci, ...skrytaKopie],
      });
      return { stav: 'chyba', zprava: vysledek.reason ?? 'Nepodařilo se odeslat.' };
    }

    await prisma.notifikaceOdeslana.create({
      data: { caflouProjectId, znacka, prijemci: [...prijemci, ...skrytaKopie].join(', ') },
    });

    // Do historie projektu (zadani 10. 9. 2026) - at je videt, kdy co komu
    // odeslo. Prave kvuli tomu, ze zprava odchazi sama, je to potreba.
    await zapisNotifikaci({
      caflouProjectId,
      stav,
      popis:
        nastaveni.komu === 'INTERNE'
          ? `Zpráva ke stavu „${stav}" odešla jen nám interně.`
          : `Zpráva ke stavu „${stav}" odešla klientovi, nám ve skryté kopii.`,
      // Do historie patri i skryta kopie - at je dohledatelne, kdo to dostal.
      prijemci: [...prijemci, ...skrytaKopie],
    });

    return { stav: 'odeslano', prijemci: [...prijemci, ...skrytaKopie] };
  } catch (err) {
    console.error('posliNotifikaciKeStavu selhalo:', err);
    return { stav: 'chyba', zprava: err instanceof Error ? err.message : 'Neznámá chyba.' };
  }
}
