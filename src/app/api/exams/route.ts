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
    const { subject, date, studyMaterials: studyMaterialsData } = body;

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

    // The V1 scheduler generates a holistic plan, so we clear old sessions first.
    await StudySession.deleteMany({ user: user._id });

    // Fetch all exams for the user, including the one just created.
    const allUserExams = await Exam.find({ user: user._id });

    // Prepare inputs for the V1 scheduler.
    const userInputs = {
      daily_max_hours: body.daily_max_hours || 4,
      start_date: new Date(),
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
      // Plan generated successfully, transform it into StudySession models.
      const dailySchedules = result;
      for (const day of dailySchedules) {
        for (const subjectId in day.subjects) {
          const hours = day.subjects[subjectId];
          const numChunks = Math.round(hours / 0.5); // 30-min chunks

          for (let i = 0; i < numChunks; i++) {
            const examForSubject = allUserExams.find(e => e._id.toString() === subjectId);
            if (examForSubject) {
              sessionsToSave.push({
                user: user._id,
                exam: examForSubject._id,
                title: `Study: ${examForSubject.subject}`,
                subject: examForSubject.subject,
                startTime: new Date(new Date(day.date).getTime() + i * 30 * 60000), // Stagger chunks
                endTime: new Date(new Date(day.date).getTime() + (i + 1) * 30 * 60000),
                isCompleted: false,
              });
            }
          }
        }
      }
      await StudySession.insertMany(sessionsToSave);
      console.log(`V1 Scheduler saved ${sessionsToSave.length} session chunks.`);
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
