import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { extractDriveFolderId } from '@/lib/googleDrive';
import { isInternalRole } from '@/lib/roles';
import { DriveBrowser } from './DriveBrowser';

// Stejne jako u Projektu - stránka se skládá při každém zobrazení, takže
// stránka nesmí být Next.js zamrazená jako statická (viz komentář v
// src/app/(portal)/projekty/page.tsx).
export const dynamic = 'force-dynamic';

export default async function NahravkyPage({
  searchParams,
}: {
  searchParams?: { projekt?: string };
}) {
  const session = await getServerSession(authOptions);
  const companyId = session!.user.companyId;
  const company = companyId ? await prisma.company.findUnique({ where: { id: companyId } }) : null;

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
  const zdrojSlozky = projektovaSlozka ?? company?.driveFolderUrl ?? null;
  const folderId = zdrojSlozky ? extractDriveFolderId(zdrojSlozky) : null;
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
    ? 'Zatím vám nebyla přiřazena složka na Google Disku. Ozvěte se prosím Mediaspace.'
    : !projekt
      ? 'Tenhle projekt jsme nenašli. Zkuste prosím odkaz z e-mailu otevřít znovu, nebo se nám ozvěte.'
      : !projektJeJeho
        ? 'K tomuhle projektu nemá váš účet přístup. Ozvěte se prosím Mediaspace, doplníme to.'
        : 'U tohohle projektu zatím není vyplněná složka s nahrávkami. Ozvěte se prosím Mediaspace.';

  return (
    <section>
      <div className="mb-6">
        <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">Nahrávky</h1>
        {projektovaSlozka && projekt?.name && (
          <p className="text-sm font-body text-muted m-0 mt-2">
            Projekt <span className="text-ink font-heading font-semibold">{projekt.name}</span>
          </p>
        )}
      </div>

      {zdrojSlozky && folderId && driveConfigured ? (
        <DriveBrowser
          initialFolderId={folderId}
          rootName={projektovaSlozka && projekt?.name ? projekt.name : displayName}
        />
      ) : zdrojSlozky ? (
        <div className="bg-surface rounded-card border border-line p-8 flex flex-col items-start gap-4 max-w-xl mx-auto shadow-sm">
          <p className="text-sm font-body text-muted m-0">
            {projektovaSlozka && projekt?.name
              ? `Složka projektu ${projekt.name} na Google Disku. Otevře se v nové záložce.`
              : `Složka firmy ${displayName} na Google Disku obsahuje všechny vaše nahrávky. Otevře se v nové záložce.`}
          </p>
          <a
            href={zdrojSlozky}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-6 py-3 hover:bg-brand-purpleDeep transition-colors"
          >
            Otevřít složku na Google Disku ↗
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
