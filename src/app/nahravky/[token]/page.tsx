import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { extractDriveFolderId } from '@/lib/googleDrive';
import { projektPodleTokenu, zapisOtevreni } from '@/lib/preposlechOdkaz';
import { jeReklamniKlient } from '@/lib/reklamaPripominky';
import { stavSchvaleni } from '@/lib/schvaleniKlientem';
import { SchvalitSpot } from '@/components/SchvalitSpot';
import { DriveBrowser } from '@/app/(portal)/nahravky/DriveBrowser';

/**
 * Nahrávky projektu bez přihlašování (zadání 11. 9. 2026: „potřebuju, ať se
 * klient nemusí přihlašovat a jsou ty odkazy otevřené, mnohdy to někomu
 * posílá").
 *
 * Stejná logika jako u přeposlechu: stránka leží MIMO skupinu (portal) — bez
 * horní lišty, menu a chatu — a MIMO `matcher` v middleware.ts, takže po
 * nikom nechce přihlášení. Vstupenkou je token v adrese, ten patří jednomu
 * jedinému projektu a pouští jen do jeho složky. Je to ten samý token jako
 * u AudioTaggeru, takže „Vygenerovat nový" u projektu zavře obojí naráz.
 *
 * Klient tu jen kouká a stahuje; přejmenovat soubor nemůže (`jenCteni`)
 * a server to hlídá podruhé.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Nahrávky',
  // Odkaz je sice neuhodnutelny, ale ve vyhledavaci nema co delat.
  robots: { index: false, follow: false },
};

function Hlaska({ nadpis, text }: { nadpis: string; text: string }) {
  return (
    <main className="min-h-screen bg-page flex items-center justify-center p-6">
      <div className="bg-surface rounded-card border border-line shadow-sm max-w-[420px] p-7 text-center">
        <h1 className="font-heading font-semibold text-lg text-ink m-0 mb-2">{nadpis}</h1>
        <p className="text-sm font-body text-muted m-0">{text}</p>
      </div>
    </main>
  );
}

export default async function NahravkyOdkazemPage({
  params,
  searchParams,
}: {
  params: { token: string };
  /** `?schvalit=1` z mailu - karta schválení se zvýrazní. */
  searchParams?: { schvalit?: string };
}) {
  const caflouProjectId = await projektPodleTokenu(params.token);

  if (!caflouProjectId) {
    return (
      <Hlaska
        nadpis="Odkaz už neplatí"
        text="Tenhle odkaz na nahrávky byl uzavřený nebo nahrazený novým. Napište nám a pošleme vám aktuální."
      />
    );
  }

  const [meta, reklama] = await Promise.all([
    prisma.projectMeta
      .findUnique({ where: { caflouProjectId }, select: { name: true, driveUrl: true } })
      .catch(() => null),
    /**
     * Reklamnímu klientovi se u videa nabízí připomínkování (zadání
     * 18. 9. 2026). Rozhoduje zaškrtávátko Druh zakázek ▸ Reklamy na kartě
     * firmy, ne typ projektu - tak si to zadavatel vybral.
     */
    jeReklamniKlient(caflouProjectId),
  ]);

  // Schvalovaci karta - jen u reklamniho klienta (zadani 18. 9. 2026).
  const schvaleni = reklama ? await stavSchvaleni(caflouProjectId) : null;

  const folderId = meta?.driveUrl ? extractDriveFolderId(meta.driveUrl) : null;
  const driveConfigured = Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  );

  if (!folderId || !driveConfigured) {
    return (
      <Hlaska
        nadpis="Nahrávky tu zatím nejsou"
        text="U tohohle projektu ještě není složka s nahrávkami. Ozvěte se nám, prosím."
      />
    );
  }

  // Statistika otevreni - at je u projektu videt, ze si to klient pustil.
  void zapisOtevreni(params.token);

  return (
    <main className="min-h-screen bg-page p-3 sm:p-6">
      <div className="max-w-[1280px] mx-auto flex flex-col gap-4">
        <div className="bg-brand-purple text-white rounded-card px-4 py-2.5 flex items-center gap-3 flex-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mediaspace-logo-still.png" alt="Mediaspace" className="h-7 w-auto shrink-0" />
          <span className="w-px h-6 bg-white/30 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <h1 className="font-heading font-semibold text-sm uppercase tracking-wide m-0">Nahrávky</h1>
            <p className="text-[11px] font-body text-white/70 m-0 truncate">{meta?.name || 'Projekt'}</p>
          </div>
        </div>

        {schvaleni?.lzeSchvalit && (
          <SchvalitSpot
            token={params.token}
            schvalenoAt={schvaleni.schvalenoAt}
            zvyraznit={searchParams?.schvalit === '1'}
          />
        )}

        <DriveBrowser
          initialFolderId={folderId}
          rootName={meta?.name || 'Nahrávky'}
          token={params.token}
          jenCteni
          odkazPripominek={reklama ? `/pripominkovat/${encodeURIComponent(params.token)}` : null}
        />
      </div>
    </main>
  );
}
