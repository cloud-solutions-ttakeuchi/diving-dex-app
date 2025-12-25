# WeDive 機能定義書

本ドキュメントは、WeDive アプリケーション（Web/Mobile）に実装されているすべての機能を網羅し、その詳細および仕様を定義します。

---

## 1. モバイルアプリ (wedive-app)
モバイル環境に最適化したUI/UXを提供し、ダイビング中や移動中の利便性を高めます。

### 1.1 タブナビゲーション
- **ホーム**: おすすめスポット、人気生物、AIコンシェルジュへのショートカット。
- **探す**: スポット、生物、パブリックログの3カテゴリ横断検索。
- **AI相談**: 自然言語によるダイビングの悩み・プラン相談（AIコンシェルジュ）。
- **マイページ**: 自身の統計、ログブック、コレクション管理。
- **没入型レイアウト**: ポイント詳細ページ等の主要コンテンツ表示時、タブバーを非表示にし画面全体を活用する没入型UIを採用。

### 1.2 ログ記録 (Mobile専用)
- **クイックアクセス (FAB)**: 画面右下の「＋」ボタンから即座に記録開始。
- **ログイン制御**: ログ登録およびマイページの一部機能は、Firebase認証によるログイン後のみ有効化。

---

## 2. ユーザー向けコア機能 (共通)

### 1.1 ダイビングログ管理・記録
- **ログ登録・編集 (`/add-log`, `/edit-log/:id`)** (参照: `users/logs`, `points`, `creatures`):
  - **動的バリデーション**: 日付、潜水時間、水深、コンディション、使用器材の入力。
  - **地図連携 (`MapPickerModal`)**: Google Maps API を使用した座標設定と住所の自動取得。
  - **生物のタグ付け**: 図鑑と連動したサジェスト、目撃した複数生物の紐付け。
  - **写真管理**: 写真アップロードと代表写真の設定。
- **ログの一括操作 (`MyPage` > `BulkEditModal`)** (参照: `users/logs`):
  - 複数ログの同時選択による場所、海況、器材設定の一括変更および一括削除。
- **外部データ連携 (`MyPage` > `LogImportModal`)** (参照: `users/logs`):
  - Garmin Connect (CSV) インポートによる一括ログ生成。
  - 秒単位の水深・温度データの保存とプロファイルグラフ表示。

### 1.2 高度な生物図鑑 (Pokedex)
- **検索・フィルター (`/pokedex`)** (参照: `creatures`):
  - 和名・学名・英名検索。カテゴリ（魚類・甲殻類等）やレア度でのフィルタリング。
- **生物詳細表示 (`/creature/:id`)** (参照: `creatures`, `point_creatures`, `points`):
  - 生態・深度・水温範囲の表示。
  - **レア度表示**: 1-4つの星（Common, Rare, Epic, Legendary）。
  - **分布データ**: その生物が見られるポイントの一覧。
  - **パラメータ評価**: 人気、サイズ、危険、寿命、逃げ足、レア度の 5 段階表示。
- **コレクション管理 (`/mypage`)** (参照: `users`, `creatures`): Wanted（会いたい）および Favorites（お気に入り）への保存。

### 1.3 ポイント探索 (Diving Spot Discovery)
- **検索・フィルター (`/points`)** (参照: `regions`, `zones`, `areas`, `points`):
  - **Region > Zone > Area > Point** の 4 階層 ID 連携ドリルダウン検索。
- **ポイント詳細 (`/point/:id`, `/spot/:id`)** (参照: `points`, `point_creatures`, `creatures`):
  - **プレミアムUI**: ガラスモフィズム、ヒーローセクション、アイコン付きスペックカードによる洗練された表示。
  - **階層ナビゲーション**: 🏠WeDive > 地域 > エリア のパンくずリストにより、直感的な階層移動が可能。
  - 地形、難易度、最大水深の閲覧。
  - **出現生物リスト**: AI およびユーザーログに基づいた生息生物一覧（リッチなカードデザイン）。
  - **周辺ショップ**: 登録されているダイビングショップの表示。
- **お気に入り機能 (`/mypage`)** (参照: `users`, `points`): ポイントのブックマーク保存と訪問履歴管理。

### 1.4 ホーム画面 (`/`)
- **特集 (Featured Points)** (参照: `points`): カルーセル形式のスポット紹介。
- **トレンド** (参照: `creatures`, `users/logs`): 人気生物、最新公開ログのフィード。

---

## 2. 独自の AI & ゲーミフィケーション機能

### 2.1 AI コンシェルジュ (`/concierge`) (参照: `points`, `creatures`, `ai_grounding_cache`)
- **対話型検索**: 自然言語によるスポット・生物の質問・提案。
- **マルチ・ドメイン RAG (Vertex AI Search)**: 接客・提案に特化したデータストア（`VERTEX_AI_CONCIERGE_DATA_STORE_IDS`）を参照。WeDive マスタデータに加え、地域のガイドブックPDF等からパーソナライズされた回答を生成。
- **情報の透明性**: 回答の根拠（Grounding Metadata）を表示し、信頼性の高い提案を提供。
- **ユーザー文脈の考慮**: ユーザーの経験本数や好みに基づき、一人ひとりに最適なバディとしてアドバイス。
- **フォールバック機構**: 従来のキーワードベース (Firestore limit 15) の検索も維持。

### 2.2 AI 自動入力・検証機能 (Grounded Auto-fill)
- **スポット・生物の自動ドラフト生成**: 名称を入力するだけで、AI が世界中のデータベースや Web 情報を調査し、詳細な説明・座標・生態情報を自動入力。
- **ハルシネーション対策 (2段階検証)**: 登録専用の信頼データソース（`VERTEX_AI_DRAFT_DATA_STORE_IDS`）と Google Search をハイブリッドで利用。確証がない場合は「情報不足」としてユーザーに確認を促す。
- **引用元の明示**: 生成された情報の根拠となった資料や Web サイトの URL を表示。

### 2.3 トラストランク・システム (参照: `users`)
- **トラストポイント (TP)**: データの提供・クレンジングへの貢献で獲得。
- **ランクアイコン**: 「しずく(Droplet)」から「王冠(Crown)」までのランク進化。
- **権限**: ランクに応じて提案の承認権限（モデレーター）が付与。

### 2.4 パーソナル・アナリティクス (`/mypage`) (参照: `users/logs`, `users`, `creatures`, `point_creatures`)
- **統計**: 累計ダイブ数、発見種数、エリア分布（円グラフ）。
- **ポイント・マスタリー**: 特定ポイントの生息生物の発見進捗率。
- **シルエット表示**: 未発見生物をシルエットで表示し収集を促進。

---

## 3. 運営・管理機能

### 3.1 申請・承認システム (参照: `creature_proposals`, `point_proposals`, `creatures`, `points`)
- **ユーザー提案 (`/propose-creature`, `/propose-point`)**: 生物やポイントの新規・修正申請。
- **承認・却下 (`/admin/proposals`)**: 管理者・モデレーターによる申請の精査。

### 3.2 管理者向け管理ページ (Admin Only)
- **ユーザー管理 (`/admin/users`)** (参照: `users`): ユーザーロール (User/Moderator/Admin) の変更。
- **生物図鑑管理 (`/admin/creatures`)** (参照: `creatures`, `points`, `point_creatures`):
  - データの直接編集・削除。
  - **地点紐付け管理**: 特定の生物をダイビングポイントへ手動でリンク/解除。
- **マスタデータ整理 (`/admin/areas`)** (参照: `regions`, `zones`, `areas`):
  - **エリア統合**: 表記揺れ（Orphan データ）をマスタデータ (ID 保持) へ統合。
  - **DB同期**: シードファイルからの Firestore 同期実行。
  - **エクスポート機能**:
    - **Locations**: `locations_seed_export_*.json` (階層データ)
    - **Creatures**: `creatures_real_export_*.json` (生物データ)
    - **Relations**: `point_creatures_seed_export_*.json` (紐付けデータ)
  - **DBメンテナンス**: Truncate (全削除), Hard Reset (全削除+初期化), Delete My Logs。
- **AI データクレンジング (`/admin/cleansing`)** (参照: `creatures`, `point_creatures`, `points`, `regions`, `zones`, `areas`):
  - **Dashboard**: クレンジングパイプラインの実行条件設定（範囲/モード）。
  - **Review Engine**: AI が生成した「地点×生物」の紐付け案の承認・却下。
  - **エクスポート**: `EXPORT SEED` ボタン（※現在は UI プレースホルダー、ロジックは `/admin/areas` に実装済み）。

---

## 4. 開発者・管理者向けのメンテナンスツール (CLI)

システムの整合性維持とデータ拡充のため、以下の CLI ツール群が提供されています。これらは主に `scripts/` ディレクトリに配置されています。

### 4.1 データ拡充・クレンジング (AI/外部連携)
- **AI クレンジングパイプライン (`scripts/cleansing_pipeline.py`)**:
    - **ふるまい**: 指定された範囲（地域・地点・生物）に対して Vertex AI (Gemini) を呼び出し、生態学的妥当性と目撃実績（Google Search）を検証します。
    - **使い方**: `python scripts/cleansing_pipeline.py --region "沖縄"`
    - **コレクションへの影響**: Firestore の `point_creatures` に新たな紐付け案（`status: 'pending'`）を作成、または既存の不正確なデータを `rejected` に変更します。
- **生物画像取得スクリプト (`scripts/creatures/fetch_creature_images.py`)**:
    - **ふるまい**: Wikipedia API を使用して、生物名（和名・英名・学名）に合致する画像URLとクレジットを取得します。
    - **使い方**: `python scripts/creatures/fetch_creature_images.py`
    - **コレクションへの影響**: **ローカル**の `src/data/creatures_seed.json` を更新します。画像未設定の生物に `imageUrl`, `imageCredit`, `imageLicense` が付与されます。
- **生物データ自動補完 (`scripts/creatures/fill_prepare_data.py`)**:
    - **ふるまい**: AI を使用して、生物の平均サイズ、水温範囲、タグ、ステータス（Stats）などの欠落情報を補完します。
    - **使い方**: `python scripts/creatures/fill_prepare_data.py`
    - **コレクションへの影響**: **ローカル**の `creatures_prepare.json` または `creatures_seed.json` を更新します。

### 4.2 階層データ生成・管理
- **場所データ階層生成 (`scripts/locations/generate_*.py`)**:
    - **ふるまい**: `generate_zones`, `generate_areas`, `generate_points` の順に実行し、Gemini を用いて特定の地域のダイビングスポット階層を自動生成します。
    - **使い方**: `python scripts/locations/generate_zones.py --mode append`
    - **コレクションへの影響**: **ローカル**の `locations_seed.json` を更新します。
- **ID規則正規化ツール (`scripts/reformat_point_creatures.py`)**:
    - **ふるまい**: 既存のシードデータ内にある ID からアンダースコアを除去し、システム全体の新しい ID 命名規則に適合させます。
    - **使い方**: `python scripts/reformat_point_creatures.py`
    - **コレクションへの影響**: **ローカル**の `point_creatures_seed.json` の `pointId`, `creatureId`, `id` をリフォーマットします。

### 4.3 データベース・メンテナンス
- **DBメンテナスクリーアップ (`scripts/cleanup_old_mappings.py`)**:
    - **ふるまい**: ID 規則に違反したゴミデータや、古いロジックで作成された重複・不要な紐付けデータを一括削除します。
    - **使い方**: `python scripts/cleanup_old_mappings.py --project [PROJECT_ID] --trash-only --execute`
    - **コレクションへの影響**: Firestore の `point_creatures` コレクション from、条件に合致するドキュメントを**物理削除**します。
- **DB レア度整合性修正 (`scripts/maintenance/fix_rarities.py`)**:
    - **ふるまい**: `point_creatures` の `localRarity` フィールドに不正な値（AIの解説文など）が入っている場合、キーワード（Rare等）を抽出して正規化します。
    - **使い方**: `python scripts/maintenance/fix_rarities.py --project [PROJECT_ID] --execute`
    - **コレクションへの影響**: `point_creatures` の `localRarity` を Enum 値に修正します。

---

## 5. システム仕様・UX
- **利用規約・プライバシー (`/terms`, `/privacy`)** (参照: `users`): バージョン管理された同意フロー。
- **イメージ・フォールバック** (参照: なし): 画像未登録時にカテゴリ（魚、ウミウシ等）別のデフォルト画像を表示。
- **データ整合性** (参照: 全コレクション): `DATABASE_DESIGN.md` に定義された厳格な ID 規則の適用。
