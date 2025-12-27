import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

const QUERY_KEY = ['userStatsMastery'];

export interface UserMasteryStats {
  points: {
    pointId: string;
    pointName: string;
    imageUrl?: string;
    diveCount: number;
    masteryRate: number;
    discoveredCount: number;
    totalCount: number;
    creaturesAtPoint: {
      id: string;
      imageUrl?: string;
      localRarity?: string;
      isDiscovered: boolean;
    }[];
    discoveredIds: string[];
  }[];
  updatedAt: any;
}

export function useUserStats() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isFirestoreLoading, setFirestoreLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setFirestoreLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, `users/${user.id}/stats/mastery`), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserMasteryStats;
        queryClient.setQueryData(QUERY_KEY, data);
      } else {
        queryClient.setQueryData(QUERY_KEY, null);
      }
      setFirestoreLoading(false);
    }, (error) => {
      console.error('Error fetching user stats:', error);
      setFirestoreLoading(false);
    });

    return () => unsubscribe();
  }, [user?.id, queryClient]);

  const queryInfo = useQuery<UserMasteryStats | null>({
    queryKey: QUERY_KEY,
    staleTime: Infinity,
    enabled: false,
    queryFn: () => null,
    initialData: null
  });

  return { ...queryInfo, isLoading: isFirestoreLoading };
}
