import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '@/lib/db';
import StudySession from '@/models/StudySession';
import User from '@/models/User';

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  try {
    const user = await User.findOne({ email: session.user.email });
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
      const targetDate = date === 'today' ? new Date() : new Date(date);
      const start = new Date(targetDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(targetDate);
      end.setHours(23, 59, 59, 999);
      query.startTime = { $gte: start, $lte: end };
    }

    let sessions = await StudySession.find(query).populate('exam').sort({ startTime: 1 });

    if (sessions.length === 0) {
      const Exam = (await import('@/models/Exam')).default;
      const activeExams = await Exam.find({ user: user._id, isCompleted: { $ne: true } });
      if (activeExams.length > 0) {
        console.log(`Auto-healing: Regenerating schedule for user ${user._id} because an active exam has 0 sessions`);
        const { regenerateSchedule } = await import('@/lib/scheduling/regenerateSchedule');
        await regenerateSchedule(user, {}, undefined, 'allowOverload');
        sessions = await StudySession.find(query).populate('exam').sort({ startTime: 1 });
      }
    }

    return NextResponse.json({ data: sessions }, { status: 200 });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json({ error: 'Error fetching sessions' }, { status: 500 });
  }
}

