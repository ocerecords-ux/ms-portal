import { SetPasswordForm } from './SetPasswordForm';
import { nactiJazyk } from '@/lib/jazykServer';

// Verejna stranka z odkazu v pozvance (zadani 5. 9. 2026) - token se cte tady
// na serveru ze searchParams, aby klientsky formular nemusel resit Suspense
// kolem useSearchParams.
export const dynamic = 'force-dynamic';

export default function SetPasswordPage({ searchParams }: { searchParams: { token?: string } }) {
  // Jazyk PROPEM: (auth) stoji mimo portalovy layout, takze JazykProvider
  // nema kdo nasadit (pravidlo 8). Volba je v cookie od prepinace na
  // prihlaseni.
  return <SetPasswordForm token={searchParams?.token ?? ''} jazyk={nactiJazyk()} />;
}
