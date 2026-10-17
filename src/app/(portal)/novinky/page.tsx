import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { nactiJazyk } from '@/lib/jazykServer';
import { prelozit } from '@/lib/jazyk';
import { mesiceSNovinkami, nactiNovinky, seznamModulu } from '@/lib/novinkyServer';

import { NovinkyPrehled } from './NovinkyPrehled';

/**
 * NOVINKY PORTÁLU (zadání 17. 10. 2026: „potrebuju nekde mit historii
 * jednotlivych modulu a vychytavek a vylepseni, ktera jsme na portal
 * implementovali. Bude to pak i slouzit k ziskani prehledu na newslettery,
 * ktere chci pak rozesilat jednou za mesic... A melo by to byt i trizeno podle
 * toho, koho se to tyka. Tym, klienti (audioknihy a reklamy zvlast), herci").
 *
 * ČTE CELÝ TÝM, PÍŠE ŽŮŽO-LABŮŽO. Pro tým je to přehled o tom, co v portálu
 * přibylo; pro Žůžo-labůžo zároveň podklad k měsíčnímu newsletteru - druhá
 * záložka z vybraného měsíce poskládá text pro jedno publikum.
 */
export const dynamic = 'force-dynamic';

const SMI = ['ADMIN', 'PRODUKCE', 'ZVUKAR'];

export default async function NovinkyPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  if (!SMI.includes(session.user.role)) redirect('/projekty');

  const pise = session.user.role === 'ADMIN';
  const [novinky, moduly, mesice] = await Promise.all([
    nactiNovinky(pise),
    seznamModulu(),
    mesiceSNovinkami(),
  ]);

  const jazyk = nactiJazyk();

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="hidden sm:block font-display text-3xl text-ink m-0">
          {prelozit(jazyk, 'novinky.nadpis')}
        </h1>
        <p className="text-sm font-body text-muted m-0 mt-1">{prelozit(jazyk, 'novinky.uvod')}</p>
      </div>

      <NovinkyPrehled
        novinky={novinky.map((n) => ({
          ...n,
          datum: n.datum.toISOString().slice(0, 10),
          odeslanoAt: n.odeslanoAt ? n.odeslanoAt.toISOString() : null,
        }))}
        moduly={moduly}
        mesice={mesice}
        pise={pise}
      />
    </section>
  );
}
