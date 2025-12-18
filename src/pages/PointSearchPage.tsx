import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ChevronRight, MapPin, Droplets, Anchor, Wind, Mountain, ArrowRight, Bookmark, Image as ImageIcon } from 'lucide-react';
import clsx from 'clsx';
import type { Region, Zone, Area } from '../types';

export const PointSearchPage = () => {
  const { points: allPoints, regions: allRegions, zones: allZones, areas: allAreas, currentUser, toggleBookmarkPoint } = useApp();
  const [searchParams] = useSearchParams();

  // Navigation State
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);

  // Handle Query Parameters
  useEffect(() => {
    const regionName = searchParams.get('region');
    const zoneName = searchParams.get('zone');
    const areaName = searchParams.get('area');

    if (regionName) {
      const region = allRegions.find(r => r.name === regionName);
      if (region) {
        setSelectedRegion(region);
        if (zoneName) {
          const zone = allZones.find(z => z.name === zoneName && z.regionId === region.id);
          if (zone) {
            setSelectedZone(zone);
            if (areaName) {
              const area = allAreas.find(a => a.name === areaName && a.zoneId === zone.id);
              if (area) {
                setSelectedArea(area);
              } else {
                setSelectedArea(null);
              }
            } else {
              setSelectedArea(null);
            }
          } else {
            setSelectedZone(null);
            setSelectedArea(null);
          }
        } else {
          setSelectedZone(null);
          setSelectedArea(null);
        }
      } else {
        setSelectedRegion(null);
        setSelectedZone(null);
        setSelectedArea(null);
      }
    } else {
      setSelectedRegion(null);
      setSelectedZone(null);
      setSelectedArea(null);
    }
  }, [searchParams, allRegions, allZones, allAreas]);

  // Data Helpers
  const regions = allRegions;
  const zones = selectedRegion ? allZones.filter(z => z.regionId === selectedRegion.id) : [];
  const areas = selectedZone ? allAreas.filter(a => a.zoneId === selectedZone.id) : [];
  const points = selectedArea ? allPoints.filter(p => p.areaId === selectedArea.id) : [];

  // Reset handlers
  const resetToTop = () => {
    setSelectedRegion(null);
    setSelectedZone(null);
    setSelectedArea(null);
  };

  const resetToRegion = () => {
    setSelectedZone(null);
    setSelectedArea(null);
  };

  const resetToZone = () => {
    setSelectedArea(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header / Breadcrumbs */}
      <div className="bg-white border-b border-gray-200 sticky top-[72px] z-10 shadow-sm">
        <div className="max-w-[1000px] mx-auto px-4 py-4 flex items-center justify-between relative">
          <div className="flex items-center gap-2 text-sm font-bold overflow-x-auto whitespace-nowrap scrollbar-hide flex-1 mr-2">
            <button
              onClick={resetToTop}
              className={clsx("hover:text-ocean transition-colors", !selectedRegion ? "text-gray-900" : "text-gray-500")}
            >
              エリア選択
            </button>

            {selectedRegion && (
              <>
                <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                <button
                  onClick={resetToRegion}
                  className={clsx("hover:text-ocean transition-colors", !selectedZone ? "text-gray-900" : "text-gray-500")}
                >
                  {selectedRegion.name}
                </button>
              </>
            )}

            {selectedZone && (
              <>
                <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                <button
                  onClick={resetToZone}
                  className={clsx("hover:text-ocean transition-colors", !selectedArea ? "text-gray-900" : "text-gray-500")}
                >
                  {selectedZone.name}
                </button>
              </>
            )}

            {selectedArea && (
              <>
                <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                <span className="text-gray-900">
                  {selectedArea.name}
                </span>
              </>
            )}
          </div>

          <div className="hidden md:block">
            <Link to="/add-point" className="text-sm bg-gray-50 text-ocean-600 border border-gray-200 px-3 py-1.5 rounded-full font-bold hover:bg-gray-100 transition-colors flex items-center gap-1">
              <MapPin size={14} /> ポイント登録
            </Link>
          </div>
        </div>

        {/* Mobile FAB */}
        <Link to="/add-point" className="md:hidden absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-gray-50 text-ocean-600 border border-gray-200 rounded-full shadow-sm">
          <MapPin size={20} />
        </Link>
      </div>

      <div className="max-w-[1000px] mx-auto px-4 py-8">
        {/* 1. Region Selection */}
        {!selectedRegion && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-xl font-bold text-deepBlue-900 flex items-center gap-2">
              <GlobeIcon /> 地域から探す
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {regions.map(region => (
                <button
                  key={region.id}
                  onClick={() => setSelectedRegion(region)}
                  className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all text-left group"
                >
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-ocean transition-colors">{region.name}</h3>
                    <ArrowRight size={20} className="text-gray-300 group-hover:text-ocean transition-colors" />
                  </div>
                  <p className="text-sm text-gray-500">{region.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 2. Zone Selection */}
        {selectedRegion && !selectedZone && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-xl font-bold text-deepBlue-900 flex items-center gap-2">
              <MapPin size={24} className="text-ocean" /> エリアを選択
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {zones.map(zone => (
                <button
                  key={zone.id}
                  onClick={() => setSelectedZone(zone)}
                  className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all text-left group"
                >
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-ocean transition-colors">{zone.name}</h3>
                    <ArrowRight size={20} className="text-gray-300 group-hover:text-ocean transition-colors" />
                  </div>
                  <p className="text-sm text-gray-500">{zone.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3. Area Selection */}
        {selectedZone && !selectedArea && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-xl font-bold text-deepBlue-900 flex items-center gap-2">
              <MapPin size={24} className="text-ocean" /> 詳細エリアを選択
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {areas.map(area => (
                <button
                  key={area.id}
                  onClick={() => setSelectedArea(area)}
                  className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all text-center group"
                >
                  <h3 className="font-bold text-gray-900 group-hover:text-ocean transition-colors mb-1">{area.name}</h3>
                  <div className="text-xs text-gray-400">
                    {allPoints.filter(p => p.areaId === area.id).length} ポイント
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 4. Point List */}
        {selectedArea && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-xl font-bold text-deepBlue-900 flex items-center gap-2">
              <Anchor size={24} className="text-ocean" /> {selectedArea.name}のポイント ({points.length})
            </h2>

            {points.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400">
                登録されているポイントはありません
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {points.map(point => (
                  <Link
                    key={point.id}
                    to={`/point/${point.id}`}
                    className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-all group flex flex-col md:flex-row"
                  >
                    {/* Image */}
                    <div className="w-full md:w-48 h-48 md:h-auto relative overflow-hidden bg-gray-100 flex items-center justify-center shrink-0">
                      {(point.imageUrl && !point.imageUrl.includes('loremflickr') && point.imageUrl.match(/\((https?:\/\/.*?)\)/)?.[1]) || (point.imageUrl && !point.imageUrl.includes('loremflickr')) ? (
                        <img
                          src={(point.imageUrl.match(/\((https?:\/\/.*?)\)/)?.[1]) || point.imageUrl}
                          alt={point.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      ) : (
                        <div className="text-gray-300 flex flex-col items-center gap-2">
                          <ImageIcon size={32} />
                          {/* <span className="text-[10px] uppercase font-bold tracking-widest">No Image</span> */}
                        </div>
                      )}
                      <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded">
                        {point.level}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-xl font-bold text-deepBlue-900 group-hover:text-ocean transition-colors">
                            {point.name}
                          </h3>
                          <button
                            onClick={(e) => {
                              e.preventDefault(); // Prevent navigation
                              toggleBookmarkPoint(point.id);
                            }}
                            className="p-2 -mr-2 text-gray-400 hover:text-yellow-500 transition-colors"
                          >
                            <Bookmark
                              size={20}
                              className={clsx(currentUser.bookmarkedPointIds.includes(point.id) && "fill-yellow-400 text-yellow-400")}
                            />
                          </button>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                          {point.description}
                        </p>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-2 mb-4">
                          {point.features.map(feature => (
                            <span key={feature} className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                              #{feature}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-6 text-sm text-gray-500 border-t border-gray-100 pt-4">
                        <div className="flex items-center gap-1">
                          <Droplets size={16} className="text-blue-400" />
                          <span>Max {point.maxDepth}m</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Wind size={16} className="text-cyan-400" />
                          <span>{point.current === 'none' ? '流れなし' : point.current === 'weak' ? '流れ弱' : point.current === 'strong' ? '激流' : 'ドリフト'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Mountain size={16} className="text-gray-400" />
                          <span>{point.topography[0]}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))
                }
              </div >
            )}
          </div >
        )}
      </div >
    </div >
  );
};

const GlobeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ocean">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);
