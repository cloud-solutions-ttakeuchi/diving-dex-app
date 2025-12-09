import { useEffect, useState } from 'react';
import { getValue, fetchAndActivate } from 'firebase/remote-config';
import { remoteConfig } from '../lib/firebase';

/**
 * Hook to get the boolean value of a feature toggle from Firebase Remote Config.
 *
 * @param key The key defined in Remote Config (e.g., 'feature_bulk_edit')
 * @param defaultValue Fallback value if config is not yet fetched or key missing (default: false)
 * @returns boolean
 */
export const useFeatureToggle = (key: string, defaultValue: boolean = false): boolean => {
  const [isEnabled, setIsEnabled] = useState<boolean>(defaultValue);

  useEffect(() => {
    // 1. Get value safely
    const checkValue = () => {
      try {
        const val = getValue(remoteConfig, key);
        // Remote Config values are strings ("true"/"false") or numbers.
        // .asBoolean() method handles "true", "1", "on" as true.
        setIsEnabled(val.asBoolean());
      } catch (e) {
        console.warn(`Error getting feature toggle ${key}:`, e);
        setIsEnabled(defaultValue);
      }
    };

    // 2. Fetch latest (optional: simplified here to just check current active config)
    // Real-world apps might use a context to avoid fetching locally in every component,
    // but firebase SDK handles caching, so calling fetchAndActivate often is generally safe if interval is set.
    // However, to avoid flickering, we usually rely on the initial fetch in firebase.ts
    // or just listen to the activated values.

    // For now, checks purely strictly on mount.
    checkValue();

    // Note: Remote Config does not provide a real-time listener like Firestore.
    // You typically fetch at startup.
  }, [key, defaultValue]);

  return isEnabled;
};
