'use client';

interface StudyMaterial {
  chapter: string;
  difficulty: number;
  confidence: number;
  user_estimated_total_hours: number;
  completed: boolean;
}

interface Exam {
  _id: string;
  subject: string;
  date: Date;
  studyMaterials: StudyMaterial[];
}

interface StudyMaterialsDisplayProps {
  exam: Exam | null;
}

export default function StudyMaterialsDisplay({ exam }: StudyMaterialsDisplayProps) {
  if (!exam || !exam.studyMaterials || exam.studyMaterials.length === 0) {
    return null;
  }

  const completedCount = exam.studyMaterials.filter(m => m.completed).length;
  const totalCount = exam.studyMaterials.length;
  const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="mt-8 p-4 bg-gray-50 rounded-lg">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Study Materials for {exam.subject}</h3>
      
      {/* Progress Overview */}
      <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">
            Progress: {completedCount} of {totalCount} completed
          </span>
          <span className="text-sm font-semibold text-blue-600">
            {Math.round(progressPercentage)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Study Materials List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {exam.studyMaterials.map((material, index) => (
          <div key={index} className="bg-white p-3 rounded-lg border border-gray-200">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="font-medium text-gray-900">{material.chapter}</p>
                <div className="mt-2 flex gap-3 text-xs text-gray-500">
                  <span>Difficulty: {material.difficulty}/5</span>
                  <span>Confidence: {material.confidence}/5</span>
                  <span>{material.user_estimated_total_hours}h</span>
                </div>
              </div>
              <span className={`px-2 py-1 text-xs rounded-full ml-2 ${
                material.completed 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {material.completed ? 'Completed' : 'In Progress'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
