import { initializeApp } from "firebase/app";
// @ts-ignore
import { Auth, initializeAuth, getReactNativePersistence, GoogleAuthProvider, getAuth, browserLocalPersistence } from 'firebase/auth';
import { Firestore, initializeFirestore, persistentLocalCache, persistentSingleTabManager, getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// Expo環境変数は process.env.EXPO_PUBLIC_プレフィックスが必要
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
};

import { Platform } from 'react-native';

// 1. Initialize Firebase App
const app = initializeApp(firebaseConfig);

// 2. Auth with Persistence
// Web: browserLocalPersistence
// Native: getReactNativePersistence(ReactNativeAsyncStorage)
const auth = (() => {
  const persistence = Platform.OS === 'web'
    ? browserLocalPersistence
    : getReactNativePersistence(ReactNativeAsyncStorage);

  try {
    return initializeAuth(app, { persistence });
  } catch (e) {
    // If already initialized (e.g. during HMR), use getAuth
    return getAuth(app);
  }
})();

export { auth };
export const googleProvider = new GoogleAuthProvider();

// 3. Firestore
// React Native does not support multiple tab manager (it is single process mostly)
let db: Firestore;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentSingleTabManager(undefined)
    })
  });
} catch (e: any) {
  // hot-reload 等で既に初期化済みの場合は既存インスタンスを取得
  db = getFirestore(app);
}
export { db };

// 4. Storage
import { getStorage } from "firebase/storage";
export const storage = getStorage(app);

// 5. Functions
export const functions = getFunctions(app, "asia-northeast1");

// エミュレータ接続などは必要に応じて追加してくだい。
// React Nativeの場合、localhost ではなくPCのIPアドレスを指定する必要がある場合があります。
