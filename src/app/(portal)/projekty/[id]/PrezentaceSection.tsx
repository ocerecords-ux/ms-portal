'use client';

import { useMemo, useState } from 'react';
import {
  SEKCE,
  delkaSlovy,
  hledaniSedi,
  jeVideo,
  odkazNaUkazku,
  type UkazkaData,
} from '@/lib/prezentaceNabidky';

/**
 * SESTAVENÍ NABÍDKOVÉ PREZENTACE (zadání 11. 10. 2026: „asi bych to chtěl
 * tvořit někde pod projektem").
 *
 * Co se tu dělá: napíše se návrh řešení, zaškrtnou se reference a hlasy
 * z knihovny, vybere se doklad, ze kterého se vezmou ceny, a prezentace se
 * zveřejní. Teprve pak odkaz něco vrátí - dokud není zveřejněná, klientovi
 * se neotevře, ani kdyby ho někdo poslal dřív.
 *
 * CENY SE SEM NEOPISUJÍ. Bere se doklad u projektu; když se opraví, opraví se
 * prezentace s ním.
 */

export type PrezentaceRadek = {
  id: string;
  token: string;
  nadpis: string | null;
  klientNazev: string;
  zverejneno: boolean;
  offerId: string | null;
  offerCislo: string | null;
  pocetOtevreni: number;
  posledniOtevreni: string | null;
  schvalenoAt: string | null;
  schvalilJmeno: string | null;
  odmitnutoAt: string | null;
  vybranyHerec: string | null;
  pocetReferenci: number;
  pocetHercu: number;
};

export type PrezentaceDetail = PrezentaceRadek & {
  podtitul: string | null;
  navrhReseni: string | null;
  podminky: string | null;
  lzeSchvalit: boolean;
  vybrane: Record<string, string[]>;
};

export function PrezentaceSection({
  caflouProjectId,
  pocatecni,
  knihovna,
  nabidky,
  zakladAdresy,
}: {
  caflouProjectId: string;
  pocatecni: PrezentaceRadek[];
  knihovna: UkazkaData[];
  nabidky: { id: string; cislo: string; predmet: string | null }[];
  zakladAdresy: string;
}) {
  const [radky, setRadky] = useState<PrezentaceRadek[]>(pocatecni);
  const [otevrena, setOtevrena] = useState<PrezentaceDetail | null>(null);
  const [pracuje, setPracuje] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  const zaklad = `/api/projects/${encodeURIComponent(caflouProjectId)}/prezentace`;

  async function zaloz() {
    setPracuje(true);
    setChyba(null);
    const res = await fetch(zaklad, { method: 'POST' });
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      prezentace?: PrezentaceRadek[];
      error?: string;
    };
    setPracuje(false);
    if (!res.ok || !data.id) {
      setChyba(data.error || 'Prezentaci se nepodařilo založit.');
      return;
    }
    setRadky(data.prezentace ?? radky);
    await otevri(data.id);
  }

  async function otevri(id: string) {
    setChyba(null);
    const res = await fetch(`${zaklad}/${encodeURIComponent(id)}`);
    const data = (await res.json().catch(() => ({}))) as {
      prezentace?: PrezentaceDetail;
      error?: string;
    };
    if (!res.ok || !data.prezentace) {
      setChyba(data.error || 'Prezentaci se nepodařilo načíst.');
      return;
    }
    setOtevrena(data.prezentace);
  }

  async function uloz(id: string, zmeny: Record<string, unknown>) {
    setPracuje(true);
    setChyba(null);
    const res = await fetch(`${zaklad}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(zmeny),
    });
    const data = (await res.json().catch(() => ({}))) as {
      prezentace?: PrezentaceDetail;
      error?: string;
    };
    setPracuje(false);
    if (!res.ok || !data.prezentace) {
      setChyba(data.error || 'Uložení se nepovedlo.');
      return;
    }
    setOtevrena(data.prezentace);
    setRadky((s) => s.map((r) => (r.id === id ? { ...r, ...data.prezentace! } : r)));
  }

  async function smaz(id: string) {
    setPracuje(true);
    const res = await fetch(`${zaklad}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    setPracuje(false);
    if (!res.ok) {
      setChyba('Smazání se nepovedlo.');
      return;
    }
    setRadky((s) => s.filter((r) => r.id !== id));
    setOtevrena(null);
  }

  if (otevrena) {
    return (
      <Editor
        prezentace={otevrena}
        knihovna={knihovna}
        nabidky={nabidky}
        zakladAdresy={zakladAdresy}
        pracuje={pracuje}
        chyba={chyba}
        onUloz={(z) => void uloz(otevrena.id, z)}
        onSmaz={() => void smaz(otevrena.id)}
        onZpet={() => setOtevrena(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 flex-wrap">
        <p className="font-body text-sm text-muted m-0 max-w-[62ch]">
          Obrandovaná nabídka na jednom odkazu: reference k poslechu, návrh řešení, hlasy herců,
          ceny z dokladu a podmínky spolupráce. Klient ji otevře bez přihlašování a může rovnou
          schválit i vybrat hlas.
        </p>
        <button
          type="button"
          onClick={() => void zaloz()}
          disabled={pracuje}
          className="ml-auto shrink-0 rounded-pill bg-brand-purple text-white font-heading font-semibold text-xs px-4 py-2 border-0 cursor-pointer disabled:opacity-50"
        >
          Nová prezentace
        </button>
      </div>

      {chyba && <p className="m-0 font-body text-sm text-danger">{chyba}</p>}

      {radky.length === 0 ? (
        <p className="font-body text-sm text-muted m-0">Zatím tu žádná není.</p>
      ) : (
        <ul className="list-none p-0 m-0 flex flex-col gap-2">
          {radky.map((r) => (
            <li
              key={r.id}
              className="rounded-card border border-line bg-surface p-3 flex items-start gap-3 flex-wrap"
            >
              <div className="min-w-0 flex-1">
                <p className="font-heading font-semibold text-sm text-ink m-0">
                  {r.nadpis?.trim() || 'Bez názvu'}
                  {!r.zverejneno && (
                    <span className="ml-2 rounded-pill bg-warnTint text-status-progress px-2 py-0.5 text-[11px]">
                      rozdělaná
                    </span>
                  )}
                  {r.schvalenoAt && (
                    <span className="ml-2 rounded-pill bg-brand-green/20 text-brand-greenDeep px-2 py-0.5 text-[11px]">
                      schváleno
                    </span>
                  )}
                  {r.odmitnutoAt && !r.schvalenoAt && (
                    <span className="ml-2 rounded-pill bg-dangerTint text-danger px-2 py-0.5 text-[11px]">
                      odmítnuto
                    </span>
                  )}
                </p>
                <p className="font-body text-xs text-muted m-0 mt-0.5">
                  {[
                    r.klientNazev || null,
                    r.offerCislo ? `nabídka ${r.offerCislo}` : 'bez cen',
                    `${r.pocetReferenci} referencí`,
                    `${r.pocetHercu} hlasů`,
                    r.pocetOtevreni > 0
                      ? `otevřeno ${r.pocetOtevreni}×`
                      : r.zverejneno
                        ? 'klient zatím neotevřel'
                        : null,
                    r.vybranyHerec ? `vybrán hlas: ${r.vybranyHerec}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void otevri(r.id)}
                className="shrink-0 rounded-pill border border-line bg-surface text-ink font-heading font-semibold text-xs px-3 py-1.5 cursor-pointer"
              >
                Otevřít
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Editor({
  prezentace,
  knihovna,
  nabidky,
  zakladAdresy,
  pracuje,
  chyba,
  onUloz,
  onSmaz,
  onZpet,
}: {
  prezentace: PrezentaceDetail;
  knihovna: UkazkaData[];
  nabidky: { id: string; cislo: string; predmet: string | null }[];
  zakladAdresy: string;
  pracuje: boolean;
  chyba: string | null;
  onUloz: (zmeny: Record<string, unknown>) => void;
  onSmaz: () => void;
  onZpet: () => void;
}) {
  const [nadpis, setNadpis] = useState(prezentace.nadpis ?? '');
  const [klient, setKlient] = useState(prezentace.klientNazev);
  const [podtitul, setPodtitul] = useState(prezentace.podtitul ?? '');
  const [navrh, setNavrh] = useState(prezentace.navrhReseni ?? '');
  const [podminky, setPodminky] = useState(prezentace.podminky ?? '');
  const odkaz = `${zakladAdresy}/prezentace/${prezentace.token}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={onZpet}
          className="rounded-pill border border-line bg-surface text-muted font-heading font-semibold text-xs px-3 py-1.5 cursor-pointer"
        >
          ← Zpět na seznam
        </button>
        <button
          type="button"
          onClick={() => onUloz({ zverejneno: !prezentace.zverejneno })}
          disabled={pracuje}
          className={`ml-auto rounded-pill font-heading font-semibold text-xs px-4 py-1.5 cursor-pointer border disabled:opacity-50 ${
            prezentace.zverejneno
              ? 'bg-surface text-ink border-line'
              : 'bg-brand-green text-black border-transparent'
          }`}
        >
          {prezentace.zverejneno ? 'Stáhnout z oběhu' : 'Zveřejnit'}
        </button>
      </div>

      {chyba && <p className="m-0 font-body text-sm text-danger">{chyba}</p>}

      {/* ODKAZ PRO KLIENTA. Dokud není zveřejněná, je schválně jen vypsaný
          a napsané proč - ať se neodešle rozdělaná nabídka. */}
      <div className="rounded-card border border-line bg-field p-3 flex flex-col gap-1">
        <span className="text-[11px] font-heading text-muted uppercase tracking-wide">
          Odkaz pro klienta
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={odkaz}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 break-all font-body text-sm text-brand-purple no-underline hover:underline"
          >
            {odkaz}
          </a>
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(odkaz)}
            className="shrink-0 rounded-pill border border-line bg-surface text-ink font-heading font-semibold text-xs px-3 py-1.5 cursor-pointer"
          >
            Zkopírovat
          </button>
        </div>
        {!prezentace.zverejneno && (
          <span className="font-body text-[11px] text-muted">
            Zatím nezveřejněná — komu odkaz pošlete, uvidí „nenalezeno“.
          </span>
        )}
        {prezentace.schvalenoAt && (
          <span className="font-body text-[11px] text-brand-greenDeep">
            Schváleno {new Date(prezentace.schvalenoAt).toLocaleString('cs-CZ')}
            {prezentace.schvalilJmeno ? ` — ${prezentace.schvalilJmeno}` : ''}
          </span>
        )}
        {prezentace.vybranyHerec && (
          <span className="font-body text-[11px] text-ink">
            Klient vybral hlas: <strong>{prezentace.vybranyHerec}</strong>
          </span>
        )}
      </div>

      <Pole popisek="Název na prezentaci" napoveda="Prázdné = název projektu.">
        <input
          value={nadpis}
          onChange={(e) => setNadpis(e.target.value)}
          onBlur={() => onUloz({ nadpis: nadpis.trim() || null })}
          className={VSTUP}
        />
      </Pole>

      <Pole popisek="Klient" napoveda="Jak se má jmenovat v hlavičce — „pro …“.">
        <input
          value={klient}
          onChange={(e) => setKlient(e.target.value)}
          onBlur={() => onUloz({ klientNazev: klient.trim() })}
          className={VSTUP}
        />
      </Pole>

      <Pole popisek="Úvodní věta" napoveda="Pod nadpisem. Jedna dvě věty, o co jde.">
        <textarea
          value={podtitul}
          rows={2}
          onChange={(e) => setPodtitul(e.target.value)}
          onBlur={() => onUloz({ podtitul: podtitul.trim() || null })}
          className={VSTUP}
        />
      </Pole>

      <VyberUkazek
        nazev="Naše reference"
        napoveda="Ukázky z minulých projektů. Spravují se v Administraci → Ukázky do nabídek."
        knihovna={knihovna.filter((u) => u.druh === SEKCE.reference)}
        vybrane={prezentace.vybrane[SEKCE.reference] ?? []}
        onZmena={(ids) => onUloz({ reference: ids })}
      />

      <Pole
        popisek="Návrh řešení"
        napoveda="Odstavce oddělte prázdným řádkem; řádek začínající pomlčkou se vykreslí jako odrážka."
      >
        <textarea
          value={navrh}
          rows={8}
          onChange={(e) => setNavrh(e.target.value)}
          onBlur={() => onUloz({ navrhReseni: navrh.trim() || null })}
          className={VSTUP}
        />
      </Pole>

      <VyberUkazek
        nazev="Nabídka hlasů"
        napoveda="Dema herců. Klient si může jeden vybrat a přijde vám o tom oznámení."
        knihovna={knihovna.filter((u) => u.druh === SEKCE.herec)}
        vybrane={prezentace.vybrane[SEKCE.herec] ?? []}
        onZmena={(ids) => onUloz({ herci: ids })}
      />

      <Pole
        popisek="Cenová nabídka"
        napoveda="Položky se berou z dokladu u projektu — když ho opravíte, opraví se i prezentace."
      >
        <select
          value={prezentace.offerId ?? ''}
          onChange={(e) => onUloz({ offerId: e.target.value || null })}
          className={VSTUP}
        >
          <option value="">Bez cen</option>
          {nabidky.map((n) => (
            <option key={n.id} value={n.id}>
              {n.cislo}
              {n.predmet ? ` — ${n.predmet}` : ''}
            </option>
          ))}
        </select>
        {nabidky.length === 0 && (
          <span className="font-body text-[11px] text-muted">
            U projektu zatím žádná nabídka není — založte ji v Dokladech.
          </span>
        )}
      </Pole>

      <Pole popisek="Podmínky spolupráce" napoveda="Licence, termíny dodání, platba. Předvyplněné ze vzoru.">
        <textarea
          value={podminky}
          rows={8}
          onChange={(e) => setPodminky(e.target.value)}
          onBlur={() => onUloz({ podminky: podminky.trim() || null })}
          className={VSTUP}
        />
      </Pole>

      <label className="flex items-start gap-2.5 rounded-card border border-line bg-field px-3 py-2.5">
        <input
          type="checkbox"
          checked={prezentace.lzeSchvalit}
          onChange={(e) => onUloz({ lzeSchvalit: e.target.checked })}
          className="mt-0.5"
        />
        <span className="text-sm font-body text-ink">
          Klient může schválit a vybrat hlas přímo z prezentace
          <span className="block text-xs text-muted">
            Schválení se propíše i do dokladu a přijde vám oznámení.
          </span>
        </span>
      </label>

      <button
        type="button"
        onClick={onSmaz}
        disabled={pracuje}
        className="self-start text-sm font-heading font-semibold text-danger bg-transparent border-0 cursor-pointer disabled:opacity-50"
      >
        Smazat prezentaci
      </button>
    </div>
  );
}

const VSTUP =
  'w-full rounded-card border border-line bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple';

function Pole({
  popisek,
  napoveda,
  children,
}: {
  popisek: string;
  napoveda?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-heading font-semibold text-ink">{popisek}</span>
      {napoveda && <span className="text-xs font-body text-muted">{napoveda}</span>}
      {children}
    </label>
  );
}

/**
 * Zaškrtávání z knihovny. Pořadí = pořadí zaškrtávání; co se zaškrtne dřív,
 * je v prezentaci výš - jinak by se muselo přetahovat myší a to je na
 * seznamu o dvaceti položkách utrpení.
 */
function VyberUkazek({
  nazev,
  napoveda,
  knihovna,
  vybrane,
  onZmena,
}: {
  nazev: string;
  napoveda: string;
  knihovna: UkazkaData[];
  vybrane: string[];
  onZmena: (ids: string[]) => void;
}) {
  const [hledani, setHledani] = useState('');
  const videt = useMemo(
    () => knihovna.filter((u) => hledaniSedi(u, hledani)),
    [hledani, knihovna],
  );

  function prepni(id: string) {
    onZmena(vybrane.includes(id) ? vybrane.filter((x) => x !== id) : [...vybrane, id]);
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <span className="text-sm font-heading font-semibold text-ink">{nazev}</span>
        <span className="block text-xs font-body text-muted">{napoveda}</span>
      </div>

      {knihovna.length === 0 ? (
        <p className="font-body text-sm text-muted m-0">
          Knihovna je zatím prázdná — nahrajte ukázky v Administraci.
        </p>
      ) : (
        <>
          <input
            value={hledani}
            onChange={(e) => setHledani(e.target.value)}
            placeholder="Hledat v knihovně"
            className={VSTUP}
          />
          <ul className="list-none p-0 m-0 flex flex-col gap-1.5 max-h-80 overflow-y-auto">
            {videt.map((u) => {
              const kolikaty = vybrane.indexOf(u.id);
              return (
                <li
                  key={u.id}
                  className={`rounded-card border bg-surface px-3 py-2 flex items-center gap-3 ${
                    kolikaty >= 0 ? 'border-brand-purple' : 'border-line'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={kolikaty >= 0}
                    onChange={() => prepni(u.id)}
                    className="shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-heading font-semibold text-sm text-ink m-0">
                      {kolikaty >= 0 && <span className="text-brand-purple">{kolikaty + 1}. </span>}
                      {u.nazev}
                      {u.delka > 0 && (
                        <span className="font-body font-normal text-muted"> · {delkaSlovy(u.delka)}</span>
                      )}
                      {jeVideo(u.typSouboru) && (
                        <span className="font-body font-normal text-muted"> · video</span>
                      )}
                    </p>
                    {u.popis && <p className="font-body text-xs text-muted m-0">{u.popis}</p>}
                  </div>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio
                    src={odkazNaUkazku(u.id)}
                    controls
                    preload="none"
                    className="shrink-0 w-44 h-8"
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
