'use client';

import { ChybaStranky } from '@/components/ChybaStranky';

// Chyba jedné stránky portálu - lišta i panely zůstanou, vymění se jen obsah.
export default function ChybaPortalu({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ChybaStranky error={error} reset={reset} nadpis="Tuhle stránku se nepodařilo načíst" />;
}
