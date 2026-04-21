import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useApp } from '../../App';

const SHOP_TYPES = [
  {
    id: 'women',
    label: '여성의류',
    emoji: '👗',
    desc: '감성, 트렌드, 스타일링 중심의 분석',
    active: 'bg-pink-50 border-pink-400 text-pink-800',
    check: 'text-pink-500',
  },
  {
    id: 'men',
    label: '남성의류',
    emoji: '👔',
    desc: '기능성, 소재, 가성비 중심의 분석',
    active: 'bg-blue-50 border-blue-400 text-blue-800',
    check: 'text-blue-500',
  },
  {
    id: 'both',
    label: '둘 다',
    emoji: '🛍️',
    desc: '상황에 맞게 두 가지 분석 모두 활용',
    active: 'bg-purple-50 border-purple-400 text-purple-800',
    check: 'text-purple-500',
  },
];

export default function SettingsPage() {
  const { user, userData, setUserData } = useApp();
  const [shopType, setShopType] = useState(userData?.shopType || 'women');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const isDirty = shopType !== userData?.shopType;

  async function handleSave() {
    if (!isDirty || saving) return;
    setSaving(true);
    setError('');
    try {
      await updateDoc(doc(db, 'users', user.uid), { shopType });
      setUserData({ ...userData, shopType });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-8">
      <h1 className="text-lg font-bold text-gray-900 mb-6">설정</h1>

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-sm font-bold text-gray-700 mb-1">쇼핑몰 타입</h2>
        <p className="text-xs text-gray-400 mb-4">AI 분석 기준이 되는 타겟 고객 유형이에요</p>

        <div className="flex flex-col gap-2.5 mb-6">
          {SHOP_TYPES.map((type) => {
            const isSelected = shopType === type.id;
            return (
              <button
                key={type.id}
                onClick={() => setShopType(type.id)}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all text-left ${
                  isSelected
                    ? type.active
                    : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="text-xl">{type.emoji}</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{type.label}</p>
                  <p className={`text-xs mt-0.5 ${isSelected ? 'opacity-60' : 'text-gray-400'}`}>
                    {type.desc}
                  </p>
                </div>
                {isSelected && (
                  <svg className={`w-5 h-5 flex-shrink-0 ${type.check}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              저장 중...
            </>
          ) : saved ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              저장됨
            </>
          ) : (
            '저장하기'
          )}
        </button>
      </div>
    </div>
  );
}
