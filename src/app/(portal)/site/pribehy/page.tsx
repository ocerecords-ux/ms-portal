import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { nactiPribehy, smiPoslatPribeh, smiSchvalovatPribehy } from '@/lib/pribehyServer';
import { stavInstagramu } from '@/lib/instagramServer';
import { FrontaPribehu } from './FrontaPribehu';

/**
 * PŘÍBĚHY NA INSTAGRAM (zadání 6. 10. 2026: „můžeme dát zvukařům přístup,
 * aby mohli posílat na instagram příběhy, aniž by měli přístup na
 * instagram?").
 *
 * NESCHVALUJE SE (6. 10. 2026: „nemusíme to nechávat schvalovat, všichni
 * z týmu by měli mít možnost to tam dát"). Nahoře se příběh složí a pustí
 * ven, dole je vidět, co je právě na Instagramu, kdo to tam dal a za jak
 * dlouho to zmizí.
 */
export const dynamic = 'force-dynamic';

export default async function PribehyPage({
  searchParams,
}: {
  /**
   * `?nova=1` - přišel jsem přes ikonu Instagramu na telefonu (zadání
   * 8. 10. 2026: „A když se prokliknů na tu stránku přes ikonu insta, tak
   * bych tam měl vidět rovnou prázdný rámeček s plus. Takhle musím dávat
   * plus 2x“). Na počítači to nic nedělá - editor tam stojí pořád.
   */
  searchParams?: { nova?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const kdo = { id: session.user.id, role: session.user.role };
  const smiPoslat = await smiPoslatPribeh(kdo);
  // Knihovnu hudby spravuje produkce - stejné právo jako vyřizování fronty.
  const smiSpravovatHudbu = await smiSchvalovatPribehy(kdo);
  if (!smiPoslat && !smiSpravovatHudbu) redirect('/projekty');

  // Jmeno uctu do nahledu - at je videt, kam to pujde.
  const ucet = (await stavInstagramu())?.username ?? null;

  return (
    <FrontaPribehu
      pribehy={await nactiPribehy(kdo)}
      smiPoslat={smiPoslat}
      ucet={ucet}
      jaId={session.user.id}
      smiSpravovatHudbu={smiSpravovatHudbu}
      rovnouSkladam={searchParams?.nova === '1'}
    />
  );
}
