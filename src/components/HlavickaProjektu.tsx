import Link from 'next/link';
import { StatusPill } from '@/app/(portal)/projekty/shared';
import type { KontextProjektu } from '@/lib/kontextProjektu';
import { prelozit, type Jazyk } from '@/lib/jazyk';

/**
 * HLAVIČKA PROJEKTU NAD DOKLADEM (zadání 7. 10. 2026: „když otevřu nějaký
 * doklad, tak potřebuji být pořád na této stránce a vidět tyto záložky").
 *
 * Doklad zůstává na své stránce, ale tváří se, že je pořád na projektu:
 * nahoře název projektu, stav, firma a tentýž pásek záložek. Kliknutí na
 * záložku vrátí na projekt a otevře ji - `?zalozka=<klíč>` umí ProjectTabs
 * číst od 28. 9. 2026.
 *
 * DOKLADY JSOU AKTIVNÍ ZÁLOŽKA, i když se kouká na jeden konkrétní doklad:
 * z pohledu člověka je pořád v Dokladech projektu, jen o patro hlouběji.
 *
 * Vykresluje se jen tomu, kdo na doklad přišel z projektu (`?projekt=`);
 * kdo si ho otevřel ze seznamu v sekci Doklady, žádnou hlavičku nedostane -
 * k projektu ho pustí odkaz v lince historie pod ní.
 */
export function HlavickaProjektu({
  kontext,
  jazyk,
}: {
  kontext: KontextProjektu;
  jazyk: Jazyk;
}) {
  const odkaz = (klic: string) =>
    `/projekty/${encodeURIComponent(kontext.caflouProjectId)}${
      klic === 'prehled' ? '' : `?zalozka=${klic}`
    }`;

  return (
    <div data-kontext-projektu className="flex flex-col gap-3">
      <div>
        <Link
          href={`/projekty/${encodeURIComponent(kontext.caflouProjectId)}`}
          className="font-heading text-sm text-muted no-underline hover:text-brand-purple"
        >
          {prelozit(jazyk, 'drobecky.naProjekt')}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="m-0 font-display text-2xl text-ink sm:text-3xl">{kontext.nazev}</h1>
          {kontext.statusName && (
            <StatusPill finished={kontext.finished} statusName={kontext.statusName} jazyk={jazyk} />
          )}
        </div>
        {kontext.firma && <p className="m-0 mt-1 font-body text-sm text-muted">{kontext.firma}</p>}
      </div>

      {/* Pásek vypadá i chová se jako na projektu, jen jsou to odkazy -
          obsah záložky se vykresluje na projektu, ne tady. */}
      <nav className="flex flex-wrap items-center gap-1 border-b border-line">
        {kontext.zalozky.map((z) => {
          const aktivni = z.klic === 'doklady';
          return (
            <Link
              key={z.klic}
              href={odkaz(z.klic)}
              aria-current={aktivni ? 'page' : undefined}
              className={`-mb-px rounded-t-lg border border-b-0 px-4 py-2.5 font-heading text-sm font-semibold no-underline transition-colors ${
                aktivni
                  ? 'border-line bg-surface text-brand-purple'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {z.nazev}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
