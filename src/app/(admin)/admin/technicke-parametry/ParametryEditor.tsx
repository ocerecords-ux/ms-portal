'use client';

import { useState } from 'react';
import { SLUZBY_REKLAMY } from '@/lib/sluzbyReklamy';
import {
  DRUHY_PARAMETRU,
  nazevDruhuParametru,
  pocetRadku,
  radkyZTextu,
  type DruhParametru,
  type SekceTech,
  type TechnickyProfilData,
} from '@/lib/technickeParametry';
import { VyberVOkne } from '@/app/(portal)/projekty/VyberVOkne';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';

/**
 * ÚPRAVA SAD TECHNICKÝCH PARAMETRŮ (zadání 27. 9. 2026).
 *
 * Sada = nakladatelství (nebo paušál pro reklamy), sekce = „Natáčení",
 * „Export", „Tagy", řádky = jednotlivé parametry, jeden na řádek. Psát se to
 * má jako poznámky, ne vyplňovat dvacet políček - proto je obsah sekce prostý
 * text, kde každý řádek je jeden parametr.
 */

const pole =
  'rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple';

type Stav = TechnickyProfilData & { rozbaleno?: boolean };

export function ParametryEditor({
  pocatecni,
  firmy,
  smiMenit,
}: {
  pocatecni: TechnickyProfilData[];
  firmy: { id: string; name: string }[];
  smiMenit: boolean;
}) {
  const t = usePreklad();
  const jazyk = useJazyk();
  // Tri tvary cisla v cestine, dva v anglictine - kazdy tvar vlastni klic.
  const pocetSad = (n: number) =>
    t(n === 1 ? 'techparam.sadJedna' : n < 5 ? 'techparam.sadyMalo' : 'techparam.sadMnoho', { pocet: n });
  const [profily, setProfily] = useState<Stav[]>(pocatecni);
  const [uklada, setUklada] = useState<string | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);

  function uprav(id: string, zmena: Partial<Stav>) {
    setProfily((p) => p.map((x) => (x.id === id ? { ...x, ...zmena } : x)));
  }

  async function uloz(profil: Stav) {
    setUklada(profil.id);
    setChyba(null);
    try {
      const res = await fetch(`/api/admin/technicke-parametry/${profil.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nazev: profil.nazev,
          druh: profil.druh,
          perex: profil.perex,
          sekce: profil.sekce,
          vychozi: profil.vychozi,
          aktivni: profil.aktivni,
          poradi: profil.poradi,
          firmyIds: profil.firmy.map((f) => f.id),
        }),
      });
      const telo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(telo.error || t('techparam.neulozeno'));
    } catch (err) {
      setChyba(err instanceof Error ? err.message : t('techparam.neulozeno'));
    } finally {
      setUklada(null);
    }
  }

  async function zaloz(druh: DruhParametru) {
    setChyba(null);
    try {
      const res = await fetch('/api/admin/technicke-parametry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nazev: 'Nová sada',
          druh,
          sekce: [{ nadpis: 'Export', radky: [] }],
        }),
      });
      const telo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(telo.error || t('techparam.sadaNezalozena'));
      setProfily((p) => [...p, { ...telo.profil, rozbaleno: true }]);
    } catch (err) {
      setChyba(err instanceof Error ? err.message : t('techparam.sadaNezalozena'));
    }
  }

  async function smaz(profil: Stav) {
    if (!window.confirm(t('techparam.smazatSaduPotvrzeni', { nazev: profil.nazev }))) return;
    const res = await fetch(`/api/admin/technicke-parametry/${profil.id}`, { method: 'DELETE' });
    if (res.ok) setProfily((p) => p.filter((x) => x.id !== profil.id));
  }

  return (
    <div className="flex flex-col gap-6">
      {chyba && (
        <p className="text-sm font-body text-status-error m-0" role="alert">
          {chyba}
        </p>
      )}

      {DRUHY_PARAMETRU.map((druh) => {
        const skupina = profily.filter((p) => p.druh === druh);
        return (
          <section key={druh} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <h2 className="font-heading font-semibold text-lg text-ink m-0">{nazevDruhuParametru(druh, jazyk)}</h2>
              <span className="text-xs font-body text-muted">{pocetSad(skupina.length)}</span>
              {smiMenit && (
                <button
                  type="button"
                  onClick={() => void zaloz(druh)}
                  className="ml-auto rounded-pill border border-line text-muted font-heading font-semibold text-xs px-3 py-1.5 hover:text-brand-purple hover:border-brand-purple transition-colors cursor-pointer"
                >
                  {t('techparam.novaSada')}
                </button>
              )}
            </div>

            {skupina.length === 0 ? (
              <p className="text-sm font-body text-muted m-0">{t('techparam.zadnaSada')}</p>
            ) : (
              <ul className="list-none p-0 m-0 flex flex-col gap-2">
                {skupina.map((profil) => (
                  <li key={profil.id} className="rounded-card border border-line bg-surface">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <button
                        type="button"
                        onClick={() => uprav(profil.id, { rozbaleno: !profil.rozbaleno })}
                        className="flex-1 min-w-0 text-left bg-transparent border-0 cursor-pointer p-0"
                      >
                        <span className="block font-heading font-semibold text-sm text-ink">
                          {profil.nazev}
                          {profil.vychozi && (
                            <span className="ml-2 rounded-pill bg-brand-purple/15 text-brand-purpleDeep dark:text-brand-purpleLight px-2 py-0.5 text-[11px]">
                              {t('techparam.vychozi')}
                            </span>
                          )}
                          {!profil.aktivni && (
                            <span className="ml-2 rounded-pill border border-line text-muted px-2 py-0.5 text-[11px]">
                              {t('techparam.vypnuto')}
                            </span>
                          )}
                        </span>
                        <span className="block text-xs font-body text-muted mt-0.5 truncate">
                          {profil.firmy.length > 0
                            ? profil.firmy.map((f) => f.name).join(', ')
                            : t('techparam.bezFirmy')}{' '}
                          · {t('techparam.parametruPocet', { pocet: pocetRadku(profil.sekce) })}
                        </span>
                      </button>
                      <span className="text-muted text-xs">{profil.rozbaleno ? '▴' : '▾'}</span>
                    </div>

                    {profil.rozbaleno && (
                      <div className="px-4 pb-4 flex flex-col gap-4 border-t border-line pt-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-heading text-muted">{t('techparam.nazevSady')}</span>
                            <input
                              value={profil.nazev}
                              disabled={!smiMenit}
                              onChange={(e) => uprav(profil.id, { nazev: e.target.value })}
                              className={pole}
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-heading text-muted">{t('techparam.perex')}</span>
                            <input
                              value={profil.perex ?? ''}
                              disabled={!smiMenit}
                              onChange={(e) => uprav(profil.id, { perex: e.target.value })}
                              className={pole}
                              placeholder={t('techparam.perexPlaceholder')}
                            />
                          </label>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                          <span className="text-xs font-heading text-muted">{t('techparam.platiProFirmy')}</span>
                          <VyberVOkne
                            popisek={t('techparam.vyberFirem')}
                            prazdne="firmy"
                            polozky={firmy.map((f) => ({ id: f.id, nazev: f.name, ikona: null }))}
                            vybrane={profil.firmy.map((f) => f.id)}
                            disabled={!smiMenit}
                            onZmena={(ids) =>
                              uprav(profil.id, {
                                firmy: firmy.filter((f) => ids.includes(f.id)),
                              })
                            }
                          />
                          <label className="flex items-center gap-1.5 text-sm font-body text-ink">
                            <input
                              type="checkbox"
                              checked={profil.vychozi}
                              disabled={!smiMenit}
                              onChange={(e) => uprav(profil.id, { vychozi: e.target.checked })}
                            />
                            {t('techparam.vychoziPro', { druh: nazevDruhuParametru(druh, jazyk).toLowerCase() })}
                          </label>
                          <label className="flex items-center gap-1.5 text-sm font-body text-ink">
                            <input
                              type="checkbox"
                              checked={profil.aktivni}
                              disabled={!smiMenit}
                              onChange={(e) => uprav(profil.id, { aktivni: e.target.checked })}
                            />
                            {t('techparam.pouzivaSe')}
                          </label>
                        </div>

                        <div className="flex flex-col gap-3">
                          {profil.sekce.map((sekce, i) => (
                            <div key={i} className="rounded-card border border-line bg-field/40 p-3 flex flex-col gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <input
                                  value={sekce.nadpis}
                                  disabled={!smiMenit}
                                  onChange={(e) => {
                                    const nove = [...profil.sekce];
                                    nove[i] = { ...sekce, nadpis: e.target.value };
                                    uprav(profil.id, { sekce: nove });
                                  }}
                                  className={`${pole} flex-1 min-w-[160px] font-heading font-semibold`}
                                  placeholder={t('techparam.nadpisSekce')}
                                />
                                {druh === 'REKLAMA' && (
                                  <>
                                    <select
                                      value={sekce.sluzba ?? ''}
                                      disabled={!smiMenit}
                                      onChange={(e) => {
                                        const nove = [...profil.sekce];
                                        nove[i] = { ...sekce, sluzba: e.target.value || null };
                                        uprav(profil.id, { sekce: nove });
                                      }}
                                      className={pole}
                                      title={t('techparam.kdySeUkaze')}
                                    >
                                      <option value="">{t('techparam.vzdycky')}</option>
                                      {SLUZBY_REKLAMY.map((s) => (
                                        <option key={s.klic} value={s.klic}>
                                          {t('techparam.jenSluzba', { nazev: s.nazev })}
                                        </option>
                                      ))}
                                    </select>
                                    <label className="flex items-center gap-1.5 text-xs font-body text-ink">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(sekce.jenRadio)}
                                        disabled={!smiMenit}
                                        onChange={(e) => {
                                          const nove = [...profil.sekce];
                                          nove[i] = { ...sekce, jenRadio: e.target.checked };
                                          uprav(profil.id, { sekce: nove });
                                        }}
                                      />
                                      {t('techparam.jenRadio')}
                                    </label>
                                  </>
                                )}
                                {smiMenit && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      uprav(profil.id, { sekce: profil.sekce.filter((_, j) => j !== i) })
                                    }
                                    className="text-xs font-heading text-muted hover:text-danger bg-transparent border-0 cursor-pointer"
                                  >
                                    {t('techparam.smazatSekci')}
                                  </button>
                                )}
                              </div>
                              <textarea
                                value={sekce.radky.join('\n')}
                                disabled={!smiMenit}
                                rows={Math.max(3, sekce.radky.length + 1)}
                                onChange={(e) => {
                                  const nove = [...profil.sekce];
                                  nove[i] = { ...sekce, radky: radkyZTextu(e.target.value) };
                                  uprav(profil.id, { sekce: nove });
                                }}
                                className={`${pole} font-body leading-relaxed`}
                                placeholder={'mp3 128 kbps, 44,1 kHz, stereo\ntracky max 30 min'}
                              />
                            </div>
                          ))}
                          {smiMenit && (
                            <button
                              type="button"
                              onClick={() =>
                                uprav(profil.id, {
                                  sekce: [...profil.sekce, { nadpis: 'Nová sekce', radky: [] } as SekceTech],
                                })
                              }
                              className="self-start text-xs font-heading text-brand-purple bg-transparent border-0 cursor-pointer p-0 hover:underline"
                            >
                              {t('techparam.pridatSekci')}
                            </button>
                          )}
                        </div>

                        {smiMenit && (
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => void uloz(profil)}
                              disabled={uklada === profil.id}
                              className="rounded-pill bg-brand-purple text-white font-heading font-semibold text-sm px-5 py-2 hover:bg-brand-purpleDeep transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {uklada === profil.id ? t('obecne.ukladam') : t('obecne.ulozit')}
                            </button>
                            <button
                              type="button"
                              onClick={() => void smaz(profil)}
                              className="text-xs font-heading text-muted hover:text-danger bg-transparent border-0 cursor-pointer"
                            >
                              {t('techparam.smazatSadu')}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
