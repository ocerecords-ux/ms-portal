/**
 * WIKIPEDIE - společné věci pro server i prohlížeč (zadání 22. 9. 2026).
 * Viz lib/wikipedieServer.ts.
 */

export const JAZYKY_WIKI = ['cs', 'en', 'sk'] as const;
export type JazykWiki = (typeof JAZYKY_WIKI)[number];

export function jeJazykWiki(j: string): j is JazykWiki {
  return (JAZYKY_WIKI as readonly string[]).includes(j);
}

export function adresaWiki(jazyk: string, nazev: string, parametry?: Record<string, string>): string {
  const cesta = encodeURIComponent(nazev.trim().replace(/ /g, '_')).replace(/%2F/g, '/');
  const q = parametry ? `?${new URLSearchParams(parametry).toString()}` : '';
  return `https://${jazyk}.wikipedia.org/wiki/${cesta}${q}`;
}

/** Pískoviště přihlášeného wikipedisty - tam se nový článek připravuje. */
export function adresaPiskoviste(jazyk: string): string {
  const stranka = jazyk === 'en' ? 'Special:MyPage/sandbox' : jazyk === 'sk' ? 'Special:MyPage/Pieskovisko' : 'Special:MyPage/Pískoviště';
  return adresaWiki(jazyk, stranka, { action: 'edit' });
}

/** Registrace osobního tokenu (OAuth „owner-only") - vyřizuje se hned. */
export const ADRESA_OAUTH = 'https://meta.wikimedia.org/wiki/Special:OAuthConsumerRegistration/propose/oauth2';

export function adresaRegistrace(jazyk: string): string {
  return adresaWiki(jazyk, 'Special:CreateAccount');
}

/** Stránky s pravidly, které se u článku o sobě vyplatí znát. */
export function pravidlaWiki(jazyk: string): { nazev: string; url: string }[] {
  if (jazyk === 'en') {
    return [
      { nazev: 'Conflict of interest', url: adresaWiki('en', 'Wikipedia:Conflict_of_interest') },
      { nazev: 'Notability (people)', url: adresaWiki('en', 'Wikipedia:Notability_(people)') },
      { nazev: 'Articles for creation', url: adresaWiki('en', 'Wikipedia:Articles_for_creation') },
    ];
  }
  return [
    { nazev: 'Střet zájmů', url: adresaWiki('cs', 'Wikipedie:Střet_zájmů') },
    { nazev: 'Encyklopedická významnost osob', url: adresaWiki('cs', 'Wikipedie:Encyklopedická_významnost_osob') },
    { nazev: 'Ověřitelnost', url: adresaWiki('cs', 'Wikipedie:Ověřitelnost') },
  ];
}

/** Počáteční koncept - kostra s poli k doplnění, nic nevymyšleného. */
export function vychoziKoncept(jmeno: string): { nazev: string; wikitext: string } {
  const j = jmeno.trim() || 'Jméno Příjmení';
  return {
    nazev: j,
    wikitext: `{{Infobox - osoba
| jméno = ${j}
| obrázek =
| datum narození = <!-- {{datum narození a věk|RRRR|M|D}} -->
| místo narození =
| povolání = režisér audioknih, zvukový režisér
| známý díky =
}}
'''${j}''' (* <!-- datum a místo narození -->) je český režisér audioknih a zvukový režisér ze studia Mediaspace.<ref name="youradio" />

== Život ==
<!-- Vzdělání, začátky, důležité milníky. Každé tvrzení s nezávislým zdrojem. -->

== Tvorba ==
<!-- Nejvýznamnější audioknihy a projekty, spolupráce, ocenění. -->

=== Výběr z audioknih ===
* <!-- Název (rok, vydavatel) -->

== Odkazy ==
=== Reference ===
<references>
<ref name="youradio">{{Citace elektronického periodika
| titul = Audiokniha může stát i čtvrt milionu, AI ji zatím neumí, říká Palkovská ze spol. Audioteka a režisér Černý z Mediaspace
| periodikum = Youradio Talk
| url = https://talk.youradio.cz/porady/klub-psacu/audiokniha-muze-stat-i-ctvrt-milionu-ai-ji-zatim-neumi-rika-palkovska-ze-spol-audioteka-a-reziser-cerny-z-mediaspace
| datum přístupu = ${new Date().toISOString().slice(0, 10)}
}}</ref>
</references>

=== Externí odkazy ===
* [https://www.mediaspace.cz Mediaspace]

{{Autoritní data}}
{{Portály|Lidé}}

[[Kategorie:Čeští režiséři]]
`,
  };
}
