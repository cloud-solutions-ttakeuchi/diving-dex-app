# Vertex AI (Gemini) Setup Guide

To enable the AI features (Spot Assistant, Concierge, Translation) in WeDive, follow these steps to configure your Google Cloud environment.

## 1. Google Cloud コンソールでの設定

### 1. API の有効化
まず、GCP コンソールで以下の API を有効にする必要があります。
1. [Google Cloud Console](https://console.cloud.google.com/) に移動します。
2. **[API とサービス] > [ライブラリ]** を開きます。
3. 以下の API をそれぞれ検索して **有効化** してください：
   - **Vertex AI API**
   - **Cloud Functions API**
   - **Cloud Build API**
   - **Artifact Registry API**

### 2. IAM 権限の設定
Cloud Functions が Vertex AI を呼び出すための権限設定をします。

#### デフォルトアカウントが一覧にない場合
Cloud Functions API を有効化した直後や、まだ関数を一度もデプロイしていない場合、デフォルトのサービスアカウント（`PROJECT_NUMBER-compute@developer.gserviceaccount.com` 等）が IAM 一覧に表示されないことがあります。

その場合は、**以下のいずれか**を行ってください：

- **方法A（推奨）**: **[権限を付与]** ボタンを押し、直打ちでサービスアカウント名を入力して追加する。
  - プリンシパルに `PROJECT_NUMBER-compute@developer.gserviceaccount.com` を入力（PROJECT_NUMBERはダッシュボード等で確認可能）。
  - ロールに **"Vertex AI ユーザー"** を設定。
  
- **方法B**: 新しい専用サービスアカウントを作成する。
  1. **[サービス アカウント]** メニューから「新しいサービス アカウントを作成」をクリック。
  2. 名前を `ai-functions-invoker` などにする。
  3. ロールに **"Vertex AI ユーザー"** を付与。
  4. 作成したアカウントを Cloud Functions のデプロイ設定で使用する。

---

## 2. 実装時の注意点

### リージョンの指定
Vertex AI (Gemini 1.5 Flash) は多くのリージョンで利用可能ですが、WeDive では低レイテンシとコストのバランスから `asia-northeast1` (東京) 推奨です。

### 環境変数
Cloud Functions 側で以下の環境変数が正しく設定されていることを確認してください（通常 Firebase 側で自動設定されます）。
- `GCLOUD_PROJECT`: プロジェクト ID

---

## 3. ローカル開発環境での実行

ローカルで functions をテストする場合は、Google Cloud の認証資格情報が必要です。
1. サービスアカウントキー (JSON) をダウンロードします。
2. 環境変数をセットしてエミュレータを起動します。
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="path/to/your/service-account-key.json"
   firebase emulators:start --only functions
   ```
