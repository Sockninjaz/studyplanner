'use client';

import { useState } from 'react';
import { Check, X, Zap } from 'lucide-react';
import Link from 'next/link';

export default function UpgradePage() {
  const [isAnnual, setIsAnnual] = useState(true);

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
      
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
          Supercharge Your Study Sessions
        </h1>
        <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
          Choose the plan that fits your goals. Upgrade to Pro for unlimited AI interactions, advanced analytics, and custom exam generation.
        </p>
      </div>

      {/* Billing Toggle */}
      <div className="flex items-center justify-center gap-3 mb-12">
        <span className={`text-sm font-semibold ${!isAnnual ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>Monthly</span>
        <button 
          onClick={() => setIsAnnual(!isAnnual)}
          className="relative inline-flex h-7 w-14 items-center rounded-full bg-indigo-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${isAnnual ? 'translate-x-8' : 'translate-x-1'}`} />
        </button>
        <span className={`text-sm font-semibold flex items-center gap-1.5 ${isAnnual ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>
          Annually
          <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 text-xs font-bold">
            Save 20%
          </span>
        </span>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
        
        {/* Free Tier */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <div className="mb-8">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Basic</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm h-10">Essential tools to organize your study schedule.</p>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold text-slate-900 dark:text-white">$0</span>
              <span className="text-slate-500 font-medium">/ forever</span>
            </div>
          </div>
          
          <ul className="space-y-4 mb-8 flex-1">
            <li className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
              <Check size={20} className="text-emerald-500 flex-shrink-0" />
              <span>Up to 3 active exams</span>
            </li>
            <li className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
              <Check size={20} className="text-emerald-500 flex-shrink-0" />
              <span>Basic study timer (Pomodoro)</span>
            </li>
            <li className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
              <Check size={20} className="text-emerald-500 flex-shrink-0" />
              <span>Standard AI chat limits</span>
            </li>
            <li className="flex items-center gap-3 text-slate-400 dark:text-slate-600">
              <X size={20} className="flex-shrink-0" />
              <span>Advanced Analytics</span>
            </li>
            <li className="flex items-center gap-3 text-slate-400 dark:text-slate-600">
              <X size={20} className="flex-shrink-0" />
              <span>BYOK (Bring Your Own Key) for AI</span>
            </li>
          </ul>
          
          <Link href="/today" className="w-full py-3.5 px-4 rounded-xl font-bold text-center border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            Current Plan
          </Link>
        </div>

        {/* Pro Tier */}
        <div className="bg-gradient-to-b from-indigo-900 to-slate-900 dark:from-indigo-950 dark:to-slate-950 rounded-3xl p-1 relative shadow-2xl flex flex-col transform md:-translate-y-4">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-lg">
              <Zap size={14} className="fill-white" />
              Most Popular
            </span>
          </div>
          
          <div className="bg-white dark:bg-slate-900 rounded-[22px] p-8 h-full flex flex-col border border-indigo-100 dark:border-indigo-900/50 relative overflow-hidden">
            {/* Glow effect */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 dark:bg-indigo-500/20 blur-3xl rounded-full pointer-events-none"></div>

            <div className="mb-8 relative z-10">
              <h3 className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">Pro</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm h-10">Everything you need to ace your exams with AI.</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-slate-900 dark:text-white">
                  ${isAnnual ? '8' : '10'}
                </span>
                <span className="text-slate-500 font-medium">/ month</span>
              </div>
              {isAnnual && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">Billed $96 annually</p>
              )}
            </div>
            
            <ul className="space-y-4 mb-8 flex-1 relative z-10">
              <li className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                <Check size={20} className="text-indigo-500 flex-shrink-0" />
                <span className="font-semibold">Unlimited exams & sessions</span>
              </li>
              <li className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                <Check size={20} className="text-indigo-500 flex-shrink-0" />
                <span className="font-semibold">Unlimited AI Tutor interactions</span>
              </li>
              <li className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                <Check size={20} className="text-indigo-500 flex-shrink-0" />
                <span>Bring Your Own Key (OpenAI) support</span>
              </li>
              <li className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                <Check size={20} className="text-indigo-500 flex-shrink-0" />
                <span>Advanced progress analytics</span>
              </li>
              <li className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                <Check size={20} className="text-indigo-500 flex-shrink-0" />
                <span>Priority email support</span>
              </li>
            </ul>
            
            <button className="relative z-10 w-full py-3.5 px-4 rounded-xl font-bold text-center bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 dark:shadow-none">
              Upgrade to Pro
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
