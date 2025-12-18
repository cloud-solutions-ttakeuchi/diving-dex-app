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

    // 1. Find relationships for this point (approved, pending, deletion_requested)
    const links = pointCreatures.filter(pc => pc.pointId === point.id && pc.status !== undefined); // All relevant links

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
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header with Large Image */}
      <div className="relative h-[40vh] min-h-[300px]">
        <ImageWithFallback
          src={point.imageUrl}
          alt={point.name}
          type="point"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        <div className="absolute top-0 left-0 p-6">
          <Link to="/points" className="inline-flex items-center gap-2 text-white/90 hover:text-white transition-colors bg-black/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-bold">
            <ArrowLeft size={16} /> ポイント一覧に戻る
          </Link>
          {isAuthenticated && (
            <Link to={`/edit-point/${point.id}`} className="ml-2 inline-flex items-center gap-2 text-white/90 hover:text-white transition-colors bg-black/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-bold">
              編集
            </Link>
          )}
        </div>

        <div className="absolute top-0 right-0 p-6">
          <button
            onClick={() => {
              toggleBookmarkPoint(point.id);
            }}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-full font-bold shadow-lg transition-all transform hover:scale-105",
              currentUser.bookmarkedPointIds.includes(point.id)
                ? "bg-white text-yellow-500"
                : "bg-black/30 backdrop-blur-md text-white border border-white/30 hover:bg-black/40"
            )}
          >
            <Bookmark size={20} className={clsx(currentUser.bookmarkedPointIds.includes(point.id) && "fill-current")} />
            {currentUser.bookmarkedPointIds.includes(point.id) ? '保存済み' : '保存する'}
          </button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 text-white max-w-[1200px] mx-auto">
          <div className="flex items-center gap-2 text-sm font-bold opacity-90 mb-3 text-cyan-300">
            <MapPin size={16} />
            <Link to={`/points?region=${encodeURIComponent(point.region)}`} className="hover:underline hover:text-white transition-colors">
              {point.region}
            </Link>
            &gt;
            <Link to={`/points?region=${encodeURIComponent(point.region)}&zone=${encodeURIComponent(point.zone)}`} className="hover:underline hover:text-white transition-colors">
              {point.zone}
            </Link>
            &gt;
            <Link to={`/points?region=${encodeURIComponent(point.region)}&zone=${encodeURIComponent(point.zone)}&area=${encodeURIComponent(point.area)}`} className="hover:underline hover:text-white transition-colors">
              {point.area}
            </Link>
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold mb-4 tracking-tight shadow-sm">{point.name}</h1>
          <div className="flex flex-wrap gap-2">
            <span className={clsx(
              "px-3 py-1 rounded-full text-sm font-bold backdrop-blur-md",
              point.level === 'Beginner' ? "bg-green-500/80 text-white" :
                point.level === 'Intermediate' ? "bg-blue-500/80 text-white" :
                  "bg-red-500/80 text-white"
            )}>
              {point.level}
            </span>
            {point.features.map(f => (
              <span key={f} className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-sm font-bold border border-white/30">
                #{f}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Main Info & Inhabitants */}
        <div className="md:col-span-2 space-y-8">

          {/* Point Specs */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-deepBlue-900 mb-6 flex items-center gap-2">
              <Anchor className="text-ocean" /> ポイント詳細
            </h2>
            <p className="text-gray-600 leading-relaxed mb-8 text-lg">
              {point.description}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <SpecItem icon={<Droplets />} label="最大水深" value={`${point.maxDepth}m`} />
              <SpecItem icon={<Wind />} label="流れ" value={point.current} />
              <SpecItem icon={<Mountain />} label="地形" value={point.topography[0]} />
              <SpecItem icon={<Anchor />} label="エントリー" value={point.entryType} />
            </div>
          </section>

          {/* Inhabitants List (UGC Section) */}
          <section>
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-2xl font-bold text-deepBlue-900 flex items-center gap-2">
                  <span>🐠</span> 生物図鑑
                </h2>
                <p className="text-sm text-gray-500 mt-1">このポイントで見られる生物 ({inhabitants.length})</p>
              </div>
            </div>
            {/* Creature Grid - Unified */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="aspect-square bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-ocean-500 rounded-3xl border-2 border-dashed border-gray-200 hover:border-ocean-300 transition-all duration-300 flex flex-col items-center justify-center gap-3 group"
              >
                <div className="p-3 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform">
                  <Plus size={24} />
                </div>
                <span className="font-bold text-sm">発見した生物を追加</span>
              </button>

              {inhabitants.map(creature => {
                return (
                  <Link
                    key={creature.id}
                    to={`/creature/${creature.id}`}
                    className="group relative aspect-square rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1"
                  >
                    <ImageWithFallback
                      src={creature.imageUrl}
                      alt={creature.name}
                      type="creature"
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-deepBlue-900 via-transparent to-transparent opacity-90" />

                    {/* Delete Button (Top Left) - Only for Approved items */}
                    {isAuthenticated && creature._status === 'approved' && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          if (window.confirm('この生物の関連付けを削除（または削除申請）しますか？')) {
                            removePointCreature(point.id, creature.id);
                          }
                        }}
                        className="absolute top-2 left-2 p-1.5 bg-black/40 hover:bg-red-500/80 rounded-full text-white/70 hover:text-white transition-colors z-20 backdrop-blur-sm"
                      >
                        <X size={14} />
                      </button>
                    )}

                    {/* Rarity Badge (Local Rarity) */}
                    <div className={clsx(
                      "absolute top-2 right-2 px-3 py-1 rounded-full text-xs font-bold shadow-sm z-10",
                      creature.rarity === 'Common' ? "bg-gray-100 text-gray-600 border border-gray-200" :
                        creature.rarity === 'Rare' ? "bg-blue-100 text-blue-700 border border-blue-200" :
                          creature.rarity === 'Epic' ? "bg-orange-100 text-orange-700 border border-orange-200" :
                            "bg-purple-100 text-purple-700 border border-purple-200"
                    )}>
                      {creature.rarity}
                    </div>


                    {/* Status Badge */}
                    {creature._status === 'pending' && (
                      <div className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg z-30">
                        <AlertCircle size={12} /> 追加申請中
                      </div>
                    )}
                    {creature._status === 'deletion_requested' && (
                      <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg z-30">
                        <X size={12} /> 削除申請中
                      </div>
                    )}

                    <div className={clsx("absolute bottom-0 left-0 right-0 p-3 translate-y-2 group-hover:translate-y-0 transition-transform duration-300",
                      creature._status === 'deletion_requested' && "opacity-50"
                    )}>
                      <h3 className="font-bold text-white text-lg leading-tight drop-shadow-md mb-1 truncate">{creature.name}</h3>
                      <div className="flex gap-0.5">
                        {Array.from({ length: 4 }).map((_, i) => {
                          const rarityLevel = creature.rarity === 'Legendary' ? 4 :
                            creature.rarity === 'Epic' ? 3 :
                              creature.rarity === 'Rare' ? 2 : 1;
                          const isActive = i < rarityLevel;
                          return (
                            <Star
                              key={i}
                              size={12}
                              className={isActive ? "text-yellow-400 fill-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.8)]" : "text-white/20"}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right Column: Sidebar */}
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 sticky top-24">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
              <MapPin size={18} className="text-ocean" /> アクセス・地図
            </h3>

            <div className="aspect-video bg-gray-100 rounded-xl overflow-hidden relative group">
              {point.coordinates ? (
                isLoaded ? (
                  <GoogleMap
                    mapContainerStyle={{ width: '100%', height: '100%' }}
                    center={point.coordinates}
                    zoom={14}
                    options={{
                      disableDefaultUI: true,
                      gestureHandling: 'cooperative',
                      streetViewControl: false,
                      mapTypeControl: false
                    }}
                  >
                    <Marker position={point.coordinates} />
                  </GoogleMap>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">Loading Map...</div>
                )
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                  <MapPin size={32} className="mb-2 text-gray-300" />
                  <span className="text-xs font-bold">位置情報なし</span>
                </div>
              )}
            </div>

            <div className="text-sm text-gray-600 space-y-4 mt-4">
              <div>
                <p className="font-bold text-gray-900 mb-1">所在地</p>
                <p>{point.formattedAddress || `${point.region} ${point.zone} ${point.area}`}</p>
              </div>
              <div>
                <p className="font-bold text-gray-900 mb-1">アクセス</p>
                <p>車でのアクセスが便利です。近くにダイビングショップ「{point.area}ダイバーズ」があります。</p>
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
                className="block w-full mt-6 bg-gray-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-gray-800 transition-colors text-center"
              >
                Google Mapで開く
              </a>
            )}
          </div>
        </div>
      </div >

      {/* Add Creature Modal - Pass calculated inhabitants ids */}
      {isAddModalOpen && (
        <AddCreatureModal
          pointId={point.id}
          currentCreatureIds={inhabitants.map(c => c.id)}
          onClose={() => setIsAddModalOpen(false)}
          onAdd={() => { }}
        />
      )}
    </div >
  );
};

const SpecItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
  <div className="bg-gray-50 p-4 rounded-xl flex flex-col items-center text-center">
    <div className="text-gray-400 mb-2 [&>svg]:w-5 [&>svg]:h-5">{icon}</div>
    <div className="text-xs text-gray-500 font-bold mb-1">{label}</div>
    <div className="text-sm font-extrabold text-gray-900 capitalize">{value}</div>
  </div>
);

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
