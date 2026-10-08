/**
 * Jazyk portálu (zadání 13. 9. 2026: „přidej celkově na portálu přepnutí
 * jazyka do britské angličtiny").
 *
 * PROČ TAKHLE A NE KNIHOVNOU: portál má 155 obrazovek a texty jsou v nich
 * napsané natvrdo. Přepisovat je najednou na knihovnu (next-intl a spol.) by
 * znamenalo sáhnout do všeho naráz. Tenhle slovník se dá plnit po částech -
 * co v něm ještě není, zůstane česky a portál funguje dál.
 *
 * ANGLIČTINA JE BRITSKÁ. Tedy „organise", „authorise", datum 13/09/2026 a
 * libra jako £. Klienti MS Studio London jsou Britové.
 *
 * Jazyk se drží v cookie (KLIC_JAZYKA), takže ho zná i server a stránka
 * přijde rovnou v tom správném jazyce - žádné přeblikávání po načtení.
 */

export type Jazyk = 'cs' | 'en';

export const JAZYKY: Jazyk[] = ['cs', 'en'];
export const KLIC_JAZYKA = 'msportal_jazyk';
/** Rok - jazyk je volba, ne relace. */
export const PLATNOST_JAZYKA_S = 60 * 60 * 24 * 365;

export function jeJazyk(hodnota: unknown): hodnota is Jazyk {
  return hodnota === 'cs' || hodnota === 'en';
}

/**
 * Zkratka na přepínači. Kód jazyka je „cs" (tak se čeština značí podle normy
 * a tak ji zná prohlížeč), na tlačítku ale patří „CZ" — tak to lidi znají
 * z vlajek a domén (zadání 13. 9. 2026: „CS ale není správně, je to CZ").
 */
export const ZKRATKY_JAZYKU: Record<Jazyk, string> = { cs: 'CZ', en: 'EN' };

/** Celý název jazyka, hlavně do bublin u tlačítek. */
export const NAZVY_JAZYKU: Record<Jazyk, string> = { cs: 'Čeština', en: 'English' };

/** Kód pro Intl a atribut lang - britská angličtina, ne americká. */
export function kodJazyka(jazyk: Jazyk): 'cs-CZ' | 'en-GB' {
  return jazyk === 'en' ? 'en-GB' : 'cs-CZ';
}

/**
 * Názvy stránek v liště. Klíčem je adresa, ne text - lišta je u každého
 * uživatele vlastní a uložená v databázi česky, takže překládat se musí
 * podle toho, KAM odkaz vede.
 */
const ODKAZY_EN: Record<string, string> = {
  '/projekty': 'Projects',
  '/objednavka': 'New order',
  '/nahravky': 'Recordings',
  '/vykazy': 'Timesheets',
  '/kalendar': 'Calendar',
  '/moje-terminy': 'My sessions',
  '/honorare': 'Fees',
  '/muj-ucet': 'My account',
  '/admin': 'Companies',
  '/admin/users': 'Users',
  '/admin/ceniky': 'Price lists',
  '/admin/studia': 'Studios',
  '/admin/doklady': 'Invoicing',
  '/admin/archiv': 'Archive',
  '/admin/vzory-zprav': 'Message templates',
  '/admin/zpravy-portalu': 'Portal messages',
  '/admin/caflou-firmy': 'Caflou companies',
  '/chat': 'Chat',
};

export function nazevOdkazu(jazyk: Jazyk, href: string, zaloha: string): string {
  if (jazyk === 'cs') return zaloha;
  return ODKAZY_EN[href] ?? zaloha;
}

/**
 * Slovník. Klíč je krátký a mluvící, česká věta je zdroj pravdy - kdyby
 * anglická chyběla, ukáže se česká a nikde nezůstane prázdné místo.
 */
export const SLOVNIK: Record<string, { cs: string; en: string }> = {
  // --- horní lišta a účet ---
  'listou.upravit': { cs: 'Upravit', en: 'Edit' },
  'listou.hotovo': { cs: 'Hotovo', en: 'Done' },
  'listou.pridat': { cs: 'Přidat odkaz', en: 'Add link' },
  'listou.odhlasit': { cs: 'Odhlásit se', en: 'Sign out' },
  'listou.mujUcet': { cs: 'Můj účet', en: 'My account' },
  'listou.jazyk': { cs: 'Jazyk', en: 'Language' },
  'listou.cestina': { cs: 'Čeština', en: 'Czech' },
  'listou.anglictina': { cs: 'Angličtina', en: 'English' },

  // --- přihlášení ---
  'prihlaseni.nadpis': { cs: 'Přihlášení', en: 'Sign in' },
  'prihlaseni.email': { cs: 'E-mail nebo jméno', en: 'Email or username' },
  'prihlaseni.heslo': { cs: 'Heslo', en: 'Password' },
  'prihlaseni.tlacitko': { cs: 'Přihlásit se', en: 'Sign in' },
  'prihlaseni.probiha': { cs: 'Přihlašuji…', en: 'Signing in…' },
  'prihlaseni.zapomenute': { cs: 'Zapomenuté heslo', en: 'Forgotten password' },
  'prihlaseni.spatneUdaje': { cs: 'Nesprávný e-mail nebo heslo.', en: 'Incorrect email or password.' },
  'prihlaseni.nacitam': { cs: 'Načítám portál…', en: 'Opening the portal…' },
  'prihlaseni.chybaServeru': {
    cs: 'Přihlášení selhalo kvůli chybě serveru. Zkuste to prosím znovu.',
    en: 'Sign-in failed because of a server error. Please try again.',
  },
  'prihlaseni.ucetZalozi': { cs: 'Účet vám založí Mediaspace.', en: 'Mediaspace will set up your account.' },

  // --- obecné ---
  'obecne.ulozit': { cs: 'Uložit', en: 'Save' },
  'obecne.zrusit': { cs: 'Zrušit', en: 'Cancel' },
  'obecne.smazat': { cs: 'Smazat', en: 'Delete' },
  'obecne.zavrit': { cs: 'Zavřít', en: 'Close' },
  'obecne.hledat': { cs: 'Hledat', en: 'Search' },
  'obecne.nacitam': { cs: 'Načítám…', en: 'Loading…' },
  'obecne.nicTuNeni': { cs: 'Tady zatím nic není.', en: 'Nothing here yet.' },
  'obecne.zpet': { cs: 'Zpět', en: 'Back' },
  'obecne.ano': { cs: 'Ano', en: 'Yes' },
  'obecne.ne': { cs: 'Ne', en: 'No' },
  'obecne.z': { cs: 'z', en: 'of' },
  'obecne.otevrit': { cs: 'Otevřít', en: 'Open' },
  'obecne.upravit': { cs: 'Upravit', en: 'Edit' },
  'obecne.stahnout': { cs: 'Stáhnout', en: 'Download' },
  'obecne.ukladam': { cs: 'Ukládám…', en: 'Saving…' },
  'obecne.skryt': { cs: 'Skrýt', en: 'Hide' },

  // --- seznam projektů (dávka 1) ---
  'projekty.nadpis': { cs: 'Projekty', en: 'Projects' },
  'projekty.aktivni': { cs: 'Aktivní projekty', en: 'Active projects' },
  'projekty.dokoncene': { cs: 'Dokončené projekty', en: 'Completed projects' },
  'projekty.zobrazitDokoncene': {
    cs: 'Zobrazit dokončené projekty ({pocet})',
    en: 'Show completed projects ({pocet})',
  },
  'projekty.skrytDokoncene': { cs: 'Skrýt dokončené projekty', en: 'Hide completed projects' },
  'projekty.dalsi': { cs: 'Další projekty', en: 'More projects' },
  'projekty.zadneAktivni': {
    cs: 'Aktuálně tu nemáte žádný rozpracovaný projekt. Vidíte jen zakázky, u kterých jste vedení jako kontaktní osoba — ostatní najdete na záložce Celá firma.',
    en: 'You have no projects in progress at the moment. You only see the jobs where you are listed as the contact person — the rest are on the Whole company tab.',
  },
  'projekty.zadneDokoncene': {
    cs: 'Zatím tu nemáte žádné dokončené projekty.',
    en: 'You have no completed projects yet.',
  },
  'projekty.nepodariloNacist': {
    cs: 'Projekty se nepodařilo načíst.',
    en: 'The projects could not be loaded.',
  },

  // sloupce tabulky projektů
  'projekty.sl.projekt': { cs: 'Projekt', en: 'Project' },
  'projekty.sl.stav': { cs: 'Stav', en: 'Status' },
  'projekty.sl.herec': { cs: 'Herec', en: 'Narrator' },
  'projekty.sl.normostrany': { cs: 'Normostrany', en: 'Standard pages' },
  // Zkratka do uzkeho sloupce: cesky NS, anglicky SP (standard page).
  'projekty.sl.normostranyZkratka': { cs: 'NS', en: 'SP' },
  'projekty.sl.progresNataceni': { cs: 'Progres natáčení', en: 'Recording progress' },
  'projekty.sl.dokonceni': { cs: 'Dokončení', en: 'Completion' },
  'projekty.sl.vydani': { cs: 'Vydání', en: 'Release' },
  'projekty.sl.kPreposlechu': { cs: 'K přeposlechu', en: 'To proof-listen' },
  'projekty.sl.preposlechnuto': { cs: 'Přeposlechnuto', en: 'Proof-listened' },
  // Jeden sloupec misto dvou (1. 10. 2026) - viz BunkaPreposlechu.
  'projekty.sl.preposlech': { cs: 'Přeposlech', en: 'Proof-listening' },
  /** Ikony nabidky, faktury a objednavky v klientskem prehledu (1. 10. 2026). */
  'projekty.sl.doklady': { cs: 'Doklady', en: 'Documents' },
  'projekty.sl.rodnyList': { cs: 'Rodný list', en: 'Advert record' },
  'projekty.sl.schvaleni': { cs: 'Schválení', en: 'Approval' },
  'projekty.rodnyListOtevrit': { cs: 'Rodný list ↗', en: 'Advert record ↗' },
  'projekty.sl.vede': { cs: 'Vede', en: 'Lead' },
  'projekty.bezKontaktu': { cs: '— bez kontaktu', en: '— no contact' },

  // záložky klienta: moje zakázky vs. celá firma (zadání 24. 9. 2026)
  'projekty.zalozkaMoje': { cs: 'Moje projekty', en: 'My projects' },
  'projekty.zalozkaFirma': { cs: 'Celá firma', en: 'Whole company' },
  'projekty.aktivniFirmy': { cs: 'Aktivní projekty {firma}', en: 'Active projects {firma}' },
  'projekty.firmaPopis': {
    cs: 'Všechno, co u nás vaše firma má — i zakázky kolegů. Poslech a připomínky zůstávají u toho, kdo je na zakázce vedený jako kontakt.',
    en: 'Everything your company has with us — your colleagues’ jobs included. Proof-listening and comments stay with whoever is listed as the contact on the job.',
  },
  'projekty.zadneFiremniAktivni': {
    cs: 'Vaše firma u nás zatím nemá žádnou rozpracovanou zakázku.',
    en: 'Your company has no jobs in progress with us yet.',
  },
  'projekty.zadneFiremniDokoncene': {
    cs: 'Vaše firma u nás zatím nemá žádnou dokončenou zakázku.',
    en: 'Your company has no completed jobs with us yet.',
  },
  'projekty.termin.po': { cs: 'Dní po termínu dokončení', en: 'Days past the completion date' },
  'projekty.termin.dnes': { cs: 'Termín dokončení je dnes', en: 'The completion date is today' },
  'projekty.termin.do': { cs: 'Dní do termínu dokončení', en: 'Days to the completion date' },
  'projekty.otevritTagger': {
    cs: 'Otevřít AudioTagger — nachystáno {stop} stop',
    en: 'Open AudioTagger — {stop} tracks ready',
  },
  'projekty.nahravkyNachystane': {
    cs: 'Nahrávky jsou nachystané ({stop})',
    en: 'The recordings are ready ({stop})',
  },
  'projekty.poslechnout': { cs: 'Poslechnout', en: 'Listen' },
  'projekty.nahravkyNejsou': { cs: 'Nahrávky zatím nejsou', en: 'No recordings yet' },
  'projekty.pripravenoKPreposlechu': { cs: 'Připraveno k přeposlechu', en: 'Ready to proof-listen' },
  'projekty.neniCoPoslouchat': { cs: 'Zatím není co poslouchat', en: 'Nothing to listen to yet' },
  'projekty.hotovo': { cs: 'Dokončeno', en: 'Completed' },
  'projekty.doposlechnuteStopy': {
    cs: 'Doposlechnuté stopy: {hotovo} z {celkem}',
    en: 'Tracks proof-listened: {hotovo} of {celkem}',
  },
  'projekty.stav.hotovoFakturujeme': { cs: 'Hotovo, fakturujeme', en: 'Done, invoicing' },
  'projekty.stav.dokonceno': { cs: 'Dokončeno', en: 'Completed' },

  // seznam projektů očima herce
  'projektyHerec.zadne': {
    cs: 'Zatím tu nemáte žádný rozpracovaný projekt. Jakmile vás k nějakému přiřadíme, objeví se tady.',
    en: 'You have no projects in progress yet. As soon as we put you on one, it will show up here.',
  },
  'projektyHerec.dokoncene': {
    cs: 'Dokončené projekty ({pocet})',
    en: 'Completed projects ({pocet})',
  },
  'projektyHerec.skonciliNaStrane': { cs: 'Skončili jsme na straně', en: 'We stopped on page' },
  'projektyHerec.text': { cs: 'Text', en: 'Text' },
  'projektyHerec.jesteSeNetocilo': { cs: 'ještě se netočilo', en: 'recording has not started' },
  'projektyHerec.otevrit': { cs: 'Otevřít ↗', en: 'Open ↗' },
  'projektyHerec.stahnoutText': { cs: 'Stáhnout text jako PDF', en: 'Download the text as a PDF' },

  // --- detail projektu (dávka 1) ---
  'projekt.zpetNaProjekty': { cs: '← Zpět na projekty', en: '← Back to projects' },
  'projekt.nacitam': { cs: 'Načítám projekt', en: 'Loading the project' },
  'projekt.bezNazvu': { cs: 'Bez názvu', en: 'Untitled' },
  'projekt.zaloha.nazev': { cs: 'Projekt {id}', en: 'Project {id}' },
  'projekt.zalozka.prehled': { cs: 'Přehled', en: 'Overview' },
  'projekt.zalozka.rozpocet': { cs: 'Rozpočet', en: 'Budget' },
  'projekt.zalozka.frekvence': { cs: 'Natáčecí plán', en: 'Recording schedule' },
  'projekt.zalozka.rodnyList': { cs: 'Rodný list', en: 'Advert record' },
  'projekt.zalozka.licencniList': { cs: 'Licenční list', en: 'Licence sheet' },
  'projekt.zalozka.pripominky': { cs: 'Připomínky', en: 'Comments' },
  'projekt.zalozka.preposlech': { cs: 'Přeposlech', en: 'Proof-listening' },
  'projekt.zalozka.protokol': { cs: 'Natáčecí protokol', en: 'Recording log' },
  'projekt.zalozka.historie': { cs: 'Historie', en: 'History' },
  'projekt.zalozka.doklady': { cs: 'Doklady', en: 'Documents' },

  // Hosté na natáčení (30. 9. 2026) - viz projekty/[id]/HosteNataceni.tsx.
  'hoste.nadpis': { cs: 'Hosté na natáčení', en: 'Guests at the recording' },
  'hoste.popis': {
    cs: 'Klient, agentura nebo zadavatel, kteří u natáčení budou — ve studiu, nebo na dálku. Pozvánka jim pošle čas, adresu s mapou, parkování i odkaz na připojení.',
    en: 'The customer, agency or orderer attending the recording — at the studio or remotely. The invitation sends them the time, the address with a map, parking and the joining link.',
  },
  'hoste.zadneNataceni': {
    cs: 'K projektu zatím není v kalendáři žádné natáčení. Jakmile termín vznikne, objeví se tady i s hosty.',
    en: 'There is no recording in the calendar for this project yet. Once a session exists, it will appear here along with its guests.',
  },
  'hoste.pocet': { cs: '{pocet} hostů', en: '{pocet} guests' },
  'hoste.ceka': { cs: '{pocet} čeká na pozvánku', en: '{pocet} awaiting an invitation' },
  'hoste.cekaNapoveda': {
    cs: 'Komu pozvánka ještě nešla — nebo komu se od ní posunul termín.',
    en: 'Who has not been sent an invitation yet — or whose session has moved since.',
  },
  'hoste.mapa': { cs: 'mapa', en: 'map' },
  'hoste.bezAdresy': { cs: 'Studio nemá vyplněnou adresu', en: 'The studio has no address filled in' },
  'hoste.bezAdresyNapoveda': {
    cs: 'Adresu, mapu a parkování se vyplňují u studia v Administraci → Studia. Bez nich pozvánka pošle jen název studia.',
    en: 'The address, map and parking are filled in for the studio in Administration → Studios. Without them the invitation only carries the studio name.',
  },
  'hoste.pridatNadpis': { cs: 'Přidat hosty', en: 'Add guests' },
  'hoste.pridatPrazdne': {
    cs: 'Jan Novák <jan@firma.cz>, petra@agentura.cz — vložte klidně celý řádek z mailu',
    en: 'Jan Novák <jan@firma.cz>, petra@agency.com — paste a whole line from an email if you like',
  },
  'hoste.nahled': { cs: 'Přidá se {pocet} adres.', en: '{pocet} addresses will be added.' },
  'hoste.nahledSpatne': { cs: 'jako e-mail nevypadá: {zbytek}', en: 'does not look like an email: {zbytek}' },
  'hoste.pridat': { cs: 'Přidat', en: 'Add' },
  'hoste.pridano': { cs: 'Přidáno: {pocet}.', en: 'Added: {pocet}.' },
  'hoste.pridanoSeZbytkem': {
    cs: 'Přidáno: {pocet}. Nepřidáno (nevypadá jako e-mail): {zbytek}',
    en: 'Added: {pocet}. Not added (does not look like an email): {zbytek}',
  },
  'hoste.online': { cs: 'online', en: 'remote' },
  'hoste.osobne': { cs: 've studiu', en: 'at the studio' },
  'hoste.prepnoutNapoveda': {
    cs: 'Přijde do studia, nebo se připojí na dálku — podle toho pozvánka začne adresou, nebo odkazem.',
    en: 'Coming to the studio, or joining remotely — the invitation leads with the address or the link accordingly.',
  },
  'hoste.odkazNadpis': { cs: 'Odkaz na připojení k tomuhle natáčení', en: 'Joining link for this session' },
  'hoste.odkazZeStudia': {
    cs: 'Prázdné = pošle se odkaz studia.',
    en: 'Empty = the studio link is sent.',
  },
  'hoste.odkazVlastni': {
    cs: 'Platí místo odkazu studia. Smazáním se vrátí ten studiový.',
    en: 'Used instead of the studio link. Clear it to go back to the studio one.',
  },
  'hoste.poslat': { cs: 'Poslat pozvánky ({pocet})', en: 'Send invitations ({pocet})' },
  'hoste.poslatNapoveda': {
    cs: 'Odejde jen těm, komu pozvánka ještě nešla nebo komu se posunul termín.',
    en: 'Goes only to those not yet invited or whose session has moved.',
  },
  'hoste.poslatVsem': { cs: 'Poslat znovu všem', en: 'Send again to everyone' },
  'hoste.poslatVsemNapoveda': {
    cs: 'Pošle pozvánku i těm, kteří ji už mají.',
    en: 'Sends the invitation to everyone, including those who already have it.',
  },
  'hoste.odeslano': { cs: 'Odesláno: {pocet}.', en: 'Sent: {pocet}.' },
  'hoste.pozvankaOdeslana': { cs: 'pozvánka {kdy}', en: 'invited {kdy}' },
  'hoste.terminSePosunul': { cs: 'termín se posunul', en: 'the session has moved' },
  'hoste.spatnaAdresa': { cs: 'adresa nevypadá správně', en: 'the address looks wrong' },
  'hoste.smazat': { cs: 'Odebrat', en: 'Remove' },
  'hoste.opravduSmazat': { cs: 'Opravdu odebrat?', en: 'Really remove?' },
  'hoste.chyba': { cs: 'Nepovedlo se to.', en: 'It did not work.' },

  // Natáčecí plán u klienta v přehledu zakázek (30. 9. 2026).
  'projekty.sl.nataceciPlan': { cs: 'Natáčecí plán', en: 'Recording plan' },
  'terminy.zobrazit': { cs: 'Zobrazit termíny', en: 'Show sessions' },
  // Rozbalený natáčecí plán se zavírá týmž tlačítkem (1. 10. 2026).
  'terminy.skryt': { cs: 'Skrýt termíny', en: 'Hide sessions' },
  'terminy.zobrazitKratce': { cs: 'Zobrazit', en: 'Show' },
  'terminy.skrytKratce': { cs: 'Skrýt', en: 'Hide' },
  'terminy.nadpis': { cs: 'Natáčecí termíny', en: 'Recording sessions' },
  'terminy.napoveda': {
    cs: 'Domluvené natáčecí termíny téhle zakázky a kdo v nich čte',
    en: 'The agreed recording sessions for this job and who is reading',
  },
  'terminy.odtoceno': { cs: 'odtočeno', en: 'recorded' },
  'terminy.souhrn': { cs: 'odtočeno {odtoceno} z {celkem}', en: '{odtoceno} of {celkem} recorded' },
  'terminy.vseOdtoceno': { cs: 'všechno odtočeno', en: 'all recorded' },
  'terminy.nejblizsi': { cs: 'nejbližší', en: 'next up' },
  // Kde se ten den skončilo (1. 10. 2026) - strana režijního editu.
  'terminy.stranyRozsah': { cs: 'str. {od}–{do}', en: 'pp. {od}–{do}' },
  'terminy.stranyDo': { cs: 'do str. {strana}', en: 'to p. {strana}' },
  'terminy.stranyNapoveda': {
    cs: 'Strany textu, na kterých se ten den skončilo - podle zápisu ze studia.',
    en: 'The pages of the text reached that day, from the studio log.',
  },
  'projekt.schvaleno': { cs: 'Klient zakázku schválil', en: 'The customer has approved the job' },
  'projekt.neschvaleno': { cs: 'Zatím neschváleno', en: 'Not approved yet' },
  'projekt.jakSeSchvaluje': {
    cs: 'Klient schvaluje tlačítkem Schválit v mailu, ve složce nebo ve svém portálu.',
    en: 'The customer approves with the Approve button in the email, in the folder or in their portal.',
  },
  'projekt.odkazSeNepovedl': {
    cs: 'Odkaz pro klienta se nepodařilo připravit, a bez něj se nahrávky nenačtou. Zkuste stránku načíst znovu.',
    en: 'The customer link could not be prepared, and without it the recordings will not load. Please reload the page.',
  },
  'projekt.zadnyZvukAniVideo': {
    cs: 'Ve složce projektu zatím není žádný zvuk ani video. Jakmile tam něco přibude, objeví se tady i s připomínkami klienta.',
    en: 'There is no audio or video in the project folder yet. As soon as something is added, it will appear here together with the customer’s comments.',
  },
  'projekt.priloha': { cs: 'příloha', en: 'attachment' },

  // --- nahrávky a složka na Disku (dávka 1) ---
  'nahravky.nadpis': { cs: 'Nahrávky', en: 'Recordings' },
  'nahravky.projekt': { cs: 'Projekt', en: 'Project' },
  'nahravky.slozkaProjektu': {
    cs: 'Složka projektu {nazev} na Google Disku. Otevře se v nové záložce.',
    en: 'The project folder {nazev} on Google Drive. It opens in a new tab.',
  },
  'nahravky.slozkaFirmy': {
    cs: 'Složka firmy {nazev} na Google Disku obsahuje všechny vaše nahrávky. Otevře se v nové záložce.',
    en: 'The folder of {nazev} on Google Drive holds all your recordings. It opens in a new tab.',
  },
  'nahravky.otevritNaDisku': {
    cs: 'Otevřít složku na Google Disku ↗',
    en: 'Open the folder on Google Drive ↗',
  },
  'nahravky.bezSlozky': {
    cs: 'Zatím vám nebyla přiřazena složka na Google Disku. Ozvěte se prosím Mediaspace.',
    en: 'No Google Drive folder has been assigned to you yet. Please get in touch with Mediaspace.',
  },
  'nahravky.projektNenalezen': {
    cs: 'Tenhle projekt jsme nenašli. Zkuste prosím odkaz z e-mailu otevřít znovu, nebo se nám ozvěte.',
    en: 'We could not find this project. Please open the link from the email again, or get in touch with us.',
  },
  'nahravky.bezPristupu': {
    cs: 'K tomuhle projektu nemá váš účet přístup. Ozvěte se prosím Mediaspace, doplníme to.',
    en: 'Your account has no access to this project. Please get in touch with Mediaspace and we will sort it out.',
  },
  'nahravky.projektBezSlozky': {
    cs: 'U tohohle projektu zatím není vyplněná složka s nahrávkami. Ozvěte se prosím Mediaspace.',
    en: 'This project has no recordings folder filled in yet. Please get in touch with Mediaspace.',
  },

  // --- AudioTagger / přeposlech (dávka 1) ---
  // Pozn. ke slovníčku: „záznam chyby" je v angličtině `tag`, „stopa" `track`
  // a „přeposlech" `proof-listening` - viz docs/preklad-portalu.md.
  'preposlech.chybaPrehrani': {
    cs: 'Nahrávku se nepodařilo přehrát.',
    en: 'The recording could not be played.',
  },
  'preposlech.nacitamZvuk': {
    cs: 'Načítám nahrávku…',
    en: 'Loading the recording…',
  },
  'preposlech.chybaSlozka': {
    cs: 'Složku projektu se nepodařilo načíst.',
    en: 'The project folder could not be loaded.',
  },
  'preposlech.chybaText': {
    cs: 'Text „{nazev}" se nepodařilo otevřít.',
    en: 'The text “{nazev}” could not be opened.',
  },
  'preposlech.chybaUlozit': { cs: 'Nepodařilo se uložit.', en: 'Saving failed.' },
  'preposlech.chybaVratit': { cs: 'Krok se nepodařilo vrátit.', en: 'The step could not be undone.' },
  'preposlech.chybaStopa': {
    cs: 'Stopu se nepodařilo načíst z Disku.',
    en: 'The track could not be loaded from Drive.',
  },
  'preposlech.csv.stopa': { cs: 'Stopa', en: 'Track' },
  'preposlech.csv.nazevStopy': { cs: 'Název stopy', en: 'Track name' },
  'preposlech.csv.casVeStope': { cs: 'Čas ve stopě', en: 'Time in the track' },
  'preposlech.csv.casVCubase': { cs: 'Čas v Cubase', en: 'Time in Cubase' },
  'preposlech.csv.stranaTextu': { cs: 'Strana textu', en: 'Text page' },
  'preposlech.csv.popisChyby': { cs: 'Popis chyby', en: 'Tag description' },
  'preposlech.csv.zapsal': { cs: 'Zapsal', en: 'Added by' },
  'preposlech.csv.kdy': { cs: 'Kdy', en: 'When' },
  'preposlech.cekaNaSignal': { cs: 'čeká na signál', en: 'waiting for a signal' },
  'preposlech.odejdeSeSignalem': { cs: 'odejde se signálem', en: 'will be sent with the signal' },
  'preposlech.zalozka': { cs: 'Záložka', en: 'Bookmark' },
  'preposlech.stopa': { cs: 'Stopa', en: 'Track' },
  'preposlech.pokracovatOdtud': { cs: 'Pokračovat odtud', en: 'Carry on from here' },
  'preposlech.neboEnterEsc': { cs: 'nebo Enter · Esc', en: 'or Enter · Esc' },
  'preposlech.popisekStop': { cs: 'Stop:', en: 'Tracks:' },
  'preposlech.popisekChyb': { cs: 'Chyb:', en: 'Tags:' },
  'preposlech.popisekText': { cs: 'Text:', en: 'Text:' },
  'preposlech.postupJa': {
    cs: 'Přeposlechnuto {slyseno} z {stran} stran textu. Strana se počítá, když na ní při přehrávání máte text.',
    en: 'Proof-listened {slyseno} of {stran} text pages. A page counts once you have its text open while the recording plays.',
  },
  'preposlech.postupKlient': {
    cs: 'Klient přeposlechl {slyseno} z {stran} stran textu. Strana se počítá, když na ní při přehrávání máte text.',
    en: 'The customer has proof-listened {slyseno} of {stran} text pages. A page counts once its text is open while the recording plays.',
  },
  'preposlech.postupBezDat': {
    cs: 'Procento přeposlechu se počítá podle stran textu, na kterých při přehrávání jste.',
    en: 'The proof-listening percentage is worked out from the text pages you are on while the recording plays.',
  },
  'preposlech.stitekPreposlechnuto': { cs: 'Přeposlechnuto', en: 'Proof-listened' },
  'preposlech.stitekKlient': { cs: 'Klient', en: 'Customer' },
  'preposlech.strana': { cs: 'strana', en: 'page' },
  'preposlech.klavesy': {
    cs: 'Mezerník · ←/→ ±5 s · E = chyba · označ text myší',
    en: 'Space · ←/→ ±5 s · E = tag · select text with the mouse',
  },
  'preposlech.posluchacNapoveda': {
    cs: '{jmeno} — stopa {stopa}, {cas}',
    en: '{jmeno} — track {stopa}, {cas}',
  },
  'preposlech.jedenPoslouchaJmeno': { cs: '{jmeno} poslouchá · {stopa}', en: '{jmeno} is listening · {stopa}' },
  'preposlech.viceLidi': { cs: 'Poslouchá {pocet} lidí', en: '{pocet} people are listening' },
  'preposlech.textPdf': { cs: 'Text (PDF)', en: 'Text (PDF)' },
  'preposlech.zpetDoOknaNapoveda': { cs: 'Zpět do okna (Esc)', en: 'Back to the window (Esc)' },
  'preposlech.naCelouObrazovkuNapoveda': { cs: 'Na celou obrazovku', en: 'Full screen' },
  'preposlech.zpetDoOkna': { cs: '⤡ Zpět do okna', en: '⤡ Back to the window' },
  'preposlech.naCelouObrazovku': { cs: '⤢ Na celou obrazovku', en: '⤢ Full screen' },
  'preposlech.opravduZrusit': { cs: 'Opravdu zrušit', en: 'Yes, undo it' },
  'preposlech.zrusitOznaceni': { cs: 'Zrušit označení', en: 'Undo the mark' },
  'preposlech.zrusitMale': { cs: 'zrušit', en: 'undo' },
  'preposlech.opravduOznacit': {
    cs: 'Opravdu označit jako přeposlechnuté?',
    en: 'Mark as proof-listened?',
  },
  'preposlech.anoPreposlechnuto': { cs: 'Ano, přeposlechnuto', en: 'Yes, proof-listened' },
  'preposlech.oznacitPreposlechnute': {
    cs: 'Označit jako přeposlechnuté',
    en: 'Mark as proof-listened',
  },
  'preposlech.textNahravky': { cs: 'Text nahrávky', en: 'Recording text' },
  'preposlech.nacistJinePdf': { cs: 'Načíst jiné PDF', en: 'Load a different PDF' },
  'preposlech.cisloStrany': { cs: 'Číslo strany', en: 'Page number' },
  'preposlech.nacitamText': {
    cs: 'Načítám text ze složky projektu…',
    en: 'Loading the text from the project folder…',
  },
  'preposlech.bezTextu': {
    cs: 'Ve složce projektu zatím není text. Hledá se PDF, jehož název končí _RE.',
    en: 'There is no text in the project folder yet. We look for a PDF whose name ends in _RE.',
  },
  'preposlech.prehratPauza': { cs: 'Přehrát / pozastavit (mezerník)', en: 'Play / pause (space)' },
  'preposlech.rychlost': { cs: 'Přehrávat {r}× rychle', en: 'Play at {r}× speed' },
  'preposlech.pauzaNapoveda': {
    cs: 'Dát si pauzu — přeposlech se zamkne a založí se místo',
    en: 'Take a break — proof-listening locks and the spot is bookmarked',
  },
  'preposlech.pauza': { cs: '🔖 Pauza', en: '🔖 Break' },
  'preposlech.pridatChybu': { cs: '+ Přidat chybu', en: '+ Add tag' },
  'preposlech.offsetCubase': {
    cs: 'Offset této stopy v Cubase: +{cas}',
    en: 'This track’s offset in Cubase: +{cas}',
  },
  'preposlech.f.cas': { cs: 'čas', en: 'time' },
  'preposlech.textNenacteny': { cs: '— (text nenačtený)', en: '— (text not loaded)' },
  'preposlech.zvyraznenoVTextu': { cs: 'zvýrazněno v textu', en: 'highlighted in the text' },
  'preposlech.popisPlaceholder': {
    cs: 'Co je špatně — přeřek, chybějící věta, jiné znění než v textu…',
    en: 'What is wrong — a slip, a missing sentence, wording that differs from the text…',
  },
  'preposlech.ulozitChybu': { cs: 'Uložit chybu', en: 'Save tag' },
  'preposlech.zvukoveStopy': { cs: 'Zvukové stopy', en: 'Audio tracks' },
  'preposlech.slozkaNaDisku': { cs: 'Složka na Disku ↗', en: 'Folder on Drive ↗' },
  'preposlech.nacistZDiskuZnovu': { cs: 'Načíst z Disku znovu', en: 'Reload from Drive' },
  'preposlech.zeSouboru': { cs: '+ Ze souborů', en: '+ From files' },
  'preposlech.nacitamStopy': {
    cs: 'Načítám stopy ze složky projektu…',
    en: 'Loading the tracks from the project folder…',
  },
  'preposlech.bezStop': {
    cs: 'Ve složce projektu zatím nejsou žádné nahrávky. Stopy se řadí podle čísla na začátku názvu — 01_, 02_, 03_.',
    en: 'There are no recordings in the project folder yet. Tracks are ordered by the number at the start of the name — 01_, 02_, 03_.',
  },
  'preposlech.stopaHotovaNapoveda': {
    cs: 'Stopa je hotová — odškrtnutím ji vrátíte zpět',
    en: 'The track is done — untick it to put it back',
  },
  'preposlech.oznacitHotovou': { cs: 'Označit stopu jako hotovou', en: 'Mark the track as done' },
  'preposlech.stopaHotovaPopis': { cs: 'Stopa {cislo} hotová', en: 'Track {cislo} done' },
  'preposlech.zalozkaNapoveda': {
    cs: 'Tady jste skončili ({cas}) — kliknutím pokračujete',
    en: 'This is where you left off ({cas}) — click to carry on',
  },
  'preposlech.poslechnutaCela': {
    cs: 'Stopa je poslechnutá do konce',
    en: 'The track has been listened to the end',
  },
  'preposlech.poslechnutoStitek': { cs: '✓ poslechnuto', en: '✓ listened' },
  'preposlech.kolikPoslechnuto': {
    cs: 'Kolik ze stopy jste už poslechli',
    en: 'How much of the track you have listened to',
  },
  'preposlech.kreslimKrivku': { cs: 'kreslím křivku…', en: 'drawing the waveform…' },
  /* Délky stop a kolik zbývá doposlechnout (25. 9. 2026). */
  'preposlech.delkaStopy': { cs: 'Délka stopy', en: 'Track length' },
  'preposlech.zbyvaDoposlechnout': { cs: 'Zbývá doposlechnout', en: 'Left to listen' },
  'preposlech.zbyvaVse': { cs: 'Doposlechnuto vše', en: 'All listened' },
  'preposlech.zbyvaPocitam': {
    cs: 'Zjišťuji délky stop…',
    en: 'Reading track lengths…',
  },
  'preposlech.zobrazitZaznamy': {
    cs: 'Zobrazit záznamy chyb a historii',
    en: 'Show the tags and the history',
  },
  'preposlech.zaznamy': { cs: 'Záznamy', en: 'Tags' },
  'preposlech.skrytZaznamy': { cs: 'Skrýt záznamy', en: 'Hide the tags' },
  'preposlech.zalozkaChyby': { cs: 'Chyby ({pocet})', en: 'Tags ({pocet})' },
  'preposlech.zalozkaHistorie': { cs: 'Historie', en: 'History' },
  'preposlech.chybejiciStopy': {
    cs: 'Některé záznamy patří stopám, které tu teď nejsou.',
    en: 'Some tags belong to tracks that are not here at the moment.',
  },
  'preposlech.markeryNapoveda': {
    cs: 'Stáhnout všechny záznamy jako markery pro Cubase (.mid). V Cubase zapněte Předvolby ▸ MIDI ▸ MIDI soubor ▸ Importovat markery.',
    en: 'Download every tag as Cubase markers (.mid). In Cubase switch on Preferences ▸ MIDI ▸ MIDI File ▸ Import Markers.',
  },
  'preposlech.markery': { cs: 'Markery do Cubase', en: 'Markers for Cubase' },
  'preposlech.tabulkaNapoveda': {
    cs: 'Stáhnout všechny záznamy jako tabulku (CSV pro Excel)',
    en: 'Download every tag as a spreadsheet (CSV for Excel)',
  },
  'preposlech.stahnoutTabulku': { cs: 'Stáhnout tabulku', en: 'Download the spreadsheet' },
  'preposlech.zadneChyby': {
    cs: 'Zatím žádné chyby. Pusťte stopu a v místě problému dejte „Přidat chybu".',
    en: 'No tags yet. Play a track and press “Add tag” where something is wrong.',
  },
  'preposlech.skocit': { cs: 'Skočit na místo v nahrávce', en: 'Jump to that spot in the recording' },
  'preposlech.stranaZkratka': { cs: 's. {strana}', en: 'p. {strana}' },
  'preposlech.vTextu': { cs: '✎ v textu', en: '✎ in the text' },
  'preposlech.upravitZneni': { cs: 'Upravit znění', en: 'Edit the wording' },
  'preposlech.smazatZaznam': { cs: 'Smazat záznam', en: 'Delete the tag' },
  'preposlech.historiePrazdna': {
    cs: 'Zatím se nic nestalo. Jakmile někdo otevře odkaz nebo napíše poznámku, objeví se to tady.',
    en: 'Nothing has happened yet. As soon as someone opens the link or writes a note, it will show up here.',
  },
  'preposlech.vratitKrokNapoveda': { cs: 'Vrátit tenhle krok', en: 'Undo this step' },
  'preposlech.vratitDoBodu': { cs: '↩ Vrátit do tohoto bodu', en: '↩ Undo back to this point' },

  // --- prohlížeč složky na Disku (dávka 1) ---
  'disk.nazev': { cs: 'Název', en: 'Name' },
  'disk.upraveno': { cs: 'Upraveno', en: 'Modified' },
  'disk.velikost': { cs: 'Velikost', en: 'Size' },
  'disk.oSlozkuVys': { cs: 'Zpět o složku výš', en: 'Up one folder' },
  'disk.nacistZnovu': { cs: 'Načíst obsah složky znovu', en: 'Reload the folder' },
  'disk.nacistZnovuKratce': { cs: 'Načíst znovu', en: 'Reload' },
  'disk.stahnoutVseNapoveda': {
    cs: 'Stáhnout všechny soubory v této složce jako ZIP',
    en: 'Download every file in this folder as a ZIP',
  },
  'disk.pripravujiZip': { cs: 'Připravuji ZIP…', en: 'Preparing the ZIP…' },
  'disk.stahnoutVse': { cs: 'Stáhnout vše', en: 'Download all' },
  'disk.kopirovatOdkazNahravky': {
    cs: 'Kopírovat odkaz na tyhle nahrávky — můžete ho komukoliv přeposlat',
    en: 'Copy the link to these recordings — you can forward it to anyone',
  },
  'disk.kopirovatOdkazSlozky': {
    cs: 'Kopírovat odkaz na celou složku',
    en: 'Copy the link to the whole folder',
  },
  'disk.zkopirovano': { cs: 'Zkopírováno', en: 'Copied' },
  'disk.odkazNaSlozku': { cs: 'Odkaz na složku', en: 'Folder link' },
  'disk.hledat': { cs: 'Hledat v této složce…', en: 'Search this folder…' },
  'disk.hledatPopis': { cs: 'Hledat v této složce', en: 'Search this folder' },
  'disk.zrusitHledani': { cs: 'Zrušit hledání', en: 'Clear the search' },
  'disk.nicNenalezeno': { cs: 'Nic, co by odpovídalo „{dotaz}".', en: 'Nothing matches “{dotaz}”.' },
  'disk.prazdnaSlozka': { cs: 'Tato složka je prázdná.', en: 'This folder is empty.' },
  'disk.dvojklikSlozka': { cs: 'Dvojklikem otevřete složku', en: 'Double-click to open the folder' },
  'disk.dvojklikPrehrat': { cs: 'Dvojklikem přehrajete', en: 'Double-click to play' },
  'disk.dvojklikOtevrit': { cs: 'Dvojklikem otevřete', en: 'Double-click to open' },
  'disk.pripominkovatNapoveda': {
    cs: 'Otevřít spot a zapsat k němu připomínky',
    en: 'Open the advert and add comments to it',
  },
  'disk.pripominkovat': { cs: 'Připomínkovat', en: 'Add comments' },
  'disk.zavritPrehravac': { cs: 'Zavřít přehrávač', en: 'Close the player' },
  'disk.prehrat': { cs: 'Přehrát', en: 'Play' },
  'disk.otevritNaDisku': {
    cs: 'Otevřít složku na Google Disku (odtud jde stáhnout celá)',
    en: 'Open the folder on Google Drive (you can download all of it from there)',
  },
  'disk.kopirovatOdkazNahravky1': {
    cs: 'Kopírovat odkaz na tuhle nahrávku',
    en: 'Copy the link to this recording',
  },
  'disk.kopirovatOdkazSdileni': {
    cs: 'Kopírovat odkaz ke sdílení',
    en: 'Copy the link to share',
  },
  'disk.videoNeumi': {
    cs: 'Přehrávání videa tenhle prohlížeč neumí — soubor jde stáhnout tlačítkem vedle.',
    en: 'This browser cannot play the video — you can download the file with the button next to it.',
  },
  'disk.napovedaKliky': {
    cs: 'Jeden klik položku označí, dvojklik otevře složku, přehraje nahrávku nebo otevře soubor.',
    en: 'One click selects an item; a double-click opens the folder, plays the recording or opens the file.',
  },
  'disk.napovedaPrejmenovat': {
    cs: ' Přejmenovat: klikněte znovu na název označené položky, nebo stiskněte Enter.',
    en: ' To rename: click the selected item’s name again, or press Enter.',
  },
  'disk.chybaObsah': {
    cs: 'Obsah složky se nepodařilo načíst.',
    en: 'The folder contents could not be loaded.',
  },
  'disk.chybaZip': { cs: 'Stažení složky se nezdařilo.', en: 'Downloading the folder failed.' },
  'disk.chybaPrejmenovani': { cs: 'Přejmenování se nezdařilo.', en: 'Renaming failed.' },

  // --- přeposlech odkazem (dávka 1) ---
  'preposlechOdkaz.titulek': { cs: 'Přeposlech nahrávky', en: 'Recording proof-listening' },
  'preposlechOdkaz.neplatnyNadpis': { cs: 'Odkaz už neplatí', en: 'This link is no longer valid' },
  'preposlechOdkaz.neplatnyText': {
    cs: 'Tenhle odkaz na přeposlech byl uzavřený nebo nahrazený novým. Napište nám a pošleme vám aktuální.',
    en: 'This proof-listening link has been closed or replaced with a new one. Write to us and we will send you the current one.',
  },
  'preposlechOdkaz.zalohaNazvu': { cs: 'Nahrávka', en: 'Recording' },

  // --- rezervace studia (zadání 25. 9. 2026) -------------------------------
  // Klienti londýnského studia jsou Britové, takže angličtina je tu ta
  // podstatnější polovina - čeština slouží hlavně nám, když se do kalendáře
  // díváme přes svůj účet.
  'booking.pasmo': {
    cs: 'Všechny časy jsou v místním čase studia ({mesto}).',
    en: 'All times are shown in studio local time ({mesto}).',
  },
  'booking.dnes': { cs: 'Dnes', en: 'Today' },
  'booking.tyden': { cs: 'Týden', en: 'Week' },
  'booking.den': { cs: 'Den', en: 'Day' },
  'booking.mesic': { cs: 'Měsíc', en: 'Month' },
  'booking.jenMoje': { cs: 'Jen moje rezervace', en: 'Only my bookings' },
  'booking.mujUcet': { cs: 'Můj účet', en: 'My account' },
  'booking.zpetKalendar': { cs: 'Zpět na kalendář', en: 'Back to the calendar' },
  'booking.mojeUdaje': { cs: 'Moje údaje', en: 'Your details' },
  'booking.jmeno': { cs: 'Jméno', en: 'Name' },
  'booking.telefon': { cs: 'Telefon', en: 'Phone' },
  'booking.email': { cs: 'E-mail', en: 'Email' },
  'booking.emailNapoveda': {
    cs: 'Je to zároveň přihlašovací jméno — změnu nám napište.',
    en: 'This is also your username — write to us if it needs changing.',
  },
  'booking.upozorneni': { cs: 'Upozornění', en: 'Notifications' },
  'booking.upozorneniPopis': {
    cs: 'Chodí e-mailem na adresu výš. Změna platí hned.',
    en: 'These go by email to the address above. Changes take effect straight away.',
  },
  'booking.mailPotvrzeni': { cs: 'Potvrzení rezervace', en: 'Booking confirmation' },
  'booking.mailPotvrzeniPopis': {
    cs: 'Hned po zarezervování přijde e-mail s termínem, ať ho máte černé na bílém.',
    en: 'As soon as you book, we email you the details so you have them in writing.',
  },
  'booking.mailZmena': { cs: 'Změna nebo zrušení termínu', en: 'Changed or cancelled booking' },
  'booking.mailZmenaPopis': {
    cs: 'Kdybychom museli s vaším termínem hnout nebo ho zrušit, dozvíte se to hned.',
    en: 'If we ever have to move or cancel your booking, you hear about it straight away.',
  },
  'booking.mailPripominka': { cs: 'Připomínka den předem', en: 'Reminder the day before' },
  'booking.mailPripominkaPopis': {
    cs: 'Odpoledne před natáčením přijde e-mail s časem a adresou studia.',
    en: 'The afternoon before your session we email you the time and the studio address.',
  },
  'booking.ulozeno': { cs: 'Uloženo.', en: 'Saved.' },
  'booking.napovedaMesic': {
    cs: 'Klepnutím na den se do něj podíváte a můžete rezervovat.',
    en: 'Tap a day to open it and book.',
  },
  'booking.predchozi': { cs: 'Předchozí', en: 'Previous' },
  'booking.dalsi': { cs: 'Další', en: 'Next' },
  'booking.mojeRezervace': { cs: 'Moje rezervace', en: 'Your booking' },
  'booking.obsazeno': { cs: 'Obsazeno', en: 'Busy' },
  'booking.zavreno': { cs: 'Zavřeno', en: 'Closed' },
  'booking.jenNahled': {
    cs: 'Díváte se na kalendář očima klienta studia — rezervovat odtud nejde.',
    en: 'You are viewing the calendar as a studio customer — booking is disabled here.',
  },
  'booking.napoveda': {
    cs: 'Klepnutím na volné místo si zabookujete termín. Nejkratší rezervace je {minut} minut.',
    en: 'Tap any free slot to book it. The shortest booking is {minut} minutes.',
  },
  'booking.nadchazejici': { cs: 'Moje nadcházející rezervace', en: 'Your upcoming bookings' },
  'booking.zadneRezervace': {
    cs: 'Zatím tu žádnou rezervaci nemáte.',
    en: 'You have no bookings yet.',
  },
  'booking.novaRezervace': { cs: 'Nová rezervace', en: 'New booking' },
  'booking.hodiny': { cs: 'Na hodiny', en: 'By the hour' },
  'booking.celeDny': { cs: 'Celé dny', en: 'Whole days' },
  'booking.datum': { cs: 'Datum', en: 'Date' },
  'booking.od': { cs: 'Od', en: 'From' },
  'booking.do': { cs: 'Do', en: 'To' },
  'booking.doData': { cs: 'Do data', en: 'Until' },
  'booking.nazev': { cs: 'Název rezervace', en: 'Booking name' },
  'booking.nazevPriklad': { cs: 'Nahrávání kapely', en: 'Band tracking session' },
  'booking.nazevNapoveda': {
    cs: 'Vidíte ho jen vy a my. Ostatním se ukáže pouze obsazený čas.',
    en: 'Only you and our team can see this. Everyone else sees busy time only.',
  },
  'booking.poznamka': { cs: 'Poznámka pro studio', en: 'Note for the studio' },
  'booking.rezervovat': { cs: 'Rezervovat', en: 'Book it' },
  // Plánování víc termínů najednou (28. 9. 2026) - kalendář studia je
  // výhradně anglicky, česká verze je jen pro náš náhled.
  'booking.pridatDoPlanu': { cs: 'Přidat do plánu', en: 'Add to plan' },
  'booking.pridatDoPlanuPopis': {
    cs: 'Odloží termín stranou. Zabookuje se až tlačítkem dole - a přijde jeden e-mail.',
    en: 'Sets the slot aside. It is booked by the button below - and you get a single email.',
  },
  'booking.planNadpis': { cs: 'Plán ({pocet})', en: 'Your plan ({pocet})' },
  'booking.planOdeslat': { cs: 'Zabookovat ({pocet})', en: 'Book all ({pocet})' },
  'booking.planOdebrat': { cs: 'Odebrat z plánu', en: 'Remove from plan' },
  'booking.planVyprazdnit': { cs: 'Vyprázdnit', en: 'Clear' },
  'booking.planVysvetleni': {
    cs: 'Zatím nic nerezervováno - studio se drží až po odeslání.',
    en: 'Nothing is booked yet - the studio is held only once you send this.',
  },
  'booking.zrusitRezervaci': { cs: 'Zrušit rezervaci', en: 'Cancel booking' },
  'booking.castNeulozena': {
    cs: 'Část dnů se uložit nepodařilo — zbytek už v kalendáři je.',
    en: 'Some of the days could not be booked — the rest is already in the calendar.',
  },
  'booking.chybaZavreno': { cs: 'Studio má tenhle den zavřeno.', en: 'The studio is closed that day.' },
  'booking.chybaMimoDobu': {
    cs: 'Termín je mimo otevírací dobu studia.',
    en: 'That time is outside the studio opening hours.',
  },
  'booking.chybaKratke': {
    cs: 'Rezervace je kratší, než studio dovoluje.',
    en: 'The booking is shorter than the studio allows.',
  },
  'booking.chybaMinulost': { cs: 'Zpětně rezervovat nejde.', en: 'You cannot book a time in the past.' },
  'booking.chybaDaleko': {
    cs: 'Takhle daleko dopředu se zatím rezervovat nedá — napište nám.',
    en: 'That is further ahead than we currently take bookings — just write to us.',
  },
  'booking.chybaObsazeno': { cs: 'Tenhle čas je už obsazený.', en: 'That time is already taken.' },
  // Úprava už zabookovaného termínu (28. 9. 2026).
  'booking.chybaNenalezena': { cs: 'Rezervace se nenašla.', en: 'That booking could not be found.' },
  'booking.chybaCizi': { cs: 'Tohle není vaše rezervace.', en: 'That booking is not yours.' },
  'booking.chybaProbehla': {
    cs: 'Proběhlou rezervaci už změnit nejde.',
    en: 'A booking that has already happened can no longer be changed.',
  },
  'booking.zmenitTermin': { cs: 'Změnit termín', en: 'Change the booking' },
  'booking.ulozitZmenu': { cs: 'Uložit změnu', en: 'Save the change' },
  'booking.menimTermin': {
    cs: 'Měníte termín, který už máte zabookovaný.',
    en: 'You are changing a booking you have already made.',
  },
  'booking.chybaUlozeni': {
    cs: 'Rezervaci se nepodařilo uložit.',
    en: 'The booking could not be saved.',
  },
  'booking.bezPristupuNadpis': { cs: 'Kalendář zatím není přístupný', en: 'Calendar not available' },
  'booking.bezPristupuText': {
    cs: 'K tomuhle účtu zatím není přiřazené žádné studio. Napište nám a přístup doplníme.',
    en: 'No studio is linked to this account yet. Write to us and we will set it up.',
  },

  // --- objednávka audioknihy (dávka 2) -------------------------------------
  'objednavka.bezFirmy': {
    cs: 'Váš účet zatím není přiřazen k žádné firmě. Kontaktujte prosím Mediaspace.',
    en: 'Your account is not linked to a company yet. Please contact Mediaspace.',
  },
  'objednavka.bezDruhu': {
    cs: 'Vaší firmě zatím není nastavený žádný druh zakázek. Kontaktujte prosím Mediaspace.',
    en: 'No type of work has been set up for your company yet. Please contact Mediaspace.',
  },
  'objednavka.bezSazby': {
    cs: 'Vaší firmě zatím není nastavená sazba za normostranu. Kontaktujte prosím Mediaspace.',
    en: 'No rate per standard page has been set up for your company yet. Please contact Mediaspace.',
  },
  'objednavka.typAudiokniha': { cs: 'Audiokniha', en: 'Audiobook' },
  'objednavka.typReklama': { cs: 'Reklama', en: 'Advert' },
  'objednavka.nadpis': { cs: 'Objednávka audioknihy', en: 'Audiobook order' },
  'objednavka.odeslana': { cs: 'Objednávka byla odeslána', en: 'Your order has been sent' },
  'objednavka.odeslanaText': {
    cs: '„{nazev}" — předběžná cena {cena}. Objednávku jsme uložili k vašemu účtu a Mediaspace se vám brzy ozve.',
    en: '“{nazev}” — estimated price {cena}. We have saved the order to your account and Mediaspace will be in touch shortly.',
  },
  'objednavka.dalsiObjednavka': { cs: '+ Vytvořit další objednávku', en: '+ Create another order' },
  'objednavka.zobrazitProjekty': { cs: 'Zobrazit Projekty', en: 'View Projects' },
  'objednavka.odesilameObjednavku': { cs: 'Odesíláme objednávku…', en: 'Sending your order…' },
  'objednavka.cenaVyplnte': {
    cs: 'Cenu bez DPH vyplňte podle vaší nabídky.',
    en: 'Enter the price excluding VAT from your own quote.',
  },
  // Sazba stojí v větě tlustě - vykreslí se přes prelozitKolem (značka {sazba}).
  'objednavka.sazba': {
    cs: 'Vaše sazba: {sazba} / normostrana, bez DPH',
    en: 'Your rate: {sazba} per standard page, excluding VAT',
  },
  'objednavka.nazev': { cs: 'Název', en: 'Title' },
  'objednavka.nazevPriklad': { cs: 'např. Stín nad Vltavou', en: 'e.g. Shadow over the Vltava' },
  'objednavka.pocetNs': { cs: 'Počet normostran', en: 'Number of standard pages' },
  'objednavka.cenaBezDph': { cs: 'Cena bez DPH', en: 'Price excluding VAT' },
  'objednavka.cenaNavrhujete': {
    cs: 'Cenu navrhujete sami. Uvedená částka je bez DPH.',
    en: 'You set the price yourselves. The amount shown excludes VAT.',
  },
  'objednavka.cenaZeSazby': {
    cs: 'Cena se vypočítává dle dohodnuté ceny za normostranu. Uvedená částka je bez DPH.',
    en: 'The price is worked out from the agreed rate per standard page. The amount shown excludes VAT.',
  },
  'objednavka.datumOdevzdani': { cs: 'Datum odevzdání', en: 'Delivery date' },
  'objednavka.preferovanyHerec': { cs: 'Preferovaný herec', en: 'Preferred narrator' },
  'objednavka.preferovanyHerecNapoveda': {
    cs: 'Vyberte jednoho nebo víc herců z databáze, nebo napište vlastní jméno.',
    en: 'Choose one or more narrators from our list, or type a name of your own.',
  },
  'objednavka.uvodZaverNadpis': { cs: 'Úvod a závěr audioknihy', en: 'Audiobook opening and closing' },
  'objednavka.uvodZaverPopis': {
    cs: 'Text se složí sám z údajů níže. Můžete ho upravit, nebo celý přepsat vlastním. Režie je vždy {reziser}.',
    en: 'The text is put together from the details below. You can edit it, or replace it with your own. The director is always {reziser}.',
  },
  'objednavka.autor': { cs: 'Autor', en: 'Author' },
  'objednavka.autorPriklad': { cs: 'např. Emil Hruška', en: 'e.g. Emil Hruška' },
  'objednavka.prekladatel': { cs: 'Překladatel', en: 'Translator' },
  'objednavka.prekladatelPriklad': {
    cs: 'u původně české knihy nechte prázdné',
    en: 'leave blank if the book was not translated',
  },
  'objednavka.nakladatelstvi': { cs: 'Nakladatelství', en: 'Publisher' },
  'objednavka.nakladatelstviPriklad': { cs: 'např. Epocha', en: 'e.g. Epocha' },
  'objednavka.uvod': { cs: 'Úvod', en: 'Opening' },
  'objednavka.zaver': { cs: 'Závěr', en: 'Closing' },
  'objednavka.textUpraveno': { cs: 'upraveno ručně', en: 'edited by hand' },
  'objednavka.textAutomaticky': { cs: 'skládá se automaticky', en: 'put together automatically' },
  'objednavka.vratitAutomaticky': { cs: 'Vrátit automatický text', en: 'Restore the automatic text' },
  'objednavka.poznamka': { cs: 'Poznámka', en: 'Note' },
  'objednavka.poznamkaPlaceholder': {
    cs: 'Cokoliv, co bychom měli vědět k objednávce…',
    en: 'Anything we should know about the order…',
  },
  'objednavka.priloha': { cs: 'Příloha', en: 'Attachment' },
  'objednavka.pustteSoubor': { cs: 'Pusťte soubor sem…', en: 'Drop the file here…' },
  'objednavka.pretahnete': {
    cs: 'Přetáhněte soubor sem, nebo ho vyberte',
    en: 'Drag a file here, or choose one',
  },
  'objednavka.vybratJiny': { cs: 'Vybrat jiný', en: 'Choose another' },
  'objednavka.vybratSoubor': { cs: 'Vybrat soubor', en: 'Choose a file' },
  'objednavka.odebrat': { cs: 'Odebrat', en: 'Remove' },
  'objednavka.pocitamNs': { cs: 'Počítám normostrany z textu…', en: 'Counting standard pages in the text…' },
  // Tři podoby téže věty kvůli českému skloňování (1 / 2-4 / 5+ normostran);
  // anglicky stačí jednotné a množné číslo. Viz sklonujNormostrany.
  'objednavka.rozborNs1': { cs: 'Text má {ns} normostranu', en: 'The text is {ns} standard page' },
  'objednavka.rozborNs234': { cs: 'Text má {ns} normostrany', en: 'The text is {ns} standard pages' },
  'objednavka.rozborNs5': { cs: 'Text má {ns} normostran', en: 'The text is {ns} standard pages' },
  'objednavka.rozborDetail': {
    cs: '{znaku} znaků včetně mezer · {slov} slov · {zdroj}',
    en: '{znaku} characters including spaces · {slov} words · {zdroj}',
  },
  'objednavka.rozborDetailStran': {
    cs: '{znaku} znaků včetně mezer · {slov} slov · {zdroj} · {stran} stran v souboru',
    en: '{znaku} characters including spaces · {slov} words · {zdroj} · {stran} pages in the file',
  },
  'objednavka.rozborVysvetleni': {
    cs: 'Normostrana = {znaku} znaků včetně mezer, započatá strana se počítá celá. Počet v objednávce můžete kdykoliv přepsat.',
    en: 'A standard page is {znaku} characters including spaces, and a part page counts as a whole one. You can overwrite the number in the order at any time.',
  },
  'objednavka.doplnitDoObjednavky': { cs: 'Doplnit {pocet} do objednávky', en: 'Put {pocet} in the order' },
  'objednavka.chybaCteni': {
    cs: 'Text z tohohle souboru se nepodařilo přečíst. Zkuste ho prosím poslat jako Word (.docx) nebo TXT.',
    en: 'The text in this file could not be read. Please send it as Word (.docx) or TXT.',
  },
  'objednavka.zkusitZnovu': { cs: 'Zkusit znovu', en: 'Try again' },
  'objednavka.podrobnosti': { cs: 'Podrobnosti', en: 'Details' },
  'objednavka.bezHlasky': { cs: 'bez hlášky', en: 'no message' },
  'objednavka.neumimSpocitat': {
    cs: 'Z tohohle souboru normostrany spočítat neumím. Umím Word (.docx), PDF, RTF, ODT, EPUB a TXT.',
    en: 'I cannot count standard pages in this file. I can read Word (.docx), PDF, RTF, ODT, EPUB and TXT.',
  },
  'objednavka.spocitatZnovu': { cs: 'Spočítat z textu znovu', en: 'Count from the text again' },
  'objednavka.odesilam': { cs: 'Odesílám…', en: 'Sending…' },
  'objednavka.odeslat': { cs: 'Odeslat', en: 'Send' },
  'objednavka.chybaOdeslani': { cs: 'Objednávku se nepodařilo odeslat.', en: 'The order could not be sent.' },
  'objednavka.chybaPrilohaPripravit': {
    cs: 'Přílohu se nepodařilo připravit k odeslání.',
    en: 'The attachment could not be prepared for sending.',
  },
  'objednavka.chybaPrilohaNahrat': {
    cs: 'Přílohu se nepodařilo nahrát. Zkuste to prosím znovu.',
    en: 'The attachment could not be uploaded. Please try again.',
  },

  // výběr herců do objednávky
  'herci.odebrat': { cs: 'Odebrat {jmeno}', en: 'Remove {jmeno}' },
  'herci.hledat': {
    cs: 'Hledat herce, nebo napsat vlastní jméno…',
    en: 'Search for a narrator, or type a name…',
  },
  'herci.pridat': { cs: '+ Přidat „{jmeno}"', en: '+ Add “{jmeno}”' },

  // náhled a úprava PDF v objednávce
  'upravaPdf.chybaNahled': {
    cs: 'Náhled PDF se nepodařilo načíst. Soubor se odešle tak, jak je.',
    en: 'The PDF preview could not be loaded. The file will be sent as it is.',
  },
  'upravaPdf.chybaUpravy': {
    cs: 'Úpravy se nepodařilo použít. Soubor se odešle celý.',
    en: 'The changes could not be applied. The whole file will be sent.',
  },
  'upravaPdf.pripravuji': { cs: 'Připravuji náhled stránek…', en: 'Preparing the page previews…' },
  'upravaPdf.nadpis': { cs: 'Náhled stránek', en: 'Page preview' },
  'upravaPdf.pocet': { cs: '{zbylo} z {celkem} stran', en: '{zbylo} of {celkem} pages' },
  'upravaPdf.vyrazeno': { cs: '{pocet} vyřazeno', en: '{pocet} left out' },
  'upravaPdf.ukladam': { cs: 'ukládám úpravy…', en: 'saving the changes…' },
  'upravaPdf.vratitVse': { cs: 'Vrátit všechny stránky', en: 'Restore every page' },
  'upravaPdf.napoveda': {
    cs: 'Kliknutím stránku zvětšíte. Křížkem ji vyřadíte z objednávky (třeba obálku, obsah nebo tiráž), šipkou otočíte. Normostrany se přepočítají z toho, co zůstane.',
    en: 'Click a page to enlarge it. The cross leaves it out of the order (the cover, the contents or the imprint, say) and the arrow rotates it. The standard pages are recounted from what is left.',
  },
  'upravaPdf.strana': { cs: 'Strana {cislo}', en: 'Page {cislo}' },
  'upravaPdf.otocit90': { cs: 'Otočit o 90°', en: 'Rotate by 90°' },
  'upravaPdf.otocitStranu': { cs: 'Otočit stranu {cislo}', en: 'Rotate page {cislo}' },
  'upravaPdf.vratitStranku': { cs: 'Vrátit stránku', en: 'Restore the page' },
  'upravaPdf.vyraditStranku': { cs: 'Vyřadit stránku', en: 'Leave the page out' },
  'upravaPdf.vratitStranu': { cs: 'Vrátit stranu {cislo}', en: 'Restore page {cislo}' },
  'upravaPdf.vyraditStranu': { cs: 'Vyřadit stranu {cislo}', en: 'Leave page {cislo} out' },
  'upravaPdf.velkaStrana': { cs: 'Strana {cislo} / {celkem}', en: 'Page {cislo} of {celkem}' },
  'upravaPdf.vyrazenaStitek': { cs: 'vyřazena', en: 'left out' },
  'upravaPdf.predchoziStrana': { cs: 'Předchozí strana', en: 'Previous page' },
  'upravaPdf.dalsiStrana': { cs: 'Další strana', en: 'Next page' },
  'upravaPdf.otocit': { cs: '↻ Otočit', en: '↻ Rotate' },

  // --- objednávka reklamy jako průvodce (dávka 2) ---------------------------
  'objednavkaReklama.krokNazev': { cs: 'Jak se zakázka jmenuje?', en: 'What is the job called?' },
  'objednavkaReklama.krokNazevPopis': {
    cs: 'Stačí pracovní název, ať ji oba poznáme.',
    en: 'A working title is enough, so we both recognise it.',
  },
  // Od 26. 9. 2026 je krok seznamem VÝSTUPŮ, ne jedním zaškrtáváním služeb.
  'objednavkaReklama.krokSluzby': {
    cs: 'Co pro vás máme vyrobit?',
    en: 'What would you like us to produce?',
  },
  'objednavkaReklama.krokSluzbyPopis': {
    cs: 'Každý spot nebo voiceover zvlášť — u každého vyberte, co k němu patří.',
    en: 'Each advert or voiceover separately — choose what belongs to each one.',
  },
  'objednavkaReklama.krokHerec': { cs: 'Máte představu o hlasu?', en: 'Do you have a voice in mind?' },
  'objednavkaReklama.krokHerecPopis': {
    cs: 'Když ne, nevadí — vybereme a pošleme ukázky.',
    en: 'If not, no matter — we will choose some and send you samples.',
  },
  'objednavkaReklama.krokTermin': { cs: 'Do kdy to potřebujete?', en: 'When do you need it by?' },
  'objednavkaReklama.krokTerminPopis': {
    cs: 'Termín odevzdání hotového zvuku.',
    en: 'The delivery date for the finished audio.',
  },
  'objednavkaReklama.krokShrnuti': { cs: 'Sedí to?', en: 'Does this look right?' },
  'objednavkaReklama.krokShrnutiPopis': {
    cs: 'Ještě můžete přidat poznámku nebo podklady.',
    en: 'You can still add a note or supporting files.',
  },
  'objednavkaReklama.krok': { cs: 'Krok {cislo} z {celkem}', en: 'Step {cislo} of {celkem}' },
  'objednavkaReklama.objednavka': { cs: 'Objednávka', en: 'Order' },
  'objednavkaReklama.odeslanaText': {
    cs: '„{nazev}" — objednávku jsme uložili k vašemu účtu a Mediaspace se vám brzy ozve.',
    en: '“{nazev}” — we have saved the order to your account and Mediaspace will be in touch shortly.',
  },
  'objednavkaReklama.nazevPriklad': { cs: 'např. Vánoční kampaň 2026', en: 'e.g. Christmas campaign 2026' },
  'objednavkaReklama.hlasPriklad': {
    cs: 'např. mužský hlas, 40+, klidný — nebo konkrétní jméno',
    en: 'e.g. male voice, 40+, calm — or a particular name',
  },
  'objednavkaReklama.hlasNapoveda': {
    cs: 'Klidně nechte prázdné. Podle zakázky vybereme hlasy a pošleme vám ukázky.',
    en: 'Feel free to leave this blank. We will pick voices to suit the job and send you samples.',
  },
  'objednavkaReklama.terminNapoveda': {
    cs: 'Když termín ještě neznáte, přeskočte to — domluvíme se.',
    en: 'If you do not know the date yet, skip it — we will sort it out together.',
  },
  'objednavkaReklama.pNazev': { cs: 'Název', en: 'Title' },
  'objednavkaReklama.pSluzby': { cs: 'Co pro vás vyrobíme', en: 'What we will produce' },
  'objednavkaReklama.pHlas': { cs: 'Hlas', en: 'Voice' },
  'objednavkaReklama.pTermin': { cs: 'Termín', en: 'Deadline' },
  'objednavkaReklama.hlasNaVas': { cs: 'necháváme na vás', en: 'leaving it to you' },
  'objednavkaReklama.terminDomluvime': { cs: 'domluvíme se', en: 'to be agreed' },
  'objednavkaReklama.poznamkaPlaceholder': {
    cs: 'Cokoliv, co bychom měli vědět — tonalita, stopáž, kde se spot bude hrát…',
    en: 'Anything we should know — tone, length, where the advert will run…',
  },
  'objednavkaReklama.podklady': {
    cs: 'Podklady (scénář, storyboard, hudba) — přetáhněte sem nebo klikněte',
    en: 'Supporting files (script, storyboard, music) — drag them here or click',
  },
  'objednavkaReklama.upravit': { cs: 'upravit', en: 'edit' },
  'objednavkaReklama.zpet': { cs: 'Zpět', en: 'Back' },
  'objednavkaReklama.preskocit': { cs: 'Přeskočit', en: 'Skip' },
  'objednavkaReklama.odeslatObjednavku': { cs: 'Odeslat objednávku', en: 'Send the order' },
  'objednavkaReklama.pokracovat': { cs: 'Pokračovat', en: 'Continue' },
  // Číselník služeb (lib/sluzbyReklamy.ts) - do projektu i do mailu jde dál
  // český název, přeložený je jen ten, co klient vidí ve formuláři.
  'objednavkaReklama.sluzba.voiceover': { cs: 'Natáčení voiceoveru', en: 'Voiceover recording' },
  'objednavkaReklama.sluzbaPopis.voiceover': {
    cs: 'Namluvíme text ve studiu — herec, režie, čistý záznam.',
    en: 'We record the script in the studio — voice actor, direction, a clean take.',
  },
  'objednavkaReklama.sluzba.postprodukce': { cs: 'Zvuková postprodukce', en: 'Audio post-production' },
  'objednavkaReklama.sluzbaPopis.postprodukce': {
    cs: 'Střih, čištění, mix a mastering hotového materiálu.',
    en: 'Editing, clean-up, mixing and mastering of the finished material.',
  },
  'objednavkaReklama.sluzba.sounddesign': { cs: 'Sound design', en: 'Sound design' },
  'objednavkaReklama.sluzbaPopis.sounddesign': {
    cs: 'Ruchy, atmosféry a hudební podkres — zvuk, který spot posune.',
    en: 'Foley, atmospheres and underscore — sound that lifts the advert.',
  },

  // --- můj účet (dávka 2) ---------------------------------------------------
  'mujUcet.nadpis': { cs: 'Můj účet', en: 'My account' },
  'mujUcet.kodUctu': { cs: 'Kód účtu', en: 'Account code' },
  'mujUcet.typPristupu': { cs: 'Typ přístupu', en: 'Access level' },
  'mujUcet.firma': { cs: 'Firma', en: 'Company' },
  'mujUcet.tabule': { cs: 'Tabule ve studiu', en: 'Studio display' },
  'mujUcet.tabuleJedna': { cs: 'Dnešní program studia na displeji.', en: 'Today’s studio schedule on the display.' },
  'mujUcet.tabuleVic': { cs: 'Dnešní program studií ({pocet}).', en: 'Today’s schedule for {pocet} studios.' },
  'mujUcet.wikipedie': { cs: 'Wikipedie', en: 'Wikipedia' },
  'mujUcet.wikipediePopis': {
    cs: 'Váš koncept článku, náhled a odeslání na Wikipedii.',
    en: 'Your draft article, the preview and sending it to Wikipedia.',
  },
  'mujUcet.otevrit': { cs: 'Otevřít →', en: 'Open →' },
  'mujUcet.kontaktniUdaje': { cs: 'Kontaktní údaje', en: 'Contact details' },
  'mujUcet.fotka': { cs: 'Fotka', en: 'Photo' },
  'mujUcet.fotkaNapoveda': {
    cs: 'Ukazuje se u vašich zpráv v MS chatu.',
    en: 'It shows next to your messages in MS chat.',
  },
  'mujUcet.jmeno': { cs: 'Jméno', en: 'Name' },
  'mujUcet.telefon': { cs: 'Telefon', en: 'Phone' },
  'mujUcet.email': { cs: 'E-mail', en: 'Email' },
  'mujUcet.emailNapoveda': {
    cs: 'Tímto e-mailem se do portálu přihlašujete.',
    en: 'This is the email you sign in with.',
  },
  'mujUcet.datumNarozeni': { cs: 'Datum narození', en: 'Date of birth' },
  'mujUcet.chybaUlozeni': { cs: 'Uložení se nezdařilo.', en: 'Saving failed.' },
  'mujUcet.ulozeno': { cs: 'Uloženo.', en: 'Saved.' },
  'mujUcet.emailZmenen': {
    cs: 'E-mail je změněný. Příště se přihlaste novou adresou — kvůli tomu je potřeba se teď odhlásit.',
    en: 'Your email has changed. Sign in with the new address next time — which means signing out now.',
  },
  'mujUcet.fakturace': { cs: 'Fakturace', en: 'Invoicing' },
  'mujUcet.fakturacePopis': {
    cs: 'Kam posílat faktury a nabídky pro {firma}.',
    en: 'Where to send invoices and quotes for {firma}.',
  },
  'mujUcet.emailFaktury': { cs: 'E-mail pro faktury', en: 'Email for invoices' },
  'mujUcet.emailFakturyPriklad': { cs: 'ucetni@vasefirma.cz', en: 'accounts@yourcompany.co.uk' },
  'mujUcet.emailFakturyNapoveda': {
    cs: 'Typicky vaše účtárna — sem chodí doklady vždycky.',
    en: 'Usually your accounts department — documents always go here.',
  },
  'mujUcet.kopieNaMuj': { cs: 'Chci kopii i na svůj mail', en: 'Send a copy to my email too' },
  'mujUcet.kopieNapoveda': {
    cs: 'Kopie přijde na váš e-mail u projektů, kde jste uvedený jako klient. Na účtárnu jde faktura vždycky.',
    en: 'You get a copy for the projects where you are listed as the customer. The invoice always goes to the accounts department as well.',
  },
  'mujUcet.upozorneni': { cs: 'Upozornění', en: 'Notifications' },
  'mujUcet.upozorneniPopis': { cs: 'Co vám má portál hlásit.', en: 'What the portal should tell you about.' },
  'mujUcet.dotoceno': {
    cs: 'Chci vědět, když dotočíme s hercem',
    en: 'Tell me when we finish recording with the narrator',
  },
  'mujUcet.dotocenoPopis': {
    cs: 'Mail a zvoneček v portálu pokaždé, když ve studiu skončíme s hercem na některém z vašich projektů.',
    en: 'An email and a bell in the portal every time we finish in the studio with a narrator on one of your projects.',
  },
  // Změna natáčecího termínu (1. 10. 2026) - druhé zaškrtávátko v kartě
  // Upozornění, jen u klienta.
  'mujUcet.zmenaTerminu': {
    cs: 'Chci vědět, když se změní natáčecí termín',
    en: 'Tell me when a recording session changes',
  },
  'mujUcet.zmenaTerminuPopis': {
    cs: 'Mail a zvoneček, když se natáčecí frekvence na některém z vašich projektů přesune nebo zruší.',
    en: 'An email and a bell when a recording session on one of your projects moves or is cancelled.',
  },
  'mujUcet.prehledDne': { cs: 'Přehled dne a připomínky', en: 'Daily brief and reminders' },
  'mujUcet.prehledDnePopis': {
    cs: 'Co vás ten den čeká — a štouchnutí před každou událostí.',
    en: 'What your day holds — and a nudge before every event.',
  },
  'mujUcet.hlidatDen': { cs: 'Hlídat mi den', en: 'Keep an eye on my day' },
  'mujUcet.hlidatDenPopis': {
    cs: 'Při prvním otevření portálu vyskočí okno s programem dne — natáčení a střihy, kde jste zvukař nebo herec, porady a schůzky, na které jste pozvaní, a otevřené úkoly. Do telefonu ráno nic nechodí; Bruno se ozve až patnáct minut před každou událostí, do chatu i do telefonu.',
    en: 'The first time you open the portal a window pops up with the day ahead — recordings and editing where you are the sound engineer or the narrator, meetings you are invited to, and open tasks. Nothing reaches your phone in the morning; Bruno only gets in touch fifteen minutes before each event, in the chat and on your phone.',
  },
  'mujUcet.podpisNadpis': { cs: 'Můj podpis na smlouvy', en: 'My signature for contracts' },
  'mujUcet.podpisPodepisujete': {
    cs: 'Smlouvy za Mediaspace podepisujete vy — tímhle podpisem odcházejí klientům.',
    en: 'You are the one who signs contracts for Mediaspace — this is the signature customers receive.',
  },
  'mujUcet.podpisUlozi': {
    cs: 'Uloží se k účtu. Použije se, až budete podepisovat smlouvy za Mediaspace.',
    en: 'It is saved to your account and used once you start signing contracts for Mediaspace.',
  },
  'mujUcet.podpisUlozeny': { cs: 'Uložený podpis', en: 'Saved signature' },
  'mujUcet.zmenitPodpis': { cs: 'Změnit podpis', en: 'Change the signature' },
  'mujUcet.ulozitPodpis': { cs: 'Uložit podpis', en: 'Save the signature' },
  'mujUcet.podpisBez': {
    cs: 'Dokud tu žádný není, podepisuje se jménem psaným písmem — jako výše.',
    en: 'Until there is one, contracts are signed with your name in handwriting — as above.',
  },
  'mujUcet.podpisChyba': { cs: 'Podpis se nepodařilo uložit.', en: 'The signature could not be saved.' },
  'mujUcet.pripominky': { cs: 'Připomínky k portálu', en: 'Portal feedback' },
  'mujUcet.pripominkySpravce': {
    cs: 'Co lidem v portálu vadí. Odškrtnutá položka jim zmizí ze seznamu.',
    en: 'What people find awkward in the portal. A ticked item disappears from their list.',
  },
  'mujUcet.pripominkyMoje': {
    cs: 'Co jste poslali. Až to bude hotové, položka zmizí.',
    en: 'What you have sent. Once it is done, the item disappears.',
  },
  'mujUcet.pripominkyCeka': { cs: 'Čeká ({pocet})', en: 'Waiting ({pocet})' },
  'mujUcet.pripominkyHotove': { cs: 'Hotové ({pocet})', en: 'Done ({pocet})' },
  'mujUcet.pripominkyNicNeceka': {
    cs: 'Nic nečeká. Lidem se portál zatím líbí.',
    en: 'Nothing is waiting. People are happy with the portal so far.',
  },
  'mujUcet.pripominkyNicHotove': { cs: 'Zatím nic odškrtnutého.', en: 'Nothing ticked off yet.' },
  'mujUcet.pripominkyNicJste': {
    cs: 'Zatím jste nic neposlali. Bublina v horní liště je na to.',
    en: 'You have not sent anything yet. The bubble in the top bar is there for it.',
  },
  'mujUcet.pripominkaVratit': { cs: 'Vrátit mezi čekající', en: 'Put it back among the waiting' },
  'mujUcet.pripominkaOdskrtnout': { cs: 'Odškrtnout', en: 'Tick it off' },
  'mujUcet.pripominkaDalsi': { cs: '+{pocet} další hlásí totéž', en: '+{pocet} more report the same' },
  'mujUcet.pripominkaOdskrtl': { cs: 'odškrtl {jmeno}', en: 'ticked off by {jmeno}' },
  'mujUcet.pripominkaZvetsit': { cs: 'Zvětšit', en: 'Enlarge' },
  'mujUcet.pripominkaSmazat': { cs: 'Opravdu smazat?', en: 'Delete it?' },
  'mujUcet.printscreen': { cs: 'Printscreen', en: 'Screenshot' },

  // --- moje termíny očima herce (dávka 2) -----------------------------------
  'mojeTerminy.nadpis': { cs: 'Moje termíny', en: 'My sessions' },
  'mojeTerminy.pridatDoKalendare': {
    cs: 'Potvrzené natáčení si přidejte do svého kalendáře.',
    en: 'Add your confirmed recording sessions to your own calendar.',
  },
  'mojeTerminy.zadne': { cs: 'Zatím pro vás žádné termíny nejsou.', en: 'There are no sessions for you yet.' },
  'mojeTerminy.cekaNaVyber': { cs: 'Čeká na váš výběr', en: 'Waiting for you to choose' },
  'mojeTerminy.vyberteZ': {
    cs: '{studio} · vyberte {pocet} z {nabidnuto} nabídnutých',
    en: '{studio} · choose {pocet} of the {nabidnuto} offered',
  },
  'mojeTerminy.vybratTerminy': { cs: 'Vybrat termíny →', en: 'Choose sessions →' },
  'mojeTerminy.mojeNataceni': { cs: 'Moje natáčení', en: 'My recording sessions' },
  'mojeTerminy.probehla': { cs: 'Proběhlá natáčení', en: 'Past recording sessions' },
  'mojeTerminy.probehlo': { cs: 'Proběhlo', en: 'Done' },
  // Skloňování frekvencí: 1 / 2-4 / 5+ (anglicky jednotné a množné číslo).
  'mojeTerminy.frekvence1': { cs: '{pocet} frekvence', en: '{pocet} recording session' },
  'mojeTerminy.frekvence234': { cs: '{pocet} frekvence', en: '{pocet} recording sessions' },
  'mojeTerminy.frekvence5': { cs: '{pocet} frekvencí', en: '{pocet} recording sessions' },
  'mojeTerminy.tentoTyden': { cs: 'Tento týden', en: 'This week' },
  'mojeTerminy.pristiTyden': { cs: 'Příští týden', en: 'Next week' },
  'mojeTerminy.tyden': { cs: 'Týden', en: 'Week' },
  'mojeTerminy.popisTydne': { cs: '{nazev} · {od} – {do}', en: '{nazev} · {od} – {do}' },
  'mojeTerminy.potvrzeno': { cs: '✓ Potvrzeno', en: '✓ Confirmed' },
  'mojeTerminy.cekaNaPotvrzeni': { cs: 'Čeká na potvrzení', en: 'Awaiting confirmation' },
  'mojeTerminy.zavrit': { cs: 'Zavřít', en: 'Close' },
  'mojeTerminy.zmenaTerminu': { cs: 'Změna termínu', en: 'Change the time' },
  'mojeTerminy.cekaPresun': {
    cs: 'Čeká na potvrzení přesunu na {den} {od}–{do}.',
    en: 'A move to {den} {od}–{do} is awaiting confirmation.',
  },
  'mojeTerminy.zrusitZadost': { cs: 'Zrušit žádost', en: 'Cancel the request' },
  'mojeTerminy.vyberteNovy': {
    cs: 'Vyberte nový termín. Volné jsou jen časy, kdy máme místo ve studiu.',
    en: 'Choose a new time. Only the times when we have room in the studio are free.',
  },
  'mojeTerminy.vyberteNovySLimitem': {
    cs: 'Vyberte nový termín. Volné jsou jen časy, kdy máme místo ve studiu. Termíny po {datum} posouvají odevzdání a musíme je potvrdit.',
    en: 'Choose a new time. Only the times when we have room in the studio are free. A time after {datum} pushes the delivery date back, so we have to confirm it.',
  },
  'mojeTerminy.hledamVolne': { cs: 'Hledám volné termíny…', en: 'Looking for free times…' },
  'mojeTerminy.zadnyJiny': {
    cs: 'Teď není volný žádný jiný termín.',
    en: 'There is no other free time at the moment.',
  },
  'mojeTerminy.chybaNacteni': {
    cs: 'Volné termíny se nepodařilo načíst.',
    en: 'The free times could not be loaded.',
  },
  'mojeTerminy.chybaPresun': { cs: 'Přesun se nepodařil.', en: 'The move failed.' },
  'mojeTerminy.zadostPrijata': {
    cs: 'Žádost o přesun jsme dostali. Termín platí původní, dokud přesun nepotvrdíme - dáme vám vědět.',
    en: 'We have your request to move the session. The original time stands until we confirm the move — we will let you know.',
  },
  'mojeTerminy.presunuto': { cs: 'Hotovo, termín je přesunutý.', en: 'Done, the session has been moved.' },
  'mojeTerminy.poTerminu': {
    cs: 'Po termínu odevzdání - musíme potvrdit',
    en: 'After the delivery date — we have to confirm it',
  },
  'mojeTerminy.presunoutSem': { cs: 'Přesunout sem', en: 'Move it here' },
  'mojeTerminy.musimePotvrditNadpis': { cs: 'Tenhle termín musíme potvrdit', en: 'We have to confirm this time' },
  'mojeTerminy.musimePotvrditText': {
    cs: 'Nový termín je až po {datum} - posune se nám tím termín odevzdání knihy. Přesun proto musí potvrdit produkce. Do té doby platí váš původní termín.',
    en: 'The new time falls after {datum}, which pushes back the delivery date for the book. Production therefore has to confirm the move. Until then your original time stands.',
  },
  'mojeTerminy.terminOdevzdani': { cs: 'termínu odevzdání', en: 'the delivery date' },
  'mojeTerminy.pozadatOPresun': { cs: 'Požádat o přesun', en: 'Request the move' },
  'mojeTerminy.vybratJiny': { cs: 'Vybrat jiný termín', en: 'Choose a different time' },

  // --- nahrávky odkazem z mailu (dávka 2) -----------------------------------
  'nahravkyOdkaz.nadpis': { cs: 'Nahrávky', en: 'Recordings' },
  'nahravkyOdkaz.projekt': { cs: 'Projekt', en: 'Project' },
  'nahravkyOdkaz.neplatnyNadpis': { cs: 'Odkaz už neplatí', en: 'This link is no longer valid' },
  'nahravkyOdkaz.neplatnyText': {
    cs: 'Tenhle odkaz na nahrávky byl uzavřený nebo nahrazený novým. Napište nám a pošleme vám aktuální.',
    en: 'This link to the recordings has been closed or replaced with a new one. Write to us and we will send you the current one.',
  },
  'nahravkyOdkaz.bezNahravekNadpis': { cs: 'Nahrávky tu zatím nejsou', en: 'The recordings are not here yet' },
  'nahravkyOdkaz.bezNahravekText': {
    cs: 'U tohohle projektu ještě není složka s nahrávkami. Ozvěte se nám, prosím.',
    en: 'This project has no recordings folder yet. Please get in touch with us.',
  },

  // --- smlouva k podpisu, veřejná stránka (dávka 2) -------------------------
  'smlouvaVerejna.kPodpisu': { cs: 'Smlouva k podpisu · {firma}', en: 'Contract to sign · {firma}' },
  'smlouvaVerejna.uvod': {
    cs: 'Přečtěte si smlouvu a podepište se dole — myší, nebo prstem na mobilu. Přihlašovat se nemusíte a žádný kód nikam neopisujete.',
    en: 'Read the contract and sign at the bottom — with your mouse, or your finger on a phone. You do not need to sign in and there is no code to copy anywhere.',
  },
  'smlouvaVerejna.zrusena': { cs: 'Smlouva byla zrušena', en: 'The contract has been withdrawn' },
  'smlouvaVerejna.zrusenaText': {
    cs: '{firma} tuhle smlouvu stáhl. Ozvěte se prosím produkci.',
    en: '{firma} has withdrawn this contract. Please get in touch with production.',
  },
  'smlouvaVerejna.odmitnut': { cs: 'Podpis odmítnut', en: 'Signature declined' },
  'smlouvaVerejna.odmitnutText': {
    cs: 'Odmítnuto {kdy}. {firma} o tom ví a ozve se vám.',
    en: 'Declined {kdy}. {firma} knows about it and will be in touch.',
  },
  'smlouvaVerejna.podepsana': { cs: 'Smlouva je podepsaná', en: 'The contract is signed' },
  'smlouvaVerejna.podpisUlozeny': { cs: 'Váš podpis je uložený', en: 'Your signature is saved' },
  'smlouvaVerejna.uzavreno': {
    cs: 'Uzavřeno {kdy}. Podepsanou smlouvu máte výše i s doložkou — stránku si můžete uložit jako PDF přes tisk prohlížeče.',
    en: 'Completed {kdy}. The signed contract is above together with the signing record — you can save the page as a PDF through your browser’s print dialogue.',
  },
  'smlouvaVerejna.cekaNaNas': {
    cs: 'Děkujeme. Jakmile smlouvu podepíše i {firma}, dáme vám vědět e-mailem.',
    en: 'Thank you. As soon as {firma} has signed it too, we will let you know by email.',
  },
  'smlouvaVerejna.odmitnutiNadpis': { cs: 'Odmítnutí podpisu', en: 'Declining to sign' },
  'smlouvaVerejna.coNesedi': {
    cs: 'Co ve smlouvě nesedí? (nepovinné)',
    en: 'What is wrong with the contract? (optional)',
  },
  'smlouvaVerejna.odmitnoutPodpis': { cs: 'Odmítnout podpis', en: 'Decline to sign' },
  'smlouvaVerejna.odesilam': { cs: 'Odesílám…', en: 'Sending…' },
  'smlouvaVerejna.zpet': { cs: 'Zpět', en: 'Back' },
  'smlouvaVerejna.vasPodpis': { cs: 'Váš podpis', en: 'Your signature' },
  'smlouvaVerejna.jmeno': { cs: 'Jméno a příjmení', en: 'Full name' },
  'smlouvaVerejna.souhlas': {
    cs: 'Smlouvu jsem si přečetl(a), souhlasím s jejím zněním a podepisuji ji elektronicky. Beru na vědomí, že se k podpisu uloží datum a čas, IP adresa a otisk podepsaného textu.',
    en: 'I have read the contract, I agree to its wording and I am signing it electronically. I understand that the date and time, the IP address and a fingerprint of the signed text are stored with the signature.',
  },
  'smlouvaVerejna.podepisuji': { cs: 'Podepisuji…', en: 'Signing…' },
  'smlouvaVerejna.podepsat': { cs: 'Podepsat smlouvu', en: 'Sign the contract' },
  'smlouvaVerejna.nesouhlasim': { cs: 'Nesouhlasím, odmítnout', en: 'I do not agree, decline' },
  'smlouvaVerejna.chyba': { cs: 'Akci se nepodařilo uložit.', en: 'The action could not be saved.' },

  // --- nabídka ke schválení, veřejná stránka (dávka 2) ----------------------
  'nabidkaVerejna.cislo': { cs: 'Nabídka {cislo}', en: 'Quote {cislo}' },
  'nabidkaVerejna.bezPredmetu': { cs: 'Nabídka k odsouhlasení', en: 'Quote for approval' },
  'nabidkaVerejna.vystaveno': { cs: 'Vystaveno {datum}', en: 'Issued {datum}' },
  'nabidkaVerejna.vystavenoPlatnost': {
    cs: 'Vystaveno {datum} · platnost do {do}',
    en: 'Issued {datum} · valid until {do}',
  },
  'nabidkaVerejna.dodavatel': { cs: 'Dodavatel', en: 'Supplier' },
  'nabidkaVerejna.odberatel': { cs: 'Odběratel', en: 'Customer' },
  'nabidkaVerejna.pripravil': { cs: 'Nabídku pro vás připravil', en: 'Your quote was prepared by' },
  'nabidkaVerejna.ic': { cs: 'IČ {cislo}', en: 'Company no. {cislo}' },
  'nabidkaVerejna.dic': { cs: 'DIČ {cislo}', en: 'VAT no. {cislo}' },
  'nabidkaVerejna.slPolozka': { cs: 'Položka', en: 'Item' },
  'nabidkaVerejna.slMnozstvi': { cs: 'Množství', en: 'Quantity' },
  'nabidkaVerejna.slCenaJ': { cs: 'Cena / j.', en: 'Unit price' },
  'nabidkaVerejna.slDph': { cs: 'DPH', en: 'VAT' },
  'nabidkaVerejna.slCelkem': { cs: 'Celkem', en: 'Total' },
  'nabidkaVerejna.mezisoucet': { cs: 'Mezisoučet bez DPH', en: 'Subtotal excluding VAT' },
  'nabidkaVerejna.sleva': { cs: 'Sleva', en: 'Discount' },
  'nabidkaVerejna.slevaProcent': { cs: 'Sleva {procent} %', en: 'Discount {procent}%' },
  'nabidkaVerejna.zaklad': { cs: 'Základ bez DPH', en: 'Net excluding VAT' },
  'nabidkaVerejna.dphSazba': { cs: 'DPH {sazba} %', en: 'VAT {sazba}%' },
  'nabidkaVerejna.poznamka': { cs: 'Poznámka', en: 'Note' },
  'nabidkaVerejna.schvalena': { cs: 'Nabídka schválena', en: 'Quote approved' },
  'nabidkaVerejna.schvalilKdo': {
    cs: 'Schválil(a) {jmeno} {kdy}. Ozveme se vám s dalšími kroky.',
    en: 'Approved by {jmeno} {kdy}. We will be in touch with the next steps.',
  },
  'nabidkaVerejna.schvalenoKdy': {
    cs: 'Schváleno {kdy}. Ozveme se vám s dalšími kroky.',
    en: 'Approved {kdy}. We will be in touch with the next steps.',
  },
  'nabidkaVerejna.odmitnuta': { cs: 'Nabídka odmítnuta', en: 'Quote declined' },
  // Adresa ve větě je odkaz, proto se věta vykresluje přes prelozitKolem.
  'nabidkaVerejna.odmitnutaMail': {
    cs: 'Zaznamenáno {kdy}. Pokud jste se překlikli nebo chcete něco doladit, ozvěte se na {email}.',
    en: 'Recorded {kdy}. If you clicked by mistake or would like to adjust something, write to {email}.',
  },
  'nabidkaVerejna.odmitnutaFirma': {
    cs: 'Zaznamenáno {kdy}. Pokud jste se překlikli nebo chcete něco doladit, ozvěte se firmě {firma}.',
    en: 'Recorded {kdy}. If you clicked by mistake or would like to adjust something, get in touch with {firma}.',
  },
  'nabidkaVerejna.preceJenSchvalit': { cs: 'Přece jen schválit', en: 'Approve it after all' },
  'nabidkaVerejna.ukladam': { cs: 'Ukládám…', en: 'Saving…' },
  'nabidkaVerejna.schvaluji': { cs: 'Schvaluji nabídku', en: 'I approve this quote' },
  'nabidkaVerejna.chyba': { cs: 'Akci se nepodařilo uložit.', en: 'The action could not be saved.' },

  // --- výběr natáčecích termínů hercem, veřejná stránka (dávka 2) -----------
  'terminyVyber.nadpis': { cs: 'Natáčecí termíny', en: 'Recording sessions' },
  'terminyVyber.poznamkaProdukce': { cs: 'Poznámka produkce:', en: 'Note from production:' },
  'terminyVyber.zrusenaTuk': { cs: 'Nabídka byla zrušena.', en: 'The offer has been withdrawn.' },
  'terminyVyber.zrusenaText': {
    cs: 'Produkce se vám ozve s novými termíny.',
    en: 'Production will be in touch with new times.',
  },
  'terminyVyber.zamitnutTuk': {
    cs: 'Tenhle výběr produkce zamítla.',
    en: 'Production has turned this selection down.',
  },
  'terminyVyber.duvod': { cs: 'Důvod: {duvod}', en: 'Reason: {duvod}' },
  'terminyVyber.zamitnutJinak': {
    cs: 'Ozve se vám s dalším postupem.',
    en: 'They will be in touch about what happens next.',
  },
  'terminyVyber.novyVyberTuk': {
    cs: 'Produkce vás prosí o nový výběr.',
    en: 'Production would like you to choose again.',
  },
  'terminyVyber.potvrzeneNadpis': { cs: 'Termíny jsou potvrzené', en: 'Your sessions are confirmed' },
  'terminyVyber.tesimeSe': {
    cs: 'Těšíme se na vás ve studiu.',
    en: 'We look forward to seeing you in the studio.',
  },
  'terminyVyber.odeslanoNadpis': {
    cs: 'Výběr odeslán ke schválení',
    en: 'Your selection has been sent for approval',
  },
  'terminyVyber.drzeno': {
    cs: 'Děkujeme. Termíny jsou pro vás držené a produkce je potvrdí — dáme vám vědět e-mailem.',
    en: 'Thank you. The times are being held for you and production will confirm them — we will let you know by email.',
  },
  'terminyVyber.drzenoDo': {
    cs: 'Děkujeme. Termíny jsou pro vás držené do {kdy} a produkce je potvrdí — dáme vám vědět e-mailem.',
    en: 'Thank you. The times are being held for you until {kdy} and production will confirm them — we will let you know by email.',
  },
  // Počet termínů stojí ve větě tlustě - vykreslí se přes prelozitKolem.
  'terminyVyber.uvod': {
    cs: 'Dobrý den, {jmeno}. Vyberte si prosím {pocet} z nabídnutých. Když vám čas nesedí, u každého termínu si můžete zvolit vlastní.',
    en: 'Hello {jmeno}. Please choose {pocet} of the times offered. If none of them suits you, you can set your own time for any of them.',
  },
  'terminyVyber.termin1': { cs: '{pocet} termín', en: '{pocet} session' },
  'terminyVyber.termin234': { cs: '{pocet} termíny', en: '{pocet} sessions' },
  'terminyVyber.termin5': { cs: '{pocet} termínů', en: '{pocet} sessions' },
  'terminyVyber.vybranoVse': { cs: 'Vybráno všech {pocet} ✓', en: 'All {pocet} chosen ✓' },
  'terminyVyber.zbyvaVybrat': { cs: 'zbývá vybrat', en: 'still to choose' },
  'terminyVyber.jesteZbyva': { cs: 'ještě zbývá vybrat', en: 'still left to choose' },
  'terminyVyber.vybranoZ': { cs: 'Vybráno: {vybrano} z {celkem}', en: 'Chosen: {vybrano} of {celkem}' },
  'terminyVyber.odesilam': { cs: 'Odesílám…', en: 'Sending…' },
  'terminyVyber.odeslatKeSchvaleni': { cs: 'Odeslat ke schválení', en: 'Send for approval' },
  'terminyVyber.zadneVolne': {
    cs: 'Zatím tu žádné volné termíny nejsou. Produkce vám pošle nové.',
    en: 'There are no free times here yet. Production will send you some.',
  },
  'terminyVyber.vasCas': { cs: 'Váš čas', en: 'Your time' },
  'terminyVyber.jizVybrano': {
    cs: 've stejný čas už máte vybráno',
    en: 'you have already chosen this time',
  },
  'terminyVyber.vybratVlastni': { cs: 'Vybrat vlastní čas', en: 'Set your own time' },
  'terminyVyber.od': { cs: 'Od', en: 'From' },
  'terminyVyber.do': { cs: 'Do', en: 'To' },
  'terminyVyber.pouzitCas': { cs: 'Použít tento čas', en: 'Use this time' },
  'terminyVyber.zrusit': { cs: 'Zrušit', en: 'Cancel' },
  'terminyVyber.chybaKonec': { cs: 'Konec musí být po začátku.', en: 'The end must be after the start.' },
  'terminyVyber.chybaVlastni': {
    cs: 'Vlastní čas se nepodařilo uložit.',
    en: 'Your own time could not be saved.',
  },
  'terminyVyber.chybaOdeslani': {
    cs: 'Výběr se nepodařilo odeslat.',
    en: 'The selection could not be sent.',
  },
  'terminyVyber.poznamkaProProdukci': {
    cs: 'Poznámka pro produkci (nepovinné)',
    en: 'Note for production (optional)',
  },

  // --- chybové a načítací stránky (dávka 2) ---------------------------------
  'chyba.nadpisPortal': { cs: 'Portál teď nenaběhl', en: 'The portal did not start' },
  'chyba.nadpisStranka': {
    cs: 'Tuhle stránku se nepodařilo načíst',
    en: 'This page could not be loaded',
  },
  'chyba.text': {
    cs: 'Nejčastěji to znamená, že databáze má zrovna plno a za chvíli bude zase volná. Data jsou v pořádku, nic se neztratilo.',
    en: 'Most often this means the database is busy just now and will be free again shortly. Your data is fine, nothing has been lost.',
  },
  'chyba.zkousim': { cs: 'Zkouším…', en: 'Trying…' },
  'chyba.zkusitZnovu': { cs: 'Zkusit znovu ({s} s)', en: 'Try again ({s} s)' },
  'chyba.cislo': {
    cs: 'Pokud to nepomůže ani po pár minutách, dejte vědět — s tímhle číslem se chyba najde v logu:',
    en: 'If it does not help after a few minutes, let us know — this number finds the error in the log:',
  },
  'chyba.bezCisla': { cs: 'bez čísla', en: 'no number' },
  'nacitani.popis': { cs: 'Načítám', en: 'Loading' },

  // --- typ přístupu (role) - ukazuje se v Mém účtu (dávka 2) ----------------
  'role.CLIENT': { cs: 'Klient', en: 'Customer' },
  'role.HEREC': { cs: 'Herec', en: 'Narrator' },
  // Žůžo-labůžo je náš vtip, anglicky prostě Admin (viz slovníček v
  // docs/preklad-portalu.md).
  'role.ADMIN': { cs: 'Žůžo-labůžo', en: 'Admin' },
  'role.ZVUKAR': { cs: 'Zvukař', en: 'Sound engineer' },
  'role.PRODUKCE': { cs: 'Produkce', en: 'Production' },
  'role.ROBOT': { cs: 'Robot', en: 'Robot' },
  'role.TABULE': { cs: 'Tabule ve studiu', en: 'Studio display' },
  'role.BOOKING': { cs: 'Klient studia (rezervace)', en: 'Studio customer (bookings)' },

  // --- chat (dávka 3) ---
  'chat.odesilam': { cs: 'Odesílám…', en: 'Sending…' },
  'chat.neodeslo': {
    cs: 'Neodešlo — text máte zpátky v psátku',
    en: 'Not sent — your text is back in the message box',
  },
  'chat.odeslano': { cs: 'Odesláno', en: 'Sent' },
  'chat.zobrazenoKomu': { cs: 'Zobrazeno: {jmena}', en: 'Seen by: {jmena}' },
  'chat.zobrazenoJmena': { cs: 'Zobrazeno · {jmena}', en: 'Seen · {jmena}' },
  'chat.zobrazenoPocet': { cs: 'Zobrazeno · {pocet} lidem', en: 'Seen · {pocet} people' },
  'chat.upraveno': { cs: 'upraveno', en: 'edited' },
  'chat.upravenoKdy': { cs: 'Upraveno {kdy}', en: 'Edited {kdy}' },

  // psátko
  'chat.poslat': { cs: 'Poslat', en: 'Send' },
  'chat.bezneSmajliky': { cs: 'Běžné', en: 'Standard' },
  'chat.odebratPrilohu': { cs: 'Odebrat {nazev}', en: 'Remove {nazev}' },
  'chat.pripojitSoubor': { cs: 'Připojit soubor', en: 'Attach a file' },
  'chat.smajlici': { cs: 'Smajlíci', en: 'Emoji' },
  'chat.enterOdesle': {
    cs: 'Enter odešle, Shift+Enter zalomí řádek',
    en: 'Enter sends, Shift+Enter starts a new line',
  },

  // reakce
  'chat.reakceKdo': { cs: '{pocet}× reakce: {jmena}', en: '{pocet}× reaction: {jmena}' },
  'chat.kopirovat': { cs: 'Kopírovat', en: 'Copy' },
  // Výběr části textu v bublině (připomínka Petera Dratvy 7. 10. 2026).
  'chat.vybratText': { cs: 'Vybrat text', en: 'Select text' },

  // přílohy
  'chat.stahnoutPrilohu': { cs: 'Stáhnout {nazev}', en: 'Download {nazev}' },
  'chat.prehratPrilohu': { cs: 'Přehrát {nazev}', en: 'Play {nazev}' },
  'chat.zmensit': { cs: 'Zmenšit', en: 'Zoom out' },
  'chat.zmensitKlavesa': { cs: 'Zmenšit (−)', en: 'Zoom out (−)' },
  'chat.zvetsit': { cs: 'Zvětšit', en: 'Zoom in' },
  'chat.zvetsitKlavesa': { cs: 'Zvětšit (+)', en: 'Zoom in (+)' },
  'chat.celyObrazek': { cs: 'Celý obrázek (0)', en: 'Whole image (0)' },
  'chat.predchozi': { cs: 'Předchozí', en: 'Previous' },
  'chat.predchoziObrazek': { cs: 'Předchozí obrázek', en: 'Previous image' },
  'chat.dalsi': { cs: 'Další', en: 'Next' },
  'chat.dalsiObrazek': { cs: 'Další obrázek', en: 'Next image' },
  'chat.pustteSouborSem': { cs: 'Pusťte soubor sem', en: 'Drop the file here' },

  // chyby a hlášky
  'chat.smazatNepodarilo': {
    cs: 'Zprávu se nepodařilo smazat.',
    en: 'The message could not be deleted.',
  },
  'chat.upravitNepodarilo': {
    cs: 'Zprávu se nepodařilo upravit.',
    en: 'The message could not be edited.',
  },
  'chat.zpravaNeodeslana': {
    cs: 'Zprávu se nepodařilo odeslat.',
    en: 'The message could not be sent.',
  },
  'chat.ulozeniNezdarilo': { cs: 'Uložení se nezdařilo.', en: 'Saving failed.' },
  'chat.odchodNezdaril': { cs: 'Odchod se nezdařil.', en: 'Leaving the group failed.' },
  'chat.otevritNepodarilo': { cs: 'Nepodařilo se to otevřít.', en: 'It could not be opened.' },
  'chat.prilohaVelka': {
    cs: 'Příloha {nazev} je moc velká (nejvýš {limit}).',
    en: 'The attachment {nazev} is too large (at most {limit}).',
  },
  'chat.prilohaNepripravena': {
    cs: 'Přílohu se nepodařilo připravit.',
    en: 'The attachment could not be prepared.',
  },
  'chat.prilohaOdmitnuta': {
    cs: 'Přílohu {nazev} se nepodařilo nahrát - úložiště odmítlo požadavek z portálu. Zkuste to prosím znovu; když to nepůjde, dejte vědět správci portálu.',
    en: 'The attachment {nazev} could not be uploaded — the storage refused the request from the portal. Please try again; if it still will not go, let the portal administrator know.',
  },
  'chat.prilohaNahraniSelhalo': {
    cs: 'Přílohu {nazev} se nepodařilo nahrát ({stav}).',
    en: 'The attachment {nazev} could not be uploaded ({stav}).',
  },
  'chat.ukolVListu': {
    cs: 'Úkol je v to-do listu — {komu}.',
    en: 'The task is in the to-do list — {komu}.',
  },
  'chat.poradiNeulozeno': {
    cs: 'Nové pořadí se nepodařilo uložit.',
    en: 'The new order could not be saved.',
  },
  'chat.pripnutiNeulozeno': {
    cs: 'Připnutí se nepodařilo uložit.',
    en: 'The pin could not be saved.',
  },
  'chat.odepnutiNeulozeno': {
    cs: 'Odepnutí se nepodařilo uložit.',
    en: 'Unpinning could not be saved.',
  },
  'chat.upozorneniNeulozeno': {
    cs: 'Nastavení upozornění se nepodařilo uložit.',
    en: 'The notification setting could not be saved.',
  },
  'chat.ztlumeniNeulozeno': {
    cs: 'Ztlumení se nepodařilo uložit.',
    en: 'The mute could not be saved.',
  },
  'chat.serverOdmitl': { cs: 'Server odmítl ({stav}).', en: 'The server refused the request ({stav}).' },
  'chat.odklizeniNepodarilo': {
    cs: 'Nepodařilo se to odklidit.',
    en: 'It could not be tidied away.',
  },
  'chat.opustitSkupinuOtazka': {
    cs: 'Opustit skupinu „{nazev}"? Zprávy v ní vám zmizí.',
    en: 'Leave the group “{nazev}”? Its messages will disappear for you.',
  },

  // seznam konverzací a záložky
  'chat.zalozkaNeprectene': { cs: '{nazev} — {pocet} nepřečtených', en: '{nazev} — {pocet} unread' },
  'chat.skrytChat': { cs: 'Skrýt MS chat', en: 'Hide MS chat' },
  'chat.nacitamProjekty': { cs: 'Načítám projekty…', en: 'Loading the projects…' },
  'chat.zadneProjekty': { cs: 'Žádné rozpracované projekty.', en: 'No projects in progress.' },
  'chat.dotazyKlientu': { cs: 'Dotazy klientů', en: 'Customer questions' },
  'chat.zadneSoukrome': {
    cs: 'Zatím si s nikým nepíšete.',
    en: 'You are not messaging anyone yet.',
  },
  'chat.zadneSkupiny': { cs: 'Zatím tu není žádná skupina.', en: 'There are no groups yet.' },
  'chat.opustit': { cs: 'Opustit', en: 'Leave' },
  'chat.uklidit': { cs: 'Uklidit', en: 'Tidy away' },
  'chat.nikdoDalsi': { cs: 'Nikdo další tu zatím není.', en: 'There is nobody else here yet.' },
  'chat.nazevSkupiny': { cs: 'Název skupiny', en: 'Group name' },
  'chat.zalozitSkupinu': { cs: 'Založit skupinu', en: 'Create the group' },
  'chat.napsatNekomu': { cs: '+ Napsat někomu', en: '+ Message someone' },
  'chat.novaSkupina': { cs: '+ Nová skupina', en: '+ New group' },
  'chat.nova': { cs: 'Nová', en: 'New' },
  'chat.vyberteVlevo': {
    cs: 'Vyberte vlevo projekt nebo člověka.',
    en: 'Choose a project or a person on the left.',
  },

  // hlavička rozhovoru
  'chat.zpetNaSeznam': { cs: 'Zpět na seznam', en: 'Back to the list' },
  'chat.otevritProjekt': { cs: 'Otevřít projekt', en: 'Open the project' },
  'chat.vidiJen': { cs: 'Vidí jen: já{ostatni}', en: 'Visible only to: me{ostatni}' },
  'chat.kdoVidiUprava': {
    cs: 'Kdo do skupiny vidí — a úprava',
    en: 'Who can see the group — and editing',
  },
  'chat.kdoVidiPocet': {
    cs: 'Kdo do skupiny vidí ({pocet})',
    en: 'Who can see the group ({pocet})',
  },
  'chat.pripnutoOdepnete': {
    cs: 'Připnuto nahoře — klepnutím odepnete',
    en: 'Pinned at the top — tap to unpin',
  },
  'chat.pripnoutRychlaVolba': {
    cs: 'Připnout nahoru jako rychlou volbu',
    en: 'Pin to the top as a quick choice',
  },
  'chat.odepnout': { cs: 'Odepnout', en: 'Unpin' },
  'chat.pripnoutNahoru': { cs: 'Připnout nahoru', en: 'Pin to the top' },
  'chat.ztlumenoZrusite': {
    cs: 'Ztlumeno — upozornění odsud nechodí. Klepnutím zrušíte.',
    en: 'Muted — no notifications come from here. Tap to unmute.',
  },
  'chat.ztlumitPopis': {
    cs: 'Ztlumit — zprávy chodí dál, jen nezazvoní',
    en: 'Mute — messages keep coming, they just will not ring',
  },
  'chat.zrusitZtlumeni': { cs: 'Zrušit ztlumení', en: 'Unmute' },
  'chat.ztlumitRozhovor': { cs: 'Ztlumit rozhovor', en: 'Mute the conversation' },

  // správa skupiny
  'chat.kdoDoSkupinyVidi': { cs: 'Kdo do skupiny vidí', en: 'Who can see the group' },
  'chat.novyClenUvidiHistorii': {
    cs: 'Kdo se do skupiny dostane, uvidí i to, co se v ní psalo dřív.',
    en: 'Anyone who joins the group will also see what was written in it earlier.',
  },
  'chat.odejitZeSkupiny': { cs: 'Odejít ze skupiny', en: 'Leave the group' },
  'chat.opravduOdejit': { cs: 'Opravdu odejít?', en: 'Leave it?' },

  // výpis zpráv a vlákno
  'chat.nacitamZpravy': { cs: 'Načítám zprávy…', en: 'Loading the messages…' },
  'chat.nikdoNicNenapsal': {
    cs: 'Zatím tu nikdo nic nenapsal.',
    en: 'Nobody has written anything here yet.',
  },
  'chat.ja': { cs: 'Já', en: 'Me' },
  'chat.upravitZpravu': { cs: 'Upravit zprávu…', en: 'Edit the message…' },
  'chat.odpovediJedna': { cs: '1 odpověď ›', en: '1 reply ›' },
  'chat.odpovediMalo': { cs: '{pocet} odpovědi ›', en: '{pocet} replies ›' },
  'chat.odpovediMnoho': { cs: '{pocet} odpovědí ›', en: '{pocet} replies ›' },
  'chat.odpovedet': { cs: 'Odpovědět', en: 'Reply' },
  'chat.napsatZpravu': {
    cs: 'Napište zprávu… (@ zmíní kolegu nebo zadá úkol, # odkáže na projekt)',
    en: 'Write a message… (@ mentions a colleague or sets a task, # links to a project)',
  },
  'chat.vlakno': { cs: 'Vlákno', en: 'Thread' },
  'chat.zavritVlakno': { cs: 'Zavřít vlákno', en: 'Close the thread' },
  'chat.bezOdpovedi': { cs: 'Zatím bez odpovědí.', en: 'No replies yet.' },
  'chat.odpovedetPlaceholder': { cs: 'Odpovědět…', en: 'Reply…' },
  'chat.mazu': { cs: 'Mažu…', en: 'Deleting…' },
  'chat.opravduSmazat': { cs: 'Opravdu smazat?', en: 'Delete it?' },

  // lišta úkolu nad psátkem
  'chat.ukol': { cs: 'Úkol', en: 'Task' },
  'chat.ukolProSNazvem': { cs: 'pro {prijemce}: {nazev}', en: 'for {prijemce}: {nazev}' },
  'chat.ukolProBezNazvu': {
    cs: 'pro {prijemce} — napište, co je potřeba udělat',
    en: 'for {prijemce} — write what needs doing',
  },
  'chat.ukolDo': { cs: 'do', en: 'by' },
  'chat.doKolikaHodin': { cs: 'Do kolika hodin (nepovinné)', en: 'By what time (optional)' },
  'chat.cas': { cs: 'Čas', en: 'Time' },
  'chat.bezTerminu': { cs: 'bez termínu', en: 'no deadline' },

  // úkoly v záložce chatu
  'chat.coJePotreba': { cs: 'Co je potřeba udělat?', en: 'What needs doing?' },
  'chat.nejdrivDatum': { cs: 'Nejdřív vyberte datum', en: 'Choose a date first' },
  'chat.pridat': { cs: 'Přidat', en: 'Add' },
  'chat.nacitamUkoly': { cs: 'Načítám úkoly…', en: 'Loading the tasks…' },
  'chat.nicNeceka': { cs: 'Nic nečeká. 🎉', en: 'Nothing waiting. 🎉' },
  'chat.skrytHotove': { cs: 'Skrýt hotové', en: 'Hide the completed ones' },
  'chat.hotovePocet': { cs: 'Hotové ({pocet})', en: 'Completed ({pocet})' },
  'chat.upravitUkol': { cs: 'Upravit úkol', en: 'Edit the task' },
  'chat.odZadal': { cs: 'od {jmeno}', en: 'from {jmeno}' },

  // kdo právě píše
  'chat.pisouJeden': { cs: '{jmeno} píše…', en: '{jmeno} is typing…' },
  'chat.pisouDva': { cs: '{jmeno} a {druhy} píšou…', en: '{jmeno} and {druhy} are typing…' },
  'chat.pisouVic': { cs: '{pocet} lidí píše…', en: '{pocet} people are typing…' },

  // --- úkoly, dotazy a doky (dávka 3) ---
  'ukoly.skrytUkoly': { cs: 'Skrýt úkoly', en: 'Hide tasks' },
  'ukoly.chybaUlozit': { cs: 'Nepodařilo se uložit.', en: 'Saving failed.' },
  'ukoly.novyUkol': { cs: 'Nový úkol…', en: 'New task…' },
  'ukoly.terminNepovinne': { cs: 'Termín (nepovinné)', en: 'Due date (optional)' },
  'ukoly.doKolikaHodin': { cs: 'Do kolika hodin (nepovinné)', en: 'Due time (optional)' },
  'ukoly.nejdrivDatum': { cs: 'Nejdřív vyberte datum', en: 'Choose a date first' },
  // Popisek pod políčkem s datem (28. 9. 2026) - datum je předvyplněné na dnešek.
  'ukoly.terminDnes': { cs: 'Termín: dnes', en: 'Due: today' },
  'ukoly.terminZitra': { cs: 'Termín: zítra', en: 'Due: tomorrow' },
  'ukoly.terminDatum': { cs: 'Termín: {datum}', en: 'Due: {datum}' },
  'ukoly.terminZadny': { cs: 'Bez termínu', en: 'No due date' },
  'ukoly.pridat': { cs: 'Přidat', en: 'Add' },
  'ukoly.zadneOtevrene': { cs: 'Žádné otevřené úkoly. 👌', en: 'No open tasks. 👌' },
  'ukoly.odKoho': { cs: 'od {jmeno}', en: 'from {jmeno}' },
  'ukoly.poTerminuTermin': { cs: 'Po termínu — {termin}', en: 'Overdue — {termin}' },
  'ukoly.doTerminu': { cs: 'Do {termin}', en: 'Due {termin}' },
  'ukoly.upravitUkol': { cs: 'Upravit úkol', en: 'Edit the task' },
  'ukoly.opravduSmazat': { cs: 'Opravdu smazat?', en: 'Delete it?' },
  'ukoly.smazatUkol': { cs: 'Smazat úkol', en: 'Delete the task' },
  'ukoly.skrytHotove': { cs: 'Skrýt hotové', en: 'Hide completed' },
  'ukoly.hotovePocet': { cs: 'Hotové ({pocet})', en: 'Completed ({pocet})' },
  'ukoly.nazevUkolu': { cs: 'Název úkolu', en: 'Task name' },
  'ukoly.termin': { cs: 'Termín', en: 'Due date' },
  'ukoly.cas': { cs: 'Čas', en: 'Time' },

  // „Zadal jsem" - úkoly, které jsem z chatu dal někomu jinému
  'ukoly.zadane.nadpis': { cs: 'Zadal jsem', en: 'Assigned by me' },
  'ukoly.zadane.nadpisCeka': {
    cs: 'Zadal jsem · čeká {pocet}',
    en: 'Assigned by me · {pocet} pending',
  },
  'ukoly.zadane.pro': { cs: 'pro {komu}', en: 'for {komu}' },
  'ukoly.zadane.splneno': { cs: 'splněno', en: 'completed' },
  'ukoly.zadane.splnenoDne': { cs: 'splněno {datum}', en: 'completed {datum}' },
  'ukoly.zadane.ceka': { cs: 'čeká', en: 'pending' },
  'ukoly.zadane.doTerminu': { cs: 'do {termin}', en: 'due {termin}' },
  'ukoly.zadane.poTerminuDo': { cs: 'po termínu, do {termin}', en: 'overdue, due {termin}' },
  'ukoly.zadane.otevritKonverzaci': {
    cs: 'Otevřít konverzaci, ze které úkol vznikl',
    en: 'Open the conversation the task came from',
  },
  'ukoly.zadane.vsechnoHotove': {
    cs: 'Všechno, co jste zadali, je hotové.',
    en: 'Everything you have assigned is done.',
  },
  'ukoly.zadane.skrytSplnene': { cs: 'Skrýt splněné', en: 'Hide completed' },
  'ukoly.zadane.splnenePocet': { cs: 'Splněné ({pocet})', en: 'Completed ({pocet})' },
  'ukoly.zadane.ukolPro': { cs: 'Úkol pro {komu}', en: 'Task for {komu}' },
  'ukoly.zadane.opravduZrusit': { cs: 'Opravdu zrušit?', en: 'Cancel it?' },
  'ukoly.zadane.zrusitUkol': { cs: 'Zrušit úkol', en: 'Cancel the task' },

  // --- dotazy klienta k projektům (dávka 3) ---
  'dotazy.nadpis': { cs: 'Dotazy k projektům', en: 'Project questions' },
  'dotazy.poutko': { cs: 'Dotazy', en: 'Questions' },
  'dotazy.skrytDotazy': { cs: 'Skrýt dotazy', en: 'Hide the questions' },
  'dotazy.pracovniDoba': {
    cs: 'Odpovídáme v pracovní době',
    en: 'We reply during business hours',
  },
  'dotazy.vaseProjekty': { cs: 'Vaše projekty', en: 'Your projects' },
  'dotazy.zadnyProjekt': {
    cs: 'Zatím tu nemáte žádný rozpracovaný projekt.',
    en: 'You have no projects in progress yet.',
  },
  'dotazy.uzavreno': { cs: 'Uzavřeno', en: 'Closed' },
  'dotazy.naposledy': { cs: 'Naposledy {kdy}', en: 'Last {kdy}' },
  'dotazy.rozepsano': { cs: 'Rozepsáno', en: 'Started' },
  'dotazy.bezDotazu': { cs: 'Zatím bez dotazu', en: 'No questions yet' },
  'dotazy.vyberteProjekt': {
    cs: 'Vyberte vlevo projekt. Co sem napíšete, dorazí rovnou lidem, kteří na něm dělají.',
    en: 'Choose a project on the left. Whatever you write here goes straight to the people working on it.',
  },
  'dotazy.zpetNaSeznam': { cs: 'Zpět na seznam', en: 'Back to the list' },
  'dotazy.prazdnyRozhovor': {
    cs: 'Na co se potřebujete zeptat? Napište to sem — držíme to u projektu, takže se to neztratí v mailu.',
    en: 'What do you need to ask? Write it here — we keep it with the project, so it will not get lost in email.',
  },
  'dotazy.ja': { cs: 'Já', en: 'Me' },
  'dotazy.projektUzavren': {
    cs: 'Projekt je uzavřený, takže sem už psát nejde. Historie zůstává.',
    en: 'The project is closed, so you can no longer write here. The history stays.',
  },
  'dotazy.napisteDotaz': {
    cs: 'Napište dotaz… (Enter odešle, Shift+Enter nový řádek)',
    en: 'Write your question… (Enter sends, Shift+Enter for a new line)',
  },
  'dotazy.odesilam': { cs: 'Odesílám…', en: 'Sending…' },
  'dotazy.poslat': { cs: 'Poslat', en: 'Send' },
  // Přílohy v dotazech klienta (30. 9. 2026).
  'dotazy.pripojitSoubor': { cs: 'Přiložit PDF nebo obrázek', en: 'Attach a PDF or an image' },
  'dotazy.soubor': { cs: 'Soubor', en: 'File' },
  'dotazy.odebratPrilohu': { cs: 'Odebrat přílohu', en: 'Remove the attachment' },
  'dotazy.prilohaFormat': { cs: 'jde jen PDF a obrázky', en: 'PDFs and images only' },
  'dotazy.prilohaVelka': { cs: 'nejvýš 15 MB', en: '15 MB at most' },
  'dotazy.chybaPriloha': {
    cs: 'Soubor se nepodařilo nahrát. Zkuste to prosím znovu.',
    en: 'The file could not be uploaded. Please try again.',
  },
  'dotazy.chybaOdeslat': {
    cs: 'Dotaz se nepodařilo odeslat.',
    en: 'The question could not be sent.',
  },

  // --- upozornění v chatu (dávka 3) ---
  'upozorneniChatu.nastaveni': { cs: 'Nastavení upozornění', en: 'Notification settings' },
  'upozorneniChatu.vTomhleProhlizeci': { cs: 'V tomhle prohlížeči', en: 'In this browser' },
  'upozorneniChatu.neumi': {
    cs: 'Tenhle prohlížeč upozornění neumí. Nastavení níž platí i tak — projeví se tam, kde upozornění zapnutá máte.',
    en: 'This browser cannot do notifications. The settings below still apply — they take effect wherever you do have notifications switched on.',
  },
  'upozorneniChatu.zakazano': {
    cs: 'Upozornění máte zakázaná v nastavení prohlížeče — povolit se dají jen tam.',
    en: 'You have notifications blocked in your browser settings — they can only be allowed there.',
  },
  'upozorneniChatu.jenVAplikaci': {
    cs: 'Na iPhonu chodí upozornění jen aplikaci přidané na plochu. Přidejte si MS Chat na plochu a zapněte je tam.',
    en: 'On an iPhone, notifications only reach an app added to the home screen. Add MS Chat to your home screen and switch them on there.',
  },
  'upozorneniChatu.moment': { cs: 'Moment…', en: 'One moment…' },
  'upozorneniChatu.vypnout': { cs: 'Vypnout upozornění', en: 'Switch notifications off' },
  'upozorneniChatu.zapnout': { cs: 'Zapnout upozornění', en: 'Switch notifications on' },
  'upozorneniChatu.kdyUpozornovat': { cs: 'Kdy upozorňovat', en: 'When to notify you' },
  'upozorneniChatu.soukromeZpravy': { cs: 'Soukromé zprávy', en: 'Private messages' },
  'upozorneniChatu.skupiny': { cs: 'Skupiny', en: 'Groups' },
  'upozorneniChatu.kanalyProjektu': { cs: 'Kanály projektů', en: 'Project channels' },
  'upozorneniChatu.jednotliveSkupiny': { cs: 'Jednotlivé skupiny', en: 'Individual groups' },
  'upozorneniChatu.podleSkupin': { cs: 'Podle skupin', en: 'As for groups' },
  'upozorneniChatu.rezim.vse': { cs: 'Vše', en: 'Everything' },
  'upozorneniChatu.rezim.zminky': { cs: 'Jen zmínky', en: 'Mentions only' },
  'upozorneniChatu.rezim.nic': { cs: 'Nic', en: 'Nothing' },
  'upozorneniChatu.nocniKlid': { cs: 'Noční klid', en: 'Quiet hours' },
  'upozorneniChatu.zapnoutKlid': { cs: 'Zapnout', en: 'Switch on' },
  'upozorneniChatu.vypnoutKlid': { cs: 'Vypnout', en: 'Switch off' },
  'upozorneniChatu.nechodiNic': { cs: 'nechodí nic', en: 'nothing comes through' },
  'upozorneniChatu.platiVsude': {
    cs: 'Platí pro všechna vaše zařízení. Zprávy chodí dál a počítají se jako nepřečtené — jen nezazvoní. Jednotlivý kanál projektu se dá ztlumit u něj samotného.',
    en: 'Applies to all your devices. Messages still arrive and count as unread — they just do not ring. An individual project channel can be muted on the channel itself.',
  },

  // --- rychlé volby v levém panelu (dávka 3) ---
  'rychleVolby.nadpis': { cs: 'Rychlé volby', en: 'Quick actions' },
  'rychleVolby.zobrazit': { cs: 'Zobrazit rychlé volby', en: 'Show the quick actions' },
  'rychleVolby.skryt': { cs: 'Skrýt rychlé volby', en: 'Hide the quick actions' },
  'rychleVolby.upravit': { cs: 'Upravit rychlé volby', en: 'Edit the quick actions' },
  'rychleVolby.hotovo': { cs: 'Hotovo', en: 'Done' },
  'rychleVolby.nicTuNeni': {
    cs: 'Zatím tu nic není. Přidejte si zkratku přes tři tečky.',
    en: 'Nothing here yet. Add a shortcut with the three dots.',
  },
  'rychleVolby.pretazenim': { cs: 'Přetažením změníte pořadí', en: 'Drag to change the order' },
  'rychleVolby.odebrat': { cs: 'Odebrat {nazev}', en: 'Remove {nazev}' },
  'rychleVolby.vsechnoPridano': {
    cs: 'Máte tu všechno, co jde přidat.',
    en: 'You already have everything that can be added.',
  },
  'rychleVolby.pridat': { cs: 'Přidat', en: 'Add' },
  'rychleVolby.chybaUlozit': { cs: 'Uložení se nezdařilo.', en: 'Saving failed.' },

  // --- pravý panel: záložky, poutko, nepřečtené (dávka 3) ---
  'dok.zalozkaUkoly': { cs: 'Úkoly', en: 'Tasks' },
  'dok.skrytPanel': { cs: 'Skrýt panel', en: 'Hide the panel' },
  'dok.zobrazitChatAUkoly': {
    cs: 'Zobrazit MS chat a úkoly',
    en: 'Show MS chat and tasks',
  },
  'dok.poTerminu': { cs: '{pocet} po termínu', en: '{pocet} overdue' },
  'dok.neprectenePocet': {
    cs: '{nazev} — {pocet} nepřečtených',
    en: '{nazev} — {pocet} unread',
  },
  'dok.neprecteneAria': {
    cs: '{nazev}: {pocet} nepřečtených zpráv',
    en: '{nazev}: {pocet} unread messages',
  },
  'dok.aDalsi': { cs: 'a další {pocet}', en: '{pocet} more' },

  // --- lišta, panely a tabulky (dávka 3) ---
  'listou.upravitListu': { cs: 'Upravit lištu', en: 'Edit the bar' },
  'listou.pretazenim': { cs: 'Přetažením změníte pořadí', en: 'Drag to change the order' },
  'listou.odebratOdkaz': { cs: 'Odebrat {nazev}', en: 'Remove {nazev}' },
  'listou.tecka': {
    cs: 'Něco se tu pere — podrobnosti uvnitř',
    en: 'Something clashes here — the details are inside',
  },
  'listou.upozorneni': { cs: 'Upozornění', en: 'Alert' },
  'listou.upravujeteListu': {
    cs: 'Upravujete lištu pro {zarizeni} · křížkem odebrat, tažením přesunout',
    en: 'You are editing the bar for {zarizeni} · the cross removes, dragging moves',
  },
  'listou.zarizeni.POCITAC': { cs: 'počítač', en: 'computer' },
  'listou.zarizeni.MOBIL': { cs: 'mobil', en: 'mobile' },
  'listou.pridatStranku': { cs: 'Přidat stránku', en: 'Add page' },
  'listou.vychozi': { cs: 'Výchozí', en: 'Default' },
  'listou.vychoziPopis': {
    cs: 'Vrátit lištu do původní podoby',
    en: 'Restore the bar to how it was',
  },
  'listou.chybaObnoveni': { cs: 'Obnovení se nezdařilo.', en: 'The restore failed.' },
  'listou.chybaUlozeni': { cs: 'Uložení se nezdařilo.', en: 'Saving failed.' },
  'listou.dalsiVolby': { cs: 'Jazyk, připomínky, režim', en: 'Language, feedback, mode' },
  'listou.rezimSvetly': { cs: 'Přepnout na světlý režim', en: 'Switch to light mode' },
  'listou.rezimTmavy': { cs: 'Přepnout na tmavý režim', en: 'Switch to dark mode' },

  // rozdělené okno (22. 9. 2026) - tlačítko v liště a pruh nad pravou půlkou
  'listou.rozdelitOkno': {
    cs: 'Rozdělit okno - vpravo druhá stránka portálu',
    en: 'Split the window — a second portal page on the right',
  },
  'listou.rozdelitOknoKratce': { cs: 'Rozdělit okno', en: 'Split the window' },
  'listou.rozdeleniSirka': { cs: 'Táhnutím změníte šířku', en: 'Drag to change the width' },
  'listou.rozdeleniOtevritVlevo': { cs: 'Otevřít vlevo', en: 'Open on the left' },
  'listou.rozdeleniOtevritVlevoPopis': {
    cs: 'Otevřít vlevo místo téhle stránky',
    en: 'Open on the left instead of this page',
  },
  'listou.rozdeleniZavrit': { cs: 'Zavřít rozdělení', en: 'Close the split' },
  'listou.rozdeleniRamec': { cs: 'Druhá půlka portálu', en: 'The second half of the portal' },
  'listou.rozdeleni.projekty': { cs: 'Projekty', en: 'Projects' },
  'listou.rozdeleni.nabidky': { cs: 'Nabídky', en: 'Quotes' },
  'listou.rozdeleni.faktury': { cs: 'Faktury', en: 'Invoices' },
  'listou.rozdeleni.kalendar': { cs: 'Kalendář', en: 'Calendar' },
  'listou.rozdeleni.vykazy': { cs: 'Výkazy', en: 'Timesheets' },

  // --- obecné, doplněno v dávce 3 ---
  'obecne.zkopirovano': { cs: 'Zkopírováno', en: 'Copied' },
  'obecne.kopirovatOdkaz': { cs: 'Zkopírovat odkaz', en: 'Copy the link' },
  'obecne.zkopirujteOdkaz': { cs: 'Zkopírujte odkaz:', en: 'Copy the link:' },

  // --- připomínka k portálu (dávka 3) ---
  'zpetnaVazba.nadpis': { cs: 'Připomínka k portálu', en: 'Portal feedback' },
  'zpetnaVazba.nadpisSeznam': { cs: 'Připomínky k portálu', en: 'Portal feedback' },
  'zpetnaVazba.popisSeznam': {
    cs: 'Co lidem v portálu vadí. Odškrtnutá položka jim zmizí.',
    en: 'What people find wrong with the portal. An item ticked off disappears for them.',
  },
  'zpetnaVazba.popisOndrejovi': {
    cs: 'Co nefunguje, co chybí, co by šlo líp. Jde to rovnou Ondřejovi.',
    en: 'What does not work, what is missing, what could be better. It goes straight to Ondřej.',
  },
  'zpetnaVazba.popisNam': {
    cs: 'Co nefunguje, co chybí, co by šlo líp. Jde to rovnou nám.',
    en: 'What does not work, what is missing, what could be better. It comes straight to us.',
  },
  'zpetnaVazba.nicNeceka': {
    cs: 'Nic nečeká. Lidem se portál zatím líbí.',
    en: 'Nothing is waiting. People like the portal so far.',
  },
  'zpetnaVazba.odskrtnout': { cs: 'Odškrtnout', en: 'Tick off' },
  'zpetnaVazba.hlasiToteze': { cs: '+{pocet} hlásí totéž', en: '+{pocet} report the same' },
  'zpetnaVazba.napsat': { cs: '+ Napsat připomínku', en: '+ Write feedback' },
  'zpetnaVazba.celySeznam': { cs: 'Celý seznam v Mém účtu', en: 'The full list in My account' },
  'zpetnaVazba.diky': {
    cs: 'Díky! Připomínka je v seznamu.',
    en: 'Thank you. Your feedback is on the list.',
  },
  'zpetnaVazba.placeholder': {
    cs: 'Např. „Ve výkazech nejde vybrat projekt, když má dlouhý název.“ Printscreen můžete vložit rovnou přes Ctrl+V.',
    en: 'For example: „In Timesheets I cannot pick a project when its name is long.“ You can paste a screenshot straight in with Ctrl+V.',
  },
  'zpetnaVazba.jizHlaseno': { cs: 'Tohle už někdo hlásil:', en: 'Someone has reported this already:' },
  'zpetnaVazba.shoda': {
    cs: '{autor} · shoda {shoda} % — zaškrtnutím se připojíte k téhle',
    en: '{autor} · {shoda} % match — tick it to join this one',
  },
  'zpetnaVazba.odebratObrazek': { cs: 'Odebrat obrázek', en: 'Remove image' },
  'zpetnaVazba.printscreen': { cs: '+ Printscreen', en: '+ Screenshot' },
  'zpetnaVazba.odesilam': { cs: 'Odesílám…', en: 'Sending…' },
  'zpetnaVazba.pripojitSe': { cs: 'Připojit se', en: 'Join' },
  'zpetnaVazba.odeslat': { cs: 'Odeslat', en: 'Send' },
  'zpetnaVazba.napisteCo': {
    cs: 'Napište prosím, co se má opravit.',
    en: 'Please write what needs fixing.',
  },
  'zpetnaVazba.chybaUlozeni': {
    cs: 'Připomínku se nepodařilo uložit.',
    en: 'Your feedback could not be saved.',
  },

  // --- přehled dne (dávka 3) ---
  'prehledDne.nadpis': { cs: 'Přehled dne', en: 'The day at a glance' },
  'prehledDne.druh.NATACENI': { cs: 'Natáčení', en: 'Recording' },
  'prehledDne.druh.STRIH': { cs: 'Střih', en: 'Editing' },
  'prehledDne.druh.CASTING': { cs: 'Casting', en: 'Casting' },
  'prehledDne.druh.PORADA': { cs: 'Porada', en: 'Meeting' },
  'prehledDne.druh.SCHUZKA': { cs: 'Schůzka', en: 'Appointment' },
  'prehledDne.druh.JINE': { cs: 'Blokace', en: 'Block' },
  'prehledDne.rezieNaDalku': { cs: 'režie na dálku', en: 'remote directing' },
  'prehledDne.vseZaSebou': {
    cs: 'Dnešek už máte za sebou — v kalendáři vás dnes nic dalšího nečeká.',
    en: 'Your day is behind you — nothing else is waiting for you in the calendar today.',
  },
  'prehledDne.nicVKalendari': {
    cs: 'V kalendáři dnes nic vašeho nemám.',
    en: 'I have nothing of yours in the calendar today.',
  },
  'prehledDne.ukolyNaDnesek': { cs: 'Úkoly na dnešek', en: 'Tasks for today' },
  'prehledDne.ok': { cs: 'OK', en: 'OK' },
  'prehledDne.prvniFrekvence': {
    cs: 'První frekvence · o čem to je',
    en: 'First recording session · what it is about',
  },
  'prehledDne.precist': { cs: 'Přečíst', en: 'Read' },
  'prehledDne.brunoCte': { cs: 'Bruno čte rukopis…', en: 'Bruno is reading the manuscript…' },
  'prehledDne.hledamText': { cs: 'hledám text…', en: 'looking for the text…' },

  // --- můj status v chatu (dávka 3) ---
  'status.nastavit': { cs: 'Nastavit status', en: 'Set your status' },
  'status.nastavitVyzva': { cs: 'Nastavit status…', en: 'Set your status…' },
  'status.zKalendare': { cs: 'z kalendáře', en: 'from the calendar' },
  'status.zKalendarePopis': {
    cs: 'Teď o vás svítí {status} z kalendáře. Vlastní status ho přebije, dokud platí.',
    en: 'Right now {status} from the calendar is showing about you. Your own status overrides it while it lasts.',
  },
  'status.emoji': { cs: 'Emoji', en: 'Emoji' },
  'status.coDelate': { cs: 'Co teď děláte?', en: 'What are you doing now?' },
  'status.stitek': { cs: 'Status', en: 'Status' },
  'status.plati': { cs: 'Platí', en: 'Valid for' },
  'status.nastavitTlacitko': { cs: 'Nastavit', en: 'Set' },
  'status.zrusit': { cs: 'Zrušit status', en: 'Clear your status' },
  'status.chybaUlozeni': {
    cs: 'Status se nepodařilo uložit.',
    en: 'Your status could not be saved.',
  },
  'status.chybaZruseni': {
    cs: 'Status se nepodařilo zrušit.',
    en: 'Your status could not be cleared.',
  },

  // --- technické parametry (dávka 3) ---
  'parametry.tlacitko': { cs: 'Parametry', en: 'Parameters' },
  // Bublina u tlačítka je jen popis, ne vysvětlování (28. 9. 2026).
  'parametry.tlacitkoPopis': {
    cs: 'Technické parametry projektu',
    en: 'Technical parameters of the project',
  },
  'parametry.nadpis': { cs: 'Technické parametry', en: 'Technical parameters' },
  'parametry.zadnaSada': {
    cs: 'Pro tenhle projekt zatím žádná sada není.',
    en: 'There is no set for this project yet.',
  },
  'parametry.obecnaSada': { cs: 'obecná sada', en: 'general set' },
  'parametry.otevritDetail': {
    cs: 'Otevřít detail projektu ↗',
    en: 'Open the project detail ↗',
  },
  'parametry.nicTuNeni': {
    cs: 'Pro tenhle projekt tu zatím nic není.',
    en: 'There is nothing here for this project yet.',
  },

  // --- otazník s návodem (dávka 3) ---
  'napoveda.nadpis': { cs: 'Nápověda', en: 'Help' },
  'napoveda.navodKObrazovce': { cs: 'Návod k téhle obrazovce', en: 'The guide to this screen' },
  'napoveda.navodNeni': {
    cs: 'Návod k téhle obrazovce zatím není.',
    en: 'There is no guide to this screen yet.',
  },
  'napoveda.nacitamNavod': { cs: 'Načítám návod…', en: 'Loading the guide…' },
  'napoveda.otevritVNapovede': { cs: 'Otevřít v Nápovědě ↗', en: 'Open in Help ↗' },

  // --- zvonek s oznámeními (dávka 3) ---
  'oznameni.nadpis': { cs: 'Oznámení', en: 'Notifications' },
  'oznameni.neprectene': {
    cs: 'Oznámení: {pocet} nepřečtených',
    en: 'Notifications: {pocet} unread',
  },

  // --- pruh náhledového účtu (dávka 3) ---
  'nahled.stitek': { cs: 'Náhled', en: 'Preview' },
  'nahled.prohlizite': {
    cs: 'Prohlížíte portál jako {role}',
    en: 'You are viewing the portal as {role}',
  },
  'nahled.nicSeNeulozi': {
    cs: 'Nic se z tohohle účtu neuloží.',
    en: 'Nothing is saved from this account.',
  },
  'nahled.prepinam': { cs: 'Přepínám…', en: 'Switching…' },

  // --- řaditelná tabulka: hledání, filtry, řazení (dávka 3) ---
  'tabulka.hledat': { cs: 'Hledat…', en: 'Search…' },
  'tabulka.vymazatHledani': { cs: 'Vymazat hledání', en: 'Clear the search' },
  'tabulka.filtry': { cs: 'Filtry', en: 'Filters' },
  'tabulka.filtryPocet': { cs: 'Filtry ({pocet})', en: 'Filters ({pocet})' },
  'tabulka.filtrVse': { cs: '{sloupec}: vše', en: '{sloupec}: all' },
  'tabulka.rozsahOd': { cs: '{co} od', en: '{co} from' },
  'tabulka.rozsahDo': { cs: 'do', en: 'to' },
  'tabulka.pocetZ': { cs: '{zobrazeno} z {celkem}', en: '{zobrazeno} of {celkem}' },
  'tabulka.zrusitFiltry': { cs: 'Zrušit filtry', en: 'Clear the filters' },
  'tabulka.seraditPodle': { cs: 'Seřadit podle: {sloupec}', en: 'Sort by: {sloupec}' },

  // --- přehrávač s waveformou (dávka 3) ---
  'prehravac.prehrat': { cs: 'Přehrát', en: 'Play' },
  'prehravac.pozastavit': { cs: 'Pozastavit', en: 'Pause' },
  'prehravac.nacitamPrubeh': {
    cs: 'Načítám průběh nahrávky…',
    en: 'Loading the waveform of the recording…',
  },

  // --- výběr projektu psaním (dávka 3) ---
  'vyberProjektu.placeholder': {
    cs: 'Začněte psát název projektu, firmu nebo číslo…',
    en: 'Start typing the project name, the company or the number…',
  },
  'vyberProjektu.prazdno': {
    cs: 'Nic takového jsme nenašli. Zkuste jen část názvu nebo jméno firmy.',
    en: 'We found nothing like that. Try just part of the name or the company name.',
  },
  'vyberProjektu.zrusitVyber': {
    cs: 'Zrušit výběr projektu',
    en: 'Clear the project selection',
  },
  'vyberProjektu.zrusitKratce': { cs: 'Zrušit výběr', en: 'Clear the selection' },
  'vyberProjektu.dokonceno': { cs: 'dokončeno', en: 'completed' },
  'vyberProjektu.zobrazenoPrvnich': {
    cs: 'Zobrazeno prvních {pocet} z {celkem} — pište dál a seznam se zúží.',
    en: 'Showing the first {pocet} of {celkem} — keep typing and the list will narrow.',
  },

  // --- sdílené komponenty src/components (dávka 3) ---

  // sdílené napříč komponentami (lišta hromadného mazání i pole s lupou)
  'obecne.zrusitVyber': { cs: 'Zrušit výběr', en: 'Clear selection' },

  // mazání - lišta nad tabulkou, pojistka u tlačítka, překážky
  'mazani.nezdarilo': { cs: 'Smazání se nezdařilo.', en: 'The deletion failed.' },
  'mazani.vybratVse': { cs: 'Vybrat vše', en: 'Select all' },
  'mazani.vybratVsePocet': { cs: 'Vybrat vše ({pocet})', en: 'Select all ({pocet})' },
  'mazani.vybrano': { cs: 'Vybráno: {pocet}', en: 'Selected: {pocet}' },
  'mazani.nicNevybrano': { cs: 'Nic nevybráno', en: 'Nothing selected' },
  'mazani.mazu': { cs: 'Mažu…', en: 'Deleting…' },
  'mazani.smazatVybrane': { cs: 'Smazat vybrané', en: 'Delete selected' },
  'mazani.smazatVybranePocet': {
    cs: 'Smazat vybrané ({pocet})',
    en: 'Delete selected ({pocet})',
  },
  'mazani.opravduSmazatPocet': {
    cs: 'Opravdu smazat {pocet}? Klepněte znovu',
    en: 'Really delete {pocet}? Tap again',
  },
  'mazani.opravduSmazat': { cs: 'Opravdu smazat?', en: 'Really delete?' },
  'mazani.opravduSmazatCo': { cs: 'Opravdu smazat: {co}?', en: 'Really delete: {co}?' },
  // Otázku podává volající (co se maže), tlačítko k ní přidá pobídku.
  'mazani.otazkaKlepnete': { cs: '{otazka} Klepněte znovu', en: '{otazka} Tap again' },
  'mazani.otazkaKlepnetePopis': { cs: '{otazka} Klepněte znovu.', en: '{otazka} Tap again.' },
  'mazani.nejdeRovnouSmazat': {
    cs: '{co} nejde rovnou smazat.',
    en: '{co} cannot be deleted straight away.',
  },
  'mazani.visiNaNem': { cs: 'Visí na něm:', en: 'It still has:' },
  'mazani.archivVysvetleni': {
    cs: 'Archiv uloží všechno navázané stranou (jde stáhnout ze sekce Archiv) a teprve pak to z portálu odstraní. Doklady se u projektu neruší, jen se odpojí — název projektu si nesou textem, takže v účetnictví zůstanou čitelné.',
    en: 'The archive puts everything attached aside (you can download it from the Archive section) and only then removes it from the portal. Documents on a project are not cancelled, only detached — they carry the project name as text, so they stay readable in the accounts.',
  },
  'mazani.pracuji': { cs: 'Pracuji…', en: 'Working…' },
  'mazani.archivovatASmazat': { cs: 'Archivovat a smazat', en: 'Archive and delete' },
  'mazani.smazatBezArchivu': { cs: 'Smazat bez archivu', en: 'Delete without archiving' },
  'mazani.nechatByt': { cs: 'Nechat být', en: 'Leave it' },

  // schválení reklamy klientem
  'spot.schvalit': { cs: 'Schválit', en: 'Approve' },
  'spot.schvaleniNeulozeno': {
    cs: 'Schválení se nepodařilo uložit.',
    en: 'The approval could not be saved.',
  },
  'spot.bublinaFakturace': {
    cs: 'Schválením jde celý projekt k fakturaci',
    en: 'Approval sends the whole project for invoicing',
  },
  'spot.opravduKlepnete': { cs: 'Opravdu? Klepněte znovu', en: 'Are you sure? Tap again' },
  'spot.opravduSchvalitKlepnete': {
    cs: 'Opravdu schválit? Klepněte znovu',
    en: 'Really approve? Tap again',
  },
  'spot.jeSchvalena': { cs: 'Zakázka je schválená', en: 'The job is approved' },
  'spot.vPoradku': { cs: 'Je zakázka v pořádku?', en: 'Is the job all right?' },
  'spot.vysvetleni': {
    cs: 'Schválením nám dáte vědět, že je hotovo — celý projekt tím jde k fakturaci. Když je co upravit, napište to radši do připomínek.',
    en: 'Approving tells us it is finished — the whole project then goes for invoicing. If anything needs changing, put it in the comments instead.',
  },

  // předvyplněná nabídka z objednávky
  'nabidka.nezalozena': {
    cs: 'Nabídku se nepodařilo založit.',
    en: 'The quote could not be created.',
  },
  'nabidka.pripravena': { cs: 'Nabídka je připravená', en: 'The quote is ready' },
  'nabidka.zObjednavky': {
    cs: 'Z objednávky z webu ({datum}). U audioknih se nabídka zakládá sama, hned jak objednávka přijde — tahle se z nějakého důvodu nezaložila. Vznikne tímhle tlačítkem a bude rozpracovaná, takže ji ještě stihnete upravit.',
    en: 'From a web order ({datum}). For audiobooks the quote is created on its own as soon as the order arrives — this one was not, for some reason. This button creates it as a draft, so you can still edit it.',
  },
  'nabidka.zakladam': { cs: 'Zakládám…', en: 'Creating…' },
  'nabidka.pridat': { cs: 'Přidat nabídku', en: 'Add quote' },
  'nabidka.predmet': { cs: 'Předmět', en: 'Subject' },
  'nabidka.odberatel': { cs: 'Odběratel', en: 'Customer' },
  'nabidka.vystavi': { cs: 'Vystaví', en: 'Issued by' },
  'nabidka.cenaBezDph': { cs: 'Cena bez DPH', en: 'Price excluding VAT' },
  // Zkratka normostran za cenou; anglicky SP (standard page).
  'nabidka.normostrany': { cs: '· {pocet} NS', en: '· {pocet} SP' },

  // pozvánka herci
  'pozvanka.nova': { cs: 'Nová pozvánka', en: 'New invitation' },
  'pozvanka.novaHerci': { cs: 'Nová pozvánka herci', en: 'New narrator invitation' },
  'pozvanka.neodeslana': {
    cs: 'Pozvánku se nepodařilo odeslat.',
    en: 'The invitation could not be sent.',
  },
  'pozvanka.odeslanaNa': {
    cs: 'Pozvánka odešla na {email}.',
    en: 'The invitation has been sent to {email}.',
  },
  'pozvanka.vysvetleni': {
    cs: 'Stačí e-mail. Herci přijde pozvánka do portálu a po nastavení hesla ho portál sám vyzve, ať doplní jméno, adresu, číslo účtu a kde může natáčet.',
    en: 'An email address is enough. The narrator gets an invitation to the portal and, once they have set a password, the portal itself asks them for their name, address, account number and where they can record.',
  },
  'pozvanka.emailHerce': { cs: 'e-mail herce', en: 'narrator’s email' },
  'pozvanka.odesilam': { cs: 'Odesílám…', en: 'Sending…' },
  'pozvanka.poslat': { cs: 'Poslat', en: 'Send' },

  // text z objednávky v hlavičce projektu
  'priloha.textZObjednavky': {
    cs: 'Text z objednávky: {nazev}',
    en: 'Text from the order: {nazev}',
  },
  'priloha.naDisku': { cs: 'je ve složce na Disku', en: 'it is in the Drive folder' },
  'priloha.nedostalSe': {
    cs: 'na Disk se nedostal: {chyba}',
    en: 'it did not get to Drive: {chyba}',
  },
  'priloha.nahravam': { cs: 'Nahrávám…', en: 'Uploading…' },
  'priloha.nahratNaDisk': {
    cs: 'Nahrát do složky na Disku',
    en: 'Upload to the Drive folder',
  },
  'priloha.nahrano': { cs: 'Nahráno do složky projektu.', en: 'Uploaded to the project folder.' },
  'priloha.nepodariloSe': { cs: 'Nepodařilo se.', en: 'It did not work.' },

  // náhled pod ikonou v přehledu projektů
  'ikony.nahled': { cs: 'Náhled', en: 'Preview' },
  'ikony.nahledNenacten': {
    cs: 'Náhled se nepodařilo načíst.',
    en: 'The preview could not be loaded.',
  },

  // pole s lupou a zaškrtávací výběr studií
  'vyber.zacnetePsat': { cs: 'Začněte psát…', en: 'Start typing…' },
  'vyber.hledejtePsanim': { cs: 'Hledejte psaním…', en: 'Search by typing…' },
  'vyber.nicNenalezeno': { cs: 'Nic takového jsme nenašli.', en: 'We found nothing like that.' },
  'vyber.ukazujemePrvnich': {
    cs: 'Ukazujeme prvních {pocet} — pište dál, ať se seznam zúží.',
    en: 'Showing the first {pocet} — keep typing to narrow the list.',
  },
  'vyber.asponJednoStudio': {
    cs: 'Aspoň jedno studio musí zůstat vybrané',
    en: 'At least one studio must stay selected',
  },

  // priorita projektu (ikona tří sloupečků)
  'priorita.nizka': { cs: 'Nízká', en: 'Low' },
  'priorita.stredni': { cs: 'Střední', en: 'Medium' },
  'priorita.vysoka': { cs: 'Vysoká', en: 'High' },
  'priorita.bez': { cs: 'bez priority', en: 'no priority' },
  'priorita.bublina': { cs: 'Priorita: {stupen}', en: 'Priority: {stupen}' },
  'priorita.bublinaKlepnuti': {
    cs: 'Priorita: {stupen} — klepnutím {dalsi}',
    en: 'Priority: {stupen} — tap for {dalsi}',
  },
  'priorita.bublinaKlepnutiPopis': {
    cs: 'Priorita: {stupen}. Klepnutím nastavíte: {dalsi}',
    en: 'Priority: {stupen}. Tap to set: {dalsi}',
  },

  // QR platba v řádku dokladu
  'qr.platbaCastka': { cs: 'QR platba: {castka}', en: 'QR payment: {castka}' },
  'qr.zobrazit': { cs: 'Zobrazit QR platbu', en: 'Show QR payment' },
  'qr.kodProPlatbu': { cs: 'QR kód pro platbu', en: 'QR code for payment' },
  // Variabilní symbol; britská banka mu říká payment reference.
  'qr.vs': { cs: 'VS {vs}', en: 'Ref. {vs}' },
  'qr.splatnost': { cs: 'Splatnost {datum}', en: 'Due {datum}' },

  // --- sdílené komponenty, které běží i na serveru (dávka 3) ----------------
  // Odznak přeposlechu u typu projektu. „Záznam chyby" je v AudioTaggeru tag
  // (viz slovníček v docs/preklad-portalu.md).
  'odznakPreposlechu.hotovo': { cs: 'Přeposlechnuto komplet', en: 'Proof-listening complete' },
  'odznakPreposlechu.bezi': { cs: 'Přeposlech běží', en: 'Proof-listening under way' },
  'odznakPreposlechu.chyb': { cs: '{pocet} zapsaných chyb', en: '{pocet} tags logged' },
  'odznakPreposlechu.stopy': {
    cs: '{hotovo} z {celkem} stop doposlechnuto',
    en: '{hotovo} of {celkem} tracks listened through',
  },
  'odznakPreposlechu.procent': { cs: '{procent} % textu', en: '{procent}% of the text' },
  'odznakPreposlechu.bezikratce': { cs: 'Přeposlech běží · {pocet}', en: 'Proof-listening · {pocet}' },

  // --- svátky, pásmo a videohovor v kalendáři (28. 9. 2026) ---
  'kalendar.svatekIkona': { cs: 'Státní svátek: {nazev}', en: 'Public holiday: {nazev}' },
  'kalendar.svatekNadpis': { cs: 'Státní svátek', en: 'Public holiday' },
  'kalendar.hovorIkona': { cs: 'Otevřít videohovor porady', en: 'Open the meeting video call' },
  'kalendar.pasmoPopisek': { cs: 'Časy v pásmu', en: 'Times shown in' },
  'kalendar.pasmoStudiaZkratka': { cs: 'pásmo studia', en: 'the studio' },
  'kalendar.pasmoVaseZkratka': { cs: 'vaše pásmo', en: 'your zone' },
  'kalendar.pasmoJineVarovani': {
    cs: 'Pozor: mřížka jede v {studio}',
    en: 'Note: the grid runs on {studio}',
  },

  // Odběr kalendáře pro herce
  'kalendarOdber.pridat': { cs: 'Přidat do kalendáře', en: 'Add to calendar' },
  'kalendarOdber.odebirat': { cs: 'Odebírat (aktualizuje se samo)', en: 'Subscribe (updates itself)' },
  'kalendarOdber.google': { cs: 'Google Kalendář', en: 'Google Calendar' },
  'kalendarOdber.vysvetleni': {
    cs: 'Při odběru se v kalendáři objeví i pozdější změny - přesun nebo zrušení termínu.',
    en: 'With a subscription, later changes show up in your calendar too — a session moved or cancelled.',
  },

  // QR platba u dokladu
  'qr.naskenujte': { cs: 'Naskenujte v bankovní aplikaci.', en: 'Scan it in your banking app.' },
  'qr.platba': { cs: 'QR platba', en: 'QR payment' },

  // Válec progresu natáčení. Množná čísla jsou tři celé věty, ne skládačka.
  'progres.prazdne': { cs: 'text zatím nemáme', en: 'no text yet' },
  'progres.bezCelku': {
    cs: 'Natočeno do téhle strany. Procenta budou, až bude ve složce projektu text v PDF.',
    en: 'Recorded up to this page. Percentages will appear once the project folder has the text as a PDF.',
  },
  'progres.popisek': { cs: 'Progres natáčení', en: 'Recording progress' },
  'progres.zbyvaJedna': { cs: 'zbývá {pocet} strana', en: '{pocet} standard page to go' },
  'progres.zbyvaMalo': { cs: 'zbývají {pocet} strany', en: '{pocet} standard pages to go' },
  'progres.zbyvaVic': { cs: 'zbývá {pocet} stran', en: '{pocet} standard pages to go' },

  // Značka „projekt přišel z webu"
  'zWebu.popisKdy': {
    cs: 'Projekt vznikl z objednávky na webu ({datum})',
    en: 'This project came from an order on the website ({datum})',
  },
  'zWebu.popis': {
    cs: 'Projekt vznikl z objednávky na webu',
    en: 'This project came from an order on the website',
  },

  // ==========================================================================
  // DAVKA 4 - DOKLADY (27. 9. 2026)
  // Nabidky, faktury, vydaje, smlouvy, banka, upominky, moje firmy
  // a ciselniky ze src/lib. Cesky text je zdroj pravdy.
  // ==========================================================================

  // --- číselníky z src/lib (dávka 4) ---------------------------------------
  // Měny. Český název zůstává v CURRENCY_NAMES v lib/doklady.ts - bere si ho
  // PDF dokladu, kde jazyk určuje doklad, ne přepínač v liště.
  'mena.CZK': { cs: 'Koruna česká (CZK)', en: 'Czech koruna (CZK)' },
  'mena.EUR': { cs: 'Euro (EUR)', en: 'Euro (EUR)' },
  'mena.USD': { cs: 'Americký dolar (USD)', en: 'US dollar (USD)' },
  'mena.GBP': { cs: 'Britská libra (GBP)', en: 'Pound sterling (GBP)' },

  // Způsob úhrady (lib/uctenka.ts).
  'uhrada.CARD': { cs: 'Kartou', en: 'By card' },
  'uhrada.CASH': { cs: 'Hotově', en: 'In cash' },
  'uhrada.TRANSFER': { cs: 'Převodem', en: 'By bank transfer' },

  // ===================== NABÍDKY (dávka 4) =====================
  // Administrace → Doklady → Nabídky: seznam, editor nabídky, nová nabídka.

  // --- seznam nabídek: záložky podle stavu ---
  'nabidka.zalozkaRozpracovane': { cs: 'Rozpracované', en: 'Drafts' },
  'nabidka.zalozkaOdeslane': { cs: 'Odeslané', en: 'Sent' },
  'nabidka.zalozkaSchvalene': { cs: 'Schválené', en: 'Approved' },
  'nabidka.zalozkaOdmitnute': { cs: 'Odmítnuté', en: 'Rejected' },

  // Stav nabídky na pilulce (česká podoba je stejná jako OFFER_STATUS_LABELS
  // v lib/doklady.ts - ten zůstává jen pro místa, která ještě nepřekládají).
  'nabidka.stav.rozpracovana': { cs: 'Rozpracovaná', en: 'Draft' },
  'nabidka.stav.odeslana': { cs: 'Odeslaná', en: 'Sent' },
  'nabidka.stav.schvalena': { cs: 'Schválená', en: 'Approved' },
  'nabidka.stav.odmitnuta': { cs: 'Odmítnutá', en: 'Rejected' },

  // --- seznam nabídek: prázdný stav bez fakturační firmy ---
  'nabidka.nejdrivFirmaNadpis': {
    cs: 'Nejdřív si založte fakturační firmu',
    en: 'Set up an invoicing company first',
  },
  'nabidka.nejdrivFirmaPopis': {
    cs: 'Nabídka se vystavuje za konkrétní firmu a bere si z ní číselnou řadu.',
    en: 'A quote is issued in the name of a specific company and takes its number series from it.',
  },
  'nabidka.prejitNaMojeFirmy': { cs: 'Přejít na Moje firmy', en: 'Go to My companies' },

  // --- tabulka nabídek ---
  'nabidka.sl.nazev': { cs: 'Název', en: 'Name' },
  'nabidka.sl.odberatel': { cs: 'Odběratel', en: 'Customer' },
  'nabidka.sl.projekt': { cs: 'Projekt', en: 'Project' },
  'nabidka.sl.vystaveno': { cs: 'Vystaveno', en: 'Issued' },
  'nabidka.sl.stav': { cs: 'Stav', en: 'Status' },
  'nabidka.sl.bezDph': { cs: 'Bez DPH', en: 'Excl. VAT' },
  'nabidka.sl.sDph': { cs: 'S DPH', en: 'Incl. VAT' },
  'nabidka.tabulkaPrazdna': { cs: 'Tady zatím nic není.', en: 'Nothing here yet.' },
  'nabidka.hledatPlaceholder': {
    cs: 'Hledat nabídku, odběratele, projekt…',
    en: 'Search quotes, customers, projects…',
  },
  'nabidka.bezNazvu': { cs: 'Bez názvu', en: 'Untitled' },

  // --- nová nabídka ---
  // Slouží i jako popisek místo čísla v hlavičce ještě neuložené nabídky.
  'nabidka.nova': { cs: 'Nová nabídka', en: 'New quote' },
  'nabidka.zpetNaNabidky': { cs: '← Zpět na nabídky', en: '← Back to quotes' },
  // LINKA HISTORIE U DOKLADU (připomínka Báry Šíblové 7. 10. 2026).
  'drobecky.projekt': { cs: 'Projekt', en: 'Project' },
  'drobecky.firma': { cs: 'Firma', en: 'Company' },
  'drobecky.naProjekt': { cs: 'Zpět na projekt', en: 'Back to the project' },
  'drobecky.dokladyProjektu': { cs: '← Zpět na doklady projektu', en: '← Back to the project\u2019s documents' },
  'drobecky.naFirmu': { cs: 'Otevřít kartu firmy', en: 'Open the company card' },
  'projektMeta.firmaKarta': { cs: 'Otevřít kartu firmy', en: 'Open the company card' },

  // --- editor: kolik z nabídky je vyfakturováno ---
  'nabidka.vyfakturovano': { cs: 'Vyfakturováno z nabídky', en: 'Invoiced from this quote' },
  'nabidka.vyfakturovanoZ': { cs: '{castka} z {celkem}', en: '{castka} of {celkem}' },
  'nabidka.zbyva': { cs: 'zbývá {castka}', en: '{castka} remaining' },
  'nabidka.vyfakturovanoCele': { cs: 'vyfakturováno celé', en: 'invoiced in full' },

  // --- editor: lišta se stavem a akcemi ---
  'nabidka.schvalenoKdy': { cs: 'Schváleno {datum}', en: 'Approved {datum}' },
  'nabidka.schvalenoKdyKym': {
    cs: 'Schváleno {datum} — {jmeno}',
    en: 'Approved {datum} — {jmeno}',
  },
  'nabidka.odmitnutoKdy': { cs: 'Odmítnuto {datum}', en: 'Rejected {datum}' },
  'nabidka.odeslanoKdy': { cs: 'Odesláno {datum}', en: 'Sent {datum}' },
  'nabidka.odkazProKlienta': { cs: 'Odkaz pro klienta', en: 'Link for the customer' },
  'nabidka.zkopirovano': { cs: 'Zkopírováno', en: 'Copied' },
  'nabidka.vystavitFakturu': { cs: 'Vystavit fakturu', en: 'Issue an invoice' },
  'nabidka.vystavitDalsiFakturu': { cs: 'Vystavit další fakturu', en: 'Issue another invoice' },
  'nabidka.schvalitRucne': { cs: 'Schválit ručně', en: 'Approve manually' },
  'nabidka.odeslatKlientovi': { cs: 'Odeslat klientovi', en: 'Send to customer' },
  'nabidka.odesilam': { cs: 'Odesílám…', en: 'Sending…' },

  // --- editor: ruční schválení ---
  'nabidka.schvaleniPopis': {
    cs: 'Označit nabídku jako schválenou — pro případy, kdy ji klient odsouhlasil telefonem nebo mailem. Schválenou nabídku už nejde měnit.',
    en: 'Mark the quote as approved — for when the customer agreed to it by phone or email. An approved quote can no longer be changed.',
  },
  'nabidka.kdoSchvalil': {
    cs: 'Kdo na straně klienta schválil (nepovinné)',
    en: 'Who approved it on the customer’s side (optional)',
  },
  'nabidka.kdoSchvalilPlaceholder': {
    cs: 'např. Jan Novák — potvrzeno telefonicky',
    en: 'e.g. Jan Novák — confirmed by phone',
  },
  'nabidka.schvalitNabidku': { cs: 'Schválit nabídku', en: 'Approve the quote' },

  // --- editor: schválená nabídka je zamčená ---
  'nabidka.zamcenaPopis': {
    cs: 'Nabídka je schválená, takže už se nedá měnit — zůstává přesně v podobě, kterou klient odsouhlasil. Fakturu z ní vystavíte tlačítkem nahoře.',
    en: 'The quote is approved, so it can no longer be changed — it stays exactly as the customer agreed it. Use the button above to issue an invoice from it.',
  },
  'nabidka.zrusitSchvaleni': { cs: 'Zrušit schválení', en: 'Cancel the approval' },
  'nabidka.rusim': { cs: 'Ruším…', en: 'Cancelling…' },

  // --- editor: hlášky po uložení, odeslání a schválení ---
  'nabidka.chybaBezOdberatele': {
    cs: 'Vyberte odběratele — bez něj nevíme, komu nabídku poslat.',
    en: 'Select a customer — without one we do not know who to send the quote to.',
  },
  'nabidka.ulozeno': { cs: 'Uloženo.', en: 'Saved.' },
  // Oprava 30. 9. 2026 - viz pripravPolozky v lib/doklady.ts.
  'doklad.chybaPolozkaBezPopisu': {
    cs: 'Řádek {radek} má cenu, ale chybí mu popis. Doplňte ho — bez popisu by se celý řádek ztratil.',
    en: 'Line {radek} has a price but no description. Fill it in — without it the whole line would be lost.',
  },
  'nabidka.chybaUlozeni': { cs: 'Uložení se nezdařilo.', en: 'The quote could not be saved.' },
  'nabidka.odeslanoNa': {
    cs: 'Nabídka odeslána na {email}.',
    en: 'The quote has been sent to {email}.',
  },
  'nabidka.chybaOdeslani': { cs: 'Odeslání se nezdařilo.', en: 'The quote could not be sent.' },
  'nabidka.oznacenaSchvalena': {
    cs: 'Nabídka je označená jako schválená.',
    en: 'The quote is marked as approved.',
  },
  'nabidka.chybaSchvaleni': {
    cs: 'Schválení se nepodařilo uložit.',
    en: 'The approval could not be saved.',
  },
  'nabidka.schvaleniZruseno': {
    cs: 'Schválení zrušeno, nabídku jde zase upravit.',
    en: 'The approval has been cancelled, the quote can be edited again.',
  },
  'nabidka.chybaZruseniSchvaleni': {
    cs: 'Schválení se nepodařilo zrušit.',
    en: 'The approval could not be cancelled.',
  },
  'nabidka.chybaKopirovani': {
    cs: 'Odkaz se nepodařilo zkopírovat — schránka není dostupná.',
    en: 'The link could not be copied — the clipboard is not available.',
  },
  'nabidka.chybaSmazani': { cs: 'Smazání se nezdařilo.', en: 'The quote could not be deleted.' },

  // --- editor: hlavička dokladu ---
  'nabidka.dodavatel': { cs: 'Dodavatel', en: 'Supplier' },
  // 'nabidka.odberatel' už ve slovníku je (dávka 3, PridatNabidku) - editor
  // používá ten stávající klíč, tady ho schválně nezakládám znovu.
  'nabidka.neplatceDph': { cs: 'neplátce DPH', en: 'not VAT registered' },

  // Komu nabídka poletí. Jméno příjemce je uprostřed věty tučně, proto se
  // věta dělí přes prelozitKolem (pravidlo 7).
  'nabidka.posleme': {
    cs: 'Nabídku pošleme {prijemce}',
    en: 'We will send the quote to {prijemce}',
  },
  'nabidka.prijemceZKlienta': {
    cs: 'klient vyplněný u projektu',
    en: 'the customer listed on the project',
  },
  'nabidka.prijemceZFirmy': {
    cs: 'kontakt firmy — projekt nemá vyplněného klienta',
    en: 'the company contact — the project has no customer listed',
  },
  'nabidka.neniKomuPoslatProjekt': {
    cs: 'Nabídku není komu poslat — projekt nemá klienta s e-mailem a firma nemá kontaktní e-mail.',
    en: 'There is nobody to send the quote to — the project has no customer with an email address and the company has no contact email.',
  },
  'nabidka.neniKomuPoslat': {
    cs: 'Nabídku není komu poslat — vyberte níže projekt s klientem, nebo firmě doplňte kontaktní e-mail.',
    en: 'There is nobody to send the quote to — choose a project with a customer below, or add a contact email to the company.',
  },

  // --- editor: předmět a data ---
  'nabidka.nazev': { cs: 'Název', en: 'Name' },
  'nabidka.nazevPlaceholder': {
    cs: 'např. Výroba audioknihy Tři mušketýři',
    en: 'e.g. Producing the audiobook The Three Musketeers',
  },
  'nabidka.nazevZProjektu': {
    cs: 'Doplní se z názvu projektu. Přepsáním si ho zamknete — třeba pro variantu nabídky.',
    en: 'It is filled in from the project name. Typing your own locks it — handy for a variant of the quote.',
  },
  'nabidka.projekt': { cs: 'Projekt', en: 'Project' },
  'nabidka.vystaveno': { cs: 'Vystaveno', en: 'Issue date' },
  'nabidka.platnostDo': { cs: 'Platnost do', en: 'Valid until' },
  'nabidka.mena': { cs: 'Měna', en: 'Currency' },
  'nabidka.jazykNabidky': { cs: 'Jazyk nabídky', en: 'Quote language' },

  // --- editor: položky ---
  'nabidka.polozky': { cs: 'Položky', en: 'Items' },
  'nabidka.cenyBezDph': { cs: 'Ceny se zadávají bez DPH.', en: 'Prices are entered excluding VAT.' },
  'nabidka.popisPolozky': { cs: 'Popis položky', en: 'Item description' },
  'nabidka.odebratPolozku': { cs: 'Odebrat položku', en: 'Remove the item' },
  'nabidka.mnozstvi': { cs: 'Množství', en: 'Quantity' },
  'nabidka.jednotka': { cs: 'Jednotka', en: 'Unit' },
  'nabidka.cenaZaJednotku': { cs: 'Cena / j.', en: 'Price / unit' },
  'nabidka.dph': { cs: 'DPH', en: 'VAT' },
  'nabidka.sazbaDph': { cs: '{sazba} %', en: '{sazba}%' },
  'nabidka.celkemPolozka': { cs: 'Celkem', en: 'Total' },
  'nabidka.pridatPolozku': { cs: 'Přidat položku', en: 'Add an item' },
  'nabidka.herciZProjektu': {
    cs: '+ Herci z projektu ({pocet})',
    en: '+ Voice actors from the project ({pocet})',
  },

  // --- editor: součet ---
  'nabidka.mezisoucetBezDph': { cs: 'Mezisoučet bez DPH', en: 'Subtotal excl. VAT' },
  'nabidka.zakladBezDph': { cs: 'Základ bez DPH', en: 'Net amount excl. VAT' },
  'nabidka.zakladBezDphPoSleve': {
    cs: 'Základ bez DPH po slevě',
    en: 'Net amount excl. VAT after discount',
  },
  'nabidka.dphSazba': { cs: 'DPH {sazba} %', en: 'VAT {sazba}%' },
  'nabidka.celkem': { cs: 'Celkem', en: 'Total' },

  // --- editor: poznámka, účet, náhled, smazání ---
  'nabidka.poznamkaProKlienta': { cs: 'Poznámka pro klienta', en: 'Note for the customer' },
  'nabidka.poznamkaPlaceholder': {
    cs: 'Co je v ceně, termíny, podmínky…',
    en: 'What the price includes, dates, terms…',
  },
  'nabidka.bankovniUcet': { cs: 'Bankovní účet ({mena})', en: 'Bank account ({mena})' },
  'nabidka.zadnyUcet': {
    cs: 'Pro tuhle měnu není u vaší firmy žádný účet. Doplňte ho v Moje firmy — na faktuře bude potřeba.',
    en: 'Your company has no account in this currency. Add one in My companies — the invoice will need it.',
  },
  'nabidka.nahled': { cs: 'Náhled nabídky', en: 'Quote preview' },
  'nabidka.smazatNabidku': { cs: 'Smazat nabídku', en: 'Delete the quote' },
  'nabidka.opravduSmazat': { cs: 'Opravdu smazat nabídku?', en: 'Delete this quote?' },

  // ===== DÁVKA 4 — FAKTURY (admin/doklady/faktury) =====
  // Vložit do objektu SLOVNIK v src/lib/jazyk.ts. Nic jiného tento soubor neobsahuje.

  // --- seznam faktur: záložky a stavy ---
  'faktura.zalozkaRozpracovane': { cs: 'Rozpracované', en: 'Drafts' },
  'faktura.zalozkaNeuhrazene': { cs: 'Neuhrazené', en: 'Unpaid' },
  // KALENDÁŘ SPLATNOSTÍ (zadání 7. 10. 2026) - vidí ho jen superadmin.
  'faktura.pohledTabulka': { cs: 'Tabulka', en: 'Table' },
  'faktura.pohledKalendar': { cs: 'Kalendář splatností', en: 'Due date calendar' },
  'faktura.kalendarCelkem': { cs: 'celkem', en: 'total' },
  'faktura.kalendarBezSplatnosti': { cs: 'Bez vyplněné splatnosti', en: 'No due date' },
  'faktura.kalendarPrazdno': { cs: 'Žádná neuhrazená faktura nemá vyplněnou splatnost.', en: 'No unpaid invoice has a due date.' },
  'faktura.kalendarDnes': { cs: 'dnes', en: 'today' },
  'faktura.kalendarDoTydne': { cs: 'do týdne', en: 'within a week' },
  'faktura.kalendarPozdeji': { cs: 'později', en: 'later' },
  'faktura.zalozkaUhrazene': { cs: 'Uhrazené', en: 'Paid' },
  'faktura.zalozkaStornovane': { cs: 'Stornované', en: 'Cancelled' },
  'faktura.stavRozpracovana': { cs: 'Rozpracovaná', en: 'Draft' },
  'faktura.stavNeuhrazena': { cs: 'Neuhrazená', en: 'Unpaid' },
  'faktura.stavUhrazena': { cs: 'Uhrazená', en: 'Paid' },
  'faktura.stavStornovana': { cs: 'Stornovaná', en: 'Cancelled' },
  'faktura.stavNeulozena': { cs: 'Neuložená', en: 'Not saved' },

  // --- seznam faktur: stránka ---
  'faktura.bezNazvu': { cs: 'Bez názvu', en: 'Untitled' },
  'faktura.neuhrazenoCelkem': { cs: 'Neuhrazeno celkem', en: 'Total outstanding' },
  'faktura.novaFaktura': { cs: 'Nová faktura', en: 'New invoice' },
  'faktura.zadnaFirmaNadpis': {
    cs: 'Nejdřív si založte fakturační firmu',
    en: 'Set up an invoicing company first',
  },
  'faktura.zadnaFirmaPopis': {
    cs: 'Faktura se vystavuje za konkrétní firmu a bere si z ní číselnou řadu i bankovní účet.',
    en: 'An invoice is issued on behalf of a particular company and takes its number series and bank account from it.',
  },
  'faktura.prejitNaMojeFirmy': { cs: 'Přejít na Moje firmy', en: 'Go to My companies' },

  // --- tabulka faktur ---
  'faktura.sloupecNazev': { cs: 'Název', en: 'Name' },
  'faktura.sloupecOdberatel': { cs: 'Odběratel', en: 'Customer' },
  'faktura.sloupecVystaveno': { cs: 'Vystaveno', en: 'Issued' },
  'faktura.sloupecSplatnost': { cs: 'Splatnost', en: 'Due date' },
  'faktura.sloupecStav': { cs: 'Stav', en: 'Status' },
  'faktura.sloupecKUhrade': { cs: 'K úhradě', en: 'Amount due' },
  'faktura.poSplatnosti': { cs: 'po splatnosti', en: 'overdue' },
  'faktura.tabulkaPrazdna': { cs: 'Tady zatím nic není.', en: 'Nothing here yet.' },
  'faktura.hledatPlaceholder': {
    cs: 'Hledat fakturu, odběratele, projekt…',
    en: 'Search invoices, customers, projects…',
  },
  'faktura.filtrOdberatel': { cs: 'Odběratel', en: 'Customer' },
  'faktura.filtrProjekt': { cs: 'Projekt', en: 'Project' },
  'faktura.filtrStav': { cs: 'Stav', en: 'Status' },
  'faktura.filtrPoSplatnosti': { cs: 'Po splatnosti', en: 'Overdue' },
  'faktura.vybratRadek': { cs: 'Vybrat fakturu {cislo}', en: 'Select invoice {cislo}' },
  'faktura.hromadneMazaniPoznamka': {
    cs: 'Smazání je nevratné a v číselné řadě po dokladu zůstane díra. Portál smaže jen stornované faktury — ostatní se musí nejdřív stornovat.',
    en: 'Deleting cannot be undone and leaves a gap in the number series. The portal only deletes cancelled invoices — the rest have to be cancelled first.',
  },

  // --- detail faktury: hlavička dokladu ---
  'faktura.zpetNaFaktury': { cs: '← Zpět na faktury', en: '← Back to invoices' },
  'faktura.zNabidkyCislo': { cs: 'z nabídky {cislo}', en: 'from quote {cislo}' },
  'faktura.uhrazenoKdy': { cs: 'Uhrazeno {kdy}', en: 'Paid {kdy}' },
  'faktura.odeslanoKdy': { cs: 'Odesláno {kdy}', en: 'Sent {kdy}' },
  'faktura.vznikneAzUlozenim': {
    cs: 'Faktura se založí až tlačítkem Uložit — číslo z řady dostane teprve tehdy.',
    en: 'The invoice is created only when you press Save — that is when it takes a number from the series.',
  },
  'faktura.zNabidkyVyfakturovano': {
    cs: 'Z nabídky {cislo} (celkem {celkem}) už je vyfakturováno {vyfakturovano} — {faktury}. Zbývá {zbyva}. Položky níž jsou z nabídky celé — upravte je na tu část, kterou fakturujete teď.',
    en: 'Of quote {cislo} (total {celkem}), {vyfakturovano} has already been invoiced — {faktury}. {zbyva} is left. The items below are the whole quote — trim them down to the part you are invoicing now.',
  },

  // --- detail faktury: záznam o odeslání ---
  'faktura.odeslanoNadpis': { cs: 'Odesláno', en: 'Sent' },
  'faktura.odeslalKdo': { cs: 'odeslal {jmeno}', en: 'sent by {jmeno}' },
  'faktura.odeslanoZPortalu': { cs: 'odesláno z portálu', en: 'sent from the portal' },
  'faktura.sRodnymListem': { cs: 's rodným listem', en: 'with the advert record' },

  // --- detail faktury: tlačítka ---
  'faktura.zrusit': { cs: 'Zrušit', en: 'Cancel' },
  'faktura.ulozit': { cs: 'Uložit', en: 'Save' },
  'faktura.ukladam': { cs: 'Ukládám…', en: 'Saving…' },
  'faktura.ulozitFakturu': { cs: 'Uložit fakturu', en: 'Save the invoice' },
  'faktura.zakladam': { cs: 'Zakládám…', en: 'Creating…' },
  'faktura.oznacitZaplacenou': { cs: 'Označit jako uhrazenou', en: 'Mark as paid' },
  'faktura.zrusitUhradu': { cs: 'Zrušit úhradu', en: 'Undo the payment' },
  'faktura.odeslatOdberateli': { cs: 'Odeslat odběrateli', en: 'Send to the customer' },
  'faktura.odesilam': { cs: 'Odesílám…', en: 'Sending…' },
  'faktura.smazatFakturu': { cs: 'Smazat fakturu', en: 'Delete the invoice' },
  'faktura.smazatNatrvalo': { cs: 'Smazat natrvalo', en: 'Delete permanently' },
  'faktura.stornovatFakturu': { cs: 'Stornovat fakturu', en: 'Cancel the invoice' },
  'faktura.opravduSmazat': { cs: 'Opravdu smazat fakturu?', en: 'Really delete the invoice?' },
  'faktura.opravduSmazatNatrvalo': { cs: 'Opravdu smazat natrvalo?', en: 'Really delete permanently?' },
  'faktura.opravduStornovat': { cs: 'Opravdu stornovat fakturu?', en: 'Really cancel the invoice?' },

  // --- detail faktury: hlášky ---
  'faktura.ulozeno': { cs: 'Uloženo.', en: 'Saved.' },
  'faktura.ulozeniSelhalo': { cs: 'Uložení se nezdařilo.', en: 'Saving failed.' },
  'faktura.odeslaniSelhalo': { cs: 'Odeslání se nezdařilo.', en: 'Sending failed.' },
  'faktura.smazaniSelhalo': { cs: 'Smazání se nezdařilo.', en: 'Deleting failed.' },
  'faktura.chybiOdberatel': {
    cs: 'Vyberte odběratele — bez něj nevíme, komu fakturu vystavit.',
    en: 'Choose a customer — without one we do not know who to invoice.',
  },
  'faktura.odeslanoNa': { cs: 'Faktura odeslána na {komu}.', en: 'The invoice has been sent to {komu}.' },
  'faktura.odeslanoNaSKopii': {
    cs: 'Faktura odeslána na {komu} (v kopii {kopie}).',
    en: 'The invoice has been sent to {komu} (copy to {kopie}).',
  },
  'faktura.zamcenaUhrazena': {
    cs: 'Faktura je uhrazená, takže se nedá měnit. Kdyby bylo potřeba, nejdřív zrušte úhradu.',
    en: 'The invoice is paid, so it cannot be changed. If you need to, undo the payment first.',
  },
  'faktura.zamcenaStornovana': { cs: 'Faktura je stornovaná.', en: 'The invoice is cancelled.' },
  'faktura.stornovanaInfo': {
    cs: 'Faktura byla stornována — v číselné řadě po ní zůstává stopa, jak to má být.',
    en: 'The invoice has been cancelled — it leaves its trace in the number series, as it should.',
  },
  'faktura.stornovanaZustavaVRade': {
    cs: 'Stornovaná faktura v číselné řadě normálně zůstává. Smazat natrvalo má smysl u dokladů, které v účetnictví nikdy nebyly — třeba zkušebních.',
    en: 'A cancelled invoice normally stays in the number series. Deleting permanently makes sense only for documents that were never in the books — test ones, for instance.',
  },

  // --- detail faktury: ukončení projektu po odeslání ---
  'faktura.ukoncitProjektOtazka': {
    cs: 'Faktura odešla. Ukončit projekt?',
    en: 'The invoice has gone out. Close the project?',
  },
  'faktura.ukoncitProjektNazev': {
    cs: 'Faktura odešla. Ukončit projekt „{nazev}"?',
    en: 'The invoice has gone out. Close the project “{nazev}”?',
  },
  'faktura.ukoncitProjektPopis': {
    cs: 'Přehodí se na „Vyfakturováno" a přesune mezi dokončené. Vrátit jde v detailu projektu.',
    en: 'It switches to “Invoiced” and moves in among the finished ones. You can undo that in the project detail.',
  },
  'faktura.ukoncitProjekt': { cs: 'Ukončit projekt', en: 'Close the project' },
  'faktura.projektUkoncen': { cs: 'Projekt je ukončený.', en: 'The project is closed.' },
  'faktura.ukonceniSelhalo': {
    cs: 'Projekt se nepodařilo ukončit.',
    en: 'The project could not be closed.',
  },
  'faktura.nechatBezet': { cs: 'Nechat běžet', en: 'Leave it running' },

  // --- detail faktury: strany dokladu ---
  'faktura.dodavatel': { cs: 'Dodavatel', en: 'Supplier' },
  'faktura.odberatel': { cs: 'Odběratel', en: 'Customer' },
  'faktura.neplatceDph': { cs: 'neplátce DPH', en: 'not VAT registered' },
  'faktura.firmaBezEmailu': {
    cs: 'Firma nemá kontaktní e-mail — bez něj fakturu nepošlete.',
    en: 'The company has no contact email — you cannot send the invoice without one.',
  },

  // --- detail faktury: formulář ---
  'faktura.polePredmet': { cs: 'Název', en: 'Name' },
  'faktura.poleProjekt': { cs: 'Projekt', en: 'Project' },
  'faktura.poleVariabilniSymbol': { cs: 'Variabilní symbol', en: 'Variable symbol' },
  'faktura.poleMena': { cs: 'Měna', en: 'Currency' },
  'faktura.poleJazykDokladu': { cs: 'Jazyk dokladu', en: 'Document language' },
  'faktura.jazykCestina': { cs: 'Čeština', en: 'Czech' },
  'faktura.jazykAnglictina': { cs: 'Angličtina', en: 'English' },
  'faktura.poleVystaveno': { cs: 'Vystaveno', en: 'Issued' },
  'faktura.poleDatumPlneni': { cs: 'Datum zdanitelného plnění', en: 'Date of taxable supply' },
  'faktura.poleSplatnost': { cs: 'Splatnost', en: 'Due date' },
  'faktura.poleUcet': { cs: 'Účet', en: 'Bank account' },
  'faktura.vyberteUcet': { cs: '— vyberte účet —', en: '— choose an account —' },
  'faktura.prenesenaDan': { cs: 'Přenesená daňová povinnost', en: 'Reverse charge' },
  'faktura.prenesenaDanPopis': {
    cs: 'reverse charge — daň odvede odběratel, na faktuře nebude DPH',
    en: 'reverse charge — the customer accounts for the tax, the invoice carries no VAT',
  },
  'faktura.mimoPredmetDph': { cs: 'Mimo předmět DPH v ČR', en: 'Outside the scope of Czech VAT' },
  'faktura.mimoPredmetDphPopis': {
    cs: 'místo plnění je ve státě příjemce — třeba prodej do zahraničí',
    en: 'the place of supply is in the country of the recipient — a sale abroad, for instance',
  },

  // --- detail faktury: kurz ČNB ---
  'faktura.kurzCnb': { cs: 'Kurz ČNB', en: 'CNB exchange rate' },
  'faktura.kurz': { cs: '1 {mena} = {kurz} Kč', en: '1 {mena} = {kurz} CZK' },
  'faktura.kurzKeDni': {
    cs: '1 {mena} = {kurz} Kč ke dni {datum}',
    en: '1 {mena} = {kurz} CZK as at {datum}',
  },
  'faktura.nacistKurz': {
    cs: 'Načíst kurz k datu vystavení',
    en: 'Fetch the rate for the issue date',
  },

  // --- detail faktury: položky a součty ---
  'faktura.polozky': { cs: 'Položky', en: 'Items' },
  'faktura.cenyBezDph': { cs: 'Ceny se zadávají bez DPH.', en: 'Prices are entered excluding VAT.' },
  'faktura.popisPolozky': { cs: 'Popis položky', en: 'Item description' },
  'faktura.odebratPolozku': { cs: 'Odebrat položku', en: 'Remove the item' },
  'faktura.pridatPolozku': { cs: 'Přidat položku', en: 'Add an item' },
  'faktura.mnozstvi': { cs: 'Množství', en: 'Quantity' },
  'faktura.jednotka': { cs: 'Jednotka', en: 'Unit' },
  'faktura.cenaZaJednotku': { cs: 'Cena / j.', en: 'Unit price' },
  'faktura.dph': { cs: 'DPH', en: 'VAT' },
  'faktura.celkem': { cs: 'Celkem', en: 'Total' },
  'faktura.mezisoucetBezDph': { cs: 'Mezisoučet bez DPH', en: 'Subtotal excluding VAT' },
  'faktura.zakladBezDph': { cs: 'Základ bez DPH', en: 'Net amount excluding VAT' },
  'faktura.zakladBezDphPoSleve': {
    cs: 'Základ bez DPH po slevě',
    en: 'Net amount excluding VAT after the discount',
  },
  'faktura.dphSazba': { cs: 'DPH {sazba} %', en: 'VAT {sazba}%' },
  'faktura.kUhrade': { cs: 'K úhradě', en: 'Amount due' },
  'faktura.vKorunachKurzem': { cs: 'v korunách kurzem ČNB', en: 'in koruna at the CNB rate' },
  'faktura.poznamkaNaFakture': { cs: 'Poznámka na faktuře', en: 'Note on the invoice' },
  'faktura.nahledTitulek': { cs: 'Náhled faktury', en: 'Invoice preview' },

  // --- výdaje: záložky a součty nad seznamem ---
  'vydaj.zalozkaNezarazene': { cs: 'Nezařazené', en: 'Unfiled' },
  'vydaj.zalozkaNeuhrazene': { cs: 'Neuhrazené', en: 'Unpaid' },
  'vydaj.zalozkaUhrazene': { cs: 'Uhrazené', en: 'Paid' },
  'vydaj.souctyNadpis': { cs: '{zalozka} celkem ({pocet})', en: '{zalozka} total ({pocet})' },
  'vydaj.souctyBezDph': { cs: 'bez DPH {castka}', en: 'excl. VAT {castka}' },
  'vydaj.zbyvaCastka': { cs: 'zbývá {castka}', en: '{castka} outstanding' },
  'vydaj.vsechnyKategorie': { cs: 'Všechny kategorie', en: 'All categories' },

  // --- výdaje: řádky seznamu (skládá je server) ---
  'vydaj.bezNazvu': { cs: 'Bez názvu', en: 'Untitled' },
  'vydaj.podnadpisCislo': { cs: 'č. {cislo}', en: 'no. {cislo}' },
  'vydaj.podnadpisZMailu': { cs: 'z mailu · {odesilatel}', en: 'from email · {odesilatel}' },
  'vydaj.dphZadna': { cs: 'bez DPH', en: 'no VAT' },
  'vydaj.dphSazba': { cs: 'DPH {sazba} %', en: 'VAT {sazba}%' },

  // --- výdaje: tabulka seznamu ---
  'vydaj.sloupecNazev': { cs: 'Název', en: 'Name' },
  'vydaj.sloupecDatum': { cs: 'Datum', en: 'Date' },
  'vydaj.sloupecKategorie': { cs: 'Kategorie', en: 'Category' },
  'vydaj.sloupecSplatnost': { cs: 'Splatnost', en: 'Due date' },
  'vydaj.sloupecBezDph': { cs: 'Bez DPH', en: 'Excl. VAT' },
  'vydaj.sloupecCelkem': { cs: 'Celkem', en: 'Total' },
  'vydaj.sloupecStav': { cs: 'Stav', en: 'Status' },
  'vydaj.sloupecPlatba': { cs: 'Platba', en: 'Payment' },
  'vydaj.stitekPriloha': { cs: 'PŘÍLOHA', en: 'ATTACHMENT' },
  'vydaj.poSplatnosti': { cs: 'po splatnosti', en: 'overdue' },
  'vydaj.stavUhrazeno': { cs: 'Uhrazeno', en: 'Paid' },
  'vydaj.stavCastecne': { cs: 'Částečně', en: 'Partly paid' },
  'vydaj.stavNeuhrazeno': { cs: 'Neuhrazeno', en: 'Unpaid' },
  'vydaj.stavNezarazeno': { cs: 'Nezařazeno', en: 'Unfiled' },
  'vydaj.stavZbyva': { cs: 'Zbývá {castka}', en: '{castka} outstanding' },
  'vydaj.tabulkaPrazdna': { cs: 'Tady zatím nic není.', en: 'Nothing here yet.' },
  'vydaj.hledatPlaceholder': {
    cs: 'Hledat doklad, dodavatele, projekt…',
    en: 'Search documents, suppliers, projects…',
  },
  'vydaj.filtrUhrazene': { cs: 'Uhrazené', en: 'Paid' },
  'vydaj.filtrNeuhrazene': { cs: 'Neuhrazené', en: 'Unpaid' },
  'vydaj.filtrCastecne': { cs: 'Částečně uhrazené', en: 'Partly paid' },
  'vydaj.filtrPoSplatnosti': { cs: 'Po splatnosti', en: 'Overdue' },
  'vydaj.filtrSPrilohou': { cs: 'S přílohou', en: 'With an attachment' },
  'vydaj.filtrBezPrilohy': { cs: 'Bez přílohy', en: 'Without an attachment' },

  // --- výdaje: schránka s doklady (kontrola pošty) ---
  'vydaj.postaZkontrolovat': { cs: 'Zkontrolovat poštu', en: 'Check the mailbox' },
  'vydaj.postaKontroluji': { cs: 'Kontroluji poštu…', en: 'Checking the mailbox…' },
  'vydaj.postaChyba': {
    cs: 'Do schránky se nepodařilo podívat.',
    en: 'The mailbox could not be checked.',
  },
  'vydaj.postaNovychDokladu': { cs: 'Nových dokladů: {pocet}', en: 'New documents: {pocet}' },
  'vydaj.postaPrectenoDokladu': { cs: 'Přečteno dokladů: {pocet}', en: 'Documents read: {pocet}' },
  'vydaj.postaNicNoveho': { cs: 'Nic nového.', en: 'Nothing new.' },
  'vydaj.postaNenastavena': {
    cs: 'Schránka s doklady není nastavená',
    en: 'The document mailbox is not set up',
  },
  'vydaj.postaNenastavenaNapoveda': {
    cs: 'Doplňte IMAP_HOST, IMAP_USER a IMAP_PASSWORD.',
    en: 'Set IMAP_HOST, IMAP_USER and IMAP_PASSWORD.',
  },

  // --- výdaje: kategorie ---
  'vydaj.spravovatKategorie': {
    cs: 'Přidat / spravovat kategorie',
    en: 'Add / manage categories',
  },
  'vydaj.kategorieNadpis': { cs: 'Kategorie výdajů', en: 'Expense categories' },
  'vydaj.kategoriePocetDokladu': { cs: '{pocet} dokladů', en: '{pocet} documents' },
  'vydaj.kategoriiVyradit': { cs: 'Vyřadit', en: 'Remove from the list' },
  'vydaj.kategoriiVratit': { cs: 'Vrátit do nabídky', en: 'Put back in the list' },
  'vydaj.kategoriiSmazatOtazka': {
    cs: 'Opravdu smazat kategorii?',
    en: 'Really delete this category?',
  },
  'vydaj.kategorieJenVyrazena': {
    cs: 'Kategorii „{nazev}" už používá {pocet} dokladů, takže je jen vyřazená z nabídky — u těch dokladů zůstane.',
    en: 'The category "{nazev}" is already used by {pocet} documents, so it has only been removed from the list — it stays on those documents.',
  },
  'vydaj.novaKategorie': { cs: 'Nová kategorie', en: 'New category' },
  'vydaj.novaKategoriePlaceholder': { cs: 'např. Marketing', en: 'e.g. Marketing' },
  'vydaj.pridatKategorii': { cs: '+ Nová kategorie', en: '+ New category' },
  'vydaj.bezKategorie': { cs: '— bez kategorie —', en: '— no category —' },
  'vydaj.kategoriiNelzePridat': {
    cs: 'Kategorii se nepodařilo přidat.',
    en: 'The category could not be added.',
  },
  'vydaj.pridat': { cs: 'Přidat', en: 'Add' },
  'vydaj.ulozeniSelhalo': { cs: 'Uložení se nezdařilo.', en: 'Saving failed.' },

  // --- výdaje: zadání nového dokladu ---
  'vydaj.novyVydaj': { cs: 'Nový výdaj', en: 'New expense' },
  'vydaj.ctuDoklad': { cs: 'Čtu doklad…', en: 'Reading the document…' },
  'vydaj.pridatDalsiPrilohu': { cs: 'Přidat další přílohu', en: 'Add another attachment' },
  'vydaj.vyfotitDoklad': { cs: 'Vyfotit doklad', en: 'Photograph the document' },
  'vydaj.vybratDoklad': { cs: 'Vybrat doklad', en: 'Choose a document' },
  'vydaj.neboVybratSoubor': { cs: 'nebo vybrat soubor / PDF', en: 'or choose a file / PDF' },
  'vydaj.dalsiSouboryJenPrilohy': {
    cs: 'Další soubory se jen přiloží.',
    en: 'Any further files are just attached.',
  },
  'vydaj.vyberSouboruNapoveda': {
    cs: 'Vyberte PDF, sken nebo fotku dokladu (klidně víc souborů) - částku, datum i DPH doplním za vás. Před uložením to zkontrolujte.',
    en: 'Choose a PDF, a scan or a photo of the document (several files are fine) — the amount, the date and the VAT will be filled in for you. Please check them before saving.',
  },
  'vydaj.souborDoklad': { cs: 'Doklad', en: 'Document' },
  'vydaj.souborPriloha': { cs: 'Příloha', en: 'Attachment' },
  'vydaj.odebratSoubor': { cs: 'Odebrat {nazev}', en: 'Remove {nazev}' },
  'vydaj.cteniSouborVelky': {
    cs: 'Soubor je moc velký na přečtení, údaje vyplňte ručně.',
    en: 'The file is too large to read, please fill the details in manually.',
  },
  'vydaj.cteniSelhalo': {
    cs: 'Doklad se nepodařilo přečíst, vyplňte údaje ručně.',
    en: 'The document could not be read, please fill the details in manually.',
  },
  'vydaj.cteniNejiste': {
    cs: 'Doklad šel číst špatně — překontrolujte prosím částku a datum.',
    en: 'The document was hard to read — please check the amount and the date.',
  },
  'vydaj.cteniHotovo': {
    cs: 'Údaje jsou z dokladu — zkontrolujte je a uložte.',
    en: 'The details come from the document — check them and save.',
  },
  'vydaj.ulozitDoklad': { cs: 'Uložit doklad', en: 'Save the document' },
  'vydaj.poUlozeniZpetNaPrehled': {
    cs: 'Po uložení se vrátíte na přehled.',
    en: 'After saving you go back to the list.',
  },
  'vydaj.ulozeniDokladuSelhalo': {
    cs: 'Doklad se nepodařilo uložit.',
    en: 'The document could not be saved.',
  },

  // --- výdaje: políčka formulářů (nový doklad i detail) ---
  'vydaj.poleNazev': { cs: 'Název', en: 'Name' },
  'vydaj.poleNazevPlaceholder': { cs: 'za co to bylo', en: 'what it was for' },
  'vydaj.poleDatumDokladu': { cs: 'Datum dokladu', en: 'Document date' },
  'vydaj.poleSplatnost': { cs: 'Splatnost', en: 'Due date' },
  'vydaj.poleCisloDokladu': { cs: 'Číslo dokladu', en: 'Document number' },
  'vydaj.poleKategorie': { cs: 'Kategorie', en: 'Category' },
  'vydaj.poleProjekt': { cs: 'Projekt', en: 'Project' },
  'vydaj.projektyNenacteny': {
    cs: 'Projekty se z Caflou nenačetly.',
    en: 'Projects could not be loaded from Caflou.',
  },
  'vydaj.poleCastkaBezDph': { cs: 'Částka bez DPH', en: 'Amount excl. VAT' },
  'vydaj.poleCastkaSDph': { cs: 'Částka s DPH', en: 'Amount incl. VAT' },
  'vydaj.prehoditNaBezDph': {
    cs: 'Přepnout na zadávání částky bez DPH',
    en: 'Switch to entering the amount excluding VAT',
  },
  'vydaj.prehoditNaSDph': {
    cs: 'Přepnout na zadávání částky s DPH',
    en: 'Switch to entering the amount including VAT',
  },
  'vydaj.protejsekBezDph': { cs: 'bez DPH {castka}', en: 'excl. VAT {castka}' },
  'vydaj.protejsekSDph': { cs: 's DPH {castka}', en: 'incl. VAT {castka}' },
  'vydaj.poleDph': { cs: 'DPH', en: 'VAT' },
  'vydaj.poleMena': { cs: 'Měna', en: 'Currency' },
  'vydaj.poleHrazeno': { cs: 'Hrazeno', en: 'Paid by' },
  'vydaj.poleDodavatelZFirem': { cs: 'Dodavatel z Firem', en: 'Supplier from Companies' },
  'vydaj.neniVeFirmach': { cs: '— není ve Firmách —', en: '— not in Companies —' },
  'vydaj.poleJmenoDodavatele': { cs: 'Nebo jméno dodavatele', en: 'Or the supplier name' },
  'vydaj.poleJmenoDodavatelePlaceholder': { cs: 'u drobného dokladu', en: 'for a small receipt' },
  'vydaj.polePoznamka': { cs: 'Poznámka', en: 'Note' },
  'vydaj.celkem': { cs: 'Celkem', en: 'Total' },

  // --- výdaje: detail dokladu ---
  'vydaj.zpetNaVydaje': { cs: '← Zpět na výdaje', en: '← Back to expenses' },
  'vydaj.bezCisla': { cs: 'bez čísla', en: 'no number' },
  'vydaj.zaFirmu': { cs: 'za {firma}', en: 'for {firma}' },
  'vydaj.zaraditMeziVydaje': { cs: 'Zařadit mezi výdaje', en: 'File with the expenses' },
  'vydaj.zrusitUhradu': { cs: 'Zrušit úhradu', en: 'Cancel the payment' },
  'vydaj.oznacitUhrazeny': { cs: 'Označit jako uhrazený', en: 'Mark as paid' },
  'vydaj.ulozeno': { cs: 'Uloženo.', en: 'Saved.' },
  'vydaj.zarazeniChybiKategorie': {
    cs: 'Vyberte kategorii — podle ní se doklad zařadí do přehledů.',
    en: 'Choose a category — it decides where the document is filed in the overviews.',
  },
  'vydaj.zarazeniSelhalo': { cs: 'Zařazení se nezdařilo.', en: 'Filing failed.' },
  'vydaj.kurzCnb': {
    cs: 'Kurz ČNB: 1 {mena} = {kurz} Kč ke dni {datum}',
    en: 'CNB rate: 1 {mena} = {kurz} CZK as at {datum}',
  },
  'vydaj.smazatDoklad': { cs: 'Smazat doklad', en: 'Delete the document' },
  'vydaj.smazatDokladOtazka': {
    cs: 'Opravdu smazat doklad?',
    en: 'Really delete this document?',
  },

  // --- výdaje: pás dokladu ze schránky ---
  'vydaj.schrankaPas': {
    cs: 'Doklad z e-mailu · čeká na zařazení',
    en: 'Document from email · waiting to be filed',
  },
  'vydaj.schrankaOd': { cs: 'Od: {odesilatel}', en: 'From: {odesilatel}' },
  'vydaj.schrankaPredmet': { cs: 'Předmět: {predmet}', en: 'Subject: {predmet}' },
  'vydaj.schrankaPrislo': { cs: 'Přišlo {kdy}', en: 'Arrived {kdy}' },
  'vydaj.schrankaCteniChyba': {
    cs: 'Údaje se nepodařilo vyčíst ({chyba}) — vyplňte je prosím ručně.',
    en: 'The details could not be read ({chyba}) — please fill them in manually.',
  },
  'vydaj.schrankaCteniJistota': {
    cs: 'Údaje vyčetl portál z přílohy (jistota {jistota} %) — překontrolujte je.',
    en: 'The portal read the details from the attachment (confidence {jistota}%) — please check them.',
  },
  'vydaj.schrankaCteniHotovo': {
    cs: 'Údaje vyčetl portál z přílohy — překontrolujte je.',
    en: 'The portal read the details from the attachment — please check them.',
  },
  'vydaj.schrankaCteniCeka': {
    cs: 'Údaje se z přílohy ještě nečetly. Zkuste za chvíli obnovit stránku.',
    en: 'The details have not been read from the attachment yet. Try refreshing the page in a moment.',
  },

  // --- výdaje: úhrady na vícekrát ---
  'vydaj.uhradyNadpis': { cs: 'Úhrady', en: 'Payments' },
  'vydaj.uhrazenoCastecne': { cs: 'Uhrazeno částečně', en: 'Partly paid' },
  'vydaj.uhrazeno': { cs: 'Uhrazeno', en: 'Paid' },
  'vydaj.zbyvaDoplatit': { cs: 'Zbývá doplatit', en: 'Outstanding' },
  'vydaj.uhraduZapsal': { cs: 'zapsal {kdo}', en: 'recorded by {kdo}' },
  'vydaj.poleKolikOdeslo': { cs: 'Kolik odešlo', en: 'Amount sent' },
  'vydaj.poleKdy': { cs: 'Kdy', en: 'When' },
  'vydaj.uhradaPoznamkaPlaceholder': {
    cs: 'např. první splátka, zbytek po dodání',
    en: 'e.g. first instalment, the rest on delivery',
  },
  'vydaj.zapsatUhradu': { cs: 'Zapsat úhradu', en: 'Record the payment' },
  'vydaj.doplatitZbytek': { cs: 'Doplatit zbytek ({castka})', en: 'Pay the rest ({castka})' },
  'vydaj.uhradaChybiCastka': {
    cs: 'Zadejte částku, která odešla.',
    en: 'Enter the amount that was sent.',
  },
  'vydaj.uhradaZapisSelhal': {
    cs: 'Úhradu se nepodařilo zapsat.',
    en: 'The payment could not be recorded.',
  },

  // --- výdaje: přílohy dokladu ---
  'vydaj.prilohyNadpis': { cs: 'Přílohy', en: 'Attachments' },
  'vydaj.prilohyZadne': { cs: 'Bez přílohy.', en: 'No attachment.' },
  'vydaj.prilohaJeDoklad': { cs: 'doklad', en: 'document' },
  'vydaj.prilohaOdebrat': { cs: 'Odebrat', en: 'Remove' },
  'vydaj.prilohaOdebratOtazka': {
    cs: 'Opravdu odebrat přílohu?',
    en: 'Really remove this attachment?',
  },
  'vydaj.nahratDoklad': { cs: '+ Nahrát doklad', en: '+ Upload the document' },
  'vydaj.pridatPrilohu': { cs: '+ Přidat přílohu', en: '+ Add an attachment' },
  'vydaj.prilohaNahraniSelhalo': {
    cs: 'Přílohu se nepodařilo nahrát.',
    en: 'The attachment could not be uploaded.',
  },
  'vydaj.prilohaOdebraniSelhalo': {
    cs: 'Přílohu se nepodařilo odebrat.',
    en: 'The attachment could not be removed.',
  },

  // --- výdaje: náhled přílohy vedle formuláře ---
  'vydaj.nahledPriloha': { cs: 'Příloha', en: 'Attachment' },
  'vydaj.nahledSelhal': {
    cs: 'Náhled se nepodařilo načíst.',
    en: 'The preview could not be loaded.',
  },
  'vydaj.nahledNepodporovanyTyp': {
    cs: 'Tenhle typ souboru se v prohlížeči nezobrazí.',
    en: 'This file type cannot be shown in the browser.',
  },
  'vydaj.nahledOtevritVNovemOkne': { cs: 'Otevřít v novém okně', en: 'Open in a new window' },
  'vydaj.nahledPopisObrazku': { cs: 'Příloha dokladu', en: 'Document attachment' },

  // --- výdaje: dodatečná faktura ke smlouvě ---
  'vydaj.fakturaKeSmlouveNadpis': { cs: 'Faktura ke smlouvě', en: 'Invoice for the contract' },
  'vydaj.zeSmlouvy': { cs: 'ze smlouvy {cislo}', en: 'from contract {cislo}' },
  'vydaj.fakturaCislo': { cs: 'Faktura {cislo}', en: 'Invoice {cislo}' },
  'vydaj.fakturaPripojena': { cs: 'Faktura připojena', en: 'Invoice attached' },
  'vydaj.platiSe': { cs: 'Platí se {castka}', en: '{castka} is payable' },
  'vydaj.platiSeRozpis': {
    cs: '({castka} bez DPH + {sazba} %)',
    en: '({castka} excl. VAT + {sazba}%)',
  },
  'vydaj.platiSeRozpisBezDph': {
    cs: '({castka} bez DPH · bez DPH)',
    en: '({castka} excl. VAT · no VAT)',
  },
  'vydaj.odebratZnacku': { cs: 'Odebrat značku', en: 'Remove the marker' },
  'vydaj.fakturaOdebratOtazka': {
    cs: 'Odebrat značku faktury? Přílohy ani částka se nevrací.',
    en: 'Remove the invoice marker? The attachments and the amount are not reverted.',
  },
  'vydaj.znackaZruseniSelhalo': {
    cs: 'Značku se nepodařilo zrušit.',
    en: 'The marker could not be removed.',
  },
  'vydaj.fakturaVysvetleni': {
    cs: 'Plátce DPH pošle ke smlouvě ještě fakturu — na smlouvě je částka bez DPH, platí se ta z faktury. Připojte ji sem: náklad zůstane {jeden}, jen bude mít dvě přílohy a částku s DPH.',
    en: 'A VAT-registered supplier sends an invoice on top of the contract — the contract carries the amount excluding VAT, but the invoice amount is what gets paid. Attach it here: there will still be {jeden} expense, it will just have two attachments and the amount including VAT.',
  },
  'vydaj.fakturaVysvetleniJeden': { cs: 'jeden', en: 'one' },
  'vydaj.fakturaJizVPortalu': {
    cs: 'Faktura už je v portálu',
    en: 'The invoice is already in the portal',
  },
  'vydaj.vyberteDoklad': { cs: '— vyberte doklad —', en: '— choose a document —' },
  'vydaj.spojitSeSmlouvou': { cs: 'Spojit se smlouvou', en: 'Link to the contract' },
  'vydaj.spojeniSelhalo': {
    cs: 'Doklady se nepodařilo spojit.',
    en: 'The documents could not be linked.',
  },
  'vydaj.neboFakturuNahrajte': { cs: '…nebo fakturu nahrajte', en: '…or upload the invoice' },
  'vydaj.poleCisloFaktury': { cs: 'Číslo faktury', en: 'Invoice number' },
  'vydaj.poleSazbaDph': { cs: 'Sazba DPH', en: 'VAT rate' },
  'vydaj.pripojitFakturu': { cs: 'Připojit fakturu', en: 'Attach the invoice' },
  'vydaj.pripojuji': { cs: 'Připojuji…', en: 'Attaching…' },
  'vydaj.fakturaChybiUdaje': {
    cs: 'Vyberte fakturu nebo vyplňte částku.',
    en: 'Choose an invoice or enter an amount.',
  },
  'vydaj.fakturaPripojeniSelhalo': {
    cs: 'Fakturu se nepodařilo připojit.',
    en: 'The invoice could not be attached.',
  },

  // --- smlouvy: přehled a záložky ---
  'smlouva.zalozkaRozpracovane': { cs: 'Rozpracované', en: 'Drafts' },
  'smlouva.zalozkaKPodpisu': { cs: 'Čekají na podpis', en: 'Awaiting signature' },
  'smlouva.zalozkaPodepsane': { cs: 'Podepsané', en: 'Signed' },
  'smlouva.zalozkaOstatni': { cs: 'Odmítnuté a zrušené', en: 'Declined and cancelled' },
  'smlouva.sablonySmluv': { cs: 'Šablony smluv', en: 'Contract templates' },
  'smlouva.zpetNaSmlouvy': { cs: 'Zpět na smlouvy', en: 'Back to contracts' },

  // --- stavy smlouvy (pilulka v přehledu i v detailu) ---
  'smlouva.stavRozpracovana': { cs: 'Rozpracovaná', en: 'Draft' },
  'smlouva.stavCekaNaPodpis': { cs: 'Čeká na podpis', en: 'Awaiting signature' },
  'smlouva.stavPodepsana': { cs: 'Podepsaná', en: 'Signed' },
  'smlouva.stavOdmitnuta': { cs: 'Odmítnutá', en: 'Declined' },
  'smlouva.stavZrusena': { cs: 'Zrušená', en: 'Cancelled' },

  // --- tabulka smluv ---
  'smlouva.sloupecNazev': { cs: 'Název', en: 'Name' },
  'smlouva.sloupecPodepisujici': { cs: 'Podepisující', en: 'Signatory' },
  'smlouva.sloupecVytvoreno': { cs: 'Vytvořeno', en: 'Created' },
  'smlouva.sloupecPodpisy': { cs: 'Podpisy', en: 'Signatures' },
  'smlouva.sloupecStav': { cs: 'Stav', en: 'Status' },
  'smlouva.sloupecProjekt': { cs: 'Projekt', en: 'Project' },
  'smlouva.protistranaKratce': { cs: 'protistrana', en: 'counterparty' },
  'smlouva.tabulkaPrazdna': { cs: 'Tady zatím nic není.', en: 'Nothing here yet.' },
  'smlouva.hledatPlaceholder': {
    cs: 'Hledat smlouvu, herce, projekt…',
    en: 'Search for a contract, a narrator or a project…',
  },
  'smlouva.vybratRadek': { cs: 'Vybrat smlouvu {nazev}', en: 'Select contract {nazev}' },
  'smlouva.hromadneMazaniPoznamka': {
    cs: 'Smazání je nevratné — smlouva zmizí i s podpisy. Podepsanou smlouvu portál smazat nedovolí.',
    en: 'Deleting cannot be undone — the contract goes, signatures and all. The portal will not delete a signed contract.',
  },

  // --- nová smlouva: formulář ---
  'smlouva.novaSmlouva': { cs: 'Nová smlouva', en: 'New contract' },
  'smlouva.nazevSmlouvy': { cs: 'Název smlouvy', en: 'Contract name' },
  'smlouva.nazevSeSloziSam': {
    cs: 'Vyberte projekt a herce — název se složí sám',
    en: 'Choose a project and a narrator — the name puts itself together',
  },
  'smlouva.herec': { cs: 'Herec', en: 'Narrator' },
  'smlouva.herecZProjektu': { cs: 'Herec z projektu', en: 'Narrator on the project' },
  'smlouva.projektBezHerce': { cs: '— projekt nemá herce —', en: '— the project has no narrator —' },
  'smlouva.doplnteHerce': {
    cs: 'Doplňte herce u projektu a smlouva si z jeho karty vezme jméno, adresu i RČ nebo IČ. Odměnu si pak vezme z položky rozpočtu, která na něj sedí.',
    en: 'Add a narrator to the project and the contract will take their name, address and birth or company number from their record. The fee then comes from the budget line that matches them.',
  },
  'smlouva.nevybiratRucne': { cs: '— nevybírat, vyplním ručně —', en: '— do not choose, I will fill it in —' },
  'smlouva.bezRcIc': { cs: 'bez RČ a IČ', en: 'no birth or company number' },
  'smlouva.herecUdajeSAdresou': {
    cs: 'Do smlouvy půjde {identifikace} a adresa z jeho karty.',
    en: 'The contract will use {identifikace} and the address from their record.',
  },
  'smlouva.herecUdajeBezAdresy': {
    cs: 'Do smlouvy půjde {identifikace}. Adresu na kartě nemá — doplní se „…".',
    en: 'The contract will use {identifikace}. Their record has no address, so “…” goes in instead.',
  },
  'smlouva.herecBezUdajuSAdresou': {
    cs: 'Na kartě nemá RČ ani IČ — ve smlouvě bude „…", adresa z jeho karty se doplní.',
    en: 'Their record has no birth or company number — the contract will show “…”, but the address from their record goes in.',
  },
  'smlouva.herecBezUdaju': {
    cs: 'Na kartě nemá RČ ani IČ — ve smlouvě bude „…" a dopíšete to v textu.',
    en: 'Their record has no birth or company number — the contract will show “…” and you fill it in in the text.',
  },
  'smlouva.herecUdajeZKarty': {
    cs: 'Adresu i RČ nebo IČ si portál vezme z karty herce.',
    en: 'The portal takes the address and the birth or company number from the narrator’s record.',
  },
  'smlouva.odmenaZRozpoctu': { cs: 'Odměna je z rozpočtu projektu.', en: 'The fee comes from the project budget.' },
  'smlouva.herecZRozpoctu': {
    cs: 'U projektu navázaný není — portál ho poznal v rozpočtu.',
    en: 'They are not linked to the project — the portal spotted them in the budget.',
  },
  'smlouva.sablona': { cs: 'Šablona', en: 'Template' },
  'smlouva.prazdnaSmlouva': { cs: '— prázdná smlouva —', en: '— empty contract —' },
  'smlouva.zaNasiFirmu': { cs: 'Za naši firmu', en: 'On behalf of our company' },
  'smlouva.dodavatel': { cs: 'Dodavatel', en: 'Supplier' },
  'smlouva.protistranaFirma': { cs: 'Protistrana (firma)', en: 'Counterparty (company)' },
  'smlouva.vyberteDodavatele': { cs: '— vyberte dodavatele —', en: '— choose a supplier —' },
  'smlouva.bezFirmy': { cs: '— bez firmy (herec) —', en: '— no company (narrator) —' },
  'smlouva.zadnyDodavatel': {
    cs: 'Mezi firmami zatím není žádný dodavatel. Herce, který dodává i jako firma, přenesete do dodavatelů tlačítkem na jeho kartě.',
    en: 'There is no supplier among the companies yet. A narrator who also supplies as a company is moved into suppliers with the button on their record.',
  },
  'smlouva.udajeDodavatele': {
    cs: 'IČ, DIČ i adresu si smlouva vezme z karty dodavatele. Herec, který dodává i jako firma, se sem dostane tlačítkem „Přenést do dodavatelů" na své kartě.',
    en: 'The contract takes the company number, the VAT number and the address from the supplier’s record. A narrator who also supplies as a company gets here with the “Move to suppliers” button on their record.',
  },
  'smlouva.kdoPodepisuje': { cs: 'Kdo podepisuje', en: 'Who signs' },
  'smlouva.vyberteHerce': { cs: '— vyberte herce —', en: '— choose a narrator —' },
  'smlouva.napisuRucne': { cs: '— napíšu ručně —', en: '— I will type it in —' },
  'smlouva.jmenoAPrijmeni': { cs: 'Jméno a příjmení', en: 'Full name' },
  'smlouva.vybratZeSeznamu': { cs: 'Vybrat herce ze seznamu', en: 'Choose a narrator from the list' },
  'smlouva.emailPodepisujiciho': { cs: 'E-mail podepisujícího', en: 'Signatory’s email' },
  'smlouva.emailPlaceholder': {
    cs: 'na tenhle e-mail půjde odkaz k podpisu',
    en: 'the signing link goes to this email',
  },
  'smlouva.rucniPoleUvod': {
    cs: 'Co portál neví — doplní se rovnou do textu smlouvy. Co necháte prázdné, se ve smlouvě buď vynechá (když stojí ve výčtu), nebo zůstane jako „…" a dopíšete to v editoru.',
    en: 'What the portal does not know — it goes straight into the contract text. Anything you leave empty is either left out of the contract (where it sits in a list) or stays as “…” for you to fill in in the editor.',
  },
  'smlouva.vyberteZNakladu': { cs: '— vyberte z nákladů projektu —', en: '— choose from the project costs —' },
  'smlouva.polozkaBezNazvu': { cs: 'Bez názvu', en: 'Untitled' },
  'smlouva.odmenaBezDph': {
    cs: 'Do smlouvy půjde {castka} bez DPH.',
    en: '{castka} excluding VAT goes into the contract.',
  },
  'smlouva.terminZOdevzdani': {
    cs: 'Předvyplněno z data odevzdání projektu.',
    en: 'Pre-filled from the project delivery date.',
  },
  'smlouva.terminRucne': {
    cs: 'Projekt nemá datum odevzdání — vyplňte termín ručně.',
    en: 'The project has no delivery date — fill the date in yourself.',
  },
  'smlouva.terminAudiokniha': { cs: 'Termín dokončení natáčení', en: 'Recording completion date' },
  'smlouva.terminReklama': { cs: 'Termín pořízení záznamu', en: 'Recording date' },
  'smlouva.terminDilo': { cs: 'Termín odevzdání díla', en: 'Delivery date for the work' },
  'smlouva.zakladam': { cs: 'Zakládám…', en: 'Creating…' },
  'smlouva.zalozitAUpravit': { cs: 'Založit a upravit text', en: 'Create and edit the text' },
  'smlouva.chybiProjektDodavatel': {
    cs: 'Vyberte projekt a dodavatele — z nich se skládá název smlouvy.',
    en: 'Choose a project and a supplier — the contract name is made from them.',
  },
  'smlouva.chybiProjektHerec': {
    cs: 'Vyberte projekt a herce — z nich se skládá název smlouvy.',
    en: 'Choose a project and a narrator — the contract name is made from them.',
  },
  'smlouva.zalozeniSelhalo': { cs: 'Smlouvu se nepodařilo založit.', en: 'The contract could not be created.' },

  // --- nápověda k ručním polím ---
  // Ukázky zůstávají české schválně: to, co se do pole napíše, jde do českého
  // textu smlouvy, ne na obrazovku.
  'smlouva.napovedaOdmena': { cs: 'např. 5 000 Kč', en: 'e.g. 5 000 Kč' },
  'smlouva.napovedaTermin': { cs: 'např. 20. 9. 2026', en: 'e.g. 20. 9. 2026' },
  'smlouva.napovedaSplatnost': { cs: 'např. 30', en: 'e.g. 30' },
  'smlouva.napovedaRozsahDila': {
    cs: 'co se dělá — překlad, úprava dialogů, dramaturgie…',
    en: 'what is being done — translation, dialogue editing, script editing…',
  },
  'smlouva.napovedaUziti': {
    cs: 'např. audio reklama na Spotify, CZ+SK',
    en: 'e.g. audio advert on Spotify, CZ+SK',
  },
  'smlouva.napovedaDobaLicence': { cs: 'např. jednoho (1) roku', en: 'e.g. jednoho (1) roku' },

  // --- pole šablony ({{…}}), popisky v editoru i v bublině ---
  'smlouva.pole.cislo_smlouvy': { cs: 'Číslo smlouvy', en: 'Contract number' },
  'smlouva.pole.nase_firma': { cs: 'Naše firma (název)', en: 'Our company (name)' },
  'smlouva.pole.nase_ic': { cs: 'Naše IČ', en: 'Our company number' },
  'smlouva.pole.nase_dic': { cs: 'Naše DIČ', en: 'Our VAT number' },
  'smlouva.pole.nase_adresa': { cs: 'Naše adresa', en: 'Our address' },
  'smlouva.pole.nas_email': { cs: 'Náš e-mail (účtárna)', en: 'Our email (accounts)' },
  'smlouva.pole.protistrana': { cs: 'Protistrana (jméno nebo firma)', en: 'Counterparty (name or company)' },
  'smlouva.pole.protistrana_ic': { cs: 'IČ protistrany', en: 'Counterparty’s company number' },
  'smlouva.pole.protistrana_dic': { cs: 'DIČ protistrany', en: 'Counterparty’s VAT number' },
  'smlouva.pole.protistrana_adresa': { cs: 'Adresa protistrany', en: 'Counterparty’s address' },
  'smlouva.pole.protistrana_identifikace': {
    cs: 'RČ nebo IČ protistrany',
    en: 'Counterparty’s birth or company number',
  },
  'smlouva.pole.podepisujici': { cs: 'Jméno podepisujícího', en: 'Signatory’s name' },
  'smlouva.pole.email': { cs: 'E-mail podepisujícího', en: 'Signatory’s email' },
  'smlouva.pole.projekt': { cs: 'Název projektu', en: 'Project name' },
  'smlouva.pole.misto': {
    cs: 'Místo natáčení (z lokace herce)',
    en: 'Recording location (from the narrator’s location)',
  },
  'smlouva.pole.nazev_dila': { cs: 'Název díla (z projektu)', en: 'Title of the work (from the project)' },
  'smlouva.pole.datum': { cs: 'Dnešní datum', en: 'Today’s date' },
  'smlouva.pole.odmena': { cs: 'Odměna / cena', en: 'Fee / price' },
  'smlouva.pole.termin': { cs: 'Termín předání / natáčení', en: 'Delivery / recording date' },
  'smlouva.pole.splatnost': { cs: 'Splatnost ve dnech', en: 'Payment terms in days' },
  'smlouva.pole.rozsah_dila': { cs: 'Rozsah díla (co se dělá)', en: 'Scope of the work (what is being done)' },
  'smlouva.pole.uziti': { cs: 'Účel a území užití (reklama)', en: 'Purpose and territory of use (advert)' },
  'smlouva.pole.doba_licence': { cs: 'Doba licence (reklama)', en: 'Licence period (advert)' },

  // --- detail smlouvy: hlavička a akce ---
  'smlouva.odeslanoKdy': { cs: 'Odesláno {kdy}', en: 'Sent {kdy}' },
  'smlouva.uzavrenoKdy': { cs: 'Uzavřeno {kdy}', en: 'Completed {kdy}' },
  'smlouva.odmitnutoKdy': {
    cs: 'Protistrana podpis odmítla {kdy}.',
    en: 'The counterparty declined to sign on {kdy}.',
  },
  'smlouva.odmitnutoKdyDuvod': {
    cs: 'Protistrana podpis odmítla {kdy} — „{duvod}"',
    en: 'The counterparty declined to sign on {kdy} — “{duvod}”',
  },
  'smlouva.ulozit': { cs: 'Uložit', en: 'Save' },
  'smlouva.zavritPodpis': { cs: 'Zavřít podpis', en: 'Close the signature' },
  'smlouva.podepsatZaNas': { cs: 'Podepsat za Mediaspace', en: 'Sign for Mediaspace' },
  'smlouva.poslatZnovu': { cs: 'Poslat znovu', en: 'Send again' },
  'smlouva.poslatKPodpisu': { cs: 'Odeslat k podpisu', en: 'Send for signature' },
  'smlouva.stahnoutPdf': { cs: 'Stáhnout PDF', en: 'Download the PDF' },
  'smlouva.zrusitSmlouvu': { cs: 'Zrušit smlouvu', en: 'Withdraw the contract' },
  'smlouva.opravduSmazat': { cs: 'Opravdu smazat smlouvu?', en: 'Delete this contract?' },
  'smlouva.odkazKPodpisu': { cs: 'Odkaz k podpisu', en: 'Signing link' },
  'smlouva.kopirovat': { cs: 'Kopírovat', en: 'Copy' },
  'smlouva.zkopirovano': { cs: 'Zkopírováno', en: 'Copied' },
  'smlouva.podpisZaNas': { cs: 'Podpis za Mediaspace', en: 'Signature for Mediaspace' },
  'smlouva.ukladam': { cs: 'Ukládám…', en: 'Saving…' },
  'smlouva.podepsat': { cs: 'Podepsat', en: 'Sign' },

  // --- detail smlouvy: údaje a text ---
  'smlouva.udaje': { cs: 'Údaje', en: 'Details' },
  'smlouva.textSmlouvy': { cs: 'Text smlouvy', en: 'Contract text' },
  'smlouva.textSmlouvyPlaceholder': { cs: 'Text smlouvy…', en: 'Contract text…' },
  'smlouva.zmenaTextuZrusiPodpisy': {
    cs: 'Uložení změněného textu zruší už pořízené podpisy — podepisovalo se jiné znění.',
    en: 'Saving the changed text voids the signatures already collected — they were given on different wording.',
  },
  'smlouva.nahledProtistrany': {
    cs: 'Takhle smlouvu uvidí protistrana',
    en: 'This is how the counterparty sees the contract',
  },
  'smlouva.bezTextu': { cs: 'Smlouva zatím nemá žádný text.', en: 'The contract has no text yet.' },

  // --- detail smlouvy: hlášky ---
  'smlouva.ulozeno': { cs: 'Uloženo.', en: 'Saved.' },
  'smlouva.ulozeniSelhalo': { cs: 'Uložení se nezdařilo.', en: 'Saving failed.' },
  'smlouva.nejdrivSePodepiste': { cs: 'Nejdřív se podepište do rámečku.', en: 'Sign in the box first.' },
  'smlouva.podpisSelhal': { cs: 'Podpis se nepodařilo uložit.', en: 'The signature could not be saved.' },
  'smlouva.podepsanoZaNas': { cs: 'Podepsáno za Mediaspace.', en: 'Signed for Mediaspace.' },
  'smlouva.odeslaniSelhalo': { cs: 'Odeslání se nezdařilo.', en: 'Sending failed.' },
  'smlouva.odkazOdeslan': {
    cs: 'Odkaz k podpisu odešel na {email}.',
    en: 'The signing link has gone to {email}.',
  },
  'smlouva.zruseniSelhalo': { cs: 'Zrušení se nezdařilo.', en: 'The contract could not be withdrawn.' },
  'smlouva.smazaniSelhalo': { cs: 'Smazání se nezdařilo.', en: 'Deleting failed.' },

  // --- list smlouvy (ContractPaper): obal dokumentu, ne jeho text ---
  'smlouva.papirNadpis': { cs: 'Smlouva {cislo}', en: 'Contract {cislo}' },
  'smlouva.papirPodpisAlt': { cs: 'Podpis: {jmeno}', en: 'Signature: {jmeno}' },
  'smlouva.papirNepodepsano': { cs: 'zatím nepodepsáno', en: 'not signed yet' },
  'smlouva.papirPodepsanoKdy': { cs: 'Podepsáno {kdy}', en: 'Signed {kdy}' },
  'smlouva.papirIp': { cs: 'IP {ip}', en: 'IP {ip}' },
  'smlouva.papirOtisk': { cs: 'Otisk dokumentu {otisk}', en: 'Document hash {otisk}' },
  'smlouva.papirTextZmenen': {
    cs: 'Pozor: text smlouvy se od tohoto podpisu změnil.',
    en: 'Careful: the contract text has changed since this signature.',
  },

  // --- podpis: výběr způsobu a plátno ---
  'smlouva.podpisJmenem': { cs: 'Podepsat jménem', en: 'Sign with your name' },
  'smlouva.podpisNakreslit': { cs: 'Nakreslit podpis', en: 'Draw your signature' },
  'smlouva.podpisZeJmenaHotovy': {
    cs: 'Podpis se vytvoří z vašeho jména výš. Když jméno upravíte, podpis se přepíše.',
    en: 'The signature is made from your name above. Change the name and the signature is redrawn.',
  },
  'smlouva.podpisZeJmenaChybi': {
    cs: 'Vyplňte výš své jméno — podpis se z něj vytvoří sám.',
    en: 'Fill in your name above — the signature is made from it.',
  },
  'smlouva.platnoVyzva': {
    cs: 'Podepište se sem myší nebo prstem',
    en: 'Sign here with your mouse or your finger',
  },
  'smlouva.platnoDolozka': {
    cs: 'Podpis se uloží k dokumentu spolu s časem, IP adresou a otiskem textu.',
    en: 'The signature is saved with the document, together with the time, the IP address and the hash of the text.',
  },
  'smlouva.platnoVymazat': { cs: 'Vymazat', en: 'Clear' },

  // --- šablony smluv ---
  'smlouva.novaSablona': { cs: 'Nová šablona', en: 'New template' },
  'smlouva.nazev': { cs: 'Název', en: 'Name' },
  'smlouva.pridat': { cs: 'Přidat', en: 'Add' },
  'smlouva.poleDoplniSeSamo': { cs: 'Doplní se samo', en: 'Filled in automatically' },
  'smlouva.poleDopiseSeVeSmlouve': {
    cs: 'Dopíše se ve smlouvě (portál je nezná)',
    en: 'Filled in on the contract (the portal does not know these)',
  },
  'smlouva.zadneSablony': { cs: 'Zatím žádné šablony.', en: 'No templates yet.' },
  'smlouva.nazevSablony': { cs: 'Název šablony', en: 'Template name' },
  'smlouva.ulozitSablonu': { cs: 'Uložit šablonu', en: 'Save the template' },
  'smlouva.sablonaUlozena': { cs: 'Šablona uložena.', en: 'Template saved.' },
  'smlouva.vyraditZNabidky': { cs: 'Vyřadit z nabídky', en: 'Remove from the list' },
  'smlouva.vratitDoNabidky': { cs: 'Vrátit do nabídky', en: 'Put back in the list' },
  'smlouva.opravduSmazatSablonu': { cs: 'Opravdu smazat šablonu?', en: 'Delete this template?' },

  // --- doklady (sekce, záložky, sdílené komponenty) ---
  'doklady.nadpis': { cs: 'Doklady', en: 'Documents' },
  'doklady.zalozkaNabidky': { cs: 'Nabídky', en: 'Quotes' },
  'doklady.zalozkaFaktury': { cs: 'Faktury', en: 'Invoices' },
  'doklady.zalozkaUpominky': { cs: 'Upomínky', en: 'Reminders' },
  'doklady.zalozkaVydaje': { cs: 'Výdaje', en: 'Expenses' },
  'doklady.zalozkaSmlouvy': { cs: 'Smlouvy', en: 'Contracts' },
  'doklady.zalozkaMojeFirmy': { cs: 'Moje firmy', en: 'My companies' },
  'doklady.zalozkaBanka': { cs: 'Banka', en: 'Bank' },

  // --- doklady: živý náhled dokladu ---
  'doklady.nahled': { cs: 'Náhled', en: 'Preview' },
  'doklady.nahledPrekresluji': { cs: 'Překresluji…', en: 'Redrawing…' },
  'doklady.stahnoutPdf': { cs: 'Stáhnout PDF', en: 'Download PDF' },
  'doklady.nahledZive': {
    cs: 'Mění se s tím, co píšete. Nikam se neukládá.',
    en: 'It changes as you type. Nothing is saved.',
  },
  'doklady.nahledChyba': { cs: 'Náhled se nepodařilo vyrobit.', en: 'The preview could not be produced.' },

  // --- doklady: výběr projektu ---
  'doklady.bezProjektu': { cs: '— bez projektu —', en: '— no project —' },
  'doklady.projektCislo': { cs: 'Projekt {id}', en: 'Project {id}' },
  'doklady.projektUkonceny': { cs: '{nazev} (ukončený)', en: '{nazev} (finished)' },
  'doklady.zobrazitUkoncene': {
    cs: '+ Zobrazit i ukončené projekty…',
    en: '+ Show finished projects as well…',
  },

  // --- doklady: výběr odběratele ---
  'doklady.najitOdberatele': {
    cs: 'Najít odběratele — začněte psát',
    en: 'Find a customer — start typing',
  },
  'doklady.vybratJinouFirmu': { cs: 'Vybrat jinou firmu', en: 'Choose a different company' },
  'doklady.odebratOdberatele': { cs: 'Odebrat odběratele', en: 'Remove the customer' },
  'doklady.zadnaFirma': { cs: 'Zatím tu není žádná firma.', en: 'There is no company here yet.' },
  'doklady.zadnaFirmaNeodpovida': { cs: 'Žádná firma tomu neodpovídá.', en: 'No company matches that.' },
  'doklady.icFirmy': { cs: 'IČ {ic}', en: 'Reg. no. {ic}' },

  // --- doklady: sleva ---
  'doklady.sleva': { cs: 'Sleva', en: 'Discount' },
  'doklady.slevaPopis': { cs: 'Sleva · {popis}', en: 'Discount · {popis}' },
  'doklady.slevaProcenta': { cs: 'Sleva ({procenta} %)', en: 'Discount ({procenta}%)' },
  'doklady.slevaPopisProcenta': {
    cs: 'Sleva · {popis} ({procenta} %)',
    en: 'Discount · {popis} ({procenta}%)',
  },
  'doklady.bezSlevy': { cs: 'Bez slevy', en: 'No discount' },
  'doklady.slevaVProcentech': { cs: 'Sleva v procentech', en: 'Percentage discount' },
  'doklady.slevaPevnouCastkou': { cs: 'Sleva pevnou částkou', en: 'Fixed-amount discount' },
  'doklady.slevaPopisPlaceholder': {
    cs: 'Za co sleva je (nepovinné) — vytiskne se na dokladu',
    en: 'What the discount is for (optional) — it is printed on the document',
  },

  // --- doklady: stažení příloh za měsíc ---
  'doklady.stahnoutPrilohy': { cs: 'Stáhnout přílohy', en: 'Download attachments' },
  'doklady.stahnoutFaktury': { cs: 'Stáhnout faktury', en: 'Download invoices' },
  'doklady.pripravuji': { cs: 'Připravuji…', en: 'Preparing…' },
  'doklady.mesicRozdelany': { cs: '{mesic} (rozdělaný)', en: '{mesic} (in progress)' },
  // Měsíc patří ke stahování balíku, ne k seznamu dokladů (29. 9. 2026).
  'doklady.zaMesic': { cs: 'za', en: 'for' },
  'doklady.mesicJenProStazeni': {
    cs: 'Měsíc platí jen pro stažení balíku — seznam níž se jím nefiltruje.',
    en: 'The month applies to the download only — the list below is not filtered by it.',
  },
  'doklady.zadnaPrilohaZaMesic': {
    cs: 'Za ten měsíc není u výdajů žádná příloha.',
    en: 'There is no expense attachment for that month.',
  },
  'doklady.zadnaFakturaZaMesic': {
    cs: 'Za ten měsíc není vystavená žádná faktura.',
    en: 'No invoice was issued for that month.',
  },
  'doklady.stahujiSouboru': { cs: 'Stahuji {pocet} souborů.', en: 'Downloading {pocet} files.' },
  'doklady.stahujiBezPrilohyJeden': {
    cs: 'Stahuji {pocet} souborů. {bez} doklad přílohu nemá.',
    en: 'Downloading {pocet} files. {bez} document has no attachment.',
  },
  'doklady.stahujiBezPrilohyMalo': {
    cs: 'Stahuji {pocet} souborů. {bez} doklady přílohu nemají.',
    en: 'Downloading {pocet} files. {bez} documents have no attachment.',
  },
  'doklady.stahujiBezPrilohyVice': {
    cs: 'Stahuji {pocet} souborů. {bez} dokladů přílohu nemá.',
    en: 'Downloading {pocet} files. {bez} documents have no attachment.',
  },
  'doklady.stazeniSelhalo': { cs: 'Stažení se nepodařilo.', en: 'The download failed.' },

  // --- banka ---
  'banka.napojeneUcty': { cs: 'Napojené účty', en: 'Connected accounts' },
  'banka.stahnoutPohyby': { cs: 'Stáhnout pohyby', en: 'Download transactions' },
  'banka.stahuju': { cs: 'Stahuju…', en: 'Downloading…' },
  'banka.napojitUcet': { cs: 'Napojit účet', en: 'Connect an account' },
  'banka.pripravuju': { cs: 'Připravuju…', en: 'Preparing…' },
  'banka.odpojit': { cs: 'Odpojit', en: 'Disconnect' },
  'banka.opravduOdpojit': { cs: 'Opravdu odpojit účet?', en: 'Really disconnect the account?' },
  'banka.zadnyUcet': {
    cs: 'Zatím tu žádný účet není. Stáhni si v internetovém bankovnictví výpis ve formátu ABO (GPC) a dej „Nahrát výpis" — účet se založí sám a pohyby se rovnou spárují s fakturami.',
    en: 'There is no account here yet. Download a statement in ABO (GPC) format from your internet banking and use "Upload statement" — the account is created automatically and the transactions are matched against invoices right away.',
  },
  'banka.souhlasPlatiDo': { cs: 'souhlas platí do {datum}', en: 'authorisation valid until {datum}' },
  'banka.souhlasCeka': {
    cs: 'souhlas ještě není potvrzený v bance',
    en: 'authorisation not yet confirmed at the bank',
  },
  'banka.souhlasVyprsel': {
    cs: 'souhlas vypršel — napoj účet znovu',
    en: 'authorisation has expired — connect the account again',
  },
  'banka.naposledyStazeno': { cs: 'naposledy staženo {kdy}', en: 'last downloaded {kdy}' },
  'banka.souhlasKonci': {
    cs: 'Souhlas končí za {dnu} dnů. Klikni na „Napojit účet" a potvrď ho v bance znovu, jinak se pohyby přestanou stahovat.',
    en: 'The authorisation ends in {dnu} days. Click "Connect an account" and confirm it at the bank again, otherwise transactions will stop downloading.',
  },
  'banka.posledniStazeni': { cs: 'Poslední stažení: {chyba}', en: 'Last download: {chyba}' },
  'banka.vidiKazdyNadpis': {
    cs: 'Tuhle sekci zatím vidí každé Žůžo-labůžo.',
    en: 'Every Admin can see this section for now.',
  },
  'banka.vidiKazdyPopis': {
    cs: 'V Adminu ▸ Uživatelé zaškrtni „Vidí sekci Banka" těm, kdo na pohyby mají vidět. Jakmile to bude mít aspoň jeden účet, ostatním záložka zmizí.',
    en: 'In Admin ▸ Users, tick "Can see the Bank section" for the people who should see the transactions. As soon as at least one account has it, the tab disappears for everyone else.',
  },
  'banka.nenastavenoNadpis': {
    cs: 'Automatické stahování z banky není nastavené — nahrávání výpisu funguje i bez něj.',
    en: 'Automatic downloads from the bank are not set up — uploading a statement works without them.',
  },
  // {kod1} a {kod2} se vykreslí jako <code> s názvem proměnné - viz sKody() v BankaKlient.tsx.
  'banka.nenastavenoPopis': {
    cs: 'Stahování přes GoCardless Bank Account Data čeká na klíče {kod1} a {kod2} na Vercelu. GoCardless ale od roku 2026 nové zákazníky nebere, takže tohle zůstává jen pro případ, že bychom klíče někdy měli — běžná cesta je nahrát výpis.',
    en: 'Downloading through GoCardless Bank Account Data is waiting for the {kod1} and {kod2} keys on Vercel. GoCardless stopped taking new customers in 2026, though, so this stays only in case we ever get the keys — the normal route is to upload a statement.',
  },
  'banka.napojenoStazeno': {
    cs: 'Účet je napojený. Staženo {nove} pohybů, spárováno {sparovano}.',
    en: 'The account is connected. {nove} transactions downloaded, {sparovano} matched.',
  },
  'banka.napojenoBezStazeni': {
    cs: 'Účet je napojený, stažení pohybů ale zatím neproběhlo.',
    en: 'The account is connected, but no transactions have been downloaded yet.',
  },
  'banka.napojeniSelhalo': { cs: 'Napojení se nepodařilo.', en: 'Connecting the account failed.' },
  'banka.stazeniSelhalo': { cs: 'Stažení se nepodařilo.', en: 'The download failed.' },
  'banka.stazenoHlaska': {
    cs: 'Staženo {nove} nových pohybů, spárováno {sparovano}, ke schválení {navrhy}.',
    en: '{nove} new transactions downloaded, {sparovano} matched, {navrhy} awaiting approval.',
  },
  'banka.ulozeniSelhalo': { cs: 'Nepodařilo se to uložit.', en: 'It could not be saved.' },
  'banka.cekaNaTebe': { cs: 'Čeká na tebe', en: 'Waiting for you' },
  'banka.nicNevisi': {
    cs: 'Nic nevisí — všechno, co přišlo, portál rozhodl sám.',
    en: 'Nothing is pending — the portal decided everything that came in by itself.',
  },
  'banka.bezNazvu': { cs: 'bez názvu', en: 'no name' },
  'banka.vs': { cs: 'VS {vs}', en: 'VS {vs}' },
  'banka.vyberteFakturu': { cs: '— vyberte fakturu —', en: '— select an invoice —' },
  'banka.oznacitUhrazenou': { cs: 'Označit uhrazenou', en: 'Mark as paid' },
  'banka.neniKFakture': { cs: 'Není k faktuře', en: 'Not for an invoice' },
  'banka.posledniPohyby': { cs: 'Poslední pohyby', en: 'Recent transactions' },
  'banka.nicStazeno': { cs: 'Zatím nic staženého.', en: 'Nothing downloaded yet.' },
  'banka.fakturaPopis': { cs: 'Faktura {popis}', en: 'Invoice {popis}' },
  'banka.odparovat': { cs: 'Odpárovat', en: 'Unmatch' },
  'banka.stavAuto': { cs: 'Spárováno samo', en: 'Matched automatically' },
  'banka.stavRucne': { cs: 'Spárováno ručně', en: 'Matched manually' },
  'banka.stavNavrh': { cs: 'Návrh ke schválení', en: 'Suggestion to approve' },
  'banka.stavNova': { cs: 'Nespárováno', en: 'Unmatched' },
  'banka.stavIgnorovana': { cs: 'Odloženo', en: 'Set aside' },

  // --- upomínky (jen rozhraní editoru; znění upomínky se řídí jazykem příjemce) ---
  'upominky.nadpis': { cs: 'Upomínky', en: 'Reminders' },
  'upominky.popis': {
    cs: 'Připomenutí faktur, které jsou po splatnosti a nejsou zaplacené. Koncepty ani uhrazené faktury se neupomínají.',
    en: 'Reminders for invoices that are overdue and unpaid. Drafts and paid invoices are never chased.',
  },
  'upominky.nastaveniNacist': {
    cs: 'Nastavení se nepodařilo načíst.',
    en: 'The settings could not be loaded.',
  },
  'upominky.zadejteDen': {
    cs: 'Napište aspoň jeden den po splatnosti, kdy se má upomínat.',
    en: 'Enter at least one day after the due date on which a reminder should go out.',
  },
  'upominky.ulozeniSelhalo': { cs: 'Uložení se nezdařilo.', en: 'Saving failed.' },
  'upominky.ulozeno': { cs: 'Uloženo.', en: 'Saved.' },
  'upominky.nahledSelhal': {
    cs: 'Náhled se nepodařilo připravit.',
    en: 'The preview could not be prepared.',
  },
  'upominky.poslaniSelhalo': {
    cs: 'Upomínku se nepodařilo poslat.',
    en: 'The reminder could not be sent.',
  },
  'upominky.odeslanoNa': { cs: 'Upomínka odešla na {komu}.', en: 'The reminder was sent to {komu}.' },
  'upominky.posilatAutomaticky': {
    cs: 'Posílat upomínky automaticky',
    en: 'Send reminders automatically',
  },
  'upominky.posilatAutomatickyPopis': {
    cs: 'Úloha běží ve všední dny ráno. Dokud je tohle vypnuté, upomínky odcházejí jen ručně tlačítkem u faktury dole.',
    en: 'The task runs on weekday mornings. While this is switched off, reminders go out only by hand with the button next to the invoice below.',
  },
  'upominky.kolikatyDen': { cs: 'Kolikátý den po splatnosti', en: 'Which day after the due date' },
  'upominky.kolikatyDenPopis': {
    cs: 'Čárkou oddělené dny — „{dny}" znamená tři upomínky: třetí, desátý a jednadvacátý den po splatnosti. Kolik čísel, tolik upomínek; dál se nepřipomíná.',
    en: 'Comma-separated days — "{dny}" means three reminders: on the third, tenth and twenty-first day after the due date. As many numbers as reminders; after that nothing more is sent.',
  },
  'upominky.skrytaKopie': { cs: 'Skrytá kopie nám', en: 'Blind copy to us' },
  'upominky.skrytaKopiePopis': {
    cs: 'Klient adresy nevidí — chodí ve skryté kopii.',
    en: 'The customer cannot see the addresses — they go as a blind copy.',
  },
  'upominky.zneni': { cs: 'Znění upomínky', en: 'Wording of the reminder' },
  'upominky.naposledyUpravil': { cs: 'naposledy upravil {kdo}', en: 'last edited by {kdo}' },
  'upominky.predmet': { cs: 'Předmět', en: 'Subject' },
  'upominky.text': { cs: 'Text', en: 'Body' },
  'upominky.textNapoveda': {
    cs: '**tučně** se vysází tučně. Prázdný řádek dělá nový odstavec.',
    en: '**bold** is typeset in bold. An empty line starts a new paragraph.',
  },
  'upominky.promennaTitle': { cs: '{popis} — např. {ukazka}', en: '{popis} — e.g. {ukazka}' },
  'upominky.nahledEmailu': { cs: 'Náhled e-mailu', en: 'Email preview' },
  'upominky.obnovitVychozi': { cs: 'Obnovit výchozí znění', en: 'Restore the default wording' },
  'upominky.nahledUpominky': { cs: 'Náhled upomínky', en: 'Reminder preview' },
  'upominky.poSplatnosti': { cs: 'Po splatnosti', en: 'Overdue' },
  'upominky.zadnaPoSplatnosti': {
    cs: 'Žádná odeslaná faktura není po splatnosti. 👌',
    en: 'No sent invoice is overdue. 👌',
  },
  'upominky.splatnost': { cs: 'splatnost {datum}', en: 'due {datum}' },
  'upominky.dniPoSplatnosti': { cs: '{dnu} dní po splatnosti', en: '{dnu} days overdue' },
  'upominky.upominekOdeslano': {
    cs: 'upomínek odesláno {pocet}',
    en: '{pocet} reminders sent',
  },
  'upominky.upominekOdeslanoNaposledy': {
    cs: 'upomínek odesláno {pocet} (naposledy {kdy})',
    en: '{pocet} reminders sent (last on {kdy})',
  },
  'upominky.neniKomuPoslat': { cs: 'není komu poslat', en: 'nobody to send it to' },
  'upominky.poslatNa': { cs: 'Poslat na {komu}', en: 'Send to {komu}' },
  'upominky.nemaKontakt': {
    cs: 'Firma nemá kontaktní e-mail a projekt klienta',
    en: 'The company has no contact email and no customer project',
  },
  'upominky.posilam': { cs: 'Posílám…', en: 'Sending…' },
  'upominky.poslatUpominku': { cs: 'Poslat upomínku', en: 'Send the reminder' },

  // --- moje firmy ---
  'mojeFirmy.uvod': {
    cs: 'Vlastní fakturační údaje na jednom místě. U každé firmy si nastavíte číselné řady (aby šlo navázat na řadu z Caflou) a bankovní účty — klidně několik, každý ve své měně.',
    en: 'Your own invoicing details in one place. For each company you set the number series (so you can carry on from the Caflou series) and bank accounts — several if you like, each in its own currency.',
  },
  'mojeFirmy.sloupecFirma': { cs: 'Firma', en: 'Company' },
  'mojeFirmy.vychoziOdznak': { cs: 'VÝCHOZÍ', en: 'DEFAULT' },
  'mojeFirmy.neaktivni': { cs: '(neaktivní)', en: '(inactive)' },
  'mojeFirmy.dalsiFaktura': { cs: 'Další faktura', en: 'Next invoice' },
  'mojeFirmy.dalsiNabidka': { cs: 'Další nabídka', en: 'Next quote' },
  'mojeFirmy.ucty': { cs: 'Účty', en: 'Accounts' },
  'mojeFirmy.prazdno': {
    cs: 'Zatím tu není žádná firma. Založte první formulářem níže — bez ní nejde vystavit doklad.',
    en: 'There is no company here yet. Create the first one with the form below — without one no document can be issued.',
  },
  'mojeFirmy.zpetNaFirmy': { cs: '← Zpět na moje firmy', en: '← Back to my companies' },

  // --- moje firmy: údaje firmy ---
  'mojeFirmy.novaFirma': { cs: 'Nová firma', en: 'New company' },
  'mojeFirmy.novaFakturacniFirma': { cs: 'Nová fakturační firma', en: 'New invoicing company' },
  'mojeFirmy.ic': { cs: 'IČ', en: 'Reg. no.' },
  'mojeFirmy.icNapoveda': {
    cs: 'vyplňte a načtěte zbytek z registru',
    en: 'fill it in and load the rest from the register',
  },
  'mojeFirmy.dic': { cs: 'DIČ', en: 'VAT no.' },
  'mojeFirmy.nacistZRegistru': { cs: 'Načíst z registru', en: 'Load from the register' },
  'mojeFirmy.registrSelhal': {
    cs: 'Načtení z registru se nezdařilo.',
    en: 'Loading from the register failed.',
  },
  'mojeFirmy.registrDoplneno': {
    cs: 'Údaje z registru doplněny — zkontrolujte a uložte.',
    en: 'The details from the register have been filled in — check them and save.',
  },
  'mojeFirmy.nazevFirmy': { cs: 'Název firmy', en: 'Company name' },
  'mojeFirmy.nazevFirmyNapoveda': {
    cs: 've fakturačních údajích píšeme MEDIA SPACE s.r.o.',
    en: 'in the invoicing details we write MEDIA SPACE s.r.o.',
  },
  'mojeFirmy.platceDph': { cs: 'Plátce DPH', en: 'VAT registered' },
  'mojeFirmy.ulice': { cs: 'Ulice a číslo popisné', en: 'Street and number' },
  'mojeFirmy.psc': { cs: 'PSČ', en: 'Postcode' },
  'mojeFirmy.mesto': { cs: 'Město', en: 'Town' },
  'mojeFirmy.zeme': { cs: 'Země', en: 'Country' },
  'mojeFirmy.emailOdesilatele': { cs: 'E-mail odesílatele', en: 'Sender email' },
  'mojeFirmy.emailOdesilateleNapoveda': {
    cs: 'z něj chodí nabídky a faktury',
    en: 'quotes and invoices are sent from it',
  },
  'mojeFirmy.telefon': { cs: 'Telefon', en: 'Phone' },
  'mojeFirmy.zalozitFirmu': { cs: 'Založit firmu', en: 'Create the company' },
  'mojeFirmy.zalozeniSelhalo': {
    cs: 'Firmu se nepodařilo založit.',
    en: 'The company could not be created.',
  },
  'mojeFirmy.ulozeniSelhalo': { cs: 'Uložení se nezdařilo.', en: 'Saving failed.' },
  'mojeFirmy.ulozitZmeny': { cs: 'Uložit změny', en: 'Save changes' },
  'mojeFirmy.ulozeno': { cs: '✓ Uloženo', en: '✓ Saved' },

  // --- moje firmy: číselné řady ---
  'mojeFirmy.ciselneRady': { cs: 'Číselné řady', en: 'Number series' },
  // {kod1}…{kod4} se vykreslí jako <code> se zástupným znakem - viz sKody() v IssuerForm.tsx.
  'mojeFirmy.ciselneRadyPopis': {
    cs: 'Ve formátu se nahrazuje {kod1} rokem, {kod2} rokem dvojčíslím, {kod3} měsícem a {kod4} pořadovým číslem (počet písmen N = počet míst). Pořadovým číslem navážete na řadu z Caflou.',
    en: 'In the format, {kod1} is replaced by the year, {kod2} by the two-digit year, {kod3} by the month and {kod4} by the sequence number (the number of N letters = the number of digits). The sequence number is how you carry on from the Caflou series.',
  },
  'mojeFirmy.formatFaktury': { cs: 'Formát faktury', en: 'Invoice format' },
  'mojeFirmy.formatNabidky': { cs: 'Formát nabídky', en: 'Quote format' },
  'mojeFirmy.formatSmlouvy': { cs: 'Formát smlouvy', en: 'Contract format' },
  'mojeFirmy.dalsiCislo': { cs: 'Další číslo', en: 'Next number' },
  'mojeFirmy.vyjde': { cs: 'Vyjde:', en: 'Comes out as:' },
  'mojeFirmy.vychoziMena': { cs: 'Výchozí měna', en: 'Default currency' },
  'mojeFirmy.vychoziFirma': {
    cs: 'Výchozí firma u nových dokladů',
    en: 'Default company for new documents',
  },
  'mojeFirmy.aktivni': {
    cs: 'Aktivní (nabízí se u nových dokladů)',
    en: 'Active (offered on new documents)',
  },

  // --- moje firmy: bankovní účty ---
  'mojeFirmy.bankovniUcty': { cs: 'Bankovní účty', en: 'Bank accounts' },
  'mojeFirmy.uctyPodleMeny': {
    cs: 'Na dokladu se nabídne účet ve stejné měně.',
    en: 'The account in the same currency is offered on the document.',
  },
  'mojeFirmy.zadnyUcet': { cs: 'Zatím tu není žádný účet.', en: 'There is no account here yet.' },
  'mojeFirmy.vychozi': { cs: 'výchozí', en: 'default' },
  'mojeFirmy.qrPlatba': { cs: 'QR platba ✓ {iban}', en: 'QR payment ✓ {iban}' },
  'mojeFirmy.bezQrPlatby': {
    cs: 'Bez QR platby — doplňte kód banky (například 3030) do pole Banka, nebo číslo účtu ve tvaru 3169021011/3030.',
    en: 'No QR payment — add the bank code (3030, for example) to the Bank field, or the account number in the form 3169021011/3030.',
  },
  'mojeFirmy.nastavitVychozi': { cs: 'Nastavit výchozí', en: 'Set as default' },
  'mojeFirmy.opravduSmazatUcet': { cs: 'Opravdu smazat účet?', en: 'Really delete the account?' },
  'mojeFirmy.oznaceni': { cs: 'Označení', en: 'Label' },
  'mojeFirmy.oznaceniPlaceholder': { cs: 'např. Air Bank CZK', en: 'e.g. Air Bank CZK' },
  'mojeFirmy.mena': { cs: 'Měna', en: 'Currency' },
  'mojeFirmy.cisloUctu': { cs: 'Číslo účtu', en: 'Account number' },
  'mojeFirmy.cisloUctuNapoveda': {
    cs: 'I s kódem banky — z toho se dopočítá IBAN a na faktuře přibude QR platba.',
    en: 'Including the bank code — the IBAN is worked out from it and a QR payment is added to the invoice.',
  },
  'mojeFirmy.banka': { cs: 'Banka', en: 'Bank' },
  'mojeFirmy.vychoziUcetProMenu': {
    cs: 'Výchozí účet pro tuhle měnu',
    en: 'Default account for this currency',
  },
  'mojeFirmy.pridatUcet': { cs: 'Přidat účet', en: 'Add an account' },

  // --- moje firmy: podpis na faktury ---
  'mojeFirmy.podpisNadpis': { cs: 'Podpis na faktury', en: 'Signature for invoices' },
  'mojeFirmy.podpisPopis': {
    cs: 'Tiskne se vpravo dole na každou fakturu této firmy. Nahrajte fotku nebo sken podpisu na bílém papíře - pozadí se samo zprůhlední.',
    en: 'It is printed at the bottom right of every invoice from this company. Upload a photo or a scan of a signature on white paper — the background is made transparent by itself.',
  },
  'mojeFirmy.podpisAlt': { cs: 'Podpis', en: 'Signature' },
  'mojeFirmy.podpisChybi': {
    cs: 'Podpis zatím není nahraný - faktury vyjdou bez podpisu.',
    en: 'No signature has been uploaded yet — invoices will come out without one.',
  },
  'mojeFirmy.nahratPodpis': { cs: 'Nahrát podpis', en: 'Upload a signature' },
  'mojeFirmy.nahratJinyPodpis': { cs: 'Nahrát jiný podpis', en: 'Upload a different signature' },
  'mojeFirmy.odebratPodpis': { cs: 'Odebrat podpis', en: 'Remove the signature' },
  'mojeFirmy.podpisUlozeniSelhalo': {
    cs: 'Podpis se nepodařilo uložit.',
    en: 'The signature could not be saved.',
  },
  'mojeFirmy.obrazekNacist': {
    cs: 'Obrázek se nepodařilo načíst.',
    en: 'The image could not be loaded.',
  },
  'mojeFirmy.souborNeniObrazek': { cs: 'Soubor není obrázek.', en: 'The file is not an image.' },
  'mojeFirmy.prohlizecNeumi': {
    cs: 'Prohlížeč neumí upravit obrázek.',
    en: 'The browser cannot edit the image.',
  },
  'mojeFirmy.zadnyPodpisVidet': {
    cs: 'Na obrázku není vidět žádný podpis.',
    en: 'No signature can be seen in the image.',
  },

  // ==========================================================================
  // DAVKA 5 - ZBYTEK ADMINISTRACE (27. 9. 2026)
  // Uzivatele, ceniky, archiv, firmy, studia, kalendar a vykazy.
  // ==========================================================================

  // ===========================================================================
  // DÁVKA 5 — uživatelé (administrace: /admin/users a karta uživatele)
  // Řádky k vložení do objektu SLOVNIK v src/lib/jazyk.ts.
  // Merge dělá Ondřej, tenhle soubor se nikam neimportuje.
  // ===========================================================================

  // --- seznam uživatelů: hlavička a záložky ---
  'uzivatel.nadpis': { cs: 'Uživatelé', en: 'Users' },
  'uzivatel.filtrFirma': { cs: 'Filtr: {firma}', en: 'Filter: {firma}' },
  'uzivatel.zrusitFiltr': { cs: '(zrušit filtr)', en: '(clear the filter)' },
  'uzivatel.zalozkaMediaspace': { cs: 'Mediaspace', en: 'Mediaspace' },
  'uzivatel.zalozkaKlienti': { cs: 'Klienti', en: 'Customers' },
  'uzivatel.zalozkaHerci': { cs: 'Herci', en: 'Narrators' },
  'uzivatel.zalozkaTabule': { cs: 'Tabule', en: 'Displays' },
  'uzivatel.zalozkaStudio': { cs: 'Studio', en: 'Studio' },
  'uzivatel.hledatPlaceholder': {
    cs: 'Hledat jméno, e-mail, telefon…',
    en: 'Search by name, email, phone…',
  },
  'uzivatel.hledaniPrazdne': { cs: 'Hledání nic nenašlo.', en: 'The search found nothing.' },
  'uzivatel.zadnyUzivatel': {
    cs: 'Žádný uživatel neodpovídá filtru.',
    en: 'No user matches the filter.',
  },

  // --- seznam uživatelů: sloupce tabulky ---
  'uzivatel.sl.jmeno': { cs: 'Jméno', en: 'Name' },
  'uzivatel.sl.kod': { cs: 'Kód', en: 'Code' },
  'uzivatel.sl.email': { cs: 'E-mail', en: 'Email' },
  'uzivatel.sl.telefon': { cs: 'Telefon', en: 'Phone' },
  'uzivatel.sl.role': { cs: 'Typ přístupu', en: 'Access type' },
  'uzivatel.sl.narozeni': { cs: 'Datum narození', en: 'Date of birth' },
  'uzivatel.sl.lokace': { cs: 'Lokace', en: 'Location' },
  'uzivatel.sl.firma': { cs: 'Firma', en: 'Company' },
  'uzivatel.sl.aktivni': { cs: 'Aktivní', en: 'Active' },
  'uzivatel.seraditPodle': { cs: 'Seřadit podle: {sloupec}', en: 'Sort by: {sloupec}' },

  // --- skupiny v nabídce „Typ přístupu" (zakládání i karta) ---
  'uzivatel.skupinaKlientske': { cs: 'Klientské role', en: 'Customer roles' },
  'uzivatel.skupinaHerec': { cs: 'Herec', en: 'Narrator' },
  'uzivatel.skupinaInterni': { cs: 'Interní (Mediaspace)', en: 'Internal (Mediaspace)' },
  'uzivatel.skupinaRobot': { cs: 'Robot (účet bez člověka)', en: 'Robot (account with no person)' },
  'uzivatel.skupinaTabule': { cs: 'Obrazovka ve studiu', en: 'Studio display' },
  'uzivatel.skupinaStudio': { cs: 'Klienti studia (rezervace)', en: 'Studio customers (bookings)' },

  // --- založení uživatele ---
  'uzivatel.pridatUzivatele': { cs: 'Přidat uživatele', en: 'Add a user' },
  'uzivatel.novyUzivatel': { cs: 'Nový uživatel', en: 'New user' },
  'uzivatel.zalozeniNezdarilo': {
    cs: 'Účet se nepodařilo založit.',
    en: 'The account could not be created.',
  },
  'uzivatel.uctZalozen': {
    cs: 'Účet {email} je založen. Přihlašovací heslo mu prosím předejte bezpečnou cestou.',
    en: 'The account {email} has been created. Please pass the sign-in password on securely.',
  },
  'uzivatel.zakladam': { cs: 'Zakládám…', en: 'Creating…' },
  'uzivatel.ulozitUzivatele': { cs: 'Uložit uživatele', en: 'Save the user' },

  // --- pole formuláře (sdílí zakládání i karta uživatele) ---
  'uzivatel.poleJmeno': { cs: 'Jméno', en: 'Name' },
  'uzivatel.poleFotka': { cs: 'Fotka', en: 'Photo' },
  'uzivatel.polePocatecniHeslo': { cs: 'Počáteční heslo', en: 'Initial password' },
  'uzivatel.pocatecniHesloHint': {
    cs: 'uživatel si ho může později změnit',
    en: 'the user can change it later',
  },
  'uzivatel.poleTypPristupu': { cs: 'Typ přístupu', en: 'Access type' },
  'uzivatel.poleFirma': { cs: 'Firma', en: 'Company' },
  'uzivatel.vyberteFirmu': { cs: '— vyberte firmu —', en: '— choose a company —' },
  'uzivatel.poleEmail': { cs: 'E-mail', en: 'Email' },
  'uzivatel.poleTelefon': { cs: 'Telefon', en: 'Phone' },
  'uzivatel.poleDatumNarozeni': { cs: 'Datum narození', en: 'Date of birth' },
  'uzivatel.poleLokace': { cs: 'Lokace', en: 'Locations' },
  'uzivatel.lokaceHint': {
    cs: 'studia, ve kterých je herec schopen fyzicky natáčet',
    en: 'the studios where the narrator is able to record in person',
  },
  'uzivatel.poleRcNeboDatum': { cs: 'RČ / datum narození', en: 'Birth number / date of birth' },
  'uzivatel.poleIc': { cs: 'IČ', en: 'Reg. no.' },
  'uzivatel.poleDic': { cs: 'DIČ', en: 'VAT no.' },
  'uzivatel.platceDph': { cs: 'Plátce DPH', en: 'VAT registered' },
  'uzivatel.poleCisloUctu': { cs: 'Číslo účtu', en: 'Account number' },
  'uzivatel.poleUlice': { cs: 'Ulice č.p.', en: 'Street and number' },
  'uzivatel.poleMesto': { cs: 'Město', en: 'Town' },
  'uzivatel.polePsc': { cs: 'PSČ', en: 'Postcode' },
  'uzivatel.poleZeme': { cs: 'Země', en: 'Country' },

  // --- fotka uživatele (přetažení souboru) ---
  'uzivatel.pripravujiFotku': { cs: 'Připravuji fotku…', en: 'Preparing the photo…' },
  'uzivatel.aktualniFotka': { cs: 'Aktuální fotka', en: 'Current photo' },
  'uzivatel.pretahnouteFotku': {
    cs: 'Přetáhněte sem soubor nebo klikněte pro výběr',
    en: 'Drag a file here, or click to choose one',
  },
  'uzivatel.odebratFotku': { cs: 'Odebrat', en: 'Remove' },

  // --- pozvánka do portálu ---
  'uzivatel.pozvankaNadpis': { cs: 'Pozvánka do portálu', en: 'Invitation to the portal' },
  'uzivatel.pozvankaNaposledy': {
    cs: 'Naposledy odeslána {datum}.',
    en: 'Last sent on {datum}.',
  },
  'uzivatel.pozvankaNeodeslana': { cs: 'Zatím neodeslána.', en: 'Not sent yet.' },
  'uzivatel.hesloNastaveno': {
    cs: 'Uživatel si už heslo nastavil.',
    en: 'The user has already set a password.',
  },
  'uzivatel.odeslatPozvanku': { cs: 'Odeslat pozvánku', en: 'Send the invitation' },
  'uzivatel.poslatZnovu': { cs: 'Poslat znovu', en: 'Send again' },
  'uzivatel.odesilam': { cs: 'Odesílám…', en: 'Sending…' },
  'uzivatel.odeslano': { cs: 'Odesláno', en: 'Sent' },
  'uzivatel.pozvankaOdeslana': {
    cs: 'Pozvánka odeslána na {kam}.',
    en: 'The invitation has been sent to {kam}.',
  },
  'uzivatel.emailUzivatele': { cs: 'e-mail uživatele', en: 'the user’s email' },
  'uzivatel.pozvankaNezdarila': {
    cs: 'Pozvánku se nepodařilo odeslat.',
    en: 'The invitation could not be sent.',
  },
  'uzivatel.naposledyOdeslano': {
    cs: 'Naposledy odesláno {datum}',
    en: 'Last sent on {datum}',
  },

  // --- karta uživatele ---
  'uzivatel.zpetNaSeznam': { cs: 'Zpět na seznam uživatelů', en: 'Back to the list of users' },
  'uzivatel.ulozeniNezdarilo': { cs: 'Uložení se nezdařilo.', en: 'Saving failed.' },
  'uzivatel.ulozitZmeny': { cs: 'Uložit změny', en: 'Save changes' },
  'uzivatel.ulozeno': { cs: '✓ Uloženo', en: '✓ Saved' },
  'uzivatel.poleNoveHeslo': { cs: 'Nové heslo', en: 'New password' },
  'uzivatel.noveHesloHint': {
    cs: 'nechte prázdné, pokud nechcete měnit',
    en: 'leave it empty if you do not want to change it',
  },
  'uzivatel.poleHodinovaSazba': { cs: 'Hodinová sazba (Kč)', en: 'Hourly rate (CZK)' },
  'uzivatel.hodinovaSazbaHint': {
    cs: 'z ní se počítají výkazy práce',
    en: 'timesheets are calculated from it',
  },

  // --- karta uživatele: studia zvukaře a tabule ---
  'uzivatel.poleStudia': { cs: 'Studia', en: 'Studios' },
  'uzivatel.studiaHint': {
    cs: 've kterých studiích zvukař točí',
    en: 'which studios the sound engineer records in',
  },
  'uzivatel.zadneStudioZalozte': {
    cs: 'Zatím tu není žádné studio - založte ho v Administraci → Studia.',
    en: 'There is no studio here yet — create one in Administration → Studios.',
  },
  'uzivatel.zadneStudio': { cs: 'Zatím tu není žádné studio.', en: 'There is no studio here yet.' },
  'uzivatel.poleVedouciPobocky': { cs: 'Vedoucí pobočky', en: 'Branch manager' },
  'uzivatel.vedouciPobockyHint': {
    cs: 'v těchto studiích smí zapisovat, posouvat a mazat události v kalendáři',
    en: 'in these studios they may add, move and delete events in the calendar',
  },
  'uzivatel.polePristupTabule': { cs: 'Přístup na tabule', en: 'Access to studio displays' },
  'uzivatel.pristupTabuleHint': {
    cs: 'tyhle tabule si otevře pod svým účtem v Můj účet → Tabule ve studiu',
    en: 'they can open these displays under their own account in My account → Studio display',
  },

  // --- karta uživatele: práva a příznaky (zaškrtávátka) ---
  // Překládá se jen POPISEK. Název pole i hodnota, která jde na server,
  // zůstávají tak, jak jsou (manazerProjektu, vidiBanku, …).
  'uzivatel.pravoManazerProjektu': { cs: 'Může být manažer projektu', en: 'Can be a project manager' },
  'uzivatel.pravoManazerProjektuPopis': {
    cs: 'nabízí se u projektů ve výběru manažera',
    en: 'offered in the manager picker on projects',
  },
  'uzivatel.pravoSmlouvyPodepisuje': {
    cs: 'Podepisuje smlouvy za Mediaspace',
    en: 'Signs contracts on behalf of Mediaspace',
  },
  'uzivatel.pravoSmlouvyPodepisujePopis': {
    cs: 'odeslaná smlouva je od nás rovnou podepsaná jeho jménem',
    en: 'a contract we send out already carries their signature',
  },
  'uzivatel.pravoDotazyKlientu': { cs: 'Dostává dotazy klientů', en: 'Receives customer questions' },
  'uzivatel.pravoDotazyKlientuPopis': {
    cs: 'je v každém kanálu, který klient otevře tlačítkem Zeptat se',
    en: 'they are in every channel a customer opens with the Ask a question button',
  },
  'uzivatel.pravoVidiBanku': { cs: 'Vidí sekci Banka', en: 'Can see the Bank section' },
  // Přístup do sekcí zaškrtávátky (28. 9. 2026). Vidí to jen superadmin.
  'uzivatel.pristupySekce': { cs: 'Přístup do sekcí', en: 'Access to sections' },
  'uzivatel.pristupyPopis': {
    cs: 'Co je zaškrtnuté, to člověk uvidí v liště a otevře. Sekce je velký vypínač, pod ní se dají dávat jednotlivá práva - třeba vidět faktury bez možnosti je vystavovat. Role už o tom nerozhoduje, předvyplní se z ní jen nový účet.',
    en: 'What is ticked is what the person sees in the bar and can open. The section is the master switch; underneath it you grant individual rights - for example seeing invoices without being able to issue them. The role no longer decides this, it only pre-fills a new account.',
  },
  'firmy.nastaveniSekce': {
    cs: 'Nastavení firem - zprávy z portálu, ceníky a vzory',
    en: 'Company settings - portal messages, price lists and templates',
  },
  'doklady.nastaveniSekce': {
    cs: 'Nastavení dokladů - maily a upomínky',
    en: 'Invoicing settings - emails and reminders',
  },
  'uzivatel.superadmin': { cs: 'Superadmin', en: 'Superadmin' },
  'uzivatel.superadminPopis': {
    cs: 'Rozdává přístupy do sekcí a vidí všechno.',
    en: 'Grants access to sections and sees everything.',
  },
  'uzivatel.pristupySuperadmin': {
    cs: 'Superadmin vidí všechny sekce - zaškrtávátka se u něj neřeší.',
    en: 'A superadmin sees every section - the tick boxes do not apply.',
  },
  'uzivatel.pravoVidiBankuPopis': {
    cs: 'pohyby na účtu, párování plateb a napojení účtu v Dokladech',
    en: 'account movements, payment matching and the account connection in Invoicing',
  },
  'uzivatel.pravoTechParametry': {
    cs: 'Spravuje technické parametry',
    en: 'Manages the technical parameters',
  },
  'uzivatel.pravoTechParametryPopis': {
    cs: 'mění sady formátů u nakladatelství — ostatní je mají jen ke čtení',
    en: 'changes the format sets at publishers — everyone else only reads them',
  },
  'uzivatel.pravoSledujeZmeny': { cs: 'Hlídá změny u projektů', en: 'Watches changes on projects' },
  'uzivatel.pravoSledujeZmenyPopis': {
    cs: 'zvoneček se ozve, když se u projektu změní stav nebo termín',
    en: 'the bell rings when a project changes its status or its dates',
  },
  'uzivatel.pravoJenNahled': {
    cs: 'Náhledový účet (nic nemění)',
    en: 'Preview account (changes nothing)',
  },
  'uzivatel.pravoJenNahledPopis': {
    cs: 'v liště si přepíná Tým / Klient / Herec a nic z portálu neuloží',
    en: 'switches between Team / Customer / Narrator in the bar and saves nothing in the portal',
  },
  'uzivatel.pravoDostavaDotoceno': {
    cs: 'Dostává zprávy o dotočení',
    en: 'Receives messages about finished recordings',
  },
  'uzivatel.pravoDostavaDotocenoPopis': {
    cs: 'mail pokaždé, když se u projektu odškrtne dotočený herec',
    en: 'an email every time a narrator is ticked off as finished on a project',
  },
  'uzivatel.pravoSchvaleniReklam': {
    cs: 'Zvonek: klient schválil reklamu',
    en: 'Bell: the customer approved an advert',
  },
  'uzivatel.pravoSchvaleniReklamPopis': {
    cs: 'notifikace pokaždé, když klient odklepne spot k fakturaci',
    en: 'a notification every time a customer signs a spot off for invoicing',
  },
  'uzivatel.pravoPlanovaniTerminu': {
    cs: 'Zvonek: projekt jde plánovat',
    en: 'Bell: a project is ready to schedule',
  },
  'uzivatel.pravoPlanovaniTerminuPopis': {
    cs: 'notifikace pokaždé, když projekt přejde do stavu Plánujeme',
    en: 'a notification every time a project moves to the Scheduling status',
  },
  'uzivatel.pravoStrihaExterne': { cs: 'Stříhá externě', en: 'Edits off-site' },
  'uzivatel.pravoStrihaExternePopis': {
    cs: 'v kalendáři svítí letadlo a jeho práce nedrží místo ve studiu',
    en: 'the calendar shows a plane and their work does not hold a studio',
  },
  'uzivatel.pravoStatusZKalendare': {
    cs: 'Status v chatu z kalendáře',
    en: 'Chat status from the calendar',
  },
  'uzivatel.pravoStatusZKalendarePopis': {
    cs: 'schůzky a castingy na celou dobu, režie na dálku prvních 30 minut',
    en: 'meetings and castings for their whole length, remote directing for the first 30 minutes',
  },
  'uzivatel.pravoNabidkyReklam': {
    cs: 'Vidí stav nabídky u reklam',
    en: 'Can see the quote status on adverts',
  },
  'uzivatel.pravoNabidkyReklamPopis': {
    cs: 'značka čeká / schválena / neschválena v přehledu i v detailu',
    en: 'the pending / approved / rejected tag in the list and in the detail',
  },
  'uzivatel.pravoTakyZvukar': { cs: 'Může být i zvukař', en: 'Can also be a sound engineer' },
  'uzivatel.pravoTakyZvukarPopis': {
    cs: 'nabízí se mezi zvukaři u natáčení a střihu v kalendáři',
    en: 'offered among the sound engineers for recordings and editing in the calendar',
  },
  'uzivatel.pravoDostavaObjednavky': { cs: 'Dostává objednávky', en: 'Receives orders' },
  'uzivatel.pravoDostavaObjednavkyPopis': {
    cs: 'mail i zvoneček pokaždé, když klient odešle objednávku; klient tuhle adresu nevidí',
    en: 'an email and a bell every time a customer sends an order; the customer never sees this address',
  },
  'uzivatel.pravoVyplneneUdaje': {
    cs: 'Dostává vyplněné údaje herců',
    en: 'Receives narrators’ completed details',
  },
  'uzivatel.pravoVyplneneUdajePopis': {
    cs: 'mail i zvoneček pokaždé, když herec vyplní údaje po pozvánce',
    en: 'an email and a bell every time a narrator fills in their details after an invitation',
  },
  'uzivatel.pravoManazerAudioknih': {
    cs: 'Vede objednané audioknihy',
    en: 'Runs the audiobooks that are ordered',
  },
  'uzivatel.pravoManazerAudioknihPopis': {
    cs: 'projekt z objednávky audioknihy se rovnou přiřadí jemu jako manažerovi',
    en: 'a project from an audiobook order is assigned to them as the manager straight away',
  },
  'uzivatel.pravoDotocenoKlient': {
    cs: 'Upozornit na dotočeného herce',
    en: 'Notify about a finished narrator',
  },
  'uzivatel.pravoDotocenoKlientPopis': {
    cs: 'mail i zvoneček, když u jeho projektu dotočíme s hercem',
    en: 'an email and a bell when we finish recording with a narrator on their project',
  },
  'uzivatel.pravoZmenaTerminuKlient': {
    cs: 'Upozornit na změnu natáčecího termínu',
    en: 'Notify about a changed recording session',
  },
  'uzivatel.pravoZmenaTerminuKlientPopis': {
    cs: 'mail i zvoneček, když se u jeho projektu frekvence přesune nebo zruší',
    en: 'an email and a bell when a session on their project moves or is cancelled',
  },

  // --- karta uživatele: herec, který je zároveň dodavatel ---
  'uzivatel.takeDodavatel': { cs: 'Také dodavatel', en: 'Also a supplier' },
  'uzivatel.takeDodavatelJe': {
    cs: 'Herec je zároveň veden jako firma mezi dodavateli. Smlouvu o dílo s ním uzavřete přes ni.',
    en: 'The narrator is also kept as a company among the suppliers. A contract for work is made with them through it.',
  },
  'uzivatel.takeDodavatelNeni': {
    cs: 'Založí z téhle karty firmu mezi dodavateli. Hercem zůstává — jen s ním půjde uzavřít i smlouvu o dílo. Nejdřív uložte IČ a adresu, převezmou se do firmy.',
    en: 'Creates a supplier company from this card. They stay a narrator — it only makes a contract for work possible. Save the registration number and the address first, they are carried over to the company.',
  },
  'uzivatel.otevritDodavatele': { cs: 'Otevřít {firma}', en: 'Open {firma}' },
  'uzivatel.prenestDoDodavatelu': { cs: 'Přenést do dodavatelů', en: 'Move into the suppliers' },
  'uzivatel.prenosNezdaril': {
    cs: 'Přenos do dodavatelů se nezdařil.',
    en: 'Moving into the suppliers failed.',
  },

  // --- karta uživatele: vyřazení a smazání ---
  'uzivatel.vyraditNadpis': { cs: 'Vyřadit uživatele', en: 'Retire the user' },
  'uzivatel.vyrazenyNadpis': { cs: 'Uživatel je vyřazený', en: 'The user is retired' },
  'uzivatel.vyraditPopis': {
    cs: 'Nepřihlásí se a zmizí z nabídek. Smlouvy, výkazy a projekty, které na něj odkazují, zůstanou beze změny — proto se nemaže. Změna se uloží tlačítkem níž.',
    en: 'They cannot sign in and disappear from the pickers. Contracts, timesheets and projects that refer to them stay unchanged — which is why nothing is deleted. The change is saved with the button below.',
  },
  'uzivatel.vrazenyPopis': {
    cs: 'Nemůže se přihlásit a nenabízí se u projektů. Vrátit ho jde kdykoliv. Změna se uloží tlačítkem níž.',
    en: 'They cannot sign in and are not offered on projects. They can be brought back at any time. The change is saved with the button below.',
  },
  'uzivatel.vyraditUzivatele': { cs: 'Vyřadit uživatele', en: 'Retire the user' },
  'uzivatel.vratitMeziAktivni': { cs: 'Vrátit mezi aktivní', en: 'Bring back among the active' },
  'uzivatel.smazatUplneNadpis': { cs: 'Smazat účet úplně', en: 'Delete the account entirely' },
  'uzivatel.smazatUplnePopis': {
    cs: 'Když na účtu nic nevisí, smaže se rovnou. Když něco visí, portál nejdřív ukáže co a nabídne archivaci. Projekty tím nezanikají — účet u nich jen přestane být vyplněný.',
    en: 'If nothing hangs on the account, it is deleted straight away. If something does, the portal first shows what and offers to archive it. Projects do not disappear — the account is simply no longer filled in on them.',
  },
  'uzivatel.smazatUcet': { cs: 'Smazat účet', en: 'Delete the account' },
  'uzivatel.ucetCo': { cs: 'Účet {kdo}', en: 'The account {kdo}' },

  // Dávka 5 — ceníky, archiv, firmy (kořen administrace).
  // Řádky k vložení do SLOVNIK v src/lib/jazyk.ts. Nic jiného tenhle soubor není.

  // --- ceníky ---
  'cenik.nadpis': { cs: 'Ceníky', en: 'Price lists' },
  'cenik.ulozeniSelhalo': { cs: 'Uložení se nezdařilo.', en: 'Saving failed.' },

  // typ projektu, který dostane objednávka audioknihy
  'cenik.typZObjednavky': {
    cs: 'Objednávka audioknihy zakládá projekt typu',
    en: 'An audiobook order creates a project of this type',
  },
  'cenik.zatimNevybrano': { cs: '— zatím nevybráno —', en: '— not chosen yet —' },
  'cenik.typZObjednavkyPopis': {
    cs: 'Podle typu se projektu počítá rozpočet. Když tu nic nevyberete, projekt z objednávky přijde bez typu a rozpočet zůstane prázdný.',
    en: 'The budget is worked out from the project type. If you choose nothing here, a project from an order arrives with no type and its budget stays empty.',
  },

  // sloupce tabulky ceníku
  'cenik.sl.ikona': { cs: 'Ikona', en: 'Icon' },
  'cenik.sl.ikonaTitle': {
    cs: 'Svítí před názvem projektu v přehledu',
    en: 'Shows in front of the project name in the overview',
  },
  'cenik.sl.polozka': { cs: 'Položka', en: 'Item' },
  'cenik.sl.bezDph': { cs: 'Cena bez DPH', en: 'Price excl. VAT' },
  'cenik.sl.sDph': { cs: 'Cena s DPH', en: 'Price incl. VAT' },
  'cenik.sl.vNabidce': { cs: 'V nabídce', en: 'Offered' },
  'cenik.sl.rodnyList': { cs: 'Rodný list', en: 'Advert record' },
  'cenik.sl.rodnyListTitle': {
    cs: 'U projektů s tímhle typem se při dokončení vyrobí Rodný list',
    en: 'Projects of this type get an advert record when they are completed',
  },
  'cenik.rodnyListPrepinacTitle': {
    cs: 'U projektů s tímhle typem se při přechodu na „Dokončeno - ke schválení“ vyrobí Rodný list',
    en: 'Projects of this type get an advert record when they move to “Completed - for approval”',
  },

  'cenik.prazdnyCenik': {
    cs: 'Ceník je zatím prázdný. Přidejte první položku formulářem níže.',
    en: 'The price list is empty so far. Add the first item with the form below.',
  },
  'cenik.upravitPolozku': { cs: 'Upravit položku', en: 'Edit the item' },
  'cenik.opravduSmazatPolozku': { cs: 'Opravdu smazat položku?', en: 'Really delete the item?' },

  // hláška po pokusu o smazání položky, kterou drží projekty
  'cenik.jenVyrazeno': {
    cs: 'Položku „{nazev}" jsme jen vyřadili z nabídky — u projektů zůstane. {kdo}',
    en: 'We have only withdrawn the item “{nazev}” from the list — it stays on the projects. {kdo}',
  },
  'cenik.drziJiPocet': { cs: 'Používá ji {pocet} projektů.', en: 'It is used by {pocet} projects.' },
  'cenik.drziJiJeden': { cs: 'Má ji projekt {jmena}.', en: 'Project {jmena} has it.' },
  'cenik.drziJiVic': { cs: 'Mají ji projekty {jmena}.', en: 'Projects {jmena} have it.' },
  'cenik.drziJiVicNezVypis': {
    cs: 'Má ji {pocet} projektů: {jmena} a další {dalsi}.',
    en: '{pocet} projects have it: {jmena} and {dalsi} more.',
  },

  // formulář „přidat položku"
  'cenik.pridatPolozku': { cs: 'Přidat položku', en: 'Add an item' },
  'cenik.polozkaPriklad': { cs: 'např. Natáčení voiceoveru', en: 'e.g. Voiceover recording' },
  'cenik.dopocitame': { cs: 'dopočítáme', en: 'we work it out' },
  'cenik.radiovySpot': {
    cs: 'Rádiový spot — u projektů s tímhle typem se při dokončení vyrobí Rodný list',
    en: 'Radio spot — projects of this type get an advert record when they are completed',
  },
  'cenik.pridatDoCeniku': { cs: 'Přidat do ceníku', en: 'Add to the price list' },

  // --- ceníky: druhy licence ---
  'cenik.druhyLicence': { cs: 'Druhy licence', en: 'Licence types' },
  'cenik.druhyLicencePopis': {
    cs: 'Zaškrtávají se u projektu a může jich být víc naráz. Vyřazený druh zůstane u projektů, kde už je, jen se nenabídne u nových.',
    en: 'They are ticked on a project and there can be several at once. A withdrawn type stays on the projects that already have it, it is just no longer offered on new ones.',
  },
  'cenik.licenceUlozeniSelhalo': { cs: 'Nepodařilo se to uložit.', en: 'It could not be saved.' },
  'cenik.nabizet': { cs: 'Nabízet', en: 'Offer' },
  'cenik.zadnyDruhLicence': {
    cs: 'Zatím tu žádný druh licence není.',
    en: 'There is no licence type here yet.',
  },
  'cenik.novyDruhLicence': {
    cs: 'Nový druh licence (např. Kino)',
    en: 'New licence type (e.g. Cinema)',
  },
  'cenik.pridat': { cs: 'Přidat', en: 'Add' },
  'cenik.licenceJeUProjektu': {
    cs: '„{nazev}" je zaškrtnutý u {pocet} projektů. Smazat nejde — vyřadí se, takže u nových projektů se už nenabídne. Pokračovat?',
    en: '“{nazev}” is ticked on {pocet} projects. It cannot be deleted — it will be withdrawn, so it will no longer be offered on new projects. Continue?',
  },
  'cenik.opravduSmazatLicenci': {
    cs: 'Opravdu smazat druh licence „{nazev}"?',
    en: 'Really delete the licence type “{nazev}”?',
  },

  // --- ceníky: parametry rozpočtu audioknihy ---
  'cenik.parametryRozpoctu': {
    cs: 'Parametry rozpočtu audioknihy',
    en: 'Audiobook budget parameters',
  },
  'cenik.parametryRozpoctuPopis': {
    cs: 'Z těchto čísel se u projektů počítá rozpočet — natáčecí frekvence, střih a bonus.',
    en: 'These numbers are what a project’s budget is worked out from — recording sessions, editing and the bonus.',
  },
  'cenik.nsNaFrekvenci': { cs: 'Normostran na frekvenci', en: 'Standard pages per session' },
  'cenik.delkaFrekvence': { cs: 'Délka frekvence (hodiny)', en: 'Session length (hours)' },
  'cenik.hodinovaSazba': {
    cs: 'Hodinová sazba pro rozpočet (Kč)',
    en: 'Hourly rate for the budget (CZK)',
  },
  'cenik.strihProcenta': {
    cs: 'Střih (% z počtu frekvencí)',
    en: 'Editing (% of the number of sessions)',
  },
  'cenik.strihProcentaPopis': {
    cs: '120 = o 20 % víc než natáčení',
    en: '120 = 20% more than recording',
  },
  'cenik.bonusZaNs': { cs: 'Bonus za normostranu (Kč)', en: 'Bonus per standard page (CZK)' },
  'cenik.priklad': { cs: 'Příklad — audiokniha {pocet} NS', en: 'Example — a {pocet} SP audiobook' },
  'cenik.nataceni': { cs: 'Natáčení', en: 'Recording' },
  'cenik.strih': { cs: 'Střih', en: 'Editing' },
  'cenik.bonus': { cs: 'Bonus', en: 'Bonus' },
  'cenik.nakladyCelkem': { cs: 'Náklady celkem', en: 'Total cost' },
  'cenik.ulozitParametry': { cs: 'Uložit parametry', en: 'Save the parameters' },
  'cenik.ulozeno': { cs: 'Uloženo.', en: 'Saved.' },

  // --- ceníky: výběr ikony ---
  'cenik.ikonaJmeno': { cs: 'Ikona: {nazev}', en: 'Icon: {nazev}' },
  'cenik.vybratIkonu': { cs: 'Vybrat ikonu', en: 'Choose an icon' },
  'cenik.zadnaIkona': { cs: 'Žádná ikona', en: 'No icon' },

  // --- archiv ---
  'archiv.nadpis': { cs: 'Archiv', en: 'Archive' },
  'archiv.uvod': {
    cs: 'Co se uložilo stranou, než se firma, účet nebo projekt smazal i s navázanými věcmi. Stažený soubor je JSON — kompletní data tak, jak byla v databázi. Portál je zpátky nenačte, ale dá se z nich vyčíst, co tam bylo.',
    en: 'What was put aside before a company, account or project was deleted along with everything attached to it. The downloaded file is JSON — the complete data exactly as it was in the database. The portal will not load it back, but you can read from it what was there.',
  },
  'archiv.prazdno': {
    cs: 'Archiv je prázdný — zatím se nic nemazalo s navázanými věcmi.',
    en: 'The archive is empty — nothing has been deleted with attached items yet.',
  },

  // sloupce tabulky archivu
  'archiv.sl.kdy': { cs: 'Kdy', en: 'When' },
  'archiv.sl.co': { cs: 'Co', en: 'What' },
  'archiv.sl.nazev': { cs: 'Název', en: 'Name' },
  'archiv.sl.obsah': { cs: 'Obsah', en: 'Contents' },
  'archiv.sl.kdo': { cs: 'Kdo', en: 'Who' },
  'archiv.sl.soubor': { cs: 'Soubor', en: 'File' },

  // druhy archivovaného záznamu - v rozhraní se berou odsud, ne z
  // POPISKY_DRUHU_ARCHIVU (to je česky i pro e-maily a soubory)
  'archiv.druh.firma': { cs: 'Firma', en: 'Company' },
  'archiv.druh.uzivatel': { cs: 'Uživatel', en: 'User' },
  'archiv.druh.projekt': { cs: 'Projekt', en: 'Project' },
  'archiv.druh.kalendar': { cs: 'Kalendář studia', en: 'Studio calendar' },
  'archiv.druh.jine': { cs: 'Jiné', en: 'Other' },

  'archiv.pocetZaznamu': { cs: '{pocet} záznamů', en: '{pocet} records' },
  'archiv.stahnout': { cs: 'Stáhnout ↓', en: 'Download ↓' },

  // --- firmy (kořen administrace) ---
  'firmy.nadpis': { cs: 'Firmy', en: 'Companies' },
  'firmy.vzoryZprav': { cs: 'Vzory zpráv klientovi', en: 'Message templates for the customer' },
  'firmy.vzoryNataceni': { cs: 'Vzory natáčecích textů', en: 'Recording text templates' },
  'firmy.technickeParametry': { cs: 'Technické parametry', en: 'Technical parameters' },
  'firmy.wikipedie': { cs: 'Wikipedie', en: 'Wikipedia' },
  'firmy.zpravyPortalu': { cs: 'Zprávy portálu', en: 'Portal messages' },
  'firmy.caflouFirmy': { cs: 'Firmy z Caflou (archiv)', en: 'Companies from Caflou (archive)' },
  'firmy.caflouTitle': {
    cs: 'Caflou už portál nepoužívá. Zůstává jen na dohledání starých údajů.',
    en: 'The portal no longer uses Caflou. It stays only for looking up old details.',
  },
  'firmy.zalozkaKlienti': { cs: 'Klienti', en: 'Clients' },
  'firmy.zalozkaDodavatele': { cs: 'Dodavatelé', en: 'Suppliers' },
  'firmy.hledatPlaceholder': {
    cs: 'Hledat firmu, IČ, kontakt…',
    en: 'Search a company, reg. no., contact…',
  },
  'firmy.hledaniPrazdne': { cs: 'Hledání nic nenašlo.', en: 'The search found nothing.' },
  'firmy.zadnyKlient': {
    cs: 'Zatím žádný klient. Založte prvního tlačítkem níže.',
    en: 'No customers yet. Create the first one with the button below.',
  },
  'firmy.zadnyDodavatel': {
    cs: 'Zatím žádný dodavatel. Založte prvního tlačítkem níže.',
    en: 'No suppliers yet. Create the first one with the button below.',
  },

  // sloupce přehledu firem
  'firmy.sl.firma': { cs: 'Firma', en: 'Company' },
  'firmy.sl.kod': { cs: 'Kód', en: 'Code' },
  'firmy.sl.sazba': { cs: 'Sazba / normostrana', en: 'Rate / standard page' },
  'firmy.sl.uzivatele': { cs: 'Uživatelé', en: 'Users' },
  'firmy.sl.objednavky': { cs: 'Objednávky', en: 'Orders' },
  'firmy.sl.kontaktniOsoba': { cs: 'Kontaktní osoba', en: 'Contact person' },
  'firmy.sl.spojeni': { cs: 'Telefon / e-mail', en: 'Phone / email' },
  'firmy.sl.ic': { cs: 'IČ', en: 'Reg. no.' },

  // --- firmy: formulář nové firmy ---
  'firmy.novyKlient': { cs: 'Nový klient', en: 'New customer' },
  'firmy.novyDodavatel': { cs: 'Nový dodavatel', en: 'New supplier' },
  'firmy.typFirmy': { cs: 'Typ firmy', en: 'Company type' },
  'firmy.klient': { cs: 'Klient', en: 'Customer' },
  'firmy.dodavatel': { cs: 'Dodavatel', en: 'Supplier' },
  'firmy.ic': { cs: 'IČ', en: 'Reg. no.' },
  'firmy.icNapoveda': {
    cs: 'vyplňte a načtěte zbytek z registru',
    en: 'fill it in and load the rest from the register',
  },
  'firmy.dic': { cs: 'DIČ', en: 'VAT no.' },
  'firmy.nacistZRegistru': { cs: 'Načíst z registru', en: 'Load from the register' },
  'firmy.nacistZRegistruTitle': {
    cs: 'Doplnit název, DIČ a adresu z veřejného registru podle IČ',
    en: 'Fill in the name, VAT no. and address from the public register by the registration number',
  },
  'firmy.registrSelhal': {
    cs: 'Načtení z registru se nezdařilo.',
    en: 'Loading from the register failed.',
  },
  'firmy.registrDoplneno': {
    cs: 'Údaje z registru doplněny — zkontrolujte a uložte.',
    en: 'The details from the register have been filled in — check them and save.',
  },
  'firmy.zalozeniSelhalo': {
    cs: 'Firmu se nepodařilo založit.',
    en: 'The company could not be created.',
  },
  'firmy.nazevFirmy': { cs: 'Název firmy', en: 'Company name' },
  'firmy.platceDph': { cs: 'Plátce DPH', en: 'VAT registered' },
  'firmy.ulice': { cs: 'Ulice a číslo popisné', en: 'Street and number' },
  'firmy.psc': { cs: 'PSČ', en: 'Postcode' },
  'firmy.mesto': { cs: 'Město', en: 'Town' },
  'firmy.zeme': { cs: 'Země', en: 'Country' },
  'firmy.cisloUctu': { cs: 'Číslo účtu', en: 'Account number' },
  'firmy.email': { cs: 'E-mail', en: 'Email' },
  'firmy.telefon': { cs: 'Telefon', en: 'Phone' },
  'firmy.druhZakazek': { cs: 'Druh zakázek', en: 'Kind of jobs' },
  'firmy.druhZakazekNapoveda': {
    cs: 'podle toho klient uvidí jen příslušný typ objednávky',
    en: 'this decides which order type the customer is shown',
  },
  'firmy.audioknihy': { cs: 'Audioknihy', en: 'Audiobooks' },
  'firmy.reklamy': { cs: 'Reklamy', en: 'Adverts' },
  'firmy.sazbaZaNs': {
    cs: 'Sazba za normostranu (Kč bez DPH)',
    en: 'Rate per standard page (CZK excl. VAT)',
  },
  'firmy.caflouId': { cs: 'ID firmy v Caflou', en: 'Company ID in Caflou' },
  'firmy.caflouIdNapoveda': {
    cs: 'podle tohoto ID se z Caflou tahají projekty této firmy - lze doplnit i později',
    en: 'this ID is what the company’s projects are pulled from Caflou by - it can be filled in later too',
  },
  'firmy.caflouIdPriklad': { cs: 'např. 12345', en: 'e.g. 12345' },
  'firmy.odkazNaDisk': { cs: 'Odkaz na složku Google Disk', en: 'Link to the Google Drive folder' },
  'firmy.ulozitFirmu': { cs: 'Uložit firmu', en: 'Save the company' },

  // --- firmy: výběr země (názvy zemí samotné zůstávají v lib/countries.ts česky) ---
  'firmy.vyberteZemi': { cs: 'Vyberte zemi', en: 'Choose a country' },
  'firmy.hledatZemi': { cs: 'Hledat zemi…', en: 'Search a country…' },
  'firmy.zadnaZemeNeodpovida': { cs: 'Nic neodpovídá.', en: 'Nothing matches.' },

  // Dávka 5 - administrace studií: src/app/(admin)/admin/studia/*.
  // Řádky k vložení do SLOVNIK v src/lib/jazyk.ts (merge dělá Ondřej).

  // --- správa studií ---
  'studia.nadpis': { cs: 'Studia', en: 'Studios' },
  'studia.noveStudio': { cs: 'Nové studio', en: 'New studio' },
  'studia.nazev': { cs: 'Název', en: 'Name' },
  'studia.zkratka': { cs: 'Zkratka', en: 'Short name' },
  'studia.mesto': { cs: 'Město', en: 'City' },
  'studia.odkazNaHovor': { cs: 'Odkaz na videohovor', en: 'Video call link' },
  'studia.odkazNaHovorPopis': {
    cs: 'v kalendáři se z něj stane ikonka u režie na dálku',
    en: 'in the calendar it turns into an icon on remote directing sessions',
  },
  // Kam se má host dostavit (30. 9. 2026) - jde to do pozvánky na natáčení.
  'studia.adresa': { cs: 'Adresa studia', en: 'Studio address' },
  'studia.adresaPopis': {
    cs: 'celá adresa do pozvánky na natáčení',
    en: 'the full address for the recording invitation',
  },
  'studia.mapa': { cs: 'Odkaz do map', en: 'Map link' },
  'studia.mapaPopis': {
    cs: 'prázdné = odkaz se složí z adresy',
    en: 'empty = the link is built from the address',
  },
  'studia.parkovani': { cs: 'Parkování', en: 'Parking' },
  'studia.parkovaniPopis': {
    cs: 'věta pro hosta — kde zaparkuje a co ho čeká',
    en: 'a sentence for the guest — where to park and what to expect',
  },
  'studia.zalozit': { cs: 'Založit', en: 'Create' },
  'studia.ulozeniSelhalo': { cs: 'Uložení se nezdařilo.', en: 'Saving failed.' },

  // --- pracovní doba studia ---
  'studia.pracovniDoba': { cs: 'Pracovní doba', en: 'Opening hours' },
  'studia.jenPoDomluve': { cs: 'jen po domluvě', en: 'by arrangement only' },
  'studia.ulozitPracovniDobu': { cs: 'Uložit pracovní dobu', en: 'Save the opening hours' },
  'studia.pracovniDobaUlozena': { cs: 'Pracovní doba uložena.', en: 'Opening hours saved.' },
  'studia.vyraditStudio': { cs: 'Vyřadit studio', en: 'Take the studio out of service' },
  'studia.vratitDoProvozu': { cs: 'Vrátit do provozu', en: 'Put it back into service' },
  'studia.zkratkyFrekvenci': { cs: 'Zkratky frekvencí', en: 'Recording session shortcuts' },

  // --- rezervace studia klienty ---
  'studia.rezervaceNadpis': { cs: 'Rezervace studia klienty', en: 'Customer studio bookings' },
  // Adresa stojí ve větě jinou barvou - vykresluje se přes prelozitKolem.
  'studia.rezervacePopis': {
    cs: 'Muzikanti a producenti si po pozvánce otevřou kalendář studia na adrese {adresa} a berou si volné termíny sami. Svoje rezervace vidí pojmenované, cizí jen jako obsazený čas — bez názvů.',
    en: 'Once invited, musicians and producers open the studio calendar at {adresa} and take the free slots themselves. They see their own bookings by name, everyone else’s only as busy time — with no names.',
  },
  'studia.qrKarticka': {
    cs: 'Kartička s QR kódem k vytištění (anglicky) ↗',
    en: 'Printable card with a QR code ↗',
  },
  'studia.zadneStudio': { cs: 'Žádné studio tu zatím není.', en: 'There are no studios here yet.' },
  'studia.otevritKalendar': { cs: 'Otevřít kalendář ↗', en: 'Open the calendar ↗' },
  'studia.rezervaceZapnute': { cs: 'Rezervace zapnuté', en: 'Bookings enabled' },
  'studia.bezPracovniDoby': {
    cs: 'Studio nemá vyplněnou pracovní dobu — dokud ji nedoplníte výš, nebude si klient mít co vybrat.',
    en: 'This studio has no opening hours — until you fill them in above, the customer will have nothing to choose from.',
  },
  'studia.nejkratsiRezervace': { cs: 'Nejkratší rezervace (min)', en: 'Shortest booking (min)' },
  'studia.dniDopredu': { cs: 'Dní dopředu (0 = bez limitu)', en: 'Days ahead (0 = no limit)' },
  'studia.nastaveniSelhalo': {
    cs: 'Nastavení se nepodařilo uložit.',
    en: 'The settings could not be saved.',
  },

  // --- pozvánka klienta do rezervací ---
  'studia.email': { cs: 'E-mail', en: 'Email' },
  'studia.emailPlaceholder': { cs: 'jméno@kapela.co.uk', en: 'name@band.co.uk' },
  'studia.jmenoNepovinne': { cs: 'Jméno (nepovinné)', en: 'Name (optional)' },
  'studia.poslatPozvanku': { cs: 'Poslat pozvánku', en: 'Send the invitation' },
  'studia.pozvankaOdeslana': {
    cs: 'Pozvánka odešla na {email}.',
    en: 'The invitation has been sent to {email}.',
  },
  'studia.pozvankaSelhala': {
    cs: 'Pozvánku se nepodařilo odeslat.',
    en: 'The invitation could not be sent.',
  },
  // Odkaz stojí ve větě jinou barvou - vykresluje se přes prelozitKolem.
  'studia.odkazRucne': {
    cs: 'Odkaz k předání ručně: {odkaz}',
    en: 'Link to pass on by hand: {odkaz}',
  },
  'studia.klientAktivni': { cs: 'aktivní', en: 'active' },
  'studia.klientCekaNaHeslo': {
    cs: 'čeká na nastavení hesla',
    en: 'waiting for a password to be set',
  },
  'studia.odebratPristup': { cs: 'Odebrat přístup', en: 'Remove access' },

  // --- tabule ve studiích ---
  'studia.tabuleNadpis': { cs: 'Tabule ve studiích', en: 'Studio boards' },
  'studia.tabulePopis': {
    cs: 'Dotykový displej ve studiu: dnešní program z kalendáře, poznámky a co ve studiu chybí. Adresu otevřete na displeji v prohlížeči přes celou obrazovku, nebo se na počítači u displeje přihlaste účtem tabule. Když někdo ťukne, že něco chybí, Bruno napíše Báře Šiblové.',
    en: 'A touchscreen in the studio: today’s schedule from the calendar, notes and what the studio has run out of. Open the address on the display in a full-screen browser, or sign in on the computer by the display with the board account. When someone taps that something is missing, Bruno messages Bára Šiblová.',
  },
  'studia.otevritTabuli': { cs: 'Otevřít tabuli ↗', en: 'Open the board ↗' },
  'studia.kopirovatAdresu': { cs: 'Kopírovat adresu', en: 'Copy the address' },
  'studia.novaAdresa': { cs: 'Nová adresa', en: 'New address' },
  'studia.vypnout': { cs: 'Vypnout', en: 'Switch off' },
  'studia.zapnoutTabuli': { cs: 'Zapnout tabuli', en: 'Switch the board on' },
  'studia.potvrditNovaAdresa': {
    cs: 'Vyměnit adresu? Displej se starou adresou přestane fungovat a bude potřeba otevřít novou.',
    en: 'Change the address? The display on the old address will stop working and the new one will have to be opened.',
  },
  'studia.potvrditVypnoutTabuli': {
    cs: 'Vypnout tabuli? Displej ve studiu přestane fungovat.',
    en: 'Switch the board off? The display in the studio will stop working.',
  },

  // --- účet počítače u obrazovky ---
  'studia.ucetTabule': { cs: 'Účet tabule', en: 'Board account' },
  'studia.jmenoPopisek': { cs: 'jméno', en: 'username' },
  'studia.vytvoritUcet': {
    cs: 'Vytvořit účet pro obrazovku',
    en: 'Create an account for the display',
  },
  'studia.ucetSelhal': { cs: 'Účet se nepodařilo založit.', en: 'The account could not be created.' },
  'studia.hesloNa1111': { cs: 'Heslo na 1111', en: 'Password back to 1111' },
  'studia.potvrditHeslo': {
    cs: 'Nastavit heslo zpátky na 1111?',
    en: 'Set the password back to 1111?',
  },
  'studia.potvrditZrusitUcet': {
    cs: 'Zrušit účet tabule? Počítač u obrazovky se už nepřihlásí (běžící tabule poběží dál, dokud nevyměníte adresu).',
    en: 'Cancel the board account? The computer by the display will no longer sign in (a board already running keeps going until you change the address).',
  },
  // Jméno i heslo stojí ve větě tlustě - vykresluje se přes prelozitKolem.
  'studia.udajeTabule': {
    cs: 'Přihlášení na počítači u obrazovky: jméno {login}, heslo {heslo}.',
    en: 'Sign-in on the computer by the display: username {login}, password {heslo}.',
  },

  // --- Instagram na tabuli ---
  'studia.igPribehy': {
    cs: 'příběhy se ukazují na tabulích, které to mají zapnuté',
    en: 'stories show on the boards that have it switched on',
  },
  'studia.igPripojit': { cs: 'Připojit Instagram', en: 'Connect Instagram' },
  'studia.igPripojitZnovu': { cs: 'Připojit znovu', en: 'Connect again' },
  'studia.igOdpojit': { cs: 'Odpojit', en: 'Disconnect' },
  'studia.potvrditOdpojitInstagram': {
    cs: 'Odpojit Instagram? Z tabulí zmizí okno s příběhy.',
    en: 'Disconnect Instagram? The stories panel will disappear from the boards.',
  },
  'studia.igCekaNaAplikaci': {
    cs: 'Čeká na aplikaci v Meta for Developers - na Vercelu chybí INSTAGRAM_APP_ID a INSTAGRAM_APP_SECRET.',
    en: 'Waiting for an app in Meta for Developers — INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET are missing on Vercel.',
  },
  'studia.igPripojeno': { cs: 'Instagram je připojený.', en: 'Instagram is connected.' },
  'studia.igPripojeniSelhalo': {
    cs: 'Připojení se nepovedlo: {duvod}',
    en: 'Connecting failed: {duvod}',
  },
  'studia.igPosledniNacteni': { cs: 'Poslední načtení: {chyba}', en: 'Last refresh: {chyba}' },
  'studia.igUkazovat': {
    cs: 'Ukazovat na tabuli příběhy z Instagramu',
    en: 'Show Instagram stories on the board',
  },
  'studia.igBezJmena': { cs: '(bez jména)', en: '(no name)' },

  // --- co ve studiu chybí a poznámky z tabule ---
  'studia.chybi': { cs: 'Chybí', en: 'Missing' },
  'studia.nicNechybi': { cs: 'Nic.', en: 'Nothing.' },
  'studia.doplneno': { cs: 'Doplněno', en: 'Restocked' },
  'studia.poznamky': { cs: 'Poznámky', en: 'Notes' },
  'studia.zadnePoznamky': { cs: 'Žádné.', en: 'None.' },
  'studia.odskrtnout': { cs: 'Odškrtnout', en: 'Tick off' },

  // =====================================================================
  // DÁVKA 5 — (portal)/kalendar/CalendarBrowser.tsx
  // Řádky k vložení do SLOVNIK v src/lib/jazyk.ts. Merge dělá Ondřej.
  // =====================================================================

  // --- kalendář: hlavička a posun v čase ---
  'kalendar.nadpis': { cs: 'Kalendář', en: 'Calendar' },
  'kalendar.dnes': { cs: 'Dnes', en: 'Today' },
  'kalendar.predchozi': { cs: 'Předchozí', en: 'Previous' },
  'kalendar.dalsi': { cs: 'Další', en: 'Next' },
  'kalendar.pohled.den': { cs: 'Den', en: 'Day' },
  'kalendar.pohled.tyden': { cs: 'Týden', en: 'Week' },
  'kalendar.pohled.mesic': { cs: 'Měsíc', en: 'Month' },
  'kalendar.celaObrazovka': { cs: 'Celá obrazovka', en: 'Full screen' },
  'kalendar.zpetZCeleObrazovky': { cs: 'Zpět z celé obrazovky', en: 'Leave full screen' },
  'kalendar.zpetZCeleObrazovkyEsc': { cs: 'Zpět z celé obrazovky (Esc)', en: 'Leave full screen (Esc)' },
  'kalendar.pridat': { cs: 'Přidat', en: 'Add' },
  'kalendar.pridatUdalost': { cs: 'Přidat událost', en: 'Add an event' },

  // --- kalendář: hledání ---
  'kalendar.hledatKratce': { cs: 'Hledat…', en: 'Search…' },
  'kalendar.hledatPlaceholder': {
    cs: 'Hledat projekt, herce nebo zvukaře…',
    en: 'Search for a project, narrator or sound engineer…',
  },
  'kalendar.hledatPopis': {
    cs: 'Hledat projekt, herce nebo zvukaře',
    en: 'Search for a project, narrator or sound engineer',
  },

  // --- kalendář: štítky kalendářů a sólo ---
  'kalendar.zapnoutKalendar': { cs: 'Zapnout {nazev}', en: 'Show {nazev}' },
  'kalendar.vypnoutKalendar': { cs: 'Vypnout {nazev}', en: 'Hide {nazev}' },
  'kalendar.docasneJen': { cs: 'Dočasně jen {nazev} (sólo)', en: 'Temporarily just {nazev} (solo)' },
  'kalendar.zpetNaVyber': {
    cs: 'Zpět na původní výběr kalendářů',
    en: 'Back to the original choice of calendars',
  },
  'kalendar.jenMoje': { cs: 'Jen moje události', en: 'My events only' },
  'kalendar.jenMojeSolo': { cs: 'Jen moje události (sólo)', en: 'My events only (solo)' },
  'kalendar.soloStitek': { cs: 'SÓLO: {nazev}', en: 'SOLO: {nazev}' },
  'kalendar.soloZpet': { cs: 'zpět na výběr', en: 'back to the selection' },
  'kalendar.vratitZaskrtnuti': {
    cs: 'Vrátit zaškrtnutí kalendářů, jaké bylo před sólem',
    en: 'Restore the calendars ticked before solo',
  },
  // Názvy kalendářů, které nejsou studio (v lib/nepritomnost.ts a lib/porady.ts
  // jsou česky - bere si je i server a e-maily).
  'kalendar.kalendarMimo': { cs: 'Mimo studio', en: 'Out of the studio' },
  'kalendar.kalendarPorady': { cs: 'Porady', en: 'Meetings' },
  'kalendar.kalendarSchuzky': { cs: 'Schůzky', en: 'Appointments' },

  // --- kalendář: mřížka dne a týdne ---
  'kalendar.dnesADen': { cs: 'Dnes · {den}', en: 'Today · {den}' },
  'kalendar.jenPoDomluve': {
    cs: 'Jen po domluvě se zvukařem',
    en: 'Only by arrangement with the sound engineer',
  },
  'kalendar.bezProjektu': { cs: '· bez projektu', en: '· no project' },

  // --- kalendář: měsíční pohled ---
  'kalendar.cisloDneADnes': { cs: '{cislo} · dnes', en: '{cislo} · today' },
  'kalendar.dalsiUdalosti': { cs: '+{pocet} další', en: '+{pocet} more' },

  // --- kalendář: druhy blokace (kódy z BLOCK_KIND_LABELS v lib/calendar.ts) ---
  'kalendar.druh.NATACENI': { cs: 'Natáčení', en: 'Recording' },
  'kalendar.druh.STRIH': { cs: 'Střih', en: 'Editing' },
  'kalendar.druh.CASTING': { cs: 'Casting', en: 'Casting' },
  'kalendar.druh.HOLIDAY': { cs: 'Svátek', en: 'Public holiday' },
  'kalendar.druh.VACATION': { cs: 'Dovolená', en: 'Holiday' },
  'kalendar.druh.MAINTENANCE': { cs: 'Údržba', en: 'Maintenance' },
  'kalendar.druh.UKLID': { cs: 'Úklid studia', en: 'Studio cleaning' },
  'kalendar.uklidBezUdaju': {
    cs: 'U úklidu stačí studio a čas — nic dalšího se nevyplňuje.',
    en: 'Cleaning needs only the studio and the time — nothing else to fill in.',
  },
  'kalendar.druh.INTERNAL': { cs: 'Interní blokace', en: 'Internal block' },
  'kalendar.druh.OTHER': { cs: 'Jiné', en: 'Other' },
  // Kód zůstal BOOKING, popisek je od 28. 9. 2026 „Externí pronájem".
  'kalendar.druh.BOOKING': { cs: 'Externí pronájem', en: 'External hire' },
  'kalendar.blokace': { cs: 'Blokace', en: 'Block' },

  // --- kalendář: stavy termínu z nabídky (SLOT_STATE_LABELS) ---
  'kalendar.stav.OFFERED': { cs: 'Nabídnuto', en: 'Offered' },
  'kalendar.stav.SELECTED': { cs: 'Drženo', en: 'Held' },
  'kalendar.stav.CONFIRMED': { cs: 'Potvrzeno', en: 'Confirmed' },
  'kalendar.stav.RELEASED': { cs: 'Uvolněno', en: 'Released' },
  'kalendar.stav.CANCELLED': { cs: 'Zrušeno', en: 'Cancelled' },

  // --- kalendář: porada v detailu události ---
  'kalendar.porada': { cs: 'Porada', en: 'Meeting' },
  'kalendar.poradaSOpakovanim': { cs: 'Porada · {opakovani}', en: 'Meeting · {opakovani}' },
  // Opakování porady (MOZNOSTI_OPAKOVANI v lib/porady.ts). Stejné popisky si
  // nejspíš zavede i formulář porad - při merge zkontrolovat duplicitu.
  'kalendar.opakovani.NE': { cs: 'Neopakovat', en: 'Do not repeat' },
  'kalendar.opakovani.DENNE': { cs: 'Každý den', en: 'Every day' },
  'kalendar.opakovani.PRACOVNI_DNY': { cs: 'Každý pracovní den (po–pá)', en: 'Every working day (Mon–Fri)' },
  'kalendar.opakovani.TYDNE': { cs: 'Každý týden', en: 'Every week' },
  'kalendar.opakovani.KAZDE_DVA_TYDNY': { cs: 'Každé dva týdny', en: 'Every two weeks' },
  'kalendar.opakovani.MESICNE': { cs: 'Každý měsíc', en: 'Every month' },

  // --- kalendář: okno události (nová i úprava) ---
  'kalendar.upravaFrekvence': { cs: 'Úprava frekvence', en: 'Edit recording session' },
  'kalendar.upravaUdalosti': { cs: 'Úprava události', en: 'Edit event' },
  'kalendar.novaUdalost': { cs: 'Nová událost', en: 'New event' },
  'kalendar.poleDruh': { cs: 'Druh', en: 'Kind' },
  'kalendar.poleKalendar': { cs: 'Kalendář', en: 'Calendar' },
  'kalendar.poleDatum': { cs: 'Datum', en: 'Date' },
  'kalendar.poleOd': { cs: 'Od', en: 'From' },
  'kalendar.poleDo': { cs: 'Do', en: 'To' },
  'kalendar.delkaHodin': { cs: '{hodin} h', en: '{hodin} h' },
  'kalendar.delkaHodinMistni': {
    cs: '{hodin} h · místní čas studia',
    en: '{hodin} h · studio local time',
  },
  'kalendar.konecPoZacatku': { cs: 'Konec musí být po začátku.', en: 'The end must be after the start.' },
  'kalendar.poleProjekt': { cs: 'Projekt', en: 'Project' },
  'kalendar.poleHerec': { cs: 'Herec', en: 'Narrator' },
  'kalendar.napisteJmenoHerce': { cs: 'Napište jméno herce…', en: 'Type the narrator’s name…' },
  'kalendar.zacnetePsatHerce': {
    cs: 'Začněte psát jméno herce…',
    en: 'Start typing the narrator’s name…',
  },
  'kalendar.herceNenasli': {
    cs: 'Takového herce jsme nenašli. Zkuste jen příjmení.',
    en: 'We could not find that narrator. Try the surname only.',
  },
  'kalendar.zrusitVyberHerce': { cs: 'Zrušit výběr herce', en: 'Clear the narrator' },
  'kalendar.poleZvukar': { cs: 'Zvukař', en: 'Sound engineer' },
  'kalendar.jenZeStudia': { cs: '· jen {nazev}', en: '· {nazev} only' },
  'kalendar.tohotoStudia': { cs: 'tohoto studia', en: 'this studio' },
  'kalendar.zacnetePsatZvukare': {
    cs: 'Začněte psát jméno zvukaře…',
    en: 'Start typing the sound engineer’s name…',
  },
  'kalendar.zvukareNemame': {
    cs: 'V tomhle studiu takového zvukaře nemáme. Studia se zaškrtávají na kartě uživatele.',
    en: 'We have no such sound engineer in this studio. Studios are ticked on the user’s card.',
  },
  'kalendar.zrusitVyberZvukare': { cs: 'Zrušit výběr zvukaře', en: 'Clear the sound engineer' },
  'kalendar.polePopis': { cs: 'Popis', en: 'Description' },
  'kalendar.popisPlaceholder': { cs: 'Servis techniky', en: 'Equipment servicing' },
  // Externí pronájem studia (28. 9. 2026) - místo obecného „Popis".
  'kalendar.poleKdoPronajima': { cs: 'Kdo si studio pronajímá', en: 'Who is hiring the studio' },
  'kalendar.pronajemPlaceholder': { cs: 'Jméno nebo firma', en: 'Name or company' },

  // --- kalendář: režie na dálku ---
  'kalendar.rezieNaDalku': { cs: 'Režie na dálku', en: 'Remote direction' },
  'kalendar.rezieNaDalkuPopis': {
    cs: 'Červený rámeček a telefon v kalendáři. Samo se to zaškrtne u první frekvence herce na projektu a u každého castingu — tady jde odškrtnout.',
    en: 'A red border and a phone in the calendar. It ticks itself on a narrator’s first recording session on a project and on every casting — here you can untick it.',
  },
  'kalendar.rezieIkona': {
    cs: 'Režie na dálku — první frekvence s hercem',
    en: 'Remote direction — the first session with the narrator',
  },
  'kalendar.rezieIkonaHovor': {
    cs: 'Režie na dálku — první frekvence s hercem — připojit se k hovoru',
    en: 'Remote direction — the first session with the narrator — join the call',
  },
  'kalendar.strihaExterne': {
    cs: 'Stříhá externě, ve studiu nesedí',
    en: 'Editing externally, not sitting in the studio',
  },

  // --- kalendář: poznámka a úkol z ní ---
  'kalendar.polePoznamka': { cs: 'Poznámka', en: 'Note' },
  'kalendar.poznamkaPlaceholder': {
    cs: 'Vzkaz pro tým - třeba co se bude točit, co připravit…',
    en: 'A message for the team — what will be recorded, what to prepare…',
  },
  // {znacka} a {kdo} jsou tučné kousky věty - vysází je vetaSeZnackami.
  'kalendar.ukolZPoznamky': {
    cs: 'Napište {znacka} a za to, co je potřeba udělat — z poznámky se stane úkol pro {kdo}.',
    en: 'Type {znacka} followed by what needs doing — the note becomes a task for {kdo}.',
  },
  // Značka, kterou hledá chat - v obou jazycích stejná, nepřekládat.
  'kalendar.znackaUkol': { cs: '@úkol', en: '@úkol' },
  'kalendar.ukolProZvukare': {
    cs: 'zvukaře u téhle události',
    en: 'the sound engineer on this event',
  },
  'kalendar.ukolBezZvukare': {
    cs: 'Když u ní zvukař zatím není, kalendář počká; když se vymění, úkol se přestěhuje.',
    en: 'If it has no sound engineer yet, the calendar waits; if they change, the task moves with them.',
  },

  // --- kalendář: předělání frekvence na jiný druh ---
  'kalendar.frekvenceNaCasting': {
    cs: 'Frekvence se zruší a na jejím místě vznikne casting v kalendáři. Herec dostane oznámení.',
    en: 'The recording session will be cancelled and a casting will take its place in the calendar. The narrator will be notified.',
  },
  'kalendar.frekvenceNaStrih': {
    cs: 'Frekvence se zruší a na jejím místě vznikne střih v kalendáři. Herec dostane oznámení.',
    en: 'The recording session will be cancelled and an editing session will take its place in the calendar. The narrator will be notified.',
  },
  'kalendar.frekvenceNaUdalost': {
    cs: 'Frekvence se zruší a na jejím místě vznikne událost v kalendáři. Herec dostane oznámení.',
    en: 'The recording session will be cancelled and an event will take its place in the calendar. The narrator will be notified.',
  },

  // --- kalendář: ukládání, mazání a rušení ---
  'kalendar.ulozeniSelhalo': { cs: 'Událost se nepodařilo uložit.', en: 'The event could not be saved.' },
  'kalendar.ulozitITak': { cs: 'Uložit i tak', en: 'Save anyway' },
  'kalendar.ulozitZmeny': { cs: 'Uložit změny', en: 'Save changes' },
  'kalendar.pridatDoKalendare': { cs: 'Přidat do kalendáře', en: 'Add to the calendar' },
  'kalendar.pridatPocet': { cs: 'Přidat do kalendáře ({pocet})', en: 'Add to the calendar ({pocet})' },
  'kalendar.planovaniZapnout': { cs: 'Naplánovat víc dnů najednou', en: 'Plan several days at once' },
  'kalendar.planovaniVypnout': { cs: 'Zpět na jednu událost', en: 'Back to a single event' },
  'kalendar.planovaniDny': { cs: 'Dny v týdnu', en: 'Days of the week' },
  'kalendar.planovaniPopis': {
    cs: 'Druh, studio, projekt, herec i zvukař platí pro všechny vybrané dny a čas je u všech stejný – jednotlivé dny se pak doladí tažením přímo v kalendáři.',
    en: 'Kind, studio, project, actor and engineer apply to every selected day and they all share the same time – adjust individual days by dragging them in the calendar.',
  },
  'kalendar.planovaniCastSelhala': {
    cs: 'Nepovedlo se zapsat: {dny}. {duvod}',
    en: 'These days could not be saved: {dny}. {duvod}',
  },
  'kalendar.smazatUdalost': { cs: 'Smazat událost', en: 'Delete the event' },
  'kalendar.opravduSmazatUdalost': {
    cs: 'Opravdu smazat tuhle událost z kalendáře?',
    en: 'Really delete this event from the calendar?',
  },
  'kalendar.smazaniSelhalo': { cs: 'Událost se nepodařilo smazat.', en: 'The event could not be deleted.' },
  'kalendar.zrusitFrekvenci': { cs: 'Zrušit frekvenci', en: 'Cancel the recording session' },
  'kalendar.opravduZrusitFrekvenci': {
    cs: 'Zrušit tuhle frekvenci? Herec dostane oznámení.',
    en: 'Cancel this recording session? The narrator will be notified.',
  },
  'kalendar.zruseniSelhalo': {
    cs: 'Frekvenci se nepodařilo zrušit.',
    en: 'The recording session could not be cancelled.',
  },
  'kalendar.zapisDoKalendare': {
    cs: 'Zápis do kalendáře. Nabídku termínů herci zakládáte tlačítkem v detailu projektu.',
    en: 'This only writes into the calendar. You offer sessions to the narrator with the button in the project detail.',
  },

  // --- kalendář: bublina s detailem události ---
  'kalendar.kliknutimZavrit': { cs: 'Klikni pro zavření', en: 'Click to close' },
  'kalendar.herecJmeno': { cs: 'Herec: {jmeno}', en: 'Narrator: {jmeno}' },
  'kalendar.projektNeni': { cs: 'Projekt není vyplněný.', en: 'The project is not filled in.' },
  'kalendar.projektNeniSDvojklikem': {
    cs: 'Projekt není vyplněný — doplníte ho dvojklikem na událost.',
    en: 'The project is not filled in — double-click the event to add it.',
  },
  'kalendar.pripojitSeKHovoru': { cs: '▶ Připojit se k hovoru', en: '▶ Join the call' },
  'kalendar.odkazProjekt': { cs: 'Projekt', en: 'Project' },
  'kalendar.odkazNabidkaTerminu': { cs: 'Nabídka termínů', en: 'Session offer' },

  // ===========================================================================
  // DÁVKA 5 - KALENDÁŘ (zbytek složky (portal)/kalendar)
  // Řádky k vložení do SLOVNIK v src/lib/jazyk.ts. Čeština je zdroj pravdy,
  // angličtina je britská. CalendarBrowser.tsx si nese vlastní klíče.
  // ===========================================================================

  // --- stránka Kalendář (server) ---
  'kalendarStranka.nadpis': { cs: 'Kalendář', en: 'Calendar' },
  'kalendarStranka.zadneStudio': {
    cs: 'Zatím tu není žádné studio. Studia se zakládají v administraci.',
    en: 'There are no studios yet. Studios are set up in the administration.',
  },

  // --- nepřítomnost (kalendář Mimo studio) ---
  'nepritomnost.mimoStudio': { cs: 'Mimo studio', en: 'Out of the studio' },
  'nepritomnost.cipPopis': {
    cs: 'Mimo studio: {jmeno} · {rozsah}',
    en: 'Out of the studio: {jmeno} · {rozsah}',
  },
  'nepritomnost.klepnutimUpravite': { cs: 'Klepnutím upravíte.', en: 'Tap to edit.' },
  'nepritomnost.pruhBublina': {
    cs: 'Celodenní události v kalendáři Mimo studio',
    en: 'All-day entries in the Out of the studio calendar',
  },
  'nepritomnost.dvojklikCelyDen': {
    cs: 'Dvojklikem zapíšete celý den mimo studio',
    en: 'Double-click to log a whole day out of studio',
  },
  'nepritomnost.nadpisUprava': { cs: 'Úprava — mimo studio', en: 'Editing — out of studio' },
  'nepritomnost.mistoTohoPorada': { cs: 'Místo toho porada →', en: 'A meeting instead →' },
  'nepritomnost.osoba': { cs: 'Osoba', en: 'Person' },
  'nepritomnost.zacnetePsatJmeno': { cs: 'Začněte psát jméno…', en: 'Start typing a name…' },
  'nepritomnost.nikdoTakovy': {
    cs: 'Takového člověka v týmu nemáme.',
    en: 'There is nobody like that on the team.',
  },
  'nepritomnost.zpatkyNaMe': { cs: 'Zpátky na mě', en: 'Back to me' },
  'nepritomnost.celyDen': { cs: 'Celý den', en: 'All day' },
  'nepritomnost.den': { cs: 'Den', en: 'Day' },
  'nepritomnost.od': { cs: 'Od', en: 'From' },
  'nepritomnost.doVcetne': { cs: 'Do (včetně)', en: 'To (inclusive)' },
  'nepritomnost.pocetDni': { cs: 'Počet dní', en: 'Number of days' },
  'nepritomnost.casOd': { cs: 'Čas od', en: 'Time from' },
  'nepritomnost.casDo': { cs: 'Čas do', en: 'Time to' },
  'nepritomnost.zapiseSe': {
    cs: 'Zapíše se {pocet}× — v každém dni {od}–{do}.',
    en: 'It will be logged {pocet} times — {od}–{do} on each day.',
  },
  'nepritomnost.chybaPoradiDnu': {
    cs: 'Poslední den nesmí být před prvním.',
    en: 'The last day cannot be before the first.',
  },
  'nepritomnost.chybaNejvicDni': {
    cs: 'Najednou jde zapsat nejvýš {pocet} dní.',
    en: 'You can log at most {pocet} days at once.',
  },
  'nepritomnost.chybaKonecPoZacatku': {
    cs: 'Konec musí být po začátku.',
    en: 'The end must be after the start.',
  },
  'nepritomnost.chybaUlozeni': { cs: 'Uložit se nepodařilo.', en: 'It could not be saved.' },
  'nepritomnost.ulozitZmeny': { cs: 'Uložit změny', en: 'Save changes' },
  'nepritomnost.zapsat': { cs: 'Zapsat', en: 'Log it' },

  // --- porady a další schůzky ---
  'porady.nadpisUpravaPorada': { cs: 'Úprava — porada', en: 'Editing — meeting' },
  'porady.nadpisUpravaSchuzka': { cs: 'Úprava — schůzka', en: 'Editing — appointment' },
  'porady.nadpisNovaPorada': { cs: 'Nová porada', en: 'New meeting' },
  'porady.nadpisNovaSchuzka': { cs: 'Nová schůzka', en: 'New appointment' },
  'porady.nazev': { cs: 'Název', en: 'Name' },
  'porady.nazevPlaceholder': { cs: 'Porada produkce', en: 'Production meeting' },
  'porady.zacatekRady': { cs: 'Začátek řady', en: 'Start of the series' },
  'porady.den': { cs: 'Den', en: 'Day' },
  'porady.od': { cs: 'Od', en: 'From' },
  'porady.do': { cs: 'Do', en: 'To' },
  'porady.chybaKonecPoZacatku': {
    cs: 'Konec musí být po začátku.',
    en: 'The end must be after the start.',
  },
  // Druhá část věty je šedá - značka {tise} říká, kde se věta rozdělí.
  'porady.kdoJeNaPorade': {
    cs: 'Kdo je na poradě {tise}· uvidí ji jen oni',
    en: 'Who is in the meeting {tise}· only they can see it',
  },
  'porady.zakladatelVzdy': {
    cs: 'Na poradě, kterou zakládáte, jste vždycky',
    en: 'You are always in a meeting you set up yourself',
  },
  'porady.jaZavorka': { cs: '{jmeno} (já)', en: '{jmeno} (me)' },
  'porady.opakovani': { cs: 'Opakování', en: 'Repeat' },
  'porady.opakovaniNe': { cs: 'Neopakovat', en: 'Do not repeat' },
  'porady.opakovaniDenne': { cs: 'Každý den', en: 'Every day' },
  'porady.opakovaniPracovniDny': {
    cs: 'Každý pracovní den (po–pá)',
    en: 'Every working day (Mon–Fri)',
  },
  'porady.opakovaniTydne': { cs: 'Každý týden', en: 'Every week' },
  'porady.opakovaniDvaTydny': { cs: 'Každé dva týdny', en: 'Every two weeks' },
  'porady.opakovaniMesicne': { cs: 'Každý měsíc', en: 'Every month' },
  'porady.opakovatDo': {
    cs: 'Opakovat do {tise}· nepovinné',
    en: 'Repeat until {tise}· optional',
  },
  'porady.odkazVideo': {
    cs: 'Odkaz na videohovor {tise}· Meet, Zoom, Teams…',
    en: 'Video call link {tise}· Meet, Zoom, Teams…',
  },
  'porady.poznamka': { cs: 'Poznámka {tise}· nepovinné', en: 'Note {tise}· optional' },
  'porady.chybaUlozeni': { cs: 'Uložit se nepodařilo.', en: 'It could not be saved.' },
  'porady.chybaZruseni': { cs: 'Zrušit se nepodařilo.', en: 'It could not be cancelled.' },
  'porady.ulozitCelouRadu': { cs: 'Uložit celou řadu', en: 'Save the whole series' },
  'porady.ulozitZmeny': { cs: 'Uložit změny', en: 'Save changes' },
  'porady.zalozitPoradu': { cs: 'Založit poradu', en: 'Set up the meeting' },
  'porady.opravduZrusitVyskyt': {
    cs: 'Opravdu zrušit tento termín?',
    en: 'Really cancel this occurrence?',
  },
  'porady.zrusitJenTento': { cs: 'Zrušit jen tento termín', en: 'Cancel just this occurrence' },
  'porady.opravduZrusitRadu': {
    cs: 'Opravdu zrušit celou řadu?',
    en: 'Really cancel the whole series?',
  },
  'porady.opravduZrusit': { cs: 'Opravdu zrušit?', en: 'Really cancel?' },
  'porady.zrusitCelouRadu': { cs: 'Zrušit celou řadu', en: 'Cancel the whole series' },
  'porady.zrusitPoradu': { cs: 'Zrušit poradu', en: 'Cancel the meeting' },
  'porady.zrusitSchuzku': { cs: 'Zrušit schůzku', en: 'Cancel the appointment' },
  'porady.vysvetleniPorada': {
    cs: 'Poradu vidí jen pozvaní. O pozvání, změně i zrušení jim přijde zpráva pod zvonek.',
    en: 'Only the people invited can see the meeting. They get a message under the bell when they are invited and when it changes or is cancelled.',
  },
  'porady.vysvetleniSchuzka': {
    cs: 'Schůzky vidí celá produkce, ne jen pozvaní. Komu ji tu zaškrtnete, tomu o ní přijde zpráva pod zvonek.',
    en: 'Appointments are visible to the whole production team, not only to the people invited. Everyone you tick here gets a message about it under the bell.',
  },

  // --- konflikty v kalendáři ---
  'konflikty.popisekPocet': {
    cs: 'Konflikty v kalendáři: {pocet}',
    en: 'Clashes in the calendar: {pocet}',
  },
  'konflikty.popisekZadne': {
    cs: 'Konflikty v kalendáři: žádné, {pocet} odklepnutých jako záměr',
    en: 'Clashes in the calendar: none, {pocet} signed off as intended',
  },
  'konflikty.bublinaPocet': {
    cs: 'Kde se dvě věci perou ({pocet})',
    en: 'Where two things clash ({pocet})',
  },
  'konflikty.bublinaZadne': {
    cs: 'Žádný konflikt - {pocet} odklepnutých jako záměr',
    en: 'No clashes — {pocet} signed off as intended',
  },
  'konflikty.nejblizsichDni': { cs: 'Nejbližších {pocet} dní', en: 'Next {pocet} days' },
  'konflikty.nadpisMoje': {
    cs: 'Moje ({pocet}) — vidíte je jen vy',
    en: 'Mine ({pocet}) — only you can see them',
  },
  'konflikty.nadpisProvoz': {
    cs: 'Natáčení ({pocet}) — kde jste označený',
    en: 'Recording ({pocet}) — where you are named',
  },
  'konflikty.nadpisOdklepnute': {
    cs: 'Odklepnuté jako záměr ({pocet})',
    en: 'Signed off as intended ({pocet})',
  },
  'konflikty.jeToZamer': { cs: 'Je to záměr', en: 'It is intended' },
  'konflikty.jeToZamerBublina': {
    cs: 'Tenhle překryv je schválně - přestaň na něj upozorňovat',
    en: 'This overlap is deliberate — stop flagging it',
  },
  'konflikty.vracim': { cs: 'Vracím…', en: 'Bringing it back…' },
  'konflikty.vratit': { cs: 'Vrátit', en: 'Bring it back' },
  'konflikty.vysvetleni': {
    cs: 'Portál nic nezakazuje — jen ukazuje, kde se to pere. Co je schválně, odklepněte tlačítkem „Je to záměr".',
    en: 'The portal forbids nothing — it only shows where things clash. Sign off anything deliberate with the “It is intended” button.',
  },

  // --- historie kalendáře ---
  'historieKalendare.nazev': { cs: 'Historie kalendáře', en: 'Calendar history' },
  'historieKalendare.bublina': {
    cs: 'Kdo kdy co v kalendáři změnil',
    en: 'Who changed what in the calendar, and when',
  },
  'historieKalendare.akceVznik': { cs: 'zapsal(a)', en: 'logged' },
  'historieKalendare.akceUprava': { cs: 'upravil(a)', en: 'edited' },
  'historieKalendare.akceZruseni': { cs: 'zrušil(a)', en: 'cancelled' },
  'historieKalendare.typSlot': { cs: 'Natáčení', en: 'Recording' },
  'historieKalendare.typBlok': { cs: 'Událost', en: 'Entry' },
  'historieKalendare.typPorada': { cs: 'Porada', en: 'Meeting' },
  'historieKalendare.typSchuzka': { cs: 'Schůzka', en: 'Appointment' },
  'historieKalendare.typMimo': { cs: 'Mimo studio', en: 'Out of the studio' },

  // --- seznam výskytů (hledání v celém kalendáři) ---
  'vyskyty.hledam': { cs: 'Hledám v celém kalendáři…', en: 'Searching the whole calendar…' },
  'vyskyty.pocet': {
    cs: 'Výskyty v kalendáři: {pocet}',
    en: 'Occurrences in the calendar: {pocet}',
  },
  'vyskyty.pocetZobrazeno': {
    cs: 'Výskyty v kalendáři: {pocet} (ukazuju {zobrazeno})',
    en: 'Occurrences in the calendar: {pocet} (showing {zobrazeno})',
  },
  'vyskyty.dotaz': { cs: '„{dotaz}"', en: '“{dotaz}”' },
  'vyskyty.zavritSeznam': { cs: 'Zavřít seznam', en: 'Close the list' },
  'vyskyty.kolikrat': { cs: '{pocet}×', en: '{pocet}×' },
  'vyskyty.nicNenalezeno': {
    cs: 'Nic takového v kalendáři není. Zkuste jen příjmení nebo část názvu projektu.',
    en: 'There is nothing like that in the calendar. Try just the surname or part of the project name.',
  },
  'vyskyty.otevritDen': { cs: 'Otevřít ten den v kalendáři', en: 'Open that day in the calendar' },
  'vyskyty.zvukarJmeno': { cs: 'zvukař {jmeno}', en: 'sound engineer {jmeno}' },

  // --- odběr kalendáře (MS kalendář do telefonu) ---
  'odberKalendare.tlacitko': {
    cs: 'Přidat MS kalendář do svého kalendáře (Google, Apple, Outlook)',
    en: 'Add the MS calendar to your own calendar (Google, Apple, Outlook)',
  },
  'odberKalendare.nadpis': {
    cs: 'MS kalendář do mého kalendáře',
    en: 'The MS calendar in my calendar',
  },
  'odberKalendare.podnadpis': {
    cs: 'Uvidíte ho v Google, Apple nebo Outlook kalendáři vedle svých událostí. Jen pro čtení - měnit se dá dál jen tady v portálu.',
    en: 'You will see it in Google, Apple or Outlook Calendar next to your own entries. Read-only — changes are still made here in the portal.',
  },
  'odberKalendare.krok1': { cs: '1. Co chcete vidět', en: '1. What you want to see' },
  'odberKalendare.krok2': { cs: '2. Kam ho přidat', en: '2. Where to add it' },
  'odberKalendare.rozsahZvlast': { cs: 'Každé studio zvlášť', en: 'Each studio separately' },
  'odberKalendare.rozsahZvlastPopis': {
    cs: 'Samostatné kalendáře, zapnete a vypnete je jednotlivě',
    en: 'Separate calendars you can switch on and off one by one',
  },
  'odberKalendare.rozsahVse': { cs: 'Celý kalendář', en: 'The whole calendar' },
  'odberKalendare.rozsahVsePopis': {
    cs: 'Všechna studia a Mimo studio v jednom',
    en: 'All studios and Out of the studio in one',
  },
  'odberKalendare.rozsahMoje': { cs: 'Jen moje', en: 'Only mine' },
  'odberKalendare.rozsahMojePopis': {
    cs: 'Kde jsem zvukař a moje Mimo studio',
    en: 'Where I am the sound engineer, plus my own Out of the studio',
  },
  'odberKalendare.rozsahStudio': { cs: 'Studio {nazev}', en: 'Studio {nazev}' },
  'odberKalendare.mimoStudio': { cs: 'Mimo studio', en: 'Out of the studio' },
  'odberKalendare.porady': { cs: 'Porady', en: 'Meetings' },
  'odberKalendare.schuzky': { cs: 'Schůzky', en: 'Appointments' },
  'odberKalendare.chybaOdkaz': {
    cs: 'Odkaz se nepodařilo vytvořit.',
    en: 'The link could not be created.',
  },
  'odberKalendare.zvlastPopis': {
    cs: 'Každý kalendář přidejte jeho vlastním tlačítkem. V Apple i Google kalendáři pak budou vedle sebe a zapnete nebo vypnete je jednotlivě.',
    en: 'Add each calendar with its own button. In Apple and Google Calendar they then sit side by side and you can switch them on and off one by one.',
  },
  'odberKalendare.kopirovatOdkaz': { cs: 'Kopírovat odkaz', en: 'Copy the link' },
  'odberKalendare.kopirovat': { cs: 'Kopírovat', en: 'Copy' },
  'odberKalendare.qrPopisekNazev': {
    cs: 'QR kód odběru – {nazev}',
    en: 'Subscription QR code – {nazev}',
  },
  'odberKalendare.qrPopisek': {
    cs: 'QR kód odběru kalendáře',
    en: 'Calendar subscription QR code',
  },
  // Tučné slovo uprostřed věty - značka {odebirat} říká, kam patří.
  'odberKalendare.qrPostup': {
    cs: 'Naskenujte iPhonem fotoaparátem a potvrďte {odebirat}. Pak otevřete QR dalšího kalendáře.',
    en: 'Scan it with the iPhone camera and confirm {odebirat}. Then open the QR code of the next calendar.',
  },
  'odberKalendare.slovoOdebirat': { cs: 'Odebírat', en: 'Subscribe' },
  'odberKalendare.zvlastObnova': {
    cs: 'Nechcete některý? Prostě ho nepřidávejte - nebo ho v telefonu jen vypněte. Kalendáře se obnovují samy. V Apple Kalendáři si u každého nastavte {aktualizovat} (iPhone: Nastavení → Aplikace → Kalendář → Účty → Odebírané kalendáře; Mac: klik pravým na kalendář → Informace). Google si interval určuje sám, bývá to i půl dne. Odkazy jsou vaše osobní.',
    en: 'Do not want one of them? Simply do not add it — or just switch it off on your phone. The calendars refresh themselves. In Apple Calendar set {aktualizovat} for each one (iPhone: Settings → Apps → Calendar → Accounts → Subscribed Calendars; Mac: right-click the calendar → Get Info). Google decides the interval itself, sometimes half a day. The links are personal to you.',
  },
  'odberKalendare.slovoAktualizovatPet': {
    cs: 'Aktualizovat: každých 5 minut',
    en: 'Refresh: every 5 minutes',
  },
  'odberKalendare.pripravuji': { cs: 'Připravuji…', en: 'Getting it ready…' },
  'odberKalendare.pripravitKalendare': { cs: 'Připravit kalendáře', en: 'Prepare the calendars' },
  'odberKalendare.pripravitOdkaz': { cs: 'Připravit odkaz', en: 'Prepare the link' },
  'odberKalendare.apple': { cs: 'Apple Kalendář', en: 'Apple Calendar' },
  'odberKalendare.applePopis': {
    cs: 'iPhone, iPad, Mac - otevře se a potvrdíte Odebírat',
    en: 'iPhone, iPad, Mac — it opens and you confirm Subscribe',
  },
  'odberKalendare.googlePopis': {
    cs: 'Otevře se Google, potvrdíte Přidat',
    en: 'Google opens and you confirm Add',
  },
  'odberKalendare.naskenujte': { cs: 'Naskenujte iPhonem', en: 'Scan it with an iPhone' },
  'odberKalendare.qrPostupDlouhy': {
    cs: 'Otevřete fotoaparát, namiřte na kód a klepněte na nabídku nahoře. Kalendář se zeptá, jestli ho chcete odebírat - potvrďte {odebirat}.',
    en: 'Open the camera, point it at the code and tap the prompt at the top. The calendar asks whether you want to subscribe — confirm {odebirat}.',
  },
  'odberKalendare.android': {
    cs: 'Android: Google Kalendář v telefonu odběr přidat neumí - použijte tlačítko Google Kalendář na počítači, v telefonu se pak objeví sám.',
    en: 'Android: Google Calendar on the phone cannot add a subscription — use the Google Calendar button on a computer and it will show up on the phone by itself.',
  },
  'odberKalendare.outlook': {
    cs: 'Outlook a ostatní: zkopírujte odkaz a v kalendáři zvolte „Přidat kalendář z internetu / podle URL".',
    en: 'Outlook and the rest: copy the link and in your calendar choose “Add calendar from internet / from URL”.',
  },
  'odberKalendare.obnova': {
    cs: 'Kalendář se obnovuje sám. Posíláme mu interval 5 minut - Outlook a většina klientů ho poslechne, v Apple Kalendáři si {aktualizovat} přepněte na 5 minut u daného kalendáře, Google si interval určuje sám (bývá to i půl dne). Odkaz je váš osobní, neposílejte ho mimo tým.',
    en: 'The calendar refreshes itself. We send it an interval of 5 minutes — Outlook and most clients obey it; in Apple Calendar switch {aktualizovat} to 5 minutes for that calendar; Google decides the interval itself (sometimes half a day). The link is personal to you, do not send it outside the team.',
  },
  'odberKalendare.slovoAktualizovat': { cs: 'Aktualizovat', en: 'Refresh' },
  'odberKalendare.mojeOdbery': { cs: 'Moje odběry', en: 'My subscriptions' },
  'odberKalendare.naposledyStazeno': {
    cs: 'naposledy staženo {datum}',
    en: 'last downloaded {datum}',
  },
  'odberKalendare.nestazeno': { cs: 'zatím nestaženo', en: 'not downloaded yet' },
  'odberKalendare.zneplatnit': { cs: 'Zneplatnit', en: 'Revoke' },
  'odberKalendare.zneplatnitBublina': {
    cs: 'Odkaz přestane fungovat - v kalendáři se události přestanou objevovat',
    en: 'The link stops working — entries will no longer appear in that calendar',
  },

  // --- nabídka termínů (vnitřní stránka produkce) ---
  'nabidkaTerminu.zpetNaKalendar': { cs: '← Zpět na kalendář', en: '← Back to the calendar' },
  'nabidkaTerminu.nadpis': { cs: 'Nabídka termínů', en: 'Session offer' },
  // Stav nabídky - překládá se podle kódu, ne podle českého popisku
  // (RECORDING_STATUS_LABELS v lib/calendar.ts zůstává český).
  'nabidkaTerminu.stavDraft': { cs: 'Koncept', en: 'Draft' },
  'nabidkaTerminu.stavPreparing': {
    cs: 'Nabídka se připravuje',
    en: 'The offer is being prepared',
  },
  'nabidkaTerminu.stavSent': { cs: 'Nabídka odeslána herci', en: 'Offer sent to the narrator' },
  'nabidkaTerminu.stavPicking': {
    cs: 'Herec vybírá termíny',
    en: 'The narrator is choosing sessions',
  },
  'nabidkaTerminu.stavSubmitted': {
    cs: 'Výběr čeká na schválení',
    en: 'The selection is awaiting approval',
  },
  'nabidkaTerminu.stavReturned': { cs: 'Vráceno k přepracování', en: 'Returned for changes' },
  'nabidkaTerminu.stavRejected': { cs: 'Zamítnuto', en: 'Rejected' },
  'nabidkaTerminu.stavConfirmed': { cs: 'Potvrzeno', en: 'Confirmed' },
  'nabidkaTerminu.stavCancelled': { cs: 'Zrušeno', en: 'Cancelled' },
  'nabidkaTerminu.stavCompleted': { cs: 'Dokončeno', en: 'Completed' },
  // Stav jednoho termínu v seznamu (SLOT_STATE_LABELS).
  'nabidkaTerminu.terminNabidnuto': { cs: 'Nabídnuto', en: 'Offered' },
  'nabidkaTerminu.terminDrzeno': { cs: 'Drženo', en: 'On hold' },
  'nabidkaTerminu.terminPotvrzeno': { cs: 'Potvrzeno', en: 'Confirmed' },
  'nabidkaTerminu.terminUvolneno': { cs: 'Uvolněno', en: 'Released' },
  'nabidkaTerminu.terminZruseno': { cs: 'Zrušeno', en: 'Cancelled' },
  // Kolik volných míst chybí - tři celé věty kvůli českým tvarům.
  'nabidkaTerminu.chybiJedno': {
    cs: 'V období chybí {pocet} volné místo - prodlužte období.',
    en: '{pocet} free slot is missing in the period — extend the period.',
  },
  'nabidkaTerminu.chybiMalo': {
    cs: 'V období chybí {pocet} volná místa - prodlužte období.',
    en: '{pocet} free slots are missing in the period — extend the period.',
  },
  'nabidkaTerminu.chybiVic': {
    cs: 'V období chybí {pocet} volných míst - prodlužte období.',
    en: '{pocet} free slots are missing in the period — extend the period.',
  },
  'nabidkaTerminu.poslatZnovu': { cs: 'Poslat znovu', en: 'Send again' },
  'nabidkaTerminu.odeslatHerci': { cs: 'Odeslat herci', en: 'Send to the narrator' },
  'nabidkaTerminu.zrusitNabidku': { cs: 'Zrušit nabídku', en: 'Cancel the offer' },
  'nabidkaTerminu.potrebaFrekvenci': { cs: 'Potřeba frekvencí', en: 'Recording sessions needed' },
  'nabidkaTerminu.nabidnuto': { cs: 'Nabídnuto', en: 'Offered' },
  'nabidkaTerminu.herecVybral': { cs: 'Herec vybral', en: 'Narrator chose' },
  'nabidkaTerminu.drzenoDo': { cs: 'Termíny drženy do {datum}', en: 'Sessions held until {datum}' },
  'nabidkaTerminu.drzenoDoKratce': { cs: 'drženo do {datum}', en: 'held until {datum}' },
  'nabidkaTerminu.maloMist': {
    cs: 'V zadaném období je volných jen {volnych} míst, herec jich potřebuje {potreba}. Posuňte v Parametrech začátek nebo konec období.',
    en: 'Only {volnych} slots are free in the period you set and the narrator needs {potreba}. Move the start or the end of the period in Parameters.',
  },
  // Tučný je seznam studií - značka {studia}.
  'nabidkaTerminu.dostaneVsechna': {
    cs: 'Herec dostane všechna volná místa ({pocet}) ve studiích {studia} do {datum} a vybere si z nich {potreba}. Obsazené časy v kalendáři se vynechávají samy.',
    en: 'The narrator gets every free slot ({pocet}) in the studios {studia} up to {datum} and picks {potreba} of them. Times already taken in the calendar are left out by themselves.',
  },
  'nabidkaTerminu.poznamkaHerce': { cs: 'Poznámka herce:', en: 'Narrator’s note:' },
  'nabidkaTerminu.odkazProHerce': { cs: 'Odkaz pro herce', en: 'Link for the narrator' },
  'nabidkaTerminu.kopirovat': { cs: 'Kopírovat', en: 'Copy' },
  'nabidkaTerminu.chybaUlozeni': { cs: 'Uložení se nezdařilo.', en: 'Saving failed.' },
  'nabidkaTerminu.ulozeno': { cs: 'Uloženo.', en: 'Saved.' },
  'nabidkaTerminu.chybaOdeslani': { cs: 'Odeslání se nezdařilo.', en: 'Sending failed.' },
  'nabidkaTerminu.odeslanoNa': {
    cs: 'Nabídka odešla na {email}.',
    en: 'The offer has gone to {email}.',
  },
  'nabidkaTerminu.opravduZamitnout': {
    cs: 'Opravdu zamítnout? Termíny se uvolní.',
    en: 'Really reject it? The sessions will be released.',
  },
  'nabidkaTerminu.chybaRozhodnuti': {
    cs: 'Rozhodnutí se nepodařilo uložit.',
    en: 'The decision could not be saved.',
  },
  'nabidkaTerminu.hotovoPotvrzeno': {
    cs: 'Termíny potvrzeny, herci odešel e-mail.',
    en: 'Sessions confirmed, an email has gone to the narrator.',
  },
  'nabidkaTerminu.hotovoVraceno': {
    cs: 'Vráceno herci k novému výběru.',
    en: 'Returned to the narrator to choose again.',
  },
  'nabidkaTerminu.hotovoZamitnuto': { cs: 'Výběr zamítnut.', en: 'The selection was rejected.' },
  'nabidkaTerminu.hotovoDokonceno': {
    cs: 'Označeno jako dokončené.',
    en: 'Marked as completed.',
  },
  'nabidkaTerminu.presunPotvrzen': {
    cs: 'Přesun potvrzen, herci přišlo oznámení.',
    en: 'The move is confirmed, the narrator has been notified.',
  },
  'nabidkaTerminu.presunZamitnut': {
    cs: 'Přesun zamítnut, termín zůstává.',
    en: 'The move was rejected, the session stays as it is.',
  },
  'nabidkaTerminu.opravduZrusitNabidku': {
    cs: 'Opravdu zrušit celou nabídku? Termíny se uvolní.',
    en: 'Really cancel the whole offer? The sessions will be released.',
  },
  'nabidkaTerminu.chybaZruseni': { cs: 'Zrušení se nezdařilo.', en: 'Cancelling failed.' },
  'nabidkaTerminu.herecVybralNadpis': {
    cs: 'Herec vybral termíny',
    en: 'The narrator has chosen sessions',
  },
  'nabidkaTerminu.vybranoZ': {
    cs: 'Vybráno {vybrano} z {potreba}',
    en: '{vybrano} of {potreba} chosen',
  },
  'nabidkaTerminu.vybral': { cs: 'Vybral', en: 'Chosen' },
  'nabidkaTerminu.nevybral': { cs: 'Nevybral', en: 'Not chosen' },
  'nabidkaTerminu.vzalVsechny': {
    cs: '— všechny nabídnuté termíny si vzal —',
    en: '— they took every session offered —',
  },
  'nabidkaTerminu.vzkazHerci': {
    cs: 'Vzkaz herci (u vrácení a zamítnutí se hodí důvod)',
    en: 'Message for the narrator (a reason helps when returning or rejecting)',
  },
  'nabidkaTerminu.vzkazPlaceholder': {
    cs: 'např. Středu bohužel nestihneme, vyberte prosím jiný den.',
    en: 'e.g. We cannot make Wednesday, please choose another day.',
  },
  'nabidkaTerminu.potvrditTerminy': { cs: 'Potvrdit termíny', en: 'Confirm the sessions' },
  'nabidkaTerminu.vratitKPrepracovani': {
    cs: 'Vrátit k přepracování',
    en: 'Return for changes',
  },
  'nabidkaTerminu.zamitnout': { cs: 'Zamítnout', en: 'Reject' },
  'nabidkaTerminu.potvrzenoPopis': {
    cs: 'Termíny jsou potvrzené a v kalendáři studia. Až se odtočí, můžete nabídku uzavřít.',
    en: 'The sessions are confirmed and in the studio calendar. Once they have been recorded, you can close the offer.',
  },
  'nabidkaTerminu.oznacitDokoncene': { cs: 'Označit jako dokončené', en: 'Mark as completed' },
  'nabidkaTerminu.zadostPresunNadpis': {
    cs: 'Herec žádá přesun za termín odevzdání',
    en: 'The narrator is asking to move a session past the delivery date',
  },
  'nabidkaTerminu.zadostPresunPopis': {
    cs: 'Potvrzením se termín přesune - a tím i odevzdání. Datum dokončení projektu případně upravte v jeho detailu.',
    en: 'Confirming moves the session — and with it the delivery. Change the project completion date in the project itself if you need to.',
  },
  'nabidkaTerminu.potvrditPresun': { cs: 'Potvrdit přesun', en: 'Confirm the move' },
  'nabidkaTerminu.parametry': { cs: 'Parametry', en: 'Parameters' },
  'nabidkaTerminu.studia': { cs: 'Studia', en: 'Studios' },
  'nabidkaTerminu.obdobiOd': { cs: 'Období od', en: 'Period from' },
  'nabidkaTerminu.posledniFrekvence': {
    cs: 'Poslední frekvence nejpozději',
    en: 'Last recording session no later than',
  },
  'nabidkaTerminu.pocetFrekvenci': {
    cs: 'Počet frekvencí',
    en: 'Number of recording sessions',
  },
  'nabidkaTerminu.delka': { cs: 'Délka (minuty)', en: 'Length (minutes)' },
  'nabidkaTerminu.poznamkaProHerce': {
    cs: 'Poznámka pro herce',
    en: 'Note for the narrator',
  },
  'nabidkaTerminu.ulozitParametry': { cs: 'Uložit parametry', en: 'Save the parameters' },
  'nabidkaTerminu.poUlozeni': {
    cs: 'Po uložení se volná místa spočítají znovu - nabízí se ve všech zaškrtnutých studiích.',
    en: 'Once saved, the free slots are worked out again — they are offered in every studio ticked.',
  },
  'nabidkaTerminu.seznamNadpis': { cs: 'Termíny v nabídce', en: 'Sessions in the offer' },
  'nabidkaTerminu.zadneVolneMisto': {
    cs: 'V zadaném období není v kalendáři žádné volné místo. Upravte období v Parametrech.',
    en: 'There is no free slot in the calendar in the period you set. Change the period in Parameters.',
  },
  'nabidkaTerminu.historie': { cs: 'Historie', en: 'History' },

  // ŘÁDKY K VLOŽENÍ DO SLOVNIK v src/lib/jazyk.ts (dávka 5 — Výkazy).
  // Merge dělá Ondřej; tenhle soubor se nikam neimportuje.

  // --- výkazy: záložky nad stránkou ---
  'vykaz.nadpis': { cs: 'Výkazy', en: 'Timesheets' },
  'vykaz.zalozkaBonusyKeSchvaleni': { cs: 'Bonusy ke schválení', en: 'Bonuses awaiting approval' },
  'vykaz.zalozkaMojeBonusy': { cs: 'Moje bonusy', en: 'My bonuses' },

  // --- výkazy: hlavička a součet nad tabulkou ---
  'vykaz.vaseSazba': { cs: 'Vaše hodinová sazba: {sazba}', en: 'Your hourly rate: {sazba}' },
  'vykaz.celkemZa': { cs: 'Celkem · {obdobi}', en: 'Total · {obdobi}' },
  'vykaz.celkemZaDruh': { cs: 'Celkem · {obdobi} · {druh}', en: 'Total · {obdobi} · {druh}' },
  'vykaz.hodinyABonusy': {
    cs: '{hodiny} · z toho bonusy {castka}',
    en: '{hodiny} · of which bonuses {castka}',
  },

  // --- výkazy: období a měsíční záložky ---
  'vykaz.zalozkaVse': { cs: 'Vše', en: 'All' },
  'vykaz.vse': { cs: 'vše', en: 'all' },
  'vykaz.obdobi': { cs: 'Období', en: 'Period' },
  'vykaz.obdobiOdDo': { cs: '{od} – {do}', en: '{od} – {do}' },
  'vykaz.obdobiOd': { cs: 'od {od}', en: 'from {od}' },
  'vykaz.obdobiDo': { cs: 'do {do}', en: 'until {do}' },
  'vykaz.odData': { cs: 'Od data', en: 'From date' },
  'vykaz.doData': { cs: 'Do data', en: 'To date' },
  'vykaz.zrusitObdobi': {
    cs: 'Zrušit období a vrátit se k měsícům',
    en: 'Clear the period and go back to months',
  },

  // --- výkazy: druh práce (klíč je KÓD, ne text) ---
  'vykaz.druh.RECORDING': { cs: 'Natáčení', en: 'Recording' },
  'vykaz.druh.EDITING': { cs: 'Střih', en: 'Editing' },
  'vykaz.druh.REPAIRS': { cs: 'Opravy', en: 'Repairs' },
  'vykaz.druh.OTHER': { cs: 'Ostatní', en: 'Other' },

  // --- editor výkazu ---
  'vykaz.novyVykaz': { cs: 'Nový výkaz', en: 'New timesheet entry' },
  'vykaz.upravaVykazu': { cs: 'Úprava výkazu', en: 'Editing the timesheet entry' },
  'vykaz.datum': { cs: 'Datum', en: 'Date' },
  'vykaz.od': { cs: 'Od', en: 'From' },
  'vykaz.do': { cs: 'Do', en: 'To' },
  'vykaz.druhPrace': { cs: 'Druh práce', en: 'Type of work' },
  'vykaz.projekt': { cs: 'Projekt', en: 'Project' },
  'vykaz.poznamka': { cs: 'Poznámka', en: 'Note' },
  'vykaz.nepovinne': { cs: 'nepovinné', en: 'optional' },
  'vykaz.vyberteDruhPrace': { cs: '— vyberte druh práce —', en: '— choose the type of work —' },
  'vykaz.zadneProjekty': {
    cs: 'Zatím se nenačetly žádné projekty.',
    en: 'No projects have loaded yet.',
  },
  'vykaz.napovedaProjekt': {
    cs: 'Pište název projektu, firmu nebo číslo. V nabídce jsou i dokončené projekty.',
    en: 'Type the project name, the company or the number. Completed projects are in the list too.',
  },
  'vykaz.ulozitZmeny': { cs: 'Uložit změny', en: 'Save changes' },
  'vykaz.pridatVykaz': { cs: 'Přidat výkaz', en: 'Add a timesheet entry' },
  'vykaz.zrusitUpravu': { cs: 'Zrušit úpravu', en: 'Cancel the edit' },
  'vykaz.chybiPole': {
    cs: 'Vyplňte datum, čas od–do a druh práce.',
    en: 'Fill in the date, the time from–to and the type of work.',
  },
  'vykaz.chybiPoleSProjektem': {
    cs: 'Vyplňte datum, čas od–do, druh práce a projekt.',
    en: 'Fill in the date, the time from–to, the type of work and the project.',
  },
  'vykaz.napovedaSProjektem': {
    cs: 'Vyplňte čas od–do, druh práce a projekt — bez nich výkaz uložit nejde.',
    en: 'Fill in the time from–to, the type of work and the project — the entry cannot be saved without them.',
  },
  // Do věty vstupuje popisek druhu práce „Ostatní" - proto značka, ne text.
  'vykaz.napovedaBezProjektu': {
    cs: 'Vyplňte čas od–do a druh práce — u „{ostatni}" se projekt nevybírá.',
    en: 'Fill in the time from–to and the type of work — with ‘{ostatni}’ no project is chosen.',
  },
  'vykaz.ulozeniSelhalo': { cs: 'Uložení se nezdařilo.', en: 'Saving failed.' },

  // --- výkazy: filtry nad seznamem ---
  'vykaz.vsechnyDruhy': { cs: 'Všechny druhy práce', en: 'All types of work' },
  'vykaz.vsichniZvukari': { cs: 'Všichni zvukaři', en: 'All sound engineers' },
  'vykaz.hledat': { cs: 'Hledat projekt, poznámku…', en: 'Search a project, a note…' },

  // --- výkazy: sloupce tabulky ---
  'vykaz.sl.datum': { cs: 'Datum', en: 'Date' },
  'vykaz.sl.odDo': { cs: 'Od–do', en: 'From–to' },
  'vykaz.sl.hodiny': { cs: 'Hodiny', en: 'Hours' },
  'vykaz.sl.druhPrace': { cs: 'Druh práce', en: 'Type of work' },
  'vykaz.sl.projekt': { cs: 'Projekt', en: 'Project' },
  'vykaz.sl.castka': { cs: 'Částka', en: 'Amount' },
  'vykaz.seraditPodle': { cs: 'Seřadit podle: {sloupec}', en: 'Sort by: {sloupec}' },

  // --- výkazy: řádky tabulky a prázdné stavy ---
  'vykaz.prazdno': { cs: 'Zatím tu není žádný výkaz.', en: 'There is no timesheet entry here yet.' },
  'vykaz.prazdnoFiltr': { cs: 'Nic neodpovídá filtru.', en: 'Nothing matches the filter.' },
  'vykaz.upravujeSe': { cs: 'Upravuje se', en: 'Being edited' },
  'vykaz.opravduSmazat': { cs: 'Opravdu smazat výkaz?', en: 'Really delete this timesheet entry?' },
  'vykaz.schvaleneBonusy': { cs: 'Schválené bonusy', en: 'Approved bonuses' },

  // --- návrh výkazu z kalendáře ---
  'vykaz.navrh.nadpis': {
    cs: 'Z kalendáře čeká na zapsání',
    en: 'Waiting to be written up from the calendar',
  },
  'vykaz.navrh.popisJedna': {
    cs: 'Jedna práce, u které jste byl zvukař, už skončila. Zkontrolujte čas a přidejte výkaz.',
    en: 'One job where you were the sound engineer has finished. Check the time and add a timesheet entry.',
  },
  'vykaz.navrh.popisVic': {
    cs: '{pocet} prací, u kterých jste byl zvukař, už skončilo. Zkontrolujte čas a přidejte výkaz.',
    en: '{pocet} jobs where you were the sound engineer have finished. Check the times and add timesheet entries.',
  },
  'vykaz.navrh.pridatVsechny': { cs: 'Přidat všechny ({pocet})', en: 'Add all ({pocet})' },
  'vykaz.navrh.upravitCas': { cs: 'Upravit čas', en: 'Edit the time' },
  'vykaz.navrh.nevykazovat': { cs: 'Nevykazovat', en: 'Leave it out' },
  'vykaz.navrh.nevykazovatPopis': {
    cs: 'Nabídka zmizí a už se nevrátí',
    en: 'The suggestion disappears and will not come back',
  },
  'vykaz.navrh.chybiProjekt': {
    cs: 'V kalendáři nebyl projekt — vyberte ho:',
    en: 'There was no project in the calendar — choose one:',
  },
  'vykaz.navrh.projekt': { cs: 'Projekt:', en: 'Project:' },
  'vykaz.navrh.hledejProjekt': {
    cs: 'Začněte psát název projektu…',
    en: 'Start typing the project name…',
  },
  'vykaz.navrh.ulozeniSelhalo': { cs: 'Nepodařilo se to uložit.', en: 'It could not be saved.' },
  'vykaz.navrh.hromadneSelhalo': {
    cs: 'Některé nabídky se nepodařilo přidat.',
    en: 'Some suggestions could not be added.',
  },
  // Záloha názvu, když frekvence v kalendáři projekt nemá.
  'vykaz.navrh.casting': { cs: 'Casting', en: 'Casting' },
  'vykaz.navrh.strih': { cs: 'střih', en: 'editing' },
  'vykaz.navrh.nataceni': { cs: 'natáčení', en: 'recording' },

  // --- bonusy zvukařů: stav (klíč je KÓD, ne text) ---
  'vykaz.bonus.stav.NAVRZENO': { cs: 'Čeká na schválení', en: 'Awaiting approval' },
  'vykaz.bonus.stav.SCHVALENO': { cs: 'Schváleno', en: 'Approved' },
  'vykaz.bonus.stav.ZAMITNUTO': { cs: 'Zamítnuto', en: 'Rejected' },

  // --- bonusy zvukařů: úvodní vysvětlení ---
  // Název stavu projektu zůstává český i v angličtině - STAVY_PROJEKTU se
  // ukládají do databáze česky a portál je česky i ukazuje.
  'vykaz.bonus.popisAdmin': {
    cs: 'Portál navrhne bonus sám, když projekt poprvé přejde do stavu „Dokončeno - ke schválení" a zvukař na něm udělal aspoň 90 % střihu. Přiznat ho musí člověk — dokud tady nikdo neklepne na Schválit, je to jen návrh.',
    en: 'The portal suggests a bonus by itself when a project first moves to the ‘Dokončeno - ke schválení’ status and the sound engineer has done at least 90% of the editing. A person has to award it — until someone taps Approve here, it is only a suggestion.',
  },
  'vykaz.bonus.popisZvukar': {
    cs: 'Bonus za audioknihu navrhuje portál sám, když na ní uděláte aspoň 90 % střihu. Přiznává ho Žůžo-labůžo.',
    en: 'The portal suggests an audiobook bonus by itself when you do at least 90% of the editing on it. Admin awards it.',
  },

  // --- bonusy zvukařů: ruční přidání ---
  'vykaz.bonus.pridatRucne': { cs: 'Přidat bonus ručně', en: 'Add a bonus manually' },
  'vykaz.bonus.rucneVysvetleni': {
    cs: 'Pro případy, na které portál nedosáhne — kniha navíc, zachráněný termín, práce, která se do výkazů nevešla. Přidaný bonus je rovnou schválený; podíl na střihu se dopočítá z výkazů, pokud nějaké jsou.',
    en: 'For the cases the portal cannot reach — an extra book, a rescued session, work that did not fit into the timesheets. A bonus added here is approved straight away; the share of the editing is worked out from the timesheets, if there are any.',
  },
  'vykaz.bonus.vyberte': { cs: '— vyberte —', en: '— choose —' },
  'vykaz.bonus.castkaKc': { cs: 'Částka (Kč)', en: 'Amount (CZK)' },
  'vykaz.bonus.castkaPriklad': { cs: 'např. 1200', en: 'e.g. 1200' },
  'vykaz.bonus.zaCo': { cs: 'Za co (nepovinné)', en: 'What for (optional)' },
  'vykaz.bonus.zaCoPriklad': {
    cs: 'např. převzal knihu po kolegovi',
    en: 'e.g. took over a book from a colleague',
  },
  'vykaz.bonus.pridavam': { cs: 'Přidávám…', en: 'Adding…' },
  'vykaz.bonus.pridat': { cs: 'Přidat bonus', en: 'Add the bonus' },
  'vykaz.bonus.chybiPole': {
    cs: 'Vyberte projekt, zvukaře a vyplňte částku.',
    en: 'Choose the project and the sound engineer, and fill in the amount.',
  },
  'vykaz.bonus.pridaniSelhalo': {
    cs: 'Bonus se nepodařilo přidat.',
    en: 'The bonus could not be added.',
  },
  'vykaz.bonus.spojeniSelhalo': {
    cs: 'Nepodařilo se spojit se serverem.',
    en: 'The server could not be reached.',
  },
  'vykaz.bonus.ulozeniSelhalo': { cs: 'Nepodařilo se to uložit.', en: 'It could not be saved.' },

  // --- bonusy zvukařů: tabulka ---
  'vykaz.bonus.prazdnoCekaji': {
    cs: 'Teď není co schvalovat.',
    en: 'There is nothing to approve right now.',
  },
  'vykaz.bonus.rozhodnute': { cs: 'Rozhodnuté', en: 'Decided' },
  'vykaz.bonus.sl.podil': { cs: 'Podíl na střihu', en: 'Share of the editing' },
  'vykaz.bonus.sl.bonus': { cs: 'Bonus', en: 'Bonus' },
  'vykaz.bonus.sl.stav': { cs: 'Stav', en: 'Status' },
  'vykaz.bonus.navrzeno': { cs: 'Navrženo {kdy}', en: 'Suggested {kdy}' },
  'vykaz.bonus.pridanoRucne': { cs: 'Přidáno ručně', en: 'Added manually' },
  // Anglicky se procenta píšou bez mezery, česky s mezerou.
  'vykaz.bonus.procent': { cs: '{procent} %', en: '{procent}%' },
  'vykaz.bonus.podilMinut': { cs: '{moje} z {celkem}', en: '{moje} of {celkem}' },
  'vykaz.bonus.schvalit': { cs: 'Schválit', en: 'Approve' },
  'vykaz.bonus.zamitnout': { cs: 'Zamítnout', en: 'Reject' },
  'vykaz.bonus.opravduZahodit': {
    cs: 'Opravdu zahodit návrh?',
    en: 'Really discard this suggestion?',
  },
  'vykaz.bonus.vlastniSchvalujeKolega': {
    cs: 'Vlastní bonus schvaluje kolega.',
    en: 'Your own bonus is approved by a colleague.',
  },
  'vykaz.bonus.vratitKRozhodnuti': {
    cs: 'Vrátit k rozhodnutí',
    en: 'Send back for a decision',
  },
  // --- číselníky a formáty z src/lib (dávka 7, 28. 9. 2026) -----------------
  // Sem patří texty, které do obrazovek přitékaly z knihoven v src/lib, takže
  // je komponenta neměla jak přeložit. Číselníky si jazyk berou NEPOVINNÝM
  // parametrem - PDF a pošta dál dostanou češtinu beze změny.

  // Záložky chatu (lib/chat.ts).
  'chat.zalozka.PROJEKT': { cs: 'Projekty', en: 'Projects' },
  'chat.zalozka.SOUKROMA': { cs: 'Soukromé', en: 'Private' },
  'chat.zalozka.SKUPINA': { cs: 'Skupiny', en: 'Groups' },
  'chat.zalozka.UKOLY': { cs: 'Úkoly', en: 'Tasks' },

  // Oddělovač dnů a čas u zprávy (lib/chat.ts).
  'chat.den.dnes': { cs: 'Dnes', en: 'Today' },
  'chat.den.vcera': { cs: 'Včera', en: 'Yesterday' },
  'chat.cas.dnes': { cs: 'dnes {cas}', en: 'today {cas}' },
  'chat.cas.vcera': { cs: 'včera {cas}', en: 'yesterday {cas}' },

  // Úkol z chatu bez příjemce (lib/ukolyZChatu.ts).
  'ukol.chybiPrijemce': {
    cs: 'Označte @jménem, komu úkol patří.',
    en: 'Tag the person the task belongs to with @name.',
  },

  // Můj status v chatu: do kdy platí (lib/statusyChatu.ts).
  'status.textDoKdy': { cs: '{text} do {cas}', en: '{text} until {cas}' },
  'status.dokdy.30': { cs: '30 minut', en: '30 minutes' },
  'status.dokdy.60': { cs: '1 hodinu', en: '1 hour' },
  'status.dokdy.240': { cs: '4 hodiny', en: '4 hours' },
  'status.dokdy.dnes': { cs: 'do konce dne', en: 'until the end of the day' },
  'status.dokdy.bez': { cs: 'dokud ho nezruším', en: 'until I clear it' },

  // Náhledové pohledy v pruhu náhledu (lib/nahledRole.ts). Popisek pohledu
  // drží stejná slova jako role.* výš, vysvětlení je věta pod ním.
  'nahled.pohled.tym': { cs: 'Tým', en: 'Team' },
  'nahled.pohled.klient': { cs: 'Klient', en: 'Customer' },
  'nahled.pohled.herec': { cs: 'Herec', en: 'Narrator' },
  'nahled.vysvetleni.tym': {
    cs: 'projekty napříč firmami, kalendář, pozvánky - jako produkce',
    en: 'projects across all companies, calendar, invitations - as production',
  },
  'nahled.vysvetleni.klient': {
    cs: 'jen zakázky své firmy, objednávka a nahrávky',
    en: 'only your own company\'s jobs, ordering and recordings',
  },
  'nahled.vysvetleni.herec': {
    cs: 'moje termíny a nabídky natáčení',
    en: 'my sessions and recording offers',
  },

  // Vlastní smajlíci Mediaspace (lib/msSmajlici.ts) - popisek jde do bubliny
  // v nabídce smajlíků.
  'smajlik.ms-usmev': { cs: 'Úsměv', en: 'Smile' },
  'smajlik.ms-smich': { cs: 'Smích', en: 'Laughing' },
  'smajlik.ms-mrk': { cs: 'Mrknutí', en: 'Wink' },
  'smajlik.ms-super': { cs: 'Paráda', en: 'Brilliant' },
  'smajlik.ms-premyslim': { cs: 'Přemýšlím', en: 'Thinking' },
  'smajlik.ms-prekvapeni': { cs: 'Překvapení', en: 'Surprised' },
  'smajlik.ms-smutek': { cs: 'Smutek', en: 'Sad' },
  'smajlik.ms-unaveny': { cs: 'Unavený', en: 'Tired' },
  'smajlik.ms-palec': { cs: 'Palec nahoru', en: 'Thumbs up' },
  'smajlik.ms-palec-dolu': { cs: 'Palec dolů', en: 'Thumbs down' },
  'smajlik.ms-sluchatka': { cs: 'Poslouchám', en: 'Listening' },
  'smajlik.ms-hotovo': { cs: 'Hotovo', en: 'Done' },
  'smajlik.ms-pozor': { cs: 'Pozor', en: 'Watch out' },
  'smajlik.ms-ohen': { cs: 'Frčí to', en: 'On fire' },
  'smajlik.ms-mikrofon': { cs: 'Natáčíme', en: 'Recording' },
  'smajlik.ms-srdce': { cs: 'Srdce', en: 'Heart' },
  'smajlik.ms-slon': { cs: 'Slon', en: 'Elephant' },
  'smajlik.ms-moucha': { cs: 'Moucha', en: 'Fly' },

  // --- detail projektu: rozpočet a náklady po položkách (dávka 7b) ----------
  'rozpocet.nadpis': { cs: 'Rozpočet', en: 'Budget' },
  'rozpocet.souhrnNormostrany': {
    cs: '{pocet} normostran · frekvence {frekvence} × {cena}',
    en: '{pocet} standard pages · {frekvence} recording sessions × {cena}',
  },
  'rozpocet.nataceni': { cs: 'Natáčení', en: 'Recording' },
  'rozpocet.strih': { cs: 'Střih', en: 'Editing' },
  'rozpocet.bonus': { cs: 'Bonus', en: 'Bonus' },
  'rozpocet.nakladyNaVyrobu': { cs: 'Náklady na výrobu', en: 'Production costs' },
  'rozpocet.cerpani': { cs: 'Čerpání', en: 'Spent' },
  'rozpocet.zCelkem': { cs: '{cast} z {celek} · {procent} %', en: '{cast} of {celek} · {procent}%' },
  'rozpocet.vykazanoHodin': { cs: 'Vykázáno {hodiny} h.', en: '{hodiny} h logged.' },
  'rozpocet.zadneVykazy': { cs: 'Zatím žádné výkazy.', en: 'No timesheets yet.' },
  'rozpocet.prekroceno': { cs: 'Rozpočet je překročený o {castka}.', en: 'The budget is over by {castka}.' },
  'rozpocet.zbyva': { cs: 'Zbývá {castka}.', en: '{castka} remaining.' },
  'rozpocet.zisk': { cs: 'Zisk', en: 'Profit' },
  'rozpocet.bezSazby': {
    cs: 'Firma nemá nastavenou sazbu za normostranu, cenu zakázky proto nespočítáme.',
    en: 'The company has no rate per standard page set, so we cannot work out the order price.',
  },
  'rozpocet.cenaZakazkyVzorec': {
    cs: 'Cena zakázky = {pocet} normostran × {sazba} (sazba firmy, bez DPH).',
    en: 'Order price = {pocet} standard pages × {sazba} (the company’s rate, excluding VAT).',
  },
  'rozpocet.dalsiPolozky': { cs: 'Další položky', en: 'Other items' },
  'rozpocet.opravy': { cs: 'Opravy', en: 'Repairs' },
  'rozpocet.opravyZVykazu': { cs: 'z výkazů', en: 'from timesheets' },
  'rozpocet.opravyVCerpani': {
    cs: 'Z toho {castka} za opravy — ty v rozpočtu vlastní řádek nemají.',
    en: 'Of that, {castka} is repairs — they have no line of their own in the budget.',
  },
  'rozpocet.dalsiPolozkyNapoveda': {
    cs: 'Bez DPH. Honorář herce, přeposlech, úprava textu. Do rozpočtu na výrobu se nepočítají — sčítají se až v celkovém rozpočtu.',
    en: 'Excluding VAT. Narrator fees, proof-listening, text editing. They do not count towards the production budget — they are added up in the total budget.',
  },
  'rozpocet.celkovyRozpocet': { cs: 'Celkový rozpočet', en: 'Total budget' },
  'rozpocet.fakturujeme': { cs: 'Fakturujeme', en: 'We invoice' },
  'rozpocet.zCenoveNabidky': { cs: 'z cenové nabídky', en: 'from the quote' },
  'rozpocet.zVystaveneFaktury': { cs: 'z vystavené faktury', en: 'from the invoice issued' },
  'rozpocet.odhadZNormostran': { cs: 'odhad z normostran', en: 'estimate from standard pages' },
  'rozpocet.ziskZKnihy': { cs: 'Zisk z knihy', en: 'Profit on the book' },
  'rozpocet.bezCehoFakturovat': {
    cs: 'Dokud u projektu není nabídka ani faktura a firma nemá sazbu za normostranu, nemá portál co fakturovat — zisk proto nespočítáme.',
    en: 'Until the project has a quote or an invoice and the company has a rate per standard page, there is nothing to invoice — so we cannot work out the profit.',
  },
  'rozpocet.zatimOdhad': {
    cs: 'Zatím je to jen odhad: {pocet} normostran × {sazba}. Až u projektu bude nabídka, vezme se částka z ní.',
    en: 'This is only an estimate for now: {pocet} standard pages × {sazba}. Once the project has a quote, the amount will be taken from it.',
  },
  'rozpocet.cenaPodleNabidky': { cs: 'Cena podle nabídky', en: 'Price from the quote' },
  'rozpocet.cenaPodleFaktury': { cs: 'Cena podle vystavené faktury', en: 'Price from the invoice issued' },
  'rozpocet.cenaZatimNeni': { cs: 'Cena zakázky zatím není', en: 'No order price yet' },
  'rozpocet.cenaZakazky': { cs: 'Cena zakázky', en: 'Order price' },
  'rozpocet.nabidnuto': { cs: 'nabídnuto', en: 'quoted' },
  'rozpocet.fakturovano': { cs: 'fakturováno', en: 'invoiced' },
  'rozpocet.naklady': { cs: 'Náklady', en: 'Costs' },
  'rozpocet.polozkyNiz': { cs: 'položky níž', en: 'items below' },
  'rozpocet.jenProPrehled': {
    cs: 'Jen pro přehled, do zisku se nepočítá: {vycet}. Co se má do zisku promítnout, napište mezi položky.',
    en: 'For information only, not counted towards the profit: {vycet}. Whatever should affect the profit, write it among the items.',
  },
  'rozpocet.praceZVykazu': { cs: 'práce ze výkazů {castka}', en: 'work from timesheets {castka}' },
  'rozpocet.praceZVykazuHodiny': {
    cs: 'práce ze výkazů {castka} ({hodiny} h)',
    en: 'work from timesheets {castka} ({hodiny} h)',
  },
  'rozpocet.vydajeZDokladu': { cs: 'výdaje z dokladů {castka}', en: 'expenses from documents {castka}' },
  'rozpocet.bezNabidkyANiFaktury': {
    cs: 'Dokud u projektu není nabídka ani faktura, nemá portál cenu odkud vzít.',
    en: 'Until the project has a quote or an invoice, there is no price to take.',
  },
  'naklady.nadpis': { cs: 'Náklady po položkách', en: 'Itemised costs' },
  'naklady.napoveda': {
    cs: 'Bez DPH. Sem patří všechny náklady zakázky — honorář, studio, hudba. Zisk se počítá z nich.',
    en: 'Excluding VAT. Every cost of the job belongs here — fees, studio, music. The profit is worked out from them.',
  },
  'naklady.ulozeno': { cs: '✓ Uloženo', en: '✓ Saved' },
  'naklady.neulozilo': { cs: 'Neuložilo se', en: 'Not saved' },
  'naklady.smazatPolozku': { cs: 'Smazat položku', en: 'Delete item' },
  'naklady.upravitPolozku': { cs: 'Upravit položku', en: 'Edit item' },
  'naklady.pridatPolozku': { cs: '+ Přidat položku', en: '+ Add item' },
  'naklady.polozkyCelkem': { cs: 'Položky celkem', en: 'Items total' },
  'naklady.napovedaPole': { cs: 'Honorář herce, studio, hudba…', en: 'Narrator fee, studio, music…' },

  // --- detail projektu: doklady k projektu (dávka 7b) -----------------------
  'projektDoklady.nadpis': { cs: 'Doklady k projektu', en: 'Project documents' },
  'projektDoklady.prejit': { cs: 'Přejít do Dokladů →', en: 'Go to Invoicing →' },
  'projektDoklady.novaNabidka': { cs: 'Nová nabídka', en: 'New quote' },
  'projektDoklady.novaFaktura': { cs: 'Nová faktura', en: 'New invoice' },
  'projektDoklady.novaSmlouva': { cs: 'Nová smlouva', en: 'New contract' },
  'projektDoklady.novyVydaj': { cs: 'Nový výdaj', en: 'New expense' },
  'projektDoklady.nicNeni': {
    cs: 'K tomuhle projektu zatím žádný doklad navázaný není. Založ ho tlačítkem nahoře — projekt i klient se do něj předvyplní.',
    en: 'No document is linked to this project yet. Create one with the button above — the project and the customer will be filled in for you.',
  },
  'projektDoklady.nabidky': { cs: 'Nabídky', en: 'Quotes' },
  'projektDoklady.vydaneFaktury': { cs: 'Vydané faktury', en: 'Invoices issued' },
  'projektDoklady.smlouvy': { cs: 'Smlouvy', en: 'Contracts' },
  'projektDoklady.prijateDoklady': { cs: 'Přijaté doklady', en: 'Documents received' },
  'projektDoklady.fakturovano': { cs: 'Fakturováno', en: 'Invoiced' },
  'projektDoklady.naklady': { cs: 'Náklady', en: 'Costs' },
  'projekt.zalozka.vystupy': { cs: 'Výstupy', en: 'Deliverables' },
  'projekt.zalozka.technickeParametry': { cs: 'Technické parametry', en: 'Technical specification' },
  'projekt.zalozka.poznamky': { cs: 'Poznámky', en: 'Notes' },

  // --- posluchači přeposlechu (dávka 7b) -----------------------------------
  'posluchaci.tlacitko': { cs: 'Posluchači', en: 'Listeners' },
  'posluchaci.tlacitkoNapoveda': {
    cs: 'Kdo přeposlech poslouchá a komu chodí zprávy o nových stopách',
    en: 'Who is proof-listening and who gets messages about new tracks',
  },
  'posluchaci.neulozilo': { cs: 'Nepodařilo se uložit.', en: 'It could not be saved.' },
  'posluchaci.oknoNadpis': { cs: 'Kdo bude poslouchat?', en: 'Who will be listening?' },
  'posluchaci.oknoUvod': {
    cs: 'Zadejte svůj e-mail. Podepíšou se jím vaše poznámky a dáme vám vědět, až k přeposlechu přibudou nové stopy.',
    en: 'Enter your email address. Your notes will be signed with it and we will let you know when new tracks are added for proof-listening.',
  },
  'posluchaci.email': { cs: 'E-mail', en: 'Email' },
  'posluchaci.emailPriklad': { cs: 'jmeno@firma.cz', en: 'name@company.co.uk' },
  'posluchaci.jmeno': { cs: 'Jméno', en: 'Name' },
  'posluchaci.nepovinne': { cs: '· nepovinné', en: '· optional' },
  'posluchaci.jmenoPriklad': { cs: 'Jana Nováková', en: 'Jane Smith' },
  'posluchaci.predatDalsimu': { cs: 'Předat přeposlech někomu dalšímu', en: 'Hand the proof-listening to someone else' },
  'posluchaci.predatDalsimuNepovinne': {
    cs: '· nepovinné, pošleme mu odkaz',
    en: '· optional, we will send them a link',
  },
  'posluchaci.kolegaPriklad': { cs: 'kolega@firma.cz', en: 'colleague@company.co.uk' },
  'posluchaci.odebrat': { cs: 'Odebrat', en: 'Remove' },
  'posluchaci.pridatEmail': { cs: '+ Přidat e-mail', en: '+ Add an email address' },
  'posluchaci.pokracovat': { cs: 'Pokračovat k nahrávce', en: 'Continue to the recording' },
  'posluchaci.tedNe': { cs: 'Teď ne', en: 'Not now' },
  'posluchaci.panelUvod': {
    cs: 'Komu chodí zpráva, když přibudou nové stopy. Přidáním přeposlech předáte - pošleme odkaz.',
    en: 'Who gets a message when new tracks are added. Adding someone hands the proof-listening over — we will send them a link.',
  },
  'posluchaci.zatimNikdo': { cs: 'Zatím nikdo.', en: 'Nobody yet.' },
  'posluchaci.ja': { cs: '· já', en: '· me' },
  'posluchaci.pridal': { cs: 'přidal(a) {jmeno}', en: 'added by {jmeno}' },
  'posluchaci.toJsemJa': { cs: 'To jsem já', en: 'That is me' },
  'posluchaci.zpravyZapnute': {
    cs: 'Chodí zprávy o nových stopách - klepnutím vypnete',
    en: 'Messages about new tracks are on — tap to turn them off',
  },
  'posluchaci.zpravyVypnute': {
    cs: 'Zprávy o nových stopách vypnuté',
    en: 'Messages about new tracks are off',
  },
  'posluchaci.opravdu': { cs: 'Opravdu?', en: 'Really?' },
  'posluchaci.pridatNadpis': { cs: 'Přidat / předat přeposlech', en: 'Add / hand over proof-listening' },
  'posluchaci.emailPole': { cs: 'e-mail', en: 'email' },
  'posluchaci.jmenoPole': { cs: 'jméno (nepovinné)', en: 'name (optional)' },
  'posluchaci.pridatAPoslat': { cs: 'Přidat a poslat odkaz', en: 'Add and send the link' },

  // --- založení projektu (dávka 7b) ----------------------------------------
  'novyProjekt.tlacitko': { cs: 'Nový projekt', en: 'New project' },
  'novyProjekt.nadpis': { cs: 'Nový projekt', en: 'New project' },
  'novyProjekt.nazev': { cs: 'Název projektu', en: 'Project name' },
  'novyProjekt.nazevPriklad': { cs: 'např. Bezradná (série)', en: 'e.g. Clueless (series)' },
  'novyProjekt.firma': { cs: 'Firma', en: 'Company' },
  'novyProjekt.bezFirmy': { cs: '— bez firmy —', en: '— no company —' },
  'novyProjekt.klient': { cs: 'Klient', en: 'Customer' },
  'novyProjekt.bezKlienta': { cs: '— bez klienta —', en: '— no customer —' },
  'novyProjekt.klientBezFirmy': { cs: '{jmeno} — bez firmy', en: '{jmeno} — no company' },
  'novyProjekt.nabizimeZFirmy': {
    cs: 'Nabízíme lidi z firmy {firma} a ty, kdo firmu vyplněnou nemají.',
    en: 'We offer people from {firma} and those with no company filled in.',
  },
  'novyProjekt.typ': { cs: 'Typ projektu', en: 'Project type' },
  'novyProjekt.bezTypu': { cs: '— bez typu —', en: '— no type —' },
  'novyProjekt.manazer': { cs: 'Manažer projektu', en: 'Project manager' },
  'novyProjekt.bezManazera': { cs: '— bez manažera —', en: '— no manager —' },
  'novyProjekt.herci': { cs: 'Herci', en: 'Narrators' },
  'novyProjekt.pocetNs': { cs: 'Počet normostran', en: 'Number of standard pages' },
  'novyProjekt.datumVydani': { cs: 'Datum vydání', en: 'Release date' },
  'novyProjekt.priorita': { cs: 'Priorita', en: 'Priority' },
  'novyProjekt.prioritaNapoveda': {
    cs: 'Každé klepnutí přidá čárku, po třetí se vrátí na jednu.',
    en: 'Each tap adds a bar; after the third it goes back to one.',
  },
  'novyProjekt.stav': { cs: 'Stav', en: 'Status' },
  'novyProjekt.zalozitSlozku': {
    cs: 'Založit složku projektu na Google Disku',
    en: 'Create the project folder on Google Drive',
  },
  'novyProjekt.firmaBezSlozky': {
    cs: '{firma} nemá v portálu vyplněný odkaz na svou složku — složka projektu se nezaloží.',
    en: '{firma} has no link to its folder filled in, so the project folder will not be created.',
  },
  'novyProjekt.slozkaVznikne': {
    cs: 'Vznikne ve složce vybrané firmy a odkaz se u projektu vyplní sám.',
    en: 'It will be created in the selected company’s folder and the link will be filled in on the project.',
  },
  'novyProjekt.nepovedlo': { cs: 'Projekt se nepodařilo založit.', en: 'The project could not be created.' },
  'novyProjekt.varovaniDisk': {
    cs: 'Projekt je založený, ale {chyba} Odkaz na složku doplňte u projektu ručně.',
    en: 'The project has been created, but {chyba} Please fill in the folder link on the project by hand.',
  },
  'novyProjekt.zakladam': { cs: 'Zakládám…', en: 'Creating…' },
  'novyProjekt.zalozit': { cs: 'Založit projekt', en: 'Create the project' },

  // --- přehled projektů: záložky, hledání a sloupce (dávka 7b) --------------
  'prehledProjektu.hotovo': { cs: 'Hotovo', en: 'Done' },
  'prehledProjektu.obnovitVychozi': { cs: 'Obnovit výchozí', en: 'Restore defaults' },
  'prehledProjektu.aspoJeden': {
    cs: 'Aspoň jeden sloupec musí zůstat zobrazený.',
    en: 'At least one column has to stay visible.',
  },
  'prehledProjektu.chybaNazvy': {
    cs: 'Uložení názvů se nezdařilo.',
    en: 'The column names could not be saved.',
  },
  'prehledProjektu.zalozkaAktivni': { cs: 'Aktivní', en: 'Active' },
  'prehledProjektu.zalozkaDokoncene': { cs: 'Dokončené', en: 'Completed' },
  'prehledProjektu.hledatPole': {
    cs: 'Hledat projekt, firmu, herce, manažera, číslo…',
    en: 'Search by project, company, narrator, manager or number…',
  },
  'prehledProjektu.hledatPopis': { cs: 'Hledat v projektech', en: 'Search the projects' },
  'prehledProjektu.sloupceProZarizeni': { cs: 'Sloupce pro {zarizeni}.', en: 'Columns for {zarizeni}.' },
  'prehledProjektu.sloupceNapoveda': {
    cs: 'Pořadí změníte přetažením, křížkem sloupec odeberete - platí jen pro vás a jen tady.',
    en: 'Drag to change the order, the cross removes a column — this applies only to you and only here.',
  },
  'prehledProjektu.prejmenovaniProVsechny': {
    cs: 'Přejmenování v hlavičce platí pro všechny.',
    en: 'Renaming in the header applies to everyone.',
  },
  'prehledProjektu.odebraneSloupce': { cs: 'Odebrané sloupce:', en: 'Removed columns:' },
  'prehledProjektu.vratitSloupec': { cs: 'Vrátit {nazev}', en: 'Bring back {nazev}' },
  'prehledProjektu.nenalezenoAktivni': {
    cs: 'Hledání nic nenašlo. Dokončené projekty jsou na druhé záložce.',
    en: 'The search found nothing. Completed projects are on the other tab.',
  },
  'prehledProjektu.nenalezeno': { cs: 'Hledání nic nenašlo.', en: 'The search found nothing.' },
  'prehledProjektu.zadneRozpracovane': {
    cs: 'Aktuálně nejsou žádné rozpracované projekty.',
    en: 'There are no projects in progress at the moment.',
  },
  'prehledProjektu.zadneDokoncene': {
    cs: 'Zatím tu nejsou žádné dokončené projekty.',
    en: 'There are no completed projects here yet.',
  },
  'prehledProjektu.zobrazeno': {
    cs: 'Zobrazeno {od}–{do} z {celkem}',
    en: 'Showing {od}–{do} of {celkem}',
  },
  'prehledProjektu.predchozi': { cs: '← Předchozí', en: '← Previous' },
  'prehledProjektu.dalsi': { cs: 'Další →', en: 'Next →' },

  // --- objednávka reklamy: výstupy pod jednou zakázkou (dávka 7b) -----------
  'objednavkaReklama.nazevVystupu': { cs: 'Název výstupu', en: 'Deliverable name' },
  'objednavkaReklama.delka': { cs: 'Délka', en: 'Length' },
  'objednavkaReklama.delkaVSekundach': { cs: 'Délka v sekundách', en: 'Length in seconds' },
  'objednavkaReklama.odebrat': { cs: 'Odebrat', en: 'Remove' },
  'objednavkaReklama.zkraceneVerze': { cs: 'Zkrácené verze', en: 'Shortened versions' },
  'objednavkaReklama.zkraceneVerzeNapoveda': {
    cs: 'stejný hlas i hudba jako hlavní verze',
    en: 'the same voice and music as the main version',
  },
  'objednavkaReklama.pridatVystup': { cs: '+ Přidat další výstup', en: '+ Add another deliverable' },
  'objednavkaReklama.poznamka': { cs: 'Poznámka', en: 'Note' },
  'vystup.zkraceneVerze': { cs: 'zkrácené verze', en: 'shortened versions' },

  // --- rodný list reklamy: údaje, náhled a verze (dávka 7b) -----------------
  // Názvy polí. Čeština musí zůstat totožná s RODNY_LIST_LABELS
  // v lib/rodnyList.ts - ta jde na server do ProjectMeta.rlError.
  'rodnyList.pole.klient': { cs: 'Název klienta', en: 'Customer name' },
  'rodnyList.pole.nazevSpotu': { cs: 'Název spotu', en: 'Advert name' },
  'rodnyList.pole.delkaSpotu': { cs: 'Délka spotu', en: 'Advert length' },
  'rodnyList.pole.rezie': { cs: 'Režie', en: 'Direction' },
  'rodnyList.pole.nazevSkladby': { cs: 'Název skladby', en: 'Track title' },
  'rodnyList.pole.autorHudby': { cs: 'Autor hudby', en: 'Music composer' },
  'rodnyList.pole.datumVyroby': { cs: 'Datum výroby', en: 'Production date' },
  'rodnyList.verze': { cs: 'verze {cislo}', en: 'version {cislo}' },
  'rodnyList.chybaUlozeni': { cs: 'Uložení se nezdařilo.', en: 'Saving failed.' },
  'rodnyList.chybaVytvoreni': {
    cs: 'Rodný list se nepodařilo vytvořit.',
    en: 'The advert record could not be created.',
  },
  'rodnyList.chybaSmazani': {
    cs: 'Rodný list se nepodařilo smazat.',
    en: 'The advert record could not be deleted.',
  },
  'rodnyList.diskZustal': {
    cs: 'Záznam je smazaný, ale soubor na Disku se nepodařilo přesunout do koše — smažte ho tam ručně.',
    en: 'The record has been deleted, but the file on Drive could not be moved to the bin — please delete it there by hand.',
  },
  'rodnyList.opravduSmazat': { cs: 'Opravdu smazat {soubor} ({verze})?', en: 'Really delete {soubor} ({verze})?' },
  'rodnyList.kopieDoKose': {
    cs: 'Kopie na Disku se přesune do koše.',
    en: 'The copy on Drive will be moved to the bin.',
  },
  'rodnyList.hudbaNadpis': { cs: 'Hudba ve spotu', en: 'Music in the advert' },
  'rodnyList.bezHudby': { cs: 'Spot nemá hudbu', en: 'The advert has no music' },
  'rodnyList.bezHudbyVDokumentu': {
    cs: 'V Rodném listu bude u hudby uvedeno „Spot bez hudby“ — žádný vymyšlený údaj se tam nedostane.',
    en: 'The advert record will say “Advert without music” under music — nothing made up will get in there.',
  },
  'rodnyList.bezHudbyPoznamka': {
    cs: 'U projektu je poznamenané, že hudbu nemá.',
    en: 'The project is noted as having no music.',
  },
  'rodnyList.ulozeno': { cs: 'Uloženo.', en: 'Saved.' },
  'rodnyList.vyzadujeKontrolu': { cs: 'Projekt vyžaduje kontrolu', en: 'The project needs checking' },
  'rodnyList.nicNeodeslano': {
    cs: 'Klientovi se v tomhle případě nic neodeslalo. Doplňte údaje a vygenerujte Rodný list znovu.',
    en: 'Nothing was sent to the customer in this case. Fill in the details and generate the advert record again.',
  },
  'rodnyList.chybiUdaje': { cs: 'Chybí údaje pro Rodný list', en: 'Details for the advert record are missing' },
  'rodnyList.chybiUdajeText': {
    cs: '{chybi}. Dokud tyhle údaje chybí, jsou tlačítka Náhled i Vygenerovat RL zašedlá — doplňte je ve formuláři níž a uložte.',
    en: '{chybi}. While these details are missing, both Preview and Generate advert record stay greyed out — fill them in on the form below and save.',
  },
  'rodnyList.udajeNadpis': { cs: 'Údaje pro Rodný list', en: 'Advert record details' },
  'rodnyList.udajeUvod': {
    cs: 'Z nich se vyrobí PDF, až kliknete na „Vygenerovat RL" — sám nevzniká. Náhledem se na něj můžete podívat dřív, než se kamkoliv uloží.',
    en: 'They go into the PDF once you click Generate advert record — it is not created on its own. The preview lets you look at it before it is saved anywhere.',
  },
  'rodnyList.nazevSpotuNapoveda': {
    cs: 'Když zůstane prázdný, použije se název projektu. Soubor se uloží jako {soubor}.',
    en: 'If it stays empty, the project name is used. The file will be saved as {soubor}.',
  },
  'rodnyList.klient': { cs: 'Klient', en: 'Customer' },
  'rodnyList.klientPriklad': {
    cs: 'název klienta na dokumentu',
    en: 'the customer name on the document',
  },
  'rodnyList.klientPredvyplneno': {
    cs: 'Předvyplněno podle firmy projektu ({firma}). Přepsat jde kdykoliv.',
    en: 'Pre-filled from the project’s company ({firma}). You can overwrite it at any time.',
  },
  'rodnyList.klientBezFirmy': {
    cs: 'Projekt zatím nemá vyplněnou firmu, tak klienta zadejte ručně.',
    en: 'The project has no company filled in yet, so enter the customer by hand.',
  },
  'rodnyList.delkaNapoveda': {
    cs: 'V dokumentu se zobrazí například jako „20s".',
    en: 'In the document it appears as “20s”, for example.',
  },
  'rodnyList.nahled': { cs: 'Náhled', en: 'Preview' },
  'rodnyList.prekresluji': { cs: 'Překresluji…', en: 'Redrawing…' },
  'rodnyList.nahledPopis': {
    cs: 'Mění se s tím, co píšete. Nikam se neukládá.',
    en: 'It changes as you type. It is not saved anywhere.',
  },
  'rodnyList.obnovit': { cs: 'Obnovit', en: 'Refresh' },
  'rodnyList.otevritSamostatne': { cs: 'Otevřít samostatně ↗', en: 'Open on its own ↗' },
  'rodnyList.zobrazit': { cs: 'Zobrazit', en: 'Show' },
  'rodnyList.nahledAzPoDoplneni': {
    cs: 'Náhled se ukáže, až budou doplněné chybějící údaje.',
    en: 'The preview will appear once the missing details are filled in.',
  },
  'rodnyList.nahledTitulek': { cs: 'Náhled Rodného listu', en: 'Advert record preview' },
  'rodnyList.vygenerovaneNadpis': { cs: 'Vygenerované Rodné listy', en: 'Generated advert records' },
  'rodnyList.nejdrivDoplnte': { cs: 'Nejdřív doplňte chybějící údaje.', en: 'Fill in the missing details first.' },
  'rodnyList.generuji': { cs: 'Generuji…', en: 'Generating…' },
  'rodnyList.vygenerovat': { cs: 'Vygenerovat RL', en: 'Generate advert record' },
  'rodnyList.vygenerovatZnovu': { cs: 'Vygenerovat RL znovu', en: 'Generate advert record again' },
  'rodnyList.zadny': {
    cs: 'Zatím žádný. Vyrobíte ho tlačítkem — sám nevzniká. Náhledem se nejdřív podívejte, jestli sedí; teprve „Vygenerovat RL" ho uloží a nahraje na Disk.',
    en: 'None yet. The button makes it — it is not created on its own. Use the preview to check it first; only Generate advert record saves it and uploads it to Drive.',
  },
  'rodnyList.vytvoreno': { cs: '{verze} · vytvořeno {kdy}', en: '{verze} · created {kdy}' },
  'rodnyList.disk': { cs: 'Disk: {chyba}', en: 'Drive: {chyba}' },
  'rodnyList.naDisku': { cs: 'Na Google Disku ↗', en: 'On Google Drive ↗' },
  'rodnyList.mazu': { cs: 'Mažu…', en: 'Deleting…' },

  // --- výstupy projektu (dávka 7b) ------------------------------------------
  'vystupy.nadpis': { cs: 'Výstupy', en: 'Deliverables' },
  // Tři podoby téže věty kvůli českému skloňování (1 / 2-4 / 5+).
  'vystupy.pocet1': {
    cs: '{pocet} výstup včetně zkrácených verzí',
    en: '{pocet} deliverable including shortened versions',
  },
  'vystupy.pocet234': {
    cs: '{pocet} výstupy včetně zkrácených verzí',
    en: '{pocet} deliverables including shortened versions',
  },
  'vystupy.pocet5': {
    cs: '{pocet} výstupů včetně zkrácených verzí',
    en: '{pocet} deliverables including shortened versions',
  },
  'vystupy.pridatVystup': { cs: 'Přidat výstup', en: 'Add a deliverable' },
  'vystupy.nataceciTextNapoveda': {
    cs: 'Vyrobí na Disku dokument se spoty, jejich délkami a licencemi — text se píše přímo v něm',
    en: 'Creates a document on Drive with the adverts, their lengths and licences — the script is written straight into it',
  },
  'vystupy.nataceciText': { cs: 'Natáčecí text na Disk', en: 'Recording script to Drive' },
  'vystupy.otevritNataceciText': { cs: 'Otevřít natáčecí text ↗', en: 'Open the recording script ↗' },
  'vystupy.nabidkaNapoveda': {
    cs: 'Založí rozpracovanou nabídku — jedna položka za výstup',
    en: 'Creates a draft quote — one line per deliverable',
  },
  'vystupy.nabidkaZVystupu': { cs: 'Nabídka z výstupů', en: 'Quote from the deliverables' },
  'vystupy.nabidkaZalozena': {
    cs: 'Nabídka {cislo} je založená jako rozpracovaná — ceny v ní zkontrolujte a doplňte.',
    en: 'Quote {cislo} has been created as a draft — please check and fill in the prices.',
  },
  'vystupy.otevritNabidku': { cs: 'Otevřít nabídku', en: 'Open the quote' },
  'vystupy.chybaUlozeni': { cs: 'Nepovedlo se to uložit.', en: 'It could not be saved.' },
  'vystupy.zadnyVystup': { cs: 'Zatím tu není žádný výstup.', en: 'There is no deliverable here yet.' },
  'vystupy.zadnyVystupPridejte': {
    cs: 'Zatím tu není žádný výstup — přidejte ho tlačítkem +.',
    en: 'There is no deliverable here yet — add one with the + button.',
  },
  'vystupy.nahledNadpis': { cs: 'Náhled natáčecího textu', en: 'Recording script preview' },
  'vystupy.zvetsitNahled': { cs: 'Zvětšit náhled', en: 'Enlarge the preview' },
  'vystupy.zvetsitNahledPopis': {
    cs: 'Zvětšit náhled natáčecího textu',
    en: 'Enlarge the recording script preview',
  },
  'vystupy.zavritNahled': { cs: 'Zavřít náhled', en: 'Close the preview' },
  'vystupy.nazevVystupu': { cs: 'Název výstupu', en: 'Deliverable name' },
  'vystupy.herci': { cs: 'Herci', en: 'Narrators' },
  'vystupy.herciPrazdne': { cs: 'herci', en: 'narrators' },
  'vystupy.licence': { cs: 'Licence', en: 'Licences' },
  'vystupy.licencePrazdne': { cs: 'licence', en: 'licences' },
  'vystupy.delka': { cs: 'Délka', en: 'Length' },
  'vystupy.delkaPrazdne': { cs: 'délka', en: 'length' },
  'vystupy.delkaNapoveda': { cs: 'Sekundy (30), minuty (2 min), nebo 1:30', en: 'Seconds (30), minutes (2 min) or 1:30' },
  'vystupy.delkaSpatne': {
    cs: 'Délce „{delka}" nerozumím — napište sekundy (30), minuty (2 min) nebo 1:30.',
    en: 'I do not understand the length “{delka}” — write seconds (30), minutes (2 min) or 1:30.',
  },
  'vystupy.rlNapoveda': { cs: '{soubor} (verze {cislo})', en: '{soubor} (version {cislo})' },
  'vystupy.navrh': { cs: 'návrh', en: 'draft' },
  'vystupy.navrhNapoveda': {
    cs: 'Návrh z objednávky — uložením řádku ho potvrdíte.',
    en: 'A draft from the order — saving the row confirms it.',
  },
  'vystupy.ulozitVystup': { cs: 'Uložit výstup', en: 'Save the deliverable' },
  // Text spotu u výstupu (30. 9. 2026) - viz VystupySection a lib/docxText.ts.
  'vystupy.text': { cs: 'Text', en: 'Script' },
  'vystupy.textNapoveda': {
    cs: 'Text spotu — propíše se do natáčecího listu',
    en: 'The spot script — it goes into the recording sheet',
  },
  'vystupy.textNadpis': { cs: 'Text spotu', en: 'Spot script' },
  'vystupy.textNahrat': { cs: 'Nahrát z Wordu', en: 'Upload from Word' },
  'vystupy.textNacitam': { cs: 'Čtu soubor…', en: 'Reading the file…' },
  'vystupy.textPrazdne': {
    cs: 'Sem patří text, který se bude natáčet. Můžete ho napsat, vložit ze schránky, nebo nahrát z Wordu.',
    en: 'This is where the text to be recorded goes. Type it, paste it, or upload it from Word.',
  },
  'vystupy.textChyba': { cs: 'Soubor se nepodařilo přečíst.', en: 'The file could not be read.' },
  'vystupy.textFormat': {
    cs: 'Nahrát jde .docx (Word), .txt a .md. Uloží se spolu s výstupem tlačítkem Uložit.',
    en: 'You can upload .docx (Word), .txt and .md. It is saved together with the deliverable using Save.',
  },
  'vystupy.coSVystupem': { cs: 'Co se s výstupem dá udělat', en: 'What you can do with the deliverable' },
  'vystupy.otevritRodnyList': { cs: 'Otevřít rodný list (v{cislo})', en: 'Open the advert record (v{cislo})' },
  'vystupy.vyrobitRodnyList': { cs: 'Vyrobit rodný list', en: 'Create the advert record' },
  'vystupy.vyrobitNovouVerzi': { cs: 'Vyrobit novou verzi', en: 'Create a new version' },
  'vystupy.zkracenaVerze': { cs: 'Zkrácená verze', en: 'Shortened version' },
  'vystupy.opravduSmazat': { cs: 'Opravdu smazat?', en: 'Really delete?' },
  'vystupy.smazatVystup': { cs: 'Smazat výstup', en: 'Delete the deliverable' },
  'vyberVOkne.dedi': { cs: '{jmena} (dědí)', en: '{jmena} (inherited)' },
  'vyberVOkne.neniZCehoVybrat': { cs: 'Není z čeho vybrat.', en: 'Nothing to choose from.' },
  'vyberVOkne.dopsatJmeno': { cs: 'Dopsat jméno a Enter…', en: 'Type a name and press Enter…' },

  // --- licenční listy (dávka 7b) --------------------------------------------
  // POZOR: hodnoty, které jdou DO PDF (typ licence „výhradní", typ díla,
  // délka licence, média), zůstávají české - jazyk dokumentu určuje doklad,
  // ne přepínač v liště (pravidlo 5). Přeložené je jen rozhraní.
  'licencniList.nadpis': { cs: 'Licenční listy', en: 'Licence sheets' },
  'licencniList.pocet1': { cs: 'Vystaveno {pocet} list', en: '{pocet} sheet issued' },
  'licencniList.pocet234': { cs: 'Vystaveno {pocet} listy', en: '{pocet} sheets issued' },
  'licencniList.pocet5': { cs: 'Vystaveno {pocet} listů', en: '{pocet} sheets issued' },
  'licencniList.spolecneUdaje': { cs: 'Společné údaje', en: 'Shared details' },
  'licencniList.spolecneUdajeNapoveda': {
    cs: 'Klient, objednatel, území, podmínky, podpis — společné všem listům',
    en: 'Customer, orderer, territory, terms, signature — shared by every sheet',
  },
  'licencniList.stahnoutVsechny': { cs: 'Stáhnout všechny ({pocet})', en: 'Download all ({pocet})' },
  'licencniList.stahnoutVsechnyNapoveda': {
    cs: 'Stáhne všechny vystavené listy zakázky v jednom archivu',
    en: 'Downloads every issued sheet for the job in a single archive',
  },
  'licencniList.vystavitNapoveda': {
    cs: 'Vystaví jeden licenční list za každý výstup',
    en: 'Issues one licence sheet for each deliverable',
  },
  'licencniList.vystavuji': { cs: 'Vystavuji…', en: 'Issuing…' },
  'licencniList.vystavitPocet': { cs: 'Vystavit {pocet} listů', en: 'Issue {pocet} sheets' },
  'licencniList.vystavitList': { cs: 'Vystavit list', en: 'Issue the sheet' },
  'licencniList.objednatel': { cs: 'Objednatel', en: 'Orderer' },
  'licencniList.objednatelNapoveda': { cs: 'Kdo si spot u nás objednal.', en: 'Who ordered the advert from us.' },
  'licencniList.dodavatel': { cs: 'Dodavatel', en: 'Supplier' },
  'licencniList.uzemi': { cs: 'Území', en: 'Territory' },
  'licencniList.misto': { cs: 'Místo (V …, dne)', en: 'Place (in …, on)' },
  'licencniList.mistoNapoveda': { cs: 'Např. „Brně“.', en: 'For example “Brno”.' },
  'licencniList.podepisuje': { cs: 'Za MEDIA SPACE podepisuje', en: 'Signed for MEDIA SPACE by' },
  'licencniList.podminky': { cs: 'Prodloužení licence a podmínky', en: 'Licence extension and terms' },
  'licencniList.podminkyNapoveda': {
    cs: 'Odstavce oddělte prázdným řádkem.',
    en: 'Separate paragraphs with a blank line.',
  },
  'licencniList.klient': { cs: 'Klient', en: 'Customer' },
  'licencniList.klientPriklad': { cs: 'Koncový zadavatel', en: 'The end customer' },
  'licencniList.klientNapoveda': {
    cs: 'Komu licence patří — u agenturní zakázky koncový zadavatel, ne objednatel. Pamatuje si ho projekt.',
    en: 'Who the licence belongs to — on an agency job the end customer, not the orderer. The project remembers it.',
  },
  'licencniList.radek': { cs: 'Licenční list', en: 'Licence sheet' },
  'licencniList.nazevSpotu': { cs: 'Název spotu', en: 'Advert name' },
  'licencniList.interpreti': { cs: 'Interpreti', en: 'Performers' },
  'licencniList.interpretiPrazdne': { cs: 'interpreti', en: 'performers' },
  'licencniList.delka': { cs: 'délka', en: 'length' },
  'licencniList.delkaLicence': { cs: 'Délka licence', en: 'Licence length' },
  'licencniList.delkaLicenceNapoveda': {
    cs: 'Na jak dlouho je licence sjednaná — „1 rok“, „18 měsíců“',
    en: 'How long the licence runs for — “1 rok” (a year), “18 měsíců” (18 months)',
  },
  'licencniList.prepnoutTyp': { cs: 'Přepnout výhradní / nevýhradní', en: 'Switch exclusive / non-exclusive' },
  'licencniList.vystavenoKdy': { cs: 'Vystaveno {kdy} — {interpret}', en: 'Issued {kdy} — {interpret}' },
  'licencniList.vystaveno': { cs: 'Vystaveno ↗', en: 'Issued ↗' },
  'licencniList.chybiInterpret': {
    cs: 'U každého listu musí být aspoň jeden interpret.',
    en: 'Every sheet needs at least one performer.',
  },
  'licencniList.chybaVystaveni': {
    cs: 'Licenční list se nepodařilo vystavit.',
    en: 'The licence sheet could not be issued.',
  },
  'licencniList.chybaVystaveniRadku': {
    cs: 'licenční list se nepodařilo vystavit.',
    en: 'the licence sheet could not be issued.',
  },
  'licencniList.chybaKlienta': {
    cs: 'Klienta se nepodařilo uložit k projektu — na listech zůstane, ale po obnovení stránky se vrátí původní.',
    en: 'The customer could not be saved to the project — it stays on the sheets, but reloading the page brings the original back.',
  },
  'licencniList.opravduSmazat': {
    cs: 'Smazat tenhle licenční list? Klient ho přestane v portálu vidět.',
    en: 'Delete this licence sheet? The customer will stop seeing it in the portal.',
  },
  'licencniList.hotovo1': { cs: 'Hotovo — vystaven 1 list.', en: 'Done — 1 sheet issued.' },
  'licencniList.hotovoPocet': { cs: 'Hotovo — vystaveno {pocet} listů.', en: 'Done — {pocet} sheets issued.' },
  'licencniList.smazat': { cs: 'Smazat licenční list', en: 'Delete the licence sheet' },
  'licencniList.nahledNadpis': { cs: 'Náhled licenčního listu', en: 'Licence sheet preview' },
  'licencniList.prekresluji': { cs: 'Překresluji…', en: 'Redrawing…' },
  'licencniList.zvetsitNahled': { cs: 'Zvětšit náhled', en: 'Enlarge the preview' },
  'licencniList.zvetsitNahledPopis': {
    cs: 'Zvětšit náhled licenčního listu',
    en: 'Enlarge the licence sheet preview',
  },
  'licencniList.vNahleduJe': {
    cs: 'V náhledu je {nazev} — klepnutím na jiný řádek se přepne.',
    en: 'The preview shows {nazev} — click another row to switch.',
  },
  'licencniList.zavritNahled': { cs: 'Zavřít náhled', en: 'Close the preview' },
  'licencniList.dalsiUTohotoListu': { cs: 'Další u tohoto listu', en: 'More for this sheet' },
  'licencniList.menuNapoveda': {
    cs: 'Média, datum výroby, vystavit tenhle list',
    en: 'Media, production date, issue this sheet',
  },
  'licencniList.media': { cs: 'Média', en: 'Media' },
  'licencniList.datumVyroby': { cs: 'Datum výroby', en: 'Production date' },
  'licencniList.vystavitZnovu': { cs: 'Vystavit znovu', en: 'Issue again' },
  'licencniList.vystavitJenTenhle': { cs: 'Vystavit jen tenhle list', en: 'Issue only this sheet' },
  'licencniList.smazatVystaveny': { cs: 'Smazat vystavený list', en: 'Delete the issued sheet' },
  /* ---------------------------------------------------------------------
   * Interní údaje na detailu projektu (ProjectMetaForm) — dávka 7b.
   * Názvy stavů projektu zůstávají české schválně (viz
   * docs/preklad-portalu.md, dávka 5): ukládají se do databáze česky.
   * ------------------------------------------------------------------- */
  'obecne.nevybrano': { cs: '— nevybráno —', en: '— not selected —' },
  'obecne.spojkaA': { cs: 'a', en: 'and' },
  'projektMeta.kartaVyroba': { cs: 'Výroba', en: 'Production' },
  'projektMeta.kartaZakazka': { cs: 'Zakázka', en: 'Job' },
  'projektMeta.kartaOdkazy': { cs: 'Odkazy', en: 'Links' },
  'projektMeta.jenKeCteni': { cs: 'Jen ke čtení', en: 'Read-only' },
  'projektMeta.datumDokonceni': { cs: 'Datum dokončení', en: 'Completion date' },
  'projektMeta.datumDokonceniNapoveda': {
    cs: 'Do kdy to máme odevzdat.',
    en: 'The date we have to deliver by.',
  },
  'projektMeta.datumVydani': { cs: 'Datum vydání', en: 'Release date' },
  'projektMeta.datumVydaniNapoveda': {
    cs: 'Kdy to má klient vydat.',
    en: 'The date the customer publishes it.',
  },
  'projektMeta.normostrany': { cs: 'Normostrany', en: 'Standard pages' },
  'projektMeta.normostranyNapoveda': {
    cs: 'Rozsah celé knihy. Plánují se podle něj frekvence a počítá se z něj progres natáčení, dokud ve složce projektu není PDF s textem.',
    en: 'The length of the whole book. Recording sessions are planned from it and the recording progress is worked out from it until there is a PDF of the text in the project folder.',
  },
  'projektMeta.stavProjektu': { cs: 'Stav projektu', en: 'Project status' },
  'projektMeta.stavTitulek': { cs: 'Přehodit stav projektu', en: 'Change the project status' },
  'projektMeta.stavRucne': {
    cs: 'Stav přehazujete ručně podle toho, kde projekt je.',
    en: 'You switch the status by hand according to where the project stands.',
  },
  'projektMeta.staryStavCaflou': {
    cs: '{stav} (starý stav z Caflou)',
    en: '{stav} (old status from Caflou)',
  },
  'projektMeta.prekopiDnes': {
    cs: 'Dnes v noci se sám překlopí na „{stav}“.',
    en: 'Tonight it switches itself to “{stav}”.',
  },
  'projektMeta.prekopiZaDen': {
    cs: 'Za {pocet} den se sám překlopí na „{stav}“.',
    en: 'It switches itself to “{stav}” in {pocet} day.',
  },
  'projektMeta.prekopiZaDny': {
    cs: 'Za {pocet} dny se sám překlopí na „{stav}“.',
    en: 'It switches itself to “{stav}” in {pocet} days.',
  },
  'projektMeta.prekopiZaDnu': {
    cs: 'Za {pocet} dnů se sám překlopí na „{stav}“.',
    en: 'It switches itself to “{stav}” in {pocet} days.',
  },
  'projektMeta.herec': { cs: 'Herec', en: 'Narrator' },
  'projektMeta.herci': { cs: 'Herci', en: 'Narrators' },
  'projektMeta.dotocenoKdy': { cs: 'Dotočeno {datum}', en: 'Recording completed {datum}' },
  'projektMeta.dotocenoSr': { cs: ' — dotočeno', en: ' — recording completed' },
  'projektMeta.herciNapovedaReklama': {
    cs: 'Herců může být víc. Podle Herce 1 se předvyplňuje natáčecí frekvence. Klepnutí na jméno otevře, co se s hercem dá udělat — dotočeno, zpráva klientovi, pořadí, odebrání. Kdo v kterém spotu mluví, se vybírá v záložce Výstupy.',
    en: 'There can be more than one narrator. The recording session is pre-filled from Narrator 1. Tapping a name opens what you can do with them — recording completed, message to the customer, order, removal. Who speaks in which advert is chosen on the Deliverables tab.',
  },
  'projektMeta.herciNapovedaKniha': {
    cs: 'Herců může být víc. Podle Herce 1 se předvyplňuje natáčecí frekvence. Klepnutí na jméno otevře, co se s hercem dá udělat — dotočeno, zpráva klientovi, pořadí, odebrání. U dvou a víc herců je v tom okně i jeho {ns} — podle nich se pak plánují jeho frekvence.',
    en: 'There can be more than one narrator. The recording session is pre-filled from Narrator 1. Tapping a name opens what you can do with them — recording completed, message to the customer, order, removal. With two or more narrators that window also holds their {ns} — their recording sessions are planned from it.',
  },
  'projektMeta.herciNapovedaNs': { cs: 'počet normostran', en: 'number of standard pages' },
  'projektMeta.firma': { cs: 'Firma', en: 'Company' },
  'projektMeta.firmaNapoveda': { cs: 'Pro koho se projekt dělá.', en: 'Who the project is for.' },
  'projektMeta.klient': { cs: 'Klient', en: 'Customer' },
  'projektMeta.klientZFirmy': { cs: 'Z vybrané firmy', en: 'From the selected company' },
  'projektMeta.klientOstatni': { cs: 'Ostatní', en: 'Others' },
  'projektMeta.klientNapoveda': {
    cs: 'Na tuhle osobu chodí zprávy o projektu.',
    en: 'Messages about the project go to this person.',
  },
  'projektMeta.klientNapovedaCaflou': {
    cs: 'Na tuhle osobu chodí zprávy o projektu. V Caflou tu byl štítek „{stitek}“.',
    en: 'Messages about the project go to this person. In Caflou the label here was “{stitek}”.',
  },
  'projektMeta.manazer': { cs: 'Manažer projektu', en: 'Project manager' },
  'projektMeta.priorita': { cs: 'Priorita', en: 'Priority' },
  'projektMeta.prioritaNapoveda': {
    cs: 'Každé klepnutí přidá čárku, po třetí se vrátí na jednu.',
    en: 'Each tap adds a bar; after the third it goes back to one.',
  },
  'projektMeta.typProjektu': { cs: 'Typ projektu', en: 'Project type' },
  'projektMeta.typMimoCenik': { cs: '{typ} (mimo ceník)', en: '{typ} (not on the price list)' },
  'projektMeta.typZCeniku': {
    cs: 'Nabídka se bere z Ceníků v administraci.',
    en: 'The options come from the price lists in administration.',
  },
  'projektMeta.typCenikPrazdny': {
    cs: 'Ceník je zatím prázdný — typy projektu se přidávají v administraci v sekci Ceníky.',
    en: 'The price list is still empty — project types are added in administration under Price lists.',
  },
  'projektMeta.licence': { cs: 'Licence', en: 'Licences' },
  'projektMeta.licenceNapoveda': {
    cs: 'Kde všude smí klient nahrávku použít. Druhy se spravují v Cenících.',
    en: 'Where the customer may use the recording. The types are managed in the price lists.',
  },
  'projektMeta.licenceUziti': {
    cs: 'Účel a území užití licence',
    en: 'Purpose and territory of licence use',
  },
  'projektMeta.licenceUzitiPlaceholder': {
    cs: 'např. audio reklama na Spotify, CZ+SK',
    en: 'e.g. audio advert on Spotify, CZ+SK',
  },
  'projektMeta.licenceUzitiNapoveda': {
    cs: 'Předvyplní se do smlouvy na tenhle spot.',
    en: 'It is pre-filled into the contract for this advert.',
  },
  'projektMeta.uvodKnihy': { cs: 'Úvod audioknihy', en: 'Audiobook intro' },
  'projektMeta.zaverKnihy': { cs: 'Závěr audioknihy', en: 'Audiobook outro' },
  'projektMeta.zaverNapoveda': {
    cs: 'Přijde z objednávky klienta, tady se dá upravit.',
    en: 'It comes from the customer’s order and can be edited here.',
  },
  'projektMeta.odkazKz': { cs: 'Odkaz na KZ', en: 'Job card link' },
  'projektMeta.odkazOtevritSlozku': { cs: 'Otevřít složku', en: 'Open the folder' },
  'projektMeta.odkazSlozkaProjektu': { cs: 'Složka projektu', en: 'Project folder' },
  'projektMeta.odkazSlozkaFirmy': { cs: 'Složka firmy', en: 'Company folder' },
  'projektMeta.odkazZmenit': { cs: 'Změnit odkaz', en: 'Change the link' },
  'projektMeta.odkazZadat': { cs: 'Zadat odkaz', en: 'Enter a link' },
  'projektMeta.odkazNapoveda': {
    cs: 'Složka projektu na Google Disku.',
    en: 'The project folder on Google Drive.',
  },
  'projektMeta.ulozeno': { cs: 'Uloženo', en: 'Saved' },
  'projektMeta.ukladaSeSamo': {
    cs: 'Změny se ukládají samy.',
    en: 'Changes are saved automatically.',
  },
  'projektMeta.smazatProjekt': { cs: 'Smazat projekt', en: 'Delete the project' },
  'projektMeta.smazatCo': { cs: 'Projekt', en: 'Project' },
  'projektMeta.smazatNapoveda': {
    cs: 'Když na projektu nic nevisí, smaže se rovnou. Když visí doklady, portál ukáže co a nabídne archivaci — doklady se přitom neruší, jen se od projektu odpojí. Složka na Disku zůstane, tu si smažte sami, pokud ji nechcete.',
    en: 'When nothing hangs on the project, it is deleted straight away. When documents hang on it, the portal shows which ones and offers archiving — the documents are not cancelled, only detached from the project. The folder on Drive stays; delete it yourself if you do not want it.',
  },
  'projektMeta.chybaUlozeni': { cs: 'Uložení se nezdařilo.', en: 'Saving failed.' },
  'projektMeta.chybaNormostrany': {
    cs: 'Normostrany se nepodařilo uložit.',
    en: 'The standard pages could not be saved.',
  },
  'projektMeta.chybaUlozit': { cs: 'Nepodařilo se to uložit.', en: 'It could not be saved.' },
  'projektMeta.chybaZprava': {
    cs: 'Zprávu se nepodařilo poslat.',
    en: 'The message could not be sent.',
  },
  'projektMeta.odeslano': { cs: 'Odesláno.', en: 'Sent.' },
  'projektMeta.ukazatKlientovi': {
    cs: 'Ukázat, co klientovi dorazí',
    en: 'Show what the customer will get',
  },
  'projektMeta.posilam': { cs: 'Posílám…', en: 'Sending…' },
  'projektMeta.poslatZnovu': {
    cs: 'Poslat zprávu ke stavu znovu',
    en: 'Send the status message again',
  },
  'projektMeta.vetuZrusit': { cs: 'Zrušit větu navíc', en: 'Cancel the extra sentence' },
  'projektMeta.vetuPridat': { cs: 'Přidat větu navíc', en: 'Add an extra sentence' },
  'projektMeta.vetaPlaceholder': {
    cs: 'Například omluva za to, že minulý odkaz nefungoval. Vzor zprávy se tím nemění — platí to jen pro tohle jedno odeslání.',
    en: 'For example an apology that the last link did not work. The message template is not changed by it — it applies to this one sending only.',
  },
  'projektMeta.nepovedloSe': { cs: 'Nepodařilo se to.', en: 'It did not work.' },
  'projektMeta.spojeniSelhalo': {
    cs: 'Nepodařilo se spojit se serverem.',
    en: 'Could not reach the server.',
  },
  /* Okno s akcemi u herce (VyberHercu) a odznak strany (OdznakStrany). */
  'vyberHercu.poradi': { cs: 'Herec {poradi}', en: 'Narrator {poradi}' },
  'vyberHercu.bublinaPopisek': {
    cs: 'Klepnutím otevřete, co se s hercem dá udělat',
    en: 'Tap to open what you can do with the narrator',
  },
  'vyberHercu.dotocenoKdy': { cs: 'Dotočeno {datum}', en: 'Recording completed {datum}' },
  'vyberHercu.zrusitDotoceno': { cs: 'Zrušit dotočeno', en: 'Undo recording completed' },
  'vyberHercu.oznacitDotoceno': { cs: 'Označit dotočeno', en: 'Mark recording completed' },
  'vyberHercu.oznacitDotocenoOtazka': { cs: 'Označit dotočeno?', en: 'Mark recording completed?' },
  'vyberHercu.zjistuji': { cs: 'Zjišťuji, co se stane…', en: 'Working out what happens…' },
  'vyberHercu.anoDotoceno': { cs: 'Ano, dotočeno', en: 'Yes, completed' },
  'vyberHercu.zpet': { cs: 'Zpět', en: 'Back' },
  'vyberHercu.poslatKlientovi': { cs: 'Poslat klientovi znovu', en: 'Send to the customer again' },
  'vyberHercu.normostrany': { cs: 'Normostrany', en: 'Standard pages' },
  'vyberHercu.normostranyTitulek': {
    cs: 'Normostrany tohoto herce — podle nich se plánují jeho frekvence',
    en: 'This narrator’s standard pages — their recording sessions are planned from them',
  },
  'vyberHercu.posunoutVys': {
    cs: 'Posunout výš (na Herce {poradi})',
    en: 'Move up (to Narrator {poradi})',
  },
  'vyberHercu.odebratZProjektu': { cs: 'Odebrat z projektu', en: 'Remove from the project' },
  'vyberHercu.pridatDalsiho': { cs: 'přidat dalšího herce', en: 'add another narrator' },
  'vyberHercu.hledatCaflou': {
    cs: 'hledat herce (v Caflou: {jmeno})',
    en: 'search for a narrator (in Caflou: {jmeno})',
  },
  'vyberHercu.zacnetePsat': {
    cs: 'začněte psát jméno herce',
    en: 'start typing the narrator’s name',
  },
  'vyberHercu.zadnyHerec': {
    cs: 'V portálu zatím není žádný herec — nejdřív ho založte mezi uživateli.',
    en: 'There is no narrator in the portal yet — add one under users first.',
  },
  'vyberHercu.vsichniJsou': {
    cs: 'Všichni herci už jsou u projektu.',
    en: 'All the narrators are already on the project.',
  },
  'vyberHercu.nikdoTakovy': { cs: 'Nikdo takový tu není.', en: 'There is nobody like that here.' },
  'vyberHercu.coSeStaneNezname': {
    cs: 'Co se stane, se teď nepodařilo zjistit. Fajfka se uloží a zpráva odejde tak jako vždycky.',
    en: 'What happens could not be worked out just now. The tick will be saved and the message will go out as always.',
  },
  'vyberHercu.coSeStaneReklama': {
    cs: 'U reklamy se uloží jen fajfka — stav projektu se nemění a nikomu nic nechodí.',
    en: 'For an advert only the tick is saved — the project status does not change and nothing goes to anybody.',
  },
  'vyberHercu.coSeStaneUzMa': {
    cs: '{jmeno} fajfku už má — znovu se nic neuloží ani neodešle.',
    en: '{jmeno} already has the tick — nothing will be saved or sent again.',
  },
  'odznakStrany.titulek': {
    cs: 'Natočeno do strany {strana} — zapsal Bruno z chatu',
    en: 'Recorded up to page {strana} — logged by Bruno from the chat',
  },
  'odznakStrany.sr': { cs: ' — natočeno do strany', en: ' — recorded up to page' },
  /* Co se stane po označení dotočeno (lib/dotoceni.ts). Názvy stavů uvnitř
     vět jsou data z databáze — zůstávají české i v anglické větě. */
  'dotoceni.fajfka': {
    cs: '{jmeno} dostane fajfku „dotočeno“ s dnešním datem.',
    en: '{jmeno} gets a “recording completed” tick with today’s date.',
  },
  'dotoceni.stavPrehodi': {
    cs: 'Stav projektu se přehodí z „{z}“ na „{na}“.',
    en: 'The project status switches from “{z}” to “{na}”.',
  },
  'dotoceni.stavZustavaJeden': {
    cs: 'Stav projektu se zatím nemění — dotočeno chybí ještě jednomu herci.',
    en: 'The project status stays as it is — one more narrator has yet to finish recording.',
  },
  'dotoceni.stavZustavaVic': {
    cs: 'Stav projektu se zatím nemění — dotočeno chybí ještě {pocet} hercům.',
    en: 'The project status stays as it is — {pocet} more narrators have yet to finish recording.',
  },
  'dotoceni.mailDostane': { cs: 'Mail o tom dostane {kdo}.', en: '{kdo} will get an email about it.' },
  'dotoceni.mailNikdo': {
    cs: 'Z nás to mailem nedostane nikdo — nemá to nikdo zaškrtnuté na kartě účtu.',
    en: 'Nobody on our side will get an email — nobody has it ticked on their account.',
  },
  'dotoceni.klientoviOdejde': {
    cs: 'KLIENTOVI {kdo} odejde zpráva, že je s hercem dotočeno.',
    en: 'THE CUSTOMER {kdo} will get a message that recording with the narrator is complete.',
  },
  'dotoceni.klientNezapnul': {
    cs: 'Klientovi nic nechodí — zprávy o dotočení si nezapnul.',
    en: 'Nothing goes to the customer — they have not turned on messages about completed recording.',
  },
  'dotoceni.klientNeni': {
    cs: 'Klientovi nic nechodí — projekt žádného nemá vyplněného.',
    en: 'Nothing goes to the customer — the project has none filled in.',
  },
  /* Ukončení projektu (UkonceniProjektu). */
  'ukonceni.jeUkonceny': { cs: 'Projekt je ukončený', en: 'The project is closed' },
  'ukonceni.ukoncit': { cs: 'Ukončit projekt', en: 'Close the project' },
  'ukonceni.popisUkonceny': {
    cs: 'Je mezi dokončenými a klient už se na něj nezeptá. Kdyby to bylo omylem, vrátí se mezi aktivní.',
    en: 'It sits among the finished ones and the customer will not ask about it again. If that was a mistake, it goes back among the active ones.',
  },
  'ukonceni.popisAktivni': {
    cs: 'Když je projekt ve stavu „Schváleno - k fakturaci“ a fakturu klientovi pošlete z portálu, Bruno ho ukončí sám. Tohle je pro případ, že už odešla jinudy — přehodí stav na „Vyfakturováno“ a projekt zmizí z aktivních. Klientovi odsud nic nechodí.',
    en: 'When the project is in the “Schváleno - k fakturaci” status and you send the invoice to the customer from the portal, Bruno closes it himself. This is for when the invoice has already gone out elsewhere — it switches the status to “Vyfakturováno” and the project disappears from the active ones. Nothing goes to the customer from here.',
  },
  'ukonceni.vratit': { cs: 'Vrátit mezi aktivní', en: 'Return to the active ones' },
  'ukonceni.chyba': { cs: 'Nepodařilo se to uložit.', en: 'It could not be saved.' },

  /* ===== Dávka 7c: administrace - firmy, Caflou, žádosti o údaje, vzory,
     wikipedie, technické parametry, návody, přenos projektů ===== */

  /* Typy firem (lib/roles.ts). Role uz ve slovniku jsou od davky 5 - viz
     'role.*' vys. Ceska varianta zustava pro PDF a postu. */
  'typFirmy.KLIENT': { cs: 'Klient', en: 'Customer' },
  'typFirmy.DODAVATEL': { cs: 'Dodavatel', en: 'Supplier' },

  /* Karta firmy - záložky a přihlašovací účty. */
  'firma.zpetNaSeznam': { cs: '← Zpět na seznam firem', en: '← Back to the list of companies' },
  'firma.zalozkaUdaje': { cs: 'Údaje firmy', en: 'Company details' },
  'firma.zalozkaNotifikace': { cs: 'Notifikace', en: 'Notifications' },
  'firma.zalozkaUcty': { cs: 'Přihlašovací účty', en: 'Sign-in accounts' },
  'firma.zalozkaZakazky': { cs: 'Zakázky', en: 'Orders' },
  'firma.spravovatUzivatele': { cs: '+ Spravovat uživatele →', en: '+ Manage users →' },
  'firma.sloupecJmeno': { cs: 'Jméno', en: 'Name' },
  'firma.sloupecEmail': { cs: 'E-mail', en: 'Email' },
  'firma.sloupecTelefon': { cs: 'Telefon', en: 'Phone' },
  'firma.sloupecPristup': { cs: 'Typ přístupu', en: 'Access type' },
  'firma.sloupecZalozen': { cs: 'Založen', en: 'Created' },
  'firma.bezUctu': {
    cs: 'Tato firma zatím nemá žádný přihlašovací účet.',
    en: 'This company has no sign-in account yet.',
  },

  /* Karta firmy - formulář (CompanyForm). */
  'firma.typFirmy': { cs: 'Typ firmy:', en: 'Company type:' },
  'firma.nazev': { cs: 'Název firmy', en: 'Company name' },
  'firma.ic': { cs: 'IČ', en: 'Company number' },
  'firma.dic': { cs: 'DIČ', en: 'VAT number' },
  'firma.nacistZRegistru': { cs: 'Načíst z registru', en: 'Load from the register' },
  'firma.nacistZRegistruTitul': {
    cs: 'Doplnit název, DIČ a adresu z veřejného registru podle IČ',
    en: 'Fill in the name, VAT number and address from the public register by company number',
  },
  'firma.aresDoplneno': {
    cs: 'Údaje z registru doplněny — zkontrolujte a uložte.',
    en: 'Details from the register have been filled in — check them and save.',
  },
  'firma.aresNezdarilo': { cs: 'Načtení z registru se nezdařilo.', en: 'Loading from the register failed.' },
  'firma.platceDph': { cs: 'Plátce DPH', en: 'VAT registered' },
  'firma.ulice': { cs: 'Ulice a číslo popisné', en: 'Street and number' },
  'firma.psc': { cs: 'PSČ', en: 'Postcode' },
  'firma.mesto': { cs: 'Město', en: 'Town' },
  'firma.zeme': { cs: 'Země', en: 'Country' },
  'firma.cisloUctu': { cs: 'Číslo účtu', en: 'Account number' },
  'firma.splatnost': { cs: 'Doba splatnosti (dny)', en: 'Payment terms (days)' },
  'firma.splatnostHint': {
    cs: 'předvyplní se při vystavování faktury',
    en: 'pre-filled when an invoice is issued',
  },
  'firma.kontaktniOsoba': { cs: 'Kontaktní osoba', en: 'Contact person' },
  'firma.emailHint': { cs: 'sem chodí nabídky a faktury', en: 'quotes and invoices go here' },
  'firma.fakturyKlientovi': { cs: 'Posílat faktury i klientovi', en: 'Send invoices to the customer as well' },
  'firma.fakturyKlientoviPopis': {
    cs: 'Vedle e-mailu výš dostane fakturu v kopii i člověk, který má u téhle firmy na starost projekt, ke kterému je faktura navázaná.',
    en: 'Besides the email above, a copy of the invoice also goes to the person at this company who looks after the project the invoice is tied to.',
  },
  'firma.druhZakazek': { cs: 'Druh zakázek', en: 'Kind of work' },
  'firma.druhZakazekHint': {
    cs: 'klient uvidí jen příslušný typ objednávky — a podle toho mu chodí i zprávy o stavu projektu',
    en: 'the customer sees only the matching order form — and gets project status messages accordingly',
  },
  'firma.audioknihy': { cs: 'Audioknihy', en: 'Audiobooks' },
  'firma.reklamy': { cs: 'Reklamy', en: 'Adverts' },
  'firma.druhZakazekPopis': {
    cs: 'Jen Reklamy = zprávy podle vzorů pro reklamy, a to jen ve stavu „Dokončeno - ke schválení". Audioknihy (i spolu s reklamami) = zpráva ke každému kroku.',
    en: 'Adverts only = messages from the advert templates, and only in the “Dokončeno - ke schválení” status. Audiobooks (even together with adverts) = a message at every step.',
  },
  'firma.naKlic': { cs: 'Audioknihy na klíč', en: 'Turnkey audiobooks' },
  'firma.naKlicHint': {
    cs: 'platíme i herce a jednorázové položky (přeposlech, úprava textu) — v rozpočtu projektu pak přibude celkový rozpočet se ziskem z knihy',
    en: 'we also pay the narrators and one-off items (proof-listening, text editing) — the project budget then gains an overall budget with the profit from the book',
  },
  'firma.delameNaKlic': { cs: 'Děláme na klíč', en: 'We do these turnkey' },
  'firma.cenuUrcujeKlient': { cs: 'Cenu navrhuje klient', en: 'The customer proposes the price' },
  'firma.cenuUrcujeKlientHint': {
    cs: 'v objednávce se cena nepočítá z normostran — klient si ji vyplní sám (pole Počet normostran i Cena zůstávají)',
    en: 'the order does not work the price out from standard pages — the customer fills it in themselves (both the Standard pages and Price fields stay)',
  },
  'firma.cenuSiNavrhuje': { cs: 'Cenu si navrhuje sám', en: 'They propose the price themselves' },
  'firma.naCasti': { cs: 'Fakturujeme na dvě části', en: 'We invoice in two parts' },
  'firma.naCastiHint': {
    cs: 'po podpisu smlouvy polovina, zbytek potom — u faktury z nabídky se pak předvyplní naše interní značka 1. / 2. část; na dokladu se netiskne',
    en: 'half once the contract is signed, the rest afterwards — an invoice raised from a quote is then pre-filled with our internal 1st / 2nd part marker; it is not printed on the document',
  },
  'firma.naCastiVolba': { cs: 'Zakázka se fakturuje nadvakrát', en: 'The order is invoiced in two goes' },
  'firma.sazba': { cs: 'Sazba za normostranu (Kč bez DPH)', en: 'Rate per standard page (CZK excl. VAT)' },
  'firma.caflouId': { cs: 'ID firmy v Caflou', en: 'Company ID in Caflou' },
  'firma.caflouIdHint': {
    cs: 'podle tohoto ID se z Caflou tahají projekty této firmy do sekce Projekty',
    en: 'this ID is what pulls the company’s projects from Caflou into the Projects section',
  },
  'firma.caflouIdPlaceholder': { cs: 'např. 12345', en: 'e.g. 12345' },
  'firma.drive': { cs: 'Odkaz na složku Google Disk', en: 'Link to the Google Drive folder' },
  'firma.ulozitZmeny': { cs: 'Uložit změny', en: 'Save changes' },
  'firma.ulozeno': { cs: '✓ Uloženo', en: '✓ Saved' },
  'firma.ulozeniNezdarilo': { cs: 'Uložení se nezdařilo.', en: 'Saving failed.' },
  'firma.zmenaNezdarila': { cs: 'Změna se nezdařila.', en: 'The change failed.' },
  'firma.vyradit': { cs: 'Vyřadit firmu', en: 'Retire the company' },
  'firma.jeVyrazena': { cs: 'Firma je vyřazená', en: 'The company is retired' },
  'firma.vyraditPopis': {
    cs: 'Zmizí ze seznamů a z nabídek u dokladů. Faktury, smlouvy a projekty, které na ni odkazují, zůstanou beze změny — proto se nemaže.',
    en: 'It disappears from the lists and from the pickers on documents. Invoices, contracts and projects that refer to it stay unchanged — that is why it is not deleted.',
  },
  'firma.vyrazenaPopis': {
    cs: 'Neukazuje se v seznamech ani v nabídkách. Vrátit ji jde kdykoliv.',
    en: 'It does not show in the lists or the pickers. It can be brought back at any time.',
  },
  'firma.menim': { cs: 'Měním…', en: 'Changing…' },
  'firma.vratitMeziAktivni': { cs: 'Vrátit mezi aktivní', en: 'Return to the active ones' },
  'firma.smazatUplne': { cs: 'Smazat firmu úplně', en: 'Delete the company altogether' },
  'firma.smazatUplnePopis': {
    cs: 'Když na firmě nic nevisí, smaže se rovnou. Když něco visí, portál nejdřív ukáže co a nabídne archivaci. Nevratné.',
    en: 'If nothing hangs on the company, it is deleted straight away. If something does, the portal first shows what and offers to archive it. This cannot be undone.',
  },
  'firma.smazatCo': { cs: 'Firmu {nazev}', en: 'the company {nazev}' },
  'firma.smazatPopisek': { cs: 'Smazat firmu', en: 'Delete the company' },

  /* Karta firmy - notifikace. */
  'firma.notifikaceNacitam': { cs: 'Načítám nastavení…', en: 'Loading the settings…' },
  'firma.notifikaceUvod': {
    cs: 'Kdykoliv projekt téhle firmy přejde do některého ze stavů níž, portál o tom může dát vědět. Zpráva jde {komu} — tedy člověku, který je u projektu vyplněný v poli Klient — a nese v sobě tlačítko s odkazem na složku na Disku.',
    en: 'Whenever a project of this company moves into one of the statuses below, the portal can let people know. The message goes {komu} — that is, to the person filled in as the Customer on the project — and carries a button linking to the folder on Drive.',
  },
  'firma.notifikaceKlientProjektu': { cs: 'klientovi projektu', en: 'to the project’s customer' },
  'komu.NIKAM': { cs: 'Neposílat', en: 'Do not send' },
  'komu.KLIENT': { cs: 'Klientovi', en: 'To the customer' },
  'komu.INTERNE': { cs: 'Jen nám interně', en: 'Internally only' },
  'firma.komuZNas': { cs: 'Komu z nás to chodí', en: 'Who on our side gets it' },
  'firma.komuZNasPopis': {
    cs: 'U volby „Jen nám interně" jsou to jediní příjemci. U volby „Klientovi" jim zpráva chodí v kopii, ať je vidět, co klientovi odešlo.',
    en: 'With “Internally only” these are the only recipients. With “To the customer” they get a copy, so it is clear what went to the customer.',
  },
  'firma.odebratAdresu': { cs: 'Odebrat {email}', en: 'Remove {email}' },
  'firma.dalsiAdresa': {
    cs: 'Další adresa, třeba fakturace@mediaspace.cz',
    en: 'Another address, such as fakturace@mediaspace.cz',
  },
  'firma.neniEmail': { cs: '„{adresa}" nevypadá jako e-mail.', en: '“{adresa}” does not look like an email address.' },
  'firma.pridat': { cs: 'Přidat', en: 'Add' },
  'firma.nikdoVybrany': {
    cs: 'Nikdo vybraný — zprávy proto půjdou na {kdo}.',
    en: 'Nobody is selected — the messages will therefore go to {kdo}.',
  },
  'firma.ulozitNastaveni': { cs: 'Uložit nastavení', en: 'Save the settings' },
  'firma.predvyplnit': { cs: 'Předvyplnit:', en: 'Pre-fill:' },
  'firma.jakoAudioteka': { cs: 'jako Audioteka', en: 'like Audioteka' },
  'firma.jakoJota': { cs: 'jako Jota', en: 'like Jota' },

  /* Karta firmy - kontakt ke všem zakázkám. */
  'firma.priraditKontakt': {
    cs: 'Přiřadit kontakt ke všem zakázkám firmy',
    en: 'Assign a contact to all the company’s orders',
  },
  'firma.priraditKontaktPopis': {
    cs: 'Vybraný člověk uvidí zakázky firmy ve svých Projektech včetně dokončených. Proběhne to potichu — nikomu nechodí zpráva ani zvonek a do historie projektu se nic nepíše. Počítají se i starší zakázky, které mají firmu jen názvem (přenesené z Caflou) — těm se firma při té příležitosti naváže.',
    en: 'The chosen person will see the company’s orders in their Projects, finished ones included. It happens quietly — nobody gets a message or a bell and nothing is written into the project history. Older orders that have the company by name only (carried over from Caflou) count too — they get the company linked at the same time.',
  },
  'firma.vyberteKontakt': { cs: 'Vyberte kontaktní osobu…', en: 'Choose a contact person…' },
  'firma.prepsatIKde': { cs: 'přepsat i tam, kde už někdo je', en: 'overwrite even where somebody is set' },
  'firma.prepsatIKdePopis': {
    cs: 'bez zaškrtnutí se doplní jen zakázky bez kontaktu',
    en: 'unticked, only orders without a contact are filled in',
  },
  'firma.prirazuji': { cs: 'Přiřazuji…', en: 'Assigning…' },
  'firma.opravduKlepnete': { cs: 'Opravdu? Klepněte znovu', en: 'Really? Tap again' },
  'firma.priradit': { cs: 'Přiřadit', en: 'Assign' },
  'firma.prirazeniNepodarilo': { cs: 'Přiřazení se nepodařilo.', en: 'The assignment failed.' },
  'firma.zadnaZakazka': { cs: 'U téhle firmy zatím žádná zakázka není.', en: 'This company has no orders yet.' },
  'firma.nebyloCoMenit': {
    cs: 'Nebylo co měnit — {pocet} už kontakt má.',
    en: 'There was nothing to change — {pocet} already have a contact.',
  },
  'firma.prirazenoHotovo': {
    cs: 'Hotovo: {pocet} z {celkem} teď vede {jmeno}.',
    en: 'Done: {pocet} of {celkem} are now looked after by {jmeno}.',
  },
  'firma.zakazkaJedna': { cs: '{n} zakázka', en: '{n} order' },
  'firma.zakazkyMalo': { cs: '{n} zakázky', en: '{n} orders' },
  'firma.zakazekMnoho': { cs: '{n} zakázek', en: '{n} orders' },
  'firma.vybranyKontakt': { cs: 'vybraný kontakt', en: 'the chosen contact' },

  /* Karta firmy - zakázky (herec, typ, doklady). */
  'firma.doplnitKZakazkam': {
    cs: 'Doplnit k zakázkám herce, typ a doklady',
    en: 'Add narrator, type and documents to the orders',
  },
  'firma.doplnitKZakazkamPopis': {
    cs: 'Uloží se potichu — žádná notifikace, žádný zápis do historie projektu. V nabídce dokladů jsou jen nabídky a faktury téhle firmy, které ještě žádnou zakázku nemají.',
    en: 'It saves quietly — no notification, no entry in the project history. The document pickers only offer this company’s quotes and invoices that have no order yet.',
  },
  'firma.sloupecZakazka': { cs: 'Zakázka', en: 'Order' },
  'firma.sloupecHerec': { cs: 'Herec', en: 'Narrator' },
  'firma.sloupecTypProjektu': { cs: 'Typ projektu', en: 'Project type' },
  'firma.sloupecNabidka': { cs: 'Nabídka', en: 'Quote' },
  'firma.sloupecFaktura': { cs: 'Faktura', en: 'Invoice' },
  'firma.nechat': { cs: '— nechat —', en: '— leave as is —' },
  'firma.zadnyHerec': { cs: '— žádný herec —', en: '— no narrator —' },
  'firma.ted': { cs: 'teď: {co}', en: 'now: {co}' },
  'firma.nejdrivVyberte': { cs: 'Nejdřív něco vyberte.', en: 'Choose something first.' },
  'firma.ulozitPotichu': { cs: 'Uložit potichu', en: 'Save quietly' },
  'firma.doplnenoHotovo': {
    cs: 'Hotovo — herec u {herci}, typ u {typy}, nabídka u {nabidky} a faktura u {faktury} zakázek. Nikomu nic neodešlo.',
    en: 'Done — narrator on {herci}, type on {typy}, quote on {nabidky} and invoice on {faktury} orders. Nothing went out to anybody.',
  },
  'firma.ulozeniNepodarilo': { cs: 'Uložení se nepodařilo.', en: 'Saving failed.' },

  /* Karta firmy - test napojení na Caflou. */
  'firma.testCaflou': { cs: 'Test napojení na Caflou', en: 'Caflou connection test' },
  'firma.testCaflouPopis': {
    cs: 'Nevíš ID firmy v Caflou? Napiš níže její název (nebo část) a klikni na „Najít" — vypíšou se jen odpovídající firmy. Až ID doplníš a uložíš výše, ověř přímo projekty tlačítkem „Otestovat".',
    en: 'Do you not know the company’s Caflou ID? Type its name (or part of it) below and click “Find” — only matching companies are listed. Once you have filled the ID in and saved it above, check the projects themselves with “Test”.',
  },
  'firma.nazevVCaflou': { cs: 'název firmy v Caflou…', en: 'company name in Caflou…' },
  'firma.hledam': { cs: 'Hledám…', en: 'Searching…' },
  'firma.najit': { cs: 'Najít', en: 'Find' },
  'firma.testuji': { cs: 'Testuji…', en: 'Testing…' },
  'firma.otestovatProjekty': { cs: 'Otestovat projekty', en: 'Test the projects' },
  'firma.chybaPozadavku': { cs: 'Chyba požadavku', en: 'Request error' },
  'firma.nicNenalezeno': { cs: 'Nic nenalezeno.', en: 'Nothing found.' },
  'firma.kopirovatId': { cs: 'Kopírovat ID', en: 'Copy the ID' },
  'firma.nalezenoFirem': { cs: 'Nalezeno {pocet} firem.', en: '{pocet} companies found.' },
  'firma.nalezenoFiremZuzit': {
    cs: 'Nalezeno {pocet} firem (zobrazeno prvních {kolik}, zkus hledání zúžit).',
    en: '{pocet} companies found (first {kolik} shown, try narrowing the search).',
  },

  /* Firmy z Caflou. */
  'kontaktCaflou.NEZARAZENO': { cs: 'Nezařazeno', en: 'Unsorted' },
  'kontaktCaflou.KLIENT': { cs: 'Klient', en: 'Customer' },
  'kontaktCaflou.HEREC': { cs: 'Herec', en: 'Narrator' },
  'kontaktCaflou.IGNOROVAT': { cs: 'Nepoužívat', en: 'Do not use' },
  'caflou.nadpis': { cs: 'Firmy z Caflou', en: 'Companies from Caflou' },
  'caflou.pracuji': { cs: 'Pracuji…', en: 'Working…' },
  'caflou.jenNacist': { cs: 'Jen načíst', en: 'Just load them' },
  'caflou.prenestRoztridene': { cs: 'Přenést roztříděné ({pocet})', en: 'Transfer the sorted ones ({pocet})' },
  'caflou.prenestRoztrideneTitul': {
    cs: 'Přenese jen to, co je tady roztříděné',
    en: 'Transfers only what has been sorted here',
  },
  'caflou.prenasim': { cs: 'Přenáším…', en: 'Transferring…' },
  'caflou.nacistAPrenest': { cs: 'Načíst a přenést do portálu', en: 'Load and transfer into the portal' },
  'caflou.nacistAPrenestTitul': {
    cs: 'Načte firmy z Caflou, odhadne klienty a herce a rovnou je založí v portálu',
    en: 'Loads the companies from Caflou, guesses customers and narrators and creates them in the portal straight away',
  },
  'caflou.nacitam': { cs: 'Načítám z Caflou…', en: 'Loading from Caflou…' },
  'caflou.nacteno': { cs: 'Načteno {pocet} firem…', en: '{pocet} companies loaded…' },
  'caflou.hotovoNacteno': { cs: 'Hotovo — načteno {pocet} firem.', en: 'Done — {pocet} companies loaded.' },
  'caflou.nactenoPrenasim': {
    cs: 'Načteno {pocet} firem, přenáším do portálu…',
    en: '{pocet} companies loaded, transferring into the portal…',
  },
  'caflou.importNezdaril': { cs: 'Import se nezdařil.', en: 'The import failed.' },
  'caflou.prenosNezdaril': { cs: 'Přenos se nezdařil.', en: 'The transfer failed.' },
  'caflou.prenosNezdarilMale': { cs: 'přenos se nezdařil.', en: 'the transfer failed.' },
  'caflou.souhrnPrenosu': {
    cs: 'Načteno {nacteno} firem · založeno {zalozeno}, doplněno {doplneno}, přeskočeno {preskoceno}.',
    en: '{nacteno} companies loaded · {zalozeno} created, {doplneno} filled in, {preskoceno} skipped.',
  },
  'caflou.souhrnZalozeni': {
    cs: 'Založeno {zalozeno}, doplněno {doplneno}, přeskočeno {preskoceno}.',
    en: '{zalozeno} created, {doplneno} filled in, {preskoceno} skipped.',
  },
  'caflou.souhrnJednoho': {
    cs: '{nazev}: založeno {zalozeno}, doplněno {doplneno}, přeskočeno {preskoceno}.',
    en: '{nazev}: {zalozeno} created, {doplneno} filled in, {preskoceno} skipped.',
  },
  'caflou.chybaUFirmy': { cs: '{nazev}: {chyba}', en: '{nazev}: {chyba}' },
  'caflou.nejdrivRoztridit': {
    cs: 'Nejdřív u firem vyberte, jestli jde o klienta, nebo o herce.',
    en: 'First choose for each company whether it is a customer or a narrator.',
  },
  'caflou.emailNeulozen': { cs: 'E-mail se nepodařilo uložit.', en: 'The email could not be saved.' },
  'caflou.coSeStalo': { cs: 'Co se stalo', en: 'What happened' },
  'caflou.zalozeno': { cs: 'Založeno', en: 'Created' },
  'caflou.doplneno': { cs: 'Doplněno', en: 'Filled in' },
  'caflou.preskoceno': { cs: 'Přeskočeno', en: 'Skipped' },
  'caflou.vse': { cs: 'Vše', en: 'All' },
  'caflou.uzVPortalu': { cs: 'Už v portálu', en: 'Already in the portal' },
  'caflou.hledat': { cs: 'Hledat název, IČ, e-mail…', en: 'Search name, company number, email…' },
  'caflou.sloupecNazev': { cs: 'Název', en: 'Name' },
  'caflou.sloupecIc': { cs: 'IČ', en: 'Company number' },
  'caflou.sloupecKontakt': { cs: 'Kontakt', en: 'Contact' },
  'caflou.sloupecMesto': { cs: 'Město', en: 'Town' },
  'caflou.sloupecKdoToJe': { cs: 'Kdo to je', en: 'Who it is' },
  'caflou.sloupecPrenest': { cs: 'Přenést', en: 'Transfer' },
  'caflou.prazdno': {
    cs: 'Zatím tu nic není — načtěte firmy z Caflou tlačítkem nahoře.',
    en: 'Nothing here yet — load the companies from Caflou with the button above.',
  },
  'caflou.nicNeodpovida': { cs: 'Nic neodpovídá filtru.', en: 'Nothing matches the filter.' },
  'caflou.dopisteEmail': { cs: 'dopište e-mail', en: 'add an email' },
  'caflou.prenest': { cs: 'Přenést', en: 'Transfer' },
  'caflou.nejdrivVyberteVlevo': { cs: 'nejdřív vyberte vlevo', en: 'choose on the left first' },
  'caflou.shodaNapojeno': { cs: 'Firmy (napojeno na Caflou)', en: 'Companies (linked to Caflou)' },
  'caflou.shodaFirmyIc': { cs: 'Firmy (shodné IČ)', en: 'Companies (matching company number)' },
  'caflou.shodaHerciIc': { cs: 'Herci (shodné IČ)', en: 'Narrators (matching company number)' },
  'caflou.shodaFirmyNazev': { cs: 'Firmy (shodný název)', en: 'Companies (matching name)' },
  'caflou.shodaHerciNazev': { cs: 'Herci (shodný název)', en: 'Narrators (matching name)' },

  /* Žádosti o údaje (administrace). */
  'zadost.nadpis': { cs: 'Žádosti o údaje', en: 'Requests for details' },
  'zadost.uvod': {
    cs: 'Pošlete herci nebo firmě odkaz, ať si své údaje vyplní sami. Co vyplní, se propíše do portálu — u někoho, koho už v portálu máme, se přepisy nejdřív ukážou vám.',
    en: 'Send a narrator or a company a link so they can fill their details in themselves. Whatever they fill in is written into the portal — for somebody we already have, any overwrites are shown to you first.',
  },
  'zadost.rozeslane': { cs: 'Rozeslané žádosti', en: 'Requests sent out' },
  'zadost.nikomuNechodi': {
    cs: 'Vyplněné údaje zatím nikomu nechodí — zapněte to někomu na kartě uživatele („Dostává vyplněné údaje").',
    en: 'Nobody is getting the completed details yet — turn it on for somebody on their user card (“Gets completed details”).',
  },
  'zadost.udajeChodi': { cs: 'Vyplněné údaje chodí: {kdo}.', en: 'Completed details go to: {kdo}.' },
  'zadost.zadnaZadost': { cs: 'Zatím žádná žádost.', en: 'No requests yet.' },
  'zadost.druhHerec': { cs: 'Herec', en: 'Narrator' },
  'zadost.druhFirma': { cs: 'Firma', en: 'Company' },
  'zadost.bezJmena': { cs: '(bez jména)', en: '(no name)' },
  'zadost.stavVyplnena': { cs: 'Čeká na odklepnutí', en: 'Waiting to be waved through' },
  'zadost.stavCeka': { cs: 'Čeká na vyplnění', en: 'Waiting to be filled in' },
  'zadost.stavHotova': { cs: 'Hotovo', en: 'Done' },
  'zadost.stavZrusena': { cs: 'Zrušeno', en: 'Cancelled' },
  'zadost.nova': { cs: 'Nová žádost', en: 'New request' },
  'zadost.jesteNemame': { cs: 'Ještě ho v portálu nemáme', en: 'We do not have them in the portal yet' },
  'zadost.doplnitKomu': { cs: 'Doplnit někomu, koho máme', en: 'Fill in details for somebody we have' },
  'zadost.vyberte': { cs: 'Vyberte…', en: 'Choose…' },
  'zadost.jmenoHerce': { cs: 'Jméno herce', en: 'Narrator’s name' },
  'zadost.nazevFirmy': { cs: 'Název firmy', en: 'Company name' },
  'zadost.emailKamPoslat': { cs: 'E-mail (kam poslat odkaz)', en: 'Email (where to send the link)' },
  'zadost.emailPlaceholder': {
    cs: 'Nechte prázdné, když odkaz pošlete sami',
    en: 'Leave empty if you will send the link yourself',
  },
  'zadost.vzkaz': { cs: 'Vzkaz do e-mailu (nepovinné)', en: 'Note in the email (optional)' },
  'zadost.vzkazPlaceholder': {
    cs: 'Např. „Kvůli smlouvě na Kubánské tango."',
    en: 'E.g. “For the contract on Kubánské tango.”',
  },
  'zadost.zakladam': { cs: 'Zakládám…', en: 'Creating…' },
  'zadost.vytvoritAPoslat': { cs: 'Vytvořit a poslat e-mailem', en: 'Create and send by email' },
  'zadost.jenVytvorit': { cs: 'Jen vytvořit odkaz', en: 'Just create the link' },
  'zadost.nepodariloZalozit': { cs: 'Žádost se nepodařilo založit.', en: 'The request could not be created.' },
  'zadost.odkazOdesel': { cs: 'Odkaz odešel na {komu}.', en: 'The link has gone to {komu}.' },
  'zadost.odkazNeodesel': {
    cs: 'Odkaz se nepodařilo poslat — zkopírujte ho prosím.',
    en: 'The link could not be sent — please copy it instead.',
  },
  'zadost.odkazPripraveny': {
    cs: 'Odkaz je připravený — zkopírujte ho a pošlete, jak vám vyhovuje.',
    en: 'The link is ready — copy it and send it however suits you.',
  },
  'zadost.zkopirovat': { cs: 'Zkopírovat', en: 'Copy' },
  'zadost.otevritZadost': { cs: 'Otevřít žádost', en: 'Open the request' },
  'zadost.veSchrance': { cs: 'Odkaz je ve schránce.', en: 'The link is on the clipboard.' },
  'zadost.zkopirujteRucne': { cs: 'Zkopírujte odkaz ručně.', en: 'Please copy the link by hand.' },
  'zadost.zpetNaSeznam': { cs: '← Žádosti o údaje', en: '← Requests for details' },
  'zadost.vyzadal': { cs: ' · vyžádal(a) {kdo}', en: ' · requested by {kdo}' },
  'zadost.platiDo': { cs: ' · platí do {datum}', en: ' · valid until {datum}' },
  'zadost.otevritKartu': { cs: 'Otevřít kartu v portálu', en: 'Open the card in the portal' },
  'zadost.vzkazOdNej': { cs: 'Vzkaz od něj', en: 'Their note' },
  'zadost.cekaSeNaVyplneni': { cs: 'Čeká se na vyplnění', en: 'Waiting to be filled in' },
  'zadost.poslatEmailem': { cs: 'Poslat e-mailem', en: 'Send by email' },
  'zadost.odkazOdeselKratce': { cs: 'Odkaz odešel.', en: 'The link has gone out.' },
  'zadost.coSeMaZapsat': { cs: 'Co se má zapsat', en: 'What is to be written in' },
  'zadost.vyplneno': { cs: 'Vyplněno {kdy}.', en: 'Filled in {kdy}.' },
  'zadost.zaskrtnutePopis': {
    cs: 'Zaškrtnuté se zapíše do portálu, odškrtnuté zůstane, jak je.',
    en: 'Ticked items are written into the portal, unticked ones stay as they are.',
  },
  'zadost.nicSeNelisi': {
    cs: 'Nic se neliší od toho, co už v portálu je. Není co zapisovat.',
    en: 'Nothing differs from what is already in the portal. There is nothing to write in.',
  },
  'zadost.prepisuje': { cs: 'přepisuje', en: 'overwrites' },
  'zadost.tedHodnota': { cs: 'teď: {co}', en: 'now: {co}' },
  'zadost.zapisuji': { cs: 'Zapisuji…', en: 'Writing…' },
  'zadost.zapsatDoPortalu': { cs: 'Zapsat do portálu', en: 'Write into the portal' },
  'zadost.zapsano': { cs: 'Zapsáno do portálu.', en: 'Written into the portal.' },
  'zadost.nezapisovatNic': { cs: 'Nezapisovat nic', en: 'Write nothing' },
  'zadost.odlozeno': { cs: 'Odloženo — nic se nezapsalo.', en: 'Put aside — nothing was written in.' },
  'zadost.udajeJsouVPortalu': { cs: 'Údaje jsou v portálu', en: 'The details are in the portal' },
  'zadost.hotovaPopis': {
    cs: 'Odkaz už nejde použít znovu. Když bude potřeba něco doplnit, založte novou žádost.',
    en: 'The link cannot be used again. If something else is needed, create a new request.',
  },
  'zadost.zruseno': { cs: 'Zrušeno', en: 'Cancelled' },
  'zadost.odkazNeplati': { cs: 'Odkaz už neplatí.', en: 'The link is no longer valid.' },
  'zadost.odkazPrestalPlatit': { cs: 'Odkaz přestal platit.', en: 'The link has stopped working.' },
  'zadost.nepodariloSe': { cs: 'Nepodařilo se to.', en: 'It did not work.' },
  'zadost.zruseniNepodarilo': { cs: 'Zrušení se nepodařilo.', en: 'Cancelling failed.' },
  'zadost.zrusitZadost': { cs: 'Zrušit žádost', en: 'Cancel the request' },
  'zadost.opravduZrusit': { cs: 'Opravdu zrušit žádost?', en: 'Really cancel the request?' },

  /* Pole formuláře údajů (lib/pozvankaUdaju.ts). */
  'pole.name': { cs: 'Jméno a příjmení', en: 'First name and surname' },
  'pole.nameFirma': { cs: 'Název firmy', en: 'Company name' },
  'pole.birthDate': { cs: 'Datum narození', en: 'Date of birth' },
  'pole.birthNumber': { cs: 'Rodné číslo', en: 'Personal identification number' },
  'pole.phone': { cs: 'Telefon', en: 'Phone' },
  'pole.email': { cs: 'E-mail', en: 'Email' },
  'pole.addressStreet': { cs: 'Ulice a č. p.', en: 'Street and number' },
  'pole.addressCity': { cs: 'Město', en: 'Town' },
  'pole.addressZip': { cs: 'PSČ', en: 'Postcode' },
  'pole.addressCountry': { cs: 'Země', en: 'Country' },
  'pole.bankAccount': { cs: 'Číslo účtu', en: 'Account number' },
  'pole.ic': { cs: 'IČ', en: 'Company number' },
  'pole.dic': { cs: 'DIČ', en: 'VAT number' },
  'pole.vatPayer': { cs: 'Plátce DPH', en: 'VAT registered' },
  'pole.studioLocations': { cs: 'Kde může natáčet', en: 'Where they can record' },
  'pole.contactName': { cs: 'Kontaktní osoba', en: 'Contact person' },
  'pole.contactEmail': { cs: 'E-mail', en: 'Email' },
  'pole.contactPhone': { cs: 'Telefon', en: 'Phone' },

  /* Vzory zpráv klientovi. */
  'druhZprav.AUDIOKNIHA': { cs: 'Audioknihy', en: 'Audiobooks' },
  'druhZprav.REKLAMA': { cs: 'Reklamy', en: 'Adverts' },
  'vzory.poznamkaReklama': {
    cs: 'U reklam odchází jediná zpráva, a to ve stavu „Dokončeno - ke schválení". Ostatní stavy se u nich neposílají, i kdyby je firma měla zapnuté. Tohle znění dostanou firmy, které mají na kartě v „Druh zakázek" zaškrtnuté jen Reklamy.',
    en: 'For adverts a single message goes out, in the “Dokončeno - ke schválení” status. The other statuses are not sent for them, even if the company has them switched on. This wording goes to companies that have only Adverts ticked under “Kind of work” on their card.',
  },
  'vzory.predmet': { cs: 'Předmět', en: 'Subject' },
  'vzory.predmetHint': {
    cs: 'Co uvidí klient v seznamu pošty — a co se propíše do fialového pruhu v hlavičce zprávy.',
    en: 'What the customer sees in their inbox list — and what goes into the purple strip in the message header.',
  },
  'vzory.nadpis': { cs: 'Nadpis ve zprávě', en: 'Heading in the message' },
  'vzory.nadpisPlaceholder': {
    cs: 'nepovinné — prázdné znamená bez nadpisu',
    en: 'optional — empty means no heading',
  },
  'vzory.nadpisHint': {
    cs: 'Velký nadpis nad textem. Nechte prázdné a zpráva vypadá jako doteď.',
    en: 'A large heading above the text. Leave it empty and the message looks as it did before.',
  },
  'vzory.textZpravy': { cs: 'Text zprávy', en: 'Message text' },
  'vzory.pridatAudiotagger': {
    cs: 'Přidat tlačítko „Přeposlechnout v AudioTaggeru"',
    en: 'Add a “Proof-listen in AudioTagger” button',
  },
  'vzory.pridatAudiotaggerPopis': {
    cs: 'Klient si tracky pustí rovnou v prohlížeči a chyby označí v textu. Hodí se všude, kde už je co poslouchat — i když se všechny tracky odevzdávají najednou.',
    en: 'The customer plays the tracks straight in the browser and marks mistakes in the text. It is useful anywhere there is something to listen to — even when all the tracks are handed over at once.',
  },
  'vzory.ulozitVzor': { cs: 'Uložit vzor', en: 'Save the template' },
  'vzory.ulozeno': { cs: 'Uloženo', en: 'Saved' },
  'vzory.obnovitVychozi': { cs: 'Obnovit výchozí znění', en: 'Restore the default wording' },
  'vzory.opravduZahodit': { cs: 'Opravdu zahodit vlastní znění?', en: 'Really discard your own wording?' },
  'vzory.naposledyUpravil': { cs: 'Naposledy upravil(a): {kdo}', en: 'Last edited by: {kdo}' },
  'vzory.neulozeno': { cs: 'Nepodařilo se to uložit.', en: 'It could not be saved.' },
  'vzory.bezSpojeni': { cs: 'Nepodařilo se spojit se serverem.', en: 'The server could not be reached.' },
  'vzory.tucne': { cs: 'Tučně', en: 'Bold' },
  'vzory.kurziva': { cs: 'Kurzíva', en: 'Italic' },
  'vzory.podtrzeno': { cs: 'Podtrženo', en: 'Underlined' },
  'vzory.barvaTitul': { cs: 'Barva: {nazev}', en: 'Colour: {nazev}' },
  'vzory.velikostTitul': { cs: 'Velikost písma {px} px', en: 'Font size {px} px' },
  'vzory.znackaTitul': { cs: '{popis} — v ukázce „{ukazka}“', en: '{popis} — in the sample “{ukazka}”' },
  'vzory.napovedaText': {
    cs: 'Tohle je celá zpráva včetně oslovení — {osloveni} se nahradí za „Dobrý den, Radko,". Prázdný řádek oddělí odstavce. Formátování: {tucne}, {kurzivou}, {podtrzeno}, {barva}, {velikost} — nebo označte text a klepněte na tlačítko výš. Odkazy psát nemusíte, tlačítka na složku a na AudioTagger se doplní sama.',
    en: 'This is the whole message including the greeting — {osloveni} is replaced with “Dobrý den, Radko,”. A blank line separates paragraphs. Formatting: {tucne}, {kurzivou}, {podtrzeno}, {barva}, {velikost} — or select text and click a button above. You need not write links; the buttons to the folder and to AudioTagger are added automatically.',
  },
  'vzory.jakDopadne': { cs: 'Jak zpráva dopadne', en: 'How the message will look' },
  'vzory.ukazkovaData': { cs: 'ukázková data', en: 'sample data' },
  'vzory.nahledTitul': { cs: 'Náhled zprávy', en: 'Message preview' },
  'promenna.projekt': { cs: 'Název projektu', en: 'Project name' },
  'promenna.firma': { cs: 'Název firmy klienta', en: 'Customer’s company name' },
  'promenna.klient': {
    cs: 'Jméno člověka, kterému zpráva jde (oslovení)',
    en: 'Name of the person the message goes to (greeting)',
  },
  'promenna.stav': { cs: 'Stav projektu', en: 'Project status' },
  'promenna.osloveni': { cs: 'Oslovení („Dobrý den, Radko,")', en: 'Greeting (“Dobrý den, Radko,”)' },
  'barva.fialova': { cs: 'Fialová', en: 'Purple' },
  'barva.zelena': { cs: 'Zelená', en: 'Green' },
  'barva.cervena': { cs: 'Červená', en: 'Red' },
  'barva.seda': { cs: 'Šedá', en: 'Grey' },
  'velikost.13': { cs: 'Menší', en: 'Smaller' },
  'velikost.18': { cs: 'Větší', en: 'Larger' },
  'velikost.22': { cs: 'Velké', en: 'Large' },

  /* Prodleva odeslání zprávy po změně stavu. */
  'prodleva.nadpis': { cs: 'Prodleva odeslání po změně stavu', en: 'Delay before sending after a status change' },
  'prodleva.popis': {
    cs: 'Zpráva klientovi neodejde hned po přehození stavu, ale až po této době. Když se stav mezitím změní jinam (překlep, špatný projekt), zpráva k původnímu stavu neodejde vůbec. Platí pro všechny firmy. 0 = posílat hned.',
    en: 'The message to the customer does not go out the moment the status changes, but only after this long. If the status changes again in the meantime (a typo, the wrong project), the message for the original status does not go out at all. This applies to every company. 0 = send straight away.',
  },
  'prodleva.sekund': { cs: 'sekund', en: 'seconds' },
  'prodleva.rozsah': { cs: 'Zadejte celé číslo od 0 do {max}.', en: 'Enter a whole number from 0 to {max}.' },
  'prodleva.ulozeno': { cs: 'Uloženo.', en: 'Saved.' },

  /* Vzory natáčecích textů. */
  'vzoryNat.zpetDoAdmin': { cs: '← Zpět do administrace', en: '← Back to administration' },
  'vzoryNat.nadpis': { cs: 'Vzory natáčecích textů', en: 'Recording script templates' },
  'vzoryNat.uvod': {
    cs: 'Podle nich vzniká dokument, který se v záložce Výstupy uloží do složky projektu na Disku — jeden za projekt, spoty pod sebou. U každého spotu je jeho název, délka a licence a pod tím místo na text; psát se do něj bude rovnou na Disku, portál do hotového dokumentu už nesahá.',
    en: 'They are what the document built in the Deliverables tab is made from; it is saved into the project folder on Drive — one per project, with the adverts one below another. Each advert shows its name, length and licence, with room for the script underneath; it will be written in on Drive itself, the portal does not touch the finished document again.',
  },
  'vzoryNat.promenne': { cs: 'Proměnné', en: 'Variables' },
  'vzoryNat.promennePopis': {
    cs: 'Dosadí se při vyrábění dokumentu. Co v datech není, zmizí i se svou značkou — v listu zůstane prázdné místo, ne „{znacka}".',
    en: 'They are substituted when the document is built. Anything missing from the data disappears along with its marker — the sheet is left with a blank, not “{znacka}”.',
  },
  'vzoryNat.nazevVzoru': { cs: 'Název vzoru', en: 'Template name' },
  'vzoryNat.vychozi': { cs: 'Výchozí', en: 'Default' },
  'vzoryNat.uvodDokumentu': { cs: 'Úvod dokumentu', en: 'Document introduction' },
  'vzoryNat.uvodPlaceholder': {
    cs: 'Napíše se jednou nahoře. Prázdné = dokument začne rovnou prvním spotem.',
    en: 'Written once at the top. Empty = the document starts with the first advert.',
  },
  'vzoryNat.blokSpotu': { cs: 'Blok spotu', en: 'Advert block' },
  'vzoryNat.blokHint': {
    cs: 'Zopakuje se u každého výstupu. První řádek se v dokumentu vytiskne tučně jako hlavička spotu.',
    en: 'Repeated for every deliverable. The first line is printed in bold in the document as the advert’s header.',
  },
  'vzoryNat.ulozitVzor': { cs: 'Uložit vzor', en: 'Save the template' },
  'vzoryNat.ulozeno': { cs: 'Uloženo.', en: 'Saved.' },
  'vzoryNat.vyradit': { cs: 'Vyřadit', en: 'Retire' },
  'vzoryNat.pridatVzor': { cs: '+ Přidat vzor', en: '+ Add a template' },
  'vzoryNat.neulozeno': { cs: 'Vzor se nepodařilo uložit.', en: 'The template could not be saved.' },
  'vzoryNat.nevyrazeno': { cs: 'Vzor se nepodařilo vyřadit.', en: 'The template could not be retired.' },
  'promennaNat.projekt': { cs: 'Název projektu', en: 'Project name' },
  'promennaNat.klient': { cs: 'Název firmy klienta', en: 'Customer’s company name' },
  'promennaNat.upraveno': { cs: 'Datum poslední úpravy listu', en: 'Date the sheet was last edited' },
  'promennaNat.spot': { cs: 'Název výstupu (jen v bloku spotu)', en: 'Deliverable name (in the advert block only)' },
  'promennaNat.delka': {
    cs: 'Délka spotu - 30s, 2min. (jen v bloku spotu)',
    en: 'Advert length — 30s, 2min. (in the advert block only)',
  },
  'promennaNat.licence': {
    cs: 'Licence výstupu - Rádio, Online (jen v bloku spotu)',
    en: 'Deliverable licence — Radio, Online (in the advert block only)',
  },
  'promennaNat.poradi': { cs: 'Pořadové číslo spotu v dokumentu', en: 'The advert’s number in the document' },
  'promennaNat.text': {
    cs: 'Text spotu zapsaný u výstupu (jen v bloku spotu)',
    en: 'The advert script recorded on the deliverable (in the advert block only)',
  },

  /* Wikipedie. */
  'wiki.nadpis': { cs: 'Wikipedie', en: 'Wikipedia' },
  'wiki.uvod': {
    cs: 'Tady se článek o vás píše a ladí. Na Wikipedii ho vložíte sami svým účtem, portál tam nic neukládá. Až bude článek venku, doplňte jeho název dole do Hlídání a portál vám každou hodinu zvonkem ohlásí, když ho někdo upraví.',
    en: 'This is where the article about you is written and polished. You put it on Wikipedia yourself with your own account; the portal saves nothing there. Once the article is out, add its title under Watching below and the portal will ring the bell every hour when somebody edits it.',
  },
  'wiki.jakNaTo': { cs: 'Jak článek dostat na Wikipedii', en: 'How to get the article onto Wikipedia' },
  'wiki.krokUcet': {
    cs: 'Založte si účet na Wikipedii (zdarma, stačí jméno a heslo): {odkaz}. Heslo zadáváte jen tam, portál ho nikdy nevidí.',
    en: 'Create an account on Wikipedia (free, a name and a password is all it takes): {odkaz}. You type the password only there; the portal never sees it.',
  },
  'wiki.vytvoritUcet': { cs: 'vytvořit účet ↗', en: 'create an account ↗' },
  'wiki.krokStretZajmu': {
    cs: 'Na své uživatelské stránce uveďte, že píšete o sobě (střet zájmů). Wikipedie to vyžaduje a článek bez toho snadno smaže.',
    en: 'State on your user page that you are writing about yourself (conflict of interest). Wikipedia requires it and will readily delete an article without it.',
  },
  'wiki.krokZdroje': {
    cs: 'Každé tvrzení doložte nezávislým zdrojem (rozhovor, článek v médiích) - vlastní web nestačí. Pište věcně, bez hodnocení.',
    en: 'Back every claim with an independent source (an interview, a piece in the media) — your own website is not enough. Write factually, without judgement.',
  },
  'wiki.krokPiskoviste': {
    cs: 'Wikitext zkopírujte a vložte do svého {odkaz}. Odtud ho po kontrole zkušenější wikipedista přesune mezi články - o pomoc se dá požádat na diskusní stránce pískoviště.',
    en: 'Copy the wikitext and paste it into your {odkaz}. From there a more experienced Wikipedian will move it in among the articles once it has been checked — you can ask for help on the sandbox talk page.',
  },
  'wiki.piskoviste': { cs: 'pískoviště ↗', en: 'sandbox ↗' },
  'wiki.krokHlidani': {
    cs: 'Až bude článek venku, napište jeho název do Hlídání dole.',
    en: 'Once the article is out, write its title under Watching below.',
  },
  'wiki.pravidla': { cs: 'Pravidla:', en: 'Guidelines:' },
  'wiki.nazevClanku': { cs: 'Název článku', en: 'Article title' },
  'wiki.wikipedie': { cs: 'Wikipedie', en: 'Wikipedia' },
  'wiki.nahled': { cs: 'Náhled', en: 'Preview' },
  'wiki.vykresluji': { cs: 'Vykresluji…', en: 'Rendering…' },
  'wiki.kopirovatWikitext': { cs: 'Kopírovat wikitext', en: 'Copy the wikitext' },
  'wiki.zalozkaUdaje': { cs: 'Údaje o sobě', en: 'Details about you' },
  'wiki.zalozkaText': { cs: 'Wikitext', en: 'Wikitext' },
  'wiki.sestavit': { cs: 'Sestavit text z údajů', en: 'Build the text from the details' },
  'wiki.sestavitPopis': {
    cs: 'Vyplňte, co o sobě chcete mít v článku. „Sestavit text z údajů" z toho poskládá celý wikitext i s referencemi a přepíše jím záložku Wikitext — ručních úprav textu se tedy předtím zeptá.',
    en: 'Fill in what you want the article to say about you. “Build the text from the details” puts the whole wikitext together, references included, and overwrites the Wikitext tab with it — so it asks first if you have edited the text by hand.',
  },
  'wiki.prepsatPotvrzeni': {
    cs: 'Text v záložce Wikitext se přepíše textem z údajů. Pokračovat?',
    en: 'The text in the Wikitext tab will be overwritten with the text from the details. Carry on?',
  },
  'wiki.sestaveno': {
    cs: 'Text je sestavený z údajů - projděte ho a uložte.',
    en: 'The text has been built from the details — go through it and save it.',
  },
  'wiki.slov': { cs: '{pocet} slov', en: '{pocet} words' },
  'wiki.zdrojJeden': { cs: '{pocet} zdroj', en: '{pocet} source' },
  'wiki.zdrojeMalo': { cs: '{pocet} zdroje', en: '{pocet} sources' },
  'wiki.zdrojuMnoho': { cs: '{pocet} zdrojů', en: '{pocet} sources' },
  'wiki.ulozenoKdy': { cs: ' · uloženo {kdy}', en: ' · saved {kdy}' },
  'wiki.zatimNeulozeno': { cs: ' · zatím neuloženo', en: ' · not saved yet' },
  'wiki.neulozeneZmeny': { cs: ' · máte neuložené změny', en: ' · you have unsaved changes' },
  'wiki.nahledTitul': { cs: 'Náhled článku', en: 'Article preview' },
  'wiki.nahledPrazdny': {
    cs: 'Klikněte na Náhled - Wikipedie text vykreslí tak, jak by vypadal v článku (šablony, odkazy, reference).',
    en: 'Click Preview — Wikipedia renders the text as it would look in the article (templates, links, references).',
  },
  'wiki.nahledNepodaril': { cs: 'Náhled se nepodařil.', en: 'The preview failed.' },
  'wiki.hlidani': { cs: 'Hlídání článku', en: 'Watching the article' },
  'wiki.hlidaniPopis': {
    cs: 'Název stránky na Wikipedii, jak je v adrese (např. „Ondřej Černý (režisér)“). Portál ji kontroluje každou hodinu a o každé cizí úpravě vám dá vědět zvonkem. Nezapomeňte uložit.',
    en: 'The page title on Wikipedia as it appears in the address (e.g. “Ondřej Černý (režisér)”). The portal checks it every hour and rings the bell for every edit by somebody else. Do not forget to save.',
  },
  'wiki.zatimNehlidano': { cs: 'zatím nehlídáno', en: 'not watched yet' },
  'wiki.zkontrolovatTed': { cs: 'Zkontrolovat teď', en: 'Check now' },
  'wiki.otevritClanek': { cs: 'Otevřít článek ↗', en: 'Open the article ↗' },
  'wiki.posledniKontrola': {
    cs: 'Poslední automatická kontrola {kdy}',
    en: 'Last automatic check {kdy}',
  },
  'wiki.neodpovedela': { cs: 'Wikipedie neodpověděla.', en: 'Wikipedia did not answer.' },
  'wiki.strankaNeni': {
    cs: 'Stránka s tímhle názvem na Wikipedii zatím není.',
    en: 'There is no page with this title on Wikipedia yet.',
  },
  'wiki.rozdil': { cs: 'rozdíl ↗', en: 'diff ↗' },
  'wiki.odeslani': { cs: 'Odeslání na Wikipedii', en: 'Sending to Wikipedia' },
  'wiki.odeslaniPopis': {
    cs: 'Portál umí uloženou verzi konceptu zapsat na Wikipedii pod vaším účtem. Potřebuje k tomu osobní přístupový token: {odkaz} — v žádosti vyberte „This consumer is for use only by {jmeno}", jako povolení stačí úprava a zakládání stránek. Schvalovat to nikdo nemusí, token dostanete hned. Vložte ho sem; portál ho uloží a už nikdy neukáže.',
    en: 'The portal can write the saved draft onto Wikipedia under your account. It needs a personal access token for that: {odkaz} — in the request choose “This consumer is for use only by {jmeno}”, and editing and creating pages is permission enough. Nobody has to approve it, you get the token straight away. Paste it here; the portal saves it and never shows it again.',
  },
  'wiki.vytvoritToken': { cs: 'vytvořit token ↗', en: 'create a token ↗' },
  'wiki.vaseJmeno': { cs: 'vaše jméno', en: 'your name' },
  'wiki.token': { cs: 'Přístupový token', en: 'Access token' },
  'wiki.tokenUlozeny': { cs: 'uložený — vyplňte jen při výměně', en: 'saved — fill it in only when replacing it' },
  'wiki.tokenPlaceholder': { cs: 'vložte token z Wikimedie', en: 'paste the token from Wikimedia' },
  'wiki.ulozitToken': { cs: 'Uložit token', en: 'Save the token' },
  'wiki.smazatToken': { cs: 'Smazat token', en: 'Delete the token' },
  'wiki.tokenUlozen': { cs: 'Token je uložený.', en: 'The token has been saved.' },
  'wiki.tokenSmazan': { cs: 'Token je smazaný.', en: 'The token has been deleted.' },
  'wiki.tokenNeulozen': { cs: 'Token se nepodařilo uložit.', en: 'The token could not be saved.' },
  'wiki.smazatTokenPotvrzeni': {
    cs: 'Opravdu token smazat? Odesílání z portálu pak nebude fungovat.',
    en: 'Really delete the token? Sending from the portal will then stop working.',
  },
  'wiki.kamUlozit': { cs: 'Kam uložit', en: 'Where to save it' },
  'wiki.shrnutiUpravy': { cs: 'Shrnutí úpravy', en: 'Edit summary' },
  'wiki.shrnutiPlaceholder': { cs: 'doplnění zdrojů', en: 'sources added' },
  'wiki.odesilam': { cs: 'Odesílám…', en: 'Sending…' },
  'wiki.odeslat': { cs: 'Odeslat na Wikipedii', en: 'Send to Wikipedia' },
  'wiki.odeslatPotvrzeni': {
    cs: 'Uložit koncept na Wikipedii jako „{kam}"? Úprava bude veřejná a pod vaším účtem.',
    en: 'Save the draft on Wikipedia as “{kam}”? The edit will be public and under your account.',
  },
  'wiki.odeslaniNepovedlo': { cs: 'Odeslání se nepovedlo.', en: 'Sending failed.' },
  'wiki.hotovoNaWiki': { cs: 'Hotovo — text je na Wikipedii.', en: 'Done — the text is on Wikipedia.' },
  'wiki.odeslaniPoznamka': {
    cs: 'Odesílá se POSLEDNÍ ULOŽENÁ verze konceptu, takže před odesláním uložte. Úprava se na Wikipedii objeví pod vaším jménem a je veřejně dohledatelná — u článku o sobě nezapomeňte na střet zájmů.',
    en: 'It is the LAST SAVED version of the draft that is sent, so save before sending. The edit appears on Wikipedia under your name and is publicly traceable — with an article about yourself, do not forget the conflict of interest.',
  },
  'wiki.odeslaniZamceno': {
    cs: ' Máte neuložené změny, proto je odesílání zamčené.',
    en: ' You have unsaved changes, which is why sending is locked.',
  },
  'wiki.ulozenoNaWiki': { cs: 'Uloženo na Wikipedii —', en: 'Saved on Wikipedia —' },
  'wiki.otevritStranku': { cs: 'otevřít stránku ↗', en: 'open the page ↗' },
  'wiki.ulozeneVerze': { cs: 'Uložené verze', en: 'Saved versions' },
  'wiki.zadnaVerze': { cs: 'Zatím žádná - první vznikne uložením.', en: 'None yet — the first one appears when you save.' },
  'wiki.nacistDoEditoru': { cs: 'Načíst do editoru', en: 'Load into the editor' },
  'wiki.verziNeulozena': { cs: 'Verzi se nepodařilo načíst.', en: 'The version could not be loaded.' },
  'wiki.starsiVerze': {
    cs: 'Starší verze je v editoru - uložte ji, pokud ji chcete ponechat.',
    en: 'The older version is in the editor — save it if you want to keep it.',
  },
  'wiki.wikitextVeSchrance': {
    cs: 'Wikitext je ve schránce - vložte ho na Wikipedii.',
    en: 'The wikitext is on the clipboard — paste it into Wikipedia.',
  },
  'wiki.kopirovaniNepodarilo': {
    cs: 'Kopírování se nepodařilo - označte text ručně (Cmd+A, Cmd+C).',
    en: 'Copying failed — select the text by hand (Cmd+A, Cmd+C).',
  },
  'wiki.nahraditPotvrzeni': { cs: 'Nahradit celý koncept tímhle textem?', en: 'Replace the whole draft with this text?' },
  'wiki.konceptNahrazen': {
    cs: 'Koncept je nahrazený - projděte ho a uložte.',
    en: 'The draft has been replaced — go through it and save it.',
  },
  'wiki.textPridan': {
    cs: 'Text je přidaný na konec konceptu - projděte ho a uložte.',
    en: 'The text has been added to the end of the draft — go through it and save it.',
  },

  /* Wikipedie - vzpomínání (chat) a formulář údajů o sobě. */
  'wiki.vzpominani': { cs: 'Vzpomínání', en: 'Reminiscing' },
  'wiki.vzpominaniPopis': {
    cs: 'Vyprávějte, co jste zažil a na co si vzpomenete. Pomocník se doptá na podrobnosti a hlavně na zdroje, a když bude látky dost, napíše hotový kus wikitextu. Do konceptu ho vloží až vaše kliknutí.',
    en: 'Tell it what you have lived through and what you remember. The assistant will ask about the details and above all about sources, and once there is enough material it will write a finished piece of wikitext. Only your click puts it into the draft.',
  },
  'wiki.chatPrazdno': {
    cs: 'Zatím nic. Zkuste třeba: „V roce 2014 jsem začal režírovat audioknihy pro…“',
    en: 'Nothing yet. Try something like: “In 2014 I started directing audiobooks for…”',
  },
  'wiki.pise': { cs: 'Píše…', en: 'Writing…' },
  'wiki.pridatDoKonceptu': { cs: 'Přidat do konceptu', en: 'Add to the draft' },
  'wiki.nahraditKoncept': { cs: 'Nahradit koncept', en: 'Replace the draft' },
  'wiki.nejdrivUlozte': {
    cs: 'Nejdřív koncept uložte — chat se váže k němu.',
    en: 'Save the draft first — the chat is tied to it.',
  },
  'wiki.naCoVzpominate': { cs: 'Na co si vzpomínáte? (Cmd+Enter odešle)', en: 'What do you remember? (Cmd+Enter sends)' },
  'wiki.posilam': { cs: 'Posílám…', en: 'Sending…' },
  'wiki.poslat': { cs: 'Poslat', en: 'Send' },
  'wiki.odpovedNeziskana': { cs: 'Odpověď se nepodařilo získat.', en: 'No answer could be obtained.' },
  'wiki.kdoJste': { cs: 'Kdo jste', en: 'Who you are' },
  'wiki.jmeno': { cs: 'Jméno', en: 'Name' },
  'wiki.cimJste': { cs: 'Čím jste', en: 'What you are' },
  'wiki.cimJsteHint': {
    cs: 'doplní se za jméno: „… je český režisér audioknih…“',
    en: 'added after the name: “… je český režisér audioknih…”',
  },
  'wiki.datumNarozeni': { cs: 'Datum narození', en: 'Date of birth' },
  'wiki.mistoNarozeni': { cs: 'Místo narození', en: 'Place of birth' },
  'wiki.povolani': { cs: 'Povolání', en: 'Occupation' },
  'wiki.povolaniHint': { cs: 'do infoboxu, oddělujte čárkou', en: 'for the infobox, separate with commas' },
  'wiki.fotka': { cs: 'Fotka na Commons', en: 'Photo on Commons' },
  'wiki.fotkaHint': { cs: 'název souboru bez „File:“', en: 'the file name without “File:”' },
  'wiki.popisekFotky': { cs: 'Popisek fotky', en: 'Photo caption' },
  'wiki.web': { cs: 'Oficiální web', en: 'Official website' },
  'wiki.kategorie': { cs: 'Kategorie', en: 'Categories' },
  'wiki.oddelujteCarkou': { cs: 'oddělujte čárkou', en: 'separate with commas' },
  'wiki.shrnuti': { cs: 'Shrnutí (nepovinné)', en: 'Summary (optional)' },
  'wiki.shrnutiHint': {
    cs: 'Odstavec pod úvodní větu — čím se zabýváte, s kým spolupracujete.',
    en: 'A paragraph under the opening sentence — what you do, who you work with.',
  },
  'wiki.zdroje': { cs: 'Zdroje', en: 'Sources' },
  'wiki.pridatZdroj': { cs: '+ Přidat zdroj', en: '+ Add a source' },
  'wiki.zdrojePopis': {
    cs: 'Nezávislé články a rozhovory, ze kterých tvrzení pocházejí. Klíč je jen krátké jméno zdroje (např. „youradio“), kterým se pak u údajů níž vybírá.',
    en: 'Independent articles and interviews the claims come from. The key is just a short name for the source (e.g. “youradio”) used to pick it in the details below.',
  },
  'wiki.bezZdroje': { cs: 'bez zdroje', en: 'no source' },
  'wiki.klic': { cs: 'Klíč', en: 'Key' },
  'wiki.titulek': { cs: 'Titulek', en: 'Headline' },
  'wiki.kdeVyslo': { cs: 'Kde vyšlo', en: 'Where it appeared' },
  'wiki.odkaz': { cs: 'Odkaz', en: 'Link' },
  'wiki.datumVydani': { cs: 'Datum vydání', en: 'Publication date' },
  'wiki.odebrat': { cs: 'Odebrat', en: 'Remove' },
  'wiki.zivot': { cs: 'Život — co se kdy stalo', en: 'Life — what happened when' },
  'wiki.pridatMilnik': { cs: '+ Přidat milník', en: '+ Add a milestone' },
  'wiki.milnikyPopis': {
    cs: 'Z každého řádku vznikne věta: rok + co se stalo. Pište bez hodnocení, třeba „založil studio Mediaspace“.',
    en: 'Each line becomes a sentence: the year plus what happened. Write without judgement, such as “založil studio Mediaspace”.',
  },
  'wiki.rok': { cs: 'Rok', en: 'Year' },
  'wiki.coSeStalo': { cs: 'Co se stalo', en: 'What happened' },
  'wiki.zdroj': { cs: 'Zdroj', en: 'Source' },
  'wiki.tvorba': { cs: 'Tvorba', en: 'Work' },
  'wiki.pridatDilo': { cs: '+ Přidat dílo', en: '+ Add a work' },
  'wiki.nazev': { cs: 'Název', en: 'Title' },
  'wiki.vydavatel': { cs: 'Vydavatel', en: 'Publisher' },
  'wiki.poznamka': { cs: 'Poznámka', en: 'Note' },

  /* Technické parametry výroby. */
  'druhParametru.AUDIOKNIHA': { cs: 'Audioknihy', en: 'Audiobooks' },
  'druhParametru.REKLAMA': { cs: 'Reklamy', en: 'Adverts' },
  'techparam.nadpis': { cs: 'Technické parametry', en: 'Technical specifications' },
  'techparam.uvod': {
    cs: 'Jak se co natáčí a v čem se to odevzdává. Každé nakladatelství to má jinak, proto se parametry vedou jako sady přiřazené firmám — projekt si sadu vezme podle klienta sám. Změna se propíše do všech projektů té firmy naráz.',
    en: 'How things are recorded and in what they are delivered. Every publisher does it differently, so the specifications are kept as sets assigned to companies — a project picks its set by the customer on its own. A change carries into all that company’s projects at once.',
  },
  'techparam.jenKeCteni': {
    cs: 'Máte to jen ke čtení. Upravovat smí ten, kdo má na kartě zaškrtnuté {co}.',
    en: 'You have read-only access. Editing is for whoever has {co} ticked on their card.',
  },
  'techparam.spravujeParametry': { cs: 'Spravuje technické parametry', en: 'Manages technical specifications' },
  'techparam.sadJedna': { cs: '{pocet} sada', en: '{pocet} set' },
  'techparam.sadyMalo': { cs: '{pocet} sady', en: '{pocet} sets' },
  'techparam.sadMnoho': { cs: '{pocet} sad', en: '{pocet} sets' },
  'techparam.novaSada': { cs: '+ Nová sada', en: '+ New set' },
  'techparam.zadnaSada': { cs: 'Zatím tu žádná sada není.', en: 'There is no set here yet.' },
  'techparam.vychozi': { cs: 'výchozí', en: 'default' },
  'techparam.vypnuto': { cs: 'vypnuto', en: 'switched off' },
  'techparam.bezFirmy': { cs: 'Zatím bez firmy', en: 'No company yet' },
  'techparam.parametruPocet': { cs: '{pocet} parametrů', en: '{pocet} specifications' },
  'techparam.nazevSady': { cs: 'Název sady', en: 'Set name' },
  'techparam.perex': { cs: 'Poznámka do přehledu', en: 'Note for the overview' },
  'techparam.perexPlaceholder': { cs: 'Odkud to víme, od kdy platí…', en: 'Where we know it from, since when it applies…' },
  'techparam.platiProFirmy': { cs: 'Platí pro firmy:', en: 'Applies to companies:' },
  'techparam.vyberFirem': { cs: 'Firmy, které tuhle sadu dodržují', en: 'Companies that follow this set' },
  'techparam.vychoziPro': { cs: 'Výchozí pro {druh}', en: 'Default for {druh}' },
  'techparam.pouzivaSe': { cs: 'Používá se', en: 'In use' },
  'techparam.nadpisSekce': { cs: 'Nadpis sekce', en: 'Section heading' },
  'techparam.kdySeUkaze': { cs: 'Kdy se sekce ukáže', en: 'When the section shows' },
  'techparam.vzdycky': { cs: 'Vždycky', en: 'Always' },
  'techparam.jenSluzba': { cs: 'Jen: {nazev}', en: 'Only: {nazev}' },
  'techparam.jenRadio': { cs: 'jen rádiový spot', en: 'radio advert only' },
  'techparam.smazatSekci': { cs: 'Smazat sekci', en: 'Delete the section' },
  'techparam.pridatSekci': { cs: '+ Přidat sekci', en: '+ Add a section' },
  'techparam.smazatSadu': { cs: 'Smazat sadu', en: 'Delete the set' },
  'techparam.smazatSaduPotvrzeni': { cs: 'Smazat sadu „{nazev}"?', en: 'Delete the set “{nazev}”?' },
  'techparam.neulozeno': { cs: 'Uložení se nepovedlo.', en: 'Saving failed.' },
  'techparam.sadaNezalozena': { cs: 'Sadu se nepodařilo založit.', en: 'The set could not be created.' },

  /* Návody (psací strana v administraci). */
  'druhZakazky.AUDIOBOOK': { cs: 'Audioknihy', en: 'Audiobooks' },
  'druhZakazky.AD': { cs: 'Reklamy', en: 'Adverts' },
  'navod.nadpis': { cs: 'Návody', en: 'Guides' },
  'navod.uvod': {
    cs: 'Co je tu zveřejněné, najde celý tým v Nápovědě — včetně hledání v textu.',
    en: 'Whatever is published here the whole team finds in Help — full-text search included.',
  },
  'navod.zadnyNavod': { cs: 'Zatím tu žádný návod není.', en: 'There is no guide here yet.' },
  'navod.jenPro': { cs: 'jen pro: {role}', en: 'only for: {role}' },
  'navod.jenNasTym': {
    cs: 'jen náš tým - herci a klienti nevidí',
    en: 'our team only — narrators and customers do not see it',
  },
  'navod.zverejneno': { cs: 'Zveřejněno', en: 'Published' },
  'navod.rozepsane': { cs: 'Rozepsané', en: 'Draft' },
  'navod.obrazkyPoznamka': {
    cs: 'Obrázky do návodu se nahrávají do složky {slozka} a v textu se na ně odkazuje jako {odkaz}.',
    en: 'Images for a guide are uploaded into the {slozka} folder and referred to in the text as {odkaz}.',
  },
  'navod.novyNavod': { cs: '+ Nový návod', en: '+ New guide' },
  'navod.nazevNavodu': { cs: 'Název návodu', en: 'Guide name' },
  'navod.nazevPostupu': { cs: 'Název postupu', en: 'Procedure name' },
  'navod.zalozit': { cs: 'Založit', en: 'Create' },
  'navod.zakladam': { cs: 'Zakládám…', en: 'Creating…' },
  'navod.nezalozen': { cs: 'Návod se nepodařilo založit.', en: 'The guide could not be created.' },
  'navod.zpetNaNavody': { cs: '← Návody', en: '← Guides' },
  'navod.adresa': { cs: 'Adresa: {adresa}', en: 'Address: {adresa}' },
  'navod.jakToUvidiOstatni': { cs: 'Zobrazit, jak to uvidí ostatní', en: 'See how others will see it' },
  'navod.nazev': { cs: 'Název', en: 'Title' },
  'navod.kategorie': { cs: 'Kategorie', en: 'Category' },
  'navod.poradi': { cs: 'Pořadí', en: 'Order' },
  'navod.perex': { cs: 'Perex', en: 'Standfirst' },
  'navod.perexPlaceholder': {
    cs: 'Jedna věta do seznamu — o čem návod je.',
    en: 'One sentence for the list — what the guide is about.',
  },
  'navod.text': { cs: 'Text', en: 'Text' },
  'navod.textMarkdown': { cs: '(Markdown)', en: '(Markdown)' },
  'navod.nahravam': { cs: 'Nahrávám…', en: 'Uploading…' },
  'navod.pridatObrazek': { cs: '+ Obrázek', en: '+ Image' },
  'navod.obrazekNenahran': { cs: 'Obrázek se nepodařilo nahrát.', en: 'The image could not be uploaded.' },
  'navod.nahled': { cs: 'Náhled', en: 'Preview' },
  'navod.textPlaceholder': {
    cs: '## Nadpis\n\nOdstavec textu.\n\n- odrážka\n- druhá\n\n![Popis obrázku](/navody/soubor.png)',
    en: '## Heading\n\nA paragraph of text.\n\n- bullet\n- second one\n\n![Image description](/navody/file.png)',
  },
  'navod.zverejnit': { cs: 'Zveřejnit', en: 'Publish' },
  'navod.zverejnitPopis': {
    cs: 'dokud není zaškrtnuté, vidíte návod jen vy',
    en: 'until this is ticked, only you can see the guide',
  },
  'navod.komuSeUkaze': { cs: 'Komu se ukáže', en: 'Who it is shown to' },
  'navod.komuSeUkazePopis': {
    cs: 'nic nezaškrtnuto = jen náš tým (Žůžo-labůžo, Produkce, Zvukař). Herci a klienti uvidí jen návod, kde je jejich role zaškrtnutá.',
    en: 'nothing ticked = our team only (Admin, Production, Sound engineer). Narrators and customers only see a guide where their role is ticked.',
  },
  'navod.proJakeZakazky': { cs: 'Pro jaké zakázky', en: 'For which kind of work' },
  'navod.proJakeZakazkyPopis': {
    cs: 'nic nezaškrtnuto = pro obojí. Klient uvidí návod jen tehdy, když jeho firma má zaškrtnutý stejný Druh zakázek; našeho týmu se to netýká.',
    en: 'nothing ticked = for both. A customer only sees the guide if their company has the same Kind of work ticked; it does not apply to our team.',
  },
  'navod.ulozitNavod': { cs: 'Uložit návod', en: 'Save the guide' },
  'navod.ulozeno': { cs: 'Uloženo.', en: 'Saved.' },
  'navod.neulozeno': { cs: 'Uložení se nepodařilo.', en: 'Saving failed.' },
  'navod.nesmazano': { cs: 'Smazání se nepodařilo.', en: 'The deletion failed.' },

  /* Přenos projektů z Caflou. */
  'prenos.zpetDoAdmin': { cs: '← Zpět do administrace', en: '← Back to administration' },
  'prenos.nadpis': { cs: 'Přenos projektů z Caflou', en: 'Transfer of projects from Caflou' },
  'prenos.uvod': {
    cs: 'Stáhne z Caflou všechny projekty i s názvem, firmou, stavem, prioritou, normostranami, hercem, datem vydání a popisem a uloží je do portálu. Dá se pustit opakovaně — údaje zadané v portálu (manažer, odkaz na složku, rodný list) se nepřepisují a projektů založených přímo v portálu se přenos nedotkne.',
    en: 'It downloads every project from Caflou with its name, company, status, priority, standard pages, narrator, release date and description and saves them into the portal. It can be run again and again — details entered in the portal (manager, folder link, advert record) are not overwritten and projects created in the portal itself are left alone.',
  },
  'prenos.prenasim': { cs: 'Přenáším…', en: 'Transferring…' },
  'prenos.prenestProjekty': { cs: 'Přenést projekty z Caflou', en: 'Transfer the projects from Caflou' },
  'prenos.trvaToChvili': {
    cs: 'Sedm stovek projektů po stovkách — může to trvat i minutu, nezavírejte stránku.',
    en: 'Seven hundred projects, a hundred at a time — it can take a minute, do not close the page.',
  },
  'prenos.nepodaril': { cs: 'Přenos se nepodařil.', en: 'The transfer failed.' },
  'prenos.nepodarilZnovu': {
    cs: 'Přenos se nepodařil — zkuste to prosím znovu.',
    en: 'The transfer failed — please try again.',
  },
  'prenos.coPortalDrzi': { cs: 'Co portál drží', en: 'What the portal holds' },
  'prenos.projektuCelkem': { cs: 'Projektů celkem', en: 'Projects in total' },
  'prenos.zTohoZCaflou': { cs: 'Z toho z Caflou', en: 'Of those from Caflou' },
  'prenos.zalozenoVPortalu': { cs: 'Založeno v portálu', en: 'Created in the portal' },
  'prenos.rozpracovanych': { cs: 'Rozpracovaných', en: 'In progress' },
  'prenos.bezNazvu': { cs: 'Bez názvu', en: 'Without a name' },
  'prenos.posledniPrenos': { cs: 'Poslední přenos', en: 'Last transfer' },
  'prenos.prectenoZCaflou': { cs: 'Přečteno z Caflou', en: 'Read from Caflou' },
  'prenos.noveZalozeno': { cs: 'Nově založeno', en: 'Newly created' },
  'prenos.doplneno': { cs: 'Doplněno', en: 'Filled in' },
  'prenos.preskoceno': { cs: 'Přeskočeno', en: 'Skipped' },
  'prenos.bezFirmy': {
    cs: 'U těchto projektů se nepodařilo dohledat firmu v portálu — název firmy se uložil textem, ale projekt nebude vidět v přehledu klienta:',
    en: 'The company could not be found in the portal for these projects — the company name was saved as text, but the project will not show in the customer’s overview:',
  },

  /* ---------------------------------------------------------------
   * DÁVKA 7d - Přehledy, palubovka, backlog, ceník studia, Web,
   * tabule, správa studia, veřejné formuláře, nápověda, honoráře,
   * pozvánky.
   * ------------------------------------------------------------- */

  /* Přehledy - hlavička, záložky a společné formátování. */
  'prehledy.nadpis': { cs: 'Přehledy', en: 'Reports' },
  'prehledy.zalozka./prehledy/palubovka': { cs: 'Palubovka', en: 'Dashboard' },
  'prehledy.zalozka./prehledy/kapacita': { cs: 'Kapacita studií', en: 'Studio capacity' },
  'prehledy.zalozka./prehledy/backlog': { cs: 'Backlog', en: 'Backlog' },
  'prehledy.zalozka./prehledy/finance': { cs: 'Obrat a zisk', en: 'Turnover and profit' },
  'prehledy.zalozka./prehledy/knihy': { cs: 'Knihy a rozpočty', en: 'Books and budgets' },
  'prehledy.zalozka./prehledy/zvukari': { cs: 'Zvukaři', en: 'Sound engineers' },
  'format.milionu': { cs: 'mil.', en: 'm' },
  'format.tisic': { cs: 'tis.', en: 'k' },

  /* Obrat a zisk. */
  'finance.obdobi': { cs: 'Období', en: 'Period' },
  'finance.poslednich12': { cs: 'Posledních 12 měsíců', en: 'Last 12 months' },
  'finance.rok': { cs: 'Rok {rok}', en: 'Year {rok}' },
  'finance.firma': { cs: 'Firma', en: 'Company' },
  'finance.vsechnyFirmy': { cs: 'Všechny firmy', en: 'All companies' },
  'finance.vystaveno': { cs: 'Vystaveno', en: 'Issued' },
  'finance.vystavenoTitle': {
    cs: 'Faktury a výdaje podle data dokladu',
    en: 'Invoices and expenses by document date',
  },
  'finance.uhrazeno': { cs: 'Uhrazeno', en: 'Paid' },
  'finance.uhrazenoTitle': {
    cs: 'Jen peníze, které opravdu přišly a odešly',
    en: 'Only the money that actually came in and went out',
  },
  'finance.mesice': { cs: 'Měsíce', en: 'Months' },
  'finance.ctvrtleti': { cs: 'Čtvrtletí', en: 'Quarters' },
  'finance.obrat': { cs: 'Obrat', en: 'Turnover' },
  'finance.naklady': { cs: 'Náklady', en: 'Costs' },
  'finance.zisk': { cs: 'Zisk', en: 'Profit' },
  'finance.marze': { cs: 'Marže', en: 'Margin' },
  'finance.ziskZObratu': { cs: 'zisk z obratu', en: 'profit out of turnover' },
  'finance.predchozich12': { cs: 'předchozích 12 měsíců', en: 'the previous 12 months' },
  'finance.predchoziRok': { cs: 'rok {rok}', en: 'year {rok}' },
  'finance.protiMinule': { cs: 'proti {popis}', en: 'against {popis}' },
  'finance.bezDat': { cs: 'za {popis} bez dat', en: 'no data for {popis}' },
  'finance.pocetFaktur.jedna': { cs: '{pocet} faktura', en: '{pocet} invoice' },
  'finance.pocetFaktur.nekolik': { cs: '{pocet} faktury', en: '{pocet} invoices' },
  'finance.pocetFaktur.mnoho': { cs: '{pocet} faktur', en: '{pocet} invoices' },
  'finance.pocetVydaju.jedna': { cs: '{pocet} výdaj', en: '{pocet} expense' },
  'finance.pocetVydaju.nekolik': { cs: '{pocet} výdaje', en: '{pocet} expenses' },
  'finance.pocetVydaju.mnoho': { cs: '{pocet} výdajů', en: '{pocet} expenses' },
  'finance.nicTu': {
    cs: 'Za vybrané období tu nejsou žádné faktury ani výdaje.',
    en: 'There are no invoices or expenses for the selected period.',
  },
  'finance.grafNadpis.mesic': {
    cs: 'Obrat, náklady a zisk po měsících',
    en: 'Turnover, costs and profit by month',
  },
  'finance.grafNadpis.ctvrtleti': {
    cs: 'Obrat, náklady a zisk po čtvrtletích',
    en: 'Turnover, costs and profit by quarter',
  },
  'finance.dph': { cs: 'DPH', en: 'VAT' },
  'finance.dphPodleVystaveni': {
    cs: 'podle data zdanitelného plnění — tedy tak, jak se podává přiznání',
    en: 'by tax point date — that is, the way the return is filed',
  },
  'finance.dphPodleUhrady': {
    cs: 'podle data úhrady — přiznání se ale podává podle data zdanitelného plnění, přepněte nahoře na Vystaveno',
    en: 'by payment date — the return, however, is filed by tax point date, so switch to Issued above',
  },
  'finance.dphNaVystupu': { cs: 'Na výstupu', en: 'Output' },
  'finance.dphNaVystupuPopis': { cs: 'daň z vydaných faktur', en: 'tax on invoices issued' },
  'finance.dphNaVstupu': { cs: 'Na vstupu', en: 'Input' },
  'finance.dphNaVstupuPopis': {
    cs: 'daň z výdajů, kterou si odečítáme',
    en: 'tax on expenses that we reclaim',
  },
  'finance.dphNadmernyOdpocet': { cs: 'Nadměrný odpočet', en: 'Repayment due' },
  'finance.dphKOdvedeni': { cs: 'K odvedení', en: 'Payable' },
  'finance.dphZpatkyOdStatu': { cs: 'vyjde zpátky od státu', en: 'comes back from the state' },
  'finance.dphRozdil': { cs: 'na výstupu minus na vstupu', en: 'output less input' },
  'finance.mesic': { cs: 'Měsíc', en: 'Month' },
  'finance.ctvrtletiSloupec': { cs: 'Čtvrtletí', en: 'Quarter' },
  'finance.dphPoznamka': {
    cs: 'Je to ukazatel, ne přiznání: portál nezná přenesenou daňovou povinnost, OSS ani krácený odpočet a počítá ze všech zařazených dokladů. Čísla berte jako to, co zhruba čekat, ne jako podklad k odeslání.',
    en: 'This is an indicator, not a return: the portal knows nothing of reverse charge, OSS or partial deduction and counts every document filed. Treat the figures as roughly what to expect, not as something to submit.',
  },
  'finance.obratPodleKlientu': { cs: 'Obrat podle klientů', en: 'Turnover by customer' },
  'finance.nakladyPodleKategorii': { cs: 'Náklady podle kategorií', en: 'Costs by category' },
  'finance.projekty': { cs: 'Projekty', en: 'Projects' },
  'finance.projekt': { cs: 'Projekt', en: 'Project' },
  'finance.zobrazeno15': {
    cs: 'Zobrazeno 15 projektů s největším obratem z {celkem}.',
    en: 'Showing the 15 projects with the highest turnover out of {celkem}.',
  },
  'finance.poznamkaVystaveno': {
    cs: 'Obrat = odeslané a uhrazené faktury podle data zdanitelného plnění; náklady = zařazené výdaje podle data dokladu.',
    en: 'Turnover = invoices sent and paid by tax point date; costs = filed expenses by document date.',
  },
  'finance.poznamkaUhrazeno': {
    cs: 'Jen uhrazené faktury a výdaje podle data úhrady - peníze, které opravdu přišly a odešly.',
    en: 'Only paid invoices and expenses by payment date — the money that actually came in and went out.',
  },
  'finance.poznamkaMena': {
    cs: 'Vše bez DPH, v korunách (cizí měny kurzem ČNB ze dne dokladu).',
    en: 'All excluding VAT, in Czech koruna (foreign currencies at the Czech National Bank rate on the document date).',
  },
  'finance.zobrazitGraf': { cs: 'Zobrazit graf', en: 'Show the chart' },
  'finance.zobrazitTabulku': { cs: 'Zobrazit tabulku', en: 'Show the table' },
  'finance.nicZaObdobi': { cs: 'Nic za vybrané období.', en: 'Nothing for the selected period.' },
  'finance.ostatni': { cs: 'Ostatní ({pocet})', en: 'Other ({pocet})' },

  /* Backlog. */
  'backlog.uvod': {
    cs: 'Kdy měl být projekt hotový a kdy se opravdu odevzdal. Za odevzdání se bere okamžik, kdy projekt poprvé přešel do stavu „Dokončeno - ke schválení". Kladné číslo jsou dny k dobru, záporné dny skluzu — stejně jako u data v přehledu projektů.',
    en: 'When the project was due and when it was actually delivered. Delivery is taken as the moment the project first moved to the status „Dokončeno - ke schválení". A positive number is days to spare, a negative one days of delay — just as with the date in the project overview.',
  },

  /* Měsíce a dny v týdnu - obecné, bere je kapacita studií i analýzy.
   * Schválně ve slovníku a ne přes Intl: česky dává Intl „ledna" (2. pád)
   * podle verze ICU, a nadpis „leden 2026" musí stát v 1. pádě. */
  'obecne.mesic.1': { cs: 'leden', en: 'January' },
  'obecne.mesic.2': { cs: 'únor', en: 'February' },
  'obecne.mesic.3': { cs: 'březen', en: 'March' },
  'obecne.mesic.4': { cs: 'duben', en: 'April' },
  'obecne.mesic.5': { cs: 'květen', en: 'May' },
  'obecne.mesic.6': { cs: 'červen', en: 'June' },
  'obecne.mesic.7': { cs: 'červenec', en: 'July' },
  'obecne.mesic.8': { cs: 'srpen', en: 'August' },
  'obecne.mesic.9': { cs: 'září', en: 'September' },
  'obecne.mesic.10': { cs: 'říjen', en: 'October' },
  'obecne.mesic.11': { cs: 'listopad', en: 'November' },
  'obecne.mesic.12': { cs: 'prosinec', en: 'December' },
  'obecne.mesicKratce.1': { cs: 'led', en: 'Jan' },
  'obecne.mesicKratce.2': { cs: 'úno', en: 'Feb' },
  'obecne.mesicKratce.3': { cs: 'bře', en: 'Mar' },
  'obecne.mesicKratce.4': { cs: 'dub', en: 'Apr' },
  'obecne.mesicKratce.5': { cs: 'kvě', en: 'May' },
  'obecne.mesicKratce.6': { cs: 'čvn', en: 'Jun' },
  'obecne.mesicKratce.7': { cs: 'čvc', en: 'Jul' },
  'obecne.mesicKratce.8': { cs: 'srp', en: 'Aug' },
  'obecne.mesicKratce.9': { cs: 'zář', en: 'Sep' },
  'obecne.mesicKratce.10': { cs: 'říj', en: 'Oct' },
  'obecne.mesicKratce.11': { cs: 'lis', en: 'Nov' },
  'obecne.mesicKratce.12': { cs: 'pro', en: 'Dec' },
  'obecne.den.0': { cs: 'neděle', en: 'Sunday' },
  'obecne.den.1': { cs: 'pondělí', en: 'Monday' },
  'obecne.den.2': { cs: 'úterý', en: 'Tuesday' },
  'obecne.den.3': { cs: 'středa', en: 'Wednesday' },
  'obecne.den.4': { cs: 'čtvrtek', en: 'Thursday' },
  'obecne.den.5': { cs: 'pátek', en: 'Friday' },
  'obecne.den.6': { cs: 'sobota', en: 'Saturday' },
  'obecne.denKratce.0': { cs: 'ne', en: 'Sun' },
  'obecne.denKratce.1': { cs: 'po', en: 'Mon' },
  'obecne.denKratce.2': { cs: 'út', en: 'Tue' },
  'obecne.denKratce.3': { cs: 'st', en: 'Wed' },
  'obecne.denKratce.4': { cs: 'čt', en: 'Thu' },
  'obecne.denKratce.5': { cs: 'pá', en: 'Fri' },
  'obecne.denKratce.6': { cs: 'so', en: 'Sat' },

  /* Kapacita studií. */
  'kapacita.uvodPredTucnym': {
    cs: 'Celý měsíc na jedné obrazovce: řádek je den, sloupec studio. Čím tmavší obdélníček, tím víc {tucne} proti otevírací době studia — prázdné místo je díra. Střih, casting ani blokace se nepočítají; hodiny ukáže najetí myší.',
    en: 'A whole month on one screen: a row is a day, a column a studio. The darker the block, the more {tucne} against the studio’s opening hours — an empty space is a gap. Editing, casting and holds do not count; hovering shows the hours.',
  },
  'kapacita.natacenia': { cs: 'natáčení', en: 'recording' },
  'kapacita.mesicRok': { cs: '{mesic} {rok}', en: '{mesic} {rok}' },
  'kapacita.bublinaMesice': {
    cs: '{mesic} {rok}: {hodin} h natáčení',
    en: '{mesic} {rok}: {hodin} h of recording',
  },
  'kapacita.obsazenost': {
    cs: 'obsazenost {procenta} · {natoceno} z {kapacita} h',
    en: 'occupancy {procenta} · {natoceno} of {kapacita} h',
  },
  'kapacita.dnu': { cs: '{pocet} dnů', en: '{pocet} days' },
  'kapacita.bublinaBunky': {
    cs: '{den} {cislo}. {mesic} · {studio} {okno}: {stav}',
    en: '{den} {cislo} {mesic} · {studio} {okno}: {stav}',
  },
  'kapacita.stavNatoceno': { cs: '{hodin} h natáčení ({pocet}×)', en: '{hodin} h of recording ({pocet}×)' },
  'kapacita.stavNatocenoMimo': {
    cs: '{hodin} h natáčení ({pocet}×), mimo otevírací dobu',
    en: '{hodin} h of recording ({pocet}×), outside opening hours',
  },
  'kapacita.stavVolno': { cs: 'volno', en: 'free' },
  'kapacita.stavZavreno': { cs: 'zavřeno / jen po domluvě', en: 'closed / by arrangement only' },
  'kapacita.zaplnenostDne': { cs: 'Zaplněnost dne:', en: 'How full the day is:' },
  'kapacita.legendaVolno': { cs: 'volno', en: 'free' },
  'kapacita.legendaDo20': { cs: 'do 20 %', en: 'up to 20%' },
  'kapacita.legendaDo45': { cs: 'do 45 %', en: 'up to 45%' },
  'kapacita.legendaDo70': { cs: 'do 70 %', en: 'up to 70%' },
  'kapacita.legendaDo95': { cs: 'do 95 %', en: 'up to 95%' },
  'kapacita.legendaPlno': { cs: 'plno', en: 'full' },
  'kapacita.poznamkaKapacity': {
    cs: 'Kapacita je otevírací doba studia (Administrace → Studia). Dny „jen po domluvě" (obvykle víkendy) kapacitu nemají — natáčení v nich je vidět, ale do procent se nepočítá, proto může měsíc přesáhnout 100 %.',
    en: 'Capacity is the studio’s opening hours (Administration → Studios). Days marked „by arrangement only" (usually weekends) have no capacity — recording on them is visible but does not count towards the percentage, which is why a month can go over 100%.',
  },

  /* Analýzy roku pod mřížkou kapacity. */
  'analyzy.nadpis': { cs: 'Analýzy roku {rok}', en: 'Analysis for {rok}' },
  'analyzy.stahnoutCsv': { cs: 'Stáhnout data (CSV)', en: 'Download the data (CSV)' },
  'analyzy.bezDat': {
    cs: 'V roce {rok} zatím není žádné natáčení, ze kterého by se dalo počítat.',
    en: 'There is no recording in {rok} yet to calculate from.',
  },
  'analyzy.poMesicich': { cs: 'Obsazenost po měsících', en: 'Occupancy by month' },
  'analyzy.nejvic': { cs: 'nejvíc {mesic} ({procenta} %)', en: 'highest in {mesic} ({procenta}%)' },
  'analyzy.nejmin': { cs: 'nejmíň {mesic} ({procenta} %)', en: 'lowest in {mesic} ({procenta}%)' },
  'analyzy.bublinaMesice': { cs: '{studio} · {mesic}: {stav} ({hodin} h)', en: '{studio} · {mesic}: {stav} ({hodin} h)' },
  'analyzy.zavreno': { cs: 'zavřeno', en: 'closed' },
  'analyzy.podleDne': { cs: 'Podle dne v týdnu', en: 'By day of the week' },
  'analyzy.poznamkaDny': {
    cs: 'Průměr za celý rok přes všechna studia. Víkendy mají kapacitu jen po domluvě, takže u nich procenta vycházejí z natočeného času.',
    en: 'An average across the whole year and all studios. Weekends only have capacity by arrangement, so their percentages are based on the time actually recorded.',
  },
  'analyzy.frekvence': { cs: 'Ranní a odpolední frekvence', en: 'Morning and afternoon sessions' },
  'analyzy.poznamkaFrekvence': {
    cs: 'Kolik z okna frekvence se za rok opravdu točilo. Když je jedno okno výrazně slabší, je kde brát.',
    en: 'How much of each session slot was actually recorded over the year. When one slot is clearly weaker, there is room to take.',
  },
  'analyzy.otevreneDny': { cs: 'Otevřené dny ve studiích', en: 'Open days in the studios' },
  'analyzy.plno': { cs: 'plno (od 95 %)', en: 'full (95% and over)' },
  'analyzy.castecne': { cs: 'částečně obsazeno', en: 'partly booked' },
  'analyzy.volno': { cs: 'volno', en: 'free' },
  'analyzy.bublinaVyuziti': {
    cs: '{popis}: {pocet} dnů ({procenta} %)',
    en: '{popis}: {pocet} days ({procenta}%)',
  },
  'analyzy.dnuProcenta': { cs: '{pocet} dnů ({procenta} %)', en: '{pocet} days ({procenta}%)' },
  'analyzy.poznamkaVyuziti': {
    cs: 'Počítá se den × studio, jen dny s otevírací dobou — {celkem} dnů za rok {rok}.',
    en: 'Counted as day × studio, only days with opening hours — {celkem} days in {rok}.',
  },

  /* Knihy a rozpočty - ukazatele, režim porady a podrobný rozpad. */
  'knihy.vsechnaUzavrena': { cs: 'Všechna uzavřená', en: 'All closed' },
  'knihy.pocetKnih.jedna': { cs: '{pocet} kniha', en: '{pocet} book' },
  'knihy.pocetKnih.nekolik': { cs: '{pocet} knihy', en: '{pocet} books' },
  'knihy.pocetKnih.mnoho': { cs: '{pocet} knih', en: '{pocet} books' },
  'knihy.presRozpocet': { cs: 'Přes rozpočet', en: 'Over budget' },
  'knihy.naHrane': { cs: 'Na hraně', en: 'On the edge' },
  'knihy.vRozpoctu': { cs: 'V rozpočtu', en: 'Within budget' },
  'knihy.zatimNeniCoMerit': { cs: 'Zatím není co měřit', en: 'Nothing to measure yet' },
  'knihy.vesliJsmeSeHodin': {
    cs: 'Vešli jsme se do rozpočtů, zbylo {kolik}',
    en: 'We stayed within the budgets, {kolik} left',
  },
  'knihy.presRozpoctyO': { cs: 'Přes rozpočty o {kolik} celkem', en: 'Over the budgets by {kolik} in total' },
  'knihy.souctetVse': {
    cs: 'Součet za všechna uzavřená - měsíční cíl se na něj nevztahuje',
    en: 'The total across all closed books — the monthly target does not apply to it',
  },
  'knihy.cilSplneny': { cs: 'Cíl {cil} je splněný', en: 'The target of {cil} has been met' },
  'knihy.chybiPriPrumeru': {
    cs: 'Chybí {chybi}, při dosavadním průměru {knih}',
    en: '{chybi} short, which is {knih} at the average so far',
  },
  'knihy.chybiDoCile': { cs: 'Chybí {chybi} do cíle {cil}', en: '{chybi} short of the {cil} target' },
  'knihy.cilNeulozen': { cs: 'Cíl se nepodařilo uložit.', en: 'The target could not be saved.' },
  'knihy.technickaPorada': { cs: 'Technická porada', en: 'Technical meeting' },
  'knihy.programPorady': {
    cs: 'Program porady · {hotovo} z {celkem} probráno',
    en: 'Meeting agenda · {hotovo} of {celkem} covered',
  },
  'knihy.rozpoctyProjektu': { cs: 'Rozpočty projektů', en: 'Project budgets' },
  'knihy.budikPreteceni': { cs: 'Přetečení rozpočtů audioknih', en: 'Audiobook budget overruns' },
  'knihy.presRozpocetZKnih': {
    cs: '{prekrocenych} z {knih} knih přes rozpočet · {vycerpano} z {rozpocet}',
    en: '{prekrocenych} of {knih} books over budget · {vycerpano} of {rozpocet}',
  },
  'knihy.budikZisk': {
    cs: 'Čistý zisk z uzavřených knih · {obdobi}',
    en: 'Net profit from closed books · {obdobi}',
  },
  'knihy.uzavrenoCil': {
    cs: '{knih} uzavřeno · cíl {cil} bez DPH',
    en: '{knih} closed · target {cil} excluding VAT',
  },
  'knihy.tentoMesic': { cs: 'Tento měsíc', en: 'This month' },
  'knihy.minulyMesic': { cs: 'Minulý měsíc', en: 'Last month' },
  'knihy.vsechno': { cs: 'Všechno', en: 'Everything' },
  'knihy.minulyMesicKnih': { cs: 'Minulý měsíc ({obdobi}): {knih}', en: 'Last month ({obdobi}): {knih}' },
  'knihy.cistyZisk': { cs: ', čistý zisk', en: ', net profit' },
  'knihy.proPoraduTitle': {
    cs: 'Přehled pro zvukařskou poradu - bez cen a zisku',
    en: 'A view for the sound engineers’ meeting — without prices or profit',
  },
  'knihy.zpetKPrehledu': { cs: 'Zpět k celému přehledu', en: 'Back to the full report' },
  'knihy.proPoradu': { cs: 'Pro poradu', en: 'For the meeting' },
  'knihy.rezieAPoznamky': { cs: 'Režie a poznámky →', en: 'Running order and notes →' },
  'knihy.zpetZCeleObrazovky': { cs: 'Zpět z celé obrazovky', en: 'Leave full screen' },
  'knihy.naCelouObrazovku': { cs: 'Na celou obrazovku', en: 'Go full screen' },
  'knihy.zpetZCeleObrazovkyEsc': { cs: 'Zpět z celé obrazovky (Esc)', en: 'Leave full screen (Esc)' },
  'knihy.zavrit': { cs: 'Zavřít', en: 'Close' },
  'knihy.zmenitCil': { cs: 'Změnit cíl zisku', en: 'Change the profit target' },
  'knihy.podrobnyRozpad': { cs: 'Podrobný rozpad →', en: 'Detailed breakdown →' },
  'knihy.cilPopisek': {
    cs: 'Čistý zisk z uzavřených knih za měsíc (Kč bez DPH)',
    en: 'Net profit from closed books per month (CZK excluding VAT)',
  },
  'knihy.ukladam': { cs: 'Ukládám…', en: 'Saving…' },
  'knihy.ulozit': { cs: 'Uložit', en: 'Save' },
  'knihy.knihyUzavrene': { cs: 'Knihy uzavřené · {obdobi}', en: 'Books closed · {obdobi}' },
  'knihy.zadnaKniha': {
    cs: 'V tomhle období se neuzavřela žádná kniha.',
    en: 'No book was closed in this period.',
  },
  'knihy.poznamkaPruhu': {
    cs: 'Pruh ukazuje, na kolika procentech rozpočtu kniha stojí. Kliknutím se vysune, na čem přetekla a kdo na ní dělal.',
    en: 'The bar shows what percentage of the budget the book stands at. Clicking slides out what it overran on and who worked on it.',
  },
  'knihy.poznamkaPorady': {
    cs: 'V režimu porady jsou vidět jen hodiny - žádné ceny, mzdy ani zisk.',
    en: 'In meeting mode only the hours are shown — no prices, pay or profit.',
  },
  'knihy.uzavreno': { cs: 'uzavřeno {datum}', en: 'closed {datum}' },
  'knihy.normostran': { cs: '{pocet} NS', en: '{pocet} SP' },
  'knihy.procentRozpoctu': { cs: '{procenta} % rozpočtu', en: '{procenta}% of the budget' },
  'knihy.zisk': { cs: 'zisk', en: 'profit' },
  'knihy.rozpocet': { cs: 'Rozpočet', en: 'Budget' },
  'knihy.odpracovano': { cs: 'Odpracováno', en: 'Worked' },
  'knihy.vycerpano': { cs: 'Vyčerpáno', en: 'Spent' },
  'knihy.trzba': { cs: 'Tržba', en: 'Revenue' },
  'knihy.neschvalenaNabidka': { cs: 'zatím neschválená nabídka', en: 'quote not approved yet' },
  'knihy.zeSchvalene': { cs: 'ze schválené nabídky', en: 'from the approved quote' },
  'knihy.naklady': { cs: 'Náklady', en: 'Costs' },
  'knihy.vykazyVydaje': { cs: 'výkazy + výdaje', en: 'timesheets + expenses' },
  'knihy.naCemPreteklo': { cs: 'Na čem to přeteklo', en: 'What it overran on' },
  'knihy.druhPrace': { cs: 'Druh práce', en: 'Type of work' },
  'knihy.rozdil': { cs: 'Rozdíl', en: 'Difference' },
  'knihy.mzdy': { cs: 'Mzdy', en: 'Pay' },
  'knihy.mzda': { cs: 'Mzda', en: 'Pay' },
  'knihy.nataceni': { cs: 'Natáčení', en: 'Recording' },
  'knihy.strih': { cs: 'Střih', en: 'Editing' },
  'knihy.opravy': { cs: 'Opravy', en: 'Repairs' },
  'knihy.ostatni': { cs: 'Ostatní', en: 'Other' },
  'knihy.kdoNaTomDelal': { cs: 'Kdo na tom dělal', en: 'Who worked on it' },
  'knihy.nikdoNevykazal': {
    cs: 'Na téhle knize zatím nikdo nic nevykázal.',
    en: 'Nobody has reported anything on this book yet.',
  },
  'knihy.kdo': { cs: 'Kdo', en: 'Who' },
  'knihy.otevritProjekt': { cs: 'Otevřít projekt →', en: 'Open the project →' },
  'knihy.celkem': { cs: 'Celkem', en: 'Total' },
  'knihy.mesic': { cs: 'Měsíc', en: 'Month' },
  'knihy.obdobi': { cs: 'Období', en: 'Period' },
  'knihy.posledni3': { cs: 'Poslední 3 měsíce', en: 'Last 3 months' },
  'knihy.poslednich12': { cs: 'Posledních 12 měsíců', en: 'Last 12 months' },
  'knihy.rok': { cs: 'Rok {rok}', en: 'Year {rok}' },
  'knihy.vlastniRozsah': { cs: 'Vlastní rozsah…', en: 'Custom range…' },
  'knihy.od': { cs: 'Od', en: 'From' },
  'knihy.do': { cs: 'Do', en: 'To' },
  'knihy.kdoNaTomDelalFiltr': { cs: 'Kdo na tom dělal', en: 'Who worked on it' },
  'knihy.vsichniLide': { cs: 'Všichni lidé', en: 'Everybody' },
  'knihy.druhPraceFiltr': { cs: 'Druh práce', en: 'Type of work' },
  'knihy.vsechnyDruhy': { cs: 'Všechny druhy', en: 'All types' },
  'knihy.zrusitFiltr': { cs: 'Zrušit filtr', en: 'Clear the filter' },

  /* Druhy práce - podle KÓDU (nazevDruhuPrace v lib/timesheets.ts). */
  'druhPrace.RECORDING': { cs: 'Natáčení', en: 'Recording' },
  'druhPrace.EDITING': { cs: 'Střih', en: 'Editing' },
  'druhPrace.REPAIRS': { cs: 'Opravy', en: 'Repairs' },
  'druhPrace.OTHER': { cs: 'Ostatní', en: 'Other' },

  /* Podrobný rozpad knih. */
  'rozpad.zpetNaUkazatele': { cs: '← Zpět na ukazatele', en: '← Back to the indicators' },
  'rozpad.obdobi': { cs: 'Období {od} – {do}', en: 'Period {od} – {do}' },
  'rozpad.jenClovek': { cs: ' · jen {jmeno}', en: ' · {jmeno} only' },
  'rozpad.jenDruh': { cs: ' · jen {druh}', en: ' · {druh} only' },
  'rozpad.mzdoveNaklady': { cs: 'Mzdové náklady', en: 'Pay costs' },
  'rozpad.pocetVykazu.jedna': { cs: '{pocet} výkaz', en: '{pocet} timesheet' },
  'rozpad.pocetVykazu.nekolik': { cs: '{pocet} výkazy', en: '{pocet} timesheets' },
  'rozpad.pocetVykazu.mnoho': { cs: '{pocet} výkazů', en: '{pocet} timesheets' },
  'rozpad.odpracovano': { cs: 'Odpracováno', en: 'Worked' },
  'rozpad.lidi': { cs: '{pocet} lidí', en: '{pocet} people' },
  'rozpad.nataceniStrih': { cs: 'Natáčení / střih', en: 'Recording / editing' },
  'rozpad.odevzdaneKnihy': { cs: 'Odevzdané knihy', en: 'Books delivered' },
  'rozpad.zaObdobiZadna': { cs: 'za období žádná', en: 'none in the period' },
  'rozpad.mzdyPoMesicich': { cs: 'Mzdové náklady po měsících', en: 'Pay costs by month' },
  'rozpad.knihyPoMesicich': { cs: 'Odevzdané knihy po měsících', en: 'Books delivered by month' },
  'rozpad.coSeOdevzdalo': { cs: 'Co se odevzdalo', en: 'What was delivered' },
  'rozpad.zadnaKniha': {
    cs: 'Za vybrané období se neodevzdala žádná kniha.',
    en: 'No book was delivered in the selected period.',
  },
  'rozpad.mesicKnih': { cs: '{mesic} · {knih}', en: '{mesic} · {knih}' },
  'rozpad.poznamkaOdhadu': {
    cs: '* Datum z pole Termín dokončení - kniha se odevzdala dřív, než portál vedl historii projektů.',
    en: '* The date comes from the Due date field — the book was delivered before the portal kept project history.',
  },
  'rozpad.kdoNaTomDelal': { cs: 'Kdo na tom dělal', en: 'Who worked on it' },
  'rozpad.nikdoNevykazal': {
    cs: 'Za vybrané období nikdo nic nevykázal.',
    en: 'Nobody reported anything in the selected period.',
  },
  'rozpad.clovek': { cs: 'Člověk', en: 'Person' },
  'rozpad.hodin': { cs: 'Hodin', en: 'Hours' },
  'rozpad.projektu': { cs: 'Projektů', en: 'Projects' },
  'rozpad.poznamkaJmena': {
    cs: 'Kliknutím na jméno se přehled i výkazy zúží jen na něj.',
    en: 'Clicking a name narrows both the report and the timesheets to that person.',
  },
  'rozpad.knihyNadpis': { cs: 'Knihy: rozpočet, čerpání a zisk', en: 'Books: budget, spend and profit' },
  'rozpad.knihyPrazdne': {
    cs: 'Za vybrané období se na žádné knize nepracovalo ani se žádná neodevzdala.',
    en: 'No book was worked on or delivered in the selected period.',
  },
  'rozpad.kniha': { cs: 'Kniha', en: 'Book' },
  'rozpad.ns': { cs: 'NS', en: 'SP' },
  'rozpad.poznamkaKnih': {
    cs: 'Rozpočet i čerpání jsou za CELOU knihu, ne za období - strop se počítá na knihu, ne na měsíc. Tržba jsou vydané faktury na projekt; kde ještě žádná není, je to odhad z normostran a sazby klienta (označený ~). Náklady = výkazy zvukařů za celou knihu plus zařazené výdaje navázané na projekt.',
    en: 'The budget and the spend are for the WHOLE book, not the period — the ceiling is per book, not per month. Revenue is the invoices issued for the project; where there are none yet it is an estimate from the standard pages and the customer’s rate (marked ~). Costs = the sound engineers’ timesheets for the whole book plus filed expenses linked to the project.',
  },
  'rozpad.vykazy': { cs: 'Výkazy', en: 'Timesheets' },
  'rozpad.vykazyClovek': { cs: 'Výkazy – {jmeno}', en: 'Timesheets – {jmeno}' },
  'rozpad.zadnyVykaz': {
    cs: 'Za vybrané období tu žádný výkaz není.',
    en: 'There is no timesheet for the selected period.',
  },
  'rozpad.datum': { cs: 'Datum', en: 'Date' },
  'rozpad.druh': { cs: 'Druh', en: 'Type' },
  'rozpad.castka': { cs: 'Částka', en: 'Amount' },
  'rozpad.prvnich200': {
    cs: 'Zobrazeno prvních 200 výkazů z {celkem}. Zužte období nebo druh práce.',
    en: 'Showing the first 200 timesheets out of {celkem}. Narrow the period or the type of work.',
  },

  /* Režie technické porady. */
  'porada.nadpis': { cs: 'Režie porady', en: 'Meeting running order' },
  'porada.probrano': {
    cs: '{hotovo} z {celkem} probráno · poznámky vidíš jen ty',
    en: '{hotovo} of {celkem} covered · only you can see the notes',
  },
  'porada.otevritPlatno': { cs: 'Otevřít plátno →', en: 'Open the screen →' },
  'porada.navodPredTucnym': {
    cs: 'Na plátno pusť {cesta} a přepni na celou obrazovku. Tuhle stránku si nech na telefonu nebo na druhé obrazovce - odškrtnutí se na plátně objeví samo do pár vteřin.',
    en: 'Put {cesta} on the screen and switch to full screen. Keep this page on your phone or a second screen — a tick appears on the screen by itself within a few seconds.',
  },
  'porada.cesta': {
    cs: 'Přehledy → Knihy a rozpočty → Pro poradu',
    en: 'Reports → Books and budgets → For the meeting',
  },
  'porada.zacitNovou': { cs: 'Začít novou poradu', en: 'Start a new meeting' },
  'porada.odskrtneVse': {
    cs: 'Odškrtne všechna témata, seznam nechá.',
    en: 'Unticks every item and keeps the list.',
  },
  'porada.neulozeno': { cs: 'Nepodařilo se to uložit.', en: 'It could not be saved.' },
  'porada.vratitMezi': { cs: 'Vrátit mezi neprobraná', en: 'Put back among the uncovered' },
  'porada.odskrtnout': { cs: 'Odškrtnout jako probrané', en: 'Tick as covered' },
  'porada.posunoutNahoru': { cs: 'Posunout nahoru', en: 'Move up' },
  'porada.posunoutDolu': { cs: 'Posunout dolů', en: 'Move down' },
  'porada.opravduSmazat': { cs: 'Opravdu smazat?', en: 'Delete it?' },
  'porada.smazatTema': { cs: 'Smazat téma', en: 'Delete the item' },
  'porada.skrytPoznamky': { cs: 'Skrýt poznámky', en: 'Hide the notes' },
  'porada.poznamky': { cs: 'Poznámky', en: 'Notes' },
  'porada.pridatPoznamky': { cs: 'Přidat poznámky', en: 'Add notes' },
  'porada.poznamkaPlaceholder': {
    cs: 'Co k tomuhle tématu říct. Nikdo jiný to neuvidí.',
    en: 'What to say about this item. Nobody else will see it.',
  },
  'porada.noveTema': { cs: 'Nové téma…', en: 'New item…' },
  'porada.pridat': { cs: 'Přidat', en: 'Add' },

  /* Co chodí zvukařům - měsíční přehled. */
  'zvukari.mesic': { cs: 'Měsíc', en: 'Month' },
  'zvukari.rozesilaniVypnute': { cs: 'Rozesílání je vypnuté.', en: 'Sending is switched off.' },
  'zvukari.rozesilalSeOd': {
    cs: 'Přehled za tenhle měsíc se rozesílal od {datum}.',
    en: 'The report for this month has been going out since {datum}.',
  },
  'zvukari.odejde': {
    cs: 'Přehled odejde {datum} v 8:00.',
    en: 'The report will go out on {datum} at 08:00.',
  },
  'zvukari.zvukaru': { cs: 'Zvukařů', en: 'Sound engineers' },
  'zvukari.odpracovano': { cs: 'Odpracováno', en: 'Worked' },
  'zvukari.zaPraci': { cs: 'Za práci', en: 'For the work' },
  'zvukari.celkemSBonusy': { cs: 'Celkem s bonusy', en: 'Total with bonuses' },
  'zvukari.mesicPoZvukarich': { cs: '{mesic} po zvukařích', en: '{mesic} by sound engineer' },
  'zvukari.nikdoNevykazal': {
    cs: 'V tomhle měsíci žádný zvukař nic nevykázal - nikomu nic nepřijde.',
    en: 'No sound engineer reported anything this month — nobody will get anything.',
  },
  'zvukari.odeslano': { cs: 'Odesláno {datum}', en: 'Sent {datum}' },
  'zvukari.nemaEmail': { cs: 'Nemá e-mail', en: 'No e-mail address' },
  'zvukari.vypnuto': { cs: 'Vypnuto', en: 'Switched off' },
  'zvukari.zatimNeodeslo': { cs: 'Zatím neodešlo', en: 'Not sent yet' },
  'zvukari.odejdeKratce': { cs: 'Odejde {datum}', en: 'Goes out {datum}' },
  'zvukari.bonusyPlus': { cs: '+ bonusy {castka}', en: '+ bonuses {castka}' },
  'zvukari.podleDruhu': { cs: 'Podle druhu práce', en: 'By type of work' },
  'zvukari.projekty': { cs: 'Projekty', en: 'Projects' },
  'zvukari.bonusy': { cs: 'Bonusy', en: 'Bonuses' },
  'zvukari.naposledyZmeneno': {
    cs: 'Naposledy změněno {datum}{kdo}.',
    en: 'Last changed {datum}{kdo}.',
  },
  'zvukari.nahledMailu': { cs: 'Náhled mailu', en: 'E-mail preview' },
  'zvukari.ukazka': { cs: 'ukázka', en: 'sample' },
  'zvukari.neulozeneNastaveni': { cs: ' · neuložené nastavení', en: ' · unsaved settings' },
  'zvukari.otevrit': { cs: 'Otevřít ↗', en: 'Open ↗' },
  'zvukari.nahledMailuOdkaz': { cs: 'Náhled mailu →', en: 'E-mail preview →' },
  'zvukari.nastaveniNadpis': {
    cs: 'Nastavení měsíčního přehledu',
    en: 'Monthly report settings',
  },
  'zvukari.posilatPrehled': {
    cs: 'Posílat zvukařům měsíční přehled výkazů',
    en: 'Send the sound engineers a monthly timesheet report',
  },
  'zvukari.chodi': { cs: 'Chodí', en: 'Goes out on the' },
  'zvukari.denRozeslani': { cs: 'Den rozeslání', en: 'Day it goes out' },
  'zvukari.denVMesici': {
    cs: 'den v měsíci v 8:00, za měsíc minulý.',
    en: 'day of the month at 08:00, for the month before.',
  },
  'zvukari.coVMailuJe': { cs: 'Co v mailu je', en: 'What is in the e-mail' },
  'zvukari.hodinyVzdy': {
    cs: 'Odpracované hodiny jsou tam vždycky.',
    en: 'The hours worked are always in it.',
  },
  'zvukari.volbaCastky': {
    cs: 'Částky v korunách (za práci a celkem)',
    en: 'Amounts in koruna (for the work and in total)',
  },
  'zvukari.volbaDruhy': {
    cs: 'Rozpad podle druhu práce (natáčení, střih…)',
    en: 'A breakdown by type of work (recording, editing…)',
  },
  'zvukari.volbaProjekty': { cs: 'Projekty, na kterých dělal', en: 'The projects they worked on' },
  'zvukari.volbaBonusy': { cs: 'Schválené bonusy', en: 'Approved bonuses' },
  'zvukari.bezCastekBonusy': {
    cs: 'bez částek se bonusy neposílají',
    en: 'without amounts the bonuses are not sent',
  },
  'zvukari.vlastniVzkaz': { cs: 'Vlastní vzkaz v mailu', en: 'Your own message in the e-mail' },
  'zvukari.vzkazPlaceholder': {
    cs: 'Např. Fakturu za tento měsíc prosím pošlete do 10. na uctarna@mediaspace.cz.',
    en: 'For example: please send this month’s invoice to uctarna@mediaspace.cz by the 10th.',
  },
  'zvukari.ukladam': { cs: 'Ukládám…', en: 'Saving…' },
  'zvukari.ulozitNastaveni': { cs: 'Uložit nastavení', en: 'Save the settings' },
  'zvukari.nastaveniNeulozeno': {
    cs: 'Nastavení se nepodařilo uložit.',
    en: 'The settings could not be saved.',
  },
  'zvukari.ulozeno': { cs: 'Uloženo.', en: 'Saved.' },
  'zvukari.potvrzeniRozeslani': {
    cs: 'Rozeslat přehled za {mesic} hned? Dostane ho {pocet} zvukařů, kterým ještě neodešel.',
    en: 'Send the report for {mesic} now? {pocet} sound engineers who have not had it yet will get it.',
  },
  'zvukari.rozeslaniNepodarilo': { cs: 'Rozeslání se nepodařilo.', en: 'Sending failed.' },
  'zvukari.rozesilaniVypnutoNic': {
    cs: 'Rozesílání je vypnuté - nic neodešlo.',
    en: 'Sending is switched off — nothing went out.',
  },
  'zvukari.odeslanoPocet': { cs: 'Odesláno {pocet}{chyby}.', en: 'Sent {pocet}{chyby}.' },
  'zvukari.nepodariloSePocet': { cs: ', nepodařilo se {pocet}', en: ', {pocet} failed' },
  'zvukari.rozesilam': { cs: 'Rozesílám…', en: 'Sending…' },
  'zvukari.rozeslatTed': {
    cs: 'Rozeslat teď za {mesic} ({pocet})',
    en: 'Send now for {mesic} ({pocet})',
  },
  'zvukari.nejdrivUlozte': { cs: 'Nejdřív uložte nastavení', en: 'Save the settings first' },

  /* Palubovka - budíky, fakturace po měsících, palivo. */
  'palubovka.stav.DOBRE': { cs: 'Šlape to', en: 'Running well' },
  'palubovka.stav.HLIDAT': { cs: 'Hlídat', en: 'Keep an eye on it' },
  'palubovka.stav.SPATNE': { cs: 'Přidat', en: 'Step it up' },
  'palubovka.bezCile': { cs: 'Není zadaný měsíční cíl', en: 'No monthly target has been set' },
  'palubovka.naPlanu': {
    cs: 'Na plánu i s ohledem na to, kolik je měsíce',
    en: 'On plan, even allowing for how far into the month we are',
  },
  'palubovka.kDnesku': {
    cs: 'K dnešku by mělo být {procenta} % cíle',
    en: '{procenta}% of the target should be done by today',
  },
  'palubovka.mameNa': { cs: 'Máme na {kolik} dopředu', en: 'We have {kolik} ahead of us' },
  'palubovka.chcemeMit': {
    cs: 'Chceme mít na {cil}, máme na {kolik}',
    en: 'We want {cil}, we have {kolik}',
  },
  'palubovka.dni': { cs: '{pocet} dní', en: '{pocet} days' },
  'palubovka.mesic': { cs: 'měsíc', en: 'a month' },
  'palubovka.mesiceNekolik': { cs: '{cislo} měsíce', en: '{cislo} months' },
  'palubovka.mesicuMnoho': { cs: '{cislo} měsíců', en: '{cislo} months' },
  'palubovka.nadpis': { cs: 'Palubovka', en: 'Dashboard' },
  'palubovka.mesicRokVidisJenTy': {
    cs: '{mesic} {rok} · vidíš jen ty',
    en: '{mesic} {rok} · only you can see this',
  },
  'palubovka.zavrit': { cs: 'Zavřít', en: 'Close' },
  'palubovka.cile': { cs: 'Cíle', en: 'Targets' },
  'palubovka.cileUvod': {
    cs: 'Proti těmhle číslům se budíky měří. Když měsíční cíl necháš prázdný, bere se průměr posledních tří měsíců — tedy „jedeme jako obvykle".',
    en: 'The gauges are measured against these numbers. Leave the monthly target empty and the average of the last three months is used — that is, „business as usual".',
  },
  'palubovka.mesicniObrat': { cs: 'Měsíční obrat (Kč bez DPH)', en: 'Monthly turnover (CZK excluding VAT)' },
  'palubovka.rocniObrat': { cs: 'Roční obrat (Kč bez DPH)', en: 'Annual turnover (CZK excluding VAT)' },
  'palubovka.mesicuKryti': {
    cs: 'Chci mít rozjednáno na (měsíců)',
    en: 'I want work lined up for (months)',
  },
  'palubovka.cileNeulozeny': { cs: 'Cíle se nepodařilo uložit.', en: 'The targets could not be saved.' },
  'palubovka.ukladam': { cs: 'Ukládám…', en: 'Saving…' },
  'palubovka.ulozitCile': { cs: 'Uložit cíle', en: 'Save the targets' },
  'palubovka.vyfakturovanoV': { cs: 'Vyfakturováno v {mesic}u', en: 'Invoiced in {mesic}' },
  'palubovka.ztohoUhrazeno': { cs: 'z toho uhrazeno {castka}', en: 'of which {castka} paid' },
  'palubovka.protiLoni': { cs: 'proti stejnému měsíci loni', en: 'against the same month last year' },
  'palubovka.protiPrumeru': { cs: 'proti průměru tří měsíců', en: 'against the three-month average' },
  'palubovka.odLedna': { cs: 'Od ledna', en: 'Since January' },
  'palubovka.rocniCil': {
    cs: '{procenta} % ročního cíle, roku uteklo {uteklo} %',
    en: '{procenta}% of the annual target, {uteklo}% of the year gone',
  },
  'palubovka.tachometr': { cs: 'Tachometr — tenhle měsíc', en: 'Speedometer — this month' },
  'palubovka.cilKc': { cs: 'Cíl {castka}', en: 'Target {castka}' },
  'palubovka.cilKcPrumer': {
    cs: 'Cíl {castka} (průměr tří měsíců)',
    en: 'Target {castka} (three-month average)',
  },
  'palubovka.zadejCil': { cs: 'Zadej si měsíční cíl v Cílech', en: 'Set a monthly target under Targets' },
  'palubovka.palivo': { cs: 'Palivo — co máme rozjednáno', en: 'Fuel — what we have lined up' },
  'palubovka.rozjednanychProjektu': {
    cs: '{pocet} rozjednaných projektů',
    en: '{pocet} projects lined up',
  },
  'palubovka.zCehoFakturovat': { cs: 'Z čeho se bude fakturovat', en: 'What there is left to invoice' },
  'palubovka.neukonceneProjekty': {
    cs: 'neukončené projekty, kde ještě není vyfakturováno všechno',
    en: 'open projects where not everything has been invoiced yet',
  },
  'palubovka.nicRozjednaneho': {
    cs: 'Nic rozjednaného — to je ta chvíle, kdy se má přidat na obchodu.',
    en: 'Nothing lined up — this is the moment to step up the sales.',
  },
  'palubovka.bezTerminu': { cs: 'bez termínu', en: 'no deadline' },
  'palubovka.odhad': { cs: ' odhad', en: ' estimate' },
  'palubovka.poznamkaPaliva': {
    cs: 'Počítá se schválená nebo odeslaná nabídka mínus to, co už je z projektu vyfakturované. Kde nabídka není, bere se u audioknihy odhad z normostran a sazby klienta.',
    en: 'It counts the approved or sent quote less whatever has already been invoiced on the project. Where there is no quote, an audiobook is estimated from the standard pages and the customer’s rate.',
  },
  'palubovka.fakturacePoMesicich': { cs: 'Fakturace po měsících', en: 'Invoicing by month' },
  'palubovka.bezDph13': {
    cs: 'bez DPH, posledních 13 měsíců',
    en: 'excluding VAT, the last 13 months',
  },
  'palubovka.mesicniCil': { cs: 'měsíční cíl {castka}', en: 'monthly target {castka}' },
  'palubovka.bublinaMesice': {
    cs: '{mesic} {rok}: vyfakturováno {vyfakturovano}, z toho uhrazeno {uhrazeno}',
    en: '{mesic} {rok}: {vyfakturovano} invoiced, of which {uhrazeno} paid',
  },
  'palubovka.najetimMysi': {
    cs: 'Najetím myší na sloupec se ukáže přesná částka.',
    en: 'Hover over a bar to see the exact amount.',
  },
  'palubovka.budikPopisek': { cs: '{nadpis}: {hodnota}, {stav}', en: '{nadpis}: {hodnota}, {stav}' },

  /* Backlog - odevzdávání v termínu. */
  'backlog.druh.VSE': { cs: 'Obojí', en: 'Both' },
  'backlog.druh.AUDIOKNIHA': { cs: 'Audioknihy', en: 'Audiobooks' },
  'backlog.druh.REKLAMA': { cs: 'Reklamy', en: 'Adverts' },
  'backlog.obdobi6': { cs: '6 měsíců', en: '6 months' },
  'backlog.obdobi12': { cs: '12 měsíců', en: '12 months' },
  'backlog.obdobiVse': { cs: 'Vše', en: 'All' },
  'backlog.nicTu': {
    cs: 'Za tohle období tu zatím nic není. Backlog počítá z historie projektu — zná jen projekty, které se do stavu „Dokončeno - ke schválení" dostaly po 10. 9. 2026, a jen ty, které mají vyplněné datum dokončení.',
    en: 'There is nothing here for this period yet. The backlog is calculated from project history — it only knows projects that reached the status „Dokončeno - ke schválení" after 10/09/2026, and only those with a completion date filled in.',
  },
  'backlog.odevzdanychProjektu': { cs: 'Odevzdaných projektů', en: 'Projects delivered' },
  'backlog.vTerminu': { cs: 'V termínu', en: 'On time' },
  'backlog.zCelku': { cs: '{pocet} z {celkem}', en: '{pocet} of {celkem}' },
  'backlog.celkemDni': { cs: 'Celkem dní', en: 'Days in total' },
  'backlog.dniKDobruASkluzu': {
    cs: '{kDobru} dní k dobru · {skluz} dní skluzu',
    en: '{kDobru} days to spare · {skluz} days of delay',
  },
  'backlog.prumerNaProjekt': { cs: 'Průměr na projekt', en: 'Average per project' },
  'backlog.nejdelsiSkluz': { cs: 'nejdelší skluz {pocet} dní', en: 'longest delay {pocet} days' },
  'backlog.zadnySkluz': { cs: 'žádný skluz', en: 'no delay' },
  'backlog.podilOdevzdani': { cs: 'Podíl odevzdání', en: 'Share of deliveries' },
  'backlog.podilPopisek': {
    cs: 'V termínu {vTerminu} procent, po termínu {poTerminu} procent',
    en: 'On time {vTerminu} per cent, late {poTerminu} per cent',
  },
  'backlog.vTerminuAPo': {
    cs: '{vTerminu} v termínu · {poTerminu} po termínu',
    en: '{vTerminu} on time · {poTerminu} late',
  },
  'backlog.dnyPodleMesice': { cs: 'Dny podle měsíce odevzdání', en: 'Days by month of delivery' },
  'backlog.celkemDniDetail': { cs: 'Celkem {dni} dní', en: '{dni} days in total' },
  'backlog.bublinaMesice': {
    cs: '{mesic}: {dni} dní, {vTerminu} v termínu, {poTerminu} po termínu',
    en: '{mesic}: {dni} days, {vTerminu} on time, {poTerminu} late',
  },
  'backlog.legendaVTerminu': { cs: 'v termínu', en: 'on time' },
  'backlog.legendaPoTerminu': { cs: 'po termínu', en: 'late' },
  'backlog.projektyOdSkluzu': {
    cs: 'Projekty od největšího skluzu',
    en: 'Projects by longest delay',
  },
  'backlog.zkratit': { cs: 'Zkrátit', en: 'Show fewer' },
  'backlog.zobrazitVsech': { cs: 'Zobrazit všech {pocet}', en: 'Show all {pocet}' },
  'backlog.projekt': { cs: 'Projekt', en: 'Project' },
  'backlog.termin': { cs: 'Termín', en: 'Due' },
  'backlog.odevzdano': { cs: 'Odevzdáno', en: 'Delivered' },
  'backlog.dni': { cs: 'Dní', en: 'Days' },
  'backlog.reklama': { cs: 'Reklama', en: 'Advert' },
  'backlog.audiokniha': { cs: 'Audiokniha', en: 'Audiobook' },

  /* Ceník studia. Obsah ceníku (náhled, PDF, text e-mailu) zůstává ANGLICKY
   * schválně - jde ven britským klientům studia (pravidlo 5). Překládá se
   * jen rozhraní editoru. */
  'cenikStudia.nadpis': { cs: 'Ceník studia', en: 'Studio price list' },
  'cenikStudia.uvod': {
    cs: 'Ceny se mění tady; ven jde PDF ve značce Mediaspace, ke stažení nebo rovnou e-mailem.',
    en: 'Prices are changed here; what goes out is a Mediaspace-branded PDF, to download or send straight by e-mail.',
  },
  'cenikStudia.studio': { cs: 'Studio', en: 'Studio' },
  'cenikStudia.zahlavi': { cs: 'Záhlaví', en: 'Header' },
  'cenikStudia.nazevVHlavicce': { cs: 'Název v hlavičce', en: 'Name in the header' },
  'cenikStudia.podnadpis': { cs: 'Podnadpis', en: 'Subtitle' },
  'cenikStudia.platiDo': { cs: 'Platí do', en: 'Valid until' },
  'cenikStudia.mena': { cs: 'Měna', en: 'Currency' },
  'cenikStudia.cenoveSloupce': { cs: 'Cenové sloupce', en: 'Price columns' },
  'cenikStudia.druhySloupecVolny': {
    cs: 'Druhý sloupec je dobrovolný. Když ho necháte prázdný, bude mít ceník jen jednu cenu u každé položky.',
    en: 'The second column is optional. Leave it empty and the price list will have just one price per item.',
  },
  'cenikStudia.prvniSloupec': { cs: 'První sloupec', en: 'First column' },
  'cenikStudia.druhySloupec': { cs: 'Druhý sloupec', en: 'Second column' },
  'cenikStudia.popisPodNim': { cs: 'Popis pod ním', en: 'Description below it' },
  'cenikStudia.polozky': { cs: 'Položky', en: 'Items' },
  'cenikStudia.posunoutNahoru': { cs: 'Posunout nahoru', en: 'Move up' },
  'cenikStudia.posunoutDolu': { cs: 'Posunout dolů', en: 'Move down' },
  'cenikStudia.opravduSmazat': { cs: 'Opravdu smazat?', en: 'Delete it?' },
  'cenikStudia.smazatPolozku': { cs: 'Smazat položku', en: 'Delete the item' },
  'cenikStudia.cena': { cs: 'Cena', en: 'Price' },
  'cenikStudia.pridatPolozku': { cs: '+ Přidat položku', en: '+ Add an item' },
  'cenikStudia.poznamkaPodTabulkou': {
    cs: 'Poznámka pod tabulkou',
    en: 'Note below the table',
  },
  'cenikStudia.ukladam': { cs: 'Ukládám…', en: 'Saving…' },
  'cenikStudia.ulozitCenik': { cs: 'Uložit ceník', en: 'Save the price list' },
  'cenikStudia.nahledPdf': { cs: 'Náhled PDF', en: 'PDF preview' },
  'cenikStudia.stahnoutPdf': { cs: 'Stáhnout PDF', en: 'Download the PDF' },
  'cenikStudia.poslatEmailem': { cs: 'Poslat e-mailem', en: 'Send by e-mail' },
  'cenikStudia.zUlozeneho': {
    cs: 'Náhled PDF i příloha e-mailu se dělají z uloženého ceníku - co není uložené, v nich nebude.',
    en: 'Both the PDF preview and the e-mail attachment are made from the saved price list — anything unsaved will not be in them.',
  },
  'cenikStudia.poslatCenik': { cs: 'Poslat ceník', en: 'Send the price list' },
  'cenikStudia.komu': { cs: 'Komu', en: 'To' },
  'cenikStudia.predmet': { cs: 'Předmět', en: 'Subject' },
  'cenikStudia.zprava': { cs: 'Zpráva', en: 'Message' },
  'cenikStudia.odejdeZPortalu': {
    cs: 'Odejde z adresy portálu za Mediaspace; odpověď přijde vám. PDF ceníku je v příloze.',
    en: 'It goes out from the portal’s address on behalf of Mediaspace; the reply comes to you. The price list PDF is attached.',
  },
  'cenikStudia.odesilam': { cs: 'Odesílám…', en: 'Sending…' },
  'cenikStudia.ulozitAOdeslat': { cs: 'Uložit a odeslat', en: 'Save and send' },
  'cenikStudia.neulozeno': { cs: 'Uložení se nepovedlo.', en: 'Saving failed.' },
  'cenikStudia.ulozeno': { cs: 'Uloženo.', en: 'Saved.' },
  'cenikStudia.napisteKomu': {
    cs: 'Napište, komu se má ceník poslat.',
    en: 'Write down who the price list should go to.',
  },
  'cenikStudia.odeslaniNepovedlo': { cs: 'Odeslání se nepovedlo.', en: 'Sending failed.' },
  'cenikStudia.odeslanoNa': { cs: 'Odesláno na {komu}.', en: 'Sent to {komu}.' },
  'cenikStudia.cenaOd': { cs: 'od', en: 'from' },
  'cenikStudia.cenaOdTitle': {
    cs: 'Cena je orientační - v ceníku se napíše „from …"',
    en: 'The price is indicative — the price list will say „from …"',
  },

  /* Sítě (sekce Web) - přehled příspěvků a editor plátna.
   * Názvy formátů, šablon a písem se překládají podle KLÍČE (vzor vzoryZprav
   * z dávky 7c: lib/socialni.ts stojí bez závislostí, ať si ho vezme
   * i prohlížeč). Texty VLOŽENÉ šablonou do plátna zůstávají české - je to
   * obsah, který se ukládá do databáze (stejně jako výchozí názvy výstupů
   * v dávce 7b). */
  'site.nadpis': { cs: 'Sítě', en: 'Social' },
  'site.zpetNaSite': { cs: '← Sítě', en: '← Social' },
  'site.zavrit': { cs: 'Zavřít', en: 'Close' },
  'site.novyPrispevek': { cs: 'Nový příspěvek', en: 'New post' },
  'site.kamToPujde': { cs: 'Kam to půjde', en: 'Where it will go' },
  'site.zCehoZacit': { cs: 'Z čeho začít', en: 'What to start from' },
  'site.nezalozeno': {
    cs: 'Příspěvek se nepodařilo založit.',
    en: 'The post could not be created.',
  },
  'site.zatimNic': {
    cs: 'Zatím tu nic není. Tlačítkem {tlacitko} si vyberete formát a šablonu.',
    en: 'There is nothing here yet. Use {tlacitko} to pick a format and a template.',
  },
  'site.naposledy': { cs: 'Naposledy {datum}', en: 'Last change {datum}' },
  'site.stav.KONCEPT': { cs: 'Rozpracováno', en: 'In progress' },
  'site.stav.HOTOVO': { cs: 'Hotovo', en: 'Done' },
  'site.stav.PUBLIKOVANO': { cs: 'Publikováno', en: 'Published' },
  'site.format.ig-9x16.nazev': { cs: 'Stories / Reels', en: 'Stories / Reels' },
  'site.format.ig-9x16.popis': { cs: 'Na celou obrazovku telefonu.', en: 'Fills the whole phone screen.' },
  'site.format.ig-4x5.nazev': { cs: 'Příspěvek na výšku', en: 'Portrait post' },
  'site.format.ig-4x5.popis': { cs: 'Ve feedu zabere nejvíc místa.', en: 'Takes the most room in the feed.' },
  'site.format.ig-1x1.nazev': { cs: 'Čtverec', en: 'Square' },
  'site.format.ig-1x1.popis': { cs: 'Klasický příspěvek.', en: 'The classic post.' },
  'site.format.li-1200x627.nazev': { cs: 'LinkedIn na šířku', en: 'LinkedIn landscape' },
  'site.format.li-1200x627.popis': {
    cs: 'Doporučený rozměr pro příspěvek s obrázkem.',
    en: 'The recommended size for a post with an image.',
  },
  'site.format.li-1x1.nazev': { cs: 'LinkedIn čtverec', en: 'LinkedIn square' },
  'site.format.li-1x1.popis': {
    cs: 'Ve feedu na mobilu zabere víc místa.',
    en: 'Takes more room in the feed on a phone.',
  },
  'site.sablona.novy-spot.nazev': { cs: 'Nový spot', en: 'New advert' },
  'site.sablona.novy-spot.popis': {
    cs: 'Velký nadpis přes fialový přechod, dole podpis.',
    en: 'A big headline over a purple gradient, with a sign-off at the bottom.',
  },
  'site.sablona.citat.nazev': { cs: 'Citát', en: 'Quote' },
  'site.sablona.citat.popis': { cs: 'Výrok uprostřed, jméno pod ním.', en: 'The quote in the middle, the name below it.' },
  'site.sablona.fotka-s-titulkem.nazev': { cs: 'Fotka s titulkem', en: 'Photo with a headline' },
  'site.sablona.fotka-s-titulkem.popis': {
    cs: 'Obrázek přes celé plátno, dole ztmavení a text.',
    en: 'An image across the whole canvas, darkened at the bottom with text on it.',
  },
  'site.sablona.linkedin-oznameni.nazev': { cs: 'Oznámení na LinkedIn', en: 'LinkedIn announcement' },
  'site.sablona.linkedin-oznameni.popis': {
    cs: 'Vlevo text, vpravo zelený pruh.',
    en: 'Text on the left, a green band on the right.',
  },
  'site.sablona.cista.nazev': { cs: 'Prázdné plátno', en: 'Blank canvas' },
  'site.sablona.cista.popis': {
    cs: 'Jen pozadí, zbytek si postavím sám.',
    en: 'Just a background — I will build the rest myself.',
  },
  'site.pismo.display': { cs: 'Nadpisové', en: 'Display' },
  'site.pismo.heading': { cs: 'Popisky', en: 'Headings' },
  'site.pismo.body': { cs: 'Text', en: 'Body' },

  /* Pribehy na Instagram (6. 10. 2026). */
  /* Vyskakovaci zalozka Site v levem panelu (6. 10. 2026). */
  'dokSiti.nadpis': { cs: 'Sítě', en: 'Social' },
  'dokSiti.zobrazit': { cs: 'Zobrazit Sítě', en: 'Show social' },
  'dokSiti.skryt': { cs: 'Skrýt Sítě', en: 'Hide social' },
  'dokSiti.pribehy': { cs: 'Příběhy na Instagram', en: 'Instagram stories' },
  'dokSiti.novyPribeh': { cs: 'Nový příběh', en: 'New story' },
  'dokSiti.fronta': { cs: 'Rozdělané', en: 'Drafts and failures' },
  'dokSiti.prispevky': { cs: 'Příspěvky na sítě', en: 'Social posts' },
  'dokSiti.popis': {
    cs: 'Příběh na Instagramu vydrží 24 hodin a pak sám zmizí.',
    en: 'A story stays on Instagram for 24 hours and then disappears.',
  },
  'pribehy.nadpis': { cs: 'Příběhy na Instagram', en: 'Instagram stories' },
  // CELÁ OBRAZOVKA NA TELEFONU (zadání 7. 10. 2026).
  'pribehy.novy': { cs: 'Nový příběh', en: 'New story' },
  'pribehy.klepniAPis': { cs: 'Klepni a piš', en: 'Tap to write' },
  'pribehy.dalsiVolby': { cs: 'Další volby', en: 'More options' },
  'pribehy.podnadpis': {
    cs: 'Slož příběh a pusť ho ven. K instagramovému účtu se nedostaneš – vyvěsí to za tebe portál a po 24 hodinách to samo zmizí.',
    en: 'Put a story together and send it out. You never touch the Instagram account – the portal posts it, and it disappears on its own after 24 hours.',
  },
  'pribehy.podnadpisSchvalovatel': {
    cs: 'Co přijde od týmu, čeká tady. Soubor si stáhni, vyvěs ho na Instagram a dá se tu označit jako venku.',
    en: 'Whatever the team sends waits here. Download the file, post it to Instagram and mark it as published.',
  },
  'pribehy.soubor': { cs: 'Fotka nebo video', en: 'Photo or video' },
  'pribehy.souborPopis': {
    cs: 'Na výšku 9:16, JPEG, PNG, WEBP, MP4 nebo MOV. Video až 15 sekund – delší si Instagram rozseká sám.',
    en: 'Portrait 9:16, JPEG, PNG, WEBP, MP4 or MOV. Video up to 15 seconds – Instagram splits anything longer.',
  },
  'pribehy.bezUctu': { cs: 'Účet zatím není připojený', en: 'No account connected yet' },
  'pribehy.vybratSoubor': { cs: 'Vybrat fotku nebo video', en: 'Choose a photo or video' },
  'pribehy.zmenitSoubor': { cs: 'Vybrat jiný', en: 'Choose another' },
  'pribehy.takhleToBude': { cs: 'Takhle to bude vypadat', en: 'This is how it will look' },
  'pribehy.devetNaSestnact': { cs: 'Na výšku 9:16', en: 'Portrait 9:16' },
  'pribehy.tahniText': { cs: 'Text přetáhni, kam má být', en: 'Drag the text where you want it' },
  'pribehy.uVideaBezTextu': {
    cs: 'Do videa text vypálit nejde – zůstane jako vzkaz.',
    en: 'Text cannot be burned into video – it stays a note.',
  },
  'pribehy.velikost': { cs: 'Velikost', en: 'Size' },
  'pribehy.zvetsit': { cs: 'Zvětšit písmo', en: 'Larger text' },
  'pribehy.zmensit': { cs: 'Zmenšit písmo', en: 'Smaller text' },
  'pribehy.zarovnani': { cs: 'Zarovnání', en: 'Alignment' },
  'pribehy.barvaPisma': { cs: 'Barva', en: 'Colour' },
  'pribehy.podklad': { cs: 'Podklad', en: 'Backdrop' },
  'pribehy.podklad.zadny': { cs: 'Žádný', en: 'None' },
  'pribehy.podklad.tmavy': { cs: 'Tmavý', en: 'Dark' },
  'pribehy.podklad.svetly': { cs: 'Světlý', en: 'Light' },
  'pribehy.podklad.fialovy': { cs: 'Fialový', en: 'Purple' },
  'pribehy.zavrit': { cs: 'Zavřít', en: 'Close' },
  'pribehy.popisek': { cs: 'Text na příběhu', en: 'Text on the story' },
  'pribehy.popisekPlaceholder': {
    cs: 'Není povinný. U fotky se vypálí přímo do obrázku, u videa zůstane jako vzkaz.',
    en: 'Optional. On a photo it is burned into the image; on video it stays a note.',
  },
  'pribehy.odeslat': { cs: 'Odeslat ke schválení', en: 'Send for approval' },
  'pribehy.odesilam': { cs: 'Odesílám…', en: 'Sending…' },
  'pribehy.nahravam': { cs: 'Nahráno {procenta} %', en: '{procenta}% uploaded' },
  'pribehy.neodeslano': {
    cs: 'Příběh se nepodařilo odeslat. Zkus to znovu.',
    en: 'The story could not be sent. Please try again.',
  },
  'pribehy.nevyrizeno': { cs: 'Nepodařilo se to. Zkus to znovu.', en: 'That did not work. Please try again.' },
  'pribehy.nezkopirovano': { cs: 'Text se nepodařilo zkopírovat.', en: 'The text could not be copied.' },
  'pribehy.spatnyTyp': {
    cs: 'Instagram vezme jen JPEG, PNG, WEBP, MP4 nebo MOV.',
    en: 'Instagram only takes JPEG, PNG, WEBP, MP4 or MOV.',
  },
  'pribehy.mocVelky': { cs: 'Soubor je moc velký – vejde se do {kolik}.', en: 'The file is too big – the limit is {kolik}.' },
  'pribehy.datNaInstagram': { cs: 'Zveřejnit', en: 'Publish' },
  'pribehy.ulozitKoncept': { cs: 'Uložit koncept', en: 'Save draft' },
  'pribehy.vymenitFotku': { cs: 'Vyměnit fotku', en: 'Replace the photo' },
  'pribehy.zacitZnovu': { cs: 'Začít znovu', en: 'Start over' },
  'pribehy.smazat': { cs: 'Smazat', en: 'Delete' },
  'pribehy.otevrit': { cs: 'Otevřít', en: 'Open' },
  'pribehy.zkusitZnovu': { cs: 'Zkusit znovu', en: 'Try again' },
  'pribehy.koncepty': { cs: 'Koncepty', en: 'Drafts' },
  'pribehy.neproslo': { cs: 'Neprošlo na Instagram', en: 'Did not go through' },
  'pribehy.naInstagramu': { cs: 'Na Instagramu', en: 'On Instagram' },
  'pribehy.prazdneMisto': { cs: 'Volné místo', en: 'Free slot' },
  'pribehy.nicVenku': { cs: 'Teď venku nic není.', en: 'Nothing is live right now.' },
  'pribehy.vyprsele': { cs: 'Už vypršelo', en: 'Expired' },
  'pribehy.uzPryc': { cs: 'už je pryč', en: 'gone' },
  'pribehy.zbyvaHodin': { cs: 'zbývá {h} h', en: '{h} h left' },
  'pribehy.zbyvaMinut': { cs: 'zbývá {m} min', en: '{m} min left' },
  'pribehy.daltamVKolik': { cs: 'Dal tam {kdo} · {datum}', en: 'Posted by {kdo} · {datum}' },
  'pribehy.upravujeteKoncept': { cs: 'upravujete koncept', en: 'editing a draft' },
  'pribehy.konceptNeotevren': {
    cs: 'Koncept se nepodařilo otevřít. Zkuste to znovu.',
    en: 'The draft could not be opened. Please try again.',
  },
  'pribehy.stav.KONCEPT': { cs: 'Koncept', en: 'Draft' },
  'pribehy.zminky': { cs: 'Zmínky', en: 'Mentions' },
  'pribehy.zminkyZatimZadne': { cs: 'napiš @ a jméno', en: 'type @ and a name' },
  'pribehy.zminkyPopis': {
    cs: 'Zavináč se propíše do textu na příběhu. Klikací nálepku Instagram přes API nalepit neumí – tu jde přidat jen z telefonu.',
    en: 'The handle is written into the story text. Instagram cannot add a tappable mention sticker through the API – only the app can.',
  },
  'pribehy.cekaji': { cs: 'Čeká na vyvěšení', en: 'Waiting to be posted' },
  'pribehy.vyrizene': { cs: 'Vyřízené', en: 'Done' },
  'pribehy.zatimNic': {
    cs: 'Zatím tu nic není.',
    en: 'Nothing here yet.',
  },
  'pribehy.stav.CEKA': { cs: 'Čeká', en: 'Waiting' },
  'pribehy.stav.VYVESENO': { cs: 'Vyvěšeno', en: 'Posted' },
  'pribehy.stav.ZAMITNUTO': { cs: 'Nevyvěšeno', en: 'Not posted' },
  'pribehy.od': { cs: '{kdo} · {datum}', en: '{kdo} · {datum}' },
  'pribehy.bezPopisku': { cs: 'Bez textu.', en: 'No text.' },
  'pribehy.stahnout': { cs: 'Stáhnout', en: 'Download' },
  'pribehy.zkopirovatText': { cs: 'Zkopírovat text', en: 'Copy the text' },
  'pribehy.zkopirovano': { cs: 'Zkopírováno', en: 'Copied' },
  'pribehy.vyveseno': { cs: 'Vyvěšeno na Instagram', en: 'Posted to Instagram' },
  'pribehy.vyvesit': { cs: 'Vyvěsit na Instagram', en: 'Post to Instagram' },
  'pribehy.vyvesuji': { cs: 'Vyvěšuji…', en: 'Posting…' },
  'pribehy.vyvesenoRucne': { cs: 'Vyvěšeno ručně', en: 'Posted by hand' },
  'pribehy.zamitnout': { cs: 'Nevyvěsit', en: 'Do not post' },
  'pribehy.vzkaz': { cs: 'Vzkaz zpátky', en: 'Message back' },
  'pribehy.vzkazPlaceholder': {
    cs: 'Proč to nejde ven – ať to autor ví.',
    en: 'Why it is not going out – so the author knows.',
  },
  'pribehy.potvrditZamitnuti': { cs: 'Potvrdit a poslat vzkaz', en: 'Confirm and send the message' },
  'pribehy.stahnoutZFronty': { cs: 'Stáhnout z fronty', en: 'Take it back' },
  'pribehy.vyridil': { cs: 'Vyřídil {kdo}, {datum}', en: 'Handled by {kdo}, {datum}' },

  /* Editor plátna. */
  'siteEditor.nazevPrispevku': { cs: 'Název příspěvku', en: 'Post name' },
  'siteEditor.ulozeno': { cs: 'Uloženo', en: 'Saved' },
  'siteEditor.neulozeneZmeny': { cs: 'Neuložené změny', en: 'Unsaved changes' },
  'siteEditor.ukladam': { cs: 'Ukládám…', en: 'Saving…' },
  'siteEditor.ulozit': { cs: 'Uložit', en: 'Save' },
  'siteEditor.stahnoutPng': { cs: 'Stáhnout PNG', en: 'Download the PNG' },
  'siteEditor.pridatText': { cs: '+ Text', en: '+ Text' },
  'siteEditor.pridatObrazek': { cs: '+ Obrázek', en: '+ Image' },
  'siteEditor.format': { cs: 'Formát', en: 'Format' },
  'siteEditor.zmenitVelikost': { cs: 'Změnit velikost', en: 'Resize' },
  'siteEditor.navodKTazeni': {
    cs: 'Táhněte myší, rohem měníte velikost. Klávesa Delete smaže vybranou vrstvu, Escape zruší výběr.',
    en: 'Drag with the mouse; the corner resizes. Delete removes the selected layer, Escape clears the selection.',
  },
  'siteEditor.navrh': { cs: 'Návrh', en: 'Design' },
  'siteEditor.popisek': { cs: 'Popisek', en: 'Caption' },
  'siteEditor.zadnaVrstva': {
    cs: 'Zatím žádná — přidejte text nebo obrázek.',
    en: 'None yet — add some text or an image.',
  },
  'siteEditor.vrstvaText': { cs: 'Text', en: 'Text' },
  'siteEditor.vrstvaObrazek': { cs: 'Obrázek', en: 'Image' },
  'siteEditor.vrstvaTvar': { cs: 'Tvar', en: 'Shape' },
  'siteEditor.zacitZnovu': { cs: 'Začít znovu ze šablony', en: 'Start again from a template' },
  'siteEditor.potvrdNahrazeni': {
    cs: 'Nahradit současný návrh šablonou „{sablona}"?',
    en: 'Replace the current design with the „{sablona}" template?',
  },
  'siteEditor.smazatPrispevek': { cs: 'Smazat příspěvek', en: 'Delete the post' },
  'siteEditor.potvrdSmazani': { cs: 'Smazat celý příspěvek?', en: 'Delete the whole post?' },
  'siteEditor.oCemJe': { cs: 'O čem příspěvek je', en: 'What the post is about' },
  'siteEditor.oCemJePlaceholder': {
    cs: 'Natočili jsme spot pro Strabag, mluví v něm patnáct herců…',
    en: 'We recorded an advert for Strabag with fifteen voice actors in it…',
  },
  'siteEditor.brunoPise': { cs: 'Bruno píše…', en: 'Bruno is writing…' },
  'siteEditor.nechatNapsat': { cs: 'Nechat napsat Brunem', en: 'Let Bruno write it' },
  'siteEditor.brunoNeodpovida': { cs: 'Bruno teď neodpovídá.', en: 'Bruno is not responding right now.' },
  'siteEditor.napisteVetu': {
    cs: 'Napište aspoň větu o tom, o čem příspěvek je.',
    en: 'Write at least a sentence about what the post is about.',
  },
  'siteEditor.zkopirovat': {
    cs: 'Zkopírovat popisek i s hashtagy',
    en: 'Copy the caption with the hashtags',
  },
  'siteEditor.obrazekNenahran': {
    cs: 'Obrázek se nepodařilo nahrát.',
    en: 'The image could not be uploaded.',
  },
  'siteEditor.neulozeno': { cs: 'Uložení se nepovedlo.', en: 'Saving failed.' },
  'siteEditor.exportNepovedl': {
    cs: 'Obrázek se nepodařilo vyexportovat.',
    en: 'The image could not be exported.',
  },
  'siteEditor.novyText': { cs: 'Nový text', en: 'New text' },
  'siteEditor.dopredu': { cs: 'Dopředu', en: 'Bring forward' },
  'siteEditor.pismo': { cs: 'Písmo', en: 'Font' },
  'siteEditor.zarovnani': { cs: 'Zarovnání', en: 'Alignment' },
  'siteEditor.naStred': { cs: 'Na střed', en: 'Centre' },
  'siteEditor.tucne': { cs: 'Tučně', en: 'Bold' },
  'siteEditor.zaobleni': { cs: 'Zaoblení', en: 'Corner radius' },
  'siteEditor.pruhlednost': { cs: 'Průhlednost', en: 'Opacity' },
  'siteEditor.vyplnRamecku': { cs: 'Výplň rámečku', en: 'How it fills the frame' },
  'siteEditor.vyplnitAOriznout': { cs: 'Vyplnit a oříznout', en: 'Fill and crop' },
  'siteEditor.vejitSeCely': { cs: 'Vejít se celý', en: 'Fit the whole thing' },
  'siteEditor.vymenitZa': { cs: 'Vyměnit za', en: 'Swap for' },
  'siteEditor.vyberteZNahranych': { cs: '— vyberte z nahraných —', en: '— choose from the uploads —' },
  'siteEditor.pozadiNicVybrano': { cs: 'Pozadí (nic není vybráno)', en: 'Background (nothing selected)' },
  'siteEditor.barva': { cs: 'Barva', en: 'Colour' },
  'siteEditor.prechod': { cs: 'Přechod', en: 'Gradient' },
  'siteEditor.fotka': { cs: 'Fotka', en: 'Photo' },
  'siteEditor.nahratFotku': { cs: 'Nahrát fotku na pozadí', en: 'Upload a background photo' },
  'siteEditor.ztmaveni': { cs: 'Ztmavení', en: 'Darkening' },
  'siteEditor.instagram': { cs: 'Instagram', en: 'Instagram' },
  'siteEditor.linkedin': { cs: 'LinkedIn', en: 'LinkedIn' },

  'siteEditor.pridatTvar': { cs: '+ Tvar', en: '+ Shape' },
  'siteEditor.vrstvy': { cs: 'Vrstvy (odspodu nahoru)', en: 'Layers (bottom to top)' },
  'siteEditor.stav': { cs: 'Stav', en: 'Status' },
  'siteEditor.hashtagy': { cs: 'Hashtagy', en: 'Hashtags' },
  'siteEditor.formatVolba': {
    cs: '{sit} · {nazev} ({sirka}×{vyska})',
    en: '{sit} · {nazev} ({sirka}×{vyska})',
  },

  'siteEditor.dozadu': { cs: 'Dozadu', en: 'Send backward' },
  'siteEditor.smazatVrstvu': { cs: 'Smazat vrstvu', en: 'Delete the layer' },
  'siteEditor.velikost': { cs: 'Velikost', en: 'Size' },
  'siteEditor.vlevo': { cs: 'Vlevo', en: 'Left' },
  'siteEditor.vpravo': { cs: 'Vpravo', en: 'Right' },
  'siteEditor.verzalky': { cs: 'VERZÁLKY', en: 'CAPITALS' },
  'siteEditor.od': { cs: 'Od', en: 'From' },
  'siteEditor.do': { cs: 'Do', en: 'To' },
  'siteEditor.uhel': { cs: 'Úhel', en: 'Angle' },

  /* Tabule ve studiu (dotykový displej). Názvy událostí, herců, zvukařů
   * a druhů práce zůstávají tak, jak přijdou z kalendáře - jsou to data
   * (pravidlo 4). */
  'tabule.polozka.kava': { cs: 'Káva', en: 'Coffee' },
  'tabule.polozka.toaletak': { cs: 'Toaletní papír', en: 'Toilet roll' },
  'tabule.polozka.kapesniky': { cs: 'Kapesníky', en: 'Tissues' },
  'tabule.polozka.voda': { cs: 'Voda', en: 'Water' },
  'tabule.polozka.mleko': { cs: 'Mléko', en: 'Milk' },
  'tabule.polozka.caj': { cs: 'Čaj', en: 'Tea' },
  'tabule.polozka.cukr': { cs: 'Cukr', en: 'Sugar' },
  'tabule.polozka.baterie': { cs: 'Baterie', en: 'Batteries' },
  'tabule.polozka.uklid': { cs: 'Úklid', en: 'Cleaning' },
  'tabule.zpetDoPortalu': { cs: '← Zpět do portálu', en: '← Back to the portal' },
  'tabule.bezSpojeni': {
    cs: '· bez spojení, zkouším znovu…',
    en: '· no connection, trying again…',
  },
  'tabule.pravecProbiha': { cs: 'PRÁVĚ PROBÍHÁ', en: 'NOW ON' },
  'tabule.zbyva': { cs: 'zbývá {kolik}', en: '{kolik} left' },
  'tabule.zaroven': { cs: 'ZÁROVEŇ', en: 'AT THE SAME TIME' },
  'tabule.zbyvaVelke': { cs: 'ZBÝVÁ {kolik}', en: '{kolik} LEFT' },
  'tabule.volneDo': { cs: 'STUDIO JE VOLNÉ DO {cas}', en: 'STUDIO IS FREE UNTIL {cas}' },
  'tabule.volneDnesUz': { cs: 'STUDIO JE DNES UŽ VOLNÉ', en: 'STUDIO IS FREE FOR THE REST OF TODAY' },
  'tabule.dalsiV': { cs: 'DALŠÍ V {cas} · ZA {kolik}', en: 'NEXT AT {cas} · IN {kolik}' },
  'tabule.zitraV': { cs: 'Zítra {cas}: {co}', en: 'Tomorrow {cas}: {co}' },
  'tabule.zitraNic': { cs: 'Zítra zatím nic naplánováno.', en: 'Nothing scheduled for tomorrow yet.' },
  'tabule.dnesVeStudiu': { cs: 'DNES VE STUDIU', en: 'TODAY IN THE STUDIO' },
  'tabule.dnesNic': {
    cs: 'Na dnešek není v kalendáři nic zapsané.',
    en: 'Nothing is in the calendar for today.',
  },
  'tabule.ted': { cs: 'TEĎ', en: 'NOW' },
  'tabule.herec': { cs: 'Herec:', en: 'Narrator:' },
  'tabule.zvukar': { cs: 'Zvukař:', en: 'Sound engineer:' },
  'tabule.servisTitle': { cs: 'Nahlásit, co ve studiu došlo', en: 'Report what the studio has run out of' },
  'tabule.servisPopisek': { cs: 'Servis studia', en: 'Studio supplies' },
  'tabule.servisPopisekChybi': { cs: 'Servis studia — chybí {pocet}', en: 'Studio supplies — {pocet} missing' },
  'tabule.coDoslo': { cs: 'Co ve studiu došlo?', en: 'What has the studio run out of?' },
  'tabule.coDosloUvod': {
    cs: 'Ťukněte na to, co chybí. Bára se to dozví hned. Až se to doplní, ťukněte znovu.',
    en: 'Tap whatever is missing. Bára will know right away. Tap again once it has been restocked.',
  },
  'tabule.zavritPanel': { cs: 'Zavřít servisní panel', en: 'Close the supplies panel' },
  'tabule.chybi': { cs: 'CHYBÍ', en: 'MISSING' },
  'tabule.dnesVolno': { cs: 'Dnes volno', en: 'Free today' },
  'tabule.mistniho': { cs: ' místního', en: ' local time' },
  'tabule.hodin': { cs: '{h} h {m} min', en: '{h} h {m} min' },
  'tabule.minut': { cs: '{m} min', en: '{m} min' },
  'tabule.nepovoleno': {
    cs: 'Tabule vám zatím nikdo nepovolil',
    en: 'Nobody has given you access to a studio board yet',
  },
  'tabule.nepovolenoUvod': {
    cs: 'Napište Mediaspace, které studio chcete vidět - přístup se zapíná na kartě uživatele.',
    en: 'Tell Mediaspace which studio you want to see — access is switched on in the user’s record.',
  },
  'tabule.kterouOtevrit': { cs: 'Kterou tabuli otevřít?', en: 'Which board should open?' },
  'tabule.bezStudia': { cs: 'Tabule nemá přiřazené studio', en: 'The board has no studio assigned' },
  'tabule.bezStudiaUvod': {
    cs: 'V portálu otevřete Administrace → Studia a u studia vytvořte účet tabule.',
    en: 'In the portal open Administration → Studios and create a board account for the studio.',
  },

  /* Správa rezervací pod kalendářem studia. Sekce /studio je celá anglická
   * (rozhodnutí 25. 9. 2026), takže se tady ukáže anglická strana - česká
   * zůstává zdrojem pravdy pro slovník. */
  'booking.spravaNadpis': { cs: 'Správa rezervací', en: 'Booking administration' },
  'booking.spravaNikdo': {
    cs: 'Zatím sem nemá přístup nikdo — pozvěte prvního klienta.',
    en: 'Nobody has access yet — invite your first customer.',
  },
  'booking.spravaKlientu.jeden': { cs: '{pocet} pozvaný klient', en: '{pocet} customer invited' },
  'booking.spravaKlientu.vic': { cs: '{pocet} pozvaných klientů', en: '{pocet} customers invited' },
  'booking.cenikStudiaOdkaz': { cs: 'Ceník studia →', en: 'Studio price list →' },
  'booking.nejkratsiRezervace': { cs: 'Nejkratší rezervace (min)', en: 'Shortest booking (min)' },
  'booking.dniDopredu': { cs: 'Dní dopředu (0 = bez limitu)', en: 'Days ahead (0 = no limit)' },
  'booking.emailPlaceholder': { cs: 'jméno@kapela.co.uk', en: 'name@band.co.uk' },
  'booking.jmenoNepovinne': { cs: 'Jméno (nepovinné)', en: 'Name (optional)' },
  'booking.poslatPozvanku': { cs: 'Poslat pozvánku', en: 'Send the invitation' },
  'booking.nastaveniNeulozeno': {
    cs: 'Nastavení se nepodařilo uložit.',
    en: 'The settings could not be saved.',
  },
  'booking.pozvankaNeodeslana': {
    cs: 'Pozvánku se nepodařilo odeslat.',
    en: 'The invitation could not be sent.',
  },
  'booking.pozvankaOdesla': { cs: 'Pozvánka odešla na {email}.', en: 'The invitation has gone to {email}.' },
  'booking.odkazRucne': { cs: 'Odkaz k předání ručně:', en: 'Link to pass on by hand:' },
  'booking.klientAktivni': { cs: 'aktivní', en: 'active' },
  'booking.klientCeka': { cs: 'čeká na nastavení hesla', en: 'waiting for a password to be set' },
  'booking.odebratPristup': { cs: 'Odebrat přístup', en: 'Remove access' },
  'booking.rezervaceVKalendari': {
    cs: 'Samotné rezervace se posouvají a ruší v Kalendáři — jsou to běžné události studia.',
    en: 'The bookings themselves are moved and cancelled in the Calendar — they are ordinary studio events.',
  },
  'booking.kartickaQr': {
    cs: 'Kartička s QR kódem k vytištění ↗',
    en: 'Printable QR code card ↗',
  },

  /* Honoráře herce. */
  'honorare.nadpis': { cs: 'Honoráře', en: 'Fees' },
  'honorare.vizSmlouvy': { cs: 'viz smlouvy', en: 'see the contracts' },
  'honorare.nula': { cs: '0 Kč', en: '0 Kč' },
  'honorare.navrhnuto': { cs: 'Navrhnuto', en: 'Proposed' },
  'honorare.navrhnutoPopis': {
    cs: 'Smlouva vám odešla a čeká na váš podpis.',
    en: 'The contract has gone out to you and is waiting for your signature.',
  },
  'honorare.odeslano': { cs: 'Odesláno', en: 'Sent' },
  'honorare.navrhnutoPrazdne': { cs: 'Nic nečeká na podpis.', en: 'Nothing is waiting to be signed.' },
  'honorare.ceka': { cs: 'Čeká na proplacení', en: 'Awaiting payment' },
  'honorare.cekaPopis': {
    cs: 'Smlouva je podepsaná, honorář vám pošleme do splatnosti.',
    en: 'The contract is signed; we will send the fee by the due date.',
  },
  'honorare.splatnost': { cs: 'Splatnost', en: 'Due' },
  'honorare.cekaPrazdne': { cs: 'Momentálně vám nic nedlužíme.', en: 'We do not owe you anything at the moment.' },
  'honorare.zaplaceno': { cs: 'Zaplaceno', en: 'Paid' },
  'honorare.zaplacenoPopis': {
    cs: 'Honoráře, které už odešly na váš účet.',
    en: 'Fees that have already gone to your account.',
  },
  'honorare.zaplacenoPrazdne': { cs: 'Zatím tu nic není.', en: 'There is nothing here yet.' },
  'honorare.pocetSmluv.jedna': { cs: '1 smlouva', en: '1 contract' },
  'honorare.pocetSmluv.nekolik': { cs: '{pocet} smlouvy', en: '{pocet} contracts' },
  'honorare.pocetSmluv.mnoho': { cs: '{pocet} smluv', en: '{pocet} contracts' },
  'honorare.smlouvaCislo': { cs: 'Smlouva {cislo}', en: 'Contract {cislo}' },
  'honorare.datumSPopisem': { cs: '{popis} {datum}', en: '{popis} {datum}' },
  'honorare.podepsat': { cs: 'Podepsat', en: 'Sign' },
  'honorare.smlouvaOdkaz': { cs: 'Smlouva ↗', en: 'Contract ↗' },

  /* Pozvánky herců. */
  'pozvanky.nadpis': { cs: 'Pozvánky herců', en: 'Narrator invitations' },
  'pozvanky.uvod': {
    cs: 'Pošlete herci e-mail a zbytek si vyplní sám — jméno, adresu, číslo účtu, kde může natáčet a jestli je plátce DPH.',
    en: 'Send the narrator an e-mail and they fill in the rest themselves — name, address, account number, where they can record and whether they are VAT registered.',
  },
  'pozvanky.rozdelane': { cs: 'Rozdělané pozvánky', en: 'Invitations in progress' },
  'pozvanky.rozdelanePopis': {
    cs: 'Kdo si ještě nenastavil heslo nebo nedoplnil údaje. Jakmile to dokončí, ze seznamu zmizí.',
    en: 'Who has not set a password or filled in their details yet. They drop off the list as soon as they finish.',
  },
  'pozvanky.nicNevisi': {
    cs: 'Nic nevisí — všichni pozvaní herci jsou hotoví.',
    en: 'Nothing outstanding — every invited narrator is done.',
  },
  'pozvanky.cekaHeslo': { cs: 'Čeká na nastavení hesla', en: 'Waiting for a password to be set' },
  'pozvanky.cekaUdaje': { cs: 'Čeká na doplnění údajů', en: 'Waiting for details to be filled in' },
  'pozvanky.pozvano': { cs: 'pozváno {datum}', en: 'invited {datum}' },

  /* Nápověda - seznam návodů a jeden návod. Název, kategorie i text návodu
   * jsou obsah z databáze (pravidlo 4) a zůstávají, jak je někdo napsal. */
  'napoveda.uvod': {
    cs: 'Návody k portálu. Hledá se v celém textu — stačí slovo, které si pamatujete.',
    en: 'Guides to the portal. The search covers the whole text — a word you remember is enough.',
  },
  'napoveda.spravovat': { cs: 'Spravovat návody', en: 'Manage the guides' },
  'napoveda.hledat': { cs: 'Hledat v návodech…', en: 'Search the guides…' },
  'napoveda.zadnyNavod': { cs: 'Zatím tu žádný návod není.', en: 'There is no guide here yet.' },
  'napoveda.prvniPridate': {
    cs: ' První přidáte přes „Spravovat návody".',
    en: ' You add the first one through „Manage the guides".',
  },
  'napoveda.nicNeodpovida': {
    cs: 'Nic neodpovídá. Zkuste jedno slovo místo celé věty.',
    en: 'Nothing matches. Try a single word instead of a whole sentence.',
  },
  'napoveda.rozepsane': { cs: 'rozepsané', en: 'draft' },
  'napoveda.zpet': { cs: '← Nápověda', en: '← Help' },
  'napoveda.upraveno': { cs: 'Upraveno {datum}', en: 'Updated {datum}' },
  'napoveda.rozepsaneNevidi': {
    cs: ' · rozepsané, ostatní ho nevidí',
    en: ' · a draft, nobody else can see it',
  },
  'napoveda.upravitNavod': { cs: 'Upravit návod', en: 'Edit the guide' },
  'napoveda.stahnoutPdf': { cs: 'Stáhnout PDF', en: 'Download the PDF' },
  'napoveda.stahnoutPdfTitle': {
    cs: 'Otevře tisk, kde zvolíte Uložit jako PDF',
    en: 'Opens the print dialogue, where you choose Save as PDF',
  },

  /* Návod k instalaci aplikace do telefonu (veřejná stránka). */
  'instalace.titulek': { cs: 'Nainstalovat do telefonu — MS Portal', en: 'Install on your phone — MS Portal' },
  'instalace.popisStranky': {
    cs: 'Jak si přidat MS Portal a MS Chat na plochu telefonu.',
    en: 'How to add MS Portal and MS Chat to your phone’s home screen.',
  },
  'instalace.nadpis': { cs: 'Nainstalovat do telefonu', en: 'Install on your phone' },
  'instalace.uvod': {
    cs: 'Namiřte na kód fotoaparát telefonu a otevřete adresu, která se nabídne. Pak už jen dva kroky podle návodu níž a aplikace vám přistane na ploše — s vlastní ikonou, na celou obrazovku, bez adresního řádku prohlížeče. Nic se nestahuje z App Storu ani z Google Play.',
    en: 'Point your phone’s camera at the code and open the address it offers. Then just two steps from the guide below and the app lands on your home screen — with its own icon, full screen, no browser address bar. Nothing is downloaded from the App Store or Google Play.',
  },
  'instalace.ucet': {
    cs: 'Aplikace se přihlašuje stejným účtem jako portál v prohlížeči. Kdo účet ještě nemá, ozve se nám a založíme mu ho — bez něj se dovnitř nedostane.',
    en: 'The app signs in with the same account as the portal in a browser. If you do not have an account yet, get in touch and we will set one up — without it you cannot get in.',
  },
  'instalace.otevritVProhlizeci': { cs: 'Otevřít v prohlížeči', en: 'Open in a browser' },
  'instalace.stahnoutQr': { cs: 'Stáhnout QR jako obrázek', en: 'Download the QR code as an image' },
  'instalace.iphone': { cs: 'iPhone a iPad', en: 'iPhone and iPad' },
  'instalace.iphoneKrok1': {
    cs: 'Kód načtěte fotoaparátem a stránku otevřete v Safari — v jiném prohlížeči to Apple nedovolí.',
    en: 'Scan the code with the camera and open the page in Safari — Apple will not allow it in another browser.',
  },
  'instalace.iphoneKrok2': {
    cs: 'Dole klepněte na ikonu sdílení (čtvereček se šipkou nahoru).',
    en: 'Tap the share icon at the bottom (a square with an arrow pointing up).',
  },
  'instalace.iphoneKrok3': {
    cs: 'Vyberte {tucne} a potvrďte Přidat.',
    en: 'Choose {tucne} and confirm with Add.',
  },
  'instalace.iphonePridatNaPlochu': { cs: 'Přidat na plochu', en: 'Add to Home Screen' },
  'instalace.iphonePozn': {
    cs: 'Upozornění na nové zprávy chodí na iPhonu jenom aplikaci přidané na plochu. Zvoneček proto zapínejte až v nainstalovaném MS Chatu, ne v Safari.',
    en: 'On an iPhone, alerts about new messages only reach an app added to the home screen. So switch the bell on inside the installed MS Chat, not in Safari.',
  },
  'instalace.android': { cs: 'Android', en: 'Android' },
  'instalace.androidKrok1': {
    cs: 'Kód načtěte fotoaparátem a stránku otevřete v Chromu.',
    en: 'Scan the code with the camera and open the page in Chrome.',
  },
  'instalace.androidKrok2': {
    cs: 'Vpravo nahoře klepněte na tři tečky.',
    en: 'Tap the three dots at the top right.',
  },
  'instalace.androidKrok3': {
    cs: 'Vyberte {tucne} (někdy se nabídne rovnou jako pruh dole).',
    en: 'Choose {tucne} (sometimes it is offered straight away as a bar at the bottom).',
  },
  'instalace.androidNainstalovat': { cs: 'Nainstalovat aplikaci', en: 'Install app' },
  'instalace.androidPozn': {
    cs: 'Obě aplikace jdou nainstalovat vedle sebe. Každá má vlastní ikonu i název, takže se na ploše nepopletou.',
    en: 'Both apps can be installed side by side. Each has its own icon and name, so they will not be confused on the home screen.',
  },
  'instalace.neznamaAplikace': { cs: 'Neznámá aplikace.', en: 'Unknown app.' },
  'aplikace.portal.popis': {
    cs: 'Projekty, nahrávky, doklady, kalendáře — celý portál bez chatu.',
    en: 'Projects, recordings, documents, calendars — the whole portal without the chat.',
  },
  'aplikace.chat.popis': {
    cs: 'Jenom chat, na celou obrazovku, s upozorněním na nové zprávy.',
    en: 'Just the chat, full screen, with alerts for new messages.',
  },

  /* Nastavení a obnova hesla (veřejné stránky z odkazu v pozvánce). */
  'heslo.kratke': { cs: 'Heslo musí mít alespoň 8 znaků.', en: 'The password must be at least 8 characters long.' },
  'heslo.neshoda': { cs: 'Hesla se neshodují.', en: 'The passwords do not match.' },
  'heslo.nezdarilo': { cs: 'Nastavení hesla se nezdařilo.', en: 'The password could not be set.' },
  'heslo.neplatnyOdkaz': { cs: 'Neplatný odkaz', en: 'Invalid link' },
  'heslo.neplatnyOdkazText': {
    cs: 'V odkazu chybí ověřovací kód. Otevřete prosím odkaz z pozvánky znovu, nebo si u nás vyžádejte novou pozvánku.',
    en: 'The link is missing its verification code. Please open the link from the invitation again, or ask us for a new invitation.',
  },
  'heslo.nastaveno': { cs: 'Heslo je nastavené', en: 'Your password is set' },
  'heslo.prihlasujiVas': { cs: 'Přihlašuji vás do portálu…', en: 'Signing you in to the portal…' },
  'heslo.prihlasteSeNovym': { cs: 'Přihlaste se prosím novým heslem.', en: 'Please sign in with your new password.' },
  'heslo.prihlasitSe': { cs: 'Přihlásit se', en: 'Sign in' },
  'heslo.nastaveniNadpis': { cs: 'Nastavení hesla', en: 'Set your password' },
  'heslo.noveHeslo': { cs: 'Nové heslo', en: 'New password' },
  'heslo.alespon8': { cs: 'Alespoň 8 znaků.', en: 'At least 8 characters.' },
  'heslo.hesloZnovu': { cs: 'Heslo znovu', en: 'Password again' },
  'heslo.ukladam': { cs: 'Ukládám…', en: 'Saving…' },
  'heslo.nastavitHeslo': { cs: 'Nastavit heslo', en: 'Set the password' },
  'heslo.odkazOdeslan': {
    cs: 'Pokud účet s tímto e-mailem existuje, poslali jsme na něj odkaz pro nastavení nového hesla. Odkaz platí dvě hodiny.',
    en: 'If an account with this e-mail address exists, we have sent it a link to set a new password. The link is valid for two hours.',
  },
  'heslo.zpetNaPrihlaseni': { cs: 'Zpět na přihlášení', en: 'Back to sign in' },
  'heslo.zapomenuteNadpis': { cs: 'Zapomenuté heslo', en: 'Forgotten password' },
  'heslo.zapomenuteUvod': {
    cs: 'Zadejte e-mail, kterým se přihlašujete. Pošleme vám odkaz pro nastavení nového hesla.',
    en: 'Enter the e-mail address you sign in with. We will send you a link to set a new password.',
  },
  'heslo.odesilam': { cs: 'Odesílám…', en: 'Sending…' },
  'heslo.poslatOdkaz': { cs: 'Poslat odkaz', en: 'Send the link' },

  /* Formulář údajů z odkazu (veřejný). */
  'udaje.odkazNeplati': { cs: 'Odkaz už neplatí', en: 'The link is no longer valid' },
  'udaje.odkazNeplatiText': {
    cs: 'Buď jste ho už vyplnil, nebo mu vypršela platnost. Napište nám prosím a pošleme vám nový.',
    en: 'Either you have already filled it in, or it has expired. Please get in touch and we will send you a new one.',
  },
  'udaje.mameTo': { cs: 'Máme to, děkujeme', en: 'Got it, thank you' },
  'udaje.mameToText': {
    cs: 'Údaje jsme od vás dostali. Kdyby se něco změnilo, stačí nám napsat.',
    en: 'We have received your details. If anything changes, just let us know.',
  },

  /* Připomínkování spotu z odkazu (veřejné). */
  'pripominkovat.titulek': { cs: 'Připomínkování spotu', en: 'Advert feedback' },
  'pripominkovat.odkazNeplati': { cs: 'Odkaz už neplatí', en: 'The link is no longer valid' },
  'pripominkovat.odkazNeplatiText': {
    cs: 'Tenhle odkaz byl uzavřený nebo nahrazený novým. Napište nám a pošleme vám aktuální.',
    en: 'This link has been closed or replaced with a new one. Get in touch and we will send you the current one.',
  },
  'pripominkovat.nicKPoslechu': { cs: 'Zatím tu není co poslouchat', en: 'There is nothing to listen to yet' },
  'pripominkovat.nicKPoslechuText': {
    cs: 'Ve složce projektu není žádný spot ani video. Jakmile tam něco přibude, otevřete odkaz znovu.',
    en: 'There is no advert or video in the project folder. As soon as something is added, open the link again.',
  },

  'heslo.zkontrolujteEmail': { cs: 'Zkontrolujte e-mail', en: 'Check your e-mail' },
  'heslo.email': { cs: 'E-mail', en: 'E-mail' },

  'pripominkovat.odkazNefunguje': { cs: 'Odkaz nefunguje', en: 'The link does not work' },

  /* Připomínkování spotu - přehrávač a zápis připomínek (VideoTagger). */
  'pripominkovat.hlavicka': { cs: 'PŘIPOMÍNKOVÁNÍ SPOTU', en: 'ADVERT FEEDBACK' },
  'pripominkovat.neulozeno': {
    cs: 'Připomínku se nepodařilo uložit.',
    en: 'The note could not be saved.',
  },
  'pripominkovat.nesmazano': { cs: 'Smazání se nezdařilo.', en: 'The deletion failed.' },
  'pripominkovat.neodeslano': { cs: 'Odeslání se nezdařilo.', en: 'Sending failed.' },
  'pripominkovat.zadnySpot': {
    cs: 'Ve složce projektu zatím není žádný spot k poslechu.',
    en: 'There is no advert to listen to in the project folder yet.',
  },
  'pripominkovat.pozastavit': { cs: 'Pozastavit', en: 'Pause' },
  'pripominkovat.prehrat': { cs: 'Přehrát', en: 'Play' },
  'pripominkovat.oPetZpet': { cs: 'O pět vteřin zpět', en: 'Back five seconds' },
  'pripominkovat.oznacitMisto': { cs: 'Označit místo ({cas})', en: 'Mark this spot ({cas})' },
  'pripominkovat.napovedaNadpis': { cs: 'Připomínky ke spotu', en: 'Notes on the advert' },
  'pripominkovat.spotyVeSlozce': { cs: 'Spoty ve složce', en: 'Adverts in the folder' },
  'pripominkovat.novaPripominka': { cs: 'Nová připomínka', en: 'New note' },
  'pripominkovat.placeholder': { cs: 'Co je potřeba upravit?', en: 'What needs changing?' },
  'pripominkovat.zapisuji': { cs: 'Zapisuji…', en: 'Saving…' },
  'pripominkovat.zapsatKCasu': { cs: 'Zapsat k času', en: 'Note it at this time' },
  'pripominkovat.pripominky': { cs: 'Připomínky', en: 'Notes' },
  'pripominkovat.zatimZadne': { cs: 'zatím žádné', en: 'none yet' },
  'pripominkovat.celkem': { cs: '{pocet} celkem', en: '{pocet} in total' },
  'pripominkovat.navodPrazdne': {
    cs: 'Pusťte si spot a v místě, kde něco drhne, dejte „Označit místo".',
    en: 'Play the advert and, wherever something grates, tap „Mark this spot".',
  },
  'pripominkovat.prehratOdMista': { cs: 'Přehrát od tohohle místa', en: 'Play from this point' },
  'pripominkovat.zatimNeodeslano': { cs: 'zatím neodesláno', en: 'not sent yet' },
  'pripominkovat.vratitMezi': { cs: 'Vrátit mezi otevřené', en: 'Put back among the open ones' },
  'pripominkovat.oznacitVyrizene': { cs: 'Označit jako vyřízené', en: 'Mark as dealt with' },
  'pripominkovat.vratit': { cs: 'Vrátit', en: 'Reopen' },
  'pripominkovat.hotovo': { cs: 'Hotovo', en: 'Done' },
  'pripominkovat.smazat': { cs: 'Smazat připomínku', en: 'Delete the note' },
  'pripominkovat.odesilam': { cs: 'Odesílám…', en: 'Sending…' },
  'pripominkovat.odeslatPripominky': { cs: 'Odeslat připomínky ({pocet})', en: 'Send the notes ({pocet})' },
  'pripominkovat.vseOdeslano': { cs: 'Vše odesláno', en: 'Everything sent' },
  'pripominkovat.naposledyOdeslano': { cs: 'Naposledy odesláno', en: 'Last sent' },
  'pripominkovat.odesilaSeTo': {
    cs: 'Odesílá se to, co je zapsané u tohohle spotu.',
    en: 'What gets sent is whatever is noted on this advert.',
  },
  'pripominkovat.kreslimKrivku': { cs: 'kreslím křivku…', en: 'drawing the waveform…' },
  'pripominkovat.krivkaChyba': {
    cs: 'křivku se nepodařilo vykreslit — čas se bere z přehrávače',
    en: 'the waveform could not be drawn — the time comes from the player',
  },

  /* Veřejný formulář údajů z odkazu (herec / firma). Popisky polí se berou
   * přes popisekPole() z dávky 7c, podle klíče pole. */
  'formularUdaju.icOsmCislic': { cs: 'IČ má osm číslic.', en: 'A company number has eight digits.' },
  'formularUdaju.registrChyba': { cs: 'Registr se nepodařilo zeptat.', en: 'The register could not be queried.' },
  'formularUdaju.vyplnteJmeno': { cs: 'Vyplňte prosím jméno.', en: 'Please fill in your name.' },
  'formularUdaju.vyplnteNazev': { cs: 'Vyplňte prosím název firmy.', en: 'Please fill in the company name.' },
  'formularUdaju.vyplnteEmail': {
    cs: 'Vyplňte prosím e-mail — bez něj vám nemáme kam odpovědět.',
    en: 'Please fill in an e-mail address — without it we have nowhere to reply.',
  },
  'formularUdaju.neodeslano': {
    cs: 'Odeslání se nepodařilo. Zkuste to prosím znovu.',
    en: 'Sending failed. Please try again.',
  },
  'formularUdaju.dekujeme': { cs: 'Děkujeme, máme to', en: 'Thank you, we have it' },
  'formularUdaju.dekujemeText': {
    cs: 'Údaje jsme dostali. Kdyby k nim bylo potřeba cokoliv doplnit, ozveme se.',
    en: 'We have received your details. If anything needs adding, we will be in touch.',
  },
  'formularUdaju.udajeHerce': { cs: 'Údaje herce', en: 'Narrator details' },
  'formularUdaju.fakturacniUdaje': { cs: 'Fakturační údaje', en: 'Invoicing details' },
  'formularUdaju.nadpis': { cs: 'Vyplňte prosím své údaje', en: 'Please fill in your details' },
  'formularUdaju.uvodHerec': {
    cs: 'Potřebujeme je do smlouvy a k výplatě honoráře. Přihlašovat se nemusíte.',
    en: 'We need them for the contract and to pay your fee. You do not need to sign in.',
  },
  'formularUdaju.uvodFirma': {
    cs: 'Stačí zadat IČ a zbytek se doplní z obchodního rejstříku. Přihlašovat se nemusíte.',
    en: 'Just enter the company number and the rest is filled in from the companies register. You do not need to sign in.',
  },
  'formularUdaju.nacistZRejstriku': { cs: 'Načíst z rejstříku', en: 'Load from the register' },
  'formularUdaju.icPlaceholder': { cs: 'IČ (8 číslic)', en: 'Company number (8 digits)' },
  'formularUdaju.hledam': { cs: 'Hledám…', en: 'Searching…' },
  'formularUdaju.nacistZAresu': { cs: 'Načíst z ARESu', en: 'Load from ARES' },
  'formularUdaju.vzkaz': { cs: 'Vzkaz pro nás (nepovinné)', en: 'A message for us (optional)' },
  'formularUdaju.vzkazPlaceholder': {
    cs: 'Cokoliv, co bychom měli vědět.',
    en: 'Anything we ought to know.',
  },
  'formularUdaju.gdpr': {
    cs: 'Údaje použijeme jen k uzavření smlouvy, vyplacení honoráře a k plnění zákonných povinností. Nikomu dalšímu je nedáváme.',
    en: 'We use the details only to conclude the contract, pay the fee and meet our legal obligations. We do not pass them to anybody else.',
  },
  'formularUdaju.odesilam': { cs: 'Odesílám…', en: 'Sending…' },
  'formularUdaju.odeslatUdaje': { cs: 'Odeslat údaje', en: 'Send the details' },

  /* Doplnění údajů herce po nastavení hesla (průvodce v krocích). */
  'doplneni.jmenoNadpis': { cs: 'Vaše jméno a příjmení', en: 'Your first and last name' },
  'doplneni.jmenoPopis': { cs: 'Tak, jak má stát ve smlouvě.', en: 'As it should appear in the contract.' },
  'doplneni.jmenoPlaceholder': { cs: 'Jan Novák', en: 'John Smith' },
  'doplneni.jmenoChyba': { cs: 'Vyplňte prosím jméno a příjmení.', en: 'Please fill in your first and last name.' },
  'doplneni.adresaNadpis': { cs: 'Adresa trvalého bydliště', en: 'Permanent address' },
  'doplneni.adresaPopis': { cs: 'Patří do smlouvy.', en: 'It belongs in the contract.' },
  'doplneni.ulice': { cs: 'Ulice a č. p.', en: 'Street and number' },
  'doplneni.mesto': { cs: 'Město', en: 'Town or city' },
  'doplneni.psc': { cs: 'PSČ', en: 'Postcode' },
  'doplneni.zeme': { cs: 'Země', en: 'Country' },
  'doplneni.adresaChyba': { cs: 'Vyplňte prosím ulici a město.', en: 'Please fill in the street and the town.' },
  'doplneni.dphNadpis': { cs: 'Jste plátce DPH?', en: 'Are you VAT registered?' },
  'doplneni.dphPopis': {
    cs: 'Kdo je plátce, vystavuje nám pak fakturu s DPH.',
    en: 'If you are, you invoice us with VAT on it.',
  },
  'doplneni.nejsemPlatce': { cs: 'Nejsem plátce', en: 'Not registered' },
  'doplneni.jsemPlatce': { cs: 'Jsem plátce DPH', en: 'VAT registered' },
  'doplneni.cisloNadpis': { cs: 'Rodné číslo, nebo IČ', en: 'Personal ID number or company number' },
  'doplneni.cisloPopis': {
    cs: 'Vyberte, co nám dáte — stačí jedno z toho.',
    en: 'Choose which one you give us — one of them is enough.',
  },
  'doplneni.rodneCislo': { cs: 'Rodné číslo', en: 'Personal ID number' },
  'doplneni.rcChyba': { cs: 'Vyplňte prosím rodné číslo.', en: 'Please fill in your personal ID number.' },
  'doplneni.icChyba': { cs: 'Vyplňte prosím IČ.', en: 'Please fill in your company number.' },
  'doplneni.dicChyba': {
    cs: 'Jako plátce DPH vyplňte prosím i DIČ.',
    en: 'As you are VAT registered, please fill in your VAT number too.',
  },
  'doplneni.ucetNadpis': { cs: 'Kam vám posílat honorář?', en: 'Where should we send your fee?' },
  'doplneni.ucetPopis': { cs: 'Číslo účtu i s kódem banky.', en: 'The account number including the bank code.' },
  'doplneni.ucetChyba': { cs: 'Vyplňte prosím číslo účtu.', en: 'Please fill in the account number.' },
  'doplneni.mestaNadpis': { cs: 'Kde můžete natáčet?', en: 'Where can you record?' },
  'doplneni.mestaPopis': {
    cs: 'Zaškrtněte města, kam se dostanete. Dá se to kdykoliv změnit.',
    en: 'Tick the places you can get to. It can be changed at any time.',
  },
  'doplneni.souhrnJmeno': { cs: 'Jméno', en: 'Name' },
  'doplneni.souhrnDph': { cs: 'DPH', en: 'VAT' },
  'doplneni.souhrnPlatce': { cs: 'plátce, DIČ {dic}', en: 'registered, VAT number {dic}' },
  'doplneni.souhrnNeplatce': { cs: 'nejsem plátce', en: 'not registered' },
  'doplneni.souhrnIc': { cs: 'IČ', en: 'Company number' },
  'doplneni.souhrnUcet': { cs: 'Číslo účtu', en: 'Account number' },
  'doplneni.souhrnNataceni': { cs: 'Natáčení', en: 'Recording' },
  'doplneni.souhrnNevybrano': { cs: 'zatím nevybráno', en: 'nothing chosen yet' },
  'doplneni.neulozeno': {
    cs: 'Uložení se nepodařilo. Zkuste to prosím znovu.',
    en: 'Saving failed. Please try again.',
  },
  'doplneni.zpet': { cs: '← Zpět', en: '← Back' },
  'doplneni.ukladam': { cs: 'Ukládám…', en: 'Saving…' },
  'doplneni.hotovoDoPortalu': { cs: 'Hotovo, do portálu', en: 'Done, into the portal' },
  'doplneni.pokracovat': { cs: 'Pokračovat', en: 'Continue' },
  'doplneni.gdpr': {
    cs: 'Údaje použijeme jen k uzavření smlouvy, vyplacení honoráře a k plnění zákonných povinností. Nikomu dalšímu je nedáváme a kdykoliv si je změníte v Mém účtu.',
    en: 'We use the details only to conclude the contract, pay the fee and meet our legal obligations. We do not pass them to anybody else and you can change them at any time in My account.',
  },

  'doplneni.ic': { cs: 'IČ', en: 'Company number' },
  'doplneni.dic': { cs: 'DIČ', en: 'VAT number' },
  'doplneni.rekapitulace': { cs: 'Rekapitulace', en: 'Summary' },
  'doplneni.souhrnAdresa': { cs: 'Adresa', en: 'Address' },
  'doplneni.krokZe': { cs: 'Krok {krok} ze {celkem}', en: 'Step {krok} of {celkem}' },

  /* ---------------------------------------------------------------
   * DÁVKA 7e - kódy místo textů a poslední průchod.
   * ------------------------------------------------------------- */

  /* Stavy projektu. Do databáze se ukládá ČESKÝ NÁZEV (STAVY_PROJEKTU[].nazev)
   * a ten se nemění; překládá se jen zobrazení, podle KÓDU stavu. */
  'stav.V_PRIPRAVE': { cs: 'V přípravě', en: 'In preparation' },
  'stav.PLANUJEME': { cs: 'Plánujeme', en: 'Scheduling' },
  'stav.NATACIME': { cs: 'Natáčíme', en: 'Recording' },
  'stav.NATACIME_STRIHAME': { cs: 'Natáčíme/stříháme', en: 'Recording/editing' },
  'stav.DOTOCENO': { cs: 'Dotočeno', en: 'Recording finished' },
  'stav.DOTOCENO_STRIHAME': { cs: 'Dotočeno/stříháme', en: 'Recorded/editing' },
  'stav.DOKONCENO_KE_SCHVALENI': { cs: 'Dokončeno - ke schválení', en: 'Finished — for approval' },
  'stav.CEKAME_NA_OPRAVY': { cs: 'Čekáme na opravy', en: 'Awaiting corrections' },
  'stav.OPRAVUJEME': { cs: 'Opravujeme', en: 'Making corrections' },
  'stav.SCHVALENO_K_FAKTURACI': { cs: 'Schváleno - k fakturaci', en: 'Approved — to invoice' },
  'stav.VYFAKTUROVANO': { cs: 'Vyfakturováno', en: 'Invoiced' },
  'stavPopis.V_PRIPRAVE': {
    cs: 'Objednávka přišla, projekt je založený, ještě se neplánuje.',
    en: 'The order has arrived and the project exists, but nothing is being scheduled yet.',
  },
  'stavPopis.PLANUJEME': {
    cs: 'Cena je odsouhlasená, můžou se domlouvat termíny s herci.',
    en: 'The price is agreed; sessions can be arranged with the narrators.',
  },
  'stavPopis.NATACIME': { cs: 'S hercem je naplánováno.', en: 'Sessions with the narrator are booked.' },
  'stavPopis.NATACIME_STRIHAME': {
    cs: 'Ještě se natáčí a na disku už jsou první zpracované tracky k poslechu.',
    en: 'Recording is still going on and the first edited tracks are already on the drive.',
  },
  'stavPopis.DOTOCENO': {
    cs: 'S hercem dotočeno, na disku zatím není ani jeden track.',
    en: 'Recording with the narrator is done; there is not a single track on the drive yet.',
  },
  'stavPopis.DOTOCENO_STRIHAME': {
    cs: 'S hercem dotočeno a na disku už jsou první tracky.',
    en: 'Recording with the narrator is done and the first tracks are on the drive.',
  },
  'stavPopis.DOKONCENO_KE_SCHVALENI': {
    cs: 'Na disku jsou všechny tracky, čekáme na finální opravy od klienta.',
    en: 'Every track is on the drive; we are waiting for the customer’s final corrections.',
  },
  'stavPopis.CEKAME_NA_OPRAVY': {
    cs: 'Sedm dní po odevzdání klient opravy nedodal.',
    en: 'Seven days after delivery the customer has not sent any corrections.',
  },
  'stavPopis.OPRAVUJEME': {
    cs: 'Klient dokončil přeposlech, zapracováváme jeho připomínky. Klientovi odsud nic nechodí.',
    en: 'The customer has finished proof-listening and we are working their notes in. Nothing goes out to them from here.',
  },
  'stavPopis.SCHVALENO_K_FAKTURACI': {
    cs: 'Opravené nahrávky jsou na disku, čeká se na fakturu.',
    en: 'The corrected recordings are on the drive; the invoice is pending.',
  },
  'stavPopis.VYFAKTUROVANO': {
    cs: 'Faktura je u klienta — projekt je uzavřený.',
    en: 'The invoice is with the customer — the project is closed.',
  },
  'stav.klient.keSchvaleni': { cs: 'Ke schválení', en: 'For approval' },
  'stav.klient.dokonceno': { cs: 'Dokončeno', en: 'Finished' },

  /* Města, kde herec natáčí. Do databáze se ukládá český název (studioLocations),
   * překládá se podle kódu města. */
  'mesto.brno': { cs: 'Brno', en: 'Brno' },
  'mesto.praha': { cs: 'Praha', en: 'Prague' },
  'mesto.london': { cs: 'Londýn', en: 'London' },

  /* Jak se dva stavy jmenují v přehledu projektů (STATUS_LABEL_OVERRIDES). */
  'stav.prehled.SCHVALENO_K_FAKTURACI': { cs: 'Hotovo, fakturujeme', en: 'Done, invoicing' },
  'stav.prehled.VYFAKTUROVANO': { cs: 'Dokončeno', en: 'Finished' },
  'stav.prehoditStav': { cs: 'Přehodit stav projektu', en: 'Change the project status' },
  'stav.bezStavu': { cs: 'Bez stavu', en: 'No status' },
  'stav.neulozeno': { cs: 'Stav se nepodařilo uložit.', en: 'The status could not be saved.' },

  /* Opakování porady (MOZNOSTI_OPAKOVANI v lib/porady.ts) - podle KÓDU. */
  'opakovani.NE': { cs: 'Neopakovat', en: 'Do not repeat' },
  'opakovani.DENNE': { cs: 'Každý den', en: 'Every day' },
  'opakovani.PRACOVNI_DNY': { cs: 'Každý pracovní den (po–pá)', en: 'Every working day (Mon–Fri)' },
  'opakovani.TYDNE': { cs: 'Každý týden', en: 'Every week' },
  'opakovani.KAZDE_DVA_TYDNY': { cs: 'Každé dva týdny', en: 'Every two weeks' },
  'opakovani.MESICNE': { cs: 'Každý měsíc', en: 'Every month' },
  'porada.slovo.PORADA': { cs: 'porada', en: 'meeting' },
  'porada.slovo.SCHUZKA': { cs: 'schůzka', en: 'appointment' },

  /* Druhy nepřítomnosti (DRUHY_NEPRITOMNOSTI v lib/nepritomnost.ts). */
  'nepritomnost.druh.DOVOLENA': { cs: 'Dovolená', en: 'Holiday' },
  'nepritomnost.druh.MIMO_STUDIO': { cs: 'Mimo studio', en: 'Out of the studio' },
  'nepritomnost.druh.JINE': { cs: 'Jiné', en: 'Other' },
  'nepritomnost.druh.zaloha': { cs: 'Nepřítomnost', en: 'Absence' },

  /* Stavy nabídky termínů (RECORDING_STATUS_LABELS v lib/calendar.ts). */
  'nabidka.stav.DRAFT': { cs: 'Koncept', en: 'Draft' },
  'nabidka.stav.PREPARING': { cs: 'Nabídka se připravuje', en: 'The offer is being prepared' },
  'nabidka.stav.SENT': { cs: 'Nabídka odeslána herci', en: 'Offer sent to the narrator' },
  'nabidka.stav.PICKING': { cs: 'Herec vybírá termíny', en: 'The narrator is choosing sessions' },
  'nabidka.stav.SUBMITTED': { cs: 'Výběr čeká na schválení', en: 'The selection is awaiting approval' },
  'nabidka.stav.RETURNED': { cs: 'Vráceno k přepracování', en: 'Returned for reworking' },
  'nabidka.stav.REJECTED': { cs: 'Zamítnuto', en: 'Rejected' },
  'nabidka.stav.CONFIRMED': { cs: 'Potvrzeno', en: 'Confirmed' },

  'nabidka.stav.CANCELLED': { cs: 'Zrušeno', en: 'Cancelled' },
  'nabidka.stav.COMPLETED': { cs: 'Dokončeno', en: 'Completed' },

  /* --- Režim pro nevidomé v přeposlechu (dávka 7f) ---
     Hlášení pro čtečku obrazovky; věta je vždy jeden klíč (pravidlo 7). */
  'nevidomi.nadpis': { cs: 'Přeposlech: {projekt}', en: 'Proof-listening: {projekt}' },
  'nevidomi.navod': {
    cs: 'Režim pro nevidomé. Mezerník přehraje a pozastaví, šipky doleva a doprava posouvají o pět vteřin (se Shiftem o třicet), N a P přepínají stopu, Z zapíše připomínku, I ohlásí, kde jste.',
    en: 'Screen reader mode. The space bar plays and pauses, the left and right arrows move by five seconds (thirty with Shift), N and P switch tracks, Z writes a comment and I announces where you are.',
  },
  'nevidomi.zpet': { cs: 'Zpět do běžného zobrazení', en: 'Back to the standard view' },
  'nevidomi.cistNahlas': { cs: 'Číst hlášení nahlas', en: 'Read announcements aloud' },
  'nevidomi.vypnoutCteni': { cs: 'Vypnout čtení nahlas', en: 'Turn reading aloud off' },
  'nevidomi.cteniZapnuto': { cs: 'Čtení nahlas zapnuto.', en: 'Reading aloud is on.' },
  'nevidomi.cteniVypnuto': { cs: 'Čtení nahlas vypnuto.', en: 'Reading aloud is off.' },
  'nevidomi.nahravka': { cs: 'Nahrávka', en: 'Recording' },
  'nevidomi.nacitamStopy': { cs: 'Načítám stopy…', en: 'Loading tracks…' },
  'nevidomi.zadneNahravky': { cs: 'U projektu zatím nejsou žádné nahrávky.', en: 'There are no recordings for this project yet.' },
  'nevidomi.stav': {
    cs: 'Stopa {index} z {pocet}: {nazev}. Čas {cas} z {delka}.',
    en: 'Track {index} of {pocet}: {nazev}. Time {cas} of {delka}.',
  },
  'nevidomi.popisekPrehravace': { cs: 'Stopa {index} z {pocet}, {nazev}', en: 'Track {index} of {pocet}, {nazev}' },
  'nevidomi.prehrat': { cs: 'Přehrát', en: 'Play' },
  'nevidomi.pozastavit': { cs: 'Pozastavit', en: 'Pause' },
  'nevidomi.petZpet': { cs: 'O pět vteřin zpět', en: 'Five seconds back' },
  'nevidomi.petVpred': { cs: 'O pět vteřin vpřed', en: 'Five seconds forward' },
  'nevidomi.predchoziStopa': { cs: 'Předchozí stopa', en: 'Previous track' },
  'nevidomi.dalsiStopa': { cs: 'Další stopa', en: 'Next track' },
  'nevidomi.pomaleji': { cs: 'Pomaleji', en: 'Slower' },
  'nevidomi.rychleji': { cs: 'Rychleji ({rychlost}×)', en: 'Faster ({rychlost}×)' },
  'nevidomi.vybratStopu': { cs: 'Vybrat stopu', en: 'Choose a track' },
  'nevidomi.novaPripominka': { cs: 'Nová připomínka', en: 'New comment' },
  'nevidomi.ulozíSe': {
    cs: 'Uloží se k místu, kde právě stojíte: stopa {stopa}, čas {cas}.',
    en: 'It will be saved at the point you are at now: track {stopa}, time {cas}.',
  },
  'nevidomi.coJeSpatne': { cs: 'Co je špatně', en: 'What is wrong' },
  'nevidomi.ukladam': { cs: 'Ukládám…', en: 'Saving…' },
  'nevidomi.ulozit': { cs: 'Uložit připomínku', en: 'Save the comment' },
  'nevidomi.neboKlavesami': { cs: 'Nebo klávesami Ctrl a Enter.', en: 'Or press Ctrl and Enter.' },
  'nevidomi.zapsanePripominky': { cs: 'Zapsané připomínky ({pocet})', en: 'Comments written ({pocet})' },
  'nevidomi.zatimZadne': { cs: 'Zatím žádné.', en: 'None yet.' },
  'nevidomi.polozka': { cs: 'Stopa {stopa}, čas {cas}', en: 'Track {stopa}, time {cas}' },
  'nevidomi.zapsal': { cs: ' (zapsal {jmeno})', en: ' (written by {jmeno})' },
  'nevidomi.prejitNaMisto': { cs: 'Přejít na místo', en: 'Go to that point' },
  'nevidomi.textScenare': { cs: 'Text scénáře', en: 'Script text' },
  'nevidomi.neniText': { cs: 'U projektu není nahraný text.', en: 'No text has been uploaded for this project.' },
  'nevidomi.nacitamText': { cs: 'Načítám text…', en: 'Loading the text…' },
  'nevidomi.nacistText': { cs: 'Načíst text ke čtení', en: 'Load the text for reading' },
  'nevidomi.textNejdePrevest': {
    cs: 'Text se nepodařilo převést - bývá to u PDF, které je jen obrázek.',
    en: 'The text could not be extracted — that happens with a PDF that is just an image.',
  },
  'nevidomi.strana': { cs: 'Strana {cislo}', en: 'Page {cislo}' },
  /* Hlášení do živé oblasti. */
  'nevidomi.ohlasNacteno': {
    cs: 'Načteno {pocet} stop. Mezerníkem přehrajete, klávesou Z zapíšete připomínku.',
    en: 'Loaded {pocet} tracks. Press the space bar to play and Z to write a comment.',
  },
  'nevidomi.ohlasPrehravam': { cs: 'Přehrávám.', en: 'Playing.' },
  'nevidomi.ohlasPauza': { cs: 'Pauza na čase {cas}.', en: 'Paused at {cas}.' },
  'nevidomi.ohlasCas': { cs: 'Čas {cas}.', en: 'Time {cas}.' },
  'nevidomi.ohlasStopa': { cs: 'Stopa {index} z {pocet}. {nazev}', en: 'Track {index} of {pocet}. {nazev}' },
  'nevidomi.ohlasRychlost': { cs: 'Rychlost {rychlost}.', en: 'Speed {rychlost}.' },
  'nevidomi.ohlasUlozeno': {
    cs: 'Připomínka uložena. Stopa {stopa}, čas {cas}.',
    en: 'Comment saved. Track {stopa}, time {cas}.',
  },
  'nevidomi.ohlasZapiste': {
    cs: 'Zapište připomínku. Uložíte ji klávesami Ctrl a Enter.',
    en: 'Write your comment. Press Ctrl and Enter to save it.',
  },
  'nevidomi.ohlasKdeJsem': {
    cs: 'Stopa {stopa} z {pocet}, {nazev}, čas {cas} z {delka}. Zapsaných připomínek {pripominky}.',
    en: 'Track {stopa} of {pocet}, {nazev}, time {cas} of {delka}. Comments written: {pripominky}.',
  },
  'nevidomi.ohlasPresunuto': {
    cs: 'Přesunuto na stopu {stopa}, čas {cas}.',
    en: 'Moved to track {stopa}, time {cas}.',
  },
  'nevidomi.ohlasKonec': { cs: 'Konec poslední stopy.', en: 'End of the last track.' },
  'nevidomi.ohlasNacitamText': { cs: 'Načítám text scénáře.', en: 'Loading the script text.' },
  'nevidomi.ohlasTextNacten': { cs: 'Text načten, {pocet} stran.', en: 'Text loaded, {pocet} pages.' },
  'nevidomi.ohlasTextNejde': { cs: 'Text se nepodařilo načíst.', en: 'The text could not be loaded.' },
  'nevidomi.nahravkyNejdou': { cs: 'Nahrávky se nepodařilo načíst.', en: 'The recordings could not be loaded.' },
  'nevidomi.pripominkaNejde': { cs: 'Připomínku se nepodařilo uložit.', en: 'The comment could not be saved.' },
  /* Čas do řeči - „4 minuty 12 sekund" se čte líp než „4:12".
     Česká strana zůstává slovo za slovem, jak ji psal původní kód. */
  'nevidomi.casSekundy': { cs: '{v} sekund', en: '{v} seconds' },
  'nevidomi.casMinuty': { cs: '{m} minut {v} sekund', en: '{m} minutes {v} seconds' },
  /* Schovaný přepínač režimu (PrepinacRezimu). */
  'prepinac.doRezimu': { cs: 'Přepnout do režimu pro nevidomé', en: 'Switch to screen reader mode' },
  'prepinac.rezim': { cs: 'Režim pro nevidomé', en: 'Screen reader mode' },


  /* --- Natáčecí plán na detailu projektu (RecordingSection, dávka 7f) --- */
  'natacPlan.nadpis': { cs: 'Natáčecí plán', en: 'Recording plan' },
  /* Tři tvary čísla: česky 1-4 „frekvence" a od pěti „frekvencí",
     anglicky jednotné číslo jen u jedničky. */
  'natacPlan.normostranJedna': {
    cs: '{ns} normostran → {pocet} frekvence',
    en: '{ns} standard pages → {pocet} recording session',
  },
  'natacPlan.normostranMalo': {
    cs: '{ns} normostran → {pocet} frekvence',
    en: '{ns} standard pages → {pocet} recording sessions',
  },
  'natacPlan.normostranVic': {
    cs: '{ns} normostran → {pocet} frekvencí',
    en: '{ns} standard pages → {pocet} recording sessions',
  },
  'natacPlan.bezNormostran': {
    cs: 'Normostrany z Caflou nedorazily — počet frekvencí zadejte ručně.',
    en: 'The standard pages did not come through from Caflou — enter the number of sessions by hand.',
  },
  'natacPlan.hercPodleCaflou': { cs: ' · herec podle Caflou: {jmeno}', en: ' · narrator according to Caflou: {jmeno}' },
  'natacPlan.vytvorit': { cs: 'Vytvořit nabídku termínů', en: 'Create a session offer' },
  'natacPlan.odeslano': { cs: 'Nabídka termínů odešla herci e-mailem.', en: 'The session offer has been emailed to the narrator.' },
  'natacPlan.potvrzeno': { cs: '{pocet} potvrzeno', en: '{pocet} confirmed' },
  'natacPlan.vybrano': { cs: 'vybráno {pocet} z {potreba}', en: '{pocet} of {potreba} chosen' },
  'natacPlan.nabidnuto': { cs: 'nabídnuto {pocet} · potřeba {potreba}', en: '{pocet} offered · {potreba} needed' },
  'natacPlan.zadnaNabidka': { cs: 'K projektu zatím žádná nabídka termínů není.', en: 'There is no session offer for this project yet.' },
  'natacPlan.herec': { cs: 'Herec', en: 'Narrator' },
  'natacPlan.vyberteHerce': { cs: '— vyberte herce —', en: '— choose a narrator —' },
  'natacPlan.hercZapamatuje': {
    cs: 'Volba se u projektu zapamatuje — v Caflou je herec jen text.',
    en: 'The choice is remembered with the project — in Caflou the narrator is only text.',
  },
  'natacPlan.studia': { cs: 'Studia', en: 'Studios' },
  'natacPlan.studiaPopis': {
    cs: 'Herci se nabídnou volná místa ve všech zaškrtnutých studiích.',
    en: 'The narrator will be offered free slots in every studio ticked.',
  },
  'natacPlan.normostranyHerce': { cs: 'Normostrany pro tohoto herce', en: 'Standard pages for this narrator' },
  'natacPlan.pocetFrekvenci': { cs: 'Počet frekvencí', en: 'Number of sessions' },
  'natacPlan.prvniNejdrive': { cs: 'První frekvence nejdříve', en: 'Earliest first session' },
  'natacPlan.posledniNejpozdeji': { cs: 'Poslední frekvence nejpozději', en: 'Latest final session' },
  'natacPlan.dvaDnyPred': {
    cs: 'Dva dny před datem dokončení - ať stihneme odevzdat.',
    en: 'Two days before the completion date — so that we can still deliver on time.',
  },
  'natacPlan.bezDataDokonceni': {
    cs: 'Projekt nemá datum dokončení - zadejte ručně.',
    en: 'The project has no completion date — enter it by hand.',
  },
  'natacPlan.poznamkaProHerce': { cs: 'Poznámka pro herce', en: 'Note for the narrator' },
  'natacPlan.volnaMista': { cs: 'Volná místa k nabídnutí:', en: 'Free slots to offer:' },
  'natacPlan.hercVybere': { cs: ' · herec vybere {pocet}', en: ' · the narrator will choose {pocet}' },
  'natacPlan.pocitam': { cs: 'Počítám…', en: 'Working it out…' },
  'natacPlan.maloMist': {
    cs: 'Volných míst je méně, než herec potřebuje. Posuňte období nebo zaškrtněte další studio.',
    en: 'There are fewer free slots than the narrator needs. Move the period or tick another studio.',
  },
  'natacPlan.odesilam': { cs: 'Odesílám…', en: 'Sending…' },
  'natacPlan.odeslatHerci': { cs: 'Odeslat herci', en: 'Send to the narrator' },
  'natacPlan.zavrit': { cs: 'Zavřít', en: 'Close' },
  'natacPlan.nejdeOdeslat': {
    cs: '{chyba} Nabídka je uložená v seznamu výše.',
    en: '{chyba} The offer is saved in the list above.',
  },
  'natacPlan.nejdeOdeslatZaloha': { cs: 'Nabídku se nepodařilo odeslat.', en: 'The offer could not be sent.' },
  'natacPlan.nejdeZalozit': { cs: 'Nabídku se nepodařilo založit.', en: 'The offer could not be created.' },


  /* --- Smlouvy od klienta na detailu projektu (dávka 7f) --- */
  'smlouvyKl.nadpis': { cs: 'Smlouvy od klienta', en: 'Contracts from the customer' },
  'smlouvyKl.jenPdf': { cs: 'Nahrát jde jen PDF.', en: 'Only a PDF can be uploaded.' },
  'smlouvyKl.nejdePripravit': { cs: 'Nahrání se nepodařilo připravit.', en: 'The upload could not be prepared.' },
  'smlouvyKl.nejdeDoUloziste': { cs: 'Soubor se nepodařilo nahrát do úložiště.', en: 'The file could not be uploaded to storage.' },
  'smlouvyKl.nejdeUlozit': { cs: 'Smlouvu se nepodařilo uložit.', en: 'The contract could not be saved.' },
  'smlouvyKl.nejdeNahrat': { cs: 'Nahrání se nepodařilo.', en: 'The upload failed.' },
  'smlouvyKl.ulozeno': {
    cs: 'Smlouva je uložená. Tlačítkem u ní dejte vědět, komu je potřeba.',
    en: 'The contract is saved. Use the button next to it to let the right person know.',
  },
  'smlouvyKl.nejdeZprava': { cs: 'Zprávu se nepodařilo poslat.', en: 'The message could not be sent.' },
  'smlouvyKl.brunoNapsal': { cs: 'Bruno napsal {komu} do chatu.', en: 'Bruno has written to {komu} in the chat.' },
  'smlouvyKl.odebratDotaz': { cs: 'Odebrat smlouvu z projektu?', en: 'Remove the contract from the project?' },
  'smlouvyKl.otevritPdf': { cs: 'Otevřít PDF', en: 'Open the PDF' },
  'smlouvyKl.podepsana': { cs: 'podepsaná {datum} · ', en: 'signed {datum} · ' },
  'smlouvyKl.nahral': { cs: 'nahrál(a) {jmeno} {datum}', en: 'uploaded by {jmeno} on {datum}' },
  'smlouvyKl.stahnout': { cs: 'Stáhnout', en: 'Download' },
  'smlouvyKl.daloVedet': { cs: 'Bruno dal vědět {datum}', en: 'Bruno let them know on {datum}' },
  'smlouvyKl.kdoVi': { cs: '{jmeno} ví', en: '{jmeno} knows' },
  'smlouvyKl.oznameno': { cs: 'Oznámeno', en: 'Announced' },
  'smlouvyKl.poslat': { cs: 'Poslat', en: 'Send' },
  'smlouvyKl.bublinaBruno': {
    cs: 'Bruno napíše {jmeno} soukromě do chatu, že je tu podepsaná smlouva',
    en: 'Bruno will message {jmeno} privately in the chat that a signed contract is here',
  },
  'smlouvyKl.bublinaNikdo': {
    cs: 'Bára Šiblová v portálu není - vyberte, komu napsat',
    en: 'Bára Šiblová is not in the portal — choose who to write to',
  },
  'smlouvyKl.posilam': { cs: 'Posílám…', en: 'Sending…' },
  'smlouvyKl.datVedet': { cs: '🤖 Dát vědět {komu}', en: '🤖 Let {komu} know' },
  'smlouvyKl.znovuDatVedet': { cs: '🤖 Znovu dát vědět {komu}', en: '🤖 Let {komu} know again' },
  'smlouvyKl.jinemu': { cs: 'Poslat někomu jinému', en: 'Send to someone else' },
  'smlouvyKl.odebrat': { cs: 'Odebrat', en: 'Remove' },
  'smlouvyKl.souborKb': { cs: '{nazev} · {kb} kB', en: '{nazev} · {kb} kB' },
  'smlouvyKl.nazev': { cs: 'Název', en: 'Name' },
  'smlouvyKl.podepsanaDne': { cs: 'Podepsaná dne', en: 'Signed on' },
  'smlouvyKl.nepovinne': { cs: '· nepovinné', en: '· optional' },
  'smlouvyKl.nahravam': { cs: 'Nahrávám…', en: 'Uploading…' },
  'smlouvyKl.ulozitSmlouvu': { cs: 'Uložit smlouvu', en: 'Save the contract' },
  'smlouvyKl.zrusit': { cs: 'Zrušit', en: 'Cancel' },
  'smlouvyKl.pretahnete': {
    cs: '+ Nahrát podepsanou smlouvu od klienta (PDF) — nebo ji sem přetáhněte',
    en: '+ Upload a signed contract from the customer (PDF) — or drag it here',
  },


  /* --- Progres natáčení na detailu projektu (dávka 7f) --- */
  'progresKarta.nadpis': { cs: 'Progres natáčení', en: 'Recording progress' },
  'progresKarta.zNormostran': {
    cs: 'Počítáno z {stran} normostran — ve složce projektu není PDF s textem (název končí _RE), tak se bere rozsah projektu',
    en: 'Worked out from {stran} standard pages — there is no PDF with the text in the project folder (the name ends in _RE), so the project length is used',
  },
  /* Tvar čísla: česky „stranu / strany / stran", anglicky jen dva tvary. */
  'progresKarta.textMaJednu': { cs: 'Text má {stran} stranu (PDF ve složce projektu)', en: 'The text has {stran} page (PDF in the project folder)' },
  'progresKarta.textMaMalo': { cs: 'Text má {stran} strany (PDF ve složce projektu)', en: 'The text has {stran} pages (PDF in the project folder)' },
  'progresKarta.textMaVic': { cs: 'Text má {stran} stran (PDF ve složce projektu)', en: 'The text has {stran} pages (PDF in the project folder)' },
  'progresKarta.bezCehoPocitat': {
    cs: 'Ve složce projektu není PDF s textem ani zadané normostrany — není proti čemu počítat',
    en: 'There is neither a PDF with the text nor a page count in the project folder — there is nothing to measure against',
  },
  'progresKarta.koeficientPred': {
    cs: 'Koeficient téhle knihy: {ns} normostran ÷ {stran} stran textu = ',
    en: 'This book’s ratio: {ns} standard pages ÷ {stran} text pages = ',
  },
  'progresKarta.koeficientZa': {
    cs: ' normostrany na stranu textu. Z něj se dopočítává, kolik normostran komu ještě zbývá.',
    en: ' standard pages per text page. It is what the remaining standard pages per narrator are worked out from.',
  },
  'progresKarta.nedaSpocitat': {
    cs: 'Zatím se nedá spočítat - chybí text nebo zápis strany.',
    en: 'It cannot be worked out yet — the text or a page entry is missing.',
  },
  'progresKarta.bezZapisu': { cs: 'zatím bez zápisu', en: 'no entry yet' },
  'progresKarta.zbyvaPred': { cs: 'zbývá natočit ≈ ', en: 'still to record ≈ ' },
  'progresKarta.zbyvaNs': { cs: '{pocet} normostran', en: '{pocet} standard pages' },
  'progresKarta.zbyvaZa': { cs: ' z jeho {celkem}', en: ' of their {celkem}' },
  'progresKarta.bezNormostran': {
    cs: 'Bez normostran: {jmena}. Bez rozsahu se nedá spočítat, kolik komu zbývá natočit, a projekt se místo váženého součtu počítá jako průměr herců. Doplňte rozsah u herce níž ve Výrobě.',
    en: 'No standard pages: {jmena}. Without a page count we cannot work out how much each has left to record, and the project is averaged across the narrators instead of weighted. Fill the page count in for the narrator under Production below.',
  },
  'progresKarta.nesoulad': {
    cs: 'Normostrany herců dávají dohromady {soucet}, ale kniha má {kniha}. Jedno z těch čísel je špatně — poměr mezi herci sedí dál, ale zbývající normostrany podle toho nebudou přesné.',
    en: 'The narrators’ standard pages add up to {soucet}, but the book has {kniha}. One of those numbers is wrong — the ratio between the narrators still holds, but the remaining standard pages will not be exact.',
  },
  'progresKarta.zalohaHerce': { cs: 'herec', en: 'narrator' },

  /* --- Technické parametry na detailu projektu (dávka 7f) --- */
  'technKarta.obecnaSada': { cs: 'obecná sada — firma vlastní nemá', en: 'general set — the company has none of its own' },
  'technKarta.podleKlienta': { cs: 'podle klienta {firma}', en: 'according to customer {firma}' },
  'technKarta.podleKlientaBez': { cs: 'podle klienta', en: 'according to the customer' },
  'technKarta.upravitSady': { cs: 'Upravit sady', en: 'Edit the sets' },
  'technKarta.vedouSeUFirem': {
    cs: 'Parametry se vedou jako sady u firem a mění se v Administraci — změna platí pro všechny projekty té firmy naráz.',
    en: 'The parameters are kept as sets against companies and changed in the administration — a change applies to all of that company’s projects at once.',
  },

  /* --- Historie projektu (dávka 7f) --- */
  'historie.prazdno': {
    cs: 'Zatím se u projektu nic nezměnilo. Historie se začala zapisovat 10. 9. 2026 — co se dělo dřív, tady nenajdete.',
    en: 'Nothing has changed on this project yet. The history started being recorded on 10/09/2026 — anything earlier is not here.',
  },
  'historie.kdy': { cs: 'Kdy', en: 'When' },
  'historie.co': { cs: 'Co', en: 'What' },
  'historie.zmena': { cs: 'Změna', en: 'Change' },
  'historie.kdo': { cs: 'Kdo', en: 'Who' },
  'historie.portal': { cs: 'portál', en: 'the portal' },
  'projekt.zalohaHerce': { cs: 'Herec', en: 'Narrator' },
  /* Druhy událostí v historii (POPISKY_DRUHU v lib/projektLog.ts) - podle KÓDU. */
  'historie.druh.ZALOZENO': { cs: 'Založení', en: 'Created' },
  'historie.druh.ZMENA': { cs: 'Změna', en: 'Change' },
  'historie.druh.NOTIFIKACE': { cs: 'Zpráva', en: 'Message' },
  'historie.druh.BRUNO': { cs: 'Bruno', en: 'Bruno' },

  /* --- Poslech bez signálu (NaCestu, dávka 7f) --- */
  'naCestu.offline': { cs: 'Offline', en: 'Offline' },
  'naCestu.offlineCeka': { cs: 'Offline · {pocet} čeká', en: 'Offline · {pocet} waiting' },
  'naCestu.stahuji': { cs: 'Stahuji {hotovo}/{celkem}', en: 'Downloading {hotovo}/{celkem}' },
  'naCestu.stazeno': { cs: '✓ Poslouchat offline', en: '✓ Listen offline' },
  'naCestu.stahnoutStitek': { cs: '⬇ Poslouchat offline', en: '⬇ Listen offline' },
  'naCestu.bublina': {
    cs: 'Stáhnout nahrávky a text do počítače a pracovat bez signálu',
    en: 'Download the recordings and the text to this computer and work with no signal',
  },
  'naCestu.cekaZa': { cs: ' · {pocet} čeká', en: ' · {pocet} waiting' },
  'naCestu.nadpis': { cs: 'Poslech bez signálu', en: 'Listening with no signal' },
  'naCestu.zavrit': { cs: 'Zavřít', en: 'Close' },
  'naCestu.uvod': {
    cs: 'Než budete mimo signál, stáhněte si nahrávky a text do tohoto prohlížeče. Pak jde poslouchat, číst i psát poznámky offline — odešlou se samy, jakmile bude signál zpátky.',
    en: 'Before you are out of signal, download the recordings and the text into this browser. You can then listen, read and write notes offline — they will be sent on their own as soon as the signal is back.',
  },
  'naCestu.nicKeStazeni': { cs: 'Zatím tu není nic ke stažení.', en: 'There is nothing to download yet.' },
  'naCestu.vseStazene': { cs: '✓ Všechno je stažené ({pocet} souborů).', en: '✓ Everything is downloaded ({pocet} files).' },
  'naCestu.keStazeni': { cs: 'Ke stažení: {zbyva} z {celkem} souborů', en: 'To download: {zbyva} of {celkem} files' },
  'naCestu.asiVelikost': { cs: ' · asi {velikost}', en: ' · about {velikost}' },
  'naCestu.prubeh': {
    cs: 'Stahuji {hotovo} z {celkem}… nechte okno otevřené.',
    en: 'Downloading {hotovo} of {celkem}… leave this window open.',
  },
  'naCestu.jsteOffline': { cs: 'Jste offline. ', en: 'You are offline. ' },
  'naCestu.zapisyCekaji': {
    cs: '{pocet} zápisů čeká a odejde samo se signálem.',
    en: '{pocet} entries are waiting and will be sent once the signal is back.',
  },
  'naCestu.vseUlozeno': { cs: 'Všechno máte uložené.', en: 'Everything is saved.' },
  'naCestu.odeslatCekajici': { cs: 'Odeslat {pocet} čekajících zápisů', en: 'Send {pocet} waiting entries' },
  'naCestu.stahnoutZbytek': { cs: 'Stáhnout zbytek', en: 'Download the rest' },
  'naCestu.stahnoutProOffline': { cs: 'Stáhnout pro offline', en: 'Download for offline use' },
  'naCestu.stahnoutProOfflineVel': { cs: 'Stáhnout pro offline ({velikost})', en: 'Download for offline use ({velikost})' },
  'naCestu.opravduSmazat': { cs: 'Opravdu smazat z počítače?', en: 'Really delete from this computer?' },
  'naCestu.smazatZPocitace': { cs: 'Smazat z počítače', en: 'Delete from this computer' },
  'naCestu.nepovedlo': { cs: 'Stažení se nepovedlo.', en: 'The download failed.' },
  'naCestu.tip': {
    cs: 'Tip: odkaz si otevřete ještě se signálem a pak ho už nezavírejte. Když přibudou nové stopy, stáhněte zbytek znovu.',
    en: 'Tip: open the link while you still have signal and then leave it open. When new tracks are added, download the rest again.',
  },


  /* --- Odkaz pro klienta na detailu projektu (dávka 7f) --- */
  'odkazKl.nadpis': { cs: 'Odkaz pro klienta', en: 'Link for the customer' },
  'odkazKl.otevreno': {
    cs: ' · otevřeno {pocet}×, naposledy {datum}',
    en: ' · opened {pocet}×, last on {datum}',
  },
  'odkazKl.neotevreny': { cs: ' · zatím neotevřený', en: ' · not opened yet' },
  'odkazKl.zadny': {
    cs: 'Zatím žádný. Pošle se sám ve zprávě o prvních tracích, nebo ho vyrobte tady.',
    en: 'None yet. It goes out on its own with the message about the first tracks, or you can make one here.',
  },
  'odkazKl.zkopirovano': { cs: 'Zkopírováno', en: 'Copied' },
  'odkazKl.kopirovat': { cs: 'Kopírovat', en: 'Copy' },
  'odkazKl.novy': { cs: 'Vygenerovat nový', en: 'Generate a new one' },
  'odkazKl.vyrobit': { cs: 'Vyrobit odkaz', en: 'Make a link' },
  'odkazKl.zavrit': { cs: 'Zavřít', en: 'Close' },
  'odkazKl.opravduZavrit': { cs: 'Opravdu zavřít odkaz?', en: 'Really close the link?' },
  'odkazKl.nepovedlo': { cs: 'Nepodařilo se to.', en: 'It did not work.' },
  'odkazKl.bezSpojeni': { cs: 'Nepodařilo se spojit se serverem.', en: 'The server could not be reached.' },
  'odkazKl.kopirovaniNejde': {
    cs: 'Kopírování prohlížeč nepovolil — odkaz je vidět vedle, dá se označit ručně.',
    en: 'The browser would not allow copying — the link is shown next to it and can be selected by hand.',
  },

  /* --- Natáčecí protokol (dávka 7f) --- */
  'protokol.prazdny': {
    cs: 'Zatím prázdný. Strany sem zapisuje Bruno podle toho, co se napíše do chatu projektu — stačí číslo, třeba „str. 33".',
    en: 'Empty so far. Bruno writes the pages in here from what is said in the project chat — a number is enough, such as “p. 33”.',
  },
  'protokol.uvod': {
    cs: 'Kam se doteklo natáčení — zapisuje Bruno z chatu projektu, od nejnovějšího.',
    en: 'How far the recording has got — written in by Bruno from the project chat, newest first.',
  },
  'protokol.natacStrih': { cs: 'Natáčení/střih', en: 'Recording/editing' },
  'protokol.herec': { cs: 'Herec', en: 'Narrator' },
  'protokol.datum': { cs: 'Datum', en: 'Date' },
  'protokol.casZapisu': { cs: 'Čas zápisu', en: 'Time written' },
  'protokol.zapsal': { cs: 'Zapsal', en: 'Written by' },
  'protokol.strana': { cs: 'Strana', en: 'Page' },
  'protokol.ukon.nataceni': { cs: 'Natáčení', en: 'Recording' },

  /* --- Poznámky u projektu (dávka 7f) --- */
  'poznamky.nova': { cs: 'Nová poznámka', en: 'New note' },
  'poznamky.placeholder': { cs: 'Co je u téhle zakázky potřeba vědět…', en: 'What there is to know about this job…' },
  'poznamky.ukladam': { cs: 'Ukládám…', en: 'Saving…' },
  'poznamky.pridat': { cs: 'Přidat poznámku', en: 'Add the note' },
  'poznamky.kdoVidi': { cs: 'Vidí je jen Žůžo-labůžo a produkce.', en: 'Only Admin and production can see them.' },
  'poznamky.prazdno': {
    cs: 'Zatím tu nic není. Poznámka z objednávky se sem propíše sama, jakmile nějaká přijde.',
    en: 'Nothing here yet. A note from an order will appear here on its own as soon as one comes in.',
  },
  'poznamky.zObjednavky': { cs: 'Z objednávky', en: 'From the order' },
  'poznamky.smazat': { cs: 'Smazat', en: 'Delete' },
  'poznamky.nejdeUlozit': { cs: 'Poznámku se nepodařilo uložit.', en: 'The note could not be saved.' },
  'poznamky.nejdeSmazat': { cs: 'Poznámku se nepodařilo smazat.', en: 'The note could not be deleted.' },


  /* --- Čerpání po druzích práce na detailu projektu (dávka 7f) --- */
  'cerpani.nadpis': { cs: 'Čerpání', en: 'Spend' },
  'cerpani.sloupce': { cs: 'Sloupce', en: 'Bars' },
  'cerpani.kolac': { cs: 'Koláč', en: 'Pie' },
  'cerpani.druh.nataceni': { cs: 'Natáčení', en: 'Recording' },
  'cerpani.druh.strih': { cs: 'Střih', en: 'Editing' },
  'cerpani.druh.opravy': { cs: 'Opravy', en: 'Retakes' },
  'cerpani.poznamka': {
    cs: 'Proti rozpočtu stojí výkazy zvukařů. Bonus se nezapočítává — je to odměna za dokončenou knihu, ne odpracované hodiny.',
    en: 'The budget is set against the sound engineers’ timesheets. The bonus is left out — it is a reward for finishing the book, not hours worked.',
  },
  'cerpani.poznamkaOpravy': {
    cs: ' Opravy vlastní rozpočet nemají, ale čerpají ten společný.',
    en: ' Retakes have no budget of their own, but they draw on the shared one.',
  },
  'cerpani.bublinaBezRozpoctu': {
    cs: '{druh}: vykázáno {vykazano}, vlastní rozpočet nemají',
    en: '{druh}: {vykazano} on timesheets, no budget of its own',
  },
  'cerpani.bublina': {
    cs: '{druh}: vykázáno {vykazano} z rozpočtu {rozpocet} ({procent} %)',
    en: '{druh}: {vykazano} on timesheets out of a {rozpocet} budget ({procent}%)',
  },
  'cerpani.bezRozpoctu': { cs: 'bez rozpočtu', en: 'no budget' },
  'cerpani.zRozpoctu': { cs: 'z {rozpocet}', en: 'of {rozpocet}' },
  'cerpani.vysvetlivka': {
    cs: 'Světlý obrys je rozpočet, barevná výplň vykázané peníze.',
    en: 'The light outline is the budget, the coloured fill is what is on timesheets.',
  },
  'cerpani.bezVykazu': {
    cs: 'Zatím nejsou žádné výkazy, takže není co rozdělit.',
    en: 'There are no timesheets yet, so there is nothing to split up.',
  },
  'cerpani.popisekKolace': {
    cs: 'Podíl jednotlivých druhů práce na vykázaných penězích',
    en: 'The share of each kind of work in the money on timesheets',
  },
  'cerpani.bublinaKolace': { cs: '{druh}: {castka} ({procent} %)', en: '{druh}: {castka} ({procent}%)' },
  'cerpani.vykazano': { cs: 'vykázáno', en: 'on timesheets' },


  /* --- Výkazy k projektu (dávka 7f) --- */
  'vykazyProj.nadpis': { cs: 'Výkazy', en: 'Timesheets' },
  'vykazyProj.prazdno': {
    cs: 'K tomuhle projektu zatím nikdo nevykázal žádnou práci.',
    en: 'Nobody has put any work against this project yet.',
  },
  /* Tři tvary čísla: záznam / záznamy / záznamů. */
  'vykazyProj.zaznamJeden': { cs: '({pocet} záznam)', en: '({pocet} entry)' },
  'vykazyProj.zaznamMalo': { cs: '({pocet} záznamy)', en: '({pocet} entries)' },
  'vykazyProj.zaznamVic': { cs: '({pocet} záznamů)', en: '({pocet} entries)' },
  'vykazyProj.vse': { cs: 'Vše', en: 'All' },
  'vykazyProj.datum': { cs: 'Datum', en: 'Date' },
  'vykazyProj.druh': { cs: 'Druh', en: 'Kind' },
  'vykazyProj.zvukar': { cs: 'Zvukař', en: 'Sound engineer' },
  'vykazyProj.odDo': { cs: 'Od–do', en: 'From–to' },
  'vykazyProj.hodin': { cs: 'Hodin', en: 'Hours' },
  'vykazyProj.castka': { cs: 'Částka', en: 'Amount' },
  'vykazyProj.bonusy': { cs: 'Schválené bonusy', en: 'Approved bonuses' },
  'vykazyProj.schvaleno': { cs: ' · schváleno {datum}', en: ' · approved {datum}' },
  'vykazyProj.bonusPoznamka': {
    cs: 'Bonus je jednorázová odměna nad rámec výkazu — do odpracovaných hodin ani do čerpání rozpočtu se nezapočítává.',
    en: 'A bonus is a one-off reward on top of the timesheet — it counts towards neither the hours worked nor the budget spend.',
  },

  /* --- Hledání v PDF v AudioTaggeru (dávka 7f) --- */
  'hledaniPdf.placeholder': { cs: 'Hledat v textu (Ctrl+F)', en: 'Search the text (Ctrl+F)' },
  'hledaniPdf.popisekPole': { cs: 'Hledat v textu', en: 'Search the text' },
  'hledaniPdf.nic': { cs: 'nic', en: 'none' },
  'hledaniPdf.pripravuji': {
    cs: 'Připravuji text celé knihy pro hledání…',
    en: 'Preparing the whole book’s text for searching…',
  },
  'hledaniPdf.predchozi': { cs: 'Předchozí (Shift+Enter)', en: 'Previous (Shift+Enter)' },
  'hledaniPdf.dalsi': { cs: 'Další (Enter)', en: 'Next (Enter)' },
  'hledaniPdf.seznamNalezu': { cs: 'Seznam všech nálezů', en: 'List of all matches' },
  'hledaniPdf.jakHledat': { cs: 'Jak hledat', en: 'How to search' },
  'hledaniPdf.celaSlova': { cs: 'Jen celá slova', en: 'Whole words only' },
  'hledaniPdf.celaSlovaPopis': { cs: '„les" nenajde „lesník"', en: '“wood” will not find “woodland”' },
  'hledaniPdf.pribizne': { cs: 'Přibližně', en: 'Roughly' },
  'hledaniPdf.pribiznePopis': {
    cs: 'najde i překlep a jiný tvar: „Novak" → „Nováka"',
    en: 'finds a typo or a different form too: “Novak” → “Nováka”',
  },
  'hledaniPdf.presne': { cs: 'Přesně', en: 'Exactly' },
  'hledaniPdf.presnePopis': {
    cs: 'rozlišuje diakritiku a velká písmena',
    en: 'tells accents and capital letters apart',
  },
  'hledaniPdf.bezVoleb': {
    cs: 'Bez voleb se hledá bez ohledu na diakritiku a velikost písmen („prilis" najde „Příliš"), i přes rozdělení slova na konci řádku.',
    en: 'With nothing ticked the search ignores accents and letter case (“prilis” finds “Příliš”), and reads across a word split at the end of a line.',
  },
  'hledaniPdf.pocetNalezu': { cs: '{pocet} nálezů', en: '{pocet} matches' },
  'hledaniPdf.strana': { cs: 'str. {cislo}', en: 'p. {cislo}' },


  /* --- Úprava údajů přímo v přehledu projektů (dávka 7f) --- */
  'bunka.nejdeUlozit': { cs: 'Uložení se nezdařilo.', en: 'It could not be saved.' },
  'bunka.upravitKlepnutim': { cs: 'Upravit klepnutím', en: 'Tap to edit' },
  'bunka.vyberteDatum': { cs: 'Vyberte datum z kalendáře', en: 'Choose a date from the calendar' },

  /* --- Herci v přehledu projektů (dávka 7f) --- */
  'herciBunka.dotoceno': { cs: ' — dotočeno', en: ' — recording finished' },
  'herciBunka.schovat': { cs: 'Schovat zbylé herce', en: 'Hide the remaining narrators' },
  'herciBunka.ukazat': { cs: 'Ukázat další herce ({pocet})', en: 'Show more narrators ({pocet})' },
  'herciBunka.skryt': { cs: 'skrýt', en: 'hide' },


  /* --- Výběr herce v přehledu projektů (dávka 7f) --- */
  'vyberHerce.hledatSCaflou': { cs: 'hledat herce (v Caflou: {text})', en: 'search for a narrator (in Caflou: {text})' },
  'vyberHerce.zacnetePsat': { cs: 'začněte psát jméno herce', en: 'start typing the narrator’s name' },
  'vyberHerce.zadnyHerec': {
    cs: 'V portálu zatím není žádný herec — nejdřív ho založte mezi uživateli.',
    en: 'There is no narrator in the portal yet — add one under Users first.',
  },
  'vyberHerce.niktoTakovy': { cs: 'Nikdo takový tu není.', en: 'There is nobody like that here.' },
  'vyberHerce.dotocenoDatum': { cs: 'Dotočeno {datum}', en: 'Recording finished {datum}' },
  'vyberHerce.dotoceno': { cs: ' — dotočeno', en: ' — recording finished' },
  'vyberHerce.vybratJineho': { cs: 'Vybrat jiného herce', en: 'Choose a different narrator' },
  'vyberHerce.odebrat': { cs: 'Odebrat herce', en: 'Remove the narrator' },

  /* --- Pořadí stavů v přehledu projektů (dávka 7f) --- */
  'poradiStavu.tlacitko': { cs: 'Pořadí stavů', en: 'Status order' },
  'poradiStavu.bublina': {
    cs: 'V jakém pořadí se mají stavy řadit v tabulce',
    en: 'The order the statuses are sorted in within the table',
  },
  'poradiStavu.popisMenit': {
    cs: 'Přetažením (nebo šipkami) nastavíte, v jakém pořadí se stavy řadí v tabulce. Platí pro celý tým.',
    en: 'Drag (or use the arrows) to set the order the statuses are sorted in within the table. It applies to the whole team.',
  },
  'poradiStavu.popisCteni': {
    cs: 'V tomhle pořadí se stavy řadí v tabulce. Měnit ho smí Žůžo-labůžo a produkce.',
    en: 'This is the order the statuses are sorted in within the table. Only Admin and production can change it.',
  },
  'poradiStavu.vys': { cs: 'Posunout {nazev} výš', en: 'Move {nazev} up' },
  'poradiStavu.niz': { cs: 'Posunout {nazev} níž', en: 'Move {nazev} down' },
  'poradiStavu.ukladam': { cs: 'Ukládám…', en: 'Saving…' },
  'poradiStavu.ulozit': { cs: 'Uložit pořadí', en: 'Save the order' },
  'poradiStavu.zrusit': { cs: 'Zrušit', en: 'Cancel' },
  'poradiStavu.nejdeUlozit': { cs: 'Uložení se nezdařilo.', en: 'It could not be saved.' },


  /* --- Procesy v portálu (dávka 7f) --- */
  'procesy.nadpis': { cs: 'Procesy', en: 'Procedures' },
  'procesy.ozubene': { cs: 'Psaní a správa procesů', en: 'Writing and managing procedures' },
  'procesy.uvod': {
    cs: 'Jak u nás děláme práci - pracovní postupy, technické specifikace a návody k programům. U každého článku je napsané, pro koho je.',
    en: 'How we do the work here — working procedures, technical specifications and software guides. Each article says who it is for.',
  },
  'procesy.prazdno': { cs: 'Zatím tu nic není.', en: 'There is nothing here yet.' },
  'procesy.napsatPrvni': { cs: 'Napsat první postup', en: 'Write the first procedure' },
  'procesy.pribudou': { cs: 'Postupy sem přibudou.', en: 'Procedures will be added here.' },
  'procesy.rozepsane': { cs: 'rozepsané', en: 'draft' },

  /* --- Správa procesů v administraci (dávka 7f) --- */
  'procesyAdmin.uvod': {
    cs: 'Pracovní postupy, technické specifikace a návody k programům. U každého článku se zaškrtne, kdo ho uvidí — bez zaškrtnutí ho má celý tým. Čte se v portálu pod Procesy.',
    en: 'Working procedures, technical specifications and software guides. Each article has a tick for who will see it — with nothing ticked, the whole team has it. It is read in the portal under Procedures.',
  },
  'procesyAdmin.novy': { cs: '+ Nový proces', en: '+ New procedure' },
  'procesyAdmin.prazdno': { cs: 'Zatím tu není žádný postup.', en: 'There is no procedure here yet.' },
  'procesyAdmin.pro': { cs: 'Pro ', en: 'For ' },
  'procesyAdmin.celyTym': { cs: 'celý tým', en: 'the whole team' },
  'procesyAdmin.upraveno': { cs: ' · upraveno {datum}', en: ' · edited {datum}' },
  'procesyAdmin.nacitam': { cs: 'Načítám…', en: 'Loading…' },
  'procesyAdmin.nacistParametry': { cs: 'Načíst technické parametry', en: 'Load the technical parameters' },
  'procesyAdmin.bublinaParametry': {
    cs: 'Ze sad v Administraci složí jeden dokument Technické parametry výroby, uvnitř rozdělený po nakladatelstvích. Existující dokument přepíše.',
    en: 'Builds a single Production technical parameters document from the sets in the administration, split up by publisher inside. It overwrites any existing document.',
  },
  'procesyAdmin.parametryNejdou': { cs: 'Parametry se nepodařilo načíst.', en: 'The parameters could not be loaded.' },
  'procesyAdmin.hotovoZalozen': {
    cs: 'Hotovo — dokument založen, {celkem} sad',
    en: 'Done — document created, {celkem} sets',
  },
  'procesyAdmin.hotovoPrepsan': {
    cs: 'Hotovo — dokument přepsán, {celkem} sad',
    en: 'Done — document overwritten, {celkem} sets',
  },
  'procesyAdmin.uklizeno': { cs: ', uklizeno {pocet} starých článků', en: ', {pocet} old articles tidied away' },


  /* --- Složky na Disku v administraci (dávka 7f) --- */
  'slozky.nadpis': { cs: 'Složky na Disku', en: 'Folders on the Drive' },
  'slozky.uvodPred': { cs: 'Složky, které portál nabízí v Nahrávkách. Komu se která ukáže, se zaškrtává na ', en: 'The folders the portal offers under Recordings. Who sees which one is ticked on the ' },
  'slozky.uvodOdkaz': { cs: 'kartě účtu', en: 'account card' },
  'slozky.uvodZa': { cs: '.', en: '.' },
  'slozky.varovaniPred': { cs: 'Tohle rozhoduje jen o tom, co ukáže ', en: 'This decides only what the ' },
  'slozky.varovaniTucne': { cs: 'portál', en: 'portal' },
  'slozky.varovaniZa': {
    cs: '. Práva na samotném Google Disku se tím nemění - kdo si složku otevře přímo v Googlu pod účtem, který ji má nasdílenou, uvidí ji dál.',
    en: ' shows. It does not change the permissions on Google Drive itself — anyone who opens the folder in Google directly, under an account it is shared with, will still see it.',
  },
  'slozky.prazdno': { cs: 'Zatím tu není žádná složka.', en: 'There is no folder here yet.' },
  'slozky.vypnuta': { cs: ' · vypnutá', en: ' · switched off' },
  'slozky.odkazNesedi': {
    cs: 'Z tohohle odkazu nejde vyčíst složka - nikomu se neukáže. Otevřete složku na Disku a zkopírujte adresu z řádku prohlížeče.',
    en: 'No folder can be read out of this link — nobody will see it. Open the folder on the Drive and copy the address from the browser bar.',
  },
  'slozky.nikdo': { cs: 'Zatím ji nemá nikdo přidělenou.', en: 'Nobody has it assigned yet.' },
  'slozky.jeden': { cs: 'Přidělená jednomu člověku.', en: 'Assigned to one person.' },
  'slozky.vice': { cs: 'Přidělená {pocet} lidem.', en: 'Assigned to {pocet} people.' },
  'slozky.vypnout': { cs: 'Vypnout', en: 'Switch off' },
  'slozky.zapnout': { cs: 'Zapnout', en: 'Switch on' },
  'slozky.nova': { cs: 'Nová složka', en: 'New folder' },
  'slozky.nazev': { cs: 'Název', en: 'Name' },
  'slozky.odkaz': { cs: 'Odkaz na složku', en: 'Link to the folder' },
  'slozky.odkazNapoveda': {
    cs: 'Otevřete složku na Google Disku a zkopírujte adresu z řádku prohlížeče.',
    en: 'Open the folder on Google Drive and copy the address from the browser bar.',
  },
  'slozky.popis': { cs: 'Popis', en: 'Description' },
  'slozky.popisNapoveda': {
    cs: 'Nepovinný. Ukáže se jako bublina u zaškrtávátka.',
    en: 'Optional. It shows as a tooltip next to the tick box.',
  },
  'slozky.ukladam': { cs: 'Ukládám…', en: 'Saving…' },
  'slozky.zalozit': { cs: 'Založit složku', en: 'Create the folder' },
  'slozky.nejdeUlozit': { cs: 'Uložení se nezdařilo.', en: 'It could not be saved.' },


  /* --- Doplnit dotočeno zpětně (dávka 7f) --- */
  'doplnit.zpet': { cs: '← Zpět do administrace', en: '← Back to the administration' },
  'doplnit.nadpis': { cs: 'Doplnit dotočeno zpětně', en: 'Fill in finished recordings retrospectively' },
  'doplnit.uvodPred': {
    cs: 'Pro projekty přenesené z Caflou, u kterých se dotočilo dřív, než tlačítko „Dotočeno" vzniklo. Zaškrtnutí uloží fajfku a u projektu v „Natáčíme" nebo „Natáčíme/stříháme" překlopí stav na „Dotočeno" / „Dotočeno\u00A0/\u00A0stříháme" — ',
    en: 'For projects brought over from Caflou whose recording finished before the “Recording finished” button existed. Ticking saves the tick and, on a project at “Recording” or “Recording/editing”, flips the status to “Recording finished” / “Recording finished\u00A0/\u00A0editing” — ',
  },
  'doplnit.uvodTucne': { cs: 'bez jediné odeslané zprávy', en: 'with not a single message sent' },
  'doplnit.uvodZa': {
    cs: ', ani Heleně, ani klientovi. Do historie projektu se zápis udělá.',
    en: ', neither to Helena nor to the customer. An entry is made in the project history.',
  },
  'doplnit.zalohaNazvu': { cs: 'Projekt {id}', en: 'Project {id}' },
  'doplnit.neniCo': {
    cs: 'Není co doplňovat — u všech projektů s herci má fajfku každý.',
    en: 'There is nothing to fill in — on every project with narrators, everyone has their tick.',
  },
  'doplnit.zapsanoJeden': { cs: 'Zapsáno: {pocet} herec', en: 'Recorded: {pocet} narrator' },
  'doplnit.zapsanoVic': { cs: 'Zapsáno: {pocet} herců', en: 'Recorded: {pocet} narrators' },
  'doplnit.prehozenStav': { cs: ', přehozen stav u {pocet} projektů', en: ', status changed on {pocet} projects' },
  'doplnit.zadnaZprava': { cs: '. Žádná zpráva neodešla.', en: '. No message was sent.' },
  'doplnit.zapiseSe': { cs: 'Zapíše se tohle', en: 'This is what will be recorded' },
  'doplnit.stavPred': { cs: ' · stav ', en: ' · status ' },
  'doplnit.stavZustava': { cs: ' · stav zůstává', en: ' · status stays as it is' },
  'doplnit.zapisuji': { cs: 'Zapisuji…', en: 'Recording…' },
  'doplnit.zapsatBezZprav': { cs: 'Zapsat bez zpráv', en: 'Record with no messages' },
  'doplnit.zpetKVyberu': { cs: 'Zpět k výběru', en: 'Back to the selection' },
  'doplnit.ukazat': { cs: 'Ukázat, co se zapíše', en: 'Show what will be recorded' },
  'doplnit.ukazatPocet': { cs: 'Ukázat, co se zapíše ({pocet})', en: 'Show what will be recorded ({pocet})' },
  'doplnit.nicSeNeulozi': { cs: 'Nic se neuloží, dokud to nepotvrdíte.', en: 'Nothing is saved until you confirm it.' },
  'doplnit.bezStavu': { cs: 'bez stavu', en: 'no status' },
  'doplnit.preklopiSe': {
    cs: 'překlopí se na {stav}, až budou všichni',
    en: 'will flip to {stav} once everyone is in',
  },
  'doplnit.uzMa': { cs: 'už má', en: 'already has it' },
  'doplnit.nejdeUlozit': { cs: 'Nepodařilo se to uložit.', en: 'It could not be saved.' },


  /* --- Bruno v administraci (dávka 7f) --- */
  'brunoAdmin.nadpis': { cs: 'Bruno', en: 'Bruno' },
  'brunoAdmin.uvod': {
    cs: 'Co Bruno ví o naší práci, než se rozhodne, jestli něco zapíše.',
    en: 'What Bruno knows about our work before he decides whether to write something down.',
  },
  'brunoAdmin.pametNadpis': { cs: 'Co si Bruno všiml sám', en: 'What Bruno has noticed by himself' },
  'brunoAdmin.pametUvod': {
    cs: 'Zvyklosti, které si po rozhodnutích uložil z chatu. Tohle nepíšeme my — je to jeho poznámkový blok a je tu jen ke čtení. Když je v něm něco špatně, napište pravidlo do příručky výš; ta má přednost.',
    en: 'Habits he has saved from the chat after his decisions. We do not write this — it is his notebook and it is here to read only. If something in it is wrong, write a rule into the handbook above; that takes precedence.',
  },
  'brunoAdmin.pametPrazdno': { cs: 'Zatím si nic nepoznamenal.', en: 'He has not noted anything down yet.' },
  'brunoAdmin.zalohaProjektu': { cs: 'projekt {id}', en: 'project {id}' },
  'brunoAdmin.projektPred': { cs: '{nazev} · ', en: '{nazev} · ' },
  'brunoAdmin.platiVsude': { cs: 'platí všude · ', en: 'applies everywhere · ' },
  'brunoAdmin.prirukaNadpis': { cs: 'Jak to u nás chodí', en: 'How things work here' },
  'brunoAdmin.prirukaUvod': {
    cs: 'Tenhle text dostane Bruno k přečtení pokaždé, než se rozhodne, jestli něco zapíše — i v soukromé zprávě. Piš normálně, jako bys zaučoval nového kolegu: co který stav projektu znamená, kdo co dělá, co u nás znamenají naše slova. Platí mu to víc než to, co si přečte v chatu.',
    en: 'Bruno is given this text to read every time before he decides whether to write something down — in a private message too. Write it plainly, as if you were training a new colleague: what each project status means, who does what, what our own words mean here. It counts for more with him than anything he reads in the chat.',
  },
  'brunoAdmin.ukladam': { cs: 'Ukládám…', en: 'Saving…' },
  'brunoAdmin.ulozit': { cs: 'Uložit', en: 'Save' },
  'brunoAdmin.ulozeno': { cs: 'Uloženo.', en: 'Saved.' },
  'brunoAdmin.vychozi': {
    cs: 'Zatím to nikdo neupravoval — tohle je výchozí znění.',
    en: 'Nobody has edited it yet — this is the default wording.',
  },
  /* Česky má „uložil / uložila" dva tvary, anglicky stačí jeden. */
  'brunoAdmin.naposledyKdo': { cs: 'Naposledy uložil {kdo} {kdy}.', en: 'Last saved by {kdo} on {kdy}.' },
  'brunoAdmin.naposledy': { cs: 'Naposledy uložila {kdy}.', en: 'Last saved on {kdy}.' },
  'brunoAdmin.nejdeUlozit': { cs: 'Uložení se nezdařilo.', en: 'It could not be saved.' },


  /* --- Zprávy portálu v administraci (dávka 7f) --- */
  'zpravyPortalu.zpet': { cs: '← Zpět do administrace', en: '← Back to the administration' },
  'zpravyPortalu.nadpis': { cs: 'Zprávy portálu', en: 'Portal messages' },
  'zpravyPortalu.uvod': {
    cs: 'Maily a oznámení, která portál posílá nám — zvukařům o bonusu a o měsíčním přehledu výkazů. Zprávy klientovi se píšou jinde, ve Vzorech zpráv.',
    en: 'The emails and notices the portal sends us — to the sound engineers about a bonus and about the monthly timesheet summary. Messages to the customer are written elsewhere, under Message templates.',
  },
  'zpravyPortalu.smazanyUcet': { cs: 'Smazaný účet', en: 'Deleted account' },
  'zpravyPortalu.zapnuto': { cs: 'Zapnuto', en: 'On' },
  'zpravyPortalu.vypnuto': { cs: 'Vypnuto', en: 'Off' },
  'zpravyPortalu.kdy': { cs: 'Kdy', en: 'When' },
  'zpravyPortalu.komu': { cs: 'Komu', en: 'To whom' },
  'zpravyPortalu.nahled': { cs: 'Ukázat, jak mail vypadá', en: 'Show what the email looks like' },
  'zpravyPortalu.rozesilam': { cs: 'Rozesílám…', en: 'Sending…' },
  'zpravyPortalu.rozeslatTed': { cs: 'Rozeslat teď', en: 'Send now' },
  'zpravyPortalu.podruheNe': {
    cs: 'Komu už přehled za daný měsíc odešel, ho podruhé nedostane.',
    en: 'Anyone who has already had that month’s summary will not get it a second time.',
  },
  'zpravyPortalu.posledni': {
    cs: 'Poslední odeslané měsíční přehledy',
    en: 'The latest monthly summaries sent',
  },
  'zpravyPortalu.zadnyNeodesel': { cs: 'Zatím žádný přehled neodešel.', en: 'No summary has been sent yet.' },
  'zpravyPortalu.nejdeUlozit': { cs: 'Nepodařilo se to uložit.', en: 'It could not be saved.' },
  'zpravyPortalu.bezSpojeni': { cs: 'Nepodařilo se spojit se serverem.', en: 'The server could not be reached.' },
  'zpravyPortalu.rozeslaniNejde': { cs: 'Rozeslání se nepodařilo.', en: 'Sending failed.' },
  'zpravyPortalu.vypnutaZprava': {
    cs: 'Zpráva je vypnutá, nic se nerozeslalo.',
    en: 'The message is switched off, nothing was sent.',
  },
  'zpravyPortalu.odeslano': {
    cs: 'Odesláno {odeslano}, přeskočeno {preskoceno}.',
    en: '{odeslano} sent, {preskoceno} skipped.',
  },
  'zpravyPortalu.odeslanoSChybami': {
    cs: 'Odesláno {odeslano}, přeskočeno {preskoceno}, chyb {chyby}.',
    en: '{odeslano} sent, {preskoceno} skipped, {chyby} failed.',
  },
  /* Popisy jednotlivých zpráv (OZNAMENI v lib/oznameni.ts) - podle KÓDU. */
  'oznameni.BONUS_SCHVALEN.nazev': { cs: 'Schválený bonus', en: 'Approved bonus' },
  'oznameni.BONUS_SCHVALEN.popis': {
    cs: 'Částka, kniha, podíl na střihu (nebo za co bonus je) a kdo ho schválil.',
    en: 'The amount, the book, the share of the editing (or whatever the bonus is for) and who approved it.',
  },
  'oznameni.BONUS_SCHVALEN.kdy': {
    cs: 'Hned po schválení návrhu nebo po ručním přidání bonusu.',
    en: 'As soon as the proposal is approved or a bonus is added by hand.',
  },
  'oznameni.BONUS_SCHVALEN.komu': { cs: 'Zvukaři, kterému bonus patří.', en: 'The sound engineer the bonus belongs to.' },
  'oznameni.MESICNI_PREHLED.nazev': { cs: 'Měsíční přehled výkazů', en: 'Monthly timesheet summary' },
  'oznameni.MESICNI_PREHLED.popis': {
    cs: 'Odpracované hodiny a částka, rozpad podle druhu práce, projekty a schválené bonusy.',
    en: 'Hours worked and the amount, a breakdown by kind of work, the projects and any approved bonuses.',
  },
  'oznameni.MESICNI_PREHLED.kdy': {
    cs: 'Za měsíc minulý, v den nastavený v Přehledy → Zvukaři (výchozí šestého).',
    en: 'For the previous month, on the day set under Overviews → Sound engineers (the sixth by default).',
  },
  'oznameni.MESICNI_PREHLED.komu': {
    cs: 'Každému zvukaři, který v tom měsíci něco vykázal.',
    en: 'Every sound engineer who put anything on a timesheet that month.',
  },


  /* --- Nastavení sekcí (NASTAVENI_SEKCI v lib/nastaveniSekci.ts, dávka 7f) ---
     Překládá se podle KÓDU sekce, česká strana zůstává zdrojem pravdy. */
  'nastaveniSekce.PROJEKTY.nadpis': { cs: 'Nastavení projektů', en: 'Project settings' },
  'nastaveniSekce.PROJEKTY.popis': {
    cs: 'Zprávy, které z portálu chodí klientovi, když projekt přejde do dalšího stavu - znění pro audioknihy i pro reklamy a za jak dlouho po změně stavu odejdou. Komu a jestli vůbec se posílá, se nastavuje na kartě konkrétní firmy pod Notifikacemi.',
    en: 'The messages the portal sends the customer when a project moves to the next status — the wording for audiobooks and for adverts, and how long after the status change they go out. Who they go to, and whether at all, is set on the individual company’s card under Notifications.',
  },
  'nastaveniSekce.DOKLADY.nadpis': { cs: 'Nastavení dokladů', en: 'Invoicing settings' },
  'nastaveniSekce.DOKLADY.popis': {
    cs: 'E-maily, které z portálu odcházejí k dokladům - kdy se upomíná a co se v upomínce píše, a údaje firem, ze kterých vystavujeme.',
    en: 'The emails the portal sends out with documents — when a reminder goes, what it says, and the details of the companies we invoice from.',
  },
  'nastaveniSekce.PROCESY.nadpis': { cs: 'Správa procesů', en: 'Managing procedures' },
  'nastaveniSekce.PROCESY.popis': {
    cs: 'Psaní pracovních postupů a technických specifikací. U každého článku se zaškrtne, kdo ho uvidí - bez zaškrtnutí ho má celý tým.',
    en: 'Writing working procedures and technical specifications. Each article has a tick for who will see it — with nothing ticked, the whole team has it.',
  },
  'nastaveniSekce.FIRMY.nadpis': { cs: 'Nastavení firem', en: 'Company settings' },
  'nastaveniSekce.FIRMY.popis': {
    cs: 'Co portál rozesílá kolem firem a zakázek - zprávy, které chodí nám, ceníky, ze kterých se počítají sazby, a vzory natáčecích textů.',
    en: 'What the portal sends out around companies and jobs — the messages that come to us, the price lists the rates are worked out from, and the recording text templates.',
  },

  /* Záložky v nastavení - podle ADRESY, ne podle českého názvu (vzor z dávky 7d). */
  'nastaveni.zalozka./admin/nastaveni/doklady': { cs: 'Přehled', en: 'Overview' },
  'nastaveni.zalozka./admin/nastaveni/doklady/upominky': { cs: 'Upomínky', en: 'Reminders' },
  'nastaveni.zalozka./admin/nastaveni/doklady/moje-firmy': { cs: 'Naše firmy', en: 'Our companies' },
  'nastaveni.zalozka./admin/nastaveni/doklady/vzory-smluv': { cs: 'Vzory smluv', en: 'Contract templates' },
  'nastaveni.zalozka./admin/nastaveni/firmy': { cs: 'Přehled', en: 'Overview' },
  'nastaveni.zalozka./admin/nastaveni/firmy/zpravy-portalu': { cs: 'Zprávy z portálu', en: 'Messages from the portal' },
  'nastaveni.zalozka./admin/nastaveni/firmy/ceniky': { cs: 'Ceníky', en: 'Price lists' },
  'nastaveni.zalozka./admin/nastaveni/firmy/vzory-nataceni': { cs: 'Vzory natáčení', en: 'Recording templates' },

  'nastaveni.zpetDoDokladu': { cs: '← Zpět do dokladů', en: '← Back to invoicing' },
  'nastaveni.zpetNaFirmy': { cs: '← Zpět na firmy', en: '← Back to companies' },
  'nastaveni.zpetNaProjekty': { cs: '← Zpět na projekty', en: '← Back to projects' },
  'nastaveni.technickeParametry': { cs: 'Technické parametry výroby →', en: 'Production technical parameters →' },

  /* Rozcestník nastavení dokladů. */
  'nastaveniDoklady.upominky': { cs: 'Upomínky', en: 'Reminders' },
  'nastaveniDoklady.upominkyPopis': {
    cs: 'Kolik dní po splatnosti se upomíná, předmět a text upomínky - i s náhledem mailu, jaký klientovi opravdu odejde.',
    en: 'How many days after the due date a reminder goes, its subject and text — with a preview of the email the customer really gets.',
  },
  'nastaveniDoklady.mojeFirmy': { cs: 'Naše firmy', en: 'Our companies' },
  'nastaveniDoklady.mojeFirmyPopis': {
    cs: 'Fakturační údaje firem, ze kterých vystavujeme - hlavička dokladů, bankovní spojení a podpis pod mailem.',
    en: 'The invoicing details of the companies we invoice from — the document header, the bank details and the signature under the email.',
  },
  'nastaveniDoklady.vzorySmluv': { cs: 'Vzory smluv', en: 'Contract templates' },
  'nastaveniDoklady.vzorySmluvPopis': {
    cs: 'Znění smluv s herci, ze kterých se skládá to, co jde k podpisu.',
    en: 'The wording of the narrators’ contracts that what goes out for signature is built from.',
  },
  'nastaveniDoklady.pruvodniTexty': {
    cs: 'Průvodní texty mailů u nabídky, faktury a smlouvy zatím žijí v kódu a mění se nasazením - do nastavení se přesunou, až se rozhodne, které z nich má smysl přepisovat.',
    en: 'The covering text of the quote, invoice and contract emails still lives in the code and changes with a deployment — it will move into the settings once we decide which of them is worth rewriting.',
  },

  /* Rozcestník nastavení firem. */
  'nastaveniFirmy.zpravy': { cs: 'Zprávy z portálu', en: 'Messages from the portal' },
  'nastaveniFirmy.zpravyPopis': {
    cs: 'Co portál posílá nám - bonusy ke schválení a měsíční přehled výkazů zvukařům. Dá se zapnout, vypnout a je vidět, co už odešlo.',
    en: 'What the portal sends us — bonuses for approval and the monthly timesheet summary for the sound engineers. It can be switched on or off, and you can see what has gone out.',
  },
  'nastaveniFirmy.ceniky': { cs: 'Ceníky', en: 'Price lists' },
  'nastaveniFirmy.cenikyPopis': {
    cs: 'Sazby za normostranu a položky, ze kterých se skládají nabídky a rozpočty.',
    en: 'The rates per standard page and the items that quotes and budgets are built from.',
  },
  'nastaveniFirmy.vzoryNataceni': { cs: 'Vzory natáčení', en: 'Recording templates' },
  'nastaveniFirmy.vzoryNataceniPopis': {
    cs: 'Předlohy natáčecích textů, ze kterých se skládá dokument k natáčení.',
    en: 'The recording text templates the recording document is built from.',
  },

  // --- připomínky Heleny k plánování s herci (2. a 5. 10. 2026) ---
  'nabidkaTerminu.upomenout': { cs: 'Upomenout herce', en: 'Remind the actor' },
  'nabidkaTerminu.upomenoutPopis': {
    cs: 'Pošle hercovi připomínku s odkazem. Nabídku to nijak nezmění, poslat se dá i víckrát.',
    en: 'Sends the actor a reminder with the link. It changes nothing about the offer and can be sent more than once.',
  },
  'nabidkaTerminu.upomenutoNa': { cs: 'Upomínka odešla na {email}.', en: 'The reminder has gone to {email}.' },
  'nabidkaTerminu.chybaUpominky': {
    cs: 'Upomínku se nepodařilo poslat.',
    en: 'The reminder could not be sent.',
  },
  'nabidkaTerminu.frekvenceRovnou': {
    cs: 'Počet frekvencí jde přepsat rovnou tady - uloží se po odkliknutí.',
    en: 'You can change the number of sessions right here — it saves when you click away.',
  },
  'natacPlan.upomenout': { cs: 'Upomenout', en: 'Remind' },
  'natacPlan.upominam': { cs: 'Posílám…', en: 'Sending…' },
  'natacPlan.upomenoutPopis': {
    cs: 'Pošle hercovi připomínku, ať si naklikne termíny.',
    en: 'Sends the actor a reminder to pick their sessions.',
  },
  'natacPlan.upomenuto': { cs: 'Upomínka hercovi odešla.', en: 'The reminder has gone to the actor.' },
  'natacPlan.chybaUpominky': {
    cs: 'Upomínku se nepodařilo poslat.',
    en: 'The reminder could not be sent.',
  },
  'mujUcet.upozorneniPopisTym': {
    cs: 'Co vám z portálu chodí mailem. Přepnete si to sami, kdykoliv.',
    en: 'What the portal emails you. You can switch it yourself, any time.',
  },
  'mujUcet.vyberTerminu': {
    cs: 'Chci vědět, když si herec naklikal termíny',
    en: 'Tell me when an actor has picked their sessions',
  },
  'mujUcet.vyberTerminuPopis': {
    cs: 'Mail hned, jak herec odešle svůj výběr natáčecích termínů - u všech projektů, ne jen u těch vašich. Vybrané termíny se drží jen do konce lhůty, pak se místa ve studiu uvolní.',
    en: 'An email as soon as an actor submits their choice of recording sessions — for every project, not only yours. The chosen sessions are held only until the deadline, after which the studio slots are released.',
  },
  'mujUcet.tymDotoceno': {
    cs: 'Chci vědět, když je herec dotočený',
    en: 'Tell me when an actor is finished recording',
  },
  'mujUcet.tymDotocenoPopis': {
    cs: 'Mail, jak se u projektu odškrtne dotočeno s hercem - u všech projektů.',
    en: 'An email when a project is ticked off as finished with an actor — for every project.',
  },
  // --- připomínky z 5. a 6. 10. 2026 ---
  'nabidkaTerminu.odebratZNabidky': { cs: 'Odebrat z nabídky', en: 'Remove from the offer' },
  'nabidkaTerminu.odebrano': { cs: 'Odebráno z nabídky ({pocet})', en: 'Removed from the offer ({pocet})' },
  'nabidkaTerminu.vratit': { cs: 'Vrátit', en: 'Put back' },
  'nabidkaTerminu.odebiraniPopis': {
    cs: 'Křížkem termín z nabídky odeberete - na svátky a Vánoce, o kterých kalendář neví. Hercova volba tím nehne a tlačítkem Vrátit se termín vrací zpátky.',
    en: 'The cross takes a session out of the offer — for bank holidays and Christmas, which the calendar knows nothing about. It never touches what the actor has already chosen, and Put back returns it.',
  },

  // --- Moje bonusy: podíl na obratu (6. 10. 2026) ---
  'prehledy.zalozka./prehledy/moje-bonusy': { cs: 'Moje bonusy', en: 'My bonuses' },
  'uzivatel.polePodilNaObratu': { cs: 'Podíl na obratu (%)', en: 'Share of turnover (%)' },
  'uzivatel.podilNaObratuHint': {
    cs: 'z obratu bez DPH se z něj počítá bonus v Přehledech → Moje bonusy; prázdné pole znamená žádný podíl',
    en: 'the bonus in Reports → My bonuses is worked out from it, out of turnover excluding VAT; empty means no share',
  },
  'bonusObratu.mujPodil': { cs: 'Můj podíl', en: 'My share' },
  'bonusObratu.bonusZaMesic': { cs: 'Můj bonus za {mesic}', en: 'My bonus for {mesic}' },
  'bonusObratu.obratMesice': { cs: 'Obrat za {mesic} bez DPH', en: 'Turnover for {mesic} excluding VAT' },
  'bonusObratu.tentoMesic': { cs: 'tento měsíc', en: 'this month' },
  'bonusObratu.minulyMesic': { cs: 'minulý měsíc', en: 'last month' },
  'bonusObratu.obratHodnota': { cs: 'Obrat {castka}', en: 'Turnover {castka}' },
  'bonusObratu.grafBonusu': { cs: 'Můj bonus po měsících — {rok}', en: 'My bonus month by month — {rok}' },
  'bonusObratu.grafObratu': { cs: 'Obrat po měsících — {rok}', en: 'Turnover month by month — {rok}' },
  'bonusObratu.bezi': { cs: 'běží', en: 'in progress' },
  'bonusObratu.zatimNic': {
    cs: 'V tomhle roce se zatím nic nevyfakturovalo.',
    en: 'Nothing has been invoiced this year yet.',
  },
  'bonusObratu.clovek': { cs: 'Člověk', en: 'Person' },
  'bonusObratu.podil': { cs: 'Podíl', en: 'Share' },
  'bonusObratu.podilCloveka': { cs: 'Podíl na obratu — {jmeno}', en: 'Share of turnover — {jmeno}' },
  'bonusObratu.chybaProcento': {
    cs: 'Podíl zadejte jako procenta od 0 do 100.',
    en: 'Enter the share as a percentage between 0 and 100.',
  },
  'bonusObratu.chybaUlozeni': { cs: 'Podíl se nepodařilo uložit.', en: 'The share could not be saved.' },
  'prehledy.zalozka.bonusy': { cs: 'Bonusy', en: 'Bonuses' },
  'bonusObratu.zaklad': {
    cs: 'Počítá se po měsících z vystavených faktur podle data vystavení, v korunách bez DPH - tedy ze stejného obratu, jaký ukazuje Palubovka. Stornované a rozpracované faktury se nepočítají.',
    en: 'Worked out from issued invoices by their issue date, in CZK excluding VAT — the same turnover the Dashboard shows. Cancelled and draft invoices do not count.',
  },
  'bonusObratu.poMesicich': { cs: 'Po měsících', en: 'Month by month' },
  'bonusObratu.mesic': { cs: 'Měsíc', en: 'Month' },
  'bonusObratu.obrat': { cs: 'Obrat', en: 'Turnover' },
  'bonusObratu.bonus': { cs: 'Můj bonus', en: 'My bonus' },
  'bonusObratu.celkemRok': { cs: 'Celkem {rok}', en: 'Total for {rok}' },
  'bonusObratu.vsichni': { cs: 'Podíly celého týmu', en: 'The whole team’s shares' },
  'bonusObratu.vsichniPopis': {
    cs: 'Kdo má podíl na obratu a kolik mu vychází za měsíc a za rok. Procento jde přepsat rovnou tady — uloží se po odkliknutí. Vidí to jen Žůžo-labůžo.',
    en: 'Who has a share of turnover and what it comes to for the month and for the year. The percentage can be changed right here — it saves when you click away. Only Žůžo-labůžo sees this.',
  },
  'bonusObratu.nikdoNemaPodil': {
    cs: 'Podíl na obratu zatím nemá nikdo - vyplňuje se na kartě uživatele.',
    en: 'Nobody has a share of turnover yet — it is filled in on the user card.',
  },
  'uzivatel.pravoDostavaVyberTerminu': { cs: 'Dostává výběr termínů', en: 'Receives chosen sessions' },
  'uzivatel.pravoDostavaVyberTerminuPopis': {
    cs: 'Mail, jak si herec naklikal natáčecí termíny. Přepnout si to umí i sám v Můj účet.',
    en: 'An email when an actor has picked their recording sessions. They can also switch it themselves in My account.',
  },

  // Spolecna lista zalozek (components/ZalozkyLista.tsx) - Doklady, Prehledy
  // i nastaveni sekci. Nazvy samotnych zalozek si prekladaji volajici.
  'zalozky.neulozeno': { cs: 'neuloženo', en: 'not saved' },
  'zalozky.vychozi': { cs: 'Výchozí', en: 'Default' },
  'zalozky.hotovo': { cs: 'Hotovo', en: 'Done' },
  'zalozky.preskladat': { cs: 'Přeskládat záložky', en: 'Reorder tabs' },
  'zalozky.posunoutDoleva': { cs: 'Posunout {nazev} doleva', en: 'Move {nazev} left' },
  'zalozky.posunoutDoprava': { cs: 'Posunout {nazev} doprava', en: 'Move {nazev} right' },
  'projekty.nastaveniSekce': {
    cs: 'Nastavení projektů - zprávy klientovi',
    en: 'Project settings - messages to the customer',
  },
};

/**
 * Přeloží klíč a doplní zástupné značky `{nazev}` hodnotami.
 *
 * Věta se nikdy neskládá z kousků - v angličtině stojí slova jinak než
 * v češtině. Celá věta je proto jeden klíč a do ní se jen dosazuje.
 */
export function prelozitS(
  jazyk: Jazyk,
  klic: string,
  hodnoty: Record<string, string | number>,
): string {
  return prelozit(jazyk, klic).replace(/\{(\w+)\}/g, (cela, znacka) =>
    znacka in hodnoty ? String(hodnoty[znacka]) : cela,
  );
}

/**
 * Věta rozdělená na dva kousky kolem jedné značky - pro místa, kde má být část
 * věty tlustě nebo je z ní odkaz. Celá věta zůstává JEDEN KLÍČ (pravidlo 7
 * v docs/preklad-portalu.md), rozdělí se až při vykreslení - takže značka může
 * v angličtině stát ve větě jinde než v češtině.
 *
 * Vrací [co je před značkou, co je za ní]; ostatní značky se dosadí normálně.
 */
export function prelozitKolem(
  jazyk: Jazyk,
  klic: string,
  znacka: string,
  hodnoty: Record<string, string | number> = {},
): [string, string] {
  const veta = prelozitS(jazyk, klic, hodnoty);
  const kde = veta.indexOf(`{${znacka}}`);
  if (kde < 0) return [veta, ''];
  return [veta.slice(0, kde), veta.slice(kde + znacka.length + 2)];
}

/**
 * Věta rozsekaná na kusy kolem VÍCE značek (dávka 7c) - obecná varianta
 * `prelozitKolem`, kterou si dávka 5 napsala na lístek: věty se dvěma
 * tučnými kusy se do té doby obcházely ručně.
 *
 * Věta zůstává JEDEN KLÍČ (pravidlo 7) a rozdělí se až při vykreslení, takže
 * značky mohou v angličtině stát v jiném pořadí než v češtině. Vrací kusy
 * v tom pořadí, v jakém je ve větě potřeba vysázet: `{ text }` je obyčejný
 * text, `{ znacka }` je místo, kam patří tučný kus nebo odkaz.
 *
 * Značka, která ve větě není, se prostě nevrátí - a je to vidět.
 */
export function prelozitNaKusy(
  jazyk: Jazyk,
  klic: string,
  znacky: string[],
  hodnoty: Record<string, string | number> = {},
): { text?: string; znacka?: string }[] {
  const veta = prelozitS(jazyk, klic, hodnoty);
  const vzor = new RegExp(`\\{(${znacky.join('|')})\\}`, 'g');
  const kusy: { text?: string; znacka?: string }[] = [];
  let od = 0;
  for (let nalez = vzor.exec(veta); nalez; nalez = vzor.exec(veta)) {
    if (nalez.index > od) kusy.push({ text: veta.slice(od, nalez.index) });
    kusy.push({ znacka: nalez[1] });
    od = nalez.index + nalez[0].length;
  }
  if (od < veta.length) kusy.push({ text: veta.slice(od) });
  return kusy;
}

/**
 * Jazyk z cookie v prohlížeči - pro to málo míst, která stojí MIMO
 * JazykProvider. Typicky poslední záchyt chyby v src/app/error.tsx: tam layout
 * portálu vůbec neproběhl, takže jazyk nemá kdo podat. Na serveru vrátí
 * češtinu (cookie tam přes document nevidíme), v prohlížeči se dorovná.
 */
export function jazykZCookie(): Jazyk {
  if (typeof document === 'undefined') return 'cs';
  const nalez = document.cookie.match(new RegExp(`(?:^|; )${KLIC_JAZYKA}=([^;]*)`));
  const hodnota = nalez ? decodeURIComponent(nalez[1]) : null;
  return jeJazyk(hodnota) ? hodnota : 'cs';
}

/**
 * Datum podle jazyka - česky „13. 9. 2026", anglicky „13/09/2026"
 * (britský formát, ne americký).
 */
/**
 * ČAS SE PÍŠE V NAŠEM PÁSMU (oprava 29. 9. 2026: na kartě banky stálo
 * „Naposledy 18:32", zatímco hodiny ukazovaly 20:32).
 *
 * Stránky se vykreslují na serveru a ten běží v UTC, takže bez pásma se
 * všechny časy „kdo co kdy udělal" ukazovaly o dvě hodiny zpátky - a vypadalo
 * to, že se dvě hodiny nic nestalo. Pásmo je natvrdo pražské: firma je tady
 * a jde o to, aby server i obrazovka říkaly totéž. Časy událostí v cizích
 * studiích (Londýn) si pásmo vozí s sebou a formátují se jinde.
 *
 * U data bez času se tím nic neposune: data se drží jako půlnoc UTC, což je
 * v Praze tentýž den ráno.
 */
const NASE_PASMO = 'Europe/Prague';

export function formatDatum(jazyk: Jazyk, d: Date | null, zaloha = '—'): string {
  if (!d) return zaloha;
  return new Intl.DateTimeFormat(kodJazyka(jazyk), { timeZone: NASE_PASMO }).format(d);
}

/**
 * Datum s názvem měsíce - do záhlaví, kde má datum znít jako věta:
 * „28. září 2026" / „28 September 2026".
 */
export function formatDatumDlouhy(jazyk: Jazyk, d: Date | null, zaloha = '—'): string {
  if (!d) return zaloha;
  return new Intl.DateTimeFormat(kodJazyka(jazyk), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: NASE_PASMO,
  }).format(d);
}

/** Datum i s časem (24 h) - do výpisů, kdo co kdy udělal. */
export function formatDatumCas(jazyk: Jazyk, d: Date | null, zaloha = '—'): string {
  if (!d) return zaloha;
  return new Intl.DateTimeFormat(kodJazyka(jazyk), {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: NASE_PASMO,
  }).format(d);
}

/** Přeloží klíč. Co ve slovníku není, projde česky - a je to vidět. */
export function prelozit(jazyk: Jazyk, klic: string): string {
  const zaznam = SLOVNIK[klic];
  if (!zaznam) {
    if (process.env.NODE_ENV !== 'production') console.warn(`Chybí překlad pro „${klic}".`);
    return klic;
  }
  return jazyk === 'en' ? zaznam.en || zaznam.cs : zaznam.cs;
}
