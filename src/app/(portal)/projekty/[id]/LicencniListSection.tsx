'use client';

import { useEffect, useRef, useState } from 'react';
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
 * zbytek (klient, objednatel, území, podmínky, podpis) se mění málokdy, takže
 * sedí složený pod tlačítkem „Další údaje". Vpravo je náhled listu na A4.
 *
 * Jeden list = jeden interpret; u spotu s víc herci se vystaví pro každého
 * zvlášť, se stejným rozsahem.
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
 * VÝSTUP, ZE KTERÉHO SE LIST DĚLÁ (zadání 27. 9. 2026: „udělej rovnou
 * návaznost na licenční listy, ať je to předvyplněné"). Licence se sjednává
 * ke konkrétnímu spotu, ne k celé zakázce - u Strabagu má každá délka jiné
 * herce i jiná média. Výběrem výstupu se přepíše název spotu, média, délka
 * licence, datum výroby a vyberou se jeho herci.
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
  /**
   * VÍC HERCŮ NAJEDNOU (22. 9. 2026: „u těch licenčních listů chci vybírat
   * konkrétní herce a mnohonásobný výběr"). Každý dostane vlastní licenční
   * list se stejným rozsahem licence.
   */
  const [vybrani, setVybrani] = useState<{ id: string | null; jmeno: string }[]>(
    vychozi.herci.map((h) => ({ id: h.id, jmeno: h.jmeno })),
  );
  /** Jména dopsaná ručně - v okně se pak nabízejí jako všichni ostatní. */
  const [dopsani, setDopsani] = useState<string[]>([]);
  const { herci: _herci, vsichniHerci: _vsichni, ...zbytek } = vychozi;
  const [v, setV] = useState(zbytek);
  const [bezi, setBezi] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [hotovo, setHotovo] = useState<string[]>([]);
  /** Ze kterého výstupu se list dělá. */
  const [vystupId, setVystupId] = useState<string | null>(vystupy[0]?.id ?? null);
  const [dalsiUdaje, setDalsiUdaje] = useState(false);
  const [velkyNahled, setVelkyNahled] = useState(false);
  const [nahledUrl, setNahledUrl] = useState<string | null>(null);
  const [nahledSeDela, setNahledSeDela] = useState(false);
  const posledniUrl = useRef<string | null>(null);

  const nastav = <K extends keyof typeof v>(k: K, hodnota: (typeof v)[K]) =>
    setV((p) => ({ ...p, [k]: hodnota }));

  /**
   * Nabídka do okna s interprety: herci projektu, ručně dopsaní a zbytek
   * databáze. Pořadí je schválně takové - kdo dělal na projektu, je nahoře.
   */
  const nabidkaHercu: { id: string; nazev: string; ikona: null }[] = [];
  const pridejDoNabidky = (id: string, nazev: string) => {
    if (!nazev || nabidkaHercu.some((x) => x.id === id)) return;
    nabidkaHercu.push({ id, nazev, ikona: null });
  };
  for (const h of vychozi.herci) pridejDoNabidky(h.id ?? `${KLIC_JMENA}${h.jmeno}`, h.jmeno);
  for (const vy of vystupy) for (const h of vy.herci) pridejDoNabidky(h.id, h.jmeno);
  for (const j of dopsani) pridejDoNabidky(`${KLIC_JMENA}${j}`, j);
  for (const h of vychozi.vsichniHerci) pridejDoNabidky(h.id, h.jmeno);

  const klicHerce = (h: { id: string | null; jmeno: string }) => h.id ?? `${KLIC_JMENA}${h.jmeno}`;
  const vybraneKlice = vybrani.map(klicHerce);

  function zmenInterprety(klice: string[]) {
    setVybrani(
      klice.map((k) =>
        k.startsWith(KLIC_JMENA)
          ? { id: null, jmeno: k.slice(KLIC_JMENA.length) }
          : { id: k, jmeno: nabidkaHercu.find((x) => x.id === k)?.nazev ?? '' },
      ),
    );
  }

  /**
   * Převzetí údajů z výstupu. Přepisuje jen to, co výstup opravdu ví - do
   * podmínek, místa ani podepisujícího se nesahá.
   */
  function vezmiZVystupu(vy: VystupProLicenci) {
    setVystupId(vy.id);
    setV((p) => ({
      ...p,
      nazevSpotu: vy.nazev || p.nazevSpotu,
      media: vy.media || p.media,
      typDila: vy.media ? `Hlasový výkon pro audio spot na ${vy.media}` : p.typDila,
      delkaLicence: vy.mesicu ? delkaZMesicu(vy.mesicu) : p.delkaLicence,
      datumVyroby: vy.datumVyroby || p.datumVyroby,
    }));
    if (vy.herci.length > 0) setVybrani(vy.herci.map((h) => ({ id: h.id, jmeno: h.jmeno })));
  }

  // Při prvním otevření se vezme první výstup - v drtivé většině je jediný.
  const prvniNacteni = useRef(true);
  useEffect(() => {
    if (!prvniNacteni.current) return;
    prvniNacteni.current = false;
    const prvni = vystupy[0];
    if (prvni) vezmiZVystupu(prvni);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * ŽIVÝ NÁHLED. Tentýž PDF list, jaký pak vznikne - jen se nikam neukládá.
   * Čeká se půl vteřiny po posledním ťuknutí, aby se dokument nevyráběl po
   * každém písmenu, a rozdělaný požadavek se ruší, ať pomalejší starší
   * odpověď nepřebije novější.
   */
  useEffect(() => {
    if (!canEdit) return;
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
            body: JSON.stringify({ ...v, interpret: vybrani[0]?.jmeno ?? '' }),
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
  }, [v, vybrani, canEdit, caflouProjectId]);

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

  async function vystav() {
    if (vybrani.length === 0) {
      setChyba('Vyberte aspoň jednoho interpreta.');
      return;
    }
    setBezi(true);
    setChyba(null);
    setHotovo([]);
    try {
      const nova: string[] = [];
      for (const h of vybrani) {
        const res = await fetch(`/api/projects/${encodeURIComponent(caflouProjectId)}/licencni-list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...v, interpret: h.jmeno, actorUserId: h.id }),
        });
        const telo = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(`${h.jmeno}: ${telo.error || 'licenční list se nepodařilo vystavit.'}`);
        nova.push(telo.id);
      }
      setHotovo(nova);
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
    k: 'klient' | 'objednatel' | 'dodavatel' | 'typDila' | 'uzemi' | 'media' | 'misto' | 'podepisuje',
    label: string,
    napoveda?: string,
  ) => (
    <label key={k} className="flex flex-col gap-1.5">
      <span className="text-sm font-body text-ink">{label}</span>
      <input value={v[k]} onChange={(e) => nastav(k, e.target.value)} disabled={!canEdit} className={pole} />
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
          <button
            type="button"
            onClick={() => void vystav()}
            disabled={bezi}
            title="Každý vybraný interpret dostane vlastní list se stejným rozsahem"
            className="ml-auto rounded-pill bg-brand-purple text-white font-heading font-semibold text-sm px-4 py-1.5 hover:bg-brand-purpleDeep transition-colors cursor-pointer disabled:opacity-50"
          >
            {bezi ? 'Vystavuji…' : vybrani.length > 1 ? `Vystavit ${vybrani.length} listy` : 'Vystavit list'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(0,480px)] gap-5 items-start">
        <div className="flex flex-col gap-3 min-w-0">
          {canEdit && (
            <>
              {/* CELÝ ROZSAH LICENCE NA JEDNOM ŘÁDKU - stejně jako výstup. */}
              <div className="flex items-center gap-2 flex-wrap rounded-card border border-line bg-surface px-3 py-2">
                <input
                  value={v.nazevSpotu}
                  disabled={!canEdit}
                  onChange={(e) => nastav('nazevSpotu', e.target.value)}
                  placeholder="Název spotu"
                  aria-label="Název spotu"
                  className="flex-1 min-w-[140px] max-w-[280px] rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-ink font-heading font-semibold text-sm outline-none hover:border-line focus:border-brand-purple focus:bg-field disabled:opacity-60"
                />

                {vystupy.length > 1 && (
                  <VyberVOkne
                    popisek="Výstup"
                    prazdne="výstup"
                    jedno
                    polozky={vystupy.map((vy) => ({ id: vy.id, nazev: vy.nazev, ikona: null }))}
                    vybrane={vystupId ? [vystupId] : []}
                    onZmena={(ids) => {
                      const vy = vystupy.find((x) => x.id === ids[0]);
                      if (vy) vezmiZVystupu(vy);
                    }}
                  />
                )}

                <VyberVOkne
                  popisek="Interpreti"
                  prazdne="interpreti"
                  polozky={nabidkaHercu}
                  vybrane={vybraneKlice}
                  onZmena={zmenInterprety}
                  onPridatJmeno={(jmeno) => {
                    setDopsani((p) => (p.includes(jmeno) ? p : [...p, jmeno]));
                    setVybrani((p) =>
                      p.some((x) => !x.id && x.jmeno === jmeno) ? p : [...p, { id: null, jmeno }],
                    );
                  }}
                />

                <input
                  value={v.delkaLicence}
                  disabled={!canEdit}
                  onChange={(e) => nastav('delkaLicence', e.target.value)}
                  placeholder="délka"
                  aria-label="Délka licence"
                  title="Na jak dlouho je licence sjednaná — „1 rok“, „18 měsíců“"
                  className="w-[104px] shrink-0 rounded-lg border border-line bg-field px-2 py-1.5 text-ink font-heading text-sm text-center outline-none focus:border-brand-purple disabled:opacity-60"
                />

                {/* Typ licence má jen dvě hodnoty - klepnutím se přehodí. */}
                <button
                  type="button"
                  onClick={() => nastav('typLicence', v.typLicence === 'výhradní' ? 'nevýhradní' : 'výhradní')}
                  title="Přepnout výhradní / nevýhradní"
                  className="shrink-0 rounded-pill border border-brand-purple/50 bg-brand-purple/10 text-brand-purpleDeep dark:text-brand-purpleLight px-3 py-1.5 text-xs font-heading transition-colors hover:border-brand-purple"
                >
                  {v.typLicence}
                </button>

                <button
                  type="button"
                  onClick={() => setDalsiUdaje((o) => !o)}
                  title="Klient, objednatel, území, podmínky, podpis"
                  aria-label="Další údaje licenčního listu"
                  aria-expanded={dalsiUdaje}
                  className="shrink-0 w-8 h-8 grid place-items-center rounded-full border border-line text-muted bg-surface hover:text-brand-purple hover:border-brand-purple transition-colors cursor-pointer"
                >
                  ⋯
                </button>
              </div>

              {/* Zbytek listu. Mění se málokdy, tak je složený. */}
              {dalsiUdaje && (
                <div className="rounded-card border border-line bg-surface p-4 flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {policko('klient', 'Klient', 'Pro koho spot je (koncový zadavatel).')}
                    {policko('objednatel', 'Objednatel', 'Kdo si spot u nás objednal.')}
                    {policko('dodavatel', 'Dodavatel')}
                    {policko('typDila', 'Typ díla')}
                    {policko('uzemi', 'Území')}
                    {policko('media', 'Média', 'Předvyplněno z licencí výstupu.')}
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-body text-ink">Datum výroby</span>
                      <DatumPole
                        value={v.datumVyroby}
                        onChange={(e) => nastav('datumVyroby', e.target.value)}
                        className={pole}
                      />
                    </label>
                    {policko('misto', 'Místo (V …, dne)', 'Např. „Brně“.')}
                    {policko('podepisuje', 'Za MEDIA SPACE podepisuje')}
                  </div>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-body text-ink">Prodloužení licence a podmínky</span>
                    <textarea
                      value={v.podminky}
                      onChange={(e) => nastav('podminky', e.target.value)}
                      rows={6}
                      className={`${pole} font-body resize-y`}
                    />
                    <span className="text-xs text-muted font-body">Odstavce oddělte prázdným řádkem.</span>
                  </label>
                </div>
              )}
            </>
          )}

          {chyba && (
            <p className="text-sm font-body text-status-error m-0" role="alert">
              {chyba}
            </p>
          )}
          {hotovo.length > 0 && (
            <p className="text-sm font-heading text-brand-greenDeep m-0">
              Hotovo — vystaveno {hotovo.length === 1 ? '1 list' : `${hotovo.length} listů`}.
            </p>
          )}

          {/* Vystavené listy - jeden řádek na list, jako výstupy. */}
          {listy.length === 0 ? (
            <p className="text-sm font-body text-muted m-0">Zatím žádný vystavený list.</p>
          ) : (
            <ul className="list-none p-0 m-0 flex flex-col gap-2">
              {listy.map((l) => (
                <li key={l.id}>
                  <div className="flex items-center gap-2 flex-wrap rounded-card border border-line bg-surface px-3 py-2">
                    <a
                      href={`/api/licencni-list/${l.id}`}
                      target="_blank"
                      rel="noopener"
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
            {vybrani.length > 1 && (
              <span className="text-xs font-body text-muted">
                V náhledu je {vybrani[0]?.jmeno}; list se vystaví pro každého interpreta zvlášť.
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
