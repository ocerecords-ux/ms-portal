/**
 * NÁVOD: MAPA PORTÁLU (zadání 18. 9. 2026: „udělej mi přehled (mapu) celého
 * portálu, jakou má strukturu a jak obecně funguje. Aby to pochopil každý.
 * A dej to pak do nápovědy na portál rovnou").
 *
 * Je to úvodní návod pro každého, kdo portál otevře poprvé - proto pořadí 1
 * a kategorie „Začínáme". Schválně bez technických pojmů: kde co je, kdo co
 * vidí a co portál dělá sám.
 *
 * Text tady je jen ZAČÁTEK. Jakmile ho někdo v portálu upraví, seed už do něj
 * nesahá - zakládá se jen tehdy, když návod s touhle adresou ještě není.
 */
export const MAPA_PORTALU = {
  slug: 'mapa-portalu',
  nazev: 'Mapa portálu: co kde je a jak to funguje',
  perex: 'Celá cesta zakázky na jednom obrázku — klient, my a herec krok po kroku. K tomu mapa sekcí, kdo co vidí a co portál dělá sám.',
  kategorie: 'Začínáme',
  poradi: 1,
  obsah: `MS Portal drží celou zakázku na jednom místě: objednávku, projekt, natáčení, nahrávky pro klienta, smlouvu s hercem, fakturu i to, jestli přišla platba. Dřív to bylo rozseté mezi Caflou, e-maily, Disk a tabulky. Tenhle návod je mapa — kde co je, kdo co vidí a co se děje samo.

# Celá cesta zakázky na jednom obrázku

Vodorovně jde čas, od objednávky po zaplacenou fakturu. Ve třech pruzích je vidět, **co v které chvíli dělá klient, co my v portálu a co herec** — a u každého kroku i to, jestli se k tomu ten člověk přihlašuje, nebo mu stačí odkaz z e-mailu.

![Celá cesta zakázky: klient, Mediaspace a herec v šesti krocích](/navody/cela-cesta.png)

Tři věci, které z obrázku stojí za zdůraznění:

- **Klient ani herec nic neinstalují.** Schválení nabídky, podpis smlouvy, stažení nahrávek, přeposlech, výběr termínů i vyplnění údajů — všechno jde odkazem z mailu, který funguje sám o sobě. Účet v portálu je bonus, ne podmínka.
- **Prázdné místo v pruhu znamená, že ten člověk nemá co dělat.** Herec neřeší nabídku, klient neřeší plánování studia. Každý vidí jen svůj kousek.
- **Zelené pruhy dole jsou práce, kterou nikdo nedělá** — portál je udělá sám.

# Mapa sekcí

![Mapa portálu](/navody/mapa-portalu.png)

# Šest sekcí v horní liště

**Projekty** jsou srdce portálu. Každá zakázka má svou kartu: stav, termíny, herce, rozpočet, nahrávky, doklady. Většina práce se odehraje tady.

**Firmy** jsou klienti a dodavatelé. U klienta se kromě adresy a fakturačních údajů nastavuje i to, **které zprávy mu portál posílá** — na kartě firmy je záložka Notifikace a co tam není zapnuté, se neodešle. Nová firma má vypnuté všechno.

**Uživatelé** jsou lidé. Kromě role se u účtu zaškrtává, co ten člověk smí a co mu chodí: jestli může být manažerem projektu, jestli podepisuje smlouvy za Mediaspace, jestli vidí sekci Banka, komu chodí objednávky. Je to schválně **u účtu, ne v kódu** — lidi se mění a portál o tom jinak neví.

**Ceníky** jsou dvě věci najednou: ceny služeb a zároveň seznam typů projektu. U projektu jde vybrat jen takový typ, který je v ceníku — proto se nové typy přidávají tady.

**Doklady** jsou peníze: nabídky, faktury, přijaté výdaje, smlouvy, banka a „Moje firmy" (za kterou firmu doklad vystavujeme, číselné řady, bankovní účty).

**Kalendář** je studio a natáčení: kdo kdy natáčí, kdy je studio blokované a nabídky termínů pro herce.

Kromě toho je v liště ještě **chat**, **zvoneček** s upozorněními, **otazník** (tahle Nápověda) a vlevo panel s rychlými volbami.

# Uvnitř projektu

Karta projektu má záložky a ukazují se jen ty, které dávají smysl:

- **Přehled** — stav, termíny, klient, herci, odkaz pro klienta. Vidí ho každý.
- **Rozpočet** — položkové náklady, výkazy zvukařů, bonusy. Admin a produkce.
- **Natáčecí frekvence** — plánování studia a herce.
- **Rodný list** — jen u rádiového spotu; PDF se vyrobí samo, když je spot hotový.
- **Přeposlech** — AudioTagger: poslech nahrávky a zápis chyb s časem a stranou scénáře.
- **Natáčecí protokol** — co se při natáčení stalo.
- **Historie** — co se u projektu měnilo a jaké zprávy odešly klientovi.
- **Doklady** — nabídky, faktury, výdaje a smlouvy navázané na projekt. Jen admin. Odsud jde nový doklad rovnou založit, projekt i klient se předvyplní.

# Cesta zakázky

1. **Objednávka.** Klient ji pošle v portálu (audiokniha nebo reklama). Vznikne projekt, kanál v chatu a složka na Disku, a nám přijde mail.
2. **Nabídka.** Vystaví se v Dokladech a odejde klientovi odkazem. Klient ji otevře, prohlédne a **schválí jedním kliknutím** — a na zvonečku to cinkne manažerovi projektu.
3. **Natáčení.** Produkce sestaví hercovi nabídku termínů, herec si z odkazu vybere, produkce potvrdí — a tím vzniká rezervace studia. Smlouva s hercem se založí ze šablony a herec ji podepíše taky odkazem.
4. **Práce a nahrávky.** Zvukař si píše výkazy, nahrávky se ukládají na Disk a klient se k nim dostane odkazem z mailu — bez přihlašování. V přeposlechu píše, co chce opravit.
5. **Stav projektu** se během toho posouvá: V přípravě → Natáčíme → Dotočeno → Dokončeno - ke schválení → Schváleno - k fakturaci → Vyfakturováno. Podrobně je to v návodu *Stavy projektu a tlačítko Dotočeno*.
6. **Faktura.** Vystaví se z nabídky nebo rovnou u projektu. Projekt je hotový až fakturou.
7. **Platba.** Portál si třikrát denně stáhne pohyby z banky. Když sedí variabilní symbol i částka, **označí fakturu jako uhrazenou sám**; když sedí jen něco, nabídne to ke schválení.

# Lidé zvenčí nic neinstalují

Klient ani herec se nemusí nikam přihlašovat, když nechtějí. Portál posílá **odkaz, který funguje sám o sobě**: schválení nabídky, podpis smlouvy, stažení nahrávek, přeposlech, výběr termínů, vyplnění údajů. Odkaz je dlouhý a náhodný, stránka se nedá najít přes vyhledávač a jde kdykoliv zneplatnit a vygenerovat nový.

Klient, který účet má, vidí v portálu navíc své projekty, nahrávky a může objednávat.

# Kdo co vidí

- **Klient** — jen své projekty a nahrávky, ceny jen na svých dokladech.
- **Herec** — své termíny a údaje, smlouvy podepisuje odkazem. V Projektech vidí jen své projekty: název, normostrany, stranu, kde se skončilo na poslední frekvenci, a odkaz na text (PDF končící _RE ze složky projektu). V Honorářích vidí, co je navrhnuto, co čeká na proplacení a co je zaplaceno, a odtud se dostane i ke svým smlouvám.
- **Zvukař** — projekty, kde pracuje, své výkazy a kalendář ke čtení. Nevidí rozpočty, doklady ani projekty v přípravě.
- **Produkce** — plánování, rozpočty, pozvánky herců. Nevidí doklady ani ceny objednávek.
- **Žůžo-labůžo (admin)** — všechno, včetně administrace.
- **Banka** je navíc: vidí ji jen ten, kdo to má u účtu zaškrtnuté, ani ostatní admini ne.
- **Nápověda** je naše: návod bez zaškrtnuté role vidí jen tým (Žůžo-labůžo, Produkce, Zvukař). Herec nebo klient uvidí jen návod, u kterého je v Adminu ▸ Návody ▸ „Komu se ukáže" zaškrtnutá jeho role — a jen tehdy se mu v liště objeví otazník.

# Co portál dělá sám

- **Páruje platby** z banky s fakturami (třikrát denně).
- **Hlídá opravy** — sedm dní po odevzdání, když klient nic neposlal, přehodí projekt na „Čekáme na opravy" a napíše mu.
- **Píše klientovi** zprávy o stavu projektu podle toho, co má jeho firma zapnuté; text se bere ze Vzorů zpráv.
- **Čte účtárenskou schránku** a z příloh zakládá nezařazené výdaje — z účtenky si navíc přečte částku, datum i dodavatele.
- **Vyrobí rodný list** spotu, jakmile je reklama hotová.
- **Navrhne bonus** zvukaři, který odvedl většinu střihu.
- **Šestého v měsíci** pošle zvukařům přehled jejich výkazů za minulý měsíc.
- **Bruno** čte kanály projektů v chatu, pozná, kam se doteklo natáčení, a zapíše to do karty projektu. Když si není jistý, zeptá se v kanálu.

# Na čem to stojí

Portál běží na Vercelu, data jsou v databázi. Nahrávky bydlí na **Google Disku** (portál je jen ukazuje a stahuje), ostatní přílohy v úložišti s dočasnými odkazy. Kurzy měn se berou z **ČNB** a ukládají se k dokladu, údaje firem z **ARESu**, banka jde přes **GoCardless**. E-maily chodí přes běžný SMTP, upozornění do mobilu přes push.

# Když něco hledáš

- **Kde je zakázka a jak na tom je?** Projekty → karta projektu → Přehled.
- **Kdy natáčíme a kde?** Kalendář, nebo záložka Natáčecí frekvence u projektu.
- **Co jsme klientovi poslali?** Historie u projektu.
- **Kolik jsme fakturovali?** Doklady u projektu, nebo sekce Doklady.
- **Přišly peníze?** Doklady → Banka (kdo na ni má právo).
- **Proč klientovi nic nepřišlo?** Firmy → karta firmy → Notifikace.
- **Jak něco udělat?** Otazník v liště — tahle Nápověda.`,
};
