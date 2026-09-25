/**
 * NÁVOD: MAPA PORTÁLU (zadání 18. 9. 2026: „udělej mi přehled (mapu) celého
 * portálu, jakou má strukturu a jak obecně funguje. Aby to pochopil každý.
 * A dej to pak do nápovědy na portál rovnou").
 *
 * Je to úvodní návod pro každého, kdo portál otevře poprvé - proto pořadí 1
 * a kategorie „Začínáme". Schválně bez technických pojmů: kde co je, kdo co
 * vidí a co portál dělá sám.
 *
 * Text tady je jen ZAČÁTEK. Jakmile ho někdo v portálu upraví, seed už do něj
 * nesahá - zakládá se jen tehdy, když návod s touhle adresou ještě není.
 */
export const MAPA_PORTALU = {
  slug: 'mapa-portalu',
  nazev: 'Mapa portálu: co kde je a jak to funguje',
  perex: 'Celá cesta zakázky na jednom obrázku — klient, my a herec krok po kroku. K tomu mapa sekcí, kdo co vidí a co portál dělá sám.',
  kategorie: 'Začínáme',
  poradi: 1,
  obsah: `MS Portal drží celou zakázku na jednom místě: objednávku, projekt, natáčení, nahrávky pro klienta, smlouvu s hercem, fakturu i to, jestli přišla platba. Dřív to bylo rozseté mezi Caflou, e-maily, Disk a tabulky. Tenhle návod je mapa — kde co je, kdo co vidí a co se děje samo.

# Celá cesta zakázky na jednom obrázku

Vodorovně jde čas, od objednávky po zaplacenou fakturu. Ve třech pruzích je vidět, **co v které chvíli dělá klient, co my v portálu a co herec** — a u každého kroku i to, jestli se k tomu ten člověk přihlašuje, nebo mu stačí odkaz z e-mailu.

![Celá cesta zakázky: klient, Mediaspace a herec v šesti krocích](/navody/cela-cesta.png)

Tři věci, které z obrázku stojí za zdůraznění:

- **Klient ani herec nic neinstalují.** Schválení nabídky, podpis smlouvy, stažení nahrávek, přeposlech, výběr termínů i vyplnění údajů — všechno jde odkazem z mailu, který funguje sám o sobě. Účet v portálu je bonus, ne podmínka.
- **Prázdné místo v pruhu znamená, že ten člověk nemá co dělat.** Herec neřeší nabídku, klient neřeší plánování studia. Každý vidí jen svůj kousek.
- **Zelené pruhy dole jsou práce, kterou nikdo nedělá** — portál je udělá sám.

# Mapa sekcí

![Mapa portálu](/navody/mapa-portalu.png)

# Šest sekcí v horní liště

**Projekty** jsou srdce portálu. Každá zakázka má svou kartu: stav, termíny, herce, rozpočet, nahrávky, doklady. Většina práce se odehraje tady. V přehledu se řadí kliknutím na hlavičku sloupce; **stav se neřadí abecedně**, ale v pořadí, které si tým nastaví tlačítkem **Pořadí stavů** vedle hledání (přetažením nebo šipkami, mění ho Žůžo-labůžo a produkce, platí pro všechny). Nabídky stavů u projektu se to netýká — cesta projektu zůstává, jak je.

**Firmy** jsou klienti a dodavatelé. U klienta se kromě adresy a fakturačních údajů nastavuje i to, **které zprávy mu portál posílá** — na kartě firmy je záložka Notifikace a co tam není zapnuté, se neodešle. Nová firma má vypnuté všechno.

**Uživatelé** jsou lidé. Kromě role se u účtu zaškrtává, co ten člověk smí a co mu chodí: jestli může být manažerem projektu, jestli podepisuje smlouvy za Mediaspace, jestli vidí sekci Banka, komu chodí objednávky. Je to schválně **u účtu, ne v kódu** — lidi se mění a portál o tom jinak neví.

U **zvukaře** se navíc zaškrtává **Studia** — ve kterých studiích točí. Kdo jezdí do Brna I i Brna II, má zaškrtnutá obě. Projeví se to na dvou místech: v seznamu uživatelů je to vidět ve sloupci Lokace a v kalendáři jde k události vybrat **jen zvukaře z toho studia** — na brněnskou frekvenci pražského nezapíšete, a naopak. Hlídá to i server, ne jen nabídka ve formuláři. Dokud u nikoho v daném studiu není nic zaškrtnuté, nabízejí se všichni, ať jde frekvence zapsat; kdo je u starší události napsaný, v ní zůstane. Zaškrtávátka jsou ze skutečných studií, takže nově založené studio v nabídce přibude samo.

Kdo má jinou roli (třeba Žůžo-labůžo) a občas dělá i zvukaře, má na kartě zaškrtnuté **Může být i zvukař**. Role mu zůstane, jen se navíc nabízí mezi zvukaři u natáčení a střihu v kalendáři. Když nemá zaškrtnutá žádná studia, nabízí se ve všech. Takhle je nastavený Peter Dratva.

Názvy projektů portál drží **velkými písmeny** — ať už je někdo zadá jakkoli, uloží se velkými a stejně se jmenuje i kanál projektu v chatu. Přejmenování projektu přepíše i název kanálu.

**Wikipedie** (Administrace → Wikipedie) je místo, kde si článek o sobě na Wikipedii napíšete a vyladíte: vlevo wikitext, vpravo náhled, jak ho vykreslí Wikipedie, a uložené verze, ke kterým se jde vrátit. Portál na Wikipedii nic neukládá. Text zkopírujete a vložíte tam sami svým účtem, návod je přímo na stránce. Až bude článek venku, napište jeho název do Hlídání a portál vám každou hodinu zvonkem ohlásí, když ho někdo upraví. Každý tu vidí jen svůj článek. V záložce **Údaje o sobě** se vyplní jméno, datum a místo narození, povolání, fotka z Commons, zdroje, milníky a tvorba; tlačítko **Sestavit text z údajů** z toho poskládá hotový wikitext včetně referencí. V záložce **Vzpomínání** si můžete povídat s pomocníkem: vyprávíte, co jste zažili, on se doptá na podrobnosti a na zdroje a napíše hotový kus wikitextu, který se jedním kliknutím přidá do konceptu. Text jde z portálu i **rovnou odeslat na Wikipedii** — stačí jednou vložit osobní přístupový token (OAuth „owner-only" z meta.wikimedia.org) a vyplnit, kam se má uložit; odesílá se poslední uložená verze a úprava jde pod vaším účtem.

**Ceníky** jsou dvě věci najednou: ceny služeb a zároveň seznam typů projektu. U projektu jde vybrat jen takový typ, který je v ceníku — proto se nové typy přidávají tady.

**Doklady** jsou peníze: nabídky, faktury, přijaté výdaje, smlouvy, banka a „Moje firmy" (za kterou firmu doklad vystavujeme, číselné řady, bankovní účty, podpis na faktury). U výdaje se nahraje PDF nebo fotka dokladu (i víc souborů) — údaje se z něj přečtou samy; přílohy i údaje jde kdykoli později doplnit v detailu výdaje. Co se platí **na vícekrát** (smlouva, velká faktura), se v detailu výdaje zapisuje po částech — karta **Úhrady**: kolik odešlo a kdy. Portál z toho drží **kolik je uhrazeno a kolik zbývá doplatit**, v seznamu svítí odznak „Částečně" a QR platba se kreslí už jen na zbytek. Uhrazeno se doklad označí sám, jakmile se částka dorovná.

**Kalendář** má vedle studií ještě tři samostatné kalendáře: **Mimo studio** (kdo není), **Porady** (žluté, jen pro pozvané) a **Schůzky** (tyrkysové, společné pro Žůžo-labůžo a produkci). Jinak je to studio a natáčení: kdo kdy natáčí, kdy je studio blokované a nabídky termínů pro herce. Události zapisuje a upravuje produkce a vedoucí pobočky ve svých studiích (zaškrtává se na kartě uživatele – Tomáš Ilavský Brno, Ondřej Černý ml. Praha); ostatní si zapisují Mimo studio. Tlačítko „+ Přidat“ vedle přepínače Den/Týden/Měsíc otevře zápis i bez dvojkliku. Vedle nadpisu Kalendář jsou dvě ikony: **výstražný trojúhelník** s počtem konfliktů (co se pere — vaše vlastní vidíte jen vy, z natáčení jen to, kde jste označení) a **hodiny se šipkou** s historií, kdo kdy co v kalendáři změnil. Konflikt, který je schválně, odklepnete v panelu tlačítkem **Je to záměr** — přestane svítit i v liště a dole v panelu zůstane, aby šel vrátit. Jakmile se některá z těch dvou událostí posune, upozornění se vrátí samo.

**Přehled dne a připomínky.** V Můj účet se dá zapnout **Hlídat mi den**: ráno v sedm přijde **upozornění do telefonu** a při prvním otevření portálu vyskočí **okno s programem dne**; patnáct minut před každou událostí navíc přijde **připomínka** od Bruna do chatu i do telefonu. V okně je, co vás ten den čeká — natáčení, střihy a castingy, kde jste zvukař nebo herec, porady, na které jste pozvaní, Schůzky (produkce je vidí všechny) a u koho chodí **režie na dálku** — každé s ikonou svého druhu a štítkem studia. Pod tím jsou **úkoly s dnešním termínem**; dlouhodobé sem nepatří, ty jsou v to-do listu. **Kouknout se jde kdykoliv během dne:** v levém panelu rychlých voleb je **Co mě dnes čeká** — jedno klepnutí a okno se otevře znovu (ráno pak vyskočí tak jako tak). **Co už proběhlo, v okně není** — odpovídá na „co mě ještě čeká", takže událost z něj zmizí, jakmile doopravdy skončí; rozjeté natáčení v něm zůstane až do konce. **Před první frekvencí s hercem** přidá Bruno pár vět o tom, **o čem ta kniha je** — přečte si režijní edit ve složce projektu a napíše, co se v knize děje, jakým tónem je psaná a která jména se špatně vyslovují. Píše to jen z rukopisu, nic si nedomýšlí; udělá se to jednou a pak to u projektu vidí každý. **Zeptat se jde i kdykoliv jindy:** napište Brunovi do chatu „Bruno, co mám dneska?“ (nebo zítra, v pátek, 30. 9.) a přehled pošle hned. **Bruna si jde v chatu založit jako kohokoliv jiného** — v nové zprávě je v seznamu lidí; v soukromé konverzaci s ním se oslovovat jménem nemusíte, mluvíte s ním tak jako tak. **Povídat si s ním jde normálně**: drží nit rozhovoru a zvládne i věci mimo portál — napsat nebo učesat text, přeložit, vymyslet názvy, něco vysvětlit. Do portálu si přitom sáhne sám, když je odpověď v datech.

Kromě toho je v liště ještě **chat**, **zvoneček** s upozorněními, **otazník** (tahle Nápověda) a vlevo panel s rychlými volbami.

**Úkoly z chatu.** Zpráva začínající **@úkol** založí úkol tomu, komu píšete (ve skupině tomu, koho označíte @jménem). Co jste takhle zadali ostatním, najdete v panelu **Úkoly** (i v záložce Úkoly v chatu) dole v části **Zadal jsem**: pro koho, do kdy a jestli už je hotovo. Když ho příjemce odškrtne, přijde vám zpráva pod **zvoneček**; stejně tak, když nesplněný úkol smaže. Kliknutím na úkol se otevře konverzace, ze které vznikl. Tužkou ✎ vedle úkolu ho můžete **upravit** — název, datum i čas — nebo **zrušit**; tomu, komu patří, o tom přijde zpráva. Odškrtnout ho za něj nejde.

**Klient se dozví o odpovědi.** Když klientovi odpovíme v jeho **Dotazech**, přijde mu mail, že má v portálu nepřečtenou zprávu — s ukázkou a odkazem, který dotaz rovnou otevře. Chodí **jeden mail na jedno nepřečtení**: další až potom, co si zprávy přečte, takže se při psaní tam a zpátky schránka nezahltí. Kdo je zrovna v portálu (četl v posledních patnácti minutách), mail nedostane vůbec.

**Status v chatu.** Nad seznamem rozhovorů je proužek **Nastavit status** — co zrovna děláte, uvidí ostatní u vašeho jména v chatu (v seznamu i v hlavičce otevřené zprávy). Je z čeho vybrat jedním klepnutím (Na obědě, Ve studiu, Na cestě…) nebo si napíšete vlastní i s emoji a nastavíte, jak dlouho platí. **Mimo studio se doplní samo** všem, kdo to mají zapsané v kalendáři Mimo studio. Komu je na kartě zaškrtnuté **Status v chatu z kalendáře**, tomu se sám nastaví i **„Mám schůzku do 14:30"** (porady a schůzky), **casting** na celou dobu a **režie na dálku** na prvních třicet minut — na zbytek frekvence už status nesvítí. **U zvukaře** se navíc samo ukáže, na čem zrovna dělá — ikona **natáčení**, **střihu** nebo **castingu** (tytéž kresby jako v kalendáři) a u ní **název projektu** a do kolika. Vlastní status má přednost, dokud platí; jakmile vyprší, vrátí se ten z kalendáře.

**Upravit jde i vlastní úkol.** Tužka ✎ u úkolu v panelu i v záložce Úkoly v chatu otevře název, datum i čas k přepsání — překlep ani posunutý termín se nemusí psát znovu. Ve stejném okénku je i mazání (na dvě klepnutí).

**Termín s časem.** U každého úkolu (vlastního, zadaného v chatu i v panelu) jde vedle data vyplnit i **čas, do kdy** má být hotový. Je dobrovolný — bez času platí úkol do konce dne. Po termínu se úkol obarví červeně hned, jak čas uplyne.

# Uvnitř projektu

Karta projektu má záložky a ukazují se jen ty, které dávají smysl:

- **Přehled** — nahoře Progres natáčení (celý projekt a pod ním každý herec), pak stav, termíny, klient, herci, odkaz pro klienta. Vidí ho každý.
- **Rozpočet** — položkové náklady, výkazy zvukařů, bonusy. Admin a produkce.
- **Přehledy → Kapacita studií** — měsíc na jedné obrazovce: řádek den, sloupec studio a v něm ranní a odpolední frekvence (9-13, 13-17 podle zkratek studia), každá jako obdélníček. Čím tmavší, tím víc **natáčení** proti otevírací době studia; prázdné místo je díra. Víkendy mají vlastní podklad, hodiny ukáže najetí myší, nad tabulkou je proužek dvanácti měsíců s procenty. Střih, casting ani blokace se nepočítají. Pod mřížkou jsou **grafy** (obsazenost po měsících, podle dne v týdnu, ranní vs. odpolední frekvence) a tlačítko **Stáhnout data (CSV)** pro vlastní analýzy v Excelu. Admin a produkce.
- **Přehledy → Obrat a zisk** (jen admin) — obrat z vydaných faktur, náklady z výdajů a zisk bez DPH v korunách: dlaždice se srovnáním s minulým obdobím, graf po měsících nebo čtvrtletích (najetím přesná čísla, jde přepnout na tabulku), obrat podle klientů, náklady podle kategorií a tabulka projektů. Nahoře výběr roku nebo posledních 12 měsíců, firmy a přepínač Vystaveno/Uhrazeno (podle data dokladu, nebo jen peníze, které opravdu přišly a odešly).
- **Přehledy → Zvukaři** (jen admin) — co za vybraný měsíc chodí zvukařům v měsíčním přehledu: hodiny, částka a bonusy každého, rozpad podle druhu práce a projektů, jestli a kdy mail odešel a náhled jeho mailu. Pod tím nastavení: vypínač, den rozeslání (1.–28., v 8:00 za měsíc minulý), co v mailu je (částky, druhy práce, projekty, bonusy) a vlastní vzkaz. Tlačítko „Rozeslat teď" pošle přehled těm, komu ještě neodešel.
- **Tabule ve studiích** — dotykový displej ve studiu: datum a čas, dnešní program studia z kalendáře (co právě probíhá, nebo dokdy je volno a co je další), poznámky (zůstávají, dokud je někdo neodškrtne) a dlaždice „co chybí“ (káva, toaletní papír, kapesníky…). Ťuknutí na chybějící věc pošle Báře Šiblové zprávu od Bruna. Zapíná se a adresa pro displej se bere v Administrace → Studia; displej se nepřihlašuje.
- **Natáčecí plán** — plánování studia a herce.
- **Rodný list** — jen u rádiového spotu; PDF se vyrobí samo, když je spot hotový.
- **Tabule ve studiích** — obrazovka ve studiu s dnešním programem, poznámkami a tím, co chybí. Nahoře svítí, co právě běží — natáčení i střih; když jede víc věcí naráz, ostatní jsou pod tou hlavní jako „Zároveň“. Tabuli si může otevřít i člověk z týmu pod svým účtem: na kartě uživatele se zaškrtne **Přístup na tabule** a pak ji má rovnou v horní liště pod odkazem **Tabule** (a taky v Můj účet → Tabule ve studiu). Admin má odkaz Tabule vždycky a vybere si v něm, kterou pobočku otevřít. Z tabule se člověk z týmu vrátí tlačítkem **Zpět do portálu** v levém horním rohu (displej ve studiu ho nemá). Každé studio má **účet tabule** (jméno jako „brno1“ a heslo, bez e-mailu, spravuje se v Administraci → Studia); počítač u obrazovky se jím přihlásí v Chromu a portál rovnou ukáže tabuli toho studia. Do zbytku portálu se tímhle účtem nedostane. V okně vedle programu běží **příběhy z Instagramu** (když žádný není, poslední příspěvky) - účet se připojuje v Administraci → Studia a u každého studia jde okno vypnout.
- **Licenční list** — u ostatních reklam (ne u rádiového spotu). Vymezení licence pro jednoho herce: území, média, délka a typ licence. Formulář je předvyplněný z projektu, PDF se uloží i do složky projektu na Disku.
- **Přeposlech** — AudioTagger: poslech nahrávky a zápis chyb s časem a stranou scénáře. Jak daleko to je, hlásí **sluchátka** v hlavičce projektu a ve sloupci **Přeposlech** v přehledu: šedá = nachystané stopy, oranžová s číslem = běží to a tolik chyb je zapsaných, zelená s fajfkou = přeposlechnuto komplet. Najetím myší se ukáže i kolik stop je doposlechnutých a kolik procent textu.
- **Natáčecí protokol** — co se při natáčení stalo.
- **Poznámky** — vnitřní blok pod projektem: co je k zakázce potřeba vědět a nepatří do žádné kolonky. Kdokoliv z nás sem napíše poznámku, dole je vždycky **poznámka klienta z objednávky** (ta se nemaže, čte se rovnou z objednávky). Vidí je jen Žůžo-labůžo a produkce, zvukař ne.
- **Historie** — co se u projektu měnilo a jaké zprávy odešly klientovi.
- **Doklady** — nabídky, faktury, výdaje a smlouvy navázané na projekt. Jen admin. Odsud jde nový doklad (i výdaj, také k ukončenému projektu) rovnou založit, projekt i klient se předvyplní.

# Cesta zakázky

1. **Objednávka.** Klient ji pošle v portálu (audiokniha nebo reklama). Vznikne projekt, kanál v chatu a složka na Disku, a nám přijde mail — tlačítko v něm vede **rovnou na detail toho projektu** a poznámka z objednávky je u projektu v záložce Poznámky. U Audiotéky se v objednávce navíc vyplní autor, překladatel a nakladatelství a z nich se sám složí **úvod a závěr audioknihy** (režie vždy Ondřej Černý) — klient ho může upravit nebo přepsat, v detailu projektu je vidět a dá se doladit. Cena v objednávce se počítá ze sazby za normostranu; u firmy, která si **cenu navrhuje sama** (zaškrtávátko na kartě firmy — takhle to má Albatros), se nepočítá nic: pole Počet normostran i Cena zůstávají a klient si je vyplní sám, sazba se u ní vůbec nenastavuje.
2. **Nabídka.** Vystaví se v Dokladech a odejde klientovi odkazem. Klient ji otevře, prohlédne a **schválí jedním kliknutím** — a na zvonečku to cinkne manažerovi projektu.
3. **Natáčení.** Produkce sestaví hercovi nabídku termínů, herec si z odkazu vybere, produkce potvrdí — a tím vzniká rezervace studia. Smlouva s hercem se založí ze šablony a herec ji podepíše taky odkazem.
4. **Práce a nahrávky.** Zvukař si píše výkazy, nahrávky se ukládají na Disk a klient se k nim dostane odkazem z mailu — bez přihlašování. V přeposlechu píše, co chce opravit.
5. **Stav projektu** se během toho posouvá: V přípravě → Natáčíme → Dotočeno → Dokončeno - ke schválení → Schváleno - k fakturaci → Vyfakturováno. Podrobně je to v návodu *Stavy projektu a tlačítko Dotočeno*. **U reklam** fajfku *Dotočeno* nikdo neklikne — den po natáčení (podle kalendáře) ji hercům doplní Bruno sám, aby byli v seznamu zvýraznění. Nechodí u toho žádná zpráva ani nic do chatu a stav reklamy zůstává, kde je. Když je projekt ve stavu **Schváleno - k fakturaci** a faktura se klientovi odešle z portálu, **Bruno projekt sám ukončí** (stav Vyfakturováno) — tiše, do chatu o tom nepíše (je to vidět v historii projektu). V jiném stavu (třeba u zálohové faktury během natáčení) se projekt neukončí.
6. **Faktura.** Vystaví se z nabídky nebo rovnou u projektu. Projekt je hotový až fakturou.
7. **Platba.** Portál si třikrát denně stáhne pohyby z banky. Když sedí variabilní symbol i částka, **označí fakturu jako uhrazenou sám**; když sedí jen něco, nabídne to ke schválení.

# Lidé zvenčí nic neinstalují

Klient ani herec se nemusí nikam přihlašovat, když nechtějí. Portál posílá **odkaz, který funguje sám o sobě**: schválení nabídky, podpis smlouvy, stažení nahrávek, přeposlech, výběr termínů, vyplnění údajů. Odkaz je dlouhý a náhodný, stránka se nedá najít přes vyhledávač a jde kdykoliv zneplatnit a vygenerovat nový.

Klient, který účet má, vidí v portálu navíc své projekty, nahrávky a může objednávat.

# Kdo co vidí

- **Klient** — jen své projekty a nahrávky, ceny jen na svých dokladech. U rozpracovaných projektů vidí Progres natáčení.
- **Herec** — své termíny a údaje, smlouvy podepisuje odkazem. V Projektech vidí jen své projekty: název, Progres natáčení (válec: strana, kde se skončilo, proti počtu stran PDF s textem a kolik stran zbývá dotočit; po Dotočeno 100 %; u víc herců průměr), normostrany, stranu, kde se skončilo na poslední frekvenci, a odkaz na text (PDF končící _RE ze složky projektu). V Honorářích vidí, co je navrhnuto, co čeká na proplacení a co je zaplaceno, a odtud se dostane i ke svým smlouvám.
- **Zvukař** — projekty, kde pracuje, své výkazy a kalendář ke čtení. Nevidí rozpočty, doklady ani projekty v přípravě.
- **Produkce** — plánování, rozpočty, pozvánky herců. Nevidí doklady ani ceny objednávek.
- **Žůžo-labůžo (admin)** — všechno, včetně administrace.
- **Banka** je navíc: vidí ji jen ten, kdo to má u účtu zaškrtnuté, ani ostatní admini ne.
- **Nápověda** je naše: návod bez zaškrtnuté role vidí jen tým (Žůžo-labůžo, Produkce, Zvukař). Herec nebo klient uvidí jen návod, u kterého je v Adminu ▸ Návody ▸ „Komu se ukáže" zaškrtnutá jeho role — a jen tehdy se mu v liště objeví otazník.

# Co portál dělá sám

- **Páruje platby** z banky s fakturami (třikrát denně).
- **Hlídá opravy** — sedm dní po odevzdání, když klient nic neposlal, přehodí projekt na „Čekáme na opravy" a napíše mu.
- **Píše klientovi** zprávy o stavu projektu podle toho, co má jeho firma zapnuté; text se bere ze Vzorů zpráv. Navíc mu u audioknihy odejde zpráva **„Přeposlech dokončen"** ve chvíli, kdy v AudioTaggeru klepne na PŘEPOSLECHNUTO — že přeposlech máme kompletní a pouštíme se do finálních oprav. Tahle jediná chodí i bez zapnutí na kartě firmy (vypnout jde tamtéž, přepnutím na Neposílat); u reklamní firmy neodejde vůbec.
- **Čte účtárenskou schránku** a z příloh zakládá nezařazené výdaje — z účtenky si navíc přečte částku, datum i dodavatele.
- **Vyrobí rodný list** spotu, jakmile je reklama hotová.
- **Navrhne bonus** zvukaři, který odvedl většinu střihu.
- **Nabídne zvukaři výkaz** pět minut před koncem jeho natáčení, castingu nebo střihu v kalendáři — přijde upozornění do zvonečku i do mobilu a ve **Výkazech** čeká řádek, který se jedním klikem („Přidat výkaz") překlopí do výkazu. Produkce s tím nic nedělá.
- **Šestého v měsíci** pošle zvukařům přehled jejich výkazů za minulý měsíc.
- **Bruno** čte kanály projektů v chatu, pozná, kam se doteklo natáčení, a zapíše to do karty projektu. Když si není jistý, zeptá se v kanálu.
- **Bruno je zároveň nápověda k portálu** (23. 9. 2026). Napište mu do chatu — v kanálu přes „Bruno, …", v soukromé konverzaci rovnou — třeba „kde zapíšu výkaz", „co mě čeká zítra" nebo „jak je na tom Strabag". V soukromé zprávě a ve skupině si **sám sáhne do portálu**: do kalendáře, do projektů, do vašich úkolů a do návodů — a odpoví i s odkazem. Dívá se **vašima očima**: co vám role nepouští, to se nedozvíte ani od něj.

# Na čem to stojí

Portál běží na Vercelu, data jsou v databázi. Nahrávky bydlí na **Google Disku** (portál je jen ukazuje a stahuje), ostatní přílohy v úložišti s dočasnými odkazy. Kurzy měn se berou z **ČNB** a ukládají se k dokladu, údaje firem z **ARESu**, banka jde přes **GoCardless**. E-maily chodí přes běžný SMTP, upozornění do mobilu přes push.

# Když něco hledáš

- **Kde je zakázka a jak na tom je?** Projekty → karta projektu → Přehled.
- **Kdy natáčíme a kde?** Kalendář, nebo záložka Natáčecí plán u projektu.
- **Chci kalendář v telefonu?** Kalendář → ikonka kalendáře s plusem vpravo nahoře (Google, Apple, Outlook; jen pro čtení).
- **Co jsme klientovi poslali?** Historie u projektu.
- **Kolik jsme fakturovali?** Doklady u projektu, nebo sekce Doklady.
- **Přišly peníze?** Doklady → Banka (kdo na ni má právo).
- **Proč klientovi nic nepřišlo?** Firmy → karta firmy → Notifikace.
- **Jak něco udělat?** Otazník v liště — tahle Nápověda.`,
};
