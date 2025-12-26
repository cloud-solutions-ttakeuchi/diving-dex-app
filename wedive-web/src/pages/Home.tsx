import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ImageWithFallback } from '../components/common/ImageWithFallback'; // Import
import { LogDetailModal } from '../components/LogDetailModal';
import { ChevronRight, ChevronLeft, Star, Heart, Bookmark, Calendar, MapPin, Bot, Sparkles, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { Log } from '../types';
import { getBoolean } from 'firebase/remote-config';
import { remoteConfig } from '../lib/firebase';

export const Home = () => {
  const { logs, points, creatures, areas, currentUser, toggleFavorite, recentLogs } = useApp();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);

  // 1. Featured Points (Top 5 by Log usage + Bookmark)
  // Logic: Combining log usage (local/global?) and bookmarks.
  // Since we don't have global log count per point easily, use local + bookmarks.
  const featuredSpots = points
    .map(point => ({
      ...point,
      score: (point.bookmarkCount || 0) * 2 + (logs.filter(l => l.spotId === point.id).length)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // 2. Popular Creatures (Global Popularity Stats)
  const popularCreatures = Array.from(new Map(creatures.map(c => [c.id, c])).values())
    .sort((a, b) => (b.stats?.popularity || 0) - (a.stats?.popularity || 0))
    .slice(0, 10);

  // 3. Popular Points (By bookmark)
  const popularPoints = [...points]
    .sort((a, b) => (b.bookmarkCount || 0) - (a.bookmarkCount || 0))
    .slice(0, 4);

  // Auto-advance carousel
  useEffect(() => {
    if (featuredSpots.length === 0) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % featuredSpots.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [featuredSpots.length]);

  if (featuredSpots.length === 0) {
    return <div className="p-8 text-center bg-gray-50 rounded-xl m-4">Loading data...</div>;
  }

  return (
    <div className="pb-24 space-y-16">
      {/* 0. AI Concierge Promo */}
      {(getBoolean(remoteConfig, 'enable_ai_concierge') || currentUser?.role === 'admin') && (
        <section className="max-w-[1280px] mx-auto px-4 pt-12 animate-fade-in">
          <Link to="/concierge" className="block group">
            <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-ocean-600 to-indigo-600 p-[1px]">
              <div className="relative bg-white/95 backdrop-blur-xl rounded-[2.5rem] p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8 transition-all group-hover:bg-white/90">
                <div className="flex-1 space-y-4 text-center md:text-left">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-ocean-50 text-ocean-600 rounded-full text-xs font-black uppercase tracking-widest shadow-sm">
                    <Sparkles size={14} /> NEW AI FEATURE
                  </div>
                  <h2 className="text-3xl md:text-4xl font-black text-gray-900 leading-tight" style={{ fontFamily: '"M PLUS Rounded 1c", sans-serif' }}>
                    あなただけの<span className="text-ocean-600">ダイビング<br className="md:hidden" />コンシェルジュ</span>
                  </h2>
                  <p className="text-gray-500 font-medium text-lg leading-relaxed max-w-xl">
                    「今週末、カメに会えるおすすめの場所は？」「初心者が楽しめる沖縄のスポットは？」AIに相談して、最高のダイビングプランを見つけましょう。
                  </p>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2">
                    <span className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl shadow-slate-200 transition-all hover:bg-slate-800 hover:scale-105 flex items-center gap-2">
                      AIに相談する <ChevronRight size={20} />
                    </span>
                  </div>
                </div>
                <div className="relative w-48 h-48 md:w-64 md:h-64 shrink-0 flex items-center justify-center">
                  <div className="absolute inset-0 bg-ocean-100 rounded-full scale-90 animate-pulse"></div>
                  <div className="relative z-10 w-full h-full bg-white rounded-full shadow-2xl flex items-center justify-center border-4 border-ocean-50 transition-transform group-hover:rotate-12 duration-500">
                    <Bot size={80} className="text-ocean-600" />
                  </div>
                  <div className="absolute top-0 right-0 p-3 bg-white rounded-2xl shadow-xl animate-bounce">
                    <Sparkles size={24} className="text-ocean-400" />
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* 1. Slideshow: Featured / New / Popular Points */}
      <section className="bg-white pt-8 pb-4 relative overflow-hidden">
        {/* Decorative Background */}
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
          <div className="absolute top-10 left-10 w-32 h-32 rounded-full border-8 border-gray-900"></div>
          <div className="absolute bottom-10 right-10 w-48 h-48 rounded-full bg-gray-900"></div>
        </div>

        <div className="max-w-[1280px] mx-auto px-4">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-cyan-100 rounded-full flex items-center justify-center text-cyan-600 font-black shadow-sm text-xl" style={{ fontFamily: '"M PLUS Rounded 1c", sans-serif' }}>F</div>
            <h2 className="text-2xl font-black text-gray-800 tracking-tight" style={{ fontFamily: '"M PLUS Rounded 1c", sans-serif' }}>
              <span className="text-cyan-500">FEATURED</span> POINTS
            </h2>
          </div>

          <div className="relative h-[400px] rounded-[2rem] overflow-hidden bg-gray-50 shadow-inner group">
            <AnimatePresence mode='wait'>
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0 flex items-center"
              >
                <div className="w-full h-full flex flex-col md:flex-row">
                  {/* Image Side */}
                  <div className="w-full md:w-1/2 h-1/2 md:h-full relative overflow-hidden">
                    <ImageWithFallback
                      src={featuredSpots[currentSlide].imageUrl}
                      alt={featuredSpots[currentSlide].name}
                      type="point"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent"></div>
                    <div className="absolute top-4 left-4 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                      PICK UP
                    </div>
                  </div>

                  {/* Info Side */}
                  <div className="w-full md:w-1/2 h-1/2 md:h-full p-8 md:p-12 flex flex-col justify-center bg-white relative">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-cyan-400 to-blue-500"></div>

                    <div className="text-sm font-bold text-gray-400 mb-2">No.{String(currentSlide + 1).padStart(3, '0')}</div>
                    <h3 className="text-3xl md:text-5xl font-black text-gray-900 mb-4 leading-tight" style={{ fontFamily: '"M PLUS Rounded 1c", sans-serif' }}>
                      {featuredSpots[currentSlide].name}
                    </h3>

                    <div className="flex flex-wrap gap-2 mb-6">
                      <span className={clsx(
                        "px-4 py-1 rounded-full text-sm font-bold text-white shadow-sm",
                        featuredSpots[currentSlide].level === 'Beginner' ? "bg-cyan-400" :
                          featuredSpots[currentSlide].level === 'Intermediate' ? "bg-blue-400" :
                            "bg-indigo-400"
                      )}>
                        {featuredSpots[currentSlide].level}
                      </span>
                      <span className="px-4 py-1 rounded-full text-sm font-bold bg-gray-100 text-gray-600">
                        {areas.find(a => a.id === featuredSpots[currentSlide].areaId)?.name}
                      </span>
                    </div>

                    <p className="text-gray-600 font-medium leading-relaxed mb-8 line-clamp-3">
                      {featuredSpots[currentSlide].description}
                    </p>

                    <Link
                      to={`/point/${featuredSpots[currentSlide].id}`}
                      className="inline-flex items-center justify-center gap-2 bg-cyan-500 text-white px-8 py-3 rounded-full font-bold hover:bg-cyan-600 transition-colors self-start shadow-lg shadow-cyan-200"
                    >
                      View Details <ChevronRight size={20} />
                    </Link>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Controls */}
            <button
              onClick={() => setCurrentSlide((prev) => (prev - 1 + featuredSpots.length) % featuredSpots.length)}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center text-gray-900 hover:bg-white transition-colors shadow-lg z-10"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => setCurrentSlide((prev) => (prev + 1) % featuredSpots.length)}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center text-gray-900 hover:bg-white transition-colors shadow-lg z-10"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </section>

      {/* 2. Latest Logs (Public) */}
      <section className="max-w-[1280px] mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-black shadow-sm text-lg" style={{ fontFamily: '"M PLUS Rounded 1c", sans-serif' }}>L</div>
            <h2 className="text-xl font-black text-gray-800 tracking-tight" style={{ fontFamily: '"M PLUS Rounded 1c", sans-serif' }}>
              <span className="text-blue-500">LATEST</span> LOGS
            </h2>
          </div>
          <Link to="/logs" className="text-sm font-bold text-gray-400 hover:text-blue-500 transition-colors">See All</Link>
        </div>

        {recentLogs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {recentLogs.slice(0, 8).map(log => {
              const mainPhoto = log.photos.length > 0 ? log.photos[0] :
                (creatures.find(c => c.id === log.creatureId)?.imageUrl ||
                  points.find(p => p.id === log.location.pointId)?.imageUrl); // Fallback handled by ImageWithFallback

              // Determine type for fallback
              const fallbackType = log.creatureId ? 'creature' : 'point';

              return (
                <div key={log.id} onClick={() => setSelectedLog(log)} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group cursor-pointer">
                  <div className="relative aspect-video bg-gray-100 overflow-hidden">
                    <ImageWithFallback
                      src={mainPhoto}
                      alt="Log"
                      type={fallbackType}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-md font-medium flex items-center gap-1">
                      <Calendar size={10} />
                      {new Date(log.date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden">
                        {/* We don't have user info in log object easily unless we fetch or it's embedded. Assumed simplified display or mock. Log type has 'userId'. */}
                        <div className="w-full h-full flex items-center justify-center bg-blue-500 text-white text-[10px] font-bold">U</div>
                      </div>
                      <span className="text-xs text-gray-500 font-medium truncate">Diver</span>
                    </div>

                    {/* Creature Info */}
                    {(log.creatureId || (log.sightedCreatures && log.sightedCreatures.length > 0)) && (
                      <div className="flex items-center gap-2 mb-2">
                        {log.creatureId && (() => {
                          const c = creatures.find(c => c.id === log.creatureId);
                          if (!c) return null;
                          return (
                            <div className="flex items-center gap-1 bg-orange-50 text-orange-600 px-2 py-1 rounded-md text-xs font-bold border border-orange-100 truncate max-w-[150px]">
                              <span className="truncate">{c.name}</span>
                            </div>
                          );
                        })()}
                        {log.sightedCreatures && log.sightedCreatures.filter(id => id !== log.creatureId).length > 0 && (
                          <span className="text-xs text-gray-400 font-bold">
                            +{log.sightedCreatures.filter(id => id !== log.creatureId).length}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="font-bold text-gray-800 mb-1 truncate">{log.location.pointName}</div>
                    <div className="flex items-center text-xs text-gray-500 gap-1">
                      <MapPin size={10} /> {log.location.region}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-400">
            No public logs yet.
          </div>
        )}

        <LogDetailModal
          log={selectedLog}
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          isOwner={selectedLog?.userId === currentUser.id}
        />
      </section>

      {/* 3. Popular Points (Horizontal Scroll) */}
      <section className="max-w-[1280px] mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-black shadow-sm text-lg" style={{ fontFamily: '"M PLUS Rounded 1c", sans-serif' }}>P</div>
            <h2 className="text-xl font-black text-gray-800 tracking-tight" style={{ fontFamily: '"M PLUS Rounded 1c", sans-serif' }}>
              <span className="text-purple-500">POPULAR</span> POINTS
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {popularPoints.map((point) => (
            <Link key={point.id} to={`/point/${point.id}`} className="flex bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-all group h-[120px]">
              <div className="w-[120px] bg-gray-200 relative shrink-0">
                <ImageWithFallback
                  src={point.imageUrl}
                  alt={point.name}
                  type="point"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4 flex flex-col justify-center flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">{point.level}</span>
                  <span className="text-xs text-gray-500">{areas.find(a => a.id === point.areaId)?.name}</span>
                </div>
                <h3 className="font-bold text-gray-800 text-lg mb-1 group-hover:text-purple-600 transition-colors line-clamp-1">{point.name}</h3>
                <div className="flex items-center gap-3 text-xs text-gray-400 mt-auto">
                  <span className="flex items-center gap-1"><Bookmark size={12} className="fill-gray-300" /> {point.bookmarkCount || 0}</span>
                  {/* <span className="flex items-center gap-1"><Star size={12} className="fill-gray-300" /> 4.5</span> */}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 4. Popular Creatures (Grid) */}
      <section className="max-w-[1280px] mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-black shadow-sm text-lg" style={{ fontFamily: '"M PLUS Rounded 1c", sans-serif' }}>C</div>
            <h2 className="text-xl font-black text-gray-800 tracking-tight" style={{ fontFamily: '"M PLUS Rounded 1c", sans-serif' }}>
              <span className="text-orange-500">POPULAR</span> CREATURES
            </h2>
          </div>

          <Link to="/pokedex" className="text-sm font-bold text-gray-400 hover:text-orange-500 transition-colors">See Pokedex</Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {popularCreatures.map((creature) => {
            const isFavorite = currentUser.favoriteCreatureIds?.includes(creature.id);
            return (
              <Link key={creature.id} to={`/creature/${creature.id}`} className="group relative block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <div className="aspect-square bg-white p-4 relative flex items-center justify-center">
                  <ImageWithFallback
                    src={creature.imageUrl}
                    alt={creature.name}
                    type="creature"
                    className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
                  />
                  {creature.status === 'pending' && (
                    <div className="absolute top-2 left-2 bg-amber-500 text-white px-2 py-0.5 rounded text-[10px] font-black flex items-center gap-1 z-10 shadow-sm">
                      <Clock size={10} /> 提案中
                    </div>
                  )}
                </div>
                <div className="p-3 bg-gray-50/50 border-t border-gray-100">
                  <div className="text-xs text-gray-500 font-bold mb-0.5">{creature.category}</div>
                  <h3 className="font-bold text-gray-900 truncate">{creature.name}</h3>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 4 }).map((_, i) => {
                        const r = creature.rarity === 'Legendary' ? 4 : creature.rarity === 'Epic' ? 3 : creature.rarity === 'Rare' ? 2 : 1;
                        return <Star key={i} size={8} className={i < r ? "fill-orange-400 text-orange-400" : "text-gray-200"} />;
                      })}
                    </div>
                    <button onClick={(e) => { e.preventDefault(); toggleFavorite(creature.id); }}>
                      {isFavorite ? <Heart size={12} className="fill-red-500 text-red-500" /> : <Heart size={12} className="text-gray-300 hover:text-red-500" />}
                    </button>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

    </div>
  );
};
