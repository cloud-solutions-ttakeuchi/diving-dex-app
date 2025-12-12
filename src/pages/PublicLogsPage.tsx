import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { collectionGroup, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Log } from '../types';
import { ImageWithFallback } from '../components/common/ImageWithFallback';
import { LogDetailModal } from '../components/LogDetailModal';
import { Calendar, MapPin, Search, Anchor } from 'lucide-react';

export const PublicLogsPage = () => {
  const { creatures, points, currentUser } = useApp();
  const [logs, setLogs] = useState<Log[]>([]);
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const q = query(
          collectionGroup(db, 'logs'),
          where('isPrivate', '==', false),
          orderBy('date', 'desc'),
          limit(50)
        );

        const snapshot = await getDocs(q);
        const loadedLogs = snapshot.docs.map(doc => doc.data() as Log);
        setLogs(loadedLogs);
      } catch (err: any) {
        console.error("Error fetching public logs:", err);
        setError(err.message || 'Failed to fetch logs');
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  if (loading) {
    return <div className="min-h-screen pt-20 flex justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ocean"></div></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 pt-4">
      <div className="max-w-[1280px] mx-auto px-4">

        <div className="mb-8">
          <h1 className="text-3xl font-black text-deepBlue-900 flex items-center gap-2 mb-2" style={{ fontFamily: '"M PLUS Rounded 1c", sans-serif' }}>
            <span className="text-blue-500">PUBLIC</span> LOGS
          </h1>
          <p className="text-gray-500">みんなのダイビングログ ({logs.length}件)</p>
        </div>

        {error ? (
          <div className="p-4 rounded-lg bg-red-50 border border-red-100 text-red-600 mb-6">
            <p className="font-bold">Error loading logs:</p>
            <p className="text-sm font-mono mt-1">{error}</p>
          </div>
        ) : logs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {logs.map(log => {
              const mainPhoto = log.photos.length > 0 ? log.photos[0] :
                (creatures.find(c => c.id === log.creatureId)?.imageUrl ||
                  points.find(p => p.id === log.location.pointId)?.imageUrl);

              const fallbackType = log.creatureId ? 'creature' : 'point';

              return (
                <div key={log.id} onClick={() => setLogs(prev => { const l = prev.find(p => p.id === log.id); setSelectedLog(l || null); return prev; })} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-300 group flex flex-col h-full cursor-pointer">
                  <div className="relative aspect-video bg-gray-100 overflow-hidden shrink-0">
                    <ImageWithFallback
                      src={mainPhoto}
                      alt="Log"
                      type={fallbackType}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-md font-bold flex items-center gap-1">
                      <Calendar size={10} />
                      {new Date(log.date).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="p-4 flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs ring-2 ring-white shadow-sm">
                        U
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs text-gray-400 font-bold">Diver</div>
                        {/* Ideally user name here */}
                      </div>
                    </div>

                    <div className="mb-auto">
                      <div className="flex items-center gap-1.5 text-xs text-cyan-600 font-bold mb-1">
                        <MapPin size={12} />
                        {log.location.region}
                      </div>
                      <h3 className="font-bold text-gray-800 text-lg leading-tight mb-2 line-clamp-2">
                        {log.location.pointName}
                      </h3>

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

                      {/* Tags/Stats */}
                      <div className="flex flex-wrap gap-2 mt-auto">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-md text-xs font-medium text-gray-600">
                          <Anchor size={10} /> {log.depth.max}m
                        </span>
                        {/* Other stats if available */}
                      </div>
                    </div>

                    {log.comment && (
                      <p className="text-sm text-gray-500 mt-4 line-clamp-2 bg-gray-50 p-2 rounded-lg italic">
                        "{log.comment}"
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200">
            <Search size={48} className="mb-4 opacity-20" />
            <p className="font-bold">公開されているログはありません</p>
          </div>
        )}

        {/* Detail Modal */}
        <LogDetailModal
          log={selectedLog}
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          isOwner={selectedLog?.userId === currentUser.id}
        />
      </div>
    </div>
  );
};
