import { ExamData, UserInputs, ExistingSession } from '../../advancedScheduler';

const getFutureDate = (daysAhead: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(12, 0, 0, 0);
  return date;
};

// --- Single Exam Scenario ---
export const singleExamFixture: UserInputs = {
  daily_max_hours: 4,
  adjustment_percentage: 10,
  session_duration: 60,
  start_date: new Date(),
  enable_daily_limits: true,
  soft_daily_limit: 2,
  exams: [
    {
      id: 'exam1',
      subject: 'Math',
      exam_date: getFutureDate(10), // Exam in 10 days
      difficulty: 3,
      confidence: 3,
      user_estimated_total_hours: 15,
      can_study_after_exam: false,
    }
  ]
};

// --- Standard Workload (Multiple Exams) ---
export const standardWorkloadFixture: UserInputs = {
  daily_max_hours: 6,
  adjustment_percentage: 10,
  session_duration: 60, // 1 hour chunks
  start_date: new Date(),
  enable_daily_limits: true,
  soft_daily_limit: 3,
  exams: [
    {
      id: 'exam1',
      subject: 'History',
      exam_date: getFutureDate(14),
      difficulty: 4,
      confidence: 3,
      user_estimated_total_hours: 10,
      can_study_after_exam: false,
    },
    {
      id: 'exam2',
      subject: 'Physics',
      exam_date: getFutureDate(21),
      difficulty: 5,
      confidence: 2,
      user_estimated_total_hours: 20,
      can_study_after_exam: false,
    }
  ]
};

// --- Heavy/Overloaded Scenario ---
// More hours required than available days * daily_max_hours
export const heavyWorkloadFixture: UserInputs = {
  daily_max_hours: 4, // Strict max
  adjustment_percentage: 10,
  session_duration: 60,
  start_date: new Date(),
  enable_daily_limits: true,
  soft_daily_limit: 4,
  exams: [
    {
      id: 'exam1',
      subject: 'Biology',
      exam_date: getFutureDate(5), // Exam in 5 days
      difficulty: 5,
      confidence: 1,
      user_estimated_total_hours: 30, // Need 30 hours in 5 days, max is 4/day (20 total). Impossible.
      can_study_after_exam: false,
    },
    {
      id: 'exam2',
      subject: 'Chemistry',
      exam_date: getFutureDate(5),
      difficulty: 5,
      confidence: 2,
      user_estimated_total_hours: 10,
      can_study_after_exam: false,
    }
  ]
};

// --- Scenario to trigger 3.5 Active exam protection & 3.2 empty days near exams ---
// An exam far away, and another exam very close.
export const activeExamProtectionFixture: UserInputs = {
  daily_max_hours: 8,
  adjustment_percentage: 0,
  session_duration: 60,
  start_date: new Date(),
  enable_daily_limits: false,
  exams: [
    {
      id: 'exam-close',
      subject: 'Close Exam',
      exam_date: getFutureDate(2),
      difficulty: 3,
      confidence: 3,
      user_estimated_total_hours: 6,
      can_study_after_exam: false,
    },
    {
      id: 'exam-far',
      subject: 'Far Exam',
      exam_date: getFutureDate(20),
      difficulty: 3,
      confidence: 3,
      user_estimated_total_hours: 5,
      can_study_after_exam: false,
    }
  ]
};
