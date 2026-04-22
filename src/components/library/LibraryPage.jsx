import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase/config';
import { useApp } from '../../App';
import TemplateEditor from '../common/TemplateEditor';

const TAG_STYLES = {
  후킹: 'bg-orange-100 text-orange-700',
  본문: 'bg-green-100 text-green-700',
  심리: 'bg-purple-100 text-purple-700',
  CTA: 'bg-red-100 text-red-700',
};

const CATEGORY_ICONS = {
  '의류': '👗',
  '뷰티': '💄',
  '식품': '🍱',
  '생활용품': '🏠',
  '기타': '📦',
};

function DetailModal({ item, onClose }) {
  const navigate = useNavigate();

  function handleUse() {
    onClose();
    navigate('/', {
      state: {
        libraryItem: {
          script: item.script,
          analysis: {
            hookFormula: item.hookFormula,
            hookFormulaDesc: item.hookFormulaDesc,
            sentences: item.sentences || [],
          },
          templateData: {
            hookType: item.hookType,
            isNewType: item.isNewType,
            empathyPoint: item.empathyPoint,
            empathyTags: item.empathyTags || [],
            template: item.template,
          },
        },
      },
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {item.category && (
                <span className="text-sm">{CATEGORY_ICONS[item.category] || '📦'}</span>
              )}
              {item.hookType && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  item.isNewType ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-600'
                }`}>
                  {item.isNewType ? '✦ ' : ''}{item.hookType}
                </span>
              )}
              {item.category && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                  {item.category}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 flex-shrink-0 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

          {/* 공감 포인트 */}
          {item.empathyPoint && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <span className="text-xs font-bold text-orange-700 uppercase tracking-wider">공감 포인트</span>
              </div>
              <p className="text-sm text-orange-900 leading-relaxed mb-2.5">{item.empathyPoint}</p>
              {item.empathyTags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {item.empathyTags.map((tag, i) => (
                    <span key={i} className="text-[11px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 후킹 공식 */}
          {item.hookFormula && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">후킹 공식</span>
              </div>
              <p className="text-indigo-900 font-bold text-sm mb-1">{item.hookFormula}</p>
              {item.hookFormulaDesc && (
                <p className="text-indigo-700 text-xs leading-relaxed">{item.hookFormulaDesc}</p>
              )}
            </div>
          )}

          {/* 문장별 분석 */}
          {item.sentences?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">문장별 분석</p>
              <div className="flex flex-col gap-2">
                {item.sentences.map((s, i) => (
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

          {/* 원본 대본 */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">원본 대본</p>
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {item.script}
            </div>
          </div>

          {/* 템플릿 */}
          {item.template && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">스크립트 템플릿</p>
              <TemplateEditor key={item.template} template={item.template} />
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={handleUse}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            이 레퍼런스로 스크립트 작성
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LibraryPage() {
  const { user } = useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterHookType, setFilterHookType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'library'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, [user]);

  const allHookTypes = useMemo(() => {
    const types = [...new Set(items.map((i) => i.hookType).filter(Boolean))];
    return types;
  }, [items]);

  const allTags = useMemo(() => {
    const tags = [...new Set(items.flatMap((i) => i.empathyTags || []))];
    return tags;
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (filterHookType && item.hookType !== filterHookType) return false;
      if (filterCategory && item.category !== filterCategory) return false;
      if (filterTag && !(item.empathyTags || []).includes(filterTag)) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          item.script?.toLowerCase().includes(q) ||
          item.hookFormula?.toLowerCase().includes(q) ||
          item.empathyPoint?.toLowerCase().includes(q) ||
          (item.empathyTags || []).some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [items, filterHookType, filterCategory, filterTag, search]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <h1 className="text-lg font-bold text-gray-900">레퍼런스 라이브러리</h1>
        <p className="text-sm text-gray-500 mt-0.5">저장한 레퍼런스를 탐색하고 스크립트 작성에 활용해보세요</p>
      </div>

      {/* 필터 바 */}
      <div className="px-6 py-3 border-b border-gray-100 bg-white flex-shrink-0 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="검색..."
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
          />
        </div>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white text-gray-700"
        >
          <option value="">전체 카테고리</option>
          {Object.keys(CATEGORY_ICONS).map((cat) => (
            <option key={cat} value={cat}>{CATEGORY_ICONS[cat]} {cat}</option>
          ))}
        </select>

        {allHookTypes.length > 0 && (
          <select
            value={filterHookType}
            onChange={(e) => setFilterHookType(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white text-gray-700"
          >
            <option value="">전체 유형</option>
            {allHookTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}

        {(filterHookType || filterCategory || filterTag || search) && (
          <button
            onClick={() => { setFilterHookType(''); setFilterCategory(''); setFilterTag(''); setSearch(''); }}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            필터 초기화
          </button>
        )}
      </div>

      {/* 태그 필터 */}
      {allTags.length > 0 && (
        <div className="px-6 py-2 border-b border-gray-100 bg-white flex-shrink-0 flex flex-wrap gap-1.5">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setFilterTag(filterTag === tag ? '' : tag)}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors ${
                filterTag === tag
                  ? 'bg-orange-500 text-white'
                  : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48 gap-2">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">불러오는 중...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500">
              {items.length === 0 ? '아직 저장된 레퍼런스가 없어요' : '검색 결과가 없어요'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {items.length === 0 ? '스크립트 기획 페이지에서 레퍼런스를 분석하고 저장해보세요' : '다른 검색어나 필터를 시도해보세요'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="text-left bg-white border border-gray-200 rounded-2xl p-4 hover:border-indigo-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                  {item.category && (
                    <span className="text-base">{CATEGORY_ICONS[item.category] || '📦'}</span>
                  )}
                  {item.hookType && (
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      item.isNewType ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-600'
                    }`}>
                      {item.isNewType ? '✦ ' : ''}{item.hookType}
                    </span>
                  )}
                  {item.category && (
                    <span className="text-[11px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                      {item.category}
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-700 font-medium leading-relaxed line-clamp-3 mb-3">
                  {item.preview || item.script?.slice(0, 80)}
                </p>

                {item.empathyPoint && (
                  <p className="text-xs text-orange-600 leading-relaxed line-clamp-2 mb-2.5">
                    {item.empathyPoint}
                  </p>
                )}

                {item.empathyTags?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.empathyTags.slice(0, 4).map((tag, i) => (
                      <span key={i} className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedItem && (
        <DetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}
