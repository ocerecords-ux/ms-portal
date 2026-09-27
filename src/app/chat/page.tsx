import { ChatDock } from '@/app/(portal)/components/ChatDock';
import { JazykProvider } from '@/app/(portal)/components/JazykProvider';
import { nactiJazyk } from '@/lib/jazykServer';

/**
 * MS chat přes celou obrazovku - z téhle stránky se dělá samostatná
 * aplikace na ploše (zadání 9. 9. 2026).
 *
 * Je to tentýž chat jako panel v portálu, jen v jiné schránce (viz prop
 * naStrance) - druhý chat by se od prvního odchýlil hned při první úpravě.
 */
export const dynamic = 'force-dynamic';

export default function ChatPage() {
  /**
   * Stránka stojí mimo layout portálu, takže jí jazyk nemá kdo podat -
   * bez providera by chat zůstal vždycky česky (pravidlo 8 v
   * docs/preklad-portalu.md).
   */
  return (
    <JazykProvider jazyk={nactiJazyk()}>
      <ChatDock naStrance />
    </JazykProvider>
  );
}
