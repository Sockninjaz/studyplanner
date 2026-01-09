'use client';

import { useState, useEffect } from 'react';
import { mutate } from 'swr';

interface StudySession {
  _id: string;
  title: string;
  subject: string;
  startTime: Date;
  endTime: Date;
  isCompleted: boolean;
  checklist: Array<{ task: string; completed: boolean }>;
}

interface Exam {
  _id: string;
  subject: string;
  date: Date;
  studyMaterials?: Array<{
    chapter: string;
    book: string;
    difficulty: number;
    confidence: number;
    estimatedHours: number;
    completed: boolean;
  }>;
}

interface ExamModalProps {
  exam: Exam | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ExamModal({ exam, isOpen, onClose }: ExamModalProps) {
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (exam && isOpen) {
      fetchSessions();
    }
  }, [exam, isOpen]);

  const fetchSessions = async () => {
    if (!exam) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/sessions?examId=${exam._id}`);
      if (response.ok) {
        const data = await response.json();
        setSessions(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExam = async () => {
    if (!exam) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/exams/${exam._id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete exam');
      }

      // Revalidate the exams list multiple ways to ensure it updates
      mutate('/api/exams');
      
      // Also trigger a global refresh for any components using this data
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('examDeleted', { detail: { examId: exam._id } });
        window.dispatchEvent(event);
      }
      
      // Close modal immediately
      onClose();
    } catch (error) {
      console.error('Error deleting exam:', error);
      alert('Failed to delete exam');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const completedSessions = sessions.filter(s => s.isCompleted).length;
  const totalSessions = sessions.length;
  const progressPercentage = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

  if (!isOpen || !exam) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-30 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative z-10 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">{exam.subject}</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  console.log('Delete button clicked!');
                  setShowDeleteConfirm(true);
                }}
                className="text-red-500 hover:text-red-700 transition-colors"
                title="Delete exam"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
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
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Exam Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Exam Date</h3>
              <p className="text-blue-700">
                {new Date(exam.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-900 mb-2">Progress</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-green-700">{completedSessions} of {totalSessions} sessions completed</span>
                  <span className="text-green-700 font-medium">{Math.round(progressPercentage)}%</span>
                </div>
                <div className="w-full bg-green-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Study Materials */}
          {exam.studyMaterials && exam.studyMaterials.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Study Materials</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {exam.studyMaterials.map((material, index) => (
                  <div key={index} className="border border-gray-200 p-3 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">{material.chapter}</p>
                        <p className="text-sm text-gray-600">{material.book}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        material.completed 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {material.completed ? 'Completed' : 'In Progress'}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-4 text-xs text-gray-500">
                      <span>Difficulty: {material.difficulty}/5</span>
                      <span>Confidence: {material.confidence}/5</span>
                      <span>{material.estimatedHours}h</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Study Sessions */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Study Sessions</h3>
            {loading ? (
              <p className="text-gray-500">Loading sessions...</p>
            ) : sessions.length === 0 ? (
              <p className="text-gray-500">No study sessions planned yet.</p>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <div key={session._id} className="border border-gray-200 p-4 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-gray-900">{session.title}</h4>
                        <p className="text-sm text-gray-600">{session.subject}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(session.startTime).toLocaleDateString()} at{' '}
                          {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <span className={`px-3 py-1 text-xs rounded-full ${
                        session.isCompleted 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {session.isCompleted ? 'Completed' : 'Scheduled'}
                      </span>
                    </div>
                    
                    {session.checklist && session.checklist.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-gray-700 mb-2">Checklist:</p>
                        <div className="space-y-1">
                          {session.checklist.map((item, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={item.completed}
                                readOnly
                                className="rounded border-gray-300"
                              />
                              <span className={item.completed ? 'text-gray-500 line-through' : 'text-gray-700'}>
                                {item.task}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-xl shadow-2xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Exam</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "{exam.subject}"? This will also delete all {sessions.length} study sessions associated with this exam. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  console.log('Cancel clicked');
                  setShowDeleteConfirm(false);
                }}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  console.log('Delete confirmed clicked');
                  handleDeleteExam();
                }}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
