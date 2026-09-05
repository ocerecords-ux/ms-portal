import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { UserEditForm } from './UserEditForm';

export default async function UserEditPage({ params }: { params: { id: string } }) {
  const [user, companies] = await Promise.all([
    prisma.user.findUnique({ where: { id: params.id } }),
    prisma.company.findMany({ orderBy: { name: 'asc' } }),
  ]);
  if (!user) notFound();

  return (
    <section className="flex flex-col gap-6 max-w-2xl">
      <div>
        <Link href="/admin/users" className="text-muted text-sm font-heading">
          ← Zpět na seznam uživatelů
        </Link>
        <h1 className="font-display text-3xl text-ink m-0 mt-2">{user.name || user.email}</h1>
      </div>

      <UserEditForm
        user={{
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
          companyId: user.companyId,
          caflouTag: user.caflouTag,
          active: user.active,
        }}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      />
    </section>
  );
}
