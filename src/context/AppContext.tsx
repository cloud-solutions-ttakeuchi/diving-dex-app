import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import type { User, Log, Rarity, Creature, Point, PointCreature } from '../types';
import { INITIAL_DATA } from '../data/initialData';
import { auth, googleProvider, db as firestore, functions } from '../lib/firebase';
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
  collectionGroup,
  limit,
  writeBatch
} from 'firebase/firestore';
import { connectFunctionsEmulator } from 'firebase/functions';

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
  currentUser: User;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  calculateRarity: (creatureId: string) => Rarity;
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
  addPointProposal: (pointData: Omit<Point, 'id' | 'status' | 'submitterId' | 'createdAt' | 'areaId' | 'zoneId' | 'regionId' | 'bookmarkCount'>) => Promise<void>;
  approveProposal: (type: 'creature' | 'point', id: string, data: any) => Promise<void>;
  rejectProposal: (type: 'creature' | 'point', id: string) => Promise<void>;

  // Expose data directly
  creatures: Creature[];
  points: Point[];
  pointCreatures: PointCreature[];
  logs: Log[];
  recentLogs: Log[];
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

const GUEST_USER: User = {
  id: 'guest',
  name: 'Guest',
  role: 'user',
  trustScore: 0,
  logs: [],
  favoriteCreatureIds: [],
  favorites: { points: [], areas: [], shops: [], gear: { tanks: [] } },
  wanted: [],
  bookmarkedPointIds: []
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User>(GUEST_USER);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isDeletingRef = useRef(false);

  // Data State
  const [creatures, setCreatures] = useState<Creature[]>(INITIAL_DATA.creatures);
  const [points, setPoints] = useState<Point[]>(INITIAL_DATA.points);
  const [pointCreatures, setPointCreatures] = useState<PointCreature[]>(INITIAL_DATA.pointCreatures);
  const [proposalCreatures, setProposalCreatures] = useState<Creature[]>([]);
  const [proposalPoints, setProposalPoints] = useState<Point[]>([]);
  const [allLogs, setAllLogs] = useState<Log[]>([]);
  const [recentLogs, setRecentLogs] = useState<Log[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // Master Data State
  const [regions, setRegions] = useState<typeof INITIAL_DATA.regions>(INITIAL_DATA.regions);
  const [zones, setZones] = useState<typeof INITIAL_DATA.zones>(INITIAL_DATA.zones);
  const [areas, setAreas] = useState<typeof INITIAL_DATA.areas>(INITIAL_DATA.areas);

  // Emulator connections (development only)
  useEffect(() => {
    if (import.meta.env.DEV) {
      if (!(window as any)._firebaseFunctionsConnected) {
        connectFunctionsEmulator(functions, "localhost", 5001);
        (window as any)._firebaseFunctionsConnected = true;
      }
    }
  }, []);

  // 1. Master Data Sync (Regions, Zones, Areas)
  useEffect(() => {
    const unsubR = onSnapshot(collection(firestore, 'regions'), (snap) => {
      if (!snap.empty) setRegions(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as any)));
    });
    const unsubZ = onSnapshot(collection(firestore, 'zones'), (snap) => {
      if (!snap.empty) setZones(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as any)));
    });
    const unsubA = onSnapshot(collection(firestore, 'areas'), (snap) => {
      if (!snap.empty) setAreas(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as any)));
    });
    return () => { unsubR(); unsubZ(); unsubA(); };
  }, []);

  // 2. Core Data Sync (Creatures, Points, PointCreatures)
  useEffect(() => {
    const unsubCreatures = onSnapshot(collection(firestore, 'creatures'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Creature));
      setCreatures(data);
    });

    const unsubPoints = onSnapshot(collection(firestore, 'points'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Point));
      setPoints(data);
    });

    const unsubPointCreatures = onSnapshot(collection(firestore, 'point_creatures'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as PointCreature));
      setPointCreatures(data);
    });

    // Global Recent Public Logs
    let unsubPublicLogs: () => void = () => { };
    try {
      const publicLogsQuery = query(collectionGroup(firestore, 'logs'), where('isPrivate', '==', false), orderBy('date', 'desc'), limit(20));
      unsubPublicLogs = onSnapshot(publicLogsQuery, (snapshot) => {
        setRecentLogs(snapshot.docs.map(doc => doc.data() as Log));
      });
    } catch (e) { console.error(e); }

    return () => {
      unsubCreatures(); unsubPoints(); unsubPointCreatures(); unsubPublicLogs();
    };
  }, []);

  // 3. Auth & User-Specific Sync
  useEffect(() => {
    let unsubUser: (() => void) | undefined;
    let unsubLogs: (() => void) | undefined;
    let unsubProposalsC: (() => void) | undefined;
    let unsubProposalsP: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsAuthenticated(true);
        setIsLoading(true);
        isDeletingRef.current = false;

        // User Profile
        const userDocRef = doc(firestore, 'users', user.uid);
        unsubUser = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setCurrentUser({ ...docSnap.data(), id: docSnap.id } as User);
          } else if (!isDeletingRef.current) {
            const newUser: User = {
              id: user.uid,
              name: user.displayName || 'No Name',
              role: 'user',
              trustScore: 0,
              profileImage: user.photoURL || undefined,
              logs: [],
              favoriteCreatureIds: [],
              favorites: { points: [], areas: [], shops: [], gear: { tanks: [] } },
              wanted: [],
              bookmarkedPointIds: [],
              createdAt: new Date().toISOString(),
              status: 'provisional'
            };
            setDoc(userDocRef, newUser).catch(console.error);
            setCurrentUser(newUser);
          }
          setIsLoading(false);
        });

        // User Logs
        const logsQuery = query(collection(firestore, 'users', user.uid, 'logs'), orderBy('date', 'desc'));
        unsubLogs = onSnapshot(logsQuery, (snapshot) => {
          setAllLogs(snapshot.docs.map(doc => doc.data() as Log));
        });

        // Proposals (Pending)
        const qCreatures = query(collection(firestore, 'creature_proposals'), where('status', '==', 'pending'));
        unsubProposalsC = onSnapshot(qCreatures, (snapshot) => {
          setProposalCreatures(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Creature)));
        });
        const qPoints = query(collection(firestore, 'point_proposals'), where('status', '==', 'pending'));
        unsubProposalsP = onSnapshot(qPoints, (snapshot) => {
          setProposalPoints(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Point)));
        });

      } else {
        setIsAuthenticated(false);
        setIsLoading(false);
        setCurrentUser(GUEST_USER);
        setAllLogs([]);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubUser) unsubUser();
      if (unsubLogs) unsubLogs();
      if (unsubProposalsC) unsubProposalsC();
      if (unsubProposalsP) unsubProposalsP();
    };
  }, []);

  // Admin Specific: Fetch All Users
  useEffect(() => {
    if (isAuthenticated && (currentUser.role === 'admin' || currentUser.role === 'moderator')) {
      const qUsers = query(collection(firestore, 'users'));
      const unsub = onSnapshot(qUsers, (snapshot) => {
        setAllUsers(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User)));
      });
      return () => unsub();
    }
  }, [isAuthenticated, currentUser.role]);

  // Actions
  const login = async () => {
    try { setIsLoading(true); await signInWithPopup(auth, googleProvider); }
    catch (error) { console.error(error); setIsLoading(false); }
  };

  const logout = async () => {
    try { setIsLoading(true); await signOut(auth); }
    catch (error) { console.error(error); setIsLoading(false); }
  };

  const deleteAccount = async () => {
    if (!auth.currentUser || !isAuthenticated) return;
    const uid = auth.currentUser.uid;
    setIsLoading(true);
    isDeletingRef.current = true;
    try {
      const batch = writeBatch(firestore);
      allLogs.forEach(log => batch.delete(doc(firestore, 'users', uid, 'logs', log.id)));
      await batch.commit();
      await deleteDoc(doc(firestore, 'users', uid));
      await auth.currentUser.delete();
    } catch (error: any) {
      console.error(error);
      isDeletingRef.current = false;
      await signOut(auth);
      setIsLoading(false);
    }
  };

  const updateUser = async (userData: Partial<User>) => {
    const targetId = currentUser?.id;
    if (!targetId || targetId === 'guest') return;
    const cleanData = sanitizePayload(userData);
    setCurrentUser(prev => ({ ...prev, ...userData }));
    if (isAuthenticated) {
      try { await updateDoc(doc(firestore, 'users', targetId), cleanData); }
      catch (e) { console.error(e); }
    }
  };

  const calculateRarity = (creatureId: string): Rarity => {
    const creature = creatures.find(c => c.id === creatureId);
    if (creature?.rarity) return creature.rarity;
    return 'Common';
  };

  const addLog = async (logData: Omit<Log, 'id' | 'userId'>) => {
    const newLogId = `l${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newLog: Log = { ...logData, id: newLogId, userId: currentUser.id };
    if (isAuthenticated) {
      try { await setDoc(doc(firestore, 'users', currentUser.id, 'logs', newLogId), sanitizePayload(newLog)); }
      catch (e) { console.error(e); }
    }
  };

  const addCreature = async (creatureData: Omit<Creature, 'id'>) => {
    const newCreature: Creature = { ...creatureData, id: `c${Date.now()}` };
    if (isAuthenticated) { await setDoc(doc(firestore, 'creatures', newCreature.id), sanitizePayload(newCreature)); }
    return newCreature;
  };

  const addPoint = async (pointData: Omit<Point, 'id'>) => {
    const newPoint: Point = { ...pointData, id: `p${Date.now()}` };
    if (isAuthenticated) { await setDoc(doc(firestore, 'points', newPoint.id), sanitizePayload(newPoint)); }
    return newPoint;
  };

  const addPointCreature = async (pointId: string, creatureId: string, localRarity: Rarity) => {
    const relId = `${pointId}_${creatureId}`;
    const pointCreatureData: PointCreature = { id: relId, pointId, creatureId, localRarity, status: (currentUser.role === 'admin' || currentUser.role === 'moderator') ? 'approved' : 'pending' };
    setPointCreatures(prev => [...prev.filter(p => p.id !== relId), pointCreatureData]);
    try { await setDoc(doc(firestore, 'point_creatures', relId), sanitizePayload(pointCreatureData)); }
    catch (e) { console.error(e); }
  };

  const removePointCreature = async (pointId: string, creatureId: string) => {
    const relId = `${pointId}_${creatureId}`;
    if (currentUser.role === 'admin' || currentUser.role === 'moderator') {
      setPointCreatures(prev => prev.filter(p => p.id !== relId));
      try { await deleteDoc(doc(firestore, 'point_creatures', relId)); }
      catch (e) { console.error(e); }
    } else {
      await updateDoc(doc(firestore, 'point_creatures', relId), { status: 'deletion_requested' });
    }
  };

  const deleteLog = async (logId: string) => {
    if (!isAuthenticated) return;
    try { await deleteDoc(doc(firestore, 'users', currentUser.id, 'logs', logId)); }
    catch (e) { console.error(e); }
  };

  const deleteLogs = async (logIds: string[]) => {
    if (!isAuthenticated) return;
    try {
      const batch = writeBatch(firestore);
      logIds.forEach(id => batch.delete(doc(firestore, 'users', currentUser.id, 'logs', id)));
      await batch.commit();
    } catch (e) { console.error(e); }
  };

  const updateLog = async (logId: string, logData: Partial<Log>) => {
    if (isAuthenticated) {
      try { await updateDoc(doc(firestore, 'users', currentUser.id, 'logs', logId), sanitizePayload(logData)); }
      catch (e) { console.error(e); }
    }
  };

  const updateCreature = async (creatureId: string, creatureData: Partial<Creature>) => {
    if (isAuthenticated) {
      try { await updateDoc(doc(firestore, 'creatures', creatureId), sanitizePayload(creatureData)); }
      catch (e) { console.error(e); }
    }
  };

  const updatePoint = async (pointId: string, pointData: Partial<Point>) => {
    if (isAuthenticated) {
      try { await updateDoc(doc(firestore, 'points', pointId), sanitizePayload(pointData)); }
      catch (e) { console.error(e); }
    }
  };

  const updateLogs = async (logIds: string[], data: Record<string, any>) => {
    if (!isAuthenticated) return;
    try {
      const batch = writeBatch(firestore);
      logIds.forEach(id => batch.update(doc(firestore, 'users', currentUser.id, 'logs', id), sanitizePayload(data)));
      await batch.commit();
    } catch (e) { console.error(e); }
  };

  const toggleLikeLog = async (log: Log) => {
    if (!isAuthenticated) return;
    const isLiked = (log.likedBy || []).includes(currentUser.id);
    const newLikedBy = isLiked ? log.likedBy!.filter(id => id !== currentUser.id) : [...(log.likedBy || []), currentUser.id];
    const newCount = (log.likeCount || 0) + (isLiked ? -1 : 1);
    try { await updateDoc(doc(firestore, 'users', log.userId, 'logs', log.id), { likedBy: newLikedBy, likeCount: newCount }); }
    catch (e) { console.error(e); }
  };

  const toggleFavorite = async (creatureId: string) => {
    const isFav = (currentUser.favoriteCreatureIds || []).includes(creatureId);
    const newFavs = isFav ? currentUser.favoriteCreatureIds!.filter(id => id !== creatureId) : [...(currentUser.favoriteCreatureIds || []), creatureId];
    await updateUser({ favoriteCreatureIds: newFavs });
  };

  const toggleWanted = async (creatureId: string) => {
    const isWanted = (currentUser.wanted || []).includes(creatureId);
    const newWanted = isWanted ? currentUser.wanted!.filter(id => id !== creatureId) : [...(currentUser.wanted || []), creatureId];
    await updateUser({ wanted: newWanted });
  };

  const toggleBookmarkPoint = async (pointId: string) => {
    const isBookmarked = (currentUser.bookmarkedPointIds || []).includes(pointId);
    const newBookmarked = isBookmarked ? currentUser.bookmarkedPointIds!.filter(id => id !== pointId) : [...(currentUser.bookmarkedPointIds || []), pointId];
    await updateUser({ bookmarkedPointIds: newBookmarked });
  };

  const addCreatureProposal = async (data: any) => {
    if (!isAuthenticated) return;
    await setDoc(doc(firestore, 'creature_proposals', `propc${Date.now()}`), { ...data, status: 'pending', submitterId: currentUser.id, createdAt: new Date().toISOString() });
  };

  const addPointProposal = async (data: any) => {
    if (!isAuthenticated) return;
    await setDoc(doc(firestore, 'point_proposals', `propp${Date.now()}`), { ...data, status: 'pending', submitterId: currentUser.id, createdAt: new Date().toISOString() });
  };

  const approveProposal = async (type: 'creature' | 'point', id: string, data: any) => {
    const targetCol = type === 'creature' ? 'creatures' : 'points';
    const isUpdate = data.proposalType === 'update' || !!data.targetId;
    const realId = data.targetId || (data.id && !data.id.startsWith('prop') ? data.id : `${type === 'creature' ? 'c' : 'p'}${Date.now()}`);

    if (isUpdate) {
      // For updates, we MUST only update changed fields (diffData)
      const updatePayload = { ...data.diffData, status: 'approved' };
      await updateDoc(doc(firestore, targetCol, realId), sanitizePayload(updatePayload));
    } else {
      // For new entries
      const finalData = { ...data, id: realId, status: 'approved' };
      delete finalData.targetId;
      delete finalData.proposalType;
      await setDoc(doc(firestore, targetCol, realId), sanitizePayload(finalData));
    }

    // Update the proposal document itself
    await updateDoc(doc(firestore, type === 'creature' ? 'creature_proposals' : 'point_proposals', id), { status: 'approved' });
  };

  const rejectProposal = async (type: 'creature' | 'point', id: string) => {
    await updateDoc(doc(firestore, type === 'creature' ? 'creature_proposals' : 'point_proposals', id), { status: 'rejected' });
  };

  const updateUserRole = async (uid: string, newRole: 'user' | 'moderator' | 'admin') => {
    if (currentUser.role === 'admin') await updateDoc(doc(firestore, 'users', uid), { role: newRole });
  };

  const value = {
    currentUser, isAuthenticated, isLoading, login, logout, calculateRarity, addLog, addCreature, addPoint, addPointCreature, removePointCreature, updateLog, updateCreature, updatePoint, deleteLog, deleteLogs, updateLogs, updateUser, toggleLikeLog, toggleFavorite, toggleWanted, toggleBookmarkPoint,
    creatures, points, pointCreatures, logs: allLogs, recentLogs, proposalCreatures, proposalPoints, regions, zones, areas, addCreatureProposal, addPointProposal, approveProposal, rejectProposal, allUsers, updateUserRole, deleteAccount
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) throw new Error('useApp must be used within an AppProvider');
  return context;
};
