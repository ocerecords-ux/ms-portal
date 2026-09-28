import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { nactiVzory } from '@/lib/vzoryZpravServer';
import { VzoryEditor } from '../../vzory-zprav/VzoryEditor';
import { ProdlevaNotifikaci } from '../../vzory-zprav/ProdlevaNotifikaci';
import { MAX_PRODLEVA_S, nactiProdlevu } from '@/lib/prodlevaNotifikaciServer';
import { nastaveniSekce } from '@/lib/nastaveniSekci';

/**
 * NASTAVENÍ SEKCE PROJEKTY (zadání 28. 9. 2026: „Projekty - notifikace na
 * klienta, zprávy z portálu na klienty, texty, jak to bude vypadat. Ne
 * individuální nastavení, to nastavujeme pořád pod danou firmou").
 *
 * Obsah je ten, co byl do teď na /admin/vzory-zprav - jen se na něj chodí
 * ozubeným kolem z Projektů, kde se to hledá. Stará adresa sem přesměrovává.
 */
export const dynamic = 'force-dynamic';

export default async function NastaveniProjektuPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') redirect('/projekty');

  const nastaveni = nastaveniSekce('PROJEKTY');

  return (
    <div className="flex flex-col gap-6">
      <Link href="/projekty" className="text-muted text-sm font-heading no-underline">
        ← Zpět na projekty
      </Link>
      <div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">{nastaveni?.nadpis}</h1>
        <p className="text-sm font-body text-muted m-0 mt-2 max-w-[70ch]">{nastaveni?.popis}</p>
      </div>
      {/* Technické parametry výroby patří k projektům (28. 9. 2026) - z hlavičky
          Firem zmizely, tady je na ně proklik. */}
      <Link
        href="/admin/technicke-parametry"
        className="self-start text-sm font-heading font-semibold rounded-pill border border-line bg-surface px-4 py-2 text-brand-purple no-underline hover:border-brand-purple"
      >
        Technické parametry výroby →
      </Link>
      <ProdlevaNotifikaci pocatecni={await nactiProdlevu()} max={MAX_PRODLEVA_S} />
      <VzoryEditor pocatecni={[...(await nactiVzory('AUDIOKNIHA')), ...(await nactiVzory('REKLAMA'))]} />
    </div>
  );
}
