import { redirect } from 'next/navigation';

/**
 * Palubovka se přestěhovala mezi Přehledy (zadání 27. 9. 2026: „dej mi to do
 * přehledu na novou kartu").
 *
 * Adresa zůstává funkční - kdo si ji přidal do lišty nebo uložil do záložek
 * prohlížeče, skončí na správném místě místo na chybě. Obsah stránky žije
 * v /prehledy/palubovka, aby nebyl na dvou místech a nerozešel se.
 */
export default function StaraPalubovka() {
  redirect('/prehledy/palubovka');
}
