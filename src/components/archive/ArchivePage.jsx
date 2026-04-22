import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useApp } from '../../App';

export default function ArchivePage() {
  const { user } = useApp();
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const q = query(
      collection(db, 'myScripts'),
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
      await deleteDoc(doc(db, 'myScripts', id));
    } finally {
      setDeleting(null);
    }
  }

  function handleCopy(e, script, id) {
    e.stopPropagation();
    navigator.clipboard.writeText(script);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <h1 className="text-lg font-bold text-gray-900">내 보관함</h1>
        <p className="text-sm text-gray-500 mt-0.5">완성된 스크립트 {scripts.length}개</p>
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
            <p className="text-sm text-gray-400 mt-1">분석 후 저장해보세요</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {scripts.map((script) => {
              const date = script.createdAt?.toDate?.()?.toLocaleDateString('ko-KR', {
                year: 'numeric', month: 'short', day: 'numeric',
              });
              return (
                <div
                  key={script.id}
                  className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow group flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    {date && <p className="text-xs text-gray-400">{date}</p>}
                    <button
                      onClick={(e) => handleDelete(e, script.id)}
                      disabled={deleting === script.id}
                      className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 ml-auto"
                    >
                      {deleting === script.id ? (
                        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>

                  <p className="text-sm text-gray-800 leading-relaxed line-clamp-5 flex-1 whitespace-pre-wrap">
                    {script.preview || script.script?.slice(0, 120)}
                  </p>

                  <button
                    onClick={(e) => handleCopy(e, script.script, script.id)}
                    className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 py-2 rounded-xl transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    {copiedId === script.id ? '복사됨 ✓' : '복사'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
