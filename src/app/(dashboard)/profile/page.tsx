'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { LogOut, Star, ChevronRight, Save, User, Shield, Trash2, Bot, Settings as SettingsIcon, Sun, Moon, Palette } from 'lucide-react';

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

export default function ProfilePage() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [preferences, setPreferences] = useState<UserPreferences>({
    daily_study_limit: 4,
    soft_daily_limit: 2,
    adjustment_percentage: 25,
    session_duration: 30,
    enable_daily_limits: true,
  });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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

  useEffect(() => { 
    fetchPreferences(); 
    setMounted(true);
  }, []);

  const handleSavePreferences = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences)
      });
      if (res.ok) {
        localStorage.setItem('userPreferences', JSON.stringify(preferences));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
      window.dispatchEvent(new CustomEvent('preferencesUpdated', { detail: preferences }));
    }
  };

  const updatePref = (updates: Partial<UserPreferences>) => {
    setPreferences(prev => ({ ...prev, ...updates }));
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
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-slate-900 no-scrollbar pb-24 lg:pb-12">
      
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
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full text-sm font-medium transition-colors"
            >
              <LogOut size={16} />
              Log Out
            </button>
          </div>
        </div>
      </div>

      {/* Main Settings Container (Max Width for Desktop) */}
      <div className="px-4 space-y-6 max-w-3xl mx-auto">

        {/* --- PERSONAL INFORMATION --- */}
        {!loading && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg">
                  <User size={16} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <h2 className="font-bold text-slate-800 dark:text-white text-sm">Personal Information</h2>
              </div>
              <button
                onClick={handleSavePreferences}
                disabled={isSaving}
                className="text-xs font-semibold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Save size={14} />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Full Name</label>
                <input 
                  type="text" 
                  value={preferences.name || ''} 
                  onChange={e => updatePref({ name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#131B2F] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Email Address</label>
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
              <h2 className="font-bold text-slate-800 dark:text-white text-sm">Appearance</h2>
            </div>
            <div className="p-4 flex items-center justify-between gap-4">
              <div>
                <label className="font-semibold text-sm text-slate-900 dark:text-white block mb-0.5">Dark Mode</label>
                <p className="text-[11px] md:text-xs text-slate-500 dark:text-slate-400">Toggle between light and dark themes.</p>
              </div>
              <button 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm"
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
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
                <h2 className="font-bold text-slate-800 dark:text-white text-sm">Study Preferences</h2>
              </div>
              <button
                onClick={handleSavePreferences}
                disabled={isSaving}
                className="text-xs font-semibold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Save size={14} />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
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
              <button
                onClick={handleSavePreferences}
                disabled={isSaving}
                className="text-xs font-semibold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Save size={14} />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
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

        {/* Other Links (Visible on Mobile) */}
        <div className="lg:hidden bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden mt-4">
          <a
            href="/upgrade"
            className="w-full flex items-center gap-4 px-4 py-4 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors border-b border-gray-50 dark:border-slate-800"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
              <Star size={18} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-sm text-amber-700 dark:text-amber-400">Upgrade Plan</p>
              <p className="text-xs text-amber-600/70 dark:text-amber-500/60 mt-0.5">Unlock premium features</p>
            </div>
            <ChevronRight size={16} className="text-amber-300 dark:text-amber-700 flex-shrink-0" />
          </a>
          
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-4 px-4 py-4 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
              <LogOut size={18} className="text-red-500" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm text-red-600 dark:text-red-400">Log out</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Sign out of your account</p>
            </div>
          </button>
        </div>

      </div>
    </div>
  );
}
