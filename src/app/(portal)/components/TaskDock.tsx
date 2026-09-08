'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Úkoly pořád po ruce (zadani 8. 9. 2026: "aby byl ten to do list pořád po
 * ruce, tak by se mohl skrývat a odkrývat na pravé straně obrazovky pomocí
 * šipky >. Když se minimalizuje, zůstanou jen ikonky.").
 *
 * Panel visi na prave hrane obrazovky nad obsahem stranky. Zabaleny je z nej
 * jen uzka lista s ikonkami (odskrtavatko s poctem otevrenych ukolu, hodiny s
 * poctem ukolu po terminu), rozbaleny je to cely seznam se zadavanim.
 * Stav (rozbaleno/zabaleno) si pamatuje prohlizec, takze si to kazdy nastavi
 * jednou a drzi mu to.
 *
 * Vidi ho jen tym Mediaspace - klientum se vubec nevykresli (viz layout).
 */

type Task = {
  id: string;
  title: string;
  done: boolean;
  dueDate: string | null;
};

const STORAGE_KEY = 'ms-portal-ukoly-otevreno';

function formatDue(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat('cs-CZ').format(d);
}

function todayIso(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function ChecklistIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M3 6l2 2 3-3M3 13l2 2 3-3M3 20l2 2 3-3" />
      <path d="M12 7h9M12 14h9M12 21h9" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d={direction === 'right' ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
    </svg>
  );
}

export function TaskDock({ tasks }: { tasks: Task[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  // Stav si pamatujeme v prohlizeci, at se panel neotevira porad znovu.
  useEffect(() => {
    try {
      setExpanded(window.localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      // soukrome okno / zakazane uloziste - nevadi, jen si to nezapamatujeme
    }
  }, []);

  function toggle() {
    setExpanded((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        // viz vyse
      }
      return next;
    });
  }

  const today = todayIso();
  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today);

  async function send(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Nepodařilo se uložit.');
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError('Nepodařilo se uložit.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const value = title.trim();
    if (!value) return;
    const ok = await send('/api/tasks', 'POST', { title: value, dueDate: dueDate || null });
    if (ok) {
      setTitle('');
      setDueDate('');
    }
  }

  // --- Zabaleno: jen ikonky na hrane obrazovky ---------------------------
  if (!expanded) {
    return (
      <button
        type="button"
        onClick={toggle}
        title="Zobrazit úkoly"
        aria-label="Zobrazit úkoly"
        className="fixed right-0 top-28 z-40 flex flex-col items-center gap-2 bg-brand-purple hover:bg-brand-purpleDeep rounded-l-card shadow-lg px-2.5 py-3 text-brand-green transition-colors"
      >
        <Chevron direction="left" />
        <span className="relative">
          <ChecklistIcon />
          {open.length > 0 && (
            <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-brand-green text-ink text-[10px] font-heading font-bold leading-4 text-center">
              {open.length}
            </span>
          )}
        </span>
        {overdue.length > 0 && (
          <span className="relative text-white" title={`${overdue.length} po termínu`}>
            <ClockIcon />
            <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-heading font-bold leading-4 text-center">
              {overdue.length}
            </span>
          </span>
        )}
        <span className="text-[10px] font-heading font-bold uppercase tracking-wide [writing-mode:vertical-rl] rotate-180">
          Úkoly
        </span>
      </button>
    );
  }

  // --- Rozbaleno: cely seznam -------------------------------------------
  // Panel drzi horni polovinu prave hrany, chat spodni - pri delsim seznamu
  // ukolu se driv prekryvaly (zprava uzivatele 8. 9. 2026). Seznam se proto
  // radeji roluje uvnitr, nez aby rostl do chatu.
  return (
    <aside className="fixed right-0 top-28 z-40 flex items-stretch">
      {/* Široký pruh na zavření přes celou výšku panelu - do malé šipky
          se špatně trefovalo (zadani 8. 9. 2026). Kliknout jde kamkoliv sem. */}
      <button
        type="button"
        onClick={toggle}
        title="Skrýt úkoly"
        aria-label="Skrýt úkoly"
        className="w-8 shrink-0 rounded-l-card border border-r-0 border-line bg-field text-muted hover:bg-brand-purple hover:text-white transition-colors flex flex-col items-center justify-center gap-2"
      >
        <Chevron direction="right" />
        <span className="text-[10px] font-heading font-semibold uppercase tracking-wide [writing-mode:vertical-rl] rotate-180">
          Skrýt
        </span>
        <Chevron direction="right" />
      </button>

      <div className="w-[320px] max-w-[86vw] max-h-[30vh] overflow-y-auto bg-white border border-r-0 border-line shadow-xl flex flex-col">
      {/* Fialova hlavicka se zelenym napisem - stejne jako horni lista a jako
          MS chat (zadani 8. 9. 2026). Drzi se nahore i pri rolovani seznamu. */}
      <div className="sticky top-0 z-10 bg-brand-purple text-brand-green px-4 py-2.5 flex items-center justify-between gap-3">
        <h2 className="font-heading font-semibold text-sm uppercase tracking-wide m-0">Úkoly</h2>
        <button
          type="button"
          onClick={toggle}
          className="text-xs font-heading font-semibold text-brand-green/90 hover:text-white whitespace-nowrap"
        >
          {open.length === 0 ? 'hotovo' : `${open.length} k vyřízení`} ›
        </button>
      </div>

      <div className="p-4 flex flex-col gap-3">

      <form onSubmit={addTask} className="flex flex-col gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nový úkol…"
          className="rounded-lg border border-line bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple w-full"
        />
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            title="Termín (nepovinné)"
            className="flex-1 min-w-0 rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-xs outline-none focus:border-brand-purple"
          />
          <button
            type="submit"
            disabled={busy || !title.trim()}
            className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-50 shrink-0"
          >
            Přidat
          </button>
        </div>
      </form>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-line rounded-lg px-3 py-2 m-0">{error}</p>}

      <ul className="list-none p-0 m-0 flex flex-col divide-y divide-line">
        {open.length === 0 && <li className="text-sm text-muted font-body py-2">Žádné otevřené úkoly. 👌</li>}
        {open.map((task) => (
          <li key={task.id} className="flex items-start gap-2.5 py-2.5 group">
            <input
              type="checkbox"
              checked={false}
              disabled={busy}
              onChange={() => send(`/api/tasks/${task.id}`, 'PATCH', { done: true })}
              className="mt-0.5 w-4 h-4 accent-[#6C4BF4] shrink-0"
            />
            <span className="flex-1 min-w-0 text-sm font-body text-ink break-words">
              {task.title}
              {task.dueDate && (
                <span className={`block text-xs font-heading mt-0.5 ${task.dueDate < today ? 'text-red-600' : 'text-muted'}`}>
                  {task.dueDate < today ? 'Po termínu — ' : 'Do '}
                  {formatDue(task.dueDate)}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => send(`/api/tasks/${task.id}`, 'DELETE')}
              disabled={busy}
              title="Smazat úkol"
              className="text-muted hover:text-red-600 text-xs font-heading opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {done.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="text-xs font-heading text-muted hover:text-ink text-left"
          >
            {showDone ? 'Skrýt hotové' : `Hotové (${done.length})`}
          </button>
          {showDone && (
            <ul className="list-none p-0 m-0 flex flex-col divide-y divide-line">
              {done.map((task) => (
                <li key={task.id} className="flex items-start gap-2.5 py-2 group">
                  <input
                    type="checkbox"
                    checked
                    disabled={busy}
                    onChange={() => send(`/api/tasks/${task.id}`, 'PATCH', { done: false })}
                    className="mt-0.5 w-4 h-4 accent-[#6C4BF4] shrink-0"
                  />
                  <span className="flex-1 min-w-0 text-sm font-body text-muted line-through break-words">{task.title}</span>
                  <button
                    type="button"
                    onClick={() => send(`/api/tasks/${task.id}`, 'DELETE')}
                    disabled={busy}
                    title="Smazat úkol"
                    className="text-muted hover:text-red-600 text-xs font-heading opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      </div>
      </div>
    </aside>
  );
}
