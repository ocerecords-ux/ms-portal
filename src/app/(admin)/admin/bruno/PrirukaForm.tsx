'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Příručka pro Bruna — „jak to u nás chodí" (zadání 16. 9. 2026).
 *
 * Obyčejný text, ne formulář s políčky. Schválně: workflow se mění a nikdo
 * dopředu neví, jaká pole by na ni byla potřeba. Bruno text čte celý, takže
 * co do něj napíšete, to platí — a když se něco změní, přepíše se to tady
 * a Bruno se podle toho chová od další zprávy.
 */
export function PrirukaForm({
  pocatecni,
  vychozi,
  ulozilKdo,
  ulozenoKdy,
}: {
  pocatecni: string;
  /** Text zatím nikdo neuložil — tohle je výchozí znění z kódu. */
  vychozi: boolean;
  ulozilKdo: string | null;
  ulozenoKdy: string | null;
}) {
  const router = useRouter();
  const [text, setText] = useState(pocatecni);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uloz() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/admin/bruno/prirucka', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string })?.error || 'Uložení se nezdařilo.');
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

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-4">
      <div>
        <h2 className="font-heading font-semibold text-ink m-0">Jak to u nás chodí</h2>
        <p className="text-sm font-body text-muted m-0 mt-1">
          Tenhle text dostane Bruno k přečtení pokaždé, než se rozhodne, jestli něco zapíše —
          i v soukromé zprávě. Piš normálně, jako bys zaučoval nového kolegu: co který stav
          projektu znamená, kdo co dělá, co u nás znamenají naše slova. Platí mu to víc než
          to, co si přečte v chatu.
        </p>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={26}
        spellCheck
        className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-body text-sm leading-relaxed outline-none focus:border-brand-purple w-full resize-y"
      />

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => void uloz()}
          disabled={saving || !text.trim()}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          {saving ? 'Ukládám…' : 'Uložit'}
        </button>
        {saved && <span className="text-sm font-body text-brand-greenDeep">Uloženo.</span>}
        {error && <span className="text-sm font-body text-danger">{error}</span>}
        <span className="text-xs font-body text-muted">
          {vychozi
            ? 'Zatím to nikdo neupravoval — tohle je výchozí znění.'
            : ulozenoKdy
              ? `Naposledy uložil${ulozilKdo ? ` ${ulozilKdo}` : 'a'} ${new Date(ulozenoKdy).toLocaleString('cs-CZ')}.`
              : ''}
        </span>
      </div>
    </div>
  );
}
