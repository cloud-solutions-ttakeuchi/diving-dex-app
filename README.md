# WeDive

ダイビングログと生物図鑑を統合した「Diving Dex App」のソースコードリポジトリです。
React (Vite) + Firebase を用いたモダンなシングルページアプリケーション (SPA) として構築されています。

## Architecture & Tech Stack

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
  - **Auto Content Generation**: 最新の検索結果に基づき登録情報を自動生成。

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

# 3. ビルド & プッシュ
docker build -t ${REGION}-docker.pkg.dev/${GOOGLE_CLOUD_PROJECT}/wedive-repo/cleansing-pipeline:latest -f docker/cleansing/Dockerfile .
docker push ${REGION}-docker.pkg.dev/${GOOGLE_CLOUD_PROJECT}/wedive-repo/cleansing-pipeline:latest

# 3. ジョブの作成/更新
gcloud run jobs deploy cleansing-job \
    --image ${REGION}-docker.pkg.dev/${GOOGLE_CLOUD_PROJECT}/wedive-repo/cleansing-pipeline:latest \
    --project ${GOOGLE_CLOUD_PROJECT} \
    --region ${REGION}
```

## Security & Vulnerability Management
React等のコアライブラリに脆弱性が発見された場合、速やかに `package.json` のバージョンを更新し、検証を行ってください。
現在の構成は **React v19** ベースです。
