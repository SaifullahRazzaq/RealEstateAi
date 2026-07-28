import { redirect } from 'next/navigation';

/**
 * Landing route. `proxy.ts` owns the logged-in/logged-out decision, so this
 * always points at the login page and gets bounced straight to /dashboard when
 * a valid token cookie is present.
 */
export default function HomePage() {
  redirect('/auth/login');
}
