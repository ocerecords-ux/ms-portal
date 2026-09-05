import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { UserEditForm } from './UserEditForm';

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
        <h1 className="font-display text-3xl text-ink m-0 mt-2">
          {user.name || user.email} {user.code && <span className="text-muted text-lg font-heading">({user.code})</span>}
        </h1>
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
