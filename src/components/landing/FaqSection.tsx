'use client';

import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs: FaqItem[] = [
    {
      question: 'What makes Trumley different from Google Calendar or Notion?',
      answer:
        'Standard calendar tools are static: you have to manually guess how many hours each subject needs, manually drag blocks onto days, and spend hours rearranging everything when life gets in the way. Trumley is an intelligent scheduling engine. You input your exam date and syllabus once; Trumley mathematically waterfills your daily sessions, respects your maximum study limits, schedules spaced revision, and auto-rebalances your schedule with 1 click if you fall behind.',
    },
    {
      question: 'How does the Waterfill algorithm determine when I should start studying?',
      answer:
        'Trumley calculates the total workload for all your upcoming exams, adjusts for your confidence level and material difficulty, and works backwards from the exam date. It determines the optimal start date so you study at a comfortable, sustainable pace (e.g. 2 hours/day) instead of cramming 8 hours the final weekend.',
    },
    {
      question: 'Can I upload my school syllabus, Magister topics, or textbook PDFs?',
      answer:
        'Yes! Trumley includes a built-in curriculum parser. You can drag and drop your syllabus PDF, textbook table of contents, or course outline. Trumley extracts chapters, page ranges, and suggested hours in seconds and turns them into organized study blocks.',
    },
    {
      question: 'How does the integrated AI Study Coach know what I am studying?',
      answer:
        'When you start a session in your Study Hub, Trumley passes that specific subject, chapter, and your past confidence metrics to the AI tutor. You can ask for instant explanations, step-by-step formula derivations, or rapid-fire practice quiz questions tailored directly to your exam.',
    },
    {
      question: 'What happens if I miss a scheduled study day?',
      answer:
        'No stress and no guilt. With Trumley’s 1-click Rebalance feature, the engine recalculates your remaining study days and smoothly redistributes the missed sessions without exceeding your daily maximum limit.',
    },
    {
      question: 'Is Trumley free for students?',
      answer:
        'Yes! Core study planning, unlimited exam tracking, the Study Hub, focus timer, and syllabus scheduling are completely free for students. No credit card is required to sign up.',
    },
  ];

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      {faqs.map((faq, index) => {
        const isOpen = openIndex === index;
        return (
          <div
            key={index}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden transition-all shadow-xs"
          >
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
              aria-expanded={isOpen}
            >
              <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {faq.question}
              </span>
              <div
                className={`p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 transition-transform duration-200 flex-shrink-0 ${
                  isOpen ? 'rotate-180 bg-[#9EC29A]/20 text-[#30522c] dark:text-[#9EC29A]' : ''
                }`}
              >
                <ChevronDown className="w-4 h-4" />
              </div>
            </button>

            {isOpen && (
              <div className="px-6 pb-6 text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800/80 pt-4 animate-in fade-in duration-200">
                {faq.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
