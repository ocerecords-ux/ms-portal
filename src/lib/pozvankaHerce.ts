import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { codePrefixForRole, nextCode } from '@/lib/codes';
import { sendInviteEmail } from '@/lib/email';

/**
 * POZVÁNKA NOVÉHO HERCE (zadání 16. 9. 2026: „u nových herců to udělejme tak,
 * že v Uživatelích, hercích bude nahoře tlačítko Nová pozvánka. Po stisknutí
 * se zadá do pole jen e-mail. A ten přijde pozvánka do portálu a po tom, co
 * si herec nastaví heslo, ho to vyzve, ať doplní údaje").
 *
 * ZADÁVÁ SE JEN E-MAIL. Všechno ostatní si herec vyplní sám — jméno napsané
 * podle sluchu z telefonu stejně končí opravou a číslo účtu opsané z esemesky
 * je místo, kde vzniká překlep za peníze.
 *
 * Je to obyčejná pozvánka do portálu (tatáž, co dostávají klienti i tým),
 * jen se u účtu zvedne příznak `udajeDoplneny = false`. Portál pak herce po
 * prvním přihlášení zastaví u formuláře a pustí ho dál, až ho odešle.
 */

export const POZVANKA_PLATI_DNI = 7;

export type VysledekPozvanky =
  | { ok: true; userId: string; email: string }
  | { ok: false; chyba: string; userId?: string; odkaz?: string };

/**
 * Založí herce (nebo najde existujícího) a pošle mu pozvánku do portálu.
 *
 * KDYŽ ÚČET UŽ EXISTUJE, nezakládá se podruhé — jen se pošle nová pozvánka.
 * Dvě karty téhož herce jsou horší než pozvánka navíc.
 */
export async function pozviHerce(email: string): Promise<VysledekPozvanky> {
  const adresa = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adresa)) {
    return { ok: false, chyba: 'Zadejte platný e-mail.' };
  }

  try {
    let user = await prisma.user.findUnique({ where: { email: adresa } });

    if (user && user.role !== 'HEREC') {
      return {
        ok: false,
        chyba: 'Na tenhle e-mail už je v portálu účet, ale není to herec.',
        userId: user.id,
      };
    }

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: adresa,
          role: 'HEREC',
          code: await nextCode(codePrefixForRole('HEREC')),
          // Heslo si nastaví sám z pozvánky; tímhle se přihlásit nedá.
          passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 10),
          udajeDoplneny: false,
        },
      });
    } else if (!user.active) {
      return { ok: false, chyba: 'Účet je vypnutý — nejdřív ho zapněte.', userId: user.id };
    }

    const token = randomBytes(32).toString('hex');
    const platiDo = new Date(Date.now() + POZVANKA_PLATI_DNI * 24 * 60 * 60 * 1000);
    await prisma.user.update({
      where: { id: user.id },
      data: { inviteToken: token, inviteTokenExpires: platiDo, invitedAt: new Date() },
    });

    const zaklad = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
    const odkaz = `${zaklad}/nastaveni-hesla?token=${token}`;

    const vysledek = await sendInviteEmail({
      to: user.email,
      name: user.name,
      inviteUrl: odkaz,
      expiresAt: platiDo,
      audience: 'HEREC',
    });

    if (!vysledek.sent) {
      // Token je uložený, jen odešel mail nedoručitelně - odkaz se dá předat
      // ručně, ať herec nezůstane viset.
      return {
        ok: false,
        chyba: 'E-mail se nepodařilo odeslat. Odkaz můžete poslat ručně.',
        userId: user.id,
        odkaz,
      };
    }

    return { ok: true, userId: user.id, email: user.email };
  } catch (err) {
    console.error('Pozvanka herce selhala:', err);
    return { ok: false, chyba: 'Pozvánku se nepodařilo odeslat.' };
  }
}
