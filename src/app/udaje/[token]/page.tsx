import { prisma } from '@/lib/db';
import { najdiPlatnou, poleProDruh } from '@/lib/pozvankaUdaju';
import { FormularUdaju } from './FormularUdaju';

/**
 * VEŘEJNÝ FORMULÁŘ NA VYPLNĚNÍ ÚDAJŮ (zadání 16. 9. 2026: „posílat odkaz, na
 * kterém bude formulář, kde vyplní své údaje").
 *
 * Stejný princip jako podpis smlouvy: člověk sem přijde odkazem z mailu,
 * nikam se nepřihlašuje a žádný kód neopisuje. Žádost se hledá VÝHRADNĚ
 * podle tokenu.
 *
 * NEPLATNÝ ODKAZ NEKONČÍ CHYBOVOU STRÁNKOU. Tohle otevírá herec, kterému
 * jsme napsali - „404" by pro něj znamenalo, že něco udělal špatně. Místo
 * toho dostane větu, co se stalo a co s tím.
 */
export const dynamic = 'force-dynamic';

export default async function StrankaUdaju({ params }: { params: { token: string } }) {
  const pozvanka = await najdiPlatnou(params.token);

  if (!pozvanka) {
    return (
      <Ramecek>
        <h1 className="font-display text-3xl text-ink m-0">Odkaz už neplatí</h1>
        <p className="text-muted font-body mt-3 m-0">
          Buď jste ho už vyplnil, nebo mu vypršela platnost. Napište nám prosím a pošleme vám nový.
        </p>
      </Ramecek>
    );
  }

  if (pozvanka.stav === 'VYPLNENA' || pozvanka.stav === 'HOTOVA') {
    return (
      <Ramecek>
        <h1 className="font-display text-3xl text-ink m-0">Máme to, děkujeme</h1>
        <p className="text-muted font-body mt-3 m-0">
          Údaje jsme od vás dostali. Kdyby se něco změnilo, stačí nám napsat.
        </p>
      </Ramecek>
    );
  }

  // Co uz o nem vime, se predvyplni - nikdo nema opisovat to, co uz mame.
  const znameUdaje = await nactiZname(pozvanka);

  return (
    <Ramecek>
      <FormularUdaju
        token={params.token}
        druh={pozvanka.druh as 'HEREC' | 'FIRMA'}
        pole={poleProDruh(pozvanka.druh as 'HEREC' | 'FIRMA')}
        vychozi={znameUdaje}
        poznamka={pozvanka.poznamka}
      />
    </Ramecek>
  );
}

async function nactiZname(pozvanka: {
  druh: string;
  userId: string | null;
  companyId: string | null;
  jmeno: string | null;
  email: string | null;
}): Promise<Record<string, string | boolean | string[]>> {
  const out: Record<string, string | boolean | string[]> = {};
  const zapis = (klic: string, hodnota: unknown) => {
    if (hodnota === null || hodnota === undefined || hodnota === '') return;
    if (hodnota instanceof Date) out[klic] = hodnota.toISOString().slice(0, 10);
    else if (typeof hodnota === 'boolean' || Array.isArray(hodnota)) out[klic] = hodnota as never;
    else out[klic] = String(hodnota);
  };

  if (pozvanka.druh === 'HEREC' && pozvanka.userId) {
    const u = await prisma.user.findUnique({ where: { id: pozvanka.userId } });
    if (u) {
      for (const klic of [
        'name', 'birthDate', 'birthNumber', 'phone', 'email', 'addressStreet', 'addressCity',
        'addressZip', 'addressCountry', 'bankAccount', 'ic', 'dic', 'vatPayer', 'studioLocations',
      ]) {
        zapis(klic, (u as Record<string, unknown>)[klic]);
      }
    }
  } else if (pozvanka.druh === 'FIRMA' && pozvanka.companyId) {
    const f = await prisma.company.findUnique({ where: { id: pozvanka.companyId } });
    if (f) {
      for (const klic of [
        'name', 'ic', 'dic', 'vatPayer', 'addressStreet', 'addressCity', 'addressZip',
        'addressCountry', 'bankAccount', 'contactName', 'contactEmail', 'contactPhone',
      ]) {
        zapis(klic, (f as Record<string, unknown>)[klic]);
      }
    }
  } else {
    // Zadny zaznam jeste neni - alespon jmeno a mail z toho, co jsme napsali my.
    zapis('name', pozvanka.jmeno);
    zapis(pozvanka.druh === 'HEREC' ? 'email' : 'contactEmail', pozvanka.email);
  }
  return out;
}

function Ramecek({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-paper">
      <header className="bg-gradient-to-b from-brand-purple to-brand-purpleDeep px-6 sm:px-10 py-6 flex items-center gap-3 sm:gap-4">
        <span className="font-body text-brand-green font-semibold text-2xl sm:text-3xl">Mediaspace</span>
        <span className="w-px h-8 sm:h-10 bg-white/40" aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mediaspace-logo.gif" alt="Mediaspace" className="h-12 sm:h-14 w-auto" />
      </header>
      <div className="max-w-2xl mx-auto px-6 sm:px-10 py-8 sm:py-12 flex flex-col gap-6">{children}</div>
    </main>
  );
}
