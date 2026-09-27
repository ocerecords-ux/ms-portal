import { redirect, notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { nactiObrazky, nactiPrispevek, smiSite } from '@/lib/socialniServer';
import { Editor } from '../Editor';

/** Editor jednoho příspěvku (zadání 27. 9. 2026). */
export const dynamic = 'force-dynamic';

export default async function SitePrispevekPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  if (!(await smiSite(session.user.id))) redirect('/projekty');

  const prispevek = await nactiPrispevek(session.user.id, params.id);
  if (!prispevek) notFound();

  return <Editor prispevek={prispevek} obrazkyVychozi={await nactiObrazky(session.user.id)} />;
}
