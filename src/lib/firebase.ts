
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const analytics = getAnalytics(app);

// Remote Config
import { getRemoteConfig, fetchAndActivate } from "firebase/remote-config";

export const remoteConfig = getRemoteConfig(app);

// Default configs (Development: fetch immediately, Production: cache for 1 hour)
remoteConfig.settings.minimumFetchIntervalMillis = import.meta.env.DEV ? 0 : 3600000;

// Set default values here or in the console.
// Ideally, set safety defaults here in case fetch fails.
remoteConfig.defaultConfig = {
  // "feature_xxx": false,
};

// Initial fetch (optional to await here, or let components fetch)
fetchAndActivate(remoteConfig).then(() => {
  console.log('Remote Config fetched!');
}).catch((err) => {
  console.warn('Remote Config fetch failed', err);
});


// Enable Offline Persistence
enableIndexedDbPersistence(db).catch((err: any) => {
  if (err.code == 'failed-precondition') {
    // Multiple tabs open, persistence can only be enabled in one tab at a a time.
    console.warn('Firestore persistence enabled in another tab');
  } else if (err.code == 'unimplemented') {
    // The current browser does not support all of the features required to enable persistence
    console.warn('Firestore persistence not supported in this browser');
  }
});
