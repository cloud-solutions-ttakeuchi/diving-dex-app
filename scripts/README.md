# Data Generation Scripts

Project "Diving Dex" 用のデータ生成スクリプト群です。
Google Gemini APIを使用して、ダイビングポイントや生物データを生成・拡充します。

## 📂 Directory Structure

```
scripts/
 ├─ locations/ ... ポイントデータ生成（階層別）
 │   ├─ generate_zones.py  (Step 1: Region -> Zone)
 │   ├─ generate_areas.py  (Step 2: Zone -> Area)
 │   └─ generate_points.py (Step 3: Area -> Point / Deduplication)
 ├─ creatures/ ... 生物データ生成
 │   ├─ generate_creatures_by_family.py (Step 1)
 │   ├─ fetch_creature_images.py        (Step 2)
 │   ├─ map_creatures_to_regions.py     (Step 3-A)
 │   └─ map_creatures_to_areas.py       (Step 3-B)
 ├─ config/ ... 設定ファイル
 │   ├─ target_regions.json  (for Step 1)
 │   ├─ target_families.json (for Creatures)
 │   └─ target_zones.json / target_areas.json (Intermediate)
 └─ v1/ ... 旧スクリプト
```

## 📍 Location Generation Pipeline

### Execution Modes
API制限の回避やデータ保護のため、以下の3つの実行モードをサポートしています。

| Mode | Command Arg | Description | Use Case |
| :--- | :--- | :--- | :--- |
| **Append** (Default) | `--mode append` | 既存データにある場所は**スキップ**し、未定義の新規データのみ生成・追記します。 | 新しい国やエリアを追加したい時 / 途中再開時 |
| **Overwrite** | `--mode overwrite` | 指定対象の場所が既に存在する場合、そのデータを**削除して再生成**します。手動編集データも消えるため注意。 | 特定エリアのデータを一から作り直したい時 |
| **Clean** | `--mode clean` | 既存の `seed.json` をバックアップし、**完全に空の状態から**全件生成します。 | 全体的なデータ構造変更時 / 初期構築時 |

### Usage

**Step 1: Zones Generation**
`config/target_regions.json` に定義されたRegionについて、主要なZoneを生成します。
アウトプット: `src/data/locations_seed.json` に追記されます。
```bash
python scripts/locations/generate_zones.py --mode append
```

**Step 2: Areas Generation**
生成されたZoneリスト (`config/target_zones.json`) を元に、Areaを生成します。
アウトプット: `src/data/locations_seed.json` に追記されます。
```bash
python scripts/locations/generate_areas.py --mode append
```

**Step 3: Points Generation**
生成されたAreaリスト (`config/target_areas.json`) を元に、Pointを生成します。
重複チェック (Levenshtein distance) が行われます。
アウトプット: `src/data/locations_seed.json` に追記されます。
```bash
python scripts/locations/generate_points.py --mode append
```

---

## 🐠 Creature Generation Pipeline
	
### Execution Modes
	
ロケーション生成と同様に、以下の3つの実行モードをサポートしています。
	
| Mode | Command Arg | Description | Use Case |
| :--- | :--- | :--- | :--- |
| **Append** (Default) | `--mode append` | 既存データにある生物/関連付けは**スキップ**し、未定義の新規データのみ生成・追記します。 | 新しい科(Family)を追加したい時 / 途中再開時 |
| **Overwrite** | `--mode overwrite` | 既存データがある場合、その項目を**再取得して上書き**します。IDは維持される場合とリセットされる場合があります。 | データを最新のAIモデルで更新したい時 |
| **Clean** | `--mode clean` | 既存ファイルをバックアップし、**完全に空の状態から**全件生成します。 | 全体的な再構築時 |:
	
### Usage
	
**Step 1: Generate List**
`config/target_families.json` を元に生物リストを作成。
アウトプット: `src/data/creatures_seed.json` に追記されます。
```bash
python scripts/creatures/generate_creatures_by_family.py --mode append
```
	
**Step 2: Fetch Images**
Wikipedia APIから画像を正確に取得。
(このスクリプトは常に既存データの画像がない項目のみを対象とします)
アウトプット: `src/data/creatures_seed.json` に追記されます。
```bash
python scripts/creatures/fetch_creature_images.py
```
	
**Step 3-A: Map Regions (Basic)**
生成された生物データに対して、広域の生息域（Region）情報をAIで付与します。
アウトプット: `src/data/creatures_seed.json` に追記（更新）されます。
```bash
python scripts/creatures/map_creatures_to_regions.py --mode append
```

**Step 3-B: Map Areas (Granular)**
`src/data/locations_seed.json` から抽出した具体的なダイビングエリア（約190箇所）を元に、詳細な生息情報を紐付けます。 **(推奨)**
アウトプット: `src/data/creatures_seed.json` に `areas` フィールドが追記（更新）されます。
```bash
python scripts/creatures/map_creatures_to_areas.py --mode append
```
	
**Step 4: Generate Point-Creature Associations**
各ポイントに、そのエリアに応じた生物を確率で割り振り、出現レアリティを決定します。
アウトプット: `src/data/point_creatures_seed.json` が生成されます。
```bash
python scripts/creatures/generate_point_creatures.py --mode append
```

#### レアリティ判定ロジック
各生物の「生息エリア（`areas`）」の数に基づいて、そのポイントでのレアリティ（`localRarity`）を決定します。

| レアリティ | 判定基準（生息エリア数） | 分布割合 (実績値 n=279) |
| :--- | :--- | :--- |
| **Common** | 12箇所以上 | **24.4%** (68種) |
| **Rare** | 5箇所以上 (11以下) | **48.0%** (134種) |
| **Epic** | 2箇所以上 (4以下) | **24.7%** (69種) |
| **Legendary** | 1箇所のみ (固有種・レア) | **2.9%** (8種) |

※ これに加え、ランダムな揺らぎ（±1段階の変動）が確率で適用されます。


## ⚙️ Configuration & System Design

- **API Key**: 環境変数 `GOOGLE_API_KEY` を設定してください。カンマ区切りで複数指定することで、**レート制限回避のためのローテーション**が自動で行われます。
- **Robust Model Selection**:
  - デフォルトで **`gemini-2.5-flash`** を優先的に使用します。
  - レート制限 (429 Error) が発生した場合、そのAPIキーのFlashモデルのみを一時停止し、同一キーの **`gemini-2.5-flash-lite`** または別のキーへ自動的にフォールバックします。
  - 429エラー時は65秒間のクールダウンをインテリジェントに管理します。
- **Resume Capability**:
  - 生物生成 (`generate_creatures_by_family.py`) は `processed_families_log.json` を使用して進捗を管理しており、中断しても途中から再開可能です。
