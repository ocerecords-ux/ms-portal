/**
 * Tlačítko „přidat" (zadání 9. 9. 2026: „zakomponuj do tlačítka zelenou.
 * Vlastně ty přidávací tlačítka můžeš udělat tímto stylem všude").
 *
 * Fialové tlačítko se zeleným textem a „+". Zelená je záměrně NA FIALOVÉ,
 * ne samostatně - drží se pravidla z 5. 9. 2026 („ta zelená splývá s pozadím,
 * pod tou zelenou musí být vždy fialová"). Přidávání tak jde odlišit od
 * ukládání na první pohled, aniž by se zavedla druhá barva tlačítek.
 *
 * Používá se jak na tlačítka, která formulář teprve otevřou, tak na samotné
 * odeslání, které nový záznam zakládá. Ukládání změn zůstává fialové s bílým
 * textem - to není přidávání.
 */
export function AddButton({
  children,
  type = 'button',
  onClick,
  disabled,
  size = 'md',
  className = '',
  title,
}: {
  children: React.ReactNode;
  type?: 'button' | 'submit';
  onClick?: () => void;
  disabled?: boolean;
  /** "sm" pro tlačítka uvnitř tabulek a řádků. */
  size?: 'md' | 'sm';
  className?: string;
  title?: string;
}) {
  const velikost = size === 'sm' ? 'text-xs px-3 py-1.5 gap-1.5' : 'text-sm px-5 py-2.5 gap-2';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center rounded-lg bg-brand-purple text-brand-green font-heading font-semibold hover:bg-brand-purpleDeep transition-colors disabled:opacity-60 ${velikost} ${className}`}
    >
      <span className="font-semibold leading-none" aria-hidden="true">
        +
      </span>
      {children}
    </button>
  );
}
