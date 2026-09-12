import { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

/**
 * Ucty klientu zaklada vyhradne administrator Mediaspace (zadna verejna
 * registrace). Prihlaseni e-mailem + heslem. Kazdy prihlaseny uzivatel ma
 * v session sve companyId (u ADMIN je null) - tímto se v celé aplikaci
 * odvozuje, ktera data smi videt. Nikdy nespoléhat na companyId poslane
 * z klienta (URL, form) - vzdy jen ze session na serveru.
 */
export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Přihlášení',
      credentials: {
        email: { label: 'E-mail', type: 'email' },
        password: { label: 'Heslo', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });
        if (!user || !user.active) return null;
        /**
         * ROBOT SE NEPRIHLASI (zadani 12. 9. 2026). Ucty jako Bruno maji
         * nahodne heslo, ktere nikde neexistuje, ale spolehat se na to je
         * malo - kdyby jim nekdo heslo nastavil, byl by uvnitr. Prihlaseni
         * proto odmita sama role.
         *
         * Drive to hlidal priznak „neaktivni", jenze robot pak v seznamu
         * uzivatelu vypadal jako vyrazeny ucet a tlacitko „Vratit mezi
         * aktivni" u nej nedavalo smysl.
         */
        if (user.role === 'ROBOT') return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email,
          role: user.role,
          companyId: user.companyId,
        };
      },
    }),
  ],
  callbacks: {
    /**
     * Role a firma v tokenu se musi obcas overit proti databazi.
     *
     * Chyba nahlasena 9. 9. 2026 ("Peter Dratva nevidi aktivni projekty"):
     * puvodne se role zapsala do tokenu JEN pri prihlaseni a uz se nikdy
     * nezmenila. Kdyz se uctu zmenila role (u Petera na Zuzo-labuzo), token
     * v jeho prohlizeci nesl porad tu starou - portal ho tedy povazoval za
     * klienta, a protoze klientska vetev filtruje projekty podle firmy a on
     * zadnou nema, videl prazdny seznam. Bez chybove hlasky, takze to
     * vypadalo, ze projekty nejsou.
     *
     * Druha strana teze mince je dulezitejsi: bez tohohle overeni si uzivatel
     * po odebrani prav nebo deaktivaci uctu drzel stara opravneni tak dlouho,
     * dokud sam neodhlasil.
     *
     * Kontroluje se nejvys jednou za peti minut, aby z toho nebyl dotaz do
     * databaze pri kazdem pozadavku.
     */
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.companyId = (user as any).companyId;
        token.overenoAt = Date.now();
        token.neaktivni = false;
        return token;
      }

      const OVERIT_PO_MS = 5 * 60 * 1000;
      const overeno = typeof token.overenoAt === 'number' ? token.overenoAt : 0;
      if (!token.sub || Date.now() - overeno < OVERIT_PO_MS) return token;

      try {
        const ucet = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { role: true, companyId: true, active: true },
        });
        if (!ucet || !ucet.active) {
          // Ucet uz neexistuje nebo je vypnuty - middleware ho pusti na login.
          token.neaktivni = true;
          return token;
        }
        token.role = ucet.role;
        token.companyId = ucet.companyId;
        token.neaktivni = false;
        token.overenoAt = Date.now();
      } catch (err) {
        // Vypadek databaze nesmi odhlasit celý portál - jede se dal na tom,
        // co uz v tokenu je, a zkusi se to za pet minut znovu.
        console.error('Overeni role uzivatele selhalo, pouzivam token:', err);
        token.overenoAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).companyId = token.companyId;
      }
      return session;
    },
  },
};
