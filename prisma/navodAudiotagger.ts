/**
 * NÁVOD: AUDIOTAGGER (zadání 16. 9. 2026: „přidej do manuálů audiotager").
 *
 * Text tady je jen ZAČÁTEK. Jakmile ho někdo v portálu upraví, seed už do něj
 * nesahá - zakládá se jen tehdy, když návod s touhle adresou ještě není.
 *
 * OBRÁZKY (doplněno 24. 9. 2026: „u některých návodů nejsou obrázky, třeba
 * u AudioTaggeru je to důležité... ale obrázky mají být ilustrační") jsou
 * v public/navody/audiotagger-1..4.png. Nejsou to snímky obrazovky - kreslí
 * se z repliky scripts/navody/audiotagger.html, ať v návodu není cizí
 * projekt ani skutečný text knihy:
 *   node scripts/navody/snimky.mjs audiotagger
 * Oranžová čísla v replice patří k číslovaným popiskům pod obrázkem. Když se
 * AudioTagger změní, upravit repliku, přegenerovat a srovnat text níž.
 */
export const AUDIOTAGGER = {
  slug: 'audiotagger',
  nazev: 'AudioTagger (přeposlech)',
  perex: 'Přeposlech nahrávek v portálu: značení chyb v textu, stopy, tabulka a odkaz pro klienta.',
  kategorie: 'Projekty',
  poradi: 20,
  obsah: `AudioTagger je přeposlech přímo v portálu: vlevo text, vpravo nahrávka a záznamy chyb. Otevírá se **ze záložky v detailu projektu** a všechno, co se v něm zapíše, patří tomu projektu — ne prohlížeči, ve kterém to někdo psal.

![Obrazovka AudioTaggeru: hlavička s počty a tlačítky, text nahrávky, seznam chyb a přehrávač](/navody/audiotagger-1.png)

# Než se dá poslouchat

1. Na Disk přibydou první nahrávky.
2. Projekt se přehodí na **Natáčíme/stříháme** nebo **Dotočeno/stříháme**.
3. AudioTagger si sám sáhne do složky projektu a natáhne stopy i text.
4. Odejde zpráva o prvních tracích se dvěma tlačítky — zeleným **Přeposlechnout v AudioTaggeru** a tmavým **Otevřít složku projektu**.

**Pořadí stop se drží podle čísla na začátku názvu** — \`01_\`, \`02_\`, \`03_\`. Text je **PDF, jehož název končí \`_RE\`** (režijní edit); když jich je víc, bere se nejnovější. Když žádné \`_RE\` ve složce není a PDF je tam jediné, vezme se ono a napíše se o tom poznámka. Ručně jde text vyměnit tlačítkem **Načíst jiné PDF**.

# Režim pro nevidomé

Na klientově odkazu je tlačítko **Režim pro nevidomé** schválně nenápadné: nahoře je schované a vyskočí, až když se na něj někdo dostane tabulátorem (čtečka obrazovky na něj narazí jako na první věc na stránce), a úplně dole na stránce je ještě drobný odkaz. Vidoucího klienta tak neruší. Přepne přeposlech do podoby, kterou zvládne čtečka obrazovky: místo obrázku PDF čitelný text po odstavcích, systémový přehrávač, velká tlačítka s popisky a ohlašování po každé akci (stopa, čas, uložená připomínka). Ovládá se z klávesnice — mezerník přehraje a pozastaví, šipky posouvají o pět vteřin (se Shiftem o třicet), N a P přepínají stopu, Z otevře zápis připomínky, I ohlásí, kde člověk je. Připomínky přijdou do portálu úplně stejně jako z běžného přeposlechu. Volba se pamatuje v prohlížeči, takže při dalším otevření odkazu je režim rovnou zapnutý.

# Ovládání

- **mezerník** — přehrát / pozastavit
- **←** a **→** — o pět vteřin zpět a dopředu
- **E** — přidat chybu
- **Enter** uloží záznam, **Shift+Enter** udělá v popisu nový řádek
- rychlost přehrávání se přepíná tlačítky v liště

Nad stopou je tmavý displej: číslo stopy z celkového počtu, čas a název souboru.

# Značení chyb

Nejrychlejší cesta je **označit chybu rovnou v textu myší**. Stane se pak tohle:

- úsek se v PDF **žlutě podbarví**,
- jeho text se **předvyplní do popisu** — většinou se stejně opisuje to, co herec přečetl špatně,
- **nahrávka se zastaví**,
- **čas se vezme z okamžiku, kdy jste začali táhnout**, ne kdy jste výběr dotáhli. Než chybu označíte, nahrávce uteče pár vteřin a značka patří tam, kde jste ji slyšeli.

Zvýraznění patří k záznamu chyby, takže ho vidí i klient ve svém odkazu — a naopak. Označit nejde text, který v PDF textem není (třeba tiráž vepsaná jako poznámka v editoru); vlastní text knihy označit jde.

Bez textu to jde taky: tlačítkem **+ Přidat chybu** nebo klávesou **E** se založí záznam na aktuálním čase.

![Okno zápisu chyby: předvyplněná stopa, čas a strana, popis a tlačítko Uložit chybu](/navody/audiotagger-2.png)

V seznamu záznamů se dá na chybu **kliknout a skočit na to místo v nahrávce**, znění upravit a záznam smazat.

# Kde jste skončili (probarvené stopy)

Každá stopa zůstává **probarvená fialově až tam, kam jste ji doposlouchali** — i když ji zastavíte, přepnete na jinou nebo AudioTagger zavřete a otevřete znovu. Vedle názvu stopy je vidět, kolik procent z ní máte za sebou. Stopa poslechnutá do konce je **celá zelená** s nápisem „✓ poslechnuto".

- Počítá se jen skutečné přehrávání — kliknutí dopředu do křivky samo o sobě nic neprobarví.
- Drží se nejdál dosažené místo; když se vrátíte o kus zpátky, probarvení nezmizí.
- Každý posluchač má svoje (klient své, my svoje).

# Pauza se záložkou

Tlačítko **🔖 Pauza** zamkne přeposlech a založí místo, kde jste skončili — přes obrazovku sjede fialová záložka s číslem stopy a časem. Tlačítkem **Pokračovat odtud** (nebo Enterem či Escapem) se vytáhne a nahrávka se rovnou nastaví na to místo. Je to na odskočení od počítače, ne na krátkou pauzu uprostřed věty.

![Záložka Stopa 07 s tlačítkem Pokračovat odtud a seznam stop: rozposlouchaná, doposlechnutá a zaškrtnutá jako hotová](/navody/audiotagger-4.png)

# Stopy

- **Doposlechnutá stopa se zapíše sama** — ve chvíli, kdy přehrávání dojede na konec. Odškrtávátko, které nikdo neudržuje, je horší než žádné, takže se počítá jen to, co se dá poznat samo.
- **Hotová stopa** je něco jiného: tu si zaškrtnete sami, až si stopu pustíte celou, poznamenáte si k ní, co je potřeba, a vrátíte se k ní. Zaškrtnutá stopa změní barvu.
- U stop nad 150 MB se nekreslí křivka — zůstane časová osa se značkami. Křivky se dopočítávají na pozadí u všech stop, ale vždycky jen jedna naráz, aby to neucpalo linku ani paměť.

# Tabulka chyb

**Stáhnout tabulku** v hlavičce Záznamů chyb vyrobí CSV: stopa, název stopy, čas ve stopě, čas v Cubase, strana textu, popis, kdo a kdy. Je to středníkem oddělené a s BOM, takže to český Excel otevře rovnou do sloupců. **Sloupec s časem v Cubase je jen náš** — klient ho nikde nevidí.

# PŘEPOSLECHNUTO

Velké tlačítko, kterým se za nahrávku někdo postaví. Portál si pamatuje, kdo ho zmáčkl a kdy. Odškrtnutí se pro jistotu ptá. **Klient tohle tlačítko nemá.**

# Odkaz pro klienta

Nad AudioTaggerem je v kartě projektu proužek, odkud se klientovi vygeneruje odkaz. Klient **nepotřebuje účet ani heslo** — otevře se mu přeposlech na celou obrazovku, bez lišty a menu.

Co klient může a nemůže:

- **může** poslouchat, číst text, označovat v textu a psát chyby — záznamy se podepisují e-mailem nebo jménem, které zadal (kdo se nepředstavil, je „Klient"),
- **nemůže** mazat záznamy, označit PŘEPOSLECHNUTO, měnit PDF ani přeskládávat stopy,
- **nevidí** čas v Cubase.

**Na projekt je živý vždycky jeden odkaz.** Opakovaná zpráva o projektu ten předchozí nezneplatní — a **Vygenerovat nový** je zároveň jediný způsob, jak už rozeslaný odkaz zavřít. Kdo odkaz dostane dál, dostane se dovnitř taky; posílejte ho proto jen tomu, komu má patřit.

# Kdo poslouchá a zprávy o nových stopách

Když klient otevře odkaz **u projektu poprvé** (u projektu ještě nikdo zapsaný není), vyskočí mu okno **Kdo bude poslouchat?**. E-mail je předvyplněný tím, na který šel odkaz; jméno je nepovinné. Rovnou tam může přeposlech **předat dalším lidem** — každý přidaný dostane e-mail s odkazem. Po uložení už okno nevyskakuje.

![Okno Kdo bude poslouchat? s e-mailem, nepovinným jménem a tlačítkem Přidat e-mail](/navody/audiotagger-3.png)

Seznam se dá kdykoli upravit tlačítkem **👤 Posluchači** v hlavičce AudioTaggeru — vidí ho klient i my:

- **Přidat a poslat odkaz** — přidá e-mail a pošle mu odkaz (= předání přeposlechu),
- **🔔** — zapne/vypne zprávy o nových stopách pro daný e-mail,
- **Odebrat** — na druhé klepnutí,
- **To jsem já** (jen u klienta) — prohlížeč si zapamatuje, kdo u něj sedí, a tím jménem se pak podepisují poznámky.

**Zprávy o nových stopách:** jakmile ve složce na Disku přibudou stopy, odejde všem posluchačům se zapnutým 🔔 e-mail „Nové stopy k přeposlechu" s odkazem. Portál to zjistí při otevření AudioTaggeru a navíc to kontroluje každou hodinu. Posílá se jen o tom, co přibylo od chvíle, kdy byl posluchač zapsaný; po PŘEPOSLECHNUTO nebo se zavřeným odkazem se už nic neposílá.

**Kdo co udělal** je vidět v záložce **Historie**: kdo odkaz otevřel, kdo se představil, komu byl přeposlech předán, komu odešla zpráva o nových stopách — a u poznámek jméno toho, kdo je napsal.

# Poslech bez signálu (Poslouchat offline)

Tlačítko **⬇ Poslouchat offline** v hlavičce stáhne všechny nahrávky a text do prohlížeče. Pak jde poslouchat, číst i psát poznámky **bez připojení** — třeba ve vlaku nebo v letadle.

- Stahuje se se signálem, předem. U tlačítka je vidět, kolik to bude megabajtů; po stažení svítí **✓ Poslouchat offline**.
- Stahují se **všechny stopy i text (PDF)** i s knihovnou, která PDF zobrazuje. Stažené stopy hrají z počítače (i se signálem — je to rychlejší).
- Bez signálu svítí v hlavičce **Offline**. Poznámky, úpravy, záložka, odškrtnuté stopy i PŘEPOSLECHNUTO se uloží do fronty („3 čeká") a **odejdou samy**, jakmile je signál zpátky. Nová poznámka je do té doby podepsaná „čeká na signál".
- Odkaz je nejlepší otevřít ještě se signálem a nezavírat ho. Klientský odkaz se po stažení otevře i offline, portál (detail projektu) jen v okně, které zůstalo otevřené.
- Když přibudou nové stopy, stačí **Stáhnout zbytek**. **Smazat z počítače** uvolní místo.

# Náš poslech klientovi nic nemění

Když někdo z týmu poslouchá — v portálu i na odkazu, který šel klientovi (je přihlášený) — počítá se jako **náš**: má vlastní záložku a probarvení stop, nepřidává klientovi procenta, nezapisuje „doposlechnuto" do počtu stop a do historie se nezapíše jako otevření odkazu klientem. Okno „Kdo bude poslouchat?" se nám neukazuje. Ruční zaškrtnutí stopy jako hotové a PŘEPOSLECHNUTO jsou vědomé kroky a platí dál.

# Bruno ohlásí dokončený přeposlech

Jakmile někdo označí nahrávku jako **PŘEPOSLECHNUTO**, napíše **Bruno do kanálu projektu v chatu**: kdo to označil, kolik je poznámek k opravě, kolik stop a kolik procent textu. Cinkne to těm, kdo jsou v kanálu, podle jejich nastavení upozornění.

# Kolik je přeposlechnuto (procenta)

Stopy k přeposlechu chodí po kouscích, takže „3 z 5 stop" o celé knize nic neřekne. Procento se proto počítá **podle stran PDF**: v hlavičce je proužek a „Přeposlechnuto 42 % · strana 120 z 286".

- Strana se počítá jako přeposlechnutá, když na ní klient **při přehrávání** má text (zapisuje se každých 10 vteřin). Jen prolistování bez puštěné nahrávky se nepočítá.
- Počítá se jen poslech **klienta** — naše kontrola uvnitř knihy mu procenta nepřidá. My v hlavičce vidíme „Klient 42 %".
- Stejné procento je v seznamu projektů ve sloupci **Přeposlechnuto** (počet doposlechnutých stop je v bublině po najetí myší).
- Když se na Disku vymění PDF, procento začne znovu od nuly.

# Hledání v textu

Nad textem je políčko **🔍 Hledat v textu** (nebo **Ctrl+F / ⌘F**). Hledá v celé knize, i na stranách, kam jste ještě nedorolovali.

- **Bez ohledu na diakritiku a velikost písmen** — „prilis" najde „Příliš".
- Najde i **slovo rozdělené na konci řádku** („roz-/hodl") a frázi přes konec řádku.
- Nálezy jsou v textu **fialově podbarvené**, ten aktuální oranžově. **Enter** = další, **Shift+Enter** = předchozí (nebo šipky ▲▼), **Esc** hledání zruší. Vedle políčka je „3 / 27".
- **☰** otevře seznam všech nálezů se stranou a úryvkem kolem — kliknutím se na nález skočí.
- **Aa** — jak hledat: **Jen celá slova** („les" nenajde „lesník"), **Přibližně** (najde i překlep nebo jiný tvar slova — „Novak" → „Nováka"; hodí se, když hledáte podle sluchu), **Přesně** (rozlišuje diakritiku a velká písmena).
- Při prvním hledání se chvíli připravuje text celé knihy (u políčka běží procenta), pak je hledání okamžité.
- Nenajde text, který v PDF není textem (sken, poznámka vložená v PDF editoru).

# Co se teprve chystá

- Zvětšování a zmenšování textu — hotové v prototypu, do portálu se to teprve překlopí.
- Export značek pro Cubase (marker / EDL). Data pro něj už v každém záznamu jsou, zatím je z nich jen CSV pro člověka.`,
};
