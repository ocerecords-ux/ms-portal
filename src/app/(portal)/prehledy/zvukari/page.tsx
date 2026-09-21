import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { jeZapnuto } from '@/lib/oznameniServer';
import { formatCzk, formatDuration } from '@/lib/timesheets';
import {
  minulyMesic,
  nactiNastaveniPrehledu,
  nazevMesice,
  spoctiPrehledy,
} from '@/lib/mesicniPrehledServer';
import { VyberMesice } from './VyberMesice';
import { NastaveniPrehledu } from './NastaveniPrehledu';
import { NahledMailu, UkazatNahled } from './NahledMailu';

/**
 * CO CHODÍ ZVUKAŘŮM (zadání 21. 9. 2026: „chtěl bych někde vidět přehledy, co
 * chodí zvukařům za minulý měsíc. Abych někde mohl nastavit, kdy jim to
 * chodí a co").
 *
 * Nahoře souhrn za vybraný měsíc po zvukařích - stejná čísla, jaká jim
 * přijdou mailem - a u každého stav rozeslání a náhled jeho mailu. Pod tím
 * nastavení: den rozeslání, co v mailu je a vlastní vzkaz.
 *
 * Jen pro admina - jsou to peníze lidí.
 */
export const dynamic = 'force-dynamic';

function posledniMesice(pocet: number): string[] {
  const ted = new Date();
  const out: string[] = [];
  for (let i = 1; i <= pocet; i++) {
    const d = new Date(Date.UTC(ted.getUTCFullYear(), ted.getUTCMonth() - i + 1, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

export default async function ZvukariPage({ searchParams }: { searchParams?: { mesic?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/prehledy');

  const zadany = searchParams?.mesic;
  const mesic = zadany && /^\d{4}-\d{2}$/.test(zadany) ? zadany : minulyMesic();

  const [prehledy, nastaveni, zapnuto, odeslane] = await Promise.all([
    spoctiPrehledy(mesic).catch(() => []),
    nactiNastaveniPrehledu(),
    jeZapnuto('MESICNI_PREHLED'),
    prisma.mesicniPrehledOdeslan
      .findMany({ where: { mesic } })
      .catch(() => [] as { userId: string; odeslanoAt: Date }[]),
  ]);
  const odeslanoKomu = new Map<string, { odeslanoAt: Date }>();
  for (const o of odeslane) odeslanoKomu.set(o.userId, o);

  // Kdy přehled za tenhle měsíc odchází / odešel: nastavený den měsíce
  // následujícího.
  const [rok, cislo] = mesic.split('-').map(Number);
  const denRozeslani = new Date(Date.UTC(rok, cislo, nastaveni.den));
  const uzMelOdejit = denRozeslani.getTime() <= Date.now();
  const datum = (d: Date) => new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague' }).format(d);

  const soucet = prehledy.reduce(
    (s, p) => ({ minut: s.minut + p.minut, castka: s.castka + p.castka, bonus: s.bonus + p.bonusCelkem }),
    { minut: 0, castka: 0, bonus: 0 },
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 flex-wrap">
        <VyberMesice mesic={mesic} mesice={posledniMesice(13).map((m) => ({ hodnota: m, popis: nazevMesice(m) }))} />
        <span className="text-sm font-body text-muted">
          {!zapnuto
            ? 'Rozesílání je vypnuté.'
            : uzMelOdejit
              ? `Přehled za tenhle měsíc se rozesílal od ${datum(denRozeslani)}.`
              : `Přehled odejde ${datum(denRozeslani)} v 8:00.`}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Dlazdice nazev="Zvukařů" hodnota={String(prehledy.length)} />
        <Dlazdice nazev="Odpracováno" hodnota={formatDuration(soucet.minut)} />
        <Dlazdice nazev="Za práci" hodnota={formatCzk(soucet.castka)} />
        <Dlazdice nazev="Celkem s bonusy" hodnota={formatCzk(soucet.castka + soucet.bonus)} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(420px,40%)] gap-5 items-start">
      <div className="flex flex-col gap-5 min-w-0">
      <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          {nazevMesice(mesic)} po zvukařích
        </h2>
        {prehledy.length === 0 ? (
          <p className="text-sm text-muted m-0">V tomhle měsíci žádný zvukař nic nevykázal - nikomu nic nepřijde.</p>
        ) : (
          <div className="flex flex-col divide-y divide-line">
            {prehledy.map((p) => {
              const odeslano = odeslanoKomu.get(p.userId);
              const stav = odeslano
                ? { text: `Odesláno ${datum(odeslano.odeslanoAt)}`, trida: 'text-status-done' }
                : !p.email
                  ? { text: 'Nemá e-mail', trida: 'text-danger' }
                  : !zapnuto
                    ? { text: 'Vypnuto', trida: 'text-muted' }
                    : uzMelOdejit
                      ? { text: 'Zatím neodešlo', trida: 'text-danger' }
                      : { text: `Odejde ${datum(denRozeslani)}`, trida: 'text-muted' };
              return (
                <details key={p.userId} className="group py-3">
                  <summary className="flex items-center gap-3 flex-wrap cursor-pointer list-none">
                    <span className="text-muted text-xs transition-transform group-open:rotate-90">▶</span>
                    <span className="font-heading font-semibold text-ink min-w-[160px]">{p.jmeno}</span>
                    <span className="text-sm tabular-nums text-ink">{formatDuration(p.minut)}</span>
                    <span className="text-sm tabular-nums text-ink">{formatCzk(p.castka)}</span>
                    {p.bonusCelkem > 0 && (
                      <span className="text-sm tabular-nums text-muted">+ bonusy {formatCzk(p.bonusCelkem)}</span>
                    )}
                    <span className={`text-xs font-heading ml-auto ${stav.trida}`}>{stav.text}</span>
                    <UkazatNahled user={p.userId} />
                  </summary>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 pl-6 text-sm font-body">
                    <Seznam
                      nadpis="Podle druhu práce"
                      radky={p.druhy.map((d) => [d.nazev, `${formatDuration(d.minut)} · ${formatCzk(d.castka)}`])}
                    />
                    <Seznam nadpis="Projekty" radky={p.projekty.map((pr) => [pr.nazev, formatDuration(pr.minut)])} />
                    <Seznam nadpis="Bonusy" radky={p.bonusy.map((b) => [b.nazev, formatCzk(b.castka)])} />
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>

      <NastaveniPrehledu
        nastaveni={{
          den: nastaveni.den,
          castky: nastaveni.castky,
          druhy: nastaveni.druhy,
          projekty: nastaveni.projekty,
          bonusy: nastaveni.bonusy,
          poznamka: nastaveni.poznamka ?? '',
          zapnuto,
        }}
        zmena={
          nastaveni.zmenenoAt
            ? `Naposledy změněno ${datum(nastaveni.zmenenoAt)}${nastaveni.zmenilJmeno ? ` (${nastaveni.zmenilJmeno})` : ''}.`
            : null
        }
        mesic={mesic}
        nazevMesice={nazevMesice(mesic)}
        cekaNaOdeslani={prehledy.filter((p) => p.email && !odeslanoKomu.has(p.userId)).length}
      />
      </div>

      {/* Náhled drží na místě při rolování (21. 9. 2026). */}
      <div className="xl:sticky xl:top-6">
        <NahledMailu
          mesic={mesic}
          prvni={prehledy[0]?.userId ?? null}
          jmena={Object.fromEntries(prehledy.map((p) => [p.userId, p.jmeno]))}
        />
      </div>
      </div>
    </div>
  );
}

function Dlazdice({ nazev, hodnota }: { nazev: string; hodnota: string }) {
  return (
    <div className="bg-surface border border-line rounded-card shadow-sm p-4 flex flex-col gap-1 min-w-0">
      <span className="text-xs font-heading font-semibold uppercase tracking-wide text-muted">{nazev}</span>
      <span className="font-display text-2xl text-ink tabular-nums truncate">{hodnota}</span>
    </div>
  );
}

function Seznam({ nadpis, radky }: { nadpis: string; radky: [string, string][] }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="text-xs font-heading font-semibold uppercase tracking-wide text-muted">{nadpis}</span>
      {radky.length === 0 ? (
        <span className="text-muted">—</span>
      ) : (
        radky.map(([a, b]) => (
          <span key={a} className="flex justify-between gap-3">
            <span className="text-ink truncate">{a}</span>
            <span className="text-ink tabular-nums whitespace-nowrap">{b}</span>
          </span>
        ))
      )}
    </div>
  );
}
