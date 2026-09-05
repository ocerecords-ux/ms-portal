import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { OrderForm } from './OrderForm';
import { AdOrderForm } from './AdOrderForm';
import { OrderTypeSwitcher } from './OrderTypeSwitcher';

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

  // Druh zakazek firmy (zadani 12. 9. 2026 - viz Company.dealsAudiobooks /
  // Company.dealsAds ve schema.prisma) rozhoduje, jaky typ objednavky klient
  // vidi: jen audiokniha, jen reklama, oboje (prepinac), nebo zatim nic.
  if (!company.dealsAudiobooks && !company.dealsAds) {
    return (
      <p className="text-muted font-body">
        Vaší firmě zatím není nastavený žádný druh zakázek. Kontaktujte prosím MEDIA SPACE.
      </p>
    );
  }

  // ratePerPage je nepovinne pole (Dodavatele ho nemaji vubec) - klientske
  // firmy poptavajici audioknihy by ho ale mely mit vyplnene, bez sazby
  // nejde spocitat predbeznou cenu. U firem jen s reklamou sazba nedava
  // smysl a nekontroluje se (viz take /api/orders).
  if (company.dealsAudiobooks && company.ratePerPage == null) {
    return (
      <p className="text-muted font-body">
        Vaší firmě zatím není nastavená sazba za normostranu. Kontaktujte prosím MEDIA SPACE.
      </p>
    );
  }

  const herci = company.dealsAudiobooks
    ? (
        await prisma.user.findMany({
          where: { role: 'HEREC', active: true },
          select: { id: true, name: true, code: true },
          orderBy: { name: 'asc' },
        })
      ).map((h) => ({ id: h.id, label: h.name || h.code || h.id }))
    : [];

  return (
    <section>
      {company.dealsAudiobooks && company.dealsAds ? (
        <OrderTypeSwitcher ratePerPage={company.ratePerPage!} herci={herci} />
      ) : company.dealsAudiobooks ? (
        <OrderForm ratePerPage={company.ratePerPage!} herci={herci} />
      ) : (
        <AdOrderForm />
      )}
    </section>
  );
}
