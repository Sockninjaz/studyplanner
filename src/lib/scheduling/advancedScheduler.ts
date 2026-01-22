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

interface UserInputs {
  daily_max_hours: number;
  start_date: Date;
  exams: ExamData[];
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
}

export class StudyPlannerV1 {
  private inputs: UserInputs;
  private subjects: InternalSubjectState[];
  private schedule: DailySchedule[] = [];

  constructor(inputs: UserInputs) {
    this.inputs = inputs;
    this.subjects = this.initializeInternalState(inputs.exams);
  }

  private calculateTotalHours(exam: ExamData): number {
    const difficultyMultiplier = 1 + (exam.difficulty - 3) * 0.25;
    const confidenceMultiplier = 1 - (exam.confidence - 3) * 0.25;
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

  public generatePlan(): DailySchedule[] | { error: string; choices: string[] } {
    const lastExamDate = new Date(Math.max(...this.inputs.exams.map(e => e.exam_date.getTime())));
    const totalRequiredHours = this.subjects.reduce((sum, s) => sum + s.remaining_hours, 0);
    const totalAvailableDays = (lastExamDate.getTime() - this.inputs.start_date.getTime()) / (1000 * 3600 * 24);
    const maxPossibleHours = totalAvailableDays * this.inputs.daily_max_hours;

    console.log(`V1 Plan Generation Start: ${this.inputs.start_date.toISOString()} to ${lastExamDate.toISOString()}`);
    console.log(`Total required hours: ${totalRequiredHours}, Max possible hours: ${maxPossibleHours}`);

    if (totalRequiredHours > maxPossibleHours) {
      return {
        error: 'Overload: Total required hours exceed maximum possible study time.',
        choices: ['Increase daily max', 'Reduce all subjects proportionally', 'Sacrifice lowest-priority subjects'],
      };
    }

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
      const STUDY_CHUNK_HOURS = 0.5;

      console.log(`\n--- Planning for Day: ${currentDate.toISOString().split('T')[0]} ---`);

      while (daySchedule.total_hours < this.inputs.daily_max_hours) {
        const eligibleSubjects = this.subjects.filter(s => {
          const isActive = s.state === 'ACTIVE';
          if (!isActive) return false;

          const notTooEarly = this.checkEarlyCompletion(s, STUDY_CHUNK_HOURS);
          if (!notTooEarly) {
            console.log(`  - Subject ${s.subject} rejected (rule §3.1): Would complete too early.`);
            return false;
          }
          return true;
        });

        if (eligibleSubjects.length === 0) {
          console.log('  - No eligible subjects to schedule today.');
          break;
        }

        eligibleSubjects.sort((a, b) => this.calculatePriorityScore(b) - this.calculatePriorityScore(a));
        let subjectAssigned = false;

        for (const bestSubject of eligibleSubjects) {
          console.log(`  - Trying subject: ${bestSubject.subject} (Score: ${this.calculatePriorityScore(bestSubject).toFixed(2)})`);
          const canAssign = this.checkSubjectDominance(bestSubject.id, STUDY_CHUNK_HOURS, daySchedule);
          if (canAssign) {
            console.log(`    -> Assigning ${STUDY_CHUNK_HOURS * 60} mins to ${bestSubject.subject}`);
            daySchedule.subjects[bestSubject.id] = (daySchedule.subjects[bestSubject.id] || 0) + STUDY_CHUNK_HOURS;
            daySchedule.total_hours += STUDY_CHUNK_HOURS;
            bestSubject.remaining_hours -= STUDY_CHUNK_HOURS;
            bestSubject.last_study_day = new Date(currentDate);
            if (bestSubject.remaining_hours <= 0) {
              bestSubject.state = 'DONE';
              console.log(`    -> Subject ${bestSubject.subject} is now DONE.`);
            }
            subjectAssigned = true;
            break;
          } else {
            console.log(`    -> Cannot assign to ${bestSubject.subject} (rule §3.4): Subject dominance.`);
          }
        }

        if (!subjectAssigned) {
          console.log('  - Could not assign any subject this chunk (all top priorities failed dominance check).');
          break;
        }
      }

      const isNearActiveExam = this.subjects.some(s => s.state === 'ACTIVE' && s.days_to_exam <= 3);
      if (isNearActiveExam && daySchedule.total_hours === 0) {
        console.log('  - Forcing session due to rule §3.2 (No empty days near exams).');
        const eligibleSubjects = this.subjects.filter(s => s.state === 'ACTIVE');
        if (eligibleSubjects.length > 0) {
          eligibleSubjects.sort((a, b) => this.calculatePriorityScore(b) - this.calculatePriorityScore(a));
          const bestSubject = eligibleSubjects[0];
          daySchedule.subjects[bestSubject.id] = (daySchedule.subjects[bestSubject.id] || 0) + STUDY_CHUNK_HOURS;
          daySchedule.total_hours += STUDY_CHUNK_HOURS;
          bestSubject.remaining_hours -= STUDY_CHUNK_HOURS;
          bestSubject.last_study_day = new Date(currentDate);
          if (bestSubject.remaining_hours <= 0) { bestSubject.state = 'DONE'; }
          console.log(`    -> Forced assignment of ${STUDY_CHUNK_HOURS * 60} mins to ${bestSubject.subject}`);
        }
      }

      if (daySchedule.total_hours > 0) {
        this.schedule.push(daySchedule);
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    const remainingTotalHours = this.subjects.reduce((sum, s) => s.state === 'ACTIVE' ? sum + s.remaining_hours : sum, 0);
    if (remainingTotalHours > 1) {
      console.warn('Could not schedule all hours due to constraints.');
      return {
        error: `Overload: Could not schedule ${Math.round(remainingTotalHours)} hours due to constraints like 'no early completion'.`,
        choices: ['Increase daily max', 'Reduce subject hours', 'Allow earlier completion'],
      };
    }

    return this.schedule;
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
