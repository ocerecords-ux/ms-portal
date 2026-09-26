'use client';

import { useEffect, useState } from 'react';
import { ChybaStranky } from '@/components/ChybaStranky';
import { jazykZCookie, type Jazyk } from '@/lib/jazyk';

// Poslední záchyt pro celou aplikaci (12. 9. 2026). Chytí i chyby z layoutu
// portálu - ty se do error.tsx uvnitř té sekce nedostanou.
//
// JAZYK SE TU BERE Z COOKIE, ne z JazykProvideru: když spadl layout, provider
// vůbec nevznikl. Dorovná se až po připojení, aby se vykreslení na serveru
// nerozešlo s prohlížečem.
export default function Chyba({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [jazyk, setJazyk] = useState<Jazyk>('cs');
  useEffect(() => setJazyk(jazykZCookie()), []);

  return (
    <div className="min-h-screen bg-paper">
      <ChybaStranky error={error} reset={reset} jazyk={jazyk} />
    </div>
  );
}
