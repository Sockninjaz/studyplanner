import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '@/lib/db';
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

    console.log('📊 User preferences from DB:', {
      daily_study_limit: user.daily_study_limit,
      soft_daily_limit: user.soft_daily_limit,
      adjustment_percentage: user.adjustment_percentage,
      session_duration: user.session_duration,
      enable_daily_limits: user.enable_daily_limits
    });

    return NextResponse.json({
      daily_study_limit: user.daily_study_limit || 4,
      soft_daily_limit: user.soft_daily_limit || 2,
      adjustment_percentage: user.adjustment_percentage || 25,
      session_duration: user.session_duration || 30,
      enable_daily_limits: user.enable_daily_limits !== false // default true
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    return NextResponse.json({ error: 'Error fetching preferences' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
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
    const { daily_study_limit, soft_daily_limit, adjustment_percentage, session_duration, enable_daily_limits } = body;

    // Validate inputs
    if (daily_study_limit !== undefined && (daily_study_limit < 1 || daily_study_limit > 12)) {
      return NextResponse.json({ error: 'Daily study limit must be between 1 and 12 hours' }, { status: 400 });
    }

    if (soft_daily_limit !== undefined && (soft_daily_limit < 1 || soft_daily_limit > 12)) {
      return NextResponse.json({ error: 'Preferred study time must be between 1 and 12 hours' }, { status: 400 });
    }

    if (soft_daily_limit !== undefined && daily_study_limit !== undefined && soft_daily_limit > daily_study_limit) {
      return NextResponse.json({ error: 'Preferred study time cannot exceed absolute maximum limit' }, { status: 400 });
    }

    if (adjustment_percentage !== undefined && (adjustment_percentage < 0 || adjustment_percentage > 25)) {
      return NextResponse.json({ error: 'Adjustment percentage must be between 0 and 25' }, { status: 400 });
    }

    if (session_duration !== undefined && (session_duration < 15 || session_duration > 120)) {
      return NextResponse.json({ error: 'Session duration must be between 15 and 120 minutes' }, { status: 400 });
    }

    // Update user preferences
    if (daily_study_limit !== undefined) {
      user.daily_study_limit = daily_study_limit;
    }
    if (soft_daily_limit !== undefined) {
      user.soft_daily_limit = soft_daily_limit;
    }
    if (adjustment_percentage !== undefined) {
      user.adjustment_percentage = adjustment_percentage;
    }
    if (session_duration !== undefined) {
      user.session_duration = session_duration;
    }
    if (enable_daily_limits !== undefined) {
      user.enable_daily_limits = enable_daily_limits;
    }

    await user.save();

    return NextResponse.json({
      message: 'Preferences updated successfully',
      daily_study_limit: user.daily_study_limit,
      soft_daily_limit: user.soft_daily_limit,
      adjustment_percentage: user.adjustment_percentage,
      session_duration: user.session_duration,
      enable_daily_limits: user.enable_daily_limits
    }, { status: 200 });
  } catch (error) {
    console.error('Error updating user preferences:', error);
    return NextResponse.json({ error: 'Error updating preferences' }, { status: 500 });
  }
}
