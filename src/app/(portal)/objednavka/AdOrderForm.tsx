'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Objednavka reklamy (zadani 12. 9. 2026) - klienti, kteri poptavaji jen
 * reklamy, nepotrebuji normostrany/cenu/herce jako u audioknihy. Zatim jen
 * zakladni pole (nazev, termin, poznamka, priloha) - zbytek si MEDIA SPACE
 * s temito klienty vyspecifikuje pozdeji, viz OrderKind ve schema.prisma.
 */
export function AdOrderForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [deadline, setDeadline] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [lastTitle, setLastTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set('kind', 'AD');
      formData.set('title', title);
      formData.set('deadline', deadline);
      formData.set('note', note);
      if (file) formData.set('attachment', file);

      const res = await fetch('/api/orders', { method: 'POST', body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Objednávku se nepodařilo odeslat.');
      }
      setLastTitle(title);
      setDone(true);
      setTitle('');
      setDeadline('');
      setNote('');
      setFile(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Objednávku se nepodařilo odeslat.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleFileDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  }

  if (done) {
    return (
      <div className="bg-brand-purple rounded-card p-6 sm:p-10 text-white max-w-2xl mx-auto flex flex-col items-start gap-5">
        <div className="w-14 h-14 rounded-full bg-brand-green flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="#201a33" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
            <path d="M4 12l6 6L20 6" />
          </svg>
        </div>
        <div>
          <h2 className="font-display text-2xl sm:text-3xl text-brand-green m-0">Objednávka byla odeslána</h2>
          <p className="text-white/85 text-sm font-body mt-2">
            „{lastTitle}" — objednávku jsme uložili k vašemu účtu a MEDIA SPACE se vám brzy ozve.
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <button
            type="button"
            onClick={() => setDone(false)}
            className="border-2 border-brand-green text-brand-green font-heading font-semibold text-sm rounded-lg px-8 py-3 hover:bg-brand-green hover:text-brand-purpleDark transition-colors"
          >
            + Vytvořit další objednávku
          </button>
          <Link href="/projekty" className="text-white/85 text-sm font-heading underline">
            Zobrazit Projekty
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-brand-purple rounded-card p-6 sm:p-10 text-white max-w-2xl mx-auto flex flex-col gap-5">
      <div>
        <h2 className="font-display text-2xl sm:text-3xl text-brand-green m-0">Objednávka</h2>
      </div>

      <Field label="Název" required>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="např. Vánoční kampaň 2026"
          className="input"
        />
      </Field>

      <Field label="Datum odevzdání">
        <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="input" />
      </Field>

      <Field label="Poznámka">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Cokoliv, co bychom měli vědět k objednávce…"
          className="input min-h-[90px] font-body resize-y"
        />
      </Field>

      <Field label="Příloha">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
          className={`flex items-center gap-2.5 border-[1.5px] border-dashed rounded-lg px-3.5 py-2.5 text-sm text-white/85 transition-colors ${
            dragOver ? 'border-white bg-white/15' : 'border-brand-green bg-white/5'
          }`}
        >
          <span className="truncate">
            {file ? file.name : dragOver ? 'Pusťte soubor sem…' : 'Přetáhněte soubor sem, nebo ho vyberte'}
          </span>
          <label className="ml-auto shrink-0 bg-white text-brand-purpleDeep rounded-md px-3 py-1.5 text-xs font-heading font-semibold cursor-pointer">
            Vybrat soubor
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
      </Field>

      {error && <p className="bg-red-500/30 rounded-lg px-3.5 py-2.5 text-sm">{error}</p>}

      <div className="flex items-center gap-4 flex-wrap mt-1">
        <button
          type="submit"
          disabled={submitting}
          className="border-2 border-brand-green text-brand-green font-heading font-semibold text-sm rounded-lg px-8 py-3 hover:bg-brand-green hover:text-brand-purpleDark transition-colors disabled:opacity-60"
        >
          {submitting ? 'Odesílám…' : 'Objednat'}
        </button>
      </div>

      <style jsx>{`
        .input {
          font-family: var(--font-inter);
          font-size: 14.5px;
          border-radius: 8px;
          border: 1.5px solid #1fdf67;
          padding: 11px 13px;
          background: #fff;
          color: #201a33;
          width: 100%;
        }
        .input::placeholder {
          color: #a9a2c2;
        }
        .input:focus {
          outline: none;
          border-color: #fff;
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.35);
        }
      `}</style>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13.5px] font-body text-white inline-flex items-center gap-1.5">
        {label}
        {required && <span className="text-brand-green ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
