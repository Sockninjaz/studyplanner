import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Scale } from 'lucide-react';

export const metadata = {
  title: 'Terms of Service • StudyPlanner',
  description: 'Terms of Service for StudyPlanner students, parents, and academic mentors.',
};

export default function VoorwaardenPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased selection:bg-[#9EC29A]/30">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#9EC29A]/15 text-[#3b6337] dark:text-[#B5DCB1] text-xs font-semibold border border-[#9EC29A]/30">
            <Scale className="w-3.5 h-3.5" />
            <span>Terms of Service</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-12 shadow-sm space-y-10">
          
          {/* Header */}
          <div className="border-b border-slate-200 dark:border-slate-800 pb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-[#9EC29A]/20 text-[#365a33] dark:text-[#C5E8C2] mb-3">
              <Scale className="w-3.5 h-3.5" />
              <span>Legal Agreement</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Terms of Service
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl">
              Welcome to StudyPlanner. These Terms of Service govern your access to and use of our website, 
              application, and AI-powered study planning tools.
            </p>
            <div className="mt-4 text-xs text-slate-500">
              Last updated: October 16, 2026 • Valid for all users
            </div>
          </div>

          {/* Policy Body */}
          <div className="prose dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            
            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                1. Definitions and Acceptance
              </h2>
              <p>
                By accessing or using StudyPlanner, you agree to be bound by these Terms of Service.
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong>StudyPlanner:</strong> The software platform and service operated to assist students and parents in academic planning.</li>
                <li><strong>User:</strong> Any individual student, parent, guardian, or tutor using the platform.</li>
                <li><strong>Service:</strong> Web applications, schedule optimizers, syllabus parsing, and communication tools provided by StudyPlanner.</li>
                <li><strong>Pro Plan:</strong> Paid subscription tier providing unlimited AI syllabus parsing and advanced scheduling options.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                2. Age and Parental Consent
              </h2>
              <p>
                StudyPlanner is intended for secondary school and high school students. Users under 16 years of age represent that they have obtained consent from a parent or legal guardian to create an account and make subscription purchases.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                3. Use of AI & Study Recommendations
              </h2>
              <p>
                Our planning engine uses algorithmic optimization and artificial intelligence to distribute study materials across available days:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Generated study schedules are advisory suggestions. The student remains solely responsible for verifying official school syllabus requirements and exam dates.</li>
                <li>Uploading full copyrighted textbooks is prohibited; users may only upload syllabi, assignment outlines, or chapter breakdowns relevant to their upcoming exams.</li>
                <li>To prevent abuse, automated rate limits (max 5 requests per 10 minutes per IP) apply to all AI endpoints.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                4. Parent & Mentor Share Links
              </h2>
              <p>
                Students can generate a cryptographically unguessable share link to give parents or tutors real-time visibility into their study progress. 
                Share links are strictly read-only. The student retains full control and can regenerate or revoke share links at any time through the dashboard.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                5. Payments, Subscriptions & 14-Day Withdrawal Right
              </h2>
              <p>
                The following terms govern StudyPlanner Pro subscriptions:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Payments are processed securely via Stripe supporting <strong>iDEAL</strong>, credit/debit card, and <strong>Bancontact</strong>.</li>
                <li>Subscriptions can be cancelled at any time from your account settings. Upon cancellation, your Pro features remain active until the end of the current billing cycle.</li>
                <li><strong>Statutory Right of Withdrawal:</strong> Consumers have a statutory 14-day right of withdrawal from the purchase date under European consumer protection regulations.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                6. Intellectual Property & Availability
              </h2>
              <p>
                All rights, titles, and interests in the StudyPlanner application, branding, software, and design belong exclusively to StudyPlanner. 
                We target 99.9% uptime, but cannot be held liable for temporary interruptions caused by third-party cloud infrastructure or scheduled maintenance.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                7. Limitation of Liability
              </h2>
              <p>
                StudyPlanner is provided on an "as is" and "as available" basis. While we strive for accuracy, StudyPlanner is not liable for exam results, missed deadlines, or scheduling oversights. Students should verify all critical exam dates in their school portal (e.g., Magister or Somtoday).
              </p>
            </section>

            <section className="space-y-3 border-t border-slate-200 dark:border-slate-800 pt-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                8. Governing Law and Jurisdiction
              </h2>
              <p>
                These Terms of Service and any dispute arising out of or related to them are governed exclusively by the laws of The Netherlands, and any legal proceedings shall be submitted to the competent court in Amsterdam, The Netherlands.
              </p>
            </section>

          </div>
        </div>
      </main>
    </div>
  );
}
