import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '@/lib/db';
import Exam from '@/models/Exam';
import User from '@/models/User';
import StudySession from '@/models/StudySession';
import { StudyPlannerV1 } from '@/lib/scheduling/advancedScheduler';
import { separateSessions } from '@/lib/scheduling/sessionUtils';
import BlockedDay from '@/models/BlockedDay';
import { isValidCalendarDate } from '@/lib/dateUtils';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    const exam = await Exam.findOne({
      _id: params.id,
      user: user._id,
    });

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    return NextResponse.json({ data: exam }, { status: 200 });
  } catch (error) {
    console.error('Error fetching exam:', error);
    return NextResponse.json({ error: 'Error fetching exam' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  try {
    const body = await request.json();
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const exam = await Exam.findOne({ _id: params.id, user: user._id });
    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    if (body.date && !isValidCalendarDate(body.date)) {
      return NextResponse.json(
        { error: 'Invalid exam date' },
        { status: 400 }
      );
    }

    // Update exam fields
    if (body.subject) exam.subject = body.subject;
    if (body.date) exam.date = new Date(body.date);
    if (body.studyMaterials) {
      exam.studyMaterials = body.studyMaterials.map((m: any) => ({
        chapter: m.chapter,
        difficulty: parseInt(m.difficulty.toString()),
        confidence: parseInt(m.confidence.toString()),
        user_estimated_total_hours: m.user_estimated_total_hours || 5,
        completed: m.completed || false,
      }));
    }
    await exam.save();
    console.log('Updated exam:', exam._id);

    // If subject changed, update subject/title on ALL existing sessions for this exam (including completed)
    if (body.subject) {
      await StudySession.updateMany(
        { user: user._id, exam: exam._id },
        { $set: { subject: body.subject } }
      );
      // Also update titles to reflect new name
      const sessionsToRename = await StudySession.find({ user: user._id, exam: exam._id });
      for (const s of sessionsToRename) {
        s.title = s.title.replace(/^Study: .+?($| \()/, `Study: ${body.subject}$1`);
        await s.save();
      }
      console.log(`Updated subject name on ${sessionsToRename.length} sessions`);
    }

    // Reschedule: separate historical/future sessions for ALL user exams
    const allUserExams = await Exam.find({ user: user._id });
    const allSessions = await StudySession.find({ user: user._id });
    const { completedSessions, missedSessions, reschedulableSessions, completedHours } = separateSessions(allSessions);
    console.log(`Edit reschedule - Completed: ${completedSessions.length}, Missed: ${missedSessions.length}, Reschedulable: ${reschedulableSessions.length}`);
    console.log('Completed hours per exam:', JSON.stringify(completedHours));

    // Delete reschedulable sessions (future/today) and missed sessions (past uncompleted)
    const sessionsToDelete = [...reschedulableSessions, ...missedSessions];
    if (sessionsToDelete.length > 0) {
      await StudySession.deleteMany({ _id: { $in: sessionsToDelete.map(s => s._id) } });
      console.log(`Deleted ${reschedulableSessions.length} reschedulable and ${missedSessions.length} missed sessions`);
    }

    // Re-fetch locked sessions for deduplication
    const lockedSessions = await StudySession.find({ user: user._id });

    const userInputs: {
      daily_max_hours: number;
      adjustment_percentage: number;
      session_duration: number;
      start_date: Date;
      existing_sessions: { date: Date; subjectId: string; duration: number }[];
      completed_hours: { [examId: string]: number };
      blocked_days?: string[];
      soft_daily_limit?: number;
      exams: { id: string; subject: string; exam_date: Date; difficulty: number; confidence: number; user_estimated_total_hours: number; can_study_after_exam: boolean }[];
    } = {
      daily_max_hours: body.daily_max_hours || user.daily_study_limit || 4,
      soft_daily_limit: user.soft_daily_limit || 2,
      adjustment_percentage: body.adjustment_percentage || user.adjustment_percentage || 25,
      session_duration: body.session_duration || user.session_duration || 30,
      start_date: new Date(),
      existing_sessions: [],
      completed_hours: completedHours,
      exams: allUserExams.map(e => ({
        id: e._id.toString(),
        subject: e.subject,
        exam_date: e.date,
        difficulty: e.studyMaterials[0]?.difficulty || 3,
        confidence: e.studyMaterials[0]?.confidence || 3,
        user_estimated_total_hours: e.studyMaterials[0]?.user_estimated_total_hours || 5,
        can_study_after_exam: e.can_study_after_exam,
      })),
    };

    // Fetch blocked days for this user
    const blockedDayDocs = await BlockedDay.find({ user: user._id });
    userInputs.blocked_days = blockedDayDocs.map(bd => bd.date.toISOString().split('T')[0]);

    const scheduler = new StudyPlannerV1(userInputs);
    const result = scheduler.generatePlan();

    let overloadWarning: string | null = null;
    let overloadedDays: { date: string; sessions: number; limit: number }[] = [];

    if (!('error' in result)) {
      let dailySchedules: any[];
      if (Array.isArray(result)) {
        dailySchedules = result;
      } else {
        dailySchedules = (result as any).schedule || [];
      }

      const sessionDurationMinutes = userInputs.session_duration;
      const sessionsToSave: any[] = [];

      // Check for overloads
      const maxSessionsPerDay = Math.floor(userInputs.daily_max_hours / (sessionDurationMinutes / 60));
      const dailySessionCounts: { [date: string]: number } = {};

      for (const day of dailySchedules) {
        const dateStr = day.date.toISOString().split('T')[0];
        let daySessionCount = 0;
        for (const subjectId in day.subjects) {
          const hours = day.subjects[subjectId];
          const sessionDurationHours = sessionDurationMinutes / 60;
          const numChunks = Math.ceil(hours / sessionDurationHours);

          dailySessionCounts[dateStr] = (dailySessionCounts[dateStr] || 0) + numChunks;

          const examForSubject = allUserExams.find(e => e._id.toString() === subjectId);
          if (examForSubject) {
            const lockedForDay = lockedSessions.filter(s =>
              s.exam.toString() === subjectId &&
              s.startTime.toISOString().split('T')[0] === dateStr &&
              !s.isCompleted // Exclude completed sessions
            );
            const sessionsToCreate = Math.max(0, numChunks - lockedForDay.length);

            for (let i = 0; i < sessionsToCreate; i++) {
              const sessionStart = new Date(day.date);
              // Stagger sessions to avoid overlap (9:00, 9:30, 10:00, etc.)
              sessionStart.setHours(9, (daySessionCount + lockedForDay.length) * sessionDurationMinutes, 0, 0);
              const sessionEnd = new Date(sessionStart.getTime() + sessionDurationMinutes * 60000);

              sessionsToSave.push({
                user: user._id,
                exam: examForSubject._id,
                title: `Study: ${examForSubject.subject}${numChunks > 1 ? ` (${lockedForDay.length + i + 1}/${numChunks})` : ''}`,
                subject: examForSubject.subject,
                startTime: sessionStart,
                endTime: sessionEnd,
                isCompleted: false,
              });
              daySessionCount++;
            }
          }
        }
      }

      // Check for overloaded days
      for (const [dateStr, count] of Object.entries(dailySessionCounts)) {
        if (count > maxSessionsPerDay) {
          overloadedDays.push({ date: dateStr, sessions: count, limit: maxSessionsPerDay });
        }
      }
      if (overloadedDays.length > 0) {
        overloadWarning = `${overloadedDays.length} day(s) exceed your daily session limit.`;
      }

      if (sessionsToSave.length > 0) {
        await StudySession.insertMany(sessionsToSave);
        console.log(`Regenerated ${sessionsToSave.length} sessions after exam edit`);
      }
    }

    return NextResponse.json({
      data: {
        exam,
        overloadWarning,
        overloadedDays,
      }
    }, { status: 200 });
  } catch (error) {
    console.error('Error updating exam:', error);
    return NextResponse.json({ error: 'Error updating exam' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  try {
    console.log('Attempting to delete exam:', params.id);

    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      console.log('User not found for email:', session.user.email);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('Found user:', user._id);

    const exam = await Exam.findOne({
      _id: params.id,
      user: user._id,
    });

    if (!exam) {
      console.log('Exam not found for id:', params.id, 'and user:', user._id);
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    console.log('Found exam:', exam._id);

    // Delete the exam first
    const examDeleteResult = await Exam.deleteOne({ _id: exam._id });
    console.log('Deleted exam:', examDeleteResult);

    // Delete ALL sessions for the deleted exam (past and future)
    await StudySession.deleteMany({ user: user._id, exam: exam._id });
    console.log('Deleted all sessions for deleted exam');

    // Get remaining exams
    const remainingExams = await Exam.find({ user: user._id });
    console.log(`Found ${remainingExams.length} remaining exams`);

    // If there are remaining exams, regenerate the schedule
    if (remainingExams.length > 0) {
      // Separate historical/future sessions for remaining exams
      const remainingSessions = await StudySession.find({ user: user._id });
      const { completedSessions, missedSessions, reschedulableSessions, completedHours } = separateSessions(remainingSessions);
      console.log(`Completed: ${completedSessions.length}, Missed: ${missedSessions.length}, Reschedulable: ${reschedulableSessions.length}`);
      console.log('Completed hours per exam:', completedHours);

      // Delete reschedulable sessions (future/today) and missed sessions (past uncompleted) for remaining exams
      const sessionsToDelete = [...reschedulableSessions, ...missedSessions];
      if (sessionsToDelete.length > 0) {
        await StudySession.deleteMany({ _id: { $in: sessionsToDelete.map(s => s._id) } });
        console.log(`Deleted ${reschedulableSessions.length} reschedulable and ${missedSessions.length} missed sessions for regeneration`);
      }

      // Re-fetch remaining locked sessions (completed + missed) for deduplication
      const lockedSessions = await StudySession.find({ user: user._id });
      console.log(`${lockedSessions.length} locked sessions remain after cleanup`);

      const userInputs: {
        daily_max_hours: number;
        adjustment_percentage: number;
        session_duration: number;
        start_date: Date;
        existing_sessions: { date: Date; subjectId: string; duration: number }[];
        completed_hours: { [examId: string]: number };
        blocked_days?: string[];
        soft_daily_limit?: number;
        exams: { id: string; subject: string; exam_date: Date; difficulty: number; confidence: number; user_estimated_total_hours: number; can_study_after_exam: boolean }[];
      } = {
        daily_max_hours: user.daily_study_limit || 4,
        soft_daily_limit: user.soft_daily_limit || 2,
        adjustment_percentage: user.adjustment_percentage || 25,
        session_duration: user.session_duration || 30,
        start_date: new Date(),
        existing_sessions: [],
        completed_hours: completedHours,
        exams: remainingExams.map(e => ({
          id: e._id.toString(),
          subject: e.subject,
          exam_date: e.date,
          difficulty: e.studyMaterials[0]?.difficulty || 3,
          confidence: e.studyMaterials[0]?.confidence || 3,
          user_estimated_total_hours: e.studyMaterials[0]?.user_estimated_total_hours || 5,
          can_study_after_exam: e.can_study_after_exam,
        })),
      };

      // Reuse blocked days from earlier fetch
      const blockedDayDocsForDelete = await BlockedDay.find({ user: user._id });
      userInputs.blocked_days = blockedDayDocsForDelete.map(bd => bd.date.toISOString().split('T')[0]);

      const scheduler = new StudyPlannerV1(userInputs);
      const result = scheduler.generatePlan();

      if (!('error' in result)) {
        let dailySchedules: any[];
        if (Array.isArray(result)) {
          dailySchedules = result;
        } else {
          dailySchedules = (result as any).schedule || [];
        }

        const sessionDurationMinutes = userInputs.session_duration;
        const sessionsToSave: any[] = [];

        for (const day of dailySchedules) {
          let daySessionCount = 0;
          for (const subjectId in day.subjects) {
            const hours = day.subjects[subjectId];
            const sessionDurationHours = sessionDurationMinutes / 60;
            const numChunks = Math.ceil(hours / sessionDurationHours);

            const examForSubject = remainingExams.find(e => e._id.toString() === subjectId);
            if (examForSubject) {
              // Check how many locked sessions already exist for this subject on this day
              const lockedForDay = lockedSessions.filter(s =>
                s.exam.toString() === subjectId &&
                s.startTime.toISOString().split('T')[0] === day.date.toISOString().split('T')[0]
              );
              const sessionsToCreate = Math.max(0, numChunks - lockedForDay.length);

              for (let i = 0; i < sessionsToCreate; i++) {
                const sessionStart = new Date(day.date);
                // Stagger sessions to avoid overlap (9:00, 9:30, 10:00, etc.)
                sessionStart.setHours(9, (daySessionCount + lockedForDay.length) * sessionDurationMinutes, 0, 0);
                const sessionEnd = new Date(sessionStart.getTime() + sessionDurationMinutes * 60000);

                sessionsToSave.push({
                  user: user._id,
                  exam: examForSubject._id,
                  title: `Study: ${examForSubject.subject}${numChunks > 1 ? ` (${lockedForDay.length + i + 1}/${numChunks})` : ''}`,
                  subject: examForSubject.subject,
                  startTime: sessionStart,
                  endTime: sessionEnd,
                  isCompleted: false,
                });
                daySessionCount++;
              }
            }
          }
        }

        if (sessionsToSave.length > 0) {
          await StudySession.insertMany(sessionsToSave);
          console.log(`Regenerated ${sessionsToSave.length} sessions for remaining exams`);
        }
      }
    }

    return NextResponse.json({ message: 'Exam deleted and schedule regenerated for remaining exams' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting exam:', error);
    return NextResponse.json({ error: 'Error deleting exam' }, { status: 500 });
  }
}
