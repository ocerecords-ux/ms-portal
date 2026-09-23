import { prisma } from '@/lib/db';
import { zapisBrunoUdalost } from '@/lib/projektLogServer';
import { jeZminen } from '@/lib/chatUpozorneniServer';
import { anthropicHlavicky } from '@/lib/anthropic';
import { oznacHerceDotoceno, zrusHerceDotoceno } from '@/lib/dotoceniServer';
import { denZDotazu } from '@/lib/brunoDenDotaz';
import { prehledNaDen } from '@/lib/ranniPrehledServer';
import { nactiPrirucku } from '@/lib/brunoPrirucka';
import { bezTitulu } from '@/lib/jmena';

/**
 * BRUNO — asistent studia (zadání 12. 9. 2026: „pojďme přidat našeho firemního
 * otroka, který se jmenuje Bruno. Chci, aby dělal různé věci, ale první úkol
 * bude sbírat data z komunikací interních a pamatovat si souvislosti.")
 *
 * PRVNÍ ÚKOL: v kanálu projektu hlídá, kam se doteklo natáčení. Když zvukař
 * napíše „str33", „str.33" nebo jen „33", Bruno to zapíše do karty projektu.
 * Když je na projektu víc herců a ve zprávě není jméno, ZEPTÁ SE V KANÁLU —
 * špatný zápis je horší než žádný.
 *
 * PROČ TO NENÍ HLEDÁNÍ VZORCŮ V TEXTU: zadání znělo „chci, ať je to pravá AI,
 * co se učí a přemýšlí". Zprávu proto posuzuje model. Pozná tím i věty, na
 * které by se v kódu nikdo nepřipravil („Petr dneska došel na 47", „skončili
 * jsme v polovině 112. strany"), rozumí odpovědi na svůj vlastní dotaz
 * a hlavně pozná, kdy se nemá ozvat.
 *
 * PAMĚŤ: po každém rozhodnutí si smí uložit jednu větu do BrunoPamet a před
 * dalším rozhodnutím ji dostane zpátky. Tak se učí zvyklosti konkrétních lidí
 * a projektů, aniž bychom je psali do kódu.
 *
 * NIKDY NEVYHAZUJE. Chat musí fungovat, i když je API mimo provoz nebo klíč
 * chybí — zpráva už je dávno uložená a Bruno je k ní jen komentář navíc.
 *
 * NASTAVENÍ
 * ANTHROPIC_API_KEY — klíč k API (sdílený se čtením dokladů).
 * BRUNO_MODEL — volitelně jiný model.
 */

const MODEL = process.env.BRUNO_MODEL || 'claude-sonnet-4-5';
const ADRESA = 'https://api.anthropic.com/v1/messages';

/** Účet, pod kterým Bruno píše. Zakládá ho seed. */
export const BRUNO_EMAIL = 'bruno@mediaspace.cz';

/** Kolik posledních zpráv kanálu dostane k posouzení. */
const KONTEXT_ZPRAV = 14;
/** Kolik svých poznámek si vezme s sebou. */
const KONTEXT_POZNAMEK = 12;

export function jeBrunoNastaveny(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Co Bruno se zpravou udelal. Vraci se volajicimu, aby slo z prohlizece
 * poznat, PROC nic nenapsal - jinak je jeho mlceni nerozeznatelne od poruchy
 * (12. 9. 2026: „Bruno nekomunikuje").
 */
export type VysledekBruna = {
  stav: 'vypnuto' | 'preskoceno' | 'nic' | 'zapsano' | 'odpovedel' | 'chyba';
  duvod?: string;
};

type Rozhodnuti = {
  akce: 'zapis' | 'dotoceno' | 'zruseno' | 'dotaz' | 'nic';
  strana: number | null;
  herec: string | null;
  zprava: string | null;
  poznamka: string | null;
};

/** Vytáhne JSON i z odpovědi, kolem které model něco připsal. */
function vyzobniJson(text: string): unknown {
  const zacatek = text.indexOf('{');
  const konec = text.lastIndexOf('}');
  if (zacatek < 0 || konec <= zacatek) return null;
  try {
    return JSON.parse(text.slice(zacatek, konec + 1));
  } catch {
    return null;
  }
}

function naRozhodnuti(x: unknown): Rozhodnuti | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const akce = o.akce;
  if (
    akce !== 'zapis' &&
    akce !== 'dotoceno' &&
    akce !== 'zruseno' &&
    akce !== 'dotaz' &&
    akce !== 'nic'
  ) {
    return null;
  }

  const strana =
    typeof o.strana === 'number' && Number.isFinite(o.strana) ? Math.round(o.strana) : null;
  return {
    akce,
    strana: strana !== null && strana > 0 && strana < 100_000 ? strana : null,
    herec: typeof o.herec === 'string' && o.herec.trim() ? o.herec.trim() : null,
    zprava: typeof o.zprava === 'string' && o.zprava.trim() ? o.zprava.trim().slice(0, 500) : null,
    poznamka:
      typeof o.poznamka === 'string' && o.poznamka.trim() ? o.poznamka.trim().slice(0, 300) : null,
  };
}

const POKYN = `Jsi Bruno, asistent nahrávacího studia Mediaspace (audioknihy a reklamní spoty).
Čteš interní chat k JEDNOMU projektu a tvůj úkol je vytáhnout z něj údaje, které by jinak
nikdo nikam nezapsal, a doptat se, když si nejsi jistý.

MÁŠ TŘI ÚKOLY: hlídat, KAM SE DOTEKLO NATÁČENÍ, poznat, KDYŽ JE S HERCEM DOTOČENO,
a UMĚT TO VZÍT ZPĚT, když se ukáže, že to tak nebylo.

PRVNÍ ÚKOL — STRANA. Kam se doteklo natáčení, tedy strana ve scénáři/PDF, na které se
ten den skončilo. Lidé to píšou nejrůzněji: "str33", "str.33", "strana 33", "skončili jsme
na 112", nebo jen holé číslo "33". Holé číslo v kanálu projektu skoro vždycky znamená
právě tohle.

KDYŽ MÁ PROJEKT VÍC HERCŮ, musí být jasné, koho se strana týká — každý je jinde.
Jméno bývá ve zprávě ("Petr 33", "33 Štěpán"), nebo vyplyne z předchozích zpráv.
Když to jasné není, ZEPTEJ SE v kanálu a nic nezapisuj. Nikdy nehádej: špatný zápis je
horší než žádný.

Dej pozor na odpovědi na svůj vlastní dotaz — když ses ptal "u koho?" a někdo napsal
"Petr", spoj si to s číslem z předchozí zprávy a zapiš.

DRUHÝ ÚKOL — DOTOČENO. Dotočeno znamená JEDINOU věc: s tím hercem je na tomhle projektu
KONEC, do studia už kvůli němu nepřijde. Jen tehdy je to totéž, jako kdyby někdo
v portálu zmáčkl u herce tlačítko Dotočeno. Akce je "dotoceno". Portál si to zapíše,
a když mají dotočeno všichni herci, sám přehodí stav projektu a dá vědět produkci
i klientovi.

NEJČASTĚJŠÍ OMYL: DOTOČENÁ ČÁST NENÍ DOTOČENÝ HEREC. Ptej se sám sebe, jestli je u toho
slova něco, co pojmenovává KUS PRÁCE — úvod, předmluva, prolog, doslov, kapitola, díl,
stopa, scéna, pasáž, poznámky, dotáčka, reklama, první polovina. Pak je hotová ta část,
ne herec:
- "úvod dotočen" → NENÍ dotočeno, akce "nic"
- "dotočili jsme kapitolu 4" → NENÍ dotočeno, akce "nic"
- "prolog hotový" → NENÍ dotočeno, akce "nic"
- "na dnešek dotočeno", "pro dnešek hotovo" → konec dne, ne konec práce, akce "nic"
Dotočení znamenají teprve věty o CELKU: "dotočeno", "dotočili jsme", "s Petrem hotovo",
"Klára má hotovo", "Petr je hotový, víc ho nepotřebujeme".

Pozor i na to, na co zpráva navazuje. Když se v kanálu zrovna mluvilo o nějaké části
("musíme pak dotočit ten úvod"), pak i holé "dotočeno" mluví nejspíš o TÉ ČÁSTI.

KDYŽ SI NEJSI JISTÝ, JESTLI JDE O CELEK, NEBO JEN O ČÁST, NIC NEZAPISUJ a zeptej se
(akce "dotaz"): "To je dotočené celé, nebo jen ta část?" Zapsané dotočení přehodí stav
projektu a rozešle zprávy produkci i klientovi — a ty se berou zpět mnohem hůř, než se
položí jedna otázka.

Stejné pravidlo jako u strany: u projektu s VÍC HERCI musí být jasné, KOHO se dotočení
týká. Když to ze zprávy ani z předchozích zpráv nevyplývá, akce je "dotaz" a zeptej se
jmenovitě. Nikdy nehádej.

Když ve zprávě je strana i dotočení najednou ("Petr 47, dotočeno"), pošli "dotoceno"
a stranu dej do pole "strana" — zapíše se obojí.

TŘETÍ ÚKOL — OPRAVA. Když z chatu vyplyne, že dotočení neplatí, akce je "zruseno"
a portál fajfku zase sundá.

Nejčastěji tě někdo opraví hned po tvém vlastním zápisu — "ale úvod, ne celá knížka",
"to bylo jen na dnešek", "ještě není dotočeno", "špatně", "zruš to", "to jsem nemyslel".
Tvoje předchozí zprávy v historii poznáš, jsou označené jako od tebe; když těsně nad
opravou stojí tvoje "Zapsal jsem dotočeno", patří ta oprava k ní.

Ruš jen to, co je opravdu zapsané — seznam herců, kteří mají dotočeno, máš níž. Když
v něm nikdo není nebo když ti někdo jen vysvětluje něco jiného, akce je "nic".

Čísla, která stranu NEZNAMENAJÍ: časy (14:30), datumy, počty frekvencí, peníze, čísla
faktur, čísla stop. Když nejde o stranu, akce je "nic".

Odpovídej JEDINÝM objektem JSON, nic jiného — žádný doprovodný text, žádné značky pro kód:
{
  "akce": "zapis" | "dotoceno" | "zruseno" | "dotaz" | "nic",
  "strana": number|null,      // strana, na které se skončilo
  "herec": string|null,       // PŘESNĚ jedno ze jmen v seznamu herců projektu
  "zprava": string|null,      // co napsat do kanálu; u "zapis" krátké potvrzení, u "dotaz" otázka
  "poznamka": string|null     // jedna věta, kterou si chceš zapamatovat do příště; jinak null
}

Jak psát do kanálu:
- Česky, jednou větou, bez patosu a bez emoji. Jsi kolega, ne robot s hlášením.
- U zápisu: "Zapsáno — Petr Štěpán, strana 33." U jednoho herce stačí "Zapsáno, strana 33."
- U dotočení: "Zapsal jsem dotočeno — Petr Štěpán." Když jsi zapsal i stranu, přidej ji.
- U opravy se neomlouvej ani nevysvětluj: "Beru zpět, dotočeno jsem u Petra Štěpána zase sundal." 
- U dotazu se ptej konkrétně a nabídni jména: "U koho jsme skončili — Petr Štěpán, nebo Klára Nováková?"
- U dotazu na dotočení stejně: "S kým je dotočeno — Petr Štěpán, nebo Klára Nováková?"
- Když se nic neděje, akce "nic" a zprava null. Radši mlč, než abys plnil kanál.

Poznámka do paměti je na SOUVISLOSTI, ne na data: zvyklosti lidí ("Martin píše strany
bez slova strana"), rozdělení práce na projektu, kdo za co odpovídá. Neukládej samotná
čísla stran — ta se ukládají zvlášť. Většinou je poznámka null.`;

type Kontext = {
  /** Prazdne = neni to kanal projektu, Bruna nekdo oslovil jinde. */
  caflouProjectId: string | null;
  /** Oslovil ho nekdo jmenem? Pak ma odpovedet vzdycky. */
  oslovenPrimo: boolean;
  /**
   * „Jak to u nas chodi" - psana lidmi v administraci (zadani 16. 9. 2026).
   * Viz lib/brunoPrirucka.ts; dostane ji i mimo kanal projektu, protoze
   * i v soukrome zprave se ho nekdo muze zeptat, jak co u nas funguje.
   */
  prirucka: string;
  nazevProjektu: string | null;
  /**
   * Co portal o projektu vi (zadani 16. 9. 2026). Do ted Bruno videl jen
   * nazev a herce, takze nepoznal audioknihu od reklamy a ptal se na veci,
   * ktere ma portal vyplnene.
   */
  oProjektu: { popisek: string; hodnota: string }[];
  herci: { id: string; jmeno: string }[];
  natoceno: { jmeno: string | null; strana: number }[];
  /** Jmena hercu, kteri uz maji dotoceno - at se Bruno neptá zbytecne. */
  dotoceni: string[];
  poznamky: string[];
  zpravy: { kdo: string; text: string; jeBruno: boolean }[];
};

function sestavDotaz(k: Kontext): string {
  const herci = k.herci.length
    ? k.herci.map((h) => `- ${h.jmeno}`).join('\n')
    : '- (projekt zatím nemá vyplněné herce)';

  const natoceno = k.natoceno.length
    ? k.natoceno.map((n) => `- ${n.jmeno ?? 'nepřiřazeno'}: strana ${n.strana}`).join('\n')
    : '- (zatím nic)';

  // Kdo uz fajfku ma, at se Bruno neptá na neco, co je davno hotove.
  const dotoceni = k.dotoceni.length ? k.dotoceni.map((j) => `- ${j}`).join('\n') : '- (zatím nikdo)';

  const poznamky = k.poznamky.length ? k.poznamky.map((p) => `- ${p}`).join('\n') : '- (zatím nic)';

  const oProjektu = k.oProjektu.length
    ? k.oProjektu.map((u) => `- ${u.popisek}: ${u.hodnota}`).join('\n')
    : '- (portál toho o projektu zatím moc neví)';

  const zpravy = k.zpravy
    .map((z) => `${z.jeBruno ? 'Bruno (ty)' : z.kdo}: ${z.text}`)
    .join('\n');

  if (!k.caflouProjectId) {
    // Mimo kanal projektu nema Bruno co hlidat - jen odpovida tomu, kdo ho
    // oslovil. Zbytek kontextu by ho jen mátl.
    return `JAK TO U NÁS CHODÍ (napsali lidi z Mediaspace — tohle platí, i když si chat říká něco jiného):
${k.prirucka}

Tohle NENÍ kanál projektu, je to ${k.nazevProjektu ? `rozhovor „${k.nazevProjektu}"` : 'soukromá zpráva'}.
Někdo tě oslovil jménem. Odpověz mu.

CO SI PAMATUJEŠ:
${poznamky}

POSLEDNÍ ZPRÁVY (nejstarší nahoře, poslední je ta nová):
${zpravy}

Odpověz JSONem. Zapisovat tu není co (strany se vedou u projektů), takže akce
bude „dotaz" se zprávou do kanálu — odpověz krátce a k věci, a když se tě ptají
na něco, co nevíš, řekni to rovnou.`;
  }

  return `JAK TO U NÁS CHODÍ (napsali lidi z Mediaspace — tohle platí, i když si chat říká něco jiného):
${k.prirucka}

PROJEKT: ${k.nazevProjektu}

CO O PROJEKTU VÍ PORTÁL:
${oProjektu}

HERCI NA PROJEKTU:
${herci}

CO UŽ JE ZAPSANÉ:
${natoceno}

KDO UŽ MÁ DOTOČENO:
${dotoceni}

CO SI PAMATUJEŠ:
${poznamky}

POSLEDNÍ ZPRÁVY V KANÁLU (nejstarší nahoře, poslední je ta nová):
${zpravy}

${k.oslovenPrimo ? '\nV POSLEDNÍ ZPRÁVĚ TĚ NĚKDO OSLOVIL JMÉNEM — odpověz mu vždycky, i kdyby nebylo co zapsat.\n' : ''}
Posuď POSLEDNÍ zprávu a odpověz JSONem.`;
}

/** Posledni potiz s modelem - do odpovedi volajicimu, ne do zpravy v chatu. */
let posledniPotiz: string | null = null;

async function zeptejSeModelu(dotaz: string): Promise<Rozhodnuti | null> {
  const klic = process.env.ANTHROPIC_API_KEY;
  if (!klic) {
    posledniPotiz = 'chybí ANTHROPIC_API_KEY';
    return null;
  }
  posledniPotiz = null;

  const odpoved = await fetch(ADRESA, {
    method: 'POST',
    headers: anthropicHlavicky(klic),
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      system: POKYN,
      messages: [{ role: 'user', content: dotaz }],
    }),
  });

  if (!odpoved.ok) {
    // Telo chyby je od API, ne od uzivatele - da se bezpecne ukazat a je
    // v nem napsane, co presne vadi (spatny model, vycerpany kredit...).
    const proc = await odpoved.text().catch(() => '');
    posledniPotiz = `API ${odpoved.status}: ${proc.slice(0, 300)}`;
    console.error('Bruno: API odpovědělo', odpoved.status, proc.slice(0, 300));
    return null;
  }

  const telo = (await odpoved.json()) as { content?: { type: string; text?: string }[] };
  const napsal = telo.content?.find((c) => c.type === 'text')?.text ?? '';
  const rozhodnuti = naRozhodnuti(vyzobniJson(napsal));
  if (!rozhodnuti) posledniPotiz = `odpověď nešla přečíst: ${napsal.slice(0, 200)}`;
  return rozhodnuti;
}

/** Najde Brunův účet; když ještě není, Bruno nepíše (ale zapisovat umí). */
async function brunoUcet() {
  return prisma.user.findUnique({ where: { email: BRUNO_EMAIL }, select: { id: true } });
}

/**
 * Posoudí novou zprávu v kanálu projektu a případně zapíše nebo se zeptá.
 *
 * Volá se PO uložení zprávy a nikdy nevyhazuje.
 */
export async function brunoZpracujZpravu(messageId: string): Promise<VysledekBruna> {
  try {
    if (!jeBrunoNastaveny()) return { stav: 'vypnuto', duvod: 'chybí ANTHROPIC_API_KEY' };

    const zprava = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        body: true,
        parentId: true,
        userId: true,
        conversationId: true,
        conversation: { select: { kind: true, caflouProjectId: true, name: true } },
      },
    });
    if (!zprava?.conversation) return { stav: 'preskoceno', duvod: 'zpráva se nenašla' };
    if (!zprava.body?.trim()) return { stav: 'preskoceno', duvod: 'prázdná zpráva' };

    const bruno = await brunoUcet();
    if (!bruno) return { stav: 'chyba', duvod: 'Bruno nemá účet (bruno@mediaspace.cz)' };
    // Na vlastní zprávu nereaguje - jinak by si odpovídal donekonečna.
    if (zprava.userId === bruno.id) return { stav: 'preskoceno', duvod: 'vlastní zpráva' };

    /**
     * KDY SE BRUNO VŮBEC ROZMÝŠLÍ (zadání 12. 9. 2026: „umím si představit,
     * že do konverzace zapojím Bruna pomocí @bruno").
     *
     * Buď je to kanál projektu — tam sleduje dění sám od sebe a mlčí, dokud
     * nemá co říct. Nebo ho někdo oslovil jménem; pak odpovídá kdekoliv,
     * i v soukromé zprávě, kde žádný projekt není.
     */
    const oslovenPrimo = jeZminen(zprava.body, 'Bruno', BRUNO_EMAIL);

    /**
     * „CO MÁM DNESKA?" (zadání 23. 9. 2026: „když se ho zeptám v chatu na daný
     * den, tak mi to řekne, co tam mám"). Na otázku na program odpovídá
     * Bruno rovnou z kalendáře - stejným textem jako ranní přehled, bez
     * jazykového modelu, ať na to sednou přesná data.
     */
    if (oslovenPrimo) {
      const den = denZDotazu(zprava.body);
      if (den) {
        const text = await prehledNaDen(zprava.userId, den).catch(() => null);
        if (text) {
          await prisma.message
            .create({
              data: {
                conversationId: zprava.conversationId,
                userId: bruno.id,
                body: text,
                parentId: zprava.parentId ?? zprava.id,
              },
            })
            .then(() =>
              prisma.conversation.update({
                where: { id: zprava.conversationId },
                data: { lastMessageAt: new Date() },
              }),
            )
            .catch((err) => console.error('Bruno: prehled dne se nepodarilo odeslat:', err));
          return { stav: 'odpovedel', duvod: 'přehled dne' };
        }
      }
    }
    const caflouProjectId =
      zprava.conversation.kind === 'PROJEKT' ? zprava.conversation.caflouProjectId : null;
    if (!caflouProjectId && !oslovenPrimo) {
      return { stav: 'preskoceno', duvod: 'není kanál projektu a nikdo mě neoslovil' };
    }

    const [meta, natoceno, dotoceni, poznamky, historie] = await Promise.all([
      caflouProjectId
        ? prisma.projectMeta.findUnique({
            where: { caflouProjectId },
            select: {
              name: true,
              actorUserId: true,
              herci: { select: { id: true, name: true, email: true } },
              // Co portal o projektu vi (zadani 16. 9. 2026) - at se Bruno
              // neptá na vyplnene udaje a pozna audioknihu od reklamy.
              projectType: true,
              statusName: true,
              pageCount: true,
              releaseDate: true,
              companyName: true,
              company: { select: { name: true } },
              manager: { select: { name: true, email: true } },
              klient: { select: { name: true, email: true } },
            },
          })
        : Promise.resolve(null),
      caflouProjectId
        ? prisma.brunoNatoceno.findMany({
            where: { caflouProjectId },
            select: { strana: true, user: { select: { name: true, email: true } } },
          })
        : Promise.resolve([]),
      caflouProjectId
        ? prisma.herecDotocen.findMany({
            where: { caflouProjectId },
            // userId je tu kvuli oprave („zruseno"): kdyz nikdo nejmenuje
            // herce a fajfku ma prave jeden, je jasne, koho sundat.
            select: { userId: true, user: { select: { name: true, email: true } } },
          })
        : Promise.resolve([]),
      prisma.brunoPamet.findMany({
        where: caflouProjectId ? { OR: [{ caflouProjectId }, { caflouProjectId: null }] } : { caflouProjectId: null },
        orderBy: { createdAt: 'desc' },
        take: KONTEXT_POZNAMEK,
        select: { poznamka: true },
      }),
      prisma.message.findMany({
        where: { conversationId: zprava.conversationId },
        orderBy: { createdAt: 'desc' },
        take: KONTEXT_ZPRAV,
        select: {
          id: true,
          body: true,
          userId: true,
          user: { select: { name: true, email: true } },
        },
      }),
    ]);
    if (caflouProjectId && !meta) return { stav: 'preskoceno', duvod: 'projekt není v portálu' };

    // Hlavni herec prvni, at model cte seznam ve stejnem poradi jako clovek.
    const herci = meta
      ? [
          ...meta.herci.filter((h) => h.id === meta.actorUserId),
          ...meta.herci.filter((h) => h.id !== meta.actorUserId),
        ].map((h) => ({ id: h.id, jmeno: bezTitulu(h.name) || h.email }))
      : [];

    /** ID herců, kteří fajfku opravdu mají - podle toho se ruší (viz níž). */
    const dotoceniIds = dotoceni.map((d) => d.userId);

    /**
     * Prirucka „jak to u nas chodi" (zadani 16. 9. 2026). Nacita se ke kazdemu
     * rozhodnuti, at se zmena v administraci projevi hned - je to jeden radek
     * a Bruno stejne ceka na model.
     */
    const prirucka = await nactiPrirucku();

    /** Udaje o projektu do zadani - prazdne se vynechavaji, at to neni seznam pomlcek. */
    const oProjektu: { popisek: string; hodnota: string }[] = [];
    if (meta) {
      const pridej = (popisek: string, hodnota: string | null | undefined) => {
        const t = hodnota?.trim();
        if (t) oProjektu.push({ popisek, hodnota: t });
      };
      pridej('Typ projektu', meta.projectType);
      pridej('Stav', meta.statusName);
      pridej('Firma', meta.company?.name ?? meta.companyName);
      pridej('Klient', meta.klient?.name || meta.klient?.email);
      pridej('Manažer projektu', meta.manager?.name || meta.manager?.email);
      if (meta.pageCount) pridej('Rozsah', `${meta.pageCount} normostran`);
      if (meta.releaseDate) {
        pridej('Vychází', meta.releaseDate.toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague' }));
      }
    }

    const kontext: Kontext = {
      caflouProjectId,
      oslovenPrimo,
      prirucka,
      nazevProjektu: meta?.name || zprava.conversation.name || null,
      oProjektu,
      herci,
      natoceno: natoceno.map((n) => ({
        jmeno: n.user ? n.user.name || n.user.email : null,
        strana: n.strana,
      })),
      dotoceni: dotoceni.map((d) => d.user.name || d.user.email),
      poznamky: poznamky.map((p) => p.poznamka).reverse(),
      zpravy: historie
        .reverse()
        .filter((m) => m.body?.trim())
        .map((m) => ({
          kdo: m.user.name || m.user.email,
          text: m.body.replace(/:ms-[a-z-]+:/g, '').trim().slice(0, 400),
          jeBruno: Boolean(bruno && m.userId === bruno.id),
        })),
    };

    const rozhodnuti = await zeptejSeModelu(sestavDotaz(kontext));
    if (!rozhodnuti) return { stav: 'chyba', duvod: posledniPotiz ?? 'model neodpověděl' };

    if (rozhodnuti.poznamka) {
      await prisma.brunoPamet
        .create({ data: { caflouProjectId: caflouProjectId ?? null, poznamka: rozhodnuti.poznamka } })
        .catch(() => undefined);
    }

    /**
     * Jmeno z odpovedi se musi trefit do seznamu hercu projektu; vymysleneho
     * cloveka do karty nepustime. U projektu s jedinym hercem je jasne, o koho
     * jde, i kdyz ho nikdo nejmenoval.
     */
    const najdiHerce = (): { id: string; jmeno: string } | null => {
      const psany = rozhodnuti.herec;
      const nalezeny = psany
        ? herci.find((h) => h.jmeno.toLowerCase() === psany.toLowerCase()) ??
          herci.find((h) => h.jmeno.toLowerCase().includes(psany.toLowerCase())) ??
          null
        : null;
      return nalezeny ?? (herci.length === 1 ? herci[0] : null);
    };

    /**
     * DOTOCENO (zadani 16. 9. 2026: „ví Bruno, když někdo napíše do chatu
     * dotočeno, že má stisknout tlačítko Dotočeno?"). Dela presne totez co to
     * tlacitko - viz lib/dotoceniServer.ts: fajfka u dvojice projekt + herec,
     * prehozeni stavu, kdyz maji dotoceno vsichni, a zprava produkci.
     *
     * KDYZ NENI JASNE U KOHO, NEZAPISUJE SE NIC a Bruno se misto toho zepta.
     * Model na to ma pokyn, ale tohle je posledni pojistka: u projektu s vic
     * herci bez jmena by fajfka sla nekomu nahodnemu a s ni i prehozeny stav
     * a rozeslane zpravy, ktere se spatne beru zpet.
     */
    if (rozhodnuti.akce === 'dotoceno' && caflouProjectId) {
      const herec = najdiHerce();
      if (!herec) {
        const jmena = herci.map((h) => h.jmeno).join(', ');
        rozhodnuti.zprava =
          rozhodnuti.zprava ??
          (jmena ? `S kým je dotočeno — ${jmena}?` : 'S kým je dotočeno? Projekt nemá vyplněné herce.');
      } else {
        const vysledek = await oznacHerceDotoceno(caflouProjectId, herec.id, {
          id: bruno.id,
          jmeno: 'Bruno (z chatu)',
        }).catch((err) => {
          console.error('Bruno: dotoceno se nepodarilo zapsat:', err);
          return null;
        });

        if (vysledek?.uzMel) {
          rozhodnuti.zprava = rozhodnuti.zprava ?? `${vysledek.jmenoHerce} má dotočeno už zapsané.`;
        } else if (vysledek) {
          await zapisBrunoUdalost({
            caflouProjectId,
            popis: `Dotočeno — ${vysledek.jmenoHerce}.`,
            nova: 'Dotočeno',
          });
        }
      }
    }

    /**
     * OPRAVA (zadani 16. 9. 2026: „zapsal dotoceno, ale tykalo se to neceho
     * jineho. Vzal jen to slovo").
     *
     * Bruno zapsal dotoceno na „uvod dotocen" - slovo sedelo, smysl ne. Kdyz
     * ho nekdo v kanale opravi, musi fajfku umet sundat; do te doby to musel
     * jit odklikat clovek v portalu, a kdyz si toho nikdo nevsiml, zustal
     * projekt prehozeny ve stavu, ve kterem neni.
     *
     * KOHO: bud je jmenovany, nebo ma fajfku prave jeden herec - pak je to
     * bez pochyb on. Jinak se Bruno zepta, stejne jako u zapisu.
     */
    if (rozhodnuti.akce === 'zruseno' && caflouProjectId) {
      const herec = najdiHerce() ?? (dotoceniIds.length === 1
        ? herci.find((h) => h.id === dotoceniIds[0]) ?? null
        : null);

      if (dotoceniIds.length === 0) {
        // Neni co brat zpet - radsi mlcet nez psat do kanalu zmatek.
        rozhodnuti.zprava = null;
      } else if (!herec || !dotoceniIds.includes(herec.id)) {
        const jmena = herci
          .filter((h) => dotoceniIds.includes(h.id))
          .map((h) => h.jmeno)
          .join(', ');
        rozhodnuti.zprava =
          rozhodnuti.zprava ?? (jmena ? `U koho mám dotočeno sundat — ${jmena}?` : null);
      } else {
        await zrusHerceDotoceno(caflouProjectId, herec.id, {
          id: bruno.id,
          jmeno: 'Bruno (z chatu)',
        }).catch((err) => {
          console.error('Bruno: zruseni dotoceni selhalo:', err);
        });

        await zapisBrunoUdalost({
          caflouProjectId,
          popis: `Dotočeno zrušeno — ${herec.jmeno}.`,
          nova: 'Dotočeno zrušeno',
        });

        rozhodnuti.zprava =
          rozhodnuti.zprava ?? `Beru zpět, dotočeno jsem u ${herec.jmeno} zase sundal.`;
      }
    }

    // Zapisovat stranu jde jen u projektu - jinde neni kam. Strana se zapise
    // i u akce "dotoceno", kdyz ji nekdo napsal jednou zpravou s dotocenim.
    if (
      (rozhodnuti.akce === 'zapis' || rozhodnuti.akce === 'dotoceno') &&
      rozhodnuti.strana &&
      caflouProjectId
    ) {
      const herec = najdiHerce();
      const komu = herec?.id ?? null;

      await ulozStranu({
        caflouProjectId,
        userId: komu,
        strana: rozhodnuti.strana,
        zdrojMessageId: zprava.id,
        zapsalUserId: zprava.userId,
      });

      const jmeno = komu ? herci.find((h) => h.id === komu)?.jmeno ?? null : null;
      await zapisBrunoUdalost({
        caflouProjectId,
        popis: jmeno
          ? `Natočeno do strany ${rozhodnuti.strana} — ${jmeno}.`
          : `Natočeno do strany ${rozhodnuti.strana}.`,
        nova: String(rozhodnuti.strana),
      });
    }

    if (rozhodnuti.zprava && bruno) {
      await prisma.message
        .create({
          data: {
            conversationId: zprava.conversationId,
            userId: bruno.id,
            body: rozhodnuti.zprava,
            /**
             * ODPOVÍDÁ VŽDYCKY VE VLÁKNĚ (zadání 14. 9. 2026: „když odpovídá
             * Bruno na zápis normostran, ať odpovídá ve vlákně na odpovědět").
             *
             * Do teď se ve vlákně ozval jen tehdy, když ve vlákně přišla
             * i otázka; na holé „33" napsané do kanálu odpovídal do kanálu.
             * Jenže Bruno se ptá skoro vždycky na něco, co stojí v jedné
             * konkrétní zprávě („u koho?"), a ta dvojice patří k sobě —
             * v proudu kanálu se rozpadla mezi zprávy lidí a nešlo poznat,
             * čeho se ptá.
             *
             * `parentId ?? id`: zpráva ve vlákně má vlákno svoje, zpráva
             * v kanálu ho tímhle zakládá. Nikdy ne `id` napřímo — vlákno ve
             * vlákně chat neumí a odpověď by se ztratila.
             */
            parentId: zprava.parentId ?? zprava.id,
          },
        })
        .then(() =>
          prisma.conversation.update({
            where: { id: zprava.conversationId },
            data: { lastMessageAt: new Date() },
          }),
        )
        .catch((err) => console.error('Bruno: zprávu se nepodařilo odeslat:', err));
    }

    if (rozhodnuti.zprava) return { stav: 'odpovedel', duvod: rozhodnuti.zprava };
    if (
      rozhodnuti.akce === 'zapis' ||
      rozhodnuti.akce === 'dotoceno' ||
      rozhodnuti.akce === 'zruseno'
    ) {
      return { stav: 'zapsano' };
    }
    return { stav: 'nic', duvod: 'model neviděl důvod se ozvat' };
  } catch (err) {
    const hlaska = err instanceof Error ? err.message : 'neznámá chyba';
    console.error('Bruno spadl:', hlaska);
    return { stav: 'chyba', duvod: hlaska };
  }
}

/**
 * Zapíše stranu jako NOVÝ ZÁZNAM (zadání 13. 9. 2026: „v detailu bych to dělal
 * jako záznamy: Datum a strana").
 *
 * Do 13. 9. 2026 byl na dvojici projekt + herec jediný řádek a nový zápis ten
 * starý přepsal. V kartě pak stálo, kde jsme teď, ale ne jak se tam došlo —
 * a přitom právě postup po dnech je to, co produkce sleduje.
 *
 * Stejná strana hned po sobě nový řádek nezaloží: zvukař ji občas napíše
 * dvakrát a ze seznamu by byl výpis omylů.
 */
async function ulozStranu(vstup: {
  caflouProjectId: string;
  userId: string | null;
  strana: number;
  zdrojMessageId: string | null;
  zapsalUserId: string | null;
}): Promise<void> {
  const posledni = await prisma.brunoNatoceno.findFirst({
    where: { caflouProjectId: vstup.caflouProjectId, userId: vstup.userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, strana: true },
  });

  if (posledni?.strana === vstup.strana) {
    await prisma.brunoNatoceno.update({
      where: { id: posledni.id },
      data: { zdrojMessageId: vstup.zdrojMessageId, zapsalUserId: vstup.zapsalUserId },
    });
    return;
  }

  await prisma.brunoNatoceno.create({ data: vstup });
}

/** Všechny zápisy u projektu, od nejnovějšího - pro kartu projektu. */
export async function natoceniProjektu(caflouProjectId: string) {
  return prisma.brunoNatoceno.findMany({
    where: { caflouProjectId },
    orderBy: { createdAt: 'desc' },
    take: 60,
    select: {
      id: true,
      strana: true,
      createdAt: true,
      userId: true,
      user: { select: { name: true, email: true } },
    },
  });
}

/**
 * Poslední strana u každé dvojice projekt + herec. Pro přehled projektů
 * (zadání 13. 9. 2026: „mohlo by se to objevit i v tom přehledu jako malý
 * odznak — jen číslo"), jedním dotazem pro celou stránku.
 *
 * Klíč je `projekt:herec`; zápis bez herce má klíč `projekt:`.
 */
export async function posledniStrany(caflouProjectIds: string[]): Promise<Map<string, number>> {
  if (caflouProjectIds.length === 0) return new Map();

  const radky = await prisma.brunoNatoceno.findMany({
    where: { caflouProjectId: { in: caflouProjectIds } },
    orderBy: { createdAt: 'desc' },
    select: { caflouProjectId: true, userId: true, strana: true },
  });

  // Diky razeni od nejnovejsiho je prvni nalezeny zaznam ten platny.
  const mapa = new Map<string, number>();
  for (const r of radky) {
    const klic = `${r.caflouProjectId}:${r.userId ?? ''}`;
    if (!mapa.has(klic)) mapa.set(klic, r.strana);
  }
  return mapa;
}
