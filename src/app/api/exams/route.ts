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
    console.log('API received body:', body);
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
      user_estimated_total_hours: material.user_estimated_total_hours || 5, // Default to 5 hours instead of 10
      completed: false,
    }));

    console.log('StudyMaterials to save:', JSON.stringify(studyMaterials, null, 2));

    const exam = new Exam({
      subject,
      date: new Date(date),
      user: user._id,
      studyMaterials,
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
    const userInputs = {
      daily_max_hours: body.daily_max_hours || user.daily_study_limit || 4,
      adjustment_percentage: body.adjustment_percentage || user.adjustment_percentage || 25,
      session_duration: body.session_duration || user.session_duration || 30,
      start_date: new Date(),
      existing_sessions: existingSessionsForScheduler,
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
      adjustment_percentage: userInputs.adjustment_percentage,
      session_duration: userInputs.session_duration,
    });
    
    // Also update the user's saved preferences with these latest values
    if (body.daily_max_hours || body.adjustment_percentage || body.session_duration) {
      try {
        if (body.daily_max_hours) user.daily_study_limit = body.daily_max_hours;
        if (body.adjustment_percentage) user.adjustment_percentage = body.adjustment_percentage;
        if (body.session_duration) user.session_duration = body.session_duration;
        await user.save();
        console.log('✅ Updated user preferences with latest values');
      } catch (error) {
        console.error('⚠️  Failed to update user preferences:', error);
      }
    }

    // If multiple exams exist, delete ALL existing sessions to apply new diversified schedule
    const hasMultipleExams = allUserExams.length > 1;
    console.log(`Exam count: ${allUserExams.length}, hasMultipleExams: ${hasMultipleExams}, existingSessions: ${existingSessions.length}`);
    
    if (hasMultipleExams && existingSessions.length > 0) {
      console.log(`Multiple exams detected - deleting ${existingSessions.length} existing sessions to reschedule with diversification`);
      console.log('Existing sessions before deletion:', existingSessions.map(s => ({ subject: s.subjectId, date: s.date })));
      
      await StudySession.deleteMany({ 
        user: user._id,
        exam: { $in: allUserExams.map(e => e._id) }
      });
      
      existingSessions = []; // Clear the array since we deleted everything
      // Update userInputs to reflect the deleted sessions
      userInputs.existing_sessions = [];
      
      console.log('Sessions deleted, userInputs.existing_sessions set to empty array');
    } else {
      console.log('Not deleting sessions - either single exam or no existing sessions');
    }

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
              existing.startTime.toISOString().split('T')[0] === day.date.toISOString().split('T')[0]
            );
            
            console.log(`API DEBUG: Filtering for subjectId ${subjectId}, day ${day.date.toISOString().split('T')[0]}`);
            console.log(`API DEBUG: All existing sessions:`, existingSessions.map(s => ({
              exam: s.exam.toString(),
              date: s.startTime.toISOString().split('T')[0],
              subject: s.subject
            })));
            
            console.log(`API DEBUG: Day ${day.date.toISOString().split('T')[0]}, Subject ${examForSubject.subject}`);
            console.log(`API DEBUG: Hours: ${hours}, numChunks: ${numChunks}, existingSessionsForDay: ${existingSessionsForDay.length}`);
            
            // Only create the difference between needed and existing
            const sessionsToCreate = Math.max(0, numChunks - existingSessionsForDay.length);
            
            console.log(`API DEBUG: sessionsToCreate: ${sessionsToCreate}`);
            
            for (let i = 0; i < sessionsToCreate; i++) {
              // Stagger sessions throughout the day to avoid overlap
              const sessionStart = new Date(day.date);
              sessionStart.setHours(9 + ((existingSessionsForDay.length + i) * 2), 0, 0, 0); // 9 AM, 11 AM, 1 PM, etc.
              const sessionEnd = new Date(sessionStart.getTime() + sessionDurationMinutes * 60000);
              
              // Create a unique identifier for each session
              const sessionIdentifier = `${subjectId}-${day.date.toISOString().split('T')[0]}-${existingSessionsForDay.length + i}`;
              
              const existingSession = existingSessions.find(existing => 
                existing.exam.toString() === subjectId &&
                existing.startTime.toISOString().split('T')[0] === day.date.toISOString().split('T')[0]
              );
              
              // Only add if it doesn't already exist
              if (!existingSession) {
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
