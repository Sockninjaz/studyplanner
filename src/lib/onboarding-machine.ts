// ─────────────────────────────────────────────────────────────────────────────
// Onboarding State Machine
// ─────────────────────────────────────────────────────────────────────────────

import { requiresRegion, requiresExamBoard } from "./onboarding-data";

export type OnboardingState = {
  country: string | null;       // ISO 3166-1 alpha-2 e.g. "GB"
  countryName: string | null;   // Display name e.g. "United Kingdom"
  countryEmoji: string | null;  // Flag emoji e.g. "🇬🇧"
  region: string | null;        // Region/State code e.g. "CA"
  regionName: string | null;    // Region display name e.g. "California"
  academicTier: string | null;  // Track ID e.g. "a-levels"
  academicTierLabel: string | null; // Track label e.g. "A-Levels"
  grade: string | null;         // Grade ID e.g. "year-12"
  gradeLabel: string | null;    // Grade label e.g. "Year 12"
  examBoard: string | null;     // Exam board ID e.g. "aqa"
  examBoardLabel: string | null; // Exam board label e.g. "AQA"
};

export const INITIAL_ONBOARDING_STATE: OnboardingState = {
  country: null,
  countryName: null,
  countryEmoji: null,
  region: null,
  regionName: null,
  academicTier: null,
  academicTierLabel: null,
  grade: null,
  gradeLabel: null,
  examBoard: null,
  examBoardLabel: null,
};

export type StepId = "country" | "region" | "track" | "grade" | "exam-board";

/**
 * Derives the ordered list of active step IDs from the current state.
 * This is the core of the state machine — conditional steps are included
 * or excluded based on previous selections.
 */
export function computeSteps(state: OnboardingState): StepId[] {
  const steps: StepId[] = ["country"];

  if (state.country && requiresRegion(state.country)) {
    steps.push("region");
  }

  steps.push("track");
  steps.push("grade");

  if (state.academicTier && requiresExamBoard(state.academicTier)) {
    steps.push("exam-board");
  }

  return steps;
}

/**
 * Returns the total number of steps given the current state.
 * Because the exam-board step is conditional on the track selection,
 * we return a "projected" total based on what we know so far.
 */
export function getTotalSteps(state: OnboardingState): number {
  return computeSteps(state).length;
}

/**
 * Build the final payload to submit to the backend.
 */
export function buildOnboardingPayload(state: OnboardingState) {
  return {
    country: state.country,
    countryName: state.countryName,
    region: state.region,
    regionName: state.regionName,
    academicTier: state.academicTier,
    academicTierLabel: state.academicTierLabel,
    grade: state.grade,
    gradeLabel: state.gradeLabel,
    examBoard: state.examBoard,
    examBoardLabel: state.examBoardLabel,
  };
}

/**
 * Generates a deterministic profile token from the onboarding state.
 * Used to store in localStorage so the user never has to onboard again.
 */
export function generateProfileToken(state: OnboardingState): string {
  const parts = [
    state.country ?? "XX",
    state.region ?? "none",
    state.academicTier ?? "none",
    state.grade ?? "none",
    state.examBoard ?? "none",
    Date.now().toString(36),
  ];
  return `sp_${parts.join("_")}`;
}
