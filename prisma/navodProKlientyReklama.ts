/**
 * NÁPOVĚDA PRO KLIENTY - PŘIPOMÍNKY KE SPOTU A SCHVÁLENÍ (zadání
 * 24. 9. 2026: „je třeba rozlišit dva druhy. Pro audioknihy a pro reklamy.
 * Podle toho by se i návody měly objevovat klientovi").
 *
 * Reklamní spot se nepřeposlouchává v AudioTaggeru - má vlastní tagger, kde
 * se píšou připomínky k času ve vlně. Klient reklamní firmy tedy dostane
 * tenhle návod (proDruhy: ['AD']) a návod o audioknize nevidí vůbec.
 *
 * PÍŠE SE PRO KLIENTA, NE PRO NÁS. Co se u nás po odeslání a schválení stane
 * (zvonečky, stavy, fakturace), patří do interního návodu
 * navodReklamyPripominky.ts.
 *
 * SCHVÁLENÍ SE NEDÁ VZÍT ZPÁTKY, a tak je to napsané rovnou.
 *
 * OBRÁZKY jsou v public/navody/reklamy-*.png, kreslí se z repliky
 * scripts/navody/reklamy.html (node scripts/navody/snimky.mjs reklamy).
 */
export const KLIENT_REKLAMA = {
  slug: 'pripominky-ke-spotu',
  nazev: 'Připomínky ke spotu a schválení',
  perex: 'Jak si poslechnout hotový spot, zapsat k času, co je potřeba upravit, a zakázku schválit.',
  kategorie: 'Projekty',
  poradi: 21,
  proRole: ['CLIENT'],
  proDruhy: ['AD'],
  obsah: `Hotový spot si poslechnete přímo v prohlížeči — nic se nestahuje ani neinstaluje. Připomínky se píšou **k času v nahrávce**, takže u nás nikdo nehádá, o které místo jde.

# Kde to začíná

- **Odkazem z e-mailu**, který vám pošleme. Funguje **bez přihlašování**, takže ho můžete poslat dál kolegovi.
- Nebo ve svém portálu v **Projektech** a ve složce s nahrávkami u tlačítka **Připomínkovat**.

![Co uvidíte z odkazu: hlavička Připomínkování spotu, pruh Je zakázka v pořádku? s tlačítkem Schválit, vlna spotu a sloupec připomínek](/navody/reklamy-3.png)

Vlevo je **vlna spotu** (u videa je nahoře náhled a pod ním zvuková stopa), vpravo se píšou připomínky. Když je ve složce spotů víc — třeba česká a slovenská verze — přepínají se nad taggerem a **připomínky patří vždycky k tomu otevřenému**.

# Zápis připomínky

![Sloupec připomínek: Nová připomínka s časem, pole na text, tlačítko Zapsat k času a seznam se stavem „zatím neodesláno"](/navody/reklamy-2.png)

1. Pusťte si spot a v místě, kde něco drhne, dejte **Označit místo**. Přehrávání se zastaví, aby vám čas neutekl, než větu vymyslíte.
2. Napište, co je potřeba upravit.
3. **Zapsat k času** připomínku uloží.

Zapsaná připomínka se uloží hned — když okno zavřete, nic se neztratí. V křivce se ukáže jako **červená čárka** a kliknutím na čas u připomínky se spot přehraje přesně od toho místa. Dokud je připomínka neodeslaná, jde ji **smazat**.

# Odeslání

**Připomínky k nám odejdou až tlačítkem „Odeslat připomínky".** Do té doby je máte jen u sebe a svítí u nich „zatím neodesláno". Je to schválně: projdete si celý spot, nasbíráte všechno, co je potřeba, a pošlete to najednou.

Poslat jich můžete i víc dávek — kdykoliv přibude další, zase ji odešlete.

# Schválení

Až je spot v pořádku, dejte **Schválit**. Tlačítko najdete v e-mailu, ve složce s nahrávkami, v taggeru i ve svém portálu v přehledu projektů — všude je to totéž a schvaluje se **celá zakázka**, ne jedna nahrávka.

Portál se pro jistotu zeptá podruhé („Opravdu schválit? Klepněte znovu") — a pak už to **zpátky vzít nejde**: zakázka u nás jde k fakturaci.

Když je ještě co upravit, neschvalujte — napište to do připomínek nebo do **Dotazů** u projektu.`,
};
