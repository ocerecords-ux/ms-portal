'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AddButton } from '@/components/AddButton';
import { CONTRACT_PLACEHOLDERS } from '@/lib/contracts';
import { ProjectSelect, type ProjectChoice } from '../ProjectSelect';
import { KOTVA_NOVE, useOtevriZeZkratky } from '@/lib/zkratky';
import { VyberPole } from '@/components/VyberPole';
import { DatumPole } from '@/components/DatumPole';

/**
 * Založení smlouvy. Šablona se vybere, pole se předvyplní z databáze a text
 * se dál upravuje až v editoru — na tomhle kroku jde jen o to, aby se
 * smlouva založila na pár kliknutí.
 *
 * RUČNÍ POLE SE PTAJÍ ROVNOU TADY (zadání 13. 9. 2026: „na smlouvě není
 * nikde částka"). Odměnu, termín ani splatnost portál nikde nemá, takže by se
 * do textu vložilo „…" a odměna by ve smlouvě chyběla. Formulář se proto
 * podívá do vybrané šablony a zeptá se přesně na ta pole, která v ní opravdu
 * jsou — u smlouvy o dílo na rozsah díla, u reklamy na dobu licence.
 *
 * HERCE UŽ PORTÁL ZNÁ (zadání 13. 9. 2026: „tady tyto věci portál ví. Podle
 * projektu dá na výběr RČ nebo IČ herce a název podle názvu projektu").
 * Po výběru projektu se nabídnou jeho herci a z karty vybraného se do smlouvy
 * vezme jméno, e-mail, adresa i RČ nebo IČ — podle toho, co má vyplněné.
 * Název díla se bere z názvu projektu.
 *
 * U SMLOUVY NA AUDIOKNIHU JE TOHO PŘEDVYPLNĚNÉHO VÍC (zadání 15. 9. 2026):
 * název smlouvy je „název projektu - herec", protistrana se jmenuje rovnou
 * Herec, odměna se dá vybrat z položkových nákladů projektu (nebo napsat
 * ručně), termín se bere z data odevzdání projektu a splatnost je 30 dnů.
 * Všechno jde přepsat - je to předvyplnění, ne zámek.
 */
export function NewContractForm({
  issuers,
  companies,
  templates,
  projects,
}: {
  issuers: { id: string; name: string; isDefault: boolean }[];
  companies: { id: string; name: string; contactName: string | null; contactEmail: string | null }[];
  templates: { id: string; name: string; body: string }[];
  projects: ProjectChoice[];
}) {
  const router = useRouter();
  const defaultIssuer = issuers.find((i) => i.isDefault) ?? issuers[0];

  const [open, setOpen] = useState(false);

  // Prisel sem clovek pres rychlou volbu z leveho panelu? Pak rovnou
  // rozbalit - zkratka ma vest do editacniho okna, ne jen na stranku
  // (zadani 9. 9. 2026).
  useOtevriZeZkratky(() => setOpen(true));
  const [form, setForm] = useState({
    issuerCompanyId: defaultIssuer?.id ?? '',
    templateId: templates[0]?.id ?? '',
    title: '',
    companyId: '',
    signerName: '',
    signerEmail: '',
    caflouProjectId: '',
    actorUserId: '',
  });
  const [herci, setHerci] = useState<Herec[]>([]);
  const [naklady, setNaklady] = useState<Naklad[]>([]);
  const [projektInfo, setProjektInfo] = useState<{ nazev: string; odevzdani: string | null } | null>(null);
  // Splatnost je 30 dnu, dokud ji nekdo neprepise (zadani 15. 9. 2026).
  const [pole, setPole] = useState<Record<string, string>>({ splatnost: '30' });
  // Datumova rucni pole se drzi jako YYYY-MM-DD (to chce kalendar); do smlouvy
  // se posila cesky zapis, jaky by tam clovek napsal rucne.
  const [datumy, setDatumy] = useState<Record<string, string>>({});
  // Odkud se bere odmena: '' = jeste nevybrano, 'rucne' = napisu sam,
  // jinak poradi polozky v nakladech projektu.
  const [odmenaZdroj, setOdmenaZdroj] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Herci vybraneho projektu. Nacitaji se az po vyberu - poslat na klienta
  // herce vsech projektu by byl zbytecne velky balik.
  useEffect(() => {
    const projekt = form.caflouProjectId;
    if (!projekt) {
      setHerci([]);
      setNaklady([]);
      setProjektInfo(null);
      return;
    }
    let platne = true;
    fetch(`/api/admin/contracts/podklady?projekt=${encodeURIComponent(projekt)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!platne) return;
        const seznam: Herec[] = data?.herci ?? [];
        setHerci(seznam);
        setNaklady(data?.naklady ?? []);
        setProjektInfo(data?.projekt ?? null);
        setOdmenaZdroj('');
        // Termin dokonceni nataceni = datum odevzdani projektu (zadani
        // 15. 9. 2026). Co uz je napsane, se neprepisuje.
        const odevzdani: string | null = data?.projekt?.odevzdani ?? null;
        if (odevzdani) {
          const iso = odevzdani.slice(0, 10);
          setDatumy((s) => (s.termin ? s : { ...s, termin: iso }));
          setPole((s) => (s.termin?.trim() ? s : { ...s, termin: datumCesky(new Date(odevzdani)) }));
        }
        // Jeden herec na projektu je nejcastejsi pripad - vybrat ho rovnou,
        // ale uz napsane jmeno mu neprepisovat.
        if (seznam.length === 1) vyberHerce(seznam[0], false);
      })
      .catch(() => {
        if (!platne) return;
        setHerci([]);
        setNaklady([]);
        setProjektInfo(null);
      });
    return () => {
      platne = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.caflouProjectId]);

  /**
   * Výběr herce doplní podepisujícího — zbytek (adresu, RČ nebo IČ) si portál
   * dotáhne z jeho karty sám. `prepsat` je false, když herce vybral portál:
   * co už je napsané, se nepřepisuje.
   */
  function vyberHerce(herec: Herec | null, prepsat = true) {
    setForm((f) => ({
      ...f,
      actorUserId: herec?.id ?? '',
      signerName: herec && (prepsat || !f.signerName) ? herec.jmeno : f.signerName,
      signerEmail: herec && (prepsat || !f.signerEmail) ? herec.email : f.signerEmail,
    }));
  }

  /**
   * Smlouva na audioknihu. Pozná se podle názvu šablony - šablony si admin
   * upravuje sám, takže zadrátovat ID nejde.
   */
  const jeAudiokniha = useMemo(
    () => /audiokn/i.test(templates.find((t) => t.id === form.templateId)?.name ?? ''),
    [templates, form.templateId],
  );

  /** Název projektu bez firmy - „NĚCO — Audiotéka" je v názvu smlouvy navíc. */
  const nazevProjektu = useMemo(() => {
    if (projektInfo?.nazev?.trim()) return projektInfo.nazev.trim();
    const volba = projects.find((p) => p.id === form.caflouProjectId);
    return volba ? volba.label.split(' — ')[0].trim() : '';
  }, [projektInfo, projects, form.caflouProjectId]);

  /**
   * Název smlouvy „Projekt - Herec" (zadání 15. 9. 2026). NEDÁ SE MĚNIT
   * (upřesnění tentýž den: „název smlouvy může svítit nad tím třeba graficky,
   * nedá se měnit") - skládá se sám z projektu a herce, které se vybírají
   * hned nahoře, a jen se ukazuje.
   */
  useEffect(() => {
    const herec = form.signerName.trim();
    const slozeny = [nazevProjektu, herec].filter(Boolean).join(' - ');
    setForm((f) => (f.title === slozeny ? f : { ...f, title: slozeny }));
  }, [nazevProjektu, form.signerName]);

  // U audioknihy se firma nevybira, takze po prepnuti sablony nesmi zustat
  // vybrana z drivejska - jinak by se do smlouvy dostala misto herce.
  useEffect(() => {
    if (jeAudiokniha && form.companyId) setForm((f) => ({ ...f, companyId: '' }));
  }, [jeAudiokniha, form.companyId]);

  /** Ruční pole, která ve vybrané šabloně skutečně jsou. */
  const rucniPole = useMemo(() => {
    const sablona = templates.find((t) => t.id === form.templateId);
    if (!sablona) return [];
    return CONTRACT_PLACEHOLDERS.filter(
      (p) => p.rucne && new RegExp(`\\{\\{\\s*${p.key}\\s*\\}\\}`, 'i').test(sablona.body),
    );
  }, [templates, form.templateId]);

  /** Výběr firmy rovnou nabídne její kontaktní osobu a e-mail. */
  function vyberFirmu(id: string) {
    const company = companies.find((c) => c.id === id);
    setForm((f) => ({
      ...f,
      companyId: id,
      signerName: f.signerName || company?.contactName || '',
      signerEmail: f.signerEmail || company?.contactEmail || '',
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Nazev se sklada z projektu a herce, takze prazdny znamena, ze ani jedno
    // neni vybrane - smlouva bez nazvu se v prehledu nedá najít.
    if (!form.title.trim()) {
      setError('Vyberte projekt a herce — z nich se skládá název smlouvy.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          companyId: form.companyId || undefined,
          caflouProjectId: form.caflouProjectId || undefined,
          actorUserId: form.actorUserId || undefined,
          templateId: form.templateId || undefined,
          pole: rucniPole.reduce<Record<string, string>>((acc, p) => {
            const hodnota = pole[p.key]?.trim();
            if (hodnota) acc[p.key] = hodnota;
            return acc;
          }, {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Smlouvu se nepodařilo založit.');
        return;
      }
      router.push(`/admin/doklady/smlouvy/${data.id}`);
    } catch {
      setError('Smlouvu se nepodařilo založit.');
    } finally {
      setBusy(false);
    }
  }

  const vybranyHerec = herci.find((h) => h.id === form.actorUserId) ?? null;

  /**
   * Název ručního pole. U audioknihy se termín jmenuje jinak (zadání
   * 15. 9. 2026: „Termín předání/natáčení - změnit na Termín dokončení
   * natáčení"); u ostatních smluv {{termin}} znamená něco jiného (předání
   * díla, pořízení záznamu), takže se přejmenovává jen tady.
   */
  function popisekPole(key: string, vychozi: string): string {
    if (jeAudiokniha && key === 'termin') return 'Termín dokončení natáčení';
    return vychozi;
  }

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full';

  if (!open) {
    return (
      <span id={KOTVA_NOVE}>
        <AddButton onClick={() => setOpen(true)}>Nová smlouva</AddButton>
      </span>
    );
  }

  return (
    <form id={KOTVA_NOVE}
      onSubmit={submit}
      className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-4 w-full"
    >
      <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Nová smlouva</h2>

      {/* Název smlouvy se nezadává - svítí nahoře a skládá se z projektu
          a herce (zadání 15. 9. 2026). */}
      <div className="rounded-card border border-line bg-tint px-4 py-3">
        <span className="block text-[11px] font-heading uppercase tracking-wide text-muted">Název smlouvy</span>
        <p className={`m-0 font-heading font-semibold text-lg ${form.title ? 'text-ink' : 'text-muted'}`}>
          {form.title || 'Vyberte projekt a herce — název se složí sám'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Projekt</span>
          <ProjectSelect
            value={form.caflouProjectId}
            onChange={(id) => set('caflouProjectId', id)}
            projects={projects}
            className={inputClass}
          />
        </label>

        {herci.length > 0 && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{jeAudiokniha ? 'Herec' : 'Herec z projektu'}</span>
            <VyberPole
              value={form.actorUserId}
              onChange={(e) => vyberHerce(herci.find((h) => h.id === e.target.value) ?? null)}
              className={inputClass}
            >
              <option value="">— nevybírat, vyplním ručně —</option>
              {herci.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.jmeno}
                  {h.identifikace ? ` · ${h.identifikace}` : ' · bez RČ a IČ'}
                </option>
              ))}
            </VyberPole>
            <span className="text-xs font-body text-muted">
              {vybranyHerec
                ? vybranyHerec.identifikace
                  ? `Do smlouvy půjde ${vybranyHerec.identifikace}${vybranyHerec.maAdresu ? ' a adresa z jeho karty.' : '. Adresu na kartě nemá — doplní se „…".'}`
                  : 'Na kartě nemá RČ ani IČ — ve smlouvě bude „…" a dopíšete to v textu.'
                : 'Adresu i RČ nebo IČ si portál vezme z karty herce.'}
            </span>
          </label>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Šablona</span>
          <VyberPole value={form.templateId} onChange={(e) => set('templateId', e.target.value)} className={inputClass}>
            <option value="">— prázdná smlouva —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </VyberPole>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Za naši firmu</span>
          <VyberPole
            value={form.issuerCompanyId}
            onChange={(e) => set('issuerCompanyId', e.target.value)}
            className={inputClass}
          >
            {issuers.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </VyberPole>
        </label>
      </div>

      {/* U audioknihy je protistranou vzdycky herec (zadani 15. 9. 2026:
          „Protistrana - prejmenovat na Herec"), takze se misto vyberu firmy
          vybira herec z projektu - viz pole niz. Adresu i RC nebo ICO si
          portal vezme z jeho karty. */}
      <div className={`grid grid-cols-1 gap-3 ${jeAudiokniha ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
        {!jeAudiokniha && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Protistrana (firma)</span>
            <VyberPole value={form.companyId} onChange={(e) => vyberFirmu(e.target.value)} className={inputClass}>
              <option value="">— bez firmy (herec) —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </VyberPole>
          </label>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Kdo podepisuje</span>
          <input
            required
            value={form.signerName}
            onChange={(e) => set('signerName', e.target.value)}
            placeholder="Jméno a příjmení"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">E-mail podepisujícího</span>
          <input
            required
            type="email"
            value={form.signerEmail}
            onChange={(e) => set('signerEmail', e.target.value)}
            placeholder="na tenhle e-mail půjde odkaz k podpisu"
            className={inputClass}
          />
        </label>
      </div>

      {rucniPole.length > 0 && (
        <div className="rounded-card border border-line bg-field/60 p-4 flex flex-col gap-3">
          <p className="text-sm font-body text-muted m-0">
            Co portál neví — doplní se rovnou do textu smlouvy. Co necháte prázdné, bude ve smlouvě
            jako „…" a dopíšete to v editoru.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rucniPole.map((p) => {
              // Odmena se da vybrat z polozkovych nakladu projektu (zadani
              // 15. 9. 2026: „da na vyber polozky z nakladu u projektu nebo
              // i moznost napsat rucne"). Kdyz projekt naklady nema, zustane
              // tu obycejne pole jako driv.
              if (p.key === 'odmena' && naklady.length > 0) {
                const rucne = odmenaZdroj === 'rucne';
                return (
                  <label key={p.key} className="flex flex-col gap-1.5">
                    <span className="text-sm font-body text-ink">{popisekPole(p.key, p.label)}</span>
                    <VyberPole
                      value={odmenaZdroj}
                      onChange={(e) => {
                        const volba = e.target.value;
                        setOdmenaZdroj(volba);
                        if (volba === 'rucne') {
                          setPole((s) => ({ ...s, odmena: '' }));
                          return;
                        }
                        const polozka = naklady[Number(volba)];
                        setPole((s) => ({ ...s, odmena: polozka ? korun(polozka.castka) : '' }));
                      }}
                      className={inputClass}
                    >
                      <option value="">— vyberte z nákladů projektu —</option>
                      {naklady.map((n, i) => (
                        <option key={`${n.nazev}-${i}`} value={String(i)}>
                          {n.nazev || 'Bez názvu'} · {korun(n.castka)}
                        </option>
                      ))}
                      <option value="rucne">— napíšu ručně —</option>
                    </VyberPole>
                    {rucne && (
                      <input
                        autoFocus
                        value={pole.odmena ?? ''}
                        onChange={(e) => setPole((s) => ({ ...s, odmena: e.target.value }))}
                        placeholder={NAPOVEDA.odmena}
                        className={inputClass}
                      />
                    )}
                    {!rucne && pole.odmena && (
                      <span className="text-xs font-body text-muted">Do smlouvy půjde {pole.odmena} bez DPH.</span>
                    )}
                  </label>
                );
              }
              return (
                <label key={p.key} className="flex flex-col gap-1.5">
                  <span className="text-sm font-body text-ink">{popisekPole(p.key, p.label)}</span>
                  {p.datum ? (
                    <DatumPole
                      value={datumy[p.key] ?? ''}
                      onChange={(e) => {
                        const iso = e.target.value;
                        setDatumy((s) => ({ ...s, [p.key]: iso }));
                        setPole((s) => ({ ...s, [p.key]: iso ? datumCesky(new Date(`${iso}T12:00:00`)) : '' }));
                      }}
                      className={inputClass}
                    />
                  ) : (
                  <input
                    value={pole[p.key] ?? ''}
                    onChange={(e) => setPole((s) => ({ ...s, [p.key]: e.target.value }))}
                    placeholder={NAPOVEDA[p.key] ?? ''}
                    className={inputClass}
                  />
                  )}
                  {p.key === 'termin' && projektInfo?.odevzdani && (
                    <span className="text-xs font-body text-muted">Předvyplněno z data odevzdání projektu.</span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{error}</p>}

      <div className="flex items-center gap-3">
        <AddButton type="submit" disabled={busy}>
          {busy ? 'Zakládám…' : 'Založit a upravit text'}
        </AddButton>
        <button type="button" onClick={() => setOpen(false)} className="text-muted text-sm font-heading">
          Zavřít
        </button>
      </div>
    </form>
  );
}

type Naklad = { nazev: string; castka: number };

/** Částka v celých korunách, jak se píše do smlouvy. */
function korun(castka: number): string {
  return `${Math.round(castka).toLocaleString('cs-CZ')} Kč`;
}

/** Datum ve tvaru, v jakém se píše do smlouvy: 20. 9. 2026. */
function datumCesky(datum: Date): string {
  return new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(datum);
}

type Herec = {
  id: string;
  jmeno: string;
  email: string;
  /** „IČO: 07459424" nebo „RČ: 666008/1549" — prázdné, když nemá ani jedno. */
  identifikace: string;
  maAdresu: boolean;
};

/** Nápověda k ručním polím — ať je vidět, v jakém tvaru to má být. */
const NAPOVEDA: Record<string, string> = {
  odmena: 'např. 5 000 Kč',
  termin: 'např. 20. 9. 2026',
  splatnost: 'např. 30',
  rozsah_dila: 'co se dělá — překlad, úprava dialogů, dramaturgie…',
  uziti: 'např. audio reklama na Spotify, CZ+SK',
  doba_licence: 'např. jednoho (1) roku',
};
