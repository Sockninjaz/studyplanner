'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Settings, ChevronDown, LogOut, Star, Sidebar as SidebarIcon, SidebarClose } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useTimer } from '../session/timer-context';
import SettingsModal from './settings-modal';

interface UserPreferences {
  name?: string;
  email?: string;
  openai_api_key?: string;
  daily_study_limit: number;
  soft_daily_limit: number;
  adjustment_percentage: number;
  session_duration: number;
  enable_daily_limits: boolean;
}

interface Exam {
  _id: string;
  subject: string;
  date: Date;
  color?: string;
  isCompleted?: boolean;
}

interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

const Sidebar = ({ isCollapsed = false, onToggle }: SidebarProps) => {
  const timerContext = useTimer();
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const [exams, setExams] = useState<Exam[]>([]);
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  
  const [loading, setLoading] = useState(true);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({
    daily_study_limit: 4,
    soft_daily_limit: 2,
    adjustment_percentage: 25,
    session_duration: 30,
    enable_daily_limits: true,
  });
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    fetchExams();
    fetchPreferences();

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    // Listen for exam deletion events
    const handleExamDeleted = () => {
      fetchExams();
    };

    // Listen for preference updates
    const handlePreferencesUpdated = () => {
      fetchPreferences();
    };

    // Listen for calendar updates (when exams are created)
    const handleCalendarUpdated = () => {
      fetchExams();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('examDeleted', handleExamDeleted);
      window.addEventListener('preferencesUpdated', handlePreferencesUpdated);
      window.addEventListener('calendarUpdated', handleCalendarUpdated);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('examDeleted', handleExamDeleted);
        window.removeEventListener('preferencesUpdated', handlePreferencesUpdated);
        window.removeEventListener('calendarUpdated', handleCalendarUpdated);
        document.removeEventListener('mousedown', handleClickOutside);
      }
    };
  }, []);

  const fetchExams = async () => {
    try {
      const response = await fetch('/api/exams');
      if (response.ok) {
        const data = await response.json();
        setExams(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching exams:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPreferences = async () => {
    try {
      // Fetch full preferences from server
      const response = await fetch('/api/user/preferences');
      if (response.ok) {
        const data = await response.json();
        setUserPreferences(data);
        // Sync study-specific prefs back to local storage for other components
        localStorage.setItem('userPreferences', JSON.stringify(data));
      } else {
        // Fallback to local storage if API fails
        const savedPrefs = localStorage.getItem('userPreferences');
        if (savedPrefs) {
          const prefs = JSON.parse(savedPrefs);
          setUserPreferences(prefs);
        }
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
      // Fallback
      const savedPrefs = localStorage.getItem('userPreferences');
      if (savedPrefs) {
        setUserPreferences(JSON.parse(savedPrefs));
      }
    }
  };


  const openCreateModal = () => {
    router.push('/exams/create');
  };

  const handleDeleteExam = async (examId: string) => {
    if (window.confirm('Are you sure you want to delete this exam and all its study sessions?')) {
      try {
        const res = await fetch(`/api/exams/${examId}`, {
          method: 'DELETE',
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to delete exam');
        }

        // Refresh the exam list
        fetchExams();

        // Dispatch a custom event to notify other components like the calendar
        window.dispatchEvent(new CustomEvent('examDeleted'));

      } catch (error) {
        alert(`Error: ${error instanceof Error ? error.message : 'Failed to delete exam'}`);
      }
    }
  };

  return (
    <>
      <aside
        className={`absolute left-0 top-0 z-20 flex h-screen overflow-y-hidden text-white duration-300 ease-linear lg:static lg:translate-x-0 ${isCollapsed ? 'w-16' : 'w-48'} flex-col`}
        style={{ backgroundColor: 'rgb(54, 65, 86)' }}
      >
        <div className={`flex items-center justify-between relative ${isCollapsed ? 'px-2 py-3 flex-col gap-3' : 'pl-2 pr-3 py-3 gap-1'}`}>
          {!isCollapsed ? (
            <div className="relative flex-1 min-w-0" ref={dropdownRef}>
              <button 
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="w-full flex items-center py-1.5 px-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {session?.user?.image ? (
                    <img src={session.user.image} alt="Profile" className="w-6 h-6 rounded-full flex-shrink-0" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {session?.user?.name?.charAt(0) || 'U'}
                    </div>
                  )}
                  <span className="text-[13px] font-semibold truncate flex-shrink min-w-0">{session?.user?.name || 'User'}</span>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform flex-shrink-0 ml-0.5 ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* Dropdown Menu */}
              {isProfileDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 mb-2">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{session?.user?.name || 'User'}</p>
                    <p className="text-xs text-slate-500 truncate">{session?.user?.email}</p>
                  </div>
                  
                  <button 
                    onClick={() => {
                      setIsSettingsOpen(true);
                      setIsProfileDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Settings size={16} />
                    Settings
                  </button>
                  
                  <Link 
                    href="/upgrade"
                    onClick={() => setIsProfileDropdownOpen(false)}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-amber-600 dark:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors font-medium"
                  >
                    <Star size={16} />
                    Upgrade Plan
                  </Link>
                  
                  <div className="h-px bg-slate-100 dark:bg-slate-800 my-2"></div>
                  
                  <button 
                    onClick={() => signOut()}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                  >
                    <LogOut size={16} />
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="mx-auto">
              {session?.user?.image ? (
                <img src={session.user.image} alt="Profile" className="w-6 h-6 rounded-full" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                  {session?.user?.name?.charAt(0) || 'U'}
                </div>
              )}
            </div>
          )}

          {/* Toggle Button */}
          {onToggle && (
            <div className={`flex flex-shrink-0 ${isCollapsed ? 'w-full justify-center' : ''}`}>
              <button
                onClick={onToggle}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <SidebarIcon size={18} strokeWidth={2} className="opacity-80" />
              </button>
            </div>
          )}
        </div>

        <div className="no-scrollbar flex flex-col overflow-y-auto duration-300 ease-linear">
          <nav className={`py-1 ${isCollapsed ? 'px-1' : 'px-2'} lg:px-3`}>
            {!isCollapsed && (
              <div>
                <ul className="mb-4 flex flex-col gap-0.5">
                  <li>
                    <Link href="/today" className={`group relative flex items-center gap-2.5 rounded-md py-1.5 px-2.5 font-medium text-[13px] duration-300 ease-in-out ${pathname.startsWith('/today') ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
                      <svg className="w-4 h-4 opacity-80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Study Hub
                    </Link>
                  </li>
                  <li>
                    <Link href="/calendar" className={`group relative flex items-center gap-2.5 rounded-md py-1.5 px-2.5 font-medium text-[13px] duration-300 ease-in-out ${pathname.startsWith('/calendar') ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
                      <svg className="w-4 h-4 opacity-80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      Schedule
                    </Link>
                  </li>
                  <li>
                    <Link href="/chat" className={`group relative flex items-center gap-2.5 rounded-md py-1.5 px-2.5 font-medium text-[13px] duration-300 ease-in-out ${pathname.startsWith('/chat') ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
                      <svg className="w-4 h-4 opacity-80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                      </svg>
                      Chat
                    </Link>
                  </li>
                  <li>
                    <Link href="/exams" className={`group relative flex items-center gap-2.5 rounded-md py-1.5 px-2.5 font-medium text-[13px] duration-300 ease-in-out ${pathname.startsWith('/exams') ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
                      <svg className="w-4 h-4 opacity-80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
                      </svg>
                      Exams
                    </Link>
                  </li>
                </ul>
              </div>
            )}

            {isCollapsed && (
              <div className="space-y-1">
                <Link href="/calendar" className={`flex justify-center py-3 rounded-lg transition-colors ${pathname.startsWith('/calendar') ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`} title="Schedule">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </Link>
                <Link href="/today" className={`flex justify-center py-3 rounded-lg transition-colors ${pathname.startsWith('/today') ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`} title="Today">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </Link>
                <Link href="/chat" className={`flex justify-center py-3 rounded-lg transition-colors ${pathname.startsWith('/chat') ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`} title="Chat">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </Link>
                <Link href="/exams" className={`flex justify-center py-3 rounded-lg transition-colors ${pathname.startsWith('/exams') ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`} title="Exams">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477 4.5 1.253" />
                  </svg>
                </Link>
              </div>
            )}

            {!isCollapsed && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5 px-2.5 group/header cursor-pointer">
                  <h3 className="text-[11px] uppercase tracking-wider font-semibold text-gray-400">My Exams</h3>
                  <button
                    onClick={openCreateModal}
                    className="text-gray-400 hover:text-white p-1 rounded-md transition-colors opacity-0 group-hover/header:opacity-100 flex items-center justify-center"
                    title="Add Exam"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
                <ul className="mb-4 flex flex-col gap-0.5">
                  {loading ? (
                    <li className="px-2.5 py-2 text-xs text-white opacity-60">Loading exams...</li>
                  ) : exams.length === 0 ? (
                    <li className="px-4 py-3 text-base text-white opacity-60">No exams scheduled</li>
                  ) : (
                    exams.map((exam, index) => {
                      // Use stored color or stable fallback
                      const getExamColor = (exam: Exam) => {
                        if (exam.color) return exam.color;

                        const colors = [
                          'rgb(253, 231, 76)', // Yellow
                          'rgb(72, 86, 150)',  // Blue  
                          'rgb(250, 175, 205)', // Pink
                          'rgb(66, 191, 221)',  // Cyan
                          'rgb(167, 139, 250)', // Lavender
                          'rgb(52, 211, 153)',  // Mint
                          'rgb(251, 146, 60)',  // Orange/Peach
                          'rgb(45, 212, 191)',  // Teal
                        ];

                        // Stable ID-based fallback
                        // Use a simple hash function (djb2-like) for better distribution than simple sum
                        let hash = 0;
                        const str = exam._id;
                        for (let i = 0; i < str.length; i++) {
                          hash = ((hash << 5) - hash) + str.charCodeAt(i);
                          hash |= 0; // Convert to 32bit integer
                        }
                        return colors[Math.abs(hash) % colors.length];
                      };

                      const examColor = getExamColor(exam);
                      
                      const isActiveTimer = timerContext?.activeSessionData?.exam?._id === exam._id;

                      return (
                        <li key={exam._id}>
                          <div className="w-full flex flex-col items-start rounded-md font-medium text-white duration-300 ease-in-out hover:bg-white hover:bg-opacity-10 group">
                            <div className="w-full relative flex items-center">
                              <Link
                                href={`/exams/${exam._id}`}
                                className="flex-1 flex items-center gap-2.5 py-1.5 px-2.5 text-left min-w-0 overflow-hidden"
                              >
                                <div
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: examColor }}
                                />
                                <span className={`text-[13px] truncate min-w-0 ${exam.isCompleted ? 'line-through text-slate-400' : ''}`} title={exam.subject}>
                                  {exam.subject}
                                </span>
                              </Link>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteExam(exam._id);
                                }}
                                className="px-2 py-1 text-gray-400 hover:text-red-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity absolute right-0"
                                aria-label={`Delete ${exam.subject}`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                              </button>
                            </div>
                            
                            {isActiveTimer && !isCollapsed && timerContext.activeSessionId && timerContext.mode === 'session' && (
                              <div className="pl-7 pb-1.5 flex items-center gap-1.5 text-[11px] text-gray-400">
                                <svg className={`w-3 h-3 ${timerContext.isPaused ? 'text-amber-400' : 'text-green-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  {timerContext.isPaused ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                  )}
                                </svg>
                                <span className="font-mono">
                                  {formatTime(timerContext.timeLeft)}
                                </span>
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            )}
          </nav>
        </div>

        {/* Theme Toggle */}
        <div className={`mt-auto ${isCollapsed ? 'px-2 py-2' : 'px-3 py-3'}`}>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`flex items-center justify-center w-full rounded-md text-slate-300 hover:text-white hover:bg-white hover:bg-opacity-10 transition-colors ${
              isCollapsed ? 'p-1.5' : 'py-1.5 px-2.5 gap-2'
            }`}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {mounted && theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 opacity-80 flex-shrink-0" />
                {!isCollapsed && <span className="font-medium text-[13px]">Light Mode</span>}
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 opacity-80 flex-shrink-0" />
                {!isCollapsed && <span className="font-medium text-[13px]">Dark Mode</span>}
              </>
            )}
          </button>
        </div>
      </aside>


      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        preferences={userPreferences}
        onSaved={fetchPreferences}
      />
    </>
  );
};

export default Sidebar;
