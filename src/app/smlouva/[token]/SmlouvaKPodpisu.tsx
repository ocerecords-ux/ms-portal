'use client';

import { ContractPaper, type PaperSignature } from '@/app/(admin)/admin/doklady/smlouvy/ContractPaper';
import { ContractSigning } from './ContractSigning';
import type { Jazyk } from '@/lib/jazyk';

/**
 * Smlouva k podpisu: celý dokument a pod ním jeden podpis.
 *
 * ODKLIKÁVÁNÍ JEDNOTLIVÝCH STRÁNEK UŽ NENÍ (zadání 15. 9. 2026: „pojďme
 * u těch smluv obecně zrušit to podepisování každé strany zvlášť. Nechme to
 * zpět jen na jeden souhlas"). Od 13. 9. se muselo projít a odklepnout každou
 * stránku zvlášť, jako to má Signi - pro herce to byla jen práce navíc.
 * Důkazní hodnota podpisu se tím nemění: pořád se k němu ukládá čas,
 * IP adresa a otisk textu, který měl člověk před sebou.
 */
export function SmlouvaKPodpisu({
  token,
  title,
  number,
  body,
  signatures,
  currentHash,
  status,
  signerName,
  alreadySigned,
  completedAt,
  rejectedAt,
  issuerName,
  jazyk,
}: {
  token: string;
  title: string;
  number: string;
  body: string;
  signatures: PaperSignature[];
  currentHash: string;
  status: string;
  signerName: string;
  alreadySigned: boolean;
  completedAt: string | null;
  rejectedAt: string | null;
  issuerName: string;
  /** Stránka stojí mimo JazykProvider, jazyk proto chodí propem (pravidlo 8). */
  jazyk: Jazyk;
}) {
  return (
    <>
      <ContractPaper
        title={title}
        number={number}
        body={body}
        signatures={signatures}
        currentHash={currentHash}
        issuerName={issuerName}
      />

      <ContractSigning
        token={token}
        status={status}
        signerName={signerName}
        alreadySigned={alreadySigned}
        completedAt={completedAt}
        rejectedAt={rejectedAt}
        issuerName={issuerName}
        jazyk={jazyk}
      />
    </>
  );
}
