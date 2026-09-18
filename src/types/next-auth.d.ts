import { Role } from '@prisma/client';
import type { NahledVolba } from '@/lib/nahledRole';
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      /**
       * ROLE, KTEROU PORTÁL PRÁVĚ POUŽÍVÁ. U běžného účtu je to role z jeho
       * karty. U náhledového účtu (`jenNahled`) je to role, kterou si zrovna
       * půjčil - viz lib/nahledRole.ts. Celý portál se tak chová přesně tak,
       * jak se chová skutečnému klientovi, herci nebo produkci.
       */
      role: Role;
      companyId: string | null;
      /** Účet je jen na prohlížení - nic z něj neuloží (zadání 18. 9. 2026). */
      jenNahled?: boolean;
      /** Který pohled si náhledový účet zrovna půjčil; u ostatních null. */
      nahledVolba?: NahledVolba | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: Role;
    companyId: string | null;
    /** Kdy se role naposledy overila proti databazi (viz jwt callback). */
    overenoAt?: number;
    /** Ucet je vypnuty nebo smazany - middleware takovy token nepusti dal. */
    neaktivni?: boolean;
    /**
     * Ucet je jen na prohlizeni (zadani 18. 9. 2026). Je v tokenu schvalne:
     * middleware podle nej zamyka zapis a do databaze se z middleware nechodi.
     */
    jenNahled?: boolean;
  }
}
