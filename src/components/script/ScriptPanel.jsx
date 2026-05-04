import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useApp } from '../../App';
import { generateTemplate, generateFinalScript } from '../../services/anthropic';

const STEPS_DRAFT_KEY = 'rlab_steps_draft';

function tryRestoreStepsDraft(refText, stepsLen) {
  try {
    const saved = JSON.parse(localStorage.getItem(STEPS_DRAFT_KEY) || 'null');
    if (saved?.referenceText === refText && saved?.answers?.length === stepsLen) {
      return { answers: saved.answers, currentStep: saved.currentStep ?? 0, done: saved.done ?? false };
    }
  } catch {}
  return { answers: new Array(stepsLen).fill(''), currentStep: 0, done: false };
}

function StepCard({ step, index, total, answer, onAnswerChange, onNext, onPrev }) {
  const isLast = index === total - 1;
  console.log(`[StepCard] index=${index} step:`, step);

  return (
    <div className="flex flex-col gap-4">
      {/* 레퍼런스 원문 */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">레퍼런스 원문</span>
        <p className="text-sm text-gray-600 leading-relaxed italic">"{step.sentence}"</p>
      </div>

      {/* 역할 배지 + 심리 효과 */}
      <div className="flex flex-col gap-2">
        <span className="inline-flex text-[11px] font-bold bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full self-start">
          {step.role}
        </span>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <svg className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="text-xs font-bold text-amber-700">시청자 심리</span>
          </div>
          <p className="text-xs text-amber-900 leading-relaxed">{step.effect}</p>
        </div>
      </div>

      {/* 코치 질문 */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <svg className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-bold text-indigo-700">코치 질문</span>
        </div>
        <p className="text-sm font-semibold text-indigo-900 leading-relaxed">{step.question}</p>
        {step.questionHint && (
          <p className="text-xs text-indigo-500 mt-2">{step.questionHint}</p>
        )}
      </div>

      {/* 사용자 입력 */}
      <div>
        <label className="block text-xs font-bold text-gray-700 mb-2">내 답변</label>
        <textarea
          value={answer}
          onChange={(e) => onAnswerChange(e.target.value)}
          placeholder="답변을 입력해보세요"
          rows={3}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 leading-relaxed resize-none outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white placeholder-gray-400"
        />
      </div>

      {/* 이동 버튼 */}
      <div className="flex gap-2">
        {index > 0 && (
          <button
            onClick={onPrev}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            이전
          </button>
        )}
        <button
          onClick={onNext}
          className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
        >
          {isLast ? '완료' : '다음'}
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isLast ? 'M5 13l4 4L19 7' : 'M9 5l7 7-7 7'} />
          </svg>
        </button>
      </div>
    </div>
  );
}

function CompletionView({ steps, answers, hookType, onPrev, onSave, saving, saved }) {
  const [generating, setGenerating] = useState(false);
  const [finalScript, setFinalScript] = useState('');
  const [genError, setGenError] = useState('');
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    setGenError('');
    try {
      const stepsWithAnswers = steps.map((s, i) => ({ ...s, userInput: answers[i] || '' }));
      const data = await generateFinalScript(stepsWithAnswers, hookType);
      setFinalScript(data.script || '');
    } catch (e) {
      setGenError(e.message || '대본 생성 중 오류가 발생했습니다.');
    } finally {
      setGenerating(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(finalScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 답변 요약 */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">내 답변 요약</p>
        <div className="flex flex-col gap-2.5">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full h-fit mt-0.5 whitespace-nowrap flex-shrink-0">
                {step.role}
              </span>
              <p className="text-xs text-gray-600 leading-relaxed flex-1">
                {answers[i] || <span className="text-gray-400 italic">미입력</span>}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 생성 전 */}
      {!finalScript && (
        <>
          {generating ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-gray-400">내 대본을 완성하는 중...</p>
            </div>
          ) : genError ? (
            <div className="flex flex-col gap-2">
              <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-4 py-3">
                {genError}
              </div>
              <button
                onClick={handleGenerate}
                className="flex items-center justify-center gap-2 text-sm text-indigo-600 border border-indigo-200 hover:bg-indigo-50 font-semibold px-4 py-2.5 rounded-xl transition-colors"
              >
                다시 시도
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenerate}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              완성 대본 생성하기
            </button>
          )}
          {!generating && (
            <button
              onClick={onPrev}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors self-start"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              수정하기
            </button>
          )}
        </>
      )}

      {/* 생성 완료 */}
      {finalScript && (
        <>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">완성 대본</p>
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{finalScript}</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onPrev}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              수정
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              재생성
            </button>
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm text-indigo-600 border border-indigo-300 hover:bg-indigo-50 font-semibold py-2.5 rounded-xl transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {copied ? '복사됨 ✓' : '복사'}
            </button>
          </div>

          <button
            onClick={() => onSave(finalScript)}
            disabled={saving || saved}
            className={`w-full flex items-center justify-center gap-2 font-semibold py-2.5 rounded-xl transition-colors text-sm ${
              saved
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default'
                : saving
                ? 'bg-gray-100 text-gray-400 cursor-wait'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {saved ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                내 보관함에 저장됨
              </>
            ) : saving ? (
              <>
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                저장 중...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                내 보관함에 저장
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}

export default function ScriptPanel({ analysis, referenceText, referenceId, initialTemplateData }) {
  const { user } = useApp();
  const [templateData, setTemplateData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [done, setDone] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!referenceText || !templateData) return;
    try {
      localStorage.setItem(STEPS_DRAFT_KEY, JSON.stringify({
        referenceText,
        answers,
        currentStep,
        done,
      }));
    } catch {}
  }, [answers, currentStep, done, referenceText, templateData]);

  // 새 형식(sentence 필드 있음)의 초기 템플릿만 바로 사용
  useEffect(() => {
    if (!referenceText || !analysis || !initialTemplateData || templateData) return;
    const isNewFormat = initialTemplateData.steps?.[0]?.sentence != null;
    if (!isNewFormat) return;
    setTemplateData(initialTemplateData);
    const stepsLen = (initialTemplateData.steps || []).length;
    const restored = tryRestoreStepsDraft(referenceText, stepsLen);
    setAnswers(restored.answers);
    setCurrentStep(restored.currentStep);
    setDone(restored.done);
  }, [referenceText, analysis]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGenerateTemplate() {
    if (!referenceText || loading) return;
    setLoading(true);
    setError('');
    setTemplateData(null);
    setSaved(false);
    try {
      const data = await generateTemplate(referenceText);
      console.log('[ScriptPanel] generateTemplate 응답:', JSON.stringify({
        hookType: data?.hookType,
        stepsLen: data?.steps?.length,
        step0: data?.steps?.[0],
      }));
      const firstStep = data.steps?.[0];
      // 구 포맷(section/why/how/example) 또는 필수 필드 누락 체크
      if (!firstStep?.sentence || !firstStep?.role || !firstStep?.question) {
        console.error('[ScriptPanel] format error — step[0]:', firstStep);
        setError('코치 데이터 형식 오류가 발생했습니다. 다시 시도해주세요.');
        return;
      }
      setTemplateData(data);
      const stepsLen = (data.steps || []).length;
      const restored = tryRestoreStepsDraft(referenceText, stepsLen);
      setAnswers(restored.answers);
      setCurrentStep(restored.currentStep);
      setDone(restored.done);
    } catch (e) {
      setError(e.message || '코치 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  const steps = templateData?.steps || [];

  function handleAnswerChange(val) {
    setAnswers((prev) => prev.map((a, i) => i === currentStep ? val : a));
  }

  function handleNext() {
    if (currentStep < steps.length - 1) setCurrentStep((s) => s + 1);
    else setDone(true);
  }

  function handlePrev() {
    if (done) { setDone(false); return; }
    setCurrentStep((s) => Math.max(0, s - 1));
  }

  async function handleSave(script) {
    if (!user || !script) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'myScripts'), {
        userId: user.uid,
        createdAt: serverTimestamp(),
        script,
        preview: script.slice(0, 50),
        referenceId: referenceId || null,
      });
      setSaved(true);
      setToast('내 보관함에 저장됐어요');
      setTimeout(() => setToast(''), 2500);
    } catch (e) {
      console.error('save failed:', e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg z-50 flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          {toast}
        </div>
      )}
      <div className="flex flex-col h-full">
        <div className="p-5 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-bold text-gray-900 mb-0.5">스크립트 작성</h2>
          <p className="text-xs text-gray-500">레퍼런스 문장 구조를 따라 내 상황을 대입해 대본을 만들어보세요</p>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {!analysis ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-500">먼저 왼쪽에서 레퍼런스 대본을 분석해주세요</p>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-gray-400">문장별 코치 생성 중...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col gap-3">
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
              <button
                onClick={handleGenerateTemplate}
                className="flex items-center justify-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 border border-indigo-200 hover:bg-indigo-50 px-4 py-2.5 rounded-xl transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                다시 시도
              </button>
            </div>
          ) : !templateData ? (
            <div className="flex flex-col items-center justify-center h-56 text-center px-4">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                레퍼런스 문장 하나하나를 분석해서<br />내 상황에 맞는 질문을 만들어드려요
              </p>
              <button
                onClick={handleGenerateTemplate}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                코치 가이드 생성하기
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {/* 후킹 유형 + 공감 포인트 */}
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-orange-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  {templateData.hookType && (
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${templateData.isNewType ? 'bg-amber-100 text-amber-700' : 'bg-orange-100 text-orange-600'}`}>
                      {templateData.isNewType ? '✦ ' : ''}{templateData.hookType}
                    </span>
                  )}
                </div>
                <p className="text-xs text-orange-900 leading-relaxed">{templateData.empathyPoint}</p>
                {templateData.empathyTags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {templateData.empathyTags.map((tag, i) => (
                      <span key={i} className="text-[11px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">#{tag}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* 진행바 */}
              {steps.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-gray-500">
                      {done ? '완성!' : `STEP ${currentStep + 1} / ${steps.length}`}
                    </span>
                    <span className="text-xs text-gray-400">
                      {done ? steps.length : currentStep}/{steps.length} 완료
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {steps.map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          done || i < currentStep
                            ? 'bg-indigo-500'
                            : i === currentStep
                            ? 'bg-indigo-300'
                            : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 단계별 코치 or 완성 화면 */}
              {done ? (
                <CompletionView
                  steps={steps}
                  answers={answers}
                  hookType={templateData.hookType}
                  onPrev={handlePrev}
                  onSave={handleSave}
                  saving={saving}
                  saved={saved}
                />
              ) : steps.length > 0 ? (
                <StepCard
                  key={currentStep}
                  step={steps[currentStep]}
                  index={currentStep}
                  total={steps.length}
                  answer={answers[currentStep] || ''}
                  onAnswerChange={handleAnswerChange}
                  onNext={handleNext}
                  onPrev={handlePrev}
                />
              ) : null}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
