import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { prelozit } from '@/lib/jazyk';
import { casKlienta, platnyHovorOdkaz } from '@/lib/hosteNataceni';
import { CekaciOkno } from './CekaciOkno';

/**
 * ČEKACÍ OKNO PŘED NATÁČENÍM (zadání 10. 10. 2026: „stisknutím na připojit se
 * k natáčení by se mohlo otevřít naše obrandované čekací okno se souhrnem
 * informací a odpočtem").
 *
 * Tlačítko v pozvánce vede sem, ne rovnou do Meetu. Klient tak přistane na
 * NAŠÍ stránce: vidí, že je na správném místě a ve správný čas, má před sebou
 * souhrn (projekt, herec, studio, adresa, parkování) a odpočet do začátku -
 * a teprve odtud se jedním klepnutím připojí.
 *
 * ODKAZ DO HOVORU JE NA STRÁNCE VIDĚT CELÝ, ne schovaný za tlačítkem. Kdyby se
 * cokoli pokazilo (JavaScript, blokované vyskakování), klient ho zkopíruje
 * a otevře si ho sám - nesmí se stát, že kvůli naší mezistránce nedorazí.
 *
 * VEŘEJNÁ STRÁNKA BEZ PŘIHLÁŠENÍ. Chrání ji týž náhodný token jako odkaz
 * „Přidat do kalendáře" (HostNataceni.kalendarToken): host zvenčí nemá účet
 * a odkaz je jediné, co má. Vrací se jen jeho jeden termín.
 */
export const dynamic = 'force-dynamic';

export default async function CekarnaNataceni({ params }: { params: { token: string } }) {
  const host = await prisma.hostNataceni
    .findUnique({
      where: { kalendarToken: params.token },
      select: {
        jazyk: true,
        block: {
          select: {
            start: true,
            end: true,
            title: true,
            actorName: true,
            projectName: true,
            hovorOdkaz: true,
            // Adresa, mapa ani parkování se tu už nevypisují (10. 10. 2026) -
            // kdo je na téhle stránce, připojuje se na dálku a cestu má v pozvánce.
            studio: { select: { timezone: true, hovorOdkaz: true } },
          },
        },
      },
    })
    .catch(() => null);

  if (!host?.block) notFound();

  const b = host.block;
  const jazyk = host.jazyk === 'en' ? 'en' : 'cs';
  const studio = b.studio;

  return (
    <main className="min-h-screen bg-paper">
      <header className="bg-gradient-to-b from-brand-purple to-brand-purpleDeep px-6 sm:px-10 py-6 flex items-center gap-3 sm:gap-4">
        <span className="font-body text-brand-green font-semibold text-2xl sm:text-3xl">Mediaspace</span>
        <span className="w-px h-8 sm:h-10 bg-white/40" aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mediaspace-logo.gif" alt="Mediaspace" className="h-12 sm:h-14 w-auto" />
      </header>
      {/* Zelený pruh jako v hlavičce mailu - klient pozná, že je to totéž. */}
      <div className="h-1 bg-brand-green" aria-hidden="true" />

      <div className="max-w-2xl mx-auto px-6 sm:px-10 py-8 sm:py-12 flex flex-col gap-6">
        <div>
          <p className="text-xs font-heading text-muted uppercase tracking-wide m-0">
            {prelozit(jazyk, 'cekarna.stitek')}
          </p>
          <h1 className="font-display text-3xl sm:text-4xl text-ink m-0 mt-1">
            {b.projectName?.trim() || b.title}
          </h1>
        </div>

        <CekaciOkno
          jazyk={jazyk}
          /* Čas klienta, ne čas z kalendáře - týž, jaký mu přišel v pozvánce. */
          zacatek={casKlienta(b.start).toISOString()}
          konec={b.end.toISOString()}
          pasmo={studio.timezone || 'Europe/Prague'}
          herec={b.actorName}
          hovorOdkaz={platnyHovorOdkaz(b.hovorOdkaz, studio.hovorOdkaz)}
        />
      </div>
    </main>
  );
}
