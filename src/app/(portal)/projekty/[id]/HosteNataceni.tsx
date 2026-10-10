'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePreklad } from '../../components/JazykProvider';
import {
  jeEmail,
  odkazNaMapu,
  pocetKPoslani,
  pozvankaJeNaPoslani,
  rozeberAdresy,
  type HostData,
  type NataceniData,
} from '@/lib/hosteNataceni';

/**
 * HOSTÉ NA NATÁČENÍ (zadání 30. 9. 2026: „u některých natáčení bývá klient.
 * Buď osobně, nebo se propojuje přes link do daného studia. A potřebuju tam
 * naházet i více lidí - maily, na které jim rovnou odejde pozvánka na
 * natáčení, která bude obsahovat link pro natáčení online a adresu studia
 * s mapkou a infem o parkování").
 *
 * TERMÍNY SE BEROU Z KALENDÁŘE, nezakládají se tady. Natáčení se plánuje
 * v kalendáři studia a druhý seznam termínů u projektu by se s ním dřív nebo
 * později rozešel - hostům by pak chodily časy, které ve studiu neplatí.
 * Proto tahle karta ukazuje, co v kalendáři k projektu opravdu je.
 *
 * STAČÍ E-MAIL, ŘÁDEK NA KAŽDÉHO (9. 10. 2026: „chci tam samostatná pole.
 * takhle můžou vznikat chyby" a „jméno dej pryč, stačí email"). Původně se
 * vkládal jeden text a portál ho rozebíral podle čárek - jméno s čárkou nebo
 * chybějící mezera udělaly z jednoho hosta dva a bylo to vidět až v odeslané
 * pozvánce. Rozebírání zůstalo jen na VLOŽENÍ ZE SCHRÁNKY: kdo zkopíruje celý
 * řádek z mailu, dostane ho rozházený do řádků, kde to vidí a může opravit.
 *
 * „VE STUDIU / ONLINE" SE UŽ NEPTÁ (9. 10. 2026: „největší procento je online,
 * a to si pak může člověk vybrat z toho univerzálního emailu"). Od té doby, co
 * je pozvánka pro oba případy táž, to byl údaj, na který se produkce ptala
 * dopředu a host si ho stejně rozmyslel. Sloupec `online` v databázi zůstává
 * kvůli starším záznamům, noví hosté se zapisují s výchozí hodnotou.
 *
 * POZVÁNKA SE POSÍLÁ RUČNĚ, ne při přidání hosta. Produkce napřed naházi
 * všechny, případně dopíše odkaz na hovor, a teprve pak pošle - jinak by
 * prvnímu odešel mail bez odkazu.
 */

export function HosteNataceni({
  caflouProjectId,
  nataceni: vychozi,
  canManage,
}: {
  caflouProjectId: string;
  nataceni: NataceniData[];
  canManage: boolean;
}) {
  const t = usePreklad();
  const [nataceni, setNataceni] = useState<NataceniData[]>(vychozi);

  if (nataceni.length === 0) {
    return (
      <p className="text-sm font-body text-muted m-0">{t('hoste.zadneNataceni')}</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {nataceni.map((n) => (
        <TerminSHosty
          key={n.id}
          caflouProjectId={caflouProjectId}
          nataceni={n}
          canManage={canManage}
          onZmena={(nove) => setNataceni((s) => s.map((x) => (x.id === nove.id ? nove : x)))}
        />
      ))}
    </div>
  );
}

/** „úterý 7. 10., 10:00–13:00" - v prohlížeči, takže v pásmu toho, kdo se dívá. */
function kdySlovy(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const den = new Intl.DateTimeFormat('cs-CZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
  }).format(s);
  const cas = (d: Date) =>
    new Intl.DateTimeFormat('cs-CZ', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${den}, ${cas(s)}–${cas(e)}`;
}

/** Jeden rozepsaný host ve formuláři, ještě než se uloží. */
type NovyHost = { klic: string; email: string; jazyk: 'cs' | 'en' };

/**
 * Klíč řádku z počítadla, ne z indexu ani z e-mailu: index by při smazání
 * prostředního řádku přehodil Reactu obsah políček a e-mail se během psaní mění.
 */
let pocitadloRadku = 0;
function dalsiKlic(): string {
  pocitadloRadku += 1;
  return `host-${pocitadloRadku}`;
}
/**
 * ČEŠTINA / ANGLIČTINA jedním klepnutím. Dva stavy, ne rozbalovací seznam:
 * jiný jazyk než ty dva portál stejně neumí a v řádku je místo jen na odznak.
 */
function PrepinacJazyka({
  jazyk,
  onZmena,
  vypnuto,
  trida,
}: {
  jazyk: 'cs' | 'en';
  onZmena: (jazyk: 'cs' | 'en') => void;
  vypnuto?: boolean;
  trida: string;
}) {
  const t = usePreklad();
  return (
    <button
      type="button"
      disabled={vypnuto}
      onClick={() => onZmena(jazyk === 'cs' ? 'en' : 'cs')}
      title={t('hoste.jazykNapoveda')}
      className={`shrink-0 rounded-pill border font-heading font-semibold transition-colors ${trida} ${
        vypnuto ? '' : 'cursor-pointer'
      } ${
        jazyk === 'en'
          ? 'border-brand-purple/50 bg-brand-purple/10 text-brand-purpleDeep dark:text-brand-purpleLight'
          : 'border-line bg-surface text-muted'
      }`}
    >
      {jazyk === 'en' ? t('hoste.jazykEn') : t('hoste.jazykCs')}
    </button>
  );
}

function prazdnyHost(): NovyHost {
  return { klic: dalsiKlic(), email: '', jazyk: 'cs' };
}

function TerminSHosty({
  caflouProjectId,
  nataceni,
  canManage,
  onZmena,
}: {
  caflouProjectId: string;
  nataceni: NataceniData;
  canManage: boolean;
  onZmena: (nove: NataceniData) => void;
}) {
  const t = usePreklad();
  const router = useRouter();
  const [pracuje, setPracuje] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [hlaska, setHlaska] = useState<string | null>(null);
  const [novi, setNovi] = useState<NovyHost[]>(() => [prazdnyHost()]);
  const [odkaz, setOdkaz] = useState(nataceni.hovorOdkazVlastni ?? '');
  const [upravujeOdkaz, setUpravujeOdkaz] = useState(false);

  const zaklad = `/api/projects/${encodeURIComponent(caflouProjectId)}/nataceni/${encodeURIComponent(nataceni.id)}`;
  const ceka = pocetKPoslani(nataceni);
  const mapa = odkazNaMapu(nataceni.adresa, nataceni.mapaUrl);

  async function zavolej(url: string, init: RequestInit): Promise<Record<string, unknown> | null> {
    setPracuje(true);
    setChyba(null);
    setHlaska(null);
    try {
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setChyba(String(data.error ?? t('hoste.chyba')));
        return null;
      }
      if (data.nataceni) onZmena(data.nataceni as NataceniData);
      return data;
    } catch {
      setChyba(t('hoste.chyba'));
      return null;
    } finally {
      setPracuje(false);
    }
  }

  /** Řádky, které mají co odeslat - prázdný řádek na konci se tiho ignoruje. */
  const kZapisu = novi.filter((h) => h.email.trim().length > 0);
  const maChybu = kZapisu.some((h) => !jeEmail(h.email));

  function uprav(i: number, zmena: Partial<NovyHost>) {
    setNovi((s) => s.map((h, j) => (j === i ? { ...h, ...zmena } : h)));
  }

  function odeberRadek(i: number) {
    // Poslední řádek se nemazá, jen vyprázdní - jinak by formulář zmizel.
    setNovi((s) => (s.length === 1 ? [prazdnyHost()] : s.filter((_, j) => j !== i)));
  }

  /**
   * VLOŽENÍ VÍC ADRES NAJEDNOU. Produkce pořád kopíruje celý řádek z mailu -
   * místo aby skončil v jednom políčku, rozhodí se do řádků, kde je vidět
   * a dá se opravit. Jedna adresa bez oddělovače se vloží úplně obyčejně.
   */
  function vlozeniDoRadku(i: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text');
    if (!text || !/[,;\n]/.test(text)) return;
    const { hoste: rozebrane } = rozeberAdresy(text);
    if (rozebrane.length === 0) return;
    e.preventDefault();
    setNovi((s) => {
      const kopie = [...s];
      // Jméno z „Jan Novák <jan@firma.cz>“ se zahodí - portál ho nikde nepoužívá.
      const jazyk = s[i]?.jazyk ?? 'cs';
      kopie.splice(i, 1, ...rozebrane.map((h) => ({ klic: dalsiKlic(), email: h.email, jazyk })));
      return kopie;
    });
  }

  /**
   * Prázdné políčko = smazat vlastní odkaz a vrátit se k odkazu studia; to je
   * jediný způsob, jak se vlastní odkaz zruší, takže se tu nesmí „uložení
   * prázdného“ přeskočit jako žádná změna.
   */
  async function ulozOdkaz() {
    const nove = odkaz.trim() || null;
    if (nove !== (nataceni.hovorOdkazVlastni ?? null)) {
      const data = await zavolej(zaklad, { method: 'PATCH', body: JSON.stringify({ hovorOdkaz: nove }) });
      if (!data) return;
    }
    setUpravujeOdkaz(false);
  }

  async function pridej() {
    const data = await zavolej(`${zaklad}/hoste`, {
      method: 'POST',
      body: JSON.stringify({ hoste: kZapisu.map((h) => ({ email: h.email.trim(), jazyk: h.jazyk })) }),
    });
    if (!data) return;
    setNovi([prazdnyHost()]);
    const spatne = (data.spatne as string[]) ?? [];
    setHlaska(
      spatne.length
        ? t('hoste.pridanoSeZbytkem', { pocet: Number(data.pridano ?? 0), zbytek: spatne.join(', ') })
        : t('hoste.pridano', { pocet: Number(data.pridano ?? 0) }),
    );
    router.refresh();
  }

  async function posli(vsem: boolean) {
    const data = await zavolej(`${zaklad}/pozvanky`, {
      method: 'POST',
      body: JSON.stringify({ vsem }),
    });
    if (!data) return;
    const chyby = (data.chyby as { email: string; duvod: string }[]) ?? [];
    setHlaska(t('hoste.odeslano', { pocet: Number(data.odeslano ?? 0) }));
    if (chyby.length) setChyba(chyby.map((c) => `${c.email}: ${c.duvod}`).join(' · '));
    router.refresh();
  }

  return (
    <section className="rounded-card border border-line bg-surface p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: nataceni.studioBarva || '#7B55FF' }}
          aria-hidden
        />
        <span className="font-heading font-semibold text-ink">{kdySlovy(nataceni.start, nataceni.end)}</span>
        <span className="text-sm font-body text-muted">{nataceni.studioNazev}</span>
        {nataceni.hoste.length > 0 && (
          <span className="rounded-pill bg-brand-purple/15 border border-brand-purple/40 text-brand-purpleDeep dark:text-brand-purpleLight px-2 py-0.5 text-[11px] font-heading font-semibold tabular-nums">
            {t('hoste.pocet', { pocet: nataceni.hoste.length })}
          </span>
        )}
        {ceka > 0 && (
          <span
            title={t('hoste.cekaNapoveda')}
            className="rounded-pill bg-warnTint text-status-progress px-2 py-0.5 text-[11px] font-heading font-semibold tabular-nums"
          >
            {t('hoste.ceka', { pocet: ceka })}
          </span>
        )}
      </div>

      {/* Kam se jde a kudy - tady i v mailu tatáž věta, ať se to nerozejde. */}
      <p className="text-sm font-body text-muted m-0">
        {nataceni.adresa?.trim() ? (
          <>
            {nataceni.adresa}
            {mapa && (
              <>
                {' · '}
                <a href={mapa} target="_blank" rel="noopener noreferrer" className="text-brand-purple no-underline hover:underline">
                  {t('hoste.mapa')}
                </a>
              </>
            )}
          </>
        ) : (
          <span title={t('hoste.bezAdresyNapoveda')}>{t('hoste.bezAdresy')}</span>
        )}
      </p>

      {nataceni.hoste.length > 0 && (
        <ul className="list-none p-0 m-0 flex flex-col gap-1.5">
          {nataceni.hoste.map((h) => (
            <RadekHosta
              key={h.id}
              host={h}
              start={nataceni.start}
              canManage={canManage}
              pracuje={pracuje}
              onUloz={(zmena) =>
                zavolej(`${zaklad}/hoste/${encodeURIComponent(h.id)}`, {
                  method: 'PATCH',
                  body: JSON.stringify(zmena),
                })
              }
              onSmaz={() =>
                zavolej(`${zaklad}/hoste/${encodeURIComponent(h.id)}`, { method: 'DELETE' })
              }
            />
          ))}
        </ul>
      )}

      {canManage && (
        <>
          {/* JEN E-MAIL, ŘÁDEK NA KAŽDÉHO (9. 10. 2026: „jméno dej pryč, stačí
              email“). Jeden slepený řádek s čárkami uměl ze jména „Novák, Jan“
              udělat dva hosty a bylo to vidět až v odeslané pozvánce. Jméno už se
              neukládá vůbec - mail oslovuje obecně a nikde se nepoužívalo. Vložení celé schránky se
              nezahazuje - rozhází se do řádků, kde je produkce vidí a může je opravit. */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-heading text-muted uppercase tracking-wide">
              {t('hoste.pridatNadpis')}
            </span>

            {novi.map((h, i) => {
              const spatny = h.email.trim().length > 0 && !jeEmail(h.email);
              return (
                <div key={h.klic} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1 flex flex-col gap-1">
                    <input
                      value={h.email}
                      type="email"
                      inputMode="email"
                      autoComplete="off"
                      onChange={(e) => uprav(i, { email: e.target.value })}
                      onPaste={(e) => vlozeniDoRadku(i, e)}
                      placeholder={t('hoste.email')}
                      aria-label={t('hoste.email')}
                      aria-invalid={spatny || undefined}
                      className={`w-full rounded-card border bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple ${
                        spatny ? 'border-danger' : 'border-line'
                      }`}
                    />
                    {spatny && <span className="text-[11px] font-body text-danger">{t('hoste.spatnyEmail')}</span>}
                  </div>
                  {/* JAZYK POZVÁNKY (10. 10. 2026: „co když budeme mít anglicky
                      mluvící účastníky?“). U každého zvlášť - na jedno natáčení
                      chodí česká i anglická pozvánka. */}
                  <PrepinacJazyka
                    jazyk={h.jazyk}
                    onZmena={(j) => uprav(i, { jazyk: j })}
                    trida="px-3 py-2 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => odeberRadek(i)}
                    title={t('hoste.smazat')}
                    aria-label={t('hoste.smazat')}
                    disabled={novi.length === 1 && !h.email}
                    className="shrink-0 rounded-pill border border-line bg-surface text-muted px-3 py-2 text-xs font-heading cursor-pointer disabled:opacity-40"
                  >
                    ×
                  </button>
                </div>
              );
            })}

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setNovi((s) => [...s, prazdnyHost()])}
                className="rounded-pill border border-line bg-surface text-ink font-heading font-semibold text-xs px-3 py-1.5 cursor-pointer"
              >
                {t('hoste.dalsiHost')}
              </button>
              <button
                type="button"
                onClick={pridej}
                disabled={pracuje || kZapisu.length === 0 || maChybu}
                className="rounded-pill bg-brand-purple text-white font-heading font-semibold text-xs px-4 py-1.5 border-0 cursor-pointer disabled:opacity-50"
              >
                {t('hoste.pridat')}
              </button>
              <span className="text-[11px] font-body text-muted">{t('hoste.vlozeniNapoveda')}</span>
            </div>
          </div>

          {/* ODKAZ NA PŘIPOJENÍ JE VIDĚT, NE SCHOVANÝ V POLÍČKU (9. 10. 2026:
              „ten odkaz na připojení by tam měl normálně nějak svítit. a mít
              u toho tlačítko upravit"). Do teď to bylo prázdné pole s odkazem
              studia jen jako našeptaný placeholder - nedalo se poznat, co
              hostovi opravdu odejde, a klepnutím se to rovnou přepisovalo.
              Teď je odkaz vypsaný a proklikatelný a mění se až po Upravit. */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-heading text-muted uppercase tracking-wide">
              {t('hoste.odkazNadpis')}
            </span>

            {upravujeOdkaz ? (
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  value={odkaz}
                  autoFocus
                  onChange={(e) => setOdkaz(e.target.value)}
                  placeholder="https://meet.google.com/…"
                  className="min-w-0 flex-1 rounded-card border border-line bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple"
                />
                <button
                  type="button"
                  onClick={ulozOdkaz}
                  disabled={pracuje}
                  className="shrink-0 rounded-pill bg-brand-purple text-white font-heading font-semibold text-xs px-4 py-1.5 border-0 cursor-pointer disabled:opacity-50"
                >
                  {t('obecne.ulozit')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOdkaz(nataceni.hovorOdkazVlastni ?? '');
                    setUpravujeOdkaz(false);
                  }}
                  className="shrink-0 rounded-pill border border-line bg-surface text-muted font-heading font-semibold text-xs px-3 py-1.5 cursor-pointer"
                >
                  {t('obecne.zrusit')}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                {nataceni.hovorOdkaz ? (
                  <a
                    href={nataceni.hovorOdkaz}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 break-all font-body text-sm text-brand-purple no-underline hover:underline"
                  >
                    {nataceni.hovorOdkaz}
                  </a>
                ) : (
                  <span className="font-body text-sm text-muted">{t('hoste.odkazChybi')}</span>
                )}
                <button
                  type="button"
                  onClick={() => setUpravujeOdkaz(true)}
                  className="shrink-0 rounded-pill border border-line bg-surface text-ink font-heading font-semibold text-xs px-3 py-1.5 cursor-pointer"
                >
                  {t('obecne.upravit')}
                </button>
              </div>
            )}

            <span className="text-[11px] font-body text-muted">
              {nataceni.hovorOdkazVlastni ? t('hoste.odkazVlastni') : t('hoste.odkazZeStudia')}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => posli(false)}
              disabled={pracuje || ceka === 0}
              title={t('hoste.poslatNapoveda')}
              className="rounded-pill bg-brand-purple text-white font-heading font-semibold text-xs px-4 py-1.5 border-0 cursor-pointer disabled:opacity-50"
            >
              {t('hoste.poslat', { pocet: ceka })}
            </button>
            {nataceni.hoste.length > 0 && (
              <button
                type="button"
                onClick={() => posli(true)}
                disabled={pracuje}
                title={t('hoste.poslatVsemNapoveda')}
                className="rounded-pill border border-line bg-surface text-muted font-heading font-semibold text-xs px-4 py-1.5 cursor-pointer hover:text-brand-purple hover:border-brand-purple transition-colors disabled:opacity-50"
              >
                {t('hoste.poslatVsem')}
              </button>
            )}
          </div>
        </>
      )}

      {hlaska && <p className="text-xs font-body text-muted m-0">{hlaska}</p>}
      {chyba && (
        <p className="text-xs font-body text-status-error m-0" role="alert">
          {chyba}
        </p>
      )}
    </section>
  );
}

function RadekHosta({
  host,
  start,
  canManage,
  pracuje,
  onUloz,
  onSmaz,
}: {
  host: HostData;
  start: string;
  canManage: boolean;
  pracuje: boolean;
  onUloz: (zmena: Record<string, unknown>) => void;
  onSmaz: () => void;
}) {
  const t = usePreklad();
  const [potvrzuji, setPotvrzuji] = useState(false);
  const [upravuje, setUpravuje] = useState(false);
  const [email, setEmail] = useState(host.email);
  const ceka = pozvankaJeNaPoslani(host, start);

  /**
   * ÚPRAVA PŘIDANÉHO HOSTA (10. 10. 2026: „měli by jít upravit, abych mohl
   * třeba změnit mail a jazyk"). Překlep se do teď spravoval jen smazáním
   * a přidáním znovu - a s hostem zmizelo i to, že mu pozvánka už odešla.
   *
   * Jazyk se přehazuje rovnou klepnutím na odznak, adresa až přes Upravit:
   * rozepsaná adresa je půl minuty nerozeznatelná od překlepu, takže se
   * ukládá na potvrzení.
   */
  const zmenena = email.trim() !== host.email.trim();
  const spatny = email.trim().length > 0 && !jeEmail(email);

  function uloz() {
    if (zmenena) onUloz({ email: email.trim() });
    setUpravuje(false);
  }

  if (upravuje) {
    return (
      <li className="flex items-center gap-2 flex-wrap rounded-lg border border-line bg-field/40 px-3 py-1.5">
        <input
          value={email}
          type="email"
          inputMode="email"
          autoFocus
          onChange={(e) => setEmail(e.target.value)}
          aria-label={t('hoste.email')}
          aria-invalid={spatny || undefined}
          className={`min-w-0 flex-1 rounded-card border bg-field px-2 py-1 text-ink font-body text-sm outline-none focus:border-brand-purple ${
            spatny ? 'border-danger' : 'border-line'
          }`}
        />
        <PrepinacJazyka
          jazyk={host.jazyk}
          onZmena={(j) => onUloz({ jazyk: j })}
          vypnuto={pracuje}
          trida="px-2 py-0.5 text-[11px]"
        />
        <button
          type="button"
          onClick={uloz}
          disabled={pracuje || spatny || email.trim().length === 0}
          className="shrink-0 rounded-pill bg-brand-purple text-white font-heading font-semibold text-[11px] px-3 py-1 border-0 cursor-pointer disabled:opacity-50"
        >
          {t('obecne.ulozit')}
        </button>
        <button
          type="button"
          onClick={() => {
            setEmail(host.email);
            setUpravuje(false);
          }}
          className="shrink-0 rounded-pill border border-line bg-surface text-muted font-heading font-semibold text-[11px] px-2 py-1 cursor-pointer"
        >
          {t('obecne.zrusit')}
        </button>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 flex-wrap rounded-lg border border-line bg-field/40 px-3 py-1.5">
      <span className="font-heading text-sm text-ink break-all">{host.email}</span>
      {!jeEmail(host.email) && (
        <span className="text-[11px] font-heading text-status-error">{t('hoste.spatnaAdresa')}</span>
      )}
      <PrepinacJazyka
        jazyk={host.jazyk}
        onZmena={(j) => onUloz({ jazyk: j })}
        vypnuto={!canManage || pracuje}
        trida="px-2 py-0.5 text-[11px]"
      />

      {host.pozvankaAt && !ceka && (
        <span className="text-[11px] font-body text-muted">
          {t('hoste.pozvankaOdeslana', {
            kdy: new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric' }).format(
              new Date(host.pozvankaAt),
            ),
          })}
        </span>
      )}
      {ceka && host.pozvankaAt && (
        <span className="text-[11px] font-heading text-status-progress">{t('hoste.terminSePosunul')}</span>
      )}
      {host.chybaOdeslani && (
        <span className="text-[11px] font-heading text-status-error">{host.chybaOdeslani}</span>
      )}

      {canManage && (
        <button
          type="button"
          disabled={pracuje}
          onClick={() => {
            setEmail(host.email);
            setUpravuje(true);
          }}
          className="ml-auto shrink-0 rounded-pill border-0 bg-transparent text-muted text-xs font-heading cursor-pointer hover:text-ink transition-colors disabled:opacity-50"
        >
          {t('obecne.upravit')}
        </button>
      )}
      {canManage && (
        <button
          type="button"
          disabled={pracuje}
          onClick={() => (potvrzuji ? onSmaz() : setPotvrzuji(true))}
          onBlur={() => setPotvrzuji(false)}
          className="shrink-0 rounded-pill border-0 bg-transparent text-muted text-xs font-heading cursor-pointer hover:text-status-error transition-colors disabled:opacity-50"
        >
          {potvrzuji ? t('hoste.opravduSmazat') : t('hoste.smazat')}
        </button>
      )}
    </li>
  );
}
