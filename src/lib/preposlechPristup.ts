import { getServerSession } from 'next-auth';
import { cookies } from 'next/headers';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';
import { projektPodleTokenu } from '@/lib/preposlechOdkaz';

/**
 * Kdo smí k přeposlechu daného projektu (zadání 11. 9. 2026).
 *
 * Tři cesty dovnitř:
 *  1. TÝM MEDIASPACE — ke všemu a smí všechno (`interni`).
 *  2. KLIENT S ÚČTEM — jen k projektům své firmy, jen poslouchat a psát.
 *  3. TOKEN Z MAILU — celoobrazovkový odkaz pro klienta, který účet nemá.
 *     Přihlášení se v tomhle případě neřeší vůbec; token sám je vstupenka,
 *     a to jen do toho jediného projektu, ke kterému byl vydaný.
 *
 * Kontroluje se to při KAŽDÉM požadavku, ne jen při otevření stránky —
 * tudyhle tečou nahrávky ven.
 */
export type PristupKPreposlechu =
  | {
      ok: true;
      userId: string | null;
      jmeno: string | null;
      /** Tým Mediaspace: smí měnit pořadí, mazat záznamy, odškrtnout přeposlechnuto. */
      interni: boolean;
      /** Přišel odkazem z mailu (nepřihlášený klient). */
      pres_odkaz: boolean;
      /**
       * Kdo z posluchačů odkazu u prohlížeče sedí (21. 9. 2026) - podle něj se
       * podepisují poznámky a zapisuje historie. null = zatím se nepředstavil.
       */
      posluchacId?: string | null;
    }
  | { ok: false; status: 401 | 403; message: string };

export async function pristupKPreposlechu(
  caflouProjectId: string,
  token?: string | null,
): Promise<PristupKPreposlechu> {
  if (token) {
    const projekt = await projektPodleTokenu(token);
    if (projekt === caflouProjectId) {
      const ja = await posluchacZCookie(caflouProjectId);
      return {
        ok: true,
        userId: null,
        jmeno: ja ? ja.jmeno?.trim() || ja.email : null,
        interni: false,
        pres_odkaz: true,
        posluchacId: ja?.id ?? null,
      };
    }
    // Neplatny token radsi neprohlasujeme za "chybu odkazu" - muze to byt i
    // nas clovek s proslym odkazem v jinem okne, takze se jeste zkusi sezeni.
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { ok: false, status: 401, message: 'Odkaz už neplatí. Napište nám a pošleme vám nový.' };
  }

  const jmeno = session.user.name || session.user.email || null;
  if (isInternalRole(session.user.role)) {
    return { ok: true, userId: session.user.id, jmeno, interni: true, pres_odkaz: false };
  }

  const companyId = session.user.companyId;
  if (!companyId) {
    return { ok: false, status: 403, message: 'Účet není napojený na firmu.' };
  }

  const meta = await prisma.projectMeta.findUnique({
    where: { caflouProjectId },
    select: { companyId: true },
  });
  if (!meta?.companyId || meta.companyId !== companyId) {
    return { ok: false, status: 403, message: 'K tomuto projektu nemáte přístup.' };
  }

  return { ok: true, userId: session.user.id, jmeno, interni: false, pres_odkaz: false };
}

/**
 * Cookie, ve kterém si prohlížeč pamatuje, kdo z posluchačů odkazu u něj sedí
 * (zadání 21. 9. 2026: „aby tam byl záznam o tom, kdo co udělal"). Jedno na
 * projekt - kolega s odkazem na dvě knihy je u každé zvlášť.
 */
export function cookiePosluchace(caflouProjectId: string): string {
  return `ms_pp_${caflouProjectId.replace(/[^A-Za-z0-9_-]/g, '')}`;
}

export async function posluchacZCookie(
  caflouProjectId: string,
): Promise<{ id: string; email: string; jmeno: string | null } | null> {
  try {
    const id = cookies().get(cookiePosluchace(caflouProjectId))?.value;
    if (!id) return null;
    return await prisma.preposlechPosluchac.findFirst({
      where: { id, caflouProjectId },
      select: { id: true, email: true, jmeno: true },
    });
  } catch {
    return null;
  }
}
