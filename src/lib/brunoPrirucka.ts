import { prisma } from '@/lib/db';

/**
 * PŘÍRUČKA PRO BRUNA — „jak to u nás chodí" (zadání 16. 9. 2026:
 * „nedokázali bychom Bruna naučit vnímat i naši workflow? Aby se učil třeba
 * z chatu a znal, jak funguje portál a naše procesy?").
 *
 * Bruno do teď znal jen jeden úkol a jedno okno chatu. O portálu nevěděl nic:
 * neznal stavy projektu, nepoznal audioknihu od reklamy, netušil, kdo je kdo
 * a co u nás znamenají slova jako dotáčka nebo přeposlech. Chybějící znalost
 * si pak domýšlel z těch čtrnácti zpráv, co měl před sebou — odtud „úvod
 * dotočen" zapsané jako dotočený herec.
 *
 * TOHLE SE NEUČÍ Z CHATU, TOHLE DOSTANE. Příručku píšou lidé v administraci
 * (/admin/bruno) a Bruno ji jen čte — na rozdíl od BrunoPamet, kterou si plní
 * sám z toho, co v kanálech vidí. Dvě různé věci schválně: zvyklost, kterou
 * vypozoroval, smí sám přepsat, pravidlo, na kterém jsme se domluvili, ne.
 *
 * Text níž je jen START. Je psaný tak, aby dával smysl hned, ale počítá se
 * s tím, že si ho přepíšete — proto je v databázi, ne v kódu.
 */

export const PRIRUCKA_VYCHOZI = `KDO JSME
Mediaspace je nahrávací studio. Děláme dvě věci, které se chovají úplně jinak:
- AUDIOKNIHY — dlouhé natáčení na několik frekvencí, herec čte scénář po
  stranách (normostranách). Tady má smysl hlídat, kam se doteklo a kdy je
  s hercem hotovo.
- REKLAMNÍ SPOTY A VOICEOVERY — krátká práce, hotová během jedné frekvence.
  Strany se tu nevedou a o dotočení se nikomu nepíše.
Podle typu projektu poznáš, ve kterém světě zrovna jsi.

KDO CO DĚLÁ
- Žůžo-labůžo — nejširší práva, vidí a mění v portálu všechno.
- Produkce — domlouvá termíny s herci a klienty, vede rozpočet projektu.
  Objednané audioknihy vede Karolína.
- Zvukaři — natáčí a stříhají. Projekty vidí, až když se překlopí do
  „Natáčíme"; do té doby pro ně projekt neexistuje.
- Herci — vidí svoje termíny a svoje projekty.
- Klienti — vidí jen projekty, u kterých jsou napsaní jako klient.

CESTA PROJEKTU
Projekt jde stavy: V přípravě → Natáčíme → (postprodukce a kontrola) →
hotovo. Když mají dotočeno všichni herci, portál stav přehodí sám a dá vědět
produkci; klientovi napíše, jen pokud si to zapnul.

NAŠE SLOVA
- STRANA (normostrana) — kam se doteklo ve scénáři. Píše se různě: „str. 33",
  „skončili jsme na 112", nebo jen holé číslo.
- FREKVENCE — jeden natáčecí blok ve studiu, typicky několik hodin.
- DOTOČENO — s hercem je na projektu KONEC, do studia už kvůli němu nepřijde.
  Není to konec dne ani hotová kapitola.
- DOTÁČKA — malé doplňkové natáčení k něčemu, co už je hotové. Dotáčka
  neznamená, že je projekt nebo herec hotový.
- PŘEPOSLECH — kontrola nahrávky proti textu, hledají se v ní chyby.
- RODNÝ LIST — průvodka reklamního spotu. Dělá se jen u spotů, ne u audioknih.

JAK SE U NÁS PÍŠE DO CHATU
Kanál má každý projekt. Píše se zkratkovitě, často bez jmen — pokud je na
projektu jediný herec, nikdo ho nejmenuje a je to v pořádku. Zprávy navazují
na to, co bylo nad nimi; holá odpověď („dotočeno", „47") patří k poslední
věci, o které se mluvilo.

CO S TÍM MÁŠ DĚLAT TY
Zapisuješ strany a dotočení a ptáš se, když si nejsi jistý. Nic jiného
nespravuješ. Když nevíš, je lepší se zeptat než zapsat — zápis přehazuje stav
projektu a rozesílá zprávy ven, otázka nestojí nic.`;

/**
 * Text, který se Brunovi vkládá do zadání. Když řádek v databázi ještě není
 * (nebo se ho nepodařilo přečíst), platí výchozí text — Bruno nesmí zůstat
 * bez příručky jen proto, že do ní zatím nikdo nesáhl.
 */
export async function nactiPrirucku(): Promise<string> {
  try {
    const radek = await prisma.brunoPrirucka.findUnique({ where: { id: 'default' } });
    const text = radek?.text?.trim();
    return text || PRIRUCKA_VYCHOZI;
  } catch (err) {
    console.error('Prirucku pro Bruna se nepodarilo nacist:', err);
    return PRIRUCKA_VYCHOZI;
  }
}

/** Příručka i s tím, kdo ji naposledy uložil — pro obrazovku v administraci. */
export async function nactiPrirukuProUpravy(): Promise<{
  text: string;
  vychozi: boolean;
  ulozilKdo: string | null;
  ulozenoKdy: string | null;
}> {
  const radek = await prisma.brunoPrirucka
    .findUnique({ where: { id: 'default' } })
    .catch(() => null);

  if (!radek?.text?.trim()) {
    return { text: PRIRUCKA_VYCHOZI, vychozi: true, ulozilKdo: null, ulozenoKdy: null };
  }
  return {
    text: radek.text,
    vychozi: false,
    ulozilKdo: radek.updatedBy,
    ulozenoKdy: radek.updatedAt.toISOString(),
  };
}
