import React, { useState, useEffect, useRef } from 'react';
import {
  collection, addDoc, updateDoc, doc, query,
  where, orderBy, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useApp } from '../../App';
import {
  analyzeReference,
  generateTemplate,
  generateContextOptions,
  updateSentencesWithContext,
  refineSentence,
  refineAnalysis,
} from '../../services/anthropic';

const TAG_STYLES = {
  후킹: 'bg-orange-100 text-orange-700',
  본문: 'bg-green-100 text-green-700',
  심리: 'bg-purple-100 text-purple-700',
  CTA: 'bg-red-100 text-red-700',
};

function highlightWord(sentence, word) {
  if (!sentence || !word) return sentence;
  const regex = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = sentence.split(regex);
  return parts.map((part, i) =>
    regex.test(part)
      ? <mark key={i} className="bg-yellow-200 text-gray-900 font-semibold rounded px-0.5">{part}</mark>
      : part
  );
}

const CONTEXT_TIMEOUT_MS = 55000;
const MAX_RETRIES = 2;

function LibraryPickerModal({ onSelect, onClose }) {
  const { user } = useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const q = query(
      collection(db, 'referenceLibrary'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, [user]);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[75vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex-shrink-0 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900">라이브러리에서 가져오기</h3>
            <p className="text-xs text-gray-400 mt-0.5">레퍼런스를 선택하면 대본이 자동으로 채워집니다</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32 gap-2">
              <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-gray-400">불러오는 중...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <p className="text-sm text-gray-500">저장된 레퍼런스가 없어요</p>
              <p className="text-xs text-gray-400 mt-1">라이브러리 페이지에서 먼저 추가해보세요</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelect(item)}
                  className="text-left w-full bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 rounded-xl p-3.5 transition-all"
                >
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      item.analyzed ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {item.analyzed ? '분석완료' : '미분석'}
                    </span>
                    {item.analyzed && item.hookType && (
                      <span className="text-[11px] bg-indigo-100 text-indigo-600 font-semibold px-2 py-0.5 rounded-full">
                        {item.hookType}
                      </span>
                    )}
                    {item.link && (
                      <svg className="w-3.5 h-3.5 text-gray-400 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-2">{item.preview || item.script?.slice(0, 80)}</p>
                  {item.analyzed && item.empathyTags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.empathyTags.slice(0, 3).map((tag, i) => (
                        <span key={i} className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full">#{tag}</span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WordContextPopup({ word, sentence, fullScript, totalCount, currentIndex, onAnswer, onSkip }) {
  const [options, setOptions] = useState(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [selectedSet, setSelectedSet] = useState(new Set());
  const [customInput, setCustomInput] = useState('');
  const cancelledRef = useRef(false);

  function doFetch() {
    setOptionsLoading(true);
    setLoadError(false);
    setOptions(null);
    setElapsed(0);

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), CONTEXT_TIMEOUT_MS)
    );

    Promise.race([generateContextOptions(word, sentence, fullScript), timeoutPromise])
      .then((data) => {
        if (!cancelledRef.current) {
          setOptions(data.options);
          setOptionsLoading(false);
        }
      })
      .catch((e) => {
        console.error('generateContextOptions failed:', e);
        if (!cancelledRef.current) {
          setLoadError(true);
          setOptionsLoading(false);
        }
      });
  }

  useEffect(() => {
    cancelledRef.current = false;
    setSelectedSet(new Set());
    setCustomInput('');
    setRetryCount(0);
    doFetch();
    return () => { cancelledRef.current = true; };
  }, [word, sentence, fullScript]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!optionsLoading) return;
    const interval = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [optionsLoading]);

  function toggleOption(i) {
    setSelectedSet((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  function handleRetry() {
    setRetryCount((r) => r + 1);
    doFetch();
  }

  const isLast = currentIndex === totalCount - 1;
  const hasSelection = selectedSet.size > 0 || customInput.trim();

  function handleProceed() {
    if (!hasSelection) { onSkip(); return; }
    const labels = [];
    if (options) [...selectedSet].forEach((i) => labels.push(options[i].label));
    if (customInput.trim()) labels.push(customInput.trim());
    onAnswer({ word, label: labels.join(', ') });
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="px-6 pt-6 pb-4 flex-shrink-0">
          {totalCount > 1 && (
            <div className="flex gap-1.5 mb-4">
              {Array.from({ length: totalCount }, (_, i) => (
                <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= currentIndex ? 'bg-indigo-500' : 'bg-gray-200'}`} />
              ))}
            </div>
          )}
          {sentence && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 mb-4">
              <p className="text-xs text-gray-500 font-medium mb-1">원문 문장</p>
              <p className="text-xs text-gray-700 leading-relaxed">{highlightWord(sentence, word)}</p>
            </div>
          )}
          <h2 className="text-base font-bold text-gray-900">
            이 영상에서 <span className="text-indigo-600">"{word}"</span>는 어떤 의미로 쓰였나요?
          </h2>
          <p className="text-xs text-gray-400 mt-1">해당하는 것을 모두 선택하세요. 선택하지 않아도 분석이 진행됩니다.</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-2">
          {optionsLoading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-gray-400">
                선택지 생성 중...{elapsed > 0 && <span className="ml-1">({elapsed}초)</span>}
              </p>
              {elapsed >= 10 && <p className="text-xs text-gray-300">AI가 대본 전체를 분석하고 있어요</p>}
            </div>
          ) : loadError ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col items-center gap-3 py-4 px-2 text-center">
                <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600">선택지를 불러오지 못했어요.</p>
                {retryCount < MAX_RETRIES ? (
                  <button onClick={handleRetry} className="flex items-center gap-1.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    다시 시도 ({MAX_RETRIES - retryCount}회 남음)
                  </button>
                ) : (
                  <p className="text-xs text-gray-400">재시도 횟수를 초과했어요.</p>
                )}
              </div>
              {/* 선택지 로드 실패해도 직접 입력은 항상 가능 */}
              <div className={`rounded-xl border-2 px-4 py-3 transition-all ${customInput.trim() ? 'bg-indigo-50 border-indigo-400' : 'bg-gray-50 border-gray-200'}`}>
                <p className="text-xs text-gray-500 mb-1.5">선택지 없이 직접 입력하세요</p>
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder={`"${word}"에 대해 직접 설명해주세요`}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white placeholder-gray-400"
                  autoFocus
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {options?.map((opt, i) => {
                const checked = selectedSet.has(i);
                return (
                  <button key={i} onClick={() => toggleOption(i)} className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex items-start gap-3 ${checked ? 'bg-indigo-50 border-indigo-400' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                    <div className={`w-5 h-5 rounded flex-shrink-0 mt-0.5 flex items-center justify-center border-2 transition-colors ${checked ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300 bg-white'}`}>
                      {checked && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${checked ? 'text-indigo-800' : 'text-gray-800'}`}>{opt.label}</p>
                      <p className={`text-xs mt-0.5 leading-relaxed ${checked ? 'text-indigo-600' : 'text-gray-400'}`}>{opt.effect}</p>
                    </div>
                  </button>
                );
              })}

              {/* 직접 입력 */}
              <div className={`rounded-xl border-2 px-4 py-3 transition-all ${customInput.trim() ? 'bg-indigo-50 border-indigo-400' : 'bg-white border-gray-200'}`}>
                <p className={`text-sm font-semibold mb-1.5 ${customInput.trim() ? 'text-indigo-800' : 'text-gray-800'}`}>직접 입력</p>
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder={`"${word}"에 대해 직접 설명해주세요`}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white placeholder-gray-400"
                />
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pt-3 pb-5 border-t border-gray-100 flex flex-col gap-2 flex-shrink-0">
          <button
            onClick={handleProceed}
            disabled={optionsLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-colors"
          >
            {hasSelection
              ? (isLast ? '맥락 반영해서 분석하기' : `선택 완료 (${selectedSet.size + (customInput.trim() ? 1 : 0)}개)`)
              : (isLast ? '선택 없이 분석하기' : '선택 없이 넘어가기')}
          </button>
          <button onClick={onSkip} className="w-full text-gray-400 hover:text-gray-600 text-sm py-2 transition-colors">
            모르겠으면 넘어가기
          </button>
        </div>
      </div>
    </div>
  );
}

function SentenceCard({ sentence, onUpdate }) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedbackApplied, setFeedbackApplied] = useState(false);
  const [error, setError] = useState('');

  async function handleApply() {
    if (!feedbackText.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await refineSentence(sentence.text, sentence.effect, feedbackText.trim());
      onUpdate(result.effect);
      setFeedbackApplied(true);
      setFeedbackOpen(false);
      setFeedbackText('');
    } catch {
      setError('수정 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3.5 shadow-sm">
      <div className="flex items-start gap-2 mb-2">
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${TAG_STYLES[sentence.tag] || 'bg-gray-100 text-gray-600'}`}>
          {sentence.tag}
        </span>
        <p className="text-sm text-gray-800 font-medium leading-snug flex-1">{sentence.text}</p>
        <div className="flex flex-col gap-1 flex-shrink-0">
          {sentence.contextApplied && (
            <span className="text-[10px] font-semibold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full whitespace-nowrap">맥락 반영됨</span>
          )}
          {feedbackApplied && (
            <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full whitespace-nowrap">피드백 반영됨</span>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-500 leading-relaxed pl-0.5 mb-2.5">{sentence.effect}</p>

      {feedbackOpen ? (
        <div className="mt-1 pt-2.5 border-t border-gray-100">
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="이 분석이 아쉬운 점을 알려주세요."
            rows={2}
            autoFocus
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-gray-50 placeholder-gray-400 resize-none"
          />
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          <div className="flex gap-2 mt-2">
            <button onClick={handleApply} disabled={!feedbackText.trim() || loading} className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-3 py-1.5 rounded-lg transition-colors">
              {loading && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              반영하기
            </button>
            <button onClick={() => { setFeedbackOpen(false); setFeedbackText(''); setError(''); }} className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg transition-colors">
              취소
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setFeedbackOpen(true)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-500 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
          피드백
        </button>
      )}
    </div>
  );
}

export default function ReferencePanel({ onAnalysisDone, onReferenceText, onReferenceId, initialText, initialAnalysis, initialReferenceId }) {
  const { user } = useApp();
  const [text, setText] = useState(initialText || '');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(initialAnalysis || null);
  const [error, setError] = useState('');
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);

  const [baseAnalysis, setBaseAnalysis] = useState(null);
  const [contextQueue, setContextQueue] = useState([]);
  const [contextAnswers, setContextAnswers] = useState([]);

  const [overallFeedback, setOverallFeedback] = useState({ open: false, text: '', loading: false, error: '' });

  const refDocRef = useRef(initialReferenceId || null);

  async function handleAnalyzeClick() {
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    setAnalysis(null);
    setBaseAnalysis(null);
    setContextQueue([]);
    setContextAnswers([]);

    // Create referenceLibrary entry (analyzed: false) unless it already came from library
    let docId = refDocRef.current;
    if (!docId && user) {
      try {
        const docRef = await addDoc(collection(db, 'referenceLibrary'), {
          userId: user.uid,
          createdAt: serverTimestamp(),
          script: text.trim(),
          preview: text.trim().slice(0, 50),
          link: null,
          analyzed: false,
          hookType: null,
          empathyTags: [],
          empathyPoint: null,
          analysis: null,
        });
        docId = docRef.id;
        refDocRef.current = docId;
        onReferenceId?.(docId);
      } catch (e) {
        console.error('referenceLibrary create failed:', e);
      }
    }

    try {
      const result = await analyzeReference(text.trim());
      if (result.needsContext && result.words?.length > 0) {
        setBaseAnalysis(result.data);
        setContextQueue(result.words);
        onReferenceText?.(text.trim());
        setLoading(false);
      } else {
        finalizeAnalysis(result.data, docId);
      }
    } catch (e) {
      setError(e.message || '분석 중 오류가 발생했습니다.');
      setLoading(false);
    }
  }

  async function finalizeAnalysis(analysisData, docId) {
    setAnalysis(analysisData);
    onAnalysisDone?.(analysisData);
    onReferenceText?.(text.trim());
    setLoading(false);

    if (docId && user) {
      try {
        let empathyPoint = null;
        let empathyTags = [];
        let hookType = analysisData.hookFormulaType || null;
        try {
          const templateResult = await generateTemplate(text.trim());
          hookType = templateResult.hookType || hookType;
          empathyPoint = templateResult.empathyPoint || null;
          empathyTags = templateResult.empathyTags || [];
        } catch (e) {
          console.error('generateTemplate failed:', e);
        }
        await updateDoc(doc(db, 'referenceLibrary', docId), {
          analyzed: true,
          analysis: analysisData,
          hookType,
          empathyPoint,
          empathyTags,
        });
      } catch (e) {
        console.error('referenceLibrary update failed:', e);
      }
    }
  }

  function handleWordAnswer(answer) {
    const newAnswers = [...contextAnswers, answer];
    setContextAnswers(newAnswers);
    advanceQueue(newAnswers);
  }

  function handleWordSkip() {
    advanceQueue(contextAnswers);
  }

  function advanceQueue(currentAnswers) {
    const nextQueue = contextQueue.slice(1);
    setContextQueue(nextQueue);
    if (nextQueue.length === 0) {
      runContextUpdate(currentAnswers);
    }
  }

  async function runContextUpdate(answers) {
    const validAnswers = answers.filter((a) => a.label);
    if (validAnswers.length === 0) {
      finalizeAnalysis(baseAnalysis, refDocRef.current);
      setBaseAnalysis(null);
      return;
    }

    setLoading(true);
    const contextMap = Object.fromEntries(validAnswers.map((a) => [a.word, a.label]));

    try {
      const updates = await updateSentencesWithContext(baseAnalysis.sentences, contextMap);
      const newSentences = baseAnalysis.sentences.map((s) => {
        const update = updates.find((u) => u.text === s.text);
        return update ? { ...s, effect: update.effect, contextApplied: true } : s;
      });
      const newAnalysis = { ...baseAnalysis, sentences: newSentences };
      finalizeAnalysis(newAnalysis, refDocRef.current);
    } catch (e) {
      setError(e.message || '맥락 반영 중 오류가 발생했습니다.');
      finalizeAnalysis(baseAnalysis, refDocRef.current);
    } finally {
      setBaseAnalysis(null);
    }
  }

  function handleSentenceUpdate(index, newEffect) {
    const newSentences = analysis.sentences.map((s, i) =>
      i === index ? { ...s, effect: newEffect } : s
    );
    const updated = { ...analysis, sentences: newSentences };
    setAnalysis(updated);
    onAnalysisDone?.(updated);
  }

  async function handleOverallFeedbackApply() {
    if (!overallFeedback.text.trim() || overallFeedback.loading) return;
    setOverallFeedback((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const result = await refineAnalysis(
        analysis.sentences,
        analysis.hookFormula,
        analysis.hookFormulaDesc,
        overallFeedback.text.trim()
      );
      const updated = { ...analysis, ...result };
      setAnalysis(updated);
      onAnalysisDone?.(updated);
      setOverallFeedback({ open: false, text: '', loading: false, error: '' });
    } catch {
      setOverallFeedback((prev) => ({ ...prev, loading: false, error: '수정 중 오류가 발생했습니다.' }));
    }
  }

  function handleLibrarySelect(item) {
    setShowLibraryPicker(false);
    setText(item.script || '');
    refDocRef.current = item.id;
    onReferenceText?.(item.script || '');
    onReferenceId?.(item.id);
    if (item.analyzed && item.analysis) {
      setAnalysis(item.analysis);
      onAnalysisDone?.(item.analysis);
    } else {
      setAnalysis(null);
    }
  }

  const currentWord = contextQueue[0];
  const currentSentence = currentWord
    ? baseAnalysis?.sentences?.find((s) => s.text.includes(currentWord))?.text || ''
    : '';

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 mb-0.5">레퍼런스 분석</h2>
          <p className="text-xs text-gray-500">잘 되는 릴스 대본을 붙여넣으면 AI가 후킹 공식을 추출합니다</p>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                레퍼런스 대본
              </label>
              <button
                onClick={() => setShowLibraryPicker(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                라이브러리에서 가져오기
              </button>
            </div>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); refDocRef.current = null; }}
              placeholder={"예시:\n여보세요~ 사장님들~ 이거 진짜 안 보면 후회해요.\n이번 시즌 가장 많이 팔린 아이템 TOP3 알려드릴게요.\n지금 바로 확인하세요!"}
              rows={8}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 placeholder-gray-400"
            />
          </div>

          <button
            onClick={handleAnalyzeClick}
            disabled={!text.trim() || loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 mb-5"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                분석 중...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                AI 분석하기
              </>
            )}
          </button>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">
              {error}
            </div>
          )}

          {analysis && (
            <div className="flex flex-col gap-4">
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">후킹 공식</span>
                  {analysis.hookFormulaType && (
                    <span className={`ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full ${analysis.isNewType ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-600'}`}>
                      {analysis.isNewType ? '✦ 새 유형 · ' : ''}{analysis.hookFormulaType}
                    </span>
                  )}
                </div>
                <p className="text-indigo-900 font-bold text-sm mb-1">{analysis.hookFormula}</p>
                <p className="text-indigo-700 text-xs leading-relaxed">{analysis.hookFormulaDesc}</p>
                {analysis.introStructure && (
                  <div className="mt-3 pt-3 border-t border-indigo-200 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10" />
                    </svg>
                    <span className="text-[11px] text-indigo-500 font-medium">도입부 구조:</span>
                    <span className="text-[11px] text-indigo-700">{analysis.introStructure}</span>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">문장별 분석</p>
                <div className="flex flex-col gap-2.5">
                  {analysis.sentences?.map((s, i) => (
                    <SentenceCard key={i} sentence={s} onUpdate={(newEffect) => handleSentenceUpdate(i, newEffect)} />
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                {overallFeedback.open ? (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">전체 분석 피드백</p>
                    <textarea
                      value={overallFeedback.text}
                      onChange={(e) => setOverallFeedback((prev) => ({ ...prev, text: e.target.value }))}
                      placeholder="전체 분석에 대해 아쉬운 점을 알려주세요."
                      rows={3}
                      autoFocus
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-gray-50 placeholder-gray-400 resize-none"
                    />
                    {overallFeedback.error && <p className="text-xs text-red-500 mt-1">{overallFeedback.error}</p>}
                    <div className="flex gap-2 mt-2">
                      <button onClick={handleOverallFeedbackApply} disabled={!overallFeedback.text.trim() || overallFeedback.loading} className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-4 py-2 rounded-lg transition-colors">
                        {overallFeedback.loading && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                        전체 재분석
                      </button>
                      <button onClick={() => setOverallFeedback({ open: false, text: '', loading: false, error: '' })} className="text-xs text-gray-400 hover:text-gray-600 px-3 py-2 rounded-lg transition-colors">
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setOverallFeedback((prev) => ({ ...prev, open: true }))} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-500 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    전체 피드백으로 재분석
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showLibraryPicker && (
        <LibraryPickerModal onSelect={handleLibrarySelect} onClose={() => setShowLibraryPicker(false)} />
      )}

      {currentWord && (
        <WordContextPopup
          word={currentWord}
          sentence={currentSentence}
          fullScript={text}
          totalCount={contextQueue.length + contextAnswers.length}
          currentIndex={contextAnswers.length}
          onAnswer={handleWordAnswer}
          onSkip={handleWordSkip}
        />
      )}
    </>
  );
}
