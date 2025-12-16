import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Edit2, Trash2, Save, X, Search, Plus, Filter, Fish, CheckSquare, Square, MapPin, Link2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { writeBatch, collection, getDocs, query, where, doc, updateDoc, deleteDoc, addDoc, arrayRemove } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Creature, Rarity } from '../types';

export const AdminCreatureCleansingPage = () => {
  const { creatures, points, currentUser, addPointCreature, removePointCreature } = useApp();
  const navigate = useNavigate();

  // States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRarity, setFilterRarity] = useState<'ALL' | Rarity>('ALL');
  const [filterFamily, setFilterFamily] = useState('ALL');
  const [processing, setProcessing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Location Management State
  const [managingCreature, setManagingCreature] = useState<Creature | null>(null);
  const [linkedPointIds, setLinkedPointIds] = useState<string[]>([]);
  const [isLoadingLinks, setIsLoadingLinks] = useState(false);
  const [locationSearchTerm, setLocationSearchTerm] = useState('');

  // Edit Form States
  const [editForm, setEditForm] = useState<Partial<Creature>>({});

  // Auth Check
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') {
      navigate('/');
    }
  }, [currentUser, navigate]);

  // Derived Data
  const families = useMemo(() => {
    const s = new Set(creatures.map(c => c.family).filter(Boolean));
    return Array.from(s).sort();
  }, [creatures]);

  const filteredCreatures = useMemo(() => {
    return creatures.filter(c => {
      const matchSearch = (
        c.name.includes(searchTerm) ||
        (c.englishName && c.englishName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.scientificName && c.scientificName.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      const matchRarity = filterRarity === 'ALL' || c.rarity === filterRarity;
      const matchFamily = filterFamily === 'ALL' || c.family === filterFamily;
      return matchSearch && matchRarity && matchFamily;
    }).sort((a, b) => a.id.localeCompare(b.id));
  }, [creatures, searchTerm, filterRarity, filterFamily]);

  // Helper: Cleanup User Data (Favorites/Wanted)
  const cleanupUserReferences = async (creatureId: string) => {
    // Note: This operation can be heavy if many users exist.
    // In strict production, this should be a Cloud Function triggered by deletion.
    const batch = writeBatch(db);
    let count = 0;

    // 1. Remove from Favorites
    const qFav = query(collection(db, 'users'), where('favoriteCreatureIds', 'array-contains', creatureId));
    const snapFav = await getDocs(qFav);
    snapFav.forEach(doc => {
      batch.update(doc.ref, { favoriteCreatureIds: arrayRemove(creatureId) });
      count++;
    });

    // 2. Remove from Wanted
    const qWant = query(collection(db, 'users'), where('wanted', 'array-contains', creatureId));
    const snapWant = await getDocs(qWant);
    snapWant.forEach(doc => {
      batch.update(doc.ref, { wanted: arrayRemove(creatureId) });
      count++;
    });

    if (count > 0) {
      await batch.commit();
      console.log(`[Cleanup] Removed references from ${count} users for creature ${creatureId}`);
    }
  };

  // Bulk Handlers
  const handleToggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredCreatures.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCreatures.map(c => c.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`【警告】\n\n選択した ${selectedIds.size} 件の生物データを削除しますか？\n\nこれに関連する point_creatures やユーザーのお気に入り/WANTEDリストからも削除されます。\nこの操作は取り消せません。`)) return;

    setProcessing(true);
    try {
      const batchLimit = 500;
      let batch = writeBatch(db);
      let opCount = 0;

      for (const id of Array.from(selectedIds)) {
        // 1. Delete Creature
        batch.delete(doc(db, 'creatures', id));
        opCount++;

        // 2. Find PointCreatures
        // Note: In a real bulk scenario, this query inside loop is bad.
        // But for admin tool with limited selection, it mimics granular safety.
        // For better performance, we'd query all PCs with 'in' operator (chunks of 10).
        const q = query(collection(db, 'point_creatures'), where('creatureId', '==', id));
        const snaps = await getDocs(q);
        snaps.forEach(pcDoc => {
          batch.delete(pcDoc.ref);
          opCount++;
        });

        // 3. User Data Cleanup (Separate Await)
        await cleanupUserReferences(id);

        if (opCount >= batchLimit) {
          await batch.commit();
          batch = writeBatch(db);
          opCount = 0;
        }
      }

      if (opCount > 0) {
        await batch.commit();
      }

      alert('一括削除が完了しました。');
      setSelectedIds(new Set());
      alert('一括削除が完了しました。');
      setSelectedIds(new Set());
    } catch (e: any) {
      console.error(e);
      alert('エラー: ' + e.message);
    } finally {
      setProcessing(false);
    }
  };

  // Location Management Handlers
  const openLocationModal = async (creature: Creature) => {
    setManagingCreature(creature);
    setIsLoadingLinks(true);
    try {
      const q = query(collection(db, 'point_creatures'), where('creatureId', '==', creature.id));
      const snap = await getDocs(q);
      const linked = snap.docs.map(d => d.data().pointId);
      setLinkedPointIds(linked);
    } catch (e) {
      console.error(e);
      alert('読み込みエラー');
    } finally {
      setIsLoadingLinks(false);
    }
  };

  const toggleLocationLink = async (pointId: string) => {
    if (!managingCreature) return;
    const isLinked = linkedPointIds.includes(pointId);

    try {
      if (isLinked) {
        // Use context method (handles composite ID internally)
        await removePointCreature(pointId, managingCreature.id);
        setLinkedPointIds(prev => prev.filter(id => id !== pointId));
      } else {
        // Add with context method
        // Use creature's global rarity as default local rarity
        await addPointCreature(pointId, managingCreature.id, managingCreature.rarity);
        setLinkedPointIds(prev => [...prev, pointId]);
      }
    } catch (e: any) {
      alert('更新エラー: ' + e.message);
    }
  };

  // Single Edit Handlers
  const handleEdit = (creature: Creature) => {
    setEditingId(creature.id);
    setEditForm({ ...creature });
  };

  const handleSave = async () => {
    if (!editingId || !editForm) return;
    if (!window.confirm(`「${editForm.name}」の内容を保存しますか？`)) return;

    setProcessing(true);
    try {
      const ref = doc(db, 'creatures', editingId);
      await updateDoc(ref, {
        ...editForm,
      });
      alert('保存しました。');
    } catch (e: any) {
      console.error(e);
      alert('エラー: ' + e.message);
    } finally {
      setProcessing(false);
      setEditingId(null);
    }
  };

  const handleDelete = async (creature: Creature) => {
    if (!window.confirm(`【警告】\n\n「${creature.name}」を削除しますか？\n\n※この生物が登録されているログやポイント紐付け(point_creatures)も影響を受ける可能性があります。`)) return;

    setProcessing(true);
    try {
      await deleteDoc(doc(db, 'creatures', creature.id));
      const q = query(collection(db, 'point_creatures'), where('creatureId', '==', creature.id));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      // 3. User Data Cleanup
      await cleanupUserReferences(creature.id);

      alert('削除しました。');
      alert('削除しました。');
    } catch (e: any) {
      console.error(e);
      alert('エラー: ' + e.message);
    } finally {
      setProcessing(false);
    }
  };

  if (!currentUser || currentUser.role !== 'admin') return null;

  return (
    <div className="max-w-[1280px] mx-auto px-4 py-8 relative">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/mypage')} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-full text-purple-600">
              <Fish size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">生物図鑑データ管理</h1>
              <p className="text-sm text-gray-500">Master Data Management: Creatures ({creatures.length} records)</p>
            </div>
          </div>
        </div>
        {selectedIds.size > 0 && (
          <button
            onClick={handleBulkDelete}
            disabled={processing}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-sm transition-all"
          >
            <Trash2 size={18} />
            Delete Selected ({selectedIds.size})
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-bold text-gray-500 mb-1 block">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
              placeholder="Name, English, Scientific..."
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 mb-1 block">Rarity</label>
          <select
            value={filterRarity}
            onChange={e => setFilterRarity(e.target.value as any)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
          >
            <option value="ALL">All Rarities</option>
            <option value="Common">Common</option>
            <option value="Rare">Rare</option>
            <option value="Epic">Epic</option>
            <option value="Legendary">Legendary</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 mb-1 block">Family</label>
          <select
            value={filterFamily}
            onChange={e => setFilterFamily(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm max-w-[200px]"
          >
            <option value="ALL">All Families</option>
            {families.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div className="pb-0.5">
          <span className="text-sm font-bold text-gray-500">Found: {filteredCreatures.length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3 w-[50px]">
                  <button onClick={handleSelectAll} className="text-gray-400 hover:text-gray-600">
                    {selectedIds.size > 0 && selectedIds.size === filteredCreatures.length ? (
                      <CheckSquare size={20} />
                    ) : (
                      <Square size={20} />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3">Image</th>
                <th className="px-6 py-3">ID / Name</th>
                <th className="px-6 py-3">Scientific / English</th>
                <th className="px-6 py-3">Family / Rarity</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCreatures.map(creature => {
                const isEditing = editingId === creature.id;
                const isSelected = selectedIds.has(creature.id);
                return (
                  <tr key={creature.id} className={`transition-colors ${isSelected ? 'bg-blue-50/50' : 'hover:bg-gray-50/50'}`}>
                    <td className="px-6 py-4">
                      <button onClick={() => handleToggleSelect(creature.id)} className={`${isSelected ? 'text-blue-500' : 'text-gray-300 hover:text-gray-400'}`}>
                        {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                      </button>
                    </td>
                    <td className="px-6 py-4 w-[100px]">
                      <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden relative border border-gray-200">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.imageUrl}
                            onChange={e => setEditForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                            className="absolute inset-0 w-full h-full text-xs p-1"
                            placeholder="URL"
                          />
                        ) : (
                          creature.imageUrl ? (
                            <img
                              src={creature.imageUrl}
                              alt={creature.name}
                              className="w-full h-full object-cover"
                              onError={e => (e.currentTarget.src = '/images/no-image-creature.png')}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-50">
                              <img src="/images/no-image-creature.png" alt="No Image" className="w-full h-full object-cover opacity-50" />
                            </div>
                          )
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {isEditing ? (
                        <div className="flex flex-col gap-2">
                          <span className="text-xs text-gray-400 font-mono">{creature.id}</span>
                          <input
                            className="border rounded px-2 py-1 text-sm font-bold"
                            value={editForm.name}
                            onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-900">{creature.name}</span>
                          <span className="text-xs text-gray-400 font-mono">{creature.id}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {isEditing ? (
                        <div className="flex flex-col gap-2">
                          <input
                            className="border rounded px-2 py-1 text-xs"
                            placeholder="Scientific"
                            value={editForm.scientificName || ''}
                            onChange={e => setEditForm(prev => ({ ...prev, scientificName: e.target.value }))}
                          />
                          <input
                            className="border rounded px-2 py-1 text-xs"
                            placeholder="English"
                            value={editForm.englishName || ''}
                            onChange={e => setEditForm(prev => ({ ...prev, englishName: e.target.value }))}
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-700 italic">{creature.scientificName}</span>
                          <span className="text-xs text-gray-500">{creature.englishName}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {isEditing ? (
                        <div className="flex flex-col gap-2">
                          <input
                            className="border rounded px-2 py-1 text-xs"
                            value={editForm.family || ''}
                            onChange={e => setEditForm(prev => ({ ...prev, family: e.target.value }))}
                          />
                          <select
                            className="border rounded px-2 py-1 text-xs"
                            value={editForm.rarity}
                            onChange={e => setEditForm(prev => ({ ...prev, rarity: e.target.value as Rarity }))}
                          >
                            <option value="Common">Common</option>
                            <option value="Rare">Rare</option>
                            <option value="Epic">Epic</option>
                            <option value="Legendary">Legendary</option>
                          </select>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600 w-fit">{creature.family}</span>
                          <span className={`text-xs px-2 py-0.5 rounded w-fit font-bold
                              ${creature.rarity === 'Common' ? 'bg-blue-50 text-blue-600' :
                              creature.rarity === 'Rare' ? 'bg-green-50 text-green-600' :
                                creature.rarity === 'Epic' ? 'bg-purple-50 text-purple-600' :
                                  'bg-orange-50 text-orange-600'
                            }`}>
                            {creature.rarity}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openLocationModal(creature)}
                          className="p-2 text-gray-400 hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-colors"
                          title="Manage Locations"
                        >
                          <MapPin size={18} />
                        </button>
                        {isEditing ? (
                          <>
                            <button
                              onClick={handleSave}
                              disabled={processing}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            >
                              <Save size={18} />
                            </button>
                            <button
                              onClick={() => { setEditingId(null); setEditForm({}); }}
                              disabled={processing}
                              className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <X size={18} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleEdit(creature)}
                              className="p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button
                              onClick={() => handleDelete(creature)}
                              className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredCreatures.length === 0 && (
            <div className="p-12 text-center text-gray-400">
              No creatures found matching criteria.
            </div>
          )}
        </div>
      </div>

      {/* Location Management Modal */}
      {managingCreature && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50 rounded-t-xl">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-white border border-gray-200 p-1">
                  <img src={managingCreature.imageUrl} className="w-full h-full object-cover rounded-full" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">{managingCreature.name}</h2>
                  <p className="text-xs text-gray-500">Manage Locations (point_creatures)</p>
                </div>
              </div>
              <button onClick={() => setManagingCreature(null)} className="p-2 hover:bg-gray-200 rounded-full">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {isLoadingLinks ? (
                <div className="text-center py-8">Loading links...</div>
              ) : (
                <div className="flex flex-col gap-6">
                  {/* Current Links */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      <MapPin size={16} /> Linked Points ({linkedPointIds.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {linkedPointIds.map(pid => {
                        const point = points.find(p => p.id === pid);
                        return (
                          <div key={pid} className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-sm border border-blue-100">
                            <Link2 size={12} />
                            <span>{point ? point.name : pid}</span>
                            <button onClick={() => toggleLocationLink(pid)} className="hover:text-red-500 ml-1">
                              <X size={14} />
                            </button>
                          </div>
                        )
                      })}
                      {linkedPointIds.length === 0 && (
                        <p className="text-sm text-gray-400 italic">No locations linked.</p>
                      )}
                    </div>
                  </div>

                  {/* Add Link */}
                  <div className="border-t border-gray-100 pt-6">
                    <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      <Plus size={16} /> Add Location
                    </h3>
                    <input
                      type="text"
                      placeholder="Search points to add..."
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm mb-3"
                      value={locationSearchTerm}
                      onChange={e => setLocationSearchTerm(e.target.value)}
                    />
                    <div className="max-h-[200px] overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
                      {points
                        .filter(p => !linkedPointIds.includes(p.id))
                        .filter(p => locationSearchTerm && p.name.includes(locationSearchTerm))
                        .slice(0, 50)
                        .map(p => (
                          <button
                            key={p.id}
                            onClick={() => toggleLocationLink(p.id)}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between group"
                          >
                            <span>{p.name}</span>
                            <span className="text-xs text-gray-400 group-hover:text-green-600">+ Add</span>
                          </button>
                        ))
                      }
                      {!locationSearchTerm && <p className="p-4 text-xs text-gray-400 text-center">Type to search points...</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
