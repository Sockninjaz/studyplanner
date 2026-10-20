import React from 'react';
import Link from 'next/link';
import { ShieldCheck, ArrowLeft, Lock, Server, EyeOff, CheckCircle2 } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy (GDPR) • StudyPlanner',
  description: 'Learn how StudyPlanner protects student and parent privacy under the GDPR with strict data minimization.',
};

export default function PrivacyPage() {
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
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>GDPR Compliant</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-12 shadow-sm space-y-10">
          
          {/* Header */}
          <div className="border-b border-slate-200 dark:border-slate-800 pb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-[#9EC29A]/20 text-[#365a33] dark:text-[#C5E8C2] mb-3">
              <Lock className="w-3.5 h-3.5" />
              <span>Privacy & Data Protection</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Privacy Policy (GDPR)
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl">
              StudyPlanner is designed for high school students and their parents. 
              We believe in complete transparency, zero ad-targeting, and rigorous data minimization.
            </p>
            <div className="mt-4 text-xs text-slate-500">
              Last updated: October 16, 2026 • Version 2.1 (Production Audit)
            </div>
          </div>

          {/* Key Commitments Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <EyeOff className="w-5 h-5 text-[#9EC29A] mb-2" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Data Minimization</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                No full names, no school locations, and no birth dates. We only store what is strictly necessary to plan your studies.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <Server className="w-5 h-5 text-[#9EC29A] mb-2" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">EU-Hosted Databases</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                All production databases and backups reside securely inside the European Union (Frankfurt & Amsterdam data centers).
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <ShieldCheck className="w-5 h-5 text-[#9EC29A] mb-2" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Zero Ads & Zero Selling</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                We never sell user data to brokers or advertisers. Our platform is completely free of third-party tracking ads.
              </p>
            </div>
          </div>

          {/* Policy Body */}
          <div className="prose dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            
            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                1. Data Controller
              </h2>
              <p>
                StudyPlanner is the data controller within the meaning of the General Data Protection Regulation (GDPR). 
                We facilitate intelligent study planning, exam schedule tracking, and progress monitoring for students and parents.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                2. What Data We Collect (Data Minimization)
              </h2>
              <p>
                In strict accordance with Article 5(1)(c) of the GDPR, we adhere to the principle of data minimization. We only collect data that is adequate, relevant, and limited to what is necessary:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong>Account Credentials:</strong> Email address and a cryptographically hashed password (using bcrypt/argon2). We do not require your full legal surname.</li>
                <li><strong>Schedule & Study Metadata:</strong> Academic subjects (e.g., Physics, Mathematics), exam dates, textbook chapters, and estimated duration per study block.</li>
                <li><strong>Parent Updates (Optional):</strong> When a parent opts in to receive weekly progress summaries, we store solely their email address.</li>
                <li><strong>What We NEVER Collect:</strong> We never collect or store student dates of birth, national ID numbers, physical home addresses, or school geographical locations.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                3. Secure Parent & Mentor Share Links
              </h2>
              <p>
                The public share feature (e.g., <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">/share/[token]</code>) 
                uses unguessable cryptographic tokens with 192 bits of entropy. 
                The share route displays strictly read-only study blocks, exam dates, and completion status. Student passwords, personal notes, and account settings are never accessible through this route. Students can revoke or regenerate their share link at any time from their dashboard.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                4. Artificial Intelligence & Document Parsing
              </h2>
              <p>
                When you upload a syllabus, screenshot, or schedule photo, the document is processed securely:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Uploaded documents are analyzed in volatile memory and never used to train public AI foundation models.</li>
                <li>All AI endpoints enforce an IP-based sliding window rate limit (max 5 requests per 10 minutes) and a strict 4 MB file size cap.</li>
                <li>Only validated PNG, JPEG, and PDF documents with verified binary magic bytes are permitted.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                5. Payments via Stripe (iDEAL, Bancontact, Card)
              </h2>
              <p>
                Payment processing for StudyPlanner Pro is handled by Stripe Payments Europe, Ltd. (Ireland). 
                We never store credit card numbers, CVCs, or bank account credentials on our servers. All transactions comply with PCI-DSS Level 1 certification.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                6. Data Storage & International Transfers
              </h2>
              <p>
                All databases and infrastructure are hosted in ISO 27001-certified European data centers (Frankfurt, Germany & Amsterdam, Netherlands). Your data remains inside the European Economic Area (EEA) under GDPR protections.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                7. Your GDPR Rights
              </h2>
              <p>
                Under European privacy law, students and parents hold the following statutory rights:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-[#9EC29A] flex-shrink-0 mt-0.5" />
                  <span><strong>Right of Access:</strong> Inspect all stored study metadata and account details at any time.</span>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-[#9EC29A] flex-shrink-0 mt-0.5" />
                  <span><strong>Right to Erasure:</strong> Permanently delete your account, schedule, and parent subscriber emails.</span>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-[#9EC29A] flex-shrink-0 mt-0.5" />
                  <span><strong>Right to Rectification:</strong> Edit or correct any inaccurate subjects or exam schedules.</span>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-[#9EC29A] flex-shrink-0 mt-0.5" />
                  <span><strong>Data Portability:</strong> Export your study calendar in standard formats.</span>
                </div>
              </div>
            </section>

            <section className="space-y-3 border-t border-slate-200 dark:border-slate-800 pt-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                8. Contact & Data Protection Officer
              </h2>
              <p>
                For questions regarding this policy or to exercise your GDPR rights, contact our Privacy Desk:
              </p>
              <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/60 text-xs space-y-1">
                <p><strong>StudyPlanner Privacy Desk</strong></p>
                <p>Email: <a href="mailto:privacy@studyplanner.nl" className="text-[#4E774A] dark:text-[#9EC29A] underline">privacy@studyplanner.nl</a></p>
                <p>Location: Amsterdam, The Netherlands</p>
                <p>You also hold the right to lodge a complaint with your national data protection authority (e.g., the Dutch Autoriteit Persoonsgegevens).</p>
              </div>
            </section>

          </div>
        </div>
      </main>
    </div>
  );
}
