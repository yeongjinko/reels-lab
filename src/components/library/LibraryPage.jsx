import React, { useState, useEffect } from 'react';
import {
  collection, addDoc, deleteDoc, doc,
  query, where, orderBy, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase/config';
import { useApp } from '../../App';

export default function LibraryPage() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formLink, setFormLink] = useState('');
  const [formScript, setFormScript] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const q = query(
      collection(db, 'referenceLibrary'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('referenceLibrary snapshot error:', err);
        setLoading(false);
      }
    );
  }, [user]);

  async function handleAdd() {
    if (!formScript.trim() || !user) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'referenceLibrary'), {
        userId: user.uid,
        createdAt: serverTimestamp(),
        link: formLink.trim() || null,
        script: formScript.trim(),
        preview: formScript.trim().slice(0, 50),
        analyzed: false,
        hookType: null,
        empathyTags: [],
        empathyPoint: null,
        analysis: null,
      });
      setFormLink('');
      setFormScript('');
      setShowForm(false);
    } catch (e) {
      console.error('add failed:', e);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(e, id) {
    e.stopPropagation();
    if (!confirm('이 레퍼런스를 삭제할까요?')) return;
    setDeleting(id);
    try {
      await deleteDoc(doc(db, 'referenceLibrary', id));
    } finally {
      setDeleting(null);
    }
  }

  function handleAnalyze(item) {
    navigate('/', {
      state: {
        libraryItem: {
          id: item.id,
          script: item.script,
          analysis: item.analyzed ? item.analysis : null,
        },
      },
    });
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">레퍼런스 라이브러리</h1>
          <p className="text-sm text-gray-500 mt-0.5">레퍼런스 대본을 저장하고 관리해보세요</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          새 레퍼런스 추가
        </button>
      </div>

      {/* 추가 폼 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">새 레퍼런스 추가</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  링크 <span className="font-normal text-gray-400 normal-case">(선택사항 · 인스타/틱톡 URL)</span>
                </label>
                <input
                  type="url"
                  value={formLink}
                  onChange={(e) => setFormLink(e.target.value)}
                  placeholder="https://www.instagram.com/reel/..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  대본 텍스트 <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={formScript}
                  onChange={(e) => setFormScript(e.target.value)}
                  placeholder="레퍼런스 대본을 붙여넣으세요..."
                  rows={6}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 placeholder-gray-400 resize-none"
                  autoFocus
                />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button
                onClick={handleAdd}
                disabled={!formScript.trim() || saving}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
              >
                {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                저장
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 카드 목록 */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48 gap-2">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">불러오는 중...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <p className="text-gray-600 font-medium">아직 저장된 레퍼런스가 없어요</p>
            <p className="text-sm text-gray-400 mt-1">위의 "새 레퍼런스 추가" 버튼으로 시작해보세요</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <div key={item.id} className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col gap-3 hover:shadow-md transition-shadow group">

                {/* 상단: 상태 + 링크 + 삭제 */}
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    item.analyzed ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {item.analyzed ? '분석완료' : '미분석'}
                  </span>
                  {item.analyzed && item.hookType && (
                    <span className="text-[11px] bg-indigo-100 text-indigo-600 font-semibold px-2 py-0.5 rounded-full truncate max-w-[120px]">
                      {item.hookType}
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                    {item.link && (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-gray-400 hover:text-indigo-500 transition-colors"
                        title="원본 링크"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                      </a>
                    )}
                    <button
                      onClick={(e) => handleDelete(e, item.id)}
                      disabled={deleting === item.id}
                      className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      title="삭제"
                    >
                      {deleting === item.id ? (
                        <div className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* 대본 미리보기 */}
                <p className="text-sm text-gray-700 leading-relaxed line-clamp-3 flex-1">
                  {item.preview || item.script?.slice(0, 80)}
                </p>

                {/* 분석완료 태그 */}
                {item.analyzed && item.empathyTags?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.empathyTags.slice(0, 3).map((tag, i) => (
                      <span key={i} className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* 분석하기 버튼 */}
                <button
                  onClick={() => handleAnalyze(item)}
                  className={`w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl transition-colors ${
                    item.analyzed
                      ? 'bg-gray-50 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200 hover:border-indigo-200'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  {item.analyzed ? '스크립트 기획하기' : '분석하기'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
