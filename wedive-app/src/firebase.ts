import { initializeApp } from "firebase/app";
// @ts-ignore
import { initializeAuth, getReactNativePersistence, GoogleAuthProvider, getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager, getFirestore } from "firebase/firestore";
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

// 1. Initialize Firebase App
const app = initializeApp(firebaseConfig);

// 2. Auth with Persistence (AsyncStorage)
// getReactNativePersistence が関数として存在するかチェック
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
  });
} catch (e) {
  console.warn("Retrying auth init without persistence customization", e);
  auth = getAuth(app);
}

export { auth };
export const googleProvider = new GoogleAuthProvider();

// 3. Firestore
// React Native does not support multiple tab manager (it is single process mostly)
let db;
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

// 4. Functions
export const functions = getFunctions(app, "asia-northeast1");

// エミュレータ接続などは必要に応じて追加してくだい。
// React Nativeの場合、localhost ではなくPCのIPアドレスを指定する必要がある場合があります。
