import { redirect } from 'next/navigation';

// Sekce Doklady zacina Nabidkami - viz zalozky v layoutu.
export default function DokladyIndexPage() {
  redirect('/admin/doklady/nabidky');
}
