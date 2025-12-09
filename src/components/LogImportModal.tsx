import React, { useState } from 'react';
import { X, Upload, FileText, Check, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { parseCSV, type ParsedLog } from '../utils/logParser';
import { HierarchicalPointSelector } from './HierarchicalPointSelector'; // [NEW]
import clsx from 'clsx'; // [NEW]

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export const LogImportModal = ({ isOpen, onClose, onImportComplete }: Props) => {
  const { points, addLog } = useApp();
  const [step, setStep] = useState<'upload' | 'preview' | 'saving'>('upload');
  const [parsedLogs, setParsedLogs] = useState<ParsedLog[]>([]);
  const [selectedPointIds, setSelectedPointIds] = useState<Record<number, string>>({});
  const [activeSelectorIndex, setActiveSelectorIndex] = useState<number | null>(null); // [NEW] Track active row
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set()); // [NEW] Track checked rows
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    try {
      const text = await file.text();
      const results = await parseCSV(text);
      if (results.length === 0) {
        setError('有効なデータが見つかりませんでした。CSVフォーマットを確認してください。');
        return;
      }
      setParsedLogs(results);
      // Default select all
      setSelectedIndices(new Set(results.map((_, i) => i)));
      setStep('preview');
    } catch (err) {
      console.error(err);
      setError('ファイルの解析に失敗しました。');
    }
  };

  // [NEW] Simplified handler
  const handlePointSelect = (pointId: string) => {
    if (activeSelectorIndex !== null) {
      setSelectedPointIds(prev => ({ ...prev, [activeSelectorIndex]: pointId }));
      if (pointId) setActiveSelectorIndex(null); // Close on selection
    }
  };

  const toggleSelection = (index: number) => {
    const newSet = new Set(selectedIndices);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedIndices(newSet);
  };

  const toggleAll = () => {
    if (selectedIndices.size === parsedLogs.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(parsedLogs.map((_, i) => i)));
    }
  };

  const handleImport = async () => {
    setStep('saving');
    try {
      let importedCount = 0;
      // Filter by selected indices
      const indicesToImport = Array.from(selectedIndices).sort((a, b) => a - b);

      for (const i of indicesToImport) {
        const raw = parsedLogs[i];
        const pointId = selectedPointIds[i];

        // Skip logs without selected point? Or default to checking later?
        // Requirement said "Choose point". Let's assume mandatory for now, or skip if empty.
        // Actually user said "Select point (Required)" in data, but let's allow skipping if user wants via logic?
        // For now, if no point Id, maybe skip or warn. Let's skip valid rows only.
        if (!raw.date) continue;

        const point = points.find(p => p.id === pointId);

        const logData: any = {
          date: raw.date,
          title: raw.title,
          time: {
            entry: raw.time?.entry || '',
            exit: raw.time?.exit || '',
            duration: raw.time?.duration || 0,
            surfaceInterval: raw.time?.surfaceInterval
          },
          depth: raw.depth || { max: 0, average: 0 },
          location: {
            pointId: pointId || '', // Optional now
            pointName: point?.name || raw.title || raw.location?.pointName || 'Unknown Point',
            region: point?.areaId || ''
          },
          spotId: pointId || '',  // Optional now
          condition: raw.condition || {},
          gear: {
            suitType: 'wet',
            tank: raw.gear?.tank || {}
          },
          photos: [],
          isPrivate: false
        };

        await addLog(logData);
        importedCount++;
      }

      alert(`${importedCount} 件のログをインポートしました！`);
      onImportComplete();
      onClose();
      // Reset
      setStep('upload');
      setParsedLogs([]);
      setSelectedPointIds({});
      setSelectedIndices(new Set());
      setActiveSelectorIndex(null);
    } catch (e) {
      console.error(e);
      setError('保存中にエラーが発生しました。');
      setStep('preview');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col relative">

        {/* Overlay for Hierarchical Selector */}
        {activeSelectorIndex !== null && (
          <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => setActiveSelectorIndex(null)}>
            <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-lg space-y-4 animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg text-gray-800">ダイビングポイントを選択</h3>
                <button onClick={() => setActiveSelectorIndex(null)} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} /></button>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800 mb-2">
                <div>元データ: <span className="font-bold">{parsedLogs[activeSelectorIndex].title || '名称なし'}</span></div>
                <div>日付: {parsedLogs[activeSelectorIndex].date}</div>
              </div>
              <HierarchicalPointSelector
                value={selectedPointIds[activeSelectorIndex] || ''}
                onChange={handlePointSelect}
              />
            </div>
          </div>
        )}

        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Upload size={24} className="text-blue-500" />
            ログのインポート (Garmin簡易版)
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1">
          {error && (
            <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
              <AlertCircle size={20} />
              {error}
            </div>
          )}

          {step === 'upload' && (
            <div className="border-2 border-dashed border-gray-300 rounded-3xl p-12 text-center hover:border-blue-400 hover:bg-blue-50 transition-all group cursor-pointer relative">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="w-16 h-16 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <FileText size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-700 mb-2">CSVファイルを選択またはドラッグ&ドロップ</h3>
              <p className="text-gray-500 text-sm">
                Garmin Connect などのCSV形式に対応<br />
                <span className="text-xs text-gray-400 mt-2 inline-block">※ AquaLang対応やGarminの詳細データの取込は、将来提供予定です</span>
              </p>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                {parsedLogs.length} 件のデータが見つかりました。詳細を確認し、ダイビングポイントを選択してください。
              </p>

              <div className="overflow-x-auto border border-gray-200 rounded-xl min-h-[300px]">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIndices.size === parsedLogs.length && parsedLogs.length > 0}
                          onChange={toggleAll}
                          className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                        />
                      </th>
                      <th className="p-3 whitespace-nowrap">日付</th>
                      <th className="p-3 whitespace-nowrap">タイトル (元データ)</th>
                      <th className="p-3 whitespace-nowrap w-[250px]">ポイント選択</th>
                      <th className="p-3 whitespace-nowrap">時間</th>
                      <th className="p-3 whitespace-nowrap">最大水深</th>
                      <th className="p-3 whitespace-nowrap">水温</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsedLogs.map((log, idx) => {
                      const selectedId = selectedPointIds[idx];
                      const selectedPoint = points.find(p => p.id === selectedId);
                      const isSelected = selectedIndices.has(idx);
                      return (
                        <tr key={idx} className={clsx("hover:bg-blue-50/50 transition-colors", isSelected ? "bg-white" : "bg-gray-50 opacity-60")}>
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelection(idx)}
                              className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                            />
                          </td>
                          <td className="p-3 font-mono">{log.date || 'Invalid Date'}</td>
                          <td className="p-3 text-gray-600 font-bold">{log.title || log.location?.pointName || '--'}</td>
                          <td className="p-3">
                            <button
                              onClick={() => {
                                if (!isSelected) toggleSelection(idx); // Auto-select row if editing
                                setActiveSelectorIndex(idx);
                              }}
                              className={clsx(
                                "w-full text-left px-3 py-2 rounded-lg border transition-all text-sm truncate",
                                selectedPoint
                                  ? "bg-blue-50 border-blue-200 text-blue-700 font-bold hover:bg-blue-100"
                                  : "bg-white border-gray-300 text-gray-400 hover:border-blue-400"
                              )}
                            >
                              {selectedPoint ? selectedPoint.name : "ポイントを選択 (任意)..."}
                            </button>
                          </td>
                          <td className="p-3">{log.time?.duration} min</td>
                          <td className="p-3">{log.depth?.max} m</td>
                          <td className="p-3">{log.condition?.waterTemp?.bottom || '--'} ℃</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 'saving' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-gray-600 font-bold">インポート中...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'preview' && (
          <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-2xl">
            <button
              onClick={() => { setStep('upload'); setParsedLogs([]); setSelectedPointIds({}); }}
              className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-200 rounded-lg transition-colors"
            >
              戻る
            </button>
            <button
              onClick={handleImport}
              className="px-6 py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-colors shadow-lg shadow-blue-200 flex items-center gap-2"
            >
              <Check size={18} />
              インポート実行
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
