'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

export function OrderForm({ ratePerPage }: { ratePerPage: number }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [pageCount, setPageCount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const price = useMemo(() => {
    const n = parseFloat(pageCount) || 0;
    return Math.round(n * ratePerPage);
  }, [pageCount, ratePerPage]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set('title', title);
      formData.set('pageCount', pageCount);
      formData.set('deadline', deadline);
      formData.set('note', note);
      if (file) formData.set('attachment', file);

      const res = await fetch('/api/orders', { method: 'POST', body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Objednávku se nepodařilo odeslat.');
      }
      setDone(true);
      setTitle('');
      setPageCount('');
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

  return (
    <form onSubmit={handleSubmit} className="bg-brand-purple rounded-card p-6 sm:p-10 text-white max-w-2xl flex flex-col gap-5">
      <div>
        <h2 className="font-display text-2xl sm:text-3xl text-brand-green m-0">Objednávka audioknihy</h2>
        <p className="text-white/75 text-xs font-heading mt-1.5">
          Vaše sazba: <strong className="text-brand-green font-semibold">{ratePerPage} Kč</strong> / normostrana
        </p>
      </div>

      <div className="flex gap-4 flex-wrap">
        <Field label="Název" required className="flex-[2_1_200px]">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="např. Stín nad Vltavou"
            className="input"
          />
        </Field>
        <Field label="Počet normostran" className="flex-1 min-w-[140px]">
          <input
            type="number"
            min={0}
            step={1}
            value={pageCount}
            onChange={(e) => setPageCount(e.target.value)}
            placeholder="0"
            className="input"
          />
        </Field>
        <Field label="Cena" className="flex-1 min-w-[140px]">
          <input readOnly value={`${new Intl.NumberFormat('cs-CZ').format(price)} Kč`} className="input input-readonly" />
        </Field>
      </div>

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
        <div className="flex items-center gap-2.5 border-[1.5px] border-dashed border-brand-green rounded-lg bg-white/5 px-3.5 py-2.5 text-sm text-white/85">
          <span className="truncate">{file ? file.name : 'Žádný soubor nevybrán'}</span>
          <label className="ml-auto bg-white text-brand-purpleDeep rounded-md px-3 py-1.5 text-xs font-heading font-semibold cursor-pointer">
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
        {done && <span className="text-brand-green text-sm font-heading">✓ Objednávka byla odeslána</span>}
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
        .input-readonly {
          background: #f6f6f6;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          border-style: dashed;
        }
      `}</style>
    </form>
  );
}

function Field({
  label,
  required,
  children,
  className = '',
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-[13.5px] font-body text-white">
        {label}
        {required && <span className="text-brand-green ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
