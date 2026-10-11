import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isInternalRole } from '@/lib/roles';
import { nactiKnihovnu } from '@/lib/ukazkyServer';
import { KnihovnaUkazek } from './KnihovnaUkazek';

/**
 * KNIHOVNA UKÁZEK PRO NABÍDKY (zadání 11. 10. 2026: „naše reference - zde bych
 * nasázel nějaký MP3 nebo MP4 ukázky z minulých projektů" a „nabídka herců -
 * tady bych dal MP3 ukázky do nějakého přehrávače").
 *
 * PROČ KNIHOVNA, A NE PŘÍLOHY U KAŽDÉ NABÍDKY: tytéž reference a tatáž dema
 * chodí klientům pořád dokola. Nahrají se jednou sem a v každé prezentaci se
 * jen zaškrtnou - druhá nabídka je pak na pět minut.
 */
export const dynamic = 'force-dynamic';

export default async function UkazkyPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) redirect('/projekty');

  const ukazky = await nactiKnihovnu(true);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin" className="text-muted text-sm font-heading no-underline">
        ← Administrace
      </Link>
      <div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">Ukázky do nabídek</h1>
        <p className="text-sm font-body text-muted m-0 mt-2 max-w-[70ch]">
          Reference z minulých projektů a dema herců. Nahrajete je sem jednou; v nabídkové
          prezentaci u projektu je pak jen zaškrtnete. Vyřazená ukázka se nenabízí, ale
          v prezentacích, kde už je, zůstane - klient je otevírá i za týden.
        </p>
      </div>
      <KnihovnaUkazek pocatecni={ukazky} />
    </div>
  );
}
