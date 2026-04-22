import React, { useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useApp } from '../../App';

export default function OnboardingPage() {
  const { user, setUserData } = useApp();
  const [saving, setSaving] = useState(false);

  async function handleStart() {
    if (!user) return;
    setSaving(true);
    try {
      const data = {
        displayName: user.displayName || '',
        email: user.email || '',
        photoURL: user.photoURL || '',
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'users', user.uid), data);
      setUserData(data);
    } catch {
      alert('저장에 실패했습니다. 다시 시도해주세요.');
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center gap-2 mb-6">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
          </div>
          <span className="text-2xl font-bold text-gray-900">릴스랩</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          환영합니다, {user?.displayName?.split(' ')[0]}님!
        </h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          잘 되는 릴스 대본을 붙여넣으면<br />
          AI가 후킹 공식을 분석해드립니다.
        </p>

        <button
          onClick={handleStart}
          disabled={saving}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              잠깐만요...
            </>
          ) : (
            '시작하기 →'
          )}
        </button>
      </div>
    </div>
  );
}
