'use client';

import React, { useState, useEffect } from 'react';
import { 
  Play, Pause, RotateCcw, CheckCircle2, Circle, Sparkles, 
  Calendar, Brain, BookOpen, Clock, ShieldCheck, Flame, 
  ChevronRight, ArrowRight, Check, FileText, UploadCloud
} from 'lucide-react';

export default function HeroShowcase() {
  const [activeTab, setActiveTab] = useState<'hub' | 'schedule' | 'coach' | 'syllabus'>('hub');

  // Interactive Timer state for Hub tab
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (timerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerRunning]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Interactive Tasks state
  const [tasks, setTasks] = useState([
    { id: 1, text: 'Read textbook chapter: Oxidative Phosphorylation & ATP Synthase', done: true },
    { id: 2, text: 'Draw Krebs cycle electron shuttle flow diagrams', done: false },
    { id: 3, text: 'Practice 4 high-yield exam calculation questions', done: false },
  ]);

  const toggleTask = (id: number) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  const completedCount = tasks.filter((t) => t.done).length;

  // Interactive Quiz state for Coach tab
  const [selectedQuizOption, setSelectedQuizOption] = useState<number | null>(null);

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Tab Switcher */}
      <div className="flex items-center justify-center mb-6">
        <div className="inline-flex p-1.5 rounded-2xl bg-slate-200/70 dark:bg-slate-900/80 border border-slate-300/70 dark:border-slate-800 backdrop-blur-md shadow-inner gap-1 max-w-full overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('hub')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === 'hub'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4 text-[#9EC29A]" />
            <span>Daily Study Hub</span>
          </button>

          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === 'schedule'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4 text-emerald-500" />
            <span>Smart Waterfill Schedule</span>
          </button>

          <button
            onClick={() => setActiveTab('coach')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === 'coach'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Brain className="w-4 h-4 text-[#42bfdd]" />
            <span>Contextual AI Tutor</span>
          </button>

          <button
            onClick={() => setActiveTab('syllabus')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === 'syllabus'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4 text-[#faafcd]" />
            <span>Syllabus Extractor</span>
          </button>
        </div>
      </div>

      {/* App Window Frame */}
      <div className="relative rounded-3xl p-1 bg-gradient-to-b from-slate-200 via-slate-200/50 to-slate-300 dark:from-slate-700 dark:via-slate-800/60 dark:to-slate-900 shadow-2xl shadow-[#9EC29A]/10">
        <div className="rounded-[22px] overflow-hidden bg-white dark:bg-[#0B101B] border border-slate-200/90 dark:border-slate-800 shadow-xl">
          
          {/* Mac OS Window Header */}
          <div className="px-4 sm:px-6 py-3.5 bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
              <span className="ml-3 text-xs font-semibold text-slate-500 dark:text-slate-400 hidden sm:inline-block">
                app.trumley.com / study-hub
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#9EC29A]/15 text-[#30522c] dark:text-[#C5E8C2] border border-[#9EC29A]/30">
                <span className="w-2 h-2 rounded-full bg-[#9EC29A] animate-ping"></span>
                <span>Waterfill Algorithm: Balanced</span>
              </div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 hidden md:block">
                Target: 2h 15m today
              </div>
            </div>
          </div>

          {/* Window Body (Content dependent on active tab) */}
          <div className="p-4 sm:p-7 min-h-[460px]">
            
            {/* ── TAB 1: DAILY STUDY HUB ────────────────────────────── */}
            {activeTab === 'hub' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/80">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                        Session 1 of 3 Today
                      </span>
                      <span className="text-xs text-slate-500">Scheduled for 10:00 - 10:45</span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
                      Biochemistry — Cellular Respiration & ATP Synthesis
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Exam in:</span>
                    <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300/40">
                      8 Days (Nov 6)
                    </span>
                  </div>
                </div>

                <div className="grid lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Left Column: Interactive Timer & Current Session Controls */}
                  <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 text-center space-y-5">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      <Clock className="w-3.5 h-3.5 text-[#9EC29A]" />
                      <span>Pomodoro Flow Timer</span>
                    </div>

                    <div className="py-2">
                      <div className="font-mono text-5xl sm:text-6xl font-black tracking-tight text-slate-900 dark:text-white">
                        {formatTimer(timerSeconds)}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        {timerRunning ? 'Deep Focus Session in progress...' : 'Ready when you are'}
                      </p>
                    </div>

                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => setTimerRunning(!timerRunning)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md ${
                          timerRunning
                            ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                            : 'bg-[#9EC29A] hover:bg-[#86B382] text-slate-950 shadow-[#9EC29A]/30'
                        }`}
                      >
                        {timerRunning ? (
                          <>
                            <Pause className="w-4 h-4" /> Pause
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 fill-current" /> Start Focus
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          setTimerRunning(false);
                          setTimerSeconds(25 * 60);
                        }}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                        title="Reset Timer"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="pt-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-slate-800">
                      ⚡ Trumley logs your completed minutes automatically
                    </div>
                  </div>

                  {/* Right Column: Interactive Tasks & Progress */}
                  <div className="lg:col-span-7 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        Session Tasks ({completedCount}/{tasks.length})
                      </h4>
                      <span className="text-xs font-semibold text-[#30522c] dark:text-[#9EC29A]">
                        {Math.round((completedCount / tasks.length) * 100)}% Complete
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#9EC29A] to-emerald-500 transition-all duration-300 rounded-full"
                        style={{ width: `${(completedCount / tasks.length) * 100}%` }}
                      ></div>
                    </div>

                    {/* Task List */}
                    <div className="space-y-2.5 pt-1">
                      {tasks.map((task) => (
                        <div
                          key={task.id}
                          onClick={() => toggleTask(task.id)}
                          className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                            task.done
                              ? 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60 opacity-80'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-[#9EC29A]/50 shadow-xs'
                          }`}
                        >
                          <div className="mt-0.5 flex-shrink-0 text-[#9EC29A]">
                            {task.done ? (
                              <CheckCircle2 className="w-5 h-5 fill-[#9EC29A] text-white dark:text-slate-950" />
                            ) : (
                              <Circle className="w-5 h-5 text-slate-400 hover:text-[#9EC29A]" />
                            )}
                          </div>
                          <span
                            className={`text-sm font-medium leading-relaxed ${
                              task.done
                                ? 'line-through text-slate-400 dark:text-slate-500'
                                : 'text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {task.text}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Next Session Preview */}
                    <div className="mt-4 p-4 rounded-xl bg-slate-50/80 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#42bfdd]/20 text-[#218099] dark:text-[#42bfdd] flex items-center justify-center font-bold text-xs">
                          #2
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-500">Up Next at 14:00</div>
                          <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            Linear Algebra — Eigenvectors & Diagonalization
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                        30 min
                      </span>
                    </div>

                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 2: SMART WATERFILL CALENDAR ───────────────────── */}
            {activeTab === 'schedule' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800/80">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">
                      The Trumley Waterfill Engine
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      Sessions automatically distribute backwards from your exam date while enforcing a 2.5h daily maximum.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300/30">
                      0 Cramming Spikes
                    </span>
                  </div>
                </div>

                {/* Calendar Days Simulation */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                  {[
                    { day: 'Mon', date: 'Oct 28', hours: '2.0h', sessions: 3, type: 'study', label: 'Calculus + Bio' },
                    { day: 'Tue', date: 'Oct 29', hours: '2.0h', sessions: 3, type: 'study', label: 'History + Bio' },
                    { day: 'Wed', date: 'Oct 30', hours: '1.5h', sessions: 2, type: 'study', label: 'Bio Chem' },
                    { day: 'Thu', date: 'Oct 31', hours: '0.0h', sessions: 0, type: 'rest', label: 'Protected Rest Day' },
                    { day: 'Fri', date: 'Nov 01', hours: '2.5h', sessions: 4, type: 'study', label: 'Linear Algebra' },
                    { day: 'Sat', date: 'Nov 02', hours: '2.0h', sessions: 3, type: 'study', label: 'Spaced Review' },
                    { day: 'Sun', date: 'Nov 03', hours: '1.5h', sessions: 2, type: 'study', label: 'Consolidation' },
                  ].map((d, idx) => (
                    <div
                      key={idx}
                      className={`rounded-2xl p-3.5 border transition-all ${
                        d.type === 'rest'
                          ? 'bg-slate-50 dark:bg-slate-900/30 border-dashed border-slate-200 dark:border-slate-800'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs hover:border-[#9EC29A]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-semibold mb-2">
                        <span className="text-slate-500 dark:text-slate-400">{d.day}</span>
                        <span className="text-slate-700 dark:text-slate-300">{d.date}</span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="text-lg font-black text-slate-900 dark:text-white">
                          {d.hours}
                        </div>
                        <div
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-md inline-block ${
                            d.type === 'rest'
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                              : 'bg-[#9EC29A]/15 text-[#30522c] dark:text-[#C5E8C2]'
                          }`}
                        >
                          {d.label}
                        </div>
                      </div>

                      {/* Bar indicator */}
                      <div className="mt-3 w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            d.type === 'rest' ? 'w-0' : 'bg-[#9EC29A]'
                          }`}
                          style={{
                            width: d.type === 'rest' ? '0%' : d.hours === '2.5h' ? '100%' : '75%',
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Key Insights Callout */}
                <div className="grid sm:grid-cols-3 gap-4 pt-2">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1">
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-[#9EC29A]" /> Daily Caps Enforced
                    </span>
                    <p className="text-slate-500 dark:text-slate-400">
                      Never more than 2.5 hours scheduled in a single day, eliminating burnout.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1">
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500" /> Day-Before Final Pass
                    </span>
                    <p className="text-slate-500 dark:text-slate-400">
                      The algorithm reserves the day before your exam for light high-yield consolidation.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1">
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <RotateCcw className="w-4 h-4 text-[#42bfdd]" /> Instant Rebalancing
                    </span>
                    <p className="text-slate-500 dark:text-slate-400">
                      Missed Friday? Click "Rebalance" and the engine redistributes the missed chunk smoothly.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 3: CONTEXTUAL AI TUTOR ────────────────────────── */}
            {activeTab === 'coach' && (
              <div className="space-y-5 animate-in fade-in duration-300 max-w-3xl mx-auto">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#42bfdd]/20 text-[#218099] dark:text-[#42bfdd] flex items-center justify-center">
                      <Brain className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Trumley AI Tutor (Context: Biochem Chapter 12)
                      </h4>
                      <p className="text-xs text-slate-500">Knows your syllabus, notes, and exam dates</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Active Tutor
                  </span>
                </div>

                {/* Simulated Chat Dialogue */}
                <div className="space-y-3.5">
                  {/* User message */}
                  <div className="flex justify-end">
                    <div className="bg-[#9EC29A] text-slate-950 font-medium text-xs sm:text-sm px-4 py-2.5 rounded-2xl rounded-tr-none max-w-md shadow-xs">
                      Why does NADH produce ~2.5 ATP while FADH2 only yields ~1.5 ATP during oxidative phosphorylation?
                    </div>
                  </div>

                  {/* AI message */}
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-[#9EC29A] text-slate-950 font-black text-xs flex items-center justify-center flex-shrink-0 mt-1">
                      T
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl rounded-tl-none max-w-xl text-xs sm:text-sm text-slate-700 dark:text-slate-300 space-y-2.5 leading-relaxed">
                      <p>
                        It comes down to <strong>entry point & proton pumping</strong>:
                      </p>
                      <ul className="list-disc pl-4 space-y-1 text-xs">
                        <li>
                          <strong>NADH</strong> enters at <strong>Complex I</strong>. Electrons pass through Complexes I, III, and IV, pumping <strong>~10 H⁺ ions</strong> across into the intermembrane space.
                        </li>
                        <li>
                          <strong>FADH₂</strong> bypasses Complex I and enters at <strong>Complex II</strong>, which does not pump protons. Its electrons only pump <strong>~6 H⁺ ions</strong>.
                        </li>
                      </ul>
                      <p className="text-xs">
                        Since ATP synthase requires ~4 H⁺ per ATP synthesized:
                        <br />
                        <span className="font-mono font-semibold text-slate-900 dark:text-white">
                          10 H⁺ / 4 = 2.5 ATP &nbsp;|&nbsp; 6 H⁺ / 4 = 1.5 ATP
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Interactive Quick Checkpoint Question */}
                  <div className="ml-10 p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Checkpoint Question (Click an option to test yourself):</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      If Oligomycin inhibits ATP synthase directly, what happens to electron transport in Complex I–IV?
                    </p>

                    <div className="space-y-1.5 pt-1">
                      {[
                        { id: 0, text: 'A) Electron transport accelerates to overcome resistance', correct: false },
                        { id: 1, text: 'B) It eventually stops as proton gradient becomes too steep (Respiratory Control)', correct: true },
                        { id: 2, text: 'C) It converts to lactic acid fermentation immediately', correct: false },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setSelectedQuizOption(opt.id)}
                          className={`w-full text-left px-3.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-between border ${
                            selectedQuizOption === opt.id
                              ? opt.correct
                                ? 'bg-emerald-500 text-white border-emerald-600'
                                : 'bg-rose-500 text-white border-rose-600'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-400'
                          }`}
                        >
                          <span>{opt.text}</span>
                          {selectedQuizOption === opt.id && (
                            <span className="font-bold text-[11px] ml-2">
                              {opt.correct ? '✓ Correct!' : '✗ Try again'}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 4: SYLLABUS EXTRACTOR ─────────────────────────── */}
            {activeTab === 'syllabus' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800/80">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">
                      Instant Syllabus & Textbook PDF Extraction
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      Drop any school syllabus, Dutch Magister curriculum, or textbook table of contents.
                    </p>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#faafcd]/20 text-[#8a3357] dark:text-[#f3bcd2] border border-[#faafcd]/30">
                    PDF & Docx Support
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Upload Card Mockup */}
                  <div className="p-6 rounded-2xl border-2 border-dashed border-[#9EC29A] dark:border-[#9EC29A]/50 bg-[#9EC29A]/5 text-center flex flex-col items-center justify-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 shadow-md text-[#9EC29A] flex items-center justify-center">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        VWO_Biologie_Examenstof_2026.pdf
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">2.4 MB • 18 Pages • Scanned in 1.2s</p>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                      <Check className="w-3.5 h-3.5" /> 14 Chapters Extracted
                    </div>
                  </div>

                  {/* AI Output preview */}
                  <div className="bg-slate-50 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                      <span>Generated Study Breakdown</span>
                      <span className="text-[#9EC29A]">Auto-Scheduled</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      {[
                        { title: 'Ch 1. Cell Membranes & Transport', hours: '2.5 hrs', sessions: '3 sessions' },
                        { title: 'Ch 2. Energetics & Cellular Respiration', hours: '4.0 hrs', sessions: '5 sessions' },
                        { title: 'Ch 3. Photosynthesis (Light & Dark)', hours: '3.0 hrs', sessions: '4 sessions' },
                        { title: 'Ch 4. Molecular Genetics & Transcription', hours: '4.5 hrs', sessions: '6 sessions' },
                      ].map((ch, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800"
                        >
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate pr-2">
                            {ch.title}
                          </span>
                          <span className="text-slate-500 font-medium whitespace-nowrap">
                            {ch.hours} ({ch.sessions})
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>Total: 14.0 hrs study time</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        Spaced over 12 days
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Window Footer Status Bar */}
          <div className="px-6 py-2.5 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200/60 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              <span>All Trumley AI & Scheduling Engines Online</span>
            </div>
            <div className="text-[11px] font-semibold text-slate-400">
              Try clicking the timer or checklist above to test the live demo!
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
