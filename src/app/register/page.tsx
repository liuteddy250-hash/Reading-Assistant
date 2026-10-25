import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/AuthForm';
import { authMode, getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (authMode() === 'single') redirect('/library');
  const session = await getSession();
  if (session) redirect('/library');

  const { next } = await searchParams;
  const nextPath = next && next.startsWith('/') && !next.startsWith('//') ? next : '/library';

  return (
    <div className="auth-wrap">
      <AuthForm mode="register" nextPath={nextPath} />
    </div>
  );
}
