'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProjectPriority } from '@prisma/client';
import { AddButton } from '@/components/AddButton';
import { VyberPriority } from '@/components/IkonaPriority';
import { STAVY_PROJEKTU, nazevStavu, popisStavu } from '@/lib/stavyProjektu';
import { KOTVA_NOVE, useOtevriZeZkratky } from '@/lib/zkratky';
import { type Herec } from './VyberHerce';
import { VyberHercu } from './VyberHercu';
import { VyberPole } from '@/components/VyberPole';
import { DatumPole } from '@/components/DatumPole';
import { kodJazyka } from '@/lib/jazyk';
import { useJazyk, usePreklad } from '../components/JazykProvider';

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
  typyReklam = [],
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
   * Názvy typů projektu, které znamenají REKLAMU (položky ceníku
   * zaškrtnuté jako „Rodný list"). U nich se datum ptá na náš termín
   * dokončení, ne na termín klienta - viz dál u pole s datem.
   */
  typyReklam?: string[];
  /**
   * Název typu projektu, který znamená audioknihu (položka ceníku zaškrtnutá
   * jako „pro objednávky audioknih"). Jen u něj má smysl počet normostran -
   * zadání 17. 9. 2026. `null` = v ceníku není žádná taková položka.
   */
  typAudioknihy: string | null;
}) {
  const t = usePreklad();
  const jazyk = useJazyk();
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
    /**
     * JEDNO POLE, DVĚ KOLONKY (zadání 8. 10. 2026: „u reklam to není datum
     * vydání, ale datum dokončení!").
     *
     * Projekt má dvě data: `endDate` je NÁŠ termín dokončení a `releaseDate`
     * termín, kdy to vydá klient. U reklamy druhé není - na kartě projektu
     * se ani nenabízí. Zakládací formulář ho přitom psával do `releaseDate`
     * vždycky, takže u reklamy datum spadlo do kolonky, kterou už nikdo
     * neuvidí. Teď se podle typu projektu rozhodne až při odeslání.
     */
    datum: '',
    statusName: STAVY_PROJEKTU[0].nazev,
    zalozitSlozku: true,
  });
  const [uklada, setUklada] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [varovani, setVarovani] = useState<string | null>(null);

  /** Je vybraný typ reklama? Podle toho se ptáme na jiné datum. */
  const jeReklama = Boolean(form.projectType) && typyReklam.includes(form.projectType);

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
          : k.firma
            ? `${k.jmeno} — ${k.firma}`
            : t('novyProjekt.klientBezFirmy', { jmeno: k.jmeno }),
      /** Lidé vybrané firmy první, teprve pak ti bez firmy. */
      poradi: form.companyId && k.companyId === form.companyId ? 0 : k.companyId ? 1 : 2,
      jmeno: k.jmeno,
    }))
    .sort((a, b) => a.poradi - b.poradi || a.jmeno.localeCompare(b.jmeno, kodJazyka(jazyk)));

  async function odesli(e: React.FormEvent) {
    e.preventDefault();
    setUklada(true);
    setChyba(null);
    setVarovani(null);
    try {
      const telo: Record<string, unknown> = { ...form };
      delete telo.datum;
      // U reklamy je to náš termín dokončení, jinak termín klienta.
      if (jeReklama) telo.endDate = form.datum;
      else telo.releaseDate = form.datum;

      const res = await fetch('/api/admin/projekty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telo),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || t('novyProjekt.nepovedlo'));
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
      setChyba(t('novyProjekt.nepovedlo'));
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
        <AddButton onClick={() => setOtevreno(true)}>{t('novyProjekt.tlacitko')}</AddButton>
      </span>
    );
  }

  return (
    <form
      id={KOTVA_NOVE}
      onSubmit={odesli}
      className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-4 w-full"
    >
      <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">{t('novyProjekt.nadpis')}</h2>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-body text-ink">{t('novyProjekt.nazev')}</span>
        <input
          required
          autoFocus
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder={t('novyProjekt.nazevPriklad')}
          className={tridaPole}
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">{t('novyProjekt.firma')}</span>
          <VyberPole value={form.companyId} onChange={(e) => zmenFirmu(e.target.value)} className={tridaPole}>
            <option value="">{t('novyProjekt.bezFirmy')}</option>
            {firmy.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </VyberPole>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">{t('novyProjekt.klient')}</span>
          <VyberPole
            value={form.klientUserId}
            onChange={(e) => set('klientUserId', e.target.value)}
            className={tridaPole}
          >
            <option value="">{t('novyProjekt.bezKlienta')}</option>
            {klientiKVyberu.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </VyberPole>
          {firma && (
            <span className="text-xs text-muted font-body">
              {t('novyProjekt.nabizimeZFirmy', { firma: firma.label })}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">{t('novyProjekt.typ')}</span>
          <VyberPole
            value={form.projectType}
            onChange={(e) => set('projectType', e.target.value)}
            className={tridaPole}
          >
            <option value="">{t('novyProjekt.bezTypu')}</option>
            {typyProjektu.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </VyberPole>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">{t('novyProjekt.manazer')}</span>
          <VyberPole
            value={form.managerUserId}
            onChange={(e) => set('managerUserId', e.target.value)}
            className={tridaPole}
          >
            <option value="">{t('novyProjekt.bezManazera')}</option>
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
          <span className="text-sm font-body text-ink">{t('novyProjekt.herci')}</span>
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
            <span className="text-sm font-body text-ink">{t('novyProjekt.pocetNs')}</span>
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
          <span className="text-sm font-body text-ink">
            {t(jeReklama ? 'novyProjekt.datumDokonceni' : 'novyProjekt.datumVydani')}
          </span>
          <DatumPole
            value={form.datum}
            onChange={(e) => set('datum', e.target.value)}
            className={tridaPole}
          />
          <span className="text-xs font-body text-muted">
            {t(jeReklama ? 'novyProjekt.datumDokonceniNapoveda' : 'novyProjekt.datumVydaniNapoveda')}
          </span>
        </label>

        {/* Stejna ikona a stejne klikani jako v prehledu i v karte projektu
            (upresneni 18. 9. 2026) - priorita se nikde v portalu nepise slovem. */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">{t('novyProjekt.priorita')}</span>
          <span className="flex items-center gap-3 h-[34px]">
            <VyberPriority
              priorita={(form.priority || null) as ProjectPriority | null}
              onZmena={(v) => set('priority', v)}
              velikost={22}
            />
            <span className="text-xs font-body text-muted">{t('novyProjekt.prioritaNapoveda')}</span>
          </span>
        </div>
      </div>

      <label className="flex flex-col gap-1.5 sm:max-w-sm">
        <span className="text-sm font-body text-ink">{t('novyProjekt.stav')}</span>
        <VyberPole value={form.statusName} onChange={(e) => set('statusName', e.target.value)} className={tridaPole}>
          {/* Hodnota je ČESKÝ název - ukládá se do databáze (dávka 7e). */}
          {STAVY_PROJEKTU.map((s) => (
            <option key={s.nazev} value={s.nazev}>
              {nazevStavu(s.nazev, jazyk)}
            </option>
          ))}
        </VyberPole>
        <span className="text-xs text-muted font-body">{popisStavu(form.statusName, jazyk)}</span>
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
          {t('novyProjekt.zalozitSlozku')}
          <span className="block text-xs text-muted">
            {firma && !firma.maSlozku
              ? t('novyProjekt.firmaBezSlozky', { firma: firma.label })
              : t('novyProjekt.slozkaVznikne')}
          </span>
        </span>
      </label>

      {chyba && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{chyba}</p>}
      {varovani && (
        <p className="text-sm text-ink bg-warnTint border border-line rounded-lg px-3 py-2 m-0">
          {t('novyProjekt.varovaniDisk', {
            chyba: varovani.charAt(0).toLowerCase() + varovani.slice(1),
          })}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={uklada}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          {uklada ? t('novyProjekt.zakladam') : t('novyProjekt.zalozit')}
        </button>
        <button type="button" onClick={() => setOtevreno(false)} className="text-muted text-sm font-heading">
          {t('obecne.zavrit')}
        </button>
      </div>
    </form>
  );
}
