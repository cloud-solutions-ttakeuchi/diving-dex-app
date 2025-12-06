import { useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { MapPin, CheckCircle, Star, ChevronLeft } from 'lucide-react';
// import type { Point } from '../types';

export const SpotDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { points, areas, creatures, pointCreatures, logs, isAuthenticated } = useApp();
  const { t } = useLanguage();
  const point = points.find(p => p.id === id);

  if (!point) return <div className="text-center mt-20 text-gray-500 font-medium">{t('spot.not_found')}</div>;

  const area = areas.find(a => a.id === point.areaId);
  // Filter pointCreatures from context
  const inhabitants = pointCreatures
    .filter(pc => pc.pointId === id)
    .map(pc => {
      const creature = creatures.find(c => c.id === pc.creatureId);
      if (!creature) return null;
      return { ...creature, rarity: pc.localRarity };
    })
    .filter(Boolean);
  const userLogs = isAuthenticated ? logs.filter(l => l.spotId === point.id) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section - Large image like Pokemon Zukan */}
      <div className="bg-white">
        <div className="max-w-5xl mx-auto">
          {/* Navigation back */}
          <div className="px-6 py-4 border-b border-gray-200">
            <Link to="/" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors">
              <ChevronLeft size={18} className="mr-1" />
              {t('nav.home')}
            </Link>
          </div>

          {/* Hero Image */}
          <div className="relative aspect-[21/9] bg-gray-100 overflow-hidden">
            <img
              src={point.imageUrl}
              alt={point.name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Title Section */}
          <div className="px-8 py-8 border-b border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                  <MapPin size={16} />
                  <span>{area?.name}</span>
                </div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">
                  {point.name}
                </h1>
                <div className="flex flex-wrap gap-2">
                  {point.features.map((feature) => (
                    <span
                      key={feature}
                      className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>

              {/* Difficulty Badge */}
              <div className="flex-shrink-0">
                <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${point.level === 'Beginner' ? 'bg-green-100 text-green-700' :
                  point.level === 'Intermediate' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                  {point.level}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-5xl mx-auto px-8 py-12">
        {/* Description Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-8 mb-12">
          <h2 className="text-lg font-bold text-gray-900 mb-4">{t('spot.difficulty')}</h2>
          <p className="text-gray-700 leading-relaxed">
            {point.description}
          </p>
        </div>

        {/* Field Guide */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {t('spot.field_guide')}
            </h2>
            <span className="text-sm text-gray-600">
              {inhabitants.length} {t('spot.species')}
            </span>
          </div>

          {/* Creatures Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {inhabitants.map((creature) => {
              const isDiscovered = userLogs.some(l => l.creatureId === creature!.id);

              return (
                <Link
                  key={creature!.id}
                  to={`/creature/${creature!.id}`}
                  className="group bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-primary-500 hover:shadow-md transition-all"
                >
                  <div className="aspect-square relative bg-gray-50">
                    <img
                      src={creature!.imageUrl}
                      alt={creature!.name}
                      className="w-full h-full object-cover"
                    />

                    {isDiscovered && (
                      <div className="absolute top-2 right-2 bg-success text-white p-1 rounded-full">
                        <CheckCircle size={16} strokeWidth={2.5} />
                      </div>
                    )}
                  </div>

                  <div className="p-3">
                    <h3 className="font-bold text-gray-900 text-sm mb-1 truncate">
                      {creature!.name}
                    </h3>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 4 }).map((_, i) => {
                        const rarityLevel = creature!.rarity === 'Legendary' ? 4 :
                          creature!.rarity === 'Epic' ? 3 :
                            creature!.rarity === 'Rare' ? 2 : 1;
                        const isActive = i < rarityLevel;
                        return (
                          <Star
                            key={i}
                            size={12}
                            className={isActive ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}
                          />
                        );
                      })}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
