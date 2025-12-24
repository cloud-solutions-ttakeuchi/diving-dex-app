# WeDive Mobile App

WeDive のモバイルアプリケーションプロジェクトです。Expo (React Native) を使用して構築されています。

## 環境設定 (Environment Variables)

プロジェクトの動作には環境変数の設定が必要です。`.env.local` ファイルを作成し、以下の項目を設定してください。

### Firebase 設定
Firebase コンソールから取得した設定値を入力してください。
- `EXPO_PUBLIC_FIREBASE_API_KEY`: API キー
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`: 認証ドメイン
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`: プロジェクト ID
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`: ストレージバケット
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`: メッセージング送信者 ID
- `EXPO_PUBLIC_FIREBASE_APP_ID`: アプリ ID
- `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID`: 測定 ID

### 認証設定
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`: Google ログイン用の Web クライアント ID

### API 設定
- `EXPO_PUBLIC_FUNCTIONS_BASE_URL`: AI コンシェルジュ等の Cloud Functions ベース URL

### ビルド・環境切り替え設定
`app.config.ts` で使用される制御変数です。
- `APP_VARIANT`: アプリのバリアント指定 (`development` | `staging` | `production`)。未指定時は `development`。
- `EAS_PROJECT_ID`: Expo Application Services (EAS) のプロジェクト ID。

---

## 環境の切り替え方法

実行時に `APP_VARIANT` を指定することで、アプリ名やパッケージ ID を切り替えることができます。

- **開発環境 (Default)**:
  ```bash
  npx expo start
  ```
- **ステージング環境**:
  ```bash
  APP_VARIANT=staging npx expo start
  ```
- **本番環境**:
  ```bash
  APP_VARIANT=production npx expo start
  ```

---

## 技術スタック
- **Framework**: Expo (SDK 54)
- **Navigation**: Expo Router
- **Backend**: Firebase (Auth, Firestore, Storage, Functions)
- **Icons**: Lucide React Native
- **Styling**: Vanilla CSS / React Native StyleSheet
