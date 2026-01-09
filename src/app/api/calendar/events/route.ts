import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '@/lib/db';
import Exam from '@/models/Exam';
import User from '@/models/User';
import StudySession from '@/models/StudySession';

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

    // Get all exams for the user
    const exams = await Exam.find({ user: user._id });
    
    // Get all study sessions for the user
    const sessions = await StudySession.find({ user: user._id });

    // Format exams as calendar events
    const examEvents = exams.map(exam => ({
      id: `exam-${exam._id}`,
      title: `📚 Exam: ${exam.subject}`,
      start: exam.date,
      end: new Date(new Date(exam.date).getTime() + 2 * 60 * 60 * 1000), // 2 hours duration
      allDay: false,
      backgroundColor: '#ef4444', // Red for exams
      borderColor: '#dc2626',
      textColor: '#ffffff',
      url: `/exams`,
      extendedProps: {
        type: 'exam',
        examId: exam._id,
        subject: exam.subject
      }
    }));

    // Format study sessions as calendar events
    const sessionEvents = sessions.map(session => ({
      id: `session-${session._id}`,
      title: `📖 ${session.title}`,
      start: session.startTime,
      end: session.endTime,
      allDay: false,
      backgroundColor: session.isCompleted ? '#10b981' : '#3b82f6', // Green if completed, blue if not
      borderColor: session.isCompleted ? '#059669' : '#2563eb',
      textColor: '#ffffff',
      url: `/session/${session._id}`,
      extendedProps: {
        type: 'session',
        sessionId: session._id,
        subject: session.subject,
        isCompleted: session.isCompleted
      }
    }));

    // Combine all events
    const allEvents = [...examEvents, ...sessionEvents];

    return NextResponse.json({ data: allEvents }, { status: 200 });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return NextResponse.json({ error: 'Error fetching calendar events' }, { status: 500 });
  }
}
