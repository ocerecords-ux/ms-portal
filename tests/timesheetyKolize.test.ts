import { describe, expect, it } from 'vitest';
import { casHHMM, hlaskaOKolizi, prekryvaSe, stejnyProjekt } from '../src/lib/timesheetyKolize';

describe('prekryvaSe', () => {
  it('překryv aspoň o minutu', () => {
    expect(prekryvaSe(540, 720, 600, 780)).toBe(true); // 9-12 vs 10-13
    expect(prekryvaSe(540, 720, 500, 560)).toBe(true); // 8:20-9:20 zasahuje
    expect(prekryvaSe(540, 720, 540, 720)).toBe(true); // stejný čas
    expect(prekryvaSe(540, 720, 600, 660)).toBe(true); // celý uvnitř
  });

  it('dotyk konců není překryv', () => {
    expect(prekryvaSe(540, 720, 720, 780)).toBe(false); // 9-12 a 12-13
    expect(prekryvaSe(720, 780, 540, 720)).toBe(false);
  });

  it('úplně mimo', () => {
    expect(prekryvaSe(540, 600, 700, 760)).toBe(false);
  });
});

describe('stejnyProjekt', () => {
  const s = (id: string | null, name: string | null) => ({ caflouProjectId: id, projectName: name });

  it('rozhoduje id projektu', () => {
    expect(stejnyProjekt(s('p1', 'Kubánské tango'), s('p1', 'Jiný název'))).toBe(true);
    expect(stejnyProjekt(s('p1', 'Kubánské tango'), s('p2', 'Kubánské tango'))).toBe(false);
  });

  it('bez id se porovná název, bez ohledu na velikost písmen', () => {
    expect(stejnyProjekt(s(null, 'Kubánské tango'), s(null, 'kubánské TANGO '))).toBe(true);
    expect(stejnyProjekt(s(null, 'Kubánské tango'), s(null, 'Něco jiného'))).toBe(false);
  });

  it('dvě práce bez projektu patří k sobě', () => {
    expect(stejnyProjekt(s(null, null), s(null, null))).toBe(true);
  });

  it('práce bez projektu se nebije s projektem', () => {
    expect(stejnyProjekt(s(null, null), s('p1', 'Kubánské tango'))).toBe(false);
  });
});

describe('casHHMM', () => {
  it('minuty od půlnoci na čas', () => {
    expect(casHHMM(0)).toBe('00:00');
    expect(casHHMM(540)).toBe('09:00');
    expect(casHHMM(725)).toBe('12:05');
  });
});

describe('hlaskaOKolizi', () => {
  it('s projektem ho jmenuje', () => {
    expect(hlaskaOKolizi({ od: 540, do: 720, projectName: 'Kubánské tango' })).toContain(
      'Kubánské tango',
    );
    expect(hlaskaOKolizi({ od: 540, do: 720, projectName: 'Kubánské tango' })).toContain('09:00–12:00');
  });

  it('bez projektu mluví jen o čase', () => {
    const h = hlaskaOKolizi({ od: 540, do: 720, projectName: null });
    expect(h).toContain('09:00–12:00');
    expect(h).not.toContain('projektu');
  });
});
