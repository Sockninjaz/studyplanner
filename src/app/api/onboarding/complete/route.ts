import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/db';
import User from '@/models/User';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { country, countryName, region, regionName, academicTier, academicTierLabel, grade, gradeLabel, examBoard, examBoardLabel } = body;

    if (!country || !academicTier) {
      return NextResponse.json(
        { error: 'Missing required fields: country, academicTier' },
        { status: 400 }
      );
    }

    // Try to persist to DB if the user is authenticated
    const session = await getServerSession();
    if (session?.user?.email) {
      try {
        await dbConnect();
        await User.findOneAndUpdate(
          { email: session.user.email },
          {
            $set: {
              onboardingProfile: {
                country,
                countryName,
                region: region ?? null,
                regionName: regionName ?? null,
                academicTier,
                academicTierLabel,
                grade: grade ?? null,
                gradeLabel: gradeLabel ?? null,
                examBoard: examBoard ?? null,
                examBoardLabel: examBoardLabel ?? null,
                completedAt: new Date(),
              },
            },
          },
          { new: true }
        );
      } catch (dbErr) {
        console.error('[onboarding/complete] DB save error:', dbErr);
        // Non-fatal — token still returned
      }
    }

    // Generate a token the client can store in localStorage
    const tokenParts = [
      country,
      region ?? 'none',
      academicTier,
      grade ?? 'none',
      examBoard ?? 'none',
      Date.now().toString(36),
    ];
    const token = `sp_${tokenParts.join('_')}`;

    return NextResponse.json({ success: true, token });
  } catch (err) {
    console.error('[onboarding/complete] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
