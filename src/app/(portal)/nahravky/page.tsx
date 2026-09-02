import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { extractDriveFolderId } from '@/lib/googleDrive';
import { DriveBrowser } from './DriveBrowser';

export default async function NahravkyPage() {
  const session = await getServerSession(authOptions);
  const companyId = session!.user.companyId;
  const company = companyId ? await prisma.company.findUnique({ where: { id: companyId } }) : null;

  const folderId = company?.driveFolderUrl ? extractDriveFolderId(company.driveFolderUrl) : null;
  const driveConfigured = Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  );

  return (
    <section>
      <div className="mb-6">
        <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">Nahrávky</h1>
        <p className="text-muted text-sm mt-1 font-body">Vaše hotové i rozpracované nahrávky na Google Disku</p>
      </div>

      {company?.driveFolderUrl && folderId && driveConfigured ? (
        <DriveBrowser initialFolderId={folderId} rootName={company.name} />
      ) : company?.driveFolderUrl ? (
        <div className="bg-white rounded-card border border-line p-8 flex flex-col items-start gap-4 max-w-xl shadow-sm">
          <p className="text-sm font-body text-muted m-0">
            Složka firmy {company.name} na Google Disku obsahuje všechny vaše nahrávky. Otevře se v nové záložce.
          </p>
          <a
            href={company.driveFolderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-6 py-3 hover:bg-brand-purpleDeep transition-colors"
          >
            Otevřít složku na Google Disku ↗
          </a>
        </div>
      ) : (
        <div className="bg-white rounded-card border border-line p-8 max-w-xl shadow-sm">
          <p className="text-sm font-body text-muted m-0">
            Zatím vám nebyla přiřazena složka na Google Disku. Ozvěte se prosím MEDIA SPACE.
          </p>
        </div>
      )}
    </section>
  );
}
