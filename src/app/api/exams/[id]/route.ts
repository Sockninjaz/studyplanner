import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '@/lib/db';
import Exam from '@/models/Exam';
import User from '@/models/User';
import StudySession from '@/models/StudySession';
import { StudyPlannerV1 } from '@/lib/scheduling/advancedScheduler';

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

    // Delete ALL study sessions for this user (we'll regenerate for remaining exams)
    await StudySession.deleteMany({ user: user._id });
    console.log('Deleted all user sessions for regeneration');

    // Get remaining exams
    const remainingExams = await Exam.find({ user: user._id });
    console.log(`Found ${remainingExams.length} remaining exams`);

    // If there are remaining exams, regenerate the schedule
    if (remainingExams.length > 0) {
      const userInputs = {
        daily_max_hours: user.daily_study_limit || 4,
        adjustment_percentage: user.adjustment_percentage || 25,
        session_duration: user.session_duration || 30,
        start_date: new Date(),
        existing_sessions: [],
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
          for (const subjectId in day.subjects) {
            const hours = day.subjects[subjectId];
            const sessionDurationHours = sessionDurationMinutes / 60;
            const numChunks = Math.ceil(hours / sessionDurationHours);

            const examForSubject = remainingExams.find(e => e._id.toString() === subjectId);
            if (examForSubject) {
              for (let i = 0; i < numChunks; i++) {
                const sessionStart = new Date(day.date);
                sessionStart.setHours(9 + (i * 2), 0, 0, 0);
                const sessionEnd = new Date(sessionStart.getTime() + sessionDurationMinutes * 60000);

                sessionsToSave.push({
                  user: user._id,
                  exam: examForSubject._id,
                  title: `Study: ${examForSubject.subject}${numChunks > 1 ? ` (${i + 1}/${numChunks})` : ''}`,
                  subject: examForSubject.subject,
                  startTime: sessionStart,
                  endTime: sessionEnd,
                  isCompleted: false,
                });
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
