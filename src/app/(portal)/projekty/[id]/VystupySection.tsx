'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KresbaIkony, tridaBarvyIkony } from '@/lib/ikonyTypu';
import { usePreklad } from '../../components/JazykProvider';
import { VyberVOkne } from '../VyberVOkne';
import {
  NABIZENE_DOWNCUTY,
  delkaNaText,
  priponaNazvu,
  serad,
  textNaDelku,
  zakladNazvu,
  type VystupData,
} from '@/lib/vystupy';

/**
 * ZÁLOŽKA „VÝSTUPY" (zadání 26. 9. 2026: „u jednoho projektu máme více
 * výstupů… u Strabagu jsme teď dělali 4 různé délky a v každém spotu jiní
 * herci. Nebo děláme pod jedním projektem 5 různých rádiových spotů").
 *
 * VŠECHNO NA JEDNOM ŘÁDKU (upřesnění téhož dne: „chtěl bych toto všechno mít
 * na jednom řádku. Název, herce, délku… a licenci"). Výstup se nerozklepává
 * do formuláře - řádek JE formulář: název, herci, délka, licence a vpravo
 * tečky s tím, co se s výstupem dá udělat. Čtyři délky Strabagu jsou tak
 * čtyři řádky pod sebou a je vidět, čím se od sebe liší.
 *
 * HERCI A LICENCE SE VYBÍRAJÍ V MALÉM OKNĚ. Čtrnáct jmen vedle sebe by na
 * řádek nikdy nevešlo; tlačítko ukáže, kolik jich je, a okno se otevře, až
 * když se mění. Stejné okno jako u herců v Interních údajích.
 *
 * DOWNCUT JE PODŘÁDEK, NE ROVNOCENNÁ POLOŽKA. Zadá se zaškrtnutím délky
 * a všechno ostatní dědí po hlavním spotu - proto u něj prázdné pole
 * neznamená „nevyplněno", ale „stejné jako u hlavního".
 */

export type HerecVolba = { id: string; name: string };
export type LicenceVolba = { id: string; nazev: string; ikona: string | null };
export type TypVolba = { nazev: string; rodnyList: boolean };
/** Vyrobený rodný list; `vystupId` prázdné má jen starší dokument z doby před výstupy. */
export type RodnyListRadek = {
  id: string;
  vystupId: string | null;
  version: number;
  fileName: string;
  driveUrl: string | null;
};

/** Šířka vyskakovacích oken; drží se i při počítání, ať nevylezou z obrazovky. */
const SIRKA_OKNA = 240;

export function VystupySection({
  caflouProjectId,
  canEdit,
  vystupy: vychozi,
  herci,
  druhyLicence,
  typy,
  rodneListy,
  muzeNabidku,
  nazevProjektu,
  nataceniUrl: vychoziNataceni,
}: {
  caflouProjectId: string;
  canEdit: boolean;
  vystupy: VystupData[];
  /** Vyrobené rodné listy - u každého výstupu vlastní řada verzí. */
  rodneListy: RodnyListRadek[];
  /** Smí ten, kdo se dívá, založit z výstupů nabídku? (vidí doklady) */
  muzeNabidku: boolean;
  /** Herci projektu - ve výstupu se z nich jen vybírá, nezadávají se znovu. */
  herci: HerecVolba[];
  druhyLicence: LicenceVolba[];
  /** Typy z ceníku; `rodnyList` říká, ke kterému výstupu se dělá RL. */
  typy: TypVolba[];
  nazevProjektu: string;
  /** Odkaz na poslední natáčecí text na Disku, když už nějaký vznikl. */
  nataceniUrl: string | null;
}) {
  const t = usePreklad();
  const router = useRouter();
  const [vystupy, setVystupy] = useState<VystupData[]>(vychozi);
  const [pracuje, setPracuje] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [nabidka, setNabidka] = useState<{ id: string; number: string } | null>(null);
  const [nataceni, setNataceni] = useState<string | null>(vychoziNataceni);
  /**
   * Počítadlo do adresy náhledu. Rámeček má pro prohlížeč pořád tutéž adresu,
   * takže by po uložení výstupu ukazoval starý list z paměti.
   */
  const [verzeNahledu, setVerzeNahledu] = useState(0);
  /** Náhled přes celou obrazovku (26. 9. 2026: „po kliknutí na ten dokument
   *  bych chtěl získat větší náhled"). */
  const [velkyNahled, setVelkyNahled] = useState(false);

  useEffect(() => {
    if (!velkyNahled) return;
    const zavri = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVelkyNahled(false);
    };
    window.addEventListener('keydown', zavri);
    return () => window.removeEventListener('keydown', zavri);
  }, [velkyNahled]);

  const razene = useMemo(() => serad(vystupy), [vystupy]);
  const podleId = useMemo(() => new Map(vystupy.map((v) => [v.id, v])), [vystupy]);
  /** Rodné listy po výstupech, nejnovější verze první. */
  const rlPodleVystupu = useMemo(() => {
    const m = new Map<string, RodnyListRadek[]>();
    for (const rl of rodneListy) {
      if (!rl.vystupId) continue;
      m.set(rl.vystupId, [...(m.get(rl.vystupId) ?? []), rl]);
    }
    for (const seznam of m.values()) seznam.sort((a, b) => b.version - a.version);
    return m;
  }, [rodneListy]);

  async function zavolej(url: string, init: RequestInit): Promise<Record<string, unknown> | null> {
    setPracuje(true);
    setChyba(null);
    try {
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba((data as { error?: string })?.error || t('vystupy.chybaUlozeni'));
        return null;
      }
      return data as Record<string, unknown>;
    } catch {
      setChyba(t('vystupy.chybaUlozeni'));
      return null;
    } finally {
      setPracuje(false);
    }
  }

  async function pridej(vstup: Record<string, unknown>) {
    const data = await zavolej(`/api/projects/${encodeURIComponent(caflouProjectId)}/vystupy`, {
      method: 'POST',
      body: JSON.stringify(vstup),
    });
    const novy = data?.vystup as VystupData | undefined;
    if (!novy) return;
    setVystupy((s) => [...s, novy]);
    setVerzeNahledu((n) => n + 1);
    router.refresh();
  }

  async function uloz(id: string, zmena: Record<string, unknown>) {
    const data = await zavolej(
      `/api/projects/${encodeURIComponent(caflouProjectId)}/vystupy/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(zmena) },
    );
    const upraveny = data?.vystup as VystupData | undefined;
    if (!upraveny) return;
    setVystupy((s) => s.map((v) => (v.id === id ? upraveny : v)));
    setVerzeNahledu((n) => n + 1);
    router.refresh();
  }

  /**
   * NABÍDKA Z VÝSTUPŮ (26. 9. 2026) - jedna položka za výstup. Ceny se doplní
   * jen tam, kde je zná ceník; ten se na reklamy teprve dodělává.
   */
  async function zalozNabidku() {
    const data = await zavolej(`/api/projects/${encodeURIComponent(caflouProjectId)}/vystupy/nabidka`, {
      method: 'POST',
    });
    if (!data) return;
    setNabidka({ id: String(data.id), number: String(data.number) });
    router.refresh();
  }

  /**
   * NATÁČECÍ TEXT (26. 9. 2026: „měli bychom nějaké vzory pro natáčení, kde by
   * bylo jasně označené, jak se spot jmenuje a jakou má délku a pro jakou
   * licenci. Ukládalo by se to do editovatelného dokumentu na disku ve složce
   * projektu").
   *
   * Vzniká VŽDYCKY NOVÝ dokument - do rozepsaného textu portál nesahá.
   */
  async function vyrobNataceciText() {
    const data = await zavolej(
      `/api/projects/${encodeURIComponent(caflouProjectId)}/nataceni-text`,
      { method: 'POST', body: JSON.stringify({}) },
    );
    if (!data) return;
    const url = String(data.url);
    setNataceni(url);
    window.open(url, '_blank', 'noopener,noreferrer');
    router.refresh();
  }

  async function vyrobRL(vystupId: string) {
    const data = await zavolej(
      `/api/projects/${encodeURIComponent(caflouProjectId)}/vystupy/${encodeURIComponent(vystupId)}/rodny-list`,
      { method: 'POST' },
    );
    if (!data) return;
    router.refresh();
  }

  async function smaz(id: string) {
    const data = await zavolej(
      `/api/projects/${encodeURIComponent(caflouProjectId)}/vystupy/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
    if (!data) return;
    setVystupy((s) => s.filter((v) => v.id !== id));
    setVerzeNahledu((n) => n + 1);
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="font-display text-2xl text-ink m-0">{t('vystupy.nadpis')}</h2>
        {/* Kolik jich pod projektem je (27. 9. 2026: „ať mi ještě svítí
            nějaké číslo nahoře, kolik těch výstupů přesně je"). Počítají se
            i zkrácené verze - odevzdává se každá zvlášť. */}
        {razene.length > 0 && (
          <span
            title={t(
              razene.length === 1
                ? 'vystupy.pocet1'
                : razene.length < 5
                  ? 'vystupy.pocet234'
                  : 'vystupy.pocet5',
              { pocet: razene.length },
            )}
            className="shrink-0 grid place-items-center min-w-[28px] h-7 px-2 rounded-pill bg-brand-purple/15 border border-brand-purple/40 text-brand-purpleDeep dark:text-brand-purpleLight font-heading font-semibold text-sm tabular-nums"
          >
            {razene.length}
          </span>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => pridej({ nazev: nazevProjektu || 'Výstup' })}
            disabled={pracuje}
            title={t('vystupy.pridatVystup')}
            aria-label={t('vystupy.pridatVystup')}
            className="w-8 h-8 shrink-0 grid place-items-center rounded-full border border-line text-muted text-xl leading-none bg-surface hover:text-brand-purple hover:border-brand-purple transition-colors cursor-pointer disabled:opacity-50"
          >
            +
          </button>
        )}
        {canEdit && razene.length > 0 && (
          <button
            type="button"
            onClick={vyrobNataceciText}
            disabled={pracuje}
            title={t('vystupy.nataceciTextNapoveda')}
            className="ml-auto rounded-pill border border-line text-muted font-heading font-semibold text-sm px-4 py-1.5 bg-surface hover:text-brand-purple hover:border-brand-purple transition-colors cursor-pointer disabled:opacity-50"
          >
            {t('vystupy.nataceciText')}
          </button>
        )}
        {nataceni && (
          <a
            href={nataceni}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-pill border border-line text-brand-purple font-heading font-semibold text-sm px-4 py-1.5 bg-surface no-underline hover:border-brand-purple transition-colors"
          >
            {t('vystupy.otevritNataceciText')}
          </a>
        )}
        {muzeNabidku && razene.length > 0 && (
          <button
            type="button"
            onClick={zalozNabidku}
            disabled={pracuje}
            title={t('vystupy.nabidkaNapoveda')}
            className="rounded-pill border border-line text-muted font-heading font-semibold text-sm px-4 py-1.5 bg-surface hover:text-brand-purple hover:border-brand-purple transition-colors cursor-pointer disabled:opacity-50"
          >
            {t('vystupy.nabidkaZVystupu')}
          </button>
        )}
      </div>

      {nabidka && (
        <p className="text-sm font-body text-ink m-0 rounded-card border border-line bg-field/40 px-4 py-3">
          {t('vystupy.nabidkaZalozena', { cislo: nabidka.number })}{' '}
          <a
            href={`/admin/doklady/nabidky/${nabidka.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-heading text-brand-purple no-underline hover:underline"
          >
            {t('vystupy.otevritNabidku')}
          </a>
        </p>
      )}

      {/* VLEVO SE VYPLŇUJE, VPRAVO JE VIDĚT VÝSLEDEK (zadání 26. 9. 2026:
          „ať se to bude doplňovat do polí vlevo a ten náhled celého dokumentu
          bude vpravo"). Náhled drží krok s řádky, takže je při zadávání
          rovnou vidět, jak list vypadá. Na užší obrazovce jdou pod sebe. */}
      <div className="grid grid-cols-1 min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(0,480px)] gap-5 items-start">
        {/* Vysvětlivka tu nebyla potřeba (26. 9. 2026: „dej pryč ten popis
            s vysvětlivkou") - co který sloupec znamená, je v Nápovědě. */}
        <div className="flex flex-col gap-3 min-w-0">
          {chyba && (
            <p className="text-sm font-body text-status-error m-0" role="alert">
              {chyba}
            </p>
          )}

          {razene.length === 0 ? (
            <p className="text-sm font-body text-muted m-0">
              {t(canEdit ? 'vystupy.zadnyVystupPridejte' : 'vystupy.zadnyVystup')}
            </p>
          ) : (
            <ul className="list-none p-0 m-0 flex flex-col gap-2">
              {razene.map((v) => (
                <VystupRadek
                  key={v.id}
                  vystup={v}
                  rodic={v.odvozenoZId ? podleId.get(v.odvozenoZId) ?? null : null}
                  canEdit={canEdit}
                  herci={herci}
                  druhyLicence={druhyLicence}
                  typy={typy}
                  rodneListy={rlPodleVystupu.get(v.id) ?? []}
                  caflouProjectId={caflouProjectId}
                  pracuje={pracuje}
                  nazevProjektu={nazevProjektu}
                  onUloz={(zmena) => uloz(v.id, zmena)}
                  onSmaz={() => smaz(v.id)}
                  onRodnyList={() => vyrobRL(v.id)}
                  onDowncut={(delka) => pridej({ odvozenoZId: v.id, delkaSekund: delka })}
                />
              ))}
            </ul>
          )}
        </div>

        {/* NÁHLED NATÁČECÍHO TEXTU. Ukazuje přesně to, co se uloží na Disk -
            stejné HTML, jen v rámečku, a na A4. Bílý podklad schválně: je to
            dokument, ne další karta portálu. */}
        {razene.length > 0 && (
          <div className="flex flex-col gap-2 min-w-0 min-[1100px]:sticky min-[1100px]:top-4">
            <span className="text-sm font-heading font-semibold text-ink">
              {t('vystupy.nahledNadpis')}
            </span>
            {/* Rámeček má tvar A4 a list se do něj vejde celý - žádný
                posuvník (26. 9. 2026: „u toho náhledu dokumentu nemůže být
                nikdy ten posuvník, chci celou A4 hned vždy vidět").
                Klepnutím se otevře přes celou obrazovku; rámeček sám na
                klepnutí nereaguje, proto je přes něj průhledné tlačítko. */}
            <div className="relative w-full">
              <iframe
                key={verzeNahledu}
                src={`/api/projects/${encodeURIComponent(caflouProjectId)}/nataceni-text/nahled?v=${verzeNahledu}`}
                title={t('vystupy.nahledNadpis')}
                scrolling="no"
                className="w-full aspect-[210/297] rounded-card border border-line bg-white overflow-hidden"
              />
              <button
                type="button"
                onClick={() => setVelkyNahled(true)}
                title={t('vystupy.zvetsitNahled')}
                aria-label={t('vystupy.zvetsitNahledPopis')}
                className="absolute inset-0 rounded-card border-0 bg-transparent cursor-zoom-in hover:bg-brand-purple/5 transition-colors"
              />
            </div>
          </div>
        )}
      </div>

      {/* VELKÝ NÁHLED. Tentýž list, jen přes celou obrazovku - zavře se
          klepnutím mimo, křížkem nebo Escapem. */}
      {velkyNahled && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('vystupy.nahledNadpis')}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setVelkyNahled(false);
          }}
          className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <iframe
            key={`velky-${verzeNahledu}`}
            src={`/api/projects/${encodeURIComponent(caflouProjectId)}/nataceni-text/nahled?v=${verzeNahledu}`}
            title={t('vystupy.nahledNadpis')}
            scrolling="no"
            className="h-[94vh] max-w-[96vw] aspect-[210/297] rounded-card border-0 bg-white shadow-2xl"
          />
          <button
            type="button"
            onClick={() => setVelkyNahled(false)}
            aria-label={t('vystupy.zavritNahled')}
            className="absolute top-4 right-4 rounded-pill bg-surface border border-line text-ink font-heading text-sm px-4 py-1.5 cursor-pointer hover:text-brand-purple hover:border-brand-purple transition-colors"
          >
            {t('obecne.zavrit')}
          </button>
        </div>
      )}
    </section>
  );
}

/** Jeden výstup: celý na jednom řádku, ukládá se tlačítkem u řádku. */
function VystupRadek({
  vystup,
  rodic,
  caflouProjectId,
  canEdit,
  herci,
  druhyLicence,
  typy,
  rodneListy,
  pracuje,
  nazevProjektu,
  onUloz,
  onSmaz,
  onRodnyList,
  onDowncut,
}: {
  vystup: VystupData;
  rodic: VystupData | null;
  caflouProjectId: string;
  canEdit: boolean;
  herci: HerecVolba[];
  druhyLicence: LicenceVolba[];
  typy: TypVolba[];
  rodneListy: RodnyListRadek[];
  pracuje: boolean;
  nazevProjektu: string;
  onUloz: (zmena: Record<string, unknown>) => void;
  onSmaz: () => void;
  onRodnyList: () => void;
  onDowncut: (delkaSekund: number) => void;
}) {
  const t = usePreklad();
  const [nazev, setNazev] = useState(vystup.nazev);
  const [delka, setDelka] = useState(delkaNaText(vystup.delkaSekund));
  const [licenceIds, setLicenceIds] = useState<string[]>(vystup.licenceIds);
  const [herciIds, setHerciIds] = useState<string[]>(vystup.herciIds);
  /**
   * TEXT SPOTU (zadání 30. 9. 2026: „bylo by super, kdybych tady mohl k těm
   * výstupům i nahrát a editovat text").
   *
   * Do teď se text psal až v dokumentu na Disku, takže portál o něm nevěděl
   * a každý nově vyrobený list začínal prázdný. Teď je text u výstupu: píše
   * se tady, hned vedle je vidět v náhledu listu vpravo a ukládá se týmž
   * tlačítkem jako zbytek řádku - žádné druhé „uložit".
   *
   * ROZKLEPNE SE POD ŘÁDKEM, ne v okně: řádek zůstane řádkem a náhled listu
   * vedle nic nepřekrývá, takže je při psaní vidět, jak se list plní.
   */
  const [text, setText] = useState(vystup.text ?? '');
  const [otevrenText, setOtevrenText] = useState(false);
  const [nacitam, setNacitam] = useState(false);
  const [chybaTextu, setChybaTextu] = useState<string | null>(null);

  // Co přijde ze serveru po uložení, přebije rozepsané - jinak by v políčku
  // zůstala stará hodnota, když ji server upraví (třeba ořízne mezery).
  useEffect(() => {
    setNazev(vystup.nazev);
    setDelka(delkaNaText(vystup.delkaSekund));
    setLicenceIds(vystup.licenceIds);
    setHerciIds(vystup.herciIds);
    setText(vystup.text ?? '');
  }, [vystup]);

  /**
   * NAHRÁNÍ SOUBORU TEXT JEN NAČTE, NEULOŽÍ. Objeví se v políčku, kde se dá
   * ještě upravit, a teprve uložení řádku ho zapíše - tím nahrání nikdy tiše
   * nepřepíše, co už u výstupu bylo napsané.
   */
  async function nahrajText(soubor: File) {
    setNacitam(true);
    setChybaTextu(null);
    try {
      const telo = new FormData();
      telo.append('soubor', soubor);
      const res = await fetch(
        `/api/projects/${encodeURIComponent(caflouProjectId)}/vystupy/text`,
        { method: 'POST', body: telo },
      );
      const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok || !data.text) {
        setChybaTextu(data.error || t('vystupy.textChyba'));
        return;
      }
      setText(data.text);
      setOtevrenText(true);
    } catch {
      setChybaTextu(t('vystupy.textChyba'));
    } finally {
      setNacitam(false);
    }
  }

  const delkaSekund = textNaDelku(delka);

  /**
   * NÁZEV SE ŘÍDÍ STOPÁŽÍ A LICENCÍ (26. 9. 2026: „bylo by dobré, kdyby se
   * podle té stopáže výstupu změnil i rovnou název - např. když napíšu stopáž
   * 2 min., tak to bude STRABAG - 2min._online").
   *
   * Přepočítá se, jen když se mění délka nebo licence - do ručně psaného
   * názvu portál nesahá. Základ je název bez přípony, kterou si přidal sám.
   */
  function prepoctiNazev(sekundy: number | null, licence: string[]) {
    const jmena = licence
      .map((id) => druhyLicence.find((d) => d.id === id)?.nazev || '')
      .filter(Boolean);
    setNazev((stary) => `${zakladNazvu(stary)}${priponaNazvu(sekundy, jmena)}`);
  }
  const zmeneno =
    nazev !== vystup.nazev ||
    (delkaSekund ?? null) !== (vystup.delkaSekund ?? null) ||
    licenceIds.join(',') !== vystup.licenceIds.join(',') ||
    herciIds.join(',') !== vystup.herciIds.join(',') ||
    text !== (vystup.text ?? '');
  /** Napsaná délka, které nerozumíme - řádek to řekne místo tichého zahození. */
  const delkaSpatne = delka.trim().length > 0 && delkaSekund === null;

  const typ = typy.find((t) => t.nazev === (vystup.typKlic || rodic?.typKlic)) ?? null;
  const delaSeRL = typ?.rodnyList ?? false;
  const posledniRL = rodneListy[0] ?? null;

  function ulozRadek() {
    onUloz({
      nazev,
      delkaSekund,
      licenceIds,
      herciIds,
      text: text.trim() ? text : null,
      potvrzeno: true,
    });
  }

  return (
    <li className={rodic ? 'ml-6' : ''}>
      <div className="flex items-center gap-2 flex-wrap rounded-card border border-line bg-surface px-3 py-2">
        {rodic && <span className="text-muted text-sm shrink-0">↳</span>}

        <input
          value={nazev}
          disabled={!canEdit}
          placeholder={nazevProjektu}
          onChange={(e) => setNazev(e.target.value)}
          /**
           * Po dopsání se název srovná na tvar STRABAG - 2min._online (26. 9.
           * 2026: „takhle chci, abys přepisoval ten název"). Až při opuštění
           * políčka, ne při každém písmenu - jinak by příponu přepisoval
           * pod rukama a kurzor skákal na konec.
           */
          onBlur={() => prepoctiNazev(delkaSekund, licenceIds)}
          aria-label={t('vystupy.nazevVystupu')}
          className="flex-1 min-w-[140px] max-w-[280px] rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-ink font-heading font-semibold text-sm outline-none hover:border-line focus:border-brand-purple focus:bg-field disabled:opacity-60"
        />

        {/* Kdo v něm mluví - u Strabagu je v každé délce někdo jiný. */}
        <VyberVOkne
          popisek={t('vystupy.herci')}
          prazdne={t('vystupy.herciPrazdne')}
          disabled={!canEdit}
          polozky={herci.map((h) => ({ id: h.id, nazev: h.name, ikona: null }))}
          vybrane={herciIds}
          zdedene={rodic ? rodic.herciIds : []}
          onZmena={setHerciIds}
        />

        <input
          value={delka}
          disabled={!canEdit}
          placeholder={
            rodic
              ? delkaNaText(rodic.delkaSekund) || t('vystupy.delkaPrazdne')
              : t('vystupy.delkaPrazdne')
          }
          onChange={(e) => {
            setDelka(e.target.value);
            prepoctiNazev(textNaDelku(e.target.value), licenceIds);
          }}
          aria-label={t('vystupy.delka')}
          title={t('vystupy.delkaNapoveda')}
          className={`w-[88px] shrink-0 rounded-lg border bg-field px-2 py-1.5 text-ink font-heading text-sm text-center tabular-nums outline-none focus:border-brand-purple disabled:opacity-60 ${
            delkaSpatne ? 'border-status-error' : 'border-line'
          }`}
        />

        <VyberVOkne
          popisek={t('vystupy.licence')}
          prazdne={t('vystupy.licencePrazdne')}
          disabled={!canEdit}
          polozky={druhyLicence.map((d) => ({ id: d.id, nazev: d.nazev, ikona: d.ikona }))}
          vybrane={licenceIds}
          zdedene={rodic ? rodic.licenceIds : []}
          onZmena={(ids) => {
            setLicenceIds(ids);
            prepoctiNazev(delkaSekund, ids);
          }}
        />

        {/* Odznak svítí, když text u výstupu je - v sadě čtyř délek je tak
            na první pohled vidět, ke kterému spotu text ještě chybí. */}
        {(canEdit || vystup.text) && (
          <button
            type="button"
            onClick={() => setOtevrenText((o) => !o)}
            title={t('vystupy.textNapoveda')}
            aria-expanded={otevrenText}
            className={`shrink-0 rounded-pill border px-2.5 py-1 text-[11px] font-heading font-semibold transition-colors cursor-pointer ${
              text.trim()
                ? 'border-brand-purple/50 bg-brand-purple/10 text-brand-purpleDeep dark:text-brand-purpleLight'
                : 'border-line bg-surface text-muted hover:text-brand-purple hover:border-brand-purple'
            }`}
          >
            {t('vystupy.text')}
          </button>
        )}

        {posledniRL && (
          <a
            href={`/api/rodny-list/${posledniRL.id}`}
            target="_blank"
            rel="noopener noreferrer"
            title={t('vystupy.rlNapoveda', {
              soubor: posledniRL.fileName,
              cislo: posledniRL.version,
            })}
            className="shrink-0 rounded-pill bg-okTint text-status-done px-2 py-0.5 text-[11px] font-heading font-semibold no-underline"
          >
            RL v{posledniRL.version}
          </a>
        )}

        {!vystup.potvrzeno && (
          <span
            title={t('vystupy.navrhNapoveda')}
            className="shrink-0 rounded-pill bg-warnTint text-status-progress px-2 py-0.5 text-[11px] font-heading font-semibold"
          >
            {t('vystupy.navrh')}
          </span>
        )}

        {canEdit && zmeneno && (
          <button
            type="button"
            onClick={ulozRadek}
            disabled={pracuje || delkaSpatne}
            title={t('vystupy.ulozitVystup')}
            className="shrink-0 rounded-pill bg-brand-purple text-white font-heading font-semibold text-xs px-3 py-1.5 border-0 cursor-pointer disabled:opacity-50"
          >
            {t('obecne.ulozit')}
          </button>
        )}

        {canEdit && (
          <MenuVystupu
            pracuje={pracuje}
            delaSeRL={delaSeRL}
            rodneListy={rodneListy}
            jeDowncut={Boolean(rodic)}
            onRodnyList={onRodnyList}
            onDowncut={onDowncut}
            onSmaz={onSmaz}
          />
        )}
      </div>

      {otevrenText && (
        <div className="mt-1 ml-3 flex flex-col gap-2 rounded-card border border-line bg-field/40 px-3 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-heading text-muted uppercase tracking-wide">
              {t('vystupy.textNadpis')}
            </span>
            {canEdit && (
              <label className="ml-auto shrink-0 rounded-pill border border-line bg-surface px-3 py-1 text-xs font-heading text-muted cursor-pointer hover:text-brand-purple hover:border-brand-purple transition-colors">
                {nacitam ? t('vystupy.textNacitam') : t('vystupy.textNahrat')}
                <input
                  type="file"
                  accept=".docx,.txt,.md"
                  disabled={nacitam || pracuje}
                  className="hidden"
                  onChange={(e) => {
                    const vybrany = e.target.files?.[0];
                    // Vyprázdnit, ať jde tentýž soubor nahrát i podruhé.
                    e.target.value = '';
                    if (vybrany) nahrajText(vybrany);
                  }}
                />
              </label>
            )}
          </div>

          {chybaTextu && (
            <p className="text-xs font-body text-status-error m-0" role="alert">
              {chybaTextu}
            </p>
          )}

          <textarea
            value={text}
            disabled={!canEdit}
            rows={10}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('vystupy.textPrazdne')}
            aria-label={t('vystupy.textNadpis')}
            className="w-full min-h-[140px] resize-y rounded-card border border-line bg-surface px-3 py-2 text-ink font-body text-sm leading-relaxed outline-none focus:border-brand-purple disabled:opacity-60"
          />

          <p className="text-[11px] font-body text-muted m-0">{t('vystupy.textFormat')}</p>
        </div>
      )}

      {delkaSpatne && (
        <p className="text-xs font-body text-status-error m-0 mt-1 ml-3">
          {t('vystupy.delkaSpatne', { delka })}
        </p>
      )}
    </li>
  );
}

/** Tečky na konci řádku: rodný list, zkrácená verze, smazání. */
function MenuVystupu({
  pracuje,
  delaSeRL,
  rodneListy,
  jeDowncut,
  onRodnyList,
  onDowncut,
  onSmaz,
}: {
  pracuje: boolean;
  delaSeRL: boolean;
  rodneListy: RodnyListRadek[];
  jeDowncut: boolean;
  onRodnyList: () => void;
  onDowncut: (delkaSekund: number) => void;
  onSmaz: () => void;
}) {
  const t = usePreklad();
  const [kotva, setKotva] = useState<{ left: number; top: number } | null>(null);
  const [potvrzujiSmazani, setPotvrzujiSmazani] = useState(false);
  const oknoRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!kotva || !oknoRef.current) return;
    const r = oknoRef.current.getBoundingClientRect();
    if (r.bottom > window.innerHeight - 8) {
      const novyVrsek = Math.max(8, window.innerHeight - r.height - 8);
      if (Math.abs(novyVrsek - kotva.top) > 1) setKotva({ ...kotva, top: novyVrsek });
    }
  }, [kotva]);

  useEffect(() => {
    if (!kotva) return;
    /**
     * Okno se zavírá při posouvání stránky (jinak by zůstalo viset mimo své
     * tlačítko), ale NE při posouvání uvnitř sebe - čtrnáct herců se do něj
     * nevejde a rolovat v nich musí jít (27. 9. 2026: „když rozkliknu seznam
     * herců, tak v tom nemůžu rolovat").
     */
    const zavri = (e?: Event) => {
      const cil = e?.target;
      if (cil instanceof Node && oknoRef.current?.contains(cil)) return;
      setKotva(null);
    };
    const klavesa = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setKotva(null);
    };
    const mimo = (e: MouseEvent) => {
      if (oknoRef.current && !oknoRef.current.contains(e.target as Node)) setKotva(null);
    };
    window.addEventListener('keydown', klavesa);
    window.addEventListener('scroll', zavri, true);
    window.addEventListener('resize', zavri);
    const t = window.setTimeout(() => document.addEventListener('mousedown', mimo), 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', klavesa);
      window.removeEventListener('scroll', zavri, true);
      window.removeEventListener('resize', zavri);
      document.removeEventListener('mousedown', mimo);
    };
  }, [kotva]);

  return (
    <>
      <button
        type="button"
        disabled={pracuje}
        title={t('vystupy.coSVystupem')}
        aria-label={t('vystupy.coSVystupem')}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setPotvrzujiSmazani(false);
          setKotva({
            left: Math.min(r.left - SIRKA_OKNA + r.width, window.innerWidth - SIRKA_OKNA - 8),
            top: r.bottom + 6,
          });
        }}
        className="shrink-0 grid place-items-center w-7 h-7 rounded-full border border-line text-muted hover:text-brand-purple hover:border-brand-purple transition-colors disabled:opacity-50"
      >
        ⋯
      </button>

      {kotva && (
        <div
          ref={oknoRef}
          style={{ position: 'fixed', left: kotva.left, top: kotva.top, width: SIRKA_OKNA }}
          className="z-[90] flex flex-col gap-0.5 rounded-card border border-line bg-surface shadow-2xl p-2"
        >
          {delaSeRL && (
            <>
              {rodneListy.map((rl) => (
                <a
                  key={rl.id}
                  href={`/api/rodny-list/${rl.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1.5 rounded-lg text-sm font-heading text-ink no-underline hover:bg-field transition-colors"
                >
                  {t('vystupy.otevritRodnyList', { cislo: rl.version })}
                </a>
              ))}
              <PolozkaMenu
                disabled={pracuje}
                onClick={() => {
                  onRodnyList();
                  setKotva(null);
                }}
              >
                {rodneListy.length === 0
                  ? t('vystupy.vyrobitRodnyList')
                  : t('vystupy.vyrobitNovouVerzi')}
              </PolozkaMenu>
            </>
          )}

          {/* Zkrácené verze se zakládají jen u hlavního spotu - downcut
              z downcutu by už nikdo nerozpletl. */}
          {!jeDowncut && (
            <div className="px-2 py-1.5 flex flex-col gap-1.5">
              <span className="text-[11px] font-heading text-muted uppercase tracking-wide">
                {t('vystupy.zkracenaVerze')}
              </span>
              <span className="flex flex-wrap gap-1">
                {NABIZENE_DOWNCUTY.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={pracuje}
                    onClick={() => {
                      onDowncut(s);
                      setKotva(null);
                    }}
                    className="rounded-pill border border-line px-2.5 py-1 text-xs font-heading text-ink bg-field hover:border-brand-purple hover:text-brand-purple transition-colors cursor-pointer tabular-nums disabled:opacity-50"
                  >
                    {s}s
                  </button>
                ))}
              </span>
            </div>
          )}

          {potvrzujiSmazani ? (
            <PolozkaMenu
              disabled={pracuje}
              nebezpecna
              onClick={() => {
                onSmaz();
                setKotva(null);
              }}
            >
              {t('vystupy.opravduSmazat')}
            </PolozkaMenu>
          ) : (
            <PolozkaMenu disabled={pracuje} nebezpecna onClick={() => setPotvrzujiSmazani(true)}>
              {t('vystupy.smazatVystup')}
            </PolozkaMenu>
          )}
        </div>
      )}
    </>
  );
}

/** Řádek v menu - ať vypadají všechny stejně. */
function PolozkaMenu({
  children,
  onClick,
  disabled,
  nebezpecna,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  nebezpecna?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full text-left px-2 py-1.5 rounded-lg text-sm font-heading bg-transparent border-0 cursor-pointer transition-colors disabled:opacity-50 ${
        nebezpecna ? 'text-muted hover:text-status-error hover:bg-field' : 'text-ink hover:bg-field'
      }`}
    >
      {children}
    </button>
  );
}
