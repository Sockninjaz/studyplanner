'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkBreaks from 'remark-breaks';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface Exam {
  _id: string;
  subject: string;
  color?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  inlineChats?: Message[];
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const preprocessMath = (content: string) => {
  if (!content) return '';
  return content
    .replace(/\\\(([\s\S]*?)\\\)/g, (match, p1) => `$${p1}$`)
    .replace(/\\\[([\s\S]*?)\\\]/g, (match, p1) => `$$${p1}$$`);
};

export default function ChatPage() {
  const { data: examsData } = useSWR('/api/exams', fetcher);
  const exams: Exam[] = examsData?.data || [];

  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [aiIntegration, setAiIntegration] = useState<string>('gpt-4o-mini');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [showMaterial, setShowMaterial] = useState(false);
  
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [inlineInput, setInlineInput] = useState('');
  const [isInlineLoading, setIsInlineLoading] = useState(false);
  const [collapsedThreads, setCollapsedThreads] = useState<Set<string>>(new Set());
  const inlineInputRef = useRef<HTMLTextAreaElement>(null);

  const toggleThread = (id: string) => {
    setCollapsedThreads(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Track whether the user has manually scrolled up during generation
  const userScrolledUp = useRef(false);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const deltaY = e.touches[0].clientY - touchStartRef.current.y;
    const deltaX = Math.abs(e.touches[0].clientX - touchStartRef.current.x);
    // If dragging downward significantly and mostly vertical, collapse keyboard
    if (deltaY > 25 && deltaY > deltaX) {
      const active = document.activeElement;
      if (active instanceof HTMLElement && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        active.blur();
      }
    }
  };

  // Close source material on back gesture
  useEffect(() => {
    if (!showMaterial) return;
    window.history.pushState({ __subState: 'chat-material' }, '');
    const handlePopState = () => {
      setShowMaterial(false);
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [showMaterial]);

  const toggleMaterial = () => {
    if (showMaterial) {
      setShowMaterial(false);
      if (typeof window !== 'undefined' && window.history.state?.__subState === 'chat-material') {
        window.history.back();
      }
    } else {
      setShowMaterial(true);
    }
  };

  // Auto-select first exam or exam from query params if none selected
  useEffect(() => {
    if (!selectedExamId && exams.length > 0) {
      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const paramExamId = urlParams?.get('examId');
      if (paramExamId && exams.some(e => e._id === paramExamId)) {
        setSelectedExamId(paramExamId);
      } else {
        setSelectedExamId(exams[0]._id);
      }
    }
  }, [exams, selectedExamId]);

  // Fetch specific exam details to get the study materials (raw text)
  const { data: selectedExamData } = useSWR(
    selectedExamId ? `/api/exams/${selectedExamId}` : null,
    fetcher
  );
  const studyMaterials = selectedExamData?.data?.studyMaterials || [];

  // Fetch chat history when an exam is selected
  useEffect(() => {
    if (!selectedExamId) {
      setMessages([]);
      return;
    }
    const fetchHistory = async () => {
      setIsFetchingHistory(true);
      try {
        const res = await fetch(`/api/chat/history?examId=${selectedExamId}`);
        const data = await res.json();
        if (data.messages) {
          const formatted: Message[] = data.messages
            .filter((m: any) => m.role === 'user' || m.role === 'assistant')
            .map((m: any, i: number) => ({
              id: m._id || String(i),
              role: m.role as 'user' | 'assistant',
              content: m.content,
              inlineChats: (m.inlineChats || []).map((im: any, j: number) => ({
                id: im._id || `inline-${i}-${j}`,
                role: im.role as 'user' | 'assistant',
                content: im.content
              }))
            }));
          setMessages(formatted);
        }
      } catch (error) {
        console.error('Error fetching history', error);
      } finally {
        setIsFetchingHistory(false);
      }
    };
    fetchHistory();
  }, [selectedExamId]);

  // Smart scroll: only auto-scroll if the user hasn't manually scrolled up
  useEffect(() => {
    if (!userScrolledUp.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleMessagesScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceFromBottom = Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight);
    // Tighter tolerance for being at the bottom to properly detect manual scroll up
    userScrolledUp.current = distanceFromBottom > 10;
  };

  const sendMessage = async () => {
    if (!input.trim() || !selectedExamId || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      inlineChats: []
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    // On touch/mobile devices, blur the input so virtual keyboard closes
    if (typeof window !== 'undefined' && !window.matchMedia('(pointer: fine)').matches) {
      inputRef.current?.blur();
    }
    // When the user sends a new message, re-enable auto-scroll
    userScrolledUp.current = false;

    // Add a placeholder assistant message that we'll stream into
    const assistantMessageId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: assistantMessageId, role: 'assistant', content: '', inlineChats: [] }
    ]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content
          })),
          examId: selectedExamId,
          aiIntegration,
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantContent += chunk;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: assistantContent }
              : msg
          )
        );
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Generation stopped by user');
      } else {
        console.error('Chat error:', error);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'assistant',
            content: 'Sorry, something went wrong. Please try again.',
            inlineChats: []
          }
        ]);
      }
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
      if (typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches) {
        inputRef.current?.focus();
      }
    }
  };

  const sendInlineMessage = async (parentMsgId: string) => {
    if (!inlineInput.trim() || !selectedExamId || isInlineLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inlineInput.trim()
    };

    const targetMsg = messages.find(m => m.id === parentMsgId);
    const parentMsgContent = targetMsg ? targetMsg.content : undefined;

    setMessages(prev => prev.map(m => {
      if (m.id === parentMsgId) {
        return {
          ...m,
          inlineChats: [...(m.inlineChats || []), userMessage]
        };
      }
      return m;
    }));

    setInlineInput('');
    setIsInlineLoading(true);
    if (typeof window !== 'undefined' && !window.matchMedia('(pointer: fine)').matches) {
      inlineInputRef.current?.blur();
    }

    const assistantInlineId = (Date.now() + 1).toString();
    setMessages(prev => prev.map(m => {
      if (m.id === parentMsgId) {
        return {
          ...m,
          inlineChats: [...(m.inlineChats || []), { id: assistantInlineId, role: 'assistant', content: '' }]
        };
      }
      return m;
    }));

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: userMessage.content }],
          examId: selectedExamId,
          aiIntegration,
          parentMessageId: parentMsgId,
          parentMessageContent: parentMsgContent
        }),
        signal: controller.signal
      });

      if (!response.ok) throw new Error('Failed to send inline reply');
      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantContent += chunk;

        setMessages(prev => prev.map(m => {
          if (m.id === parentMsgId) {
            return {
              ...m,
              inlineChats: (m.inlineChats || []).map(im => 
                im.id === assistantInlineId ? { ...im, content: assistantContent } : im
              )
            };
          }
          return m;
        }));
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Inline chat error:', error);
        setMessages(prev => prev.map(m => {
          if (m.id === parentMsgId) {
            return {
              ...m,
              inlineChats: (m.inlineChats || []).map(im => 
                im.id === assistantInlineId ? { ...im, content: 'Error loading response.' } : im
              )
            };
          }
          return m;
        }));
      }
    } finally {
      abortControllerRef.current = null;
      setIsInlineLoading(false);
      if (typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches) {
        inlineInputRef.current?.focus();
      }
    }
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setIsInlineLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading) {
        sendMessage();
        // Reset height after sending
        if (inputRef.current) {
          inputRef.current.style.height = 'auto';
        }
      }
    }
  };

  const selectedExam = exams.find((e) => e._id === selectedExamId);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between bg-white dark:bg-[#1e293b] px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0 z-10 h-14">
        <div className="flex-1 hidden sm:block">
          {/* Left spacing on desktop */}
        </div>
        
        {/* Center Title / Exam Selector */}
        <div className="flex-1 flex justify-start sm:justify-center relative">
          <div className="flex items-center gap-1.5 px-3 py-1.5 -ml-3 sm:ml-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer relative group">
            <span className="font-semibold text-[15px] text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 transition-colors">
              {selectedExam ? selectedExam.subject : 'Select an Exam'}
            </span>
            <svg className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            >
              <option value="" disabled>-- Choose an Exam --</option>
              {exams.map((exam) => (
                <option key={exam._id} value={exam._id}>
                  {exam.subject}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex-1 flex justify-end gap-2 items-center">
          <div className="hidden sm:block">
            <select
              value={aiIntegration}
              onChange={(e) => setAiIntegration(e.target.value)}
              className="bg-transparent border-none py-1 px-2 text-xs text-slate-500 dark:text-slate-400 focus:ring-0 cursor-pointer"
            >
              <option value="gpt-4o-mini">GPT-4o-mini</option>
              <option value="gpt-4o">GPT-4o</option>
            </select>
          </div>
          {selectedExamId && (
            <button
              onClick={toggleMaterial}
              className={`p-2 sm:px-3 sm:py-1.5 text-sm rounded-lg font-medium transition-all ${
                showMaterial 
                  ? 'bg-indigo-600 text-white dark:text-slate-900 shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
              title="Toggle Source Material"
            >
              <span className="hidden sm:inline">{showMaterial ? 'Hide Source' : '📖 Source'}</span>
              <svg className="w-5 h-5 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </button>
          )}
        </div>
      </div>
  
        {/* Main Workspace (Split Screen container) */}
        <div className="flex-1 flex overflow-hidden relative">
          
          {/* Chat Area */}
          <div className={`flex flex-col bg-white dark:bg-slate-900 overflow-hidden ${
            showMaterial ? 'w-full md:w-1/2 border-r border-slate-200 dark:border-slate-800 hidden md:flex' : 'w-full'
          }`}>
            {!selectedExamId ? (
              <div className="flex-1 flex items-center justify-center flex-col text-neutral-dark/40 dark:text-slate-500 p-6">
                <svg 
                  width={64} 
                  height={64} 
                  className="w-16 h-16 mb-4 opacity-50 flex-shrink-0" 
                  style={{ width: '64px', height: '64px', maxWidth: '64px', maxHeight: '64px' }}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="font-medium text-lg">Select an exam to start chatting</p>
                <p className="text-sm mt-1">The AI will use your uploaded materials as context.</p>
              </div>
            ) : (
              <>
                {/* Messages List */}
                <div 
                  ref={messagesContainerRef} 
                  onScroll={handleMessagesScroll} 
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onPointerDown={(e) => {
                    const target = e.target as HTMLElement;
                    if (!target.closest('button, a, input, textarea')) {
                      if (document.activeElement instanceof HTMLElement && 
                          (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
                        document.activeElement.blur();
                      }
                    }
                  }}
                  className="flex-1 overflow-y-auto p-4 space-y-4"
                >
                  {isFetchingHistory ? (
                    <div className="flex justify-center py-8">
                      <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto opacity-70 p-6">
                      <div
                        className="w-10 h-10 rounded-full mb-3 shadow-sm flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                        style={{ backgroundColor: selectedExam?.color || 'var(--sidebar-bg)' }}
                      >
                        {selectedExam?.subject?.charAt(0)?.toUpperCase() || '✨'}
                      </div>
                      <p className="text-base font-semibold text-neutral-dark dark:text-slate-200">Ask about {selectedExam?.subject}</p>
                      <p className="text-xs text-neutral-dark/70 dark:text-slate-400 mt-1">
                        I am your study tutor. Ask me for the begrippenlijst, to explain concepts, or to quiz you on this topic!
                      </p>
                    </div>
                  ) : (
                    messages.map((m) => (
                      <div key={m.id} className={`flex flex-col gap-2 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                        {/* Main Message Bubble */}
                        <div className={`group relative max-w-[92%] sm:max-w-[75%] px-4 py-2.5 shadow-sm ${
                            m.role === 'user'
                              ? 'bg-indigo-600 dark:bg-indigo-600 text-white dark:text-slate-900 rounded-2xl rounded-br-sm shadow-sm border border-transparent'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-2xl rounded-bl-sm border border-slate-200 dark:border-slate-700/50'
                          }`}>
                          {m.content === '' && m.role === 'assistant' ? (
                            <div className="flex gap-1 py-1">
                              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                            </div>
                          ) : (
                            <div className={`text-[15px] sm:text-sm leading-relaxed prose prose-sm sm:prose-base max-w-none prose-p:leading-relaxed prose-pre:p-0 ${
                              m.role === 'user'
                                ? 'text-white dark:text-slate-900 prose-p:text-white dark:prose-p:text-slate-900 prose-headings:text-white dark:prose-headings:text-slate-900 prose-strong:text-white dark:prose-strong:text-slate-900 prose-code:text-white dark:prose-code:text-slate-900'
                                : 'dark:prose-invert text-slate-800 dark:text-slate-100'
                            }`}>
                              <ReactMarkdown remarkPlugins={[remarkMath, remarkBreaks]} rehypePlugins={[rehypeKatex]}>{preprocessMath(m.content)}</ReactMarkdown>
                            </div>
                          )}
                          
                          {/* Reply Button (Only for assistant messages) */}
                          {m.role === 'assistant' && (
                            <button 
                              onClick={() => setActiveThreadId(activeThreadId === m.id ? null : m.id)}
                              className={`absolute right-0 sm:-right-8 bottom-0 p-1.5 rounded-full text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-opacity ${
                                activeThreadId === m.id || (m.inlineChats && m.inlineChats.length > 0)
                                  ? 'opacity-100 bg-slate-200 dark:bg-slate-600'
                                  : 'opacity-0 group-hover:opacity-100 bg-slate-100 dark:bg-slate-700'
                              }`}
                              title="Reply in thread"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                            </button>
                          )}
                        </div>

                        {/* Inline Chats Thread */}
                        {((m.inlineChats && m.inlineChats.length > 0) || activeThreadId === m.id) && (
                          <div className="mt-1 flex flex-col items-start w-full">
                            {/* Collapse toggle */}
                            {m.inlineChats && m.inlineChats.length > 0 && (
                              <button 
                                onClick={() => toggleThread(m.id)}
                                className="ml-8 mb-1 text-[11px] font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1 transition-colors"
                              >
                                {collapsedThreads.has(m.id) ? (
                                  <>
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    Show {m.inlineChats.length} replies
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                    Hide replies
                                  </>
                                )}
                              </button>
                            )}

                            {!collapsedThreads.has(m.id) && (
                              <div className={`relative mt-1 flex flex-col gap-3 w-full max-w-[90%] ml-8`}>
                                {/* Reddit-style thread line */}
                                <div className="absolute -left-4 top-0 bottom-4 w-[2px] bg-slate-200 dark:bg-slate-700 transition-colors" />

                                {m.inlineChats?.map(im => (
                                  <div key={im.id} className={`flex ${im.role === 'user' ? 'justify-end' : 'justify-start'} relative`}>
                                    {/* Horizontal connector */}
                                    {im.role === 'assistant' && (
                                      <div className="absolute -left-4 top-[14px] w-4 h-[2px] bg-slate-200 dark:bg-slate-700" />
                                    )}
                                    <div className={`z-10 px-3.5 py-2 text-sm rounded-xl shadow-sm overflow-x-auto ${im.role === 'user' ? 'bg-indigo-600 dark:bg-indigo-600 text-white dark:text-slate-900 rounded-br-sm border border-transparent' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-sm'}`}>
                                      {im.content === '' && im.role === 'assistant' ? (
                                        <div className="flex gap-1 py-1">
                                          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                                          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                                          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                                        </div>
                                      ) : (
                                        <div className={`leading-relaxed prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:p-0 ${
                                          im.role === 'user' 
                                            ? 'text-white dark:text-slate-900 prose-p:text-white dark:prose-p:text-slate-900 prose-strong:text-white dark:prose-strong:text-slate-900' 
                                            : 'dark:prose-invert text-slate-800 dark:text-slate-100'
                                        }`}>
                                          <ReactMarkdown remarkPlugins={[remarkMath, remarkBreaks]} rehypePlugins={[rehypeKatex]}>{preprocessMath(im.content)}</ReactMarkdown>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                            
                            {/* Thread Input */}
                            {activeThreadId === m.id && (
                              <div className="flex items-end gap-1.5 mt-1 z-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-1 shadow-sm">
                                <textarea
                                  ref={inlineInputRef}
                                  value={inlineInput}
                                  onChange={(e) => {
                                    setInlineInput(e.target.value);
                                    e.target.style.height = 'auto';
                                    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      if (!isInlineLoading) {
                                        sendInlineMessage(m.id);
                                        if (inlineInputRef.current) inlineInputRef.current.style.height = 'auto';
                                      }
                                    }
                                  }}
                                  rows={1}
                                  placeholder="Reply in thread..."
                                  className="flex-1 text-sm bg-transparent py-2 pl-3 pr-1 text-slate-800 dark:text-slate-100 focus:outline-none resize-none"
                                />
                                {isInlineLoading ? (
                                  <button
                                    onClick={stopGeneration}
                                    className="shrink-0 w-8 h-8 bg-slate-500 text-white rounded-full hover:bg-slate-600 transition-all shadow-sm flex items-center justify-center active:scale-95"
                                    title="Stop generating"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                      <rect x="6" y="6" width="12" height="12" rx="2" />
                                    </svg>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      sendInlineMessage(m.id);
                                      if (inlineInputRef.current) inlineInputRef.current.style.height = 'auto';
                                    }}
                                    disabled={!inlineInput.trim()}
                                    className="shrink-0 w-8 h-8 bg-slate-900 dark:bg-[#27272a] text-white rounded-full hover:bg-opacity-90 disabled:opacity-40 transition-all shadow-sm flex items-center justify-center active:scale-95"
                                  >
                                    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                      <line x1="12" y1="19" x2="12" y2="5" />
                                      <polyline points="5 12 12 5 19 12" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </>
            )}
            
            {/* Input Area (Always visible, but disabled if no exam) */}
            <div className="px-3 sm:px-4 pb-4 pt-2 border-t sm:border-t-0 border-neutral-dark/5 dark:border-slate-800 bg-white dark:bg-slate-900 mt-auto">
              <div className={`flex items-end gap-2 max-w-4xl mx-auto bg-neutral-light/30 dark:bg-slate-800/80 border sm:border-2 border-neutral-dark/10 dark:border-slate-700 rounded-3xl p-1.5 sm:p-2 shadow-sm transition-colors ${!selectedExamId ? 'opacity-50' : 'focus-within:border-neutral-dark/30 dark:focus-within:border-slate-500'}`}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={!selectedExamId || isLoading}
                  rows={1}
                  placeholder={!selectedExamId ? "Select an exam to chat..." : `Message ${selectedExam?.subject || 'AI'}...`}
                  className="flex-1 bg-transparent py-2 pl-3 sm:pl-4 pr-1 text-base sm:text-sm text-neutral-dark dark:text-slate-100 focus:outline-none resize-none overflow-y-auto disabled:cursor-not-allowed"
                  style={{ minHeight: '40px', maxHeight: '200px' }}
                />
                <div className="shrink-0 flex items-center justify-center">
                  {isLoading ? (
                    <button
                      onClick={stopGeneration}
                      className="w-10 h-10 bg-slate-600 dark:bg-slate-500 text-white rounded-full hover:bg-slate-700 transition-all shadow-sm flex items-center justify-center active:scale-95"
                      title="Stop generating"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        sendMessage();
                        if (inputRef.current) inputRef.current.style.height = 'auto';
                      }}
                      disabled={!input.trim() || !selectedExamId}
                      className={`w-10 h-10 rounded-full transition-all shadow-sm flex items-center justify-center active:scale-95 ${
                        input.trim() && selectedExamId
                          ? 'bg-slate-900 dark:bg-[#27272a] text-white hover:bg-opacity-90 shadow-md'
                          : 'bg-slate-200 dark:bg-slate-700/60 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                      }`}
                      title="Send message"
                    >
                      <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="19" x2="12" y2="5" />
                        <polyline points="5 12 12 5 19 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              <div className="text-center mt-2 hidden sm:block">
                <span className="text-[11px] text-neutral-dark/40 dark:text-slate-500">
                  AI can make mistakes. Consider verifying important information.
                </span>
              </div>
            </div>
          </div>
  
          {/* Source Material Viewer */}
          {showMaterial && (
            <div className="w-full md:w-1/2 flex flex-col bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-neutral-dark/10 dark:border-slate-700 overflow-hidden animate-in slide-in-from-right-8 duration-300">
              <div className="px-4 py-2.5 border-b border-neutral-dark/5 dark:border-slate-700 flex justify-between items-center bg-neutral-light/30 dark:bg-slate-800/50">
                <h3 className="font-bold text-base text-neutral-dark dark:text-slate-200">Source Material</h3>
                <button 
                  onClick={toggleMaterial}
                  className="p-1.5 hover:bg-neutral-dark/10 dark:hover:bg-slate-700 rounded-full transition-colors text-neutral-dark/60 dark:text-slate-400"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 bg-neutral-light/10 dark:bg-slate-900/50">
                {!selectedExamData?.data?.rawMaterialText ? (
                  <div className="h-full flex items-center justify-center text-neutral-dark/40 dark:text-slate-500 italic">
                    No source material available for this exam.
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none prose-neutral">
                    <div className="sticky top-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur pb-2 mb-4 border-b border-neutral-dark/10 dark:border-slate-700 z-10">
                      <h4 className="m-0 text-primary dark:text-blue-400 font-semibold">
                        {selectedExamData?.data?.originalFileName || 'Study Document'}
                      </h4>
                    </div>
                    <pre className="whitespace-pre-wrap font-sans text-sm text-neutral-dark/80 dark:text-slate-300 bg-white dark:bg-slate-800 p-6 rounded-xl border border-neutral-dark/5 dark:border-slate-700 shadow-sm">
                      {selectedExamData.data.rawMaterialText}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
  );
}
