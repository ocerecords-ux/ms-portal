'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TlacitkoSmazat } from '@/components/TlacitkoSmazat';
import type { WorkType } from '@prisma/client';
import {
  WORK_TYPE_LABELS,
  WORK_TYPE_OPTIONS,
  durationMinutes,
  entryAmount,
  formatCzk,
  formatDuration,
  formatTime,
  parseTime,
  requiresProject,
} from '@/lib/timesheets';
import { VyberProjektu } from '@/app/(portal)/components/VyberProjektu';
import { VyberPole } from '@/components/VyberPole';
import { DatumPole } from '@/components/DatumPole';
import Link from 'next/link';

/**
 * Projekt ve výkazu je odkaz na jeho stránku (zadání 23. 9. 2026 od Tomáše
 * Moravce: „ve výkazech udělat položky sloupečku PROJEKT click through /
 * hyperlink, aby tě to rovnou hodilo na stránku projektu - člověk to pak
 * nemusí hledat v projektech"). Bez ID projektu zůstane jen text.
 */
function NazevProjektu({ id, nazev }: { id: string | null; nazev: string | null }) {
  if (!nazev) return <span className="text-muted/60">—</span>;
  if (!id) return <>{nazev}</>;
  return (
    <Link href={`/projekty/${encodeURIComponent(id)}`} className="text-brand-purple no-underline hover:underline">
      {nazev}
    </Link>
  );
}

type Entry = {
  id: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
  workType: WorkType;
  projectId: string | null;
  projectName: string | null;
  note: string | null;
  hourlyRateSnapshot: number;
  userId: string;
  userLabel: string;
  mine: boolean;
};

type ProjectOption = { id: string; label: string; dokonceny?: boolean };

/**
 * SCHVÁLENÝ BONUS V PŘEHLEDU (zadání 15. 9. 2026: „v tom celkovém hlavním
 * přehledu výkazů nevidíme bonusy").
 *
 * Bonus není řádek výkazu - nemá hodiny ani druh práce. Do tabulky výkazů
 * proto nepatří; stojí pod ní zvlášť a řídí se týmž obdobím a týmž zvukařem,
 * protože otázka „kolik to za tohle období dělá" se ptá na obojí.
 */
export type BonusRadek = {
  id: string;
  /** Den schválení (ISO, jen datum) - podle něj se řadí a filtruje. */
  den: string;
  projectId: string | null;
  projectName: string | null;
  userId: string;
  userLabel: string;
  castka: number;
  poznamka: string | null;
};

function todayIso(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Aktualni mesic jako "2026-01". */
function currentMonthKey(): string {
  return todayIso().slice(0, 7);
}

/** "2026-01" -> "Leden 2026" */
function monthLabel(key: string): string {
  const [year, month] = key.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  const name = new Intl.DateTimeFormat('cs-CZ', { month: 'long' }).format(date);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}

/** „1. 9. 2026 – 30. 9. 2026", „od 1. 9. 2026", „do 30. 9. 2026". */
function popisObdobi(od: string, doData: string): string {
  if (od && doData) return `${formatDate(od)} – ${formatDate(doData)}`;
  if (od) return `od ${formatDate(od)}`;
  return `do ${formatDate(doData)}`;
}

type SortKey = 'date' | 'user' | 'duration' | 'workType' | 'project' | 'amount';
type Sort = { key: SortKey; dir: 'asc' | 'desc' };

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat('cs-CZ').format(d);
}

/**
 * Výkazy práce zvukaře - zápis i přehled.
 *
 * Zápis vidí jen ten, kdo si výkazy opravdu dělá, tedy zvukař (`canWrite`).
 * Žůžo-labůžo si výkazy nedělá (zadani 6. 9. 2026: "Nikdo ze Žůžo Labůžo si
 * výkazy nedělá... A zvukaři by zase měli vidět jen ty svoje."), takže pro něj
 * je tahle stránka jen přehled cizích výkazů - proto tu není ani formulář, ani
 * volba "Jen moje". Zvukaři data cizích lidí vůbec nedostanou (filtruje se už
 * na serveru ve vykazy/page.tsx).
 */
export function TimesheetEditor({
  isAdmin,
  canWrite,
  bonusy = [],
  hourlyRate,
  projectOptions,
  entries,
}: {
  isAdmin: boolean;
  /** Smi si tenhle uzivatel psat vykazy? (jen zvukar) */
  canWrite: boolean;
  /** Schválené bonusy - v přehledu se ukazují pod tabulkou výkazů. */
  bonusy?: BonusRadek[];
  hourlyRate: number;
  projectOptions: ProjectOption[];
  entries: Entry[];
}) {
  const router = useRouter();
  // Cas, druh prace i projekt jsou povinne (zadani 6. 9. 2026) - druh prace
  // proto zacina prazdny, aby si ho zvukar musel vybrat vedome.
  const [form, setForm] = useState<{
    date: string;
    from: string;
    to: string;
    workType: WorkType | '';
    project: string;
    note: string;
  }>({
    date: todayIso(),
    from: '',
    to: '',
    workType: '',
    project: '',
    note: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Uprava vykazu (zadani 14. 9. 2026). Zamerne se NEDELA primo v radku
  // tabulky: radek ma sedm sloupcu a na telefonu by se do nej formular
  // nevesel. Misto toho se do nej nacte tentyz formular, ve kterem se vykaz
  // zapisuje - clovek tak upravuje v poli, ktere uz zna.
  const [editId, setEditId] = useState<string | null>(null);
  // Sazba UPRAVOVANEHO vykazu. Je to sazba platna v dobe zapisu, ne dnesni -
  // nahled "kolik to dela" proto musi pocitat s ni, jinak by pri uprave
  // stareho vykazu ukazoval jine cislo, nez jake se pak ulozi.
  const [editRate, setEditRate] = useState<number | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  // Filtry nad seznamem (zadani 6. 9. 2026): mesic, hledani, ciho vykazu a razeni.
  // Otevira se rovnou na aktualnim mesici (zadani 8. 9. 2026: "kdyz se na tu
  // stranku prokliknu, chci mit zobrazeny ten dany mesic") - castka nahore se
  // pak pocita z toho, ktera zalozka je zrovna vybrana.
  const [month, setMonth] = useState<string>(currentMonthKey);
  const [query, setQuery] = useState('');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [sort, setSort] = useState<Sort>({ key: 'date', dir: 'desc' });
  /**
   * VLASTNÍ OBDOBÍ OD–DO a FILTR PODLE DRUHU PRÁCE (zadání 15. 9. 2026:
   * „ve výkazech v obecném přehledu potřebuji podrobnější filtr — vybrat si
   * období od do, pak filtrovat podle střihu a natáčení").
   *
   * Záložky s měsíci zůstávají - na běžné „kolik jsem tenhle měsíc udělal"
   * jsou rychlejší. Období od–do je pro všechno ostatní: čtvrtletí, půlka
   * měsíce, období jedné zakázky. Když je vyplněné, měsíční záložky
   * neplatí (a naopak) - dva filtry nad týmž sloupcem by se jen pletly.
   */
  const [odDatum, setOdDatum] = useState('');
  const [doDatum, setDoDatum] = useState('');
  const [druhPrace, setDruhPrace] = useState<'all' | WorkType>('all');
  const vlastniObdobi = Boolean(odDatum || doDatum);

  // Zalozky s mesici se skladaji z toho, co ve vykazech opravdu je - plus
  // vzdy aktualni mesic, at je na cem zacit i prvniho v mesici, kdy jeste
  // zadny vykaz neni.
  const months = useMemo(() => {
    const set = new Set(entries.map((e) => e.date.slice(0, 7)));
    set.add(currentMonthKey());
    return Array.from(set).sort().reverse();
  }, [entries]);

  const people = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entries) map.set(e.userId, e.userLabel);
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [entries]);

  function toggleSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'project' || key === 'user' || key === 'workType' ? 'asc' : 'desc' },
    );
  }

  const visibleEntries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = entries.filter((e) => {
      // Datumy jsou „2026-09-15", takze se daji porovnavat jako retezce.
      if (vlastniObdobi) {
        if (odDatum && e.date < odDatum) return false;
        if (doDatum && e.date > doDatum) return false;
      } else if (month !== 'all' && !e.date.startsWith(month)) {
        return false;
      }
      if (druhPrace !== 'all' && e.workType !== druhPrace) return false;
      if (userFilter !== 'all' && e.userId !== userFilter) return false;
      if (!needle) return true;
      const haystack = [e.projectName ?? '', e.note ?? '', e.userLabel, WORK_TYPE_LABELS[e.workType], formatDate(e.date)]
        .join(' ')
        .toLowerCase();
      return needle.split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
    });

    const dir = sort.dir === 'asc' ? 1 : -1;
    return rows.sort((a, b) => {
      switch (sort.key) {
        case 'duration':
          return (
            dir * (durationMinutes(a.startMinutes, a.endMinutes) - durationMinutes(b.startMinutes, b.endMinutes))
          );
        case 'amount':
          return (
            dir *
            (entryAmount(a.startMinutes, a.endMinutes, a.hourlyRateSnapshot) -
              entryAmount(b.startMinutes, b.endMinutes, b.hourlyRateSnapshot))
          );
        case 'user':
          return dir * a.userLabel.localeCompare(b.userLabel, 'cs');
        case 'workType':
          return dir * WORK_TYPE_LABELS[a.workType].localeCompare(WORK_TYPE_LABELS[b.workType], 'cs');
        case 'project':
          return dir * (a.projectName ?? '').localeCompare(b.projectName ?? '', 'cs');
        default: {
          const byDate = a.date.localeCompare(b.date);
          return dir * (byDate !== 0 ? byDate : a.startMinutes - b.startMinutes);
        }
      }
    });
  }, [entries, month, userFilter, query, sort, vlastniObdobi, odDatum, doDatum, druhPrace]);

  // Živý náhled: kolik hodin to je a kolik to dělá peněz.
  const preview = useMemo(() => {
    const start = parseTime(form.from);
    const end = parseTime(form.to);
    if (start === null || end === null || start === end) return null;
    const minutes = durationMinutes(start, end);
    return { minutes, amount: entryAmount(start, end, editRate ?? hourlyRate) };
  }, [form.from, form.to, hourlyRate, editRate]);

  // U druhu prace "Ostatni" se projekt nevybira (zadani 8. 9. 2026), takze se
  // ani nevyzaduje. Jinak je povinny stejne jako cas (zadani 6. 9. 2026).
  const needsProject = requiresProject(form.workType);
  const missing =
    !form.date || !form.from || !form.to || !form.workType || (needsProject && !form.project);

  /**
   * Nabidka projektu pro formular. Pri uprave stareho vykazu se do ni prida
   * i projekt, ktery uz v seznamu neni (napr. se mezitim smazal) - jinak by
   * se z upravovaneho vykazu projekt pri ulozeni ztratil, aniz by si toho
   * nekdo vsiml.
   */
  const nabidkaProjektu = useMemo(() => {
    if (!editId) return projectOptions;
    const upravovany = entries.find((e) => e.id === editId);
    if (!upravovany?.projectId || !upravovany.projectName) return projectOptions;
    if (projectOptions.some((p) => p.id === upravovany.projectId)) return projectOptions;
    return [{ id: upravovany.projectId, label: upravovany.projectName }, ...projectOptions];
  }, [editId, entries, projectOptions]);

  /**
   * Bonusy se řídí TÝMŽ obdobím a týmž zvukařem jako výkazy. Filtr na druh
   * práce je ale vynechává: bonus není natáčení ani střih, a nechat ho
   * v součtu „kolik nás stál střih" by ten součet rozbilo.
   */
  const visibleBonusy = useMemo(() => {
    if (druhPrace !== 'all') return [];
    const needle = query.trim().toLowerCase();
    return bonusy
      .filter((b) => {
        if (vlastniObdobi) {
          if (odDatum && b.den < odDatum) return false;
          if (doDatum && b.den > doDatum) return false;
        } else if (month !== 'all' && !b.den.startsWith(month)) {
          return false;
        }
        if (userFilter !== 'all' && b.userId !== userFilter) return false;
        if (!needle) return true;
        const seno = [b.projectName ?? '', b.poznamka ?? '', b.userLabel, 'bonus'].join(' ').toLowerCase();
        return needle.split(/\s+/).filter(Boolean).every((slovo) => seno.includes(slovo));
      })
      .sort((a, b) => b.den.localeCompare(a.den));
  }, [bonusy, druhPrace, month, vlastniObdobi, odDatum, doDatum, userFilter, query]);

  const totals = useMemo(() => {
    let minutes = 0;
    let amount = 0;
    for (const e of visibleEntries) {
      minutes += durationMinutes(e.startMinutes, e.endMinutes);
      amount += entryAmount(e.startMinutes, e.endMinutes, e.hourlyRateSnapshot);
    }
    const bonus = visibleBonusy.reduce((sum, b) => sum + b.castka, 0);
    // „Celkem" je to, co se za období vydělalo - tedy i s bonusy. Hodiny
    // zůstávají jen za odpracovanou práci; bonus žádné nemá.
    return { minutes, amount, bonus, celkem: amount + bonus };
  }, [visibleEntries, visibleBonusy]);

  /** Nacte vykaz do formulare a odroluje k nemu (zadani 14. 9. 2026). */
  function zacniUpravu(entry: Entry) {
    setEditId(entry.id);
    setEditRate(entry.hourlyRateSnapshot);
    setError(null);
    setForm({
      date: entry.date,
      from: formatTime(entry.startMinutes),
      to: formatTime(entry.endMinutes),
      workType: entry.workType,
      project: entry.projectId ?? '',
      note: entry.note ?? '',
    });
    // Formular je nad tabulkou; bez odrolovani by se pri uprave radku dole
    // zdanlive nic nestalo.
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }

  /** Zpatky na prazdny formular. U Zuzo-labuzo se formular uplne schova. */
  function zrusUpravu() {
    setEditId(null);
    setEditRate(null);
    setError(null);
    setForm({ date: todayIso(), from: '', to: '', workType: '', project: '', note: '' });
  }

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    if (missing) {
      setError(
        needsProject
          ? 'Vyplňte datum, čas od–do, druh práce a projekt.'
          : 'Vyplňte datum, čas od–do a druh práce.',
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const selected = needsProject ? nabidkaProjektu.find((p) => p.id === form.project) : undefined;
      const res = await fetch(editId ? `/api/timesheets/${editId}` : '/api/timesheets', {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: form.date,
          from: form.from,
          to: form.to,
          workType: form.workType,
          caflouProjectId: selected?.id ?? '',
          projectName: needsProject ? (selected?.label ?? form.project) : '',
          note: form.note,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Uložení se nezdařilo.');
        return;
      }
      if (editId) {
        zrusUpravu();
      } else {
        setForm((f) => ({ ...f, note: '' }));
      }
      router.refresh();
    } catch {
      setError('Uložení se nezdařilo.');
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry(id: string) {
    setBusyId(id);
    setError(null);
    // Kdyz se maze prave upravovany vykaz, nesmi formular zustat "nad" nicim -
    // ulozeni by pak skoncilo hlaskou "Výkaz nenalezen".
    if (editId === id) zrusUpravu();
    try {
      const res = await fetch(`/api/timesheets/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Smazání se nezdařilo.');
        return;
      }
      router.refresh();
    } catch {
      setError('Smazání se nezdařilo.');
    } finally {
      setBusyId(null);
    }
  }

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full';

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between flex-wrap gap-4">
        <div>
          <h1 className="hidden sm:block font-display text-3xl sm:text-4xl text-ink m-0">Výkazy</h1>
          {canWrite && (
            // Navod pryc (zadani 9. 9. 2026), sazba zustava - to je udaj,
            // ne vysvetlivka.
            <p className="text-muted text-sm mt-1 font-body">
              Vaše hodinová sazba: {formatCzk(hourlyRate)}
            </p>
          )}
        </div>
        <div className="text-right">
          {/* Souctu se tyka KAZDY filtr, takze nadpis musi rict, ceho se to
              tyka - jinak by „Celkem · Září" lhalo, kdyz je zapnuty strih
              nebo vlastni obdobi (zadani 15. 9. 2026). */}
          <p className="text-xs font-heading text-muted uppercase tracking-wide m-0">
            Celkem · {vlastniObdobi ? popisObdobi(odDatum, doDatum) : month === 'all' ? 'vše' : monthLabel(month)}
            {druhPrace !== 'all' ? ` · ${WORK_TYPE_LABELS[druhPrace]}` : ''}
          </p>
          <p className="font-display text-2xl text-ink m-0 tabular-nums">{formatCzk(totals.celkem)}</p>
          <p className="text-xs font-body text-muted m-0">
            {formatDuration(totals.minutes)}
            {totals.bonus > 0 && ` · z toho bonusy ${formatCzk(totals.bonus)}`}
          </p>
        </div>
      </div>

      {/* Formular se ukazuje zvukari porad (pise si vykazy) a Zuzo-labuzo jen
          ve chvili, kdy nejaky vykaz upravuje - zalozit novy si nesmi
          (zadani 6. 9. 2026), opravit cizi ano (zadani 14. 9. 2026). */}
      {(canWrite || editId) && (
        <form ref={formRef} onSubmit={addEntry} className="bg-surface rounded-card border border-line shadow-sm p-6 flex flex-col gap-5">
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
            {editId ? 'Úprava výkazu' : 'Nový výkaz'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">
                Datum <span className="text-danger">*</span>
              </span>
              <DatumPole
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">
                Od <span className="text-danger">*</span>
              </span>
              <input
                type="time"
                required
                step={1800}
                value={form.from}
                onFocus={() => {
                  if (!form.from) setForm((f) => (f.from ? f : { ...f, from: celaHodina(0) }));
                }}
                onChange={(e) => setForm({ ...form, from: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">
                Do <span className="text-danger">*</span>
              </span>
              <input
                type="time"
                required
                step={1800}
                value={form.to}
                onFocus={() => {
                  if (!form.to) setForm((f) => (f.to ? f : { ...f, to: celaHodina(1, f.from) }));
                }}
                onChange={(e) => setForm({ ...form, to: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">
                Druh práce <span className="text-danger">*</span>
              </span>
              <VyberPole
                required
                value={form.workType}
                onChange={(e) => {
                  const workType = e.target.value as WorkType | '';
                  // Prepnuti na "Ostatni" rovnou zahodi vybrany projekt, at
                  // se neodesle neco, co uz na obrazovce neni videt.
                  setForm({ ...form, workType, project: requiresProject(workType) ? form.project : '' });
                }}
                className={inputClass}
              >
                <option value="">— vyberte druh práce —</option>
                {WORK_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {WORK_TYPE_LABELS[t]}
                  </option>
                ))}
              </VyberPole>
            </label>

            {needsProject && (
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-sm font-body text-ink">
                Projekt <span className="text-danger">*</span>
              </span>
              {/* Misto rolovaciho seznamu se sedmi sty polozkami se projekt
                  HLEDA PSANIM (zadani 11. 9. 2026) - viz VyberProjektu.tsx. */}
              <VyberProjektu
                projekty={nabidkaProjektu}
                hodnota={form.project}
                onZmena={(id) => setForm({ ...form, project: id })}
              />
              <span className="text-xs text-muted font-body">
                {nabidkaProjektu.length === 0
                  ? 'Zatím se nenačetly žádné projekty.'
                  : 'Pište název projektu, firmu nebo číslo. V nabídce jsou i dokončené projekty.'}
              </span>
            </label>
            )}

            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-sm font-body text-ink">Poznámka</span>
              <input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="nepovinné"
                className={inputClass}
              />
            </label>
          </div>

          {error && (
            <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{error}</p>
          )}

          <div className="flex items-center gap-4 flex-wrap">
            <button
              type="submit"
              disabled={saving || missing}
              className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
            >
              {saving ? 'Ukládám…' : editId ? 'Uložit změny' : 'Přidat výkaz'}
            </button>
            {editId && (
              <button
                type="button"
                onClick={zrusUpravu}
                disabled={saving}
                className="font-heading font-semibold text-sm text-muted hover:text-ink transition-colors disabled:opacity-60"
              >
                Zrušit úpravu
              </button>
            )}
            {preview ? (
              <span className="text-sm font-heading text-ink">
                {formatDuration(preview.minutes)} ·{' '}
                <strong className="text-brand-purpleDark">{formatCzk(preview.amount)}</strong>
              </span>
            ) : (
              <span className="text-sm font-body text-muted">
                {needsProject
                  ? 'Vyplňte čas od–do, druh práce a projekt — bez nich výkaz uložit nejde.'
                  : 'Vyplňte čas od–do a druh práce — u „Ostatní" se projekt nevybírá.'}
              </span>
            )}
          </div>
        </form>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4 flex-wrap border-b border-line">
          <div className="flex items-center gap-1 flex-wrap">
            {/* Kliknuti na mesic zahazuje vlastni obdobi - jinak by zalozka
                svitila, ale seznam by se ridil necim jinym. */}
            <MonthTab
              active={!vlastniObdobi && month === 'all'}
              onClick={() => {
                setMonth('all');
                setOdDatum('');
                setDoDatum('');
              }}
              label="Vše"
            />
            {months.map((m) => (
              <MonthTab
                key={m}
                active={!vlastniObdobi && month === m}
                onClick={() => {
                  setMonth(m);
                  setOdDatum('');
                  setDoDatum('');
                }}
                label={monthLabel(m)}
              />
            ))}
          </div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            {/* Vlastni obdobi od-do (zadani 15. 9. 2026). Prazdna strana
                znamena „bez omezeni" - da se tak napsat i „od 1. 9. dal". */}
            <span className="flex items-center gap-1.5">
              <span className="text-xs font-heading text-muted uppercase tracking-wide">Období</span>
              <DatumPole
                value={odDatum}
                onChange={(e) => setOdDatum(e.target.value)}
                title="Od data"
                className="rounded-lg border border-line bg-surface px-2.5 py-2 text-sm font-heading text-ink outline-none focus:border-brand-purple"
              />
              <span className="text-muted text-sm">–</span>
              <DatumPole
                value={doDatum}
                onChange={(e) => setDoDatum(e.target.value)}
                title="Do data"
                className="rounded-lg border border-line bg-surface px-2.5 py-2 text-sm font-heading text-ink outline-none focus:border-brand-purple"
              />
              {vlastniObdobi && (
                <button
                  type="button"
                  onClick={() => {
                    setOdDatum('');
                    setDoDatum('');
                  }}
                  title="Zrušit období a vrátit se k měsícům"
                  className="text-xs font-heading text-muted hover:text-danger px-1"
                >
                  ✕
                </button>
              )}
            </span>

            {/* Druh prace - nataceni / strih / ostatni (zadani 15. 9. 2026). */}
            <VyberPole
              value={druhPrace}
              onChange={(e) => setDruhPrace(e.target.value as 'all' | WorkType)}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-heading text-ink outline-none focus:border-brand-purple"
            >
              <option value="all">Všechny druhy práce</option>
              {WORK_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {WORK_TYPE_LABELS[t]}
                </option>
              ))}
            </VyberPole>

            {/* Prepinac "ciho vykazu" ma smysl jen pro Zuzo-labuzo, ktere vidi
                cely tym. Zvukar vidi jen svoje (filtruje server), takze by mu
                nabizel jedinou moznost. Volba "Jen moje" tu uz neni - Zuzo
                -labuzo si vykazy nedela (zadani 6. 9. 2026). */}
            {isAdmin && people.length > 1 && (
              <VyberPole
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-heading text-ink outline-none focus:border-brand-purple"
              >
                <option value="all">Všichni zvukaři</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </VyberPole>
            )}
            <div className="relative">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Hledat projekt, poznámku…"
                className="w-64 max-w-full rounded-lg border border-line bg-surface pl-9 pr-3 py-2 text-sm font-heading text-ink outline-none focus:border-brand-purple"
              />
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </div>
          </div>
        </div>

      {/* Chyby z formulare se vypisuji primo v nem; tohle je pro Zuzo-labuzo,
          ktere formular otevreny nema (napr. nepovedene mazani). */}
      {!canWrite && !editId && error && (
        <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{error}</p>
      )}

      <div className="bg-surface rounded-card border border-line overflow-hidden shadow-sm">
        <div className="overflow-x-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-field [&::-webkit-scrollbar-thumb]:bg-line [&::-webkit-scrollbar-thumb]:rounded-full">
          <table className="w-full min-w-[840px] border-collapse">
            <thead>
              <tr className="bg-brand-purple text-white font-heading text-xs">
                <SortHeader label="Datum" sortKey="date" sort={sort} onSort={toggleSort} />
                {isAdmin && <SortHeader label="Zvukař" sortKey="user" sort={sort} onSort={toggleSort} />}
                <th className="text-left px-4 py-3.5 whitespace-nowrap">Od–do</th>
                <SortHeader label="Hodiny" sortKey="duration" sort={sort} onSort={toggleSort} />
                <SortHeader label="Druh práce" sortKey="workType" sort={sort} onSort={toggleSort} />
                <SortHeader label="Projekt" sortKey="project" sort={sort} onSort={toggleSort} />
                <SortHeader label="Částka" sortKey="amount" sort={sort} onSort={toggleSort} align="right" />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleEntries.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="px-4 py-8 text-center text-muted text-sm font-body">
                    {entries.length === 0 ? 'Zatím tu není žádný výkaz.' : 'Nic neodpovídá filtru.'}
                  </td>
                </tr>
              )}
              {visibleEntries.map((e) => {
                const minutes = durationMinutes(e.startMinutes, e.endMinutes);
                return (
                  <tr key={e.id} className="border-t border-line hover:bg-surfaceSoft">
                    <td className="px-4 py-3.5 text-sm font-heading text-ink tabular-nums whitespace-nowrap">
                      {formatDate(e.date)}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3.5 text-sm font-heading text-muted whitespace-nowrap">{e.userLabel}</td>
                    )}
                    <td className="px-4 py-3.5 text-sm font-heading text-muted tabular-nums whitespace-nowrap">
                      {formatTime(e.startMinutes)}–{formatTime(e.endMinutes)}
                    </td>
                    <td className="px-4 py-3.5 text-sm font-heading text-muted tabular-nums whitespace-nowrap">
                      {formatDuration(minutes)}
                    </td>
                    <td className="px-4 py-3.5 text-sm font-heading whitespace-nowrap">
                      <span
                        className={`inline-flex items-center text-xs font-heading font-semibold px-2.5 py-1 rounded-pill ${
                          e.workType === 'RECORDING'
                            ? 'bg-tint text-brand-purpleDark'
                            : e.workType === 'EDITING'
                              ? 'bg-okTint text-status-done'
                              : 'bg-field text-muted'
                        }`}
                      >
                        {WORK_TYPE_LABELS[e.workType]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-heading text-muted">
                      <NazevProjektu id={e.projectId} nazev={e.projectName} />
                      {e.note && <span className="block text-xs text-muted/80 font-body">{e.note}</span>}
                    </td>
                    <td className="px-4 py-3.5 text-sm font-heading text-ink tabular-nums text-right whitespace-nowrap">
                      {formatCzk(entryAmount(e.startMinutes, e.endMinutes, e.hourlyRateSnapshot))}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      {/* Upravit i Smazat vidi ten, kdo na ne ma pravo:
                          zvukar u svych vykazu, Zuzo-labuzo u vsech
                          (zadani 14. 9. 2026). Kontrola je znovu na serveru. */}
                      {(e.mine || isAdmin) && (
                        <span className="inline-flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => zacniUpravu(e)}
                            disabled={busyId === e.id}
                            className={`text-sm font-heading disabled:opacity-50 ${
                              editId === e.id ? 'text-brand-purpleDark font-semibold' : 'text-brand-purple'
                            }`}
                          >
                            {editId === e.id ? 'Upravuje se' : 'Upravit'}
                          </button>
                          {/* POJISTKA (zadání 18. 9. 2026: „když chci smazat
                              výkaz, měla by tam být všude pojistka"). První
                              klepnutí se jen zeptá. */}
                          <TlacitkoSmazat
                            onSmazat={() => removeEntry(e.id)}
                            bezi={busyId === e.id}
                            otazka="Opravdu smazat výkaz?"
                          />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* BONUSY (zadani 15. 9. 2026). Zvlast pod tabulkou - nejsou to hodiny
          a v tabulce vykazu by mely prazdne sloupce Od-do i Hodiny. */}
      {visibleBonusy.length > 0 && (
        <div className="bg-surface rounded-card border border-line overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-line flex items-baseline justify-between gap-3 flex-wrap">
            <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
              Schválené bonusy
            </h2>
            <span className="text-sm font-heading text-ink tabular-nums">{formatCzk(totals.bonus)}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <tbody>
                {visibleBonusy.map((b) => (
                  <tr key={b.id} className="border-t border-line first:border-t-0">
                    <td className="px-4 py-3 text-sm font-heading text-ink tabular-nums whitespace-nowrap">
                      {formatDate(b.den)}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-sm font-heading text-muted whitespace-nowrap">{b.userLabel}</td>
                    )}
                    <td className="px-4 py-3 text-sm font-heading text-muted">
                      <NazevProjektu id={b.projectId} nazev={b.projectName} />
                      {b.poznamka && <span className="block text-xs text-muted/80 font-body">{b.poznamka}</span>}
                    </td>
                    <td className="px-4 py-3 text-sm font-heading text-ink tabular-nums text-right whitespace-nowrap">
                      {formatCzk(b.castka)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>
    </section>
  );
}

function MonthTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-heading font-semibold rounded-t-lg -mb-px border border-b-0 transition-colors ${
        active ? 'bg-surface border-line text-brand-purple' : 'border-transparent text-muted hover:text-ink'
      }`}
    >
      {label}
    </button>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: SortKey;
  sort: Sort;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const active = sort.key === sortKey;
  return (
    <th className={`px-4 py-3.5 whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={`Seřadit podle: ${label}`}
        className={`inline-flex items-center gap-1.5 font-heading text-xs transition-colors hover:text-brand-green ${
          active ? 'text-brand-green' : 'text-white/85'
        } ${align === 'right' ? 'flex-row-reverse' : ''}`}
      >
        {label}
        {active && (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`w-3 h-3 shrink-0 transition-transform ${sort.dir === 'desc' ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        )}
      </button>
    </th>
  );
}

/**
 * VÝCHOZÍ ČAS NA CELOU HODINU (zadání 21. 9. 2026: „změnil bych defaultní
 * časování výkazů z :30 na :00"). Prázdné pole si při kliknutí samo předvyplní
 * celou hodinu - jinak výběr času (hlavně kolečko v telefonu) nabídl aktuální
 * čas zaokrouhlený na půlhodinu. „Do" navazuje hodinu po „Od".
 */
function celaHodina(posun: number, od?: string): string {
  const zaklad = od ? parseTime(od) : null;
  const hodina =
    zaklad !== null ? Math.floor(zaklad / 60) + posun : new Date().getHours() + posun;
  return `${String(((hodina % 24) + 24) % 24).padStart(2, '0')}:00`;
}
