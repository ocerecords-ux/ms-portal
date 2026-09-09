import { Role } from '@prisma/client';
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: Role;
      companyId: string | null;
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
  }
}
