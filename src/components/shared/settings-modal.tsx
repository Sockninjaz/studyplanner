import React, { useState, useEffect } from 'react';
import { User, Settings as SettingsIcon, Shield, Trash2, Save, LogOut, Bot } from 'lucide-react';

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

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: UserPreferences;
  onSaved: () => void;
}

type Tab = 'account' | 'preferences' | 'integrations';

export default function SettingsModal({ isOpen, onClose, preferences, onSaved }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('account');
  const [localPrefs, setLocalPrefs] = useState<UserPreferences>(preferences);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Password change state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [isUpdatingPwd, setIsUpdatingPwd] = useState(false);

  useEffect(() => {
    setLocalPrefs(preferences);
    setActiveTab('account');
    setIsChangingPassword(false);
    setPwdCurrent('');
    setPwdNew('');
    setPwdConfirm('');
    setPwdError('');
    setPwdSuccess('');
  }, [preferences, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localPrefs)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save preferences');
      
      onSaved();
      onClose();
    } catch (err: any) {
      alert(`Error saving preferences: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row h-[80vh] max-h-[800px] border border-slate-200 dark:border-slate-800">
        
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 bg-slate-50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800 flex flex-col">
          <div className="p-6 pb-2 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center md:block">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Settings</h2>
            <button onClick={onClose} className="md:hidden text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="p-4 space-y-2 flex-1">
            <button
              onClick={() => setActiveTab('account')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
                activeTab === 'account' 
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
            >
              <User size={18} />
              Account Profile
            </button>
            <button
              onClick={() => setActiveTab('preferences')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
                activeTab === 'preferences' 
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
            >
              <SettingsIcon size={18} />
              Study Preferences
            </button>
            <button
              onClick={() => setActiveTab('integrations')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
                activeTab === 'integrations' 
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
            >
              <Bot size={18} />
              AI Integrations
            </button>
          </div>
          
          <div className="p-4 mt-auto border-t border-slate-200 dark:border-slate-800 hidden md:block">
            <button 
              onClick={() => window.location.href = '/api/auth/signout'}
              className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-xl transition-all font-medium text-sm"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden relative bg-white dark:bg-[#0B1120]">
          
          {/* Header */}
          <div className="h-16 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 hidden md:flex">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {activeTab === 'account' ? 'Account Settings' : activeTab === 'preferences' ? 'Study Preferences' : 'AI Integrations'}
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors bg-slate-100 dark:bg-slate-800 p-2 rounded-full">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 md:p-8">
            <div className="max-w-2xl mx-auto space-y-8 pb-20">
              
              {activeTab === 'account' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {/* General Info Card */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm">
                    <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                      <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg">
                        <User size={20} className="text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900 dark:text-white">Personal Information</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Update your basic profile details.</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Full Name</label>
                        <input 
                          type="text" 
                          value={localPrefs.name || ''} 
                          onChange={e => setLocalPrefs({...localPrefs, name: e.target.value})}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#131B2F] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Email Address</label>
                        <input 
                          type="email" 
                          value={localPrefs.email || ''} 
                          onChange={e => setLocalPrefs({...localPrefs, email: e.target.value})}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#131B2F] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Security Card */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm">
                    <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                      <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg">
                        <Shield size={20} className="text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900 dark:text-white">Security</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Manage your password and security settings.</p>
                      </div>
                    </div>

                    {!isChangingPassword ? (
                      <div>
                        <button 
                          onClick={() => setIsChangingPassword(true)}
                          className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm"
                        >
                          Change Password
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4 max-w-md border border-slate-100 dark:border-slate-800 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Current Password</label>
                          <input 
                            type="password" 
                            value={pwdCurrent} 
                            onChange={e => setPwdCurrent(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white dark:bg-[#131B2F] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">New Password</label>
                          <input 
                            type="password" 
                            value={pwdNew} 
                            onChange={e => setPwdNew(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white dark:bg-[#131B2F] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                          />
                        </div>
                        <div className="space-y-2">
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
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
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

                  {/* Danger Zone */}
                  <div className="border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 rounded-2xl p-6 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h4 className="font-bold text-red-600 dark:text-red-400">Delete Account</h4>
                        <p className="text-sm text-red-500/80 dark:text-red-400/80 mt-1">Permanently remove your account and all associated data. This action cannot be reversed.</p>
                      </div>
                      <button 
                        onClick={handleDeleteAccount}
                        disabled={isDeleting}
                        className="px-5 py-2.5 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 font-semibold rounded-xl hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors whitespace-nowrap shadow-sm text-sm flex items-center gap-2 justify-center"
                      >
                        <Trash2 size={16} />
                        {isDeleting ? 'Deleting...' : 'Delete Account'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'preferences' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                    <div className="space-y-8">
                      {/* Toggle Limit */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
                        <div>
                          <label className="font-semibold text-slate-900 dark:text-white block mb-1">Enable Strict Daily Limits</label>
                          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">If disabled, the AI will try to fit study hours even if it exceeds your limit (capped at 2h/day for exams far out).</p>
                        </div>
                        <button 
                          onClick={() => setLocalPrefs({...localPrefs, enable_daily_limits: !localPrefs.enable_daily_limits})}
                          className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${localPrefs.enable_daily_limits ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                        >
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${localPrefs.enable_daily_limits ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>

                      {/* Daily Limit */}
                      <div className="pb-6 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-end mb-4">
                          <div>
                            <label className="font-semibold text-slate-900 dark:text-white block mb-1">Daily Study Limit</label>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Absolute maximum hours per day.</p>
                          </div>
                          <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 font-mono">{localPrefs.daily_study_limit}h</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="12"
                          step="1"
                          value={localPrefs.daily_study_limit}
                          onChange={(e) => setLocalPrefs({...localPrefs, daily_study_limit: Number(e.target.value)})}
                          className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer dark:bg-slate-800 accent-indigo-600"
                        />
                        <div className="flex justify-between text-xs text-slate-400 mt-2 font-medium">
                          <span>1 hr</span>
                          <span>12 hrs</span>
                        </div>
                      </div>

                      {/* Target Limit */}
                      <div>
                        <div className="flex justify-between items-end mb-4">
                          <div>
                            <label className="font-semibold text-slate-900 dark:text-white block mb-1">Preferred Study Time</label>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Target hours before expanding timeline.</p>
                          </div>
                          <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 font-mono">{localPrefs.soft_daily_limit}h</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="12"
                          step="1"
                          value={localPrefs.soft_daily_limit}
                          onChange={(e) => setLocalPrefs({...localPrefs, soft_daily_limit: Number(e.target.value)})}
                          className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer dark:bg-slate-800 accent-indigo-600"
                        />
                        <div className="flex justify-between text-xs text-slate-400 mt-2 font-medium">
                          <span>1 hr</span>
                          <span>12 hrs</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'integrations' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
                      <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg">
                        <Bot size={20} className="text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900 dark:text-white">Bring Your Own Key (BYOK)</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Use your own OpenAI API key for chatbot integrations.</p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">OpenAI API Key</label>
                      <input 
                        type="password" 
                        placeholder="sk-..."
                        value={localPrefs.openai_api_key || ''} 
                        onChange={e => setLocalPrefs({...localPrefs, openai_api_key: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#131B2F] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-mono placeholder:font-sans placeholder:text-slate-400"
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-2">
                        Your key is stored securely. If provided, the chatbot will use this key instead of the system default. Leave blank to use the default system key.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-white/80 dark:bg-[#0B1120]/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 flex items-center gap-2 text-sm"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
