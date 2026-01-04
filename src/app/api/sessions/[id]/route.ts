import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '@/lib/db';
import StudySession from '@/lib/db/models/study-session';

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
    const studySession = await StudySession.findOne({
      _id: params.id,
      // @ts-ignore
      userId: session.user.id,
    });

    if (!studySession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ data: studySession }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching session' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  try {
    const body = await request.json();
    const updatedSession = await StudySession.findOneAndUpdate(
      {
        _id: params.id,
        // @ts-ignore
        userId: session.user.id,
      },
      body,
      { new: true }
    );

    if (!updatedSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ data: updatedSession }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Error updating session' }, { status: 500 });
  }
}
