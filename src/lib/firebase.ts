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

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// ---------------------------------------------------------
// 1. Firestore: 初期化と同時に永続化設定を行う (推奨される新しい書き方)
// ---------------------------------------------------------
// もし古いSDK(v9初期)を使っているなら元のままでも動きますが、
// v10以降ならこちらの方が確実です。
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager() // 複数タブでの同期を管理
  })
});

// ---------------------------------------------------------
// 2. Auth
// ---------------------------------------------------------
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// ---------------------------------------------------------
// 3. Analytics: 環境によっては動かないので安全策をとる
// ---------------------------------------------------------
export let analytics: ReturnType<typeof getAnalytics> | null = null;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
});

// ---------------------------------------------------------
// 4. Remote Config
// ---------------------------------------------------------
export const remoteConfig = getRemoteConfig(app);

// 開発環境なら0秒(即時)、本番なら1時間キャッシュ
remoteConfig.settings.minimumFetchIntervalMillis = import.meta.env.DEV ? 0 : 3600000;

// デフォルト値の設定
remoteConfig.defaultConfig = {

};

// フェッチ実行
// ※ 注意: これは非同期なので、アプリの初回レンダリング時にはまだ完了していない可能性があります。
// その場合、getValue() は上記の defaultConfig の値を返します。
// フェッチ実行
// ※ 注意: これは非同期なので、アプリの初回レンダリング時にはまだ完了していない可能性があります。
// その場合、getValue() は上記の defaultConfig の値を返します。
export const remoteConfigPromise = fetchAndActivate(remoteConfig).then(() => {
  console.log('Remote Config fetched!');
  return true;
}).catch((err) => {
  console.warn('Remote Config fetch failed', err);
  return false;
});

// ---------------------------------------------------------
// 5. Functions
// ---------------------------------------------------------
export const functions = getFunctions(app, "asia-northeast1");
