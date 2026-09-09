import { ChatDock } from '@/app/(portal)/components/ChatDock';

/**
 * MS chat přes celou obrazovku - z téhle stránky se dělá samostatná
 * aplikace na ploše (zadání 9. 9. 2026).
 *
 * Je to tentýž chat jako panel v portálu, jen v jiné schránce (viz prop
 * naStrance) - druhý chat by se od prvního odchýlil hned při první úpravě.
 */
export const dynamic = 'force-dynamic';

export default function ChatPage() {
  return <ChatDock naStrance />;
}
