'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Settings, ChevronDown, LogOut, Star, Sidebar as SidebarIcon, SidebarClose, Share2 } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useTimer } from '../session/timer-context';
import ShareModal from '../share/share-modal';
import { prefetchCalendarEvents } from '@/hooks/use-calendar-data';
import { useLanguage } from '@/lib/i18n/LanguageContext';

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
  const { t, locale } = useLanguage();
  const timerContext = useTimer();
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const navItems = [
    {
      href: '/today',
      label: t('nav.studyHub'),
      icon: (
        <svg width="16" height="16" className="w-4 h-4 opacity-80 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      href: '/calendar',
      label: t('nav.schedule'),
      icon: (
        <svg width="16" height="16" className="w-4 h-4 opacity-80 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    },
    {
      href: '/chat',
      label: t('nav.chat'),
      icon: (
        <svg width="16" height="16" className="w-4 h-4 opacity-80 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      ),
    },
    {
      href: '/exams',
      label: t('nav.exams'),
      icon: (
        <svg width="16" height="16" className="w-4 h-4 opacity-80 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
        </svg>
      ),
    },
  ];

  const [exams, setExams] = useState<Exam[]>([]);
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  
  const [loading, setLoading] = useState(true);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({
    daily_study_limit: 4,
    soft_daily_limit: 2,
    adjustment_percentage: 25,
    session_duration: 30,
    enable_daily_limits: true,
  });
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [examToDelete, setExamToDelete] = useState<{ id: string; subject: string } | null>(null);
  const [isDeletingExam, setIsDeletingExam] = useState(false);

  useEffect(() => {
    if (!examToDelete) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeletingExam) {
        setExamToDelete(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [examToDelete, isDeletingExam]);

  useEffect(() => {
    setMounted(true);
    try {
      const cached = localStorage.getItem('cached_sidebar_exams_v1');
      if (cached) {
        setExams(JSON.parse(cached));
        setLoading(false);
      }
    } catch {}
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
        const examsList = data.data || [];
        setExams(examsList);
        try {
          localStorage.setItem('cached_sidebar_exams_v1', JSON.stringify(examsList));
        } catch {}
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

  const handleConfirmDeleteExam = async () => {
    if (!examToDelete || isDeletingExam) return;
    setIsDeletingExam(true);
    try {
      const res = await fetch(`/api/exams/${examToDelete.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete exam');
      }

      // Refresh the exam list
      fetchExams();

      // Dispatch a custom event to notify other components like the calendar
      window.dispatchEvent(new CustomEvent('examDeleted', { detail: { examId: examToDelete.id } }));

      // If user is currently viewing this exam, redirect to /exams
      if (typeof window !== 'undefined' && window.location.pathname.includes(`/exams/${examToDelete.id}`)) {
        router.push('/exams');
      }

      setExamToDelete(null);
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to delete exam'}`);
    } finally {
      setIsDeletingExam(false);
    }
  };

  return (
    <>
      <aside
        className={`absolute left-0 top-0 z-20 flex h-screen overflow-y-hidden text-slate-800 dark:text-zinc-100 duration-300 ease-linear xl:static xl:translate-x-0 ${isCollapsed ? 'w-16' : 'w-48'} flex-col bg-[#F9F8F3] dark:bg-[#1e293b] border-r border-[#EAE7DC] dark:border-slate-700/80 shadow-sm`}
      >
        <div className={`flex items-center justify-between relative ${isCollapsed ? 'px-2 pt-2.5 pb-2 flex-col gap-1 items-center' : 'pl-2 pr-3 py-3 gap-1'}`}>
          {!isCollapsed ? (
            <div className="relative flex-1 min-w-0">
              <Link 
                href="/profile"
                className="w-full flex items-center py-1.5 px-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {session?.user?.image ? (
                    <img src={session.user.image} alt="Profile" className="w-6 h-6 rounded-full flex-shrink-0" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white dark:text-slate-900 text-xs font-bold flex-shrink-0">
                      {session?.user?.name?.charAt(0) || 'U'}
                    </div>
                  )}
                  <span className="text-[13px] font-semibold truncate flex-shrink min-w-0 text-slate-800 dark:text-white">{session?.user?.name || 'User'}</span>
                </div>
              </Link>
            </div>
          ) : (
            <div className="mx-auto">
              <Link 
                href="/profile" 
                title="Profile" 
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                {session?.user?.image ? (
                  <img src={session.user.image} alt="Profile" className="w-6 h-6 rounded-full" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white dark:text-slate-900 text-xs font-bold">
                    {session?.user?.name?.charAt(0) || 'U'}
                  </div>
                )}
              </Link>
            </div>
          )}

          {/* Toggle Button */}
          {onToggle && (
            <div className={`flex flex-shrink-0 ${isCollapsed ? 'w-full justify-center' : ''}`}>
              <button
                onClick={onToggle}
                className={`text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-white rounded-lg transition-colors focus:outline-none ${
                  isCollapsed ? 'w-8 h-8 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5' : 'p-1'
                }`}
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <SidebarIcon size={18} strokeWidth={2} className="opacity-80" />
              </button>
            </div>
          )}
        </div>

        <div className="no-scrollbar flex flex-col overflow-y-auto duration-300 ease-linear">
          <nav className={`py-1 ${isCollapsed ? 'px-2' : 'px-2'} xl:px-3`}>
            <ul className="mb-4 flex flex-col gap-0.5">
              {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <li key={item.href} className={isCollapsed ? 'flex justify-center' : ''}>
                    <Link
                      href={item.href}
                      onMouseEnter={() => {
                        if (item.href === '/calendar') {
                          prefetchCalendarEvents();
                        }
                      }}
                      title={isCollapsed ? item.label : undefined}
                      className={`group relative flex items-center rounded-md font-medium text-[13px] duration-200 ease-in-out ${
                        isCollapsed
                          ? 'w-8 h-8 justify-center p-0'
                          : 'w-full gap-2.5 py-1.5 px-2.5'
                      } ${
                        isActive
                          ? 'bg-[#ECE8DF] text-slate-900 dark:bg-white/10 dark:text-white font-semibold'
                          : 'text-slate-600 hover:bg-black/5 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white'
                      }`}
                    >
                      {item.icon}
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {!isCollapsed && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5 px-2.5 group/header cursor-pointer">
                  <h3 className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 dark:text-zinc-500">
                    {locale === 'nl' ? 'Mijn Toetsen' : 'My Exams'}
                  </h3>
                  <button
                    onClick={openCreateModal}
                    className="bg-indigo-600 text-white dark:text-zinc-900 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 p-1 rounded-full transition-colors flex items-center justify-center shadow-sm"
                    title={t('calendar.addExam')}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
                <ul suppressHydrationWarning className="mb-4 flex flex-col gap-0.5">
                  {loading ? (
                    <li className="px-2.5 py-2 text-xs text-slate-400 dark:text-zinc-500">{t('common.loading')}</li>
                  ) : exams.length === 0 ? (
                    <li className="px-4 py-3 text-sm text-slate-400 dark:text-zinc-500">{locale === 'nl' ? 'Geen toetsen gepland' : 'No exams scheduled'}</li>
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
                          <div className="w-full flex flex-col items-start rounded-md font-medium text-slate-700 dark:text-zinc-200 duration-200 ease-in-out hover:bg-black/5 dark:hover:bg-white/10 group">
                            <div className="w-full relative flex items-center">
                              <Link
                                href={`/exams/${exam._id}`}
                                className="flex-1 flex items-center gap-2.5 py-1.5 pl-2.5 pr-8 text-left min-w-0 overflow-hidden"
                              >
                                <div
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: examColor }}
                                />
                                <span className={`text-[13px] truncate min-w-0 text-slate-700 dark:text-zinc-200 ${exam.isCompleted ? 'line-through text-slate-400 dark:text-zinc-500' : ''}`} title={exam.subject}>
                                  {exam.subject}
                                </span>
                              </Link>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setExamToDelete({ id: exam._id, subject: exam.subject });
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                }}
                                className="px-2 py-1 text-slate-400 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity absolute right-1 z-10"
                                aria-label={`Delete ${exam.subject}`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                              </button>
                            </div>
                            
                            {isActiveTimer && !isCollapsed && timerContext.activeSessionId && timerContext.mode === 'session' && (
                              <div className="pl-7 pb-1.5 flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-zinc-500">
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

        {/* Share with Parents Button */}
        <div className={`mt-auto ${isCollapsed ? 'px-2 pt-2' : 'px-3 pt-2'}`}>
          <button
            onClick={() => setIsShareModalOpen(true)}
            className={`flex items-center justify-center rounded-md text-[#406a38] dark:text-[#9EC29A] hover:bg-[#9EC29A]/15 transition-colors ${
              isCollapsed ? 'w-8 h-8 mx-auto p-0' : 'w-full py-1.5 px-2.5 gap-2'
            }`}
            title={t('nav.shareSchedule')}
          >
            <Share2 className="w-4 h-4 opacity-90 flex-shrink-0" />
            {!isCollapsed && <span className="font-semibold text-[13px]">{t('nav.shareSchedule')}</span>}
          </button>
        </div>

        {/* Theme Toggle */}
        <div className={isCollapsed ? 'px-2 py-2' : 'px-3 py-2'}>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`flex items-center justify-center rounded-md text-slate-600 hover:text-slate-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/10 transition-colors ${
              isCollapsed ? 'w-8 h-8 mx-auto p-0' : 'w-full py-1.5 px-2.5 gap-2'
            }`}
            title={theme === 'dark' ? t('nav.switchToLight') : t('nav.switchToDark')}
          >
            {mounted && theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 opacity-80 flex-shrink-0" />
                {!isCollapsed && <span className="font-medium text-[13px]">{t('nav.lightMode')}</span>}
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 opacity-80 flex-shrink-0" />
                {!isCollapsed && <span className="font-medium text-[13px]">{t('nav.darkMode')}</span>}
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Share with Parents Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />

      {/* Delete Exam Confirmation Modal */}
      {examToDelete && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeletingExam) {
              setExamToDelete(null);
            }
          }}
        >
          <div 
            className="relative z-10 w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4 text-red-600 dark:text-red-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1.5">{t('exams.deleteExamTitle')}</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-5 leading-relaxed">
              {t('exams.deleteExamConfirm', { subject: examToDelete.subject })}
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setExamToDelete(null)}
                disabled={isDeletingExam}
                className="flex-1 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteExam}
                disabled={isDeletingExam}
                className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeletingExam ? (
                  <>
                    <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    {t('common.deleting')}
                  </>
                ) : t('exams.deleteExamBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
