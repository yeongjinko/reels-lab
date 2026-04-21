import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useApp } from '../../App';

const SHOP_TYPE_BADGE = {
  women: { label: '여성의류', className: 'bg-pink-100 text-pink-700' },
  men: { label: '남성의류', className: 'bg-blue-100 text-blue-700' },
  both: { label: '여성+남성', className: 'bg-purple-100 text-purple-700' },
};

function ScriptDetailModal({ script, onClose }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const full = [
      script.hook && `[훅]\n${script.hook}`,
      script.body && `[본문]\n${script.body}`,
      script.cta && `[CTA]\n${script.cta}`,
    ]
      .filter(Boolean)
      .join('\n\n');
    navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const badge = SHOP_TYPE_BADGE[script.shopType];
  const date = script.createdAt?.toDate?.()?.toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-start justify-between p-6 border-b border-gray-100 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-gray-900">{script.productName}</h2>
              {badge && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>
                  {badge.label}
                </span>
              )}
            </div>
            {date && <p className="text-xs text-gray-400">{date}</p>}
            {script.features && <p className="text-sm text-gray-500 mt-1">{script.features}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-4 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {script.hookFormula && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 mb-4">
              <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-1">후킹 공식</p>
              <p className="text-indigo-800 font-semibold text-sm">{script.hookFormula}</p>
            </div>
          )}

          <div className="flex flex-col gap-4">
            {script.hook && (
              <div>
                <p className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-1.5">훅 (Hook)</p>
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-3.5">
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{script.hook}</p>
                </div>
              </div>
            )}
            {script.body && (
              <div>
                <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1.5">본문 (Body)</p>
                <div className="bg-green-50 border border-green-100 rounded-xl p-3.5">
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{script.body}</p>
                </div>
              </div>
            )}
            {script.cta && (
              <div>
                <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1.5">CTA</p>
                <div className="bg-red-50 border border-red-100 rounded-xl p-3.5">
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{script.cta}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-700 font-medium py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {copied ? '복사됨 ✓' : '전체 복사'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ArchivePage() {
  const { user } = useApp();
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'scripts'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snap) => {
      setScripts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, [user]);

  async function handleDelete(e, id) {
    e.stopPropagation();
    if (!confirm('이 스크립트를 삭제할까요?')) return;
    setDeleting(id);
    try {
      await deleteDoc(doc(db, 'scripts', id));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      <div className="h-full flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
          <h1 className="text-lg font-bold text-gray-900">내 보관함</h1>
          <p className="text-sm text-gray-500 mt-0.5">저장된 스크립트 {scripts.length}개</p>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : scripts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
              <p className="text-gray-500 font-medium">아직 저장된 스크립트가 없어요</p>
              <p className="text-sm text-gray-400 mt-1">스크립트 기획 페이지에서 작성 후 저장해보세요</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {scripts.map((script) => {
                const badge = SHOP_TYPE_BADGE[script.shopType];
                const date = script.createdAt?.toDate?.()?.toLocaleDateString('ko-KR', {
                  year: 'numeric', month: 'short', day: 'numeric'
                });
                return (
                  <div
                    key={script.id}
                    onClick={() => setSelected(script)}
                    className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{script.productName || '제목 없음'}</h3>
                        {date && <p className="text-xs text-gray-400 mt-0.5">{date}</p>}
                      </div>
                      <button
                        onClick={(e) => handleDelete(e, script.id)}
                        disabled={deleting === script.id}
                        className="ml-2 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    {script.features && (
                      <p className="text-xs text-gray-500 mb-3 line-clamp-2">{script.features}</p>
                    )}

                    {script.hookFormula && (
                      <div className="bg-indigo-50 rounded-lg px-2.5 py-1.5 mb-3">
                        <p className="text-xs text-indigo-600 font-medium truncate">{script.hookFormula}</p>
                      </div>
                    )}

                    {script.hook && (
                      <p className="text-xs text-gray-600 line-clamp-2 mb-3">{script.hook}</p>
                    )}

                    <div className="flex items-center justify-between">
                      {badge && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>
                          {badge.label}
                        </span>
                      )}
                      <span className="text-xs text-indigo-500 font-medium ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                        자세히 보기 →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <ScriptDetailModal script={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
