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
 */
export const REKLAMY_PRIPOMINKY = {
  slug: 'reklamy-pripominkovani-schvalovani',
  nazev: 'Reklamy: připomínkování spotu a schválení klientem',
  perex:
    'Jak klient spot poslechne, zapíše k němu připomínky přímo v čase nahrávky a jedním tlačítkem zakázku schválí — a co se tím u nás stane.',
  kategorie: 'Reklamy',
  poradi: 20,
  obsah: `U reklam jde všechno jednou cestou: klientovi odejde odkaz, on si spot pustí, buď k němu napíše připomínky s časem, nebo zakázku rovnou schválí. Schválením se projekt překlopí do „Schváleno - k fakturaci" a my víme, že se může fakturovat. Tenhle návod říká, kde se to zapíná, co klient vidí a kde se to u nás objeví.

# Co musí být nastavené

**Firma musí mít zaškrtnuté Reklamy** (Firmy → karta firmy → Druh zakázek). Podle toho se pozná reklamní klient — u audioknih se nic z toho nenabízí, tam vede cesta přes opravy a stavy přehazujeme my.

**Projekt musí mít složku na Disku** (odkaz na KZ u projektu) a v ní spot — zvuk nebo video. Odkaz pro klienta se vyrábí u projektu tlačítkem **Vyrobit odkaz**; je to tentýž odkaz jako na nahrávky a přeposlech, takže se dá kdykoliv zneplatnit a vygenerovat nový.

# Jak to vidí klient

**Ve složce s nahrávkami** má u každého zvuku a videa tlačítko **Připomínkovat**. Otevře se mu tagger spotu:

- **u videa** je nahoře náhled a pod ním zvuková stopa,
- **u samotného zvuku** je rovnou velká vlna přes celou levou část,
- **vpravo** píše připomínky. Žádné jméno nevyplňuje.

Ťukne na **Označit místo**, čímž si zapíchne čas (přehrávání se zastaví, aby mu čas neutekl, než větu vymyslí), napíše, co drhne, a dá **Zapsat k času**. Zapsaná připomínka se hned uloží — když klient okno zavře, nic se neztratí. V křivce se ukáže jako červená čárka a kliknutím na ni se přehraje to místo.

**Když je ve složce víc spotů**, je nad taggerem přepínač a připomínky patří vždycky k tomu, který je zrovna otevřený.

# Odeslání připomínek

Dokud klient nezmáčkne **Odeslat připomínky**, ví o nich jenom on. Je to schválně: klient si spot projde, nasbírá k němu třeba deset věcí a pošle je najednou. Deset upozornění za sebou by z toho udělalo šum a nikdo by je nečetl.

Jakmile odešle, **cinkne zvoneček manažerovi projektu** a všem, kdo mají na kartě zaškrtnuté „Dostává dotazy klientů". Upozornění vede rovnou do taggeru, takže si každý poslechne přesně to místo.

Připomínky si můžete odškrtávat jako vyřízené — tlačítko **Hotovo** u řádku vidí jen přihlášený tým, ne klient.

# Schválení zakázky

Tlačítko **Schválit** je na třech místech a všechna dělají totéž:

1. **v mailu** o hotovém spotu (tlačítko **Schválit**),
2. **ve složce s nahrávkami**, v **taggeru spotu** i v **AudioTaggeru** — všude, kam se klient z odkazu dostane,
3. **v klientském portálu** v přehledu projektů, ve sloupci Schválení — jen u reklamních firem.

**Odkaz pro klienta** v záložce Připomínky vede u reklamy rovnou do taggeru spotu (`/pripominkovat/…`) — tam klient píše připomínky k času a má tlačítko Schválit.

**Schvaluje se celý projekt, ne jednotlivá nahrávka.** Ať klient klikne kdekoliv, schvaluje tutéž zakázku.

Co se stane po kliknutí:

- projekt se překlopí do stavu **Schváleno - k fakturaci**,
- do **historie projektu** se zapíše řádek s původcem „Klient (odkazem)", takže je na první pohled vidět, že stav nepřehodil nikdo od nás,
- **cinkne zvoneček** těm, kdo hlídají změny u projektů,
- u zakázky zůstane uložený okamžik schválení — i kdyby se stav později ručně přehodil, zůstane dohledatelné, kdy to klient odklepl.

Tlačítko se ptá podruhé („Opravdu schválit? Klepněte znovu"). Odkaz z mailu sám o sobě nic nepřeklápí — schvaluje se až kliknutím na stránce. Kdyby stav měnilo otevření odkazu, odklepl by spot první antivir, který si ho ze zvědavosti stáhne.

# Když se klient splete

Schválení zpátky vzít nemůže. Napíše nám a stav přehodíme ručně u projektu; razítko „klient schválil tehdy a tehdy" zůstane, takže je pořád jasné, co se stalo.

# Na co si dát pozor

- **Velké soubory.** Křivka se počítá z celého souboru, takže u stopadesátimegového náhledu chvíli trvá, než se vykreslí. Přehrávat a zapisovat jde i mezitím. Pro klienta je lepší na Disk dávat lehčí náhledové mp4.
- **Odkaz je vstupenka.** Kdo ho má, dostane se do složky projektu a může schvalovat. Když se dostane, kam neměl, stačí u projektu vygenerovat nový — starý tím okamžitě umře.
- **Starší připomínku klient nesmaže.** Do čtvrt hodiny od zápisu ano (pojistka na překlep), potom už ne — cizí zpětnou vazbu nemá mazat nikdo, kdo si jen přeposlal odkaz.`,
};
