import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { SignOutButton } from './SignOutButton';

// Administrace MEDIA SPACE - pristupna jen uctum s roli ADMIN. Middleware
// (src/middleware.ts) uz neprihlasene/neadminy blokuje na urovni routovani,
// tady je stejna kontrola znovu primo v serverove komponente (obrana do hloubky).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') redirect('/login');

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-ink px-6 sm:px-10 py-5 flex items-center justify-between flex-wrap gap-4">
        <Link href="/admin" className="flex items-center gap-2.5 no-underline">
          <div className="flex flex-col leading-none">
            <span className="font-display text-brand-green font-semibold tracking-tight uppercase text-xl">
              MS Portal
            </span>
            <span className="flex items-center gap-1 text-white/45 font-body text-[9px] uppercase tracking-wider mt-1">
              by
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mediaspace-logo.gif" alt="Mediaspace" className="h-3.5 w-auto" />
            </span>
          </div>
          <span className="text-white/60 font-medium text-sm ml-4">Administrace</span>
        </Link>
        <div className="flex items-center gap-5">
          <Link href="/projekty" className="text-white/70 text-sm font-heading hover:text-white">
            Zpět do portálu
          </Link>
          <SignOutButton />
        </div>
      </header>
      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-8 sm:py-12">{children}</div>
    </div>
  );
}
