'use client';

import { useState } from 'react';
import { mutate } from 'swr';

export default function StudyMaterialForm({ examId }: { examId: string }) {
  const [chapter, setChapter] = useState('');
  const [book, setBook] = useState('');
  const [estimatedHours, setEstimatedHours] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/exams/${examId}/materials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chapter,
          difficulty: 3, // Default difficulty
          confidence: 3, // Default confidence
          user_estimated_total_hours: estimatedHours,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to add study material');
      }

      // Clear form
      setChapter('');
      setBook('');
      setEstimatedHours(1);

      // Revalidate the exam details
      mutate(`/api/exams/${examId}`);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-md">
      <h2 className="mb-4 text-xl font-bold">Add Study Material</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor="chapter" className="mb-2 block text-sm font-medium text-gray-700">
            Chapter/Topic
          </label>
          <input
            type="text"
            id="chapter"
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="book" className="mb-2 block text-sm font-medium text-gray-700">
            Book/Source
          </label>
          <input
            type="text"
            id="book"
            value={book}
            onChange={(e) => setBook(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
        </div>
                <div className="md:col-span-2">
          <label htmlFor="estimatedHours" className="mb-2 block text-sm font-medium text-gray-700">
            Estimated Hours
          </label>
          <input
            type="number"
            id="estimatedHours"
            min="0.5"
            step="0.5"
            value={estimatedHours}
            onChange={(e) => setEstimatedHours(parseFloat(e.target.value))}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
        </div>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isSubmitting ? 'Adding...' : 'Add Material'}
          </button>
        </div>
      </form>
    </div>
  );
}
