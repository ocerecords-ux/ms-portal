'use client';

import { TlacitkoSmazat } from '@/components/TlacitkoSmazat';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { VyberPole } from '@/components/VyberPole';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';

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

const STAVY: Record<string, { klic: string; trida: string }> = {
  AUTO: { klic: 'banka.stavAuto', trida: 'text-brand-green' },
  RUCNE: { klic: 'banka.stavRucne', trida: 'text-brand-green' },
  NAVRH: { klic: 'banka.stavNavrh', trida: 'text-status-progress' },
  NOVA: { klic: 'banka.stavNova', trida: 'text-muted' },
  IGNOROVANA: { klic: 'banka.stavIgnorovana', trida: 'text-muted' },
};

/**
 * Věta o nenastavené bance je JEDEN klíč (pravidlo 7 v docs/preklad-portalu.md);
 * značky {kod1} a {kod2} se při vykreslení promění v <code> s názvy proměnných.
 */
function sKody(veta: string, kody: Record<string, string>) {
  return veta.split(/(\{kod\d\})/).map((cast, i) => {
    const znacka = cast.match(/^\{(kod\d)\}$/);
    return znacka ? <code key={i}>{kody[znacka[1]]}</code> : <span key={i}>{cast}</span>;
  });
}

export function BankaKlient({
  otevrenaVsem,
  nastaveno,
  napojeni,
  pohyby,
  faktury,
}: {
  /** Sekci zatím vidí všichni Žůžo-labůžo, protože příznak nemá nikdo. */
  otevrenaVsem: boolean;
  nastaveno: boolean;
  napojeni: NapojeniRadek[];
  pohyby: PohybRadek[];
  faktury: FakturaVolba[];
}) {
  const t = usePreklad();
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
            ? t('banka.napojenoStazeno', { nove: data?.nove ?? 0, sparovano: data?.sparovano ?? 0 })
            : t('banka.napojenoBezStazeni'),
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
        setChyba(data?.error || t('banka.napojeniSelhalo'));
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
        setChyba(data?.error || t('banka.stazeniSelhalo'));
        return;
      }
      const chyby: string[] = data?.chyby ?? [];
      setHlaska(
        t('banka.stazenoHlaska', {
          nove: data?.nove ?? 0,
          sparovano: data?.sparovano ?? 0,
          navrhy: data?.navrhy ?? 0,
        }),
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
        setChyba(data?.error || t('banka.ulozeniSelhalo'));
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
      {otevrenaVsem && (
        <div className="rounded-card border border-status-progress bg-status-progress/10 px-4 py-3 text-sm font-body text-ink">
          <p className="m-0 font-semibold">{t('banka.vidiKazdyNadpis')}</p>
          <p className="m-0 mt-1 text-muted">{t('banka.vidiKazdyPopis')}</p>
        </div>
      )}

      {!nastaveno && (
        <div className="rounded-card border border-line bg-tint px-4 py-3 text-sm font-body text-ink">
          <p className="m-0 font-semibold">{t('banka.nenastavenoNadpis')}</p>
          <p className="m-0 mt-1 text-muted">
            {sKody(t('banka.nenastavenoPopis'), {
              kod1: 'GOCARDLESS_SECRET_ID',
              kod2: 'GOCARDLESS_SECRET_KEY',
            })}
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
          <h2 className="font-display text-xl text-ink m-0">{t('banka.napojeneUcty')}</h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={stahni} disabled={!nastaveno || busy !== null} className={vedlejsi}>
              {busy === 'sync' ? t('banka.stahuju') : t('banka.stahnoutPohyby')}
            </button>
            <button type="button" onClick={napoj} disabled={!nastaveno || busy !== null} className={hlavni}>
              {busy === 'napojeni' ? t('banka.pripravuju') : t('banka.napojitUcet')}
            </button>
          </div>
        </div>

        {napojeni.length === 0 ? (
          <p className="text-sm font-body text-muted m-0">{t('banka.zadnyUcet')}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {napojeni.map((n) => (
              <div key={n.id} className="rounded-card border border-line bg-field/60 px-4 py-3 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="font-heading font-semibold text-ink">
                    {n.nazev}
                    {n.firma ? ` · ${n.firma}` : ''}
                  </span>
                  {/* Odpojením se ztratí i souhlas v bance - znovu se napojuje
                      přes přihlášení do Air Banky, tak ať to není na jedno
                      kliknutí (18. 9. 2026). */}
                  <TlacitkoSmazat
                    onSmazat={() => odpoj(n.id)}
                    disabled={busy !== null}
                    popisek={t('banka.odpojit')}
                    otazka={t('banka.opravduOdpojit')}
                    trida="text-xs"
                  />
                </div>
                <p className="text-xs font-body text-muted m-0">
                  {n.iban ? `${n.iban} · ` : ''}
                  {n.stav === 'AKTIVNI' && t('banka.souhlasPlatiDo', { datum: n.souhlasDo })}
                  {n.stav === 'CEKA' && t('banka.souhlasCeka')}
                  {n.stav === 'VYPRSELO' && t('banka.souhlasVyprsel')}
                  {n.posledni ? ` · ${t('banka.naposledyStazeno', { kdy: n.posledni })}` : ''}
                </p>
                {typeof n.souhlasDnu === 'number' && n.souhlasDnu <= 14 && n.stav === 'AKTIVNI' && (
                  <p className="text-xs font-body text-status-progress m-0">
                    {t('banka.souhlasKonci', { dnu: Math.max(0, n.souhlasDnu) })}
                  </p>
                )}
                {n.chyba && (
                  <p className="text-xs font-body text-status-danger m-0">
                    {t('banka.posledniStazeni', { chyba: n.chyba })}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-card border border-line bg-surface p-5 flex flex-col gap-4">
        <h2 className="font-display text-xl text-ink m-0">{t('banka.cekaNaTebe')}</h2>
        {cekajici.length === 0 ? (
          <p className="text-sm font-body text-muted m-0">{t('banka.nicNevisi')}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {cekajici.map((p) => (
              <div key={p.id} className="rounded-card border border-line bg-field/60 px-4 py-3 flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <span className="font-heading font-semibold text-ink">
                    {p.castka} · {p.protistrana || t('banka.bezNazvu')}
                  </span>
                  <span className="text-xs font-body text-muted">
                    {p.datum}
                    {p.vs ? ` · ${t('banka.vs', { vs: p.vs })}` : ''}
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
                    <option value="">{t('banka.vyberteFakturu')}</option>
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
                    {t('banka.oznacitUhrazenou')}
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => rozhodni(p.id, 'ignorovat')}
                    className={vedlejsi}
                  >
                    {t('banka.neniKFakture')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-card border border-line bg-surface p-5 flex flex-col gap-3">
        <h2 className="font-display text-xl text-ink m-0">{t('banka.posledniPohyby')}</h2>
        {zbytek.length === 0 ? (
          <p className="text-sm font-body text-muted m-0">{t('banka.nicStazeno')}</p>
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
                      {p.fakturaPopis
                        ? t('banka.fakturaPopis', { popis: p.fakturaPopis })
                        : p.zprava || (p.vs ? t('banka.vs', { vs: p.vs }) : '')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-heading ${stav.trida}`}>{t(stav.klic)}</span>
                    {(p.stav === 'AUTO' || p.stav === 'RUCNE') && (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => rozhodni(p.id, 'odparovat')}
                        className="text-xs font-heading text-muted hover:text-status-danger"
                      >
                        {t('banka.odparovat')}
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
