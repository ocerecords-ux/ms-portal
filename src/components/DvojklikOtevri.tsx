'use client';

/**
 * DVOJKLIK NA IKONU OTEVŘE, CO ZNAČÍ (zadání 25. 9. 2026: „nastav, že když
 * dvakrát kliknu na ikony v přehledu projektů (ikona přeposlechu, nabídky
 * nebo faktury), tak se mi otevře daná věc").
 *
 * Schválně DVOJklik a ne obyčejné kliknutí: ikony sedí v řádku projektu,
 * kterým se prochází a odklikávají jiné věci, a jedno kliknutí navíc by
 * z přehledu odskakovalo pokaždé, když někdo minul sousední tlačítko.
 *
 * Otevírá se v NOVÉM PANELU. Přehled projektů je pracovní seznam - kdo si
 * chce mrknout na fakturu, se do něj chce vzápětí vrátit tam, kde byl,
 * a ne se proklikávat zpátky.
 */
export function DvojklikOtevri({
  odkaz,
  popis,
  children,
}: {
  odkaz: string;
  /** Doplní se k bublince ikony, ať je poznat, že se dá otevřít. */
  popis: string;
  children: React.ReactNode;
}) {
  return (
    <span
      role="link"
      tabIndex={0}
      title={popis}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(odkaz, '_blank', 'noopener,noreferrer');
      }}
      onKeyDown={(e) => {
        // Klávesnicí stačí Enter - dvojklik se odmáčknout nedá.
        if (e.key === 'Enter') {
          e.preventDefault();
          window.open(odkaz, '_blank', 'noopener,noreferrer');
        }
      }}
      className="inline-flex cursor-pointer"
    >
      {children}
    </span>
  );
}
