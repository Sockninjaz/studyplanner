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
    const { subject, date, studyMaterials: studyMaterialsData, adjustment_percentage, session_duration, originalFileName, rawMaterialText } = body;

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

    // Estimate tokens (4 chars/token is a safe conservative estimate)
    // 100,000 tokens ≈ 400,000 characters
    const textLength = rawMaterialText?.length || 0;
    const useRag = textLength > 400000;

    const exam = new Exam({
      subject,
      date: new Date(date),
      user: user._id,
      studyMaterials,
      originalFileName: originalFileName || undefined,
      rawMaterialText: rawMaterialText || undefined,
      useRag,
      color,
    });

    await exam.save();

    // If RAG is enabled, trigger embedding in the background
    if (useRag && rawMaterialText) {
      console.log(`[RAG] Material too large (${textLength} chars), enabling RAG and starting background embedding...`);
      // Use dynamic import to avoid bundling it on all requests
      (async () => {
        try {
          const { generateAndStoreChunks } = await import('@/lib/rag/chunk-and-embed');
          await generateAndStoreChunks(rawMaterialText, exam._id.toString(), user._id.toString());
          console.log(`[RAG] Successfully embedded material for exam ${exam._id}`);
        } catch (err) {
          console.error('[RAG] Failed to generate embeddings:', err);
        }
      })();
    }

    // Update the user's saved preferences with latest values
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

    console.log('Starting Unified AI Schedule Regeneration...');
    
    // Call the unified scheduling mechanism to rebuild schedules across exams
    const overridePrefs = {
      daily_max_hours: body.daily_max_hours,
      soft_daily_limit: body.soft_daily_limit,
      adjustment_percentage: body.adjustment_percentage,
      session_duration: body.session_duration,
      enable_daily_limits: body.enable_daily_limits
    };

    const scheduleResult = await regenerateSchedule(user, overridePrefs);

    return NextResponse.json({
      data: {
        exam,
        sessions: scheduleResult.sessionsToSave || [],
        message: `Created exam and ${scheduleResult.sessionsLength || 0} study sessions`,
        overloadWarning: scheduleResult.overloadWarning,
        overloadedDays: scheduleResult.overloadedDays || []
      },
      status: 201
    });
  } catch (error) {
    console.error('Error in POST /api/exams:', error);
    return NextResponse.json({ error: 'Error creating exam' }, { status: 500 });
  }
}
