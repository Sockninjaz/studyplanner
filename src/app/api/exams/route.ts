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

    const exams = await Exam.find({ user: user._id }).sort({ date: 1 });
    return NextResponse.json({ data: exams }, { status: 200 });
  } catch (error) {
    console.error('Error fetching exams:', error);
    return NextResponse.json({ error: 'Error fetching exams' }, { status: 500 });
  }
}

export async function POST(request: Request) {
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

    const body = await request.json();
    console.log('API received body:', body);
    const { subject, date, studyMaterials: studyMaterialsData, adjustment_percentage, session_duration } = body;

    if (!subject || !date || !studyMaterialsData || studyMaterialsData.length === 0) {
      return NextResponse.json(
        { error: 'Subject, date, and at least one study material are required' },
        { status: 400 }
      );
    }

    if (!isValidCalendarDate(date)) {
      return NextResponse.json(
        { error: 'Invalid exam date' },
        { status: 400 }
      );
    }

    const studyMaterials = studyMaterialsData.map((material: any) => ({
      chapter: material.chapter,
      difficulty: parseInt(material.difficulty.toString()),
      confidence: parseInt(material.confidence.toString()),
      user_estimated_total_hours: material.user_estimated_total_hours || 5, // Default to 5 hours instead of 10
      completed: false,
    }));

    console.log('StudyMaterials to save:', JSON.stringify(studyMaterials, null, 2));

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

    // Find the most recent exam to rotate colors
    // Sort by _id (which includes timestamp) to cover legacy docs without createdAt
    const lastExam = await Exam.findOne({ user: user._id }).sort({ _id: -1 });
    let nextColorIndex = 0;

    console.log('Last exam found:', lastExam ? `ID: ${lastExam._id}, Color: ${lastExam.color}` : 'None');

    if (lastExam && lastExam.color) {
      const lastColorIndex = EXAM_COLORS.indexOf(lastExam.color);
      console.log(`Last color index in palette: ${lastColorIndex}`);

      if (lastColorIndex !== -1) {
        nextColorIndex = (lastColorIndex + 1) % EXAM_COLORS.length;
      } else {
        // Color not found in current palette (maybe legacy color?)
        // Fallback to count-based or random to avoid getting stuck on 0 (Yellow)
        console.log('Last exam color not in current palette, falling back to count');
        const count = await Exam.countDocuments({ user: user._id });
        nextColorIndex = count % EXAM_COLORS.length;
      }
    } else if (lastExam) {
      // Fallback if last exam has no color (legacy)
      console.log('Last exam has no color, falling back to count');
      const count = await Exam.countDocuments({ user: user._id });
      nextColorIndex = count % EXAM_COLORS.length;
    } else {
      console.log('No previous exams, starting with first color');
      nextColorIndex = 0;
    }

    console.log(`Selected next color index: ${nextColorIndex} (${EXAM_COLORS[nextColorIndex]})`);

    const color = EXAM_COLORS[nextColorIndex];

    const exam = new Exam({
      subject,
      date: new Date(date),
      user: user._id,
      studyMaterials,
      color,
    });

    await exam.save();

    // --- V1 Scheduler Integration ---
    console.log('Starting V1 Scheduler...');

    // Fetch all exams for the user, including the one just created.
    const allUserExams = await Exam.find({ user: user._id });
    console.log('Exams from database:', JSON.stringify(allUserExams, null, 2));

    // Fetch existing sessions to preserve and rebalance
    let existingSessions = await StudySession.find({ user: user._id });
    console.log(`Found ${existingSessions.length} existing sessions to rebalance`);

    // Transform existing sessions for scheduler
    const existingSessionsForScheduler = existingSessions.map(session => ({
      date: new Date(session.startTime),
      subjectId: session.exam.toString(),
      duration: (session.endTime.getTime() - session.startTime.getTime()) / (1000 * 3600), // Convert to hours
    }));

    // Prepare inputs for the V1 scheduler.
    console.log('🔧 API received values:', {
      daily_max_hours: body.daily_max_hours,
      adjustment_percentage: body.adjustment_percentage,
      session_duration: body.session_duration,
    });

    // Use the values from the request body (from current UI state) first
    // These should be the most up-to-date values from the frontend
    const userInputs: {
      daily_max_hours: number;
      adjustment_percentage: number;
      session_duration: number;
      start_date: Date;
      existing_sessions: { date: Date; subjectId: string; duration: number }[];
      exams: { id: string; subject: string; exam_date: Date; difficulty: number; confidence: number; user_estimated_total_hours: number; can_study_after_exam: boolean }[];
      completed_hours: { [examId: string]: number };
      blocked_days?: string[];
      soft_daily_limit?: number;
      enable_daily_limits?: boolean;
    } = {
      daily_max_hours: body.daily_max_hours || user.daily_study_limit || 4,
      soft_daily_limit: body.soft_daily_limit || user.soft_daily_limit || 2,
      adjustment_percentage: body.adjustment_percentage || user.adjustment_percentage || 25,
      session_duration: body.session_duration || user.session_duration || 30,
      enable_daily_limits: body.enable_daily_limits !== undefined ? body.enable_daily_limits : (user.enable_daily_limits !== false),
      start_date: new Date(),
      existing_sessions: existingSessionsForScheduler,
      completed_hours: {},
      exams: allUserExams.map(e => {
        console.log(`Database exam date for ${e.subject}:`, e.date, 'typeof:', typeof e.date);
        return {
          id: e._id.toString(),
          subject: e.subject,
          exam_date: e.date,
          difficulty: e.studyMaterials[0]?.difficulty || 3,
          confidence: e.studyMaterials[0]?.confidence || 3,
          user_estimated_total_hours: e.studyMaterials[0]?.user_estimated_total_hours || 5, // Default to 5 hours instead of 10
          can_study_after_exam: e.can_study_after_exam,
        };
      }),
    };

    console.log('🔧 Final scheduler inputs:', {
      daily_max_hours: userInputs.daily_max_hours,
      soft_daily_limit: userInputs.soft_daily_limit,
      adjustment_percentage: userInputs.adjustment_percentage,
      session_duration: userInputs.session_duration,
      enable_daily_limits: userInputs.enable_daily_limits,
    });

    // Also update the user's saved preferences with these latest values
    if (body.daily_max_hours || body.soft_daily_limit || body.adjustment_percentage || body.session_duration || body.enable_daily_limits !== undefined) {
      try {
        if (body.daily_max_hours) user.daily_study_limit = body.daily_max_hours;
        if (body.soft_daily_limit) user.soft_daily_limit = body.soft_daily_limit;
        if (body.adjustment_percentage) user.adjustment_percentage = body.adjustment_percentage;
        if (body.session_duration) user.session_duration = body.session_duration;
        if (body.enable_daily_limits !== undefined) user.enable_daily_limits = body.enable_daily_limits;
        await user.save();
        console.log('✅ Updated user preferences with latest values');
      } catch (error) {
        console.error('⚠️  Failed to update user preferences:', error);
      }
    }

    // Separate historical (past) sessions from future sessions
    const hasMultipleExams = allUserExams.length > 1;
    console.log(`Exam count: ${allUserExams.length}, hasMultipleExams: ${hasMultipleExams}, existingSessions: ${existingSessions.length}`);

    const { completedSessions, missedSessions, reschedulableSessions, completedHours } = separateSessions(existingSessions);
    console.log(`Completed: ${completedSessions.length}, Missed: ${missedSessions.length}, Reschedulable: ${reschedulableSessions.length}`);
    console.log('Completed hours per exam:', completedHours);

    if (hasMultipleExams && existingSessions.length > 0) {
      console.log(`Multiple exams detected - deleting only ${reschedulableSessions.length} reschedulable sessions (keeping ${completedSessions.length} completed + ${missedSessions.length} missed)`);

      // Only delete uncompleted future sessions; keep completed and missed sessions frozen
      if (reschedulableSessions.length > 0) {
        await StudySession.deleteMany({
          _id: { $in: reschedulableSessions.map(s => s._id) }
        });
      }

      // Re-fetch remaining sessions (completed + missed) so session creation can avoid duplicates
      existingSessions = await StudySession.find({ user: user._id });
      userInputs.existing_sessions = [];
      userInputs.completed_hours = completedHours;

      console.log(`Reschedulable sessions deleted, ${existingSessions.length} locked sessions remain`);
    } else {
      userInputs.completed_hours = completedHours;
      console.log('Not deleting sessions - either single exam or no existing sessions');
    }

    // Fetch blocked days for this user
    const blockedDayDocs = await BlockedDay.find({ user: user._id });
    userInputs.blocked_days = blockedDayDocs.map(bd => bd.date.toISOString().split('T')[0]);
    console.log('Blocked days:', userInputs.blocked_days);

    const scheduler = new StudyPlannerV1(userInputs);
    const result = scheduler.generatePlan();

    let sessionsToSave: any[] = [];
    let overloadWarning: string | null = null;
    let overloadedDays: { date: string; sessions: number; limit: number }[] = [];

    if ('error' in result) {
      console.error('Scheduler V1 Error:', result.error);
      // Even if scheduling fails, the exam was still created.
      // We return a specific error response that the frontend can handle.
      return NextResponse.json({
        error: result.error,
        choices: result.choices,
        exam_created: true,
      }, { status: 400 });
    } else {
      // Plan generated successfully, add only the new sessions

      // Handle different return types
      let dailySchedules: any[];
      let overloadInfo: any = null;

      if ('error' in result) {
        // This shouldn't happen with our new logic, but handle it just in case
        dailySchedules = [];
      } else if (Array.isArray(result)) {
        dailySchedules = result;
      } else {
        // It's a ScheduleResult
        const scheduleResult = result as any;
        dailySchedules = scheduleResult.schedule || [];
        overloadInfo = scheduleResult.overload_info;
      }

      const sessionDurationMinutes = userInputs.session_duration;

      // Check for overloaded days and generate warning
      const maxSessionsPerDay = Math.floor(userInputs.daily_max_hours / (sessionDurationMinutes / 60));

      for (const day of dailySchedules) {
        let totalSessionsOnDay = 0;
        for (const subjectId in day.subjects) {
          const hours = day.subjects[subjectId];
          totalSessionsOnDay += Math.ceil(hours / (sessionDurationMinutes / 60));
        }
        if (totalSessionsOnDay > maxSessionsPerDay) {
          overloadedDays.push({
            date: day.date.toISOString().split('T')[0],
            sessions: totalSessionsOnDay,
            limit: maxSessionsPerDay
          });
        }
      }

      if (overloadedDays.length > 0) {
        overloadWarning = `Warning: ${overloadedDays.length} day(s) exceed your daily limit of ${maxSessionsPerDay} sessions. ` +
          `Days affected: ${overloadedDays.map(d => `${d.date} (${d.sessions} sessions)`).join(', ')}. ` +
          `Consider extending your study period or reducing material.`;
        console.log(`⚠️ OVERLOAD WARNING: ${overloadWarning}`);
      }

      // Check if there's overload information from scheduler
      if (overloadInfo) {
        console.log(`🔴 Creating schedule with overload: ${overloadInfo.message}`);
      }

      console.log(`API DEBUG: Starting session creation, dailySchedules length: ${dailySchedules.length}`);
      console.log(`API DEBUG: existingSessions length: ${existingSessions.length}`);
      console.log(`API DEBUG: existingSessions details:`, existingSessions.map(s => ({
        examId: s.exam.toString(),
        date: s.startTime.toISOString().split('T')[0],
        subject: s.subject
      })));

      for (const day of dailySchedules) {
        let daySessionCount = 0;
        for (const subjectId in day.subjects) {
          const hours = day.subjects[subjectId];
          const sessionDurationHours = sessionDurationMinutes / 60;

          // Calculate how many sessions are needed based on hours
          // If scheduler says 2 hours and session duration is 1 hour, create 2 sessions
          const numChunks = Math.ceil(hours / sessionDurationHours);

          const examForSubject = allUserExams.find(e => e._id.toString() === subjectId);
          if (examForSubject) {
            // Check how many sessions already exist for this subject on this day
            const existingSessionsForDay = existingSessions.filter(existing =>
              existing.exam.toString() === subjectId &&
              existing.startTime.toISOString().split('T')[0] === day.date.toISOString().split('T')[0] &&
              !existing.isCompleted // Exclude completed sessions
            );

            console.log(`API DEBUG: Day ${day.date.toISOString().split('T')[0]}, Subject ${examForSubject.subject}`);
            console.log(`API DEBUG: Hours: ${hours}, numChunks: ${numChunks}, existingSessionsForDay: ${existingSessionsForDay.length}`);

            // Only create the difference between needed and existing
            const sessionsToCreate = Math.max(0, numChunks - existingSessionsForDay.length);

            console.log(`API DEBUG: sessionsToCreate: ${sessionsToCreate}`);

            for (let i = 0; i < sessionsToCreate; i++) {
              const sessionStart = new Date(day.date);
              // Stagger sessions to avoid overlap (9:00, 9:30, 10:00, etc.)
              sessionStart.setHours(9, (daySessionCount + existingSessionsForDay.length) * sessionDurationMinutes, 0, 0);
              const sessionEnd = new Date(sessionStart.getTime() + sessionDurationMinutes * 60000);

              sessionsToSave.push({
                user: user._id,
                exam: examForSubject._id,
                title: `Study: ${examForSubject.subject}${numChunks > 1 ? ` (${existingSessionsForDay.length + i + 1}/${numChunks})` : ''}`,
                subject: examForSubject.subject,
                startTime: sessionStart,
                endTime: sessionEnd,
                isCompleted: false,
                isOverloaded: day.is_overloaded || false,
                overloadAmount: day.overload_amount || 0,
              });
              daySessionCount++;
            }
          }
        }
      }

      if (sessionsToSave.length > 0) {
        await StudySession.insertMany(sessionsToSave);
        console.log(`V1 Scheduler added ${sessionsToSave.length} new session chunks.`);
      } else {
        console.log('V1 Scheduler: No new sessions to add (all slots already filled).');
      }
    }

    return NextResponse.json({
      data: {
        exam,
        sessions: sessionsToSave,
        message: `Created exam and ${sessionsToSave.length} study sessions`,
        overloadWarning: overloadWarning,
        overloadedDays: overloadedDays.length > 0 ? overloadedDays : undefined
      },
      status: 201
    });
  } catch (error) {
    console.error('Error in POST /api/exams:', error);
    return NextResponse.json({ error: 'Error creating exam' }, { status: 500 });
  }
}
