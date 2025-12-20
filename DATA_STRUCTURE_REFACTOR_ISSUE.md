# Issue: Firestore データ構造の非正規化による検索パフォーマンス改善

## 概要
現在のダイビングポイント（Points）データ構造は正規化されており、`areaId` しか保持していない。
Firestore の仕様上、`regionId` や `zoneId` による直接クエリができず、バッチ処理やフィルタリング時にメモリ上での結合処理（JOIN）が必要となっており、将来的なスケールに課題がある。

## 現状の構造
- **Point**: `areaId` のみ保持
- **Area**: `id`, `name`, `zoneId`
- **Zone**: `id`, `name`, `regionId`
- **Region**: `id`, `name`

## 課題
- Cloud Run Jobs（AIクレンジング）等のフィルタリングにおいて、`points` コレクションを全件スキャンしてから Python 側で階層を辿る必要がある。
- データ量が増えた場合（数千〜数万件）、この処理がボトルネックになり、メモリ消費と実行時間が増大する。
- Firestore のインデックスを有効活用した「Region内全ポイント取得」などの単純クエリが単体では実行できない。

## 提案事項（非正規化）
`Point` ドキュメントに以下のフィールドを追加（冗長化）する：
- `regionId`: 所属する Region の ID
- `zoneId`: 所属する Zone の ID
- `areaId`: 所属する Area の ID（既存）

これにより、Firestore の `where` 句だけで高速なフィルタリングが可能になる。

## 実装上の注意
- **データ更新時の整合性**: 管理画面で Area の親（Zone）を変更した場合、その Area に属する全 Point の `zoneId` / `regionId` も一括更新するトリガーが必要。
- **移行スクリプト**: 既存の Point データに親 ID を埋めるためのマイグレーションスクリプトを作成・実行する。

## 関連箇所
- `src/types.ts`: `Point` 型の定義
- `scripts/cleansing_pipeline.py`: `load_data` メソッド（修正が必要）
- `src/pages/AdminAreaCleansingPage.tsx`: 保存/移動ロジック
