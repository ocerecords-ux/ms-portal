import { prisma } from '@/lib/db';
import {
  druhNotifikaceFirmy,
  stavySNotifikaci,
  interniPrijemciStavu,
  STAV_PREPOSLECH_HOTOVO,
} from '@/lib/notifikaceFirmy';
import { dosadPromenne } from '@/lib/vzoryZprav';
import { jeStavBezNotifikaci, stavMaNahravky } from '@/lib/stavyProjektu';
import { pozdrav } from '@/lib/osloveni';
import { vzorProStav } from '@/lib/vzoryZpravServer';
import { sendStavProjektuEmail, buildStavProjektuHtml } from '@/lib/email';
import { zapisNotifikaci } from '@/lib/projektLogServer';
import { zajistiOdkaz, urlNahravek, urlPreposlechu, urlPripominek } from '@/lib/preposlechOdkaz';
import { nazevSeSerii } from '@/lib/serie';

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
    const projekt = await prisma.projectMeta.findUnique({
      where: { caflouProjectId },
      select: {
        name: true,
        serie: true,
        serieDil: true,
        driveUrl: true,
        companyId: true,
        companyName: true,
        statusName: true,
        company: {
          select: {
            name: true,
            driveFolderUrl: true,
            interniPrijemci: true,
            // Druh zprav se ridi zaskrtavatky „Druh zakazek" na karte firmy.
            dealsAudiobooks: true,
            dealsAds: true,
          },
        },
        klient: { select: { name: true, email: true } },
      },
    });
    if (!projekt?.companyId) return { stav: 'vypnuto' };

    /**
     * Z „Opravujeme" klientovi nic nechodí (zadání 27. 9. 2026: „v tomto stavu
     * nejdou žádné notifikace"). Míč je na naší straně - zapracováváme jeho
     * připomínky - a zpráva o tom, že na něco čekáme, by byla nepravda.
     * Hlídá se to tady, u jediných dveří ven, ne u každého volajícího zvlášť.
     */
    if (jeStavBezNotifikaci(projekt.statusName) || jeStavBezNotifikaci(stav)) {
      return { stav: 'vypnuto' };
    }

    /**
     * DVA DRUHY ZPRAV (zadani 14. 9. 2026). Audiokniha vzniká po krocích a
     * klient chce vědět o každém; reklama je hotová naráz, takže se posílá
     * jediná zpráva, a to ve stavu „Dokončeno - ke schválení". Právě proto
     * se seznam stavů ptá až po zjištění druhu - u reklamy jsou ostatní
     * stavy mimo hru, i kdyby je firma měla zapnuté.
     */
    const druh = druhNotifikaceFirmy(projekt.company);
    if (!stavySNotifikaci(druh).includes(stav)) return { stav: 'vypnuto' };

    const ulozene = await prisma.notifikaceFirmy.findUnique({
      where: { companyId_stav: { companyId: projekt.companyId, stav } },
      select: { komu: true, interniPrijemci: true, klientiEmaily: true },
    });
    /**
     * „Přeposlech dokončen" chodí klientovi i bez nastavení (25. 9. 2026) -
     * je to potvrzení toho, co klient sám právě udělal, a firmy uložené
     * nastavení pro tenhle řádek zatím nemají. Vypnout se dá jako cokoliv
     * jiného: na kartě firmy na „Neposílat".
     */
    const nastaveni =
      ulozene ?? (stav === STAV_PREPOSLECH_HOTOVO ? { komu: 'KLIENT' as const } : null);
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
    // Od 12. 10. 2026 nejdřív seznam u STAVU, teprve když je prázdný, ten
    // firemní - u některých stavů má být okruh užší než u zbytku.
    const nasi = interniPrijemciStavu(
      ulozene?.interniPrijemci,
      projekt.company?.interniPrijemci,
    );
    /**
     * Klient je v „Komu", MY VE SKRYTÉ KOPII (zadání 11. 9. 2026: „nemůžeme
     * tam být vidět, kdyžtak to musí být ve skryté kopii").
     *
     * Do té doby jsme byli v „Komu" vedle klienta — bylo vidět, kdo všechno
     * u nás o jeho projektu ví, a odpověď „všem" by šla celé produkci.
     */
    /**
     * ADRESY U STAVU MAJÍ PŘEDNOST PŘED KLIENTEM PROJEKTU (zadání 20. 10.
     * 2026: „a pak ještě zvlášť na stav dokončeno - ke schválení").
     *
     * Spot schvaluje často někdo jiný, než kdo zakázku objednal, a u reklam
     * to bývá celá skupina lidí. Vyplněný seznam u stavu proto klienta
     * projektu NAHRAZUJE - sčítat obojí by znamenalo posílat schvalovací
     * odkaz i tomu, kdo s ním nemá co dělat.
     */
    const uStavu = ((ulozene as { klientiEmaily?: string[] | null } | null)?.klientiEmaily ?? [])
      .map((e) => e.trim())
      .filter(Boolean);
    const klientovi =
      nastaveni.komu === 'INTERNE'
        ? []
        : uStavu.length > 0
          ? uStavu
          : projekt.klient?.email
            ? [projekt.klient.email]
            : [];
    const prijemci = klientovi.length > 0 ? klientovi : nasi;
    const skrytaKopie = klientovi.length > 0 ? nasi : [];

    if (nastaveni.komu === 'KLIENT' && klientovi.length === 0) {
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

    /**
     * TLAČÍTKO DO SLOŽKY JEN TAM, KDE UŽ NĚCO JE (zadání 30. 10. 2026: „u
     * dotočeno ještě nemáme žádnou nahrávku, takže to tlačítko na složku je
     * zbytečné a zavádějící").
     *
     * Rozhoduje stav, ne přítomnost souborů na Disku: ve stavech před prvním
     * trackem se zelené tlačítko vůbec nevykreslí. Klient tak nedostane
     * pozvánku do prázdné složky - viz stavMaNahravky v lib/stavyProjektu.ts.
     */
    const odkazNaDisk = !stavMaNahravky(stav)
      ? null
      : token
        ? urlNahravek(token)
        : projekt.companyId && slozka
          ? `${zaklad}/nahravky?projekt=${encodeURIComponent(caflouProjectId)}`
          : slozka;

    /**
     * Znění zprávy se bere ze VZORU (zadání 11. 9. 2026), ne z kódu. Proměnné
     * se dosazují až tady - vzor si pamatuje „{projekt}", ne konkrétní název,
     * takže se dá napsat jednou a platí pro všechny projekty.
     */
    /**
     * V POŠTĚ SE SÉRIE PÍŠE CELÁ (14. 10. 2026). V portálu z ní je kolečko
     * u názvu, ale v mailu se klient musí poznat, o který díl jde - viz
     * nazevSeSerii v lib/serie.ts.
     */
    const nazevProjektu =
      nazevSeSerii(projekt.name, projekt.serie, projekt.serieDil) || `Projekt ${caflouProjectId}`;
    const nazevFirmy = projekt.company?.name ?? projekt.companyName ?? '';
    const vzor = await vzorProStav(stav, druh);

    /**
     * Druhé tlačítko: „Přeposlechnout v AudioTaggeru". Do 14. 9. 2026 chodilo
     * jen se zprávou o prvních tracích; teď o něm rozhoduje ZAŠKRTÁVÁTKO VE
     * VZORU (zadání: „může se někdy stát, že všechny tracky posíláme
     * najednou" - pak je přeposlech potřeba u „Dokončeno - ke schválení").
     */
    /**
     * TLAČÍTKO „SPOT SCHVALUJI" (zadání 18. 9. 2026). Jen u reklamy a jen ve
     * stavu, ve kterém spot klientovi posíláme ke schválení - jinde by nedávalo
     * smysl nabízet překlopení do fakturace.
     *
     * Odkaz vede na stránku s nahrávkami; samotné otevření nic nepřeklápí.
     */
    /**
     * U REKLAMY SE OTEVÍRÁ JEN JEDNO OKNO (zadání 22. 10. 2026: „v podstatě
     * u klientů reklam se může otevřít jen tohle okno… i když jde ten mail
     * poprvé ve stavu dokončeno, ke schválení").
     *
     * Do 22. 10. 2026 vedl první mail do složky s nahrávkami a až zpráva
     * o zapracovaných připomínkách do připomínkování - klient tak podle
     * pořadí mailů viděl pokaždé něco jiného. Teď vede obojí do téhož okna:
     * je v něm spot, schvalovací karta, připomínky i stažení.
     */
    const odkazNaSchvaleni =
      druh === 'REKLAMA' && token && stav === 'Dokončeno - ke schválení'
        ? `${urlPripominek(token)}?schvalit=1`
        : null;

    /**
     * AUDIOTAGGER SE ŘÍDÍ TÝMŽ PRAVIDLEM (30. 10. 2026: „ignorujeme
     * i audiotagger"). Zaškrtávátko ve vzoru rozhoduje jen tam, kde je co
     * přeposlouchávat; ve stavech před prvním trackem by klient otevřel
     * prázdný tagger - a to je stejně zavádějící jako prázdná složka.
     */
    let odkazNaPreposlech: string | null = null;
    if (vzor.audiotagger && token && stavMaNahravky(stav)) {
      odkazNaPreposlech = urlPreposlechu(token);
    }
    const hodnoty = {
      projekt: nazevProjektu,
      firma: nazevFirmy,
      klient: projekt.klient?.name ?? '',
      stav,
      /**
       * OSLOVENÍ JMÉNEM JEN TAM, KDE JE KOMU (zadání 20. 10. 2026: „tady
       * nedává smysl oslovení, když tady je více lidí. Když to tak bude, tak
       * tam musí jít jen univerzální Dobrý den,").
       *
       * Osloveni uz neni v mailu natvrdo, ale ve vzoru (zadani 15. 9. 2026).
       * Interni zprava nema komu vykat jmenem - a stejne tak zprava, ktera jde
       * na adresy nastavene u stavu nebo na vic lidi najednou: „Dobrý den,
       * Luboši," ctou tri lidi a dva z nich Lubos nejsou.
       */
      osloveni:
        nastaveni.komu === 'INTERNE' || uStavu.length > 0 || klientovi.length > 1
          ? pozdrav(null)
          : pozdrav(projekt.klient?.name ?? null),
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
      // U reklamy ke schválení vede i hlavní tlačítko do připomínkování -
      // viz odkazNaSchvaleni výš.
      odkazNaDisk: odkazNaSchvaleni ?? odkazNaDisk,
      odkazNaPreposlech,
      odkazNaSchvaleni,
      /**
       * „Stáhnout nahrávky ze složky" sedí na audioknihu, u spotu ne. Od
       * 18. 9. 2026 je u reklamy popisek prostě „Otevřít": vedle tlačítka
       * „Spot schvaluji" je jasné, co se otevírá, a krátký popisek se na
       * telefonu vejde na jeden řádek.
       */
      popisekOdkazu: druh === 'REKLAMA' ? 'Otevřít' : null,
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
      /**
       * A S NÍ I SAMA ZPRÁVA (19. 10. 2026). Vzor se dá kdykoliv přepsat
       * a odkaz pro klienta zrušit tlačítkem u projektu, takže dodatečně
       * poskládaný náhled by ukazoval něco jiného, než co klient dostal.
       * Otisk je to, co opravdu odešlo.
       */
      zpravaPredmet: vysledek.predmet,
      zpravaHtml: vysledek.telo,
    });

    return { stav: 'odeslano', prijemci: [...prijemci, ...skrytaKopie] };
  } catch (err) {
    console.error('posliNotifikaciKeStavu selhalo:', err);
    return { stav: 'chyba', zprava: err instanceof Error ? err.message : 'Neznámá chyba.' };
  }
}


/**
 * ZPĚTNÝ NÁHLED ZPRÁVY (zadání 19. 10. 2026: „já potřebuju, ať se prokliknu
 * i zpětně u těch projektů, co šlo na klienta").
 *
 * Otisk odeslané zprávy se ukládá teprve od 19. 10. 2026. U starších
 * záznamů v historii není co ukázat - a „tady nic není" je u zprávy, která
 * klientovi prokazatelně odešla, špatná odpověď.
 *
 * Tahle funkce tedy zprávu SLOŽÍ ZNOVU: tentýž vzor, tatáž data projektu,
 * tentýž kód, jaký ji tehdy poslal. U drtivé většiny zpráv to je přesně to,
 * co klient dostal.
 *
 * JE TO REKONSTRUKCE, NE OTISK, a náhled to o sobě musí říct nahlas (pruh
 * nad zprávou přidává /api/projekty/[id]/zprava/[udalostId]). Co se mezitím
 * mohlo změnit: znění vzoru, název projektu nebo klienta, platnost odkazu
 * pro klienta. Datum ve zprávě žádné není, takže to nesvádí k tomu číst
 * rekonstrukci jako doklad.
 *
 * NIC NEMĚNÍ. Na rozdíl od odesílání se tu odkaz pro klienta NEVYRÁBÍ -
 * jen čte. Kdyby ho náhled vyrobil, znamenalo by prohlédnutí staré zprávy
 * nový živý odkaz do projektu, a to je přesně ta věc, kterou od náhledu
 * nikdo nečeká.
 *
 * Vrací null, když zprávu složit nejde (projekt zmizel, stav nic neříká).
 */
export async function sestavNahledZpravy(
  caflouProjectId: string,
  stav: string,
): Promise<{ predmet: string; html: string } | null> {
  try {
    const projekt = await prisma.projectMeta.findUnique({
      where: { caflouProjectId },
      select: {
        name: true,
        serie: true,
        serieDil: true,
        driveUrl: true,
        companyId: true,
        companyName: true,
        company: {
          select: { name: true, driveFolderUrl: true, dealsAudiobooks: true, dealsAds: true },
        },
        klient: { select: { name: true, email: true } },
      },
    });
    if (!projekt) return null;

    const druh = druhNotifikaceFirmy(projekt.company);

    // Odkaz pro klienta se jen cte - viz komentar vys.
    const ulozenyOdkaz = await prisma.preposlechOdkaz
      .findUnique({
        where: { caflouProjectId },
        select: { token: true, zneplatnenoAt: true },
      })
      .catch(() => null);
    const token =
      ulozenyOdkaz && !ulozenyOdkaz.zneplatnenoAt ? ulozenyOdkaz.token : null;

    const zaklad = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
    const slozka = projekt.driveUrl || projekt.company?.driveFolderUrl || null;
    // Náhled musí ukazovat totéž co odeslaná zpráva - i to prázdné místo po
    // tlačítku do složky ve stavech před prvním trackem (30. 10. 2026).
    const odkazNaDisk = !stavMaNahravky(stav)
      ? null
      : token
        ? urlNahravek(token)
        : projekt.companyId && slozka
          ? `${zaklad}/nahravky?projekt=${encodeURIComponent(caflouProjectId)}`
          : slozka;

    const nazevProjektu =
      nazevSeSerii(projekt.name, projekt.serie, projekt.serieDil) || `Projekt ${caflouProjectId}`;
    const nazevFirmy = projekt.company?.name ?? projekt.companyName ?? '';
    const vzor = await vzorProStav(stav, druh);

    // Náhled musí ukazovat totéž co odeslaná zpráva - viz odesílání výš.
    const odkazNaSchvaleni =
      druh === 'REKLAMA' && token && stav === 'Dokončeno - ke schválení'
        ? `${urlPripominek(token)}?schvalit=1`
        : null;
    const odkazNaPreposlech =
      vzor.audiotagger && token && stavMaNahravky(stav) ? urlPreposlechu(token) : null;

    const hodnoty = {
      projekt: nazevProjektu,
      firma: nazevFirmy,
      klient: projekt.klient?.name ?? '',
      stav,
      osloveni: pozdrav(projekt.klient?.name ?? null),
    };

    const vstup = {
      prijemci: [] as string[],
      jenInterne: false,
      uvod: null,
      jmenoKlienta: projekt.klient?.name ?? null,
      nazevProjektu,
      nazevFirmy,
      stav,
      predmet: dosadPromenne(vzor.predmet, hodnoty),
      nadpis: dosadPromenne(vzor.nadpis, hodnoty),
      text: dosadPromenne(vzor.text, hodnoty),
      odkazNaDisk: odkazNaSchvaleni ?? odkazNaDisk,
      odkazNaPreposlech,
      odkazNaSchvaleni,
      popisekOdkazu: druh === 'REKLAMA' ? 'Otevřít' : null,
    };

    return {
      predmet: vstup.predmet || `${nazevProjektu} - ${stav}`,
      html: buildStavProjektuHtml(vstup),
    };
  } catch (err) {
    console.error('Náhled zprávy se nepodařilo složit:', err);
    return null;
  }
}
