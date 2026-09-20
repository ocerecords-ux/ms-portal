'use client';

import { useEffect, useState } from 'react';

/**
 * MS KALENDÁŘ DO TELEFONU (zadání 20. 9. 2026: „potřebuju, aby si můj tým
 * jednoduše přidal MS kalendář do svých kalendářů nativních. Např. Google
 * nebo Apple kalendář. Jen pro čtení").
 *
 * Jedno tlačítko v hlavičce Kalendáře → okno se třemi kroky:
 *  1. CO odebírat (celý kalendář / jedno studio / jen moje),
 *  2. KAM (Apple, Google, ostatní přes zkopírovaný odkaz),
 *  3. hotovo - kalendář se sám obnovuje, v telefonu je jen ke čtení.
 *
 * Odkaz je osobní. Kdo ho zneplatní, tomu v kalendáři přestane chodit
 * (a kdo odejde z týmu, tomu přestane chodit sám - viz /api/ical).
 */
type Rozsah = 'ALL' | 'STUDIO' | 'MINE';
type Odber = { id: string; scope: Rozsah; studioId: string | null; url: string; naposledy: string | null };

export function OdberKalendare({ studios }: { studios: { id: string; name: string; color: string | null }[] }) {
  const [otevreno, setOtevreno] = useState(false);
  const [rozsah, setRozsah] = useState<Rozsah>('ALL');
  const [studioId, setStudioId] = useState(studios[0]?.id ?? '');
  const [odkaz, setOdkaz] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [odbery, setOdbery] = useState<Odber[]>([]);
  const [bezi, setBezi] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [zkopirovano, setZkopirovano] = useState(false);

  const kratce = (nazev: string) => (nazev.split(' - ').pop() ?? nazev).trim();
  const popisRozsahu = (o: { scope: Rozsah; studioId: string | null }) =>
    o.scope === 'ALL'
      ? 'Celý kalendář'
      : o.scope === 'MINE'
        ? 'Jen moje'
        : `Studio ${kratce(studios.find((s) => s.id === o.studioId)?.name ?? '')}`;

  async function nactiOdbery() {
    const res = await fetch('/api/kalendar/odber');
    const data = await res.json().catch(() => ({}));
    if (res.ok) setOdbery(data.odbery ?? []);
  }

  useEffect(() => {
    if (otevreno) void nactiOdbery();
  }, [otevreno]);

  // Kazda zmena rozsahu = jiny odkaz; stary se schova, at nikdo neodebira omylem.
  useEffect(() => {
    setOdkaz(null);
    setQr(null);
    setZkopirovano(false);
  }, [rozsah, studioId]);

  async function vytvor() {
    setBezi(true);
    setChyba(null);
    try {
      const res = await fetch('/api/kalendar/odber', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: rozsah, studioId: rozsah === 'STUDIO' ? studioId : undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || 'Odkaz se nepodařilo vytvořit.');
        return;
      }
      setOdkaz(data.url);
      setQr(data.qr ?? null);
      void nactiOdbery();
    } finally {
      setBezi(false);
    }
  }

  async function zneplatni(id: string) {
    await fetch('/api/kalendar/odber', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revokeId: id }),
    });
    if (odbery.find((o) => o.id === id)?.url === odkaz) setOdkaz(null);
    void nactiOdbery();
  }

  async function kopiruj(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setZkopirovano(true);
      setTimeout(() => setZkopirovano(false), 2500);
    } catch {
      window.prompt('Zkopírujte odkaz:', text);
    }
  }

  const webcal = odkaz?.replace(/^https?:\/\//, 'webcal://') ?? '';
  const google = odkaz ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}` : '';

  const VOLBY: { klic: Rozsah; nazev: string; popis: string }[] = [
    { klic: 'ALL', nazev: 'Celý kalendář', popis: 'Všechna studia a Mimo studio' },
    { klic: 'STUDIO', nazev: 'Jedno studio', popis: 'Jen natáčení a události vybraného studia' },
    { klic: 'MINE', nazev: 'Jen moje', popis: 'Kde jsem zvukař a moje Mimo studio' },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOtevreno(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-heading font-semibold text-ink hover:border-brand-purple transition-colors"
        title="Přidat MS kalendář do Google, Apple nebo jiného kalendáře"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
          <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
          <path d="M3.5 10h17M8 3.5v3M16 3.5v3M12 13v5M9.5 15.5h5" />
        </svg>
        Do mého kalendáře
      </button>

      {otevreno && (
        <div
          className="fixed inset-0 z-[70] bg-black/55 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="MS kalendář do mého kalendáře"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOtevreno(false);
          }}
        >
          <div className="w-full max-w-xl bg-surface rounded-card border border-line shadow-lg p-5 sm:p-6 flex flex-col gap-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display text-2xl text-ink m-0">MS kalendář do mého kalendáře</p>
                <p className="text-sm font-body text-muted m-0 mt-1">
                  Uvidíte ho v Google, Apple nebo Outlook kalendáři vedle svých událostí. Jen pro čtení - měnit se
                  dá dál jen tady v portálu.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOtevreno(false)}
                aria-label="Zavřít"
                className="text-muted hover:text-ink text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* 1. Co */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-heading font-semibold text-muted uppercase tracking-wide m-0">1. Co chcete vidět</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {VOLBY.map((v) => (
                  <button
                    key={v.klic}
                    type="button"
                    onClick={() => setRozsah(v.klic)}
                    aria-pressed={rozsah === v.klic}
                    className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
                      rozsah === v.klic
                        ? 'border-brand-purple bg-brand-purple/10'
                        : 'border-dashed border-line hover:border-brand-purple'
                    }`}
                  >
                    <span className="block font-heading font-semibold text-sm text-ink">{v.nazev}</span>
                    <span className="block text-xs font-body text-muted mt-0.5">{v.popis}</span>
                  </button>
                ))}
              </div>
              {rozsah === 'STUDIO' && (
                <div className="flex gap-2 flex-wrap">
                  {studios.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStudioId(s.id)}
                      className={`inline-flex items-center gap-2 rounded-pill border px-3 py-1.5 text-sm font-heading font-semibold ${
                        studioId === s.id
                          ? 'border-brand-purple bg-brand-purple/10 text-brand-purpleDeep dark:text-brand-purpleLight'
                          : 'border-dashed border-line text-muted hover:text-ink'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color ?? '#7B55FF' }} />
                      {kratce(s.name)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Kam */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-heading font-semibold text-muted uppercase tracking-wide m-0">2. Kam ho přidat</p>
              {!odkaz ? (
                <div>
                  <button
                    type="button"
                    onClick={() => void vytvor()}
                    disabled={bezi}
                    className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep disabled:opacity-60"
                  >
                    {bezi ? 'Připravuji…' : 'Připravit odkaz'}
                  </button>
                  {chyba && <p className="text-sm text-danger m-0 mt-2">{chyba}</p>}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <a
                      href={webcal}
                      className="rounded-lg bg-brand-purple text-white px-4 py-3 no-underline hover:bg-brand-purpleDeep transition-colors"
                    >
                      <span className="block font-heading font-semibold text-sm">Apple Kalendář</span>
                      <span className="block text-xs opacity-80">iPhone, iPad, Mac - otevře se a potvrdíte Odebírat</span>
                    </a>
                    <a
                      href={google}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-brand-purple text-white px-4 py-3 no-underline hover:bg-brand-purpleDeep transition-colors"
                    >
                      <span className="block font-heading font-semibold text-sm">Google Kalendář</span>
                      <span className="block text-xs opacity-80">Otevře se Google, potvrdíte Přidat</span>
                    </a>
                  </div>
                  {/* QR (20. 9. 2026) - pocitac ukaze kod, iPhone ho nacte
                      fotoaparatem a Kalendar rovnou nabidne odber. */}
                  {qr && (
                    <div className="flex items-center gap-4 rounded-lg border border-line p-3">
                      <div
                        className="w-32 h-32 shrink-0 bg-white rounded-md p-1 [&>svg]:w-full [&>svg]:h-full"
                        dangerouslySetInnerHTML={{ __html: qr }}
                        aria-label="QR kód odběru kalendáře"
                        role="img"
                      />
                      <div className="text-sm font-body text-ink">
                        <p className="font-heading font-semibold m-0">Naskenujte iPhonem</p>
                        <p className="text-xs text-muted m-0 mt-1">
                          Otevřete fotoaparát, namiřte na kód a klepněte na nabídku nahoře. Kalendář se zeptá, jestli ho
                          chcete odebírat - potvrďte <b>Odebírat</b>.
                        </p>
                        <p className="text-xs text-muted m-0 mt-1">
                          Android: Google Kalendář v telefonu odběr přidat neumí - použijte tlačítko Google Kalendář na
                          počítači, v telefonu se pak objeví sám.
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-body text-muted">
                      Outlook a ostatní: zkopírujte odkaz a v kalendáři zvolte „Přidat kalendář z internetu / podle URL".
                    </span>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={odkaz}
                        onFocus={(e) => e.currentTarget.select()}
                        className="flex-1 min-w-0 rounded-lg border border-line bg-field px-3 py-2 text-xs font-mono text-ink"
                      />
                      <button
                        type="button"
                        onClick={() => void kopiruj(odkaz)}
                        className="rounded-lg border border-line px-3 py-2 text-sm font-heading font-semibold text-ink hover:border-brand-purple whitespace-nowrap"
                      >
                        {zkopirovano ? '✓ Zkopírováno' : 'Kopírovat'}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs font-body text-muted m-0 bg-field rounded-lg px-3 py-2">
                    Kalendář se obnovuje sám - Apple a Outlook zhruba každou hodinu, Google podle sebe (bývá to i
                    několik hodin). Odkaz je váš osobní, neposílejte ho mimo tým.
                  </p>
                </div>
              )}
            </div>

            {/* Moje odbery */}
            {odbery.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-line pt-4">
                <p className="text-xs font-heading font-semibold text-muted uppercase tracking-wide m-0">Moje odběry</p>
                <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
                  {odbery.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3 flex-wrap">
                      <span className="text-sm font-heading text-ink">
                        {popisRozsahu(o)}
                        <span className="text-xs font-body text-muted ml-2">
                          {o.naposledy
                            ? `naposledy staženo ${new Date(o.naposledy).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                            : 'zatím nestaženo'}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => void zneplatni(o.id)}
                        className="text-xs font-heading text-muted hover:text-danger underline"
                        title="Odkaz přestane fungovat - v kalendáři se události přestanou objevovat"
                      >
                        Zneplatnit
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
