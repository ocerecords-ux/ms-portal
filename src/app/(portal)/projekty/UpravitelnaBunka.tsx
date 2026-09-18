'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProjectPriority } from '@prisma/client';
import { DatumPole } from '@/components/DatumPole';
import { VyberPriority } from '@/components/IkonaPriority';

/**
 * Úprava údajů projektu přímo v přehledu (zadání 10. 9. 2026: "věci, které
 * bych chtěl, ať jdou editovat přímo z přehledu: název, priorita, manažer
 * projektu, datum dokončení, datum vydání").
 *
 * NÁZEV SEM UŽ NEPATŘÍ (zadání 10. 9. 2026): klik na název knihy má otevřít
 * projekt, ne rozepsat pole. Upravit se dá v detailu projektu.
 *
 * Obě podoby (výběr, datum) ukládají stejnou cestou -
 * PATCH /api/projects/<id>/meta s jedním polem. Route uloží jen to, co
 * dorazilo, takže se nedá omylem přepsat něco jiného.
 *
 * SPOLEČNÉ CHOVÁNÍ: ukládá se hned po výběru,
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
 * PRIORITA V PŘEHLEDU (upřesnění 18. 9. 2026: „v náhledu nejde změnit a
 * objevují se tam slova… Vymysli, jak se tam ty čárky budou přidávat
 * a ubírat. Dělal bych to např klikáním na tu ikonu").
 *
 * Schválně NEPOUŽÍVÁ `UpravitelnyVyber`: ten při klepnutí vyměnil ikonu za
 * rozbalovátko se slovy a do úzkého sloupce se z něj vešlo jen „Vysc…".
 * Tady se klepe rovnou do sloupečků, takže se v buňce nikdy nic nepřekreslí
 * na text a šířka sloupce zůstává stejná.
 *
 * Ukládá se hned po klepnutí, stejnou cestou jako ostatní úpravy v přehledu.
 * Když to neprojde, hodnota se vrátí (nic se lokálně nedrží) a vypíše se chyba.
 */
export function UpravitelnaPriorita({
  caflouProjectId,
  priorita,
}: {
  caflouProjectId: string;
  priorita: ProjectPriority | null;
}) {
  const router = useRouter();
  const [chyba, setChyba] = useState<string | null>(null);
  const [uklada, setUklada] = useState(false);

  async function zmen(nova: ProjectPriority) {
    if (uklada) return;
    setUklada(true);
    const problem = await uloz(caflouProjectId, 'priority', nova);
    setUklada(false);
    if (problem) {
      setChyba(problem);
      return;
    }
    setChyba(null);
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col min-w-0">
      <VyberPriority priorita={priorita} onZmena={(v) => void zmen(v)} uklada={uklada} />
      <Chyba text={chyba} />
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

/**
 * Datum. Prázdná hodnota se uloží jako „žádné datum".
 *
 * UKLÁDÁ SE PŘI ZMĚNĚ, NE PŘI OPUŠTĚNÍ POLÍČKA (oprava 16. 9. 2026:
 * „to přidávání datumů nějak mizí a blbne pořád").
 *
 * Předtím se ukládalo v `onBlur`. Jenže rozepsané datum má `<input type="date">`
 * prázdné — dokud nejsou vyplněné všechny tři části, `value` je "". Kdo tedy
 * začal psát a klikl jinam, uložil PRÁZDNO a buňka se vrátila na pomlčku;
 * a při výběru z kalendáře přišel blur dřív, než prohlížeč hodnotu zapsal, tak
 * se datum „ztratilo" i tehdy. Událost `change` u data přijde až s hotovou
 * hodnotou (a taky při vymazání), takže je to přesně ta chvíle, kdy se má
 * ukládat. Blur už jen zavře editaci.
 */
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
  popisek: React.ReactNode;
}) {
  const router = useRouter();
  const [upravuje, setUpravuje] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [uklada, setUklada] = useState(false);
  /** Co je zrovna v políčku. Rozepsané datum vrací prohlížeč jako "". */
  const [navrh, setNavrh] = useState(hodnota);

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
    <span
      onKeyDown={(e) => {
        if (e.key === 'Escape') setUpravuje(false);
      }}
    >
      {/* Společné políčko portálu - kalendář se otevře klepnutím kamkoliv,
          ne jen na drobnou ikonku vpravo. */}
      <DatumPole
        autoFocus
        value={navrh}
        onChange={(e) => {
          setNavrh(e.target.value);
          void zmen(e.target.value);
        }}
        onBlur={() => setUpravuje(false)}
        title="Vyberte datum z kalendáře"
        /* Pevná šířka na celé „dd.mm.rrrr" - v úzkém sloupci se políčko jinak
           zmáčkne a ukousne rok (16. 9. 2026). Radši ať přeteče přes buňku,
           než aby člověk psal do něčeho, co nevidí celé. */
        className="w-[9.5rem] rounded-lg border border-brand-purple bg-field px-2 py-1 text-sm font-heading text-ink outline-none"
      />
    </span>
  );
}
