'use client';

import { useState } from 'react';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';
import { cisloTracku, zakladKapitoly, type Track } from '@/lib/tracklist';

/**
 * TRACKLIST AUDIOKNIHY (zadání 15. 10. 2026: „vytvoř v detailu každého
 * projektu, který je audiokniha, ještě záložku tracklist. Tam bude seznam
 * tracků editovatelný" → „pořadové číslo, název tracku, název kapitoly"
 * → „01, 02, 03").
 *
 * TRACKLIST SE NIKDE NENAČÍTÁ (upřesnění 15. 10. 2026: „nechci nikde načítat
 * tracklist. Tohle by se mělo dít v první fázi, když tam nebude žádný track.
 * Tohle je právě manuál na to, jak to popisovat"). Je to PŘEDPIS, ne soupis
 * toho, co už na Disku leží: podle něj se stopy teprve pojmenují. Proto se
 * zakládá na začátku a z vlastního vzoru, ne z hotových souborů.
 *
 * ZALOŽENÍ NARÁZ (upřesnění: „chci mít i možnost přidat naráz i třeba 50
 * tracků jedním klikem. Nastaví se pořadová čísla a názvy tracků podle vzoru.
 * Na to může být někde pole"). Padesát řádků po jednom nikdo klikat nebude.
 *
 * NÁZEV KAPITOLY ZŮSTÁVÁ PRÁZDNÝ („jen je doplním") - ten se z ničeho
 * odvodit nedá a vypisuje se ručně z knihy.
 */
type Radek = { nazevTracku: string; nazevKapitoly: string };

export function Tracklist({
  caflouProjectId,
  nazevProjektu,
  pocatecni,
}: {
  caflouProjectId: string;
  nazevProjektu: string;
  pocatecni: Track[];
}) {
  const t = usePreklad();
  const adresa = `/api/projekty/${encodeURIComponent(caflouProjectId)}/tracklist`;
  const naRadky = (seznam: Track[]): Radek[] =>
    seznam.map((x) => ({ nazevTracku: x.nazevTracku, nazevKapitoly: x.nazevKapitoly }));

  const [tracky, setTracky] = useState<Radek[]>(naRadky(pocatecni));
  const [ulozene, setUlozene] = useState<string>(JSON.stringify(naRadky(pocatecni)));
  const [pocet, setPocet] = useState('20');
  const [vzor, setVzor] = useState(nazevProjektu);
  const [vkladani, setVkladani] = useState(false);
  const [vlozeny, setVlozeny] = useState('');
  const [bezi, setBezi] = useState(false);
  const [hlaska, setHlaska] = useState<string | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);

  const zmeneno = JSON.stringify(tracky) !== ulozene;

  const pole =
    'w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple';
  const popisek = 'text-[11px] font-heading font-semibold uppercase tracking-wide text-muted';

  function nastav(i: number, co: keyof Radek, hodnota: string) {
    const nove = [...tracky];
    nove[i] = { ...nove[i], [co]: hodnota };
    setTracky(nove);
  }

  /**
   * Název stopy ze vzoru: pořadové číslo se vždycky přilepí na konec
   * (upřesnění 15. 10. 2026 - žádná proměnná ve vzoru, je zbytečná).
   * „Kuchaři smrti" a trojka dají „Kuchaři smrti 03".
   */
  function podleVzoru(poradi: number): string {
    const cislo = cisloTracku(poradi);
    const text = vzor.trim();
    return text ? `${text} ${cislo}` : cislo;
  }

  /**
   * Založí stopy naráz. Když už nějaké jsou, PŘIDÁ SE ZA NĚ a čísluje se dál -
   * přepsat hotovou práci jedním kliknutím by byla past.
   */
  function zalozNaraz() {
    const kolik = Math.min(300, Math.max(1, parseInt(pocet.replace(/\D/g, ''), 10) || 0));
    if (kolik <= 0) return;
    const od = tracky.length;
    const nove: Radek[] = Array.from({ length: kolik }, (_, i) => ({
      nazevTracku: podleVzoru(od + i + 1),
      // Kapitola zůstává prázdná - doplňuje se ručně z knihy.
      nazevKapitoly: '',
    }));
    setTracky([...tracky, ...nove]);
    setHlaska(t('tracklist.zalozeno', { pocet: kolik }));
  }

  /**
   * ROZDĚLENÍ TRACKU (upřesnění 15. 10. 2026: „když to tlačítko zmáčknu, tak
   * se jen změní pořadové číslo, název tracku zůstane a zkopíruje se název
   * kapitoly, protože tu kapitolu dělíme, a přidá se ‚Část 1'").
   *
   * Vznikne druhá stopa se stejným názvem tracku a toutéž kapitolou; obě
   * dostanou „Část 1" a „Část 2". Když je kapitola rozdělená už teď, přibyde
   * další část a CELÁ SKUPINA SE PŘEČÍSLUJE - jinak by po rozdělení prostřední
   * části vznikly dvě „Část 2".
   */
  function rozdel(i: number) {
    const puvodni = tracky[i];
    const base = zakladKapitoly(puvodni.nazevKapitoly);
    const cast = (poradi: number) =>
      base ? base + ', ' + t('tracklist.cast', { cislo: poradi }) : t('tracklist.cast', { cislo: poradi });

    const nove = [...tracky];
    // Nova stopa je kopie te puvodni - vsechno ostatni zustava, meni se jen
    // nazev kapitoly a poradova cisla stop za ni (ta se dopocitavaji sama).
    nove.splice(i + 1, 0, { ...puvodni });

    /**
     * SKUPINU HLEDAME JEN U POJMENOVANE KAPITOLY (oprava 15. 10. 2026).
     * Dokud jsou kapitoly prazdne - a hned po zalozeni seznamu jsou - maji
     * prazdny zaklad VSECHNY stopy, takze by precislovani udelalo z cele
     * knihy "Cast 1" az "Cast 50". U prazdne kapitoly se proto deli jen ta
     * jedna dvojice.
     */
    let od = i;
    let doKonce = i + 1;
    if (base) {
      while (od > 0 && zakladKapitoly(nove[od - 1].nazevKapitoly) === base) od -= 1;
      while (doKonce + 1 < nove.length && zakladKapitoly(nove[doKonce + 1].nazevKapitoly) === base) doKonce += 1;
    }

    for (let k = od; k <= doKonce; k += 1) {
      nove[k] = { ...nove[k], nazevKapitoly: cast(k - od + 1) };
    }
    setTracky(nove);
  }

  /** Nalepený seznam jde do NÁZVŮ KAPITOL - z obsahu knihy se kopírují ty. */
  function vlozSeznam() {
    const radky = vlozeny
      .split('\n')
      .map((r) => r.replace(/^\s*\d{1,3}\s*[._)\-]\s*/, '').trim())
      .filter(Boolean);
    if (radky.length === 0) return;
    const nove: Radek[] = radky.map((kapitola, i) => ({
      nazevTracku: tracky[i]?.nazevTracku ?? podleVzoru(i + 1),
      nazevKapitoly: kapitola,
    }));
    setTracky([...nove, ...tracky.slice(radky.length)]);
    setVlozeny('');
    setVkladani(false);
  }

  async function uloz() {
    setBezi(true);
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
      setBezi(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-[900px]">
      <p className="text-sm font-body text-muted m-0">{t('tracklist.uvod')}</p>

      {/* ZALOŽENÍ NARÁZ - padesát stop jedním kliknutím. */}
      <div className="rounded-card border border-line bg-field p-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 w-[110px]">
          <span className={popisek}>{t('tracklist.pocetStop')}</span>
          <input
            inputMode="numeric"
            value={pocet}
            onChange={(e) => setPocet(e.target.value.replace(/\D/g, ''))}
            className={pole}
          />
        </label>
        <label className="flex flex-col gap-1.5 flex-1 min-w-[220px]">
          <span className={popisek}>{t('tracklist.vzorNazvu')}</span>
          <input value={vzor} onChange={(e) => setVzor(e.target.value)} className={pole} />
        </label>
        <button
          type="button"
          onClick={zalozNaraz}
          className="font-heading font-semibold text-sm rounded-lg px-4 py-2 bg-brand-purple text-white border-0 cursor-pointer hover:bg-brand-purpleDeep transition-colors"
        >
          {t('tracklist.zalozit')}
        </button>
        <span className="basis-full text-xs font-body text-muted">
          {t('tracklist.vzorPopis', { priklad: podleVzoru(tracky.length + 1) })}
        </span>
      </div>

      {tracky.length === 0 ? (
        <p className="text-sm font-body text-muted m-0">{t('tracklist.zadne')}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {/* Záhlaví kopíruje rozměry řádku níž - jedna a tatáž struktura. */}
          <div className="hidden sm:flex items-center gap-2 px-0.5">
            <span className={`${popisek} w-8 text-right`}>{t('tracklist.cislo')}</span>
            <span className={`${popisek} flex-1 min-w-[180px]`}>{t('tracklist.nazevTracku')}</span>
            <span className={`${popisek} flex-1 min-w-[180px]`}>{t('tracklist.nazevKapitoly')}</span>
            <span className="w-[150px]" />
          </div>

          <ul className="list-none p-0 m-0 flex flex-col gap-1.5">
            {tracky.map((radek, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <span className="w-8 shrink-0 text-right text-xs font-heading font-semibold text-muted tabular-nums">
                  {cisloTracku(i + 1)}
                </span>
                <input
                  value={radek.nazevTracku}
                  onChange={(e) => nastav(i, 'nazevTracku', e.target.value)}
                  className={`${pole} flex-1 min-w-[180px]`}
                  placeholder={t('tracklist.nazevTracku')}
                />
                <input
                  value={radek.nazevKapitoly}
                  onChange={(e) => nastav(i, 'nazevKapitoly', e.target.value)}
                  className={`${pole} flex-1 min-w-[180px]`}
                  placeholder={t('tracklist.nazevKapitoly')}
                />
                <span className="w-[150px] shrink-0 flex items-center justify-end gap-1">
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
                    className="text-muted hover:text-danger px-1.5 bg-transparent border-0 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => setTracky([...tracky, { nazevTracku: podleVzoru(tracky.length + 1), nazevKapitoly: '' }])}
          className="font-heading font-semibold text-sm rounded-lg px-3.5 py-2 border border-line text-brand-purple hover:bg-tint transition-colors cursor-pointer bg-transparent"
        >
          {t('tracklist.pridat')}
        </button>
        <button
          type="button"
          onClick={() => setVkladani((v) => !v)}
          className="font-heading font-semibold text-sm rounded-lg px-3.5 py-2 border border-line text-brand-purple hover:bg-tint transition-colors cursor-pointer bg-transparent"
        >
          {t('tracklist.vlozitSeznam')}
        </button>
        <button
          type="button"
          onClick={uloz}
          disabled={bezi || !zmeneno}
          className="font-heading font-semibold text-sm rounded-lg px-3.5 py-2 bg-brand-green text-onAccent border-0 cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {bezi ? t('obecne.ukladam') : t('tracklist.ulozit')}
        </button>
        {zmeneno && <span className="text-xs font-body text-muted">{t('tracklist.neulozeno')}</span>}
        {hlaska && <span className="text-xs font-body text-muted">{hlaska}</span>}
        {chyba && <span className="text-xs font-body text-danger">{chyba}</span>}
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
    </div>
  );
}
