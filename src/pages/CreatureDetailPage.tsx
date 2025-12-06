import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
// Duplicate import removed
import { Heart, Fish, ChevronLeft, ChevronRight, X, Camera, Bookmark, Star } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { Log } from '../types';

export const CreatureDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  // Remove db, use state directly
  const { creatures, points, currentUser, isAuthenticated, addLog, toggleFavorite, toggleWanted } = useApp();
  // const { t } = useLanguage();
  const [isLogging, setIsLogging] = useState(false);
  const [selectedSpotId, setSelectedSpotId] = useState<string>('');
  const [comment, setComment] = useState('');

  const creature = creatures.find(c => c.id === id);
  if (!creature) return <div className="text-center mt-20">Not Found</div>;

  // Find previous and next creatures for navigation
  const allCreatures = creatures;
  const currentIndex = allCreatures.findIndex(c => c.id === creature.id);
  const prevCreature = currentIndex > 0 ? allCreatures[currentIndex - 1] : null;
  const nextCreature = currentIndex < allCreatures.length - 1 ? allCreatures[currentIndex + 1] : null;

  const handleSaveLog = () => {
    if (selectedSpotId) {
      const selectedPoint = points.find(p => p.id === selectedSpotId);
      const logData: Omit<Log, 'id' | 'userId'> = {
        date: new Date().toISOString().split('T')[0],
        diveNumber: (currentUser.logs.length || 0) + 1,
        location: {
          pointId: selectedSpotId,
          pointName: selectedPoint?.name || 'Unknown',
          region: selectedPoint?.region || 'Unknown',
        },
        time: { duration: 0 }, // Placeholder
        depth: { max: 0, average: 0 }, // Placeholder
        photos: [],
        comment: comment,
        isPrivate: false,
        creatureId: creature.id,
        sightedCreatures: [],
        spotId: selectedSpotId, // Legacy
        likeCount: 0,
        likedBy: [],
      };

      addLog(logData);
      setIsLogging(false);
      setComment('');
      setSelectedSpotId('');
      alert('Log saved!');
    }
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Navigation Arrows (Fixed) - Zukan Style */}
      {prevCreature && (
        <Link
          to={`/creature/${prevCreature.id}`}
          className="fixed left-4 top-1/2 -translate-y-1/2 z-30 group hidden md:block"
        >
          <div className="bg-white text-gray-300 group-hover:text-gray-900 w-16 h-24 flex items-center justify-center rounded-l-lg shadow-sm border border-gray-200 transition-all -ml-2 group-hover:ml-0">
            <ChevronLeft size={40} strokeWidth={3} />
          </div>
          <div className="absolute left-full top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs font-bold px-3 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap ml-2 pointer-events-none">
            No.{prevCreature.id} {prevCreature.name}
          </div>
        </Link>
      )}
      {nextCreature && (
        <Link
          to={`/creature/${nextCreature.id}`}
          className="fixed right-4 top-1/2 -translate-y-1/2 z-30 group hidden md:block"
        >
          <div className="bg-white text-gray-300 group-hover:text-gray-900 w-16 h-24 flex items-center justify-center rounded-r-lg shadow-sm border border-gray-200 transition-all -mr-2 group-hover:mr-0">
            <ChevronRight size={40} strokeWidth={3} />
          </div>
          <div className="absolute right-full top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs font-bold px-3 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap mr-2 pointer-events-none">
            No.{nextCreature.id} {nextCreature.name}
          </div>
        </Link>
      )}

      {/* Main Content Container - Panel Layout */}
      <div className="max-w-[1000px] mx-auto px-4 pt-8 pb-20">

        {/* Top Section: Image & Name Card */}
        <div className="flex flex-col md:flex-row gap-8 mb-8">

          {/* Image Area (Centered) */}
          <div className="w-full md:w-1/2 flex items-center justify-center relative min-h-[300px]">
            {/* Background Pattern for Image */}
            <div className="absolute inset-0 bg-[radial-gradient(#E9ECEF_2px,transparent_2.5px)] [background-size:20px_20px] opacity-50 rounded-full scale-90"></div>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              src={creature.imageUrl}
              alt={creature.name}
              className="w-full max-w-[350px] h-auto object-contain z-10 drop-shadow-lg"
            />
            {/* Copyright Credit */}
            {(creature.imageCredit || creature.imageLicense) && (
              <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded z-20 pointer-events-none">
                © {creature.imageCredit || 'Unknown'} {creature.imageLicense && `(${creature.imageLicense})`}
              </div>
            )}
          </div>

          {/* Name Card (Top Right) */}
          <div className="w-full md:w-1/2 flex flex-col justify-center">
            <div className="glass-panel rounded-3xl p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <Fish size={120} />
              </div>

              <div className="mb-6 relative z-10">
                <div className="flex items-center gap-3 mb-2">
                  <span className={clsx(
                    "px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm",
                    creature.rarity === 'Legendary' ? 'bg-purple-500' :
                      creature.rarity === 'Epic' ? 'bg-pink-500' :
                        creature.rarity === 'Rare' ? 'bg-blue-500' : 'bg-green-500'
                  )}>
                    {creature.rarity}
                  </span>
                  <span className="text-gray-400 text-sm font-medium tracking-wider uppercase">{creature.category}</span>
                </div>
                <h1 className="text-4xl font-bold text-gray-800 mb-1 tracking-tight">{creature.name}</h1>
                {creature.imageKeyword && (
                  <p className="text-xl text-ocean-500 font-serif italic">{creature.imageKeyword}</p>
                )}
              </div>

              <div className="flex justify-between items-start mb-2 relative z-10 w-full">
                <div className="flex items-center gap-4">
                  <div className="text-sm font-bold text-gray-500">No.{creature.id}</div>
                  {isAuthenticated && (
                    <Link to={`/edit-creature/${creature.id}`} className="text-xs font-bold text-gray-400 hover:text-blue-500 transition-colors border border-gray-200 px-2 py-0.5 rounded-full hover:border-blue-300">
                      編集
                    </Link>
                  )}
                </div>
                {/* Rarity Stars */}
                <div className="flex gap-1">
                  {Array.from({ length: 4 }).map((_, i) => {
                    const rarityLevel = creature.rarity === 'Legendary' ? 4 :
                      creature.rarity === 'Epic' ? 3 :
                        creature.rarity === 'Rare' ? 2 : 1;
                    const isActive = i < rarityLevel;
                    return (
                      <Star
                        key={i}
                        size={16}
                        className={isActive ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}
                      />
                    );
                  })}
                </div>
              </div>

              <h1 className="text-3xl font-black text-gray-900 mb-6">{creature.name}</h1>

              <div className="flex items-center justify-between">
                {/* Gender Symbols (Decoration) */}
                <div className="flex gap-3">
                  <span className="text-blue-500 font-bold text-xl">♂</span>
                  <span className="text-red-500 font-bold text-xl">♀</span>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => toggleFavorite(creature.id)}
                    className={clsx(
                      "p-3 rounded-full shadow-sm border transition-all hover:scale-105 active:scale-95",
                      currentUser.favorites.includes(creature.id)
                        ? "bg-red-50 border-red-100 text-red-500"
                        : "bg-white border-gray-100 text-gray-400 hover:text-red-500 hover:border-red-100"
                    )}
                    title="Add to Favorites"
                  >
                    <Heart size={24} fill={currentUser.favorites.includes(creature.id) ? "currentColor" : "none"} />
                  </button>
                  <button
                    onClick={() => toggleWanted(creature.id)}
                    className={clsx(
                      "p-3 rounded-full shadow-sm border transition-all hover:scale-105 active:scale-95",
                      currentUser.wanted.includes(creature.id)
                        ? "bg-yellow-50 border-yellow-100 text-yellow-500"
                        : "bg-white border-gray-100 text-gray-400 hover:text-yellow-500 hover:border-yellow-100"
                    )}
                    title="Add to Wanted List"
                  >
                    <Bookmark size={24} fill={currentUser.wanted.includes(creature.id) ? "currentColor" : "none"} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Two Columns of Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">

          {/* Left Card: Basic Info */}
          <div className="bg-white rounded-[10px] p-8 shadow-sm border border-gray-200 h-full">
            <div className="space-y-6">
              <div>
                <div className="text-sm font-bold text-gray-500 mb-1">分類</div>
                <div className="text-gray-900 font-bold">{creature.scientificName || '不明'}</div>
              </div>

              <div>
                <div className="text-sm font-bold text-gray-500 mb-2">タイプ・属性</div>
                <div className="flex flex-wrap gap-2">
                  <span className={clsx(
                    "inline-flex items-center justify-center px-3 py-1 rounded text-xs font-bold border",
                    creature.rarity === 'Common' ? "bg-gray-100 text-gray-600 border-gray-200" :
                      creature.rarity === 'Rare' ? "bg-blue-100 text-blue-700 border-blue-200" :
                        creature.rarity === 'Epic' ? "bg-orange-100 text-orange-700 border-orange-200" :
                          "bg-purple-100 text-purple-700 border-purple-200"
                  )}>
                    {creature.rarity}
                  </span>
                  {creature.specialAttributes?.map(attr => (
                    <span key={attr} className="inline-flex items-center justify-center px-3 py-1 rounded bg-gray-100 text-gray-700 text-xs font-bold">
                      {attr}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-bold text-gray-500 mb-1">水深</div>
                  <div className="text-gray-900 font-bold">
                    {creature.depthRange ? `${creature.depthRange.min} - ${creature.depthRange.max} m` : '不明'}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-500 mb-1">水温</div>
                  <div className="text-gray-900 font-bold">
                    {creature.waterTempRange ? `${creature.waterTempRange.min} - ${creature.waterTempRange.max} ℃` : '不明'}
                  </div>
                </div>
              </div>

/* regions removed */
            </div>
          </div>

          {/* Right Card: Stats (Radar Chart) */}
          <div className="bg-white rounded-[10px] p-4 md:p-8 shadow-sm border border-gray-200 h-full flex flex-col items-center justify-center relative">
            <h3 className="absolute top-4 left-6 font-bold text-gray-400 text-sm">パラメーター</h3>
            <div className="w-full h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={[
                  { subject: '人気', A: creature.stats?.popularity || 50, fullMark: 100 },
                  { subject: '大きさ', A: creature.stats?.size || 20, fullMark: 100 },
                  { subject: '危険度', A: creature.stats?.danger || 10, fullMark: 100 },
                  { subject: '寿命', A: creature.stats?.lifespan || 50, fullMark: 100 },
                  { subject: 'レア度', A: creature.stats?.rarity || 20, fullMark: 100 },
                  { subject: '逃げ足', A: creature.stats?.speed || 50, fullMark: 100 },
                ]}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#4b5563', fontSize: 12, fontWeight: 'bold' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar
                    name={creature.name}
                    dataKey="A"
                    stroke={
                      creature.rarity === 'Legendary' ? '#ec4899' : // Rose/Pink
                        creature.rarity === 'Epic' ? '#facc15' :      // Yellow/Gold
                          creature.rarity === 'Rare' ? '#9333ea' :      // Purple
                            '#6b7280'                                     // Gray
                    }
                    fill={
                      creature.rarity === 'Legendary' ? '#ec4899' :
                        creature.rarity === 'Epic' ? '#facc15' :
                          creature.rarity === 'Rare' ? '#9333ea' :
                            '#6b7280'
                    }
                    fillOpacity={0.4}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            {/* Stat Comment */}
            <div className="w-full mt-2 text-center text-sm font-bold text-gray-500">
              {creature.stats && creature.stats.danger > 70 ? (
                <span className="text-red-500 flex items-center justify-center gap-1">
                  ⚠️ 危険度: {creature.stats.danger} (注意が必要です)
                </span>
              ) : creature.stats && creature.stats.popularity > 80 ? (
                <span className="text-pink-500 flex items-center justify-center gap-1">
                  📸 人気者: {creature.stats.popularity} (フォト派に大人気！)
                </span>
              ) : (
                <span className="text-gray-400">バランスの取れた能力値です</span>
              )}
            </div>
          </div>

        </div>

        {/* Description Card */}
        <div className="bg-white rounded-[10px] p-8 shadow-sm border border-gray-200 mb-12">
          <p className="text-gray-700 leading-relaxed font-medium text-center">
            {creature.description}
          </p>
          {/* Pagination Dots */}
          <div className="flex justify-center gap-2 mt-6">
            <div className="w-3 h-3 rounded-full bg-gray-800"></div>
            <div className="w-3 h-3 rounded-full bg-gray-200"></div>
          </div>
        </div>

        {/* Action Button */}
        {isAuthenticated && (
          <div className="flex justify-center">
            <button
              onClick={() => setIsLogging(true)}
              className="bg-red-500 text-white px-12 py-4 rounded-full font-bold hover:bg-red-600 transition-colors shadow-lg flex items-center gap-3 text-lg"
            >
              <Camera size={24} />
              発見報告をする
            </button>
          </div>
        )}

      </div>

      {/* Logging Modal (Same as before but styled) */}
      <AnimatePresence>
        {isLogging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={() => setIsLogging(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => setIsLogging(false)} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                <X size={20} />
              </button>

              <h3 className="text-2xl font-black text-gray-900 mb-6 text-center">Log Sighting</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Location</label>
                  <select
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-900 font-bold"
                    value={selectedSpotId}
                    onChange={(e) => setSelectedSpotId(e.target.value)}
                  >
                    <option value="">Select a spot...</option>
                    {points.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Comment</label>
                  <textarea
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-900 min-h-[120px] resize-none font-medium"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Describe your encounter..."
                  />
                </div>

                <button
                  onClick={handleSaveLog}
                  disabled={!selectedSpotId}
                  className="w-full py-4 rounded-full font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg mt-4"
                >
                  Save Entry
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
