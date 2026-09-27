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
    cs: 'Zatím tu žádný účet není. „Napojit účet" tě pošle do Air Banky, kde přihlášením potvrdíš souhlas — portál pak pohyby stahuje sám třikrát denně.',
    en: 'There is no account here yet. "Connect an account" takes you to Air Bank, where signing in confirms your authorisation — the portal then downloads transactions by itself three times a day.',
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
    cs: 'Napojení na banku ještě není nastavené.',
    en: 'The bank connection is not set up yet.',
  },
  // {kod1} a {kod2} se vykreslí jako <code> s názvem proměnné - viz sKody() v BankaKlient.tsx.
  'banka.nenastavenoPopis': {
    cs: 'Portál chodí do banky přes GoCardless Bank Account Data. Stačí si tam založit účet (je to zdarma), vytvořit klíče a přidat je na Vercelu jako {kod1} a {kod2}. Pak se sem vrať a účet napoj.',
    en: 'The portal reaches the bank through GoCardless Bank Account Data. Just set up an account there (it is free), create the keys and add them on Vercel as {kod1} and {kod2}. Then come back here and connect the account.',
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
    en: 'The client cannot see the addresses — they go as a blind copy.',
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
    en: 'The company has no contact email and no client project',
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
