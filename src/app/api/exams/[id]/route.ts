import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '@/lib/db';
import Exam from '@/models/Exam';
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
