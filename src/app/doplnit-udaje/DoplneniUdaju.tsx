'use client';

import { useState } from 'react';
import { Volba, prepniVSeznamu } from '@/components/Volba';
import { CountrySelect } from '@/app/(admin)/admin/CountrySelect';
import { DEFAULT_COUNTRY } from '@/lib/countries';
import { MESTA_PRO_HERCE, mestaZeStudii, studiaZMest } from '@/lib/lokaceHercu';
import { prelozit, prelozitS, type Jazyk } from '@/lib/jazyk';

/**
 * PRŮVODCE PRO NOVÉHO HERCE (zadání 16. 9. 2026: „po tom, co si herec nastaví
 * heslo, bych potřeboval mu udělat takového průvodce. Postupně po něm chtít
 * jméno, adresu, RČ nebo IČ, DIČ, jestli je plátce DPH, číslo účtu, po tomto
 * ho úspěšně přihlásíme do portálu").
 *
 * JEDNA OTÁZKA NA OBRAZOVKU. Dlouhý formulář se na telefonu odroluje a člověk
 * z něj uteče; tady vidí vždycky jen to, na co se ptáme, a kolik toho zbývá.
 *
 * ULOŽÍ SE AŽ NA KONCI, jedním požadavkem. Kdyby se to ukládalo po krocích,
 * vznikl by z poloviny vyplněný účet pokaždé, když někdo zavře okno.
 *
 * CO JE POVINNÉ: jméno, adresa, rodné číslo nebo IČ a číslo účtu — bez toho
 * se nedá uzavřít smlouva ani poslat honorář. Města se dají přeskočit;
 * kdo neví, doplní si je později v Mém účtu.
 */

type Udaje = {
  name: string;
  addressStreet: string;
  addressCity: string;
  addressZip: string;
  addressCountry: string;
  /** Fyzická osoba vyplní rodné číslo, kdo fakturuje, vyplní IČ. */
  birthNumber: string;
  ic: string;
  dic: string;
  vatPayer: boolean;
  bankAccount: string;
  /** Města, ne konkrétní studia - viz MESTA_PRO_HERCE. */
  mesta: string[];
  /** Které číslo herec vyplňuje. */
  druhCisla: 'rc' | 'ic';
};

export function DoplneniUdaju({
  vychozi,
  jazyk = 'cs',
}: {
  vychozi: Partial<Omit<Udaje, 'mesta' | 'druhCisla'>> & { studioLocations?: string[] };
  /** Jazyk PROPEM - stránka stojí mimo (portal), tedy mimo JazykProvider. */
  jazyk?: Jazyk;
}) {
  const t = (klic: string) => prelozit(jazyk, klic);
  const [u, setU] = useState<Udaje>(() => ({
    name: '',
    addressStreet: '',
    addressCity: '',
    addressZip: '',
    birthNumber: '',
    ic: '',
    dic: '',
    vatPayer: false,
    bankAccount: '',
    ...vychozi,
    // Prázdná země z karty by přebila výchozí Českou republiku.
    addressCountry: vychozi.addressCountry || DEFAULT_COUNTRY,
    // Co už na kartě je, se zaškrtne - ale jako města, ne jednotlivá studia.
    mesta: mestaZeStudii(vychozi.studioLocations),
    // Kdo má na kartě IČ, tomu se rovnou nabídne IČ.
    druhCisla: vychozi.ic ? 'ic' : 'rc',
  }));
  const [krok, setKrok] = useState(0);
  const [chyba, setChyba] = useState<string | null>(null);
  const [bezi, setBezi] = useState(false);

  const nastav = <K extends keyof Udaje>(klic: K, hodnota: Udaje[K]) => {
    setU((p) => ({ ...p, [klic]: hodnota }));
    setChyba(null);
  };

  /** Kroky průvodce. `hotovo` říká, jestli se dá jít dál. */
  const kroky: {
    nadpis: string;
    popis?: string;
    obsah: React.ReactNode;
    hotovo: () => string | null;
  }[] = [
    {
      nadpis: t('doplneni.jmenoNadpis'),
      popis: t('doplneni.jmenoPopis'),
      obsah: (
        <input
          value={u.name}
          onChange={(e) => nastav('name', e.target.value)}
          autoComplete="name"
          autoFocus
          className="admin-input text-lg"
          placeholder={t('doplneni.jmenoPlaceholder')}
        />
      ),
      hotovo: () => (u.name.trim() ? null : t('doplneni.jmenoChyba')),
    },
    {
      nadpis: t('doplneni.adresaNadpis'),
      popis: t('doplneni.adresaPopis'),
      obsah: (
        <div className="flex flex-col gap-4">
          <Popisek text={t('doplneni.ulice')}>
            <input
              value={u.addressStreet}
              onChange={(e) => nastav('addressStreet', e.target.value)}
              autoComplete="street-address"
              autoFocus
              className="admin-input"
            />
          </Popisek>
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[160px]">
              <Popisek text={t('doplneni.mesto')}>
                <input
                  value={u.addressCity}
                  onChange={(e) => nastav('addressCity', e.target.value)}
                  autoComplete="address-level2"
                  className="admin-input"
                />
              </Popisek>
            </div>
            <div className="w-32">
              <Popisek text={t('doplneni.psc')}>
                <input
                  value={u.addressZip}
                  onChange={(e) => nastav('addressZip', e.target.value)}
                  autoComplete="postal-code"
                  inputMode="numeric"
                  className="admin-input"
                />
              </Popisek>
            </div>
          </div>
          <Popisek text={t('doplneni.zeme')}>
            <CountrySelect value={u.addressCountry} onChange={(k) => nastav('addressCountry', k)} />
          </Popisek>
        </div>
      ),
      hotovo: () =>
        u.addressStreet.trim() && u.addressCity.trim() ? null : t('doplneni.adresaChyba'),
    },
    {
      /**
       * JEN OTÁZKA NA DPH (zadání 16. 9. 2026: „tady potřebuji dát jen otázku
       * Plátce DPH, ano nebo ne — licenční smlouvy posíláme tak nebo tak, ale
       * ve chvíli, kdy je herec plátce DPH, tak musí následně vystavit
       * fakturu, kde připočte DPH").
       *
       * Ptát se, jestli je OSVČ nebo fyzická osoba, nemá smysl: na podobu
       * smlouvy to nemá vliv. Jediné, co se tím mění, je faktura.
       */
      nadpis: t('doplneni.dphNadpis'),
      popis: t('doplneni.dphPopis'),
      obsah: (
        <div className="flex gap-2 flex-wrap">
          <Prepinac
            aktivni={!u.vatPayer}
            onClick={() => nastav('vatPayer', false)}
            text={t('doplneni.nejsemPlatce')}
          />
          <Prepinac
            aktivni={u.vatPayer}
            onClick={() => nastav('vatPayer', true)}
            text={t('doplneni.jsemPlatce')}
          />
        </div>
      ),
      hotovo: () => null,
    },
    {
      /**
       * NEJDŘÍV VÝBĚR, POTOM JEDNO POLE (zadání 16. 9. 2026: „s tím IČ nebo RČ
       * bych to změnil buď na výběr to nebo to"). Dvě pole pod sebou sváděla
       * k vyplnění obou; takhle je z obrazovky jasné, že se čeká jedno číslo.
       *
       * DIČ se ptá jen plátce DPH - bez něj by fakturu s DPH nevystavil.
       */
      nadpis: t('doplneni.cisloNadpis'),
      popis: t('doplneni.cisloPopis'),
      obsah: (
        <div className="flex flex-col gap-4">
          <div className="flex gap-2 flex-wrap">
            <Prepinac
              aktivni={u.druhCisla === 'rc'}
              onClick={() => nastav('druhCisla', 'rc')}
              text={t('doplneni.rodneCislo')}
            />
            <Prepinac
              aktivni={u.druhCisla === 'ic'}
              onClick={() => nastav('druhCisla', 'ic')}
              text={t('doplneni.ic')}
            />
          </div>
          {u.druhCisla === 'rc' ? (
            <Popisek text={t('doplneni.rodneCislo')}>
              <input
                value={u.birthNumber}
                onChange={(e) => nastav('birthNumber', e.target.value)}
                autoFocus
                className="admin-input"
                placeholder="800101/1234"
              />
            </Popisek>
          ) : (
            <Popisek text={t('doplneni.ic')}>
              <input
                value={u.ic}
                onChange={(e) => nastav('ic', e.target.value)}
                inputMode="numeric"
                autoFocus
                className="admin-input"
                placeholder="12345678"
              />
            </Popisek>
          )}
          {u.vatPayer && (
            <Popisek text={t('doplneni.dic')}>
              <input
                value={u.dic}
                onChange={(e) => nastav('dic', e.target.value)}
                className="admin-input"
                placeholder="CZ12345678"
              />
            </Popisek>
          )}
        </div>
      ),
      hotovo: () => {
        if (u.druhCisla === 'rc' && !u.birthNumber.trim()) return t('doplneni.rcChyba');
        if (u.druhCisla === 'ic' && !u.ic.trim()) return t('doplneni.icChyba');
        if (u.vatPayer && !u.dic.trim()) return t('doplneni.dicChyba');
        return null;
      },
    },
    {
      nadpis: t('doplneni.ucetNadpis'),
      popis: t('doplneni.ucetPopis'),
      obsah: (
        <input
          value={u.bankAccount}
          onChange={(e) => nastav('bankAccount', e.target.value)}
          autoFocus
          className="admin-input text-lg"
          placeholder="123456789/0800"
        />
      ),
      hotovo: () => (u.bankAccount.trim() ? null : t('doplneni.ucetChyba')),
    },
    {
      /**
       * JEN MĚSTA (zadání 16. 9. 2026: „v lokaci bych ve formuláři nechal jen
       * jedno Brno"). Na kartě herce se pak zaškrtnou obě brněnská studia -
       * viz studiaZMest.
       */
      nadpis: t('doplneni.mestaNadpis'),
      popis: t('doplneni.mestaPopis'),
      obsah: (
        <div className="flex flex-wrap gap-2">
          {MESTA_PRO_HERCE.map(({ mesto }) => (
            <Volba
              key={mesto}
              vybrano={u.mesta.includes(mesto)}
              onZmena={(zapnout) => nastav('mesta', prepniVSeznamu(u.mesta, mesto, zapnout))}
            >
              {mesto}
            </Volba>
          ))}
        </div>
      ),
      hotovo: () => null,
    },
    {
      nadpis: t('doplneni.rekapitulace'),
      obsah: (
        <dl className="m-0 flex flex-col gap-2">
          <Radek popisek={t('doplneni.souhrnJmeno')} hodnota={u.name} />
          <Radek
            popisek={t('doplneni.souhrnAdresa')}
            hodnota={[u.addressStreet, [u.addressZip, u.addressCity].filter(Boolean).join(' ')]
              .filter(Boolean)
              .join(', ')}
          />
          <Radek
            popisek={t('doplneni.souhrnDph')}
            hodnota={
              u.vatPayer
                ? prelozitS(jazyk, 'doplneni.souhrnPlatce', { dic: u.dic })
                : t('doplneni.souhrnNeplatce')
            }
          />
          <Radek
            popisek={t(u.druhCisla === 'rc' ? 'doplneni.rodneCislo' : 'doplneni.souhrnIc')}
            hodnota={u.druhCisla === 'rc' ? u.birthNumber : u.ic}
          />
          <Radek popisek={t('doplneni.souhrnUcet')} hodnota={u.bankAccount} />
          <Radek
            popisek={t('doplneni.souhrnNataceni')}
            hodnota={u.mesta.length ? u.mesta.join(', ') : t('doplneni.souhrnNevybrano')}
          />
        </dl>
      ),
      hotovo: () => null,
    },
  ];

  const posledni = krok === kroky.length - 1;
  const aktualni = kroky[krok];

  function dal() {
    const problem = aktualni.hotovo();
    if (problem) {
      setChyba(problem);
      return;
    }
    if (!posledni) {
      // Uloží se, co je vyplněné teď (30. 9. 2026) - viz `telo` níž.
      void ulozPrubezne();
      setKrok((k) => k + 1);
      return;
    }
    void uloz();
  }

  /** Co se posílá na server. Stejný tvar pro průběžné i konečné uložení. */
  function telo(hotovo: boolean) {
    return {
      name: u.name,
      addressStreet: u.addressStreet,
      addressCity: u.addressCity,
      addressZip: u.addressZip,
      addressCountry: u.addressCountry,
      // Posílá se jen to číslo, které herec vybral - druhé by bylo jen
      // zbytkem po přepnutí volby.
      birthNumber: u.druhCisla === 'rc' ? u.birthNumber : '',
      ic: u.druhCisla === 'ic' ? u.ic : '',
      // DIČ má smysl jen u plátce - po přepnutí zpátky by zůstal viset.
      dic: u.vatPayer ? u.dic : '',
      vatPayer: u.vatPayer,
      bankAccount: u.bankAccount,
      // Z měst se na kartě stanou konkrétní studia (obě brněnská u Brna).
      studioLocations: studiaZMest(u.mesta),
      hotovo,
    };
  }

  /**
   * PRŮBĚŽNÉ ULOŽENÍ PO KAŽDÉM KROKU (oprava 30. 9. 2026: „nevím teď, jestli
   * vyplňovala další údaje").
   *
   * Průvodce se vyplňuje z telefonu cestou ze studia a do teď se odesílal až
   * posledním tlačítkem - kdo ho zavřel dřív, poslal nic. Tohle uloží, co už
   * vyplněné je, aby se nic neztratilo a bylo v portálu vidět, kam se došlo.
   *
   * SCHVÁLNĚ POTICHU: herec kliknul na Další, ne na Uložit. Když se to
   * nepovede, nic se mu nehlásí a zkusí se to zase v dalším kroku; jeho práci
   * to nezdržuje a konečné uložení chybu ohlásí normálně.
   */
  async function ulozPrubezne() {
    try {
      await fetch('/api/doplnit-udaje', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telo(false)),
      });
    } catch {
      // Schválně nic - viz komentář výš.
    }
  }

  async function uloz() {
    if (bezi) return;
    setBezi(true);
    setChyba(null);
    try {
      const res = await fetch('/api/doplnit-udaje', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telo(true)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || t('doplneni.neulozeno'));
        return;
      }
      // Tvrdé načtení, ne router.push: portál si při něm znovu přečte účet
      // a brána na doplnění údajů už herce nikam neodešle.
      window.location.href = '/projekty';
    } catch {
      setChyba(t('doplneni.neulozeno'));
    } finally {
      setBezi(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-heading text-muted uppercase tracking-wide m-0">
          {prelozitS(jazyk, 'doplneni.krokZe', { krok: krok + 1, celkem: kroky.length })}
        </p>
        <div className="h-1 bg-field rounded-pill mt-2 overflow-hidden">
          <div
            className="h-full bg-brand-purple transition-all"
            style={{ width: `${((krok + 1) / kroky.length) * 100}%` }}
          />
        </div>
      </div>

      <div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">{aktualni.nadpis}</h1>
        {aktualni.popis && <p className="text-muted text-sm mt-2 font-body m-0">{aktualni.popis}</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          dal();
        }}
        className="flex flex-col gap-5"
      >
        {aktualni.obsah}

        {chyba && <p className="text-sm font-body text-danger m-0">{chyba}</p>}

        <div className="flex gap-3 items-center flex-wrap">
          {krok > 0 && (
            <button
              type="button"
              onClick={() => {
                setChyba(null);
                setKrok((k) => k - 1);
              }}
              className="text-sm font-heading text-muted bg-transparent border-0 p-0 cursor-pointer hover:text-ink"
            >
              {t('doplneni.zpet')}
            </button>
          )}
          <button
            type="submit"
            disabled={bezi}
            className="text-sm font-heading font-semibold rounded-pill bg-brand-purple text-white px-6 py-3 disabled:opacity-60"
          >
            {bezi
              ? t('doplneni.ukladam')
              : posledni
                ? t('doplneni.hotovoDoPortalu')
                : t('doplneni.pokracovat')}
          </button>
        </div>
      </form>

      {krok === 0 && (
        <p className="text-xs font-body text-muted m-0">{t('doplneni.gdpr')}</p>
      )}
    </div>
  );
}

function Popisek({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-heading font-semibold text-ink">{text}</span>
      {children}
    </label>
  );
}

function Prepinac({ aktivni, onClick, text }: { aktivni: boolean; onClick: () => void; text: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-sm font-heading font-semibold rounded-pill border px-4 py-2.5 transition-colors ${
        aktivni
          ? 'border-brand-purple text-brand-purple bg-tint'
          : 'border-line text-muted hover:border-brand-purple'
      }`}
    >
      {text}
    </button>
  );
}

function Radek({ popisek, hodnota }: { popisek: string; hodnota: string }) {
  return (
    <div className="flex gap-3 border-b border-line pb-2 last:border-0">
      <dt className="text-sm font-heading text-muted w-28 shrink-0 m-0">{popisek}</dt>
      <dd className="text-sm font-body text-ink m-0 break-words">{hodnota || '—'}</dd>
    </div>
  );
}
