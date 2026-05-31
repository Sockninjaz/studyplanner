'use client';

import { useState } from 'react';
import { getGradesForCountry, Grade } from '@/lib/onboarding-data';
import { OnboardingState } from '@/lib/onboarding-machine';

interface StepGradeProps {
  state: OnboardingState;
  onNext: (update: Partial<OnboardingState>) => void;
}

export default function StepGrade({ state, onNext }: StepGradeProps) {
  const grades = getGradesForCountry(state.country ?? '');
  const [selectedId, setSelectedId] = useState<string | null>(state.grade ?? null);
  const [animatingId, setAnimatingId] = useState<string | null>(null);

  // Auto-advance after 300ms when a card is clicked
  const handleSelect = (grade: Grade) => {
    if (animatingId) return;
    setSelectedId(grade.id);
    setAnimatingId(grade.id);

    setTimeout(() => {
      onNext({
        grade: grade.id,
        gradeLabel: grade.label,
      });
      setAnimatingId(null);
    }, 300);
  };

  const trackLabel = state.academicTierLabel ?? 'your track';

  return (
    <div className="ob-step-content">
      <div className="ob-step-header">
        <span className="ob-step-eyebrow">{trackLabel}</span>
        <h1 className="ob-step-title">What year are you in?</h1>
        <p className="ob-step-subtitle">
          Select your current grade or year to fine-tune your schedule.
        </p>
      </div>

      <div className="ob-board-grid" role="listbox" aria-label="Grade level options">
        {grades.map((grade) => {
          const isSelected = selectedId === grade.id;
          const isAnimating = animatingId === grade.id;

          return (
            <button
              key={grade.id}
              id={`grade-${grade.id}`}
              role="option"
              aria-selected={isSelected}
              className={`ob-board-card ${isSelected ? 'ob-board-card--selected' : ''} ${isAnimating ? 'ob-board-card--pulse' : ''}`}
              onClick={() => handleSelect(grade)}
              type="button"
              style={{ padding: '0.8rem 0.5rem', minHeight: 'auto' } as React.CSSProperties}
            >
              <span className="ob-board-code" style={{ fontSize: '0.9rem' }}>{grade.label}</span>
              {isSelected && (
                <span className="ob-board-check" aria-hidden="true">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selectedId && (
        <p className="ob-auto-advance-hint" role="status" aria-live="polite">
          Advancing automatically…
        </p>
      )}
    </div>
  );
}
