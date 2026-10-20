import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import LandingPage from '@/components/landing/LandingPage';

export const metadata = {
  title: 'Trumley • The Intelligent AI Exam Planner & Study Engine',
  description: 'Automate your exam schedule with intelligent waterfill algorithms and a personal AI coach. Turn dense syllabi into calm daily progress.',
};

export default async function Home({
  searchParams,
}: {
  searchParams?: { preview?: string };
}) {
  const session = await getServerSession();
  if (session?.user && !searchParams?.preview) {
    redirect('/today');
  }

  return <LandingPage />;
}
