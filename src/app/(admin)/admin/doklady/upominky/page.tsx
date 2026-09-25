import { UpominkyEditor } from './UpominkyEditor';

/**
 * UPOMÍNKY K FAKTURÁM PO SPLATNOSTI (zadání 25. 9. 2026: „potřebuji nastavit
 * upomínky na faktury po splatnosti. Chci je někde editovat, včetně náhledu
 * emailu"). Data si stránka načte sama z /api/admin/upominky, aby se po
 * odeslání upomínky seznam obnovil bez překreslení celé stránky.
 */
export const dynamic = 'force-dynamic';

export default function UpominkyPage() {
  return (
    <div className="flex flex-col gap-3 sm:gap-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-ink m-0">Upomínky</h1>
        <p className="text-sm font-body text-muted m-0 mt-1">
          Připomenutí faktur, které jsou po splatnosti a nejsou zaplacené. Koncepty ani uhrazené
          faktury se neupomínají.
        </p>
      </div>
      <UpominkyEditor />
    </div>
  );
}
