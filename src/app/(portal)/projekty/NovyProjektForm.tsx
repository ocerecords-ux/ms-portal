'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProjectPriority } from '@prisma/client';
import { AddButton } from '@/components/AddButton';
import { VyberPriority } from '@/components/IkonaPriority';
import { STAVY_PROJEKTU, popisStavu } from '@/lib/stavyProjektu';
import { KOTVA_NOVE, useOtevriZeZkratky } from '@/lib/zkratky';
import { type Herec } from './VyberHerce';
import { VyberHercu } from './VyberHercu';
import { VyberPole } from '@/components/VyberPole';
import { DatumPole } from '@/components/DatumPole';

/**
 * Založení projektu (zadání 10. 9. 2026). Do teď projekty vznikaly v Caflou;
 * od odchodu z Caflou vznikají tady.
 *
 * Povinný je jen název — zbytek se dá doplnit na detailu projektu. Projekt
 * často vzniká ve chvíli, kdy se ještě neví všechno, a formulář, který to
 * odmítne uložit, lidi naučí zadávat nesmysly.
 */
export function NovyProjektForm({
  firmy,
  klienti,
  manazeri,
  herci,
  typyProjektu,
  typAudioknihy,
}: {
  firmy: { id: string; label: string; maSlozku: boolean }[];
  /**
   * Účty klientů. Jméno a firma zvlášť, ne slepené do jednoho popisku -
   * nabídka se podle firmy zužuje a popisek se skládá až tady (zadání
   * 17. 9. 2026).
   */
  klienti: { id: string; jmeno: string; firma: string | null; companyId: string | null }[];
  manazeri: { id: string; label: string }[];
  /** Ucty hercu - herec je konkretni osoba, ne text (zadani 10. 9. 2026). */
  herci: Herec[];
  typyProjektu: string[];
  /**
   * Název typu projektu, který znamená audioknihu (položka ceníku zaškrtnutá
   * jako „pro objednávky audioknih"). Jen u něj má smysl počet normostran -
   * zadání 17. 9. 2026. `null` = v ceníku není žádná taková položka.
   */
  typAudioknihy: string | null;
}) {
  const router = useRouter();
  const [otevreno, setOtevreno] = useState(false);
  useOtevriZeZkratky(() => setOtevreno(true));

  const [form, setForm] = useState({
    name: '',
    companyId: '',
    klientUserId: '',
    projectType: '',
    managerUserId: '',
    // Stredni priorita je vychozi (zadani 10. 9. 2026). Vetsina projektu je
    // "normalni" a vybirat ji pokazde znovu je prace navic; kdo ma jinou,
    // prehodi ji.
    priority: 'MEDIUM',
    // Hercu muze byt vic (zadani 10. 9. 2026), prvni je hlavni.
    actorUserIds: [] as string[],
    pageCount: '',
    releaseDate: '',
    statusName: STAVY_PROJEKTU[0].nazev,
    zalozitSlozku: true,
  });
  const [uklada, setUklada] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [varovani, setVarovani] = useState<string | null>(null);

  function set<K extends keyof typeof form>(klic: K, hodnota: (typeof form)[K]) {
    setForm((f) => ({ ...f, [klic]: hodnota }));
  }

  const firma = firmy.find((f) => f.id === form.companyId);

  /** Normostrany dávají smysl jen u audioknihy - viz typAudioknihy. */
  const jeAudiokniha = Boolean(typAudioknihy) && form.projectType === typAudioknihy;

  /**
   * Přehození firmy shodí klienta, který pod ni nepatří - jinak by ve formuláři
   * zůstalo jméno, které v nabídce už není vidět, a odeslalo by se s projektem.
   */
  function zmenFirmu(companyId: string) {
    setForm((f) => {
      const vybrany = klienti.find((k) => k.id === f.klientUserId);
      const sedi = !vybrany || !companyId || vybrany.companyId === companyId || !vybrany.companyId;
      return { ...f, companyId, klientUserId: sedi ? f.klientUserId : '' };
    });
  }

  /**
   * KLIENTI PODLE VYBRANÉ FIRMY (zadání 17. 9. 2026: „když zakládám projekt
   * a dám firmu, tak by mi to mělo nabídnout jen jména klientů, kteří jsou
   * pod firmou. A bez firmy potom za pomlčkou").
   *
   * S vybranou firmou se nabídka ZÚŽÍ na její lidi a na ty, kdo firmu nemají
   * vyplněnou; ostatní firmy do ní nepatří - dřív tu stálo všech dvě stě
   * jmen a ta správná se v nich musela hledat. Koprodukce, kde u projektu
   * sedí člověk z jiné firmy, se nastaví v detailu projektu, kde se nabídka
   * nezužuje.
   *
   * POPISEK: s vybranou firmou stačí jméno (upřesnění 17. 9. 2026: „u klienta
   * je tam pořád ta pomlčka za jménem klienta s tou firmou"). Firmu má
   * vybranou člověk o dvě políčka vedle a v tom úzkém poli se stejně
   * nevešla - uřízla se uprostřed názvu. Kdo firmu vyplněnou nemá, zůstává
   * označený, ať se nespletou s ostatními; a bez vybrané firmy se firma
   * píše u všech, jinak by nešlo poznat, kdo je kdo.
   */
  const klientiKVyberu = klienti
    .filter((k) => !form.companyId || k.companyId === form.companyId || !k.companyId)
    .map((k) => ({
      id: k.id,
      label:
        form.companyId && k.companyId === form.companyId
          ? k.jmeno
          : `${k.jmeno} — ${k.firma ?? 'bez firmy'}`,
      /** Lidé vybrané firmy první, teprve pak ti bez firmy. */
      poradi: form.companyId && k.companyId === form.companyId ? 0 : k.companyId ? 1 : 2,
      jmeno: k.jmeno,
    }))
    .sort((a, b) => a.poradi - b.poradi || a.jmeno.localeCompare(b.jmeno, 'cs'));

  async function odesli(e: React.FormEvent) {
    e.preventDefault();
    setUklada(true);
    setChyba(null);
    setVarovani(null);
    try {
      const res = await fetch('/api/admin/projekty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || 'Projekt se nepodařilo založit.');
        return;
      }
      if (data?.varovaniDisk) {
        // Projekt vznikl, jen slozka na Disku ne - at to nezapadne.
        setVarovani(data.varovaniDisk);
        router.refresh();
        return;
      }
      router.push(`/projekty/${data.id}`);
    } catch {
      setChyba('Projekt se nepodařilo založit.');
    } finally {
      setUklada(false);
    }
  }

  const tridaPole =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full';

  if (!otevreno) {
    return (
      // Na telefonu se projekt nezakládá (21. 9. 2026: „tlačítko Nový projekt
      // dej pryč. V mobilu to nepůjde").
      <span id={KOTVA_NOVE} className="hidden sm:inline">
        <AddButton onClick={() => setOtevreno(true)}>Nový projekt</AddButton>
      </span>
    );
  }

  return (
    <form
      id={KOTVA_NOVE}
      onSubmit={odesli}
      className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-4 w-full"
    >
      <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Nový projekt</h2>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-body text-ink">Název projektu</span>
        <input
          required
          autoFocus
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="např. Bezradná (série)"
          className={tridaPole}
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Firma</span>
          <VyberPole value={form.companyId} onChange={(e) => zmenFirmu(e.target.value)} className={tridaPole}>
            <option value="">— bez firmy —</option>
            {firmy.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </VyberPole>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Klient</span>
          <VyberPole
            value={form.klientUserId}
            onChange={(e) => set('klientUserId', e.target.value)}
            className={tridaPole}
          >
            <option value="">— bez klienta —</option>
            {klientiKVyberu.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </VyberPole>
          {firma && (
            <span className="text-xs text-muted font-body">
              Nabízíme lidi z firmy {firma.label} a ty, kdo firmu vyplněnou nemají.
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Typ projektu</span>
          <VyberPole
            value={form.projectType}
            onChange={(e) => set('projectType', e.target.value)}
            className={tridaPole}
          >
            <option value="">— bez typu —</option>
            {typyProjektu.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </VyberPole>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Manažer projektu</span>
          <VyberPole
            value={form.managerUserId}
            onChange={(e) => set('managerUserId', e.target.value)}
            className={tridaPole}
          >
            <option value="">— bez manažera —</option>
            {manazeri.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </VyberPole>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Herci</span>
          <VyberHercu
            herci={herci}
            hodnoty={form.actorUserIds}
            onZmena={(ids) => set('actorUserIds', ids)}
          />
        </div>

        {/* NORMOSTRANY JEN U AUDIOKNIHY (zadání 17. 9. 2026: „když to není
            audiokniha, tak není třeba pole normostrany"). U voiceoveru ani
            u spotu se na normostrany nic nepočítá - ani rozpočet, ani délka
            frekvence - takže je to políčko, do kterého nemá co přijít. */}
        {jeAudiokniha && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Počet normostran</span>
            <input
              inputMode="numeric"
              value={form.pageCount}
              onChange={(e) => set('pageCount', e.target.value)}
              placeholder="0"
              className={`${tridaPole} text-right tabular-nums`}
            />
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Datum vydání</span>
          <DatumPole
            value={form.releaseDate}
            onChange={(e) => set('releaseDate', e.target.value)}
            className={tridaPole}
          />
        </label>

        {/* Stejna ikona a stejne klikani jako v prehledu i v karte projektu
            (upresneni 18. 9. 2026) - priorita se nikde v portalu nepise slovem. */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Priorita</span>
          <span className="flex items-center gap-3 h-[34px]">
            <VyberPriority
              priorita={(form.priority || null) as ProjectPriority | null}
              onZmena={(v) => set('priority', v)}
              velikost={22}
            />
            <span className="text-xs font-body text-muted">
              Každé klepnutí přidá čárku, po třetí se vrátí na jednu.
            </span>
          </span>
        </div>
      </div>

      <label className="flex flex-col gap-1.5 sm:max-w-sm">
        <span className="text-sm font-body text-ink">Stav</span>
        <VyberPole value={form.statusName} onChange={(e) => set('statusName', e.target.value)} className={tridaPole}>
          {STAVY_PROJEKTU.map((s) => (
            <option key={s.nazev} value={s.nazev}>
              {s.nazev}
            </option>
          ))}
        </VyberPole>
        <span className="text-xs text-muted font-body">{popisStavu(form.statusName)}</span>
      </label>

      {/* Slozka na Disku (zadani 10. 9. 2026). Kdyz uz slozka existuje, jde
          zakladani vypnout a odkaz se doplni na detailu projektu. */}
      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={form.zalozitSlozku}
          onChange={(e) => set('zalozitSlozku', e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-brand-purple"
        />
        <span className="text-sm font-body text-ink">
          Založit složku projektu na Google Disku
          <span className="block text-xs text-muted">
            {firma && !firma.maSlozku
              ? `${firma.label} nemá v portálu vyplněný odkaz na svou složku — složka projektu se nezaloží.`
              : 'Vznikne ve složce vybrané firmy a odkaz se u projektu vyplní sám.'}
          </span>
        </span>
      </label>

      {chyba && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{chyba}</p>}
      {varovani && (
        <p className="text-sm text-ink bg-warnTint border border-line rounded-lg px-3 py-2 m-0">
          Projekt je založený, ale {varovani.charAt(0).toLowerCase() + varovani.slice(1)} Odkaz na složku doplňte
          u projektu ručně.
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={uklada}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          {uklada ? 'Zakládám…' : 'Založit projekt'}
        </button>
        <button type="button" onClick={() => setOtevreno(false)} className="text-muted text-sm font-heading">
          Zavřít
        </button>
      </div>
    </form>
  );
}
