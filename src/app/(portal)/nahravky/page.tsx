import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { extractDriveFolderId } from '@/lib/googleDrive';
import { isInternalRole } from '@/lib/roles';
import { DriveBrowser } from './DriveBrowser';
import { slozkyProUzivatele } from '@/lib/diskoveSlozkyServer';
import { nactiJazyk } from '@/lib/jazykServer';
import { prelozit, prelozitS } from '@/lib/jazyk';

// Stejne jako u Projektu - stránka se skládá při každém zobrazení, takže
// stránka nesmí být Next.js zamrazená jako statická (viz komentář v
// src/app/(portal)/projekty/page.tsx).
export const dynamic = 'force-dynamic';

export default async function NahravkyPage({
  searchParams,
}: {
  searchParams?: { projekt?: string; slozka?: string };
}) {
  const session = await getServerSession(authOptions);
  const jazyk = nactiJazyk();
  const companyId = session!.user.companyId;
  const company = companyId ? await prisma.company.findUnique({ where: { id: companyId } }) : null;

  /**
   * PŘIDĚLENÉ SLOŽKY (zadání 30. 9. 2026: „máme na disku složky: Klientská
   * zóna, Dokumenty, Marketing. Potřebuju, ať někteří uživatelé nevidí
   * některé složky. Teď vidí všechno").
   *
   * Nabídne se jen to, co má člověk zaškrtnuté na kartě účtu. Kdo složku
   * nemá, o ní z portálu nezjistí ani to, že existuje - v přepínači není.
   */
  const slozky = await slozkyProUzivatele(session!.user.id);
  const vybranaZAdresy = searchParams?.slozka
    ? (slozky.find((s) => s.id === searchParams.slozka) ?? null)
    : null;

  /**
   * Otevření rovnou na složce jednoho projektu (zadání 10. 9. 2026: „když
   * budeme posílat notifikace na klienta s odkazem na disk na nahrávky, chci,
   * ať se mu to otevře v tom našem Disku, obrandovaném, v barvách. Ne na
   * Google disku").
   *
   * V adrese je ID PROJEKTU, ne složky. Kdyby tam bylo ID složky, stačilo by
   * ho uhodnout a klient by koukal do složky cizí firmy. Takhle se ověří, že
   * projekt člověku patří, a teprve pak se použije jeho složka.
   */
  const projekt = searchParams?.projekt
    ? await prisma.projectMeta.findUnique({
        where: { caflouProjectId: searchParams.projekt },
        select: { name: true, driveUrl: true, companyId: true, klientUserId: true },
      })
    : null;

  /**
   * KDO NA SLOŽKU PROJEKTU SMÍ (opraveno 11. 9. 2026: „šel mail na klienta
   * s tímto odkazem a on se tam nedostane").
   *
   * Do té doby se porovnávala jenom firma přihlášeného účtu s firmou
   * projektu. Tým Mediaspace ale žádnou firmu u účtu nemá, takže na svou
   * vlastní nahrávku koukal na hlášku „zatím vám nebyla přiřazena složka" —
   * a klient, který má u projektu vyplněné jméno, ale u účtu jinou nebo
   * žádnou firmu, na tom byl stejně.
   *
   * Teď platí tři cesty dovnitř, stejně jako u přeposlechu: tým vidí
   * všechno, klient přiřazený k projektu vidí ten projekt, a klient dané
   * firmy vidí projekty své firmy.
   */
  const jeInterni = isInternalRole(session!.user.role);
  const projektJeJeho = Boolean(
    projekt &&
      (jeInterni ||
        projekt.klientUserId === session!.user.id ||
        (companyId && projekt.companyId === companyId)),
  );
  const projektovaSlozka = projektJeJeho && projekt?.driveUrl ? projekt.driveUrl : null;

  // Obchodni nazev firmy drzi od 11. 9. 2026 portal (karta firmy). Do te doby
  // se tahal pri kazdem zobrazeni z Caflou, aby souhlasil vcetne "s.r.o.".
  const displayName = company?.name ?? '';

  // Slozka projektu ma prednost pred slozkou firmy - klient prisel z mailu
  // o konkretnim projektu a nema se proklikavat celym archivem.
  /**
   * Na co se člověk dívá, když si nic nevybral. Tým Mediaspace u účtu žádnou
   * firmu nemá, takže dřív viděl jen „zatím vám nebyla přiřazena složka" -
   * teď se mu otevře první přidělená složka a přepínač nabídne zbytek.
   * Klient se svou firemní složkou zůstává tam, kde byl.
   */
  const zvolenaSlozka =
    vybranaZAdresy ??
    (!projektovaSlozka && !company?.driveFolderUrl && slozky.length > 0 ? slozky[0] : null);

  // Přidělená složka má přednost před vším: člověk si ji sám vybral
  // v přepínači, takže se nemá po překreslení stránky vrátit jinam.
  const zdrojSlozky = zvolenaSlozka
    ? `https://drive.google.com/drive/folders/${zvolenaSlozka.rootId}`
    : (projektovaSlozka ?? company?.driveFolderUrl ?? null);
  const folderId = zvolenaSlozka
    ? zvolenaSlozka.rootId
    : zdrojSlozky
      ? extractDriveFolderId(zdrojSlozky)
      : null;
  const driveConfigured = Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  );

  /**
   * Když se nic neukáže, musí být vidět PROČ. Prázdná hláška „zatím vám
   * nebyla přiřazena složka" byla u odkazu z mailu matoucí: člověk přišel na
   * konkrétní projekt a nedozvěděl se, jestli je něco špatně s ním, s účtem,
   * nebo s projektem.
   */
  const duvodPrazdna = !searchParams?.projekt
    ? prelozit(jazyk, 'nahravky.bezSlozky')
    : !projekt
      ? prelozit(jazyk, 'nahravky.projektNenalezen')
      : !projektJeJeho
        ? prelozit(jazyk, 'nahravky.bezPristupu')
        : prelozit(jazyk, 'nahravky.projektBezSlozky');

  return (
    <section>
      <div className="mb-6">
        <h1 className="hidden sm:block font-display text-3xl sm:text-4xl text-ink m-0">{prelozit(jazyk, 'nahravky.nadpis')}</h1>
        {projektovaSlozka && projekt?.name && (
          <p className="text-sm font-body text-muted m-0 mt-2">
            {prelozit(jazyk, 'nahravky.projekt')}{' '}
            <span className="text-ink font-heading font-semibold">{projekt.name}</span>
          </p>
        )}
      </div>

      {/*
        * PŘEPÍNAČ SLOŽEK (zadání 30. 9. 2026). Ukáže se, jen když je z čeho
        * vybírat - u klienta s jednou složkou firmy by to byl jen řádek navíc.
        * Jsou to obyčejné odkazy, ne tlačítka: složka se tak dá poslat
        * a otevřít v nové záložce, a stránka zůstane serverová.
        */}
      {slozky.length > 0 && !projektovaSlozka && (
        <nav className="flex flex-wrap gap-2 mb-6">
          {company?.driveFolderUrl && (
            <a
              href="/nahravky"
              className={`font-heading text-sm rounded-lg px-4 py-2 border transition-colors ${
                zvolenaSlozka
                  ? 'border-line text-muted hover:text-ink hover:border-ink'
                  : 'border-brand-purple bg-brand-purple text-white'
              }`}
            >
              {displayName || prelozit(jazyk, 'nahravky.nadpis')}
            </a>
          )}
          {slozky.map((s) => (
            <a
              key={s.id}
              href={`/nahravky?slozka=${encodeURIComponent(s.id)}`}
              title={s.popis ?? undefined}
              className={`font-heading text-sm rounded-lg px-4 py-2 border transition-colors ${
                zvolenaSlozka?.id === s.id
                  ? 'border-brand-purple bg-brand-purple text-white'
                  : 'border-line text-muted hover:text-ink hover:border-ink'
              }`}
            >
              {s.nazev}
            </a>
          ))}
        </nav>
      )}

      {zdrojSlozky && folderId && driveConfigured ? (
        /*
         * `key` je tu schválně (stejná chyba jako u studií v administraci
         * 30. 9. 2026): DriveBrowser si cestu složkami drží ve vlastním
         * stavu, který se ze vstupů počítá jen při prvním vykreslení. Bez
         * `key` by React po přepnutí složky použil tutéž komponentu a člověk
         * by koukal do nové složky se starou drobečkovou cestou.
         */
        <DriveBrowser
          key={zvolenaSlozka?.id ?? 'firma'}
          initialFolderId={folderId}
          slozkaId={zvolenaSlozka?.id ?? null}
          rootName={
            zvolenaSlozka
              ? zvolenaSlozka.nazev
              : projektovaSlozka && projekt?.name
                ? projekt.name
                : displayName
          }
        />
      ) : zdrojSlozky ? (
        <div className="bg-surface rounded-card border border-line p-8 flex flex-col items-start gap-4 max-w-xl mx-auto shadow-sm">
          <p className="text-sm font-body text-muted m-0">
            {projektovaSlozka && projekt?.name
              ? prelozitS(jazyk, 'nahravky.slozkaProjektu', { nazev: projekt.name })
              : prelozitS(jazyk, 'nahravky.slozkaFirmy', { nazev: displayName })}
          </p>
          <a
            href={zdrojSlozky}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-6 py-3 hover:bg-brand-purpleDeep transition-colors"
          >
            {prelozit(jazyk, 'nahravky.otevritNaDisku')}
          </a>
        </div>
      ) : (
        <div className="bg-surface rounded-card border border-line p-8 max-w-xl mx-auto shadow-sm">
          <p className="text-sm font-body text-muted m-0">{duvodPrazdna}</p>
        </div>
      )}
    </section>
  );
}
