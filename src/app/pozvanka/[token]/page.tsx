import { prisma } from '@/lib/db';
import { ocistiOtazky, type Odpovedi } from '@/lib/akce';
import { FormularPozvanky } from './FormularPozvanky';

/**
 * POZVÁNKA NA FIREMNÍ AKCI (zadání 25. 11. 2026: „pozvánky na vánoční
 * večírek… krátký text a instrukce a dotazník").
 *
 * Otevřená stránka z odkazu v mailu - bez přihlašování, jako výzvy klientům.
 * Text píše pořadatel ve formuláři; tady se jen vysází.
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
    <main className="min-h-screen bg-paper text-ink p-6 grid place-items-start sm:place-items-center">
      <div className="w-full max-w-xl bg-surface border border-line rounded-card p-6 sm:p-8 flex flex-col gap-5">
        <div>
          <span className="inline-block rounded-pill bg-brand-purple/10 text-brand-purple font-heading font-semibold text-[11px] uppercase tracking-wide px-2.5 py-1">
            Pozvánka
          </span>
          <h1 className="font-display text-2xl sm:text-3xl text-ink m-0 mt-2">{akce.nazev}</h1>
          <p className="font-body text-sm text-muted m-0 mt-1">
            {[kdy, akce.misto].filter(Boolean).join(' · ')}
          </p>
        </div>

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
          otazky={ocistiOtazky(akce.otazky ?? [])}
          puvodni={{
            dorazi: pozvanka.dorazi,
            odpovedi: ((pozvanka.odpovedi ?? {}) as Odpovedi),
          }}
        />
      </div>
    </main>
  );
}
