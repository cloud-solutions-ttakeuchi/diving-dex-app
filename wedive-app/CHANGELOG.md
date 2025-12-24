# Changelog

すべての変更は本ファイルに記録されます。

## [2.5.0] - 2025-12-24

### Changed
- **Database & Architecture**:
    - **Design Synchronization**: Web版の設計書 (`DATABASE_DESIGN.md` 等) を完全移植し、データ構造の整合性を確保。
    - **Log Service**: ログ保存ロジックを `LogService` に集約。Web版仕様（ID: `l{timestamp}`, Path: `users/{uid}/logs`）への完全準拠と、`undefined` データ除去の実装。
- **UI/UX**:
    - **Log Registration**: ブランドカラー (Ocean Blue) への統一、ローディングオーバーレイによるUX向上、および時刻入力バリデーションの強化。

### Fixed
- **Google Authentication**: `useProxy: true` オプションの追加により、認証後のリダイレクトエラーを解消。
- **Auth Persistence**: Web環境でのセッション維持のため、永続化設定をプラットフォーム別に分岐 (`browserLocalPersistence` / `AsyncStorage`)。
- **Environment Configuration**: AIサービスの `API_BASE_URL` を環境変数 (`EXPO_PUBLIC_FUNCTIONS_BASE_URL`) へ移行。
- **Dynamic Configuration**: `app.json` を `app.config.ts` に移行し、環境変数 `APP_VARIANT` (development/staging/production) に基づいてアプリ名、ID、接続先などを動的に切り替えられるように改善。
- **Data Integrity**: ログ保存時に不正な形式のデータがFirestoreに混入する問題を修正。

## [2.4.0] - 2025-12-23

### Added
- **Authentication**:
    - **Firebase Auth Integration**: メール/パスワードによるログイン・新規登録機能の実装。
    - **Google Sign-In**: `expo-auth-session` を利用したGoogleログイン機能の実装。
    - **Auth Context**: アプリ全体での認証状態管理と保護されたルート（マイページ等）の制御。
- **Search Screen**:
    - **Firestore Integration**: スポット・生物の実データをFirestoreから取得・表示するように変更。
    - **Tab Filtering**: URLパラメータによる初期タブ切り替え（スポット/生物）の実装。
- **Image Handling**:
    - **Robust Fallback**: 画像ロードエラー時に代替画像を表示する `ImageWithFallback` コンポーネントの実装と適用。

### Changed
- **Navigation**: Home画面の「See All」リンクから検索画面の特定タブへの遷移を実装。
- **Data Source**: モックデータ (`mockData.ts`) を完全廃止し、Firestoreデータに移行。

### Fixed
- **UI Bug**: ログインボタンのテキストが表示されない不具合を修正（テーマ背景色の競合回避）。

## [2.3.0] - 2025-12-23

### Added
- **Initial Feature Set**:
    - **Tab Navigation**: `Home`, `Search` (探す), `AI` (AI相談), `MyPage` (マイページ) の4タブ構成を実装。
    - **Home Screen**:
        - **Header**: WeDiveロゴとブランドカラー (`#0ea5e9`) を適用したヘッダーデザイン。検索バーを含む。
        - **Hero Section**: AIコンシェルジュ機能を訴求するヒーローエリアと「AIに相談する」ボタン。
        - **Featured Spots**: 注目スポットのカードリスト表示。
        - **Popular Creatures**: 人気生物の横スクロールリスト表示（レアリティ計算ロジック統合）。
        - **FAB (Floating Action Button)**: ログ登録画面へのクイックアクセスボタン。
- **UI/UX Refinements**:
    - **Header Tuning**: ロゴ画像サイズ (`50px`)、テキストサイズ (`32px`)、および余白 (`gap: 2px`, `paddingHorizontal: 12`) の微調整による視認性向上。
    - **Card Design**: 影（Shadow）と角丸（Border Radius）を活用したモダンなカードデザイン。

### Fixed
- **Layout**: ヘッダーの左寄せ配置調整。

## [0.1.0] - 2025-12-21

### Added
- **Project Initialization**: Expo (React Native) プロジェクトのセットアップ。
- **Basic Routing**: `expo-router` を用いたファイルベースルーティングの構築。
