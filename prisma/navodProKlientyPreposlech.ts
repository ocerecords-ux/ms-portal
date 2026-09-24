/**
 * NÁPOVĚDA PRO KLIENTY - PŘEPOSLECH AUDIOKNIHY (zadání 23. 9. 2026: „klienti
 * by měli vidět nápovědu ve svém přístupu na věci, ke kterým mají přístup").
 *
 * ROZDĚLENO NA DVA DRUHY (24. 9. 2026: „je třeba rozlišit dva druhy. Pro
 * audioknihy a pro reklamy. Podle toho by se i návody měly objevovat
 * klientovi"). Tenhle je o AudioTaggeru u audioknihy a má proto
 * proDruhy: ['AUDIOBOOK']; reklamní spot řeší navodProKlientyReklama.ts.
 * Klient uvidí ten, který sedí na Druh zakázek jeho firmy.
 *
 * Adresa (slug) zůstává původní, aby se z toho v portálu nestal druhý návod
 * vedle starého.
 *
 * AudioTagger má klient ze dvou stran - z Projektů i z odkazu v mailu, a to
 * i bez přihlášení. Návod proto začíná tím, kde ho vůbec najde.
 *
 * SCHVÁLENÍ SE NEDÁ VZÍT ZPÁTKY, a tak je to v textu napsané rovnou - ne až
 * v poslední větě.
 *
 * OBRÁZKY jsou společné s interním návodem (public/navody/audiotagger-*.png,
 * replika scripts/navody/audiotagger.html).
 */
export const KLIENT_PREPOSLECH = {
  slug: 'poslech-pripominky-schvaleni',
  nazev: 'Poslech audioknihy a zápis chyb',
  perex: 'Jak si poslechnout hotové nahrávky, zapsat, co je potřeba opravit, a dát nám vědět, že je hotovo.',
  kategorie: 'Projekty',
  poradi: 20,
  proRole: ['CLIENT'],
  proDruhy: ['AUDIOBOOK'],
  obsah: `Hotové nahrávky si poslechnete přímo v prohlížeči — nemusíte nic stahovat ani instalovat.

# Kde poslech začíná

- V **Projektech** ve sloupci **K přeposlechu** (kolik stop je nachystaných).
- Nebo **odkazem z e-mailu**, který vám pošleme. Ten funguje i bez přihlášení, takže se dá poslat dál kolegům.

# Jak to vypadá

![Přeposlech audioknihy: hlavička s počty a tlačítky, text nahrávky v PDF, poutko Záznamy a přehrávač](/navody/audiotagger-1.png)

Nahoře je hlavička s počty a tlačítky, uprostřed **text nahrávky** (PDF), dole **přehrávač**. Na pravém okraji je poutko **Záznamy** — vytáhne seznam chyb, které už jsou zapsané.

Ovládání z klávesnice:

- **mezerník** — přehrát a zastavit
- **šipky vlevo/vpravo** — o pět vteřin zpět nebo dopředu
- **E** — zapsat chybu v místě, kde zrovna jste

# Když něco drhne

![Zápis chyby pod přehrávačem: předvyplněná stopa, čas a strana a pole na popis](/navody/audiotagger-2.png)

Dejte **+ Přidat chybu** (nebo klávesu **E**). Nahrávka se zastaví a portál si sám zapamatuje **stopu, čas i stranu textu** — vy dopíšete, co je špatně: přeřek, chybějící věta, jiné znění než v textu.

Nejrychlejší je ale **označit chybu rovnou myší v textu**: úsek se podbarví, jeho znění se předvyplní do popisu a čas se vezme z chvíle, kdy jste začali označovat.

**Své** záznamy jde kdykoliv upravit nebo smazat, cizí ne. Kliknutím na záznam se nahrávka přehraje od toho místa. Celý seznam si stáhnete tlačítkem **Stáhnout tabulku**.

# Kde jste skončili

Každá stopa zůstává **probarvená až tam, kam jste ji doposlouchali** — i když poslech přerušíte a vrátíte se k němu jindy. Tlačítko **🔖 Pauza** si navíc zapamatuje přesné místo a **Pokračovat odtud** vás tam vrátí.

Nahoře vidíte, kolik procent už máte za sebou. Až budete hotoví, dejte **Označit jako přeposlechnuté** — to je pro nás signál, že můžeme dál.

# Kdo poslouchá

![Okno Posluchači: komu chodí zprávy o nových stopách a pole pro přidání dalšího e-mailu](/navody/audiotagger-5.png)

Při prvním otevření odkazu se portál zeptá na váš **e-mail**. Podepíšou se jím vaše poznámky a dáme vám vědět, až k přeposlechu přibudou nové stopy. Poslouchat může víc lidí najednou, každý se podepíše sám za sebe — a přeposlech můžete tlačítkem **👤 Posluchači** předat dál třeba korektorovi.

# Poslech bez signálu

Tlačítko **⬇ Poslouchat offline** stáhne nahrávky i text do prohlížeče, takže jde poslouchat a psát poznámky i ve vlaku nebo v letadle. Co napíšete, odejde samo, jakmile je signál zpátky.

# Schválení

Až je všechno v pořádku, dejte **Schválit**. Portál se pro jistotu zeptá podruhé — a pak už to zpátky vzít nejde: zakázka se u nás překlopí ke fakturaci a lidem, kterých se to týká, cinkne upozornění.

Když je ještě co upravit, neschvalujte — zapište to jako chybu nebo napište do **Dotazů** u projektu.`,
};
