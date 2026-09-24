# Překlad portálu do angličtiny — plán a pravidla

Zadání 13. 9. 2026: „přidej celkově na portálu přepnutí jazyka do britské
angličtiny" → „rozplánuj to, ať je to do týdne celé."

Hotovo do 20. 9. 2026. Každý večer jedna dávka: naplánovaná úloha si vezme
**první nezaškrtnutou dávku** z tabulky níž, přeloží ji, projde typovou
kontrolou, nasadí a dávku tady odškrtne.

---

## Pravidla

1. **Čeština je zdroj pravdy.** Slovník `src/lib/jazyk.ts` má u každého klíče
   `cs` i `en`. Co nemá anglický protějšek, projde česky — portál nikdy
   nespadne kvůli chybějícímu překladu a chybějící místo je vidět.
2. **Klíče se jmenují podle obrazovky**, ne podle textu: `faktura.odberatel`,
   `preposlech.zaznamChyby`. Sdílené věci mají `obecne.*`.
3. **Angličtina je britská.** organise / authorise / licence (podstatné
   jméno), datum `13/09/2026`, čas 24h, desetinná tečka, měna £ / € / Kč
   přes `Intl.NumberFormat('en-GB')`. Žádné „color", „center", „fall".
4. **Data uživatelů se nepřekládají** — názvy projektů, jména, poznámky,
   obsah chatu. Překládá se jen to, co je napsané v kódu.
5. **Texty od klienta viditelné navenek** (e-maily, PDF dokladů) se řídí
   jazykem dokladu / příjemce, ne přepínačem v liště.
6. Po každé dávce: typová kontrola → commit → push → ověřit nasazení.
7. **Věta je jeden klíč.** Nikdy se neskládá z kousků — v angličtině stojí
   slova jinak. Kde do věty vstupuje číslo nebo název, je ve větě značka
   `{nazev}` a dosadí ji `prelozitS(jazyk, klic, { nazev })`, v komponentě
   `t(klic, { nazev })`. Datum a čas se formátují přes `formatDatum` /
   `formatDatumCas` z `lib/jazyk.ts` — ty znají britský formát.
8. **Komponenta, která běží i na serveru i v prohlížeči** (typicky sdílená
   tabulka), si jazyk nebere hookem, ale dostane ho propem `jazyk` —
   `usePreklad()` by na serveru spadl.

## Slovníček (držet se ho, ať se termíny neliší obrazovku od obrazovky)

| česky | anglicky |
|---|---|
| přeposlech | proof-listening |
| záznam (chyby) v AudioTaggeru | tag |
| stopa | track |
| normostrana (NS) | standard page (SP) |
| herec (u audioknih) | narrator |
| herec (u reklam) | voice actor |
| zvukař | sound engineer |
| natáčecí frekvence | recording session |
| střih | editing |
| projekt | project |
| objednávka | order |
| nabídka | quote |
| faktura | invoice |
| výdaj | expense |
| doklad | document |
| dodavatel | supplier |
| odběratel | customer |
| výkaz | timesheet |
| ceník | price list |
| rodný list reklamy | advert record |
| úkoly | tasks |
| přenesená daňová povinnost | reverse charge |
| mimo předmět DPH v ČR | outside the scope of Czech VAT |
| Žůžo-labůžo (role) | Admin |

---

## Dávky

| # | Den | Co | Hotovo |
|---|---|---|---|
| 0 | 13. 9. | Mechanika: cookie, slovník, přepínač v liště i na přihlášení, názvy v liště | [x] |
| 1 | 14. 9. | Klientská cesta I — `(portal)/projekty` (seznam i detail očima klienta), `(portal)/nahravky`, `app/preposlech` | [x] |
| 2 | 15. 9. | Klientská cesta II — `objednavka`, `muj-ucet`, `moje-terminy`, veřejné stránky `nabidka`, `smlouva`, `terminy`, `nahravky`, chybové a načítací stránky | [ ] |
| 3 | 16. 9. | Společné komponenty — `(portal)/components` (chat, úkoly, rychlé volby, oznámení, doky) a `src/components` | [ ] |
| 4 | 17. 9. | Doklady — `(admin)/admin/doklady` (nabídky, faktury, výdaje, moje firmy) a číselníky v `src/lib` (stavy, měny, způsoby úhrady) | [ ] |
| 5 | 18. 9. | Zbytek administrace — uživatelé, ceníky, studia, archiv, firmy, `(portal)/kalendar`, `(portal)/vykazy` | [ ] |
| 6 | 19. 9. | E-maily a upozornění — `src/lib/email.ts` podle jazyka příjemce, push a oznámení | [ ] |
| 7 | 20. 9. | Kontrolní průchod — proklikat portál v EN, dohledat zapomenuté české texty, sjednotit termíny podle slovníčku | [ ] |

### Jak najít, co v dávce zbývá

```bash
# Cesky text primo v JSX nebo v retezcich dane slozky
grep -rn "[ěščřžýáíéúůňťďó]" src/app/\(portal\)/projekty --include=*.tsx \
  | grep -v "^\s*//" | grep -v "^\s*\*"
```

Komentáře v kódu zůstávají české — píšou se pro tým, ne pro klienta.

### Kontrola na konci každé dávky

```bash
python3 gen-prisma-stub.py && tsc -p tsconfig.check.json
```

`gen-prisma-stub.py` i `tsconfig.check.json` jsou od 22. 9. 2026 v repozitáři
(do té doby je měl každý večer jen u sebe a pokaždé se vyráběly znovu).
Skript přepíše `stubs/prisma-client.d.ts` podle `prisma/schema.prisma` —
bez něj hlásí kontrola chybějící tabulky u všeho, co přibylo po poslední
migraci. Náhrada za `node_modules` je ve `stubs/env.d.ts`. Složka `stubs/` je
v `.gitignore` (ambientní `declare module '@prisma/client'` by v buildu
přebil skutečného vygenerovaného klienta), takže si ji skript vyrobí sám,
když chybí — dopsané deklarace v ní ale nechá být. Když někdo začne používat
nový balíček nebo funkci Reactu, dopiš ji do `stubs/env.d.ts` a zároveň do
`ENV_D_TS` v `gen-prisma-stub.py`, ať to platí i po čerstvém klonu.

Čisté NENÍ nula — kontrola běží bez `node_modules`, takže na volnosti stubů
něco vždycky padne. Seznam hlášek, které tam byly už před dávkou, je
v `docs/preklad-kontrola-zname-hlasky.txt`; porovnávej proti němu:

```bash
tsc -p tsconfig.check.json 2>&1 | grep "error TS" \
  | sed 's/([0-9]*,[0-9]*)//' | sort | diff docs/preklad-kontrola-zname-hlasky.txt -
```

Prázdný výstup = dávka nepřinesla novou chybu. Když se nějaká známá hláška
opraví, uber ji ze seznamu ve stejném commitu.
