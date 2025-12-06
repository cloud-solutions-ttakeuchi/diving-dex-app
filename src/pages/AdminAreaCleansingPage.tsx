import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Edit2, Trash2, Save, X, RefreshCw, Layers, Map as MapIcon, Globe, MapPin, ChevronDown, ChevronUp, AlertTriangle, GitMerge } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { writeBatch, collection, getDocs, query, where, doc, updateDoc, arrayRemove, arrayUnion, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Point } from '../types';

type TargetField = 'area' | 'zone' | 'region' | 'point';

export const AdminAreaCleansingPage = () => {
  const { points, currentUser } = useApp();
  const navigate = useNavigate();
  const [targetField, setTargetField] = useState<TargetField>('area');
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [newValue, setNewValue] = useState('');
  const [processing, setProcessing] = useState(false);

  // For Point Details
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [editingPointId, setEditingPointId] = useState<string | null>(null);
  const [newPointName, setNewPointName] = useState('');

  // Merge Modal State
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [mergeSource, setMergeSource] = useState<Point | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState('');

  // 1. Aggregate Stats based on Target Field with Parent Info
  const fieldStats = useMemo(() => {
    // Map stores: name -> { count, parents: Set<string>, points: Point[] }
    const stats = new Map<string, { count: number, parents: Set<string>, points: Point[] }>();

    points.forEach(p => {
      // Determine field value and parent value
      let val = '';
      let parentVal = '';

      if (targetField === 'point') {
        val = p.name;
        parentVal = p.area; // Parent of Point is Area
      } else if (targetField === 'area') {
        val = p.area;
        parentVal = p.zone; // Parent of Area is Zone
      } else if (targetField === 'zone') {
        val = p.zone;
        parentVal = p.region; // Parent of Zone is Region
      } else {
        val = p.region;
        // Region has no parent display in this context
      }

      val = val || '(Empty)';
      parentVal = parentVal || '(Empty)';

      if (!stats.has(val)) {
        stats.set(val, { count: 0, parents: new Set(), points: [] });
      }
      const item = stats.get(val)!;
      item.count++;
      item.points.push(p);
      // Only track parent if it exists and is meaningful
      if (targetField !== 'region' && parentVal !== '(Empty)') {
        item.parents.add(parentVal);
      }
    });

    // Convert to array and sort
    return Array.from(stats.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        parents: Array.from(data.parents).sort(),
        points: data.points
      }))
      .sort((a, b) => b.count - a.count); // Most frequent first
  }, [points, targetField]);

  // Admin Check
  if (currentUser.role !== 'admin' && currentUser.role !== 'moderator') {
    return <div className="p-8 text-center">Access Denied. Admins Only.</div>;
  }

  // Operation: Rename Group (Merge)
  const handleRenameGroup = async (currentVal: string) => {
    if (!newValue.trim() || newValue === currentVal) return;
    const label = getLabel();

    const confirmMsg = targetField === 'point'
      ? `【注意】「${currentVal}」という名前のすべてのポイント（${fieldStats.find(a => a.name === currentVal)?.count}件）を「${newValue}」にリネームします。\nIDは維持されますが、名前が統一されます。\n本当によろしいですか？`
      : `本当に${label}「${currentVal}」を「${newValue}」に変更しますか？\n対象のポイント数: ${fieldStats.find(a => a.name === currentVal)?.count}`;

    if (!window.confirm(confirmMsg)) return;

    setProcessing(true);
    try {
      if (currentVal === '(Empty)') {
        alert('Cannot rename the empty placeholder.');
        return;
      }

      // Query field: if point, we look for 'name'. Others match targetField value directly.
      const queryField = targetField === 'point' ? 'name' : targetField;

      const q = query(collection(db, 'points'), where(queryField, '==', currentVal));
      const snapshot = await getDocs(q);

      const batch = writeBatch(db);
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { [queryField]: newValue.trim() });
      });

      await batch.commit();
      alert(`完了: ${snapshot.size} 件のポイントを更新しました。`);
      setEditingValue(null);
      setNewValue('');
    } catch (e) {
      console.error(e);
      alert('更新に失敗しました。');
    } finally {
      setProcessing(false);
    }
  };

  // Operation: Rename Individual Point
  const handleRenamePoint = async (pointId: string, currentName: string) => {
    if (!newPointName.trim() || newPointName === currentName) return;

    if (!window.confirm(`このポイントの名前を「${currentName}」から「${newPointName}」に変更しますか？`)) return;

    setProcessing(true);
    try {
      const pointRef = doc(db, 'points', pointId);
      await updateDoc(pointRef, { name: newPointName.trim() });

      alert('ポイント名を更新しました。');
      setEditingPointId(null);
      setNewPointName('');
    } catch (e) {
      console.error(e);
      alert('更新に失敗しました。');
    } finally {
      setProcessing(false);
    }
  };

  // Helper: Chunk array into batches of 500
  const chunkArray = <T,>(array: T[], size: number): T[][] => {
    const chunked: T[][] = [];
    let index = 0;
    while (index < array.length) {
      chunked.push(array.slice(index, index + size));
      index += size;
    }
    return chunked;
  };

  // Operation: Merge Points
  const handleMergePoints = async () => {
    if (!mergeSource || !mergeTargetId) return;
    if (mergeSource.id === mergeTargetId) {
      alert('Source and Target cannot be the same.');
      return;
    }

    if (!window.confirm(`【重要】ポイントの統合 (MERGE) を実行します。\n\nSource (削除): ${mergeSource.name} (ID: ...${mergeSource.id.slice(-6)})\nTarget (存続): ID ...${mergeTargetId.slice(-6)}\n\n・生物情報の紐付けを移動（重複はマージ）\n・ログのポイントIDを書き換え\n・お気に入りを移動\n・Wantedリストを移動(ある場合)\n・Sourceを削除\n\n本当によろしいですか？`)) return;

    setProcessing(true);
    try {
      // 0. Verify Target Exists
      const targetQuery = query(collection(db, 'points'), where('__name__', '==', mergeTargetId));
      const targetDocSnap = await getDocs(targetQuery);
      if (targetDocSnap.empty) {
        alert('ターゲットとなるポイントが見つかりません。IDを確認してください。');
        setProcessing(false);
        return;
      }
      const targetPoint = targetDocSnap.docs[0].data() as Point;

      // 1. PointCreatures Migration
      const sourcePCs = await getDocs(query(collection(db, 'point_creatures'), where('pointId', '==', mergeSource.id)));
      const targetPCs = await getDocs(query(collection(db, 'point_creatures'), where('pointId', '==', mergeTargetId)));
      const targetCreatureIds = new Set(targetPCs.docs.map(d => d.data().creatureId));

      let pcMigrated = 0;
      let pcDeleted = 0;
      const pcBatch = writeBatch(db);

      sourcePCs.docs.forEach(pDoc => {
        const data = pDoc.data();
        if (targetCreatureIds.has(data.creatureId)) {
          // Collision: Target prevails, delete Source Link
          pcBatch.delete(pDoc.ref);
          pcDeleted++;
        } else {
          // No Collision: Move to Target (Create with new ID)
          const newId = `${mergeTargetId}_${data.creatureId}`;
          const newRef = doc(db, 'point_creatures', newId);
          pcBatch.set(newRef, { ...data, pointId: mergeTargetId, id: newId });
          pcBatch.delete(pDoc.ref);
          pcMigrated++;
        }
      });

      // 2. Logs Migration
      const logsSnapshot = await getDocs(query(collection(db, 'logs'), where('location.pointId', '==', mergeSource.id)));
      const logUpdates = logsSnapshot.docs.map(d => ({ ref: d.ref, data: { 'location.pointId': mergeTargetId, 'location.pointName': targetPoint.name } }));

      // 3. Users Bookmarks Migration
      const usersBookmarkSnapshot = await getDocs(query(collection(db, 'users'), where('bookmarkedPointIds', 'array-contains', mergeSource.id)));
      const userBookmarkUpdates = usersBookmarkSnapshot.docs.map(d => ({ ref: d.ref, remove: mergeSource.id, add: mergeTargetId, field: 'bookmarkedPointIds' }));

      // 4. Users Wanted Migration (As requested, checking if Point ID exists in 'wanted')
      const usersWantedSnapshot = await getDocs(query(collection(db, 'users'), where('wanted', 'array-contains', mergeSource.id)));
      const userWantedUpdates = usersWantedSnapshot.docs.map(d => ({ ref: d.ref, remove: mergeSource.id, add: mergeTargetId, field: 'wanted' }));


      // --- EXECUTION PHASE ---
      // We will execute in stages to avoid batch limits.

      // Stage A: Point Creatures (already built in pcBatch, assuming < 500 for now. If huge, we risk it, but usually PC per point is < 100)
      if (sourcePCs.size > 0) {
        await pcBatch.commit();
      }

      // Stage B: Logs (Chunked)
      const logChunks = chunkArray(logUpdates, 450); // Safe margin
      for (const chunk of logChunks) {
        const batch = writeBatch(db);
        chunk.forEach(item => batch.update(item.ref, item.data));
        await batch.commit();
      }

      // Stage C: Users Bookmarks (Chunked)
      const userBookmarkChunks = chunkArray(userBookmarkUpdates, 450);
      for (const chunk of userBookmarkChunks) {
        const batch = writeBatch(db);
        chunk.forEach(item => {
          batch.update(item.ref, { [item.field]: arrayRemove(item.remove) });
          batch.update(item.ref, { [item.field]: arrayUnion(item.add) });
        });
        await batch.commit();
      }

      // Stage D: Users Wanted (Chunked)
      const userWantedChunks = chunkArray(userWantedUpdates, 450);
      for (const chunk of userWantedChunks) {
        const batch = writeBatch(db);
        chunk.forEach(item => {
          batch.update(item.ref, { [item.field]: arrayRemove(item.remove) });
          batch.update(item.ref, { [item.field]: arrayUnion(item.add) });
        });
        await batch.commit();
      }

      // Stage E: Delete Source Point
      await deleteDoc(doc(db, 'points', mergeSource.id));

      alert(`統合完了:\n- 生物情報: 移行 ${pcMigrated}件\n- ログ更新: ${logsSnapshot.size}件\n- お気に入り更新: ${usersBookmarkSnapshot.size}件\n- Wanted更新: ${usersWantedSnapshot.size}件\n\nソースポイントを削除しました。`);

      setMergeModalOpen(false);
      setMergeSource(null);
      setMergeTargetId('');
      setEditingValue(null); // Refresh list view effectively
    } catch (e) {
      console.error(e);
      alert('統合処理中にエラーが発生しました。詳細: ' + e);
    } finally {
      setProcessing(false);
    }
  };

  // Helper: Add cascade delete operations to a batch (or execute immediately if too complex)
  // Note: For simplicity and safety in this Admin tool, we will execute cascade deletes
  // as separate operations or small batches per point to ensure we capture everything.
  const deletePointCascade = async (pointId: string) => {
    // 1. Find and delete related PointCreatures
    const pcQuery = query(collection(db, 'point_creatures'), where('pointId', '==', pointId));
    const pcSnapshot = await getDocs(pcQuery);

    // 2. Find and update Users who bookmarked this point
    const userBookmarkQuery = query(collection(db, 'users'), where('bookmarkedPointIds', 'array-contains', pointId));
    const userBookmarkSnapshot = await getDocs(userBookmarkQuery);

    // 3. Find and update Users who have this point in wanted list
    const userWantedQuery = query(collection(db, 'users'), where('wanted', 'array-contains', pointId));
    const userWantedSnapshot = await getDocs(userWantedQuery);

    const batch = writeBatch(db);

    // Delete PointCreatures
    pcSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Update Users (Bookmarks)
    userBookmarkSnapshot.docs.forEach(uDoc => {
      batch.update(uDoc.ref, {
        bookmarkedPointIds: arrayRemove(pointId)
      });
    });

    // Update Users (Wanted)
    userWantedSnapshot.docs.forEach(uDoc => {
      batch.update(uDoc.ref, {
        wanted: arrayRemove(pointId)
      });
    });

    // Delete the Point itself
    batch.delete(doc(db, 'points', pointId));

    await batch.commit();
    return {
      pcCount: pcSnapshot.size,
      userCount: userBookmarkSnapshot.size + userWantedSnapshot.size,
      details: {
        bookmarks: userBookmarkSnapshot.size,
        wanted: userWantedSnapshot.size
      }
    };
  };

  // Operation: Clear Group (Delete or Unset)
  const handleClearGroup = async (targetVal: string) => {
    if (targetVal === '(Empty)') return;
    const label = getLabel();
    const isPointMode = targetField === 'point';

    const msg = isPointMode
      ? `【危険】ポイント「${targetVal}」を含むすべてのドキュメント（${fieldStats.find(a => a.name === targetVal)?.count}件）を完全に削除しますか？\n警告：IDの異なる同名のポイントも全て削除されます。\n\n※関連する「生物紐付け」や「お気に入り」も同時に削除されます。`
      : `${label}「${targetVal}」を削除しますか？\n（ポイント自体は削除されず、${label}情報のみがクリアされます）`;

    if (!window.confirm(msg)) return;

    setProcessing(true);
    try {
      const queryField = targetField === 'point' ? 'name' : targetField;
      const q = query(collection(db, 'points'), where(queryField, '==', targetVal));
      const snapshot = await getDocs(q);

      if (isPointMode) {
        // Cascade Delete for EACH point
        // Execute sequentially to reliability
        let totalPc = 0;
        let totalUser = 0;

        for (const doc of snapshot.docs) {
          const res = await deletePointCascade(doc.id);
          totalPc += res.pcCount;
          totalUser += res.userCount;
        }

        alert(`完了: ${snapshot.size} 件のポイントデータを削除しました。\n(関連削除: 生物紐付け=${totalPc}件, お気に入り解除=${totalUser}件)`);
      } else {
        // Clear field (Standard batch update)
        const batch = writeBatch(db);
        snapshot.docs.forEach(doc => {
          batch.update(doc.ref, { [targetField]: '' });
        });
        await batch.commit();
        alert(`完了: ${snapshot.size} 件のポイントから${label}情報を削除しました。`);
      }
    } catch (e) {
      console.error(e);
      alert('処理に失敗しました。詳細: ' + e);
    } finally {
      setProcessing(false);
    }
  };

  // Operation: Delete Individual Point
  const handleDeletePoint = async (pointId: string, pointName: string) => {
    if (!window.confirm(`ポイント「${pointName}」(ID: ...${pointId.slice(-6)}) を完全に削除しますか？\n\n※関連する「生物紐付け」や「お気に入り」も同時に削除・解除されます。`)) return;

    setProcessing(true);
    try {
      const res = await deletePointCascade(pointId);
      alert(`ポイントを削除しました。\n(関連削除: 生物紐付け=${res.pcCount}件, お気に入り解除=${res.userCount}件)`);
    } catch (e) {
      console.error(e);
      alert('削除に失敗しました。');
    } finally {
      setProcessing(false);
    }
  };

  const getLabel = () => {
    switch (targetField) {
      case 'area': return 'Area (地区)';
      case 'zone': return 'Zone (エリア)';
      case 'region': return 'Region (都道府県/国)';
      case 'point': return 'Point (ポイント)';
    }
  };

  const getParentLabel = () => {
    switch (targetField) {
      case 'area': return 'Zone (エリア)'; // Parent of Area
      case 'zone': return 'Region (都道府県/国)'; // Parent of Zone
      case 'point': return 'Area (地区)'; // Parent of Point
      default: return '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/mypage')} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-xl font-bold text-gray-900">マスタデータ整理</h1>
          </div>
          <div className="text-sm text-gray-500">
            Total Points: {points.length}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">

        {/* Field Selector Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {/* ... existing tabs ... */}
          <button
            onClick={() => { setTargetField('region'); setEditingValue(null); setExpandedRow(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${targetField === 'region' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}
          >
            <Globe size={18} /> Region
          </button>
          <button
            onClick={() => { setTargetField('zone'); setEditingValue(null); setExpandedRow(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${targetField === 'zone' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}
          >
            <MapIcon size={18} /> Zone
          </button>
          <button
            onClick={() => { setTargetField('area'); setEditingValue(null); setExpandedRow(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${targetField === 'area' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}
          >
            <Layers size={18} /> Area
          </button>
          <button
            onClick={() => { setTargetField('point'); setEditingValue(null); setExpandedRow(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${targetField === 'point' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}
          >
            <MapPin size={18} /> Point
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-800">
          <p>
            現在 <b>{getLabel()}</b> を整理しています。<br />
            ポイント登録データからユニークな値を抽出し、名寄せや削除を行えます。
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li><b>編集アイコン</b>: 名前を一括で変更・統合します。</li>
            <li><b>ゴミ箱アイコン</b>: {targetField === 'point' ? 'この名前を持つすべてのポイントを削除します（超危険）。個別に削除する場合は詳細を開いてください。' : 'ポイントからこの値を一括削除し、未設定にします。'}</li>
            {targetField === 'point' && <li><b>詳細（Ｖ）</b>: 同名のポイントを個別に確認・編集・削除できます。</li>}
          </ul>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {targetField === 'point' && <th className="w-10 px-0"></th>}
                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">{getLabel()} Name</th>
                {targetField !== 'region' && (
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    {getParentLabel()}
                  </th>
                )}
                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Points</th>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {fieldStats.map((item) => (
                <React.Fragment key={item.name}>
                  <tr className={`hover:bg-gray-50 transition-colors ${expandedRow === item.name ? 'bg-blue-50' : ''}`}>
                    {targetField === 'point' && (
                      <td className="pl-4 py-4 w-10">
                        <button
                          onClick={() => setExpandedRow(expandedRow === item.name ? null : item.name)}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          {expandedRow === item.name ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      {editingValue === item.name ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newValue}
                            onChange={(e) => setNewValue(e.target.value)}
                            className="px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500 outline-none w-full"
                            autoFocus
                            placeholder={`新しい${targetField}名`}
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <span className={`font-medium ${item.name === '(Empty)' ? 'text-gray-400 italic' : 'text-gray-900'}`}>
                            {item.name}
                          </span>
                          {/* Show count of sub-items if duplicated IDs */}
                          {targetField === 'point' && item.points.length > 1 && (
                            <span className="text-[10px] text-amber-600 flex items-center gap-1">
                              <AlertTriangle size={10} /> {item.points.length} IDs detected
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    {targetField !== 'region' && (
                      <td className="px-6 py-4 hidden md:table-cell text-xs text-gray-500">
                        {item.parents.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {item.parents.slice(0, 3).map(p => (
                              <span key={p} className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 whitespace-nowrap">
                                {p}
                              </span>
                            ))}
                            {item.parents.length > 3 && (
                              <span className="text-gray-400 text-[10px] self-center">
                                +{item.parents.length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    )}
                    <td className="px-6 py-4 text-right text-sm text-gray-600">
                      <span className="bg-gray-100 px-2 py-1 rounded-full text-xs font-bold w-12 inline-block text-center">
                        {item.count}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {item.name === '(Empty)' ? (
                        <span className="text-xs text-gray-400">-</span>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          {editingValue === item.name ? (
                            <>
                              <button
                                onClick={() => setEditingValue(null)}
                                className="p-1 text-gray-400 hover:text-gray-600 rounded"
                                disabled={processing}
                              >
                                <X size={18} />
                              </button>
                              <button
                                onClick={() => handleRenameGroup(item.name)}
                                className="p-1 text-green-500 hover:text-green-700 rounded"
                                disabled={processing}
                              >
                                {processing ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => { setEditingValue(item.name); setNewValue(item.name); }}
                                className="p-2 text-blue-500 hover:bg-blue-50 rounded-full transition-colors"
                                title="Rename / Merge Group"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handleClearGroup(item.name)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors target-trash"
                                title={targetField === 'point' ? `Delete All Points named ${item.name}` : `Remove ${targetField}`}
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* EXPANDED ROW FOR POINTS */}
                  {expandedRow === item.name && targetField === 'point' && (
                    <tr className="bg-gray-50 shadow-inner">
                      <td colSpan={5} className="px-4 py-4">
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                          <div className="px-4 py-2 bg-gray-100 border-b border-gray-200 text-xs font-bold text-gray-500">
                            「{item.name}」の個別データ一覧 ({item.points.length}件)
                          </div>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-100">
                                <th className="px-4 py-2 text-left font-medium text-gray-500">ID (Last 6)</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-500">Area (地区) - Zone - Region</th>
                                <th className="px-4 py-2 text-right font-medium text-gray-500">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {item.points.map(p => (
                                <tr key={p.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-2 font-mono text-gray-400 text-xs">
                                    ...{p.id.slice(-6)}
                                  </td>
                                  <td className="px-4 py-2">
                                    <div className="flex flex-col">
                                      {editingPointId === p.id ? (
                                        <div className="flex items-center gap-2 mb-1">
                                          <input
                                            type="text"
                                            className="border rounded px-2 py-0.5 text-sm w-40"
                                            value={newPointName}
                                            onChange={(e) => setNewPointName(e.target.value)}
                                            placeholder="新しい名前"
                                          />
                                          <button
                                            onClick={() => handleRenamePoint(p.id, p.name)}
                                            className="text-green-600 hover:bg-green-50 p-0.5 rounded"
                                          >
                                            <Save size={14} />
                                          </button>
                                          <button
                                            onClick={() => setEditingPointId(null)}
                                            className="text-gray-400 hover:bg-gray-50 p-0.5 rounded"
                                          >
                                            <X size={14} />
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium">{p.name}</span>
                                          <button
                                            onClick={() => { setEditingPointId(p.id); setNewPointName(p.name); }}
                                            className="text-blue-300 hover:text-blue-500"
                                            title="Rename unique point"
                                          >
                                            <Edit2 size={12} />
                                          </button>
                                        </div>
                                      )}

                                      <span className="text-xs text-gray-500">
                                        {p.area} {p.zone && `> ${p.zone}`} {p.region && `> ${p.region}`}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-right">
                                    <button
                                      onClick={() => handleDeletePoint(p.id, p.name)}
                                      className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded"
                                      title="Delete this specific point only"
                                      disabled={processing}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                    <button
                                      onClick={() => { setMergeSource(p); setMergeModalOpen(true); }}
                                      className="text-purple-400 hover:text-purple-600 p-1 hover:bg-purple-50 rounded ml-1"
                                      title="Merge into another point"
                                      disabled={processing}
                                    >
                                      <GitMerge size={14} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="p-3 text-xs text-gray-400 text-center">
                            ※マージ機能(紫アイコン)を使うと、紐づくログやお気に入り情報を別のポイントへ移動して統合できます。
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}

              {fieldStats.length === 0 && (
                <tr>
                  <td colSpan={targetField === 'point' ? 5 : 4} className="px-6 py-8 text-center text-gray-500">
                    データが見つかりません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* MERGE MODAL */}
      {mergeModalOpen && mergeSource && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <GitMerge size={24} className="text-purple-600" />
              ポイント統合 (Merge)
            </h2>
            <div className="mb-4 p-3 bg-purple-50 border border-purple-100 rounded text-sm text-purple-800">
              <p className="font-bold">From (削除されます):</p>
              <p>{mergeSource.name} <span className="text-xs opacity-70">(ID: ...{mergeSource.id.slice(-6)})</span></p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2">To (統合先ターゲットID):</label>
              <input
                type="text"
                className="w-full border rounded p-2 font-mono text-sm"
                placeholder="ここにターゲットIDを貼り付け"
                value={mergeTargetId}
                onChange={e => setMergeTargetId(e.target.value.trim())}
              />
              <p className="text-xs text-gray-500 mt-1">
                ※統合先のポイントIDを入力してください。
              </p>

              {/* Quick Select Candidates (Same Name) */}
              {fieldStats.find(s => s.name === mergeSource.name)?.points.filter(p => p.id !== mergeSource.id).length ? (
                <div className="mt-3">
                  <p className="text-xs font-bold text-gray-400 mb-1">同名の候補から選択:</p>
                  <div className="flex flex-col gap-1">
                    {fieldStats.find(s => s.name === mergeSource.name)?.points
                      .filter(p => p.id !== mergeSource.id)
                      .map(p => (
                        <button
                          key={p.id}
                          onClick={() => setMergeTargetId(p.id)}
                          className="text-left text-xs bg-gray-50 hover:bg-gray-100 p-2 rounded border border-gray-200 flex justify-between"
                        >
                          <span>{p.name} (Area: {p.area})</span>
                          <span className="font-mono text-gray-400">...{p.id.slice(-6)}</span>
                        </button>
                      ))
                    }
                  </div>
                </div>
              ) : null}

            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setMergeModalOpen(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                キャンセル
              </button>
              <button
                onClick={handleMergePoints}
                disabled={!mergeTargetId || processing}
                className="px-4 py-2 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {processing ? <RefreshCw className="animate-spin" size={18} /> : <GitMerge size={18} />}
                統合実行
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
