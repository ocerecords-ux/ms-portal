/**
 * Kostra stránky, která se ukáže OKAMŽITĚ po kliknutí v liště, než server
 * dopočítá skutečný obsah (zpráva 9. 9. 2026: "web se mi zdá zpomalený,
 * hlavně když kliknu na nějakou sekci v menu").
 *
 * Proč to tak vypadalo: všechny stránky portálu jsou `force-dynamic` a tahají
 * data živě (Caflou, Google Disk, databáze). Bez tohohle souboru Next.js po
 * kliknutí NEUDĚLÁ NIC, dokud server neodpoví - v prohlížeči zůstane viset
 * stará stránka a klik vypadá, jako by se ztratil. S touhle kostrou se
 * překreslí okamžitě a obsah do ní doteče, jakmile je hotový.
 *
 * Vedlejší, ale důležitý efekt: teprve když existuje `loading`, umí Next.js
 * odkazy v liště přednačítat, aniž by tím spustil samotné načítání dat.
 * Proto šlo z Topbaru odstranit `prefetch={false}` u Projektů.
 *
 * Platí pro celou sekci (portal) - stránky, které chtějí vlastní kostru
 * (např. detail projektu), si vedle sebe položí vlastní loading.tsx.
 */
export default function PortalLoading() {
  return (
    <section className="flex flex-col gap-6 animate-pulse" aria-busy="true" aria-label="Načítám">
      <div className="h-9 w-64 bg-line/70 rounded-lg" />

      <div className="bg-surface rounded-card border border-line shadow-sm overflow-hidden">
        <div className="h-11 bg-line/60" />
        <div className="flex flex-col">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4 border-t border-line">
              <div className="h-3.5 bg-field rounded flex-[3]" />
              <div className="h-3.5 bg-field rounded flex-[2]" />
              <div className="h-3.5 bg-field rounded flex-[2]" />
              <div className="h-3.5 bg-field rounded flex-1" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
