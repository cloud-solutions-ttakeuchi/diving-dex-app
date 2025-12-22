import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { ChevronDown, MapPin, Search } from 'lucide-react';
import clsx from 'clsx';

interface HierarchicalPointSelectorProps {
  value: string;
  onChange: (pointId: string) => void;
  onHierarchyChange?: (region: string, zone: string, area: string) => void;
  className?: string;
  label?: string;
}

export const HierarchicalPointSelector: React.FC<HierarchicalPointSelectorProps> = ({
  value,
  onChange,
  onHierarchyChange,
  className,
  label = "POINT SELECTION"
}) => {
  const { regions, zones, areas, points } = useApp();

  // Selection State
  const [hierarchy, setHierarchy] = useState({
    regionId: '',
    zoneId: '',
    areaId: ''
  });
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Sync hierarchy with value during render to avoid useEffect cascading renders
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (value) {
      const point = points.find((p: { id: string; areaId: string }) => p.id === value);
      if (point) {
        const area = areas.find((a: { id: string; zoneId: string }) => a.id === point.areaId);
        if (area) {
          const zone = zones.find((z: { id: string; regionId: string }) => z.id === area.zoneId);
          const region = zone ? regions.find((r: { id: string }) => r.id === zone.regionId) : null;
          setHierarchy({
            areaId: area.id,
            zoneId: zone?.id || '',
            regionId: region?.id || ''
          });
        }
      }
    } else {
      setHierarchy({ regionId: '', zoneId: '', areaId: '' });
    }
  }

  // Handlers
  const handleRegionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const rId = e.target.value;
    setHierarchy({
      regionId: rId,
      zoneId: '',
      areaId: ''
    });
    onChange(''); // Reset point
    onHierarchyChange?.(rId, '', '');
  };

  const handleZoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newZoneId = e.target.value;
    let rId = hierarchy.regionId;

    if (newZoneId) {
      const zone = zones.find((z: { id: string; regionId: string }) => z.id === newZoneId);
      if (zone) {
        rId = zone.regionId;
      }
    }

    setHierarchy({
      regionId: rId,
      zoneId: newZoneId,
      areaId: ''
    });
    onChange(''); // Reset point
    onHierarchyChange?.(rId, newZoneId, '');
  };

  const handleAreaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newAreaId = e.target.value;
    let zId = hierarchy.zoneId;
    let rId = hierarchy.regionId;

    if (newAreaId) {
      const area = areas.find((a: { id: string; zoneId: string }) => a.id === newAreaId);
      if (area) {
        zId = area.zoneId;
        const zone = zones.find((z: { id: string; regionId: string }) => z.id === area.zoneId);
        if (zone) {
          rId = zone.regionId;
        }
      }
    }

    setHierarchy({
      regionId: rId,
      zoneId: zId,
      areaId: newAreaId
    });
    onChange(''); // Reset point
    onHierarchyChange?.(rId, zId, newAreaId);
  };

  const handlePointChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  };

  // Filtered Options Logic
  const visibleZones = useMemo(
    () => hierarchy.regionId
      ? zones.filter((z: { regionId: string }) => z.regionId === hierarchy.regionId)
      : zones,
    [zones, hierarchy.regionId]
  );

  const visibleAreas = useMemo(
    () => hierarchy.areaId && !hierarchy.zoneId // Fallback for reverse lookup if needed
      ? areas
      : hierarchy.zoneId
        ? areas.filter((a: { zoneId: string }) => a.zoneId === hierarchy.zoneId)
        : hierarchy.regionId
          ? areas.filter((a: { regionId: string }) => a.regionId === hierarchy.regionId)
          : areas,
    [areas, hierarchy.zoneId, hierarchy.regionId, hierarchy.areaId]
  );

  const filteredPoints = useMemo(() => {
    let pts = points;
    if (hierarchy.areaId) {
      pts = pts.filter((p: { areaId: string }) => p.areaId === hierarchy.areaId);
    } else if (hierarchy.zoneId) {
      pts = pts.filter((p: { zoneId: string }) => p.zoneId === hierarchy.zoneId);
    } else if (hierarchy.regionId) {
      pts = pts.filter((p: { regionId: string }) => p.regionId === hierarchy.regionId);
    }

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      pts = pts.filter((p: { name: string }) => p.name.toLowerCase().includes(s));
    }

    return pts;
  }, [points, hierarchy, searchTerm]);

  return (
    <div className={clsx("bg-gray-50/50 p-6 rounded-3xl border border-gray-100 space-y-6", className)}>
      {/* Top Filtering Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Region */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">REGION</label>
          <div className="relative group">
            <select
              value={hierarchy.regionId}
              onChange={handleRegionChange}
              className="w-full pl-4 pr-10 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-gray-700 outline-none focus:border-ocean focus:ring-4 focus:ring-ocean-50/50 transition-all appearance-none cursor-pointer group-hover:border-gray-300"
            >
              <option value="">全地域 (All Regions)</option>
              {regions.map((r: { id: string; name: string }) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-transform group-hover:text-ocean" />
          </div>
        </div>

        {/* Zone */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">ZONE</label>
          <div className="relative group">
            <select
              value={hierarchy.zoneId}
              onChange={handleZoneChange}
              className="w-full pl-4 pr-10 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-gray-700 outline-none focus:border-ocean focus:ring-4 focus:ring-ocean-50/50 transition-all appearance-none cursor-pointer group-hover:border-gray-300"
            >
              <option value="">全ゾーン (All Zones)</option>
              {visibleZones.map((z: { id: string; name: string }) => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-transform group-hover:text-ocean" />
          </div>
        </div>
      </div>

      {/* Area Selection */}
      <div className="space-y-1.5">
        <label className="block text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">AREA</label>
        <div className="relative group">
          <select
            value={hierarchy.areaId}
            onChange={handleAreaChange}
            className="w-full pl-4 pr-10 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-gray-700 outline-none focus:border-ocean focus:ring-4 focus:ring-ocean-50/50 transition-all appearance-none cursor-pointer group-hover:border-gray-300"
          >
            <option value="">全エリア (All Areas)</option>
            {visibleAreas.map((a: { id: string; name: string }) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-transform group-hover:text-ocean" />
        </div>
      </div>

      <div className="h-[1px] bg-gray-100 mx-1"></div>

      {/* Point Selection with Search */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between px-1">
          <label className="block text-[10px] font-black text-gray-400 tracking-widest uppercase">{label}</label>
          <span className="text-[10px] font-black text-ocean tracking-widest uppercase">{filteredPoints.length} hits</span>
        </div>

        <div className="space-y-3">
          {/* Search Box */}
          <div className="relative group">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-ocean transition-colors" />
            <input
              type="text"
              placeholder="ポイント名で絞り込み..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-gray-700 outline-none focus:border-ocean focus:ring-4 focus:ring-ocean-50/50 transition-all placeholder:text-gray-300"
            />
          </div>

          {/* Point Result Dropdown */}
          <div className="relative group">
            <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ocean" />
            <select
              value={value}
              onChange={handlePointChange}
              className="w-full pl-11 pr-10 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-gray-900 outline-none focus:border-ocean focus:ring-4 focus:ring-ocean-50/50 transition-all appearance-none cursor-pointer"
            >
              <option value="">ポイントを選択してください</option>
              {filteredPoints.map((p: { id: string; name: string }) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-transform group-hover:text-ocean" />
          </div>
        </div>

        {!hierarchy.areaId && !searchTerm && (
          <p className="text-[10px] text-gray-400 font-bold px-1 italic">
            ※ 地域・エリア・キーワードでポイントを絞り込めます
          </p>
        )}
      </div>
    </div>
  );
};
