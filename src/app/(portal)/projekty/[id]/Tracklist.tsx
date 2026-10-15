'use client';

import { useState } from 'react';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';
// Z čisté části knihovny - tracklistServer sahá na Prismu a na Disk,
// a ten se do prohlížeče zabalit nesmí (viz lib/tracklist.ts).
import { cisloTracku, zakladKapitoly, type Track } from '@/lib/tracklist';

/**
 * TRACKLIST AUDIOKNIHY (zadání 15. 10. 2026: „vytvoř v detailu každého
 * projektu, který je audiokniha, ještě záložku tracklist. Tam bude seznam
 * tracků editovatelný" → „pořadové číslo, název tracku, název kapitoly"
 * → „01, 02, 03").
 *
 * Řádek = jedna stopa, tři sloupce. ČÍSLO SE NEZADÁVÁ: dopočítá se z pořadí
 * a píše se dvojmístně (01, 02, 03) - jinak by se při každém přehození
 * muselo přečíslovat ručně a dvě stopy by mohly mít totéž číslo.
 *
 * TŘI ZPŮSOBY, JAK HO NAPLNIT, protože každý začíná jinde:
 *  - psát po jedné (nová kniha, tracklist vzniká od stolu),
 *  - nalepit názvy kapitol z obsahu knihy naráz (nejčastější),
 *  - načíst názvy tracků z nahrávek ve složce projektu (když se natáčelo
 *    dřív, než se tracklist psal).
 */
type Radek = { nazevTracku: string; nazevKapitoly: string };

export function Tracklist({
  caflouProjectId,
  pocatecni,
}: {
  caflouProjectId: string;
  pocatecni: Track[];
}) {
  const t = usePreklad();
  const adresa = `/api/projekty/${encodeURIComponent(caflouProjectId)}/tracklist`;
  const naRadky = (seznam: Track[]): Radek[] =>
    seznam.map((x) => ({ nazevTracku: x.nazevTracku, nazevKapitoly: x.nazevKapitoly }));

  const [tracky, setTracky] = useState<Radek[]>(naRadky(pocatecni));
  const [ulozene, setUlozene] = useState<string>(JSON.stringify(naRadky(pocatecni)));
  const [vkladani, setVkladani] = useState(false);
  const [vlozeny, setVlozeny] = useState('');
  const [bezi, setBezi] = useState<string | null>(null);
  const [hlaska, setHlaska] = useState<string | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);

  const zmeneno = JSON.stringify(tracky) !== ulozene;

  const pole =
    'w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple';

  function nastav(i: number, co: keyof Radek, hodnota: string) {
    const nove = [...tracky];
    nove[i] = { ...nove[i], [co]: hodnota };
    setTracky(nove);
  }

  /**
   * ROZDĚLENÍ TRACKU (zadání 15. 10. 2026: „někdy se stane, že potřebujeme
   * track rozdělit kvůli délce, tak si dokážu představit, že tam bude u toho
   * tracku nějaké tlačítko rozdělit track, automaticky se přidá k názvu
   * kapitoly ‚Část 1'").
   *
   * Z jedné kapitoly se udělají dvě stopy a obě dostanou k názvu kapitoly
   * „Část 1" a „Část 2". Když je kapitola rozdělená už teď, přibyde další
   * část a CELÁ SKUPINA SE PŘEČÍSLUJE - jinak by po rozdělení prostřední
   * části vznikly dvě „Část 2".
   *
   * Název tracku se do nové stopy zkopíruje; jak se doopravdy bude jmenovat
   * soubor, ví až ten, kdo ho vyrábí.
   */
  function rozdel(i: number) {
    const puvodni = tracky[i];
    const base = zakladKapitoly(puvodni.nazevKapitoly);
    const nove = [...tracky];
    nove.splice(i + 1, 0, { nazevTracku: puvodni.nazevTracku, nazevKapitoly: base });

    // Souvislý blok stop se stejnou kapitolou kolem rozděleného místa.
    let od = i;
    while (od > 0 && zakladKapitoly(nove[od - 1].nazevKapitoly) === base) od -= 1;
    let doKonce = i + 1;
    while (doKonce + 1 < nove.length && zakladKapitoly(nove[doKonce + 1].nazevKapitoly) === base) doKonce += 1;

    for (let k = od; k <= doKonce; k += 1) {
      const cislo = k - od + 1;
      nove[k] = {
        ...nove[k],
        nazevKapitoly: base ? `${base}, ${t('tracklist.cast', { cislo })}` : t('tracklist.cast', { cislo }),
      };
    }
    setTracky(nove);
  }

  /**
   * Nalepený seznam jde do NÁZVŮ KAPITOL - z obsahu knihy se kopírují ty.
   * Když už tracky existují, jen se jim kapitoly doplní po řádcích; co je
   * navíc, přibude jako nové stopy.
   */
  function vlozSeznam() {
    const radky = vlozeny
      .split('\n')
      // Z obsahu knihy se často kopíruje i číslo kapitoly - to si doplníme sami.
      .map((r) => r.replace(/^\s*\d{1,3}\s*[._)\-]\s*/, '').trim())
      .filter(Boolean);
    if (radky.length === 0) return;
    const nove: Radek[] = radky.map((kapitola, i) => ({
      nazevTracku: tracky[i]?.nazevTracku ?? '',
      nazevKapitoly: kapitola,
    }));
    // Stopy navíc, ke kterým se kapitola nenašla, zůstanou tak, jak byly.
    setTracky([...nove, ...tracky.slice(radky.length)]);
    setVlozeny('');
    setVkladani(false);
  }

  async function zDisku() {
    setBezi('disk');
    setChyba(null);
    setHlaska(null);
    try {
      const res = await fetch(`${adresa}?zDisku=1`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!data?.ok) {
        setChyba(data?.duvod || t('tracklist.zDiskuNeslo'));
        return;
      }
      // Názvy kapitol se nepřepisují - ty ze souboru poznat nejde.
      const zDiskuTracky = data.tracky as Track[];
      setTracky(
        zDiskuTracky.map((x, i) => ({
          nazevTracku: x.nazevTracku,
          nazevKapitoly: tracky[i]?.nazevKapitoly ?? '',
        })),
      );
      setHlaska(t('tracklist.zDiskuNacteno', { pocet: zDiskuTracky.length }));
    } catch {
      setChyba(t('tracklist.zDiskuNeslo'));
    } finally {
      setBezi(null);
    }
  }

  async function uloz() {
    setBezi('ulozit');
    setChyba(null);
    setHlaska(null);
    try {
      const res = await fetch(adresa, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracky }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || t('tracklist.ulozeniNeslo'));
        return;
      }
      const nove = naRadky((data.tracky ?? []) as Track[]);
      setTracky(nove);
      setUlozene(JSON.stringify(nove));
      setHlaska(t('tracklist.ulozeno'));
    } catch {
      setChyba(t('tracklist.ulozeniNeslo'));
    } finally {
      setBezi(null);
    }
  }

  return (
    <div className="flex flex-col gap-3 max-w-[900px]">
      <p className="text-sm font-body text-muted m-0">{t('tracklist.uvod')}</p>

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setVkladani((v) => !v)}
          className="font-heading font-semibold text-sm rounded-lg px-3.5 py-2 border border-line text-brand-purple hover:bg-tint transition-colors cursor-pointer bg-transparent"
        >
          {t('tracklist.vlozitSeznam')}
        </button>
        <button
          type="button"
          onClick={zDisku}
          disabled={bezi !== null}
          className="font-heading font-semibold text-sm rounded-lg px-3.5 py-2 border border-line text-brand-purple hover:bg-tint transition-colors cursor-pointer bg-transparent disabled:opacity-50"
        >
          {bezi === 'disk' ? t('obecne.nacitam') : t('tracklist.zDisku')}
        </button>
      </div>

      {vkladani && (
        <div className="flex flex-col gap-2 rounded-card border border-line bg-field p-3">
          <span className="text-xs font-body text-muted">{t('tracklist.vlozitPopis')}</span>
          <textarea
            value={vlozeny}
            onChange={(e) => setVlozeny(e.target.value)}
            rows={8}
            className={`${pole} font-body`}
            placeholder={t('tracklist.vlozitPriklad')}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={vlozSeznam}
              disabled={!vlozeny.trim()}
              className="font-heading font-semibold text-sm rounded-lg px-3.5 py-2 bg-brand-purple text-white border-0 cursor-pointer disabled:opacity-50"
            >
              {t('tracklist.nahraditSeznam')}
            </button>
            <button
              type="button"
              onClick={() => {
                setVkladani(false);
                setVlozeny('');
              }}
              className="font-heading text-sm text-muted hover:text-ink bg-transparent border-0 cursor-pointer"
            >
              {t('obecne.zrusit')}
            </button>
          </div>
        </div>
      )}

      {tracky.length === 0 ? (
        <p className="text-sm font-body text-muted m-0">{t('tracklist.zadne')}</p>
      ) : (
        <>
          {/* Záhlaví jen na širší obrazovce - na telefonu by se tři sloupce
              stejně nevešly a pole mají vlastní popisky v placeholderu. */}
          <div className="hidden sm:grid grid-cols-[34px_1fr_1fr_150px] gap-2 px-0.5">
            <span className="text-[11px] font-heading font-semibold uppercase tracking-wide text-muted">
              {t('tracklist.cislo')}
            </span>
            <span className="text-[11px] font-heading font-semibold uppercase tracking-wide text-muted">
              {t('tracklist.nazevTracku')}
            </span>
            <span className="text-[11px] font-heading font-semibold uppercase tracking-wide text-muted">
              {t('tracklist.nazevKapitoly')}
            </span>
            <span />
          </div>

          <ul className="list-none p-0 m-0 flex flex-col gap-1.5">
            {tracky.map((radek, i) => (
              <li key={i} className="grid grid-cols-[34px_1fr_150px] sm:grid-cols-[34px_1fr_1fr_150px] gap-2 items-center">
                <span className="text-right text-xs font-heading font-semibold text-muted tabular-nums">
                  {cisloTracku(i + 1)}
                </span>
                <input
                  value={radek.nazevTracku}
                  onChange={(e) => nastav(i, 'nazevTracku', e.target.value)}
                  className={pole}
                  placeholder={t('tracklist.nazevTracku')}
                />
                {/* Na telefonu je kapitola pod trackem, ať se pole nezmáčknou. */}
                <input
                  value={radek.nazevKapitoly}
                  onChange={(e) => nastav(i, 'nazevKapitoly', e.target.value)}
                  className={`${pole} col-start-2 sm:col-start-auto`}
                  placeholder={t('tracklist.nazevKapitoly')}
                />
                <span className="flex items-center justify-end gap-1 row-start-1 col-start-3 sm:col-start-auto">
                  {/* TLACITKO S NAPISEM, NE IKONA (upresneni 15. 10. 2026:
                      „u kazdeho radku napravo tlacitko Rozdelit"). */}
                  <button
                    type="button"
                    onClick={() => rozdel(i)}
                    title={t('tracklist.rozdelitPopis')}
                    className="font-heading font-semibold text-xs rounded-lg px-2.5 py-1.5 border border-line text-brand-purple hover:bg-tint transition-colors cursor-pointer bg-transparent whitespace-nowrap"
                  >
                    {t('tracklist.rozdelit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTracky(tracky.filter((_, j) => j !== i))}
                    title={t('tracklist.odebrat')}
                    aria-label={t('tracklist.odebrat')}
                    className="text-muted hover:text-danger px-1 bg-transparent border-0 cursor-pointer"
                  >
                    x
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => setTracky([...tracky, { nazevTracku: '', nazevKapitoly: '' }])}
          className="font-heading font-semibold text-sm rounded-lg px-3.5 py-2 border border-line text-brand-purple hover:bg-tint transition-colors cursor-pointer bg-transparent"
        >
          {t('tracklist.pridat')}
        </button>
        <button
          type="button"
          onClick={uloz}
          disabled={bezi !== null || !zmeneno}
          className="font-heading font-semibold text-sm rounded-lg px-3.5 py-2 bg-brand-green text-onAccent border-0 cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {bezi === 'ulozit' ? t('obecne.ukladam') : t('tracklist.ulozit')}
        </button>
        {zmeneno && <span className="text-xs font-body text-muted">{t('tracklist.neulozeno')}</span>}
        {hlaska && <span className="text-xs font-body text-muted">{hlaska}</span>}
        {chyba && <span className="text-xs font-body text-danger">{chyba}</span>}
      </div>
    </div>
  );
}
