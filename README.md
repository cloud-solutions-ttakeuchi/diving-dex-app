# WeDive

ダイビングログと生物図鑑を統合した「Diving Dex App」のソースコードリポジトリです。
React (Vite) + Firebase を用いたモダンなシングルページアプリケーション (SPA) として構築されています。

## Technical Documentation

プロジェクトの技術仕様および運用ルールに関するドキュメントです。開発・修正前に必ず一読してください。

- **[DATABASE_DESIGN.md](./DATABASE_DESIGN.md)**: Firestoreデータ構造・ID命名規則（**最重要**）
- **[INFRASTRUCTURE.md](./INFRASTRUCTURE.md)**: システム構成・インフラ・CI/CD
- **[FUNCTIONALITY.md](./FUNCTIONALITY.md)**: 主要機能一覧・ユーザー体験・AIフロー
- **[admin_manual.md](./admin_manual.md)**: 管理者向け操作マニュアル（AIパイプライン詳細）
- **[design_and_specs.md](./design_and_specs.md)**: 全体設計書・UI/UX仕様
- **[VERTEX_AI_SETUP_GUIDE.md](./VERTEX_AI_SETUP_GUIDE.md)**: Vertex AI Search (Managed RAG) の詳細設定・複数DSの連携ガイド

## 1. Architecture & Tech Stack

本プロジェクトのアーキテクチャと採用技術、および主要なライブラリのバージョンは以下の通りです。
（※2025年12月現在）

### Core Framework
- **Runtime**: Node.js (v20推奨)
- **Framework**: [React](https://react.dev/) `v19.2.3` (Security Patched)
- **Build Tool**: [Vite](https://vitejs.dev/) `v7.2.4`
- **Language**: [TypeScript](https://www.typescriptlang.org/) `v5.9.3`

### Backend / Infrastructure (Serverless)
- **Platform**: [Firebase](https://firebase.google.com/) `v12.6.0`
  - **Hosting**: 静的サイトホスティング
  - **Authentication**: Google認証
  - **Firestore**: NoSQLデータベース (v2 Data Model)
  - **Storage**: 写真画像ストレージ
  - **Remote Config**: 機能フラグ管理 (Feature Toggles)

### Libraries & Tools
- **UI/Styling**:
  - [Tailwind CSS](https://tailwindcss.com/) `v4.1.17`
  - [Lucide React](https://lucide.dev/) (Icons) `v0.555.0`
  - [Framer Motion](https://www.framer.com/motion/) (Animations) `v12.23.24`

## Configuration & Feature Flags

機能のON/OFFや挙動の制御は以下の設定ファイルおよび環境変数で行います。
- **[src/config/features.ts](./src/config/features.ts)**: アプリケーション内機能フラグの定義
- **Firebase Remote Config**: (運用環境) 動的な機能切り替え

### Environment Variables (Functions)
The following variables can be set in GitHub Actions Variables or Firebase Config to control application behavior:

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | アプリ全体のログ出力レベル制御。`debug` に設定すると、Vertex AI とのやり取りに関する詳細なログを出力します。 | `info` |
| `LOCATION` | 一般的なインフラ実行リージョン（例: `asia-northeast1`） | `asia-northeast1` |
| `AI_AGENT_LOCATION` | **必須**。Gemini 2.0 Flash 及び Context Caching を利用するため `us-central1` を指定してください。 | `us-central1` |
| `USE_VERTEX_AI_SEARCH` | **Feature Flag**。`true` で Managed RAG (Vertex AI Search) を有効化します。 | `false` |
| `VERTEX_AI_CONCIERGE_DATA_STORE_IDS` | **AI コンシェルジュ専用**。参照するデータストア ID（複数指定はカンマ区切り）。WeDive マスタ、ガイドブックPDF等を指定します。 | - |
| `VERTEX_AI_DRAFT_DATA_STORE_IDS` | **AI 自動登録・検証専用**。参照するデータストア ID（複数指定はカンマ区切り）。生物図鑑、公式公報、地点マスタ等を指定します。 | - |

---

## 🛠 Admin Operations
- **Charts / Visualization**:
  - [Recharts](https://recharts.org/) `v3.5.1` (Depth Profile)
- **Data Processing**:
  - [JSZip](https://stuk.github.io/jszip/) (Garmin ZIP handling)
  - [fit-file-parser](https://github.com/jimmykane/fit-file-parser) (Garmin FIT handling)
  - [PapaParse](https://www.papaparse.com/) (CSV Import)
- **Routing**: [React Router](https://reactrouter.com/) `v7.9.6`

### Special Features (AI & Data Engineering)
- **AI Engine**: **Google Vertex AI (Gemini 2.0 Flash)**
  - **High-Precision Biological Mapping**: 2段階検証（物理フィルタリング + Google Search Grounding）による生物生息データの高度なクレンジング。
  - **Context Caching**: 最新の GenAI SDK を活用し、大規模データ処理時のAPIコストを大幅に削減。
  - **Batch Ops**: Cloud Run Jobs を用いた大規模バッチ処理エンジン。
  - **AI Concierge**: 自然言語によるダイビングスポット検索・提案。
  - **Auto Content Generation (Grounded)**: **Managed RAG (Vertex AI Search)** と Google Search を組み合わせた、根拠付きの自動登録ドラフト生成。ハルシネーションを最小化。
  - **Knowledge Transparency**: 生成された情報のソース（URL）と根拠（Grounding Metadata）をフロントエンドに表示。

## Development

### Prerequisites
- Node.js v20+
- npm or yarn

### Setup
```bash
# Install dependencies
npm install
```

### Run Locally
フロントエンドとバックエンド（AIエンジン）を手元で連携させてテストする手順です。

#### 1. フルローカル検証（エミュレータ利用）

##### エミュレータ概要

- https://firebase.google.com/docs/emulator-suite?hl=ja

本番環境に影響を与えず、全ての機能を自分のPC内で完結させます。
1. **バックエンド起動**:
   ```bash
   cd functions && npm run build && cd ..
   firebase emulators:start --only functions,firestore
   ```
2. **フロントエンド起動**:
   ```bash
   npm run dev
   ```
3. **実行**: `http://localhost:5173/admin/cleansing` を開き、実行ボタンを押します。
   - `vite.config.ts` のプロキシ設定により、ブラウザからのリクエストは自動的にローカルエミュレータへ届き、Vertex AI を呼び出します。
   - 管理者権限が必要な場合は、エミュレータ上のFirestoreで対象ユーザーの `role` フィールドを `admin` に変更してください。

#### 2. クラウド連動検証（Staging連携）
手元でエミュレータを立てるのが面倒な場合、すでにデプロイ済みの開発環境（Devプロジェクト）の Cloud Functions を直接呼び出すこともできます。
- **設定変更**: `vite.config.ts` の `proxy` 設定にある `target` を、開発環境の Functions URL に書き換えて `npm run dev` を実行してください。
- これにより、フロントエンドはローカルで開発しながら、AI判定はクラウド上の最新エンジンを使用できます。

### Build
```bash
# Type check & Build
npm run build
```

## Deployment (Development Environment)

開発環境（`dive-dex-app-dev` プロジェクト）へのデプロイ手順です。本番リリースの前の動作確認に使用します。

### 1. プロジェクトの切り替え
```bash
firebase login --reauth
firebase use default
```

### 2. バックエンド（Cloud Functions）のデプロイ
```bash
# ビルド
cd functions
npm install
npm run build
cd ..

# デプロイ
firebase deploy --only functions
```

### 3. フロントエンド（Hosting）のデプロイ
```bash
# ビルド
npm run build

# デプロイ
firebase deploy --only hosting
```

### 4. バッチ処理（Cloud Run Jobs）のデプロイ
```bash
# 0. プロジェクトの設定
export GOOGLE_CLOUD_PROJECT="dive-dex-app-dev"
export REGION="asia-northeast1"

# 1. 保存場所の作成（初回のみ）
gcloud artifacts repositories create wedive-repo --repository-format=docker --location=${REGION} --project=${GOOGLE_CLOUD_PROJECT}

# 2. Docker の認証設定（初回または認証切れ時）
gcloud auth configure-docker ${REGION}-docker.pkg.dev --project=${GOOGLE_CLOUD_PROJECT}

# 3. ビルド & プッシュ (※Apple Siliconをお使いの場合は --platform linux/amd64 が必須)
docker build --platform linux/amd64 -t ${REGION}-docker.pkg.dev/${GOOGLE_CLOUD_PROJECT}/wedive-repo/cleansing-pipeline:latest -f docker/cleansing/Dockerfile .
docker push ${REGION}-docker.pkg.dev/${GOOGLE_CLOUD_PROJECT}/wedive-repo/cleansing-pipeline:latest

# 4. ジョブの作成/更新 (AI_AGENT_LOCATION は us-central1 を推奨)
# 大規模クレンジングを完走させるため、--max-timeout 604800 (7日間) を設定します
gcloud run jobs deploy cleansing-job \
    --image ${REGION}-docker.pkg.dev/${GOOGLE_CLOUD_PROJECT}/wedive-repo/cleansing-pipeline:latest \
    --project ${GOOGLE_CLOUD_PROJECT} \
    --region ${REGION} \
    --max-timeout 604800 \
    --set-env-vars "GCLOUD_PROJECT=${GOOGLE_CLOUD_PROJECT},LOCATION=${REGION},AI_AGENT_LOCATION=us-central1,LOG_LEVEL=debug"
```

### 5. データベースのメンテナンス（旧データの削除）
AI クレンジングエンジンを刷新した際、古いロジックで作成された不正確なデータを一括削除できます。
```bash
# 1. 認証の更新
gcloud auth application-default login

# 2. 差分（削除対象）の確認
python3 scripts/cleanup_old_mappings.py --project dive-dex-app-dev

# 3. 実行（実際に削除）
python3 scripts/cleanup_old_mappings.py --project dive-dex-app-dev --execute
```
```

## Security & Vulnerability Management
React等のコアライブラリに脆弱性が発見された場合、速やかに `package.json` のバージョンを更新し、検証を行ってください。
現在の構成は **React v19** ベースです。
