import React, { useState, useEffect } from 'react';
import { Camera, X, Star, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CERTIFICATION_MASTER } from '../data/mockData';
import clsx from 'clsx';
import { ImageWithFallback } from './common/ImageWithFallback';
import { HierarchicalPointSelector } from './HierarchicalPointSelector';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileEditModal = ({ isOpen, onClose }: Props) => {
  const { currentUser, updateUser, points } = useApp();

  // Tabs
  const [activeTab, setActiveTab] = useState<'basic' | 'points' | 'gear' | 'shops'>('basic');

  // Basic Info State
  const [name, setName] = useState(currentUser.name);
  const [profileImage, setProfileImage] = useState<string | undefined>(currentUser.profileImage);
  const [rankId, setRankId] = useState(currentUser.certification?.rankId || '');
  const [certDate, setCertDate] = useState(currentUser.certification?.date || '');
  const [orgId, setOrgId] = useState(currentUser.certification?.orgId || CERTIFICATION_MASTER.id);

  // Favorites State
  const [favPoints, setFavPoints] = useState<{ id: string; isPrimary: boolean }[]>(currentUser.favorites?.points || []);
  const [favShops, setFavShops] = useState<{ name: string; isPrimary: boolean }[]>(currentUser.favorites?.shops || []);
  const [favTanks, setFavTanks] = useState<{
    name: string;
    specs: { material?: 'steel' | 'aluminum'; capacity?: number; gasType?: string };
    isPrimary: boolean
  }[]>(currentUser.favorites?.gear?.tanks || []);

  const [tempPointId, setTempPointId] = useState(''); // For adding new favorites

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setName(currentUser.name);
      setProfileImage(currentUser.profileImage);
      setRankId(currentUser.certification?.rankId || '');
      setCertDate(currentUser.certification?.date || '');
      setOrgId(currentUser.certification?.orgId || CERTIFICATION_MASTER.id);

      setFavPoints(currentUser.favorites?.points || []);
      setFavShops(currentUser.favorites?.shops || []);
      setFavTanks(currentUser.favorites?.gear?.tanks || []);
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUser({
      name,
      profileImage,
      certification: {
        orgId,
        rankId,
        date: certDate
      },
      favorites: {
        points: favPoints,
        areas: currentUser.favorites?.areas || [], // Preserve areas as we haven't built UI for it
        shops: favShops,
        gear: {
          tanks: favTanks
        }
      }
    });
    onClose();
  };

  // --- Point Helper Functions ---
  const togglePrimaryPoint = (id: string) => {
    setFavPoints(prev => prev.map(p => ({
      ...p,
      isPrimary: p.id === id ? true : false // Only one primary? Or toggle? Requirement: "designate a primary favorite"
    })));
  };

  const removePoint = (id: string) => {
    setFavPoints(prev => prev.filter(p => p.id !== id));
  };

  const addPoint = (pointId: string) => {
    if (favPoints.some(p => p.id === pointId)) return;
    setFavPoints(prev => [...prev, { id: pointId, isPrimary: prev.length === 0 }]); // Auto primary if first
  };

  // --- Shop Helper Functions ---
  const togglePrimaryShop = (shopName: string) => {
    setFavShops(prev => prev.map(s => ({
      ...s,
      isPrimary: s.name === shopName ? true : false
    })));
  };

  const addShop = (shopName: string) => {
    if (!shopName.trim() || favShops.some(s => s.name === shopName)) return;
    setFavShops(prev => [...prev, { name: shopName, isPrimary: prev.length === 0 }]);
  };

  const removeShop = (shopName: string) => {
    setFavShops(prev => prev.filter(s => s.name !== shopName));
  };

  // --- Tank Helper Functions ---
  const addTank = (material: 'steel' | 'aluminum', capacity: number) => {
    const name = `${material === 'steel' ? 'スチール' : 'アルミ'} ${capacity}L`;
    setFavTanks(prev => [...prev, {
      name,
      specs: { material, capacity },
      isPrimary: prev.length === 0
    }]);
  };

  const removeTank = (index: number) => {
    setFavTanks(prev => prev.filter((_, i) => i !== index));
  };

  const togglePrimaryTank = (index: number) => {
    setFavTanks(prev => prev.map((t, i) => ({
      ...t,
      isPrimary: i === index ? true : false
    })));
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-lg text-deepBlue-900">プロフィール編集</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {['basic', 'points', 'gear', 'shops'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={clsx(
                "px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap",
                activeTab === tab
                  ? "border-ocean-500 text-ocean-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              )}
            >
              {tab === 'basic' && '基本情報'}
              {tab === 'points' && 'お気に入りポイント'}
              {tab === 'gear' && '器材設定'}
              {tab === 'shops' && 'ショップ'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} id="profile-form">

            {/* --- BASIC TAB --- */}
            {activeTab === 'basic' && (
              <div className="space-y-6">
                <div className="flex flex-col items-center">
                  <div className="relative w-24 h-24 rounded-full bg-gray-100 mb-2 overflow-hidden border-2 border-dashed border-gray-300 flex items-center justify-center group cursor-pointer">
                    {profileImage ? (
                      <img src={profileImage} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="text-gray-400" size={32} />
                    )}
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-white text-xs font-bold">変更</span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                  <p className="text-xs text-gray-500">プロフィール画像</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-ocean outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">認定ランク</label>
                    <select
                      value={rankId}
                      onChange={(e) => setRankId(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-ocean outline-none"
                    >
                      <option value="">選択してください</option>
                      {CERTIFICATION_MASTER.ranks.map(rank => (
                        <option key={rank.id} value={rank.id}>{rank.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">認定日</label>
                    <input
                      type="date"
                      value={certDate}
                      onChange={(e) => setCertDate(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-ocean outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* --- POINTS TAB --- */}
            {activeTab === 'points' && (
              <div className="space-y-6">
                <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-800 mb-4">
                  <p>⭐️ボタンで「メイン」に設定すると、ログ新規作成時に自動でセットされます。</p>
                </div>

                <div className="space-y-3">
                  {favPoints.map(fp => {
                    const point = points.find(p => p.id === fp.id);
                    if (!point) return null;
                    return (
                      <div key={fp.id} className={clsx(
                        "flex items-center justify-between p-3 rounded-xl border transition-all",
                        fp.isPrimary ? "bg-ocean-50 border-ocean-200 shadow-sm" : "bg-white border-gray-200"
                      )}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                            <ImageWithFallback src={point.imageUrl} alt={point.name} type="point" className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-900 text-sm">{point.name}</h4>
                            <p className="text-xs text-gray-500">{point.area}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => togglePrimaryPoint(fp.id)}
                            className={clsx(
                              "p-1.5 rounded-full transition-colors",
                              fp.isPrimary ? "text-yellow-400 bg-white shadow-sm" : "text-gray-300 hover:text-yellow-400"
                            )}
                            title="Set as Primary"
                          >
                            <Star size={18} fill={fp.isPrimary ? "currentColor" : "none"} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removePoint(fp.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                            title="Remove"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {favPoints.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-xl">
                      お気に入りのポイントはまだありません
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <label className="block text-sm font-bold text-gray-700 mb-2">ポイントを追加</label>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <HierarchicalPointSelector
                        value={tempPointId}
                        onChange={setTempPointId}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (tempPointId) {
                          addPoint(tempPointId);
                          setTempPointId('');
                        }
                      }}
                      className="bg-gray-50 text-ocean-600 border border-gray-200 px-4 py-3 rounded-lg font-bold text-sm hover:bg-ocean-50 hover:border-ocean-200 transition-colors h-[50px] flex items-center shadow-sm"
                    >
                      <Plus size={20} />
                      <span className="ml-1">登録</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* --- GEAR TAB --- */}
            {activeTab === 'gear' && (
              <div className="space-y-6">
                <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-800 mb-4">
                  <p>「いつもの」器材設定を登録しておくと便利です。</p>
                </div>

                <div className="space-y-3">
                  {favTanks.map((tank, index) => (
                    <div key={index} className={clsx(
                      "flex items-center justify-between p-3 rounded-xl border transition-all",
                      tank.isPrimary ? "bg-ocean-50 border-ocean-200 shadow-sm" : "bg-white border-gray-200"
                    )}>
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">{tank.name}</h4>
                        <p className="text-xs text-gray-500">
                          {tank.specs.material === 'steel' ? 'スチール' : 'アルミ'} / {tank.specs.capacity}L
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => togglePrimaryTank(index)}
                          className={clsx(
                            "p-1.5 rounded-full transition-colors",
                            tank.isPrimary ? "text-yellow-400 bg-white shadow-sm" : "text-gray-300 hover:text-yellow-400"
                          )}
                        >
                          <Star size={18} fill={tank.isPrimary ? "currentColor" : "none"} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeTank(index)}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {favTanks.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-xl">
                      登録された設定はありません
                    </div>
                  )}
                </div>

                {/* Add Tank Form */}
                <div className="pt-4 border-t border-gray-100">
                  <label className="block text-sm font-bold text-gray-700 mb-2">新しい設定を追加</label>
                  <div className="grid grid-cols-3 gap-2">
                    <select id="new-tank-mat" className="p-2 border rounded-lg text-sm">
                      <option value="steel">スチール</option>
                      <option value="aluminum">アルミ</option>
                    </select>
                    <div className="flex items-center">
                      <input id="new-tank-cap" type="number" defaultValue="10" className="w-full p-2 border rounded-l-lg text-sm" />
                      <span className="bg-gray-100 p-2 border-y border-r rounded-r-lg text-sm text-gray-500">L</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const matSelect = document.getElementById('new-tank-mat') as HTMLSelectElement;
                        const capInput = document.getElementById('new-tank-cap') as HTMLInputElement;
                        addTank(matSelect.value as any, Number(capInput.value));
                      }}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-bold transition-colors"
                    >
                      追加
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* --- SHOPS TAB --- */}
            {activeTab === 'shops' && (
              <div className="space-y-6">
                <div className="space-y-3">
                  {favShops.map((shop, index) => (
                    <div key={index} className={clsx(
                      "flex items-center justify-between p-3 rounded-xl border transition-all",
                      shop.isPrimary ? "bg-ocean-50 border-ocean-200 shadow-sm" : "bg-white border-gray-200"
                    )}>
                      <h4 className="font-bold text-gray-900 text-sm">{shop.name}</h4>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => togglePrimaryShop(shop.name)}
                          className={clsx(
                            "p-1.5 rounded-full transition-colors",
                            shop.isPrimary ? "text-yellow-400 bg-white shadow-sm" : "text-gray-300 hover:text-yellow-400"
                          )}
                        >
                          <Star size={18} fill={shop.isPrimary ? "currentColor" : "none"} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeShop(shop.name)}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <label className="block text-sm font-bold text-gray-700 mb-2">ショップ名を追加</label>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <input
                        id="new-shop-name"
                        type="text"
                        placeholder="ショップ名..."
                        className="w-full pl-4 pr-4 py-3 bg-white border border-gray-300 rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-ocean-200 focus:border-ocean outline-none h-[50px]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById('new-shop-name') as HTMLInputElement;
                        if (input.value) {
                          addShop(input.value);
                          input.value = '';
                        }
                      }}
                      className="bg-gray-50 text-ocean-600 border border-gray-200 px-4 py-3 rounded-lg font-bold text-sm hover:bg-ocean-50 hover:border-ocean-200 transition-colors h-[50px] flex items-center shadow-sm"
                    >
                      <Plus size={20} />
                      <span className="ml-1">登録</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

          </form>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-gray-500 hover:bg-gray-200 font-bold text-sm transition-colors"
          >
            キャンセル
          </button>
          <button
            type="submit"
            form="profile-form"
            className="px-6 py-2 rounded-lg bg-gray-50 text-ocean-600 border border-gray-200 hover:bg-ocean-50 hover:border-ocean-200 font-bold text-sm shadow-sm transition-all hover:translate-y-px"
          >
            保存する
          </button>
        </div>
      </div>
    </div>
  );
};
