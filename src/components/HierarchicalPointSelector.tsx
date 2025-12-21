import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { ChevronRight, MapPin } from 'lucide-react';
import clsx from 'clsx';

interface HierarchicalPointSelectorProps {
  value: string;
  onChange: (pointId: string) => void;
  onHierarchyChange?: (region: string, zone: string, area: string) => void;
  className?: string;
}

export const HierarchicalPointSelector: React.FC<HierarchicalPointSelectorProps> = ({
  value,
  onChange,
  onHierarchyChange,
  className,
}) => {
  const { regions, zones, areas, points } = useApp();

  // Selection State
  const [selectedRegionId, setSelectedRegionId] = useState<string>('');
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');

  // Initialization: If value (pointId) is provided, reverse engineer the hierarchy
  useEffect(() => {
    if (!value) return;

    const point = points.find((p: { id: string; areaId: string }) => p.id === value);
    if (!point) return;

    // Find Area
    const area = areas.find((a: { id: string; zoneId: string }) => a.id === point.areaId);
    if (area) {
      // eslint-disable-next-line
      setSelectedAreaId(area.id);

      // Find Zone
      const zone = zones.find((z: { id: string; regionId: string }) => z.id === area.zoneId);
      if (zone) {
        setSelectedZoneId(zone.id);

        // Find Region
        const region = regions.find((r: { id: string }) => r.id === zone.regionId);
        if (region) {
          setSelectedRegionId(region.id);
          // Notify parent of full hierarchy (optional, usually parent knows if it passed value)
          // But effectively we want to sync
        }
      }
    }
  }, [value, regions, zones, areas, points]);

  // Handlers
  const handleRegionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const rId = e.target.value;
    setSelectedRegionId(rId);
    setSelectedZoneId('');
    setSelectedAreaId('');
    onChange(''); // Reset point
    onHierarchyChange?.(rId, '', '');
  };

  const handleZoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newZoneId = e.target.value;
    setSelectedZoneId(newZoneId);

    // Reverse lookup: Find Region
    let rId = selectedRegionId;
    if (newZoneId) {
      const zone = zones.find((z: { id: string; regionId: string }) => z.id === newZoneId);
      if (zone) {
        setSelectedRegionId(zone.regionId);
        rId = zone.regionId;
      }
    }

    setSelectedAreaId('');
    onChange(''); // Reset point
    onHierarchyChange?.(rId, newZoneId, '');
  };

  const handleAreaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newAreaId = e.target.value;
    setSelectedAreaId(newAreaId);

    // Reverse lookup: Find Zone and Region
    let zId = selectedZoneId;
    let rId = selectedRegionId;

    if (newAreaId) {
      const area = areas.find((a: { id: string; zoneId: string }) => a.id === newAreaId);
      if (area) {
        setSelectedZoneId(area.zoneId);
        zId = area.zoneId;

        const zone = zones.find((z: { id: string; regionId: string }) => z.id === area.zoneId);
        if (zone) {
          setSelectedRegionId(zone.regionId);
          rId = zone.regionId;
        }
      }
    }
    onChange(''); // Reset point
    onHierarchyChange?.(rId, zId, newAreaId);
  };

  const handlePointChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  };

  // Filtered Options Logic
  const visibleZones = useMemo(
    () => selectedRegionId
      ? zones.filter((z: { regionId: string }) => z.regionId === selectedRegionId)
      : zones,
    [zones, selectedRegionId]
  );

  const visibleAreas = useMemo(
    () => selectedAreaId && !selectedZoneId // Fallback for reverse lookup if needed
      ? areas
      : selectedZoneId
        ? areas.filter((a: { zoneId: string }) => a.zoneId === selectedZoneId)
        : selectedRegionId
          ? areas.filter((a: { regionId: string }) => a.regionId === selectedRegionId)
          : areas,
    [areas, selectedZoneId, selectedRegionId, selectedAreaId]
  );

  const visiblePoints = useMemo(() => {
    if (selectedAreaId) {
      return points.filter((p: { areaId: string }) => p.areaId === selectedAreaId);
    }
    if (selectedZoneId) {
      return points.filter((p: { zoneId: string }) => p.zoneId === selectedZoneId);
    }
    if (selectedRegionId) {
      return points.filter((p: { regionId: string }) => p.regionId === selectedRegionId);
    }
    return points;
  }, [points, selectedAreaId, selectedZoneId, selectedRegionId]);

  return (
    <div className={clsx("space-y-3", className)}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Region */}
        <div className="relative">
          <label className="block text-xs font-bold text-gray-500 mb-1">地域 (Region)</label>
          <select
            value={selectedRegionId}
            onChange={handleRegionChange}
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:outline-none focus:border-blue-500 appearance-none"
          >
            <option value="">地域を選択...</option>
            {regions.map((r: { id: string; name: string }) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-[2.2rem] pointer-events-none text-gray-400">
            <ChevronRight size={14} className="rotate-90" />
          </div>
        </div>

        {/* Zone */}
        <div className="relative">
          <label className="block text-xs font-bold text-gray-500 mb-1">エリア (Zone)</label>
          <select
            value={selectedZoneId}
            onChange={handleZoneChange}
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:outline-none focus:border-blue-500 appearance-none"
          >
            <option value="">{selectedRegionId ? 'エリアを選択...' : '全エリアから選択'}</option>
            {visibleZones.map((z: { id: string; name: string }) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-[2.2rem] pointer-events-none text-gray-400">
            <ChevronRight size={14} className="rotate-90" />
          </div>
        </div>

        {/* Area */}
        <div className="relative">
          <label className="block text-xs font-bold text-gray-500 mb-1">詳細エリア (Area)</label>
          <select
            value={selectedAreaId}
            onChange={handleAreaChange}
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:outline-none focus:border-blue-500 appearance-none"
          >
            <option value="">{selectedZoneId ? '詳細エリアを選択...' : '全詳細エリアから選択'}</option>
            {visibleAreas.map((a: { id: string; name: string }) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-[2.2rem] pointer-events-none text-gray-400">
            <ChevronRight size={14} className="rotate-90" />
          </div>
        </div>
      </div>

      {/* Point */}
      <div className="relative">
        <label className="block text-sm font-bold text-gray-700 mb-1">ポイント (Point)</label>
        <div className="relative">
          <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ocean" />
          <select
            value={value}
            onChange={handlePointChange}
            disabled={!selectedAreaId}
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-ocean-200 focus:border-ocean outline-none appearance-none disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-all"
          >
            <option value="">ポイントを選択してください</option>
            {visiblePoints.map((p: { id: string; name: string }) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
            <ChevronRight size={16} className="rotate-90" />
          </div>
        </div>
        {!selectedAreaId && (
          <p className="text-xs text-gray-400 mt-1 pl-1">
            ※ 上の選択ボックスから地域・エリアを選択してください
          </p>
        )}
      </div>
    </div>
  );
};
