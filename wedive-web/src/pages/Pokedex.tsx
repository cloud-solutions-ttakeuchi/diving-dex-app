import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { ImageWithFallback } from '../components/common/ImageWithFallback'; // Import
import { Search, Filter, Star, CheckCircle } from 'lucide-react';
import clsx from 'clsx';

export const Pokedex = () => {
  const { creatures, logs, isAuthenticated, points, pointCreatures } = useApp();
  const { t } = useLanguage();
  // const [filter, setFilter] = useState<'all' | 'discovered' | 'undiscovered'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const allCreatures = creatures;
  const userLogs = isAuthenticated ? logs : [];
  const discoveredCreatureIds = new Set(userLogs.flatMap(l => [l.creatureId, ...(l.sightedCreatures || [])]).filter(Boolean) as string[]);

  const filteredCreatures = allCreatures.filter(creature => {
    const term = searchTerm.toLowerCase();

    if (!term) return true;

    // 1. Direct Text Properties
    const matchesProperty =
      (creature.name && creature.name.toLowerCase().includes(term)) ||
      (creature.scientificName && creature.scientificName.toLowerCase().includes(term)) ||
      (creature.family && creature.family.toLowerCase().includes(term)) ||
      (creature.tags && creature.tags.some(tag => tag.toLowerCase().includes(term))) ||
      (creature.specialAttributes && creature.specialAttributes.some(attr => attr.toLowerCase().includes(term)));

    if (matchesProperty) return true;

    // 2. Area/Location Search
    // Find points that match the search term (Area, Zone, Region, Name)
    const matchedPointIds = points
      .filter(p =>
        (p.name && p.name.toLowerCase().includes(term)) ||
        (p.area && p.area.toLowerCase().includes(term)) ||
        (p.zone && p.zone.toLowerCase().includes(term)) ||
        (p.region && p.region.toLowerCase().includes(term))
      )
      .map(p => p.id);

    // Check if this creature is linked to any of those points
    if (matchedPointIds.length > 0) {
      // Find entries in pointCreatures matching this creature AND one of the matched points
      const isLinkedToArea = pointCreatures.some(pc =>
        pc.creatureId === creature.id && matchedPointIds.includes(pc.pointId)
      );
      if (isLinkedToArea) return true;
    }

    return false;
  });

  return (
    <div className="space-y-6 pb-24 pt-2">
      <div className="flex items-end justify-between px-2">
        <div>
          <h2 className="text-3xl font-bold text-deepBlue-900 tracking-tight">{t('pokedex.title')}</h2>
          <p className="text-gray-500 text-sm mt-1">Collection</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/add-creature" className="flex items-center gap-1 text-xs font-bold bg-ocean-100 text-ocean-700 px-3 py-1.5 rounded-full hover:bg-ocean-200 transition-colors">
            <Star size={12} className="fill-ocean-700" /> 生物登録
          </Link>
          <div className="text-sm font-medium bg-white px-3 py-1 rounded-full shadow-sm border border-gray-100 text-deepBlue-600">
            {isAuthenticated ? (
              <span>{discoveredCreatureIds.size} <span className="text-gray-400">/</span> {allCreatures.length}</span>
            ) : (
              <span>{allCreatures.length} {t('spot.species')}</span>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative px-1">
        <div className="absolute inset-0 bg-ocean/5 blur-xl rounded-full transform scale-95 opacity-50" />
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-ocean" size={20} />
          <input
            type="text"
            placeholder="生物名、科目、エリア、タグ、特徴などで検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-4 rounded-2xl border-none bg-white/80 backdrop-blur-md shadow-lg shadow-ocean/5 focus:outline-none focus:ring-2 focus:ring-ocean/50 transition-all placeholder:text-gray-400 text-deepBlue-900 font-medium"
          />
        </div>
      </div>

      {/* Grid */}
      {filteredCreatures.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 px-1">
          {filteredCreatures.map(creature => {
            const isDiscovered = discoveredCreatureIds.has(creature.id);

            return (
              <Link
                key={creature.id}
                to={`/creature/${creature.id}`}
                className="group relative aspect-[4/5] rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
              >
                {/* Image Background */}
                <ImageWithFallback
                  src={creature.imageUrl}
                  alt={creature.name}
                  type="creature"
                  className={clsx(
                    "w-full h-full object-cover transition-transform duration-700 group-hover:scale-110",
                    !isDiscovered && "grayscale contrast-125 brightness-75"
                  )}
                />

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-deepBlue-900 via-transparent to-transparent opacity-90" />

                {/* Status Badge */}
                {isDiscovered ? (
                  <div className="absolute top-2 right-2 bg-green-500 text-white p-1.5 rounded-full shadow-lg shadow-green-500/30 z-10 animate-in zoom-in duration-300">
                    <CheckCircle size={16} strokeWidth={3} />
                  </div>
                ) : (
                  <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-md text-white/50 p-1.5 rounded-full z-10">
                    <Filter size={16} />
                  </div>
                )}

                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                  <h3 className="font-bold text-white text-lg leading-tight drop-shadow-md mb-1">{creature.name}</h3>
                  <div className="flex items-center justify-between">
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
                            className={clsx(
                              "transition-all duration-300",
                              isActive
                                ? "text-yellow-400 fill-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]"
                                : "text-white/20"
                            )}
                          />
                        );
                      })}
                    </div>
                    {!isDiscovered && (
                      <span className="text-[10px] font-medium text-white/60 uppercase tracking-wider">Locked</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Search size={48} className="mb-4 opacity-20" />
          <p>{t('pokedex.no_results')}</p>
        </div>
      )}
    </div>
  );
};
