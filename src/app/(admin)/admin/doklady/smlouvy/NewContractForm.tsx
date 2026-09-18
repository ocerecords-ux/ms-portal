'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AddButton } from '@/components/AddButton';
import { CONTRACT_PLACEHOLDERS } from '@/lib/contracts';
import { ProjectSelect, type ProjectChoice } from '../ProjectSelect';
import { KOTVA_NOVE, useOtevriZeZkratky } from '@/lib/zkratky';
import { VyberPole } from '@/components/VyberPole';
import { najdiNakladHerce } from '@/lib/nakladHerce';
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
 * SMLOUVA O DÍLO SE UZAVÍRÁ S DODAVATELEM (zadání 16. 9. 2026: „tuto smlouvu
 * budeme uzavírat s dodavateli, takže protistranu bude čerpat z firmy-dodavatel
 * a pole Protistrana by se mělo přejmenovat na Dodavatel"). Nabídka firem se
 * u ní zúží na dodavatele a jmenuje se Dodavatel; u ostatních šablon zůstává
 * jako dřív. Herec, který dodává i jako firma, se do té nabídky dostane
 * tlačítkem „Přenést do dodavatelů" na své kartě.
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
  vychoziProjekt = null,
}: {
  /**
   * Projekt, se kterým se sem přišlo z detailu projektu (zadání 18. 9. 2026:
   * „bylo by dobré rovnou vytvořit nějaký doklad, který bude navázaný na
   * projekt"). Formulář se s ním rovnou otevře a herce i rozpočet si dotáhne
   * jako po ručním výběru.
   */
  vychoziProjekt?: string | null;
  issuers: { id: string; name: string; isDefault: boolean }[];
  companies: {
    id: string;
    name: string;
    /** KLIENT / DODAVATEL — smlouva o dílo se uzavírá jen s dodavateli. */
    typ: 'KLIENT' | 'DODAVATEL';
    contactName: string | null;
    contactEmail: string | null;
  }[];
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

  // S projektem v adrese nemá smysl čekat na kliknutí - člověk sem přišel
  // právě proto, aby smlouvu založil (18. 9. 2026).
  useEffect(() => {
    if (vychoziProjekt) setOpen(true);
  }, [vychoziProjekt]);
  const [form, setForm] = useState({
    issuerCompanyId: defaultIssuer?.id ?? '',
    templateId: templates[0]?.id ?? '',
    title: '',
    companyId: '',
    signerName: '',
    signerEmail: '',
    caflouProjectId: vychoziProjekt ?? '',
    actorUserId: '',
  });
  const [herci, setHerci] = useState<Herec[]>([]);
  const [naklady, setNaklady] = useState<Naklad[]>([]);
  const [projektInfo, setProjektInfo] = useState<{
    nazev: string;
    odevzdani: string | null;
    licenceUziti?: string | null;
  } | null>(null);
  /**
   * Předvyplněná ruční pole. Splatnost 30 dnů (zadání 15. 9. 2026), doba
   * licence jeden rok (zadání 17. 9. 2026: „doba licence by měla být defaultně
   * nastavena na 1 rok, případně se pak může měnit"). Obojí jde přepsat.
   */
  const [pole, setPole] = useState<Record<string, string>>({
    splatnost: '30',
    doba_licence: VYCHOZI_DOBA_LICENCE,
  });
  // Datumova rucni pole se drzi jako YYYY-MM-DD (to chce kalendar); do smlouvy
  // se posila cesky zapis, jaky by tam clovek napsal rucne.
  const [datumy, setDatumy] = useState<Record<string, string>>({});
  // Odkud se bere odmena: '' = jeste nevybrano, 'rucne' = napisu sam,
  // jinak poradi polozky v nakladech projektu.
  const [odmenaZdroj, setOdmenaZdroj] = useState('');
  /**
   * Tytéž hodnoty ještě v refu. Dosazování odměny běží z obsluhy výběru herce
   * i z načtení podkladů - a to druhé čte stav z chvíle, kdy se měnil projekt.
   * Přes ref se pozná, co je ve formuláři TEĎ, ne co tam bylo při renderu.
   */
  const odmenaZdrojRef = useRef('');
  const herciRef = useRef<Herec[]>([]);

  function nastavOdmenuZdroj(hodnota: string) {
    odmenaZdrojRef.current = hodnota;
    setOdmenaZdroj(hodnota);
  }
  function nastavHerce(seznam: Herec[]) {
    herciRef.current = seznam;
    setHerci(seznam);
  }
  /** Podepisujícího píšu ručně, i když jsou v nabídce herci (17. 9. 2026). */
  const [rucniPodpis, setRucniPodpis] = useState(false);

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
      nastavHerce([]);
      setNaklady([]);
      setProjektInfo(null);
      nastavOdmenuZdroj('');
      setPole((s) => ({ ...s, odmena: '' }));
      return;
    }
    let platne = true;
    fetch(`/api/admin/contracts/podklady?projekt=${encodeURIComponent(projekt)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!platne) return;
        const seznam: Herec[] = data?.herci ?? [];
        nastavHerce(seznam);
        setNaklady(data?.naklady ?? []);
        setProjektInfo(data?.projekt ?? null);
        // Odmena patri k projektu - pri zmene projektu se zahazuje, at se do
        // smlouvy nedostane castka z rozpoctu jineho projektu.
        nastavOdmenuZdroj('');
        setPole((s) => ({ ...s, odmena: '' }));
        // Termin dokonceni nataceni = datum odevzdani projektu (zadani
        // 15. 9. 2026). Co uz je napsane, se neprepisuje.
        /**
         * ÚČEL A ÚZEMÍ UŽITÍ z karty projektu (zadání 17. 9. 2026). Co už je
         * ve formuláři napsané, se nepřepisuje - člověk to mohl upravit pro
         * tuhle jednu smlouvu.
         */
        const uziti: string | null = data?.projekt?.licenceUziti ?? null;
        if (uziti?.trim()) setPole((s) => (s.uziti?.trim() ? s : { ...s, uziti: uziti.trim() }));

        const odevzdani: string | null = data?.projekt?.odevzdani ?? null;
        if (odevzdani) {
          const iso = odevzdani.slice(0, 10);
          setDatumy((s) => (s.termin ? s : { ...s, termin: iso }));
          setPole((s) => (s.termin?.trim() ? s : { ...s, termin: datumCesky(new Date(odevzdani)) }));
        }
        // Jeden herec na projektu je nejcastejsi pripad - vybrat ho rovnou,
        // ale uz napsane jmeno mu neprepisovat.
        if (seznam.length === 1) vyberHerce(seznam[0], false, data?.naklady ?? []);
      })
      .catch(() => {
        if (!platne) return;
        nastavHerce([]);
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
  function vyberHerce(herec: Herec | null, prepsat = true, seznamNakladu?: Naklad[]) {
    setForm((f) => ({
      ...f,
      actorUserId: herec?.id ?? '',
      signerName: herec && (prepsat || !f.signerName) ? herec.jmeno : f.signerName,
      signerEmail: herec && (prepsat || !f.signerEmail) ? herec.email : f.signerEmail,
    }));
    dosadOdmenuHerce(herec, seznamNakladu ?? naklady, prepsat);
  }

  /**
   * ODMĚNA SE DOSADÍ S HERCEM (zadání 17. 9. 2026: „mělo by to jít vybrat
   * automaticky i s cenou jako položka rozpočtu herec u daného projektu").
   *
   * Hledá se v nákladech projektu podle jména - viz lib/nakladHerce.ts. Když
   * se to netrefí jednoznačně, nabídka zůstane prázdná a člověk si položku
   * vybere sám; špatně dosazená částka ve smlouvě je horší než prázdné pole.
   *
   * VÝBĚR HERCE PŘEPÍŠE ODMĚNU (zadání 17. 9. 2026: „když vyberu, kdo
   * podepisuje, tak do pole Odměna/cena užití by se měla automaticky přepsat ta
   * cena z rozpočtu"). Když herce vybral člověk, přepíše se i to, co v poli
   * bylo - i ručně napsaná částka patřila předchozímu herci. Co vybral portál
   * sám (jediný herec projektu), hotovou volbu nepřepisuje.
   *
   * Když se částka ví, ale položka rozpočtu k ní nesedí, zapíše se do pole
   * ručně - číslo musí být vidět tak jako tak.
   */
  function dosadOdmenuHerce(herec: Herec | null, seznam: Naklad[], prepsat: boolean) {
    if (!herec) return;
    if (!prepsat && odmenaZdrojRef.current !== '') return;

    const index = najdiPolozkuHerce(herec, seznam);
    if (index !== null) {
      nastavOdmenuZdroj(String(index));
      setPole((s) => ({ ...s, odmena: korun(seznam[index].castka) }));
      return;
    }
    if (typeof herec.castka === 'number') {
      nastavOdmenuZdroj('rucne');
      setPole((s) => ({ ...s, odmena: korun(herec.castka as number) }));
    }
  }

  /** Která položka rozpočtu patří vybranému herci - nebo `null`. */
  function najdiPolozkuHerce(herec: Herec, seznam: Naklad[]): number | null {
    if (seznam.length === 0) return null;
    // Pořadí položky, kterou k němu našel server - to je nejjistější.
    if (typeof herec.nakladIndex === 'number' && seznam[herec.nakladIndex]) return herec.nakladIndex;
    // Záloha, kdyby index nedorazil: položka s touž částkou, pak podle jména.
    if (typeof herec.castka === 'number') {
      const podleCastky = seznam.findIndex((n) => n.castka === herec.castka);
      if (podleCastky >= 0) return podleCastky;
    }
    return najdiNakladHerce(seznam, herec.jmeno, herciRef.current.length || 1);
  }

  /**
   * Typ šablony. Pozná se podle názvu - šablony si admin upravuje sám, takže
   * zadrátovat ID nejde. Podle něj se jmenuje pole s termínem (popisekPole)
   * a pozná se smlouva s hercem (sHercem).
   */
  const druhSmlouvy = useMemo(() => {
    const nazev = templates.find((t) => t.id === form.templateId)?.name ?? '';
    if (/audiokn/i.test(nazev)) return 'audiokniha' as const;
    if (/reklam/i.test(nazev)) return 'reklama' as const;
    if (/o d[ií]lo/i.test(nazev)) return 'dilo' as const;
    return 'jine' as const;
  }, [templates, form.templateId]);

  /**
   * SMLOUVA S HERCEM Z PROJEKTU (zadání 15. 9. 2026: „u reklam by měla být
   * při zakládání smlouvy stejná pole jako u audioknihy, mělo by si to vzít
   * vše z projektu"). U audioknihy i u reklamy podepisuje sám herec, takže
   * se firma nevybírá a všechno - jméno, adresa, RČ/IČ, místo - se bere
   * z jeho karty na projektu.
   */
  const sHercem = druhSmlouvy === 'audiokniha' || druhSmlouvy === 'reklama';

  /**
   * SMLOUVA O DÍLO = DODAVATEL (zadání 16. 9. 2026). U ní se nabízejí jen
   * firmy typu Dodavatel; u ostatních smluv bez herce zůstává celá nabídka,
   * protože se tam podepisuje i s klienty.
   */
  const jeDilo = druhSmlouvy === 'dilo';
  const nabidkaFirem = useMemo(
    () => (jeDilo ? companies.filter((c) => c.typ === 'DODAVATEL') : companies),
    [companies, jeDilo],
  );

  // Po prepnuti na smlouvu o dilo nesmi zustat vybrana firma, ktera mezi
  // dodavateli neni - jinak by se do smlouvy dostal klient.
  useEffect(() => {
    if (!form.companyId) return;
    if (nabidkaFirem.some((c) => c.id === form.companyId)) return;
    setForm((f) => ({ ...f, companyId: '' }));
  }, [nabidkaFirem, form.companyId]);

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
    if (sHercem && form.companyId) setForm((f) => ({ ...f, companyId: '' }));
  }, [sHercem, form.companyId]);

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
      setError(
        jeDilo
          ? 'Vyberte projekt a dodavatele — z nich se skládá název smlouvy.'
          : 'Vyberte projekt a herce — z nich se skládá název smlouvy.',
      );
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
   * Název ručního pole. Termín znamená v každé smlouvě něco jiného (zadání
   * 15. 9. 2026: „Termín předání/natáčení - změnit na Termín dokončení
   * natáčení", pak „tím pádem by se tam to pole termín odevzdání u téhle
   * šablony mělo ukázat"), a obecné „Termín předání / natáčení" člověku
   * neřekne, co má vyplnit.
   */
  function popisekPole(key: string, vychozi: string): string {
    if (key !== 'termin') return vychozi;
    if (druhSmlouvy === 'audiokniha') return 'Termín dokončení natáčení';
    if (druhSmlouvy === 'reklama') return 'Termín pořízení záznamu';
    if (druhSmlouvy === 'dilo') return 'Termín odevzdání díla';
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

        {/* PROJEKT BEZ HERCE (upřesnění 17. 9. 2026). Dřív se políčko prostě
            neukázalo a nebylo poznat, jestli portál herce nenabízí, nebo ho
            projekt nemá vyplněného. U smlouvy, kterou podepisuje herec, je
            to ta první věc, kterou je potřeba vědět. */}
        {sHercem && form.caflouProjectId && herci.length === 0 && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Herec</span>
            <span className={`${inputClass} text-muted`}>— projekt nemá herce —</span>
            <span className="text-xs font-body text-danger">
              Doplňte herce u projektu a smlouva si z jeho karty vezme jméno, adresu i RČ nebo IČ.
              Odměnu si pak vezme z položky rozpočtu, která na něj sedí.
            </span>
          </label>
        )}

        {!sHercem && herci.length > 0 && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Herec z projektu</span>
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

      {/* U audioknihy a u reklamy je protistranou vzdycky herec (zadani 15. 9. 2026:
          „Protistrana - prejmenovat na Herec"), takze se misto vyberu firmy
          vybira herec z projektu - viz pole niz. Adresu i RC nebo ICO si
          portal vezme z jeho karty. */}
      <div className={`grid grid-cols-1 gap-3 ${sHercem ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
        {!sHercem && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{jeDilo ? 'Dodavatel' : 'Protistrana (firma)'}</span>
            <VyberPole
              required={jeDilo}
              value={form.companyId}
              onChange={(e) => vyberFirmu(e.target.value)}
              className={inputClass}
            >
              <option value="">{jeDilo ? '— vyberte dodavatele —' : '— bez firmy (herec) —'}</option>
              {nabidkaFirem.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </VyberPole>
            {jeDilo && (
              <span className="text-xs font-body text-muted">
                {nabidkaFirem.length === 0
                  ? 'Mezi firmami zatím není žádný dodavatel. Herce, který dodává i jako firma, přenesete do dodavatelů tlačítkem na jeho kartě.'
                  : 'IČ, DIČ i adresu si smlouva vezme z karty dodavatele. Herec, který dodává i jako firma, se sem dostane tlačítkem „Přenést do dodavatelů" na své kartě.'}
              </span>
            )}
          </label>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Kdo podepisuje</span>
          {/* U SMLOUVY S HERCEM SE PODEPISUJÍCÍ VYBÍRÁ, NEPÍŠE (zadání
              17. 9. 2026: „místo Kdo podepisuje chci přímo vybrat herce a aby
              se načetly jeho údaje i částka z rozpočtu"). V nabídce jsou herci
              projektu i ti, které portál poznal v jeho rozpočtu - u nich je
              rovnou vidět částka, která se dosadí do odměny. */}
          {sHercem && herci.length > 0 && !rucniPodpis ? (
            <>
              <VyberPole
                value={form.actorUserId}
                onChange={(e) => {
                  if (e.target.value === 'rucne') {
                    setRucniPodpis(true);
                    vyberHerce(null);
                    return;
                  }
                  vyberHerce(herci.find((h) => h.id === e.target.value) ?? null);
                }}
                className={inputClass}
              >
                <option value="">— vyberte herce —</option>
                {herci.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.jmeno}
                    {typeof h.castka === 'number' ? ` · ${korun(h.castka)}` : ''}
                    {h.identifikace ? ` · ${h.identifikace}` : ' · bez RČ a IČ'}
                  </option>
                ))}
                <option value="rucne">— napíšu ručně —</option>
              </VyberPole>
              <span className="text-xs font-body text-muted">
                {vybranyHerec
                  ? [
                      vybranyHerec.identifikace
                        ? `Do smlouvy půjde ${vybranyHerec.identifikace}`
                        : 'Na kartě nemá RČ ani IČ — ve smlouvě bude „…"',
                      vybranyHerec.maAdresu ? 'a adresa z jeho karty' : 'adresu na kartě nemá',
                      typeof vybranyHerec.castka === 'number' ? 'odměna je z rozpočtu projektu' : null,
                    ]
                      .filter(Boolean)
                      .join(', ') + '.'
                  : 'Adresu i RČ nebo IČ si portál vezme z karty herce.'}
                {vybranyHerec?.zRozpoctu ? ' U projektu navázaný není — portál ho poznal v rozpočtu.' : ''}
              </span>
            </>
          ) : (
            <>
              <input
                required
                value={form.signerName}
                onChange={(e) => set('signerName', e.target.value)}
                placeholder="Jméno a příjmení"
                className={inputClass}
              />
              {sHercem && herci.length > 0 && (
                <button
                  type="button"
                  onClick={() => setRucniPodpis(false)}
                  className="text-xs font-heading text-brand-purple hover:underline self-start"
                >
                  Vybrat herce ze seznamu
                </button>
              )}
            </>
          )}
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
            Co portál neví — doplní se rovnou do textu smlouvy. Co necháte prázdné, se ve smlouvě
            buď vynechá (když stojí ve výčtu), nebo zůstane jako „…" a dopíšete to v editoru.
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
                        nastavOdmenuZdroj(volba);
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
                  {p.key === 'termin' && form.caflouProjectId && (
                    // Kdyz projekt datum odevzdani nema, at je videt PROC je
                    // policko prazdne - jinak clovek ceka, ze se doplni samo
                    // (zadani 15. 9. 2026).
                    <span className="text-xs font-body text-muted">
                      {projektInfo?.odevzdani
                        ? 'Předvyplněno z data odevzdání projektu.'
                        : 'Projekt nemá datum odevzdání — vyplňte termín ručně.'}
                    </span>
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

/**
 * Částka v celých korunách, jak se píše do smlouvy: „30 000 Kč".
 *
 * Mezery jsou OBYČEJNÉ, ne pevné - pevná mezera není v podmnožině písma, se
 * kterou se sází PDF smlouvy, a vyšel by z ní otazník.
 */
function korun(castka: number): string {
  return `${Math.round(castka).toLocaleString('cs-CZ').replace(/\u00a0/g, ' ')} Kč`;
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
  /** Částka z položky rozpočtu, která na něj sedí (zadání 17. 9. 2026). */
  castka?: number | null;
  /** Pořadí té položky v nákladech projektu - podle něj se vybere v selectu. */
  nakladIndex?: number | null;
  /** Portál ho našel v rozpočtu, u projektu navázaný není. */
  zRozpoctu?: boolean;
};

/**
 * Výchozí doba licence u reklamy (zadání 17. 9. 2026). Je to text, který jde
 * rovnou do věty ve smlouvě („na dobu jednoho (1) roku"), takže se sem píše
 * tak, jak se to čte - ne „1 rok".
 */
const VYCHOZI_DOBA_LICENCE = 'jednoho (1) roku';

/** Nápověda k ručním polím — ať je vidět, v jakém tvaru to má být. */
const NAPOVEDA: Record<string, string> = {
  odmena: 'např. 5 000 Kč',
  termin: 'např. 20. 9. 2026',
  splatnost: 'např. 30',
  rozsah_dila: 'co se dělá — překlad, úprava dialogů, dramaturgie…',
  uziti: 'např. audio reklama na Spotify, CZ+SK',
  doba_licence: 'např. jednoho (1) roku',
};
