// Vydaje (prijate doklady) - viz claude/ms-portal-doklady-a-rozpocty.md.
export default function ExpensesPage() {
  return (
    <div className="bg-white rounded-card border border-line shadow-sm px-6 py-10 text-center">
      <p className="font-heading font-semibold text-ink m-0">Výdaje se dodělávají</p>
      <p className="text-sm text-muted font-body m-0 mt-1 max-w-lg mx-auto">
        Přijaté doklady s přílohami, záložkami Uhrazeno / Neuhrazeno a DPH nastavitelným u každého dokladu zvlášť.
      </p>
    </div>
  );
}
