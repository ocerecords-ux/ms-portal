'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AddButton } from '@/components/AddButton';
import { PRIORITY_LABELS, PRIORITY_OPTIONS } from '@/lib/projectTypes';
import { STAVY_PROJEKTU, popisStavu } from '@/lib/stavyProjektu';
import { KOTVA_NOVE, useOtevriZeZkratky } from '@/lib/zkratky';

/**
 * Založení projektu (zadání 10. 9. 2026). Do teď projekty vznikaly v Caflou;
 * od odchodu z Caflou vznikají tady.
 *
 * Povinný je jen název — zbytek se dá doplnit na detailu projektu. Projekt
 * často vzniká ve chvíli, kdy se ještě neví všechno, a formulář, který to
 * odmítne uložit, lidi naučí zadávat nesmysly.
 */
export function NovyProjektForm({
  firmy,
  klienti,
  manazeri,
  typyProjektu,
}: {
  firmy: { id: string; label: string; maSlozku: boolean }[];
  klienti: { id: string; label: string; companyId: string | null }[];
  manazeri: { id: string; label: string }[];
  typyProjektu: string[];
}) {
  const router = useRouter();
  const [otevreno, setOtevreno] = useState(false);
  useOtevriZeZkratky(() => setOtevreno(true));

  const [form, setForm] = useState({
    name: '',
    companyId: '',
    klientUserId: '',
    projectType: '',
    managerUserId: '',
    priority: '',
    narrator: '',
    pageCount: '',
    releaseDate: '',
    statusName: STAVY_PROJEKTU[0].nazev,
    zalozitSlozku: true,
  });
  const [uklada, setUklada] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [varovani, setVarovani] = useState<string | null>(null);

  function set<K extends keyof typeof form>(klic: K, hodnota: (typeof form)[K]) {
    setForm((f) => ({ ...f, [klic]: hodnota }));
  }

  const firma = firmy.find((f) => f.id === form.companyId);

  async function odesli(e: React.FormEvent) {
    e.preventDefault();
    setUklada(true);
    setChyba(null);
    setVarovani(null);
    try {
      const res = await fetch('/api/admin/projekty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || 'Projekt se nepodařilo založit.');
        return;
      }
      if (data?.varovaniDisk) {
        // Projekt vznikl, jen slozka na Disku ne - at to nezapadne.
        setVarovani(data.varovaniDisk);
        router.refresh();
        return;
      }
      router.push(`/projekty/${data.id}`);
    } catch {
      setChyba('Projekt se nepodařilo založit.');
    } finally {
      setUklada(false);
    }
  }

  const tridaPole =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full';

  if (!otevreno) {
    return (
      <span id={KOTVA_NOVE}>
        <AddButton onClick={() => setOtevreno(true)}>Nový projekt</AddButton>
      </span>
    );
  }

  return (
    <form
      id={KOTVA_NOVE}
      onSubmit={odesli}
      className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-4 w-full"
    >
      <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Nový projekt</h2>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-body text-ink">Název projektu</span>
        <input
          required
          autoFocus
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="např. Bezradná (série)"
          className={tridaPole}
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Firma</span>
          <select value={form.companyId} onChange={(e) => set('companyId', e.target.value)} className={tridaPole}>
            <option value="">— nevybráno —</option>
            {firmy.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Klient</span>
          <select
            value={form.klientUserId}
            onChange={(e) => set('klientUserId', e.target.value)}
            className={tridaPole}
          >
            <option value="">— nevybráno —</option>
            {klienti
              .slice()
              .sort((a, b) => {
                // Lide z vybrane firmy nahoru - u koprodukci ale musi jit
                // vybrat i nekdo odjinud, takze se nabidka neomezuje.
                const aSedi = form.companyId && a.companyId === form.companyId ? 0 : 1;
                const bSedi = form.companyId && b.companyId === form.companyId ? 0 : 1;
                return aSedi - bSedi || a.label.localeCompare(b.label, 'cs');
              })
              .map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Typ projektu</span>
          <select
            value={form.projectType}
            onChange={(e) => set('projectType', e.target.value)}
            className={tridaPole}
          >
            <option value="">— nevybráno —</option>
            {typyProjektu.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Manažer projektu</span>
          <select
            value={form.managerUserId}
            onChange={(e) => set('managerUserId', e.target.value)}
            className={tridaPole}
          >
            <option value="">— nevybráno —</option>
            {manazeri.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Herec</span>
          <input
            value={form.narrator}
            onChange={(e) => set('narrator', e.target.value)}
            placeholder="jméno herce"
            className={tridaPole}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Počet normostran</span>
          <input
            inputMode="numeric"
            value={form.pageCount}
            onChange={(e) => set('pageCount', e.target.value)}
            placeholder="0"
            className={`${tridaPole} text-right tabular-nums`}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Datum vydání</span>
          <input
            type="date"
            value={form.releaseDate}
            onChange={(e) => set('releaseDate', e.target.value)}
            className={tridaPole}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Priorita</span>
          <select value={form.priority} onChange={(e) => set('priority', e.target.value)} className={tridaPole}>
            <option value="">— nevybráno —</option>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1.5 sm:max-w-sm">
        <span className="text-sm font-body text-ink">Stav</span>
        <select value={form.statusName} onChange={(e) => set('statusName', e.target.value)} className={tridaPole}>
          {STAVY_PROJEKTU.map((s) => (
            <option key={s.nazev} value={s.nazev}>
              {s.nazev}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted font-body">{popisStavu(form.statusName)}</span>
      </label>

      {/* Slozka na Disku (zadani 10. 9. 2026). Kdyz uz slozka existuje, jde
          zakladani vypnout a odkaz se doplni na detailu projektu. */}
      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={form.zalozitSlozku}
          onChange={(e) => set('zalozitSlozku', e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-brand-purple"
        />
        <span className="text-sm font-body text-ink">
          Založit složku projektu na Google Disku
          <span className="block text-xs text-muted">
            {firma && !firma.maSlozku
              ? `${firma.label} nemá v portálu vyplněný odkaz na svou složku — složka projektu se nezaloží.`
              : 'Vznikne ve složce vybrané firmy a odkaz se u projektu vyplní sám.'}
          </span>
        </span>
      </label>

      {chyba && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{chyba}</p>}
      {varovani && (
        <p className="text-sm text-ink bg-warnTint border border-line rounded-lg px-3 py-2 m-0">
          Projekt je založený, ale {varovani.charAt(0).toLowerCase() + varovani.slice(1)} Odkaz na složku doplňte
          u projektu ručně.
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={uklada}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          {uklada ? 'Zakládám…' : 'Založit projekt'}
        </button>
        <button type="button" onClick={() => setOtevreno(false)} className="text-muted text-sm font-heading">
          Zavřít
        </button>
      </div>
    </form>
  );
}
