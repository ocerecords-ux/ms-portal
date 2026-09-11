import { prisma } from '@/lib/db';
import { zapisBrunoUdalost } from '@/lib/projektLogServer';

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

type Rozhodnuti = {
  akce: 'zapis' | 'dotaz' | 'nic';
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
  if (akce !== 'zapis' && akce !== 'dotaz' && akce !== 'nic') return null;

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

DNEŠNÍ ÚKOL: hlídat, KAM SE DOTEKLO NATÁČENÍ — tedy stranu ve scénáři/PDF, na které se
ten den skončilo. Lidé to píšou nejrůzněji: "str33", "str.33", "strana 33", "skončili jsme
na 112", nebo jen holé číslo "33". Holé číslo v kanálu projektu skoro vždycky znamená
právě tohle.

KDYŽ MÁ PROJEKT VÍC HERCŮ, musí být jasné, koho se strana týká — každý je jinde.
Jméno bývá ve zprávě ("Petr 33", "33 Štěpán"), nebo vyplyne z předchozích zpráv.
Když to jasné není, ZEPTEJ SE v kanálu a nic nezapisuj. Nikdy nehádej: špatný zápis je
horší než žádný.

Dej pozor na odpovědi na svůj vlastní dotaz — když ses ptal "u koho?" a někdo napsal
"Petr", spoj si to s číslem z předchozí zprávy a zapiš.

Čísla, která stranu NEZNAMENAJÍ: časy (14:30), datumy, počty frekvencí, peníze, čísla
faktur, čísla stop. Když nejde o stranu, akce je "nic".

Odpovídej JEDINÝM objektem JSON, nic jiného — žádný doprovodný text, žádné značky pro kód:
{
  "akce": "zapis" | "dotaz" | "nic",
  "strana": number|null,      // strana, na které se skončilo
  "herec": string|null,       // PŘESNĚ jedno ze jmen v seznamu herců projektu
  "zprava": string|null,      // co napsat do kanálu; u "zapis" krátké potvrzení, u "dotaz" otázka
  "poznamka": string|null     // jedna věta, kterou si chceš zapamatovat do příště; jinak null
}

Jak psát do kanálu:
- Česky, jednou větou, bez patosu a bez emoji. Jsi kolega, ne robot s hlášením.
- U zápisu: "Zapsáno — Petr Štěpán, strana 33." U jednoho herce stačí "Zapsáno, strana 33."
- U dotazu se ptej konkrétně a nabídni jména: "U koho jsme skončili — Petr Štěpán, nebo Klára Nováková?"
- Když se nic neděje, akce "nic" a zprava null. Radši mlč, než abys plnil kanál.

Poznámka do paměti je na SOUVISLOSTI, ne na data: zvyklosti lidí ("Martin píše strany
bez slova strana"), rozdělení práce na projektu, kdo za co odpovídá. Neukládej samotná
čísla stran — ta se ukládají zvlášť. Většinou je poznámka null.`;

type Kontext = {
  caflouProjectId: string;
  nazevProjektu: string;
  herci: { id: string; jmeno: string }[];
  natoceno: { jmeno: string | null; strana: number }[];
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

  const poznamky = k.poznamky.length ? k.poznamky.map((p) => `- ${p}`).join('\n') : '- (zatím nic)';

  const zpravy = k.zpravy
    .map((z) => `${z.jeBruno ? 'Bruno (ty)' : z.kdo}: ${z.text}`)
    .join('\n');

  return `PROJEKT: ${k.nazevProjektu}

HERCI NA PROJEKTU:
${herci}

CO UŽ JE ZAPSANÉ:
${natoceno}

CO SI PAMATUJEŠ:
${poznamky}

POSLEDNÍ ZPRÁVY V KANÁLU (nejstarší nahoře, poslední je ta nová):
${zpravy}

Posuď POSLEDNÍ zprávu a odpověz JSONem.`;
}

async function zeptejSeModelu(dotaz: string): Promise<Rozhodnuti | null> {
  const klic = process.env.ANTHROPIC_API_KEY;
  if (!klic) return null;

  const odpoved = await fetch(ADRESA, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': klic,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      system: POKYN,
      messages: [{ role: 'user', content: dotaz }],
    }),
  });

  if (!odpoved.ok) {
    console.error('Bruno: API odpovědělo', odpoved.status);
    return null;
  }

  const telo = (await odpoved.json()) as { content?: { type: string; text?: string }[] };
  const napsal = telo.content?.find((c) => c.type === 'text')?.text ?? '';
  return naRozhodnuti(vyzobniJson(napsal));
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
export async function brunoZpracujZpravu(messageId: string): Promise<void> {
  try {
    if (!jeBrunoNastaveny()) return;

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
    if (!zprava?.conversation?.caflouProjectId) return;
    if (zprava.conversation.kind !== 'PROJEKT') return;

    const bruno = await brunoUcet();
    // Na vlastní zprávu nereaguje - jinak by si odpovídal donekonečna.
    if (bruno && zprava.userId === bruno.id) return;
    if (!zprava.body?.trim()) return;

    const caflouProjectId = zprava.conversation.caflouProjectId;

    const [meta, natoceno, poznamky, historie] = await Promise.all([
      prisma.projectMeta.findUnique({
        where: { caflouProjectId },
        select: {
          name: true,
          actorUserId: true,
          herci: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.brunoNatoceno.findMany({
        where: { caflouProjectId },
        select: { strana: true, user: { select: { name: true, email: true } } },
      }),
      prisma.brunoPamet.findMany({
        where: { OR: [{ caflouProjectId }, { caflouProjectId: null }] },
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
    if (!meta) return;

    // Hlavni herec prvni, at model cte seznam ve stejnem poradi jako clovek.
    const herci = [
      ...meta.herci.filter((h) => h.id === meta.actorUserId),
      ...meta.herci.filter((h) => h.id !== meta.actorUserId),
    ].map((h) => ({ id: h.id, jmeno: h.name || h.email }));

    const kontext: Kontext = {
      caflouProjectId,
      nazevProjektu: meta.name || zprava.conversation.name || 'Projekt',
      herci,
      natoceno: natoceno.map((n) => ({
        jmeno: n.user ? n.user.name || n.user.email : null,
        strana: n.strana,
      })),
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
    if (!rozhodnuti) return;

    if (rozhodnuti.poznamka) {
      await prisma.brunoPamet
        .create({ data: { caflouProjectId, poznamka: rozhodnuti.poznamka } })
        .catch(() => undefined);
    }

    if (rozhodnuti.akce === 'zapis' && rozhodnuti.strana) {
      // Jmeno z odpovedi se musi trefit do seznamu hercu projektu; kdyz ne,
      // zapise se bez herce - vymysleneho cloveka do karty nepustime.
      const herec = rozhodnuti.herec
        ? herci.find((h) => h.jmeno.toLowerCase() === rozhodnuti.herec!.toLowerCase()) ??
          herci.find((h) =>
            h.jmeno.toLowerCase().includes(rozhodnuti.herec!.toLowerCase()),
          ) ??
          null
        : null;
      // U projektu s jedinym hercem je jasne, o koho jde, i kdyz ho nikdo nejmenoval.
      const komu = herec?.id ?? (herci.length === 1 ? herci[0].id : null);

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
            // Odpovida tam, kde se mluvi - ve vlakne, kdyz zprava prisla ve vlakne.
            parentId: zprava.parentId,
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
  } catch (err) {
    console.error('Bruno spadl:', err instanceof Error ? err.message : 'neznámá chyba');
  }
}

/**
 * Zapíše stranu. Jeden řádek na dvojici projekt + herec, takže nový zápis
 * ten předchozí přepíše — v kartě má stát, kde jsme TEĎ, ne seznam pokusů.
 * Historie zůstává v událostech projektu.
 */
async function ulozStranu(vstup: {
  caflouProjectId: string;
  userId: string | null;
  strana: number;
  zdrojMessageId: string | null;
  zapsalUserId: string | null;
}): Promise<void> {
  const stavajici = await prisma.brunoNatoceno.findFirst({
    where: { caflouProjectId: vstup.caflouProjectId, userId: vstup.userId },
    select: { id: true },
  });

  if (stavajici) {
    await prisma.brunoNatoceno.update({
      where: { id: stavajici.id },
      data: {
        strana: vstup.strana,
        zdrojMessageId: vstup.zdrojMessageId,
        zapsalUserId: vstup.zapsalUserId,
      },
    });
    return;
  }

  await prisma.brunoNatoceno.create({ data: vstup });
}

/** Co má Bruno u projektu zapsané - pro kartu projektu. */
export async function natoceniProjektu(caflouProjectId: string) {
  return prisma.brunoNatoceno.findMany({
    where: { caflouProjectId },
    orderBy: { updatedAt: 'desc' },
    select: {
      strana: true,
      updatedAt: true,
      userId: true,
      user: { select: { name: true, email: true } },
    },
  });
}
