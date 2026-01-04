import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '@/lib/db';
import Exam from '@/models/Exam';
import User from '@/models/User';

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

    const exams = await Exam.find({ user: user._id });
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
    const newExam = new Exam({
      ...body,
      user: user._id,
    });
    await newExam.save();
    return NextResponse.json({ data: newExam }, { status: 201 });
  } catch (error) {
    console.error('Error creating exam:', error);
    return NextResponse.json({ error: 'Error creating exam' }, { status: 500 });
  }
}
