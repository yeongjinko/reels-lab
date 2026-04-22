import React from 'react';
import { useApp } from '../../App';

export default function SettingsPage() {
  const { user } = useApp();

  return (
    <div className="max-w-lg mx-auto px-6 py-8">
      <h1 className="text-lg font-bold text-gray-900 mb-6">설정</h1>

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-sm font-bold text-gray-700 mb-4">계정</h2>
        <div className="flex items-center gap-3">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full" />
          ) : (
            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-semibold">
              {user?.displayName?.[0] || 'U'}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-gray-900">{user?.displayName}</p>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
