import { SetPasswordForm } from './SetPasswordForm';

// Verejna stranka z odkazu v pozvance (zadani 5. 9. 2026) - token se cte tady
// na serveru ze searchParams, aby klientsky formular nemusel resit Suspense
// kolem useSearchParams.
export const dynamic = 'force-dynamic';

export default function SetPasswordPage({ searchParams }: { searchParams: { token?: string } }) {
  return <SetPasswordForm token={searchParams?.token ?? ''} />;
}
