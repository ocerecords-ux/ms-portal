import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canUseChat } from '@/lib/chatServer';

/**
 * Samostatná stránka MS chatu (zadání 9. 9. 2026: "MS chat bych chtěl mít
 * jako aplikaci zvlášť").
 *
 * Záměrně mimo skupinu (portal): tahle stránka nemá horní lištu, levé rychlé
 * volby ani panel úkolů - je to celá obrazovka jen pro chat, ze které si
 * člověk udělá ikonu na ploše. Portálová aplikace naopak chat nemá vůbec,
 * o to se stará detekce v layoutu portálu.
 *
 * Přihlášení a práva se kontrolují stejně jako všude jinde; kdo do chatu
 * nesmí, jde na projekty.
 */
export const metadata: Metadata = {
  title: 'MS Chat',
  description: 'Chat týmu Mediaspace',
  manifest: '/manifest-chat.webmanifest',
  appleWebApp: { capable: true, title: 'MS Chat', statusBarStyle: 'default' },
};

export const viewport = {
  themeColor: '#6B2AF0',
  // Chat je celá obrazovka - na mobilu se nemá dát omylem odzoomovat.
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login?next=/chat');
  if (!canUseChat(session.user.role)) redirect('/projekty');

  // dvh, ne vh: na mobilu se spodní lišta prohlížeče schovává a s vh by
  // psátko končilo pod okrajem obrazovky.
  return <main className="h-dvh w-full bg-paper overflow-hidden">{children}</main>;
}
