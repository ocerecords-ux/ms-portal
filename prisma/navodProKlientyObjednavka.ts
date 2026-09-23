/**
 * NÁPOVĚDA PRO KLIENTY - OBJEDNÁVKA (zadání 23. 9. 2026: „klienti by měli
 * vidět nápovědu ve svém přístupu na věci, ke kterým mají přístup").
 *
 * Popisuje formulář tak, jak ho klient vidí. Co se nabízí jen některým
 * firmám (cena od klienta, úvod a závěr audioknihy, reklamy), je v textu
 * napsané podmínkou - ne každý klient má obojí.
 */
export const KLIENT_OBJEDNAVKA = {
  slug: 'jak-objednat',
  nazev: 'Jak objednat',
  perex: 'Objednávka audioknihy i reklamy: co vyplnit, co umí příloha a co se děje potom.',
  kategorie: 'Objednávky',
  poradi: 10,
  proRole: ['CLIENT'],
  obsah: `Objednávka je jeden formulář. Povinný je jediný údaj — název. Všechno ostatní nám práci usnadní, ale když to nevíte, klidně to nechte prázdné a napište nám to později.

# Audiokniha nebo reklama

Když u vás děláme obojí, jsou nahoře dvě tlačítka — **Audiokniha** a **Reklama** — a formulář se podle toho přepne. Jestli u nás máte jen jedno, přepínač tam vůbec není.

# Co se vyplňuje u audioknihy

- **Název** — povinný. Pod tímhle názvem zakázku uvidíte v Projektech.
- **Počet normostran** — nemusíte počítat ručně, viz příloha níž.
- **Cena bez DPH** — spočítá se sama z normostran a vaší sazby. Pokud si cenu navrhujete sami, je políčko k vyplnění a částka je vždycky bez DPH.
- **Datum odevzdání** — dokdy nahrávku potřebujete.
- **Preferovaný herec** — vyberte jednoho nebo víc z databáze, nebo napište vlastní jméno. Bereme to jako přání, potvrdíme ho podle toho, kdo bude volný.
- **Poznámka** — cokoliv, co bychom měli vědět.

# Příloha spočítá normostrany za vás

Přetáhněte text do plochy s přílohou (nebo ho vyberte tlačítkem). Portál ho přečte **přímo u vás v prohlížeči** a napíše, kolik má normostran, znaků a slov. Pak stačí tlačítko **Doplnit do objednávky**.

Umí Word (.docx), PDF, RTF, ODT, EPUB a TXT. U PDF se navíc ukáže **náhled stránek**: obálku nebo tiráž jde vyřadit a ležatou stránku otočit — pošle se nám přeskládané PDF, které už odpovídá tomu, co se má načíst.

# Úvod a závěr audioknihy

Některým vydavatelům se úvod a závěr skládají samy z autora, překladatele a nakladatelství. Text vidíte v okně a můžete ho upravit nebo celý přepsat vlastním; tlačítkem **Vrátit automatický text** se vrátíte k původnímu. Režie je vždycky Ondřej Černý.

# Objednávka reklamy

Kratší formulář: **Název** (povinný), **Datum odevzdání**, **Poznámka** a **Příloha**. Normostrany ani cena tu nejsou — spot se počítá jinak.

# Co se stane po odeslání

1. Na obrazovce se objeví potvrzení a můžete rovnou objednat další.
2. Na váš e-mail přijde **potvrzení objednávky** se vším, co jste vyplnili.
3. U nás se zakázka založí a ozve se vám produkce.
4. V **Projektech** ji uvidíte hned — od té chvíle na ní sledujete stav.

Když se přílohu nepodaří uložit, objednávka se uloží i tak a portál vás na to upozorní — soubor nám pak pošlete e-mailem.

# Nabídka ke schválení

Na zakázku vám vystavíme nabídku a pošleme odkazem. Otevřete ji bez přihlašování, projdete položky a dole je **Schvaluji nabídku**. Teprve pak se rozjede výroba.`,
};
