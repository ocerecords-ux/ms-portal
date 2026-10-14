'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OdznakSerie } from '@/components/OdznakSerie';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';

/**
 * NÁZEV KNIHY A SÉRIE V DETAILU PROJEKTU (zadání 14. 10. 2026: „a chci,
 * ať to můžeme editovat... jen v detailu. Tam by měl jít upravit celý ten
 * název").
 *
 * JEDNO MÍSTO PRO OBOJÍ. Série a název se přepisují často zároveň - typicky
 * když se série vyndává z názvu, který klient napsal celý do jednoho pole.
 * V přehledu se nemění nic: kliknutí na název knihy má otevírat projekt,
 * ne pole k přepsání.
 *
 * PŘEJMENOVAT SMÍME JEN MY - komponenta se vykreslí s tužkou jen tomu, kdo
 * smí měnit údaje projektu; ostatní vidí obyčejný nadpis s kolečkem.
 * O právo se stejně ptá i server.
 *
 * Přejmenování není jen kosmetika: portál při něm přejmenuje i složku
 * projektu na Disku a kanál v chatu (viz api/projects/[id]/meta).
 */
export function NazevProjektu({
  caflouProjectId,
  nazev,
  serie,
  serieDil,
  dily = [],
  muzeMenit,
  navrhySerii = [],
}: {
  caflouProjectId: string;
  nazev: string;
  serie: string | null;
  serieDil: number | null;
  dily?: { id: number; name: string; dil: number | null }[];
  muzeMenit: boolean;
  /** Série, které u té firmy už jsou - proti třem podobám téhož názvu. */
  navrhySerii?: string[];
}) {
  const t = usePreklad();
  const router = useRouter();
  const [upravuje, setUpravuje] = useState(false);
  const [novyNazev, setNovyNazev] = useState(nazev);
  const [maSerii, setMaSerii] = useState(Boolean(serie));
  const [novaSerie, setNovaSerie] = useState(serie ?? '');
  const [novyDil, setNovyDil] = useState(serieDil != null ? String(serieDil) : '');
  const [uklada, setUklada] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  function zpet() {
    setNovyNazev(nazev);
    setMaSerii(Boolean(serie));
    setNovaSerie(serie ?? '');
    setNovyDil(serieDil != null ? String(serieDil) : '');
    setChyba(null);
    setUpravuje(false);
  }

  async function uloz() {
    const jmeno = novyNazev.trim();
    if (!jmeno || uklada) return;
    setUklada(true);
    setChyba(null);
    try {
      const fd = new FormData();
      fd.set('name', jmeno);
      // Odkliknutá série = prázdno, tedy zrušit (viz route).
      fd.set('serie', maSerii ? novaSerie.trim() : '');
      fd.set('serieDil', maSerii ? novyDil.trim() : '');
      const res = await fetch(`/api/projects/${encodeURIComponent(caflouProjectId)}/meta`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t('serie.ulozeniSelhalo'));
      setUpravuje(false);
      router.refresh();
    } catch (e) {
      setChyba(e instanceof Error ? e.message : t('serie.ulozeniSelhalo'));
    } finally {
      setUklada(false);
    }
  }

  if (!upravuje) {
    return (
      <span className="flex items-center gap-1.5 flex-wrap min-w-0">
        <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">{nazev}</h1>
        {serie && <OdznakSerie serie={serie} dil={serieDil} dily={dily} aktivniId={Number(caflouProjectId)} velky />}
        {muzeMenit && (
          <button
            type="button"
            onClick={() => setUpravuje(true)}
            title={t('serie.upravitNazev')}
            aria-label={t('serie.upravitNazev')}
            className="ml-1.5 grid place-items-center w-7 h-7 rounded-lg border border-line text-muted hover:text-brand-purple hover:border-brand-purple transition-colors bg-transparent cursor-pointer"
          >
            ✎
          </button>
        )}
      </span>
    );
  }

  const pole =
    'w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple';

  return (
    <div className="w-full max-w-[560px] rounded-card border border-line bg-field p-4 flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-heading font-semibold uppercase tracking-wide text-muted">
          {t('serie.poleNazev')}
        </span>
        <input
          autoFocus
          value={novyNazev}
          onChange={(e) => setNovyNazev(e.target.value)}
          className={`${pole} font-heading font-semibold text-base`}
        />
      </label>

      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={maSerii}
          onChange={(e) => setMaSerii(e.target.checked)}
          className="w-4 h-4 accent-brand-purple"
        />
        <span className="text-sm font-body text-ink">{t('serie.jeVSerii')}</span>
      </label>

      {maSerii && (
        <div className="flex gap-3 flex-wrap">
          <label className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <span className="text-[11px] font-heading font-semibold uppercase tracking-wide text-muted">
              {t('serie.poleNazevSerie')}
            </span>
            <input
              list="navrhy-serii"
              value={novaSerie}
              onChange={(e) => setNovaSerie(e.target.value)}
              placeholder={t('serie.poleNazevSeriePriklad')}
              className={pole}
            />
            {/* Našeptávač ze sérií té firmy - bez něj by vznikly tři podoby
                téhož názvu a nic by se neslepilo dohromady. */}
            <datalist id="navrhy-serii">
              {navrhySerii.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </label>
          <label className="flex flex-col gap-1.5 w-[90px]">
            <span className="text-[11px] font-heading font-semibold uppercase tracking-wide text-muted">
              {t('serie.poleDil')}
            </span>
            <input
              type="number"
              min={1}
              max={99}
              step={1}
              value={novyDil}
              onChange={(e) => setNovyDil(e.target.value)}
              className={pole}
            />
          </label>
        </div>
      )}

      {chyba && <p className="text-danger text-sm font-body m-0">{chyba}</p>}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => void uloz()}
          disabled={uklada || !novyNazev.trim()}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          {uklada ? t('obecne.ukladam') : t('obecne.ulozit')}
        </button>
        <button
          type="button"
          onClick={zpet}
          disabled={uklada}
          className="font-heading font-semibold text-sm text-muted hover:text-ink bg-transparent border-0 cursor-pointer"
        >
          {t('obecne.zrusit')}
        </button>
      </div>
    </div>
  );
}
