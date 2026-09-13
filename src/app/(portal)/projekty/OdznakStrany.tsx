import { TRIDA_ODZNAKU_STRANY } from '@/lib/bublinaHerce';

/**
 * Strana, na které se s hercem naposledy skončilo — malý odznak posazený na
 * pravý horní roh bubliny se jménem, jako index (upřesnění 13. 9. 2026:
 * „spíš by překrýval pravý horní roh té fialové bubliny, jako index").
 *
 * JE TO KOMPONENTA, NE JEN TŘÍDA: odznak je na dvou místech — v přehledu
 * projektů a v detailu u herce — a musí na obou vypadat i sedět stejně.
 * Kdyby se posuny psaly zvlášť na obou místech, po první úpravě by se
 * rozešly. Číslo samo je z natáčecího protokolu, který vede Bruno z chatu.
 *
 * OBALKA SI MUSÍ NECHAT MÍSTO: odznak přetéká přes okraj bubliny, takže
 * rodič potřebuje `relative` a vpravo nahoře volný prostor — jinak ho
 * ořízne buňka tabulky nebo zajede na bublinu nad sebou.
 *
 * Žádné hooky ani stav — jde použít v serverové i klientské komponentě.
 */
export function OdznakStrany({ strana }: { strana: number }) {
  return (
    <span
      title={`Natočeno do strany ${strana} — zapsal Bruno z chatu`}
      // pointer-events-none: odznak leží na bublině, nesmí přebírat kliknutí,
      // které patří jí.
      className={`pointer-events-none absolute -top-2 -right-2 z-10 inline-flex items-center justify-center min-w-[20px] h-[18px] px-1 text-[10px] font-heading font-bold tabular-nums leading-none ${TRIDA_ODZNAKU_STRANY}`}
    >
      {strana}
      <span className="sr-only"> — natočeno do strany</span>
    </span>
  );
}

/**
 * Poslední strana pro každého herce z natáčecího protokolu. Protokol chodí
 * od nejnovějšího, takže první nález pro daného herce je ten platný.
 *
 * Záznam bez herce (projekt s jediným hercem, kde ho nikdo nepsal) se do mapy
 * nedostane — nebylo by ke komu ho přiřadit.
 */
export function posledniStranyHercu(
  zaznamy?: { strana: number; userId: string | null }[],
): Record<string, number> {
  const mapa: Record<string, number> = {};
  for (const z of zaznamy ?? []) {
    if (z.userId && mapa[z.userId] === undefined) mapa[z.userId] = z.strana;
  }
  return mapa;
}
