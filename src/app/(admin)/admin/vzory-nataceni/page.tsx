import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { nactiVzoryNataceni } from '@/lib/nataceniTextServer';
import { VzoryNataceniEditor } from './VzoryNataceniEditor';

/**
 * Vzory natáčecích textů (zadání 26. 9. 2026: „měli bychom nějaké vzory pro
 * natáčení, kde by bylo jasně označené, jak se spot jmenuje a jakou má délku
 * a pro jakou licenci").
 */
export const dynamic = 'force-dynamic';

export default async function VzoryNataceniPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') redirect('/projekty');

  const vzory = await nactiVzoryNataceni();

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin" className="text-muted text-sm font-heading no-underline">
        ← Zpět do administrace
      </Link>
      <div>
        <h1 className="hidden sm:block font-display text-3xl sm:text-4xl text-ink m-0">
          Vzory natáčecích textů
        </h1>
        <p className="text-sm font-body text-muted m-0 mt-2 max-w-[70ch]">
          Podle nich vzniká dokument, který se v záložce Výstupy uloží do složky projektu na
          Disku — jeden za projekt, spoty pod sebou. U každého spotu je jeho název, délka
          a licence a pod tím místo na text; psát se do něj bude rovnou na Disku, portál do
          hotového dokumentu už nesahá.
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
