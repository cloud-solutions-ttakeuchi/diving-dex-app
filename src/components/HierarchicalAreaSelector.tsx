import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { ChevronDown, MapPin } from 'lucide-react';
import clsx from 'clsx';

interface HierarchicalAreaSelectorProps {
  regionId: string;
  zoneId: string;
  areaId: string;
  onRegionChange: (id: string) => void;
  onZoneChange: (id: string) => void;
  onAreaChange: (id: string) => void;
  className?: string;
}

export const HierarchicalAreaSelector: React.FC<HierarchicalAreaSelectorProps> = ({
  regionId,
  zoneId,
  areaId,
  onRegionChange,
  onZoneChange,
  onAreaChange,
  className
}) => {
  const { regions, zones, areas } = useApp();

  const visibleZones = useMemo(() =>
    regionId ? zones.filter(z => z.regionId === regionId) : [],
    [regionId, zones]
  );

  const visibleAreas = useMemo(() =>
    zoneId ? areas.filter(a => a.zoneId === zoneId) : [],
    [zoneId, areas]
  );

  return (
    <div className={clsx("bg-gray-50/50 p-6 rounded-3xl border border-gray-100 space-y-6", className)}>
      <div className="flex items-center gap-2 px-1">
        <MapPin size={16} className="text-gray-400" />
        <span className="text-[10px] font-black text-gray-400 tracking-widest uppercase">AREA SELECTION</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* REGION */}
        <div className="space-y-2">
          <label className="block text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">REGION</label>
          <div className="relative group">
            <select
              value={regionId}
              onChange={(e) => onRegionChange(e.target.value)}
              className="w-full pl-4 pr-10 py-3 bg-white border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100/50 transition-all appearance-none cursor-pointer"
            >
              <option value="">Regionを選択</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none transition-transform group-hover:text-gray-500" />
          </div>
        </div>

        {/* ZONE */}
        <div className="space-y-2">
          <label className="block text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">ZONE</label>
          <div className="relative group">
            <select
              value={zoneId}
              disabled={!regionId}
              onChange={(e) => onZoneChange(e.target.value)}
              className="w-full pl-4 pr-10 py-3 bg-white border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100/50 transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Zoneを選択</option>
              {visibleZones.map((z) => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none transition-transform group-hover:text-gray-500" />
          </div>
        </div>

        {/* AREA */}
        <div className="space-y-2">
          <label className="block text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">AREA</label>
          <div className="relative group">
            <select
              value={areaId}
              disabled={!zoneId}
              onChange={(e) => onAreaChange(e.target.value)}
              className="w-full pl-4 pr-10 py-3 bg-white border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100/50 transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Areaを選択</option>
              {visibleAreas.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none transition-transform group-hover:text-gray-500" />
          </div>
        </div>
      </div>
    </div>
  );
};
