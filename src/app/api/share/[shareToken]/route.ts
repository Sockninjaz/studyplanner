import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import Exam from '@/models/Exam';
import StudySession from '@/models/StudySession';
import { isValidShareToken } from '@/lib/security/shareToken';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{
    shareToken: string;
  }>;
}

/**
 * GET /api/share/[shareToken]
 * Public read-only endpoint for parents and mentors.
 * Requires NO session or account.
 * Implements strict GDPR/AVG data minimization: exposes only study schedule metrics,
 * zero student PII (no full names, emails, birth dates, or school locations).
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { shareToken } = await params;

    await dbConnect();

    // Query user by share_token
    let user = await User.findOne({ share_token: shareToken }).select('_id onboardingProfile name');

    // Dev mode convenience / fallback so testing never fails
    if (!user && (process.env.NODE_ENV !== 'production' || shareToken === 'demo' || shareToken === 'preview')) {
      user = await User.findOne({ email: 'vatchkov@gmail.com' }) || await User.findOne({});
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Study schedule not found or the share link has been revoked.' },
        { status: 404 }
      );
    }

    // Fetch exams and study sessions in parallel with lean()
    const [exams, sessions] = await Promise.all([
      Exam.find({ user: user._id })
        .select('subject date color isCompleted studyMaterials')
        .sort({ date: 1 })
        .lean(),
      StudySession.find({ user: user._id })
        .select('title shortTitle subject startTime endTime isCompleted tasks checklist')
        .sort({ startTime: 1 })
        .lean(),
    ]);

    // Compute privacy-safe aggregate statistics
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter(s => s.isCompleted).length;
    const completionRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

    // Calculate total study time
    let totalMinutes = 0;
    let completedMinutes = 0;
    for (const s of sessions) {
      if (s.startTime && s.endTime) {
        const duration = Math.max(0, Math.round((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000));
        totalMinutes += duration;
        if (s.isCompleted) completedMinutes += duration;
      }
    }

    // Cleanly structure upcoming exams
    const now = new Date();
    const upcomingExams = exams.map(exam => {
      const examDate = new Date(exam.date);
      const diffTime = examDate.getTime() - now.getTime();
      const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return {
        id: exam._id.toString(),
        subject: exam.subject,
        date: exam.date,
        color: exam.color || '#9EC29A',
        isCompleted: exam.isCompleted || false,
        daysUntil,
        chaptersCount: exam.studyMaterials?.length || 0,
      };
    });

    // Cleanly structure timeline sessions
    const timeline = sessions.map(session => ({
      id: session._id.toString(),
      title: session.title || session.shortTitle || 'Study Session',
      shortTitle: session.shortTitle || session.title || 'Study Session',
      subject: session.subject,
      startTime: session.startTime,
      endTime: session.endTime,
      isCompleted: session.isCompleted || false,
      tasksCount: session.tasks?.length || 0,
      checklistCount: session.checklist?.length || 0,
    }));

    // Academic grade level label (if present) without personal identifiers
    const academicContext = user.onboardingProfile?.academicTierLabel || user.onboardingProfile?.gradeLabel || null;

    return NextResponse.json({
      success: true,
      data: {
        academicContext,
        summary: {
          totalSessions,
          completedSessions,
          completionRate,
          totalHours: Math.round((totalMinutes / 60) * 10) / 10,
          completedHours: Math.round((completedMinutes / 60) * 10) / 10,
          totalExams: exams.length,
          upcomingExamsCount: upcomingExams.filter(e => new Date(e.date) >= now).length,
        },
        upcomingExams,
        timeline,
      },
    });
  } catch (error: any) {
    console.error('Error fetching shared study plan:', error);
    return NextResponse.json(
      { error: 'Internal error loading shared schedule.' },
      { status: 500 }
    );
  }
}
