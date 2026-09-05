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

  // ratePerPage je od 5. 9. 2026 nepovinne pole (Dodavatele ho nemaji vubec)
  // - klientske firmy by ho ale vzdy mely mit vyplnene. Bez sazby nejde
  // spocitat predbeznou cenu, radeji tedy zobrazime hlasku nez pustit
  // objednavku s neznamou cenou.
  if (company.ratePerPage == null) {
    return (
      <p className="text-muted font-body">
        Vaší firmě zatím není nastavená sazba za normostranu. Kontaktujte prosím MEDIA SPACE.
      </p>
    );
  }

  return (
    <section>
      <OrderForm ratePerPage={company.ratePerPage} />
    </section>
  );
}
