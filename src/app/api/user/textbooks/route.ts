import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import User from '@/models/User';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET: Retrieve all remembered textbooks for the current user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const user = await User.findOne({ email: session.user.email }).select('subject_textbooks').lean();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ textbooks: user.subject_textbooks || [] });
  } catch (error: any) {
    console.error('[user/textbooks] GET error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

// PUT: Save or update a textbook for a specific subject
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const subject = (body.subject || '').trim();
    const textbook = (body.textbook || '').trim();

    if (!subject) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    }

    await dbConnect();
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.subject_textbooks) {
      user.subject_textbooks = [];
    }

    const existingIndex = user.subject_textbooks.findIndex(
      (st: any) => st.subject.toLowerCase() === subject.toLowerCase()
    );

    if (textbook) {
      if (existingIndex >= 0) {
        user.subject_textbooks[existingIndex].subject = subject;
        user.subject_textbooks[existingIndex].textbook = textbook;
        user.subject_textbooks[existingIndex].updatedAt = new Date();
      } else {
        user.subject_textbooks.push({
          subject,
          textbook,
          updatedAt: new Date()
        });
      }
    } else {
      // If textbook is empty string, remove it
      if (existingIndex >= 0) {
        user.subject_textbooks.splice(existingIndex, 1);
      }
    }

    await user.save();

    return NextResponse.json({ 
      success: true, 
      textbooks: user.subject_textbooks 
    });
  } catch (error: any) {
    console.error('[user/textbooks] PUT error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

// DELETE: Remove a textbook for a specific subject
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const subject = (searchParams.get('subject') || '').trim();

    if (!subject) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    }

    await dbConnect();
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.subject_textbooks) {
      user.subject_textbooks = user.subject_textbooks.filter(
        (st: any) => st.subject.toLowerCase() !== subject.toLowerCase()
      );
      await user.save();
    }

    return NextResponse.json({ 
      success: true, 
      textbooks: user.subject_textbooks || [] 
    });
  } catch (error: any) {
    console.error('[user/textbooks] DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
