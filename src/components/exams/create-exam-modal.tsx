'use client';

import { useState, useEffect } from 'react';
import { mutate } from 'swr';

interface StudyMaterial {
  chapter: string;
  difficulty: number;
  confidence: number;
  user_estimated_total_hours: number;
}

interface OverloadedDay {
  date: string;
  sessions: number;
  limit: number;
}

interface OverloadWarningData {
  examId: string;
  warning: string;
  overloadedDays: OverloadedDay[];
}

interface CreateExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  dailyMaxHours: number;
  adjustmentPercentage: number;
  sessionDuration: number;
  initialDate?: string;
}

export default function CreateExamModal({ isOpen, onClose, dailyMaxHours, adjustmentPercentage, sessionDuration, initialDate }: CreateExamModalProps) {
  const [subject, setSubject] = useState('');
  
  // Calculate default date (1 week from now)
  const getDefaultDate = () => {
    if (initialDate) return initialDate;
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
  };
  
  const [date, setDate] = useState(getDefaultDate());
  const [studyMaterial, setStudyMaterial] = useState<StudyMaterial>({
    chapter: 'Chapters 1-5',
    difficulty: 3,
    confidence: 3,
    user_estimated_total_hours: 5,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [overloadWarning, setOverloadWarning] = useState<OverloadWarningData | null>(null);
  const [isDeletingExam, setIsDeletingExam] = useState(false);

  // Update date when modal opens with a new initialDate
  useEffect(() => {
    if (isOpen) {
      setDate(getDefaultDate());
    }
  }, [isOpen, initialDate]);

  const finishAndClose = () => {
    mutate('/api/exams');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('calendarUpdated'));
    }
    setSubject('');
    setDate(getDefaultDate());
    setStudyMaterial({
      chapter: 'Chapters 1-5',
      difficulty: 3,
      confidence: 3,
      user_estimated_total_hours: 5,
    });
    setOverloadWarning(null);
    onClose();
  };

  const handleDeleteExam = async () => {
    if (!overloadWarning?.examId) return;
    
    setIsDeletingExam(true);
    try {
      const res = await fetch(`/api/exams/${overloadWarning.examId}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        throw new Error('Failed to delete exam');
      }
      
      mutate('/api/exams');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('calendarUpdated'));
      }
      setOverloadWarning(null);
      // Keep the form open so user can adjust and try again
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to delete exam'}`);
    } finally {
      setIsDeletingExam(false);
    }
  };

  const handleContinueWithOverload = () => {
    finishAndClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !date || !studyMaterial.chapter) {
      alert('Please fill out all fields.');
      return;
    }
    setIsSubmitting(true);

    try {
      console.log('🚀 Creating exam with preferences:', {
        dailyMaxHours,
        adjustmentPercentage,
        sessionDuration,
        studyMaterial
      });
      
      const res = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          date,
          daily_max_hours: dailyMaxHours,
          adjustment_percentage: adjustmentPercentage,
          session_duration: sessionDuration,
          studyMaterials: [studyMaterial], // API expects an array
        }),
      });

      const responseData = await res.json();
      
      if (!res.ok) {
        throw new Error(responseData.error || 'Failed to create exam');
      }

      // Check for overload warning and show confirmation modal
      if (responseData.data?.overloadWarning && responseData.data?.overloadedDays) {
        setOverloadWarning({
          examId: responseData.data.exam._id,
          warning: responseData.data.overloadWarning,
          overloadedDays: responseData.data.overloadedDays,
        });
        // Don't close yet - wait for user decision
        return;
      }

      // No overload - proceed normally
      finishAndClose();
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to create exam'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-lg mx-4 bg-white rounded-3xl shadow-2xl">
        <div className="px-6 py-4 border-b border-neutral-dark  border-opacity-20 bg-neutral-light rounded-t-3xl">
          <h2 className="text-2xl font-bold text-neutral-dark">Add New Exam</h2>
        </div>
        <form id="exam-form" onSubmit={handleSubmit} className="space-y-6 px-6 py-6">
          <div>
            <label htmlFor="subject" className="block text-sm font-semibold text-neutral-dark mb-3">Subject</label>
            <input 
              type="text" 
              id="subject" 
              value={subject} 
              onChange={(e) => setSubject(e.target.value)} 
              className="block w-full px-4 py-3 rounded-lg border-2 border-neutral-dark border-opacity-30 shadow-sm focus:border-primary focus:ring-2 focus:ring-primary focus:ring-opacity-20 transition-all" 
              placeholder="Enter subject name..."
              required 
            />
          </div>
          <div>
            <label htmlFor="date" className="block text-sm font-semibold text-neutral-dark mb-3">Exam Date</label>
            <input 
              type="date" 
              id="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              className="block w-full px-4 py-3 rounded-lg border-2 border-neutral-dark border-opacity-30 shadow-sm focus:border-primary focus:ring-2 focus:ring-primary focus:ring-opacity-20 transition-all" 
              required 
            />
          </div>
          <div className="p-6 border-2 border-neutral-dark border-opacity-20 rounded-xl bg-neutral-light space-y-5">
            <h3 className="font-semibold text-neutral-dark text-lg">Study Parameters</h3>
            <div>
              <label className="block text-sm font-semibold text-neutral-dark mb-3">Content</label>
              <input 
                type="text" 
                value={studyMaterial.chapter} 
                onChange={(e) => setStudyMaterial({...studyMaterial, chapter: e.target.value})} 
                className="block w-full px-4 py-3 rounded-lg border-2 border-neutral-dark border-opacity-30 shadow-sm focus:border-primary focus:ring-2 focus:ring-primary focus:ring-opacity-20 transition-all" 
                placeholder="What do you need to study?"
                required 
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-neutral-dark mb-3">My Est. Hours</label>
                <input 
                  type="number" 
                  value={studyMaterial.user_estimated_total_hours} 
                  onChange={(e) => setStudyMaterial({...studyMaterial, user_estimated_total_hours: parseInt(e.target.value) || 1})} 
                  className="block w-full px-3 py-3 rounded-lg border-2 border-neutral-dark border-opacity-30 shadow-sm focus:border-primary focus:ring-2 focus:ring-primary focus:ring-opacity-20 transition-all" 
                  min="1"
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-dark mb-3">Difficulty</label>
                <select 
                  value={studyMaterial.difficulty} 
                  onChange={(e) => setStudyMaterial({...studyMaterial, difficulty: parseInt(e.target.value)})} 
                  className="block w-full px-3 py-3 rounded-lg border-2 border-neutral-dark border-opacity-30 shadow-sm focus:border-primary focus:ring-2 focus:ring-primary focus:ring-opacity-20 transition-all"
                >
                  {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-dark mb-3">Confidence</label>
                <select 
                  value={studyMaterial.confidence} 
                  onChange={(e) => setStudyMaterial({...studyMaterial, confidence: parseInt(e.target.value)})} 
                  className="block w-full px-3 py-3 rounded-lg border-2 border-neutral-dark border-opacity-30 shadow-sm focus:border-primary focus:ring-2 focus:ring-primary focus:ring-opacity-20 transition-all"
                >
                  {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
          </div>
        </form>
        <div className="px-6 py-4 border-t bg-neutral-light rounded-b-3xl">
          <button type="submit" form="exam-form" disabled={isSubmitting} className="w-full inline-flex justify-center rounded-md border border-transparent bg-[rgb(54,65,86)] py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 disabled:opacity-50">
            {isSubmitting ? 'Creating...' : 'Create Plan'}
          </button>
        </div>
      </div>

      {/* Overload Warning Modal */}
      {overloadWarning && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black bg-opacity-60" />
          <div className="relative z-[60] w-full max-w-md mx-4 bg-white rounded-3xl shadow-2xl">
            <div className="px-6 py-4 border-b bg-red-50 rounded-t-3xl">
              <h2 className="text-xl font-bold text-red-700 flex items-center gap-2">
                <span className="text-2xl">⚠️</span> Daily Limit
              </h2>
            </div>
            <div className="px-6 py-4 space-y-3">
              <p className="text-gray-700">
                <strong>{overloadWarning.overloadedDays.length}</strong> day(s) exceed <strong>{overloadWarning.overloadedDays[0]?.limit}</strong> session limit
              </p>
              <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                <ul className="text-sm text-gray-700 space-y-1">
                  {overloadWarning.overloadedDays.map((day) => (
                    <li key={day.date} className="flex justify-between">
                      <span>{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      <span className="text-red-600 font-medium">{day.sessions}/{day.limit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 rounded-b-3xl flex gap-3">
              <button
                onClick={handleDeleteExam}
                disabled={isDeletingExam}
                className="flex-1 inline-flex justify-center rounded-lg border border-red-300 bg-white py-2 px-4 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-50"
              >
                {isDeletingExam ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={handleContinueWithOverload}
                className="flex-1 inline-flex justify-center rounded-lg border border-transparent py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-opacity-90"
                style={{ backgroundColor: '#ff4445' }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
