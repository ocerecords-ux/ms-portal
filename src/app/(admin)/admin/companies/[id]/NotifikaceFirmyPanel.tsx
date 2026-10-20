'use client';

import { useEffect, useState } from 'react';
import type { KomuNotifikace } from '@prisma/client';
import {
  CO_SE_POSILA,
  INTERNI_PRIJEMCI,
  KOMU_MOZNOSTI,
  STAVY_S_NOTIFIKACI,
  nazevKomu,
  jeToEmail,
  predvolbaJakoAudioteka,
  predvolbaJakoJota,
  prazdneNastaveni,
  prazdniPrijemciStavu,
  type NastaveniNotifikaci,
  type PrijemciStavu,
} from '@/lib/notifikaceFirmy';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';
import { prelozitKolem } from '@/lib/jazyk';
import { vyjmenuj } from '@/lib/dotoceni';

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
  const t = usePreklad();
  const jazyk = useJazyk();
  // Veta s tucnym kusem uprostred - pravidlo 7: jeden klic, rozdeli se az tady.
  const [pred, za] = prelozitKolem(jazyk, 'firma.notifikaceUvod', 'komu');
  const [nastaveni, setNastaveni] = useState<NastaveniNotifikaci>(prazdneNastaveni());
  const [prijemci, setPrijemci] = useState<string[]>([]);
  // Komu z nás u jednotlivých stavů (12. 10. 2026). Prázdné = jako u firmy.
  const [prijemciStavu, setPrijemciStavu] = useState<PrijemciStavu>(prazdniPrijemciStavu());
  /**
   * KOMU U KLIENTA (zadání 20. 10. 2026: „a pak ještě zvlášť na stav
   * dokončeno - ke schválení"). Prázdné = klientovi vedenému u projektu.
   *
   * Na rozdíl od našich lidí se tu nevybírá ze seznamu účtů - lidé u klienta
   * účet v portálu nemají, takže se adresy píšou ručně.
   */
  const [klientiStavu, setKlientiStavu] = useState<PrijemciStavu>(prazdniPrijemciStavu());
  // Který řádek má rozbalený výběr lidí - rozbalené všechny naráz by byla zeď.
  const [otevreny, setOtevreny] = useState<string | null>(null);
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
        if (d?.prijemciStavu) setPrijemciStavu({ ...prazdniPrijemciStavu(), ...d.prijemciStavu });
        if (d?.klientiStavu) setKlientiStavu({ ...prazdniPrijemciStavu(), ...d.klientiStavu });
        if (Array.isArray(d?.nabidkaUctu)) setNabidka(d.nabidkaUctu);
      })
      .catch(() => undefined)
      .finally(() => setNacita(false));
  }, [companyId]);

  function nastav(stav: string, komu: KomuNotifikace) {
    setNastaveni((n) => ({ ...n, [stav]: komu }));
    setUlozeno(false);
  }

  /** Přehodí člověka u JEDNOHO stavu. Prázdný seznam = jako u celé firmy. */
  function prepniPrijemceStavu(stav: string, email: string) {
    const adresa = email.trim().toLowerCase();
    setPrijemciStavu((p) => {
      const ted = p[stav] ?? [];
      return {
        ...p,
        [stav]: ted.includes(adresa) ? ted.filter((e) => e !== adresa) : [...ted, adresa],
      };
    });
    setUlozeno(false);
    setChyba(null);
  }

  /** Zpět na „jako u celé firmy" - stačí seznam vyprázdnit. */
  function vratNaFiremni(stav: string) {
    setPrijemciStavu((p) => ({ ...p, [stav]: [] }));
    setUlozeno(false);
  }

  function prepniPrijemce(email: string) {
    const adresa = email.trim().toLowerCase();
    setPrijemci((p) => (p.includes(adresa) ? p.filter((e) => e !== adresa) : [...p, adresa]));
    setUlozeno(false);
    setChyba(null);
  }

  /** Adresy u klienta - řádek na každou, ať se nemusí rozdělovat čárkami. */
  function zmenKlienta(stav: string, i: number, hodnota: string) {
    setKlientiStavu((k) => ({
      ...k,
      [stav]: (k[stav] ?? []).map((x, j) => (j === i ? hodnota : x)),
    }));
    setUlozeno(false);
  }

  function pridejKlienta(stav: string) {
    setKlientiStavu((k) => ({ ...k, [stav]: [...(k[stav] ?? []), ''] }));
    setUlozeno(false);
  }

  function odeberKlienta(stav: string, i: number) {
    setKlientiStavu((k) => ({ ...k, [stav]: (k[stav] ?? []).filter((_, j) => j !== i) }));
    setUlozeno(false);
  }

  /** Adresa mimo portál - třeba společná schránka, která účet nemá. */
  function pridejAdresu() {
    const adresa = novaAdresa.trim().toLowerCase();
    if (!adresa) return;
    if (!jeToEmail(adresa)) {
      setChyba(t('firma.neniEmail', { adresa }));
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
        body: JSON.stringify({
          nastaveni,
          interniPrijemci: prijemci,
          prijemciStavu,
          klientiStavu: Object.fromEntries(
            Object.entries(klientiStavu).map(([stav, adresy]) => [
              stav,
              (adresy as string[]).map((e) => e.trim()).filter(Boolean),
            ]),
          ),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setChyba(data?.error || t('firma.ulozeniNezdarilo'));
        return;
      }
      setUlozeno(true);
    } catch {
      setChyba(t('firma.ulozeniNezdarilo'));
    } finally {
      setUklada(false);
    }
  }

  if (nacita) {
    return <p className="text-sm font-body text-muted m-0">{t('firma.notifikaceNacitam')}</p>;
  }

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-6 flex flex-col gap-5">
      <p className="text-sm font-body text-muted m-0">
        {pred}
        <strong className="text-ink">{t('firma.notifikaceKlientProjektu')}</strong>
        {za}
      </p>

      <div className="flex flex-col gap-3">
        {STAVY_S_NOTIFIKACI.map((stav) => (
          <div
            key={stav}
            className="border-b border-line pb-3 last:border-0 last:pb-0"
          >
          <div className="flex items-start justify-between gap-4 flex-wrap">
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
                  {nazevKomu(komu, jazyk)}
                </button>
              ))}
            </span>
          </div>

          {/* KOMU Z NÁS U TOHOHLE STAVU (zadání 12. 10. 2026). Skládá se jen
              tam, kde se vůbec něco posílá - u „Neposílat" by to byl řádek
              o ničem. Zavřený řádek rovnou říká, komu to teď chodí. */}
          {nastaveni[stav] !== 'NIKAM' && (() => {
            const vlastni = prijemciStavu[stav] ?? [];
            /**
             * TŘI PATRA, STEJNĚ JAKO NA SERVERU (20. 10. 2026: „nechápu, proč
             * to tady šlo na Helču a Karolínu, když nejsou u toho nastavené").
             *
             * Do teď tu svítilo „nikdo", když nebyl vyplněný ani seznam
             * u stavu, ani u firmy - jenže server v tu chvíli posílá výchozí
             * dvojici (viz interniPrijemciFirmy). Řádek tedy tvrdil něco
             * jiného, než se dělo, a kopie v mailu přišla jako překvapení.
             */
            const vychozi = vlastni.length === 0 && prijemci.length === 0;
            const platne = vlastni.length > 0 ? vlastni : vychozi ? INTERNI_PRIJEMCI : prijemci;
            const jmenem = (adresa: string) =>
              nabidka.find((u) => u.email.toLowerCase() === adresa)?.jmeno ?? adresa;
            return (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setOtevreny((o) => (o === stav ? null : stav))}
                  className="text-xs font-body text-muted hover:text-ink text-left"
                >
                  {otevreny === stav ? '▾ ' : '▸ '}
                  {t('firma.komuZNasStav')}:{' '}
                  <span className="text-ink">
                    {platne.length > 0 ? vyjmenuj(platne.map(jmenem)) : t('firma.komuZNasNikdo')}
                  </span>
                  {vlastni.length === 0 &&
                    (vychozi
                      ? ` · ${jazyk === 'en' ? 'default pair' : 'výchozí dvojice'}`
                      : ` · ${t('firma.komuZNasJakoFirma')}`)}
                  {/**
                    * KOMU U KLIENTA JE VIDĚT ROVNOU V ZAVŘENÉM ŘÁDKU
                    * (20. 10. 2026). Bez toho nikdo netuší, že se adresy
                    * u klienta nastavují právě tady - otevírátko mluví
                    * o „nás" a nastavení klienta je za ním schované.
                    */}
                  {nastaveni[stav] === 'KLIENT' && (
                    <>
                      {' · '}
                      <span className="text-ink">
                        {jazyk === 'en' ? 'client: ' : 'klient: '}
                        {(klientiStavu[stav] ?? []).filter((e) => e.trim()).length > 0
                          ? vyjmenuj((klientiStavu[stav] ?? []).filter((e) => e.trim()))
                          : jazyk === 'en'
                            ? 'as on the project'
                            : 'podle projektu'}
                      </span>
                    </>
                  )}
                </button>

                {otevreny === stav && (
                  <div className="mt-2 flex flex-col gap-2 bg-field rounded-lg p-3">
                    {/**
                      * KOMU U KLIENTA (20. 10. 2026). Jen u stavů, které
                      * klientovi vůbec chodí. Popisky jsou psané rovnou tady,
                      * ne přes slovník: `lib/jazyk.ts` má rozepsaný jiný úkol
                      * a dvě ruce v jednom souboru končí přepsanou prací.
                      */}
                    {nastaveni[stav] === 'KLIENT' && (
                      <div className="flex flex-col gap-2 border-b border-line pb-3">
                        <p className="text-xs font-body text-muted m-0">
                          {jazyk === 'en'
                            ? 'Client-side e-mails for this status. Filled in = the message goes here instead of the client on the project.'
                            : 'Adresy u klienta pro tenhle stav. Vyplněné = zpráva jde sem místo klientovi vedenému u projektu.'}
                        </p>
                        {(klientiStavu[stav] ?? []).map((mail, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <input
                              type="email"
                              value={mail}
                              placeholder="schvalovani@klient.cz"
                              onChange={(e) => zmenKlienta(stav, i, e.target.value)}
                              className="admin-input flex-1"
                            />
                            <button
                              type="button"
                              onClick={() => odeberKlienta(stav, i)}
                              title={t('obecne.odebrat')}
                              aria-label={t('obecne.odebrat')}
                              className="shrink-0 w-9 h-9 rounded-lg border border-line text-muted hover:text-danger hover:border-danger transition-colors cursor-pointer"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => pridejKlienta(stav)}
                          className="self-start text-xs font-heading text-brand-purple hover:underline"
                        >
                          + {jazyk === 'en' ? 'Add an address' : 'Přidat adresu'}
                        </button>
                      </div>
                    )}
                    <p className="text-xs font-body text-muted m-0">{t('firma.komuZNasStavPopis')}</p>
                    <div className="flex flex-wrap gap-2">
                      {nabidka.map((u) => {
                        const zvoleny = vlastni.includes(u.email.toLowerCase());
                        return (
                          <button
                            key={u.email}
                            type="button"
                            onClick={() => prepniPrijemceStavu(stav, u.email)}
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
                    {vlastni.length > 0 && (
                      <button
                        type="button"
                        onClick={() => vratNaFiremni(stav)}
                        className="self-start text-xs font-heading text-brand-purple hover:underline"
                      >
                        {t('firma.komuZNasZpetNaFiremni')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
          </div>
        ))}
      </div>

      {/* Komu z nas to chodi (zadani 10. 9. 2026). Plati pro obe varianty:
          u "Jen nam interne" jsou to jedini prijemci, u "Klientovi" chodi
          zprava temto lidem v kopii - at je videt, co klientovi odeslo. */}
      <div className="border-t border-line pt-5 flex flex-col gap-3">
        <div>
          <h3 className="font-heading font-semibold text-sm text-ink m-0">{t('firma.komuZNas')}</h3>
          <p className="text-xs font-body text-muted m-0 mt-1">{t('firma.komuZNasPopis')}</p>
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
                    aria-label={t('firma.odebratAdresu', { email: e })}
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
            placeholder={t('firma.dalsiAdresa')}
            className="flex-1 min-w-[240px] rounded-lg border border-line bg-field px-3 py-2 text-sm font-heading text-ink outline-none focus:border-brand-purple"
          />
          <button
            type="button"
            onClick={pridejAdresu}
            className="font-heading font-semibold text-sm text-brand-purple hover:underline px-2 py-2"
          >
            {t('firma.pridat')}
          </button>
        </div>

        {prijemci.length === 0 && (
          <p className="text-xs font-body text-muted m-0">
            {t('firma.nikdoVybrany', { kdo: vyjmenuj([...INTERNI_PRIJEMCI], jazyk) })}
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
          {uklada ? t('obecne.ukladam') : t('firma.ulozitNastaveni')}
        </button>
        {ulozeno && <span className="text-status-done text-sm font-heading">{t('firma.ulozeno')}</span>}

        <span className="flex items-center gap-3 ml-auto">
          <span className="text-xs font-body text-muted">{t('firma.predvyplnit')}</span>
          <button
            type="button"
            onClick={() => {
              setNastaveni(predvolbaJakoAudioteka());
              setUlozeno(false);
            }}
            className="text-xs font-heading font-semibold text-brand-purple hover:underline"
          >
            {t('firma.jakoAudioteka')}
          </button>
          <button
            type="button"
            onClick={() => {
              setNastaveni(predvolbaJakoJota());
              setUlozeno(false);
            }}
            className="text-xs font-heading font-semibold text-brand-purple hover:underline"
          >
            {t('firma.jakoJota')}
          </button>
        </span>
      </div>
    </div>
  );
}
