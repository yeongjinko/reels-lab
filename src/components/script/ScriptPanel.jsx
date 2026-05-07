import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useApp } from '../../App';
import { generateTemplate, generateSentenceVariants, generateQuestions } from '../../services/anthropic';

// ─── Josa helpers ─────────────────────────────────────────────────────────────

function getLastConsonant(word) {
  if (!word) return null;
  const last = word[word.length - 1];
  const code = last.charCodeAt(0);
  if (code < 0xAC00 || code > 0xD7A3) return null;
  return (code - 0xAC00) % 28;
}

function applyJosa(word, hint) {
  if (!word) return '';
  const lc = getLastConsonant(word);
  if (lc === null) return word;
  const noFinal = lc === 0;
  switch (hint) {
    case '이/가': return word + (noFinal ? '가' : '이');
    case '을/를': return word + (noFinal ? '를' : '을');
    case '은/는': return word + (noFinal ? '는' : '은');
    case '과/와': return word + (noFinal ? '와' : '과');
    case '으로/로': return word + (noFinal || lc === 8 ? '로' : '으로');
    default: return word;
  }
}

// ─── Template parsing ─────────────────────────────────────────────────────────

function parseTemplateLine(line) {
  const parts = [];
  const regex = /\[([^\]:]+)(?::([^\]]+))?\]/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: line.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'tag', tag: match[1], josa: match[2] || null });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < line.length) {
    parts.push({ type: 'text', content: line.slice(lastIndex) });
  }
  return parts;
}

// ─── TagInputCard ─────────────────────────────────────────────────────────────

function TagInputCard({ tagInfo, value, onChange }) {
  const filled = Boolean(value);
  return (
    <div className="mb-3.5">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border leading-tight ${
          filled
            ? 'bg-green-100 text-green-700 border-green-200'
            : 'bg-yellow-100 text-yellow-700 border-yellow-200'
        }`}>
          {tagInfo.tag}
        </span>
        {tagInfo.occurrences > 1 && (
          <span className="text-[10px] text-gray-400">{tagInfo.occurrences}곳</span>
        )}
        {filled && (
          <svg className="w-3 h-3 text-green-500 ml-auto flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <p className="text-[11px] text-gray-500 mb-1 leading-snug">{tagInfo.description}</p>
      <input
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={tagInfo.example ? `예) ${tagInfo.example}` : '입력...'}
        className={`w-full border rounded-lg px-2.5 py-1.5 text-xs outline-none transition-colors placeholder-gray-400 ${
          filled
            ? 'border-green-200 bg-green-50 focus:ring-1 focus:ring-green-400'
            : 'border-gray-200 bg-white focus:ring-1 focus:ring-yellow-400'
        }`}
      />
    </div>
  );
}

// ─── TagDisplay (read-only chip in template) ─────────────────────────────────

function TagDisplay({ tag, josa, value }) {
  const filled = Boolean(value);
  const display = filled
    ? (josa ? applyJosa(value, josa) : value)
    : (josa ? `[${tag}:${josa}]` : `[${tag}]`);

  return (
    <span className={`mx-0.5 text-sm font-medium ${
      filled
        ? 'text-green-800'
        : 'text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-sm px-0.5'
    }`}>
      {display}
    </span>
  );
}

// ─── SentenceEditPanel ────────────────────────────────────────────────────────

function SentenceEditPanel({ sentence, filledTags, onApply, onClose, onReset, hasOverride }) {
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [customText, setCustomText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { loadVariants(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadVariants() {
    setLoading(true);
    setError('');
    try {
      const data = await generateSentenceVariants(sentence.text, sentence.role, sentence.effect, filledTags);
      setVariants(data.variants || []);
    } catch {
      setError('추천 표현 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-1 mb-2 bg-indigo-50 border border-indigo-200 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-indigo-700">역할</span>
          <span className="text-xs text-indigo-900">{sentence.role}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {hasOverride && (
            <button onClick={onReset} className="text-[11px] text-gray-400 hover:text-gray-600 border border-gray-200 rounded px-2 py-0.5">
              원래대로
            </button>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-2">
          <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-gray-400">AI 추천 표현 생성 중...</span>
        </div>
      ) : error ? (
        <p className="text-xs text-red-500 mb-2">{error}</p>
      ) : variants.length > 0 ? (
        <div className="mb-3">
          <p className="text-[11px] font-bold text-gray-400 mb-1.5">AI 추천 표현</p>
          <div className="flex flex-col gap-1.5">
            {variants.map((v, i) => (
              <button
                key={i}
                onClick={() => onApply(v)}
                className="text-left text-xs text-indigo-800 bg-white hover:bg-indigo-100 border border-indigo-200 rounded-lg px-3 py-2 transition-colors"
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <p className="text-[11px] font-bold text-gray-400 mb-1.5">직접 입력</p>
        <div className="flex gap-2">
          <input
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customText.trim()) { onApply(customText.trim()); setCustomText(''); }
            }}
            placeholder="직접 문장을 입력하세요"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            onClick={() => { if (customText.trim()) { onApply(customText.trim()); setCustomText(''); } }}
            disabled={!customText.trim()}
            className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400"
          >
            적용
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── QuestionModal (alignment check only) ─────────────────────────────────────

function QuestionModal({ hookType, empathyPoint, onComplete, onClose }) {
  const [phase, setPhase] = useState('initialLoading');
  const [suitableFor, setSuitableFor] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => { loadSuitableFor(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadSuitableFor() {
    setPhase('initialLoading');
    setError('');
    try {
      const data = await generateQuestions(hookType, empathyPoint, []);
      setSuitableFor(data.suitableFor || []);
      setPhase('alignment');
    } catch (e) {
      setError(e.message || '오류가 발생했습니다.');
      setPhase('error');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
          <h3 className="font-bold text-gray-900 text-sm">
            {phase === 'alignment' ? '결 맞는지 확인' : phase === 'noMatch' ? '다른 레퍼런스 찾기' : ''}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {phase === 'initialLoading' && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-gray-400">이 릴스가 어떤 상황에 맞는지 확인 중...</p>
            </div>
          )}

          {phase === 'alignment' && (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-gray-800">이 릴스는 이런 상황에 잘 맞아요</p>
              <div className="flex flex-col gap-2 mt-1">
                {suitableFor.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => onComplete()}
                    className="flex items-center gap-3 text-left w-full px-4 py-3.5 border border-gray-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-colors group"
                  >
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300 group-hover:border-indigo-500 flex-shrink-0 transition-colors" />
                    <span className="text-sm text-gray-700 group-hover:text-indigo-800 leading-snug">{item}</span>
                  </button>
                ))}
                <button
                  onClick={() => setPhase('noMatch')}
                  className="flex items-center gap-3 text-left w-full px-4 py-3.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <div className="w-4 h-4 rounded-full border-2 border-gray-200 flex-shrink-0" />
                  <span className="text-sm text-gray-400">해당 없음</span>
                </button>
              </div>
            </div>
          )}

          {phase === 'noMatch' && (
            <div className="flex flex-col gap-4 py-2">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-amber-800 mb-1.5">이 레퍼런스는 다른 상황에 맞아요</p>
                <p className="text-xs text-amber-700 leading-relaxed">{empathyPoint || '이 구조는 특정 후킹 유형에 맞게 설계됐어요.'}</p>
              </div>
              <p className="text-xs text-gray-500">내 상황에 맞는 다른 레퍼런스를 찾아보시겠어요?</p>
              <button
                onClick={onClose}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl text-sm"
              >
                레퍼런스 라이브러리 보기
              </button>
            </div>
          )}

          {phase === 'error' && (
            <div className="flex flex-col gap-3 py-4">
              <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-4 py-3">{error}</div>
              <button onClick={loadSuitableFor} className="text-sm text-indigo-600 border border-indigo-200 hover:bg-indigo-50 font-semibold py-2.5 rounded-xl">
                다시 시도
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ScriptPanel (main) ───────────────────────────────────────────────────────

export default function ScriptPanel({ analysis, referenceText, referenceId, initialTemplateData }) {
  const { user } = useApp();

  const [templateData, setTemplateData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showQuestionModal, setShowQuestionModal] = useState(false);

  const [tagValues, setTagValues] = useState({});
  const [sentenceOverrides, setSentenceOverrides] = useState({});
  const [editingSentenceIndex, setEditingSentenceIndex] = useState(null);

  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!referenceText || !analysis || !initialTemplateData || templateData) return;
    if (initialTemplateData.template != null) {
      setTemplateData(initialTemplateData);
    }
  }, [referenceText, analysis]); // eslint-disable-line react-hooks/exhaustive-deps

  const templateLines = useMemo(
    () => (templateData?.template || '').split('\n'),
    [templateData]
  );

  // Recompute occurrences from actual template (more accurate than AI-reported)
  const tagOccurrences = useMemo(() => {
    const counts = {};
    for (const line of templateLines) {
      for (const m of [...line.matchAll(/\[([^\]:]+)(?::[^\]]+)?\]/g)]) {
        counts[m[1]] = (counts[m[1]] || 0) + 1;
      }
    }
    return counts;
  }, [templateLines]);

  const tags = useMemo(() => {
    if (!templateData?.tags) return [];
    return templateData.tags.map((t) => ({
      ...t,
      occurrences: tagOccurrences[t.tag] || 1,
    }));
  }, [templateData, tagOccurrences]);

  const completedScript = useMemo(() => {
    return templateLines.map((line, i) => {
      if (sentenceOverrides[i] !== undefined) return sentenceOverrides[i];
      return line.replace(/\[([^\]:]+)(?::([^\]]+))?\]/g, (_, tag, josa) => {
        const val = tagValues[tag] || '';
        if (!val) return `[${tag}]`;
        return josa ? applyJosa(val, josa) : val;
      });
    }).join('\n');
  }, [templateLines, tagValues, sentenceOverrides]);

  const hasUnfilledTags = useMemo(() => /\[[^\]]+\]/.test(completedScript), [completedScript]);

  const filledCount = useMemo(
    () => tags.filter((t) => Boolean(tagValues[t.tag])).length,
    [tags, tagValues]
  );

  async function handleGenerateTemplate() {
    if (!referenceText || loading) return;
    setLoading(true);
    setError('');
    setTemplateData(null);
    setTagValues({});
    setSentenceOverrides({});
    setEditingSentenceIndex(null);
    setSaved(false);
    try {
      const data = await generateTemplate(referenceText, {});
      if (!data.template || !Array.isArray(data.tags) || !Array.isArray(data.sentences)) {
        setError('템플릿 형식 오류가 발생했습니다. 다시 시도해주세요.');
        return;
      }
      setTemplateData(data);
    } catch (e) {
      setError(e.message || '템플릿 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  function handleTagChange(tagName, value) {
    setTagValues((prev) => ({ ...prev, [tagName]: value }));
    setEditingSentenceIndex(null);
  }

  function handleSentenceEdit(lineIndex) {
    setEditingSentenceIndex((prev) => (prev === lineIndex ? null : lineIndex));
  }

  function handleSentenceApply(lineIndex, text) {
    setSentenceOverrides((prev) => ({ ...prev, [lineIndex]: text }));
    setEditingSentenceIndex(null);
  }

  function handleSentenceReset(lineIndex) {
    setSentenceOverrides((prev) => {
      const next = { ...prev };
      delete next[lineIndex];
      return next;
    });
  }

  function handleCopy() {
    navigator.clipboard.writeText(completedScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleSave() {
    if (!user || !completedScript) return;
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

      {showQuestionModal && (
        <QuestionModal
          hookType={analysis?.hookFormulaType || analysis?.hookFormula || ''}
          empathyPoint={analysis?.hookFormulaDesc || ''}
          onClose={() => setShowQuestionModal(false)}
          onComplete={() => {
            setShowQuestionModal(false);
            handleGenerateTemplate();
          }}
        />
      )}

      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-bold text-gray-900 mb-0.5">스크립트 작성</h2>
          <p className="text-xs text-gray-500">레퍼런스 구조를 템플릿으로 바꿔 내 상품을 대입해보세요</p>
        </div>

        {/* Pre-template states: single column */}
        {!templateData ? (
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
                <p className="text-xs text-gray-400">단어 치환 템플릿 생성 중...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col gap-3">
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
                <button
                  onClick={() => setShowQuestionModal(true)}
                  className="flex items-center justify-center gap-2 text-sm font-semibold text-indigo-600 border border-indigo-200 hover:bg-indigo-50 px-4 py-2.5 rounded-xl"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  다시 시도
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-56 text-center px-4">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                  레퍼런스 구조를 분석해서<br />빈칸 채우기 템플릿을 만들어드려요
                </p>
                <button
                  onClick={() => setShowQuestionModal(true)}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  코치 가이드 생성하기
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Template editor: two-column layout */
          <div className="flex flex-1 overflow-hidden">

            {/* Left: Tag input panel */}
            <div className="w-44 flex-shrink-0 border-r border-gray-100 overflow-y-auto flex flex-col">
              <div className="p-3.5 flex-1">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">태그 입력</p>
                  <span className="text-[10px] text-gray-400 font-medium">
                    {filledCount}/{tags.length}
                  </span>
                </div>

                {tags.map((tagInfo) => (
                  <TagInputCard
                    key={tagInfo.tag}
                    tagInfo={tagInfo}
                    value={tagValues[tagInfo.tag] || ''}
                    onChange={(val) => handleTagChange(tagInfo.tag, val)}
                  />
                ))}
              </div>

              {/* Regenerate */}
              <div className="p-3 border-t border-gray-100 flex-shrink-0">
                <button
                  onClick={() => setShowQuestionModal(true)}
                  className="w-full flex items-center justify-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg py-2 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  새로 생성
                </button>
              </div>
            </div>

            {/* Right: Template display + preview + actions */}
            <div className="flex-1 overflow-y-auto p-4">

              {/* Hook type badge */}
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3.5 mb-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <svg className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  {templateData.hookType && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      templateData.isNewType ? 'bg-amber-100 text-amber-700' : 'bg-orange-100 text-orange-600'
                    }`}>
                      {templateData.isNewType ? '✦ ' : ''}{templateData.hookType}
                    </span>
                  )}
                </div>
                <p className="text-xs text-orange-900 leading-relaxed">{templateData.empathyPoint}</p>
              </div>

              {/* Template lines */}
              <div className="bg-white border border-gray-200 rounded-xl p-3 mb-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">템플릿</p>
                <div className="flex flex-col gap-0.5">
                  {templateLines.map((line, lineIndex) => {
                    const sentenceData = templateData.sentences[lineIndex];
                    const hasOverride = sentenceOverrides[lineIndex] !== undefined;
                    const isEditingThis = editingSentenceIndex === lineIndex;
                    const parts = parseTemplateLine(line);

                    return (
                      <div key={lineIndex}>
                        <div className="flex items-center gap-1.5 py-1 group min-h-[28px]">
                          <div className="flex-1 text-sm text-gray-800 leading-relaxed">
                            {hasOverride ? (
                              <span className="bg-indigo-50 text-indigo-800 px-1.5 py-0.5 rounded text-sm">
                                {sentenceOverrides[lineIndex]}
                              </span>
                            ) : (
                              <span>
                                {parts.map((part, pIdx) => {
                                  if (part.type === 'text') return <span key={pIdx}>{part.content}</span>;
                                  return (
                                    <TagDisplay
                                      key={pIdx}
                                      tag={part.tag}
                                      josa={part.josa}
                                      value={tagValues[part.tag] || ''}
                                    />
                                  );
                                })}
                              </span>
                            )}
                          </div>
                          {sentenceData && (
                            <button
                              onClick={() => handleSentenceEdit(lineIndex)}
                              className={`flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded border transition-all whitespace-nowrap ${
                                isEditingThis
                                  ? 'bg-indigo-100 text-indigo-700 border-indigo-300 opacity-100'
                                  : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100 hover:text-gray-600 opacity-50 group-hover:opacity-100'
                              }`}
                            >
                              {isEditingThis ? '닫기' : '다르게'}
                            </button>
                          )}
                        </div>

                        {isEditingThis && sentenceData && (
                          <SentenceEditPanel
                            sentence={sentenceData}
                            filledTags={tagValues}
                            onApply={(text) => handleSentenceApply(lineIndex, text)}
                            onClose={() => setEditingSentenceIndex(null)}
                            onReset={() => handleSentenceReset(lineIndex)}
                            hasOverride={hasOverride}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Completed script preview */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">완성된 대본 미리보기</p>
                  {hasUnfilledTags && (
                    <span className="text-[10px] text-amber-500 font-medium">빈 태그 있음</span>
                  )}
                </div>
                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{completedScript}</p>
              </div>

              {/* Copy + Save */}
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="flex-1 flex items-center justify-center gap-1.5 text-sm text-indigo-600 border border-indigo-300 hover:bg-indigo-50 font-semibold py-2.5 rounded-xl transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {copied ? '복사됨 ✓' : '복사'}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || saved}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold py-2.5 rounded-xl transition-colors ${
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
                      저장됨
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
                      보관함에 저장
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
