'use client';

import { useState } from 'react';

import { JazykProvider } from '@/app/(portal)/components/JazykProvider';
import { Tracklist } from '@/app/(portal)/projekty/[id]/Tracklist';
import { prelozit, type Jazyk } from '@/lib/jazyk';
import type { Track } from '@/lib/tracklist';

/**
 * TRACKLIST OD KLIENTA NA VEŘEJNÉ STRÁNCE (zadání 19. 11. 2026: „v rámci toho
 * tracklistu by se měli dostat do samého rozhraní projektu jako my a v něm ho
 * vytvářet. Nebo případně nahrát textový soubor nebo pdf").
 *
 * JE TO DOSLOVA TATÁŽ KOMPONENTA, kterou máme na kartě projektu - ne její
 * klientská kopie. Dvě obrazovky, které dělají totéž, se po první opravě
 * rozejdou; tady se mění jen dvě věci:
 *  - ADRESA, na kterou se ukládá (a na kterou se ptá Bruno): klient nemá
 *    účet, jde přes token své výzvy;
 *  - ROZDĚLIT TRACK tu není: „to děláme my, až podle toho, jak ty tracky
 *    vyjdou časově" (19. 11. 2026).
 *
 * Stránka stojí MIMO JazykProvider (je veřejná), takže si ho tady obalíme
 * sami - jinak by editor mluvil vždycky česky.
 */
export function TracklistOdKlienta({
  token,
  caflouProjectId,
  nazevProjektu,
  pocatecni,
  jazyk,
}: {
  token: string;
  caflouProjectId: string;
  nazevProjektu: string;
  pocatecni: Track[];
  jazyk: Jazyk;
}) {
  const t = (klic: string) => prelozit(jazyk, klic);
  /**
   * KDO TRACKLIST VYPLNIL. Posílá se v adrese, ne v těle: tělo skládá sdílený
   * editor a ten o jménu nic neví. U projektu se pak pozná, že seznam psal
   * klient a kdy.
   */
  const [jmeno, setJmeno] = useState('');
  const adresa =
    `/api/hudba-od-klienta/${encodeURIComponent(token)}/tracklist` +
    (jmeno.trim() ? `?jmeno=${encodeURIComponent(jmeno.trim())}` : '');

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-2xl text-ink m-0">{t('hudbaKlient.tracklistNadpis')}</h2>
        <p className="text-muted text-sm mt-1.5 font-body m-0">
          {t('hudbaKlient.tracklistPopis')}
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-heading uppercase tracking-wide text-muted">
          {t('hudbaKlient.vasJmeno')}
        </span>
        <input
          value={jmeno}
          onChange={(e) => setJmeno(e.target.value)}
          placeholder={t('hudbaKlient.jmenoMisto')}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple"
        />
      </label>

      <JazykProvider jazyk={jazyk}>
        <Tracklist
          caflouProjectId={caflouProjectId}
          nazevProjektu={nazevProjektu}
          pocatecni={pocatecni}
          apiAdresa={adresa}
          brunoAdresa={`/api/hudba-od-klienta/${encodeURIComponent(token)}/tracklist/bruno`}
          /* Rozdělování stop je naše věc - děláme ho podle časů (19. 11. 2026). */
          sDelenim={false}
        />
      </JazykProvider>
    </div>
  );
}
