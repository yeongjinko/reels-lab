import React, { useState, useEffect, useMemo } from 'react';
import { generateTemplate } from '../../services/anthropic';

function parseTemplate(template) {
  const parts = [];
  const regex = /\[([^\]]+)\]/g;
  let lastIndex = 0;
  let match;
  let idx = 0;

  while ((match = regex.exec(template)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: template.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'placeholder', hint: match[1], idx: idx++ });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < template.length) {
    parts.push({ type: 'text', content: template.slice(lastIndex) });
  }

  return parts;
}

function TemplateEditor({ template }) {
  const [values, setValues] = useState({});
  const [activeIdx, setActiveIdx] = useState(null);
  const [copied, setCopied] = useState(false);

  const parts = useMemo(() => parseTemplate(template), [template]);
  const placeholders = parts.filter((p) => p.type === 'placeholder');
  const filledCount = placeholders.filter((p) => values[p.idx]).length;

  const completedScript = parts
    .map((p) => (p.type === 'text' ? p.content : values[p.idx] || `[${p.hint}]`))
    .join('');

  function handleCopy() {
    navigator.clipboard.writeText(completedScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm leading-8 whitespace-pre-wrap">
        {parts.map((part, i) => {
          if (part.type === 'text') {
            return <React.Fragment key={i}>{part.content}</React.Fragment>;
          }

          const value = values[part.idx] || '';
          const isActive = activeIdx === part.idx;

          if (isActive) {
            return (
              <input
                key={i}
                autoFocus
                value={value}
                onChange={(e) => setValues((v) => ({ ...v, [part.idx]: e.target.value }))}
                onBlur={() => setActiveIdx(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); setActiveIdx(null); }
                }}
                placeholder={part.hint}
                className="bg-indigo-50 border-0 border-b-2 border-indigo-500 outline-none px-1 rounded-t-sm text-sm text-gray-900 placeholder-gray-400 align-baseline"
                style={{ width: `${Math.max(72, Math.max(value.length, part.hint.length) * 9)}px` }}
              />
            );
          }

          return (
            <span
              key={i}
              onClick={() => setActiveIdx(part.idx)}
              className={`cursor-pointer rounded px-1.5 transition-colors align-baseline ${
                value
                  ? 'bg-indigo-100 text-indigo-800 font-medium hover:bg-indigo-200'
                  : 'bg-yellow-100 text-yellow-700 border-b border-yellow-400 hover:bg-yellow-200'
              }`}
            >
              {value || part.hint}
            </span>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {placeholders.length > 0 ? `${filledCount}/${placeholders.length} 채움` : '빈칸 없음'}
        </p>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {copied ? '복사됨 ✓' : '완성 대본 복사'}
        </button>
      </div>
    </div>
  );
}

export default function ScriptPanel({ analysis, referenceText }) {
  const [templateData, setTemplateData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!referenceText) return;
    setLoading(true);
    setError('');
    setTemplateData(null);
    generateTemplate(referenceText)
      .then((data) => setTemplateData(data))
      .catch((e) => setError(e.message || '템플릿 생성 중 오류가 발생했습니다.'))
      .finally(() => setLoading(false));
  }, [referenceText]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-gray-100">
        <h2 className="font-bold text-gray-900 mb-0.5">스크립트 작성</h2>
        <p className="text-xs text-gray-500">공감 포인트와 템플릿으로 내 스크립트를 만들어보세요</p>
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
            <p className="text-xs text-gray-400">공감 포인트와 템플릿 생성 중...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        ) : templateData ? (
          <div className="flex flex-col gap-5">

            {/* 공감 포인트 */}
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <svg className="w-4 h-4 text-orange-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <span className="text-xs font-bold text-orange-700 uppercase tracking-wider">이 영상의 공감 포인트</span>
                {templateData.hookType && (
                  <span className={`ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                    templateData.isNewType
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-orange-100 text-orange-600'
                  }`}>
                    {templateData.isNewType ? '✦ 새 유형 · ' : ''}{templateData.hookType}
                  </span>
                )}
              </div>
              <p className="text-sm text-orange-900 leading-relaxed">{templateData.empathyPoint}</p>
            </div>

            {/* 스크립트 템플릿 */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">내 스크립트 템플릿</span>
              </div>
              <p className="text-xs text-gray-400 mb-3">
                노란 빈칸을 클릭해서 내 상품에 맞게 채워보세요
              </p>
              <TemplateEditor key={templateData.template} template={templateData.template} />
            </div>

          </div>
        ) : null}
      </div>
    </div>
  );
}
