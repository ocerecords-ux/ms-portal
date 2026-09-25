/**
 * REZERVACE STUDIA - SPRÁVA. Zůstává jen adresa; celá obsluha se 25. 9. 2026
 * přestěhovala do /api/studio/sprava, protože o rezervacích pobočky
 * rozhoduje i její vedoucí („k té editaci by měl mít přístup i Matěj Černý")
 * a všechno pod /api/admin je vyhrazené Žůžo-labůžo.
 *
 * Práva se tím nerozvolnila: /api/studio/sprava si u každé akce ověřuje, že
 * ten člověk dané studio spravuje (lib/spravaKalendare.ts).
 */
export { PATCH, POST, DELETE, dynamic } from '@/app/api/studio/sprava/route';
