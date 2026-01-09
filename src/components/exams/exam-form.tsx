'use client';

import { useState } from 'react';
import { mutate } from 'swr';

interface StudyMaterial {
  chapter: string;
  book: string;
  difficulty: number;
  confidence: number;
  estimatedHours: number;
}

export default function ExamForm() {
  const [subject, setSubject] = useState('');
  const [date, setDate] = useState('');
  const [studyMaterials, setStudyMaterials] = useState<StudyMaterial[]>([]);
  const [currentMaterial, setCurrentMaterial] = useState({
    chapter: '',
    book: '',
    difficulty: 3,
    confidence: 3,
    estimatedHours: 2,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addMaterial = () => {
    if (currentMaterial.chapter && currentMaterial.book) {
      setStudyMaterials([...studyMaterials, { ...currentMaterial }]);
      setCurrentMaterial({
        chapter: '',
        book: '',
        difficulty: 3,
        confidence: 3,
        estimatedHours: 2,
      });
    }
  };

  const removeMaterial = (index: number) => {
    setStudyMaterials(studyMaterials.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (studyMaterials.length === 0) {
      alert('Please add at least one study material');
      return;
    }
    
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/exams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subject, date, studyMaterials }),
      });

      if (!res.ok) {
        throw new Error('Failed to create exam');
      }

      // Clear form
      setSubject('');
      setDate('');
      setStudyMaterials([]);
      setCurrentMaterial({
        chapter: '',
        book: '',
        difficulty: 3,
        confidence: 3,
        estimatedHours: 2,
      });

      // Revalidate the exams list
      mutate('/api/exams');
    } catch (error) {
      console.error(error);
      alert('Failed to create exam');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-md">
      <h2 className="mb-4 text-xl font-bold">Create New Exam</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="subject" className="mb-2 block text-sm font-medium text-gray-700">
            Subject
          </label>
          <input
            type="text"
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="e.g., Mathematics, Physics, Chemistry"
            required
          />
        </div>
        
        <div className="mb-4">
          <label htmlFor="date" className="mb-2 block text-sm font-medium text-gray-700">
            Exam Date
          </label>
          <input
            type="date"
            id="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
        </div>

        <div className="mb-6">
          <h3 className="mb-4 text-lg font-semibold">Study Materials</h3>
          
          {/* Add Material Form */}
          <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Material (e.g., "chapter 3-5, photosynthesis, hand-out")
                </label>
                <input
                  type="text"
                  value={currentMaterial.chapter}
                  onChange={(e) => setCurrentMaterial({...currentMaterial, chapter: e.target.value})}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="chapter 3-5, photosynthesis, hand-out"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Book/Source
                </label>
                <input
                  type="text"
                  value={currentMaterial.book}
                  onChange={(e) => setCurrentMaterial({...currentMaterial, book: e.target.value})}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="Textbook name"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Difficulty (1-5)
                </label>
                <select
                  value={currentMaterial.difficulty}
                  onChange={(e) => setCurrentMaterial({...currentMaterial, difficulty: parseInt(e.target.value)})}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  {[1,2,3,4,5].map(num => (
                    <option key={num} value={num}>{num} - {num === 1 ? 'Very Easy' : num === 5 ? 'Very Hard' : ['Easy', 'Medium', 'Hard'][num-2]}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confidence (1-5)
                </label>
                <select
                  value={currentMaterial.confidence}
                  onChange={(e) => setCurrentMaterial({...currentMaterial, confidence: parseInt(e.target.value)})}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  {[1,2,3,4,5].map(num => (
                    <option key={num} value={num}>{num} - {num === 1 ? 'Not Confident' : num === 5 ? 'Very Confident' : ['Slightly Confident', 'Moderately Confident', 'Confident'][num-2]}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Est. Hours
                </label>
                <input
                  type="number"
                  min="0.5"
                  max="20"
                  step="0.5"
                  value={currentMaterial.estimatedHours}
                  onChange={(e) => setCurrentMaterial({...currentMaterial, estimatedHours: parseFloat(e.target.value)})}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            </div>
            
            <button
              type="button"
              onClick={addMaterial}
              className="mt-3 bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition-colors"
            >
              Add Material
            </button>
          </div>

          {/* Materials List */}
          {studyMaterials.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">Added Materials:</h4>
              {studyMaterials.map((material, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{material.chapter}</p>
                    <p className="text-sm text-gray-600">{material.book}</p>
                    <div className="flex gap-4 mt-1 text-xs text-gray-500">
                      <span>Difficulty: {material.difficulty}/5</span>
                      <span>Confidence: {material.confidence}/5</span>
                      <span>{material.estimatedHours}h</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMaterial(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting || studyMaterials.length === 0}
          className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {isSubmitting ? 'Creating Exam & Generating Study Plan...' : 'Create Exam & Generate Study Plan'}
        </button>
      </form>
    </div>
  );
}
