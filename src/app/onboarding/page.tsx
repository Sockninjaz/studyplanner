'use client';

import './onboarding.css';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';

export default function OnboardingPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // If the user already has a profile token, skip onboarding
    const token = localStorage.getItem('studyplanner_profile');
    if (token) {
      router.replace('/today');
    } else {
      setChecked(true);
    }
  }, [router]);

  if (!checked) {
    // Tiny splash while we check localStorage
    return (
      <div className="ob-splash">
        <div className="ob-splash-logo">
          <svg viewBox="0 0 40 40" fill="none" width="40" height="40" aria-hidden="true">
            <circle cx="20" cy="20" r="18" stroke="url(#splashGrad)" strokeWidth="2.5"/>
            <path d="M13 20h14M20 13v14" stroke="url(#splashGrad)" strokeWidth="2.5" strokeLinecap="round"/>
            <defs>
              <linearGradient id="splashGrad" x1="0" y1="0" x2="40" y2="40">
                <stop offset="0%" stopColor="#7c6cfc"/>
                <stop offset="100%" stopColor="#42bfdd"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    );
  }

  return (
    <main className="ob-root" aria-label="Study Planner onboarding">
      {/* Ambient background blobs */}
      <div className="ob-bg" aria-hidden="true">
        <div className="ob-bg-blob ob-bg-blob--1" />
        <div className="ob-bg-blob ob-bg-blob--2" />
        <div className="ob-bg-blob ob-bg-blob--3" />
      </div>

      <OnboardingWizard />
    </main>
  );
}
