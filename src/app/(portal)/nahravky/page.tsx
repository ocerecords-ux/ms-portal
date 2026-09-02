import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// Z ruzne tvarovanych Google Disk odkazu (/folders/ID, ?id=ID, se zkracovacem apod.)
// vytahneme samotne ID slozky, ktere potrebujeme pro vlozeny (embedded) nahled.
function extractDriveFolderId(url: string): string | null {
  const patterns = [/\/folders\/([a-zA-Z0-9_-]{10,})/, /[?&]id=([a-zA-Z0-9_-]{10,})/];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export default async function NahravkyPage() {
  const session = await getServerSession(authOptions);
  const companyId = session!.user.companyId;
  const company = companyId ? await prisma.company.findUnique({ where: { id: companyId } }) : null;

  const folderId = company?.driveFolderUrl ? extractDriveFolderId(company.driveFolderUrl) : null;

  return (
    <section>
      <div className="mb-6">
        <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">Nahrávky</h1>
        <p className="text-muted text-sm mt-1 font-body">Vaše hotové i rozpracované nahrávky na Google Disku</p>
      </div>

      {company?.driveFolderUrl && folderId ? (
        <div className="rounded-card overflow-hidden border border-line shadow-sm max-w-4xl">
          <div className="bg-brand-purple px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-green shrink-0" />
              <p className="text-white font-heading font-semibold text-sm m-0">
                Složka firmy {company.name} na Google Disku
              </p>
            </div>
            <a
              href={company.driveFolderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 border-2 border-brand-green text-brand-green font-heading font-semibold text-xs rounded-lg px-4 py-2 hover:bg-brand-green hover:text-brand-purpleDark transition-colors shrink-0"
            >
              Otevřít v Google Disku ↗
            </a>
          </div>
          <div className="bg-white">
            <iframe
              src={`https://drive.google.com/embeddedfolderview?id=${folderId}#grid`}
              title="Nahrávky na Google Disku"
              className="w-full h-[70vh] min-h-[420px] border-0 block"
            />
          </div>
          <div className="bg-field px-6 py-3 border-t border-line">
            <p className="text-xs text-muted font-body m-0">
              Nevidíte soubory? Zkontrolujte, že je složka v Google Disku sdílená pro váš účet, nebo ji otevřete přímo
              tlačítkem výše.
            </p>
          </div>
        </div>
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
