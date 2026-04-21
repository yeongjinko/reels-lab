import React, { useState, useEffect } from 'react';

const SHOP_TYPE_OPTIONS = [
  { id: 'women', label: '여성의류', emoji: '👗' },
  { id: 'men', label: '남성의류', emoji: '👔' },
];

export default function ContextModal({ open, onClose, defaultShopType, onConfirm }) {
  const [shopType, setShopType] = useState(defaultShopType || 'women');
  const [brands, setBrands] = useState([{ name: '', desc: '' }]);

  useEffect(() => {
    if (open) setShopType(defaultShopType || 'women');
  }, [open, defaultShopType]);

  function addBrand() {
    setBrands((prev) => [...prev, { name: '', desc: '' }]);
  }

  function removeBrand(i) {
    setBrands((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateBrand(i, field, value) {
    setBrands((prev) => prev.map((b, idx) => (idx === i ? { ...b, [field]: value } : b)));
  }

  function handleConfirm() {
    const validBrands = brands.filter((b) => b.name.trim());
    onConfirm({ shopType, brands: validBrands });
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">

        {/* 헤더 */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">분석 컨텍스트 설정</h2>
            <p className="text-xs text-gray-500 mt-0.5">AI가 더 정확하게 분석할 수 있도록 맥락을 알려주세요</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-4 flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">

          {/* 타겟 고객 */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
              타겟 고객
            </label>
            <div className="flex gap-3">
              {SHOP_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setShopType(opt.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-medium text-sm transition-all ${
                    shopType === opt.id
                      ? opt.id === 'women'
                        ? 'bg-pink-50 border-pink-400 text-pink-700'
                        : 'bg-blue-50 border-blue-400 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <span>{opt.emoji}</span>
                  {opt.label}
                  {shopType === opt.id && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 브랜드/아이템 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                  브랜드 / 아이템 설명
                </label>
                <p className="text-xs text-gray-400 mt-0.5">선택사항 — 레퍼런스에 등장하는 브랜드나 상품</p>
              </div>
              <button
                onClick={addBrand}
                className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                추가
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {brands.map((brand, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <input
                      type="text"
                      value={brand.name}
                      onChange={(e) => updateBrand(i, 'name', e.target.value)}
                      placeholder='브랜드명 (예: 룰루레몬)'
                      className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    {brands.length > 1 && (
                      <button
                        onClick={() => removeBrand(i)}
                        className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <textarea
                    value={brand.desc}
                    onChange={(e) => updateBrand(i, 'desc', e.target.value)}
                    placeholder='설명 (예: 10만원대 고가 요가복, MZ 여성들이 선망하는 프리미엄 브랜드)'
                    rows={2}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-gray-400"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={handleConfirm}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            분석 시작
          </button>
        </div>
      </div>
    </div>
  );
}
