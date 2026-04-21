import React, { useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useApp } from '../../App';

const SHOP_TYPES = [
  {
    id: 'women',
    label: '여성의류',
    emoji: '👗',
    desc: '감성, 트렌드, 스타일링 중심의 분석',
    color: 'pink',
    bg: 'bg-pink-50',
    border: 'border-pink-300',
    badge: 'bg-pink-100 text-pink-700',
    check: 'bg-pink-500',
  },
  {
    id: 'men',
    label: '남성의류',
    emoji: '👔',
    desc: '기능성, 소재, 가성비 중심의 분석',
    color: 'blue',
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    badge: 'bg-blue-100 text-blue-700',
    check: 'bg-blue-500',
  },
  {
    id: 'both',
    label: '둘 다',
    emoji: '🛍️',
    desc: '상황에 맞게 두 가지 분석 모두 활용',
    color: 'purple',
    bg: 'bg-purple-50',
    border: 'border-purple-300',
    badge: 'bg-purple-100 text-purple-700',
    check: 'bg-purple-500',
  },
];

export default function OnboardingPage() {
  const { user, setUserData } = useApp();
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    if (!selected || !user) return;
    setSaving(true);
    try {
      const data = {
        shopType: selected,
        displayName: user.displayName || '',
        email: user.email || '',
        photoURL: user.photoURL || '',
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'users', user.uid), data);
      setUserData(data);
    } catch (e) {
      alert('저장에 실패했습니다. 다시 시도해주세요.');
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-5">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-900">릴스랩</span>
          </div>
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-widest mb-2">온보딩</p>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">어떤 쇼핑몰을 운영하시나요?</h1>
          <p className="text-gray-500 text-sm">
            선택하신 타입에 맞춰 AI가 스크립트를 분석하고 작성해드립니다
          </p>
        </div>

        <div className="flex flex-col gap-3 mb-6">
          {SHOP_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => setSelected(type.id)}
              className={`relative flex items-center gap-4 p-5 rounded-2xl border-2 text-left transition-all ${
                selected === type.id
                  ? `${type.bg} ${type.border} shadow-md`
                  : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="text-3xl">{type.emoji}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{type.label}</span>
                  {selected === type.id && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${type.badge}`}>
                      선택됨
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{type.desc}</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                selected === type.id ? `${type.check} border-transparent` : 'border-gray-300'
              }`}>
                {selected === type.id && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={handleConfirm}
          disabled={!selected || saving}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              저장 중...
            </>
          ) : (
            '시작하기 →'
          )}
        </button>

        <p className="text-center text-xs text-gray-400 mt-3">나중에 설정에서 변경할 수 있습니다</p>
      </div>
    </div>
  );
}
