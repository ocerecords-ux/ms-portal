'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DatumPole } from '@/components/DatumPole';
import { formatDatum, prelozitKolem } from '@/lib/jazyk';
import { useJazyk, usePreklad } from '../../components/JazykProvider';
import { VyberVOkne } from '../VyberVOkne';

/**
 * Záložka „Licenční list" v detailu projektu (zadání 22. 9. 2026: „u reklam
 * budeme klientovi vystavovat licenční listy, netýká se to rádiových spotů.
 * Jde o vymezení licence pro daného herce").
 *
 * STEJNÁ PODOBA JAKO VÝSTUPY (zadání 27. 9. 2026: „potřebuju, ať ty licenční
 * listy jsou zjednodušené a vypadá to jako ta záložka Výstupy"). Rozsah
 * licence se zadává na JEDNOM ŘÁDKU - spot, interpreti, délka a typ licence;
 * údaje společné celé zakázce (klient, objednatel, území, podmínky, podpis)
 * se mění málokdy, takže sedí složené pod tlačítkem s tečkami.
 *
 * JEDEN LIST = JEDEN VÝSTUP (zadání 27. 9. 2026: „chci mít tolik licenčních
 * listů, kolik je výstupů, a zobrazit na každém licenčním listu všechny herce
 * z výstupu"). Licence se sjednává ke spotu, ne k člověku - v dvouminutovém
 * Strabagu mluví patnáct herců a všichni patří na týž list. Vpravo je náhled
 * toho řádku, na kterém se zrovna stojí.
 */

export type LicencniListRadek = {
  id: string;
  fileName: string;
  /** Ke kterému výstupu list patří; starší listy ho nemají. */
  vystupId: string | null;
  nazevSpotu: string;
  interpret: string;
  uzemi: string;
  media: string;
  delkaLicence: string;
  typLicence: string;
  createdAt: string;
  driveUrl: string | null;
  driveError: string | null;
};

export type LicencniListVychozi = {
  herci: { id: string | null; jmeno: string }[];
  vsichniHerci: { id: string; jmeno: string }[];
  nazevSpotu: string;
  klient: string;
  objednatel: string;
  dodavatel: string;
  typDila: string;
  uzemi: string;
  media: string;
  delkaLicence: string;
  typLicence: string;
  datumVyroby: string;
  podminky: string;
  misto: string;
  podepisuje: string;
};

/**
 * Výstup, ze kterého list vzniká. Licence se sjednává ke konkrétnímu spotu -
 * u Strabagu má každá délka jiné herce i jiná média.
 */
export type VystupProLicenci = {
  id: string;
  nazev: string;
  /** Druhy licence výstupu, už spojené do textu - „Rádio, Online". */
  media: string;
  herci: { id: string; jmeno: string }[];
  /** Na kolik měsíců je licence sjednaná; null = necháme, co je v poli. */
  mesicu: number | null;
  /** RRRR-MM-DD, když ho výstup má. */
  datumVyroby: string | null;
};

/** Jeden chystaný list - jeden výstup. */
type ChystanyList = {
  klic: string;
  nazevSpotu: string;
  media: string;
  typDila: string;
  delkaLicence: string;
  typLicence: string;
  datumVyroby: string;
  interpreti: { id: string | null; jmeno: string }[];
};

/**
 * „1 rok", „18 měsíců" - jak se délka licence píše do listu.
 *
 * ZŮSTÁVÁ ČESKY SCHVÁLNĚ (dávka 7b): je to hodnota, která jde do PDF, a jazyk
 * dokumentu určuje doklad, ne přepínač v liště (pravidlo 5). Totéž platí pro
 * typ licence („výhradní"), typ díla a média.
 */
function delkaZMesicu(mesicu: number): string {
  if (mesicu % 12 === 0) {
    const roky = mesicu / 12;
    return roky === 1 ? '1 rok' : roky < 5 ? `${roky} roky` : `${roky} let`;
  }
  return `${mesicu} měsíců`;
}

/**
 * Herec bez účtu nemá id, ale okno s výběrem si o nějaké říká. Jméno s touhle
 * předponou je klíč jen pro okno - do listu se pak pošle samotné jméno.
 */
const KLIC_JMENA = 'jmeno:';

const pole =
  'rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple disabled:opacity-60';

export function LicencniListSection({
  caflouProjectId,
  canEdit,
  listy,
  vychozi,
  vystupy = [],
}: {
  caflouProjectId: string;
  canEdit: boolean;
  listy: LicencniListRadek[];
  vychozi: LicencniListVychozi;
  vystupy?: VystupProLicenci[];
}) {
  const t = usePreklad();
  const jazyk = useJazyk();
  const router = useRouter();

  /** Co je společné všem listům projektu - píše se jednou. */
  const [spolecne, setSpolecne] = useState({
    klient: vychozi.klient,
    objednatel: vychozi.objednatel,
    dodavatel: vychozi.dodavatel,
    uzemi: vychozi.uzemi,
    podminky: vychozi.podminky,
    misto: vychozi.misto,
    podepisuje: vychozi.podepisuje,
  });

  /** Chystané listy - jeden na výstup, u projektu bez výstupů jeden jediný. */
  const [chystane, setChystane] = useState<ChystanyList[]>(() =>
    vystupy.length > 0
      ? vystupy.map((vy) => ({
          klic: vy.id,
          nazevSpotu: vy.nazev || vychozi.nazevSpotu,
          media: vy.media || vychozi.media,
          typDila: vy.media ? `Hlasový výkon pro audio spot na ${vy.media}` : vychozi.typDila,
          delkaLicence: vy.mesicu ? delkaZMesicu(vy.mesicu) : vychozi.delkaLicence,
          typLicence: vychozi.typLicence,
          datumVyroby: vy.datumVyroby || vychozi.datumVyroby,
          interpreti: vy.herci.length > 0 ? vy.herci.map((h) => ({ id: h.id, jmeno: h.jmeno })) : vychozi.herci,
        }))
      : [
          {
            klic: 'projekt',
            nazevSpotu: vychozi.nazevSpotu,
            media: vychozi.media,
            typDila: vychozi.typDila,
            delkaLicence: vychozi.delkaLicence,
            typLicence: vychozi.typLicence,
            datumVyroby: vychozi.datumVyroby,
            interpreti: vychozi.herci,
          },
        ],
  );

  /** Jména dopsaná ručně - v okně se pak nabízejí jako všichni ostatní. */
  const [dopsani, setDopsani] = useState<string[]>([]);
  /** Na kterém řádku se stojí - ten je v náhledu vpravo. */
  const [vybrany, setVybrany] = useState(0);
  const [dalsiUdaje, setDalsiUdaje] = useState(false);
  const [bezi, setBezi] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [hotovo, setHotovo] = useState(0);
  const [klientSeUklada, setKlientSeUklada] = useState(false);
  const klientNaServeru = useRef(vychozi.klient);
  const [velkyNahled, setVelkyNahled] = useState(false);
  const [nahledUrl, setNahledUrl] = useState<string | null>(null);
  const [nahledSeDela, setNahledSeDela] = useState(false);
  const posledniUrl = useRef<string | null>(null);
  /** Řádky a jejich políčka s názvem - kvůli překlikávání šipkami. */
  const radkyRef = useRef<(HTMLDivElement | null)[]>([]);
  const nazvyRef = useRef<(HTMLInputElement | null)[]>([]);
  const nazevPredUpravou = useRef<string>('');

  const nastavSpolecne = <K extends keyof typeof spolecne>(k: K, hodnota: (typeof spolecne)[K]) =>
    setSpolecne((p) => ({ ...p, [k]: hodnota }));

  const nastavRadek = (i: number, zmena: Partial<ChystanyList>) =>
    setChystane((p) => p.map((r, j) => (j === i ? { ...r, ...zmena } : r)));

  /**
   * Nabídka do okna s interprety: herci projektu a výstupů, ručně dopsaní
   * a zbytek databáze. Pořadí je schválně takové - kdo dělal na projektu,
   * je nahoře.
   */
  const nabidkaHercu = useMemo(() => {
    const seznam: { id: string; nazev: string; ikona: null }[] = [];
    const pridej = (id: string, nazev: string) => {
      if (!nazev || seznam.some((x) => x.id === id)) return;
      seznam.push({ id, nazev, ikona: null });
    };
    for (const h of vychozi.herci) pridej(h.id ?? `${KLIC_JMENA}${h.jmeno}`, h.jmeno);
    for (const vy of vystupy) for (const h of vy.herci) pridej(h.id, h.jmeno);
    for (const j of dopsani) pridej(`${KLIC_JMENA}${j}`, j);
    for (const h of vychozi.vsichniHerci) pridej(h.id, h.jmeno);
    return seznam;
  }, [vychozi.herci, vychozi.vsichniHerci, vystupy, dopsani]);

  const klicHerce = (h: { id: string | null; jmeno: string }) => h.id ?? `${KLIC_JMENA}${h.jmeno}`;

  /**
   * PŘEKLIKÁVÁNÍ JAKO VE FINDERU (zadání 27. 9. 2026: „chci se překlikávat
   * v seznamu listů, upravoval bych tam pole, jako když pracuji se soubory
   * ve Finderu na macu"). Šipky nahoru a dolů chodí po řádcích, Enter začne
   * přepisovat název, Escape změnu vezme zpět a vrátí se na řádek.
   */
  function skoc(i: number) {
    const cil = radkyRef.current[i];
    if (!cil) return;
    setVybrany(i);
    cil.focus();
  }

  function klavesaRadku(e: React.KeyboardEvent<HTMLDivElement>, i: number) {
    // Když se zrovna píše do políčka, řádek do toho nemluví.
    if (e.target !== e.currentTarget) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      skoc(Math.min(i + 1, chystane.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      skoc(Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      nazevPredUpravou.current = chystane[i]?.nazevSpotu ?? '';
      const vstup = nazvyRef.current[i];
      vstup?.focus();
      vstup?.select();
    }
  }

  function klavesaNazvu(e: React.KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key === 'Enter') {
      e.preventDefault();
      skoc(i);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      nastavRadek(i, { nazevSpotu: nazevPredUpravou.current });
      skoc(i);
    }
  }

  /** Údaje jednoho listu tak, jak jdou do PDF. */
  const doListu = (r: ChystanyList) => ({
    ...spolecne,
    nazevSpotu: r.nazevSpotu,
    media: r.media,
    typDila: r.typDila,
    delkaLicence: r.delkaLicence,
    typLicence: r.typLicence,
    datumVyroby: r.datumVyroby,
    interpret: r.interpreti.map((h) => h.jmeno).filter(Boolean).join(', '),
  });

  const radekNahledu = chystane[Math.min(vybrany, chystane.length - 1)] ?? null;
  // Věta zůstává jeden klíč, dělí se až při vykreslení - název spotu je v ní
  // tlustě (pravidlo 7 v docs/preklad-portalu.md).
  const [predNazvem, zaNazvem] = prelozitKolem(jazyk, 'licencniList.vNahleduJe', 'nazev');

  /**
   * JEDEN SEZNAM (zadání 27. 9. 2026: „přijde mi zbytečné, aby se mi tam
   * zobrazovaly dva seznamy, chci jen jeden, a aby tam zůstaly názvy").
   * Vystavený list se ukáže rovnou na řádku svého výstupu - podle vazby,
   * a u starších listů, které ji nemají, podle názvu spotu.
   */
  const vystavenyKRadku = (r: ChystanyList) =>
    listy.find((l) => (l.vystupId ? l.vystupId === r.klic : l.nazevSpotu === r.nazevSpotu)) ?? null;

  /** Listy, ke kterým už žádný výstup není - ať se ze seznamu neztratí. */
  const osirele = listy.filter((l) => !chystane.some((r) => vystavenyKRadku(r)?.id === l.id));

  /**
   * ŽIVÝ NÁHLED. Tentýž PDF list, jaký pak vznikne - jen se nikam neukládá.
   * Čeká se půl vteřiny po posledním ťuknutí, aby se dokument nevyráběl po
   * každém písmenu, a rozdělaný požadavek se ruší, ať pomalejší starší
   * odpověď nepřebije novější.
   */
  const podkladNahledu = radekNahledu ? JSON.stringify(doListu(radekNahledu)) : null;
  useEffect(() => {
    if (!canEdit || !podkladNahledu) return;
    const rizeni = new AbortController();
    const casovac = window.setTimeout(async () => {
      setNahledSeDela(true);
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(caflouProjectId)}/licencni-list/nahled`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: rizeni.signal,
            body: podkladNahledu,
          },
        );
        if (!res.ok) return;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (posledniUrl.current) URL.revokeObjectURL(posledniUrl.current);
        posledniUrl.current = url;
        setNahledUrl(url);
      } catch {
        // Přerušený požadavek při dalším ťuknutí není chyba.
      } finally {
        setNahledSeDela(false);
      }
    }, 500);
    return () => {
      window.clearTimeout(casovac);
      rizeni.abort();
    };
  }, [podkladNahledu, canEdit, caflouProjectId]);

  // Poslední PDF pustíme z paměti, když se od projektu odchází.
  useEffect(
    () => () => {
      if (posledniUrl.current) URL.revokeObjectURL(posledniUrl.current);
    },
    [],
  );

  useEffect(() => {
    if (!velkyNahled) return;
    const zavri = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVelkyNahled(false);
    };
    window.addEventListener('keydown', zavri);
    return () => window.removeEventListener('keydown', zavri);
  }, [velkyNahled]);

  /** Vystaví jeden list, nebo všechny chystané. */
  async function vystav(jenIndex?: number) {
    const kVystaveni = jenIndex === undefined ? chystane : [chystane[jenIndex]];
    if (kVystaveni.some((r) => r.interpreti.length === 0)) {
      setChyba(t('licencniList.chybiInterpret'));
      return;
    }
    setBezi(true);
    setChyba(null);
    setHotovo(0);
    try {
      let kolik = 0;
      for (const r of kVystaveni) {
        const data = doListu(r);
        const res = await fetch(`/api/projects/${encodeURIComponent(caflouProjectId)}/licencni-list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // actorUserId drží vazbu na herce; u několika jmen na jednom listu
          // se váže na prvního - ostatní jsou v textu interpretů.
          body: JSON.stringify({
            ...data,
            actorUserId: r.interpreti[0]?.id ?? null,
            // Klíč řádku je id výstupu; u projektu bez výstupů je to „projekt".
            vystupId: r.klic === 'projekt' ? null : r.klic,
          }),
        });
        const telo = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            `${r.nazevSpotu}: ${telo.error || t('licencniList.chybaVystaveniRadku')}`,
          );
        }
        kolik += 1;
      }
      setHotovo(kolik);
      router.refresh();
    } catch (err) {
      setChyba(err instanceof Error ? err.message : t('licencniList.chybaVystaveni'));
    } finally {
      setBezi(false);
    }
  }

  /**
   * KLIENT SE PAMATUJE U PROJEKTU (zadání 27. 9. 2026: „klienta u těch
   * licenčních listů potřebuju ještě měnit, v tomto případě je to Strabag").
   * U agenturní zakázky je objednatelem agentura, ale licence patří koncovému
   * zadavateli - a ten se nemá přepisovat u každého listu znovu, tak se uloží
   * k projektu (tamtéž ho bere i rodný list).
   */
  async function ulozKlienta() {
    const jmeno = spolecne.klient.trim();
    if (jmeno === klientNaServeru.current.trim()) return;
    setKlientSeUklada(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(caflouProjectId)}/meta`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rlClientName: jmeno }),
      });
      if (!res.ok) throw new Error();
      klientNaServeru.current = jmeno;
      router.refresh();
    } catch {
      setChyba(t('licencniList.chybaKlienta'));
    } finally {
      setKlientSeUklada(false);
    }
  }

  async function smaz(id: string) {
    if (!window.confirm(t('licencniList.opravduSmazat'))) return;
    const res = await fetch(`/api/licencni-list/${id}`, { method: 'DELETE' });
    if (res.ok) router.refresh();
  }

  // Obyčejná funkce, ne komponenta - vnořená komponenta by se při každém
  // písmenku vytvořila znovu a políčko by ztrácelo kurzor.
  const policko = (
    k: 'objednatel' | 'dodavatel' | 'uzemi' | 'misto' | 'podepisuje',
    label: string,
    napoveda?: string,
  ) => (
    <label key={k} className="flex flex-col gap-1.5">
      <span className="text-sm font-body text-ink">{label}</span>
      <input
        value={spolecne[k]}
        onChange={(e) => nastavSpolecne(k, e.target.value)}
        disabled={!canEdit}
        className={pole}
      />
      {napoveda && <span className="text-xs text-muted font-body">{napoveda}</span>}
    </label>
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="font-display text-2xl text-ink m-0">{t('licencniList.nadpis')}</h2>
        {listy.length > 0 && (
          <span
            title={t(
              listy.length === 1
                ? 'licencniList.pocet1'
                : listy.length < 5
                  ? 'licencniList.pocet234'
                  : 'licencniList.pocet5',
              { pocet: listy.length },
            )}
            className="shrink-0 grid place-items-center min-w-[28px] h-7 px-2 rounded-pill bg-brand-purple/15 border border-brand-purple/40 text-brand-purpleDeep dark:text-brand-purpleLight font-heading font-semibold text-sm tabular-nums"
          >
            {listy.length}
          </span>
        )}
        {canEdit && (
          <>
            <button
              type="button"
              onClick={() => setDalsiUdaje((o) => !o)}
              title={t('licencniList.spolecneUdajeNapoveda')}
              aria-expanded={dalsiUdaje}
              className="ml-auto rounded-pill border border-line text-muted font-heading font-semibold text-sm px-4 py-1.5 bg-surface hover:text-brand-purple hover:border-brand-purple transition-colors cursor-pointer"
            >
              {t('licencniList.spolecneUdaje')}
            </button>
            {listy.length > 0 && (
              <a
                href={`/api/projects/${encodeURIComponent(caflouProjectId)}/dokumenty/zip`}
                title={t('licencniList.stahnoutVsechnyNapoveda')}
                className="rounded-pill border border-line text-muted font-heading font-semibold text-sm px-4 py-1.5 bg-surface no-underline hover:text-brand-purple hover:border-brand-purple transition-colors"
              >
                {t('licencniList.stahnoutVsechny', { pocet: listy.length })}
              </a>
            )}
            <button
              type="button"
              onClick={() => void vystav()}
              disabled={bezi || chystane.length === 0}
              title={t('licencniList.vystavitNapoveda')}
              className="rounded-pill bg-brand-purple text-white font-heading font-semibold text-sm px-4 py-1.5 hover:bg-brand-purpleDeep transition-colors cursor-pointer disabled:opacity-50"
            >
              {bezi
                ? t('licencniList.vystavuji')
                : chystane.length > 1
                  ? t('licencniList.vystavitPocet', { pocet: chystane.length })
                  : t('licencniList.vystavitList')}
            </button>
          </>
        )}
      </div>

      {canEdit && dalsiUdaje && (
        <div className="rounded-card border border-line bg-surface p-4 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {policko(
              'objednatel',
              t('licencniList.objednatel'),
              t('licencniList.objednatelNapoveda'),
            )}
            {policko('dodavatel', t('licencniList.dodavatel'))}
            {policko('uzemi', t('licencniList.uzemi'))}
            {policko('misto', t('licencniList.misto'), t('licencniList.mistoNapoveda'))}
            {policko('podepisuje', t('licencniList.podepisuje'))}
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{t('licencniList.podminky')}</span>
            <textarea
              value={spolecne.podminky}
              onChange={(e) => nastavSpolecne('podminky', e.target.value)}
              rows={6}
              className={`${pole} font-body resize-y`}
            />
            <span className="text-xs text-muted font-body">{t('licencniList.podminkyNapoveda')}</span>
          </label>
        </div>
      )}

      <div className="grid grid-cols-1 min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(0,480px)] gap-5 items-start">
        <div className="flex flex-col gap-3 min-w-0">
          {/* Klient je na očích - u agentur se mění skoro pokaždé. */}
          {canEdit && (
            <label className="flex items-center gap-2 flex-wrap rounded-card border border-line bg-surface px-3 py-2">
              <span className="text-sm font-body text-muted shrink-0 px-1">
                {t('licencniList.klient')}
              </span>
              <input
                value={spolecne.klient}
                onChange={(e) => nastavSpolecne('klient', e.target.value)}
                onBlur={() => void ulozKlienta()}
                placeholder={t('licencniList.klientPriklad')}
                className="flex-1 min-w-[160px] rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-ink font-heading font-semibold text-sm outline-none hover:border-line focus:border-brand-purple focus:bg-field"
              />
              <span className="text-xs font-body text-muted">
                {klientSeUklada ? t('obecne.ukladam') : t('licencniList.klientNapoveda')}
              </span>
            </label>
          )}

          {canEdit && (
            <ul className="list-none p-0 m-0 flex flex-col gap-2">
              {chystane.map((r, i) => (
                <li key={r.klic}>
                  <div
                    ref={(el) => {
                      radkyRef.current[i] = el;
                    }}
                    tabIndex={0}
                    role="group"
                    aria-label={r.nazevSpotu || t('licencniList.radek')}
                    onMouseDown={() => setVybrany(i)}
                    onFocus={() => setVybrany(i)}
                    onKeyDown={(e) => klavesaRadku(e, i)}
                    className={`flex items-center gap-2 flex-wrap rounded-card border bg-surface px-3 py-2 transition-colors outline-none ${
                      i === vybrany ? 'border-brand-purple ring-1 ring-brand-purple/40' : 'border-line'
                    }`}
                  >
                    <input
                      ref={(el) => {
                        nazvyRef.current[i] = el;
                      }}
                      value={r.nazevSpotu}
                      onChange={(e) => nastavRadek(i, { nazevSpotu: e.target.value })}
                      onFocus={() => {
                        setVybrany(i);
                        nazevPredUpravou.current = r.nazevSpotu;
                      }}
                      onKeyDown={(e) => klavesaNazvu(e, i)}
                      placeholder={t('licencniList.nazevSpotu')}
                      aria-label={t('licencniList.nazevSpotu')}
                      className="flex-1 min-w-[140px] max-w-[260px] rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-ink font-heading font-semibold text-sm outline-none hover:border-line focus:border-brand-purple focus:bg-field"
                    />

                    <VyberVOkne
                      popisek={t('licencniList.interpreti')}
                      prazdne={t('licencniList.interpretiPrazdne')}
                      polozky={nabidkaHercu}
                      vybrane={r.interpreti.map(klicHerce)}
                      onZmena={(klice) =>
                        nastavRadek(i, {
                          interpreti: klice.map((k) =>
                            k.startsWith(KLIC_JMENA)
                              ? { id: null, jmeno: k.slice(KLIC_JMENA.length) }
                              : { id: k, jmeno: nabidkaHercu.find((x) => x.id === k)?.nazev ?? '' },
                          ),
                        })
                      }
                      onPridatJmeno={(jmeno) => {
                        setDopsani((p) => (p.includes(jmeno) ? p : [...p, jmeno]));
                        nastavRadek(i, {
                          interpreti: r.interpreti.some((x) => !x.id && x.jmeno === jmeno)
                            ? r.interpreti
                            : [...r.interpreti, { id: null, jmeno }],
                        });
                      }}
                    />

                    <input
                      value={r.delkaLicence}
                      onChange={(e) => nastavRadek(i, { delkaLicence: e.target.value })}
                      onFocus={() => setVybrany(i)}
                      placeholder={t('licencniList.delka')}
                      aria-label={t('licencniList.delkaLicence')}
                      title={t('licencniList.delkaLicenceNapoveda')}
                      className="w-[100px] shrink-0 rounded-lg border border-line bg-field px-2 py-1.5 text-ink font-heading text-sm text-center outline-none focus:border-brand-purple"
                    />

                    {/* Typ licence má jen dvě hodnoty - klepnutím se přehodí. */}
                    <button
                      type="button"
                      onClick={() =>
                        nastavRadek(i, {
                          typLicence: r.typLicence === 'výhradní' ? 'nevýhradní' : 'výhradní',
                        })
                      }
                      title={t('licencniList.prepnoutTyp')}
                      className="shrink-0 rounded-pill border border-brand-purple/50 bg-brand-purple/10 text-brand-purpleDeep dark:text-brand-purpleLight px-3 py-1.5 text-xs font-heading transition-colors hover:border-brand-purple"
                    >
                      {r.typLicence}
                    </button>

                    {/* Vystavený list visí rovnou u svého řádku. */}
                    {(() => {
                      const hotovyList = vystavenyKRadku(r);
                      return hotovyList ? (
                        <a
                          href={`/api/licencni-list/${hotovyList.id}`}
                          target="_blank"
                          rel="noopener"
                          title={t('licencniList.vystavenoKdy', {
                            kdy: formatDatum(jazyk, new Date(hotovyList.createdAt)),
                            interpret: hotovyList.interpret,
                          })}
                          className="shrink-0 rounded-pill bg-okTint text-status-done px-3 py-1.5 text-xs font-heading font-semibold no-underline"
                        >
                          {t('licencniList.vystaveno')}
                        </a>
                      ) : null;
                    })()}

                    <MenuListu
                      bezi={bezi}
                      datumVyroby={r.datumVyroby}
                      media={r.media}
                      vystaveny={vystavenyKRadku(r)?.id ?? null}
                      onDatum={(d) => nastavRadek(i, { datumVyroby: d })}
                      onMedia={(m) =>
                        nastavRadek(i, {
                          media: m,
                          typDila: m ? `Hlasový výkon pro audio spot na ${m}` : r.typDila,
                        })
                      }
                      onVystav={() => void vystav(i)}
                      onSmazVystaveny={(id) => void smaz(id)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {chyba && (
            <p className="text-sm font-body text-status-error m-0" role="alert">
              {chyba}
            </p>
          )}
          {hotovo > 0 && (
            <p className="text-sm font-heading text-brand-greenDeep m-0">
              {hotovo === 1
                ? t('licencniList.hotovo1')
                : t('licencniList.hotovoPocet', { pocet: hotovo })}
            </p>
          )}

          {/* Listy bez výstupu (vystavené dřív, než výstupy vznikly). */}
          {osirele.length > 0 && (
            <ul className="list-none p-0 m-0 flex flex-col gap-2">
              {osirele.map((l) => (
                <li key={l.id}>
                  <div className="flex items-center gap-2 flex-wrap rounded-card border border-line bg-field/40 px-3 py-2">
                    <a
                      href={`/api/licencni-list/${l.id}`}
                      target="_blank"
                      rel="noopener"
                      title={l.interpret}
                      className="flex-1 min-w-[140px] px-2 text-sm font-heading font-semibold text-ink no-underline hover:text-brand-purple truncate"
                    >
                      {l.nazevSpotu || l.interpret}
                    </a>
                    <span className="shrink-0 rounded-pill border border-line text-muted px-3 py-1.5 text-xs font-heading">
                      {[l.delkaLicence, l.typLicence].filter(Boolean).join(' · ')}
                    </span>
                    <span className="shrink-0 text-xs font-body text-muted">
                      {formatDatum(jazyk, new Date(l.createdAt))}
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => void smaz(l.id)}
                        title={t('licencniList.smazat')}
                        aria-label={t('licencniList.smazat')}
                        className="shrink-0 w-7 h-7 grid place-items-center rounded-full border border-line text-muted bg-surface hover:text-danger hover:border-danger transition-colors cursor-pointer"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* NÁHLED. Přesně to PDF, které vznikne - mění se s tím, co se píše,
            a nikam se neukládá. Klepnutím se otevře přes celou obrazovku. */}
        {canEdit && (
          <div className="flex flex-col gap-2 min-w-0 min-[1100px]:sticky min-[1100px]:top-4">
            <span className="flex items-baseline gap-2">
              <span className="text-sm font-heading font-semibold text-ink">
                {t('licencniList.nahledNadpis')}
              </span>
              {nahledSeDela && (
                <span className="text-xs font-body text-muted">{t('licencniList.prekresluji')}</span>
              )}
            </span>
            <div className="relative w-full">
              <iframe
                // #view=Fit ukáže celou stránku, ne jen její šířku; rámeček má
                // poměr A4, takže na PDF sedí a posuvník nevznikne.
                src={nahledUrl ? `${nahledUrl}#view=Fit&toolbar=0&navpanes=0` : undefined}
                title={t('licencniList.nahledNadpis')}
                className={`w-full aspect-[210/297] rounded-card border border-line bg-white transition-opacity ${
                  nahledSeDela ? 'opacity-60' : 'opacity-100'
                }`}
              />
              {nahledUrl && (
                <button
                  type="button"
                  onClick={() => setVelkyNahled(true)}
                  title={t('licencniList.zvetsitNahled')}
                  aria-label={t('licencniList.zvetsitNahledPopis')}
                  className="absolute inset-0 rounded-card border-0 bg-transparent cursor-zoom-in hover:bg-brand-purple/5 transition-colors"
                />
              )}
            </div>
            {chystane.length > 1 && radekNahledu && (
              <span className="text-xs font-body text-muted">
                {predNazvem}
                <strong className="font-heading text-ink">{radekNahledu.nazevSpotu}</strong>
                {zaNazvem}
              </span>
            )}
          </div>
        )}
      </div>

      {velkyNahled && nahledUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('licencniList.nahledNadpis')}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setVelkyNahled(false);
          }}
          className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <iframe
            src={`${nahledUrl}#view=Fit&toolbar=0&navpanes=0`}
            title={t('licencniList.nahledNadpis')}
            className="h-[94vh] max-w-[96vw] aspect-[210/297] rounded-card border-0 bg-white shadow-2xl"
          />
          <button
            type="button"
            onClick={() => setVelkyNahled(false)}
            aria-label={t('licencniList.zavritNahled')}
            className="absolute top-4 right-4 rounded-pill bg-surface border border-line text-ink font-heading text-sm px-4 py-1.5 cursor-pointer hover:text-brand-purple hover:border-brand-purple transition-colors"
          >
            {t('obecne.zavrit')}
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * Tečky na konci řádku: co se u jednoho listu mění jen občas (média, datum
 * výroby) a vystavení právě tohohle jednoho listu.
 */
function MenuListu({
  bezi,
  media,
  datumVyroby,
  vystaveny,
  onMedia,
  onDatum,
  onVystav,
  onSmazVystaveny,
}: {
  bezi: boolean;
  media: string;
  datumVyroby: string;
  /** Id už vystaveného listu k tomuhle výstupu, jinak null. */
  vystaveny: string | null;
  onMedia: (media: string) => void;
  onDatum: (datum: string) => void;
  onVystav: () => void;
  onSmazVystaveny: (id: string) => void;
}) {
  const t = usePreklad();
  const [otevreno, setOtevreno] = useState(false);
  const oknoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!otevreno) return;
    const klavesa = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOtevreno(false);
    };
    const mimo = (e: MouseEvent) => {
      if (oknoRef.current && !oknoRef.current.contains(e.target as Node)) setOtevreno(false);
    };
    window.addEventListener('keydown', klavesa);
    const t = window.setTimeout(() => document.addEventListener('mousedown', mimo), 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', klavesa);
      document.removeEventListener('mousedown', mimo);
    };
  }, [otevreno]);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOtevreno((o) => !o)}
        title={t('licencniList.menuNapoveda')}
        aria-label={t('licencniList.dalsiUTohotoListu')}
        aria-expanded={otevreno}
        className="w-8 h-8 grid place-items-center rounded-full border border-line text-muted bg-surface hover:text-brand-purple hover:border-brand-purple transition-colors cursor-pointer"
      >
        ⋯
      </button>

      {otevreno && (
        <div
          ref={oknoRef}
          className="absolute right-0 top-9 z-[80] w-64 rounded-card border border-line bg-surface shadow-2xl p-3 flex flex-col gap-3"
        >
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-heading text-muted uppercase tracking-wide">
              {t('licencniList.media')}
            </span>
            <input
              value={media}
              onChange={(e) => onMedia(e.target.value)}
              placeholder={t('licencniList.mediaPlaceholder')}
              className="rounded-lg border border-line bg-field px-2 py-1.5 text-sm font-heading text-ink outline-none focus:border-brand-purple"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-heading text-muted uppercase tracking-wide">
              {t('licencniList.datumVyroby')}
            </span>
            <DatumPole
              value={datumVyroby}
              onChange={(e) => onDatum(e.target.value)}
              className="rounded-lg border border-line bg-field px-2 py-1.5 text-sm font-heading text-ink outline-none focus:border-brand-purple"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setOtevreno(false);
              onVystav();
            }}
            disabled={bezi}
            className="rounded-lg border border-line text-ink font-heading font-semibold text-sm px-3 py-1.5 bg-surface hover:text-brand-purple hover:border-brand-purple transition-colors cursor-pointer disabled:opacity-50"
          >
            {vystaveny ? t('licencniList.vystavitZnovu') : t('licencniList.vystavitJenTenhle')}
          </button>
          {vystaveny && (
            <button
              type="button"
              onClick={() => {
                setOtevreno(false);
                onSmazVystaveny(vystaveny);
              }}
              className="rounded-lg border border-line text-muted font-heading font-semibold text-sm px-3 py-1.5 bg-surface hover:text-danger hover:border-danger transition-colors cursor-pointer"
            >
              {t('licencniList.smazatVystaveny')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
