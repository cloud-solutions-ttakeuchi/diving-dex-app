
import { useState, useEffect } from 'react';
import { Calendar, Clock, Droplets, Heart } from 'lucide-react';
import clsx from 'clsx';
import type { Log, User, Creature, Point } from '../types';

interface LogCardProps {
  log: Log;
  currentUser: User;
  creature?: Creature;
  point?: Point;
  onLike: (log: Log) => void;
  onClick: (id: string) => void;
  selectable?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}

export const LogCard = ({ log, currentUser, creature, point, onLike, onClick, selectable, isSelected, onSelect }: LogCardProps) => {
  const isLiked = log.likedBy?.includes(currentUser.id);
  const [localIsLiked, setLocalIsLiked] = useState(isLiked);
  const [likeCount, setLikeCount] = useState(log.likeCount || 0);

  // Sync with prop when it changes (e.g. from backend refetch)
  useEffect(() => {
    // eslint-disable-next-line
    setLocalIsLiked(log.likedBy?.includes(currentUser.id));
    setLikeCount(log.likeCount || 0);
  }, [log, currentUser.id]);

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Optimistic Update
    const newIsLiked = !localIsLiked;
    setLocalIsLiked(newIsLiked);
    setLikeCount(prev => newIsLiked ? prev + 1 : Math.max(0, prev - 1));

    onLike(log);
  };

  const handleClick = () => {
    if (selectable && onSelect) {
      onSelect(log.id);
    } else {
      onClick(log.id);
    }
  };

  let mainImage = log.photos[0];
  if (!mainImage && creature) {
    mainImage = creature.imageUrl || '/images/no-image-creature.png';
  } else if (!mainImage && point) {
    mainImage = point.imageUrl || '/images/no-image-point.png';
  } else if (!mainImage) {
    mainImage = '/images/no-image-point.png';
  }

  return (
    <div
      onClick={handleClick}
      className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all cursor-pointer group relative ${isSelected ? 'ring-2 ring-ocean-500 bg-ocean-50' : ''}`}
    >
      {selectable && (
        <div className="absolute top-3 left-3 z-20">
          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-ocean-500 border-ocean-500' : 'bg-white/80 border-gray-300'}`}>
            {isSelected && <div className="w-3 h-3 bg-white rounded-full" />}
          </div>
        </div>
      )}
      <div className="h-48 relative overflow-hidden">
        <img
          src={mainImage}
          alt="Log thumbnail"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-deepBlue-900 flex items-center gap-1 shadow-sm">
          <Calendar size={12} />
          {new Date(log.date).toLocaleDateString()}
        </div>
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <h4 className="font-bold text-lg text-deepBlue-900 line-clamp-1">
            {log.title || point?.name || log.location.pointName}
          </h4>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
          <div className="flex items-center gap-1">
            <Clock size={12} /> {log.time.duration}min
          </div>
          <div className="flex items-center gap-1">
            <Droplets size={12} /> {log.depth.max}m
          </div>
        </div>
        <div className="flex justify-between items-end mt-auto">
          {log.comment ? (
            <p className="text-sm text-gray-600 line-clamp-2 flex-1 mr-2">
              {log.comment}
            </p>
          ) : <div className="flex-1" />}

          <button
            onClick={handleLike}
            className="flex items-center gap-1 text-gray-400 hover:text-pink-500 transition-colors group/like"
          >
            <Heart
              size={16}
              className={clsx(
                "transition-all duration-300 group-active/like:scale-125",
                isLiked ? "fill-pink-500 text-pink-500" : "group-hover/like:fill-pink-100"
              )}
            />
            <span className={clsx("text-xs font-bold", isLiked ? "text-pink-500" : "")}>
              {likeCount > 0 ? likeCount : ''}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
