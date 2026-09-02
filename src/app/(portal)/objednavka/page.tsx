import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { OrderForm } from './OrderForm';

export default async function ObjednavkaPage() {
  const session = await getServerSession(authOptions);
  const companyId = session!.user.companyId;
  const company = companyId ? await prisma.company.findUnique({ where: { id: companyId } }) : null;

  if (!company) {
    return (
      <p className="text-muted font-body">
        Váš účet zatím není přiřazen k žádné firmě. Kontaktujte prosím MEDIA SPACE.
      </p>
    );
  }

  return (
    <section>
      <div className="mb-6">
        <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">Nová objednávka</h1>
        <p className="text-muted text-sm mt-1 font-body">Vyplňte údaje o audioknize, cenu spočítáme za vás</p>
      </div>
      <OrderForm ratePerPage={company.ratePerPage} />
    </section>
  );
}
