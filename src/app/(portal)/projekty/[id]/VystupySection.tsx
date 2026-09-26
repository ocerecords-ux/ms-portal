'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DatumPole } from '@/components/DatumPole';
import { KresbaIkony, tridaBarvyIkony } from '@/lib/ikonyTypu';
import {
  NABIZENE_DOWNCUTY,
  popisDelky,
  sDedenim,
  serad,
  type VystupData,
} from '@/lib/vystupy';

/**
 * ZÁLOŽKA „VÝSTUPY" (zadání 26. 9. 2026: „u jednoho projektu máme více
 * výstupů… u Strabagu jsme teď dělali 4 různé délky a v každém spotu jiní
 * herci. Nebo děláme pod jedním projektem 5 různých rádiových spotů").
 *
 * Tabulka místo hromady formulářů: kdo se na zakázku podívá, potřebuje na
 * první pohled vidět, kolik věcí se v ní dělá, jak jsou dlouhé a kdo v nich
 * mluví. Řádek se rozklepne na formulář, teprve když se něco doplňuje.
 *
 * DOWNCUT JE PODŘÁDEK, NE ROVNOCENNÁ POLOŽKA. Zadá se zaškrtnutím délky
 * a všechno ostatní dědí po hlavním spotu - proto u něj prázdné pole
 * neznamená „nevyplněno", ale „stejné jako u hlavního" a v políčku svítí
 * zděděná hodnota jako našeptaná (viz sDedenim v lib/vystupy.ts).
 */

const inputClass =
  'rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple disabled:opacity-60';

export type HerecVolba = { id: string; name: string };
export type LicenceVolba = { id: string; nazev: string; ikona: string | null };
export type TypVolba = { nazev: string; rodnyList: boolean };
/** Vyrobený rodný list; `vystupId` prázdné má jen starší dokument z doby před výstupy. */
export type RodnyListRadek = {
  id: string;
  vystupId: string | null;
  version: number;
  fileName: string;
  driveUrl: string | null;
};

export function VystupySection({
  caflouProjectId,
  canEdit,
  vystupy: vychozi,
  herci,
  druhyLicence,
  typy,
  rodneListy,
  muzeNabidku,
  nazevProjektu,
}: {
  caflouProjectId: string;
  canEdit: boolean;
  vystupy: VystupData[];
  /** Vyrobené rodné listy - u každého výstupu vlastní řada verzí. */
  rodneListy: RodnyListRadek[];
  /** Smí ten, kdo se dívá, založit z výstupů nabídku? (vidí doklady) */
  muzeNabidku: boolean;
  /** Herci projektu - ve výstupu se z nich jen vybírá, nezadávají se znovu. */
  herci: HerecVolba[];
  druhyLicence: LicenceVolba[];
  /** Typy z ceníku; `rodnyList` říká, ke kterému výstupu se dělá RL. */
  typy: TypVolba[];
  nazevProjektu: string;
}) {
  const router = useRouter();
  const [vystupy, setVystupy] = useState<VystupData[]>(vychozi);
  const [otevreny, setOtevreny] = useState<string | null>(null);
  const [downcutU, setDowncutU] = useState<string | null>(null);
  const [pracuje, setPracuje] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [nabidka, setNabidka] = useState<{ id: string; number: string } | null>(null);

  const razene = useMemo(() => serad(vystupy), [vystupy]);
  const podleId = useMemo(() => new Map(vystupy.map((v) => [v.id, v])), [vystupy]);
  const jmenaHercu = useMemo(() => new Map(herci.map((h) => [h.id, h.name])), [herci]);
  const nazvyLicenci = useMemo(() => new Map(druhyLicence.map((l) => [l.id, l.nazev])), [druhyLicence]);
  /** Rodné listy po výstupech, nejnovější verze první. */
  const rlPodleVystupu = useMemo(() => {
    const m = new Map<string, RodnyListRadek[]>();
    for (const rl of rodneListy) {
      if (!rl.vystupId) continue;
      m.set(rl.vystupId, [...(m.get(rl.vystupId) ?? []), rl]);
    }
    for (const seznam of m.values()) seznam.sort((a, b) => b.version - a.version);
    return m;
  }, [rodneListy]);

  async function zavolej(url: string, init: RequestInit): Promise<Record<string, unknown> | null> {
    setPracuje(true);
    setChyba(null);
    try {
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba((data as { error?: string })?.error || 'Nepovedlo se to uložit.');
        return null;
      }
      return data as Record<string, unknown>;
    } catch {
      setChyba('Nepovedlo se to uložit.');
      return null;
    } finally {
      setPracuje(false);
    }
  }

  async function pridej(vstup: Record<string, unknown>) {
    const data = await zavolej(`/api/projects/${encodeURIComponent(caflouProjectId)}/vystupy`, {
      method: 'POST',
      body: JSON.stringify(vstup),
    });
    const novy = data?.vystup as VystupData | undefined;
    if (!novy) return;
    setVystupy((s) => [...s, novy]);
    setOtevreny(novy.id);
    setDowncutU(null);
    router.refresh();
  }

  async function uloz(id: string, zmena: Record<string, unknown>) {
    const data = await zavolej(
      `/api/projects/${encodeURIComponent(caflouProjectId)}/vystupy/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(zmena) },
    );
    const upraveny = data?.vystup as VystupData | undefined;
    if (!upraveny) return;
    setVystupy((s) => s.map((v) => (v.id === id ? upraveny : v)));
    router.refresh();
  }

  /**
   * NABÍDKA Z VÝSTUPŮ (26. 9. 2026). Každý výstup × každá jeho služba = jedna
   * položka. Ceny se doplní jen tam, kde je zná ceník - ten se na reklamy
   * teprve dodělává, takže zbytek čeká na doplnění v dokladu.
   */
  async function zalozNabidku() {
    const data = await zavolej(`/api/projects/${encodeURIComponent(caflouProjectId)}/vystupy/nabidka`, {
      method: 'POST',
    });
    if (!data) return;
    setNabidka({ id: String(data.id), number: String(data.number) });
    router.refresh();
  }

  async function vyrobRL(vystupId: string) {
    const data = await zavolej(
      `/api/projects/${encodeURIComponent(caflouProjectId)}/vystupy/${encodeURIComponent(vystupId)}/rodny-list`,
      { method: 'POST' },
    );
    if (!data) return;
    // Seznam verzí přijde ze serveru - stránka se překreslí.
    router.refresh();
  }

  async function smaz(id: string) {
    const data = await zavolej(
      `/api/projects/${encodeURIComponent(caflouProjectId)}/vystupy/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
    if (!data) return;
    setVystupy((s) => s.filter((v) => v.id !== id));
    if (otevreny === id) setOtevreny(null);
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="font-display text-2xl text-ink m-0">Výstupy</h2>
        {canEdit && (
          <button
            type="button"
            onClick={() => pridej({ nazev: 'Výstup' })}
            disabled={pracuje}
            title="Přidat výstup"
            aria-label="Přidat výstup"
            className="w-8 h-8 shrink-0 grid place-items-center rounded-full border border-line text-muted text-xl leading-none bg-surface hover:text-brand-purple hover:border-brand-purple transition-colors cursor-pointer disabled:opacity-50"
          >
            +
          </button>
        )}
        {muzeNabidku && razene.length > 0 && (
          <button
            type="button"
            onClick={zalozNabidku}
            disabled={pracuje}
            title="Založí rozpracovanou nabídku — položka za každou službu u každého výstupu"
            className="ml-auto rounded-pill border border-line text-muted font-heading font-semibold text-sm px-4 py-1.5 bg-surface hover:text-brand-purple hover:border-brand-purple transition-colors cursor-pointer disabled:opacity-50"
          >
            Nabídka z výstupů
          </button>
        )}
      </div>

      {nabidka && (
        <p className="text-sm font-body text-ink m-0 rounded-card border border-line bg-field/40 px-4 py-3">
          Nabídka <strong>{nabidka.number}</strong> je založená jako rozpracovaná — ceny v ní
          zkontrolujte a doplňte.{' '}
          <a
            href={`/admin/doklady/nabidky/${nabidka.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-heading text-brand-purple no-underline hover:underline"
          >
            Otevřít nabídku
          </a>
        </p>
      )}

      <p className="text-sm font-body text-muted m-0">
        Jeden výstup = jedna odevzdaná věc: spot, voiceover, zkrácená verze. U každého stačí
        název, délka a licence; režii, hudbu a datum výroby má projekt jednou v záložce Rodný
        list. Zkrácené verze se zakládají tlačítkem{' '}
        <span className="font-heading text-ink">Downcut</span> u hlavního spotu a dědí po něm
        herce i licenci.
      </p>

      {chyba && (
        <p className="text-sm font-body text-status-error m-0" role="alert">
          {chyba}
        </p>
      )}

      {razene.length === 0 ? (
        <p className="text-sm font-body text-muted m-0">
          Zatím tu není žádný výstup{canEdit ? ' — přidejte ho tlačítkem +.' : '.'}
        </p>
      ) : (
        <ul className="list-none p-0 m-0 flex flex-col gap-2">
          {razene.map((v) => {
            const rodic = v.odvozenoZId ? podleId.get(v.odvozenoZId) ?? null : null;
            const plny = sDedenim(v, rodic);
            const typ = typy.find((t) => t.nazev === plny.typKlic) ?? null;
            const jmena = plny.herciIds.map((id) => jmenaHercu.get(id) || '—').filter(Boolean);

            return (
              <li
                key={v.id}
                className={`rounded-card border border-line bg-surface ${rodic ? 'ml-6' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => setOtevreny(otevreny === v.id ? null : v.id)}
                  className="w-full flex items-center gap-3 flex-wrap px-4 py-3 text-left bg-transparent border-0 cursor-pointer"
                >
                  <span className="font-heading font-semibold text-sm text-ink">
                    {rodic ? '↳ ' : ''}
                    {v.nazev}
                  </span>
                  {plny.delkaSekund ? (
                    <span className="rounded-pill bg-field border border-line px-2 py-0.5 text-xs font-heading text-muted tabular-nums">
                      {popisDelky(plny.delkaSekund)}
                    </span>
                  ) : null}
                  {jmena.length > 0 && (
                    <span className="text-xs font-body text-muted truncate max-w-[220px]">
                      {jmena.join(', ')}
                      {rodic && v.herciIds.length === 0 ? ' (dědí)' : ''}
                    </span>
                  )}
                  {plny.licenceIds.length > 0 && (
                    <span className="text-xs font-body text-muted">
                      {plny.licenceIds.map((id) => nazvyLicenci.get(id) || '').filter(Boolean).join(' · ')}
                    </span>
                  )}
                  {typ?.rodnyList && (
                    <span className="rounded-pill border border-line px-2 py-0.5 text-[11px] font-heading text-muted">
                      rodný list
                    </span>
                  )}
                  {(rlPodleVystupu.get(v.id) ?? []).length > 0 && (
                    <span className="rounded-pill bg-okTint text-status-done px-2 py-0.5 text-[11px] font-heading font-semibold">
                      RL v{(rlPodleVystupu.get(v.id) ?? [])[0].version}
                    </span>
                  )}
                  {v.hotovo && (
                    <span className="rounded-pill bg-okTint text-status-done px-2 py-0.5 text-[11px] font-heading font-semibold">
                      hotovo
                    </span>
                  )}
                  {!v.potvrzeno && (
                    <span
                      title="Návrh z objednávky — ještě ho nikdo z nás nepotvrdil."
                      className="rounded-pill bg-warnTint text-status-progress px-2 py-0.5 text-[11px] font-heading font-semibold"
                    >
                      návrh klienta
                    </span>
                  )}
                  <span className="ml-auto text-muted text-sm">{otevreny === v.id ? '▾' : '▸'}</span>
                </button>

                {otevreny === v.id && (
                  <VystupForm
                    vystup={v}
                    rodic={rodic}
                    canEdit={canEdit}
                    herci={herci}
                    druhyLicence={druhyLicence}
                    nazevProjektu={nazevProjektu}
                    rodneListy={rlPodleVystupu.get(v.id) ?? []}
                    delaSeRL={
                      (typy.find((t) => t.nazev === plny.typKlic) ?? null)?.rodnyList ?? false
                    }
                    onRodnyList={() => vyrobRL(v.id)}
                    pracuje={pracuje}
                    onUloz={(zmena) => uloz(v.id, zmena)}
                    onSmaz={() => smaz(v.id)}
                  />
                )}

                {canEdit && !rodic && otevreny !== v.id && (
                  <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
                    {downcutU === v.id ? (
                      <>
                        <span className="text-xs font-heading text-muted">Délka zkrácené verze:</span>
                        {NABIZENE_DOWNCUTY.map((s) => (
                          <button
                            key={s}
                            type="button"
                            disabled={pracuje}
                            onClick={() => pridej({ odvozenoZId: v.id, delkaSekund: s })}
                            className="rounded-pill border border-line px-3 py-1 text-xs font-heading text-ink bg-field hover:border-brand-purple hover:text-brand-purple transition-colors cursor-pointer tabular-nums"
                          >
                            {s}s
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setDowncutU(null)}
                          className="text-xs font-heading text-muted bg-transparent border-0 cursor-pointer underline"
                        >
                          zrušit
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDowncutU(v.id)}
                        className="rounded-pill border border-dashed border-line px-3 py-1 text-xs font-heading text-muted hover:text-brand-purple hover:border-brand-purple transition-colors cursor-pointer bg-transparent"
                      >
                        + Downcut
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Formulář jednoho výstupu. Ukládá se tlačítkem, ne při každém písmenu.
 *
 * JEN NÁZEV, DÉLKA A LICENCE (zadání 26. 9. 2026: „pojďme zjednodušit ty
 * výstupy u projektů. Jednoduše ho pojmenujeme vždy názvem a u toho zadáme
 * licence a délku").
 *
 * Režie, hudba, datum výroby i klient na dokumentu se vyplňují jednou za
 * projekt v záložce Rodný list - u čtyř délek téhož spotu jsou stejně stejné
 * a čtyřikrát opsané by se jen rozcházely. Rodný list si je odtamtud vezme.
 *
 * Herci zůstávají (upřesnění téhož dne: „nechat, ale nenápadně") - u Strabagu
 * je v každé délce někdo jiný a jinde se to nevede. Proto jsou pod hlavním
 * řádkem, ne v něm.
 */
function VystupForm({
  vystup,
  rodic,
  canEdit,
  herci,
  druhyLicence,
  nazevProjektu,
  rodneListy,
  delaSeRL,
  onRodnyList,
  pracuje,
  onUloz,
  onSmaz,
}: {
  vystup: VystupData;
  rodic: VystupData | null;
  canEdit: boolean;
  herci: HerecVolba[];
  druhyLicence: LicenceVolba[];
  nazevProjektu: string;
  rodneListy: RodnyListRadek[];
  /** Dělá se k tomuhle typu výstupu rodný list? (příznak u položky ceníku) */
  delaSeRL: boolean;
  onRodnyList: () => void;
  pracuje: boolean;
  onUloz: (zmena: Record<string, unknown>) => void;
  onSmaz: () => void;
}) {
  const [v, setV] = useState<VystupData>(vystup);
  const [potvrzujiSmazani, setPotvrzujiSmazani] = useState(false);

  function set<K extends keyof VystupData>(key: K, value: VystupData[K]) {
    setV((s) => ({ ...s, [key]: value }));
  }

  /** U downcutu prázdné pole znamená „stejné jako u hlavního spotu". */
  const dedi = (prazdne: boolean) => Boolean(rodic) && prazdne;

  return (
    <form
      className="px-4 pb-4 pt-1 flex flex-col gap-4 border-t border-line"
      onSubmit={(e) => {
        e.preventDefault();
        onUloz({
          nazev: v.nazev,
          delkaSekund: v.delkaSekund,
          licenceIds: v.licenceIds,
          herciIds: v.herciIds,
          potvrzeno: true,
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Název</span>
          <input
            className={inputClass}
            value={v.nazev}
            disabled={!canEdit}
            placeholder={nazevProjektu}
            onChange={(e) => set('nazev', e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Délka (s)</span>
          <input
            className={`${inputClass} w-28 tabular-nums`}
            type="number"
            min={1}
            inputMode="numeric"
            value={v.delkaSekund ?? ''}
            disabled={!canEdit}
            placeholder={rodic?.delkaSekund ? String(rodic.delkaSekund) : ''}
            onChange={(e) => set('delkaSekund', e.target.value ? Number(e.target.value) : null)}
          />
        </label>
      </div>

      {/* Licence konkrétního výstupu - spot běží v rádiu, voiceover online. */}
      {druhyLicence.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">
            Licence
            {dedi(v.licenceIds.length === 0) ? ' — zatím stejná jako u hlavního spotu' : ''}
          </span>
          <div className="flex flex-wrap gap-2">
            {druhyLicence.map((d) => {
              const zaskrtnuto = v.licenceIds.includes(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  role="checkbox"
                  aria-checked={zaskrtnuto}
                  disabled={!canEdit}
                  onClick={() =>
                    set(
                      'licenceIds',
                      zaskrtnuto ? v.licenceIds.filter((x) => x !== d.id) : [...v.licenceIds, d.id],
                    )
                  }
                  className={`inline-flex items-center gap-2 pl-2 pr-3.5 py-1.5 rounded-pill border text-sm font-heading font-semibold transition-colors ${
                    zaskrtnuto
                      ? 'border-brand-purple bg-brand-purple/10 text-brand-purpleDeep dark:text-brand-purpleLight'
                      : 'border-dashed border-line bg-transparent text-muted opacity-70 hover:opacity-100 hover:text-ink'
                  }`}
                >
                  <span
                    className={`grid place-items-center w-6 h-6 rounded-full ${
                      zaskrtnuto ? tridaBarvyIkony(d.ikona) : 'bg-field text-muted'
                    }`}
                  >
                    {d.ikona ? <KresbaIkony klic={d.ikona} velikost={13} /> : null}
                  </span>
                  {d.nazev}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Herci - nenápadně pod licencí. Vybírá se z herců projektu, jméno se
          nikde nezadává znovu. */}
      {herci.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-heading text-muted">
            Kdo v něm mluví
            {dedi(v.herciIds.length === 0) ? ' — zatím stejně jako u hlavního spotu' : ''}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {herci.map((h) => {
              const zaskrtnuto = v.herciIds.includes(h.id);
              return (
                <button
                  key={h.id}
                  type="button"
                  role="checkbox"
                  aria-checked={zaskrtnuto}
                  disabled={!canEdit}
                  onClick={() =>
                    set(
                      'herciIds',
                      zaskrtnuto ? v.herciIds.filter((x) => x !== h.id) : [...v.herciIds, h.id],
                    )
                  }
                  className={`rounded-pill border px-2.5 py-1 text-xs font-heading transition-colors ${
                    zaskrtnuto
                      ? 'border-brand-purple bg-brand-purple/10 text-brand-purpleDeep dark:text-brand-purpleLight'
                      : 'border-dashed border-line bg-transparent text-muted opacity-70 hover:opacity-100 hover:text-ink'
                  }`}
                >
                  {h.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* RODNÝ LIST K VÝSTUPU (26. 9. 2026). Dělá se jen u typů, které ho
          mají v ceníku zapnutý - online voiceover pod stejným projektem ho
          nedostane a nikdo to nemusí hlídat. Údaje o režii, hudbě a datu si
          bere ze záložky Rodný list, tady se zadává jen délka. */}
      {delaSeRL && (
        <div className="flex flex-col gap-2 rounded-card border border-line bg-field/40 p-3">
          <span className="text-sm font-heading font-semibold text-ink">Rodný list</span>
          {rodneListy.length === 0 ? (
            <p className="text-sm font-body text-muted m-0">
              Zatím není vyrobený. Vznikne z názvu a délky výše; režii, hudbu a datum výroby si
              vezme ze záložky Rodný list.
            </p>
          ) : (
            <ul className="list-none p-0 m-0 flex flex-col gap-1">
              {rodneListy.map((rl) => (
                <li key={rl.id} className="flex items-center gap-3 flex-wrap text-sm font-body">
                  <a
                    href={`/api/rodny-list/${rl.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-heading text-brand-purple no-underline hover:underline"
                  >
                    {rl.fileName}
                  </a>
                  <span className="text-muted tabular-nums">verze {rl.version}</span>
                  {rl.driveUrl && (
                    <a
                      href={rl.driveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted no-underline hover:underline text-xs"
                    >
                      na Disku ↗
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={onRodnyList}
              disabled={pracuje}
              className="self-start rounded-pill border border-brand-purple text-brand-purple font-heading font-semibold text-sm px-4 py-1.5 bg-transparent cursor-pointer disabled:opacity-50"
            >
              {rodneListy.length === 0 ? 'Vyrobit rodný list' : 'Vyrobit novou verzi'}
            </button>
          )}
          <p className="text-xs font-body text-muted m-0">
            Nejdřív uložte výstup — dokument se tiskne z uložených údajů.
          </p>
        </div>
      )}

      {canEdit && (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="submit"
            disabled={pracuje}
            className="rounded-pill bg-brand-purple text-white font-heading font-semibold text-sm px-5 py-2 border-0 cursor-pointer disabled:opacity-50"
          >
            Uložit výstup
          </button>
          {potvrzujiSmazani ? (
            <span className="flex items-center gap-2 text-sm font-body text-ink ml-auto">
              Opravdu smazat?
              <button
                type="button"
                onClick={onSmaz}
                disabled={pracuje}
                className="rounded-pill border border-status-error text-status-error font-heading text-sm px-3 py-1 bg-transparent cursor-pointer"
              >
                Smazat
              </button>
              <button
                type="button"
                onClick={() => setPotvrzujiSmazani(false)}
                className="text-muted bg-transparent border-0 underline cursor-pointer text-sm"
              >
                zpět
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setPotvrzujiSmazani(true)}
              className="ml-auto text-sm font-heading text-muted bg-transparent border-0 underline cursor-pointer hover:text-status-error"
            >
              Smazat výstup
            </button>
          )}
        </div>
      )}
    </form>
  );
}
