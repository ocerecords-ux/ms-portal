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
 * ADRESY SE VKLÁDAJÍ JAKO TEXT. Produkce zkopíruje řádek z mailu („Jan Novák
 * <jan@firma.cz>, petra@agentura.cz") a vloží ho celý; portál si ho rozebere
 * sám. Vypisovat lidi po jednom by u pěti hostů zdržovalo.
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
  const [adresy, setAdresy] = useState('');
  const [online, setOnline] = useState(false);
  const [odkaz, setOdkaz] = useState(nataceni.hovorOdkazVlastni ?? '');

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

  /** Co se z vloženého textu opravdu přidá - vidět je to hned, ne až po odeslání. */
  const nahled = adresy.trim() ? rozeberAdresy(adresy) : null;

  async function pridej() {
    const data = await zavolej(`${zaklad}/hoste`, {
      method: 'POST',
      body: JSON.stringify({ adresy, online }),
    });
    if (!data) return;
    setAdresy('');
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
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-heading text-muted uppercase tracking-wide">
                {t('hoste.pridatNadpis')}
              </span>
              <textarea
                value={adresy}
                rows={2}
                onChange={(e) => setAdresy(e.target.value)}
                placeholder={t('hoste.pridatPrazdne')}
                className="w-full resize-y rounded-card border border-line bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple"
              />
            </label>

            {nahled && (
              <p className="text-[11px] font-body text-muted m-0">
                {t('hoste.nahled', { pocet: nahled.hoste.length })}
                {nahled.spatne.length > 0 && ` · ${t('hoste.nahledSpatne', { zbytek: nahled.spatne.join(', ') })}`}
              </p>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              {/* Osobně / online se volí pro celou vloženou skupinu - u jednotlivce
                  se pak dá přehodit klepnutím na odznak v řádku. */}
              <button
                type="button"
                onClick={() => setOnline((o) => !o)}
                title={t('hoste.prepnoutNapoveda')}
                className={`rounded-pill border px-3 py-1 text-xs font-heading font-semibold transition-colors cursor-pointer ${
                  online
                    ? 'border-brand-purple/50 bg-brand-purple/10 text-brand-purpleDeep dark:text-brand-purpleLight'
                    : 'border-line bg-surface text-muted'
                }`}
              >
                {online ? t('hoste.online') : t('hoste.osobne')}
              </button>
              <button
                type="button"
                onClick={pridej}
                disabled={pracuje || !nahled || nahled.hoste.length === 0}
                className="rounded-pill bg-brand-purple text-white font-heading font-semibold text-xs px-4 py-1.5 border-0 cursor-pointer disabled:opacity-50"
              >
                {t('hoste.pridat')}
              </button>
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-heading text-muted uppercase tracking-wide">
              {t('hoste.odkazNadpis')}
            </span>
            <input
              value={odkaz}
              onChange={(e) => setOdkaz(e.target.value)}
              onBlur={() => {
                if ((odkaz.trim() || null) === (nataceni.hovorOdkazVlastni ?? null)) return;
                zavolej(zaklad, { method: 'PATCH', body: JSON.stringify({ hovorOdkaz: odkaz.trim() || null }) });
              }}
              placeholder={nataceni.hovorOdkaz ?? 'https://meet.google.com/…'}
              className="w-full rounded-card border border-line bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple"
            />
            <span className="text-[11px] font-body text-muted">
              {nataceni.hovorOdkazVlastni ? t('hoste.odkazVlastni') : t('hoste.odkazZeStudia')}
            </span>
          </label>

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
  const ceka = pozvankaJeNaPoslani(host, start);

  return (
    <li className="flex items-center gap-2 flex-wrap rounded-lg border border-line bg-field/40 px-3 py-1.5">
      <span className="font-heading text-sm text-ink">{host.jmeno || host.email}</span>
      {host.jmeno && <span className="text-xs font-body text-muted">{host.email}</span>}
      {!jeEmail(host.email) && (
        <span className="text-[11px] font-heading text-status-error">{t('hoste.spatnaAdresa')}</span>
      )}

      <button
        type="button"
        disabled={!canManage || pracuje}
        onClick={() => onUloz({ online: !host.online })}
        title={t('hoste.prepnoutNapoveda')}
        className={`rounded-pill border px-2 py-0.5 text-[11px] font-heading font-semibold transition-colors ${
          canManage ? 'cursor-pointer' : ''
        } ${
          host.online
            ? 'border-brand-purple/50 bg-brand-purple/10 text-brand-purpleDeep dark:text-brand-purpleLight'
            : 'border-line bg-surface text-muted'
        }`}
      >
        {host.online ? t('hoste.online') : t('hoste.osobne')}
      </button>

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
          onClick={() => (potvrzuji ? onSmaz() : setPotvrzuji(true))}
          onBlur={() => setPotvrzuji(false)}
          className="ml-auto shrink-0 rounded-pill border-0 bg-transparent text-muted text-xs font-heading cursor-pointer hover:text-status-error transition-colors disabled:opacity-50"
        >
          {potvrzuji ? t('hoste.opravduSmazat') : t('hoste.smazat')}
        </button>
      )}
    </li>
  );
}
