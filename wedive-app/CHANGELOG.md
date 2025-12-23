# Changelog

すべての変更は本ファイルに記録されます。

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
