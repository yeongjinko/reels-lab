import React, { useState } from 'react';
import { generateDraft } from '../../services/anthropic';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useApp } from '../../App';

function SectionEditor({ label, value, onChange, hint, placeholder, rows = 3 }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</label>
        {value && (
          <button onClick={handleCopy} className="text-xs text-gray-400 hover:text-indigo-600 transition-colors">
            {copied ? '복사됨 ✓' : '복사'}
          </button>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 placeholder-gray-400 leading-relaxed"
      />
      {hint && (
        <div className="mt-1.5 flex items-start gap-1.5">
          <svg className="w-3.5 h-3.5 text-indigo-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-indigo-500 leading-relaxed">{hint}</p>
        </div>
      )}
    </div>
  );
}

export default function ScriptPanel({ analysis }) {
  const { user } = useApp();
  const [productName, setProductName] = useState('');
  const [features, setFeatures] = useState('');
  const [hook, setHook] = useState('');
  const [body, setBody] = useState('');
  const [cta, setCta] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function handleGenerate() {
    if (!productName.trim() || !analysis) return;
    setGenerating(true);
    setError('');
    try {
      const result = await generateDraft(
        productName.trim(),
        features.trim(),
        analysis
      );
      setHook(result.hook || '');
      setBody(result.body || '');
      setCta(result.cta || '');
    } catch (e) {
      setError(e.message || '생성 중 오류가 발생했습니다.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!productName.trim() || !hook) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'scripts'), {
        userId: user.uid,
        productName: productName.trim(),
        features: features.trim(),
        hookFormula: analysis?.hookFormula || '',
        hookFormulaDesc: analysis?.hookFormulaDesc || '',
        sentences: analysis?.sentences || [],
        hook,
        body,
        cta,
        createdAt: serverTimestamp(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  function handleCopyAll() {
    const full = [
      hook && `[훅]\n${hook}`,
      body && `[본문]\n${body}`,
      cta && `[CTA]\n${cta}`,
    ]
      .filter(Boolean)
      .join('\n\n');
    navigator.clipboard.writeText(full);
  }

  const canGenerate = !!(productName.trim() && analysis);
  const hasContent = !!(hook || body || cta);

  return (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-gray-100">
        <h2 className="font-bold text-gray-900 mb-0.5">스크립트 작성</h2>
        <p className="text-xs text-gray-500">상품 정보를 입력하면 AI가 분석된 공식으로 초안을 생성합니다</p>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                상품명 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="예: 여름 린넨 슬랙스"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                핵심 특징
              </label>
              <input
                type="text"
                value={features}
                onChange={(e) => setFeatures(e.target.value)}
                placeholder="예: 시원한 소재, 허리 밴딩, 3가지 컬러"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50"
              />
            </div>
          </div>

          {!analysis && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
              <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-xs text-amber-700">먼저 왼쪽에서 레퍼런스 대본을 분석해주세요</p>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={!canGenerate || generating}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-indigo-300 disabled:to-purple-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                초안 생성 중...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                AI 초안 생성
              </>
            )}
          </button>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <div className="border-t border-gray-100 pt-4 flex flex-col gap-4">
            <SectionEditor
              label="훅 (Hook)"
              value={hook}
              onChange={setHook}
              placeholder="시청자의 시선을 사로잡는 첫 문장"
              rows={2}
              hint={analysis?.hookFormula ? `공식: ${analysis.hookFormula}` : undefined}
            />
            <SectionEditor
              label="본문 (Body)"
              value={body}
              onChange={setBody}
              placeholder="상품의 핵심 가치와 특징을 설명하는 내용"
              rows={4}
            />
            <SectionEditor
              label="CTA (Call to Action)"
              value={cta}
              onChange={setCta}
              placeholder="시청자에게 행동을 유도하는 마지막 문구"
              rows={2}
            />
          </div>

          {hasContent && (
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCopyAll}
                className="flex-1 flex items-center justify-center gap-2 border border-gray-200 text-gray-700 font-medium py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                전체 복사
              </button>
              <button
                onClick={handleSave}
                disabled={saving || saved}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
              >
                {saved ? (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    저장됨
                  </>
                ) : saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
          )}
        </div>
      </div>
    </div>
  );
}
