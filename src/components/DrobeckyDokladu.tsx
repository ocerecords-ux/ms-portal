import Link from 'next/link';
import { prelozit, type Jazyk } from '@/lib/jazyk';

/**
 * LINKA HISTORIE NAD DOKLADEM (připomínka Báry Šíblové 7. 10. 2026: „Vrátit se
 * zpět na projekt po vystavení dokladu. Když rozkliknu nabídku, tak se dostanu
 * do dokladů a nabídne mi to pouze se vrátit zpět a doklady, ale co když se
 * chci vrátit na projekt a tam ještě něco udělat, ukončit atd. Bylo by
 * pohodlnější, kdyby se držela linka historie.")
 *
 * Doklad se skoro vždycky zakládá OD PROJEKTU a práce na něm projektem zase
 * končí - ukončit, doplnit výkaz, poslat klientovi. Jediný odkaz „zpět na
 * nabídky" tu cestu usekl a člověk se na projekt proklikával znovu přes seznam.
 *
 * Druhá polovina je karta firmy (připomínka týž den: „Když se tohle stane
 * např. při posílání dokladu - a některé firmy nemají zadaný email - tak musím
 * zbytečně jít přes firmy a hledat to tam."). Odkaz se ukáže jen tomu, kdo na
 * karty firem opravdu smí; ostatním zůstane jen jméno, ne mrtvý odkaz.
 *
 * Co doklad neví, to se nevykreslí: výdaj bez projektu ukáže jen „zpět",
 * smlouva bez firmy jen projekt.
 */
export function DrobeckyDokladu({
  zpetHref,
  zpetPopisek,
  projekt,
  firma,
  smiNaFirmu = false,
  jazyk,
}: {
  /** Seznam, ze kterého se sem chodí - Nabídky, Faktury, Výdaje, Smlouvy. */
  zpetHref: string;
  /** Hotový popisek včetně šipky, jak ho má každá sekce svůj. */
  zpetPopisek: string;
  /** Projekt, ke kterému je doklad navázaný; bez něj se článek vynechá. */
  projekt?: { id: string; nazev: string } | null;
  /** Protistrana dokladu - odběratel u nabídky a faktury, dodavatel u výdaje. */
  firma?: { id: string; nazev: string } | null;
  /** Smí přihlášený člověk na /admin/companies? Zjišťuje se na serveru. */
  smiNaFirmu?: boolean;
  jazyk: Jazyk;
}) {
  const clanek =
    'text-muted text-sm font-heading no-underline hover:text-brand-purple transition-colors';

  return (
    <nav className="flex items-center gap-2 flex-wrap text-sm font-heading text-muted">
      <Link href={zpetHref} className={clanek}>
        {zpetPopisek}
      </Link>

      {projekt?.id && (
        <>
          <span aria-hidden="true" className="text-line">
            ·
          </span>
          <Link
            href={`/projekty/${encodeURIComponent(projekt.id)}`}
            title={prelozit(jazyk, 'drobecky.naProjekt')}
            className={clanek}
          >
            {prelozit(jazyk, 'drobecky.projekt')}: {projekt.nazev || projekt.id}
          </Link>
        </>
      )}

      {smiNaFirmu && firma?.id && (
        <>
          <span aria-hidden="true" className="text-line">
            ·
          </span>
          <Link
            href={`/admin/companies/${encodeURIComponent(firma.id)}`}
            title={prelozit(jazyk, 'drobecky.naFirmu')}
            className={clanek}
          >
            {prelozit(jazyk, 'drobecky.firma')}: {firma.nazev}
          </Link>
        </>
      )}
    </nav>
  );
}
