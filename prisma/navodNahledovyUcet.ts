/**
 * NÁVOD: NÁHLEDOVÝ ÚČET (zadání 18. 9. 2026: „vytvoř mi ještě jeden profil
 * pro uživatele, který nemůže nic měnit, jen si může vyzkoušet celý portál
 * z různých rolí. Herec, Tým, Klient").
 *
 * Píše se pro nás - pro toho, kdo takový účet zakládá a půjčuje. Text je jen
 * začátek; jakmile ho někdo v portálu upraví, seed už do něj nesahá.
 */
export const NAHLEDOVY_UCET = {
  slug: 'nahledovy-ucet',
  nazev: 'Náhledový účet - portál na vyzkoušení',
  perex:
    'Účet, který si portál jen prohlíží. V liště se přepíná mezi pohledem týmu, klienta a herce a nic z něj nejde uložit.',
  kategorie: 'Portál',
  poradi: 30,
  obsah: `Když chcete někomu portál ukázat - novému člověku v týmu, klientovi před nasazením, sobě na telefonu - hodí se účet, kterým nejde nic rozbít. Náhledový účet vypadá a chová se jako opravdový uživatel, jen si k tomu přepíná, ČÍMA očima se dívá, a žádné jeho tlačítko nic nezapíše.

# Jak ho založit

1. **Administrace ▸ Uživatelé ▸ Nový uživatel.** Roli dejte **Klient** a vyberte **firmu** - podle ní se v pohledu Klient pozná, čí zakázky se mají ukazovat.
2. Účet uložte, otevřete jeho kartu a zaškrtněte **Náhledový účet (nic nemění)**.
3. Pošlete pozvánku jako komukoliv jinému; heslo si nastaví sám.

Role a firma na kartě tedy rozhodují jen o tom, co uvidí v pohledu Klient. Jak se portál tváří, si přepíná sám.

# Co ten člověk uvidí

Nahoře pod lištou má žlutý pruh **NÁHLED** a v něm tři tlačítka:

- **Tým** — projekty napříč všemi firmami, kalendář studií, pozvánky. Portál se chová, jako by byl z produkce.
- **Klient** — jen zakázky své firmy, objednávka, nahrávky, schvalování reklam.
- **Herec** — Moje termíny a nabídky natáčení.

Přepnutí je okamžité a vždycky skočí na **Projekty** — každá role vidí jiné stránky, takže by jinak zůstal stát na obrazovce, kam ho ta nová role nepustí. Volba mu vydrží i po odhlášení.

# Co nejde

**Nic, co se ukládá.** Založit projekt, změnit stav, napsat do chatu, poslat výkaz, nahrát fotku — u všeho se objeví věta „Tenhle účet je jen na prohlížení portálu - nic se z něj neuloží." Není to nastavené obrazovku po obrazovce; zámek je jeden a stojí před celým portálem, takže ho nejde nikde obejít.

**Do administrace se nedostane.** Doklady, banka a osobní údaje lidí nejsou nic na vyzkoušení, proto mezi pohledy žádné Žůžo-labůžo není. Tým je proto ukázaný jako **Produkce** — to je největší rozsah, který dává smysl někomu půjčit.

# Na co si dát pozor

- **Pohled Herec bude prázdný**, dokud ten účet někde jako herce neobsadíte. Chcete-li ukázat i termíny, přidejte ho jako herce na testovací projekt a pošlete mu nabídku termínů - uvidí ji pak stejně jako každý jiný herec.
- **Pohled Klient ukazuje SKUTEČNÉ zakázky té firmy**, kterou má na kartě. Když portál ukazujete někomu zvenčí, dejte mu firmu, u které vám to nevadí - ideálně testovací.
- **Účet nezhasne sám.** Až doprohlíží, na kartě mu zaškrtnutí seberte, nebo ho rovnou vyřaďte.
- **Když příznak sundáte**, stane se z něj během pár minut normální uživatel i bez odhlášení - role se ověřuje proti kartě každých pět minut.`,
};
