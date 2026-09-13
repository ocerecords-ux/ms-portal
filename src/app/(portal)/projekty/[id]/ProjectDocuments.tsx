import Link from 'next/link';
import type { Currency } from '@prisma/client';
import { formatMoney, OFFER_STATUS_CLASSES, OFFER_STATUS_LABELS } from '@/lib/doklady';

/**
 * Doklady navázané na projekt (zadani 8. 9. 2026: "chtel bych mit Doklady
 * navazane na projekty. Kdyz rozkliknu projekt, uvidim doklady k projektu").
 *
 * Nabídky, vydané faktury a přijaté doklady pohromadě, dole shrnutí
 * fakturováno / náklady. Vazba se drží přes ID projektu v Caflou — stejně
 * jako u výkazů, protože projekt sám žije v Caflou.
 */

export type ProjectDocRow = {
  id: string;
  href: string;
  title: string;
  number: string;
  date: string;
  amountMinor: number;
  currency: Currency;
  statusLabel: string;
  statusClass: string;
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rozpracovaná',
  SENT: 'Neuhrazená',
  PAID: 'Uhrazená',
  CANCELLED: 'Stornovaná',
};

const INVOICE_STATUS_CLASSES: Record<string, string> = {
  DRAFT: 'bg-field text-muted',
  SENT: 'bg-tint text-brand-purpleDark',
  PAID: 'bg-okTint text-status-done',
  CANCELLED: 'bg-dangerTint text-danger',
};

export function invoiceStatus(status: string): { label: string; className: string } {
  return {
    label: INVOICE_STATUS_LABELS[status] ?? status,
    className: INVOICE_STATUS_CLASSES[status] ?? 'bg-field text-muted',
  };
}

export function offerStatus(status: string): { label: string; className: string } {
  return {
    label: OFFER_STATUS_LABELS[status] ?? status,
    className: OFFER_STATUS_CLASSES[status] ?? 'bg-field text-muted',
  };
}

export function ProjectDocuments({
  offers,
  invoices,
  expenses,
  contracts,
  invoicedByCurrency,
  costsByCurrency,
}: {
  offers: ProjectDocRow[];
  invoices: ProjectDocRow[];
  expenses: ProjectDocRow[];
  contracts: ProjectDocRow[];
  invoicedByCurrency: { currency: Currency; minor: number }[];
  costsByCurrency: { currency: Currency; minor: number }[];
}) {
  const celkem = offers.length + invoices.length + expenses.length + contracts.length;

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-6 flex flex-col gap-6">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          Doklady k projektu
        </h2>
        <Link href="/admin/doklady" className="text-xs font-heading font-semibold text-brand-purple no-underline">
          Přejít do Dokladů →
        </Link>
      </div>

      {celkem === 0 ? (
        <p className="text-sm font-body text-muted m-0">
          K tomuhle projektu zatím žádný doklad navázaný není. Projekt se vybírá přímo na nabídce,
          faktuře nebo výdaji.
        </p>
      ) : (
        {/* PORADI PODLE TOHO, JAK DOKLAD VZNIKA (zadani 13. 9. 2026:
            „seradme primarne: Nabidky, faktury, smlouvy"). Nejdriv se
            nabidne, pak fakturuje; smlouva a prijate doklady jsou to, co
            clovek hleda nejmin casto, a jdou proto dolu.

            Skupiny oddeluje tenka linka - `divide-y` ji nakresli jen MEZI
            nimi, takze prazdna skupina (vraci null) po sobe nenecha linku
            na prazdnem miste. */}
        <div className="flex flex-col divide-y divide-line">
          <Block title="Nabídky" rows={offers} druh="nabidka" />
          <Block title="Vydané faktury" rows={invoices} druh="faktura" />
          <Block title="Smlouvy" rows={contracts} druh="smlouva" hideAmount />
          <Block title="Přijaté doklady" rows={expenses} druh="vydaj" />

          <div className="flex items-center gap-8 flex-wrap pt-4">
            <Sum label="Fakturováno" values={invoicedByCurrency} />
            <Sum label="Náklady" values={costsByCurrency} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * IKONY DRUHŮ DOKLADU (zadání 13. 9. 2026: „udělej tam přehlednější seznam
 * s ikonami"). Stejná rodina jako ikony typů projektu: mřížka 24, tah 1.8,
 * zakulacené konce, žádná výplň — vedle sebe pak vypadají jako sada.
 *
 * SILUETA NESE VÝZNAM, ne barva. Stav dokladu vedle už barvu má a nese ji
 * záměrně (zrušená červeně, schválená zeleně); kdyby barvu přidala i ikona,
 * seznam se rozsvítí a stav přestane být informace. Ikona je proto vždycky
 * firemní fialová, jako u typů projektu.
 *
 * Nabídka je cenovka a přijatý doklad účtenka s natrženým spodkem — dvě
 * jasně odlišné siluety. Smlouva a faktura sdílejí list papíru a liší se
 * tím, co je na něm: podpis proti řádkům s částkou. V 18 px se to rozezná
 * a obojí stejně stojí ve vlastní nadepsané skupině.
 */
type DruhDokladu = 'smlouva' | 'nabidka' | 'faktura' | 'vydaj';

/** List papíru s ohnutým rohem - společný základ smlouvy a faktury. */
const LIST = (
  <>
    <path d="M14 2.5H7A1.5 1.5 0 0 0 5.5 4v16A1.5 1.5 0 0 0 7 21.5h10a1.5 1.5 0 0 0 1.5-1.5V7z" />
    <path d="M14 2.5V7h4.5" />
  </>
);

const KRESBY: Record<DruhDokladu, React.ReactNode> = {
  smlouva: (
    <>
      {LIST}
      {/* Podpisová vlnovka - to jediné, co ze smlouvy dělá smlouvu. */}
      <path d="M8.5 16.8c1.1-1.7 1.9-1.7 2.7 0 .8 1.7 1.6 1.7 2.7 0" />
    </>
  ),
  nabidka: (
    <>
      <path d="M20.5 3.5h-7.1a1.5 1.5 0 0 0-1.06.44l-8.4 8.4a1.5 1.5 0 0 0 0 2.12l6.1 6.1a1.5 1.5 0 0 0 2.12 0l8.4-8.4a1.5 1.5 0 0 0 .44-1.06z" />
      <circle cx="17" cy="7" r="1.25" />
    </>
  ),
  faktura: (
    <>
      {LIST}
      <path d="M9 12.5h6" />
      <path d="M9 16h4" />
    </>
  ),
  vydaj: (
    <>
      {/* Účtenka s natrženým spodkem. */}
      <path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z" />
      <path d="M9 8.5h6" />
      <path d="M9 12h4" />
    </>
  ),
};

function IkonaDokladu({ druh }: { druh: DruhDokladu }) {
  return (
    <span
      aria-hidden="true"
      className="shrink-0 grid place-items-center w-9 h-9 rounded-lg bg-brand-purple/10 text-brand-purple"
    >
      <svg
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {KRESBY[druh]}
      </svg>
    </span>
  );
}

/**
 * Jedna skupina dokladů. Řádek je celý odkaz a podsvítí se - v seznamu, kde
 * se kliká skoro na každý řádek, je cíl velký jako řádek sám; předtím to byl
 * jen text názvu.
 */
function Block({
  title,
  rows,
  druh,
  hideAmount,
}: {
  title: string;
  rows: ProjectDocRow[];
  druh: DruhDokladu;
  hideAmount?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    // py-4 a ne gap na rodici: mezera musi byt UVNITR skupiny, aby linka
    // vedla v pulce mezi nimi a ne natesno u nadpisu. first/last si uberou
    // vnejsi okraj, at panel nema nahore a dole prazdno navic.
    <div className="flex flex-col gap-1.5 py-4 first:pt-0 last:pb-0">
      <h3 className="font-heading font-semibold text-xs text-muted uppercase tracking-wide m-0">
        {title} <span className="tabular-nums opacity-70">({rows.length})</span>
      </h3>
      <ul className="list-none p-0 m-0 flex flex-col gap-0.5">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={row.href}
              className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg no-underline hover:bg-surfaceSoft transition-colors"
            >
              <IkonaDokladu druh={druh} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-heading font-semibold text-ink truncate">
                  {row.title}
                </span>
                <span className="block text-xs text-muted font-body">
                  <span className="tabular-nums">{row.number}</span>
                  {row.date ? ` · ${row.date}` : ''}
                </span>
              </span>
              {!hideAmount && (
                <span className="shrink-0 text-sm font-heading text-ink tabular-nums text-right">
                  {formatMoney(row.amountMinor, row.currency)}
                </span>
              )}
              {/* Pevna sirka stavu: bubliny pak stoji v jednom sloupci a oko
                  sjede seznam shora dolu misto toho, aby je hledalo. */}
              <span className="shrink-0 w-[104px] flex justify-end">
                <span
                  className={`inline-flex items-center text-xs font-heading font-semibold px-2.5 py-1 rounded-pill whitespace-nowrap ${row.statusClass}`}
                >
                  {row.statusLabel}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Sum({ label, values }: { label: string; values: { currency: Currency; minor: number }[] }) {
  return (
    <span className="flex items-baseline gap-3">
      <span className="text-xs font-heading text-muted uppercase tracking-wide">{label}</span>
      {values.length === 0 ? (
        <span className="font-display text-xl text-muted">—</span>
      ) : (
        values.map((v) => (
          <span key={v.currency} className="font-display text-xl text-ink tabular-nums">
            {formatMoney(v.minor, v.currency)}
          </span>
        ))
      )}
    </span>
  );
}
