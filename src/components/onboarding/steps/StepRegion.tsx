'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { REGIONS_BY_COUNTRY, Region } from '@/lib/onboarding-data';
import { OnboardingState } from '@/lib/onboarding-machine';

interface StepRegionProps {
  state: OnboardingState;
  onNext: (update: Partial<OnboardingState>) => void;
}

const REGION_LABELS: Record<string, string> = {
  US: 'State',
  CA: 'Province',
  DE: 'Bundesland',
  AU: 'State or Territory',
  IN: 'State',
  BR: 'Estado',
  MX: 'Estado',
  CH: 'Canton',
  AT: 'Bundesland',
  BE: 'Region',
  ES: 'Autonomous Community',
};

export default function StepRegion({ state, onNext }: StepRegionProps) {
  const countryCode = state.country ?? '';
  const regions = REGIONS_BY_COUNTRY[countryCode] ?? [];
  const regionLabel = REGION_LABELS[countryCode] ?? 'Region';

  const [query, setQuery] = useState(state.regionName ?? '');
  const [selected, setSelected] = useState<Region | null>(
    state.region ? regions.find((r) => r.code === state.region) ?? null : null
  );
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = query.trim()
    ? regions.filter((r) =>
        r.name.toLowerCase().startsWith(query.toLowerCase()) ||
        r.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 10)
    : regions.slice(0, 10);

  useEffect(() => setHighlightIndex(0), [query]);

  useEffect(() => {
    if (listRef.current) {
      const item = listRef.current.children[highlightIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  const handleSelect = useCallback((region: Region) => {
    setSelected(region);
    setQuery(region.name);
    setIsOpen(false);
    inputRef.current?.blur();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') setIsOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlightIndex]) handleSelect(filtered[highlightIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleNext = () => {
    if (!selected) return;
    onNext({
      region: selected.code,
      regionName: selected.name,
      // Clear downstream
      academicTier: null,
      academicTierLabel: null,
      examBoard: null,
      examBoardLabel: null,
    });
  };

  return (
    <div className="ob-step-content">
      <div className="ob-step-header">
        <span className="ob-step-eyebrow">{state.countryEmoji} {state.countryName}</span>
        <h1 className="ob-step-title">Which {regionLabel}?</h1>
        <p className="ob-step-subtitle">
          Education systems can vary significantly between regions.
        </p>
      </div>

      <div className="ob-combobox-wrapper" role="combobox" aria-expanded={isOpen} aria-haspopup="listbox">
        <div className="ob-input-group">
          <input
            ref={inputRef}
            id="region-input"
            type="text"
            className="ob-input"
            placeholder={`Search for your ${regionLabel.toLowerCase()}…`}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(null); setIsOpen(true); }}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setTimeout(() => setIsOpen(false), 150)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            aria-autocomplete="list"
            aria-controls="region-listbox"
            aria-activedescendant={isOpen ? `region-option-${highlightIndex}` : undefined}
          />
          {query && (
            <button
              className="ob-input-clear"
              onClick={() => { setQuery(''); setSelected(null); setIsOpen(false); inputRef.current?.focus(); }}
              aria-label="Clear selection"
              type="button"
            >
              ✕
            </button>
          )}
        </div>

        {isOpen && filtered.length > 0 && (
          <ul
            id="region-listbox"
            ref={listRef}
            role="listbox"
            className="ob-dropdown"
            aria-label={`${regionLabel} options`}
          >
            {filtered.map((region, idx) => (
              <li
                key={region.code}
                id={`region-option-${idx}`}
                role="option"
                aria-selected={selected?.code === region.code}
                className={`ob-dropdown-item ${idx === highlightIndex ? 'ob-dropdown-item--highlight' : ''} ${selected?.code === region.code ? 'ob-dropdown-item--selected' : ''}`}
                onMouseDown={() => handleSelect(region)}
              >
                <span className="ob-dropdown-name">{region.name}</span>
                <span className="ob-dropdown-code">{region.code}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        id="region-next-btn"
        className={`ob-next-btn ${selected ? 'ob-next-btn--active' : ''}`}
        onClick={handleNext}
        disabled={!selected}
        aria-disabled={!selected}
        type="button"
      >
        Continue
        <svg className="ob-next-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
