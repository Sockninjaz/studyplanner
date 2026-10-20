'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { mutate } from 'swr';
import { isValidCalendarDate } from '@/lib/dateUtils';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { stripPromptArtifacts } from '@/lib/ai/textSanitizer';

interface UserPreferences {
  daily_study_limit: number;
  soft_daily_limit: number;
  adjustment_percentage: number;
  session_duration: number;
  enable_daily_limits: boolean;
}

function CreateExamContent() {
  const { t, locale } = useLanguage();
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
  const [textbook, setTextbook] = useState('');
  const [savedTextbooks, setSavedTextbooks] = useState<Array<{ subject: string; textbook: string }>>([]);
  const [isTextbookAutoSaved, setIsTextbookAutoSaved] = useState(false);

  const COMMON_TEXTBOOKS = [
    'Pulsar Natuurkunde',
    'Systematische Natuurkunde',
    'Nova Natuurkunde',
    'Overal Natuurkunde',
    'Stevin Natuurkunde',
    'Chemie Overal',
    'Nova Scheikunde',
    'Chemie (Malmberg)',
    'Biologie voor Jou (BVJ)',
    'Nectar Biologie',
    '10voorBiologie',
    'Getal & Ruimte',
    'Moderne Wiskunde',
    'Feniks Geschiedenis',
    'Geschiedenis Werkplaats',
    'Memo Geschiedenis',
    'Campbell Biology',
    'Polaris',
    'Binas Informatieboek',
  ];

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

  // Stepper state for mobile & iPad (< xl)
  const [step, setStep] = useState(1);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mobileFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [rawTextInput, setRawTextInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [rawMaterialText, setRawMaterialText] = useState<string>('');
  
  const [localChapters, setLocalChapters] = useState<any[]>([]);
  const [newChapterName, setNewChapterName] = useState('');
  const [adjustedTotalHours, setAdjustedTotalHours] = useState<number | null>(null);
  const [chapterWeights, setChapterWeights] = useState<number[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Remembers the extracted document text across "Edit Material" cycles so the file is never re-parsed
  const [cachedFileText, setCachedFileText] = useState<{
    signature: string;
    text: string;
    fileNames: string;
  } | null>(null);

  // Instant cache if the user clicks "Edit Material" and clicks "Analyze Material" with identical inputs (0ms, 0 tokens)
  const lastAnalysisCacheRef = useRef<{
    cacheKey: string;
    analysis: any;
    rawText: string;
    adjustedTotalHours: number | null;
  } | null>(null);

  useEffect(() => {
    fetchUserPreferences();
    fetchSavedTextbooks();
    if (editId) fetchExistingExam(editId);
  }, [editId]);

  const fetchSavedTextbooks = async () => {
    try {
      const res = await fetch('/api/user/textbooks');
      if (res.ok) {
        const data = await res.json();
        setSavedTextbooks(data.textbooks || []);
      }
    } catch (e) {
      console.error('Failed to load saved textbooks:', e);
    }
  };

  // Auto-populate textbook when subject matches a saved book
  useEffect(() => {
    if (!subject.trim()) return;
    const match = savedTextbooks.find(
      st => st.subject.toLowerCase() === subject.trim().toLowerCase()
    );
    if (match) {
      setTextbook(match.textbook);
      setIsTextbookAutoSaved(true);
    }
  }, [subject, savedTextbooks]);

  const fetchExistingExam = async (id: string) => {
    try {
      const res = await fetch(`/api/exams/${id}`);
      if (res.ok) {
        const { data } = await res.json();
        setSubject(data.subject);
        setDate(new Date(data.date).toISOString().split('T')[0]);
        if (data.rawMaterialText) {
          const cleanedText = stripPromptArtifacts(data.rawMaterialText);
          setRawMaterialText(cleanedText);
          if (data.userInputNotes) {
            setRawTextInput(stripPromptArtifacts(data.userInputNotes));
          } else if (!data.originalFileName) {
            setRawTextInput(cleanedText);
          } else {
            setRawTextInput('');
          }
          setStep(3);
        } else if (data.userInputNotes) {
          setRawTextInput(stripPromptArtifacts(data.userInputNotes));
          setStep(3);
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

function cleanChapterDisplay(name: string): string {
  if (!name) return '';
  let cleaned = name.trim();
  const bookPrefixMatch = cleaned.match(/^(.+?)\s+((?:H\s*\d+[a-z]?|HK|Chapter\s*\d+|Ch\s*\d+|Thema\s*\d+|Domein\s*[A-Z0-9]+)\s*[:.-]\s*)(.+)$/i);
  if (bookPrefixMatch) {
    const rawBook = bookPrefixMatch[1].trim();
    const chTag = bookPrefixMatch[2].trim();
    const topic = bookPrefixMatch[3].trim();
    const lower = rawBook.toLowerCase();
    let simplifiedBook = rawBook
      .replace(/\s*\b\d+e\s+editie\b/gi, '')
      .replace(/\s*\b(?:vwo|havo|vmbo)\s*\d*\b/gi, '')
      .replace(/\s*\b(?:12e|11e|10e|9e|8e|7e|6e|5e|4e|3e|2e|1e)\b/gi, '')
      .trim();
    if (lower.includes('getal')) simplifiedBook = 'Getal en Ruimte';
    else if (lower.includes('pulsar')) simplifiedBook = 'Pulsar';
    else if (lower.includes('polaris')) simplifiedBook = 'Polaris';
    else if (lower.includes('nova')) simplifiedBook = 'Nova';
    else if (lower.includes('biologie voor jou')) simplifiedBook = 'Biologie voor Jou';
    else if (lower.includes('chemie overal')) simplifiedBook = 'Chemie Overal';

    return simplifiedBook ? `${chTag} ${topic}. ${simplifiedBook}` : `${chTag} ${topic}`;
  }
  return cleaned;
}

  const initWeights = (analysis: any) => {
    const actualSum = analysis.chapters.reduce((sum: number, c: any) => sum + (c.user_estimated_total_hours || 0), 0);
    const weights = actualSum > 0
      ? analysis.chapters.map((c: any) => c.user_estimated_total_hours / actualSum)
      : analysis.chapters.map(() => 1 / analysis.chapters.length);
    setChapterWeights(weights);
    setLocalChapters(analysis.chapters.map((c: any) => ({
      ...c,
      chapter: cleanChapterDisplay(c.chapter),
    })));
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

    const stepSize = 0.5;
    
    // Use actual displayed hours to prevent fractional drifting
    const currentHours = chapterWeights.map((_, i) => getDisplayHours(i));
    
    // Modify target chapter
    const targetOldHours = currentHours[idx];
    const targetNewHours = Math.max(0.5, targetOldHours + direction * stepSize);
    
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
    const hasText = rawTextInput.trim().length > 0;
    if (!hasFiles && !hasText) {
      setAiError('Please drop or select at least one syllabus file/screenshot, or enter what you need to study.');
      return;
    }

    const fileSig = uploadedFiles.map(f => `${f.name}_${f.size}_${f.lastModified}`).join(';');
    const currentInputKey = `${subject.trim()}_${date}_${difficulty}_${textbook.trim()}_${rawTextInput.trim()}_${fileSig}`;

    // 1. Instant Cache: If exact same inputs analyzed again (e.g. user went to Edit Material and back without changing anything)
    if (lastAnalysisCacheRef.current && lastAnalysisCacheRef.current.cacheKey === currentInputKey) {
      console.log('[handleAnalyze] Restoring identical analysis result from memory (0ms, 0 tokens)');
      setAiAnalysis(lastAnalysisCacheRef.current.analysis);
      setRawMaterialText(lastAnalysisCacheRef.current.rawText);
      setAdjustedTotalHours(lastAnalysisCacheRef.current.adjustedTotalHours);
      initWeights(lastAnalysisCacheRef.current.analysis);
      setStep(3);
      setIsAnalyzing(false);
      return;
    }

    setAiError(null);
    setIsAnalyzing(true);
    setAiAnalysis(null);
    setAdjustedTotalHours(null);

    try {
      const formData = new FormData();
      
      // 2. Remembered Document Text: If files are unchanged, send remembered text so server skips re-reading the PDF
      const canUseCachedFileText = Boolean(
        cachedFileText && 
        cachedFileText.signature === fileSig && 
        cachedFileText.text.length > 0
      );

      if (canUseCachedFileText) {
        console.log('[handleAnalyze] Reusing remembered syllabus text — skipped re-uploading and re-parsing file');
        formData.append('cachedExtractedText', cachedFileText!.text);
        formData.append('fileNames', cachedFileText!.fileNames);
      } else {
        uploadedFiles.forEach(f => formData.append('files', f));
      }
      
      if (rawTextInput.trim()) {
        if (uploadedFiles.length > 0 || canUseCachedFileText) formData.append('specialInstructions', rawTextInput.trim());
        else formData.append('rawText', rawTextInput.trim());
      }
      formData.append('subjectName', subject || 'Unknown Subject');
      formData.append('examDate', date);
      formData.append('difficulty', difficulty.toString());
      if (textbook.trim()) {
        formData.append('textbookName', textbook.trim());
      }

      const res = await fetch('/api/analyze-material', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to analyze file');

      if (data.textbookUsed) {
        setTextbook(data.textbookUsed);
        setIsTextbookAutoSaved(true);
        fetchSavedTextbooks();
      }

      // Remember extracted document text so subsequent tweaks to chapters/topics never re-read the PDF
      if (data.extractedFileText && uploadedFiles.length > 0) {
        setCachedFileText({
          signature: fileSig,
          text: data.extractedFileText,
          fileNames: uploadedFiles.map(f => f.name).join(', '),
        });
      }

      setAiAnalysis(data.analysis);
      setRawMaterialText(stripPromptArtifacts(data.rawText || ''));
      
      const actualSum = data.analysis.chapters.reduce((sum: number, c: any) => sum + (c.user_estimated_total_hours || 0), 0);
      let base = actualSum > 0 ? actualSum : data.analysis.totalEstimatedHours;
      const multiplier = 1 + (difficulty - 3) * 0.125;
      base *= multiplier;
      const roundedHours = roundToHalfHour(base);
      
      setAdjustedTotalHours(roundedHours);
      initWeights(data.analysis);

      // Save to memory cache for zero-cost replay if inputs are untouched
      lastAnalysisCacheRef.current = {
        cacheKey: currentInputKey,
        analysis: data.analysis,
        rawText: data.rawText || '',
        adjustedTotalHours: roundedHours,
      };

      setStep(3); // On mobile, proceed to step 3 review
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
    if (!subject || !date) return alert(locale === 'nl' ? 'Vul alle verplichte velden in.' : 'Please fill out all required fields.');
    if (!aiAnalysis) return alert(locale === 'nl' ? 'Analyseer eerst je studiestof.' : 'Please analyze your material first.');
    if (!isValidCalendarDate(date)) return alert(locale === 'nl' ? 'Ongeldige datum geselecteerd.' : 'Invalid date selected.');

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
          rawMaterialText: stripPromptArtifacts(rawMaterialText),
          userInputNotes: stripPromptArtifacts(rawTextInput),
        }),
      });

      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || 'Failed to create exam');

      // Auto-save textbook association in profile
      if (subject && textbook.trim()) {
        fetch('/api/user/textbooks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject, textbook: textbook.trim() }),
        }).catch(() => {});
      }

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
    <div className="h-full overflow-hidden bg-slate-50 dark:bg-slate-900 p-2 sm:p-4 xl:p-6 flex flex-col">
      <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col min-h-0">
        
        {/* Mobile & iPad Step Indicator (< xl only) */}
        <div className="xl:hidden flex items-center justify-center mb-3 sm:mb-4 shrink-0">
          <div className="flex space-x-2.5 sm:space-x-3 items-center">
            <div className={`flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-full text-xs font-bold ${step === 1 ? 'bg-indigo-600 text-white' : step > 1 ? 'bg-indigo-200 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>1</div>
            <div className={`h-1 w-8 sm:w-12 rounded-full ${step > 1 ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
            <div className={`flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-full text-xs font-bold ${step === 2 ? 'bg-indigo-600 text-white' : step > 2 ? 'bg-indigo-200 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>2</div>
            <div className={`h-1 w-8 sm:w-12 rounded-full ${step > 2 ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
            <div className={`flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-full text-xs font-bold ${step === 3 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>3</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 flex-1 flex flex-col min-h-0 overflow-hidden">
          <form id="exam-form" onSubmit={handleSubmit} className="flex flex-col h-full min-h-0">

            {/* ========================================================================= */}
            {/* DESKTOP UI (>= xl): EXACT CODE RESTORED FROM LAST GIT PUSH (HEAD)          */}
            {/* ========================================================================= */}
            <div className="hidden xl:flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto p-4 md:p-6 min-h-0">
                <div className="grid grid-cols-2 gap-6 lg:gap-8 h-full">
                  
                  {/* Left Column: Basics Section */}
                  <section className="space-y-4 flex flex-col">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700 pb-2 shrink-0">
                      {editId ? t('createExam.titleEdit') : t('createExam.titleNew')}
                    </h2>
                    
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="subject" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('createExam.subjectLabel')}</label>
                        <input
                          type="text"
                          id="subject"
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm text-sm"
                          placeholder={t('createExam.subjectPlaceholder')}
                          required
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label htmlFor="textbook" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                            {t('createExam.textbookLabel')} <span className="text-xs font-normal text-slate-400 dark:text-slate-500">({locale === 'nl' ? 'Optioneel' : 'Optional'})</span>
                          </label>
                          {isTextbookAutoSaved && textbook && (
                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                              {t('createExam.textbookAutoSaved')}
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          id="textbook"
                          list="common-textbooks-list"
                          value={textbook}
                          onChange={(e) => {
                            setTextbook(e.target.value);
                            setIsTextbookAutoSaved(false);
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm text-sm"
                          placeholder={t('createExam.textbookPlaceholder')}
                        />
                        <datalist id="common-textbooks-list">
                          {COMMON_TEXTBOOKS.map((tb, idx) => (
                            <option key={idx} value={tb} />
                          ))}
                        </datalist>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                          {locale === 'nl' ? "Als je PTA geen hoofdstukken noemt, koppelt AI onderwerpen aan dit boek." : "If your PTA doesn't list chapters, AI maps topics to this book."}
                        </p>
                      </div>
                      <div>
                        <label htmlFor="date" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('createExam.examDateLabel')}</label>
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
                        <label htmlFor="difficulty" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">{t('createExam.difficultyLabel')}</label>
                        <span className="text-xs font-bold px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-md text-slate-700 dark:text-slate-300">
                          {difficulty === 1 ? (locale === 'nl' ? 'Zeer eenvoudig' : 'Easiest') : difficulty === 2 ? (locale === 'nl' ? 'Eenvoudig' : 'Easy') : difficulty === 3 ? (locale === 'nl' ? 'Gemiddeld' : 'Medium') : difficulty === 4 ? (locale === 'nl' ? 'Pittig' : 'Hard') : (locale === 'nl' ? 'Zeer intensief' : 'Hardest')}
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

                  {/* Right Column: Material Section */}
                  <section className="space-y-4 flex flex-col h-full min-h-0">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700 pb-2 shrink-0">
                      2. Syllabus & Material
                    </h2>
                    
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

                          <div className="w-full mt-4 space-y-1.5 shrink-0">
                            <div className="flex items-center justify-between">
                              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Which chapters or topics?
                              </label>
                              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">
                                Priorities &amp; focus areas can be noted here
                              </span>
                            </div>
                            <textarea
                              value={rawTextInput}
                              onChange={(e) => setRawTextInput(e.target.value)}
                              placeholder={`e.g. 'Periode 2', 'SE 3', 'Hoofdstuk 4 en 5', or paste topics here...\n\n• Uploading a PTA or exam schedule? Type which period, SE, or chapters you need (e.g. 'Periode 2' or 'SE 2') — the AI will find that exact exam row and extract its exact chapters!\n• Using a textbook? Mention book title & edition (e.g. 'Nova Scheikunde H3 en H4')\n• Custom focus? Tell AI which chapters are more or less important`}
                              className="w-full h-36 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-white shadow-xs text-sm leading-relaxed placeholder:text-slate-400 dark:placeholder:text-slate-500"
                            />
                          </div>

                          <button 
                            type="button" 
                            onClick={handleAnalyze}
                            disabled={isAnalyzing}
                            className="mt-3 w-full bg-indigo-600 text-white dark:text-slate-900 py-2.5 px-4 rounded-xl font-bold shadow-md hover:bg-indigo-700 hover:shadow-lg disabled:opacity-50 transition-all shrink-0 text-sm flex items-center justify-center gap-2 cursor-pointer"
                          >
                            {isAnalyzing ? (
                              <>
                                <svg className="w-4 h-4 animate-spin text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                <span>{t('createExam.analyzing')}</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                <span>{t('createExam.analyzeMaterial')}</span>
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
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('createExam.analyzing')}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{locale === 'nl' ? 'Hoofdstukken ordenen, studietijd berekenen...' : 'Parsing chunks, estimating hours...'}</p>
                          </div>
                        </div>
                      ) : aiAnalysis && (
                        <div className="flex-1 flex flex-col border-2 border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-900/10 rounded-2xl p-3 shadow-sm space-y-3 min-h-0">
                          <div className="flex items-start justify-between border-b border-green-200 dark:border-green-800/50 pb-2 shrink-0">
                            <div>
                              <h3 className="text-base font-bold text-green-800 dark:text-green-400 flex items-center gap-1.5">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {locale === 'nl' ? 'Analyse Voltooid' : 'Analysis Complete'}
                              </h3>
                              <p className="text-xs text-green-700 dark:text-green-500 mt-0.5">{locale === 'nl' ? 'Controleer en pas de hoofdstukken aan.' : 'Review and tweak recommendations.'}</p>
                            </div>
                            <button type="button" onClick={() => setAiAnalysis(null)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800/50 px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              {t('createExam.editMaterial')}
                            </button>
                          </div>

                          <div className="bg-white dark:bg-slate-800 rounded-xl p-2.5 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between shrink-0">
                            <div>
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{t('createExam.totalStudyHours')}</p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {difficulty !== 3 && <span className="text-indigo-500 font-semibold mr-1">{locale === 'nl' ? 'Aangepast.' : 'Adjusted.'}</span>}
                                {locale === 'nl' ? 'Basisadvies AI:' : 'Base AI suggestion:'} {aiAnalysis.totalEstimatedHours}h
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
                              <span className="text-slate-500 font-bold pr-1 text-sm">{locale === 'nl' ? 'uur' : 'hrs'}</span>
                            </div>
                          </div>

                          <div className="flex-1 overflow-y-auto pr-2 space-y-2 max-h-[40vh]">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{t('createExam.extractedChapters')}</p>
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
                                placeholder={t('createExam.addChapterPlaceholder')}
                                className="flex-1 text-xs px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                              />
                              <button
                                type="button"
                                onClick={handleAddChapter}
                                disabled={!newChapterName.trim()}
                                className="px-3 py-1.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 font-bold text-xs rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 disabled:opacity-50 transition-colors"
                              >
                                {t('common.add')}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </div>

              {/* Desktop Submit Footer (Exact from HEAD) */}
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => router.push('/calendar')} className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-sm">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={isSubmitting || !aiAnalysis} className="px-5 py-2 bg-indigo-600 text-white dark:text-slate-900 font-bold rounded-xl shadow-md hover:bg-indigo-700 hover:shadow-lg disabled:opacity-50 disabled:shadow-none transition-all flex items-center gap-2 text-sm">
                  {isSubmitting ? (
                    <><svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> {t('common.saving')}</>
                  ) : (editId ? t('createExam.updateExamBtn') : t('createExam.createExamBtn'))}
                </button>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* MOBILE & IPAD UI (< xl): 3-STEP WIZARD OPTIMIZED FOR SMALLER SCREENS      */}
            {/* ========================================================================= */}
            <div className="flex xl:hidden flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto p-3 sm:p-6 min-h-0 flex flex-col">
                
                {/* STEP 1: BASICS */}
                {step === 1 && (
                  <section className="space-y-4 flex flex-col h-full min-h-0 w-full max-w-2xl mx-auto">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700 pb-2 shrink-0">
                      {t('createExam.step1')}
                    </h2>
                    
                    <div className="space-y-4 flex-1">
                      <div>
                        <label htmlFor="mobile-subject" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          {t('createExam.subjectLabel')}
                        </label>
                        <input
                          type="text"
                          id="mobile-subject"
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-xs text-base sm:text-sm"
                          placeholder={t('createExam.subjectPlaceholder')}
                          required
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label htmlFor="mobile-textbook" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                            {t('createExam.textbookLabel')} <span className="text-xs font-normal text-slate-400 dark:text-slate-500">({locale === 'nl' ? 'Optioneel' : 'Optional'})</span>
                          </label>
                          {isTextbookAutoSaved && textbook && (
                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                              {t('createExam.textbookAutoSaved')}
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          id="mobile-textbook"
                          list="common-textbooks-list"
                          value={textbook}
                          onChange={(e) => {
                            setTextbook(e.target.value);
                            setIsTextbookAutoSaved(false);
                          }}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-xs text-base sm:text-sm"
                          placeholder={t('createExam.textbookPlaceholder')}
                        />
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                          {locale === 'nl' ? "Als je PTA geen hoofdstukken noemt, koppelt AI onderwerpen aan dit boek." : "If your PTA doesn't list chapters, AI maps topics to this book."}
                        </p>
                      </div>
                      
                      <div>
                        <label htmlFor="mobile-date" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          {t('createExam.examDateLabel')}
                        </label>
                        <input
                          type="date"
                          id="mobile-date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-xs text-base sm:text-sm"
                          required
                        />
                      </div>

                      {/* Difficulty Slider */}
                      <div className="pt-2">
                        <div className="flex justify-between items-center mb-2">
                          <label htmlFor="mobile-difficulty" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                            {t('createExam.difficultyLabel')}
                          </label>
                          <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 dark:bg-slate-700 rounded-md text-slate-700 dark:text-slate-300">
                            {difficulty === 1 ? (locale === 'nl' ? 'Zeer eenvoudig' : 'Easiest') : difficulty === 2 ? (locale === 'nl' ? 'Eenvoudig' : 'Easy') : difficulty === 3 ? (locale === 'nl' ? 'Gemiddeld' : 'Medium') : difficulty === 4 ? (locale === 'nl' ? 'Pittig' : 'Hard') : (locale === 'nl' ? 'Zeer intensief' : 'Hardest')}
                          </span>
                        </div>
                        <input
                          type="range"
                          id="mobile-difficulty"
                          min="1"
                          max="5"
                          step="1"
                          value={difficulty}
                          onChange={(e) => handleDifficultyChange(parseInt(e.target.value))}
                          className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-indigo-600"
                        />
                        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">
                          <span>1 ({locale === 'nl' ? 'Zeer eenvoudig' : 'Easiest'})</span>
                          <span>5 ({locale === 'nl' ? 'Zeer intensief' : 'Hardest'})</span>
                        </div>
                        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 italic">
                          {locale === 'nl' ? '* Hiermee past de AI de geschatte studietijd aan op basis van moeilijkheidsgraad.' : "* This scales the AI's time estimation up or down depending on difficulty."}
                        </p>
                      </div>
                    </div>
                  </section>
                )}

                {/* STEP 2: MATERIAL (Single big writing field + upload, max horizontal space) */}
                {step === 2 && (
                  <section className="space-y-3.5 flex flex-col h-full min-h-0 w-full">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700 pb-2 shrink-0">
                      {t('createExam.step2')}
                    </h2>
                    
                    <div className="flex-1 min-h-0 flex flex-col space-y-3">
                      {/* Upload Box */}
                      <div 
                        className={`relative rounded-2xl border-2 border-dashed transition-all p-3 flex flex-col min-h-[130px] shrink-0 overflow-hidden ${
                          isDragging 
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-inner' 
                            : 'border-slate-300 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-800/40 hover:border-indigo-400 hover:bg-slate-100/60 dark:hover:bg-slate-800'
                        } ${uploadedFiles.length === 0 ? 'items-center justify-center' : ''}`}
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
                            id="mobile-exam-material-file-input"
                            ref={mobileFileInputRef}
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
                            <div className="w-full flex flex-col gap-1.5 overflow-y-auto max-h-32 pr-0.5">
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
                                    title={locale === 'nl' ? 'Bestand verwijderen' : 'Remove file'}
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
                              <span>{locale === 'nl' ? 'Voeg meer bestanden toe of sleep hierheen' : 'Add more files or drop here'}</span>
                            </label>
                          </div>
                        ) : (
                          <div className="text-center py-3 space-y-1.5 w-full pointer-events-none">
                            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            </div>
                            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                              {locale === 'nl' ? 'Klik om te bladeren of sleep bestanden hierheen' : 'Click to browse or drop files here'}
                            </p>
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg shadow-xs text-xs font-semibold">
                              {locale === 'nl' ? 'Bestanden kiezen' : 'Browse Files'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Single Big Writing Field */}
                      <div className="flex-1 flex flex-col min-h-[140px]">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                            {locale === 'nl' ? 'Welke hoofdstukken of onderwerpen?' : 'Which chapters or topics?'}
                          </label>
                          <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">
                            {locale === 'nl' ? 'Prioriteiten & focus' : 'Priorities & focus areas'}
                          </span>
                        </div>
                        <textarea
                          value={rawTextInput}
                          onChange={(e) => setRawTextInput(e.target.value)}
                          placeholder={locale === 'nl' 
                            ? `Bijv. Hoofdstuk 1 t/m 4, of plak hier je PTA / studiewijzer...\n\n• Gebruik je een leerboek? Noem hier de methode en druk (bijv. Getal & Ruimte 12e ed, H1-4)\n• Upload je een PTA? Vertel de AI wat je precies moet leren, of welke onderdelen zwaarder wegen (bijv. Focus op H13; H1 & 3 zijn herhaling)`
                            : `e.g. Chapter 1 to 4, or paste your syllabus topics here...\n\n• Using a textbook? Mention the book title & edition here (e.g. Campbell Biology 7th ed AP, Ch 1–4)\n• Uploading a syllabus? Tell AI what specifically to study, or which chapters are more/less important (e.g. Focus on Ch 13 & Relativity; Ch 1 & 3 are less important / quick review)`}
                          className="flex-1 w-full p-3.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-white shadow-xs text-sm leading-relaxed placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                      </div>

                      {aiError && (
                        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2.5 text-red-700 dark:text-red-300 text-xs shrink-0 animate-in fade-in">
                          <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <div className="flex-1 font-medium leading-relaxed">{aiError}</div>
                          <button type="button" onClick={() => setAiError(null)} className="text-red-400 hover:text-red-600 transition-colors p-0.5">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* STEP 3: ANALYSIS COMPLETE / REVIEW */}
                {step === 3 && (
                  <section className="space-y-3.5 flex flex-col h-full min-h-0 w-full">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700 pb-2 shrink-0">
                      {t('createExam.step3')}
                    </h2>

                    {isAnalyzing ? (
                      <div className="flex-1 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/30 flex flex-col items-center justify-center gap-4 min-h-[200px] p-6">
                        <div className="relative w-12 h-12">
                          <div className="absolute inset-0 border-4 border-indigo-200 dark:border-indigo-900 rounded-full"></div>
                          <div className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                        <div className="text-center px-4">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{locale === 'nl' ? 'AI stelt je studieplan samen...' : 'AI is building your study plan...'}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{locale === 'nl' ? 'Onderwerpen analyseren, uren inschatten...' : 'Parsing chunks, estimating hours...'}</p>
                        </div>
                      </div>
                    ) : aiAnalysis && (
                      <div className="flex-1 flex flex-col border-2 border-green-500 dark:border-green-600 bg-green-50/70 dark:bg-green-900/10 rounded-2xl p-2.5 sm:p-4 shadow-xs space-y-3 min-h-0">
                        {/* Header: No edit material button on mobile to save space, back button handles this */}
                        <div className="border-b border-green-200 dark:border-green-800/50 pb-2.5 shrink-0">
                          <h3 className="text-base sm:text-lg font-bold text-green-800 dark:text-green-400 flex items-center gap-2">
                            <svg className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {t('createExam.analysisComplete')}
                          </h3>
                          <p className="text-xs sm:text-sm text-green-700 dark:text-green-500 mt-0.5">
                            {locale === 'nl' ? 'Controleer en pas de aanbevelingen aan.' : 'Review and tweak recommendations.'}
                          </p>
                        </div>

                        {/* Total Study Hours Summary */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-3.5 shadow-xs border border-slate-200/80 dark:border-slate-700 flex items-center justify-between shrink-0">
                          <div>
                            <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">{t('createExam.totalStudyHours')}</p>
                            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {difficulty !== 3 && <span className="text-indigo-600 dark:text-indigo-400 font-semibold mr-1">{locale === 'nl' ? 'Aangepast.' : 'Adjusted.'}</span>}
                              {locale === 'nl' ? 'Basisadvies AI:' : 'Base AI suggestion:'} {aiAnalysis.totalEstimatedHours}h
                            </p>
                          </div>
                          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900 px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                            <input
                              type="number"
                              value={adjustedTotalHours || 0}
                              onChange={(e) => handleGlobalHoursChange(parseFloat(e.target.value) || 0)}
                              className="w-16 sm:w-20 px-1 py-0.5 text-lg sm:text-xl font-extrabold text-indigo-600 dark:text-indigo-400 bg-transparent border-none focus:ring-0 text-center"
                              min="1"
                              step="0.5"
                            />
                            <span className="text-slate-500 font-bold pr-1 text-xs sm:text-sm">{locale === 'nl' ? 'uur' : 'hrs'}</span>
                          </div>
                        </div>

                        {/* Chapter Breakdown (Enlarged rows, enlarged buttons) */}
                        <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pr-0.5">
                          <div className="flex items-center justify-between shrink-0">
                            <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">{t('createExam.extractedChapters')}</p>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                              {localChapters.length} {locale === 'nl' ? (localChapters.length === 1 ? 'onderdeel' : 'onderdelen') : (localChapters.length === 1 ? 'subject' : 'subjects')}
                            </span>
                          </div>
                          
                          <div className="grid gap-2">
                            {localChapters.map((ch: any, idx: number) => {
                              const displayHours = getDisplayHours(idx);
                              return (
                                <div 
                                  key={idx} 
                                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 sm:px-3 sm:py-2.5 flex items-center gap-2 shadow-xs hover:border-indigo-400 transition-all"
                                >
                                  <input
                                    type="text"
                                    value={ch.chapter}
                                    onChange={(e) => handleChapterNameChange(idx, e.target.value)}
                                    className="flex-1 font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100 bg-transparent border-none focus:ring-2 focus:ring-indigo-500 rounded-lg px-2 py-1 min-w-0"
                                  />
                                  <div className="flex items-center gap-1 shrink-0 bg-slate-50 dark:bg-slate-900 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                                    <button 
                                      type="button" 
                                      onClick={() => handleChapterWeightChange(idx, -1)} 
                                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-xs flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 text-sm active:scale-95 transition-all cursor-pointer"
                                      aria-label="Decrease hours"
                                    >
                                      -
                                    </button>
                                    <span className="w-10 sm:w-11 text-center font-extrabold text-slate-800 dark:text-slate-200 text-xs sm:text-sm">
                                      {displayHours}h
                                    </span>
                                    <button 
                                      type="button" 
                                      onClick={() => handleChapterWeightChange(idx, 1)} 
                                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-xs flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 text-sm active:scale-95 transition-all cursor-pointer"
                                      aria-label="Increase hours"
                                    >
                                      +
                                    </button>
                                  </div>
                                  <button 
                                    type="button" 
                                    onClick={() => handleDeleteChapter(idx)} 
                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0 cursor-pointer"
                                    title={locale === 'nl' ? 'Hoofdstuk verwijderen' : 'Delete chapter'}
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              );
                            })}
                          </div>

                          {/* Enlarged Add Missing Chapter Input */}
                          <div className="pt-1.5 flex items-center gap-2">
                            <input
                              type="text"
                              value={newChapterName}
                              onChange={(e) => setNewChapterName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddChapter(); } }}
                              placeholder={t('createExam.addChapterPlaceholder')}
                              className="flex-1 text-sm sm:text-base px-3.5 py-2.5 sm:py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 min-h-[44px] shadow-xs"
                            />
                            <button
                              type="button"
                              onClick={handleAddChapter}
                              disabled={!newChapterName.trim()}
                              className="px-4 sm:px-5 py-2.5 sm:py-3 bg-indigo-600 text-white font-bold text-sm sm:text-base rounded-xl hover:bg-indigo-700 disabled:opacity-40 shadow-xs min-h-[44px] transition-all active:scale-95 shrink-0 cursor-pointer"
                            >
                              {t('common.add')}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </section>
                )}
              </div>

              {/* Mobile & iPad Footer Navigation (Enlarged Buttons) */}
              <div className="px-3 py-3 sm:px-6 sm:py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center gap-3 shrink-0">
                <div>
                  {step > 1 ? (
                    <button 
                      type="button" 
                      onClick={() => setStep(step - 1)} 
                      className="px-5 sm:px-6 py-2.5 sm:py-3 font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-xl shadow-xs transition-all text-sm sm:text-base min-h-[46px] flex items-center justify-center active:scale-95 cursor-pointer"
                    >
                      {t('common.back')}
                    </button>
                  ) : (
                    <button 
                      type="button" 
                      onClick={() => router.push('/calendar')} 
                      className="px-5 sm:px-6 py-2.5 sm:py-3 font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-xl shadow-xs transition-all text-sm sm:text-base min-h-[46px] flex items-center justify-center active:scale-95 cursor-pointer"
                    >
                      {t('common.cancel')}
                    </button>
                  )}
                </div>

                <div>
                  {step === 1 && (
                    <button 
                      type="button" 
                      onClick={() => { 
                        if (!subject || !date) alert(locale === 'nl' ? 'Vul alle verplichte velden in.' : 'Please fill out all required fields.'); 
                        else setStep(2); 
                      }} 
                      className="px-6 sm:px-8 py-2.5 sm:py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-indigo-700 active:scale-95 transition-all text-sm sm:text-base min-h-[46px] flex items-center justify-center cursor-pointer"
                    >
                      {t('common.next')}
                    </button>
                  )}
                  {step === 2 && (
                    <button 
                      type="button" 
                      onClick={handleAnalyze}
                      disabled={isAnalyzing}
                      className="px-6 sm:px-8 py-2.5 sm:py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-indigo-700 disabled:opacity-50 active:scale-95 transition-all text-sm sm:text-base min-h-[46px] flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isAnalyzing ? (
                        <><svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> {t('common.analyzing')}</>
                      ) : t('createExam.analyzeButton')}
                    </button>
                  )}
                  {step === 3 && (
                    <button 
                      type="submit" 
                      disabled={isSubmitting || !aiAnalysis} 
                      className="px-6 sm:px-8 py-2.5 sm:py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-indigo-700 hover:shadow-lg disabled:opacity-50 disabled:shadow-none active:scale-95 transition-all flex items-center justify-center gap-2 text-sm sm:text-base min-h-[46px] cursor-pointer"
                    >
                      {isSubmitting ? (
                        <><svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> {t('common.saving')}</>
                      ) : (editId ? t('createExam.updateExamBtn') : t('createExam.createExamBtn'))}
                    </button>
                  )}
                </div>
              </div>
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
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                {locale === 'nl' ? 'Rooster Overbelasting Waarschuwing' : 'Schedule Overload Warning'}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                {locale === 'nl' 
                  ? 'Je resterende studiestof is te veel om in te plannen binnen je beschikbare dagen zonder je dagelijkse maximumlimiet te overschrijden. Hoe wil je de overbelasting aanpakken?'
                  : 'Your remaining study material is too dense to fit into your available days without exceeding your daily maximum limit. How would you like to handle the overflow?'}
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={() => submitRegenerateAction('compress')}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors text-left"
                >
                  <div>
                    <div className="font-bold">
                      {locale === 'nl' ? 'Hoofdstukken Comprimeren' : 'Compress Chapters to Fit'}
                    </div>
                    <div className="text-xs mt-1 opacity-80">
                      {locale === 'nl'
                        ? 'Sessies boven je daglimiet worden samengevoegd tot combinaties (bijv. "Hoofdstuk 5 & Hoofdstuk 6") met iets minder diepgang.'
                        : 'Sessions over your daily limit are merged into combined topics (e.g. "Chapter 5 & Chapter 6") at the cost of less in-depth coverage.'}
                    </div>
                  </div>
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>

                <button
                  onClick={() => submitRegenerateAction('allowOverload')}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
                >
                  <div>
                    <div className="font-bold">
                      {locale === 'nl' ? 'Alle Sessies Behouden' : 'Keep All Sessions'}
                    </div>
                    <div className="text-xs mt-1 opacity-80">
                      {locale === 'nl'
                        ? 'Plaats toch alle sessies, waarbij je dagelijkse maximum overschreden mag worden.'
                        : 'Place all sessions anyway, allowing your schedule to exceed the daily limit.'}
                    </div>
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
                {isDeletingExam 
                  ? (locale === 'nl' ? 'Bezig met ongedaan maken...' : 'Undoing...') 
                  : (locale === 'nl' ? 'Toets aanmaken annuleren' : 'Undo Exam Creation')}
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
