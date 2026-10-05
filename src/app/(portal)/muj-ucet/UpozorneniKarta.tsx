'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePreklad } from '../components/JazykProvider';

/**
 * Co má klientovi z portálu chodit — v jeho profilu (zadání 16. 9. 2026:
 * „klienti by měli mít možnost si to pak zapnout v portálu individuálně").
 *
 * Nastavuje se to i na kartě uživatele v administraci, ale tam to zapíná
 * někdo od nás. Tady si to klient přepne sám, a hlavně sám vypne — upozornění,
 * které se dá zrušit jedině telefonátem do studia, se čte jako spam.
 *
 * Ukládá se hned při přepnutí, bez tlačítka: jsou to zaškrtávátka a čekání na
 * „Uložit" by u nich byl jen krok navíc.
 *
 * PŘEPÍNAČŮ BUDE VÍC (1. 10. 2026: „jeste dej klientovi moznost nastaveni
 * notifikace pri zmene terminu nataceci frekvence"), proto je karta napsaná na
 * seznam a ne na jeden přepínač. Další se přidá řádkem v `PREPINACE` a polem
 * v /api/me/upozorneni — nikam jinam se nesahá.
 *
 * KARTU MÁ UŽ I TÝM (připomínka Heleny 5. 10. 2026: „potřebuju dostávat mailem
 * notifikace o vyplnění termínů" — poslala ji z „Můj účet", kde si to chtěla
 * zapnout a nenašla to). Přepínače se nemíchají: `komu` vybere, které se
 * ukážou. Klientské nesou jen jeho projekty, týmové všechny.
 */

type Klic = 'dotoceno' | 'zmenaTerminu' | 'tymVyberTerminu' | 'tymDotoceno';

/** Komu přepínač patří - klientovi, nebo nám. */
type Komu = 'KLIENT' | 'TYM';

/** Pole v databázi a texty ke každému přepínači. */
const PREPINACE: { klic: Klic; komu: Komu; pole: string; nazev: string; popis: string }[] = [
  {
    klic: 'dotoceno',
    komu: 'KLIENT',
    pole: 'dostavaDotocenoKlient',
    nazev: 'mujUcet.dotoceno',
    popis: 'mujUcet.dotocenoPopis',
  },
  {
    klic: 'zmenaTerminu',
    komu: 'KLIENT',
    pole: 'dostavaZmenuTerminuKlient',
    nazev: 'mujUcet.zmenaTerminu',
    popis: 'mujUcet.zmenaTerminuPopis',
  },
  {
    klic: 'tymVyberTerminu',
    komu: 'TYM',
    pole: 'dostavaVyberTerminu',
    nazev: 'mujUcet.vyberTerminu',
    popis: 'mujUcet.vyberTerminuPopis',
  },
  {
    klic: 'tymDotoceno',
    komu: 'TYM',
    pole: 'dostavaDotoceno',
    nazev: 'mujUcet.tymDotoceno',
    popis: 'mujUcet.tymDotocenoPopis',
  },
];

export function UpozorneniKarta({
  komu,
  initial,
}: {
  komu: Komu;
  /** Jen přepínače dané skupiny; co nepřijde, je vypnuté. */
  initial: Partial<Record<Klic, boolean>>;
}) {
  const t = usePreklad();
  const router = useRouter();
  /** Přepínače téhle skupiny - ostatní se na kartě vůbec neukážou. */
  const nase = PREPINACE.filter((p) => p.komu === komu);
  const [stav, setStav] = useState<Record<Klic, boolean>>(
    () =>
      Object.fromEntries(PREPINACE.map((p) => [p.klic, initial[p.klic] ?? false])) as Record<Klic, boolean>,
  );
  const [uklada, setUklada] = useState<Klic | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function uloz(prepinac: (typeof PREPINACE)[number], hodnota: boolean) {
    // Prepinac se posune hned, at to nedrha. Kdyz ulozeni selze, vrati se
    // zpatky - jinak by na obrazovce zustal stav, ktery nikde neplati.
    // Pretypovani: klic je union ('dotoceno' | 'zmenaTerminu') a pocitany
    // klic v objektovem literalu z nej sam Record nesestavi.
    setStav((p) => ({ ...p, [prepinac.klic]: hodnota }) as Record<Klic, boolean>);
    setUklada(prepinac.klic);
    setError(null);
    try {
      const res = await fetch('/api/me/upozorneni', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [prepinac.pole]: hodnota }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || t('mujUcet.chybaUlozeni'));
        setStav((p) => ({ ...p, [prepinac.klic]: !hodnota }) as Record<Klic, boolean>);
        return;
      }
      router.refresh();
    } catch {
      setError(t('mujUcet.chybaUlozeni'));
      setStav((p) => ({ ...p, [prepinac.klic]: !hodnota }) as Record<Klic, boolean>);
    } finally {
      setUklada(null);
    }
  }

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-4">
      <div>
        <h2 className="font-heading font-semibold text-ink m-0">{t('mujUcet.upozorneni')}</h2>
        <p className="text-sm font-body text-muted m-0 mt-1">
          {t(komu === 'TYM' ? 'mujUcet.upozorneniPopisTym' : 'mujUcet.upozorneniPopis')}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {nase.map((p) => (
          <label key={p.klic} className="flex items-start gap-2 text-sm font-heading text-ink">
            <input
              type="checkbox"
              checked={stav[p.klic]}
              disabled={uklada !== null}
              onChange={(e) => void uloz(p, e.target.checked)}
              className="mt-0.5"
            />
            <span>
              {t(p.nazev)}
              <br />
              <span className="text-xs font-body text-muted">{t(p.popis)}</span>
            </span>
          </label>
        ))}
      </div>

      {error && <p className="text-sm text-danger m-0">{error}</p>}
    </div>
  );
}
