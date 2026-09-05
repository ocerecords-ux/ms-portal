import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Topbar } from '@/app/(portal)/components/Topbar';

// Administrace MEDIA SPACE - pristupna jen uctum s roli ADMIN. Middleware
// (src/middleware.ts) uz neprihlasene/neadminy blokuje na urovni routovani,
// tady je stejna kontrola znovu primo v serverove komponente (obrana do hloubky).
//
// Pouziva stejny Topbar jako zbytek portalu (zadani 9. 9. 2026: "Chci ať to
// zustane všechno jednoduše s tou fialovou lištou nahoře. Je debilní se pak
// překlikávat přes navigaci ZPĚT DO PORTÁLU.") - admin sekce uz neni jine
// "prostredi" s vlastni cernou hlavickou, jen dalsi stranky uvnitr stejneho
// portalu se stejnou navigaci (viz take (portal)/layout.tsx pro klientskou
// cast, ktera Topbar pouziva stejne).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') redirect('/login');

  return (
    <div className="min-h-screen bg-paper">
      <Topbar userLabel={session.user.name || session.user.email} isAdmin />
      {/* Od 5. 9. 2026 stejne siroky obsah jako v klientske casti portalu
          (max-w-7xl): v max-w-4xl se tabulka uzivatelu nevesla a napr.
          telefonni cislo se lamalo na dva radky. Formulare si sirku hlidaji
          samy (max-w-3xl primo u nich). */}
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-8 sm:py-12">{children}</div>
    </div>
  );
}
