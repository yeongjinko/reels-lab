import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import ReferencePanel from './ReferencePanel';
import ScriptPanel from './ScriptPanel';

export default function ScriptPlanningPage() {
  const location = useLocation();
  const libraryItem = location.state?.libraryItem;

  const [analysis, setAnalysis] = useState(libraryItem?.analysis || null);
  const [referenceText, setReferenceText] = useState(libraryItem?.script || '');
  const [referenceId, setReferenceId] = useState(libraryItem?.id || null);

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <h1 className="text-lg font-bold text-gray-900">스크립트 기획</h1>
        <p className="text-sm text-gray-500 mt-0.5">레퍼런스를 분석하고 내 상품에 맞는 릴스 스크립트를 만들어보세요</p>
      </div>

      <div className="flex flex-1 overflow-hidden gap-0">
        <div className="w-1/2 border-r border-gray-200 bg-white overflow-hidden flex flex-col">
          <ReferencePanel
            onAnalysisDone={setAnalysis}
            onReferenceText={setReferenceText}
            onReferenceId={setReferenceId}
            initialText={libraryItem?.script}
            initialAnalysis={libraryItem?.analysis}
          />
        </div>
        <div className="w-1/2 bg-white overflow-hidden flex flex-col">
          <ScriptPanel
            analysis={analysis}
            referenceText={referenceText}
            referenceId={referenceId}
            initialTemplateData={libraryItem?.templateData}
          />
        </div>
      </div>
    </div>
  );
}
