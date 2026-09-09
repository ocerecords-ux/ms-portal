'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AddButton } from '@/components/AddButton';
import { BLOCK_KIND_LABELS, WEEKDAY_LABELS, formatDateTime, minutesToTime } from '@/lib/calendar';

type Hodiny = { weekday: number; startMinutes: number; endMinutes: number; byArrangement: boolean };
type Studio = {
  id: string;
  name: string;
  shortName: string;
  location: string | null;
  color: string;
  timezone: string;
  active: boolean;
  hours: Hodiny[];
  presets: { label: string; startMinutes: number; endMinutes: number }[];
};
type Blokace = { id: string; studioName: string; start: string; end: string; kind: string; title: string };

/** Dny v tydnu tak, jak je cte clovek - pondeli prvni, nedele posledni. */
const PORADI_DNU = [1, 2, 3, 4, 5, 6, 0];

/**
 * Správa studií (zadani 8. 9. 2026). Studia jsou kalendářové zdroje: každé
 * má pracovní dobu po dnech, nejčastější frekvence jako zkratky a blokace
 * (svátky, dovolené, údržba).
 */
export function StudiosManager({ studios, blocks }: { studios: Studio[]; blocks: Blokace[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(studios[0]?.id ?? null);
  const [hodiny, setHodiny] = useState<Record<string, Hodiny[]>>({});
  const [nove, setNove] = useState({ name: '', shortName: '', location: '' });
  const [blokace, setBlokace] = useState({
    studioId: studios[0]?.id ?? '',
    start: '',
    end: '',
    kind: 'INTERNAL',
    title: '',
  });
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
        <h1 className="font-display text-3xl text-ink m-0">Studia</h1>
        <p className="text-sm font-body text-muted m-0 mt-1">
          Kalendářové zdroje pro natáčení. Víkendová doba s přepínačem „po domluvě" se v kalendáři
          jen označí — neblokuje se.
        </p>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-line rounded-lg px-3 py-2 m-0">{error}</p>}
      {info && <p className="text-sm text-ink bg-[#E3F9EC] border border-line rounded-lg px-3 py-2 m-0">{info}</p>}

      <div className="flex flex-col sm:flex-row gap-5 items-start">
        <div className="w-full sm:w-[240px] shrink-0 bg-white rounded-card border border-line shadow-sm p-2 flex flex-col gap-0.5">
          {studios.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setOpenId(s.id)}
              className={`text-left rounded-lg px-3 py-2 text-sm font-heading flex items-center gap-2 transition-colors ${
                s.id === openId ? 'bg-[#F1ECFF] text-ink' : 'text-muted hover:text-ink hover:bg-field'
              } ${s.active ? '' : 'line-through'}`}
            >
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              {s.shortName}
            </button>
          ))}
        </div>

        {otevrene && (
          <div className="flex-1 min-w-0 bg-white rounded-card border border-line shadow-sm p-5 flex flex-col gap-5">
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

      {/* Nove studio */}
      <div className="bg-white rounded-card border border-line shadow-sm p-5 flex items-end gap-3 flex-wrap">
        <label className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
          <span className="text-sm font-body text-ink">Nové studio</span>
          <input
            value={nove.name}
            onChange={(e) => setNove((n) => ({ ...n, name: e.target.value }))}
            placeholder="MS Studio - Ostrava"
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
            if (ok) setNove({ name: '', shortName: '', location: '' });
          }}
        >
          Založit
        </AddButton>
      </div>

      {/* Blokace */}
      <div className="bg-white rounded-card border border-line shadow-sm p-5 flex flex-col gap-4">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          Blokace — svátky, dovolené, údržba
        </h2>

        <div className="flex items-end gap-3 flex-wrap">
          <label className="flex flex-col gap-1.5 w-44">
            <span className="text-sm font-body text-ink">Studio</span>
            <select
              value={blokace.studioId}
              onChange={(e) => setBlokace((b) => ({ ...b, studioId: e.target.value }))}
              className={inputClass}
            >
              {studios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shortName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Od</span>
            <input
              type="datetime-local"
              value={blokace.start}
              onChange={(e) => setBlokace((b) => ({ ...b, start: e.target.value }))}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Do</span>
            <input
              type="datetime-local"
              value={blokace.end}
              onChange={(e) => setBlokace((b) => ({ ...b, end: e.target.value }))}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 w-40">
            <span className="text-sm font-body text-ink">Druh</span>
            <select
              value={blokace.kind}
              onChange={(e) => setBlokace((b) => ({ ...b, kind: e.target.value }))}
              className={inputClass}
            >
              {Object.entries(BLOCK_KIND_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
            <span className="text-sm font-body text-ink">Popis</span>
            <input
              value={blokace.title}
              onChange={(e) => setBlokace((b) => ({ ...b, title: e.target.value }))}
              placeholder="Servis techniky"
              className={inputClass}
            />
          </label>
          <AddButton
            type="button"
            disabled={busy || !blokace.title.trim() || !blokace.start || !blokace.end}
            onClick={async () => {
              const ok = await posli('/api/admin/studia/blokace', 'POST', {
                ...blokace,
                start: new Date(blokace.start).toISOString(),
                end: new Date(blokace.end).toISOString(),
              });
              if (ok) setBlokace((b) => ({ ...b, start: '', end: '', title: '' }));
            }}
          >
            Přidat blokaci
          </AddButton>
        </div>

        <ul className="list-none p-0 m-0 flex flex-col divide-y divide-line">
          {blocks.length === 0 && <li className="text-sm font-body text-muted py-2">Žádné nadcházející blokace.</li>}
          {blocks.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-4 py-2.5">
              <span>
                <span className="block text-sm font-heading font-semibold text-ink">{b.title}</span>
                <span className="block text-xs font-body text-muted">
                  {b.studioName} · {BLOCK_KIND_LABELS[b.kind] ?? b.kind} · {formatDateTime(b.start)} –{' '}
                  {formatDateTime(b.end)}
                </span>
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => posli(`/api/admin/studia/blokace?id=${b.id}`, 'DELETE')}
                className="text-red-600 text-xs font-heading font-semibold disabled:opacity-60"
              >
                Smazat
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
