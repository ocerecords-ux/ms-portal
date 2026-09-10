'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Úprava údajů projektu přímo v přehledu (zadání 10. 9. 2026: "věci, které
 * bych chtěl, ať jdou editovat přímo z přehledu: název, priorita, manažer
 * projektu, datum dokončení, datum vydání").
 *
 * Všechny tři podoby (text, výběr, datum) ukládají stejnou cestou -
 * PATCH /api/projects/<id>/meta s jedním polem. Route uloží jen to, co
 * dorazilo, takže se nedá omylem přepsat něco jiného.
 *
 * SPOLEČNÉ CHOVÁNÍ: ukládá se hned (u textu při opuštění pole nebo Enterem),
 * a když uložení selže, hodnota se vrátí na původní a vypíše se chyba.
 * Tabulka nikdy nesmí ukazovat něco jiného, než co je v databázi.
 */

/** Uloží jedno pole projektu. Vrací chybu, nebo null když se povedlo. */
async function uloz(caflouProjectId: string, pole: string, hodnota: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/projects/${caflouProjectId}/meta`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [pole]: hodnota }),
    });
    if (res.ok) return null;
    const data = await res.json().catch(() => ({}));
    return data?.error || 'Uložení se nezdařilo.';
  } catch {
    return 'Uložení se nezdařilo.';
  }
}

function Chyba({ text }: { text: string | null }) {
  if (!text) return null;
  return <span className="block text-[11px] font-body text-danger mt-0.5">{text}</span>;
}

/**
 * Text, který se upraví kliknutím. Dokud se needituje, vypadá jako obyčejný
 * text - tabulka se tím nerozpadne do řady políček.
 */
export function UpravitelnyText({
  caflouProjectId,
  pole,
  hodnota,
  trida = '',
  odkaz,
}: {
  caflouProjectId: string;
  pole: string;
  hodnota: string;
  trida?: string;
  /**
   * Kam se dá odskočit z rozepsané buňky. U názvu projektu je to jeho detail:
   * kliknutí na název text upravuje (zadání 10. 9. 2026), takže odkaz musí
   * být někde jinde - a šipka vedle názvu se neosvědčila, roztahovala sloupec.
   */
  odkaz?: { href: string; popisek: string };
}) {
  const router = useRouter();
  const [upravuje, setUpravuje] = useState(false);
  const [text, setText] = useState(hodnota);
  const [chyba, setChyba] = useState<string | null>(null);
  const [uklada, setUklada] = useState(false);

  async function potvrd() {
    setUpravuje(false);
    const novy = text.trim();
    if (!novy || novy === hodnota) {
      setText(hodnota);
      return;
    }
    setUklada(true);
    const problem = await uloz(caflouProjectId, pole, novy);
    setUklada(false);
    if (problem) {
      setText(hodnota);
      setChyba(problem);
      return;
    }
    setChyba(null);
    router.refresh();
  }

  if (!upravuje) {
    return (
      <span className="inline-flex flex-col min-w-0">
        <button
          type="button"
          onClick={() => {
            setText(hodnota);
            setUpravuje(true);
          }}
          title="Upravit klepnutím"
          className={`text-left hover:text-brand-purple transition-colors ${uklada ? 'opacity-60' : ''} ${trida}`}
        >
          {hodnota || '—'}
        </button>
        <Chyba text={chyba} />
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col min-w-0 gap-0.5">
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => void potvrd()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void potvrd();
          if (e.key === 'Escape') {
            setText(hodnota);
            setUpravuje(false);
          }
        }}
        className="w-full max-w-[280px] rounded-lg border border-brand-purple bg-field px-2 py-1 text-sm font-heading text-ink outline-none"
      />
      {odkaz && (
        <a
          href={odkaz.href}
          // Prohlizec by pri kliknuti nejdriv opustil policko (onBlur) a odkaz
          // by zmizel drive, nez se stihne otevrit - proto onMouseDown.
          onMouseDown={(e) => e.preventDefault()}
          className="text-[11px] font-heading font-semibold text-brand-purple no-underline hover:underline"
        >
          {odkaz.popisek}
        </a>
      )}
    </span>
  );
}

/** Výběr z hodnot - priorita, manažer. */
export function UpravitelnyVyber({
  caflouProjectId,
  pole,
  hodnota,
  moznosti,
  prazdnyPopisek = '—',
  deti,
}: {
  caflouProjectId: string;
  pole: string;
  hodnota: string;
  moznosti: { hodnota: string; popisek: string }[];
  prazdnyPopisek?: string;
  /** Co se ukáže místo textu, když se needituje (třeba barevný odznak). */
  deti?: React.ReactNode;
}) {
  const router = useRouter();
  const [upravuje, setUpravuje] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [uklada, setUklada] = useState(false);

  async function zmen(nova: string) {
    setUpravuje(false);
    if (nova === hodnota) return;
    setUklada(true);
    const problem = await uloz(caflouProjectId, pole, nova);
    setUklada(false);
    if (problem) {
      setChyba(problem);
      return;
    }
    setChyba(null);
    router.refresh();
  }

  if (!upravuje) {
    return (
      <span className="inline-flex flex-col min-w-0">
        <button
          type="button"
          onClick={() => setUpravuje(true)}
          title="Upravit klepnutím"
          className={`text-left hover:opacity-80 transition-opacity ${uklada ? 'opacity-60' : ''}`}
        >
          {deti ?? moznosti.find((m) => m.hodnota === hodnota)?.popisek ?? prazdnyPopisek}
        </button>
        <Chyba text={chyba} />
      </span>
    );
  }

  return (
    <select
      autoFocus
      value={hodnota}
      onChange={(e) => void zmen(e.target.value)}
      onBlur={() => setUpravuje(false)}
      className="rounded-lg border border-brand-purple bg-field px-2 py-1 text-sm font-heading text-ink outline-none"
    >
      <option value="">{prazdnyPopisek}</option>
      {moznosti.map((m) => (
        <option key={m.hodnota} value={m.hodnota}>
          {m.popisek}
        </option>
      ))}
    </select>
  );
}

/** Datum. Prázdná hodnota se uloží jako "žádné datum". */
export function UpravitelneDatum({
  caflouProjectId,
  pole,
  hodnota,
  popisek,
}: {
  caflouProjectId: string;
  pole: string;
  /** YYYY-MM-DD, nebo prázdno. */
  hodnota: string;
  /** Jak se datum ukazuje, když se needituje. */
  popisek: string;
}) {
  const router = useRouter();
  const [upravuje, setUpravuje] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [uklada, setUklada] = useState(false);

  async function zmen(nove: string) {
    setUpravuje(false);
    if (nove === hodnota) return;
    setUklada(true);
    const problem = await uloz(caflouProjectId, pole, nove);
    setUklada(false);
    if (problem) {
      setChyba(problem);
      return;
    }
    setChyba(null);
    router.refresh();
  }

  if (!upravuje) {
    return (
      <span className="inline-flex flex-col min-w-0">
        <button
          type="button"
          onClick={() => setUpravuje(true)}
          title="Upravit klepnutím"
          className={`text-left hover:text-brand-purple transition-colors ${uklada ? 'opacity-60' : ''}`}
        >
          {popisek}
        </button>
        <Chyba text={chyba} />
      </span>
    );
  }

  return (
    <input
      type="date"
      autoFocus
      defaultValue={hodnota}
      onBlur={(e) => void zmen(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') void zmen((e.target as HTMLInputElement).value);
        if (e.key === 'Escape') setUpravuje(false);
      }}
      className="rounded-lg border border-brand-purple bg-field px-2 py-1 text-sm font-heading text-ink outline-none"
    />
  );
}
