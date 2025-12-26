import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, onSnapshot, updateDoc, deleteDoc, collection, query, orderBy } from 'firebase/firestore';
import { User, DiveLog } from '../types';

type AuthContextType = {
  user: User | null;
  logs: DiveLog[];
  firebaseUser: FirebaseUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  logs: [],
  firebaseUser: null,
  isAuthenticated: false,
  isLoading: true,
  signOut: async () => { },
  updateUser: async () => { },
  deleteAccount: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<DiveLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let unsubUser: (() => void) | undefined;
    let unsubLogs: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);

      if (fbUser) {
        // 1. Sync User Profile
        unsubUser = onSnapshot(doc(db, 'users', fbUser.uid), (snap) => {
          if (snap.exists()) {
            setUser({ id: snap.id, ...snap.data() } as User);
          } else {
            // Fallback for new users
            setUser({
              id: fbUser.uid,
              name: fbUser.displayName || 'Guest',
              role: 'user',
              trustScore: 0,
              favorites: { points: [], areas: [], shops: [], gear: { tanks: [] } },
              favoriteCreatureIds: [],
              wanted: [],
              bookmarkedPointIds: [],
            });
          }
        });

        // 2. Sync User Logs (Sub-collection)
        // Web版の「リストが空」という状態に左右されないよう、サブコレクションを直接監視する
        const logsQuery = query(
          collection(db, 'users', fbUser.uid, 'logs'),
          orderBy('date', 'desc')
        );
        unsubLogs = onSnapshot(logsQuery, (snap) => {
          const logsData = snap.docs.map(d => ({ ...d.data(), id: d.id } as DiveLog));
          setLogs(logsData);
          setIsLoading(false); // ログが空の場合でも、読み込み完了とみなす
        }, (err) => {
          console.error("Logs sync error:", err);
          setIsLoading(false);
        });

      } else {
        setUser(null);
        setLogs([]);
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubUser) unsubUser();
      if (unsubLogs) unsubLogs();
    };
  }, []);

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const updateUser = async (userData: Partial<User>) => {
    if (!firebaseUser) return;
    try {
      await updateDoc(doc(db, 'users', firebaseUser.uid), userData);
      // setUser is handled by onSnapshot
    } catch (error) {
      console.error("Error updating user:", error);
      throw error;
    }
  };

  const deleteAccount = async () => {
    if (!firebaseUser) return;
    try {
      await deleteDoc(doc(db, 'users', firebaseUser.uid));
      await firebaseUser.delete();
    } catch (error) {
      console.error("Error deleting account:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      logs,
      firebaseUser,
      isAuthenticated: !!firebaseUser,
      isLoading,
      signOut,
      updateUser,
      deleteAccount
    }}>
      {children}
    </AuthContext.Provider>
  );
};
