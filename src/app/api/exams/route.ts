import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '@/lib/db';
import Exam from '@/models/Exam';
import User from '@/models/User';
import StudySession from '@/models/StudySession';
import { AdvancedScheduler } from '@/lib/scheduling/advancedScheduler';

// Planning algorithm from PROJECT_PLAN.md
function calculateSessionTime(material: any) {
  const difficultyWeight = material.difficulty * 0.6;
  const confidenceGap = (5 - material.confidence) * 0.4;
  const complexityMultiplier = 1 + (difficultyWeight + confidenceGap) / 10;
  
  return material.estimatedHours * 60 * complexityMultiplier; // in minutes
}

function createSessionSchedule(materials: any[], examDate: Date) {
  const sessions = [];
  let currentDate = new Date();
  currentDate.setDate(currentDate.getDate() + 1); // Start planning from tomorrow

  for (const material of materials) {
    const sessionTime = calculateSessionTime(material);
    const numSessions = Math.ceil(sessionTime / 60); // Assuming 60-minute sessions for simplicity

    // Parse material topics (e.g., "chapter 3-5, photosynthesis, hand-out")
    const topics = material.chapter.split(',').map((t: string) => t.trim());
    
    for (let i = 0; i < numSessions; i++) {
      if (currentDate >= examDate) break;

      // Distribute topics across sessions
      const topicIndex = i % topics.length;
      const sessionTopic = topics[topicIndex];
      
      // Create checklist items for this session
      const checklist = topics.map((topic: string) => ({
        task: topic,
        completed: false
      }));

      sessions.push({
        title: `Study: ${sessionTopic}`,
        subject: sessionTopic,
        startTime: new Date(currentDate),
        endTime: new Date(currentDate.getTime() + 60 * 60000), // 60 minutes later
        isCompleted: false,
        checklist: checklist,
      });

      // Schedule the next session for the next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  return sessions;
}

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
    console.log('Received request body:', JSON.stringify(body, null, 2));
    
    const { subject, date, studyMaterials: studyMaterialsData } = body;

    if (!subject || !date || !studyMaterialsData || studyMaterialsData.length === 0) {
      return NextResponse.json(
        { error: 'Subject, date, and at least one study material are required' },
        { status: 400 }
      );
    }

    // Convert study materials to proper format
    const studyMaterials = studyMaterialsData.map((material: any, index: number) => {
      console.log(`Material ${index}:`, material);
      
      return {
        chapter: material.chapter,
        difficulty: parseInt(material.difficulty.toString()),
        confidence: parseInt(material.confidence.toString()),
        completed: false,
        // Note: estimatedHours is no longer needed - algorithm calculates it
      };
    });

    // Create exam
    const exam = new Exam({
      subject,
      date: new Date(date),
      user: user._id,
      studyMaterials,
    });
    
    console.log('About to save exam:', JSON.stringify(exam, null, 2));
    
    await exam.save();
    console.log('Exam saved successfully!');

    // Use advanced scheduler to create balanced study sessions
    console.log('Starting advanced scheduler...');
    let sessionsToSave: any[] = [];
    try {
      // Get user's preferred daily intensity (from request body or default to 3)
      const userMaxSessionsPerDay = body.maxSessionsPerDay || 3;
      console.log(`User max sessions per day: ${userMaxSessionsPerDay}`);
      
      const scheduler = new AdvancedScheduler(userMaxSessionsPerDay);
      
      // Get all existing exams for this user
      console.log('Fetching existing exams...');
      const existingExams = await Exam.find({ user: user._id, _id: { $ne: exam._id } });
      console.log(`Found ${existingExams.length} existing exams`);
      
      // Get existing sessions for this user
      console.log('Fetching existing sessions...');
      const existingSessions = await StudySession.find({ user: user._id });
      console.log(`Found ${existingSessions.length} existing sessions`);
      
      // Create balanced schedule considering all exams
      console.log('Creating balanced schedule...');
      const studySessions = await scheduler.scheduleStudySessions(
        exam,
        existingExams,
        existingSessions
      );
      console.log(`Scheduler returned ${studySessions.length} sessions`);

      // Save study sessions
      sessionsToSave = studySessions.map(session => ({
        ...session,
        user: user._id,
        exam: exam._id,
      }));

      await StudySession.insertMany(sessionsToSave);
      console.log('Study sessions saved successfully!');
      
      // Trigger calendar refresh event
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('calendarUpdated', { 
          detail: { examId: exam._id, sessionsCount: sessionsToSave.length }
        });
        window.dispatchEvent(event);
      }
    } catch (schedulerError) {
      console.error('Scheduler error:', schedulerError);
      console.log('Exam created but study sessions failed. Continuing without sessions...');
    }

    return NextResponse.json({ 
      data: { 
        exam, 
        sessions: sessionsToSave,
        message: `Created exam with ${sessionsToSave.length} study sessions`
      }, 
      status: 201 
    });
  } catch (error) {
    console.error('Error creating exam:', error);
    return NextResponse.json({ error: 'Error creating exam' }, { status: 500 });
  }
}
