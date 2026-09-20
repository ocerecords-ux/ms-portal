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

![Okno s výběrem: Celý kalendář, Jedno studio, Jen moje](/navody/odber-2.png)

2. **Co chcete vidět:**
   - **Celý kalendář** — všechna studia a Mimo studio (dovolené).
   - **Jedno studio** — jen natáčení a události vybraného studia.
   - **Jen moje** — natáčení, střihy a castingy, kde jste zvukař, a vaše Mimo studio.
3. Klikněte na **Připravit odkaz**.

# 3. Přidejte ho do svého kalendáře

![Tlačítka Apple a Google, QR kód pro iPhone, odkaz ke zkopírování a seznam mých odběrů](/navody/odber-3.png)

4. **Apple Kalendář** (iPhone, iPad, Mac) — klepněte na tlačítko, kalendář se otevře sám a vy jen potvrdíte **Odebírat**. **Google Kalendář** — otevře se Google, potvrdíte **Přidat**. Na telefonu s Androidem se pak kalendář objeví v aplikaci Google Kalendář sám (v jejím nastavení ho případně zapněte k synchronizaci).
5. **QR kód pro iPhone** — nejrychlejší cesta z počítače do telefonu: otevřete na iPhonu fotoaparát, namiřte na kód a klepněte na nabídku, která se objeví nahoře. Kalendář se zeptá, jestli ho chcete odebírat — potvrďte **Odebírat**. (Android kód přečte, ale Google Kalendář v telefonu odběr přidat neumí — použijte tlačítko Google Kalendář na počítači, do telefonu se pak dostane sám.)
6. **Outlook a ostatní** — klikněte na **Kopírovat** a v kalendáři zvolte *Přidat kalendář → Z internetu* (Outlook) nebo *Podle adresy URL*.
7. **Moje odběry** — co odebíráte a kdy si to váš kalendář naposledy stáhl. **Zneplatnit** odkaz vypne — hodí se, když telefon ztratíte nebo odkaz omylem pošlete dál.

Odběrů můžete mít víc najednou, třeba celý kalendář v Google a jen Brno I v telefonu.

# Co v kalendáři uvidíte

- **Potvrzená natáčení** — projekt, herec a studio v názvu; v popisu zvukař a poznámka.
- **Ručně zapsané události** — natáčení, střih, casting, svátek, údržba…
- **Mimo studio** — dovolené jako celodenní události (jen u celého kalendáře a u Jen moje).
- **Nabídky termínů** a termíny, které herec vybral, ale my je ještě nepotvrdili, tam **nejsou**.
- Kalendář nese 2 měsíce zpátky a rok dopředu.

# Časté otázky

**Změnil jsem termín v portálu a v telefonu ho nevidím.** Kalendáře si odběr stahují samy: Apple a Outlook zhruba každou hodinu, **Google podle sebe — i několik hodin**. Stačí počkat.

**Můžu událost upravit v telefonu?** Ne — kalendář je jen pro čtení. Upravujte v portálu, do telefonu se to propíše samo.

**Odkaz je bezpečný?** Je dlouhý a náhodný a vidí přes něj jen to, co vy v portálu. Když odejdete z týmu nebo se vám změní role, přestane vydávat data sám. Neposílejte ho mimo tým; v nejhorším ho **zneplatněte** a připravte si nový.`,
};
