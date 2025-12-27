# WeDive Web & App 設計・仕様書

## 1. 概要
**WeDive** は、ダイバーが自身のダイビング活動を記録し、発見した生物をコレクションとして管理できる「ログブック × 生物図鑑」を融合した、Webおよびモバイル対応のハイブリッドプラットフォームです。

ユーザーはダイビングログを詳細に記録できるだけでなく、その場所で見られる生物情報（図鑑）と連携させることで、単なる記録以上の「発見の喜び」を提供します。

---

## 2. 技術スタック

### フロントエンド
- **Language**: TypeScript
- **Framework**: React
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React

### バックエンド / インフラ
- **Platform**: Firebase
- **Auth**: Firebase Authentication (Google Login / Anonymous)
- **Database**: Cloud Firestore (NoSQL)
- **Storage**: Firebase Cloud Storage (画像保存用 - *想定*)

---

## 3. 主要機能 (Core Features)

### 3.1 ログ管理 (Log Management)
ユーザーは自身のダイビング詳細を記録・管理できます。
- **ログ作成/編集**:
  - **基本情報**: 日付、場所（階層選択：地域 > エリア > 詳細エリア > ポイント）、ショップ名、チーム（バディ/ガイド）。
  - **ダイブデータ**: エントリー/エキジット時間、潜水時間、最大/平均水深。
  - **コンディション**: 天気、気温、水温（水面/水底）、透明度、波、流れ、うねり。
  - **器材**: スーツ（種類・厚さ）、ウェイト、タンク（材質・容量・開始/終了圧）。
  - **生物記録**: 見た生物の選択（図鑑連携）、メイン写真の設定。選択したポイントの目撃実績に基づいた優先サジェスト機能。
- **一括操作 (Bulk Actions)**: マイページから複数ログを選択し、一括削除や一括編集（場所、コンディション、器材情報など）が可能。
- **CSVインポート**: Garmin Connect等のCSVデータを取り込み、簡易ログとして一括登録する機能（ポイント紐付け対応）。
  - *Note: 詳細データ取込やAquaLang対応は将来のPro版機能。*

### 3.2 生物図鑑 (Pokedex / Field Guide)
全ユーザー共通のマスターデータとしての生物図鑑機能。
- **検索・閲覧**: 生物名、カテゴリなどで検索可能。
- **詳細情報**: 分類、レア度（Global Rarity）、危険度、サイズ感などのステータス表示。
- **発見連携**: 「ここで見つけた！」機能により、特定のポイントでの発見報告が可能。

### 3.3 ポイント管理 (Point Management)
ダイビングスポットを階層構造で管理。
- **階層構造**: Region (地域) > Zone (広域エリア) > Area (詳細エリア) > Point (ポイント)。
- **ポイント詳細**: 特徴、最大水深、レベル、見られる生物リスト（出現率含む）。

### 3.4 マイページ (User Profile)
ユーザーの活動履歴と実績を可視化。
- **ダッシュボード**: ダイブ本数、発見生物数、コンプリート率、ランク（トラストスコア）。
- **ログブック**: 過去のログをカード形式またはリスト形式で閲覧。
- **コレクション**: 発見した生物をグリッド表示（発見済みはカラー、未発見はシルエット/ロック状態）。

### 3.5 ゲーミフィケーション・ソーシャル
- **トラストスコア**: 提案活動やログ登録によりスコアが加算され、ランク（User/Moderator/Admin）が変動。
- **いいね機能**: 公開ログに対する「いいね」。

---

## 4. データモデル設計 (Data Models)

### User (ユーザー)
- プロフィール、権限ロール（Admin/User）、トラストスコア。
- **Favorites**: お気に入りのポイント、ショップ、器材設定（デフォルト入力用）。
- **Collections**: 発見済み生物ID、ブックマーク地点。

### DiveLog (ログ)
- ダイビングの事実データ（日時、場所、海況、器材）。
- **Location**: ポイントIDと名称、ショップ名。
- **Sightings**: 発見生物IDのリスト（図鑑とリンク）。

### Creature (生物マスター)
- 基本情報（名前、学名、画像、解説）。
- **Stats**: レア度、サイズ、危険度などのパラメータ。
- **Status**: 承認ステータス（承認制によるユーザー投稿型図鑑への拡張性）。

### Point / Location (場所マスター)
- 階層ポインタ（Region/Zone/Area ID）。
- **PointCreature**: ポイントと生物の中間テーブル（特定ポイントでの出現率 `Local Rarity` を管理）。

---

## 5. UI/UX デザイン

- **テーマカラー**: 海をイメージした **Ocean Blue** (`#0ea5e9`, `text-deepBlue`) を基調とし、清潔感と没入感を演出。
- **レスポンシブ**: モバイル利用（現地でのログ付け）を優先。Web版とアプリ版で共通のデザイン言語（WeDive Design System）を使用。
- **没入型レイアウト (Immersive Layout)**:
  - スポット詳細、生物詳細などの主要コンテンツ閲覧時、アプリ版ではボトムタブバーを非表示にし、画面全体をコンテンツに活用。
  - **Floating Header**: 透明感のあるガラス調のフローティングボタンをトップに配置。
  - **SafeArea Handle**: デバイスごとのノッチ（上部）やホームインジケーター（下部）を考慮した余白調整。
- **パンくずリスト (Breadcrumbs)**:
  - 画面上部に「🏠 Home / 地域 / エリア」などの階層を表示。
  - アプリ版でも詳細ページからの迷子を防ぐため、常に上位階層へ戻れるリンクを提供。
- **リッチな詳細ページ連携**:
  - **Confirmed Species**: そのスポットで目撃された生物を横スクロールカードで表示。
  - **Spotted at**: その生物が見られるスポットを横スクロールカードで表示。
- **インタラクション**: グラスモフィズム（透過・ぼかし）、グラデーション、マイクロアニメーション（Hover時の拡大、Fade-in等）によるプレミアムな操作感。

---

## 6. 今後のロードマップ (Future Roadmap)

1.  **Pro版機能 (Paid Plan)**:
    - AIログ生成（AquaLang連携）。
    - Garminから詳細データのフルインポート機能
2.  **ソーシャル強化**:
    - フォロー/フォロワー機能。
    - タイムラインフィード。
    - バディスタンプ

3.  **データ分析強化**:
    - 月別・エリア別ダイビング統計のグラフ化。

---

## 7. インフラ設計 (Infrastructure Design)

### 7.1 クラウド構成
- **Hosting**: Firebase Hosting (Vite アプリ)
- **Functions**: Cloud Functions for Firebase (API, AI Concierge, Triggers)
- **Backend Job**: Cloud Run Jobs (Python - 大規模データクレンジング専用)
- **AI**: Vertex AI (Gemini 2.0 Flash / Pro)

### 7.2 環境変数 (Environment Variables)

| 環境変数名 | 説明 | 使用目的 |
| :--- | :--- | :--- |
| `GCLOUD_PROJECT` | Google Cloud プロジェクト ID | Firestore、Vertex AI、Cloud Run 等のリソース特定。**必須。** |
| `LOCATION` / `GCP_REGION` | リソースの稼働リージョン | Cloud Run Job、Firebase Functions の実行場所指定。 |
| `AI_LOCATION` | Vertex AI (Gen AI) の実行リージョン | Gemini API や Context Cache のパフォーマンス最適化用。 |
| `LOG_LEVEL` | ログ出力詳細度 | DEBUG, INFO, WARN, ERROR のいずれか。システムのデバッグに使用。 |
| `BASIC_AUTH_USER` | Basic 認証ユーザー名 | ステージング・本番環境へのアクセス制限（未設定時は解除）。 |
| `BASIC_AUTH_PASS` | Basic 認証パスワード | 同上。 |
| `CLEANSING_JOB_NAME` | Cloud Run Jobs 名 | AI クレンジングを実行するジョブの名称指定。 |
| `VITE_FIREBASE_API_KEY` | Firebase API キー | フロントエンドからの Firebase 接続認証。 |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API キー | 地図の表示、座標選択、ジオコーディングに使用。 |
| `VITE_FIREBASE_PROJECT_ID` | フロントエンド用プロジェクト ID | フロントエンドが接続する Firebase プロジェクトの指定。 |
| `USE_VERTEX_AI_SEARCH` | Managed RAG 有効化フラグ | `true` の場合、Vertex AI Search を使用してコンシェルジュが回答します。 |
| `VERTEX_AI_CONCIERGE_DATA_STORE_IDS` | コンシェルジュ用データストア ID | コンシェルジュが参照する知識ソース（複数指定はカンマ区切り）。 |
| `VERTEX_AI_DRAFT_DATA_STORE_IDS` | 自動登録・検証用データストア ID | スポットや生物の下書き生成、事実確認に特化した専門知識ソース（カンマ区切り）。 |
