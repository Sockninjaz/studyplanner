import StudySession from '@/models/StudySession';

/**
 * Compresses an in-memory array of session objects (sessionsToSave) so that no date
 * exceeds maxSessionsPerDay.
 *
 * For dates exceeding maxSessionsPerDay:
 * - Keeps the first (maxSessionsPerDay - 1) sessions intact.
 * - Merges the remaining excess sessions into 1 combined session with a combined shortTitle,
 *   combined fullTitle, summed duration, and combined metadata for AI task generation.
 */
export function compressSessionsInMemory(sessionsToSave: any[], maxSessionsPerDay: number): any[] {
  if (sessionsToSave.length === 0) return [];
  const limit = Math.max(1, maxSessionsPerDay || 4);

  // Group by dateStr (YYYY-MM-DD)
  const dateMap = new Map<string, any[]>();
  for (const s of sessionsToSave) {
    const dateStr = new Date(s.startTime).toISOString().split('T')[0];
    if (!dateMap.has(dateStr)) dateMap.set(dateStr, []);
    dateMap.get(dateStr)!.push(s);
  }

  const result: any[] = [];

  for (const [dateStr, daySessions] of Array.from(dateMap.entries())) {
    if (daySessions.length <= limit) {
      result.push(...daySessions);
      continue;
    }

    // Sort by startTime
    daySessions.sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    const keep = daySessions.slice(0, limit - 1);
    const toMerge = daySessions.slice(limit - 1);

    result.push(...keep);

    if (toMerge.length > 0) {
      const extractChapterName = (s: any): string => {
        const raw = s._enrichMeta?.chapter || s.title || '';
        const noPrefix = raw.replace(/^(Study|Review):\s*/i, '').trim();
        return noPrefix.includes(':') ? noPrefix.split(':')[0].trim() : noPrefix;
      };

      const chapterNames = toMerge
        .map(extractChapterName)
        .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);

      const subject = toMerge[0].subject || '';
      const shortTitleParts = chapterNames.slice(0, 2);
      const shortTitle = chapterNames.length > 2
        ? `${shortTitleParts.join(', ')} e.a.`
        : shortTitleParts.join(', ');
      const fullTitle = `Study ${subject}: ${chapterNames.join(', ')}`;

      const totalDurationMs = toMerge.reduce((sum: number, s: any) => sum + (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()), 0);
      const mergedStart = new Date(toMerge[0].startTime);
      const mergedEnd = new Date(mergedStart.getTime() + totalDurationMs);

      const allFormulas = toMerge.flatMap((s: any) => s._enrichMeta?.formulas || []);
      const combinedChapterForAI = chapterNames.join(' & ');

      result.push({
        user: toMerge[0].user,
        exam: toMerge[0].exam,
        title: fullTitle,
        shortTitle: shortTitle,
        subject: subject,
        startTime: mergedStart,
        endTime: mergedEnd,
        isCompleted: false,
        _enrichMeta: {
          chapter: combinedChapterForAI,
          difficulty: 3,
          formulas: allFormulas,
        },
      });
    }
  }

  return result;
}

/**
 * Compresses an overloaded schedule in-place directly in MongoDB.
 */
export async function compressSchedule(
  user: any,
  reschedulableSessions: any[]
): Promise<{ success: boolean; compressedDays: number; message: string }> {
  const maxSessionsPerDay: number = Math.max(1, user.daily_study_limit || 4);

  const sessionsByDate = new Map<string, any[]>();
  for (const session of reschedulableSessions) {
    const dateStr = new Date(session.startTime).toISOString().split('T')[0];
    if (!sessionsByDate.has(dateStr)) sessionsByDate.set(dateStr, []);
    sessionsByDate.get(dateStr)!.push(session);
  }

  let compressedDays = 0;

  for (const [dateStr, daySessions] of Array.from(sessionsByDate.entries())) {
    if (daySessions.length <= maxSessionsPerDay) {
      continue;
    }

    daySessions.sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    const keepSlots = daySessions.slice(0, maxSessionsPerDay - 1);
    const toMerge = daySessions.slice(maxSessionsPerDay - 1);

    if (toMerge.length < 2) continue;

    const extractChapterName = (s: any): string => {
      if (s.shortTitle) return s.shortTitle;
      const raw = s.title || '';
      const noPrefix = raw.replace(/^(Study|Review):\s*/i, '').trim();
      return noPrefix.includes(':') ? noPrefix.split(':')[0].trim() : noPrefix;
    };

    const chapterNames = toMerge
      .map(extractChapterName)
      .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);

    const subject = toMerge[0].subject || '';
    const shortTitleParts = chapterNames.slice(0, 2);
    const shortTitle = chapterNames.length > 2
      ? `${shortTitleParts.join(', ')} e.a.`
      : shortTitleParts.join(', ');

    const fullTitle = `Study ${subject}: ${chapterNames.join(', ')}`;

    const combinedDurationMs = toMerge.reduce((sum: number, s: any) => {
      return sum + (new Date(s.endTime).getTime() - new Date(s.startTime).getTime());
    }, 0);

    const mergedStart = new Date(toMerge[0].startTime);
    const mergedEnd = new Date(mergedStart.getTime() + combinedDurationMs);

    await StudySession.findByIdAndUpdate(toMerge[0]._id, {
      title: fullTitle,
      shortTitle: shortTitle,
      startTime: mergedStart,
      endTime: mergedEnd,
    });

    const idsToDelete = toMerge.slice(1).map((s: any) => s._id);
    if (idsToDelete.length > 0) {
      await StudySession.deleteMany({ _id: { $in: idsToDelete } });
    }

    compressedDays++;
  }

  return {
    success: true,
    compressedDays,
    message: compressedDays > 0
      ? `Compressed ${compressedDays} overloaded day(s).`
      : 'Schedule already fits within your daily limit.',
  };
}
