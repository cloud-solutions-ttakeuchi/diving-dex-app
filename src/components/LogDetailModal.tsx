import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ImageWithFallback } from './common/ImageWithFallback';
import { X, Calendar, Clock, MapPin, Heart, Activity, Sun, Settings, Users, Fish, FileText, Camera, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { Log } from '../types';

type Props = {
  log: Log | null;
  isOpen: boolean;
  onClose: () => void;
  isOwner: boolean;
};

export const LogDetailModal = ({ log, isOpen, onClose, isOwner }: Props) => {
  const { points, creatures, currentUser, toggleLikeLog, deleteLog } = useApp();
  const [isLiked, setIsLiked] = React.useState(false);
  const [likeCount, setLikeCount] = React.useState(0);

  React.useEffect(() => {
    if (log) {
      setIsLiked((log.likedBy || []).includes(currentUser.id));
      setLikeCount(log.likeCount || 0);
    }
  }, [log, currentUser.id]);

  if (!isOpen || !log) return null;

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newIsLiked = !isLiked;
    setIsLiked(newIsLiked);
    setLikeCount(prev => newIsLiked ? prev + 1 : Math.max(0, prev - 1));
    toggleLikeLog(log.id);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header Image */}
        <div className="relative h-64 flex-shrink-0">
          <img
            src={log.photos[0] || (creatures.find(c => c.id === log.creatureId)?.imageUrl || '/images/no-image-creature.png') || (points.find(p => p.id === log.spotId)?.imageUrl || '/images/no-image-point.png') || '/images/no-image.png'}
            alt="Log Header"
            className="w-full h-full object-cover"
          />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors z-10"
          >
            <X size={20} />
          </button>

          {/* Edit & Delete Buttons - Only for Owner */}
          {isOwner && (
            <div className="absolute top-4 right-16 flex gap-2 z-10">
              <Link
                to={`/edit-log/${log.id}`}
                className="bg-white/90 text-deepBlue-900 px-3 py-2 rounded-full font-bold text-xs shadow-md hover:bg-white transition-colors flex items-center gap-1"
              >
                <Settings size={14} /> 編集
              </Link>
              <button
                onClick={async () => {
                  if (window.confirm('このログを削除してもよろしいですか？この操作は取り消せません。')) {
                    await deleteLog(log.id);
                    onClose();
                  }
                }}
                className="bg-white/90 text-red-600 px-3 py-2 rounded-full font-bold text-xs shadow-md hover:bg-white hover:text-red-700 transition-colors flex items-center gap-1"
              >
                <Trash2 size={14} /> 削除
              </button>
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 text-white">
            <div className="flex items-center gap-2 text-sm font-bold opacity-90 mb-1">
              <span className="bg-white/20 px-2 py-0.5 rounded text-xs">No.{log.diveNumber}</span>
              <Calendar size={14} />
              {new Date(log.date).toLocaleDateString()}
              <span className="mx-2">|</span>
              <Clock size={14} />
              {log.time.entry || '--:--'} - {log.time.exit || '--:--'} ({log.time.duration}min)
            </div>
            <h2 className="text-2xl font-bold">
              {log.title || points.find(p => p.id === log.spotId)?.name || log.location.pointName}
            </h2>
            <div className="text-sm opacity-80 flex items-center gap-1 mt-1">
              <MapPin size={14} />
              {/* If title is present, show Point Name here for context */}
              {log.title && (
                <span className="font-bold mr-1">
                  {points.find(p => p.id === log.spotId)?.name || log.location.pointName}
                </span>
              )}
              {log.location.region} {(isOwner && log.location.shopName) && ` / ${log.location.shopName}`}
            </div>

            {/* Like Button in Header */}
            <button
              onClick={handleLike}
              className="absolute bottom-6 right-6 bg-white/20 backdrop-blur-md border border-white/30 rounded-full px-4 py-2 flex items-center gap-2 text-white hover:bg-white/30 transition-all active:scale-95"
            >
              <Heart
                size={20}
                className={clsx(
                  "transition-all duration-300",
                  isLiked ? "fill-pink-500 text-pink-500" : "text-white"
                )}
              />
              <span className="font-bold">{likeCount}</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">

          {/* 1. Dive Data Stats */}
          <section>
            <h3 className="font-bold text-deepBlue-900 mb-3 flex items-center gap-2 border-b pb-2 border-gray-100">
              <Activity size={18} className="text-ocean" /> ダイブデータ
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-3 rounded-xl text-center">
                <div className="text-xs text-gray-500 font-bold mb-1">最大水深</div>
                <div className="text-lg font-bold text-deepBlue-900">{log.depth.max}m</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl text-center">
                <div className="text-xs text-gray-500 font-bold mb-1">平均水深</div>
                <div className="text-lg font-bold text-deepBlue-900">{log.depth.average}m</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl text-center">
                <div className="text-xs text-gray-500 font-bold mb-1">透明度</div>
                <div className="text-lg font-bold text-deepBlue-900">{log.condition?.transparency || '--'}m</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl text-center">
                <div className="text-xs text-gray-500 font-bold mb-1">水温 (底)</div>
                <div className="text-lg font-bold text-deepBlue-900">{log.condition?.waterTemp?.bottom || '--'}℃</div>
              </div>
            </div>
          </section>

          {/* 2. Conditions */}
          <section>
            <h3 className="font-bold text-deepBlue-900 mb-3 flex items-center gap-2 border-b pb-2 border-gray-100">
              <Sun size={18} className="text-orange-500" /> コンディション
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div className="flex flex-col">
                <span className="text-gray-500 text-xs">天気</span>
                <span className="font-bold text-gray-900 capitalize">{log.condition?.weather || '--'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-gray-500 text-xs">気温</span>
                <span className="font-bold text-gray-900">{log.condition?.airTemp ? `${log.condition.airTemp}℃` : '--'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-gray-500 text-xs">水温 (面)</span>
                <span className="font-bold text-gray-900">{log.condition?.waterTemp?.surface ? `${log.condition.waterTemp.surface}℃` : '--'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-gray-500 text-xs">波</span>
                <span className="font-bold text-gray-900 capitalize">{log.condition?.wave || 'None'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-gray-500 text-xs">流れ</span>
                <span className="font-bold text-gray-900 capitalize">{log.condition?.current || 'None'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-gray-500 text-xs">うねり</span>
                <span className="font-bold text-gray-900 capitalize">{log.condition?.surge || 'None'}</span>
              </div>
            </div>
          </section>

          {/* 3. Gear & Tank */}
          <section>
            <h3 className="font-bold text-deepBlue-900 mb-3 flex items-center gap-2 border-b pb-2 border-gray-100">
              <Settings size={18} className="text-gray-500" /> 器材・タンク
            </h3>
            <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">スーツ</span>
                  <span className="font-bold text-gray-900 capitalize">
                    {log.gear?.suitType === 'wet' ? 'ウェット' : log.gear?.suitType === 'dry' ? 'ドライ' : '--'}
                    {log.gear?.suitThickness && ` (${log.gear.suitThickness}mm)`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">ウェイト</span>
                  <span className="font-bold text-gray-900">{log.gear?.weight ? `${log.gear.weight}kg` : '--'}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">タンク</span>
                  <span className="font-bold text-gray-900 capitalize">
                    {log.gear?.tank?.material === 'steel' ? 'スチール' : log.gear?.tank?.material === 'aluminum' ? 'アルミ' : '--'}
                    {log.gear?.tank?.capacity && ` ${log.gear.tank.capacity}L`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">空気圧</span>
                  <span className="font-bold text-gray-900">
                    {log.gear?.tank?.pressureStart || '--'} → {log.gear?.tank?.pressureEnd || '--'} bar
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* 4. Team - PRIVACY PROTECTED: Only visible to Owner */}
          {isOwner && (
            <section>
              <h3 className="font-bold text-deepBlue-900 mb-3 flex items-center gap-2 border-b pb-2 border-gray-100">
                <Users size={18} className="text-purple-500" /> チーム
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex gap-2">
                  <span className="text-gray-500 min-w-[80px]">ガイド:</span>
                  <span className="font-bold text-gray-900">{log.team?.guide || '--'}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-500 min-w-[80px]">バディ:</span>
                  <span className="font-bold text-gray-900">{log.team?.buddy || '--'}</span>
                </div>
                {log.team?.members && log.team.members.length > 0 && (
                  <div className="flex gap-2">
                    <span className="text-gray-500 min-w-[80px]">メンバー:</span>
                    <span className="font-bold text-gray-900">{log.team.members.join(', ')}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 5. Creatures */}
          {(log.creatureId || (log.sightedCreatures && log.sightedCreatures.length > 0)) && (
            <section>
              <h3 className="font-bold text-deepBlue-900 mb-3 flex items-center gap-2 border-b pb-2 border-gray-100">
                <Fish size={18} className="text-red-500" /> 生物
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {/* Main Creature */}
                {log.creatureId && (() => {
                  const c = creatures.find(c => c.id === log.creatureId);
                  if (c) {
                    return (
                      <Link key={c.id} to={`/creature/${c.id}`} className="group relative block aspect-square rounded-xl overflow-hidden border-2 border-red-200 shadow-sm hover:shadow-md transition-all">
                        <ImageWithFallback
                          src={c.imageUrl || '/images/no-image-creature.png'}
                          alt={c.name}
                          type="creature"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg shadow-sm">MAIN</div>
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 pt-6">
                          <div className="text-white text-xs font-bold truncate text-center drop-shadow-md">{c.name}</div>
                        </div>
                      </Link>
                    );
                  }
                  return null;
                })()}

                {/* Sighted Creatures */}
                {log.sightedCreatures
                  ?.filter(id => id !== log.creatureId)
                  .map(id => {
                    const c = creatures.find(c => c.id === id);
                    if (!c) return null;
                    return (
                      <Link key={id} to={`/creature/${id}`} className="group relative block aspect-square rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-all">
                        <ImageWithFallback
                          src={c.imageUrl || '/images/no-image-creature.png'}
                          alt={c.name}
                          type="creature"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 pt-6">
                          <div className="text-white text-xs font-bold truncate text-center drop-shadow-md">{c.name}</div>
                        </div>
                      </Link>
                    );
                  })}
              </div>
            </section>
          )}

          {/* 6. Comment */}
          <section>
            <h3 className="font-bold text-deepBlue-900 mb-3 flex items-center gap-2 border-b pb-2 border-gray-100">
              <FileText size={18} className="text-blue-500" /> コメント
            </h3>
            <div className="bg-gray-50 rounded-xl p-4 text-gray-700 leading-relaxed whitespace-pre-wrap">
              {log.comment || 'コメントなし'}
            </div>
          </section>

          {/* 7. Photos */}
          {log.photos.length > 0 && (
            <section>
              <h3 className="font-bold text-deepBlue-900 mb-3 flex items-center gap-2 border-b pb-2 border-gray-100">
                <Camera size={18} className="text-green-500" /> 写真 ({log.photos.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {log.photos.map((photo, index) => (
                  <div key={index} className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(photo, '_blank')}>
                    <img src={photo} alt={`Log photo ${index + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>
      </div>
    </div>
  );
};
