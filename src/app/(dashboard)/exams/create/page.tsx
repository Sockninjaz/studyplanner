'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { mutate } from 'swr';
import { isValidCalendarDate } from '@/lib/dateUtils';

interface UserPreferences {
  daily_study_limit: number;
  soft_daily_limit: number;
  adjustment_percentage: number;
  session_duration: number;
  enable_daily_limits: boolean;
}

function CreateExamContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialDate = searchParams.get('date');
  const editId = searchParams.get('edit');

  const getDefaultDate = () => {
    if (initialDate) return initialDate;
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
  };

  const [subject, setSubject] = useState('');
  const [date, setDate] = useState(getDefaultDate());
  const [difficulty, setDifficulty] = useState<number>(3);

  const [userPreferences, setUserPreferences] = useState<UserPreferences>({
    daily_study_limit: 4,
    soft_daily_limit: 2,
    adjustment_percentage: 25,
    session_duration: 30,
    enable_daily_limits: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [overloadWarning, setOverloadWarning] = useState<any | null>(null);
  const [isDeletingExam, setIsDeletingExam] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [rawTextInput, setRawTextInput] = useState('');
  const [bookTitle, setBookTitle] = useState('');
  const [bookEdition, setBookEdition] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [rawMaterialText, setRawMaterialText] = useState<string>('');
  
  const [localChapters, setLocalChapters] = useState<any[]>([]);
  const [newChapterName, setNewChapterName] = useState('');
  const [adjustedTotalHours, setAdjustedTotalHours] = useState<number | null>(null);
  const [chapterWeights, setChapterWeights] = useState<number[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    fetchUserPreferences();
    if (editId) fetchExistingExam(editId);
  }, [editId]);

  const fetchExistingExam = async (id: string) => {
    try {
      const res = await fetch(`/api/exams/${id}`);
      if (res.ok) {
        const { data } = await res.json();
        setSubject(data.subject);
        setDate(new Date(data.date).toISOString().split('T')[0]);
        if (data.rawMaterialText) {
          setRawMaterialText(data.rawMaterialText);
          
          let text = data.rawMaterialText;
          let parsedBookTitle = '';
          let parsedBookEdition = '';

          const lines = text.split('\n');
          const remainingLines: string[] = [];
          for (const line of lines) {
            if (line.startsWith('Book: ')) {
              parsedBookTitle = line.replace('Book: ', '').trim();
            } else if (line.startsWith('Edition/Level: ')) {
              parsedBookEdition = line.replace('Edition/Level: ', '').trim();
            } else {
              remainingLines.push(line);
            }
          }

          if (parsedBookTitle) setBookTitle(parsedBookTitle);
          if (parsedBookEdition) setBookEdition(parsedBookEdition);
          setRawTextInput(remainingLines.join('\n').trim());
        }
        // Reconstruct analysis object so they can edit
        const totalEstimated = data.studyMaterials.reduce((s: number, m: any) => s + (m.user_estimated_total_hours || 0), 0);
        const analysis = {
          chapters: data.studyMaterials,
          totalEstimatedHours: totalEstimated,
        };
        setAiAnalysis(analysis);
        setAdjustedTotalHours(totalEstimated);
        initWeights(analysis);
        setDifficulty(3); // Keep it at 3 (Medium) so it doesn't skew further on edit unless they change it
      }
    } catch (error) {
      console.error('Failed to load existing exam:', error);
    }
  };

  const fetchUserPreferences = async () => {
    try {
      const savedPrefs = localStorage.getItem('userPreferences');
      if (savedPrefs) {
        setUserPreferences(JSON.parse(savedPrefs));
      }
      const res = await fetch('/api/user/preferences');
      if (res.ok) {
        const data = await res.json();
        const serverPrefs = {
          daily_study_limit: data.daily_study_limit || 4,
          soft_daily_limit: data.soft_daily_limit || 2,
          adjustment_percentage: data.adjustment_percentage || 25,
          session_duration: data.session_duration || 30,
          enable_daily_limits: data.enable_daily_limits !== false,
        };
        setUserPreferences(serverPrefs);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    }
  };

  const roundToHalfHour = (h: number): number => Math.max(0.5, Math.round(h * 2) / 2);

  const getDisplayHours = (idx: number): number => {
    const total = adjustedTotalHours ?? 0;
    const w = chapterWeights[idx] ?? 0;
    return roundToHalfHour(w * total);
  };

  const initWeights = (analysis: any) => {
    const actualSum = analysis.chapters.reduce((sum: number, c: any) => sum + (c.user_estimated_total_hours || 0), 0);
    const weights = actualSum > 0
      ? analysis.chapters.map((c: any) => c.user_estimated_total_hours / actualSum)
      : analysis.chapters.map(() => 1 / analysis.chapters.length);
    setChapterWeights(weights);
    setLocalChapters([...analysis.chapters]);
  };

  const handleAddChapter = () => {
    const name = newChapterName.trim();
    if (!name) return;
    const n = localChapters.length;
    const currentTotal = adjustedTotalHours ?? 1;
    const avgHours = n > 0 ? currentTotal / n : 1;
    let newTotal = currentTotal + avgHours;
    newTotal = roundToHalfHour(newTotal);

    const scaledWeights = chapterWeights.map(w => w * currentTotal / newTotal);
    const newWeight = avgHours / newTotal;
    setChapterWeights([...scaledWeights, newWeight]);
    setAdjustedTotalHours(newTotal);
    setLocalChapters(prev => [...prev, {
      chapter: name,
      difficulty: 3,
      confidence: 3,
      user_estimated_total_hours: avgHours,
    }]);
    setNewChapterName('');
  };

  const handleDeleteChapter = (idx: number) => {
    const newChapters = localChapters.filter((_, i) => i !== idx);
    const newWeights = chapterWeights.filter((_, i) => i !== idx);
    const sum = newWeights.reduce((s, w) => s + w, 0);
    const normalized = sum > 0 ? newWeights.map(w => w / sum) : newWeights.map(() => 1 / newWeights.length);
    const removedHours = getDisplayHours(idx);
    let newTotal = Math.max(1, (adjustedTotalHours ?? 0) - removedHours);
    newTotal = roundToHalfHour(newTotal);
    setAdjustedTotalHours(newTotal);
    setChapterWeights(normalized);
    setLocalChapters(newChapters);
  };

  const handleChapterNameChange = (idx: number, newName: string) => {
    setLocalChapters(prev => prev.map((ch, i) => i === idx ? { ...ch, chapter: newName } : ch));
  };

  const handleGlobalHoursChange = (newTotal: number) => {
    if (newTotal <= 0) return;
    setAdjustedTotalHours(roundToHalfHour(newTotal));
  };

  const handleChapterWeightChange = (idx: number, direction: 1 | -1) => {
    if (chapterWeights.length === 0) return;
    const total = adjustedTotalHours ?? aiAnalysis?.totalEstimatedHours ?? 1;
    if (total <= 0) return;

    const step = 0.5;
    
    // Use actual displayed hours to prevent fractional drifting
    const currentHours = chapterWeights.map((_, i) => getDisplayHours(i));
    
    // Modify target chapter
    const targetOldHours = currentHours[idx];
    const targetNewHours = Math.max(0.5, targetOldHours + direction * step);
    
    currentHours[idx] = targetNewHours;
    
    const newTotal = currentHours.reduce((sum, h) => sum + h, 0);
    const newWeights = currentHours.map(h => h / newTotal);
    
    setAdjustedTotalHours(roundToHalfHour(newTotal));
    setChapterWeights(newWeights);
  };

  const handleFileSelect = (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    console.log('[handleFileSelect] received files:', files);

    const allowedExtensions = [
      'pdf', 'docx', 'doc', 'pptx', 'ppt', 'txt', 'md', 'rtf', 'pages', 'odt', 'epub',
      'html', 'htm', 'json', 'zip', 'png', 'jpg', 'jpeg', 'webp', 'heic', 'bmp', 'gif', 'svg'
    ];
    const newFiles: File[] = [];
    let hasError = false;

    Array.from(files).forEach(file => {
      const hasExtension = file.name.includes('.');
      const ext = hasExtension ? file.name.toLowerCase().split('.').pop() || '' : '';
      const isAllowedExt = hasExtension && allowedExtensions.includes(ext);
      const isAllowedType = file.type === 'application/pdf' || 
        file.type.includes('word') || 
        file.type.includes('officedocument') ||
        file.type.includes('presentation') || 
        file.type.includes('text') || 
        file.type.includes('json') || 
        file.type.includes('zip') || 
        file.type.startsWith('image/');
      
      if (isAllowedExt || isAllowedType || (!hasExtension && !file.type)) {
        newFiles.push(file);
      } else {
        hasError = true;
      }
    });

    if (hasError) {
      setAiError(`Some files were unsupported. Supported formats: .pdf, .docx, .pptx, .txt, .md, .png, .jpg, .jpeg, .webp, .pages, .rtf`);
    } else {
      setAiError(null);
    }
    
    if (newFiles.length > 0) {
      setUploadedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (idx: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleDifficultyChange = (newDifficulty: number) => {
    setDifficulty(newDifficulty);
    if (aiAnalysis) {
      const actualSum = aiAnalysis.chapters.reduce((sum: number, c: any) => sum + (c.user_estimated_total_hours || 0), 0);
      let base = actualSum > 0 ? actualSum : aiAnalysis.totalEstimatedHours;
      const multiplier = 1 + (newDifficulty - 3) * 0.125;
      base *= multiplier;
      setAdjustedTotalHours(roundToHalfHour(base));
    }
  };

  const handleAnalyze = async () => {
    const hasFiles = uploadedFiles.length > 0;
    const hasText = rawTextInput.trim().length > 0 || bookTitle.trim().length > 0 || bookEdition.trim().length > 0;
    if (!hasFiles && !hasText) {
      setAiError('Please drop or select at least one syllabus file/screenshot, or enter your book / chapter details.');
      return;
    }

    setAiError(null);
    setIsAnalyzing(true);
    setAiAnalysis(null);
    setAdjustedTotalHours(null);

    try {
      const formData = new FormData();
      uploadedFiles.forEach(f => formData.append('files', f));
      
      if (rawTextInput || bookTitle || bookEdition) {
        const combinedText = [
          bookTitle ? `Book: ${bookTitle}` : '',
          bookEdition ? `Edition/Level: ${bookEdition}` : '',
          rawTextInput
        ].filter(Boolean).join('\n');
        
        if (uploadedFiles.length > 0) formData.append('specialInstructions', combinedText.trim());
        else formData.append('rawText', combinedText);
      }
      formData.append('subjectName', subject || 'Unknown Subject');
      formData.append('examDate', date);
      formData.append('difficulty', difficulty.toString());

      const res = await fetch('/api/analyze-material', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to analyze file');

      setAiAnalysis(data.analysis);
      setRawMaterialText(data.rawText || '');
      
      const actualSum = data.analysis.chapters.reduce((sum: number, c: any) => sum + (c.user_estimated_total_hours || 0), 0);
      let base = actualSum > 0 ? actualSum : data.analysis.totalEstimatedHours;
      const multiplier = 1 + (difficulty - 3) * 0.125;
      base *= multiplier;
      
      setAdjustedTotalHours(roundToHalfHour(base));
      initWeights(data.analysis);
    } catch (error: any) {
      setAiError(error.message || 'Failed to analyze material');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const finishAndRedirect = () => {
    mutate('/api/exams');
    mutate('/api/calendar/events'); // Global mutation to clear SWR cache before navigation
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('calendarUpdated'));
    router.push('/calendar');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !date) return alert('Please fill out all required fields.');
    if (!aiAnalysis) return alert('Please analyze your material first.');
    if (!isValidCalendarDate(date)) return alert('Invalid date selected.');

    setIsSubmitting(true);
    try {
      const total = adjustedTotalHours ?? aiAnalysis.totalEstimatedHours;

      const rawHours = localChapters.map((_ch: any, idx: number) => {
        return roundToHalfHour((chapterWeights[idx] ?? (1 / localChapters.length)) * total);
      });

      const finalChapters = localChapters.map((ch: any, idx: number) => ({
        ...ch,
        user_estimated_total_hours: rawHours[idx]
      }));

      const endpoint = editId ? `/api/exams/${editId}` : '/api/exams';
      const method = editId ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          date,
          daily_max_hours: userPreferences.daily_study_limit,
          adjustment_percentage: userPreferences.adjustment_percentage,
          session_duration: userPreferences.session_duration,
          enable_daily_limits: userPreferences.enable_daily_limits,
          originalFileName: uploadedFiles.length > 0 ? uploadedFiles.map(f => f.name).join(', ') : undefined,
          studyMaterials: finalChapters,
          rawMaterialText,
        }),
      });

      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || 'Failed to create exam');

      if (responseData.data?.requiresDecision) {
        setOverloadWarning({
          examId: responseData.data.exam._id,
          overloadedDays: responseData.data.overloadedDays,
        });
        return;
      }
      finishAndRedirect();
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to create exam'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExam = async () => {
    if (!overloadWarning?.examId) return;
    setIsDeletingExam(true);
    try {
      const res = await fetch(`/api/exams/${overloadWarning.examId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete exam');
      mutate('/api/exams');
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('calendarUpdated'));
      setOverloadWarning(null);
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to delete'}`);
    } finally {
      setIsDeletingExam(false);
    }
  };

  const submitRegenerateAction = async (action: 'compress' | 'allowOverload') => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/calendar/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, examId: overloadWarning?.examId || editId }),
      });
      if (!res.ok) throw new Error('Failed to apply decision');
      finishAndRedirect();
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full overflow-hidden bg-slate-50 dark:bg-slate-900 p-4 sm:p-6 flex flex-col">
      <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col min-h-0">
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 flex-1 flex flex-col min-h-0 overflow-hidden">
          <form id="exam-form" onSubmit={handleSubmit} className="flex flex-col h-full min-h-0">
            <div className="flex-1 overflow-y-auto p-4 md:p-6 min-h-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 h-full">
                {/* Basics Section */}
                <section className="space-y-4 flex flex-col">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700 pb-2 shrink-0">{editId ? 'Edit Exam' : 'Create New Exam'}</h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="subject" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Subject Name</label>
                      <input
                        type="text"
                        id="subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm text-sm"
                        placeholder="e.g. Organic Chemistry"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="date" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Exam Date</label>
                      <input
                        type="date"
                        id="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm text-sm"
                        required
                      />
                    </div>
                  </div>

                  {/* Difficulty Slider */}
                  <div className="pt-2">
                    <div className="flex justify-between items-center mb-2">
                      <label htmlFor="difficulty" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Expected Difficulty</label>
                      <span className="text-xs font-bold px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-md text-slate-700 dark:text-slate-300">
                        {difficulty === 1 ? 'Easiest' : difficulty === 2 ? 'Easy' : difficulty === 3 ? 'Medium' : difficulty === 4 ? 'Hard' : 'Hardest'}
                      </span>
                    </div>
                    <input
                      type="range"
                      id="difficulty"
                      min="1"
                      max="5"
                      step="1"
                      value={difficulty}
                      onChange={(e) => handleDifficultyChange(parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-indigo-600"
                    />
                    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">
                      <span>1 (Easiest)</span>
                      <span>5 (Hardest)</span>
                    </div>
                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 italic">
                      * This scales the AI's time estimation up or down depending on difficulty.
                    </p>
                  </div>
                </section>

                {/* Material Section */}
                <section className="space-y-4 flex flex-col h-full min-h-0">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700 pb-2 shrink-0">2. Syllabus & Material</h2>
                  
                  <div className="flex-1 min-h-0 flex flex-col">
                    {!aiAnalysis && !isAnalyzing ? (
                      <div className="flex flex-col h-full">
                        <div 
                          className={`relative rounded-2xl border-2 border-dashed transition-all p-3 flex flex-col min-h-[140px] overflow-hidden ${
                            isDragging 
                              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-inner' 
                              : 'border-slate-300 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-800/40 hover:border-indigo-400 hover:bg-slate-100/60 dark:hover:bg-slate-800'
                          } ${uploadedFiles.length === 0 ? 'items-center justify-center flex-1' : ''}`}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDragging(false);
                            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                              handleFileSelect(e.dataTransfer.files);
                            }
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDragging(true);
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDragging(false);
                          }}
                        >
                          {uploadedFiles.length === 0 && (
                            <input
                              id="exam-material-file-input"
                              ref={fileInputRef}
                              type="file"
                              multiple
                              accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.md,.rtf,.pages,.odt,.epub,.json,.zip,.png,.jpg,.jpeg,.webp,.heic,.bmp,.gif,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/*"
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                              onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                  handleFileSelect(e.target.files);
                                }
                                e.target.value = '';
                              }}
                            />
                          )}

                          {uploadedFiles.length > 0 ? (
                            <div className="w-full flex flex-col gap-2 relative z-20">
                              <div className="w-full flex flex-col gap-1.5 overflow-y-auto max-h-36 pr-0.5">
                                {uploadedFiles.map((f, i) => (
                                  <div key={i} className="bg-white dark:bg-slate-700/90 rounded-lg px-2.5 py-1.5 flex items-center gap-2 shadow-xs border border-slate-200 dark:border-slate-600 w-full shrink-0">
                                    <div className="bg-indigo-100 dark:bg-indigo-900/40 p-1 rounded text-indigo-600 dark:text-indigo-400 shrink-0">
                                      {f.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'heic', 'bmp', 'gif', 'svg'].some(ext => f.name.toLowerCase().endsWith(`.${ext}`)) ? (
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                      ) : (
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                      )}
                                    </div>
                                    <span className="flex-1 font-medium text-xs text-slate-800 dark:text-slate-200 truncate" title={f.name}>
                                      {f.name}
                                    </span>
                                    <span className="text-[10px] text-slate-400 shrink-0">
                                      {f.size > 1024 * 1024 ? `${(f.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(f.size / 1024))} KB`}
                                    </span>
                                    <button 
                                      type="button" 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeFile(i);
                                      }} 
                                      title="Remove file"
                                      className="text-slate-400 hover:text-red-500 transition-colors p-0.5 rounded cursor-pointer"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                  </div>
                                ))}
                              </div>
                              <label
                                className="cursor-pointer relative overflow-hidden py-2 px-3 flex items-center justify-center gap-1.5 bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 hover:border-indigo-500 dark:hover:border-indigo-400 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-indigo-50/50 dark:hover:bg-slate-700 transition-colors w-full shrink-0 shadow-xs font-medium text-xs"
                              >
                                <input
                                  type="file"
                                  multiple
                                  accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.md,.rtf,.pages,.odt,.epub,.json,.zip,.png,.jpg,.jpeg,.webp,.heic,.bmp,.gif,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/*"
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  onChange={(e) => {
                                    if (e.target.files && e.target.files.length > 0) {
                                      handleFileSelect(e.target.files);
                                    }
                                    e.target.value = '';
                                  }}
                                />
                                <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                <span>Add more files or drop here</span>
                              </label>
                            </div>
                          ) : (
                            <div className="text-center py-4 space-y-2.5 w-full pointer-events-none">
                              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto transition-transform group-hover:scale-105">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                              </div>
                              <div>
                                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">Click to browse or drag & drop files here</p>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Supports screenshots, images, PDFs, Word, PPT, Text</p>
                              </div>
                              <div className="pt-0.5">
                                <span
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg shadow-xs hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors font-semibold text-xs cursor-pointer"
                                >
                                  Browse Files
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="w-full mt-4 space-y-3 shrink-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                              <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                              Using a textbook?
                            </p>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Method / Book Title</label>
                              <input
                                type="text"
                                value={bookTitle}
                                onChange={(e) => setBookTitle(e.target.value)}
                                placeholder="e.g. Campbell Biology"
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-white shadow-sm text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Edition & Level (Important!)</label>
                              <input
                                type="text"
                                value={bookEdition}
                                onChange={(e) => setBookEdition(e.target.value)}
                                placeholder="e.g. 7th edition AP"
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-white shadow-sm text-sm"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Which chapters or topics?</label>
                            <textarea
                              value={rawTextInput}
                              onChange={(e) => setRawTextInput(e.target.value)}
                              placeholder="e.g. Chapter 1 to 4, or paste your entire syllabus here..."
                              className="w-full h-16 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-white shadow-sm text-sm"
                            />
                          </div>
                        </div>

                        <button 
                          type="button" 
                          onClick={handleAnalyze}
                          disabled={isAnalyzing}
                          className="mt-3 w-full bg-indigo-600 text-slate-900 py-2.5 px-4 rounded-xl font-bold shadow-md hover:bg-indigo-700 hover:shadow-lg disabled:opacity-50 transition-all shrink-0 text-sm flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isAnalyzing ? (
                            <>
                              <svg className="w-4 h-4 animate-spin text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                              <span>Analyzing Material with AI...</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                              <span>Analyze Material</span>
                            </>
                          )}
                        </button>

                        {aiError && (
                          <div className="mt-2.5 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2.5 text-red-700 dark:text-red-300 text-xs shrink-0 animate-in fade-in">
                            <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <div className="flex-1 font-medium leading-relaxed">{aiError}</div>
                            <button type="button" onClick={() => setAiError(null)} className="text-red-400 hover:text-red-600 transition-colors p-0.5">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        )}
                      </div>
                    ) : isAnalyzing ? (
                      <div className="flex-1 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/30 flex flex-col items-center justify-center gap-4 min-h-[150px]">
                        <div className="relative w-10 h-10">
                          <div className="absolute inset-0 border-4 border-indigo-200 dark:border-indigo-900 rounded-full"></div>
                          <div className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                        <div className="text-center px-4">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">AI is building your study plan...</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Parsing chunks, estimating hours...</p>
                        </div>
                      </div>
                    ) : aiAnalysis && (
                  <div className="flex-1 flex flex-col border-2 border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-900/10 rounded-2xl p-3 shadow-sm space-y-3 min-h-0">
                  <div className="flex items-start justify-between border-b border-green-200 dark:border-green-800/50 pb-2 shrink-0">
                    <div>
                      <h3 className="text-base font-bold text-green-800 dark:text-green-400 flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Analysis Complete
                      </h3>
                      <p className="text-xs text-green-700 dark:text-green-500 mt-0.5">Review and tweak recommendations.</p>
                    </div>
                    <button type="button" onClick={() => setAiAnalysis(null)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800/50 px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      Edit Material
                    </button>
                  </div>

                  <div className="bg-white dark:bg-slate-800 rounded-xl p-2.5 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between shrink-0">
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Total Study Hours</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {difficulty !== 3 && <span className="text-indigo-500 font-semibold mr-1">Adjusted.</span>}
                        Base AI suggestion: {aiAnalysis.totalEstimatedHours}h
                      </p>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                      <input
                        type="number"
                        value={adjustedTotalHours || 0}
                        onChange={(e) => handleGlobalHoursChange(parseFloat(e.target.value) || 0)}
                        className="w-16 px-1 py-0.5 text-lg font-extrabold text-indigo-600 dark:text-indigo-400 bg-transparent border-none focus:ring-0 text-center"
                        min="1"
                        step="0.5"
                      />
                      <span className="text-slate-500 font-bold pr-1 text-sm">hrs</span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2 space-y-2 max-h-[40vh]">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Chapter Breakdown</p>
                    <div className="grid gap-1.5">
                      {localChapters.map((ch: any, idx: number) => {
                        const displayHours = getDisplayHours(idx);
                        return (
                          <div key={idx} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 flex items-center gap-1.5 shadow-sm hover:border-indigo-300 transition-colors">
                            <input
                              type="text"
                              value={ch.chapter}
                              onChange={(e) => handleChapterNameChange(idx, e.target.value)}
                              className="flex-1 font-semibold text-xs text-slate-800 dark:text-slate-200 bg-transparent border-none focus:ring-2 focus:ring-indigo-500 rounded px-1.5 py-0.5 min-w-0"
                            />
                            <div className="flex items-center gap-1 shrink-0 bg-slate-50 dark:bg-slate-900 rounded-md p-0.5 border border-slate-100 dark:border-slate-700">
                              <button type="button" onClick={() => handleChapterWeightChange(idx, -1)} className="w-5 h-5 rounded hover:bg-white dark:hover:bg-slate-700 shadow-sm flex items-center justify-center font-bold text-slate-500 text-xs">-</button>
                              <span className="w-8 text-center font-bold text-slate-700 dark:text-slate-300 text-xs">{displayHours}h</span>
                              <button type="button" onClick={() => handleChapterWeightChange(idx, 1)} className="w-5 h-5 rounded hover:bg-white dark:hover:bg-slate-700 shadow-sm flex items-center justify-center font-bold text-slate-500 text-xs">+</button>
                            </div>
                            <button type="button" onClick={() => handleDeleteChapter(idx)} className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors shrink-0">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="text"
                        value={newChapterName}
                        onChange={(e) => setNewChapterName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddChapter(); } }}
                        placeholder="Add missing material manually..."
                        className="flex-1 text-xs px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                      />
                      <button
                        type="button"
                        onClick={handleAddChapter}
                        disabled={!newChapterName.trim()}
                        className="px-3 py-1.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 font-bold text-xs rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 disabled:opacity-50 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}
                  </div>
                </section>
              </div>
            </div>

            {/* Submit */}
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 shrink-0">
              <button type="button" onClick={() => router.push('/calendar')} className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-sm">
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting || !aiAnalysis} className="px-5 py-2 bg-indigo-600 text-slate-900 font-bold rounded-xl shadow-md hover:bg-indigo-700 hover:shadow-lg disabled:opacity-50 disabled:shadow-none transition-all flex items-center gap-2 text-sm">
                {isSubmitting ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> Saving...</>
                ) : (editId ? 'Save Exam' : 'Create Study Plan')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {overloadWarning && overloadWarning.overloadedDays && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Schedule Overload Warning</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                Your remaining study material is too dense to fit into your available days without exceeding your daily maximum limit. How would you like to handle the overflow?
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={() => submitRegenerateAction('compress')}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors text-left"
                >
                  <div>
                    <div className="font-bold">Compress Chapters to Fit</div>
                    <div className="text-xs mt-1 opacity-80">Sessions over your daily limit are merged into combined topics (e.g. "Chapter 5 &amp; Chapter 6") at the cost of less in-depth coverage.</div>
                  </div>
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>

                <button
                  onClick={() => submitRegenerateAction('allowOverload')}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
                >
                  <div>
                    <div className="font-bold">Keep All Sessions</div>
                    <div className="text-xs mt-1 opacity-80">Place all sessions anyway, allowing your schedule to exceed the daily limit.</div>
                  </div>
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                onClick={handleDeleteExam}
                disabled={isDeletingExam || isSubmitting}
                className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              >
                {isDeletingExam ? 'Undoing...' : 'Undo Exam Creation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CreateExamPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <CreateExamContent />
    </Suspense>
  );
}
