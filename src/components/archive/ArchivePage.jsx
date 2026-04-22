import React, { useEffect, useState, useMemo } from 'react';
import {
  collection, query, where, onSnapshot, deleteDoc, updateDoc,
  doc, addDoc, serverTimestamp, getDocs,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useApp } from '../../App';

function FolderSidebar({ folders, scripts, selectedFolderId, onSelect, onCreateFolder, onRenameFolder, onDeleteFolder }) {
  const [showInput, setShowInput] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  function countInFolder(folderId) {
    if (folderId === null) return scripts.length;
    if (folderId === 'uncat') return scripts.filter(s => !s.folderId).length;
    return scripts.filter(s => s.folderId === folderId).length;
  }

  async function submitCreate() {
    if (!newName.trim()) { setShowInput(false); return; }
    await onCreateFolder(newName.trim());
    setNewName('');
    setShowInput(false);
  }

  async function submitRename(id) {
    if (!editingName.trim()) { setEditingId(null); return; }
    await onRenameFolder(id, editingName.trim());
    setEditingId(null);
  }

  const btnBase = 'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors text-left';
  const active = 'bg-indigo-50 text-indigo-700 font-semibold';
  const inactive = 'text-gray-600 hover:bg-gray-100';

  return (
    <div className="w-48 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col overflow-y-auto">
      <div className="p-2 flex flex-col gap-0.5">
        <button onClick={() => onSelect(null)} className={`${btnBase} ${selectedFolderId === null ? active : inactive}`}>
          <span>전체보기</span>
          <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{countInFolder(null)}</span>
        </button>
        <button onClick={() => onSelect('uncat')} className={`${btnBase} ${selectedFolderId === 'uncat' ? active : inactive}`}>
          <span>미분류</span>
          <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{countInFolder('uncat')}</span>
        </button>

        {folders.length > 0 && <div className="border-t border-gray-200 my-1" />}

        {folders.map(folder => (
          <div key={folder.id} className="group relative">
            {editingId === folder.id ? (
              <input
                value={editingName}
                onChange={e => setEditingName(e.target.value)}
                onBlur={() => submitRename(folder.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter') submitRename(folder.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                autoFocus
                className="w-full px-3 py-1.5 text-sm border border-indigo-400 rounded-lg outline-none bg-white"
              />
            ) : (
              <button
                onClick={() => onSelect(folder.id)}
                onDoubleClick={() => { setEditingId(folder.id); setEditingName(folder.name); }}
                className={`${btnBase} ${selectedFolderId === folder.id ? active : inactive} pr-1`}
              >
                <span className="truncate flex-1 text-left">{folder.name}</span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                    {countInFolder(folder.id)}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); onDeleteFolder(folder.id); }}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-all w-5 h-5 flex items-center justify-center rounded"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </button>
            )}
          </div>
        ))}

        <div className="mt-1">
          {showInput ? (
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onBlur={submitCreate}
              onKeyDown={e => {
                if (e.key === 'Enter') submitCreate();
                if (e.key === 'Escape') { setShowInput(false); setNewName(''); }
              }}
              placeholder="폴더 이름"
              autoFocus
              className="w-full px-3 py-1.5 text-sm border border-indigo-400 rounded-lg outline-none bg-white"
            />
          ) : (
            <button
              onClick={() => setShowInput(true)}
              className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              새 폴더
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ArchivePage() {
  const { user } = useApp();
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [movingScriptId, setMovingScriptId] = useState(null);

  // Load scripts
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    console.log('[ArchivePage] loading scripts for uid:', user.uid);
    setLoading(true);
    const q = query(collection(db, 'myScripts'), where('userId', '==', user.uid));
    return onSnapshot(q,
      (snap) => {
        console.log('[ArchivePage] scripts snapshot:', snap.docs.length);
        setScripts(snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)));
        setLoading(false);
      },
      (err) => { console.error('[ArchivePage] scripts error:', err); setLoading(false); }
    );
  }, [user]);

  // Load folders
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'scriptFolders'), where('userId', '==', user.uid));
    return onSnapshot(q,
      (snap) => {
        setFolders(snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0)));
      },
      (err) => console.error('[ArchivePage] folders error:', err)
    );
  }, [user]);

  const filteredScripts = useMemo(() => {
    if (selectedFolderId === null) return scripts;
    if (selectedFolderId === 'uncat') return scripts.filter(s => !s.folderId);
    return scripts.filter(s => s.folderId === selectedFolderId);
  }, [scripts, selectedFolderId]);

  async function handleCreateFolder(name) {
    if (!user) return;
    await addDoc(collection(db, 'scriptFolders'), {
      userId: user.uid,
      name,
      createdAt: serverTimestamp(),
    });
  }

  async function handleRenameFolder(id, name) {
    await updateDoc(doc(db, 'scriptFolders', id), { name });
  }

  async function handleDeleteFolder(id) {
    if (!confirm('폴더를 삭제할까요? 안의 대본은 미분류로 이동합니다.')) return;
    const q = query(collection(db, 'myScripts'), where('folderId', '==', id));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map(d => updateDoc(doc(db, 'myScripts', d.id), { folderId: null })));
    await deleteDoc(doc(db, 'scriptFolders', id));
    if (selectedFolderId === id) setSelectedFolderId(null);
  }

  async function handleMoveScript(scriptId, folderId) {
    await updateDoc(doc(db, 'myScripts', scriptId), { folderId: folderId || null });
    setMovingScriptId(null);
  }

  async function handleDelete(id) {
    if (!confirm('이 스크립트를 삭제할까요?')) return;
    setDeleting(id);
    try { await deleteDoc(doc(db, 'myScripts', id)); }
    finally { setDeleting(null); }
  }

  function handleCopy(script, id) {
    navigator.clipboard.writeText(script);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <h1 className="text-lg font-bold text-gray-900">내 보관함</h1>
        <p className="text-sm text-gray-500 mt-0.5">완성된 스크립트 {scripts.length}개</p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Folder Sidebar */}
        <FolderSidebar
          folders={folders}
          scripts={scripts}
          selectedFolderId={selectedFolderId}
          onSelect={setSelectedFolderId}
          onCreateFolder={handleCreateFolder}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
        />

        {/* Card Grid */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredScripts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
              <p className="text-gray-500 font-medium">
                {selectedFolderId === null ? '아직 저장된 스크립트가 없어요' : '이 폴더에 스크립트가 없어요'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {selectedFolderId === null ? '분석 후 저장해보세요' : '스크립트를 이 폴더로 이동해보세요'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredScripts.map(script => {
                const date = script.createdAt?.toDate?.()?.toLocaleDateString('ko-KR', {
                  year: 'numeric', month: 'short', day: 'numeric',
                });
                return (
                  <div key={script.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow group flex flex-col gap-3 relative">

                    {/* 상단 */}
                    <div className="flex items-center justify-between gap-2">
                      {date && <p className="text-xs text-gray-400">{date}</p>}
                      <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                        {/* 폴더 이동 */}
                        <div className="relative">
                          <button
                            onClick={() => setMovingScriptId(movingScriptId === script.id ? null : script.id)}
                            className="text-gray-400 hover:text-indigo-500 transition-colors opacity-0 group-hover:opacity-100"
                            title="폴더 이동"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                            </svg>
                          </button>
                          {movingScriptId === script.id && (
                            <div className="absolute right-0 top-6 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[140px]">
                              <button
                                onClick={() => handleMoveScript(script.id, null)}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-600"
                              >
                                미분류
                              </button>
                              {folders.map(f => (
                                <button
                                  key={f.id}
                                  onClick={() => handleMoveScript(script.id, f.id)}
                                  className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${script.folderId === f.id ? 'text-indigo-600 font-semibold' : 'text-gray-600'}`}
                                >
                                  {f.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleDelete(script.id)}
                          disabled={deleting === script.id}
                          className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          {deleting === script.id
                            ? <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                            : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          }
                        </button>
                      </div>
                    </div>

                    <p className="text-sm text-gray-800 leading-relaxed line-clamp-5 flex-1 whitespace-pre-wrap">
                      {script.preview || script.script?.slice(0, 120)}
                    </p>

                    <button
                      onClick={() => handleCopy(script.script, script.id)}
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

      {/* 폴더 이동 드롭다운 백드롭 */}
      {movingScriptId && (
        <div className="fixed inset-0 z-10" onClick={() => setMovingScriptId(null)} />
      )}
    </div>
  );
}
