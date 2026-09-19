/**
 * NÁVOD: PLÁNOVÁNÍ NATÁČECÍCH TERMÍNŮ (zadání 19. 9. 2026: „OK, teď to
 * funguje. Udělej mi z toho návod do nápovědy").
 *
 * Popisuje celý oběh: nabídka z projektu jedním oknem, výběr hercem (včetně
 * vlastního času), potvrzení produkcí, úpravy v kalendáři a přidání do
 * kalendáře herce. Text je jen začátek - jakmile ho někdo v portálu upraví,
 * seed už do něj nesahá.
 */
export const NATACECI_TERMINY = {
  slug: 'nataceci-terminy',
  nazev: 'Natáčecí termíny - od nabídky po kalendář',
  perex:
    'Jak herci poslat nabídku termínů jedním oknem, jak si herec vybírá a jak se potvrzené frekvence upravují v kalendáři.',
  kategorie: 'Kalendář',
  poradi: 40,
  obsah: `Termíny se herci nenabízejí ručně. Portál spočítá, kolik frekvencí je potřeba, a nabídne mu **všechna volná místa** ve zvolených studiích až do poslední možné frekvence. Herec si z nich vybere přesně tolik, kolik je potřeba, a produkce výběr potvrdí.

# 1. Vytvoření nabídky (produkce)

V detailu projektu v sekci **Natáčecí frekvence** klikněte na **Vytvořit nabídku termínů**. Všechno je v jednom okně:

- **Herec** — předvyplní se herec projektu.
- **Studia** — zaškrtnutá studia, ze kterých se nabízí. Předvybere se studio a všechna ve stejném městě (v Brně tedy Brno I i Brno II rovnou).
- **Normostrany a Počet frekvencí** — počet se spočítá z normostran (40 NS na frekvenci), dá se přepsat.
- **První frekvence nejdříve** — nejdřív zítra, dnešek se nenabízí.
- **Poslední frekvence nejpozději** — sama se nastaví na **dva dny před datem dokončení projektu**, ať stihneme stříhat a odevzdat. Když projekt datum dokončení nemá, je tu měsíc dopředu a je potřeba ho upravit ručně.
- **Poznámka pro herce** — přijde mu v e-mailu i na stránce s výběrem.

Pod formulářem je **živý náhled**: kolik volných míst herec dostane a jejich přehled po dnech. Přepočítá se hned, jak změníte studia, období nebo herce.

Tlačítkem **Odeslat herci** se nabídka založí a rovnou odejde e-mailem. Když je volných míst méně, než herec potřebuje, tlačítko je zamčené a náhled poradí posunout období nebo přidat studio.

# 2. Co se do nabídky počítá

- Frekvence podle zkratek studia — **9:00–13:00** a **13:00–17:00** — v otevírací době studia, včetně víkendů.
- **Vynechá se** všechno, co je v kalendáři obsazené: potvrzené a držené termíny jiných nabídek, jakákoli událost ve studiu (natáčení, střih, svátek, údržba) a jiné natáčení téhož herce.
- **Jedno místo za město.** Když je stejný čas volný v obou brněnských studiích, herec ho uvidí jen jednou a patří **Brnu I**. Brno II dostane jen tehdy, když je Brno I v tu dobu obsazené.
- Nabídka se srovnává s kalendářem **pokaždé, když ji kdo otevře** — co se mezitím obsadí, zmizí; co se uvolní, přibude.

# 3. Výběr hercem

Herec dostane e-mail s odkazem (přihlašovat se nemusí; kdo účet má, najde totéž v **Moje termíny**).

- Vidí jen **dny a časy za město** — ne studio, ne víkendy zvlášť.
- Zaškrtne přesně tolik termínů, kolik je frekvencí. Dva termíny ve stejný čas vybrat nejde.
- U každého termínu má tlačítko **Vybrat vlastní čas** — posune nebo zkrátí ho (třeba 14–18, nebo jen tři hodiny). Portál ověří, že je v tu dobu ve studiu volno (v Brně zkusí obě studia), a vlastní čas nahradí původní termín. V nabídce je pak označený jako návrh herce.
- Nahoře má přilepenou lištu s velkým číslem, **kolik ještě zbývá vybrat**, a tlačítko **Odeslat ke schválení**, které se rozsvítí, až je vybráno všechno.

Po odeslání se vybrané termíny **drží** (délka držení je v Cenících). Produkci přijde oznámení.

# 4. Potvrzení (produkce)

Oznámení vede na stránku nabídky. Tam výběr:

- **potvrdíte** — termíny se zapíšou do kalendáře a herci přijde e-mail,
- **vrátíte** herci k novému výběru (se vzkazem proč),
- nebo **zamítnete**.

Když se držení nestihne potvrdit, termíny se samy vrátí do nabídky a herec může vybírat znovu.

# 5. Kalendář

- V kalendáři jsou jen termíny, které **platí** — držené (herec vybral) a potvrzené. Nabídnutá volná místa se tam neukazují, jinak by zaplnila celý týden.
- **Dvojklikem** na drženou nebo potvrzenou frekvenci ji upravíte: studio, datum, čas, **zvukař** a **poznámka**. Herce změnit nejde — ten patří k nabídce.
- Když frekvenci přepnete na **Střih**, frekvence se zruší a na jejím místě vznikne střih (vyberte zvukaře).
- Tlačítkem **Zrušit frekvenci** ji zrušíte úplně.
- Herec dostane v portálu **oznámení** o každém přesunu i zrušení.

# 6. Termíny v kalendáři herce

V potvrzovacím e-mailu, na stránce s termíny i v **Moje termíny** má herec tlačítka:

- **Přidat do kalendáře** — telefon nebo počítač nabídne přidat všechny potvrzené termíny najednou.
- **Odebírat (aktualizuje se samo)** — kalendář si termíny obnovuje sám, takže se v něm projeví i přesun nebo zrušení. Aktualizace může trvat i několik hodin — iPhone a Google si odebírané kalendáře stahují po svém.
- **Google Kalendář** — pro ty, kdo používají Google.

# Časté otázky

**Nabídka má 0 volných míst.** Zkontrolujte období — typicky je datum dokončení projektu moc blízko, takže poslední frekvence vyjde dřív než první. Posuňte datum dokončení nebo období ručně.

**Herec potřebuje natáčet jinde, než má v profilu.** V okně nabídky prostě zaškrtněte jiné studio — zaškrtnutá studia mají přednost před profilem herce.

**Chci termín herci jen posunout.** Dvojklikem na frekvenci v kalendáři. Herec dostane oznámení a v odebíraném kalendáři se mu změna projeví sama.`,
};
