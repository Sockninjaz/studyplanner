import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '@/lib/db';
import Exam from '@/lib/db/models/exam';

export async function POST(
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
    const exam = await Exam.findOne({
      _id: params.id,
      // @ts-ignore
      userId: session.user.id,
    });

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    exam.studyMaterials.push(body);
    await exam.save();

    return NextResponse.json({ data: exam }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Error adding study material' }, { status: 500 });
  }
}
