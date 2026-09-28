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
| 7b | další večer | Zapomenuté obrazovky I — sekce na detailu projektu (rodný list, licenční list, výstupy, `ProjectMetaForm`, rozpočty, posluchači přeposlechu, `ProjectDocuments`), objednávka reklamy, `NovyProjektForm`, `InternalProjectsBrowser` | [ ] |
| 7c | další večer | Zapomenuté obrazovky II — administrace: firmy a `CompanyForm`, caflou-firmy, údaje (žádosti), vzory zpráv i natáčení, wikipedie, technické parametry, návody, přenos projektu | [ ] |
| 7d | další večer | Zapomenuté obrazovky III — Přehledy (knihy, kapacita, zvukaři, finance), palubovka, backlog, ceník studia, Web, tabule, správa studia, veřejné formuláře (`doplnit-udaje`, `udaje/[token]`, `pripominkovat`, `instalace`, nastavení hesla), nápověda, honoráře, pozvánky | [ ] |
| 7e | další večer | Kódy místo textů a poslední průchod — stavy projektů a `jeVPriprave()`, města v `lokaceHercu`, `COUNTRIES`, zbylé číselníky v `src/lib` (role, dny, kalendář, druhy práce, tabule, porady, nepřítomnosti), sjednocení termínů podle slovníčku a proklikání portálu v EN | [ ] |

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
