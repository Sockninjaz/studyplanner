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
    let exams = await Exam.find({ user: user._id });

    // Filter out exams completed more than 24 hours ago
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    exams = exams.filter(exam => {
      if (exam.isCompleted) {
        if (exam.completedAt) {
          return new Date(exam.completedAt) >= twentyFourHoursAgo;
        }
        return false; // hide if completed but missing timestamp (legacy)
      }
      return true; // keep if not completed
    });
    
    const validExamIds = new Set(exams.map(e => e._id.toString()));

    // Get all study sessions for the user, but only for valid exams
    let rawSessions = await StudySession.find({ user: user._id });
    let validSessions = rawSessions.filter(session => validExamIds.has(session.exam?.toString()));

    // Deduplicate sessions in memory by exam + startTime + title to prevent duplicate chips
    const seenSessionKeys = new Set<string>();
    const sessions: typeof validSessions = [];
    for (const session of validSessions) {
      const key = `${session.exam?.toString()}-${new Date(session.startTime).toISOString()}-${(session as any).shortTitle || session.title}`;
      if (!seenSessionKeys.has(key)) {
        seenSessionKeys.add(key);
        sessions.push(session);
      }
    }

    // Get all tasks for the user
    const tasks = await Task.find({ userId: user._id });

    // Colors for exams
    const EXAM_COLORS = [
      '#fde74c', // Yellow
      '#485696', // Blue  
      '#faafcd', // Pink
      '#42bfdd', // Cyan
      '#a78bfa', // Lavender
      '#34d399', // Mint
      '#fb923c', // Orange/Peach
      '#2dd4bf', // Teal
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

    // Helper to apply opacity to any color string (hex or rgb)
    const applyOpacity = (color: string, opacity: number) => {
      if (color.startsWith('#')) {
        // Convert hex to rgba
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
      } else if (color.startsWith('rgb')) {
        // Handle rgb(r, g, b) or rgba(r, g, b, a)
        return color.replace('rgb(', 'rgba(').replace(')', `, ${opacity})`);
      }
      return color;
    };

    // Format exams as calendar events
    const examEvents = exams.map(exam => {
      const color = examColorMap.get(exam._id.toString());
      return {
        id: `exam-${exam._id}`,
        title: `Exam: ${exam.subject}`,
        start: exam.date,
        end: new Date(new Date(exam.date).getTime() + 2 * 60 * 60 * 1000), // 2 hours duration
        allDay: false,
        editable: false, // Exams cannot be dragged
        backgroundColor: exam.isCompleted ? '#10b981' : applyOpacity(color, 0.4),
        borderColor: exam.isCompleted ? '#059669' : color,
        textColor: '#ffffff',
        url: `/exams`,
        extendedProps: {
          type: 'exam',
          examId: exam._id,
          subject: exam.subject,
          color: color,
          isCompleted: exam.isCompleted
        }
      };
    });

    // Format study sessions as calendar events
    const sessionEvents = sessions.map(session => {
      const examColor = examColorMap.get(session.exam.toString()) || '#3b82f6'; // Fallback to blue
      const taskCompleted = session.isCompleted;

      // Use shortTitle for the chip label (short), fall back to stripping the colon from full title
      const displayTitle = (session as any).shortTitle
        || (session.title.includes(':') ? session.title.split(':')[0].trim() : session.title);

      return {
        id: `session-${session._id}`,
        title: session.subject,
        start: session.startTime,
        end: session.endTime,
        allDay: false,
        backgroundColor: taskCompleted ? '#10b981' : applyOpacity(examColor, 0.4), // Green if completed, else light exam color (0.4 opacity)
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
      title: task.name,
      start: task.date,
      end: task.date,
      allDay: true,
      editable: false, // Tasks cannot be dragged
      backgroundColor: task.isCompleted ? '#10b981' : '#f59e0b',
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
