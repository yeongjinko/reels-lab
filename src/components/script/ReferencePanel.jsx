import React, { useState } from 'react';
import { analyzeReference, refineSentence, refineAnalysis } from '../../services/anthropic';
import { useApp } from '../../App';

const TAG_STYLES = {
  후킹: 'bg-orange-100 text-orange-700',
  본문: 'bg-green-100 text-green-700',
  심리: 'bg-purple-100 text-purple-700',
  CTA: 'bg-red-100 text-red-700',
};

const CONTEXT_OPTIONS = [
  { id: 'premium', label: '고가 선망 브랜드', desc: '예: 룰루레몬, 나이키' },
  { id: 'budget', label: '저가/가성비 브랜드', desc: '' },
  { id: 'item', label: '특정 아이템/소재명', desc: '' },
  { id: 'custom', label: '직접 입력', desc: '' },
];

function SentenceCard({ sentence, onUpdate }) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState('');

  async function handleApply() {
    if (!feedbackText.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await refineSentence(sentence.text, sentence.effect, feedbackText.trim());
      onUpdate(result.effect);
      setApplied(true);
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
        {applied && (
          <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full flex-shrink-0">
            피드백 반영됨
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 leading-relaxed pl-0.5 mb-2.5">{sentence.effect}</p>

      {feedbackOpen ? (
        <div className="mt-1 pt-2.5 border-t border-gray-100">
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="이 분석이 아쉬운 점을 알려주세요. 예) 룰루레몬은 고가 선망 브랜드인데 이 맥락이 반영 안됐어요"
            rows={2}
            autoFocus
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-gray-50 placeholder-gray-400 resize-none"
          />
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleApply}
              disabled={!feedbackText.trim() || loading}
              className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              {loading ? (
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : null}
              반영하기
            </button>
            <button
              onClick={() => { setFeedbackOpen(false); setFeedbackText(''); setError(''); }}
              className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setFeedbackOpen(true)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-500 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
          피드백
        </button>
      )}
    </div>
  );
}

function WordContextPopup({ word, totalCount, currentIndex, onAnswer, onSkip }) {
  const [selected, setSelected] = useState(null);
  const [customInput, setCustomInput] = useState('');

  const canConfirm = selected && (selected !== 'custom' || customInput.trim());

  function handleConfirm() {
    if (!canConfirm) return;
    onAnswer({
      word,
      contextType: selected,
      customDesc: selected === 'custom' ? customInput.trim() : '',
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 pt-6 pb-5">
          {totalCount > 1 && (
            <p className="text-xs text-gray-400 mb-2">{currentIndex + 1} / {totalCount}</p>
          )}
          <p className="text-xs text-gray-500 mb-1">더 정확한 분석을 위해</p>
          <h2 className="text-base font-bold text-gray-900 mb-5">
            <span className="text-indigo-600">"{word}"</span>이(가) 무엇인지 알려주시면
            더 정확하게 분석할 수 있어요
          </h2>

          <div className="flex flex-col gap-2">
            {CONTEXT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSelected(opt.id)}
                className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                  selected === opt.id
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-800'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="font-medium text-sm">{opt.label}</span>
                {opt.desc && (
                  <span className="text-xs text-gray-400 ml-1.5">{opt.desc}</span>
                )}
              </button>
            ))}
          </div>

          {selected === 'custom' && (
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder={`"${word}"에 대해 설명해주세요`}
              className="mt-3 w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              autoFocus
            />
          )}
        </div>

        <div className="px-6 pb-5 flex flex-col gap-2">
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-colors"
          >
            이 맥락으로 분석하기
          </button>
          <button
            onClick={onSkip}
            className="w-full text-gray-400 hover:text-gray-600 text-sm py-2 transition-colors"
          >
            모르겠으면 그냥 넘어가기
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReferencePanel({ onAnalysisDone }) {
  const { userData } = useApp();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState('');
  const [contextQueue, setContextQueue] = useState([]);
  const [wordContexts, setWordContexts] = useState([]);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [overallFeedback, setOverallFeedback] = useState({ open: false, text: '', loading: false, error: '' });

  const shopType =
    userData?.shopType === 'both' ? 'women' : userData?.shopType || 'women';

  async function handleAnalyzeClick() {
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    setAnalysis(null);
    setContextQueue([]);
    setWordContexts([]);

    try {
      const result = await analyzeReference(text.trim(), shopType);
      if (result.needsContext) {
        setPendingRequest({ text: text.trim(), shopType });
        setContextQueue(result.words || []);
        setLoading(false);
      } else {
        setAnalysis(result.data);
        onAnalysisDone?.(result.data);
        setLoading(false);
      }
    } catch (e) {
      setError(e.message || '분석 중 오류가 발생했습니다.');
      setLoading(false);
    }
  }

  async function runPhaseTwo(contexts) {
    setLoading(true);
    try {
      const result = await analyzeReference(pendingRequest.text, pendingRequest.shopType, contexts);
      setAnalysis(result.data);
      onAnalysisDone?.(result.data);
    } catch (e) {
      setError(e.message || '분석 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
      setPendingRequest(null);
    }
  }

  function handleWordAnswer(answer) {
    const updatedContexts = [...wordContexts, answer];
    setWordContexts(updatedContexts);
    advanceQueue(updatedContexts);
  }

  function handleWordSkip() {
    advanceQueue(wordContexts);
  }

  function advanceQueue(currentContexts) {
    const nextQueue = contextQueue.slice(1);
    setContextQueue(nextQueue);
    if (nextQueue.length === 0) {
      runPhaseTwo(currentContexts);
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

  const currentWord = contextQueue[0];

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 mb-0.5">레퍼런스 분석</h2>
          <p className="text-xs text-gray-500">잘 되는 릴스 대본을 붙여넣으면 AI가 후킹 공식을 추출합니다</p>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              레퍼런스 대본
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
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
                    <span className={`ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      analysis.isNewType
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-indigo-100 text-indigo-600'
                    }`}>
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
                    <SentenceCard
                      key={i}
                      sentence={s}
                      onUpdate={(newEffect) => handleSentenceUpdate(i, newEffect)}
                    />
                  ))}
                </div>
              </div>

              {/* 전체 피드백 */}
              <div className="border-t border-gray-100 pt-4">
                {overallFeedback.open ? (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">전체 분석 피드백</p>
                    <textarea
                      value={overallFeedback.text}
                      onChange={(e) => setOverallFeedback((prev) => ({ ...prev, text: e.target.value }))}
                      placeholder="전체 분석에 대해 아쉬운 점을 알려주세요. AI가 분석 전체를 다시 수정해드려요."
                      rows={3}
                      autoFocus
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-gray-50 placeholder-gray-400 resize-none"
                    />
                    {overallFeedback.error && (
                      <p className="text-xs text-red-500 mt-1">{overallFeedback.error}</p>
                    )}
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={handleOverallFeedbackApply}
                        disabled={!overallFeedback.text.trim() || overallFeedback.loading}
                        className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        {overallFeedback.loading && (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        )}
                        전체 재분석
                      </button>
                      <button
                        onClick={() => setOverallFeedback({ open: false, text: '', loading: false, error: '' })}
                        className="text-xs text-gray-400 hover:text-gray-600 px-3 py-2 rounded-lg transition-colors"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setOverallFeedback((prev) => ({ ...prev, open: true }))}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-500 transition-colors"
                  >
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

      {currentWord && (
        <WordContextPopup
          word={currentWord}
          totalCount={contextQueue.length + wordContexts.length}
          currentIndex={wordContexts.length}
          onAnswer={handleWordAnswer}
          onSkip={handleWordSkip}
        />
      )}
    </>
  );
}
