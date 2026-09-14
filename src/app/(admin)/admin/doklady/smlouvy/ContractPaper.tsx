import { formatSignedAt } from '@/lib/contracts';
import { rozdelNaStranky } from '@/lib/smlouvaStranky';

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
 *
 * OD 13. 9. 2026 VYPADÁ JAKO NÁŠ DOKUMENT (zadání: „pojďme ty smlouvy udělat
 * ještě trošku v našem brandu"). Fialová hlavička se značkou, zelená linka
 * a nadpisy ve fialové — herec dostane odkaz mailem a otevře se mu něco, co
 * se hlásí k Mediaspace, ne holý text na bílé.
 */
export function ContractPaper({
  title,
  number,
  body,
  signatures,
  currentHash,
  potvrzovani,
}: {
  title: string;
  number: string;
  body: string;
  signatures: PaperSignature[];
  /** Otisk textu, jak vypadá teď — porovnává se s otiskem u podpisů. */
  currentHash: string;
  /**
   * ODKLIKÁVÁNÍ STRÁNEK (zadání 13. 9. 2026: „aby jsi odklikával i jednotlivé
   * stránky, jak je to třeba u Signi"). Když je to vyplněné, text se rozdělí
   * na stránky a pod každou přibude potvrzení.
   *
   * Nepovinné schválně: v administraci se smlouva jen čte a odklikávat tam
   * není co. Sazba textu zůstává tatáž, takže obě strany pořád vidí identický
   * dokument — jen jedna z nich ho prochází po stránkách.
   */
  potvrzovani?: {
    potvrzene: number[];
    onPotvrdit: (index: number) => void;
  };
}) {
  const nase = signatures.find((s) => s.role === 'MEDIASPACE') ?? null;
  const protistrana = signatures.find((s) => s.role === 'PROTISTRANA') ?? null;

  return (
    <article className="bg-surface rounded-card border border-line shadow-sm overflow-hidden">
      <header className="bg-gradient-to-b from-brand-purple to-brand-purpleDeep px-6 sm:px-10 pt-6 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-heading text-brand-green uppercase tracking-[0.14em] m-0">
              Smlouva {number}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl text-white m-0 mt-1 break-words">{title}</h1>
          </div>
          {/* Statické logo, ne animovaný gif — na dokumentu by poskakovalo. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mediaspace-logo-still.png"
            alt="Mediaspace"
            className="h-9 sm:h-11 w-auto shrink-0 mt-0.5"
          />
        </div>
      </header>
      <div className="h-1 bg-brand-green" aria-hidden="true" />

      {potvrzovani ? (
        <StrankyKPotvrzeni body={body} potvrzovani={potvrzovani} />
      ) : (
        <div className="px-6 sm:px-10 py-8 font-body text-[15px] leading-relaxed text-ink">
          <TextSmlouvy body={body} />
        </div>
      )}

      <div className="px-6 sm:px-10 pb-10 grid grid-cols-1 sm:grid-cols-2 gap-8">
        <SignatureBox label="Za Mediaspace" signature={nase} currentHash={currentHash} />
        <SignatureBox label="Za protistranu" signature={protistrana} currentHash={currentHash} />
      </div>

      <footer className="border-t border-line px-6 sm:px-10 py-3 flex items-center justify-between gap-3">
        <span className="font-body font-semibold text-sm text-brand-purple">Mediaspace</span>
        <span className="text-[11px] font-body text-muted">Smlouva {number}</span>
      </footer>
    </article>
  );
}

/**
 * Smlouva rozdělená na stránky, každá s vlastním potvrzením.
 *
 * PROČ VŮBEC: u Signi člověk projde dokument stránku po stránce a je z toho
 * doložitelné, že ho viděl celý. Tady stránky nejsou v textu vyznačené —
 * počítá je lib/smlouvaStranky.ts deterministicky z těla, takže se dají
 * kdykoliv spočítat znovu a ověřit, co přesně bylo na které.
 *
 * Potvrzení JDE VZÍT ZPĚT. Je to „četl jsem", ne podpis; podpis je až ten
 * dole a ten vzít zpět nejde.
 */
function StrankyKPotvrzeni({
  body,
  potvrzovani,
}: {
  body: string;
  potvrzovani: { potvrzene: number[]; onPotvrdit: (index: number) => void };
}) {
  const stranky = rozdelNaStranky(body);

  return (
    <div className="flex flex-col">
      {stranky.map((stranka, i) => {
        const potvrzena = potvrzovani.potvrzene.includes(i);
        return (
          <div key={i} className={i > 0 ? 'border-t border-line' : undefined}>
            <div className="px-6 sm:px-10 pt-6 flex items-center justify-between gap-3">
              <span className="text-[11px] font-heading text-muted uppercase tracking-wide">
                Strana {i + 1} z {stranky.length}
              </span>
              {potvrzena && (
                <span className="text-[11px] font-heading font-semibold text-brand-greenDeep dark:text-brand-green">
                  Přečteno
                </span>
              )}
            </div>
            <div className="px-6 sm:px-10 py-5 font-body text-[15px] leading-relaxed text-ink">
              {/* Velky titul smlouvy patri jen na prvni stranku. */}
              <TextSmlouvy body={stranka} titulek={i === 0} />
            </div>
            <div className="px-6 sm:px-10 pb-6">
              <button
                type="button"
                onClick={() => potvrzovani.onPotvrdit(i)}
                aria-pressed={potvrzena}
                className={`w-full rounded-card border-2 px-4 py-3 text-sm font-heading font-semibold transition-colors ${
                  potvrzena
                    ? 'border-brand-green bg-brand-green/10 text-brand-greenDeep dark:text-brand-green'
                    : 'border-dashed border-line text-muted hover:border-brand-purple hover:text-brand-purple'
                }`}
              >
                {potvrzena ? `Strana ${i + 1} přečtena — klepnutím zrušíte` : `Přečetl jsem stranu ${i + 1}`}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Text smlouvy se sazbou. Je to pořád jeden kus textu — nic se nepřepisuje
 * ani nepřeskupuje, jen se podle tvaru řádku pozná, co je nadpis.
 *
 * Proč vůbec: smlouva psaná v jednom `pre` vypadá jako výpis z terminálu
 * a v pěti stránkách se v ní nedá nic najít. Pravidla jsou schválně hloupá
 * a spolehlivá — VELKÁ PÍSMENA a římská číslice jsou nadpis, zbytek je text,
 * takže si do šablony může kdokoliv psát vlastní články a sazba drží.
 */
export function TextSmlouvy({ body, titulek = true }: { body: string; titulek?: boolean }) {
  const radky = body.replace(/\r\n/g, '\n').split('\n');
  // Velky nadpis se sazi jen z PRVNI stranky (zadani 13. 9. 2026) - na druhe
  // strance uz je prvni radek obycejny text, ne titul smlouvy.
  let prvniNeprazdny = titulek;

  return (
    <div className="flex flex-col">
      {radky.map((radek, i) => {
        const text = radek.trim();
        if (!text) return <div key={i} className="h-3.5" aria-hidden="true" />;

        const jeTitulek = prvniNeprazdny;
        prvniNeprazdny = false;

        if (jeTitulek) {
          return (
            <h2
              key={i}
              className="font-display text-xl sm:text-2xl text-ink text-center uppercase tracking-wide m-0 mb-2"
            >
              {text}
            </h2>
          );
        }

        const druh = druhRadku(text);

        if (druh === 'nadpis') {
          return (
            <h3
              key={i}
              className="font-heading font-semibold text-sm sm:text-base text-brand-purple uppercase tracking-wide m-0 mt-5 mb-1"
            >
              {text}
            </h3>
          );
        }

        if (druh === 'popisek') {
          return (
            <p key={i} className="font-heading font-semibold text-ink m-0">
              {text}
            </p>
          );
        }

        return (
          <p key={i} className="m-0 whitespace-pre-wrap break-words">
            {radek}
          </p>
        );
      })}
    </div>
  );
}

/** Nadpis / popisek strany / běžný odstavec — podle tvaru řádku. */
function druhRadku(text: string): 'nadpis' | 'popisek' | 'text' {
  if (text.length > 90) return 'text';

  // Řádek s dvojtečkou nadpis není — je to údaj („IČO: 07459424 DIČ: …",
  // „RČ: 666008/1549"), a ten by se jinak vysázel jako článek smlouvy.
  if (!text.includes(':')) {
    // VELKÁ PÍSMENA napříč celým řádkem: „1. PŘEDMĚT SMLOUVY", „ODMĚNA".
    // Číslo článku se odřízne, zbytek už nesmí mít číslice ani malá písmena.
    const bezCisla = text.replace(/^[\dIVXL]+([.)]\d*)*[.)]?\s+/i, '');
    const pismena = bezCisla.replace(/[^\p{L}]/gu, '');
    if (
      pismena.length >= 3 &&
      !/\d/.test(bezCisla) &&
      pismena === pismena.toLocaleUpperCase('cs-CZ')
    ) {
      return 'nadpis';
    }
    // Římská číslice na začátku: „I. Úvodní ustanovení". Body článků jsou
    // číslované arabsky, takže se sem nepletou.
    if (/^[IVXL]{1,5}\.\s+\p{Lu}/u.test(text)) return 'nadpis';
  }

  // „Zhotovitel:", „Objednatel:" — popisek, za kterým jde adresa.
  if (text.length <= 40 && text.endsWith(':') && !/^\d/.test(text)) return 'popisek';
  return 'text';
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
      <span className="text-xs font-heading text-brand-purple uppercase tracking-wide">{label}</span>
      <div className="h-[110px] border-b-2 border-brand-purple/35 flex items-end">
        {signature ? (
          /* Podpis je tmavý inkoust — v tmavém režimu by na podkladu stránky
             zanikl, takže si nese vlastní bílý papír (zadání 13. 9. 2026). */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={signature.imageData}
            alt={`Podpis: ${signature.name}`}
            className="max-h-[104px] w-auto bg-white rounded px-1"
          />
        ) : (
          <span className="text-sm font-body text-muted pb-2">zatím nepodepsáno</span>
        )}
      </div>
      {signature && (
        <div className="text-[11px] font-body text-muted leading-relaxed rounded-lg bg-tint px-3 py-2">
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
