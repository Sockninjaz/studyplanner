import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { generateShareToken } from '@/lib/security/shareToken';

export const dynamic = 'force-dynamic';

/**
 * GET /api/share
 * Fetches or lazily initializes the authenticated user's unguessable share token.
 */
export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);

    let userEmail = session?.user?.email;

    // Dev mode fallback if session cookie isn't passed
    if (!userEmail && process.env.NODE_ENV !== 'production') {
      const activeUser = await User.findOne({ email: 'vatchkov@gmail.com' }) || await User.findOne({});
      if (activeUser) userEmail = activeUser.email;
    }

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    let user = await User.findOne({ email: userEmail });
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    let shareToken = user.share_token;
    let shareCreatedAt = user.share_token_created_at;

    // If no share token exists yet, generate one atomically
    if (!shareToken) {
      shareToken = generateShareToken();
      shareCreatedAt = new Date();
      await User.updateOne(
        { _id: user._id },
        { $set: { share_token: shareToken, share_token_created_at: shareCreatedAt } }
      );
    }

    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const shareUrl = `${protocol}://${host}/share/${shareToken}`;

    return NextResponse.json({
      success: true,
      shareToken,
      shareUrl,
      createdAt: shareCreatedAt,
      parentSubscribersCount: user.parent_emails?.length || 0,
    });
  } catch (error: any) {
    console.error('Error fetching share token:', error);
    return NextResponse.json(
      { error: 'Internal error retrieving share link.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/share
 * Regenerates a new unguessable share token, instantly invalidating previous links.
 */
export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);

    let userEmail = session?.user?.email;

    // Dev mode fallback
    if (!userEmail && process.env.NODE_ENV !== 'production') {
      const activeUser = await User.findOne({ email: 'vatchkov@gmail.com' }) || await User.findOne({});
      if (activeUser) userEmail = activeUser.email;
    }

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const newToken = generateShareToken();
    const user = await User.findOneAndUpdate(
      { email: userEmail },
      { $set: { share_token: newToken, share_token_created_at: new Date() } },
      { new: true }
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const shareUrl = `${protocol}://${host}/share/${user.share_token}`;

    return NextResponse.json({
      success: true,
      shareToken: user.share_token,
      shareUrl,
      createdAt: user.share_token_created_at,
      message: 'New secure share link generated. Previous links have been invalidated.',
    });
  } catch (error: any) {
    console.error('Error regenerating share token:', error);
    return NextResponse.json(
      { error: 'Internal error regenerating share link.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/share
 * Revokes public access by clearing the share token.
 */
export async function DELETE(req: NextRequest) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    await User.updateOne({ email: session.user.email }, { $unset: { share_token: 1, share_token_created_at: 1 } });

    return NextResponse.json({
      success: true,
      message: 'Share link successfully revoked.',
    });
  } catch (error: any) {
    console.error('Error revoking share token:', error);
    return NextResponse.json(
      { error: 'Internal error revoking share link.' },
      { status: 500 }
    );
  }
}
