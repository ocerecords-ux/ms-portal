import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { bonusZObratu, mujPodilNaObratu, nactiBonusyObratu } from '@/lib/bonusObratuServer';
import { koruny, nazevMesicePalubovky } from '@/lib/palubovka';
import { nactiJazyk } from '@/lib/jazykServer';
import { prelozit, prelozitS } from '@/lib/jazyk';

/**
 * MOJE BONUSY (zadání 6. 10. 2026: „potřebuju ještě dát Peterovi a Karolíně
 * do Přehledů záložku Moje bonusy. Kde uvidí aktuálně částku bez dph. Každý
 * z nich má jiný podíl na obratu").
 *
 * Nahoře jedno velké číslo - kolik mi k dnešku za letošek vyšlo - a pod ním
 * měsíce, ze kterých se to složilo. Procento je na kartě uživatele, takže se
 * mění bez zásahu do kódu a nikdo cizí tu svoje číslo nevidí.
 *
 * Žůžo-labůžo vidí navíc přehled všech podílů: rozdělovat je musí někdo,
 * kdo vidí obojí.
 *
 * ČÁSTKY JSOU BEZ DPH a počítají se z vystavených faktur podle data
 * vystavení - tedy z téhož základu jako obrat na Palubovce. Jiný základ by
 * znamenal dvě čísla, o kterých se dá hádat.
 */
export const dynamic = 'force-dynamic';

export default async function MojeBonusyPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const jeSpravce = session.user.role === 'ADMIN';
  const muj = await mujPodilNaObratu(session.user.id);
  // Kdo nemá podíl a není Žůžo-labůžo, tomu tahle záložka nepatří.
  if (muj === null && !jeSpravce) redirect('/prehledy');

  const jazyk = nactiJazyk();
  const data = await nactiBonusyObratu();
  const procento = (p: number) => `${p.toLocaleString(jazyk === 'en' ? 'en-GB' : 'cs-CZ')} %`;

  return (
    <div className="flex flex-col gap-5">
      {muj !== null && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Dlazdice
              nazev={prelozitS(jazyk, 'bonusObratu.mujBonus', { rok: data.rok })}
              hodnota={koruny(bonusZObratu(data.obratRoku, muj), jazyk)}
              vyrazna
            />
            <Dlazdice nazev={prelozit(jazyk, 'bonusObratu.mujPodil')} hodnota={procento(muj)} />
            <Dlazdice
              nazev={prelozitS(jazyk, 'bonusObratu.obratRoku', { rok: data.rok })}
              hodnota={koruny(data.obratRoku, jazyk)}
            />
          </div>
          <p className="text-sm font-body text-muted m-0">{prelozit(jazyk, 'bonusObratu.zaklad')}</p>

          <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
            <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
              {prelozit(jazyk, 'bonusObratu.poMesicich')}
            </h2>
            <div className="flex flex-col divide-y divide-line">
              <div className="flex items-center justify-between gap-4 py-2 text-xs font-heading font-semibold uppercase tracking-wide text-muted">
                <span className="min-w-0">{prelozit(jazyk, 'bonusObratu.mesic')}</span>
                <span className="flex items-center gap-6 shrink-0">
                  <span className="w-28 text-right">{prelozit(jazyk, 'bonusObratu.obrat')}</span>
                  <span className="w-28 text-right">{prelozit(jazyk, 'bonusObratu.bonus')}</span>
                </span>
              </div>
              {data.mesice.map((m) => (
                <div key={m.mesic} className="flex items-center justify-between gap-4 py-2">
                  <span className="font-heading text-sm text-ink capitalize min-w-0 truncate">
                    {nazevMesicePalubovky(m.mesic - 1, jazyk)}
                  </span>
                  <span className="flex items-center gap-6 shrink-0 tabular-nums">
                    <span className="w-28 text-right text-sm font-body text-muted">
                      {koruny(m.obrat, jazyk)}
                    </span>
                    <span className="w-28 text-right text-sm font-heading font-semibold text-ink">
                      {koruny(bonusZObratu(m.obrat, muj), jazyk)}
                    </span>
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 py-2 border-t-2 border-line">
                <span className="font-heading font-semibold text-sm text-ink">
                  {prelozitS(jazyk, 'bonusObratu.celkemRok', { rok: data.rok })}
                </span>
                <span className="flex items-center gap-6 shrink-0 tabular-nums">
                  <span className="w-28 text-right text-sm font-body text-muted">
                    {koruny(data.obratRoku, jazyk)}
                  </span>
                  <span className="w-28 text-right text-sm font-heading font-semibold text-ink">
                    {koruny(bonusZObratu(data.obratRoku, muj), jazyk)}
                  </span>
                </span>
              </div>
            </div>
          </section>
        </>
      )}

      {jeSpravce && (
        <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
          <div>
            <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
              {prelozit(jazyk, 'bonusObratu.vsichni')}
            </h2>
            <p className="text-sm font-body text-muted m-0 mt-1">{prelozit(jazyk, 'bonusObratu.vsichniPopis')}</p>
          </div>
          {data.lide.length === 0 ? (
            <p className="text-sm font-body text-muted m-0">{prelozit(jazyk, 'bonusObratu.nikdoNemaPodil')}</p>
          ) : (
            <div className="flex flex-col divide-y divide-line">
              {data.lide.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-4 py-2">
                  <span className="font-heading text-sm text-ink min-w-0 truncate">{c.jmeno}</span>
                  <span className="flex items-center gap-6 shrink-0 tabular-nums">
                    <span className="w-20 text-right text-sm font-body text-muted">{procento(c.procento)}</span>
                    <span className="w-28 text-right text-sm font-heading font-semibold text-ink">
                      {koruny(bonusZObratu(data.obratRoku, c.procento), jazyk)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Dlazdice({ nazev, hodnota, vyrazna = false }: { nazev: string; hodnota: string; vyrazna?: boolean }) {
  return (
    <div className="bg-surface border border-line rounded-card shadow-sm p-4 flex flex-col gap-1 min-w-0">
      <span className="text-xs font-heading font-semibold uppercase tracking-wide text-muted">{nazev}</span>
      <span
        className={`font-display tabular-nums truncate ${vyrazna ? 'text-3xl text-brand-purple' : 'text-2xl text-ink'}`}
      >
        {hodnota}
      </span>
    </div>
  );
}
