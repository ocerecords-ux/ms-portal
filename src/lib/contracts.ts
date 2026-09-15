/**
 * Smlouvy s elektronickým podpisem (zadani 8. 9. 2026: "chtel bych udelat
 * vlastni podepisovani smluv, jak to ma treba Signi. Ale bez kodu
 * potvrzovacich.").
 *
 * Tenhle soubor je BEZ Prismy — používá ho i prohlížeč. Serverová část
 * (číslo smlouvy, otisk textu, výchozí šablony do databáze) je
 * v `contractsServer.ts`.
 *
 * Jak to funguje bez ověřovacích kódů: odkaz k podpisu je jednorázový token
 * poslaný na e-mail podepisujícího — stejný princip, jaký už používají
 * nabídky. Ke každému podpisu se ukládá doložka (čas, IP, prohlížeč) a otisk
 * textu, který měl člověk před sebou. Podle eIDAS je to prostý elektronický
 * podpis: pro herecké a klientské smlouvy běžná praxe.
 */

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rozpracovaná',
  SENT: 'Čeká na podpis',
  SIGNED: 'Podepsaná',
  REJECTED: 'Odmítnutá',
  CANCELLED: 'Zrušená',
};

export const CONTRACT_STATUS_CLASSES: Record<string, string> = {
  DRAFT: 'bg-field text-muted',
  SENT: 'bg-tint text-brand-purpleDark',
  SIGNED: 'bg-okTint text-status-done',
  REJECTED: 'bg-dangerTint text-danger',
  CANCELLED: 'bg-dangerTint text-danger',
};

/**
 * Pole, která se v šabloně doplní. Vypisují se u editoru šablony.
 *
 * `rucne: true` je pole, které portál NEZNÁ - při založení smlouvy se místo
 * něj doplní „…" a člověk ho dopíše přímo ve smlouvě. Je to schválně: odměna
 * ani termín nejsou nikde v systému a hádat je by bylo horší než prázdné
 * místo, které je na první pohled vidět.
 */
export const CONTRACT_PLACEHOLDERS: { key: string; label: string; rucne?: boolean; datum?: boolean }[] = [
  { key: 'cislo_smlouvy', label: 'Číslo smlouvy' },
  { key: 'nase_firma', label: 'Naše firma (název)' },
  { key: 'nase_ic', label: 'Naše IČ' },
  { key: 'nase_dic', label: 'Naše DIČ' },
  { key: 'nase_adresa', label: 'Naše adresa' },
  { key: 'nas_email', label: 'Náš e-mail (účtárna)' },
  { key: 'protistrana', label: 'Protistrana (jméno nebo firma)' },
  { key: 'protistrana_ic', label: 'IČ protistrany' },
  { key: 'protistrana_dic', label: 'DIČ protistrany' },
  { key: 'protistrana_adresa', label: 'Adresa protistrany' },
  { key: 'protistrana_identifikace', label: 'RČ nebo IČ protistrany' },
  { key: 'podepisujici', label: 'Jméno podepisujícího' },
  { key: 'email', label: 'E-mail podepisujícího' },
  { key: 'projekt', label: 'Název projektu' },
  // Misto nataceni podle lokace herce (zadani 15. 9. 2026) - portal ho zna,
  // neni proc se na nej ptat.
  { key: 'misto', label: 'Místo natáčení (z lokace herce)' },
  { key: 'nazev_dila', label: 'Název díla (z projektu)' },
  { key: 'datum', label: 'Dnešní datum' },
  { key: 'odmena', label: 'Odměna / cena', rucne: true },
  // Datum se vybira z kalendare, nepise se (zadani 15. 9. 2026: „pole datum
  // se musi dat vybrat hodnota z kalendare. Opet skrz cely portal").
  { key: 'termin', label: 'Termín předání / natáčení', rucne: true, datum: true },
  { key: 'splatnost', label: 'Splatnost ve dnech', rucne: true },
  { key: 'rozsah_dila', label: 'Rozsah díla (co se dělá)', rucne: true },
  { key: 'uziti', label: 'Účel a území užití (reklama)', rucne: true },
  { key: 'doba_licence', label: 'Doba licence (reklama)', rucne: true },
];

/**
 * MÍSTO NATÁČENÍ (zadání 15. 9. 2026: „to místo by měla být proměnná a měla
 * by odpovídat tomu, co má herec zaškrtnuto v lokaci. V případě, že nebude mít
 * nic, tak bych tam jako pojistku Brno. Ať tam alespoň něco je.").
 *
 * Z lokace „MS Studio - Brno II" zůstane do smlouvy jen město: do textu patří
 * „Nahrávací studio MEDIA SPACE, Brno", ne interní název studia s číslem.
 * Když má herec zaškrtnutých víc měst, bere se první - smlouva mluví o jednom
 * místě a vypsat tři by z ní udělalo hádanku.
 */
export function mistoNataceni(lokace: string[] | null | undefined): string {
  // Od 15. 9. 2026 jsou lokace rovnou mesta („Brno"), starsi zapisy ale porad
  // muzou byt „MS Studio - Brno II" - proto se predpona i cislo mistnosti
  // nize jeste odstranuji.
  const prvni = (lokace ?? []).map((l) => l.trim()).filter(Boolean)[0];
  if (!prvni) return 'Brno';
  const mesto = prvni
    .replace(/^MS\s*Studio\s*[-–]\s*/i, '')
    .replace(/\s+(I{1,3}|IV|V|VI{0,3})$/i, '')
    .trim();
  return mesto || 'Brno';
}

/**
 * ČÁSTKA DO SMLOUVY (zadání 15. 9. 2026: „ten formát ceny je takový škaredý.
 * U cen by měla být měna Kč").
 *
 * Z „30000" udělá „30 000 Kč". Co už měnu nebo jiný tvar má (třeba „5 000 Kč
 * za natáčecí den" nebo „1 200 EUR"), se nechává být - do textu smlouvy si
 * člověk může napsat cokoliv a portál mu to nemá přepisovat.
 *
 * Mezery jsou OBYČEJNÉ, ne pevné: pevná mezera není v podmnožině písma, se
 * kterou se sází PDF, a vyšel by z ní otazník.
 */
export function castkaDoSmlouvy(text: string): string {
  const cistý = text.trim();
  if (!cistý) return cistý;
  // Jen holé číslo (klidně s mezerami nebo desetinnou čárkou) - nic jiného.
  if (!/^\d[\d\s\u00a0]*([.,]\d{1,2})?$/.test(cistý)) return cistý;
  const cislo = Number(cistý.replace(/[\s\u00a0]/g, '').replace(',', '.'));
  if (!Number.isFinite(cislo)) return cistý;
  const zaokrouhlene = Number.isInteger(cislo)
    ? cislo.toLocaleString('cs-CZ')
    : cislo.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${zaokrouhlene.replace(/\u00a0/g, ' ')} Kč`;
}

/**
 * Doplní {{pole}} v šabloně. Co neznáme, necháme jako `…` — ať je při čtení
 * hned vidět, co se má doplnit ručně, místo prázdného místa.
 */
export function expandPlaceholders(body: string, values: Record<string, string | null | undefined>): string {
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_full, key: string) => {
    const value = values[key.toLowerCase()];
    return value != null && String(value).trim() !== '' ? String(value) : '…';
  });
}

/**
 * POPISKY U PODPISŮ (zadání 15. 9. 2026: „tady musí být za MEDIA SPACE s.r.o.
 * a za interpreta"). Naše strana se jmenuje přesně tak, jak je firma zapsaná;
 * druhá podle toho, jak jí říká samotná smlouva - u audioknihy Interpret,
 * u smlouvy o dílo Zhotovitel, jinak obecně protistrana.
 */
export function popisekNaseStrany(issuerName?: string | null): string {
  return `Za ${issuerName?.trim() || 'Mediaspace'}`;
}

export function popisekDruheStrany(body: string): string {
  if (/\bInterpret/.test(body)) return 'Za interpreta';
  if (/\bUmělec/.test(body)) return 'Za umělce';
  if (/\bZhotovitel/.test(body)) return 'Za zhotovitele';
  return 'Za protistranu';
}

/** Kolik podpisů smlouva potřebuje: obě strany. */
export const REQUIRED_SIGNERS = ['MEDIASPACE', 'PROTISTRANA'] as const;

export function formatSignedAt(iso: string | Date | null): string {
  if (!iso) return '';
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Výchozí šablony. Nasypou se do databáze při prvním otevření sekce a dál si
 * je admin upravuje sám — nejsou zadrátované v kódu.
 *
 * Texty jsou přepsané z reálných smluv, které Mediaspace používá
 * (20250010 audiokniha, 20260032 reklama, 20260088 smlouva o dílo).
 * Všude, kde ve smlouvě stálo konkrétní jméno, částka nebo termín, je teď
 * {{proměnná}} — co portál zná, doplní se samo, zbytek se dopíše ve smlouvě.
 */
export const DEFAULT_CONTRACT_TEMPLATES: { name: string; body: string; sortOrder: number }[] = [
  {
    name: 'Smlouva - audioknihy',
    sortOrder: 10,
    body: `LICENČNÍ SMLOUVA S INTERPRETEM

číslo smlouvy: {{cislo_smlouvy}}

Účastníci smlouvy

Interpret:
**{{protistrana}}**, dále jen „Interpret"
Se sídlem: {{protistrana_adresa}}
{{protistrana_identifikace}}

Objednatel:
{{nase_firma}}
Se sídlem: {{nase_adresa}}
IČO: {{nase_ic}}    DIČ: {{nase_dic}}

I. Úvodní ustanovení

1. Interpret se zavazuje vytvořit umělecké dílo – provést umělecký výkon herce za účelem pořízení zvukového záznamu tohoto výkonu ve smyslu ustanovení §2 Autorského zákona, a to na objednávku společnosti {{nase_firma}}, a to převedením textu autorského díla do zvukové podoby (dále jen „Dílo").

2. Dílo vzniká pro projekt „{{projekt}}", pracovní název díla: {{nazev_dila}}.

3. Místo a čas provedení Díla: Nahrávací studio MEDIA SPACE, **{{misto}}**, **{{termin}}**.

4. Interpret prohlašuje, že bude jediným tvůrcem a autorem Díla a že tedy bude nositelem všech osobnostních a majetkových práv k Dílu, nezbytných pro zpřístupnění a další využití Díla společností {{nase_firma}} v rozsahu sjednaném níže v této smlouvě.

5. {{nase_firma}} prohlašuje, že důvodem pro vytvoření Díla dle této smlouvy je výroba audioknihy, v níž bude Dílo tvořit jednu z komponent finálního díla. Toto finální dílo bude mít podobu díla kolektivního ve smyslu §59 Autorského zákona, jehož jednotlivé komponenty nemají ve smyslu §59 odst. 1 Autorského zákona schopnost samostatného užití a jejichž smysl a význam pro společnost {{nase_firma}} spočívá právě v jejich vzájemném spojení.

6. Účelem této smlouvy je založení práva společnosti {{nase_firma}} užít Dílo zejména prostřednictvím třetí strany.

7. Smluvní strany tímto prohlašují, že jim není známa žádná faktická nebo právní překážka, která by jim v uzavření této smlouvy a k platnému poskytnutí níže uvedené licence ve sjednaném rozsahu bránila.

8. V případě, že se jakékoliv prohlášení kterékoliv smluvní strany, obsažené v tomto článku smlouvy, ukáže jako nepravdivé, nepřesné či neúplné a v této souvislosti vznikne druhé straně škoda nebo bude vůči ní uplatněn třetí stranou jakýkoliv nárok, zavazuje se strana, která toto prohlášení poskytla, vzniklou škodu nahradit a důvodně uplatněný nárok třetí stranou uspokojit.

II. Předmět smlouvy

1. Interpret tímto poskytuje společnosti {{nase_firma}} oprávnění k výkonu práva užít Dílo v audio podobě, a to všemi způsoby předvídanými Autorským zákonem v neomezeném rozsahu, a výslovně k rozmnožování a rozšiřování originálů nebo rozmnoženin Díla ve smyslu § 13 a § 14 Autorského zákona, jakož i k jeho sdělování veřejnosti ve smyslu §18 Autorského zákona, a to za podmínek sjednaných níže v tomto článku smlouvy (dále jen „Licence"). {{nase_firma}} se tímto zavazuje uhradit Interpretovi za poskytnutí Licence odměnu ve výši dle čl. III. této smlouvy.

2. Interpret tímto poskytuje společnosti {{nase_firma}} Licenci k použití Díla pro jeho zapracování do dalších komponent tvořících společně finální podobu audioknihy a za tímto účelem uděluje společnosti {{nase_firma}} právo Dílo technicky upravovat a měnit či spojovat s jinými díly a zařazovat do jiného díla, avšak s výhradou zachování nezměněného obsahu Díla.

3. {{nase_firma}} nabývá Licenci ke dni podpisu této smlouvy oběma smluvními stranami. {{nase_firma}} není povinna Licenci využít.

4. Interpret poskytuje společnosti {{nase_firma}} Licenci jakožto Licenci výhradní. S výhradním poskytnutím Licence souvisí závazek Interpreta neprovést další umělecký výkon herce za účelem pořízení zvukového záznamu ve formě převedení textu autorského díla specifikovaného v čl. I. odst. 1 této smlouvy ve prospěch třetího subjektu, a dále závazek nešířit Dílo, ani k tomuto neposkytnout licenci, ve prospěch žádného třetího subjektu odlišného od společnosti {{nase_firma}}. Smluvní strany dále sjednaly právo společnosti {{nase_firma}} kdykoliv vyzvat Interpreta k vytvoření uměleckého díla – provedení uměleckého výkonu herce za účelem pořízení zvukového záznamu volného pokračování či dalších modifikací Díla, jakož i volného pokračování či dalších modifikací samotné audioknihy. Tomuto právu odpovídá povinnost Interpreta této výzvě vyhovět a provést požadovaný umělecký výkon nejpozději do 2 měsíců ode dne obdržení této výzvy, a to za podmínek totožných jako v této smlouvě se zohledněním odlišného rozsahu. V případě mimořádné překážky znemožňující provedení výkonu ve sjednané lhůtě (nemoc, dlouhodobý pobyt mimo území ČR apod.) se Interpret zavazuje výkon provést bezodkladně po odpadnutí této překážky.

5. Územní rozsah licence není omezen.

6. S ohledem na podstatu Díla, jako jednotlivé komponenty kolektivního díla dle čl. I. této smlouvy, jež má pro společnost {{nase_firma}} hospodářský význam až po jeho zapracování do finální podoby elektronické audioknihy, není Licence omezena co do množství.

7. {{nase_firma}} je oprávněna postoupit licenci k Dílu, resp. k finální podobě audioknihy, za účelem jejího poslechu třetí osobě (dále jen „Koncový zákazník") nebo tuto postoupit odběrateli/distributorovi, který má své koncové zákazníky (dále jen „Odběratel") za účelem zpřístupnění díla svým zákazníkům (dále jen „Podlicence"). Smyslem udělení souhlasu s poskytnutím Podlicence je umožnit koncovému zákazníkovi či odběrateli získat přístup k Dílu, resp. k finální podobě audioknihy, prostřednictvím internetové a mobilní telefonické sítě bez jakéhokoliv územního omezení.

8. {{nase_firma}} je oprávněna pro účely propagace finální podoby audioknihy veřejně bezúplatně sdělovat část Díla nepřevyšující 10 % jeho celkové délky. Interpret k tomuto účelu poskytuje neomezenou a bezplatnou licenci.

9. Zánikem společnosti {{nase_firma}} přecházejí práva a povinnosti z této smlouvy na jejího právního nástupce.

10. Interpret dále výslovně svoluje s užitím jeho jména, resp. uměleckého jména a fotografie při šíření a užití Díla a finální podoby audioknihy, jakož i při dalších formách propagace, včetně reklamních a informačních materiálů.

11. Interpret prohlašuje, že společnosti {{nase_firma}} poskytne součinnost při propagaci a marketingových aktivitách vztahujících se k Dílu a finální podobě audioknihy.

12. Interpret se zavazuje poskytnout potřebnou součinnost při korekturách a konzultacích týkajících se tvorby Díla či jeho následného užití dle požadavků společnosti {{nase_firma}}.

13. Interpret se zavazuje při tvorbě Díla respektovat požadavky a pokyny smluvního zástupce společnosti {{nase_firma}} pro dohled nad tvorbou Díla a finální podoby elektronické audioknihy.

14. Interpret se zavazuje při tvorbě Díla dodržet stanovené časové a místní dispozice pro vytvoření uměleckého výkonu.

15. {{nase_firma}} posoudí zhotovené Dílo z hlediska splnění požadavků stanovených touto smlouvou, jakož i z hlediska jeho využitelnosti pro zamýšlené účely. V případě rozdílnosti názorů stran na kvalitu zhotoveného Díla dávají strany rozhodující hlas společnosti {{nase_firma}}, včetně výlučného práva posoudit využitelnost Díla, když jako subjekt rozhodující o užití Díla ve finální podobě určené na trh musí mít možnost konečného rozhodnutí. V případě rozhodnutí o nevyužitelnosti Díla požádá {{nase_firma}} Interpreta o jeho úpravu či o odstranění nedostatků. Neprovede-li Interpret úpravu ve stanovené lhůtě, resp. vůbec, je {{nase_firma}} oprávněna od této smlouvy odstoupit bez nároku Interpreta na sjednanou odměnu. V takovém případě nemá {{nase_firma}} právo Dílo ani jeho část dále využívat.

16. {{nase_firma}} je oprávněna na základě posouzení vývoje situace na trhu pozastavit vytváření Díla, resp. odstoupit od této smlouvy i v průběhu jeho vytváření; o takové skutečnosti se zavazuje Interpreta neprodleně informovat. V případě odstoupení se strany bezodkladně dohodnou na finančním vypořádání dosavadní činnosti, a to dle poměru dosud vytvořeného Díla a celkového rozsahu objednaného Díla.

III. Odměna

1. Strany si sjednaly odměnu za poskytnutí Licence dle této smlouvy ve výši **{{odmena}}** bez DPH. Tato odměna je konečnou, jednorázovou a paušálně stanovenou úplatou, pokrývající i všechny náklady spojené s tvorbou Díla (dále jen „Odměna").

2. Odměna není stanovena v závislosti na výnosech z využití licence.

3. Odměna bude Interpretovi uhrazena na základě daňového dokladu – faktury či platebního příkazu vystaveného Interpretem, a to ve splatnosti **{{splatnost}} dnů** od data uskutečnění zdanitelného plnění. Vystavenou fakturu zašlete na {{nas_email}}. Interpret prohlašuje, že z brutto honoráře si své daňové povinnosti vyplývající z tohoto příjmu vypořádá sám ve smyslu zákona č. 586/1992 Sb.

4. Strany se dohodly, že využití oprávnění daného Interpretem a jeho poskytnutí součinnosti dle čl. II. odst. 8, 10, 11 a 12 se sjednává jako bezplatné a Interpretovi z tohoto titulu nepřísluší žádná náhrada či odměna.

IV. Obchodní tajemství a opatření proti nelegálnímu šíření

1. Strany se zavazují podmínky této smlouvy udržovat v tajnosti.

2. {{nase_firma}} prohlašuje, že se bude v součinnosti s Interpretem zasazovat o zabránění nelegálního šíření zpřístupněného Díla.

V. Umělá inteligence

1. {{nase_firma}} nesmí použít ani nesmí umožnit třetí osobě použít hlas Interpreta, jeho umělecký výkon ani jakýkoli zvukový záznam pořízený na základě této smlouvy za účelem trénování, vývoje, testování nebo zlepšování jakékoli umělé inteligence, strojového učení, syntézy hlasu či obdobné technologie, ani za účelem vytvoření jakékoli syntetické, klonované, napodobené nebo počítačově generované verze hlasu či výkonu Interpreta bez předchozího písemného souhlasu Interpreta uděleného v každém jednotlivém případě.

VI. Doba trvání

1. Tato smlouva se uzavírá na dobu neurčitou, avšak může být ukončena kteroukoliv smluvní stranou formou písemné výpovědi s 3měsíční výpovědní lhůtou, nejdříve však po uplynutí 10 let, počínaje měsícem následujícím po měsíci, ve kterém bylo řádně zhotovené Dílo převzato.

2. Výpovědní lhůta počíná běžet prvním dnem kalendářního měsíce následujícího po měsíci, v němž byla písemná výpověď doručena druhé smluvní straně.

3. {{nase_firma}} se zavazuje okamžikem zániku Licence Dílo nadále neužívat s výjimkou výkonu jejího práva nadále spravovat Dílo již dříve zpřístupněné třetí osobě formou Podlicence, a to v datovém skladu umožňujícím třetí osobě i nadále přistupovat k zakoupenému Dílu za účelem poslechu.

VII. Závěrečná ustanovení

1. Úplnost smlouvy. Tato smlouva obsahuje úplné ujednání o předmětu smlouvy a všech náležitostech, které strany měly a chtěly ve smlouvě ujednat.

2. Úplnost informací. Strany prohlašují, že si vzájemně sdělily veškeré skutkové a právní okolnosti, které jim jsou známy ke dni uzavření této smlouvy.

3. Modifikovaná akceptace smlouvy. Strany vylučují použití ustanovení §1740 odst. 3 Občanského zákoníku.

4. Právo postoupení. {{nase_firma}} je oprávněna tuto smlouvu jako celek, jakož i jednotlivá práva z ní vzniklá, postoupit na třetí osobu i bez předchozího písemného souhlasu Interpreta.

5. Odstoupení. V případě prodlení Interpreta s dodáním řádně provedeného Díla o více než 14 dní oproti sjednanému termínu je {{nase_firma}} oprávněna od této smlouvy odstoupit.

6. Rozhodné právo. Tato smlouva se řídí právním řádem České republiky, zejména občanským zákoníkem a autorským zákonem.

7. Řešení sporů. Strany vynaloží veškeré úsilí k řešení sporů smírnou cestou; spory nevyřešené smírně budou předány k rozhodnutí věcně příslušnému soudu se sídlem v Ostravě.

8. Změna obsahu. Jakékoliv změny nebo dodatky k této smlouvě musí být učiněny pod sankcí neplatnosti písemnou formou.

9. Platnost a účinnost. Tato smlouva nabývá platnosti a účinnosti dnem jejího podpisu oběma stranami.

10. Prohlášení o porozumění textu smlouvy. Interpret svým podpisem potvrzuje, že se nepovažuje za slabší stranu, měl možnost seznámit se s textem smlouvy s dostatečným předstihem, jejímu obsahu rozumí a chce být smlouvou vázán.

11. Podpisy, prohlášení. Strany prohlašují, že tato smlouva vyjadřuje jejich pravou a svobodnou vůli, že nebyla uzavřena v tísni a že jsou oprávněny ji platně uzavřít a plnit.

Strany na důkaz souhlasu a porozumění se shora uvedeným připojují své podpisy níže. Smlouva se uzavírá elektronicky a obě strany ji podepisují prostým elektronickým podpisem v portálu.

V Brně dne {{datum}}`,
  },
  {
    name: 'Smlouva - reklamy',
    sortOrder: 20,
    body: `SMLOUVA O PROVEDENÍ UMĚLECKÉHO VÝKONU A SMLOUVA LICENČNÍ

číslo smlouvy: {{cislo_smlouvy}}

Účastníci smlouvy

Umělec:
**{{protistrana}}**, dále jen „Umělec"
Se sídlem: {{protistrana_adresa}}
{{protistrana_identifikace}}

Objednatel:
{{nase_firma}}
Se sídlem: {{nase_adresa}}
IČO: {{nase_ic}}    DIČ: {{nase_dic}}

1. PŘEDMĚT SMLOUVY

1.1 Umělec se zavazuje provést umělecký výkon, a to přednesením reklamního sdělení ve slovní podobě (textu reklamního spotu).

1.2 Umělec uděluje Společnosti výhradní oprávnění (výhradní licenci) užít umělecký výkon tak, že tento umělecký výkon zcela nebo zčásti zaznamená na zvukový záznam, a to samostatně nebo společně s jinými zvuky, a takto pořízený zvukový záznam bude užívat sdělováním veřejnosti prostřednictvím rozhlasového vysílání nebo jiným užitím záznamu a přenosem takového užití.

2. LICENCE

2.1 Společnost je oprávněna poskytnout licenci zcela nebo zčásti třetí osobě.

2.2 Smluvní strany sjednávají, že 50 % z dohodnuté celkové částky představuje odměnu za provedení uměleckého výkonu a 50 % z dohodnuté celkové částky představuje odměnu za poskytnutí licence.

2.3 Licence se sjednává na dobu {{doba_licence}} ode dne pořízení záznamu a výhradně pro užití ve zvukové reklamě určené pro {{uziti}}.

2.4 Licence se po uplynutí uvedené doby automaticky neobnovuje. Po uplynutí sjednané doby je Společnost povinna pro jakékoli další užití získat nový předchozí písemný souhlas Umělce.

2.5 V případě prodloužení licence na základě dohody stran vzniká Umělci nárok na dodatečnou odměnu ve výši 100 % původní licenční odměny za každé další sjednané licenční období, pokud se smluvní strany písemně nedohodnou jinak.

3. SMLUVNÍ ODMĚNA

3.1 Smluvní strany se dohodly, že odměna za umělecký výkon a poskytnutí licence činí: **{{odmena}}**.

3.2 Odměna bude uhrazena bankovním převodem na účet Umělce nejpozději do **{{splatnost}} dnů** ode dne vystavení příslušné faktury.

3.3 Sjednaná odměna podle této smlouvy je uvedena bez DPH. Je-li Umělec registrován k DPH v České republice a je-li podle právních předpisů povinen účtovat DPH za služby poskytované podle této smlouvy, připočte k příslušné faktuře DPH v platné sazbě.

3.4 Vystavenou fakturu je třeba zaslat na e-mail {{nas_email}}.

4. UMĚLECKÝ VÝKON

4.1 Pro účely této smlouvy bude umělecký výkon označen jako: {{nazev_dila}}.

4.2 Umělec se zavazuje provést umělecký výkon na profesionální úrovni, zejména tak, aby nesnižoval hodnotu výsledného uměleckého díla.

4.3 Termín pořízení záznamu: **{{termin}}**.

5. UMĚLÁ INTELIGENCE

5.1 Společnost nesmí použít ani nesmí umožnit třetí osobě použít hlas Umělce, jeho umělecký výkon ani jakýkoli zvukový záznam pořízený na základě této smlouvy za účelem trénování, vývoje, testování nebo zlepšování jakékoli umělé inteligence, strojového učení, syntézy hlasu či obdobné technologie ani za účelem vytvoření jakékoli syntetické, klonované, napodobené nebo počítačově generované verze hlasu či výkonu Umělce bez předchozího písemného souhlasu Umělce uděleného v každém jednotlivém případě.

6. ZÁVĚREČNÁ USTANOVENÍ

6.1 Tato smlouva se řídí právním řádem České republiky, zejména občanským zákoníkem a autorským zákonem.

6.2 Změny této smlouvy lze činit pouze písemně.

6.3 Smlouva se uzavírá elektronicky a obě strany ji podepisují prostým elektronickým podpisem v portálu.

V Brně dne {{datum}}`,
  },
  {
    name: 'Smlouva o dílo',
    sortOrder: 30,
    body: `SMLOUVA O DÍLO

číslo smlouvy: {{cislo_smlouvy}}

Účastníci smlouvy

Zhotovitel:
{{protistrana}}
Se sídlem: {{protistrana_adresa}}
{{protistrana_identifikace}}

Objednatel:
{{nase_firma}}
Se sídlem: {{nase_adresa}}
IČO: {{nase_ic}}    DIČ: {{nase_dic}}

I. Předmět smlouvy

1. Zhotovitel se zavazuje provést pro Objednatele dílo spočívající v: {{rozsah_dila}} (dále jen „Dílo").

2. Dílo se týká projektu „{{projekt}}", pracovní název díla: {{nazev_dila}}.

3. Zhotovitel provede Dílo osobně, s odbornou péčí a v souladu s pokyny Objednatele, pokud nejsou v rozporu s odbornými pravidly nebo právními předpisy.

II. Termín plnění

1. Zhotovitel se zavazuje předat Dílo nejpozději do **{{termin}}**.

2. Dílo bude předáno elektronicky ve formátu DOCX, PDF nebo jiném předem dohodnutém formátu.

III. Cena díla a platební podmínky

1. Smluvní strany sjednávají cenu za provedení Díla ve výši **{{odmena}}**.

2. Cena je konečná.

3. Objednatel uhradí cenu na základě této smlouvy po předání Díla se splatností **{{splatnost}} dnů**. Vystavenou fakturu zašlete na {{nas_email}}.

IV. Předání a převzetí díla

1. Dílo je provedeno jeho řádným dokončením a předáním Objednateli.

2. Objednatel je oprávněn do 10 pracovních dnů od převzetí oznámit Zhotoviteli vady nebo připomínky odpovídající sjednanému rozsahu Díla.

3. Neoznámí-li Objednatel vady ve stanovené lhůtě, považuje se Dílo za převzaté.

V. Autorská práva a licence

1. Smluvní strany berou na vědomí, že výsledky práce podle této smlouvy mohou představovat autorské dílo ve smyslu zákona č. 121/2000 Sb., autorský zákon.

2. Zhotovitel poskytuje Objednateli okamžikem úplného zaplacení ceny nevýhradní licenci k užití výsledků bez územního omezení a na dobu trvání majetkových autorských práv.

3. Objednatel je oprávněn výsledky zapracovat do výsledného díla, upravovat je, spojovat s jinými díly a užít výsledné dílo všemi známými způsoby užití.

4. Odměna za poskytnutí licence je zahrnuta v ceně Díla.

VI. Mlčenlivost

1. Zhotovitel se zavazuje zachovávat mlčenlivost o všech skutečnostech, které se dozví při plnění této smlouvy a které nejsou veřejně známé.

2. Povinnost mlčenlivosti trvá i po skončení této smlouvy.

VII. Odstoupení od smlouvy

1. Každá ze smluvních stran může od smlouvy odstoupit při podstatném porušení smlouvy druhou stranou.

2. Odstoupením nejsou dotčeny nároky na úhradu již provedených prací ani nároky na náhradu škody.

VIII. Závěrečná ustanovení

1. Tato smlouva nabývá účinnosti dnem podpisu oběma smluvními stranami.

2. Změny této smlouvy lze činit pouze písemnými dodatky podepsanými oběma smluvními stranami.

3. Práva a povinnosti touto smlouvou neupravené se řídí občanským zákoníkem a autorským zákonem.

4. Smlouva se uzavírá elektronicky a obě strany ji podepisují prostým elektronickým podpisem v portálu.

V Brně dne {{datum}}`,
  },
];
