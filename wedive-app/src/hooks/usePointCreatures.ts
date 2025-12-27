import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db } from '../firebase';
import { PointCreature } from '../types';

const QUERY_KEY = ['pointCreatures'];

export function usePointCreatures() {
  const queryClient = useQueryClient();
  const [isFirestoreLoading, setFirestoreLoading] = useState(true);

  useEffect(() => {
    // 必要に応じてフィルタリングを追加してください
    const q = query(collection(db, 'point_creatures'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as PointCreature));

      queryClient.setQueryData(QUERY_KEY, data);
      setFirestoreLoading(false);
    }, (error) => {
      console.error('Error fetching pointCreatures:', error);
      setFirestoreLoading(false);
    });

    return () => unsubscribe();
  }, [queryClient]);

  const queryInfo = useQuery<PointCreature[]>({
    queryKey: QUERY_KEY,
    staleTime: Infinity,
    enabled: false,
    queryFn: () => [],
    initialData: []
  });

  return { ...queryInfo, isLoading: isFirestoreLoading };
}
