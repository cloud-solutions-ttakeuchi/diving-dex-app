import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ChevronLeft, Calendar, Clock, ArrowDown, Sun, Fish, Camera, Users, Settings, Search, Check, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { DiveLog } from '../types';
import { compressImage } from '../utils/imageUtils';
import { HierarchicalPointSelector } from '../components/HierarchicalPointSelector';

interface LogFormData {
  title: string;
  date: string;
  diveNumber: string;
  pointId: string;
  shopName: string;
  region: string;
  zone: string;
  area: string;
  buddy: string;
  guide: string;
  members: string;
  entryTime: string;
  exitTime: string;
  maxDepth: string;
  avgDepth: string;
  weather: string;
  airTemp: string;
  waterTempSurface: string;
  waterTempBottom: string;
  transparency: string;
  wave: string;
  current: string;
  surge: string;
  suitType: string;
  suitThickness: string;
  weight: string;
  tankMaterial: string;
  tankCapacity: string;
  pressureStart: string;
  pressureEnd: string;
  entryType: string;
  creatureId: string;
  sightedCreatures: string[];
  comment: string;
  isPrivate: boolean;
  photos: string[];
}

export const AddLogPage = () => {
  const navigate = useNavigate();
  // Refactor: use points, creatures from context
  const { addLog, points, creatures, pointCreatures, isAuthenticated, currentUser } = useApp();

  // Note: points and creatures should be loaded in AppContext

  // Authentication check moved to render phase to avoiding conditional hooks
  const showAccessDenied = !isAuthenticated;

  // Help Popups
  const [activeHelp, setActiveHelp] = useState<string | null>(null);
  const toggleHelp = (key: string) => setActiveHelp(prev => prev === key ? null : key);

  // Form State
  const [formData, setFormData] = useState<LogFormData>({
    // Basic
    title: '',
    date: new Date().toISOString().split('T')[0],
    diveNumber: '',

    // Location (Final Point)
    pointId: '',
    shopName: '',
    // Hierarchical Selection State
    region: '',
    zone: '',
    area: '',

    // Team
    buddy: '',
    guide: '',
    members: '',

    // Dive Data
    entryTime: '10:00',
    exitTime: '10:45',
    maxDepth: '18',
    avgDepth: '12',

    // Conditions
    weather: 'sunny',
    airTemp: '25',
    waterTempSurface: '24',
    waterTempBottom: '22',
    transparency: '15',
    wave: 'none',
    current: 'none',
    surge: 'none',

    // Gear
    suitType: 'wet',
    suitThickness: '5',
    weight: '4',
    tankMaterial: 'steel',
    tankCapacity: '10',
    pressureStart: '200',
    pressureEnd: '50',

    // Style
    entryType: 'boat',

    // Content
    creatureId: '',
    sightedCreatures: [] as string[],
    comment: '',
    isPrivate: false,
    photos: [] as string[],
  });

  // Default Values from Favorites
  useEffect(() => {
    if (currentUser?.favorites) {
      // 1. Point Defaults
      const primaryPointId = currentUser.favorites.points?.find(p => p.isPrimary)?.id;
      if (primaryPointId && !formData.pointId) {
        const point = points.find(p => p.id === primaryPointId);
        if (point) {
          setFormData(prev => ({
            ...prev,
            pointId: point.id,
            region: point.region,
            zone: point.zone,
            area: point.area,
            shopName: prev.shopName || (currentUser.favorites.shops?.find(s => s.isPrimary)?.name || '')
          }));
        }
      } else if (!formData.shopName) {
        // Just Shop
        const primaryShop = currentUser.favorites.shops?.find(s => s.isPrimary)?.name;
        if (primaryShop) setFormData(prev => ({ ...prev, shopName: primaryShop }));
      }

      // 2. Gear Defaults
      const primaryTank = currentUser.favorites.gear?.tanks?.find(t => t.isPrimary);
      if (primaryTank && !formData.tankCapacity) { // Only if not set
        setFormData(prev => ({
          ...prev,
          tankMaterial: primaryTank.specs.material || 'steel',
          tankCapacity: primaryTank.specs.capacity?.toString() || '10',
        }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, points]); // Run once on load (deps ensure data is ready)

  // Creature Search State
  const [creatureSearchTerm, setCreatureSearchTerm] = useState('');

  // Filtered Creatures for "This Area"
  const areaCreatures = useMemo(() => {
    // If no location selected, show nothing or all?
    if (!formData.pointId && !formData.area && !formData.zone && !formData.region) return [];

    // Find all point IDs in the current scope
    let targetPointIds: string[] = [];
    if (formData.pointId) {
      targetPointIds = [formData.pointId];
    } else {
      // Filter points based on current hierarchy
      targetPointIds = points.filter(p =>
        (!formData.region || p.region === formData.region) &&
        (!formData.zone || p.zone === formData.zone) &&
        (!formData.area || p.area === formData.area)
      ).map(p => p.id);
    }

    // Find all creatures linked to these points
    const linkedCreatureIds = new Set(
      pointCreatures
        .filter(pc => targetPointIds.includes(pc.pointId) && pc.status === 'approved')
        .map(pc => pc.creatureId)
    );

    return creatures.filter(c => linkedCreatureIds.has(c.id));
  }, [formData.pointId, formData.area, formData.zone, formData.region, points, pointCreatures, creatures]);

  // Filtered Creatures for Search
  const searchResults = useMemo(() => {
    if (!creatureSearchTerm) return [];
    return creatures.filter(c =>
      c.name.includes(creatureSearchTerm) || c.scientificName?.includes(creatureSearchTerm) || c.tags?.some(tag => tag.includes(creatureSearchTerm))
    ).slice(0, 10); // Limit results
  }, [creatureSearchTerm, creatures]);


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

    try {
      // ... (existing code omitted for brevity in prompt, but replacing block)
      const selectedPoint = points.find(p => p.id === formData.pointId);
      const membersArray = formData.members.split(',').map(m => m.trim()).filter(Boolean);

      // Construct the DiveLog object
      const logData: Omit<DiveLog, 'id' | 'userId'> = {
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
        ...(formData.creatureId ? { creatureId: formData.creatureId } : {}),
        sightedCreatures: formData.sightedCreatures,
        comment: formData.comment,
        isPrivate: formData.isPrivate,
        photos: formData.photos,
        spotId: formData.pointId, // Legacy compatibility
        likeCount: 0,
        likedBy: [],
      };

      console.log("[AddLog] Adding log with:", logData);
      await addLog(logData);
      alert('ログが正常に保存されました！');
      navigate('/mypage');
    } catch (error) {
      console.error('Log registration failed:', error);
      alert('ログの保存に失敗しました。入力内容を確認してください。');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));

      // Auto-reset lower hierarchy when upper changes (Optional but good UX)
      if (name === 'region') {
        setFormData(prev => ({ ...prev, region: value, zone: '', area: '', pointId: '' }));
      } else if (name === 'zone') {
        setFormData(prev => ({ ...prev, zone: value, area: '', pointId: '' }));
      } else if (name === 'area') {
        setFormData(prev => ({ ...prev, area: value, pointId: '' }));
      }
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

  // Accordion State
  const [openSections, setOpenSections] = useState({
    basic: true,
    location: true,
    data: true,
    conditions: false,
    gear: false,
    content: true
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (showAccessDenied) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center max-w-sm w-full">
          <h2 className="text-xl font-bold text-gray-900 mb-2">ログインが必要です</h2>
          <p className="text-gray-500 mb-6">ログを登録するにはログインしてください。</p>
          <Link to="/" className="block w-full py-3 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors">
            トップページへ戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
              <ChevronLeft size={24} />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">ログ登録 (詳細)</h1>
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
            <div className="space-y-4">
              {/* Hierarchical Location Selector */}
              <div className="space-y-4">
                <HierarchicalPointSelector
                  value={formData.pointId}
                  onChange={(pointId) => setFormData(prev => ({ ...prev, pointId }))}
                  onHierarchyChange={(region, zone, area) => {
                    setFormData(prev => ({ ...prev, region, zone, area }));
                  }}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
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
            <div className="space-y-6">

              {/* Sighted Creatures Selection */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">見た生物を選択</label>

                {/* 1. Area/Point Creatures (Thumbnails) */}
                {areaCreatures.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-2 font-bold">このエリアの生物</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {areaCreatures.map(c => {
                        const isSelected = formData.sightedCreatures.includes(c.id);
                        return (
                          <button
                            type="button"
                            key={c.id}
                            onClick={() => handleSightedCreatureToggle(c.id)}
                            className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${isSelected ? 'border-green-500 ring-2 ring-green-200' : 'border-gray-100 hover:border-gray-300'
                              }`}
                          >
                            <img src={c.imageUrl || '/images/no-image-creature.png'} alt={c.name} className="w-full h-full object-cover" />
                            <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1">
                              <p className="text-[10px] text-white font-bold truncate text-center">{c.name}</p>
                            </div>
                            {isSelected && (
                              <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full p-0.5">
                                <Check size={12} />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. Search for others */}
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                  <p className="text-xs text-gray-500 mb-2 font-bold">その他の生物を検索</p>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="生物名を入力..."
                      value={creatureSearchTerm}
                      onChange={e => setCreatureSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  {/* Search Results */}
                  {creatureSearchTerm && (
                    <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                      {searchResults.map(c => {
                        const isSelected = formData.sightedCreatures.includes(c.id);
                        return (
                          <button
                            type="button"
                            key={c.id}
                            onClick={() => handleSightedCreatureToggle(c.id)}
                            className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${isSelected ? 'bg-green-50 border border-green-200' : 'bg-white hover:bg-gray-100'
                              }`}
                          >
                            <img src={c.imageUrl || '/images/no-image-creature.png'} className="w-8 h-8 rounded object-cover bg-gray-200" />
                            <span className={`text-sm font-bold flex-1 ${isSelected ? 'text-green-700' : 'text-gray-700'}`}>{c.name}</span>
                            {isSelected && <Check size={16} className="text-green-600" />}
                          </button>
                        );
                      })}
                      {searchResults.length === 0 && <p className="text-center text-xs text-gray-400 py-2">見つかりませんでした</p>}
                    </div>
                  )}
                </div>


                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="block text-sm font-medium text-gray-700">メインの生物</label>
                    <button type="button" onClick={() => toggleHelp('mainCreature')} className="text-gray-400 hover:text-blue-500 transition-colors">
                      <Info size={16} />
                    </button>
                  </div>
                  {activeHelp === 'mainCreature' && (
                    <div className="bg-blue-50 text-blue-800 text-xs p-2 rounded-lg mb-2 animate-fade-in text-left">
                      ※写真が登録されていない場合、この生物の画像がログ一覧の紹介画像（サムネイル）として使用されます
                    </div>
                  )}
                  <select
                    name="creatureId"
                    value={formData.creatureId}
                    onChange={handleChange}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                  >
                    <option value="">選択なし</option>
                    {/* Scope to Sighted + Area creatures */}
                    {Array.from(new Set([...formData.sightedCreatures, ...areaCreatures.map(c => c.id)])).map(id => {
                      const c = creatures.find(x => x.id === id);
                      if (!c) return null;
                      return <option key={c.id} value={c.id}>{c.name}</option>;
                    })}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">※「見た生物」またはエリア内の生物から選択できます</p>
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
            </div>
          </AccordionSection>

          {/* Submit */}
          <div className="flex justify-end gap-4 pt-4">
            <Link to="/" className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors">
              キャンセル
            </Link>
            <button
              type="submit"
              className="px-8 py-3 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-200 transition-all transform hover:-translate-y-0.5"
            >
              ログを保存
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
