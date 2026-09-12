'use client';

import { ChybaStranky } from '@/components/ChybaStranky';

// Poslední záchyt pro celou aplikaci (12. 9. 2026). Chytí i chyby z layoutu
// portálu - ty se do error.tsx uvnitř té sekce nedostanou.
export default function Chyba({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen bg-paper">
      <ChybaStranky error={error} reset={reset} />
    </div>
  );
}
