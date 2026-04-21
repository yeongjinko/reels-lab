import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useApp } from '../../App';

const NAV_ITEMS = [
  {
    path: '/',
    label: '스크립트 기획',
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    path: '/archive',
    label: '내 보관함',
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
  },
  {
    path: '/library',
    label: '레퍼런스 라이브러리',
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    soon: true,
  },
];

const SHOP_TYPE_BADGE = {
  women: { label: '여성', className: 'bg-pink-100 text-pink-600' },
  men: { label: '남성', className: 'bg-blue-100 text-blue-600' },
  both: { label: '여성+남성', className: 'bg-purple-100 text-purple-600' },
};

export default function Sidebar() {
  const { user } = useApp();
  const location = useLocation();
  const [recentScripts, setRecentScripts] = useState([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'scripts'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    return onSnapshot(q, (snap) => {
      setRecentScripts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [user]);

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 overflow-y-auto">
      <div className="p-3 flex-1">
        <nav className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.soon ? '#' : item.path}
                onClick={(e) => item.soon && e.preventDefault()}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-indigo-50 text-indigo-700'
                    : item.soon
                    ? 'text-gray-400 cursor-default'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span className={active ? 'text-indigo-600' : item.soon ? 'text-gray-300' : 'text-gray-400'}>
                  {item.icon}
                </span>
                {item.label}
                {item.soon && (
                  <span className="ml-auto text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-md">
                    준비중
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* 설정 링크 */}
        <Link
          to="/settings"
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mt-0.5 ${
            location.pathname === '/settings'
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <span className={location.pathname === '/settings' ? 'text-indigo-600' : 'text-gray-400'}>
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </span>
          설정
        </Link>

        {recentScripts.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-3 mb-2">
              최근 작업
            </p>
            <div className="flex flex-col gap-0.5">
              {recentScripts.map((script) => {
                const badge = SHOP_TYPE_BADGE[script.shopType];
                return (
                  <Link
                    key={script.id}
                    to="/archive"
                    className="flex items-start gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 group"
                  >
                    <svg className="w-3.5 h-3.5 text-gray-300 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-600 group-hover:text-gray-900 truncate font-medium">
                        {script.productName || '제목 없음'}
                      </p>
                      {badge && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
