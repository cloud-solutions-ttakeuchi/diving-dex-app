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
 │   └─ map_creatures_to_regions.py     (Step 3)
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
```bash
python scripts/locations/generate_zones.py --mode append
```

**Step 2: Areas Generation**
生成されたZoneリスト (`config/target_zones.json`) を元に、Areaを生成します。
```bash
python scripts/locations/generate_areas.py --mode append
```

**Step 3: Points Generation**
生成されたAreaリスト (`config/target_areas.json`) を元に、Pointを生成します。
重複チェック (Levenshtein distance) が行われます。
```bash
python scripts/locations/generate_points.py --mode append
```

---

## 🐠 Creature Generation Pipeline

**Step 1: Generate List**
`config/target_families.json` を元に生物リストを作成。
```bash
python scripts/creatures/generate_creatures_by_family.py
```

**Step 2: Fetch Images**
Wikipedia APIから画像を正確に取得。
```bash
python scripts/creatures/fetch_creature_images.py
```

**Step 3: Map Regions**
生物-生息域(Region/Zone)のマッピング。
```bash
python scripts/creatures/map_creatures_to_regions.py
```

## ⚙️ Configuration

- **API Key**: 環境変数 `GOOGLE_API_KEY` を設定してください（**有料版推奨**）。
- **Model**: デフォルトで `gemini-2.5-flash` を使用します。
