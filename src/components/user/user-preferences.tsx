'use client';

import { useState, useEffect } from 'react';

interface UserPreferences {
  daily_study_limit: number;
  adjustment_percentage: number;
  session_duration: number;
}

interface UserPreferencesProps {
  onPreferencesChange?: (preferences: UserPreferences) => void;
}

export default function UserPreferences({ onPreferencesChange }: UserPreferencesProps) {
  const [preferences, setPreferences] = useState<UserPreferences>({
    daily_study_limit: 4,
    adjustment_percentage: 25,
    session_duration: 30,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const res = await fetch('/api/user/preferences');
      if (res.ok) {
        const data = await res.json();
        setPreferences({
          daily_study_limit: data.daily_study_limit || 4,
          adjustment_percentage: data.adjustment_percentage || 25,
          session_duration: data.session_duration || 30,
        });
        onPreferencesChange?.(preferences);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const savePreferences = async () => {
    setIsSaving(true);
    setMessage('');

    try {
      const res = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });

      if (res.ok) {
        const data = await res.json();
        setMessage('Preferences saved successfully!');
        onPreferencesChange?.(preferences);
      } else {
        const errorData = await res.json();
        setMessage(`Error: ${errorData.error}`);
      }
    } catch (error) {
      setMessage('Error saving preferences');
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleInputChange = (field: keyof UserPreferences, value: number) => {
    const newPreferences = { ...preferences, [field]: value };
    setPreferences(newPreferences);
  };

  if (isLoading) {
    return (
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Study Preferences</h3>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="daily-limit" className="block text-sm font-medium text-gray-700 mb-1">
            Daily Study Limit (Hours)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              id="daily-limit"
              min="1"
              max="12"
              value={preferences.daily_study_limit}
              onChange={(e) => handleInputChange('daily_study_limit', parseInt(e.target.value))}
              className="flex-1"
            />
            <span className="text-lg font-bold text-indigo-600 w-8">
              {preferences.daily_study_limit}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Maximum study hours per day (1-12 hours)
          </p>
        </div>

        <div>
          <label htmlFor="session-duration" className="block text-sm font-medium text-gray-700 mb-1">
            Session Duration (Minutes)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              id="session-duration"
              min="15"
              max="120"
              step="15"
              value={preferences.session_duration}
              onChange={(e) => handleInputChange('session_duration', parseInt(e.target.value))}
              className="flex-1"
            />
            <span className="text-lg font-bold text-green-600 w-12">
              {preferences.session_duration}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Length of each study session (15-120 minutes)
          </p>
        </div>

        <div>
          <label htmlFor="adjustment-percent" className="block text-sm font-medium text-gray-700 mb-1">
            Max Difficulty Adjustment (%)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              id="adjustment-percent"
              min="0"
              max="25"
              step="5"
              value={preferences.adjustment_percentage}
              onChange={(e) => handleInputChange('adjustment_percentage', parseInt(e.target.value))}
              className="flex-1"
            />
            <span className="text-sm font-medium text-gray-900 w-12">
              {preferences.adjustment_percentage}%
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Maximum percentage adjustment for difficulty/confidence (0-25%)
          </p>
        </div>

        {message && (
          <div className={`text-sm p-2 rounded ${
            message.includes('Error') 
              ? 'bg-red-100 text-red-700' 
              : 'bg-green-100 text-green-700'
          }`}>
            {message}
          </div>
        )}

        <button
          onClick={savePreferences}
          disabled={isSaving}
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
}
