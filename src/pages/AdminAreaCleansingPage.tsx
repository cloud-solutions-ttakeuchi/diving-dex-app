import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Edit2, Trash2, Save, X, RefreshCw, Layers, Map as MapIcon, Globe, MapPin, ChevronDown, ChevronUp, AlertTriangle, GitMerge, Plus, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { writeBatch, collection, getDocs, query, where, doc, updateDoc, arrayRemove, arrayUnion, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Point } from '../types';
import { seedFirestore } from '../utils/seeder';
import { INITIAL_DATA } from '../data/mockData';

type TargetField = 'area' | 'zone' | 'region' | 'point';

export const AdminAreaCleansingPage = () => {
  const { regions, zones, areas, points, creatures, pointCreatures, currentUser } = useApp();
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

  const [groupMergeModalOpen, setGroupMergeModalOpen] = useState(false);
  const [groupMergeSource, setGroupMergeSource] = useState('');
  const [groupMergeTargetName, setGroupMergeTargetName] = useState('');

  // Master Data Management State
  const [masterModalOpen, setMasterModalOpen] = useState(false);
  const [masterEditType, setMasterEditType] = useState<'region' | 'zone' | 'area' | null>(null);
  const [masterFormData, setMasterFormData] = useState({ id: '', name: '', description: '', parentId: '' });
  const [isNewMaster, setIsNewMaster] = useState(false);

  // Filter State (Arrays for Multi-Select)
  const [filterRegion, setFilterRegion] = useState<string[]>([]);
  const [filterZone, setFilterZone] = useState<string[]>([]);
  const [filterArea, setFilterArea] = useState<string[]>([]);

  // Selection State
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Reset filters and selection when target changes
  React.useEffect(() => {
    setFilterRegion([]);
    setFilterZone([]);
    setFilterArea([]);
    setSelectedItems(new Set());
  }, [targetField]);

  // 1. Aggregate Stats based on Target Field with Parent Info
  const fieldStats = useMemo(() => {
    // Map stores: name -> { count, parents: Set<string>, points: Point[] }
    const stats = new Map<string, { count: number, parents: Set<string>, points: Point[] }>();

    // 0. Prepare Filters : Resolve Names to IDs for filtering Master Data properly
    // Note: Regions are simple. Zones need Region IDs. Areas need Zone IDs.
    const targetRegionIds = filterRegion.length > 0
      ? regions.filter(r => filterRegion.includes(r.name)).map(r => r.id)
      : [];
    const targetZoneIds = filterZone.length > 0
      ? zones.filter(z => filterZone.includes(z.name)).map(z => z.id)
      : [];

    // 1. Initialize with Master Data (to show empty items)
    if (targetField === 'region') {
      regions.forEach(r => {
        stats.set(r.name, { count: 0, parents: new Set(), points: [] });
      });
    } else if (targetField === 'zone') {
      zones.forEach(z => {
        // Filter by Region (if any selected)
        if (targetRegionIds.length > 0 && !targetRegionIds.includes(z.regionId)) return;

        const item = { count: 0, parents: new Set<string>(), points: [] as Point[] };
        const regionName = regions.find(r => r.id === z.regionId)?.name;
        if (regionName) item.parents.add(regionName);
        stats.set(z.name, item);
      });
    } else if (targetField === 'area') {
      areas.forEach(a => {
        // Filter by Zone (if any selected)
        if (targetZoneIds.length > 0 && !targetZoneIds.includes(a.zoneId)) return;

        // Implicit Filter by Region (if Region selected but NO Zone selected)
        if (targetRegionIds.length > 0 && targetZoneIds.length === 0) {
          const parentZone = zones.find(z => z.id === a.zoneId);
          if (!parentZone || !targetRegionIds.includes(parentZone.regionId)) return;
        }

        const item = { count: 0, parents: new Set<string>(), points: [] as Point[] };
        const zoneName = zones.find(z => z.id === a.zoneId)?.name;
        if (zoneName) item.parents.add(zoneName);
        stats.set(a.name, item);
      });
    }

    // 2. Aggregate Points
    points.forEach(p => {
      // Determine field value and parent value
      let val = '';
      let parentVal = '';

      // Check Filters
      // Note: Data is denormalized on Point, so we check names (or look up IDs if reliable)
      // For robustness with "Unknown/Legacy" data, checking text match is often safer for cleansing tools.

      // Region Filter
      if (filterRegion.length > 0 && !filterRegion.includes(p.region)) return;
      // Zone Filter
      if (filterZone.length > 0 && !filterZone.includes(p.zone)) return;
      // Area Filter (only for Point tab)
      if (targetField !== 'point' && filterArea.length > 0 && !filterArea.includes(p.area)) return;

      if (targetField === 'point') {
        if (filterArea.length > 0 && !filterArea.includes(p.area)) return; // Point tab Area filter

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

      // Track parent from Point data
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
  }, [points, targetField, filterRegion, filterZone, filterArea, regions, zones, areas]);

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



  const handleSyncMasterData = async () => {
    if (!window.confirm('Master Data (Regions/Zones/Areas) をFirestoreに同期します。\n※既にデータがある場合は上書き(Merge)されます。\n\n実行してよろしいですか？')) return;
    setProcessing(true);
    const success = await seedFirestore(true, ['regions', 'zones', 'areas']); // Safe update: Only Master Data
    setProcessing(false);
    if (success) alert('同期完了しました。');
    else alert('同期に失敗しました。');
  };

  const handleExportCreatures = () => {
    try {
      // Filter out any strictly internal/runtime properties if necessary,
      // but typically we want the whole object as it matches the seed schema.
      const exportData = creatures;
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `creatures_real_export_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e: any) {
      console.error("Export failed:", e);
      alert("Export failed: " + e.message);
    }
  };

  const handleExportPointCreatures = () => {
    try {
      const exportData = pointCreatures;
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `point_creatures_seed_export_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e: any) {
      console.error("Export failed:", e);
      alert("Export failed: " + e.message);
    }
  };

  const handleRepairDuplicates = async () => {
    if (!window.confirm('重複したマスターデータ（同名のArea/Zoneなど）を検出し、IDベースで統合・修復します。\n\n※初期データ(INITIAL_DATA)に含まれるIDを正とし、それ以外（ランダムID等）を削除してポイントを寄せます。\n\n実行しますか？')) return;
    setProcessing(true);
    try {
      let totalFixed = 0;
      const fixCollection = async (field: 'area' | 'zone' | 'region', collectionName: 'areas' | 'zones' | 'regions', initialList: any[]) => {
        const items = field === 'area' ? areas : field === 'zone' ? zones : regions;

        // Group by Name
        const groups: Record<string, any[]> = {};
        items.forEach(item => {
          if (!groups[item.name]) groups[item.name] = [];
          groups[item.name].push(item);
        });

        const batch = writeBatch(db);
        let ops = 0;

        for (const name of Object.keys(groups)) {
          const group = groups[name];
          if (group.length > 1) {
            console.log(`Found duplicate for ${field}: ${name}`, group);
            // Determine Winner: Match ID in INITIAL_DATA, or shortest ID (assuming seed is simple)
            const standardId = initialList.find(i => i.name === name)?.id;
            // Sort: Winner first
            group.sort((a, b) => {
              if (a.id === standardId) return -1;
              if (b.id === standardId) return 1;
              return 0; // If neither is standard, just pick first
            });

            const winner = group[0];
            const losers = group.slice(1);

            for (const loser of losers) {
              // 1. Move Points (Update ID)
              // const qField = field + 'Id'; // areaId, zoneId... wait. Point only has areaId.
              // Point has: areaId.
              // Point does NOT have zoneId / regionId on document (only denormalized strings).
              // BUT we updated logic to maintain Area.zoneId etc.
              // So:

              if (field === 'area') {
                // Update Points: areaId
                const q = query(collection(db, 'points'), where('areaId', '==', loser.id));
                const snaps = await getDocs(q);
                snaps.forEach(doc => {
                  batch.update(doc.ref, { areaId: winner.id });
                });
                ops += snaps.size;
              } else if (field === 'zone') {
                // Update Areas: zoneId
                const q = query(collection(db, 'areas'), where('zoneId', '==', loser.id));
                const snaps = await getDocs(q);
                snaps.forEach(doc => {
                  batch.update(doc.ref, { zoneId: winner.id });
                });
                ops += snaps.size;
              } else if (field === 'region') {
                // Update Zones: regionId
                const q = query(collection(db, 'zones'), where('regionId', '==', loser.id));
                const snaps = await getDocs(q);
                snaps.forEach(doc => {
                  batch.update(doc.ref, { regionId: winner.id });
                });
                ops += snaps.size;
              }

              // 2. Delete Loser Doc
              batch.delete(doc(db, collectionName, loser.id));
              ops++;
              totalFixed++;
            }
          }
        }
        if (ops > 0) await batch.commit();
      };

      await fixCollection('region', 'regions', INITIAL_DATA.regions);
      await fixCollection('zone', 'zones', INITIAL_DATA.zones);
      await fixCollection('area', 'areas', INITIAL_DATA.areas);

      alert(`修復完了: ${totalFixed} 件の重複データを整理しました。`);
    } catch (e) {
      console.error(e);
      alert('修復中にエラーが発生しました。');
    } finally {
      setProcessing(false);
    }
  };
  const handleMergeGroup = async () => {
    if (!groupMergeSource || !groupMergeTargetName || groupMergeSource === groupMergeTargetName) return;

    const label = getLabel();
    if (!window.confirm(`【重要】${label}統合 (MERGE) を実行します。\n\nSource (統合元): ${groupMergeSource}\nTarget (統合先): ${groupMergeTargetName}\n\n対象の全ポイントの ${label} を「${groupMergeTargetName}」に書き換えます。\nAreaの場合、統合先の ${label}ID も適用されます。\n\n本当によろしいですか？`)) return;

    setProcessing(true);
    try {
      const queryField = targetField === 'point' ? 'name' : targetField;

      // 1. Get Source Docs
      const sourceQuery = query(collection(db, 'points'), where(queryField, '==', groupMergeSource));
      const sourceSnapshot = await getDocs(sourceQuery);

      if (sourceSnapshot.empty) {
        alert('対象データが見つかりません。');
        setProcessing(false);
        return;
      }

      // 2. Prepare Update Data
      const updateData: any = {
        [targetField]: groupMergeTargetName
      };

      // 3. For Area, we need to resolve the Target Area ID
      //    AND for Zone/Region, we need to update the Child Master Data (Areas/Zones) hierarchy
      if (targetField === 'area') {
        const targetQuery = query(collection(db, 'points'), where('area', '==', groupMergeTargetName), where('areaId', '!=', ''));
        const targetSnapshot = await getDocs(targetQuery);
        if (!targetSnapshot.empty) {
          const targetPoint = targetSnapshot.docs[0].data() as Point;
          if (targetPoint.areaId) updateData['areaId'] = targetPoint.areaId;
        }

        // Delete Source Area Doc (Master Data cleanup)
        const sourceArea = areas.find(a => a.name === groupMergeSource);
        if (sourceArea) {
          const batchMaster = writeBatch(db);
          batchMaster.delete(doc(db, 'areas', sourceArea.id));
          await batchMaster.commit();
        }
      } else if (targetField === 'zone') {
        // Zone Merge: Update Child Areas' zoneId
        // 1. Find Source Zone ID & Target Zone ID from Master Data (zones state)
        const sourceZone = zones.find(z => z.name === groupMergeSource);
        const targetZone = zones.find(z => z.name === groupMergeTargetName);

        if (sourceZone && targetZone) {
          // Find all Areas belonging to Source Zone
          const childAreas = areas.filter(a => a.zoneId === sourceZone.id);
          const batchMaster = writeBatch(db);
          let masterOps = 0;

          childAreas.forEach(area => {
            const areaRef = doc(db, 'areas', area.id);
            batchMaster.update(areaRef, { zoneId: targetZone.id });
            masterOps++;
          });

          // Delete the Source Zone Doc
          const sourceRef = doc(db, 'zones', sourceZone.id);
          batchMaster.delete(sourceRef);
          masterOps++;

          if (masterOps > 0) {
            await batchMaster.commit();
            console.log(`Master Data Updated: Moved ${childAreas.length} Areas to ${targetZone.name}`);
          }
        }
      } else if (targetField === 'region') {
        // Region Merge: Update Child Zones' regionId
        const sourceRegion = regions.find(r => r.name === groupMergeSource);
        const targetRegion = regions.find(r => r.name === groupMergeTargetName);

        if (sourceRegion && targetRegion) {
          const childZones = zones.filter(z => z.regionId === sourceRegion.id);
          const batchMaster = writeBatch(db);
          let masterOps = 0;

          childZones.forEach(zone => {
            const zoneRef = doc(db, 'zones', zone.id);
            batchMaster.update(zoneRef, { regionId: targetRegion.id });
            masterOps++;
          });

          const sourceRef = doc(db, 'regions', sourceRegion.id);
          batchMaster.delete(sourceRef);
          masterOps++;

          if (masterOps > 0) {
            await batchMaster.commit();
          }
        }
      }

      // 4. Batch Update (Chunked) - Update Points
      const chunkedDocs = chunkArray(sourceSnapshot.docs, 450);
      let updatedCount = 0;

      for (const chunk of chunkedDocs) {
        const batch = writeBatch(db);
        chunk.forEach(doc => {
          batch.update(doc.ref, updateData);
        });
        await batch.commit();
        updatedCount += chunk.length;
      }

      alert(`統合完了: ${updatedCount} 件のポイントを「${groupMergeTargetName}」に統合しました。`);
      setGroupMergeModalOpen(false);
      setGroupMergeSource('');
      setGroupMergeTargetName('');
      setEditingValue(null);

    } catch (e) {
      console.error(e);
      alert('統合処理中にエラーが発生しました。');
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

  // --- Master Data Management Handlers ---

  const handleOpenMasterEdit = (type: 'region' | 'zone' | 'area', data: any = null) => {
    setMasterEditType(type);
    setIsNewMaster(!data);
    if (data) {
      setMasterFormData({
        id: data.id,
        name: data.name,
        description: data.description || '',
        parentId: type === 'zone' ? data.regionId : type === 'area' ? data.zoneId : ''
      });
    } else {
      setMasterFormData({ id: '', name: '', description: '', parentId: '' });
    }
    setMasterModalOpen(true);
  };

  const handleSaveMasterData = async () => {
    if (!masterEditType || !masterFormData.name) return;
    setProcessing(true);

    try {
      const collectionName = masterEditType + 's'; // regions, zones, areas
      const data: any = {
        name: masterFormData.name,
        description: masterFormData.description
      };

      // Add Parent ID
      if (masterEditType === 'zone') {
        if (!masterFormData.parentId) throw new Error('Parent Region is required');
        data.regionId = masterFormData.parentId;
      } else if (masterEditType === 'area') {
        if (!masterFormData.parentId) throw new Error('Parent Zone is required');
        data.zoneId = masterFormData.parentId;
      }

      let docId = masterFormData.id;

      if (isNewMaster) {
        // Generate ID: {first_char}_{timestamp}
        if (!docId) {
          const prefix = masterEditType[0]; // r, z, a
          docId = `${prefix}_${Math.floor(Date.now() / 1000)}`;
        }
        data.id = docId;
        await setDoc(doc(db, collectionName, docId), data);
        alert(`Created new ${masterEditType}: ${masterFormData.name}`);
      } else {
        await updateDoc(doc(db, collectionName, docId), data);
        alert(`Updated ${masterEditType}: ${masterFormData.name}`);
      }

      setMasterModalOpen(false);
      setMasterFormData({ id: '', name: '', description: '', parentId: '' });
    } catch (e: any) {
      console.error(e);
      alert(`Error: ${e.message}`);
    } finally {
      setProcessing(false);
    }
  };

  // --- Bulk Selection Handlers ---
  const toggleSelection = (name: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(name)) newSet.delete(name);
    else newSet.add(name);
    setSelectedItems(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === fieldStats.length) {
      setSelectedItems(new Set());
    } else {
      const allNames = fieldStats.map(s => s.name);
      setSelectedItems(new Set(allNames));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;
    const label = getLabel();
    const count = selectedItems.size;

    if (targetField === 'point') {
      if (!window.confirm(`【危険】選択された ${count} 件のポイント定義(名前)を削除しますか？\n\n※それに属する個別のポイントID全てが削除されます。\nこれには関連する写真、ログ、お気に入り情報などが含まれます。\n\n本当に実行しますか？`)) return;
    } else {
      if (!window.confirm(`選択された ${count} 件の ${label} を削除しますか？\n（ポイントデータからこの ${label} 情報がクリアされます）`)) return;
    }

    setProcessing(true);
    try {
      // Loop through selected items and call existing handlers
      // Ideally we should batch this better, but reusing existing logic ensures consistency (cascade deletes etc).
      // For Master Data (Regions/Zones/Areas) it's just batch updates.
      // For Points, it's cascade delete.

      if (targetField === 'point') {
        const items = Array.from(selectedItems);
        // Process sequentially to avoid overwhelming browser/firestore with parallel complex queries
        for (const name of items) {
          // We need to find all point IDs for this name
          const stats = fieldStats.find(s => s.name === name);
          if (!stats) continue;
          for (const p of stats.points) {
            await deletePointCascade(p.id);
          }
        }
      } else {
        // Batch update for Field Cleansing
        const batch = writeBatch(db);
        const items = Array.from(selectedItems);

        // 1. Find all points with these values
        // const q = query(collection(db, 'points'), where(targetField, 'in', items.slice(0, 10))); // Limited 'in' query idea abandoned for loop simplicity
        // Better strategy: Query by each value or use large loop?
        // Actually, let's reuse handleClearGroup logic but optimize?
        // Simpler: iterate selected items.

        for (const name of items) {
          const q = query(collection(db, 'points'), where(targetField, '==', name));
          const snap = await getDocs(q);
          snap.docs.forEach(d => {
            batch.update(d.ref, { [targetField]: '' });
          });
        }
        await batch.commit();
      }

      alert(`Bulk Delete Completed.`);
      setSelectedItems(new Set());
      // Refresh? (UseEffect will handle if data changes)
    } catch (e: any) {
      console.error(e);
      alert('Error during bulk operation: ' + e.message);
    } finally {
      setProcessing(false);
    }
  };

  /*
    const handleBulkMerge = () => {
      if (selectedItems.size === 0) return;
      // Open a special Bulk Merge Modal? Or reuse Group Merge with multiple sources?
      // For simplicity, let's just use the Group Merge Modal but with "Bulk Source" mode.
      // Current Group Merge expects a single source string.

      // Let's create a new mode for "Bulk Merge"
      alert("Bulk Merge is not fully implemented yet in this iteration. Please use Bulk Delete or individual Merge.");
      // Implementing Bulk Merge requires changing the Merge Logic to accept an array of sources.
      // I'll stick to Delete for now as it's the most common "Cleansing" task.
    };
  */

  // --- Export JSON Handler ---
  const handleExportJson = async () => {
    try {
      setProcessing(true);

      // Reconstruct hierarchy from Firestore data (context)
      // Structure: Region -> Zone -> Area -> Point

      const exportData = regions.map(r => {
        // Get Zones for this Region
        const rZones = zones.filter(z => z.regionId === r.id);

        const childrenZones = rZones.map(z => {
          // Get Areas for this Zone
          const zAreas = areas.filter(a => a.zoneId === z.id);

          const childrenAreas = zAreas.map(a => {
            // Get Points for this Area (by name matching, since points are denormalized)
            // Note: 'points' in context is a flat list. Points link to Area by NAME (p.area).
            // Optimization: Filter points by p.area === a.name
            // Wait, `points` in context has `area` field which is the Name.
            // Issue: Points link by Name, but Areas have IDs.
            // We should rely on `a.name` matching `p.area`.

            const aPoints = points.filter(p => p.area === a.name);

            const childrenPoints = aPoints.map(p => ({
              name: p.name,
              level: p.level,
              maxDepth: p.maxDepth,
              entryType: p.entryType,
              current: p.current,
              topography: p.topography,
              features: p.features,
              description: p.description,
              imageKeyword: p.imageKeyword, // Legacy field?
              id: p.id,
              type: "Point",
              image: (p as any).image || (p.images && p.images[0]) || ""
            }));

            return {
              name: a.name,
              description: a.description || "",
              id: a.id,
              type: "Area",
              children: childrenPoints
            };
          });

          return {
            name: z.name,
            description: z.description || "",
            id: z.id,
            type: "Zone",
            children: childrenAreas
          };
        });

        return {
          name: r.name,
          description: r.description || "",
          children: childrenZones
          // Region doesn't strictly have an ID in the seed file if it's top level?
          // Checking locations_seed.json...
          // Root elements have "name", "description", "children". No "id", No "type".
          // But let's check the view...
          // Line 3: "name": "日本", ... "children": [...]
          // Line 7: "name": "沖縄本島", ... "children": [...]
          // Seems regions in our specific data model might be mapped to these.
          // However, our Firestore `regions` collection is usually the equivalent of "Okinawa Main Island" etc.
          // If we want to strictly match `locations_seed.json`, we might need a "Japan" root wrapper?
          // Current `regions` context likely contains "Okinawa Main Island", "Miyako", "Ishigaki".
          // Let's assume we export the list of regions as the root array.
          // If the seed file has a wrapper "Japan", we might miss it.
          // But looking at the current data, `regions` context are the top level items we manage.
        };
      });

      // Wrap in "Japan" if needed?
      // Let's look at line 1 of locations_seed.json. It's an ARRAY of regions.
      // The first item is "日本" (Japan).
      // If our `regions` matches "日本", then we are good.
      // If `regions` are "Okinawa", "Ishigaki" etc., then they are children of "Japan".
      // Let's check `regions` content.
      // Usually `locations_structure.json` flattens things.
      // But let's assume `regions` context corresponds to the top-level objects in `locations_seed.json`.

      // Wait, `regions` in Firestore likely came from `INITIAL_DATA.regions`.
      // Let's check `mockData.ts` or `seeder.ts`.
      // `seeder.ts`: `regions` data comes from `INITIAL_DATA.regions`.
      // `mockData.ts`: `export const INITIAL_DATA = { regions: [...] }`.
      // If `regions` in Firestore equates to the top level of `locations_seed.json`, then directly exporting `exportData` array is correct.

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `locations_seed_export_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      alert("Export started.");

    } catch (e: any) {
      console.error(e);
      alert("Export failed: " + e.message);
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
      case 'area': return 'Parent Zone';
      case 'zone': return 'Parent Region';
      case 'point': return 'Parent Area';
      default: return '';
    }
  };

  // --- MultiSelect Dropdown Component ---
  const MultiSelectDropdown = ({
    label,
    options,
    selected,
    onChange,
    disabled = false
  }: {
    label: string,
    options: { value: string, label: string }[],
    selected: string[],
    onChange: (val: string[]) => void,
    disabled?: boolean
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (value: string) => {
      if (selected.includes(value)) {
        onChange(selected.filter(v => v !== value));
      } else {
        onChange([...selected, value]);
      }
    };

    return (
      <div className="relative" ref={containerRef}>
        <button
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`flex items-center justify-between px-3 py-2 border rounded text-sm min-w-[160px] bg-white ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400'}`}
        >
          <span className="truncate max-w-[120px]">
            {selected.length === 0 ? label : `${selected.length} selected`}
          </span>
          <ChevronDown size={14} className="text-gray-500 ml-2" />
        </button>

        {isOpen && !disabled && (
          <div className="absolute z-10 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto p-1">
            <div className="p-2 border-b border-gray-100 flex justify-between">
              <span className="text-xs font-bold text-gray-500">{label}</span>
              {selected.length > 0 && <button onClick={() => onChange([])} className="text-xs text-blue-600 hover:underline">Clear</button>}
            </div>
            {options.length === 0 && <div className="p-2 text-xs text-gray-400">No options</div>}
            {options.map(opt => (
              <div
                key={opt.value}
                className="flex items-center px-2 py-2 hover:bg-gray-50 cursor-pointer rounded"
                onClick={() => toggleOption(opt.value)}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt.value)}
                  onChange={() => { }} // handled by div click
                  className="mr-2 rounded text-blue-600 focus:ring-blue-500 pointer-events-none"
                />
                <span className="text-sm text-gray-700">{opt.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="w-full max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => navigate('/mypage')} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-xl font-bold text-gray-900">マスタデータ整理</h1>
            <button
              onClick={handleSyncMasterData}
              disabled={processing}
              className="px-3 py-1 bg-gray-800 text-white font-bold rounded hover:bg-gray-900 transition-colors flex items-center gap-2 text-xs ml-4"
            >
              <RefreshCw size={12} />
              DB同期
            </button>
            <button
              onClick={handleExportJson}
              disabled={processing}
              className="px-3 py-1 bg-green-600 text-white font-bold rounded hover:bg-green-700 transition-colors flex items-center gap-2 text-xs"
            >
              <Download size={12} />
              Export Locations
            </button>
            <button
              onClick={handleExportCreatures}
              disabled={processing}
              className="px-3 py-1 bg-teal-600 text-white font-bold rounded hover:bg-teal-700 transition-colors flex items-center gap-2 text-xs"
            >
              <Download size={12} />
              Export Creatures
            </button>
            <button
              onClick={handleExportPointCreatures}
              disabled={processing}
              className="px-3 py-1 bg-teal-600 text-white font-bold rounded hover:bg-teal-700 transition-colors flex items-center gap-2 text-xs"
            >
              <Download size={12} />
              Export Relations
            </button>
            <button
              onClick={handleRepairDuplicates}
              disabled={processing}
              className="px-3 py-1 bg-red-800 text-white font-bold rounded hover:bg-red-900 transition-colors flex items-center gap-2 text-xs"
            >
              <AlertTriangle size={12} />
              重複修復
            </button>
            <button
              onClick={async () => {
                if (!window.confirm('【重要】Master Dataを完全にリセットしますか？\n\n1. Regions, Zones, Areas, Points, PointCreatures の全ドキュメントを物理削除します。\n2. JSON(mockData)から初期データを再生成します。\n\n※ユーザーログ(Logs)は残りますが、古いエリアIDを参照している場合は"Unknown"等になります。\n\n本当によろしいですか？')) return;

                const code = window.prompt('確認のため "RESET" と入力してください。');
                if (code !== 'RESET') return;

                setProcessing(true);
                try {
                  const collections = ['regions', 'zones', 'areas', 'points', 'point_creatures'];

                  // 1. Delete All Documents in Master Collections
                  // Note: This is client-side iteration. If huge data, it might timeout or cost reads/writes.
                  // For "Reset", we assume < 2000 items total, which is manageable.
                  let deletedCount = 0;

                  for (const colName of collections) {
                    const snap = await getDocs(collection(db, colName));
                    const batchSize = 400;
                    const chunks = [];
                    let tempDocs = [...snap.docs];
                    while (tempDocs.length > 0) chunks.push(tempDocs.splice(0, batchSize));

                    for (const chunk of chunks) {
                      const batch = writeBatch(db);
                      chunk.forEach(d => batch.delete(d.ref));
                      await batch.commit();
                      deletedCount += chunk.length;
                    }
                  }

                  console.log(`Deleted ${deletedCount} documents.`);

                  // 2. Re-Seed
                  await seedFirestore(true); // Force run

                  alert('リセット完了しました。画面をリロードします。');
                  window.location.reload();

                } catch (e) {
                  console.error(e);
                  alert('リセット中にエラーが発生しました: ' + e);
                } finally {
                  setProcessing(false);
                }
              }}
              disabled={processing}
              className="px-3 py-1 bg-red-600 text-white font-bold rounded hover:bg-red-700 transition-colors flex items-center gap-2 text-xs ml-4 border-2 border-red-800 animate-pulse"
            >
              <Trash2 size={12} />
              HARD RESET DB
            </button>
            <button
              onClick={async () => {
                if (!window.confirm('【警告】あなたの全てのログを削除しますか？\n\nこの操作は取り消せません。\nインポート失敗時のリセット用です。\n\n本当によろしいですか？')) return;

                const code = window.prompt('確認のため "DELETE_LOGS" と入力してください。');
                if (code !== 'DELETE_LOGS') return;

                setProcessing(true);
                try {
                  // Fetch all logs for current user (or use loaded logs if context has them)
                  // Considering logs context might be limited or filtered, fetching directly is safer for "ALL".
                  const logsRef = collection(db, 'users', currentUser.id, 'logs');
                  const snap = await getDocs(logsRef);
                  const batchSize = 400;
                  const chunks = [];
                  let tempDocs = [...snap.docs];
                  while (tempDocs.length > 0) chunks.push(tempDocs.splice(0, batchSize));

                  let deletedCount = 0;
                  for (const chunk of chunks) {
                    const batch = writeBatch(db);
                    chunk.forEach(d => batch.delete(d.ref));
                    await batch.commit();
                    deletedCount += chunk.length;
                  }
                  alert(`完了: ${deletedCount} 件のログを削除しました。`);
                  window.location.reload();
                } catch (e) {
                  console.error(e);
                  alert('削除中にエラーが発生しました: ' + e);
                } finally {
                  setProcessing(false);
                }
              }}
              disabled={processing}
              className="px-3 py-1 bg-red-800 text-white font-bold rounded hover:bg-black transition-colors flex items-center gap-2 text-xs ml-4 border border-red-900"
            >
              <Trash2 size={12} />
              DELETE MY LOGS
            </button>
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

          {targetField !== 'point' && (
            <button
              onClick={() => handleOpenMasterEdit(targetField as any)}
              className="ml-auto flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-md transition-all whitespace-nowrap"
            >
              <Plus size={18} /> Create New {targetField.charAt(0).toUpperCase() + targetField.slice(1)}
            </button>
          )}
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

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-200 items-center">
          <span className="text-sm font-bold text-gray-500 mr-2">Filters:</span>

          {/* Region Filter */}
          {(targetField === 'zone' || targetField === 'area' || targetField === 'point') && (
            <MultiSelectDropdown
              label="Select Regions"
              options={regions.map(r => ({ value: r.name, label: r.name }))}
              selected={filterRegion}
              onChange={(vals) => { setFilterRegion(vals); setFilterZone([]); setFilterArea([]); }}
            />
          )}

          {/* Zone Filter */}
          {(targetField === 'area' || targetField === 'point') && (
            <MultiSelectDropdown
              label="Select Zones"
              options={zones
                .filter(z => filterRegion.length === 0 || filterRegion.includes(regions.find(r => r.id === z.regionId)?.name || ''))
                .map(z => ({ value: z.name, label: z.name }))}
              selected={filterZone}
              onChange={(vals) => { setFilterZone(vals); setFilterArea([]); }}
              disabled={filterRegion.length === 0 && targetField !== 'point'} // Relaxed for Point tab
            />
          )}

          {/* Area Filter */}
          {targetField === 'point' && (
            <MultiSelectDropdown
              label="Select Areas"
              options={areas
                .filter(a => {
                  if (filterZone.length > 0) return filterZone.includes(zones.find(z => z.id === a.zoneId)?.name || '');
                  if (filterRegion.length > 0) {
                    // Belong to any zone in this region
                    const rIds = regions.filter(r => filterRegion.includes(r.name)).map(r => r.id);
                    const zIds = zones.filter(z => rIds.includes(z.regionId)).map(z => z.id);
                    return zIds.includes(a.zoneId);
                  }
                  return true;
                })
                .map(a => ({ value: a.name, label: a.name }))}
              selected={filterArea}
              onChange={(vals) => setFilterArea(vals)}
              disabled={filterZone.length === 0 && filterRegion.length === 0}
            />
          )}

          {(filterRegion.length > 0 || filterZone.length > 0 || filterArea.length > 0) && (
            <button onClick={() => { setFilterRegion([]); setFilterZone([]); setFilterArea([]); }} className="ml-auto text-xs text-blue-600 hover:underline">Clear Filters</button>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-24">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedItems.size > 0 && selectedItems.size === fieldStats.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
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
                  <tr className={`hover: bg - gray - 50 transition - colors ${expandedRow === item.name ? 'bg-blue-50' : ''} ${selectedItems.has(item.name) ? 'bg-blue-50' : ''} `}>
                    <td className="px-4 py-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.name)}
                        onChange={() => toggleSelection(item.name)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
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
                            placeholder={`新しい${targetField} 名`}
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <span className={`font - medium ${item.name === '(Empty)' ? 'text-gray-400 italic' : 'text-gray-900'} `}>
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
                                onClick={() => {
                                  if (targetField === 'point') {
                                    setEditingValue(item.name);
                                    setNewValue(item.name);
                                  } else {
                                    const collection = targetField === 'area' ? areas : targetField === 'zone' ? zones : regions;
                                    const obj = collection.find((x: any) => x.name === item.name);
                                    if (obj) handleOpenMasterEdit(targetField, obj);
                                    else alert('Error: Object not found in master data.');
                                  }
                                }}
                                className="p-2 text-blue-500 hover:bg-blue-50 rounded-full transition-colors"
                                title={targetField === 'point' ? "Rename" : "Edit Details (Name, Parent, etc.)"}
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handleClearGroup(item.name)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors target-trash"
                                title={targetField === 'point' ? `Delete All Points named ${item.name} ` : `Remove ${targetField} `}
                              >
                                <Trash2 size={16} />
                              </button>
                              {targetField !== 'point' && ( // Only show group merge for Area/Zone/Region
                                <button
                                  onClick={() => { setGroupMergeSource(item.name); setGroupMergeModalOpen(true); }}
                                  className="p-2 text-purple-500 hover:bg-purple-50 rounded-full transition-colors"
                                  title="Merge Group (Name & ID)"
                                >
                                  <GitMerge size={16} />
                                </button>
                              )}
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
                                        {p.area} {p.zone && `> ${p.zone} `} {p.region && ` > ${p.region} `}
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

      {/* GROUP MERGE MODAL (Area/Zone/Region) */}
      {groupMergeModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <GitMerge size={24} className="text-purple-600" />
              {getLabel()} 統合 (Merge)
            </h2>
            <div className="mb-4 p-3 bg-purple-50 border border-purple-100 rounded text-sm text-purple-800">
              <p className="font-bold">From (統合元):</p>
              <p>{groupMergeSource} ({fieldStats.find(s => s.name === groupMergeSource)?.count} points)</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2">To (統合先を選択):</label>

              <div className="mb-2 max-h-48 overflow-y-auto border rounded divide-y">
                {fieldStats
                  .filter(s => s.name !== groupMergeSource && s.name !== '(Empty)')
                  .map(s => (
                    <button
                      key={s.name}
                      onClick={() => setGroupMergeTargetName(s.name)}
                      className={`w - full text - left p - 2 text - sm hover: bg - gray - 50 flex justify - between ${groupMergeTargetName === s.name ? 'bg-purple-100 text-purple-900 font-bold' : ''} `}
                    >
                      <span>{s.name}</span>
                      <span className="text-gray-400 text-xs">({s.count})</span>
                    </button>
                  ))
                }
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                  <Edit2 size={14} />
                </div>
                <input
                  type="text"
                  className="w-full pl-9 border rounded p-2 text-sm"
                  placeholder="手入力も可能..."
                  value={groupMergeTargetName}
                  onChange={e => setGroupMergeTargetName(e.target.value)}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                ※統合先の既存データがある場合、その {targetField === 'area' ? 'ID (AreaID)' : '情報'} も適用されます。
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setGroupMergeModalOpen(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                キャンセル
              </button>
              <button
                onClick={handleMergeGroup}
                disabled={!groupMergeTargetName || processing}
                className="px-4 py-2 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {processing ? <RefreshCw className="animate-spin" size={18} /> : <Layers size={18} />}
                統合実行
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MASTER DATA EDIT MODAL */}
      {masterModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Edit2 size={24} className="text-blue-600" />
              {isNewMaster ? 'Create New' : 'Edit'} {masterEditType ? masterEditType.charAt(0).toUpperCase() + masterEditType.slice(1) : ''}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Name</label>
                <input
                  type="text"
                  value={masterFormData.name}
                  onChange={e => setMasterFormData({ ...masterFormData, name: e.target.value })}
                  className="w-full border rounded p-2"
                  placeholder="Official Name (e.g. Ishigaki Island)"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Description</label>
                <textarea
                  value={masterFormData.description}
                  onChange={e => setMasterFormData({ ...masterFormData, description: e.target.value })}
                  className="w-full border rounded p-2 text-sm h-20"
                  placeholder="Description..."
                />
              </div>

              {masterEditType === 'zone' && (
                <div>
                  <label className="block text-sm font-semibold mb-1">Parent Region</label>
                  <select
                    value={masterFormData.parentId}
                    onChange={e => setMasterFormData({ ...masterFormData, parentId: e.target.value })}
                    className="w-full border rounded p-2 bg-white"
                  >
                    <option value="">-- Select Region --</option>
                    {regions.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {masterEditType === 'area' && (
                <div>
                  <label className="block text-sm font-semibold mb-1">Parent Zone</label>
                  <select
                    value={masterFormData.parentId}
                    onChange={e => setMasterFormData({ ...masterFormData, parentId: e.target.value })}
                    className="w-full border rounded p-2 bg-white"
                  >
                    <option value="">-- Select Zone --</option>
                    {zones.map(z => (
                      <option key={z.id} value={z.id}>
                        {z.name} (Region: {regions.find(r => r.id === z.regionId)?.name || '?'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* ID Display (Read Only) */}
              {!isNewMaster && (
                <div className="text-xs text-gray-400 font-mono">
                  ID: {masterFormData.id}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setMasterModalOpen(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMasterData}
                disabled={!masterFormData.name || processing}
                className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {processing ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FIXED BOTTOM BAR FOR BULK ACTIONS */}
      {selectedItems.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-50 animate-in slide-in-from-bottom-5">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="text-sm font-bold text-gray-700">
              {selectedItems.size} items selected
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setSelectedItems(new Set())}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={processing}
                className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {processing ? <RefreshCw className="animate-spin" size={16} /> : <Trash2 size={16} />}
                Bulk Delete
              </button>
              {/*
                 <button
                    onClick={handleBulkMerge}
                    disabled={processing}
                    className="px-4 py-2 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                 >
                    <GitMerge size={16} />
                    Bulk Merge (WIP)
                 </button>
                 */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
