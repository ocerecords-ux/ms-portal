import { withAuth } from 'next-auth/middleware';

// Vse pod (portal) i (admin) skupinou vyzaduje prihlaseni; /admin navic
// vyzaduje roli ADMIN (interni pracovnik Mediaspace). Kazda admin API
// route si roli navic overuje sama (obrana do hloubky).
export default withAuth({
  callbacks: {
    authorized: ({ token, req }) => {
      if (!token) return false;
      // Ucet mezitim vypnuty nebo smazany (viz jwt callback v lib/auth.ts).
      if (token.neaktivni) return false;
      if (req.nextUrl.pathname.startsWith('/admin') && token.role !== 'ADMIN') return false;
      return true;
    },
  },
});

export const config = {
  matcher: [
    '/projekty/:path*',
    '/objednavka/:path*',
    // Jen prehled nahravek pro prihlasene. Podstranka /nahravky/<token> je
    // otevreny odkaz pro klienta z mailu (zadani 11. 9. 2026: „potrebuju, at
    // se klient nemusi prihlasovat a jsou ty odkazy otevrene") - kdyby sem
    // spadla, poslala by ho middleware na prihlaseni driv, nez token vubec
    // nekdo precte.
    '/nahravky',
    '/muj-ucet/:path*',
    '/vykazy/:path*',
    '/kalendar/:path*',
    '/moje-terminy/:path*',
    '/admin/:path*',
  ],
};
