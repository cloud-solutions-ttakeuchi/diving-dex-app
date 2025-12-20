import React, { useState, useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import {
  Play,
  Search,
  MapPin,
  Fish,
  Loader2,
  AlertTriangle,
  Database,
  Info
} from 'lucide-react';
import clsx from 'clsx';

interface DashboardStats {
  total: number;
  approved: number;
  pending: number;
  byPoint: number;
  byCreature: number;
}

export const CleansingDashboard = () => {
  const { points: allPoints, creatures: allCreatures, pointCreatures, regions, zones, areas } = useApp();

  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<'all' | 'new' | 'specific' | 'replace'>('new');

  // Scoping State
  const [targetRegionId, setTargetRegionId] = useState('');
  const [targetZoneId, setTargetZoneId] = useState('');
  const [targetAreaId, setTargetAreaId] = useState('');
  const [targetPointId, setTargetPointId] = useState('');
  const [targetCreatureId, setTargetCreatureId] = useState('');

  // Search State
  const [pointSearch, setPointSearch] = useState('');
  const [creatureSearch, setCreatureSearch] = useState('');

  const [progress, setProgress] = useState(0);

  // Stats calculation
  const stats = useMemo<DashboardStats>(() => {
    return {
      total: pointCreatures.length,
      approved: pointCreatures.filter(pc => pc.status === 'approved').length,
      pending: pointCreatures.filter(pc => pc.status === 'pending').length,
      byPoint: allPoints.length,
      byCreature: allCreatures.length
    };
  }, [pointCreatures, allPoints, allCreatures]);

  // Filtered Options Logic
  const filteredZones = useMemo(() =>
    targetRegionId ? zones.filter(z => z.regionId === targetRegionId) : zones
    , [zones, targetRegionId]);

  const filteredAreas = useMemo(() => {
    if (targetZoneId) return areas.filter(a => a.zoneId === targetZoneId);
    if (targetRegionId) {
      const zIds = zones.filter(z => z.regionId === targetRegionId).map(z => z.id);
      return areas.filter(a => zIds.includes(a.zoneId));
    }
    return areas;
  }, [areas, targetZoneId, targetRegionId, zones]);

  const filteredPoints = useMemo(() => {
    // 1. First, define the scope based on hierarchy
    let list = allPoints;
    if (targetAreaId) {
      list = list.filter(p => p.areaId === targetAreaId);
    } else if (targetZoneId) {
      const aIds = areas.filter(a => a.zoneId === targetZoneId).map(a => a.id);
      list = list.filter(p => aIds.includes(p.areaId));
    } else if (targetRegionId) {
      const zIds = zones.filter(z => z.regionId === targetRegionId).map(z => z.id);
      const aIds = areas.filter(a => zIds.includes(a.zoneId)).map(a => a.id);
      list = list.filter(p => aIds.includes(p.areaId));
    }

    // 2. Then, filter WITHIN that scope using the search keyword
    if (pointSearch) {
      const s = pointSearch.toLowerCase();
      list = list.filter(p => {
        const name = (p.name || '').toLowerCase();
        const area = (p.area || '').toLowerCase();
        const zone = (p.zone || '').toLowerCase();
        return name.includes(s) || area.includes(s) || zone.includes(s);
      });
    }
    return list;
  }, [allPoints, targetAreaId, targetZoneId, targetRegionId, areas, zones, pointSearch]);

  const filteredCreatures = useMemo(() => {
    let list = allCreatures;
    if (creatureSearch) {
      const s = creatureSearch.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(s) ||
        (c.scientificName || '').toLowerCase().includes(s) ||
        (c.family || '').toLowerCase().includes(s)
      );
    }
    return list;
  }, [allCreatures, creatureSearch]);

  const handleRunCleansing = async () => {
    const targetPoint = allPoints.find(p => p.id === targetPointId);
    const targetArea = areas.find(a => a.id === targetAreaId);
    const targetZone = zones.find(z => z.id === targetZoneId);
    const targetRegion = regions.find(r => r.id === targetRegionId);
    const targetCreature = allCreatures.find(c => c.id === targetCreatureId);

    const locationName = targetPoint ? `ポイント: ${targetPoint.name}`
      : targetArea ? `エリア: ${targetArea.name}`
        : targetZone ? `ゾーン: ${targetZone.name}`
          : targetRegion ? `リージョン: ${targetRegion.name}`
            : '全地域';

    const creatureName = targetCreature ? `生物: ${targetCreature.name}` : '対象: 全生物マスタ';

    const confirmMsg = `【実行確認】
モード: ${mode === 'new' ? '新規追加' : mode === 'all' ? 'リセット' : mode === 'replace' ? '入れ替え' : '範囲指定'}
対象範囲: ${locationName}
対象生物: ${creatureName}

AIによるクレンジングを開始します。よろしいですか？`;

    if (!window.confirm(confirmMsg)) return;

    setIsRunning(true);
    setProgress(5);

    try {
      const { auth } = await import('../../../lib/firebase');
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Unauthenticated");

      const response = await fetch('/api/runDataCleansing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          data: {
            mode,
            regionId: targetRegionId || undefined,
            zoneId: targetZoneId || undefined,
            areaId: targetAreaId || undefined,
            pointId: targetPointId || undefined,
            creatureId: targetCreatureId || undefined
          }
        })
      });

      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

      alert('クレンジングジョブがバックグラウンドで開始されました。数分後に結果が反映されます。');
    } catch (e) {
      console.error(e);
      alert('エラーが発生しました。');
    } finally {
      setIsRunning(false);
      setProgress(0);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative group text-left">
          <div className="flex items-center gap-3 text-gray-500 mb-2 font-bold text-sm">
            <Database size={18} /> TOTAL MAPPINGS
            <div className="relative group/tooltip">
              <Info size={14} className="text-gray-300 hover:text-ocean-500 cursor-help transition-colors" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded-lg opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-20 font-medium">
                システムに登録されている「ポイント」と「生物」の紐付けの総数です。承認済みと保留中の両方を含みます。
              </div>
            </div>
          </div>
          <div className="text-3xl font-black text-gray-900">{stats.total.toLocaleString()}</div>
          <div className="mt-2 text-xs text-gray-400">Approved: {stats.approved} / Pending: {stats.pending}</div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-left">
          <div className="flex items-center gap-3 text-ocean-500 mb-2 font-bold text-sm">
            <MapPin size={18} /> POINTS
          </div>
          <div className="text-3xl font-black text-gray-900">{stats.byPoint}</div>
          <div className="mt-2 text-xs text-gray-400">Location Master Data</div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-left">
          <div className="flex items-center gap-3 text-indigo-500 mb-2 font-bold text-sm">
            <Fish size={18} /> CREATURES
          </div>
          <div className="text-3xl font-black text-gray-900">{stats.byCreature}</div>
          <div className="mt-2 text-xs text-gray-400">Biological Dictionary</div>
        </div>

        <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 shadow-sm text-left">
          <div className="flex items-center gap-3 text-amber-600 mb-2 font-bold text-sm">
            <AlertTriangle size={18} /> NEEDS REVIEW
          </div>
          <div className="text-3xl font-black text-amber-700">{stats.pending}</div>
          <div className="mt-2 text-xs text-amber-600 font-bold uppercase tracking-widest animate-pulse">Action Required</div>
        </div>
      </div>

      {/* 2. Controls */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
        <div className="flex flex-col md:flex-row items-start justify-between gap-10">
          <div className="flex-1 min-w-0 md:max-w-md lg:max-w-lg space-y-3 text-left">
            <h3 className="text-2xl font-black text-gray-900 leading-tight">クレンジング実行コントロール</h3>
            <p className="text-gray-500 font-medium leading-relaxed">
              Vertex AIを使用して、生物とポイントの紐付けを最新化・最適化します。<br className="hidden lg:block" />
              地形・水域条件に基づきフィルタリングした後、Google検索で事実確認（グラウンディング）を行います。
            </p>
          </div>

          <div className="w-full md:w-[420px] shrink-0 flex flex-col gap-4 text-left">
            <div className="flex p-1 bg-gray-100 rounded-2xl">
              {(['new', 'all', 'specific', 'replace'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={clsx(
                    "flex-1 px-4 py-2 rounded-xl text-sm font-black transition-all",
                    mode === m ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {m === 'new' ? '新規' : m === 'all' ? 'リセット' : m === 'specific' ? '範囲指定' : '入れ替え'}
                </button>
              ))}
            </div>

            {(mode === 'specific' || mode === 'replace') && (
              <div className="flex flex-col gap-4 p-5 bg-gray-50 rounded-[2rem] animate-in slide-in-from-top-4 duration-300">
                {/* Hierarchical Point Selector */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Region</label>
                      <select
                        value={targetRegionId}
                        onChange={(e) => {
                          setTargetRegionId(e.target.value);
                          setTargetZoneId('');
                          setTargetAreaId('');
                          setTargetPointId('');
                        }}
                        className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-ocean-500 outline-none"
                      >
                        <option value="">全地域 (All Regions)</option>
                        {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Zone</label>
                      <select
                        value={targetZoneId}
                        onChange={(e) => {
                          setTargetZoneId(e.target.value);
                          setTargetAreaId('');
                          setTargetPointId('');
                        }}
                        className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-ocean-500 outline-none"
                      >
                        <option value="">全ゾーン (All Zones)</option>
                        {filteredZones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Area</label>
                    <select
                      value={targetAreaId}
                      onChange={(e) => {
                        setTargetAreaId(e.target.value);
                        setTargetPointId('');
                      }}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-ocean-500 outline-none"
                    >
                      <option value="">全エリア (All Areas)</option>
                      {filteredAreas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex justify-between">
                      Point Selection
                      {filteredPoints.length > 0 && <span className="text-ocean-600 lowercase">{filteredPoints.length} hits</span>}
                    </label>
                    <div className="relative mb-2">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="ポイント名で絞り込み..."
                        value={pointSearch}
                        onChange={(e) => setPointSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-[11px] font-medium focus:ring-2 focus:ring-ocean-500 outline-none"
                      />
                    </div>
                    <select
                      value={targetPointId}
                      onChange={(e) => setTargetPointId(e.target.value)}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-ocean-500 outline-none"
                    >
                      <option value="">{targetAreaId ? '指定エリア内の全ポイント' : 'ポイントを選択 (任意)'}</option>
                      {filteredPoints.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="h-px bg-gray-200 my-1" />

                {/* Creature Selector with Search */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex justify-between">
                    Target Creature (Optional)
                    {creatureSearch && <span className="text-indigo-600 lowercase">{filteredCreatures.length} matches</span>}
                  </label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="生物名、科名で検索..."
                      value={creatureSearch}
                      onChange={(e) => setCreatureSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-[11px] font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <select
                    value={targetCreatureId}
                    onChange={(e) => setTargetCreatureId(e.target.value)}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">全生物を検証対象にする</option>
                    {filteredCreatures.slice(0, 100).map(c => <option key={c.id} value={c.id}>{c.name} ({c.scientificName || c.family})</option>)}
                    {filteredCreatures.length > 100 && <option disabled>... results truncated, please use search</option>}
                  </select>
                </div>
              </div>
            )}

            <button
              onClick={handleRunCleansing}
              disabled={isRunning || ((mode === 'specific' || mode === 'replace') && !targetRegionId && !targetZoneId && !targetAreaId && !targetPointId)}
              className={clsx(
                "flex items-center justify-center gap-3 px-8 py-5 rounded-2xl font-black transition-all shadow-xl",
                isRunning || ((mode === 'specific' || mode === 'replace') && !targetRegionId && !targetZoneId && !targetAreaId && !targetPointId)
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed shadow-none"
                  : "bg-slate-900 text-white hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] shadow-slate-200"
              )}
            >
              {isRunning ? (
                <>
                  <Loader2 className="animate-spin" />
                  CLEANSING IN PROGRESS...
                </>
              ) : (
                <>
                  <Play size={20} fill="currentColor" />
                  クレンジング実行開始
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
