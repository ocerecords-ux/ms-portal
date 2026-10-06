import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import { ZPRAVA_JEN_NAHLED } from '@/lib/nahledRole';
import { maPristup, podlehaPristupum, sekceCesty } from '@/lib/pristupy';

// Vse pod (portal) i (admin) skupinou vyzaduje prihlaseni; /admin navic
// vyzaduje roli ADMIN (interni pracovnik Mediaspace). Kazda admin API
// route si roli navic overuje sama (obrana do hloubky).

/** Pozadavky, ktere jen ctou - ty nahledovy ucet samozrejme smi. */
const JEN_CTENI = ['GET', 'HEAD', 'OPTIONS'];

/**
 * ZÁMEK NÁHLEDOVÉHO ÚČTU (zadání 18. 9. 2026: „profil pro uživatele, který
 * nemůže nic měnit").
 *
 * Stojí tady, a ne v jednotlivých obrazovkách, schválně. Portál má stovky
 * tlačítek a přes dvě stě API rout; kdyby se to hlídalo v každé zvlášť,
 * první zapomenutá by celý slib zrušila. Tady je to jedno pravidlo: z účtu
 * s příznakem `jenNahled` neprojde nic, co zapisuje.
 *
 * Výjimka je jen `/api/auth` - přihlásit a odhlásit se ten člověk musí.
 *
 * Co tím zamčené NENÍ: co si portál zapíše sám při vykreslení stránky
 * (založení výchozí lišty při prvním přihlášení, uvolnění propadlých
 * rezervací, statistika otevření odkazu). To nejsou úpravy dat, to je
 * úklid, který běží každému stejně.
 */
export default withAuth(
  function middleware(req) {
    const token = req.nextauth?.token as { jenNahled?: boolean } | null | undefined;
    if (!token?.jenNahled) return NextResponse.next();

    if (req.nextUrl.pathname.startsWith('/api/auth')) return NextResponse.next();
    if (JEN_CTENI.includes(req.method)) return NextResponse.next();

    // Formulare v portalu vypisuji `error` z odpovedi, takze se clovek dozvi
    // jednou vetou, proc se nic neulozilo - misto tiche chyby.
    return NextResponse.json({ error: ZPRAVA_JEN_NAHLED }, { status: 403 });
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const cesta = req.nextUrl.pathname;

        /**
         * API ROUTY SI PRIHLASENI RESI SAMY a nektere jsou schvalne otevrene
         * (odkazy pro klienta na nahravky, preposlech, pripominky, cron).
         * Middleware je tu ma jen kvuli zamku vyse - kdyby tady rozhodoval
         * o pristupu, poslal by klienta s platnym tokenem na prihlaseni.
         */
        if (cesta.startsWith('/api')) return true;

        if (!token) return false;
        // Ucet mezitim vypnuty nebo smazany (viz jwt callback v lib/auth.ts).
        if (token.neaktivni) return false;
        /**
         * Do administrace nahledovy ucet nesmi ani omylem. Role v tokenu je
         * ta z jeho karty (pujcena role je az v session), takze by ho sem
         * pustilo, kdyby mel na karte Zuzo-labuzo - a administrace jsou
         * doklady, banka a osobni udaje lidi. To neni nic na vyzkouseni.
         */
        if (cesta.startsWith('/admin')) {
          if (token.jenNahled) return false;
          /**
           * ZAŠKRTÁVÁTKA SEKCÍ PLATÍ I TADY (oprava 6. 10. 2026: „Tomáš
           * Ilavský už vidí Studia, ale po kliknutí na Studia na hlavní liště
           * se mu to odhlásí").
           *
           * Od 28. 9. 2026 rozhodují o přístupu zaškrtávátka na kartě
           * uživatele, jenže middleware znal jen roli. Zvukař se zaškrtnutým
           * *Nastavení studií* si odkaz do lišty přidal, klepl na něj
           * a middleware ho poslal na přihlášení - z jeho pohledu ho portál
           * odhlásil.
           *
           * Zaškrtávátka pokrývají jen ty cesty, které jsou v lib/pristupy.ts
           * vypsané (Doklady, Studia, Firmy, Ceníky, Zprávy portálu, Procesy,
           * Technické parametry, Údaje). Zbytek administrace - uživatelé,
           * archiv, Bruno, návody - zůstává jen pro Žůžo-labůžo.
           */
          if (token.role === 'ADMIN') return true;
          if (!podlehaPristupum(String(token.role))) return false;
          const sekce = sekceCesty(cesta);
          if (!sekce) return false;
          return maPristup(
            {
              role: String(token.role),
              superadmin: token.superadmin === true,
              pristupy: Array.isArray(token.pristupy) ? (token.pristupy as string[]) : [],
            },
            sekce,
          );
        }
        return true;
      },
    },
  },
);

export const config = {
  matcher: [
    '/projekty/:path*',
    '/backlog/:path*',
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
    '/prehledy/:path*',
    '/moje-terminy/:path*',
    '/pozvanky/:path*',
    // Site - priprava prispevku na IG a LinkedIn (27. 9. 2026).
    '/site/:path*',
    '/palubovka',
    // Kalendář rezervací studia (25. 9. 2026) - vlastní sekce mimo portál.
    '/studio/:path*',
    '/doplnit-udaje/:path*',
    '/admin/:path*',
    // API je tu JEN kvuli zamku nahledoveho uctu (zadani 18. 9. 2026) -
    // pristup si kazda routa dal resi sama, viz `authorized` vyse.
    '/api/:path*',
  ],
};
