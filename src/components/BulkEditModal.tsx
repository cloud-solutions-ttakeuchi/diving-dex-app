import React, { useState } from 'react';
import { X, Check, Info } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { HierarchicalPointSelector } from './HierarchicalPointSelector';

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  onSave: (data: Record<string, any>) => Promise<void>;
}

import { useLanguage } from '../context/LanguageContext';

export const BulkEditModal = ({ isOpen, onClose, selectedCount, onSave }: BulkEditModalProps) => {
  const { t } = useLanguage();
  const { points } = useApp(); // [NEW] Get points to look up name

  // Basic Info
  const [date, setDate] = useState('');
  const [privacy, setPrivacy] = useState<string>(''); // 'public' | 'private' | ''

  // Location
  const [shopName, setShopName] = useState('');
  const [pointId, setPointId] = useState(''); // [NEW]
  const [region, setRegion] = useState('');   // [NEW]
  const [zone, setZone] = useState('');       // [NEW]
  const [area, setArea] = useState('');       // [NEW]

  // Condtions
  const [weather, setWeather] = useState('');
  const [airTemp, setAirTemp] = useState('');
  const [waterTemp, setWaterTemp] = useState('');
  const [transparency, setTransparency] = useState('');
  const [wave, setWave] = useState('');
  const [current, setCurrent] = useState('');
  const [surge, setSurge] = useState('');

  // Gear
  const [suitType, setSuitType] = useState('');
  const [suitThickness, setSuitThickness] = useState('');
  const [weight, setWeight] = useState('');

  // Team
  const [buddy, setBuddy] = useState('');
  const [guide, setGuide] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setDate('');
      setPrivacy('');
      setShopName('');
      setPointId('');
      setRegion('');
      setZone('');
      setArea('');
      setWeather('');
      setAirTemp('');
      setWaterTemp('');
      setTransparency('');
      setWave('');
      setCurrent('');
      setSurge('');
      setSuitType('');
      setSuitThickness('');
      setWeight('');
      setBuddy('');
      setGuide('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Construct update data using dot notation for Firestore nested fields
    const updates: Record<string, any> = {};

    // Basic
    if (date) updates.date = date;
    if (privacy) updates.isPrivate = privacy === 'private';

    // Location
    if (shopName.trim()) updates['location.shopName'] = shopName;

    // Point Logic
    if (pointId) {
      updates['location.pointId'] = pointId;
      updates['spotId'] = pointId; // Sync spotId
      const p = points.find(pt => pt.id === pointId);
      if (p) {
        updates['location.pointName'] = p.name;
        // Also update hierarchy if point is selected
        updates['location.region'] = p.region;
        updates['location.zone'] = p.zone;
        updates['location.area'] = p.area;
      }
    } else {
      // If Point ID is NOT selected, but hierarchy is selected, update those
      if (region) updates['location.region'] = region;
      if (zone) updates['location.zone'] = zone;
      if (area) updates['location.area'] = area;
    }

    // Conditions
    if (weather) updates['condition.weather'] = weather;
    if (airTemp) updates['condition.airTemp'] = Number(airTemp);
    if (waterTemp) updates['condition.waterTemp.surface'] = Number(waterTemp); // Simplifying to surface for bulk
    if (transparency) updates['condition.transparency'] = Number(transparency);
    if (wave) updates['condition.wave'] = wave;
    if (current) updates['condition.current'] = current;
    if (surge) updates['condition.surge'] = surge;

    // Gear
    if (suitType) updates['gear.suitType'] = suitType;
    if (suitThickness) updates['gear.suitThickness'] = Number(suitThickness);
    if (weight) updates['gear.weight'] = Number(weight);

    // Team
    if (buddy.trim()) updates['team.buddy'] = buddy;
    if (guide.trim()) updates['team.guide'] = guide;

    try {
      if (Object.keys(updates).length > 0) {
        await onSave(updates);
      }
      onClose();
      // Reset form (simplified for now, ideally reset all independent states)
    } catch (error) {
      console.error("Bulk update failed", error);
      alert(t('bulk.failed' as any));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-white rounded-t-3xl z-10">
          <h2 className="text-xl font-bold text-deepBlue-900">
            {t('bulk.edit_title' as any)} ({selectedCount})
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
          {/* Info Alert */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-blue-800">
            <Info className="shrink-0" size={20} />
            <div className="text-sm">
              <p className="font-bold mb-1">{t('bulk.warning' as any)}</p>
              <p>{t('bulk.warning_desc' as any).replace('{{count}}', String(selectedCount))}</p>
            </div>
          </div>

          <form id="bulk-edit-form" onSubmit={handleSubmit} className="space-y-8">

            {/* Section: Basic Info */}
            <section className="space-y-4">
              <h3 className="text-lg font-bold text-gray-800 border-b pb-2">{t('bulk.basic_info' as any)}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">{t('bulk.date' as any)}</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-ocean-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">{t('bulk.privacy' as any)}</label>
                  <select value={privacy} onChange={e => setPrivacy(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-ocean-500 outline-none">
                    <option value="">{t('bulk.dont_change' as any)}</option>
                    <option value="public">{t('bulk.privacy_public' as any)}</option>
                    <option value="private">{t('bulk.privacy_private' as any)}</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Section: Location & Team */}
            <section className="space-y-4">
              <h3 className="text-lg font-bold text-gray-800 border-b pb-2">{t('bulk.location_team' as any)}</h3>

              {/* Hierarchical Point Selector */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <HierarchicalPointSelector
                  value={pointId}
                  onChange={setPointId}
                  onHierarchyChange={(r, z, a) => {
                    setRegion(r);
                    setZone(z);
                    setArea(a);
                  }}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">{t('bulk.shop' as any)}</label>
                  <input type="text" value={shopName} onChange={e => setShopName(e.target.value)} placeholder="..." className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-ocean-500 outline-none" />
                </div>
                {/* Removed manual Point Name input primarily, or we could keep it? Selector covers it. */}
                {/* <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">{t('bulk.point' as any)}</label>
                  <input type="text" value={pointName} onChange={e => setPointName(e.target.value)} placeholder="..." className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-ocean-500 outline-none" />
                </div> */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">{t('bulk.buddy' as any)}</label>
                  <input type="text" value={buddy} onChange={e => setBuddy(e.target.value)} placeholder="..." className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-ocean-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">{t('bulk.guide' as any)}</label>
                  <input type="text" value={guide} onChange={e => setGuide(e.target.value)} placeholder="..." className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-ocean-500 outline-none" />
                </div>
              </div>
            </section>

            {/* Section: Conditions */}
            <section className="space-y-4">
              <h3 className="text-lg font-bold text-gray-800 border-b pb-2">{t('bulk.conditions' as any)}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">{t('bulk.weather' as any)}</label>
                  <select value={weather} onChange={e => setWeather(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                    <option value="">-</option>
                    <option value="sunny">{t('option.sunny' as any)}</option>
                    <option value="cloudy">{t('option.cloudy' as any)}</option>
                    <option value="rainy">{t('option.rainy' as any)}</option>
                  </select>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">{t('bulk.wave' as any)}</label>
                  <select value={wave} onChange={e => setWave(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                    <option value="">-</option>
                    <option value="none">{t('option.none' as any)}</option>
                    <option value="low">{t('option.low' as any)}</option>
                    <option value="high">{t('option.high' as any)}</option>
                  </select>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">{t('bulk.current' as any)}</label>
                  <select value={current} onChange={e => setCurrent(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                    <option value="">-</option>
                    <option value="none">{t('option.none' as any)}</option>
                    <option value="weak">{t('option.weak' as any)}</option>
                    <option value="strong">{t('option.strong' as any)}</option>
                  </select>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">{t('bulk.surge' as any)}</label>
                  <select value={surge} onChange={e => setSurge(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                    <option value="">-</option>
                    <option value="none">{t('option.none' as any)}</option>
                    <option value="weak">{t('option.weak' as any)}</option>
                    <option value="strong">{t('option.strong' as any)}</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">{t('bulk.air_temp' as any)} (°C)</label>
                  <input type="number" value={airTemp} onChange={e => setAirTemp(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">{t('bulk.water_temp' as any)} (°C)</label>
                  <input type="number" value={waterTemp} onChange={e => setWaterTemp(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">{t('bulk.transparency' as any)} (m)</label>
                  <input type="number" value={transparency} onChange={e => setTransparency(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
                </div>
              </div>
            </section>

            {/* Section: Gear */}
            <section className="space-y-4">
              <h3 className="text-lg font-bold text-gray-800 border-b pb-2">{t('bulk.gear' as any)}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">{t('bulk.suit' as any)}</label>
                  <select value={suitType} onChange={e => setSuitType(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                    <option value="">-</option>
                    <option value="wet">{t('option.wet' as any)}</option>
                    <option value="dry">{t('option.dry' as any)}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">{t('bulk.suit_thickness' as any)}</label>
                  <input type="number" value={suitThickness} onChange={e => setSuitThickness(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">{t('bulk.weight' as any)}</label>
                  <input type="number" step="0.5" value={weight} onChange={e => setWeight(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
                </div>
              </div>
            </section>

          </form>
        </div>

        {/* Footer Buttons */}
        <div className="p-6 border-t border-gray-100 bg-white rounded-b-3xl z-10">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-gray-50 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              {t('bulk.cancel' as any)}
            </button>
            <button
              type="submit" // Changed to type="submit" to trigger form's onSubmit
              form="bulk-edit-form" // Associate with the form by ID
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 bg-gray-50 hover:bg-gray-100 text-ocean-600 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-ocean-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Check size={20} />
                  {t('bulk.update' as any)}
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
