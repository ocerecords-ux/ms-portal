/**
 * NÁVOD: STAVY PROJEKTU A TLAČÍTKO DOTOČENO (zadání 16. 9. 2026:
 * „přidej do manuálů přehled o tom, jak se teď chovají stavy a tlačítko
 * dotočeno").
 *
 * Text tady je jen ZAČÁTEK. Jakmile ho někdo v portálu upraví, seed už do něj
 * nesahá - zakládá se jen tehdy, když návod s touhle adresou ještě není.
 */
export const STAVY_A_DOTOCENO = {
  slug: 'stavy-projektu-a-dotoceno',
  nazev: 'Stavy projektu a tlačítko Dotočeno',
  perex: 'Co který stav znamená, kdy se přehazuje sám a co přesně udělá tlačítko Dotočeno u herce.',
  kategorie: 'Projekty',
  poradi: 10,
  obsah: `Stav projektu je od přechodu z Caflou **vlastní údaj portálu** — nepřichází odnikud zvenčí a přehazuje se ručně v kartě projektu. Tenhle návod je o tom, co který stav znamená, kdy se přehazuje sám a co přesně udělá tlačítko **Dotočeno** u herce.

![Cesta projektu stavy](/navody/cesta-projektu.png)

# Devět stavů a co znamenají

Pořadí v nabídce není abecední — jde tak, jak projekt opravdu putuje, aby se hledal ten správný stav a nelovil se v seznamu.

- **V přípravě** — objednávka přišla, projekt je založený, ještě se neplánuje.
- **Natáčíme** — s hercem je naplánováno.
- **Natáčíme/stříháme** — ještě se natáčí a na disku už jsou první zpracované tracky k poslechu.
- **Dotočeno** — s hercem dotočeno, na disku zatím není ani jeden track.
- **Dotočeno/stříháme** — s hercem dotočeno a na disku už jsou první tracky.
- **Dokončeno - ke schválení** — na disku jsou všechny tracky, čekáme na finální opravy od klienta.
- **Čekáme na opravy** — sedm dní po odevzdání klient opravy nedodal.
- **Schváleno - k fakturaci** — opravené nahrávky jsou na disku, čeká se na fakturu.
- **Vyfakturováno** — faktura je u klienta, projekt je uzavřený.

**Projekt končí až fakturou.** Ve „Schváleno - k fakturaci" je práce hotová, ale zakázka běží dál, takže projekt zůstává mezi aktivními. Do dokončených spadne až ve „Vyfakturováno". Na „Vyfakturováno" se projekt přepíná **ručně** — odeslání faktury ho samo neuzavře (posíláme i zálohové faktury, po kterých zakázka pokračuje).

Každý stav má svou barvu a každý odznak má i rámeček — aby se stavy daly rozeznat i na černobílém výtisku nebo když někdo barvy nerozezná. Stav přenesený z Caflou, který v téhle cestě není, dostane neutrální šedou (nebo zelenou, když je projekt dokončený), aby odznak nikdy nevypadal rozbitě.

# Tlačítko Dotočeno

Je v detailu projektu vedle jména herce a mají ho **admin a produkce**. Fajfka patří **dvojici projekt + herec** — na audioknize bývá herců víc a každý končí jindy. V přehledu projektů se dotočený herec pozná podle zelené linky kolem bubliny se jménem.

## Co se stane po stisknutí

**Zapíše se fajfka** — s datem i s tím, kdo ji kliknul. To se stane vždycky.

**Přehodí se stav**, ale jen ze dvou stavů:

- \`Natáčíme\` → \`Dotočeno\` — stříhat se ještě nezačalo.
- \`Natáčíme/stříháme\` → \`Dotočeno/stříháme\` — stříhá se už během natáčení.

A to až ve chvíli, kdy mají fajfku **všichni herci projektu**. „Dotočeno" znamená, že natáčení skončilo — u dvojhlasu nebo dabingu by stav po prvním herci lhal. Zpráva o dotočeném herci odejde vždycky, ta s tím nesouvisí.

**V žádném jiném stavu se na stav nesahá.** Ve „V přípravě" se ještě netočilo, v „Dokončeno - ke schválení" a dál je natáčení dávno za námi — přehodit tam stav zpátky by byl přesně ten nepořádek, kterému se chceme vyhnout. Fajfka se uloží tak jako tak.

Z „Dotočeno" se na „Dotočeno/stříháme" pokračuje ručně, až přijdou první tracky.

## Zrušit dotočeno

Tlačítko se u dotočeného herce přepne na **Zrušit dotočeno**. Odškrtnutí vrátí **přesně to, co tlačítko udělalo** — a jen dokud projekt pořád stojí tam, kam ho tlačítko dalo. Když ho někdo mezitím posunul jinam, stav se nechá být a jen se zapomene, co tlačítko provedlo. Proto se nemůže stát, že by odškrtnutí herce v „Dotočeno/stříháme" poslalo projekt do „Natáčíme/stříháme", tedy do stavu, ve kterém nikdy nebyl.

O odškrtnutí se nikomu nepíše — v praxi je to oprava překlepu.

## Komu o dotočení přijde zpráva

Jsou to **dva různé okruhy**:

- **Nám interně** — každý, kdo má na své kartě uživatele zaškrtnuté **„Dostává zprávy o dotočení"**. Přijde mail s odkazem rovnou do detailu projektu.
- **Klientovi** — jen ten jeden člověk, který je u projektu vyplněný jako klient, a jen když to má na své kartě zapnuté. Dostane jinou zprávu; do detailu projektu se stejně nedostane.

**U reklam (projekty s Rodným listem) se o dotočení nepíše nikomu.**

Když si klient upozornění zapne až potom, co se dotočilo, samo mu už nic nepřijde — fajfka se schválně neoznamuje dvakrát. Od toho je vedle tlačítko **Poslat klientovi**: pošle ten jeden mail a zvoneček dodatečně a nic tím nepřepíše. Proto to nedělejte odškrtnutím a znovuzaškrtnutím — tím by se přepsalo datum dotočení a produkci by mail přišel podruhé.

## Bruno umí totéž

Když někdo napíše do kanálu projektu **„dotočeno"**, Bruno udělá přesně to samé co ten klik — zapíše fajfku, přehodí stav, když mají dotočeno všichni, a pošle zprávu. U záznamu je pak vidět, jestli fajfku kliknul člověk, nebo ji vyčetl Bruno z chatu. Napsat „dotočeno" dvakrát nevadí: kdo fajfku už má, tomu se nic nepřepíše a nikomu znovu nic nechodí.

# Zprávy o změně stavu

Jestli se klientovi o stavu píše, **rozhoduje nastavení u firmy** — karta firmy, záložka Notifikace. Co tam není zapnuté, se neposílá, takže zpráva nemůže odejít klientovi, se kterým to není domluvené. **Nová firma má všechno vypnuté.**

Nastavit jde: Natáčíme/stříháme, Dotočeno, Dotočeno/stříháme, Dokončeno - ke schválení, Čekáme na opravy, Schváleno - k fakturaci. U „V přípravě" a „Natáčíme" se ještě nic nestalo a zpráva o tom by byla jen šum.

**„Natáčíme/stříháme" a „Dotočeno/stříháme" sdílejí jednu zprávu** — klientovi říkají totéž (na disku jsou první tracky), takže odejde jen ta dřívější z nich.

Přehození stavu nikdy neshodí to, že zrovna nejede odesílání mailů — do historie projektu se změna zapíše vždycky a chyba se jen poznamená.

# Zpětné doplnění

Projekty přenesené z Caflou se dotočily ještě předtím, než tlačítko vzniklo. Na jejich srovnání je stránka **/admin/doplnit-dotoceno** (jen admin, schválně není v menu). Stav se překlopí úplně stejně, ale **neodejdou zprávy** — dnes by klientovi přišly jako novinka. Do historie projektu se to zapíše.

# Co poběží samo, až bude napojený disk

- **Dotočeno** se má překlopit samo, jakmile je s hercem dotočeno a na disku ještě není ani jeden track.
- **Čekáme na opravy** se má překlopit samo sedm dní po „Dokončeno - ke schválení" a odejít o tom zpráva klientovi.

Do té doby jde obojí přehodit ručně, aby to nikoho neblokovalo.`,
};
