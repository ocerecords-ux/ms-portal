import { type Jazyk } from '@/lib/jazyk';

/**
 * SLOVNÍK POŠTY (dávka 6 překladu, 27. 9. 2026).
 *
 * PROČ ZVLÁŠŤ A NE DO lib/jazyk.ts: ten slovník si bere `JazykProvider`, takže
 * se celý posílá do prohlížeče s každou stránkou. Texty e-mailů jsou dlouhé
 * odstavce - čtyřicet šablon by znamenalo stovky vět navíc v každém načtení
 * portálu, a to všechno kvůli textům, které prohlížeč nikdy nepotřebuje.
 * Tenhle soubor si bere JEN lib/email.ts, který běží na serveru.
 *
 * Pravidla jsou stejná jako v hlavním slovníku (docs/preklad-portalu.md):
 * čeština je zdroj pravdy, věta je jeden klíč, angličtina je britská.
 *
 * JAZYK SE TU NEBERE Z LIŠTY, ALE OD PŘÍJEMCE (pravidlo 5) - viz
 * lib/jazykPrijemce.ts.
 */
export const SLOVNIK_EMAILU: Record<string, { cs: string; en: string }> = {
  // --- společné kousky všech šablon ---
  'mail.pozdravBezJmena': { cs: 'Dobrý den,', en: 'Hello,' },
  'mail.pozdravSeJmenem': { cs: 'Dobrý den, {jmeno},', en: 'Hello {jmeno},' },
  'mail.sPozdravem': { cs: 'S pozdravem', en: 'Kind regards' },
  'mail.tym': { cs: 'tým Mediaspace', en: 'the Mediaspace team' },
  'mail.otevritPortal': { cs: 'Otevřít portál', en: 'Open the portal' },
  'mail.neodpovidejte': {
    cs: 'Tenhle e-mail odešel z portálu automaticky, neodpovídejte na něj.',
    en: 'This email was sent automatically from the portal; please do not reply to it.',
  },

  // --- přehledy, natáčení, rodný list, stav projektu, přeposlech, upomínky ---

  // Mesicni prehled vykazu. Nazev mesice („Srpen 2026") i castky prichazeji
  // uz naformatovane z lib/mesicniPrehledServer.ts - viz poznamka v davce 6.
  'mail.prehled.stitek': { cs: 'Přehled výkazů · {mesic}', en: 'Timesheet summary · {mesic}' },
  'mail.prehled.predmet': { cs: 'Přehled výkazů — {mesic}', en: 'Timesheet summary — {mesic}' },
  'mail.prehled.preheaderSCastkou': { cs: '{mesic}: {hodiny}, {celkem}.', en: '{mesic}: {hodiny}, {celkem}.' },
  'mail.prehled.preheader': { cs: '{mesic}: {hodiny}.', en: '{mesic}: {hodiny}.' },
  'mail.prehled.odpracovano': { cs: 'Odpracováno', en: 'Hours worked' },
  'mail.prehled.zaPraci': { cs: 'Za práci', en: 'For work done' },
  'mail.prehled.bonusy': { cs: 'Bonusy', en: 'Bonuses' },
  'mail.prehled.celkem': { cs: 'Celkem', en: 'Total' },
  'mail.prehled.podleDruhu': { cs: 'Podle druhu práce', en: 'By type of work' },
  'mail.prehled.projekty': { cs: 'Projekty', en: 'Projects' },
  'mail.prehled.otevritVykazy': { cs: 'Otevřít výkazy', en: 'Open timesheets' },
  'mail.prehled.patka': {
    cs: 'Přehled chodí vždycky {den}. dne v měsíci za měsíc minulý. Když v něm něco nesedí, výkaz se dá opravit ve Výkazech — a napište nám, ať to víme.',
    en: 'This summary goes out on day {den} of each month and covers the month before. If something does not add up, the timesheet can be put right in Timesheets — and do let us know.',
  },
  'mail.prehled.textNadpis': { cs: 'Prehled vykazu za {mesic}', en: 'Timesheet summary for {mesic}' },
  'mail.prehled.textOdpracovano': { cs: 'Odpracovano: {hodiny}', en: 'Hours worked: {hodiny}' },
  'mail.prehled.textZaPraci': { cs: 'Za praci: {castka}', en: 'For work done: {castka}' },
  'mail.prehled.textBonusy': { cs: 'Bonusy: {castka}', en: 'Bonuses: {castka}' },
  'mail.prehled.textCelkem': { cs: 'Celkem: {celkem}', en: 'Total: {celkem}' },
  'mail.prehled.textPodleDruhu': { cs: 'Podle druhu prace:', en: 'By type of work:' },
  'mail.prehled.textProjekty': { cs: 'Projekty:', en: 'Projects:' },
  'mail.prehled.textBonusySeznam': { cs: 'Bonusy:', en: 'Bonuses:' },
  'mail.prehled.textDny': { cs: 'Jednotlive dny najdete tady:', en: 'You can see the individual days here:' },

  // Nabidka natacecich terminu herci.
  'mail.terminy.pocetJeden': { cs: '1 termín', en: '1 session' },
  'mail.terminy.pocetMalo': { cs: '{pocet} termíny', en: '{pocet} sessions' },
  'mail.terminy.pocetMnoho': { cs: '{pocet} termínů', en: '{pocet} sessions' },
  'mail.terminy.stitek': { cs: 'Natáčecí termíny', en: 'Recording sessions' },
  'mail.terminy.odznak': { cs: 'Výběr termínů', en: 'Choosing sessions' },
  'mail.terminy.preheader': {
    cs: 'Vyberte si {pocet} pro projekt {projekt}.',
    en: 'Choose {pocet} for the {projekt} project.',
  },
  'mail.terminy.uvod': {
    cs: 'máme pro vás připravené termíny natáčení. Otevřete odkaz níže a vyberte si {pocet}, které vám sedí — přihlašovat se nemusíte.',
    en: 'we have recording sessions ready for you. Open the link below and choose the {pocet} that suit you — there is nothing to log in to.',
  },
  'mail.terminy.projekt': { cs: 'Projekt', en: 'Project' },
  'mail.terminy.studio': { cs: 'Studio', en: 'Studio' },
  'mail.terminy.obdobi': { cs: 'Období', en: 'Period' },
  'mail.terminy.vyberte': { cs: 'Vyberte', en: 'Choose' },
  'mail.terminy.vyberteHodnota': { cs: '{pocet} z {celkem} nabídnutých', en: '{pocet} out of the {celkem} offered' },
  'mail.terminy.poznamkaProdukce': { cs: 'Poznámka produkce:', en: 'Production note:' },
  'mail.terminy.tlacitko': { cs: 'Vybrat termíny', en: 'Choose sessions' },
  'mail.terminy.patka': {
    cs: 'Odkaz je určený jen vám — nesdílejte ho prosím dál. Kdyby vám žádný z termínů nevyhovoval, stačí na tento e-mail odpovědět.',
    en: 'This link is meant for you alone — please do not pass it on. If none of the sessions suits you, simply reply to this email.',
  },
  'mail.terminy.predmet': {
    cs: 'Výběr natáčecích termínů — {projekt}',
    en: 'Choosing recording sessions — {projekt}',
  },
  'mail.terminy.textUvod': {
    cs: 'mame pro vas pripravene terminy nataceni projektu {projekt}.',
    en: 'we have recording sessions ready for the {projekt} project.',
  },
  'mail.terminy.textStudio': { cs: 'Studio: {studio}', en: 'Studio: {studio}' },
  'mail.terminy.textVyberte': {
    cs: 'Vyberte si {pocet} terminu z {celkem} nabidnutych.',
    en: 'Choose {pocet} sessions out of the {celkem} offered.',
  },
  'mail.terminy.textPoznamka': { cs: 'Poznamka produkce: {poznamka}', en: 'Production note: {poznamka}' },
  'mail.terminy.textOdkaz': { cs: 'Vyber terminu:', en: 'Choose your sessions:' },
  'mail.terminy.textPatka': {
    cs: 'Odkaz je urceny jen vam - nesdilejte ho dal.',
    en: 'This link is meant for you alone - please do not pass it on.',
  },

  // Rozhodnuti o vyberu terminu - potvrzeno / vraceno / zamitnuto.
  'mail.rozhodnuti.potvrzeno.stitek': { cs: 'Termíny potvrzeny', en: 'Sessions confirmed' },
  'mail.rozhodnuti.potvrzeno.nadpis': { cs: 'Termíny jsou potvrzené', en: 'Your sessions are confirmed' },
  'mail.rozhodnuti.potvrzeno.uvod': {
    cs: 'vaše termíny jsou potvrzené — těšíme se na vás ve studiu.',
    en: 'your sessions are confirmed — we look forward to seeing you at the studio.',
  },
  'mail.rozhodnuti.vraceno.stitek': { cs: 'Prosíme o nový výběr', en: 'Please choose again' },
  'mail.rozhodnuti.vraceno.nadpis': { cs: 'Prosíme o nový výběr termínů', en: 'Please choose your sessions again' },
  'mail.rozhodnuti.vraceno.uvod': {
    cs: 'potřebovali bychom váš výběr ještě jednou upravit.',
    en: 'we need to adjust your choice of sessions once more.',
  },
  'mail.rozhodnuti.zamitnuto.stitek': { cs: 'Výběr zamítnut', en: 'Choice declined' },
  'mail.rozhodnuti.zamitnuto.nadpis': { cs: 'Výběr termínů zamítnut', en: 'Your choice of sessions was declined' },
  'mail.rozhodnuti.zamitnuto.uvod': {
    cs: 'váš výběr termínů se bohužel nepodařilo potvrdit.',
    en: 'unfortunately your choice of sessions could not be confirmed.',
  },
  'mail.rozhodnuti.preheader': { cs: '{nadpis} — {projekt}.', en: '{nadpis} — {projekt}.' },
  'mail.rozhodnuti.predmet': { cs: '{nadpis} — {projekt}', en: '{nadpis} — {projekt}' },
  'mail.rozhodnuti.termin': { cs: 'Termín', en: 'Session' },

  // --- pozvánka na natáčení pro hosta (30. 9. 2026) ---
  // Host je člověk zvenčí: klient, agentura, zadavatel. Přijde do studia,
  // nebo se připojí na dálku - podle toho se v mailu prohodí pořadí: kdo jde
  // do studia, čte nejdřív adresu a parkování; kdo se připojuje, odkaz.
  'mail.pozvankaNataceni.stitek': { cs: 'Pozvánka na natáčení', en: 'Recording invitation' },
  'mail.pozvankaNataceni.predmet': { cs: 'Natáčení {projekt} — {kdy}', en: 'Recording {projekt} — {kdy}' },
  'mail.pozvankaNataceni.predmetZmena': {
    cs: 'ZMĚNA termínu: natáčení {projekt} — {kdy}',
    en: 'CHANGED time: recording {projekt} — {kdy}',
  },
  'mail.pozvankaNataceni.preheader': { cs: '{kdy}, {studio}.', en: '{kdy}, {studio}.' },
  // JEDEN TEXT PRO VŠECHNY (9. 10. 2026) - klient se na poslední chvíli
  // rozmyslí, že nepřijde osobně, ale připojí se, a pozvánka mu pak nesmí
  // tvrdit, že se těšíme ve studiu.
  'mail.pozvankaNataceni.uvod': {
    cs: 'Dobrý den, zasíláme Vám pozvánku na natáčení v našem studiu.',
    en: 'Hello, here is your invitation to a recording session at our studio.',
  },
  // Jen holé sdělení (10. 10. 2026) - nový čas je hned pod tím v přehledu
  // a věta o tom, co s tím starým, klienta jen poučovala.
  'mail.pozvankaNataceni.uvodZmena': {
    cs: 'Dobrý den, termín natáčení se změnil.',
    en: 'Hello, the recording has been rescheduled.',
  },
  'mail.pozvankaNataceni.kdy': { cs: 'Kdy', en: 'When' },
  'mail.pozvankaNataceni.kde': { cs: 'Kde', en: 'Where' },
  'mail.pozvankaNataceni.projekt': { cs: 'Projekt', en: 'Project' },
  'mail.pozvankaNataceni.herec': { cs: 'Herec', en: 'Narrator' },
  'mail.pozvankaNataceni.parkovani': { cs: 'Parkování', en: 'Parking' },
  'mail.pozvankaNataceni.ucastnici': { cs: 'Účastníci', en: 'Attendees' },
  // Název záznamu v kalendáři hosta - krátký, před něj se lepí název projektu.
  'mail.pozvankaNataceni.kalendarNazev': { cs: 'Natáčení', en: 'Recording' },
  'mail.pozvankaNataceni.pripojitSe': {
    cs: 'Připojit se k natáčení online',
    en: 'Join the recording online',
  },
  'mail.pozvankaNataceni.pridatDoKalendare': { cs: 'Přidat do kalendáře', en: 'Add to calendar' },
  'mail.pozvankaNataceni.otevritMapu': { cs: 'Otevřít v mapách', en: 'Open in maps' },
  'mail.pozvankaNataceni.odkazPlati': {
    cs: 'Odkaz platí po celou dobu natáčení, otevřete ho klidně o pár minut dřív.',
    en: 'The link works for the whole session, so feel free to open it a few minutes early.',
  },
  'mail.pozvankaNataceni.kalendar': {
    cs: 'Totéž najdete v příloze mailu. Když termín přesuneme, odkaz už povede na nový čas.',
    en: 'The same file is attached. If we move the session, this link will already point to the new time.',
  },
  'mail.pozvankaNataceni.kdyzNeco': {
    cs: 'Kdyby se něco změnilo, ozvěte se nám odpovědí na tenhle e-mail.',
    en: 'If anything changes, just reply to this email.',
  },
  'mail.rozhodnuti.vzkaz': { cs: 'Vzkaz produkce:', en: 'Message from production:' },
  'mail.rozhodnuti.studio': { cs: 'Studio: {studio}', en: 'Studio: {studio}' },
  'mail.rozhodnuti.vybratZnovu': { cs: 'Vybrat termíny znovu', en: 'Choose sessions again' },
  'mail.rozhodnuti.zobrazit': { cs: 'Zobrazit termíny', en: 'View sessions' },
  'mail.rozhodnuti.doKalendare': { cs: 'Přidat do kalendáře', en: 'Add to calendar' },
  'mail.rozhodnuti.oKalendari': {
    cs: 'Termíny se přidají do kalendáře v telefonu nebo počítači. Na stránce termínů si je můžete i odebírat - když se něco změní, kalendář se upraví sám.',
    en: 'The sessions are added to the calendar on your phone or computer. You can also subscribe to them on the sessions page — if anything changes, the calendar updates itself.',
  },
  'mail.rozhodnuti.textKalendar': { cs: 'Přidat do kalendáře: {odkaz}', en: 'Add to calendar: {odkaz}' },

  // Rodny list reklamniho spotu. Nazev stavu ({stav}) je v databazi cesky
  // a schvalne se NEPREKLADA - viz STAVY_PROJEKTU v lib/stavyProjektu.ts.
  'mail.rodnyList.stitek': { cs: 'Projekt ke schválení', en: 'Project for approval' },
  'mail.rodnyList.termin': { cs: 'rodný list', en: 'advert record' },
  'mail.rodnyList.preheader': {
    cs: '{projekt} je hotový — nahrávky i rodný list jsou připravené.',
    en: '{projekt} is finished — the recordings and the advert record are ready.',
  },
  'mail.rodnyList.uvod': {
    cs: 'nahrávku máme hotovou. Projekt je ve stavu {stav} — nahrávky jsou připravené a spolu s nimi posíláme i {rodnyList} s údaji o délce, režii a použité hudbě.',
    en: 'the recording is finished. The project is at status {stav} — the recordings are ready and we are sending the {rodnyList} along with them, with the details of length, direction and the music used.',
  },
  'mail.rodnyList.projekt': { cs: 'Projekt', en: 'Project' },
  'mail.rodnyList.stav': { cs: 'Stav', en: 'Status' },
  'mail.rodnyList.otevrit': { cs: 'Otevřít rodný list (PDF)', en: 'Open the advert record (PDF)' },
  'mail.rodnyList.naNahravky': { cs: 'Přejít na nahrávky →', en: 'Go to the recordings →' },
  'mail.rodnyList.patka': {
    cs: 'Kdyby vám v rodném listu nebo v nahrávkách cokoliv nesedělo, stačí na tenhle e-mail odpovědět — rádi to opravíme.',
    en: 'If anything in the advert record or in the recordings does not look right, just reply to this email — we will gladly put it right.',
  },
  'mail.rodnyList.predmet': { cs: '{projekt} — hotovo, ke schválení', en: '{projekt} — finished, for approval' },
  'mail.rodnyList.textUvod': {
    cs: 'nahravku {projekt} mame hotovou - projekt je ve stavu "{stav}".',
    en: 'the {projekt} recording is finished - the project is at status "{stav}".',
  },
  'mail.rodnyList.textRodnyList': { cs: 'Rodny list (PDF):', en: 'Advert record (PDF):' },
  'mail.rodnyList.textNahravky': { cs: 'Pripravene nahravky:', en: 'Recordings ready:' },

  // Zprava o zmene stavu projektu. Telo zpravy si pise produkce ve vzoru
  // a je v databazi - preklada se jen to, co je natvrdo v kodu.
  'mail.stav.stitek': { cs: 'MS Portal - {stav}', en: 'MS Portal - {stav}' },
  'mail.stav.predmet': { cs: '{projekt} - {stav}', en: '{projekt} - {stav}' },
  'mail.stav.preposlechnout': { cs: 'Přeposlechnout v AudioTaggeru', en: 'Proof-listen in AudioTagger' },
  'mail.stav.stahnoutZeSlozky': { cs: 'Stáhnout nahrávky ze složky', en: 'Download the recordings from the folder' },
  'mail.stav.schvalit': { cs: 'Schválit', en: 'Approve' },
  'mail.stav.bezOdkazu': {
    cs: 'Odkaz na složku zatím u projektu není vyplněný.',
    en: 'No folder link has been filled in for this project yet.',
  },
  'mail.stav.interniZprava': {
    cs: 'Tohle je interní zpráva — klientovi nic nešlo.',
    en: 'This is an internal message — nothing was sent to the client.',
  },
  'mail.stav.taggerNadpis': {
    cs: 'AudioTagger — přeposlech v prohlížeči',
    en: 'AudioTagger — proof-listening in your browser',
  },
  'mail.stav.taggerKrok1': {
    cs: 'Nahrávka se pustí hned, nic se nestahuje.',
    en: 'The recording plays straight away, nothing is downloaded.',
  },
  'mail.stav.taggerKrok2': {
    cs: 'Text běží vedle — chybu v něm rovnou označíte a nám sedí na vteřinu.',
    en: 'The script runs alongside — you tag a mistake right there and it reaches us timed to the second.',
  },
  'mail.stav.taggerKrok3': {
    cs: 'Na konci kliknete na Přeposlechnuto a my se do oprav pustíme.',
    en: 'At the end you click Proof-listened and we get on with the corrections.',
  },
  'mail.stav.textInterni': {
    cs: 'INTERNI ZPRAVA - klientovi nic neslo.',
    en: 'INTERNAL MESSAGE - nothing was sent to the client.',
  },
  'mail.stav.textPreposlech': {
    cs: 'Preposlech v AudioTaggeru: {odkaz}',
    en: 'Proof-listening in AudioTagger: {odkaz}',
  },
  'mail.stav.textTagger': {
    cs: 'Nahravka se pusti hned v prohlizeci, text bezi vedle, chybu v nem rovnou oznacite. Na konci kliknete na Preposlechnuto.',
    en: 'The recording plays straight away in your browser, the script runs alongside, you tag a mistake right there. At the end you click Proof-listened.',
  },
  'mail.stav.textSlozka': { cs: 'Slozka s nahravkami', en: 'Folder with the recordings' },
  'mail.stav.textBezOdkazu': {
    cs: 'Odkaz na nahravky zatim neni vyplneny.',
    en: 'No recordings link has been filled in yet.',
  },
  'mail.stav.textSchvalit': { cs: 'Schválit: {odkaz}', en: 'Approve: {odkaz}' },

  // Zadost o udaje odkazem a zprava o tom, ze je nekdo vyplnil.
  'mail.udaje.stitek': { cs: 'Vaše údaje', en: 'Your details' },
  'mail.udaje.preheader': {
    cs: 'Formulář na vyplnění údajů pro Mediaspace.',
    en: 'A form for filling in your details for Mediaspace.',
  },
  'mail.udaje.zadostHerec': {
    cs: 'potřebujeme od vás pár údajů do smlouvy a k výplatě honoráře. Vyplnění zabere dvě minuty a jde to i z telefonu.',
    en: 'we need a few details from you for the contract and for paying your fee. It takes two minutes and works from a phone too.',
  },
  'mail.udaje.zadostFirma': {
    cs: 'potřebujeme od vás fakturační údaje. Stačí zadat IČ, zbytek se doplní z obchodního rejstříku sám.',
    en: 'we need your invoicing details. Just enter the company registration number and the rest is filled in from the companies register on its own.',
  },
  'mail.udaje.tlacitko': { cs: 'Vyplnit údaje', en: 'Fill in your details' },
  'mail.udaje.patka': {
    cs: 'Odkaz je jen pro vás a platí do {platiDo}. Nikam se nepřihlašujete.',
    en: 'This link is for you alone and is valid until {platiDo}. There is nothing to log in to.',
  },
  'mail.udaje.predmet': { cs: 'Vyplnte prosim sve udaje - Mediaspace', en: 'Please fill in your details - Mediaspace' },
  'mail.udaje.textPlatiDo': { cs: 'Odkaz plati do {platiDo}.', en: 'The link is valid until {platiDo}.' },
  'mail.udaje.stitekHotovo': { cs: 'Údaje vyplněny', en: 'Details filled in' },
  'mail.udaje.stitekCeka': { cs: 'Údaje čekají', en: 'Details waiting' },
  'mail.udaje.preheaderVyplnil': { cs: '{kdo} vyplnil údaje.', en: '{kdo} has filled in their details.' },
  'mail.udaje.vyplnenoHotovo': {
    cs: '{kdo} vyplnil(a) své údaje a portál je má zapsané.',
    en: '{kdo} has filled in their details and the portal has them saved.',
  },
  'mail.udaje.vyplnenoCekaJeden': {
    cs: '{kdo} vyplnil(a) své údaje. Jeden údaj mění to, co už bylo vyplněné — proto to čeká na vaše odkliknutí.',
    en: '{kdo} has filled in their details. One of them changes something already on file — so it is waiting for you to sign it off.',
  },
  'mail.udaje.vyplnenoCekaVice': {
    cs: '{kdo} vyplnil(a) své údaje. {pocet} údajů mění to, co už bylo vyplněné — proto to čeká na vaše odkliknutí.',
    en: '{kdo} has filled in their details. {pocet} of them change something already on file — so it is waiting for you to sign it off.',
  },
  'mail.udaje.zobrazit': { cs: 'Zobrazit údaje', en: 'View the details' },
  'mail.udaje.odkliknout': { cs: 'Odkliknout změny', en: 'Sign off the changes' },
  'mail.udaje.predmetHotovo': { cs: 'Udaje vyplneny - {kdo}', en: 'Details filled in - {kdo}' },
  'mail.udaje.predmetCeka': {
    cs: 'Udaje cekaji na odklepnuti - {kdo}',
    en: 'Details waiting to be signed off - {kdo}',
  },

  // Predani preposlechu a nove stopy k preposlechu.
  'mail.preposlech.stitek': { cs: 'Přeposlech', en: 'Proof-listening' },
  'mail.preposlech.preheader': {
    cs: 'Přeposlech nahrávky {projekt}',
    en: 'Proof-listening for the {projekt} recording',
  },
  'mail.preposlech.predalVam': {
    cs: '{kdo} vám předal(a) přeposlech nahrávky „{projekt}".',
    en: '{kdo} has passed you the proof-listening for the “{projekt}” recording.',
  },
  'mail.preposlech.dostavate': {
    cs: 'Dostáváte přeposlech nahrávky „{projekt}".',
    en: 'You have been given the proof-listening for the “{projekt}” recording.',
  },
  'mail.preposlech.jakTo': {
    cs: 'Nahrávka se pustí hned v prohlížeči, text běží vedle a chybu v něm rovnou označíte. Nikam se nepřihlašujete.',
    en: 'The recording plays straight away in your browser, the script runs alongside and you tag a mistake right there. There is nothing to log in to.',
  },
  'mail.preposlech.tlacitko': { cs: 'Otevřít přeposlech', en: 'Open the proof-listening' },
  'mail.preposlech.patka': {
    cs: 'Až u nahrávky přibudou nové stopy, dáme vám vědět na tenhle e-mail.',
    en: 'When new tracks are added to the recording, we will let you know at this email address.',
  },
  'mail.preposlech.predmet': { cs: 'Preposlech: {projekt}', en: 'Proof-listening: {projekt}' },
  'mail.stopy.stitek': { cs: 'Nové stopy', en: 'New tracks' },
  'mail.stopy.pocetJedna': { cs: 'přibyla 1 nová stopa', en: '1 new track has been added' },
  'mail.stopy.pocetMalo': { cs: 'přibyly {pocet} nové stopy', en: '{pocet} new tracks have been added' },
  'mail.stopy.pocetMnoho': { cs: 'přibylo {pocet} nových stop', en: '{pocet} new tracks have been added' },
  'mail.stopy.veta': {
    cs: 'u nahrávky „{projekt}" {kolik} k přeposlechu (celkem {celkem}).',
    en: '{kolik} for proof-listening on the “{projekt}” recording ({celkem} in total).',
  },
  'mail.stopy.tlacitko': { cs: 'Pokračovat v přeposlechu', en: 'Carry on proof-listening' },
  'mail.stopy.patka': {
    cs: 'AudioTagger si pamatuje, kde jste skončili.',
    en: 'AudioTagger remembers where you left off.',
  },
  'mail.stopy.predmet': {
    cs: 'Nove stopy k preposlechu: {projekt}',
    en: 'New tracks to proof-listen: {projekt}',
  },

  // Nova odpoved klientovi v chatu projektu.
  'mail.odpoved.stitek': { cs: 'Nová zpráva', en: 'New message' },
  'mail.odpoved.veta': {
    cs: '{odKoho} vám odpověděl(a) u projektu „{projekt}".',
    en: '{odKoho} has replied on the “{projekt}” project.',
  },
  'mail.odpoved.tlacitko': { cs: 'Otevřít zprávu v portálu', en: 'Open the message in the portal' },
  'mail.odpoved.patka': {
    cs: 'Další upozornění pošleme, teprve až si zprávy přečtete — psaní tam a zpátky vám schránku nezahltí.',
    en: 'We will only send another notification once you have read your messages — a conversation back and forth will not flood your inbox.',
  },
  'mail.odpoved.predmet': { cs: 'Nova zprava k projektu: {projekt}', en: 'New message on project: {projekt}' },

  // Upominka k fakture po splatnosti. PREDMET I TELO SI PISE UZIVATEL
  // v administraci a jsou v databazi - preklada se jen obal kolem nich.
  'mail.upominka.stitek': { cs: 'Upomínka', en: 'Payment reminder' },
  'mail.upominka.preheader': { cs: 'Faktura {cislo} je po splatnosti.', en: 'Invoice {cislo} is overdue.' },
  'mail.upominka.odznak': { cs: 'Faktura {cislo}', en: 'Invoice {cislo}' },
  'mail.upominka.cisloFaktury': { cs: 'Číslo faktury', en: 'Invoice number' },
  'mail.upominka.kUhrade': { cs: 'K úhradě', en: 'Amount due' },
  'mail.upominka.splatnost': { cs: 'Splatnost', en: 'Due date' },
  'mail.upominka.tlacitko': { cs: 'Otevřít fakturu', en: 'Open the invoice' },
  // --- pozvánka, objednávka, heslo, nabídka, faktura, smlouva, bonus ---
  //
  // PROSTÝ TEXT MÁ VLASTNÍ KLÍČE (`text…`). Textová varianta našich mailů je
  // od začátku psaná BEZ DIAKRITIKY. Čeština je zdroj pravdy, takže se
  // s HTML variantou neslučuje, i když je věta jinak stejná - sloučením by
  // se česká textová varianta tiše změnila.

  /** Pozdrav v prostém textu nabídky - bez diakritiky, viz poznámka výš. */
  'mail.textPozdravBezJmena': { cs: 'Dobry den,', en: 'Hello,' },

  // --- objednávka: interní zpráva týmu (sendOrderNotificationEmail) ---
  'mail.objednavkaInterni.stitek': {
    cs: 'MS Portal - Objednávka audioknihy',
    en: 'MS Portal - Audiobook order',
  },
  'mail.objednavkaInterni.odznak': { cs: 'Nová objednávka', en: 'New order' },
  'mail.objednavkaInterni.firma': { cs: 'Firma', en: 'Company' },
  'mail.objednavkaInterni.normostrany': { cs: 'Počet normostran', en: 'Standard pages' },
  'mail.objednavkaInterni.cena': { cs: 'Předběžná cena', en: 'Estimated price' },
  'mail.objednavkaInterni.termin': { cs: 'Termín odevzdání', en: 'Delivery deadline' },
  'mail.objednavkaInterni.herec': { cs: 'Preferovaný herec', en: 'Preferred narrator' },
  'mail.objednavkaInterni.poznamka': { cs: 'Poznámka klienta', en: 'Client note' },
  'mail.objednavkaInterni.priloha': { cs: 'Příloha', en: 'Attachment' },
  'mail.objednavkaInterni.prilohaNazev': { cs: 'příloha', en: 'attachment' },
  'mail.objednavkaInterni.jmeno': { cs: 'Jméno', en: 'Name' },
  'mail.objednavkaInterni.email': { cs: 'E-mail', en: 'Email' },
  'mail.objednavkaInterni.prijato': { cs: 'Přijato', en: 'Received' },
  'mail.objednavkaInterni.otevritProjekt': { cs: 'Otevřít v projektech →', en: 'Open in projects →' },
  'mail.objednavkaInterni.otevritFirmu': {
    cs: 'Otevřít firmu v adminu →',
    en: 'Open the company in the admin →',
  },
  'mail.objednavkaInterni.patka': {
    cs: 'automatická notifikace z MS Portal, neodpovídat',
    en: 'automatic notification from MS Portal, do not reply',
  },
  'mail.objednavkaInterni.predmet': {
    cs: 'Objednávka audioknihy – {nazev}',
    en: 'Audiobook order – {nazev}',
  },
  'mail.objednavkaInterni.textNadpis': {
    cs: 'Nova objednavka audioknihy - {firma}',
    en: 'New audiobook order - {firma}',
  },
  'mail.objednavkaInterni.textNazev': { cs: 'Nazev: {hodnota}', en: 'Title: {hodnota}' },
  'mail.objednavkaInterni.textNormostrany': {
    cs: 'Pocet normostran: {hodnota}',
    en: 'Standard pages: {hodnota}',
  },
  'mail.objednavkaInterni.textCena': {
    cs: 'Predbezna cena: {hodnota}',
    en: 'Estimated price: {hodnota}',
  },
  'mail.objednavkaInterni.textTermin': {
    cs: 'Datum odevzdani: {hodnota}',
    en: 'Delivery date: {hodnota}',
  },
  'mail.objednavkaInterni.textHerec': {
    cs: 'Preferovany herec: {hodnota}',
    en: 'Preferred narrator: {hodnota}',
  },
  'mail.objednavkaInterni.textPoznamka': { cs: 'Poznamka: {hodnota}', en: 'Note: {hodnota}' },
  'mail.objednavkaInterni.textPriloha': { cs: 'Priloha: {hodnota}', en: 'Attachment: {hodnota}' },
  'mail.objednavkaInterni.textBezPrilohy': { cs: 'zadna', en: 'none' },
  'mail.objednavkaInterni.textJmeno': { cs: 'Jmeno: {hodnota}', en: 'Name: {hodnota}' },
  'mail.objednavkaInterni.textObjednal': { cs: 'Objednal: {hodnota}', en: 'Ordered by: {hodnota}' },
  'mail.objednavkaInterni.textProjekt': { cs: 'Projekt: {hodnota}', en: 'Project: {hodnota}' },

  // --- pozvánka do portálu (sendInviteEmail) ---
  // Pozvánka pro BOOKING chodí anglicky vždycky (zadání 25. 9. 2026), proto má
  // i české varianty, které se dnes nikde nevykreslí - slovník je má mít celé.
  'mail.pozvanka.stitek': { cs: 'Pozvánka do portálu', en: 'Portal invitation' },
  'mail.pozvanka.stitekInterni': { cs: 'Interní přístup', en: 'Internal access' },
  'mail.pozvanka.stitekBooking': { cs: 'Rezervace studia', en: 'Studio booking' },
  'mail.pozvanka.odznak': { cs: 'Nový přístup', en: 'New access' },
  'mail.pozvanka.odznakInterni': { cs: 'Interní účet', en: 'Internal account' },
  'mail.pozvanka.nadpis': { cs: 'Vítejte v MS Portalu', en: 'Welcome to MS Portal' },
  'mail.pozvanka.nadpisInterni': { cs: 'Váš přístup do MS Portalu', en: 'Your MS Portal access' },
  'mail.pozvanka.nadpisBooking': {
    cs: 'Váš kalendář studia je připravený',
    en: 'Your studio calendar is ready',
  },
  'mail.pozvanka.uvodKlient': {
    cs: 'připravili jsme vám přístup do klientského portálu Mediaspace. Heslo si nastavíte sami - stačí jedno kliknutí.',
    en: 'we have set up your access to the Mediaspace client portal. Choose your own password — it takes one click.',
  },
  'mail.pozvanka.uvodInterni': {
    cs: 'založili jsme ti interní účet do MS Portalu. Heslo si nastavíš sám - stačí jedno kliknutí.',
    en: 'we have set up an internal MS Portal account for you. Choose your own password — it takes one click.',
  },
  'mail.pozvanka.uvodHerec': {
    cs: 'založili jsme vám účet do MS Portalu, kde vedeme spolupráci s herci. Heslo si nastavíte sami - stačí jedno kliknutí.',
    en: 'we have set up an MS Portal account for you, where we organise our work with narrators. Choose your own password — it takes one click.',
  },
  'mail.pozvanka.uvodBooking': {
    cs: 'připravili jsme vám přístup do rezervačního kalendáře studia Mediaspace. Heslo si nastavíte sami - stačí jedno kliknutí.',
    en: 'we have set up your access to the Mediaspace studio booking calendar. Choose your own password — it takes one click.',
  },
  'mail.pozvanka.seznamNadpis': { cs: 'Co v portálu najdete', en: 'What you will find in the portal' },
  'mail.pozvanka.seznamNadpisInterni': {
    cs: 'Co v portálu najdeš',
    en: 'What you will find in the portal',
  },
  'mail.pozvanka.seznamNadpisBooking': { cs: 'Co tam zvládnete', en: 'What you can do there' },
  'mail.pozvanka.klientBod1': {
    cs: 'Přehled vašich projektů a jejich stavu',
    en: 'An overview of your projects and where they stand',
  },
  'mail.pozvanka.klientBod2': {
    cs: 'Objednávkový formulář s předběžnou cenou',
    en: 'An order form with an estimated price',
  },
  'mail.pozvanka.klientBod3': {
    cs: 'Hotové i rozpracované nahrávky ke stažení',
    en: 'Finished and work-in-progress recordings to download',
  },
  'mail.pozvanka.interniBod1': {
    cs: 'Přehled všech projektů z Caflou - aktivní i dokončené',
    en: 'An overview of all Caflou projects - active and completed',
  },
  'mail.pozvanka.interniBod2': {
    cs: 'Detail projektu: manažer, priorita, typ zakázky a odkaz na KZ',
    en: 'Project detail: manager, priority, job type and a link to the KZ',
  },
  'mail.pozvanka.interniBod3': {
    cs: 'Správu firem a uživatelů (podle role)',
    en: 'Company and user administration (depending on your role)',
  },
  'mail.pozvanka.bookingBod1': {
    cs: 'Uvidíte, kdy je studio volné, a rovnou si ho zarezervujete',
    en: 'See when the studio is free and book it straight away',
  },
  'mail.pozvanka.bookingBod2': {
    cs: 'Rezervovat můžete po hodinách i celé dny na delší projekt',
    en: 'Book by the hour or take whole days for a longer project',
  },
  'mail.pozvanka.bookingBod3': {
    cs: 'Kalendář si přidáte do telefonu jako aplikaci a rezervace spravujete i na cestách',
    en: 'Add the calendar to your phone as an app and manage bookings on the move',
  },
  'mail.pozvanka.preheader': {
    cs: 'Váš přístup do MS Portalu je připravený - stačí si nastavit heslo.',
    en: 'Your MS Portal access is ready — just choose a password.',
  },
  'mail.pozvanka.preheaderBooking': {
    cs: 'Váš rezervační kalendář studia je připravený - stačí si nastavit heslo.',
    en: 'Your studio booking calendar is ready — just choose a password.',
  },
  'mail.pozvanka.prihlasovaciJmeno': { cs: 'Přihlašovací jméno', en: 'Username' },
  'mail.pozvanka.odkazPlatiDo': { cs: 'Odkaz platí do', en: 'Link valid until' },
  'mail.pozvanka.nastavitHeslo': { cs: 'Nastavit heslo', en: 'Choose a password' },
  'mail.pozvanka.zaver': {
    cs: 'Pokud odkaz vyprší, napište nám a pošleme vám nový. Tuto pozvánku jste dostali, protože pro vás Mediaspace založila účet - pokud si ji neumíte vysvětlit, dejte nám prosím vědět.',
    en: 'If the link expires, write to us and we will send a new one. You have received this invitation because Mediaspace set up an account for you — if it looks unfamiliar, please let us know.',
  },
  'mail.pozvanka.zaverInterni': {
    cs: 'Pokud odkaz vyprší, řekni si o nový. Kdyby něco nefungovalo, dej vědět.',
    en: 'If the link expires, just ask for a new one. If anything does not work, let us know.',
  },
  'mail.pozvanka.predmet': { cs: 'Pozvánka do MS Portalu', en: 'Invitation to MS Portal' },
  'mail.pozvanka.predmetInterni': { cs: 'Přístup do MS Portalu', en: 'Your MS Portal access' },
  'mail.pozvanka.predmetBooking': {
    cs: 'Rezervační kalendář studia Mediaspace',
    en: 'Your Mediaspace studio booking calendar',
  },
  'mail.pozvanka.textUvod': {
    cs: 'pripravili jsme vam pristup do portalu Mediaspace (MS Portal).',
    en: 'your access to the Mediaspace portal (MS Portal) is ready.',
  },
  'mail.pozvanka.textUvodBooking': {
    cs: 'pripravili jsme vam pristup do rezervacniho kalendare studia Mediaspace.',
    en: 'your access to the Mediaspace studio booking calendar is ready.',
  },
  'mail.pozvanka.textJmeno': { cs: 'Prihlasovaci jmeno: {hodnota}', en: 'Username: {hodnota}' },
  'mail.pozvanka.textHeslo': { cs: 'Heslo si nastavite zde:', en: 'Choose your password here:' },
  'mail.pozvanka.textPlatnost': {
    cs: 'Odkaz plati do {datum}.',
    en: 'The link is valid until {datum}.',
  },

  // --- potvrzení objednávky klientovi (sendOrderConfirmationEmail) ---
  'mail.objednavkaPotvrzeni.stitek': { cs: 'Objednávka audioknihy', en: 'Audiobook order' },
  'mail.objednavkaPotvrzeni.stitekJina': { cs: 'Objednávka', en: 'Order' },
  'mail.objednavkaPotvrzeni.preheader': {
    cs: 'Objednávku {nazev} jsme přijali.',
    en: 'We have received your order {nazev}.',
  },
  'mail.objednavkaPotvrzeni.odznak': { cs: 'Objednávka přijata', en: 'Order received' },
  'mail.objednavkaPotvrzeni.nadpis': { cs: 'Máme vaši objednávku', en: 'We have your order' },
  'mail.objednavkaPotvrzeni.uvod': {
    cs: 'děkujeme za objednávku. Přijali jsme ji a ozveme se vám s potvrzením termínu.',
    en: 'thank you for your order. We have received it and will be in touch to confirm the deadline.',
  },
  'mail.objednavkaPotvrzeni.uvodAudiokniha': {
    cs: 'děkujeme za objednávku. Přijali jsme ji a ozveme se vám s potvrzením termínu a konečné ceny.',
    en: 'thank you for your order. We have received it and will be in touch to confirm the deadline and the final price.',
  },
  'mail.objednavkaPotvrzeni.nazev': { cs: 'Název', en: 'Title' },
  'mail.objednavkaPotvrzeni.normostrany': { cs: 'Počet normostran', en: 'Standard pages' },
  'mail.objednavkaPotvrzeni.cena': { cs: 'Předběžná cena', en: 'Estimated price' },
  'mail.objednavkaPotvrzeni.termin': { cs: 'Termín odevzdání', en: 'Delivery deadline' },
  'mail.objednavkaPotvrzeni.herec': { cs: 'Preferovaný herec', en: 'Preferred narrator' },
  'mail.objednavkaPotvrzeni.poznamka': { cs: 'Poznámka', en: 'Note' },
  'mail.objednavkaPotvrzeni.priloha': { cs: 'Příloha', en: 'Attachment' },
  'mail.objednavkaPotvrzeni.tlacitko': { cs: 'Zobrazit v portálu →', en: 'View in the portal →' },
  'mail.objednavkaPotvrzeni.cenaPoznamka': {
    cs: 'Uvedená cena je předběžná - vychází z počtu normostran a vaší sjednané sazby. Konečnou cenu potvrdíme po kontrole podkladů.',
    en: 'The price shown is an estimate - it is based on the number of standard pages and your agreed rate. We will confirm the final price once we have checked the materials.',
  },
  'mail.objednavkaPotvrzeni.automat': {
    cs: 'Tento e-mail je automatické potvrzení z MS Portalu. Když něco nesedí, odpovězte nám nebo napište na {adresa}.',
    en: 'This email is an automatic confirmation from MS Portal. If something does not look right, reply to us or write to {adresa}.',
  },
  'mail.objednavkaPotvrzeni.predmet': {
    cs: 'Potvrzení objednávky – {nazev}',
    en: 'Order confirmation – {nazev}',
  },
  'mail.objednavkaPotvrzeni.textUvod': {
    cs: 'dekujeme za objednavku, prijali jsme ji.',
    en: 'thank you for your order, we have received it.',
  },
  'mail.objednavkaPotvrzeni.textNazev': { cs: 'Nazev: {hodnota}', en: 'Title: {hodnota}' },
  'mail.objednavkaPotvrzeni.textNormostrany': {
    cs: 'Pocet normostran: {hodnota}',
    en: 'Standard pages: {hodnota}',
  },
  'mail.objednavkaPotvrzeni.textCena': {
    cs: 'Predbezna cena: {hodnota}',
    en: 'Estimated price: {hodnota}',
  },
  'mail.objednavkaPotvrzeni.textTermin': {
    cs: 'Termin odevzdani: {hodnota}',
    en: 'Delivery deadline: {hodnota}',
  },
  'mail.objednavkaPotvrzeni.textHerec': {
    cs: 'Preferovany herec: {hodnota}',
    en: 'Preferred narrator: {hodnota}',
  },
  'mail.objednavkaPotvrzeni.textPoznamka': { cs: 'Poznamka: {hodnota}', en: 'Note: {hodnota}' },
  'mail.objednavkaPotvrzeni.textZaver': {
    cs: 'Ozveme se vam s potvrzenim terminu.',
    en: 'We will be in touch to confirm the deadline.',
  },

  // --- zapomenuté heslo (sendPasswordResetEmail) ---
  'mail.heslo.stitek': { cs: 'Obnovení hesla', en: 'Password reset' },
  'mail.heslo.preheader': {
    cs: 'Odkaz pro nastavení nového hesla do MS Portalu.',
    en: 'A link to set a new MS Portal password.',
  },
  'mail.heslo.odznak': { cs: 'Nové heslo', en: 'New password' },
  'mail.heslo.nadpis': { cs: 'Nastavení nového hesla', en: 'Setting a new password' },
  'mail.heslo.veta': {
    cs: 'někdo (snad vy) požádal o nové heslo k účtu {ucet} v MS Portalu. Nastavíte si ho tímto odkazem:',
    en: 'someone (hopefully you) has asked for a new password for the account {ucet} in MS Portal. You can set it using this link:',
  },
  'mail.heslo.tlacitko': { cs: 'Nastavit nové heslo', en: 'Set a new password' },
  'mail.heslo.platnost': {
    cs: 'Odkaz platí do {datum}. Pokud jste o nové heslo nežádali, nemusíte nic dělat - stávající heslo zůstává v platnosti a odkaz po uplynutí té doby přestane fungovat.',
    en: 'The link is valid until {datum}. If you did not ask for a new password, you do not need to do anything - your current password stays valid and the link stops working once that time has passed.',
  },
  'mail.heslo.predmet': { cs: 'Nové heslo do MS Portalu', en: 'New MS Portal password' },
  'mail.heslo.textVeta': {
    cs: 'nekdo pozadal o nove heslo k uctu {ucet} v MS Portalu.',
    en: 'someone has asked for a new password for the account {ucet} in MS Portal.',
  },
  'mail.heslo.textOdkaz': { cs: 'Nastavite si ho zde:', en: 'You can set it here:' },
  'mail.heslo.textPlatnost': {
    cs: 'Odkaz plati do {datum}.',
    en: 'The link is valid until {datum}.',
  },
  'mail.heslo.textKdyzNezadal': {
    cs: 'Pokud jste o nove heslo nezadali, nemusite nic delat.',
    en: 'If you did not ask for a new password, you do not need to do anything.',
  },

  // --- dotočeno: zpráva pro tým (sendHerecDotocenEmail) ---
  'mail.dotoceno.stitek': { cs: 'Dotočeno', en: 'Recording finished' },
  'mail.dotoceno.preheader': {
    cs: '{herec} dotočil {projekt}.',
    en: '{herec} has finished recording {projekt}.',
  },
  'mail.dotoceno.odznak': { cs: 'Dotočeno', en: 'Recording finished' },
  'mail.dotoceno.nadpis': { cs: '{herec} má dotočeno', en: '{herec} has finished recording' },
  'mail.dotoceno.projekt': { cs: 'Projekt', en: 'Project' },
  'mail.dotoceno.firma': { cs: 'Firma', en: 'Company' },
  'mail.dotoceno.herec': { cs: 'Herec', en: 'Narrator' },
  'mail.dotoceno.odskrtl': { cs: 'Odškrtl(a)', en: 'Marked by' },
  'mail.dotoceno.tlacitko': { cs: 'Otevřít projekt', en: 'Open the project' },
  'mail.dotoceno.komuChodi': {
    cs: 'Tahle zpráva chodí každému, kdo má na kartě uživatele zaškrtnuté „Dostává zprávy o dotočení".',
    en: 'This message goes to everyone who has „Receives recording-finished messages" ticked on their user card.',
  },
  'mail.dotoceno.predmet': {
    cs: 'Dotočeno - {herec} - {projekt}',
    en: 'Recording finished - {herec} - {projekt}',
  },
  'mail.dotoceno.textNadpis': { cs: '{herec} ma dotoceno.', en: '{herec} has finished recording.' },
  'mail.dotoceno.textProjekt': { cs: 'Projekt: {projekt}', en: 'Project: {projekt}' },
  'mail.dotoceno.textProjektSFirmou': {
    cs: 'Projekt: {projekt} ({firma})',
    en: 'Project: {projekt} ({firma})',
  },
  'mail.dotoceno.textOdskrtl': { cs: 'Odskrtl(a): {kdo}', en: 'Marked by: {kdo}' },

  // --- dotočeno: zpráva pro klienta (sendHerecDotocenKlientoviEmail) ---
  'mail.dotocenoKlient.preheader': {
    cs: '{projekt} — dotočeno, {herec}.',
    en: '{projekt} — recording finished, {herec}.',
  },
  'mail.dotocenoKlient.veta': {
    cs: 'právě jsme dokončili natáčení s {herec}.',
    en: 'we have just finished recording with {herec}.',
  },
  'mail.dotocenoKlient.vetaBezJmena': {
    cs: 'právě jsme dokončili natáčení.',
    en: 'we have just finished recording.',
  },
  'mail.dotocenoKlient.predmet': {
    cs: 'Dotoceno - {herec} - {projekt}',
    en: 'Recording finished - {herec} - {projekt}',
  },

  // --- změna natáčecího termínu: zpráva klientovi (1. 10. 2026) ---
  // sendZmenaTerminuKlientoviEmail. Dvě varianty: přesun a zrušení.
  'mail.zmenaTerminu.stitek': { cs: 'Natáčení', en: 'Recording' },
  'mail.zmenaTerminu.preheader': {
    cs: '{projekt} — změna natáčecího termínu.',
    en: '{projekt} — the recording session has moved.',
  },
  'mail.zmenaTerminu.preheaderZruseno': {
    cs: '{projekt} — natáčecí termín zrušen.',
    en: '{projekt} — the recording session has been cancelled.',
  },
  'mail.zmenaTerminu.predmet': {
    cs: 'Zmena terminu - {projekt}',
    en: 'Session moved - {projekt}',
  },
  'mail.zmenaTerminu.predmetZruseno': {
    cs: 'Zruseny termin - {projekt}',
    en: 'Session cancelled - {projekt}',
  },
  'mail.zmenaTerminu.veta': {
    cs: 'u projektu {projekt} jsme posunuli natáčecí termín.',
    en: 'we have moved a recording session on the project {projekt}.',
  },
  'mail.zmenaTerminu.vetaZruseno': {
    cs: 'u projektu {projekt} jsme zrušili natáčecí termín.',
    en: 'we have cancelled a recording session on the project {projekt}.',
  },
  'mail.zmenaTerminu.puvodne': { cs: 'Původně: {kdy}', en: 'Was: {kdy}' },
  'mail.zmenaTerminu.nove': { cs: 'Nově: {kdy}', en: 'Now: {kdy}' },
  'mail.zmenaTerminu.zruseno': { cs: 'Zrušený termín: {kdy}', en: 'Cancelled session: {kdy}' },
  'mail.zmenaTerminu.tlacitko': { cs: 'Zobrazit projekty', en: 'View projects' },

  // --- nabídka (sendOfferEmail) ---
  'mail.nabidka.stitek': { cs: 'Nabídka', en: 'Quote' },
  'mail.nabidka.preheader': {
    cs: 'Nabídka pro projekt {nazev}.',
    en: 'A quote for the project {nazev}.',
  },
  'mail.nabidka.veta': {
    cs: 'posílám nabídku pro projekt {nazev}.',
    en: 'I am sending you a quote for the project {nazev}.',
  },
  'mail.nabidka.tlacitko': { cs: 'Zobrazit nabídku', en: 'View the quote' },
  'mail.nabidka.predmet': { cs: 'Cenová nabídka - {nazev}', en: 'Quote - {nazev}' },
  'mail.nabidka.textVeta': {
    cs: 'posilam nabidku pro projekt {nazev}.',
    en: 'I am sending you a quote for the project {nazev}.',
  },

  // --- faktura (sendInvoiceEmail) ---
  'mail.faktura.stitek': { cs: 'Faktura', en: 'Invoice' },
  'mail.faktura.preheader': {
    cs: 'Faktura {cislo} od {firma}.',
    en: 'Invoice {cislo} from {firma}.',
  },
  'mail.faktura.odznak': { cs: 'Faktura {cislo}', en: 'Invoice {cislo}' },
  'mail.faktura.nadpis': { cs: 'Faktura k úhradě', en: 'Invoice for payment' },
  'mail.faktura.veta': {
    cs: 'posíláme fakturu pro {firma}.',
    en: 'we are sending an invoice for {firma}.',
  },
  'mail.faktura.cislo': { cs: 'Číslo faktury', en: 'Invoice number' },
  'mail.faktura.bezDph': { cs: 'Částka bez DPH', en: 'Amount excluding VAT' },
  'mail.faktura.kUhrade': { cs: 'K úhradě', en: 'Amount due' },
  'mail.faktura.splatnost': { cs: 'Splatnost', en: 'Due date' },
  'mail.faktura.ucet': { cs: 'Bankovní účet', en: 'Bank account' },
  'mail.faktura.variabilniSymbol': { cs: 'Variabilní symbol', en: 'Variable symbol' },
  'mail.faktura.pdfVPriloze': {
    cs: 'Fakturu posíláme i v příloze — je na ní QR kód, kterým se platba v bankovní aplikaci vyplní sama.',
    en: 'We are attaching the invoice as well — it carries a QR code that fills the payment in your banking app for you.',
  },
  'mail.faktura.rodnyListVPriloze': {
    cs: 'V příloze je i rodný list.',
    en: 'The advert record is attached as well.',
  },
  'mail.faktura.rodneListyVPriloze': {
    cs: 'V příloze jsou i rodné listy ({pocet}).',
    en: 'The advert records ({pocet}) are attached as well.',
  },
  'mail.faktura.kdybyNesedelo': {
    cs: 'Kdyby cokoliv nesedělo, stačí na tento e-mail odpovědět.',
    en: 'If anything does not look right, just reply to this email.',
  },
  'mail.faktura.predmet': { cs: 'Faktura {cislo}', en: 'Invoice {cislo}' },
  'mail.faktura.predmetSPredmetem': {
    cs: 'Faktura {cislo} — {predmet}',
    en: 'Invoice {cislo} — {predmet}',
  },
  'mail.faktura.textVeta': {
    cs: 'posilame fakturu {cislo} pro {firma}.',
    en: 'we are sending invoice {cislo} for {firma}.',
  },
  'mail.faktura.textKUhrade': { cs: 'K uhrade: {castka}', en: 'Amount due: {castka}' },
  'mail.faktura.textSplatnost': { cs: 'Splatnost: {datum}', en: 'Due date: {datum}' },
  'mail.faktura.textUcet': { cs: 'Bankovni ucet: {ucet}', en: 'Bank account: {ucet}' },
  'mail.faktura.textVariabilniSymbol': {
    cs: 'Variabilni symbol: {vs}',
    en: 'Variable symbol: {vs}',
  },
  'mail.faktura.textPdfVPriloze': {
    cs: 'Fakturu posilame i v priloze, je na ni QR kod k platbe.',
    en: 'We are attaching the invoice as well, it carries a QR code for payment.',
  },
  'mail.faktura.textRodnyListVPriloze': {
    cs: 'V priloze je i rodny list.',
    en: 'The advert record is attached as well.',
  },
  'mail.faktura.textRodneListyVPriloze': {
    cs: 'V priloze jsou i rodne listy ({pocet}).',
    en: 'The advert records ({pocet}) are attached as well.',
  },

  // --- smlouva k podpisu (sendContractEmail) ---
  'mail.smlouva.stitek': { cs: 'Smlouva k podpisu', en: 'Contract to sign' },
  'mail.smlouva.preheader': {
    cs: 'Smlouva {cislo} od {firma} čeká na váš podpis.',
    en: 'Contract {cislo} from {firma} is waiting for your signature.',
  },
  'mail.smlouva.odznak': { cs: 'Smlouva {cislo}', en: 'Contract {cislo}' },
  'mail.smlouva.veta': {
    cs: 'posíláme vám k podpisu smlouvu se společností {firma}. Otevřete ji odkazem níže, přečtěte si ji a podepište se rovnou v prohlížeči — myší nebo prstem na mobilu. Nemusíte se nikam přihlašovat ani opisovat žádný kód.',
    en: 'we are sending you a contract with {firma} to sign. Open it using the link below, read it through and sign straight in your browser — with a mouse or with your finger on a phone. There is nothing to log in to and no code to copy out.',
  },
  'mail.smlouva.cislo': { cs: 'Číslo smlouvy', en: 'Contract number' },
  'mail.smlouva.projekt': { cs: 'Projekt', en: 'Project' },
  'mail.smlouva.druhaStrana': { cs: 'Druhá strana', en: 'Other party' },
  'mail.smlouva.stav': { cs: 'Stav', en: 'Status' },
  'mail.smlouva.podepsanaZaNas': { cs: 'Za nás už je podepsaná', en: 'Already signed on our side' },
  'mail.smlouva.tlacitko': { cs: 'Otevřít a podepsat smlouvu', en: 'Open and sign the contract' },
  'mail.smlouva.klic': {
    cs: 'Tenhle odkaz je váš podpisový klíč — nesdílejte ho prosím dál. K podpisu se uloží čas, IP adresa a otisk textu, který jste měli před sebou. Kdyby vám ve smlouvě něco nesedělo, stačí na tento e-mail odpovědět nebo podpis přímo na stránce odmítnout.',
    en: 'This link is your signing key — please do not share it. We store the time, the IP address and a fingerprint of the text you had in front of you with each signature. If something in the contract does not look right, just reply to this email or decline the signature on the page itself.',
  },
  'mail.smlouva.predmet': {
    cs: 'Smlouva {cislo} k podpisu — {nazev}',
    en: 'Contract {cislo} to sign — {nazev}',
  },
  'mail.smlouva.textVeta': {
    cs: 'posilame vam k podpisu smlouvu {cislo} se spolecnosti {firma}.',
    en: 'we are sending you contract {cislo} with {firma} to sign.',
  },
  'mail.smlouva.textProjekt': { cs: 'Projekt: {projekt}', en: 'Project: {projekt}' },
  'mail.smlouva.textOtevrit': {
    cs: 'Smlouvu si otevrete a podepisete zde:',
    en: 'You can open and sign the contract here:',
  },
  'mail.smlouva.textKlic': {
    cs: 'Odkaz je urceny jen vam - nesdilejte ho dal.',
    en: 'The link is meant for you only - please do not share it.',
  },

  // --- podepsaná smlouva (sendPodepsanaSmlouvaEmail) ---
  // Tučný kousek uprostřed věty je schválně UVNITŘ klíče, ne slepený v HTML:
  // věta tak zůstává jedna a v angličtině může být zvýrazněné něco jiného.
  'mail.smlouvaPodepsana.stitek': { cs: 'Podepsaná smlouva {cislo}', en: 'Signed contract {cislo}' },
  'mail.smlouvaPodepsana.preheader': {
    cs: 'Smlouva {cislo} je podepsaná oběma stranami.',
    en: 'Contract {cislo} has been signed by both parties.',
  },
  'mail.smlouvaPodepsana.veta': {
    cs: 'smlouva je podepsaná oběma stranami. Kompletní znění i s podpisy máte <strong>v příloze jako PDF</strong>; odkazem níž se k ní kdykoliv dostanete i online.',
    en: 'the contract has been signed by both parties. The full text with the signatures is <strong>attached as a PDF</strong>; the link below opens it online whenever you need it.',
  },
  'mail.smlouvaPodepsana.zaNas': { cs: 'Za {firma}', en: 'For {firma}' },
  'mail.smlouvaPodepsana.zaProtistranu': { cs: 'Za protistranu', en: 'For the other party' },
  'mail.smlouvaPodepsana.tlacitko': {
    cs: 'Otevřít podepsanou smlouvu',
    en: 'Open the signed contract',
  },
  'mail.smlouvaPodepsana.otisk': {
    cs: 'U každého podpisu je uložený čas, IP adresa a otisk textu, který měl podepisující před sebou — podle něj je poznat, že se smlouva od podpisu nezměnila.',
    en: 'Each signature carries the time, the IP address and a fingerprint of the text the signatory had in front of them — that is how you can tell the contract has not changed since it was signed.',
  },
  'mail.smlouvaPodepsana.predmet': {
    cs: 'Podepsaná smlouva {cislo} — {nazev}',
    en: 'Signed contract {cislo} — {nazev}',
  },
  'mail.smlouvaPodepsana.textVeta': {
    cs: 'smlouva {cislo} je podepsana obema stranami.',
    en: 'contract {cislo} has been signed by both parties.',
  },
  'mail.smlouvaPodepsana.textPodepsal': { cs: 'Podepsal: {podpis}', en: 'Signed: {podpis}' },
  'mail.smlouvaPodepsana.textPriloha': {
    cs: 'Kompletni zneni je v priloze jako PDF. Online ji najdete zde:',
    en: 'The full text is attached as a PDF. You can find it online here:',
  },

  // --- schválený bonus (sendBonusEmail) ---
  'mail.bonus.stitek': { cs: 'Schválený bonus', en: 'Approved bonus' },
  'mail.bonus.preheader': {
    cs: '{projekt}: bonus {castka} je schválený.',
    en: '{projekt}: the {castka} bonus has been approved.',
  },
  'mail.bonus.odznak': { cs: 'Bonus', en: 'Bonus' },
  'mail.bonus.bonus': { cs: 'Bonus', en: 'Bonus' },
  'mail.bonus.kniha': { cs: 'Kniha', en: 'Book' },
  'mail.bonus.podilNaStrihu': { cs: 'Podíl na střihu', en: 'Share of the editing' },
  'mail.bonus.zaCo': { cs: 'Za co', en: 'What for' },
  'mail.bonus.schvalil': { cs: 'Schválil(a)', en: 'Approved by' },
  'mail.bonus.tlacitko': { cs: 'Otevřít ve Výkazech', en: 'Open in Timesheets' },
  'mail.bonus.vysvetleni': {
    cs: 'Bonus je jednorázová odměna nad rámec výkazu — do odpracovaných hodin se nezapočítává a proti rozpočtu projektu nestojí.',
    en: 'A bonus is a one-off reward on top of the timesheet — it does not count towards the hours worked and does not go against the project budget.',
  },
  'mail.bonus.predmet': { cs: 'Schválený bonus — {projekt}', en: 'Approved bonus — {projekt}' },
  'mail.bonus.textBonus': { cs: 'Bonus: {castka}', en: 'Bonus: {castka}' },
  'mail.bonus.textKniha': { cs: 'Kniha: {projekt}', en: 'Book: {projekt}' },
  'mail.bonus.textPodilNaStrihu': {
    cs: 'Podil na strihu: {procenta} %',
    en: 'Share of the editing: {procenta} %',
  },
  'mail.bonus.textZaCo': { cs: 'Za co: {duvod}', en: 'What for: {duvod}' },
  'mail.bonus.textSchvalil': { cs: 'Schvalil(a): {kdo}', en: 'Approved by: {kdo}' },
  'mail.bonus.textOdkaz': {
    cs: 'Ve Vykazech ho najdete tady:',
    en: 'You can find it in Timesheets here:',
  },

  // --- herec si vybral termíny: zpráva produkci (5. 10. 2026) ---
  'mail.vyberTerminu.stitek': { cs: 'Výběr termínů', en: 'Chosen sessions' },
  'mail.vyberTerminu.odznak': { cs: 'Herec vybral', en: 'Actor has chosen' },
  'mail.vyberTerminu.preheader': {
    cs: '{herec} si vybral natáčecí termíny — {projekt}',
    en: '{herec} has chosen their recording sessions — {projekt}',
  },
  'mail.vyberTerminu.nadpis': {
    cs: '{herec} si vybral termíny',
    en: '{herec} has chosen their sessions',
  },
  'mail.vyberTerminu.projekt': { cs: 'Projekt', en: 'Project' },
  'mail.vyberTerminu.studio': { cs: 'Studio', en: 'Studio' },
  'mail.vyberTerminu.vybral': { cs: 'Vybráno', en: 'Chosen' },
  'mail.vyberTerminu.vybralHodnota': {
    cs: '{pocet} z {potreba} potřebných',
    en: '{pocet} of the {potreba} needed',
  },
  'mail.vyberTerminu.terminy': { cs: 'Termíny', en: 'Sessions' },
  'mail.vyberTerminu.drzenoDo': { cs: 'Drženo do', en: 'Held until' },
  'mail.vyberTerminu.poznamkaHerce': { cs: 'Poznámka herce:', en: 'Actor’s note:' },
  'mail.vyberTerminu.tlacitko': { cs: 'Potvrdit termíny', en: 'Confirm the sessions' },
  'mail.vyberTerminu.komuChodi': {
    cs: 'Tuhle zprávu dostává každý, kdo má na své kartě zapnuté „Dostává výběr termínů". Vypnout si ji můžete v Můj účet.',
    en: 'This message goes to everyone with „Receives chosen sessions" switched on. You can turn it off in My account.',
  },
  'mail.vyberTerminu.predmet': {
    cs: '{herec} vybral termíny — {projekt}',
    en: '{herec} has chosen sessions — {projekt}',
  },
  'mail.vyberTerminu.textNadpis': {
    cs: '{herec} si vybral natáčecí termíny u projektu {projekt}.',
    en: '{herec} has chosen recording sessions for {projekt}.',
  },
  'mail.vyberTerminu.textVybral': {
    cs: 'Vybráno {pocet} z {potreba} potřebných:',
    en: 'Chosen {pocet} of the {potreba} needed:',
  },
  'mail.vyberTerminu.textDrzenoDo': { cs: 'Terminy se drzi do {datum}.', en: 'The sessions are held until {datum}.' },
  'mail.vyberTerminu.textPoznamka': { cs: 'Poznamka herce: {poznamka}', en: 'Actor’s note: {poznamka}' },
  'mail.vyberTerminu.textOdkaz': { cs: 'Potvrdit terminy:', en: 'Confirm the sessions:' },

  // --- upomínka herci, ať si naklikne termíny (2. 10. 2026) ---
  'mail.upominkaTerminu.stitek': { cs: 'Natáčecí termíny', en: 'Recording sessions' },
  'mail.upominkaTerminu.odznak': { cs: 'Připomínka', en: 'Reminder' },
  'mail.upominkaTerminu.preheader': {
    cs: 'Čekáme na váš výběr termínů — {projekt}',
    en: 'We are waiting for your choice of sessions — {projekt}',
  },
  'mail.upominkaTerminu.uvod': {
    cs: 'připomínáme se s nabídkou natáčecích termínů — pořád čekáme na váš výběr. Vybrat si máte {pocet} z {celkem} nabídnutých.',
    en: 'just a reminder about the recording sessions we offered you — we are still waiting for your choice. You are to pick {pocet} out of the {celkem} offered.',
  },
  'mail.upominkaTerminu.projekt': { cs: 'Projekt', en: 'Project' },
  'mail.upominkaTerminu.dokdy': { cs: 'Nejpozdější frekvence', en: 'Last possible session' },
  'mail.upominkaTerminu.vzkaz': { cs: 'Vzkaz produkce:', en: 'Production note:' },
  'mail.upominkaTerminu.tlacitko': { cs: 'Vybrat termíny', en: 'Choose sessions' },
  'mail.upominkaTerminu.patka': {
    cs: 'Odkaz patří jen vám, neposílejte ho dál. Čím dřív si vyberete, tím víc máte z čeho — místa ve studiu obsazují i jiné projekty.',
    en: 'The link is yours alone, please do not forward it. The sooner you choose, the more you can choose from — other projects book the studio too.',
  },
  'mail.upominkaTerminu.predmet': {
    cs: 'Připomínka: vyberte si natáčecí termíny — {projekt}',
    en: 'Reminder: choose your recording sessions — {projekt}',
  },
  'mail.upominkaTerminu.textUvod': {
    cs: 'pripominame se s nabidkou nataceich terminu u projektu {projekt} - vybrat si mate {pocet} z {celkem} nabidnutych.',
    en: 'a reminder about the recording sessions for {projekt} - you are to pick {pocet} out of the {celkem} offered.',
  },
  'mail.upominkaTerminu.textDokdy': {
    cs: 'Nejpozdejsi mozna frekvence: {datum}.',
    en: 'Last possible session: {datum}.',
  },
  'mail.upominkaTerminu.textVzkaz': { cs: 'Vzkaz produkce: {vzkaz}', en: 'Production note: {vzkaz}' },
  'mail.upominkaTerminu.textOdkaz': { cs: 'Vyber terminu:', en: 'Choose your sessions:' },
  'mail.upominkaTerminu.textPatka': {
    cs: 'Odkaz patri jen vam, neposilejte ho dal.',
    en: 'The link is yours alone, please do not forward it.',
  },
};

/** Přeloží klíč pošty. Co ve slovníku není, projde česky - a je to vidět. */
export function prelozitEmail(jazyk: Jazyk, klic: string): string {
  const zaznam = SLOVNIK_EMAILU[klic];
  if (!zaznam) {
    if (process.env.NODE_ENV !== 'production') console.warn(`Chybí překlad pošty pro „${klic}".`);
    return klic;
  }
  return jazyk === 'en' ? zaznam.en || zaznam.cs : zaznam.cs;
}

/** Přeloží klíč a doplní zástupné značky `{nazev}`. */
export function prelozitEmailS(
  jazyk: Jazyk,
  klic: string,
  hodnoty: Record<string, string | number>,
): string {
  return prelozitEmail(jazyk, klic).replace(/\{(\w+)\}/g, (cela, znacka) =>
    znacka in hodnoty ? String(hodnoty[znacka]) : cela,
  );
}
