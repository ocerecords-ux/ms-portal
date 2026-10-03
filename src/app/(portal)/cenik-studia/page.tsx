import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { smiSpravovatCenik, studiaSCenikem, zajistiCenik } from '@/lib/studioCenikServer';
import { CenikEditor } from './CenikEditor';
import { nactiJazyk } from '@/lib/jazykServer';
import { prelozit } from '@/lib/jazyk';

/**
 * CENÍK STUDIA (zadání 28. 9. 2026: „potřeboval bych někde v rámci Londýnského
 * studia implementovat na portál tento ceník… spravovat by to mělo jen
 * Žůžo-labůžo a Matěj. Asi bych to dal někam ke studiu Londýnskému.").
 *
 * PROČ V PORTÁLU A NE V SEKCI STUDIA. Sekce /studio je rezervační kalendář pro
 * muzikanty zvenčí a je z rozhodnutí z 25. 9. 2026 výhradně anglická. Editor
 * je naopak náš interní nástroj, se kterým pracují dva lidé z týmu - patří
 * tedy do portálu, kde je v češtině všechno ostatní. Ven jde jen hotové PDF,
 * a to anglicky.
 *
 * PRÁVA nejsou na roli: Matěj je zvukař, takže by se sem po roli nedostal.
 * Rozhoduje `smiSpravovatCenik` - Žůžo-labůžo všude, vedoucí pobočky ve svém
 * studiu. Až Londýn povede někdo jiný, funguje to dál bez zásahu do kódu.
 */
export const dynamic = 'force-dynamic';

export default async function CenikStudiaPage({
  searchParams,
}: {
  searchParams?: { studio?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const studia = await studiaSCenikem(session.user.id, session.user.role as never);
  if (studia.length === 0) redirect('/projekty');

  // Bez výběru se otevře první studio, které ten člověk spravuje.
  const chtene = searchParams?.studio?.trim();
  const studio = (chtene && studia.find((s) => s.id === chtene)) || studia[0];
  if (!(await smiSpravovatCenik(session.user.id, session.user.role as never, studio.id))) {
    redirect('/projekty');
  }

  const cenik = await zajistiCenik(studio.id);
  const jazyk = nactiJazyk();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">
          {prelozit(jazyk, 'cenikStudia.nadpis')}
        </h1>
        <p className="text-sm font-body text-muted m-0">{prelozit(jazyk, 'cenikStudia.uvod')}</p>
      </div>
      <CenikEditor
        studioId={studio.id}
        studia={studia.map((s) => ({ id: s.id, name: s.name }))}
        cenik={cenik}
      />
    </div>
  );
}
