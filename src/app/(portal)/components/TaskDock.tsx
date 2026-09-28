'use client';

import { TlacitkoSmazat } from '@/components/TlacitkoSmazat';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { oznamPocetDoku, usePoctyDoku, usePravyDok } from './pravyDok';
import { ZalozkyDoku } from './ZalozkyDoku';
import { DatumPole } from '@/components/DatumPole';
import { ZadaneUkoly, type ZadanyUkolVSeznamu } from './ZadaneUkoly';
import { UpravaMehoUkolu } from './UpravaMehoUkolu';
import { dnesVPraze, jePoTerminu, popisTerminu, zitraVPraze } from '@/lib/terminUkolu';
import { useJazyk, usePreklad } from './JazykProvider';
import type { Jazyk } from '@/lib/jazyk';

/**
 * Úkoly pořád po ruce (zadani 8. 9. 2026: "aby byl ten to do list pořád po
 * ruce, tak by se mohl skrývat a odkrývat na pravé straně obrazovky pomocí
 * šipky >. Když se minimalizuje, zůstanou jen ikonky.").
 *
 * Panel visi na prave hrane obrazovky nad obsahem stranky. Zabaleny je z nej
 * jen uzka lista s ikonkami (odskrtavatko s poctem otevrenych ukolu, hodiny s
 * poctem ukolu po terminu), rozbaleny je to cely seznam se zadavanim.
 * Stav (rozbaleno/zabaleno) si pamatuje prohlizec, takze si to kazdy nastavi
 * jednou a drzi mu to.
 *
 * Vidi ho jen tym Mediaspace - klientum se vubec nevykresli (viz layout).
 */

type Task = {
  id: string;
  title: string;
  done: boolean;
  dueDate: string | null;
  /** Čas termínu „HH:MM" (21. 9. 2026). */
  dueTime?: string | null;
  /** Kdo úkol zadal z chatu přes @úkol (zadání 18. 9. 2026); null = já sám. */
  zadalJmeno?: string | null;
};

export function ChecklistIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M3 6l2 2 3-3M3 13l2 2 3-3M3 20l2 2 3-3" />
      <path d="M12 7h9M12 14h9M12 21h9" />
    </svg>
  );
}

export function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d={direction === 'right' ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
    </svg>
  );
}

/**
 * Popisek pod políčkem s datem (zadání 28. 9. 2026: „někde tam napsat, že je to
 * dnes"). Samotné políčko ukazuje jen „28.09.2026" a z toho není na první
 * pohled poznat, jestli je to dneska, nebo zbytek po minulém úkolu.
 */
function popisVybranehoDne(
  dueDate: string,
  t: (klic: string, hodnoty?: Record<string, string | number>) => string,
  jazyk: Jazyk,
): string {
  if (!dueDate) return t('ukoly.terminZadny');
  if (dueDate === dnesVPraze()) return t('ukoly.terminDnes');
  if (dueDate === zitraVPraze()) return t('ukoly.terminZitra');
  return t('ukoly.terminDatum', { datum: popisTerminu(dueDate, null, jazyk) });
}

export function TaskDock({ tasks }: { tasks: Task[] }) {
  const t = usePreklad();
  const jazyk = useJazyk();
  const router = useRouter();
  const [dok, otevriDok] = usePravyDok();
  const pocty = usePoctyDoku();
  const expanded = dok === 'ukoly';
  const [title, setTitle] = useState('');
  // Datum je předvyplněné na dnešek (zadání 28. 9. 2026) - většina úkolů se
  // zadává na dnešek a doklikávat se každý den do kalendáře bylo zbytečné.
  // Kdo termín nechce, políčko vymaže a popisek pod ním ukáže „Bez termínu".
  const [dueDate, setDueDate] = useState(dnesVPraze());
  const [dueTime, setDueTime] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  /** Který úkol se zrovna upravuje (25. 9. 2026) - vždycky nejvýš jeden. */
  const [upravovany, setUpravovany] = useState<string | null>(null);
  // „Zadal jsem" (21. 9. 2026) - načítá se, až když je panel otevřený; layout
  // tak nemusí na každé stránce tahat úkoly ostatních.
  const [zadane, setZadane] = useState<ZadanyUkolVSeznamu[]>([]);
  const nactiZadane = async () => {
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data?.zadane)) setZadane(data.zadane);
    } catch {
      // Nevadí - seznam jen zůstane, jak byl.
    }
  };
  useEffect(() => {
    if (dok === 'ukoly') void nactiZadane();
  }, [dok]);

  // Stav si pamatujeme v prohlizeci, at se panel neotevira porad znovu.
  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  // Po termínu i s časem (21. 9. 2026) - úkol do 14:00 je po termínu už
  // odpoledne, ne až zítra.
  const overdue = open.filter((t) => jePoTerminu(t.dueDate, t.dueTime ?? null));

  // Zalozka Ukoly ukazuje sve cislo i v hlavicce chatu - viz pravyDok.ts.
  useEffect(() => {
    oznamPocetDoku('ukoly', open.length);
  }, [open.length]);

  useEffect(() => {
    oznamPocetDoku('poTerminu', overdue.length);
  }, [overdue.length]);

  async function send(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || t('ukoly.chybaUlozit'));
        return false;
      }
      router.refresh();
      void nactiZadane();
      return true;
    } catch {
      setError(t('ukoly.chybaUlozit'));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const value = title.trim();
    if (!value) return;
    const ok = await send('/api/tasks', 'POST', {
      title: value,
      dueDate: dueDate || null,
      dueTime: dueDate && dueTime ? dueTime : null,
    });
    if (ok) {
      setTitle('');
      // Zpátky na dnešek, ne na prázdno - další úkol je zase nejspíš na dnes.
      setDueDate(dnesVPraze());
      setDueTime('');
    }
  }

  // --- Zabaleno ----------------------------------------------------------
  // Poutko na hrane je jen jedno pro oba panely a vykresluje ho MS chat
  // (zadani 10. 9. 2026: "zustaly tam dve zalozky, staci jedna"). Ukoly se
  // tedy zabalene nekresli vubec - otevrou se zalozkou v hlavicce panelu.
  if (!expanded) return null;

  // --- Rozbaleno: cely seznam -------------------------------------------
  // Panel drzi celou pravou hranu od horni listy po spodek okna (zadani
  // 10. 9. 2026). Driv mel strop 24 % vysky, aby se nepral s chatem pod sebou
  // - ted jsou z nich zalozky jednoho panelu, takze otevreny je vzdycky jen
  // jeden a misto si nekradou.
  return (
    <aside className="fixed right-0 top-28 bottom-6 z-40 flex items-stretch">
      {/* Široký pruh na zavření přes celou výšku panelu - do malé šipky
          se špatně trefovalo (zadani 8. 9. 2026). Kliknout jde kamkoliv sem. */}
      <button
        type="button"
        onClick={() => otevriDok(null)}
        title={t('ukoly.skrytUkoly')}
        aria-label={t('ukoly.skrytUkoly')}
        className="w-8 shrink-0 rounded-l-card border border-r-0 border-line bg-field text-muted hover:bg-brand-purple hover:text-white transition-colors flex flex-col items-center justify-center gap-2"
      >
        <Chevron direction="right" />
        <span className="text-[10px] font-heading font-semibold uppercase tracking-wide [writing-mode:vertical-rl] rotate-180">
          {t('obecne.skryt')}
        </span>
        <Chevron direction="right" />
      </button>

      <div className="w-[360px] max-w-[86vw] bg-surface border border-r-0 border-line shadow-xl flex flex-col min-h-0">
      {/* Fialova hlavicka se zelenym napisem - stejne jako horni lista a jako
          MS chat. Ted v ni jsou zalozky Ukoly / MS chat. */}
      <ZalozkyDoku aktivni="ukoly" otevri={otevriDok} pocetUkolu={open.length} neprectene={pocty.chat} />

      {/* Roluje se jen obsah, hlavicka se zalozkami zustava na miste. */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3">

      <form onSubmit={addTask} className="flex flex-col gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('ukoly.novyUkol')}
          className="rounded-lg border border-line bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple w-full"
        />
        <div className="flex items-center gap-2">
          <DatumPole
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            title={t('ukoly.terminNepovinne')}
            className="flex-1 min-w-0 rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-xs outline-none focus:border-brand-purple"
          />
          {/* Do kolika hodin (21. 9. 2026) - dobrovolné, jen s datem. */}
          <input
            type="time"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
            disabled={!dueDate}
            title={dueDate ? t('ukoly.doKolikaHodin') : t('ukoly.nejdrivDatum')}
            className="w-[84px] shrink-0 rounded-lg border border-line bg-field px-2 py-2 text-ink font-heading text-xs outline-none focus:border-brand-purple disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={busy || !title.trim()}
            className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-50 shrink-0"
          >
            {t('ukoly.pridat')}
          </button>
        </div>
        {/* Slovy, na kdy to je - viz popisVybranehoDne nahoře. */}
        <p className="m-0 text-[11px] font-heading text-muted">
          {popisVybranehoDne(dueDate, t, jazyk)}
        </p>
      </form>

      {error && <p className="text-xs text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{error}</p>}

      <ul className="list-none p-0 m-0 flex flex-col divide-y divide-line">
        {open.length === 0 && (
          <li className="text-sm text-muted font-body py-2">{t('ukoly.zadneOtevrene')}</li>
        )}
        {open.map((task) =>
          upravovany === task.id ? (
            // Úprava vlastního úkolu (25. 9. 2026) - název, termín i čas.
            <li key={task.id} className="py-1.5">
              <UpravaMehoUkolu
                ukol={task}
                onKonec={(zmeneno) => {
                  setUpravovany(null);
                  if (zmeneno) {
                    router.refresh();
                    void nactiZadane();
                  }
                }}
              />
            </li>
          ) : (
          <li key={task.id} className="flex items-start gap-2.5 py-2.5 group">
            <input
              type="checkbox"
              checked={false}
              disabled={busy}
              onChange={() => send(`/api/tasks/${task.id}`, 'PATCH', { done: true })}
              className="mt-0.5 w-4 h-4 accent-[#6C4BF4] shrink-0"
            />
            <span className="flex-1 min-w-0 text-sm font-body text-ink break-words">
              {task.title}
              {task.zadalJmeno && (
                // Zadano z chatu pres @ukol - at je videt, ze si to clovek
                // nenapsal sam a od koho to prislo.
                <span className="block text-xs font-heading mt-0.5 text-brand-purple">
                  {t('ukoly.odKoho', { jmeno: task.zadalJmeno })}
                </span>
              )}
              {task.dueDate && (() => {
                const po = jePoTerminu(task.dueDate, task.dueTime ?? null);
                return (
                  <span className={`block text-xs font-heading mt-0.5 ${po ? 'text-danger' : 'text-muted'}`}>
                    {t(po ? 'ukoly.poTerminuTermin' : 'ukoly.doTerminu', {
                      termin: popisTerminu(task.dueDate, task.dueTime ?? null, jazyk),
                    })}
                  </span>
                );
              })()}
            </span>
            {/* Tužka - úprava názvu a termínu (25. 9. 2026). */}
            <button
              type="button"
              onClick={() => setUpravovany(task.id)}
              title={t('ukoly.upravitUkol')}
              aria-label={t('ukoly.upravitUkol')}
              className="mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-xs text-muted hover:text-brand-purple hover:bg-field opacity-0 group-hover:opacity-100 transition-opacity"
            >
              ✎
            </button>
            {/* Pojistka (18. 9. 2026) - úkol nezmizí na jedno ťuknutí. */}
            <TlacitkoSmazat
              onSmazat={() => send(`/api/tasks/${task.id}`, 'DELETE')}
              disabled={busy}
              popisek="✕"
              otazka={t('ukoly.opravduSmazat')}
              trida="text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            />
          </li>
          ),
        )}
      </ul>

      {done.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="text-xs font-heading text-muted hover:text-ink text-left"
          >
            {showDone ? t('ukoly.skrytHotove') : t('ukoly.hotovePocet', { pocet: done.length })}
          </button>
          {showDone && (
            <ul className="list-none p-0 m-0 flex flex-col divide-y divide-line">
              {done.map((task) => (
                <li key={task.id} className="flex items-start gap-2.5 py-2 group">
                  <input
                    type="checkbox"
                    checked
                    disabled={busy}
                    onChange={() => send(`/api/tasks/${task.id}`, 'PATCH', { done: false })}
                    className="mt-0.5 w-4 h-4 accent-[#6C4BF4] shrink-0"
                  />
                  <span className="flex-1 min-w-0 text-sm font-body text-muted line-through break-words">{task.title}</span>
                  <TlacitkoSmazat
                    onSmazat={() => send(`/api/tasks/${task.id}`, 'DELETE')}
                    disabled={busy}
                    popisek="✕"
                    otazka={t('ukoly.opravduSmazat')}
                    trida="text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ZadaneUkoly
        ukoly={zadane}
        onZmena={() => {
          void nactiZadane();
          router.refresh();
        }}
      />
      </div>
      </div>
    </aside>
  );
}
