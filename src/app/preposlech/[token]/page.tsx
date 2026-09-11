import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { nactiPreposlech } from '@/lib/preposlechServer';
import { projektPodleTokenu, zapisOtevreni } from '@/lib/preposlechOdkaz';
import { Preposlech } from '@/app/(portal)/projekty/[id]/Preposlech';

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

export const metadata: Metadata = {
  title: 'Přeposlech nahrávky',
  // Odkaz je sice neuhodnutelny, ale ve vyhledavaci nema co delat.
  robots: { index: false, follow: false },
};

export default async function PreposlechOdkazemPage({ params }: { params: { token: string } }) {
  const caflouProjectId = await projektPodleTokenu(params.token);

  if (!caflouProjectId) {
    return (
      <main className="min-h-screen bg-page flex items-center justify-center p-6">
        <div className="bg-surface rounded-card border border-line shadow-sm max-w-[420px] p-7 text-center">
          <h1 className="font-heading font-semibold text-lg text-ink m-0 mb-2">Odkaz už neplatí</h1>
          <p className="text-sm font-body text-muted m-0">
            Tenhle odkaz na přeposlech byl uzavřený nebo nahrazený novým. Napište nám a pošleme vám
            aktuální.
          </p>
        </div>
      </main>
    );
  }

  const [meta, stav] = await Promise.all([
    prisma.projectMeta
      .findUnique({ where: { caflouProjectId }, select: { name: true } })
      .catch(() => null),
    nactiPreposlech(caflouProjectId),
  ]);

  // Statistika otevreni - at je u projektu videt, jestli si to klient pustil.
  void zapisOtevreni(params.token);

  return (
    <main className="min-h-screen bg-page p-3 sm:p-5">
      <div className="max-w-[1600px] mx-auto">
        <Preposlech
          caflouProjectId={caflouProjectId}
          projectName={meta?.name || 'Nahrávka'}
          pocatecniStav={stav}
          jenPoslech
          token={params.token}
        />
      </div>
    </main>
  );
}
