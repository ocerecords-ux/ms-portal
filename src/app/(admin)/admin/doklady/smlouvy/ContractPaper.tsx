import { formatSignedAt, popisekDruheStrany, popisekNaseStrany } from '@/lib/contracts';

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
  issuerName,
}: {
  title: string;
  number: string;
  body: string;
  signatures: PaperSignature[];
  /** Otisk textu, jak vypadá teď — porovnává se s otiskem u podpisů. */
  currentHash: string;
  /** Naše firma - píše se k podpisu („Za MEDIA SPACE s.r.o."). */
  issuerName?: string | null;
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

      <div className="px-6 sm:px-10 py-8 font-body text-[15px] leading-relaxed text-ink">
        <TextSmlouvy body={body} />
      </div>

      <div className="px-6 sm:px-10 pb-10 grid grid-cols-1 sm:grid-cols-2 gap-8">
        <SignatureBox label={popisekNaseStrany(issuerName)} signature={nase} currentHash={currentHash} />
        <SignatureBox label={popisekDruheStrany(body)} signature={protistrana} currentHash={currentHash} />
      </div>

      <footer className="border-t border-line px-6 sm:px-10 py-3 flex items-center justify-between gap-3">
        <span className="font-body font-semibold text-sm text-brand-purple">Mediaspace</span>
        <span className="text-[11px] font-body text-muted">Smlouva {number}</span>
      </footer>
    </article>
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
              {bezHvezdicek(text)}
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
              {bezHvezdicek(text)}
            </h3>
          );
        }

        if (druh === 'popisek') {
          return (
            <p key={i} className="font-heading font-semibold text-ink m-0">
              {bezHvezdicek(text)}
            </p>
          );
        }

        return (
          <p key={i} className="m-0 whitespace-pre-wrap break-words">
            <STucnym text={radek} />
          </p>
        );
      })}
    </div>
  );
}

/** Hvězdičky v nadpisu nemají co dělat - tam se sází tučně všechno. */
function bezHvezdicek(text: string): string {
  return text.replace(/\*\*/g, '');
}

/**
 * TUČNÉ KOUSKY V TEXTU (zadání 15. 9. 2026: „důležité věci bych zvýraznil
 * tučně"). V šabloně se píší jako **takhle** - stejný zápis, jaký portál
 * používá ve zprávách klientům, a stejně se sází i do PDF (lib/smlouvaPdf).
 */
export function STucnym({ text }: { text: string }) {
  const kousky = text.split(/(\*\*[^*]+\*\*)/g).filter((k) => k !== '');
  return (
    <>
      {kousky.map((kousek, i) =>
        kousek.startsWith('**') && kousek.endsWith('**') && kousek.length > 4 ? (
          <strong key={i} className="font-semibold">
            {kousek.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{kousek}</span>
        ),
      )}
    </>
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
          signature.imageData ? (
            /* Podpis je tmavý inkoust — v tmavém režimu by na podkladu stránky
               zanikl, takže si nese vlastní bílý papír (zadání 13. 9. 2026). */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={signature.imageData}
              alt={`Podpis: ${signature.name}`}
              className="max-h-[104px] w-auto bg-white rounded px-1"
            />
          ) : (
            /* Podpis bez obrázku - náš automatický podpis při odeslání
               (zadání 15. 9. 2026). Píše se jménem; doložka pod ním je
               stejná jako u nakresleného podpisu. */
            <span className="font-podpis text-3xl text-ink pb-1">{signature.name}</span>
          )
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
