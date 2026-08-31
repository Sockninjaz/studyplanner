import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '@/lib/db';
import ChatSession from '@/models/ChatSession';

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const examId = searchParams.get('examId');
  const sessionId = searchParams.get('sessionId');

  if (!examId) {
    return NextResponse.json({ error: 'examId is required' }, { status: 400 });
  }

  await dbConnect();

  try {
    const chatSession = await ChatSession.findOne({ exam: examId }).sort({ createdAt: -1 });
    let messages = chatSession ? chatSession.messages : [];
    
    // If sessionId is provided, only return messages that belong to this session
    // (We still return the whole chat session if they just query by examId)
    if (sessionId) {
      messages = messages.filter((m: any) => m.studySession && m.studySession.toString() === sessionId);
    }

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return NextResponse.json({ error: 'Failed to fetch chat history' }, { status: 500 });
  }
}
