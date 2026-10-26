import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import LandingPage from '@/components/landing/LandingPage';

export const metadata = {
  title: 'Trumley • The Intelligent AI Exam Planner & Study Engine',
  description: 'Automate your exam schedule with intelligent waterfill algorithms and a personal AI coach. Turn dense syllabi into calm daily progress.',
};

export default async function Home(props: {
  searchParams?: Promise<{ preview?: string }>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  
  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch (err) {
    console.error('Failed to get session on landing page:', err);
  }

  if (session?.user && !searchParams?.preview) {
    redirect('/today');
  }

  return <LandingPage />;
}
