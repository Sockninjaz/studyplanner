'use client';

import { useState } from 'react';
import { mutate } from 'swr';

interface StudyMaterial {
  chapter: string;
  difficulty: number;
  confidence: number;
  user_estimated_total_hours: number;
}

interface CreateExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  dailyMaxHours: number;
  adjustmentPercentage: number;
  sessionDuration: number;
}

export default function CreateExamModal({ isOpen, onClose, dailyMaxHours, adjustmentPercentage, sessionDuration }: CreateExamModalProps) {
  const [subject, setSubject] = useState('');
  
  // Calculate default date (1 week from now)
  const getDefaultDate = () => {
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

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create exam');
      }

      mutate('/api/exams');
      
      // Refresh the calendar
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('calendarUpdated'));
      }
      
      // Reset form state
      setSubject('');
      setDate(getDefaultDate());
      setStudyMaterial({
        chapter: 'Chapters 1-5',
        difficulty: 3,
        confidence: 3,
        user_estimated_total_hours: 5,
      });
      
      onClose();
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
      <div className="relative z-50 w-full max-w-lg mx-4 bg-white rounded-xl shadow-2xl">
        <div className="px-6 py-4 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Add New Exam</h2>
        </div>
        <form id="exam-form" onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input type="text" id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm" required />
          </div>
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">Exam Date</label>
            <input type="date" id="date" value={date} onChange={(e) => setDate(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm" required />
          </div>
          <div className="p-4 border rounded-lg bg-gray-50 space-y-3">
            <h3 className="font-semibold">Study Parameters</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
              <input type="text" value={studyMaterial.chapter} onChange={(e) => setStudyMaterial({...studyMaterial, chapter: e.target.value})} className="block w-full rounded-md border-gray-300 shadow-sm" required />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">My Est. Hours</label>
                <input type="number" value={studyMaterial.user_estimated_total_hours} onChange={(e) => setStudyMaterial({...studyMaterial, user_estimated_total_hours: parseInt(e.target.value) || 1})} className="block w-full rounded-md border-gray-300 shadow-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                <select value={studyMaterial.difficulty} onChange={(e) => setStudyMaterial({...studyMaterial, difficulty: parseInt(e.target.value)})} className="block w-full rounded-md border-gray-300 shadow-sm">
                  {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confidence</label>
                <select value={studyMaterial.confidence} onChange={(e) => setStudyMaterial({...studyMaterial, confidence: parseInt(e.target.value)})} className="block w-full rounded-md border-gray-300 shadow-sm">
                  {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
          </div>
        </form>
        <div className="px-6 py-4 border-t bg-gray-50">
          <button type="submit" form="exam-form" disabled={isSubmitting} className="w-full inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50">
            {isSubmitting ? 'Generating Plan...' : 'Create Exam & Generate Plan'}
          </button>
        </div>
      </div>
    </div>
  );
}
