import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { CleansingEngine } from "../ai/cleansingEngine";
import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

/**
 * Trigger Point-Creature Cleansing Job via Web API
 */
export const runDataCleansing = onCall({ region: "asia-northeast1", memory: "1GiB", timeoutSeconds: 300 }, async (request) => {
  const { auth, data } = request;

  // 1. Auth Check (Admin or Emulator)
  if (!auth) {
    logger.error("No auth context found in request");
    throw new HttpsError("unauthenticated", "Auth required");
  }

  const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";
  logger.info(`Checking permissions for UID: ${auth.uid} (isEmulator: ${isEmulator})`);

  const userDoc = await db.collection("users").doc(auth.uid).get();
  const userData = userDoc.data();

  if (isEmulator) {
    logger.info("Local emulator detected. Bypassing admin check.");
  } else if (!userData || userData.role !== 'admin') {
    logger.warn(`Permission Denied: User ${auth.uid} has role: ${userData?.role || 'none'}`);
    throw new HttpsError("permission-denied", "Admin role required");
  }

  const { mode, pointId, creatureId, regionId, zoneId, areaId } = data;
  const engine = new CleansingEngine();

  logger.info(`Starting Cleansing Job: Mode=${mode}, PointID=${pointId}, RegionID=${regionId}, ZoneID=${zoneId}, AreaID=${areaId}, CreatureID=${creatureId}`);

  try {
    let points: any[] = [];
    let creatures: any[] = [];
    // Point/Area/Zone/Regionのいずれか指定
    // 2. Fetch Points based on Hierarchy
    if (pointId) {
      const p = await db.collection('points').doc(pointId).get();
      if (p.exists) points.push({ ...p.data(), id: p.id });
    } else if (areaId) {
      const pSnap = await db.collection('points').where('areaId', '==', areaId).get();
      points = pSnap.docs.map(d => ({ ...d.data(), id: d.id }));
    } else if (zoneId) {
      const aSnap = await db.collection('areas').where('zoneId', '==', zoneId).get();
      const aIds = aSnap.docs.map(d => d.id);
      if (aIds.length > 0) {
        // Firestore 'in' limit is 10, so chunking just in case
        for (let i = 0; i < aIds.length; i += 10) {
          const chunk = aIds.slice(i, i + 10);
          const pSnap = await db.collection('points').where('areaId', 'in', chunk).get();
          points.push(...pSnap.docs.map(d => ({ ...d.data(), id: d.id })));
        }
      }
    } else if (regionId) {
      const zSnap = await db.collection('zones').where('regionId', '==', regionId).get();
      const zIds = zSnap.docs.map(d => d.id);
      if (zIds.length > 0) {
        const aSnap = await db.collection('areas').where('zoneId', 'in', zIds).get();
        const aIds = aSnap.docs.map(d => d.id);
        if (aIds.length > 0) {
          // Chunk areaIds if more than 10 (Firestore 'in' limit)
          for (let i = 0; i < aIds.length; i += 10) {
            const chunk = aIds.slice(i, i + 10);
            const pSnap = await db.collection('points').where('areaId', 'in', chunk).get();
            points.push(...pSnap.docs.map(d => ({ ...d.data(), id: d.id })));
          }
        }
      }
    } else if (mode === 'new' || mode === 'all') {
      const pSnap = await db.collection('points').limit(20).get();
      points = pSnap.docs.map(d => ({ ...d.data(), id: d.id }));
    }

    // 2b. Fetch Creatures with strict safety guard
    // 生物を指定
    if (creatureId) {
      // Pinpoint search: Only this specific creature
      const c = await db.collection('creatures').doc(creatureId).get();
      if (c.exists) {
        creatures = [{ ...c.data(), id: c.id }];
      } else {
        throw new HttpsError("not-found", "Specified creature not found");
      }
    } else { // 生物未指定
      // SAFETY GUARD: If pointId is NOT specified (meaning it's an area/zone/region wide search),
      // we REQUIRE a creatureId to be specified to avoid massive cross-product costs.
      // 生物未指定 且つポイント未指定は許容しない
      if (!pointId) {
        logger.error(`Aborted: Massive cleansing attempted on area without specific creatureId.`);
        throw new HttpsError("invalid-argument", "Area-wide cleansing requires a specific creatureId to prevent excessive costs.");
      }

      // Single point search without specific creature: Limit to a very small subset (Top 5)
      const cSnap = await db.collection('creatures').limit(5).get();
      creatures = cSnap.docs.map(d => ({ ...d.data(), id: d.id }));
      logger.info(`Point-only search: defaulting to top ${creatures.length} creatures.`);
    }

    logger.info(`Target Scoped: Found ${points.length} points and ${creatures.length} creatures to check.`);
    if (points.length === 0) {
      logger.warn(`No points found in Firestore for ID: ${pointId}. This might happen if the DB was reset and IDs changed.`);
    }

    if (points.length === 0) {
      logger.warn("No points found for the given criteria. Finishing early.");
      return { success: true, processedCount: 0, newMappingsCount: 0, results: [] };
    }

    // 3. Clear existing if mode is 'replace' or 'all'
    if (mode === 'replace' || mode === 'all') {
      logger.info(`Clearing existing associations for ${points.length} points...`);
      for (const p of points) {
        const existingSnap = await db.collection('point_creatures').where('pointId', '==', p.id).get();
        const batch = db.batch();
        existingSnap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
    }

    // 4. Run Pipeline in Batches
    const results = [];
    const BATCH_SIZE = 15;

    for (const p of points) {
      // Process creatures in batches for this point
      for (let i = 0; i < creatures.length; i += BATCH_SIZE) {
        const creatureBatch = creatures.slice(i, i + BATCH_SIZE);
        const batchResults = await engine.verifyBatch(p, creatureBatch);

        for (const mapping of batchResults) {
          if (mapping.status === 'pending') {
            const docId = `${p.id}_${mapping.creatureId}`;
            await db.collection('point_creatures').doc(docId).set({
              ...mapping,
              updatedAt: new Date().toISOString()
            });
            results.push(mapping);
          }
        }
      }
    }

    return {
      success: true,
      processedCount: points.length * creatures.length,
      newMappingsCount: results.length,
      results
    };

  } catch (error: any) {
    logger.error("Cleansing job failed:", error);
    throw new HttpsError("internal", error.message);
  }
});
