'use client';

import { useState } from 'react';
import { getExamBoardsForTrack, ExamBoard } from '@/lib/onboarding-data';
import { OnboardingState } from '@/lib/onboarding-machine';

interface StepExamBoardProps {
  state: OnboardingState;
  onNext: (update: Partial<OnboardingState>) => void;
}

const BOARD_COLORS: Record<string, string> = {
  aqa: '#ff6b35',
  'aqa-gcse': '#ff6b35',
  edexcel: '#003087',
  'edexcel-gcse': '#003087',
  ocr: '#00a2e1',
  'ocr-gcse': '#00a2e1',
  wjec: '#c8102e',
  'wjec-gcse': '#c8102e',
  ccea: '#009639',
  'ccea-gcse': '#009639',
  'caie-al': '#005eb8',
  'caie-igcse': '#005eb8',
  'ib-dp': '#007ac2',
  'ib-cp': '#00a651',
  'ib-myp': '#f7941d',
};

export default function StepExamBoard({ state, onNext }: StepExamBoardProps) {
  const trackId = state.academicTier ?? '';
  const boards = getExamBoardsForTrack(trackId);
  const [selectedId, setSelectedId] = useState<string | null>(state.examBoard ?? null);
  const [animatingId, setAnimatingId] = useState<string | null>(null);

  const handleSelect = (board: ExamBoard) => {
    if (animatingId) return;
    setSelectedId(board.id);
    setAnimatingId(board.id);

    setTimeout(() => {
      onNext({
        examBoard: board.id,
        examBoardLabel: board.label,
      });
      setAnimatingId(null);
    }, 300);
  };

  const handleManualNext = () => {
    if (!selectedId) return;
    const board = boards.find((b) => b.id === selectedId);
    if (!board) return;
    onNext({ examBoard: board.id, examBoardLabel: board.label });
  };

  return (
    <div className="ob-step-content">
      <div className="ob-step-header">
        <span className="ob-step-eyebrow">{state.countryEmoji} {state.academicTierLabel}</span>
        <h1 className="ob-step-title">Which exam board?</h1>
        <p className="ob-step-subtitle">
          Your exam board determines the specific syllabus we'll align your study plan to.
        </p>
      </div>

      <div className="ob-board-grid" role="listbox" aria-label="Exam board options">
        {boards.map((board) => {
          const isSelected = selectedId === board.id;
          const isAnimating = animatingId === board.id;
          const color = BOARD_COLORS[board.id] ?? '#7c6cfc';

          return (
            <button
              key={board.id}
              id={`board-${board.id}`}
              role="option"
              aria-selected={isSelected}
              className={`ob-board-card ${isSelected ? 'ob-board-card--selected' : ''} ${isAnimating ? 'ob-board-card--pulse' : ''}`}
              style={{ '--board-color': color } as React.CSSProperties}
              onClick={() => handleSelect(board)}
              type="button"
            >
              <span className="ob-board-code">{board.shortCode}</span>
              <span className="ob-board-desc">{board.description}</span>
              {isSelected && (
                <span className="ob-board-check" aria-hidden="true">✓</span>
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
