import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import type { User, Log, Rarity, Creature, Point, PointCreature } from '../types';
import { INITIAL_DATA, TRUST_RANKS } from '../data/mockData';
import { auth, googleProvider, db as firestore } from '../lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  getDoc,
  collectionGroup,
  limit,
  writeBatch
} from 'firebase/firestore';


// Helper to remove undefined values
const sanitizePayload = (data: any): any => {
  if (Array.isArray(data)) {
    return data.map(item => sanitizePayload(item));
  }
  if (data !== null && typeof data === 'object') {
    return Object.entries(data).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = sanitizePayload(value);
      }
      return acc;
    }, {} as any);
  }
  return data;
};

interface AppContextType {
  // db: DB; // Removed
  currentUser: User;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  calculateRarity: (creatureId: string, spotId?: string) => Rarity;
  addLog: (logData: Omit<Log, 'id' | 'userId'>) => Promise<void>;
  addCreature: (creatureData: Omit<Creature, 'id'>) => Promise<Creature>;
  addPoint: (pointData: Omit<Point, 'id'>) => Promise<Point>;
  updateLog: (logId: string, logData: Partial<Log>) => Promise<void>;
  updateCreature: (creatureId: string, creatureData: Partial<Creature>) => Promise<void>;
  updatePoint: (pointId: string, pointData: Partial<Point>) => Promise<void>;
  deleteLog: (logId: string) => Promise<void>;
  deleteLogs: (logIds: string[]) => Promise<void>;
  updateLogs: (logIds: string[], data: Record<string, any>) => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  toggleLikeLog: (log: Log) => Promise<void>;
  toggleFavorite: (creatureId: string) => void;
  toggleWanted: (creatureId: string) => void;
  toggleBookmarkPoint: (pointId: string) => void;

  areas: typeof INITIAL_DATA.areas;
  addPointCreature: (pointId: string, creatureId: string, localRarity: Rarity) => Promise<void>;
  removePointCreature: (pointId: string, creatureId: string) => Promise<void>;
  addCreatureProposal: (creatureData: Omit<Creature, 'id' | 'status' | 'submitterId'>) => Promise<void>;
  addPointProposal: (pointData: Omit<Point, 'id' | 'status' | 'submitterId' | 'createdAt' | 'areaId'>) => Promise<void>;
  approveProposal: (type: 'creature' | 'point', id: string, data: any, submitterId: string) => Promise<void>;
  rejectProposal: (type: 'creature' | 'point', id: string) => Promise<void>;

  // Expose data directly
  creatures: Creature[];
  points: Point[];
  pointCreatures: PointCreature[]; // New relationship collection
  logs: Log[];
  recentLogs: Log[]; // Global recent logs
  proposalCreatures: (Creature & { proposalType?: string, diffData?: any, targetId?: string })[];
  proposalPoints: (Point & { proposalType?: string, diffData?: any, targetId?: string })[];
  regions: typeof INITIAL_DATA.regions;
  zones: typeof INITIAL_DATA.zones;

  // Admin
  allUsers: User[];
  updateUserRole: (uid: string, newRole: 'user' | 'moderator' | 'admin') => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User>(INITIAL_DATA.users[0]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isDeletingRef = useRef(false); // Guard to prevent auto-recreation during deletion

  // Data State
  const [creatures, setCreatures] = useState<Creature[]>(INITIAL_DATA.creatures);
  const [points, setPoints] = useState<Point[]>(INITIAL_DATA.points);
  const [pointCreatures, setPointCreatures] = useState<PointCreature[]>(INITIAL_DATA.pointCreatures);
  const [proposalCreatures, setProposalCreatures] = useState<Creature[]>([]);
  const [proposalPoints, setProposalPoints] = useState<Point[]>([]);
  const [allLogs, setAllLogs] = useState<Log[]>([]);
  const [recentLogs, setRecentLogs] = useState<Log[]>([]); // Added state
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // Master Data State (Initialized with Mock/Static, updated from DB if available)
  const [regions, setRegions] = useState<typeof INITIAL_DATA.regions>(INITIAL_DATA.regions);
  const [zones, setZones] = useState<typeof INITIAL_DATA.zones>(INITIAL_DATA.zones);
  const [areas, setAreas] = useState<typeof INITIAL_DATA.areas>(INITIAL_DATA.areas);

  // Subscribe to Master Data Collections
  useEffect(() => {
    // Regions
    const unsubR = onSnapshot(collection(firestore, 'regions'), (snap) => {
      if (!snap.empty) {
        setRegions(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as any)));
      }
    });
    // Zones
    const unsubZ = onSnapshot(collection(firestore, 'zones'), (snap) => {
      if (!snap.empty) {
        setZones(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as any)));
      }
    });
    // Areas
    const unsubA = onSnapshot(collection(firestore, 'areas'), (snap) => {
      if (!snap.empty) {
        setAreas(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as any)));
      }
    });

    return () => { unsubR(); unsubZ(); unsubA(); };
  }, []);

  // Listen for proposals (Admin view mostly)
  useEffect(() => {
    if (isAuthenticated) { // Ideally check for admin role here too, but simple Auth check for now
      const qCreatures = query(collection(firestore, 'creature_proposals'), where('status', '==', 'pending'));
      const unsubC = onSnapshot(qCreatures, (snapshot) => {
        setProposalCreatures(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Creature)));
      });

      const qPoints = query(collection(firestore, 'point_proposals'), where('status', '==', 'pending'));
      const unsubP = onSnapshot(qPoints, (snapshot) => {
        setProposalPoints(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Point)));
      });

      return () => { unsubC(); unsubP(); };
    }
  }, [isAuthenticated]);

  // Admin: Fetch All Users
  useEffect(() => {
    if (isAuthenticated && (currentUser.role === 'admin' || currentUser.role === 'moderator')) {
      const qUsers = query(collection(firestore, 'users'));
      const unsubUsers = onSnapshot(qUsers, (snapshot) => {
        setAllUsers(snapshot.docs.map(doc => doc.data() as User));
      });
      return () => unsubUsers();
    }
  }, [isAuthenticated, currentUser.role]);

  /*
   * FIRESTORE SECURITY RULES (Placeholder):
   *
   * match /creature_proposals/{document=**} {
   *   allow read: if request.auth != null;
   *   allow create: if request.auth != null;
   *   allow update: if request.auth != null && (resource.data.submitterId == request.auth.uid || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['moderator', 'admin']);
   * }
   *
   * match /point_proposals/{document=**} {
   *   allow read: if request.auth != null;
   *   allow create: if request.auth != null;
   *   allow update: if request.auth != null && (resource.data.submitterId == request.auth.uid || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['moderator', 'admin']);
   * }
   */

  // Proposal Functions
  const addCreatureProposal = async (creatureData: any) => {
    if (!isAuthenticated) return;
    try {
      // eslint-disable-next-line react-hooks/purity
      const newId = `prop_c_${Date.now()}`;
      await setDoc(doc(firestore, 'creature_proposals', newId), {
        ...creatureData,
        status: 'pending',
        submitterId: currentUser.id,
        createdAt: new Date().toISOString(),
        proposalType: creatureData.proposalType || 'create' // Default to create
      });
      // 提案ボーナス (+1点)
      await increaseTrustScore(currentUser.id, 1);
    } catch (e) { console.error(e); }
  };

  const addPointProposal = async (pointData: any) => {
    if (!isAuthenticated) return;
    try {
      // eslint-disable-next-line react-hooks/purity
      const newId = `prop_p_${Date.now()}`;
      // areaId is required by Point type but proposals might not have it strictly linked yet?
      // Or we just provide a placeholder.
      const fullPointData = {
        ...pointData,
        areaId: pointData.areaId || 'area_unknown', // Placeholder
        status: 'pending',
        submitterId: currentUser.id,
        createdAt: new Date().toISOString(),
        proposalType: pointData.proposalType || 'create'
      };

      await setDoc(doc(firestore, 'point_proposals', newId), fullPointData);
      await increaseTrustScore(currentUser.id, 1);
    } catch (e) { console.error(e); }
  };

  const approveProposal = async (type: 'creature' | 'point', id: string, data: any, submitterId: string) => {
    const targetCol = type === 'creature' ? 'creatures' : 'points';
    const proposalType = data.proposalType || 'create';

    if (proposalType === 'create') {
      // 1. Copy to main collection
      // eslint-disable-next-line react-hooks/purity
      const realId = type === 'creature' ? `c${Date.now()}` : `p${Date.now()}`; // Generate real ID
      const realData = { ...data, id: realId, status: 'approved' };
      // cleanup proposal meta fields if needed
      delete realData.proposalType;
      delete realData.diffData;
      delete realData.targetId;

      await setDoc(doc(firestore, targetCol, realId), realData);
    } else if (proposalType === 'update' && data.targetId && data.diffData) {
      // 2. Update existing document
      await setDoc(doc(firestore, targetCol, data.targetId), data.diffData, { merge: true });
    }

    // 2. Update proposal status OR delete.
    const proposalCol = type === 'creature' ? 'creature_proposals' : 'point_proposals';
    await updateDoc(doc(firestore, proposalCol, id), { status: 'approved' });

    // 3. Reward Submitter (+5 points)
    await increaseTrustScore(submitterId, 5);
  };

  const rejectProposal = async (type: 'creature' | 'point', id: string) => {
    const proposalCol = type === 'creature' ? 'creature_proposals' : 'point_proposals';
    await updateDoc(doc(firestore, proposalCol, id), { status: 'rejected' });
  };

  // Internal: Trust Score Logic
  const increaseTrustScore = async (userId: string, amount: number) => {
    const userRef = doc(firestore, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;

    const userData = userSnap.data() as User;
    const currentScore = userData.trustScore || 0;
    const newScore = currentScore + amount;

    // Check Rank Up
    let newRole = userData.role;
    // const currentRank = TRUST_RANKS.slice().reverse().find(r => currentScore >= r.minScore);
    const nextRank = TRUST_RANKS.slice().reverse().find(r => newScore >= r.minScore);     // Potential new rank

    // If reached a rank that upgrades role AND user is 'user' role currently
    if (nextRank && nextRank.roleUpgrade && userData.role === 'user') {
      newRole = 'moderator';
    }

    await updateDoc(userRef, {
      trustScore: newScore,
      role: newRole
    });
  };
  // For now, let's load ALL logs from the current User? Or Global logs?
  // The requirement says "Logs: users/{userID}/logs/{logID}".
  // If we want to show a timeline of ALL users, we need a collection group query or a top-level logs collection.
  // The Mock Data had a global LOGS array.
  // For this refactor, let's assume we want to see the CURRENT USER's logs primarily,
  // OR we need to fetch logs for the Timeline.
  // "Log book display" usually implies user's personal log.
  // However, "Home" page shows timeline?
  // Let's implement fetching Current User's logs for now as per requirement 2.
  // Wait, requirement 2 says "Logs: users/{userID}/logs/{logID}".
  // Requirement 4 says "confirm logbook display and add log function".

  // Realtime Sync: Master Data
  useEffect(() => {
    const unsubCreatures = onSnapshot(collection(firestore, 'creatures'), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Creature);
      setCreatures(data);
    });

    const unsubPoints = onSnapshot(collection(firestore, 'points'), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Point);
      setPoints(data);
    });

    const unsubPointCreatures = onSnapshot(collection(firestore, 'point_creatures'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as PointCreature));
      setPointCreatures(data);
    });

    // 4. Global Recent Public Logs (for Home)
    let unsubPublicLogs: () => void = () => { };
    try {
      // Fetch more than needed to account for private logs filtering
      // Update: Must include where clause for security rules to work and index to be used correctly.
      const publicLogsQuery = query(
        collectionGroup(firestore, 'logs'),
        where('isPrivate', '==', false),
        orderBy('date', 'desc'),
        limit(20)
      );
      unsubPublicLogs = onSnapshot(publicLogsQuery, (snapshot) => {
        const loadedLogs = snapshot.docs.map(doc => doc.data() as Log);
        // const publicLogs = loadedLogs.filter(l => !l.isPrivate); // Filtered by query now
        setRecentLogs(loadedLogs);
      });
    } catch (e) { console.error("Error fetching public logs:", e); }

    return () => {
      unsubCreatures();
      unsubPoints();
      unsubPointCreatures();
      unsubPublicLogs();
    };
  }, []);

  // Auth & User Data Sync
  useEffect(() => {
    let unsubUser: () => void;
    let unsubLogs: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsAuthenticated(true);
        setIsLoading(true);

        // 1. Seed Data if needed (Check one collection?)
        // optimizing: only run if we suspect empty?
        // For safety, let's run it. seeder checks emptiness internally.
        // [Safety Switch] Disabled automatic seeding to prevent overwriting user edits.
        // await seedFirestore();

        // 2. Listen to User Document
        const userDocRef = doc(firestore, 'users', user.uid);
        unsubUser = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setCurrentUser(docSnap.data() as User);
          } else {
            // Guard: Do NOT create if we are in process of deleting
            if (isDeletingRef.current) {
              console.log("Skipping user recreation - Deletion in progress");
              return;
            }

            // Create if not exists (should be handled by seeder or here)
            const newUser: User = {
              id: user.uid,
              name: user.displayName || 'No Name',
              role: 'user',
              trustScore: 0,
              profileImage: user.photoURL || undefined,
              logs: [],
              favoriteCreatureIds: [],
              favorites: {
                points: [],
                areas: [],
                shops: [],
                gear: { tanks: [] }
              },
              wanted: [],
              bookmarkedPointIds: [],
              createdAt: new Date().toISOString(),
              status: 'provisional' // Initial status before Terms Agreement
            };
            setDoc(userDocRef, newUser).catch(console.error);
            setCurrentUser(newUser);
          }
          setIsLoading(false);
        });

        const logsQuery = query(collection(firestore, 'users', user.uid, 'logs'), orderBy('date', 'desc'));
        unsubLogs = onSnapshot(logsQuery, (snapshot) => {
          const loadedLogs = snapshot.docs.map(doc => doc.data() as Log);
          setAllLogs(loadedLogs);
        });

        // 4. Global Recent Public Logs (for Home)
        try {
          // ...
        } catch (e) { console.error(e); }

      } else {
        setIsAuthenticated(false);
        setIsLoading(false);
        // Reset to Guest/Mock?
        setCurrentUser(INITIAL_DATA.users[0]);
        setAllLogs([]); // Clear logs on logout
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubUser) unsubUser();
      if (unsubLogs) unsubLogs();
    };
  }, []);

  const login = async () => {
    try {
      setIsLoading(true);
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
      setIsLoading(false);
    }
  };

  const deleteAccount = async () => {
    if (!auth.currentUser || !isAuthenticated) return;
    const uid = auth.currentUser.uid;

    setIsLoading(true);
    isDeletingRef.current = true; // Set Guard

    try {
      // 1. Delete all logs
      const logsRef = collection(firestore, 'users', uid, 'logs');
      // We need to fetch ID first to delete
      // Note: Client SDK cannot delete collection directly.
      // Since we have allLogs in state, we can use that IDs or fetch fresh.
      // Fetch fresh to be safe.
      // const q = query(logsRef); // all
      // const snapshot = await getDocs(q); // need getDocs import
      // Actually we have `allLogs` state synced. Use it.

      const batch = writeBatch(firestore);
      let count = 0;
      allLogs.forEach(log => {
        batch.delete(doc(firestore, 'users', uid, 'logs', log.id));
        count++;
      });
      if (count > 0) await batch.commit();

      // 2. Delete User Data
      // This will trigger onSnapshot -> which will trigger the Guard logic
      await deleteDoc(doc(firestore, 'users', uid));

      // 3. Delete Auth Account
      await auth.currentUser.delete(); // This also signs out

      // State reset handled by onAuthStateChanged

    } catch (error: any) {
      console.error("Delete Account failed:", error);
      isDeletingRef.current = false; // Reset Guard on error

      // Fallback: Ensure logout happens even if deletion fails (e.g. requires-recent-login)
      if (error.code === 'auth/requires-recent-login') {
        alert("セキュリティ保護のため、時間の経過したログインセッションでのアカウント削除はできません。\n一度ログアウトします。再ログイン後に再度お試しください。");
      } else {
        alert("退会処理中にエラーが発生しましたが、ログアウトします。");
      }

      await signOut(auth);
      setIsLoading(false);
    }
  };

  // Rarity Calculation (Spot-specific, All-time)
  const calculateRarity = (creatureId: string, spotId?: string): Rarity => {
    // Base rarity from creature definition
    const creature = creatures.find(c => c.id === creatureId);
    if (creature?.rarity) return creature.rarity;

    // Fallback logic (if rarity not defined)
    // Use allLogs (which we are now syncing for the user, but for global rarity we might need more data.
    // For now, use available logs)
    const creatureLogs = allLogs.filter(l => l.creatureId === creatureId);

    if (spotId) {
      const spotLogs = allLogs.filter(l => l.location.pointId === spotId);
      const spotCreatureLogs = spotLogs.filter(l => l.creatureId === creatureId);
      const encounterRate = spotLogs.length > 0 ? spotCreatureLogs.length / spotLogs.length : 0;

      if (encounterRate > 0.3) return 'Common';
      if (encounterRate > 0.1) return 'Rare';
      if (encounterRate > 0.01) return 'Epic';
      return 'Legendary';
    }

    // Global rarity fallback
    const totalLogs = allLogs.length;
    const globalRate = totalLogs > 0 ? creatureLogs.length / totalLogs : 0;

    if (globalRate > 0.2) return 'Common';
    if (globalRate > 0.05) return 'Rare';
    if (globalRate > 0.005) return 'Epic';
    return 'Legendary';
  };

  const addLog = async (logData: Omit<Log, 'id' | 'userId'>) => {
    console.log("[CTX] addLog called with:", logData);
    const newLogId = `l${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    // Force Sync spotId with location.pointId
    const finalSpotId = logData.location?.pointId || logData.spotId || '';

    const newLog: Log = {
      ...logData,
      id: newLogId,
      userId: currentUser.id,
      spotId: finalSpotId, // Ensure it is set
    };

    // Sanitize before saving
    const payload = sanitizePayload(newLog);

    console.log("[CTX] Constructed newLog with spotId:", finalSpotId);

    // Firestore Persist (Subcollection)
    if (isAuthenticated) {
      try {
        const ref = doc(firestore, 'users', currentUser.id, 'logs', newLogId);
        await setDoc(ref, payload);

        // Optimistic Update removed to prevent duplication with onSnapshot
        // setAllLogs(prev => [logWithId, ...prev]);
        if (!newLog.isPrivate) {
          // For global/recent logs, we might still want it if the query doesn't catch local immediately?
          // But usually onSnapshot covers local latency too.
          // setRecentLogs(prev => [logWithId, ...prev]);
        }
      } catch (e) {
        console.error("Error adding log:", e);
      }
    }
  };

  const addCreature = async (creatureData: Omit<Creature, 'id'>) => {
    const newCreature: Creature = {
      ...creatureData,
      id: `c${Date.now()}`,
    };

    // Firestore Persist
    if (isAuthenticated) {
      try {
        await setDoc(doc(firestore, 'creatures', newCreature.id), newCreature);
      } catch (e) {
        console.error(e);
      }
    }
    return newCreature;
  };

  const addPoint = async (pointData: Omit<Point, 'id'>) => {
    const newPoint: Point = {
      ...pointData,
      id: `p${Date.now()}`,
    };

    // Firestore Persist
    if (isAuthenticated) {
      try {
        await setDoc(doc(firestore, 'points', newPoint.id), newPoint);
      } catch (e) {
        console.error(e);
      }
    }
    return newPoint;
  };

  const addPointCreature = async (pointId: string, creatureId: string, localRarity: Rarity) => {
    console.log(`[CTX - ADD] addPointCreature: ${pointId}, ${creatureId}, ${localRarity} `);
    if (!isAuthenticated) return;

    // ID generation
    const relId = `${pointId}_${creatureId}`;
    const pointCreatureData: PointCreature = {
      id: relId,
      pointId,
      creatureId,
      localRarity,
      status: (currentUser.role === 'admin' || currentUser.role === 'moderator') ? 'approved' : 'pending' // Pending for users
    };

    // Optimistic Update
    setPointCreatures(prev => {
      console.log(`[CTX - ADD] Updating state...`);
      const existing = prev.find(p => p.id === relId);
      if (existing) return prev.map(p => p.id === relId ? pointCreatureData : p);
      return [...prev, pointCreatureData];
    });

    try {
      await setDoc(doc(firestore, 'point_creatures', relId), pointCreatureData);
      console.log(`[CTX - ADD] Firestore write success`);
    } catch (e) {
      console.error(`[CTX - ADD] Firestore write failed`, e);
      throw e;
    }
  };

  const removePointCreature = async (pointId: string, creatureId: string) => {
    if (!isAuthenticated) return;

    // DEBUG: Check what we are trying to delete
    console.log(`[DELETE] Request: Point = ${pointId}, Creature = ${creatureId} `);
    const target = pointCreatures.find(pc => pc.pointId === pointId && pc.creatureId === creatureId);
    console.log(`[DELETE] Found Target in State: `, target);

    // If not found in state, try constructing it, but prefer state
    const realId = target ? target.id : `${pointId}_${creatureId} `;
    console.log(`[DELETE] Using ID: ${realId} `);

    // Admin/Mod: Force Delete
    if (currentUser.role === 'admin' || currentUser.role === 'moderator') {
      console.log(`[DELETE] Action: Force Delete(Admin)`);
      // Optimistic Delete
      setPointCreatures(prev => {
        const exists = prev.find(p => p.id === realId);
        console.log(`[DELETE] Optimistic remove.Exists in prev ? `, !!exists);
        return prev.filter(p => p.id !== realId);
      });
      try {
        await deleteDoc(doc(firestore, 'point_creatures', realId));
        console.log(`[DELETE] Firestore delete success`);
      } catch (e) { console.error(`[DELETE] Firestore error: `, e); }
    } else {
      console.log(`[DELETE] Action: Request Deletion(User)`);
      // User: Request Deletion
      // Optimistic Update
      setPointCreatures(prev => prev.map(p => p.id === realId ? { ...p, status: 'deletion_requested' } : p));
      try {
        await updateDoc(doc(firestore, 'point_creatures', realId), {
          status: 'deletion_requested'
        });
      } catch (e) { console.error(e); }
    }
  };

  const deleteLog = async (logId: string) => {
    if (!isAuthenticated) return;
    try {
      // Delete from Firestore
      const logRef = doc(firestore, 'users', currentUser.id, 'logs', logId);
      await deleteDoc(logRef);
      console.log("[CTX] Log deleted:", logId);

      // Optimistic update for UI (though snapshot listener usually handles this)
      setAllLogs(prev => prev.filter(l => l.id !== logId));
      setRecentLogs(prev => prev.filter(l => l.id !== logId));

    } catch (e) {
      console.error("Error deleting log:", e);
    }
  };

  const deleteLogs = async (logIds: string[]) => {
    if (!isAuthenticated) return;
    try {
      // Batch delete
      // Note: Firestore batch has limit of 500 ops. Assuming selection is smaller for now.
      const batch = writeBatch(firestore);
      logIds.forEach(id => {
        const ref = doc(firestore, 'users', currentUser.id, 'logs', id);
        batch.delete(ref);
      });
      await batch.commit();
      console.log("[CTX] Bulk logs deleted:", logIds.length);

      // Optimistic update
      setAllLogs(prev => prev.filter(l => !logIds.includes(l.id)));
      setRecentLogs(prev => prev.filter(l => !logIds.includes(l.id)));
    } catch (e) {
      console.error("Error bulk deleting logs:", e);
      throw e;
    }
  };

  const updateLog = async (logId: string, logData: Partial<Log>) => {
    // Force Sync spotId if location.pointId is present
    const rawPayload = { ...logData };
    if (rawPayload.location?.pointId) {
      rawPayload.spotId = rawPayload.location.pointId;
    }

    const payload = sanitizePayload(rawPayload);

    // Firestore Persist
    if (isAuthenticated) {
      try {
        const logRef = doc(firestore, 'users', currentUser.id, 'logs', logId);
        await updateDoc(logRef, payload);

        // Optimistic Update
        setAllLogs(prev => prev.map(l => l.id === logId ? { ...l, ...payload } as Log : l));
      } catch (e) {
        console.error(e);
      }
    }
  };

  const updateCreature = async (creatureId: string, creatureData: Partial<Creature>) => {
    // Firestore Persist
    if (isAuthenticated) {
      try {
        const creatureRef = doc(firestore, 'creatures', creatureId);
        await updateDoc(creatureRef, creatureData);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const updatePoint = async (pointId: string, pointData: Partial<Point>) => {
    // Firestore Persist
    if (isAuthenticated) {
      try {
        const pointRef = doc(firestore, 'points', pointId);
        await updateDoc(pointRef, pointData);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const updateLogs = async (logIds: string[], data: Record<string, any>) => {
    if (!isAuthenticated) return;

    // Force Sync spotId if location.pointId is present (dot notation)
    const rawPayload = { ...data };
    if (rawPayload['location.pointId']) {
      rawPayload['spotId'] = rawPayload['location.pointId'];
    }

    const payload = sanitizePayload(rawPayload);

    try {
      const batch = writeBatch(firestore);
      logIds.forEach(id => {
        const ref = doc(firestore, 'users', currentUser.id, 'logs', id);
        batch.update(ref, payload);
      });
      await batch.commit();
      console.log("[CTX] Bulk logs updated:", logIds.length);

      // Optimistic Update (Manual reload might be needed or we map manually)
      setAllLogs(prev => prev.map(l => {
        if (logIds.includes(l.id)) {
          // Deep merge simulation for optimistic update is hard with dot notation.
          // But simple spotId update is key.
          const newL = { ...l };
          // Very basic handling for key update
          if (payload['spotId']) newL.spotId = payload['spotId'];
          if (payload.isPrivate !== undefined) newL.isPrivate = payload.isPrivate;
          return newL;
        }
        return l;
      }));

    } catch (e) {
      console.error("Error bulk updating logs:", e);
      throw e;
    }
  };

  const updateUser = async (userData: Partial<User>) => {
    // Optimistic update
    setCurrentUser(prev => ({ ...prev, ...userData }));

    // Firestore Persist
    if (isAuthenticated) {
      try {
        await updateDoc(doc(firestore, 'users', currentUser.id), userData);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const toggleLikeLog = async (log: Log) => {
    if (!isAuthenticated) return;
    const logId = log.id;
    const ownerId = log.userId;

    // Current State
    const currentLikedBy = log.likedBy || [];
    const currentLikeCount = log.likeCount || 0;
    const isLiked = currentLikedBy.includes(currentUser.id);

    const newLikedBy = isLiked
      ? currentLikedBy.filter(id => id !== currentUser.id)
      : [...currentLikedBy, currentUser.id];

    console.log("[AppContext] toggling like. LogId:", logId, "NewState:", isLiked ? "Unlike" : "Like");

    const newLikeCount = isLiked ? currentLikeCount - 1 : currentLikeCount + 1;

    // Optimistic Update
    const updateLogState = (prevLogs: Log[]) =>
      prevLogs.map(l =>
        l.id === logId
          ? { ...l, likedBy: newLikedBy, likeCount: newLikeCount }
          : l
      );

    setAllLogs(prev => updateLogState(prev));
    setRecentLogs(prev => updateLogState(prev));

    // Firestore Persist
    if (isAuthenticated) {
      try {
        const logRef = doc(firestore, 'users', ownerId, 'logs', logId);
        await updateDoc(logRef, { likedBy: newLikedBy, likeCount: newLikeCount });
      } catch (e) {
        console.error(e);
        // Revert on error (optional, but good practice)
        // setAllLogs(prev => ... revert ...);
      }
    }
  };

  const toggleFavorite = async (creatureId: string) => {
    const isFavorite = currentUser.favoriteCreatureIds?.includes(creatureId);
    const newFavorites = isFavorite
      ? currentUser.favoriteCreatureIds.filter(id => id !== creatureId)
      : [...(currentUser.favoriteCreatureIds || []), creatureId];

    // Optimistic
    setCurrentUser(prev => ({ ...prev, favoriteCreatureIds: newFavorites }));

    // Firestore Persist
    if (isAuthenticated) {
      try {
        await updateDoc(doc(firestore, 'users', currentUser.id), { favoriteCreatureIds: newFavorites });
      } catch (e) {
        console.error(e);
      }
    }
  };

  const toggleWanted = async (creatureId: string) => {
    const isWanted = currentUser.wanted.includes(creatureId);
    const newWanted = isWanted
      ? currentUser.wanted.filter(id => id !== creatureId)
      : [...currentUser.wanted, creatureId];

    // Optimistic
    setCurrentUser(prev => ({ ...prev, wanted: newWanted }));

    // Firestore Persist
    if (isAuthenticated) {
      try {
        await updateDoc(doc(firestore, 'users', currentUser.id), { wanted: newWanted });
      } catch (e) {
        console.error(e);
      }
    }
  };

  const toggleBookmarkPoint = async (pointId: string) => {
    const isBookmarked = currentUser.bookmarkedPointIds.includes(pointId);
    const newBookmarked = isBookmarked
      ? currentUser.bookmarkedPointIds.filter(id => id !== pointId)
      : [...currentUser.bookmarkedPointIds, pointId];

    // Optimistic
    setCurrentUser(prev => ({ ...prev, bookmarkedPointIds: newBookmarked }));

    // Firestore Persist (User Bookmarks)
    if (isAuthenticated) {
      try {
        await updateDoc(doc(firestore, 'users', currentUser.id), { bookmarkedPointIds: newBookmarked });

        // Update point bookmark count
        // Note: For real concurrency, we should use increment/decrement.
        // But for now, read-modify-write or just client-side assumption is okay.
        // Actually best to use `increment`.
        // We'll trust the current `points` state for the count? Or fetch fresh?
        // Let's implement increment logic if possible, or just skip count update on client
        // and let server functions handle it (too advanced).
        // Let's standard update.
        const point = points.find(p => p.id === pointId);
        if (point) {
          const newCount = isBookmarked ? (point.bookmarkCount || 0) - 1 : (point.bookmarkCount || 0) + 1;
          await updateDoc(doc(firestore, 'points', pointId), { bookmarkCount: Math.max(0, newCount) });
        }
        // Note: Adding `increment` to imports is better.
      } catch (e) {
        console.error(e);
      }
    }
  };

  const updateUserRole = async (uid: string, newRole: 'user' | 'moderator' | 'admin') => {
    if (!isAuthenticated || currentUser.role !== 'admin') {
      console.warn("Only users with role 'admin' can update user roles.");
      return;
    }
    // Optimistic local update if target is in allUsers
    setAllUsers(prev => prev.map(u => u.id === uid ? { ...u, role: newRole } : u));

    try {
      await updateDoc(doc(firestore, 'users', uid), { role: newRole });
    } catch (e) {
      console.error("Error updating user role:", e);
      // Revert? (Not implemented for simplicity)
    }
  };

  const value = {
    // db, // Removed
    currentUser,
    isAuthenticated,
    isLoading,
    login,
    logout,
    calculateRarity,
    addLog,
    addCreature,
    addPoint,
    addPointCreature,
    removePointCreature,
    updateLog,
    updateCreature,
    updatePoint,
    deleteLog,
    deleteLogs,
    updateLogs,
    updateUser,
    toggleLikeLog,
    toggleFavorite,
    toggleWanted,
    toggleBookmarkPoint,
    // Expose Data
    creatures,
    points,
    pointCreatures, // New
    logs: allLogs,
    recentLogs, // Added to value
    proposalCreatures,
    proposalPoints,
    regions,
    zones,
    areas,
    addCreatureProposal,
    addPointProposal,
    approveProposal,
    rejectProposal,
    allUsers,
    updateUserRole,
    deleteAccount
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
