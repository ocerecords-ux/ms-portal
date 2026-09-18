import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';
import { nactiPripominky, pristupKVideu, seznamSpotu } from '@/lib/reklamaPripominky';
import { projektPodleTokenu, zapisOtevreni } from '@/lib/preposlechOdkaz';
import { stavSchvaleni } from '@/lib/schvaleniKlientem';
import { SchvalitSpot } from '@/components/SchvalitSpot';
import { SpotTagger } from './VideoTagger';

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
  const zadano = searchParams?.soubor?.trim();

  /**
   * Bez `?soubor=` se vezme jediný spot ve složce (zadání 18. 9. 2026:
   * „v 90 % případů tam bude jedna stopa"). Kde jich je víc, vybere si člověk
   * v přepínači nahoře - a odkaz na konkrétní spot pořád funguje.
   */
  const pristupProSeznam = zadano ? await pristupKVideu(params.token, zadano) : null;
  if (pristupProSeznam && 'chyba' in pristupProSeznam) {
    return <Hlaska nadpis="Odkaz nefunguje" text={pristupProSeznam.chyba} />;
  }

  const projektZOdkazu =
    pristupProSeznam && !('chyba' in pristupProSeznam)
      ? pristupProSeznam.caflouProjectId
      : await projektPodleTokenu(params.token);
  if (!projektZOdkazu) {
    return (
      <Hlaska
        nadpis="Odkaz už neplatí"
        text="Tenhle odkaz byl uzavřený nebo nahrazený novým. Napište nám a pošleme vám aktuální."
      />
    );
  }

  const spoty = await seznamSpotu(projektZOdkazu);
  const fileId = zadano || spoty[0]?.id || '';
  if (!fileId) {
    return (
      <Hlaska
        nadpis="Zatím tu není co poslouchat"
        text="Ve složce projektu není žádný spot ani video. Jakmile tam něco přibude, otevřete odkaz znovu."
      />
    );
  }

  const pristup = pristupProSeznam ?? (await pristupKVideu(params.token, fileId));
  if ('chyba' in pristup) {
    return <Hlaska nadpis="Odkaz nefunguje" text={pristup.chyba} />;
  }

  const [meta, pripominky, session, schvaleni] = await Promise.all([
    prisma.projectMeta
      .findUnique({ where: { caflouProjectId: pristup.caflouProjectId }, select: { name: true } })
      .catch(() => null),
    nactiPripominky(pristup.caflouProjectId, pristup.fileId),
    getServerSession(authOptions),
    stavSchvaleni(pristup.caflouProjectId),
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

        {schvaleni.lzeSchvalit && (
          <SchvalitSpot token={params.token} schvalenoAt={schvaleni.schvalenoAt} />
        )}

        <SpotTagger
          token={params.token}
          spoty={
            spoty.length > 0
              ? spoty
              : [
                  {
                    id: pristup.fileId,
                    nazev: pristup.nazev,
                    mimeType: pristup.mimeType,
                    velikost: pristup.velikost,
                    jeVideo: pristup.mimeType.startsWith('video/'),
                  },
                ]
          }
          vybranyId={pristup.fileId}
          pocatecni={pripominky}
          jsemZTymu={jsemZTymu}
        />
      </div>
    </main>
  );
}
