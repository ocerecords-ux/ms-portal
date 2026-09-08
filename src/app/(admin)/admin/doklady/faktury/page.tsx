// Faktury (vydane) - staví se hned po Nabídkách, viz
// claude/ms-portal-doklady-a-rozpocty.md.
export default function InvoicesPage() {
  return (
    <div className="bg-white rounded-card border border-line shadow-sm px-6 py-10 text-center">
      <p className="font-heading font-semibold text-ink m-0">Faktury se dodělávají</p>
      <p className="text-sm text-muted font-body m-0 mt-1 max-w-lg mx-auto">
        Číselné řady a bankovní účty už jsou nachystané v „Moje firmy". Po nich přijde vystavování faktur a nakonec
        párování plateb z Air Bank.
      </p>
    </div>
  );
}
