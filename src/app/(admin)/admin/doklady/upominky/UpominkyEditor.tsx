'use client';

import { useEffect, useState } from 'react';
import {
  PROMENNE_UPOMINKY,
  VYCHOZI_DNY,
  VYCHOZI_PREDMET,
  VYCHOZI_TEXT,
} from '@/lib/upominkyFaktur';

/**
 * UPOMÍNKY K FAKTURÁM PO SPLATNOSTI (zadání 25. 9. 2026: „potřebuji nastavit
 * upomínky na faktury po splatnosti. Chci je někde editovat, včetně náhledu
 * emailu").
 *
 * Tři věci na jedné stránce: kdy se upomíná, co se v upomínce píše (s náhledem
 * mailu) a co je zrovna po splatnosti - včetně tlačítka poslat hned, když se
 * nechce čekat na ranní úlohu.
 */
type Faktura = {
  id: string;
  cislo: string;
  firma: string;
  komu: string | null;
  castka: string;
  splatnost: string | null;
  dnuPoSplatnosti: number;
  projekt: string | null;
  odeslano: number;
  posledniAt: string | null;
};

type Nastaveni = {
  zapnuto: boolean;
  dny: number[];
  predmet: string;
  text: string;
  kopie: string[];
  upravilJmeno: string | null;
};

const pole =
  'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full';

function den(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric' }).format(new Date(iso));
}

export function UpominkyEditor() {
  const [nastaveni, setNastaveni] = useState<Nastaveni | null>(null);
  const [faktury, setFaktury] = useState<Faktura[]>([]);
  const [dnyText, setDnyText] = useState(VYCHOZI_DNY.join(', '));
  const [kopieText, setKopieText] = useState('');
  const [nahled, setNahled] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [hlaska, setHlaska] = useState<string | null>(null);
  const [posilam, setPosilam] = useState<string | null>(null);

  async function nacti() {
    try {
      const res = await fetch('/api/admin/upominky', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || 'Nastavení se nepodařilo načíst.');
        return;
      }
      setNastaveni(data.nastaveni);
      setFaktury(Array.isArray(data.faktury) ? data.faktury : []);
      setDnyText((data.nastaveni?.dny ?? VYCHOZI_DNY).join(', '));
      setKopieText((data.nastaveni?.kopie ?? []).join(', '));
    } catch {
      setChyba('Nastavení se nepodařilo načíst.');
    }
  }

  useEffect(() => {
    void nacti();
  }, []);

  function zmen<K extends keyof Nastaveni>(klic: K, hodnota: Nastaveni[K]) {
    setNastaveni((n) => (n ? { ...n, [klic]: hodnota } : n));
    setHlaska(null);
  }

  /** „3, 10, 21" → [3, 10, 21]. Co není číslo, se zahodí. */
  function dnyZTextu(): number[] {
    return dnyText
      .split(/[,\s;]+/)
      .map((d) => Number(d.trim()))
      .filter((d) => Number.isFinite(d) && d >= 0);
  }

  async function uloz() {
    if (!nastaveni) return;
    const dny = dnyZTextu();
    if (dny.length === 0) {
      setChyba('Napište aspoň jeden den po splatnosti, kdy se má upomínat.');
      return;
    }
    setBusy(true);
    setChyba(null);
    try {
      const res = await fetch('/api/admin/upominky', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zapnuto: nastaveni.zapnuto,
          dny,
          predmet: nastaveni.predmet,
          text: nastaveni.text,
          kopie: kopieText.split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || 'Uložení se nezdařilo.');
        return;
      }
      setHlaska('Uloženo.');
      void nacti();
    } catch {
      setChyba('Uložení se nezdařilo.');
    } finally {
      setBusy(false);
    }
  }

  async function ukazNahled() {
    if (!nastaveni) return;
    setBusy(true);
    setChyba(null);
    try {
      const res = await fetch('/api/admin/upominky/nahled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predmet: nastaveni.predmet, text: nastaveni.text }),
      });
      if (!res.ok) {
        setChyba('Náhled se nepodařilo připravit.');
        return;
      }
      setNahled(await res.text());
    } catch {
      setChyba('Náhled se nepodařilo připravit.');
    } finally {
      setBusy(false);
    }
  }

  async function posli(id: string) {
    setPosilam(id);
    setChyba(null);
    setHlaska(null);
    try {
      const res = await fetch('/api/admin/upominky/poslat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || 'Upomínku se nepodařilo poslat.');
        return;
      }
      setHlaska(`Upomínka odešla na ${data.komu}.`);
      void nacti();
    } catch {
      setChyba('Upomínku se nepodařilo poslat.');
    } finally {
      setPosilam(null);
    }
  }

  if (!nastaveni) {
    return <p className="text-sm font-body text-muted m-0">{chyba ?? 'Načítám…'}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {chyba && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-4 py-3 m-0">{chyba}</p>}
      {hlaska && <p className="text-sm text-ink bg-tint border border-line rounded-lg px-4 py-3 m-0">{hlaska}</p>}

      <div className="bg-surface rounded-card border border-line shadow-sm p-5 sm:p-6 flex flex-col gap-4">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={nastaveni.zapnuto}
            onChange={(e) => zmen('zapnuto', e.target.checked)}
            className="mt-1 w-4 h-4 accent-brand-purple"
          />
          <span className="text-sm font-body text-ink">
            Posílat upomínky automaticky
            <span className="block text-xs text-muted">
              Úloha běží ve všední dny ráno. Dokud je tohle vypnuté, upomínky odcházejí jen ručně
              tlačítkem u faktury dole.
            </span>
          </span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Kolikátý den po splatnosti</span>
            <input value={dnyText} onChange={(e) => setDnyText(e.target.value)} className={pole} />
            <span className="text-xs text-muted">
              Čárkou oddělené dny — „{VYCHOZI_DNY.join(', ')}" znamená tři upomínky: třetí, desátý
              a jednadvacátý den po splatnosti. Kolik čísel, tolik upomínek; dál se nepřipomíná.
            </span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Skrytá kopie nám</span>
            <input
              value={kopieText}
              onChange={(e) => setKopieText(e.target.value)}
              placeholder="ucetni@mediaspace.cz"
              className={pole}
            />
            <span className="text-xs text-muted">Klient adresy nevidí — chodí ve skryté kopii.</span>
          </label>
        </div>
      </div>

      <div className="bg-surface rounded-card border border-line shadow-sm p-5 sm:p-6 flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="font-display text-xl text-ink m-0">Znění upomínky</h2>
          {nastaveni.upravilJmeno && (
            <span className="text-xs font-body text-muted">naposledy upravil {nastaveni.upravilJmeno}</span>
          )}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Předmět</span>
          <input
            value={nastaveni.predmet}
            onChange={(e) => zmen('predmet', e.target.value)}
            className={pole}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Text</span>
          <textarea
            value={nastaveni.text}
            onChange={(e) => zmen('text', e.target.value)}
            rows={8}
            className="rounded-lg border border-line bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple w-full"
          />
          <span className="text-xs text-muted">
            **tučně** se vysází tučně. Prázdný řádek dělá nový odstavec.
          </span>
        </label>

        <div className="flex flex-wrap gap-2">
          {PROMENNE_UPOMINKY.map((p) => (
            <button
              key={p.klic}
              type="button"
              title={`${p.popis} — např. ${p.ukazka}`}
              onClick={() => zmen('text', `${nastaveni.text}{${p.klic}}`)}
              className="rounded-pill border border-line bg-field px-2.5 py-1 text-xs font-heading text-ink hover:border-brand-purple"
            >
              {'{'}
              {p.klic}
              {'}'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={uloz}
            disabled={busy}
            className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
          >
            {busy ? 'Ukládám…' : 'Uložit'}
          </button>
          <button
            type="button"
            onClick={ukazNahled}
            disabled={busy}
            className="border border-line text-ink font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-field transition-colors disabled:opacity-60"
          >
            Náhled e-mailu
          </button>
          <button
            type="button"
            onClick={() => {
              zmen('predmet', VYCHOZI_PREDMET);
              zmen('text', VYCHOZI_TEXT);
              setDnyText(VYCHOZI_DNY.join(', '));
            }}
            className="text-sm font-heading text-muted hover:text-ink px-1"
          >
            Obnovit výchozí znění
          </button>
        </div>
      </div>

      {/* Náhled e-mailu v okně - stejné HTML, jaké odejde klientovi. */}
      {nahled && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 sm:p-8 overflow-y-auto"
          onClick={() => setNahled(null)}
        >
          <div
            className="bg-paper border border-line rounded-card shadow-2xl w-full max-w-3xl my-auto overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-line">
              <span className="font-heading font-semibold text-sm text-ink">Náhled e-mailu</span>
              <button type="button" onClick={() => setNahled(null)} className="text-muted hover:text-ink text-xl leading-none">
                ×
              </button>
            </div>
            <iframe title="Náhled upomínky" srcDoc={nahled} className="w-full h-[70vh] bg-white" />
          </div>
        </div>
      )}

      <div className="bg-surface rounded-card border border-line shadow-sm p-5 sm:p-6 flex flex-col gap-3">
        <h2 className="font-display text-xl text-ink m-0">
          Po splatnosti <span className="text-muted text-base">({faktury.length})</span>
        </h2>
        {faktury.length === 0 && (
          <p className="text-sm font-body text-muted m-0">Žádná odeslaná faktura není po splatnosti. 👌</p>
        )}
        {faktury.map((f) => (
          <div
            key={f.id}
            className="flex items-center gap-3 flex-wrap border-t border-line pt-3 first:border-t-0 first:pt-0"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-heading text-sm text-ink">
                {f.cislo} · {f.firma}
                {f.projekt ? <span className="text-muted"> · {f.projekt}</span> : null}
              </span>
              <span className="block text-xs font-body text-muted">
                {f.castka} · splatnost {f.splatnost ?? '—'} ·{' '}
                <span className="text-danger font-heading">{f.dnuPoSplatnosti} dní po splatnosti</span>
                {f.odeslano > 0 && ` · upomínek odesláno ${f.odeslano}${f.posledniAt ? ` (naposledy ${den(f.posledniAt)})` : ''}`}
                {!f.komu && ' · není komu poslat'}
              </span>
            </span>
            <button
              type="button"
              onClick={() => posli(f.id)}
              disabled={!f.komu || posilam === f.id}
              title={f.komu ? `Poslat na ${f.komu}` : 'Firma nemá kontaktní e-mail a projekt klienta'}
              className="shrink-0 border border-line text-ink font-heading font-semibold text-sm rounded-lg px-3 py-1.5 hover:bg-field transition-colors disabled:opacity-40"
            >
              {posilam === f.id ? 'Posílám…' : 'Poslat upomínku'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
