'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';

interface Exam {
  _id: string;
  subject: string;
  color?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Track whether the user has manually scrolled up during generation
  const userScrolledUp = useRef(false);

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
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    // If user scrolled more than 100px from the bottom, stop auto-scrolling
    userScrolledUp.current = distanceFromBottom > 100;
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading || !selectedExamId) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    // When the user sends a new message, re-enable auto-scroll
    userScrolledUp.current = false;

    // Add a placeholder assistant message that we'll stream into
    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

    try {
      const allMessages = [...messages, userMessage].map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: allMessages,
          examId: selectedExamId,
          aiIntegration,
        }),
      });

      if (!res.ok) throw new Error('Failed to send message');
      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        assistantText += chunk;
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, content: assistantText } : m)
        );
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: 'Sorry, something went wrong. Please try again.' } : m
        )
      );
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const selectedExam = exams.find((e) => e._id === selectedExamId);

  return (
    <div className="flex flex-col h-screen bg-neutral-light/50 dark:bg-slate-950 p-2 lg:p-4">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row gap-2 mb-2 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl shadow-sm border border-neutral-dark/10 dark:border-slate-700">
        <div className="flex-1">
          <label className="block text-[10px] font-semibold text-neutral-dark/60 dark:text-slate-400 uppercase tracking-wider mb-1">
            Select Exam Context
          </label>
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="w-full bg-neutral-light dark:bg-slate-800 border-none rounded-lg py-1.5 px-3 text-sm text-neutral-dark dark:text-slate-100 font-medium focus:ring-2 focus:ring-primary/20 appearance-none"
          >
            <option value="">-- Choose an Exam --</option>
            {exams.map((exam) => (
              <option key={exam._id} value={exam._id}>
                {exam.subject}
              </option>
            ))}
          </select>
        </div>
          <div className="w-full md:w-64 flex gap-3">
            <div className="flex-1">
              <label className="block text-[10px] font-semibold text-neutral-dark/60 dark:text-slate-400 uppercase tracking-wider mb-1">
                AI Model
              </label>
              <select
                value={aiIntegration}
                onChange={(e) => setAiIntegration(e.target.value)}
                className="w-full bg-neutral-light dark:bg-slate-800 border-none rounded-lg py-1.5 px-3 text-sm text-neutral-dark dark:text-slate-100 font-medium focus:ring-2 focus:ring-primary/20 appearance-none"
              >
                <option value="gpt-4o-mini">OpenAI GPT-4o-mini (Fast)</option>
                <option value="gpt-4o">OpenAI GPT-4o (Smart)</option>
              </select>
            </div>
            {selectedExamId && (
              <div className="flex-none flex items-end">
                <button
                  onClick={() => setShowMaterial(!showMaterial)}
                  className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-all shadow-sm ${
                    showMaterial 
                      ? 'bg-primary text-white hover:bg-primary-dark' 
                      : 'bg-[rgb(54,65,86)] text-white hover:bg-opacity-90'
                  }`}
                >
                  {showMaterial ? 'Hide Material' : '📖 View Source'}
                </button>
              </div>
            )}
          </div>
        </div>
  
        {/* Main Workspace (Split Screen container) */}
        <div className="flex-1 flex gap-4 overflow-hidden">
          
          {/* Chat Area */}
          <div className={`flex flex-col bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-neutral-dark/10 dark:border-slate-700 overflow-hidden transition-all duration-300 ${
            showMaterial ? 'w-full lg:w-1/2 hidden lg:flex' : 'w-full'
          }`}>
            {!selectedExamId ? (
              <div className="flex-1 flex items-center justify-center flex-col text-neutral-dark/40 dark:text-slate-500">
                <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="font-medium text-lg">Select an exam to start chatting</p>
                <p className="text-sm mt-1">The AI will use your uploaded materials as context.</p>
              </div>
            ) : (
              <>
                {/* Messages List */}
                <div ref={messagesContainerRef} onScroll={handleMessagesScroll} className="flex-1 overflow-y-auto p-4 space-y-4">
                  {isFetchingHistory ? (
                    <div className="flex justify-center py-8">
                      <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto opacity-60">
                      <div
                        className="w-10 h-10 rounded-full mb-3 opacity-80"
                        style={{ backgroundColor: selectedExam?.color || 'rgb(54, 65, 86)' }}
                      />
                      <p className="text-base font-medium text-neutral-dark dark:text-slate-200">Ask about {selectedExam?.subject}</p>
                      <p className="text-xs text-neutral-dark dark:text-slate-400 mt-1">
                        I can help you understand concepts, quiz you on the material, or summarize key chapters.
                      </p>
                    </div>
                  ) : (
                    messages.map((m) => (
                      <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[85%] rounded-xl px-4 py-2 shadow-sm ${
                            m.role === 'user'
                              ? 'bg-[rgb(54,65,86)] text-white rounded-br-none'
                              : 'bg-neutral-light dark:bg-slate-800 text-neutral-dark dark:text-slate-200 rounded-bl-none border border-neutral-dark/5 dark:border-slate-700'
                          }`}
                        >
                          {m.content === '' && m.role === 'assistant' ? (
                            <div className="flex gap-1">
                              <div className="w-2 h-2 bg-neutral-dark/40 rounded-full animate-bounce" />
                              <div className="w-2 h-2 bg-neutral-dark/40 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                              <div className="w-2 h-2 bg-neutral-dark/40 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                            </div>
                          ) : (
                            <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
  
                {/* Input Area */}
                <div className="p-3 bg-white dark:bg-slate-900 border-t border-neutral-dark/5 dark:border-slate-700">
                  <div className="relative flex items-center">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={`Ask a question about ${selectedExam?.subject || 'your exam'}...`}
                      className="w-full bg-neutral-light/50 dark:bg-slate-800 border-2 border-neutral-dark/10 dark:border-slate-700 rounded-full py-2.5 pl-4 pr-12 text-sm text-neutral-dark dark:text-slate-100 focus:outline-none focus:border-primary/50 focus:bg-white dark:focus:bg-slate-700 transition-all shadow-sm"
                      disabled={isLoading}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!input.trim() || isLoading}
                      className="absolute right-1.5 p-1.5 bg-[rgb(54,65,86)] text-white rounded-full hover:bg-opacity-90 disabled:opacity-50 transition-all shadow-md"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
  
          {/* Source Material Viewer */}
          {showMaterial && (
            <div className="w-full lg:w-1/2 flex flex-col bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-neutral-dark/10 dark:border-slate-700 overflow-hidden animate-in slide-in-from-right-8 duration-300">
              <div className="px-4 py-2.5 border-b border-neutral-dark/5 dark:border-slate-700 flex justify-between items-center bg-neutral-light/30 dark:bg-slate-800/50">
                <h3 className="font-bold text-base text-neutral-dark dark:text-slate-200">Source Material</h3>
                <button 
                  onClick={() => setShowMaterial(false)}
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
