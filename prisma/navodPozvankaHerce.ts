/**
 * PRVNÍ NÁVOD V NÁPOVĚDĚ (zadání 16. 9. 2026: „ty manuály by mohly být někde
 * dostupné v portálu").
 *
 * Text tady je jen ZAČÁTEK. Jakmile ho někdo v portálu upraví, seed už do něj
 * nesahá - zakládá se jen tehdy, když návod s touhle adresou ještě není.
 * Obrázky jsou v public/navody/.
 */
export const POZVANKA_HERCE = {
  slug: 'pozvanka-herce',
  nazev: 'Pozvánka herce',
  perex: 'Jak pozvat nového herce do portálu a co po něm průvodce chce.',
  kategorie: 'Herci',
  poradi: 10,
  obsah: `Pošlete herci e-mail — zbytek si vyplní sám. Tohle je celá cesta od tlačítka až po chvíli, kdy je jeho karta v portálu hotová.

# Co uděláte vy: jedno pole, jedno tlačítko

V **Uživatelích** na záložce **Herci** je nahoře tlačítko **+ Nová pozvánka**. Zadáte e-mail a odešlete. Nic jiného se nevyplňuje — jméno ani číslo účtu za herce nikdo neopisuje, protože právě tam vznikají překlepy.

![Karta Nová pozvánka herci s polem na e-mail](/navody/pozvanka-herce-0.png)

- Herci přijde **pozvánka do portálu** — stejná, jakou dostávají klienti i tým.
- Po nastavení hesla se **rovnou přihlásí**, už nic neopisuje.
- Tlačítko mají **admin i produkce**.

# Co uvidí herec: průvodce o sedmi krocích

Vždycky jedna otázka na obrazovku — vyplňuje se to většinou z telefonu cestou ze studia. Dokud průvodce nedokončí, portál ho k ničemu jinému nepustí; když ho zavře, vrátí ho k němu při dalším přihlášení.

## 1. Vaše jméno a příjmení

Jediné povinné pole, do kterého nikdo za herce nepíše. Jak to napíše, tak to bude ve smlouvě.

![Krok 1: Vaše jméno a příjmení](/navody/pozvanka-herce-1.png)

## 2. Adresa trvalého bydliště

Ulice, město, PSČ a země. Země se vybírá ze seznamu s vlaječkami, předvyplněná je Česká republika.

![Krok 2: Adresa trvalého bydliště](/navody/pozvanka-herce-2.png)

## 3. Jste plátce DPH?

Ano nebo ne, nic víc. Licenční smlouvu posíláme tak jako tak — plátce nám ale pak fakturuje s DPH.

![Krok 3: Jste plátce DPH?](/navody/pozvanka-herce-3.png)

## 4. Rodné číslo, nebo IČ

Herec si nahoře vybere, co nám dá — pak vyplňuje jen jedno pole. Kdo v předchozím kroku řekl, že je plátce, doplní tady i DIČ.

![Krok 4: Rodné číslo, nebo IČ](/navody/pozvanka-herce-4.png)

## 5. Kam vám posílat honorář?

Číslo účtu i s kódem banky.

![Krok 5: Kam vám posílat honorář?](/navody/pozvanka-herce-5.png)

## 6. Kde můžete natáčet?

Jen města — Brno, Praha, Londýn. Když zaškrtne Brno, na jeho kartě se v portálu zaškrtnou obě brněnská studia. Jediný krok, který jde přeskočit.

![Krok 6: Kde můžete natáčet?](/navody/pozvanka-herce-6.png)

## 7. Rekapitulace

Všechno pohromadě, než to odešle. Zpátky na kterýkoli krok se dostane tlačítkem „Zpět".

![Krok 7: Rekapitulace](/navody/pozvanka-herce-7.png)

# Co se stane, když to odešle

- Údaje se **zapíšou rovnou na kartu herce** v Uživatelích — nic se nepřepisuje ručně.
- Komu to má zahlásit, se řídí zaškrtávátkem **„Dostává vyplněné údaje herců"** na kartě uživatele. Kdo to má zapnuté, dostane mail i zvoneček.
- Herec je od té chvíle v portálu jako každý jiný — vidí své termíny a údaje si může kdykoli změnit v **Mém účtu**.

# Na co se ptají nejčastěji

- **Co když herec nemá IČ?** Nechá přepínač na „Rodné číslo" — pole na IČ se mu vůbec neukáže.
- **Co když neví, kde bude natáčet?** Krok se dá přeskočit, města si doplní později v Mém účtu.
- **Přišla pozvánka na adresu, která už v portálu je?** Portál nezaloží druhý účet — pošle jen novou pozvánku. Pokud pod tou adresou není herec, odmítne to a napíše proč.
- **Jak dlouho odkaz platí?** Sedm dní. Potom se pošle nová pozvánka.`,
};
