'use client';

import { useEffect, useState } from 'react';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';

/**
 * Přenos projektů z Caflou (zadání 10. 9. 2026).
 *
 * Jednorázový krok před odpojením Caflou. Schválně samostatná stránka
 * s jedním tlačítkem a hlavně s čísly - po přenosu je potřeba vidět, kolik
 * projektů dorazilo, aby se dalo porovnat s Caflou dřív, než se odpojí.
 */

type Prehled = {
  celkem: number;
  zCaflou: number;
  zPortalu: number;
  rozpracovane: number;
  bezNazvu: number;
};

type Vysledek = {
  precteno: number;
  zalozeno: number;
  aktualizovano: number;
  preskoceno: number;
  bezFirmy: string[];
  chyba: string | null;
  prehled: Prehled;
};

export function PrenosPanel() {
  const t = usePreklad();
  const [prehled, setPrehled] = useState<Prehled | null>(null);
  const [vysledek, setVysledek] = useState<Vysledek | null>(null);
  const [bezi, setBezi] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/projekty/prenos')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setPrehled(d))
      .catch(() => undefined);
  }, []);

  async function prenest() {
    setBezi(true);
    setChyba(null);
    setVysledek(null);
    try {
      const res = await fetch('/api/admin/projekty/prenos', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || t('prenos.nepodaril'));
        return;
      }
      setVysledek(data as Vysledek);
      setPrehled((data as Vysledek).prehled);
    } catch {
      setChyba(t('prenos.nepodarilZnovu'));
    } finally {
      setBezi(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <div className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-4">
        <p className="text-sm font-body text-muted m-0">{t('prenos.uvod')}</p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void prenest()}
            disabled={bezi}
            className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
          >
            {bezi ? t('prenos.prenasim') : t('prenos.prenestProjekty')}
          </button>
          {bezi && (
            <span className="text-xs font-body text-muted">{t('prenos.trvaToChvili')}</span>
          )}
        </div>

        {chyba && (
          <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{chyba}</p>
        )}
      </div>

      {prehled && (
        <div className="bg-surface border border-line rounded-card shadow-sm p-5">
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
            {t('prenos.coPortalDrzi')}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
            <Cislo popisek={t('prenos.projektuCelkem')} hodnota={prehled.celkem} />
            <Cislo popisek={t('prenos.zTohoZCaflou')} hodnota={prehled.zCaflou} />
            <Cislo popisek={t('prenos.zalozenoVPortalu')} hodnota={prehled.zPortalu} />
            <Cislo popisek={t('prenos.rozpracovanych')} hodnota={prehled.rozpracovane} />
            <Cislo popisek={t('prenos.bezNazvu')} hodnota={prehled.bezNazvu} varovat={prehled.bezNazvu > 0} />
          </div>
        </div>
      )}

      {vysledek && (
        <div className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
            {t('prenos.posledniPrenos')}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Cislo popisek={t('prenos.prectenoZCaflou')} hodnota={vysledek.precteno} />
            <Cislo popisek={t('prenos.noveZalozeno')} hodnota={vysledek.zalozeno} />
            <Cislo popisek={t('prenos.doplneno')} hodnota={vysledek.aktualizovano} />
            <Cislo popisek={t('prenos.preskoceno')} hodnota={vysledek.preskoceno} />
          </div>

          {vysledek.chyba && (
            <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">
              {vysledek.chyba}
            </p>
          )}

          {vysledek.bezFirmy.length > 0 && (
            <div className="bg-warnTint border border-line rounded-lg px-3 py-2">
              <p className="text-sm font-body text-ink m-0">{t('prenos.bezFirmy')}</p>
              <p className="text-xs font-body text-muted m-0 mt-1">{vysledek.bezFirmy.join(', ')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Cislo({ popisek, hodnota, varovat }: { popisek: string; hodnota: number; varovat?: boolean }) {
  return (
    <div>
      <p className="text-xs font-heading text-muted uppercase tracking-wide m-0">{popisek}</p>
      <p className={`font-display text-2xl m-0 mt-1 tabular-nums ${varovat ? 'text-danger' : 'text-ink'}`}>
        {hodnota}
      </p>
    </div>
  );
}
