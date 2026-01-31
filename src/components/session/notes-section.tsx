'use client';

import { useState, useEffect } from 'react';
import { mutate } from 'swr';

interface Props {
  sessionId: string;
  initialNotes?: string;
}

export default function NotesSection({ sessionId, initialNotes = '' }: Props) {
  const [notes, setNotes] = useState(initialNotes);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-save notes when they change
  useEffect(() => {
    if (notes === initialNotes) return;

    const timeoutId = setTimeout(() => {
      saveNotes();
    }, 1000); // Save after 1 second of inactivity

    return () => clearTimeout(timeoutId);
  }, [notes]);

  const saveNotes = async () => {
    if (notes === initialNotes) return;

    setIsSaving(true);
    setSaveStatus('saving');

    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      
      setSaveStatus('saved');
      mutate(`/api/sessions/${sessionId}`);
      
      // Clear save status after 2 seconds
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (error) {
      console.error('Failed to save notes:', error);
      setSaveStatus('unsaved');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
    if (saveStatus !== 'saving') {
      setSaveStatus('unsaved');
    }
  };

  const handleFocus = () => {
    setIsExpanded(true);
  };

  const handleBlur = () => {
    // Small delay to allow for save operations
    setTimeout(() => {
      setIsExpanded(false);
    }, 200);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-gray-900">Notes</h3>
        {saveStatus && (
          <span className={`text-sm px-2 py-1 rounded ${
            saveStatus === 'saved' 
              ? 'bg-green-100 text-green-700' 
              : saveStatus === 'saving'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-yellow-100 text-yellow-700'
          }`}>
            {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Unsaved'}
          </span>
        )}
      </div>

      {/* Notes Textarea */}
      <div className="flex-1 flex flex-col">
        <textarea
          value={notes}
          onChange={handleNotesChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Take notes during your study session..."
          className="w-full p-4 border-2 border-gray-200 rounded-lg resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-20 transition-all duration-300 text-gray-900 placeholder-gray-400"
          style={{ 
            minHeight: '80px',
            height: isExpanded 
              ? '250px' 
              : notes.length > 200 
                ? '200px' 
                : notes.length > 50 
                  ? '120px' 
                  : '80px'
          }}
        />
        
        {/* Character count */}
        <div className="mt-2 text-xs text-gray-500 text-right">
          {notes.length} characters
        </div>
      </div>
    </div>
  );
}
