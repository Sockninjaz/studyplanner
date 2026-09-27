import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import { regenerateSchedule } from '@/lib/scheduling/regenerateSchedule';

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  try {
    const user = await User.findOne({ email: session.user.email }).select('+openai_api_key');
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      name: user.name,
      email: user.email,
      daily_study_limit: user.daily_study_limit || 4,
      soft_daily_limit: user.soft_daily_limit || 2,
      adjustment_percentage: user.adjustment_percentage || 25,
      session_duration: user.session_duration || 30,
      enable_daily_limits: user.enable_daily_limits !== false, // default true
      openai_api_key: user.openai_api_key || ''
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
    const { name, email, newPassword, daily_study_limit, soft_daily_limit, adjustment_percentage, session_duration, enable_daily_limits, openai_api_key } = body;

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

    const prevDailyStudyLimit = user.daily_study_limit;
    const prevSoftDailyLimit = user.soft_daily_limit;
    const prevAdjustmentPercentage = user.adjustment_percentage;
    const prevSessionDuration = user.session_duration;
    const prevEnableDailyLimits = user.enable_daily_limits;

    let studyPrefsChanged = false;

    // Update user preferences
    if (daily_study_limit !== undefined) {
      if (prevDailyStudyLimit !== daily_study_limit) studyPrefsChanged = true;
      user.daily_study_limit = daily_study_limit;
    }
    if (soft_daily_limit !== undefined) {
      if (prevSoftDailyLimit !== soft_daily_limit) studyPrefsChanged = true;
      user.soft_daily_limit = soft_daily_limit;
    }
    if (adjustment_percentage !== undefined) {
      if (prevAdjustmentPercentage !== adjustment_percentage) studyPrefsChanged = true;
      user.adjustment_percentage = adjustment_percentage;
    }
    if (session_duration !== undefined) {
      if (prevSessionDuration !== session_duration) studyPrefsChanged = true;
      user.session_duration = session_duration;
    }
    if (enable_daily_limits !== undefined) {
      if (prevEnableDailyLimits !== enable_daily_limits) studyPrefsChanged = true;
      user.enable_daily_limits = enable_daily_limits;
    }
    if (openai_api_key !== undefined) user.openai_api_key = openai_api_key;
    
    if (name) user.name = name;
    if (email) {
      // Check if email is already taken
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser._id.toString() !== user._id.toString()) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
      }
      user.email = email;
    }
    
    if (newPassword && newPassword.length >= 6) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
    }

    await user.save();

    let scheduleRegenerated = false;
    if (studyPrefsChanged || body.regenerateSchedule) {
      try {
        console.log(`Auto-regenerating schedule for user ${user._id} due to preferences update...`);
        const result = await regenerateSchedule(user, {
          daily_max_hours: user.daily_study_limit,
          daily_study_limit: user.daily_study_limit,
          soft_daily_limit: user.soft_daily_limit,
          adjustment_percentage: user.adjustment_percentage,
          session_duration: user.session_duration,
          enable_daily_limits: user.enable_daily_limits,
        }, undefined, 'compress');
        scheduleRegenerated = true;
        console.log('Schedule refreshed on preference update:', result?.message);
      } catch (schedErr) {
        console.error('Error auto-regenerating schedule after preferences update:', schedErr);
      }
    }

    return NextResponse.json({ 
      message: 'Preferences updated successfully',
      scheduleRegenerated
    }, { status: 200 });
  } catch (error) {
    console.error('Error updating user preferences:', error);
    return NextResponse.json({ error: 'Error updating preferences' }, { status: 500 });
  }
}


export async function DELETE(request: Request) {
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

    // Optional: Delete user's exams, study sessions, chat history, etc.
    // For now, we will just delete the user. The DB could have cascading deletes or cleanup jobs.
    await User.deleteOne({ _id: user._id });

    return NextResponse.json({ message: 'Account deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Error deleting account' }, { status: 500 });
  }
}
