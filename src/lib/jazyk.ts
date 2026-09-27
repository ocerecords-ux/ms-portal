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
    en: 'You are viewing the calendar as a studio client — booking is disabled here.',
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
  'objednavkaReklama.krokSluzby': { cs: 'Co pro vás máme udělat?', en: 'What would you like us to do?' },
  'objednavkaReklama.krokSluzbyPopis': {
    cs: 'Vyberte všechno, co k zakázce patří.',
    en: 'Choose everything the job involves.',
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
  'objednavkaReklama.pSluzby': { cs: 'Co pro vás uděláme', en: 'What we will do' },
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
  'mujUcet.prehledDne': { cs: 'Přehled dne a připomínky', en: 'Daily brief and reminders' },
  'mujUcet.prehledDnePopis': {
    cs: 'Co vás ten den čeká — a štouchnutí před každou událostí.',
    en: 'What your day holds — and a nudge before every event.',
  },
  'mujUcet.hlidatDen': { cs: 'Hlídat mi den', en: 'Keep an eye on my day' },
  'mujUcet.hlidatDenPopis': {
    cs: 'Ráno v sedm přijde do telefonu upozornění a při prvním otevření portálu vyskočí okno s programem dne — natáčení a střihy, kde jste zvukař nebo herec, porady a schůzky, na které jste pozvaní, a otevřené úkoly. Patnáct minut před každou událostí navíc Bruno pošle připomínku do chatu i do telefonu.',
    en: 'At seven in the morning a notification arrives on your phone, and the first time you open the portal a window pops up with the day ahead — recordings and editing where you are the sound engineer or the narrator, meetings you are invited to, and open tasks. Fifteen minutes before each event Bruno also sends a reminder to the chat and to your phone.',
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
  'role.CLIENT': { cs: 'Klient', en: 'Client' },
  'role.HEREC': { cs: 'Herec', en: 'Narrator' },
  // Žůžo-labůžo je náš vtip, anglicky prostě Admin (viz slovníček v
  // docs/preklad-portalu.md).
  'role.ADMIN': { cs: 'Žůžo-labůžo', en: 'Admin' },
  'role.ZVUKAR': { cs: 'Zvukař', en: 'Sound engineer' },
  'role.PRODUKCE': { cs: 'Produkce', en: 'Production' },
  'role.ROBOT': { cs: 'Robot', en: 'Robot' },
  'role.TABULE': { cs: 'Tabule ve studiu', en: 'Studio display' },
  'role.BOOKING': { cs: 'Klient studia (rezervace)', en: 'Studio client (bookings)' },

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
  'chat.dotazyKlientu': { cs: 'Dotazy klientů', en: 'Client questions' },
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
  'parametry.tlacitkoPopis': {
    cs: 'Technické parametry výroby — v čem se to odevzdává',
    en: 'Technical production parameters — the format it is delivered in',
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
export function formatDatum(jazyk: Jazyk, d: Date | null, zaloha = '—'): string {
  if (!d) return zaloha;
  return new Intl.DateTimeFormat(kodJazyka(jazyk)).format(d);
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
