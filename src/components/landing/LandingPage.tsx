'use client';

import React from 'react';
import Link from 'next/link';
import { 
  ArrowRight, Sparkles, CheckCircle2, ShieldCheck, 
  Brain, Calendar, Clock, BookOpen, RotateCcw, 
  Zap, Star, Award, Layers, Check, ChevronRight,
  TrendingUp, Users, HeartHandshake
} from 'lucide-react';
import LandingNav from './LandingNav';
import TrumleyLogo from './TrumleyLogo';
import HeroShowcase from './HeroShowcase';
import StudyCalculator from './StudyCalculator';
import FaqSection from './FaqSection';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070B13] text-slate-900 dark:text-slate-100 selection:bg-[#9EC29A]/30 overflow-x-hidden font-sans">
      {/* Navigation */}
      <LandingNav />

      {/* Hero Section */}
      <section className="relative pt-32 sm:pt-36 pb-20 sm:pb-28 overflow-hidden">
        {/* Subtle Ambient Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-gradient-to-b from-[#9EC29A]/20 via-[#42bfdd]/10 to-transparent blur-3xl pointer-events-none -z-10 rounded-full"></div>
        <div className="absolute top-40 right-10 w-96 h-96 bg-[#9EC29A]/10 blur-3xl rounded-full pointer-events-none -z-10"></div>
        
        {/* Subtle dot pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none -z-10"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto space-y-6">
            
            {/* Shimmer Announcement Pill */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#9EC29A]/15 dark:bg-[#9EC29A]/10 text-[#2b4c27] dark:text-[#C5E8C2] text-xs sm:text-sm font-bold border border-[#9EC29A]/30 shadow-xs hover:border-[#9EC29A]/60 transition-colors cursor-default">
              <Sparkles className="w-4 h-4 text-[#7FA97B] dark:text-[#9EC29A] animate-pulse" />
              <span>Introducing Trumley 2.0 • The Intelligent Exam Engine</span>
              <span className="hidden sm:inline-block text-[#568053] dark:text-[#9EC29A]">→</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-slate-950 dark:text-white leading-[1.08]">
              Master every exam.{' '}
              <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#598456] via-[#7FA97B] to-[#42bfdd] dark:from-[#9EC29A] dark:via-[#B6DEB3] dark:to-[#42bfdd]">
                Without the cram.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed pt-1">
              Trumley turns your overwhelming syllabi and exam dates into a calm, automated daily study plan. Powered by smart waterfill algorithms and a personal AI coach who knows your exact curriculum.
            </p>

            {/* Primary Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <Link
                href="/register"
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-[#9EC29A] hover:bg-[#86B382] text-slate-950 font-extrabold text-base transition-all shadow-lg shadow-[#9EC29A]/25 hover:shadow-xl hover:shadow-[#9EC29A]/35 hover:-translate-y-0.5 flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span>Start Planning for Free</span>
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Link>

              <a
                href="#demo"
                className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-bold text-base border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all shadow-xs flex items-center justify-center gap-2"
              >
                <span>Explore Interactive Demo</span>
              </a>
            </div>

            {/* Trust and Social Proof Badges */}
            <div className="pt-6 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Zero cramming panic</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Works with any syllabus or PDF</span>
              </div>
            </div>

            {/* Star Rating Strip */}
            <div className="pt-2 flex items-center justify-center gap-3">
              <div className="flex items-center text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-current" />
                ))}
              </div>
              <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                4.9/5 from 18,000+ ambitious students
              </span>
            </div>

          </div>

          {/* Interactive Hero Product Showcase */}
          <div id="demo" className="mt-14 sm:mt-18 scroll-mt-24">
            <HeroShowcase />
          </div>

        </div>
      </section>

      {/* University Trust Strip */}
      <section className="py-12 border-y border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-6">
            Empowering students at leading universities and secondary schools
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-14 text-sm font-extrabold text-slate-400 dark:text-slate-500">
            <span className="tracking-wider">TU DELFT</span>
            <span className="tracking-wider">UNIVERSITY OF AMSTERDAM</span>
            <span className="tracking-wider">ERASMUS UNIVERSITY</span>
            <span className="tracking-wider">OXFORD</span>
            <span className="tracking-wider">UTRECHT UNIVERSITY</span>
            <span className="tracking-wider">VWO & GYMNASIUM</span>
          </div>
        </div>
      </section>

      {/* Comparison: The Old Way vs The Trumley Engine */}
      <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#9EC29A]/15 text-[#30522c] dark:text-[#C5E8C2] border border-[#9EC29A]/30 mb-3">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>The Study Evolution</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-950 dark:text-white tracking-tight">
            Why traditional cramming fails
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base mt-2">
            Most students don't fail exams because they aren't smart. They fail because cramming overwhelms working memory.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* The Old Way */}
          <div className="rounded-3xl p-8 bg-rose-50/50 dark:bg-rose-950/10 border border-rose-200/80 dark:border-rose-900/30 space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
                The Stress Loop
              </span>
              <span className="text-2xl">😫</span>
            </div>

            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              Cramming & Chaos
            </h3>

            <ul className="space-y-3.5 text-sm text-slate-600 dark:text-slate-400">
              <li className="flex items-start gap-2.5">
                <span className="text-rose-500 font-bold mt-0.5">✗</span>
                <span>Procrastinating because you don't know where to start</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-rose-500 font-bold mt-0.5">✗</span>
                <span>Exhausting 8-hour panic sessions 48 hours before the exam</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-rose-500 font-bold mt-0.5">✗</span>
                <span>High anxiety and poor sleep destroying exam recall</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-rose-500 font-bold mt-0.5">✗</span>
                <span>Forgetting 70% of material within 48 hours after the test</span>
              </li>
            </ul>
          </div>

          {/* The Trumley Way */}
          <div className="rounded-3xl p-8 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-200/80 dark:border-emerald-900/30 space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#9EC29A]/15 blur-2xl rounded-full pointer-events-none"></div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-[#9EC29A]/20 text-[#2b4c27] dark:text-[#C5E8C2] border border-[#9EC29A]/40">
                The Trumley Engine
              </span>
              <span className="text-2xl">🧘‍♂️</span>
            </div>

            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              Calm, Algorithmic Flow
            </h3>

            <ul className="space-y-3.5 text-sm text-slate-700 dark:text-slate-300">
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-500 font-bold mt-0.5">✓</span>
                <span><strong>Instant clarity:</strong> Your day tells you exactly what to read and for how long</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-500 font-bold mt-0.5">✓</span>
                <span><strong>Spaced 30–45 min micro-sessions:</strong> Maximum neuro-retention without fatigue</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-500 font-bold mt-0.5">✓</span>
                <span><strong>Protected rest days:</strong> Guilt-free evenings because your plan is mathematically on track</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-500 font-bold mt-0.5">✓</span>
                <span><strong>AI Study Coach:</strong> Instant explanations and flash quizzes during every session</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section id="features" className="py-24 bg-white dark:bg-slate-900/40 border-t border-slate-200/80 dark:border-slate-800/80 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#9EC29A]/15 text-[#30522c] dark:text-[#C5E8C2] border border-[#9EC29A]/30 mb-3">
              <Layers className="w-3.5 h-3.5" />
              <span>Engineered For Excellence</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-950 dark:text-white tracking-tight">
              Everything you need to conquer your curriculum
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base mt-2">
              Trumley replaces fragmented notes, chaotic spreadsheets, and calendar clutter with one cohesive academic operating system.
            </p>
          </div>

          {/* Bento Grid */}
          <div className="grid md:grid-cols-3 gap-6">
            
            {/* Card 1: Waterfill Algorithm */}
            <div className="md:col-span-2 rounded-3xl p-8 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 hover:border-[#9EC29A]/50 transition-all hover:shadow-lg flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-[#9EC29A]/20 text-[#30522c] dark:text-[#9EC29A] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Calendar className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
                  Algorithmic Waterfill Scheduling
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base leading-relaxed">
                  Unlike traditional calendars that expect you to manually plan every hour, Trumley’s engine works backwards from exam day. It weights topics by difficulty and confidence, enforces your daily study ceiling (e.g. 2 hours max), and locks in a final review session 24h prior.
                </p>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-200/60 dark:border-slate-800 flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500">
                <span className="flex items-center gap-1">
                  <Check className="w-4 h-4 text-emerald-500" /> Multi-exam balancing
                </span>
                <span className="flex items-center gap-1">
                  <Check className="w-4 h-4 text-emerald-500" /> Strict daily limits
                </span>
                <span className="flex items-center gap-1">
                  <Check className="w-4 h-4 text-emerald-500" /> Optimal start dates
                </span>
              </div>
            </div>

            {/* Card 2: Contextual AI Coach */}
            <div className="rounded-3xl p-8 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 hover:border-[#42bfdd]/50 transition-all hover:shadow-lg flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-[#42bfdd]/20 text-[#218099] dark:text-[#42bfdd] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Brain className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                  Contextual AI Tutor
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  Stuck on a tricky concept? Your AI coach already knows what chapter you’re reading today. Ask for simple analogies, math formulas, or interactive checkpoint quizzes without leaving your session.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200/60 dark:border-slate-800 text-xs font-semibold text-[#218099] dark:text-[#42bfdd]">
                Integrated LaTeX & Math equations
              </div>
            </div>

            {/* Card 3: Syllabus Extractor */}
            <div className="rounded-3xl p-8 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 hover:border-[#faafcd]/50 transition-all hover:shadow-lg flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-[#faafcd]/20 text-[#8a3357] dark:text-[#f3bcd2] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                  Syllabus PDF Scanner
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  Upload your textbook PDF, syllabus document, or course outline. Trumley parses chapters, headings, and estimated durations in seconds.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200/60 dark:border-slate-800 text-xs font-semibold text-slate-500">
                Supports Dutch VWO/HAVO & Magister
              </div>
            </div>

            {/* Card 4: Built-in Flow Timer */}
            <div className="rounded-3xl p-8 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 hover:border-amber-400/50 transition-all hover:shadow-lg flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Clock className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                  Pomodoro Flow Timer
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  No separate timer apps needed. Run focused study blocks with auto-logging, pause controls, and audio bell alerts directly inside your Study Hub.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200/60 dark:border-slate-800 text-xs font-semibold text-slate-500">
                Tracks minutes completed live
              </div>
            </div>

            {/* Card 5: 1-Click Rebalancer */}
            <div className="rounded-3xl p-8 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 hover:border-emerald-500/50 transition-all hover:shadow-lg flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <RotateCcw className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                  1-Click Rebalancer
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  Got sick or needed an unexpected rest day? Hit "Rebalance" and Trumley redistributes the remaining work across available days with zero guilt.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200/60 dark:border-slate-800 text-xs font-semibold text-slate-500">
                Guaranteed zero overlapping peaks
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* How It Works (3 Steps) */}
      <section id="how-it-works" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-20">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#9EC29A]/15 text-[#30522c] dark:text-[#C5E8C2] border border-[#9EC29A]/30 mb-3">
            <Zap className="w-3.5 h-3.5" />
            <span>Effortless Setup</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-950 dark:text-white tracking-tight">
            How Trumley works in 3 simple steps
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base mt-2">
            Go from a chaotic exam syllabus to a calm daily plan in less than 2 minutes.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Step 1 */}
          <div className="rounded-3xl p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 relative">
            <div className="w-10 h-10 rounded-xl bg-[#9EC29A] text-slate-950 font-black text-sm flex items-center justify-center mb-6">
              01
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Add Your Exams & Syllabus
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Enter your exam dates and chapters, or simply drag and drop your course syllabus PDF. Set your confidence rating for each topic.
            </p>
          </div>

          {/* Step 2 */}
          <div className="rounded-3xl p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 relative">
            <div className="w-10 h-10 rounded-xl bg-[#9EC29A] text-slate-950 font-black text-sm flex items-center justify-center mb-6">
              02
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Trumley Waterfills Your Schedule
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Our scheduling engine distributes 30-min bite-sized sessions backwards from your exam date, protecting rest days and respecting your daily limits.
            </p>
          </div>

          {/* Step 3 */}
          <div className="rounded-3xl p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 relative">
            <div className="w-10 h-10 rounded-xl bg-[#9EC29A] text-slate-950 font-black text-sm flex items-center justify-center mb-6">
              03
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Study, Track, & Ace Your Exam
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Open your Study Hub every morning, hit start on your timer, and quiz yourself with your AI tutor. Walk into test day completely prepared.
            </p>
          </div>
        </div>
      </section>

      {/* Interactive Workload Calculator Section */}
      <section id="calculator" className="py-24 bg-slate-100/60 dark:bg-slate-900/60 border-y border-slate-200/80 dark:border-slate-800/80 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <StudyCalculator />
        </div>
      </section>

      {/* Testimonials */}
      <section id="reviews" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-20">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#9EC29A]/15 text-[#30522c] dark:text-[#C5E8C2] border border-[#9EC29A]/30 mb-3">
            <Award className="w-3.5 h-3.5" />
            <span>Student Success Stories</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-950 dark:text-white tracking-tight">
            Real students. Real grade leaps.
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base mt-2">
            Hear how students transformed their study habits from panic cramming into calm confidence.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              quote:
                'I went from a 5.4 to an 8.2 in Organic Chemistry. Trumley made it impossible to procrastinate because every single day had an exact 45-minute focus chunk.',
              name: 'Emma van Dijk',
              role: 'Biomedical Sciences, University of Amsterdam',
              badge: '+2.8 Grade Increase',
              initials: 'EV',
            },
            {
              quote:
                'The waterfill algorithm is pure magic. I had 4 engineering exams in 8 days. Trumley spaced every session out evenly so I never studied more than 2.5 hours a day.',
              name: 'Lucas Bakker',
              role: 'Computer Science, TU Delft',
              badge: '4 Exams Aced',
              initials: 'LB',
            },
            {
              quote:
                'Being able to upload my VWO syllabus PDF and immediately have every topic scheduled saved me endless hours of planning. The built-in AI tutor is also insanely good.',
              name: 'Sophie Meijer',
              role: 'VWO 6 Gymnasium Student',
              badge: 'Top 5% Graduate',
              initials: 'SM',
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="rounded-3xl p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                    {item.badge}
                  </span>
                </div>
                <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed italic">
                  "{item.quote}"
                </p>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#9EC29A] text-slate-950 font-bold flex items-center justify-center text-xs">
                  {item.initials}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                    {item.name}
                  </h4>
                  <p className="text-xs text-slate-500">{item.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 bg-white dark:bg-slate-900/40 border-t border-slate-200/80 dark:border-slate-800/80 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-950 dark:text-white tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base mt-2">
              Everything you need to know about the Trumley exam scheduling engine.
            </p>
          </div>

          <FaqSection />
        </div>
      </section>

      {/* High-Converting CTA Banner */}
      <section className="py-20 relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-[32px] overflow-hidden p-8 sm:p-14 bg-gradient-to-br from-[#283626] via-[#1b2b1a] to-slate-950 text-white shadow-2xl border border-[#9EC29A]/30 text-center">
            
            {/* Background glowing orbs */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-[#9EC29A]/20 blur-3xl rounded-full pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#42bfdd]/15 blur-3xl rounded-full pointer-events-none"></div>

            <div className="relative z-10 max-w-2xl mx-auto space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-[#9EC29A]/20 text-[#C5E8C2] border border-[#9EC29A]/40">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ready for Effortless Exam Prep?</span>
              </div>

              <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
                Stop stressing. Start studying with clarity today.
              </h2>

              <p className="text-slate-300 text-base sm:text-lg">
                Join thousands of students who traded last-minute cramming anxiety for automated daily progress.
              </p>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/register"
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-[#9EC29A] hover:bg-[#86B382] text-slate-950 font-extrabold text-base transition-all shadow-xl shadow-[#9EC29A]/30 hover:shadow-2xl hover:scale-105 flex items-center justify-center gap-2"
                >
                  <span>Get Started for Free</span>
                  <ArrowRight className="w-5 h-5" />
                </Link>

                <Link
                  href="/login"
                  className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-base transition-all border border-white/20"
                >
                  Already have an account? Sign In
                </Link>
              </div>

              <p className="text-xs text-slate-400 pt-2">
                Free forever • No credit card required • Instant 60-second setup
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Modern Comprehensive Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 pb-12 border-b border-slate-200 dark:border-slate-800">
            
            {/* Brand column */}
            <div className="col-span-2 space-y-4 pr-4">
              <TrumleyLogo size="md" showBadge={false} />
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm">
                Trumley is the intelligent academic planning engine. We turn overwhelming exam syllabi into calm, automated daily study sessions so you walk into test day with 100% confidence.
              </p>
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>All AI & Scheduling Systems Operational</span>
              </div>
            </div>

            {/* Product Column */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Product
              </h4>
              <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
                <li><a href="#features" className="hover:text-slate-900 dark:hover:text-white transition-colors">Waterfill Scheduling</a></li>
                <li><a href="#demo" className="hover:text-slate-900 dark:hover:text-white transition-colors">Daily Study Hub</a></li>
                <li><a href="#demo" className="hover:text-slate-900 dark:hover:text-white transition-colors">Contextual AI Coach</a></li>
                <li><a href="#features" className="hover:text-slate-900 dark:hover:text-white transition-colors">Syllabus Extractor</a></li>
                <li><a href="#calculator" className="hover:text-slate-900 dark:hover:text-white transition-colors">Workload Calculator</a></li>
              </ul>
            </div>

            {/* Resources Column */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Study Methods
              </h4>
              <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
                <li><a href="#how-it-works" className="hover:text-slate-900 dark:hover:text-white transition-colors">Spaced Repetition</a></li>
                <li><a href="#features" className="hover:text-slate-900 dark:hover:text-white transition-colors">Active Recall Tutor</a></li>
                <li><a href="#how-it-works" className="hover:text-slate-900 dark:hover:text-white transition-colors">Waterfill Algorithm</a></li>
                <li><a href="#faq" className="hover:text-slate-900 dark:hover:text-white transition-colors">Exam Panic Avoidance</a></li>
                <li><a href="#reviews" className="hover:text-slate-900 dark:hover:text-white transition-colors">Student Stories</a></li>
              </ul>
            </div>

            {/* Legal Column */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Legal & Company
              </h4>
              <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
                <li><Link href="/terms" className="hover:text-slate-900 dark:hover:text-white transition-colors">Terms of Service</Link></li>
                <li><Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/voorwaarden" className="hover:text-slate-900 dark:hover:text-white transition-colors">Voorwaarden (NL)</Link></li>
                <li><Link href="/login" className="hover:text-slate-900 dark:hover:text-white transition-colors">Student Login</Link></li>
                <li><Link href="/register" className="hover:text-slate-900 dark:hover:text-white transition-colors">Create Free Account</Link></li>
              </ul>
            </div>

          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
            <p>
              © {new Date().getFullYear()} Trumley. Built for students who aim higher.
            </p>
            <div className="flex items-center gap-6">
              <span>English / Nederlands</span>
              <span>Made with 💚 for students</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
