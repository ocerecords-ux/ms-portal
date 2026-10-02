import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { nactiVzoryNataceni } from '@/lib/nataceniTextServer';
import { VzoryNataceniEditor } from './VzoryNataceniEditor';
import { nactiJazyk } from '@/lib/jazykServer';
import { prelozit } from '@/lib/jazyk';

/**
 * Vzory natáčecích textů (zadání 26. 9. 2026: „měli bychom nějaké vzory pro
 * natáčení, kde by bylo jasně označené, jak se spot jmenuje a jakou má délku
 * a pro jakou licenci").
 */
export const dynamic = 'force-dynamic';

export default async function VzoryNataceniPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') redirect('/projekty');

  const jazyk = nactiJazyk();
  const vzory = await nactiVzoryNataceni();

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin" className="text-muted text-sm font-heading no-underline">
        {prelozit(jazyk, 'vzoryNat.zpetDoAdmin')}
      </Link>
      <div>
        <h1 className="hidden sm:block font-display text-3xl sm:text-4xl text-ink m-0">
          {prelozit(jazyk, 'vzoryNat.nadpis')}
        </h1>
        <p className="text-sm font-body text-muted m-0 mt-2 max-w-[70ch]">
          {prelozit(jazyk, 'vzoryNat.uvod')}
        </p>
      </div>
      <VzoryNataceniEditor
        pocatecni={vzory.map((v) => ({
          id: v.id,
          nazev: v.nazev,
          uvod: v.uvod,
          blok: v.blok,
          vychozi: v.vychozi,
        }))}
      />
    </div>
  );
}
