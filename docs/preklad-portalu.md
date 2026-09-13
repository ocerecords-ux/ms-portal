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
| 1 | 14. 9. | Klientská cesta I — `(portal)/projekty` (seznam i detail očima klienta), `(portal)/nahravky`, `app/preposlech` | [ ] |
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

Čisté jsou dvě známé hlášky (`(string | string[])[]` v AdminSearch a
`MessageReaction` v reakcích) — cokoliv dalšího je nová chyba.
