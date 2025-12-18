import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ChevronLeft, Upload, Info, MapPin, Thermometer, Ruler, Sparkles, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import type { Creature } from '../types';
import { compressImage } from '../utils/imageUtils';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

export const AddCreaturePage = () => {
  const navigate = useNavigate();
  // Refactor: use points, creatures from context
  const { addCreature, points } = useApp();

  // Note: points are loaded from context
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isVerifiedAI, setIsVerifiedAI] = useState(false);
  const [groundingSources, setGroundingSources] = useState<string[]>([]);

  // Form State
  const [formData, setFormData] = useState<Partial<Creature> & {
    tagsInput: string;
    specialAttributesInput: string;
    // regionsInput: string; // Removed
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
    imageUrl: '/images/reef_fish.png',
    tagsInput: '',
    specialAttributesInput: '',
    // regionsInput: '',
    depthMin: '',
    depthMax: '',
    size: '',
    season: [],
    waterTempMin: '',
    waterTempMax: '',
    locationIds: [],
    status: 'pending',
  });

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Process inputs
      const tags = formData.tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      const specialAttributes = formData.specialAttributesInput.split(',').map(t => t.trim()).filter(Boolean);
      // const regions = formData.regionsInput.split(',').map(t => t.trim()).filter(Boolean);

      // Explicitly type the creature data
      const creatureData: Omit<Creature, 'id'> = {
        name: formData.name!,
        scientificName: formData.scientificName,
        category: formData.category!,
        description: formData.description!,
        rarity: formData.rarity!,
        imageUrl: formData.imageUrl!,
        tags,
        specialAttributes,
        // regions,
        size: formData.size,
        season: formData.season,
        locationIds: formData.locationIds,
        status: 'pending',
        depthRange: (formData.depthMin && formData.depthMax) ? {
          min: Number(formData.depthMin),
          max: Number(formData.depthMax)
        } : undefined,
        waterTempRange: (formData.waterTempMin && formData.waterTempMax) ? {
          min: Number(formData.waterTempMin),
          max: Number(formData.waterTempMax)
        } : undefined,
        gallery: [], // Mock gallery: should be string[]
        submitterId: 'current_user', // Mock submitter
        imageCredit: undefined,
        imageLicense: undefined,
        imageKeyword: undefined,
        stats: {
          popularity: 50,
          size: 50,
          danger: 10,
          lifespan: 50,
          rarity: 20,
          speed: 50
        }
      };

      addCreature(creatureData);
      alert('生物の登録申請が完了しました！');
      navigate('/');
    } catch (error) {
      console.error('Registration failed:', error);
      alert('登録に失敗しました。入力内容を確認してください。');
    }
  };

  const handleAIAutoFill = async () => {
    if (!formData.name?.trim()) return;
    setIsLoadingAI(true);
    setIsVerifiedAI(false);
    setGroundingSources([]);

    try {
      const generateCreatureDraft = httpsCallable(functions, 'generateCreatureDraft');
      const response = await generateCreatureDraft({ creatureName: formData.name });
      const aiResult = response.data as any;

      if (!aiResult) throw new Error("No data returned from AI");

      // Mapping Japanese labels to internal values
      const rarityMap: Record<string, Creature['rarity']> = {
        "Common (★1)": "Common",
        "Rare (★2)": "Rare",
        "Epic (★3)": "Epic",
        "Legendary (★4)": "Legendary"
      };

      const seasonMap: Record<string, string> = {
        "春": "spring",
        "夏": "summer",
        "秋": "autumn",
        "冬": "winter"
      };

      // Safe Merge
      setFormData(prev => ({
        ...prev,
        scientificName: aiResult.scientific_name || prev.scientificName,
        category: (aiResult.category as any) || prev.category,
        rarity: rarityMap[aiResult.rarity] || prev.rarity || "Common",
        description: aiResult.description || prev.description,
        size: aiResult.size || prev.size,
        depthMin: aiResult.depth_min ? String(aiResult.depth_min) : prev.depthMin,
        depthMax: aiResult.depth_max ? String(aiResult.depth_max) : prev.depthMax,
        season: aiResult.seasons ? aiResult.seasons.map((s: string) => seasonMap[s]).filter(Boolean) : prev.season,
        specialAttributesInput: (aiResult.special_traits || []).join(', '),
        waterTempMin: aiResult.temp_min ? String(aiResult.temp_min) : prev.waterTempMin,
        waterTempMax: aiResult.temp_max ? String(aiResult.temp_max) : prev.waterTempMax,
        tagsInput: (aiResult.search_tags || []).join(', ')
      }));

      if (aiResult.is_verified) {
        setIsVerifiedAI(true);
        setGroundingSources(aiResult.sources || []);
      }

    } catch (error) {
      console.error("AI Auto-fill failed:", error);
      alert("AIによる自動入力に失敗しました。");
    } finally {
      setIsLoadingAI(false);
    }
  };

  const VerifiedBadge = () => (
    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-50 text-[10px] font-bold text-green-700 border border-green-200 animate-fade-in shadow-sm">
      <Sparkles size={10} className="text-green-600" />
      Google Search 検証済み
    </div>
  );

  const GroundingSources = () => (
    <div className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-100 animate-fade-in">
      <div className="text-[10px] font-bold text-gray-500 mb-1 flex items-center gap-1">
        <Info size={10} /> 引用元ソース
      </div>
      <ul className="space-y-0.5">
        {groundingSources.map((source, i) => (
          <li key={i} className="text-[10px] text-blue-600 truncate hover:underline cursor-pointer">
            <a href={source} target="_blank" rel="noopener noreferrer">{source}</a>
          </li>
        ))}
      </ul>
    </div>
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
              <ChevronLeft size={24} />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">生物登録 (詳細)</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">

          {/* Basic Info */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Info size={20} className="text-blue-500" /> 基本情報
              </div>
              {isVerifiedAI && <VerifiedBadge />}
            </h2>
            {isVerifiedAI && groundingSources.length > 0 && <GroundingSources />}

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-sm font-bold text-gray-700">名前 <span className="text-red-500">*</span></label>
                    <button
                      type="button"
                      onClick={handleAIAutoFill}
                      disabled={!formData.name?.trim() || isLoadingAI}
                      className="flex items-center gap-1.5 text-xs font-bold text-slate-900 transition-all bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full hover:bg-slate-100 hover:border-slate-300 disabled:opacity-40 active:scale-95"
                    >
                      {isLoadingAI ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Sparkles size={13} />
                      )}
                      AIで自動入力
                    </button>
                  </div>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-white rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                    placeholder="例: ギンガメアジ"
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

              {/* Regions Input Removed */}
              {/*
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
              */}

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
                  ) : (
                    <>
                      <Upload size={32} className="mb-2" />
                      <span className="text-sm">画像をアップロード</span>
                      <span className="text-xs text-gray-300 mt-1">クリックしてファイルを選択</span>
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
                </div>
                {formData.imageUrl && !formData.imageUrl.startsWith('/images/') && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFormData(prev => ({ ...prev, imageUrl: '/images/reef_fish.png' }));
                    }}
                    className="text-xs text-red-500 mt-2 hover:underline"
                  >
                    画像を削除
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Submit */}
          <div className="flex justify-end gap-4 pt-4">
            <Link to="/" className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors">
              キャンセル
            </Link>
            <button
              type="submit"
              className="px-8 py-3 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-200 transition-all transform hover:-translate-y-0.5"
            >
              登録申請する
            </button>
          </div>

        </form>
      </main>
    </div>
  );
};
