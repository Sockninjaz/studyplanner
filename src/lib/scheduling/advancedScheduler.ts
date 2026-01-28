// V1 Study Planner Algorithm
console.log('=== SCHEDULER FILE LOADED ===');

// §1. User Inputs
interface ExamData {
  id: string;
  subject: string;
  exam_date: Date;
  difficulty: number; // 1-5
  confidence: number; // 1-5
  user_estimated_total_hours: number;
  can_study_after_exam: boolean; // Default: true
}

interface ExistingSession {
  date: Date;
  subjectId: string;
  duration: number; // in hours
}

interface UserInputs {
  daily_max_hours: number;
  adjustment_percentage: number; // Max percentage adjustment for difficulty/confidence
  session_duration: number; // Duration of each study session in minutes
  start_date: Date;
  exams: ExamData[];
  existing_sessions?: ExistingSession[];
}

// §2. Internal State
interface InternalSubjectState {
  id: string;
  subject: string;
  exam_date: Date;
  remaining_hours: number;
  days_to_exam: number;
  last_study_day: Date | null;
  state: 'ACTIVE' | 'DONE';
  original_difficulty: number;
  original_confidence: number;
}

interface DailySchedule {
  date: Date;
  total_hours: number;
  subjects: { [subjectId: string]: number };
  is_overloaded?: boolean; // New field to indicate overload
  overload_amount?: number; // How much over the daily limit
}

interface ScheduleResult {
  schedule: DailySchedule[];
  overload_info?: {
    total_overload_hours: number;
    overloaded_days: number;
    message: string;
  };
}

export class StudyPlannerV1 {
  private inputs: UserInputs;
  private subjects: InternalSubjectState[];
  private schedule: DailySchedule[] = [];
  private preliminarySchedules: Map<string, Map<string, number>> = new Map();

  constructor(inputs: UserInputs) {
    console.log('=== SCHEDULER CONSTRUCTOR CALLED ===');
    console.log('Number of exams:', inputs.exams.length);
    console.log('Number of existing sessions:', inputs.existing_sessions?.length || 0);
    console.log('Existing sessions:', inputs.existing_sessions?.map(s => ({ subject: s.subjectId, date: s.date })) || []);
    this.inputs = inputs;
    this.subjects = this.initializeInternalState(inputs.exams);
  }

  private getExistingHoursForDate(date: Date): number {
    if (!this.inputs.existing_sessions) return 0;
    
    const dateStr = date.toISOString().split('T')[0];
    const totalHours = this.inputs.existing_sessions
      .filter(session => session.date.toISOString().split('T')[0] === dateStr)
      .reduce((total, session) => total + session.duration, 0);
    
    return totalHours;
  }

  private generateValidSlotsForExam(exam: ExamData): Date[] {
    const validSlots: Date[] = [];
    
    // Parse exam date as UTC to avoid timezone shifts
    const examDateStr = exam.exam_date.toISOString().split('T')[0];
    const examDateUTC = new Date(examDateStr + 'T00:00:00.000Z');
    
    // Get current date in local timezone, then convert to UTC date string
    const now = new Date();
    const nowLocalStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const nowUTC = new Date(nowLocalStr + 'T00:00:00.000Z');
    
    console.log(`  Current date: ${nowLocalStr}, nowUTC: ${nowUTC.toISOString()}`);
    
    const inputStartStr = this.inputs.start_date.toISOString().split('T')[0];
    const inputStartUTC = new Date(inputStartStr + 'T00:00:00.000Z');
    const startDateUTC = nowUTC > inputStartUTC ? nowUTC : inputStartUTC;
    
    console.log(`  Input start: ${inputStartStr}, Using start date: ${startDateUTC.toISOString().split('T')[0]}`);
    
    // Determine the last valid study day
    let lastValidDay: Date;
    if (exam.can_study_after_exam) {
      lastValidDay = new Date(examDateUTC); // Include exam day
    } else {
      lastValidDay = new Date(examDateUTC.getTime() - 24 * 60 * 60 * 1000); // Day before exam
    }
    
    // Generate all valid days from start to last valid day (all in UTC)
    for (let d = new Date(startDateUTC); d <= lastValidDay; d.setUTCDate(d.getUTCDate() + 1)) {
      validSlots.push(new Date(d));
    }
    
    return validSlots;
  }

  public getValidSlotsForAllExams(): { [examName: string]: string[] } {
    const result: { [examName: string]: string[] } = {};
    
    for (const exam of this.inputs.exams) {
      const validSlots = this.generateValidSlotsForExam(exam);
      result[exam.subject] = validSlots.map(date => date.toISOString().split('T')[0]);
    }
    
    return result;
  }

  private assignSessionsEvenly(exam: ExamData, validSlots: Date[]): Map<string, number> {
    console.log(`\n*** assignSessionsEvenly called for ${exam.subject} ***`);
    const STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
    const totalHours = this.calculateTotalHours(exam);
    const totalSessions = Math.ceil(totalHours / STUDY_CHUNK_HOURS);
    
    console.log(`=== ASSIGNING SESSIONS FOR ${exam.subject} ===`);
    console.log(`Total hours: ${totalHours}, Total sessions: ${totalSessions}`);
    console.log(`Session duration: ${this.inputs.session_duration} minutes = ${STUDY_CHUNK_HOURS} hours`);
    console.log(`Valid slots:`, validSlots.length, 'days:', validSlots.map(d => d.toISOString().split('T')[0]));
    
    const sessionMap = new Map<string, number>();
    
    if (validSlots.length === 0 || totalSessions === 0) {
      console.log('No valid slots or sessions needed');
      return sessionMap;
    }
    
    const sortedSlots = [...validSlots].sort((a, b) => a.getTime() - b.getTime());
    // Parse exam date as UTC to avoid timezone shifts
    const examDateStr = exam.exam_date.toISOString().split('T')[0];
    const examDateUTC = new Date(examDateStr + 'T00:00:00.000Z');
    const dayBeforeExam = new Date(examDateUTC.getTime() - 24 * 60 * 60 * 1000);
    
    // Ensure final review session the day before exam (handled separately)
    const dayBeforeExamStr = dayBeforeExam.toISOString().split('T')[0];
    
    let hasFinalReview = false;
    if (sortedSlots.some(slot => slot.toISOString().split('T')[0] === dayBeforeExamStr)) {
      sessionMap.set(dayBeforeExamStr, 1);
      hasFinalReview = true;
    }
    
    // Calculate remaining sessions and available days
    const remainingSessions = totalSessions - 1; // Subtract the final review session
    const availableDays = sortedSlots.filter(slot => 
      slot.toISOString().split('T')[0] !== dayBeforeExamStr
    );
    
    if (remainingSessions > 0 && availableDays.length > 0) {
      // Calculate optimal distribution allowing multiple sessions per day for even workload
      const maxSessionsPerDay = Math.floor(this.inputs.daily_max_hours / STUDY_CHUNK_HOURS);
      
      // Strategy 1: Try to distribute with 1 session per day and 3-day max gap
      const maxGapDays = 2; // 2 empty days = 3-day gap total
      
      // Calculate the ideal gap to distribute sessions evenly
      let idealGap;
      if (availableDays.length >= remainingSessions * 3) {
        // Lots of time available, prioritize even distribution over gap rules
        // Use smaller gaps to utilize more days
        idealGap = Math.floor((availableDays.length - remainingSessions) / Math.max(1, remainingSessions - 1));
        idealGap = Math.min(maxGapDays, Math.max(0, idealGap));
      } else {
        // Limited time, calculate optimal gap
        idealGap = Math.floor((availableDays.length - remainingSessions) / Math.max(1, remainingSessions - 1));
        idealGap = Math.min(maxGapDays, Math.max(0, idealGap));
      }
      
      // Work backwards from exam date with max 2-day interval between sessions
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const MAX_INTERVAL_DAYS = 2; // Max 2 days between sessions of the same exam
      
      console.log(`  Available days:`, availableDays.map(d => d.toISOString().split('T')[0]));
      console.log(`  Need to place ${remainingSessions} sessions with max ${MAX_INTERVAL_DAYS}-day interval`);
      
      // Check if there are existing sessions for this exam
      let existingSessionDates: string[] = [];
      const hasMultipleExams = this.inputs.exams.length > 1;
      
      if (this.inputs.existing_sessions && !hasMultipleExams) {
        // Only reuse existing sessions if this is a single exam
        // For multiple exams, always reschedule to apply diversification
        const availableDatesSet = new Set(availableDays.map(d => d.toISOString().split('T')[0]));
        
        existingSessionDates = this.inputs.existing_sessions
          .filter(s => s.subjectId === exam.id)
          .map(s => s.date.toISOString().split('T')[0])
          .filter(dateStr => availableDatesSet.has(dateStr));
      }
      
      if (hasMultipleExams) {
        console.log(`  Multiple exams detected - applying diversification (not reusing existing sessions)`);
      } else {
        console.log(`  Existing session dates for ${exam.subject}:`, existingSessionDates);
      }
      
      let sessionCount = 0;
      
      // Only reuse existing sessions for single exam scenarios
      if (existingSessionDates.length > 0 && !hasMultipleExams) {
        console.log(`  Reusing ${existingSessionDates.length} existing session dates`);
        
        for (const existingDate of existingSessionDates) {
          if (sessionCount >= remainingSessions) break;
          
          sessionMap.set(existingDate, 1);
          sessionCount++;
          console.log(`  ✓ Placed session ${sessionCount}/${remainingSessions} on ${existingDate} (existing session)`);
        }
      }
      
      // Distribute sessions with diversification (spread across days, not all consecutive)
      if (sessionCount < remainingSessions) {
        const sessionsToPlace = remainingSessions - sessionCount;
        console.log(`  Need to place ${sessionsToPlace} sessions (remaining: ${remainingSessions}, already placed: ${sessionCount})`);
        console.log(`  Total sessions should be: ${totalSessions} (including final review: ${hasFinalReview})`);
        console.log(`  Available days count: ${availableDays.length}, Sessions to place: ${sessionsToPlace}`);
        console.log(`  Distributing ${sessionsToPlace} sessions with diversification (max ${MAX_INTERVAL_DAYS}-day interval)`);
        
        const unassignedDays = availableDays.filter(d => !sessionMap.has(d.toISOString().split('T')[0]));
        
        if (unassignedDays.length === 0) {
          console.log(`  No more available days`);
        } else {
          // Sort unassigned days chronologically
          unassignedDays.sort((a, b) => a.getTime() - b.getTime());
          
          console.log(`  Available unassigned days:`, unassignedDays.map(d => d.toISOString().split('T')[0]));
          
          // Get which days other exams are using
          const otherExamDays = new Set<string>();
          const prelimSchedules = this.preliminarySchedules;
          prelimSchedules.forEach((schedule, examId) => {
            if (examId !== exam.id) {
              schedule.forEach((sessions, dateStr) => {
                otherExamDays.add(dateStr);
              });
            }
          });
          
          console.log(`  Days used by other exams:`, Array.from(otherExamDays));
          
          // Strategy: Prefer days NOT used by other exams, max 2 consecutive sessions
          const selectedDays: Date[] = [];
          let consecutiveCount = 0;
          let lastSelectedDate: Date | null = null;
          
          // Work backwards from the latest available day
          const reversedDays = [...unassignedDays].reverse();
          
          for (const day of reversedDays) {
            if (selectedDays.length >= sessionsToPlace) {
              console.log(`  Stopping: selected ${selectedDays.length} days, need ${sessionsToPlace} sessions`);
              break;
            }
            
            const dateStr = day.toISOString().split('T')[0];
            const isUsedByOther = otherExamDays.has(dateStr);
            
            if (lastSelectedDate === null) {
              // First session: prefer day NOT used by other exams
              if (!isUsedByOther || selectedDays.length === 0) {
                selectedDays.push(day);
                lastSelectedDate = day;
                consecutiveCount = 1;
                console.log(`  Selected ${dateStr} (first session, used by other: ${isUsedByOther})`);
              }
            } else {
              // Calculate gap from last selected date
              const daysDiff = Math.floor((lastSelectedDate.getTime() - day.getTime()) / (24 * 60 * 60 * 1000));
              const isConsecutive = daysDiff === 1;
              
              // Rule: Max 2 consecutive sessions
              if (isConsecutive && consecutiveCount >= 2) {
                console.log(`  Skipping ${dateStr} (would be 3rd consecutive session)`);
                continue;
              }
              
              // Respect max interval
              if (daysDiff <= MAX_INTERVAL_DAYS + 1) {
                const daysRemaining = reversedDays.filter(d => d < day).length;
                const sessionsRemaining = sessionsToPlace - selectedDays.length - 1;
                
                // Skip if used by other exam and we have alternatives
                if (isUsedByOther && daysRemaining >= sessionsRemaining * 1.5) {
                  console.log(`  Skipping ${dateStr} (used by other exam, ${daysRemaining} days left)`);
                  continue;
                }
                
                selectedDays.push(day);
                lastSelectedDate = day;
                consecutiveCount = isConsecutive ? consecutiveCount + 1 : 1;
                console.log(`  Selected ${dateStr} (${daysDiff} days from last, consecutive: ${consecutiveCount}, used by other: ${isUsedByOther})`);
              } else {
                console.log(`  Skipping ${dateStr} (would violate max interval: ${daysDiff} days)`);
              }
            }
          }
          
          // If we didn't get enough sessions, fill in the gaps
          if (selectedDays.length < sessionsToPlace) {
            console.log(`  Only selected ${selectedDays.length}/${sessionsToPlace} sessions, filling gaps...`);
            
            for (const day of reversedDays) {
              if (selectedDays.length >= sessionsToPlace) break;
              
              const dateStr = day.toISOString().split('T')[0];
              if (!selectedDays.some(d => d.toISOString().split('T')[0] === dateStr)) {
                selectedDays.push(day);
                console.log(`  Added ${dateStr} to fill gap`);
              }
            }
          }
          
          // Place sessions on selected days
          selectedDays.sort((a, b) => a.getTime() - b.getTime()); // Sort chronologically
          
          console.log(`  Placing ${selectedDays.length} selected days, need ${sessionsToPlace} sessions`);
          
          // If we don't have enough days, we need to place multiple sessions per day
          const maxSessionsPerDay = Math.floor(this.inputs.daily_max_hours / STUDY_CHUNK_HOURS);
          
          if (selectedDays.length < sessionsToPlace) {
            console.log(`  ⚠️  Not enough days (${selectedDays.length}) for sessions (${sessionsToPlace})`);
            console.log(`  Will place multiple sessions per day (max ${maxSessionsPerDay} per day)`);
            
            // Distribute sessions evenly across available days
            let remainingToPlace = sessionsToPlace;
            for (let i = 0; i < selectedDays.length && remainingToPlace > 0; i++) {
              const day = selectedDays[i];
              const dateStr = day.toISOString().split('T')[0];
              
              // Calculate how many sessions to place on this day
              const daysLeft = selectedDays.length - i;
              const sessionsForThisDay = Math.min(
                maxSessionsPerDay,
                Math.ceil(remainingToPlace / daysLeft)
              );
              
              const currentSessions = sessionMap.get(dateStr) || 0;
              const sessionsToAdd = Math.min(sessionsForThisDay, maxSessionsPerDay - currentSessions);
              
              if (sessionsToAdd > 0) {
                sessionMap.set(dateStr, currentSessions + sessionsToAdd);
                sessionCount += sessionsToAdd;
                remainingToPlace -= sessionsToAdd;
                console.log(`  ✓ Placed ${sessionsToAdd} session(s) on ${dateStr} (total: ${currentSessions + sessionsToAdd}, remaining: ${remainingToPlace})`);
              }
            }
          } else {
            // Normal case: enough days for 1 session per day
            for (const day of selectedDays) {
              if (sessionCount >= remainingSessions) {
                console.log(`  Stopping: already placed ${sessionCount}/${remainingSessions} sessions`);
                break;
              }
              
              const dateStr = day.toISOString().split('T')[0];
              if (sessionMap.has(dateStr)) {
                console.log(`  Skipping ${dateStr} - already has a session`);
                continue;
              }
              
              sessionMap.set(dateStr, 1);
              sessionCount++;
              console.log(`  ✓ Placed session ${sessionCount}/${remainingSessions} on ${dateStr}`);
            }
          }
        }
      }
      
      // Check for max interval violations and fix by moving first session
      const allDates = Array.from(sessionMap.keys()).sort();
      console.log(`  Checking for max ${MAX_INTERVAL_DAYS}-day interval violations...`);
      
      let hasViolation = false;
      for (let i = 1; i < allDates.length; i++) {
        const prevDate = new Date(allDates[i - 1]);
        const currDate = new Date(allDates[i]);
        const gap = Math.floor((currDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000)) - 1;
        
        if (gap > MAX_INTERVAL_DAYS) {
          console.log(`  ⚠ Violation: ${gap} days gap between ${allDates[i - 1]} and ${allDates[i]}`);
          hasViolation = true;
          break;
        }
      }
      
      // If violation exists, try to move first session to fill the gap
      if (hasViolation && allDates.length >= 2) {
        const firstSessionDate = allDates[0];
        const secondSessionDate = allDates[1];
        
        // Find available days between second session and last session
        const lastSessionDate = allDates[allDates.length - 1];
        const availableDaysToMove = availableDays.filter(d => {
          const dateStr = d.toISOString().split('T')[0];
          return !sessionMap.has(dateStr) && 
                 d > new Date(secondSessionDate) && 
                 d < new Date(lastSessionDate);
        });
        
        if (availableDaysToMove.length > 0) {
          // Calculate intensity for each available day
          const dayIntensities = new Map<string, number>();
          availableDaysToMove.forEach(day => {
            const dateStr = day.toISOString().split('T')[0];
            let intensity = 0;
            
            this.preliminarySchedules.forEach((schedule, examId) => {
              if (examId !== exam.id && schedule.has(dateStr)) {
                intensity += schedule.get(dateStr) || 0;
              }
            });
            
            dayIntensities.set(dateStr, intensity);
          });
          
          // Find lowest intensity day that respects max interval
          let bestDay: Date | null = null;
          let lowestIntensity = Infinity;
          
          for (const day of availableDaysToMove) {
            const dateStr = day.toISOString().split('T')[0];
            const intensity = dayIntensities.get(dateStr) || 0;
            
            // Check if this day respects max interval with neighbors
            const gapToSecond = Math.floor((day.getTime() - new Date(secondSessionDate).getTime()) / (24 * 60 * 60 * 1000)) - 1;
            const thirdSessionDate = allDates.length > 2 ? allDates[2] : null;
            const gapToThird = thirdSessionDate ? Math.floor((new Date(thirdSessionDate).getTime() - day.getTime()) / (24 * 60 * 60 * 1000)) - 1 : 0;
            
            if (gapToSecond <= MAX_INTERVAL_DAYS && gapToThird <= MAX_INTERVAL_DAYS) {
              if (intensity < lowestIntensity) {
                lowestIntensity = intensity;
                bestDay = day;
              }
            }
          }
          
          if (bestDay) {
            const newDateStr = bestDay.toISOString().split('T')[0];
            console.log(`  ✓ Moving first session from ${firstSessionDate} to ${newDateStr} (intensity: ${lowestIntensity})`);
            sessionMap.delete(firstSessionDate);
            sessionMap.set(newDateStr, 1);
          }
        }
      }
      
      console.log(`  Final distribution: ${sessionCount} sessions`);
      
      console.log(`  Assigned ${sessionCount} regular sessions + ${hasFinalReview ? '1 final review' : '0 final review'} = ${sessionCount + (hasFinalReview ? 1 : 0)} total sessions`);
      
      // Verify we haven't assigned more sessions than needed
      const totalAssigned = sessionCount + (hasFinalReview ? 1 : 0);
      if (totalAssigned !== totalSessions) {
        console.error(`  ERROR: Assigned ${totalAssigned} sessions but needed ${totalSessions} sessions!`);
        // Remove excess sessions if any
        if (totalAssigned > totalSessions) {
          const excessToRemove = totalAssigned - totalSessions;
          console.log(`  Removing ${excessToRemove} excess sessions`);
          
          const assignedDates = Array.from(sessionMap.keys()).sort();
          for (let i = 0; i < excessToRemove && i < assignedDates.length; i++) {
            const dateToRemove = assignedDates[i];
            // Don't remove final review session
            if (dateToRemove !== dayBeforeExamStr) {
              sessionMap.delete(dateToRemove);
              console.log(`  Removed excess session from ${dateToRemove}`);
            }
          }
        }
      }
    }
    
    console.log(`Final session assignment for ${exam.subject}:`, Object.fromEntries(sessionMap));
    return sessionMap;
  }

  public getPreliminarySchedule(): { [examName: string]: { [date: string]: number } } {
    const result: { [examName: string]: { [date: string]: number } } = {};
    
    for (const exam of this.inputs.exams) {
      const validSlots = this.generateValidSlotsForExam(exam);
      const sessionMap = this.assignSessionsEvenly(exam, validSlots);
      
      const dateSessionMap: { [date: string]: number } = {};
      sessionMap.forEach((sessions, date) => {
        dateSessionMap[date] = sessions;
      });
      
      result[exam.subject] = dateSessionMap;
    }
    
    return result;
  }

  private mergeExamsIntoDailyPlan(): Map<string, Map<string, number>> {
    const STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
    const MAX_SESSIONS_PER_DAY = Math.floor(this.inputs.daily_max_hours / STUDY_CHUNK_HOURS);
    
    // Get preliminary schedules for all exams (build sequentially so later exams can avoid earlier ones)
    this.preliminarySchedules.clear();
    
    // Sort exams by session count (highest first) to ensure fair distribution
    const sortedExams = [...this.inputs.exams].sort((a, b) => {
      const sessionsA = Math.ceil(this.calculateTotalHours(a) / (this.inputs.session_duration / 60));
      const sessionsB = Math.ceil(this.calculateTotalHours(b) / (this.inputs.session_duration / 60));
      return sessionsB - sessionsA; // Highest session count first
    });
    
    console.log('Exam scheduling order:', sortedExams.map(e => ({
      subject: e.subject,
      sessions: Math.ceil(this.calculateTotalHours(e) / (this.inputs.session_duration / 60))
    })));
    
    for (const exam of sortedExams) {
      const validSlots = this.generateValidSlotsForExam(exam);
      const sessionMap = this.assignSessionsEvenly(exam, validSlots);
      this.preliminarySchedules.set(exam.id, sessionMap);
    }
    
    const preliminarySchedules = this.preliminarySchedules;
    
    // Create a merged schedule: date -> (examId -> sessionCount)
    const mergedSchedule = new Map<string, Map<string, number>>();
    
    // Collect all sessions with metadata for priority sorting
    interface SessionAssignment {
      examId: string;
      date: string;
      sessions: number;
      examDate: Date;
      totalSessions: number;
      assignmentOrder: number;
    }
    
    const allAssignments: SessionAssignment[] = [];
    let assignmentOrder = 0;
    
    // Collect all preliminary assignments
    for (const exam of this.inputs.exams) {
      const examSchedule = preliminarySchedules.get(exam.id);
      if (!examSchedule) continue;
      
      const totalHours = this.calculateTotalHours(exam);
      const totalSessions = Math.ceil(totalHours / STUDY_CHUNK_HOURS);
      
      console.log(`Exam ${exam.subject}: totalHours=${totalHours}, totalSessions=${totalSessions}`);
      console.log(`Exam schedule has ${examSchedule.size} entries:`, Array.from(examSchedule.keys()));
      
      examSchedule.forEach((sessions, dateStr) => {
        allAssignments.push({
          examId: exam.id,
          date: dateStr,
          sessions,
          examDate: exam.exam_date,
          totalSessions,
          assignmentOrder: assignmentOrder++
        });
      });
    }
    
    // Sort by date first (chronological order)
    allAssignments.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      
      // For same date, sort by priority:
      // 1. Exam closer in date (earlier exam date = higher priority)
      const examDateDiff = a.examDate.getTime() - b.examDate.getTime();
      if (examDateDiff !== 0) return examDateDiff;
      
      // 2. Harder exam (more total sessions = higher priority)
      const sessionDiff = b.totalSessions - a.totalSessions;
      if (sessionDiff !== 0) return sessionDiff;
      
      // 3. Older assigned sessions stay (lower assignment order = higher priority)
      return a.assignmentOrder - b.assignmentOrder;
    });
    
    // Process assignments and handle conflicts
    const processedAssignments = new Set<string>();
    
    console.log('=== PROCESSING ASSIGNMENTS ===');
    console.log(`Total assignments to process: ${allAssignments.length}`);
    allAssignments.forEach((a, idx) => {
      const exam = this.inputs.exams.find(e => e.id === a.examId);
      console.log(`  ${idx}: ${exam?.subject} on ${a.date} (${a.sessions} sessions)`);
    });
    
    for (const assignment of allAssignments) {
      const key = `${assignment.examId}-${assignment.date}`;
      if (processedAssignments.has(key)) {
        console.log(`  Skipping duplicate: ${key}`);
        continue;
      }
      
      const exam = this.inputs.exams.find(e => e.id === assignment.examId);
      console.log(`\nProcessing: ${exam?.subject} on ${assignment.date} (${assignment.sessions} sessions)`);
      
      let currentDate = assignment.date;
      let remainingSessions = assignment.sessions;
      
      // Try to place sessions on the assigned date first
      while (remainingSessions > 0) {
        if (!mergedSchedule.has(currentDate)) {
          mergedSchedule.set(currentDate, new Map());
        }
        
        const daySchedule = mergedSchedule.get(currentDate)!;
        const currentSessionsOnDay = Array.from(daySchedule.values()).reduce((sum, s) => sum + s, 0);
        const availableSlots = MAX_SESSIONS_PER_DAY - currentSessionsOnDay;
        
        if (availableSlots > 0) {
          // We can fit some or all sessions on this day
          const sessionsToPlace = Math.min(remainingSessions, availableSlots);
          daySchedule.set(assignment.examId, (daySchedule.get(assignment.examId) || 0) + sessionsToPlace);
          remainingSessions -= sessionsToPlace;
          console.log(`  Placed ${sessionsToPlace} sessions on ${currentDate}, ${remainingSessions} remaining`);
        } else {
          console.log(`  No available slots on ${currentDate} (${currentSessionsOnDay}/${MAX_SESSIONS_PER_DAY})`);
        }
        
        if (remainingSessions > 0) {
          // Need to move to an earlier day
          // Find the nearest earlier day with free slots
          const exam = this.inputs.exams.find(e => e.id === assignment.examId)!;
          const validSlots = this.generateValidSlotsForExam(exam);
          const sortedValidDates = validSlots
            .map(d => d.toISOString().split('T')[0])
            .sort();
          
          const currentIndex = sortedValidDates.indexOf(currentDate);
          let foundEarlierSlot = false;
          
          // Search backwards for an earlier day with free slots
          for (let i = currentIndex - 1; i >= 0; i--) {
            const earlierDate = sortedValidDates[i];
            const otherExamDays = new Set<string>();
            if (preliminarySchedules.size > 0) {
              Array.from(preliminarySchedules.entries()).forEach(([otherExamId, otherSchedule]) => {
                if (otherExamId !== exam.id) {
                  Array.from(otherSchedule.keys()).forEach(dateStr => {
                    otherExamDays.add(dateStr);
                  });
                }
              });
            }
            const earlierSchedule = mergedSchedule.get(earlierDate);
            const earlierSessionsOnDay = earlierSchedule ? Array.from(earlierSchedule.values()).reduce((sum: number, s: number) => sum + s, 0) : 0;
            if (earlierSessionsOnDay < MAX_SESSIONS_PER_DAY && !otherExamDays.has(earlierDate)) {
              foundEarlierSlot = true;
              currentDate = earlierDate;
              break;
            }
          }
          
          if (!foundEarlierSlot) {
            // No earlier slot available, this is an overload situation
            // Place the remaining sessions on the current day anyway
            const daySchedule = mergedSchedule.get(currentDate)!;
            daySchedule.set(assignment.examId, (daySchedule.get(assignment.examId) || 0) + remainingSessions);
            remainingSessions = 0;
          }
        }
      }
      
      processedAssignments.add(key);
    }
    
    // BALANCING STEP: Redistribute sessions for even workload
    this.balanceWorkload(mergedSchedule);
    
    // FIX MAX INTERVAL VIOLATIONS: After balancing, check and fix any violations
    this.fixMaxIntervalViolations(mergedSchedule);
    
    return mergedSchedule;
  }

  private balanceWorkload(mergedSchedule: Map<string, Map<string, number>>): void {
    const MAX_SESSIONS_PER_DAY = Math.floor(this.inputs.daily_max_hours / (this.inputs.session_duration / 60));
    
    // Get all dates in chronological order
    const allDates = Array.from(mergedSchedule.keys()).sort();
    
    console.log('=== BALANCING WORKLOAD ===');
    console.log('Max sessions per day:', MAX_SESSIONS_PER_DAY);
    
    // Find overloaded, busy, and underloaded days
    const overloadedDays: { date: string; totalSessions: number; excess: number }[] = [];
    const busyDays: { date: string; totalSessions: number; canGive: number }[] = [];
    const underloadedDays: { date: string; totalSessions: number; capacity: number }[] = [];
    
    allDates.forEach(date => {
      const daySchedule = mergedSchedule.get(date)!;
      const totalSessions = Array.from(daySchedule.values()).reduce((sum, s) => sum + s, 0);
      
      console.log(`Day ${date}: ${totalSessions} sessions`, Object.fromEntries(daySchedule));
      
      if (totalSessions > MAX_SESSIONS_PER_DAY) {
        overloadedDays.push({
          date,
          totalSessions,
          excess: totalSessions - MAX_SESSIONS_PER_DAY
        });
        console.log(`  -> OVERLOADED by ${totalSessions - MAX_SESSIONS_PER_DAY} sessions`);
      } else if (totalSessions === MAX_SESSIONS_PER_DAY) {
        // Busy days can give up 1 session if there are empty days that need sessions
        busyDays.push({
          date,
          totalSessions,
          canGive: 1
        });
        console.log(`  -> BUSY (can give 1 session if needed)`);
      } else if (totalSessions < MAX_SESSIONS_PER_DAY) {
        underloadedDays.push({
          date,
          totalSessions,
          capacity: MAX_SESSIONS_PER_DAY - totalSessions
        });
        console.log(`  -> UNDERLOADED with ${MAX_SESSIONS_PER_DAY - totalSessions} capacity`);
      }
    });
    
    console.log(`Found ${overloadedDays.length} overloaded days, ${busyDays.length} busy days, ${underloadedDays.length} underloaded days`);
    
    // First, handle overloaded days
    for (const overloadedDay of overloadedDays) {
      const daySchedule = mergedSchedule.get(overloadedDay.date)!;
      let excessToMove = overloadedDay.excess;
      
      console.log(`Processing overloaded day ${overloadedDay.date}, need to move ${excessToMove} sessions`);
      
      // Try to move sessions to underloaded days
      for (const underloadedDay of underloadedDays) {
        if (excessToMove <= 0) break;
        
        const capacity = underloadedDay.capacity;
        const sessionsToMove = Math.min(excessToMove, capacity);
        
        console.log(`  Trying to move to underloaded day ${underloadedDay.date} (capacity: ${capacity})`);
        
        // Find exams with sessions on the overloaded day
        const examIds = Array.from(daySchedule.keys()).filter(examId => 
          daySchedule.get(examId)! > 0
        );
        
        console.log(`  Available exams on overloaded day:`, examIds);
        
        // Move sessions one by one, prioritizing exams with furthest exam dates
        for (const examId of examIds) {
          if (sessionsToMove <= 0) break;
          
          const exam = this.inputs.exams.find(e => e.id === examId);
          if (!exam) continue;
          
          console.log(`    Checking exam ${exam.subject} (exam date: ${exam.exam_date.toISOString().split('T')[0]})`);
          
          // Check if this is a final review session (day before exam) - don't move it
          const examDateStr = exam.exam_date.toISOString().split('T')[0];
          const examDateUTC = new Date(examDateStr + 'T00:00:00.000Z');
          const dayBeforeExam = new Date(examDateUTC.getTime() - 24 * 60 * 60 * 1000);
          const dayBeforeExamStr = dayBeforeExam.toISOString().split('T')[0];
          
          if (overloadedDay.date === dayBeforeExamStr) {
            console.log(`    SKIP: ${overloadedDay.date} is day before exam for ${exam.subject}, protecting final review session`);
            continue;
          }
          
          // Check if we can move a session to the underloaded day
          const validSlots = this.generateValidSlotsForExam(exam);
          const isValidDate = validSlots.some(slot => 
            slot.toISOString().split('T')[0] === underloadedDay.date
          );
          
          if (!isValidDate) {
            console.log(`    Can't move to ${underloadedDay.date}: not a valid date for ${exam.subject}`);
            continue;
          }
          
          // Check subject diversification - avoid putting 3+ of same subject on target day
          const underloadedSchedule = mergedSchedule.get(underloadedDay.date) || new Map();
          const currentCountOnTarget = underloadedSchedule.get(examId) || 0;
          if (currentCountOnTarget >= 2) {
            console.log(`    SKIP: ${exam.subject} already has ${currentCountOnTarget} sessions on ${underloadedDay.date}, avoiding 3rd`);
            continue;
          }
          
          // Move 1 session from overloaded to underloaded day
          daySchedule.set(examId, daySchedule.get(examId)! - 1);
          
          if (!mergedSchedule.has(underloadedDay.date)) {
            mergedSchedule.set(underloadedDay.date, new Map());
          }
          
          const targetSchedule = mergedSchedule.get(underloadedDay.date)!;
          targetSchedule.set(examId, (targetSchedule.get(examId) || 0) + 1);
          
          console.log(`    MOVED 1 session of ${exam.subject} from ${overloadedDay.date} to ${underloadedDay.date}`);
          
          excessToMove--;
          underloadedDay.capacity--;
          
          // Remove empty exam entries
          if (daySchedule.get(examId) === 0) {
            daySchedule.delete(examId);
          }
        }
      }
    }
    
    // Then, handle busy days - move 1 session from busy days to very empty days
    if (busyDays.length > 0 && underloadedDays.length > 0) {
      console.log('=== BALANCING BUSY DAYS ===');
      
      for (const busyDay of busyDays) {
        const daySchedule = mergedSchedule.get(busyDay.date)!;
        
        // Find very empty days (1 session or less)
        const veryEmptyDays = underloadedDays.filter(day => 
          day.totalSessions <= 1 && day.capacity >= 1
        );
        
        if (veryEmptyDays.length === 0) continue;
        
        console.log(`Processing busy day ${busyDay.date}, can give ${busyDay.canGive} session`);
        
        // Find exams with sessions on the busy day (prioritize exams with furthest exam dates)
        const examIds = Array.from(daySchedule.keys()).filter(examId => 
          daySchedule.get(examId)! > 0
        );
        
        // Sort by exam date (furthest first)
        examIds.sort((a, b) => {
          const examA = this.inputs.exams.find(e => e.id === a)!;
          const examB = this.inputs.exams.find(e => e.id === b)!;
          return examB.exam_date.getTime() - examA.exam_date.getTime();
        });
        
        console.log(`  Available exams on busy day:`, examIds.map(id => {
          const exam = this.inputs.exams.find(e => e.id === id)!;
          return exam.subject;
        }));
        
        for (const examId of examIds) {
          if (busyDay.canGive <= 0) break;
          
          const exam = this.inputs.exams.find(e => e.id === examId);
          if (!exam) continue;
          
          console.log(`    Checking exam ${exam.subject} (exam date: ${exam.exam_date.toISOString().split('T')[0]})`);
          
          // Check if this is a final review session (day before exam) - don't move it
          const examDateStr = exam.exam_date.toISOString().split('T')[0];
          const examDateUTC = new Date(examDateStr + 'T00:00:00.000Z');
          const dayBeforeExam = new Date(examDateUTC.getTime() - 24 * 60 * 60 * 1000);
          const dayBeforeExamStr = dayBeforeExam.toISOString().split('T')[0];
          
          if (busyDay.date === dayBeforeExamStr) {
            console.log(`    SKIP: ${busyDay.date} is day before exam for ${exam.subject}, protecting final review session`);
            continue;
          }
          
          // Try to move to very empty days
          for (const emptyDay of veryEmptyDays) {
            if (busyDay.canGive <= 0) break;
            
            // Check if we can move a session to the empty day
            const validSlots = this.generateValidSlotsForExam(exam);
            const isValidDate = validSlots.some(slot => 
              slot.toISOString().split('T')[0] === emptyDay.date
            );
            
            if (!isValidDate) {
              console.log(`    Can't move to ${emptyDay.date}: not a valid date for ${exam.subject}`);
              continue;
            }
            
            // Check subject diversification - avoid putting 3+ of same subject on target day
            const emptyDaySchedule = mergedSchedule.get(emptyDay.date) || new Map();
            const currentCountOnTarget = emptyDaySchedule.get(examId) || 0;
            if (currentCountOnTarget >= 2) {
              console.log(`    SKIP: ${exam.subject} already has ${currentCountOnTarget} sessions on ${emptyDay.date}, avoiding 3rd`);
              continue;
            }
            
            // Move 1 session from busy to empty day
            daySchedule.set(examId, daySchedule.get(examId)! - 1);
            
            if (!mergedSchedule.has(emptyDay.date)) {
              mergedSchedule.set(emptyDay.date, new Map());
            }
            
            const targetSchedule = mergedSchedule.get(emptyDay.date)!;
            targetSchedule.set(examId, (targetSchedule.get(examId) || 0) + 1);
            
            console.log(`    MOVED 1 session of ${exam.subject} from ${busyDay.date} to ${emptyDay.date}`);
            
            busyDay.canGive--;
            emptyDay.capacity--;
            emptyDay.totalSessions++;
            
            // Remove empty exam entries
            if (daySchedule.get(examId) === 0) {
              daySchedule.delete(examId);
            }
            
            break; // Only move 1 session per exam
          }
        }
      }
    }
    
    // Additional balancing phase: even out workload across all days
    // Move sessions from heavier days to lighter days for better distribution
    console.log('=== EVENING OUT WORKLOAD ===');
    
    // Sort days by session count (heaviest first)
    const daysByLoad = allDates.map(date => ({
      date,
      sessions: Array.from(mergedSchedule.get(date)!.values()).reduce((sum, s) => sum + s, 0)
    })).sort((a, b) => b.sessions - a.sessions);
    
    // Try to balance: move from heavy days to light days
    for (let i = 0; i < daysByLoad.length; i++) {
      const heavyDay = daysByLoad[i];
      if (heavyDay.sessions <= 2) break; // Stop if we reach days with 2 or fewer sessions
      
      // Find lighter days that could take a session
      for (let j = daysByLoad.length - 1; j > i; j--) {
        const lightDay = daysByLoad[j];
        
        // Only balance if there's a significant difference (2+ sessions)
        if (heavyDay.sessions - lightDay.sessions < 2) continue;
        
        const heavySchedule = mergedSchedule.get(heavyDay.date)!;
        const lightSchedule = mergedSchedule.get(lightDay.date) || new Map();
        
        // Try to move one session from heavy to light day
        const examIds = Array.from(heavySchedule.keys()).filter(id => heavySchedule.get(id)! > 0);
        
        for (const examId of examIds) {
          const exam = this.inputs.exams.find(e => e.id === examId);
          if (!exam) continue;
          
          // Check if this is a final review session - don't move it
          const examDateStr = exam.exam_date.toISOString().split('T')[0];
          const examDateUTC = new Date(examDateStr + 'T00:00:00.000Z');
          const dayBeforeExam = new Date(examDateUTC.getTime() - 24 * 60 * 60 * 1000);
          const dayBeforeExamStr = dayBeforeExam.toISOString().split('T')[0];
          
          if (heavyDay.date === dayBeforeExamStr) continue;
          
          // Check if light day is valid for this exam
          const validSlots = this.generateValidSlotsForExam(exam);
          const isValid = validSlots.some(slot => slot.toISOString().split('T')[0] === lightDay.date);
          if (!isValid) continue;
          
          // Check diversification
          const currentOnLight = lightSchedule.get(examId) || 0;
          if (currentOnLight >= 2) continue;
          
          // Move the session
          heavySchedule.set(examId, heavySchedule.get(examId)! - 1);
          if (!mergedSchedule.has(lightDay.date)) {
            mergedSchedule.set(lightDay.date, new Map());
          }
          mergedSchedule.get(lightDay.date)!.set(examId, currentOnLight + 1);
          
          console.log(`  Balanced: moved ${exam.subject} from ${heavyDay.date} (${heavyDay.sessions}→${heavyDay.sessions-1}) to ${lightDay.date} (${lightDay.sessions}→${lightDay.sessions+1})`);
          
          // Update counts
          heavyDay.sessions--;
          lightDay.sessions++;
          
          if (heavySchedule.get(examId) === 0) {
            heavySchedule.delete(examId);
          }
          
          break; // Only move one session per iteration
        }
        
        if (heavyDay.sessions <= 2) break;
      }
    }
    
    console.log('=== FINAL BALANCED SCHEDULE ===');
    allDates.forEach(date => {
      const daySchedule = mergedSchedule.get(date)!;
      const totalSessions = Array.from(daySchedule.values()).reduce((sum, s) => sum + s, 0);
      console.log(`Day ${date}: ${totalSessions} sessions`, Object.fromEntries(daySchedule));
    });
  }

  private fixMaxIntervalViolations(mergedSchedule: Map<string, Map<string, number>>): void {
    const MAX_INTERVAL_DAYS = 2;
    
    console.log('=== FIXING MAX INTERVAL VIOLATIONS ===');
    
    // Check each exam's sessions for violations
    this.inputs.exams.forEach(exam => {
      // Get all dates where this exam has sessions
      const examDates: string[] = [];
      mergedSchedule.forEach((daySchedule, date) => {
        if (daySchedule.has(exam.id) && daySchedule.get(exam.id)! > 0) {
          examDates.push(date);
        }
      });
      
      examDates.sort();
      
      if (examDates.length < 2) return; // No violation possible with < 2 sessions
      
      console.log(`Checking ${exam.subject}: ${examDates.join(', ')}`);
      
      // Check for violations
      for (let i = 1; i < examDates.length; i++) {
        const prevDate = new Date(examDates[i - 1]);
        const currDate = new Date(examDates[i]);
        const gap = Math.floor((currDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000)) - 1;
        
        if (gap > MAX_INTERVAL_DAYS) {
          console.log(`  ⚠ Violation: ${gap} days gap between ${examDates[i - 1]} and ${examDates[i]}`);
          
          // Try to move the first session to fill the gap
          const firstSessionDate = examDates[0];
          const secondSessionDate = examDates[1];
          
          // Find available days between second and the violating session
          const allDates = Array.from(mergedSchedule.keys()).sort();
          const availableDays = allDates.filter(date => {
            const daySchedule = mergedSchedule.get(date)!;
            const hasThisExam = daySchedule.has(exam.id) && daySchedule.get(exam.id)! > 0;
            return !hasThisExam && date > secondSessionDate && date < examDates[i];
          });
          
          if (availableDays.length > 0) {
            // Calculate intensity for each available day
            let bestDay: string | null = null;
            let lowestIntensity = Infinity;
            
            for (const day of availableDays) {
              const daySchedule = mergedSchedule.get(day)!;
              const intensity = Array.from(daySchedule.values()).reduce((sum, s) => sum + s, 0);
              
              // Check if this day respects max interval with neighbors
              const gapToSecond = Math.floor((new Date(day).getTime() - new Date(secondSessionDate).getTime()) / (24 * 60 * 60 * 1000)) - 1;
              const gapToViolating = Math.floor((new Date(examDates[i]).getTime() - new Date(day).getTime()) / (24 * 60 * 60 * 1000)) - 1;
              
              if (gapToSecond <= MAX_INTERVAL_DAYS && gapToViolating <= MAX_INTERVAL_DAYS) {
                if (intensity < lowestIntensity) {
                  lowestIntensity = intensity;
                  bestDay = day;
                }
              }
            }
            
            if (bestDay) {
              console.log(`  ✓ Moving ${exam.subject} from ${firstSessionDate} to ${bestDay} (intensity: ${lowestIntensity})`);
              
              // Remove from first date
              const firstDaySchedule = mergedSchedule.get(firstSessionDate)!;
              const sessionsOnFirst = firstDaySchedule.get(exam.id) || 0;
              if (sessionsOnFirst > 1) {
                firstDaySchedule.set(exam.id, sessionsOnFirst - 1);
              } else {
                firstDaySchedule.delete(exam.id);
              }
              
              // Add to best day
              const bestDaySchedule = mergedSchedule.get(bestDay)!;
              bestDaySchedule.set(exam.id, (bestDaySchedule.get(exam.id) || 0) + 1);
              
              break; // Fixed this violation, move to next exam
            }
          }
        }
      }
    });
  }

  private validateSchedule(): {
    isValid: boolean;
    warnings: string[];
    ruleViolations: string[];
    overloadedDays: { date: string; sessions: number; limit: number }[];
    incompleteExams: { examName: string; missingSessions: number }[];
  } {
    const STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
    const MAX_SESSIONS_PER_DAY = Math.floor(this.inputs.daily_max_hours / STUDY_CHUNK_HOURS);
    const mergedSchedule = this.mergeExamsIntoDailyPlan();
    
    const warnings: string[] = [];
    const ruleViolations: string[] = [];
    const overloadedDays: { date: string; sessions: number; limit: number }[] = [];
    const incompleteExams: { examName: string; missingSessions: number }[] = [];
    
    // Check 1: Daily session limit violations
    mergedSchedule.forEach((examSessions, date) => {
      const totalSessions = Array.from(examSessions.values()).reduce((sum, s) => sum + s, 0);
      if (totalSessions > MAX_SESSIONS_PER_DAY) {
        overloadedDays.push({
          date,
          sessions: totalSessions,
          limit: MAX_SESSIONS_PER_DAY
        });
        warnings.push(`Day ${date} exceeds daily limit: ${totalSessions} sessions (max: ${MAX_SESSIONS_PER_DAY})`);
      }
    });
    
    // Check 2: Final review sessions (day before exam)
    for (const exam of this.inputs.exams) {
      const examDate = new Date(exam.exam_date);
      const dayBeforeExam = new Date(examDate.getTime() - 24 * 60 * 60 * 1000);
      const dayBeforeExamStr = dayBeforeExam.toISOString().split('T')[0];
      
      const daySchedule = mergedSchedule.get(dayBeforeExamStr);
      if (!daySchedule || !daySchedule.has(exam.id) || daySchedule.get(exam.id) === 0) {
        ruleViolations.push(`Missing final review session for ${exam.subject} on ${dayBeforeExamStr}`);
      }
    }
    
    // Check 3: Maximum 3-day gap between sessions of same exam
    for (const exam of this.inputs.exams) {
      const scheduledDays: string[] = [];
      
      // Collect all days where this exam has sessions
      mergedSchedule.forEach((examSessions, date) => {
        if (examSessions.has(exam.id) && examSessions.get(exam.id)! > 0) {
          scheduledDays.push(date);
        }
      });
      
      // Sort the scheduled days
      scheduledDays.sort();
      
      // Check for gaps larger than 3 days between consecutive sessions
      for (let i = 0; i < scheduledDays.length - 1; i++) {
        const currentDate = new Date(scheduledDays[i]);
        const nextDate = new Date(scheduledDays[i + 1]);
        const daysDiff = Math.floor((nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff > 3) {
          ruleViolations.push(`Gap of ${daysDiff} days between ${exam.subject} sessions on ${scheduledDays[i]} and ${scheduledDays[i + 1]} (max allowed: 3 days)`);
        }
      }
    }
    
    // Check 4: Sessions after exam date (unless allowed)
    for (const exam of this.inputs.exams) {
      if (!exam.can_study_after_exam) {
        const examDateStr = exam.exam_date.toISOString().split('T')[0];
        
        mergedSchedule.forEach((examSessions, date) => {
          if (date > examDateStr && examSessions.has(exam.id) && examSessions.get(exam.id)! > 0) {
            ruleViolations.push(`Session for ${exam.subject} scheduled after exam date on ${date}`);
          }
        });
      }
    }
    
    // Check 5: Incomplete exams (not enough sessions)
    for (const exam of this.inputs.exams) {
      const totalHours = this.calculateTotalHours(exam);
      const requiredSessions = Math.ceil(totalHours / STUDY_CHUNK_HOURS);
      
      let scheduledSessions = 0;
      mergedSchedule.forEach((examSessions) => {
        scheduledSessions += examSessions.get(exam.id) || 0;
      });
      
      if (scheduledSessions < requiredSessions) {
        const missingSessions = requiredSessions - scheduledSessions;
        incompleteExams.push({
          examName: exam.subject,
          missingSessions
        });
        warnings.push(`${exam.subject} is missing ${missingSessions} sessions (required: ${requiredSessions}, scheduled: ${scheduledSessions})`);
      }
    }
    
    const isValid = ruleViolations.length === 0 && overloadedDays.length === 0 && incompleteExams.length === 0;
    
    return {
      isValid,
      warnings,
      ruleViolations,
      overloadedDays,
      incompleteExams
    };
  }

  public getFinalScheduleWithValidation(): {
    calendar: { [date: string]: { examName: string; sessions: number }[] };
    validation: {
      isValid: boolean;
      warnings: string[];
      ruleViolations: string[];
      overloadedDays: { date: string; sessions: number; limit: number }[];
      incompleteExams: { examName: string; missingSessions: number }[];
    };
    explanation: string;
  } {
    const mergedSchedule = this.mergeExamsIntoDailyPlan();
    const validation = this.validateSchedule();
    
    // Convert to calendar format
    const calendar: { [date: string]: { examName: string; sessions: number }[] } = {};
    
    mergedSchedule.forEach((examSessions, date) => {
      const daySchedule: { examName: string; sessions: number }[] = [];
      
      examSessions.forEach((sessions, examId) => {
        const exam = this.inputs.exams.find(e => e.id === examId);
        if (exam) {
          daySchedule.push({
            examName: exam.subject,
            sessions
          });
        }
      });
      
      calendar[date] = daySchedule;
    });
    
    // Explanation for 3+ exam handling
    const explanation = `
3+ Exam Handling Explanation:
• Conflict Resolution: When multiple exams compete for the same day, priority is given to exams with earlier dates, higher difficulty, and earlier assignment order
• Low-Pressure Placement: Sessions for exams furthest away are moved to earlier low-intensity days to balance the schedule
• Balancing: The algorithm redistributes sessions from overloaded days to underloaded days, ensuring even distribution across the entire study period
• Final Review: Each exam gets a guaranteed session the day before the exam
• 3-Day Gap Rule: No more than 3 days can pass between sessions of the same exam (max gap = 3 days)
• Daily Limits: Respects maximum sessions per day, moving excess sessions to earlier days when needed
    `.trim();
    
    return {
      calendar,
      validation,
      explanation
    };
  }

  private calculateTotalHours(exam: ExamData): number {
    // User's estimate is the baseline, with max 10% adjustment based on difficulty/confidence
    const maxAdjustmentPercent = 0.10; // Fixed at 10% max
    const difficultyMultiplier = 1 + (exam.difficulty - 3) * (maxAdjustmentPercent / 2); // Half from difficulty
    const confidenceMultiplier = 1 - (exam.confidence - 3) * (maxAdjustmentPercent / 2); // Half from confidence
    const adjustmentFactor = (difficultyMultiplier + confidenceMultiplier) / 2;
    
    // Calculate adjusted hours and cap at 10% increase/decrease
    const calculatedHours = exam.user_estimated_total_hours * adjustmentFactor;
    const minAllowedHours = exam.user_estimated_total_hours * 0.90; // Max 10% decrease
    const maxAllowedHours = exam.user_estimated_total_hours * 1.10; // Max 10% increase
    
    const finalHours = Math.max(1, Math.min(Math.round(calculatedHours * 10) / 10, maxAllowedHours)); // Round to 1 decimal
    
    return finalHours;
  }

  private initializeInternalState(exams: ExamData[]): InternalSubjectState[] {
    const STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;

    return exams.filter((exam): exam is ExamData => exam != null).map((exam): InternalSubjectState => {
      const totalHours = this.calculateTotalHours(exam);
      const existingHours = (this.inputs.existing_sessions || [])
        .filter(s => s.subjectId === exam.id)
        .reduce((sum, s) => sum + s.duration, 0);

      return {
        id: exam.id,
        subject: exam.subject,
        exam_date: new Date(exam.exam_date),
        remaining_hours: totalHours - existingHours,
        state: 'ACTIVE',
        days_to_exam: 0,
        last_study_day: null,
        original_difficulty: exam.difficulty,
        original_confidence: exam.confidence,
      };
    });
  }

  private generateSingleExamPlan(): DailySchedule[] {
    const exam = this.subjects[0];
    // For single exam, use the full calculated hours (no need for final review reservation)
    const examInput = this.inputs.exams.find(e => e.id === exam.id);
    const totalRequiredHours = this.calculateTotalHours(examInput!);
    const STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
    const totalChunksNeeded = Math.ceil(totalRequiredHours / STUDY_CHUNK_HOURS);
    const maxSessionsPerDay = Math.floor(this.inputs.daily_max_hours / STUDY_CHUNK_HOURS);

    console.log(`Single exam plan: ${exam.subject}, total chunks needed: ${totalChunksNeeded}`);

    // Calculate available days - all in UTC
    const now = new Date();
    const nowLocalStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const nowUTC = new Date(nowLocalStr + 'T00:00:00.000Z');
    
    const inputStartStr = this.inputs.start_date.toISOString().split('T')[0];
    const inputStartUTC = new Date(inputStartStr + 'T00:00:00.000Z');
    const startDateUTC = nowUTC > inputStartUTC ? nowUTC : inputStartUTC;
    
    // Parse exam date as UTC to avoid timezone shifts
    const examDateStr = exam.exam_date.toISOString().split('T')[0];
    const examDateUTC = new Date(examDateStr + 'T00:00:00.000Z');
    
    // Determine last valid study day based on can_study_after_exam setting
    let lastValidDay: Date;
    if (examInput!.can_study_after_exam) {
      lastValidDay = new Date(examDateUTC); // Include exam day
    } else {
      lastValidDay = new Date(examDateUTC.getTime() - 24 * 60 * 60 * 1000); // Day before exam
    }
    
    const availableDays = Math.floor((lastValidDay.getTime() - startDateUTC.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    
    console.log(`Available days: ${availableDays}, Sessions needed: ${totalChunksNeeded}, Max per day: ${maxSessionsPerDay}`);

    // If we don't have enough days for 1 session per day, we need multiple sessions per day
    if (availableDays < totalChunksNeeded) {
      console.log(`⚠️ Not enough days! Will place multiple sessions per day.`);
      
      let remainingChunks = totalChunksNeeded;
      let currentDate = new Date(startDateUTC);
      
      for (let i = 0; i < availableDays && remainingChunks > 0 && currentDate <= lastValidDay; i++) {
        const daysLeft = availableDays - i;
        const chunksForThisDay = Math.min(
          maxSessionsPerDay,
          Math.ceil(remainingChunks / daysLeft)
        );
        
        const hoursForThisDay = chunksForThisDay * STUDY_CHUNK_HOURS;
        
        const daySchedule: DailySchedule = {
          date: new Date(currentDate),
          total_hours: hoursForThisDay,
          subjects: { [exam.id]: hoursForThisDay },
        };
        this.schedule.push(daySchedule);
        
        console.log(`Day ${currentDate.toISOString().split('T')[0]}: ${chunksForThisDay} sessions (${hoursForThisDay} hours), remaining: ${remainingChunks - chunksForThisDay}`);
        
        remainingChunks -= chunksForThisDay;
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else {
      // Normal case: enough days for 1 session per day
      console.log(`Enough days available. Placing 1 session per day working backwards from exam.`);
      
      // Work backwards from the exam to ensure no gaps near exam
      let currentDate = new Date(lastValidDay);
      let remainingChunks = totalChunksNeeded;

      while (remainingChunks > 0 && currentDate >= startDateUTC) {
        const daySchedule: DailySchedule = {
          date: new Date(currentDate),
          total_hours: STUDY_CHUNK_HOURS,
          subjects: { [exam.id]: STUDY_CHUNK_HOURS },
        };
        this.schedule.push(daySchedule);

        remainingChunks--;
        currentDate.setDate(currentDate.getDate() - 1);
      }
      
      // Sort schedule chronologically
      this.schedule.sort((a, b) => a.date.getTime() - b.date.getTime());
    }

    console.log(`Created ${this.schedule.length} days with total sessions: ${totalChunksNeeded}`);
    return this.schedule;
  }

  public generatePlan(): DailySchedule[] | { error: string; choices: string[] } | ScheduleResult {
    console.log('=== SCHEDULER generatePlan CALLED ===');
    this.subjects = this.initializeInternalState(this.inputs.exams);

    // If there are existing sessions, decide whether to rebalance or regenerate
    if (this.inputs.existing_sessions && this.inputs.existing_sessions.length > 0) {
      const subjectsNeedingSessions = this.subjects.filter(s => s.remaining_hours > 0);
      // If new sessions need to be added (e.g., new exam), regenerate the whole schedule
      // to ensure all rules are met correctly from scratch.
      if (subjectsNeedingSessions.length > 0) {
        return this.generateNewSchedule();
      }
      // Otherwise, just rebalance the existing schedule (e.g., to fill gaps without adding new hours)
      return this.rebalanceExistingSchedule();
    }
    
    // If no existing sessions, generate a fresh schedule
    return this.generateNewSchedule();
  }

  private generateNewSchedule(): ScheduleResult {
    this.schedule = []; // Start with a clean slate
    this.subjects = this.initializeInternalState(this.inputs.exams); // Re-initialize to reset remaining_hours

    if (this.subjects.length === 0) {
      return { schedule: [] };
    }

    if (this.subjects.length === 1) {
      this.schedule = this.generateSingleExamPlan();
      return { schedule: this.schedule };
    }

    // Use the new merged daily plan approach
    const STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
    const mergedSchedule = this.mergeExamsIntoDailyPlan();
    
    // Convert merged schedule to DailySchedule format
    mergedSchedule.forEach((examSessions, dateStr) => {
      const daySchedule: DailySchedule = {
        date: new Date(dateStr),
        total_hours: 0,
        subjects: {}
      };
      
      examSessions.forEach((sessionCount, examId) => {
        const hours = sessionCount * STUDY_CHUNK_HOURS;
        daySchedule.subjects[examId] = hours;
        daySchedule.total_hours += hours;
      });
      
      this.schedule.push(daySchedule);
    });
    
    // Sort by date
    this.schedule.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    return { schedule: this.schedule };
  }

  private rebalanceExistingSchedule(): ScheduleResult {
    // Create a map of existing sessions by date
    const existingScheduleMap = new Map<string, DailySchedule>();
    this.inputs.existing_sessions!.forEach(session => {
      const dateStr = session.date.toISOString().split('T')[0];
      if (!existingScheduleMap.has(dateStr)) {
        existingScheduleMap.set(dateStr, {
          date: new Date(session.date),
          total_hours: 0,
          subjects: {}
        });
      }
      const daySchedule = existingScheduleMap.get(dateStr)!;
      daySchedule.subjects[session.subjectId] = (daySchedule.subjects[session.subjectId] || 0) + session.duration;
      daySchedule.total_hours += session.duration;
    });

    this.schedule = Array.from(existingScheduleMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Rebalancing only fills gaps and enforces spacing, it does not add new sessions.
    this.redistributeSessionsForBalance();
    this.enforceSessionSpacing();
    this.schedule.sort((a, b) => a.date.getTime() - b.date.getTime());
    this.ensureFinalReviewSessions();
    
    return { schedule: this.schedule };
  }


  private enforceSessionSpacing(): void {
    const STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
    const MAX_DAYS_BETWEEN_SESSIONS = 3;
    let violationsFound = true;

    while (violationsFound) {
      violationsFound = false;
      this.inputs.exams.forEach(exam => {
        const examSessions: { date: Date; dateStr: string }[] = [];
        this.schedule.forEach(day => {
          if (day.subjects[exam.id]) {
            examSessions.push({
              date: day.date,
              dateStr: day.date.toISOString().split('T')[0]
            });
          }
        });

        examSessions.sort((a, b) => a.date.getTime() - b.date.getTime());

        for (let i = 0; i < examSessions.length - 1; i++) {
          const currentSession = examSessions[i];
          const nextSession = examSessions[i + 1];
          const daysBetween = Math.floor((nextSession.date.getTime() - currentSession.date.getTime()) / (1000 * 3600 * 24));

          if (daysBetween > MAX_DAYS_BETWEEN_SESSIONS) {
            violationsFound = true;

            const daysInRange: { date: Date; dateStr: string; intensity: number }[] = [];
            for (let d = new Date(currentSession.date); d < nextSession.date; d.setDate(d.getDate() + 1)) {
              const dateStr = d.toISOString().split('T')[0];
              const daySchedule = this.schedule.find(ds => ds.date.toISOString().split('T')[0] === dateStr);
              const intensity = daySchedule?.total_hours || 0;
              const daysToNext = Math.floor((nextSession.date.getTime() - d.getTime()) / (1000 * 3600 * 24));
              if (daysToNext <= MAX_DAYS_BETWEEN_SESSIONS && daysToNext > 0) {
                daysInRange.push({ date: new Date(d), dateStr, intensity });
              }
            }

            daysInRange.sort((a, b) => a.intensity - b.intensity);
            const targetDay = daysInRange.find(d => d.intensity + STUDY_CHUNK_HOURS <= this.inputs.daily_max_hours);

            if (targetDay) {
              const sourceDay = this.schedule.find(d => d.date.toISOString().split('T')[0] === currentSession.dateStr);
              if (sourceDay) {
                sourceDay.subjects[exam.id] -= STUDY_CHUNK_HOURS;
                sourceDay.total_hours -= STUDY_CHUNK_HOURS;
                if (sourceDay.subjects[exam.id] <= 0) delete sourceDay.subjects[exam.id];
                if (sourceDay.total_hours === 0) {
                  const index = this.schedule.findIndex(d => d.date.toISOString().split('T')[0] === currentSession.dateStr);
                  if (index > -1) this.schedule.splice(index, 1);
                }
              }

              let newDay = this.schedule.find(d => d.date.toISOString().split('T')[0] === targetDay.dateStr);
              if (!newDay) {
                newDay = { date: new Date(targetDay.date), total_hours: 0, subjects: {} };
                this.schedule.push(newDay);
              }
              newDay.subjects[exam.id] = (newDay.subjects[exam.id] || 0) + STUDY_CHUNK_HOURS;
              newDay.total_hours += STUDY_CHUNK_HOURS;
              
              // Break the inner loops to restart the process since the schedule has changed
              return;
            }
          }
        }
      });
    }
  }

  private redistributeSessionsForBalance(): void {
    const STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
    const MAX_ITERATIONS = 50;
    
    // Build complete date range from first scheduled day to last exam
    const firstDate = this.schedule.length > 0 
      ? new Date(Math.min(...this.schedule.map(d => d.date.getTime())))
      : new Date(this.inputs.start_date);
    const lastExamDate = new Date(Math.max(...this.inputs.exams.map(e => e.exam_date.getTime())));
    
    // Create a map of all days in the range with their session counts
    const getAllDayLoads = (): Map<string, { date: Date, sessions: number, schedule: DailySchedule | null }> => {
      const dayLoads = new Map<string, { date: Date, sessions: number, schedule: DailySchedule | null }>();
      
      for (let d = new Date(firstDate); d < lastExamDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const existingDay = this.schedule.find(s => s.date.toISOString().split('T')[0] === dateStr);
        dayLoads.set(dateStr, {
          date: new Date(d),
          sessions: existingDay ? existingDay.total_hours / STUDY_CHUNK_HOURS : 0,
          schedule: existingDay || null
        });
      }
      return dayLoads;
    };

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      const dayLoads = getAllDayLoads();
      const days = Array.from(dayLoads.values());
      
      // Find the day with max sessions and day with min sessions
      let maxDay = days.reduce((max, d) => d.sessions > max.sessions ? d : max, days[0]);
      let minDay = days.reduce((min, d) => d.sessions < min.sessions ? d : min, days[0]);
      
      // If difference is 1 or less, schedule is balanced
      if (maxDay.sessions - minDay.sessions <= 1) {
        break;
      }
      
      // Find a subject we can move from maxDay to minDay
      // Must be: not a review day, and minDay must be before the exam
      if (!maxDay.schedule) continue;
      
      let moved = false;
      
      // Sort subjects by exam date (furthest first - most flexible to move)
      const subjectsOnMaxDay = Object.keys(maxDay.schedule.subjects)
        .map(id => ({ id, exam: this.inputs.exams.find(e => e.id === id) }))
        .filter(s => s.exam)
        .sort((a, b) => b.exam!.exam_date.getTime() - a.exam!.exam_date.getTime());
      
      for (const { id: subjectId, exam } of subjectsOnMaxDay) {
        if (!exam) continue;
        
        // Check if maxDay is the review day for this subject
        const reviewDate = new Date(exam.exam_date.getTime() - 24 * 60 * 60 * 1000);
        const isReviewDay = reviewDate.toISOString().split('T')[0] === maxDay.date.toISOString().split('T')[0];
        if (isReviewDay) continue;
        
        // Check if minDay is before this exam (can't study after exam)
        if (minDay.date >= exam.exam_date) continue;
        
        // Move one session from maxDay to minDay
        maxDay.schedule.subjects[subjectId] -= STUDY_CHUNK_HOURS;
        maxDay.schedule.total_hours -= STUDY_CHUNK_HOURS;
        if (maxDay.schedule.subjects[subjectId] <= 0) {
          delete maxDay.schedule.subjects[subjectId];
        }
        
        // Add to minDay (create if doesn't exist)
        let targetDay = minDay.schedule;
        if (!targetDay) {
          targetDay = { date: new Date(minDay.date), total_hours: 0, subjects: {} };
          this.schedule.push(targetDay);
        }
        targetDay.subjects[subjectId] = (targetDay.subjects[subjectId] || 0) + STUDY_CHUNK_HOURS;
        targetDay.total_hours += STUDY_CHUNK_HOURS;
        
        moved = true;
        break;
      }
      
      if (!moved) break; // No valid moves found
    }

    this.schedule.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private ensureFinalReviewSessions(): void {
    const STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;

    for (const exam of this.inputs.exams) {
      const subjectId = exam.id;
      const examDate = new Date(exam.exam_date);
      const reviewDate = new Date(examDate.getTime() - (24 * 60 * 60 * 1000));
      const reviewDateStr = reviewDate.toISOString().split('T')[0];

      // 1. Check if a review session already exists
      const reviewDaySchedule = this.schedule.find(d => d.date.toISOString().split('T')[0] === reviewDateStr);
      if (reviewDaySchedule && reviewDaySchedule.subjects[subjectId] > 0) {
        continue; // Final review session already exists, do nothing.
      }

      // 2. Find the busiest day for this subject to steal a chunk from
      let donorDay: DailySchedule | null = null;
      let maxHours = 0;

      for (const day of this.schedule) {
        const hours = day.subjects[subjectId] || 0;
        if (hours > maxHours) {
          maxHours = hours;
          donorDay = day;
        }
      }

      if (!donorDay) {
        continue; // No sessions were scheduled for this subject, so nothing to move.
      }

      // 3. Steal a chunk from the donor day
      donorDay.subjects[subjectId] -= STUDY_CHUNK_HOURS;
      donorDay.total_hours -= STUDY_CHUNK_HOURS;
      if (donorDay.subjects[subjectId] <= 0) {
        delete donorDay.subjects[subjectId];
      }

      // 4. Give the chunk to the review day
      let recipientDay = this.schedule.find(d => d.date.toISOString().split('T')[0] === reviewDateStr);
      if (!recipientDay) {
        // If the review day doesn't exist in the schedule, create it.
        recipientDay = { date: reviewDate, total_hours: 0, subjects: {} };
        this.schedule.push(recipientDay);
      }

      // Only add if there's capacity
      if (recipientDay.total_hours + STUDY_CHUNK_HOURS <= this.inputs.daily_max_hours) {
        recipientDay.subjects[subjectId] = (recipientDay.subjects[subjectId] || 0) + STUDY_CHUNK_HOURS;
        recipientDay.total_hours += STUDY_CHUNK_HOURS;
      } else {
        // If no capacity, return the chunk to the donor
        donorDay.subjects[subjectId] = (donorDay.subjects[subjectId] || 0) + STUDY_CHUNK_HOURS;
        donorDay.total_hours += STUDY_CHUNK_HOURS;
      }
    }

    // Sort the schedule by date again as we might have added new days
    this.schedule.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private checkEarlyCompletion(subject: InternalSubjectState, hoursToAssign: number): boolean {
    const EARLY_COMPLETION_DAYS = 2;
    // If we're already within the critical window (≤3 days), allow completion
    // This prevents gaps right before exams (rule §3.2)
    if (subject.days_to_exam <= 3) {
      return true;
    }
    // Otherwise, enforce the early completion rule
    if (subject.remaining_hours - hoursToAssign <= 0 && subject.days_to_exam > EARLY_COMPLETION_DAYS) {
      return false;
    }
    return true;
  }

  private checkSubjectDominance(subjectId: string, hoursToAssign: number, day: DailySchedule): boolean {
    // §3.4: This rule should only apply when multiple subjects are being juggled.
    const activeSubjectsCount = this.subjects.filter(s => s.state === 'ACTIVE').length;
    if (activeSubjectsCount <= 1) {
      return true; // Ignore this rule if there's only one subject to focus on.
    }

    // This rule should not prevent the very first chunk of the day.
    if (day.total_hours === 0) {
      return true; // OK
    }

    const proposedSubjectHours = (day.subjects[subjectId] || 0) + hoursToAssign;
    const proposedTotalHours = day.total_hours + hoursToAssign;
    if (proposedSubjectHours / proposedTotalHours > 0.5) {
      return false; // Violation
    }
    return true; // OK
  }

  private calculatePriorityScore(subject: InternalSubjectState): number {
    // Simplified priority: Focus on subjects with more work left and that haven't been studied recently.
    const totalInitialHours = this.calculateTotalHours(this.inputs.exams.find(e => e.id === subject.id)!);
    const progress = totalInitialHours > 0 ? subject.remaining_hours / totalInitialHours : 0; // Higher is more urgent
    const daysSinceLast = subject.last_study_day ? (new Date().getTime() - subject.last_study_day.getTime()) / (1000 * 3600 * 24) : 0;

    // Weights are tuned to favor progress (subjects with more hours left) and recency.
    let priority = (progress * 0.8) + (daysSinceLast * 0.2);

    // This massive bonus ensures the final review session is prioritized above all else.
    if (subject.days_to_exam === 1) {
      priority += 1000;
    }

    return isNaN(priority) ? 0 : priority;
  }
}
