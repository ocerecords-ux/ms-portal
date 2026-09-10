'use client';

import type { OtevrenyDok } from './pravyDok';

/**
 * Záložky v hlavičce pravého panelu — Úkoly / MS chat. Otevřený je vždycky
 * jen jeden panel (viz pravyDok.ts), tohle je způsob, jak mezi nimi přejít
 * bez zavírání. Vzhled drží fialovo-zelenou hlavičku, kterou má horní lišta
 * i chat.
 */
export function ZalozkyDoku({
  aktivni,
  otevri,
  pocetUkolu,
  neprectene,
  vpravo,
}: {
  aktivni: Exclude<OtevrenyDok, null>;
  otevri: (dok: OtevrenyDok) => void;
  pocetUkolu?: number;
  neprectene?: number;
  /** Ovládání, které patří jen jednomu z panelů (u chatu upozornění). */
  vpravo?: React.ReactNode;
}) {
  return (
    <div className="shrink-0 bg-brand-purple text-brand-green flex items-stretch justify-between gap-2 pl-2 pr-1.5 pt-1.5">
      <div className="flex items-end gap-1">
        <Zalozka
          aktivni={aktivni === 'chat'}
          onClick={() => otevri('chat')}
          label="MS chat"
          pocet={neprectene}
        />
        <Zalozka
          aktivni={aktivni === 'ukoly'}
          onClick={() => otevri('ukoly')}
          label="Úkoly"
          pocet={pocetUkolu}
        />
      </div>
      <span className="flex items-center gap-2 pr-0.5">
        {vpravo}
        <button
        type="button"
        onClick={() => otevri(null)}
        title="Skrýt panel"
        aria-label="Skrýt panel"
        className="self-center rounded-lg px-2 py-1 text-brand-green/80 hover:text-white hover:bg-white/10 transition-colors font-heading font-bold text-sm leading-none"
      >
        ✕
        </button>
      </span>
    </div>
  );
}

function Zalozka({
  aktivni,
  onClick,
  label,
  pocet,
}: {
  aktivni: boolean;
  onClick: () => void;
  label: string;
  pocet?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={aktivni ? 'page' : undefined}
      className={`rounded-t-lg px-3 py-1.5 font-heading font-semibold text-sm uppercase tracking-wide transition-colors whitespace-nowrap ${
        aktivni ? 'bg-surface text-brand-purple' : 'text-brand-green/80 hover:text-white hover:bg-white/10'
      }`}
    >
      {label}
      {pocet !== undefined && pocet > 0 && (
        <span
          className={`ml-1.5 tabular-nums text-xs ${aktivni ? 'text-brand-purple/70' : 'opacity-80'}`}
        >
          {pocet}
        </span>
      )}
    </button>
  );
}
