'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AddButton } from '@/components/AddButton';
import { WEEKDAY_LABELS, minutesToTime } from '@/lib/calendar';

type Hodiny = { weekday: number; startMinutes: number; endMinutes: number; byArrangement: boolean };
type Studio = {
  id: string;
  name: string;
  shortName: string;
  location: string | null;
  color: string;
  timezone: string;
  active: boolean;
  /** Odkaz na videohovor studia (23. 9. 2026) - v kalendáři z něj je ikona. */
  hovorOdkaz: string | null;
  hours: Hodiny[];
  presets: { label: string; startMinutes: number; endMinutes: number }[];
};

/** Dny v tydnu tak, jak je cte clovek - pondeli prvni, nedele posledni. */
const PORADI_DNU = [1, 2, 3, 4, 5, 6, 0];

/**
 * Správa studií (zadani 8. 9. 2026). Studia jsou kalendářové zdroje: každé
 * má pracovní dobu po dnech a nejčastější frekvence jako zkratky.
 *
 * BLOKACE TU UŽ NEJSOU (25. 9. 2026: „blokace dejme pryč"). Svátky, dovolené
 * a údržba se zapisují přímo v kalendáři jako každá jiná událost - dvě místa
 * na totéž znamenala, že se jedno z nich neaktualizovalo.
 */
export function StudiosManager({ studios }: { studios: Studio[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(studios[0]?.id ?? null);
  const [hodiny, setHodiny] = useState<Record<string, Hodiny[]>>({});
  const [nove, setNove] = useState({ name: '', shortName: '', location: '' });
  /** Formulář nového studia je schovaný pod tlačítkem (25. 9. 2026). */
  const [zakladam, setZakladam] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const otevrene = studios.find((s) => s.id === openId) ?? null;
  const hodinyStudia = (s: Studio) => hodiny[s.id] ?? s.hours;

  async function posli(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Uložení se nezdařilo.');
        return null;
      }
      router.refresh();
      return data;
    } catch {
      setError('Uložení se nezdařilo.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  function upravHodinu(s: Studio, weekday: number, patch: Partial<Hodiny>) {
    const aktualni = hodinyStudia(s);
    const dalsi = aktualni.map((h) => (h.weekday === weekday ? { ...h, ...patch } : h));
    setHodiny((c) => ({ ...c, [s.id]: dalsi }));
  }

  function parsujCas(hodnota: string): number | null {
    const shoda = hodnota.trim().match(/^(\d{1,2})[:.](\d{2})$/);
    if (!shoda) return null;
    const h = Number(shoda[1]);
    const m = Number(shoda[2]);
    if (h > 23 || m > 59) return null;
    return h * 60 + m;
  }

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full';

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="hidden sm:block font-display text-3xl text-ink m-0">Studia</h1>
      </div>

      {error && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{error}</p>}
      {info && <p className="text-sm text-ink bg-okTint border border-line rounded-lg px-3 py-2 m-0">{info}</p>}

      <div className="flex flex-col sm:flex-row gap-5 items-start">
        <div className="w-full sm:w-[240px] shrink-0 bg-surface rounded-card border border-line shadow-sm p-2 flex flex-col gap-0.5">
          {studios.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setOpenId(s.id)}
              className={`text-left rounded-lg px-3 py-2 text-sm font-heading flex items-center gap-2 transition-colors ${
                s.id === openId ? 'bg-tint text-ink' : 'text-muted hover:text-ink hover:bg-field'
              } ${s.active ? '' : 'line-through'}`}
            >
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              {s.shortName}
            </button>
          ))}
        </div>

        {otevrene && (
          <div className="flex-1 min-w-0 bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-sm font-body text-ink">Název</span>
                <input
                  defaultValue={otevrene.name}
                  onBlur={(e) => posli(`/api/admin/studia/${otevrene.id}`, 'PATCH', { name: e.target.value })}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-body text-ink">Zkratka</span>
                <input
                  defaultValue={otevrene.shortName}
                  onBlur={(e) => posli(`/api/admin/studia/${otevrene.id}`, 'PATCH', { shortName: e.target.value })}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-body text-ink">Město</span>
                <input
                  defaultValue={otevrene.location ?? ''}
                  onBlur={(e) => posli(`/api/admin/studia/${otevrene.id}`, 'PATCH', { location: e.target.value })}
                  className={inputClass}
                />
              </label>
              {/* Odkaz na videohovor studia (23. 9. 2026) - v kalendáři z něj
                  je jen ikonka u události s režií na dálku. */}
              <label className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4">
                <span className="text-sm font-body text-ink">
                  Odkaz na videohovor
                  <span className="text-muted font-normal"> · v kalendáři se z něj stane ikonka u režie na dálku</span>
                </span>
                <input
                  defaultValue={otevrene.hovorOdkaz ?? ''}
                  placeholder="https://meet.google.com/…"
                  onBlur={(e) => posli(`/api/admin/studia/${otevrene.id}`, 'PATCH', { hovorOdkaz: e.target.value })}
                  className={inputClass}
                />
              </label>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-heading text-muted uppercase tracking-wide">Pracovní doba</span>
              {PORADI_DNU.map((weekday) => {
                const h = hodinyStudia(otevrene).find((x) => x.weekday === weekday);
                if (!h) return null;
                return (
                  <div key={weekday} className="flex items-center gap-3 flex-wrap">
                    <span className="w-20 text-sm font-heading text-ink">{WEEKDAY_LABELS[weekday]}</span>
                    <input
                      defaultValue={minutesToTime(h.startMinutes)}
                      onBlur={(e) => {
                        const v = parsujCas(e.target.value);
                        if (v !== null) upravHodinu(otevrene, weekday, { startMinutes: v });
                      }}
                      className="w-20 rounded-lg border border-line bg-field px-2 py-1.5 text-sm font-heading text-ink tabular-nums outline-none focus:border-brand-purple"
                    />
                    <span className="text-muted">–</span>
                    <input
                      defaultValue={minutesToTime(h.endMinutes)}
                      onBlur={(e) => {
                        const v = parsujCas(e.target.value);
                        if (v !== null) upravHodinu(otevrene, weekday, { endMinutes: v });
                      }}
                      className="w-20 rounded-lg border border-line bg-field px-2 py-1.5 text-sm font-heading text-ink tabular-nums outline-none focus:border-brand-purple"
                    />
                    <label className="flex items-center gap-2 text-sm font-body text-muted">
                      <input
                        type="checkbox"
                        checked={h.byArrangement}
                        onChange={(e) => upravHodinu(otevrene, weekday, { byArrangement: e.target.checked })}
                      />
                      jen po domluvě
                    </label>
                  </div>
                );
              })}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    const ok = await posli(`/api/admin/studia/${otevrene.id}`, 'PATCH', {
                      hours: hodinyStudia(otevrene),
                    });
                    if (ok) setInfo('Pracovní doba uložena.');
                  }}
                  className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
                >
                  Uložit pracovní dobu
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => posli(`/api/admin/studia/${otevrene.id}`, 'PATCH', { active: !otevrene.active })}
                  className="text-muted text-sm font-heading"
                >
                  {otevrene.active ? 'Vyřadit studio' : 'Vrátit do provozu'}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 border-t border-line pt-4">
              <span className="text-xs font-heading text-muted uppercase tracking-wide">Zkratky frekvencí</span>
              <span className="text-sm font-body text-muted">
                {otevrene.presets
                  .map((p) => `${p.label} ${minutesToTime(p.startMinutes)}–${minutesToTime(p.endMinutes)}`)
                  .join(' · ')}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* NOVÉ STUDIO POD TLAČÍTKEM (zadání 25. 9. 2026: „to přidat nové studio
          dej jen na tlačítko a někam pod seznam studií"). Studio se zakládá
          jednou za rok - tři pole natrvalo otevřená pod seznamem jen odváděla
          pozornost od toho, co se opravdu spravuje. */}
      {!zakladam ? (
        <div>
          <AddButton type="button" onClick={() => setZakladam(true)}>
            Nové studio
          </AddButton>
        </div>
      ) : (
        <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex items-end gap-3 flex-wrap">
          <label className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <span className="text-sm font-body text-ink">Nové studio</span>
            <input
              value={nove.name}
              onChange={(e) => setNove((n) => ({ ...n, name: e.target.value }))}
              placeholder="MS Studio - Ostrava"
              autoFocus
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 w-40">
            <span className="text-sm font-body text-ink">Zkratka</span>
            <input
              value={nove.shortName}
              onChange={(e) => setNove((n) => ({ ...n, shortName: e.target.value }))}
              placeholder="Ostrava"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 w-40">
            <span className="text-sm font-body text-ink">Město</span>
            <input
              value={nove.location}
              onChange={(e) => setNove((n) => ({ ...n, location: e.target.value }))}
              className={inputClass}
            />
          </label>
          <AddButton
            type="button"
            disabled={busy || !nove.name.trim() || !nove.shortName.trim()}
            onClick={async () => {
              const ok = await posli('/api/admin/studia', 'POST', nove);
              if (ok) {
                setNove({ name: '', shortName: '', location: '' });
                setZakladam(false);
              }
            }}
          >
            Založit
          </AddButton>
          <button
            type="button"
            onClick={() => setZakladam(false)}
            className="text-sm font-heading text-muted hover:text-ink bg-transparent border-0 cursor-pointer py-2"
          >
            Zrušit
          </button>
        </div>
      )}

    </div>
  );
}
