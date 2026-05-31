'use client';

import { useState, useCallback, useRef } from 'react';
import {
  OnboardingState,
  INITIAL_ONBOARDING_STATE,
  computeSteps,
  StepId,
} from '@/lib/onboarding-machine';
import StepCountry from './steps/StepCountry';
import StepRegion from './steps/StepRegion';
import StepTrack from './steps/StepTrack';
import StepGrade from './steps/StepGrade';
import StepExamBoard from './steps/StepExamBoard';
import StepComplete from './steps/StepComplete';

// ─── Directional navigation helpers ─────────────────────────────────────────

function setNavDir(dir: 'forward' | 'back') {
  document.documentElement.dataset.navDir = dir;
}

function startViewTransition(cb: () => void) {
  if (typeof document !== 'undefined' && 'startViewTransition' in document) {
    (document as any).startViewTransition(cb);
  } else {
    cb();
  }
}

// ─── Step renderer ───────────────────────────────────────────────────────────

function renderStep(
  stepId: StepId | 'complete',
  state: OnboardingState,
  onNext: (update: Partial<OnboardingState>) => void
) {
  switch (stepId) {
    case 'country':    return <StepCountry state={state} onNext={onNext} />;
    case 'region':     return <StepRegion state={state} onNext={onNext} />;
    case 'track':      return <StepTrack state={state} onNext={onNext} />;
    case 'grade':      return <StepGrade state={state} onNext={onNext} />;
    case 'exam-board': return <StepExamBoard state={state} onNext={onNext} />;
    case 'complete':   return <StepComplete state={state} />;
    default:           return null;
  }
}

// ─── Step label map ──────────────────────────────────────────────────────────

const STEP_LABELS: Record<StepId, string> = {
  country:      'Country',
  region:       'Region',
  track:        'Level',
  grade:        'Year',
  'exam-board': 'Exam Board',
};

// ─── Main Wizard ─────────────────────────────────────────────────────────────

export default function OnboardingWizard() {
  const [state, setState] = useState<OnboardingState>(INITIAL_ONBOARDING_STATE);
  const [stepIndex, setStepIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute active steps every render (reactive to state changes)
  const activeSteps = computeSteps(state);
  const totalSteps = activeSteps.length;
  const currentStepId: StepId | 'complete' = isComplete ? 'complete' : activeSteps[stepIndex];

  // Progress percentage (complete = 100%)
  const progressPct = isComplete ? 100 : ((stepIndex) / totalSteps) * 100;

  const canGoBack = !isComplete && stepIndex > 0;

  const handleNext = useCallback((update: Partial<OnboardingState>) => {
    const newState = { ...state, ...update };
    const newSteps = computeSteps(newState);
    const nextIdx = stepIndex + 1;

    setNavDir('forward');
    startViewTransition(() => {
      setState(newState);
      if (nextIdx >= newSteps.length) {
        setIsComplete(true);
      } else {
        setStepIndex(nextIdx);
      }
    });
  }, [state, stepIndex]);

  const handleBack = useCallback(() => {
    if (!canGoBack) return;
    setNavDir('back');
    startViewTransition(() => {
      setStepIndex((i) => i - 1);
    });
  }, [canGoBack]);

  return (
    <div className="ob-wizard" aria-label="Onboarding wizard">
      {/* ── Progress bar ─────────────────────────────────────── */}
      <div
        className="ob-progress-track"
        role="progressbar"
        aria-valuenow={stepIndex + (isComplete ? 1 : 0)}
        aria-valuemin={0}
        aria-valuemax={totalSteps}
        aria-label={isComplete ? 'Complete' : `Step ${stepIndex + 1} of ${totalSteps}`}
      >
        <div
          className="ob-progress-fill"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* ── Header row ───────────────────────────────────────── */}
      {!isComplete && (
        <div className="ob-header">
          <button
            className={`ob-back-btn ${canGoBack ? 'ob-back-btn--visible' : ''}`}
            onClick={handleBack}
            disabled={!canGoBack}
            aria-label="Go back to previous step"
            type="button"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>

          <nav className="ob-step-pills" aria-label="Wizard steps">
            {activeSteps.map((id, idx) => (
              <div
                key={id}
                className={`ob-step-pill ${idx < stepIndex ? 'ob-step-pill--done' : ''} ${idx === stepIndex ? 'ob-step-pill--active' : ''}`}
                aria-label={`${STEP_LABELS[id]} — ${idx < stepIndex ? 'completed' : idx === stepIndex ? 'current' : 'upcoming'}`}
              >
                {idx < stepIndex ? (
                  <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12" aria-hidden="true">
                    <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/>
                  </svg>
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>
            ))}
          </nav>

          <div className="ob-step-counter" aria-hidden="true">
            {stepIndex + 1} / {totalSteps}
          </div>
        </div>
      )}

      {/* ── Animated step container ──────────────────────────── */}
      <div
        ref={containerRef}
        className="ob-step-container"
        style={{ viewTransitionName: 'ob-step' } as React.CSSProperties}
        tabIndex={-1}
      >
        {renderStep(currentStepId, state, handleNext)}
      </div>
    </div>
  );
}
