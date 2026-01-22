import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '@/lib/db';
import Exam from '@/models/Exam';
import User from '@/models/User';
import StudySession from '@/models/StudySession';
import { StudyPlannerV1 } from '@/lib/scheduling/advancedScheduler';

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
    const { subject, date, studyMaterials: studyMaterialsData, adjustment_percentage, session_duration } = body;

    if (!subject || !date || !studyMaterialsData || studyMaterialsData.length === 0) {
      return NextResponse.json(
        { error: 'Subject, date, and at least one study material are required' },
        { status: 400 }
      );
    }

    const studyMaterials = studyMaterialsData.map((material: any) => ({
      chapter: material.chapter,
      difficulty: parseInt(material.difficulty.toString()),
      confidence: parseInt(material.confidence.toString()),
      user_estimated_total_hours: material.user_estimated_total_hours || 10, // V1 requirement
      completed: false,
    }));

    const exam = new Exam({
      subject,
      date: new Date(date),
      user: user._id,
      studyMaterials,
    });
    
    await exam.save();

    // --- V1 Scheduler Integration ---
    console.log('Starting V1 Scheduler...');

    // Fetch existing sessions to avoid over-scheduling
    const existingSessions = await StudySession.find({ user: user._id });
    
    // Transform existing sessions for scheduler
    const existingSessionsForScheduler = existingSessions.map(session => ({
      date: new Date(session.startTime),
      subjectId: session.exam.toString(),
      duration: (session.endTime.getTime() - session.startTime.getTime()) / (1000 * 3600), // Convert to hours
    }));

    // Fetch all exams for the user, including the one just created.
    const allUserExams = await Exam.find({ user: user._id });

    // Prepare inputs for the V1 scheduler.
    const userInputs = {
      daily_max_hours: body.daily_max_hours || user.daily_study_limit || 4,
      adjustment_percentage: adjustment_percentage || user.adjustment_percentage || 25,
      session_duration: session_duration || user.session_duration || 30,
      start_date: new Date(),
      existing_sessions: existingSessionsForScheduler,
      exams: allUserExams.map(e => ({
        id: e._id.toString(),
        subject: e.subject,
        exam_date: e.date,
        difficulty: e.studyMaterials[0]?.difficulty || 3,
        confidence: e.studyMaterials[0]?.confidence || 3,
        user_estimated_total_hours: e.studyMaterials[0]?.user_estimated_total_hours || 10,
        can_study_after_exam: true,
      })),
    };

    const scheduler = new StudyPlannerV1(userInputs);
    const result = scheduler.generatePlan();

    let sessionsToSave: any[] = [];
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
      const result = scheduler.generatePlan();
      
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
      
      // Check if there's overload information
      if (overloadInfo) {
        console.log(`🔴 Creating schedule with overload: ${overloadInfo.message}`);
      }
      
      for (const day of dailySchedules) {
        for (const subjectId in day.subjects) {
          const hours = day.subjects[subjectId];
          const numChunks = Math.round(hours / (sessionDurationMinutes / 60)); // Use custom session duration

          for (let i = 0; i < numChunks; i++) {
            const examForSubject = allUserExams.find(e => e._id.toString() === subjectId);
            if (examForSubject) {
              // Check if this session already exists to avoid duplicates
              const sessionStart = new Date(new Date(day.date).getTime() + i * sessionDurationMinutes * 60000);
              const sessionEnd = new Date(new Date(day.date).getTime() + (i + 1) * sessionDurationMinutes * 60000);
              
              const existingSession = existingSessions.find(existing => 
                existing.exam.toString() === subjectId &&
                existing.startTime.getTime() === sessionStart.getTime()
              );
              
              // Only add if it doesn't already exist
              if (!existingSession) {
                sessionsToSave.push({
                  user: user._id,
                  exam: examForSubject._id,
                  title: `Study: ${examForSubject.subject}`,
                  subject: examForSubject.subject,
                  startTime: sessionStart,
                  endTime: sessionEnd,
                  isCompleted: false,
                  isOverloaded: day.is_overloaded || false, // Mark if this session is in an overloaded day
                  overloadAmount: day.overload_amount || 0, // How much over the limit this day is
                });
              }
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
        message: `Created exam and ${sessionsToSave.length} study sessions`
      }, 
      status: 201 
    });
  } catch (error) {
    console.error('Error in POST /api/exams:', error);
    return NextResponse.json({ error: 'Error creating exam' }, { status: 500 });
  }
}
