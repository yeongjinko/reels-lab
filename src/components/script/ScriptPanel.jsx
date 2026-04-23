import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useApp } from '../../App';
import { generateTemplate } from '../../services/anthropic';

function StepCard({ step, index, total, answer, onAnswerChange, onNext, onPrev }) {
  const isLast = index === total - 1;

  return (
    <div className="flex flex-col gap-4">
      {/* 섹션 헤더 */}
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
          {index + 1}
        </span>
        <h3 className="text-sm font-bold text-gray-900">{step.section}</h3>
      </div>

      {/* 왜 이렇게 써야 하나요 */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <svg className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span className="text-xs font-bold text-amber-700">왜 이렇게 써야 하나요?</span>
        </div>
        <p className="text-xs text-amber-900 leading-relaxed">{step.why}</p>
      </div>

      {/* 어떻게 쓰나요 */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <svg className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span className="text-xs font-bold text-indigo-700">어떻게 쓰나요?</span>
        </div>
        <p className="text-xs text-indigo-900 leading-relaxed">{step.how}</p>
      </div>

      {/* 레퍼런스 예시 */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <svg className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
          <span className="text-xs font-bold text-gray-500">레퍼런스 예시</span>
        </div>
        <p className="text-xs text-gray-700 leading-relaxed italic">"{step.example}"</p>
      </div>

      {/* 내 대본 작성 */}
      <div>
        <label className="block text-xs font-bold text-gray-700 mb-2">내 대본 작성</label>
        <textarea
          value={answer}
          onChange={(e) => onAnswerChange(e.target.value)}
          placeholder="위 가이드를 참고해서 직접 써보세요"
          rows={4}
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
          {isLast ? '완성 대본 보기' : '다음 단계'}
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isLast ? 'M5 13l4 4L19 7' : 'M9 5l7 7-7 7'} />
          </svg>
        </button>
      </div>
    </div>
  );
}

function CompletionView({ answers, steps, onPrev, onSave, saving, saved }) {
  const [copied, setCopied] = useState(false);
  const completedScript = answers.filter(Boolean).join('\n');

  function handleCopy() {
    navigator.clipboard.writeText(completedScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 섹션별 요약 */}
      <div className="flex flex-col gap-2">
        {steps.map((step, i) => (
          answers[i] && (
            <div key={i} className="flex gap-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase mt-0.5 w-10 flex-shrink-0">{step.section}</span>
              <p className="text-xs text-gray-600 leading-relaxed flex-1">{answers[i]}</p>
            </div>
          )
        ))}
      </div>

      {/* 완성 대본 전체 */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">완성 대본</p>
        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{completedScript || '작성된 내용이 없습니다.'}</p>
      </div>

      {/* 액션 버튼 */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            onClick={onPrev}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            수정하기
          </button>
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-2 border border-indigo-300 text-indigo-600 hover:bg-indigo-50 font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {copied ? '복사됨 ✓' : '복사'}
          </button>
        </div>
        <button
          onClick={onSave}
          disabled={saving || saved || !completedScript}
          className={`w-full flex items-center justify-center gap-2 font-semibold py-2.5 rounded-xl transition-colors text-sm ${
            saved
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default'
              : saving
              ? 'bg-gray-100 text-gray-400 cursor-wait'
              : !completedScript
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
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
      </div>
    </div>
  );
}

export default function ScriptPanel({ analysis, referenceText, referenceId }) {
  const { user } = useApp();
  const [templateData, setTemplateData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [done, setDone] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!referenceText) return;
    setLoading(true);
    setError('');
    setTemplateData(null);
    setCurrentStep(0);
    setAnswers([]);
    setDone(false);
    setSaved(false);
    generateTemplate(referenceText)
      .then((data) => {
        setTemplateData(data);
        setAnswers(new Array((data.steps || []).length).fill(''));
      })
      .catch((e) => setError(e.message || '코치 생성 중 오류가 발생했습니다.'))
      .finally(() => setLoading(false));
  }, [referenceText]);

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

  async function handleSave() {
    if (!user) return;
    const completedScript = answers.filter(Boolean).join('\n');
    if (!completedScript) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'myScripts'), {
        userId: user.uid,
        createdAt: serverTimestamp(),
        script: completedScript,
        preview: completedScript.slice(0, 50),
        referenceId: referenceId || null,
      });
      setSaved(true);
    } catch (e) {
      console.error('save failed:', e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-gray-100 flex-shrink-0">
        <h2 className="font-bold text-gray-900 mb-0.5">스크립트 작성</h2>
        <p className="text-xs text-gray-500">레퍼런스 구조를 따라 단계별로 내 대본을 써보세요</p>
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
            <p className="text-xs text-gray-400">단계별 코치 생성 중...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        ) : templateData ? (
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
                    {done ? '완성!' : `STEP ${currentStep + 1} / ${steps.length} — ${steps[currentStep]?.section}`}
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
                answers={answers}
                steps={steps}
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
        ) : null}
      </div>
    </div>
  );
}
