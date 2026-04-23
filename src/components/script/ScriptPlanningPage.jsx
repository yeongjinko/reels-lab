import React, { useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import ReferencePanel from './ReferencePanel';
import ScriptPanel from './ScriptPanel';

export default function ScriptPlanningPage() {
  const location = useLocation();

  const [pendingItem] = useState(() => {
    try {
      const saved = sessionStorage.getItem('pendingLibraryItem');
      if (saved) {
        sessionStorage.removeItem('pendingLibraryItem');
        return JSON.parse(saved);
      }
    } catch {}
    return null;
  });

  const navState = location.state || {};
  const initText = pendingItem?.referenceText || navState.referenceText || '';
  const initRefId = pendingItem?.referenceId || navState.referenceId || null;
  const initAnalysis = pendingItem?.existingAnalysis || null;
  const initTemplate = pendingItem?.existingTemplate || null;

  const [analysis, setAnalysis] = useState(initAnalysis);
  const [referenceText, setReferenceText] = useState(initText);
  const [referenceId, setReferenceId] = useState(initRefId);
  const [templateOverride, setTemplateOverride] = useState(initTemplate);
  const [scriptPanelKey, setScriptPanelKey] = useState(0);

  const isInitialSync = useRef(true);

  function handleAnalysisDone(newAnalysis) {
    if (isInitialSync.current) {
      isInitialSync.current = false;
      setAnalysis(newAnalysis);
      return;
    }
    setAnalysis(newAnalysis);
    setTemplateOverride(null);
  }

  function handleReanalysisStart() {
    isInitialSync.current = false;
    setAnalysis(null);
    setTemplateOverride(null);
    setScriptPanelKey((k) => k + 1);
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <h1 className="text-lg font-bold text-gray-900">스크립트 기획</h1>
        <p className="text-sm text-gray-500 mt-0.5">레퍼런스를 분석하고 내 상품에 맞는 릴스 스크립트를 만들어보세요</p>
      </div>

      <div className="flex flex-1 overflow-hidden gap-0">
        <div className="w-1/2 border-r border-gray-200 bg-white overflow-hidden flex flex-col">
          <ReferencePanel
            onAnalysisDone={handleAnalysisDone}
            onReferenceText={setReferenceText}
            onReferenceId={setReferenceId}
            onReanalysisStart={handleReanalysisStart}
            initialText={initText}
            initialAnalysis={initAnalysis}
            initialReferenceId={initRefId}
          />
        </div>
        <div className="w-1/2 bg-white overflow-hidden flex flex-col">
          <ScriptPanel
            key={scriptPanelKey}
            analysis={analysis}
            referenceText={referenceText}
            referenceId={referenceId}
            initialTemplateData={templateOverride}
          />
        </div>
      </div>
    </div>
  );
}
