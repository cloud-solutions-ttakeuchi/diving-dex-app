# Vertex AI Search (Managed RAG) 設定・運用ガイド

WeDive プロジェクトでは、AI の回答精度を極限まで高め、ハルシネーション（嘘）を抑えるために **Vertex AI Search (Managed RAG)** を採用しています。本ドキュメントでは、複数のデータストアを活用した高度な知識連携の設定方法について解説します。

## 1. 概要
従来の AI（Gemini等）は Web 上の一般情報を元に回答しますが、WeDive では**自社で保有・定義した正確な知識**を優先的に参照させます。

- **役割の分離**: 「コンシェルジュ（提案）」と「ドラフト生成（マスタ登録）」で参照するデータを分けることで、ノイズを排除し精度を最大化します。
- **複数データストアの統合**: 構造化データ（Firestore）と非構造化データ（PDF/Web等）を、用途に応じて複数組み合わせることが可能です。

## 2. データストアの設計と作成

Google Cloud コンソールの **Search and Conversation** (旧 Gen App Builder) からデータストアを作成します。

### ステップ 1: 用途別のデータストア作成

以下の 3 つのカテゴリでデータストアを作成することを推奨します。

1.  **[構造化] WeDive マスタ (Firestore)**
    - **内容**: `points`, `creatures`, `areas` コレクション。
    - **設定**: Firestore をソースとして選択。
    - **用途**: 既存のスポット情報や生物情報の検索。
2.  **[非構造化] 生物図鑑・ガイドブック (PDF/ドキュメント)**
    - **内容**: 提携している生物図鑑、地域ごとのダイビングルール、安全ガイド。
    - **設定**: Cloud Storage (GCS) に PDF をアップロードし、フォルダ単位でソースに指定。
    - **用途**: 生物の学名、詳細な生態、地域の特殊なルールの補完。
3.  **[構造化/非構造化] 公報・外部信頼ソース (Web/JSON)**
    - **内容**: 気象庁、海上保安庁の公報データや、信頼できる特定の Web サイト。
    - **用途**: 海況、座標情報の最終検証。

### ステップ 2: ID の取得
作成した各データストアの詳細画面から **データストア ID** をコピーしてください。
（例: `wedive-points-ds`, `creature-dictionary-v1`, `local-guide-pdf`）

## 3. アプリケーションの設定（環境変数）

WeDive アプリケーション（Cloud Functions）に対して、用途別に ID を割り当てます。

### 指定方法
- **カンマ区切り**: 複数のソースを参照させる場合は、ID をカンマ `,` で繋ぎます。
- **パース規則**: プログラム側で自動的にトリミング（空白除去）と空値除外を行うため、多少のスペースがあっても問題ありません。

### 環境変数リスト
| 変数名 | 指定例 / ベストプラクティス |
| :--- | :--- |
| `VERTEX_AI_CONCIERGE_DATA_STORE_IDS` | `wedive-master-ds, local-guide-pdf` |
| `VERTEX_AI_DRAFT_DATA_STORE_IDS` | `creature-dictionary-v1, official-spot-master-ds` |

### Firebase への反映コマンド例
```bash
# 全体フラグをONにする
firebase functions:config:set ai.use_vertex_ai_search="true"

# コンシェルジュ用データストア（複数指定）
firebase functions:config:set ai.vertex_ai_concierge_data_store_ids="wedive-points,local-manuals-pdf"

# ドラフト生成用データストア
firebase functions:config:set ai.vertex_ai_draft_data_store_ids="bio-dictionary-v2,area-official-data"
```

## 4. 2段階検証（ハイブリッド RAG）の動作原理

WeDive の `generateAIDrafts` ツールは、コストと精度のバランスを取るため以下の挙動をとります。

1.  **内部検索 (Step 1)**: `VERTEX_AI_DRAFT_DATA_STORE_IDS` に指定した**自社データストアのみ**を検索します。ここで確実な答えが見つかれば、高額な Google 検索（Web）は行いません。
2.  **ハルシネーション検知**: 回答が「確証なし」あるいは「内部データと矛盾」する場合、AI が内部的に `needs_search` フラグを立てます。
3.  **外部グラウンディング (Step 2)**: 必要な場合のみ、Google 検索を実行して情報を補完・検証します。

## 5. 運用上の注意点
- **同期ラグ**: Firestore をソースにした場合、データの変更が検索結果に反映されるまで数十分程度のラグが発生することがあります。
- **コスト管理**: Vertex AI Search のクエリ単価に注意してください。不要なデータストアは指定から外す、または `USE_VERTEX_AI_SEARCH` を `"false"` にすることで通常の LLM 動作に戻せます。
- **リージョン**: Gemini 2.0 Flash を利用する場合、インフラ（Firebase）が日本にあっても、AI エージェントのロケーション（`AI_AGENT_LOCATION`）は `us-central1` に設定してください。
