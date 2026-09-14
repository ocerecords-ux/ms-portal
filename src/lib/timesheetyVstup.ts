import { z } from 'zod';
import { durationMinutes, parseTime, requiresProject } from '@/lib/timesheets';

/**
 * Kontrola vstupu vykazu - spolecna pro zalozeni (POST /api/timesheets)
 * i pro upravu (PATCH /api/timesheets/[id], zadani 14. 9. 2026: "A melo by
 * jit upravit vykazy").
 *
 * Zamerne je to mimo obe routy: kdyby si kazda hlidala vlastni pravidla,
 * dala by se pres upravu ulozit hodnota, kterou by zalozeni neproslo.
 *
 * Datum, cas od-do, druh prace a projekt jsou povinne (zadani 6. 9. 2026:
 * "čas, druh práce a projekt by měly být povinné údaje"). Projekt se
 * nevyzaduje u druhu prace "Ostatni" (zadani 8. 9. 2026) - tam se ve
 * formulari vubec nevybira.
 */
export const schemaVykazu = z
  .object({
    date: z.string().trim().min(8, 'Vyberte datum.'),
    from: z.string().trim().min(1, 'Vyplňte čas od.'),
    to: z.string().trim().min(1, 'Vyplňte čas do.'),
    workType: z.enum(['RECORDING', 'EDITING', 'OTHER'], {
      errorMap: () => ({ message: 'Vyberte druh práce.' }),
    }),
    caflouProjectId: z.string().trim().optional(),
    projectName: z.string().trim().optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((v) => !requiresProject(v.workType) || Boolean(v.projectName), {
    message: 'Vyberte projekt.',
    path: ['projectName'],
  });

export type VstupVykazu = z.infer<typeof schemaVykazu>;

export type PolozkyVykazu = {
  date: Date;
  startMinutes: number;
  endMinutes: number;
  workType: VstupVykazu['workType'];
  caflouProjectId: string | null;
  projectName: string | null;
  note: string | null;
};

/**
 * Z overenych dat udela hodnoty pro databazi, nebo vrati hlasku pro uzivatele.
 * Stejne meze jako driv primo v POST route - vcetne "delsi nez 16 hodin
 * vypada jako preklep".
 */
export function polozkyVykazu(data: VstupVykazu): { ok: true; data: PolozkyVykazu } | { ok: false; chyba: string } {
  const startMinutes = parseTime(data.from);
  const endMinutes = parseTime(data.to);
  if (startMinutes === null || endMinutes === null) {
    return { ok: false, chyba: 'Čas zadejte ve tvaru HH:MM.' };
  }
  if (startMinutes === endMinutes) {
    return { ok: false, chyba: 'Začátek a konec nemůžou být stejné.' };
  }
  if (durationMinutes(startMinutes, endMinutes) > 16 * 60) {
    return { ok: false, chyba: 'Výkaz delší než 16 hodin vypadá jako překlep.' };
  }

  const date = new Date(`${data.date}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, chyba: 'Neplatné datum.' };
  }

  const sProjektem = requiresProject(data.workType);
  return {
    ok: true,
    data: {
      date,
      startMinutes,
      endMinutes,
      workType: data.workType,
      caflouProjectId: sProjektem ? data.caflouProjectId || null : null,
      projectName: sProjektem ? data.projectName || null : null,
      note: data.note || null,
    },
  };
}
