'use client';

import { usePathname, useRouter } from 'next/navigation';
import { VyberPole } from '@/components/VyberPole';

/** Výběr měsíce - v adrese, ať jde přehled poslat odkazem. */
export function VyberMesice({ mesic, mesice }: { mesic: string; mesice: { hodnota: string; popis: string }[] }) {
  const router = useRouter();
  const cesta = usePathname();
  return (
    <VyberPole
      aria-label="Měsíc"
      value={mesic}
      onChange={(e) => router.push(`${cesta}?mesic=${e.target.value}`)}
      className="rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple min-w-[180px]"
    >
      {mesice.map((m) => (
        <option key={m.hodnota} value={m.hodnota}>
          {m.popis}
        </option>
      ))}
    </VyberPole>
  );
}
