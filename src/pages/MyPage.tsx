import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import type { Creature } from '../types';
import { LogDetailModal } from '../components/LogDetailModal';
import { LogImportModal } from '../components/LogImportModal';
import { ProfileEditModal } from '../components/ProfileEditModal';
import { LogCard } from '../components/LogCard';
import { BulkEditModal } from '../components/BulkEditModal';
import { Award, MapPin, Grid, List, BookOpen, Heart, Bookmark, Check, Star, PenTool, ChevronRight, Compass, Droplet, Map as MapIcon, Aperture, Crown, Shield, Info, Settings, X, Activity, Droplets, Image as ImageIcon, Upload, Trash2 } from 'lucide-react';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useState } from 'react';

import { CERTIFICATION_MASTER, BADGE_MASTER, TRUST_RANKS } from '../data/mockData';
import { useFeatureToggle } from '../hooks/useFeatureToggle';

export const MyPage = () => {
  const { currentUser, logs, points, zones, areas, creatures, pointCreatures, isAuthenticated, toggleLikeLog, deleteLogs, updateLogs } = useApp();
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'logbook' | 'collection' | 'favorites' | 'wanted' | 'bookmarks'>('dashboard');
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [showRankInfo, setShowRankInfo] = useState(false);

  // Feature Toggle
  const isGarminImportEnabled = useFeatureToggle('enable_garmin_import');

  // Refactor: Use logs from context
  const selectedLog = selectedLogId ? (logs.find(l => l.id === selectedLogId) || null) : null;

  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const openEditModal = () => {
    setIsEditingProfile(true);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4 text-center">
        <Award size={64} className="text-gray-300" />
        <h2 className="text-xl font-bold text-deepBlue-900">{t('common.guest')}</h2>
        <p className="text-gray-500 max-w-xs">
          {t('common.login_required')}
        </p>
      </div>
    );
  }

  // Refactor: logs is already the user's logs
  const userLogs = logs;
  const uniqueCreatureIds = Array.from(new Set(userLogs.flatMap(l => [l.creatureId, ...(l.sightedCreatures || [])]).filter(Boolean)));
  const uniqueCreatures = uniqueCreatureIds.length;
  // Refactor: use creatures from context
  const totalCreatures = creatures.length;
  const completionRate = Math.round((uniqueCreatures / totalCreatures) * 100);
  const totalDives = userLogs.length; // Simplified: 1 log = 1 dive for MVP

  // Certification Info
  const userCert = currentUser.certification;
  const certOrg = userCert ? CERTIFICATION_MASTER : null; // Mock: assuming single org for now or matching ID
  const certRank = userCert && certOrg ? certOrg.ranks.find(r => r.id === userCert.rankId) : null;

  // Badges Info
  const userBadges = currentUser.badges?.map(b => {
    const master = BADGE_MASTER.find(m => m.id === b.badgeId);
    return master ? { ...master, earnedAt: b.earnedAt } : null;
  }).filter(Boolean) || [];

  // 1. Basic Info & Stats
  // Refactor: use zones, areas, points from context
  const zoneStats = zones.map(zone => {
    const areaIds = areas.filter(a => a.zoneId === zone.id).map(a => a.id);
    const pointIds = points.filter(p => areaIds.includes(p.areaId)).map(p => p.id);
    const logsInZone = userLogs.filter(l => pointIds.includes(l.spotId));
    return { name: zone.name, value: logsInZone.length };
  }).filter(d => d.value > 0);

  // Trust Rank Logic
  const currentScore = currentUser.trustScore || 0;
  const currentRank = TRUST_RANKS.slice().slice().reverse().find(r => currentScore >= r.minScore) || TRUST_RANKS[0];
  const nextRank = TRUST_RANKS.find(r => r.minScore > currentScore);

  let progress = 100;
  let pointsToNext = 0;

  if (nextRank) {
    const range = nextRank.minScore - currentRank.minScore;
    const gained = currentScore - currentRank.minScore;
    progress = Math.min(100, Math.max(0, (gained / range) * 100));
    pointsToNext = nextRank.minScore - currentScore;
  }

  const COLORS = ['#0ea5e9', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b5cf6'];

  // 4. Point Mastery (History & Mastery)
  // Refactor: use points from context
  const pointMastery = points.map(point => {
    const pointLogs = userLogs.filter(l => l.spotId === point.id);
    if (pointLogs.length === 0) return null;

    const validPointCreatures = pointCreatures.filter(pc => pc.pointId === point.id && (pc.status === 'approved' || pc.status === undefined));
    const totalInhabitants = validPointCreatures.length;
    const discoveredInhabitants = new Set(
      pointLogs.flatMap(l => [l.creatureId, ...(l.sightedCreatures || [])]).filter(Boolean)
    ).size;
    const masteryRate = totalInhabitants > 0 ? Math.round((discoveredInhabitants / totalInhabitants) * 100) : 0;

    return {
      point,
      diveCount: pointLogs.length,
      masteryRate,
      discoveredCount: discoveredInhabitants,
      totalCount: totalInhabitants
    };
  }).filter(Boolean).sort((a, b) => b!.diveCount - a!.diveCount);

  // 5. Collection
  // Refactor: use creatures from context
  const discoveredCreatures = uniqueCreatureIds.map(id => creatures.find(c => c.id === id)).filter((c): c is Creature => c !== undefined);

  return (
    <div className="space-y-8 pb-32 max-w-5xl mx-auto">
      {/* 1. Basic Info Header */}
      <div className="glass-panel rounded-3xl p-8 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-ocean-50 to-transparent opacity-50" />

        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full p-1 bg-gradient-to-br from-white to-ocean-100 shadow-xl flex-shrink-0">
            <div className="w-full h-full rounded-full overflow-hidden border-4 border-white">
              {currentUser.profileImage ? (
                <img src={currentUser.profileImage} alt={currentUser.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-ocean-100 flex items-center justify-center text-4xl text-ocean-500 font-bold">
                  {currentUser.name.charAt(0)}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 text-center md:text-left space-y-2">
            <div className="flex flex-col md:flex-row items-center gap-3 justify-center md:justify-start">
              <h1 className="text-3xl font-bold text-gray-800 tracking-tight">{currentUser.name}</h1>
              <button
                onClick={openEditModal}
                className="p-2 text-gray-400 hover:text-ocean-500 transition-colors rounded-full hover:bg-gray-100"
              >
                <Settings size={18} />
              </button>
            </div>



            <div className="flex items-center justify-center md:justify-start gap-3 text-ocean-600 font-medium">
              <div className="flex items-center gap-1.5 bg-ocean-50 px-3 py-1 rounded-full border border-ocean-100">
                <Award size={16} />
                <span>{certRank ? `${certOrg?.name} ${certRank.name}` : t('mypage.pro_diver')}</span>
              </div>
            </div>

            {userBadges.length > 0 && (
              <div className="flex justify-center md:justify-start gap-2 pt-2">
                {userBadges.map(badge => (
                  <div key={badge!.id} className="w-8 h-8 rounded-full bg-yellow-50 border border-yellow-200 flex items-center justify-center text-sm shadow-sm" title={badge!.name}>
                    🏆
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-8 md:gap-12 px-8 py-4 bg-white/50 rounded-2xl border border-white/60 shadow-sm backdrop-blur-sm">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-800">{totalDives}</div>
              <div className="text-xs text-gray-500 font-bold tracking-wider mt-1">{t('mypage.dives')}</div>
            </div>
            <div className="w-px bg-gray-200" />
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-800">{uniqueCreatures}</div>
              <div className="text-xs text-gray-500 font-bold tracking-wider mt-1">{t('mypage.found')}</div>
            </div>
            <div className="w-px bg-gray-200" />
            <div className="text-center">
              <div className="text-3xl font-bold text-ocean-500">{completionRate}<span className="text-base">%</span></div>
              <div className="text-xs text-gray-500 font-bold tracking-wider mt-1">{t('mypage.comp')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Trust Rank Section */}
      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-full bg-${currentRank.designColor.split('-')[0]}-100 text-${currentRank.designColor}`}>
              {currentRank.icon === 'Droplet' && <Droplet size={24} />}
              {currentRank.icon === 'Map' && <MapIcon size={24} />}
              {currentRank.icon === 'Aperture' && <Aperture size={24} />}
              {currentRank.icon === 'Crown' && <Crown size={24} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Current Rank</div>
                <button
                  onClick={() => setShowRankInfo(!showRankInfo)}
                  className="text-gray-400 hover:text-blue-500 transition-colors"
                >
                  <small><Info size={14} /></small>
                </button>
              </div>
              <div className="text-lg font-bold text-gray-800">{currentRank.name}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">{currentScore} <span className="text-sm text-gray-400 font-normal">TP</span></div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div
            className={`absolute top-0 left-0 h-full bg-${currentRank.designColor.split('-')[0]}-500 transition-all duration-1000 ease-out`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex justify-between text-xs text-gray-500 font-medium">
          <span>{currentRank.name}</span>
          {nextRank ? (
            <span>次の目標: {nextRank.name} まであと {pointsToNext} ポイント</span>
          ) : (
            <span>最高ランク到達！</span>
          )}
        </div>

        {(currentUser.role === 'moderator' || currentUser.role === 'admin') ? (
          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
            <Link to="/admin/proposals" className="flex items-center gap-2 text-sm font-bold text-purple-600 hover:bg-purple-50 px-3 py-1.5 rounded-lg transition-colors">
              <Shield size={16} />
              提案を審査する
            </Link>
            <Link to="/admin/areas" className="flex items-center gap-2 text-sm font-bold text-orange-600 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-colors ml-2">
              <span className="text-orange-500 text-lg">🧹</span>
              エリア整理
            </Link>
          </div>
        ) : null}

        {/* Info Modal/Tooltip */}
        {showRankInfo && (
          <div className="absolute top-20 left-4 right-4 z-10 bg-white p-4 rounded-xl shadow-xl border border-blue-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-blue-800 flex items-center gap-2"><Award size={16} /> 信頼ランクについて</h4>
              <button onClick={() => setShowRankInfo(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="text-sm text-gray-600 space-y-2">
              <p>信頼ランクは、あなたの図鑑への貢献度を表します。</p>
              <ul className="list-disc list-inside bg-blue-50 p-2 rounded-lg">
                <li>提案を送信: <span className="font-bold text-blue-600">+1 TP</span></li>
                <li>提案が承認: <span className="font-bold text-green-600">+5 TP</span></li>
              </ul>
              <p className="text-xs">ランクが上がると、モデレーター（承認権限）などの特別な役割が付与されることがあります。</p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex p-1.5 bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm overflow-x-auto">
        {
          [
            { id: 'dashboard', label: t('mypage.dashboard'), icon: Activity },
            { id: 'logbook', label: t('mypage.logbook'), icon: BookOpen },
            { id: 'collection', label: t('mypage.collection'), icon: Grid },
            { id: 'favorites', label: 'Favorites', icon: Heart },
            { id: 'wanted', label: 'Wanted', icon: Bookmark },
            { id: 'bookmarks', label: 'Plan', icon: MapPin },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={clsx(
                "flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-bold rounded-xl transition-all whitespace-nowrap",
                activeTab === tab.id
                  ? "bg-white text-ocean-600 shadow-md transform scale-[1.02]"
                  : "text-gray-500 hover:text-gray-700 hover:bg-white/40"
              )}
            >
              {/* <tab.icon size={16} className={activeTab === tab.id ? "text-ocean-500" : "opacity-50"} /> */}
              {tab.label}
            </button>
          ))
        }
      </div >

      {/* 2. Dashboard Content */}
      {
        activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Stats Chart */}
            <div className="bg-white rounded-2xl p-6 border border-deepBlue-100 shadow-sm">
              <h3 className="font-bold text-deepBlue-900 mb-4 flex items-center gap-2">
                <Activity size={18} className="text-ocean" />
                {t('mypage.dashboard')}
              </h3>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={zoneStats}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {zoneStats.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} iconSize={8} fontSize={10} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Point Mastery */}
            <div className="space-y-3">
              <h3 className="font-bold text-deepBlue-900 flex items-center gap-2">
                <MapPin size={18} className="text-ocean" />
                {t('mypage.mastery')}
              </h3>
              {pointMastery.map(pm => (
                <Link to={`/mypage/point/${pm!.point.id}`} key={pm!.point.id} className="block bg-white rounded-xl p-4 border border-deepBlue-100 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-bold text-deepBlue-900">{pm!.point.name}</h4>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Droplets size={12} /> {pm!.diveCount} {t('mypage.dives')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-ocean">{pm!.masteryRate}%</div>
                      <div className="text-[10px] text-gray-400">{t('mypage.mastery')}</div>
                    </div>
                  </div>

                  {/* Creature Locks */}
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {pointCreatures
                      .filter(pc => pc.pointId === pm!.point.id && (pc.status === 'approved' || pc.status === undefined))
                      .map(pc => pc.creatureId)
                      .map(cId => creatures.find(c => c.id === cId))
                      .filter((c): c is Creature => c !== undefined)
                      .sort((a, b) => {
                        const rarityOrder: Record<string, number> = {
                          'Legendary': 4,
                          'Epic': 3,
                          'Rare': 2,
                          'Common': 1
                        };
                        return (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0);
                      })
                      .map(creature => {
                        const isDiscovered = userLogs.some(l => l.spotId === pm!.point.id && l.creatureId === creature.id);
                        return (
                          <div key={creature.id} className="relative w-8 h-8 rounded-full overflow-hidden border border-gray-100">
                            <img
                              src={isDiscovered ? (creature.imageUrl || '/images/no-image-creature.png') : '/images/locked.png'}
                              alt={creature.name}
                              className={`w-full h-full object-cover ${isDiscovered ? '' : 'opacity-60 p-1'
                                }`}
                            />
                          </div>
                        );
                      })}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )
      }

      {/* 3. Logbook Tab */}
      {
        activeTab === 'logbook' && (
          <div className="space-y-6">
            {/* Entry Point */}
            <div className="flex gap-4">
              <Link
                to="/add-log"
                className="flex-1 group relative bg-gray-50 hover:bg-white text-gray-700 py-6 px-6 rounded-r-xl rounded-l-md border-l-8 border-ocean-400 shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-ocean-500 shadow-sm group-hover:scale-110 transition-transform">
                    <PenTool size={20} />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-lg">新しいログを書く</div>
                    <div className="text-xs text-gray-400 font-mono">My Diving Log</div>
                  </div>
                </div>
                <div className="text-gray-300 group-hover:text-ocean-400 transition-colors">
                  <ChevronRight size={24} />
                </div>
              </Link>

              {(import.meta.env.DEV || isGarminImportEnabled) && (
                <button
                  onClick={() => setIsImportOpen(true)}
                  className="group relative bg-gray-50 hover:bg-white text-gray-700 py-6 px-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col items-center justify-center gap-2 min-w-[120px]"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 shadow-sm group-hover:scale-110 transition-transform">
                    <Upload size={20} />
                  </div>
                  <div className="font-bold text-sm">Garmin取込</div>
                </button>
              )}
            </div>

            {userLogs.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                <div className="text-4xl mb-4">🤿</div>
                <h3 className="text-lg font-bold text-deepBlue-900 mb-2">最初のダイビングを記録しよう！</h3>
                <p className="text-gray-500 mb-6">
                  感動した海の世界をログに残して、<br />
                  あなただけの宝物にしませんか？
                </p>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-2 px-1">
                  <div className="text-sm font-bold text-gray-500">
                    {isSelectionMode ? `${selectedLogIds.length} stores selected` : `${userLogs.length} logs`}
                  </div>
                  <button
                    onClick={() => {
                      setIsSelectionMode(!isSelectionMode);
                      setSelectedLogIds([]);
                    }}
                    className={`text-sm font-bold px-3 py-1.5 rounded-lg transition-colors ${isSelectionMode ? 'bg-gray-200 text-gray-700' : 'bg-ocean-50 text-ocean-600'}`}
                  >
                    {isSelectionMode ? t('bulk.cancel' as any) : t('bulk.edit' as any)}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-20">
                  {userLogs.map(log => {
                    const creature = creatures.find(c => c.id === log.creatureId);
                    const point = points.find(p => p.id === log.spotId);

                    return (
                      <LogCard
                        key={log.id}
                        log={log}
                        currentUser={currentUser}
                        creature={creature}
                        point={point}
                        onLike={toggleLikeLog}
                        onClick={(id) => setSelectedLogId(id)}
                        selectable={isSelectionMode}
                        isSelected={selectedLogIds.includes(log.id)}
                        onSelect={(id) => {
                          setSelectedLogIds(prev =>
                            prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
                          );
                        }}
                      />
                    );
                  })}
                </div>

                {/* Bulk Action Bar */}
                {isSelectionMode && selectedLogIds.length > 0 && (
                  <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-xl z-50 flex items-center gap-6 animate-in slide-in-from-bottom-4">
                    <div className="font-bold">{selectedLogIds.length} {t('bulk.selected' as any)}</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (window.confirm(t('bulk.delete_confirm' as any).replace('{{count}}', String(selectedLogIds.length)))) {
                            deleteLogs(selectedLogIds);
                            setIsSelectionMode(false);
                            setSelectedLogIds([]);
                          }
                        }}
                        className="flex items-center gap-1 bg-gray-50 text-red-600 hover:bg-gray-100 px-4 py-2 rounded-lg font-bold transition-colors"
                      >
                        <Trash2 size={16} /> {t('bulk.delete' as any)}
                      </button>
                      <button
                        onClick={() => setIsBulkEditOpen(true)}
                        className="flex items-center gap-1 bg-gray-50 text-slate-900 hover:bg-gray-100 px-4 py-2 rounded-lg font-bold transition-colors"
                      >
                        <Settings size={16} /> {t('bulk.edit' as any)}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )
      }

      {/* Log Detail Modal */}
      <LogDetailModal
        log={selectedLog}
        isOpen={!!selectedLog}
        onClose={() => setSelectedLogId(null)}
        isOwner={true}
      />

      {/* Log Import Modal */}
      <LogImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportComplete={() => {
          // Maybe a toast or just refresh (automatic via context)
        }}
      />

      {/* Bulk Edit Modal */}
      <BulkEditModal
        isOpen={isBulkEditOpen}
        onClose={() => setIsBulkEditOpen(false)}
        selectedCount={selectedLogIds.length}
        onSave={async (data) => {
          await updateLogs(selectedLogIds, data);
          setIsSelectionMode(false);
          setSelectedLogIds([]);
        }}
      />

      {/* 5. Collection Tab */}
      {
        activeTab === 'collection' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <h3 className="font-bold text-deepBlue-900 flex items-center gap-2">
                <BookOpen size={18} className="text-ocean" />
                {t('mypage.collection')} <span className="text-gray-400 text-sm font-normal">({discoveredCreatures.length})</span>
              </h3>
              <div className="flex bg-white p-1 rounded-lg border border-gray-100 shadow-sm">
                <button
                  onClick={() => setViewMode('grid')}
                  className={clsx("p-1.5 rounded-md transition-all", viewMode === 'grid' ? "bg-ocean/10 text-ocean" : "text-gray-400 hover:text-gray-600")}
                >
                  <Grid size={16} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={clsx("p-1.5 rounded-md transition-all", viewMode === 'list' ? "bg-ocean/10 text-ocean" : "text-gray-400 hover:text-gray-600")}
                >
                  <List size={16} />
                </button>
              </div>
            </div>

            <div className={viewMode === 'grid' ? "grid grid-cols-2 gap-4" : "space-y-3"}>
              {discoveredCreatures.map(creature => (
                <Link
                  key={creature.id}
                  to={`/creature/${creature.id}`}
                  className={clsx(
                    "group relative overflow-hidden transition-all duration-300",
                    viewMode === 'grid'
                      ? "aspect-[4/5] rounded-2xl shadow-md hover:shadow-xl hover:-translate-y-1"
                      : "bg-white border border-gray-100 rounded-xl p-3 flex gap-4 items-center hover:shadow-md"
                  )}
                >
                  <img
                    src={creature.imageUrl || '/images/no-image-creature.png'}
                    alt={creature.name}
                    className={clsx(
                      "object-cover transition-transform duration-700 group-hover:scale-110",
                      viewMode === 'grid' ? "w-full h-full absolute inset-0" : "w-16 h-16 rounded-lg"
                    )}
                  />

                  {viewMode === 'grid' && (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-t from-deepBlue-900 via-transparent to-transparent opacity-90" />
                      <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                        <h4 className="font-bold text-white text-lg leading-tight drop-shadow-md mb-1">{creature.name}</h4>
                        <div className="flex gap-0.5">
                          {Array.from({ length: 4 }).map((_, i) => {
                            const rarityLevel = creature.rarity === 'Legendary' ? 4 :
                              creature.rarity === 'Epic' ? 3 :
                                creature.rarity === 'Rare' ? 2 : 1;
                            const isActive = i < rarityLevel;
                            return (
                              <Star // Assuming Star is imported or needs to be added to imports if not present
                                key={i}
                                size={12}
                                className={isActive ? "text-yellow-400 fill-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.8)]" : "text-white/20"}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                  {viewMode === 'list' && (
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-deepBlue-900 truncate">{creature.name}</div>
                      <div className="text-xs text-gray-500 italic">{creature.scientificName}</div>
                      <div className="flex gap-0.5 mt-1">
                        {Array.from({ length: 4 }).map((_, i) => {
                          const rarityLevel = creature.rarity === 'Legendary' ? 4 :
                            creature.rarity === 'Epic' ? 3 :
                              creature.rarity === 'Rare' ? 2 : 1;
                          const isActive = i < rarityLevel;
                          return (
                            <Star
                              key={i}
                              size={10}
                              className={isActive ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )
      }

      {/* Favorites Tab */}
      {
        activeTab === 'favorites' && (
          <div className="space-y-4">
            <h3 className="font-bold text-deepBlue-900 flex items-center gap-2 px-1">
              <Heart size={18} className="text-red-500" />
              Favorites <span className="text-gray-400 text-sm font-normal">({currentUser.favoriteCreatureIds?.length || 0})</span>
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {currentUser.favoriteCreatureIds?.map(id => {
                const creature = creatures.find(c => c.id === id);
                if (!creature) return null;
                return (
                  <Link
                    key={id}
                    to={`/creature/${id}`}
                    className="group relative aspect-[4/5] rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                  >
                    <img src={creature.imageUrl || '/images/no-image-creature.png'} alt={creature.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-deepBlue-900 via-transparent to-transparent opacity-90" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                      <h4 className="font-bold text-white text-lg leading-tight drop-shadow-md mb-1">{creature.name}</h4>
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
              {(currentUser.favoriteCreatureIds?.length || 0) === 0 && (
                <div className="col-span-2 text-center py-12 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100 border-dashed">
                  No favorites yet.
                </div>
              )}
            </div>
          </div>
        )
      }

      {/* Wanted Tab */}
      {
        activeTab === 'wanted' && (
          <div className="space-y-4">
            <h3 className="font-bold text-deepBlue-900 flex items-center gap-2 px-1">
              <Bookmark size={18} className="text-yellow-500" />
              Wanted <span className="text-gray-400 text-sm font-normal">({currentUser.wanted.length})</span>
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {currentUser.wanted.map(id => {
                const creature = creatures.find(c => c.id === id);
                if (!creature) return null;
                const isDiscovered = userLogs.some(l => l.creatureId === id);
                return (
                  <Link
                    key={id}
                    to={`/creature/${id}`}
                    className="group relative aspect-[4/5] rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                  >
                    <img src={creature.imageUrl || '/images/no-image-creature.png'} alt={creature.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-deepBlue-900 via-transparent to-transparent opacity-90" />

                    {isDiscovered && (
                      <div className="absolute top-2 right-2 bg-green-500 text-white p-1.5 rounded-full shadow-lg shadow-green-500/30 z-10">
                        <Check size={14} strokeWidth={3} />
                      </div>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                      <h4 className="font-bold text-white text-lg leading-tight drop-shadow-md mb-1">{creature.name}</h4>
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
              {currentUser.wanted.length === 0 && (
                <div className="col-span-2 text-center py-12 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100 border-dashed">
                  No wanted creatures yet.
                </div>
              )}
            </div>
          </div>
        )
      }

      {/* Bookmarks Tab (Plan) */}
      {
        activeTab === 'bookmarks' && (
          <div className="space-y-6">
            <h3 className="font-bold text-deepBlue-900 flex items-center gap-2 px-1">
              <Bookmark size={18} className="text-yellow-500" />
              Bookmarked Points <span className="text-gray-400 text-sm font-normal">({currentUser.bookmarkedPointIds.length})</span>
            </h3>

            {currentUser.bookmarkedPointIds.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                <div className="text-4xl mb-4">🗺️</div>
                <h3 className="text-lg font-bold text-deepBlue-900 mb-2">気になるポイントを探そう！</h3>
                <p className="text-gray-500 mb-6">
                  次に行きたいダイビングポイントをブックマークして、<br />
                  旅行の計画を立てましょう。
                </p>
                <Link
                  to="/points"
                  className="inline-flex items-center justify-center gap-2 bg-gray-50 text-gray-700 px-6 py-3 rounded-lg font-bold hover:bg-gray-100 transition-colors border border-gray-200"
                >
                  <Compass size={18} />
                  <span>ポイントを探検する</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Group by Zone */}
                {Array.from(new Set(
                  currentUser.bookmarkedPointIds
                    .map(id => points.find(p => p.id === id))
                    .filter(p => p !== undefined)
                    .map(p => p!.zone)
                )).map(zoneName => {
                  const zonePoints = currentUser.bookmarkedPointIds
                    .map(id => points.find(p => p.id === id))
                    .filter(p => p !== undefined && p!.zone === zoneName);

                  return (
                    <div key={zoneName} className="space-y-3">
                      <h4 className="font-bold text-gray-500 text-sm flex items-center gap-2 pl-1">
                        <MapPin size={14} /> {zoneName}
                      </h4>
                      <div className="grid grid-cols-1 gap-3">
                        {zonePoints.map(point => (
                          <Link
                            key={point!.id}
                            to={`/point/${point!.id}`}
                            className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all flex gap-4 group"
                          >
                            <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 relative bg-gray-100 flex items-center justify-center border border-gray-100">
                              {(point!.imageUrl && !point!.imageUrl.includes('loremflickr') && point!.imageUrl.match(/\((https?:\/\/.*?)\)/)?.[1]) || (point!.imageUrl && !point!.imageUrl.includes('loremflickr')) ? (
                                <img
                                  src={(point!.imageUrl.match(/\((https?:\/\/.*?)\)/)?.[1]) || point!.imageUrl}
                                  alt={point!.name}
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                />
                              ) : (
                                <ImageIcon size={24} className="text-gray-300" />
                              )}
                            </div>
                            <div className="flex-1 flex flex-col justify-between py-1">
                              <div>
                                <h5 className="font-bold text-deepBlue-900 text-lg group-hover:text-ocean transition-colors">{point!.name}</h5>
                                <p className="text-xs text-gray-500">{point!.area}</p>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-gray-500">
                                <span className={clsx(
                                  "px-2 py-0.5 rounded font-bold",
                                  point!.level === 'Beginner' ? "bg-green-100 text-green-700" :
                                    point!.level === 'Intermediate' ? "bg-blue-100 text-blue-700" :
                                      "bg-red-100 text-red-700"
                                )}>
                                  {point!.level}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Droplets size={12} /> {point!.maxDepth}m
                                </span>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )
      }
      {/* Edit Profile Modal */}
      {/* Edit Profile Modal */}
      <ProfileEditModal
        isOpen={isEditingProfile}
        onClose={() => setIsEditingProfile(false)}
      />
    </div >
  );
};
