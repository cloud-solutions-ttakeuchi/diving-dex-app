# WeDive 機能定義書

本ドキュメントは、WeDive アプリケーションに実装されているすべての機能を網羅し、その詳細および URI パスを定義します。

---

## 1. ユーザー向けコア機能

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
  - 地形、難易度、最大水深の閲覧。
  - **出現生物リスト**: AI およびユーザーログに基づいた生息生物一覧。
  - **周辺ショップ**: 登録されているダイビングショップの表示。
- **お気に入り機能 (`/mypage`)** (参照: `users`, `points`): ポイントのブックマーク保存と訪問履歴管理。

### 1.4 ホーム画面 (`/`)
- **特集 (Featured Points)** (参照: `points`): カルーセル形式のスポット紹介。
- **トレンド** (参照: `creatures`, `users/logs`): 人気生物、最新公開ログのフィード。

---

## 2. 独自の AI & ゲーミフィケーション機能

### 2.1 AI コンシェルジュ (`/concierge`) (参照: `points`, `creatures`, `ai_grounding_cache`)
- **対話型検索**: 自然言語によるスポット・生物の質問・提案。
- **Vertex AI 連携**: Gemini 2.0 Flash を使用したパーソナライズ提案。

### 2.2 トラストランク・システム (参照: `users`)
- **トラストポイント (TP)**: データの提供・クレンジングへの貢献で獲得。
- **ランクアイコン**: 「しずく(Droplet)」から「王冠(Crown)」までのランク進化。
- **権限**: ランクに応じて提案の承認権限（モデレーター）が付与。

### 2.3 パーソナル・アナリティクス (`/mypage`) (参照: `users/logs`, `users`, `creatures`, `point_creatures`)
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

## 4. システム仕様・UX
- **利用規約・プライバシー (`/terms`, `/privacy`)** (参照: `users`): バージョン管理された同意フロー。
- **イメージ・フォールバック** (参照: なし): 画像未登録時にカテゴリ（魚、ウミウシ等）別のデフォルト画像を表示。
- **データ整合性** (参照: 全コレクション): `DATABASE_DESIGN.md` に定義された厳格な ID 規則の適用。
