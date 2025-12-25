import { useState, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ImageWithFallback } from '../components/common/ImageWithFallback';
import { MapPin, Droplets, Wind, Mountain, ArrowLeft, Plus, Search, X, Check, Anchor, AlertCircle, Bookmark, Star } from 'lucide-react';
import clsx from 'clsx';
import type { Creature, Rarity } from '../types';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';

const libraries: ("places" | "geometry")[] = ["places"];

export const PointDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  // Use pointCreatures from context
  const { points, creatures, pointCreatures, currentUser, toggleBookmarkPoint, isAuthenticated, removePointCreature } = useApp();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY || '';
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
    libraries,
    language: 'ja'
  });

  const point = points.find(p => p.id === id);

  // Inhabitants Logic (Updated for PointCreature model)
  const inhabitants = useMemo(() => {
    if (!point) return [];

    // 1. Find relationships for this point (approved, pending, deletion_requested) - Exclude rejected
    const links = pointCreatures.filter(pc => pc.pointId === point.id && pc.status !== undefined && pc.status !== 'rejected'); // All relevant links

    // 2. Map to Creature objects with overridden Local Rarity and Status
    const validCreatures = links.map(link => {
      const creature = creatures.find(c => c.id === link.creatureId);
      if (!creature) return null;
      return {
        ...creature,
        rarity: link.localRarity,
        // Helper prop for UI
        _status: link.status as 'approved' | 'pending' | 'deletion_requested'
      };
    }).filter((c): c is Creature & { _status: 'approved' | 'pending' | 'deletion_requested' } => c !== null);

    // Deduplicate by creature ID (in case of data inconsistency)
    const uniqueMap = new Map();
    validCreatures.forEach(c => {
      if (!uniqueMap.has(c.id)) {
        uniqueMap.set(c.id, c);
      }
    });
    return Array.from(uniqueMap.values());

  }, [point, creatures, pointCreatures]);

  if (!point) {
    return <div className="p-8 text-center">Point not found</div>;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 selection:bg-cyan-100 selection:text-cyan-900">
      {/* Header with Large Image */}
      <div className="relative h-[45vh] min-h-[400px] overflow-hidden">
        <ImageWithFallback
          src={point.imageUrl}
          alt={point.name}
          type="point"
          className="w-full h-full object-cover scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A] via-[#0F172A]/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0F172A]/60 via-transparent to-transparent hidden md:block" />

        <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-20">
          <div className="flex items-center gap-3">
            <Link to="/points" className="group flex items-center gap-2 text-white/90 hover:text-white transition-all bg-white/10 backdrop-blur-md px-5 py-2.5 rounded-full text-sm font-bold border border-white/20 hover:bg-white/20 shadow-xl">
              <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-1" /> ポイント一覧
            </Link>
            {isAuthenticated && (
              <Link to={`/edit-point/${point.id}`} className="flex items-center gap-2 text-white/90 hover:text-white transition-all bg-sky-500/20 backdrop-blur-md px-5 py-2.5 rounded-full text-sm font-bold border border-sky-400/30 hover:bg-sky-500/40 shadow-xl">
                編集
              </Link>
            )}
          </div>

          <button
            onClick={() => toggleBookmarkPoint(point.id)}
            className={clsx(
              "flex items-center gap-2 px-6 py-2.5 rounded-full font-bold shadow-2xl transition-all transform hover:scale-105 active:scale-95 border",
              currentUser.bookmarkedPointIds.includes(point.id)
                ? "bg-white text-amber-500 border-white"
                : "bg-white/10 backdrop-blur-md text-white border-white/30 hover:bg-white/20"
            )}
          >
            <Bookmark size={20} className={clsx(currentUser.bookmarkedPointIds.includes(point.id) && "fill-current")} />
            <span className="hidden sm:inline">{currentUser.bookmarkedPointIds.includes(point.id) ? '保存済み' : '保存する'}</span>
          </button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-8 md:p-16 text-white max-w-[1400px] mx-auto z-10">
          <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm font-bold mb-4 bg-white/5 backdrop-blur-sm w-fit px-4 py-2 rounded-full border border-white/10">
            <MapPin size={14} className="text-cyan-400" />
            <Link to={`/points?region=${encodeURIComponent(point.region)}`} className="text-cyan-300 hover:text-white transition-colors">{point.region}</Link>
            <span className="text-white/30">/</span>
            <Link to={`/points?region=${encodeURIComponent(point.region)}&zone=${encodeURIComponent(point.zone)}`} className="text-cyan-300 hover:text-white transition-colors">{point.zone}</Link>
            <span className="text-white/30">/</span>
            <span className="opacity-80">{point.area}</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tighter leading-tight drop-shadow-2xl">
            {point.name}
          </h1>

          <div className="flex flex-wrap gap-3 items-center">
            <div className={clsx(
              "px-5 py-2 rounded-xl text-xs md:text-sm font-black tracking-wider uppercase shadow-lg backdrop-blur-md border",
              point.level === 'Beginner' ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" :
                point.level === 'Intermediate' ? "bg-sky-500/20 text-sky-300 border-sky-500/30" :
                  "bg-rose-500/20 text-rose-300 border-rose-500/30"
            )}>
              {point.level}
            </div>
            {point.features.map(f => (
              <span key={f} className="bg-white/5 backdrop-blur-md px-4 py-2 rounded-xl text-xs md:text-sm font-bold border border-white/10 hover:bg-white/10 transition-colors cursor-default">
                #{f}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Main Content */}
          <div className="lg:col-span-8 space-y-12">

            {/* Description & Specs */}
            <section className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden group">
              <div className="p-8 md:p-10">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-12 h-12 bg-sky-50 rounded-2xl flex items-center justify-center text-sky-500 group-hover:scale-110 transition-transform duration-500">
                    <Anchor size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">ポイントの概要</h2>
                    <div className="h-1 w-12 bg-sky-500 rounded-full mt-1" />
                  </div>
                </div>

                <p className="text-slate-600 leading-relaxed mb-10 text-lg md:text-xl font-medium">
                  {point.description}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                  <SpecItem icon={<Droplets />} label="最大水深" value={`${point.maxDepth}m`} color="sky" />
                  <SpecItem icon={<Wind />} label="流れ" value={point.current} color="indigo" />
                  <SpecItem icon={<Mountain />} label="地形" value={point.topography[0]} color="emerald" />
                  <SpecItem icon={<MapPin />} label="ポイント種別" value={point.entryType} color="rose" />
                </div>
              </div>
            </section>

            {/* Inhabitants List */}
            <section>
              <div className="flex justify-between items-end mb-8 px-2">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-3xl">🐠</span>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">生物図鑑</h2>
                  </div>
                  <p className="text-slate-500 font-bold flex items-center gap-2">
                    発見報告一覧 <span className="w-1.5 h-1.5 rounded-full bg-slate-300" /> <span className="text-sky-500">{inhabitants.length}件</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="aspect-square bg-white hover:bg-sky-50 text-slate-400 hover:text-sky-500 rounded-[2rem] border-4 border-dashed border-slate-100 hover:border-sky-200 transition-all duration-500 flex flex-col items-center justify-center gap-4 group shadow-sm hover:shadow-xl hover:-translate-y-2 active:scale-95"
                >
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform group-hover:bg-white shadow-inner">
                    <Plus size={32} />
                  </div>
                  <span className="font-black text-sm tracking-tighter">新しく生物を追加</span>
                </button>

                {inhabitants.map(creature => (
                  <Link
                    key={creature.id}
                    to={`/creature/${creature.id}`}
                    className="group relative aspect-square rounded-[2rem] overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 ring-1 ring-slate-100"
                  >
                    <ImageWithFallback
                      src={creature.imageUrl}
                      alt={creature.name}
                      type="creature"
                      className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A] via-transparent to-transparent opacity-80" />

                    {/* Rarity & Status Badges */}
                    <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-20">
                      <div className="flex gap-1.5">
                        {creature._status === 'pending' && (
                          <div className="bg-amber-400 text-amber-950 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-lg backdrop-blur-md">
                            <AlertCircle size={10} /> Pending
                          </div>
                        )}
                        {creature._status === 'deletion_requested' && (
                          <div className="bg-rose-500 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-lg backdrop-blur-md">
                            <X size={10} /> Deleting
                          </div>
                        )}
                      </div>

                      <div className={clsx(
                        "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg backdrop-blur-md border",
                        creature.rarity === 'Common' ? "bg-slate-100/80 text-slate-600 border-slate-200" :
                          creature.rarity === 'Rare' ? "bg-sky-500/20 text-sky-400 border-sky-400/30" :
                            creature.rarity === 'Epic' ? "bg-amber-500/20 text-amber-400 border-amber-400/30" :
                              "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-400/30"
                      )}>
                        {creature.rarity}
                      </div>
                    </div>

                    {/* Bottom Content */}
                    <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
                      <h3 className="font-black text-white text-xl leading-tight mb-2 truncate group-hover:text-sky-300 transition-colors drop-shadow-lg">
                        {creature.name}
                      </h3>
                      <div className="flex gap-1">
                        {Array.from({ length: 4 }).map((_, i) => {
                          const rarityLevel = creature.rarity === 'Legendary' ? 4 :
                            creature.rarity === 'Epic' ? 3 :
                              creature.rarity === 'Rare' ? 2 : 1;
                          const isActive = i < rarityLevel;
                          return (
                            <Star
                              key={i}
                              size={14}
                              className={clsx(
                                "transition-all duration-500",
                                isActive
                                  ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)] scale-110"
                                  : "text-white/20"
                              )}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Admin Delete Action */}
                    {isAuthenticated && creature._status === 'approved' && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          if (window.confirm('この生物の報告を削除しますか？')) {
                            removePointCreature(point.id, creature.id);
                          }
                        }}
                        className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-rose-500 text-white/0 hover:text-white rounded-full transition-all duration-300 backdrop-blur-sm z-30 opacity-0 group-hover:opacity-100"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-white p-2 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 sticky top-28 group">
              <div className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center text-rose-500 group-hover:rotate-12 transition-transform duration-500">
                    <MapPin size={20} />
                  </div>
                  <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">Access & Map</h3>
                </div>

                <div className="aspect-video bg-slate-100 rounded-[2rem] overflow-hidden relative mb-8 shadow-inner border border-slate-100">
                  {point.coordinates ? (
                    isLoaded ? (
                      <GoogleMap
                        mapContainerStyle={{ width: '100%', height: '100%' }}
                        center={point.coordinates}
                        zoom={14}
                        options={{
                          disableDefaultUI: true,
                          gestureHandling: 'cooperative',
                          styles: [
                            { featureType: 'poi', stylers: [{ visibility: 'off' }] },
                            { featureType: 'transit', stylers: [{ visibility: 'off' }] }
                          ]
                        }}
                      >
                        <Marker position={point.coordinates} />
                      </GoogleMap>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs animate-pulse">Loading Map...</div>
                    )
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                      <MapPin size={48} className="mb-4 opacity-20" />
                      <span className="text-sm font-black uppercase tracking-widest opacity-40">No Location Data</span>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100/50">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">所在地</p>
                    <p className="text-slate-900 font-bold leading-relaxed">
                      {point.formattedAddress || `${point.region} ${point.zone} ${point.area}`}
                    </p>
                  </div>

                  <div className="bg-sky-50 p-6 rounded-2xl border border-sky-100 animate-fade-in">
                    <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest mb-1">アクセスヒント</p>
                    <p className="text-sky-900 font-bold text-sm leading-relaxed">
                      {point.area}エリアの主要ダイビングショップからボートまたはビーチでエントリー可能です。
                    </p>
                  </div>
                </div>

                {point.coordinates && (
                  <a
                    href={point.googlePlaceId
                      ? `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${point.googlePlaceId}`
                      : `https://www.google.com/maps/search/?api=1&query=${point.coordinates.lat},${point.coordinates.lng}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="group relative flex items-center justify-center gap-3 w-full mt-8 bg-slate-900 text-white h-14 rounded-2xl font-black text-sm transition-all hover:bg-black hover:shadow-2xl hover:-translate-y-1 active:scale-95 overflow-hidden"
                  >
                    <Search size={18} className="transition-transform group-hover:scale-125" />
                    <span>Open in Google Maps</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {isAddModalOpen && (
        <AddCreatureModal
          pointId={point.id}
          currentCreatureIds={inhabitants.map(c => c.id)}
          onClose={() => setIsAddModalOpen(false)}
          onAdd={() => { }}
        />
      )}
    </div>
  );
};

const SpecItem = ({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: string, color: string }) => {
  const colors: Record<string, string> = {
    sky: "bg-sky-50 text-sky-500 border-sky-100",
    indigo: "bg-indigo-50 text-indigo-500 border-indigo-100",
    emerald: "bg-emerald-50 text-emerald-500 border-emerald-100",
    rose: "bg-rose-50 text-rose-500 border-rose-100"
  };

  return (
    <div className="bg-white p-6 rounded-[1.5rem] flex flex-col items-center text-center border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
      <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center mb-4 border transition-transform duration-500 hover:rotate-6", colors[color])}>
        {icon}
      </div>
      <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">{label}</div>
      <div className="text-sm md:text-base font-black text-slate-900 capitalize leading-tight">
        {value === 'none' ? 'なし' : value === 'weak' ? '弱い' : value === 'strong' ? '強い' : value === 'drift' ? 'ドリフト' : value}
      </div>
    </div>
  );
};

// Add Creature Modal Component
const AddCreatureModal = ({
  pointId,
  currentCreatureIds,
  onClose,
  onAdd
}: {
  pointId: string,
  currentCreatureIds: string[],
  onClose: () => void,
  onAdd: (id: string, rarity: Rarity) => void
}) => {
  const { creatures, points, currentUser, addPointCreature } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const [selectedRarity, setSelectedRarity] = useState<Rarity>('Common');
  // State to track which creature is being added (for expanding rarity selector)
  const [targetCreatureId, setTargetCreatureId] = useState<string | null>(null);

  useEffect(() => {
    console.log("AddCreatureModal MOUNTED");
    return () => console.log("AddCreatureModal UNMOUNTED");
  }, []);

  console.log("AddCreatureModal Render: target=", targetCreatureId);

  const filteredCreatures = useMemo(() => {
    if (!searchTerm) return [];
    return creatures
      .filter(c =>
        // Filter out creatures already in the point
        !currentCreatureIds.includes(c.id) &&
        (c.name.includes(searchTerm) || c.tags.some(t => t.includes(searchTerm)))
      )
      .slice(0, 20);
  }, [searchTerm, creatures, currentCreatureIds]);

  const handleAdd = async (creatureId: string) => {
    // If rarity not selected yet (or minimal flow), we could default or ask.
    // Here we use the separate "Confirm" flow if targetCreatureId is set.
    if (targetCreatureId !== creatureId) {
      setTargetCreatureId(creatureId);
      return;
    }

    const point = points.find(p => p.id === pointId);
    if (!point || currentCreatureIds.includes(creatureId)) return;

    // Optimistic UI update (show as pending immediately)
    setAddedIds(prev => [...prev, creatureId]);
    onAdd(creatureId, selectedRarity);

    try {
      if (currentUser.role === 'admin' || currentUser.role === 'moderator') {
        // Direct Create
        await addPointCreature(pointId, creatureId, selectedRarity);
        alert('生物を追加しました！');
      } else {
        // Proposal Flow
        await addPointCreature(pointId, creatureId, selectedRarity);
        alert('追加申請を送信しました');
      }
      setTargetCreatureId(null); // Reset
    } catch (e) {
      console.error(e);
      alert('エラーが発生しました');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h3 className="text-lg font-bold text-gray-900">生物の発見報告</h3>
            <p className="text-xs text-gray-500">このポイントで見つけた生物を追加します</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-ocean" />
            <input
              type="text"
              placeholder="生物名で検索 (例: クマノミ)..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-100 border-2 border-transparent focus:bg-white focus:border-ocean rounded-xl focus:outline-none transition-all font-bold text-gray-900 placeholder-gray-400"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 bg-gray-50/30">
          {!searchTerm ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <Search size={48} className="mb-4 opacity-20" />
              <p className="font-bold">生物名を入力して検索</p>
            </div>
          ) : filteredCreatures.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <p className="font-bold">見つかりませんでした</p>
              <p className="text-sm mt-1">別のキーワードで試してください</p>
            </div>
          ) : (
            <div className="space-y-2 p-2">
              {filteredCreatures.map(creature => {
                const isJustAdded = addedIds.includes(creature.id);
                const isTarget = targetCreatureId === creature.id;

                return (
                  <div key={creature.id} className={clsx(
                    "rounded-xl transition-all border overflow-hidden",
                    isTarget ? "bg-white border-ocean shadow-md" : "bg-white border-gray-100 hover:border-ocean hover:shadow-md",
                    isJustAdded && "opacity-70 bg-gray-50"
                  )}>
                    <button
                      onClick={() => !isJustAdded && handleAdd(creature.id)}
                      disabled={isJustAdded}
                      className="w-full flex items-center gap-3 p-3 text-left"
                    >
                      <ImageWithFallback src={creature.imageUrl} alt={creature.name} type="creature" className="w-12 h-12 rounded-lg object-cover bg-gray-200" />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-gray-900 truncate">{creature.name}</div>
                        <div className="text-xs text-gray-500 truncate">{creature.category}</div>
                      </div>

                      {isJustAdded ? (
                        <div className="flex items-center gap-1 text-green-600 text-xs font-bold bg-white px-3 py-1.5 rounded-full shadow-sm border border-green-100">
                          <Check size={12} /> 追加済
                        </div>
                      ) : (
                        <div className={clsx(
                          "w-8 h-8 flex items-center justify-center rounded-full transition-colors",
                          isTarget ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-400 group-hover:bg-blue-600 group-hover:text-white"
                        )}>
                          {isTarget ? <Check size={16} /> : <Plus size={16} />}
                        </div>
                      )}
                    </button>

                    {/* Rarity Selector (Expanded) */}
                    {isTarget && !isJustAdded && (
                      <div className="px-3 pb-3 pt-0 animate-fade-in-down">
                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                          <label className="text-xs font-bold text-gray-500 mb-2 block">このポイントでのレア度を選択:</label>
                          <div className="flex gap-1 overflow-x-auto pb-1">
                            {(['Common', 'Rare', 'Epic', 'Legendary'] as Rarity[]).map((r) => (
                              <button
                                key={r}
                                onClick={(e) => { e.stopPropagation(); setSelectedRarity(r); }}
                                className={clsx(
                                  "flex-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all whitespace-nowrap",
                                  selectedRarity === r
                                    ? r === 'Common' ? "bg-gray-100 border-gray-400 text-gray-700" :
                                      r === 'Rare' ? "bg-blue-100 border-blue-400 text-blue-700" :
                                        r === 'Epic' ? "bg-orange-100 border-orange-400 text-orange-700" :
                                          "bg-purple-100 border-purple-400 text-purple-700"
                                    : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                                )}
                              >
                                {r}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleAdd(creature.id); }}
                            className="w-full mt-3 bg-blue-600 text-white font-bold py-2 rounded-lg text-sm shadow-sm hover:shadow-md transition-all"
                          >
                            確定
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 bg-white flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
