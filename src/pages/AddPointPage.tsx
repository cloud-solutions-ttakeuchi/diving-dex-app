import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ChevronLeft, MapPin, Camera, Info, Anchor, Mountain } from 'lucide-react';
import { compressImage } from '../utils/imageUtils';
import type { Point } from '../types';

export const AddPointPage = () => {
  const navigate = useNavigate();
  const { addPoint, isAuthenticated } = useApp();

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center max-w-sm w-full">
          <h2 className="text-xl font-bold text-gray-900 mb-2">ログインが必要です</h2>
          <p className="text-gray-500 mb-6">ポイントを登録するにはログインしてください。</p>
          <Link to="/" className="block w-full py-3 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors">
            トップページへ戻る
          </Link>
        </div>
      </div>
    );
  }

  const [formData, setFormData] = useState({
    name: '',
    region: '日本',
    zone: '沖縄本島',
    area: '恩納村',
    level: 'Beginner',
    maxDepth: '15',
    entryType: 'boat',
    current: 'none',
    topography: [] as string[],
    description: '',
    features: '',
    lat: '',
    lng: '',
    images: [] as string[],
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTopographyChange = (type: string) => {
    setFormData(prev => {
      const newTopography = prev.topography.includes(type)
        ? prev.topography.filter(t => t !== type)
        : [...prev.topography, type];
      return { ...prev, topography: newTopography };
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    try {
      const compressedImages = await Promise.all(
        files.map(file => compressImage(file))
      );
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...compressedImages]
      }));
    } catch (error) {
      console.error('Image compression failed:', error);
      alert('画像の処理に失敗しました。');
    }
  };

  const removePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const pointData: Omit<Point, 'id'> = {
        name: formData.name,
        areaId: 'temp_area_id', // Placeholder or logic to find/create area
        region: formData.region,
        zone: formData.zone,
        area: formData.area,
        level: formData.level as any,
        maxDepth: Number(formData.maxDepth),
        entryType: formData.entryType as any,
        current: formData.current as any,
        topography: formData.topography,
        description: formData.description,
        features: formData.features.split(',').map(f => f.trim()).filter(Boolean),
        coordinates: (formData.lat && formData.lng) ? {
          lat: Number(formData.lat),
          lng: Number(formData.lng)
        } : undefined,
        status: 'pending',
        submitterId: 'current_user',
        createdAt: new Date().toISOString(),
        images: formData.images,
        imageUrl: formData.images[0] || '/images/seascape.png',
        /* creatures: [] removed */
        bookmarkCount: 0
      };

      addPoint(pointData);
      alert('ポイントの登録申請が完了しました！');
      navigate('/');
    } catch (error) {
      console.error('Point registration failed:', error);
      alert('登録に失敗しました。入力内容を確認してください。');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
              <ChevronLeft size={24} />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">ポイント登録申請</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Basic Info */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
              <MapPin size={20} className="text-blue-500" /> 基本情報
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ポイント名</label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例: 秘密のビーチ"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">国・地域 (Region)</label>
                <input
                  type="text"
                  name="region"
                  value={formData.region}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">エリア (Zone)</label>
                <input
                  type="text"
                  name="zone"
                  value={formData.zone}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">地区 (Area)</label>
                <input
                  type="text"
                  name="area"
                  value={formData.area}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
            </div>
          </section>

          {/* Attributes */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
              <Info size={20} className="text-purple-500" /> 特徴・レベル
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">レベル</label>
                <select name="level" value={formData.level} onChange={handleChange} className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none">
                  <option value="Beginner">初級</option>
                  <option value="Intermediate">中級</option>
                  <option value="Advanced">上級</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">最大水深 (m)</label>
                <input
                  type="number"
                  name="maxDepth"
                  value={formData.maxDepth}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">エントリー</label>
                <select name="entryType" value={formData.entryType} onChange={handleChange} className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none">
                  <option value="beach">ビーチ</option>
                  <option value="boat">ボート</option>
                  <option value="entry_easy">エントリー容易</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">流れ</label>
                <select name="current" value={formData.current} onChange={handleChange} className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none">
                  <option value="none">なし</option>
                  <option value="weak">弱</option>
                  <option value="strong">強</option>
                  <option value="drift">ドリフト必須</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">地形 (複数選択可)</label>
              <div className="flex flex-wrap gap-2">
                {['sand', 'rock', 'dropoff', 'cave', 'muck', 'coral'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleTopographyChange(type)}
                    className={`px-3 py-1 rounded-full text-sm border ${formData.topography.includes(type)
                      ? 'bg-blue-100 border-blue-500 text-blue-700'
                      : 'bg-white border-gray-300 text-gray-600'
                      }`}
                  >
                    {type === 'sand' ? '砂地' : type === 'rock' ? '岩場' : type === 'dropoff' ? 'ドロップオフ' : type === 'cave' ? '洞窟' : type === 'muck' ? '泥地' : 'サンゴ'}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Details */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
              <Mountain size={20} className="text-green-500" /> 詳細情報
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
              <textarea
                name="description"
                rows={4}
                value={formData.description}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none resize-none"
                placeholder="ポイントの魅力や特徴を入力してください..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">特徴タグ (カンマ区切り)</label>
              <input
                type="text"
                name="features"
                value={formData.features}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                placeholder="例: カメが見れる, 光が綺麗, マクロ派向け"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">緯度 (Latitude)</label>
                <input
                  type="number"
                  step="any"
                  name="lat"
                  value={formData.lat}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">経度 (Longitude)</label>
                <input
                  type="number"
                  step="any"
                  name="lng"
                  value={formData.lng}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
            </div>
          </section>

          {/* Photos */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
              <Camera size={20} className="text-gray-500" /> 写真
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div
                className="aspect-square border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => document.getElementById('point-photos-upload')?.click()}
              >
                <Camera size={24} className="mb-1" />
                <span className="text-xs">写真を追加</span>
                <input
                  type="file"
                  id="point-photos-upload"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </div>
              {formData.images.map((photo, index) => (
                <div key={index} className="aspect-square rounded-xl overflow-hidden relative group">
                  <img src={photo} alt={`Point photo ${index + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Anchor size={12} className="rotate-45" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <div className="flex justify-end gap-4 pt-4">
            <Link to="/" className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors">
              キャンセル
            </Link>
            <button
              type="submit"
              className="px-8 py-3 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-200 transition-all transform hover:-translate-y-0.5"
            >
              ポイントを登録
            </button>
          </div>

        </form>
      </main>
    </div>
  );
};
