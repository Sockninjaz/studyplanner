import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Exam from '@/models/Exam';
import User from '@/models/User';
import StudySession from '@/models/StudySession';
import { regenerateSchedule } from '@/lib/scheduling/regenerateSchedule';
import { separateSessions } from '@/lib/scheduling/sessionUtils';
import BlockedDay from '@/models/BlockedDay';
import { isValidCalendarDate } from '@/lib/dateUtils';
import { stripPromptArtifacts } from '@/lib/ai/prompts';
import { resolveStudyLanguage, getStudySessionPrefix } from '@/lib/i18n/resolveStudyLanguage';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
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
      _id: id,
      user: user._id,
    });

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    // Self-heal contaminated rawMaterialText and userInputNotes if prompt artifacts are present
    let needsSave = false;
    if (exam.rawMaterialText) {
      const sanitized = stripPromptArtifacts(exam.rawMaterialText);
      if (sanitized !== exam.rawMaterialText) {
        exam.rawMaterialText = sanitized;
        needsSave = true;
        console.log(`[GET /api/exams/${id}] Self-healed contaminated rawMaterialText`);
      }
    }
    if (exam.userInputNotes) {
      const sanitizedNotes = stripPromptArtifacts(exam.userInputNotes);
      if (sanitizedNotes !== exam.userInputNotes) {
        exam.userInputNotes = sanitizedNotes;
        needsSave = true;
      }
    }
    if (needsSave) {
      exam.markModified('rawMaterialText');
      exam.markModified('userInputNotes');
      await exam.save();
    }

    return NextResponse.json({ data: exam }, { status: 200 });
  } catch (error) {
    console.error('Error fetching exam:', error);
    return NextResponse.json({ error: 'Error fetching exam' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
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

    const exam = await Exam.findOne({ _id: id, user: user._id });
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
    const subjectChanged = Boolean(body.subject && exam.subject !== body.subject);

    // Update exam fields
    if (subjectChanged) {
      exam.subject = body.subject;
    }

    if (body.isCompleted !== undefined) {
      exam.isCompleted = body.isCompleted;
      if (body.isCompleted === true) {
        exam.completedAt = new Date();
        await StudySession.updateMany(
          { user: user._id, exam: exam._id },
          { $set: { isCompleted: true } }
        );
      } else {
        exam.completedAt = undefined;
        // When uncompleting an exam, uncomplete all of its sessions so the user can study again
        await StudySession.updateMany(
          { user: user._id, exam: exam._id },
          { $set: { isCompleted: false } }
        );
      }
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
        difficulty: m.difficulty ? parseInt(m.difficulty.toString()) : 3,
        confidence: m.confidence ? parseInt(m.confidence.toString()) : 3,
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
      const sanitizedRaw = stripPromptArtifacts(body.rawMaterialText);
      if (exam.rawMaterialText !== sanitizedRaw) {
        requiresRegeneration = true;
      }
      exam.rawMaterialText = sanitizedRaw;
      const textLength = sanitizedRaw.length;
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

    if (body.userInputNotes !== undefined) {
      exam.userInputNotes = stripPromptArtifacts(body.userInputNotes);
    }

    if (body.studyMaterials && requiresRegeneration) {
      // Clean up orphaned completed sessions whose topics no longer exist in the new materials
      const completedSessions = await StudySession.find({ user: user._id, exam: exam._id, isCompleted: true });
      const validChapters = exam.studyMaterials.map((m: any) => m.chapter.toLowerCase());
      
      const sessionsToDelete = [];
      for (const s of completedSessions) {
        const titleLower = s.title.toLowerCase();
        // If the session title doesn't match any of the valid chapters, it's an orphan
        const matches = validChapters.some((ch: string) => titleLower.includes(ch) || ch.includes(titleLower.replace(/^(study|studeren|lernen|étudier|estudiar):\s*/i, '').replace(/^(.*?)\s*-\s*/, '').trim()));
        
        // Also keep generic review sessions
        if (!matches && !titleLower.includes('review') && !titleLower.includes('herhaling')) {
          sessionsToDelete.push(s._id);
        }
      }
      
      if (sessionsToDelete.length > 0) {
        await StudySession.deleteMany({ _id: { $in: sessionsToDelete } });
        console.log(`Deleted ${sessionsToDelete.length} orphaned completed sessions after material update.`);
      }
    }

    await exam.save();
    console.log('Updated exam:', exam._id);

    // If subject changed, update subject/title on ALL existing sessions for this exam in a single atomic bulkWrite
    if (subjectChanged) {
      await StudySession.updateMany(
        { user: user._id, exam: exam._id },
        { $set: { subject: body.subject } }
      );
      // Also update titles to reflect new name
      const sessionsToRename = await StudySession.find({ user: user._id, exam: exam._id }, '_id title').lean();
      if (sessionsToRename.length > 0) {
        const examLang = resolveStudyLanguage(user.onboardingProfile, `${body.subject} ${exam.studyMaterials?.map((m: any) => m.chapter).join(' ')}`);
        const prefix = getStudySessionPrefix(examLang);
        const bulkOps = sessionsToRename.map(s => ({
          updateOne: {
            filter: { _id: s._id },
            update: {
              $set: {
                title: s.title.replace(/^(Study|Studeren|Lernen|Étudier|Estudiar): .+?($| \()/, `${prefix}: ${body.subject}$2`)
              }
            }
          }
        }));
        await StudySession.bulkWrite(bulkOps);
      }
      console.log(`Updated subject name on ${sessionsToRename.length} sessions via bulkWrite`);
    }

    // Unified AI Schedule Regeneration
    let overloadWarning = null;
    let overloadedDays: any[] = [];

    if (requiresRegeneration) {
      console.log('Exam details changed significantly, checking schedule overload...');
      const overridePrefs = {
        daily_max_hours: body.daily_max_hours,
        soft_daily_limit: body.soft_daily_limit,
        adjustment_percentage: body.adjustment_percentage,
        session_duration: body.session_duration,
      };

      // Single-pass schedule regeneration: checks overload first and saves immediately in one run without AI
      const scheduleResult = await regenerateSchedule(
        user, 
        overridePrefs, 
        exam._id.toString(), 
        'compress', 
        { skipAiEnrichment: true, checkOverload: true }
      );

      if (scheduleResult.requiresDecision) {
        return NextResponse.json({
          data: {
            exam,
            requiresDecision: true,
            overloadedDays: scheduleResult.overloadedDays
          }
        }, { status: 200 });
      }

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
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  try {
    console.log('Attempting to delete exam:', id);

    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      console.log('User not found for email:', session.user.email);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('Found user:', user._id);

    const exam = await Exam.findOne({
      _id: id,
      user: user._id,
    });

    if (!exam) {
      console.log('Exam not found for id:', id, 'and user:', user._id);
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

    // If there are remaining exams, regenerate the schedule natively without AI.
    // If there are 0 remaining exams, this will still run and cleanly wipe out any ghost sessions.
    await regenerateSchedule(user, {}, undefined, undefined, { skipAiEnrichment: true });

    return NextResponse.json({ message: 'Exam deleted and schedule regenerated for remaining exams' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting exam:', error);
    return NextResponse.json({ error: 'Error deleting exam' }, { status: 500 });
  }
}
