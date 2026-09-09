/**
 * Tlačítko „přidat" (zadání 9. 9. 2026: „zakomponuj do tlačítka zelenou.
 * Vlastně ty přidávací tlačítka můžeš udělat tímto stylem všude").
 *
 * Vypadá jako běžné fialové tlačítko portálu, ale má zelené kolečko s „+".
 * Zelená je záměrně NA FIALOVÉ, ne samostatně - drží se pravidla z 5. 9. 2026
 * („ta zelená splývá s pozadím, pod tou zelenou musí být vždy fialová").
 * Díky tomu jde přidávání odlišit od ukládání na první pohled, aniž by se
 * zavedla druhá barva tlačítek.
 *
 * Používá se jak na tlačítka, která formulář teprve otevřou, tak na samotné
 * odeslání, které nový záznam zakládá. Ukládání změn zůstává fialové bez
 * kolečka - to není přidávání.
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
  const velikost =
    size === 'sm' ? 'text-xs rounded-lg pl-2 pr-3 py-1.5 gap-1.5' : 'text-sm rounded-lg pl-2.5 pr-4 py-2.5 gap-2';
  const kolecko = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const plus = size === 'sm' ? 9 : 11;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center bg-brand-purple text-white font-heading font-semibold hover:bg-brand-purpleDeep transition-colors disabled:opacity-60 ${velikost} ${className}`}
    >
      <span
        className={`${kolecko} shrink-0 rounded-full bg-brand-green text-brand-purpleDark grid place-items-center`}
        aria-hidden="true"
      >
        <svg width={plus} height={plus} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </span>
      {children}
    </button>
  );
}
