# Scenario Testing: v2.1.5
## Objective
AIクレンジング基盤の Cloud Run Jobs 移行に伴う、非同期バッチ実行と Firestore 直接更新の整合性を検証する。

---

## Scenario 1: Cloud Run Job Trigger Verification
API呼び出しが正常にバックグラウンドジョブをキックできるか。

### 1-1: ポイント指定によるピンポイント起動
- **手順**:
    1. 管理画面から特定のポイントを選択し「クレンジング実行」をクリック。
- **期待結果**:
    - Cloud Functions が即座に成功レスポンス（`Cleansing job started in the background`）を返すこと。
    - Cloud Functions のログに `Job cleansing-job-prod started successfully` と記録されること。
    - [GCP Console] > [Cloud Run] > [Jobs] の実行履歴に新しいタスクが作成されていること。

### 1-2: 引数の正確な伝搬
- **前提**: 環境変数 `LOG_LEVEL` が `debug` に設定されている。
- **手順**: 
    1. `mode="all"`, `limit=10` 等の条件を指定して実行。
- **期待結果**:
    - Cloud Run Job の実行時引数を確認し、`--mode all --limit 10` 等が正しくオーバーライドされていること。

---

## Scenario 2: Batch Execution & Persistence
Python版エンジンが Firestore を正しく更新し、キャッシュを活用できているか。

### 2-1: Firestore 直接書き込みテスト
- **手順**: バッチ完了を待ち、Firestore の `point_creatures` コレクションを確認。
- **期待結果**:
    - 対象ポイントのデータが作成/更新されていること。
    - `method: "python-batch-v1"` という属性が付与されていること。
    - `updatedAt` がサーバータイムスタンプで更新されていること。

### 2-2: Context Caching 正常性確認
- **手順**: Cloud Run Job の標準出力ログを確認。
- **期待結果**:
    - `Creating Context Cache...` および `Context Cache created` のログが出力されていること。
    - 2回目以降のポイント判定時に、キャッシュが再利用され、トークン消費が抑えられていること。（GCP課金ダッシュボードまたはログから類推）

---

## Scenario 3: Error Handling & Fallback
### 3-1: 存在しないポイントの指定
- **手順**: 意図的に不正な `pointId` を渡して Job を起動。
- **期待結果**:
    - Job は起動するが、Python のログに `Loaded 0 target points.` と記録され、処理が安全に終了（空振り）すること。
