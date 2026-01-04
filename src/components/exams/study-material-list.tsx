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
      <div className="mt-6 text-center text-gray-500">
        <p>No study materials added yet.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-white shadow-md">
      <h2 className="border-b border-gray-200 p-6 text-xl font-bold">
        Study Materials
      </h2>
      <ul className="divide-y divide-gray-200">
        {materials.map((material) => (
          <li key={material._id} className="flex items-center justify-between p-6">
            <div>
              <h3 className="text-lg font-semibold">{material.chapter}</h3>
              <p className="text-sm text-gray-600">{material.book}</p>
              <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
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
