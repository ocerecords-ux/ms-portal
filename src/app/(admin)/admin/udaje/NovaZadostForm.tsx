'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Nová žádost o údaje (zadání 16. 9. 2026).
 *
 * Dvě cesty, které se schválně nemíchají: buď se doplňuje karta někoho, koho
 * už v portálu máme, nebo se píše někomu úplně novému — tomu stačí jméno
 * a e-mail a záznam vznikne až z toho, co vyplní.
 *
 * Odkaz jde poslat e-mailem i jen zkopírovat (rozhodnuto 16. 9. 2026:
 * „obojí — poslat i zkopírovat"), protože půlka herců stejně odpovídá
 * na WhatsAppu.
 */
export function NovaZadostForm({
  herci,
  firmy,
}: {
  herci: { id: string; name: string | null; email: string }[];
  firmy: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [druh, setDruh] = useState<'HEREC' | 'FIRMA'>('HEREC');
  const [komu, setKomu] = useState<'novy' | 'stavajici'>('novy');
  const [id, setId] = useState('');
  const [jmeno, setJmeno] = useState('');
  const [email, setEmail] = useState('');
  const [poznamka, setPoznamka] = useState('');
  const [bezi, setBezi] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [hotovyOdkaz, setHotovyOdkaz] = useState<string | null>(null);
  const [zprava, setZprava] = useState<string | null>(null);
  const [noveId, setNoveId] = useState<string | null>(null);

  async function vytvor(poslat: boolean) {
    if (bezi) return;
    setBezi(true);
    setChyba(null);
    setZprava(null);
    try {
      const res = await fetch('/api/admin/pozvanky-udaju', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          druh,
          userId: komu === 'stavajici' && druh === 'HEREC' ? id : null,
          companyId: komu === 'stavajici' && druh === 'FIRMA' ? id : null,
          jmeno: komu === 'novy' ? jmeno : null,
          email: email || null,
          poznamka: poznamka || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || 'Žádost se nepodařilo založit.');
        return;
      }
      const odkaz = `${window.location.origin}/udaje/${data.token}`;
      setHotovyOdkaz(odkaz);
      setNoveId(data.id);

      if (poslat) {
        const poslano = await fetch(`/api/admin/pozvanky-udaju/${data.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ akce: 'poslat', ...(email ? { email } : {}) }),
        });
        const vysledek = await poslano.json().catch(() => ({}));
        setZprava(
          poslano.ok
            ? `Odkaz odešel na ${vysledek.komu}.`
            : vysledek?.error || 'Odkaz se nepodařilo poslat — zkopírujte ho prosím.',
        );
      } else {
        setZprava('Odkaz je připravený — zkopírujte ho a pošlete, jak vám vyhovuje.');
      }
      router.refresh();
    } catch {
      setChyba('Žádost se nepodařilo založit.');
    } finally {
      setBezi(false);
    }
  }

  const seznam = druh === 'HEREC' ? herci : firmy;

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-4">
      <h2 className="font-heading font-semibold text-ink m-0">Nová žádost</h2>

      <div className="flex gap-2 flex-wrap">
        {(['HEREC', 'FIRMA'] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => {
              setDruh(d);
              setId('');
            }}
            className={`text-sm font-heading font-semibold rounded-pill border px-4 py-2 transition-colors ${
              druh === d
                ? 'border-brand-purple text-brand-purple bg-accentTint'
                : 'border-line text-muted hover:border-brand-purple'
            }`}
          >
            {d === 'HEREC' ? 'Herec' : 'Firma'}
          </button>
        ))}
      </div>

      <div className="flex gap-4 flex-wrap text-sm font-body text-ink">
        <label className="flex items-center gap-2">
          <input type="radio" checked={komu === 'novy'} onChange={() => setKomu('novy')} className="accent-brand-purple" />
          Ještě ho v portálu nemáme
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={komu === 'stavajici'} onChange={() => setKomu('stavajici')} className="accent-brand-purple" />
          Doplnit někomu, koho máme
        </label>
      </div>

      {komu === 'stavajici' ? (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-heading font-semibold text-ink">
            {druh === 'HEREC' ? 'Herec' : 'Firma'}
          </span>
          <select value={id} onChange={(e) => setId(e.target.value)} className="admin-input">
            <option value="">Vyberte…</option>
            {seznam.map((p: { id: string; name: string | null }) => (
              <option key={p.id} value={p.id}>
                {p.name || '(bez jména)'}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-heading font-semibold text-ink">
            {druh === 'HEREC' ? 'Jméno herce' : 'Název firmy'}
          </span>
          <input value={jmeno} onChange={(e) => setJmeno(e.target.value)} className="admin-input" />
        </label>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-sm font-heading font-semibold text-ink">E-mail (kam poslat odkaz)</span>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          className="admin-input"
          placeholder="Nechte prázdné, když odkaz pošlete sami"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-heading font-semibold text-ink">Vzkaz do e-mailu (nepovinné)</span>
        <input
          value={poznamka}
          onChange={(e) => setPoznamka(e.target.value)}
          className="admin-input"
          placeholder={'Např. „Kvůli smlouvě na Kubánské tango."'}
        />
      </label>

      <div className="flex gap-2 flex-wrap items-center">
        <button
          type="button"
          disabled={bezi}
          onClick={() => void vytvor(true)}
          className="text-sm font-heading font-semibold rounded-pill bg-brand-purple text-white px-5 py-2.5 disabled:opacity-60"
        >
          {bezi ? 'Zakládám…' : 'Vytvořit a poslat e-mailem'}
        </button>
        <button
          type="button"
          disabled={bezi}
          onClick={() => void vytvor(false)}
          className="text-sm font-heading font-semibold rounded-pill border border-line text-ink px-5 py-2.5 hover:border-brand-purple disabled:opacity-60"
        >
          Jen vytvořit odkaz
        </button>
      </div>

      {chyba && <p className="text-sm font-body text-danger m-0">{chyba}</p>}
      {zprava && <p className="text-sm font-body text-muted m-0">{zprava}</p>}

      {hotovyOdkaz && (
        <div className="flex gap-2 items-center flex-wrap border-t border-line pt-3">
          <input readOnly value={hotovyOdkaz} className="admin-input flex-1 min-w-[220px] text-xs" />
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(hotovyOdkaz).then(
                () => setZprava('Odkaz je ve schránce.'),
                () => setZprava('Zkopírujte odkaz ručně.'),
              );
            }}
            className="text-sm font-heading font-semibold rounded-lg border border-line px-3 py-2 hover:border-brand-purple"
          >
            Zkopírovat
          </button>
          {noveId && (
            <a href={`/admin/udaje/${noveId}`} className="text-sm font-heading text-brand-purple no-underline">
              Otevřít žádost
            </a>
          )}
        </div>
      )}
    </div>
  );
}
