import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';
import { nactiPripominky, pristupKVideu } from '@/lib/reklamaPripominky';
import { zapisOtevreni } from '@/lib/preposlechOdkaz';
import { VideoTagger } from './VideoTagger';

/**
 * PŘIPOMÍNKOVÁNÍ REKLAMNÍHO SPOTU (zadání 18. 9. 2026).
 *
 * Stejná pravidla jako u nahrávek a přeposlechu: stránka leží MIMO skupinu
 * (portal) i mimo `matcher` v middleware.ts, takže po nikom nechce přihlášení.
 * Vstupenkou je token projektu, soubor se ověřuje proti složce toho projektu.
 *
 * Adresa je `/pripominkovat/<token>?soubor=<ID souboru na Disku>` - tlačítko
 * u videa v nahrávkách ji skládá samo.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Připomínkování spotu',
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

export default async function PripominkovatPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams?: { soubor?: string };
}) {
  const fileId = searchParams?.soubor?.trim();
  if (!fileId) {
    return (
      <Hlaska
        nadpis="Chybí video"
        text="Tenhle odkaz neříká, ke kterému souboru se má připomínkovat. Otevřete ho prosím znovu z přehledu nahrávek."
      />
    );
  }

  const pristup = await pristupKVideu(params.token, fileId);
  if ('chyba' in pristup) {
    return <Hlaska nadpis="Odkaz nefunguje" text={pristup.chyba} />;
  }

  const [meta, pripominky, session] = await Promise.all([
    prisma.projectMeta
      .findUnique({ where: { caflouProjectId: pristup.caflouProjectId }, select: { name: true } })
      .catch(() => null),
    nactiPripominky(pristup.caflouProjectId, pristup.fileId),
    getServerSession(authOptions),
  ]);

  // Statistika otevreni - u projektu je pak videt, ze si to klient pustil.
  void zapisOtevreni(params.token);

  const jsemZTymu = Boolean(session?.user?.id && isInternalRole(session.user.role));

  return (
    <main className="min-h-screen bg-page p-3 sm:p-6">
      <div className="max-w-[1400px] mx-auto flex flex-col gap-4">
        <div className="bg-brand-purple text-white rounded-card px-4 py-2.5 flex items-center gap-3 flex-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mediaspace-logo-still.png" alt="Mediaspace" className="h-7 w-auto shrink-0" />
          <span className="w-px h-6 bg-white/30 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <span className="block font-heading font-semibold text-sm leading-tight">
              PŘIPOMÍNKOVÁNÍ SPOTU
            </span>
            <span className="block text-xs text-white/80 leading-tight truncate">
              {meta?.name?.trim() || pristup.nazev}
            </span>
          </div>
        </div>

        <VideoTagger
          token={params.token}
          fileId={pristup.fileId}
          nazev={pristup.nazev}
          velikost={pristup.velikost}
          pocatecni={pripominky}
          jsemZTymu={jsemZTymu}
        />
      </div>
    </main>
  );
}
