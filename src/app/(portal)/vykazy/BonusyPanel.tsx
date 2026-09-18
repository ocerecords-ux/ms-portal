'use client';

import { TlacitkoSmazat } from '@/components/TlacitkoSmazat';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCzk, formatDuration } from '@/lib/timesheets';
import { VyberProjektu } from '@/app/(portal)/components/VyberProjektu';
import { VyberPole } from '@/components/VyberPole';

/**
 * BONUSY ZVUKAŘŮ (zadání 15. 9. 2026: „na tyto bonusy bych udělal zvlášť
 * záložku ve výkazech: Bonusy ke schválení").
 *
 * Žůžo-labůžo tu návrh odklikne nebo zamítne, zvukař tu vidí svoje bonusy
 * a v jakém jsou stavu. Je to tatáž tabulka; liší se jen sloupcem se zvukařem
 * a tlačítky.
 *
 * U každého návrhu stojí, z čeho vyšel - kolik minut střihu udělal on a kolik
 * jich na projektu bylo celkem. Bez toho je „93 %" jen číslo, kterému se dá
 * jen věřit.
 */

export type Bonus = {
  id: string;
  projectId: string;
  projectName: string | null;
  userLabel: string;
  castka: number;
  podilProcent: number;
  minutZvukare: number;
  minutCelkem: number;
  stav: 'NAVRZENO' | 'SCHVALENO' | 'ZAMITNUTO';
  navrzenoAt: string;
  rozhodnutoAt: string | null;
  rozhodlJmeno: string | null;
  /** Vlastní bonus si schválit nesmí ani Žůžo-labůžo. */
  vlastni: boolean;
  /** Přidal ho člověk ručně - podíl na střihu pak nic neznamená. */
  rucne: boolean;
  poznamka: string | null;
};

export type VolbaProjektu = { id: string; label: string };
export type VolbaZvukare = { id: string; label: string };

const STAV_POPISKY: Record<Bonus['stav'], string> = {
  NAVRZENO: 'Čeká na schválení',
  SCHVALENO: 'Schváleno',
  ZAMITNUTO: 'Zamítnuto',
};

const STAV_TRIDY: Record<Bonus['stav'], string> = {
  NAVRZENO: 'bg-warnTint text-status-progress',
  SCHVALENO: 'bg-okTint text-brand-greenDeep',
  ZAMITNUTO: 'bg-dangerTint text-danger',
};

function formatDatum(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('cs-CZ').format(d);
}

export function BonusyPanel({
  bonusy,
  muzeSchvalovat,
  projekty,
  zvukari,
}: {
  bonusy: Bonus[];
  muzeSchvalovat: boolean;
  projekty: VolbaProjektu[];
  zvukari: VolbaZvukare[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  /**
   * Ručně přidaný bonus (zadání 15. 9. 2026). Formulář je schovaný, dokud
   * o něj někdo neřekne - běžně se bonusy jen odklikávají.
   */
  const [otevreno, setOtevreno] = useState(false);
  const [projekt, setProjekt] = useState('');
  const [zvukar, setZvukar] = useState('');
  // Castka jako TEXT, ne cislo: pole s cislem se brani rozepsanemu zapisu
  // a nutilo by mazat predvyplnenou nulu.
  const [castka, setCastka] = useState('');
  const [poznamka, setPoznamka] = useState('');
  const [pridavam, setPridavam] = useState(false);

  async function pridej() {
    const cislo = Number(castka.replace(/\s/g, '').replace(',', '.'));
    if (!projekt || !zvukar || !Number.isFinite(cislo) || cislo <= 0) {
      setChyba('Vyberte projekt, zvukaře a vyplňte částku.');
      return;
    }
    setPridavam(true);
    setChyba(null);
    try {
      const res = await fetch('/api/bonusy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caflouProjectId: projekt,
          userId: zvukar,
          castka: Math.round(cislo),
          poznamka: poznamka.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setChyba(data?.error || 'Bonus se nepodařilo přidat.');
        return;
      }
      setOtevreno(false);
      setProjekt('');
      setZvukar('');
      setCastka('');
      setPoznamka('');
      router.refresh();
    } catch {
      setChyba('Nepodařilo se spojit se serverem.');
    } finally {
      setPridavam(false);
    }
  }
  const cekaji = bonusy.filter((b) => b.stav === 'NAVRZENO');
  const rozhodnute = bonusy.filter((b) => b.stav !== 'NAVRZENO');

  /** „smazat" zahodi navrh uplne; zbytek je rozhodnuti. */
  async function rozhodni(id: string, akce: 'schvalit' | 'zamitnout' | 'zpet' | 'smazat') {
    setBusyId(id);
    setChyba(null);
    try {
      const res =
        akce === 'smazat'
          ? await fetch(`/api/bonusy/${id}`, { method: 'DELETE' })
          : await fetch(`/api/bonusy/${id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ akce }),
            });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba((data as { error?: string })?.error || 'Nepodařilo se to uložit.');
        return;
      }
      router.refresh();
    } catch {
      setChyba('Nepodařilo se spojit se serverem.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm font-body text-muted m-0 max-w-[80ch]">
        {muzeSchvalovat
          ? 'Portál navrhne bonus sám, když projekt poprvé přejde do stavu „Dokončeno - ke schválení" a zvukař na něm udělal aspoň 90 % střihu. Přiznat ho musí člověk — dokud tady nikdo neklepne na Schválit, je to jen návrh.'
          : 'Bonus za audioknihu navrhuje portál sám, když na ní uděláte aspoň 90 % střihu. Přiznává ho Žůžo-labůžo.'}
      </p>

      {muzeSchvalovat && (
        <div className="flex flex-col gap-3">
          <div>
            <button
              type="button"
              onClick={() => {
                setOtevreno((v) => !v);
                setChyba(null);
              }}
              className="border border-line text-ink font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:border-brand-purple transition-colors"
            >
              {otevreno ? 'Zavřít' : 'Přidat bonus ručně'}
            </button>
          </div>

          {otevreno && (
            <div className="bg-surface rounded-card border border-line shadow-sm p-4 flex flex-col gap-3">
              <p className="text-sm font-body text-muted m-0">
                Pro případy, na které portál nedosáhne — kniha navíc, zachráněný termín, práce, která se
                do výkazů nevešla. Přidaný bonus je rovnou schválený; podíl na střihu se dopočítá z výkazů,
                pokud nějaké jsou.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-body text-ink">Projekt</span>
                  <VyberProjektu projekty={projekty} hodnota={projekt} onZmena={setProjekt} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-body text-ink">Zvukař</span>
                  <VyberPole
                    value={zvukar}
                    onChange={(e) => setZvukar(e.target.value)}
                    className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple"
                  >
                    <option value="">— vyberte —</option>
                    {zvukari.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.label}
                      </option>
                    ))}
                  </VyberPole>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-body text-ink">Částka (Kč)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={castka}
                    onChange={(e) => setCastka(e.target.value)}
                    placeholder="např. 1200"
                    className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple tabular-nums"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-body text-ink">Za co (nepovinné)</span>
                  <input
                    type="text"
                    value={poznamka}
                    onChange={(e) => setPoznamka(e.target.value)}
                    placeholder="např. převzal knihu po kolegovi"
                    className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple"
                  />
                </label>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => void pridej()}
                  disabled={pridavam}
                  className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
                >
                  {pridavam ? 'Přidávám…' : 'Přidat bonus'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {chyba && (
        <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{chyba}</p>
      )}

      <Tabulka
        nadpis="Čeká na schválení"
        bonusy={cekaji}
        prazdno="Teď není co schvalovat."
        muzeSchvalovat={muzeSchvalovat}
        busyId={busyId}
        rozhodni={rozhodni}
      />

      {rozhodnute.length > 0 && (
        <Tabulka
          nadpis="Rozhodnuté"
          bonusy={rozhodnute}
          prazdno=""
          muzeSchvalovat={muzeSchvalovat}
          busyId={busyId}
          rozhodni={rozhodni}
        />
      )}
    </div>
  );
}

function Tabulka({
  nadpis,
  bonusy,
  prazdno,
  muzeSchvalovat,
  busyId,
  rozhodni,
}: {
  nadpis: string;
  bonusy: Bonus[];
  prazdno: string;
  muzeSchvalovat: boolean;
  busyId: string | null;
  rozhodni: (id: string, akce: 'schvalit' | 'zamitnout' | 'zpet' | 'smazat') => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">{nadpis}</h2>
      <div className="bg-surface rounded-card border border-line overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="bg-brand-purple text-white font-heading text-xs">
                <th className="text-left px-4 py-3">Projekt</th>
                {muzeSchvalovat && <th className="text-left px-4 py-3">Zvukař</th>}
                <th className="text-left px-4 py-3">Podíl na střihu</th>
                <th className="text-right px-4 py-3">Bonus</th>
                <th className="text-left px-4 py-3">Stav</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {bonusy.length === 0 && (
                <tr>
                  <td colSpan={muzeSchvalovat ? 6 : 5} className="px-4 py-8 text-center text-muted text-sm font-body">
                    {prazdno}
                  </td>
                </tr>
              )}
              {bonusy.map((b) => (
                <tr key={b.id} className="border-t border-line align-top">
                  <td className="px-4 py-3">
                    <span className="block text-sm font-heading text-ink">
                      {b.projectName || `Projekt ${b.projectId}`}
                    </span>
                    <span className="block text-xs font-body text-muted">
                      Navrženo {formatDatum(b.navrzenoAt)}
                    </span>
                    {b.poznamka && (
                      <span className="block text-xs font-body text-muted italic">{b.poznamka}</span>
                    )}
                  </td>
                  {muzeSchvalovat && (
                    <td className="px-4 py-3 text-sm font-heading text-ink">{b.userLabel}</td>
                  )}
                  <td className="px-4 py-3">
                    {b.rucne && b.minutCelkem === 0 ? (
                      <span className="block text-sm font-body text-muted">Přidáno ručně</span>
                    ) : (
                      <>
                        <span className="block text-sm font-heading text-ink tabular-nums">{b.podilProcent} %</span>
                        <span className="block text-xs font-body text-muted tabular-nums">
                          {formatDuration(b.minutZvukare)} z {formatDuration(b.minutCelkem)}
                        </span>
                      </>
                    )}
                    {b.rucne && b.minutCelkem > 0 && (
                      <span className="block text-xs font-body text-muted">Přidáno ručně</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-heading text-ink tabular-nums text-right">
                    {formatCzk(b.castka)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center text-xs font-heading font-semibold px-2.5 py-1 rounded-pill ${STAV_TRIDY[b.stav]}`}
                    >
                      {STAV_POPISKY[b.stav]}
                    </span>
                    {b.rozhodnutoAt && (
                      <span className="block text-xs font-body text-muted mt-1">
                        {formatDatum(b.rozhodnutoAt)}
                        {b.rozhodlJmeno ? ` — ${b.rozhodlJmeno}` : ''}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {muzeSchvalovat && !b.vlastni && b.stav === 'NAVRZENO' && (
                      <span className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => rozhodni(b.id, 'schvalit')}
                          disabled={busyId === b.id}
                          className="bg-brand-green text-onAccent font-heading font-semibold text-xs rounded-lg px-3 py-1.5 hover:brightness-95 disabled:opacity-60"
                        >
                          Schválit
                        </button>
                        <button
                          type="button"
                          onClick={() => rozhodni(b.id, 'zamitnout')}
                          disabled={busyId === b.id}
                          className="text-danger text-xs font-heading disabled:opacity-60"
                        >
                          Zamítnout
                        </button>
                        {/* Smazat = „tenhle navrh sem vubec nepatri".
                            Zamitnuty bonus zustava v historii, smazany ne. */}
                        <TlacitkoSmazat
                          onSmazat={() => rozhodni(b.id, 'smazat')}
                          bezi={busyId === b.id}
                          otazka="Opravdu zahodit návrh?"
                          trida="text-xs"
                        />
                      </span>
                    )}
                    {muzeSchvalovat && b.vlastni && b.stav === 'NAVRZENO' && (
                      <span className="text-xs font-body text-muted">Vlastní bonus schvaluje kolega.</span>
                    )}
                    {muzeSchvalovat && b.stav !== 'NAVRZENO' && (
                      <button
                        type="button"
                        onClick={() => rozhodni(b.id, 'zpet')}
                        disabled={busyId === b.id}
                        className="text-muted text-xs font-heading hover:text-brand-purple disabled:opacity-60"
                      >
                        Vrátit k rozhodnutí
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
