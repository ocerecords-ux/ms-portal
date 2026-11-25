import { prisma } from '@/lib/db';
import { type Odpovedi } from '@/lib/akce';
import { otazkyAkce } from '@/lib/akceServer';
import { FormularPozvanky } from './FormularPozvanky';

/**
 * POZVÁNKA NA FIREMNÍ AKCI (zadání 25. 11. 2026: „pozvánky na vánoční
 * večírek… krátký text a instrukce a dotazník").
 *
 * Otevřená stránka z odkazu v mailu - bez přihlašování, jako výzvy klientům.
 * Text píše pořadatel ve formuláři; tady se jen vysází.
 *
 * BRANDOVANÁ HLAVIČKA (25. 11. 2026: „mělo by to být víc obrandované").
 * Fialový blok s logem a zeleným nadpisem - stejná řeč jako přihlašovací
 * stránka portálu. Kdo přijde z mailu, má poznat, od koho pozvánka je.
 */
export const dynamic = 'force-dynamic';

function odstavce(text: string) {
  return text
    .split(/\n{2,}/)
    .map((o) => o.trim())
    .filter(Boolean);
}

export default async function StrankaPozvanky({ params }: { params: { token: string } }) {
  const pozvanka = await prisma.pozvankaNaAkci
    .findUnique({
      where: { token: params.token },
      include: { akce: true },
    })
    .catch(() => null);

  if (!pozvanka) {
    return (
      <main className="min-h-screen bg-paper text-ink grid place-items-center p-6">
        <div className="max-w-md text-center">
          <h1 className="font-heading font-bold text-xl mb-2">Odkaz už neplatí</h1>
          <p className="font-body text-sm text-muted">
            Napište nám prosím přímo na e-mail a my to zařídíme.
          </p>
        </div>
      </main>
    );
  }

  const akce = pozvanka.akce;
  const kdy = akce.kdy
    ? new Intl.DateTimeFormat('cs-CZ', {
        timeZone: 'Europe/Prague',
        dateStyle: 'full',
        timeStyle: 'short',
      }).format(akce.kdy)
    : null;
  const doKdy = akce.odpovedDo
    ? new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague', dateStyle: 'long' }).format(
        akce.odpovedDo,
      )
    : null;

  return (
    <main className="min-h-screen bg-paper px-4 py-6 sm:py-10 flex justify-center">
      <div className="w-full max-w-2xl flex flex-col gap-4">
        <div className="rounded-card border border-line bg-surface shadow-sm overflow-hidden">
          {/* Hlavička v barvách portálu - zelená vždycky na fialové. */}
          <div className="bg-gradient-to-b from-brand-purple to-brand-purpleDeep px-6 sm:px-8 pt-7 pb-6 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
              <span className="inline-flex items-center rounded-pill bg-brand-green text-onAccent px-3 py-1 text-[11px] font-heading font-bold uppercase tracking-wide">
                Pozvánka
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mediaspace-logo.gif" alt="Mediaspace" className="h-12 sm:h-14 w-auto" />
            </div>
            <h1 className="font-display text-3xl sm:text-4xl text-brand-green m-0">{akce.nazev}</h1>
            {(kdy || akce.misto) && (
              <p className="font-body text-sm text-white/85 m-0">
                {[kdy, akce.misto].filter(Boolean).join(' · ')}
              </p>
            )}
            <p className="font-body text-xs text-white/70 m-0">pro {pozvanka.jmeno}</p>
          </div>

          <div className="px-6 sm:px-8 py-6 flex flex-col gap-5">
            {akce.text && (
              <div className="flex flex-col gap-3">
                {odstavce(akce.text).map((o, i) => (
                  <p key={i} className="font-body text-sm text-ink m-0 whitespace-pre-line">
                    {o}
                  </p>
                ))}
              </div>
            )}

            <FormularPozvanky
              token={params.token}
              jmeno={pozvanka.jmeno}
              doKdy={doKdy}
              uzOdpovedel={Boolean(pozvanka.odpovedelAt)}
              otazky={otazkyAkce(akce as { otazky?: unknown })}
              puvodni={{
                dorazi: pozvanka.dorazi,
                odpovedi: ((pozvanka.odpovedi ?? {}) as Odpovedi),
              }}
            />
          </div>
        </div>

        <p className="text-center text-xs font-body text-muted m-0">
          Mediaspace · odkaz je jen váš, nikam ho prosím nepřeposílejte.
        </p>
      </div>
    </main>
  );
}
