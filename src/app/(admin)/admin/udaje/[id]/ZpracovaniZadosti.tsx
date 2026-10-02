'use client';

import { TlacitkoSmazat } from '@/components/TlacitkoSmazat';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RozdilPole } from '@/lib/pozvankaUdaju';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';
import { formatDatumCas } from '@/lib/jazyk';

/**
 * Co se s vyplněnou žádostí dá udělat (zadání 16. 9. 2026).
 *
 * ODKLIKÁVAJÍ SE JEN PŘEPISY. Doplnění prázdného pole je zaškrtnuté a nejde
 * odškrtnout — o to tady nikdo nepřemýšlí, prázdné pole nemá co ztratit.
 * Přepis toho, co už vyplněné bylo, je naopak zaškrtnutý, ale jde vypnout:
 * číslo účtu je přesně to, u čeho se vyplatí kouknout dvakrát.
 */
export function ZpracovaniZadosti({
  id,
  stav,
  token,
  email,
  vyplneno,
  rozdily,
}: {
  id: string;
  stav: string;
  token: string;
  email: string | null;
  vyplneno: string | null;
  rozdily: RozdilPole[];
}) {
  const router = useRouter();
  const t = usePreklad();
  const jazyk = useJazyk();
  const [vybrane, setVybrane] = useState<string[]>(rozdily.map((r) => r.klic));
  const [bezi, setBezi] = useState(false);
  const [zprava, setZprava] = useState<string | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const [kam, setKam] = useState(email ?? '');

  const odkaz = typeof window === 'undefined' ? '' : `${window.location.origin}/udaje/${token}`;

  async function akce(telo: Record<string, unknown>, hotovaZprava: string) {
    setBezi(true);
    setChyba(null);
    setZprava(null);
    try {
      const res = await fetch(`/api/admin/pozvanky-udaju/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telo),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || t('zadost.nepodariloSe'));
        return;
      }
      setZprava(hotovaZprava);
      router.refresh();
    } catch {
      setChyba(t('zadost.nepodariloSe'));
    } finally {
      setBezi(false);
    }
  }

  async function zrus() {
    setBezi(true);
    setChyba(null);
    try {
      const res = await fetch(`/api/admin/pozvanky-udaju/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setChyba(t('zadost.zruseniNepodarilo'));
        return;
      }
      setZprava(t('zadost.odkazPrestalPlatit'));
      router.refresh();
    } finally {
      setBezi(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {stav === 'CEKA' && (
        <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-3">
          <p className="font-heading font-semibold text-ink m-0">{t('zadost.cekaSeNaVyplneni')}</p>
          <div className="flex gap-2 items-center flex-wrap">
            <input readOnly value={odkaz} className="admin-input flex-1 min-w-[220px] text-xs" />
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(odkaz).then(
                  () => setZprava(t('zadost.veSchrance')),
                  () => setZprava(t('zadost.zkopirujteRucne')),
                );
              }}
              className="text-sm font-heading font-semibold rounded-lg border border-line px-3 py-2 hover:border-brand-purple"
            >
              {t('zadost.zkopirovat')}
            </button>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <input
              value={kam}
              onChange={(e) => setKam(e.target.value)}
              type="email"
              placeholder={t('firma.sloupecEmail')}
              className="admin-input flex-1 min-w-[200px]"
            />
            <button
              type="button"
              disabled={bezi}
              onClick={() => void akce({ akce: 'poslat', ...(kam ? { email: kam } : {}) }, t('zadost.odkazOdeselKratce'))}
              className="text-sm font-heading font-semibold rounded-lg border border-brand-purple text-brand-purple px-4 py-2 disabled:opacity-60"
            >
              {t('zadost.poslatEmailem')}
            </button>
          </div>
        </div>
      )}

      {stav === 'VYPLNENA' && (
        <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-4">
          <div>
            <p className="font-heading font-semibold text-ink m-0">{t('zadost.coSeMaZapsat')}</p>
            <p className="text-xs font-body text-muted m-0 mt-1">
              {vyplneno ? t('zadost.vyplneno', { kdy: formatDatumCas(jazyk, new Date(vyplneno)) }) : ''}{' '}
              {t('zadost.zaskrtnutePopis')}
            </p>
          </div>

          {rozdily.length === 0 ? (
            <p className="text-sm font-body text-muted m-0">{t('zadost.nicSeNelisi')}</p>
          ) : (
            <ul className="m-0 p-0 list-none flex flex-col gap-2">
              {rozdily.map((r) => (
                <li key={r.klic} className="flex items-start gap-3 border-b border-line pb-2 last:border-0">
                  <input
                    type="checkbox"
                    checked={vybrane.includes(r.klic)}
                    onChange={(e) =>
                      setVybrane((p) => (e.target.checked ? [...p, r.klic] : p.filter((k) => k !== r.klic)))
                    }
                    className="mt-1 w-4 h-4 accent-brand-purple"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-heading font-semibold text-ink">
                      {r.popisek}
                      {!r.doplneni && (
                        <span className="ml-2 text-xs font-body text-brand-purple">{t('zadost.prepisuje')}</span>
                      )}
                    </span>
                    <span className="block text-sm font-body text-ink break-words">{r.nove}</span>
                    {!r.doplneni && (
                      <span className="block text-xs font-body text-muted break-words">
                        {t('zadost.tedHodnota', { co: r.ted })}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              disabled={bezi || rozdily.length === 0}
              onClick={() => void akce({ akce: 'zapsat', klice: vybrane }, t('zadost.zapsano'))}
              className="text-sm font-heading font-semibold rounded-pill bg-brand-purple text-white px-5 py-2.5 disabled:opacity-60"
            >
              {bezi ? t('zadost.zapisuji') : t('zadost.zapsatDoPortalu')}
            </button>
            <button
              type="button"
              disabled={bezi}
              onClick={() => void akce({ akce: 'zapsat', klice: [] }, t('zadost.odlozeno'))}
              className="text-sm font-heading font-semibold rounded-pill border border-line text-muted px-5 py-2.5 hover:border-brand-purple disabled:opacity-60"
            >
              {t('zadost.nezapisovatNic')}
            </button>
          </div>
        </div>
      )}

      {stav === 'HOTOVA' && (
        <div className="bg-okTint border border-brand-green rounded-card p-5">
          <p className="font-heading font-semibold text-brand-greenDeep m-0">{t('zadost.udajeJsouVPortalu')}</p>
          <p className="text-sm font-body text-ink m-0 mt-1">{t('zadost.hotovaPopis')}</p>
        </div>
      )}

      {stav === 'ZRUSENA' && (
        <div className="bg-field border border-line rounded-card p-5">
          <p className="font-heading font-semibold text-ink m-0">{t('zadost.zruseno')}</p>
          <p className="text-sm font-body text-muted m-0 mt-1">{t('zadost.odkazNeplati')}</p>
        </div>
      )}

      {zprava && <p className="text-sm font-body text-muted m-0">{zprava}</p>}
      {chyba && <p className="text-sm font-body text-danger m-0">{chyba}</p>}

      {(stav === 'CEKA' || stav === 'VYPLNENA') && (
        <TlacitkoSmazat
          onSmazat={() => zrus()}
          disabled={bezi}
          popisek={t('zadost.zrusitZadost')}
          otazka={t('zadost.opravduZrusit')}
          trida="self-start"
        />
      )}
    </div>
  );
}
