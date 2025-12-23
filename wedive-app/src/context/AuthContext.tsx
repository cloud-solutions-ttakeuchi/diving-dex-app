import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { User } from '../types';

type AuthContextType = {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          // Fetch user details from Firestore
          const userDoc = await getDoc(doc(db as any, 'users', fbUser.uid));
          if (userDoc.exists()) {
            setUser({ id: userDoc.id, ...userDoc.data() } as User);
          } else {
            // Minimal user info fallback
            setUser({
              id: fbUser.uid,
              name: fbUser.displayName || 'Guest',
              role: 'user',
              trustScore: 0,
              logs: [],
              favorites: { points: [], areas: [], shops: [], gear: { tanks: [] } },
              favoriteCreatureIds: [],
              wanted: [],
              bookmarkedPointIds: [],
            });
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const updateUser = async (userData: Partial<User>) => {
    if (!firebaseUser || !user) return;
    try {
      await updateDoc(doc(db as any, 'users', firebaseUser.uid), userData);
      setUser(prev => prev ? { ...prev, ...userData } : null);
    } catch (error) {
      console.error("Error updating user:", error);
      throw error;
    }
  };

  const deleteAccount = async () => {
    if (!firebaseUser || !user) return;
    try {
      // In a real app, we might want to delete logs too as in web version
      // For now, at least user doc and auth
      await deleteDoc(doc(db as any, 'users', firebaseUser.uid));
      await firebaseUser.delete();
    } catch (error) {
      console.error("Error deleting account:", error);
      // If re-authentication is required, Firebase will throw an error
      // In mobile, we might need to handle that specifically
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
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
