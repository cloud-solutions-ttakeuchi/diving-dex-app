import { collection, doc, writeBatch, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { INITIAL_DATA } from '../data/mockData';

export const seedFirestore = async (force: boolean = false, targetCollections?: string[]) => {
  console.log('Starting seeding...', { force, targetCollections });
  const batchLimit = 500;
  let batch = writeBatch(db);
  let operationCount = 0;

  const commitBatch = async () => {
    if (operationCount > 0) {
      await batch.commit();
      batch = writeBatch(db);
      operationCount = 0;
      console.log('Batch committed');
    }
  };

  try {
    // 0. Regions / Zones / Areas (New requirement: Upsert)
    // We process these first.
    const masterCollections = [
      { name: 'regions', data: INITIAL_DATA.regions },
      { name: 'zones', data: INITIAL_DATA.zones },
      { name: 'areas', data: INITIAL_DATA.areas },
      { name: 'creatures', data: INITIAL_DATA.creatures },
      { name: 'points', data: INITIAL_DATA.points },
      { name: 'point_creatures', data: INITIAL_DATA.pointCreatures },
    ].filter(c => !targetCollections || targetCollections.includes(c.name));

    for (const { name, data } of masterCollections) {
      // If not forced, check if empty first (to preserve old behavior if strictly needed,
      // but 'merge: true' is safe even if not forced, usually.
      // However, standard seed logic usually runs only on empty DB.
      // We'll stick to: if !force, check empty. if force, skip check.)

      let shouldRun = force;
      if (!force) {
        const snap = await getDocs(collection(db, name));
        shouldRun = snap.empty;
      }

      if (shouldRun) {
        console.log(`Seeding ${name}... (force=${force})`);
        for (const item of data) {
          // @ts-ignore
          const ref = doc(db, name, item.id);
          const safeItem = JSON.parse(JSON.stringify(item));
          // Upsert logic: merge: true
          batch.set(ref, safeItem, { merge: true });
          operationCount++;
          if (operationCount >= batchLimit) await commitBatch();
        }
      } else {
        console.log(`Skipping ${name} (already exists and force=false)`);
      }
    }

    // 3. Users -> Logs (Subcollection)
    // NEVER touch users if force=true (Update Mode)
    if (!force) {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      if (usersSnapshot.empty) {
        console.log('Seeding users...');
        for (const user of INITIAL_DATA.users) {
          const userRef = doc(db, 'users', user.id);
          const safeUser = JSON.parse(JSON.stringify(user));
          batch.set(userRef, safeUser); // Users usually one-time creation
          operationCount++;
          if (operationCount >= batchLimit) await commitBatch();

          // Seed Logs for this user
          const userLogs = INITIAL_DATA.logs.filter(l => l.userId === user.id);
          for (const log of userLogs) {
            const logRef = doc(db, 'users', user.id, 'logs', log.id);
            const safeLog = JSON.parse(JSON.stringify(log));
            batch.set(logRef, safeLog);
            operationCount++;
            if (operationCount >= batchLimit) await commitBatch();
          }
        }
      }
    } else {
      console.log('Skipping users (force update mode active)');
    }

    await commitBatch();
    console.log('Seeding completed!');
    return true;
  } catch (error) {
    console.error('Error seeding Firestore:', error);
    return false;
  }
};
