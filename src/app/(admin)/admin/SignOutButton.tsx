'use client';

import { signOut } from 'next-auth/react';

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="text-white/70 text-sm font-heading hover:text-white"
    >
      Odhlásit se
    </button>
  );
}
