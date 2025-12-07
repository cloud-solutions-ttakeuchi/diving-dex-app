import { useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import type { Creature } from '../types';
import { MapPin, Lock, CheckCircle, ArrowLeft, Droplets, Trophy, Check, Image as ImageIcon } from 'lucide-react';
import clsx from 'clsx';

export const MyPointDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { points, areas, creatures, logs, pointCreatures, isAuthenticated } = useApp();
  const { t } = useLanguage();
  const point = points.find(p => p.id === id);

  if (!point) return <div className="text-center mt-10 text-gray-500">{t('spot.not_found')}</div>;
  if (!isAuthenticated) return <div className="text-center mt-10 text-gray-500">{t('common.login_required')}</div>;

  const area = areas.find(a => a.id === point.areaId);
  /* const area already declared above */
  const validPointCreatureIds = pointCreatures
    .filter(pc => pc.pointId === point.id && (pc.status === 'approved' || pc.status === undefined))
    .map(pc => pc.creatureId);

  const localPointCreatures = validPointCreatureIds
    .map(id => creatures.find(c => c.id === id))
    .filter((c): c is Creature => c !== undefined)
    .sort((a, b) => {
      const rarityOrder: Record<string, number> = {
        'Legendary': 4,
        'Epic': 3,
        'Rare': 2,
        'Common': 1
      };
      return (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0);
    });

  // logs in context are already filtered by currentUser (users/{uid}/logs)
  const userLogs = logs.filter(l => l.spotId === point.id);

  const discoveredCount = new Set(userLogs.map(l => l.creatureId)).size;
  const totalCount = localPointCreatures.length;
  const masteryRate = totalCount > 0 ? Math.round((discoveredCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6 pb-24">
      {/* Header / Nav */}
      <div className="flex items-center gap-2">
        <Link to="/mypage" className="p-2 -ml-2 text-gray-500 hover:text-deepBlue-900">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold text-deepBlue-900">{point.name} {t('mypage.mastery')}</h1>
      </div>

      {/* Point Overview Card */}
      <div className="bg-white border border-deepBlue-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="h-32 relative">
          {(point.imageUrl && !point.imageUrl.includes('loremflickr') && point.imageUrl.match(/\((https?:\/\/.*?)\)/)?.[1]) || (point.imageUrl && !point.imageUrl.includes('loremflickr')) ? (
            <img
              src={(point.imageUrl.match(/\((https?:\/\/.*?)\)/)?.[1]) || point.imageUrl}
              alt={point.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
              <ImageIcon size={48} className="text-gray-300" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
            <div className="text-white">
              <div className="flex items-center gap-1 text-xs opacity-90 mb-1">
                <MapPin size={12} />
                {area?.name}
              </div>
              <div className="font-bold text-lg">{point.name}</div>
            </div>
          </div>
        </div>

        <div className="p-4 flex items-center justify-between">
          <div className="flex gap-4">
            <div className="text-center">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">{t('mypage.dives')}</div>
              <div className="font-bold text-deepBlue-900 flex items-center gap-1">
                <Droplets size={14} className="text-ocean" />
                {userLogs.length}
              </div>
            </div>
            <div className="text-center border-l border-gray-100 pl-4">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">{t('mypage.found')}</div>
              <div className="font-bold text-deepBlue-900 flex items-center gap-1">
                <CheckCircle size={14} className="text-green-500" />
                {discoveredCount} / {totalCount}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">{t('mypage.mastery')}</div>
            <div className="text-2xl font-black text-ocean flex items-center gap-1 justify-end">
              {masteryRate}%
              {masteryRate === 100 && <Trophy size={20} className="text-yellow-500" />}
            </div>
          </div>
        </div>
      </div>

      {/* Collection Grid */}
      <div className="space-y-3">
        <h3 className="font-bold text-deepBlue-900 flex items-center gap-2">
          <Lock size={18} className="text-ocean" />
          {t('mypage.collection')}
        </h3>

        <div className="grid grid-cols-3 gap-3">
          {localPointCreatures.map(creature => {
            const isDiscovered = userLogs.some(l => l.creatureId === creature.id);

            return (
              <Link
                key={creature.id}
                to={isDiscovered ? `/creature/${creature.id}` : '#'}
                className={clsx(
                  "aspect-square rounded-xl overflow-hidden border relative group transition-all",
                  isDiscovered
                    ? "bg-white border-deepBlue-100 shadow-sm"
                    : "bg-gray-100 border-gray-200 cursor-default"
                )}
                onClick={(e) => !isDiscovered && e.preventDefault()}
              >
                <div className="aspect-square relative">
                  {/* Rarity Badge */}
                  <div className={clsx(
                    "absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-bold z-10 shadow-sm",
                    creature.rarity === 'Legendary' ? "bg-purple-100 text-purple-700 border border-purple-200" :
                      creature.rarity === 'Epic' ? "bg-orange-100 text-orange-700 border border-orange-200" :
                        creature.rarity === 'Rare' ? "bg-blue-100 text-blue-700 border border-blue-200" :
                          "bg-gray-100 text-gray-600 border border-gray-200"
                  )}>
                    {creature.rarity}
                  </div>

                  <img
                    src={isDiscovered ? (creature.imageUrl || '/images/no-image-creature.png') : '/images/locked.png'}
                    alt={creature.name}
                    className={`w-full h-full object-cover ${isDiscovered ? '' : 'opacity-60 p-4'}`}
                  />
                  {isDiscovered && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white p-1 rounded-full shadow-md">
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                  {!isDiscovered && (
                    <div className="absolute top-2 right-2 bg-gray-500 text-white p-1 rounded-full shadow-md">
                      <Lock size={12} strokeWidth={3} />
                    </div>
                  )}
                </div>

                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                  <div className="text-[10px] text-white font-bold truncate text-center">
                    {isDiscovered ? creature.name : '???'}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};
