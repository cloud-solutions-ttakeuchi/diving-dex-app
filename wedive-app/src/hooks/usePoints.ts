import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Point } from '../types';

const QUERY_KEY = ['points'];

export function usePoints() {
  const queryClient = useQueryClient();
  const [isFirestoreLoading, setFirestoreLoading] = useState(true);

  useEffect(() => {
    // 承認済みまたは保留中のポイントのみを取得
    const q = query(collection(db, 'points'), where('status', 'in', ['approved', 'pending']));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const points = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Point));

      // React Queryのキャッシュを更新
      queryClient.setQueryData(QUERY_KEY, points);
      setFirestoreLoading(false);
    }, (error) => {
      console.error('Error fetching points:', error);
      setFirestoreLoading(false);
    });

    return () => unsubscribe();
  }, [queryClient]);

  const queryInfo = useQuery<Point[]>({
    queryKey: QUERY_KEY,
    staleTime: Infinity,
    enabled: false, // 自動フェッチを無効化し、onSnapshotに委任
    queryFn: () => [], // ダミー関数
    initialData: []
  });

  return { ...queryInfo, isLoading: isFirestoreLoading };
}
