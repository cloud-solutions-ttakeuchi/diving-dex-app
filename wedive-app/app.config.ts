import 'dotenv/config';
import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const APP_VARIANT = process.env.APP_VARIANT || 'development';

  // APP_VARIANTに応じてアプリ名やIDを切り替える
  // 未設定時は元の app.json (開発環境) の値をデフォルトにする
  const getName = () => {
    switch (APP_VARIANT) {
      case 'production': return "WeDive";
      case 'staging': return "WeDive (Stg)";
      default: return process.env.APP_NAME || "wedive-app";
    }
  };

  const getIdentifier = () => {
    switch (APP_VARIANT) {
      case 'production': return "com.wedive.app";
      case 'staging': return "com.wedive.stg";
      default: return "com.wedive.dev";
    }
  };

  const getScheme = () => {
    switch (APP_VARIANT) {
      case 'production': return "wediveapp";
      case 'staging': return "wediveapp-stg";
      default: return "wediveapp"; // 元のapp.jsonに合わせてデフォルトはwediveappに
    }
  };

  return {
    ...config,
    name: getName(),
    slug: "wedive-app",
    owner: "wedive",
    version: "1.0.0",
    runtimeVersion: {
      policy: "appVersion"
    },
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: getScheme(),
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: getIdentifier(),
      config: {
        usesNonExemptEncryption: false
      }
    },
    android: {
      package: getIdentifier(),
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      "expo-image-picker",
      [
        "@react-native-google-signin/google-signin",
        {
          iosClientId: "1066677586396-1avhn8hbahfrc1kmv9rbefi3toacjqn3.apps.googleusercontent.com",
          iosUrlScheme: "com.googleusercontent.apps.1066677586396-1avhn8hbahfrc1kmv9rbefi3toacjqn3"
        }
      ]
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      ...config.extra,
      variant: APP_VARIANT,
      eas: {
        ...config.extra?.eas,
        projectId: process.env.EAS_PROJECT_ID || config.extra?.eas?.projectId || "dfe6116c-6a22-409a-8701-2b041a6e7310"
      }
    }
  };
};
