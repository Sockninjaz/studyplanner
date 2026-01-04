import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '@/lib/db';
import Exam from '@/models/Exam';
import User from '@/models/User';

export async function POST(
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
    const exam = await Exam.findOne({
      _id: params.id,
      user: user._id,
    });

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    // Note: This assumes the new Exam model has studyMaterials field
    // You may need to update the Exam model to include this field
    exam.studyMaterials = (exam as any).studyMaterials || [];
    exam.studyMaterials.push(body);
    await exam.save();

    return NextResponse.json({ data: exam }, { status: 200 });
  } catch (error) {
    console.error('Error adding study material:', error);
    return NextResponse.json({ error: 'Error adding study material' }, { status: 500 });
  }
}
