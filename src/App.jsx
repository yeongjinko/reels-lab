import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase/config';
import LoginPage from './components/auth/LoginPage';
import OnboardingPage from './components/onboarding/OnboardingPage';
import MainLayout from './components/layout/MainLayout';
import ScriptPlanningPage from './components/script/ScriptPlanningPage';
import ArchivePage from './components/archive/ArchivePage';
import SettingsPage from './components/settings/SettingsPage';

export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
          setUserData(snap.exists() ? snap.data() : null);
        } catch {
          setUserData(null);
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" style={{ borderWidth: 3 }} />
          <p className="text-sm text-gray-500">불러오는 중...</p>
        </div>
      </div>
    );
  }

  const isLoggedIn = !!user;
  const hasOnboarded = !!(userData?.shopType);

  return (
    <AppContext.Provider value={{ user, userData, setUserData }}>
      <Router>
        <Routes>
          <Route
            path="/login"
            element={isLoggedIn ? <Navigate to="/" replace /> : <LoginPage />}
          />
          <Route
            path="/onboarding"
            element={
              !isLoggedIn ? <Navigate to="/login" replace /> :
              hasOnboarded ? <Navigate to="/" replace /> :
              <OnboardingPage />
            }
          />
          <Route
            path="/"
            element={
              !isLoggedIn ? <Navigate to="/login" replace /> :
              !hasOnboarded ? <Navigate to="/onboarding" replace /> :
              <MainLayout><ScriptPlanningPage /></MainLayout>
            }
          />
          <Route
            path="/archive"
            element={
              !isLoggedIn ? <Navigate to="/login" replace /> :
              !hasOnboarded ? <Navigate to="/onboarding" replace /> :
              <MainLayout><ArchivePage /></MainLayout>
            }
          />
          <Route
            path="/settings"
            element={
              !isLoggedIn ? <Navigate to="/login" replace /> :
              !hasOnboarded ? <Navigate to="/onboarding" replace /> :
              <MainLayout><SettingsPage /></MainLayout>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AppContext.Provider>
  );
}
