import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '@/lib/db';
import Exam from '@/models/Exam';
import User from '@/models/User';
import StudySession from '@/models/StudySession';
import { regenerateSchedule } from '@/lib/scheduling/regenerateSchedule';
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

    let requiresRegeneration = false;

    // Update exam fields
    if (body.subject && exam.subject !== body.subject) {
      exam.subject = body.subject;
    }
    
    if (body.date) {
      const newDate = new Date(body.date);
      if (exam.date.getTime() !== newDate.getTime()) {
        requiresRegeneration = true;
        exam.date = newDate;
      }
    }
    
    if (body.studyMaterials) {
      const newMaterials = body.studyMaterials.map((m: any) => ({
        chapter: m.chapter,
        difficulty: parseInt(m.difficulty.toString()),
        confidence: parseInt(m.confidence.toString()),
        user_estimated_total_hours: m.user_estimated_total_hours || 5,
        completed: m.completed || false,
      }));

      // Compare materials to see if regeneration is needed
      if (!exam.studyMaterials || exam.studyMaterials.length !== newMaterials.length) {
        requiresRegeneration = true;
      } else {
        for (let i = 0; i < newMaterials.length; i++) {
          const oldM = exam.studyMaterials[i];
          const newM = newMaterials[i];
          if (
            oldM.chapter !== newM.chapter ||
            oldM.user_estimated_total_hours !== newM.user_estimated_total_hours
          ) {
            requiresRegeneration = true;
            break;
          }
        }
      }

      exam.studyMaterials = newMaterials;
    }

    if (body.originalFileName !== undefined) {
      exam.originalFileName = body.originalFileName;
    }

    if (body.rawMaterialText !== undefined) {
      exam.rawMaterialText = body.rawMaterialText;
      const textLength = body.rawMaterialText?.length || 0;
      exam.useRag = textLength > 400000;
      
      if (exam.useRag && exam.rawMaterialText) {
        console.log(`[RAG] Material updated and large (${textLength} chars), updating RAG embeddings...`);
        (async () => {
          try {
            const { generateAndStoreChunks } = await import('@/lib/rag/chunk-and-embed');
            await generateAndStoreChunks(exam.rawMaterialText!, exam._id.toString(), user._id.toString());
            console.log(`[RAG] Successfully updated embedded material for exam ${exam._id}`);
          } catch (err) {
            console.error('[RAG] Failed to generate embeddings:', err);
          }
        })();
      }
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

    // Unified AI Schedule Regeneration
    let overloadWarning = null;
    let overloadedDays = [];

    if (requiresRegeneration) {
      console.log('Exam details changed significantly, regenerating schedule...');
      const overridePrefs = {
        daily_max_hours: body.daily_max_hours,
        soft_daily_limit: body.soft_daily_limit,
        adjustment_percentage: body.adjustment_percentage,
        session_duration: body.session_duration,
      };
      const scheduleResult = await regenerateSchedule(user, overridePrefs);
      overloadWarning = scheduleResult.overloadWarning;
      overloadedDays = scheduleResult.overloadedDays || [];
    } else {
      console.log('Only minor details changed (e.g., subject), skipping schedule regeneration.');
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

    // If there are remaining exams, regenerate the schedule natively via AI
    if (remainingExams.length > 0) {
      await regenerateSchedule(user);
    }

    return NextResponse.json({ message: 'Exam deleted and schedule regenerated for remaining exams' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting exam:', error);
    return NextResponse.json({ error: 'Error deleting exam' }, { status: 500 });
  }
}
