import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getRemoteConfig, fetchAndActivate } from "firebase/remote-config";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// ---------------------------------------------------------
// 1. Initialize Firebase
// ---------------------------------------------------------
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const functions = getFunctions(app, "asia-northeast1");

// ---------------------------------------------------------
// 2. Emulator Connection (MUST BE DONE BEFORE INITIALIZING FIRESTORE)
// ---------------------------------------------------------
if (import.meta.env.DEV) {
  const { connectFunctionsEmulator } = await import("firebase/functions");

  // @ts-ignore
  if (!window._firebaseEmulatorsStarted) {
    console.log("Connecting to Firebase Emulators...");
    // connectAuthEmulator(auth, "http://localhost:9099"); // Keep cloud auth for easier Google Login if preferred
    connectFunctionsEmulator(functions, "localhost", 5001);
    // @ts-ignore
    window._firebaseEmulatorsStarted = true;
  }
}

// ---------------------------------------------------------
// 3. Firestore: Initialize with persistence
// ---------------------------------------------------------
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

// Extra step for Firestore emulator due to timing
if (import.meta.env.DEV) {
  const { connectFirestoreEmulator } = await import("firebase/firestore");
  // @ts-ignore
  if (!window._firestoreEmulatorConnected) {
    connectFirestoreEmulator(db, "localhost", 8080);
    // @ts-ignore
    window._firestoreEmulatorConnected = true;
  }
}

// ---------------------------------------------------------
// 4. Analytics: 環境によっては動かないので安全策をとる
// ---------------------------------------------------------
export let analytics: ReturnType<typeof getAnalytics> | null = null;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
});

// ---------------------------------------------------------
// 5. Remote Config
// ---------------------------------------------------------
export const remoteConfig = getRemoteConfig(app);

// 開発環境なら0秒(即時)、本番なら1時間キャッシュ
remoteConfig.settings.minimumFetchIntervalMillis = import.meta.env.DEV ? 0 : 3600000;

// デフォルト値の設定
remoteConfig.defaultConfig = {};

// フェッチ実行
export const remoteConfigPromise = fetchAndActivate(remoteConfig).then(() => {
  console.log('Remote Config fetched!');
  return true;
}).catch((err) => {
  console.warn('Remote Config fetch failed', err);
  return false;
});
