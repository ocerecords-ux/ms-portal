import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { codePrefixForRole, nextCode } from '@/lib/codes';
import { sendInviteEmail } from '@/lib/email';

/**
 * POZVÁNKA KLIENTA STUDIA (zadání 25. 9. 2026: „poslali bychom tomu člověku
 * pozvánku a on by se dostal jen do toho kalendáře").
 *
 * ZADÁVÁ SE E-MAIL A STUDIO. Jméno si člověk doplní sám, až si bude nastavovat
 * heslo - a když ne, vystupuje pod svou adresou; v kalendáři stejně vidíme
 * hlavně to, kdy přijde.
 *
 * ÚČET NEVIDÍ NIC JINÉHO NEŽ SVŮJ KALENDÁŘ. Role BOOKING nemá v portálu
 * žádnou stránku (viz (portal)/layout.tsx, který ji rovnou pošle na /studio)
 * a všechna API si roli ověřují sama.
 */

export const POZVANKA_PLATI_DNI = 14;

export type VysledekPozvankyStudia =
  | { ok: true; userId: string; email: string }
  | { ok: false; chyba: string; userId?: string; odkaz?: string };

export async function pozviKlientaStudia(
  email: string,
  studioId: string,
  jmeno?: string | null,
): Promise<VysledekPozvankyStudia> {
  const adresa = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adresa)) {
    return { ok: false, chyba: 'Zadejte platný e-mail.' };
  }

  try {
    const studio = await prisma.studio.findUnique({
      where: { id: studioId },
      select: { id: true, name: true, bookingZapnuto: true, active: true },
    });
    if (!studio || !studio.active) return { ok: false, chyba: 'Studio nenalezeno.' };
    if (!studio.bookingZapnuto) {
      return { ok: false, chyba: 'U tohohle studia nejsou rezervace zapnuté.' };
    }

    let user = await prisma.user.findUnique({ where: { email: adresa } });

    if (user && user.role !== 'BOOKING') {
      return {
        ok: false,
        chyba: 'Na tenhle e-mail už je v portálu účet s jinou rolí.',
        userId: user.id,
      };
    }

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: adresa,
          name: jmeno?.trim() || null,
          role: 'BOOKING',
          code: await nextCode(codePrefixForRole('CLIENT')),
          // Heslo si nastaví sám z pozvánky; tímhle se přihlásit nedá.
          passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 10),
          bookingStudioId: studio.id,
          udajeDoplneny: true,
        },
      });
    } else {
      if (!user.active) return { ok: false, chyba: 'Účet je vypnutý — nejdřív ho zapněte.', userId: user.id };
      // Přepnutí do jiného studia je běžná věc (z Londýna do Brna), tak ať to
      // jde pozvánkou a nikdo nemusí do karty uživatele.
      await prisma.user.update({
        where: { id: user.id },
        data: { bookingStudioId: studio.id, ...(jmeno?.trim() ? { name: jmeno.trim() } : {}) },
      });
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
      audience: 'BOOKING',
    });

    if (!vysledek.sent) {
      return {
        ok: false,
        chyba: 'E-mail se nepodařilo odeslat. Odkaz můžete poslat ručně.',
        userId: user.id,
        odkaz,
      };
    }

    return { ok: true, userId: user.id, email: user.email };
  } catch (err) {
    console.error('Pozvanka klienta studia selhala:', err);
    return { ok: false, chyba: 'Pozvánku se nepodařilo odeslat.' };
  }
}
