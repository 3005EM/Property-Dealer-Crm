import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (!session) redirect('/login');

// After
const role = (session?.user as { role?: string } | undefined)?.role;
  if (role === 'admin') redirect('/dashboard');
  else redirect('/leads');
}
