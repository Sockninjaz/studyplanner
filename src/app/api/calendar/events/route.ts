import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '@/lib/db';
import Exam from '@/models/Exam';
import User from '@/models/User';
import StudySession from '@/models/StudySession';
import Task from '@/models/Task';

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

    // Get all tasks for the user
    const tasks = await Task.find({ userId: user._id });

    // Colors for exams
    const EXAM_COLORS = [
      'rgb(253, 231, 76)', // Yellow
      'rgb(72, 86, 150)',  // Blue  
      'rgb(250, 175, 205)', // Pink
      'rgb(66, 191, 221)',  // Cyan
      'rgb(167, 139, 250)', // Lavender
      'rgb(52, 211, 153)',  // Mint
      'rgb(251, 146, 60)',  // Orange/Peach
      'rgb(45, 212, 191)',  // Teal
    ];

    // Helper to get color for an exam (stored or stable fallback)
    const getExamColor = (exam: any) => {
      if (exam.color) return exam.color;

      // Stable fallback based on ID if no color stored
      // Use a simple hash function (djb2-like) for better distribution than simple sum
      let hash = 0;
      const str = exam._id.toString();
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
      }
      return EXAM_COLORS[Math.abs(hash) % EXAM_COLORS.length];
    };

    // Create a map of exam ID to color for quick lookup
    const examColorMap = new Map();
    exams.forEach(exam => {
      examColorMap.set(exam._id.toString(), getExamColor(exam));
    });

    // Format exams as calendar events
    const examEvents = exams.map(exam => {
      const color = examColorMap.get(exam._id.toString());
      return {
        id: `exam-${exam._id}`,
        title: `📚 Exam: ${exam.subject}`,
        start: exam.date,
        end: new Date(new Date(exam.date).getTime() + 2 * 60 * 60 * 1000), // 2 hours duration
        allDay: false,
        backgroundColor: `${color}40`, // 25% opacity for background
        borderColor: color,
        textColor: '#ffffff', // Keep text white/readable or dark depending on background
        url: `/exams`,
        extendedProps: {
          type: 'exam',
          examId: exam._id,
          subject: exam.subject,
          color: color
        }
      };
    });

    // Format study sessions as calendar events
    const sessionEvents = sessions.map(session => {
      const examColor = examColorMap.get(session.exam.toString()) || '#3b82f6'; // Fallback to blue
      const taskCompleted = session.isCompleted;

      return {
        id: `session-${session._id}`,
        title: `📖 ${session.title}`,
        start: session.startTime,
        end: session.endTime,
        allDay: false,
        backgroundColor: taskCompleted ? '#10b981' : `${examColor}20`, // Green if completed, else light exam color
        borderColor: taskCompleted ? '#059669' : examColor,
        textColor: '#ffffff', // This might need adjustment based on background
        url: `/session/${session._id}`,
        extendedProps: {
          type: 'session',
          sessionId: session._id.toString(),
          subject: session.subject,
          isCompleted: session.isCompleted,
          color: examColor
        }
      };
    });

    // Format tasks as calendar events
    const taskEvents = tasks.map(task => ({
      id: `task-${task._id}`,
      title: `✓ ${task.name}`,
      start: task.date,
      end: task.date,
      allDay: true,
      backgroundColor: task.isCompleted ? '#10b981' : '#f59e0b', // Green if completed, amber if not
      borderColor: task.isCompleted ? '#059669' : '#d97706',
      textColor: '#ffffff',
      extendedProps: {
        type: 'task',
        taskId: task._id.toString(),
        name: task.name,
        description: task.description,
        isCompleted: task.isCompleted
      }
    }));

    // Combine all events
    const allEvents = [...examEvents, ...sessionEvents, ...taskEvents];

    return NextResponse.json({ data: allEvents }, { status: 200 });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return NextResponse.json({ error: 'Error fetching calendar events' }, { status: 500 });
  }
}
