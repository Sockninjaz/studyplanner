'use client';

import { useState } from 'react';
import { mutate } from 'swr';

interface StudyItem {
  _id: string;
  material: string;
  completed: boolean;
  notes: string;
  selfRating: number;
}

interface Props {
  sessionId: string;
  items: StudyItem[];
}

export default function StudyItemChecklist({ sessionId, items }: Props) {
  const [studyItems, setStudyItems] = useState(items);

  const handleToggle = async (itemId: string, completed: boolean) => {
    const updatedItems = studyItems.map((item) =>
      item._id === itemId ? { ...item, completed } : item
    );
    setStudyItems(updatedItems);

    await fetch(`/api/sessions/${sessionId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studyItems: updatedItems }),
      }
    );
    mutate(`/api/sessions/${sessionId}`);
  };

  return (
    <div className="mt-8">
      <h3 className="mb-4 text-xl font-semibold">Study Items</h3>
      <ul className="space-y-3">
        {studyItems.map((item) => (
          <li key={item._id} className="flex items-center rounded-lg bg-gray-50 p-4">
            <input
              type="checkbox"
              checked={item.completed}
              onChange={(e) => handleToggle(item._id, e.target.checked)}
              className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label className={`ml-3 block text-gray-900 ${item.completed ? 'line-through' : ''}`}>
              {item.material}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
