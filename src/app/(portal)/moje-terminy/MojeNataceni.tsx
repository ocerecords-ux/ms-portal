'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * MOJE NATÁČENÍ + PŘEBOOKOVÁNÍ (zadání 19. 9. 2026: „když je vše s hercem
 * naplánované, aby viděl své termíny v portálu, když se přihlásí. Zároveň aby
 * měl možnost si i nějaký termín přebookovat sám… jakmile to bude mimo datum,
 * tak to půjde, ale musí mu tam vyskočit hláška, že to musíme potvrdit").
 */
export type Nataceni = {
  id: string;
  projekt: string;
  start: string;
  end: string;
  mesto: string;
  timezone: string;
  /** Čekající žádost o přesun za termín odevzdání. */
  zadost: { start: string; end: string } | null;
};

type Misto = { studioId: string; start: string; end: string; poTerminu: boolean };

export function MojeNataceni({ terminy }: { terminy: Nataceni[] }) {
  const router = useRouter();
  const [otevreny, setOtevreny] = useState<string | null>(null);
  const [mista, setMista] = useState<Misto[] | null>(null);
  const [limit, setLimit] = useState<string | null>(null);
  const [nacita, setNacita] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  /** Místo po termínu odevzdání, u kterého se čeká na souhlas s hláškou. */
  const [potvrdit, setPotvrdit] = useState<{ slotId: string; misto: Misto } | null>(null);

  const den = (iso: string, tz: string) =>
    new Intl.DateTimeFormat('cs-CZ', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso));
  const cas = (iso: string, tz: string) =>
    new Intl.DateTimeFormat('cs-CZ', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
  const datum = (d: string) =>
    new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(new Date(`${d}T12:00:00Z`));

  async function otevri(id: string) {
    if (otevreny === id) {
      setOtevreny(null);
      return;
    }
    setOtevreny(id);
    setMista(null);
    setChyba(null);
    setInfo(null);
    setNacita(true);
    try {
      const res = await fetch(`/api/moje-terminy/prebook?slotId=${encodeURIComponent(id)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || 'Volné termíny se nepodařilo načíst.');
        return;
      }
      setMista(data.mista);
      setLimit(data.limit);
    } finally {
      setNacita(false);
    }
  }

  async function presun(slotId: string, m: Misto, souhlas = false) {
    if (m.poTerminu && !souhlas) {
      setPotvrdit({ slotId, misto: m });
      return;
    }
    setPotvrdit(null);
    setNacita(true);
    setChyba(null);
    try {
      const res = await fetch('/api/moje-terminy/prebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId, studioId: m.studioId, start: m.start, end: m.end, souhlasPosun: souhlas }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || 'Přesun se nepodařil.');
        return;
      }
      setOtevreny(null);
      setInfo(
        data.cekaNaPotvrzeni
          ? 'Žádost o přesun jsme dostali. Termín platí původní, dokud přesun nepotvrdíme - dáme vám vědět.'
          : 'Hotovo, termín je přesunutý.',
      );
      router.refresh();
    } finally {
      setNacita(false);
    }
  }

  async function zrusZadost(slotId: string) {
    await fetch(`/api/moje-terminy/prebook?slotId=${encodeURIComponent(slotId)}`, { method: 'DELETE' });
    router.refresh();
  }

  if (terminy.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Moje natáčení</h2>
      {info && <p className="text-sm font-body text-ink bg-okTint border border-line rounded-lg px-3 py-2 m-0">{info}</p>}
      {terminy.map((t) => {
        const otevreno = otevreny === t.id;
        const podleDnu = new Map<string, Misto[]>();
        for (const m of mista ?? []) {
          const k = new Intl.DateTimeFormat('en-CA', { timeZone: t.timezone }).format(new Date(m.start));
          if (!podleDnu.has(k)) podleDnu.set(k, []);
          podleDnu.get(k)!.push(m);
        }
        return (
          <div key={t.id} className="bg-surface rounded-card border border-line shadow-sm">
            <div className="p-4 sm:p-5 flex items-center justify-between gap-4 flex-wrap">
              <span>
                <span className="block font-heading font-semibold text-ink capitalize">
                  {den(t.start, t.timezone)} · <span className="tabular-nums">{cas(t.start, t.timezone)}–{cas(t.end, t.timezone)}</span>
                </span>
                <span className="block text-sm font-body text-muted mt-0.5">
                  {t.projekt} · {t.mesto}
                </span>
                {t.zadost && (
                  <span className="block text-xs font-body text-status-progress mt-1">
                    Čeká na potvrzení přesunu na {den(t.zadost.start, t.timezone)} {cas(t.zadost.start, t.timezone)}–
                    {cas(t.zadost.end, t.timezone)}.{' '}
                    <button type="button" onClick={() => zrusZadost(t.id)} className="underline">
                      Zrušit žádost
                    </button>
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => otevri(t.id)}
                className={`rounded-lg border px-4 py-2 text-sm font-heading font-semibold transition-colors ${
                  otevreno ? 'border-line text-muted' : 'border-brand-purple text-brand-purple hover:bg-tint'
                }`}
              >
                {otevreno ? 'Zavřít' : 'Přebookovat'}
              </button>
            </div>

            {otevreno && (
              <div className="border-t border-line p-4 sm:p-5 flex flex-col gap-3">
                <p className="text-sm font-body text-ink m-0">
                  Vyberte nový termín. Volné jsou jen časy, kdy máme místo ve studiu.
                  {limit ? ` Termíny po ${datum(limit)} posouvají odevzdání a musíme je potvrdit.` : ''}
                </p>
                {nacita && !mista && <p className="text-sm text-muted m-0">Hledám volné termíny…</p>}
                {chyba && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{chyba}</p>}
                {mista && mista.length === 0 && <p className="text-sm text-muted m-0">Teď není volný žádný jiný termín.</p>}
                <div className="flex flex-col gap-2 max-h-[26rem] overflow-y-auto pr-1">
                  {Array.from(podleDnu.entries()).map(([k, dne]) => (
                    <div key={k} className="flex items-baseline gap-3 flex-wrap">
                      <span className="w-40 shrink-0 text-xs font-heading font-semibold text-ink capitalize">
                        {den(dne[0].start, t.timezone)}
                      </span>
                      <span className="flex flex-wrap gap-2">
                        {dne.map((m) => (
                          <button
                            key={`${m.studioId}-${m.start}`}
                            type="button"
                            disabled={nacita}
                            onClick={() => presun(t.id, m)}
                            title={m.poTerminu ? 'Po termínu odevzdání - musíme potvrdit' : 'Přesunout sem'}
                            className={`rounded-pill border px-3 py-1 text-sm font-heading font-semibold tabular-nums transition-colors disabled:opacity-50 ${
                              m.poTerminu
                                ? 'border-dashed border-status-progress text-status-progress hover:bg-warnTint'
                                : 'border-line text-ink hover:border-brand-purple hover:bg-tint'
                            }`}
                          >
                            {cas(m.start, t.timezone)}–{cas(m.end, t.timezone)}
                            {m.poTerminu ? ' ⚠' : ''}
                          </button>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* HLÁŠKA O POSUNU ODEVZDÁNÍ (zadání 19. 9. 2026) */}
      {potvrdit && (
        <div
          className="fixed inset-0 z-[60] bg-black/55 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPotvrdit(null);
          }}
        >
          <div className="w-full max-w-md bg-surface rounded-card border-2 border-status-progress p-5 flex flex-col gap-3 shadow-lg">
            <p className="font-heading font-semibold text-ink m-0 text-lg">Tenhle termín musíme potvrdit</p>
            <p className="text-sm font-body text-ink m-0">
              Nový termín je až po {limit ? datum(limit) : 'termínu odevzdání'} - posune se nám tím termín odevzdání
              knihy. Přesun proto musí potvrdit produkce. Do té doby platí váš původní termín.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => presun(potvrdit.slotId, potvrdit.misto, true)}
                className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-brand-purpleDeep"
              >
                Požádat o přesun
              </button>
              <button type="button" onClick={() => setPotvrdit(null)} className="text-sm font-heading text-muted">
                Vybrat jiný termín
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
