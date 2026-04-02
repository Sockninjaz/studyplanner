# StudyPlanner — Project Context

## What This App Does
StudyPlanner is a full-stack web app that automatically generates personalized exam study schedules. Users enter their exams (with study materials, difficulty, confidence, and estimated hours), and the app distributes study sessions across the available calendar days leading up to each exam.

The core value prop: you never manually decide when to study what. The algorithm figures it out, respects your daily limits, and keeps sessions evenly distributed.

---

## Tech Stack
- **Framework:** Next.js 14 (App Router, TypeScript)
- **Database:** MongoDB via Mongoose
- **Auth:** JWT-based (custom, not NextAuth)
- **Styling:** Vanilla CSS (no Tailwind)
- **Scheduling engine:** Pure TypeScript — `src/lib/scheduling/advancedScheduler.ts`

---

## Data Models

### User (`src/models/User.ts`)
```ts
daily_study_limit: number      // Hard max hours/day (default 4)
soft_daily_limit: number       // Preferred target hours/day (default 2)
session_duration: number       // Minutes per session (default 30)
adjustment_percentage: number  // Max % adjustment for difficulty/confidence (default 25)
enable_daily_limits: boolean   // Preference ON = use optimal start dates; OFF = start today
```

### Exam (`src/models/Exam.ts`)
```ts
subject: string
date: Date                    // Exam date
can_study_after_exam: boolean // Whether sessions can be placed on exam day itself
studyMaterials: [{
  chapter: string
  difficulty: number          // 1–5
  confidence: number          // 1–5
  user_estimated_total_hours: number
  completed: boolean
}]
```
Total study hours for an exam = sum of material hours, adjusted by difficulty/confidence and `adjustment_percentage`.

### StudySession (`src/models/StudySession.ts`)
A logged study session. Can be past (completed) or future (scheduled). Used to track completed hours per exam and to preserve existing future sessions when regenerating.

### BlockedDay (`src/models/BlockedDay.ts`)
Specific calendar dates where no sessions should be placed (vacations, rest days, etc.).

### Task (`src/models/Task.ts`)
Per-session tasks the user tracks during a study session (separate from the scheduler).

---

## Scheduling Algorithm (`src/lib/scheduling/advancedScheduler.ts`)

### Entry Point
`StudyPlannerV1.generatePlan()` — returns a `Map<string, Map<string, number>>` (date → examId → sessionCount).

### Current Pipeline (Sequential, Being Rewritten)
1. `calculateOptimalStartDate()` — groups exams by overlapping study windows (union-find), computes earliest start date per group
2. `generateValidSlotsForExam()` — per exam: legal days from start to exam date, excluding blocked days
3. `assignSessionsEvenly()` — initial per-exam session placement (works backwards, respects gap rule)
4. `mergeExamsIntoDailyPlan()` — stacks per-exam sessions into a single daily schedule
5. `balanceWorkload()` — redistributes sessions for even workload
6. `fixMaxIntervalViolations()` — fixes gaps > 2 empty days per exam
7. `enforceMaxOneDifference()` — final pass: enforces max 1 session spread between days

### Constraint Priority Hierarchy
| Priority | Rule | Type |
|---|---|---|
| 1 | Never schedule after exam date | Hard |
| 2 | Never exceed `daily_max_hours` | Hard |
| 3 | Blocked days have zero sessions | Hard |
| 4 | Final review session on day-before-exam | Soft (highest) |
| 5 | Max 1 session difference between any two days | Soft (high) |
| 6 | Max 2 empty days gap between sessions for same exam | Soft (lower) |
| 7 | Max 1 session of the same exam per day | Soft |

### Key Constants
- `STUDY_CHUNK_HOURS = session_duration / 60`
- `MAX_INTERVAL_DAYS = 2` (max empty days between sessions for one exam)
- Sessions are atomic (1 session = `session_duration` minutes)

### `enable_daily_limits` Preference
- **ON:** Calculates an optimal start date so sessions naturally fill at `soft_daily_limit` hours/day. Produces a denser, later-starting schedule.
- **OFF:** Always starts from today. Sessions spread across all available days.

---

## API Routes (key ones)
- `POST /api/calendar/regenerate` — regenerates the full schedule from scratch
- `GET /api/calendar/events` — fetches scheduled sessions for the calendar view
- `POST /api/exams` — create exam
- `PUT /api/exams/[id]` — edit exam

---

## Component Structure
```
src/components/
  calendar/        # Calendar view, session sidebar, list view
  exams/           # Create/edit exam modals
  session/         # Timer component (Pomodoro-style, per session)
  shared/          # Sidebar, nav
  user/            # Preferences modal
```

---

## Known Architecture Issue (In Progress)
The 7-step sequential pipeline causes passes to undo each other's work. A rewrite to a **unified greedy scoring pass** is planned — one single phase that assigns sessions while scoring each candidate placement across all constraints simultaneously, eliminating the conflict between the ±1 spread rule and the gap continuity rule.
