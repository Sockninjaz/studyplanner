'use client';

import React, { useState, useEffect } from 'react';
import { Share2, Copy, Check, RefreshCw, ShieldCheck, Users, X, ExternalLink } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareModal({ isOpen, onClose }: ShareModalProps) {
  const [shareUrl, setShareUrl] = useState('');
  const [parentCount, setParentCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchShareLink();
    }
  }, [isOpen]);

  const fetchShareLink = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/share');
      const data = await res.json();
      if (res.ok && data.shareUrl) {
        setShareUrl(data.shareUrl);
        setParentCount(data.parentSubscribersCount || 0);
      }
    } catch (err) {
      console.error('Error fetching share link:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy share link:', err);
    }
  };

  const handleRegenerate = async () => {
    if (!confirm('Are you sure you want to generate a new share link? Previous links will immediately stop working.')) {
      return;
    }

    try {
      setRegenerating(true);
      const res = await fetch('/api/share', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.shareUrl) {
        setShareUrl(data.shareUrl);
      }
    } catch (err) {
      console.error('Failed to regenerate share link:', err);
    } finally {
      setRegenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-[#9EC29A]/20 text-[#3d6538] dark:text-[#9EC29A] flex items-center justify-center">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Share with Parents & Mentors
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Secure, read-only link with cryptographic protection
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-5">
          Parents and mentors can view your study schedule, exam countdowns, and completion progress live without needing an account. Your personal notes, password, and settings remain private.
        </p>

        {/* Share Link Input */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
            Your Secure Share Link
          </label>
          
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={loading ? 'Loading...' : shareUrl}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs font-mono text-slate-800 dark:text-slate-200 truncate select-all focus:outline-none"
            />
            
            <button
              onClick={handleCopy}
              disabled={loading || !shareUrl}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#9EC29A] hover:bg-[#8eb58a] text-slate-950 font-bold text-xs shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied!' : 'Copy Link'}</span>
            </button>
          </div>
        </div>

        {/* Subscriber & Privacy Badges */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 space-y-3 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#9EC29A]" />
              <span>Subscribed parents for weekly updates:</span>
            </div>
            <span className="font-bold text-slate-900 dark:text-white px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
              {parentCount}
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-500">
            <ShieldCheck className="w-4 h-4 text-[#9EC29A] flex-shrink-0" />
            <span>GDPR data minimization active. No full names or personal tokens exposed.</span>
          </div>
        </div>

        {/* Action Row */}
        <div className="mt-6 flex items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={handleRegenerate}
            disabled={regenerating || loading}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
            <span>Generate new link</span>
          </button>

          {shareUrl && (
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#40683a] dark:text-[#9EC29A] hover:underline"
            >
              <span>Preview Link</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

      </div>
    </div>
  );
}
