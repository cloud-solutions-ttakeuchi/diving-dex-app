import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ChevronLeft, Upload, Info, MapPin, Thermometer, Ruler } from 'lucide-react';
import clsx from 'clsx';
import type { Creature } from '../types';
import { compressImage } from '../utils/imageUtils';

export const EditCreaturePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { creatures, points, updateCreature, addCreatureProposal, currentUser } = useApp();

  // Find existing creature
  const existingCreature = creatures.find(c => c.id === id);

  // Form State
  const [formData, setFormData] = useState<Partial<Creature> & {
    tagsInput: string;
    specialAttributesInput: string;
    regionsInput: string;
    depthMin: string;
    depthMax: string;
    waterTempMin: string;
    waterTempMax: string;
    season: string[];
    locationIds: string[];
  }>({
    name: '',
    scientificName: '',
    category: '魚類',
    description: '',
    rarity: 'Common',
    imageUrl: '',
    tagsInput: '',
    specialAttributesInput: '',
    regionsInput: '',
    depthMin: '',
    depthMax: '',
    size: '',
    season: [],
    waterTempMin: '',
    waterTempMax: '',
    locationIds: [],
  });

  // Load data into form when creature is found
  useEffect(() => {
    if (existingCreature) {
      setFormData({
        name: existingCreature.name,
        scientificName: existingCreature.scientificName || '',
        category: existingCreature.category,
        description: existingCreature.description,
        rarity: existingCreature.rarity,
        imageUrl: existingCreature.imageUrl,
        tagsInput: existingCreature.tags.join(', '),
        specialAttributesInput: existingCreature.specialAttributes ? existingCreature.specialAttributes.join(', ') : '',
        regionsInput: '',
        depthMin: existingCreature.depthRange?.min.toString() || '',
        depthMax: existingCreature.depthRange?.max.toString() || '',
        size: existingCreature.size || '',
        season: existingCreature.season || [],
        waterTempMin: existingCreature.waterTempRange?.min.toString() || '',
        waterTempMax: existingCreature.waterTempRange?.max.toString() || '',
        locationIds: existingCreature.locationIds || [],
      });
    }
  }, [existingCreature]);

  if (!existingCreature) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  const handleSeasonToggle = (season: string) => {
    setFormData(prev => {
      const newSeason = prev.season.includes(season)
        ? prev.season.filter(s => s !== season)
        : [...prev.season, season];
      return { ...prev, season: newSeason };
    });
  };

  const handleLocationToggle = (pointId: string) => {
    setFormData(prev => {
      const newLocations = prev.locationIds.includes(pointId)
        ? prev.locationIds.filter(id => id !== pointId)
        : [...prev.locationIds, pointId];
      return { ...prev, locationIds: newLocations };
    });
  };

  const getDiff = (current: any, original: any): any => {
    const diff: any = {};
    const keys = Object.keys(current);
    for (const key of keys) {
      // Very basic diff (JSON stringify comparison for arrays/objects)
      if (JSON.stringify(current[key]) !== JSON.stringify(original[key])) {
        diff[key] = current[key];
      }
    }
    return diff;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!id || !existingCreature) return;

    try {
      // Process inputs
      const tags = formData.tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      const specialAttributes = formData.specialAttributesInput.split(',').map(t => t.trim()).filter(Boolean);
      const regions = formData.regionsInput.split(',').map(t => t.trim()).filter(Boolean);

      // Create update object (Full state)
      const fullUpdateState: any = {
        name: formData.name,
        scientificName: formData.scientificName,
        category: formData.category,
        description: formData.description,
        rarity: formData.rarity,
        imageUrl: formData.imageUrl,
        tags,
        specialAttributes,
        regions,
        size: formData.size,
        season: formData.season,
        locationIds: formData.locationIds,
        depthRange: (formData.depthMin && formData.depthMax) ? {
          min: Number(formData.depthMin),
          max: Number(formData.depthMax)
        } : undefined,
        waterTempRange: (formData.waterTempMin && formData.waterTempMax) ? {
          min: Number(formData.waterTempMin),
          max: Number(formData.waterTempMax)
        } : undefined,
      };

      // Admin/Mod: Direct Update
      if (currentUser.role === 'admin' || currentUser.role === 'moderator') {
        const diff = getDiff(fullUpdateState, existingCreature);
        // Clean undefined
        Object.keys(diff).forEach(key => diff[key] === undefined && delete diff[key]);

        await updateCreature(id, fullUpdateState); // Or just diff? updateCreature handles merge.
        alert('生物情報を更新しました！');
        navigate(`/creature/${id}`);

      } else {
        // User: Proposal
        // Compare with existingCreature to generate diff
        // Note: existingCreature might have fields not in fullUpdateState, but we only care about fields in form.

        // We need to compare existingCreature properties with fullUpdateState
        const diff = getDiff(fullUpdateState, existingCreature);

        // Remove keys where value is effectively same (handled by getDiff) or fields that shouldn't be touched.
        // Also remove empty differences if any.

        if (Object.keys(diff).length === 0) {
          alert('変更点がありません。');
          return;
        }

        // Create description of changes for better UI in Admin Panel?
        // Admin Panel will just show diff.

        await addCreatureProposal({
          targetId: id,
          proposalType: 'update',
          diffData: diff,
          // Add some display meta if needed, but diff is enough.
          name: existingCreature.name, // Keep context
          imageUrl: existingCreature.imageUrl, // Context
        } as any);

        alert('編集提案を送信しました！管理者の承認をお待ちください。');
        navigate(`/creature/${id}`);
      }

    } catch (error) {
      console.error('Update/Proposal failed:', error);
      alert('処理に失敗しました。');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={`/creature/${id}`} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
              <ChevronLeft size={24} />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">生物情報の編集</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">

          {/* Basic Info */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2 flex items-center gap-2">
              <Info size={20} className="text-blue-500" /> 基本情報
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">名前 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="例: カクレクマノミ"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">学名</label>
                  <input
                    type="text"
                    name="scientificName"
                    value={formData.scientificName}
                    onChange={handleChange}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="例: Amphiprioninae"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">分類</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="魚類">魚類</option>
                    <option value="軟骨魚類">軟骨魚類</option>
                    <option value="爬虫類">爬虫類</option>
                    <option value="甲殻類">甲殻類</option>
                    <option value="軟体動物">軟体動物</option>
                    <option value="刺胞動物">刺胞動物</option>
                    <option value="哺乳類">哺乳類</option>
                    <option value="その他">その他</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">レアリティ</label>
                  <select
                    name="rarity"
                    value={formData.rarity}
                    onChange={handleChange}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="Common">Common (★1)</option>
                    <option value="Rare">Rare (★2)</option>
                    <option value="Epic">Epic (★3)</option>
                    <option value="Legendary">Legendary (★4)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">説明文 <span className="text-red-500">*</span></label>
                <textarea
                  name="description"
                  required
                  rows={3}
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>
            </div>
          </section>

          {/* Ecological Info */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2 flex items-center gap-2">
              <Ruler size={20} className="text-green-500" /> 生態・特徴
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">大きさ</label>
                  <input
                    type="text"
                    name="size"
                    value={formData.size}
                    onChange={handleChange}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                    placeholder="例: 10cm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">水深 (m)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      name="depthMin"
                      value={formData.depthMin}
                      onChange={handleChange}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                      placeholder="Min"
                    />
                    <span>~</span>
                    <input
                      type="number"
                      name="depthMax"
                      value={formData.depthMax}
                      onChange={handleChange}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                      placeholder="Max"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">見られる季節</label>
                <div className="flex gap-2 flex-wrap">
                  {['spring', 'summer', 'autumn', 'winter'].map(season => (
                    <button
                      key={season}
                      type="button"
                      onClick={() => handleSeasonToggle(season)}
                      className={clsx(
                        "px-4 py-2 rounded-full text-sm font-bold border transition-colors",
                        formData.season.includes(season)
                          ? "bg-green-500 text-white border-green-500"
                          : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                      )}
                    >
                      {season === 'spring' ? '春' : season === 'summer' ? '夏' : season === 'autumn' ? '秋' : '冬'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">特殊属性</label>
                <div className="flex flex-wrap gap-2">
                  {['毒', '擬態', '夜行性', '共生', '固有種', '群れ', '幼魚', '大物', 'レア', '危険'].map(attr => (
                    <label key={attr} className="inline-flex items-center gap-2 cursor-pointer bg-white border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.specialAttributesInput.split(',').map(s => s.trim()).includes(attr)}
                        onChange={(e) => {
                          const currentAttrs = formData.specialAttributesInput.split(',').map(s => s.trim()).filter(Boolean);
                          let newAttrs;
                          if (e.target.checked) {
                            newAttrs = [...currentAttrs, attr];
                          } else {
                            newAttrs = currentAttrs.filter(a => a !== attr);
                          }
                          setFormData(prev => ({ ...prev, specialAttributesInput: newAttrs.join(',') }));
                        }}
                        className="rounded text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{attr}</span>
                    </label>
                  ))}
                </div>
                <input
                  type="text"
                  name="specialAttributesInput"
                  value={formData.specialAttributesInput}
                  onChange={handleChange}
                  className="w-full mt-2 px-4 py-2 rounded-lg border border-gray-300 outline-none text-sm"
                  placeholder="その他 (カンマ区切りで入力)"
                />
              </div>
            </div>
          </section>

          {/* Environmental & Location */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2 flex items-center gap-2">
              <MapPin size={20} className="text-orange-500" /> 環境・生息地
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">適正水温 (℃)</label>
                <div className="flex items-center gap-2 max-w-xs">
                  <Thermometer size={18} className="text-gray-400" />
                  <input
                    type="number"
                    name="waterTempMin"
                    value={formData.waterTempMin}
                    onChange={handleChange}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                    placeholder="Min"
                  />
                  <span>~</span>
                  <input
                    type="number"
                    name="waterTempMax"
                    value={formData.waterTempMax}
                    onChange={handleChange}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                    placeholder="Max"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">広域エリア (カンマ区切り)</label>
                <input
                  type="text"
                  name="regionsInput"
                  value={formData.regionsInput}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                  placeholder="例: 慶良間, 伊豆, 沖縄本島"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">発見可能ポイント</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                  {points.map(point => (
                    <label key={point.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={formData.locationIds.includes(point.id)}
                        onChange={() => handleLocationToggle(point.id)}
                        className="rounded text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{point.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Tags & Images */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">その他</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">検索タグ (カンマ区切り)</label>
                <input
                  type="text"
                  name="tagsInput"
                  value={formData.tagsInput}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                  placeholder="例: オレンジ, しましま, 可愛い"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">画像</label>
                <div
                  className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors cursor-pointer relative overflow-hidden"
                  onClick={() => document.getElementById('image-upload')?.click()}
                >
                  {formData.imageUrl && !formData.imageUrl.startsWith('/images/') ? (
                    <img src={formData.imageUrl} alt="Preview" className="absolute inset-0 w-full h-full object-contain bg-gray-100" />
                  ) : formData.imageUrl ? (
                    <img src={formData.imageUrl} alt="Preview" className="absolute inset-0 w-full h-full object-contain bg-gray-100 opacity-50" />
                  ) : (
                    <>
                      <Upload size={32} className="mb-2" />
                      <span className="text-sm">画像をアップロード (変更する場合)</span>
                    </>
                  )}
                  <input
                    type="file"
                    id="image-upload"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const compressed = await compressImage(file);
                          setFormData(prev => ({ ...prev, imageUrl: compressed }));
                        } catch (error) {
                          console.error('Image compression failed:', error);
                          alert('画像の処理に失敗しました。');
                        }
                      }
                    }}
                  />
                  {/* Overlay text for existing image */}
                  {formData.imageUrl && (
                    <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded pointer-events-none">
                      基本画像設定中
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Submit */}
          <div className="flex justify-end gap-4 pt-4">
            <Link to={`/creature/${id}`} className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors">
              キャンセル
            </Link>
            <button
              type="submit"
              className="px-8 py-3 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-200 transition-all transform hover:-translate-y-0.5"
            >
              {(currentUser.role === 'admin' || currentUser.role === 'moderator') ? '更新する' : '変更を提案する'}
            </button>
          </div>

        </form>
      </main>
    </div>
  );
};
