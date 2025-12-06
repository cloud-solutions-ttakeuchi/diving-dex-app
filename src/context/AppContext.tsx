import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User, Log, Rarity, Creature, Point, PointCreature } from '../types';
import { INITIAL_DATA, TRUST_RANKS } from '../data/mockData';
import { auth, googleProvider, db as firestore } from '../lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, updateDoc, deleteDoc, collection, onSnapshot, query, orderBy, where, getDoc } from 'firebase/firestore';
import { seedFirestore } from '../utils/seeder';

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
  updateUser: (userData: Partial<User>) => void;
  toggleLikeLog: (logId: string) => void;
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
  proposalCreatures: (Creature & { proposalType?: string, diffData?: any, targetId?: string })[];
  proposalPoints: (Point & { proposalType?: string, diffData?: any, targetId?: string })[];
  regions: typeof INITIAL_DATA.regions;
  zones: typeof INITIAL_DATA.zones;

  // Admin
  allUsers: User[];
  updateUserRole: (uid: string, newRole: 'user' | 'moderator' | 'admin') => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User>(INITIAL_DATA.users[0]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Data State
  const [creatures, setCreatures] = useState<Creature[]>(INITIAL_DATA.creatures);
  const [points, setPoints] = useState<Point[]>(INITIAL_DATA.points);
  const [pointCreatures, setPointCreatures] = useState<PointCreature[]>(INITIAL_DATA.pointCreatures);
  const [proposalCreatures, setProposalCreatures] = useState<Creature[]>([]);
  const [proposalPoints, setProposalPoints] = useState<Point[]>([]);
  const [allLogs, setAllLogs] = useState<Log[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);

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

    return () => {
      unsubCreatures();
      unsubPoints();
      unsubPointCreatures();
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
        await seedFirestore();

        // 2. Listen to User Document
        const userDocRef = doc(firestore, 'users', user.uid);
        unsubUser = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setCurrentUser(docSnap.data() as User);
          } else {
            // Create if not exists (should be handled by seeder or here)
            const newUser: User = {
              id: user.uid,
              name: user.displayName || 'No Name',
              role: 'user',
              trustScore: 0,
              profileImage: user.photoURL || undefined,
              logs: [], // Legacy field, might be empty if we use subcollection
              favorites: [],
              wanted: [],
              bookmarkedPointIds: [],
            };
            setDoc(userDocRef, newUser).catch(console.error);
            setCurrentUser(newUser);
          }
          setIsLoading(false);
        });

        // 3. Listen to User's Logs Subcollection
        const logsQuery = query(collection(firestore, 'users', user.uid, 'logs'), orderBy('date', 'desc'));
        unsubLogs = onSnapshot(logsQuery, (snapshot) => {
          const loadedLogs = snapshot.docs.map(doc => doc.data() as Log);
          setAllLogs(loadedLogs);
        });

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
    const newLogId = `l${Date.now()}`;
    const newLog: Log = {
      ...logData,
      id: newLogId,
      userId: currentUser.id,
    };
    console.log("[CTX] Constructed newLog:", newLog);

    // Firestore Persist (Subcollection)
    if (isAuthenticated) {
      try {
        const ref = doc(firestore, 'users', currentUser.id, 'logs', newLogId);
        console.log("[CTX] Writing to Firestore path:", ref.path);

        await setDoc(ref, newLog);
        console.log("[CTX] Firestore write successful for log:", newLogId);

        // We might not need to update 'users' logs array if we rely on subcollection.
        // But for safety/legacy checks:
        // updateDoc(doc(firestore, 'users', currentUser.id), { logs: arrayUnion(newLogId) });
      } catch (e) {
        console.error("Error adding log:", e);
      }
    } else {
      console.warn("[CTX] addLog skipped: Not authenticated");
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
    console.log(`[CTX-ADD] addPointCreature: ${pointId}, ${creatureId}, ${localRarity}`);
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
      console.log(`[CTX-ADD] Updating state...`);
      const existing = prev.find(p => p.id === relId);
      if (existing) return prev.map(p => p.id === relId ? pointCreatureData : p);
      return [...prev, pointCreatureData];
    });

    try {
      await setDoc(doc(firestore, 'point_creatures', relId), pointCreatureData);
      console.log(`[CTX-ADD] Firestore write success`);
    } catch (e) {
      console.error(`[CTX-ADD] Firestore write failed`, e);
      throw e;
    }
  };

  const removePointCreature = async (pointId: string, creatureId: string) => {
    if (!isAuthenticated) return;

    // DEBUG: Check what we are trying to delete
    console.log(`[DELETE] Request: Point=${pointId}, Creature=${creatureId}`);
    const target = pointCreatures.find(pc => pc.pointId === pointId && pc.creatureId === creatureId);
    console.log(`[DELETE] Found Target in State:`, target);

    // If not found in state, try constructing it, but prefer state
    const realId = target ? target.id : `${pointId}_${creatureId}`;
    console.log(`[DELETE] Using ID: ${realId}`);

    // Admin/Mod: Force Delete
    if (currentUser.role === 'admin' || currentUser.role === 'moderator') {
      console.log(`[DELETE] Action: Force Delete (Admin)`);
      // Optimistic Delete
      setPointCreatures(prev => {
        const exists = prev.find(p => p.id === realId);
        console.log(`[DELETE] Optimistic remove. Exists in prev?`, !!exists);
        return prev.filter(p => p.id !== realId);
      });
      try {
        await deleteDoc(doc(firestore, 'point_creatures', realId));
        console.log(`[DELETE] Firestore delete success`);
      } catch (e) { console.error(`[DELETE] Firestore error:`, e); }
    } else {
      console.log(`[DELETE] Action: Request Deletion (User)`);
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

  const updateLog = async (logId: string, logData: Partial<Log>) => {
    // Firestore Persist
    if (isAuthenticated) {
      try {
        const logRef = doc(firestore, 'users', currentUser.id, 'logs', logId);
        await updateDoc(logRef, logData);
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



  const toggleLikeLog = async (logId: string) => {
    // In new structure, logs are user-specific.
    // If we can only like OUR logs, it's easy.
    // But usually we like OTHERS' logs.
    // If Logs are subcollection of Users, we need to know the Owner ID of the log to update it.
    // However, the `logId` might not contain owner info.
    // If `allLogs` contains `userId`, we can find it there.
    const log = allLogs.find(l => l.id === logId);
    // Note: if we are viewing ANOTHER user's log, `allLogs` might only contain CURRENT user's logs
    // depending on how we fetched.
    // IF we are on a page viewing another user, we probably fetched their logs.
    // For now, let's assume `log` is found in `allLogs` (which implies we are viewing it).

    if (!log) return;

    // Use userId from log to target the correct path: users/{ownerId}/logs/{logId}
    const ownerId = log.userId;

    const currentLikedBy = log.likedBy || [];
    const currentLikeCount = log.likeCount || 0;

    const isLiked = currentLikedBy.includes(currentUser.id);
    const newLikedBy = isLiked
      ? currentLikedBy.filter(id => id !== currentUser.id)
      : [...currentLikedBy, currentUser.id];

    const newLikeCount = isLiked ? currentLikeCount - 1 : currentLikeCount + 1;

    // Firestore Persist
    if (isAuthenticated) {
      try {
        const logRef = doc(firestore, 'users', ownerId, 'logs', logId);
        await updateDoc(logRef, { likedBy: newLikedBy, likeCount: newLikeCount });
      } catch (e) {
        console.error(e);
      }
    }
  };

  const toggleFavorite = async (creatureId: string) => {
    const isFavorite = currentUser.favorites.includes(creatureId);
    const newFavorites = isFavorite
      ? currentUser.favorites.filter(id => id !== creatureId)
      : [...currentUser.favorites, creatureId];

    // Optimistic
    setCurrentUser(prev => ({ ...prev, favorites: newFavorites }));

    // Firestore Persist
    if (isAuthenticated) {
      try {
        await updateDoc(doc(firestore, 'users', currentUser.id), { favorites: newFavorites });
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

  return (
    <AppContext.Provider value={{
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
      proposalCreatures,
      proposalPoints,
      regions: INITIAL_DATA.regions,
      zones: INITIAL_DATA.zones,
      areas: INITIAL_DATA.areas,
      addCreatureProposal,
      addPointProposal,
      approveProposal,
      rejectProposal,
      allUsers,
      updateUserRole,
    }}>
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
