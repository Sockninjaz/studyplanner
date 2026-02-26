import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '@/lib/db';
import Exam from '@/models/Exam';
import User from '@/models/User';
import StudySession from '@/models/StudySession';
import { StudyPlannerV1 } from '@/lib/scheduling/advancedScheduler';
import { separateSessions } from '@/lib/scheduling/sessionUtils';
import BlockedDay from '@/models/BlockedDay';

export async function POST(request: Request) {
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

        // Get all user exams
        const allExams = await Exam.find({ user: user._id });

        // If there are exams, regenerate the schedule
        if (allExams.length > 0) {
            // Separate historical/future sessions for exams
            const allSessions = await StudySession.find({ user: user._id });
            const { completedSessions, missedSessions, reschedulableSessions, completedHours } = separateSessions(allSessions);

            console.log(`Regenerate request - Completed: ${completedSessions.length}, Missed: ${missedSessions.length}, Reschedulable: ${reschedulableSessions.length}`);

            // Delete reschedulable sessions (future/today) and missed sessions (past uncompleted)
            const sessionsToDelete = [...reschedulableSessions, ...missedSessions];
            if (sessionsToDelete.length > 0) {
                await StudySession.deleteMany({ _id: { $in: sessionsToDelete.map(s => s._id) } });
                console.log(`Deleted ${reschedulableSessions.length} reschedulable and ${missedSessions.length} missed sessions for regeneration`);
            }

            // Re-fetch remaining locked sessions (completed + missed) for deduplication
            const lockedSessions = await StudySession.find({ user: user._id });

            const userInputs: any = {
                daily_max_hours: user.daily_study_limit || 4,
                soft_daily_limit: user.soft_daily_limit || 2,
                adjustment_percentage: user.adjustment_percentage || 25,
                session_duration: user.session_duration || 30,
                enable_daily_limits: user.enable_daily_limits,
                start_date: new Date(),
                existing_sessions: [],
                completed_hours: completedHours,
                exams: allExams.map(e => ({
                    id: e._id.toString(),
                    subject: e.subject,
                    exam_date: e.date,
                    difficulty: e.studyMaterials[0]?.difficulty || 3,
                    confidence: e.studyMaterials[0]?.confidence || 3,
                    user_estimated_total_hours: e.studyMaterials[0]?.user_estimated_total_hours || 5,
                    can_study_after_exam: e.can_study_after_exam,
                })),
            };

            // Fetch blocked days for this user
            const blockedDayDocs = await BlockedDay.find({ user: user._id });
            userInputs.blocked_days = blockedDayDocs.map((bd: any) => bd.date.toISOString().split('T')[0]);

            const scheduler = new StudyPlannerV1(userInputs);
            const result = scheduler.generatePlan();

            let overloadWarning: string | null = null;
            let overloadedDays: { date: string; sessions: number; limit: number }[] = [];

            if (!('error' in result)) {
                let dailySchedules: any[];
                if (Array.isArray(result)) {
                    dailySchedules = result;
                } else {
                    dailySchedules = (result as any).schedule || [];
                }

                const sessionDurationMinutes = userInputs.session_duration;
                const sessionsToSave: any[] = [];
                const maxSessionsPerDay = Math.floor(userInputs.daily_max_hours / (sessionDurationMinutes / 60));
                const dailySessionCounts: { [date: string]: number } = {};

                for (const day of dailySchedules) {
                    const dateStr = day.date.toISOString().split('T')[0];
                    let daySessionCount = 0;
                    for (const subjectId in day.subjects) {
                        const hours = day.subjects[subjectId];
                        const sessionDurationHours = sessionDurationMinutes / 60;
                        const numChunks = Math.ceil(hours / sessionDurationHours);

                        dailySessionCounts[dateStr] = (dailySessionCounts[dateStr] || 0) + numChunks;

                        const examForSubject = allExams.find(e => e._id.toString() === subjectId);
                        if (examForSubject) {
                            // Check how many locked sessions already exist for this subject on this day
                            const lockedForDay = lockedSessions.filter(s =>
                                s.exam.toString() === subjectId &&
                                s.startTime.toISOString().split('T')[0] === dateStr
                            );
                            const sessionsToCreate = Math.max(0, numChunks - lockedForDay.length);

                            for (let i = 0; i < sessionsToCreate; i++) {
                                const sessionStart = new Date(day.date);
                                // Stagger sessions to avoid overlap
                                sessionStart.setHours(9, (daySessionCount + lockedForDay.length) * sessionDurationMinutes, 0, 0);
                                const sessionEnd = new Date(sessionStart.getTime() + sessionDurationMinutes * 60000);

                                sessionsToSave.push({
                                    user: user._id,
                                    exam: examForSubject._id,
                                    title: `Study: ${examForSubject.subject}${numChunks > 1 ? ` (${lockedForDay.length + i + 1}/${numChunks})` : ''}`,
                                    subject: examForSubject.subject,
                                    startTime: sessionStart,
                                    endTime: sessionEnd,
                                    isCompleted: false,
                                });
                                daySessionCount++;
                            }
                        }
                    }
                }

                // Check for overloaded days
                for (const [dateStr, count] of Object.entries(dailySessionCounts)) {
                    if (count > maxSessionsPerDay) {
                        overloadedDays.push({ date: dateStr, sessions: count, limit: maxSessionsPerDay });
                    }
                }
                if (overloadedDays.length > 0) {
                    overloadWarning = `${overloadedDays.length} day(s) exceed your daily session limit.`;
                }

                if (sessionsToSave.length > 0) {
                    await StudySession.insertMany(sessionsToSave);
                    console.log(`Regenerated ${sessionsToSave.length} sessions`);
                }
            }

            return NextResponse.json({
                message: 'Schedule regenerated successfully',
                overloadWarning,
                overloadedDays
            }, { status: 200 });
        }

        return NextResponse.json({ message: 'No exams found to schedule' }, { status: 200 });
    } catch (error) {
        console.error('Error regenerating schedule:', error);
        return NextResponse.json({ error: 'Error regenerating schedule' }, { status: 500 });
    }
}
