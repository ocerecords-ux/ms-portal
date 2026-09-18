import { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { jeZahlceniDatabaze, zkusDatabazi } from '@/lib/dbZnovu';
import { NAHLED_COOKIE, nahledZHodnoty, pohledNahledu } from '@/lib/nahledRole';

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
      /**
       * PROČ SE TU LOGUJE: přihlášení umí odpovědět jedinou větou „nesprávný
       * e-mail nebo heslo" — schválně, aby stránka neprozrazovala, které
       * adresy v portálu existují. Jenže pak nejde poznat rozdíl mezi
       * překlepem v heslu, vypnutým účtem a databází, která zrovna
       * neodpověděla (16. 9. 2026: „nemůžu se teď přihlásit pod svým účtem").
       * Do logu proto jde DŮVOD - nikdy heslo.
       */
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.toLowerCase().trim();

        let user: Awaited<ReturnType<typeof prisma.user.findUnique>> = null;
        try {
          // Přeplněný pooler Supabase se tvářil jako špatné heslo - viz
          // lib/dbZnovu.ts. Pár set milisekund a místo je zpátky.
          user = await zkusDatabazi(() => prisma.user.findUnique({ where: { email } }));
        } catch (err) {
          console.error(
            `Prihlaseni "${email}": databaze neodpovedela${jeZahlceniDatabaze(err) ? ' (plny pooler)' : ''}:`,
            err,
          );
          return null;
        }

        if (!user) {
          console.warn(`Prihlaseni "${email}": takovy ucet v portalu neni.`);
          return null;
        }
        if (!user.active) {
          console.warn(`Prihlaseni "${email}": ucet je vypnuty.`);
          return null;
        }
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
        if (!valid) {
          console.warn(`Prihlaseni "${email}": nesouhlasi heslo.`);
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email,
          role: user.role,
          companyId: user.companyId,
          jenNahled: user.jenNahled,
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
        token.jenNahled = (user as any).jenNahled === true;
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
          // `jenNahled` se overuje spolu s roli schvalne: kdyz se priznak
          // z uctu sundá, musí zámek na zápis zmizet do pěti minut sám -
          // ne až ve chvíli, kdy se člověk odhlásí a zase přihlásí.
          select: { role: true, companyId: true, active: true, jenNahled: true },
        });
        if (!ucet || !ucet.active) {
          // Ucet uz neexistuje nebo je vypnuty - middleware ho pusti na login.
          token.neaktivni = true;
          return token;
        }
        token.role = ucet.role;
        token.companyId = ucet.companyId;
        token.jenNahled = ucet.jenNahled === true;
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
    /**
     * NÁHLEDOVÝ ÚČET SI TU PŮJČUJE ROLI (zadání 18. 9. 2026: „profil pro
     * uživatele, který nemůže nic měnit, jen si může vyzkoušet celý portál
     * z různých rolí").
     *
     * Je to schválně JEDINÉ místo, kde se to děje. Session je zdroj pravdy
     * o roli pro celý portál - stránky, serverové komponenty i API routy
     * čtou `session.user.role`. Když se role vymění tady, chová se portál
     * přesně tak, jak se chová skutečnému klientovi nebo herci, a nikde
     * jinde se kvůli tomu nemuselo sáhnout do kódu.
     *
     * Který pohled to je, drží cookie prohlížeče - přepínač v liště ji
     * přepíše. Cookie sama nic neotevírá: uplatní se jen u účtu, který má
     * `jenNahled`, a jen na tři hodnoty z lib/nahledRole.ts. Kdyby si ji
     * někdo přepsal na cokoliv jiného, spadne to na výchozí pohled.
     *
     * `cookies()` je v try/catch: session se čte i mimo požadavek (třeba
     * z cronu) a tam by to spadlo - portál se kvůli prohlídce nemá rozbít.
     */
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).companyId = token.companyId;
        (session.user as any).jenNahled = token.jenNahled === true;
        (session.user as any).nahledVolba = null;

        if (token.jenNahled === true) {
          let vybrano: string | null = null;
          try {
            vybrano = cookies().get(NAHLED_COOKIE)?.value ?? null;
          } catch {
            vybrano = null;
          }
          const volba = nahledZHodnoty(vybrano);
          const pohled = pohledNahledu(volba);
          (session.user as any).role = pohled.role;
          (session.user as any).companyId = pohled.sVlastniFirmou
            ? (token.companyId ?? null)
            : null;
          (session.user as any).nahledVolba = volba;
        }
      }
      return session;
    },
  },
};
