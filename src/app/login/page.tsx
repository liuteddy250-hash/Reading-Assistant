import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/AuthForm';
import { authMode, getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function safeNext(value: string | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/library';
  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (authMode() === 'single') redirect('/library');
  const session = await getSession();
  if (session) redirect('/library');

  const { next } = await searchParams;
  return (
    <div className="auth-wrap">
      <AuthForm mode="login" nextPath={safeNext(next)} />
    </div>
  );
}
