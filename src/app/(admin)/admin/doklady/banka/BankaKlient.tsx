'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { VyberPole } from '@/components/VyberPole';

/**
 * Obrazovka Banka (zadání 17. 9. 2026: „potřebuju, ať se ta banka páruje
 * sama"). Napojení účtu, stažení pohybů a doklepnutí toho, co portál nechtěl
 * rozhodnout sám.
 */

export type NapojeniRadek = {
  id: string;
  nazev: string;
  firma: string | null;
  iban: string | null;
  stav: string;
  souhlasDo: string;
  souhlasDnu: number | null;
  posledni: string | null;
  chyba: string | null;
};

export type PohybRadek = {
  id: string;
  datum: string;
  castka: string;
  prichozi: boolean;
  vs: string | null;
  protistrana: string | null;
  zprava: string | null;
  stav: string;
  duvod: string | null;
  fakturaId: string | null;
  fakturaPopis: string | null;
  navrhInvoiceId: string | null;
  navrhPopis: string | null;
};

export type FakturaVolba = { id: string; popis: string; variableSymbol: string };

const tlacitko =
  'font-heading font-semibold text-sm rounded-lg px-4 py-2 transition-colors disabled:opacity-60';
const hlavni = `${tlacitko} bg-brand-purple text-white hover:bg-brand-purpleDeep`;
const vedlejsi = `${tlacitko} border border-line text-ink hover:bg-field`;

const STAVY: Record<string, { text: string; trida: string }> = {
  AUTO: { text: 'Spárováno samo', trida: 'text-brand-green' },
  RUCNE: { text: 'Spárováno ručně', trida: 'text-brand-green' },
  NAVRH: { text: 'Návrh ke schválení', trida: 'text-status-progress' },
  NOVA: { text: 'Nespárováno', trida: 'text-muted' },
  IGNOROVANA: { text: 'Odloženo', trida: 'text-muted' },
};

export function BankaKlient({
  nastaveno,
  napojeni,
  pohyby,
  faktury,
}: {
  nastaveno: boolean;
  napojeni: NapojeniRadek[];
  pohyby: PohybRadek[];
  faktury: FakturaVolba[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState<string | null>(null);
  const [hlaska, setHlaska] = useState<string | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const [vyber, setVyber] = useState<Record<string, string>>({});

  // Návrat z banky: portál si doťukne, jestli je souhlas potvrzený, a rovnou
  // stáhne první pohyby - ať člověk nemusí klikat podruhé.
  useEffect(() => {
    if (params?.get('hotovo') !== '1') return;
    let platne = true;
    (async () => {
      setBusy('navrat');
      try {
        await fetch('/api/admin/banka/dokoncit', { method: 'POST' });
        const res = await fetch('/api/admin/banka/sync', { method: 'POST' });
        const data = await res.json().catch(() => null);
        if (!platne) return;
        setHlaska(
          res.ok
            ? `Účet je napojený. Staženo ${data?.nove ?? 0} pohybů, spárováno ${data?.sparovano ?? 0}.`
            : 'Účet je napojený, stažení pohybů ale zatím neproběhlo.',
        );
      } finally {
        if (platne) {
          setBusy(null);
          router.replace('/admin/doklady/banka');
          router.refresh();
        }
      }
    })();
    return () => {
      platne = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  async function napoj() {
    setBusy('napojeni');
    setChyba(null);
    try {
      const res = await fetch('/api/admin/banka/napojeni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Air Bank' }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.link) {
        setChyba(data?.error || 'Napojení se nepodařilo.');
        return;
      }
      // Odsud se jde do internetového bankovnictví; zpátky to pustí samo.
      window.location.href = data.link;
    } finally {
      setBusy(null);
    }
  }

  async function stahni() {
    setBusy('sync');
    setChyba(null);
    setHlaska(null);
    try {
      const res = await fetch('/api/admin/banka/sync', { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setChyba(data?.error || 'Stažení se nepodařilo.');
        return;
      }
      const chyby: string[] = data?.chyby ?? [];
      setHlaska(
        `Staženo ${data?.nove ?? 0} nových pohybů, spárováno ${data?.sparovano ?? 0}, ke schválení ${data?.navrhy ?? 0}.`,
      );
      if (chyby.length > 0) setChyba(chyby.join(' '));
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function rozhodni(id: string, akce: 'sparovat' | 'ignorovat' | 'odparovat', invoiceId?: string | null) {
    setBusy(id);
    setChyba(null);
    try {
      const res = await fetch(`/api/admin/banka/pohyb/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ akce, invoiceId: invoiceId ?? null }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setChyba(data?.error || 'Nepodařilo se to uložit.');
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function odpoj(id: string) {
    setBusy(id);
    try {
      await fetch(`/api/admin/banka/napojeni?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const cekajici = pohyby.filter((p) => p.stav === 'NAVRH' || (p.stav === 'NOVA' && p.prichozi));
  const zbytek = pohyby.filter((p) => !cekajici.includes(p));

  return (
    <div className="flex flex-col gap-6">
      {!nastaveno && (
        <div className="rounded-card border border-line bg-tint px-4 py-3 text-sm font-body text-ink">
          <p className="m-0 font-semibold">Napojení na banku ještě není nastavené.</p>
          <p className="m-0 mt-1 text-muted">
            Portál chodí do banky přes GoCardless Bank Account Data. Stačí si tam založit účet (je to zdarma),
            vytvořit klíče a přidat je na Vercelu jako <code>GOCARDLESS_SECRET_ID</code> a{' '}
            <code>GOCARDLESS_SECRET_KEY</code>. Pak se sem vrať a účet napoj.
          </p>
        </div>
      )}

      {hlaska && (
        <p className="rounded-card border border-line bg-field px-4 py-3 text-sm font-body text-ink m-0">{hlaska}</p>
      )}
      {chyba && (
        <p className="rounded-card border border-status-danger bg-status-danger/10 px-4 py-3 text-sm font-body text-status-danger m-0">
          {chyba}
        </p>
      )}

      <section className="rounded-card border border-line bg-surface p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-display text-xl text-ink m-0">Napojené účty</h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={stahni} disabled={!nastaveno || busy !== null} className={vedlejsi}>
              {busy === 'sync' ? 'Stahuju…' : 'Stáhnout pohyby'}
            </button>
            <button type="button" onClick={napoj} disabled={!nastaveno || busy !== null} className={hlavni}>
              {busy === 'napojeni' ? 'Připravuju…' : 'Napojit účet'}
            </button>
          </div>
        </div>

        {napojeni.length === 0 ? (
          <p className="text-sm font-body text-muted m-0">
            Zatím tu žádný účet není. „Napojit účet" tě pošle do Air Banky, kde přihlášením potvrdíš souhlas —
            portál pak pohyby stahuje sám třikrát denně.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {napojeni.map((n) => (
              <div key={n.id} className="rounded-card border border-line bg-field/60 px-4 py-3 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="font-heading font-semibold text-ink">
                    {n.nazev}
                    {n.firma ? ` · ${n.firma}` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => odpoj(n.id)}
                    disabled={busy !== null}
                    className="text-xs font-heading text-muted hover:text-status-danger"
                  >
                    Odpojit
                  </button>
                </div>
                <p className="text-xs font-body text-muted m-0">
                  {n.iban ? `${n.iban} · ` : ''}
                  {n.stav === 'AKTIVNI' && `souhlas platí do ${n.souhlasDo}`}
                  {n.stav === 'CEKA' && 'souhlas ještě není potvrzený v bance'}
                  {n.stav === 'VYPRSELO' && 'souhlas vypršel — napoj účet znovu'}
                  {n.posledni ? ` · naposledy staženo ${n.posledni}` : ''}
                </p>
                {typeof n.souhlasDnu === 'number' && n.souhlasDnu <= 14 && n.stav === 'AKTIVNI' && (
                  <p className="text-xs font-body text-status-progress m-0">
                    Souhlas končí za {Math.max(0, n.souhlasDnu)} dnů. Klikni na „Napojit účet" a potvrď ho v bance
                    znovu, jinak se pohyby přestanou stahovat.
                  </p>
                )}
                {n.chyba && <p className="text-xs font-body text-status-danger m-0">Poslední stažení: {n.chyba}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-card border border-line bg-surface p-5 flex flex-col gap-4">
        <h2 className="font-display text-xl text-ink m-0">Čeká na tebe</h2>
        {cekajici.length === 0 ? (
          <p className="text-sm font-body text-muted m-0">Nic nevisí — všechno, co přišlo, portál rozhodl sám.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {cekajici.map((p) => (
              <div key={p.id} className="rounded-card border border-line bg-field/60 px-4 py-3 flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <span className="font-heading font-semibold text-ink">
                    {p.castka} · {p.protistrana || 'bez názvu'}
                  </span>
                  <span className="text-xs font-body text-muted">
                    {p.datum}
                    {p.vs ? ` · VS ${p.vs}` : ''}
                  </span>
                </div>
                {p.zprava && <p className="text-xs font-body text-muted m-0">{p.zprava}</p>}
                {p.duvod && <p className="text-xs font-body text-status-progress m-0">{p.duvod}</p>}
                <div className="flex items-center gap-2 flex-wrap">
                  <VyberPole
                    value={vyber[p.id] ?? p.navrhInvoiceId ?? ''}
                    onChange={(e) => setVyber((s) => ({ ...s, [p.id]: e.target.value }))}
                    className="flex-1 min-w-[240px] rounded-lg border border-line bg-surface px-3 py-2 text-sm font-body text-ink"
                  >
                    <option value="">— vyberte fakturu —</option>
                    {faktury.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.popis}
                      </option>
                    ))}
                  </VyberPole>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => rozhodni(p.id, 'sparovat', vyber[p.id] ?? p.navrhInvoiceId)}
                    className={hlavni}
                  >
                    Označit uhrazenou
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => rozhodni(p.id, 'ignorovat')}
                    className={vedlejsi}
                  >
                    Není k faktuře
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-card border border-line bg-surface p-5 flex flex-col gap-3">
        <h2 className="font-display text-xl text-ink m-0">Poslední pohyby</h2>
        {zbytek.length === 0 ? (
          <p className="text-sm font-body text-muted m-0">Zatím nic staženého.</p>
        ) : (
          <div className="divide-y divide-line">
            {zbytek.map((p) => {
              const stav = STAVY[p.stav] ?? STAVY.NOVA;
              return (
                <div key={p.id} className="py-2.5 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex flex-col">
                    <span className="text-sm font-body text-ink">
                      {p.datum} · {p.castka} · {p.protistrana || '—'}
                    </span>
                    <span className="text-xs font-body text-muted">
                      {p.fakturaPopis ? `Faktura ${p.fakturaPopis}` : p.zprava || (p.vs ? `VS ${p.vs}` : '')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-heading ${stav.trida}`}>{stav.text}</span>
                    {(p.stav === 'AUTO' || p.stav === 'RUCNE') && (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => rozhodni(p.id, 'odparovat')}
                        className="text-xs font-heading text-muted hover:text-status-danger"
                      >
                        Odpárovat
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
