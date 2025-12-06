# DiveDex マスタデータ管理手順書

このドキュメントは、アプリの公開データ（生物、ポイント、紐付け）を生成・更新するための手順を定めたものです。すべてのデータ生成は、Firestoreへの投入を前提としています。

### 1. 環境設定（初回のみ）

1. Firebase API Key の設定
    - `scripts/generate_creatures.py` などのファイルを開き、以下の部分をあなたの Gemini API キーに置き換えてください。

```
API_KEY = os.environ.get("GOOGLE_API_KEY", "YOUR_API_KEY_HERE")
```

2. 必要なライブラリのインストール:
    - ターミナルで以下を実行します。

```
pip install google-generativeai requests
```

### 2. データ生成フロー（3段階）

アプリが使用するマスタデータ（`Creature`, `Point`, `PointCreature`）は、以下の手順で段階的に生成します。

**ステップ 1: ロケーション（場所）情報の生成（Hierarchy Seed）**
 
 階層構造とポイント情報を2段階で生成します。
 
 |ファイル|役割|実行結果|
 |:--|:--|:--|
 |generate_structure.py|地域 > ゾーン > エリア の階層構造（骨組み）を生成します。|src/data/locations_structure.json|
 |fill_points.py|骨組みに対し、各エリアに具体的な「ダイビングポイント」を生成・充填します。|src/data/locations_seed.json|
 
 実行コマンド:
 
 ```bash
 python scripts/generate_structure.py
 python scripts/fill_points.py --id {point_id} --count {count}
 ```

**ステップ 2: 生物マスタの生成とユニーク化（Creature Seed）

新しい生物を追加し、既存の生物（例: クマノミ）との重複を避けてマージします。

|ファイル|役割|実行結果|
|:--|:--|:--|
|generate_creatures.py|既存の生物名を除外し、新しい生物データをAIに生成させる。和名で一意化する。|src/data/creatures_seed.json|

実行コマンド:

```
python scripts/generate_creatures.py
```

**ステップ 3: 画像の収集と紐付けテーブルの生成**

① 画像の収集（品質向上）

creatures_seed.json に含まれる英名キーワードを使い、Wikipediaから本物の画像URLとライセンス情報を取得します。

|ファイル|役割|実行結果|
|:--|:--|:--|
|fetch_real_images.py|creatures_seed.json を読み込み、画像URLを取得して上書きする。|src/data/creatures_real.json|

実行コマンド:

```
python scripts/fetch_real_images.py
```

② 紐付けテーブルの生成（出現率の設定）

最終的な結合テーブルを生成します。ここで「ポイントごとのレアリティ」が確定します。

|ファイル|役割|実行結果|
|:--|:--|:--|
|generate_point_creatures.py|creatures_real.json と locations_seed.json を結合し、PointCreature レコードを生成。localRarity を設定。|src/data/point_creatures_seed.json|

実行コマンド:

```
python scripts/generate_point_creatures.py
```

### 3. アプリへの反映（開発・運用）

アプリコードは、以下の3つのシードファイルを参照するように設定されます。

|参照先|役割|開発者が編集する場合|
|:--|:--|:--|
|locations_seed.json|地域・ポイントの構造（公式マスタ）|新エリアを追加したい時（generate_locations.pyを実行）|
|creatures_real.json|生物情報マスタ（画像・解説の正）|生物の解説や属性を修正したい時|
|point_creatures_seed.json|紐付けとポイントレアリティ|ポイントごとの出現率を微調整したい時|
