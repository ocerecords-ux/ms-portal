'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  missingRodnyListFields,
  RL_TRIGGER_STATUS,
  rodnyListFileName,
  rodnyListVersionLabel,
} from '@/lib/rodnyList';

/**
 * Záložka „Rodný list" na detailu projektu - zadání 9. 9. 2026.
 *
 * Ukazuje se jen u firem se zapnutými „Reklamami"; u audioknihy nemá RL smysl
 * a záložka se vůbec nevykreslí (viz page.tsx).
 *
 * POZNÁMKA KE KONTROLE PŘED DOKONČENÍM: stav projektu se přepíná v Caflou,
 * ne v portálu - portál tedy nemá kam vložit „zákaz dokončení". Kontrola je
 * proto na dvou místech: tady jako výrazné varování, dokud údaje chybí, a
 * hlavně v okamžiku přechodu stavu - když něco chybí, RL nevznikne, klientovi
 * NIC neodejde a projekt se označí jako vyžadující kontrolu.
 */

export type RodnyListValues = {
  spotName: string;
  spotLengthSeconds: string;
  directorName: string;
  musicTitle: string;
  musicAuthor: string;
  noMusic: boolean;
  /** Datum ve tvaru YYYY-MM-DD, jak ho dává <input type="date">. */
  productionDate: string;
};

export type RodnyListRow = {
  id: string;
  version: number;
  fileName: string;
  createdAt: string;
  driveUrl: string | null;
};

export function RodnyListSection({
  caflouProjectId,
  canEdit,
  clientName,
  projectName,
  rlError,
  rodneListy,
  initial,
}: {
  caflouProjectId: string;
  canEdit: boolean;
  clientName: string;
  projectName: string;
  /** Poslední zaznamenaná chyba generování (ProjectMeta.rlError). */
  rlError: string | null;
  rodneListy: RodnyListRow[];
  initial: RodnyListValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState<RodnyListValues>(initial);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof RodnyListValues>(key: K, value: RodnyListValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setSaved(false);
  }

  // Stejná kontrola, jakou dělá server před generováním - uživatel tak vidí
  // rovnou při psaní, co ještě chybí.
  const chybi = useMemo(
    () =>
      missingRodnyListFields({
        clientName,
        spotName: values.spotName || projectName,
        spotLengthSeconds: values.spotLengthSeconds ? Number(values.spotLengthSeconds) : null,
        directorName: values.directorName,
        musicTitle: values.musicTitle,
        musicAuthor: values.musicAuthor,
        noMusic: values.noMusic,
        productionDate: values.productionDate ? new Date(values.productionDate) : null,
      }),
    [values, clientName, projectName],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(caflouProjectId)}/meta`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spotName: values.spotName,
          spotLengthSeconds: values.spotLengthSeconds,
          directorName: values.directorName,
          musicTitle: values.musicTitle,
          musicAuthor: values.musicAuthor,
          noMusic: values.noMusic,
          productionDate: values.productionDate,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Uložení se nezdařilo.');
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError('Uložení se nezdařilo.');
    } finally {
      setSaving(false);
    }
  }

  async function vygenerovatZnovu() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(caflouProjectId)}/rodny-list`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Rodný list se nepodařilo vytvořit.');
        return;
      }
      router.refresh();
    } catch {
      setError('Rodný list se nepodařilo vytvořit.');
    } finally {
      setGenerating(false);
    }
  }

  const nazevSouboru = rodnyListFileName(values.spotName || projectName);

  return (
    <div className="flex flex-col gap-6">
      {rlError && (
        <div className="bg-red-50 border border-red-200 rounded-card px-4 py-3">
          <p className="text-sm font-heading font-semibold text-red-700 m-0">Projekt vyžaduje kontrolu</p>
          <p className="text-sm font-body text-red-700 m-0 mt-1">{rlError}</p>
          <p className="text-xs font-body text-red-700 m-0 mt-1">
            Klientovi se v tomhle případě nic neodeslalo. Doplňte údaje a vygenerujte Rodný list znovu.
          </p>
        </div>
      )}

      {chybi.length > 0 && !rlError && (
        <div className="bg-[#FDF1DE] border border-line rounded-card px-4 py-3">
          <p className="text-sm font-heading font-semibold text-status-progress m-0">
            Chybí údaje pro Rodný list
          </p>
          <p className="text-sm font-body text-ink m-0 mt-1">
            {chybi.join(', ')}. Než projekt v Caflou přepnete na „{RL_TRIGGER_STATUS}", doplňte je —
            jinak Rodný list nevznikne a klientovi nic neodejde.
          </p>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-card border border-line shadow-sm p-6 flex flex-col gap-5"
      >
        <div>
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
            Údaje pro Rodný list
          </h2>
          <p className="text-xs text-muted font-body m-0 mt-1">
            Z nich se vyrobí PDF ve chvíli, kdy projekt v Caflou přejde do stavu „{RL_TRIGGER_STATUS}".
            Název klienta se bere z karty firmy ({clientName || '—'}).
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-body text-ink">Název spotu</span>
            <input
              type="text"
              disabled={!canEdit}
              placeholder={projectName}
              value={values.spotName}
              onChange={(e) => set('spotName', e.target.value)}
              className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple disabled:opacity-60"
            />
            <span className="text-xs text-muted font-body">
              Když zůstane prázdný, použije se název projektu. Soubor se uloží jako {nazevSouboru}.
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Délka spotu (sekundy)</span>
            <input
              type="number"
              min={1}
              max={3600}
              disabled={!canEdit}
              value={values.spotLengthSeconds}
              onChange={(e) => set('spotLengthSeconds', e.target.value)}
              className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple disabled:opacity-60"
            />
            <span className="text-xs text-muted font-body">V dokumentu se zobrazí například jako „20s".</span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Datum výroby</span>
            <input
              type="date"
              disabled={!canEdit}
              value={values.productionDate}
              onChange={(e) => set('productionDate', e.target.value)}
              className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple disabled:opacity-60"
            />
          </label>

          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-body text-ink">Režie</span>
            <input
              type="text"
              disabled={!canEdit}
              value={values.directorName}
              onChange={(e) => set('directorName', e.target.value)}
              className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple disabled:opacity-60"
            />
          </label>
        </div>

        <div className="border-t border-line pt-5 flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="font-heading font-semibold text-sm text-ink m-0">Hudba ve spotu</h3>
            <label className="flex items-center gap-2 text-sm font-heading text-ink">
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={values.noMusic}
                onChange={(e) => set('noMusic', e.target.checked)}
              />
              Spot nemá hudbu
            </label>
          </div>

          {values.noMusic ? (
            <p className="text-sm font-body text-muted m-0">
              V Rodném listu bude u hudby uvedeno „Spot bez hudby“ — žádný vymyšlený údaj se tam nedostane.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-body text-ink">Název skladby</span>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={values.musicTitle}
                  onChange={(e) => set('musicTitle', e.target.value)}
                  className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple disabled:opacity-60"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-body text-ink">Autor hudby</span>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={values.musicAuthor}
                  onChange={(e) => set('musicAuthor', e.target.value)}
                  className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple disabled:opacity-60"
                />
              </label>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-line rounded-lg px-3 py-2 m-0">{error}</p>}

        {canEdit && (
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="submit"
              disabled={saving}
              className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
            >
              {saving ? 'Ukládám…' : 'Uložit'}
            </button>
            {saved && <span className="text-sm font-heading text-brand-greenDeep">Uloženo.</span>}
          </div>
        )}
      </form>

      <div className="bg-white rounded-card border border-line shadow-sm p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
            Vygenerované Rodné listy
          </h2>
          {canEdit && (
            <button
              type="button"
              onClick={vygenerovatZnovu}
              disabled={generating || chybi.length > 0}
              title={chybi.length > 0 ? 'Nejdřív doplňte chybějící údaje.' : undefined}
              className="border border-line bg-field text-ink font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:border-brand-purple transition-colors disabled:opacity-50"
            >
              {generating ? 'Generuji…' : rodneListy.length === 0 ? 'Vygenerovat RL' : 'Vygenerovat RL znovu'}
            </button>
          )}
        </div>

        {rodneListy.length === 0 ? (
          <p className="text-sm font-body text-muted m-0">
            Zatím žádný. Vznikne sám, jakmile projekt v Caflou přejde do stavu „{RL_TRIGGER_STATUS}".
          </p>
        ) : (
          <ul className="list-none p-0 m-0 flex flex-col gap-2">
            {rodneListy.map((rl) => (
              <li
                key={rl.id}
                className="flex items-center justify-between flex-wrap gap-3 border border-line rounded-lg px-4 py-3"
              >
                <div>
                  <a
                    href={`/api/rodny-list/${rl.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-heading font-semibold text-sm text-brand-purple no-underline"
                  >
                    {rl.fileName} ↗
                  </a>
                  <p className="text-xs font-body text-muted m-0 mt-0.5">
                    {rodnyListVersionLabel(rl.version)} · vytvořeno{' '}
                    {new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'short', timeStyle: 'short' }).format(
                      new Date(rl.createdAt),
                    )}
                  </p>
                </div>
                {rl.driveUrl && (
                  <a
                    href={rl.driveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-heading text-muted no-underline"
                  >
                    Na Google Disku ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
