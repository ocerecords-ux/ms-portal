import { describe, expect, it } from 'vitest';
import { splitChatBody, splitMentions } from '../src/lib/chat';
import { MS_SMAJLICI, najdiSmajlika } from '../src/lib/msSmajlici';

// Testy rozdelovani textu zpravy v MS chatu - zminky (@Jmeno) a Mediaspace
// smajlici (zadani 9. 9. 2026). Bez databaze, ciste funkce.

const JMENA = ['Ondřej Černý', 'Jan', 'Jan Novák'];

describe('sada smajliku', () => {
  it('kody jsou unikatni a odpovidaji tvaru :ms-...:', () => {
    const kody = MS_SMAJLICI.map((s) => s.code);
    expect(new Set(kody).size).toBe(kody.length);
    for (const kod of kody) expect(kod).toMatch(/^:ms-[a-z-]+:$/);
  });

  it('kazdy ma popisek a kresbu', () => {
    for (const s of MS_SMAJLICI) {
      expect(s.label.trim().length).toBeGreaterThan(0);
      expect(s.svg).toContain('<circle');
      expect(s.svg).not.toContain('<script');
    }
  });

  it('drzi se barev portalu', () => {
    for (const s of MS_SMAJLICI) {
      expect(s.svg).toMatch(/#1FDF67|#7B55FF/);
    }
  });

  it('najdiSmajlika vrati jen znamou zkratku', () => {
    expect(najdiSmajlika(':ms-usmev:')?.label).toBe('Úsměv');
    expect(najdiSmajlika(':ms-neexistuje:')).toBeUndefined();
  });
});

describe('rozdeleni tela zpravy', () => {
  it('obycejny text zustane jednim kouskem', () => {
    expect(splitChatBody('Ahoj, jak to jde?', JMENA)).toEqual([
      { kind: 'text', value: 'Ahoj, jak to jde?' },
    ]);
  });

  it('pozna smajlika uprostred vety', () => {
    expect(splitChatBody('Hotovo :ms-palec: díky', JMENA)).toEqual([
      { kind: 'text', value: 'Hotovo ' },
      { kind: 'smajlik', value: ':ms-palec:' },
      { kind: 'text', value: ' díky' },
    ]);
  });

  it('zvladne smajlika i zminku naraz', () => {
    expect(splitChatBody('@Jan Novák super :ms-super:', JMENA)).toEqual([
      { kind: 'mention', value: '@Jan Novák' },
      { kind: 'text', value: ' super ' },
      { kind: 'smajlik', value: ':ms-super:' },
    ]);
  });

  it('neznama zkratka zustane textem, ne prazdnem', () => {
    expect(splitChatBody('co :ms-tohle-neexistuje: ?', JMENA)).toEqual([
      { kind: 'text', value: 'co ' },
      { kind: 'text', value: ':ms-tohle-neexistuje:' },
      { kind: 'text', value: ' ?' },
    ]);
  });

  it('dva smajlici za sebou se nespoji', () => {
    const casti = splitChatBody(':ms-palec::ms-ohen:', JMENA);
    expect(casti).toEqual([
      { kind: 'smajlik', value: ':ms-palec:' },
      { kind: 'smajlik', value: ':ms-ohen:' },
    ]);
  });

  it('opakovane volani dava stejny vysledek (globalni regex nedrzi pozici)', () => {
    const text = 'a :ms-srdce: b';
    expect(splitChatBody(text, JMENA)).toEqual(splitChatBody(text, JMENA));
  });

  it('zminky se chovaji jako driv', () => {
    expect(splitMentions('@Jan Novák ahoj', JMENA)).toEqual([
      { text: '@Jan Novák', mention: true },
      { text: ' ahoj', mention: false },
    ]);
  });
});
