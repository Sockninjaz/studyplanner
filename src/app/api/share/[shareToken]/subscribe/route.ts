import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{
    shareToken: string;
  }>;
}

const SubscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: 'Please enter a valid email address.' }),
});

/**
 * POST /api/share/[shareToken]/subscribe
 * Captures a parent's email address to receive weekly study progress updates.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { shareToken } = await params;

    const body = await req.json().catch(() => ({}));
    const parseResult = SubscribeSchema.safeParse(body);

    if (!parseResult.success) {
      const errorMessage = parseResult.error.errors[0]?.message || 'Invalid email address.';
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const { email } = parseResult.data;

    await dbConnect();

    // Find the student user by shareToken or fallback in dev
    let user: any = await User.findOneAndUpdate(
      { share_token: shareToken },
      { $addToSet: { parent_emails: email } },
      { new: true }
    ).select('_id parent_emails');

    if (!user && process.env.NODE_ENV !== 'production') {
      user = await User.findOneAndUpdate(
        { email: 'vatchkov@gmail.com' },
        { $addToSet: { parent_emails: email } },
        { new: true }
      ).select('_id parent_emails');
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Study schedule not found or the share link has been revoked.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Thank you! You are subscribed to weekly progress updates via email.',
      email,
    });
  } catch (error: any) {
    console.error('Error subscribing parent email:', error);
    return NextResponse.json(
      { error: 'An error occurred while saving your email address.' },
      { status: 500 }
    );
  }
}
