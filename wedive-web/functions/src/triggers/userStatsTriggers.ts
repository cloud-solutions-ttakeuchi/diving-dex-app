import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { FieldValue } from "firebase-admin/firestore";

const db = admin.firestore();

// ...
interface Point {
  id: string;
  name: string;
  imageUrl?: string;
  region: string;
  area: string;
  [key: string]: any;
}

interface Creature {
  id: string;
  name: string;
  rarity?: string;
  [key: string]: any;
}

interface PointCreature {
  pointId: string;
  creatureId: string;
  localRarity?: string;
  status: string;
}

interface Log {
  id: string;
  location: {
    pointId?: string;
    pointName?: string;
  };
  creatureId?: string;
  sightedCreatures?: string[];
  spotId?: string;
  [key: string]: any;
}

/**
 * Recalculate User Mastery when logs change
 */
export const onLogWriteCalcMastery = onDocumentWritten({
  document: "users/{userId}/logs/{logId}",
  region: "asia-northeast1",
  timeoutSeconds: 540, // 計算が重いかもしれないので長めに
  memory: "512MiB"
}, async (event) => {
  const userId = event.params.userId;

  // 削除の場合も計算が必要なので、event.data.after がなくても続行
  // ただし、もしユーザーごと削除された場合は無視するなどのガードが必要だが、
  // ここではログの変更をトリガーにしているのでユーザーはいる前提。

  logger.info(`Starting mastery calculation for user: ${userId}`);

  try {
    // 1. Fetch Master Data (In-memory caching is not reliable across invocations, so fetch every time for consistency)
    // Note: optimization is to fetch only needed fields
    const [pointsSnap, creaturesSnap, pointCreaturesSnap] = await Promise.all([
      db.collection('points').where('status', 'in', ['approved', 'pending']).get(),
      db.collection('creatures').where('status', 'in', ['approved', 'pending']).get(),
      db.collection('point_creatures').get() // status filter needed? assuming all existing ones are valid or filtered later
    ]);

    const points = pointsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Point));
    const creatures = creaturesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Creature));
    const pointCreatures = pointCreaturesSnap.docs.map(doc => ({ ...doc.data() } as PointCreature));

    // 2. Fetch User Logs
    const logsSnap = await db.collection(`users/${userId}/logs`).get();
    const logs = logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Log));

    // 3. Calculation Logic (Mirrors Web/App Logic)

    // Creature Map for quick lookup
    const creaturesMap = new Map(creatures.map(c => [c.id, c]));

    const calculatedPoints = points.map(point => {
      // Find logs for this point
      const pointLogs = logs.filter(l =>
        l.location?.pointId === point.id || l.spotId === point.id
      );

      if (pointLogs.length === 0) return null; // ダイブ実績がないポイントは計算対象外? Web版では return null していた

      // Valid creatures at this point
      const validPointCreatures = pointCreatures.filter(pc =>
        pc.pointId === point.id && (pc.status === 'approved' || pc.status === undefined)
      );

      // Creatures in this point (with details)
      // Creatures in this point (with details)
      const creaturesInPointRaw = validPointCreatures.map(pc => {
        const creature = creaturesMap.get(pc.creatureId);
        return creature ? { ...creature, localRarity: pc.localRarity } : null;
      });

      const creaturesInPoint = creaturesInPointRaw.filter(c => c !== null) as (Creature & { localRarity?: string })[];

      // Discovered IDs
      const pointLogCreatureIds = new Set<string>();
      pointLogs.forEach(l => {
        if (l.creatureId) pointLogCreatureIds.add(l.creatureId);
        if (l.sightedCreatures) l.sightedCreatures.forEach((id: string) => pointLogCreatureIds.add(id));
      });

      const discoveredCount = creaturesInPoint.filter(c => pointLogCreatureIds.has(c.id)).length;
      const totalCount = creaturesInPoint.length;
      const masteryRate = totalCount > 0 ? Math.round((discoveredCount / totalCount) * 100) : 0;

      return {
        pointId: point.id,
        pointName: point.name,
        imageUrl: point.imageUrl,
        region: point.region,
        area: point.area,
        diveCount: pointLogs.length,
        masteryRate,
        discoveredCount,
        totalCount,
        // UI表示用に軽量なリストを含める
        creaturesAtPoint: creaturesInPoint.map(c => ({
          id: c.id,
          imageUrl: c.imageUrl || null,
          localRarity: c.localRarity || null,
          isDiscovered: pointLogCreatureIds.has(c.id)
        })),
        discoveredIds: Array.from(pointLogCreatureIds)
      };
    }).filter(p => p !== null).sort((a, b) => b!.diveCount - a!.diveCount);

    // 4. Save Result
    // users/{userId}/stats/mastery ドキュメントに保存
    await db.doc(`users/${userId}/stats/mastery`).set({
      points: calculatedPoints,
      updatedAt: FieldValue.serverTimestamp(),
      calculatedAt: new Date().toISOString()
    });

    logger.info(`Mastery calculation completed for user: ${userId}. Saved ${calculatedPoints.length} points.`);

  } catch (error) {
    logger.error("Error calculating mastery:", error);
  }
});
