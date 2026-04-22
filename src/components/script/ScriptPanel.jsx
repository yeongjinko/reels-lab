import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useApp } from '../../App';
import { generateTemplate } from '../../services/anthropic';
import TemplateEditor from '../common/TemplateEditor';

const CATEGORIES = [
  { id: '의류', icon: '👗' },
  { id: '뷰티', icon: '💄' },
  { id: '식품', icon: '🍱' },
  { id: '생활용품', icon: '🏠' },
  { id: '기타', icon: '📦' },
];

export default function ScriptPanel({ analysis, referenceText, initialTemplateData }) {
  const { user } = useApp();
  const [templateData, setTemplateData] = useState(initialTemplateData || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [categoryPopup, setCategoryPopup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const initialRef = useRef(initialTemplateData);

  useEffect(() => {
    if (!referenceText) return;
    if (initialRef.current) {
      setTemplateData(initialRef.current);
      initialRef.current = null;
      return;
    }
    setLoading(true);
    setError('');
    setTemplateData(null);
    setSaved(false);
    generateTemplate(referenceText)
      .then((data) => setTemplateData(data))
      .catch((e) => setError(e.message || '템플릿 생성 중 오류가 발생했습니다.'))
      .finally(() => setLoading(false));
  }, [referenceText]);

  async function handleSave(category) {
    if (!user || !templateData || !referenceText) return;
    setSaving(true);
    setCategoryPopup(false);
    try {
      await addDoc(collection(db, 'library'), {
        userId: user.uid,
        createdAt: serverTimestamp(),
        script: referenceText,
        hookType: templateData.hookType || '',
        isNewType: templateData.isNewType || false,
        empathyPoint: templateData.empathyPoint || '',
        empathyTags: templateData.empathyTags || [],
        category,
        preview: referenceText.slice(0, 50),
        hookFormula: analysis?.hookFormula || '',
        hookFormulaDesc: analysis?.hookFormulaDesc || '',
        sentences: analysis?.sentences || [],
        template: templateData.template || '',
      });
      setSaved(true);
    } catch (e) {
      console.error('library save failed:', e);
    } finally {
      setSaving(false);
    }
  }

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
                    templateData.isNewType ? 'bg-amber-100 text-amber-700' : 'bg-orange-100 text-orange-600'
                  }`}>
                    {templateData.isNewType ? '✦ ' : ''}{templateData.hookType}
                  </span>
                )}
              </div>
              <p className="text-sm text-orange-900 leading-relaxed mb-3">{templateData.empathyPoint}</p>
              {templateData.empathyTags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {templateData.empathyTags.map((tag, i) => (
                    <span key={i} className="text-[11px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 스크립트 템플릿 */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">내 스크립트 템플릿</span>
              </div>
              <p className="text-xs text-gray-400 mb-3">노란 빈칸을 클릭해서 내 상품에 맞게 채워보세요</p>
              <TemplateEditor key={templateData.template} template={templateData.template} />
            </div>

            {/* 라이브러리 저장 */}
            <div className="border-t border-gray-100 pt-4">
              <button
                onClick={() => setCategoryPopup(true)}
                disabled={saving || saved}
                className={`w-full flex items-center justify-center gap-2 font-semibold py-2.5 rounded-xl transition-colors text-sm ${
                  saved
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default'
                    : saving
                    ? 'bg-gray-100 text-gray-400 cursor-wait'
                    : 'bg-white border border-gray-200 text-gray-700 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50'
                }`}
              >
                {saved ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    라이브러리에 저장됨
                  </>
                ) : saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    레퍼런스 라이브러리에 저장
                  </>
                )}
              </button>
            </div>

          </div>
        ) : null}
      </div>

      {/* 카테고리 선택 팝업 */}
      {categoryPopup && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">카테고리 선택</h3>
            <p className="text-xs text-gray-500 mb-4">이 레퍼런스의 상품 카테고리를 선택해주세요</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleSave(cat.id)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all"
                >
                  <span className="text-xl">{cat.icon}</span>
                  <span className="text-xs font-semibold text-gray-700">{cat.id}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setCategoryPopup(false)}
              className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
