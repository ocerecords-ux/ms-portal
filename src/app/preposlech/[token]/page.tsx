import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { nactiPreposlech } from '@/lib/preposlechServer';
import { projektPodleTokenu, zapisOtevreni } from '@/lib/preposlechOdkaz';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isInternalRole } from '@/lib/roles';
import { posluchacZCookie } from '@/lib/preposlechPristup';
import { Preposlech } from '@/app/(portal)/projekty/[id]/Preposlech';
import { nactiJazyk } from '@/lib/jazykServer';
import { prelozit } from '@/lib/jazyk';
import { JazykProvider } from '@/app/(portal)/components/JazykProvider';
import { PrepinacRezimu } from './PrepinacRezimu';
import { stavSchvaleni } from '@/lib/schvaleniKlientem';
import { SchvalitSpot } from '@/components/SchvalitSpot';

/**
 * Celoobrazovkový přeposlech pro klienta (zadání 11. 9. 2026: „prostě mu
 * pošleme odkaz, poběží to na portálu ale ve fullscreen, klient vlastně ani
 * nebude vědět, kde je").
 *
 * Proto tahle stránka leží MIMO skupinu (portal): nemá horní lištu, boční
 * menu ani panel s chatem — jen AudioTagger přes celou obrazovku. A leží
 * mimo `matcher` v middleware.ts, takže po klientovi nikdo nechce přihlášení;
 * vstupenkou je token v adrese a ten platí do jednoho jediného projektu.
 *
 * Klient smí poslouchat a psát, co mu vadí. Měnit pořadí stop, mazat záznamy
 * ani odškrtnout „přeposlechnuto" nemůže — to hlídá `jenPoslech` tady a
 * podruhé server u každého požadavku (lib/preposlechPristup.ts).
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: prelozit(nactiJazyk(), 'preposlechOdkaz.titulek'),
    // Odkaz je sice neuhodnutelny, ale ve vyhledavaci nema co delat.
    robots: { index: false, follow: false },
  };
}

export default async function PreposlechOdkazemPage({ params }: { params: { token: string } }) {
  const caflouProjectId = await projektPodleTokenu(params.token);
  const jazyk = nactiJazyk();

  if (!caflouProjectId) {
    return (
      <main className="min-h-screen bg-page flex items-center justify-center p-6">
        <div className="bg-surface rounded-card border border-line shadow-sm max-w-[420px] p-7 text-center">
          <h1 className="font-heading font-semibold text-lg text-ink m-0 mb-2">
            {prelozit(jazyk, 'preposlechOdkaz.neplatnyNadpis')}
          </h1>
          <p className="text-sm font-body text-muted m-0">
            {prelozit(jazyk, 'preposlechOdkaz.neplatnyText')}
          </p>
        </div>
      </main>
    );
  }

  const [meta, stav, schvaleni] = await Promise.all([
    prisma.projectMeta
      .findUnique({ where: { caflouProjectId }, select: { name: true } })
      .catch(() => null),
    nactiPreposlech(caflouProjectId),
    /**
     * SCHVÁLIT I ODSUD (oprava 23. 9. 2026: „klient schválil projekt Strabag,
     * ale nikam se to nepropsalo"). Reklamní klient, který dostal odkaz do
     * AudioTaggeru, tu do teď žádné tlačítko neměl - odklepnout spot šlo jen
     * ve složce s nahrávkami nebo v taggeru spotu.
     */
    stavSchvaleni(caflouProjectId),
  ]);

  // Statistika otevreni - at je u projektu videt, jestli si to klient pustil.
  // Od 21. 9. 2026 i KDO - kdo se u prohlizece predstavil e-mailem.
  // Nas clovek na klientove odkazu se do statistiky otevreni nepocita
  // (21. 9. 2026) - klient by jinak „otevrel odkaz", i kdyz to byl Ondrej.
  const session = await getServerSession(authOptions).catch(() => null);
  const interni = Boolean(session?.user?.id && isInternalRole(session.user.role));
  const ja = interni ? null : await posluchacZCookie(caflouProjectId);
  if (!interni) void zapisOtevreni(params.token, ja ? ja.jmeno?.trim() || ja.email : null);

  return (
    <main className="min-h-screen bg-page p-3 sm:p-5">
      <div className="max-w-[1600px] mx-auto">
        {/* Stranka lezi mimo skupinu (portal), takze si jazyk pro komponenty
            v prohlizeci musi rozdat sama (zadani 13. 9. 2026). */}
        <JazykProvider jazyk={jazyk}>
          {schvaleni.lzeSchvalit && (
            <div className="mb-3">
              <SchvalitSpot token={params.token} schvalenoAt={schvaleni.schvalenoAt} />
            </div>
          )}
          {/* Režim pro nevidomé (23. 9. 2026) - přepíná se tlačítkem nahoře. */}
          <PrepinacRezimu
            caflouProjectId={caflouProjectId}
            projectName={meta?.name || prelozit(jazyk, 'preposlechOdkaz.zalohaNazvu')}
            token={params.token}
          >
            <Preposlech
              caflouProjectId={caflouProjectId}
              projectName={meta?.name || prelozit(jazyk, 'preposlechOdkaz.zalohaNazvu')}
              pocatecniStav={stav}
              jenPoslech
              token={params.token}
            />
          </PrepinacRezimu>
        </JazykProvider>
      </div>
    </main>
  );
}
