// V1 Study Planner Algorithm

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

  constructor(inputs: UserInputs) {
    this.inputs = inputs;
    this.subjects = this.initializeInternalState(inputs.exams);
  }

  private getExistingHoursForDate(date: Date): number {
    if (!this.inputs.existing_sessions) return 0;
    
    const dateStr = date.toISOString().split('T')[0];
    const totalHours = this.inputs.existing_sessions
      .filter(session => session.date.toISOString().split('T')[0] === dateStr)
      .reduce((total, session) => total + session.duration, 0);
    
    console.log(`  📅 ${dateStr}: Existing hours = ${totalHours}/${this.inputs.daily_max_hours}`);
    return totalHours;
  }

  private calculateTotalHours(exam: ExamData): number {
    const maxAdjustmentPercent = Math.min(this.inputs.adjustment_percentage, 25) / 100;
    const difficultyMultiplier = 1 + (exam.difficulty - 3) * maxAdjustmentPercent;
    const confidenceMultiplier = 1 - (exam.confidence - 3) * maxAdjustmentPercent;
    const adjustmentFactor = (difficultyMultiplier + confidenceMultiplier) / 2;
    const calculatedHours = exam.user_estimated_total_hours * adjustmentFactor;
    return Math.max(1, Math.round(calculatedHours));
  }

  private initializeInternalState(exams: ExamData[]): InternalSubjectState[] {
    return exams.map(exam => ({
      id: exam.id,
      subject: exam.subject,
      exam_date: exam.exam_date,
      remaining_hours: this.calculateTotalHours(exam),
      days_to_exam: 0,
      last_study_day: null,
      state: 'ACTIVE',
      original_difficulty: exam.difficulty,
      original_confidence: exam.confidence,
    }));
  }

  public generatePlan(): DailySchedule[] | { error: string; choices: string[] } | ScheduleResult {
    const lastExamDate = new Date(Math.max(...this.inputs.exams.map(e => e.exam_date.getTime())));
    const totalRequiredHours = this.subjects.reduce((sum, s) => sum + s.remaining_hours, 0);
    const totalAvailableDays = (lastExamDate.getTime() - this.inputs.start_date.getTime()) / (1000 * 3600 * 24);
    const maxPossibleHours = totalAvailableDays * this.inputs.daily_max_hours;

    console.log(`V1 Plan Generation Start: ${this.inputs.start_date.toISOString()} to ${lastExamDate.toISOString()}`);
    console.log(`Total required hours: ${totalRequiredHours}, Max possible hours: ${maxPossibleHours}`);

    // Remove the early failure check - always try to schedule even if overloaded

    let currentDate = new Date(this.inputs.start_date);
    while (currentDate <= lastExamDate) {
      this.subjects.forEach(subject => {
        subject.days_to_exam = Math.ceil((subject.exam_date.getTime() - currentDate.getTime()) / (1000 * 3600 * 24));
        if (subject.days_to_exam < 0 && !this.inputs.exams.find(e => e.id === subject.id)!.can_study_after_exam) {
          subject.state = 'DONE';
          subject.remaining_hours = 0;
        }
      });

      const daySchedule: DailySchedule = { date: new Date(currentDate), total_hours: 0, subjects: {} };
      const STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
      
      // Get existing hours for this day
      const existingHours = this.getExistingHoursForDate(currentDate);
      const remainingCapacity = this.inputs.daily_max_hours - existingHours;

      console.log(`\n--- 📋 Planning for Day: ${currentDate.toISOString().split('T')[0]} ---`);
      console.log(`📊 Capacity: ${existingHours} used, ${remainingCapacity} available`);

      let chunksScheduled = 0;
      let isOverloaded = false;
      
      // Try to schedule sessions for any subject that needs time
      // Continue scheduling even if overloaded, but track the overload
      while (true) {
        const eligibleSubjects = this.subjects.filter(s => {
          const isActive = s.state === 'ACTIVE' && s.remaining_hours >= STUDY_CHUNK_HOURS;
          if (!isActive) return false;

          const notTooEarly = this.checkEarlyCompletion(s, STUDY_CHUNK_HOURS);
          if (!notTooEarly) {
            console.log(`    ❌ ${s.subject}: Would complete too early`);
            return false;
          }
          return true;
        });

        if (eligibleSubjects.length === 0) {
          console.log('    🚫 No eligible subjects need more study time');
          break;
        }

        // Sort by priority and pick the best subject
        eligibleSubjects.sort((a, b) => this.calculatePriorityScore(b) - this.calculatePriorityScore(a));
        const bestSubject = eligibleSubjects[0];
        
        // Check if this would cause overload
        const wouldBeOverloaded = (existingHours + daySchedule.total_hours + STUDY_CHUNK_HOURS) > this.inputs.daily_max_hours;
        
        if (wouldBeOverloaded && !isOverloaded) {
          console.log(`    ⚠️  OVERLOAD WARNING: Exceeding daily limit of ${this.inputs.daily_max_hours}h`);
          isOverloaded = true;
        }
        
        console.log(`    ${wouldBeOverloaded ? '🔴' : '✅'} Scheduling ${STUDY_CHUNK_HOURS}h for ${bestSubject.subject} (Priority: ${this.calculatePriorityScore(bestSubject).toFixed(2)})`);
        
        daySchedule.subjects[bestSubject.id] = (daySchedule.subjects[bestSubject.id] || 0) + STUDY_CHUNK_HOURS;
        daySchedule.total_hours += STUDY_CHUNK_HOURS;
        bestSubject.remaining_hours -= STUDY_CHUNK_HOURS;
        bestSubject.last_study_day = new Date(currentDate);
        
        if (bestSubject.remaining_hours <= 0) {
          bestSubject.state = 'DONE';
          console.log(`    🎉 ${bestSubject.subject} is now COMPLETED!`);
        }
        
        chunksScheduled++;
        
        // Stop if all subjects are done
        if (this.subjects.every(s => s.state === 'DONE')) {
          break;
        }
      }

      // Mark overload if applicable
      if (daySchedule.total_hours > remainingCapacity) {
        daySchedule.is_overloaded = true;
        daySchedule.overload_amount = daySchedule.total_hours - remainingCapacity;
        console.log(`  🔴 OVERLOAD: ${daySchedule.overload_amount.toFixed(1)}h over limit (${daySchedule.total_hours}h scheduled, ${remainingCapacity}h available)`);
      }

      if (daySchedule.total_hours > 0) {
        this.schedule.push(daySchedule);
        console.log(`  📝 Scheduled ${daySchedule.total_hours}h today across ${Object.keys(daySchedule.subjects).length} subjects`);
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Always return the schedule, even if overloaded
    const overloadedDays = this.schedule.filter(day => day.is_overloaded);
    const totalOverloadHours = overloadedDays.reduce((sum, day) => sum + (day.overload_amount || 0), 0);
    
    if (totalOverloadHours > 0) {
      console.log(`\n🔴 SCHEDULE OVERLOAD: ${totalOverloadHours.toFixed(1)}h over limits across ${overloadedDays.length} days`);
      
      // Return schedule with overload information
      return {
        schedule: this.schedule,
        overload_info: {
          total_overload_hours: totalOverloadHours,
          overloaded_days: overloadedDays.length,
          message: `Schedule exceeds daily limits by ${totalOverloadHours.toFixed(1)}h total. Overloaded sessions will be displayed in red.`
        }
      };
    }

    return { schedule: this.schedule };
  }

  private checkEarlyCompletion(subject: InternalSubjectState, hoursToAssign: number): boolean {
    const EARLY_COMPLETION_DAYS = 2;
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
    const w1 = 1.5, w2 = 1.0, w3 = 0.8, w4 = 0.5;
    const daysSinceLastStudy = subject.last_study_day ? (new Date().getTime() - subject.last_study_day.getTime()) / (1000 * 3600 * 24) : 100;
    const totalInitialHours = this.calculateTotalHours(this.inputs.exams.find(e => e.id === subject.id)!);
    const remainingHoursRatio = subject.remaining_hours / totalInitialHours;

    // Prevent division by zero or negative days for urgency calculation.
    const effectiveDaysToExam = Math.max(0, subject.days_to_exam);
    const urgencyScore = w1 * (1 / (effectiveDaysToExam + 0.1));

    const workloadScore = w2 * remainingHoursRatio;
    const recencyScore = w3 * Math.log1p(daysSinceLastStudy);
    const difficultyScore = w4 * (subject.original_difficulty * (6 - subject.original_confidence)) / 25;
    const score = urgencyScore + workloadScore + recencyScore + difficultyScore;

    // Handle potential NaN from remainingHoursRatio if totalInitialHours is 0
    return isNaN(score) ? 0 : score;
  }
}
