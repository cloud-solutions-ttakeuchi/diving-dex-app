import { useState, useEffect } from 'react';
import { getBoolean } from 'firebase/remote-config';
import { remoteConfig, remoteConfigPromise } from '../lib/firebase';

/**
 * リモート設定の値を取得するカスタムフック。
 * fetchAndActivate の完了を待ってから値を更新します。
 *
 * @param key Remote Config のパラメータキー
 * @param defaultValue デフォルト値（fetch完了までの値）
 * @returns boolean 値
 */
export const useFeatureToggle = (key: string, defaultValue = false): boolean => {
  // 初期値は現在のSDKキャッシュの値を取得（まだfetch完了前ならdefaultConfigの値になる）
  const [value, setValue] = useState<boolean>(() => {
    try {
      return getBoolean(remoteConfig, key);
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    let mounted = true;

    // fetchAndActivate が完了したら、最新の値を取得しなおして State を更新する
    remoteConfigPromise.then(() => {
      if (mounted) {
        try {
          // fetch完了後は最新のサーバー値（またはキャッシュ）が確実に取れる
          const newValue = getBoolean(remoteConfig, key);
          setValue(newValue);
        } catch (e) {
          console.warn('Failed to get remote config value', e);
        }
      }
    });

    return () => {
      mounted = false;
    };
  }, [key]);

  return value;
};
