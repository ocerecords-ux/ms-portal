'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DatumPole } from '@/components/DatumPole';
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

/** „1 rok", „18 měsíců" - jak se délka licence píše do listu. */
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
  const [velkyNahled, setVelkyNahled] = useState(false);
  const [nahledUrl, setNahledUrl] = useState<string | null>(null);
  const [nahledSeDela, setNahledSeDela] = useState(false);
  const posledniUrl = useRef<string | null>(null);

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
      setChyba('U každého listu musí být aspoň jeden interpret.');
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
          body: JSON.stringify({ ...data, actorUserId: r.interpreti[0]?.id ?? null }),
        });
        const telo = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(`${r.nazevSpotu}: ${telo.error || 'licenční list se nepodařilo vystavit.'}`);
        }
        kolik += 1;
      }
      setHotovo(kolik);
      router.refresh();
    } catch (err) {
      setChyba(err instanceof Error ? err.message : 'Licenční list se nepodařilo vystavit.');
    } finally {
      setBezi(false);
    }
  }

  async function smaz(id: string) {
    if (!window.confirm('Smazat tenhle licenční list? Kopie na Disku půjde do koše.')) return;
    const res = await fetch(`/api/licencni-list/${id}`, { method: 'DELETE' });
    if (res.ok) router.refresh();
  }

  // Obyčejná funkce, ne komponenta - vnořená komponenta by se při každém
  // písmenku vytvořila znovu a políčko by ztrácelo kurzor.
  const policko = (
    k: 'klient' | 'objednatel' | 'dodavatel' | 'uzemi' | 'misto' | 'podepisuje',
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
        <h2 className="font-display text-2xl text-ink m-0">Licenční listy</h2>
        {listy.length > 0 && (
          <span
            title={`Vystaveno ${listy.length} ${listy.length === 1 ? 'list' : listy.length < 5 ? 'listy' : 'listů'}`}
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
              title="Klient, objednatel, území, podmínky, podpis — společné všem listům"
              aria-expanded={dalsiUdaje}
              className="ml-auto rounded-pill border border-line text-muted font-heading font-semibold text-sm px-4 py-1.5 bg-surface hover:text-brand-purple hover:border-brand-purple transition-colors cursor-pointer"
            >
              Společné údaje
            </button>
            <button
              type="button"
              onClick={() => void vystav()}
              disabled={bezi || chystane.length === 0}
              title="Vystaví jeden licenční list za každý výstup"
              className="rounded-pill bg-brand-purple text-white font-heading font-semibold text-sm px-4 py-1.5 hover:bg-brand-purpleDeep transition-colors cursor-pointer disabled:opacity-50"
            >
              {bezi
                ? 'Vystavuji…'
                : chystane.length > 1
                  ? `Vystavit ${chystane.length} listů`
                  : 'Vystavit list'}
            </button>
          </>
        )}
      </div>

      {canEdit && dalsiUdaje && (
        <div className="rounded-card border border-line bg-surface p-4 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {policko('klient', 'Klient', 'Pro koho spot je (koncový zadavatel).')}
            {policko('objednatel', 'Objednatel', 'Kdo si spot u nás objednal.')}
            {policko('dodavatel', 'Dodavatel')}
            {policko('uzemi', 'Území')}
            {policko('misto', 'Místo (V …, dne)', 'Např. „Brně“.')}
            {policko('podepisuje', 'Za MEDIA SPACE podepisuje')}
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Prodloužení licence a podmínky</span>
            <textarea
              value={spolecne.podminky}
              onChange={(e) => nastavSpolecne('podminky', e.target.value)}
              rows={6}
              className={`${pole} font-body resize-y`}
            />
            <span className="text-xs text-muted font-body">Odstavce oddělte prázdným řádkem.</span>
          </label>
        </div>
      )}

      <div className="grid grid-cols-1 min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(0,480px)] gap-5 items-start">
        <div className="flex flex-col gap-3 min-w-0">
          {canEdit && (
            <ul className="list-none p-0 m-0 flex flex-col gap-2">
              {chystane.map((r, i) => (
                <li key={r.klic}>
                  <div
                    onMouseDown={() => setVybrany(i)}
                    className={`flex items-center gap-2 flex-wrap rounded-card border bg-surface px-3 py-2 transition-colors ${
                      i === vybrany ? 'border-brand-purple' : 'border-line'
                    }`}
                  >
                    <input
                      value={r.nazevSpotu}
                      onChange={(e) => nastavRadek(i, { nazevSpotu: e.target.value })}
                      onFocus={() => setVybrany(i)}
                      placeholder="Název spotu"
                      aria-label="Název spotu"
                      className="flex-1 min-w-[140px] max-w-[260px] rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-ink font-heading font-semibold text-sm outline-none hover:border-line focus:border-brand-purple focus:bg-field"
                    />

                    <VyberVOkne
                      popisek="Interpreti"
                      prazdne="interpreti"
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
                      placeholder="délka"
                      aria-label="Délka licence"
                      title="Na jak dlouho je licence sjednaná — „1 rok“, „18 měsíců“"
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
                      title="Přepnout výhradní / nevýhradní"
                      className="shrink-0 rounded-pill border border-brand-purple/50 bg-brand-purple/10 text-brand-purpleDeep dark:text-brand-purpleLight px-3 py-1.5 text-xs font-heading transition-colors hover:border-brand-purple"
                    >
                      {r.typLicence}
                    </button>

                    <MenuListu
                      bezi={bezi}
                      datumVyroby={r.datumVyroby}
                      media={r.media}
                      onDatum={(d) => nastavRadek(i, { datumVyroby: d })}
                      onMedia={(m) =>
                        nastavRadek(i, {
                          media: m,
                          typDila: m ? `Hlasový výkon pro audio spot na ${m}` : r.typDila,
                        })
                      }
                      onVystav={() => void vystav(i)}
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
              Hotovo — vystaveno {hotovo === 1 ? '1 list' : `${hotovo} listů`}.
            </p>
          )}

          {/* Vystavené listy - jeden řádek na list, jako výstupy. */}
          {listy.length === 0 ? (
            <p className="text-sm font-body text-muted m-0">Zatím žádný vystavený list.</p>
          ) : (
            <ul className="list-none p-0 m-0 flex flex-col gap-2">
              {listy.map((l) => (
                <li key={l.id}>
                  <div className="flex items-center gap-2 flex-wrap rounded-card border border-line bg-field/40 px-3 py-2">
                    <a
                      href={`/api/licencni-list/${l.id}`}
                      target="_blank"
                      rel="noopener"
                      title={l.interpret}
                      className="flex-1 min-w-[140px] px-2 text-sm font-heading font-semibold text-ink no-underline hover:text-brand-purple truncate"
                    >
                      {l.interpret}
                    </a>
                    <span className="shrink-0 rounded-pill border border-line text-muted px-3 py-1.5 text-xs font-heading">
                      {[l.delkaLicence, l.typLicence].filter(Boolean).join(' · ')}
                    </span>
                    <span className="shrink-0 text-xs font-body text-muted">
                      {new Date(l.createdAt).toLocaleDateString('cs-CZ')}
                    </span>
                    {l.driveUrl ? (
                      <a
                        href={l.driveUrl}
                        target="_blank"
                        rel="noopener"
                        title="Kopie ve složce projektu na Disku"
                        className="shrink-0 text-xs font-heading text-brand-purple no-underline hover:underline"
                      >
                        Disk ↗
                      </a>
                    ) : (
                      l.driveError && (
                        <span title={l.driveError} className="shrink-0 text-xs font-body text-status-progress">
                          Disk ✕
                        </span>
                      )
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => void smaz(l.id)}
                        title="Smazat licenční list"
                        aria-label="Smazat licenční list"
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
              <span className="text-sm font-heading font-semibold text-ink">Náhled licenčního listu</span>
              {nahledSeDela && <span className="text-xs font-body text-muted">Překresluji…</span>}
            </span>
            <div className="relative w-full">
              <iframe
                // #view=Fit ukáže celou stránku, ne jen její šířku; rámeček má
                // poměr A4, takže na PDF sedí a posuvník nevznikne.
                src={nahledUrl ? `${nahledUrl}#view=Fit&toolbar=0&navpanes=0` : undefined}
                title="Náhled licenčního listu"
                className={`w-full aspect-[210/297] rounded-card border border-line bg-white transition-opacity ${
                  nahledSeDela ? 'opacity-60' : 'opacity-100'
                }`}
              />
              {nahledUrl && (
                <button
                  type="button"
                  onClick={() => setVelkyNahled(true)}
                  title="Zvětšit náhled"
                  aria-label="Zvětšit náhled licenčního listu"
                  className="absolute inset-0 rounded-card border-0 bg-transparent cursor-zoom-in hover:bg-brand-purple/5 transition-colors"
                />
              )}
            </div>
            {chystane.length > 1 && radekNahledu && (
              <span className="text-xs font-body text-muted">
                V náhledu je <strong className="font-heading text-ink">{radekNahledu.nazevSpotu}</strong> —
                klepnutím na jiný řádek se přepne.
              </span>
            )}
          </div>
        )}
      </div>

      {velkyNahled && nahledUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Náhled licenčního listu"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setVelkyNahled(false);
          }}
          className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <iframe
            src={`${nahledUrl}#view=Fit&toolbar=0&navpanes=0`}
            title="Náhled licenčního listu"
            className="h-[94vh] max-w-[96vw] aspect-[210/297] rounded-card border-0 bg-white shadow-2xl"
          />
          <button
            type="button"
            onClick={() => setVelkyNahled(false)}
            aria-label="Zavřít náhled"
            className="absolute top-4 right-4 rounded-pill bg-surface border border-line text-ink font-heading text-sm px-4 py-1.5 cursor-pointer hover:text-brand-purple hover:border-brand-purple transition-colors"
          >
            Zavřít
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
  onMedia,
  onDatum,
  onVystav,
}: {
  bezi: boolean;
  media: string;
  datumVyroby: string;
  onMedia: (media: string) => void;
  onDatum: (datum: string) => void;
  onVystav: () => void;
}) {
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
        title="Média, datum výroby, vystavit tenhle list"
        aria-label="Další u tohoto listu"
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
            <span className="text-[11px] font-heading text-muted uppercase tracking-wide">Média</span>
            <input
              value={media}
              onChange={(e) => onMedia(e.target.value)}
              placeholder="Rádio, Online"
              className="rounded-lg border border-line bg-field px-2 py-1.5 text-sm font-heading text-ink outline-none focus:border-brand-purple"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-heading text-muted uppercase tracking-wide">Datum výroby</span>
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
            Vystavit jen tenhle list
          </button>
        </div>
      )}
    </div>
  );
}
