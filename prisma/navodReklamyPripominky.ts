/**
 * NÁVOD: PŘIPOMÍNKOVÁNÍ A SCHVALOVÁNÍ REKLAM (zadání 18. 9. 2026: „udělej
 * nápovědu o tom, jak funguje připomínkování a schvalování reklam").
 *
 * Píše se pro NÁS - pro produkci a zvukaře, kteří spot klientovi posílají a
 * pak koukají, co se vrátilo. Klient návod nečte; ten dostane odkaz, kde je
 * všechno po ruce.
 *
 * Text tady je jen ZAČÁTEK. Jakmile ho někdo v portálu upraví, seed už do něj
 * nesahá - zakládá se jen tehdy, když návod s touhle adresou ještě není.
 *
 * OBRÁZKY (24. 9. 2026) jsou v public/navody/reklamy-1..3.png. Nejsou to
 * snímky obrazovky - kreslí se z repliky scripts/navody/reklamy.html:
 *   node scripts/navody/snimky.mjs reklamy
 * Oranžová čísla v replice patří k číslovaným popiskům pod obrázkem.
 *
 * NÁVOD JE O REKLAMÁCH, proto proDruhy: ['AD'] - audioknihy mají vlastní
 * (navodAudiotagger.ts) a klientovi se ukáže jen ten, který se ho týká.
 */
export const REKLAMY_PRIPOMINKY = {
  slug: 'reklamy-pripominkovani-schvalovani',
  nazev: 'Reklamy: připomínkování spotu a schválení klientem',
  perex:
    'Jak klient spot poslechne, zapíše k němu připomínky přímo v čase nahrávky a jedním tlačítkem zakázku schválí — a co se tím u nás stane.',
  kategorie: 'Reklamy',
  poradi: 20,
  proDruhy: ['AD'],
  obsah: `U reklam jde všechno jednou cestou: klientovi odejde odkaz, on si spot pustí, buď k němu napíše připomínky s časem, nebo zakázku rovnou schválí. Schválením se projekt překlopí do „Schváleno - k fakturaci" a my víme, že se může fakturovat. Tenhle návod říká, kde se to zapíná, co klient vidí a kde se to u nás objeví.

# Co musí být nastavené

**Firma musí mít zaškrtnuté Reklamy** (Firmy → karta firmy → Druh zakázek). Podle toho se pozná reklamní klient — u audioknih se nic z toho nenabízí, tam vede cesta přes opravy a stavy přehazujeme my.

**Projekt musí mít složku na Disku** (odkaz na KZ u projektu) a v ní spot — zvuk nebo video. Odkaz pro klienta se vyrábí u projektu tlačítkem **Vyrobit odkaz**; je to tentýž odkaz jako na nahrávky a přeposlech, takže se dá kdykoliv zneplatnit a vygenerovat nový.

![Záložka Připomínky u reklamního projektu: pruh Zatím neschváleno, odkaz pro klienta, přepínač spotů, vlna s označenými místy a sloupec připomínek](/navody/reklamy-1.png)

# Jak to vidí klient

**Ve složce s nahrávkami** má u každého zvuku a videa tlačítko **Připomínkovat**. Otevře se mu tagger spotu:

- **u videa** je nahoře náhled a pod ním zvuková stopa,
- **u samotného zvuku** je rovnou velká vlna přes celou levou část,
- **vpravo** píše připomínky. Žádné jméno nevyplňuje.

Ťukne na **Označit místo**, čímž si zapíchne čas (přehrávání se zastaví, aby mu čas neutekl, než větu vymyslí), napíše, co drhne, a dá **Zapsat k času**. Zapsaná připomínka se hned uloží — když klient okno zavře, nic se neztratí. V křivce se ukáže jako červená čárka a kliknutím na ni se přehraje to místo.

**Když je ve složce víc spotů**, je nad taggerem přepínač a připomínky patří vždycky k tomu, který je zrovna otevřený.

![Co vidí klient z odkazu: hlavička Připomínkování spotu, pruh Je zakázka v pořádku? s tlačítkem Schválit a tagger s připomínkami](/navody/reklamy-3.png)

# Odeslání připomínek

Dokud klient nezmáčkne **Odeslat připomínky**, ví o nich jenom on. Je to schválně: klient si spot projde, nasbírá k němu třeba deset věcí a pošle je najednou. Deset upozornění za sebou by z toho udělalo šum a nikdo by je nečetl.

Jakmile odešle, **cinkne zvoneček manažerovi projektu** a všem, kdo mají na kartě zaškrtnuté „Dostává dotazy klientů". Upozornění vede rovnou do taggeru, takže si každý poslechne přesně to místo.

Připomínky si můžete odškrtávat jako vyřízené — tlačítko **Hotovo** u řádku vidí jen přihlášený tým, ne klient.

# Zapracovali jsme připomínky

Když jsou opravy hotové, je v záložce **Připomínky** tlačítko **Zapracovali jsme připomínky** (20. 10. 2026). Co dělá:

- **Klientovi odejde zpráva** se seznamem toho, co bylo zapracováno — přesně těmi větami, které napsal on, s časem a názvem souboru. Dá se k tomu připsat poznámka („dotáčku jsme zkrátili a hudbu stáhli pod hlasem").
- **Stav zakázky se nemění.** Projekt zůstává v „Dokončeno - ke schválení"; schvaluje pořád klient, tohle je zpráva mezitím.
- **Připomínky ze seznamu zmizí** — klient i my máme čistý stůl pro další poslech. Nic se nemaže: visí dál u svého kola.
- **Historie verzí** je hned pod tlačítkem. Každá verze má datum, kdo ji odeslal, poznámku a celý seznam toho, co se tehdy opravovalo. První odevzdání je verze 1, každé zapracování posouvá číslo dál — stejné číslo vidí klient i v mailu.
- **Jde to i bez připomínek** (22. 10. 2026). Když klient nic nenapsal a verzi jsme doladili sami, na tlačítku stojí **Poslat novou verzi** a klientovi odejde zpráva „poslali jsme novou verzi" — bez seznamu, jinak stejná.

**Může se to opakovat, kolikrát je potřeba.** Klient znovu napíše připomínky, my je zapracujeme a pošleme druhé kolo — a tak dokola, dokud zakázku neschválí. Zprávy ke stavům se posílají jednou, tahle ne.

Komu zpráva jde: adresám nastaveným u stavu **Dokončeno - ke schválení** na kartě firmy, a když tam žádné nejsou, klientovi vedenému u projektu. My jsme ve skryté kopii.

# Schválení zakázky

Tlačítko **Schválit** je na třech místech a všechna dělají totéž:

1. **v mailu** o hotovém spotu (tlačítko **Schválit**),
2. **ve složce s nahrávkami**, v **taggeru spotu** i v **AudioTaggeru** — všude, kam se klient z odkazu dostane,
3. **v klientském portálu** v přehledu projektů, ve sloupci Schválení — jen u reklamních firem.

**Odkaz pro klienta** v záložce Připomínky vede u reklamy rovnou do taggeru spotu (adresa /pripominkovat/…) — tam klient píše připomínky k času a má tlačítko Schválit.

**U reklamy se klientovi otevírá jen jedno okno** (22. 10. 2026). Dřív vedl první mail ve stavu „Dokončeno - ke schválení" do složky s nahrávkami a až zpráva o zapracovaných připomínkách do taggeru — klient tak podle pořadí mailů viděl pokaždé něco jiného. Teď vede obojí do taggeru spotu: je v něm spot, schvalovací karta, připomínky i **tlačítko Stáhnout** vedle ovládání přehrávání. Soubor se stáhne přesně pod tím jménem, jaké má na Disku. Platí to i pro odkazy, které klient dostal dřív — adresa zůstává stejná, mění se jen to, co se na ní vykreslí.

**Schvaluje se celý projekt, ne jednotlivá nahrávka.** Ať klient klikne kdekoliv, schvaluje tutéž zakázku.

Co se stane po kliknutí:

- projekt se překlopí do stavu **Schváleno - k fakturaci**,
- do **historie projektu** se zapíše řádek s původcem „Klient (odkazem)", takže je na první pohled vidět, že stav nepřehodil nikdo od nás,
- **cinkne zvoneček** těm, kdo hlídají změny u projektů, a navíc každému, kdo má na kartě zaškrtnuté **Zvonek: klient schválil reklamu** (zatím Ondřej a Peter Dratva) — mail se u toho neposílá, je to naše interní vědomí, že zakázka může na fakturu,
- u zakázky zůstane uložený okamžik schválení — i kdyby se stav později ručně přehodil, zůstane dohledatelné, kdy to klient odklepl.

Tlačítko se ptá podruhé („Opravdu schválit? Klepněte znovu"). Odkaz z mailu sám o sobě nic nepřeklápí — schvaluje se až kliknutím na stránce. Kdyby stav měnilo otevření odkazu, odklepl by spot první antivir, který si ho ze zvědavosti stáhne.

# Stav nabídky

U reklam se dá u projektu držet, jak je na tom **nabídka**. Jsou tři stavy a symbol je vidět v **přehledu projektů** (vedle názvu) i v **detailu projektu** (v hlavičce vedle stavu):

- **hodiny (oranžové)** — nabídka čeká na schválení; tak je na tom každá reklama, dokud někdo neklikne jinam,
- **fajfka (zelená)** — nabídka schválena,
- **křížek (červený)** — nabídka neschválena.

Přehazuje se kliknutím na značku v detailu projektu. Je to **ruční značka** — nabídku posíláme mimo portál, takže se nemá odkud dozvědět sama. Se **Schválením zakázky** výše nemá nic společného: to je odklepnutí hotového spotu klientem, tohle je nabídka před natáčením.

Značku vidí jen ten, kdo má na kartě uživatele zaškrtnuté **Vidí stav nabídky u reklam** — zatím jen Ondřej.

# Když se klient splete

Schválení zpátky vzít nemůže. Napíše nám a stav přehodíme ručně u projektu; razítko „klient schválil tehdy a tehdy" zůstane, takže je pořád jasné, co se stalo.

# Na co si dát pozor

- **Velké soubory.** Křivka se počítá z celého souboru, takže u stopadesátimegového náhledu chvíli trvá, než se vykreslí. Přehrávat a zapisovat jde i mezitím. Pro klienta je lepší na Disk dávat lehčí náhledové mp4.
- **Odkaz je vstupenka.** Kdo ho má, dostane se do složky projektu a může schvalovat. Když se dostane, kam neměl, stačí u projektu vygenerovat nový — starý tím okamžitě umře.
- **Starší připomínku klient nesmaže.** Do čtvrt hodiny od zápisu ano (pojistka na překlep), potom už ne — cizí zpětnou vazbu nemá mazat nikdo, kdo si jen přeposlal odkaz.`,
};
