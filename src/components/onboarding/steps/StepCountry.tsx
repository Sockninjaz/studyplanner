'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { COUNTRIES, Country } from '@/lib/onboarding-data';
import { OnboardingState } from '@/lib/onboarding-machine';

interface StepCountryProps {
  state: OnboardingState;
  onNext: (update: Partial<OnboardingState>) => void;
}

export default function StepCountry({ state, onNext }: StepCountryProps) {
  const [query, setQuery] = useState(state.countryName ?? '');
  const [selected, setSelected] = useState<Country | null>(
    state.country
      ? COUNTRIES.find((c) => c.code === state.country) ?? null
      : null
  );
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = query.trim()
    ? COUNTRIES.filter((c) =>
        c.name.toLowerCase().startsWith(query.toLowerCase()) ||
        c.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : COUNTRIES.slice(0, 8);

  useEffect(() => {
    setHighlightIndex(0);
  }, [query]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current) {
      const item = listRef.current.children[highlightIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  const handleSelect = useCallback((country: Country) => {
    setSelected(country);
    setQuery(country.name);
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSelected(null);
    setIsOpen(true);
  };

  const handleNext = () => {
    if (!selected) return;
    onNext({
      country: selected.code,
      countryName: selected.name,
      countryEmoji: selected.emoji,
      // Reset downstream state if country changed
      region: null,
      regionName: null,
      academicTier: null,
      academicTierLabel: null,
      examBoard: null,
      examBoardLabel: null,
    });
  };

  return (
    <div className="ob-step-content">
      <div className="ob-step-header">
        <span className="ob-step-eyebrow">Step 1</span>
        <h1 className="ob-step-title">Where do you study?</h1>
        <p className="ob-step-subtitle">
          We'll personalise your curriculum based on your country's education system.
        </p>
      </div>

      <div className="ob-combobox-wrapper" role="combobox" aria-expanded={isOpen} aria-haspopup="listbox">
        <div className="ob-input-group">
          {selected && (
            <span className="ob-input-flag" aria-hidden="true">
              {selected.emoji}
            </span>
          )}
          {!selected && query.length === 0 && (
            <span className="ob-input-flag ob-input-flag--placeholder" aria-hidden="true">🌍</span>
          )}
          <input
            ref={inputRef}
            id="country-input"
            type="text"
            className="ob-input"
            placeholder="Search for your country…"
            value={query}
            onChange={handleInputChange}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setTimeout(() => setIsOpen(false), 150)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            aria-autocomplete="list"
            aria-controls="country-listbox"
            aria-activedescendant={isOpen ? `country-option-${highlightIndex}` : undefined}
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
            id="country-listbox"
            ref={listRef}
            role="listbox"
            className="ob-dropdown"
            aria-label="Country options"
          >
            {filtered.map((country, idx) => (
              <li
                key={country.code}
                id={`country-option-${idx}`}
                role="option"
                aria-selected={selected?.code === country.code}
                className={`ob-dropdown-item ${idx === highlightIndex ? 'ob-dropdown-item--highlight' : ''} ${selected?.code === country.code ? 'ob-dropdown-item--selected' : ''}`}
                onMouseDown={() => handleSelect(country)}
              >
                <span className="ob-dropdown-flag">{country.emoji}</span>
                <span className="ob-dropdown-name">{country.name}</span>
                <span className="ob-dropdown-code">{country.code}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        id="country-next-btn"
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
