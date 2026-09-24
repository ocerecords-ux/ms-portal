import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';
import { UserEditForm } from './UserEditForm';
import { InviteButton } from '../InviteButton';

export default async function UserEditPage({ params }: { params: { id: string } }) {
  const [user, companies, studia] = await Promise.all([
    prisma.user.findUnique({
      where: { id: params.id },
      // Firma-dodavatel zalozena z herce (zadani 16. 9. 2026) - podle ni se
      // na karte ukazuje bud tlacitko „Prenest do dodavatelu", nebo odkaz.
      include: {
        dodavatelCompany: { select: { id: true, name: true, code: true } },
        // Studia zvukare (zadani 20. 9. 2026) - zaskrtavatka na karte.
        zvukarStudia: { select: { id: true } },
        vedeStudia: { select: { id: true } },
        tabulePristup: { select: { id: true } },
      },
    }),
    prisma.company.findMany({ where: { type: 'KLIENT' }, orderBy: { name: 'asc' } }),
    prisma.studio.findMany({
      where: { active: true },
      select: { id: true, shortName: true, name: true, color: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);
  if (!user) notFound();

  return (
    <section className="flex flex-col gap-6 max-w-2xl">
      <div>
        <Link href="/admin/users" className="text-muted text-sm font-heading">
          ← Zpět na seznam uživatelů
        </Link>
        <div className="flex items-center gap-4 mt-2">
          {/* Fotku vedou jen interni ucty Mediaspace - u ostatnich se misto ni
              nic nezobrazuje (zadani 6. 9. 2026). */}
          {/* FOTKA SE BERE PŘES /api/uzivatele/<id>/fotka (20. 9. 2026:
              „prověř zobrazování profilových fotek"). Přímá adresa z
              `photoUrl` ukazuje u novějších účtů do úložiště R2, které bez
              podpisu nikomu nic nevydá - fotka byla nahraná, ale na kartě
              i v „Můj účet" zůstal prázdný kolečko, takže to vypadalo, že se
              nenahrála. Endpoint adresu podepíše (a u fotek uložených
              v databázi navíc ušetří desítky kB v HTML). */}
          {isInternalRole(user.role) &&
            (user.photoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={`/api/uzivatele/${user.id}/fotka`}
                alt=""
                className="w-16 h-16 rounded-full object-cover border border-line shrink-0"
              />
            ) : (
              <span className="w-16 h-16 rounded-full bg-field border border-line flex items-center justify-center text-muted text-xl shrink-0">
                {(user.name || user.email).trim().charAt(0).toUpperCase()}
              </span>
            ))}
          <h1 className="font-display text-3xl text-ink m-0">
            {user.name || user.email} {user.code && <span className="text-muted text-lg font-heading">({user.code})</span>}
          </h1>
        </div>
      </div>

      {/* Pozvanka do portalu (zadani 5. 9. 2026) - uzivateli prijde e-mail s
          odkazem, kde si sam nastavi heslo. */}
      <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="font-heading font-semibold text-sm text-ink m-0">Pozvánka do portálu</p>
          <p className="text-muted text-xs font-body m-0 mt-1">
            {user.invitedAt
              ? `Naposledy odeslána ${new Intl.DateTimeFormat('cs-CZ').format(user.invitedAt)}.`
              : 'Zatím neodeslána.'}
            {user.passwordSetAt && ' Uživatel si už heslo nastavil.'}
          </p>
        </div>
        <InviteButton
          userId={user.id}
          invitedAtLabel={user.invitedAt ? new Intl.DateTimeFormat('cs-CZ').format(user.invitedAt) : null}
          variant="button"
        />
      </div>

      <UserEditForm
        // key = user.id: bez toho by pri prechodu z editace jednoho uzivatele
        // na druheho (Link, ne plny reload) klientsky formular mohl zustat s
        // puvodnimi hodnotami - stejna trida bugu jako na /admin/users (viz
        // key na NewUserForm tamtez, nahlaseno 5. 9. 2026).
        key={user.id}
        user={{
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
          companyId: user.companyId,
          active: user.active,
          birthDate: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
          // Do formuláře jde jen adresa, ne samotná data - viz výš.
          photoUrl: user.photoUrl ? `/api/uzivatele/${user.id}/fotka` : null,
          hourlyRate: user.hourlyRate,
          manazerProjektu: user.manazerProjektu,
          smlouvyPodepisuje: user.smlouvyPodepisuje,
          prijimaDotazyKlientu: user.prijimaDotazyKlientu,
          vidiBanku: user.vidiBanku,
          sledujeZmenyProjektu: user.sledujeZmenyProjektu,
          jenNahled: user.jenNahled,
          dostavaDotoceno: user.dostavaDotoceno,
          schvaleniReklam: user.schvaleniReklam,
          planovaniTerminu: user.planovaniTerminu,
          strihaExterne: user.strihaExterne,
          nabidkyReklam: user.nabidkyReklam,
          dostavaDotocenoKlient: user.dostavaDotocenoKlient,
          dostavaObjednavky: user.dostavaObjednavky,
          takyZvukar: user.takyZvukar,
          dostavaVyplneneUdaje: user.dostavaVyplneneUdaje,
          vychoziManazerAudioknih: user.vychoziManazerAudioknih,
          // Starsi zapisy („MS Studio - Brno II") se ctou jako mesto (15. 9. 2026).
          studioLocations: user.studioLocations,
          // Ve kterych studiich zvukar toci (zadani 20. 9. 2026).
          zvukarStudia: user.zvukarStudia.map((s) => s.id),
          vedeStudia: (user.vedeStudia as { id: string }[]).map((s) => s.id),
          tabulePristup: (user.tabulePristup as { id: string }[]).map((s) => s.id),
          birthNumber: user.birthNumber,
          ic: user.ic,
          dic: user.dic,
          vatPayer: user.vatPayer,
          bankAccount: user.bankAccount,
          addressStreet: user.addressStreet,
          addressCity: user.addressCity,
          addressZip: user.addressZip,
          addressCountry: user.addressCountry,
          // Firma-dodavatel zalozena z tohohle herce (zadani 16. 9. 2026).
          dodavatel: user.dodavatelCompany
            ? {
                id: user.dodavatelCompany.id,
                name: user.dodavatelCompany.name,
                code: user.dodavatelCompany.code,
              }
            : null,
        }}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
        studia={studia}
      />
    </section>
  );
}
