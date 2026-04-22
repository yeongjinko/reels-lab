import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, addDoc, deleteDoc, updateDoc, doc,
  query, where, onSnapshot, serverTimestamp, getDocs,
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase/config';
import { useApp } from '../../App';

const TAG_STYLES = {
  후킹: 'bg-orange-100 text-orange-700',
  본문: 'bg-green-100 text-green-700',
  심리: 'bg-purple-100 text-purple-700',
  CTA: 'bg-red-100 text-red-700',
};

function getTitle(script) {
  const lines = (script || '').split('\n').filter(l => l.trim());
  return lines[0]?.slice(0, 40) || '제목 없음';
}

function getBody(script) {
  const lines = (script || '').split('\n').filter(l => l.trim());
  return lines.slice(1).join('\n') || lines[0] || '';
}

const PencilIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

/* ── 상세 모달 ── */
function DetailModal({ item, onClose, onAnalyze }) {
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [scriptResetBanner, setScriptResetBanner] = useState(false);
  const [localItem, setLocalItem] = useState(item);

  useEffect(() => { setLocalItem(item); }, [item]);

  function startEdit(field) {
    setEditingField(field);
    setEditValue(
      field === 'title' ? (localItem.title || '') :
      field === 'link' ? (localItem.link || '') :
      localItem.script || ''
    );
  }

  function cancelEdit() { setEditingField(null); setEditValue(''); }

  async function saveEdit() {
    if (editingField !== 'link' && !editValue.trim()) return;
    setSaving(true);
    try {
      const updates = {};
      if (editingField === 'title') {
        updates.title = editValue.trim();
      } else if (editingField === 'link') {
        updates.link = editValue.trim() || null;
      } else if (editingField === 'script') {
        updates.script = editValue.trim();
        updates.preview = editValue.trim().slice(0, 50);
        updates.analyzed = false;
        updates.hookType = null;
        updates.empathyTags = [];
        updates.empathyPoint = null;
        updates.analysis = null;
        setScriptResetBanner(true);
      }
      await updateDoc(doc(db, 'referenceLibrary', localItem.id), updates);
      setLocalItem(prev => ({ ...prev, ...updates }));
      setEditingField(null);
      setEditValue('');
    } catch (e) {
      console.error('update failed:', e);
    } finally {
      setSaving(false);
    }
  }

  function EditActions() {
    return (
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={saveEdit}
          disabled={saving}
          className="flex items-center gap-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-lg font-semibold transition-colors disabled:opacity-50"
        >
          {saving && <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />}
          확인
        </button>
        <button onClick={cancelEdit} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
          취소
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[88vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {/* 상태 뱃지 */}
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${localItem.analyzed ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                  {localItem.analyzed ? '분석완료' : '미분석'}
                </span>
                {localItem.analyzed && localItem.hookType && (
                  <span className="text-[11px] bg-indigo-100 text-indigo-600 font-semibold px-2 py-0.5 rounded-full">
                    {localItem.hookType}
                  </span>
                )}
              </div>
              {/* 제목 */}
              {editingField === 'title' ? (
                <div className="flex items-center gap-2 mb-1">
                  <input
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                    autoFocus
                    className="flex-1 text-sm font-bold border border-indigo-400 rounded-lg px-2.5 py-1 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <EditActions />
                </div>
              ) : (
                <div className="flex items-center gap-1.5 group mb-1">
                  <h3 className="text-base font-bold text-gray-900 leading-snug">{localItem.title || getTitle(localItem.script)}</h3>
                  <button onClick={() => startEdit('title')} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-indigo-500 transition-all flex-shrink-0">
                    <PencilIcon />
                  </button>
                </div>
              )}
              {/* 링크 */}
              {editingField === 'link' ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="url"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                    placeholder="https://..."
                    autoFocus
                    className="flex-1 text-xs border border-indigo-400 rounded-lg px-2.5 py-1 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <EditActions />
                </div>
              ) : (
                <div className="flex items-center gap-1.5 group mt-0.5">
                  {localItem.link ? (
                    <a href={localItem.link} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 transition-colors">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      원본 링크
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400">링크 없음</span>
                  )}
                  <button onClick={() => startEdit('link')} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-indigo-500 transition-all flex-shrink-0">
                    <PencilIcon />
                  </button>
                </div>
              )}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {/* 대본 수정 알림 */}
          {scriptResetBanner && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-xs text-amber-800">대본이 수정되었어요. 다시 분석하시겠어요?</p>
              <button
                onClick={() => { setScriptResetBanner(false); onAnalyze(localItem); }}
                className="text-xs font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap transition-colors"
              >
                분석하기 →
              </button>
            </div>
          )}

          {/* 대본 전문 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">대본 전문</p>
              {editingField !== 'script' && (
                <button onClick={() => startEdit('script')} className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-500 transition-colors">
                  <PencilIcon />
                  수정
                </button>
              )}
            </div>
            {editingField === 'script' ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  rows={8}
                  autoFocus
                  className="w-full border border-indigo-400 rounded-xl px-4 py-3 text-sm text-gray-700 leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500 resize-none bg-gray-50"
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveEdit}
                    disabled={saving || !editValue.trim()}
                    className="flex items-center gap-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-4 py-2 rounded-xl font-semibold transition-colors"
                  >
                    {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    저장
                  </button>
                  <button onClick={cancelEdit} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {localItem.script}
              </div>
            )}
          </div>

          {/* 분석 결과 */}
          {localItem.analyzed && (
            <>
              {localItem.empathyPoint && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    <span className="text-xs font-bold text-orange-700 uppercase tracking-wider">공감 포인트</span>
                  </div>
                  <p className="text-sm text-orange-900 leading-relaxed">{localItem.empathyPoint}</p>
                  {localItem.empathyTags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {localItem.empathyTags.map((tag, i) => (
                        <span key={i} className="text-[11px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">#{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {localItem.analysis?.hookFormula && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">후킹 공식</span>
                  </div>
                  <p className="text-indigo-900 font-bold text-sm mb-1">{localItem.analysis.hookFormula}</p>
                  {localItem.analysis.hookFormulaDesc && (
                    <p className="text-indigo-700 text-xs leading-relaxed">{localItem.analysis.hookFormulaDesc}</p>
                  )}
                </div>
              )}

              {localItem.analysis?.sentences?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">문장별 분석</p>
                  <div className="flex flex-col gap-2">
                    {localItem.analysis.sentences.map((s, i) => (
                      <div key={i} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                        <div className="flex items-start gap-2 mb-1.5">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${TAG_STYLES[s.tag] || 'bg-gray-100 text-gray-600'}`}>
                            {s.tag}
                          </span>
                          <p className="text-sm text-gray-800 font-medium leading-snug">{s.text}</p>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed pl-0.5">{s.effect}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0 flex gap-2">
          <button
            onClick={() => onAnalyze(localItem)}
            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            {localItem.analyzed ? '이 레퍼런스로 스크립트 기획하기' : '분석하러 가기'}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 폴더 사이드바 ── */
function FolderSidebar({ folders, items, selectedFolderId, onSelect, onCreateFolder, onRenameFolder, onDeleteFolder }) {
  const [showInput, setShowInput] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  function countInFolder(folderId) {
    if (folderId === null) return items.length;
    if (folderId === 'uncat') return items.filter(i => !i.folderId).length;
    return items.filter(i => i.folderId === folderId).length;
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
                  <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{countInFolder(folder.id)}</span>
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

/* ── 메인 페이지 ── */
export default function LibraryPage() {
  const { user } = useApp();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [detailItem, setDetailItem] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formLink, setFormLink] = useState('');
  const [formScript, setFormScript] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [movingItemId, setMovingItemId] = useState(null);

  useEffect(() => {
    if (!user) { setItemsLoading(false); return; }
    console.log('[LibraryPage] loading items for uid:', user.uid);
    setItemsLoading(true);
    let settled = false;
    const finish = () => { if (!settled) { settled = true; setItemsLoading(false); } };
    const q = query(collection(db, 'referenceLibrary'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q,
      (snap) => {
        console.log('[LibraryPage] items snapshot:', snap.docs.length);
        setItems(snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)));
        finish();
      },
      (err) => { console.error('[LibraryPage] items error:', err); finish(); }
    );
    return () => { unsub(); finish(); };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'referenceFolders'), where('userId', '==', user.uid));
    return onSnapshot(q,
      (snap) => {
        setFolders(snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0)));
      },
      (err) => console.error('[LibraryPage] folders error:', err)
    );
  }, [user]);

  const filteredItems = useMemo(() => {
    if (selectedFolderId === null) return items;
    if (selectedFolderId === 'uncat') return items.filter(i => !i.folderId);
    return items.filter(i => i.folderId === selectedFolderId);
  }, [items, selectedFolderId]);

  async function handleCreateFolder(name) {
    if (!user) return;
    await addDoc(collection(db, 'referenceFolders'), { userId: user.uid, name, createdAt: serverTimestamp() });
  }

  async function handleRenameFolder(id, name) {
    await updateDoc(doc(db, 'referenceFolders', id), { name });
  }

  async function handleDeleteFolder(id) {
    if (!confirm('폴더를 삭제할까요? 안의 카드는 미분류로 이동합니다.')) return;
    const q = query(collection(db, 'referenceLibrary'), where('folderId', '==', id));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map(d => updateDoc(doc(db, 'referenceLibrary', d.id), { folderId: null })));
    await deleteDoc(doc(db, 'referenceFolders', id));
    if (selectedFolderId === id) setSelectedFolderId(null);
  }

  async function handleMoveItem(itemId, folderId) {
    await updateDoc(doc(db, 'referenceLibrary', itemId), { folderId: folderId || null });
    setMovingItemId(null);
  }

  async function handleAdd() {
    if (!formTitle.trim() || !formScript.trim() || !user) return;
    setSaving(true);
    try {
      const folderId = (selectedFolderId && selectedFolderId !== 'uncat') ? selectedFolderId : null;
      await addDoc(collection(db, 'referenceLibrary'), {
        userId: user.uid,
        createdAt: serverTimestamp(),
        title: formTitle.trim(),
        link: formLink.trim() || null,
        script: formScript.trim(),
        preview: formScript.trim().slice(0, 50),
        analyzed: false,
        hookType: null,
        empathyTags: [],
        empathyPoint: null,
        analysis: null,
        folderId,
      });
      setFormTitle('');
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
    try { await deleteDoc(doc(db, 'referenceLibrary', id)); }
    finally { setDeleting(null); }
  }

  function handleAnalyze(item) {
    setDetailItem(null);
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
      {/* 헤더 */}
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

      <div className="flex flex-1 overflow-hidden">
        <FolderSidebar
          folders={folders}
          items={items}
          selectedFolderId={selectedFolderId}
          onSelect={setSelectedFolderId}
          onCreateFolder={handleCreateFolder}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
        />

        {/* 카드 그리드 */}
        <div className="flex-1 overflow-y-auto p-5">
          {itemsLoading ? (
            <div className="flex items-center justify-center h-48 gap-2">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400">불러오는 중...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <p className="text-gray-600 font-medium">
                {selectedFolderId === null ? '아직 저장된 레퍼런스가 없어요' : '이 폴더에 레퍼런스가 없어요'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {selectedFolderId === null ? '"새 레퍼런스 추가" 버튼으로 시작해보세요' : '레퍼런스를 추가하거나 폴더로 이동해보세요'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => setDetailItem(item)}
                  className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col gap-2 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group"
                >
                  {/* 제목 */}
                  <p className="text-xs font-bold text-gray-800 truncate">
                    {item.title || getTitle(item.script)}
                  </p>

                  {/* 80자 미리보기 */}
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    {(item.script || '').slice(0, 80)}{(item.script?.length ?? 0) > 80 ? '…' : ''}
                  </p>

                  {/* 뱃지 + 액션 */}
                  <div className="flex items-center justify-between gap-1 mt-auto">
                    <div className="flex items-center gap-1 flex-wrap min-w-0">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${item.analyzed ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                        {item.analyzed ? '분석완료' : '미분석'}
                      </span>
                      {item.analyzed && item.hookType && (
                        <span className="text-[10px] bg-indigo-100 text-indigo-600 font-semibold px-1.5 py-0.5 rounded-full truncate max-w-[80px]">
                          {item.hookType}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      {/* 폴더 이동 */}
                      <div className="relative">
                        <button
                          onClick={e => { e.stopPropagation(); setMovingItemId(movingItemId === item.id ? null : item.id); }}
                          className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-indigo-500 rounded-md hover:bg-indigo-50 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                          </svg>
                        </button>
                        {movingItemId === item.id && (
                          <div className="absolute right-0 top-7 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[130px]">
                            <button onClick={e => { e.stopPropagation(); handleMoveItem(item.id, null); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 text-gray-600">미분류</button>
                            {folders.map(f => (
                              <button key={f.id} onClick={e => { e.stopPropagation(); handleMoveItem(item.id, f.id); }} className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${item.folderId === f.id ? 'text-indigo-600 font-semibold' : 'text-gray-600'}`}>{f.name}</button>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* 삭제 */}
                      <button
                        onClick={e => handleDelete(e, item.id)}
                        disabled={deleting === item.id}
                        className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-400 rounded-md hover:bg-red-50 transition-colors"
                      >
                        {deleting === item.id
                          ? <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                          : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        }
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 폴더 이동 백드롭 */}
      {movingItemId && <div className="fixed inset-0 z-10" onClick={() => setMovingItemId(null)} />}

      {/* 상세 모달 */}
      {detailItem && (
        <DetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onAnalyze={handleAnalyze}
        />
      )}

      {/* 새 레퍼런스 추가 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
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
                  제목/주제명 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="예) 룰루레몬 브랜드반전 릴스"
                  autoFocus
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  링크 <span className="font-normal text-gray-400 normal-case">(선택사항)</span>
                </label>
                <input
                  type="url"
                  value={formLink}
                  onChange={e => setFormLink(e.target.value)}
                  placeholder="인스타/틱톡 URL"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  대본 텍스트 <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={formScript}
                  onChange={e => setFormScript(e.target.value)}
                  placeholder="대본을 입력하세요"
                  rows={6}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 placeholder-gray-400 resize-none"
                />
              </div>
              {(selectedFolderId && selectedFolderId !== 'uncat') && (
                <p className="text-xs text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2">
                  현재 선택된 폴더 <strong>"{folders.find(f => f.id === selectedFolderId)?.name}"</strong>에 저장됩니다
                </p>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button
                onClick={handleAdd}
                disabled={!formTitle.trim() || !formScript.trim() || saving}
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
    </div>
  );
}
