'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * ZAKÁZKY FIRMY: HEREC, NABÍDKA, FAKTURA (zadání 25. 9. 2026: „potřebuji
 * u této firmy na tyto projekty navázat klienta u všech projektů a pak
 * navázat nabídky a faktury. A herce. Vše chci udělat v tichosti bez
 * notifikací").
 *
 * Jedna tabulka se všemi zakázkami firmy a u každé tři výběry. Uloží se
 * jedním tlačítkem a POTICHU - bez zápisu do historie projektu, bez zvonečku
 * a bez e-mailů. U dávno hotových zakázek je to doplnění evidence, ne změna,
 * o které by se měl někdo dozvídat.
 *
 * V nabídce dokladů jsou jen doklady TÉHLE firmy, které ještě zakázku nemají
 * (plus ten, který na zakázce už visí) - aby se nedalo omylem přebrat doklad
 * z jiného projektu.
 */
export type ZakazkaRadek = {
  caflouProjectId: string;
  nazev: string;
  herecId: string | null;
  herecJmeno: string | null;
  typ: string | null;
  nabidka: { id: string; popis: string } | null;
  faktura: { id: string; popis: string } | null;
};

export type DokladVolba = { id: string; popis: string };

export function ZakazkyFirmyPanel({
  companyId,
  zakazky,
  herci,
  typy,
  volneNabidky,
  volneFaktury,
}: {
  companyId: string;
  zakazky: ZakazkaRadek[];
  herci: { id: string; label: string }[];
  /** Typy projektu = položky ceníku (viz lib/projectTypes.ts). */
  typy: string[];
  volneNabidky: DokladVolba[];
  volneFaktury: DokladVolba[];
}) {
  const router = useRouter();
  const prazdno = { herec: '', typ: '', nabidka: '', faktura: '' };
  const [vyber, setVyber] = useState<Record<string, typeof prazdno>>(
    Object.fromEntries(zakazky.map((z) => [z.caflouProjectId, { ...prazdno }])),
  );
  const [bezi, setBezi] = useState(false);
  const [hlaska, setHlaska] = useState<string | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);

  if (zakazky.length === 0) {
    return (
      <p className="text-sm font-body text-muted m-0">U téhle firmy zatím žádná zakázka není.</p>
    );
  }

  function zmen(id: string, pole: 'herec' | 'typ' | 'nabidka' | 'faktura', hodnota: string) {
    setVyber((v) => ({ ...v, [id]: { ...v[id], [pole]: hodnota } }));
    setHlaska(null);
  }

  async function uloz() {
    const radky = zakazky
      .map((z) => ({
        caflouProjectId: z.caflouProjectId,
        actorUserId: vyber[z.caflouProjectId]?.herec || undefined,
        projectType: vyber[z.caflouProjectId]?.typ || undefined,
        offerId: vyber[z.caflouProjectId]?.nabidka || undefined,
        invoiceId: vyber[z.caflouProjectId]?.faktura || undefined,
      }))
      .filter((r) => r.actorUserId || r.projectType || r.offerId || r.invoiceId);

    if (radky.length === 0) {
      setChyba('Nejdřív něco vyberte.');
      return;
    }

    setBezi(true);
    setChyba(null);
    setHlaska(null);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/doplnit-k-zakazkam`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ radky }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || 'Uložení se nepodařilo.');
        return;
      }
      setHlaska(
        `Hotovo — herec u ${data.herci ?? 0}, typ u ${data.typy ?? 0}, nabídka u ${data.nabidky ?? 0} a faktura u ${data.faktury ?? 0} zakázek. Nikomu nic neodešlo.`,
      );
      setVyber(Object.fromEntries(zakazky.map((z) => [z.caflouProjectId, { ...prazdno }])));
      router.refresh();
    } catch {
      setChyba('Uložení se nepodařilo.');
    } finally {
      setBezi(false);
    }
  }

  const pole =
    'rounded-lg border border-line bg-field px-2 py-1.5 text-ink font-heading text-xs outline-none focus:border-brand-purple w-full';

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-4">
      <div>
        <h3 className="font-heading font-semibold text-sm text-ink m-0">
          Doplnit k zakázkám herce, typ a doklady
        </h3>
        <p className="text-xs font-body text-muted m-0 mt-1">
          Uloží se potichu — žádná notifikace, žádný zápis do historie projektu. V nabídce dokladů
          jsou jen nabídky a faktury téhle firmy, které ještě žádnou zakázku nemají.
        </p>
      </div>

      {chyba && <p className="text-sm text-danger m-0">{chyba}</p>}
      {hlaska && <p className="text-sm text-ink m-0">{hlaska}</p>}

      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs font-heading text-muted">
              <th className="py-2 pr-3 font-semibold">Zakázka</th>
              <th className="py-2 pr-3 font-semibold">Herec</th>
              <th className="py-2 pr-3 font-semibold">Typ projektu</th>
              <th className="py-2 pr-3 font-semibold">Nabídka</th>
              <th className="py-2 font-semibold">Faktura</th>
            </tr>
          </thead>
          <tbody>
            {zakazky.map((z) => (
              <tr key={z.caflouProjectId} className="border-t border-line align-top">
                <td className="py-2 pr-3 min-w-[160px]">
                  <span className="block font-heading text-sm text-ink">{z.nazev}</span>
                </td>
                <td className="py-2 pr-3 min-w-[190px]">
                  {z.herecJmeno && (
                    <span className="block text-[11px] font-body text-muted mb-1">
                      teď: {z.herecJmeno}
                    </span>
                  )}
                  <select
                    value={vyber[z.caflouProjectId]?.herec ?? ''}
                    onChange={(e) => zmen(z.caflouProjectId, 'herec', e.target.value)}
                    className={pole}
                  >
                    <option value="">— nechat —</option>
                    <option value="__zadny__">— žádný herec —</option>
                    {herci.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-3 min-w-[200px]">
                  {z.typ && (
                    <span className="block text-[11px] font-body text-muted mb-1">teď: {z.typ}</span>
                  )}
                  <select
                    value={vyber[z.caflouProjectId]?.typ ?? ''}
                    onChange={(e) => zmen(z.caflouProjectId, 'typ', e.target.value)}
                    className={pole}
                  >
                    <option value="">— nechat —</option>
                    {typy.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-3 min-w-[220px]">
                  {z.nabidka && (
                    <span className="block text-[11px] font-body text-muted mb-1">
                      teď: {z.nabidka.popis}
                    </span>
                  )}
                  <select
                    value={vyber[z.caflouProjectId]?.nabidka ?? ''}
                    onChange={(e) => zmen(z.caflouProjectId, 'nabidka', e.target.value)}
                    className={pole}
                  >
                    <option value="">— nechat —</option>
                    {volneNabidky.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.popis}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 min-w-[220px]">
                  {z.faktura && (
                    <span className="block text-[11px] font-body text-muted mb-1">
                      teď: {z.faktura.popis}
                    </span>
                  )}
                  <select
                    value={vyber[z.caflouProjectId]?.faktura ?? ''}
                    onChange={(e) => zmen(z.caflouProjectId, 'faktura', e.target.value)}
                    className={pole}
                  >
                    <option value="">— nechat —</option>
                    {volneFaktury.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.popis}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <button
          type="button"
          onClick={() => void uloz()}
          disabled={bezi}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          {bezi ? 'Ukládám…' : 'Uložit potichu'}
        </button>
      </div>
    </div>
  );
}
