import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';
import { UserEditForm } from './UserEditForm';
import { InviteButton } from '../InviteButton';

export default async function UserEditPage({ params }: { params: { id: string } }) {
  const [user, companies] = await Promise.all([
    prisma.user.findUnique({ where: { id: params.id } }),
    prisma.company.findMany({ where: { type: 'KLIENT' }, orderBy: { name: 'asc' } }),
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
          {isInternalRole(user.role) &&
            (user.photoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={user.photoUrl}
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
      <div className="bg-white rounded-card border border-line shadow-sm p-5 flex items-start justify-between gap-4 flex-wrap">
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
          caflouTag: user.caflouTag,
          active: user.active,
          birthDate: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
          photoUrl: user.photoUrl,
          hourlyRate: user.hourlyRate,
          studioLocations: user.studioLocations,
          birthNumber: user.birthNumber,
          ic: user.ic,
          dic: user.dic,
          vatPayer: user.vatPayer,
          bankAccount: user.bankAccount,
          addressStreet: user.addressStreet,
          addressCity: user.addressCity,
          addressZip: user.addressZip,
          addressCountry: user.addressCountry,
        }}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      />
    </section>
  );
}
