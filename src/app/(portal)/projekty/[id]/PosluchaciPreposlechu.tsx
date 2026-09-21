'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * KDO POSLOUCHÁ (zadání 21. 9. 2026: „aby vyskočilo po kliknutí na odkaz
 * AudioTaggeru okno, kde se zadá mail, kvůli identifikaci. Primárně asi mail,
 * na který se to pošle + když chci někomu delegovat přeposlech. Ale asi by se
 * to mělo objevit jen na začátku u projektů, které posíláme poprvé. Jakmile se
 * to uloží, tak by to už nevyskakovalo, ale dalo se to někde editovat na
 * panelu").
 *
 * - OKNO vyskočí klientovi z odkazu jen tehdy, když u projektu ještě nikdo
 *   zapsaný není. E-mail je předvyplněný tím, na který šel odkaz.
 * - TLAČÍTKO „Posluchači" v hlavičce AudioTaggeru otevře seznam: přidat
 *   (= předat přeposlech, odejde mu odkaz), odebrat, vypnout zprávy o nových
 *   stopách, a u klienta „Tohle jsem já". Vidí ho klient i my.
 *
 * Kdo se představil, tím jménem se podepisují jeho poznámky a zápisy
 * v historii („aby tam byl záznam o tom, kdo co udělal").
 */

type Posluchac = {
  id: string;
  email: string;
  jmeno: string | null;
  notifikace: boolean;
  pridal: string | null;
};

type Odpoved = {
  lide?: Posluchac[];
  ja?: string | null;
  vychoziEmail?: string | null;
  interni?: boolean;
  error?: string;
};

const pole =
  'rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple w-full';

export function PosluchaciPreposlechu({
  zaklad,
  sKlicem,
  jenPoslech,
  onZmena,
}: {
  /** /api/projekty/<id>/preposlech */
  zaklad: string;
  sKlicem: (url: string) => string;
  /** Klient z odkazu - jen jemu vyskakuje okno a nabízí se „Tohle jsem já". */
  jenPoslech: boolean;
  /** Po změně - ať se obnoví historie. */
  onZmena?: () => void;
}) {
  const [nacteno, setNacteno] = useState(false);
  const [lide, setLide] = useState<Posluchac[]>([]);
  const [ja, setJa] = useState<string | null>(null);
  const [vychoziEmail, setVychoziEmail] = useState('');
  const [okno, setOkno] = useState(false);
  const [panel, setPanel] = useState(false);

  const adresa = sKlicem(`${zaklad}/posluchaci`);

  const prevezmi = useCallback((d: Odpoved) => {
    if (d.lide) setLide(d.lide);
    if (d.ja !== undefined) setJa(d.ja ?? null);
  }, []);

  useEffect(() => {
    let zruseno = false;
    fetch(adresa)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Odpoved | null) => {
        if (zruseno || !d) return;
        prevezmi(d);
        setVychoziEmail(d.vychoziEmail ?? '');
        setNacteno(true);
        // Jen poprve - kdyz u projektu jeste nikdo zapsany neni.
        if (jenPoslech && !d.interni && (d.lide?.length ?? 0) === 0) setOkno(true);
      })
      .catch(() => {});
    return () => {
      zruseno = true;
    };
  }, [adresa, jenPoslech, prevezmi]);

  async function volej(metoda: 'POST' | 'PATCH' | 'DELETE', telo?: unknown, dotaz = ''): Promise<string | null> {
    try {
      const res = await fetch(`${adresa}${dotaz ? `${adresa.includes('?') ? '&' : '?'}${dotaz}` : ''}`, {
        method: metoda,
        headers: telo ? { 'Content-Type': 'application/json' } : undefined,
        body: telo ? JSON.stringify(telo) : undefined,
      });
      const d: Odpoved = await res.json().catch(() => ({}));
      if (!res.ok) return d.error || 'Nepodařilo se uložit.';
      prevezmi(d);
      onZmena?.();
      return null;
    } catch {
      return 'Nepodařilo se uložit.';
    }
  }

  const jaZaznam = lide.find((l) => l.id === ja) ?? null;

  return (
    <>
      <span className="relative">
        <button
          type="button"
          onClick={() => setPanel((v) => !v)}
          title="Kdo přeposlech poslouchá a komu chodí zprávy o nových stopách"
          className="font-heading font-semibold text-[11px] rounded-lg border border-white/40 px-2.5 py-1 hover:border-white transition-colors"
        >
          👤 {jaZaznam ? jaZaznam.jmeno || jaZaznam.email : 'Posluchači'}
          {lide.length > 0 && <span className="text-white/70"> · {lide.length}</span>}
        </button>
        {panel && nacteno && (
          <SeznamPosluchacu
            lide={lide}
            ja={ja}
            jenPoslech={jenPoslech}
            volej={volej}
            onZavrit={() => setPanel(false)}
          />
        )}
      </span>
      {okno && (
        <OknoPredstaveni
          vychoziEmail={vychoziEmail}
          volej={volej}
          onHotovo={() => setOkno(false)}
        />
      )}
    </>
  );
}

type Volej = (metoda: 'POST' | 'PATCH' | 'DELETE', telo?: unknown, dotaz?: string) => Promise<string | null>;

/** Okno při prvním otevření odkazu. */
function OknoPredstaveni({
  vychoziEmail,
  volej,
  onHotovo,
}: {
  vychoziEmail: string;
  volej: Volej;
  onHotovo: () => void;
}) {
  const [email, setEmail] = useState(vychoziEmail);
  const [jmeno, setJmeno] = useState('');
  const [dalsi, setDalsi] = useState<{ email: string; jmeno: string }[]>([]);
  const [bezi, setBezi] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  async function uloz() {
    if (!email.trim() || bezi) return;
    setBezi(true);
    setChyba(null);
    const chybaUlozeni = await volej('POST', {
      lide: [
        { email: email.trim(), jmeno: jmeno.trim() || null },
        ...dalsi.filter((d) => d.email.trim()).map((d) => ({ email: d.email.trim(), jmeno: d.jmeno.trim() || null })),
      ],
      ja: email.trim(),
    });
    setBezi(false);
    if (chybaUlozeni) setChyba(chybaUlozeni);
    else onHotovo();
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 grid place-items-center p-4" role="dialog" aria-modal="true">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void uloz();
        }}
        className="bg-surface text-ink rounded-card border border-line shadow-xl w-full max-w-[460px] p-6 flex flex-col gap-4"
      >
        <div>
          <h2 className="font-heading font-semibold text-lg m-0">Kdo bude poslouchat?</h2>
          <p className="text-sm font-body text-muted m-0 mt-1">
            Zadejte svůj e-mail. Podepíšou se jím vaše poznámky a dáme vám vědět, až k přeposlechu přibudou nové stopy.
          </p>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body">E-mail</span>
          <input
            autoFocus
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jmeno@firma.cz"
            className={pole}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body">
            Jméno <span className="text-muted">· nepovinné</span>
          </span>
          <input value={jmeno} onChange={(e) => setJmeno(e.target.value)} placeholder="Jana Nováková" className={pole} />
        </label>

        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <span className="text-sm font-body">
            Předat přeposlech někomu dalšímu <span className="text-muted">· nepovinné, pošleme mu odkaz</span>
          </span>
          {dalsi.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="email"
                value={d.email}
                onChange={(e) => setDalsi((c) => c.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))}
                placeholder="kolega@firma.cz"
                className={pole}
              />
              <input
                value={d.jmeno}
                onChange={(e) => setDalsi((c) => c.map((x, j) => (j === i ? { ...x, jmeno: e.target.value } : x)))}
                placeholder="Jméno"
                className={`${pole} max-w-[140px]`}
              />
              <button
                type="button"
                onClick={() => setDalsi((c) => c.filter((_, j) => j !== i))}
                aria-label="Odebrat"
                className="text-muted hover:text-danger px-1"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setDalsi((c) => [...c, { email: '', jmeno: '' }])}
            className="self-start text-sm font-heading font-semibold text-brand-purple hover:underline"
          >
            + Přidat e-mail
          </button>
        </div>

        {chyba && <p className="text-sm text-danger m-0">{chyba}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={bezi || !email.trim()}
            className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep disabled:opacity-60"
          >
            {bezi ? 'Ukládám…' : 'Pokračovat k nahrávce'}
          </button>
          <button type="button" onClick={onHotovo} className="text-sm font-heading text-muted hover:text-ink">
            Teď ne
          </button>
        </div>
      </form>
    </div>
  );
}

/** Seznam posluchačů pod tlačítkem v hlavičce - přidat, odebrat, zprávy. */
function SeznamPosluchacu({
  lide,
  ja,
  jenPoslech,
  volej,
  onZavrit,
}: {
  lide: Posluchac[];
  ja: string | null;
  jenPoslech: boolean;
  volej: Volej;
  onZavrit: () => void;
}) {
  const [email, setEmail] = useState('');
  const [jmeno, setJmeno] = useState('');
  const [bezi, setBezi] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [mazany, setMazany] = useState<string | null>(null);

  async function akce(fn: () => Promise<string | null>) {
    setBezi(true);
    setChyba(null);
    const c = await fn();
    setBezi(false);
    if (c) setChyba(c);
    return !c;
  }

  return (
    <div className="absolute right-0 top-full mt-2 z-[70] w-[360px] max-w-[90vw] bg-surface text-ink rounded-card border border-line shadow-xl p-4 flex flex-col gap-3 text-left">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading font-semibold text-sm m-0">Posluchači</h3>
          <p className="text-xs font-body text-muted m-0 mt-0.5">
            Komu chodí zpráva, když přibudou nové stopy. Přidáním přeposlech předáte - pošleme odkaz.
          </p>
        </div>
        <button type="button" onClick={onZavrit} aria-label="Zavřít" className="text-muted hover:text-ink text-lg leading-none">
          ×
        </button>
      </div>

      {lide.length === 0 ? (
        <p className="text-sm font-body text-muted m-0">Zatím nikdo.</p>
      ) : (
        <ul className="list-none m-0 p-0 flex flex-col divide-y divide-line">
          {lide.map((l) => (
            <li key={l.id} className="py-2 flex items-center gap-2">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-body truncate">
                  {l.jmeno || l.email}
                  {l.id === ja && <span className="text-brand-purple font-heading font-semibold"> · já</span>}
                </span>
                {l.jmeno && <span className="block text-[11px] font-body text-muted truncate">{l.email}</span>}
                {l.pridal && <span className="block text-[11px] font-body text-muted truncate">přidal(a) {l.pridal}</span>}
              </span>
              {jenPoslech && l.id !== ja && (
                <button
                  type="button"
                  disabled={bezi}
                  onClick={() => void akce(() => volej('PATCH', { id: l.id, ja: true }))}
                  className="text-[11px] font-heading font-semibold text-brand-purple hover:underline whitespace-nowrap"
                >
                  To jsem já
                </button>
              )}
              <button
                type="button"
                disabled={bezi}
                onClick={() => void akce(() => volej('PATCH', { id: l.id, notifikace: !l.notifikace }))}
                title={l.notifikace ? 'Chodí zprávy o nových stopách - klepnutím vypnete' : 'Zprávy o nových stopách vypnuté'}
                className={`text-sm px-1 ${l.notifikace ? '' : 'opacity-40 grayscale'}`}
              >
                🔔
              </button>
              <button
                type="button"
                disabled={bezi}
                onClick={() =>
                  mazany === l.id
                    ? void akce(() => volej('DELETE', undefined, `id=${encodeURIComponent(l.id)}`)).then(() => setMazany(null))
                    : setMazany(l.id)
                }
                className="text-[11px] font-heading font-semibold text-danger hover:underline whitespace-nowrap"
              >
                {mazany === l.id ? 'Opravdu?' : 'Odebrat'}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!email.trim()) return;
          void akce(() =>
            volej('POST', {
              lide: [{ email: email.trim(), jmeno: jmeno.trim() || null }],
              // Klient bez predstaveni, ktery se pridava sam - bere se jako on.
              ja: jenPoslech && !ja && lide.length === 0 ? email.trim() : null,
            }),
          ).then((ok) => {
            if (ok) {
              setEmail('');
              setJmeno('');
            }
          });
        }}
        className="flex flex-col gap-2 border-t border-line pt-3"
      >
        <span className="text-xs font-heading font-semibold text-muted uppercase tracking-wide">Přidat / předat přeposlech</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e-mail" className={pole} />
        <input value={jmeno} onChange={(e) => setJmeno(e.target.value)} placeholder="jméno (nepovinné)" className={pole} />
        {chyba && <span className="text-xs text-danger">{chyba}</span>}
        <button
          type="submit"
          disabled={bezi || !email.trim()}
          className="self-start bg-brand-purple text-white font-heading font-semibold text-xs rounded-lg px-3 py-2 disabled:opacity-50"
        >
          Přidat a poslat odkaz
        </button>
      </form>
    </div>
  );
}
