'use client';

import { useState } from 'react';
import { mutate } from 'swr';

interface StudyMaterial {
  chapter: string;
  difficulty: number;
  confidence: number;
}

interface CreateExamModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateExamModal({ isOpen, onClose }: CreateExamModalProps) {
  const [subject, setSubject] = useState('');
  const [date, setDate] = useState('');
  const [studyMaterials, setStudyMaterials] = useState<StudyMaterial[]>([]);
  const [currentMaterial, setCurrentMaterial] = useState({
    chapter: '',
    difficulty: 3,
    confidence: 3,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addMaterial = () => {
    if (currentMaterial.chapter.trim()) {
      const materialToAdd: StudyMaterial = {
        chapter: currentMaterial.chapter,
        difficulty: parseInt(currentMaterial.difficulty.toString()),
        confidence: parseInt(currentMaterial.confidence.toString()),
      };
      setStudyMaterials([...studyMaterials, materialToAdd]);
      setCurrentMaterial({
        chapter: '',
        difficulty: 3,
        confidence: 3,
      });
    }
  };

  const handleMaterialKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addMaterial();
    }
  };

  const removeMaterial = (index: number) => {
    setStudyMaterials(studyMaterials.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subject || !date) {
      alert('Please fill in subject and exam date');
      return;
    }
    
    if (studyMaterials.length === 0) {
      alert('Please add at least one study material');
      return;
    }
    
    setIsSubmitting(true);

    try {
      console.log('Submitting exam:', { subject, date, studyMaterials });
      
      const res = await fetch('/api/exams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subject, date, studyMaterials }),
      });

      console.log('Response status:', res.status);

      if (!res.ok) {
        const errorData = await res.json();
        console.error('Error response:', errorData);
        throw new Error(errorData.error || 'Failed to create exam');
      }

      const result = await res.json();
      console.log('Success response:', result);
      
      // Clear form
      setSubject('');
      setDate('');
      setStudyMaterials([]);
      setCurrentMaterial({
        chapter: '',
        difficulty: 3,
        confidence: 3,
      });

      // Revalidate the exams list
      mutate('/api/exams');
      
      // Close modal
      onClose();
    } catch (error) {
      console.error('Error creating exam:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to create exam'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative z-50 w-full max-w-2xl mx-4 bg-white rounded-xl shadow-2xl">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Create New Exam</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
          <form id="exam-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Subject */}
            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                Subject
              </label>
              <input
                type="text"
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-lg py-3 px-4"
                placeholder="e.g., Mathematics, Physics, Chemistry"
                required
              />
            </div>
            
            {/* Exam Date */}
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
                Exam Date
              </label>
              <input
                type="date"
                id="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-lg py-3 px-4"
                required
              />
            </div>

            {/* Study Materials Section */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Study Materials</h3>
              
              {/* Current Material Input */}
              <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
                {/* Material Topics */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Material Topics
                  </label>
                  <input
                    type="text"
                    value={currentMaterial.chapter}
                    onChange={(e) => setCurrentMaterial({...currentMaterial, chapter: e.target.value})}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-lg py-3 px-4"
                    placeholder="e.g., chapter 3-5, photosynthesis, hand-out"
                  />
                  <p className="text-xs text-gray-500 mt-1">Separate multiple topics with commas</p>
                </div>
                
                {/* Difficulty, Confidence, Hours in a row */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Difficulty
                    </label>
                    <select
                      value={currentMaterial.difficulty}
                      onChange={(e) => setCurrentMaterial({...currentMaterial, difficulty: parseInt(e.target.value)})}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-lg py-3 px-4"
                    >
                      {[1,2,3,4,5].map(num => (
                        <option key={num} value={num}>{num} - {num === 1 ? 'Very Easy' : num === 5 ? 'Very Hard' : ['Easy', 'Medium', 'Hard'][num-2]}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confidence
                    </label>
                    <select
                      value={currentMaterial.confidence}
                      onChange={(e) => setCurrentMaterial({...currentMaterial, confidence: parseInt(e.target.value)})}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-lg py-3 px-4"
                    >
                      {[1,2,3,4,5].map(num => (
                        <option key={num} value={num}>{num} - {num === 1 ? 'Not Confident' : num === 5 ? 'Very Confident' : ['Slightly Confident', 'Moderately Confident', 'Confident'][num-2]}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Study Time (Auto-calculated)
                    </label>
                    <div className="text-sm text-gray-500 italic">
                      Based on difficulty and confidence ratings
                    </div>
                  </div>
                </div>
                
                {/* Add Material Button */}
                <button
                  type="button"
                  onClick={addMaterial}
                  disabled={!currentMaterial.chapter.trim()}
                  className="w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Add Material
                </button>
              </div>

              {/* Materials List */}
              {studyMaterials.length > 0 && (
                <div className="mt-3 space-y-2">
                  <h4 className="font-medium text-gray-700">Added Materials ({studyMaterials.length}):</h4>
                  {studyMaterials.map((material, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-lg">{material.chapter}</p>
                        <div className="flex gap-6 mt-2 text-sm text-gray-500">
                          <span>Difficulty: {material.difficulty}/5</span>
                          <span>Confidence: {material.confidence}/5</span>
                          <span>Auto-calculated time</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeMaterial(index)}
                        className="text-red-500 hover:text-red-700 px-3 py-1"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Fixed Footer with Button */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
          <button
            type="submit"
            form="exam-form"
            disabled={isSubmitting || studyMaterials.length === 0}
            className="w-full inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-3 px-8 text-lg font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            onClick={() => console.log('Button clicked!', { isSubmitting, studyMaterialsLength: studyMaterials.length })}
          >
            {isSubmitting ? 'Creating...' : `Create Task ${studyMaterials.length > 0 ? `(${studyMaterials.length} materials)` : '(add materials first)'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
