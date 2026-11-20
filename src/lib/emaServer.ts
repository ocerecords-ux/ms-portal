import { prisma } from '@/lib/db';
import {
  dosadMedium,
  nactiPredlohuMailu,
  ulozPredlohuMailu,
  vlozPredlohuDoMedii,
} from '@/lib/prHromadnyMail';
import { POKYN_PROTI_SPAMU } from '@/lib/prSpam';
import { nechEmuPracovat, type Nastroj, type ZadaniEme } from '@/lib/emaAgent';
import type { Kampan, Medium, StavKampane, StavMedia, StavUkolu, Ukol } from '@/lib/ema';
import { DRUHY_MEDIA } from '@/lib/ema';
import { klicFormatu, nabidkaFormatu } from '@/lib/emaSite';
import { coBezeloNaSitich, zalozNavrhEmy } from '@/lib/emaSiteServer';

/**
 * PR A KOMUNIKACE - práce s databází (zadání 19. 11. 2026).
 *
 * Kampaň, zadání pro Emu a seznam médií. Průběh se zapisuje PRŮBĚŽNĚ, aby
 * obrazovka viděla, co Ema zrovna dělá - ne až když je hotovo.
 *
 * STÁLÉ PODKLADY O STUDIU nepatří do kampaně: platí pro celou firmu, ne pro
 * jednu akci. Leží proto zvlášť (model EmaPodklady), stejně jako Brunova
 * příručka - viz `oStudiu()` níž.
 */

/** Stálé podklady o Mediaspace a tónu komunikace - jeden řádek, jako Brunova příručka. */
export async function oStudiu(): Promise<string> {
  try {
    const z = (await prisma.emaPodklady.findUnique({ where: { id: 'default' } })) as
      | { text: string }
      | null;
    return z?.text ?? '';
  } catch {
    return '';
  }
}

export async function ulozPodklady(text: string): Promise<void> {
  await prisma.emaPodklady
    .upsert({ where: { id: 'default' }, update: { text }, create: { id: 'default', text } })
    .catch((err: unknown) => console.error('Podklady pro Emu se nepodařilo uložit:', err));
}

type RadekKampane = {
  id: string;
  nazev: string;
  brief: string | null;
  stav: string;
  caflouProjectId: string | null;
  predmetMailu: string | null;
  textMailu: string | null;
  pokyny: string | null;
  createdAt: Date;
  _count?: { ukoly: number; media: number };
  media?: { odeslanoAt: Date | null }[];
};

function naKampan(k: RadekKampane): Kampan {
  return {
    id: k.id,
    nazev: k.nazev,
    brief: k.brief,
    stav: (k.stav as StavKampane) ?? 'ROZPRACOVANA',
    caflouProjectId: k.caflouProjectId,
    predmetMailu: k.predmetMailu ?? null,
    textMailu: k.textMailu ?? null,
    pokyny: k.pokyny ?? null,
    createdAt: k.createdAt.toISOString(),
    pocetUkolu: k._count?.ukoly ?? 0,
    pocetMedii: k._count?.media ?? 0,
    pocetOdeslanych: (k.media ?? []).filter((m) => m.odeslanoAt).length,
  };
}

export async function nactiKampane(): Promise<Kampan[]> {
  const radky = (await prisma.prKampan
    .findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { ukoly: true, media: true } }, media: { select: { odeslanoAt: true } } },
    })
    .catch(() => [])) as unknown as RadekKampane[];
  return radky.map(naKampan);
}

export async function nactiKampan(id: string): Promise<Kampan | null> {
  const k = (await prisma.prKampan
    .findUnique({
      where: { id },
      include: { _count: { select: { ukoly: true, media: true } }, media: { select: { odeslanoAt: true } } },
    })
    .catch(() => null)) as unknown as RadekKampane | null;
  return k ? naKampan(k) : null;
}

export async function zalozKampan(nazev: string, brief: string, zalozilId: string): Promise<string | null> {
  try {
    const k = (await prisma.prKampan.create({
      data: { nazev: nazev.trim(), brief: brief.trim() || null, zalozilId },
      select: { id: true },
    })) as { id: string };
    return k.id;
  } catch (err) {
    console.error('Kampaň se nepodařilo založit:', err);
    return null;
  }
}

export async function upravKampan(
  id: string,
  data: { nazev?: string; brief?: string; stav?: StavKampane },
): Promise<void> {
  await prisma.prKampan
    .update({
      where: { id },
      data: {
        ...(data.nazev !== undefined ? { nazev: data.nazev.trim() } : {}),
        ...(data.brief !== undefined ? { brief: data.brief.trim() || null } : {}),
        ...(data.stav !== undefined ? { stav: data.stav } : {}),
      },
    })
    .catch((err: unknown) => console.error('Kampaň se nepodařilo upravit:', err));
}

type RadekUkolu = {
  id: string;
  zadani: string;
  stav: string;
  vystup: string | null;
  chyba: string | null;
  kroky: unknown;
  hledani: number;
  zadalId: string | null;
  createdAt: Date;
  hotovoAt: Date | null;
};

function naUkol(u: RadekUkolu, jmena: Map<string, string>): Ukol {
  return {
    id: u.id,
    zadani: u.zadani,
    stav: (u.stav as StavUkolu) ?? 'CEKA',
    vystup: u.vystup,
    chyba: u.chyba,
    kroky: Array.isArray(u.kroky) ? (u.kroky as string[]) : [],
    hledani: u.hledani ?? 0,
    zadalJmeno: u.zadalId ? (jmena.get(u.zadalId) ?? null) : null,
    createdAt: u.createdAt.toISOString(),
    hotovoAt: u.hotovoAt ? u.hotovoAt.toISOString() : null,
  };
}

export async function nactiUkoly(kampanId: string): Promise<Ukol[]> {
  const radky = (await prisma.prUkol
    .findMany({ where: { kampanId }, orderBy: { createdAt: 'desc' }, take: 50 })
    .catch(() => [])) as unknown as RadekUkolu[];
  const idcka = Array.from(new Set(radky.map((u) => u.zadalId).filter(Boolean))) as string[];
  const lide = idcka.length
    ? ((await prisma.user
        .findMany({ where: { id: { in: idcka } }, select: { id: true, name: true, email: true } })
        .catch(() => [])) as { id: string; name: string | null; email: string }[])
    : [];
  const jmena = new Map(lide.map((l) => [l.id, l.name?.trim() || l.email]));
  return radky.map((u) => naUkol(u, jmena));
}

export async function nactiUkol(id: string): Promise<Ukol | null> {
  const u = (await prisma.prUkol.findUnique({ where: { id } }).catch(() => null)) as unknown as RadekUkolu | null;
  return u ? naUkol(u, new Map()) : null;
}

type RadekMedia = {
  id: string;
  nazev: string;
  druh: string;
  kontakt: string | null;
  odkaz: string | null;
  duvod: string | null;
  overeno: boolean;
  stav: string;
  predmet: string | null;
  textMailu: string | null;
  odeslatAt: Date | null;
  odeslanoAt: Date | null;
  poznamka: string | null;
};

export async function nactiMedia(kampanId: string): Promise<Medium[]> {
  const radky = (await prisma.prMedium
    .findMany({ where: { kampanId }, orderBy: [{ stav: 'asc' }, { nazev: 'asc' }] })
    .catch(() => [])) as unknown as RadekMedia[];
  return radky.map((m) => ({
    id: m.id,
    nazev: m.nazev,
    druh: (m.druh as Medium['druh']) ?? 'JINE',
    kontakt: m.kontakt,
    odkaz: m.odkaz,
    duvod: m.duvod,
    overeno: m.overeno,
    stav: (m.stav as StavMedia) ?? 'NAVRH',
    predmet: m.predmet,
    textMailu: m.textMailu,
    odeslatAt: m.odeslatAt ? m.odeslatAt.toISOString() : null,
    odeslanoAt: m.odeslanoAt ? m.odeslanoAt.toISOString() : null,
    poznamka: m.poznamka,
  }));
}

export async function pridejMedium(kampanId: string, data: Partial<Medium> & { nazev: string }): Promise<void> {
  /**
   * NOVÉ MÉDIUM SI VEZME PŘEDLOHU KAMPANĚ (20. 11. 2026: „chci nastavovat
   * mail hromadně u každé kampaně"). Když se mail nepředává, naplní se
   * z předlohy - jinak by se hromadné nastavení muselo mačkat po každém
   * přidaném pořadu znovu.
   */
  const nazev = data.nazev.trim();
  const predloha = await nactiPredlohuMailu(kampanId);
  const predmet = data.predmet ?? dosadMedium(predloha.predmet, nazev) ?? null;
  const textMailu = data.textMailu ?? dosadMedium(predloha.text, nazev) ?? null;

  await prisma.prMedium
    .create({
      data: {
        kampanId,
        nazev,
        druh: data.druh ?? 'JINE',
        kontakt: data.kontakt ?? null,
        odkaz: data.odkaz ?? null,
        duvod: data.duvod ?? null,
        overeno: data.overeno ?? false,
        predmet: predmet || null,
        textMailu: textMailu || null,
      },
    })
    .catch((err: unknown) => console.error('Médium se nepodařilo přidat:', err));
}

export async function upravMedium(
  id: string,
  data: Partial<Medium>,
  kdoId: string,
): Promise<void> {
  /**
   * ODESLÁNO SE ZAPÍŠE AŽ TEĎ. Portál sám nic neposílá - stav „nabídnuto"
   * odškrtne člověk, až to opravdu pošle, a tím se zapíše kdy a kdo.
   */
  const odeslano = data.stav === 'NABIDNUTO' ? { odeslanoAt: new Date(), odeslalId: kdoId } : {};
  await prisma.prMedium
    .update({
      where: { id },
      data: {
        ...(data.nazev !== undefined ? { nazev: data.nazev.trim() } : {}),
        ...(data.druh !== undefined ? { druh: data.druh } : {}),
        ...(data.kontakt !== undefined ? { kontakt: data.kontakt || null } : {}),
        ...(data.odkaz !== undefined ? { odkaz: data.odkaz || null } : {}),
        ...(data.duvod !== undefined ? { duvod: data.duvod || null } : {}),
        ...(data.stav !== undefined ? { stav: data.stav } : {}),
        ...(data.predmet !== undefined ? { predmet: data.predmet || null } : {}),
        ...(data.textMailu !== undefined ? { textMailu: data.textMailu || null } : {}),
        ...(data.poznamka !== undefined ? { poznamka: data.poznamka || null } : {}),
        ...odeslano,
      },
    })
    .catch((err: unknown) => console.error('Médium se nepodařilo upravit:', err));

  /**
   * VYŠLO = PŘÍLEŽITOST NA SÍTĚ (zadání 19. 11. 2026). Jakmile se u média
   * přehodí stav na „Vyšlo", Ema sama připraví návrh příspěvku, který ten
   * výstup sdílí, a předloží ho ke kontrole v rozhovoru kampaně.
   *
   * JEN JEDNOU ZA MÉDIUM - `prispevekAt` hlídá, že se to neopakuje při každé
   * další úpravě řádku. A bez čekání: úprava stavu nesmí viset na Emě.
   */
  if (data.stav === 'VYSLO') {
    void navrhniPrispevekKVystupu(id, kdoId).catch((err: unknown) =>
      console.error('Navrh prispevku k vystupu selhal:', err),
    );
  }
}

async function navrhniPrispevekKVystupu(mediumId: string, kdoId: string): Promise<void> {
  const medium = (await prisma.prMedium
    .findUnique({
      where: { id: mediumId },
      select: { nazev: true, odkaz: true, kampanId: true, prispevekAt: true },
    })
    .catch(() => null)) as
    | { nazev: string; odkaz: string | null; kampanId: string; prispevekAt: Date | null }
    | null;
  if (!medium || medium.prispevekAt) return;

  await prisma.prMedium
    .update({ where: { id: mediumId }, data: { prispevekAt: new Date() } })
    .catch(() => undefined);

  const kdo = (await prisma.user
    .findUnique({ where: { id: kdoId }, select: { name: true, email: true } })
    .catch(() => null)) as { name: string | null; email: string | null } | null;

  const kam = medium.odkaz ? ` Odkaz na výstup: ${medium.odkaz}` : '';
  await zadejUkol(
    medium.kampanId,
    `Vyšlo to v „${medium.nazev}".${kam} Připrav jeden příspěvek na Instagram a jeden na LinkedIn, kterým to sdílíme - nástrojem pripravPrispevek. Pak mi dvěma větami řekni, co jsi připravila.`,
    { id: kdoId, jmeno: kdo?.name || kdo?.email || 'kolega' },
  );
}

export async function smazMedium(id: string): Promise<void> {
  await prisma.prMedium.delete({ where: { id } }).catch(() => undefined);
}

/**
 * NÁSTROJE, KTERÝMI EMA SÁHNE DO PORTÁLU (zadání 19. 11. 2026).
 *
 * Dva: zapsat médium do kampaně a připravit příspěvek na sítě. Obojí vzniká
 * jako ROZPRACOVANÉ - portál sám nic neodesílá ani nepublikuje. Příspěvek
 * patří tomu, kdo úkol zadal; sekce Sítě je osobní.
 */
function nastrojeEmy(kampanId: string, autorId: string): Nastroj[] {
  return [
    {
      definice: {
        name: 'pridejMedium',
        description:
          'Zapíše pořad, redakci nebo redaktora do seznamu médií téhle kampaně. Použij na každý tip, který navrhuješ - ne jen do textu odpovědi.',
        input_schema: {
          type: 'object',
          properties: {
            nazev: { type: 'string', description: 'Název pořadu nebo redakce.' },
            druh: { type: 'string', enum: [...DRUHY_MEDIA] },
            kontakt: { type: 'string', description: 'Veřejný kontakt nebo cesta k oslovení.' },
            odkaz: { type: 'string', description: 'Odkaz na zdroj, odkud to máš.' },
            duvod: { type: 'string', description: 'Jednou větou, proč se téma hodí právě sem.' },
            overeno: { type: 'boolean', description: 'true jen když je kontakt ověřený a konkrétní.' },
            predmet: { type: 'string', description: 'Navržený předmět mailu.' },
            textMailu: { type: 'string', description: 'Navržený text mailu na míru tomuhle příjemci.' },
          },
          required: ['nazev'],
        },
      },
      krok: (v) => `Zapisuju médium: ${typeof v.nazev === 'string' ? v.nazev : '?'}`,
      spust: async (v) => {
        const nazev = typeof v.nazev === 'string' ? v.nazev.trim() : '';
        if (!nazev) return 'Médium bez názvu zapsat nejde.';
        const druh = typeof v.druh === 'string' && (DRUHY_MEDIA as readonly string[]).includes(v.druh)
          ? (v.druh as Medium['druh'])
          : 'JINE';
        const text = (klic: string) => (typeof v[klic] === 'string' ? (v[klic] as string).trim() : null);
        await pridejMedium(kampanId, {
          nazev,
          druh,
          kontakt: text('kontakt'),
          odkaz: text('odkaz'),
          duvod: text('duvod'),
          overeno: v.overeno === true,
          predmet: text('predmet'),
          textMailu: text('textMailu'),
        });
        return `Zapsáno do kampaně: ${nazev}.`;
      },
    },
    {
      definice: {
        name: 'pripravPrispevek',
        description:
          'Připraví rozpracovaný příspěvek na sítě (Instagram nebo LinkedIn) v sekci Sítě. Ty píšeš texty, grafiku dodělá člověk v editoru. Nic se neodesílá.',
        input_schema: {
          type: 'object',
          properties: {
            format: {
              type: 'string',
              enum: klicFormatu(),
              description: `Formát plátna. ${nabidkaFormatu()}`,
            },
            nazev: { type: 'string', description: 'Krátký pracovní název, podle kterého se příspěvek najde.' },
            nadpis: { type: 'string', description: 'Velký text na obrázku. Pár slov, klidně na dva řádky.' },
            podnadpis: { type: 'string', description: 'Menší text pod nadpisem. Jedna dvě věty.' },
            popisek: { type: 'string', description: 'Text pod příspěvek.' },
            hashtagy: { type: 'string', description: 'Hashtagy oddělené mezerou. Bez přehánění.' },
          },
          required: ['format', 'nazev', 'nadpis'],
        },
      },
      krok: (v) => `Připravuju příspěvek: ${typeof v.nazev === 'string' ? v.nazev : '?'}`,
      spust: async (v) => zalozNavrhEmy(autorId, v),
    },
    /**
     * CO SI MÁ PAMATOVAT (zadání 20. 11. 2026: „ona je úplně blbá. Takhle to
     * nejde"). Na „oslovujme Dobrý den," odpověděla pozdravem a přednáškou
     * o oslovení. Pokyn se teď zapíše ke kampani a jde do každého dalšího
     * zadání - a Ema podle něj rovnou přepíše texty.
     */
    {
      definice: {
        name: 'zapamatujPokyn',
        description:
          'Zapíše trvalý pokyn ke kampani - jak psát, co vynechat, čeho se držet. Použij vždycky, když ti člověk řekne, jak to má být. Pak podle něj rovnou přepiš texty.',
        input_schema: {
          type: 'object',
          properties: {
            pokyn: {
              type: 'string',
              description: 'Jedna věta, jak se to má dělat. Např. „Oslovujeme Dobrý den,".',
            },
          },
          required: ['pokyn'],
        },
      },
      krok: (v) => `Zapisuju si: ${typeof v.pokyn === 'string' ? v.pokyn : '?'}`,
      spust: async (v) => {
        const pokyn = typeof v.pokyn === 'string' ? v.pokyn.trim() : '';
        if (!pokyn) return 'Prázdný pokyn si zapsat nejde.';
        return pridejPokyn(kampanId, pokyn);
      },
    },
    {
      definice: {
        name: 'nastavHromadnyMail',
        description:
          'Přepíše předlohu mailu pro celou kampaň (předmět a text). {medium} v textu se nahradí názvem pořadu. Nic se neodesílá.',
        input_schema: {
          type: 'object',
          properties: {
            predmet: { type: 'string', description: 'Předmět mailu.' },
            text: { type: 'string', description: 'Tělo mailu. Podpis nepiš, připojí se sám.' },
            doMedii: {
              type: 'boolean',
              description: 'true = rovnou vložit i do mailů u médií, která ještě neodešla.',
            },
          },
          required: ['predmet', 'text'],
        },
      },
      krok: () => 'Přepisuju mail pro celou kampaň.',
      spust: async (v) => {
        const predmet = typeof v.predmet === 'string' ? v.predmet : '';
        const text = typeof v.text === 'string' ? v.text : '';
        if (!predmet.trim() && !text.trim()) return 'Prázdnou předlohu uložit nejde.';
        await ulozPredlohuMailu(kampanId, predmet, text);
        if (v.doMedii === false) return 'Předloha uložena.';
        const kolik = await vlozPredlohuDoMedii(kampanId, false);
        return `Předloha uložena a vložena do ${kolik} médií.`;
      },
    },
    {
      definice: {
        name: 'upravMailMedia',
        description:
          'Přepíše mail u JEDNOHO pořadu nebo redakce v téhle kampani. Médium se hledá podle názvu. Odeslané maily se nemění.',
        input_schema: {
          type: 'object',
          properties: {
            nazev: { type: 'string', description: 'Název pořadu nebo redakce, jak je v kampani.' },
            predmet: { type: 'string', description: 'Nový předmět.' },
            text: { type: 'string', description: 'Nový text mailu. Podpis nepiš.' },
          },
          required: ['nazev'],
        },
      },
      krok: (v) => `Upravuju mail: ${typeof v.nazev === 'string' ? v.nazev : '?'}`,
      spust: async (v) => {
        const nazev = typeof v.nazev === 'string' ? v.nazev.trim() : '';
        if (!nazev) return 'Bez názvu média nevím, co upravit.';
        return upravMailPodleNazvu(kampanId, nazev, {
          predmet: typeof v.predmet === 'string' ? v.predmet : undefined,
          textMailu: typeof v.text === 'string' ? v.text : undefined,
        });
      },
    },
  ];
}

/**
 * Přidá trvalý pokyn ke kampani. Řádek po řádku, nic se nepřepisuje - co
 * jednou řekl, platí dál, dokud to sám nezruší v Zadání kampaně.
 */
async function pridejPokyn(kampanId: string, pokyn: string): Promise<string> {
  const kampan = (await prisma.prKampan
    .findUnique({ where: { id: kampanId }, select: { pokyny: true } })
    .catch(() => null)) as { pokyny: string | null } | null;
  const uz = (kampan?.pokyny ?? '').trim();
  const radky = uz ? uz.split('\n') : [];
  if (radky.some((r) => r.trim().toLowerCase() === pokyn.toLowerCase())) {
    return 'Tohle už si pamatuju.';
  }
  radky.push(pokyn);
  await prisma.prKampan
    .update({ where: { id: kampanId }, data: { pokyny: radky.join('\n').slice(0, 4000) } })
    .catch(() => undefined);
  return `Zapsáno: ${pokyn}`;
}

/** Najde médium podle názvu (i částečně) a přepíše u něj mail. */
async function upravMailPodleNazvu(
  kampanId: string,
  nazev: string,
  zmena: { predmet?: string; textMailu?: string },
): Promise<string> {
  const media = (await prisma.prMedium
    .findMany({
      where: { kampanId, odeslanoAt: null },
      select: { id: true, nazev: true },
    })
    .catch(() => [])) as { id: string; nazev: string }[];

  const hledane = nazev.toLowerCase();
  const nalez =
    media.find((m) => m.nazev.toLowerCase() === hledane) ??
    media.find((m) => m.nazev.toLowerCase().includes(hledane));
  if (!nalez) return `Médium „${nazev}" v kampani nenajdu (nebo už odeslalo).`;

  await prisma.prMedium
    .update({
      where: { id: nalez.id },
      data: {
        ...(zmena.predmet !== undefined ? { predmet: zmena.predmet.trim() || null } : {}),
        ...(zmena.textMailu !== undefined ? { textMailu: zmena.textMailu.trim() || null } : {}),
      },
    })
    .catch(() => undefined);
  return `Mail u „${nalez.nazev}" přepsán.`;
}

/**
 * NÁVRH HROMADNÉHO MAILU OD EMY (zadání 20. 11. 2026: „a tady musí být návrh
 * toho mailu, abych ho jen upravil").
 *
 * Prázdné pole je špatný začátek - mail má Ema napsat a člověk ho jen
 * doladit. Nic se tím neukládá: text spadne do polí a uloží se, až ho
 * někdo pošle dál tlačítkem.
 *
 * Běží BEZ NÁSTROJŮ a bez hledání na webu - tohle není rešerše médií, jen
 * jedno zněn, takže není proč platit kola navíc.
 */
export async function navrhniHromadnyMail(
  kampanId: string,
  kdo: { id: string; jmeno: string },
): Promise<{ predmet: string; text: string } | null> {
  const kampan = await nactiKampan(kampanId);
  if (!kampan) return null;

  const media = await nactiMedia(kampanId);
  const souhrn = media.length
    ? media.map((m) => `- ${m.nazev} (${m.druh})`).join('\n')
    : '';

  const ukol = [
    'Napiš NABÍDKOVÝ MAIL, který půjde všem médiím v téhle kampani.',
    'Místo názvu konkrétního pořadu piš do textu značku {medium} - portál ji',
    'nahradí názvem pořadu nebo redakce.',
    '',
    'Vrať JEDINÝ objekt JSON, nic jiného, bez značek pro kód:',
    '{"predmet": "...", "text": "..."}',
    '',
    'Pravidla:',
    '- Předmět krátký a konkrétní, ať se pozná, o co jde, i v přeplněné schránce.',
    '- Text čtyři až šest vět: co nabízíme, proč je to pro jejich posluchače',
    '  zajímavé a co od nich chceme.',
    '- Česky, vykat, bez superlativů a bez marketingových frází.',
    '- PODPIS NEPIŠ - připojí se sám. Nepiš ani oslovení s konkrétním jménem.',
    '- V textu nic nevymýšlej, drž se briefu kampaně.',
    `- ${POKYN_PROTI_SPAMU}`,
  ].join('\n');

  const pokyny = (
    (await prisma.prKampan
      .findUnique({ where: { id: kampanId }, select: { pokyny: true } })
      .catch(() => null)) as { pokyny: string | null } | null
  )?.pokyny;

  const zadaniEme: ZadaniEme = {
    jmeno: kdo.jmeno,
    nazevKampane: kampan.nazev,
    brief: kampan.brief ?? '',
    oStudiu: await oStudiu(),
    cojeHotovo: souhrn,
    pokyny: pokyny ?? '',
    ukol,
  };

  const vysledek = await nechEmuPracovat(zadaniEme).catch((err) => {
    console.error('Ema nenapsala hromadný mail:', err);
    return null;
  });
  if (!vysledek) return null;

  const zacatek = vysledek.text.indexOf('{');
  const konec = vysledek.text.lastIndexOf('}');
  if (zacatek < 0 || konec <= zacatek) return null;
  try {
    const data = JSON.parse(vysledek.text.slice(zacatek, konec + 1)) as {
      predmet?: unknown;
      text?: unknown;
    };
    return {
      predmet: typeof data.predmet === 'string' ? data.predmet.trim().slice(0, 300) : '',
      text: typeof data.text === 'string' ? data.text.trim().slice(0, 8000) : '',
    };
  } catch {
    return null;
  }
}

/**
 * ZADÁ ÚKOL EMĚ A NECHÁ JI PRACOVAT.
 *
 * Záznam vznikne hned (stav BEZI), takže obrazovka má co ukazovat, a průběh
 * se do něj zapisuje po krocích. Výsledek se uloží na konci.
 */
export async function zadejUkol(
  kampanId: string,
  zadani: string,
  kdo: { id: string; jmeno: string },
): Promise<string | null> {
  const kampan = await nactiKampan(kampanId);
  if (!kampan) return null;

  const ukol = (await prisma.prUkol
    .create({
      /**
       * PRVNÍ KROK SE ZAPÍŠE HNED (zadání 19. 11. 2026: „potřeboval bych
       * nějaké reakce od Emy hned, jak vložím první zadání"). Než se načtou
       * podklady a odpoví API, uběhne klidně minuta - a po tu dobu musí být
       * na obrazovce vidět, že se něco děje.
       */
      data: {
        kampanId,
        zadani: zadani.trim(),
        stav: 'BEZI',
        zadalId: kdo.id,
        kroky: ['Beru si zadání a čtu, co o kampani víme.'],
      },
      select: { id: true },
    })
    .catch(() => null)) as { id: string } | null;
  if (!ukol) return null;

  const media = await nactiMedia(kampanId);
  const souhrn = media.length
    ? media
        .map((m) => `- ${m.nazev} (${m.druh}, stav ${m.stav})${m.kontakt ? ` - ${m.kontakt}` : ''}`)
        .join('\n')
    : '';

  /**
   * DOSAVADNÍ ROZHOVOR (20. 11. 2026: „ona je úplně blbá. Takhle to nejde").
   *
   * Do API šlo jen poslední zadání, takže každá věta byla první: na
   * „oslovujme Dobrý den," Ema odpověděla pozdravem, protože netušila, o čem
   * je řeč. Teď dostane posledních pár výměn - a trvalé pokyny ke kampani,
   * které platí dál, i když se o nich zrovna nemluví.
   */
  const predchozi = (await prisma.prUkol
    .findMany({
      where: { kampanId, NOT: { id: ukol.id } },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { zadani: true, vystup: true },
    })
    .catch(() => [])) as { zadani: string; vystup: string | null }[];

  const historie: { kdo: 'clovek' | 'ema'; text: string }[] = [];
  for (const p of predchozi.reverse()) {
    historie.push({ kdo: 'clovek', text: p.zadani });
    if (p.vystup?.trim()) historie.push({ kdo: 'ema', text: p.vystup });
  }

  const pokyny = (
    (await prisma.prKampan
      .findUnique({ where: { id: kampanId }, select: { pokyny: true } })
      .catch(() => null)) as { pokyny: string | null } | null
  )?.pokyny;

  const zadaniEme: ZadaniEme = {
    jmeno: kdo.jmeno,
    nazevKampane: kampan.nazev,
    brief: kampan.brief ?? '',
    oStudiu: await oStudiu(),
    cojeHotovo: souhrn,
    naSitich: await coBezeloNaSitich(),
    pokyny: pokyny ?? '',
    historie,
    ukol: zadani.trim(),
  };

  const kroky: string[] = ['Beru si zadání a čtu, co o kampani víme.'];
  const vysledek = await nechEmuPracovat(
    zadaniEme,
    async (krok) => {
      kroky.push(krok);
      await prisma.prUkol.update({ where: { id: ukol.id }, data: { kroky } }).catch(() => undefined);
    },
    nastrojeEmy(kampanId, kdo.id),
  ).catch((err) => {
    console.error('Ema spadla:', err);
    return null;
  });

  if (!vysledek) {
    await prisma.prUkol
      .update({ where: { id: ukol.id }, data: { stav: 'CHYBA', chyba: 'Nepovedlo se to spočítat.', hotovoAt: new Date() } })
      .catch(() => undefined);
    return ukol.id;
  }

  await prisma.prUkol
    .update({
      where: { id: ukol.id },
      data: {
        stav: 'HOTOVO',
        vystup: vysledek.text,
        hledani: vysledek.hledani,
        kroky: vysledek.kroky,
        hotovoAt: new Date(),
      },
    })
    .catch(() => undefined);
  return ukol.id;
}
