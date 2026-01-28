# STUDY PLANNER ALGORITHM — EXPLICIT RULE SET (V1)

## 0. Goal (very important)

Generate a realistic study plan for high-school students that:

- Never finishes subjects too early
- Never leaves empty days right before exams
- Never overloads a day silently
- Prioritizes balance and consistency over "optimal" cramming

The algorithm optimizes for:
**Stress minimization + coverage, not max grades.**

## 1. User Inputs (authoritative)

### Global
- `daily_max_hours` (hard cap, cannot be exceeded without warning)
- `start_date` (first study day)

### Per exam / subject
- `exam_date`
- `difficulty` (1–5)
- `confidence` (1–5)
- `user_estimated_total_hours` (base effort, NOT a suggestion)
- `can_study_after_exam` = true (default)

The algorithm may distribute hours, but may NOT invent large extra totals.

## 2. Internal State (per subject)

The algorithm maintains:
- `remaining_hours`
- `days_to_exam`
- `last_study_day`
- `state` ∈ { ACTIVE, DONE }

### Definitions:
- **ACTIVE**: remaining_hours > 0 and exam not passed
- **DONE**: exam passed → no scheduling

(No "revision state" in v1.)

## 3. Hard Constraints (ANTI-STUPID RULES)

These rules must never be violated.

### 3.1 No early completion
A subject may NOT reach `remaining_hours = 0` more than X days before its exam.
- Default: X = 2
- Effect: the algorithm must reserve work for late days
- This rule alone prevents empty days before exams.

### 3.2 No empty days near exams
If there exists any ACTIVE exam with `days_to_exam ≤ 3`:
- At least one subject must be scheduled that day
- (No "nothing to do" days close to exams.)

### 3.3 Daily capacity hard cap
Total scheduled hours per day ≤ `daily_max_hours`
- If impossible → trigger overload handling (see §6)

### 3.4 Subject dominance cap
No single subject may exceed 50% of a day's total hours
- Prevents mental burnout and unrealistic days.

### 3.5 Active exam protection
If a subject is ACTIVE and `days_to_exam ≤ 4`:
- It may not receive 0 hours on more than 1 consecutive day
- This guarantees presence without forcing cramming.

### 3.6 Exam locking
After `exam_date`:
- Subject becomes DONE
- Remaining hours are discarded
- Subject receives 0 future time

## 4. Soft Distribution Preferences (NOT rules)

Used only when multiple valid choices exist.

### Priority score (example)
For each ACTIVE subject:

```
priority = 
  w1 * (1 / days_to_exam)
+ w2 * remaining_hours_ratio
+ w3 * days_since_last_study
+ w4 * difficulty * (6 - confidence)
```

Weights are tunable.
This score does not override constraints.

## 5. Daily Planning Logic (core loop)

For each day:

### Step 1 — Determine capacity
`day_capacity = daily_max_hours`

### Step 2 — Determine eligible subjects
A subject is eligible if:
- `state == ACTIVE`
- assigning time would not violate §3.1 (early completion)

### Step 3 — Slot assignment (greedy)
While `day_capacity > 0` and eligible subjects exist:
1. Pick subject with highest priority
2. Assign a small chunk (e.g. 30–60 min)
3. Update:
   - `remaining_hours`
   - `last_study_day`
   - `day_capacity`
4. Recompute priorities
5. Enforce dominance cap (§3.4)

## 6. Overload Handling (critical UX rule)

If total required hours cannot fit within daily limits:

The algorithm MUST:
1. Stop
2. Warn the user clearly
3. Offer explicit choices:
   - Increase daily max
   - Reduce all subjects proportionally
   - Sacrifice lowest-priority subjects (furthest exam / lowest difficulty)

The algorithm must NEVER silently overload.

## 7. Properties visible in the provided plan (explicitly enforced)

The algorithm intentionally produces:
- Study before AND after exams
- Gradual ramp-up for hard subjects
- No subject "finished" too early
- Mostly 1–2 subjects per day
- Human-feeling daily loads (2–4h typical)

These are emergent behaviors from the rules above, not hacks.

## 8. What is intentionally NOT included (v1)

- No revision system
- No spaced repetition engine
- No ML or personalization beyond inputs
- No auto-inflation of total hours

These are v2+ features.
