import React, { useState, useMemo } from 'react';

export function parseTemplate(template) {
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

export default function TemplateEditor({ template, onChange }) {
  const [values, setValues] = useState({});
  const [activeIdx, setActiveIdx] = useState(null);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState('template'); // 'template' | 'freeEdit'
  const [freeText, setFreeText] = useState('');

  const parts = useMemo(() => parseTemplate(template), [template]);
  const placeholders = parts.filter((p) => p.type === 'placeholder');
  const filledCount = placeholders.filter((p) => values[p.idx]).length;

  const completedScript = parts
    .map((p) => (p.type === 'text' ? p.content : values[p.idx] || `[${p.hint}]`))
    .join('');

  function updateValues(updater) {
    setValues((prev) => {
      const next = updater(prev);
      if (onChange) {
        const script = parts
          .map((p) => (p.type === 'text' ? p.content : next[p.idx] || `[${p.hint}]`))
          .join('');
        onChange(script, parts.filter((q) => q.type === 'placeholder').every((q) => next[q.idx]));
      }
      return next;
    });
  }

  function switchToFreeEdit() {
    setFreeText(completedScript);
    setMode('freeEdit');
  }

  function switchToTemplate() {
    setMode('template');
  }

  const copyTarget = mode === 'freeEdit' ? freeText : completedScript;

  function handleCopy() {
    navigator.clipboard.writeText(copyTarget);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      {/* 모드 전환 탭 */}
      <div className="flex items-center gap-1 mb-3 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={switchToTemplate}
          className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
            mode === 'template'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          템플릿 모드
        </button>
        <button
          onClick={switchToFreeEdit}
          className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
            mode === 'freeEdit'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          전체 편집
        </button>
      </div>

      {mode === 'template' ? (
        <>
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
                    onChange={(e) => updateValues((v) => ({ ...v, [part.idx]: e.target.value }))}
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
        </>
      ) : (
        <>
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            rows={12}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-800 leading-relaxed resize-none outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="자유롭게 수정하세요..."
          />
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-gray-400">{freeText.length}자</p>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {copied ? '복사됨 ✓' : '대본 복사'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
