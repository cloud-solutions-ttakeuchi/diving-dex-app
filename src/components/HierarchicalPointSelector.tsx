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

    const point = points.find((p) => p.id === value);
    if (!point) return;

    // Find Area
    const area = areas.find((a) => a.id === point.areaId);
    if (area) {
      setSelectedAreaId(area.id);

      // Find Zone
      const zone = zones.find((z) => z.id === area.zoneId);
      if (zone) {
        setSelectedZoneId(zone.id);

        // Find Region
        const region = regions.find((r) => r.id === zone.regionId);
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
      const zone = zones.find(z => z.id === newZoneId);
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
      const area = areas.find(a => a.id === newAreaId);
      if (area) {
        setSelectedZoneId(area.zoneId);
        zId = area.zoneId;

        const zone = zones.find(z => z.id === area.zoneId);
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
  // If parent is selected, filter children. If not, show ALL options to allow reverse selection.
  const visibleZones = useMemo(
    () => selectedRegionId
      ? zones.filter((z) => z.regionId === selectedRegionId)
      : zones,
    [zones, selectedRegionId]
  );

  const visibleAreas = useMemo(
    () => selectedZoneId
      ? areas.filter((a) => a.zoneId === selectedZoneId)
      : selectedRegionId // If only region selected, show all areas in that region? Or all areas?
        ? areas.filter(a => {
          const z = zones.find(zone => zone.id === a.zoneId);
          return z?.regionId === selectedRegionId;
        })
        : areas,
    [areas, selectedZoneId, selectedRegionId, zones]
  );

  const visiblePoints = useMemo(() => {
    if (selectedAreaId) {
      return points.filter(p => p.areaId === selectedAreaId);
    }
    if (selectedZoneId) {
      const areaIdsInZone = areas.filter(a => a.zoneId === selectedZoneId).map(a => a.id);
      return points.filter(p => areaIdsInZone.includes(p.areaId));
    }
    if (selectedRegionId) {
      const zoneIdsInRegion = zones.filter(z => z.regionId === selectedRegionId).map(z => z.id);
      const areaIdsInRegion = areas.filter(a => zoneIdsInRegion.includes(a.zoneId)).map(a => a.id);
      return points.filter(p => areaIdsInRegion.includes(p.areaId));
    }
    return points; // Return all points if nothing selected (Reverse Lookup)
  }, [points, selectedAreaId, selectedZoneId, selectedRegionId, areas, zones]);

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
            {regions.map((r) => (
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
            {visibleZones.map((z) => (
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
            {visibleAreas.map((a) => (
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
            {visiblePoints.map((p) => (
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
