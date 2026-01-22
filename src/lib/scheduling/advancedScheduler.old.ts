import { IExam, IStudyMaterial } from '@/models/Exam';
import { IStudySession } from '@/models/StudySession';

interface StudySession {
  title: string;
  subject: string;
  startTime: Date;
  endTime: Date;
  duration: number; // in minutes
  checklist: Array<{
    task: string;
    completed: boolean;
  }>;
  isCompleted: boolean;
}

interface ExamData {
  _id: any; // ObjectId from mongoose
  subject: string;
  date: Date;
  user: any; // ObjectId from mongoose
  studyMaterials: IStudyMaterial[];
}

interface ExamWithPriority extends ExamData {
  priority: number;
  studyDays: number;
  materialsWithPriority: Array<{
    material: IStudyMaterial;
    priority: number;
    sessionsNeeded: number;
  }>;
  normalizedMaterials?: MaterialUnit[];
  totalUnits?: number;
}

/**
   * Material unit interface for normalized study content
   */
interface MaterialUnit {
  id: string;
  name: string;
  type: 'chapter' | 'topic' | 'unit' | 'subunit';
  difficulty: number;
  completed: boolean;
  parentMaterial?: string;
}

export class AdvancedScheduler {
  private readonly DEFAULT_MAX_SESSIONS_PER_DAY = 3;
  private readonly ABSOLUTE_MAX_SESSIONS_PER_DAY = 8;

  constructor(private userMaxSessionsPerDay?: number) {
    // Validate user override
    if (userMaxSessionsPerDay && userMaxSessionsPerDay > this.ABSOLUTE_MAX_SESSIONS_PER_DAY) {
      console.warn(`User requested ${userMaxSessionsPerDay} sessions/day, limiting to ${this.ABSOLUTE_MAX_SESSIONS_PER_DAY} for health reasons`);
      this.userMaxSessionsPerDay = this.ABSOLUTE_MAX_SESSIONS_PER_DAY;
    }
  }

  private getMaxSessionsPerDay(): number {
    return this.userMaxSessionsPerDay || this.DEFAULT_MAX_SESSIONS_PER_DAY;
  }

  private readonly SESSION_DURATION = 60; // minutes
  private readonly BUFFER_DAYS_BEFORE_EXAM = 2;

  /**
   * Calculate optimal study time based on difficulty and confidence
   */
  private calculateStudyTime(difficulty: number, confidence: number): number {
    const baseTime = 120; // minutes (2 hours base)
    const difficultyMultiplier = 0.8 + (difficulty * 0.15); // 0.95 to 1.55
    const confidencePenalty = (5 - confidence) * 0.2; // 0 to 0.8
    const totalTime = baseTime * difficultyMultiplier + (baseTime * confidencePenalty);
    console.log(`Study time calculation: difficulty=${difficulty}, confidence=${confidence}, time=${Math.round(totalTime)}min`);
    return Math.round(totalTime);
  }

  /**
   * Calculate sessions needed based on study time and material complexity
   */
  private calculateSessionsNeeded(studyTimeMinutes: number, difficulty: number, confidence: number): number {
    // Base: 1 session per 60 minutes
    let sessions = Math.ceil(studyTimeMinutes / 60);
    
    // Adjust based on difficulty/confidence gap
    const difficultyConfidenceGap = difficulty - confidence;
    
    if (difficultyConfidenceGap >= 3) {
      // Much harder than confident - need more sessions
      sessions = Math.max(sessions + 1, 4);
      console.log(`High difficulty/confidence gap (${difficultyConfidenceGap}): increased sessions to ${sessions}`);
    } else if (difficultyConfidenceGap <= -2) {
      // Much more confident than difficulty - can reduce sessions
      sessions = Math.max(sessions - 1, 2);
      console.log(`Low difficulty/confidence gap (${difficultyConfidenceGap}): reduced sessions to ${sessions}`);
    }
    
    // Ensure minimum and maximum
    sessions = Math.max(2, Math.min(sessions, 6));
    
    console.log(`Final sessions needed: ${sessions} (for ${studyTimeMinutes} minutes)`);
    return sessions;
  }

  /**
   * Parse user input into material chapters (simple division)
   */
  private parseMaterialChapters(input: string): string[] {
    console.log(`Parsing material input: "${input}"`);
    
    // Trim whitespace
    const cleanInput = input.trim();
    const chapters: string[] = [];
    
    // Pattern 1: Range (e.g., "Chapter 1-4", "Topics A-C")
    const rangeMatch = cleanInput.match(/(.+?)\s*(\d+)[-\s](\d+)/i);
    if (rangeMatch) {
      const [, prefix, start, end] = rangeMatch;
      const startNum = parseInt(start);
      const endNum = parseInt(end);
      
      for (let i = startNum; i <= endNum; i++) {
        chapters.push(`${prefix.trim()} ${i}`);
      }
      
      console.log(`Parsed range: ${chapters.length} chapters from ${startNum} to ${endNum}`);
      return chapters;
    }
    
    // Pattern 2: List (e.g., "Chapters 1,2,3", "Units 1, 2, 3")
    const listMatch = cleanInput.match(/(.+?)\s*[\s:,]+\s*([\d\s,]+)/i);
    if (listMatch) {
      const [, prefix, numbersStr] = listMatch;
      const numbers = numbersStr.split(/[\s,]+/).filter(n => n.trim());
      
      numbers.forEach(num => {
        const unitNum = parseInt(num);
        if (!isNaN(unitNum)) {
          chapters.push(`${prefix.trim()} ${unitNum}`);
        }
      });
      
      console.log(`Parsed list: ${chapters.length} chapters`);
      return chapters;
    }
    
    // Pattern 3: Single item - just return as is
    console.log(`Parsed single: ${cleanInput}`);
    return [cleanInput];
  }

  /**
   * Get next chapter for an exam (round-robin through parsed chapters)
   */
  private getNextChapterForExam(exam: ExamWithPriority, sessionCount: number) {
    const materials = exam.materialsWithPriority;
    if (materials.length === 0) return null;
    
    // Parse chapters for this material
    const material = materials[sessionCount % materials.length];
    const chapters = this.parseMaterialChapters(material.material.chapter);
    
    if (chapters.length === 0) return material;
    
    // Round-robin through chapters
    const chapterIndex = Math.floor(sessionCount / materials.length) % chapters.length;
    const selectedChapter = chapters[chapterIndex];
    
    return {
      material: {
        ...material.material,
        chapter: selectedChapter
      },
      priority: material.priority,
      sessionsNeeded: material.sessionsNeeded
    };
  }

  /**
   * Calculate total available study days until the last exam
   */
  private calculateAvailableStudyDays(exams: ExamWithPriority[]): number {
    const today = new Date();
    const latestExam = exams.reduce((latest, exam) => 
      exam.date > latest.date ? exam : latest
    );
    
    return Math.max(1, Math.ceil((latestExam.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) - this.BUFFER_DAYS_BEFORE_EXAM);
  }

  /**
   * Validate exam inputs and detect edge cases
   */
  private validateExamInputs(exams: ExamWithPriority[]): {
    isValid: boolean;
    warnings: string[];
    edgeCases: string[];
  } {
    const warnings: string[] = [];
    const edgeCases: string[] = [];
    
    // Check for past exam dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const pastExams = exams.filter(exam => exam.date < today);
    if (pastExams.length > 0) {
      edgeCases.push('past_exam_dates');
      warnings.push(`⚠️ ${pastExams.length} exam(s) have dates in the past`);
    }
    
    // Check for same-day exams
    const examDates = exams.map(e => e.date.toISOString().split('T')[0]);
    const duplicateDates = examDates.filter((date, index) => examDates.indexOf(date) !== index);
    if (duplicateDates.length > 0) {
      edgeCases.push('same_day_exams');
      warnings.push(`⚠️ Multiple exams on same day: ${Array.from(new Set(duplicateDates)).join(', ')}`);
    }
    
    // Check for extreme workload
    const totalSessions = exams.reduce((sum, exam) => 
      sum + exam.materialsWithPriority.reduce((matSum, mat) => matSum + mat.sessionsNeeded, 0), 0
    );
    const daysUntilFirstExam = Math.min(...exams.map(e => 
      Math.max(1, Math.ceil((e.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
    ));
    
    if (totalSessions > daysUntilFirstExam * this.getMaxSessionsPerDay()) {
      edgeCases.push('extreme_workload');
      warnings.push(`⚠️ High workload: ${totalSessions} sessions in ${daysUntilFirstExam} days`);
    }
    
    return {
      isValid: pastExams.length === 0,
      warnings,
      edgeCases
    };
  }

  /**
   * Handle edge cases with specific strategies
   */
  private handleEdgeCases(edgeCases: string[], exams: ExamWithPriority[]): {
    shouldContinue: boolean;
    strategy: string;
  } {
    if (edgeCases.includes('past_exam_dates')) {
      return {
        shouldContinue: false,
        strategy: 'reject_past_exams'
      };
    }
    
    if (edgeCases.includes('same_day_exams')) {
      return {
        shouldContinue: true,
        strategy: 'prioritize_by_difficulty'
      };
    }
    
    if (edgeCases.includes('extreme_workload')) {
      return {
        shouldContinue: true,
        strategy: 'intensive_mode'
      };
    }
    
    return {
      shouldContinue: true,
      strategy: 'normal'
    };
  }

  /**
   * Check if schedule is feasible and provide warnings
   */
  private checkScheduleFeasibility(exams: ExamWithPriority[], availableDays: number): {
    feasible: boolean;
    warning?: string;
    suggestedIntensity?: number;
  } {
    const totalSessionsNeeded = exams.reduce((sum, exam) => 
      sum + exam.materialsWithPriority.reduce((matSum, mat) => matSum + mat.sessionsNeeded, 0), 0
    );
    
    const maxPossibleSessions = availableDays * this.getMaxSessionsPerDay();
    
    if (totalSessionsNeeded > maxPossibleSessions) {
      const percentage = Math.round((maxPossibleSessions / totalSessionsNeeded) * 100);
      const suggestedIntensity = Math.min(
        Math.ceil(totalSessionsNeeded / availableDays),
        this.ABSOLUTE_MAX_SESSIONS_PER_DAY
      );
      
      return {
        feasible: false,
        warning: `Only ${percentage}% of required study time can be scheduled with current intensity (${this.getMaxSessionsPerDay()} sessions/day).`,
        suggestedIntensity
      };
    }
    
    return { feasible: true };
  }

  /**
   * Advanced scheduling algorithm that considers all exams
   */
  async scheduleStudySessions(
    newExam: ExamData,
    existingExams: ExamData[],
    existingSessions: IStudySession[]
  ): Promise<StudySession[]> {
    // Combine all exams including the new one
    const allExams = [...existingExams, newExam];
    
    console.log('=== ADVANCED SCHEDULING START ===');
    console.log(`Total exams: ${allExams.length}`);
    
    // Step 1: Analyze existing sessions
    const existingDistribution = this.analyzeExistingSessions(existingSessions);
    
    // Step 2: Prioritize exams (calculate sessions needed per exam)
    const prioritizedExams = this.prioritizeExams(allExams);
    
    console.log('Prioritized exams:', prioritizedExams.map(e => 
      `${e.subject}: ${e.materialsWithPriority.reduce((sum, m) => sum + m.sessionsNeeded, 0)} sessions needed`
    ));
    
    // Step 2.2: Validate inputs and detect edge cases
    const validation = this.validateExamInputs(prioritizedExams);
    
    if (validation.warnings.length > 0) {
      validation.warnings.forEach(warning => console.warn(warning));
    }
    
    if (!validation.isValid) {
      throw new Error('Invalid exam inputs: ' + validation.warnings.join(', '));
    }
    
    // Step 2.3: Handle edge cases
    const edgeCaseHandling = this.handleEdgeCases(validation.edgeCases, prioritizedExams);
    
    if (!edgeCaseHandling.shouldContinue) {
      throw new Error('Cannot schedule due to edge cases: ' + validation.edgeCases.join(', '));
    }
    
    console.log(`Using strategy: ${edgeCaseHandling.strategy}`);
    
    // Step 2.4: Check schedule feasibility
    const availableDays = this.calculateAvailableStudyDays(prioritizedExams);
    const feasibility = this.checkScheduleFeasibility(prioritizedExams, availableDays);
    
    if (!feasibility.feasible) {
      console.warn('⚠️ SCHEDULE FEASIBILITY WARNING:', feasibility.warning);
      if (feasibility.suggestedIntensity && feasibility.suggestedIntensity > this.getMaxSessionsPerDay()) {
        console.warn(`💡 Suggestion: Consider increasing intensity to ${feasibility.suggestedIntensity} sessions/day`);
      }
    }
    
    // Step 3: Create balanced schedule (SIMPLE - use calculated sessions)
    const schedule = this.createBalancedSchedule(prioritizedExams, existingDistribution);
    
    console.log(`=== SCHEDULING COMPLETE: ${schedule.length} sessions created ===`);
    return schedule;
  }

  /**
   * Prioritize exams based on exam date, difficulty, and confidence gaps
   */
  private prioritizeExams(exams: ExamData[]): ExamWithPriority[] {
    const now = new Date();
    
    return exams.map(exam => {
      console.log('Prioritizing exam:', exam);
      
      const daysUntilExam = Math.ceil((exam.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const studyDays = Math.max(1, daysUntilExam - this.BUFFER_DAYS_BEFORE_EXAM);
      
      // Calculate exam priority based on proximity and material difficulty
      const avgDifficulty = exam.studyMaterials.reduce((sum, m) => sum + m.difficulty, 0) / exam.studyMaterials.length;
      const avgConfidence = exam.studyMaterials.reduce((sum, m) => sum + m.confidence, 0) / exam.studyMaterials.length;
      const confidenceGap = 5 - avgConfidence;
      
      // Priority score: urgency + difficulty + confidence gap
      const urgencyScore = daysUntilExam <= 7 ? 10 : daysUntilExam <= 14 ? 7 : 4;
      const priority = urgencyScore + avgDifficulty + confidenceGap;
      
      // Calculate material priorities and sessions needed
      let totalSessions = 0;
      const materialsWithPriority = exam.studyMaterials.map(material => {
        const studyTimeNeeded = this.calculateStudyTime(material.difficulty, material.confidence);
        const sessionsNeeded = this.calculateSessionsNeeded(studyTimeNeeded, material.difficulty, material.confidence);
        
        totalSessions += sessionsNeeded;
        
        return {
          material,
          priority: (5 - material.confidence) + material.difficulty, // Higher priority for harder + less confident
          sessionsNeeded
        };
      });

      const prioritizedExam: ExamWithPriority = {
        _id: exam._id,
        subject: exam.subject,
        date: exam.date,
        user: exam.user,
        studyMaterials: exam.studyMaterials,
        priority,
        studyDays,
        materialsWithPriority
      };
      
      console.log('Prioritized exam:', prioritizedExam);
      return prioritizedExam;
    }).sort((a, b) => b.priority - a.priority);
  }

  /**
   * Analyze existing sessions to understand current distribution
   */
  private analyzeExistingSessions(sessions: IStudySession[]): Map<string, number> {
    const distribution = new Map<string, number>();
    
    sessions.forEach(session => {
      const dateKey = session.startTime.toISOString().split('T')[0];
      distribution.set(dateKey, (distribution.get(dateKey) || 0) + 1);
    });
    
    return distribution;
  }

  /**
   * Create balanced schedule - SIMPLE multi-exam distribution
   */
  private createBalancedSchedule(
    prioritizedExams: ExamWithPriority[],
    existingDistribution: Map<string, number>
  ): StudySession[] {
    const schedule: StudySession[] = [];
    const dailyLoad = new Map<string, number>(existingDistribution);
    
    console.log('Creating simple schedule for exams:', prioritizedExams.map(e => `${e.subject} (${e.date.toISOString().split('T')[0]})`));
    
    if (prioritizedExams.length === 1) {
      console.log('Single exam detected - using simple optimal scheduling');
      this.scheduleSingleExam(prioritizedExams[0], schedule, dailyLoad);
    } else {
      console.log('Multiple exams detected - using simple round-robin scheduling');
      this.scheduleMultipleExamsSimple(prioritizedExams, schedule, dailyLoad);
    }

    console.log(`Final schedule: ${schedule.length} sessions created`);
    return schedule.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  /**
   * Schedule multiple exams using SIMPLE round-robin distribution
   */
  private scheduleMultipleExamsSimple(
    prioritizedExams: ExamWithPriority[],
    schedule: StudySession[],
    dailyLoad: Map<string, number>
  ): void {
    console.log('=== SIMPLE MULTI-EXAM SCHEDULING ===');
    
    // Calculate all sessions needed (store original totals for pressure calculation)
    const allSessions: Array<{exam: ExamWithPriority, sessionsNeeded: number, originalSessionsNeeded: number, lastStudied?: Date}> = [];
    prioritizedExams.forEach(exam => {
      const sessionsNeeded = exam.materialsWithPriority.reduce((sum, mat) => sum + mat.sessionsNeeded, 0);
      // TODO: Get actual last studied date from existing sessions
      const lastStudied = undefined; // For now, assume never studied
      allSessions.push({ exam, sessionsNeeded, originalSessionsNeeded: sessionsNeeded, lastStudied });
      console.log(`Exam ${exam.subject}: needs ${sessionsNeeded} sessions`);
    });
    
    // Get all available study days
    const allStudyDays = this.getAllStudyDaysForSimple(prioritizedExams);
    console.log('Available study days:', allStudyDays);
    
    // Simple round-robin distribution across days with time-aware intensity
    let sessionIndex = 0;
    allStudyDays.forEach(day => {
      const currentLoad = dailyLoad.get(day) || 0;
      const remainingCapacity = Math.max(0, this.getMaxSessionsPerDay() - currentLoad);
      
      console.log(`Day ${day}: current load=${currentLoad}, remaining capacity=${remainingCapacity}`);
      
      if (remainingCapacity === 0) return;
      
      // Calculate time pressure for this day
      const daysUntilFirstExam = this.getDaysUntilFirstExam(prioritizedExams, day);
      const timePressure = this.calculateTimePressure(daysUntilFirstExam, allSessions);
      
      console.log(`Day ${day}: days_until_first_exam=${daysUntilFirstExam}, time_pressure=${timePressure}`);
      
      // Distribute sessions round-robin across exams with 2-layer priority system
      let allocatedToday = 0;
      
      // Calculate priority scores for all exams that still need sessions
      const examPriorities = allSessions
        .filter(sessionData => sessionData.sessionsNeeded > 0)
        .map(sessionData => ({
          exam: sessionData.exam,
          sessionsNeeded: sessionData.sessionsNeeded,
          priorityScore: this.calculateExamPriorityScore(sessionData.exam, sessionData.lastStudied)
        }))
        .sort((a, b) => a.priorityScore - b.priorityScore); // Lower score = higher priority
      
      console.log(`Day ${day} exam priorities:`, examPriorities.map(p => `${p.exam.subject} (${p.priorityScore.toFixed(2)})`));
      
      // IMPORTANT: Only allocate sessions that were originally calculated by Layer 1
      // Time pressure affects DISTRIBUTION, not total session count
      for (const priorityData of examPriorities) {
        if (allocatedToday >= remainingCapacity) break;
        
        const examSessions = allSessions.find(s => s.exam === priorityData.exam);
        
        if (examSessions && examSessions.sessionsNeeded > 0) {
          // Allocate ONLY 1 session per exam per day (unless under extreme pressure)
          // This respects the original session count from Layer 1
          const sessionsToAllocate = 1;
          
          if (allocatedToday + sessionsToAllocate <= remainingCapacity) {
            const material = this.getNextChapterForExam(examSessions.exam, sessionIndex);
            if (material) {
              const session = this.createSessionForMaterial(material.material, examSessions.exam, day);
              schedule.push(session);
              dailyLoad.set(day, currentLoad + allocatedToday + 1);
              examSessions.sessionsNeeded--;
              sessionIndex++;
              allocatedToday++;
              
              console.log(`Created session: ${material.material.chapter} on ${day} for ${examSessions.exam.subject} (priority: ${priorityData.priorityScore.toFixed(2)}, remaining: ${examSessions.sessionsNeeded})`);
            }
          }
        }
      }
    });
  }

  /**
   * Get days until first exam from a specific date
   */
  private getDaysUntilFirstExam(exams: ExamWithPriority[], fromDate: string): number {
    const date = new Date(fromDate);
    const firstExam = exams.reduce((earliest, exam) => 
      exam.date < earliest.date ? exam : earliest
    );
    return Math.max(0, Math.ceil((firstExam.date.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)));
  }

  /**
   * Calculate time pressure based on ORIGINAL sessions needed and time available
   */
  private calculateTimePressure(daysUntilFirstExam: number, allSessions: Array<{exam: ExamWithPriority, sessionsNeeded: number, originalSessionsNeeded: number}>): number {
    const totalOriginalSessions = allSessions.reduce((sum, s) => sum + s.originalSessionsNeeded, 0);
    
    if (daysUntilFirstExam <= 0) return 999; // Critical pressure
    if (totalOriginalSessions === 0) return 0; // No pressure
    
    // Pressure = ORIGINAL sessions needed / days available
    return totalOriginalSessions / daysUntilFirstExam;
  }

  /**
   * Calculate simple priority score for exam allocation
   * Layer 2: Session Allocation Pressure
   */
  private calculateExamPriorityScore(exam: ExamWithPriority, lastStudied?: Date): number {
    const today = new Date();
    const daysUntilExam = Math.max(0, Math.ceil((exam.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Calculate remaining sessions
    const remainingSessions = exam.materialsWithPriority.reduce((sum, mat) => sum + mat.sessionsNeeded, 0);
    
    // Time since last study (in days, 0 if never studied)
    const daysSinceLastStudy = lastStudied 
      ? Math.max(0, Math.ceil((today.getTime() - lastStudied.getTime()) / (1000 * 60 * 60 * 24)))
      : 999; // Never studied = high priority
    
    // Simple priority formula (lower score = higher priority)
    const urgencyScore = daysUntilExam * 1.0; // Sooner exam = higher priority
    const workloadScore = remainingSessions * 0.5; // More work = higher priority  
    const freshnessScore = daysSinceLastStudy * 0.3; // Longer since last study = higher priority
    
    const priorityScore = urgencyScore + workloadScore + freshnessScore;
    
    console.log(`Priority for ${exam.subject}: urgency=${urgencyScore}, workload=${workloadScore}, freshness=${freshnessScore}, total=${priorityScore.toFixed(2)}`);
    
    return priorityScore;
  }

  /**
   * Get all study days for simple scheduling
   */
  private getAllStudyDaysForSimple(exams: ExamWithPriority[]): string[] {
    const today = new Date();
    const latestExam = exams.reduce((latest, exam) => 
      exam.date > latest.date ? exam : latest
    );
    
    const days: string[] = [];
    let currentDate = new Date(today);
    
    // Include the day before latest exam (study until exam day - 1)
    const endDate = new Date(latestExam.date);
    endDate.setDate(endDate.getDate() - 1);
    
    while (currentDate <= endDate) {
      days.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  }

  /**
   * Get next material for an exam using NORMALIZED UNITS
   */
  private getNextMaterialForExam(exam: ExamWithPriority, sessionCount: number) {
    // Use NORMALIZED UNITS if available, fallback to old system
    if (exam.normalizedMaterials && exam.normalizedMaterials.length > 0) {
      const materials = exam.normalizedMaterials;
      const materialIndex = sessionCount % materials.length;
      return {
        material: {
          chapter: materials[materialIndex].name,
          difficulty: materials[materialIndex].difficulty,
          confidence: 3, // Default confidence for normalized units
          completed: materials[materialIndex].completed
        } as IStudyMaterial,
        priority: 1,
        sessionsNeeded: 1
      };
    }
    
    // Fallback to old system
    const materials = exam.materialsWithPriority;
    if (materials.length === 0) return null;
    
    const materialIndex = sessionCount % materials.length;
    return materials[materialIndex];
  }

  /**
   * Get all study days for pressure-based scheduling
   */
  private getAllStudyDaysForPressure(exams: ExamWithPriority[]): string[] {
    const today = new Date();
    const latestExam = exams.reduce((latest, exam) => 
      exam.date > latest.date ? exam : latest
    );
    
    const days: string[] = [];
    let currentDate = new Date(today);
    
    // Include the day before latest exam (study until exam day - 1)
    const endDate = new Date(latestExam.date);
    endDate.setDate(endDate.getDate() - 1);
    
    while (currentDate <= endDate) {
      days.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  }

  /**
   * Schedule single exam - SIMPLE: continuous backwards from exam
   */
  private scheduleSingleExam(
    exam: ExamWithPriority,
    schedule: StudySession[],
    dailyLoad: Map<string, number>
  ): void {
    console.log(`Scheduling single exam: ${exam.subject} on ${exam.date.toISOString().split('T')[0]}`);
    
    // Calculate study days: work backwards from exam - CONTINUOUS DAYS
    const studyDays: string[] = [];
    const examDate = new Date(exam.date);
    
    // Generate study days with time-aware intensity
    const totalSessionsNeeded = exam.materialsWithPriority.reduce((sum, mat) => sum + mat.sessionsNeeded, 0);
    const today = new Date();
    const daysUntilExam = Math.max(1, Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) - this.BUFFER_DAYS_BEFORE_EXAM);
    
    // Calculate time pressure for intensity adjustment
    const timePressure = totalSessionsNeeded / daysUntilExam;
    
    console.log(`Single exam: ${totalSessionsNeeded} sessions needed, ${daysUntilExam} days available, pressure=${timePressure.toFixed(2)}`);
    
    // Generate days - create exactly enough days for all sessions
    // Time pressure affects how we pack sessions, not how many total sessions
    let sessionsRemaining = totalSessionsNeeded;
    let currentDate = new Date(examDate);
    currentDate.setDate(currentDate.getDate() - 1); // Start 1 day before exam
    
    while (sessionsRemaining > 0 && currentDate >= today) {
      // Calculate how many sessions to pack on this day based on pressure
      let sessionsToday;
      
      if (timePressure > 2.0) {
        // High pressure: pack up to 2 sessions per day
        sessionsToday = Math.min(2, sessionsRemaining);
      } else if (timePressure > 1.0) {
        // Medium pressure: pack up to 2 sessions per day but prefer 1
        sessionsToday = sessionsRemaining > daysUntilExam ? 2 : 1;
      } else {
        // Low pressure: 1 session per day
        sessionsToday = 1;
      }
      
      // Add the same day multiple times if stacking sessions
      for (let i = 0; i < sessionsToday; i++) {
        studyDays.push(currentDate.toISOString().split('T')[0]);
        sessionsRemaining--;
      }
      
      console.log(`Added ${sessionsToday} sessions on ${currentDate.toISOString().split('T')[0]} (${sessionsRemaining} remaining)`);
      currentDate.setDate(currentDate.getDate() - 1); // Move backwards
    }
    
    if (sessionsRemaining > 0) {
      console.warn(`⚠️ Could not schedule all ${totalSessionsNeeded} sessions. ${sessionsRemaining} sessions remaining.`);
    }
    
    console.log('Study days (backwards from exam):', studyDays);
    
    // Assign sessions to these days using CHAPTER DISTRIBUTION (FORWARD TOWARD EXAM)
    let sessionIndex = 0;
    exam.materialsWithPriority.forEach(({ material, sessionsNeeded }, materialIndex) => {
      console.log(`Material ${materialIndex + 1}: ${material.chapter}, needs ${sessionsNeeded} sessions`);
      
      // Parse chapters for this material
      const chapters = this.parseMaterialChapters(material.chapter);
      console.log(`Parsed chapters:`, chapters);
      
      for (let i = 0; i < sessionsNeeded; i++) {
        if (sessionIndex < studyDays.length) {
          // Round-robin through chapters STARTING FROM FIRST
          const chapterIndex = i % chapters.length;
          const selectedChapter = chapters[chapterIndex];
          
          const session = this.createSessionForMaterial(
            { ...material, chapter: selectedChapter }, 
            exam, 
            studyDays[studyDays.length - 1 - sessionIndex] // REVERSE: Start from earliest day
          );
          console.log(`Session ${i + 1}: ${selectedChapter} on ${studyDays[studyDays.length - 1 - sessionIndex]}`);
          schedule.push(session);
          sessionIndex++;
        } else {
          console.log(`No more study days available for session ${i + 1} of ${material.chapter}`);
        }
      }
    });
  }

  /**
   * Schedule multiple exams - SMART: reverse chronological with conflict resolution
   */
  private scheduleMultipleExams(
    prioritizedExams: ExamWithPriority[],
    schedule: StudySession[],
    dailyLoad: Map<string, number>
  ): void {
    // Sort exams by date (latest first) - reverse chronological
    const examsInReverseOrder = prioritizedExams.sort((a, b) => b.date.getTime() - a.date.getTime());
    console.log('Exams in reverse chronological order:', examsInReverseOrder.map(e => `${e.subject} (${e.date.toISOString().split('T')[0]})`));
    
    // Get all available study days
    const allStudyDays = this.getAllStudyDays(examsInReverseOrder);
    console.log('All available study days:', allStudyDays);
    
    // Schedule each exam
    examsInReverseOrder.forEach((exam, examIndex) => {
      console.log(`Processing exam ${examIndex + 1}: ${exam.subject} (exam date: ${exam.date.toISOString().split('T')[0]})`);
      
      // Calculate study window for this exam
      const studyEndDate = new Date(exam.date);
      studyEndDate.setDate(studyEndDate.getDate() - this.BUFFER_DAYS_BEFORE_EXAM);
      
      // Filter days available for this exam
      const availableDaysForExam = allStudyDays.filter(day => {
        const dayDate = new Date(day);
        return dayDate <= studyEndDate;
      });
      
      console.log(`Available days for ${exam.subject}:`, availableDaysForExam);
      
      exam.materialsWithPriority.forEach(({ material, sessionsNeeded }, materialIndex) => {
        console.log(`Material ${materialIndex + 1}: ${material.chapter}, needs ${sessionsNeeded} sessions`);
        
        for (let i = 0; i < sessionsNeeded; i++) {
          const targetDate = this.findBestDayForSession(
            availableDaysForExam,
            dailyLoad,
            exam.date,
            0
          );
          
          if (targetDate) {
            const session = this.createSessionForMaterial(material, exam, targetDate);
            schedule.push(session);
            dailyLoad.set(targetDate, (dailyLoad.get(targetDate) || 0) + 1);
            console.log(`Session ${i + 1}: ${material.chapter} on ${targetDate}`);
          } else {
            console.log(`No suitable day for session ${i + 1} of ${material.chapter}`);
          }
        }
      });
    });
  }

  /**
   * Get continuous study days until buffer period
   */
  private getContinuousStudyDays(endDate: Date): string[] {
    const days: string[] = [];
    const now = new Date();
    let currentDate = new Date(now);
    
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      if (!isWeekend) {
        days.push(currentDate.toISOString().split('T')[0]);
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  }

  /**
   * Find closest available day with capacity (for single exam)
   */
  private findClosestAvailableDay(availableDays: string[], dailyLoad: Map<string, number>, startIndex: number): string | null {
    // Search backwards from startIndex (closest to exam first)
    for (let i = startIndex; i >= 0; i--) {
      const day = availableDays[i];
      const currentLoad = dailyLoad.get(day) || 0;
      
      if (currentLoad < this.getMaxSessionsPerDay()) {
        return day;
      }
    }
    
    // If no day found backwards, search forwards
    for (let i = startIndex + 1; i < availableDays.length; i++) {
      const day = availableDays[i];
      const currentLoad = dailyLoad.get(day) || 0;
      
      if (currentLoad < this.getMaxSessionsPerDay()) {
        return day;
      }
    }
    
    return null;
  }

  /**
   * Get all available study days for all exams
   */
  private getAllStudyDays(exams: ExamWithPriority[]): string[] {
    const daySet = new Set<string>();
    const now = new Date();
    
    exams.forEach((exam, examIndex) => {
      console.log(`Exam ${examIndex + 1}: ${exam.subject}, date: ${exam.date?.toISOString()}`);
      
      if (!exam.date) {
        console.log(`Exam ${examIndex + 1} has no date, skipping...`);
        return;
      }
      
      const studyEndDate = new Date(exam.date);
      studyEndDate.setDate(studyEndDate.getDate() - this.BUFFER_DAYS_BEFORE_EXAM);
      console.log(`Study end date (with buffer): ${studyEndDate.toISOString()}`);
      
      const currentDate = new Date(now);
      let dayCount = 0;
      while (currentDate <= studyEndDate) {
        const dayOfWeek = currentDate.getDay();
        const dateStr = currentDate.toISOString().split('T')[0];
        
        // Check if it's a weekend
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        if (!isWeekend) {
          daySet.add(dateStr);
          dayCount++;
          console.log(`Added study day: ${dateStr} (weekday: ${dayOfWeek})`);
        } else {
          console.log(`Skipped weekend: ${dateStr} (weekday: ${dayOfWeek})`);
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      console.log(`Total study days for ${exam.subject}: ${dayCount}`);
    });
    
    const allDays = Array.from(daySet).sort();
    console.log(`All available study days: ${allDays.length} days`, allDays);
    return allDays;
  }

  /**
   * Find the best day for a session - OPTIMAL: continuous study until buffer
   */
  private findBestDayForSession(
    availableDays: string[],
    dailyLoad: Map<string, number>,
    examDate: Date,
    startIndex: number
  ): string | null {
    console.log('Finding best day from available days:', availableDays);
    console.log('Current daily load:', Object.fromEntries(dailyLoad));
    console.log('Exam date:', examDate.toISOString().split('T')[0]);
    
    // OPTIMAL STRATEGY: Pick the closest day to exam that has capacity
    const sortedCandidates = availableDays
      .map(day => ({
        date: day,
        load: dailyLoad.get(day) || 0,
        daysUntilExam: Math.ceil((examDate.getTime() - new Date(day).getTime()) / (1000 * 60 * 60 * 24))
      }))
      .filter(candidate => {
        // Only check capacity and buffer - no load balancing for single exam
        const isValid = candidate.daysUntilExam > this.BUFFER_DAYS_BEFORE_EXAM && 
                       candidate.load < this.getMaxSessionsPerDay();
        console.log(`Day ${candidate.date}: load=${candidate.load}, daysUntilExam=${candidate.daysUntilExam}, valid=${isValid}`);
        return isValid;
      })
      .sort((a, b) => {
        // PRIMARY: Closest to exam (optimal for retention)
        return a.daysUntilExam - b.daysUntilExam;
      });

    console.log('Available candidates for session:', sortedCandidates);

    if (sortedCandidates.length === 0) {
      console.log('No suitable days found for session');
      return null;
    }

    // Return the closest day to exam
    const bestDay = sortedCandidates[0].date;
    console.log(`Selected best day: ${bestDay} (closest to exam: ${sortedCandidates[0].daysUntilExam} days before)`);
    
    return bestDay;
  }

  /**
   * Create a study session for a specific material
   */
  private createSessionForMaterial(
    material: IStudyMaterial,
    exam: ExamData,
    dateStr: string
  ): StudySession {
    const startTime = new Date(`${dateStr}T09:00:00`);
    const endTime = new Date(startTime.getTime() + this.SESSION_DURATION * 60 * 1000);
    
    return {
      title: `Study: ${material.chapter}`,
      subject: exam.subject,
      startTime,
      endTime,
      duration: this.SESSION_DURATION,
      checklist: [
        {
          task: `Review ${material.chapter}`,
          completed: false
        },
        {
          task: `Practice problems for ${material.chapter}`,
          completed: false
        },
        {
          task: `Self-assessment for ${material.chapter}`,
          completed: false
        }
      ],
      isCompleted: false
    };
  }

  /**
   * Redistribute all sessions when a new exam is added
   */
  async redistributeAllSessions(
    allExams: ExamData[],
    existingSessions: IStudySession[]
  ): Promise<StudySession[]> {
    // Clear existing sessions and reschedule everything
    return this.scheduleStudySessions(allExams[0], allExams.slice(1), []);
  }
}
