import React, { useEffect, useState, useMemo } from 'react';
import {
  collection, query, where, onSnapshot, deleteDoc, updateDoc,
  doc, addDoc, serverTimestamp, getDocs,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useApp } from '../../App';

const PencilIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

const STATUS_STYLES = {
  '대기 중': { tag: 'bg-gray-100 text-gray-600', btn: 'bg-gray-100 text-gray-700 border-gray-300' },
  '게시 완료': { tag: 'bg-green-100 text-green-700', btn: 'bg-green-100 text-green-700 border-green-300' },
  '보류': { tag: 'bg-yellow-100 text-yellow-700', btn: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
};

function ScriptDetailModal({ script, onClose }) {
  const [localScript, setLocalScript] = useState(script);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { setLocalScript(script); }, [script]);

  async function saveField(field, value) {
    setSaving(true);
    try {
      const updates = { [field]: value };
      if (field === 'script') updates.preview = value.slice(0, 50);
      await updateDoc(doc(db, 'myScripts', localScript.id), updates);
      setLocalScript(prev => ({ ...prev, ...updates }));
      setEditingField(null);
      setEditValue('');
    } catch (e) {
      console.error('update failed:', e);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(newStatus) {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'myScripts', localScript.id), { status: newStatus });
      setLocalScript(prev => ({ ...prev, status: newStatus }));
    } catch (e) {
      console.error('status update failed:', e);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(field) { setEditingField(field); setEditValue(localScript[field] || ''); }
  function cancelEdit() { setEditingField(null); setEditValue(''); }
  function handleCopy() {
    navigator.clipboard.writeText(localScript.script);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const date = localScript.createdAt?.toDate?.()?.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
  const displayName = localScript.topic || localScript.title || '저장된 스크립트';
  const currentStatus = localScript.status || '대기 중';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {editingField === 'topic' ? (
                <div className="flex items-center gap-2">
                  <input
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveField('topic', editValue.trim()); if (e.key === 'Escape') cancelEdit(); }}
                    autoFocus
                    className="flex-1 text-sm font-bold border border-indigo-400 rounded-lg px-2.5 py-1 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button onClick={() => saveField('topic', editValue.trim())} disabled={saving} className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">확인</button>
                  <button onClick={cancelEdit} className="text-xs text-gray-500 px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">취소</button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 group">
                  <p className="text-sm font-bold text-gray-900 truncate">{displayName}</p>
                  <button onClick={() => startEdit('topic')} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-indigo-500 transition-all flex-shrink-0"><PencilIcon /></button>
                </div>
              )}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {localScript.hookType && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">{localScript.hookType}</span>
                )}
                {date && <p className="text-xs text-gray-400">{date}</p>}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {/* 사용 여부 */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">사용 여부</p>
            <div className="flex gap-2">
              {Object.keys(STATUS_STYLES).map(s => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={saving}
                  className={`flex-1 text-xs font-semibold py-2 rounded-xl border transition-colors ${
                    currentStatus === s ? STATUS_STYLES[s].btn : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* 성과 메모 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">성과 메모</p>
              {editingField !== 'performanceMemo' && (
                <button onClick={() => startEdit('performanceMemo')} className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-500 transition-colors"><PencilIcon />수정</button>
              )}
            </div>
            {editingField === 'performanceMemo' ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  rows={3}
                  autoFocus
                  placeholder="조회수, 반응, 개선점 등을 메모하세요"
                  className="w-full border border-indigo-400 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 resize-none bg-gray-50"
                />
                <div className="flex gap-2">
                  <button onClick={() => saveField('performanceMemo', editValue.trim())} disabled={saving} className="text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-4 py-2 rounded-xl font-semibold transition-colors">저장</button>
                  <button onClick={cancelEdit} className="text-sm text-gray-500 px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">취소</button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => startEdit('performanceMemo')}
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm leading-relaxed min-h-[60px] cursor-pointer hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors"
              >
                {localScript.performanceMemo
                  ? <span className="text-gray-700 whitespace-pre-wrap">{localScript.performanceMemo}</span>
                  : <span className="text-gray-300">메모를 입력하세요...</span>
                }
              </div>
            )}
          </div>

          {/* 대본 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">대본</p>
              {editingField !== 'script' && (
                <button onClick={() => startEdit('script')} className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-500 transition-colors"><PencilIcon />수정</button>
              )}
            </div>
            {editingField === 'script' ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  rows={10}
                  autoFocus
                  className="w-full border border-indigo-400 rounded-xl px-4 py-3 text-sm text-gray-700 leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500 resize-none bg-gray-50"
                />
                <div className="flex gap-2">
                  <button onClick={() => saveField('script', editValue.trim())} disabled={saving || !editValue.trim()} className="flex items-center gap-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-4 py-2 rounded-xl font-semibold transition-colors">
                    {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    저장
                  </button>
                  <button onClick={cancelEdit} className="text-sm text-gray-500 px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">취소</button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {localScript.script}
              </div>
            )}
          </div>
        </div>

        {/* 하단 */}
        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0 flex gap-2">
          <button onClick={handleCopy} className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {copied ? '복사됨 ✓' : '복사'}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">닫기</button>
        </div>
      </div>
    </div>
  );
}

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
  const [detailScript, setDetailScript] = useState(null);

  useEffect(() => {
    if (!movingScriptId) return;
    const close = () => setMovingScriptId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [movingScriptId]);

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
            <div className="grid grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredScripts.map(script => {
                const displayName = script.topic || script.title || (script.script || '').split('\n').filter(l => l.trim())[0]?.slice(0, 40) || '저장된 스크립트';
                const currentStatus = script.status || '대기 중';
                const tagStyle = STATUS_STYLES[currentStatus]?.tag || STATUS_STYLES['대기 중'].tag;
                const cardDate = script.createdAt?.toDate?.()?.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });

                return (
                  <div
                    key={script.id}
                    onClick={() => setDetailScript(script)}
                    className="bg-white border border-gray-200 rounded-xl p-3.5 flex flex-col gap-2 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group"
                  >
                    {/* 상단: topic + hookType badge */}
                    <div className="flex items-start justify-between gap-1.5">
                      <p className="text-xs font-bold text-gray-800 flex-1 min-w-0 line-clamp-2 leading-snug">{displayName}</p>
                      {script.hookType && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 flex-shrink-0 whitespace-nowrap leading-none mt-0.5">{script.hookType}</span>
                      )}
                    </div>

                    {/* status + date */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tagStyle}`}>{currentStatus}</span>
                      {cardDate && <span className="text-[10px] text-gray-400">{cardDate}</span>}
                    </div>

                    {/* performanceMemo or script preview */}
                    <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2">
                      {script.performanceMemo || ((script.script || '').slice(0, 60) + ((script.script?.length ?? 0) > 60 ? '…' : ''))}
                    </p>

                    {/* 액션 버튼 */}
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-auto">
                      <div className="relative">
                        <button
                          onClick={e => { e.stopPropagation(); setMovingScriptId(movingScriptId === script.id ? null : script.id); }}
                          className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-indigo-500 rounded-md hover:bg-indigo-50 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                          </svg>
                        </button>
                        {movingScriptId === script.id && (
                          <div className="absolute right-0 top-7 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[130px]" onClick={e => e.stopPropagation()}>
                            <button onClick={() => handleMoveScript(script.id, null)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 text-gray-600">미분류</button>
                            {folders.map(f => (
                              <button key={f.id} onClick={() => handleMoveScript(script.id, f.id)} className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${script.folderId === f.id ? 'text-indigo-600 font-semibold' : 'text-gray-600'}`}>{f.name}</button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(script.id); }}
                        disabled={deleting === script.id}
                        className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-400 rounded-md hover:bg-red-50 transition-colors"
                      >
                        {deleting === script.id
                          ? <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                          : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        }
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 상세 모달 */}
      {detailScript && (
        <ScriptDetailModal script={detailScript} onClose={() => setDetailScript(null)} />
      )}
    </div>
  );
}
