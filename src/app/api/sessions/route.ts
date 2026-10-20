import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import StudySession from '@/models/StudySession';
import User from '@/models/User';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  try {
    const user = await User.findOne({ email: session.user.email }).select('_id').lean();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const examId = searchParams.get('examId');
    const date = searchParams.get('date'); // format: YYYY-MM-DD or "today"

    let query: any = { user: user._id };
    if (examId) {
      query.exam = examId;
    }

    if (date) {
      let start: Date;
      let end: Date;
      if (date === 'today') {
        const now = new Date();
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const [year, month, day] = date.split('-').map(Number);
        const localStart = new Date(year, month - 1, day, 0, 0, 0, 0);
        const localEnd = new Date(year, month - 1, day, 23, 59, 59, 999);
        const utcStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        const utcEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
        start = new Date(Math.min(localStart.getTime(), utcStart.getTime()));
        end = new Date(Math.max(localEnd.getTime(), utcEnd.getTime()));
      } else {
        const targetDate = new Date(date);
        start = new Date(targetDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(targetDate);
        end.setHours(23, 59, 59, 999);
      }
      query.startTime = { $gte: start, $lte: end };
    }

    let rawSessions = await StudySession.find(query).populate('exam').sort({ startTime: 1 }).lean();

    // Deduplicate sessions in memory by exam + startTime + title
    const seenSessionKeys = new Set<string>();
    const sessions = rawSessions.filter(session => {
      const examId = session.exam?._id ? session.exam._id.toString() : session.exam?.toString() || '';
      const key = `${examId}-${new Date(session.startTime).toISOString()}-${(session as any).shortTitle || session.title}`;
      if (seenSessionKeys.has(key)) {
        return false;
      }
      seenSessionKeys.add(key);
      return true;
    });

    return NextResponse.json({ data: sessions }, { status: 200 });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json({ error: 'Error fetching sessions' }, { status: 500 });
  }
}

