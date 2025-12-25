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
let db: Firestore;
if (Platform.OS === 'web') {
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentSingleTabManager(undefined)
      })
    });
  } catch (e) {
    db = getFirestore(app);
  }
} else {
  // Native環境では標準の getFirestore が最も安定しますが、
  // 通信が不安定な場合は initializeFirestore で設定を上書きすることも可能です。
  try {
    db = initializeFirestore(app, {
      experimentalForceLongPolling: true, // Websocketより安定する通信方式を試す
    });
  } catch (e) {
    db = getFirestore(app);
  }
}
export { db };

// 4. Storage
import { getStorage } from "firebase/storage";
export const storage = getStorage(app);
console.log("[Firebase] Storage initialized with bucket:", storage.app.options.storageBucket);

// 5. Functions
export const functions = getFunctions(app, "asia-northeast1");

// エミュレータ接続などは必要に応じて追加してくだい。
// React Nativeの場合、localhost ではなくPCのIPアドレスを指定する必要がある場合があります。
