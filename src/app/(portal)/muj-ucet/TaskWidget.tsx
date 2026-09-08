'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Task = {
  id: string;
  title: string;
  done: boolean;
  dueDate: string | null;
};

function formatDue(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat('cs-CZ').format(d);
}

function todayIso(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/**
 * Úkoly na profilu člena týmu Mediaspace (zadani 5. 9. 2026). Jednoduchy
 * to-do seznam: napsat, odskrtnout, smazat. Ukoly vidi jen jejich vlastnik -
 * server bere uzivatele vzdy ze session, nikdy z pozadavku.
 */
export function TaskWidget({ tasks }: { tasks: Task[] }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const today = todayIso();

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

  return (
    <aside className="bg-white rounded-card border border-line shadow-sm p-5 flex flex-col gap-4 h-fit">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Úkoly</h2>
        <span className="text-xs font-heading text-muted tabular-nums">
          {open.length === 0 ? 'hotovo' : `${open.length} k vyřízení`}
        </span>
      </div>

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
        {open.length === 0 && (
          <li className="text-sm text-muted font-body py-2">Žádné otevřené úkoly. 👌</li>
        )}
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
                <span
                  className={`block text-xs font-heading mt-0.5 ${
                    task.dueDate < today ? 'text-red-600' : 'text-muted'
                  }`}
                >
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
                  <span className="flex-1 min-w-0 text-sm font-body text-muted line-through break-words">
                    {task.title}
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
          )}
        </div>
      )}
    </aside>
  );
}
