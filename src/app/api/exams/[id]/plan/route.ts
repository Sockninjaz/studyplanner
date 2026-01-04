import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '@/lib/db';
import Exam from '@/models/Exam';
import StudySession from '@/models/StudySession';
import User from '@/models/User';

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
        subject: material.chapter,
        startTime: new Date(currentDate),
        endTime: new Date(currentDate.getTime() + 60 * 60000), // 60 minutes later
        isCompleted: false,
        checklist: [],
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

    // Note: This assumes the new Exam model has studyMaterials field
    const studyMaterials = (exam as any).studyMaterials || [];
    const prioritizedMaterials = [...studyMaterials].sort((a, b) => {
      const scoreA = a.difficulty + (5 - a.confidence);
      const scoreB = b.difficulty + (5 - b.confidence);
      return scoreB - scoreA;
    });

    const plan = createSessionSchedule(prioritizedMaterials, exam.date);

    // Clear existing plan for this exam
    await StudySession.deleteMany({ user: user._id, exam: exam._id });

    // Save new plan
    const sessionsToSave = plan.map(p => ({
      ...p,
      user: user._id,
      exam: exam._id,
    }));

    const savedSessions = await StudySession.insertMany(sessionsToSave);

    return NextResponse.json({ data: savedSessions }, { status: 200 });
  } catch (error) {
    console.error('Error generating plan:', error);
    return NextResponse.json({ error: 'Error generating plan' }, { status: 500 });
  }
}
