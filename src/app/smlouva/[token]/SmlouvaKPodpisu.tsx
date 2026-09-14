'use client';

import { useState } from 'react';
import { ContractPaper, type PaperSignature } from '@/app/(admin)/admin/doklady/smlouvy/ContractPaper';
import { ContractSigning } from './ContractSigning';

/**
 * Smlouva k podpisu: dokument po stránkách a pod ním podpis (zadání
 * 13. 9. 2026: „bylo by dobré, aby jsi odklikával i jednotlivé stránky, jak
 * je to třeba u Signi").
 *
 * PROČ TO DRŽÍ JEDNA KOMPONENTA: stav „co už mám přečtené" musí vidět
 * dokument i podpisová část zároveň — dokument aby stránku označil, podpis
 * aby zůstal zamčený, dokud se neprojde celý. Na serveru to jde těžko,
 * proto je tenhle obal klientský a stránka zůstává serverová.
 *
 * ODKLIKÁVÁNÍ SE UKAZUJE, JEN KDYŽ JE CO PODEPSAT. Podepsaná nebo odmítnutá
 * smlouva se čte jako obyčejný dokument — nutit někoho odklikávat stránky
 * něčeho, co už podepsal, by bylo jen otravné.
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
}) {
  const [potvrzene, setPotvrzene] = useState<number[]>([]);

  const podepisujeSe = !alreadySigned && status !== 'SIGNED' && status !== 'CANCELLED' && !rejectedAt;

  function prepni(index: number) {
    setPotvrzene((s) => (s.includes(index) ? s.filter((i) => i !== index) : [...s, index]));
  }

  return (
    <>
      <ContractPaper
        title={title}
        number={number}
        body={body}
        signatures={signatures}
        currentHash={currentHash}
        potvrzovani={podepisujeSe ? { potvrzene, onPotvrdit: prepni } : undefined}
      />

      <ContractSigning
        token={token}
        status={status}
        signerName={signerName}
        alreadySigned={alreadySigned}
        completedAt={completedAt}
        rejectedAt={rejectedAt}
        issuerName={issuerName}
        potvrzenoStranek={potvrzene.length}
        body={body}
      />
    </>
  );
}
