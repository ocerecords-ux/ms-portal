import { anthropicHlavicky } from '@/lib/anthropic';
import { POKYN_PROTI_SPAMU } from '@/lib/prSpam';

/**
 * EMA PIAROVÁ - samotná agentka (zadání 19. 11. 2026).
 *
 * Tenhle soubor umí jednu věc: vzít zadání, podklady kampaně a nechat Emu
 * pracovat. Nic neukládá - zápis do databáze dělá volající (lib/emaServer.ts),
 * aby šel průběh zapisovat postupně a obrazovka viděla, co se děje.
 *
 * HLEDÁ NA WEBU SAMA (volba 19. 11. 2026: „ano, ať hledá sama"). Mediální
 * rešerši nejde dělat z hlavy - pořady se mění, redaktoři odcházejí. Používá
 * se k tomu hledání přímo v Anthropic API (`web_search`), takže portál
 * nepotřebuje žádnou další službu ani klíč navíc.
 *
 * KOLIK HLEDÁNÍ, TOLIK PENĚZ. Proto je strop: `HLEDANI_MAX` na jeden úkol.
 * Když Ema potřebuje víc, radši řekne, co ještě chybí, než aby hledala do
 * nekonečna.
 *
 * Nikdy nevyhazuje: když API mlčí nebo odpoví nesmysl, vrátí se chyba jako
 * text a úkol skončí stavem CHYBA. Rozdělaná kampaň tím nespadne.
 */

const MODEL = process.env.EMA_MODEL || 'claude-sonnet-4-5';
const ADRESA = 'https://api.anthropic.com/v1/messages';
/** Strop hledání na jeden úkol - ať se rešerše nerozjede do nekonečna. */
const HLEDANI_MAX = 12;
/** Kolik kol si Ema může říct o další hledání, než musí odpovědět. */
const KOL_MAX = 8;

export function jeEmaNastavena(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type ZadaniEme = {
  /** Kdo píše - ať ho Ema osloví a ví, komu výstup předkládá. */
  jmeno: string;
  nazevKampane: string;
  /** Brief kampaně: téma, hosté, výjimky („sem nepsat"). */
  brief: string;
  /** Stálé podklady o studiu a tónu komunikace. */
  oStudiu: string;
  /** Co už v kampani je - média a jejich stav, ať nenabízí totéž dvakrát. */
  cojeHotovo: string;
  /** Co jsme nedávno dali na sítě - ať nenabízí to, co už tam je. */
  naSitich?: string;
  /**
   * TRVALÉ POKYNY KE KAMPANI (20. 11. 2026) - co jí člověk jednou řekl
   * o znění a platí to dál („oslovujeme Dobrý den", „tenhle pořad vynech").
   */
  pokyny?: string;
  /**
   * DOSAVADNÍ ROZHOVOR. Bez něj byla každá zpráva první: na „oslovujme Dobrý
   * den" Ema odpověděla pozdravem, protože nevěděla, o čem je řeč.
   */
  historie?: { kdo: 'clovek' | 'ema'; text: string }[];
  /** Samotné zadání od člověka. */
  ukol: string;
};

/**
 * NÁSTROJ, KTERÝM EMA SÁHNE DO PORTÁLU (zadání 19. 11. 2026: „bylo by super,
 * kdyby Ema pracovala i s našimi sociálními sítěmi").
 *
 * Hledání na webu si řeší API samo; tohle jsou NAŠE věci - zapsat médium do
 * kampaně, připravit příspěvek do sekce Sítě. Nic se tím neodesílá ven:
 * všechno vzniká jako rozpracované, ke kontrole.
 */
export type Nastroj = {
  definice: {
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
  };
  /** Udělá to a vrátí krátkou větu zpátky Emě. */
  spust: (vstup: Record<string, unknown>) => Promise<string>;
  /** Co se o tom napíše do průběhu na obrazovce. */
  krok: (vstup: Record<string, unknown>) => string;
};

export type VysledekEmy = {
  text: string;
  hledani: number;
  kroky: string[];
};

/**
 * SYSTÉMOVÝ POKYN. Je to tatáž Ema, jakou má Ondřej v Claude Code
 * (.claude/agents/ema-piarova.md) - jedna osoba, dvě dveře. Když se mění
 * její povaha, mění se na obou místech.
 */
function pokyn(z: ZadaniEme): string {
  return `Jmenuješ se Ema Piarová. Jsi interní agentka pro PR a komunikaci studia
Mediaspace. Píše ti ${z.jmeno}. Mluvíš česky, stručně, civilně a konkrétně.

CO MÁŠ NA STAROSTI: PR a komunikaci celého Mediaspace v Česku i v zahraničí -
audioknihy, zvukové dramatizace, voiceovery, sound design, casting, kampaně
a novinky ze studií. Připravuješ mediální rešerše, nabídky rozhovorů, tiskové
zprávy, podklady pro hosty, příspěvky na sociální sítě a oslovení partnerů.

JAK PRACUJEŠ:
- U mediální rešerše hledej KONKRÉTNÍ pořad, rubriku nebo redaktora. Ke každému
  tipu uveď veřejný kontakt nebo cestu k oslovení, odkaz na zdroj a konkrétní
  důvod, proč se tam téma hodí. Napiš, když je kontakt obecný nebo se jeho
  aktuálnost nepodařilo ověřit.
- Když nabízíš rozhovor s více hosty, vysvětli, co každý z nich přinese.
  Navrhni i ukázku, scénu nebo detail ze zákulisí, který téma zpřístupní.
- První odstavec oslovení má příjemci říct, co mu nabízíme a proč to patří
  právě k němu. Pro britské příjemce piš přirozenou britskou angličtinou.
- Pracuj s doloženými informacemi. Chybí-li citace, termín, dostupnost hosta
  nebo souhlas se zveřejněním, označ to jako ÚDAJ K DOPLNĚNÍ.
- Oslovení médií píšeš SAMA ZA SEBE - jsi Ema Piarová z Mediaspace a mail
  odchází z tvé adresy. PODPIS NEPIŠ: připojí se sám, i s logem a adresami
  studií. Text tedy konči poslední větou, žádné „s pozdravem".
  Ondřeje Černého představuj podle tématu v jeho skutečné roli. V jeho první
  osobě piš, jen když si to vyžádá zadání.
- Nic neodesíláš ani nepublikuješ. Připravuješ hotové návrhy ke kontrole.
- Nevymýšlej si kontakty, citace ani čísla.
- ${POKYN_PROTI_SPAMU}

HLEDÁNÍ: na ověření pořadů a kontaktů máš web. Používej ho cíleně, ne na
každou větu; maximálně ${HLEDANI_MAX} hledání na jeden úkol.

O STUDIU:
${z.oStudiu || '(stálé podklady zatím nejsou vyplněné - vycházej ze zadání)'}

KAMPAŇ „${z.nazevKampane}":
${z.brief || '(brief není vyplněný)'}

CO UŽ V KAMPANI JE:
${z.cojeHotovo || '(zatím nic)'}

CO U NÁS NEDÁVNO BĚŽELO NA SÍTÍCH:
${z.naSitich || '(nevím - účet není připojený nebo je prázdný)'}

TRVALÉ POKYNY KE KAMPANI (drž se jich, i když se o nich zrovna nemluví):
${z.pokyny || '(zatím žádné)'}

KDYŽ TI ŘEKNE, JAK TO MÁ BÝT, UDĚLEJ TO - NEPŘEDNÁŠEJ O TOM. Věta jako
„oslovujme Dobrý den", „tohle je moc dlouhé" nebo „tenhle pořad vynech" není
otázka. Znamená: zapiš si to nástrojem zapamatujPokyn a HNED podle toho přepiš
texty, kterých se to týká - hromadnou předlohu nástrojem nastavHromadnyMail,
mail u konkrétního pořadu nástrojem upravMailMedia. Teprve pak odpověz, a to
jednou dvěma větami, co jsi změnila. Nikdy na takovou větu neodpovídej výkladem
o tom, jak se co píše, ani otázkou, co máš dělat.

KDYŽ SE PTÁŠ NA VÝBĚR, DEJ MU TLAČÍTKA. Místo „Která varianta?" v textu zavolej
nástroj nabidniMoznosti a dej do něj hotové odpovědi (dvě až pět, krátké). Člověk
pak jen klikne a nemusí nic psát. V odpovědi už se potom neptej - jen krátce
řekni, mezi čím vybírá.

NEŘÍKEJ HOTOVO, DOKUD SE NEPŘESVĚDČÍŠ. Po každé úpravě předlohy si ji přečti
nástrojem prectiHromadnyMail a teprve podle TOHO, CO V NÍ OPRAVDU JE, napiš, co
je změněné. Když ti někdo řekne, že tam oprava není, nehádej se a nepřitakávej
naslepo - přečti si předlohu a oprav, co v ní zbylo. Když měníš nějaký výraz,
projdi předmět i celý text; stejné slovo bývá na víc místech.

NÁSTROJE DO PORTÁLU: médium, které chceš do kampaně, rovnou zapiš nástrojem
pridejMedium - ne jen do textu odpovědi. Příspěvek na sítě založ nástrojem
pripravPrispevek; vznikne rozpracovaný v sekci Sítě, nic se neodesílá.
Hotové věci pak v odpovědi jen krátce shrň, neopisuj je celé.

JAK ODPOVÍDÁŠ: obyčejným textem (markdown). Když vracíš seznam médií, dej
každé jako samostatný oddíl s nadpisem, kontaktem, odkazem a důvodem; když
vracíš mail, odděl předmět a tělo. Žádné uvozování typu „tady je, co jsem
připravila" - rovnou věc.`;
}

/**
 * NECHÁ EMU PRACOVAT. `hlasic` dostane každý krok, jakmile nastane, aby se
 * dal průběh ukazovat na obrazovce ještě během běhu.
 */
export async function nechEmuPracovat(
  z: ZadaniEme,
  hlasic?: (krok: string) => Promise<void> | void,
  nastroje: Nastroj[] = [],
): Promise<VysledekEmy> {
  const klic = process.env.ANTHROPIC_API_KEY;
  const kroky: string[] = [];
  const pridej = async (k: string) => {
    kroky.push(k);
    if (hlasic) await hlasic(k);
  };
  if (!klic) return { text: 'Ema teď není k dispozici - chybí klíč k API.', hledani: 0, kroky };

  type Zprava = { role: 'user' | 'assistant'; content: unknown };
  /**
   * ROZHOVOR, NE JEDNOTLIVÉ VZKAZY (20. 11. 2026). Dřív šlo do API jen to
   * poslední, co člověk napsal - takže „oslovujme Dobrý den," dorazilo bez
   * jakékoliv souvislosti a Ema na to odpověděla pozdravem. Teď jde napřed
   * dosavadní rozhovor a nové zadání je jeho pokračování.
   */
  const zpravy: Zprava[] = [
    ...(z.historie ?? []).map((h) => ({
      role: (h.kdo === 'ema' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: h.text,
    })),
    { role: 'user' as const, content: z.ukol },
  ];
  let hledani = 0;

  for (let kolo = 0; kolo < KOL_MAX; kolo += 1) {
    await pridej(kolo === 0 ? 'Promýšlím, kde by to mohlo vyjít.' : 'Čtu, co jsem našla.');

    const odpoved = await fetch(ADRESA, {
      method: 'POST',
      headers: anthropicHlavicky(klic),
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        system: pokyn(z),
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: Math.max(1, HLEDANI_MAX - hledani),
          },
          ...nastroje.map((n) => n.definice),
        ],
        messages: zpravy,
      }),
    }).catch((err) => {
      console.error('Ema: API nedosazitelne:', err);
      return null;
    });

    if (!odpoved) return { text: 'Nepovedlo se mi to spočítat, zkus to prosím znovu.', hledani, kroky };
    if (!odpoved.ok) {
      const proc = await odpoved.text().catch(() => '');
      console.error('Ema: API odpovedelo', odpoved.status, proc.slice(0, 400));
      /**
       * DŮVOD SE UKÁŽE V PORTÁLU (20. 11. 2026). Hláška „nepovedlo se (400)"
       * neřekla nic a důvod zůstal jen v logu Vercelu, kam se při zkoušení
       * nikdo nedívá. Je to naše interní obrazovka, ne něco pro klienty.
       */
      let duvod = '';
      try {
        const telo = JSON.parse(proc) as { error?: { message?: string } };
        duvod = telo.error?.message?.slice(0, 300) ?? '';
      } catch {
        duvod = proc.slice(0, 300);
      }
      return {
        text: `Hledání se nepovedlo (${odpoved.status}).${duvod ? ` ${duvod}` : ''}`,
        hledani,
        kroky,
      };
    }

    const telo = (await odpoved.json().catch(() => null)) as {
      content?: { type: string; text?: string; name?: string; input?: unknown; id?: string }[];
      stop_reason?: string;
    } | null;
    const bloky = telo?.content ?? [];

    // Kolik hledání v tomhle kole proběhlo - jen kvůli počítadlu a průběhu.
    const vHledani = bloky.filter((b) => b.type === 'server_tool_use' && b.name === 'web_search');
    if (vHledani.length > 0) {
      hledani += vHledani.length;
      for (const b of vHledani) {
        const dotaz = (b.input as { query?: string } | undefined)?.query;
        await pridej(dotaz ? `Hledám: ${dotaz}` : 'Hledám na webu.');
      }
    }

    const text = bloky
      .filter((b) => b.type === 'text')
      .map((b) => (b.text ?? '').trim())
      .filter(Boolean)
      .join('\n\n')
      .trim();

    /**
     * Hledání si řeší API samo (server tool) - když tedy přišel text a model
     * neskončil kvůli nástroji, je hotovo. `pause_turn` znamená „pokračuj",
     * tak se zpráva vrátí zpátky a jede se dál.
     */
    if (telo?.stop_reason === 'pause_turn') {
      await pridej('Pokračuju v hledání.');
      zpravy.push({ role: 'assistant', content: bloky });
      continue;
    }

    /**
     * NAŠE NÁSTROJE. Když si o ně Ema řekne, udělají se a výsledek se jí
     * vrátí zpátky jako `tool_result` - teprve pak píše odpověď. Nástroj,
     * který spadne, vrátí větu o tom, co se nepovedlo; běh tím nekončí.
     */
    const volani = bloky.filter((b) => b.type === 'tool_use' && nastroje.some((n) => n.definice.name === b.name));
    if (volani.length > 0) {
      const vysledky: { type: 'tool_result'; tool_use_id: string; content: string }[] = [];
      for (const b of volani) {
        const nastroj = nastroje.find((n) => n.definice.name === b.name);
        if (!nastroj || !b.id) continue;
        const vstup = (b.input ?? {}) as Record<string, unknown>;
        await pridej(nastroj.krok(vstup));
        const odpovedNastroje = await nastroj
          .spust(vstup)
          .catch((err) => {
            console.error('Ema: nastroj selhal:', err);
            return 'Tohle se teď nepovedlo uložit.';
          });
        vysledky.push({ type: 'tool_result', tool_use_id: b.id, content: odpovedNastroje });
      }
      zpravy.push({ role: 'assistant', content: bloky });
      zpravy.push({ role: 'user', content: vysledky });
      continue;
    }
    if (text) {
      await pridej('Píšu návrh a předkládám ho ke kontrole.');
      return { text, hledani, kroky };
    }
    zpravy.push({ role: 'assistant', content: bloky });
  }

  return {
    text: 'Nestihla jsem to dotáhnout do konce - zkus zadání rozdělit na menší kus.',
    hledani,
    kroky,
  };
}
