import React, { useState, useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import {
  Fish,
  MapPin,
  ChevronDown,
  ShieldCheck,
  Check,
  X,
  Layers,
  Trash2
} from 'lucide-react';
import clsx from 'clsx';
import { writeBatch, doc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import type { PointCreature, Point, Creature } from '../../../types';

interface ReviewListViewProps {
  initialViewMode?: 'point' | 'creature';
}

export const ReviewListView: React.FC<ReviewListViewProps> = ({ initialViewMode = 'point' }) => {
  const { points, creatures, pointCreatures } = useApp();
  const [viewMode, setViewMode] = useState<'point' | 'creature'>(initialViewMode);
  const [filterPending, setFilterPending] = useState(true);
  const [filterRejected, setFilterRejected] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);

  // 1. Group Data for Review
  const groupedData = useMemo(() => {
    const pcList = pointCreatures.filter(pc => {
      // 1. Pending Filter
      if (filterPending && pc.status === 'pending') return true;
      // 2. Rejected/Auto-Rejected Filter
      if (filterRejected && (pc.status === 'rejected' || pc.status === 'deletion_requested')) return true;
      return false;
    });

    if (viewMode === 'point') {
      // Point -> [Creatures]
      const map = new Map<string, (PointCreature & { creature?: Creature })[]>();
      pcList.forEach(pc => {
        if (!map.has(pc.pointId)) map.set(pc.pointId, []);
        const creature = creatures.find(c => c.id === pc.creatureId);
        map.get(pc.pointId)!.push({ ...pc, creature });
      });
      return Array.from(map.entries()).map(([pointId, items]) => ({
        id: pointId,
        parent: points.find(p => p.id === pointId),
        items: items.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
      })).filter(g => g.parent);
    } else {
      // Creature -> [Points]
      const map = new Map<string, (PointCreature & { point?: Point })[]>();
      pcList.forEach(pc => {
        if (!map.has(pc.creatureId)) map.set(pc.creatureId, []);
        const point = points.find(p => p.id === pc.pointId);
        map.get(pc.creatureId)!.push({ ...pc, point });
      });
      return Array.from(map.entries()).map(([creatureId, items]) => ({
        id: creatureId,
        parent: creatures.find(c => c.id === creatureId),
        items: items.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
      })).filter(g => g.parent);
    }
  }, [pointCreatures, points, creatures, viewMode, filterPending, filterRejected]);

  // Bulk Actions
  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    setProcessing(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.update(doc(db, 'point_creatures', id), { status: 'approved' });
      });
      await batch.commit();
      setSelectedIds(new Set());
    } catch (e) { console.error(e); } finally { setProcessing(false); }
  };

  const handleBulkReject = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`選択した ${selectedIds.size} 件を削除しますか？`)) return;
    setProcessing(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.delete(doc(db, 'point_creatures', id));
      });
      await batch.commit();
      setSelectedIds(new Set());
    } catch (e) { console.error(e); } finally { setProcessing(false); }
  };

  const toggleSelect = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (!checked) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSelectAll = (ids: string[]) => {
    setSelectedIds(new Set(ids));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  return (
    <div className="space-y-6">
      {/* View Switcher & Toolbar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex p-1 bg-gray-100 rounded-2xl">
          <button
            onClick={() => setViewMode('point')}
            className={clsx(
              "flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-black transition-all",
              viewMode === 'point' ? "bg-white text-ocean-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <MapPin size={16} /> ポイント別
          </button>
          <button
            onClick={() => setViewMode('creature')}
            className={clsx(
              "flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-black transition-all",
              viewMode === 'creature' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Fish size={16} /> 生物別
          </button>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={filterPending}
              onChange={() => setFilterPending(!filterPending)}
              className="w-4 h-4 rounded text-ocean-500 focus:ring-ocean-500 border-gray-300"
            />
            <span className="text-sm font-bold text-gray-600 group-hover:text-gray-900 transition-colors">未承認</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={filterRejected}
              onChange={() => setFilterRejected(!filterRejected)}
              className="w-4 h-4 rounded text-red-500 focus:ring-red-500 border-gray-300"
            />
            <span className="text-sm font-bold text-gray-600 group-hover:text-gray-900 transition-colors">却下・削除済み</span>
          </label>

          <div className="h-4 w-[1px] bg-gray-200" />

          {selectedIds.size > 0 ? (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
              <span className="text-sm font-black text-ocean-600 mr-2">{selectedIds.size} selected</span>

              <button onClick={handleDeselectAll} className="text-xs text-gray-400 hover:text-gray-600 underline mr-2">全解除</button>
              <button
                onClick={handleBulkApprove}
                disabled={processing}
                className="p-2 bg-ocean-50 text-ocean-600 rounded-xl hover:bg-ocean-100 transition-colors"
                title="一括承認"
              >
                <Check size={20} />
              </button>
              <button
                onClick={handleBulkReject}
                disabled={processing}
                className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors"
                title="一括却下"
              >
                <Trash2 size={20} />
              </button>
            </div>
          ) : (
            <div className="text-sm text-gray-400 font-bold italic">Select items to bulk edit</div>
          )}
        </div>
      </div>

      {/* Main List */}
      <div className="space-y-4">
        {groupedData.map((group) => (
          <div key={group.id} className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
            <button
              onClick={() => setExpandedId(expandedId === group.id ? null : group.id)}
              className="w-full px-8 py-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
            >
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400">
                  {viewMode === 'point' ? <MapPin size={28} /> : <Fish size={28} />}
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-xl font-black text-gray-900">{group.parent?.name || 'Unknown'}</h4>
                    <span className="px-3 py-1 bg-gray-100 rounded-full text-[10px] font-black uppercase tracking-wider text-gray-500">
                      {group.items.length} ASSOCIATIONS
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const newSet = new Set(selectedIds);
                        const groupIds = group.items.map(i => i.id);
                        const allSelected = groupIds.every(id => newSet.has(id));

                        if (allSelected) {
                          groupIds.forEach(id => newSet.delete(id));
                        } else {
                          groupIds.forEach(id => newSet.add(id));
                        }
                        setSelectedIds(newSet);
                      }}
                      className={clsx(
                        "ml-2 text-[10px] font-bold underline bg-transparent transition-colors",
                        group.items.every(i => selectedIds.has(i.id)) ? "text-red-500 hover:text-red-600" : "text-ocean-600 hover:text-ocean-700"
                      )}
                    >
                      {group.items.every(i => selectedIds.has(i.id)) ? 'Uncheck Group' : 'Check Group'}
                    </button>
                  </div>
                  <p className="text-sm text-gray-400 font-medium tracking-wide">
                    {viewMode === 'point' ? (group.parent as Point)?.area : (group.parent as Creature)?.family}
                  </p>
                </div>
              </div>
              <div className={clsx("transition-transform duration-300", expandedId === group.id && "rotate-180")}>
                <ChevronDown size={24} className="text-gray-300" />
              </div>
            </button>

            {expandedId === group.id && (
              <div className="px-8 pb-8 space-y-3 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="grid grid-cols-1 gap-3">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className={clsx(
                        "group relative p-4 rounded-2xl border transition-all flex items-center justify-between gap-4",
                        selectedIds.has(item.id)
                          ? "bg-ocean-50 border-ocean-200 shadow-sm"
                          : "bg-white border-gray-100 hover:border-gray-200 hover:shadow-md"
                      )}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSelect(item.id, !selectedIds.has(item.id)); }}
                          className={clsx(
                            "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                            selectedIds.has(item.id)
                              ? "bg-ocean-500 border-ocean-500 text-white"
                              : "bg-white border-gray-200 group-hover:border-ocean-300"
                          )}
                        >
                          {selectedIds.has(item.id) && <Check size={14} strokeWidth={4} />}
                        </button>

                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="font-bold text-gray-900">
                              {('creature' in item) ? (item as any).creature?.name : (item as any).point?.name}
                            </span>
                            <div className={clsx(
                              "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest",
                              item.confidence && item.confidence > 0.8 ? "bg-emerald-50 text-emerald-600" :
                                item.confidence && item.confidence > 0.5 ? "bg-amber-50 text-amber-600" :
                                  "bg-rose-50 text-rose-600"
                            )}>
                              {Math.round((item.confidence || 0.5) * 100)}% Match
                            </div>
                            <div className="px-2 py-0.5 bg-gray-50 text-gray-400 rounded text-[10px] font-black uppercase tracking-widest">
                              {item.localRarity}
                            </div>
                          </div>
                          {item.reasoning && (
                            <p className="text-xs text-gray-500 leading-relaxed max-w-2xl">
                              <ShieldCheck size={12} className="inline mr-1 text-ocean-400" />
                              {item.reasoning}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setSelectedIds(new Set([item.id])); handleBulkApprove(); }}
                          className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-xl transition-colors"
                        >
                          <Check size={18} />
                        </button>
                        <button
                          onClick={() => { setSelectedIds(new Set([item.id])); handleBulkReject(); }}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {groupedData.length === 0 && (
          <div className="text-center py-32 bg-gray-50/50 rounded-[3rem] border-2 border-dashed border-gray-100">
            <Layers size={48} className="mx-auto text-gray-200 mb-4" />
            <h3 className="text-lg font-black text-gray-400">No mappings to review</h3>
            <p className="text-sm text-gray-400 mt-1">Run cleansing to generate new candidates.</p>
          </div>
        )}
      </div>
    </div >
  );
};
