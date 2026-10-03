import { ForgotPasswordForm } from './ForgotPasswordForm';
import { nactiJazyk } from '@/lib/jazykServer';

export const dynamic = 'force-dynamic';

export default function ForgotPasswordPage() {
  // Jazyk PROPEM - viz nastaveni-hesla/page.tsx (pravidlo 8).
  return <ForgotPasswordForm jazyk={nactiJazyk()} />;
}
