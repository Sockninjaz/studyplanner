interface StudyMaterial {
  _id: string;
  chapter: string;
  book: string;
  difficulty: number;
  confidence: number;
  estimatedHours: number;
  completed: boolean;
}

interface Props {
  materials: StudyMaterial[];
}

export default function StudyMaterialList({ materials }: Props) {
  if (!materials || materials.length === 0) {
    return (
      <div className="mt-6 text-center text-gray-500 dark:text-slate-400">
        <p>No study materials added yet.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-md">
      <h2 className="border-b border-gray-200 dark:border-slate-700 p-6 text-xl font-bold dark:text-slate-100">
        Study Materials
      </h2>
      <ul className="divide-y divide-gray-200 dark:divide-slate-700">
        {materials.map((material) => (
          <li key={material._id} className="flex items-center justify-between p-6">
            <div>
              <h3 className="text-lg font-semibold dark:text-slate-100">{material.chapter}</h3>
              <p className="text-sm text-gray-600 dark:text-slate-400">{material.book}</p>
              <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500 dark:text-slate-400">
                <span>Difficulty: {material.difficulty}/5</span>
                <span>Confidence: {material.confidence}/5</span>
                <span>Hours: {material.estimatedHours}</span>
              </div>
            </div>
            <div>
              {/* Actions like edit/delete can go here */}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
