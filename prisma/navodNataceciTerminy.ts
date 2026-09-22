/**
 * NÁVOD: PLÁNOVÁNÍ NATÁČECÍCH TERMÍNŮ (zadání 19. 9. 2026: „OK, teď to
 * funguje. Udělej mi z toho návod do nápovědy").
 *
 * Popisuje celý oběh: nabídka z projektu jedním oknem, výběr hercem (včetně
 * vlastního času), potvrzení produkcí, úpravy v kalendáři a přidání do
 * kalendáře herce. Text je jen začátek - jakmile ho někdo v portálu upraví,
 * seed už do něj nesahá.
 *
 * OBRÁZKY (zadání 19. 9. 2026: „chybí mi tam obrázky. Návody musí být hodně
 * jasné… a hlavně je pak automaticky přepracuj, jakmile se něco změní")
 * jsou v public/navody/terminy-1..6.png. Kreslí se z repliky obrazovek
 * s očíslovanými místy; čísla v obrázku odpovídají číslovanému seznamu pod
 * ním. PŘI KAŽDÉ ZMĚNĚ plánování termínů (okno nabídky, výběr hercem,
 * potvrzení, úprava v kalendáři, přidání do kalendáře) se musí upravit text
 * i obrázky tady.
 */
export const NATACECI_TERMINY = {
  slug: 'nataceci-terminy',
  nazev: 'Natáčecí termíny - od nabídky po kalendář',
  perex:
    'Jak herci poslat nabídku termínů jedním oknem, jak si herec vybírá a mění termíny a jak se potvrzené frekvence upravují v kalendáři.',
  kategorie: 'Kalendář',
  poradi: 40,
  obsah: `Termíny se herci nenabízejí ručně. Portál spočítá, kolik frekvencí je potřeba, a nabídne mu **všechna volná místa** ve zvolených studiích až do poslední možné frekvence. Herec si z nich vybere přesně tolik, kolik je potřeba, a produkce výběr potvrdí.

# 1. Vytvoření nabídky (produkce)

V detailu projektu v záložce **Natáčecí plán** klikněte na **Vytvořit nabídku termínů**. Všechno je v jednom okně:

![Okno Vytvořit nabídku termínů s očíslovanými částmi](/navody/terminy-1.png)

1. **Studia** — kliknutím zapnete nebo vypnete studio, ze kterého se nabízí. Zapnuté je fialové s fajfkou. Předvybere se studio a všechna ve stejném městě (v Brně tedy Brno I i Brno II rovnou). **Herec** nad tím je předvyplněný podle projektu.
2. **Normostrany a Počet frekvencí** — počet se spočítá z normostran (40 NS na frekvenci), dá se přepsat. **První frekvence nejdříve** je zítřek — dnešek se nenabízí.
3. **Poslední frekvence nejpozději** — sama se nastaví na **dva dny před datem dokončení projektu**, ať stihneme stříhat a odevzdat. Když projekt datum dokončení nemá, je tu měsíc dopředu a je potřeba ho upravit ručně. Vedle je **Poznámka pro herce** — přijde mu v e-mailu i na stránce s výběrem.
4. **Živý náhled** — kolik volných míst herec dostane a jejich přehled po dnech. Přepočítá se hned, jak změníte studia, období nebo herce.

Tlačítkem **Odeslat herci** se nabídka založí a rovnou odejde e-mailem. Když je volných míst méně, než herec potřebuje, tlačítko je zamčené a náhled poradí posunout období nebo přidat studio.

# 2. Co se do nabídky počítá

- Frekvence podle zkratek studia — **9:00–13:00** a **13:00–17:00** — v otevírací době studia, včetně víkendů.
- **Vynechá se** všechno, co je v kalendáři obsazené: potvrzené a držené termíny jiných nabídek, jakákoli událost ve studiu (natáčení, střih, casting, svátek, údržba) a jiné natáčení téhož herce.
- **Jedno místo za město.** Když je stejný čas volný v obou brněnských studiích, herec ho uvidí jen jednou a patří **Brnu I**. Brno II dostane jen tehdy, když je Brno I v tu dobu obsazené.
- Nabídka se srovnává s kalendářem **pokaždé, když ji kdo otevře** — co se mezitím obsadí, zmizí; co se uvolní, přibude.

# 3. Výběr hercem

Herec dostane e-mail s odkazem (přihlašovat se nemusí; kdo účet má, najde totéž v **Moje termíny**).

Vidí jen **dny a časy za město** — ne studio, ne víkendy zvlášť. Kliknutím na termín ho zaškrtne; dva termíny ve stejný čas vybrat nejde.

![Stránka, kde si herec vybírá termíny](/navody/terminy-2.png)

1. **Kolik ještě zbývá vybrat** — velké číslo v liště, která při rolování zůstává nahoře.
2. **Odeslat ke schválení** — je šedé, dokud herec nevybere přesně tolik termínů, kolik je frekvencí. Pak se rozsvítí zeleně.
3. **Vybrat vlastní čas** — u každého termínu. Když herci čas nesedí, posune nebo zkrátí ho (třeba 14–18, nebo jen tři hodiny).
4. **Použít tento čas** — portál ověří, že je v tu dobu ve studiu volno (v Brně zkusí obě studia). Vlastní čas nahradí původní termín a rovnou se zaškrtne. Produkce ho pak vidí označený jako **Návrh herce**.

Po odeslání se vybrané termíny **drží** (délka držení je v Cenících). Produkci přijde oznámení.

# 4. Potvrzení (produkce)

Oznámení vede na stránku nabídky. Nahoře vidíte, kolik frekvencí je potřeba, kolik herec vybral a do kdy se termíny drží. Pod tím je jeho výběr.

![Stránka nabídky s výběrem herce a tlačítky pro rozhodnutí](/navody/terminy-3.png)

1. Napište případně **vzkaz herci** a rozhodněte:
   - **Potvrdit termíny** — termíny se zapíšou do kalendáře a herci přijde e-mail,
   - **Vrátit k přepracování** — herec vybírá znovu (do vzkazu napište proč),
   - **Zamítnout** — termíny se uvolní.

Když se držení nestihne potvrdit, termíny se samy vrátí do nabídky a herec může vybírat znovu.

# 5. Kalendář

**Štítky kalendářů** nad mřížkou (Brno I, Brno II, Praha, London, Mimo studio) mají dvě poloviny:

- **kolečko** vlevo kalendář **přidá nebo odebere** k těm, které jsou zapnuté — tak se kalendáře prolínají,
- **název** zapne **sólo** — dočasně svítí jen ten jeden kalendář, štítek se orámuje a vedle štítků přibude štítek **SÓLO** s jeho názvem.

Sólo je jen na chvíli: **dalším kliknutím na stejný název** (nebo na štítek SÓLO) se vrátí zaškrtnutí přesně tak, jak bylo předtím. Kliknutím na jiný název se sólo přehodí na něj, kolečkem sólo skončí a kalendář se přidá nebo odebere z původního výběru. Sólo přežije i přepnutí týdne a zůstane v odkazu, takže se dá poslat.

Malá ikonka **postavy** vedle šipek ‹ Dnes › funguje stejně jako sólo: ukáže jen **vaše** události — natáčení a bloky, kde jste zvukař nebo herec, vaše dny mimo studio a vaše porady — ze všech studií najednou. Dalším kliknutím se vrátí původní výběr kalendářů.

Poslední zapnutý kalendář se kolečkem vypnout nedá, aby mřížka nezůstala prázdná. Vypnutý štítek má šedé kolečko (Mimo studio prázdné kolečko), zapnutý svítí svou barvou.

**Hledání nad kalendářem** projde **celý kalendář**, ne jen zobrazený týden. Napište kus názvu projektu, jméno herce nebo zvukaře a pod polem se vypíše **seznam výskytů** — kdy, kde, co to bylo a s kým, od nejnovějšího. Nahoře je i počet, kolikrát se kdo objevil. Kliknutím na řádek kalendář skočí na ten den a rovnou zapne studio, kdyby bylo vypnuté. Seznam zavřete tlačítkem **Zavřít seznam**, klávesou Esc nebo smazáním textu.

**Na další nebo předchozí týden** se nemusíte proklikávat šipkami: kalendář je **jeden dlouhý pás** — vedle sebe leží minulý, zobrazený a příští týden. V mobilu ho **táhněte prstem** doleva nebo doprava, na Macu posuňte **dvěma prsty po touchpadu** (nebo po Magic Mouse) do strany. Pás jede přímo pod prstem, nic se nenačítá a nic neproblikne; když ho pustíte, dorovná se na celý týden. Šipky nahoře dělají totéž, jen plynule samy. Stejně to funguje u dne i měsíce. V mobilu se týden nejdřív doroluje ke kraji (neděli) a teprve další tah posune pás.

V kalendáři jsou jen termíny, které **platí** — držené (herec vybral) a potvrzené. Nabídnutá volná místa se tam neukazují, jinak by zaplnila celý týden.

**Jedním kliknutím** na událost bublina **vystoupí dopředu a zvětší se přímo na svém místě** — kalendář kolem zůstává vidět. Zavře se **dalším kliknutím na bublinu**, klikem jinam, klávesou Esc nebo zarolováním (křížek tam není).

![Bublina po jednom kliknutí vystoupí a zvětší se](/navody/terminy-7.png)

1. **Druh práce s ikonou** nahoře v barevném kolečku jako u typů projektů (modrý mikrofon = natáčení, zelená rozstřižená zvuková vlna = střih, růžový herec s hvězdičkou = casting, šedý klíč = údržba, oranžové slunce = svátek/dovolená) a pod ním celý text — název, herec a řádek ZVUKAŘ, nic se neořezává. Pod tím den, čas a studio, případně poznámka.
2. **Odkazy** dole — **Projekt** a u frekvence **Nabídka termínů**.

**Upravit a smazat** se dá jen v úpravě — **dvojklikem** na událost. Tlačítko **Smazat událost** je dole v okně úpravy.

Ikona druhu je i přímo v bublině v kalendáři, zvukař taky — v týdnu na druhém řádku, v měsíci za tečkou.

**Porady (žlutý kalendář).** Porady, schůzky a hovory týmu. **Každý vidí jen porady, na které je pozvaný** — když založíte poradu jen pro sebe a Karolínu, nikdo jiný ji v kalendáři neuvidí (ani ten, kdo kalendář spravuje).

1. **Dvojklik** do mřížky → v okně události přepněte **Kalendář** na **Porady** (zvukař má v okně Mimo studio vpravo nahoře odkaz *Místo toho porada*). Když svítí jen Porady (sólo), dvojklik otevře poradu rovnou.
2. Vyplňte **název**, den a čas a zaškrtněte, **kdo je na poradě** — jako když zakládáte skupinu v chatu. Vy jste na ní vždycky.
3. **Opakování**: každý den, každý pracovní den, každý týden, každé dva týdny nebo každý měsíc; volitelně **do kdy**. Čas se drží i přes změnu letního času.
4. **Odkaz na videohovor** (Meet, Zoom, Teams…) — v detailu porady je pak tlačítko **Připojit se k hovoru**.

Upravit poradu smí každý účastník. U opakované se upravuje celá řada; jeden termín jde **zrušit samostatně** (když pondělní porada jednou odpadne). O pozvání, změně i zrušení přijde účastníkům zpráva pod **zvoneček**.

**Kalendář se obnovuje sám.** Když někdo jiný zapíše, přesune nebo smaže událost, uvidíte to do pár vteřin bez obnovování stránky — v prohlížeči i v aplikaci v telefonu. Rozepsaný formulář se tím nezavře.

**Události přes sebe leží jako papíry na stole.** Název každé události zůstane vidět: co začíná skoro naráz, leží vedle sebe (a úzká bublina dá názvu dva řádky), co začíná později, si lehne navrch přes celou šířku — ale až pod názvy těch předchozích. Celý detail události se otevře kliknutím.

**Střih se smí překrývat.** Ve studiu můžou v jednu chvíli pracovat dva zvukaři, takže střih jde zapsat i tam, kde už natáčení nebo jiný střih je. Co studio opravdu drží, je **natáčení, casting, svátek, údržba a blokace** — přes ně se druhé natáčení zapsat nedá a nenabízejí se ani herci v nabídce termínů.

**Střih bez projektu.** Střihy převzaté ze starého Google kalendáře tam byly zapsané jen jako „Střih (TI)“ — projekt v nich nikdy nebyl. V kalendáři mají proto u názvu poznámku **· bez projektu**. Projekt doplníte **dvojklikem** na událost; co v převzaté události upravíte (projekt, čas, zvukaře) nebo smažete, už se s dalším nasazením portálu nevrátí.

**Druhy práce** při zápisu dvojklikem do volného místa jsou tři: **Natáčení** (projekt, herec, zvukař), **Střih** (projekt, zvukař) a **Casting** (jen herec a zvukař — projekt se nezadává a **jméno herce se píše ručně**, protože ten, kdo přijde na casting, v portálu většinou účet nemá). **Povinný je jen čas** — projekt, herce i zvukaře můžete nechat prázdné a doplnit později dvojklikem; bublina pak nese aspoň druh práce (třeba „Natáčení“).

![Kalendář s frekvencí a otevřené okno Úprava frekvence](/navody/terminy-4.png)

1. **Dvojklikem** na frekvenci otevřete její úpravu. Zvukař, jakmile ho doplníte, se ukazuje přímo v bloku.
2. Změnit jde **studio (Kalendář), datum, čas i zvukaře**. V nabídce zvukařů jsou **jen ti, kdo v daném studiu točí** (zaškrtává se jim to na kartě uživatele v Administraci) — brněnského zvukaře na pražskou frekvenci zapsat nejde. Když přepnete studio, zvukař z toho původního se odznačí. Herce změnit nejde — ten patří k nabídce. Když **Druh** přepnete na **Střih**, frekvence se zruší a na jejím místě vznikne střih (vyberte zvukaře). Stejně to jde na **Casting** — herec z frekvence zůstane.
3. **Poznámka** pro tým — ukáže se v detailu události. Dole je **Zrušit frekvenci**, když se nenatáčí vůbec.

Herec dostane v portálu **oznámení** o každém přesunu i zrušení.

# 6. Termíny v kalendáři herce

Na stránce s termíny i v **Moje termíny** má herec po potvrzení tři tlačítka (v potvrzovacím e-mailu je jen **Přidat do kalendáře**):

![Potvrzené termíny s tlačítky pro přidání do kalendáře](/navody/terminy-5.png)

1. **Přidat do kalendáře** — telefon nebo počítač nabídne přidat všechny potvrzené termíny najednou.
2. **Odebírat (aktualizuje se samo)** — kalendář si termíny obnovuje sám, takže se v něm projeví i přesun nebo zrušení. Aktualizace může trvat i několik hodin — iPhone a Google si odebírané kalendáře stahují po svém. Vedle je **Google Kalendář** pro ty, kdo používají Google.

# 7. Moje natáčení a změna termínu (herec)

Když má herec účet, najde po přihlášení v **Moje termíny** blok **Moje natáčení** — všechny svoje nadcházející frekvence napříč projekty.

![Moje termíny po týdnech s rozbalenou změnou termínu a hláškou o posunu odevzdání](/navody/terminy-6.png)

1. **Po týdnech** — termíny ze stejného týdne jsou pohromadě („Tento týden", „Příští týden"…). Každý termín je na jednom řádku: den, čas, projekt a **přesné studio** (Brno I / Brno II), ať herec ví, kam v ten den jde.
2. **Stav** — potvrzený termín svítí zeleně **✓ Potvrzeno**. Termín, který herec vybral a my ho ještě nepotvrdili, má **Čeká na potvrzení**.
3. **Změna termínu** — jen u potvrzených. Rozbalí volné termíny ve stejném městě na měsíc dopředu. Termín do poslední možné frekvence (dva dny před datem dokončení projektu) se po kliknutí **přesune hned** a produkce dostane oznámení.
4. **Termín s ⚠** je až **po** poslední možné frekvenci — posunul by odevzdání.
5. Po kliknutí na něj vyskočí hláška **„Tenhle termín musíme potvrdit"**. Herec může **Požádat o přesun** — původní termín platí dál a pod ním se ukáže „Čeká na potvrzení přesunu". Žádost může sám zrušit.

**Proběhlá natáčení** — jakmile potvrzený termín skončí, sám se přesune z Moje natáčení do bloku **Proběhlá natáčení** pod ním (šedě, se štítkem *Proběhlo*, po měsících; aktuální měsíc je rozbalený). Nic se u toho neklikne a v kalendáři se nic nemění. Termín, který herec jen vybral a my ho nepotvrdili, tam nepatří.

**Produkce** dostane oznámení a na stránce nabídky se objeví žlutý rámeček **Herec žádá přesun za termín odevzdání** s tlačítky **Potvrdit přesun** a **Zamítnout**. Po potvrzení se termín přesune a herci přijde oznámení. **Datum dokončení projektu se samo neposune** — upravte ho v detailu projektu.

# Časté otázky

**Nabídka má 0 volných míst.** Zkontrolujte období — typicky je datum dokončení projektu moc blízko, takže poslední frekvence vyjde dřív než první. Posuňte datum dokončení nebo období ručně.

**Herec potřebuje natáčet jinde, než má v profilu.** V okně nabídky prostě zaškrtněte jiné studio — zaškrtnutá studia mají přednost před profilem herce.

**Chci termín herci jen posunout.** Dvojklikem na frekvenci v kalendáři. Herec dostane oznámení a v odebíraném kalendáři se mu změna projeví sama.`,
};
