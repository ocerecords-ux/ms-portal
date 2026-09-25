/**
 * NÁVOD: MS KALENDÁŘ V TELEFONU (zadání 20. 9. 2026: „potřebuju, aby si můj
 * tým jednoduše přidal MS kalendář do svých kalendářů nativních. Např. Google
 * nebo Apple kalendář. Jen pro čtení").
 *
 * OBRÁZKY jsou v public/navody/odber-1..3.png, kreslí se z repliky
 * scripts/navody/odber.html (node scripts/navody/snimky.mjs odber). Čísla
 * v obrázcích odpovídají číslovanému seznamu. PŘI KAŽDÉ ZMĚNĚ okna
 * „Do mého kalendáře" nebo obsahu odběru (/api/ical) se musí upravit text
 * i obrázky tady.
 *
 * Návod nemá zaškrtnutou roli, takže ho vidí jen tým.
 */
export const ODBER_KALENDARE = {
  slug: 'ms-kalendar-v-telefonu',
  nazev: 'MS kalendář v Google nebo Apple kalendáři',
  perex:
    'Jak si přidat kalendář studií do svého telefonu nebo počítače - Google, Apple, Outlook. Jen pro čtení, obnovuje se sám.',
  kategorie: 'Kalendář',
  poradi: 45,
  obsah: `Kalendář studií si můžete přidat do **svého vlastního kalendáře** — Google, Apple (iPhone, Mac) nebo Outlook. Uvidíte ho tam vedle svých soukromých událostí a **obnovuje se sám**. Je jen pro čtení: měnit, přidávat a rušit se dá dál jen tady v portálu.

# 1. Otevřete okno

![Ikonka kalendáře s plusem vpravo v hlavičce Kalendáře](/navody/odber-1.png)

1. V **Kalendáři** klikněte vpravo nahoře, hned za přepínačem Týden / Měsíc, na **malou ikonku kalendáře s plusem**. Po najetí myší se ukáže popisek „Přidat MS kalendář do svého kalendáře".

# 2. Vyberte, co chcete vidět

![Okno s výběrem: Každé studio zvlášť, Celý kalendář, Jen moje](/navody/odber-2.png)

2. **Co chcete vidět:**
   - **Každé studio zvlášť** (doporučeno) — Brno I, Brno II, Praha, London, Mimo studio, Porady a Schůzky jako **samostatné kalendáře**, každý ve své barvě. V telefonu je pak zapínáte a vypínáte jednotlivě.
   - **Celý kalendář** — všechna studia a Mimo studio v jednom kalendáři.
   - **Jen moje** — natáčení, střihy a castingy, kde jste zvukař, a vaše Mimo studio.
3. Klikněte na **Připravit kalendáře** (u ostatních voleb **Připravit odkaz**).

# 3. Přidejte kalendáře do svého kalendáře

![Seznam kalendářů – každý s tlačítky Apple, Google, QR a Kopírovat odkaz](/navody/odber-3.png)

Každý kalendář má **vlastní řádek a vlastní tlačítka** — přidáváte je po jednom. Jeden odebíraný odkaz je v telefonu vždycky jeden kalendář; víc kalendářů najednou Apple ani Google přidat neumí. Které nechcete, prostě nepřidávejte.

4. **Apple** (iPhone, iPad, Mac) — klepněte, kalendář se otevře sám a vy jen potvrdíte **Odebírat**. **Google** — otevře se Google, potvrdíte **Přidat**. Pak to samé u dalšího řádku. Na Androidu se kalendáře objeví v aplikaci Google Kalendář samy (v jejím nastavení je případně zapněte k synchronizaci).
5. **QR** — nejrychlejší cesta z počítače do iPhonu: klikněte na **QR** u studia, na iPhonu otevřete fotoaparát, namiřte na kód a klepněte na nabídku nahoře, potvrďte **Odebírat**. Pak QR dalšího studia. (Google Kalendář v telefonu s Androidem odběr přidat neumí — použijte tlačítko Google na počítači.)
6. **Outlook a ostatní** — **Kopírovat odkaz** a v kalendáři zvolte *Přidat kalendář → Z internetu* (Outlook) nebo *Podle adresy URL*. U každého studia zvlášť.
7. **Moje odběry** — co odebíráte a kdy si to váš kalendář naposledy stáhl. **Zneplatnit** odkaz vypne — hodí se, když telefon ztratíte nebo odkaz omylem pošlete dál.

**Vypnutí jednoho kalendáře:** v Apple Kalendáři klepněte dole na **Kalendáře** a odškrtněte ho; v Google Kalendáři ho vlevo v seznamu odškrtněte. Kalendář zůstane přidaný, jen se nezobrazuje.

**Porady** jsou v telefonu vlastní žlutý kalendář a obsahují jen porady, na kterých jste. **Schůzky** mají svůj tyrkysový kalendář (vidí je Žůžo-labůžo a produkce, stejně jako v portálu). U obou je odkaz na videohovor v místě události — v Apple kalendáři na něj stačí klepnout.

**Co v událostech uvidíte.** Schválně jen to podstatné, ať se to na telefonu vejde: **projekt · herec · zvukař** (u střihu *Střih · projekt · zvukař*, u castingu *Casting · herec · zvukař*). Čas ukazuje kalendář sám, studio poznáte podle barvy kalendáře. Adresa se neposílá; poznámka jen tehdy, když nějaká je.

**Už odebíráte „Celý kalendář" a chcete zvlášť?** Přidejte kalendáře zvlášť a ten celý v telefonu smažte (nebo ho tady zneplatněte) — jinak uvidíte vše dvakrát.

Odběrů můžete mít víc najednou, třeba celý kalendář v Google a jen Brno I a Mimo studio v telefonu.

# Co v kalendáři uvidíte

- **Potvrzená natáčení** — projekt, herec a studio v názvu; v popisu zvukař a poznámka.
- **Ručně zapsané události** — natáčení, střih, casting, svátek, údržba…
- **Mimo studio** — dovolené jako celodenní události (vlastní kalendář Mimo studio, v celém kalendáři a u Jen moje).
- **Nabídky termínů** a termíny, které herec vybral, ale my je ještě nepotvrdili, tam **nejsou**.
- Kalendář nese 2 měsíce zpátky a rok dopředu.

# Časté otázky

**Jak často se to obnovuje a jde to zrychlit na 5 minut?** V odkazu posíláme interval **5 minut** — Outlook a většina klientů ho poslechnou. **Apple Kalendář se řídí vlastním nastavením** (ve výchozím stavu zhruba hodina), přepnout jde u každého odebíraného kalendáře zvlášť:

- **iPhone a iPad:** Nastavení → Aplikace → Kalendář → Účty → **Odebírané kalendáře** → vyberte kalendář → **Aktualizovat** → *Každých 5 minut*.
- **Mac:** v Kalendáři klikněte pravým tlačítkem na kalendář v seznamu vlevo → **Informace** (nebo Get Info) → **Aktualizovat** → *Každých 5 minut*. Nastavení se přenese i na iPhone, pokud kalendář odebíráte přes iCloud.

**Google Kalendář si interval určuje sám** — bývá to i půl dne a nastavit to nejde ani nám, ani vám. Kdo potřebuje vidět změny hned, ať kalendář odebírá v Apple nebo Outlooku, nebo se podívá do portálu.

**Změnil jsem termín v portálu a v telefonu ho nevidím.** Nejspíš se odběr ještě nestáhl — viz interval výš. Stačí počkat, nebo v Apple Kalendáři stáhnout seznam kalendářů dolů (obnovit ručně).

**Můžu událost upravit v telefonu?** Ne — kalendář je jen pro čtení. Upravujte v portálu, do telefonu se to propíše samo.

**Odkaz je bezpečný?** Je dlouhý a náhodný a vidí přes něj jen to, co vy v portálu. Když odejdete z týmu nebo se vám změní role, přestane vydávat data sám. Neposílejte ho mimo tým; v nejhorším ho **zneplatněte** a připravte si nový.`,
};
