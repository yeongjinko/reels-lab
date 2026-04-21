import React, { useState, useEffect } from 'react';
import { saveApiKey, hasApiKey } from '../../services/anthropic';

export default function ApiKeyModal({ open, onClose }) {
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      setSaved(false);
      setKey(localStorage.getItem('reelslab_api_key') || '');
    }
  }, [open]);

  function handleSave() {
    const trimmed = key.trim();
    if (!trimmed) return;
    saveApiKey(trimmed);
    setSaved(true);
    setTimeout(() => onClose(), 800);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Anthropic API 키 설정</h2>
            <p className="text-sm text-gray-500 mt-1">AI 분석 기능을 사용하려면 API 키가 필요합니다</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-4">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
          <p className="text-xs text-amber-700 leading-relaxed">
            <strong>안내:</strong> API 키는 브라우저 로컬 스토리지에만 저장되며 서버로 전송되지 않습니다.
            <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="underline ml-1">
              console.anthropic.com
            </a>
            에서 발급받으세요.
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">API 키</label>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-ant-..."
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={!key.trim() || saved}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {saved ? (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              저장됨
            </>
          ) : '저장하기'}
        </button>
      </div>
    </div>
  );
}
