'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { VyberPole } from '@/components/VyberPole';

/**
 * Výběr nad přehledem obratu - všechno v jedné řadě a v adrese, ať jde
 * výběr poslat odkazem a tlačítko Zpět vrací předchozí výběr.
 */
export function FinanceFiltry({
  obdobi,
  roky,
  firma,
  firmy,
  zaklad,
  krok,
}: {
  obdobi: string;
  roky: number[];
  firma: string;
  firmy: { id: string; name: string }[];
  zaklad: 'vystaveno' | 'uhrazeno';
  krok: 'mesic' | 'ctvrtleti';
}) {
  const router = useRouter();
  const cesta = usePathname();
  const parametry = useSearchParams();

  const adresa = (zmena: Record<string, string>) => {
    const p = new URLSearchParams(parametry?.toString() ?? '');
    for (const [k, v] of Object.entries(zmena)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const q = p.toString();
    return q ? `${cesta}?${q}` : cesta;
  };

  const pole =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple min-w-[170px]';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <VyberPole
        aria-label="Období"
        value={obdobi}
        onChange={(e) => router.push(adresa({ obdobi: e.target.value }))}
        className={pole}
      >
        <option value="12m">Posledních 12 měsíců</option>
        {roky.map((r) => (
          <option key={r} value={String(r)}>
            Rok {r}
          </option>
        ))}
      </VyberPole>

      {firmy.length > 1 && (
        <VyberPole
          aria-label="Firma"
          value={firma}
          onChange={(e) => router.push(adresa({ firma: e.target.value }))}
          className={pole}
        >
          <option value="">Všechny firmy</option>
          {firmy.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </VyberPole>
      )}

      <Prepinac
        volby={[
          { hodnota: 'vystaveno', popis: 'Vystaveno', title: 'Faktury a výdaje podle data dokladu' },
          { hodnota: 'uhrazeno', popis: 'Uhrazeno', title: 'Jen peníze, které opravdu přišly a odešly' },
        ]}
        aktivni={zaklad}
        odkaz={(v) => adresa({ zaklad: v === 'vystaveno' ? '' : v })}
      />
      <Prepinac
        volby={[
          { hodnota: 'mesic', popis: 'Měsíce' },
          { hodnota: 'ctvrtleti', popis: 'Čtvrtletí' },
        ]}
        aktivni={krok}
        odkaz={(v) => adresa({ krok: v === 'mesic' ? '' : v })}
      />
    </div>
  );
}

function Prepinac({
  volby,
  aktivni,
  odkaz,
}: {
  volby: { hodnota: string; popis: string; title?: string }[];
  aktivni: string;
  odkaz: (hodnota: string) => string;
}) {
  return (
    <span className="inline-flex rounded-lg border border-line overflow-hidden">
      {volby.map((v, i) => (
        <Link
          key={v.hodnota}
          href={odkaz(v.hodnota)}
          title={v.title}
          aria-current={aktivni === v.hodnota ? 'true' : undefined}
          className={`px-3.5 py-2 text-sm font-heading font-semibold no-underline transition-colors ${
            i > 0 ? 'border-l border-line' : ''
          } ${aktivni === v.hodnota ? 'bg-brand-purple text-white' : 'bg-surface text-muted hover:text-ink'}`}
        >
          {v.popis}
        </Link>
      ))}
    </span>
  );
}
