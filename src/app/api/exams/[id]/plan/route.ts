import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '@/lib/db';
import Exam from '@/lib/db/models/exam';
import StudySession from '@/lib/db/models/study-session';

// This function is a placeholder for a more complex scheduling algorithm
function createSessionSchedule(materials: any[], examDate: Date) {
  const sessions = [];
  let currentDate = new Date();
  currentDate.setDate(currentDate.getDate() + 1); // Start planning from tomorrow

  for (const material of materials) {
    const sessionTime = calculateSessionTime(material);
    const numSessions = Math.ceil(sessionTime / 60); // Assuming 60-minute sessions for simplicity

    for (let i = 0; i < numSessions; i++) {
      if (currentDate >= examDate) break;

      sessions.push({
        title: `${material.chapter} - Part ${i + 1}`,
        material: material.chapter,
        scheduledDate: new Date(currentDate),
        duration: 60, // 60-minute session
      });

      // Schedule the next session for the next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  return sessions;
}

function calculateSessionTime(material: any) {
  const difficultyWeight = material.difficulty * 0.6;
  const confidenceGap = (5 - material.confidence) * 0.4;
  const complexityMultiplier = 1 + (difficultyWeight + confidenceGap) / 10;

  return material.estimatedHours * 60 * complexityMultiplier; // in minutes
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  try {
    const exam = await Exam.findOne({
      _id: params.id,
      // @ts-ignore
      userId: session.user.id,
    });

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    const prioritizedMaterials = [...exam.studyMaterials].sort((a, b) => {
      const scoreA = a.difficulty + (5 - a.confidence);
      const scoreB = b.difficulty + (5 - b.confidence);
      return scoreB - scoreA;
    });

    const plan = createSessionSchedule(prioritizedMaterials, exam.date);

    // Clear existing plan for this exam
    // @ts-ignore
    await StudySession.deleteMany({ userId: session.user.id, examId: params.id });

    // Save new plan
    const sessionsToSave = plan.map(p => ({
      ...p,
      // @ts-ignore
      userId: session.user.id,
      examId: params.id,
    }));

    const savedSessions = await StudySession.insertMany(sessionsToSave);

    return NextResponse.json({ data: savedSessions }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Error generating plan' }, { status: 500 });
  }
}
