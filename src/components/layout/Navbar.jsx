import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { useApp } from '../../App';

export default function Navbar() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);

  async function handleLogout() {
    await signOut(auth);
    navigate('/login');
  }

  return (
    <nav className="h-14 bg-white border-b border-gray-200 flex items-center px-5 gap-4 flex-shrink-0 z-10">
      <Link to="/" className="flex items-center gap-2 mr-2">
        <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
          </svg>
        </div>
        <span className="font-bold text-gray-900 text-base">릴스랩</span>
      </Link>

      <div className="flex-1" />

      <Link
        to="/archive"
        className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-indigo-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-indigo-50"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
        보관함
      </Link>

      <div className="relative">
        <button
          onClick={() => setAccountOpen((v) => !v)}
          className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
        >
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full" />
          ) : (
            <div className="w-7 h-7 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-semibold">
              {user?.displayName?.[0] || 'U'}
            </div>
          )}
          <span className="text-sm text-gray-700 hidden sm:block">{user?.displayName?.split(' ')[0]}</span>
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {accountOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setAccountOpen(false)} />
            <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-20">
              <div className="px-4 py-2.5 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">{user?.displayName}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                로그아웃
              </button>
            </div>
          </>
        )}
      </div>
    </nav>
  );
}
