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
| 2 | 15. 9. | Klientská cesta II — `objednavka`, `muj-ucet`, `moje-terminy`, veřejné stránky `nabidka`, `smlouva`, `terminy`, `nahravky`, chybové a načítací stránky | [x] |
| 3 | 16. 9. | Společné komponenty — `(portal)/components` (chat, úkoly, rychlé volby, oznámení, doky) a `src/components` | [x] |
| 4 | 17. 9. | Doklady — `(admin)/admin/doklady` (nabídky, faktury, výdaje, moje firmy) a číselníky v `src/lib` (stavy, měny, způsoby úhrady) | [x] |
| 5 | 18. 9. | Zbytek administrace — uživatelé, ceníky, studia, archiv, firmy, `(portal)/kalendar`, `(portal)/vykazy` | [x] |
| 6 | 19. 9. | E-maily a upozornění — `src/lib/email.ts` podle jazyka příjemce, push a oznámení | [~] |
| 7a | 28. 9. | Formáty a číselníky napříč repozitářem — `formatMoney` a `formatCzk` s jazykem, formátovače času a záložky v `lib/chat.ts`, statusy v chatu, smajlíci, náhledové pohledy, úkol bez příjemce | [x] |
| 7b | další večer | Zapomenuté obrazovky I — sekce na detailu projektu (rodný list, licenční list, výstupy, `ProjectMetaForm`, rozpočty, posluchači přeposlechu, `ProjectDocuments`), objednávka reklamy, `NovyProjektForm`, `InternalProjectsBrowser` | [x] |
| 7c | další večer | Zapomenuté obrazovky II — administrace: firmy a `CompanyForm`, caflou-firmy, údaje (žádosti), vzory zpráv i natáčení, wikipedie, technické parametry, návody, přenos projektu | [x] |
| 7d | další večer | Zapomenuté obrazovky III — Přehledy (knihy, kapacita, zvukaři, finance), palubovka, backlog, ceník studia, Web, tabule, správa studia, veřejné formuláře (`doplnit-udaje`, `udaje/[token]`, `pripominkovat`, `instalace`, nastavení hesla), nápověda, honoráře, pozvánky | [x] |
| 7e | další večer | Kódy místo textů a poslední průchod — stavy projektů a `jeVPriprave()`, města v `lokaceHercu`, `COUNTRIES`, zbylé číselníky v `src/lib` (role, dny, kalendář, druhy práce, tabule, porady, nepřítomnosti), sjednocení termínů podle slovníčku a proklikání portálu v EN | [x] |
| 7f | 4. 10. | Obrazovky, které nebyly v žádné dávce — Procesy, Složky na Disku, Bruno, Nastavení, Zprávy portálu, Doplnit dotočeno, zbylé karty na detailu projektu a režim pro nevidomé v přeposlechu | [x] |
| 7g | 9. 10. | Komponenty v `src/lib`, kam skript nikdy nemířil — popisky ikon typů projektu, značky nabídky a faktury u názvu projektu, doklady klienta, ruční značka nabídky u reklam, detail procesu | [x] |
| 7h | 10. 10. | Řetězce, na které se kontrolní skript nikdy nezeptal — hlavičky tabulek, `title`, `aria-label` a placeholdery: přehled reklam u klienta, přehled projektů (jazyk do buněk), lišta, tabule, část zakázky u faktur, upomínky, banka, složky na Disku u uživatele | [x] |
| 7i | 11. 10. | Obrazovky z téhož dne, které s překladem nepočítaly — nabídková prezentace pro klienta (veřejná stránka i sestavování u projektu), knihovna ukázek, vzor prezentace a natáčecí pult | [x] |
| 7j | 12. 10. | Číselníky a hlášky z `src/lib/*.ts`, které chodí na obrazovku natvrdo česky — názvy rychlých voleb, překážky mazání, hlášky počítání normostran z rukopisu, placeholdery úvodu a závěru knihy, číslo nové faktury, prázdné složky na Disku u uživatele | [x] |
| 7k | 13. 10. | Přístupy do sekcí a jednotlivá práva na kartě uživatele — `src/lib/pristupy.ts` (11 sekcí a 43 práv, názvy i popisy zaškrtávátek) | [x] |
| 7l | 14. 10. | Důvody a hlášky, které server posílá na obrazovku hotové česky — Tagy finální nahrávky, veřejné připomínkování spotu, konflikty v kalendáři a dvě zapomenuté záložní hlášky | [x] |
| 7m | 15. 10. | Co nejde přes slovník: datum a čas natvrdo `cs-CZ` (natáčecí plán klienta, hosté natáčení, Tagy, kurz ČNB u faktury i výdaje) a řetězce v bublinách, `aria-label` a záložních hláškách (hlavička přehledu projektů, zkušební pult, přihlašovací jméno bez e-mailu) | [x] |
| 7n | 17. 10. | Formáty, na které se nikdo nezeptal: datum skládané ručně z `getDate()` (karta Hudba, knihovna hudby, veřejná stránka hudby, odznak frekvencí, rozsah týdne u splatností) a desetinná čárka natvrdo u velikostí souborů (hudba, přílohy chatu i dotazů, příběhy) + šest odkazů v liště, které slovník odkazů neznal | [x] |
| 7o | 18. 10. | **Routy v `api/**` — rozhodnuto**: hlášky z rout chodí s KLÍČEM vedle české věty a obrazovka si je přeloží (`lib/chybyApi.ts` + `lib/chybaZOdpovedi.ts`). Udělaná celá hudba (19 rout) a k tomu číselníky Novinek (publika, druhy, názvy měsíců) | [x] |
| 7p | 19. 10. | Přeposlech a náhledová okna — hlášky devíti rout přeposlechu klíčem (vzor z 7o) a tři routy náhledu pod ikonou (přeposlech, doklad, klientský doklad), které posílají hotový text a jazyk si proto berou z cookie | [x] |
| 7q | 19. 10. | Hlášky rout Sítí a Příběhů — `api/site/**` klíčem (vzor 7o/7p): příběhy, příspěvky, obrázky a popisek od Bruna. Nově `odpovedChybyS` pro větu se značkou | [x] |
| 7r | 21.–22. 10. (nasazeno 29. 10.) | Hlášky rout chatu a PDF dokladu klienta klíčem (15 rout v `api/chat/**` + `api/klient/doklady/pdf`); nově `odpovedChybyVJazyce` pro routy, na které se chodí odkazem v novém okně | [x] |

`[~]` = hotová jen část, a schválně — viz „Dávka 6 je HOTOVÁ Z POLOVINY" níž.

**Dávka 7 se 28. 9. 2026 rozpadla na 7a–7e.** Byla napsaná jako „kontrolní
průchod", ale kontrola ukázala, že to není dojíždění posledních drobností:
v portálu je ještě asi **1 900 řádků českého textu ve stovce souborů, které
neobsahují jediné volání překladu** — celé sekce, které v původním plánu
nikdy nebyly (Přehledy, palubovka, backlog, ceník studia, Web, wikipedie,
tabule, veřejné formuláře). Datum „hotovo do 20. 9." tedy neplatí a jedna
kontrolní dávka to nedožene; proto jsou z ní čtyři dávky obrazovek a jedna
závěrečná. Soupis je v „Co našla dávka 7a" níž.

### Co dávka 3 nechala dalším dávkám

Komponenty už překládají všechno své, ale některé texty do nich přitékají
z `src/lib` a z administrace. Až se na ně dostane řada, je to tohle:

- `src/lib/chat.ts` — `CHAT_TABS` / `CHAT_ZALOZKY` (`label`) a formátovače
  `formatDayLabel` / `formatClock` / `formatFullTime` / `formatMessageTime`
  mají `'cs-CZ'` natvrdo.
- `src/lib/msSmajlici.ts` — `label` u smajlíků jde do `title` v nabídce.
- `src/lib/statusyChatu.ts` — `popisStatusu()`, hotové statusy, `DOKDY_NABIDKA`.
- `src/lib/nahledRole.ts` — `NAHLED_POHLEDY[].popisek` a `.vysvetleni`.
- `src/lib/ukolyZChatu.ts` — `CHYBI_PRIJEMCE`.
- `src/lib/quickActions.ts` — `label` rychlých voleb.
- `src/lib/progresNataceni.ts` — `popis` („Dotočeno", „str. 3 z 12") a `stranText`.
- `src/lib/projectTypes.ts` — `PRIORITY_LABELS` už `IkonaPriority` nepoužívá,
  priority jsou ve slovníku jako `priorita.nizka/stredni/vysoka`.
- ~~`(admin)/admin/layout.tsx` nemá `JazykProvider`~~ — **vyřešeno v dávce 4**
  (27. 9. 2026). Administrace provider má, takže `ChatDock` i sdílené
  komponenty v ní mluví jazykem z lišty.

### Co dávka 4 nechala dalším dávkám

Doklady jsou přeložené celé (726 klíčů), ale při práci vylezlo tohle:

- **`formatMoney(minor, currency, jazyk?)` nikdo nevolá s jazykem.** Funkce
  parametr má už od dávky 0, jenže všech ~200 volání ho vynechává, takže
  v anglickém portálu jsou částky pořád v českém formátu (`1 234,50` místo
  `1,234.50`). Je to jeden sjednocující průchod napříč repozitářem — patří do
  dávky 7, ne doprostřed dávky na jednu složku.
- **`/api/admin/upominky`** posílá `splatnost` a `castka` už naformátované
  jako řetězec, takže je komponenta nemá jak přeložit. Formátování patří
  o patro níž, do té routy.
- **`PROMENNE_UPOMINKY`** v `src/lib/upominkyFaktur.ts` (`popis`, `ukazka`)
  jde do `title` tlačítek se zástupnými značkami a je česky. Věta kolem už
  přeložená je.
- **`CONTRACT_STATUS_LABELS` a `CONTRACT_PLACEHOLDERS[].label`** v
  `src/lib/contracts.ts` zůstávají české schválně - bere si je PDF a e-maily,
  kde jazyk určuje dokument, ne přepínač. Rozhraní je nepoužívá. NEMAZAT.
- **„Herec" u smluv na reklamu.** Držíme se slovníku (`Narrator`), i když
  slovníček pro reklamy říká *voice actor*. Formulář smlouvu na audioknihu od
  reklamy nerozlišuje - rozhodnout v dávce 7.
- **Ztráta tučného zvýraznění** ve dvou větách (částky v přehledu „Z nabídky
  je vyfakturováno…", kurz ČNB). Důsledek pravidla 7 - věta je jeden klíč.
  Kdyby to vadilo, chce to rozseknout na víc vět.
- **Duplicita v češtině:** `FakturaKeSmlouve` u nulové sazby píše
  `({castka} bez DPH · bez DPH)`. Nechali jsme doslova, čeština je zdroj
  pravdy - ale je to nejspíš překlep.

**Opraveno mimochodem:** výpočet ceny projektu v
`(portal)/projekty/[id]/page.tsx` filtroval stornované faktury porovnáním
s českým slovem `'Stornovaná'`. Po přeložení popisku by filtr přestal platit a
stornované faktury by se počítaly do ceny projektu. Teď se porovnává kód
(`i.status !== 'CANCELLED'`).

### Co dávka 5 nechala dalším dávkám

Administrace, kalendář a výkazy jsou přeložené (761 klíčů, celkem 2533).
Co z toho vypadlo a kam to patří:

**Nejdřív to nebezpečné — porovnávání textu místo kódu.** Tenhle vzor je
v portálu na víc místech a pokaždé je to tikající bomba: jakmile se popisek
přeloží, podmínka tiše přestane platit.

- `jeVPriprave()` v `src/lib/stavyProjektu.ts` porovnává uložený stav projektu
  s českým textem `'V přípravě'`. **Drží to jen proto, že se stavy projektů
  ukládají do databáze česky a nikdo je nepřeložil.** Kdyby je někdo přeložil,
  zvukaři začnou ve Výkazech vidět projekty v přípravě, které vidět nemají
  (zadání 15. 9. 2026). Správně: stav má mít kód, ne název. **Do dávky 7, a je
  to důvod, proč `STAVY_PROJEKTU` zatím NEPŘEKLÁDAT.**
- `sjednotLokaci()` v `src/lib/lokaceHercu.ts` ukládá do `user.studioLocations`
  česká jména měst (`'Brno'`, `'Londýn'`) a `mestaZeStudii()` je pak porovnává
  jako text. Přeložit odznak lokace bez přidání kódu města = rozbité párování
  herec ↔ studio.
- Značka `ZVUKAŘ:` v nadpisu události drží kalendář pohromadě
  (`kalendar/page.tsx`, `CalendarBrowser.tsx`, `bezPredponyZvukar()`
  v `lib/calendar.ts`). Schválně zůstává česky - patří na vlastní pole, ne do
  textu nadpisu.
- `'Z Google kalendáře:'` v `CalendarBrowser.tsx` a `POZNAMKA_VIKEND`
  v `lib/volnaMista.ts` - totéž, jen méně akutní.

**Formátování částek a dat na jedno místo (dávka 7).** Kromě `formatMoney`
z dávky 4 přibylo: `formatCzk` v `src/lib/timesheets.ts` (natvrdo `'cs-CZ'`
a `' Kč'`, jdou přes ni všechny částky ve Výkazech a Bonusech), `formatujCas`
v `src/lib/projektLog.ts` a `rozsahSlovy()` v `src/lib/nepritomnost.ts`.

**Číselníky v `src/lib`, které ještě mluví jen česky.** Obrazovky dávky 5 si je
obcházejí překladem podle kódu, ale zbylí volající je berou dál:
`ROLE_LABELS` a `COMPANY_TYPE_LABELS` (`lib/roles.ts` - používá `admin/navody`
a `admin/companies`), `WEEKDAY_LABELS`/`WEEKDAY_SHORT`, `BLOCK_KIND_LABELS`,
`SLOT_STATE_LABELS`, `RECORDING_STATUS_LABELS` (`lib/calendar.ts`),
`WORK_TYPE_LABELS` (`lib/timesheets.ts` - zbývá `projekty/[id]/VykazyProjektu.tsx`),
`POLOZKY_TABULE` (`lib/tabule.ts`), `MOZNOSTI_OPAKOVANI` a `slovoProDruh`
(`lib/porady.ts`), `DRUHY_NEPRITOMNOSTI` (`lib/nepritomnost.ts`).
Vzor, jak na to, je `nazevMeny()` a `nazevStavuNabidky()` z dávky 4: jazyk jako
NEPOVINNÝ parametr, česká varianta zůstává pro PDF a e-maily.

**Texty, které tečou z API už naformátované** a komponenta je nemá jak
přeložit: `/api/kalendar/konflikty`, `/api/kalendar/historie`,
`/api/kalendar/hledani`, `/api/admin/studia*`, `/api/admin/upominky`.
Formátování patří do těch rout. **Do dávky 6, spolu s e-maily.**

**Názvy zemí** (`COUNTRIES` v `src/lib/countries.ts`, ~100 českých názvů) jsou
vlastní úkol, ne vedlejší efekt dávky: s dvojjazyčným seznamem se musí přepsat
i řazení a hledání bez diakritiky, které dnes počítá s češtinou.

**Drobnosti k rozhodnutí:**
- `prelozitKolem` umí jen JEDNU značku. Věty se dvěma tučnými kusy se obcházejí
  ručně (`UdajeTabule` ve studiích, `vetaSeZnackami` v `CalendarBrowser`).
  Do `lib/jazyk.ts` by se hodila obecná varianta.
- `formatDatumCas` přidává rok, což na tabuli studia dřív nebylo - hodila by se
  varianta `formatDatumCasKratce`.
- České nepřesnosti, které jsme NEOPRAVILI (čeština je zdroj pravdy):
  `FakturaKeSmlouve` píše `({castka} bez DPH · bez DPH)`; tlačítko „Založit
  poradu" svítí i na formuláři schůzky; bublina detailu píše „Porada" i u
  schůzky. **Opravené bylo jen** „Zrušit porada" → „Zrušit poradu".
- `POPISKY_DRUHU_ARCHIVU` a `POPISKY_ZPUSOBU` v `src/lib/archiv.ts` jsou po
  dávce 5 nepoužité. Nemazali jsme je.

### Co našla a udělala dávka 7a (28. 9. 2026)

Dávka 7a je průchod NAPŘÍČ repozitářem, ne po obrazovkách: sjednotila
formátování a dotáhla číselníky, na které si dávky 3 a 4 napsaly lístek.

**Formátování částek (dluh z dávky 4).** `formatMoney` má jazyk od dávky 0,
ale nikdo mu ho nepředával. Doplněn na 46 místech (celkem ho tedy předává
53 volání v 15 souborech), takže
v anglickém portálu stojí částky britsky (`1,234.50 Kč`). `formatCzk`
v `lib/timesheets.ts` dostal stejný nepovinný parametr a předává se ve
Výkazech a Bonusech.

Schválně BEZ jazyka zůstávají tři volající - a je to důvod, ne opomenutí:
- `api/nahled/doklad/route.ts` - náhled dokladu se řídí jazykem DOKLADU
  (pravidlo 5), ne přepínačem v liště.
- `lib/upominkyServer.ts` a `lib/mesicniPrehledServer.ts` - pošta, jazyk
  příjemce; čeká na zapojení dávky 6.
- `lib/bankaServer.ts` a `lib/bonusyServer.ts` - text jde do `notify()`, tedy
  do databáze jako hotová věta. Viz „OZNÁMENÍ POD ZVONKEM" v dávce 6.

**Číselníky a formátovače, které přitékaly z `src/lib`** (lístek z dávky 3):
- `lib/chat.ts` - `formatDayLabel`, `formatClock`, `formatFullTime`
  a `formatMessageTime` mají nepovinný jazyk a „Dnes / Včera / dnes 14:32"
  jdou ze slovníku. Nová `nazevZalozky(klic, jazyk)` - záložky chatu se
  překládají podle KÓDU záložky, ne podle českého názvu.
- `lib/statusyChatu.ts` - `popisStatusu(status, jazyk)` přeloží jen rámeček
  „… do 14:30"; sám text statusu ne, ten je v databázi (pravidlo 4). Nová
  `popisekDokdy()` pro nabídku „do kdy".
- `lib/msSmajlici.ts` - `popisekSmajlika()`, 18 klíčů; kód `:ms-usmev:`
  zůstává, je uložený ve zprávách.
- `lib/nahledRole.ts` - `popisekPohledu()` a `vysvetleniPohledu()`.
- `lib/ukolyZChatu.ts` - `chybiPrijemce(jazyk)`. Konstanta `CHYBI_PRIJEMCE`
  zůstává česky: vrací ji API jako hotový text v odpovědi.

Celkem 39 nových klíčů ve slovníku a 9 volání `formatCzk` s jazykem.

**HOTOVE_STATUSY zůstávají česky schválně.** „Na obědě", „Ve studiu" se po
klepnutí UKLÁDAJÍ jako text statusu a vidí je všichni ostatní. Přeložit
tlačítko znamená uložit anglickou větu českému kolegovi. Patří to do stejné
škatulky jako `notify()`: status má mít kód, ne text.

**A teď to hlavní, co kontrola ukázala.** Dávka 7 měla být „dohledat
zapomenuté české texty". Jenže zapomenuté nejsou jednotlivé texty, ale celé
obrazovky: **asi 1 900 řádků českého textu ve stovce souborů, které nemají
jediné volání překladu.** Hrubý soupis (řádky / soubory):

| kde | řádků | souborů |
|---|---|---|
| `(portal)/projekty` - sekce detailu projektu | 621 | 30 |
| `(admin)/admin` - firmy, údaje, vzory, wikipedie, parametry, návody | 556 | 33 |
| `(portal)/prehledy` - knihy, kapacita, zvukaři, finance | 281 | 14 |
| `(portal)/site` (Web) | 61 | 2 |
| `preposlech` a `pripominkovat` (VideoTagger, režim pro nevidomé) | 94 | 4 |
| `(portal)/objednavka` - reklama | 40 | 1 |
| `doplnit-udaje`, `udaje/[token]` | 63 | 3 |
| `(portal)/palubovka`, `backlog`, `cenik-studia` | 101 | 5 |
| `tabule`, `(studio)`, `instalace`, `(auth)` | 88 | 6 |
| `napoveda`, `honorare`, `pozvanky` | 32 | 4 |

Proč to dávky 1-5 minuly: **v původním rozpisu ty sekce vůbec nejsou.**
Plán psal „155 obrazovek" a pak vyjmenoval projekty, nahrávky, přeposlech,
objednávku, můj účet, doklady, administraci, kalendář a výkazy. Přehledy,
palubovka, backlog, ceník studia, Web, wikipedie, tabule ani veřejné
formuláře v žádné dávce nebyly, takže je nikdo nepřeložil a kontrola na ně
narazila teprve teď. Sekce na detailu projektu (rodný a licenční list,
výstupy, `ProjectMetaForm`, `ProjectDocuments`) vypadly z dávky 1 proto, že
ta mířila na „detail projektu očima klienta" - tyhle panely vidí produkce.

Rozděleno na dávky 7b-7e v tabulce výš. Jak najít, co v dané oblasti chybí:

```bash
# soubory bez jediného volani prekladu, ale s ceskym textem
for f in $(find src/app -name '*.tsx'); do
  grep -q "usePreklad\|prelozit\|nactiJazyk" "$f" && continue
  n=$(grep "[ěščřžýáíéúůňťďó]" "$f" | grep -vE "^\s*(//|\*)" | wc -l)
  [ "${n:-0}" -ge 3 ] && echo "$n $f"
done | sort -rn
```

**`stubs/prisma-client.d.ts` je v gitu, i když `stubs/` je v `.gitignore`.**
Ignorování se na už sledovaný soubor nevztahuje, takže ho každé přegenerování
ukazuje jako změnu a plete se do `git status`. Nebezpečné to není - hlavní
`tsconfig.json` má `stubs` v `exclude`, takže do buildu na Vercelu nemluví -
ale patří to z gitu vyndat (`git rm --cached stubs/prisma-client.d.ts`).
Dávky ho do commitu nepřidávají.

**Pozor na počítač (28. 9. 2026).** Večerní dávka narazila na to, že se
některé soubory v repozitáři nedaly přes sdílenou složku přečíst ani zapsat
(chyba „Resource deadlock avoided", mizí a vrací se). Padlo na tom
`stubs/env.d.ts`, bez kterého typová kontrola vyhlásí 2 300 vymyšlených chyb
o chybějícím Reactu. Kdyby se to opakovalo: zkontrolovat, že se `stubs/env.d.ts`
dá přečíst, a teprve pak věřit výstupu `tsc`.

### Dávka 7b je HOTOVÁ (30. 9. 2026)

Dokončená a nasazená o večer později, než měla být: 29. 9. 2026 byla přeložená,
ale git v repozitáři přestal číst objekty a commit by nad rozbitým object store
mohl zapsat prázdné bloby. 30. 9. už `git status`, `git diff` i `git show`
fungovaly, takže dávka odešla celá jedním commitem.

**Co dávka 7b nakonec obsahuje:** slovník +439 klíčů (2 629 → 3 068) a k tomu:

- rozpočet — `ProjectBudget`, `ProjectBudgetZakazka`, `NakladyProjektu`
  (místní `czk()` bere jazyk, takže částky stojí britsky),
- `ProjectDocuments` (jazyk propem, `formatMoney` s jazykem),
- `projekty/[id]/page.tsx` — názvy záložek a texty, které **dávka 1 zapsala
  do slovníku, ale nikdy nezapojila**: `projekt.zalozka.*`,
  `projekt.schvaleno`, `projekt.zpetNaProjekty` a spol. nebyly v kódu použité
  ani jednou,
- posluchači přeposlechu, `NovyProjektForm`, `InternalProjectsBrowser`,
  `VyberVOkne`,
- objednávka reklamy (`AdOrderForm`) — klíče z dávky 2 taky nebyly zapojené
  a krok „Co pro vás máme vyrobit?" se 26. 9. změnil; česká strana slovníku
  je teď sjednocená s kódem,
- rodný list — `RodnyListSection` a `lib/rodnyList.ts`:
  `missingRodnyListFields()` i `rodnyListVersionLabel()` berou jazyk jako
  NEPOVINNÝ parametr, server tedy dál mluví česky (hláška jde do
  `ProjectMeta.rlError`, což je databáze),
- výstupy — `VystupySection` a `popisVystupuObjednavky()` v `lib/vystupy.ts`
  s nepovinným jazykem (mail týmu z `api/orders` dál česky),
- licenční listy — `LicencniListSection`,
- **`ProjectMetaForm.tsx`** (Interní údaje na detailu projektu) — poslední
  soubor dávky, doplněný 30. 9.: obě podoby karet (ke čtení i k úpravám),
  odpočet do překlopení stavu, mazání projektu a „Poslat zprávu ke stavu
  znovu". Datum bez času si formátuje `datumTextem(iso, jazyk)` samo —
  drží se jako „RRRR-MM-DD", takže se nesmí hnát přes `Date` a časové pásmo;
  anglicky stojí `17/09/2026`.

**S ním i to, co je na téže obrazovce vidět** (jinak by formulář mluvil
anglicky a okno v něm česky):

- `VyberHercu.tsx` — okno s akcemi u herce (dotočeno, zpráva klientovi,
  normostrany, pořadí, odebrání) a hledání herce. Používá ho i
  `NovyProjektForm`, takže se přeložilo i jeho okno.
- `lib/dotoceni.ts` — `coSeStane(nahled, jazyk?)` a `vyjmenuj(jmena, jazyk?)`
  s NEPOVINNÝM jazykem. Věty výčtu „co se stane" jsou ve slovníku, ale názvy
  stavů projektu v nich zůstávají české: jsou to data z databáze (pravidlo 4).
  Testy v `tests/dotoceni.test.ts` kontrolují českou stranu a platí dál.
- `OdznakStrany.tsx` — jazyk PROPEM, ne hookem: odznak se kreslí i ze
  serverových komponent (pravidlo 8). Bez propu mluví česky, takže
  `HerciBunka` a `VyberHerce` v přehledu projektů se nezměnily.
- `OdznakSelect.tsx` — popisek „— nevybráno —" si komponenta bere ze slovníku
  sama, aby ho nemusel posílat každý volající.
- `UkonceniProjektu.tsx` — karta „Ukončit projekt" pod formulářem.

**Česky zůstávají schválně** hodnoty, které jdou do PDF licenčního listu (typ
licence, typ díla, délka licence, média — pravidlo 5), výchozí názvy výstupů
ukládané do databáze (`Hlavní spot`, `Spot 2`, `Výstup`), `STAVY_PROJEKTU`
včetně jejich popisů z `popisStavu()` — a navíc:

- **ukázky v polích „Úvod audioknihy" a „Závěr audioknihy"** („Audiotéka uvádí
  audioknihu …"). Je to text, který se opravdu načte do knihy, a ten je český;
  anglická ukázka by radila napsat do audioknihy něco, co tam nemá být.
- **`Čekáme na opravy`** ve větě o automatickém překlopení. Věta je přeložená,
  název stavu v ní ne — drží se v konstantě `STAV_CEKAME_NA_OPRAVY`, ať se po
  kódu nepíše podruhé. Až dostanou stavy kódy (dávka 7e), dosadí se sem.
- **bublinka „Dotočeno {datum}" u jména herce v přehledu projektů**
  (`BublinaHerce` ve `VyberHerce.tsx`, natvrdo `'cs-CZ'`). Je to obrazovka
  dávky 1, ne 7b; `VyberHercu` si tentýž text nad oknem už překládá.

**Opravená tikající bomba.** `projekty/[id]/page.tsx` počítal fakturované
částky přes `r.statusLabel === 'Stornovaná'`. Popisek stavu je od dávky 4
přeložený, takže v anglickém portálu se stornované faktury počítaly do
fakturovaného. Teď se porovnává kód (`kodStavu === 'CANCELLED'`) — stejná
oprava jako u ceny projektu v dávce 4.

**Věta se třemi tvary čísla.** Odpočet „Za 3 dny se sám překlopí…" má
v češtině tři tvary a v angličtině dva, takže každý tvar je vlastní klíč
a vybírá je `klicOdpoctu(pocet)`. Skládat věty z kousků by pravidlo 7
nedovolilo a v angličtině by stály slova jinak.

**Ke smazání, až na to někdo narazí:** ve `.git` zůstaly po padajících
večerech přejmenované prázdné zámky (`index.lock.*`, `HEAD.lock.*`, přes
třicet souborů, mezi nimi `index.lock.zaseklo-se-7b` z 29. 9.). Gitu
nevadí — jsou to jiná jména než `index.lock` — ale sdílená složka je mazat
nesmí, takže je potřeba je smazat z počítače. Stejně tak `git rm --cached
stubs/prisma-client.d.ts` (viz dávka 7a).

### Dávka 7c je HOTOVÁ (1. 10. 2026)

Administrace: firmy a jejich panely, firmy z Caflou, žádosti o údaje, vzory
zpráv i natáčecích textů, wikipedie, technické parametry, návody a přenos
projektů. **28 obrazovek, slovník +571 klíčů (3 068 → 3 639)** a sedm souborů
v `src/lib`.

**Číselníky dostaly funkci s NEPOVINNÝM jazykem** (vzor `nazevMeny` z dávky 4,
překládá se podle KÓDU, ne podle českého názvu; bez jazyka vrací češtinu, ať
PDF a pošta mluví dál česky):

- `lib/roles.ts` — `nazevRole()` a `nazevTypuFirmy()`. Tím je splacený lístek
  z dávky 5: `ROLE_LABELS` bral `admin/navody` i `admin/companies`.
- `lib/notifikaceFirmy.ts` — `nazevKomu()` (Neposílat / Klientovi / Jen nám
  interně).
- `lib/caflouCompanies.ts` — `nazevDruhuKontaktu()`.
- `lib/technickeParametry.ts` — `nazevDruhuParametru()`.
- `lib/navody.ts` — `nazevDruhuZakazky()`.
- `lib/pozvankaUdaju.ts` — `popisekPole()` a `rozdilyPozvanky(zadost, jazyk?)`.
  Popisky polí formuláře údajů se tedy překládají podle klíče pole; `name` se
  u herce a u firmy liší, proto to bere i druh žádosti.

`lib/vzoryZprav.ts`, `lib/formatovaniZpravy.ts` a `lib/nataceniText.ts`
funkci NEDOSTALY schválně — mají v hlavičce napsané, že stojí bez závislostí,
aby si je mohl vzít i prohlížeč. Jejich `popis` a `nazev` se proto překládají
v komponentě podle klíče (`t('promenna.projekt')`, `t('barva.fialova')`,
`t('velikost.18')`, `t('promennaNat.delka')`).

**Nová `prelozitNaKusy()` v `lib/jazyk.ts`** — obecná varianta
`prelozitKolem`, kterou si dávka 5 napsala na lístek („`prelozitKolem` umí jen
JEDNU značku"). Věta zůstává jedním klíčem (pravidlo 7) a rozseká se až při
vykreslení, takže značky mohou v angličtině stát v jiném pořadí. Používá ji
věta o vkládání obrázků do návodu (dvakrát `<code>`) a věta o tokenu na
wikipedii (odkaz + kurzíva).

**Tři tvary čísla** jako v dávce 7b: „{n} zakázka / zakázky / zakázek"
(kontakt ke všem zakázkám firmy), „{pocet} sada / sady / sad" (technické
parametry) a „{pocet} zdroj / zdroje / zdrojů" (wikipedie). Každý tvar je
vlastní klíč a vybírá ho krátká funkce u komponenty.

**Česky zůstává schválně:**

- `CO_SE_POSILA` v `lib/notifikaceFirmy.ts` — je to TĚLO ZPRÁVY klientovi,
  tedy pošta (pravidlo 5), a zároveň to, co se ukládá jako vzor. Na záložce
  Notifikace je vidět jako náhled znění, ne jako text rozhraní.
- `STAVY_S_NOTIFIKACI` a názvy stavů na tlačítkách vzorů — stavy projektů jsou
  v databázi česky a čekají na kódy (dávka 7e).
- `ukazka` u proměnných vzoru zprávy („ANNIE BOT", „Dobrý den, Radko,") — je to
  vzorek dat, ne text rozhraní.
- **ukázky v polích formuláře „Údaje o sobě" na wikipedii** („je český režisér
  audioknih", „Čeští režiséři, Narození v roce 1985", „Audiotéka", „čte Jan
  Maxián") a placeholder `Wikipedista:VaseJmeno/Pískoviště`. Je to obsah
  českého článku a názvy kategorií české Wikipedie; anglická ukázka by radila
  napsat do článku něco, co tam nemá být. Stejné rozhodnutí jako u „Úvod
  audioknihy" v dávce 7b. Popisky a nápovědy přeložené jsou.
- hodnoty, které se ZAKLÁDAJÍ do databáze: `Nová sada`, `Nová sekce` a
  `Export` v technických parametrech. Totéž jako výchozí názvy výstupů
  v dávce 7b.
- popis obrázku v návodu (`soubor.name` bez přípony) — je to součást textu
  návodu, tedy data.

**Texty, které tečou z API už hotové** a komponenta je nemá jak přeložit —
patří do stejné škatulky jako `/api/admin/upominky` z dávky 4:

- `kindReason` u firem z Caflou („podle IČ", „podle názvu") se ukládá při
  importu do databáze, takže ho nezmění ani přeložený kód.
- `vysledky[].detail` z `/api/admin/caflou-firmy/zalozit` je hotová věta
  z routy; přeložené je jen slovo Založeno / Doplněno / Přeskočeno před ní.
- `bezFirmy` a `chyba` z `/api/admin/projekty/prenos`, `chybaKontroly`
  z hlídání wikipedie (uložená v databázi).
- `shrnuti` revizí z Wikipedie je text od jejích editorů, ten se nepřekládá
  vůbec.

**Náhledy, které vykresluje server** zůstávají, jak jsou:
`/api/admin/vzory-zprav/nahled` vrací HTML zprávy (pošta, pravidlo 5)
a `/api/admin/wikipedie/nahled` vrací článek od Wikipedie.

**„Klient" se v angličtině píše dvěma způsoby** — `Client` (role, záložky
Firem z dávky 5) i `Customer` (doklady, projekty, dávka 7c). Slovníček má
*customer* jen u odběratele, u klienta nic neříká. Sjednotit to patří do
dávky 7e („sjednocení termínů podle slovníčku"); dávka 7c to schválně
nepřepisovala, aby nehýbala s hotovými obrazovkami.

**Do seznamu známých hlášek přibyly dvě**, které s překladem nesouvisí —
`admin/slozky/page.tsx` (přetypování `DiskovaSlozka[]` na `Radek[]`)
a `api/klient/doklady/nahled/route.ts` (chybějící `sluzby`). Jsou na HEADu
i bez téhle dávky (ověřeno na čisté kopii z `git archive`), přišly s prací
po dávce 7b. Proti nové verzi seznamu je výstup kontroly čistý.

### Dávka 7d je HOTOVÁ (3. 10. 2026)

Zapomenuté obrazovky III: Přehledy (kapacita, obrat a zisk, knihy a rozpočty
i jejich podrobný rozpad, režie porady, zvukaři), palubovka, backlog, ceník
studia, Web (Sítě), tabule ve studiu, správa rezervací, veřejné formuláře,
nápověda, honoráře a pozvánky. **53 obrazovek, slovník +814 klíčů
(3 639 → 4 453)** a šest souborů v `src/lib`.

**Nové obecné klíče, které si vezmou i další dávky.** Názvy měsíců a dnů
(`obecne.mesic.*`, `obecne.mesicKratce.*`, `obecne.den.*`, `obecne.denKratce.*`)
ležely v pěti souborech jako pole natvrdo. Teď jsou ve slovníku jednou a berou
si je kapacita studií, analýzy roku, přehled knih i palubovka. Schválně ve
slovníku a ne přes `Intl`: česky z něj podle verze ICU vypadne „ledna" (2. pád)
a nadpis „leden 2026" musí stát v prvním. **Dávka 7e si je má vzít na
`WEEKDAY_LABELS` / `WEEKDAY_SHORT` v `lib/calendar.ts`** místo nového seznamu.

**Nová `formatDatumDlouhy(jazyk, datum)` v `lib/jazyk.ts`** — datum s názvem
měsíce do záhlaví („28. září 2026" / „28 September 2026"). Používá ho záhlaví
technické porady na plátně.

**Číselníky a formátovače dostaly NEPOVINNÝ jazyk** (vzor `nazevMeny` z dávky 4
— bez jazyka vrací češtinu, takže PDF a pošta mluví dál česky):

- `lib/timesheets.ts` — `nazevDruhuPrace()`. Tím je splacený lístek z dávky 5:
  `WORK_TYPE_LABELS` bral i podrobný rozpad knih. **Zbývá
  `projekty/[id]/VykazyProjektu.tsx`** — to je obrazovka dávky 1, ne 7d.
- `lib/palubovka.ts` — `nazevStavuBudiku()` (Šlape to / Hlídat / Přidat podle
  KÓDU), `tachometr()`, `palivomer()`, `popisMesicu()`, `koruny()`,
  `korunyKratce()` a nová `nazevMesicePalubovky()`. `POPIS_STAVU` zůstává jako
  český zdroj pravdy.
- `lib/tabule.ts` — `nazevPolozky()`. Bez jazyka dál česky, protože ji bere
  `notify()` v `tabuleServer.ts` a ta ukládá hotovou větu do databáze.
- `prehledy/finance/format.ts` a `prehledy/knihy/format.ts` — `kc`, `kcKratce`,
  `hodiny`, `pocetKnih`, `datum`. „mil." / „tis." jsou ve slovníku jako
  `format.milionu` / `format.tisic`.

**Formátování se přesunulo o patro níž, do serveru** — tam, kam patří podle
lístku z dávky 4 („texty, které tečou z API naformátované"):

- `lib/knihyPrehledServer.ts` — `KnihyFiltr.jazyk` a `nactiKnihyUkazatele(…, jazyk)`.
  Popisky měsíců („září 2026", „zář 26") chodily do komponenty hotové a ta je
  neměla jak přeložit.
- `lib/mesicniPrehledServer.ts` — `nazevMesice(mesic, jazyk?)` a
  `spoctiPrehledy(mesic, jazyk?)`. Tím padl i `NAZVY_DRUHU` v tom souboru;
  druhy práce teď chodí přes `nazevDruhuPrace`. **Pošta se nemění**: bez jazyka
  je všechno dál české, a dávka 6 zapojená není.

**Lišta záložek Přehledů se překládá podle ADRESY**, ne podle českého názvu
(`prehledy.zalozka./prehledy/kapacita`) — stejný vzor jako `nazevOdkazu` pro
horní lištu. `label` v `prehledy/zalozky.ts` zůstává českým zdrojem pravdy;
**nová záložka potřebuje i klíč ve slovníku**, jinak se ukáže holý klíč.

**Jazyk PROPEM, ne hookem** (pravidlo 8) tam, kde komponenta stojí mimo
`JazykProvider`: tabule ve studiu (`/tabule/[klic]` — displej bez přihlášení,
jazyk z cookie prohlížeče na něm), nastavení a obnova hesla, formulář údajů
z odkazu, průvodce doplněním údajů a `SpotTagger` (kreslí se jednak v kartě
projektu, jednak na veřejném odkazu pro klienta). `Pruhy`, `Analyzy`,
`RadekKnihy`, `Lide` a spol. ho dostávají propem ze serverové stránky.

**Tři tvary čísla** jako v dávkách 7b a 7c: „{pocet} faktura / faktury /
faktur", „{pocet} výdaj / výdaje / výdajů", „{pocet} kniha / knihy / knih",
„{pocet} výkaz / výkazy / výkazů", „{pocet} smlouva / smlouvy / smluv".
Každý tvar je vlastní klíč a vybírá ho krátká funkce u komponenty.

**Sekce /studio zůstává anglická, a je to vidět.** `SpravaStudia` je přeložená
přes `usePreklad()`, ale `(studio)/layout.tsx` nasazuje `jazyk: 'en'` natvrdo
(rozhodnutí 25. 9. 2026), takže se tam ukáže anglická strana slovníku bez
ohledu na přepínač. Česká strana je ve slovníku jako zdroj pravdy.

**Česky zůstává schválně:**

- **obsah ceníku studia** — náhled, PDF i text e-mailu („Valid until",
  „Session length", výchozí zpráva). Jde ven britským klientům studia
  (pravidlo 5); přeložilo se jen rozhraní editoru.
- **texty, které šablona Sítí vkládá do plátna** („Natočili jsme nový spot",
  „Dobrý hlas se nepřehraje") a výchozí název příspěvku. Ukládají se do
  databáze — totéž rozhodnutí jako u výchozích názvů výstupů v dávce 7b.
- **názvy a druhy událostí na tabuli**, jména herců a zvukařů. Chodí
  z kalendáře, jsou to data (pravidlo 4).
- **titulek a popis v `metadata`** u `/instalace` a `/pripominkovat`. Next.js je
  skládá mimo požadavek, takže se k nim cookie s jazykem nedostane.
- `Nový text` ve vrstvě plátna, `Nový příspěvek` jako název v databázi.

**Texty z API, které komponenta nemá jak přeložit** (stejná škatulka jako
`/api/admin/upominky` z dávky 4): `chyba` z `pristupKVideu` a hláška
`Neznámá aplikace.` z `/instalace/qr`.

**Tikající bomba, kterou dávka 7d NEODSTRANILA.** `napoveda/page.tsx` řadí
kategorie podle `KATEGORIE_NAHORE = ['Začínáme']`, tedy porovnáním s českým
textem. Drží to proto, že kategorie návodu je obsah z databáze a ten se
nepřekládá — ale je to tentýž vzor jako `jeVPriprave()`. Kdyby někdo začal
kategorie překládat, „Začínáme" tiše přestane být první. **Do dávky 7e, ke
stavům projektů.**

**Nepoužité po dávce 7d, nemazali jsme:** `POPISKY_DRUHU` v `lib/backlog.ts`
a `MESICE` / `MESICE_ZKRATKA` v `lib/palubovka.ts` (bere je ještě
`MESICE_ZKRATKA` v grafu, `MESICE` už ne). Stejné rozhodnutí jako
u `POPISKY_DRUHU_ARCHIVU` v dávce 5.

**Co shodilo první build (a co z toho plyne pro další dávky).** Formulář údajů
si popisky polí bral `popisekPole()` přímo z `lib/pozvankaUdaju.ts` — jenže je
to KLIENTSKÁ komponenta a ten soubor táhne přes `lib/email.ts` nodemailer,
takže webpack skončil na `Can't resolve 'fs'`. Typová kontrola to nechytí:
běží bez `node_modules` a o balíčku pro prohlížeč nic neví. Popisky se teď
překládají na serveru ve `udaje/[token]/page.tsx` a do komponenty chodí
hotové. **Pravidlo pro dávku 7e: z komponenty s `'use client'` se smí sahat
jen na soubory, které si v hlavičce píšou, že stojí bez závislostí** (jazyk.ts,
tabule.ts, palubovka.ts, socialni.ts a spol.) — cokoli, co vede na Prismu nebo
poštu, patří na server a dolů propem.

**Zámky v `.git` jsou pořád tam a začínají překážet.** Dávka 7b je zapsala na
lístek; dnes bylo v `.git` 51 přejmenovaných prázdných zámků a navíc ŽIVÝ
`index.lock`, který musel jít před commitem pryč přejmenováním — sdílená složka
mazat nesmí. Každé `git status` si vyrobí nový a neuklidí ho. **Chce to smazat
z počítače** (`rm .git/*.lock.*`), jinak to jednou večer spadne na tom, že se
zámek nepodaří ani přejmenovat. Platí i `git rm --cached stubs/prisma-client.d.ts`
(viz dávka 7a).

### Dávka 7e je HOTOVÁ (3. 10. 2026)

Kódy místo textů, zbylé číselníky, názvy zemí a sjednocení termínů.
**Slovník +54 klíčů (4 453 → 4 507)**, 21 souborů. Obrazovek přibylo málo
schválně — tahle dávka je hlavně o tom, aby překlad nerozbil porovnávání.

**STAVY PROJEKTŮ MAJÍ KÓDY — ALE V DATABÁZI ZŮSTÁVÁ ČESKÝ NÁZEV.** To je to
hlavní rozhodnutí dávky. `StavProjektu` má nově `kod` (`V_PRIPRAVE`,
`DOKONCENO_KE_SCHVALENI`…), podle kterého se překládá i porovnává; `nazev` je
dál přesně ta hodnota, která leží v `ProjectMeta.statusName` i v historii
projektu, a **do dat se nesáhlo**. Skutečná migrace (uložit rovnou kód) je dál
na stole, ale je to zásah do všech projektů i do historie a do večerní dávky
překladu nepatří.

Co z toho plyne prakticky:

- `jeVPriprave()`, `jeStavBezNotifikaci()` a `stavJeOdevzdany()` porovnávají
  KÓD, ne napsaný řetězec. Lístek z dávky 5 („tikající bomba") je tím splacený
  a `STAVY_PROJEKTU` se konečně smí překládat.
- Nové `kodStavu()`, `nazevStavu(nazev, jazyk?)` a `popisStavu(nazev, jazyk?)`.
  Jazyk je NEPOVINNÝ — bez něj čeština, takže pošta, PDF i zápis do databáze
  mluví dál česky.
- `stavProKlientaReklamy()` počítá podle pořadí KÓDŮ a vrací přeložený text.
- `STATUS_LABEL_OVERRIDES` v `projekty/shared.tsx` (dva stavy se klientovi
  v přehledu jmenují jinak) se klíčuje kódem, ne českým textem.
- **Hodnota v nabídce zůstává český název.** Všude, kde se stav vybírá
  (`StavProjektuSelect`, `ProjectMetaForm`, `NovyProjektForm`), je `hodnota`
  česká a přeložený je jen `popisek` — jinak by se do databáze uložilo
  „Recording".

**Města herců mají kód taky.** `mesto()` je nově exportovaná,
`MESTA_PRO_HERCE` mají `kod` a `nazevMesta(nazev, jazyk?)` překládá podle něj.
Do `user.studioLocations` se dál ukládá český název, takže párování herec ↔
studio se nemá o co rozbít (lístek z dávky 5). **`nazevMesta` porovnává
PŘESNĚ, ne „obsahuje"**: „Brno II" je druhé studio v Brně a rozlišuje ho právě
ta římská číslice — podle `mesto()` by z obou studií zbylo stejné „Brno".

**Názvy zemí se překládají přes `Intl.DisplayNames`.** Druhý stočlenný seznam
se nepsal: anglická znění bere tatáž data, podle kterých země pojmenuje
operační systém. Český `COUNTRIES` zůstává ručně psaný jako zdroj pravdy
(je v něm dohodnuté „Spojené království", ne „Velká Británie"), ukládá se
pořád ISO kód a pořadí se nemění — sousedi nahoře. Hledání v `CountrySelect`
běží nad přeloženým seznamem, takže v angličtině se najde „Germany" i „DE".
PDF dokladu volá `countryName()` bez jazyka, tedy dál česky (pravidlo 5).

**Zbylé číselníky v `src/lib` dostaly funkci s nepovinným jazykem:**

- `lib/calendar.ts` — `nazevStavuNabidky()` (RECORDING_STATUS_LABELS),
  `nazevDne()` a `nazevDneKratce()`. Dny si berou klíče `obecne.den.*`
  z dávky 7d, takže se seznam nepíše podruhé; `WEEKDAY_LABELS` /
  `WEEKDAY_SHORT` zůstávají jako český zdroj pravdy.
- `lib/porady.ts` — `slovoProDruh(druh, jazyk?)` podle KÓDU druhu
  a `popisOpakovani(o, jazyk?)`.
- `lib/nepritomnost.ts` — `popisDruhu(druh, jazyk?)` a `rozsahSlovy(n, jazyk)`
  (formátovala natvrdo `'cs-CZ'`).

`lib/roles.ts`, `lib/tabule.ts` a `lib/timesheets.ts` mají své funkce
z dávek 7c a 7d; `BLOCK_KIND_LABELS` má `nazevDruhuBloku` z dávky 5. Číselníky
`src/lib` jsou tím hotové.

**„Klient" je v angličtině `customer`.** Dávka 7c to nechala rozkročené mezi
`Client` a `Customer`; sjednoceno na **customer**, protože slovníček má
*odběratel → customer* a pro „klienta" nemá vlastní slovo. Přepsalo se těch
pár míst, kde stál `Client` (role, záložky Firem, náhled role, sekce studia),
ne osmdesát opačných. **Nepřepisovala se jedna věta**: „Outlook a většina
klientů" v nápovědě k odběru kalendáře — tam jde o poštovní programy.

**Co dávka 7e NEUDĚLALA a je to vidět.** Závěrečné proklikání ukázalo, že
**asi 36 souborů nebylo v žádné dávce**: sekce Procesy, Složky na Disku,
Bruno, Nastavení, Zprávy portálu a Doplnit dotočeno, většina karet na detailu
projektu (`RecordingSection`, `SmlouvyKlienta`, `ProgresNataceniKarta`,
`NaCestu`, `CerpaniPoDruzich`, `VykazyProjektu`, `PoznamkyProjektu`,
`HledaniVPdf`, `ProtokolNataceni`, `HistorieProjektu`,
`TechnickeParametryKarta`, `OdkazProKlienta`, `UpravitelnaBunka`) a **režim
pro nevidomé v přeposlechu** (`preposlech/[token]/RezimNevidomi.tsx`, 45 řádků
včetně hlášení pro čtečku a `casSlovy()`). Jsou to tytéž zapomenuté obrazovky
jako v dávce 7a, jen o patro hlouběji — proto je z nich **dávka 7f**, ne
dovětek k 7e. Jak si je najít:

```bash
for f in $(find src/app -name '*.tsx'); do
  grep -q "usePreklad\|prelozit\|nactiJazyk" "$f" && continue
  n=$(grep "[ěščřžýáíéúůňťďó]" "$f" | grep -vE "^\s*(//|\*)" | wc -l)
  [ "${n:-0}" -ge 3 ] && echo "$n $f"
done | sort -rn
```

**Zůstává k rozhodnutí:** `napoveda/page.tsx` pořád řadí kategorie porovnáním
s českým `'Začínáme'`. Kategorie návodu je obsah z databáze (jako stavy před
touhle dávkou), takže to drží — ale je to poslední místo toho druhu.

### Dávka 7f je HOTOVÁ (4. 10. 2026)

Obrazovky, které nebyly v žádné dávce: Procesy (portál i administrace),
Složky na Disku, Bruno, Nastavení sekcí, Zprávy portálu, Doplnit dotočeno,
zbylé karty na detailu projektu a režim pro nevidomé v přeposlechu.
**36 obrazovek, slovník +435 klíčů (4 507 → 4 942)**, 35 souborů v `src/app`
a čtyři v `src/lib`. **Tím je kontrola „soubory bez jediného volání překladu"
prázdná** — zbývá jedině `kalendar/CaraTed.tsx`, a tam je česky jen komentář.

**Režim pro nevidomé** (`preposlech/[token]/RezimNevidomi.tsx`) je z dávky to
nejcitlivější: všechno, co v něm portál říká, jde do živé oblasti pro čtečku
obrazovky. Hlášení jsou proto každé vlastním klíčem a navíc:

- `casSlovy(jazyk, s)` — „4 minuty 12 sekund" se čte líp než „4:12". Česká
  strana zůstala slovo za slovem, jak ji psal původní kód (čeština je zdroj
  pravdy, i když u jedniček a dvojek skloňuje natvrdo).
- **čtečka mluví jazykem portálu**: `SpeechSynthesisUtterance.lang` bral
  natvrdo `cs-CZ`, teď `kodJazyka()`. Jazyk si `ohlas()` bere refem — je
  v `useCallback` bez závislostí a po přepnutí se nemá vyrábět znovu.
- rychlost přehrávání se česky píše s desetinnou čárkou, anglicky s tečkou
  (`rychlostTextem`, pravidlo 3).

**Jazyk PROPEM, ne hookem** (pravidlo 8) u čtyř karet na detailu projektu,
které kreslí serverová stránka: `ProgresNataceniKarta`,
`TechnickeParametryKarta`, `HistorieProjektu` a `ProtokolNataceni`.
`page.tsx` jim ho podává stejně jako `ProjectDocuments` v dávce 7b.

**Číselníky a formátovače dostaly funkci s NEPOVINNÝM jazykem** (vzor
`nazevMeny` z dávky 4 — bez jazyka vrací češtinu, takže pošta a zápis do
databáze mluví dál česky):

- `lib/projektLog.ts` — `formatujCas(kdy, jazyk?)` (lístek z dávky 5, kde
  byla natvrdo `'cs-CZ'`) a nová `nazevDruhuUdalosti()` podle KÓDU druhu.
  `POPISKY_DRUHU` i `POPISKY_POLI` zůstávají českým zdrojem pravdy: do
  historie se zapisuje hotový text do databáze a ten se nepřekládá.
- `lib/oznameni.ts` — `popisekOznameni(o, cast, jazyk?)`: názvy, popisy a věty
  „kdy / komu" u zpráv portálu se překládají podle KÓDU zprávy.
- `lib/nastaveniSekci.ts` — `textSekce(n, cast, jazyk?)` pro nadpis a popis
  nastavení sekce.

**Záložky v Nastavení se překládají podle ADRESY** (`nastaveni.zalozka./admin/…`)
— stejný vzor jako lišta Přehledů z dávky 7d. `nazev` v `ZALOZKY` zůstává
českým zdrojem pravdy; **nová záložka potřebuje i klíč ve slovníku**.

**Splacené lístky z dřívějších dávek:**

- `VykazyProjektu.tsx` — poslední volající `WORK_TYPE_LABELS` bez jazyka
  (lístek z dávek 5 a 7d). Teď jde přes `nazevDruhuPrace()` a částky přes
  `formatCzk(…, jazyk)`.
- `nazevStavuNabidky()` místo `RECORDING_STATUS_LABELS` v `RecordingSection`.
- `OdznakStrany` dostává jazyk propem i z `HerciBunka` a `VyberHerce`
  v přehledu projektů — dávka 7b je nechala mluvit česky.
- bublinka „Dotočeno {datum}" u jména herce (`BublinaHerce`) měla natvrdo
  `'cs-CZ'`; dávka 7b si ji napsala na lístek jako obrazovku dávky 1.

**Tři tvary čísla** jako v dávkách 7b–7d: frekvence u natáčecího plánu
(„{pocet} frekvence / frekvencí", anglicky jednotné číslo jen u jedničky),
strany textu u progresu („{stran} stranu / strany / stran"), záznamy ve
výkazech a herci v Doplnit dotočeno. Každý tvar je vlastní klíč a vybírá ho
krátká funkce u komponenty.

**Dvoutvarová čeština u „uložil / uložila"** v Brunově příručce: věta
„Naposledy uložil Ondřej …" a „Naposledy uložila …" jsou dva klíče, anglicky
je to jedno „Last saved by …".

**Česky zůstává schválně:**

- **stavy projektů jako HODNOTY** v `PREKLOPI_SE` v `DoplnitPanel.tsx` —
  mapa se porovnává s tím, co leží v `ProjectMeta.statusName` (dávka 7e,
  databáze je česky). Na obrazovku jdou přes `nazevStavu(…, jazyk)`.
- **ukázka „Klientská zóna"** v políčku názvu u Složek na Disku. Složky na
  Google Disku se tak opravdu jmenují a anglická ukázka by radila založit
  něco jiného — stejné rozhodnutí jako u „Úvod audioknihy" v dávce 7b a ukázek
  na wikipedii v 7c.
- **kategorie článků** v Procesech. `'Ostatní'` se drží na konci seznamu
  porovnáním s českým textem, ale kategorie je obsah z databáze (pravidlo 4),
  takže to drží; řazení už jde podle jazyka portálu (`localeCompare` dostal
  `kodJazyka`). Je to tentýž vzor jako `'Začínáme'` v nápovědě — viz níž.
- **`ZAPSAL = 'Bruno'`** v natáčecím protokolu: je to jméno, ne text rozhraní.
- **`citelnaHodnota()`** v `lib/projektLog.ts` — formátuje hodnotu, která se
  ukládá do historie, tedy do databáze.

**Texty z API, které komponenta nemá jak přeložit** (stejná škatulka jako
`/api/admin/upominky` z dávky 4): `error` z `/api/admin/doplnit-dotoceno`,
`/api/admin/slozky`, `/api/admin/bruno/prirucka`, `/api/admin/oznameni`
a `/api/admin/procesy/z-parametru`. Před hláškou je přeložená jen věta kolem.

**Poznámky, které si Bruno ukládá sám** (`BrunoPamet.poznamka`), se
nepřekládají vůbec — je to jeho text v databázi.

**Zůstává k rozhodnutí:** `napoveda/page.tsx` pořád řadí kategorie
porovnáním s českým `'Začínáme'` a `procesy/page.tsx` s `'Ostatní'`.
Oboje drží proto, že kategorie je obsah z databáze; správně má mít kód,
jako dostaly stavy projektů v dávce 7e. **Je to poslední tikající bomba
toho druhu v portálu.**

**Zámky v `.git` jsou pořád tam a zdrželi i tuhle dávku.** Dnes jich bylo 61
a před commitem musel jít živý `index.lock` pryč přejmenováním — sdílená složka
mazat nesmí. Lístek je otevřený od dávky 7b. **Chce to smazat z počítače**
(`rm .git/*.lock.*`). Platí i `git rm --cached stubs/prisma-client.d.ts`
(viz dávka 7a).

### Večer 7. 10. 2026 — dávky jsou hotové, úloha může skončit

Večerní dávka nenašla v tabulce žádnou nezaškrtnutou dávku: 0–5 a 7a–7f jsou
hotové, dávka 6 je schválně z poloviny (zapojení pošty se nemá stát v noci bez
dohledu — viz níž). **Překlad portálu je tím dokončený a naplánovanou večerní
úlohu je možné zrušit.** Co z dávky 6 zbývá, je rozhodnutí k dennímu světlu,
ne práce na večer.

> **Doplněno 9. 10. 2026:** platilo to jen zdánlivě. Kontrolní skript nikdy
> nemířil na `src/lib/*.tsx` a hledal text jen podle diakritiky, takže
> podceňoval, co zbývá — viz „Dávka 7g je HOTOVÁ" níž. Úloha má dál co dělat:
> každý večer přibývají nové obrazovky, které s překladem nepočítají.

Kontrola „soubory bez jediného volání překladu" je v `src/app` prázdná —
zbývají jen `kalendar/CaraTed.tsx` a `site/pribehy/spolecne.tsx`, a v obou je
česky pouze komentář (ty zůstávají české schválně).

**Co ale ukázal průchod `src/components`:** tentýž příkaz mířil vždycky jen na
`src/app`, takže se do něj nikdy nedostaly SPOLEČNÉ komponenty, které přibyly
po dávce 3. Doplněno dnes (slovník +7 klíčů):

- `components/ZalozkyLista.tsx` — společná lišta záložek (Doklady, Přehledy,
  nastavení sekcí), od 29. 9. 2026. Přeskládávání mluvilo česky: „neuloženo",
  „Výchozí", „Hotovo", „Přeskládat záložky" a obě šipky pro čtečku
  („Posunout {nazev} doleva/doprava" — jeden klíč se značkou, pravidlo 7).
  **Názvy samotných záložek se nepřekládají tady** — chodí do komponenty už
  přeložené podle ADRESY z `ZalozkyPrehledu`, `DokladyTabs`
  a `ZalozkyNastaveni`, takže se vzor z dávek 7d a 7f nemění.
- `projekty/page.tsx` — `popis` u ozubeného kola („Nastavení projektů —
  zprávy klientovi") byl posledním českým řetězcem na té obrazovce. Sekce
  `InternalProjektySection` si proto bere `nactiJazyk()` sama.
- `components/OzubeneKolo.tsx` — výchozí `popis = 'Nastavení sekce'` zůstává
  **česky schválně**: je to serverová komponenta (pravidlo 8, jazyk propem)
  a všichni čtyři volající dnes posílají přeložený text, takže je to jen
  český zdroj pravdy pro případ, že by někdo `popis` zapomněl.

**Poučení pro příští kontrolu:** hledat napříč `src`, ne jen `src/app` —
`src/components` a `src/lib` do skriptu nikdy nepatřily.

```bash
for f in $(find src/app src/components -name '*.tsx'); do
  grep -q "usePreklad\|prelozit\|nactiJazyk" "$f" && continue
  n=$(grep "[ěščřžýáíéúůňťďó]" "$f" | grep -vE "^\s*(//|\*)" | wc -l)
  [ "${n:-0}" -ge 3 ] && echo "$n $f"
done | sort -rn
```

**Zámky v `.git` jsou uklizené** — lístek otevřený od dávky 7b je splacený,
dnes v `.git` nebyl ani jeden `*.lock.*`. Platí dál jen
`git rm --cached stubs/prisma-client.d.ts` (viz dávka 7a).

### Dávka 7g je HOTOVÁ (9. 10. 2026)

Tabulka dávek byla 7. 10. celá zaškrtnutá, a přece se našlo dost na jeden
večer: **šest obrazovek, dvanáct souborů a slovník +59 klíčů (5 158 → 5 217)**.
Není to nedodělek po 7f, je to **chyba v kontrolním skriptu** — ten mířil na
`src/app` a od 7. 10. i na `src/components`, ale `src/lib/*.tsx` do něj
nepatřily nikdy. A v `src/lib` přitom nejsou jen číselníky: jsou tam i hotové
komponenty, které si bere přehled projektů i jejich detail.

**Co se přeložilo:**

- `lib/ikonyTypu.tsx` — 34 popisků ikon typu projektu („Audiokniha (kniha
  a mikrofon)", „Ekvalizér", „Režie na dálku"). Chodí do bublinky u ikony
  před názvem projektu a do nabídky ikon v Ceníku. `popisekIkony(klic, jazyk?)`
  překládá podle KLÍČE ikony (`ikona.*`), čeština v `IKONY_TYPU` zůstává
  zdrojem pravdy; `IkonaTypu` dostala `jazyk` propem (pravidlo 8 — tabulku
  projektů skládá server i prohlížeč).
- `lib/dokladyUProjektu.tsx` — značky nabídky a faktury u názvu zakázky
  („Vyfakturováno — čeká na úhradu"). Čísla dokladů jsou data, takže dovětek
  „klik ukáže náhled" je jeden klíč se značkou `{popis}` (pravidlo 7), ne
  slepenec.
- `lib/dokladyKlienta.tsx` + `lib/dokladyKlientaServer.ts` — doklady, které
  u své zakázky vidí KLIENT. Popis se skládá na serveru s číslem dokladu,
  takže `dokladyProKlienta()` dostala jazyk a věty mají značku `{cislo}`.
  Tohle bylo z dávky to nejvíc vidět: anglický klient měl v přehledu
  „Nabídka 2026-0042 — čeká na schválení".
- `lib/nabidkaReklamy.tsx` + `projekty/[id]/NabidkaStav.tsx` — ruční značka
  nabídky u reklam (tři stavy, hlášení „Neuložilo se" a bublina „Podle
  nabídky v Dokladech").
- `procesy/[slug]/page.tsx` — detail procesu. Dávka 7f přeložila seznam
  i administraci, ale ne tuhle stránku; stála tu česky i role („Pro
  produkce · upraveno") a datum se formátovalo natvrdo `'cs-CZ'`. Teď bere
  `nazevRole(r, jazyk)` z dávky 7c a `formatDatum`, klíče `procesy.*` mohla
  většinou převzít po `napoveda.*`.
- `projekty/page.tsx` — kontakt u firemní zakázky psal u vlastních projektů
  `'vy'`. Jedno slovo, ale v anglickém přehledu svítilo v každém druhém
  řádku. `nactiJazyk()` se musel posunout na začátek funkce: popisy dokladů
  si o jazyk říkají o padesát řádků dřív, než se vykresluje.

**Poučení pro příští kontrolu — skript hledá málo.** Dvě chyby, obě dnes
viděné na vlastní oči:

1. Mířil jen na `src/app` (+ `src/components` od 7. 10.). Správně `src`.
2. **Hledal text podle diakritiky**, takže minul `'vy'`, `'← Procesy'`,
   `'Upravit'` i `'Pro {kdo} · upraveno'` — a hlavně minul celé soubory,
   které volání překladu MAJÍ, ale jeden řetězec v nich zůstal český.
   Soubor bez jediného volání překladu je tím pádem špatná otázka.

```bash
# retezce v JSX a v apostrofech napric src, vcetne souboru, ktere uz prekladaji
grep -rn "[ěščřžýáíéúůňťďó]" src --include='*.ts' --include='*.tsx' \
  | grep -vE ":\s*(//|\*|/\*)" | grep -vE "^src/lib/(jazyk|jazykEmailu)\.ts" \
  | grep -E "'[^']*[ěščřžýáíéúůňťďó]|>[^<]*[ěščřžýáíéúůňťďó]"
```

**Co z dnešního soupisu zůstává české schválně:**

- `lib/contracts.ts`, `lib/brunoPrirucka.ts` a spol. — text smluv a Brunovy
  příručky; bere si je PDF a pošta (pravidlo 5, viz dávka 4).
- `faktury/nova/page.tsx` — `number: 'Nová faktura'`. Mrtvá hodnota:
  `InvoiceEditor` u neuložené faktury ukazuje `t('faktura.novaFaktura')`
  a do názvu PDF dává `nova`, takže se tenhle řetězec nikam nedostane.
- hlášky v `src/app/api/**` a `console.error` — nejsou rozhraní.

**Nová známá hláška v typové kontrole není z téhle dávky:**
`lib/rozliseniHercu.ts` (TS2352, `User[]` na volnějších stubech) přišla
s dnešním commitem „Dva herci tehož jména se v bublinách rozliší městem".
Dopsaná do `docs/preklad-kontrola-zname-hlasky.txt`, ať je seznam dál
použitelný.

**Zámky v `.git`:** mazání v téhle složce není povolené, takže po commitu
zůstává živý `index.lock` k přejmenování a v `.git` leží `index 2` … `index 6`,
`_smeti` a `objects/maintenance.lock`. **Ke smazání z počítače:**
`rm .git/*.lock .git/index\ [0-9]` a `git rm --cached stubs/prisma-client.d.ts`
(lístek z dávky 7a).

### Dávka 7h je HOTOVÁ (10. 10. 2026)

Tabulka byla po 7g znovu celá zaškrtnutá a večer se zase našlo na dávku:
**osm obrazovek, šestnáct souborů a slovník +53 klíčů (5 239 → 5 292)**.
Dnešní práce (hosté na natáčení, pozvánky, čekárna) přitom **přeložená
přišla** — nové obrazovky už s překladem počítají. Co se našlo, leží
v portálu dýl a **minul to kontrolní skript**, protože se pořád ptal špatně:
„které soubory neobsahují volání překladu". Takový soubor skoro žádný není;
chybí jedna hlavička tabulky, jeden tooltip, jeden placeholder.

**Co se přeložilo:**

- `projekty/ReklamaPrehled.tsx` — **přehled, který vidí klient reklam.**
  Celá vnitřní `Tabulka` nepřekládala nic: hlavička (Projekt, Stav, Herec,
  Licence, Doklady, Dokončení, Složka, Připomínkovat), „Otevřít složku",
  „Připomínkovat" i okno s dokumenty („Zatím tu žádný dokument není.",
  „Stáhnout vše", Rodný/Licenční list). Anglický klient reklam tu měl
  českou tabulku. Herec je tady **voice actor**, ne narrator (slovníček),
  takže vlastní klíč `projekty.sl.herecReklamy`.
- `projekty/shared.tsx` — `AdminProjectsTable` měla hlavičku natvrdo
  (`ProjectsTable` vedle ní ji přitom překládá od dávky 1). A `bunkaSloupce`
  jazyk UMĚLA už od dávky 5, jen jí ho nikdo nedával: `InternalProjectsTable`
  ho teď bere propem z `InternalProjectsBrowser` (`useJazyk()` tam je) a
  posílá dál do buněk, `SortableHeader`u i do tlačítka „Upravit sloupce".
  Tím se rozsvítily i věci, co jen tiše čekaly na jazyk — bublinky ikon typu,
  odznak přeposlechu, značky dokladů, stav projektu a **datumy** (`formatDate`
  bez jazyka = české datum v anglickém portálu).
- `components/Topbar.tsx` — „Domů na Projekty" a „Načíst stránku znovu".
  Jediná dvě místa v liště, kam dávka 0 nedosáhla, protože to nejsou texty,
  ale `title`.
- `projekty/page.tsx` — `<h1>Projekty</h1>` natvrdo. Klíč `projekty.nadpis`
  existoval od dávky 1, jen ho nadpis nepoužíval.
- `tabule/[klic]/Tabule.tsx` — „Volno", „OSTATNÍ STUDIA" a hlavně **„do" a
  „od" u času cizích studií**: byla to slepená věta (`` `do ${hodina(…)}` ``),
  teď jeden klíč se značkou `{cas}` (pravidlo 7).
- `lib/fakturaCast.ts` + `FakturyTabulka.tsx` + `faktury/[id]/InvoiceEditor.tsx`
  — značka, kolikátá část zakázky faktura je. Číselník se překládá **podle
  kódu** (`faktura.cast.*`, `faktura.castZkratka.*`), české `POPIS_CASTI`
  a `ZKRATKA_CASTI` zůstávají zdrojem pravdy. Pozor: zkratka se v tabulce
  používá i jako hodnota filtru, takže musí všude projít tímtéž `zkratkaCasti()`
  — jinak filtr v angličtině nenajde nic. `dokladyUProjektu()` dostala jazyk,
  protože značku dopisuje do bublinky u názvu zakázky.
- `lib/upominkaStav.ts` + sloupec Upomínka v `FakturyTabulka.tsx` — „dnes
  ráno", „zítra ráno", „{poradi}. upomínka", „{poradi}. šla {kdy}" a datum,
  které se formátovalo natvrdo `'cs-CZ'`. Čeština zůstává výchozí, takže
  volající bez jazyka (náhledová routa, viz níž) se nemusel měnit.
- `admin/doklady/banka/BankaKlient.tsx` — pruh o automatickém párování
  z pošty a celé nahrání výpisu (ABO/GPC) mluvilo česky. Hláška po nahrání je
  **výčet**, ne věta: každá část je svůj klíč se značkou `{pocet}` a tečky
  mezi nimi dává až kód. Věta „jak to zapnout v Air Bank" jde přes `sKody`
  se třemi značkami.
- `admin/users/[id]/UserEditForm.tsx` — „Složky na Disku" a jejich nápověda.
  V kódu u nich stál lístek „přidá se do nejbližší dávky" (slovník si tehdy
  brala jiná dávka); lístek je splacený a komentář zkrácený.

**Co zůstává české schválně:**

- `admin/studia/StudiosManager.tsx` — placeholdery adresy a parkování.
  Pole „Parkování" a „Parkování anglicky" stojí vedle sebe a každé drží text
  v jednom jazyce, takže český příklad u českého pole je správně.
- `admin/wikipedie/UdajeForm.tsx` a `ProjectMetaForm.tsx` — placeholdery jsou
  ukázky OBSAHU, který je česky (text na českou Wikipedii, tiráž audioknihy).
- `faktury/nova/page.tsx`, `lib/contracts.ts`, Brunova příručka — viz dávky
  4, 6 a 7g.

**Co se našlo a NEDĚLALO se to (vlastní úkol, ne večerní dávka):**

1. **`src/app/api/nahled/doklad/route.ts` je celý česky** — a není to hláška,
   skládá řádky do bublinky náhledu dokladu („Stav", „Odeslané upomínky",
   „Další upomínka"). Totéž `api/klient/doklady/nahled` a `api/kalendar/*`.
   Pravidlo „v `api/**` nejsou rozhraní" tady neplatí: tyhle routy vracejí
   TEXT NA OBRAZOVKU. Je to na vlastní dávku, protože se k nim musí dostat
   jazyk (cookie čte server, takže `nactiJazyk()` v routě).
2. **`HostNataceni.chybaOdeslani` se ukládá do databáze česky**
   (`lib/hosteNataceniServer.ts`: „Pošta portálu není nastavená.",
   „Pozvánku se nepodařilo odeslat.") a `HosteNataceni.tsx` to vypisuje.
   Co je jednou uložené, jazyk nezmění — **tatáž třída problému jako
   `notify()` v dávce 6.** Správně se má ukládat KÓD a text se má vykreslit
   až při čtení.

**Poučení pro příští kontrolu — ptát se na ŘETĚZCE, ne na soubory.** Skript
z 7g už hledal napříč `src` a bez ohledu na diakritiku, ale pořád počítal
řádky v souboru. Dnešní nález byl jinde: v `title`, `aria-label`,
`placeholder`, `label` a v textu uzlu JSX. Tenhle skript najde přesně to a je
v něm málo šumu (spustit z korene repozitáře, `python3`):

```python
import os, re
PROPS = ('placeholder', 'aria-label', 'title', 'alt', 'label')
for root, dirs, files in os.walk('src'):
    dirs[:] = [d for d in dirs if d != 'api']
    for fn in files:
        if not fn.endswith('.tsx'):
            continue
        p = os.path.join(root, fn)
        src = re.sub(r'/\*.*?\*/', '', open(p, encoding='utf-8').read(), flags=re.S)
        for i, l in enumerate(src.split('\n'), 1):
            s = re.sub(r'//.*$', '', l)
            for pr in PROPS:
                for m in re.finditer(pr + r'=(["\'])([^"\']{2,})\1', s):
                    print(f'{p}:{i} [{pr}] {m.group(2)}')
            for m in re.finditer(r'>([^<>{}]{2,})<', s):
                t = m.group(1).strip()
                if len(t) > 1 and re.search(r'[A-Za-z]', t):
                    print(f'{p}:{i} [jsx] {t}')
```

Vyjde kolem 160 řádků a většina je v pořádku (Mediaspace, „MS portal",
studiové obrazovky, které jsou anglicky vždycky, a útržky kódu uvnitř `{}`).
Projít se to dá očima za pět minut — a je to **jediná kontrola, která najde
soubor, co překládá 99 % a na jednom `title` zapomněl.**

**Zámky v `.git`:** mazání pořád není povolené, takže po commitu zůstává
`index.lock` k přejmenování. Ke smazání z počítače (lístek roste od 7g):
`rm .git/*.lock .git/index\ [0-9]` a `git rm --cached stubs/prisma-client.d.ts`
(ten lístek je z dávky 7a — `stubs/` je v `.gitignore`, ale soubor je dál
sledovaný, takže se při každé kontrole ukazuje jako změněný).

### Dávka 7i je HOTOVÁ (11. 10. 2026)

Tabulka byla po 7h znovu celá zaškrtnutá a večer se zase našlo na dávku —
tentokrát ale z jiného důvodu než včera: **dnešní práce přišla nepřeložená.**
Za jeden den vznikly tři celé obrazovky (nabídkové prezentace, knihovna ukázek,
natáčecí pult) a ani jedna o slovníku nevěděla. **Pět obrazovek, deset souborů,
slovník +132 klíčů.**

**Co se přeložilo:**

- `prezentace/[token]/Prezentace.tsx` + `Prehravac.tsx` — **nabídková
  prezentace, kterou dostane klient na odkazu.** Celá stránka mluvila česky:
  hlavička („Cenová nabídka", „pro …"), všech pět sekcí, přehrávač ukázek
  i spodní lišta se schválením. Veřejná stránka stojí mimo `JazykProvider`,
  takže jazyk chodí **propem** z `page.tsx` (`nactiJazyk()`) — stejný vzor jako
  u veřejné nabídky z dávky 2. Datum platnosti se formátovalo natvrdo
  `'cs-CZ'`, teď jde přes `formatDatum`; `formatMoney` dostává jazyk, takže
  anglickému klientovi nesvítí české oddělovače. Věta po schválení je **dva
  klíče** (se jménem a bez něj), ne slepená — pravidlo 7.
- `projekty/[id]/PrezentaceSection.tsx` — **sestavování prezentace u projektu.**
  Nejdelší soubor dávky: seznam prezentací i celý editor. Řádek pod názvem byl
  slepený z kousků (`` `${r.pocetReferenci} referencí` ``), teď je každá část
  svůj klíč se značkou. Datum schválení se bere přes `formatDatumCas`.
- `admin/ukazky/page.tsx` + `KnihovnaUkazek.tsx` — knihovna ukázek. Hlášky
  k nahrávání nesou název souboru značkou `{nazev}`, ne zřetězením.
- `admin/vzor-prezentace/page.tsx` + `VzorPrezentaceEditor.tsx` — vzor textů.
- `nataceni/pult/[token]/page.tsx` + `Pult.tsx` — **natáčecí pult.** Vstupní
  okno („Vstup do natáčení", jméno), panel s textem k natáčení, přepínače
  mikrofonu a kamery, dlaždice účastníků i obě hlášky o přeposílacím serveru
  (TURN). Čas a den v hlavičce se formátovaly natvrdo `'cs-CZ'` — teď přes
  `kodJazyka(jazyk)`, takže herci z Londýna nesvítí „sobota, 11. 10.".
  Jazyk chodí propem (veřejná stránka) a `t` je kvůli `useCallback`
  v závislostech `spojeniS` a `zpracuj`.
- `obecne.zpetAdministrace` — odkaz „← Administrace" nad nadpisem. Obě nové
  administrační obrazovky ho mají, takže je to sdílený klíč, ne dvakrát totéž.

**Co zůstává české schválně:** `console.error` v obou nových klientských
souborech (vzkaz pro nás, ne pro klienta), komentáře a slovo „video" u délky
ukázky (v britské angličtině je stejné).

**Dvě hlášky typové kontroly navíc — nejsou z dávky.** `prezentaceServer.ts`
přišel dnešním commitem „Nabidkove prezentace pro klienta" a kontrola u něj
hlásí TS2345 a TS2739. Ověřeno na čistém HEADu **před** dávkou: hlásí je
i tam, dávka nepřinesla ani jednu novou. Je to volnost stubů — `findMany`
se `select`em vrací ve stubu `never[]` a spread v `nactiProUpravy` ztrácí
vnořené `offer` a `vybranyHerec`; se skutečně vygenerovaným klientem Prismy
se to srovná (build na Vercelu prošel). Doplněné do
`docs/preklad-kontrola-zname-hlasky.txt`, ať je diff příští dávky zase prázdný
— **až se `node_modules` někde objeví, patří to přeověřit.**

**Co se našlo a NEDĚLALO se to (pořád vlastní úkol, ne večerní dávka):**

1. Routy náhledů v `api/**`, které vracejí text na obrazovku — viz dávka 7h.
2. `HostNataceni.chybaOdeslani` se ukládá do databáze česky — viz dávka 7h.
3. **Rozdělaná práce v repozitáři se dávce do commitu nepletla.** Večer byly
   necommitnuté změny v `prezentace/[token]/page.tsx`, `lib/prezentaceServer.ts`
   a `prisma/navodMapaPortalu.ts` (zvonění při prvním otevření prezentace).
   Překlad `page.tsx` je proto commitnutý **přes verzi z HEADu** — do indexu
   šel HEAD + překlad, v pracovní kopii zůstaly Ondřejovy změny i s překladem
   nad nimi. Nasazená verze tedy nenese nic, co nebylo odsouhlasené; zbylé dva
   soubory se nedotkly vůbec.

**Poučení: kontrola už nestačí, dokud nové obrazovky nepočítají s překladem.**
Dnešní nález nebyl zapomenutý kout, byla to práce z téhož dne. Dokud jsou
nové obrazovky psané natvrdo česky, bude mít večerní úloha každý den co dělat —
levnější je psát `t('…')` rovnou při psaní obrazovky než ji překládat večer
ve druhém průchodu.

### Dávka 7j je HOTOVÁ (12. 10. 2026)

**Dnešní práce přišla přeložená** — a to je novinka proti 7i. Za den vznikly
dvě naše firmy v dokladech, notifikace firmy, režie klienta u termínů
a měsíční přehled, a všechno to rovnou mluví oba jazyky (slovník +108 řádků
od Ondřeje). Kontrola přidaných řádků v `src/app` nenašla jediný nový český
text mimo komentáře. Večer tedy nedojížděl dnešní den, ale **číselníky
v `src/lib/*.ts`, které si text nesou v sobě a vykreslují se natvrdo.**
Dávky 7g a 7h mířily na `src/lib/*.tsx` a na řetězce bez diakritiky; tyhle
jsou v obyčejných `.ts` a chodí na obrazovku skrz propy.
**Šest obrazovek, devět souborů, slovník +33 klíčů (5 449 → 5 482) a +11
názvů voleb.**

**Co se přeložilo:**

- `lib/quickActions.ts` → `components/QuickDock.tsx` — **názvy rychlých voleb
  v levém panelu.** „Nová objednávka", „Nový termín", „Co mě dnes čeká" svítily
  česky i klientovi s EN rozhraním, a to na každé obrazovce portálu
  i administrace. Panel si každý skládá sám a je uložený v databázi česky,
  takže se překládá PODLE KLÍČE VOLBY, ne podle textu — nový `nazevAkce()`
  v `lib/jazyk.ts` je dvojče `nazevOdkazu()` z dávky 0. Český číselník
  zůstává zdrojem pravdy.
- `lib/mazani.ts` → `components/SmazatSPrekazkami.tsx` — **co visí na firmě,
  uživateli a projektu** („3× objednávka, 1× rodný list"). Server jazyk
  příjemce nezná, a tak ho nehádá: `Prekazka` nese kromě českého `co` i `klic`
  do slovníku a přeloží to obrazovka. Česká věta v `error` od API zůstává —
  jde do logu a do hlášky, kterou si čte administrace.
- `lib/normostrany.ts` → `objednavka/OrderForm.tsx` — **hlášky počítání
  normostran z rukopisu.** Tyhle vidí KLIENT: „PDF neobsahuje text, nejspíš
  je to sken", „Starý formát .doc přečíst neumím". Jazyk teď chodí do
  `spoctiNormostrany(file, jazyk)` a dál všemi čtecími funkcemi, protože
  počítání běží celé v prohlížeči. Zdroj textu („E-kniha (.epub)", „Textový
  soubor") je taky klíč; Word, PDF, RTF, HTML ani Final Draft se nepřekládají,
  v angličtině se jmenují stejně.
- **Nová `ChybaRozboru`** místo obyčejné `Error`. Objednávka do té doby
  poznávala naši srozumitelnou větu od technické chyby prohlížeče **podle
  diakritiky** — což přesně ve chvíli, kdy naše věta začne být anglicky,
  přestane platit a klient by místo rady dostal obecné „soubor nejde přečíst".
  Teď se to pozná podle typu chyby.
- `projekty/[id]/ProjectMetaForm.tsx` — placeholdery úvodu a závěru audioknihy
  („Audiotéka uvádí audioknihu …"). Název klienta a jméno režiséra v příkladu
  zůstávají, jen věta kolem nich je anglicky.
- `doklady/faktury/nova/page.tsx` — „Nová faktura" v hlavičce dokladu, který
  se ještě nezaložil (serverová stránka, `nactiJazyk()`).
- `users/[id]/UserEditForm.tsx` — věta „Zatím není založená žádná složka —
  zakládají se ve Složkách na Disku". Odkaz je uprostřed věty, takže je to
  jeden klíč se značkou `{odkaz}` a `prelozitKolem` (pravidlo 7).

**Co zůstává české schválně, i když to kontrola našla:**

- `lib/svatky.ts` a `lib/countries.ts` — **už přeložené jsou**, jen si texty
  nesou samy (`{ cs, en }`, resp. `Intl.DisplayNames`). Kontrola „soubor bez
  volání překladu" je kvůli tomu hlásí falešně; hledat se musí i na `en:`.
- `lib/menu.ts`, `lib/stavyProjektu.ts`, `lib/projectTypes.ts` — české
  číselníky, které se překládají až u vykreslení (`nazevOdkazu`, `nazevStavu`,
  klíče v `IkonaPriority`). Stavy projektů se navíc ukládají do databáze
  česky (dávka 5).
- `lib/contracts.ts`, `lib/vzoryZprav.ts`, `lib/osloveni.ts`,
  `lib/uvodZaver.ts` — texty dokladů a vzorů se řídí jazykem DOKUMENTU, ne
  přepínačem (pravidlo 5), a skloňování jmen je věc češtiny.
- `lib/bruno*.ts` — příručka a nástroje asistenta. Čte je model, ne klient.
- `lib/socialni.ts` — modul sítí vidí zatím jen Ondřej (zadání 27. 9. 2026).

**Co se našlo a NEDĚLALO se to (pořád vlastní úkol, ne večerní dávka):**

1. Routy náhledů v `api/**`, které vracejí text na obrazovku — viz dávka 7h.
   Dnešní průchod jich napočítal přes třicet (`api/nahled/doklad`,
   `api/kalendar/*`, `api/klient/doklady/nahled`); jsou to serverové hlášky,
   u kterých se musí nejdřív rozhodnout, jestli jazyk brát z cookie, nebo
   z uživatele v databázi.
2. `HostNataceni.chybaOdeslani` se ukládá do databáze česky — viz dávka 7h.
3. `src/lib/pristupy.ts` — **názvy sekcí a jednotlivých práv na kartě
   uživatele** (95 řádků). Je to největší zbývající český kus v `lib` a sahá
   do něj i middleware; na jeden večer spolu s ostatním se to nevešlo, je to
   dávka sama pro sebe.
4. Zámky v `.git` byly uklizené, nic se nepřepisovalo. Platí dál
   `git rm --cached stubs/prisma-client.d.ts` (viz dávka 7a).

**Poučení: kontrolní skript ještě pořád lže v obou směrech.** Hlásí soubory,
které si překlad nesou samy (`svatky.ts`), a mlčí o těch, co posílají český
text propem jinam (`quickActions.ts`, `mazani.ts`). Spolehlivější je jít po
tom, KAM text teče, ne po tom, jestli v souboru stojí `usePreklad`.

### Dávka 7k je HOTOVÁ (13. 10. 2026)

**Poslední velký český kus v `lib` je přeložený.** Dávka 7j ho nechala jako
„dávku samu pro sebe" a byl to dobrý odhad: `src/lib/pristupy.ts` je číselník
přístupů, který vykresluje KARTU UŽIVATELE, a je to **jedna obrazovka, dva
soubory a slovník +108 klíčů (5 511 → 5 619)** — 11 sekcí a 43 jednotlivých
práv, u každého název zaškrtávátka i věta pod ním.

**Co se přeložilo:**

- `lib/pristupy.ts` → `admin/users/[id]/UserEditForm.tsx` — **názvy a popisy
  sekcí a práv.** Superadmin rozdává přístupy zaškrtáváním („Vidí faktury",
  „Vystavuje faktury", „Vidí honoráře herců") a celá ta tabule svítila česky
  i tomu, kdo má rozhraní v angličtině. Překládá se **podle KLÍČE PRÁVA**, ne
  podle textu: klíče (`DOKLADY.FAKTURY_VYSTAVIT`) se ukládají do databáze
  (`User.pristupy`) a český číselník zůstává zdrojem pravdy. Stejný vzor jako
  `textSekce` z dávky 4 a `nazevAkce` z dávky 7j.
- **Nový `textPristupu(jazyk, klic, 'nazev' | 'popis', zaloha)` v `lib/jazyk.ts`.**
  Schválně NENÍ v `lib/pristupy.ts`: ten si bere `middleware.ts`, a kdyby si
  sáhl na slovník, táhl by se celý desetitisícový `jazyk.ts` do edge runtime.
  Pravidlo 8 se tím neporušuje — karta uživatele je klientská komponenta
  a jazyk má z `useJazyk()`.
- Popisek u ikony sekce (`IkonaTypu typProjektu={…}`) jde do bublinky pro
  čtečku, takže se překládá taky.

**Co kontrola našla a zůstává česky schválně:**

- `lib/contracts.ts`, `lib/bruno*.ts`, `lib/socialni.ts`, `lib/menu.ts`,
  `lib/stavyProjektu.ts`, `lib/projectTypes.ts` — všechno už rozhodnuté
  v dávkách 7e a 7j, nic se nemění.
- **Ukázky v políčkách** (`StudiosManager` — adresa studia a věta o parkování,
  `SlozkyManager` — „Klientská zóna", `wikipedie/UdajeForm` — celé ukázky hesla).
  Jsou to příklady toho, CO SE DO POLÍČKA PÍŠE česky: adresa studia je česká,
  složky na Disku se tak jmenují a heslo se píše na českou Wikipedii. Anglická
  ukázka by radila založit něco jiného — stejné rozhodnutí jako v dávkách 7b,
  7c a u `SlozkyManager`, kde to stojí v komentáři.
- `ChatDock.tsx` — české `console.error`. Čte je vývojář, ne klient.

**Kontrolní skript lhal i dnes, a to oběma směry** (pokračování poučení z 7j):
nahlásil `lib/ikonyTypu.tsx` (34 popisků ikon) a `lib/dokladyUProjektu.tsx`
(stavy nabídky a faktury) — oba jsou přeložené od dávek 7g a 7e, jen si
češtinu nesou v sobě a angličtinu berou ze slovníku podle kódu. Hledat se
musí i na `prelozit(` a `en:`, ne jen na `usePreklad`.

**Dnešní práce přišla přeložená — až na server.** Jediný dnešní commit
(spodní hranice ceny audioknihy, 12 000 Kč) má `t('objednavka.cenaPodHranici')`
i oba zvednuté stavy ve formuláři rovnou v obou jazycích (slovník +13 řádků od
Ondřeje). Česky zůstala **hláška, kterou vrací `api/orders/route.ts`**, když si
klient navrhne cenu pod hranicí („Minimální cena audioknihy je … Kč bez DPH"),
a to včetně `toLocaleString('cs-CZ')`. Formulář tu větu hlásí sám a přeloženou,
takže klient ji česky uvidí jen tehdy, když formulář objede — ale uvidí.
**Patří to k rozhodnutí o `api/**` níž, ne k večerní dávce.**

**Co se našlo a NEDĚLALO se to (pořád vlastní úkol, ne večerní dávka):**

1. Routy v `api/**`, které vracejí text na obrazovku — viz dávky 7h a 7j.
   Dnešní `api/orders` je další do seznamu a je to první z nich, kterou vidí
   KLIENT, ne administrace. Rozhodnutí je pořád stejné: brát jazyk z cookie
   (u volání z prohlížeče funguje), nebo z uživatele v databázi?
2. `HostNataceni.chybaOdeslani` se ukládá do databáze česky — viz dávka 7h.
3. Oznámení pod zvonkem a zapojení pošty — dávka 6, viz níž.
4. V `.git` leží pět přejmenovaných zámků z dávek 7g–7i
   (`HEAD.lock.smazat-rucne-7g` a spol.). Git nebrzdí, ale smazat je může jen
   někdo u klávesnice. Platí dál `git rm --cached stubs/prisma-client.d.ts`
   (viz dávka 7a).

**Typová kontrola je čistá** — výstup se shoduje s
`docs/preklad-kontrola-zname-hlasky.txt` na řádek, žádná nová hláška.

### Dávka 7l je HOTOVÁ (14. 10. 2026)

**Dnešní nález je jedna třída problému, ne kout:** server spočítá, že něco
nejde, a pošle na obrazovku HOTOVOU ČESKOU VĚTU. Komponenta ji jen vykreslí,
takže v anglickém portálu projde česky, i když je všechno kolem přeložené.
Jsou to **tři obrazovky, devět souborů a slovník +14 klíčů (5 673 → 5 687)**.

**Vzor, který to řeší, aniž by se otevřela otázka `api/**`:** modul v `lib`
posílá vedle českého textu i KLÍČ DO SLOVNÍKU a obrazovka si text přeloží
sama. Čeština zůstává zdrojem pravdy (pravidlo 1) a routy v `api/**` dál
posílají přesně to, co posílaly — nemusí tedy vědět, jaký jazyk má kdo
v liště. Je to totéž, co `textPristupu` v dávce 7k, jen obráceně: tam šel
klíč ze číselníku, tady z návratové hodnoty.

**Co se přeložilo:**

- `lib/tagyServer.ts` → `projekty/[id]/TagySekce.tsx` — **Tagy finální
  nahrávky, obrazovka z dnešního rána.** Čtyři důvody, proč se složka nedá
  načíst („Projekt nemá složku na Disku.", „Portál se nepřihlásil ke Google
  Disku.") dostaly `duvodKlic`. Navíc **„Složka projektu"** v nabídce složek:
  je to jediná položka, která není jméno z Disku, ale náš popisek — pozná se
  po `korenova: true` a překládá se klíčem `tagy.slozkaProjektu`. Jména
  podsložek zůstávají, jak se jmenují na Disku (pravidlo 4).
- `lib/reklamaPripominky.ts` → `pripominkovat/[token]/page.tsx` — **veřejné
  připomínkování spotu.** Pět důvodů, proč odkaz nepustí („Odkaz už neplatí.",
  „Soubor se nenašel."), dostalo `chybaKlic`. Tohle vidí KLIENT: nadpis
  „The link does not work" byl přeložený od dávky 7i, ale věta pod ním byla
  česká.
- `lib/konfliktyServer.ts` → `kalendar/Konflikty.tsx` — **důvody překryvů
  v kalendáři.** „Máte dvě věci naráz" a tři provozní věty se jménem studia,
  herce nebo zvukaře. Věty se do teď skládaly do jednoho řetězce; teď je
  každá jeden klíč se značkou `{nazev}` (pravidlo 7) a chodí v
  `duvodyKlice`. **Český `duvod` zůstává:** když se překryv odklepne jako
  záměr, ukládá se do databáze jako text a ten se nepřekládá.
- `kalendar/nabidka/[id]/OfferBuilder.tsx` a `projekty/StavProjektuSelect.tsx`
  — **dvě zapomenuté záložní hlášky.** „Termín se nepodařilo změnit." (dvakrát)
  a „Stav se nepodařilo uložit."; obě jsou záloha pro případ, že server
  nepošle `error`, takže se na ně kontrolní skript nikdy nezeptal. Druhá je
  o to zrádnější, že `catch` hned pod ní už klíč `stav.neulozeno` používal.

**Dnešní práce šla jinak přeložená.** Záložka Tagy, série u názvu, kapacita
studií i dvě tlačítka v objednávce mají `t('…')` rovnou od Ondřeje; česky
zůstaly jen komentáře (schválně) a `console.error`. Poučení z dávky 7j tedy
platí v dobrém: **překlad psaný při psaní obrazovky nechává večerní dávce
jen to, co leží na serveru.**

**Typová kontrola byla špinavá, a ne naší vinou — opraveno v `gen-prisma-stub.py`:**
HEAD hlásil dvě nové chyby (ověřeno na čisté kopii z `git archive`, tedy ještě
před touhle dávkou): `React.DragEvent` v `components/PlochaProPretazeni.tsx`
(přetahování souborů, 13. 10.) a `NextResponse` použitý jako TYP
v `api/projekty/[id]/preposlech/route.ts`. Obojí je jen volnost stubů — ve
skutečném buildu s `node_modules` to platí. Do `declare module 'react'` proto
přibyly `DragEvent`, `MouseEvent` a zbylé události (v `namespace React` byly,
v modulu ne) a k `NextResponse` i `export type`. Opraveno v `ENV_D_TS`
i v `stubs/env.d.ts`, jak doporučuje „Kontrola na konci každé dávky" — po
opravě se výstup shoduje se `docs/preklad-kontrola-zname-hlasky.txt` na řádek.

**Dávka 7k šla na server až dnes.** Včerejší slovník (+108 klíčů a
`textPristupu`) se v repozitáři svezl s Ondřejovým commitem, ale
`admin/users/[id]/UserEditForm.tsx` — jediný, kdo ty klíče používá — zůstal
necommitnutý, takže karta uživatele svítila česky dál. Jde dnes vlastním
commitem před touhle dávkou. **Poučení: po commitu se vyplatí přepočítat, že
v `git status` nezůstal žádný ze souborů dávky.**

**Co se našlo a NEDĚLALO se to (pořád vlastní úkol, ne večerní dávka):**

1. Routy v `api/**`, které vracejí text na obrazovku. Dnes k nim přibyly
   `api/projekty/[id]/tagy` a `api/projekty/[id]/tagy/zapsat` (hlášky u
   jednotlivých stop) a `api/orders` z dávky 7k. Rozhodnutí je pořád stejné:
   brát jazyk z cookie, nebo z uživatele v databázi?
2. **Tatáž třída důvodů v dalších modulech `lib`, které ale chodí na obrazovku
   jen přes `api/**`** — `vystupyServer.smazVystup` („K výstupu už je vyrobený
   rodný list"), `uctenkaServer`, `storage.ts` („Příloha je moc velká"),
   `nataceniTextServer`, `rodnyListServer`, `preposlechPristup`,
   `schvaleniKlientem`, `bookingServer`, `instagramServer`, `postaServer`.
   Vzor z dnešní dávky na ně sedne, ale smysl dostanou až s bodem 1.
3. Výchozí názvy, které se ukládají do databáze, zůstávají české schválně:
   „Nová sada" a „Nová sekce" v technických parametrech, „Výstup"
   u nového výstupu. Jsou to DATA, která pak vidí celý tým (pravidlo 4) —
   přeložit je podle toho, kdo je zakládá, by znamenalo míchat v databázi dva
   jazyky.
4. `HostNataceni.chybaOdeslani` se ukládá do databáze česky — viz dávka 7h.
5. Oznámení pod zvonkem a zapojení pošty — dávka 6, viz níž.
6. V `.git` leží pět přejmenovaných zámků z dávek 7g–7i. Git nebrzdí, smazat
   je může jen někdo u klávesnice. Platí dál `git rm --cached stubs/prisma-client.d.ts`
   (viz dávka 7a).

### Dávka 7m je HOTOVÁ (15. 10. 2026)

**Dnešní nález není český text, ale český FORMÁT.** Obrazovka má všechny věty
ze slovníku, do věty ale dosazuje datum z `new Intl.DateTimeFormat('cs-CZ', …)`
napsaného natvrdo — takže v anglickém portálu stojí „pozvánka odešla 15. 10.
14:32" uprostřed anglické větve. Kontrolní skript takový řádek nikdy
neohlásí: žádná diakritika v něm není a `t('…')` v souboru je. Druhá polovina
dávky jsou řetězce, které nejsou vidět v textu stránky, ale v BUBLINĚ a ve
čtečce (`title`, `aria-label`) a v záložních hláškách. Celkem **šest
obrazovek, jedenáct souborů a slovník +9 klíčů (5 755 → 5 764)**.

**Datum a čas podle jazyka (nové klíče nepotřebují, jen `kodJazyka`):**

- `projekty/TerminyKlienta.tsx` — **natáčecí plán v přehledu klienta.** `kdy()`
  skládá „út 7. 10. · 10:00–13:00" a je to JEDINÝ český zbytek na obrazovce,
  kterou vidí klient. Jazyk bere `SeznamTerminu` hookem a posílá ho do funkce
  parametrem (modulová funkce, hook v ní být nemůže).
- `projekty/[id]/HosteNataceni.tsx` — `kdySlovy()` (den v týdnu slovy!),
  `kdyOdeslano()` a jedno `Intl` přímo v JSX u data pozvánky. Pozor na
  `jazyk` uvnitř: **host má taky `jazyk`** (čeština/angličtina pozvánky), takže
  v `rozeber` zůstává stínící `const jazyk = s[i]?.jazyk` schválně — to je
  jazyk POZVÁNKY, ne portálu.
- `projekty/[id]/TagySekce.tsx` — „naposledy zapsáno" šlo přes
  `toLocaleString('cs-CZ')`; teď `formatDatumCas(jazyk, …)`, takže i tady
  platí naše pásmo (`NASE_PASMO`) jako ve zbytku portálu.
- `lib/cnb.ts` → `formatRate(rate, kod)` a volající `InvoiceEditor`
  a `ExpenseEditor` — kurz ČNB česky „25,120", britsky „25.120". **Jazyk sem
  chodí KÓDEM, ne jako `Jazyk`:** `cnb.ts` si bere i routy v `api/**` a slovník
  by se s nimi táhl zbytečně.

**Řetězce, na které se nikdo nepodíval, protože nejsou v textu stránky:**

- `projekty/shared.tsx` — hlavička přehledu projektů: „Název sloupce {nazev}",
  „Odebrat {nazev}", „Seřadit podle: {nazev}" a bublina u herce bez účtu.
  Vlastní NÁZEV SLOUPCE se nepřekládá — je to text uživatele (pravidlo 4),
  dosazuje se značkou do přeložené věty (pravidlo 7).
- `projekty/page.tsx` — „Projekty se nepodařilo načíst. {chyba}". Záložní
  hláška, na kterou se skript nezeptal, protože se ukáže jen při pádu dotazu.
- `projekty/[id]/HosteNataceni.tsx` — **zkušební pult** (11. 10.): nadpis,
  tlačítko a vysvětlení, že do pozvánek nejde. Tři klíče `hoste.pult*`.
- `admin/users/NewUserForm.tsx` a `admin/users/[id]/UserEditForm.tsx` —
  „Přihlašovací jméno bez e-mailu…" byla tatáž věta na dvou místech, takže
  jeden klíč `uzivatel.bezEmailu` do obou.

**Typová kontrola: dvě hlášky navíc nebyly z dávky a jsou opravené ve stubu.**
HEAD hlásil `Property 'nahlas' does not exist on type '{}'`
v `components/NeulozeneZmeny.tsx` (ověřeno na čisté kopii z `git archive`).
Vinou byl stub: `createContext<T>` vracel `any`, takže `useContext<T>(kontext: any)`
nemělo z čeho `T` odvodit a kontext vyšel jako `{}`. Ve `stubs/env.d.ts`
i v `ENV_D_TS` je teď `interface Context<T>` a `useContext(kontext: Context<T>)`.
Zároveň **ze seznamu známých hlášek ubyla** `lib/caflou.ts` TS2871 — Ondřej ji
mezitím opravil, takže podle pravidla „když se známá hláška opraví, uber ji ze
seznamu ve stejném commitu" je `docs/preklad-kontrola-zname-hlasky.txt` o řádek
krátší (28 řádků) a diff je prázdný.

**Co se našlo a NEDĚLALO se to (schválně):**

1. `layout.tsx` — hláška o nouzovém režimu databáze je přeložená
   **ternárním operátorem v JSX**, ne klíčem ve slovníku. Funguje, ale je to
   jediné takové místo v portálu; při nejbližším sáhnutí do layoutu patří do
   slovníku.
2. `ChatDock.tsx` — čtyři `throw new Error('Server odmítl …')`. Na obrazovku
   nejdou: `catch` vedle nich ukazuje `t('chat.poradiNeulozeno')` a česká věta
   skončí v `console.error`. Stejná třída jako komentáře — zůstává česky.
3. `Nepritomnost.tsx` a `CalendarBrowser.tsx` — `Intl` s natvrdo `cs-CZ` tam
   plní `<input type="time">`. Není to text pro čtení, ale HODNOTA pro
   prohlížeč, a ta musí zůstat 24hodinová.
4. `LicencniListSection.delkaZMesicu` („3 roky", „18 měsíců") a
   `NewContractForm` s částkou „30 000 Kč" — text, který se píše DO SMLOUVY
   a do licenčního listu. Ty se řídí jazykem dokumentu (pravidlo 5), ne
   přepínačem v liště.
5. `lib/price.ts formatKc` — natvrdo `cs-CZ`, ale nikdo ho nevolá. Mrtvý kód,
   ne nepřeložená obrazovka.
6. Routy v `api/**` a moduly `lib`, které chodí na obrazovku jen přes ně —
   pořád vlastní úkol, viz dávka 7l.

**Dnešních 25 commitů (Tracklist, bonusy, přepínání firem, výchozí kalendáře,
pozvánky hostům) přišlo s `t('…')` rovnou.** Večerní dávce z nich nezbylo nic
než formáty — poučení z 7j a 7l se potvrdilo i ve dni, kdy se portál měnil
nejvíc za celý týden.

### Dávka 7n je HOTOVÁ (17. 10. 2026)

**Dnešní nález není český text ani český `cs-CZ`, ale datum SKLÁDANÉ RUČNĚ** —
`${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`. Takový řádek
nenajde ani kontrola na diakritiku (není v něm ani háček), ani hledání
`cs-CZ` (není v něm ani `Intl`), a přitom je výsledek český formát, který
v anglickém portálu stojí uprostřed přeložené věty. Druhá polovina dávky je
totéž u čísel: `toFixed(1).replace('.', ',')` u velikostí souborů, tedy
„48,2 MB" tam, kde má britsky stát „48.2 MB" (pravidlo 3). Celkem **osm
obrazovek, čtrnáct souborů, slovník beze změny (5 893 klíčů) a mapa odkazů
v liště +6**.

**Ručně skládané datum (nové klíče nepotřebuje, jen `jazyk`):**

- `projekty/[id]/HudbaSekce.tsx` — **karta Hudba u projektu (dnešní ráno).**
  `datum()` a `datumCas()` skládaly datum i české „v" („17. 10. 2026 v 14:32").
  Teď `formatDatum` / `formatDatumCas`, takže platí i naše pásmo jako ve
  zbytku portálu; jazyk chodí modulovým funkcím parametrem (hook v nich být
  nemůže, pravidlo 8).
- `hudba-audioknihy/HudbaAudioknih.tsx` — **Hudba k audioknihám**, datum první
  frekvence a datum odeslané výzvy v sekci „Chybí hudba".
- `hudba/[token]/page.tsx` — **veřejná stránka hudby od klienta.** Datum
  první frekvence se dosazovalo značkou do přeložené věty, ale skládalo se
  česky — tohle vidí klient venku.
- `components/OdznakFrekvenci.tsx` + `lib/frekvenceProjektu.ts` — **rozpis
  frekvencí u názvu projektu (15. 10., tedy až po dávce 7m).** `denAMesic()`
  mělo `cs-CZ` natvrdo i u dne v týdnu, `hodina()` taky, a `datumKratce()`
  v `lib` skládalo „28. 10." ručně. `popisTerminu` dostala nepovinný `jazyk`
  s výchozí češtinou — stejný vzor jako `terminUkolu.popisTerminu`, takže
  volající z `api/**` se nemění.
- `admin/doklady/faktury/KalendarSplatnosti.tsx` — rozsah týdne nad
  kalendářem splatností („5. 10. – 11. 10. 2026"). Jazyk tam byl už od dávky
  7d, jen datum si ho nevzalo.

**Desetinná čárka natvrdo u velikostí souborů:**

- `components/HudbaSeznam.tsx`, `hudba-audioknihy/HudbaAudioknih.tsx`
  a `hudba/[token]/HudbaOdKlienta.tsx` — u padesátimegových WAVů je velikost
  to první, co člověk na kartě vidí. Čísla formátuje `Intl.NumberFormat`
  podle `kodJazyka`, ne `replace`.
- `lib/chatPrilohy.ts formatVelikost` → `ChatDock.tsx` a `DotazyDock.tsx` —
  velikost přílohy v chatu i v dotazech (devět míst) a hláška „příloha je moc
  velká". Funkce má `jazyk` nepovinný s výchozí češtinou, takže routy
  v `api/**` dál posílají přesně to, co posílaly.
- `lib/pribehy.ts velikostVMB` → `site/pribehy/Editor.tsx` — číslo jde do
  přeložené věty „soubor je moc velký", takže v ní svítila česká čárka.

**Šest odkazů v liště, o kterých slovník odkazů nevěděl.** `ODKAZY_EN`
v `lib/jazyk.ts` je z dávky 0 a od té doby do lišty přibyly celé sekce:
`/prehledy`, `/procesy`, `/site/pribehy`, `/hudba-audioknihy`, `/tabule/moje`
a `/studio`. `nazevOdkazu` vrací při chybějícím záznamu český `label`, takže
to nikdy nespadlo — jen v anglickém portálu stálo v liště „Přehledy"
a „Příběhy". Názvy se drží už přeložených nadpisů (`prehledy.nadpis` →
Reports, `procesy.nadpis` → Procedures, `role.TABULE` → Studio display).

**Typová kontrola: dvě hlášky navíc nejsou z dávky.** HEAD hlásí TS2352
v `lib/hudbaProjektuServer.ts` a `lib/hudbaSerieServer.ts` (přetypování
`HudbaProjektu` na `RadekZDatabaze` a `HudbaSerie` na `RadekSerie`) —
ověřeno na čisté kopii z `git archive` ještě před dávkou. Je to volnost
stubů: `findMany` se `select`em vrací ve stubu volnější typ, se skutečně
vygenerovaným klientem Prismy to platí. Dopsané do
`docs/preklad-kontrola-zname-hlasky.txt` (30 řádků), ať je diff příští dávky
zase prázdný.

**Dnešních šestnáct commitů (Hudba u projektu, hudba série, hudba od klienta,
knihovna, Dropbox, přehrávač s křivkou) přišlo s `t('…')` rovnou** — na
obrazovkách zůstaly česky jen komentáře a `console.error`, tedy schválně.
Potvrzuje se poučení z 7j a 7l: co se píše s překladem, to večerní dávce
nezbyde. Zbyly jen formáty, protože na ně se žádná kontrola nikdy nezeptala.

**Co se našlo a NEDĚLALO se to (schválně):**

1. `lib/kapacitaAnalyzy.ts` — `toFixed(2).replace('.', ',')` v CSV kapacity.
   Není to obrazovka, ale **soubor pro Excel**, a ten na českém systému čeká
   čárku; řídí se tedy jazykem dokumentu (pravidlo 5), ne přepínačem.
2. `admin/doklady/vydaje/NewExpenseForm.tsx` — česká čárka v částce. Je to
   HODNOTA v políčku k přepsání, ne text ke čtení (stejná třída jako
   `<input type="time">` v dávce 7m); změna by změnila i to, co se dá zadat.
3. `lib/licencniListServer.ts` — datum v licenčním listu. Text, který se píše
   DO DOKUMENTU (pravidlo 5).
4. `lib/metadataHudby.ts` — „Bez názvu" u skladby bez štítků. Je to DATO,
   které se ukládá k souboru a vidí ho celý tým (pravidlo 4).
5. Routy v `api/**`, které vracejí text na obrazovku — dnes k nim přibyla celá
   hudba (`api/projekty/[id]/hudba/*`, `api/hudba-serie/*`,
   `api/hudba-od-klienta/*`: „Nemáte oprávnění.", „Soubor se v Dropboxu
   nenašel. Zkuste nahrát znovu.") a s nimi `duvod` a `chyba`
   z `vyzvaHudbaServer`, `hudbaProjektuServer`, `hudbaSerieServer`
   a `doplnMetadataServer`. Pořád tatáž otevřená otázka z dávky 7l: brát
   jazyk z cookie, nebo z uživatele v databázi? **Je to největší nepřeložený
   kus portálu a patří to na denní světlo, ne na večer.**
6. `lib/hudbaPripominkyServer.ts` — upozornění „chybí hudba" pod zvonkem
   a v přehledu dne. Text se ukládá do databáze hotový, takže platí dávka 6:
   `notify()` musí dostávat klíč, ne věty.
7. Oznámení pod zvonkem a zapojení pošty — dávka 6, viz níž.
8. **Rozdělaná práce se dávce do commitu nepletla.** Večer vznikala sekce
   Novinky (`src/app/(portal)/novinky`, `lib/novinky*.ts`, `middleware.ts`,
   `menu.ts`, `prisma/schema.prisma`) — necommitnuté soubory zůstaly
   necommitnuté a dávka se jich nedotkla. **Novinky ale přidávají do lišty
   odkaz `/novinky`, takže až se commitnou, patří do `ODKAZY_EN` sedmý
   řádek.**

### Dávka 7o je HOTOVÁ (18. 10. 2026)

**Otevřená otázka z dávky 7l je zodpovězená** (Ondřej, 18. 10.): routy v
`api/**` **neberou jazyk odnikud** — posílají vedle české věty KLÍČ do
slovníku a obrazovka si text přeloží sama. Cookie zná jen prohlížeč a z cronu
ani z akce jménem někoho jiného se jazyk zjistit nedá; tohle je jediná cesta,
která funguje pro všechny tři případy a nechává češtinu zdrojem pravdy
(pravidlo 1). Dnešní dávka tím vzala **celou hudbu: 19 rout, tři moduly
v `lib`, čtyři obrazovky a slovník +28 klíčů**; k tomu číselníky Novinek
(+7 klíčů), dohromady **5 928 → 5 963**.

**Jak to funguje (dva nové soubory, ať to příští routa jen zopakuje):**

- `lib/chybyApi.ts` → `odpovedChyby('chybaApi.bezOpravneni', 403)`. Českou
  větu si funkce vezme ZE SLOVNÍKU (`prelozit('cs', klic)`), takže se píše na
  jednom místě, a do odpovědi přibude `klic`. Routa zůstává na jednom řádku.
- `lib/chybaZOdpovedi.ts` → `hlaskaChyby(data, t, zaloha)`. Obrazovka zkusí
  klíč, pak to, co přišlo v `error` (starší routa, cizí služba, výpadek),
  a teprve nakonec vlastní záložní hlášku. Starých rout se to tedy nedotkne
  a dají se překlápět po jedné.

**Co se přeložilo:**

- **19 rout hudby** — `api/projekty/[id]/hudba/*`, `api/hudba-serie/*`,
  `api/hudba-od-klienta/*`, `api/site/hudba/*` a cron připomínek. 21 vět,
  z toho „Nemáte oprávnění." a „Neplatná data." dohromady ve dvaceti místech;
  anglickému klientovi na veřejné stránce hudby svítilo „Odkaz neplatí."
- `lib/vyzvaHudbaServer.ts` — pět důvodů, proč výzva klientovi neodejde
  („Výzva už odešla.", „Klient hudbu už vložil."), teď s `duvodKlic`
  (vzor z dávky 7l).
- `lib/hudbaProjektuServer.ts` a `lib/hudbaSerieServer.ts` — „Dropbox nevydal
  adresu na nahrání." s `chybaKlic`. Ten je schválně **nepovinný**: druhý
  důvod v téže funkci chodí z `lib/dropbox.ts` a ty hlášky zůstávají české —
  jsou to provozní věty o nastavení (jedna z nich radí, co nastavit v
  `DROPBOX_HUDBA_CESTA`), ne text pro klienta.
- Obrazovky `HudbaSeznam`, `HudbaSekce`, `HudbaOdKlienta` a `NovinkyPrehled`
  čtou chybu přes `hlaskaChyby`.
- **Číselníky Novinek** (`lib/novinky.ts`, sekce z 17. 10. večer) — publika
  („Tým", „Klienti – audioknihy") a druhy („Nový modul", „Vylepšení") se
  překládají podle KÓDU, čeština v souboru zůstává zdrojem pravdy. Názvy
  měsíců byly napsané v poli; teď je skládá `Intl` a čeština vychází stejně
  jako dřív. **Newsletter si jazyk nebere** — ten se řídí jazykem příjemce
  (pravidlo 5), takže `mesicTextem` bez jazyka dál vrací češtinu.

**Odkaz `/novinky` v liště si doplnil Ondřej sám** podle poznámky z dávky 7n,
takže `ODKAZY_EN` je kompletní.

**Typová kontrola: diff proti známým hláškám prázdný** (30 řádků beze změny).

**Co se našlo a NEDĚLALO se to (schválně):**

1. **Hlášky z `zod` schémat** (`parsed.error.issues[0]?.message`) — jsou to
   české věty psané u schématu, ne u routy, a klíč by se k nim musel přivázat
   jinudy. Vlastní úkol; zatím projdou česky jako dosud.
2. **Zbytek `api/**`** — doklady, kalendář, přeposlech, chat, Disk. Vzor je
   hotový a dá se jím jít routa po routě; dnešní dávka vzala hudbu, protože
   je nejnovější a nejvíc vidět.
3. `lib/dropbox.ts`, `lib/storage.ts` a spol. — provozní hlášky o nastavení
   (viz výš).
4. Datum u novinky se ukazuje jako `2026-10-17` (ISO ze serveru). Není to
   český formát, takže to anglickou verzi nebolí; sjednotit se dá, až se bude
   sahat do přehledu.
5. Oznámení pod zvonkem a zapojení pošty — dávka 6, viz níž.

### Dávka 7p je HOTOVÁ (19. 10. 2026)

Dvě věci, obě o přeposlechu a o okně, které se otevře klikem na ikonu
v přehledu: **10 rout, 4 obrazovky, 41 hlášek a slovník +66 klíčů
(5 963 → 6 029)**.

**1. Routy přeposlechu jdou vzorem z dávky 7o** — `odpovedChyby(klíč, status)`
v routě, `hlaskaChyby(data, t, záloha)` na obrazovce. Devět rout
(`api/projekty/[id]/preposlech/*` a `api/nahled/preposlech`), 30 míst, z toho
„Nemáte oprávnění." a „Neplatná data." ve třinácti. Záznam chyby
v AudioTaggeru je podle slovníčku **tag**, takže „Upravit jde jen vlastní
záznam." je „You can only edit your own tag." Obrazovky, které chybu ukazují:
`Preposlech.tsx`, `OdkazProKlienta.tsx`, `RezimNevidomi.tsx` a `NahledIkony.tsx`.

**2. Náhledová okna si JAZYK BEROU Z COOKIE — a je to v pořádku.** Tři routy
(`api/nahled/preposlech`, `api/nahled/doklad`, `api/klient/doklady/nahled`)
neposílají na obrazovku klíče, ale HOTOVÉ ŘÁDKY: okno je jen vykreslí a žádný
slovník nezná. Klíč by tu znamenal poslat ke každému řádku ještě popis, co se
do něj má dosadit. Proto si tyhle tři routy berou `nactiJazyk()` — a smí to,
protože **chodí sem výhradně klik z prohlížeče**: cookie je tedy vždycky po
ruce a výjimka z dávky 7o (cron, akce jménem někoho jiného) se jich netýká.
Pravidlo 1 platí dál, čeština je ve slovníku zdrojem pravdy.

Přeložilo se: nadpis a tlačítko okna, všechny popisy řádků (Odběratel,
Celkem s DPH, Splatnost, Variabilní symbol…), stavy nabídky a faktury
(celé věty „Odeslaná, čeká na schválení", proto vlastní klíče `nahled.stav*`,
ne jednoslovné značky z přehledu dokladů), a věty s čísly jedním klíčem se
značkou („{poslechnuto} z {celkem} poslechnuto"). Datum šlo přes `formatDatum`
místo natvrdo psaného `cs-CZ`, částky přes `formatMoney(…, jazyk)` a upomínky
přes `kdyOdesla/kdyPujde/popisPoradi(…, jazyk)` — ty jazyk uměly už od dávky
7h, jen jim ho nikdo nepředával.

**Typová kontrola: diff proti známým hláškám prázdný** (30 řádků beze změny).

**Co se našlo a NEDĚLALO se to (schválně):**

1. **Řádky objednávky v klientském náhledu** zůstávají české. Skládá je
   `popisObjednavky` v `lib/objednavkaKlientaServer.ts` a ze stejného zdroje
   čte i PDF objednávky — a to se řídí jazykem dokladu, ne přepínačem v liště
   (pravidlo 5). Rozdělit to je vlastní úkol: `popisObjednavky` by jazyk
   dostávalo parametrem s výchozí češtinou (jako `formatMoney`), ale táhne za
   sebou `nazvySluzeb`, `popisDelky` a `popisVystupu`.
2. **Zápisy do historie přeposlechu** („Vrátil(a) úpravu — poznámka je
   v předchozím znění.") se NEPŘEKLÁDAJÍ a je to správně: `zapisUdalost` je
   ukládá do databáze jako hotový text, stejná třída problému jako `notify()`
   u oznámení pod zvonkem (viz dávka 6). Co je jednou uložené, jazyk nezmění.
3. **Hlášky ze `zod` schémat** v `preposlech/route.ts` (dvě místa) — pořád
   otevřené z dávky 7o, čeká to na vlastní úkol.
4. Druhá polovina dávky 6 — zapojení pošty a oznámení pod zvonkem.

**Kolik ještě zbývá v `api/**`:** hrubý odhad `grep` je **1 025 českých hlášek
v `error:`** napříč routami. Nejvíc jich je v administraci (336), pak
`projects` (99), `kalendar` (99), `projekty` (87), `chat` (52) a `site` (51).
Vzor je hotový a jde po oblastech; hudba (7o) a přeposlech (7p) jsou první dvě.
Další na řadě by podle viditelnosti pro klienta byly `api/site/*`,
`api/chat/*` a `api/klient/*`.

### Dávka 7q je HOTOVÁ (19. 10. 2026)

Sítě a Příběhy: **10 rout, 3 obrazovky, 53 hlášek a slovník +23 klíčů
(6 054 → 6 077)**. Vzor je z dávek 7o a 7p — routa pošle vedle české věty
KLÍČ (`odpovedChyby`) a obrazovka si ji přeloží (`hlaskaChyby`).

Přeložené routy: `api/site/pribehy` (seznam, podpis, detail, soubor, zmínky),
`api/site/prispevky` (seznam i detail), `api/site/obrazky`,
`api/site/obrazek/[id]` a `api/site/popisek` (popisek od Bruna). Obrazovky,
které hlášky ukazují: `site/Editor.tsx`, `site/SitePrehled.tsx`
a `site/pribehy/Editor.tsx` — devět míst, kde dosud stálo
`telo.error || t('záloha')`, teď je `hlaskaChyby(telo, t, t('záloha'))`.

**NOVĚ JDE VĚTA SE ZNAČKOU — `odpovedChybyS` v `lib/chybyApi.ts`.** Hláška
„Soubor je moc velký - vejde se do {kolik}." je potřeba i z routy, a dosavadní
`odpovedChyby` umí jen celý klíč bez dosazení. Routa teď posílá `hodnoty`
vedle klíče a dosazuje je až obrazovka, do své jazykové verze věty (pravidlo
7 platí dál: věta zůstává jeden klíč). **Hodnoty musí být jazykově neutrální
— proto se strop posílá v CELÝCH megabajtech** (`Math.floor`), ne přes
`velikostVMB`: ten dává „120,0 MB" a desetinná čárka by v angličtině zůstala
česká (pravidlo 3). Klientská kontrola v editoru, která se ozve první, si
`velikostVMB(…, jazyk)` bere dál — tam jazyk k ruce je.

**Hláška, kterou skript nenašel:** „Instagram vezme jen JPEG, PNG, WEBP, MP4
nebo MOV." nemá ani jedno písmeno s diakritikou, takže v hledání podle
diakritiky nebyla vidět. V `api/**` je proto užitečnější hledat `error: '`
než českou diakritiku:

```bash
grep -rn "error: ['\`]" src/app/api --include=route.ts
```

**Typová kontrola: diff proti známým hláškám prázdný** (30 řádků beze změny).

**Co se našlo a NEDĚLALO se to (schválně):**

1. **Důvod nevyvěšení na Instagram** chodí jiným kanálem než `error` — jako
   pole `chyba` v odpovědi 207 z `vyvesPribehNaInstagram`
   (`lib/pribehyServer.ts`) a dál z `vyvesPribeh` v `lib/instagramServer.ts`.
   Pět vět je našich, ale zbytek je **hotový text od Mety** (`d.error?.message`),
   který prochází tak, jak přišel — cizí služba se nepřekládá. Rozdělit to je
   vlastní úkol: výsledek by vedle `chyba` nesl i `klic`, a projít se musí
   i `pripojUcet` a obrazovka fronty.
2. **Hlášky ze `zod` schémat** ve třech routách hudby — pořád otevřené
   z dávky 7o.
3. Druhá polovina dávky 6 — zapojení pošty a oznámení pod zvonkem.

**Dnešní obrazovky byly čisté.** Kontrola všech souborů v `src` změněných
19. 10. (karta uživatele se zvonkem, Čekárna, zpětný náhled zprávy, historie
projektu, faktura z nabídky, okno nad Diskem, stav „Vyfakturováno") nenašla
ani jeden český řetězec na obrazovce — denní práce už s překladem počítá.
Zbytek češtiny v `src/lib/*.tsx` je zdroj pravdy (popisky ikon, stavy dokladů,
stavy projektu), překládá se podle KÓDU.

**Kolik ještě zbývá v `api/**`:** z hrubého odhadu 1 025 hlášek ubyla hudba
(7o), přeposlech (7p) a teď Sítě. Další na řadě jsou podle viditelnosti pro
klienta `api/chat/*` (52) a `api/klient/*`, pak administrace (336).

### Dávka 7r je HOTOVÁ (nasazeno 29. 10. 2026)

**Práce ležela necommitnutá od 21.–22. 10.** Dávka byla napsaná tehdy, ale
večerní běhy ji nedostaly na server: repozitář byl v iCloudu jako „dataless"
zástupci, takže gitu i typové kontrole padalo čtení souborů
(`Resource deadlock avoided`, `Bus error`) — podrobně v poznámce k 24. 10.
Dnes je repozitář zase na disku, takže se dávka ověřila a nasadila.

**Rozsah: 17 souborů, 30 klíčů, 2 obrazovky navíc.** 15 rout v
`src/app/api/chat/**` (konverzace, zprávy, přílohy, upozornění, pořadí,
hledání, přehled, reakce, projekty) a `src/app/api/klient/doklady/pdf`.
Slovník se nerozšiřoval — všech 30 klíčů `chybaApi.*` se svezlo už
23. 10. v commitu „Pokladna", takže je jen začal někdo volat.

**Nově `odpovedChybyVJazyce(jazyk, klic, status)` v `lib/chybyApi.ts`.**
Výdej přílohy z chatu a PDF dokladu se neotevírají fetchem, ale odkazem
v novém okně — chybu si nemá kdo přeložit, prohlížeč ukáže rovnou JSON.
Jazyk tam ale k ruce je (chodí sem výhradně klik z prohlížeče, nikdy cron),
takže si ho routa vezme z cookie přes `nactiJazyk()` a věta odejde hotová;
klíč jde vedle ní dál. Stejné rozhodnutí jako u náhledových oken v dávce 7p.

**V `api/chat/**` ani `api/klient/**` nezbývá jediná česká hláška `error:`**
(kontrolováno `grep -rn "error: ['\`]" --include=route.ts` plus diakritika).

**Typová kontrola: vazby v prisma stubu jsou teď `any` — ubylo 7 známých
hlášek.** `gen-prisma-stub.py` vazby do modelů vůbec nedával s odůvodněním,
že je pokryje `[key: string]: any`. Nepokryje: index není vidět jako POVINNÁ
vlastnost, takže `as { user: … }` nad výsledkem `include` padalo na TS2352
a TS2345 — na HEADu z 29. 10. šest hlášek (hledání a přehled chatu, návrhy
herců, veřejná stránka návrhů), žádná z nich naše. Generátor teď u vazby
píše `pole: any;` (skalární seznamy `String[]` pokrývá index dál). Výsledek:
**36 → 23 hlášek**, a to jen úbytkem — nic nového nepřibylo. Seznam
v `docs/preklad-kontrola-zname-hlasky.txt` je proto přepsaný na 23 řádků
a dávka proti němu vychází na řádek (ověřeno i na čisté kopii z
`git archive`: pracovní kopie a HEAD dávají stejných 23 hlášek).

**Co zbývá:** `api/admin/**` (~336 hlášek) je největší zbývající kus, dál
hlášky ze `zod` schémat ve třech routách hudby, důvod nevyvěšení na Instagram
(viz 7q) a druhá polovina dávky 6 — zapojení pošty a oznámení pod zvonkem,
které se schválně nedělá bez dohledu.

**Stará poznámka na okraj:** `stubs/prisma-client.d.ts` je v `.gitignore`,
ale v repozitáři verzovaný je (commit „Update prisma-client.d.ts"), takže ho
každé přegenerování ukazuje v `git status` jako změněný. Build ho nebere —
`tsconfig.json` má `stubs` v `exclude` — proto se do commitů dávek nedává.

### Dávka 6 je HOTOVÁ Z POLOVINY - a schválně

Šablony pošty jsou přeložené a ověřené, ale **zapojené nejsou**. To není
nedodělek, je to rozhodnutí: zapojení je ta chvíle, kdy skutečnému klientovi
poprvé odejde anglický e-mail, a to se nemá stát v noci bez dohledu.

**Co hotové je:**
- `src/lib/jazykEmailu.ts` - NOVÝ slovník pošty, 339 klíčů. Schválně stojí
  mimo `lib/jazyk.ts`: ten si bere `JazykProvider`, takže se celý posílá do
  prohlížeče s každou stránkou. Dlouhé odstavce e-mailů tam nemají co dělat.
- Všech 22 šablon v `src/lib/email.ts` umí oba jazyky - HTML, prostý text
  i PŘEDMĚT. Každý `XxxInput` má nepovinné `jazyk?: Jazyk`.
- `User.jazyk` v databázi (výchozí `"cs"`) a `/api/muj-ucet/jazyk`, kam
  přepínač v liště volbu ukládá. Bez toho se jazyk příjemce nedá zjistit:
  cookie zná jen prohlížeč, ale mail odchází z cronu nebo z akce někoho
  jiného.
- `src/lib/jazykPrijemce.ts` - `jazykPodleEmailu()`, `jazykUzivatele()`,
  `jazykFirmy()`. Všechny při chybě vracejí češtinu.

**Ověřeno, ne odhadnuto:** všech 22 šablon se v testu vykreslí v obou
jazycích. Kontroluje se, že HTML má párové značky, že v něm nezůstalo
„undefined" ani nedosazená značka `{neco}` a že se anglická verze od české
opravdu liší. Test je v /tmp, protože bez `node_modules` ho v repozitáři
nespustíme - **stojí za to ho přepsat na skutečný test v `tests/`.**

**Co zbývá (a je to vědomá pauza):** nikdo `jazyk` do `send*Email` nepředává,
takže **všechna pošta dál chodí česky, přesně jako dosud**. Zapojit se to dá
dvěma způsoby:
1. jednořádkově uvnitř každé `send*Email`:
   `const jazyk = input.jazyk ?? (await jazykPodleEmailu(input.to));`
   Výhoda: žádný volající se nemění. Nevýhoda: `email.ts` začne sahat do
   databáze.
2. u volajících, kde je příjemce jistý. Seznam míst: `mesicniPrehledServer.ts`,
   `nabidkaTerminuServer.ts`, `api/kalendar/nabidky/[id]/rozhodnuti`,
   `rodnyListServer.ts`, `notifikaceProjektuServer.ts`,
   `api/admin/pozvanky-udaju/[id]`, `api/doplnit-udaje`, `pozvankaUdaju.ts`,
   `api/projekty/[id]/preposlech/posluchaci`, `preposlechPosluchaciServer.ts`,
   `dotazyOznameniServer.ts`, `upominkyServer.ts`.

**OZNÁMENÍ POD ZVONKEM SE TAKHLE PŘELOŽIT NEDAJÍ.** `notify()` v
`lib/notifications.ts` dostává `title` a `body` jako HOTOVÝ TEXT a uloží ho do
databáze. Co je jednou uložené, už jazyk nezmění - přeložit kód nestačí.
Správné řešení: `notify()` zná `userId`, takže může dostávat KLÍČ a hodnoty
a vykreslit text v jazyce příjemce až při zápisu. Je to vlastní úkol, ne
vedlejší efekt překladu, a dotkne se všech volajících `notify()`.

**Co v poště zůstává české i po zapojení** (formátování přitéká hotové
odjinud, stejná třída problému jako `formatMoney` - dávka 7):
- název měsíce v měsíčním přehledu (`nazevMesice()` v `mesicniPrehledServer.ts`
  má natvrdo `'cs-CZ'`), hodiny a částky (`formatDuration`, `formatCzk`
  v `lib/timesheets.ts`),
- `platiDo` v žádosti o údaje, částky v upomínkách,
- `formatOfferMoney` v `email.ts` (natvrdo `cs-CZ`),
- název stavu projektu a text vzoru zprávy - ty jsou v databázi česky
  a nepřekládají se schválně (viz dávka 5).

**Nalezená starší chyba (neopraveno):** HTML varianty pošty počítají čas
v `Europe/Prague`, ale textové varianty `sendInviteEmail`,
`sendPasswordResetEmail` a `sendInvoiceEmail` formátují datum bez časového
pásma, tedy podle serveru - a ten na Vercelu běží v UTC. Kolem půlnoci tak
tentýž e-mail ukáže v HTML a v textu jiný den.

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
