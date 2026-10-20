'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { LogOut, Star, ChevronRight, User, Shield, Trash2, Bot, Settings as SettingsIcon, Sun, Moon, Palette, Compass, Check, Loader2, BookOpen, Plus, Edit2, X, Languages } from 'lucide-react';
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

const COMMON_TEXTBOOK_SUGGESTIONS = [
  'Pulsar Natuurkunde',
  'Systematische Natuurkunde',
  'Nova Natuurkunde',
  'Overal Natuurkunde',
  'Stevin Natuurkunde',
  'Chemie Overal',
  'Nova Scheikunde',
  'Chemie (Malmberg)',
  'Biologie voor Jou (BVJ)',
  'Nectar Biologie',
  '10voorBiologie',
  'Getal & Ruimte',
  'Moderne Wiskunde',
  'Feniks Geschiedenis',
  'Geschiedenis Werkplaats',
  'Memo Geschiedenis',
  'Campbell Biology',
  'Polaris',
];

export default function ProfilePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useLanguage();
  const [mounted, setMounted] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut({ redirect: false });
    } catch (e) {
      console.error('Logout error:', e);
    }
    // Always redirect relative to the current window location to prevent unreachable host errors
    window.location.href = '/login';
  };

  const handleRestartOnboarding = () => {
    localStorage.removeItem('studyplanner_profile');
    localStorage.removeItem('studyplanner_onboarding');
    router.push('/onboarding');
  };

  const [preferences, setPreferences] = useState<UserPreferences>({
    daily_study_limit: 4,
    soft_daily_limit: 2,
    adjustment_percentage: 25,
    session_duration: 30,
    enable_daily_limits: true,
  });
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const savedTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Textbooks state
  const [textbooks, setTextbooks] = useState<Array<{ subject: string; textbook: string }>>([]);
  const [loadingTextbooks, setLoadingTextbooks] = useState(true);
  const [isAddingTextbook, setIsAddingTextbook] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newTextbook, setNewTextbook] = useState('');
  const [editingSubject, setEditingSubject] = useState<string | null>(null);
  const [editingTextbook, setEditingTextbook] = useState('');
  const [textbookActionLoading, setTextbookActionLoading] = useState(false);

  // Password state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [isUpdatingPwd, setIsUpdatingPwd] = useState(false);
  
  // Delete state
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchPreferences = async () => {
    try {
      const res = await fetch('/api/user/preferences');
      if (res.ok) setPreferences(await res.json());
    } catch {} finally {
      setLoading(false);
    }
  };

  const fetchTextbooks = async () => {
    try {
      const res = await fetch('/api/user/textbooks');
      if (res.ok) {
        const data = await res.json();
        setTextbooks(data.textbooks || []);
      }
    } catch (err) {
      console.error('Failed to load textbooks:', err);
    } finally {
      setLoadingTextbooks(false);
    }
  };

  const handleSaveTextbook = async (subj: string, tb: string) => {
    if (!subj.trim() || !tb.trim()) return;
    setTextbookActionLoading(true);
    try {
      const res = await fetch('/api/user/textbooks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subj.trim(), textbook: tb.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        setTextbooks(data.textbooks || []);
        setIsAddingTextbook(false);
        setNewSubject('');
        setNewTextbook('');
        setEditingSubject(null);
        setEditingTextbook('');
      }
    } catch (err) {
      console.error('Failed to save textbook:', err);
    } finally {
      setTextbookActionLoading(false);
    }
  };

  const handleDeleteTextbook = async (subj: string) => {
    setTextbookActionLoading(true);
    try {
      const res = await fetch(`/api/user/textbooks?subject=${encodeURIComponent(subj)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const data = await res.json();
        setTextbooks(data.textbooks || []);
      }
    } catch (err) {
      console.error('Failed to delete textbook:', err);
    } finally {
      setTextbookActionLoading(false);
    }
  };

  useEffect(() => { 
    fetchPreferences(); 
    fetchTextbooks();
    setMounted(true);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  const savePreferencesToServer = async (prefsToSave: UserPreferences) => {
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefsToSave)
      });
      if (res.ok) {
        localStorage.setItem('userPreferences', JSON.stringify(prefsToSave));
        setSaveStatus('saved');
        if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
        savedTimeoutRef.current = setTimeout(() => {
          setSaveStatus('idle');
        }, 2500);
      } else {
        setSaveStatus('idle');
      }
    } catch (e) {
      console.error(e);
      setSaveStatus('idle');
    } finally {
      window.dispatchEvent(new CustomEvent('preferencesUpdated', { detail: prefsToSave }));
    }
  };

  const updatePref = (updates: Partial<UserPreferences>) => {
    setPreferences(prev => {
      const next = { ...prev, ...updates };
      setSaveStatus('saving');
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        savePreferencesToServer(next);
      }, 500);
      return next;
    });
  };

  const renderSaveStatus = () => {
    if (saveStatus === 'saving') {
      return (
        <span className="text-xs font-medium text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse">
          <Loader2 size={13} className="animate-spin text-indigo-500" />
          Saving...
        </span>
      );
    }
    if (saveStatus === 'saved') {
      return (
        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 py-1 px-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 transition-all duration-200">
          <Check size={13} className="stroke-[2.5]" />
          Saved
        </span>
      );
    }
    return null;
  };

  const handleUpdatePassword = async () => {
    setPwdError('');
    setPwdSuccess('');
    
    if (pwdNew !== pwdConfirm) {
      setPwdError('New passwords do not match');
      return;
    }

    setIsUpdatingPwd(true);
    try {
      const res = await fetch('/api/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: pwdCurrent,
          newPassword: pwdNew
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update password');
      
      setPwdSuccess('Password updated successfully');
      setPwdCurrent('');
      setPwdNew('');
      setPwdConfirm('');
      setTimeout(() => setIsChangingPassword(false), 2000);
    } catch (err: any) {
      setPwdError(err.message);
    } finally {
      setIsUpdatingPwd(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you absolutely sure you want to delete your account? This action cannot be undone and all your data will be lost.')) {
      return;
    }
    
    setIsDeleting(true);
    try {
      const res = await fetch('/api/user/preferences', {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete account');
      window.location.href = '/login';
    } catch (err: any) {
      alert(`Error deleting account: ${err.message}`);
      setIsDeleting(false);
    }
  };

  const initials = session?.user?.name?.charAt(0)?.toUpperCase() || 'U';

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-slate-900 no-scrollbar pb-24 xl:pb-12">
      
      {/* Hero header - full width but centers content */}
      <div className="px-5 pt-8 pb-6">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-3">
          {session?.user?.image ? (
            <img
              src={session.user.image}
              alt="Profile"
              className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-white dark:border-slate-800 shadow-md"
            />
          ) : (
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-indigo-500 border-4 border-white dark:border-slate-800 shadow-md flex items-center justify-center text-white text-3xl md:text-4xl font-bold">
              {initials}
            </div>
          )}
          <div className="text-center">
            <h1 className="text-slate-900 dark:text-white text-xl md:text-2xl font-bold">{session?.user?.name || 'User'}</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base mb-3">{session?.user?.email}</p>
            <div className="flex items-center justify-center gap-2.5 flex-wrap">
              <button
                onClick={handleRestartOnboarding}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-semibold transition-colors cursor-pointer border border-indigo-200/60 dark:border-indigo-800/60"
              >
                <Compass size={14} />
                {locale === 'nl' ? 'Onboarding opnieuw starten' : 'Restart Onboarding'}
              </button>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full text-xs font-semibold transition-colors cursor-pointer"
              >
                <LogOut size={14} />
                {locale === 'nl' ? 'Uitloggen' : 'Log Out'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Settings Container (Max Width for Desktop) */}
      <div className="px-4 space-y-6 max-w-3xl mx-auto">

        {/* --- LANGUAGE / TAAL --- */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg">
              <Languages size={16} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="font-bold text-slate-800 dark:text-white text-sm">
              {locale === 'nl' ? 'Taal / Language' : 'Language'}
            </h2>
          </div>
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <label className="font-semibold text-sm text-slate-900 dark:text-white block mb-0.5">
                {locale === 'nl' ? 'Taal van de app' : 'App Language'}
              </label>
              <p className="text-[11px] md:text-xs text-slate-500 dark:text-slate-400">
                {locale === 'nl' 
                  ? 'Kies tussen Nederlands en Engels. Automatisch gedetecteerd voor Nederland.' 
                  : 'Choose between English and Dutch. Auto-detected for the Netherlands.'}
              </p>
            </div>
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setLocale('nl')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  locale === 'nl'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Nederlands
              </button>
              <button
                type="button"
                onClick={() => setLocale('en')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  locale === 'en'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                English
              </button>
            </div>
          </div>
        </div>

        {/* --- PERSONAL INFORMATION --- */}
        {!loading && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg">
                  <User size={16} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <h2 className="font-bold text-slate-800 dark:text-white text-sm">{locale === 'nl' ? 'Persoonlijke Gegevens' : 'Personal Information'}</h2>
              </div>
              {renderSaveStatus()}
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{locale === 'nl' ? 'Volledige Naam' : 'Full Name'}</label>
                <input 
                  type="text" 
                  value={preferences.name || ''} 
                  onChange={e => updatePref({ name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#131B2F] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{locale === 'nl' ? 'E-mailadres' : 'Email Address'}</label>
                <input 
                  type="email" 
                  value={preferences.email || ''} 
                  onChange={e => updatePref({ email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#131B2F] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* --- APPEARANCE --- */}
        {mounted && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 flex items-center gap-2">
              <div className="p-1.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg">
                <Palette size={16} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="font-bold text-slate-800 dark:text-white text-sm">{locale === 'nl' ? 'Weergave' : 'Appearance'}</h2>
            </div>
            <div className="p-4 flex items-center justify-between gap-4">
              <div>
                <label className="font-semibold text-sm text-slate-900 dark:text-white block mb-0.5">{locale === 'nl' ? 'Donkere Modus' : 'Dark Mode'}</label>
                <p className="text-[11px] md:text-xs text-slate-500 dark:text-slate-400">{locale === 'nl' ? 'Wissel tussen lichte en donkere modus.' : 'Toggle between light and dark themes.'}</p>
              </div>
              <button 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm"
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                {theme === 'dark' ? (locale === 'nl' ? 'Lichte Modus' : 'Light Mode') : (locale === 'nl' ? 'Donkere Modus' : 'Dark Mode')}
              </button>
            </div>
          </div>
        )}

        {/* --- STUDY PREFERENCES --- */}
        {!loading && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg">
                  <SettingsIcon size={16} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <h2 className="font-bold text-slate-800 dark:text-white text-sm">{locale === 'nl' ? 'Studie Voorkeuren' : 'Study Preferences'}</h2>
              </div>
              {renderSaveStatus()}
            </div>
            
            <div className="p-4 space-y-6">
              {/* Daily limits toggle */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-50 dark:border-slate-800">
                <div>
                  <label className="font-semibold text-sm text-slate-900 dark:text-white block mb-0.5">Strict Daily Limits</label>
                  <p className="text-[11px] md:text-xs text-slate-500 dark:text-slate-400 max-w-sm">If disabled, the AI will schedule study hours even if it exceeds your limit.</p>
                </div>
                <button 
                  onClick={() => updatePref({ enable_daily_limits: !preferences.enable_daily_limits })}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${preferences.enable_daily_limits ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${preferences.enable_daily_limits ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {/* Sliders Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Daily Limit Slider */}
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="font-semibold text-sm text-slate-900 dark:text-white block">Max Daily Study Limit</label>
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{preferences.daily_study_limit}h</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="12"
                    step="1"
                    value={preferences.daily_study_limit}
                    onChange={(e) => updatePref({ daily_study_limit: Number(e.target.value) })}
                    className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer dark:bg-slate-800 accent-indigo-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1.5 font-medium">
                    <span>1 hr</span>
                    <span>12 hrs</span>
                  </div>
                </div>

                {/* Soft Limit Slider */}
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="font-semibold text-sm text-slate-900 dark:text-white block">Preferred Target Time</label>
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{preferences.soft_daily_limit}h</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="12"
                    step="1"
                    value={preferences.soft_daily_limit}
                    onChange={(e) => updatePref({ soft_daily_limit: Number(e.target.value) })}
                    className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer dark:bg-slate-800 accent-indigo-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1.5 font-medium">
                    <span>1 hr</span>
                    <span>12 hrs</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- AI INTEGRATIONS --- */}
        {!loading && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg">
                  <Bot size={16} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <h2 className="font-bold text-slate-800 dark:text-white text-sm">AI Integrations</h2>
              </div>
              {renderSaveStatus()}
            </div>
            <div className="p-4 space-y-3">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">OpenAI API Key (BYOK)</label>
              <input 
                type="password" 
                placeholder="sk-..."
                value={preferences.openai_api_key || ''} 
                onChange={e => updatePref({ openai_api_key: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#131B2F] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-mono placeholder:font-sans placeholder:text-slate-400"
              />
              <p className="text-[11px] md:text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Your key is stored securely. If provided, the chatbot will use this key instead of the system default. Leave blank to use the default system key.
              </p>
            </div>
          </div>
        )}

        {/* --- MY TEXTBOOKS (SAVED PER SUBJECT) --- */}
        {!loading && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg">
                  <BookOpen size={16} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800 dark:text-white text-sm">My Textbooks / Boeken per Vak</h2>
                </div>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full">
                {textbooks.length} {textbooks.length === 1 ? 'book' : 'books'}
              </span>
            </div>

            <div className="p-4 space-y-4">
              <p className="text-[11px] md:text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                When you upload a PTA or syllabus that only lists topic names, the AI maps the topics to your chosen textbook for that subject. Textbooks you type during exam creation are also automatically saved here.
              </p>

              {loadingTextbooks ? (
                <div className="flex items-center justify-center py-6 text-slate-400 gap-2 text-xs">
                  <Loader2 size={16} className="animate-spin text-indigo-500" />
                  <span>Loading your textbooks...</span>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {textbooks.length === 0 && !isAddingTextbook && (
                    <div className="text-center py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl px-4">
                      <BookOpen size={24} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400">No textbooks saved yet</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        Whenever you enter a textbook during exam creation, it will be automatically remembered here.
                      </p>
                    </div>
                  )}

                  {textbooks.map((item, idx) => (
                    <div 
                      key={idx}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 gap-3"
                    >
                      {editingSubject === item.subject ? (
                        <div className="flex-1 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                          <span className="font-semibold text-xs text-slate-700 dark:text-slate-200 shrink-0 min-w-[120px]">
                            {item.subject}
                          </span>
                          <input 
                            type="text"
                            list="profile-textbook-suggestions"
                            value={editingTextbook}
                            onChange={(e) => setEditingTextbook(e.target.value)}
                            className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="e.g. Pulsar 3e editie"
                          />
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleSaveTextbook(item.subject, editingTextbook)}
                              disabled={textbookActionLoading}
                              className="px-2.5 py-1.5 bg-indigo-600 text-white dark:text-slate-900 rounded-lg text-xs font-semibold hover:bg-indigo-700 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <Check size={12} /> Save
                            </button>
                            <button
                              onClick={() => setEditingSubject(null)}
                              className="px-2 py-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg text-xs cursor-pointer"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2.5">
                            <span className="px-2.5 py-1 bg-indigo-100/70 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold rounded-lg text-xs">
                              {item.subject}
                            </span>
                            <span className="font-medium text-xs text-slate-800 dark:text-slate-200">
                              {item.textbook}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 self-end sm:self-auto">
                            <button
                              onClick={() => {
                                setEditingSubject(item.subject);
                                setEditingTextbook(item.textbook);
                              }}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                              title="Edit textbook"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteTextbook(item.subject)}
                              disabled={textbookActionLoading}
                              className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer disabled:opacity-50"
                              title="Remove textbook"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                  {/* Add New Textbook Form */}
                  {isAddingTextbook ? (
                    <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Subject / Vak
                          </label>
                          <input 
                            type="text"
                            value={newSubject}
                            onChange={(e) => setNewSubject(e.target.value)}
                            placeholder="e.g. Natuurkunde, Biologie..."
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Textbook / Methode
                          </label>
                          <input 
                            type="text"
                            list="profile-textbook-suggestions"
                            value={newTextbook}
                            onChange={(e) => setNewTextbook(e.target.value)}
                            placeholder="e.g. Pulsar 3e editie, Nova..."
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                      <datalist id="profile-textbook-suggestions">
                        {COMMON_TEXTBOOK_SUGGESTIONS.map((tb, idx) => (
                          <option key={idx} value={tb} />
                        ))}
                      </datalist>
                      <div className="flex items-center gap-2 justify-end pt-1">
                        <button
                          onClick={() => setIsAddingTextbook(false)}
                          className="px-3 py-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveTextbook(newSubject, newTextbook)}
                          disabled={textbookActionLoading || !newSubject.trim() || !newTextbook.trim()}
                          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white dark:text-slate-900 text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <Check size={13} />
                          <span>Save Textbook</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsAddingTextbook(true)}
                      className="w-full py-2.5 px-3 border border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-xl text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus size={14} />
                      <span>Add Subject Textbook</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- SECURITY --- */}
        {!loading && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 flex items-center gap-2">
              <div className="p-1.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg">
                <Shield size={16} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="font-bold text-slate-800 dark:text-white text-sm">Security</h2>
            </div>
            <div className="p-4">
              {!isChangingPassword ? (
                <button 
                  onClick={() => setIsChangingPassword(true)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm"
                >
                  Change Password
                </button>
              ) : (
                <div className="space-y-4 max-w-md border border-slate-100 dark:border-slate-800 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Current Password</label>
                    <input 
                      type="password" 
                      value={pwdCurrent} 
                      onChange={e => setPwdCurrent(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white dark:bg-[#131B2F] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">New Password</label>
                    <input 
                      type="password" 
                      value={pwdNew} 
                      onChange={e => setPwdNew(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white dark:bg-[#131B2F] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Confirm New Password</label>
                    <input 
                      type="password" 
                      value={pwdConfirm} 
                      onChange={e => setPwdConfirm(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white dark:bg-[#131B2F] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                    />
                  </div>
                  
                  {pwdError && <p className="text-xs font-semibold text-red-500">{pwdError}</p>}
                  {pwdSuccess && <p className="text-xs font-semibold text-emerald-500">{pwdSuccess}</p>}
                  
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={handleUpdatePassword}
                      disabled={isUpdatingPwd || !pwdCurrent || !pwdNew || !pwdConfirm}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white dark:text-slate-900 font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                      {isUpdatingPwd ? 'Updating...' : 'Update Password'}
                    </button>
                    <button
                      onClick={() => setIsChangingPassword(false)}
                      className="px-4 py-2 bg-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-semibold rounded-lg text-sm transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- DANGER ZONE --- */}
        {!loading && (
          <div className="border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-red-600 dark:text-red-400 text-sm md:text-base">Delete Account</h4>
              <p className="text-[11px] md:text-xs text-red-500/80 dark:text-red-400/80 mt-0.5">Permanently remove your account and all associated data.</p>
            </div>
            <button 
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="px-4 py-2 md:py-2.5 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 font-semibold rounded-xl hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors whitespace-nowrap shadow-sm text-sm flex items-center gap-2 justify-center w-full md:w-auto"
            >
              <Trash2 size={16} />
              {isDeleting ? 'Deleting...' : 'Delete Account'}
            </button>
          </div>
        )}

        {/* Other Links (Visible on Mobile / iPad) */}
        <div className="xl:hidden bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden mt-4">
          <a
            href="/upgrade"
            className="w-full flex items-center gap-4 px-4 py-4 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors border-b border-gray-50 dark:border-slate-800"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
              <Star size={18} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-sm text-amber-700 dark:text-amber-400">{locale === 'nl' ? 'Abonnement upgraden' : 'Upgrade Plan'}</p>
              <p className="text-xs text-amber-600/70 dark:text-amber-500/60 mt-0.5">{locale === 'nl' ? 'Ontgrendel alle premium functies' : 'Unlock premium features'}</p>
            </div>
            <ChevronRight size={16} className="text-amber-300 dark:text-amber-700 flex-shrink-0" />
          </a>
          
          <button
            onClick={handleRestartOnboarding}
            className="w-full flex items-center gap-4 px-4 py-4 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-colors border-b border-gray-50 dark:border-slate-800 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
              <Compass size={18} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-sm text-indigo-700 dark:text-indigo-300">{locale === 'nl' ? 'Onboarding opnieuw starten' : 'Restart Onboarding'}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{locale === 'nl' ? 'Land, niveau en leerjaar aanpassen' : 'Reconfigure country, track, and year'}</p>
            </div>
            <ChevronRight size={16} className="text-slate-300 dark:text-slate-700 flex-shrink-0" />
          </button>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-4 py-4 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
              <LogOut size={18} className="text-red-500" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm text-red-600 dark:text-red-400">{locale === 'nl' ? 'Uitloggen' : 'Log out'}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{locale === 'nl' ? 'Afmelden bij je account' : 'Sign out of your account'}</p>
            </div>
          </button>
        </div>

      </div>
    </div>
  );
}
