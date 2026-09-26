'use client';

import { ChybaStranky } from '@/components/ChybaStranky';
import { useJazyk } from './components/JazykProvider';

// Chyba jedné stránky portálu - lišta i panely zůstanou, vymění se jen obsah.
// Layout portálu drží, takže jazyk je k mání z JazykProvideru.
export default function ChybaPortalu({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const jazyk = useJazyk();
  return <ChybaStranky error={error} reset={reset} jazyk={jazyk} nadpis="chyba.nadpisStranka" />;
}
