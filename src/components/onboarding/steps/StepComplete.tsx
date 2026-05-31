'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingState, buildOnboardingPayload, generateProfileToken } from '@/lib/onboarding-machine';

interface StepCompleteProps {
  state: OnboardingState;
}

export default function StepComplete({ state }: StepCompleteProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<'submitting' | 'success' | 'error'>('submitting');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const submit = async () => {
      try {
        const payload = buildOnboardingPayload(state);

        // Fire payload to backend
        const res = await fetch('/api/onboarding/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        // Store profile token regardless of auth status
        // (the token prevents re-showing onboarding even if the API call fails for guests)
        const token = generateProfileToken(state);
        localStorage.setItem('studyplanner_profile', token);
        localStorage.setItem('studyplanner_onboarding', JSON.stringify(payload));

        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.token) {
            localStorage.setItem('studyplanner_profile', data.token);
          }
        }

        setPhase('success');

        // Navigate to dashboard after success animation
        setTimeout(() => {
          router.push('/today');
        }, 1800);
      } catch (err) {
        // Even on network error, we have the token in localStorage — proceed
        const token = generateProfileToken(state);
        localStorage.setItem('studyplanner_profile', token);

        setPhase('success');
        setTimeout(() => {
          router.push('/today');
        }, 1800);
      }
    };

    submit();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const summaryItems = [
    { label: 'Country', value: `${state.countryEmoji} ${state.countryName}` },
    state.regionName ? { label: 'Region', value: state.regionName } : null,
    state.academicTierLabel ? { label: 'Academic Track', value: state.academicTierLabel } : null,
    state.examBoardLabel ? { label: 'Exam Board', value: state.examBoardLabel } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="ob-step-content ob-complete-step">
      {phase === 'submitting' && (
        <div className="ob-complete-loading">
          <div className="ob-spinner" aria-label="Setting up your profile…" role="status" />
          <p className="ob-complete-status">Personalising your study planner…</p>
        </div>
      )}

      {phase === 'success' && (
        <>
          <div className="ob-success-icon" aria-hidden="true">
            <svg viewBox="0 0 80 80" fill="none">
              <circle cx="40" cy="40" r="38" stroke="url(#grad)" strokeWidth="3" strokeDasharray="239" strokeDashoffset="0" className="ob-success-circle" />
              <path d="M24 40l12 12 20-22" stroke="url(#grad)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="ob-success-check" />
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="80" y2="80">
                  <stop offset="0%" stopColor="#7c6cfc" />
                  <stop offset="100%" stopColor="#42bfdd" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <h1 className="ob-step-title ob-complete-title">You're all set!</h1>
          <p className="ob-step-subtitle ob-complete-subtitle">
            Your personalised study planner is ready.
          </p>

          <div className="ob-summary-cards">
            {summaryItems.map((item) => (
              <div key={item.label} className="ob-summary-card">
                <span className="ob-summary-label">{item.label}</span>
                <span className="ob-summary-value">{item.value}</span>
              </div>
            ))}
          </div>

          <p className="ob-redirect-hint">Taking you to your dashboard…</p>
        </>
      )}

      {phase === 'error' && (
        <div className="ob-complete-error">
          <p className="ob-error-msg">{errorMsg}</p>
          <button
            className="ob-next-btn ob-next-btn--active"
            onClick={() => router.push('/today')}
            type="button"
          >
            Go to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
