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

### リージョンの指定とモデルの可用性
- **Cloud Functions**: レイテンシを抑えるため、`asia-northeast1` (東京) で稼働させます。
- **Vertex AI (Gemini 2.0 Flash)**: 最新の Gemini 2.0 シリーズは現在、東京リージョンでは提供されていない場合があります（`404 Model Not Found`）。そのため、SDK の **`location` パラメータには `us-central1` を指定** する必要があります。
  - 函数: `asia-northeast1`
  - Vertex AI SDK: `us-central1`

### デプロイと CORS 改修
ブラウザからの直接呼び出しにおける CORS エラーを回避するため、Firebase Hosting の `rewrites` を利用したリバースプロキシ構成を採用しています。

#### 1. `firebase.json` の設定
`/api/*` パスを、該当する Cloud Functions（東京リージョン）へ正確にルーティングします。

```json
"hosting": {
  "rewrites": [
    {
      "source": "/api/concierge",
      "function": "getConciergeResponse",
      "region": "asia-northeast1"
    },
    {
      "source": "/api/spot-draft",
      "function": "generateSpotDraft",
      "region": "asia-northeast1"
    },
    ...
  ]
}
```

#### 2. フロントエンドでの呼び出し (`.tsx`)
`httpsCallable` の代わりに、標準の `fetch` を使用して同一ドメインのエンドポイントを叩きます。認証情報を維持するため、Firebase Auth の ID トークンをヘッダーに付与します。

```typescript
const token = await auth.currentUser?.getIdToken();
const response = await fetch('/api/concierge', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ data: { ... } })
});
```

これにより、Cloud Run 特有の IAM 権限問題 (`allUsers` 許可の失敗) に左右されず、安全かつ確実に AI 機能を呼び出すことが可能になりました。

---

## 3. ローカル開発環境での実行

ローカルで functions をテストする場合は、Google Cloud の認証資格情報が必要です。
1. サービスアカウントキー (JSON) をダウンロードします。
2. 環境変数をセットしてエミュレータを起動します。
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="path/to/your/service-account-key.json"
   firebase emulators:start --only functions
   ```
