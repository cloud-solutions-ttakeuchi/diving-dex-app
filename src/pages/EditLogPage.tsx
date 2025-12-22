import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ChevronLeft, Calendar, Clock, ArrowDown, Sun, Fish, Camera, Users, Settings, Search, Check, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import type { DiveLog } from '../types';
import { compressImage } from '../utils/imageUtils';
import { HierarchicalPointSelector } from '../components/HierarchicalPointSelector';
import { SearchableCreatureSelector } from '../components/SearchableCreatureSelector';

export const EditLogPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // Refactor: use points, creatures, logs from context
  const { logs, updateLog, points, creatures, pointCreatures, isAuthenticated, regions, zones, areas } = useApp();

  // Note: logs in context are currentUser.logs. If editing a shared log, this might fail if not in currentUser's logs.
  // Assuming editing only own logs for now.

  const [formData, setFormData] = useState({
    // Basic
    title: '',
    date: '',
    diveNumber: '',

    // Location
    pointId: '',
    shopName: '',
    region: '',

    // Team
    buddy: '',
    guide: '',
    members: '',

    // Dive Data
    entryTime: '',
    exitTime: '',
    maxDepth: '',
    avgDepth: '',

    // Conditions
    weather: 'sunny',
    airTemp: '',
    waterTempSurface: '',
    waterTempBottom: '',
    transparency: '',
    wave: 'none',
    current: 'none',
    surge: 'none',

    // Gear
    suitType: 'wet',
    suitThickness: '',
    weight: '',
    tankMaterial: 'steel',
    tankCapacity: '',
    pressureStart: '',
    pressureEnd: '',

    // Style
    entryType: 'boat',

    // Content
    creatureId: '',
    sightedCreatures: [] as string[],
    comment: '',
    isPrivate: false,
    photos: [] as string[],
  });

  // Accordion State
  const [openSections, setOpenSections] = useState({
    basic: true,
    location: true,
    data: true,
    conditions: false,
    gear: false,
    content: true
  });

  useEffect(() => {
    if (!id) return;

    if (!isAuthenticated) return;

    // Refactor: find log from context logs
    const log = logs.find(l => l.id === id);
    if (!log) {
      // If not found in context logs, it might be loading or truly not exists.
      // For now, assume if authenticated and logs loaded, it should be there.
      // We could add a check for isLoading from context if needed.
      if (logs.length > 0) { // Only alert if logs are loaded
        alert('ログが見つかりません');
        navigate('/mypage');
      }
      return;
    }

    // eslint-disable-next-line
    setFormData({
      title: log.title || '',
      date: log.date,
      diveNumber: String(log.diveNumber),
      pointId: log.location.pointId || '',
      shopName: log.location.shopName || '',
      region: log.location.region || '',
      buddy: log.team?.buddy || '',
      guide: log.team?.guide || '',
      members: log.team?.members?.join(', ') || '',
      entryTime: log.time.entry || '',
      exitTime: log.time.exit || '',
      maxDepth: String(log.depth.max || ''),
      avgDepth: String(log.depth.average || ''),
      weather: log.condition?.weather || 'sunny',
      airTemp: String(log.condition?.airTemp || ''),
      waterTempSurface: String(log.condition?.waterTemp?.surface || ''),
      waterTempBottom: String(log.condition?.waterTemp?.bottom || ''),
      transparency: String(log.condition?.transparency || ''),
      wave: log.condition?.wave || 'none',
      current: log.condition?.current || 'none',
      surge: log.condition?.surge || 'none',
      suitType: log.gear?.suitType || 'wet',
      suitThickness: String(log.gear?.suitThickness || ''),
      weight: String(log.gear?.weight || ''),
      tankMaterial: log.gear?.tank?.material || 'steel',
      tankCapacity: String(log.gear?.tank?.capacity || ''),
      pressureStart: String(log.gear?.tank?.pressureStart || ''),
      pressureEnd: String(log.gear?.tank?.pressureEnd || ''),
      entryType: log.entryType || 'boat',
      creatureId: log.creatureId || '',
      sightedCreatures: log.sightedCreatures || [],
      comment: log.comment || '',
      isPrivate: log.isPrivate || false,
      photos: log.photos || [],
    });
  }, [id, isAuthenticated, logs, navigate]);

  // Creature Search State
  const [creatureSearchTerm, setCreatureSearchTerm] = useState('');

  // Derived Selections for Hierarchy (Simplified for Edit Page linkage)
  // We need to filter area creatures based on current point.

  // Filtered Creatures for "This Area"
  const areaCreatures = useMemo(() => {
    if (!formData.pointId) return [];

    // Find all creatures linked to this point
    const linkedCreatureIds = new Set(
      pointCreatures
        .filter(pc => pc.pointId === formData.pointId && pc.status === 'approved')
        .map(pc => pc.creatureId)
    );

    return creatures.filter(c => linkedCreatureIds.has(c.id));
  }, [formData.pointId, pointCreatures, creatures]);

  // Filtered Creatures for Search
  const searchResults = useMemo(() => {
    if (!creatureSearchTerm) return [];
    return creatures.filter(c =>
      c.name.includes(creatureSearchTerm) || c.scientificName?.includes(creatureSearchTerm) || c.tags?.some(tag => tag.includes(creatureSearchTerm))
    ).slice(0, 10); // Limit results
  }, [creatureSearchTerm, creatures]);

  // Help Popups
  const [activeHelp, setActiveHelp] = useState<string | null>(null);
  const toggleHelp = (key: string) => setActiveHelp(prev => prev === key ? null : key);

  const handleSightedCreatureToggle = (creatureId: string) => {
    setFormData(prev => {
      const newSighted = prev.sightedCreatures.includes(creatureId)
        ? prev.sightedCreatures.filter(id => id !== creatureId)
        : [...prev.sightedCreatures, creatureId];
      return { ...prev, sightedCreatures: newSighted };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    try {
      const selectedPoint = points.find(p => p.id === formData.pointId);
      const membersArray = formData.members.split(',').map(m => m.trim()).filter(Boolean);

      const logData: Partial<DiveLog> = {
        title: formData.title,
        date: formData.date,
        diveNumber: Number(formData.diveNumber),
        location: {
          pointId: formData.pointId,
          pointName: selectedPoint?.name || 'Unknown',
          region: formData.region,
          shopName: formData.shopName,
        },
        team: {
          buddy: formData.buddy,
          guide: formData.guide,
          members: membersArray,
        },
        time: {
          entry: formData.entryTime,
          exit: formData.exitTime,
          duration: 45, // Should calculate diff
        },
        depth: {
          max: Number(formData.maxDepth),
          average: Number(formData.avgDepth),
        },
        condition: {
          weather: formData.weather as any,
          airTemp: Number(formData.airTemp),
          waterTemp: {
            surface: Number(formData.waterTempSurface),
            bottom: Number(formData.waterTempBottom),
          },
          transparency: Number(formData.transparency),
          wave: formData.wave as any,
          current: formData.current as any,
          surge: formData.surge as any,
        },
        gear: {
          suitType: formData.suitType as any,
          suitThickness: Number(formData.suitThickness),
          weight: Number(formData.weight),
          tank: {
            material: formData.tankMaterial as any,
            capacity: Number(formData.tankCapacity),
            pressureStart: Number(formData.pressureStart),
            pressureEnd: Number(formData.pressureEnd),
          }
        },
        entryType: formData.entryType as any,
        creatureId: formData.creatureId || '', // Use empty string instead of undefined
        sightedCreatures: formData.sightedCreatures,
        comment: formData.comment || '',
        isPrivate: formData.isPrivate,
        photos: formData.photos,
        spotId: formData.pointId, // Legacy compatibility
      };

      console.log("[EditLog] Updating log with:", logData);

      await updateLog(id, logData);
      alert('ログが正常に更新されました！');
      navigate('/mypage');
    } catch (error) {
      console.error('Log update failed:', error);
      alert('ログの更新に失敗しました。入力内容を確認してください。');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    try {
      const compressedImages = await Promise.all(
        files.map(file => compressImage(file))
      );

      setFormData(prev => ({
        ...prev,
        photos: [...prev.photos, ...compressedImages]
      }));
    } catch (error) {
      console.error('Image compression failed:', error);
      alert('画像の処理に失敗しました。');
    }
  };

  const removePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };



  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/mypage" className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
              <ChevronLeft size={24} />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">ログ編集</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Basic Info */}
          <AccordionSection
            title="基本情報"
            icon={Calendar}
            colorClass="text-blue-500"
            isOpen={openSections.basic}
            onToggle={() => toggleSection('basic')}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">タイトル</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                  placeholder="例: 青の洞窟でのんびりダイブ"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">日付</label>
                <input
                  type="date"
                  name="date"
                  required
                  value={formData.date}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">本数 (Dive No.)</label>
                <input
                  type="number"
                  name="diveNumber"
                  value={formData.diveNumber}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                  placeholder="例: 100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">エントリータイプ</label>
                <select
                  name="entryType"
                  value={formData.entryType}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                >
                  <option value="boat">ボート</option>
                  <option value="beach">ビーチ</option>
                </select>
              </div>
            </div>
          </AccordionSection>

          {/* Location & Team */}
          <AccordionSection
            title="場所・チーム"
            icon={Users}
            colorClass="text-purple-500"
            isOpen={openSections.location}
            onToggle={() => toggleSection('location')}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ポイント</label>
                <div className="mb-2">
                  <HierarchicalPointSelector
                    value={formData.pointId}
                    onChange={(pointId) => setFormData(prev => ({ ...prev, pointId }))}
                    onHierarchyChange={(regionId, zoneId, areaId) => {
                      const r = regions.find(x => x.id === regionId)?.name || '';
                      const z = zones.find(x => x.id === zoneId)?.name || '';
                      const a = areas.find(x => x.id === areaId)?.name || '';
                      setFormData(prev => ({ ...prev, region: r, zone: z, area: a }));
                    }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ショップ名</label>
                <input
                  type="text"
                  name="shopName"
                  value={formData.shopName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ガイド</label>
                <input
                  type="text"
                  name="guide"
                  value={formData.guide}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">バディ</label>
                <input
                  type="text"
                  name="buddy"
                  value={formData.buddy}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">その他のメンバー</label>
                <input
                  type="text"
                  name="members"
                  value={formData.members}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                  placeholder="カンマ区切り (例: Aさん, Bさん)"
                />
              </div>
            </div>
          </AccordionSection>

          {/* Dive Data */}
          <AccordionSection
            title="ダイブデータ"
            icon={Clock}
            colorClass="text-green-500"
            isOpen={openSections.data}
            onToggle={() => toggleSection('data')}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IN</label>
                <input
                  type="time"
                  name="entryTime"
                  value={formData.entryTime}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">OUT</label>
                <input
                  type="time"
                  name="exitTime"
                  value={formData.exitTime}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
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
                <label className="block text-sm font-medium text-gray-700 mb-1">平均水深 (m)</label>
                <input
                  type="number"
                  name="avgDepth"
                  value={formData.avgDepth}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
            </div>
          </AccordionSection>

          {/* Conditions */}
          <AccordionSection
            title="コンディション"
            icon={Sun}
            colorClass="text-orange-500"
            isOpen={openSections.conditions}
            onToggle={() => toggleSection('conditions')}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">天気</label>
                <select
                  name="weather"
                  value={formData.weather}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                >
                  <option value="sunny">晴れ</option>
                  <option value="cloudy">曇り</option>
                  <option value="rainy">雨</option>
                  <option value="stormy">嵐</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">気温 (℃)</label>
                <input
                  type="number"
                  name="airTemp"
                  value={formData.airTemp}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">水温 (水面)</label>
                <input
                  type="number"
                  name="waterTempSurface"
                  value={formData.waterTempSurface}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">水温 (水底)</label>
                <input
                  type="number"
                  name="waterTempBottom"
                  value={formData.waterTempBottom}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">透明度 (m)</label>
                <input
                  type="number"
                  name="transparency"
                  value={formData.transparency}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">波</label>
                <select name="wave" value={formData.wave} onChange={handleChange} className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none">
                  <option value="none">なし</option>
                  <option value="low">低い</option>
                  <option value="high">高い</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">流れ</label>
                <select name="current" value={formData.current} onChange={handleChange} className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none">
                  <option value="none">なし</option>
                  <option value="weak">弱い</option>
                  <option value="strong">強い</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">うねり</label>
                <select name="surge" value={formData.surge} onChange={handleChange} className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none">
                  <option value="none">なし</option>
                  <option value="weak">弱い</option>
                  <option value="strong">強い</option>
                </select>
              </div>
            </div>
          </AccordionSection>

          {/* Gear */}
          <AccordionSection
            title="器材・タンク"
            icon={Settings}
            colorClass="text-gray-500"
            isOpen={openSections.gear}
            onToggle={() => toggleSection('gear')}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">スーツ</label>
                <select name="suitType" value={formData.suitType} onChange={handleChange} className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none">
                  <option value="wet">ウェット</option>
                  <option value="dry">ドライ</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">厚さ (mm)</label>
                <input
                  type="number"
                  name="suitThickness"
                  value={formData.suitThickness}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ウェイト (kg)</label>
                <input
                  type="number"
                  name="weight"
                  value={formData.weight}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">タンク</label>
                <select name="tankMaterial" value={formData.tankMaterial} onChange={handleChange} className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none">
                  <option value="steel">スチール</option>
                  <option value="aluminum">アルミ</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">タンク容量 (L)</label>
                <input
                  type="number"
                  name="tankCapacity"
                  value={formData.tankCapacity}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">開始圧 (bar)</label>
                <input
                  type="number"
                  name="pressureStart"
                  value={formData.pressureStart}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">終了圧 (bar)</label>
                <input
                  type="number"
                  name="pressureEnd"
                  value={formData.pressureEnd}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
            </div>
          </AccordionSection>

          {/* Content */}
          <AccordionSection
            title="生物・コメント"
            icon={Fish}
            colorClass="text-red-500"
            isOpen={openSections.content}
            onToggle={() => toggleSection('content')}
          >
            <div className="space-y-4">
              {/* Sighted Creatures Selection */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">見た生物を選択</label>

                {/* 2. Modern Searchable Selector */}
                <SearchableCreatureSelector
                  value={formData.creatureId}
                  onChange={(id) => setFormData(prev => ({ ...prev, creatureId: id }))}
                  label="TARGET CREATURE (MAIN)"
                  className="mb-6"
                />

                {/* 3. Multi-select (Sighted Creatures) */}
                <div className="bg-gray-50/50 p-6 rounded-3xl border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-4 ml-1 flex items-center justify-between">
                    SIGHTED CREATURES (COLLECTION)
                    <span className="text-ocean">{formData.sightedCreatures.length} selected</span>
                  </p>

                  {areaCreatures.length > 0 && (
                    <div className="mb-6">
                      <p className="text-[10px] text-gray-400 mb-2 font-bold ml-1 italic">Suggested for this area:</p>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {areaCreatures.slice(0, 10).map(c => {
                          const isSelected = formData.sightedCreatures.includes(c.id);
                          return (
                            <button
                              type="button"
                              key={c.id}
                              onClick={() => handleSightedCreatureToggle(c.id)}
                              className={clsx(
                                "relative aspect-square rounded-2xl overflow-hidden border-2 transition-all group",
                                isSelected ? "border-green-500 ring-4 ring-green-100" : "border-white hover:border-gray-200"
                              )}
                            >
                              <img src={c.imageUrl || '/images/no-image-creature.png'} alt={c.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                              <div className="absolute inset-x-0 bottom-0 bg-black/40 backdrop-blur-[2px] p-1">
                                <p className="text-[8px] text-white font-black truncate text-center uppercase tracking-tighter">{c.name}</p>
                              </div>
                              {isSelected && (
                                <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full p-0.5 shadow-lg">
                                  <Check size={10} strokeWidth={4} />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="relative group">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-ocean transition-colors" />
                    <input
                      type="text"
                      placeholder="他の生物を追加..."
                      value={creatureSearchTerm}
                      onChange={e => setCreatureSearchTerm(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-gray-700 outline-none focus:border-ocean focus:ring-4 focus:ring-ocean-50/50 transition-all"
                    />
                  </div>

                  {creatureSearchTerm && (
                    <div className="mt-3 space-y-1 max-h-60 overflow-y-auto scrollbar-hide">
                      {searchResults.map(c => {
                        const isSelected = formData.sightedCreatures.includes(c.id);
                        return (
                          <button
                            type="button"
                            key={c.id}
                            onClick={() => handleSightedCreatureToggle(c.id)}
                            className={clsx(
                              "w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all border",
                              isSelected ? "bg-green-50 border-green-200" : "bg-white border-transparent hover:bg-gray-100"
                            )}
                          >
                            <img src={c.imageUrl || '/images/no-image-creature.png'} className="w-10 h-10 rounded-xl object-cover bg-gray-100" />
                            <div className="flex-1">
                              <p className={clsx("text-sm font-black", isSelected ? "text-green-700" : "text-gray-700")}>{c.name}</p>
                              <p className="text-[10px] text-gray-400 font-bold uppercase">{c.category}</p>
                            </div>
                            {isSelected && <Check size={18} className="text-green-600" strokeWidth={3} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>


              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">コメント</label>
                <textarea
                  name="comment"
                  rows={3}
                  value={formData.comment}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none resize-none"
                  placeholder="ログの感想やメモ..."
                />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="block text-sm font-medium text-gray-700">写真</label>
                  <button type="button" onClick={() => toggleHelp('photo')} className="text-gray-400 hover:text-blue-500 transition-colors">
                    <Info size={16} />
                  </button>
                </div>
                {activeHelp === 'photo' && (
                  <div className="bg-blue-50 text-blue-800 text-xs p-2 rounded-lg mb-2 animate-fade-in text-left">
                    ※1枚目の写真がログ一覧の紹介画像（サムネイル）として使用されます
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Upload Button */}
                  <div
                    className="aspect-square border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => document.getElementById('log-photos-upload')?.click()}
                  >
                    <Camera size={24} className="mb-1" />
                    <span className="text-xs">写真を追加</span>
                    <input
                      type="file"
                      id="log-photos-upload"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </div>
                  {/* Photo Previews */}
                  {formData.photos.map((photo, index) => (
                    <div key={index} className="aspect-square rounded-xl overflow-hidden relative group">
                      <img src={photo} alt={`Log photo ${index + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ArrowDown size={12} className="rotate-45" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="isPrivate"
                    checked={formData.isPrivate}
                    onChange={handleChange}
                    id="isPrivate"
                    className="rounded text-blue-500 focus:ring-blue-500"
                  />
                  <label htmlFor="isPrivate" className="text-sm font-bold text-gray-700">非公開にする</label>
                  <button type="button" onClick={() => toggleHelp('private')} className="text-gray-400 hover:text-blue-500 transition-colors">
                    <Info size={16} />
                  </button>
                </div>
                {activeHelp === 'private' && (
                  <div className="bg-blue-50 text-blue-800 text-xs p-2 rounded-lg mt-2 animate-fade-in leading-relaxed text-left">
                    チェックを入れると自分専用のログになります。<br />
                    公開する場合、「チーム情報」と「ショップ情報」以外のデータが他のユーザーにも公開されます。
                  </div>
                )}
              </div>
            </div>
          </AccordionSection>

          {/* Submit */}
          <div className="flex justify-end gap-4 pt-4">
            <Link to="/mypage" className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors">
              キャンセル
            </Link>
            <button
              type="submit"
              className="px-8 py-3 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-200 transition-all transform hover:-translate-y-0.5"
            >
              ログを更新
            </button>
          </div>

        </form>
      </main>
    </div>
  );
};

const AccordionSection = ({
  title,
  icon: Icon,
  isOpen,
  onToggle,
  children,
  colorClass = "text-gray-500"
}: {
  title: string;
  icon: any;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  colorClass?: string;
}) => (
  <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
    <button
      type="button"
      onClick={onToggle}
      className="w-full px-6 py-4 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center gap-2">
        <Icon size={20} className={colorClass} />
        <span className="text-lg font-bold text-gray-900">{title}</span>
      </div>
      <ChevronLeft size={20} className={`text-gray-400 transition-transform duration-200 ${isOpen ? '-rotate-90' : ''}`} />
    </button>

    <div className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
      <div className="p-6 border-t border-gray-100">
        {children}
      </div>
    </div>
  </section>
);
