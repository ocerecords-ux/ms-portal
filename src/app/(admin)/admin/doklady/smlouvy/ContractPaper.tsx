import { formatSignedAt } from '@/lib/contracts';

export type PaperSignature = {
  role: 'MEDIASPACE' | 'PROTISTRANA';
  name: string;
  email: string | null;
  imageData: string;
  signedAt: string;
  ip: string | null;
  documentHash: string;
};

/**
 * Samotný list smlouvy — text a pod ním podpisová doložka. Používá se
 * v administraci i na veřejné stránce k podpisu, aby obě strany viděly
 * úplně stejný dokument.
 */
export function ContractPaper({
  title,
  number,
  body,
  signatures,
  currentHash,
}: {
  title: string;
  number: string;
  body: string;
  signatures: PaperSignature[];
  /** Otisk textu, jak vypadá teď — porovnává se s otiskem u podpisů. */
  currentHash: string;
}) {
  const nase = signatures.find((s) => s.role === 'MEDIASPACE') ?? null;
  const protistrana = signatures.find((s) => s.role === 'PROTISTRANA') ?? null;

  return (
    <article className="bg-surface rounded-card border border-line shadow-sm overflow-hidden">
      <header className="px-6 sm:px-10 pt-8 pb-4 border-b border-line">
        <p className="text-xs font-heading text-muted uppercase tracking-wide m-0">Smlouva {number}</p>
        <h1 className="font-display text-2xl sm:text-3xl text-ink m-0 mt-1">{title}</h1>
      </header>

      <div className="px-6 sm:px-10 py-8">
        <pre className="font-body text-[15px] leading-relaxed text-ink whitespace-pre-wrap break-words m-0">
          {body}
        </pre>
      </div>

      <div className="px-6 sm:px-10 pb-10 grid grid-cols-1 sm:grid-cols-2 gap-8">
        <SignatureBox label="Za Mediaspace" signature={nase} currentHash={currentHash} />
        <SignatureBox label="Za protistranu" signature={protistrana} currentHash={currentHash} />
      </div>
    </article>
  );
}

function SignatureBox({
  label,
  signature,
  currentHash,
}: {
  label: string;
  signature: PaperSignature | null;
  currentHash: string;
}) {
  const sedi = signature ? signature.documentHash === currentHash : true;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-heading text-muted uppercase tracking-wide">{label}</span>
      <div className="h-[110px] border-b border-ink/30 flex items-end">
        {signature ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={signature.imageData} alt={`Podpis: ${signature.name}`} className="max-h-[104px] w-auto" />
        ) : (
          <span className="text-sm font-body text-muted pb-2">zatím nepodepsáno</span>
        )}
      </div>
      {signature && (
        <div className="text-[11px] font-body text-muted leading-relaxed">
          <span className="block font-heading font-semibold text-ink text-xs">{signature.name}</span>
          {signature.email && <span className="block">{signature.email}</span>}
          <span className="block">Podepsáno {formatSignedAt(signature.signedAt)}</span>
          {signature.ip && <span className="block">IP {signature.ip}</span>}
          <span className="block break-all">Otisk dokumentu {signature.documentHash.slice(0, 16).toUpperCase()}</span>
          {!sedi && (
            <span className="block mt-1 text-danger font-heading font-semibold">
              Pozor: text smlouvy se od tohoto podpisu změnil.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
