# Test Scenarios v1.4.0: Data Generation Optimization

v1.4.0で実装されたデータ生成スクリプト群（Point重複対策、生物データ構造化、実行モード）の動作検証を行うためのテストシナリオです。

## 🧪 Pre-conditions (API Key)

レート制限回避のため、有料版APIキーの設定を推奨します。
```bash
export GOOGLE_API_KEY="AIzaSy..."
```

---

## 📍 Scenario 1: Location Generation Modes

新しく実装された3つのモード（Append, Overwrite, Clean）の挙動を確認します。

### Case 1: Clean Mode (初期構築)
- **Condition**: 既存データがある状態でもOK。
- **Action**: `python scripts/locations/generate_zones.py --mode clean`
- **Expected Result**:
  - 既存の `src/data/locations_seed.json` がバックアップされる（`.bak`）。
  - 新しいファイルが作成され、`target_regions.json` にある全RegionのZoneが生成される。

### Case 2: Append Mode (追記確認 - Default)
- **Condition**: `config/target_regions.json` に新しいRegion（例: "ハワイ"など未生成のもの）を追加する。または手動で `locations_seed.json` に空のRegionを追加しておく。
- **Action**: `python scripts/locations/generate_zones.py --mode append`
- **Expected Result**:
  - **既存のRegion/Zoneはスキップ**される（ログに `Skipping...` と出る）。
  - **新しく追加したRegionのみ**、Zone生成処理が実行される。
  - API消費が最小限に抑えられること。

### Case 3: Overwrite Mode (特定箇所再生成)
- **Condition**: 既存の `locations_seed.json` にある特定のRegion（例: "日本"）のデータが気に入らないとする。
- **Action**: `config/target_regions.json` を "日本" だけにした状態で、`python scripts/locations/generate_zones.py --mode overwrite`
- **Expected Result**:
  - "日本" の既存データが削除され、新しいデータで上書きされる。
  - IDが変わる（タイムスタンプベースのため）。
  - 他のRegion（パラオなど）は影響を受けない（※設定ファイルに記載なければ処理されないが、記載ある場合は順番にOverwriteされるので注意）。

---

## 📍 Scenario 2: Granular Pipeline Flow

中間ファイル生成の流れを確認します。

### Step 1 -> 2 -> 3
1. **Zones**: `python scripts/locations/generate_zones.py --mode append`
   - `config/target_zones.json` が生成/更新される。
2. **Areas**: `python scripts/locations/generate_areas.py --mode append`
   - `target_zones.json` を読み込み、Area未定義のZoneに対してのみ生成される。
   - `config/target_areas.json` が生成/更新される。
3. **Points**: `python scripts/locations/generate_points.py --mode append`
   - `target_areas.json` を読み込み、Point未定義のAreaに対してのみ生成される。
   - 重複がある場合はスキップされる。

---

## 🐠 Scenario 3: Creature Generation Pipeline

（変更なし、既存シナリオ通り）
...
