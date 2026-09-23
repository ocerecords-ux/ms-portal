/**
 * NÁPOVĚDA PRO KLIENTY - PŘEPOSLECH, PŘIPOMÍNKY A SCHVÁLENÍ (zadání
 * 23. 9. 2026: „klienti by měli vidět nápovědu ve svém přístupu na věci,
 * ke kterým mají přístup").
 *
 * AudioTagger má klient ze dvou stran - z Projektů i z odkazu v mailu, a to
 * i bez přihlášení. Návod proto začíná tím, kde ho vůbec najde.
 *
 * SCHVÁLENÍ SE NEDÁ VZÍT ZPÁTKY, a tak je to v textu napsané rovnou - ne až
 * v poslední větě.
 */
export const KLIENT_PREPOSLECH = {
  slug: 'poslech-pripominky-schvaleni',
  nazev: 'Poslech, připomínky a schválení',
  perex: 'Jak si poslechnout hotové nahrávky, zapsat, co je potřeba upravit, a dát nám vědět, že je hotovo.',
  kategorie: 'Projekty',
  poradi: 20,
  proRole: ['CLIENT'],
  obsah: `Hotové nahrávky si poslechnete přímo v prohlížeči — nemusíte nic stahovat ani instalovat.

# Kde poslech začíná

- V **Projektech** ve sloupci **K přeposlechu** (kolik stop je nachystaných).
- Nebo **odkazem z e-mailu**, který vám pošleme. Ten funguje i bez přihlášení, takže se dá poslat dál kolegům.

# AudioTagger u audioknihy

Vlevo nahrávka, vpravo text. Ovládání:

- **mezerník** — přehrát a zastavit
- **šipky vlevo/vpravo** — o pět vteřin zpět nebo dopředu
- **E** — zapsat chybu v místě, kde zrovna jste

Když v nahrávce něco drhne, dejte **+ Přidat chybu**: portál si sám zapamatuje stopu, čas i stranu textu a vy dopíšete, co je špatně (přeřek, chybějící věta, jiné znění než v textu). Můžete taky myší označit slovo v textu a zapsat chybu rovnou k němu. **Své** záznamy jde kdykoliv upravit nebo smazat, cizí ne. Celý seznam si stáhnete tlačítkem **Stáhnout tabulku**.

Nahoře vidíte, kolik procent už máte přeposlechnutých. Až budete hotoví, dejte **Označit jako přeposlechnuté** — to je pro nás signál, že můžeme dál.

Při prvním otevření odkazu se portál zeptá na váš **e-mail**. Podepíšou se jím vaše poznámky a dáme vám vědět, až k přeposlechu přibudou nové stopy. Poslouchat může víc lidí najednou, každý se podepíše sám za sebe.

# Připomínky ke spotu

U reklamy je to jednodušší: pustíte si spot a v místě, kde něco drhne, dáte **Označit místo**. Napíšete, co upravit, a **Zapsat k času**. Připomínek zapíšete kolik chcete — k nám odejdou až tlačítkem **Odeslat připomínky**. Do té doby je máte jen u sebe a dají se mazat.

Kliknutím na čas u připomínky se spot přehraje přesně od toho místa.

# Schválení

Až je všechno v pořádku, dejte **Schválit**. Portál se pro jistotu zeptá podruhé — a pak už to zpátky vzít nejde: zakázka se u nás překlopí ke fakturaci a lidem, kterých se to týká, cinkne upozornění.

Když je ještě co upravit, neschvalujte — napište to do připomínek nebo do **Dotazů** u projektu.`,
};
