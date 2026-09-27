'use client';

import { TlacitkoSmazat } from '@/components/TlacitkoSmazat';
import { useState } from 'react';
import { useRazeni, ThRadit } from '@/app/(portal)/components/RaditelnaTabulka';
import { useRouter } from 'next/navigation';
import { AddButton } from '@/components/AddButton';
import { VyberIkony } from './VyberIkony';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';
import { kodJazyka, type Jazyk } from '@/lib/jazyk';

type Item = {
  id: string;
  name: string;
  priceExVat: number | null;
  priceIncVat: number | null;
  active: boolean;
  /** Rádiový spot - jen u něj se vyrábí Rodný list. */
  rodnyList: boolean;
  /** Typ, který dostane projekt založený z objednávky audioknihy. */
  proObjednavkyAudioknih: boolean;
  /** Ikona, která svítí před názvem projektu (zadání 10. 9. 2026). */
  ikona: string | null;
};

// Cisla se formatuji podle jazyka listy (1 234 vs. 1,234), mena zustava Kc -
// cenik je vedeny v korunach.
function formatPrice(jazyk: Jazyk, value: number | null): string {
  return value == null ? '—' : `${value.toLocaleString(kodJazyka(jazyk))} Kč`;
}

export function PriceListEditor({ items }: { items: Item[] }) {
  const t = usePreklad();
  const jazyk = useJazyk();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', priceExVat: '', priceIncVat: '' });
  const [newItem, setNewItem] = useState({ name: '', priceExVat: '', priceIncVat: '', rodnyList: false, ikona: '' });

  /**
   * Typ projektu pro objednané audioknihy (zadání 15. 9. 2026). Je to výběr
   * JEDNÉ položky, ne příznak u každé - proto jeden rozbalovací seznam nad
   * tabulkou a ne další sloupec „Ano/Ne". Server zhasne zaškrtnutí u ostatních,
   * takže tu nemůžou vzniknout dva rovnocenné typy.
   */
  const proAudioknihy = items.find((i) => i.proObjednavkyAudioknih)?.id ?? '';

  // Razeni kliknutim na nazev sloupce (zadani 9. 9. 2026). Vychozi je podle
  // nazvu - cenik se cte jako seznam, ne jako poradi.
  const { razeni, prepni, serad } = useRazeni<Item>({ key: 'polozka' });
  const serazene = serad(items, {
    polozka: (i) => i.name,
    bezDph: (i) => i.priceExVat,
    sDph: (i) => i.priceIncVat,
    // V nabidce napred pri vzestupnem razeni.
    vNabidce: (i) => (i.active ? 0 : 1),
    rodnyList: (i) => (i.rodnyList ? 0 : 1),
  });

  async function send(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || t('cenik.ulozeniSelhalo'));
        return null;
      }
      router.refresh();
      return data;
    } catch {
      setError(t('cenik.ulozeniSelhalo'));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const created = await send('/api/admin/pricelist', 'POST', newItem);
    if (created) setNewItem({ name: '', priceExVat: '', priceIncVat: '', rodnyList: false, ikona: '' });
  }

  function startEdit(item: Item) {
    setEditingId(item.id);
    setDraft({
      name: item.name,
      priceExVat: item.priceExVat != null ? String(item.priceExVat) : '',
      priceIncVat: item.priceIncVat != null ? String(item.priceIncVat) : '',
    });
  }

  async function saveEdit(id: string) {
    const saved = await send(`/api/admin/pricelist/${id}`, 'PATCH', draft);
    if (saved) setEditingId(null);
  }

  async function removeItem(item: Item) {
    const result = await send(`/api/admin/pricelist/${item.id}`, 'DELETE');
    if (result?.deactivatedInsteadOfDeleted) {
      /**
       * Rovnou JMENOVAT projekty, které položku drží (zadání 15. 9. 2026:
       * „nejde mi smazat Zvuková postprodukce, přitom u žádného projektu
       * není"). Samotný počet se nedal ověřit — člověk by musel projít
       * všechny projekty a hádat, který to je.
       */
      const projekty: { id: string; name: string }[] = result.projekty ?? [];
      const jmena = projekty.slice(0, 3).map((p) => p.name).join(', ');
      const kdo =
        projekty.length === 0
          ? t('cenik.drziJiPocet', { pocet: result.usedByProjects })
          : projekty.length === 1
            ? t('cenik.drziJiJeden', { jmena })
            : projekty.length <= 4
              ? t('cenik.drziJiVic', { jmena })
              : t('cenik.drziJiVicNezVypis', {
                  pocet: projekty.length,
                  jmena,
                  dalsi: projekty.length - 3,
                });
      setNote(t('cenik.jenVyrazeno', { nazev: item.name, kdo }));
    }
  }

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full';

  return (
    <div className="flex flex-col gap-6">
      {/* Co dostane projekt z objednávky audioknihy. Bez toho se u projektu
          nespočítá rozpočet - typ určuje frekvence, střih i bonus. */}
      <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-2">
        <span className="font-heading font-semibold text-sm text-ink">
          {t('cenik.typZObjednavky')}
        </span>
        <select
          value={proAudioknihy}
          disabled={busy}
          onChange={(e) => {
            const id = e.target.value;
            if (!id) return;
            void send(`/api/admin/pricelist/${id}`, 'PATCH', { proObjednavkyAudioknih: true });
          }}
          className="rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple max-w-md"
        >
          <option value="">{t('cenik.zatimNevybrano')}</option>
          {items
            .filter((i) => i.active)
            .map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
        </select>
        <span className="text-xs font-body text-muted">{t('cenik.typZObjednavkyPopis')}</span>
      </div>

      <div className="bg-surface rounded-card border border-line overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="bg-bar text-white font-heading text-xs">
                {/* Ikona typu projektu (zadani 10. 9. 2026) - bez razeni,
                    radit seznam podle obrazku nedava smysl. */}
                <th className="text-left px-4 py-3 font-heading" title={t('cenik.sl.ikonaTitle')}>
                  {t('cenik.sl.ikona')}
                </th>
                <ThRadit label={t('cenik.sl.polozka')} sloupec="polozka" razeni={razeni} prepni={prepni} jazyk={jazyk} />
                <ThRadit label={t('cenik.sl.bezDph')} sloupec="bezDph" razeni={razeni} prepni={prepni} vpravo jazyk={jazyk} />
                <ThRadit label={t('cenik.sl.sDph')} sloupec="sDph" razeni={razeni} prepni={prepni} vpravo jazyk={jazyk} />
                <ThRadit label={t('cenik.sl.vNabidce')} sloupec="vNabidce" razeni={razeni} prepni={prepni} jazyk={jazyk} />
                <ThRadit
                  label={t('cenik.sl.rodnyList')}
                  sloupec="rodnyList"
                  razeni={razeni}
                  prepni={prepni}
                  title={t('cenik.sl.rodnyListTitle')}
                  jazyk={jazyk}
                />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted text-sm font-body">
                    {t('cenik.prazdnyCenik')}
                  </td>
                </tr>
              )}
              {serazene.map((item) =>
                editingId === item.id ? (
                  <tr key={item.id} className="border-t border-line bg-surfaceSoft">
                    <td className="px-4 py-3">
                      <VyberIkony
                        hodnota={item.ikona}
                        disabled={busy}
                        onZmena={(ikona) => send(`/api/admin/pricelist/${item.id}`, 'PATCH', { ikona })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        className={inputClass}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        inputMode="numeric"
                        value={draft.priceExVat}
                        onChange={(e) => setDraft({ ...draft, priceExVat: e.target.value })}
                        className={`${inputClass} text-right`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        inputMode="numeric"
                        value={draft.priceIncVat}
                        onChange={(e) => setDraft({ ...draft, priceIncVat: e.target.value })}
                        className={`${inputClass} text-right`}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm font-heading text-muted">
                      {t(item.active ? 'obecne.ano' : 'obecne.ne')}
                    </td>
                    <td className="px-4 py-3 text-sm font-heading text-muted">
                      {t(item.rodnyList ? 'obecne.ano' : 'obecne.ne')}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => saveEdit(item.id)}
                          disabled={busy}
                          className="bg-brand-purple text-white font-heading font-semibold text-xs rounded-lg px-3 py-1.5 disabled:opacity-60"
                        >
                          {t('obecne.ulozit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="text-muted text-xs font-heading"
                        >
                          {t('obecne.zrusit')}
                        </button>
                      </span>
                    </td>
                  </tr>
                ) : (
                  <tr key={item.id} className="border-t border-line hover:bg-surfaceSoft">
                    <td className="px-4 py-3">
                      <VyberIkony
                        hodnota={item.ikona}
                        disabled={busy}
                        onZmena={(ikona) => send(`/api/admin/pricelist/${item.id}`, 'PATCH', { ikona })}
                      />
                    </td>
                    <td className="px-4 py-3.5 font-heading font-semibold text-sm">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        title={t('cenik.upravitPolozku')}
                        className={`text-left hover:text-brand-purple hover:underline ${
                          item.active ? 'text-ink' : 'text-muted line-through'
                        }`}
                      >
                        {item.name}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-heading tabular-nums text-right whitespace-nowrap">
                      {formatPrice(jazyk, item.priceExVat)}
                    </td>
                    <td className="px-4 py-3.5 text-sm font-heading tabular-nums text-right whitespace-nowrap">
                      {formatPrice(jazyk, item.priceIncVat)}
                    </td>
                    <td className="px-4 py-3.5 text-sm font-heading">
                      <button
                        type="button"
                        onClick={() => send(`/api/admin/pricelist/${item.id}`, 'PATCH', { active: !item.active })}
                        disabled={busy}
                        className={item.active ? 'text-brand-greenDeep' : 'text-muted'}
                      >
                        {t(item.active ? 'obecne.ano' : 'obecne.ne')}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-heading">
                      <button
                        type="button"
                        onClick={() => send(`/api/admin/pricelist/${item.id}`, 'PATCH', { rodnyList: !item.rodnyList })}
                        disabled={busy}
                        title={t('cenik.rodnyListPrepinacTitle')}
                        className={item.rodnyList ? 'text-brand-greenDeep' : 'text-muted'}
                      >
                        {t(item.rodnyList ? 'obecne.ano' : 'obecne.ne')}
                      </button>
                    </td>
                    {/* Tlacitko Upravit tu bylo zbytecne (zadani 9. 9. 2026) -
                        polozka se upravuje kliknutim na nazev, stejne jako
                        uzivatel v seznamu uzivatelu. */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <TlacitkoSmazat
                        onSmazat={() => removeItem(item)}
                        disabled={busy}
                        otazka={t('cenik.opravduSmazatPolozku')}
                      />
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>

      {error && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{error}</p>}
      {note && <p className="text-sm text-ink bg-tint border border-line rounded-lg px-3 py-2 m-0">{note}</p>}

      <form onSubmit={addItem} className="bg-surface rounded-card border border-line shadow-sm p-6 flex flex-col gap-4 max-w-3xl">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          {t('cenik.pridatPolozku')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr] gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{t('cenik.sl.polozka')}</span>
            <span className="flex items-center gap-2">
              <VyberIkony
                hodnota={newItem.ikona || null}
                onZmena={(ikona) => setNewItem({ ...newItem, ikona })}
              />
              <input
                required
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                placeholder={t('cenik.polozkaPriklad')}
                className={inputClass}
              />
            </span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{t('cenik.sl.bezDph')}</span>
            <input
              inputMode="numeric"
              value={newItem.priceExVat}
              onChange={(e) => setNewItem({ ...newItem, priceExVat: e.target.value })}
              className={`${inputClass} text-right`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{t('cenik.sl.sDph')}</span>
            <input
              inputMode="numeric"
              value={newItem.priceIncVat}
              onChange={(e) => setNewItem({ ...newItem, priceIncVat: e.target.value })}
              placeholder={t('cenik.dopocitame')}
              className={`${inputClass} text-right`}
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm font-heading text-ink">
          <input
            type="checkbox"
            checked={newItem.rodnyList}
            onChange={(e) => setNewItem({ ...newItem, rodnyList: e.target.checked })}
          />
          {t('cenik.radiovySpot')}
        </label>
        <div>
          <AddButton type="submit" disabled={busy}>
            {t('cenik.pridatDoCeniku')}
          </AddButton>
        </div>
      </form>
    </div>
  );
}
