
import { useState, useEffect } from 'react';
import { Calendar, Clock, Droplets, Heart } from 'lucide-react';
import clsx from 'clsx';
import type { Log, User, Creature, Point } from '../types';

interface LogCardProps {
  log: Log;
  currentUser: User;
  creature?: Creature;
  point?: Point;
  onLike: (logId: string) => void;
  onClick: (logId: string) => void;
}

export const LogCard = ({ log, currentUser, creature, point, onLike, onClick }: LogCardProps) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  // Sync with props when they change (e.g. initial load or external update)
  useEffect(() => {
    const userLiked = (log.likedBy || []).includes(currentUser.id);
    setIsLiked(userLiked);
    setLikeCount(log.likeCount || 0);
  }, [log.likedBy, log.likeCount, currentUser.id]);

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Optimistic Update
    const newIsLiked = !isLiked;
    setIsLiked(newIsLiked);
    setLikeCount(prev => newIsLiked ? prev + 1 : Math.max(0, prev - 1));

    // Call parent handler
    onLike(log.id);
  };

  const mainImage = log.photos[0] || (creature?.imageUrl || '/images/no-image-creature.png') || (point?.imageUrl || '/images/no-image-point.png') || '/images/no-image.png';

  return (
    <div
      onClick={() => onClick(log.id)}
      className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-all text-left group flex flex-col cursor-pointer"
    >
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
            {point?.name || log.location.pointName}
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
