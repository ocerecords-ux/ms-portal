/**
 * NÁPOVĚDA PRO KLIENTY (zadání 23. 9. 2026: „klienti by měli vidět nápovědu
 * ve svém přístupu na věci, ke kterým mají přístup").
 *
 * Do teď byly v Nápovědě jen naše interní návody a klient pod otazníkem
 * neměl nic - otazník se mu ani neukázal. Tenhle návod je jeho úvod do
 * portálu: co v něm najde a co si tam sám udělá.
 *
 * PÍŠE SE PRO KLIENTA, NE PRO NÁS. Žádné role, stavy z databáze ani názvy
 * obrazovek, které klient nikdy neuvidí - jen to, co má na očích.
 */
export const KLIENT_PORTAL = {
  slug: 'portal-pro-klienty',
  nazev: 'Portál krok za krokem',
  perex: 'Co v portálu najdete, kde si objednáte a kde si poslechnete hotové nahrávky.',
  kategorie: 'Začínáme',
  poradi: 1,
  proRole: ['CLIENT'],
  obsah: `Portál je jedno místo pro celou zakázku: objednávku, hotové nahrávky, připomínky i schválení. Přihlašujete se e-mailem, který jste dostali v pozvánce.

# Co máte v horní liště

- **Projekty** — vaše zakázky. U každé je stav, herec, termín dokončení a proklik na nahrávky.
- **Objednávka** — formulář na novou zakázku.
- **Nahrávky** — složka projektu: poslech rovnou v prohlížeči a stahování.
- **Můj účet** — kontaktní údaje, kam posílat faktury a co vám má portál hlásit.

Vpravo nahoře je **zvoneček** (co je nového u vašich projektů) a **otazník** s touhle nápovědou.

# Projekty

Vidíte zakázky, u kterých jste vedení jako kontaktní osoba. Když vám nějaká chybí, napište nám — přiřadíme vás k ní.

V tabulce je:

- **Stav** — kde zakázka právě je (natáčíme, dotočeno, ke schválení…).
- **Progres natáčení** — kolik už je nahrané.
- **K přeposlechu** a **Přeposlechnuto** — kolik stop je nachystaných a kolik jste jich už poslechli. Odsud se otevírá AudioTagger.
- **Schválení** — u reklamních zakázek tlačítko, kterým dáte vědět, že je hotovo.

# Nahrávky

Složka projektu tak, jak ji plníme my. Zvuk i video se přehraje rovnou v okně, jednotlivý soubor jde stáhnout, celá složka tlačítkem **Stáhnout vše** (portál z ní udělá ZIP). Jeden klik položku označí, dvojklik ji otevře nebo přehraje.

# Dotazy k projektům

Na pravém okraji obrazovky je poutko **Dotazy**. Vyberete projekt a napíšete — zpráva dorazí lidem, kteří na zakázce dělají, a odpověď uvidíte na stejném místě. Nemusíte hledat, komu zrovna psát.

# Můj účet

- **Kontaktní údaje** — jméno, telefon a e-mail, kterým se přihlašujete.
- **Fakturace** — e-mail, na který chodí nabídky a faktury (typicky účtárna). Kopii si můžete nechat posílat i na svou adresu.
- **Upozornění** — zaškrtnutím **Chci vědět, když dotočíme s hercem** vám přijde zpráva pokaždé, když ve studiu s hercem skončíme.

# Když něco nefunguje

Vedle zvonečku je **Připomínka k portálu**. Napište, co drhne — chodí to rovnou nám a v Můj účet vidíte, co jste poslali.`,
};
