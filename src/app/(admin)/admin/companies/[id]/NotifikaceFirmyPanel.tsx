'use client';

import { useEffect, useState } from 'react';
import type { KomuNotifikace } from '@prisma/client';
import {
  CO_SE_POSILA,
  INTERNI_PRIJEMCI,
  KOMU_MOZNOSTI,
  KOMU_POPISKY,
  STAVY_S_NOTIFIKACI,
  jeToEmail,
  predvolbaJakoAudioteka,
  predvolbaJakoJota,
  prazdneNastaveni,
  type NastaveniNotifikaci,
} from '@/lib/notifikaceFirmy';

/**
 * Záložka Notifikace na kartě firmy (zadání 10. 9. 2026: "u firem ta záložka
 * Notifikace, kde bude moci nastavit individuálně, v jaké fázi projektu půjde
 * zpráva na klienta").
 *
 * U každého stavu se vybírá jedno ze tří: neposílat, klientovi, jen nám
 * interně. Výchozí stav je NEPOSÍLAT — zprávu klientovi nemá zapnout portál
 * sám za nás.
 *
 * Dvě předvolby (jako Audioteka / jako Jota) jsou jen zkratka k vyplnění;
 * uloží se až tlačítkem, aby se dalo ještě něco doladit.
 *
 * Druhá část je seznam interních příjemců (zadání 10. 9. 2026: "chtěl bych
 * u přidávání notifikací mít ještě i možnosti, na koho to půjde interně od
 * nás") — každého klienta má u nás na starosti někdo jiný.
 */
type Ucet = { email: string; jmeno: string };

export function NotifikaceFirmyPanel({ companyId }: { companyId: string }) {
  const [nastaveni, setNastaveni] = useState<NastaveniNotifikaci>(prazdneNastaveni());
  const [prijemci, setPrijemci] = useState<string[]>([]);
  const [nabidka, setNabidka] = useState<Ucet[]>([]);
  const [novaAdresa, setNovaAdresa] = useState('');
  const [nacita, setNacita] = useState(true);
  const [uklada, setUklada] = useState(false);
  const [ulozeno, setUlozeno] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/companies/${companyId}/notifikace`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.nastaveni) setNastaveni(d.nastaveni);
        if (Array.isArray(d?.interniPrijemci)) setPrijemci(d.interniPrijemci);
        if (Array.isArray(d?.nabidkaUctu)) setNabidka(d.nabidkaUctu);
      })
      .catch(() => undefined)
      .finally(() => setNacita(false));
  }, [companyId]);

  function nastav(stav: string, komu: KomuNotifikace) {
    setNastaveni((n) => ({ ...n, [stav]: komu }));
    setUlozeno(false);
  }

  function prepniPrijemce(email: string) {
    const adresa = email.trim().toLowerCase();
    setPrijemci((p) => (p.includes(adresa) ? p.filter((e) => e !== adresa) : [...p, adresa]));
    setUlozeno(false);
    setChyba(null);
  }

  /** Adresa mimo portál - třeba společná schránka, která účet nemá. */
  function pridejAdresu() {
    const adresa = novaAdresa.trim().toLowerCase();
    if (!adresa) return;
    if (!jeToEmail(adresa)) {
      setChyba(`"${adresa}" nevypadá jako e-mail.`);
      return;
    }
    if (!prijemci.includes(adresa)) setPrijemci((p) => [...p, adresa]);
    setNovaAdresa('');
    setUlozeno(false);
    setChyba(null);
  }

  async function uloz() {
    setUklada(true);
    setChyba(null);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/notifikace`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nastaveni, interniPrijemci: prijemci }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setChyba(data?.error || 'Uložení se nezdařilo.');
        return;
      }
      setUlozeno(true);
    } catch {
      setChyba('Uložení se nezdařilo.');
    } finally {
      setUklada(false);
    }
  }

  if (nacita) {
    return <p className="text-sm font-body text-muted m-0">Načítám nastavení…</p>;
  }

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-6 flex flex-col gap-5">
      <p className="text-sm font-body text-muted m-0">
        Kdykoliv projekt téhle firmy přejde do některého ze stavů níž, portál o tom může dát vědět.
        Zpráva jde <strong className="text-ink">klientovi projektu</strong> — tedy člověku, který je
        u projektu vyplněný v poli Klient — a nese v sobě tlačítko s odkazem na složku na Disku.
      </p>

      <div className="flex flex-col gap-3">
        {STAVY_S_NOTIFIKACI.map((stav) => (
          <div
            key={stav}
            className="flex items-start justify-between gap-4 flex-wrap border-b border-line pb-3 last:border-0 last:pb-0"
          >
            <div className="flex-1 min-w-[240px]">
              <p className="font-heading font-semibold text-sm text-ink m-0">{stav}</p>
              <p className="text-xs font-body text-muted m-0 mt-0.5">{CO_SE_POSILA[stav]}</p>
            </div>
            <span className="inline-flex rounded-lg border border-line overflow-hidden shrink-0">
              {KOMU_MOZNOSTI.map((komu) => (
                <button
                  key={komu}
                  type="button"
                  onClick={() => nastav(stav, komu)}
                  aria-pressed={nastaveni[stav] === komu}
                  className={`font-heading font-semibold text-xs px-3 py-2 transition-colors border-l border-line first:border-l-0 ${
                    nastaveni[stav] === komu
                      ? komu === 'KLIENT'
                        ? 'bg-brand-purple text-white'
                        : komu === 'INTERNE'
                          ? 'bg-brand-green text-onAccent'
                          : 'bg-field text-ink'
                      : 'bg-surface text-muted hover:text-ink'
                  }`}
                >
                  {KOMU_POPISKY[komu]}
                </button>
              ))}
            </span>
          </div>
        ))}
      </div>

      {/* Komu z nas to chodi (zadani 10. 9. 2026). Plati pro obe varianty:
          u "Jen nam interne" jsou to jedini prijemci, u "Klientovi" chodi
          zprava temto lidem v kopii - at je videt, co klientovi odeslo. */}
      <div className="border-t border-line pt-5 flex flex-col gap-3">
        <div>
          <h3 className="font-heading font-semibold text-sm text-ink m-0">Komu z nás to chodí</h3>
          <p className="text-xs font-body text-muted m-0 mt-1">
            U volby „Jen nám interně" jsou to jediní příjemci. U volby „Klientovi" jim zpráva chodí
            v kopii, ať je vidět, co klientovi odešlo.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {nabidka.map((u) => {
            const zvoleny = prijemci.includes(u.email.toLowerCase());
            return (
              <button
                key={u.email}
                type="button"
                onClick={() => prepniPrijemce(u.email)}
                aria-pressed={zvoleny}
                title={u.email}
                className={`font-heading font-semibold text-xs rounded-pill px-3 py-1.5 border transition-colors ${
                  zvoleny
                    ? 'bg-brand-purple text-white border-brand-purple'
                    : 'bg-surface text-muted border-line hover:text-ink'
                }`}
              >
                {zvoleny ? '✓ ' : '+ '}
                {u.jmeno}
              </button>
            );
          })}
        </div>

        {/* Adresy, ktere v portalu ucet nemaji - napr. spolecna schranka. */}
        {prijemci.filter((e) => !nabidka.some((u) => u.email.toLowerCase() === e)).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {prijemci
              .filter((e) => !nabidka.some((u) => u.email.toLowerCase() === e))
              .map((e) => (
                <span
                  key={e}
                  className="inline-flex items-center gap-2 font-heading font-semibold text-xs rounded-pill px-3 py-1.5 bg-field text-ink border border-line"
                >
                  {e}
                  <button
                    type="button"
                    onClick={() => prepniPrijemce(e)}
                    aria-label={`Odebrat ${e}`}
                    className="text-muted hover:text-danger"
                  >
                    ✕
                  </button>
                </span>
              ))}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="email"
            value={novaAdresa}
            onChange={(e) => setNovaAdresa(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                pridejAdresu();
              }
            }}
            placeholder="Další adresa, třeba fakturace@mediaspace.cz"
            className="flex-1 min-w-[240px] rounded-lg border border-line bg-field px-3 py-2 text-sm font-heading text-ink outline-none focus:border-brand-purple"
          />
          <button
            type="button"
            onClick={pridejAdresu}
            className="font-heading font-semibold text-sm text-brand-purple hover:underline px-2 py-2"
          >
            Přidat
          </button>
        </div>

        {prijemci.length === 0 && (
          <p className="text-xs font-body text-muted m-0">
            Nikdo vybraný — zprávy proto půjdou na {INTERNI_PRIJEMCI.join(' a ')}.
          </p>
        )}
      </div>

      {chyba && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{chyba}</p>}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => void uloz()}
          disabled={uklada}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          {uklada ? 'Ukládám…' : 'Uložit nastavení'}
        </button>
        {ulozeno && <span className="text-status-done text-sm font-heading">✓ Uloženo</span>}

        <span className="flex items-center gap-3 ml-auto">
          <span className="text-xs font-body text-muted">Předvyplnit:</span>
          <button
            type="button"
            onClick={() => {
              setNastaveni(predvolbaJakoAudioteka());
              setUlozeno(false);
            }}
            className="text-xs font-heading font-semibold text-brand-purple hover:underline"
          >
            jako Audioteka
          </button>
          <button
            type="button"
            onClick={() => {
              setNastaveni(predvolbaJakoJota());
              setUlozeno(false);
            }}
            className="text-xs font-heading font-semibold text-brand-purple hover:underline"
          >
            jako Jota
          </button>
        </span>
      </div>
    </div>
  );
}
