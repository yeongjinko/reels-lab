import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  collection, addDoc, deleteDoc, updateDoc, doc,
  query, where, onSnapshot, serverTimestamp, getDocs,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';
import { db, storage, functions } from '../../firebase/config';
import { useApp } from '../../App';

const TAG_STYLES = {
  후킹: 'bg-orange-100 text-orange-700',
  본문: 'bg-green-100 text-green-700',
  심리: 'bg-purple-100 text-purple-700',
  CTA: 'bg-red-100 text-red-700',
};

function formatAnalyzedAt(ts) {
  if (!ts) return null;
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return '오늘 분석';
  if (diffDays === 1) return '어제 분석';
  if (diffDays < 7) return `${diffDays}일 전 분석`;
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} 분석`;
}

function getTitle(script) {
  const lines = (script || '').split('\n').filter(l => l.trim());
  return lines[0]?.slice(0, 40) || '제목 없음';
}

const PencilIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

/* ── 비디오 썸네일 생성 ── */
async function generateVideoThumbnail(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.playsInline = true;
    video.muted = true;
    const url = URL.createObjectURL(file);
    video.src = url;
    video.onloadeddata = () => { video.currentTime = 0; };
    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      const maxW = 640;
      canvas.width = Math.min(video.videoWidth || maxW, maxW);
      canvas.height = Math.round((canvas.width / (video.videoWidth || maxW)) * (video.videoHeight || 360));
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => resolve(blob || null), 'image/jpeg', 0.8);
    };
    video.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
  });
}

/* ── 이미지 크게 보기 모달 ── */
function ImageModal({ item, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <img src={item.mediaUrl || item.thumbnailUrl} alt={item.title} className="w-full rounded-2xl shadow-2xl" style={{ maxHeight: '85vh', objectFit: 'contain' }} />
      </div>
    </div>
  );
}

/* ── 영상 + 대본 모달 ── */
function VideoScriptModal({ item, onClose }) {
  const [script, setScript] = useState(item.script || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'referenceLibrary', item.id), {
        script: script.trim(),
        preview: script.trim().slice(0, 50),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-[60] flex flex-col items-center justify-center p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl"
        style={{ height: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 왼쪽: 영상 */}
        <div className="flex-1 bg-black flex items-center justify-center min-w-0">
          <video
            src={item.mediaUrl || item.videoUrl}
            controls
            autoPlay
            poster={item.thumbnailUrl}
            className="max-h-full max-w-full"
          />
        </div>

        {/* 오른쪽: 대본 */}
        <div className="w-72 bg-white flex flex-col flex-shrink-0">
          <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
            <div>
              <p className="text-sm font-bold text-gray-900">대본</p>
              <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[180px]">{item.title || getTitle(item.script)}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <textarea
            value={script}
            onChange={e => setScript(e.target.value)}
            placeholder="영상을 보면서 대본을 입력하세요..."
            className="flex-1 px-4 py-3 text-sm text-gray-700 leading-relaxed resize-none outline-none placeholder-gray-300"
          />
          <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">
            <button
              onClick={handleSave}
              disabled={saving}
              className={`w-full flex items-center justify-center gap-2 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors ${saved ? 'bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300'}`}
            >
              {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {saved ? '저장됨 ✓' : saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 상세 모달 ── */
function DetailModal({ item, onClose, onGoAnalyze, onPlayMedia }) {
  const { user } = useApp();
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [scriptResetBanner, setScriptResetBanner] = useState(false);
  const [localItem, setLocalItem] = useState(item);

  // STT 추출 상태
  const [extractingScript, setExtractingScript] = useState(false);

  // 미디어 편집 상태
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingType, setPendingType] = useState(null);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaProgress, setMediaProgress] = useState(0);
  const mediaEditRef = useRef(null);

  useEffect(() => { setLocalItem(item); }, [item]);

  function handleGoAnalyze() { onGoAnalyze(localItem); }
  function startEdit(field) {
    setEditingField(field);
    if (field === 'title') setEditValue(localItem.title || '');
    else if (field === 'link') setEditValue(localItem.link || '');
    else if (field === 'memo') setEditValue(localItem.memo || '');
    else setEditValue(localItem.script || '');
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
      } else if (editingField === 'memo') {
        updates.memo = editValue.trim() || null;
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
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  function onMediaFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPendingFile(file);
    setPendingType(file.type.startsWith('video/') ? 'video' : 'image');
  }

  async function uploadNewMedia() {
    if (!pendingFile || !user) return;
    setMediaUploading(true);
    setMediaProgress(10);
    try {
      // 기존 파일 삭제
      if (localItem.mediaStoragePath) {
        try { await deleteObject(ref(storage, localItem.mediaStoragePath)); } catch {}
      }
      if (localItem.thumbnailStoragePath && localItem.mediaType !== 'image') {
        try { await deleteObject(ref(storage, localItem.thumbnailStoragePath)); } catch {}
      }
      if (localItem.videoStoragePath) {
        try { await deleteObject(ref(storage, localItem.videoStoragePath)); } catch {}
      }

      const ext = pendingFile.name.split('.').pop().toLowerCase();
      const basePath = `referenceMedia/${user.uid}/${localItem.id}`;

      setMediaProgress(20);
      const mediaRef = ref(storage, `${basePath}/media.${ext}`);
      await uploadBytes(mediaRef, pendingFile);
      const mediaUrl = await getDownloadURL(mediaRef);
      setMediaProgress(65);

      let thumbnailUrl = null;
      let thumbnailStoragePath = null;

      if (pendingType === 'video') {
        const thumbBlob = await generateVideoThumbnail(pendingFile);
        if (thumbBlob) {
          thumbnailStoragePath = `${basePath}/thumbnail.jpg`;
          const thumbRef = ref(storage, thumbnailStoragePath);
          await uploadBytes(thumbRef, thumbBlob);
          thumbnailUrl = await getDownloadURL(thumbRef);
        }
      } else {
        thumbnailUrl = mediaUrl;
        thumbnailStoragePath = `${basePath}/media.${ext}`;
      }

      setMediaProgress(90);
      const updates = {
        mediaType: pendingType,
        mediaUrl,
        mediaStoragePath: `${basePath}/media.${ext}`,
        thumbnailUrl,
        thumbnailStoragePath,
        videoUrl: pendingType === 'video' ? mediaUrl : null,
      };
      await updateDoc(doc(db, 'referenceLibrary', localItem.id), updates);
      setLocalItem(prev => ({ ...prev, ...updates }));
      setPendingFile(null);
      setPendingType(null);
      if (mediaEditRef.current) mediaEditRef.current.value = '';
    } catch (e) { console.error(e); }
    finally { setMediaUploading(false); setMediaProgress(0); }
  }

  async function deleteMedia() {
    if (!confirm('미디어를 삭제할까요?')) return;
    setMediaUploading(true);
    try {
      if (localItem.mediaStoragePath) {
        try { await deleteObject(ref(storage, localItem.mediaStoragePath)); } catch {}
      }
      if (localItem.thumbnailStoragePath && localItem.mediaType !== 'image') {
        try { await deleteObject(ref(storage, localItem.thumbnailStoragePath)); } catch {}
      }
      if (localItem.videoStoragePath) {
        try { await deleteObject(ref(storage, localItem.videoStoragePath)); } catch {}
      }
      const updates = { mediaType: null, mediaUrl: null, thumbnailUrl: null, mediaStoragePath: null, thumbnailStoragePath: null, videoUrl: null };
      await updateDoc(doc(db, 'referenceLibrary', localItem.id), updates);
      setLocalItem(prev => ({ ...prev, ...updates }));
    } catch (e) { console.error(e); }
    finally { setMediaUploading(false); }
  }

  function EditActions() {
    return (
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button onClick={saveEdit} disabled={saving}
          className="flex items-center gap-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-lg font-semibold transition-colors disabled:opacity-50">
          {saving && <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />}
          확인
        </button>
        <button onClick={cancelEdit} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
          취소
        </button>
      </div>
    );
  }

  const isVideo = localItem.mediaType === 'video' || (!localItem.mediaType && localItem.videoUrl);
  const isImage = localItem.mediaType === 'image';
  const hasMedia = !!(localItem.mediaUrl || localItem.videoUrl);

  async function handleExtractDetailScript() {
    const storagePath = localItem.mediaStoragePath || localItem.videoStoragePath;
    if (!storagePath) return;
    if (localItem.script?.trim() && !confirm('기존 대본을 덮어쓸까요?')) return;
    setExtractingScript(true);
    try {
      const fn = httpsCallable(functions, 'extractScript');
      const result = await fn({ storagePath });
      if (result.data.text) {
        setEditingField('script');
        setEditValue(result.data.text);
      }
    } catch (e) {
      console.error('STT 오류:', e);
      alert('대본 추출 중 오류가 발생했습니다: ' + (e.message || '알 수 없는 오류'));
    } finally {
      setExtractingScript(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${localItem.analyzed ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                  {localItem.analyzed ? '분석완료' : '미분석'}
                </span>
                {localItem.analyzed && localItem.hookType && (
                  <span className="text-[11px] bg-indigo-100 text-indigo-600 font-semibold px-2 py-0.5 rounded-full">{localItem.hookType}</span>
                )}
                {localItem.analyzed && localItem.analyzedAt && (
                  <span className="text-[11px] text-gray-400 ml-auto">{formatAnalyzedAt(localItem.analyzedAt)}</span>
                )}
              </div>
              {editingField === 'title' ? (
                <div className="flex items-center gap-2 mb-1">
                  <input value={editValue} onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                    autoFocus className="flex-1 text-sm font-bold border border-indigo-400 rounded-lg px-2.5 py-1 outline-none focus:ring-2 focus:ring-indigo-500" />
                  <EditActions />
                </div>
              ) : (
                <div className="flex items-center gap-1.5 group mb-1">
                  <h3 className="text-base font-bold text-gray-900 leading-snug">{localItem.title || getTitle(localItem.script)}</h3>
                  <button onClick={() => startEdit('title')} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-indigo-500 transition-all flex-shrink-0"><PencilIcon /></button>
                </div>
              )}
              {editingField === 'link' ? (
                <div className="flex items-center gap-2 mt-1">
                  <input type="url" value={editValue} onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                    placeholder="https://..." autoFocus
                    className="flex-1 text-xs border border-indigo-400 rounded-lg px-2.5 py-1 outline-none focus:ring-2 focus:ring-indigo-500" />
                  <EditActions />
                </div>
              ) : (
                <div className="flex items-center gap-1.5 group mt-0.5">
                  {localItem.link ? (
                    <a href={localItem.link} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 transition-colors">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                      원본 링크
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400">링크 없음</span>
                  )}
                  <button onClick={() => startEdit('link')} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-indigo-500 transition-all flex-shrink-0"><PencilIcon /></button>
                </div>
              )}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

          {/* 미디어 프리뷰 + 편집 */}
          <div>
            {hasMedia && (
              <div className="relative bg-black rounded-xl overflow-hidden cursor-pointer group mb-2" style={{ aspectRatio: '3/4' }} onClick={onPlayMedia}>
                {localItem.thumbnailUrl ? (
                  <img src={localItem.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-900" />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/45 transition-colors">
                  {isVideo ? (
                    <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center shadow-xl">
                      <svg className="w-6 h-6 text-gray-800 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    </div>
                  ) : (
                    <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center shadow-xl">
                      <svg className="w-6 h-6 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 미디어 편집 버튼 */}
            <input ref={mediaEditRef} type="file"
              accept="image/jpeg,image/png,image/gif,.jpg,.jpeg,.png,.gif,video/mp4,video/quicktime,.mp4,.mov"
              className="hidden" onChange={onMediaFileChange} />

            {pendingFile ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-xs">
                  <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={pendingType === 'image' ? "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" : "M15 10l4.553-2.069A1 1 0 0121 8.868v6.264a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"} />
                  </svg>
                  <span className="text-indigo-700 font-medium flex-1 truncate">{pendingFile.name}</span>
                  <button type="button" onClick={() => { setPendingFile(null); setPendingType(null); if (mediaEditRef.current) mediaEditRef.current.value = ''; }} className="text-indigo-400 hover:text-indigo-600">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                {mediaUploading && (
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1"><span>업로드 중...</span><span>{mediaProgress}%</span></div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-indigo-500 h-full rounded-full transition-all duration-300" style={{ width: `${mediaProgress}%` }} />
                    </div>
                  </div>
                )}
                <button onClick={uploadNewMedia} disabled={mediaUploading}
                  className="w-full text-xs bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold py-2 rounded-xl transition-colors flex items-center justify-center gap-1.5">
                  {mediaUploading && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {mediaUploading ? '업로드 중...' : '이 파일로 교체'}
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button type="button" onClick={() => mediaEditRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 text-gray-500 py-2 rounded-xl transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  {hasMedia ? '미디어 변경' : '미디어 추가'}
                </button>
                {hasMedia && (
                  <button type="button" onClick={deleteMedia} disabled={mediaUploading}
                    className="flex items-center justify-center gap-1.5 text-xs border border-gray-200 hover:border-red-300 hover:bg-red-50 hover:text-red-500 text-gray-400 px-3 py-2 rounded-xl transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    삭제
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 저장 메모 */}
          <div>
            {editingField === 'memo' ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">📌</span>
                  <span className="text-xs font-semibold text-amber-700">저장 메모</span>
                </div>
                <textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={2} autoFocus
                  placeholder="예) 이 후킹 구조 써먹고 싶어서 / CTA 방식 참고용"
                  className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm text-amber-900 leading-relaxed outline-none focus:ring-2 focus:ring-amber-400 resize-none bg-white placeholder-amber-300" />
                <div className="flex gap-2">
                  <button onClick={saveEdit} disabled={saving}
                    className="flex items-center gap-1.5 text-xs bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors">
                    {saving && <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />}
                    저장
                  </button>
                  <button onClick={cancelEdit} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">취소</button>
                </div>
              </div>
            ) : localItem.memo ? (
              <button onClick={() => startEdit('memo')} className="w-full text-left group/memo bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 hover:border-amber-300 hover:bg-amber-100 transition-colors">
                <div className="flex items-start gap-2">
                  <span className="text-sm flex-shrink-0">📌</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-amber-700">저장 메모</span>
                    <p className="text-sm text-amber-900 mt-0.5 leading-relaxed">{localItem.memo}</p>
                  </div>
                  <span className="opacity-0 group-hover/memo:opacity-100 transition-opacity flex-shrink-0 mt-0.5"><PencilIcon /></span>
                </div>
              </button>
            ) : (
              <button onClick={() => startEdit('memo')} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-amber-600 hover:bg-amber-50 border border-dashed border-gray-200 hover:border-amber-300 rounded-xl transition-colors">
                <span>📌</span>
                <span>저장 메모 추가...</span>
              </button>
            )}
          </div>

          {/* 대본 수정 알림 */}
          {scriptResetBanner && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-xs text-amber-800">대본이 수정되었어요. 다시 분석하시겠어요?</p>
              <button onClick={handleGoAnalyze} className="text-xs font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap transition-colors">분석하기 →</button>
            </div>
          )}

          {/* 대본 전문 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">대본 전문</p>
              <div className="flex items-center gap-2">
                {isVideo && (localItem.mediaStoragePath || localItem.videoStoragePath) && editingField !== 'script' && (
                  <button
                    onClick={handleExtractDetailScript}
                    disabled={extractingScript}
                    className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 disabled:text-indigo-300 transition-colors font-medium"
                  >
                    {extractingScript ? (
                      <><div className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" />음성 인식 중...</>
                    ) : (
                      <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>대본 자동 추출</>
                    )}
                  </button>
                )}
                {editingField !== 'script' && (
                  <button onClick={() => startEdit('script')} className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-500 transition-colors">
                    <PencilIcon /> 수정
                  </button>
                )}
              </div>
            </div>
            {editingField === 'script' ? (
              <div className="flex flex-col gap-2">
                <textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={8} autoFocus
                  className="w-full border border-indigo-400 rounded-xl px-4 py-3 text-sm text-gray-700 leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500 resize-none bg-gray-50" />
                <div className="flex gap-2">
                  <button onClick={saveEdit} disabled={saving || !editValue.trim()}
                    className="flex items-center gap-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-4 py-2 rounded-xl font-semibold transition-colors">
                    {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    저장
                  </button>
                  <button onClick={cancelEdit} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">취소</button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {localItem.script || <span className="text-gray-400">대본 없음</span>}
              </div>
            )}
          </div>

          {/* 분석 결과 */}
          {localItem.analyzed && (
            <>
              {localItem.empathyPoint && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
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
                    <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">후킹 공식</span>
                  </div>
                  <p className="text-indigo-900 font-bold text-sm mb-1">{localItem.analysis.hookFormula}</p>
                  {localItem.analysis.hookFormulaDesc && <p className="text-indigo-700 text-xs leading-relaxed">{localItem.analysis.hookFormulaDesc}</p>}
                </div>
              )}
              {localItem.analysis?.sentences?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">문장별 분석</p>
                  <div className="flex flex-col gap-2">
                    {localItem.analysis.sentences.map((s, i) => (
                      <div key={i} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                        <div className="flex items-start gap-2 mb-1.5">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${TAG_STYLES[s.tag] || 'bg-gray-100 text-gray-600'}`}>{s.tag}</span>
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
          <button onClick={handleGoAnalyze}
            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">
            {localItem.analyzed ? (
              <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>다시 분석하기</>
            ) : (
              <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>분석하기</>
            )}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">닫기</button>
        </div>
      </div>
    </div>
  );
}

/* ── 폴더 사이드바 (2단계 지원) ── */
function FolderSidebar({ folders, items, selectedFolderId, onSelect, onCreateFolder, onRenameFolder, onDeleteFolder }) {
  const [showRootInput, setShowRootInput] = useState(false);
  const [showSubInput, setShowSubInput] = useState(null);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [expandedIds, setExpandedIds] = useState(new Set());

  const rootFolders = folders.filter(f => !f.parentId);
  const subFolders = (parentId) => folders.filter(f => f.parentId === parentId);

  function countInFolder(folderId) {
    if (folderId === null) return items.length;
    if (folderId === 'uncat') return items.filter(i => !i.folderId).length;
    const sub = folders.filter(f => f.parentId === folderId).map(f => f.id);
    return items.filter(i => i.folderId === folderId || sub.includes(i.folderId)).length;
  }

  function toggleExpand(id, e) {
    e.stopPropagation();
    setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function submitCreate(parentId) {
    if (!newName.trim()) { setShowRootInput(false); setShowSubInput(null); return; }
    await onCreateFolder(newName.trim(), parentId || null);
    setNewName(''); setShowRootInput(false); setShowSubInput(null);
  }

  async function submitRename(id) {
    if (!editingName.trim()) { setEditingId(null); return; }
    await onRenameFolder(id, editingName.trim());
    setEditingId(null);
  }

  const btnBase = 'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors text-left';
  const active = 'bg-indigo-50 text-indigo-700 font-semibold';
  const inactive = 'text-gray-600 hover:bg-gray-100';

  function FolderRow({ folder, depth = 0 }) {
    const subs = subFolders(folder.id);
    const isExpanded = expandedIds.has(folder.id);
    const isSelected = selectedFolderId === folder.id;

    return (
      <div>
        <div className="group relative" style={{ paddingLeft: depth * 12 }}>
          {editingId === folder.id ? (
            <input value={editingName} onChange={e => setEditingName(e.target.value)}
              onBlur={() => submitRename(folder.id)}
              onKeyDown={e => { if (e.key === 'Enter') submitRename(folder.id); if (e.key === 'Escape') setEditingId(null); }}
              autoFocus className="w-full px-3 py-1.5 text-sm border border-indigo-400 rounded-lg outline-none bg-white" />
          ) : (
            <button
              onClick={() => { onSelect(folder.id); if (subs.length > 0) setExpandedIds(prev => { const n = new Set(prev); n.add(folder.id); return n; }); }}
              onDoubleClick={() => { setEditingId(folder.id); setEditingName(folder.name); }}
              className={`${btnBase} ${isSelected ? active : inactive} pr-1`}>
              <div className="flex items-center gap-1 flex-1 min-w-0">
                {subs.length > 0 ? (
                  <button onClick={e => toggleExpand(folder.id, e)} className="flex-shrink-0 text-gray-400 hover:text-gray-600">
                    <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                ) : <span className="w-3 flex-shrink-0" />}
                <span className="truncate flex-1 text-left">{folder.name}</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{countInFolder(folder.id)}</span>
                <button onClick={e => { e.stopPropagation(); onDeleteFolder(folder.id); }}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-all w-5 h-5 flex items-center justify-center rounded">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </button>
          )}
        </div>
        {isExpanded && subs.map(sub => <FolderRow key={sub.id} folder={sub} depth={depth + 1} />)}
        {isExpanded && showSubInput === folder.id && (
          <div style={{ paddingLeft: (depth + 1) * 12 + 12 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              onBlur={() => submitCreate(folder.id)}
              onKeyDown={e => { if (e.key === 'Enter') submitCreate(folder.id); if (e.key === 'Escape') { setShowSubInput(null); setNewName(''); } }}
              placeholder="하위 폴더 이름" autoFocus className="w-full px-3 py-1.5 text-sm border border-indigo-400 rounded-lg outline-none bg-white" />
          </div>
        )}
        {isSelected && depth === 0 && !showSubInput && (
          <div style={{ paddingLeft: 24 }}>
            <button onClick={() => { setExpandedIds(prev => { const n = new Set(prev); n.add(folder.id); return n; }); setShowSubInput(folder.id); setNewName(''); }}
              className="w-full flex items-center gap-1 px-3 py-1.5 text-xs text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              하위 폴더 만들기
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-52 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col overflow-y-auto">
      <div className="p-2 flex flex-col gap-0.5">
        <button onClick={() => onSelect(null)} className={`${btnBase} ${selectedFolderId === null ? active : inactive}`}>
          <span>전체보기</span>
          <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{countInFolder(null)}</span>
        </button>
        <button onClick={() => onSelect('uncat')} className={`${btnBase} ${selectedFolderId === 'uncat' ? active : inactive}`}>
          <span>미분류</span>
          <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{countInFolder('uncat')}</span>
        </button>
        {rootFolders.length > 0 && <div className="border-t border-gray-200 my-1" />}
        {rootFolders.map(folder => <FolderRow key={folder.id} folder={folder} depth={0} />)}
        <div className="mt-1">
          {showRootInput ? (
            <input value={newName} onChange={e => setNewName(e.target.value)}
              onBlur={() => submitCreate(null)}
              onKeyDown={e => { if (e.key === 'Enter') submitCreate(null); if (e.key === 'Escape') { setShowRootInput(false); setNewName(''); } }}
              placeholder="폴더 이름" autoFocus className="w-full px-3 py-1.5 text-sm border border-indigo-400 rounded-lg outline-none bg-white" />
          ) : (
            <button onClick={() => setShowRootInput(true)}
              className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              새 폴더
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Breadcrumb ── */
function Breadcrumb({ folders, selectedFolderId, onSelect }) {
  if (!selectedFolderId || selectedFolderId === 'uncat') {
    return (
      <nav className="flex items-center gap-1 text-xs text-gray-500 mb-3">
        <button onClick={() => onSelect(null)} className="hover:text-indigo-600 transition-colors font-medium">전체</button>
        {selectedFolderId === 'uncat' && (
          <><svg className="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg><span className="text-gray-700 font-semibold">미분류</span></>
        )}
      </nav>
    );
  }
  const folder = folders.find(f => f.id === selectedFolderId);
  if (!folder) return null;
  const crumbs = [folder];
  let cur = folder;
  while (cur.parentId) {
    const parent = folders.find(f => f.id === cur.parentId);
    if (!parent) break;
    crumbs.unshift(parent);
    cur = parent;
  }
  return (
    <nav className="flex items-center gap-1 text-xs text-gray-500 mb-3 flex-wrap">
      <button onClick={() => onSelect(null)} className="hover:text-indigo-600 transition-colors font-medium">전체</button>
      {crumbs.map((c, i) => (
        <React.Fragment key={c.id}>
          <svg className="w-3 h-3 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          {i < crumbs.length - 1
            ? <button onClick={() => onSelect(c.id)} className="hover:text-indigo-600 transition-colors">{c.name}</button>
            : <span className="text-gray-700 font-semibold">{c.name}</span>}
        </React.Fragment>
      ))}
    </nav>
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
  const [mediaModalItem, setMediaModalItem] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formLink, setFormLink] = useState('');
  const [formScript, setFormScript] = useState('');
  const [formMemo, setFormMemo] = useState('');
  const [formMediaFile, setFormMediaFile] = useState(null);
  const [formMediaType, setFormMediaType] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [movingItemId, setMovingItemId] = useState(null);
  const [folderDeleteConfirm, setFolderDeleteConfirm] = useState(null);
  const [folderDeleting, setFolderDeleting] = useState(false);
  const [formExtracting, setFormExtracting] = useState(false);
  const [formExtractUploaded, setFormExtractUploaded] = useState(null);
  const mediaInputRef = useRef(null);

  function handleGoAnalyze(item) {
    sessionStorage.setItem('pendingLibraryItem', JSON.stringify({
      referenceText: item.script, referenceId: item.id,
      existingAnalysis: item.analysis || null, existingHookType: item.hookType || null,
      existingEmpathyPoint: item.empathyPoint || null, existingEmpathyTags: item.empathyTags || [],
      existingTemplate: item.templateData || null,
    }));
    navigate('/');
  }

  useEffect(() => {
    if (!movingItemId) return;
    const close = () => setMovingItemId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [movingItemId]);

  useEffect(() => {
    if (!user) { setItemsLoading(false); return; }
    setItemsLoading(true);
    let settled = false;
    const finish = () => { if (!settled) { settled = true; setItemsLoading(false); } };
    const q = query(collection(db, 'referenceLibrary'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q,
      snap => { setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))); finish(); },
      err => { console.error(err); finish(); }
    );
    return () => { unsub(); finish(); };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'referenceFolders'), where('userId', '==', user.uid));
    return onSnapshot(q,
      snap => setFolders(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0))),
      err => console.error(err)
    );
  }, [user]);

  const filteredItems = useMemo(() => {
    if (selectedFolderId === null) return items;
    if (selectedFolderId === 'uncat') return items.filter(i => !i.folderId);
    const subIds = folders.filter(f => f.parentId === selectedFolderId).map(f => f.id);
    return items.filter(i => i.folderId === selectedFolderId || subIds.includes(i.folderId));
  }, [items, selectedFolderId, folders]);

  async function handleCreateFolder(name, parentId = null) {
    if (!user) return;
    await addDoc(collection(db, 'referenceFolders'), { userId: user.uid, name, parentId: parentId || null, createdAt: serverTimestamp() });
  }

  async function handleRenameFolder(id, name) {
    await updateDoc(doc(db, 'referenceFolders', id), { name });
  }

  function handleDeleteFolder(id) {
    const folder = folders.find(f => f.id === id);
    setFolderDeleteConfirm({ id, name: folder?.name || '폴더' });
  }

  async function confirmDeleteFolder() {
    if (!folderDeleteConfirm) return;
    const { id } = folderDeleteConfirm;
    setFolderDeleting(true);
    try {
      const subIds = folders.filter(f => f.parentId === id).map(f => f.id);
      const allIds = [id, ...subIds];
      for (const fid of allIds) {
        const snap = await getDocs(query(collection(db, 'referenceLibrary'), where('userId', '==', user.uid), where('folderId', '==', fid)));
        await Promise.all(snap.docs.map(d => updateDoc(doc(db, 'referenceLibrary', d.id), { folderId: null })));
      }
      for (const fid of [...subIds, id]) {
        await deleteDoc(doc(db, 'referenceFolders', fid));
      }
      if (allIds.includes(selectedFolderId)) setSelectedFolderId(null);
      setFolderDeleteConfirm(null);
    } catch (e) {
      console.error('폴더 삭제 오류:', e);
      alert('폴더 삭제 중 오류가 발생했습니다.');
    } finally {
      setFolderDeleting(false);
    }
  }

  async function handleMoveItem(itemId, folderId) {
    await updateDoc(doc(db, 'referenceLibrary', itemId), { folderId: folderId || null });
    setMovingItemId(null);
  }

  function handleMediaFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFormMediaFile(file);
    setFormMediaType(file.type.startsWith('video/') ? 'video' : 'image');
    setFormExtractUploaded(null);
  }

  function clearMedia() {
    if (formExtractUploaded) {
      deleteObject(ref(storage, formExtractUploaded.path)).catch(() => {});
      setFormExtractUploaded(null);
    }
    setFormMediaFile(null); setFormMediaType(null);
    if (mediaInputRef.current) mediaInputRef.current.value = '';
  }

  async function handleExtractFormScript() {
    if (!formMediaFile || !user) return;
    setFormExtracting(true);
    try {
      let tempPath = formExtractUploaded?.path;
      if (!tempPath) {
        const ext = formMediaFile.name.split('.').pop().toLowerCase();
        tempPath = `referenceMedia/${user.uid}/temp_extract_${Date.now()}/media.${ext}`;
        await uploadBytes(ref(storage, tempPath), formMediaFile);
        const tempUrl = await getDownloadURL(ref(storage, tempPath));
        setFormExtractUploaded({ path: tempPath, url: tempUrl, ext });
      }
      const fn = httpsCallable(functions, 'extractScript');
      const result = await fn({ storagePath: tempPath });
      if (result.data.text) setFormScript(result.data.text);
    } catch (e) {
      console.error('STT 오류:', e);
      alert('대본 추출 중 오류가 발생했습니다: ' + (e.message || '알 수 없는 오류'));
    } finally {
      setFormExtracting(false);
    }
  }

  async function handleAdd() {
    if (!formTitle.trim() || !formScript.trim() || !user) return;
    setSaving(true); setUploadProgress(0);
    try {
      const folderId = (selectedFolderId && selectedFolderId !== 'uncat') ? selectedFolderId : null;
      const docRef = await addDoc(collection(db, 'referenceLibrary'), {
        userId: user.uid, createdAt: serverTimestamp(),
        title: formTitle.trim(), link: formLink.trim() || null,
        script: formScript.trim(), preview: formScript.trim().slice(0, 50),
        memo: formMemo.trim() || null,
        analyzed: false, hookType: null, empathyTags: [], empathyPoint: null, analysis: null,
        folderId, mediaType: null, mediaUrl: null, thumbnailUrl: null, videoUrl: null,
      });

      if (formMediaFile) {
        const ext = formMediaFile.name.split('.').pop().toLowerCase();
        const basePath = `referenceMedia/${user.uid}/${docRef.id}`;
        setUploadProgress(15);

        let mediaUrl, mediaStoragePath_final;
        if (formExtractUploaded) {
          mediaUrl = formExtractUploaded.url;
          mediaStoragePath_final = formExtractUploaded.path;
          setUploadProgress(60);
        } else {
          const mediaRef = ref(storage, `${basePath}/media.${ext}`);
          await uploadBytes(mediaRef, formMediaFile);
          mediaUrl = await getDownloadURL(mediaRef);
          mediaStoragePath_final = `${basePath}/media.${ext}`;
          setUploadProgress(60);
        }

        let thumbnailUrl = null, thumbnailStoragePath = null;
        if (formMediaType === 'video') {
          const blob = await generateVideoThumbnail(formMediaFile);
          if (blob) {
            thumbnailStoragePath = `${basePath}/thumbnail.jpg`;
            await uploadBytes(ref(storage, thumbnailStoragePath), blob);
            thumbnailUrl = await getDownloadURL(ref(storage, thumbnailStoragePath));
          }
        } else {
          thumbnailUrl = mediaUrl;
          thumbnailStoragePath = mediaStoragePath_final;
        }
        setUploadProgress(95);
        await updateDoc(doc(db, 'referenceLibrary', docRef.id), {
          mediaType: formMediaType, mediaUrl, mediaStoragePath: mediaStoragePath_final,
          thumbnailUrl, thumbnailStoragePath, videoUrl: formMediaType === 'video' ? mediaUrl : null,
        });
      }

      setFormTitle(''); setFormLink(''); setFormScript(''); setFormMemo('');
      setFormExtractUploaded(null);
      clearMedia(); setShowForm(false);
    } catch (e) { console.error(e); }
    finally { setSaving(false); setUploadProgress(0); }
  }

  async function handleDelete(e, id) {
    e.stopPropagation();
    if (!confirm('이 레퍼런스를 삭제할까요?')) return;
    setDeleting(id);
    try {
      const item = items.find(i => i.id === id);
      for (const path of [item?.mediaStoragePath, item?.videoStoragePath, item?.thumbnailStoragePath && item?.mediaType !== 'image' ? item.thumbnailStoragePath : null]) {
        if (path) try { await deleteObject(ref(storage, path)); } catch {}
      }
      await deleteDoc(doc(db, 'referenceLibrary', id));
    } finally { setDeleting(null); }
  }

  function closeForm() {
    if (formExtractUploaded) {
      deleteObject(ref(storage, formExtractUploaded.path)).catch(() => {});
      setFormExtractUploaded(null);
    }
    setShowForm(false); setFormTitle(''); setFormLink(''); setFormScript(''); setFormMemo(''); clearMedia();
  }

  function getItemMediaType(item) {
    if (item.mediaType) return item.mediaType;
    if (item.videoUrl) return 'video';
    return null;
  }

  return (
    <div className="h-full flex flex-col">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">레퍼런스 라이브러리</h1>
          <p className="text-sm text-gray-500 mt-0.5">레퍼런스 대본을 저장하고 관리해보세요</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          새 레퍼런스 추가
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <FolderSidebar folders={folders} items={items} selectedFolderId={selectedFolderId}
          onSelect={setSelectedFolderId} onCreateFolder={handleCreateFolder}
          onRenameFolder={handleRenameFolder} onDeleteFolder={handleDeleteFolder} />

        {/* 카드 그리드 */}
        <div className="flex-1 overflow-y-auto p-5">
          <Breadcrumb folders={folders} selectedFolderId={selectedFolderId} onSelect={setSelectedFolderId} />

          {itemsLoading ? (
            <div className="flex items-center justify-center h-48 gap-2">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400">불러오는 중...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              </div>
              <p className="text-gray-600 font-medium">{selectedFolderId === null ? '아직 저장된 레퍼런스가 없어요' : '이 폴더에 레퍼런스가 없어요'}</p>
              <p className="text-sm text-gray-400 mt-1">{selectedFolderId === null ? '"새 레퍼런스 추가" 버튼으로 시작해보세요' : '레퍼런스를 추가하거나 폴더로 이동해보세요'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredItems.map(item => {
                const mtype = getItemMediaType(item);
                const isVideo = mtype === 'video';
                return (
                  <div key={item.id} onClick={() => setDetailItem(item)}
                    className="bg-white border border-gray-200 rounded-xl flex flex-col cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group overflow-hidden">

                    {/* 썸네일 3:4 비율 */}
                    <div className="relative w-full bg-gray-100 overflow-hidden flex-shrink-0" style={{ aspectRatio: '3/4' }}
                      onClick={e => { if (item.thumbnailUrl || item.videoUrl || item.mediaUrl) { e.stopPropagation(); setMediaModalItem(item); } }}>
                      {item.thumbnailUrl ? (
                        <>
                          <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                          {isVideo && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/35 transition-colors">
                              <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                                <svg className="w-4 h-4 text-gray-800 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-100">
                          <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    <div className="p-2.5 flex flex-col gap-1.5 flex-1">
                      <p className="text-xs font-bold text-gray-800 truncate">{item.title || getTitle(item.script)}</p>
                      <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2">
                        {(item.script || '').slice(0, 60)}{(item.script?.length ?? 0) > 60 ? '…' : ''}
                      </p>
                      <div className="flex items-center justify-between gap-1 mt-auto">
                        <div className="flex items-center gap-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.analyzed ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                            {item.analyzed ? '분석완료' : '미분석'}
                          </span>
                          {item.memo && <span className="text-[11px]" title={item.memo}>📌</span>}
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* 폴더 이동 */}
                          <div className="relative">
                            <button onClick={e => { e.stopPropagation(); setMovingItemId(movingItemId === item.id ? null : item.id); }}
                              className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-indigo-500 rounded-md hover:bg-indigo-50 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
                            </button>
                            {movingItemId === item.id && (
                              <div className="absolute right-0 top-7 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[140px] max-h-48 overflow-y-auto" onClick={e => e.stopPropagation()}>
                                <button onClick={() => handleMoveItem(item.id, null)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 text-gray-600">미분류</button>
                                {folders.map(f => (
                                  <button key={f.id} onClick={() => handleMoveItem(item.id, f.id)}
                                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${item.folderId === f.id ? 'text-indigo-600 font-semibold' : 'text-gray-600'}`}
                                    style={{ paddingLeft: f.parentId ? 20 : 12 }}>
                                    {f.parentId ? '└ ' : ''}{f.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {/* 삭제 */}
                          <button onClick={e => handleDelete(e, item.id)} disabled={deleting === item.id}
                            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-400 rounded-md hover:bg-red-50 transition-colors">
                            {deleting === item.id
                              ? <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                              : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            }
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 상세 모달 */}
      {detailItem && (
        <DetailModal item={detailItem} onClose={() => setDetailItem(null)} onGoAnalyze={handleGoAnalyze}
          onPlayMedia={() => { setDetailItem(null); setMediaModalItem(detailItem); }} />
      )}

      {/* 미디어 모달: 영상이면 VideoScriptModal, 이미지면 ImageModal */}
      {mediaModalItem && (
        getItemMediaType(mediaModalItem) === 'image'
          ? <ImageModal item={mediaModalItem} onClose={() => setMediaModalItem(null)} />
          : <VideoScriptModal item={mediaModalItem} onClose={() => setMediaModalItem(null)} />
      )}

      {/* 새 레퍼런스 추가 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeForm}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <h3 className="text-sm font-bold text-gray-900">새 레퍼런스 추가</h3>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">제목/주제명 <span className="text-red-400">*</span></label>
                <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)}
                  placeholder="예) 룰루레몬 브랜드반전 릴스" autoFocus
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">링크 <span className="font-normal text-gray-400 normal-case">(선택사항)</span></label>
                <input type="url" value={formLink} onChange={e => setFormLink(e.target.value)}
                  placeholder="인스타/틱톡 URL"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">이미지 / 영상 <span className="font-normal text-gray-400 normal-case">(선택사항 · jpg, png, gif, mp4, mov)</span></label>
                <input ref={mediaInputRef} type="file"
                  accept="image/jpeg,image/png,image/gif,.jpg,.jpeg,.png,.gif,video/mp4,video/quicktime,.mp4,.mov"
                  className="hidden" onChange={handleMediaFileChange} />
                {formMediaFile ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl">
                      <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={formMediaType === 'image' ? "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" : "M15 10l4.553-2.069A1 1 0 0121 8.868v6.264a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"} />
                      </svg>
                      <span className="text-xs text-indigo-700 font-medium flex-1 truncate">{formMediaFile.name}</span>
                      <button type="button" onClick={clearMedia} className="text-indigo-400 hover:text-indigo-600 flex-shrink-0 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => mediaInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 rounded-xl py-5 transition-colors text-gray-400 hover:text-indigo-500">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span className="text-sm font-medium">이미지 또는 영상 업로드</span>
                  </button>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">대본 텍스트 <span className="text-red-400">*</span></label>
                  <button
                    type="button"
                    onClick={handleExtractFormScript}
                    disabled={formExtracting || formMediaType !== 'video'}
                    title={formMediaType !== 'video' ? '영상을 먼저 업로드하세요' : (formExtractUploaded ? '다시 추출' : '대본 자동 추출')}
                    className={`flex items-center gap-1 text-xs font-semibold transition-colors ${formMediaType === 'video' && !formExtracting ? 'text-indigo-600 hover:text-indigo-800' : 'text-gray-300 cursor-not-allowed'}`}
                  >
                    {formExtracting ? (
                      <><div className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" />음성 인식 중...</>
                    ) : (
                      <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                      {formExtractUploaded ? '다시 추출' : '대본 자동 추출'}</>
                    )}
                  </button>
                </div>
                <textarea value={formScript} onChange={e => setFormScript(e.target.value)}
                  placeholder="대본을 입력하세요" rows={6}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 placeholder-gray-400 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">저장 메모 <span className="font-normal text-gray-400 normal-case">(선택)</span></label>
                <textarea value={formMemo} onChange={e => setFormMemo(e.target.value)}
                  placeholder="예) 이 후킹 구조 써먹고 싶어서 / CTA 방식 참고용" rows={2}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 placeholder-gray-400 resize-none" />
              </div>
              {(selectedFolderId && selectedFolderId !== 'uncat') && (
                <p className="text-xs text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2">
                  현재 선택된 폴더 <strong>"{folders.find(f => f.id === selectedFolderId)?.name}"</strong>에 저장됩니다
                </p>
              )}
            </div>
            <div className="px-6 pb-6 flex flex-col gap-3 flex-shrink-0">
              {saving && formMediaFile && uploadProgress > 0 && (
                <div>
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>{formMediaType === 'image' ? '이미지 업로드 중...' : '영상 업로드 중...'}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-indigo-500 h-full rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={handleAdd} disabled={!formTitle.trim() || !formScript.trim() || saving}
                  className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">
                  {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {saving ? (formMediaFile ? '업로드 중...' : '저장 중...') : '저장'}
                </button>
                <button onClick={closeForm} className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">취소</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 폴더 삭제 확인 모달 */}
      {folderDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4" onClick={() => !folderDeleting && setFolderDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">
                  <span className="text-red-600">"{folderDeleteConfirm.name}"</span> 폴더를 삭제할까요?
                </p>
                <p className="text-xs text-gray-500 mt-0.5">폴더 안의 카드는 미분류로 이동됩니다.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setFolderDeleteConfirm(null)} disabled={folderDeleting}
                className="flex-1 py-2.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors disabled:opacity-50">
                취소
              </button>
              <button onClick={confirmDeleteFolder} disabled={folderDeleting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:bg-red-300 rounded-xl transition-colors">
                {folderDeleting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {folderDeleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
