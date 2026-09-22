import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export default async function RootPage() {
  const session = await getServerSession(authOptions);
  // Počítač u obrazovky ve studiu rovnou na svou tabuli (22. 9. 2026).
  if (session?.user.role === 'TABULE') redirect('/tabule/moje');
  redirect(session ? '/projekty' : '/login');
}
