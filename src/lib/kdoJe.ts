import type { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import { authOptions } from '@/lib/auth';

/**
 * KDO POSÍLÁ TENHLE POŽADAVEK.
 *
 * Normálně stačí `getServerSession`. Jenže 16. 9. 2026 se ukázalo, že na
 * některých routách vrátí prázdno i přihlášenému člověku („Nepřihlášeno."
 * u zcela běžného kliknutí) — přihlášení přitom platí, stránka se otevře
 * a ostatní požadavky projdou.
 *
 * ZÁLOHA JE TOKEN Z COOKIE napřímo, tedy přesně to, co čte middleware, která
 * na stejném nasazení funguje spolehlivě. Kdyby session z jakéhokoliv důvodu
 * nedorazila, rozhodne token — a člověk se místo nesmyslné hlášky dostane
 * k práci.
 *
 * BEZPEČNOST SE TÍM NESNIŽUJE: token je podepsaný a obsahuje id i roli
 * stejně jako session. Kdo ho nemá, dostane `null` jako dřív.
 */
export type Prihlaseny = { id: string; role: string };

export async function kdoJe(req: NextRequest): Promise<Prihlaseny | null> {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      return { id: session.user.id, role: session.user.role };
    }
  } catch (err) {
    console.error('getServerSession selhalo, zkousim token z cookie:', err);
  }

  try {
    const token = await getToken({ req });
    if (token?.sub && !token.neaktivni) {
      return { id: token.sub, role: String(token.role ?? '') };
    }
  } catch (err) {
    console.error('Token z cookie se nepodarilo precist:', err);
  }

  /**
   * Ani jedna cesta nedopadla. Do logu jde, JESTLI vůbec dorazila přihlašovací
   * cookie - bez toho se nedá poznat, jestli je problém v prohlížeči (cookie
   * nedorazila) nebo na serveru (dorazila, ale nedala se přečíst).
   * Do logu jdou jen NÁZVY cookies, nikdy jejich obsah.
   */
  try {
    const nazvy = req.cookies.getAll().map((c) => c.name);
    console.error(
      'kdoJe: pozadavek bez prihlaseni.',
      nazvy.length ? `cookies: ${nazvy.join(', ')}` : 'zadne cookies nedorazily',
    );
  } catch {
    /* logovani nesmi shodit odpoved */
  }

  return null;
}
