'use client';

import { useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { getTracksForCountry, AcademicTrack } from '@/lib/onboarding-data';
import { OnboardingState } from '@/lib/onboarding-machine';

interface StepTrackProps {
  state: OnboardingState;
  onNext: (update: Partial<OnboardingState>) => void;
}

export default function StepTrack({ state, onNext }: StepTrackProps) {
  const tracks = getTracksForCountry(state.country ?? '');
  const [selectedId, setSelectedId] = useState<string | null>(state.academicTier ?? null);
  const [animatingId, setAnimatingId] = useState<string | null>(null);

  // Auto-advance after 300ms when a card is clicked
  const handleSelect = (track: AcademicTrack) => {
    if (animatingId) return; // Prevent double-clicks during animation
    setSelectedId(track.id);
    setAnimatingId(track.id);

    setTimeout(() => {
      onNext({
        academicTier: track.id,
        academicTierLabel: track.label,
        // Clear downstream
        examBoard: null,
        examBoardLabel: null,
      });
      setAnimatingId(null);
    }, 300);
  };

  // If previously selected track doesn't exist for new country, reset
  useEffect(() => {
    if (selectedId && !tracks.find((t) => t.id === selectedId)) {
      setSelectedId(null);
    }
  }, [tracks, selectedId]);

  const locationLabel = state.regionName
    ? `${state.countryEmoji} ${state.regionName}, ${state.countryName}`
    : `${state.countryEmoji} ${state.countryName}`;

  return (
    <div className="ob-step-content">
      <div className="ob-step-header">
        <span className="ob-step-eyebrow">{locationLabel}</span>
        <h1 className="ob-step-title">What level are you studying?</h1>
        <p className="ob-step-subtitle">
          Select your current academic track — this shapes your study plan.
        </p>
      </div>

      <div className="ob-track-grid" role="listbox" aria-label="Academic level options">
        {tracks.map((track) => {
          const isSelected = selectedId === track.id;
          const isAnimating = animatingId === track.id;
          const IconComponent = LucideIcons[track.icon as keyof typeof LucideIcons] as React.ElementType;

          return (
            <button
              key={track.id}
              id={`track-${track.id}`}
              role="option"
              aria-selected={isSelected}
              className={`ob-track-card ${isSelected ? 'ob-track-card--selected' : ''} ${isAnimating ? 'ob-track-card--pulse' : ''}`}
              onClick={() => handleSelect(track)}
              type="button"
            >
              <span className="ob-track-icon" aria-hidden="true">
                {IconComponent ? <IconComponent size={24} strokeWidth={1.5} /> : <LucideIcons.BookOpen size={24} strokeWidth={1.5} />}
              </span>
              <span className="ob-track-label">{track.label}</span>
              <span className="ob-track-desc">{track.description}</span>
              {isSelected && (
                <span className="ob-track-check" aria-hidden="true">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
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
