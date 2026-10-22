import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { projektPodleTokenu, zapisOtevreni } from '@/lib/preposlechOdkaz';
import { VyberHerceKlientem } from './VyberHerceKlientem';
import { nactiJazyk } from '@/lib/jazykServer';
import { ukazkyKNavrhum } from '@/lib/ukazkyHercuServer';

/**
 * VÝBĚR HERCE KLIENTEM (zadání 22. 10. 2026: „uděláme tlačítko odeslat návrhy
 * na klienta a může kliknout na vybrat. Když vybere, tak nám to zahlásí
 * zvonek a zůstane tam jen ten návrh v okně návrhů").
 *
 * Stejná pravidla jako u připomínkování a nahrávek: stránka leží MIMO skupinu
 * (portal) i mimo `matcher` v middleware.ts, takže po nikom nechce přihlášení.
 * Vstupenkou je token projektu - tentýž, jakým se otevírají nahrávky.
 *
 * KLIENT VIDÍ JEN JMÉNA. Naše poznámky u návrhů („záloha, kdyby nevyšel
 * termín") jsou interní a na tuhle stránku se nedostanou.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Výběr herce',
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

export default async function NavrhyPage({ params }: { params: { token: string } }) {
  const jazyk = nactiJazyk();
  const en = jazyk === 'en';
  const caflouProjectId = await projektPodleTokenu(params.token);

  if (!caflouProjectId) {
    return (
      <Hlaska
        nadpis={en ? 'The link no longer works' : 'Odkaz už neplatí'}
        text={
          en
            ? 'Ask us for a new one - we will send it right away.'
            : 'Napište nám o nový, hned vám ho pošleme.'
        }
      />
    );
  }

  const [projekt, navrhy] = await Promise.all([
    prisma.projectMeta
      .findUnique({ where: { caflouProjectId }, select: { name: true } })
      .catch(() => null),
    prisma.navrhHerce
      .findMany({
        where: { caflouProjectId, odeslanoKlientoviAt: { not: null } },
        orderBy: [{ poradi: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          userId: true,
          jmeno: true,
          preferovany: true,
          odKlienta: true,
          vybranoAt: true,
          vybralKdo: true,
          user: { select: { name: true, email: true } },
        },
      })
      .catch(() => []),
  ]);

  void zapisOtevreni(params.token);

  if (navrhy.length === 0) {
    return (
      <Hlaska
        nadpis={en ? 'Nothing to pick from yet' : 'Zatím není z čeho vybírat'}
        text={
          en
            ? 'We have not sent you any suggestions for this project yet.'
            : 'K téhle zakázce jsme vám návrhy zatím neposlali.'
        }
      />
    );
  }

  /**
   * UKÁZKY HLASU (22. 10. 2026: „přehrávač by měl pak u toho hlasu vypadat
   * jako v prezentaci. Překlik mezi ukázkami daného herce 1, 2, 3, 4…").
   * Tatáž dema jako v nabídkové prezentaci - knihovna je jedna.
   */
  const ukazky = await ukazkyKNavrhum(navrhy).catch(() => ({}));

  return (
    <main className="min-h-screen bg-page p-3 sm:p-6">
      <div className="max-w-[640px] mx-auto flex flex-col gap-4">
        <div className="bg-brand-purple text-white rounded-card px-4 py-2.5 flex items-center gap-3 flex-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mediaspace-logo-still.png" alt="Mediaspace" className="h-7 w-auto shrink-0" />
          <span className="w-px h-6 bg-white/30 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <span className="block font-heading font-semibold text-sm leading-tight">
              {en ? 'Pick an actor' : 'Výběr herce'}
            </span>
            <span className="block text-xs text-white/80 leading-tight truncate">
              {projekt?.name ?? ''}
            </span>
          </div>
        </div>

        <VyberHerceKlientem
          token={params.token}
          en={en}
          ukazky={ukazky}
          navrhy={navrhy.map((n) => ({
            id: n.id,
            jmeno: n.user ? n.user.name || n.user.email : n.jmeno || '—',
            preferovany: n.preferovany,
            odKlienta: n.odKlienta,
            vybrano: Boolean(n.vybranoAt),
            vybralKdo: n.vybralKdo,
          }))}
        />
      </div>
    </main>
  );
}
