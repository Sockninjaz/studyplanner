import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '@/lib/db';
import StudySession from '@/models/StudySession';
import User from '@/models/User';

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

    const studySession = await StudySession.findOne({
      _id: params.id,
      user: user._id,
    });

    if (!studySession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ data: studySession }, { status: 200 });
  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json({ error: 'Error fetching session' }, { status: 500 });
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
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const updatedSession = await StudySession.findOneAndUpdate(
      {
        _id: params.id,
        user: user._id,
      },
      body,
      { new: true }
    );

    if (!updatedSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ data: updatedSession }, { status: 200 });
  } catch (error) {
    console.error('Error updating session:', error);
    return NextResponse.json({ error: 'Error updating session' }, { status: 500 });
  }
}
