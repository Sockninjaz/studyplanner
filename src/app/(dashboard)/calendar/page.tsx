'use client';

import { useState, useEffect } from 'react';
import Calendar from '@/components/calendar/calendar';
import CalendarListView from '@/components/calendar/calendar-list-view';
import SessionSidebar from '@/components/calendar/session-sidebar';
import CreateExamModal from '@/components/exams/create-exam-modal';
import AddItemModal from '@/components/calendar/add-item-modal';
import { useSidebar } from '@/app/(dashboard)/layout';

interface UserPreferences {
  daily_study_limit: number;
  adjustment_percentage: number;
  session_duration: number;
}

export default function CalendarPage() {
  const { isSidebarCollapsed } = useSidebar();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({
    daily_study_limit: 4,
    adjustment_percentage: 25,
    session_duration: 30,
  });

  useEffect(() => {
    fetchUserPreferences();
  }, []);

  const fetchUserPreferences = async () => {
    try {
      // First check localStorage for immediate response
      const savedPrefs = localStorage.getItem('userPreferences');
      
      if (savedPrefs) {
        try {
          const prefs = JSON.parse(savedPrefs);
          setUserPreferences(prefs);
        } catch (error) {
          console.error('Error parsing localStorage preferences:', error);
        }
      }

      // Then fetch from server for latest data
      const res = await fetch('/api/user/preferences');
      
      if (res.ok) {
        const data = await res.json();
        const serverPrefs = {
          daily_study_limit: data.daily_study_limit || 4,
          adjustment_percentage: data.adjustment_percentage || 25,
          session_duration: data.session_duration || 30,
        };
        
        // Only use server data if localStorage doesn't exist
        if (!savedPrefs) {
          setUserPreferences(serverPrefs);
          localStorage.setItem('userPreferences', JSON.stringify(serverPrefs));
        }
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    }
  };

  const handleSessionClick = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setIsSidebarOpen(true);
  };

  const handleCloseSidebar = () => {
    setIsSidebarOpen(false);
    setSelectedSessionId(null);
  };

  
  const handleAddItemClick = (date: string) => {
    setSelectedDate(date);
    setIsAddItemModalOpen(true);
  };

  const handleCloseExamModal = () => {
    setIsExamModalOpen(false);
    setSelectedDate(undefined);
  };

  const handleCloseAddItemModal = () => {
    setIsAddItemModalOpen(false);
    setSelectedDate(undefined);
  };

  const handleAddExam = () => {
    setIsAddItemModalOpen(false);
    setIsExamModalOpen(true);
  };

  const handleAddEvent = () => {
    // TODO: Implement event creation
    setIsAddItemModalOpen(false);
    alert('Event creation coming soon! For now, use the exam option.');
  };

  return (
    <>
      <div className="flex h-[calc(100vh-4rem)] gap-4">
        {/* Main Content Area */}
        <div className={`transition-all duration-300 ${isSidebarOpen ? 'w-[60%]' : 'w-full'}`}>
          {/* View Toggle */}
          <div className="bg-[#ffff] border-b border-[#4a4a4a] border-opacity-20 px-4 py-3">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-[#4a4a4a]">
                {viewMode === 'list' ? 'Schedule' : 'Calendar'}
              </h1>
              <div className="flex items-center gap-3">
                {viewMode === 'list' && (
                  <button
                    onClick={() => setIsAddItemModalOpen(true)}
                    className="bg-[rgb(54,65,86)] text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Exam
                  </button>
                )}
                <div className="flex items-center bg-white rounded-lg p-1 border border-[#4a4a4a] border-opacity-20">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      viewMode === 'list'
                        ? 'bg-[rgb(40,57,135)] text-white shadow-sm'
                        : 'text-[#4a4a4a] hover:text-[#4a4a4a]'
                    }`}
                  >
                    List View
                  </button>
                  <button
                    onClick={() => setViewMode('calendar')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      viewMode === 'calendar'
                        ? 'bg-[rgb(40,57,135)] text-white shadow-sm'
                        : 'text-[#4a4a4a] hover:text-[#4a4a4a]'
                    }`}
                  >
                    Calendar View
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="h-[calc(100%-4rem)] overflow-hidden">
            {viewMode === 'list' ? (
              <CalendarListView 
                onSessionClick={handleSessionClick}
                onAddItemClick={handleAddItemClick}
                sidebarOpen={isSidebarOpen}
                sidebarCollapsed={isSidebarCollapsed}
              />
            ) : (
              <div className="h-full p-4">
                <Calendar 
                  onSessionClick={handleSessionClick} 
                  onAddItemClick={handleAddItemClick}
                  sidebarOpen={isSidebarOpen} 
                  sidebarCollapsed={isSidebarCollapsed}
                />
              </div>
            )}
          </div>
        </div>

        {/* Session Sidebar */}
        {isSidebarOpen && (
          <div className="w-[40%] transition-all duration-300">
            <div className="h-full rounded-lg border border-gray-200 bg-white shadow-md overflow-hidden">
              <SessionSidebar 
                sessionId={selectedSessionId} 
                onClose={handleCloseSidebar}
              />
            </div>
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      <AddItemModal 
        isOpen={isAddItemModalOpen}
        onClose={handleCloseAddItemModal}
        onAddExam={handleAddExam}
        onAddEvent={handleAddEvent}
      />

      {/* Exam Creation Modal */}
      <CreateExamModal 
        isOpen={isExamModalOpen}
        onClose={handleCloseExamModal}
        dailyMaxHours={userPreferences.daily_study_limit}
        adjustmentPercentage={userPreferences.adjustment_percentage}
        sessionDuration={userPreferences.session_duration}
        initialDate={selectedDate}
      />
    </>
  );
}

