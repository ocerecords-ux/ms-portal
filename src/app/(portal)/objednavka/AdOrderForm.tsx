'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DatumPole } from '@/components/DatumPole';

/**
 * Objednavka reklamy (zadani 12. 9. 2026) - klienti, kteri poptavaji jen
 * reklamy, nepotrebuji normostrany/cenu/herce jako u audioknihy. Zatim jen
 * zakladni pole (nazev, termin, poznamka, priloha) - zbytek si Mediaspace
 * s temito klienty vyspecifikuje pozdeji, viz OrderKind ve schema.prisma.
 */
export function AdOrderForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [deadline, setDeadline] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  /**
   * Odebrání přílohy (24. 9. 2026). Vstup se přitom musí vynulovat, jinak by
   * se tentýž soubor nedal vybrat znovu - onChange se při stejné hodnotě
   * nespustí.
   */
  const vstupSouboru = useRef<HTMLInputElement | null>(null);

  function odeberSoubor() {
    setFile(null);
    if (vstupSouboru.current) vstupSouboru.current.value = '';
  }
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [varovani, setVarovani] = useState<string | null>(null);
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
      // Priloha jde do uloziste zvlast - viz nahrajPrilohu nize.
      if (file) {
        const klic = await nahrajPrilohu(file);
        formData.set('attachmentKey', klic);
        formData.set('attachmentName', file.name);
      }

      const res = await fetch('/api/orders', { method: 'POST', body: formData });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || 'Objednávku se nepodařilo odeslat.');
      }
      setLastTitle(title);
      // Objednavka projde i tehdy, kdyz se prilohu nepodari ulozit - ale
      // odesilatel se to musi dozvedet (oprava 9. 9. 2026).
      setVarovani(body?.varovani ?? null);
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
            „{lastTitle}" — objednávku jsme uložili k vašemu účtu a Mediaspace se vám brzy ozve.
          </p>
          {varovani && (
            <p className="mt-3 mb-0 rounded-lg bg-white/15 border border-brand-green px-3 py-2 text-sm font-body text-white">
              {varovani}
            </p>
          )}
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
        <DatumPole value={deadline} onChange={(e) => setDeadline(e.target.value)} className="input" />
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
          className={`flex flex-col items-center justify-center gap-2 border-[1.5px] border-dashed rounded-lg px-4 py-8 text-sm text-white/85 text-center transition-colors ${
            dragOver ? 'border-white bg-white/15' : 'border-brand-green bg-white/5'
          }`}
        >
          <span className="truncate">
            {file ? file.name : dragOver ? 'Pusťte soubor sem…' : 'Přetáhněte soubor sem, nebo ho vyberte'}
          </span>
          <span className="inline-flex items-center gap-2">
            <label className="shrink-0 bg-white text-brand-purpleDeep rounded-md px-3 py-1.5 text-xs font-heading font-semibold cursor-pointer">
              {file ? 'Vybrat jiný' : 'Vybrat soubor'}
              <input
                ref={vstupSouboru}
                type="file"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {/* Odebrat přílohu (zadání 24. 9. 2026: „když klient nahraje
                omylem nějaké PDF, mělo by jít z formuláře i smazat"). */}
            {file && (
              <button
                type="button"
                onClick={odeberSoubor}
                className="shrink-0 border border-white/60 text-white rounded-md px-3 py-1.5 text-xs font-heading font-semibold hover:bg-white/15 transition-colors"
              >
                Odebrat
              </button>
            )}
          </span>
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
        /* :global - políčko s datem (DatumPole) je samostatná komponenta a
           scoped třída styled-jsx se na něj nedostane; bez tohohle mělo bílé
           písmo na bílém poli a klient neviděl, co píše (oprava 22. 9. 2026). */
        :global(.input) {
          font-family: 'Acid Grotesk', var(--font-inter);
          font-size: 14.5px;
          border-radius: 8px;
          border: 1.5px solid #1fdf67;
          padding: 11px 13px;
          background: #fff;
          color: #201a33;
          width: 100%;
          color-scheme: light;
        }
        :global(.input)::placeholder {
          color: #a9a2c2;
        }
        :global(.input):focus {
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

/**
 * Pošle přílohu rovnou do úložiště a vrátí klíč, pod kterým tam leží
 * (oprava 16. 9. 2026: „klientovi se nepodařilo odeslat objednávku").
 *
 * Soubor SCHVÁLNĚ NEJDE PŘES PORTÁL: funkce na Vercelu mají strop na velikost
 * požadavku kolem 4,5 MB a naskenovaný rukopis ho přeleze snadno — objednávka
 * pak spadla na chybu 413 a formulář uměl říct jen „nepodařilo se odeslat".
 * Stejnou cestou posílá soubory chat.
 */
async function nahrajPrilohu(soubor: File): Promise<string> {
  const podpis = await fetch('/api/orders/priloha/podpis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: soubor.name, mime: soubor.type, size: soubor.size }),
  });
  const data = await podpis.json().catch(() => ({}));
  if (!podpis.ok || !data?.uploadUrl) {
    throw new Error(data?.error || 'Přílohu se nepodařilo připravit k odeslání.');
  }

  const nahrano = await fetch(data.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': soubor.type || 'application/octet-stream' },
    body: soubor,
  });
  if (!nahrano.ok) {
    throw new Error('Přílohu se nepodařilo nahrát. Zkuste to prosím znovu.');
  }
  return data.key as string;
}
